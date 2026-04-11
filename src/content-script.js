(function bootstrapContentScript() {
  const rootNode = document.documentElement;
  if (!rootNode) {
    return;
  }

  const previousController =
    window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__;
  if (previousController && typeof previousController.teardown === "function") {
    try {
      previousController.teardown();
    } catch (_error) {
      delete window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__;
    }
  }

  const REQUEST_EVENT = "__VSI_REQUEST_V2__";
  const RESPONSE_EVENT = "__VSI_RESPONSE_V2__";
  const OPEN_EDITOR_EVENT = "__VSI_OPEN_EDITOR_V2__";
  const ROOT_ID = "vsi-root";
  const STYLE_ID = "vsi-style";
  const LOCK_UI_HIDE_DELAY_MS = 5000;

  const staleRoot = document.getElementById(ROOT_ID);
  if (staleRoot) {
    staleRoot.remove();
  }

  const staleStyle = document.getElementById(STYLE_ID);
  if (staleStyle) {
    staleStyle.remove();
  }

  const state = {
    enabled: false,
    locked: false,
    theme: "light",
    language: "en",
    editorKind: "vscode",
    inferredProjectRoot: "",
    rafId: 0,
    requestId: 0,
    latestRequestId: 0,
    pendingLock: false,
    lockRequestId: 0,
    lockUiHideTimer: 0,
    lockUiHidden: false,
    pointerX: 0,
    pointerY: 0,
    uiRoot: null,
    hoveredElement: null,
    overlay: null,
    tooltip: null,
    tooltipClose: null,
    tooltipBody: null,
    lastPayload: null
  };

  const messages = {
    en: {
      source: "Source",
      nearest: "Nearest",
      parent: "Parent",
      page: "Page",
      noSourceMetadata: "No Vue source metadata",
      closeSourcePopup: "Close source popup"
    },
    ko: {
      source: "소스",
      nearest: "가장 가까운 컴포넌트",
      parent: "부모 컴포넌트",
      page: "페이지 엔트리",
      noSourceMetadata: "노출된 Vue 소스 메타데이터가 없습니다",
      closeSourcePopup: "소스 팝업 닫기"
    }
  };

  if (!isExtensionContextAvailable()) {
    return;
  }

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  window.addEventListener(RESPONSE_EVENT, onResolverResponse, true);
  window.addEventListener("keydown", onShortcutKeyDown, true);

  window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__ = {
    teardown
  };

  restoreSettings().catch(() => {});

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (!message) {
      return;
    }

    if (message.type === "VSI_SET_ENABLED") {
      if (message.enabled) {
        enableInspector();
      } else {
        disableInspector();
      }

      sendResponse({ enabled: state.enabled });
    }
  }

  function onResolverResponse(event) {
    try {
      const detail = event && event.detail ? event.detail : {};
      const isLatestResponse = detail.requestId === state.latestRequestId;
      const isLockResponse = state.pendingLock && detail.requestId === state.lockRequestId;
      if ((!isLatestResponse && !isLockResponse) || !state.enabled) {
        return;
      }

      const shouldLock = isLockResponse;
      if (shouldLock) {
        state.pendingLock = false;
        state.lockRequestId = 0;
        state.locked = true;
      }

      state.lastPayload = detail.payload || {};
      safeRuntimeSendMessage({
        type: "VSI_INSPECTION_RESULT",
        payload: state.lastPayload
      });
      updateTooltipContent(state.lastPayload);

      if (shouldLock) {
        disableInspector({ preservePayload: true, preserveUi: true, locked: true });
      }
    } catch (error) {
      if (!handleContextInvalidation(error)) {
        throw error;
      }
    }
  }

  function enableInspector() {
    if (state.enabled) {
      return;
    }

    state.enabled = true;
    state.locked = false;
    state.pendingLock = false;
    state.lockRequestId = 0;
    state.lockUiHidden = false;
    clearLockedUiHideTimer();
    restoreSettings().catch(() => {});
    ensureUi();

    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("click", onClick, true);
    document.addEventListener("mouseleave", onMouseLeave, true);

    notifyStateChange();
  }

  function disableInspector(options) {
    const settings = options || {};
    if (!state.enabled && !state.locked) {
      return;
    }

    state.enabled = false;
    state.locked = Boolean(settings.locked);
    state.pendingLock = false;
    state.lockRequestId = 0;
    state.lockUiHidden = false;
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("click", onClick, true);
    document.removeEventListener("mouseleave", onMouseLeave, true);

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    if (!settings.preserveUi) {
      state.hoveredElement = null;
    }
    if (!settings.preservePayload) {
      state.lastPayload = null;
    }
    if (state.overlay) {
      state.overlay.style.display = settings.preserveUi ? "block" : "none";
    }
    if (state.tooltip) {
      state.tooltip.style.display = settings.preserveUi ? "block" : "none";
      state.tooltip.dataset.locked = state.locked ? "true" : "false";
    }
    if (state.tooltipClose) {
      state.tooltipClose.hidden = !state.locked;
    }

    if (state.locked && settings.preserveUi) {
      scheduleLockedUiHide();
    } else {
      clearLockedUiHideTimer();
    }

    notifyStateChange();
  }

  function dismissLockedSelection() {
    try {
      if (!state.locked) {
        return;
      }

      state.locked = false;
      state.pendingLock = false;
      state.lockRequestId = 0;
      state.lockUiHidden = false;
      clearLockedUiHideTimer();
      state.hoveredElement = null;
      state.lastPayload = null;

      if (state.overlay) {
        state.overlay.style.display = "none";
      }
      if (state.tooltip) {
        state.tooltip.style.display = "none";
        state.tooltip.dataset.locked = "false";
      }
      if (state.tooltipClose) {
        state.tooltipClose.hidden = true;
      }

      safeRuntimeSendMessage({
        type: "VSI_SELECTION_CLEARED"
      });
      notifyStateChange();
    } catch (error) {
      if (!handleContextInvalidation(error)) {
        throw error;
      }
    }
  }

  function notifyStateChange() {
    safeRuntimeSendMessage({
      type: "VSI_CONTENT_STATE_CHANGED",
      enabled: state.enabled
    });
  }

  function onMouseMove(event) {
    if (state.locked || state.pendingLock) {
      return;
    }
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    updateTooltipPosition();
    scheduleInspection();
  }

  function onViewportChange() {
    if (!state.enabled && !state.locked) {
      return;
    }

    if (state.locked) {
      if (state.lockUiHidden) {
        return;
      }
      if (state.hoveredElement) {
        updateOverlay(state.hoveredElement);
      }
      return;
    }

    if (state.pendingLock) {
      return;
    }

    scheduleInspection();
  }

  function onMouseLeave() {
    if (state.locked) {
      return;
    }
    if (state.overlay) {
      state.overlay.style.display = "none";
    }
    if (state.tooltip) {
      state.tooltip.style.display = "none";
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (state.locked) {
        dismissLockedSelection();
        return;
      }
      disableInspector();
    }
  }

  function onShortcutKeyDown(event) {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey
    ) {
      return;
    }

    const isModifierPressed = event.shiftKey && (event.ctrlKey || event.metaKey);
    if (!isModifierPressed) {
      return;
    }

    if (String(event.key).toLowerCase() !== "x") {
      return;
    }

    const target = event.target;
    if (
      target &&
      ((target.tagName && /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName)) ||
        target.isContentEditable)
    ) {
      return;
    }

    event.preventDefault();
    state.enabled ? disableInspector() : enableInspector();
  }

  function onClick(event) {
    if (!state.enabled) {
      return;
    }

    state.pointerX = event.clientX;
    state.pointerY = event.clientY;

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    const target = document.elementFromPoint(state.pointerX, state.pointerY);
    if (target) {
      state.hoveredElement = target;
      updateOverlay(target);
    }

    state.pendingLock = false;
    state.lockRequestId = 0;
    state.locked = true;
    disableInspector({ preservePayload: true, preserveUi: true, locked: true });
    if (state.lastPayload) {
      renderTooltipLayers(state.lastPayload);
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function scheduleInspection() {
    if (!state.enabled || state.locked || state.pendingLock || state.rafId) {
      return;
    }

    state.rafId = requestAnimationFrame(() => {
      state.rafId = 0;
      inspectAtPointer();
    });
  }

  function inspectAtPointer() {
    const target = document.elementFromPoint(state.pointerX, state.pointerY);
    state.hoveredElement = target;
    updateOverlay(target);

    state.requestId += 1;
    state.latestRequestId = state.requestId;

    window.dispatchEvent(
      new CustomEvent(REQUEST_EVENT, {
        detail: {
          requestId: state.requestId,
          x: state.pointerX,
          y: state.pointerY
        }
      })
    );

    return state.requestId;
  }

  function ensureUi() {
    injectStyles();

    if (state.overlay) {
      state.overlay.style.display = "block";
      return;
    }

    const root = document.getElementById(ROOT_ID) || document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-vsi-root", "true");
    root.dataset.theme = state.theme;

    const overlay = document.createElement("div");
    overlay.className = "vsi-overlay";

    const tooltip = document.createElement("div");
    tooltip.className = "vsi-tooltip";
    tooltip.dataset.locked = "false";

    const header = document.createElement("div");
    header.className = "vsi-tooltip__header";

    const label = document.createElement("div");
    label.className = "vsi-tooltip__label";
    label.textContent = tt("source");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "vsi-tooltip__close";
    closeButton.hidden = true;
    closeButton.setAttribute("aria-label", tt("closeSourcePopup"));
    closeButton.innerHTML = [
      "<svg viewBox=\"0 0 20 20\" focusable=\"false\">",
      "<path d=\"M6 6l8 8M14 6l-8 8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>",
      "</svg>"
    ].join("");
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissLockedSelection();
    });

    const body = document.createElement("div");
    body.className = "vsi-tooltip__body";
    body.textContent = tt("noSourceMetadata");

    header.append(label, closeButton);
    tooltip.append(header, body);

    root.replaceChildren(overlay, tooltip);
    document.documentElement.appendChild(root);

    state.uiRoot = root;
    state.overlay = overlay;
    state.tooltip = tooltip;
    state.tooltipClose = closeButton;
    state.tooltipBody = body;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    const geistUrl = safeRuntimeGetUrl("src/devtools/assets/fonts/geist-sans/Geist-Variable.woff2");
    const geistMonoUrl = safeRuntimeGetUrl("src/devtools/assets/fonts/geist-mono/GeistMono-Variable.woff2");
    if (!geistUrl || !geistMonoUrl) {
      return;
    }
    style.textContent = [
      "@font-face { font-family: 'VSI Geist'; src: url('" + geistUrl + "') format('woff2'); font-weight: 100 900; font-style: normal; }",
      "@font-face { font-family: 'VSI Geist Mono'; src: url('" + geistMonoUrl + "') format('woff2'); font-weight: 100 900; font-style: normal; }",
      "#vsi-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: 'VSI Geist', Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; font-feature-settings: 'liga' 1; --vsi-overlay-border: #2563eb; --vsi-overlay-fill: rgba(37, 99, 235, 0.12); --vsi-overlay-shadow: rgba(37, 99, 235, 0.35); --vsi-tooltip-bg: rgba(255, 255, 255, 0.96); --vsi-tooltip-text: #171717; --vsi-tooltip-muted: rgba(23, 23, 23, 0.6); --vsi-tooltip-card: rgba(0, 0, 0, 0.04); --vsi-tooltip-shadow: 0 8px 24px rgba(15, 23, 42, 0.14); }",
      "#vsi-root[data-theme='dark'] { --vsi-overlay-border: #6aa9ff; --vsi-overlay-fill: rgba(106, 169, 255, 0.16); --vsi-overlay-shadow: rgba(106, 169, 255, 0.35); --vsi-tooltip-bg: rgba(17, 17, 17, 0.94); --vsi-tooltip-text: #ffffff; --vsi-tooltip-muted: rgba(255, 255, 255, 0.68); --vsi-tooltip-card: rgba(255, 255, 255, 0.06); --vsi-tooltip-shadow: 0 8px 24px rgba(0, 0, 0, 0.22); }",
      ".vsi-overlay { position: fixed; border: 2px solid var(--vsi-overlay-border); background: var(--vsi-overlay-fill); box-shadow: 0 0 0 1px var(--vsi-overlay-shadow); display: none; }",
      ".vsi-tooltip { position: fixed; min-width: 260px; max-width: min(520px, calc(100vw - 24px)); padding: 10px 12px; border-radius: 12px; background: var(--vsi-tooltip-bg); color: var(--vsi-tooltip-text); box-shadow: var(--vsi-tooltip-shadow); display: none; pointer-events: none; }",
      ".vsi-tooltip[data-locked='true'] { pointer-events: auto; }",
      ".vsi-tooltip__header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }",
      ".vsi-tooltip__label { color: var(--vsi-tooltip-muted); font-size: 11px; font-weight: 600; line-height: 1.2; letter-spacing: 0; text-transform: none; }",
      ".vsi-tooltip__close { appearance: none; -webkit-appearance: none; border: 0; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: transparent; color: var(--vsi-tooltip-muted); cursor: pointer; }",
      ".vsi-tooltip__close:hover { background: var(--vsi-tooltip-card); color: var(--vsi-tooltip-text); }",
      ".vsi-tooltip__close svg { width: 14px; height: 14px; }",
      ".vsi-tooltip__body { display: grid; gap: 8px; }",
      ".vsi-tooltip__empty { font-size: 12px; line-height: 1.4; color: var(--vsi-tooltip-text); }",
      ".vsi-tooltip__item { display: grid; gap: 4px; width: 100%; border: 0; padding: 8px 10px; border-radius: 10px; background: var(--vsi-tooltip-card); text-align: left; color: inherit; font: inherit; text-decoration: none; cursor: default; }",
      ".vsi-tooltip__item:visited, .vsi-tooltip__item:hover, .vsi-tooltip__item:active { color: inherit; text-decoration: none; }",
      ".vsi-tooltip[data-locked='true'] .vsi-tooltip__item { cursor: pointer; }",
      ".vsi-tooltip[data-locked='true'] .vsi-tooltip__item:hover { background: rgba(0, 114, 245, 0.12); }",
      "#vsi-root[data-theme='dark'] .vsi-tooltip[data-locked='true'] .vsi-tooltip__item:hover { background: rgba(106, 169, 255, 0.12); }",
      ".vsi-tooltip__meta { display: flex; flex-wrap: wrap; gap: 6px; }",
      ".vsi-tooltip__badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 500; line-height: 1; letter-spacing: 0; }",
      ".vsi-tooltip__badge--nearest { background: rgba(0, 114, 245, 0.12); color: #005ad1; }",
      ".vsi-tooltip__badge--parent { background: rgba(22, 163, 74, 0.12); color: #15803d; }",
      ".vsi-tooltip__badge--page { background: rgba(168, 85, 247, 0.14); color: #7e22ce; }",
      "#vsi-root[data-theme='dark'] .vsi-tooltip__badge--nearest { background: rgba(106, 169, 255, 0.18); color: #9ec4ff; }",
      "#vsi-root[data-theme='dark'] .vsi-tooltip__badge--parent { background: rgba(74, 222, 128, 0.18); color: #86efac; }",
      "#vsi-root[data-theme='dark'] .vsi-tooltip__badge--page { background: rgba(216, 180, 254, 0.18); color: #d8b4fe; }",
      ".vsi-tooltip__name { font-size: 15px; font-weight: 600; line-height: 1.35; color: var(--vsi-tooltip-text); word-break: break-word; }",
      ".vsi-tooltip__file { font-size: 12px; line-height: 1.45; color: var(--vsi-tooltip-muted); word-break: break-word; }"
    ].join("\n");

    document.documentElement.appendChild(style);
  }

  function updateOverlay(target) {
    if (!state.overlay) {
      return;
    }

    if (!target || target.nodeType !== Node.ELEMENT_NODE) {
      state.overlay.style.display = "none";
      return;
    }

    const rect = target.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      state.overlay.style.display = "none";
      return;
    }

    state.overlay.style.display = "block";
    state.overlay.style.top = rect.top + "px";
    state.overlay.style.left = rect.left + "px";
    state.overlay.style.width = rect.width + "px";
    state.overlay.style.height = rect.height + "px";
    updateTooltipPosition(rect);
  }

  function updateTooltipContent(payload) {
    if (!state.tooltip || !state.tooltipBody) {
      return;
    }

    renderTooltipLayers(payload);
    state.tooltip.style.display = "block";
    if (state.hoveredElement && typeof state.hoveredElement.getBoundingClientRect === "function") {
      updateTooltipPosition(state.hoveredElement.getBoundingClientRect());
    }
  }

  function renderTooltipLayers(payload) {
    state.tooltipBody.replaceChildren();

    const layers = buildTooltipLayers(payload);
    if (!layers.length) {
      const empty = document.createElement("div");
      empty.className = "vsi-tooltip__empty";
      empty.textContent = tt("noSourceMetadata");
      state.tooltipBody.appendChild(empty);
      return;
    }

    for (const layer of layers) {
      const openPath = getTooltipOpenPath(layer.component);
      const isOpenable = Boolean(state.locked && openPath);
      const item = document.createElement(isOpenable ? "a" : "button");
      item.className = "vsi-tooltip__item";
      if (isOpenable) {
        item.href = layer.target && layer.target.ok ? layer.target.url : "#";
        item.rel = "noopener noreferrer";
      } else {
        item.type = "button";
        item.disabled = true;
      }

      const meta = document.createElement("div");
      meta.className = "vsi-tooltip__meta";

      for (const kind of layer.kinds) {
        const badge = document.createElement("span");
        badge.className = "vsi-tooltip__badge vsi-tooltip__badge--" + kind.key;
        badge.textContent = kind.label;
        meta.appendChild(badge);
      }

      const name = document.createElement("div");
      name.className = "vsi-tooltip__name";
      name.textContent = getFileName(layer.component.file);

      const file = document.createElement("div");
      file.className = "vsi-tooltip__file";
      file.textContent = layer.component.file;

      if (isOpenable) {
        item.addEventListener("mousedown", (event) => {
          if (event.button !== 0) {
            return;
          }

          if (layer.target && layer.target.ok) {
            openEditorTargetFromPopup(layer.target);
            requestEditorOpenInPage(layer.target.url || "");
          }
        });

        item.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!layer.target || !layer.target.ok) {
            event.preventDefault();
          }

          safeRuntimeSendMessage({
            type: "VSI_OPEN_EDITOR_REQUEST",
            filePath: openPath,
            sourceKey: getTooltipSourceKey(layer.component),
            url: layer.target && layer.target.ok ? layer.target.url || "" : ""
          });

          safeRuntimeSendMessage({
            type: "VSI_FOCUS_SOURCE_REQUEST",
            sourceKey: getTooltipSourceKey(layer.component)
          });

          navigator.clipboard.writeText(openPath).catch(() => {});
        });
      }

      item.append(meta, name, file);
      state.tooltipBody.appendChild(item);
    }
  }

  function buildTooltipLayers(payload) {
    const layers = [];
    pushTooltipLayer(layers, payload && payload.nearestComponent, {
      key: "nearest",
      label: tt("nearest")
    });
    pushTooltipLayer(layers, payload && payload.parentComponent, {
      key: "parent",
      label: tt("parent")
    });
    pushTooltipLayer(layers, payload && payload.pageComponent, {
      key: "page",
      label: tt("page")
    });
    return layers;
  }

  function pushTooltipLayer(target, component, kind) {
    if (!component || !component.file) {
      return;
    }

    const key = component.absoluteFile || component.file || component.name || "";
    const existing = target.find((entry) => {
      const entryKey = entry.component.absoluteFile || entry.component.file || entry.component.name || "";
      return entryKey === key;
    });

    if (existing) {
      if (!existing.kinds.some((entryKind) => entryKind.key === kind.key)) {
        existing.kinds.push(kind);
      }
      return;
    }

    target.push({
      component,
      kinds: [kind],
      target: buildTooltipEditorTarget(component)
    });
  }

  function getFileName(filePath) {
    const normalized = String(filePath || "").replaceAll("\\", "/");
    return normalized.split("/").pop() || normalized || "Unknown";
  }

  function getTooltipOpenPath(component) {
    if (!component) {
      return "";
    }

    return component.absoluteFile || component.file || "";
  }

  function getTooltipSourceKey(component) {
    if (!component) {
      return "";
    }

    return component.absoluteFile || component.file || component.name || "";
  }

  function buildTooltipEditorTarget(component) {
    if (!component || !component.file) {
      return null;
    }

    const editorLink = globalThis.VueSourceInspectorEditorLink;
    if (!editorLink || typeof editorLink.buildEditorTarget !== "function") {
      return null;
    }

    const projectRoot = state.inferredProjectRoot || inferProjectRootFromPayload(state.lastPayload);
    const target = editorLink.buildEditorTarget({
      projectRoot,
      filePath: component.absoluteFile || component.file,
      editorKind: state.editorKind
    });

    if (!target.ok) {
      return target;
    }

    target.sourceKey = component.absoluteFile || component.file || component.name || "";
    return target;
  }

  function inferProjectRootFromPayload(payload) {
    const candidates = [];

    if (payload && payload.nearestComponent) {
      candidates.push(payload.nearestComponent);
    }
    if (payload && payload.parentComponent) {
      candidates.push(payload.parentComponent);
    }
    if (payload && payload.pageComponent) {
      candidates.push(payload.pageComponent);
    }
    if (payload && payload.primaryComponent) {
      candidates.push(payload.primaryComponent);
    }
    if (payload && Array.isArray(payload.componentChain)) {
      candidates.push(...payload.componentChain);
    }

    for (const entry of candidates) {
      const root = inferProjectRoot(
        entry && entry.absoluteFile ? entry.absoluteFile : "",
        entry && entry.file ? entry.file : ""
      );
      if (root) {
        return root;
      }
    }

    return "";
  }

  function inferProjectRoot(absoluteFile, displayFile) {
    if (!absoluteFile || !displayFile) {
      return "";
    }

    const absolute = absoluteFile.replaceAll("\\", "/");
    const display = displayFile.replaceAll("\\", "/");

    if (absolute.endsWith(display)) {
      return absolute.slice(0, absolute.length - display.length) || "";
    }

    const markerIndex = absolute.indexOf("/src/");
    if (markerIndex >= 0) {
      return absolute.slice(0, markerIndex);
    }

    return "";
  }

  function updateTooltipPosition(rect) {
    if (!state.tooltip || (!state.enabled && !state.locked) || !rect) {
      return;
    }

    const offset = 12;
    const tooltipWidth = Math.max(220, state.tooltip.offsetWidth || 320);
    const tooltipHeight = Math.max(44, state.tooltip.offsetHeight || 56);
    const preferredLeft = rect.right + offset;
    const fallbackLeft = Math.max(12, rect.left - tooltipWidth - offset);
    const left =
      preferredLeft + tooltipWidth + 12 <= window.innerWidth
        ? preferredLeft
        : fallbackLeft;
    const top = Math.min(
      Math.max(12, rect.top),
      Math.max(12, window.innerHeight - tooltipHeight - 12)
    );

    state.tooltip.style.left = left + "px";
    state.tooltip.style.top = top + "px";
  }

  function scheduleLockedUiHide() {
    clearLockedUiHideTimer();
    state.lockUiHidden = false;
    state.lockUiHideTimer = window.setTimeout(() => {
      state.lockUiHideTimer = 0;
      hideLockedUi();
    }, LOCK_UI_HIDE_DELAY_MS);
  }

  function clearLockedUiHideTimer() {
    if (!state.lockUiHideTimer) {
      return;
    }

    window.clearTimeout(state.lockUiHideTimer);
    state.lockUiHideTimer = 0;
  }

  function hideLockedUi() {
    if (!state.locked) {
      return;
    }

    state.lockUiHidden = true;

    if (state.overlay) {
      state.overlay.style.display = "none";
    }

    if (state.tooltip) {
      state.tooltip.style.display = "none";
    }
  }

  function teardown() {
    disableInspector();
    removeRuntimeListenerSafely();
    window.removeEventListener(RESPONSE_EVENT, onResolverResponse, true);
    window.removeEventListener("keydown", onShortcutKeyDown, true);
    delete window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__;
  }

  async function restoreSettings() {
    const stored = await safeStorageGet(["vsiTheme", "vsiEditorKind", "vsiLanguage", "vsiInferredProjectRoot"]);
    if (!stored) {
      return;
    }
    state.theme = normalizeTheme(stored.vsiTheme);
    state.editorKind = normalizeEditorKind(stored.vsiEditorKind);
    state.language = normalizeLanguage(stored.vsiLanguage);
    state.inferredProjectRoot = normalizeProjectRoot(stored.vsiInferredProjectRoot);
    applyTheme();
    applyLanguage();
  }

  function applyTheme() {
    if (state.uiRoot) {
      state.uiRoot.dataset.theme = state.theme;
    }
  }

  function applyLanguage() {
    if (!state.tooltip) {
      return;
    }

    const label = state.tooltip.querySelector(".vsi-tooltip__label");
    if (label) {
      label.textContent = tt("source");
    }

    if (state.tooltipClose) {
      state.tooltipClose.setAttribute("aria-label", tt("closeSourcePopup"));
    }

    if (!state.lastPayload) {
      renderTooltipLayers(null);
    } else {
      renderTooltipLayers(state.lastPayload);
    }
  }

  function normalizeTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function normalizeLanguage(value) {
    return value === "ko" ? "ko" : "en";
  }

  function normalizeEditorKind(value) {
    return typeof value === "string" && value ? value : "vscode";
  }

  function normalizeProjectRoot(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    const normalized = value.trim().replaceAll("\\", "/");
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  function isExtensionContextAvailable() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch (_error) {
      return false;
    }
  }

  function isContextInvalidatedError(error) {
    return Boolean(
      error &&
        typeof error.message === "string" &&
        error.message.includes("Extension context invalidated")
    );
  }

  function handleContextInvalidation(error) {
    if (!isContextInvalidatedError(error)) {
      return false;
    }

    try {
      removeRuntimeListenerSafely();
      window.removeEventListener(RESPONSE_EVENT, onResolverResponse, true);
      window.removeEventListener("keydown", onShortcutKeyDown, true);
      delete window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__;
    } catch (_cleanupError) {
      // Ignore cleanup failures during extension reload.
    }

    return true;
  }

  function safeRuntimeSendMessage(message) {
    if (!isExtensionContextAvailable()) {
      return Promise.resolve();
    }

    try {
      return chrome.runtime.sendMessage(message).catch((error) => {
        if (!handleContextInvalidation(error)) {
          throw error;
        }
      });
    } catch (error) {
      if (!handleContextInvalidation(error)) {
        throw error;
      }
      return Promise.resolve();
    }
  }

  function safeRuntimeGetUrl(path) {
    if (!isExtensionContextAvailable()) {
      return "";
    }

    try {
      return chrome.runtime.getURL(path);
    } catch (error) {
      handleContextInvalidation(error);
      return "";
    }
  }

  function requestEditorOpenInPage(url) {
    if (!url) {
      return;
    }

    try {
      window.dispatchEvent(
        new CustomEvent(OPEN_EDITOR_EVENT, {
          detail: {
            url
          }
        })
      );
    } catch (_error) {
      // Ignore page-world dispatch failures and keep background fallback.
    }
  }

  function openEditorTargetFromPopup(target) {
    if (!target || !target.url) {
      return;
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = target.url;
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.documentElement.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (_error) {
      // Ignore direct anchor failures and continue with location fallback.
    }

    try {
      window.location.href = target.url;
    } catch (_error) {
      // Ignore location fallback failures.
    }
  }

  async function safeStorageGet(keys) {
    if (!isExtensionContextAvailable()) {
      return null;
    }

    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      if (!handleContextInvalidation(error)) {
        throw error;
      }
      return null;
    }
  }

  function removeRuntimeListenerSafely() {
    try {
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      }
    } catch (_error) {
      // Ignore invalidated runtime cleanup.
    }
  }

  function tt(key) {
    const lang = messages[state.language] ? state.language : "en";
    return messages[lang][key] || messages.en[key] || key;
  }
})();
