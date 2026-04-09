const test = require("node:test");
const assert = require("node:assert/strict");
const resolver = require("../src/shared/vue-resolver.js");

test("normalizeFilePath strips query and URL origin noise", () => {
  assert.equal(
    resolver.normalizeFilePath("http://localhost:5173/src/views/home/index.vue?t=1711#foo"),
    "/src/views/home/index.vue"
  );
  assert.equal(
    resolver.normalizeFilePath("C:\\repo\\src\\App.vue?vue&type=script"),
    "/src/App.vue"
  );
  assert.equal(
    resolver.normalizeFilePath("/Users/hahmjuntae/workspace/my-app/src/components/Panel.vue"),
    "/src/components/Panel.vue"
  );
});

test("inspectFromElement resolves nearest Vue 3 component chain", () => {
  const rootComponent = {
    uid: 1,
    type: {
      name: "AppRoot",
      __file: "/Users/hahmjuntae/workspace/app/src/App.vue"
    },
    parent: null,
    vnode: {
      type: {
        __file: "/Users/hahmjuntae/workspace/app/src/App.vue"
      }
    }
  };

  const leafComponent = {
    uid: 2,
    type: {
      __name: "OrdersIndex",
      __file: "/Users/hahmjuntae/workspace/app/src/views/orders/index.vue?t=123"
    },
    parent: rootComponent,
    vnode: {
      type: {
        __file: "/Users/hahmjuntae/workspace/app/src/views/orders/index.vue?t=123"
      }
    }
  };

  const wrapper = {
    tagName: "SECTION",
    className: "orders-page",
    parentNode: null
  };
  const button = {
    tagName: "BUTTON",
    className: "cta",
    parentNode: wrapper,
    __vueParentComponent: leafComponent
  };

  const payload = resolver.inspectFromElement(button);

  assert.equal(payload.status, "resolved");
  assert.equal(payload.framework, "vue3");
  assert.equal(payload.primaryComponent.name, "OrdersIndex");
  assert.equal(payload.primaryComponent.file, "/src/views/orders/index.vue");
  assert.equal(
    payload.primaryComponent.absoluteFile,
    "/Users/hahmjuntae/workspace/app/src/views/orders/index.vue"
  );
  assert.deepEqual(
    payload.componentChain.map((entry) => entry.name),
    ["OrdersIndex", "AppRoot"]
  );
});

test("inspectFromElement resolves Vue 2 instances through __vue__", () => {
  const rootVm = {
    _uid: 10,
    $options: {
      name: "LegacyApp",
      __file: "/src/legacy/App.vue"
    },
    $parent: null
  };

  const childVm = {
    _uid: 11,
    $options: {
      name: "LegacyPanel",
      __file: "/src/legacy/panel/index.vue"
    },
    $parent: rootVm
  };

  const node = {
    tagName: "DIV",
    id: "panel",
    parentNode: null,
    __vue__: childVm
  };

  const payload = resolver.inspectFromElement(node);

  assert.equal(payload.status, "resolved");
  assert.equal(payload.framework, "vue2");
  assert.equal(payload.primaryComponent.file, "/src/legacy/panel/index.vue");
  assert.equal(payload.element.selector, "div#panel");
});

test("buildFileInfo keeps absolute local file paths for editor integration", () => {
  const fileInfo = resolver.buildFileInfo(
    "/Users/hahmjuntae/workspace/my-app/src/components/Panel.vue?t=123"
  );

  assert.equal(fileInfo.file, "/src/components/Panel.vue");
  assert.equal(
    fileInfo.absoluteFile,
    "/Users/hahmjuntae/workspace/my-app/src/components/Panel.vue"
  );
});

test("resolveStyleEntries keeps loaded project styles at /src paths", () => {
  const entries = resolver.resolveStyleEntries([
    "/Users/hahmjuntae/workspace/my-app/src/styles/reset.scss?t=1",
    "/Users/hahmjuntae/workspace/my-app/src/styles/reset.scss?t=2",
    "/Users/hahmjuntae/workspace/my-app/src/components/button/index.vue?vue&type=style&index=0&lang.scss",
    "https://cdn.example.com/library.css"
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.path),
    ["/src/styles/reset.scss"]
  );
});

test("extractStyleImportsFromSource resolves alias imports from vue style blocks", () => {
  const imports = resolver.extractStyleImportsFromSource(
    [
      "<template></template>",
      "<style lang=\"scss\" scoped>",
      "@import '@/styles/desktop/components/elements/fb-button.scss';",
      "@use '@/styles/base/mixins.scss';",
      "</style>"
    ].join("\n"),
    "/src/components/desktop/elements/fb-button.vue"
  );

  assert.deepEqual(
    imports.map((entry) => entry.path),
    [
      "/src/styles/desktop/components/elements/fb-button.scss",
      "/src/styles/base/mixins.scss"
    ]
  );
});

test("extractStyleImportsFromSource resolves compiled vue style imports", () => {
  const imports = resolver.extractStyleImportsFromSource(
    [
      "import { openBlock } from 'vue'",
      "import \"/src/styles/desktop/components/elements/fb-button.scss?vue&type=style&index=0&lang.scss\"",
      "import \"/src/styles/base/reset.scss\""
    ].join("\n"),
    "/src/components/desktop/elements/fb-button.vue"
  );

  assert.deepEqual(
    imports.map((entry) => entry.path),
    [
      "/src/styles/desktop/components/elements/fb-button.scss",
      "/src/styles/base/reset.scss"
    ]
  );
});

test("decodeRawModuleText unwraps vite raw module exports", () => {
  const text = resolver.decodeRawModuleText(
    'export default "<style lang=\\"scss\\">@import \\"@/styles/base/reset.scss\\";</style>";'
  );

  assert.equal(
    text,
    '<style lang="scss">@import "@/styles/base/reset.scss";</style>'
  );
});

test("inspectFromElement reports unresolved state when nothing is found", () => {
  const element = {
    tagName: "SPAN",
    className: "plain-text",
    parentNode: null
  };

  const payload = resolver.inspectFromElement(element);

  assert.equal(payload.status, "unresolved");
  assert.equal(payload.reason, "vue-instance-not-found");
  assert.equal(payload.componentChain.length, 0);
});
