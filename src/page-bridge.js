(function bootstrapPageBridge() {
  if (!document.documentElement) {
    return;
  }

  const previousController = window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__;
  if (previousController && typeof previousController.teardown === "function") {
    previousController.teardown();
  }

  const REQUEST_EVENT = "__VSI_REQUEST__";
  const RESPONSE_EVENT = "__VSI_RESPONSE__";
  const resolver = window.VueSourceInspectorResolver;

  if (!resolver) {
    window.addEventListener(REQUEST_EVENT, onMissingResolverRequest, true);
    window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__ = {
      teardown() {
        window.removeEventListener(REQUEST_EVENT, onMissingResolverRequest, true);
        delete window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__;
      }
    };
    return;
  }

  window.addEventListener(REQUEST_EVENT, onInspectRequest, true);
  window.__VUE_SOURCE_INSPECTOR_PAGE_BRIDGE_CONTROLLER__ = {
    teardown() {
      window.removeEventListener(REQUEST_EVENT, onInspectRequest, true);
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
