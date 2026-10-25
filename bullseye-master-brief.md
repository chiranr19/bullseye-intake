# Bullseye Intake — Master Brief for Claude Code

**Project:** Digital customer intake form for *Bullseye Mobile Windshield Chip Repair* (Russell T., Michigan).
**Builder:** Chiran. **Users:** Russell's customers (on their own phones, often standing in a parking lot) and Russell (one-man business, not tech-savvy, communicates by text only).
**Stack:** One static page on GitHub Pages + one Google Apps Script attached to a Google Sheet in Russell's Google account. No servers, no frameworks, no build step, no paid services, no accounts for customers.

This brief is meant to be complete. Work through the phases in order without checking in. Where something is undecided, pick the simplest option that fits the principles in §2 and log it in `DECISIONS.md`. Only the items in §7 (Placeholders) need a human.

---

## 1. What this replaces

Today Russell hands customers a paper form (name, phone, email, address, insurance company, policy number, vehicle, signature). Problems: unreadable handwriting, lost forms, customers filling it out while he waits, retyping into the insurer's claim line. Most insurers waive the deductible for chip repair, so Russell bills the insurer directly — that's why he needs the policy info and a signed authorization.

The new flow: a customer texts Russell → Russell texts back a link (or shows a QR code at the car) → customer fills it out in ~90 seconds → it lands in Russell's Google Sheet and his email with the insurance card photo attached → he calls in the claim and does the repair.

---

## 2. Principles (non-negotiable)

1. **Only name, phone, and signature are required.** Everything else is a shortcut. If a customer skips it, Russell fills it in at the car. The form never dead-ends.
2. **Type as little as possible.** The phone's own autofill handles contact info. A photo of the insurance card replaces typing the policy number, insurer, vehicle, and VIN. The VIN decodes year/make/model automatically.
3. **Works on one bar of signal.** Page under 150 KB total. Photos compressed on the phone before sending. Drafts saved locally. Failed sends can be retried, and there is always a "text Russell instead" fallback.
4. **Usable outside in sunlight, with one thumb.** Big tap targets (min 48px), high contrast, 16px+ inputs (prevents iOS zoom), single column, one scrolling page (no multi-step wizard — autofill works better and it's fewer taps).
5. **Nothing to manage.** Static files + Apps Script only. No frameworks, no npm, no build step, no analytics, no web fonts, no cookie banner, no login. Vendor the one JS library (signature_pad) into the repo — no runtime CDN dependency.
6. **Russell owns it.** The Sheet, the Drive folder, and the Apps Script live in *Russell's* Google account. The GitHub repo is Chiran's but holds no data.
7. **Plain language everywhere** — in the form, in error messages, in Russell's docs. No jargon the customer or Russell wouldn't use.
8. **Privacy by default.** No PII in URLs. Never log the payload in production. HTTPS only (GitHub Pages provides it).

---

## 3. Repo layout

```
bullseye-intake/
├── index.html              # the whole form + thank-you state (single page)
├── assets/
│   ├── app.js              # all form logic (vanilla JS, ES2017+, no modules needed)
│   ├── style.css
│   ├── logo.svg            # simple concentric-circle bullseye (original, generic)
│   └── favicon.svg
├── vendor/
│   └── signature_pad.min.js   # vendored copy, note version in DECISIONS.md
├── config.js               # ALL editable values (see §7) — loaded before app.js
├── apps-script/
│   ├── Code.gs             # Apps Script web app (backend)
│   ├── appsscript.json     # timeZone: America/Detroit
│   └── DEPLOY.md           # click-by-click deploy steps
├── scripts/
│   └── make_qr.py          # generates QR PNG/SVG per ref source (uses `segno`)
├── qr/                     # generated QR codes (committed)
├── docs/
│   ├── RUSSELL_SETUP.md    # one-page plain-language guide for Russell
│   └── TESTING.md          # the §9 checklist, kept current
├── DECISIONS.md            # every choice made without asking, one line each
├── .nojekyll
└── README.md
```

GitHub Pages serves a *project* site at `https://<user>.github.io/bullseye-intake/` — a subpath. **Use relative URLs everywhere** (`assets/app.js`, not `/assets/app.js`) so it also works later under a custom domain or anywhere else.

---

## 4. The page — section by section

Single `index.html`. Numbered sections stacked vertically. A sticky bottom bar holds the submit button. Each section's copy is given below; use it as written (adjust only for grammar).

### Header
- Logo + **Bullseye Mobile Windshield Chip Repair**
- "Russell T. · Text (810) 347-1796" — number is a `sms:` link
- Subhead: *"Takes about 90 seconds. Only your name, phone, and signature are required — Russell can fill in the rest at your car."*

### Section 1 — "About you"

| Field | Input | Required | Attributes / behavior |
|---|---|---|---|
| Full name | text | **yes** | `autocomplete="name" autocapitalize="words"` |
| Mobile phone | tel | **yes** | `autocomplete="tel" inputmode="tel"`; format live as `(xxx) xxx-xxxx`; accept exactly 10 digits (strip a leading 1); store digits only |
| Email | email | no | `autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false"` |
| Street address | text | no | `autocomplete="street-address"` |
| City | text | no | `autocomplete="address-level2"` |
| State | select | no | `autocomplete="address-level1"`, default **MI**, all 50 states |
| ZIP | text | no | `autocomplete="postal-code" inputmode="numeric" maxlength="5"` |

The `autocomplete` attributes are the whole point: tapping the name field on iOS/Android offers the phone's own contact card and fills all of these in one tap. Do not rename, reorder, or wrap these in a way that breaks autofill (keep them as real `<input>`s inside one `<form>`, with `<label for>`).

Helper text under address: *"Address helps Russell file the claim. Optional."*

### Section 2 — "Your insurance"

Order matters: **the photo shortcut comes first, above the typed fields.**

1. Card copy: *"Fastest: snap a photo of your insurance card. A screenshot from your insurance app works too."*
2. Two buttons feeding the same handler:
   - **Take photo** → `<input type="file" accept="image/*" capture="environment">` (opens rear camera directly)
   - **Choose from photos** → `<input type="file" accept="image/*">` (OS picker, for screenshots)
3. Up to **2 photos** (front/back, or card + something else). Each shows a thumbnail with a ✕ to remove.
4. **Compression on the phone, before upload:** draw to a canvas, long edge max 1600px, JPEG quality 0.75, target ≤ 300 KB per photo (drop quality to 0.6 if still over). Modern browsers apply EXIF orientation automatically when drawing an `Image`; if a test photo comes out rotated on iOS, use `createImageBitmap(file, { imageOrientation: 'from-image' })`. Keep the result as a base64 data URL in memory only (not in the draft — too big).
5. Then the typed fields:

| Field | Input | Required | Attributes / behavior |
|---|---|---|---|
| Insurance company | text + `<datalist>` | no | searchable list from `config.js` (`INSURERS`), Michigan-common carriers first, "Other / not sure" last; free text allowed |
| Policy number | text | no | `autocomplete="off" autocapitalize="characters" spellcheck="false"` |

Helper text: *"Don't have your card handy? Skip this — Russell will get it at your car."*

### Section 3 — "Your vehicle"

| Field | Input | Required | Behavior |
|---|---|---|---|
| VIN | text | no | `maxlength="17" autocomplete="off" autocapitalize="characters" spellcheck="false"`; uppercase as typed; strip spaces/dashes; reject letters I, O, Q inline ("VINs never contain I, O, or Q") |
| Year / Make / Model | text ×3 | no | hidden by default; revealed by the "Don't have it?" link, or automatically if decoding fails |
| Where will the car be? | radio | no | **At my address above** (default) / **Somewhere else** → reveals a text field, placeholder *"e.g., work parking lot — 123 Main St, Novi"* |
| Anything Russell should know? | textarea | no | placeholder *"Gate code, best time, 'it's the blue Civic in row C'…"*, maxlength 500 |

**VIN decoding:**
- When the field has 17 valid characters, run the standard check-digit test (position 9). A failure shows a soft warning *"Double-check this VIN — one character may be off"* but does **not** block anything.
- Then call `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json` (free, no key, supports CORS). Debounce 400 ms, abort any in-flight request, 6 s timeout. Read `Results[0].ModelYear`, `.Make`, `.Model`. Treat as success only if all three are non-empty.
- Success: show a green line *"✓ 2026 Honda Civic"* (title-case the make) and fill hidden year/make/model; `vin_source = "decoded"`. Offer a small "not right?" link that reveals the manual fields.
- Failure or timeout: reveal the manual fields quietly; `vin_source = "manual"` if they type, `"none"` otherwise. Never show a technical error.
- Helper link: *"Don't have it? Russell can read it off your windshield."* Tooltip/expander: *"Where's my VIN? Bottom corner of the windshield on the driver's side, the sticker inside the driver's door, your insurance card, or your registration."*
- Test VIN that decodes: `1HGCM82633A004352` (2003 Honda Accord).

### Section 4 — "Authorize and sign"

- Authorization text from `config.js` → `AUTH_TEXT` (see §7, this is a **placeholder**). Render it in normal-size readable type, not fine print.
- Signature pad: `signature_pad` on a canvas, full width, ~170px tall, black ink, "Sign with your finger" label, a **Clear** link. Handle device pixel ratio so strokes aren't blurry. Required: pad must be non-empty.
- Capture `signed_at` (ISO 8601 with offset), `auth_text_version` (from config), and `navigator.userAgent` into the payload. Export signature as PNG data URL (`toDataURL('image/png')`).

### Submit

- Sticky bottom bar, one big button: **Send to Russell**. Enabled only when name, phone (10 digits), and signature are present; otherwise tapping it scrolls to the first missing item and highlights it with a plain message ("Add your name" / "Add your mobile number" / "Please sign above").
- On tap: disable button, show states *"Sending…"* → *"Sending photo…"* (if photos). Guard against double submit.
- POST as described in §6. 30 s timeout via `AbortController`.

### Thank-you state (same page; replace the form, scroll to top)

- Headline: **Sent! Russell will text you to confirm a time.**
- Reference code (from the server, e.g. `BW-20261025-7K3Q`). Small print: *"Save this in case you need it."*
- Summary card: name, phone, vehicle (if known), insurer (if known), photo thumbnails.
- Button **Text Russell** → opens Messages pre-filled:
  - iOS: `sms:+18103471796&body=<encoded>` · Android/other: `sms:+18103471796?body=<encoded>` (detect iOS by user agent; iOS historically needs `&`).
  - Body: `Hi Russell, I just sent my info for a chip repair — {name}, {year make model or "my car"}. Ref {id}.`
- Button **Save Russell's contact** → downloads a `.vcf` (Blob, `text/vcard`): FN "Russell – Bullseye Windshield Repair", TEL, NOTE "Text only". If the download doesn't open on a given phone, the visible number is still a `tel:`/`sms:` link, so nothing is lost.
- Footer: *"Something wrong? Text Russell at (810) 347-1796."*

### Cross-cutting behaviors

- **Drafts:** every text/select/radio value saved to `localStorage` key `bullseye_draft_v1` on input (debounced 300 ms); restored on load with a quiet banner *"We saved what you typed earlier."* Signature PNG may be saved too (small); photos are not. Cleared on successful submit. If a customer taps "Start over," clear it.
- **Failure handling:** on network error / non-2xx / timeout → keep everything, show *"Couldn't send. Check your signal and try again."* with **Retry**. After the second failure, also show **Text Russell your info instead** → `sms:` link whose body contains all typed fields (no photo/signature — say so: *"Russell will grab your card and signature at the car."*).
- **Ref tag:** read `?ref=` from the URL (`flyer`, `truck`, `text`, `web`, `russell`, else `direct`), keep it in a hidden field and in the draft. QR codes and Russell's saved text link each carry their own value.
- **Honeypot:** hidden `website` text field (visually hidden, `tabindex="-1"`, `autocomplete="off"`); server rejects if non-empty. Also send `loaded_at`; server ignores submissions faster than 3 s after load.
- **Accessibility basics:** real `<label>`s, visible focus rings, errors as text next to the field (not color alone), `aria-live="polite"` region for status messages, `lang="en"`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

---

## 5. Design

- Match the flyer: **yellow** header band (`#FFD400`-ish) with black bold display headline; white body; black text; one accent for success (green) and one for errors (red). System font stack (`-apple-system, Segoe UI, Roboto, sans-serif`), no web fonts.
- Logo: an original, simple bullseye — concentric circles in black on yellow. Do **not** reproduce the clown/magician mascot from the flyer.
- Inputs: 16px+ font, 48px+ tall, 12px radius, 2px border, generous spacing. Section headers numbered "1 · About you" etc.
- Dark mode: respect `prefers-color-scheme` minimally (dark background, light text, same yellow accent) — but sunlight legibility in light mode is the priority.
- Page weight budget: ≤ 150 KB total including vendored JS. No images other than the SVG logo.

---

## 6. Backend — Google Apps Script

Container-bound to a Google Sheet named **"Bullseye Customers"** in Russell's account.

### Request from the page

```js
fetch(CONFIG.APPS_SCRIPT_URL, {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request → no CORS preflight
  redirect: 'follow',                                        // Apps Script 302s to googleusercontent.com
  signal: abortController.signal
});
```

Response is JSON: `{ "ok": true, "id": "BW-20261025-7K3Q" }` or `{ "ok": false, "error": "plain message" }`. If the response can't be read but status is 2xx, treat as success and show a client-generated reference.

### Payload

```json
{
  "secret": "<FORM_SECRET from config>",
  "website": "",
  "ref": "flyer",
  "loaded_at": "2026-10-25T19:40:12-04:00",
  "submitted_at": "2026-10-25T19:41:50-04:00",
  "name": "", "phone": "8105551234", "email": "",
  "street": "", "city": "", "state": "MI", "zip": "",
  "insurer": "", "policy_number": "",
  "vin": "", "year": "", "make": "", "model": "", "vin_source": "decoded|manual|none",
  "repair_location": "same|other", "repair_location_text": "",
  "notes": "",
  "auth_text_version": "v1", "signed_at": "", "user_agent": "",
  "photos": [ { "name": "card-1.jpg", "type": "image/jpeg", "data": "<base64, no data: prefix>" } ],
  "signature": { "type": "image/png", "data": "<base64>" }
}
```

### Sheet columns (row 1, frozen; set up by `setup()`)

`Submitted` · `ID` · `Status` · `Name` · `Phone` · `Email` · `Street` · `City` · `State` · `ZIP` · `Insurer` · `Policy #` · `VIN` · `Year` · `Make` · `Model` · `Repair location` · `Notes` · `Card photos` · `Signature` · `Folder` · `Source` · `Claim #` · `Scheduled` · `Amount billed` · `Paid` · `Russell's notes`

- `Status` has a dropdown (data validation): **New, Contacted, Claim filed, Scheduled, Repaired, Billed, Paid, Cancelled**. New rows get `New`. Conditional formatting: New = light yellow, Paid = light green.
- `Phone` stored as text `(810) 555-1234` so Sheets doesn't mangle it; `Submitted` as a real datetime in America/Detroit.
- `Card photos`, `Signature`, `Folder` are Drive links (`=HYPERLINK` not required; plain URLs are fine).
- Columns from `Claim #` onward are Russell's to fill by hand.

### `Code.gs` functions

- `setup()` — run once by hand: writes headers, freezes row 1, sets column widths, Status validation + formatting, creates Drive folder **"Bullseye Intake"** and stores its ID in Script Properties. Idempotent.
- `doGet()` — returns `{ "ok": true }` (health check only).
- `doPost(e)` — parse `e.postData.contents`; check `secret`, empty `website`, `submitted_at - loaded_at ≥ 3 s`; `LockService.getScriptLock().waitLock(10000)`; `id = makeId_()`; create subfolder `YYYY/ID – Name`; decode base64 → `Utilities.newBlob(bytes, type, name)` → `folder.createFile`; append row; `notify_()`; return JSON via `ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JSON)`. Any thrown error → `{ ok:false, error:"Something went wrong on our side. Please try again or text Russell." }` and log the real error with `console.error` (visible in Apps Script executions, never to the customer).
- `makeId_()` — `BW-YYYYMMDD-` + 4 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `notify_(row, blobs)` — `MailApp.sendEmail` to `NOTIFY_EMAIL` (and `CC_EMAIL` if set, for Chiran during the pilot):
  - Subject: `New repair: {Name} — {Year Make Model or "vehicle TBD"} — {Insurer or "insurer TBD"}`
  - Body: an HTML table of every field in reading order, then links to the Sheet and the Drive folder. Attach the card photos (not the signature).
- Script Properties (not hard-coded): `FORM_SECRET`, `NOTIFY_EMAIL`, `CC_EMAIL`, `ROOT_FOLDER_ID`.
- `appsscript.json`: `"timeZone": "America/Detroit"`, `"exceptionLogging": "STACKDRIVER"`, `"webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }`.

### Deploy (write these into `apps-script/DEPLOY.md`, click by click)

1. In Russell's Google account: create a Sheet named **Bullseye Customers** → Extensions → Apps Script.
2. Paste `Code.gs` and `appsscript.json` (enable "Show appsscript.json" in project settings). Save.
3. Project Settings → Script Properties → add the four properties.
4. Run `setup()` once from the editor; approve the permission prompts (Sheets, Drive, Mail).
5. Deploy → New deployment → type **Web app** → Execute as **Me** → Who has access **Anyone** → Deploy → copy the `/exec` URL into `config.js` → commit.
6. **After any code change:** Deploy → Manage deployments → ✎ → Version: *New version* → Deploy. The URL stays the same. (Editing code without a new version changes nothing live — this is the #1 gotcha.)
7. The `/dev` URL requires a Google login; never use it in `config.js`.

### Limits that matter (all fine for a one-man shop)
- Consumer Gmail: 100 emails/day via `MailApp`.
- POST body up to ~50 MB; ours is < 1 MB.
- No per-request cost; no quota worth worrying about at < 1,000 submissions/month.

---

## 7. Config and placeholders — `config.js`

```js
window.CONFIG = {
  BUSINESS_NAME: "Bullseye Mobile Windshield Chip Repair",
  OWNER_NAME: "Russell T.",
  OWNER_PHONE_E164: "+18103471796",     // from the flyer; text only
  OWNER_PHONE_DISPLAY: "(810) 347-1796",

  APPS_SCRIPT_URL: "PLACEHOLDER_APPS_SCRIPT_EXEC_URL",   // set after deploy (§6)
  FORM_SECRET: "PLACEHOLDER_RANDOM_STRING",              // same value as the Script Property; light anti-spam only — it is visible in the page source and is NOT a security boundary
  MOCK_SUBMIT: true,   // true = fake a 1.5 s success locally; set false once the real URL is in

  AUTH_TEXT_VERSION: "v1",
  // PLACEHOLDER — replace with the exact sentence(s) from Russell's current paper form.
  // This is the statement the customer signs: permission to do the repair and bill the insurer.
  AUTH_TEXT: "I authorize Bullseye Mobile Windshield Chip Repair to repair the windshield on the vehicle above and to bill my insurance company directly for the repair. I understand that if my insurance does not cover the repair, I am responsible for the cost.",

  INSURERS: [
    "State Farm", "Progressive", "Allstate", "AAA (Auto Club Group)", "Auto-Owners",
    "Farmers", "GEICO", "Liberty Mutual", "Nationwide", "USAA",
    "Citizens Insurance (Hanover)", "Frankenmuth", "Michigan Farm Bureau",
    "Pioneer State Mutual", "Hastings Mutual", "Fremont", "Meemic", "Westfield",
    "Travelers", "Safeco", "Erie", "The General", "Bristol West",
    "Other / not sure"
  ],

  REF_SOURCES: ["flyer", "truck", "text", "web", "russell"]
};
```

**Humans must supply:** `APPS_SCRIPT_URL` (after deploy), `FORM_SECRET` (any random string, set in both places), `AUTH_TEXT` (from Russell's paper form), Russell's Gmail for `NOTIFY_EMAIL`, and later a custom domain. Build and test everything else without waiting for these; `MOCK_SUBMIT` exists for exactly that.

---

## 8. Build order

Each phase ends with something runnable on a phone. Commit after each phase.

**Phase 0 — Scaffold (≈15 min)**
Repo layout from §3, `config.js`, `.nojekyll`, `README.md` (what/why/how to run locally), empty `DECISIONS.md`. Local run: `python3 -m http.server 8080` and open `http://<laptop-LAN-ip>:8080/` on a phone on the same Wi-Fi. (The `<input type=file capture>` camera works over plain http; nothing here needs a secure context.)

**Phase 1 — The form, mock submit**
All four sections with the exact fields/attributes above, live phone formatting, state select, validation + scroll-to-error, draft save/restore, honeypot, ref tag, sticky submit bar, thank-you state with `sms:` and vCard buttons, failure/retry UI (test by setting `MOCK_SUBMIT` to simulate failure). Styling per §5. No photos/VIN/signature yet — stub them visually.
*Done when:* on an iPhone and an Android phone, tapping the name field offers the contact card and one tap fills name/phone/email/address.

**Phase 2 — Photo, VIN, signature**
Camera/picker buttons, compression to ≤ 300 KB with thumbnails and remove, VIN validation + NHTSA decode with all fallbacks, signature pad with DPR handling and Clear, payload assembled exactly as §6.
*Done when:* a 4 MB photo becomes < 300 KB and looks right; `1HGCM82633A004352` shows "✓ 2003 Honda Accord"; a drawn signature exports as a clean PNG.

**Phase 3 — Backend + end-to-end**
`Code.gs`, `appsscript.json`, `DEPLOY.md`. Chiran deploys in Russell's (or, for the pilot, his own) Google account and pastes the URL; set `MOCK_SUBMIT: false`.
*Done when:* a real submission from a phone creates a Sheet row with Status **New**, a Drive folder with the photo(s) and signature, and an email with the right subject line and the photo attached — and the phone shows the server's reference code.

**Phase 4 — Ship**
`scripts/make_qr.py` (one PNG + SVG per ref source, 1200px, with the final URL), `docs/RUSSELL_SETUP.md` (§10), `docs/TESTING.md` (§9), GitHub Pages enabled (Settings → Pages → branch `main`, root; confirm "Enforce HTTPS"). Add a short "Custom domain later" section to README: add `CNAME` file, point DNS, re-check Enforce HTTPS, regenerate QR codes.

**Definition of done (whole project)**
- Everything in §9 passes on iOS Safari and Android Chrome.
- Total page weight ≤ 150 KB; first load on 3G-ish throttling under 3 s.
- No console errors; no third-party requests other than the NHTSA decode and the Apps Script POST.
- `DECISIONS.md` lists every choice made without asking.

---

## 9. Test checklist (`docs/TESTING.md`)

- [ ] iOS Safari: name field offers contact autofill; one tap fills name, phone, email, address, city, state, zip
- [ ] Android Chrome: same
- [ ] Phone formats live; pasting `+1 (810) 555-1234` yields 10 digits
- [ ] Submit with only name + phone + signature succeeds
- [ ] Submit with nothing shows "Add your name," scrolls there, no crash
- [ ] Take photo opens camera directly; Choose from photos opens picker; screenshot accepted
- [ ] 4 MB photo → < 300 KB; portrait photo not rotated; thumbnail + remove works; second photo works; third is refused politely
- [ ] VIN: lowercase becomes uppercase; "I/O/Q" rejected inline; `1HGCM82633A004352` decodes; a VIN with a wrong check digit shows the soft warning and still proceeds; airplane mode → manual fields appear, no error dialog
- [ ] Signature: draws smoothly, not blurry on a 3× screen; Clear works; empty signature blocks submit with "Please sign above"
- [ ] Fill half the form, kill the tab, reopen → values restored with the banner
- [ ] Successful submit clears the draft; reopening shows an empty form
- [ ] Bad `APPS_SCRIPT_URL` → "Couldn't send" + Retry; second failure shows "Text Russell your info instead" and the SMS body contains the typed fields
- [ ] Thank-you: reference code shown; **Text Russell** opens Messages with the body on iOS and Android; **Save Russell's contact** opens/downloads the vCard, number still tappable either way
- [ ] `?ref=flyer` lands in the Sheet's Source column; no `ref` → `direct`
- [ ] Honeypot filled → server rejects; submission 1 s after load → server rejects
- [ ] Email arrives with correct subject, all fields, photo attached, Sheet and folder links work
- [ ] Sheet: Status dropdown present, New rows yellow, phone not mangled, Submitted shows Detroit time
- [ ] Page served from GitHub Pages subpath with all relative links working; HTTPS enforced

---

## 10. Russell's one-page guide (`docs/RUSSELL_SETUP.md`)

Plain language, short, no screenshots required. Cover, in this order:

1. **Your link** — the full URL and the short way to say it. How to save it as a text shortcut (iPhone: Settings → General → Keyboard → Text Replacement, phrase `formlink`; Android: Gboard personal dictionary or a saved note) so replying to a customer is one word. Use the `?ref=text` version for texting.
2. **At the car** — show the QR (phone lock screen or a laminated card from `qr/`), or open the `?ref=russell` link on your own phone and hand it over.
3. **Where it all goes** — the email (what the subject line tells you at a glance; the card photo is attached), and the **Bullseye Customers** sheet in the Google Sheets app on your phone. One row per customer. Change **Status** as the job moves. Tap the Folder link for photos and the signature.
4. **If a customer can't or won't** — paper is still fine; you can type their row into the sheet later.
5. **If something breaks** — text Chiran. Nothing you do in the Sheet can break the form.
6. **Printing QR codes** — which file is for the flyer, which for the truck.

---

## 11. Later — do not build now

- AI reads the insurance card photo and fills Insurer / Policy # / VIN automatically (Apps Script → a vision model), with Russell reviewing.
- PDF of the signed form from a Google Doc template, for insurers that want it.
- VIN barcode scanning from the door-jamb sticker.
- "Use my current location" for the repair spot.
- Russell-side prefilled links for repeat customers (`?name=&phone=`).
- Offline queueing with a service worker.
- Port off GitHub Pages / Apps Script if volume or needs grow (nothing here is tied to either: the page is static, and the backend contract is one JSON POST).

---

## 12. Working agreements for this build

- Don't stop to ask questions. Decide, note it in `DECISIONS.md`, move on. The only blockers are the §7 placeholders, and `MOCK_SUBMIT` removes even those for Phases 0–2.
- Keep the code boring and readable: one `app.js`, functions named for what they do, comments only where a future reader would wonder "why."
- Every string a customer sees lives in one place at the top of `app.js` (or in `index.html`) so wording can be changed without hunting.
- Don't add features that aren't in this brief. If something seems missing, add it to §11 in the brief and keep going.
