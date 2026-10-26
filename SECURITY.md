# Security

What protects the form, what is accepted on purpose, and what only a person can do.
Details live in comments in `apps-script/Code.gs` and `assets/app.js`.

## What it stops

| If someone tries to… | What happens |
|---|---|
| Flood the form to fill Russell's inbox or Drive | The backend takes at most 15 forms an hour and 40 a day. After that, customers see "Couldn't send" and a button to text Russell. Script Properties `MAX_PER_HOUR` / `MAX_PER_DAY` raise the limits without a redeploy. |
| Send Russell a phishing link through the form | The email says the details are customer-typed and breaks every link in them (`http[://]example[.]com`). The sheet keeps the original text. |
| Hide instructions for an AI assistant that reads the inbox or sheet | Invisible and text-direction characters (zero-width, bidi overrides, Unicode tag letters, variation selectors) are removed from every field. Visible text cannot be filtered; the email labels it as customer-typed. |
| Plant a spreadsheet formula (`=HYPERLINK(…)`) | Cells are plain text and a leading `= + - @` gets an apostrophe. If the sheet is ever downloaded as CSV, open it in Google Sheets, not Excel. |
| Upload something that is not a photo | Files must be real JPEG, PNG or WebP by their first bytes; the signature must be a PNG; size caps match what the page sends. |
| Make a retry count as a second job | Each form fill carries a random ID. A resend with the same ID and phone gets the first reference back and saves nothing. |
| Run a script on the page | A Content Security Policy allows only the site's own scripts and three outside addresses: the backend, Google's reply server, and the VIN lookup. Customer text is never inserted as HTML. |
| Read the last customer's details on Russell's phone | An unfinished form clears after 15 minutes on Russell's link (24 hours on a customer's own phone). A signature is never saved for later. |

## Accepted on purpose

- `FORM_SECRET` is in the page source. It turns away lazy bots only; the limits above are the real control.
- No CAPTCHA. Cloudflare Turnstile would need its own account and a third-party script on a page that
  must work on one bar of signal. Add it only if real abuse ever hits the limits.
- The script keeps full Drive access. Narrowing it means rewriting the Drive calls and re-authorizing the
  live script, for a script that only touches the folder it created.
- GitHub Pages cannot send security headers, so the policy is a `<meta>` tag and another site could frame
  the page. Nothing on it is a one-click action worth hijacking.

## Only a person can do these

1. **Two-step sign-in on the GitHub account that hosts the page.** Whoever controls that account controls
   where every printed QR code leads. <https://github.com/settings/security>
2. **2-Step Verification on the Google account that owns the sheet.** It holds customers' details.
   <https://myaccount.google.com/security>
3. **Paste only this repo's `Code.gs` into Apps Script**, and run the tests before publishing a new version.

## Checking it

```bash
node tests/backend.test.js
```

18 tests, no installs. They drive the backend end to end with fake Google services and a fixed clock,
and fail if any source file contains invisible characters.
