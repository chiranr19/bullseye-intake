# Test checklist

Kept current. "Desktop" means Chrome in the Claude desktop app's browser pane at 375×812 with
mobile emulation, served from `python -m http.server`. "Phone" means a real iPhone / Android.
Phone-only rows cannot be checked on a desktop at all (contact autofill, camera, Messages, vCard).

Legend: ✅ passed · ⬜ not yet run · ❌ failed (note why)

| # | Check | Desktop (2026-10-25) | iPhone | Android |
|---|---|---|---|---|
| 1 | iOS Safari: name field offers contact autofill; one tap fills name, phone, email, address, city, state, zip | n/a | ⬜ | n/a |
| 2 | Android Chrome: same | n/a | n/a | ⬜ |
| 3 | Phone formats live; pasting `+1 (810) 555-1234` yields 10 digits | ✅ | ⬜ | ⬜ |
| 4 | Submit with only name + phone + signature succeeds | ✅ (mock) | ⬜ | ⬜ |
| 5 | Submit with nothing shows "Add your name", scrolls there, no crash | ✅ (checked "Please sign above" path; name path same code) | ⬜ | ⬜ |
| 6 | Take photo opens camera directly; Choose from photos opens picker; screenshot accepted | ✅ picker path via injected file; camera needs a phone | ⬜ | ⬜ |
| 7 | 4 MB photo → < 300 KB; portrait photo not rotated; thumbnail + remove works; second photo works; third is refused politely | ✅ 12.2 MB → 226 KB; remove ✅; 2nd ✅; 3rd refused ✅. Rotation needs a real EXIF photo | ⬜ | ⬜ |
| 8 | VIN: lowercase → uppercase; I/O/Q rejected inline; `1HGCM82633A004352` decodes; wrong check digit shows the soft warning and still proceeds; airplane mode → manual fields appear, no error dialog | ✅ (airplane mode needs a phone) | ⬜ | ⬜ |
| 9 | Signature: draws smoothly, not blurry on a 3× screen; Clear works; empty signature blocks submit with "Please sign above" | ✅ at 2×; PNG exports with ink | ⬜ | ⬜ |
| 10 | Fill half the form, kill the tab, reopen → values restored with the banner | ✅ (signature restored too) | ⬜ | ⬜ |
| 11 | Successful submit clears the draft; reopening shows an empty form | ✅ | ⬜ | ⬜ |
| 12 | Bad `APPS_SCRIPT_URL` → "Couldn't send" + Retry; second failure shows "Text Russell your info instead" and the SMS body contains the typed fields | ✅ via `MOCK_SUBMIT: "fail"` | ⬜ | ⬜ |
| 13 | Thank-you: reference code shown; **Text Russell** opens Messages with the body on iOS and Android; **Save Russell's contact** opens/downloads the vCard, number still tappable either way | ✅ code + links built; opening Messages needs a phone | ⬜ | ⬜ |
| 14 | `?ref=flyer` lands in the Sheet's Source column; no `ref` → `direct` | ✅ Source column shows `flyer` and `truck` for the two live tests; `direct` verified in the payload | ⬜ | ⬜ |
| 15 | Honeypot filled → server rejects; submission 1 s after load → server rejects | ✅ curl against the live `/exec`: wrong secret, honeypot filled, 1 s submit and a non-JSON body all answer `{"ok":false}` with the generic message | | |
| 16 | Email arrives with correct subject, all fields, photo attached, Sheet and folder links work | ✅ `New repair: Test Customer (delete me) — 2003 Honda Accord — State Farm`, every field, `card-1.jpg` attached, sheet / folder / signature links open | | |
| 17 | Sheet: Status dropdown present, New rows yellow, phone not mangled, Submitted shows Detroit time | ✅ after the `writeRow_` fix (see below): dropdown, yellow New rows, phone `(810) 555-0123` as text, ZIP `02134` keeps its zero, a 20-digit policy number is intact, `=SUM(...)` note stays text, Submitted `Oct 25, 2026 10:16 PM` Detroit | | |
| 18 | Page served from GitHub Pages subpath with all relative links working; HTTPS enforced | ✅ live at `https://chiranr19.github.io/bullseye-intake/`; 8 referenced files byte-identical to the repo; `http://` → 301 to `https://`; `?ref=flyer` kept | | |

Also checked on desktop: page weight 81 KB (budget 150 KB); no console errors on load; no
third-party requests except the NHTSA decode; dark and light mode render; the fixed send bar never
covers the last field (body padding follows the bar's height); the "Test mode" badge shows while
`MOCK_SUBMIT` is not `false`.

After the independent review (2026-10-25), also checked: tapping Send right after a restored draft
loads waits until 3.5 s after load, then sends; tapping Send while a photo is still shrinking waits
for it and the photo is included; a restored draft with a decoded VIN shows "✓ 2003 Honda Accord"
without a second NHTSA call; Start over after a failed send resets the Retry state; a VIN that
fails to decode reveals the manual fields without moving focus.

## Live backend test (2026-10-25)

Two submissions from the Pages site in the desktop pane: `BW-20261025-ZKX4` (`?ref=flyer`, 3.2 MB
photo → 288 KB, VIN decoded, repair location "other") and `BW-20261025-CYGH` (`?ref=truck`,
leading-zero ZIP, 20-digit policy number, `=SUM(1,2)` note, no photo). Both rows and their Drive
folders are still there; delete them or set Status to Cancelled.

The first submission found a real bug: the number formats from `setup()` had never applied, so ZIP
`48503` was stored as a number and Submitted showed a raw date. Fixed in `Code.gs` (`writeRow_`
sets the formats on the row it writes, `setup()` uses bounded ranges and logs what it reads back),
published as deployment version 2, re-tested with the second submission.

## Hardening checks (2026-10-26)

Desktop pane at phone size, on the live site and on a local copy:

- **VIN:** lowercase is uppercased and decodes; I, O or Q is refused inline; a wrong check digit
  warns and still decodes; an unknown VIN or a failed lookup now shows "Couldn't look that up. Type
  the year, make and model below." and opens the car fields without moving focus.
- **Signature:** draws, Clear locks Send again, redraw unlocks it. The saved PNG now has a white
  background (it was transparent, so black ink vanished in dark viewers such as Drive's preview).
- **Photos:** a landscape-stored JPEG with an EXIF rotation comes out upright (480x640); a text file
  named `.jpg` is refused politely; compression still previews under the security policy.
- **Drafts:** never hold the signature; restored within 15 minutes on `?ref=russell` and gone after;
  a 20-minute-old draft on `?ref=flyer` restores; a send that finished inside the 0.3 s save delay
  used to bring the draft back, and no longer does.
- **Security policy:** no violations on load. On the live site the VIN lookup, a backend health
  check and a real POST all pass through it (the POST carried a wrong secret on purpose, so it was
  refused and no row was made).
- **QR as a texted photo:** `qr/russell.png` still decodes after shrinking to 180 px, JPEG quality
  25, blur and a 12-degree tilt.
- **Backend:** `node tests/backend.test.js` passes 18/18. Five deliberate breakages of `Code.gs`
  (no resend check, no link-breaking, trusting any file, no invisible-character stripping, no daily
  cap) each make at least one test fail.
- **Backend version 3 live (published 2026-10-26):** the editor's copy matched the repo file byte for
  byte (SHA-256) before publishing, and `setup()` asked for no new permissions. Six refusal probes
  (wrong secret, honeypot, a 1-second send, not JSON, a fake photo, a JPEG posing as the signature)
  were all refused with no row; the last two are new in version 3. One real send from the live page
  (`BW-20261026-SENU`) made one row, one folder and one email. Replaying the identical request
  returned the same reference with no second row or email. The email carried the customer-typed
  warning and showed the note's link as `http[://]example[.]com/pay`; a zero-width character typed
  into the note never reached it. `details.txt` had Google's receive time and the exact wording.

## How to run the phone rows

1. On the laptop, in the repo: `python -m http.server 8080`
2. Find the laptop's Wi-Fi IP (Windows: `ipconfig`, look for IPv4). On the phone, same Wi-Fi,
   open `http://<that-ip>:8080/`.
3. Work down the table. For row 8 "airplane mode", turn on airplane mode *after* the page loads,
   then type the VIN.
4. For rows 15–18 the backend must be deployed (`apps-script/DEPLOY.md`) and the page pushed.
