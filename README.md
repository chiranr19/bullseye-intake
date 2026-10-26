# Bullseye Intake

`guide.html` is the plain-English visual explainer for Russell (live at `/guide.html`); `docs/HANDOVER_MESSAGES.md` has the messages to send him. `SECURITY.md` says what protects the form and what only a person can do.

Digital customer intake form for **Bullseye Mobile Windshield Chip Repair** (Russell T., Michigan).
Replaces the paper form. A customer opens a link or scans a QR code, fills in name, phone and a
signature (everything else is optional), snaps a photo of their insurance card, and the result lands
in Russell's Google Sheet and email.

**Stack:** one static page (GitHub Pages) + one Google Apps Script bound to a Google Sheet in
Russell's account. No servers, no frameworks, no build step, no paid services.

The full spec is `bullseye-master-brief.md`. Choices made while building are in `DECISIONS.md`.

## Layout

```
index.html              the whole form + thank-you state
assets/app.js           all form logic (vanilla JS)
assets/style.css
assets/logo.svg, favicon.svg
vendor/signature_pad.min.js   vendored, see DECISIONS.md for version
config.js               every editable value (phone, insurers, backend URL, secret)
apps-script/            Code.gs + appsscript.json + DEPLOY.md (the backend)
scripts/make_qr.py      generates QR codes per source (flyer, truck, text, web, russell)
qr/                     generated QR codes
docs/RUSSELL_SETUP.md   one-page guide for Russell
docs/TESTING.md         the test checklist
guide.html              plain-English visual guide for Russell
tests/backend.test.js   backend tests (plain Node, no installs)
SECURITY.md             what protects the form
```

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080/` on the laptop, or `http://<laptop-LAN-ip>:8080/` on a phone on the
same Wi-Fi. The camera button works over plain http. With `MOCK_SUBMIT: true` in `config.js` the
send button fakes a success after 1.5 s; set it to `"fail"` to test the retry path.

## Test

```bash
node tests/backend.test.js
```

18 tests drive the backend end to end with fake Google services and a fixed clock. Run them before
pasting a new `Code.gs` into Apps Script.

## Go live

1. Deploy the backend: follow `apps-script/DEPLOY.md` in Russell's Google account (or yours for a pilot).
2. In `config.js` set `APPS_SCRIPT_URL` to the `/exec` URL, `FORM_SECRET` to the same value as the
   Script Property, and `MOCK_SUBMIT` to `false`. Replace `AUTH_TEXT` with the wording from the paper form.
3. Push to GitHub. Settings → Pages → Deploy from branch `main`, folder `/ (root)`. Tick **Enforce HTTPS**.
4. Generate QR codes for the live URL:

   ```bash
   uv run scripts/make_qr.py --base-url https://<user>.github.io/bullseye-intake/
   ```

5. Work through `docs/TESTING.md` on a real iPhone and a real Android phone.

## Moving the page (do it before printing any QR code)

Every QR code holds the page's address, so the address should be the permanent one before anything
is printed. Two good homes, both kept up by Chiran:

- **Free:** a GitHub organization named for the business (for example `bullseye-chip-repair`).
  Create it at <https://github.com/organizations/plan>, then copy this repo into it as
  `<org>.github.io` so the page lives at `https://<org>.github.io/`. Russell can be added as an
  owner later; he never has to log in.
- **About $12 a year:** a domain such as `bullseyechiprepair.com`. Add a `CNAME` file with the
  domain at the repo root, point the domain's DNS at GitHub Pages, wait for the certificate, and
  re-tick **Enforce HTTPS**. Codes printed with a domain survive any later change of host.

Either way: enable Pages on the new repo, re-run `make_qr.py --base-url <new address>`, update the
two links in `docs/RUSSELL_SETUP.md`, the link box in `guide.html` and `docs/HANDOVER_MESSAGES.md`.
Then replace this repo's `index.html` and `guide.html` with one-line redirects to the new address
(keeping the `?ref=` part), so any link or QR photo already shared keeps working. The backend URL
and `config.js` do not change.

## Privacy

No analytics, no cookies, no web fonts, no third-party requests except the NHTSA VIN decode and the
Apps Script POST. Drafts are saved only in the customer's own browser. No customer data is in this repo.
