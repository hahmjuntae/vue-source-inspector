# Vue Source Inspector

Inspect Vue component source files and connected style files directly from Chrome DevTools.
This extension is designed for Vue projects running in a local development environment.

## Demo

![Demo](demo.gif)

## Features

- Find the nearest Vue source file for the hovered DOM element.
- Lock the current selection with a click and reset it with `Clear`.
- Show matched style files based on real stylesheet matches and Vue SFC style imports.
- Open source and style files in `VS Code`, `IntelliJ IDEA`, `Cursor`, or `Antigravity`.
- Toggle inspection from the panel or with `Ctrl+Shift+X` / `Cmd+Shift+X`.
- Support both Vue 2 and Vue 3 runtime heuristics.

## Installation

1. Open `chrome://extensions` in Chrome.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder you cloned from this repository or extracted from the release ZIP.

## Usage

1. Open a Vue application in Chrome.
2. Open DevTools and switch to the `VSI` tab.
3. Click `Inspect`.
4. Hover any rendered element to update the current result live.
5. Click once to lock the current selection.
6. Click a source or style path to open it in the selected editor.
7. Click `Clear` to reset the current selection.

## Shortcuts

- `Ctrl+Shift+X` / `Cmd+Shift+X`: toggle inspection mode
- `Esc`: exit active inspection mode

## Notes

- Best results come from Vue development builds.
- Some source or style files may not be available if the runtime does not expose enough metadata.
- The extension is intended for locally running development servers rather than production bundles.