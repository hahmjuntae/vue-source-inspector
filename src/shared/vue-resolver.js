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
        nearestComponent: null,
        parentComponent: null,
        pageComponent: null,
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
      nearestComponent: null,
      parentComponent: null,
      pageComponent: null,
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
      if (current.__vnode) {
        const vnode = current.__vnode;
        if (vnode.component) {
          return vnode.component;
        }
        if (vnode.ctx && vnode.ctx.$) {
          return vnode.ctx.$;
        }
      }

      if (current.__vueParentComponent) {
        return current.__vueParentComponent;
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
    const resolvedInstance = findMostSpecificVue3Instance(instance, element) || instance;
    const chain = [];
    const seen = new Set();
    let current = resolvedInstance;

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(describeVue3Instance(current));
      current = current.parent || null;
    }

    return finalizePayload({
      framework: "vue3",
      chain,
      element,
      routeComponent: deriveVue3RouteComponent(resolvedInstance)
    });
  }

  function findMostSpecificVue3Instance(instance, element) {
    if (!instance || !element) {
      return instance;
    }

    return findMostSpecificVue3InstanceInTree(instance, element, new Set()) || instance;
  }

  function findMostSpecificVue3InstanceInTree(instance, element, seen) {
    if (!instance || seen.has(instance)) {
      return null;
    }

    seen.add(instance);
    const childInstances = collectVue3ChildInstances(instance);

    for (const childInstance of childInstances) {
      if (!vue3InstanceContainsElement(childInstance, element)) {
        continue;
      }

      const nestedMatch = findMostSpecificVue3InstanceInTree(childInstance, element, seen);
      return nestedMatch || childInstance;
    }

    return instance;
  }

  function collectVue3ChildInstances(instance) {
    const result = [];
    const seen = new Set();

    collectVue3ChildInstancesFromVNode(instance && instance.subTree ? instance.subTree : null, result, seen);

    return result;
  }

  function collectVue3ChildInstancesFromVNode(vnode, result, seen) {
    if (!vnode || typeof vnode !== "object") {
      return;
    }

    if (vnode.component && !seen.has(vnode.component)) {
      seen.add(vnode.component);
      result.push(vnode.component);
    }

    if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        collectVue3ChildInstancesFromVNode(child, result, seen);
      }
    }

    if (Array.isArray(vnode.dynamicChildren)) {
      for (const child of vnode.dynamicChildren) {
        collectVue3ChildInstancesFromVNode(child, result, seen);
      }
    }

    if (vnode.suspense) {
      collectVue3ChildInstancesFromVNode(vnode.suspense.activeBranch, result, seen);
      collectVue3ChildInstancesFromVNode(vnode.suspense.pendingBranch, result, seen);
    }

    collectVue3ChildInstancesFromVNode(vnode.ssContent, result, seen);
    collectVue3ChildInstancesFromVNode(vnode.ssFallback, result, seen);
    collectVue3ChildInstancesFromVNode(vnode.branch, result, seen);
  }

  function vue3InstanceContainsElement(instance, element, seen) {
    if (!instance || !element) {
      return false;
    }

    const visited = seen || new Set();
    if (visited.has(instance)) {
      return false;
    }

    visited.add(instance);
    return (
      vnodeContainsElement(instance.subTree, element, visited) ||
      vnodeContainsElement(instance.vnode, element, visited)
    );
  }

  function vnodeContainsElement(vnode, element, seen) {
    if (!vnode || !element || typeof vnode !== "object") {
      return false;
    }

    if (nodeContainsElement(vnode.el, element)) {
      return true;
    }

    if (nodeRangeContainsElement(vnode.el, vnode.anchor, element)) {
      return true;
    }

    if (vnode.component) {
      if (vue3InstanceContainsElement(vnode.component, element, seen)) {
        return true;
      }
    }

    if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        if (vnodeContainsElement(child, element, seen)) {
          return true;
        }
      }
    }

    if (Array.isArray(vnode.dynamicChildren)) {
      for (const child of vnode.dynamicChildren) {
        if (vnodeContainsElement(child, element, seen)) {
          return true;
        }
      }
    }

    if (vnode.suspense) {
      if (
        vnodeContainsElement(vnode.suspense.activeBranch, element, seen) ||
        vnodeContainsElement(vnode.suspense.pendingBranch, element, seen)
      ) {
        return true;
      }
    }

    return (
      vnodeContainsElement(vnode.ssContent, element, seen) ||
      vnodeContainsElement(vnode.ssFallback, element, seen) ||
      vnodeContainsElement(vnode.branch, element, seen)
    );
  }

  function nodeContainsElement(node, element) {
    if (!node || !element) {
      return false;
    }

    if (node === element) {
      return true;
    }

    return typeof node.contains === "function" ? node.contains(element) : false;
  }

  function nodeRangeContainsElement(startNode, endNode, element) {
    if (!startNode || !endNode || !element) {
      return false;
    }

    if (startNode === element || endNode === element) {
      return true;
    }

    if (nodeContainsElement(startNode, element) || nodeContainsElement(endNode, element)) {
      return true;
    }

    if (
      typeof startNode.compareDocumentPosition !== "function" ||
      typeof endNode.compareDocumentPosition !== "function"
    ) {
      return false;
    }

    const startPosition = startNode.compareDocumentPosition(element);
    const endPosition = endNode.compareDocumentPosition(element);
    const followsStart = Boolean(startPosition & 4) || Boolean(startPosition & 16);
    const precedesEnd = Boolean(endPosition & 2) || Boolean(endPosition & 8);

    return followsStart && precedesEnd;
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
      element,
      routeComponent: deriveVue2RouteComponent(vm)
    });
  }

  function finalizePayload(input) {
    const chain = input.chain.filter(Boolean);
    const nearestComponent = chooseNearestComponent(chain);
    const pageComponent = choosePageComponent(chain, input.routeComponent);
    const parentComponent = chooseParentComponent(chain, nearestComponent, pageComponent);
    const primaryComponent =
      nearestComponent ||
      pageComponent ||
      parentComponent ||
      chain.find((entry) => entry && entry.file) ||
      chain[0] ||
      null;

    return {
      status: primaryComponent ? "resolved" : "unresolved",
      reason: primaryComponent ? null : "component-found-without-file-metadata",
      framework: input.framework,
      element: summarizeElement(input.element),
      primaryComponent,
      nearestComponent,
      parentComponent,
      pageComponent,
      componentChain: chain,
      styles: []
    };
  }

  function chooseNearestComponent(chain) {
    if (!Array.isArray(chain) || !chain.length) {
      return null;
    }

    const candidatesWithFile = chain.filter((entry) => entry && entry.file);
    if (!candidatesWithFile.length) {
      return chain[0] || null;
    }

    const nearest = candidatesWithFile[0];
    return isWrapperLikeComponent(nearest)
      ? candidatesWithFile.find((entry) => !isWrapperLikeComponent(entry)) || nearest
      : nearest;
  }

  function chooseParentComponent(chain, nearestComponent, pageComponent) {
    if (!Array.isArray(chain) || !chain.length || !nearestComponent) {
      return null;
    }

    const nearestKey = getComponentKey(nearestComponent);
    const pageKey = getComponentKey(pageComponent);
    let passedNearest = false;

    for (const entry of chain) {
      if (!entry || !entry.file) {
        continue;
      }

      const key = getComponentKey(entry);
      if (!passedNearest) {
        if (key === nearestKey) {
          passedNearest = true;
        }
        continue;
      }

      if (key === nearestKey || key === pageKey) {
        continue;
      }

      if (isWrapperLikeComponent(entry) || isAppRootComponent(entry)) {
        continue;
      }

      return entry;
    }

    return null;
  }

  function choosePageComponent(chain, routeComponent) {
    if (routeComponent && routeComponent.file) {
      return routeComponent;
    }

    if (!Array.isArray(chain) || !chain.length) {
      return null;
    }

    return chain.find((entry) => entry && entry.file && isPageEntryFile(entry.file)) || null;
  }

  function getComponentKey(entry) {
    if (!entry || typeof entry !== "object") {
      return "";
    }

    return entry.absoluteFile || entry.file || entry.name || "";
  }

  function isPageEntryFile(file) {
    return typeof file === "string" && file.startsWith("/src/views/");
  }

  function isAppRootComponent(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const file = typeof entry.file === "string" ? entry.file : "";
    const name = normalizeComponentIdentity(entry.name);
    return file.endsWith("/src/App.vue") || name === "approot";
  }

  function isLayoutLikeComponent(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const file = typeof entry.file === "string" ? entry.file : "";
    const name = normalizeComponentIdentity(entry.name);

    if (
      file.endsWith("/middleware.vue") ||
      file.includes("/layouts/layout/") ||
      file.includes("/layouts/header/") ||
      file.includes("/layouts/lnb/") ||
      file.endsWith("/src/App.vue")
    ) {
      return true;
    }

    return [
      "layouttabpage",
      "layoutstandard",
      "pagetabcontent",
      "middleware",
      "approot"
    ].some((token) => name.includes(token));
  }

  function isWrapperLikeComponent(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const identity = [
      normalizeComponentIdentity(entry.name),
      normalizeComponentIdentity(entry.file)
    ]
      .filter(Boolean)
      .join(" ");

    if (!identity) {
      return false;
    }

    return [
      "suspense",
      "transition",
      "transitiongroup",
      "keepalive",
      "teleport",
      "routerview"
    ].some((token) => identity.includes(token));
  }

  function normalizeComponentIdentity(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function deriveVue3RouteComponent(instance) {
    const router = findVueRouterFromVue3Instance(instance);
    return deriveActiveTabRouteComponentFromVue3(instance, router) || deriveCurrentRouteComponent(router);
  }

  function deriveVue2RouteComponent(vm) {
    const router = vm && vm.$router ? vm.$router : null;
    return deriveActiveTabRouteComponentFromVue2(vm, router) || deriveCurrentRouteComponent(router);
  }

  function findVueRouterFromVue3Instance(instance) {
    let current = instance;

    while (current) {
      const proxyRouter =
        current.proxy && current.proxy.$router ? current.proxy.$router : null;
      if (proxyRouter) {
        return proxyRouter;
      }

      const globalRouter =
        current.appContext &&
        current.appContext.config &&
        current.appContext.config.globalProperties &&
        current.appContext.config.globalProperties.$router
          ? current.appContext.config.globalProperties.$router
          : null;
      if (globalRouter) {
        return globalRouter;
      }

      current = current.parent || null;
    }

    return null;
  }

  function deriveActiveTabRouteComponentFromVue3(instance, router) {
    let current = instance;

    while (current) {
      const routeName =
        findRouteNameFromSource(current.props) ||
        findRouteNameFromSource(current.setupState) ||
        findRouteNameFromSource(current.proxy);

      if (routeName) {
        const routeEntry = deriveNamedRouteComponentEntry(router, routeName);
        if (routeEntry) {
          return routeEntry;
        }
      }

      current = current.parent || null;
    }

    return null;
  }

  function deriveActiveTabRouteComponentFromVue2(vm, router) {
    let current = vm;

    while (current) {
      const routeName =
        findRouteNameFromSource(current.$props) ||
        findRouteNameFromSource(current._setupState) ||
        findRouteNameFromSource(current);

      if (routeName) {
        const routeEntry = deriveNamedRouteComponentEntry(router, routeName);
        if (routeEntry) {
          return routeEntry;
        }
      }

      current = current.$parent || null;
    }

    return null;
  }

  function findRouteNameFromSource(source) {
    if (!source || typeof source !== "object") {
      return null;
    }

    const tab = unwrapMaybeRef(source.tab);
    if (tab && typeof tab === "object" && tab.name) {
      return String(tab.name);
    }

    const activePageTab = unwrapMaybeRef(source.activePageTab);
    if (activePageTab && typeof activePageTab === "object" && activePageTab.name) {
      return String(activePageTab.name);
    }

    return (
      findActiveRouteNameInList(unwrapMaybeRef(source.pageTabList)) ||
      findActiveRouteNameInList(unwrapMaybeRef(source.nonOrderedTabList))
    );
  }

  function unwrapMaybeRef(value) {
    if (value && typeof value === "object" && value.__v_isRef) {
      return value.value;
    }

    return value;
  }

  function findActiveRouteNameInList(value) {
    if (!Array.isArray(value)) {
      return null;
    }

    const activeTab = value.find((entry) => entry && typeof entry === "object" && entry.active);
    return activeTab && activeTab.name ? String(activeTab.name) : null;
  }

  function deriveNamedRouteComponentEntry(router, routeName) {
    if (!router || typeof router.getRoutes !== "function" || !routeName) {
      return null;
    }

    const route = router.getRoutes().find((entry) => String(entry.name || "") === String(routeName));
    return route ? deriveRouteComponentEntry(route) : null;
  }

  function deriveCurrentRouteComponent(router) {
    return deriveRouteComponentEntry(readCurrentRoute(router));
  }

  function deriveRouteComponentEntry(route) {
    if (!route) {
      return null;
    }

    const metaComponent = route && route.meta ? route.meta.component : null;
    const loader = metaComponent && typeof metaComponent.index === "function"
      ? metaComponent.index
      : null;
    const file = extractVueFileFromLoader(loader);

    if (!file) {
      return null;
    }

    return {
      uid: null,
      name:
        normalizeName(route && route.name ? String(route.name) : "") ||
        inferNameFromFile(file) ||
        "RouteComponent",
      file,
      absoluteFile: null
    };
  }

  function readCurrentRoute(router) {
    if (!router) {
      return null;
    }

    if (router.currentRoute && router.currentRoute.value) {
      return router.currentRoute.value;
    }

    if (router.history && router.history.current) {
      return router.history.current;
    }

    return null;
  }

  function extractVueFileFromLoader(loader) {
    if (typeof loader !== "function") {
      return null;
    }

    const source = Function.prototype.toString.call(loader);
    const matches = Array.from(source.matchAll(/["'`]([^"'`]+\.vue(?:\?[^"'`]*)?)["'`]/g));
    if (!matches.length) {
      return null;
    }

    const paths = matches
      .map((match) => normalizeRouteLoaderPath(match[1]))
      .filter(Boolean);

    if (!paths.length) {
      return null;
    }

    return paths.find((path) => path.startsWith("/src/views/")) || paths[0];
  }

  function normalizeRouteLoaderPath(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    let normalized = value.trim().replaceAll("\\", "/").replace(/[?#].*$/, "");
    if (!normalized) {
      return null;
    }

    if (normalized.includes("/src/")) {
      return normalized.slice(normalized.indexOf("/src/"));
    }

    normalized = normalized.replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
    if (normalized.startsWith("src/")) {
      return "/" + normalized;
    }

    if (normalized.startsWith("views/") || normalized.startsWith("components/")) {
      return "/src/" + normalized;
    }

    return buildFileInfo(normalized).file;
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
      const resolvedPaths = resolveStyleImportPaths(rawSpecifier, sourcePath);
      for (const resolvedPath of resolvedPaths) {
        if (!resolvedPath || seen.has(resolvedPath)) {
          continue;
        }

        seen.add(resolvedPath);
        entries.push({
          path: resolvedPath,
          absolutePath: null
        });
      }
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

  function resolveStyleImportPaths(specifier, sourcePath) {
    if (!specifier || typeof specifier !== "string") {
      return [];
    }

    let normalized = specifier.trim().replaceAll("\\", "/");
    if (!normalized) {
      return [];
    }

    const queryless = normalized.replace(/[?#].*$/, "");
    let hasExplicitExtension = false;
    if (queryless.endsWith(".css") || queryless.endsWith(".scss") || queryless.endsWith(".sass")) {
      normalized = queryless;
      hasExplicitExtension = true;
    } else if (
      queryless.endsWith(".vue") &&
      /(?:\?|&)type=style/i.test(normalized) &&
      /lang\.(scss|sass|css)/i.test(normalized)
    ) {
      const langMatch = normalized.match(/lang\.(scss|sass|css)/i);
      if (langMatch) {
        normalized = queryless.replace(/\.vue$/i, "." + langMatch[1].toLowerCase());
        hasExplicitExtension = true;
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

    if (!normalized.startsWith("/src/")) {
      return [];
    }

    if (hasExplicitExtension || /\.(scss|sass|css)$/i.test(normalized)) {
      return [normalized];
    }

    return [normalized + ".scss", normalized + ".sass", normalized + ".css"];
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

    const normalized = normalizeStyleModulePath(value.trim().replaceAll("\\", "/"));
    const basePath = normalized.replace(/[?#].*$/, "").toLowerCase();
    if (
      !basePath.endsWith(".scss") &&
      !basePath.endsWith(".sass") &&
      !basePath.endsWith(".css")
    ) {
      return null;
    }

    return buildFileInfo(normalized);
  }

  function normalizeStyleModulePath(value) {
    const queryless = value.replace(/[?#].*$/, "");
    if (!queryless.endsWith(".vue") || !/(?:\?|&)type=style/i.test(value)) {
      return value;
    }

    const langMatch = value.match(/(?:\?|&)lang\.([a-z0-9_-]+)/i);
    const extension = langMatch ? langMatch[1].toLowerCase() : "css";
    if (!/^(css|scss|sass)$/.test(extension)) {
      return value;
    }

    return queryless.replace(/\.vue$/i, "." + extension);
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
        selector: "unknown",
        id: "",
        className: ""
      };
    }

    const tagName = element.tagName ? String(element.tagName).toLowerCase() : "unknown";
    const idValue = element.id ? String(element.id).trim() : "";
    const id = idValue ? "#" + idValue : "";
    const classNames = extractClassNames(element);
    const classSuffix = classNames.length ? "." + classNames.join(".") : "";

    return {
      selector: tagName + id + classSuffix,
      tagName,
      id: idValue,
      className: classNames.join(" ")
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
