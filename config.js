/* Bullseye Intake — all editable values live here. Loaded before assets/app.js.
 *
 * Three things need a human before the form goes live (see README → "Go live"):
 *   1. APPS_SCRIPT_URL  — the /exec URL you get after deploying apps-script/Code.gs
 *   2. FORM_SECRET      — any random string, set here AND as the FORM_SECRET Script Property
 *   3. AUTH_TEXT        — the exact wording from Russell's current paper form
 */
window.CONFIG = {
  BUSINESS_NAME: "Bullseye Mobile Windshield Chip Repair",
  OWNER_NAME: "Russell T.",
  OWNER_PHONE_E164: "+18103471796",     // from the flyer; text only
  OWNER_PHONE_DISPLAY: "(810) 347-1796",

  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwzwHApUc_9qEKFzvgPSJMtWO1XddIxmxQ1k_ZaDeN4b-iQQbJ9KkJ39FSf-Whn6KZC/exec",   // set after deploy (apps-script/DEPLOY.md)
  FORM_SECRET: "9HqSWe9wdFUNsL1hEuPyW_JirxISGQOT",              // same value as the Script Property.
                                                         // Light anti-spam only — it is visible in the
                                                         // page source and is NOT a security boundary.

  // MOCK_SUBMIT controls what "Send to Russell" does while there is no backend yet:
  //   true    → fake a 1.5 s success (no network call)
  //   "fail"  → fake a network failure every time (to test the Retry / "Text Russell" fallback)
  //   false   → really POST to APPS_SCRIPT_URL  ← set this once the real URL is in
  MOCK_SUBMIT: false,

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

  // Values the ?ref= query parameter may carry. Anything else (or nothing) is recorded as "direct".
  REF_SOURCES: ["flyer", "truck", "text", "web", "russell"]
};
