# Gotchas (this repo)

Surprises that cost time here. One `##` line per symptom, phrased as what you would search for.

## "hidden" element still shows — HTML `hidden` attribute ignored on `.banner`, `.thumbs`, anything with a `display:` rule  (2026-10-25)
- **Context:** The "We saved what you typed earlier" banner showed on a fresh load with no draft.
- **Cause:** The `hidden` attribute is only a browser default style (`display: none`). Any author rule that sets `display` on the same element (`.banner { display: flex }`) wins over it.
- **Fix:** `assets/style.css` starts with `[hidden] { display: none !important; }`. Keep it. Toggle visibility with the `hidden` property in JS, never by adding display rules.
- **Scope:** this repo (and every static site without a reset).

## Apps Script `setup()` fails with "coordinates or dimensions of the range are invalid" on a new Sheet  (2026-10-25)
- **Context:** A fresh Google Sheet has 26 columns (A–Z). The header row has 27.
- **Cause:** `getRange(1, 1, 1, 27)` on a 26-column sheet throws.
- **Fix:** `setup()` inserts the missing columns before writing headers. If you add a 28th column, nothing else to do.
- **Scope:** this repo.

## Editing Code.gs changes nothing live  (2026-10-25)
- **Context:** You changed the backend, redeployed nothing, and the form still behaves the old way.
- **Cause:** A web app deployment pins a version. Saving code does not publish it.
- **Fix:** Deploy → Manage deployments → pencil → Version: New version → Deploy. Same URL.
- **Scope:** every Apps Script web app.
