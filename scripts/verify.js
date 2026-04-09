const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const filesToCheck = [
  "demo.gif",
  "CHANGELOG.md",
  "CHAGELOG.md",
  "manifest.json",
  "PRIVACY.md",
  "src/background.js",
  "src/assets/icons/icon-16.png",
  "src/assets/icons/icon-32.png",
  "src/assets/icons/icon-48.png",
  "src/assets/icons/icon-128.png",
  "src/content-script.js",
  "src/devtools/devtools.html",
  "src/devtools/devtools.js",
  "src/devtools/assets/editor-icons/antigravity.svg",
  "src/devtools/assets/editor-icons/cursor-dark.svg",
  "src/devtools/assets/editor-icons/cursor-light.svg",
  "src/devtools/assets/editor-icons/intellij.svg",
  "src/devtools/assets/editor-icons/vscode.svg",
  "src/devtools/assets/fonts/geist-mono/GeistMono-Variable.woff2",
  "src/devtools/assets/fonts/geist-sans/Geist-Variable.woff2",
  "src/devtools/panel.css",
  "src/devtools/panel.html",
  "src/devtools/panel.js",
  "src/page-bridge.js",
  "src/shared/editor-link.js",
  "src/shared/vue-resolver.js",
  "tests/editor-link.test.js",
  "tests/vue-resolver.test.js"
];

for (const relativePath of filesToCheck) {
  const absolutePath = path.join(rootDir, relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error("Missing required file: " + relativePath);
  }

  if (relativePath.endsWith(".js")) {
    const result = spawnSync(process.execPath, ["--check", absolutePath], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error("Syntax check failed for " + relativePath + "\n" + result.stderr);
    }
  }
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(rootDir, "manifest.json"), "utf8")
);

if (manifest.manifest_version !== 3) {
  throw new Error("manifest.json must target Manifest V3.");
}

if (!manifest.background || manifest.background.service_worker !== "src/background.js") {
  throw new Error("manifest.json must point to src/background.js as the service worker.");
}

if (manifest.devtools_page !== "src/devtools/devtools.html") {
  throw new Error("manifest.json must point to src/devtools/devtools.html as the DevTools page.");
}

if (!manifest.icons || !manifest.icons["128"]) {
  throw new Error("manifest.json must include extension icons for packaging.");
}

if (
  !Array.isArray(manifest.host_permissions) ||
  manifest.host_permissions.includes("<all_urls>")
) {
  throw new Error("manifest.json should avoid <all_urls> for this extension.");
}

console.log("Static verification passed.");
