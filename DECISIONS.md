# Decisions

Every choice made without asking, one line each. Newest at the bottom.
Dates are absolute. "Brief" means `bullseye-master-brief.md`.

- 2026-10-25 — The brief is the plan. No separate PLAN.md; its §8 build order and §9 checklist are the spec.
- 2026-10-25 — This folder (`windhsieldqr`) is the repo root. The GitHub repo is named `bullseye-intake`; the local folder name does not matter to GitHub Pages. The brief stays at the root as `bullseye-master-brief.md`.
- 2026-10-25 — Vendored `signature_pad` **5.1.4** (UMD minified build, MIT). Tarball sha512 checked against the npm registry before copying. License kept next to it as `vendor/signature_pad.LICENSE`.
- 2026-10-25 — `MOCK_SUBMIT` accepts `true | "fail" | false`. `"fail"` fakes a network error so the Retry and "Text Russell your info instead" paths can be tested without touching the backend.
- 2026-10-25 — Honeypot input is named `hp` in the DOM (the payload key is still `website`). A field literally named "website" is a strong autofill hint and could be filled by the phone's own contact autofill, which would reject a real customer.
- 2026-10-25 — Signature draft is stored as signature_pad point data (`toData()`), not PNG. Point data redraws correctly after a resize or on a different pixel ratio; PNG is exported only at submit time.
- 2026-10-25 — Photo compression tries 1600px @ 0.75, then 0.6, then one extra step at 1280px @ 0.6 if still over 300 KB. The brief stops at 0.6; the extra step keeps the budget on noisy photos.
- 2026-10-25 — Any sheet cell that starts with `=`, `+`, `-` or `@` is prefixed with an apostrophe before writing. Sheets would otherwise treat customer text as a formula.
- 2026-10-25 — `setup()` also sets the spreadsheet time zone to America/Detroit so the `Submitted` column renders in Detroit time regardless of the account's default.
- 2026-10-25 — QR codes use error-correction level Q and a 4-module quiet zone. The URL is short, so the extra redundancy costs nothing and survives a scuffed laminate on the truck.
- 2026-10-25 — `scripts/make_qr.py` takes `--base-url` as an argument rather than reading `config.js`; the site URL is not a page setting and parsing JS from Python is fragile. It does read `REF_SOURCES` from `config.js` to warn if the two lists drift.
- 2026-10-25 — Phases 1 and 2 were built and committed together. Stubbing photos/VIN/signature and then replacing the stubs would have been throwaway work.
- 2026-10-25 — The send button is never truly disabled. It looks dimmed (`aria-disabled`) until name, phone and signature are present, but tapping it always points at the first missing item. A dead button with no explanation is the brief's "dead end".
- 2026-10-25 — `<meta name="robots" content="noindex">`: a customer intake form has no business in search results.
- 2026-10-25 — The Sheet *tab* is named `Customers` (the spreadsheet file is "Bullseye Customers" per the brief). `setup()` renames the default empty tab or inserts one.
- 2026-10-25 — `appsscript.json` lists explicit `oauthScopes` (this spreadsheet only, Drive, send mail) so the one-time permission prompt asks for the minimum.
- 2026-10-25 — A 2xx reply whose body is non-empty but not JSON is treated as a failure, not a success. Only an empty/unreadable body counts as "sent" (brief §6). Otherwise an Apps Script HTML error page would show the customer "Sent!" with nothing saved.
- 2026-10-25 — Email failures are logged, not surfaced: the row and files are already saved, so the customer still gets "Sent!" and the real id. Russell can still see the row in the sheet.
- 2026-10-25 — Server caps: body ≤ 6 MB, each photo ≤ 1.5 MB decoded, signature ≤ 600 KB, only JPEG/PNG/WebP. The page sends ≤ 300 KB photos, so anything near the caps is not a customer.
- 2026-10-25 — `vin_source` is computed at send time by comparing the year/make/model fields with what NHTSA returned, instead of tracking edits. If they still match it is `decoded`; if anything is typed it is `manual`; else `none`.
- 2026-10-25 — Global CSS rule `[hidden] { display: none !important }`. Found in testing: `.banner { display: flex }` was overriding the HTML `hidden` attribute, so the "We saved what you typed" banner showed on first load.
- 2026-10-25 — The signature's timestamp (`signed_at`) is the moment of the last stroke, saved with the draft, not the moment of sending.
- 2026-10-25 — From an independent review, applied before any deploy: (1) the page waits until 3.5 s after load before sending, so a restored draft tapped quickly is not rejected as a bot; (2) `setup()` never deletes a column that has data and sets row colors only when the sheet has no rules yet; (3) the Drive root folder is looked up (and recreated if trashed) on every submission, not only in `setup()`; (4) each submission folder gets a `details.txt` with signed_at, terms version, device, load/submit times and source, so the audit trail does not depend on the email; (5) a "Test mode" badge shows whenever `MOCK_SUBMIT` is not `false`; (6) if signature_pad fails to load, the page says so and offers the SMS fallback; (7) Send waits for a photo that is still being shrunk.
- 2026-10-25 — Also from the review: bots are rejected before any base64 decoding; the script lock is released before the email is sent; single-line fields have newlines flattened server-side; a retry gets a 60 s timeout; the decoded year/make/model is saved with the draft so a restore does not re-query NHTSA or overwrite a correction; photo remove buttons are 48 px.
- 2026-10-25 — Pilot backend deployed in Chiran's Gmail: `NOTIFY_EMAIL` is that address, no `CC_EMAIL`. Russell's account comes later per the brief. The two live test rows were left in the sheet for Chiran to delete; deleting someone's data is not an unasked choice.
- 2026-10-25 — Rows are written by `writeRow_` (formats on the exact row, then the values) instead of `appendRow`, after the live test stored ZIP `48503` as a number. Only the 22 form columns are written; Russell's five columns keep whatever format he picks.
- 2026-10-25 — `setup()` logs the number formats it reads back from A3 and J3, so a formatting failure shows in the execution log instead of in a mangled policy number weeks later.
- 2026-10-25 — The Sheet, script and deployment IDs stay out of the public repo. `HANDOFF.md` names the objects; the IDs live in Chiran's Drive and local notes.
