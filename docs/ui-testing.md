# Browser UI tests

The browser layer uses Playwright Test on top of the existing `node:test` and `jsdom` checks. It runs the real local frontend in Chromium in two projects:

- `desktop-chromium`: 1440 × 900;
- `mobile-chromium`: 390 × 844 with touch and mobile viewport behavior.

The API is mocked inside each browser context, so the tests do not need the backend, real accounts, S3, or production. The frontend and its CSS are real. The current UI scenarios live under `apps/web/tests/ui/`.

Install the browser once after `npm ci`:

```bash
npm exec --workspace @fly-ae/web -- playwright install chromium
```

Run the checks from the repository root:

```bash
npm run test:ui
npm run test:ui:desktop
npm run test:ui:mobile
npm run test:ui:screenshots
npm run test:ui:report
```

Every failing test gets a viewport PNG and a retained Playwright trace. The `test:ui:screenshots` command additionally writes named full-page checkpoints after successful states. Results are in `artifacts/ui/results/`; the HTML report is in `artifacts/ui/report/index.html`. The generated directory is ignored by git and is replaced by the next run.

To add a scenario, install the API mock before `page.goto`, use role/label locators, assert the visible state, and call `captureCheckpoint(page, test.info(), "descriptive-name")` after the assertion. Checkpoints are enabled only when `UI_SCREENSHOTS=1`; failure screenshots are always enabled by the Playwright configuration.

The mobile project emulates a small Chromium viewport. It does not certify Safari/iOS or a physical device. UI-006 verifies that folder actions are visible, clickable, and remain inside the viewport in both projects.
