const test = require("node:test");
const assert = require("node:assert/strict");
const editorLink = require("../src/shared/editor-link.js");

test("joinProjectPath combines root-style source paths with project root", () => {
  assert.equal(
    editorLink.joinProjectPath("/Users/hahmjuntae/workspace/app", "/src/views/home/index.vue"),
    "/Users/hahmjuntae/workspace/app/src/views/home/index.vue"
  );
});

test("buildEditorTarget creates VS Code protocol links", () => {
  const target = editorLink.buildEditorTarget({
    projectRoot: "/Users/hahmjuntae/workspace/app",
    filePath: "/src/views/home/index.vue",
    editorKind: "vscode"
  });

  assert.equal(target.ok, true);
  assert.equal(
    target.url,
    "vscode://file/Users/hahmjuntae/workspace/app/src/views/home/index.vue"
  );
});

test("buildEditorTarget creates Windows VS Code protocol links", () => {
  const target = editorLink.buildEditorTarget({
    projectRoot: "C:/workspace/app",
    filePath: "/src/views/home/index.vue",
    editorKind: "vscode"
  });

  assert.equal(target.ok, true);
  assert.equal(
    target.url,
    "vscode://file/C:/workspace/app/src/views/home/index.vue"
  );
});

test("buildEditorTarget creates IntelliJ links", () => {
  const target = editorLink.buildEditorTarget({
    projectRoot: "/Users/hahmjuntae/workspace/app",
    filePath: "/src/views/home/index.vue",
    editorKind: "intellij"
  });

  assert.equal(target.ok, true);
  assert.equal(
    target.url,
    "idea://open?file=%2FUsers%2Fhahmjuntae%2Fworkspace%2Fapp%2Fsrc%2Fviews%2Fhome%2Findex.vue"
  );
});

test("buildEditorTarget creates WebStorm links", () => {
  const target = editorLink.buildEditorTarget({
    projectRoot: "/Users/hahmjuntae/workspace/app",
    filePath: "/src/views/home/index.vue",
    editorKind: "webstorm"
  });

  assert.equal(target.ok, true);
  assert.equal(
    target.url,
    "webstorm://open?file=%2FUsers%2Fhahmjuntae%2Fworkspace%2Fapp%2Fsrc%2Fviews%2Fhome%2Findex.vue"
  );
});

test("buildEditorTarget validates missing project root", () => {
  const target = editorLink.buildEditorTarget({
    projectRoot: "",
    filePath: "/src/views/home/index.vue",
    editorKind: "vscode"
  });

  assert.equal(target.ok, false);
  assert.equal(target.reason, "project-root-required");
});

test("joinProjectPath does not prepend project root to an existing absolute path", () => {
  assert.equal(
    editorLink.joinProjectPath(
      "/Users/hahmjuntae/Desktop/project/babybonjuk-metacommerce-vue-admin",
      "/Users/hahmjuntae/Desktop/project/babybonjuk-metacommerce-vue-admin/src/components/desktop/elements/fb-button.scss"
    ),
    "/Users/hahmjuntae/Desktop/project/babybonjuk-metacommerce-vue-admin/src/components/desktop/elements/fb-button.scss"
  );
});
