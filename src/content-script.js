(function bootstrapContentScript() {
  const rootNode = document.documentElement;
  if (!rootNode) {
    return;
  }

  const previousController =
    window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__;
  if (previousController && typeof previousController.teardown === "function") {
    previousController.teardown();
  }

  const REQUEST_EVENT = "__VSI_REQUEST__";
  const RESPONSE_EVENT = "__VSI_RESPONSE__";
  const ROOT_ID = "vsi-root";
  const STYLE_ID = "vsi-style";

  const state = {
    enabled: false,
    rafId: 0,
    requestId: 0,
    latestRequestId: 0,
    pendingLock: false,
    pointerX: 0,
    pointerY: 0,
    hoveredElement: null,
    overlay: null,
    tooltip: null,
    tooltipValue: null,
    lastPayload: null
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  window.addEventListener(RESPONSE_EVENT, onResolverResponse, true);
  window.addEventListener("keydown", onShortcutKeyDown, true);

  window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__ = {
    teardown
  };

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
    const detail = event && event.detail ? event.detail : {};
    if (detail.requestId !== state.latestRequestId || !state.enabled) {
      return;
    }

    state.lastPayload = detail.payload || {};
    chrome.runtime.sendMessage({
      type: "VSI_INSPECTION_RESULT",
      payload: state.lastPayload
    });
    updateTooltipContent(state.lastPayload);

    if (state.pendingLock) {
      state.pendingLock = false;
      disableInspector({ preservePayload: true });
    }
  }

  function enableInspector() {
    if (state.enabled) {
      return;
    }

    state.enabled = true;
    state.pendingLock = false;
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
    if (!state.enabled) {
      return;
    }

    state.enabled = false;
    state.pendingLock = false;
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

    state.hoveredElement = null;
    if (!settings.preservePayload) {
      state.lastPayload = null;
    }
    if (state.overlay) {
      state.overlay.style.display = "none";
    }
    if (state.tooltip) {
      state.tooltip.style.display = "none";
    }

    notifyStateChange();
  }

  function notifyStateChange() {
    chrome.runtime.sendMessage({
      type: "VSI_CONTENT_STATE_CHANGED",
      enabled: state.enabled
    });
  }

  function onMouseMove(event) {
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    updateTooltipPosition();
    scheduleInspection();
  }

  function onViewportChange() {
    if (!state.enabled) {
      return;
    }
    scheduleInspection();
  }

  function onMouseLeave() {
    if (state.overlay) {
      state.overlay.style.display = "none";
    }
    if (state.tooltip) {
      state.tooltip.style.display = "none";
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
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
    state.pendingLock = true;
    inspectAtPointer();

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function scheduleInspection() {
    if (!state.enabled || state.rafId) {
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

    const overlay = document.createElement("div");
    overlay.className = "vsi-overlay";

    const tooltip = document.createElement("div");
    tooltip.className = "vsi-tooltip";
    tooltip.innerHTML = [
      "<div class=\"vsi-tooltip__label\">Source</div>",
      "<div class=\"vsi-tooltip__value\">Hover a Vue-rendered element.</div>"
    ].join("");

    root.replaceChildren(overlay, tooltip);
    document.documentElement.appendChild(root);

    state.overlay = overlay;
    state.tooltip = tooltip;
    state.tooltipValue = tooltip.querySelector(".vsi-tooltip__value");
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#vsi-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; }",
      ".vsi-overlay { position: fixed; border: 2px solid #2563eb; background: rgba(37, 99, 235, 0.12); box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.35); display: none; }",
      ".vsi-tooltip { position: fixed; min-width: 220px; max-width: min(460px, calc(100vw - 24px)); padding: 8px 10px; border-radius: 10px; background: rgba(17, 17, 17, 0.94); color: #fff; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22); display: none; }",
      ".vsi-tooltip__label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.68); margin-bottom: 4px; }",
      ".vsi-tooltip__value { font-size: 12px; line-height: 1.4; word-break: break-word; }"
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
    if (!state.tooltip || !state.tooltipValue) {
      return;
    }

    const primary =
      payload && payload.nearestComponent
        ? payload.nearestComponent
        : payload && payload.primaryComponent
          ? payload.primaryComponent
          : null;
    state.tooltipValue.textContent =
      primary && primary.file ? primary.file : "No Vue source metadata";
    state.tooltip.style.display = "block";
    if (state.hoveredElement && typeof state.hoveredElement.getBoundingClientRect === "function") {
      updateTooltipPosition(state.hoveredElement.getBoundingClientRect());
    }
  }

  function updateTooltipPosition(rect) {
    if (!state.tooltip || !state.enabled || !rect) {
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

  function teardown() {
    disableInspector();
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    window.removeEventListener(RESPONSE_EVENT, onResolverResponse, true);
    window.removeEventListener("keydown", onShortcutKeyDown, true);
    delete window.__VUE_SOURCE_INSPECTOR_CONTENT_SCRIPT_CONTROLLER__;
  }
})();
