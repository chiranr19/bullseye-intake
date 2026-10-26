/* Backend tests for apps-script/Code.gs. Plain Node, nothing to install:
 *
 *   node tests/backend.test.js
 *
 * Code.gs is loaded into a sandbox with small fakes for the Google services it calls (Sheet, Drive,
 * Mail, Cache, Lock, Properties) and a fixed clock, then doPost() is driven end to end with real
 * request bodies. setup() is not covered here; run it in the Apps Script editor and read the log.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// CODE_GS lets a mutation check point the same tests at a deliberately broken copy.
const CODE = fs.readFileSync(process.env.CODE_GS || path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const SECRET = 'TestSecretTestSecretTestSecret12';
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPEG_LIKE = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(200, 7)]).toString('base64');
const NOT_IMAGE = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
const COL = { id: 1, name: 3, policy: 11, notes: 17 };   // 0-based positions in HEADERS

// A fixed clock that is deliberately not today, so a test can tell it is really in use.
const FIXED_NOW = Date.parse('2026-03-14T09:05:00-04:00');
class FixedDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(FIXED_NOW);
    else super(...args);
  }
  static now() { return FIXED_NOW; }
}
const iso = (offsetSeconds) => new Date(FIXED_NOW + offsetSeconds * 1000).toISOString();

// ---- Fakes for the Google services ---------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(d, tz, fmt) {
  assert.strictEqual(tz, 'America/Detroit');
  const o = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hour12: false, weekday: 'short', timeZoneName: 'short'
  }).formatToParts(new Date(d.getTime())).forEach((p) => { o[p.type] = p.value; });
  if (o.hour === '24') o.hour = '00';
  const h = Number(o.hour);
  switch (fmt) {
    case 'yyyyMMdd': return o.year + o.month + o.day;
    case 'yyyyMMddHH': return o.year + o.month + o.day + o.hour;
    case 'yyyy': return o.year;
    case 'yyyy-MM-dd HH:mm:ss z': return `${o.year}-${o.month}-${o.day} ${o.hour}:${o.minute}:${o.second} ${o.timeZoneName}`;
    case 'EEE, MMM d, yyyy h:mm a':
      return `${o.weekday}, ${MONTHS[Number(o.month) - 1]} ${Number(o.day)}, ${o.year} ${h % 12 || 12}:${o.minute} ${h < 12 ? 'AM' : 'PM'}`;
    default: throw new Error('formatDate pattern not faked: ' + fmt);
  }
}

function makeSheet(headers) {
  const rows = [headers.slice()];
  let maxRows = 1000;
  function range(r, c, nr, nc) {
    const values = () => {
      const out = [];
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const v = (rows[r - 1 + i] || [])[c - 1 + j];
        out.push(v == null ? '' : String(v));
      }
      return out;
    };
    return {
      createTextFinder(text) {
        let entire = false;
        let exactCase = false;
        const hit = (v) => {
          const a = exactCase ? v : v.toLowerCase();
          const b = exactCase ? text : text.toLowerCase();
          return entire ? a === b : a.includes(b);
        };
        const finder = {
          matchEntireCell(x) { entire = x; return finder; },
          matchCase(x) { exactCase = x; return finder; },
          findAll() { return values().filter(hit); },
          findNext() { return values().find(hit) || null; }
        };
        return finder;
      },
      setNumberFormats() { return this; },
      setValues(vals) {
        vals.forEach((rowVals, i) => {
          const target = rows[r - 1 + i] || (rows[r - 1 + i] = []);
          rowVals.forEach((v, j) => { target[c - 1 + j] = v; });
        });
        return this;
      }
    };
  }
  return {
    rows,
    getLastRow: () => rows.length,
    getMaxRows: () => maxRows,
    insertRowsAfter: (after, n) => { maxRows += n; },
    getRange: range
  };
}

function makeDrive() {
  const all = [];
  const roots = [];
  const files = [];
  const iter = (list) => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
  function folder(name) {
    const id = 'folder' + (all.length + 1);
    const children = [];
    const f = {
      name,
      isTrashed: () => false,
      getId: () => id,
      getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      getFoldersByName: (n) => iter(children.filter((c) => c.name === n)),
      createFolder: (n) => { const c = folder(n); children.push(c); return c; },
      createFile: (blobOrName, content, type) => {
        const file = typeof blobOrName === 'string'
          ? { name: blobOrName, content, type, folder: name }
          : { name: blobOrName.name, bytes: blobOrName.bytes, type: blobOrName.type, folder: name };
        files.push(file);
        return { getUrl: () => 'https://drive.google.com/file/d/file' + files.length };
      }
    };
    all.push(f);
    return f;
  }
  return {
    files,
    api: {
      getFolderById: (id) => { const f = all.find((x) => x.getId() === id); if (!f) throw new Error('no such folder'); return f; },
      getFoldersByName: (n) => iter(roots.filter((r) => r.name === n)),
      createFolder: (n) => { const f = folder(n); roots.push(f); return f; }
    }
  };
}

function makeEnv(extraProps) {
  const props = Object.assign({ FORM_SECRET: SECRET, NOTIFY_EMAIL: 'owner@example.test' }, extraProps || {});
  const cache = new Map();
  const mail = [];
  const logs = [];
  const drive = makeDrive();
  const say = (level) => (...a) => logs.push([level, a.join(' ')]);
  const sandbox = {
    Date: FixedDate,
    console: { log: say('log'), info: say('info'), warn: say('warn'), error: say('error') },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? String(props[k]) : null),
      setProperty: (k, v) => { props[k] = v; }
    }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (cache.has(k) ? cache.get(k) : null),
      getAll: (keys) => { const o = {}; keys.forEach((k) => { if (cache.has(k)) o[k] = cache.get(k); }); return o; },
      put: (k, v) => { cache.set(k, String(v)); }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: drive.api,
    MailApp: { sendEmail: (to, subject, text, options) => mail.push({ to, subject, text, options }) },
    Utilities: {
      formatDate,
      base64Decode: (b64) => Array.from(Buffer.from(b64, 'base64')).map((b) => (b > 127 ? b - 256 : b)),
      newBlob: (bytes, type, name) => ({ bytes, type, name })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ s, setMimeType() { return this; } })
    },
    MimeType: { PLAIN_TEXT: 'text/plain' }
  };
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox, { filename: 'Code.gs' });
  const sheet = makeSheet(sandbox.HEADERS);
  sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({
    getSheetByName: (n) => (n === sandbox.SHEET_NAME ? sheet : null),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST'
  }) };
  return { sandbox, sheet, mail, logs, cache, drive };
}

function payload(over) {
  return Object.assign({
    secret: SECRET, website: '', ref: 'flyer', loaded_at: iso(-60), submitted_at: iso(0),
    name: 'Test Customer', phone: '8105550123', email: 'test@example.com',
    street: '1 Main St', city: 'Flint', state: 'MI', zip: '48503',
    insurer: 'State Farm', policy_number: 'ABC123', vin: '1HGCM82633A004352',
    year: '2003', make: 'Honda', model: 'Accord', vin_source: 'decoded',
    repair_location: 'same', repair_location_text: '', notes: 'gate code 1234',
    auth_text_version: 'v1', auth_text: 'I authorize Bullseye to repair the windshield.',
    signed_at: iso(-5), user_agent: 'node-test', submission_id: 'A'.repeat(24),
    photos: [{ name: 'card-1.jpg', type: 'image/jpeg', data: JPEG_LIKE }],
    signature: { type: 'image/png', data: PNG_1PX }
  }, over || {});
}
function post(env, body) {
  const out = env.sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
  return JSON.parse(out.s);
}
const logged = (env, text, level) => env.logs.some((l) => (!level || l[0] === level) && l[1].includes(text));

// ---- Tests ---------------------------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('test_cleanText_strips_invisible_chars_and_keeps_line_breaks_only_in_notes', () => {
  const s = makeEnv().sandbox;
  assert.strictEqual(s.cleanText_('Jo\u200Bhn\u202E \u{E0049}\u{E0047}Doe', 120, false), 'John Doe');
  assert.strictEqual(s.cleanText_('line one\r\nline two\u2066', 500, true), 'line one\nline two');
  assert.strictEqual(s.cleanText_('a\nb\tc', 50, false), 'a b c');
  assert.strictEqual(s.cleanText_(42, 10, false), '');
});

test('test_defang_breaks_links_and_leaves_ordinary_text_alone', () => {
  const s = makeEnv().sandbox;
  assert.strictEqual(s.defang_('pay at http://evil.com/x now'), 'pay at http[://]evil[.]com/x now');
  assert.strictEqual(s.defang_('www.evil.co.uk'), 'www[.]evil[.]co[.]uk');
  assert.strictEqual(s.defang_('2.5L engine, Mr. Smith, e.g. this'), '2.5L engine, Mr. Smith, e.g. this');
});

test('test_shownValue_keeps_a_real_email_and_breaks_a_fake_one', () => {
  const s = makeEnv().sandbox;
  assert.strictEqual(s.shownValue_('Email', 'jane@example.com'), 'jane@example.com');
  assert.strictEqual(s.shownValue_('Email', 'http://evil.com'), 'http[://]evil[.]com');
  assert.strictEqual(s.shownValue_('Notes', ''), '—');
});

test('test_sniffImageType_goes_by_the_first_bytes', () => {
  const s = makeEnv().sandbox;
  const signed = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
  assert.strictEqual(s.sniffImageType_(signed([0xFF, 0xD8, 0xFF, 0xE0])), 'image/jpeg');
  assert.strictEqual(s.sniffImageType_(signed(Buffer.from(PNG_1PX, 'base64'))), 'image/png');
  assert.strictEqual(s.sniffImageType_(signed(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))), 'image/webp');
  assert.strictEqual(s.sniffImageType_(signed(Buffer.from('GIF89a'))), '');
  assert.strictEqual(s.sniffImageType_([]), '');
});

test('test_doPost_good_form_makes_one_row_one_folder_one_email_and_an_audit_record', () => {
  const env = makeEnv();
  const r = post(env, payload({ name: 'Jane\u200B Doe', notes: 'call me http://evil.com\nthanks' }));
  assert.strictEqual(r.ok, true);
  assert.match(r.id, /^BW-20260314-[A-Z2-9]{4}$/);                            // the fixed clock's date
  assert.strictEqual(env.sheet.rows.length, 2);
  const row = env.sheet.rows[1];
  assert.strictEqual(row[COL.id], r.id);
  assert.strictEqual(row[COL.name], 'Jane Doe');
  assert.strictEqual(row[COL.notes], 'call me http://evil.com\nthanks');       // the sheet keeps the original
  assert.strictEqual(env.mail.length, 1);
  const m = env.mail[0];
  assert.strictEqual(m.subject, 'New repair: Jane Doe — 2003 Honda Accord — State Farm');
  assert.ok(m.options.htmlBody.includes('http[://]evil[.]com'));
  assert.ok(!m.options.htmlBody.includes('http://evil.com'));
  assert.ok(m.options.htmlBody.includes('ignore it.'));
  assert.ok(m.text.startsWith('The details in this table'));
  assert.ok(m.text.includes('Submitted: Sat, Mar 14, 2026 9:05 AM'));
  assert.ok(m.text.includes('Email: test@example.com'));
  assert.strictEqual(m.options.attachments.length, 1);
  const details = env.drive.files.find((f) => f.name === 'details.txt');
  assert.ok(details.content.includes('Received at (server): 2026-03-14 09:05:00 EDT'));
  assert.ok(details.content.includes('Authorization wording shown on the page:\nI authorize Bullseye'));
  assert.ok(details.content.includes('Submission ID: ' + 'A'.repeat(24)));
  assert.strictEqual(env.drive.files.find((f) => f.name === 'signature.png').type, 'image/png');
  assert.strictEqual(env.drive.files.find((f) => f.name === 'card-1.jpg').type, 'image/jpeg');
});

test('test_doPost_resend_with_same_submission_id_returns_the_first_id_and_saves_nothing', () => {
  const env = makeEnv();
  const a = post(env, payload());
  const b = post(env, payload({ submitted_at: iso(1) }));
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.id, a.id);
  assert.strictEqual(env.sheet.rows.length, 2);
  assert.strictEqual(env.mail.length, 1);
  assert.ok(logged(env, 'Resend of ' + a.id, 'info'));
  const c = post(env, payload({ submission_id: 'B'.repeat(24) }));
  assert.notStrictEqual(c.id, a.id);
  assert.strictEqual(env.sheet.rows.length, 3);
});

test('test_doPost_same_submission_id_with_a_different_phone_is_saved_as_a_new_form', () => {
  const env = makeEnv();
  const a = post(env, payload());
  const b = post(env, payload({ name: 'Next Customer', phone: '8105550999' }));
  assert.strictEqual(b.ok, true);
  assert.notStrictEqual(b.id, a.id);
  assert.strictEqual(env.sheet.rows.length, 3);
  assert.strictEqual(env.sheet.rows[2][COL.name], 'Next Customer');
  assert.ok(logged(env, 'reused with a different phone', 'warn'));
  assert.ok(!logged(env, '8105550999'));                                    // the phone is never logged
});

test('test_doPost_malformed_submission_id_is_ignored_not_trusted', () => {
  const env = makeEnv();
  const a = post(env, payload({ submission_id: 'short' }));
  const b = post(env, payload({ submission_id: 'short' }));
  assert.strictEqual(a.ok && b.ok, true);
  assert.notStrictEqual(a.id, b.id);
  assert.strictEqual(env.sheet.rows.length, 3);
});

test('test_doPost_refuses_files_that_are_not_images_and_a_non_png_signature', () => {
  const env = makeEnv();
  assert.strictEqual(post(env, payload({ photos: [{ type: 'image/jpeg', data: NOT_IMAGE }] })).ok, false);
  assert.strictEqual(post(env, payload({ signature: { type: 'image/png', data: JPEG_LIKE } })).ok, false);
  assert.ok(logged(env, 'card file is not an image', 'warn'));
  assert.ok(logged(env, 'signature file is image/jpeg, expected image/png', 'warn'));
  assert.strictEqual(env.sheet.rows.length, 1);
  assert.strictEqual(env.mail.length, 0);
});

test('test_doPost_refuses_a_photo_over_600kb_before_decoding_it', () => {
  const env = makeEnv();
  const big = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(700 * 1024)]).toString('base64');
  assert.strictEqual(post(env, payload({ photos: [{ type: 'image/jpeg', data: big }] })).ok, false);
  assert.ok(logged(env, 'card file too large', 'warn'));
  assert.strictEqual(env.sheet.rows.length, 1);
});

test('test_doPost_daily_cap_stops_a_flood_and_later_requests_stop_at_the_precheck', () => {
  const env = makeEnv({ MAX_PER_DAY: '3' });
  for (let i = 0; i < 3; i++) assert.strictEqual(post(env, payload({ submission_id: 'D' + String(i).repeat(23) })).ok, true);
  const r = post(env, payload({ submission_id: 'E'.repeat(24) }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, env.sandbox.USER_ERROR);                        // the customer sees the usual message
  assert.ok(logged(env, 'daily cap reached (pre-check): 3', 'warn'));
  env.cache.clear();                                                         // cache evicted: the sheet still counts
  assert.strictEqual(post(env, payload({ submission_id: 'F'.repeat(24) })).ok, false);
  assert.ok(logged(env, 'daily cap reached: hour=0 day=3', 'warn'));
  assert.strictEqual(env.sheet.rows.length, 4);
  assert.strictEqual(env.mail.length, 3);
});

test('test_doPost_hourly_cap', () => {
  const env = makeEnv({ MAX_PER_HOUR: '2' });
  assert.strictEqual(post(env, payload({ submission_id: 'G'.repeat(24) })).ok, true);
  assert.strictEqual(post(env, payload({ submission_id: 'H'.repeat(24) })).ok, true);
  assert.strictEqual(post(env, payload({ submission_id: 'J'.repeat(24) })).ok, false);
  assert.ok(logged(env, 'hourly cap reached (pre-check): 2', 'warn'));
  assert.ok(env.cache.has('cap:h:2026031409'));                              // the fixed clock's hour
});

test('test_doPost_resend_after_the_cap_still_gets_its_id_back', () => {
  const env = makeEnv({ MAX_PER_DAY: '1' });
  const a = post(env, payload());
  const b = post(env, payload());
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.id, a.id);
});

test('test_doPost_original_spam_checks_still_hold', () => {
  const env = makeEnv();
  assert.strictEqual(post(env, payload({ secret: 'nope' })).ok, false);
  assert.strictEqual(post(env, payload({ website: 'http://spam.example' })).ok, false);
  assert.strictEqual(post(env, payload({ loaded_at: iso(-1) })).ok, false);
  assert.strictEqual(post(env, 'not json').ok, false);
  assert.strictEqual(post(env, payload({ notes: 'x'.repeat(3 * 1024 * 1024) })).ok, false);
  assert.ok(logged(env, 'secret mismatch') && logged(env, 'honeypot filled') && logged(env, 'too fast'));
  assert.ok(logged(env, 'invalid JSON') && logged(env, 'body too large'));
  assert.strictEqual(env.sheet.rows.length, 1);
  assert.strictEqual(env.mail.length, 0);
});

test('test_doPost_stores_formula_like_customer_text_as_text', () => {
  const env = makeEnv();
  assert.strictEqual(post(env, payload({ notes: '=HYPERLINK("http://evil.com","x")', policy_number: '+1234' })).ok, true);
  const row = env.sheet.rows[1];
  assert.strictEqual(row[COL.notes], '\'=HYPERLINK("http://evil.com","x")');
  assert.strictEqual(row[COL.policy], "'+1234");
});

test('test_doPost_older_page_without_auth_text_or_submission_id_still_works', () => {
  const env = makeEnv();
  const p = payload();
  delete p.auth_text;
  delete p.submission_id;
  assert.strictEqual(post(env, p).ok, true);
  const details = env.drive.files.find((f) => f.name === 'details.txt').content;
  assert.ok(details.includes('(not sent by this version of the page)'));
  assert.ok(details.includes('Submission ID: -'));
});

test('test_doPost_broken_cache_never_turns_away_a_real_customer', () => {
  const env = makeEnv();
  const down = () => { throw new Error('cache down'); };
  env.sandbox.CacheService = { getScriptCache: () => ({ get: down, getAll: down, put: down }) };
  assert.strictEqual(post(env, payload()).ok, true);
  assert.ok(logged(env, 'cache down', 'warn'));
  assert.strictEqual(env.sheet.rows.length, 2);
});

test('test_source_files_contain_no_invisible_or_text_direction_characters', () => {
  // Hidden characters in source can make code read differently than it runs ("Trojan Source").
  // Compared as code points (9 tab, 10 newline, 13 carriage return), so no escapes are needed here.
  const ranges = [[0x00, 0x08], [0x0B, 0x0C], [0x0E, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x34F, 0x34F],
    [0x61C, 0x61C], [0x180B, 0x180F], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x206F],
    [0xFE00, 0xFE0F], [0xFEFF, 0xFEFF], [0xE0000, 0xE007F], [0xE0100, 0xE01EF]];
  const files = ['apps-script/Code.gs', 'apps-script/appsscript.json', 'assets/app.js', 'assets/style.css',
    'config.js', 'index.html', 'guide.html', 'tests/backend.test.js'];
  for (const f of files) {
    const text = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    let line = 1;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === 10) { line += 1; continue; }
      if (cp !== 9 && cp !== 13 && ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) {
        assert.fail(f + ':' + line + ' contains invisible character U+' + cp.toString(16).toUpperCase());
      }
    }
  }
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL ' + name + '\n     ' + String((e && e.stack) || e).split('\n').slice(0, 3).join('\n     '));
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
