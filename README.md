# Vue Source Inspector

Inspect Vue component source files and connected style files directly from Chrome DevTools.
This extension is designed for Vue projects running in a local development environment.

## Demo

![Demo](demo.gif)

## Features

- Show layered Vue source results with clickable `Nearest`, `Parent`, and `Page` entries.
- Lock the current on-page source popup with a click and close it with `Clear`, `Esc`, or the popup close button.
- Keep the DevTools panel connected across temporary extension background restarts.
- Show matched style files based on real stylesheet matches and Vue SFC style imports.
- Open source and style files in `VS Code`, `IntelliJ IDEA`, `WebStorm`, `Cursor`, or `Antigravity`.
- Toggle inspection from the panel or with `Ctrl+Shift+X` / `Cmd+Shift+X`.
- Support both Vue 2 and Vue 3 runtime heuristics.

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
2. Open DevTools and switch to the `VSI` tab.
3. Click `Inspect`.
4. Hover any rendered element to update the current result live and preview the on-page source popup.
5. Click once to lock the current selection and keep the on-page popup visible.
6. In the `Source` section, use the layered `Nearest`, `Parent`, and `Page` entries to open the right file in the selected editor.
7. Click a style path to open the matching stylesheet in the selected editor.
8. Click `Clear` or press `Esc` to reset the current selection.

## Shortcuts

- `Ctrl+Shift+X` / `Cmd+Shift+X`: toggle inspection mode
- `Esc`: exit active inspection mode

## Notes

- Best results come from Vue development builds.
- Some source or style files may not be available if the runtime does not expose enough metadata.
- The extension is intended for locally running development servers rather than production bundles.
