# Document folders and navigation

The document library groups the signed-in user's documents into category → identifier → files. These are views over the existing document metadata, not independently stored directories. Just Document uses the General documents label. Deleted documents are excluded; categories with no remaining files disappear.

The desktop sidebar and mobile navigation share their expanded categories and current selection. Cards, breadcrumbs, and the back button use the same navigation state. If the current folder disappears after deletion, the view falls back to its category, or My Documents when the category is empty.

Folder actions are available from the ellipsis button, right-click, Shift+F10, or a touch long press. The menu stays inside the viewport, supports arrow keys, Home/End, Escape, Tab and outside dismissal, and returns focus to its trigger. Moving or scrolling cancels a pending long press.

- Copy links copies the approved documents' individual URLs, separated by newlines.
- Download files requests each approved document's existing download URL. Browsers may require permission for multiple downloads; this does not create a ZIP archive or a group share URL.
- Delete all documents names the selected folder and file count in a confirmation. Partial failures retain the failed items and display the result. Stale list requests cannot restore deleted items in the interface.

## Design sources

- [Figma, September 1](https://www.figma.com/design/p8QjkewBdCS8qv1J21OoxW/fly.ae?node-id=581-393)
- [Folder component](https://www.figma.com/design/p8QjkewBdCS8qv1J21OoxW/fly.ae?node-id=586-5250)
- [Original folder.svg](https://inventale.slack.com/archives/C0BPJUAMLF9/p1788259695714809), copied without modification to `apps/web/public/folder.svg` (204 × 152).
- [Original ic_24.zip](https://inventale.slack.com/archives/C0BPJUAMLF9/p1788259651705249), extracted to `apps/web/public/icons/`. The supplied `link-1.svg` contains the download icon. Icons use their original geometry through CSS masks.

Desktop cards use a 226 px grid and 12 px padding. Small screens use two flexible columns and 44 px action buttons, falling back to one column below 360 px.

## Validation

`npm run test:web` builds the frontend and runs both rendering checks and DOM interaction tests. The interaction tests mount the actual application with a simulated session and API; they never contact the live backend or mutate user files. They cover navigation, mobile menu selection, keyboard and touch actions, menu bounds, approved links/downloads, confirmation, partial deletion, and delayed refreshes.
