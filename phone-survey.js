/* July Radio phone survey: a small card on july.rip asking "What phone are you listening on?"
   Added 22 Nov 2026. Loaded by index.html as /phone-survey.js?v=1 (bump ?v= when this file changes).
   - Phones only (no laptops, no tablets). Never touches the player.
   - Android: brand + model guessed from the browser (User-Agent Client Hints, then the UA string);
     the listener confirms or edits. iPhone: Apple hides the model, so the listener picks it.
   - Shown once per device. After Skip it may ask again after 30 days.
   - Switched on/off in admin > Phone Survey (server: july-chat Worker, /survey/phone).
   - Preview: ?phonetest=1 (or =iphone, =other, =android:SM-A155F) shows it right away on any screen.
   Text from people is only ever set with textContent / value. */
(function () {
  'use strict';

  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = window.JULY_SURVEY_URL || (LOCAL ? 'http://' + location.hostname + ':8787' : 'https://chat.july.rip');
  var STATE_KEY = 'july_phone_survey';     // { s: 'done' | 'skip', t }
  var DID_KEY = 'july_phone_did';          // random, anonymous device id (only used so a phone counts once)
  var SKIP_DAYS = 30;
  var FIRST_DELAY_MS = 40000;              // let people settle in (and press Play) first
  var qs = new URLSearchParams(location.search);
  var TEST = qs.get('phonetest');          // preview mode

  var IPHONES = ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17', 'iPhone 16e',
    'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
    'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
    'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
    'iPhone SE (3rd generation)', 'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
    'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
    'iPhone SE (2nd generation)', 'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
    'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone SE (1st generation)',
    'Older iPhone (X, 8 or before)', 'Not sure'];
  var BRANDS = ['Samsung', 'Tecno', 'Infinix', 'itel', 'Xiaomi / Redmi / Poco', 'Oppo', 'Realme', 'vivo',
    'Nokia', 'Huawei', 'Honor', 'Google Pixel', 'Motorola', 'OnePlus', 'Neon (Safaricom)', 'Nothing'];

  // Model code -> brand (first match wins). The listener can always correct it.
  var BRAND_RULES = [
    [/^(SM-|GT-|Galaxy)/i, 'Samsung'], [/^TECNO/i, 'Tecno'], [/^Infinix/i, 'Infinix'], [/^itel/i, 'itel'],
    [/^(Redmi|POCO|Mi |MI |Xiaomi|M\d{4}[A-Z]\d|2\d{4}[0-9A-Z]{3,})/i, 'Xiaomi / Redmi / Poco'],
    [/^CPH\d/i, 'Oppo'], [/^RMX\d/i, 'Realme'], [/^(vivo|V\d{4}[A-Z]?$)/i, 'vivo'], [/^(Nokia|TA-\d)/i, 'Nokia'],
    [/^Pixel/i, 'Google Pixel'], [/^(moto|motorola|XT\d)/i, 'Motorola'], [/^HUAWEI/i, 'Huawei'], [/^HONOR/i, 'Honor'],
    [/^OnePlus/i, 'OnePlus'], [/^Neon/i, 'Neon (Safaricom)'], [/^Nothing/i, 'Nothing'],
    [/^[A-Z]{3}-[A-Z]{1,3}\d{1,2}[A-Z]?$/, 'Huawei'],
  ];
  // Friendly names for common codes. Samsung by series (SM-A155F, SM-A155M ... -> A155).
  var SAMSUNG = {
    A015: 'Galaxy A01', A022: 'Galaxy A02', A025: 'Galaxy A02s', A032: 'Galaxy A03 Core', A035: 'Galaxy A03', A037: 'Galaxy A03s',
    A042: 'Galaxy A04e', A045: 'Galaxy A04', A047: 'Galaxy A04s', A055: 'Galaxy A05', A057: 'Galaxy A05s', A065: 'Galaxy A06',
    A105: 'Galaxy A10', A107: 'Galaxy A10s', A115: 'Galaxy A11', A125: 'Galaxy A12', A127: 'Galaxy A12', A135: 'Galaxy A13',
    A137: 'Galaxy A13', A136: 'Galaxy A13 5G', A145: 'Galaxy A14', A146: 'Galaxy A14 5G', A155: 'Galaxy A15', A156: 'Galaxy A15 5G',
    A165: 'Galaxy A16', A166: 'Galaxy A16 5G', A205: 'Galaxy A20', A207: 'Galaxy A20s', A217: 'Galaxy A21s', A225: 'Galaxy A22',
    A226: 'Galaxy A22 5G', A235: 'Galaxy A23', A236: 'Galaxy A23 5G', A245: 'Galaxy A24', A256: 'Galaxy A25 5G', A266: 'Galaxy A26 5G',
    A305: 'Galaxy A30', A307: 'Galaxy A30s', A315: 'Galaxy A31', A325: 'Galaxy A32', A326: 'Galaxy A32 5G', A336: 'Galaxy A33 5G',
    A346: 'Galaxy A34 5G', A356: 'Galaxy A35 5G', A366: 'Galaxy A36 5G', A505: 'Galaxy A50', A515: 'Galaxy A51', A525: 'Galaxy A52',
    A528: 'Galaxy A52s 5G', A536: 'Galaxy A53 5G', A546: 'Galaxy A54 5G', A556: 'Galaxy A55 5G', A566: 'Galaxy A56 5G',
    A705: 'Galaxy A70', A715: 'Galaxy A71', A725: 'Galaxy A72', A736: 'Galaxy A73 5G',
    G960: 'Galaxy S9', G965: 'Galaxy S9+', G970: 'Galaxy S10e', G973: 'Galaxy S10', G975: 'Galaxy S10+',
    G980: 'Galaxy S20', G981: 'Galaxy S20', G985: 'Galaxy S20+', G986: 'Galaxy S20+', G988: 'Galaxy S20 Ultra',
    G780: 'Galaxy S20 FE', G781: 'Galaxy S20 FE', G990: 'Galaxy S21 FE', G991: 'Galaxy S21', G996: 'Galaxy S21+', G998: 'Galaxy S21 Ultra',
    S901: 'Galaxy S22', S906: 'Galaxy S22+', S908: 'Galaxy S22 Ultra', S711: 'Galaxy S23 FE', S911: 'Galaxy S23', S916: 'Galaxy S23+',
    S918: 'Galaxy S23 Ultra', S721: 'Galaxy S24 FE', S921: 'Galaxy S24', S926: 'Galaxy S24+', S928: 'Galaxy S24 Ultra',
    S931: 'Galaxy S25', S936: 'Galaxy S25+', S937: 'Galaxy S25 Edge', S938: 'Galaxy S25 Ultra',
    N970: 'Galaxy Note10', N975: 'Galaxy Note10+', N980: 'Galaxy Note20', N981: 'Galaxy Note20', N985: 'Galaxy Note20 Ultra', N986: 'Galaxy Note20 Ultra',
    F731: 'Galaxy Z Flip5', F741: 'Galaxy Z Flip6', F766: 'Galaxy Z Flip7', F946: 'Galaxy Z Fold5', F956: 'Galaxy Z Fold6', F966: 'Galaxy Z Fold7'
  };
  // Other brands: code (without the brand word) -> name. Only codes we are sure of; add more as answers come in.
  var OTHERS = {
    Tecno: { KJ5: 'Spark 20', KJ6: 'Spark 20 Pro', KI5: 'Spark 10', KI7: 'Spark 10 Pro', BG6: 'Spark Go 2024' },
    Infinix: { X6525: 'Smart 8', X669: 'Hot 30i', X6833B: 'Note 30' }
  };

  // ---------- storage (never throws) ----------
  function getState() { try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { return null; } }
  function setState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify({ s: s, t: Date.now() })); return true; } catch (e) { return false; } }
  function storageWorks() { try { localStorage.setItem('july_ps_t', '1'); localStorage.removeItem('july_ps_t'); return true; } catch (e) { return false; } }
  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DID_KEY); } catch (e) {}
    if (!id || !/^[a-z0-9]{16,40}$/.test(id)) {
      id = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(12)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem(DID_KEY, id); } catch (e) {}
    }
    return id;
  }

  // ---------- what phone is this? ----------
  function browserName(ua) {
    if (/Opera Mini/i.test(ua)) return 'Opera Mini';
    if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if (/OPR\/|OPT\//.test(ua)) return 'Opera';
    if (/EdgA\/|EdgiOS\//.test(ua)) return 'Edge';
    if (/FxiOS|Firefox\//.test(ua)) return 'Firefox';
    if (/CriOS/.test(ua)) return 'Chrome';
    if (/Instagram/.test(ua)) return 'Instagram app';
    if (/FBAN|FBAV/.test(ua)) return 'Facebook app';
    if (/; wv\)/.test(ua)) return 'App (WebView)';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Other';
  }
  function brandFor(code) {
    for (var i = 0; i < BRAND_RULES.length; i++) if (BRAND_RULES[i][0].test(code)) return BRAND_RULES[i][1];
    return '';
  }
  function friendly(brand, code) {
    var m = /^SM-([A-Z]\d{3})/i.exec(code);
    if (brand === 'Samsung' && m && SAMSUNG[m[1].toUpperCase()]) return SAMSUNG[m[1].toUpperCase()];
    var bare = code.replace(/^(TECNO|Infinix|itel|Xiaomi|HUAWEI|HONOR|Nokia|motorola|OnePlus|vivo|Neon|Nothing)[\s_-]*/i, '').trim();
    var table = OTHERS[brand];
    if (table) {
      for (var k in table) if (bare.toUpperCase().indexOf(k.toUpperCase()) === 0) return table[k];
    }
    return bare || code;     // unknown: show the code itself (still exact); the listener may type the name
  }
  function fakeDetect(t) {
    var p = String(t).split(':');
    if (p[0] === 'iphone') return { platform: 'iphone', os: 'iOS', osv: '18.1', browser: 'Safari' };
    if (p[0] === 'other') return { platform: 'other', os: 'KaiOS', osv: '', browser: 'Other' };
    var code = p[1] || 'SM-A155F', brand = brandFor(code);
    return { platform: 'android', os: 'Android', osv: '14', browser: 'Chrome', code: code, brand: brand, model: brand ? friendly(brand, code) : code };
  }
  // null = not a phone (laptop, desktop, tablet): we do not ask there.
  function detect() {
    var ua = navigator.userAgent || '';
    var uad = navigator.userAgentData;
    var br = browserName(ua);
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return Promise.resolve(null);
    if (/iPhone|iPod/.test(ua)) {
      var iv = /OS (\d+)[_.](\d+)/.exec(ua);
      return Promise.resolve({ platform: 'iphone', os: 'iOS', osv: iv ? iv[1] + '.' + iv[2] : '', browser: br });
    }
    if (/Android/i.test(ua)) {
      var mobile = uad && typeof uad.mobile === 'boolean' ? uad.mobile : /Mobile|Opera Mini/i.test(ua);
      if (!mobile) return Promise.resolve(null);
      var out = { platform: 'android', os: 'Android', osv: ((/Android ([\d.]+)/.exec(ua) || [])[1] || ''), browser: br };
      var fromUa = /Android [\d.]+; (?:[a-z]{2}[-_][a-z]{2}; )?([^;)]+?)(?: Build\/|\)|;)/i.exec(ua);
      var uaCode = fromUa ? fromUa[1].trim() : '';
      if (uaCode === 'K' || uaCode.length < 2 || /^(wv|U|Mobile|Linux)$/i.test(uaCode)) uaCode = '';
      var finish = function (code) {
        code = (code || uaCode || '').trim().slice(0, 40);
        out.code = code;
        out.brand = code ? brandFor(code) : '';
        out.model = code ? friendly(out.brand, code) : '';
        return out;
      };
      if (uad && uad.getHighEntropyValues) {
        var hints = uad.getHighEntropyValues(['model', 'platformVersion']).then(function (h) {
          if (h && h.platformVersion) out.osv = h.platformVersion.split('.').slice(0, 2).join('.');
          return finish(h && h.model);
        }, function () { return finish(''); });
        var late = new Promise(function (res) { setTimeout(function () { res(finish('')); }, 2000); });
        return Promise.race([hints, late]);
      }
      return Promise.resolve(finish(''));
    }
    if (/KAIOS|Mobi|Opera Mini|Windows Phone|BlackBerry|BB10/i.test(ua)) {
      return Promise.resolve({ platform: 'other', os: /KAIOS/i.test(ua) ? 'KaiOS' : 'Other', osv: '', browser: br });
    }
    return Promise.resolve(null);
  }

  // ---------- the card ----------
  function css() {
    if (document.getElementById('psStyle')) return;
    var s = document.createElement('style');
    s.id = 'psStyle';
    s.textContent =
      '.ps-card{position:fixed;right:16px;bottom:16px;width:340px;max-width:calc(100vw - 20px);z-index:90;background:var(--bg,#fff);color:var(--ink,#0a0a0a);border:1px solid var(--border,#0a0a0a);font-family:"IBM Plex Mono","Courier New",monospace;box-shadow:0 6px 24px rgba(0,0,0,.12);transform:translateY(16px);opacity:0;transition:transform .3s ease,opacity .3s ease}' +
      '.ps-card.on{transform:none;opacity:1}' +
      '@media (max-width:768px){.ps-card{left:10px;right:10px;width:auto;max-width:none;bottom:calc(58px + env(safe-area-inset-bottom))}}' +
      '.ps-head{display:flex;align-items:center;justify-content:space-between;background:var(--ink,#0a0a0a);color:var(--bg,#fff);padding:7px 10px;font-size:10px;letter-spacing:.14em;text-transform:uppercase}' +
      '.ps-x{background:none;border:none;color:inherit;font:inherit;font-size:15px;line-height:1;cursor:pointer;padding:0 2px}' +
      '.ps-body{padding:14px 14px 12px}' +
      '.ps-q{font-size:14px;font-weight:600;line-height:1.35;margin-bottom:12px}' +
      '.ps-seg{display:flex;margin-bottom:12px}' +
      '.ps-seg button{flex:1;font:inherit;font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:8px 4px;background:none;color:var(--ink,#0a0a0a);border:1px solid var(--border,#0a0a0a);margin-left:-1px;cursor:pointer}' +
      '.ps-seg button:first-child{margin-left:0}' +
      '.ps-seg button.sel{background:var(--ink,#0a0a0a);color:var(--bg,#fff)}' +
      '.ps-lbl{display:block;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#6e6e6e);margin:0 0 4px}' +
      '.ps-in{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:16px;font-weight:500;padding:8px;margin-bottom:10px;background:var(--bg,#fff);color:var(--ink,#0a0a0a);border:1px solid var(--border,#0a0a0a);border-radius:0;-webkit-appearance:none;appearance:none}' +
      'select.ps-in{background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 15px) 55%,calc(100% - 10px) 55%;background-size:5px 5px;background-repeat:no-repeat;padding-right:28px}' +
      '.ps-hint{font-size:10px;line-height:1.5;color:var(--muted,#6e6e6e);margin:-4px 0 10px}' +
      '.ps-act{display:flex;gap:8px;margin-top:4px}' +
      '.ps-send{flex:1;font:inherit;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;padding:10px;background:var(--ink,#0a0a0a);color:var(--bg,#fff);border:1px solid var(--ink,#0a0a0a);cursor:pointer}' +
      '.ps-send:disabled{opacity:.5;cursor:default}' +
      '.ps-skip{font:inherit;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:10px 14px;background:none;color:var(--ink,#0a0a0a);border:1px solid var(--border,#0a0a0a);cursor:pointer}' +
      '.ps-foot{font-size:9px;line-height:1.5;color:var(--muted,#6e6e6e);margin-top:10px}' +
      '.ps-err{font-size:10px;color:#e5484d;margin-top:8px}' +
      '.ps-thanks{font-size:13px;font-weight:600;padding:6px 0 4px;letter-spacing:.04em}';
    document.head.appendChild(s);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function select(options, value) {
    var s = el('select', 'ps-in');
    options.forEach(function (o) {
      var op = el('option', null, o === '' ? 'Choose…' : o);
      op.value = o;
      s.appendChild(op);
    });
    s.value = value || '';
    return s;
  }

  function show(info) {
    css();
    var card = el('div', 'ps-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Phone survey');
    var head = el('div', 'ps-head');
    head.appendChild(el('span', null, 'Quick question'));
    var x = el('button', 'ps-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    head.appendChild(x);
    var body = el('div', 'ps-body');
    card.appendChild(head);
    card.appendChild(body);

    body.appendChild(el('div', 'ps-q', 'What phone are you listening on?'));
    var seg = el('div', 'ps-seg');
    var types = [['iphone', 'iPhone'], ['android', 'Android'], ['other', 'Other']];
    var segBtns = {};
    types.forEach(function (t) {
      var b = el('button', null, t[1]);
      b.type = 'button';
      b.onclick = function () { setType(t[0]); };
      segBtns[t[0]] = b;
      seg.appendChild(b);
    });
    body.appendChild(seg);
    var fields = el('div');
    body.appendChild(fields);

    // iPhone
    var iBox = el('div');
    iBox.appendChild(el('label', 'ps-lbl', 'Model'));
    var iSel = select([''].concat(IPHONES), '');
    iBox.appendChild(iSel);
    iBox.appendChild(el('div', 'ps-hint', 'Not sure? Settings → General → About → Model Name.'));
    // Android
    var aBox = el('div');
    aBox.appendChild(el('label', 'ps-lbl', 'Brand'));
    var detectedBrand = info.platform === 'android' ? info.brand || '' : '';
    var aSel = select([''].concat(BRANDS, ['Other brand']), detectedBrand);
    aBox.appendChild(aSel);
    var aOther = el('input', 'ps-in');
    aOther.placeholder = 'Which brand?';
    aOther.maxLength = 30;
    aBox.appendChild(aOther);
    aBox.appendChild(el('label', 'ps-lbl', 'Model'));
    var aModel = el('input', 'ps-in');
    aModel.placeholder = 'e.g. Galaxy A15, Spark 20, Hot 30i';
    aModel.maxLength = 50;
    aModel.value = info.platform === 'android' ? info.model || '' : '';
    aBox.appendChild(aModel);
    var aHint = el('div', 'ps-hint', info.model ? 'We filled this in from your phone. Change it if it is wrong.'
      : 'Find it in Settings → About phone.');
    aBox.appendChild(aHint);
    // Other phone
    var oBox = el('div');
    oBox.appendChild(el('label', 'ps-lbl', 'Brand and model'));
    var oIn = el('input', 'ps-in');
    oIn.placeholder = 'e.g. Nokia 2780 Flip';
    oIn.maxLength = 50;
    oBox.appendChild(oIn);

    function syncOther() { aOther.style.display = aSel.value === 'Other brand' ? '' : 'none'; }
    aSel.onchange = syncOther;
    syncOther();

    var type = info.platform;
    function setType(t) {
      type = t;
      for (var k in segBtns) segBtns[k].classList.toggle('sel', k === t);
      fields.textContent = '';
      fields.appendChild(t === 'iphone' ? iBox : t === 'android' ? aBox : oBox);
    }
    setType(type);

    var act = el('div', 'ps-act');
    var send = el('button', 'ps-send', 'Send');
    send.type = 'button';
    var skip = el('button', 'ps-skip', 'Skip');
    skip.type = 'button';
    act.appendChild(send);
    act.appendChild(skip);
    body.appendChild(act);
    var err = el('div', 'ps-err');
    err.style.display = 'none';
    body.appendChild(err);
    body.appendChild(el('div', 'ps-foot', 'Anonymous: no name, no number. It helps us make July Radio work better on the phones you use.'));

    document.body.appendChild(card);
    requestAnimationFrame(function () { requestAnimationFrame(function () { card.classList.add('on'); }); });

    function close(after) {
      card.classList.remove('on');
      setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, after || 350);
    }
    function fail(msg) { err.textContent = msg; err.style.display = ''; }
    function doSkip() { if (!TEST) setState('skip'); close(); }
    x.onclick = doSkip;
    skip.onclick = doSkip;

    send.onclick = function () {
      err.style.display = 'none';
      var brand = '', model = '';
      if (type === 'iphone') { brand = 'Apple'; model = iSel.value; }
      else if (type === 'android') {
        brand = aSel.value === 'Other brand' ? aOther.value.trim() : aSel.value;
        model = aModel.value.trim();
      } else { brand = 'Other'; model = oIn.value.trim(); }
      if (!brand) return fail('Pick the brand first.');
      if (!model) return fail(type === 'iphone' ? 'Pick your iPhone (or "Not sure").' : 'Type the model (or "Not sure").');

      var guessed = info.platform === 'android' && type === 'android' && (info.brand || info.model);
      var source = 'manual';
      if (guessed) {
        source = brand.toLowerCase() === String(info.brand || '').toLowerCase() &&
          model.toLowerCase() === String(info.model || '').toLowerCase() ? 'detected' : 'edited';
      }
      var payload = {
        did: deviceId(), platform: type, brand: brand, model: model,
        code: info.platform === 'android' ? info.code || '' : '', source: source,
        os: info.os || '', osv: info.osv || '', browser: info.browser || ''
      };
      send.disabled = true;
      send.textContent = 'Sending…';
      fetch(API + '/survey/phone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
      }).then(function (res) {
        if (res.ok) {
          if (!TEST) setState('done');
          body.textContent = '';
          body.appendChild(el('div', 'ps-thanks', 'Thank you. Enjoy the music.'));
          setTimeout(function () { close(); }, 2500);
          return;
        }
        if (res.status === 403) {                     // switched off while the card was open
          if (!TEST) setState('skip');
          if (TEST) { send.disabled = false; send.textContent = 'Send'; return fail('The survey is switched off in admin (preview).'); }
          return close();
        }
        send.disabled = false; send.textContent = 'Send';
        fail((res.d && res.d.error) || 'Could not send. Try again.');
      }).catch(function () {
        send.disabled = false; send.textContent = 'Send';
        fail('Could not send. Check your connection and try again.');
      });
    };
  }

  // Wait until nothing else is on top (splash, event pop-up, Earth Day screen), then show.
  function whenClear(fn) {
    var busy = document.getElementById('splashScreen') ||
      document.querySelector('.earth-load') ||
      (function () { var o = document.getElementById('eventPopupOverlay'); return o && getComputedStyle(o).display !== 'none'; })();
    if (busy) return setTimeout(function () { whenClear(fn); }, 5000);
    fn();
  }

  function start() {
    if (TEST) {
      var go = function (info) { whenClear(function () { show(info); }); };
      if (TEST === '1') detect().then(function (i) { go(i || { platform: 'android', os: '', osv: '', browser: browserName(navigator.userAgent) }); });
      else go(fakeDetect(TEST));
      return;
    }
    if (!storageWorks()) return;                 // cannot remember the answer, so do not ask at all
    var st = getState();
    if (st && (st.s === 'done' || (st.s === 'skip' && Date.now() - st.t < SKIP_DAYS * 86400000))) return;
    detect().then(function (info) {
      if (!info) return;                         // not a phone
      return fetch(API + '/survey/phone', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (cfg) {
        if (!cfg || !cfg.on) return;
        setTimeout(function () { whenClear(function () { show(info); }); }, FIRST_DELAY_MS);
      });
    }).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
