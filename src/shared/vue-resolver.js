(function attachResolver(globalScope) {
  const componentStyleImportCache = new Map();
  function inspectFromElement(element) {
    const safeElement = normalizeElement(element);
    const elementSummary = summarizeElement(safeElement);

    if (!safeElement) {
      return {
        status: "unresolved",
        reason: "no-element-under-pointer",
        framework: null,
        element: elementSummary,
        primaryComponent: null,
        componentChain: [],
        styles: []
      };
    }

    const vue3Instance = findVue3Instance(safeElement);
    if (vue3Instance) {
      return buildVue3Payload(vue3Instance, safeElement);
    }

    const vue2Vm = findVue2Vm(safeElement);
    if (vue2Vm) {
      return buildVue2Payload(vue2Vm, safeElement);
    }

    return {
      status: "unresolved",
      reason: "vue-instance-not-found",
      framework: null,
      element: elementSummary,
      primaryComponent: null,
      componentChain: [],
      styles: []
    };
  }

  function normalizeElement(value) {
    if (!value) {
      return null;
    }

    if (value.nodeType === 3 && value.parentNode) {
      return value.parentNode;
    }

    return value;
  }

  function findVue3Instance(start) {
    let current = start;
    while (current) {
      if (current.__vueParentComponent) {
        return current.__vueParentComponent;
      }

      if (current.__vnode) {
        const vnode = current.__vnode;
        if (vnode.component) {
          return vnode.component;
        }
        if (vnode.ctx && vnode.ctx.$) {
          return vnode.ctx.$;
        }
      }

      current = current.parentNode || current.host || null;
    }

    return null;
  }

  function findVue2Vm(start) {
    let current = start;
    while (current) {
      if (current.__vue__) {
        return current.__vue__;
      }
      current = current.parentNode || current.host || null;
    }
    return null;
  }

  function buildVue3Payload(instance, element) {
    const chain = [];
    const seen = new Set();
    let current = instance;

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(describeVue3Instance(current));
      current = current.parent || null;
    }

    return finalizePayload({
      framework: "vue3",
      chain,
      element
    });
  }

  function buildVue2Payload(vm, element) {
    const chain = [];
    const seen = new Set();
    let current = vm;

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(describeVue2Instance(current));
      current = current.$parent || null;
    }

    return finalizePayload({
      framework: "vue2",
      chain,
      element
    });
  }

  function finalizePayload(input) {
    const chain = input.chain.filter(Boolean);
    const primaryComponent =
      chain.find((entry) => entry.file) ||
      chain[0] ||
      null;

    return {
      status: primaryComponent ? "resolved" : "unresolved",
      reason: primaryComponent ? null : "component-found-without-file-metadata",
      framework: input.framework,
      element: summarizeElement(input.element),
      primaryComponent,
      componentChain: chain,
      styles: []
    };
  }

  function collectMatchedStyleFiles(doc, element) {
    if (
      !doc ||
      !element ||
      typeof doc.styleSheets === "undefined" ||
      typeof element.matches !== "function"
    ) {
      return [];
    }

    const candidates = [];
    const push = (value) => {
      if (typeof value === "string" && value.trim()) {
        candidates.push(value.trim());
      }
    };

    if (doc.styleSheets && typeof doc.styleSheets.length === "number") {
      for (const sheet of Array.from(doc.styleSheets)) {
        try {
          if (sheetHasMatchingRule(sheet, element)) {
            push(sheet.href || "");
            const ownerNode = sheet.ownerNode || null;
            if (ownerNode && typeof ownerNode.getAttribute === "function") {
              push(ownerNode.getAttribute("data-vite-dev-id"));
              push(ownerNode.getAttribute("href"));
            }
          }
        } catch (_error) {
          // Ignore cross-origin stylesheet access errors.
        }
      }
    }

    return resolveStyleEntries(candidates);
  }

  function sheetHasMatchingRule(sheet, element) {
    return rulesContainMatch(sheet && sheet.cssRules ? sheet.cssRules : [], element);
  }

  function rulesContainMatch(rules, element) {
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.STYLE_RULE) {
        if (selectorMatchesElement(rule.selectorText, element)) {
          return true;
        }
        continue;
      }

      if (rule.cssRules && rulesContainMatch(rule.cssRules, element)) {
        return true;
      }
    }

    return false;
  }

  function selectorMatchesElement(selectorText, element) {
    if (!selectorText) {
      return false;
    }

    try {
      return element.matches(selectorText);
    } catch (_error) {
      return false;
    }
  }

  function resolveStyleEntries(candidates) {
    const resolved = [];
    const seen = new Set();

    for (const candidate of candidates) {
      const fileInfo = buildStyleFileInfo(candidate);
      if (!fileInfo) {
        continue;
      }

      if (!fileInfo.file || !fileInfo.file.startsWith("/src/")) {
        continue;
      }

      const key = fileInfo.absoluteFile || fileInfo.file;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      resolved.push({
        path: fileInfo.file,
        absolutePath: fileInfo.absoluteFile
      });
    }

    resolved.sort((left, right) => left.path.localeCompare(right.path));
    return resolved;
  }

  async function collectComponentStyleImports(sourcePath) {
    if (!sourcePath || typeof sourcePath !== "string" || !sourcePath.startsWith("/src/")) {
      return [];
    }

    if (componentStyleImportCache.has(sourcePath)) {
      return componentStyleImportCache.get(sourcePath);
    }

    const pending = (async () => {
      const visited = new Set([sourcePath]);
      const sourceText = await fetchSourceText(sourcePath);
      if (!sourceText) {
        return [];
      }

      const directEntries = extractStyleImportsFromSource(sourceText, sourcePath);
      return expandStyleEntries(directEntries, visited);
    })();

    componentStyleImportCache.set(sourcePath, pending);
    return pending;
  }

  function extractStyleImportsFromSource(sourceText, sourcePath) {
    if (!sourceText || !sourcePath) {
      return [];
    }

    const entries = [];
    const seen = new Set();
    const pushResolved = (rawSpecifier) => {
      const resolvedPath = resolveStyleImportPath(rawSpecifier, sourcePath);
      if (!resolvedPath || seen.has(resolvedPath)) {
        return;
      }

      seen.add(resolvedPath);
      entries.push({
        path: resolvedPath,
        absolutePath: null
      });
    };

    const styleImportPattern =
      /@(import|use|forward)\s+(?:url\()?["']([^"']+)["'](?:\))?/g;
    const jsImportPattern =
      /(?:^|\n)\s*import\s+(?:[^"'`]+\s+from\s+)?["']([^"']+)["']/g;

    const styleBlocks = sourcePath.endsWith(".vue")
      ? extractVueStyleBlocks(sourceText)
      : [];

    for (const blockContent of styleBlocks) {
      let importMatch = null;
      while ((importMatch = styleImportPattern.exec(blockContent))) {
        pushResolved(importMatch[2]);
      }
      styleImportPattern.lastIndex = 0;
    }

    let jsImportMatch = null;
    while ((jsImportMatch = jsImportPattern.exec(sourceText))) {
      pushResolved(jsImportMatch[1]);
    }

    return entries;
  }

  function extractVueStyleBlocks(sourceText) {
    const blocks = [];
    const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch = null;

    while ((styleMatch = styleBlockPattern.exec(sourceText))) {
      blocks.push(styleMatch[1] || "");
    }

    return blocks;
  }

  async function expandStyleEntries(entries, visited) {
    const expanded = [];
    const seen = new Set();

    for (const entry of entries) {
      const key = entry.path;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      expanded.push(entry);

      if (visited.has(entry.path)) {
        continue;
      }

      visited.add(entry.path);
      const sourceText = await fetchSourceText(entry.path);
      if (!sourceText) {
        continue;
      }

      const nestedEntries = await expandStyleEntries(
        extractStyleImportsFromSource(sourceText, entry.path),
        visited
      );

      for (const nestedEntry of nestedEntries) {
        const nestedKey = nestedEntry.path;
        if (seen.has(nestedKey)) {
          continue;
        }
        seen.add(nestedKey);
        expanded.push(nestedEntry);
      }
    }

    return expanded;
  }

  async function fetchSourceText(sourcePath) {
    try {
      const response = await fetch(buildRawSourceUrl(sourcePath), {
        credentials: "same-origin"
      });
      if (!response.ok) {
        return "";
      }

      const moduleText = await response.text();
      return decodeRawModuleText(moduleText);
    } catch (_error) {
      return "";
    }
  }

  function buildRawSourceUrl(sourcePath) {
    return sourcePath.includes("?") ? sourcePath + "&raw" : sourcePath + "?raw";
  }

  function decodeRawModuleText(moduleText) {
    if (!moduleText || typeof moduleText !== "string") {
      return "";
    }

    const match = moduleText.match(/export\s+default\s+("(?:[^"\\]|\\.)*")\s*;?\s*$/s);
    if (!match) {
      return moduleText;
    }

    try {
      return JSON.parse(match[1]);
    } catch (_error) {
      return moduleText;
    }
  }

  function resolveStyleImportPath(specifier, sourcePath) {
    if (!specifier || typeof specifier !== "string") {
      return null;
    }

    let normalized = specifier.trim().replaceAll("\\", "/");
    if (!normalized) {
      return null;
    }

    const queryless = normalized.replace(/[?#].*$/, "");
    if (queryless.endsWith(".css") || queryless.endsWith(".scss") || queryless.endsWith(".sass")) {
      normalized = queryless;
    } else if (
      queryless.endsWith(".vue") &&
      /(?:\?|&)type=style/i.test(normalized) &&
      /lang\.(scss|sass|css)/i.test(normalized)
    ) {
      const langMatch = normalized.match(/lang\.(scss|sass|css)/i);
      if (langMatch) {
        normalized = queryless.replace(/\.vue$/i, "." + langMatch[1].toLowerCase());
      }
    }

    if (normalized.startsWith("@/")) {
      normalized = "/src/" + normalized.slice(2);
    } else if (normalized.startsWith("~/")) {
      normalized = "/src/" + normalized.slice(2);
    } else if (normalized.startsWith("./") || normalized.startsWith("../")) {
      const baseDirectory = sourcePath.slice(0, sourcePath.lastIndexOf("/"));
      normalized = resolveRelativePath(baseDirectory, normalized);
    }

    if (!/\.(scss|sass|css)$/i.test(normalized)) {
      normalized += ".scss";
    }

    if (!normalized.startsWith("/src/")) {
      return null;
    }

    return normalized;
  }

  function resolveRelativePath(baseDirectory, relativePath) {
    const baseParts = baseDirectory.split("/").filter(Boolean);
    const relativeParts = relativePath.split("/").filter(Boolean);

    for (const part of relativeParts) {
      if (part === ".") {
        continue;
      }
      if (part === "..") {
        baseParts.pop();
        continue;
      }
      baseParts.push(part);
    }

    return "/" + baseParts.join("/");
  }

  function buildStyleFileInfo(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    const normalized = value.trim().replaceAll("\\", "/");
    const basePath = normalized.replace(/[?#].*$/, "").toLowerCase();
    if (
      !basePath.endsWith(".scss") &&
      !basePath.endsWith(".sass") &&
      !basePath.endsWith(".css")
    ) {
      return null;
    }

    return buildFileInfo(value);
  }

  function describeVue3Instance(instance) {
    const type = instance && instance.type ? instance.type : {};
    const vnodeType =
      instance && instance.vnode && instance.vnode.type ? instance.vnode.type : {};
    const fileInfo = buildFileInfo(type.__file || vnodeType.__file || null);
    const file = fileInfo.file;
    const name =
      normalizeName(
        type.name ||
          type.__name ||
          (instance.proxy &&
          instance.proxy.$options &&
          instance.proxy.$options.name
            ? instance.proxy.$options.name
            : null) ||
          inferNameFromFile(file)
      ) || "AnonymousComponent";

    return {
      uid: typeof instance.uid === "number" ? instance.uid : null,
      name,
      file,
      absoluteFile: fileInfo.absoluteFile
    };
  }

  function describeVue2Instance(vm) {
    const options = vm && vm.$options ? vm.$options : {};
    const fileInfo = buildFileInfo(options.__file || null);
    const file = fileInfo.file;
    const name =
      normalizeName(options.name || options._componentTag || inferNameFromFile(file)) ||
      "AnonymousComponent";

    return {
      uid: typeof vm._uid === "number" ? vm._uid : null,
      name,
      file,
      absoluteFile: fileInfo.absoluteFile
    };
  }

  function summarizeElement(element) {
    if (!element || typeof element !== "object") {
      return {
        selector: "unknown"
      };
    }

    const tagName = element.tagName ? String(element.tagName).toLowerCase() : "unknown";
    const id = element.id ? "#" + element.id : "";
    const classNames = extractClassNames(element);
    const classSuffix = classNames.length ? "." + classNames.join(".") : "";

    return {
      selector: tagName + id + classSuffix
    };
  }

  function extractClassNames(element) {
    if (!element) {
      return [];
    }

    if (Array.isArray(element.classList)) {
      return element.classList.filter(Boolean);
    }

    if (element.classList && typeof element.classList.length === "number") {
      return Array.from(element.classList).filter(Boolean);
    }

    if (typeof element.className === "string") {
      return element.className
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean);
    }

    return [];
  }

  function normalizeName(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  function inferNameFromFile(file) {
    if (!file) {
      return null;
    }

    const segments = file.split("/");
    const lastSegment = segments[segments.length - 1] || "";
    const withoutExtension = lastSegment.replace(/\.[^.]+$/, "");

    if (withoutExtension && withoutExtension !== "index") {
      return withoutExtension;
    }

    return segments.length > 1 ? segments[segments.length - 2] || null : withoutExtension;
  }

  function normalizeFilePath(value) {
    return buildFileInfo(value).file;
  }

  function buildFileInfo(value) {
    if (!value || typeof value !== "string") {
      return {
        file: null,
        absoluteFile: null
      };
    }

    let file = value.trim();
    if (!file) {
      return {
        file: null,
        absoluteFile: null
      };
    }

    file = file.replaceAll("\\", "/");
    file = file.replace(/^webpack(-internal)?:\/\//i, "/");

    if (file.startsWith("file://")) {
      try {
        const parsed = new URL(file);
        file = decodeURIComponent(parsed.pathname || file);
      } catch (_error) {
        file = file.slice("file://".length);
      }
    } else if (/^https?:\/\//i.test(file)) {
      try {
        const parsed = new URL(file);
        file = decodeURIComponent(parsed.pathname || file);
      } catch (_error) {
        // Keep the raw value when URL parsing fails.
      }
    }

    file = file.replace(/[?#].*$/, "");
    const absoluteFile = isLikelyAbsoluteFilePath(file) ? file : null;
    file = shortenToWorkspacePath(file);

    return {
      file: file || null,
      absoluteFile
    };
  }

  function shortenToWorkspacePath(value) {
    if (!value) {
      return value;
    }

    const markers = [
      "/src/",
      "/app/",
      "/apps/",
      "/packages/",
      "/pages/",
      "/views/",
      "/components/"
    ];

    for (const marker of markers) {
      const index = value.indexOf(marker);
      if (index >= 0) {
        return value.slice(index);
      }
    }

    const segments = value.split("/").filter(Boolean);
    if (segments.length > 3) {
      return "/" + segments.slice(-3).join("/");
    }

    if (value.startsWith("/")) {
      return value;
    }

    return "/" + value.replace(/^\.?\//, "");
  }

  function isLikelyAbsoluteFilePath(value) {
    if (!value) {
      return false;
    }

    if (/^[a-zA-Z]:\//.test(value)) {
      return true;
    }

    if (value.startsWith("/Users/") || value.startsWith("/home/") || value.startsWith("/var/")) {
      return true;
    }

    return false;
  }

  const api = {
    collectMatchedStyleFiles,
    collectComponentStyleImports,
    inspectFromElement,
    buildFileInfo,
    decodeRawModuleText,
    extractStyleImportsFromSource,
    normalizeFilePath,
    inferNameFromFile,
    resolveStyleEntries
  };

  globalScope.VueSourceInspectorResolver = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
