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

## Apps Script `getRange('A2:A').setNumberFormat(...)` applied nothing — first live row stored ZIP as a number, Submitted unformatted  (2026-10-25)
- **Context:** `setup()` ran clean, the Status dropdown and row colors were there, but row 2 had ZIP `48503` right-aligned (a number) and Submitted showing a raw `10/25/2026 22:05:32`. Even empty rows had no format.
- **Cause:** The open-ended A1 ranges (`'A2:A'`, `'B2:V'`) with `setNumberFormat` silently did not take on the fresh sheet. Not fully explained; bounded ranges do work.
- **Fix:** `setup()` uses `getRange(row, col, numRows, numCols)` and logs `getNumberFormat()` read back from A3 and J3. `writeRow_` sets the formats on the exact row right before `setValues`, so the data is safe even if `setup()` was never re-run. Verified: ZIP `02134` and a 20-digit policy number stored as text.
- **Scope:** Apps Script + Sheets; check with the log line, not by eye.

## Sheets toolbar "123" menu shows "Automatic" checked for a cell whose format is `@`  (2026-10-25)
- **Context:** Checking cell formats in the Sheet UI after `setup()`; "Plain text" was never checked even when the API returned `@` for the same cell.
- **Cause:** UI quirk; the menu does not reflect formats set through the API.
- **Fix:** Judge by alignment (text is left-aligned, numbers right-aligned) or by the `Formats after setup` log line.
- **Scope:** Google Sheets web UI.
