/* July Radio chat: the Chat window on july.rip.
   Markup lives in index.html (#chatRoot inside the "chat" window card).
   Everything typed by people is put on the page with textContent only. */
(function () {
  'use strict';

  var root = document.getElementById('chatRoot');
  if (!root) return;

  var qs = new URLSearchParams(location.search);
  var DEMO = qs.get('chatdemo') === '1';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var CHAT_URL = window.JULY_CHAT_URL ||
    (LOCAL ? 'ws://' + location.hostname + ':8787/ws' : 'wss://chat.july.rip/ws');

  var ME_KEY = 'july_chat_me';
  var DID_KEY = 'july_chat_did';
  var KEY_KEY = 'july_chat_key';           // staff badge token (hosts only)
  var USER_KEY = 'july_chat_user';         // login token for a saved name (listeners)
  var STAFF_COLOR_KEY = 'july_chat_staff_color';
  var COLORS = ['ink', '#e5484d', '#f76808', '#d99a00', '#30a46c', '#0091ff', '#8e4ec6', '#e93d82'];
  var MAX_LEN = 300;
  var MAX_ROWS = 200;
  var RESERVED = ['admin', 'administrator', 'mod', 'moderator', 'system', 'bot', 'july bot', 'julybot',
    'july', 'july radio', 'julyradio', 'staff', 'head', 'host', 'supporter', 'c.', 'fziwe', 'fiscia'];
  var BADGES = { head: 'Head', staff: 'Staff', supporter: 'Supporter', bot: 'Bot' };

  // ---------- small helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function cssColor(c) { return c === 'ink' || COLORS.indexOf(c) < 0 ? 'var(--ink)' : c; }
  function hhmm(t) {
    var d = new Date(t);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function loadMe() {
    try {
      var m = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
      if (m && typeof m.name === 'string' && !nameProblem(m.name)) {
        return { name: m.name, color: COLORS.indexOf(m.color) < 0 ? 'ink' : m.color };
      }
    } catch (e) {}
    return null;
  }
  // A random id for this browser, so two tabs count as one person and a
  // refresh never fights with itself over its own name. Not shown to anyone.
  function deviceId() {
    var d = '';
    try { d = localStorage.getItem(DID_KEY) || ''; } catch (e) {}
    if (!/^[a-f0-9]{32}$/.test(d)) {
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      d = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem(DID_KEY, d); } catch (e) {}
    }
    return d;
  }
  function store(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  }
  function stored(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  // A host opens july.rip/#chatkey=... from the admin panel once; the badge
  // token is kept on this device and the address bar is cleaned straight away.
  (function takeKeyFromAddress() {
    var m = /[#&]chatkey=([A-Za-z0-9_\-.]+)/.exec(location.hash || '');
    if (!m) return;
    store(KEY_KEY, m[1]);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  })();
  function saveMe(m) { try { localStorage.setItem(ME_KEY, JSON.stringify(m)); } catch (e) {} }
  function nameProblem(raw) {
    var n = String(raw || '').replace(/\s+/g, ' ').trim();
    if (n.length < 2) return 'Name needs at least 2 characters.';
    if (n.length > 20) return 'Name can be 20 characters at most.';
    if (!/^[A-Za-z0-9 _.\-]+$/.test(n)) return 'Use letters, numbers, spaces, _ . or - only.';
    if (RESERVED.indexOf(n.toLowerCase()) >= 0) return 'That name is reserved. Please pick another.';
    return '';
  }

  // ---------- styles ----------
  var css = [
    '#chatRoot{position:relative;font-size:12px;line-height:1.55;color:var(--ink)}',
    '.jc-demo{flex:0 0 auto;padding:4px 12px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--border)}',
    '.jc-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:10px 12px;overscroll-behavior:contain}',
    '.jc-empty{color:var(--dim);font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:6px 0}',
    '.jc-msg{padding:2px 0;overflow-wrap:anywhere;word-break:break-word}',
    '.jc-time{color:var(--dim);font-size:10px;margin-right:8px;font-variant-numeric:tabular-nums}',
    '.jc-name{font-weight:700;margin-right:8px}',
    '.jc-badge{display:inline-block;font-size:8px;line-height:1;letter-spacing:.12em;text-transform:uppercase;padding:2px 4px;margin-right:6px;border:1px solid var(--border);vertical-align:1px;white-space:nowrap}',
    '.jc-b-head{background:var(--ink);color:var(--bg)}',
    '.jc-b-bot{border-color:var(--dim);color:var(--dim)}',
    '.jc-whisper{opacity:.8}',
    '.jc-only{color:var(--dim);font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin-left:8px;white-space:nowrap}',
    '.jc-sys{color:var(--dim);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:4px 0}',
    '.jc-new{position:absolute;left:50%;transform:translateX(-50%);bottom:100%;margin-bottom:8px;background:var(--ink);color:var(--bg);border:0;font:inherit;font-size:9px;letter-spacing:.12em;text-transform:uppercase;padding:5px 10px;cursor:pointer;white-space:nowrap}',
    '.jc-foot{position:relative;flex:0 0 auto;border-top:1px solid var(--border);padding:10px 12px}',
    '.jc-label{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}',
    '.jc-in{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:var(--ink);background:var(--bg);border:1px solid var(--border);border-radius:0;padding:7px 9px;outline:none;-webkit-appearance:none}',
    '@media (min-width:641px){.jc-in{font-size:12px}}',
    '.jc-in::placeholder{color:var(--dim)}',
    '.jc-in:focus{box-shadow:inset 0 0 0 1px var(--border)}',
    '.jc-colors{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}',
    '.jc-dot{width:22px;height:22px;padding:0;border:1px solid var(--border);border-radius:0;cursor:pointer}',
    '.jc-dot[aria-checked="true"]{outline:2px solid var(--ink);outline-offset:2px}',
    '.jc-btn{font:inherit;font-size:10px;letter-spacing:.14em;text-transform:uppercase;background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:0;padding:8px 14px;cursor:pointer;white-space:nowrap}',
    '.jc-btn:disabled{opacity:.4;cursor:default}',
    '.jc-btn.jc-ghost{background:none;color:var(--ink);border-color:var(--border)}',
    '.jc-row{display:flex;gap:8px;align-items:stretch}',
    '.jc-row .jc-in{flex:1 1 auto;min-width:0}',
    '.jc-me{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:7px}',
    '.jc-me b{letter-spacing:0;text-transform:none;font-size:12px}',
    '.jc-link{font:inherit;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);background:none;border:0;padding:0;margin-left:auto;cursor:pointer;text-decoration:underline;text-underline-offset:2px}',
    '.jc-link:hover{color:var(--ink)}',
    '.jc-link + .jc-link{margin-left:12px}',
    '.jc-links{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px}',
    '.jc-links .jc-link{margin-left:0}',
    '.jc-b-supporter{border-color:var(--ink)}',
    '.jc-note{font-size:10px;letter-spacing:.06em;color:var(--dim);margin-top:6px;min-height:14px}',
    '.jc-note.jc-err{color:#e5484d}',
    '.jc-mod{margin-left:8px;white-space:nowrap;opacity:0}',
    '.jc-msg:hover .jc-mod,.jc-mod:focus-within{opacity:1}',
    '@media (hover:none){.jc-mod{opacity:1}}',
    '.jc-mod button{font:inherit;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);background:none;border:0;padding:0 0 0 8px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}',
    '.jc-mod button:hover{color:#e5484d}',
    '#chatCount{color:inherit;opacity:.6;margin-left:8px}'
  ].join('\n');
  var st = el('style'); st.textContent = css; document.head.appendChild(st);

  // ---------- build the window ----------
  var listEl = el('div', 'jc-list');
  listEl.setAttribute('role', 'log');
  listEl.setAttribute('aria-live', 'polite');
  var emptyEl = el('div', 'jc-empty', 'No messages yet. Say hi.');
  listEl.appendChild(emptyEl);
  var footEl = el('div', 'jc-foot');
  var newBtn = el('button', 'jc-new', '↓ New messages');
  newBtn.type = 'button'; newBtn.hidden = true;
  newBtn.onclick = function () { toBottom(); };
  var countEl = document.getElementById('chatCount');

  if (DEMO) root.appendChild(el('div', 'jc-demo', 'Preview · these messages are fake'));
  root.appendChild(listEl);
  root.appendChild(footEl);

  // ---------- state ----------
  var me = loadMe();
  var editing = false;       // true while the name/colour form is open
  var seen = {};             // message id -> true, so nothing is ever shown twice
  var online = false;
  var lastId = 0;            // highest message number shown; sent to the server on reconnect
  var joinError = '';        // shown in the name form when the server refuses a name
  var role = null;           // 'head' or 'staff' when this device holds a valid badge
  var cfg = { open: true, slow: 2 };
  var acct = false;          // true when this device is logged in to a saved name
  var badge = null;          // 'supporter' when the saved name has that badge
  var view = null;           // 'keep', 'login' or 'pw' while one of those small forms is open
  var acctError = '';        // shown in those forms when the server says no
  var busy = false;          // waiting for the server to answer one of those forms
  var loginName = '';

  // ---------- message list ----------
  function nearBottom() { return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60; }
  function toBottom() { listEl.scrollTop = listEl.scrollHeight; newBtn.hidden = true; }
  listEl.addEventListener('scroll', function () { if (nearBottom()) newBtn.hidden = true; });

  function addMessage(m) {
    if (!m || m.id == null || seen[m.id]) return;
    seen[m.id] = true;
    if (m.id > lastId) lastId = m.id;
    if (emptyEl.parentNode) emptyEl.remove();
    var stick = nearBottom();
    var row;
    if (m.kind === 'sys') {
      row = el('div', 'jc-sys', '· ' + m.text);
    } else {
      row = el('div', 'jc-msg');
      row.appendChild(el('span', 'jc-time', hhmm(m.t)));
      if (m.role && BADGES[m.role]) row.appendChild(el('span', 'jc-badge jc-b-' + m.role, BADGES[m.role]));
      var nm = el('span', 'jc-name', m.name);
      nm.style.color = cssColor(m.color);
      row.appendChild(nm);
      row.appendChild(el('span', 'jc-text', m.text));
      if (role) row.appendChild(modButtons(m));
    }
    row.dataset.id = m.id;
    listEl.appendChild(row);
    while (listEl.children.length > MAX_ROWS) listEl.firstChild.remove();
    if (stick || m.mine) toBottom(); else newBtn.hidden = false;
  }
  // A line from July Bot that only this person sees. It has no number and is never saved.
  function addWhisper(text) {
    if (!text) return;
    if (emptyEl.parentNode) emptyEl.remove();
    var row = el('div', 'jc-msg jc-whisper');
    row.appendChild(el('span', 'jc-time', hhmm(Date.now())));
    row.appendChild(el('span', 'jc-badge jc-b-bot', BADGES.bot));
    row.appendChild(el('span', 'jc-name', 'July Bot'));
    row.appendChild(el('span', 'jc-text', text));
    row.appendChild(el('span', 'jc-only', 'only you see this'));
    listEl.appendChild(row);
    toBottom();
  }
  function removeRow(id) {
    var row = listEl.querySelector('[data-id="' + id + '"]');
    if (row) row.remove();
    if (!listEl.querySelector('[data-id]') && !emptyEl.parentNode) listEl.appendChild(emptyEl);
  }
  function removeUpTo(floor) {
    Array.prototype.slice.call(listEl.querySelectorAll('[data-id]')).forEach(function (row) {
      if (Number(row.dataset.id) <= floor) row.remove();
    });
    if (!listEl.querySelector('[data-id]') && !emptyEl.parentNode) listEl.appendChild(emptyEl);
  }
  // Small staff-only controls on each message.
  function modButtons(m) {
    var box = el('span', 'jc-mod');
    function b(label, title, fn) {
      var x = el('button', '', label);
      x.type = 'button'; x.title = title; x.onclick = fn;
      box.appendChild(x);
    }
    b('delete', 'Delete this message', function () { transport.mod('del', m.id); });
    if (!m.role || m.role === 'supporter') {
      b('mute', 'Mute this person for 10 minutes', function () { transport.mod('mute', m.id, 10); });
      b('ban', 'Ban this person and remove their messages', function () {
        if (confirm('Ban ' + m.name + ' and remove their messages?')) transport.mod('ban', m.id);
      });
    }
    return box;
  }
  function setCount(n) {
    if (countEl) countEl.textContent = n > 0 ? '· ' + n + ' here' : '';
  }

  // ---------- footer: join form or message box ----------
  function renderFoot() {
    footEl.textContent = '';
    footEl.appendChild(newBtn);
    if (!me && !editing && stored(KEY_KEY) && !online) {
      footEl.appendChild(el('div', 'jc-note', 'Connecting…'));   // a host's device: wait for the badge
      return;
    }
    if (view === 'login') return renderLogin();
    if (me && (view === 'keep' || view === 'pw')) return renderKeep();
    if (!me || editing) renderJoin(); else renderCompose();
  }

  function renderJoin() {
    var picked = me ? me.color : 'ink';
    footEl.appendChild(el('div', 'jc-label', role || acct ? 'Change your colour' : me ? 'Change your name or colour' : 'Step 1 · Pick a name to chat'));
    var nameIn = el('input', 'jc-in');
    nameIn.type = 'text'; nameIn.maxLength = 20; nameIn.placeholder = 'Your name';
    nameIn.autocomplete = 'off'; nameIn.setAttribute('aria-label', 'Your chat name');
    if (me) nameIn.value = me.name;
    if (role || acct) nameIn.disabled = true;
    footEl.appendChild(nameIn);

    var colors = el('div', 'jc-colors');
    colors.setAttribute('role', 'radiogroup');
    colors.setAttribute('aria-label', 'Name colour');
    COLORS.forEach(function (c) {
      var d = el('button', 'jc-dot');
      d.type = 'button'; d.style.background = cssColor(c);
      d.setAttribute('role', 'radio');
      d.setAttribute('aria-label', c === 'ink' ? 'Default colour' : 'Colour ' + c);
      d.setAttribute('aria-checked', String(c === picked));
      d.onclick = function () {
        picked = c;
        Array.prototype.forEach.call(colors.children, function (x) { x.setAttribute('aria-checked', 'false'); });
        d.setAttribute('aria-checked', 'true');
        nameIn.style.color = cssColor(c);
      };
      colors.appendChild(d);
    });
    nameIn.style.color = cssColor(picked);
    footEl.appendChild(colors);

    var row = el('div', 'jc-row');
    var go = el('button', 'jc-btn', me ? 'Save' : 'Join chat');
    go.type = 'button';
    row.appendChild(go);
    if (me) {
      var cancel = el('button', 'jc-btn jc-ghost', 'Cancel');
      cancel.type = 'button';
      cancel.onclick = function () { editing = false; renderFoot(); };
      row.appendChild(cancel);
    }
    if (role) {
      var off = el('button', 'jc-btn jc-ghost', 'Remove my badge here');
      off.type = 'button';
      off.onclick = function () { store(KEY_KEY, null); location.reload(); };
      row.appendChild(off);
    }
    footEl.appendChild(row);
    var note = el('div', 'jc-note', me ? '' : 'No account needed. You can read without joining.');
    if (joinError) { note.className = 'jc-note jc-err'; note.textContent = joinError; joinError = ''; }
    footEl.appendChild(note);
    if (!role && !DEMO) {
      var links = el('div', 'jc-links');
      var link = function (text, fn) {
        var b = el('button', 'jc-link', text);
        b.type = 'button'; b.onclick = fn;
        links.appendChild(b);
      };
      if (acct) {
        link('New password', function () { editing = false; view = 'pw'; renderFoot(); });
        link('Log out', logOut);
      } else {
        link('Have a saved name? Log in', function () { editing = false; view = 'login'; renderFoot(); });
      }
      footEl.appendChild(links);
    }

    function submit() {
      var name = nameIn.value.replace(/\s+/g, ' ').trim();
      if (role) {
        me = { name: me.name, color: picked };
        store(STAFF_COLOR_KEY, picked);
      } else if (acct) {
        me = { name: me.name, color: picked };
        saveMe(me);
      } else {
        var bad = nameProblem(name);
        if (bad) { note.className = 'jc-note jc-err'; note.textContent = bad; nameIn.focus(); return; }
        me = { name: name, color: picked };
        saveMe(me);
      }
      editing = false;
      transport.join(me);
      renderFoot();
      var box = footEl.querySelector('.jc-in');
      if (box) box.focus();
    }
    go.onclick = submit;
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function renderCompose() {
    var who = el('div', 'jc-me');
    who.appendChild(document.createTextNode('Chatting as'));
    var shown = role || badge;
    if (shown) who.appendChild(el('span', 'jc-badge jc-b-' + shown, BADGES[shown]));
    var b = el('b', '', me.name); b.style.color = cssColor(me.color);
    who.appendChild(b);
    if (!role && !acct && !DEMO) {
      var keep = el('button', 'jc-link', 'Keep this name');
      keep.type = 'button';
      keep.title = 'Save this name with a password so nobody else can use it';
      keep.onclick = function () { view = 'keep'; renderFoot(); };
      who.appendChild(keep);
    }
    var change = el('button', 'jc-link', 'Change');
    change.type = 'button';
    change.onclick = function () { editing = true; renderFoot(); };
    who.appendChild(change);
    footEl.appendChild(who);

    if (!cfg.open && !role) {
      footEl.appendChild(el('div', 'jc-note', 'Chat is closed right now. You can still read.'));
      return;
    }
    var row = el('div', 'jc-row');
    var box = el('input', 'jc-in');
    box.type = 'text'; box.maxLength = MAX_LEN; box.placeholder = 'Say something…';
    box.autocomplete = 'off'; box.setAttribute('aria-label', 'Message');
    var send = el('button', 'jc-btn', 'Send');
    send.type = 'button';
    row.appendChild(box); row.appendChild(send);
    footEl.appendChild(row);
    var note = el('div', 'jc-note', online ? (role && !cfg.open ? 'Chat is closed for listeners. Staff can still post.' : '') : 'Connecting…');
    note.id = 'jcNote';
    footEl.appendChild(note);

    function submit() {
      var text = box.value.replace(/\s+/g, ' ').trim();
      if (!text) return;
      var problem = transport.send(text);
      if (problem) { note.className = 'jc-note jc-err'; note.textContent = problem; return; }
      note.className = 'jc-note'; note.textContent = '';
      box.value = '';
      box.focus();
    }
    box.id = 'jcBox';
    send.onclick = submit;
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function setOnline(v) {
    online = v;
    var note = document.getElementById('jcNote');
    if (note && (v || !/jc-err/.test(note.className))) {
      note.className = 'jc-note';
      note.textContent = v ? '' : 'Reconnecting…';
    }
    if (!v) setCount(0);
  }
  function composeError(text, restore) {
    var note = document.getElementById('jcNote');
    if (note) { note.className = 'jc-note jc-err'; note.textContent = text; }
    var box = document.getElementById('jcBox');
    if (box && restore && !box.value) box.value = restore;
  }
  // ---------- saved names: "keep this name", log in, new password ----------
  function pwInput(placeholder, isNew) {
    var p = el('input', 'jc-in');
    p.type = 'password'; p.maxLength = 100; p.placeholder = placeholder;
    p.autocomplete = isNew ? 'new-password' : 'current-password';
    p.setAttribute('aria-label', placeholder);
    return p;
  }
  function acctNote(text) {
    var note = el('div', 'jc-note', text);
    if (acctError) { note.className = 'jc-note jc-err'; note.textContent = acctError; acctError = ''; }
    return note;
  }
  function closeView() { view = null; busy = false; renderFoot(); }

  // view 'keep': a guest saves the name they are using. view 'pw': a saved name gets a new password.
  function renderKeep() {
    var isNew = view === 'keep';
    footEl.appendChild(el('div', 'jc-label', isNew ? 'Keep the name ' + me.name : 'New password for ' + me.name));
    var pw = pwInput(isNew ? 'Choose a password (6 or more characters)' : 'New password (6 or more characters)', true);
    footEl.appendChild(pw);
    var row = el('div', 'jc-row'); row.style.marginTop = '8px';
    var go = el('button', 'jc-btn', busy ? 'Saving…' : isNew ? 'Save my name' : 'Save password');
    go.type = 'button'; go.disabled = busy;
    var cancel = el('button', 'jc-btn jc-ghost', 'Cancel');
    cancel.type = 'button'; cancel.onclick = closeView;
    row.appendChild(go); row.appendChild(cancel);
    footEl.appendChild(row);
    var note = acctNote(isNew ? 'Then nobody else can use your name, and you can log in on another phone or computer.' : 'Other devices using this name will need to log in again.');
    footEl.appendChild(note);
    function submit() {
      if (busy) return;
      var problem = pw.value.length < 6 ? 'The password needs at least 6 characters.' : transport.account(isNew ? 'register' : 'pw', { password: pw.value });
      if (problem) { note.className = 'jc-note jc-err'; note.textContent = problem; pw.focus(); return; }
      busy = true; go.disabled = true; go.textContent = 'Saving…';
    }
    go.onclick = submit;
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function renderLogin() {
    footEl.appendChild(el('div', 'jc-label', 'Log in to your saved name'));
    var nameIn = el('input', 'jc-in');
    nameIn.type = 'text'; nameIn.maxLength = 20; nameIn.placeholder = 'Your saved name';
    nameIn.autocomplete = 'username'; nameIn.setAttribute('aria-label', 'Your saved name');
    if (loginName) nameIn.value = loginName;
    footEl.appendChild(nameIn);
    var pw = pwInput('Password', false);
    pw.style.marginTop = '8px';
    footEl.appendChild(pw);
    var row = el('div', 'jc-row'); row.style.marginTop = '8px';
    var go = el('button', 'jc-btn', busy ? 'Logging in…' : 'Log in');
    go.type = 'button'; go.disabled = busy;
    var back = el('button', 'jc-btn jc-ghost', 'Back');
    back.type = 'button'; back.onclick = closeView;
    row.appendChild(go); row.appendChild(back);
    footEl.appendChild(row);
    var note = acctNote('Forgot your password? Message July Radio and we will reset it.');
    footEl.appendChild(note);
    function submit() {
      if (busy) return;
      loginName = nameIn.value.replace(/\s+/g, ' ').trim();
      var problem = !loginName || !pw.value ? 'Type your name and password.' : transport.account('login', { name: loginName, password: pw.value });
      if (problem) { note.className = 'jc-note jc-err'; note.textContent = problem; return; }
      busy = true; go.disabled = true; go.textContent = 'Logging in…';
    }
    go.onclick = submit;
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') pw.focus(); });
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function logOut() {
    store(USER_KEY, null); store(ME_KEY, null);
    transport.account('logout', {});
    acct = false; badge = null; me = null; editing = false; view = null;
    renderFoot();
  }
  // The server says who we are (after saving a name, logging in, or a badge change).
  function setAccount(you, token) {
    if (token) store(USER_KEY, token);
    acct = true;
    badge = you.role === 'supporter' ? 'supporter' : null;
    me = { name: you.name, color: COLORS.indexOf(you.color) < 0 ? 'ink' : you.color };
    saveMe(me);
  }

  function clearMessages() {
    seen = {}; lastId = 0;
    listEl.textContent = '';
    listEl.appendChild(emptyEl);
  }

  // ---------- real transport (WebSocket to the july-chat Worker) ----------
  function wsTransport(url) {
    var ws = null, did = deviceId();
    var retry = 0, retryTimer = null, beat = null, lastHeard = 0;
    var pending = {}, cidN = 0, lastSent = 0;

    function connect() {
      clearTimeout(retryTimer); retryTimer = null;
      if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
      var sock;
      try { sock = new WebSocket(url); } catch (e) { return again(); }
      ws = sock;
      sock.onopen = function () {
        if (ws !== sock) return;
        lastHeard = Date.now();
        sock.send(JSON.stringify({
          t: 'hello', did: did, last: lastId,
          key: stored(KEY_KEY) || undefined,
          user: stored(USER_KEY) || undefined,
          color: stored(STAFF_COLOR_KEY) || undefined
        }));
      };
      sock.onmessage = function (ev) {
        if (ws !== sock) return;
        lastHeard = Date.now();
        if (ev.data === 'pong') return;
        var d;
        try { d = JSON.parse(ev.data); } catch (e) { return; }
        handle(d);
      };
      sock.onclose = sock.onerror = function () {
        if (ws !== sock) return;
        ws = null;
        setOnline(false);
        again();
      };
    }
    function again() {
      if (retryTimer) return;
      var wait = Math.min(15000, 1000 * Math.pow(2, retry++)) * (0.7 + Math.random() * 0.6);
      retryTimer = setTimeout(connect, wait);
    }
    function handle(d) {
      if (d.t === 'welcome') {
        retry = 0;
        if (d.keyBad) store(KEY_KEY, null);
        var wasStaff = !!role;
        role = d.you && (d.you.role === 'head' || d.you.role === 'staff') ? d.you.role : null;
        if (role) me = { name: d.you.name, color: d.you.color || 'ink' };
        else if (wasStaff) me = loadMe();
        if (d.userBad) { store(USER_KEY, null); acctError = 'Please log in again.'; if (!editing) view = 'login'; }
        acct = false; badge = null; busy = false;
        if (!role && d.you && d.you.acct) setAccount(d.you);
        if (d.cfg) cfg = d.cfg;
        if (d.reset || wasStaff !== !!role) clearMessages();
        if (d.floor) removeUpTo(d.floor);
        (d.gone || []).forEach(removeRow);
        var first = lastId === 0;
        (d.history || []).forEach(addMessage);
        if (first) toBottom();
        setCount(d.count || 0);
        online = true;
        if (!editing) renderFoot();
        setOnline(true);
        if (me && !role && !acct) ws.send(JSON.stringify({ t: 'join', name: me.name, color: me.color }));
      } else if (d.t === 'msg') {
        if (d.cid && pending[d.cid]) { d.m.mine = true; delete pending[d.cid]; }
        addMessage(d.m);
      } else if (d.t === 'count') {
        setCount(d.n || 0);
      } else if (d.t === 'del') {
        removeRow(d.id);
      } else if (d.t === 'floor') {
        removeUpTo(d.floor || 0);
      } else if (d.t === 'cfg') {
        var was = cfg.open;
        cfg = d.cfg || cfg;
        if (was !== cfg.open && !editing) renderFoot();
      } else if (d.t === 'acct') {
        busy = false;
        if (d.out) {                          // logged out by the station (password reset or name removed)
          store(USER_KEY, null); store(ME_KEY, null);
          acct = false; badge = null; me = null; editing = false;
          acctError = d.text || 'Please log in again.';
          view = 'login';
        } else if (d.you) {
          setAccount(d.you, d.token);
          if (d.token) { view = null; editing = false; }
        }
        var typed = document.getElementById('jcBox');
        typed = typed ? typed.value : '';
        if (!editing) renderFoot();
        var boxNow = document.getElementById('jcBox');
        if (boxNow && typed) boxNow.value = typed;   // a badge change must not eat what was being typed
        if (d.token && !d.out) {
          var okNote = document.getElementById('jcNote');
          if (okNote) okNote.textContent = d.changed ? 'New password saved.' : 'You are logged in. This device will remember you.';
        }
      } else if (d.t === 'whisper') {
        addWhisper(d.text);
      } else if (d.t === 'note') {
        var n = document.getElementById('jcNote');
        if (n) { n.className = 'jc-note'; n.textContent = d.text || ''; }
      } else if (d.t === 'err') {
        if (d.code === 'acct') {
          busy = false;
          acctError = d.text || 'That did not work. Try again.';
          renderFoot();
        } else if (d.code === 'name' || d.code === 'join' || d.code === 'ban') {
          joinError = d.text || 'Please pick another name.';
          editing = true;
          renderFoot();
        } else {
          var text = d.cid ? pending[d.cid] : '';
          if (d.cid) delete pending[d.cid];
          composeError(d.text || 'That message was not sent.', text);
        }
      }
    }
    return {
      start: function () {
        connect();
        beat = setInterval(function () {
          if (!ws || ws.readyState !== 1) return;
          if (Date.now() - lastHeard > 60000) { try { ws.close(); } catch (e) {} return; }
          try { ws.send('ping'); } catch (e) {}
        }, 25000);
        window.addEventListener('online', function () { retry = 0; connect(); });
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden && !ws) { retry = 0; connect(); }
        });
      },
      join: function (m) {
        if (ws && ws.readyState === 1 && online) ws.send(JSON.stringify({ t: 'join', name: m.name, color: m.color }));
      },
      account: function (kind, data) {
        if (!ws || ws.readyState !== 1 || !online) return 'Not connected yet. Try again in a moment.';
        data.t = kind;
        ws.send(JSON.stringify(data));
        return '';
      },
      mod: function (a, id, mins) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'mod', a: a, id: id, mins: mins }));
      },
      send: function (text) {
        if (!ws || ws.readyState !== 1 || !online) return 'Not connected yet. Try again in a moment.';
        var t = Date.now();
        var gap = role ? 500 : (cfg.slow || 2) * 1000;
        if (t - lastSent < gap) return 'Slow down a little. One message every ' + Math.round(gap / 1000) + ' seconds.';
        lastSent = t;
        var cid = 'c' + (++cidN);
        pending[cid] = text;
        ws.send(JSON.stringify({ t: 'msg', text: text, cid: cid }));
        return '';
      }
    };
  }

  // ---------- preview transport (no server; fake people) ----------
  function demoTransport() {
    var id = 0, lastSent = 0;
    var now = Date.now();
    var seed = [
      { kind: 'sys', text: 'Now playing: Alison’s Halo, Slowbleed' },
      { name: 'July Bot', role: 'bot', color: 'ink', text: 'Welcome to July Radio chat. Be kind. Type !song to see what is playing.' },
      { name: 'mwas', color: '#0091ff', text: 'this track is unreal' },
      { name: 'july', role: 'head', color: 'ink', text: 'morning everyone, thanks for tuning in' },
      { name: 'akinyi', color: '#e93d82', text: 'listening from Kisumu!' },
      { name: 'host_on_air', role: 'staff', color: '#30a46c', text: 'live set starts at 9, stay close' },
      { name: 'kui', role: 'supporter', color: '#d99a00', text: 'cannot wait. who is opening?' },
      { name: 'nairobi_night', color: '#8e4ec6', text: 'the visualizer with this song though' }
    ];
    var later = [
      { name: 'mwas', color: '#0091ff', text: 'what was the last one called?' },
      { name: 'July Bot', role: 'bot', color: 'ink', text: 'Last played: Night Tapes, helix' },
      { name: 'akinyi', color: '#e93d82', text: 'adding that to my playlist' },
      { name: 'kui', role: 'supporter', color: '#d99a00', text: 'July never misses' },
      { kind: 'sys', text: 'Now playing: Part Time, I Can Treat You Better' },
      { name: 'host_on_air', role: 'staff', color: '#30a46c', text: 'requests open in ten minutes' },
      { name: 'nairobi_night', color: '#8e4ec6', text: 'a very long message to show how wrapping works when someone has a lot to say about the music and keeps typing until the line has to break onto the next one' }
    ];
    var i = 0;
    return {
      start: function () {
        seed.forEach(function (m, k) {
          addMessage(Object.assign({ id: ++id, t: now - (seed.length - k) * 47000 }, m));
        });
        setCount(12);
        setOnline(true);
        toBottom();
        setInterval(function () {
          addMessage(Object.assign({ id: ++id, t: Date.now() }, later[i++ % later.length]));
          setCount(11 + Math.floor(Math.random() * 4));
        }, 6000);
      },
      join: function () {},
      account: function () { return 'Not available in the preview.'; },
      mod: function () {},
      send: function (text) {
        var t = Date.now();
        if (t - lastSent < 2000) return 'Slow down a little. One message every 2 seconds.';
        lastSent = t;
        addMessage({ id: ++id, t: t, name: me.name, color: me.color, text: text, mine: true });
        return '';
      }
    };
  }

  var transport = DEMO ? demoTransport() : wsTransport(CHAT_URL);

  renderFoot();
  transport.start();
  if (me) transport.join(me);
})();
