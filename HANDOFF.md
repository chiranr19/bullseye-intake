# HANDOFF — Bullseye Intake

**STATUS:** Phases 0, 1, 2 and 4 of `bullseye-master-brief.md` are complete, reviewed and committed on `main`. Phase 3 is half done: the public repo and GitHub Pages are live; the Apps Script backend is built but not yet deployed in a Google account.
**WHAT:** Static intake form (`index.html`, `assets/`), Apps Script backend (`apps-script/`), QR codes (`qr/`), docs (`docs/`, `README.md`, `DECISIONS.md`, `GOTCHAS.md`). Every page behavior in `docs/TESTING.md` passed in the desktop browser pane; nothing has run on a real phone or against a real backend yet.
**NEXT:** (1) deploy the backend in `chiranr19@gmail.com` for the pilot following `apps-script/DEPLOY.md`; (2) fill `APPS_SCRIPT_URL` and `FORM_SECRET` in `config.js` and set `MOCK_SUBMIT: false`, commit, push; (3) run rows 15–17 and the phone rows of `docs/TESTING.md`; (4) get the real `AUTH_TEXT` from Russell's paper form.

## Where things stand

| Piece | State |
|---|---|
| Form page | Done. 81 KB total. Verified at 375×812 in Chrome (desktop pane). |
| Backend `Code.gs` | Written and reviewed line by line against the Apps Script API; never executed. First `setup()` run is the real test. |
| `config.js` | Placeholders for `APPS_SCRIPT_URL`, `FORM_SECRET`, `AUTH_TEXT`; `MOCK_SUBMIT: true`. The page shows a "Test mode" badge until it is `false`. |
| QR codes | Generated for `https://chiranr19.github.io/bullseye-intake/?ref=…` and decode-verified. URL confirmed live on 2026-10-25. |
| Russell's guide | Links point at the live URL. |
| Git | `origin` = `https://github.com/chiranr19/bullseye-intake` (public). Pages serves `main` root with HTTPS enforced. |

## Pilot plan (agreed in the first session, 2026-10-25)

The pilot backend lives in Chiran's Gmail (`chiranr19@gmail.com`): `NOTIFY_EMAIL` = that address,
`CC_EMAIL` empty. Later, repeat `DEPLOY.md` in Russell's account and change the two values in
`config.js`. Nothing else moves.

## Not verified yet (needs a phone or the backend)

- Contact autofill on iOS/Android (the whole point of the `autocomplete` attributes).
- Camera capture, EXIF rotation of a real portrait photo, HEIC handling (iOS should hand over JPEG).
- `sms:` links opening Messages with the body on both platforms; vCard behavior on iOS.
- Signature crispness on a 3× screen.
- Everything in `Code.gs`: Sheet formats (text columns + the apostrophe guard for `=`-leading
  cells), Drive folders, email with attachments, honeypot/too-fast rejection, Detroit time.

## Risks and open questions

- `Code.gs` writes with `appendRow` on columns formatted as plain text. The expectation is that
  phone numbers, ZIPs and long policy numbers stay text; confirm on the first real row.
- `FORM_SECRET` is visible in the page source by design (brief §7). It is spam friction, not security.
- The reviewer's remaining nits that were *not* applied: none. All seven SHOULDs and all nits were
  applied (see `DECISIONS.md`, last two lines).

## How to resume

```bash
python -m http.server 8080      # then open http://localhost:8080/?ref=flyer
```

Read `bullseye-master-brief.md` §8–§9 for the definition of done, `DECISIONS.md` for every choice
made, `GOTCHAS.md` for the three traps found so far.
