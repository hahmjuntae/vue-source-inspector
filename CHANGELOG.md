# Changelog

## 0.1.0

- Added a Chrome DevTools extension for inspecting Vue component source files from hovered DOM nodes.
- Added live hover inspection with click-to-lock selection and an inline on-page source popup.
- Added `Source`, `Element`, and `Styles` sections to surface component files, DOM selectors, and connected styles.
- Added style resolution for matched stylesheets, Vue SFC `<style>` blocks, and `@import`, `@use`, `@forward` chains.
- Added editor integration for `VS Code`, `IntelliJ IDEA`, `Cursor`, and `Antigravity`.
- Added a persisted editor menu, light/dark theme toggle, language toggle, and clear-selection workflow.
- Added keyboard support for toggling inspection with `Ctrl+Shift+X` / `Cmd+Shift+X`.
- Added packaging assets, privacy notes, and Chrome Web Store submission documentation.
- Fixed stale content-script injection, duplicated absolute editor paths, and disconnected DevTools port errors.
- Fixed hover contrast issues, responsive panel layout regressions, and inline editor-menu rendering bugs.
