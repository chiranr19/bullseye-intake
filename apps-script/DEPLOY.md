# Deploying the backend (Google Apps Script)

Click by click. Takes about 15 minutes. Do this **in the Google account that should own the data**:
Russell's account for the real thing, or your own for a pilot. Nothing in the repo changes
except two values in `config.js` at the end.

## 1. Create the Sheet

1. Signed in to the right Google account, open <https://sheets.new>.
2. Click the title "Untitled spreadsheet" (top left) and name it **Bullseye Customers**.

## 2. Add the script

1. In the Sheet: **Extensions → Apps Script**. A new tab opens with an editor and a file `Code.gs`.
2. Click the project name "Untitled project" (top left) → rename it **Bullseye Intake**.
3. In the editor, select everything in `Code.gs` and delete it. Paste the full contents of
   `apps-script/Code.gs` from this repo. Press **Ctrl+S** (Cmd+S on Mac).
4. Left sidebar → **Project Settings** (gear icon) → tick **Show "appsscript.json" manifest file in editor**.
5. Back in **Editor** (the `< >` icon), click `appsscript.json`. Replace its contents with
   `apps-script/appsscript.json` from this repo. Save.

## 3. Set the Script Properties

Still in **Project Settings**, scroll to **Script Properties** → **Add script property**. Add:

| Property | Value |
|---|---|
| `FORM_SECRET` | Any random string. Make one with `python -c "import secrets; print(secrets.token_urlsafe(24))"`. You will put the same value in `config.js`. |
| `NOTIFY_EMAIL` | The address that should get the "New repair" email (Russell's Gmail). |
| `CC_EMAIL` | Optional. A second address copied on every email (Chiran, during the pilot). Leave it out to send to one address. |

Click **Save script properties**. `ROOT_FOLDER_ID` is written automatically by the next step.

## 4. Run setup() once

1. In **Editor**, make sure `Code.gs` is open. In the toolbar, the function dropdown next to
   **Debug** should say `setup`. Click **Run**.
2. A permissions dialog appears: **Review permissions** → choose the account → Google warns the
   app isn't verified (that's normal for your own script): click **Advanced** → **Go to Bullseye
   Intake (unsafe)** → **Allow**. It asks for Sheets (this file only), Drive, and sending email.
3. Open **Execution log** (bottom panel). You should see `Formats after setup: A3="mmm d, yyyy h:mm am/pm" J3="@"`,
   then `setup() done` and either `All Script Properties set` or a list of what is still missing.
4. Check the Sheet tab: a tab named **Customers** with a bold yellow header row, frozen.
   Check Drive: a folder **Bullseye Intake** exists.

`setup()` is safe to run again any time: it never deletes a column that has data, and it sets the
row colors only the first time (so Russell's own color rules, if he adds any, are kept).

## 5. Deploy as a web app

1. Top right: **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Description: `v1`. **Execute as: Me**. **Who has access: Anyone**. Click **Deploy**.
4. Copy the **Web app URL**. It ends in `/exec`. That is `APPS_SCRIPT_URL`.

Quick check: paste the URL into a browser tab. You should see `{"ok":true}`.

## 6. Point the page at it

In `config.js`:

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/…/exec",
FORM_SECRET: "the same random string as the Script Property",
MOCK_SUBMIT: false,
```

Commit and push. GitHub Pages updates within a minute or two. A phone that already opened the page
may keep the old `config.js` for up to 10 more minutes (the server sends `max-age=600`).

## 7. Send a test

Open the live page on a phone, fill in name + phone, sign, add a card photo, tap **Send to Russell**.
Expect, within a few seconds:

- the phone shows **Sent!** with a reference like `BW-20261025-7K3Q`
- a new row in **Customers** with Status **New** (light yellow), phone shown as `(810) 555-1234`
- a Drive folder `Bullseye Intake / 2026 / BW-… – Name` with `card-1.jpg` and `signature.png`
- an email `New repair: Name — vehicle — insurer` with the card photo attached and working links

## After any code change (the #1 gotcha)

Editing `Code.gs` does **not** change what is live. You must publish a new version:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy.**

The URL stays the same, so `config.js` does not change.

## Things to know

- `/exec` is the public URL. The `/dev` URL only works while you are signed in. Never put `/dev` in `config.js`.
- Errors never reach the customer. To see them: left sidebar → **Executions**. Rejected spam shows
  as a warning with the reason (secret mismatch, honeypot filled, too fast).
- Email limit on a consumer Gmail account is 100 per day through Apps Script. Fine for this shop.
- To move from a pilot account to Russell's account later, repeat steps 1–6 in his account and
  update the two values in `config.js`. The old Sheet keeps the pilot rows; nothing is lost.

## Testing the backend without the page

Health check:

```bash
curl -L "https://script.google.com/macros/s/…/exec"
```

A minimal submission (replace the URL and the secret; `loaded_at` must be at least 3 seconds
before `submitted_at`, and the signature is a 1×1 PNG):

```bash
curl -L -H "Content-Type: text/plain;charset=utf-8" -d '{"secret":"YOUR_SECRET","website":"","ref":"web","loaded_at":"2026-10-25T10:00:00-04:00","submitted_at":"2026-10-25T10:01:00-04:00","name":"Curl Test","phone":"8105550000","email":"","street":"","city":"","state":"MI","zip":"","insurer":"","policy_number":"","vin":"","year":"","make":"","model":"","vin_source":"none","repair_location":"same","repair_location_text":"","notes":"backend test","auth_text_version":"v1","signed_at":"2026-10-25T10:00:50-04:00","user_agent":"curl","photos":[],"signature":{"type":"image/png","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}}' "https://script.google.com/macros/s/…/exec"
```

Expect `{"ok":true,"id":"BW-…"}`. Delete the test row afterwards, or set its Status to Cancelled.
