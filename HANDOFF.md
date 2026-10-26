# HANDOFF — Bullseye Intake

**STATUS:** The page hardening is live (2026-10-26). Backend version 3 (flood guard, resend detection, file checks, safer email, fuller audit record) is written, tested 18/18 and pushed to the repo, but not yet published in Apps Script: Chrome was not connected to the session.
**WHAT:** Static form on GitHub Pages plus the Apps Script backend in Chiran's Google account (pilot). `SECURITY.md` lists the protections; `tests/backend.test.js` proves the backend.
**NEXT:** (1) publish `Code.gs` as version 3 (paste, Save, run `setup()`, Deploy, Manage deployments, New version); (2) one live test submission, then push the held commit that adds the guide's new safety lines; (3) delete the test rows; (4) turn on two-step sign-in for GitHub and Google; (5) settle the page's permanent address before printing QR codes; (6) send Russell the text in `docs/HANDOVER_MESSAGES.md`.

## Where things stand

| Piece | State |
|---|---|
| Form page | Live at `https://chiranr19.github.io/bullseye-intake/` with the hardening: security policy, white signature, VIN hint, draft expiry, resend ID. Works with backend version 2 or 3. |
| Backend | Live: version 2. Repo: version 3, tested, waiting to be published. |
| Guide for Russell | The live guide predates version 3. A local commit adds the new safety lines; push it only after version 3 is published, because those lines describe version 3. |
| Test rows | `BW-20261025-ZKX4` and `BW-20261025-CYGH`, unless already deleted. |
| Git | `origin` is `github.com/chiranr19/bullseye-intake` (public); Pages serves `main`, HTTPS enforced. |

## Moving the page to an address named for the business

QR codes hold the address, so settle it before printing. README "Moving the page" has the steps and
the redirect to leave behind so nothing already shared breaks.

## Not verified yet (needs a phone)

- Contact autofill, camera capture, HEIC, `sms:` links, the vCard on iOS, signature crispness at 3x.
- Backend version 3 live (only tested with fakes so far).

## Risks and notes

- `FORM_SECRET` is public by design; the flood guard is the real limit once version 3 is live.
- Any change to `Code.gs` must be pasted and published as a new version; run the tests first.
- A phone may keep the old `config.js` for up to 10 minutes after a push.
- Tool calls can turn escape sequences into real characters on the way to disk (machine GOTCHAS);
  the source-scan test catches it.

## How to resume

Read `SECURITY.md`, `DECISIONS.md` (newest at the bottom) and `GOTCHAS.md`. Local run:
`python -m http.server 8080`. Tests: `node tests/backend.test.js`.
