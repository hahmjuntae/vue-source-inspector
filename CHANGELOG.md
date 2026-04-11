# Changelog

## 1.0.0

- Finalized the core inspection workflow with layered `Nearest`, `Parent`, and `Page` source results in the DevTools panel.
- Added direct style surfacing for matched stylesheets plus Vue SFC style imports across CSS, SCSS, and Sass files.
- Added stable editor integration for VS Code, Cursor, IntelliJ IDEA, WebStorm, and Antigravity, including global inspect toggling with `Ctrl+Shift+X` / `Cmd+Shift+X`.
- Refined the on-page popup flow with click-to-lock behavior, auto-hide after lock, and panel selection handoff for longer inspection work.
- Prepared the repository for Chrome Web Store publication with a final store icon, privacy policy, listing copy, and release-ready documentation.
- Removed temporary local demo-app assets and broken placeholder store binaries from the tracked release surface.

## 0.1.5

- Added localized labels for the on-page source popup so it follows the panel language setting.
- Prepared Chrome Web Store submission materials including privacy policy, listing copy, screenshots, promo art, and a local Vue demo app for capturing store assets.
- Exposed page-injected tooltip fonts through manifest resources so the packaged extension matches the documented UI.

## 0.1.4

- Fixed Source tile editor launches to prefer the runtime absolute file path before falling back to inferred root reconstruction.
- Improved the panel debug output so the displayed open target matches the path actually used for editor deep links.

## 0.1.3

- Improved the on-page source popup with lock, close, theme-aware styling, and stronger editor-open fallback handling.
- Refined the `Source` and `Element` cards to show clearer layered component context in the DevTools panel.

## 0.1.2

- Fixed frequent DevTools panel disconnects by reconnecting the panel automatically after temporary background restarts.
- Added layered source results so `Nearest`, `Parent`, and `Page` component files are all visible and openable in the selected editor.
- Improved the inspector UI by polishing the Element card, stabilizing source badges across language modes, and restoring the Styles list layout.

## 0.1.1

- Added `WebStorm` to the editor picker and open-in-editor protocol support.
- Fixed Vue source resolution so active tab view files are preferred over layout shell files like `fb-layout-tab-page.vue`.
- Fixed shell-route fallback selection so the inspector no longer prefers `main/index.vue` when the hovered DOM belongs to the active page view.

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
