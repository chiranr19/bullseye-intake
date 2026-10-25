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
- 2026-10-25 — `scripts/make_qr.py` takes `--base-url` as an argument rather than reading `config.js`; the site URL is not a page setting and parsing JS from Python is fragile.
