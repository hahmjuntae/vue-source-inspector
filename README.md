# Vue Source Inspector

Reveal Vue component source files and connected style files directly from Chrome DevTools.

## Demo

![Demo](demo.gif)

## Features

- Inspect the nearest Vue component source for the hovered DOM element.
- Lock the current selection with a click and clear it without leaving the panel.
- Show matching style files from real stylesheet matches plus Vue SFC style imports.
- Open source and style files in `VS Code`, `IntelliJ IDEA`, `Cursor`, or `Antigravity`.
- Toggle inspection from the panel or with `Ctrl+Shift+X` / `Cmd+Shift+X`.
- Support both Vue 2 (`__vue__`) and Vue 3 (`__vueParentComponent`, `__vnode`) heuristics.
- Keep a lightweight on-page tooltip visible even when DevTools is not the primary focus.

## Installation

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder:
   `/Users/hahmjuntae/Desktop/project/chrome-extensions/vue-inspector`

## Usage

1. Open a Vue application in Chrome.
2. Open DevTools and switch to the `Vue Source Inspector` tab.
3. Click `Inspect`.
4. Hover any rendered element to update the current result live.
5. Click once to lock the current selection.
6. Click a source or style path to open it in the selected editor.
7. Click `Clear` to reset the current result.

## License

This repository is currently marked as `UNLICENSED`.
