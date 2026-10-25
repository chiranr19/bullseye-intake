# Bullseye Intake

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
```

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080/` on the laptop, or `http://<laptop-LAN-ip>:8080/` on a phone on the
same Wi-Fi. The camera button works over plain http. With `MOCK_SUBMIT: true` in `config.js` the
send button fakes a success after 1.5 s; set it to `"fail"` to test the retry path.

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

## Custom domain later

Add a `CNAME` file containing the domain at the repo root, point the domain's DNS at GitHub Pages
(CNAME record to `<user>.github.io`), wait for the certificate, re-tick **Enforce HTTPS** in
Settings → Pages, then re-run `make_qr.py` with the new URL and reprint. All links in the page are
relative, so nothing else changes.

## Privacy

No analytics, no cookies, no web fonts, no third-party requests except the NHTSA VIN decode and the
Apps Script POST. Drafts are saved only in the customer's own browser. No customer data is in this repo.
