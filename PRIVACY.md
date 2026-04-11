# Privacy Policy

Last updated: April 11, 2026

Vue Source Inspector does not collect, transmit, sell, or share personal data with any remote server.

## What the extension does

- Inspects Vue-rendered elements on pages you open in Chrome DevTools.
- Lets you toggle inspection directly on the current page with the extension action or keyboard shortcut.
- Reads component metadata that is already exposed by the target page's Vue runtime.
- Tries to open local source files in a desktop editor through editor URL handlers such as `vscode://`.
- Stores local extension preferences such as selected editor, inferred project root, theme, and language using Chrome local storage.

## What the extension does not do

- It does not send browsing data, source paths, or editor paths to any backend.
- It does not sync data to a cloud service.
- It does not use analytics, ads, or tracking scripts.
- It does not download and execute remote code.

## Data stored locally

The extension may store the following values in Chrome local storage:

- `vsiEditorKind`
- `vsiInferredProjectRoot`
- `vsiTheme`
- `vsiLanguage`

These values stay on your machine and are used only to improve the local DevTools workflow.

## Permissions usage

- `scripting`: injects the inspection bridge and content script into the current tab when inspection is enabled.
- `storage`: saves local extension preferences such as editor selection and UI settings.
- `http://*/*`, `https://*/*`: allows the extension to inspect Vue applications that are running on local or remote development pages you open in Chrome.

If the extension's data handling behavior changes in the future, this policy should be updated before publication.
