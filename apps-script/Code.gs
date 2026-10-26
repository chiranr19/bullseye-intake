/**
 * Bullseye Intake — Apps Script backend.
 * Container-bound to the "Bullseye Customers" Google Sheet in Russell's account.
 *
 *   setup()    run once by hand from the editor (safe to run again)
 *   doGet()    health check → { ok: true }
 *   doPost(e)  receives one submission from the page → row + Drive files + email → { ok, id }
 *
 * Script Properties (Project Settings → Script Properties):
 *   FORM_SECRET     same value as config.js → FORM_SECRET
 *   NOTIFY_EMAIL    where the "New repair" email goes (Russell's Gmail)
 *   CC_EMAIL        optional second address (Chiran during the pilot)
 *   ROOT_FOLDER_ID  written by setup(); the Drive folder every submission goes under
 *   MAX_PER_HOUR    optional; flood guard, default 15 forms an hour (no redeploy needed to change)
 *   MAX_PER_DAY     optional; flood guard, default 40 forms a day
 *
 * The customer never sees a technical error. Real errors go to console.error (Executions log).
 */

var TZ = 'America/Detroit';
var SHEET_NAME = 'Customers';
var ROOT_FOLDER_NAME = 'Bullseye Intake';
var MIN_FILL_SECONDS = 3;
var MAX_BODY_CHARS = 2.5 * 1024 * 1024;      // ~2.5 MB of JSON; a real submission is under 1 MB
var MAX_PHOTOS = 2;
var MAX_PHOTO_BYTES = 600 * 1024;            // the page sends photos of ≤ ~300 KB; twice that is the ceiling
var MAX_SIGNATURE_BYTES = 300 * 1024;        // a signature PNG is 10–60 KB
// Flood guard. A one-person shop never sees this many real forms. A robot that gets past the
// secret, the honeypot and the timer stops here, well before Gmail's 100-recipients-a-day limit
// or the Drive quota. Raise either with a Script Property of the same name; no redeploy needed.
var MAX_PER_HOUR = 15;
var MAX_PER_DAY = 40;
var DEDUPE_SECONDS = 6 * 60 * 60;            // a resend of the same form within 6 h returns the first ID
var ALLOWED_IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
var ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var USER_ERROR = 'Something went wrong on our side. Please try again or text Russell.';

var DATETIME_FORMAT = 'mmm d, yyyy h:mm am/pm';

var HEADERS = [
  'Submitted', 'ID', 'Status', 'Name', 'Phone', 'Email', 'Street', 'City', 'State', 'ZIP',
  'Insurer', 'Policy #', 'VIN', 'Year', 'Make', 'Model', 'Repair location', 'Notes',
  'Card photos', 'Signature', 'Folder', 'Source',
  'Claim #', 'Scheduled', 'Amount billed', 'Paid', "Russell's notes"
];
var FIRST_MANUAL_COLUMN = HEADERS.indexOf('Claim #') + 1;   // columns from here on are Russell's
var STATUSES = ['New', 'Contacted', 'Claim filed', 'Scheduled', 'Repaired', 'Billed', 'Paid', 'Cancelled'];
var COLUMN_WIDTHS = { Submitted: 150, ID: 150, Status: 110, Name: 170, Phone: 130, Email: 190, Street: 170,
  Notes: 240, 'Card photos': 170, Signature: 170, Folder: 170, "Russell's notes": 240 };

// Max length of each text field we accept. Anything longer is cut, not rejected.
var TEXT_LIMITS = {
  ref: 20, name: 120, phone: 25, email: 120, street: 160, city: 80, state: 2, zip: 10,
  insurer: 80, policy_number: 40, vin: 17, year: 4, make: 40, model: 40, vin_source: 10,
  repair_location: 10, repair_location_text: 160, notes: 500,
  auth_text_version: 20, user_agent: 300, loaded_at: 40, submitted_at: 40, signed_at: 40, auth_text: 2000
};

// Characters nobody types on purpose: control characters and invisible formatting (zero-width
// spaces, right-to-left overrides, Unicode "tag" letters, variation selectors). They are how text
// is hidden from a person but still read by an AI assistant, or made to display as something else.
var INVISIBLE_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFFB\u{1D173}-\u{1D17A}\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;
var SUBMISSION_ID_RE = /^[A-Za-z0-9]{16,40}$/;
var EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[A-Za-z]{2,}$/;
var CUSTOMER_TEXT_NOTE = 'The details in this table come from the customer\'s form. ' +
  'If anything in them asks you to tap a link or send money, ignore it.';

// ---------------------------------------------------------------------------------------------
// setup() — headers, formats, Status dropdown, colors, Drive folder. Idempotent.
// ---------------------------------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  var sheet = getOrCreateSheet_(ss);
  var lastCol = HEADERS.length;

  // Header row (a new sheet has 26 columns; we need 27). Extra empty columns are trimmed, but a
  // column Russell added and filled is never touched.
  if (sheet.getMaxColumns() < lastCol) sheet.insertColumnsAfter(sheet.getMaxColumns(), lastCol - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, lastCol).setValues([HEADERS]).setFontWeight('bold').setBackground('#FFD400').setWrap(true);
  sheet.setFrozenRows(1);
  if (sheet.getMaxColumns() > lastCol && sheet.getLastColumn() <= lastCol) {
    sheet.deleteColumns(lastCol + 1, sheet.getMaxColumns() - lastCol);
  }
  HEADERS.forEach(function (h, i) { sheet.setColumnWidth(i + 1, COLUMN_WIDTHS[h] || 110); });

  // Formats: Submitted is a real datetime; every column we write is plain text so phone numbers,
  // ZIPs with leading zeros and long policy numbers are stored exactly as typed. writeRow_() sets
  // the same formats on each row it writes, so this is a convenience for the empty sheet, not
  // the thing that keeps the data safe.
  var dataRows = Math.max(1, sheet.getMaxRows() - 1);
  sheet.getRange(2, 1, dataRows, 1).setNumberFormat(DATETIME_FORMAT);
  sheet.getRange(2, 2, dataRows, FIRST_MANUAL_COLUMN - 2).setNumberFormat('@');
  SpreadsheetApp.flush();
  console.log('Formats after setup: A3="%s" J3="%s" (expected the datetime pattern and "@")',
    sheet.getRange('A3').getNumberFormat(), sheet.getRange('J3').getNumberFormat());

  // Status dropdown
  var statusCol = HEADERS.indexOf('Status') + 1;
  var colLetter = columnLetter_(statusCol);
  sheet.getRange(colLetter + '2:' + colLetter).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build()
  );

  // Row colors: New = light yellow, Paid = light green. Set once; if any rules exist (ours or
  // Russell's own), leave them alone.
  if (sheet.getConditionalFormatRules().length === 0) {
    var dataRange = sheet.getRange('A2:' + columnLetter_(lastCol));
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + colLetter + '2="New"')
        .setBackground('#FFF8C5').setRanges([dataRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + colLetter + '2="Paid"')
        .setBackground('#D9F2DC').setRanges([dataRange]).build()
    ]);
  }

  // Drive folder
  var props = PropertiesService.getScriptProperties();
  var root = getOrCreateRootFolder_(props);

  // Tell the person running this what is still missing
  var missing = ['FORM_SECRET', 'NOTIFY_EMAIL'].filter(function (k) { return !props.getProperty(k); });
  console.log('setup() done. Sheet tab "%s" ready. Drive folder: %s', SHEET_NAME, root.getUrl());
  if (missing.length) {
    console.warn('Still missing Script Properties: %s — add them under Project Settings → Script Properties.', missing.join(', '));
  } else {
    console.log('All Script Properties set. Next: Deploy → New deployment → Web app.');
  }
}

// ---------------------------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------------------------
function doGet() {
  return json_({ ok: true });
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);            // text fields only; cheap
    var props = PropertiesService.getScriptProperties();
    checkSpam_(payload, props);                // bots are turned away before any base64 work
    var cache = CacheService.getScriptCache();
    var early = findPrior_(cache, payload.submission_id, payload.phone);
    if (early) {                               // a resend of a form that already went through
      console.info('Resend of ' + early + ' (same submission_id): not saved or emailed again');
      return json_({ ok: true, id: early });
    }
    var limits = limits_(props);
    precheckCaps_(cache, limits);              // a flood is turned away before decoding or locking
    decodeFiles_(payload);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet tab "' + SHEET_NAME + '" not found — run setup() first');

    // Only id + folder + row need to be serialized; the email does not, so the lock is released first.
    var saved = withLock_(function () {
      var prior = findPrior_(cache, payload.submission_id, payload.phone);
      if (prior) return { id: prior, duplicate: true };   // a resend of a form that already went through
      var caps = checkCaps_(cache, sheet, limits);
      var id = makeId_(sheet);
      var folder = makeSubmissionFolder_(props, id, payload.name);
      var files = saveFiles_(folder, payload, id);
      writeRow_(sheet, buildRow_(id, payload, files, folder));
      remember_(cache, caps, payload.submission_id, payload.phone, id);
      return { id: id, folder: folder, files: files };
    });
    if (saved.duplicate) {
      console.info('Resend of ' + saved.id + ' (same submission_id): not saved or emailed again');
      return json_({ ok: true, id: saved.id });
    }

    try {
      notify_(props, ss, saved.id, payload, saved.files, saved.folder);
    } catch (mailErr) {
      // The row and files are saved; a mail problem must not fail the customer.
      console.error('notify_ failed for ' + saved.id + ': ' + (mailErr && mailErr.stack || mailErr));
    }
    return json_({ ok: true, id: saved.id });
  } catch (err) {
    if (err && err.rejection) {
      console.warn('Rejected submission: ' + err.message);
      return json_({ ok: false, error: err.userMessage || USER_ERROR });
    }
    console.error('doPost failed: ' + (err && err.stack || err));
    return json_({ ok: false, error: USER_ERROR });
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------------------------
// Flood guard and resend detection. CacheService is best effort, so a cache problem is logged and
// never turns away a real customer; today's count comes from the sheet itself.
// ---------------------------------------------------------------------------------------------
function limits_(props) {
  return {
    hour: positiveInt_(props.getProperty('MAX_PER_HOUR'), MAX_PER_HOUR),
    day: positiveInt_(props.getProperty('MAX_PER_DAY'), MAX_PER_DAY)
  };
}

function positiveInt_(value, fallback) {
  var n = parseInt(value, 10);
  return n > 0 ? n : fallback;
}

function capKeys_(now) {
  return {
    hour: 'cap:h:' + Utilities.formatDate(now, TZ, 'yyyyMMddHH'),
    day: 'cap:d:' + Utilities.formatDate(now, TZ, 'yyyyMMdd')
  };
}

// A cheap look before any decoding or locking. A cache miss counts as zero; checkCaps_ decides.
function precheckCaps_(cache, limits) {
  var counts;
  try {
    var keys = capKeys_(new Date());
    var got = cache.getAll([keys.hour, keys.day]);
    counts = { hour: Number(got[keys.hour] || 0), day: Number(got[keys.day] || 0) };
  } catch (cacheErr) {
    console.warn('cap pre-check skipped: ' + cacheErr);
    return;
  }
  if (counts.hour >= limits.hour) throw rejection_('hourly cap reached (pre-check): ' + counts.hour);
  if (counts.day >= limits.day) throw rejection_('daily cap reached (pre-check): ' + counts.day);
}

// The real check, under the lock.
function checkCaps_(cache, sheet, limits) {
  var now = new Date();
  var keys = capKeys_(now);
  var hour = 0;
  try { hour = Number(cache.get(keys.hour) || 0); } catch (cacheErr) { console.warn('hour count unavailable: ' + cacheErr); }
  var day = countToday_(sheet, now);
  if (hour >= limits.hour || day >= limits.day) {
    // Let the next requests stop at the pre-check instead of queueing for the lock.
    try { cache.put(keys.day, String(day), 21600); } catch (cacheErr) { console.warn('could not cache day count: ' + cacheErr); }
    throw rejection_((hour >= limits.hour ? 'hourly' : 'daily') + ' cap reached: hour=' + hour + ' day=' + day);
  }
  return { keys: keys, hour: hour, day: day };
}

// Rows whose ID carries today's date (Detroit time). Deleting a row lowers the count.
function countToday_(sheet, now) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var idCol = HEADERS.indexOf('ID') + 1;
  var prefix = 'BW-' + Utilities.formatDate(now, TZ, 'yyyyMMdd') + '-';
  return sheet.getRange(2, idCol, last - 1, 1).createTextFinder(prefix).matchCase(true).findAll().length;
}

// A resend counts only if it is the same customer's form: same submission ID and same phone. The
// cache keeps the last 4 digits only, enough to tell two customers apart on a reused draft.
function findPrior_(cache, submissionId, phone) {
  if (!submissionId) return '';
  var hit;
  try {
    hit = cache.get('sub:' + submissionId) || '';
  } catch (cacheErr) {
    console.warn('resend check skipped: ' + cacheErr);
    return '';
  }
  var parts = hit.split(' ');
  if (!parts[0]) return '';
  if (parts[1] !== String(phone || '').slice(-4)) {
    console.warn('submission_id reused with a different phone; saving it as a new form');
    return '';
  }
  return parts[0];
}

// Runs after the row is written: the work is saved, so a cache problem is logged, never thrown.
function remember_(cache, caps, submissionId, phone, id) {
  try {
    cache.put(caps.keys.hour, String(caps.hour + 1), 3700);
    cache.put(caps.keys.day, String(caps.day + 1), 21600);
    if (submissionId) cache.put('sub:' + submissionId, id + ' ' + String(phone || '').slice(-4), DEDUPE_SECONDS);
  } catch (cacheErr) {
    console.warn('could not record ' + id + ' in the cache: ' + cacheErr);
  }
}

// ---------------------------------------------------------------------------------------------
// Input: parse, clean, cap. Throws a rejection (logged, generic message) on anything off.
// ---------------------------------------------------------------------------------------------
function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) throw rejection_('empty body');
  var raw = e.postData.contents;
  if (raw.length > MAX_BODY_CHARS) throw rejection_('body too large: ' + raw.length);

  var data;
  try { data = JSON.parse(raw); } catch (parseErr) { throw rejection_('invalid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw rejection_('body is not an object');

  var p = {};
  Object.keys(TEXT_LIMITS).forEach(function (k) { p[k] = cleanText_(data[k], TEXT_LIMITS[k], k === 'notes'); });
  p.secret = typeof data.secret === 'string' ? data.secret : '';
  p.website = data.website === undefined || data.website === null ? '' : String(data.website);
  p.rawPhotos = data.photos;          // decoded later by decodeFiles_, after the spam checks
  p.rawSignature = data.signature;
  p.submission_id = typeof data.submission_id === 'string' && SUBMISSION_ID_RE.test(data.submission_id) ? data.submission_id : '';

  p.phone = p.phone.replace(/\D/g, '');
  if (p.phone.length === 11 && p.phone.charAt(0) === '1') p.phone = p.phone.slice(1);
  p.vin = p.vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  p.state = p.state.toUpperCase();
  p.ref = p.ref.toLowerCase().replace(/[^a-z]/g, '') || 'direct';
  if (['same', 'other'].indexOf(p.repair_location) === -1) p.repair_location = 'same';
  if (['decoded', 'manual', 'none'].indexOf(p.vin_source) === -1) p.vin_source = 'none';

  if (!p.name) throw rejection_('name missing', 'Add your name');
  if (p.phone.length !== 10) throw rejection_('phone invalid', 'Add your mobile number');
  return p;
}

function decodeFiles_(p) {
  p.photos = cleanFiles_(p.rawPhotos, MAX_PHOTOS, MAX_PHOTO_BYTES, 'card');
  var sig = cleanFiles_(p.rawSignature ? [p.rawSignature] : [], 1, MAX_SIGNATURE_BYTES, 'signature', 'image/png');
  if (!sig.length) throw rejection_('signature missing', 'Please sign above');
  p.signature = sig[0];
  delete p.rawPhotos;
  delete p.rawSignature;
}

function cleanText_(v, max, multiline) {
  if (typeof v !== 'string') return '';
  // Drop control and invisible characters; keep tab/newline only where several lines make sense (notes).
  var s = v.replace(INVISIBLE_RE, '');
  s = multiline ? s.replace(/\r\n?/g, '\n') : s.replace(/[\r\n\t]+/g, ' ');
  return s.trim().slice(0, max);
}

// Images only: the declared type must be allowed and the bytes must start like a real JPEG, PNG or
// WebP. What is stored is the type the bytes show, never the type the request claims.
function cleanFiles_(list, maxCount, maxBytes, kind, onlyType) {
  if (!Array.isArray(list)) return [];
  var out = [];
  list.slice(0, maxCount).forEach(function (f, i) {
    if (!f || typeof f !== 'object') return;
    var type = typeof f.type === 'string' ? f.type.toLowerCase().trim() : '';
    var ext = ALLOWED_IMAGE_TYPES[type];
    var b64 = typeof f.data === 'string' ? f.data.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : '';
    if (!ext || !b64) return;
    if (b64.length > Math.ceil(maxBytes * 4 / 3) + 4) throw rejection_(kind + ' file too large: ' + b64.length);
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) throw rejection_(kind + ' file is not base64');
    var bytes;
    try { bytes = Utilities.base64Decode(b64); } catch (decodeErr) { throw rejection_(kind + ' file failed to decode'); }
    var real = sniffImageType_(bytes);
    if (!real) throw rejection_(kind + ' file is not an image');
    if (onlyType && real !== onlyType) throw rejection_(kind + ' file is ' + real + ', expected ' + onlyType);
    out.push({ name: kind + '-' + (i + 1) + '.' + ALLOWED_IMAGE_TYPES[real], type: real, bytes: bytes });
  });
  return out;
}

// What the first bytes say the file is, or '' if it is not a JPEG, PNG or WebP.
function sniffImageType_(bytes) {
  function at(i) { return i < bytes.length ? bytes[i] & 0xFF : -1; }
  if (at(0) === 0xFF && at(1) === 0xD8 && at(2) === 0xFF) return 'image/jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4E && at(3) === 0x47 &&
      at(4) === 0x0D && at(5) === 0x0A && at(6) === 0x1A && at(7) === 0x0A) return 'image/png';
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
      at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return 'image/webp';
  return '';
}

function checkSpam_(p, props) {
  var secret = props.getProperty('FORM_SECRET') || '';
  if (!secret) throw new Error('FORM_SECRET Script Property is not set');   // our mistake, not the customer's
  if (p.secret !== secret) throw rejection_('secret mismatch');
  if (p.website) throw rejection_('honeypot filled');
  var loaded = new Date(p.loaded_at);
  var submitted = new Date(p.submitted_at);
  if (isNaN(loaded.getTime()) || isNaN(submitted.getTime())) throw rejection_('bad timestamps');
  var seconds = (submitted.getTime() - loaded.getTime()) / 1000;
  if (seconds < MIN_FILL_SECONDS) throw rejection_('too fast: ' + seconds.toFixed(1) + 's');
}

function rejection_(logMessage, userMessage) {
  var err = new Error(logMessage);
  err.rejection = true;
  err.userMessage = userMessage || '';
  return err;
}

// ---------------------------------------------------------------------------------------------
// IDs, Drive, Sheet row
// ---------------------------------------------------------------------------------------------
// BW-YYYYMMDD-XXXX, re-rolled if the ID already exists in the sheet (called with the lock held).
function makeId_(sheet) {
  var idCol = HEADERS.indexOf('ID') + 1;
  var day = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  for (var attempt = 0; attempt < 8; attempt++) {
    var tail = '';
    for (var i = 0; i < 4; i++) tail += ID_ALPHABET.charAt(Math.floor(Math.random() * ID_ALPHABET.length));
    var id = 'BW-' + day + '-' + tail;
    var hit = sheet.getRange(1, idCol, Math.max(sheet.getLastRow(), 1), 1).createTextFinder(id).matchEntireCell(true).findNext();
    if (!hit) return id;
  }
  throw new Error('could not make a unique id');
}

function getOrCreateRootFolder_(props) {
  var id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try {
      var existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (gone) { /* deleted or no longer reachable; make a new one */ }
  }
  var byName = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  var folder = null;
  while (byName.hasNext()) {
    var candidate = byName.next();
    if (!candidate.isTrashed()) { folder = candidate; break; }
  }
  if (!folder) folder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

// Bullseye Intake / 2026 / BW-20261025-7K3Q – Jane Doe
function makeSubmissionFolder_(props, id, name) {
  var root = getOrCreateRootFolder_(props);   // self-heals if the root folder was trashed or deleted
  var year = Utilities.formatDate(new Date(), TZ, 'yyyy');
  var yearFolder = childFolder_(root, year);
  var safeName = name.replace(/[\/\\:*?"<>|\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return yearFolder.createFolder(id + ' – ' + safeName);
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed()) return f;
  }
  return parent.createFolder(name);
}

function saveFiles_(folder, p, id) {
  var photoBlobs = [];
  var photoUrls = [];
  p.photos.forEach(function (ph) {
    var blob = Utilities.newBlob(ph.bytes, ph.type, ph.name);
    photoUrls.push(folder.createFile(blob).getUrl());
    photoBlobs.push(blob);
  });
  var sigBlob = Utilities.newBlob(p.signature.bytes, p.signature.type, 'signature.' + ALLOWED_IMAGE_TYPES[p.signature.type]);
  var signatureUrl = folder.createFile(sigBlob).getUrl();

  // The audit trail for the signed authorization lives next to the signature, not only in an email.
  // Times marked (phone) come from the customer's phone clock; "Received" is Google's clock.
  var details = [
    'Reference: ' + id,
    'Name: ' + p.name,
    'Received at (server): ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss z'),
    'Signed at (phone): ' + p.signed_at,
    'Page loaded at (phone): ' + p.loaded_at,
    'Submitted at (phone): ' + p.submitted_at,
    'Terms version: ' + p.auth_text_version,
    'Source: ' + p.ref,
    'VIN source: ' + p.vin_source,
    'Submission ID: ' + (p.submission_id || '-'),
    'Device: ' + p.user_agent,
    '',
    'Authorization wording shown on the page:',
    p.auth_text || '(not sent by this version of the page)'
  ].join('\n') + '\n';
  folder.createFile('details.txt', details, MimeType.PLAIN_TEXT);

  return { photoBlobs: photoBlobs, photoUrls: photoUrls, signatureUrl: signatureUrl };
}

function buildRow_(id, p, files, folder) {
  var row = [
    new Date(),
    id,
    'New',
    p.name,
    formatPhone_(p.phone),
    p.email,
    p.street,
    p.city,
    p.state,
    p.zip,
    p.insurer,
    p.policy_number,
    p.vin,
    p.year,
    p.make,
    p.model,
    repairLocationText_(p),
    p.notes,
    files.photoUrls.join('\n'),
    files.signatureUrl,
    folder.getUrl(),
    p.ref
  ];
  while (row.length < HEADERS.length) row.push('');
  return row.map(safeCell_);
}

// appendRow() lets Sheets parse the values as if typed: "48503" becomes a number, "0012" becomes
// 12, a 20-digit policy number loses precision. Setting the formats on the exact row first and
// then the values keeps every customer field as typed. Only the columns the form fills are
// written; Russell's columns to the right are left untouched.
function writeRow_(sheet, row) {
  var n = FIRST_MANUAL_COLUMN - 1;
  var r = sheet.getLastRow() + 1;
  if (r > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), r - sheet.getMaxRows());
  var range = sheet.getRange(r, 1, 1, n);
  var formats = [];
  for (var i = 0; i < n; i++) formats.push(i === 0 ? DATETIME_FORMAT : '@');
  range.setNumberFormats([formats]);
  range.setValues([row.slice(0, n)]);
  return r;
}

// Sheets treats a cell starting with = + - @ as a formula. Customer text must never be one.
function safeCell_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function formatPhone_(d) {
  return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d;
}

function repairLocationText_(p) {
  if (p.repair_location === 'other') return p.repair_location_text || 'Somewhere else (not given)';
  return 'At customer address';
}

function vehicleLabel_(p) {
  return [p.year, p.make, p.model].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------------------------
// Email to Russell (and CC during the pilot). Card photos attached; the signature is a link.
// ---------------------------------------------------------------------------------------------
function notify_(props, ss, id, p, files, folder) {
  var to = props.getProperty('NOTIFY_EMAIL');
  if (!to) { console.warn('NOTIFY_EMAIL is not set; no email sent for ' + id); return; }
  var cc = props.getProperty('CC_EMAIL') || '';

  var vehicle = vehicleLabel_(p) || 'vehicle TBD';
  var insurer = p.insurer || 'insurer TBD';
  var subject = 'New repair: ' + p.name + ' — ' + vehicle + ' — ' + insurer;
  var address = [p.street, p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  var phone = formatPhone_(p.phone);

  var rows = [
    ['Reference', id],
    ['Submitted', Utilities.formatDate(new Date(), TZ, 'EEE, MMM d, yyyy h:mm a')],
    ['Name', p.name],
    ['Phone', phone],
    ['Email', p.email],
    ['Address', address],
    ['Insurance company', p.insurer],
    ['Policy #', p.policy_number],
    ['VIN', p.vin ? p.vin + (p.vin_source === 'decoded' ? ' (looked up)' : '') : ''],
    ['Vehicle', vehicleLabel_(p)],
    ['Car will be at', repairLocationText_(p)],
    ['Notes', p.notes],
    ['Card photos', files.photoUrls.length ? files.photoUrls.length + ' attached, also in the folder' : 'none — get the card at the car'],
    ['Signed', [p.signed_at, p.auth_text_version ? 'terms ' + p.auth_text_version : ''].filter(Boolean).join(' · ')],
    ['Source', p.ref]
  ];

  var html = '<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111">' +
    '<h2 style="margin:0 0 4px;font-size:20px">New repair request</h2>' +
    '<p style="margin:0 0 12px;color:#555;font-size:13px">' + escapeHtml_(CUSTOMER_TEXT_NOTE) + '</p>' +
    '<table cellpadding="6" style="border-collapse:collapse">';
  rows.forEach(function (r) {
    var value = shownValue_(r[0], r[1]);
    var cell;
    if (r[0] === 'Phone' && p.phone) {
      cell = '<a href="sms:+1' + p.phone + '">' + escapeHtml_(phone) + '</a> (tap to text)';
    } else {
      cell = escapeHtml_(value).replace(/\n/g, '<br>');
    }
    html += '<tr><td style="color:#555;vertical-align:top;white-space:nowrap">' + escapeHtml_(r[0]) + '</td>' +
            '<td style="vertical-align:top"><b>' + cell + '</b></td></tr>';
  });
  html += '</table>' +
    '<p style="margin:16px 0 0">' +
    '<a href="' + ss.getUrl() + '">Open the Bullseye Customers sheet</a><br>' +
    '<a href="' + folder.getUrl() + '">Open this customer\'s folder</a> (photos and signature)<br>' +
    '<a href="' + files.signatureUrl + '">Signature</a>' +
    '</p></div>';

  var text = CUSTOMER_TEXT_NOTE + '\n\n' +
    rows.map(function (r) { return r[0] + ': ' + shownValue_(r[0], r[1]); }).join('\n') +
    '\n\nSheet: ' + ss.getUrl() + '\nFolder: ' + folder.getUrl() + '\nSignature: ' + files.signatureUrl;

  var options = { name: 'Bullseye Intake', htmlBody: html };
  if (cc) options.cc = cc;
  if (files.photoBlobs.length) options.attachments = files.photoBlobs;
  MailApp.sendEmail(to, subject, text, options);
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
function getOrCreateSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) return sheet;
  var first = ss.getSheets()[0];
  if (first && first.getLastRow() === 0 && first.getLastColumn() === 0) {
    first.setName(SHEET_NAME);
    return first;
  }
  return ss.insertSheet(SHEET_NAME, 0);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// What the email shows for one value: a dash for blank, and anything that looks like a link broken
// so it cannot be tapped by accident (http://evil.com becomes http[://]evil[.]com). A well-formed
// email address is left alone: tapping it only starts an email. The sheet keeps the original text.
function shownValue_(label, value) {
  if (!value) return '—';
  if (label === 'Email' && EMAIL_RE.test(value)) return value;
  return defang_(value);
}

function defang_(s) {
  return String(s)
    .replace(/:\/\//g, '[://]')
    .replace(/([A-Za-z0-9-])\.(?=[A-Za-z]{2,}\b)/g, '$1[.]');
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
