# HANDOFF — Bullseye Intake

**STATUS:** The pilot is live end to end (2026-10-25): page on GitHub Pages, backend in Chiran's Gmail, two live test submissions verified in the Sheet, Drive and email. What remains needs a real phone or Russell.
**WHAT:** Static intake form (`index.html`, `assets/`), Apps Script backend (`apps-script/`, live as deployment version 2), QR codes (`qr/`), docs (`docs/`, `README.md`, `DECISIONS.md`, `GOTCHAS.md`). `config.js` carries the live `/exec` URL and the secret; `MOCK_SUBMIT` is `false`.
**NEXT:** (1) delete the two test rows `BW-20261025-ZKX4` and `BW-20261025-CYGH` and their Drive folders, or set their Status to Cancelled; (2) run the phone rows of `docs/TESTING.md` on an iPhone and an Android; (3) replace `AUTH_TEXT` in `config.js` with the wording from Russell's paper form; (4) when Russell is ready, repeat `apps-script/DEPLOY.md` in his account and change the two `config.js` values.

## Where things stand

| Piece | State |
|---|---|
| Form page | Live at `https://chiranr19.github.io/bullseye-intake/`. Verified at 375×812 in the desktop pane; not yet on a real phone. |
| Backend | Script project "Bullseye Intake" bound to the Sheet "Bullseye Customers" in `chiranr19@gmail.com`. Deployment version 2. Script Properties `FORM_SECRET` and `NOTIFY_EMAIL` set; no CC. |
| Verified live | Health check; wrong secret, honeypot, too-fast and non-JSON requests rejected; two submissions produced the Sheet row, the Drive folder (`card-1.jpg`, `signature.png`, `details.txt`) and the email with the photo attached and working links; leading-zero ZIP and 20-digit policy number stored as text; `=`-leading text stays text; Submitted shows Detroit time. |
| QR codes | Point at the live URL. Decode-verified. |
| Git | `origin` = `https://github.com/chiranr19/bullseye-intake` (public). Pages builds `main` root, HTTPS enforced. |

## Found during the live test

`setup()` formatted the columns with open-ended ranges (`'A2:A'`, `'B2:V'`) and those formats silently
never applied, so the first row stored ZIP `48503` as a number. Fixed by formatting each row right
before writing it (`writeRow_`) and by using bounded ranges in `setup()`, which now logs the formats
it reads back. Published as version 2 and re-tested. Details in `GOTCHAS.md`.

## Not verified yet (needs a phone)

- Contact autofill on iOS/Android; camera capture; EXIF rotation of a real portrait photo; HEIC.
- `sms:` links opening Messages with the body; vCard behavior on iOS; signature crispness at 3×.

## Risks and notes

- `FORM_SECRET` is visible in the page source by design (brief §7). It is spam friction, not security.
- A phone may keep the old `config.js` for up to 10 minutes after a push (`Cache-Control: max-age=600`).
- A consumer Gmail account sends at most 100 emails per day through Apps Script.
- Any change to `apps-script/Code.gs` must be pasted into the script project and published as a new
  deployment version (same URL). Saving alone changes nothing live.

## How to resume

Read `bullseye-master-brief.md` §8–§9 for the definition of done, `DECISIONS.md` for every choice
made, `GOTCHAS.md` for the traps. Local run: `python -m http.server 8080`.
