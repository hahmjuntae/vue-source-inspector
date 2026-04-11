# Vue Source Inspector

Vue Source Inspector is a Chrome DevTools extension for local Vue development.
It maps hovered DOM back to Vue component files and related style files so you can move from rendered UI to source code without switching tools or manually tracing the component tree.

## Demo

![Demo](demo.gif)

## Features

- Layered source inspection with clickable `Nearest`, `Parent`, and `Page` entries.
- Related style discovery from matched stylesheets and Vue SFC style imports.
- Editor deep links for `VS Code`, `Cursor`, `IntelliJ IDEA`, `WebStorm`, and `Antigravity`.
- On-page popup preview with click-to-lock selection.
- Global inspect toggle with `Ctrl+Shift+X` on Windows/Linux and `Cmd+Shift+X` on macOS.
- Vue 2 and Vue 3 support through runtime heuristics.
- Local-only settings persistence for editor, theme, language, and inferred project root.

## Installation

Choose one of these installation flows:

### Option 1: Install directly from the repository

If you want to keep the unpacked extension up to date with `git pull`, load the repository root itself.

1. Clone this repository locally.
2. Open `chrome://extensions` in Chrome.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository root, the folder that contains `manifest.json`.

For example, if you cloned into `~/workspace/vue-source-inspector`, select that folder directly.
Do not select a parent folder that does not contain `manifest.json` at its root.

### Option 2: Install from Releases

Download the latest packaged extension from [Releases](https://github.com/hahmjuntae/vue-source-inspector/releases/latest), then unzip it locally.

1. Open `chrome://extensions` in Chrome.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder you extracted from the release ZIP.

## Updating a local clone

If you installed the extension from the repository root, you can update it with:

```bash
cd /path/to/vue-source-inspector
git pull
```

After pulling, open `chrome://extensions` and click `Reload` for this unpacked extension. Chrome does not reliably hot-reload changed unpacked extension files on its own.

## Usage

1. Open a Vue application in Chrome.
2. Start inspection from the `VSI` panel, or press `Ctrl+Shift+X` / `Cmd+Shift+X` directly on the page without opening DevTools first.
3. Hover any rendered element to preview the current source result in the on-page popup.
4. Click once to lock the current selection.
5. If DevTools is open, use the `Source` section to open the right component file and the `Styles` section to open matching stylesheet files.
6. Click `Clear` or press `Esc` to reset the selection.

## Shortcuts

- `Ctrl+Shift+X` / `Cmd+Shift+X`: toggle inspection mode on the current tab
- `Esc`: exit active inspection mode

## Notes

- Best results come from Vue development builds.
- The on-page popup and selection outline auto-hide a few seconds after lock so they do not block screenshots or continued page use.
- The keyboard shortcut can start page inspection without DevTools being open, but Chrome does not allow the extension to open the `VSI` DevTools panel automatically.
- Some source or style files may not be available if the runtime does not expose enough metadata.
- The extension is intended for locally running development servers rather than production bundles.
