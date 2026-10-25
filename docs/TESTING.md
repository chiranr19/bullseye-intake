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
| 14 | `?ref=flyer` lands in the Sheet's Source column; no `ref` → `direct` | ✅ page side (`flyer`, `text`, `direct` in payload); Sheet side needs the backend | ⬜ | ⬜ |
| 15 | Honeypot filled → server rejects; submission 1 s after load → server rejects | ⬜ needs the backend | | |
| 16 | Email arrives with correct subject, all fields, photo attached, Sheet and folder links work | ⬜ needs the backend | | |
| 17 | Sheet: Status dropdown present, New rows yellow, phone not mangled, Submitted shows Detroit time | ⬜ needs the backend | | |
| 18 | Page served from GitHub Pages subpath with all relative links working; HTTPS enforced | ⬜ needs the repo pushed | | |

Also checked on desktop: page weight 81 KB (budget 150 KB); no console errors on load; no
third-party requests except the NHTSA decode; dark and light mode render; the fixed send bar never
covers the last field (body padding follows the bar's height); the "Test mode" badge shows while
`MOCK_SUBMIT` is not `false`.

After the independent review (2026-10-25), also checked: tapping Send right after a restored draft
loads waits until 3.5 s after load, then sends; tapping Send while a photo is still shrinking waits
for it and the photo is included; a restored draft with a decoded VIN shows "✓ 2003 Honda Accord"
without a second NHTSA call; Start over after a failed send resets the Retry state; a VIN that
fails to decode reveals the manual fields without moving focus.

## How to run the phone rows

1. On the laptop, in the repo: `python -m http.server 8080`
2. Find the laptop's Wi-Fi IP (Windows: `ipconfig`, look for IPv4). On the phone, same Wi-Fi,
   open `http://<that-ip>:8080/`.
3. Work down the table. For row 8 "airplane mode", turn on airplane mode *after* the page loads,
   then type the VIN.
4. For rows 15–18 the backend must be deployed (`apps-script/DEPLOY.md`) and the page pushed.
