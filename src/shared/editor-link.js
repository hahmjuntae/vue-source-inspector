(function attachEditorLink(globalScope) {
  function normalizeProjectRoot(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    const normalized = value.trim().replaceAll("\\", "/");
    if (!normalized) {
      return "";
    }

    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  function normalizeFilePath(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    return value.trim().replaceAll("\\", "/");
  }

  function joinProjectPath(projectRoot, filePath) {
    const root = normalizeProjectRoot(projectRoot);
    const relativePath = normalizeFilePath(filePath);

    if (!relativePath) {
      return "";
    }

    if (root && relativePath.startsWith(root + "/")) {
      return relativePath;
    }

    if (/^[a-zA-Z]:\//.test(relativePath)) {
      return relativePath;
    }

    if (
      relativePath.startsWith("/") &&
      (relativePath.startsWith("/Users/") ||
        relativePath.startsWith("/home/") ||
        relativePath.startsWith("/var/"))
    ) {
      return relativePath;
    }

    if (relativePath.startsWith("/") && root) {
      return root + relativePath;
    }

    if (!root) {
      return "";
    }

    return root + "/" + relativePath.replace(/^\/+/, "");
  }

  function buildEditorTarget(options) {
    const editorKind = options && options.editorKind ? options.editorKind : "vscode";
    const filePath = options && options.filePath ? options.filePath : "";
    const projectRoot = options && options.projectRoot ? options.projectRoot : "";
    const absolutePath = joinProjectPath(projectRoot, filePath);

    if (!absolutePath) {
      return {
        ok: false,
        reason: "project-root-required",
        absolutePath: "",
        url: ""
      };
    }

    const encodedPath = encodeURI(absolutePath);
    let url = "";

    if (editorKind === "vscode") {
      url = "vscode://file" + encodedPath;
    } else if (editorKind === "intellij") {
      url = "idea://open?file=" + encodeURIComponent(absolutePath);
    } else if (editorKind === "webstorm") {
      url = "webstorm://open?file=" + encodeURIComponent(absolutePath);
    } else if (editorKind === "cursor") {
      url = "cursor://file" + encodedPath;
    } else if (editorKind === "antigravity") {
      url = "antigravity://file" + encodedPath;
    } else {
      return {
        ok: false,
        reason: "unknown-editor-kind",
        absolutePath,
        url: ""
      };
    }

    return {
      ok: true,
      reason: "",
      absolutePath,
      url
    };
  }

  const api = {
    normalizeFilePath,
    normalizeProjectRoot,
    joinProjectPath,
    buildEditorTarget
  };

  globalScope.VueSourceInspectorEditorLink = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
