(function bootstrapPanel() {
  const editorLink = window.VueSourceInspectorEditorLink;
  const root = document.documentElement;
  const tabId = chrome.devtools.inspectedWindow.tabId;
  const PORT_NAME = "VSI_DEVTOOLS_PORT";
  const RECONNECT_BASE_DELAY_MS = 400;
  const RECONNECT_MAX_DELAY_MS = 3000;
  let port = null;
  let portConnected = true;
  let reconnectTimer = 0;
  let reconnectAttempts = 0;
  let reconnectRestoreEnabled = false;
  let awaitingInitState = false;
  const queuedMessages = [];

  const elements = {
    toggleButton: document.getElementById("toggleInspect"),
    toggleLabel: document.getElementById("toggleLabel"),
    clearSelection: document.getElementById("clearSelection"),
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon"),
    languageToggle: document.getElementById("languageToggle"),
    editorMenu: document.getElementById("editorMenu"),
    editorMenuButton: document.getElementById("editorMenuButton"),
    editorMenuCurrentIcon: document.getElementById("editorMenuCurrentIcon"),
    editorMenuLabel: document.getElementById("editorMenuLabel"),
    editorMenuPanel: document.getElementById("editorMenuPanel"),
    statusChip: document.getElementById("statusChip"),
    statusCopy: document.getElementById("statusCopy"),
    labelSource: document.getElementById("labelSource"),
    labelElement: document.getElementById("labelElement"),
    labelStyles: document.getElementById("labelStyles"),
    metaNote: document.getElementById("metaNote"),
    elementValue: document.getElementById("elementValue"),
    componentName: document.getElementById("componentName"),
    componentFileButton: document.getElementById("componentFileButton"),
    styleCandidates: document.getElementById("styleCandidates"),
    openHint: document.getElementById("openHint")
  };

  const state = {
    enabled: false,
    desiredEnabled: false,
    lastPayload: null,
    editorMenuOpen: false,
    inferredProjectRoot: "",
    settings: {
      editorKind: "",
      theme: "light",
      language: "en"
    }
  };

  let saveTimer = 0;
  const messages = {
    en: {
      inspect: "Inspect",
      cancel: "Cancel",
      idle: "Idle",
      inspecting: "Inspecting",
      selected: "Selected",
      error: "Error",
      statusIdle: "Open the target page, keep this panel visible, then enter inspect mode.",
      statusInspecting: "Move the mouse over the page, then click once to lock the current component result.",
      statusSelected: "Selection is locked. Click Inspect to resume live hover tracking.",
      source: "Source",
      element: "Element",
      styles: "Styles",
      openInEditor: "Open in editor",
      setDefaultIde: "Set default IDE",
      clear: "Clear",
      noElement: "No element yet",
      unavailable: "Unavailable",
      noReasonYet: "No inspection result yet.",
      hoverElement: "Hover a Vue-rendered element.",
      openHintReady: "Click a path to open it in the selected editor.",
      openHintUnavailable: "A path is required to open the file.",
      noStyles: "No SCSS candidates could be inferred from this source file.",
      resolvedReason: "Resolved from Vue runtime metadata.",
      autoRootDetected: (rootPath) => "Auto root detected: " + rootPath,
      autoRootPending: "Project root will be inferred automatically when an absolute file path is available.",
      restoreError: (error) => "Failed to load settings: " + error,
      saveError: (error) => "Failed to save settings: " + error,
      openError: "This page doesn't expose an absolute file path, so editor open can't be linked automatically.",
      openSuccess: (filePath) => "Tried opening the editor. The path was copied too: " + filePath,
      reconnecting: "DevTools connection lost. Reconnecting automatically...",
      themeAria: (theme) => theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      languageAria: "Toggle language",
      editorMenuAria: "Choose editor"
    },
    ko: {
      inspect: "검사",
      cancel: "중지",
      idle: "대기",
      inspecting: "검사 중",
      selected: "선택됨",
      error: "오류",
      statusIdle: "대상 페이지를 열고 이 패널을 유지한 뒤 검사 모드로 들어가세요.",
      statusInspecting: "페이지 위에서 마우스를 움직이고, 원하는 순간 한 번 클릭해 결과를 고정하세요.",
      statusSelected: "선택이 고정되었습니다. 다시 실시간 추적하려면 검사 버튼을 누르세요.",
      source: "소스",
      element: "요소",
      styles: "스타일",
      openInEditor: "에디터에서 열기",
      setDefaultIde: "기본 IDE 설정",
      clear: "지우기",
      noElement: "아직 선택된 요소가 없습니다",
      unavailable: "확인 불가",
      noReasonYet: "아직 검사 결과가 없습니다.",
      hoverElement: "Vue로 렌더링된 요소 위에 마우스를 올려보세요.",
      openHintReady: "경로를 클릭하면 선택한 에디터로 열기를 시도합니다.",
      openHintUnavailable: "파일 경로가 있어야 열 수 있습니다.",
      noStyles: "이 소스 파일 기준으로 추론할 수 있는 SCSS 후보가 없습니다.",
      resolvedReason: "Vue 런타임 메타데이터에서 확인했습니다.",
      autoRootDetected: (rootPath) => "자동 감지된 루트: " + rootPath,
      autoRootPending: "절대 파일 경로가 잡히면 프로젝트 루트를 자동으로 추론합니다.",
      restoreError: (error) => "설정을 불러오지 못했습니다: " + error,
      saveError: (error) => "설정 저장에 실패했습니다: " + error,
      openError: "이 페이지는 절대 파일 경로를 노출하지 않아 editor open을 자동 연결할 수 없습니다.",
      openSuccess: (filePath) => "에디터 실행을 시도했고, 경로도 복사했습니다: " + filePath,
      reconnecting: "DevTools 연결이 끊어졌습니다. 자동으로 다시 연결하는 중입니다...",
      themeAria: (theme) => theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
      languageAria: "언어 전환",
      editorMenuAria: "에디터 선택"
    }
  };
  const editorOptions = [
    { kind: "vscode", label: "VS Code", iconClass: "editor-option-icon--vscode" },
    { kind: "intellij", label: "IntelliJ IDEA", iconClass: "editor-option-icon--intellij" },
    { kind: "webstorm", label: "WebStorm", iconClass: "editor-option-icon--webstorm" },
    { kind: "cursor", label: "Cursor", iconClass: "editor-option-icon--cursor" },
    { kind: "antigravity", label: "Antigravity", iconClass: "editor-option-icon--antigravity" }
  ];

  connectPort();

  function onPortMessage(message) {
    if (!message) {
      return;
    }

    if (message.type === "VSI_PANEL_STATE") {
      const nextEnabled = Boolean(message.enabled);
      const shouldRestoreEnabled =
        awaitingInitState &&
        reconnectRestoreEnabled &&
        state.desiredEnabled &&
        !nextEnabled;

      if (awaitingInitState) {
        awaitingInitState = false;
        reconnectAttempts = 0;

        if (shouldRestoreEnabled) {
          safePostMessage({
            type: "VSI_DEVTOOLS_SET_ENABLED",
            tabId,
            enabled: true
          });
        } else {
          reconnectRestoreEnabled = false;
          renderRootStatus();
        }
      }

      state.enabled = nextEnabled;
      if (shouldRestoreEnabled) {
        state.desiredEnabled = true;
      } else {
        state.desiredEnabled = nextEnabled;
      }

      if (nextEnabled) {
        reconnectRestoreEnabled = false;
      }
      renderStatus();
      return;
    }

    if (message.type === "VSI_PANEL_INSPECTION") {
      renderInspection(message.payload || {});
      return;
    }

    if (message.type === "VSI_PANEL_CLEAR") {
      clearSelectionView();
      return;
    }

    if (message.type === "VSI_PANEL_ERROR") {
      renderError(message.message || "Unknown error");
    }
  }

  elements.toggleButton.addEventListener("click", () => {
    const nextEnabled = !state.enabled;
    state.desiredEnabled = nextEnabled;
    safePostMessage({
      type: "VSI_DEVTOOLS_SET_ENABLED",
      tabId,
      enabled: nextEnabled
    });
  });

  elements.clearSelection.addEventListener("click", () => {
    safePostMessage({
      type: "VSI_DEVTOOLS_CLEAR_SELECTION",
      tabId
    });
    clearSelectionView();
  });

  elements.componentFileButton.addEventListener("click", () => {
    const primary = state.lastPayload && state.lastPayload.primaryComponent
      ? state.lastPayload.primaryComponent
      : null;

    if (primary && primary.file) {
      openInEditor(primary.file);
    }
  });

  elements.themeToggle.addEventListener("click", onThemeToggle);
  elements.languageToggle.addEventListener("click", onLanguageToggle);
  elements.editorMenuButton.addEventListener("click", onEditorMenuToggle);
  document.addEventListener("click", onDocumentClick, true);
  document.addEventListener("keydown", onDocumentKeyDown, true);

  restoreSettings().catch((error) => {
    renderSettingsMessage(t("restoreError", stringifyError(error)), "error");
  });
  renderStaticText();
  applyTheme();
  renderEditorMenu();
  renderStatus();

  function renderStatus() {
    elements.toggleLabel.textContent = state.enabled ? t("cancel") : t("inspect");

    if (state.enabled) {
      elements.statusChip.dataset.state = "live";
      elements.statusChip.textContent = t("inspecting");
      elements.statusCopy.textContent = t("statusInspecting");
      return;
    }

    if (state.lastPayload) {
      elements.statusChip.dataset.state = "selected";
      elements.statusChip.textContent = t("selected");
      elements.statusCopy.textContent = t("statusSelected");
      return;
    }

    elements.statusChip.dataset.state = "idle";
    elements.statusChip.textContent = t("idle");
    elements.statusCopy.textContent = t("statusIdle");
  }

  function renderInspection(payload) {
    state.lastPayload = payload;
    const element = payload.element || {};
    const primaryComponent = payload.primaryComponent || {};
    const loadedStyles = Array.isArray(payload.styles) ? payload.styles : [];

    const inferredRoot = inferProjectRootFromPayload(payload);
    if (inferredRoot) {
      state.inferredProjectRoot = inferredRoot;
      chrome.storage.local.set({ vsiInferredProjectRoot: inferredRoot }).catch(() => {});
    }

    elements.elementValue.textContent = element.selector || "unknown";
    elements.componentName.textContent = primaryComponent.file
      ? getFileName(primaryComponent.file)
      : t("unavailable");
    elements.componentFileButton.textContent = primaryComponent.file || t("hoverElement");
    elements.componentFileButton.disabled = !primaryComponent.file;
    elements.openHint.textContent = primaryComponent.file
      ? t("openHintReady")
      : t("openHintUnavailable");

    renderRootStatus();
    renderStatus();
    renderStyleCandidates(loadedStyles);
  }

  function renderError(message) {
    clearSelectionView();
    closeEditorMenu();
    elements.statusChip.dataset.state = "error";
    elements.statusChip.textContent = t("error");
    elements.metaNote.textContent = message;
    elements.metaNote.dataset.tone = "error";
  }

  function clearSelectionView() {
    state.lastPayload = null;
    elements.elementValue.textContent = t("noElement");
    elements.componentName.textContent = t("unavailable");
    elements.componentFileButton.textContent = t("hoverElement");
    elements.componentFileButton.disabled = true;
    elements.openHint.textContent = t("openHintReady");
    renderStyleCandidates([]);
    renderStatus();
  }

  async function restoreSettings() {
    const stored = await chrome.storage.local.get([
      "vsiEditorKind",
      "vsiInferredProjectRoot",
      "vsiTheme",
      "vsiLanguage"
    ]);

    state.settings.editorKind = stored.vsiEditorKind || "";
    state.inferredProjectRoot = stored.vsiInferredProjectRoot || "";
    state.settings.theme = stored.vsiTheme || "light";
    state.settings.language = stored.vsiLanguage || "en";
    state.desiredEnabled = state.enabled;

    renderStaticText();
    applyTheme();
    renderEditorMenu();
    renderRootStatus();
  }

  function onThemeToggle() {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme();
    scheduleSettingsSave();
  }

  function onLanguageToggle() {
    state.settings.language = state.settings.language === "ko" ? "en" : "ko";
    renderStaticText();
    renderStatus();
    renderEditorMenu();
    if (state.lastPayload) {
      renderInspection(state.lastPayload);
    } else {
      renderRootStatus();
      renderStyleCandidates([]);
    }
    scheduleSettingsSave();
  }

  function onEditorMenuToggle(event) {
    event.stopPropagation();
    state.editorMenuOpen ? closeEditorMenu() : openEditorMenu();
  }

  function onEditorOptionSelect(kind) {
    state.settings.editorKind = kind;
    renderEditorMenu();
    closeEditorMenu();
    scheduleSettingsSave();
  }

  function onDocumentClick(event) {
    if (!state.editorMenuOpen) {
      return;
    }

    if (elements.editorMenu.contains(event.target)) {
      return;
    }

    closeEditorMenu();
  }

  function onDocumentKeyDown(event) {
    if (event.key === "Escape" && state.editorMenuOpen) {
      closeEditorMenu();
    }
  }

  async function openInEditor(filePath) {
    if (!state.settings.editorKind) {
      openEditorMenu();
      renderSettingsMessage(t("setDefaultIde"), "error");
      return;
    }

    const target = editorLink.buildEditorTarget({
      projectRoot: state.inferredProjectRoot,
      filePath,
      editorKind: state.settings.editorKind
    });

    if (!target.ok) {
      renderSettingsMessage(t("openError"), "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(target.absolutePath);
    } catch (_error) {
      // Clipboard copy is best-effort only.
    }

    const opener = document.createElement("a");
    opener.href = target.url;
    opener.target = "_blank";
    opener.rel = "noopener noreferrer";
    opener.click();

    renderSettingsMessage(
      t("openSuccess", target.absolutePath),
      "info"
    );
  }

  function renderRootStatus() {
    if (state.inferredProjectRoot) {
      renderSettingsMessage(t("autoRootDetected", state.inferredProjectRoot), "info");
      return;
    }

    renderSettingsMessage(t("autoRootPending"), "info");
  }

  function renderSettingsMessage(message, tone) {
    elements.metaNote.textContent = message;
    elements.metaNote.dataset.tone = tone === "error" ? "error" : "info";
  }

  function renderStaticText() {
    elements.clearSelection.textContent = t("clear");
    elements.labelSource.textContent = t("source");
    elements.labelElement.textContent = t("element");
    elements.labelStyles.textContent = t("styles");
    renderEditorMenuButton();
    elements.themeToggle.setAttribute("aria-label", t("themeAria", state.settings.theme));
    elements.languageToggle.setAttribute("aria-label", t("languageAria"));
    elements.editorMenuButton.setAttribute("aria-label", t("editorMenuAria"));

    if (!state.lastPayload) {
      elements.elementValue.textContent = t("noElement");
      elements.componentName.textContent = t("unavailable");
      elements.componentFileButton.textContent = t("hoverElement");
      elements.openHint.textContent = t("openHintReady");
      renderStyleCandidates([]);
    }
  }

  function applyTheme() {
    root.dataset.theme = state.settings.theme;
    elements.themeIcon.innerHTML = state.settings.theme === "dark" ? moonIcon() : sunIcon();
    elements.themeToggle.setAttribute("aria-label", t("themeAria", state.settings.theme));
  }

  function renderEditorMenu() {
    elements.editorMenuPanel.replaceChildren();
    renderEditorMenuButton();

    for (const option of editorOptions) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "editor-option";
      item.dataset.selected = String(option.kind === state.settings.editorKind);
      item.addEventListener("click", () => {
        onEditorOptionSelect(option.kind);
      });

      const main = document.createElement("span");
      main.className = "editor-option-main";

      const icon = document.createElement("span");
      icon.className = "editor-option-icon " + option.iconClass;

      const label = document.createElement("span");
      label.textContent = option.label;

      main.append(icon, label);
      item.append(main);

      if (option.kind === state.settings.editorKind) {
        const check = document.createElement("span");
        check.className = "editor-option-check";
        check.innerHTML = checkIcon();
        item.append(check);
      }

      elements.editorMenuPanel.appendChild(item);
    }
  }

  function openEditorMenu() {
    state.editorMenuOpen = true;
    elements.editorMenuPanel.hidden = false;
    elements.editorMenuButton.setAttribute("aria-expanded", "true");
  }

  function closeEditorMenu() {
    state.editorMenuOpen = false;
    elements.editorMenuPanel.hidden = true;
    elements.editorMenuButton.setAttribute("aria-expanded", "false");
  }

  function scheduleSettingsSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      chrome.storage.local
        .set({
          vsiEditorKind: state.settings.editorKind,
          vsiTheme: state.settings.theme,
          vsiLanguage: state.settings.language
        })
        .catch((error) => {
          renderSettingsMessage(t("saveError", stringifyError(error)), "error");
        });
    }, 120);
  }

  function safePostMessage(message) {
    if (!portConnected || !port) {
      queueMessage(message);
      scheduleReconnect();
      renderSettingsMessage(t("reconnecting"), "info");
      return true;
    }

    try {
      port.postMessage(message);
      return true;
    } catch (error) {
      portConnected = false;
      queueMessage(message);
      scheduleReconnect();
      renderSettingsMessage(t("reconnecting"), "info");
      return true;
    }
  }

  function connectPort() {
    clearReconnectTimer();

    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
    } catch (_error) {
      port = null;
      portConnected = false;
      scheduleReconnect();
      return;
    }

    portConnected = true;
    awaitingInitState = true;
    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(onPortDisconnect);
    postInitMessage();
    flushQueuedMessages();
  }

  function postInitMessage() {
    if (!port) {
      return;
    }

    try {
      port.postMessage({
        type: "VSI_DEVTOOLS_INIT",
        tabId
      });
    } catch (_error) {
      onPortDisconnect();
    }
  }

  function onPortDisconnect() {
    if (!portConnected) {
      return;
    }

    portConnected = false;
    port = null;
    reconnectRestoreEnabled = reconnectRestoreEnabled || state.desiredEnabled;
    renderSettingsMessage(t("reconnecting"), "info");
    scheduleReconnect();
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.max(1, 2 ** reconnectAttempts),
      RECONNECT_MAX_DELAY_MS
    );
    reconnectAttempts += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = 0;
      connectPort();
    }, delay);
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) {
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }

  function queueMessage(message) {
    if (!message) {
      return;
    }

    if (message.type === "VSI_DEVTOOLS_INIT") {
      return;
    }

    queuedMessages.push(message);
  }

  function flushQueuedMessages() {
    if (!port || !queuedMessages.length) {
      return;
    }

    while (queuedMessages.length) {
      const queuedMessage = queuedMessages.shift();
      try {
        port.postMessage(queuedMessage);
      } catch (_error) {
        queuedMessages.unshift(queuedMessage);
        onPortDisconnect();
        return;
      }
    }
  }

  function renderStyleCandidates(loadedStyles) {
    elements.styleCandidates.replaceChildren();

    const candidates = dedupeStyleCandidates(loadedStyles || []);
    if (!candidates.length) {
      const empty = document.createElement("li");
      const content = document.createElement("div");
      content.className = "chain-empty";
      content.textContent = t("noStyles");
      empty.appendChild(content);
      elements.styleCandidates.appendChild(empty);
      return;
    }

    for (const candidate of candidates) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => {
        openInEditor(candidate.absolutePath || candidate.path);
      });

      const name = document.createElement("p");
      name.className = "chain-name";
      name.textContent = candidate.label || getFileName(candidate.path);

      const file = document.createElement("p");
      file.className = "chain-file code muted";
      file.textContent = candidate.path;

      button.append(name, file);
      item.append(button);
      elements.styleCandidates.appendChild(item);
    }
  }

  function dedupeStyleCandidates(loadedStyles) {
    const merged = [];
    const seen = new Set();

    for (const candidate of loadedStyles || []) {
      if (!candidate || !candidate.path) {
        continue;
      }

      const key = candidate.absolutePath || candidate.path;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(candidate);
    }

    return merged;
  }

  function getFileName(filePath) {
    const normalized = String(filePath || "").replaceAll("\\", "/");
    return normalized.split("/").pop() || normalized || t("unavailable");
  }

  function t(key, value) {
    const lang = messages[state.settings.language] ? state.settings.language : "en";
    const entry = messages[lang][key];
    return typeof entry === "function" ? entry(value) : entry;
  }

  function sunIcon() {
    return [
      "<svg viewBox=\"0 0 24 24\" focusable=\"false\">",
      "<circle cx=\"12\" cy=\"12\" r=\"4.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\"/>",
      "<path d=\"M12 3v2.6M12 18.4V21M21 12h-2.6M5.6 12H3M18.36 5.64l-1.84 1.84M7.48 16.52l-1.84 1.84M18.36 18.36l-1.84-1.84M7.48 7.48L5.64 5.64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
      "</svg>"
    ].join("");
  }

  function moonIcon() {
    return [
      "<svg viewBox=\"0 0 24 24\" focusable=\"false\">",
      "<path d=\"M14.5 4.2a8.3 8.3 0 1 0 5.3 14.2a8.9 8.9 0 1 1-5.3-14.2Z\" fill=\"currentColor\"/>",
      "</svg>"
    ].join("");
  }

  function getCurrentEditorLabel() {
    const selected = editorOptions.find((option) => option.kind === state.settings.editorKind);
    return selected ? selected.label : t("setDefaultIde");
  }

  function renderEditorMenuButton() {
    const selected = editorOptions.find((option) => option.kind === state.settings.editorKind);
    elements.editorMenuLabel.textContent = selected ? selected.label : t("openInEditor");

    if (selected) {
      elements.editorMenuCurrentIcon.className =
        "editor-menu-current-icon " + selected.iconClass;
      elements.editorMenuCurrentIcon.innerHTML = "";
      elements.editorMenuButton.querySelector(".utility-icon:last-child").style.display = "none";
      return;
    }

    elements.editorMenuCurrentIcon.className =
      "editor-menu-current-icon editor-menu-current-icon--external";
    elements.editorMenuCurrentIcon.innerHTML = [
      "<svg viewBox=\"0 0 20 20\" focusable=\"false\">",
      "<path d=\"M11.5 4.25h4.25V8a.75.75 0 0 0 1.5 0V3.5a.75.75 0 0 0-.75-.75H12a.75.75 0 0 0 0 1.5h2.44l-5.72 5.72a.75.75 0 1 0 1.06 1.06l5.72-5.72V8a.75.75 0 0 0 1.5 0V3.5a.75.75 0 0 0-.75-.75h-4.75a.75.75 0 0 0 0 1.5Zm3.75 8.5a.75.75 0 0 1 1.5 0v2.75a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15.5V4.75a1.5 1.5 0 0 1 1.5-1.5h2.75a.75.75 0 0 1 0 1.5H4.5v10.75h10.75v-2.75Z\" fill=\"currentColor\"/>",
      "</svg>"
    ].join("");
    elements.editorMenuButton.querySelector(".utility-icon:last-child").style.display = "inline-flex";
  }

  function checkIcon() {
    return [
      "<svg viewBox=\"0 0 20 20\" focusable=\"false\">",
      "<path d=\"M5.75 10.25 8.5 13l5.75-5.75\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
      "</svg>"
    ].join("");
  }

  function inferProjectRootFromPayload(payload) {
    const candidates = [];

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

  function stringifyError(error) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
})();
