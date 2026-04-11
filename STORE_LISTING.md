# Chrome Web Store Listing Copy

This file contains ready-to-paste text for the Chrome Web Store dashboard.

## Single purpose

Inspect Vue component source files and related style files directly from Chrome DevTools while developing locally.

## Store title

Vue Source Inspector

## Short description

Inspect Vue source files and related styles directly from Chrome DevTools.

## Detailed description

Vue Source Inspector helps frontend developers trace rendered Vue elements back to the files that produced them.

Use the `VSI` DevTools tab to inspect a page, hover any Vue-rendered element, and review layered source results:

- `Nearest`: the closest component that rendered the hovered DOM
- `Parent`: the next useful parent component
- `Page`: the current page entry file

The extension can also surface related style files and open source files in supported desktop editors such as VS Code, Cursor, IntelliJ IDEA, and WebStorm.

This extension is designed for Vue projects running in a local development environment. It works best when the target page exposes Vue runtime source metadata.

## Category

Developer Tools

## Language

English

## Suggested screenshots

Use the prepared assets in `store-assets/screenshots/`:

- `store-assets/screenshots/vsi-screenshot-01.png`
- `store-assets/screenshots/vsi-screenshot-02.png`
- `store-assets/screenshots/vsi-screenshot-03.png`

## Small promo image

Use:

- `store-assets/promo/small-promo-440x280.png`

## Icon

Use:

- `src/assets/icons/icon-128.png`

## Privacy policy URL

After pushing this repository publicly, use the public URL for `PRIVACY.md`.
Example:

- `https://github.com/<owner>/<repo>/blob/main/PRIVACY.md`

## Support URL

Suggested:

- repository README or GitHub issues page

## Permission explanations

### scripting

Used to inject the inspection bridge and content script into the currently inspected page when the user turns inspection on.

### storage

Used to save local preferences such as selected editor, inferred project root, theme, and language.

### host permissions

Used so the extension can inspect Vue pages the developer opens in Chrome DevTools, including localhost development servers and other development URLs.

## Privacy disclosures guidance

- Data sold: No
- Data transferred to third parties: No
- Data used for unrelated purposes: No
- Authentication required: No
- Remote code: No
