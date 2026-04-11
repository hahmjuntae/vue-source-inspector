(function bootstrapPageBridge() {
  if (!document.documentElement) {
    return;
  }

  const previousController = window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__;
  if (previousController && typeof previousController.teardown === "function") {
    try {
      previousController.teardown();
    } catch (_error) {
      delete window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__;
    }
  }

  const REQUEST_EVENT = "__VSI_REQUEST_V2__";
  const RESPONSE_EVENT = "__VSI_RESPONSE_V2__";
  const OPEN_EDITOR_EVENT = "__VSI_OPEN_EDITOR_V2__";
  const resolver = window.VueSourceInspectorResolver;

  if (!resolver) {
    window.addEventListener(REQUEST_EVENT, onMissingResolverRequest, true);
    window.addEventListener(OPEN_EDITOR_EVENT, onOpenEditorRequest, true);
    window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__ = {
      teardown() {
        window.removeEventListener(REQUEST_EVENT, onMissingResolverRequest, true);
        window.removeEventListener(OPEN_EDITOR_EVENT, onOpenEditorRequest, true);
        delete window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__;
      }
    };
    return;
  }

  window.addEventListener(REQUEST_EVENT, onInspectRequest, true);
  window.addEventListener(OPEN_EDITOR_EVENT, onOpenEditorRequest, true);
  window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__ = {
    teardown() {
      window.removeEventListener(REQUEST_EVENT, onInspectRequest, true);
      window.removeEventListener(OPEN_EDITOR_EVENT, onOpenEditorRequest, true);
      delete window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__;
    }
  };

  function emitResponse(requestId, payload) {
    window.dispatchEvent(
      new CustomEvent(RESPONSE_EVENT, {
        detail: {
          requestId,
          payload
        }
      })
    );
  }

  function onMissingResolverRequest(event) {
    const detail = event && event.detail ? event.detail : {};
    emitResponse(detail.requestId, {
      status: "error",
      reason: "resolver-unavailable"
    });
  }

  function onOpenEditorRequest(event) {
    const detail = event && event.detail ? event.detail : {};
    const url = typeof detail.url === "string" ? detail.url : "";
    if (!url) {
      return;
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.documentElement.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (_error) {
      // Ignore anchor fallback errors.
    }

    try {
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = url;
      document.documentElement.appendChild(frame);
      setTimeout(() => {
        frame.remove();
      }, 1200);
    } catch (_error) {
      // Ignore iframe fallback errors.
    }

    try {
      window.location.assign(url);
    } catch (_error) {
      // Ignore location fallback errors.
    }
  }

  async function onInspectRequest(event) {
    const detail = event && event.detail ? event.detail : {};
    const x = Number(detail.x);
    const y = Number(detail.y);
    const requestId = detail.requestId;

    let target = null;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      target = document.elementFromPoint(x, y);
    }

    const payload = resolver.inspectFromElement(target);
    const matchedStyles = resolver.collectMatchedStyleFiles(document, target);
    const sourceFiles = collectSourceFiles(payload);
    const sourceImportLists = await Promise.all(
      sourceFiles.map((filePath) => resolver.collectComponentStyleImports(filePath))
    );
    const sourceImports = sourceImportLists.flat();
    payload.styles = matchedStyles.concat(sourceImports);
    emitResponse(requestId, payload);
  }

  function collectSourceFiles(payload) {
    const seen = new Set();
    const files = [];

    const push = (component) => {
      if (!component || typeof component.file !== "string" || !component.file) {
        return;
      }

      if (seen.has(component.file)) {
        return;
      }

      seen.add(component.file);
      files.push(component.file);
    };

    push(payload && payload.nearestComponent);
    push(payload && payload.parentComponent);
    push(payload && payload.pageComponent);
    push(payload && payload.primaryComponent);

    if (payload && Array.isArray(payload.componentChain)) {
      for (const component of payload.componentChain) {
        push(component);
      }
    }

    return files;
  }
})();
