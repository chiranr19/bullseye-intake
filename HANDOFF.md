# HANDOFF — Bullseye Intake

**STATUS:** The hardened form is fully live (2026-10-26): the page and backend version 3, verified end to end with one real submission and six refusal probes. What remains needs a phone, Russell, or Chiran.
**WHAT:** Static form on GitHub Pages plus the Apps Script backend in Chiran's Google account (pilot). `SECURITY.md` lists the protections; `tests/backend.test.js` proves the backend (18 tests); `docs/TESTING.md` records every check.
**NEXT:** (1) send Russell the first text in `docs/HANDOVER_MESSAGES.md`; (2) set up his own Google and GitHub accounts with him and move the backend and page there (`apps-script/DEPLOY.md`, README "Moving the page"), leaving a redirect at the current address; (3) put the wording from his paper form into `AUTH_TEXT`; (4) run the phone rows of `docs/TESTING.md`. Deferred by Chiran: deleting the three test rows, and two-step sign-in, since everything moves to Russell's accounts.

## Where things stand

| Piece | State |
|---|---|
| Form page | Live at `https://chiranr19.github.io/bullseye-intake/` with the security policy, white signature, VIN hint, draft expiry and resend ID. |
| Backend | Live as deployment version 3 at the same `/exec` address: flood guard, resend detection, file checks, customer-typed warning and broken links in the email, fuller `details.txt`. |
| Guide for Russell | Live at `/guide.html`, including the safety lines for version 3. |
| Test rows | `BW-20261025-ZKX4`, `BW-20261025-CYGH`, `BW-20261026-SENU`, each with a Drive folder. |
| Git | `origin` is `github.com/chiranr19/bullseye-intake` (public); Pages serves `main`, HTTPS enforced. Nothing unpushed. |

## Not verified yet (needs a phone)

- Contact autofill, camera capture, HEIC, `sms:` links, the vCard on iOS, signature crispness at 3x.

## Risks and notes

- `FORM_SECRET` is public by design; the flood guard (15 an hour, 40 a day) is the real limit.
- Any change to `Code.gs` must be pasted and published as a new version; run the tests first and
  compare the editor's copy with the repo file before publishing.
- A phone may keep the old `config.js` for up to 10 minutes after a push.
- Tool calls can turn escape sequences into real characters on the way to disk (machine GOTCHAS);
  the source-scan test catches it.
- The Claude in Chrome extension only reports in once Chrome is open with the side panel signed in.

## How to resume

Read `SECURITY.md`, `DECISIONS.md` (newest at the bottom) and `GOTCHAS.md`. Local run:
`python -m http.server 8080`. Tests: `node tests/backend.test.js`.
