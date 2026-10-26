/* Bullseye Intake — all form logic. Vanilla JS (ES2017), no build step.
 *
 * Reads window.CONFIG (config.js) and window.SignaturePad (vendor/signature_pad.min.js).
 * Sections, in order: copy · constants · state · boot · config fill · ref tag · phone/zip ·
 * photos · VIN · signature · drafts · validation · submit · thank-you · SMS fallback · helpers.
 */
(function () {
  'use strict';

  // ---- Every string a customer can read that is not already in index.html -----------------
  var COPY = {
    needName: 'Add your name',
    needPhone: 'Add your mobile number',
    phoneShort: 'Enter a 10-digit mobile number',
    needSig: 'Please sign above',
    sigUnavailable: "The signature box didn't load. Text Russell your info instead — he'll get your signature at the car.",
    photoLimit: 'You can add up to 2 photos. Remove one to add another.',
    photoWorking: 'Shrinking photo…',
    photoBad: "Couldn't read that photo. Try another one, or skip it.",
    photoAlt: function (n) { return 'Insurance card photo ' + n; },
    photoRemove: function (n) { return 'Remove photo ' + n; },
    vinBadChars: 'VINs never contain I, O, or Q',
    vinCheck: 'Double-check this VIN — one character may be off',
    vinLooking: 'Looking up your vehicle…',
    vinFound: function (ymm) { return '✓ ' + ymm; },
    vinNotRight: 'not right?',
    vinNotFound: "Couldn't look that up. Type the year, make and model below.",
    sending: 'Sending…',
    sendingPhoto: 'Sending photo…',
    send: 'Send to Russell',
    retry: 'Retry',
    sendFailed: "Couldn't send. Check your signal and try again.",
    sent: 'Sent. Russell will text you to confirm a time.',
    carUnknown: 'my car',
    smsAfterSend: function (name, car, id) {
      return 'Hi Russell, I just sent my info for a chip repair — ' + name + ', ' + car + '. Ref ' + id + '.';
    },
    smsFallbackIntro: "Hi Russell, the form couldn't send, so here's my info for a chip repair:",
    summaryName: 'Name',
    summaryPhone: 'Phone',
    summaryVehicle: 'Vehicle',
    summaryInsurer: 'Insurance',
    locSame: 'my address above',
    vcardName: 'Russell – Bullseye Windshield Repair',
    vcardNote: 'Text only',
    vcardFile: 'Russell-Bullseye-Windshield.vcf'
  };

  // ---- Constants ------------------------------------------------------------------------
  var CONFIG = window.CONFIG || {};
  var DRAFT_KEY = 'bullseye_draft_v1';
  var PHONE_DIGITS = 10;
  var MAX_PHOTOS = 2;
  var PHOTO_TARGET_BYTES = 300 * 1024;
  // [long edge px, JPEG quality], tried in order until the photo is <= 300 KB. The last two steps only
  // run for unusually noisy photos; they keep every photo well under the server's 600 KB ceiling.
  var PHOTO_STEPS = [[1600, 0.75], [1600, 0.6], [1280, 0.6], [1024, 0.5], [800, 0.5]];
  var DECODE_WAIT_MS = 1500;             // longest we wait for img.decode() before drawing anyway
  var PHOTO_WAIT_MS = 20000;             // longest Send waits for a photo still shrinking (photos are optional)
  var VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  var VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  var VIN_LETTERS = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
                      S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  var MAKE_KEEP_CAPS = { BMW: 1, GMC: 1, MG: 1, AMC: 1 };
  var NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
  var VIN_DEBOUNCE_MS = 400;
  var VIN_TIMEOUT_MS = 6000;
  var SEND_TIMEOUT_MS = 30000;
  var SEND_TIMEOUT_RETRY_MS = 60000;     // a retry on one bar of signal gets longer to finish
  var MIN_FILL_MS = 3500;                // the server rejects sends < 3 s after load as bots; wait it out
  var MOCK_DELAY_MS = 1500;
  var ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var DRAFT_FIELDS = ['name', 'phone', 'email', 'street', 'city', 'state', 'zip', 'insurer', 'policy_number',
                      'vin', 'year', 'make', 'model', 'repair_location', 'repair_location_text', 'notes'];
  var DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;      // a customer's own phone: pick up where they left off
  var DRAFT_MAX_AGE_SHARED_MS = 15 * 60 * 1000;    // Russell's phone is handed from customer to customer
  var SHARED_DEVICE_REF = 'russell';               // ?ref=russell is the link Russell opens on his own phone
  var SUBMISSION_ID_RE = /^[A-Za-z0-9]{16,40}$/;

  // ---- State ----------------------------------------------------------------------------
  var state = {
    loadedAt: new Date(),
    ref: 'direct',
    photos: [],            // [{ type, dataUrl, bytes }]
    photoBusy: null,       // promise of a photo still being shrunk, or null
    phonePrev: '',         // digits in the phone field after the last input event
    vinDecoded: null,      // { year, make, model } from NHTSA, or null
    vinRequest: null,      // AbortController of the in-flight decode
    sigPad: null,
    sigWidth: 0,
    signedAt: null,        // Date of the last signature stroke
    submitting: false,
    sent: false,           // true once the server confirmed; nothing may save a draft after that
    failures: 0,
    photoTimer: null,
    submissionId: ''       // random per form fill; the same on a retry, so the server can spot a repeat
  };

  var el = {};
  ['intake', 'ref', 'hp', 'name', 'phone', 'email', 'street', 'city', 'state', 'zip',
   'err-name', 'err-phone', 'err-sig',
   'photo-camera-btn', 'photo-pick-btn', 'photo-camera', 'photo-pick', 'photo-list', 'photo-msg',
   'insurer', 'insurers', 'policy_number',
   'vin', 'vin-warn', 'vin-status', 'vin-manual', 'vin-manual-wrap', 'ymm', 'year', 'make', 'model',
   'loc-other-wrap', 'repair_location_text', 'notes',
   'auth-text', 'sig', 'sig-wrap', 'sig-clear',
   'draft-banner', 'start-over', 'status', 'test-mode',
   'bar', 'send', 'send-msg', 'fallback', 'text-instead',
   'thanks', 'thanks-h', 'ref-code', 'summary', 'text-russell', 'save-contact'
  ].forEach(function (id) { el[camel(id)] = document.getElementById(id); });

  // ---- Boot -----------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    fillFromConfig();
    initPhone();
    initZip();
    initInsurers();
    initPhotos();
    initVin();
    initRepairLocation();
    initSignature();
    initDrafts();          // restores a draft; also settles state.ref
    initSubmit();
    initBarSpacing();
    updateSubmitState();
  }

  // ---- Config fill: business name, phone links, authorization text, insurer list -----------
  function fillFromConfig() {
    var e164 = String(CONFIG.OWNER_PHONE_E164 || '');
    var display = String(CONFIG.OWNER_PHONE_DISPLAY || '');
    setAll('[data-fill="business"]', CONFIG.BUSINESS_NAME);
    setAll('[data-fill="owner"]', CONFIG.OWNER_NAME);
    setAll('[data-fill="phone"]', display);
    if (e164) {
      each(document.querySelectorAll('[data-link="sms"]'), function (a) { a.href = 'sms:' + e164; });
    }
    if (el.authText) el.authText.textContent = String(CONFIG.AUTH_TEXT || '');
    // Anything other than an explicit false means sends are faked: say so on the page.
    if (el.testMode) el.testMode.hidden = CONFIG.MOCK_SUBMIT === false;
  }

  function initInsurers() {
    if (!el.insurers || !Array.isArray(CONFIG.INSURERS)) return;
    CONFIG.INSURERS.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = String(name);
      el.insurers.appendChild(opt);
    });
  }

  // ---- Ref tag (?ref=flyer|truck|text|web|russell → else "direct") -----------------------
  function refFromUrl() {
    var raw = '';
    try { raw = new URLSearchParams(window.location.search).get('ref') || ''; } catch (e) { raw = ''; }
    return allowedRef(raw);
  }

  // Only the sources listed in config.js count; anything else (a typo, a tampered link or draft) is ''.
  function allowedRef(value) {
    var v = typeof value === 'string' ? value.trim().toLowerCase() : '';
    var allowed = Array.isArray(CONFIG.REF_SOURCES) ? CONFIG.REF_SOURCES : [];
    return allowed.indexOf(v) !== -1 ? v : '';
  }

  function setRef(value) {
    state.ref = value || 'direct';
    if (el.ref) el.ref.value = state.ref;
  }

  // ---- Phone and ZIP ----------------------------------------------------------------------
  function phoneDigits(str) {
    var d = String(str || '').replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d.slice(0, PHONE_DIGITS);
  }

  function formatPhone(d) {
    if (d.length < 4) return d;
    if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  function initPhone() {
    el.phone.addEventListener('input', function (e) {
      var d = phoneDigits(el.phone.value);
      // Backspacing over ")" or "-" removes no digit; take the digit before it so the key does something.
      if (e && e.inputType === 'deleteContentBackward' && d === state.phonePrev && d.length) d = d.slice(0, -1);
      state.phonePrev = d;
      el.phone.value = formatPhone(d);
      clearError(el.phone, el.errPhone);
      updateSubmitState();
    });
  }

  function initZip() {
    el.zip.addEventListener('input', function () {
      var v = el.zip.value.replace(/\D/g, '').slice(0, 5);
      if (v !== el.zip.value) el.zip.value = v;
    });
  }

  // ---- Photos: camera or picker → shrink on the phone → thumbnail with remove -------------
  function initPhotos() {
    el.photoCameraBtn.addEventListener('click', function () { el.photoCamera.click(); });
    el.photoPickBtn.addEventListener('click', function () { el.photoPick.click(); });
    el.photoCamera.addEventListener('change', onPhotoChosen);
    el.photoPick.addEventListener('change', onPhotoChosen);
    el.photoList.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-index]');
      if (!btn) return;
      state.photos.splice(Number(btn.getAttribute('data-index')), 1);
      renderPhotos();
      setPhotoMsg('');
    });
  }

  function onPhotoChosen(e) {
    var input = e.target;
    var file = input.files && input.files[0];
    input.value = ''; // so the same photo can be chosen again after a remove
    if (!file) return;
    if (state.photos.length >= MAX_PHOTOS) { setPhotoMsg(COPY.photoLimit, 'err'); return; }
    if (file.type && !/^image\//.test(file.type)) { setPhotoMsg(COPY.photoBad, 'err'); return; }

    setPhotoMsg(COPY.photoWorking);
    setPhotoButtons(false);
    var job = compressImage(file).then(function (photo) {
      if (state.photos.length >= MAX_PHOTOS) { setPhotoMsg(COPY.photoLimit, 'err'); return; }
      state.photos.push(photo);
      renderPhotos();
      setPhotoMsg('');
    }).catch(function (err) {
      console.error('photo failed', err && err.message);
      setPhotoMsg(COPY.photoBad, 'err');
    }).then(function () {
      setPhotoButtons(true);
      if (state.photoBusy === job) state.photoBusy = null;
    });
    state.photoBusy = job; // trySubmit waits for this so a photo picked last is not dropped
  }

  function setPhotoButtons(enabled) {
    el.photoCameraBtn.disabled = !enabled;
    el.photoPickBtn.disabled = !enabled;
  }

  function setPhotoMsg(text, kind) {
    el.photoMsg.textContent = text || '';
    el.photoMsg.className = 'hint pad' + (kind === 'err' ? ' err' : '');
  }

  function renderPhotos() {
    el.photoList.textContent = '';
    state.photos.forEach(function (p, i) {
      var li = document.createElement('li');
      var img = document.createElement('img');
      img.src = p.dataUrl;
      img.alt = COPY.photoAlt(i + 1);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-index', String(i));
      btn.setAttribute('aria-label', COPY.photoRemove(i + 1));
      btn.textContent = '✕';
      li.appendChild(img);
      li.appendChild(btn);
      el.photoList.appendChild(li);
    });
  }

  // Draw the photo to a canvas at ≤ 1600px on the long edge and re-encode as JPEG, stepping
  // down quality and size (PHOTO_STEPS) until it is ≤ 300 KB. Modern browsers honor EXIF
  // orientation when drawing an <img>, so portrait shots come out upright.
  function compressImage(file) {
    return loadImage(file).then(function (img) {
      var canvas = document.createElement('canvas');
      try {
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('image has no size');
        var ctx = canvas.getContext('2d');
        var dataUrl = '';
        var bytes = Infinity;
        for (var i = 0; i < PHOTO_STEPS.length; i++) {
          var dims = fitWithin(img.naturalWidth, img.naturalHeight, PHOTO_STEPS[i][0]);
          canvas.width = dims.w;
          canvas.height = dims.h;
          ctx.fillStyle = '#fff'; // transparent screenshots get a white background instead of black
          ctx.fillRect(0, 0, dims.w, dims.h);
          ctx.drawImage(img, 0, 0, dims.w, dims.h);
          dataUrl = canvas.toDataURL('image/jpeg', PHOTO_STEPS[i][1]);
          bytes = dataUrlBytes(dataUrl);
          if (bytes <= PHOTO_TARGET_BYTES) break;
        }
        if (!dataUrl || dataUrl.indexOf('data:image/jpeg') !== 0) throw new Error('encode failed');
        return { type: 'image/jpeg', dataUrl: dataUrl, bytes: bytes };
      } finally {
        if (img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src);
        canvas.width = canvas.height = 0;
      }
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      var done = false;
      function ok() { if (!done) { done = true; resolve(img); } }
      function fail() { if (!done) { done = true; URL.revokeObjectURL(url); reject(new Error('decode failed')); } }
      img.onload = function () {
        // decode() pre-decodes off the main thread, but its promise waits for a paint and can stall
        // for as long as the page is not painting. The image is loaded either way, so go on after
        // a short wait at the latest; drawImage decodes on the spot if needed.
        if (typeof img.decode === 'function') {
          img.decode().then(ok, ok);
          setTimeout(ok, DECODE_WAIT_MS);
        } else {
          ok();
        }
      };
      img.onerror = fail;
      img.src = url;
    });
  }

  // ---- VIN: clean as typed, check digit, NHTSA decode with debounce/abort/timeout -----------
  function initVin() {
    var scheduleDecode = debounce(decodeVin, VIN_DEBOUNCE_MS);

    el.vin.addEventListener('input', function () {
      var cleaned = el.vin.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
      if (cleaned !== el.vin.value) el.vin.value = cleaned;
      cancelVinRequest();
      dropDecodedIfUntouched();
      setVinStatus('');
      if (/[IOQ]/.test(cleaned)) { setVinWarn(COPY.vinBadChars, 'err'); return; }
      setVinWarn('');
      if (cleaned.length < 17 || !VIN_RE.test(cleaned)) return;
      if (!vinCheckDigitOk(cleaned)) setVinWarn(COPY.vinCheck);
      setVinStatus(COPY.vinLooking, 'muted');
      scheduleDecode(cleaned);
    });

    el.vinManual.addEventListener('click', function () { showManualFields(true); });
    el.vinStatus.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'vin-not-right') showManualFields(true);
    });
  }

  function vinCheckDigitOk(vin) {
    var sum = 0;
    for (var i = 0; i < 17; i++) {
      var ch = vin.charAt(i);
      var val = /[0-9]/.test(ch) ? Number(ch) : VIN_LETTERS[ch];
      if (val === undefined) return false;
      sum += val * VIN_WEIGHTS[i];
    }
    var check = sum % 11;
    return vin.charAt(8) === (check === 10 ? 'X' : String(check));
  }

  function cancelVinRequest() {
    if (state.vinRequest) { state.vinRequest.abort(); state.vinRequest = null; }
  }

  function decodeVin(vin) {
    cancelVinRequest();
    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') {
      setVinStatus(COPY.vinNotFound, 'muted');
      showManualFields(false);
      return;
    }
    var ctrl = new AbortController();
    state.vinRequest = ctrl;
    var timer = setTimeout(function () { ctrl.abort(); }, VIN_TIMEOUT_MS);

    // No cookies and no referrer: NHTSA learns the VIN and nothing else about the customer.
    fetch(NHTSA_URL + encodeURIComponent(vin) + '?format=json',
      { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var r = (data && data.Results && data.Results[0]) || {};
        var year = apiText(r.ModelYear, 4);
        var make = titleCaseMake(apiText(r.Make, 40));
        var model = apiText(r.Model, 40);
        if (!/^(19|20)\d{2}$/.test(year) || !make || !model) throw new Error('incomplete decode');
        if (el.vin.value !== vin) return;
        applyDecoded({ year: year, make: make, model: model });
      })
      .catch(function (err) {
        if (state.vinRequest !== ctrl) return;        // superseded by a newer keystroke
        if (el.vin.value !== vin) return;
        console.info('VIN decode unavailable:', err && err.message);
        setVinStatus(COPY.vinNotFound, 'muted');       // a hint, not an error: typing the car is fine
        showManualFields(false);                       // no focus jump
      })
      .then(function () {
        clearTimeout(timer);
        if (state.vinRequest === ctrl) state.vinRequest = null;
      });
  }

  function applyDecoded(d) {
    state.vinDecoded = d;
    el.year.value = d.year;
    el.make.value = d.make;
    el.model.value = d.model;
    renderDecodedStatus(d);
    saveDraftSoon();
  }

  function renderDecodedStatus(d) {
    el.vinStatus.textContent = '';
    el.vinStatus.className = 'msg-ok';
    el.vinStatus.hidden = false;
    el.vinStatus.appendChild(document.createTextNode(COPY.vinFound(d.year + ' ' + d.make + ' ' + d.model) + ' '));
    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'link small';
    link.id = 'vin-not-right';
    link.textContent = COPY.vinNotRight;
    el.vinStatus.appendChild(link);
  }

  // If the user edits the VIN after a decode, drop the decoded year/make/model — unless they
  // changed those fields themselves, in which case the typed values are theirs to keep.
  function dropDecodedIfUntouched() {
    var d = state.vinDecoded;
    if (!d) return;
    if (el.year.value === d.year && el.make.value === d.make && el.model.value === d.model) {
      el.year.value = el.make.value = el.model.value = '';
    }
    state.vinDecoded = null;
  }

  function vinSource() {
    var d = state.vinDecoded;
    if (d && el.year.value === d.year && el.make.value === d.make && el.model.value === d.model) return 'decoded';
    if (el.year.value.trim() || el.make.value.trim() || el.model.value.trim()) return 'manual';
    return 'none';
  }

  function showManualFields(focus) {
    var wasHidden = el.ymm.hidden;
    el.ymm.hidden = false;
    el.vinManualWrap.hidden = true;
    if (focus && wasHidden) el.year.focus({ preventScroll: false });
  }

  function setVinWarn(text, kind) {
    el.vinWarn.textContent = text || '';
    el.vinWarn.className = kind === 'err' ? 'err' : 'msg-warn';
    el.vinWarn.hidden = !text;
  }

  function setVinStatus(text, kind) {
    el.vinStatus.textContent = text || '';
    el.vinStatus.className = kind === 'ok' ? 'msg-ok' : 'msg-muted';
    el.vinStatus.hidden = !text;
  }

  function titleCaseMake(s) {
    if (!s) return '';
    if (MAKE_KEEP_CAPS[s.toUpperCase()]) return s.toUpperCase();
    return s.toLowerCase().replace(/(^|[\s\-\/])([a-z])/g, function (m, sep, c) { return sep + c.toUpperCase(); });
  }

  // ---- Repair location ---------------------------------------------------------------------
  function initRepairLocation() {
    each(el.intake.querySelectorAll('input[name="repair_location"]'), function (radio) {
      radio.addEventListener('change', function () {
        syncRepairLocation();
        if (radio.value === 'other' && radio.checked) el.repairLocationText.focus();
      });
    });
  }

  function syncRepairLocation() {
    var other = el.intake.querySelector('input[name="repair_location"]:checked');
    el.locOtherWrap.hidden = !(other && other.value === 'other');
  }

  // ---- Signature ----------------------------------------------------------------------------
  function initSignature() {
    if (typeof window.SignaturePad !== 'function') {
      // vendor/signature_pad.min.js did not arrive (bad signal). Signing is required, so give a way out.
      console.error('signature_pad did not load');
      el.errSig.textContent = COPY.sigUnavailable;
      el.errSig.hidden = false;
      el.fallback.hidden = false;
      return;
    }
    // White, not transparent: a transparent PNG shows black ink on black in dark viewers (Drive's
    // preview, a phone in dark mode), and the signature looks blank.
    state.sigPad = new window.SignaturePad(el.sig, {
      penColor: '#000', backgroundColor: 'rgb(255,255,255)', minWidth: 1, maxWidth: 2.5, throttle: 8
    });
    resizeSignature();
    window.addEventListener('resize', debounce(resizeSignature, 150));
    window.addEventListener('orientationchange', function () { setTimeout(resizeSignature, 300); });
    state.sigPad.addEventListener('endStroke', function () {
      state.signedAt = new Date();
      clearError(el.sigWrap, el.errSig);
      saveDraftSoon();
      updateSubmitState();
    });
    el.sigClear.addEventListener('click', function () {
      state.sigPad.clear();
      state.signedAt = null;
      saveDraftSoon();
      updateSubmitState();
    });
  }

  // Size the backing store to the device pixel ratio so strokes are crisp, then redraw from
  // point data (which is in CSS pixels, so it survives a resize or a different pixel ratio).
  function resizeSignature() {
    if (!state.sigPad) return;
    var w = el.sig.offsetWidth;
    var h = el.sig.offsetHeight;
    if (!w || !h || w === state.sigWidth) return;
    state.sigWidth = w;
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var data = state.sigPad.toData();
    el.sig.width = Math.round(w * ratio);
    el.sig.height = Math.round(h * ratio);
    el.sig.getContext('2d').scale(ratio, ratio);
    state.sigPad.clear();
    if (data && data.length) state.sigPad.fromData(data);
  }

  function signatureEmpty() {
    return !state.sigPad || state.sigPad.isEmpty();
  }

  // ---- Drafts (localStorage) --------------------------------------------------------------
  var saveDraftSoon = debounce(saveDraft, 300);

  function initDrafts() {
    var urlRef = refFromUrl();
    var draft = loadDraft();
    if (draft && draftExpired(draft, urlRef)) { clearDraft(); draft = null; }
    state.submissionId = draft && SUBMISSION_ID_RE.test(String(draft.sid || '')) ? draft.sid : newSubmissionId();
    var restored = draft ? restoreDraft(draft) : false;
    setRef(urlRef || allowedRef(draft && draft.ref) || 'direct');
    if (restored) {
      el.draftBanner.hidden = false;
      saveDraft(); // re-save so the settled ref is recorded
    }
    el.intake.addEventListener('input', saveDraftSoon);
    el.intake.addEventListener('change', saveDraftSoon);
    el.startOver.addEventListener('click', startOver);
  }

  function readForm() {
    var f = {};
    DRAFT_FIELDS.forEach(function (name) {
      if (name === 'repair_location') {
        var checked = el.intake.querySelector('input[name="repair_location"]:checked');
        f[name] = checked ? checked.value : 'same';
      } else if (name === 'phone') {
        f[name] = phoneDigits(el.phone.value);
      } else {
        var input = el[camel(name)];
        f[name] = input ? String(input.value || '').trim() : '';
      }
    });
    return f;
  }

  function saveDraft() {
    if (state.sent) return;   // a save still waiting on its debounce must not undo clearDraft()
    // The signature is never saved: whoever sends the form signs it, in this sitting.
    var data = {
      v: 2,
      ref: state.ref,
      sid: state.submissionId,
      fields: readForm(),
      vin_decoded: state.vinDecoded,
      saved_at: isoWithOffset(new Date())
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) {
      // Private mode or full storage: the form still works, it just won't remember.
    }
  }

  function loadDraft() {
    try {
      var raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return d && d.fields && typeof d.fields === 'object' ? d : null;
    } catch (e) {
      return null;
    }
  }

  function clearDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nothing to clear */ }
  }

  // Drafts hold a customer's details, so they do not live forever: a day on a customer's own phone,
  // 15 minutes on Russell's phone, where the next person holding it is a different customer.
  function draftExpired(d, urlRef) {
    var saved = Date.parse(d.saved_at);
    if (isNaN(saved)) return true;
    var shared = urlRef === SHARED_DEVICE_REF || d.ref === SHARED_DEVICE_REF;
    var age = Date.now() - saved;
    return age > (shared ? DRAFT_MAX_AGE_SHARED_MS : DRAFT_MAX_AGE_MS) || age < -5 * 60 * 1000;
  }

  function restoreDraft(d) {
    var any = false;
    DRAFT_FIELDS.forEach(function (name) {
      var v = d.fields[name];
      if (typeof v !== 'string' || !v) return;
      if (name === 'repair_location') {
        var radio = el.intake.querySelector('input[name="repair_location"][value="' + (v === 'other' ? 'other' : 'same') + '"]');
        if (radio) radio.checked = true;
        if (v === 'other') any = true;
      } else if (name === 'phone') {
        state.phonePrev = phoneDigits(v);
        el.phone.value = formatPhone(state.phonePrev);
        any = true;
      } else if (name === 'state') {
        el.state.value = v;
      } else {
        var input = el[camel(name)];
        if (input) { input.value = v; any = true; }
      }
    });
    syncRepairLocation();
    var dec = d.vin_decoded;
    var decValid = dec && typeof dec === 'object' &&
      typeof dec.year === 'string' && typeof dec.make === 'string' && typeof dec.model === 'string';
    if (decValid && el.vin.value && el.year.value === dec.year && el.make.value === dec.make && el.model.value === dec.model) {
      state.vinDecoded = dec;              // same VIN, same fields: no need to ask NHTSA again
      renderDecodedStatus(dec);
    } else if (el.year.value || el.make.value || el.model.value) {
      showManualFields(false);             // keep what they typed; a re-decode could overwrite a correction
    } else if (el.vin.value) {
      el.vin.dispatchEvent(new Event('input', { bubbles: true })); // re-check and decode
    }
    return any;
  }

  function startOver() {
    clearDraft();
    state.submissionId = newSubmissionId();
    el.intake.reset();
    state.photos = [];
    renderPhotos();
    setPhotoMsg('');
    if (state.sigPad) state.sigPad.clear();
    state.signedAt = null;
    state.vinDecoded = null;
    cancelVinRequest();
    setVinWarn('');
    setVinStatus('');
    el.ymm.hidden = true;
    el.vinManualWrap.hidden = false;
    syncRepairLocation();
    clearError(el.name, el.errName);
    clearError(el.phone, el.errPhone);
    clearError(el.sigWrap, el.errSig);
    el.draftBanner.hidden = true;
    state.failures = 0;
    el.send.textContent = COPY.send;
    el.sendMsg.hidden = true;
    el.sendMsg.textContent = '';
    el.fallback.hidden = true;
    setRef(refFromUrl() || 'direct');
    updateSubmitState();
    window.scrollTo(0, 0);
    el.name.focus({ preventScroll: true });
  }

  // ---- Validation: only name, phone and signature are required --------------------------------
  function firstMissing() {
    if (!el.name.value.trim()) return { field: el.name, err: el.errName, msg: COPY.needName, focus: true };
    var d = phoneDigits(el.phone.value);
    if (!d) return { field: el.phone, err: el.errPhone, msg: COPY.needPhone, focus: true };
    if (d.length !== PHONE_DIGITS) return { field: el.phone, err: el.errPhone, msg: COPY.phoneShort, focus: true };
    if (signatureEmpty()) return { field: el.sigWrap, err: el.errSig, msg: COPY.needSig, focus: false };
    return null;
  }

  function updateSubmitState() {
    if (state.submitting) return;
    el.send.setAttribute('aria-disabled', firstMissing() ? 'true' : 'false');
  }

  function showFieldError(miss) {
    miss.err.textContent = miss.msg;
    miss.err.hidden = false;
    miss.field.classList.add('invalid');
    if (miss.field.tagName === 'INPUT') miss.field.setAttribute('aria-invalid', 'true');
    miss.field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (miss.focus) setTimeout(function () { miss.field.focus({ preventScroll: true }); }, 350);
    announce(miss.msg);
  }

  function clearError(field, errEl) {
    field.classList.remove('invalid');
    field.removeAttribute('aria-invalid');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  }

  // ---- Submit ---------------------------------------------------------------------------------
  function initSubmit() {
    el.intake.addEventListener('submit', function (e) { e.preventDefault(); trySubmit(); });
    el.send.addEventListener('click', trySubmit);
    el.name.addEventListener('input', function () { clearError(el.name, el.errName); updateSubmitState(); });
    // Rebuild the fallback text right before it opens, in case fields changed after the failure.
    el.textInstead.addEventListener('click', function () { el.textInstead.href = smsLink(fallbackSmsBody()); });
  }

  function trySubmit() {
    if (state.submitting) return;
    var miss = firstMissing();
    if (miss) { showFieldError(miss); return; }

    state.submitting = true;
    setSendUi('sending');
    var sinceLoad = Date.now() - state.loadedAt.getTime();

    Promise.resolve()
      .then(function () {                                                  // a photo still shrinking
        return state.photoBusy ? Promise.race([state.photoBusy, sleep(PHOTO_WAIT_MS)]) : null;
      })
      .then(function () { return sleep(Math.max(0, MIN_FILL_MS - sinceLoad)); }) // restored drafts can be fast
      .then(buildPayload)
      .then(sendPayload)
      .then(function (result) {
        state.submitting = false;
        onSendSuccess(result);
      }, function (err) {
        state.submitting = false;
        onSendFailure(err);
      })
      .catch(function (err) { console.error('after send:', err && err.message); });
  }

  function buildPayload() {
    var f = readForm();
    var now = new Date();
    var signedAt = state.signedAt || now;
    var sigDataUrl = state.sigPad.toDataURL('image/png');
    return {
      secret: String(CONFIG.FORM_SECRET || ''),
      website: el.hp.value,
      ref: state.ref,
      loaded_at: isoWithOffset(state.loadedAt),
      submitted_at: isoWithOffset(now),
      name: f.name, phone: f.phone, email: f.email,
      street: f.street, city: f.city, state: f.state, zip: f.zip,
      insurer: f.insurer, policy_number: f.policy_number,
      vin: f.vin, year: f.year, make: f.make, model: f.model, vin_source: vinSource(),
      repair_location: f.repair_location,
      repair_location_text: f.repair_location === 'other' ? f.repair_location_text : '',
      notes: f.notes,
      auth_text_version: String(CONFIG.AUTH_TEXT_VERSION || ''),
      auth_text: String(CONFIG.AUTH_TEXT || ''),        // filed with the signature: the wording they saw
      submission_id: state.submissionId,                // the same on a retry, so a retry is never a second job
      signed_at: isoWithOffset(signedAt),
      user_agent: String(navigator.userAgent || ''),
      photos: state.photos.map(function (p, i) {
        return { name: 'card-' + (i + 1) + '.jpg', type: p.type, data: base64Of(p.dataUrl) };
      }),
      signature: { type: 'image/png', data: base64Of(sigDataUrl) }
    };
  }

  // Resolves to { id } on success. Rejects on network error, timeout, non-2xx, or { ok:false }.
  // A 2xx whose body cannot be read still counts as success with a client-made reference.
  function sendPayload(payload) {
    var mode = CONFIG.MOCK_SUBMIT;
    if (mode === true) {
      return sleep(MOCK_DELAY_MS).then(function () { return { id: clientRefId(), mock: true }; });
    }
    if (mode === 'fail') {
      return sleep(1000).then(function () { throw new Error('MOCK_SUBMIT is set to "fail"'); });
    }
    var url = String(CONFIG.APPS_SCRIPT_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/(macros|a\/macros\/[^/]+)\/s\/[^/]+\/exec$/.test(url)) {
      return Promise.reject(new Error('APPS_SCRIPT_URL is not a valid /exec URL (see config.js)'));
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, state.failures ? SEND_TIMEOUT_RETRY_MS : SEND_TIMEOUT_MS);
    return fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request → no CORS preflight
      redirect: 'follow',                                        // Apps Script 302s to googleusercontent.com
      credentials: 'omit',                                       // no cookies: the backend needs none
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: ctrl.signal
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text().then(function (text) {
        var data = null;
        // An empty 2xx body means the reply could not be read: count it as sent.
        // A non-empty body that is not JSON means something other than our script answered: fail.
        if (!text || !text.trim()) return { id: clientRefId(), unconfirmed: true };
        try { data = JSON.parse(text); } catch (e) { throw new Error('unexpected response body'); }
        if (!data || data.ok !== true) {
          var err = new Error('server rejected');
          err.userMessage = data && typeof data.error === 'string' ? data.error.slice(0, 200) : '';
          throw err;
        }
        return { id: typeof data.id === 'string' && data.id ? data.id : clientRefId() };
      });
    }).then(function (result) {
      clearTimeout(timer);
      return result;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function setSendUi(mode, message) {
    clearTimeout(state.photoTimer);
    el.sendMsg.className = 'send-msg';
    if (mode === 'sending') {
      el.send.disabled = true;
      el.send.setAttribute('aria-disabled', 'true');
      el.send.textContent = COPY.sending;
      el.sendMsg.hidden = true;
      el.fallback.hidden = true;
      announce(COPY.sending);
      if (state.photos.length) {
        state.photoTimer = setTimeout(function () {
          if (state.submitting) el.send.textContent = COPY.sendingPhoto;
        }, 1200);
      }
    } else if (mode === 'failed') {
      el.send.disabled = false;
      el.send.setAttribute('aria-disabled', 'false');
      el.send.textContent = COPY.retry;
      el.sendMsg.textContent = message || COPY.sendFailed;
      el.sendMsg.className = 'send-msg err';
      el.sendMsg.hidden = false;
      announce(el.sendMsg.textContent);
    }
  }

  function onSendFailure(err) {
    state.failures += 1;
    console.error('send failed:', err && err.message);
    setSendUi('failed', err && err.userMessage);
    if (state.failures >= 2) {
      el.textInstead.href = smsLink(fallbackSmsBody());
      el.fallback.hidden = false;
    }
  }

  // ---- Thank-you state ------------------------------------------------------------------------
  function onSendSuccess(result) {
    state.sent = true;
    clearDraft();
    var f = readForm();
    var car = vehicleLabel(f);

    el.refCode.textContent = result.id;
    renderSummary(f, car);
    el.textRussell.href = smsLink(COPY.smsAfterSend(f.name, car || COPY.carUnknown, result.id));
    el.saveContact.addEventListener('click', downloadVcard);

    el.intake.hidden = true;
    el.draftBanner.hidden = true;
    el.bar.hidden = true;
    document.body.style.paddingBottom = '';
    document.body.classList.add('no-bar');
    el.thanks.hidden = false;
    window.scrollTo(0, 0);
    el.thanksH.focus({ preventScroll: true });
    announce(COPY.sent);
  }

  function renderSummary(f, car) {
    var dl = document.createElement('dl');
    function row(label, value) {
      if (!value) return;
      var dt = document.createElement('dt'); dt.textContent = label;
      var dd = document.createElement('dd'); dd.textContent = value;
      dl.appendChild(dt); dl.appendChild(dd);
    }
    row(COPY.summaryName, f.name);
    row(COPY.summaryPhone, formatPhone(f.phone));
    row(COPY.summaryVehicle, car);
    row(COPY.summaryInsurer, f.insurer);
    el.summary.textContent = '';
    el.summary.appendChild(dl);
    if (state.photos.length) {
      var ul = document.createElement('ul');
      ul.className = 'thumbs';
      state.photos.forEach(function (p, i) {
        var li = document.createElement('li');
        var img = document.createElement('img');
        img.src = p.dataUrl;
        img.alt = COPY.photoAlt(i + 1);
        li.appendChild(img);
        ul.appendChild(li);
      });
      el.summary.appendChild(ul);
    }
  }

  function vehicleLabel(f) {
    return [f.year, f.make, f.model].filter(Boolean).join(' ');
  }

  function downloadVcard() {
    var lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:' + vEscape(COPY.vcardName),
      'N:;Russell;;;',
      'ORG:' + vEscape(String(CONFIG.BUSINESS_NAME || '')),
      'TEL;TYPE=CELL:' + String(CONFIG.OWNER_PHONE_E164 || ''),
      'NOTE:' + vEscape(COPY.vcardNote),
      'END:VCARD'
    ];
    var blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/vcard;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = COPY.vcardFile;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function vEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  // ---- SMS links -------------------------------------------------------------------------------
  function smsLink(body) {
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var sep = ios ? '&' : '?'; // iOS historically needs "&"
    return 'sms:' + String(CONFIG.OWNER_PHONE_E164 || '') + sep + 'body=' + encodeURIComponent(body);
  }

  // Everything typed, no photo or signature, for when the form cannot reach the server.
  function fallbackSmsBody() {
    var f = readForm();
    var lines = [COPY.smsFallbackIntro];
    function add(label, value) { if (value) lines.push(label + ': ' + value); }
    add('Name', f.name);
    add('Phone', formatPhone(f.phone));
    add('Email', f.email);
    add('Address', [f.street, f.city, [f.state, f.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '));
    add('Insurance', f.insurer);
    add('Policy #', f.policy_number);
    add('VIN', f.vin);
    add('Vehicle', vehicleLabel(f));
    add('Car will be at', f.repair_location === 'other' ? (f.repair_location_text || 'somewhere else') : COPY.locSame);
    add('Notes', f.notes);
    return lines.join('\n');
  }

  // ---- Fixed bar: keep the page's bottom padding equal to the bar's real height ----------------
  function initBarSpacing() {
    if (typeof window.ResizeObserver !== 'function') return;
    var ro = new ResizeObserver(function () {
      if (el.bar.hidden) return;
      document.body.style.paddingBottom = el.bar.offsetHeight + 12 + 'px';
    });
    ro.observe(el.bar);
  }

  // ---- Helpers ---------------------------------------------------------------------------------
  function camel(id) { return id.replace(/[-_]([a-z0-9])/g, function (m, c) { return c.toUpperCase(); }); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function setAll(selector, text) {
    if (text === undefined || text === null) return;
    each(document.querySelectorAll(selector), function (n) { n.textContent = String(text); });
  }
  // Text from an outside service: strings only, no control characters, capped.
  function apiText(v, max) {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, max) : '';
  }

  function newSubmissionId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var bytes = new Uint8Array(24);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var j = 0; j < bytes.length; j++) out += chars.charAt(bytes[j] % chars.length);
    return out;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function announce(text) {
    el.status.textContent = '';
    setTimeout(function () { el.status.textContent = text; }, 50);
  }

  function fitWithin(w, h, maxEdge) {
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  }

  function base64Of(dataUrl) {
    var i = dataUrl.indexOf(',');
    return i === -1 ? '' : dataUrl.slice(i + 1);
  }

  function dataUrlBytes(dataUrl) {
    var b64 = base64Of(dataUrl);
    var padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor(b64.length * 3 / 4) - padding;
  }

  // "2026-10-25T19:40:12-04:00" — local time with its offset, not UTC.
  function isoWithOffset(d) {
    function p(n) { return String(n).padStart(2, '0'); }
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    var a = Math.abs(off);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
      sign + p(Math.floor(a / 60)) + ':' + p(a % 60);
  }

  // Same shape as the server's: BW-YYYYMMDD-XXXX. Used only when the server's id is unavailable.
  function clientRefId() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    var bytes = new Uint8Array(4);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var tail = '';
    for (var j = 0; j < 4; j++) tail += ID_ALPHABET.charAt(bytes[j] % ID_ALPHABET.length);
    return 'BW-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + tail;
  }
})();
