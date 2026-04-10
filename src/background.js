(function bootstrapBackground() {
  const BADGE_COLOR = "#2563eb";
  const DEVTOOLS_RECONNECT_GRACE_MS = 1500;
  const devtoolsPorts = new Map();
  const pendingDisconnectTimers = new Map();
  const tabState = new Map();

  chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab || typeof tab.id !== "number") {
      return;
    }

    try {
      const nextEnabled = !getTabState(tab.id).enabled;
      await setInspectEnabled(tab.id, nextEnabled, "action");
    } catch (error) {
      console.error("[VSI] Failed to toggle inspector", error);
      await chrome.action.setBadgeText({ tabId: tab.id, text: "ERR" });
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "VSI_DEVTOOLS_PORT") {
      return;
    }

    let connectedTabId = null;

    port.onMessage.addListener((message) => {
      if (!message) {
        return;
      }

      if (message.type === "VSI_DEVTOOLS_INIT" && typeof message.tabId === "number") {
        connectedTabId = message.tabId;
        registerDevtoolsPort(connectedTabId, port);
        ensureScripts(connectedTabId)
          .then(() => {
            postToPort(port, {
              type: "VSI_PANEL_STATE",
              enabled: getTabState(connectedTabId).enabled
            });

            const lastPayload = getTabState(connectedTabId).lastPayload;
            if (lastPayload) {
              postToPort(port, {
                type: "VSI_PANEL_INSPECTION",
                payload: lastPayload
              });
            }
          })
          .catch((error) => {
            postToPort(port, {
              type: "VSI_PANEL_ERROR",
              message: stringifyError(error)
            });
          });
        return;
      }

      if (
        message.type === "VSI_DEVTOOLS_SET_ENABLED" &&
        typeof message.tabId === "number" &&
        typeof message.enabled === "boolean"
      ) {
        setInspectEnabled(message.tabId, message.enabled, "devtools").catch((error) => {
          postToTab(message.tabId, {
            type: "VSI_PANEL_ERROR",
            message: stringifyError(error)
          });
        });
        return;
      }

      if (message.type === "VSI_DEVTOOLS_CLEAR_SELECTION" && typeof message.tabId === "number") {
        clearSelection(message.tabId);
      }
    });

    port.onDisconnect.addListener(() => {
      if (typeof connectedTabId !== "number") {
        return;
      }

      unregisterDevtoolsPort(connectedTabId, port);
      scheduleDisconnectCleanup(connectedTabId);
    });
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message) {
      return;
    }

    if (
      message.type === "VSI_INSPECTION_RESULT" &&
      sender.tab &&
      typeof sender.tab.id === "number"
    ) {
      const state = getTabState(sender.tab.id);
      state.lastPayload = message.payload || null;
      postToTab(sender.tab.id, {
        type: "VSI_PANEL_INSPECTION",
        payload: state.lastPayload
      });
      return;
    }

    if (
      message.type === "VSI_CONTENT_STATE_CHANGED" &&
      sender.tab &&
      typeof sender.tab.id === "number"
    ) {
      const state = getTabState(sender.tab.id);
      state.enabled = Boolean(message.enabled);
      syncBadge(sender.tab.id, state.enabled).catch((error) => {
        console.error("[VSI] Failed to sync badge state", error);
      });
      postToTab(sender.tab.id, {
        type: "VSI_PANEL_STATE",
        enabled: state.enabled
      });
    }
  });

  async function ensureScripts(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/shared/vue-resolver.js", "src/page-bridge.js"],
      world: "MAIN"
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content-script.js"]
    });
  }

  async function setInspectEnabled(tabId, enabled, source) {
    await ensureScripts(tabId);

    const response = await sendMessageWithRecovery(tabId, {
      type: "VSI_SET_ENABLED",
      enabled
    });

    const state = getTabState(tabId);
    state.enabled = Boolean(response && response.enabled);
    state.controller = source;

    await syncBadge(tabId, state.enabled);
    postToTab(tabId, {
      type: "VSI_PANEL_STATE",
      enabled: state.enabled
    });
  }

  function getTabState(tabId) {
    if (!tabState.has(tabId)) {
      tabState.set(tabId, {
        enabled: false,
        lastPayload: null,
        controller: "action"
      });
    }

    return tabState.get(tabId);
  }

  function clearSelection(tabId) {
    const state = getTabState(tabId);
    state.lastPayload = null;
    postToTab(tabId, {
      type: "VSI_PANEL_CLEAR"
    });
  }

  function registerDevtoolsPort(tabId, port) {
    clearPendingDisconnect(tabId);
    if (!devtoolsPorts.has(tabId)) {
      devtoolsPorts.set(tabId, new Set());
    }
    devtoolsPorts.get(tabId).add(port);
  }

  function unregisterDevtoolsPort(tabId, port) {
    if (!devtoolsPorts.has(tabId)) {
      return;
    }

    const ports = devtoolsPorts.get(tabId);
    ports.delete(port);
    if (!ports.size) {
      devtoolsPorts.delete(tabId);
    }
  }

  function scheduleDisconnectCleanup(tabId) {
    clearPendingDisconnect(tabId);

    const timer = setTimeout(() => {
      pendingDisconnectTimers.delete(tabId);

      const ports = devtoolsPorts.get(tabId);
      if (ports && ports.size) {
        return;
      }

      const currentState = getTabState(tabId);
      if (currentState.enabled && currentState.controller === "devtools") {
        setInspectEnabled(tabId, false, "background").catch((error) => {
          console.error("[VSI] Failed to disable inspector after panel disconnect", error);
        });
      }
    }, DEVTOOLS_RECONNECT_GRACE_MS);

    pendingDisconnectTimers.set(tabId, timer);
  }

  function clearPendingDisconnect(tabId) {
    const timer = pendingDisconnectTimers.get(tabId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    pendingDisconnectTimers.delete(tabId);
  }

  function postToTab(tabId, message) {
    const ports = devtoolsPorts.get(tabId);
    if (!ports) {
      return;
    }

    for (const port of ports) {
      postToPort(port, message);
    }
  }

  function postToPort(port, message) {
    try {
      port.postMessage(message);
    } catch (error) {
      console.error("[VSI] Failed to post to devtools port", error);
    }
  }

  function stringifyError(error) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  async function sendMessageWithRecovery(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error;
      }

      await ensureScripts(tabId);
      await delay(50);
      return chrome.tabs.sendMessage(tabId, message);
    }
  }

  function isMissingReceiverError(error) {
    return stringifyError(error).includes("Receiving end does not exist");
  }

  function delay(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  async function syncBadge(tabId, enabled) {
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: BADGE_COLOR
    });
    await chrome.action.setBadgeText({
      tabId,
      text: enabled ? "ON" : ""
    });
  }
})();
