/* ──────────────────────────────────────────────────────────────────────────
   JULY BOY — April Fools mini adventure for july.rip
   Loaded on demand (only when a visitor clicks the April Fools button).
   - The site "falls apart", a Game Boy console appears, and the player must
     collect merch, talk to the team for hints, and defeat the three-headed dog.
   - Silent on purpose: the radio keeps playing underneath.
   - Team + residents are read from the site's own roster (peopleData/rosters).
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.JulyFool) return;

  // ── constants ──────────────────────────────────────────────────────────────
  var W = 160, H = 144, T = 8, COLS = 20, ROWS = 16, OY = 16;
  var PAL = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f']; // lightest → darkest
  var L0 = 0, L1 = 1, D1 = 2, D0 = 3;
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ── tiny 3x5 bitmap font (uppercase only) ─────────────────────────────────
  var FONT = {
    'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111',
    'F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','J':'001001001101010',
    'K':'101101110101101','L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010',
    'P':'110101110100100','Q':'010101101110011','R':'110101110101101','S':'011100010001110','T':'111010010010010',
    'U':'101101101101111','V':'101101101101010','W':'101101111111101','X':'101101010101101','Y':'101101010010010',
    'Z':'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
    '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111',
    '9':'111101111001110','.':'000000000000010',',':'000000000010100','!':'010010010000010','?':'110001010000010',
    ':':'000010000010000',"'":'010010000000000','-':'000000111000000','+':'000010111010000','/':'001001010100100',
    '(':'010100100100010',')':'010001001001010','>':'100010001010100','<':'001010100010001','*':'101010111010101',
    '&':'010101010101011'
  };

  // ── pixel bitmaps (1=darkest, 2=lightest, 3=mid-dark, 4=mid-light) ──────────
  var HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  var NOTE  = ['00111', '00101', '00100', '11100', '11100'];
  var BMP = {
    case: ['1111111', '1221221', '1221221', '1111111', '1333331', '1333331', '1331331', '1333331', '1333331', '1333331', '1111111'],
    stickers: ['1111111111', '1333333331', '1111111111', '1322322231', '1323222331', '1322322231', '1333333331', '1111111111'],
    tee: ['0110000110', '1111001111', '1111111111', '0111111110', '0011111100', '0011221100', '0011221100', '0011111100', '0011111100'],
    shield: ['11111', '13331', '13331', '01310', '00100']
  };
  var BMPCOL = { '1': D0, '2': L0, '3': D1, '4': L1 };

  // ── canvas + state ─────────────────────────────────────────────────────────
  var root = null, cv = null, ctx = null, raf = 0, active = false, G = null;
  var keys = { up: false, down: false, left: false, right: false };
  var pressA = false, pressB = false;
  var breakTimers = [], broken = [], styleEl = null;
  var roomCache = {};

  function R(x, y, w, h, c) { ctx.fillStyle = PAL[c]; ctx.fillRect(x | 0, y | 0, w, h); }
  function bmp(rows, x, y, map) {
    map = map || BMPCOL;
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j].charAt(i); if (ch === '0' || ch === '.') continue;
      R(x + i, y + j, 1, 1, map[ch]);
    }
  }
  function text(str, x, y, c) {
    str = String(str).toUpperCase();
    for (var n = 0; n < str.length; n++) {
      var g = FONT[str.charAt(n)];
      if (g) for (var k = 0; k < 15; k++) if (g.charAt(k) === '1') R(x + n * 4 + (k % 3), y + ((k / 3) | 0), 1, 1, c);
    }
    return str.length * 4;
  }
  function bigText(str, x, y, c, k) {
    str = String(str).toUpperCase();
    for (var n = 0; n < str.length; n++) {
      var g = FONT[str.charAt(n)];
      if (g) for (var q = 0; q < 15; q++) if (g.charAt(q) === '1') R(x + n * 4 * k + (q % 3) * k, y + ((q / 3) | 0) * k, k, k, c);
    }
  }
  function textW(s) { return String(s).length * 4; }
  function ctext(str, y, c) { text(str, ((W - textW(str)) / 2) | 0, y, c); }
  function wrap(str, max) {
    var words = String(str).toUpperCase().split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function heart(x, y, full) {
    for (var j = 0; j < HEART.length; j++) for (var i = 0; i < 7; i++) {
      if (HEART[j].charAt(i) !== '1') continue;
      if (full || ((i + j) % 2 === 0)) R(x + i, y + j, 1, 1, full ? D0 : D1);
    }
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hit(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

  // ── rooms ──────────────────────────────────────────────────────────────────
  function mkGrid(id) {
    var g = [], x, y;
    for (y = 0; y < ROWS; y++) { g.push([]); for (x = 0; x < COLS; x++) g[y].push((x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) ? '#' : '.'); }
    function put(ch, px, py, w, h) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) g[py + j][px + i] = ch; }
    if (id === 'A') {
      put('S', 1, 1, 2, 1); put('S', 17, 1, 2, 1); put('M', 8, 4, 4, 1);
      put('R', 2, 8, 2, 1); put('R', 16, 10, 2, 1);
      put('N', 9, 0, 2, 1); put('E', 19, 7, 1, 2);
    } else if (id === 'B') {
      put('R', 2, 3, 5, 1); put('R', 13, 3, 5, 1); put('R', 4, 8, 4, 1); put('R', 12, 8, 4, 1);
      put('W', 0, 7, 1, 2);
    }
    return g;
  }
  var ROOMS = {
    A: { name: 'STUDIO', npcs: [[0, 5, 4], [1, 14, 4], [2, 7, 10], [3, 13, 11]] },
    B: { name: 'RECORD STORE', npcs: [[4, 9, 5], [5, 3, 5], [6, 15, 5], [7, 9, 11]] },
    C: { name: "DOG'S DEN", npcs: [] }
  };
  var ITEMS = [
    { id: 'stickers', room: 'A', tx: 3, ty: 12, name: 'STICKER BOX' },
    { id: 'case', room: 'B', tx: 17, ty: 13, name: 'PHONE CASE' },
    { id: 'tee', room: 'B', tx: 9, ty: 1, name: 'JULY TEE' }
  ];

  function drawTile(c, ch, x, y) {
    var px = x * T, py = y * T;
    function r(a, b, w, h, col) { c.fillStyle = PAL[col]; c.fillRect(px + a, py + b, w, h); }
    if (ch === '#') {
      r(0, 0, 8, 8, D1); r(0, 0, 8, 1, D0); r(0, 4, 8, 1, D0); r(3, 0, 1, 4, D0); r(6, 4, 1, 4, D0);
    } else if (ch === 'S') { // speaker
      r(0, 0, 8, 8, D0); r(1, 1, 6, 6, D1); r(3, 3, 2, 2, L1); r(2, 2, 1, 1, L0);
    } else if (ch === 'M') { // mixer desk
      r(0, 0, 8, 8, D1); r(0, 0, 8, 1, D0); r(1, 3, 1, 4, L1); r(3, 2, 1, 4, L1); r(5, 4, 1, 3, L1); r(7, 3, 1, 4, L1);
    } else if (ch === 'R') { // crate / shelf of records
      r(0, 0, 8, 8, D0); r(1, 1, 6, 6, L1); r(1, 1, 1, 6, D1); r(3, 1, 1, 6, D1); r(5, 1, 1, 6, D1);
    } else if (ch === 'N') { // locked den door
      r(0, 0, 8, 8, D0); r(1, 1, 6, 7, D1); r(1, 3, 6, 1, D0); r(1, 6, 6, 1, D0);
      if (x % 2 === 1) r(5, 4, 2, 2, L0); else r(1, 4, 2, 2, L0);
    } else { // floor
      r(0, 0, 8, 8, L0);
      if ((x + y) % 2 === 0) r(3, 3, 1, 1, L1);
      if (ch === 'E') { r(5, 2, 1, 4, D1); r(6, 3, 1, 2, D1); }
      if (ch === 'W') { r(2, 2, 1, 4, D1); r(1, 3, 1, 2, D1); }
    }
  }
  function roomCanvas(id) {
    if (roomCache[id]) return roomCache[id];
    var c = document.createElement('canvas'); c.width = W; c.height = ROWS * T;
    var cc = c.getContext('2d'), g = grids[id];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) drawTile(cc, g[y][x], x, y);
    if (id === 'C') { // arena decoration
      cc.fillStyle = PAL[L1];
      for (var yy = 2; yy < ROWS - 1; yy++) for (var xx = 1; xx < COLS - 1; xx++) if ((xx + yy) % 4 === 0) cc.fillRect(xx * T + 3, yy * T + 3, 2, 2);
    }
    roomCache[id] = c; return c;
  }
  var grids = { A: mkGrid('A'), B: mkGrid('B'), C: mkGrid('C') };

  function tileAt(mx, my) {
    var tx = (mx / T) | 0, ty = (my / T) | 0;
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return grids[G.room][ty][tx];
  }
  function isSolid(ch) { return ch === '#' || ch === 'S' || ch === 'M' || ch === 'R' || ch === 'N'; }
  function solidRect(x, y, w, h) {
    return isSolid(tileAt(x, y)) || isSolid(tileAt(x + w - 1, y)) || isSolid(tileAt(x, y + h - 1)) || isSolid(tileAt(x + w - 1, y + h - 1));
  }

  // ── people (roster-driven) ─────────────────────────────────────────────────
  var VARIANTS = [
    { hair: 2, shirt: D1 }, { hair: 1, shirt: D0 }, { hair: 3, shirt: D1 }, { hair: 4, shirt: D0 },
    { hair: 5, shirt: D1 }, { hair: 7, shirt: D0 }, { hair: 0, shirt: D1 }, { hair: 6, shirt: D0 }
  ];
  var FALLBACK = ['ROADIE', 'DJ', 'INTERN', 'FAN', 'ENGINEER', 'HOST', 'GUEST', 'MASCOT'];
  var HINTS = [
    ['WELCOME TO JULY HQ. THE SITE BROKE AND THE DOG DID IT.', 'THE DEN DOOR AT THE TOP ONLY OPENS FOR TRUE FANS.'],
    ['YOU NEED 3 MERCH ITEMS: A PHONE CASE, STICKERS AND A TEE.', 'SHOW THE DOOR ALL THREE AND IT OPENS.'],
    ['THE STICKER BOX IS IN THE BOTTOM LEFT CORNER OF THIS ROOM.', 'YOU THROW STICKERS WITH THE A BUTTON.'],
    ['THE REST OF THE MERCH IS IN THE RECORD STORE.', 'WALK THROUGH THE DOOR ON THE RIGHT.'],
    ['THE TEE IS ON THE VERY TOP ROW. WALK AROUND THE CRATES.', 'IT GIVES YOU EXTRA HEARTS.'],
    ['THE PHONE CASE IS IN THE BOTTOM RIGHT CORNER.', 'IT BLOCKS ONE HIT FROM THE DOG.'],
    ['STICKERS ONLY STICK WHEN A MOUTH IS WIDE OPEN.', 'WAIT FOR THE HEAD TO FLASH, THEN LET IT HAVE IT.'],
    ['FACE A HEAD, THEN PRESS A TO THROW A STICKER.', 'THE BARKING NOTES FLY STRAIGHT. SIDESTEP THEM.']
  ];
  function getPeople() {
    var out = [];
    try {
      if (typeof rosters !== 'undefined' && typeof peopleData !== 'undefined') {
        rosters.team.concat(rosters.resident).forEach(function (id) { if (peopleData[id]) out.push(peopleData[id]); });
      }
    } catch (e) {}
    var res = [];
    for (var i = 0; i < 8; i++) {
      var p = out[i];
      res.push({ name: ((p && p.name) || FALLBACK[i]).toString().slice(0, 14), tagline: (p && p.tagline) || '' });
    }
    return res;
  }

  function person(x, y, v, dir, fr, isPlayer) {
    x = x | 0; y = y | 0;
    var l = (fr & 1) ? 1 : 0;
    R(x + 1, y + 13, 8, 1, D1);
    R(x + 2, y + 11, 2, 2 + l, D0); R(x + 6, y + 11, 2, 3 - l, D0);
    R(x + 1, y + 6, 8, 5, v.shirt); R(x + 1, y + 6, 8, 1, D0); R(x, y + 7, 1, 3, D0); R(x + 9, y + 7, 1, 3, D0);
    if (isPlayer) R(x + 3, y + 8, 4, 1, L0);
    R(x + 2, y, 6, 6, L0);
    R(x + 2, y, 6, 1, D0); R(x + 2, y + 5, 6, 1, D0); R(x + 2, y, 1, 6, D0); R(x + 7, y, 1, 6, D0);
    switch (v.hair) {
      case 0: R(x + 2, y, 6, 2, D0); break;
      case 1: R(x + 2, y, 6, 2, D0); R(x + 2, y - 1, 1, 1, D0); R(x + 4, y - 2, 2, 2, D0); R(x + 7, y - 1, 1, 1, D0); break;
      case 2: R(x + 2, y, 6, 2, D0); R(x + 1, y + 2, 1, 5, D0); R(x + 8, y + 2, 1, 5, D0); break;
      case 3: R(x + 1, y, 8, 2, D1); R(x + 1, y + 2, 8, 1, D0); break;
      case 4: R(x + 1, y - 1, 8, 3, D0); R(x + 1, y + 2, 1, 2, D0); R(x + 8, y + 2, 1, 2, D0); break;
      case 5: R(x + 2, y - 1, 6, 3, D1); R(x + 4, y - 2, 2, 1, D0); break;
      case 6: R(x + 2, y, 6, 1, D0); R(x, y + 2, 2, 3, D0); R(x + 8, y + 2, 2, 3, D0); break;
      case 7: R(x + 2, y, 6, 2, D0); R(x + 4, y - 2, 2, 2, D0); break;
    }
    if (isPlayer) { R(x + 2, y, 6, 1, D0); R(x, y + 2, 2, 3, D0); R(x + 8, y + 2, 2, 3, D0); R(x + 2, y + 1, 6, 1, D0); }
    if (dir === 'up') R(x + 2, y, 6, 3, D0);
    else if (dir === 'left') R(x + 3, y + 3, 1, 1, D0);
    else if (dir === 'right') R(x + 6, y + 3, 1, 1, D0);
    else { R(x + 3, y + 3, 1, 1, D0); R(x + 6, y + 3, 1, 1, D0); }
  }

  // ── game state ─────────────────────────────────────────────────────────────
  function newGame() {
    G = {
      scene: 'boot', t: 0, room: 'A', px: 76, py: 88, dir: 'up', fr: 0, step: 0,
      inv: { stickers: false, case: false, tee: false }, hearts: 3, maxHearts: 3, shield: false, invul: 0,
      shots: [], notes: [], dlg: null, boss: null, black: 0, toast: null, taken: {}, people: getPeople(),
      cool: 0, doorMsg: 0, seenIntro: false, seenBoss: false, winT: 0, goT: 0, npcs: []
    };
    loadRoom('A', 76, 88);
  }
  function loadRoom(id, px, py) {
    G.room = id; G.px = px; G.py = py; G.shots = []; G.notes = []; G.black = 8;
    G.npcs = ROOMS[id].npcs.map(function (n) {
      return { i: n[0], x: n[1] * T - 1, y: n[2] * T - 6, dir: 'down', v: VARIANTS[n[0]] };
    });
  }
  function allItems() { return G.inv.stickers && G.inv.case && G.inv.tee; }
  function toast(s) { G.toast = { s: s, t: 110 }; }

  function startDialog(name, pages, onEnd) {
    G.dlg = { name: name, pages: pages, p: 0, shown: 0, onEnd: onEnd || null };
    G.scene = 'dialog';
  }
  function npcTalk(n) {
    var p = G.people[n.i], pages = [];
    pages.push(p.tagline ? "I'M " + p.name + ', ' + p.tagline + '.' : "I'M " + p.name + '.');
    HINTS[n.i].forEach(function (h) { pages.push(h); });
    startDialog(p.name, pages);
  }

  // ── boss ───────────────────────────────────────────────────────────────────
  function resetBoss() {
    var xs = [12, 62, 112];
    G.boss = { heads: xs.map(function (x, i) { return { x: x, y: 6, w: 36, h: 30, hp: 3, st: 'idle', t: 50 + i * 35, flash: 0, fire: 0 }; }), dying: 0 };
    G.hearts = G.maxHearts; G.shield = G.inv.case; G.invul = 0; G.shots = []; G.notes = [];
    G.px = 76; G.py = 100; G.dir = 'up';
  }
  function aliveHeads() { return G.boss.heads.filter(function (h) { return h.hp > 0; }).length; }
  function stepBoss() {
    var alive = aliveHeads(), fastTick = alive === 1 ? 0.5 : alive === 2 ? 0.75 : 1;
    G.boss.heads.forEach(function (h) {
      if (h.hp <= 0) return;
      if (h.flash > 0) h.flash--;
      h.t--;
      if (h.st === 'idle' && h.t <= 0) { h.st = 'warn'; h.t = 28; }
      else if (h.st === 'warn' && h.t <= 0) { h.st = 'open'; h.t = 110; h.fire = 18; }
      else if (h.st === 'open') {
        h.fire--;
        if (h.fire <= 0) {
          h.fire = Math.round(34 * fastTick) + 6;
          var sx = h.x + h.w / 2 - 2, sy = h.y + h.h - 2;
          var tx = G.px + 5, ty = G.py + 10, dx = tx - sx, dy = ty - sy, d = Math.sqrt(dx * dx + dy * dy) || 1;
          var sp = alive === 1 ? 1.15 : 0.95;
          G.notes.push({ x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp });
        }
        if (h.t <= 0) { h.st = 'idle'; h.t = Math.round(rnd(70, 120) * fastTick); }
      } else if (h.st === 'hurt' && h.t <= 0) { h.st = 'idle'; h.t = Math.round(rnd(50, 80) * fastTick); }
    });
  }

  // ── update ─────────────────────────────────────────────────────────────────
  function moveWithCollide(dx, dy) {
    var nx = G.px + dx, ny = G.py;
    if (!blocked(nx, ny)) G.px = nx;
    ny = G.py + dy;
    if (!blocked(G.px, ny)) G.py = ny;
  }
  function blocked(x, y) {
    if (solidRect(x + 2, y + 9, 6, 5)) return true;
    if (G.room === 'C' && y < 62) return true;
    for (var i = 0; i < G.npcs.length; i++) { var n = G.npcs[i]; if (hit(x + 2, y + 9, 6, 5, n.x + 1, n.y + 7, 8, 7)) return true; }
    return false;
  }
  function hurtPlayer() {
    if (G.invul > 0) return;
    if (G.shield) { G.shield = false; G.invul = 50; toast('CASE BLOCKED IT!'); return; }
    G.hearts--; G.invul = 75;
    if (G.hearts <= 0) { G.scene = 'gameover'; G.goT = 0; }
  }
  function update() {
    G.t++;
    if (G.black > 0) { G.black--; return; }
    if (G.toast && --G.toast.t <= 0) G.toast = null;
    var sc = G.scene;

    if (sc === 'boot') { if (pressA && G.t > 40) { G.scene = 'play'; if (!G.seenIntro) { G.seenIntro = true; startDialog('', ['THE SITE FELL APART!', 'A THREE-HEADED DOG CHEWED THROUGH THE SERVER ROOM.', 'TALK TO THE TEAM. FIND THE MERCH. SAVE JULY RADIO!']); } } return; }

    if (sc === 'dialog') {
      var d = G.dlg, full = d.pages[d.p].length;
      d.shown = Math.min(full, d.shown + 0.7);
      if (pressA) {
        if (d.shown < full) d.shown = full;
        else if (d.p < d.pages.length - 1) { d.p++; d.shown = 0; }
        else { var cb = d.onEnd; G.dlg = null; G.scene = G.boss && G.room === 'C' ? 'boss' : 'play'; if (cb) cb(); }
      }
      return;
    }

    if (sc === 'gameover') { G.goT++; if (pressA && G.goT > 30) { resetBoss(); G.scene = 'boss'; } return; }
    if (sc === 'win') { G.winT++; if (pressA && G.winT > 60) finish(true); return; }

    // play + boss share movement
    var mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    var sp = 1.2;
    if (mx || my) {
      if (mx && my) { mx *= 0.75; my *= 0.75; }
      if (Math.abs(mx) >= Math.abs(my)) G.dir = mx > 0 ? 'right' : 'left'; else G.dir = my > 0 ? 'down' : 'up';
      moveWithCollide(mx * sp, my * sp);
      if (++G.step % 8 === 0) G.fr++;
    }
    if (G.invul > 0) G.invul--;
    if (G.cool > 0) G.cool--;
    if (G.doorMsg > 0) G.doorMsg--;

    if (sc === 'play') {
      // interact
      if (pressA) {
        var fx = G.px + 5 + (G.dir === 'left' ? -9 : G.dir === 'right' ? 9 : 0), fy = G.py + 9 + (G.dir === 'up' ? -9 : G.dir === 'down' ? 9 : 0);
        for (var i = 0; i < G.npcs.length; i++) {
          var n = G.npcs[i];
          if (hit(fx - 3, fy - 3, 6, 6, n.x - 2, n.y + 4, 14, 12)) {
            n.dir = G.dir === 'up' ? 'down' : G.dir === 'down' ? 'up' : G.dir === 'left' ? 'right' : 'left';
            npcTalk(n); return;
          }
        }
      }
      // pick up items
      ITEMS.forEach(function (it) {
        if (G.taken[it.id] || it.room !== G.room) return;
        if (hit(G.px + 2, G.py + 6, 6, 8, it.tx * T - 1, it.ty * T - 2, 10, 10)) {
          G.taken[it.id] = true; G.inv[it.id] = true;
          if (it.id === 'tee') { G.maxHearts = 5; G.hearts = Math.min(5, G.hearts + 2); }
          if (it.id === 'case') G.shield = true;
          toast('GOT ' + it.name + '!');
        }
      });
      // exits
      var cx = G.px + 5, cy = G.py + 11, tch = tileAt(cx, cy);
      if (G.room === 'A' && tch === 'E') loadRoom('B', 2 * T, G.py);
      else if (G.room === 'B' && tch === 'W') loadRoom('A', 17 * T, G.py);
      // locked door
      if (G.room === 'A' && hit(G.px + 2, G.py + 7, 6, 2, 9 * T, 0, 16, 8)) {
        if (allItems()) {
          loadRoom('C', 76, 100); resetBoss(); G.scene = 'dialog';
          startDialog('', ['THE DOOR OPENS...', 'ROOOAR! THREE HEADS WAKE UP.', 'THROW STICKERS WHEN THEIR MOUTHS OPEN!'], function () { G.scene = 'boss'; });
        } else if (G.doorMsg <= 0) {
          var miss = 3 - (G.inv.stickers ? 1 : 0) - (G.inv.case ? 1 : 0) - (G.inv.tee ? 1 : 0);
          toast('LOCKED. ' + miss + ' MERCH ITEM' + (miss > 1 ? 'S' : '') + ' MISSING.'); G.doorMsg = 120;
        }
      }
    }

    if (sc === 'boss') {
      // throw sticker
      if (pressA && G.cool <= 0 && G.inv.stickers) {
        G.cool = 18;
        var vx = G.dir === 'left' ? -2.6 : G.dir === 'right' ? 2.6 : 0, vy = G.dir === 'up' ? -2.6 : G.dir === 'down' ? 2.6 : 0;
        G.shots.push({ x: G.px + 3, y: G.py + 5, vx: vx, vy: vy, spin: 0 });
      }
      if (G.boss.dying > 0) {
        G.boss.dying--; G.notes = []; G.shots = [];
        if (G.boss.dying === 0) { G.scene = 'win'; G.winT = 0; try { localStorage.setItem('july_fool_won', '1'); } catch (e) {} }
        return;
      }
      stepBoss();
      for (var s = G.shots.length - 1; s >= 0; s--) {
        var sh = G.shots[s]; sh.x += sh.vx; sh.y += sh.vy; sh.spin++;
        var gone = sh.x < 4 || sh.x > W - 8 || sh.y < 4 || sh.y > ROWS * T - 6;
        for (var hh = 0; hh < G.boss.heads.length && !gone; hh++) {
          var hd = G.boss.heads[hh];
          if (hd.hp > 0 && hit(sh.x, sh.y, 4, 4, hd.x + 2, hd.y + 4, hd.w - 4, hd.h - 4)) {
            gone = true;
            if (hd.st === 'open') { hd.hp--; hd.flash = 14; hd.st = 'hurt'; hd.t = 30; }
            else hd.flash = 5;
          }
        }
        if (gone) G.shots.splice(s, 1);
      }
      for (var nn = G.notes.length - 1; nn >= 0; nn--) {
        var no = G.notes[nn]; no.x += no.vx; no.y += no.vy;
        if (no.x < -6 || no.x > W + 2 || no.y > ROWS * T + 4) { G.notes.splice(nn, 1); continue; }
        if (hit(no.x + 1, no.y + 1, 4, 5, G.px + 2, G.py + 4, 6, 10)) { G.notes.splice(nn, 1); hurtPlayer(); }
      }
      if (aliveHeads() === 0 && G.boss.dying === 0) G.boss.dying = 110;
    }
  }

  // ── draw ───────────────────────────────────────────────────────────────────
  function drawHUD() {
    R(0, 0, W, OY, L0); R(0, OY - 1, W, 1, D0);
    for (var i = 0; i < G.maxHearts; i++) heart(3 + i * 8, 5, i < G.hearts);
    if (G.shield) bmp(BMP.shield, 3 + G.maxHearts * 8 + 2, 5);
    var ix = W - 3;
    ['tee', 'case', 'stickers'].forEach(function (k) {
      var w = k === 'tee' ? 10 : k === 'case' ? 7 : 10; ix -= w + 3;
      if (G.inv[k]) bmp(BMP[k], ix, k === 'case' ? 2 : 4); else { R(ix, 6, w, 5, L1); R(ix + ((w / 2) | 0) - 1, 7, 2, 3, D1); }
    });
  }
  function drawItems() {
    ITEMS.forEach(function (it) {
      if (G.taken[it.id] || it.room !== G.room) return;
      var bob = ((G.t / 14) | 0) % 2, b = BMP[it.id];
      bmp(b, it.tx * T - 1 + ((10 - b[0].length) / 2 | 0), OY + it.ty * T - 2 + bob);
    });
  }
  function drawHead(h) {
    var x = h.x, y = OY + h.y, dead = h.hp <= 0, col = dead ? D1 : D0;
    if (h.flash > 0 && (h.flash & 2)) col = D1;
    var jx = (h.st === 'hurt' && !dead) ? ((G.t & 2) ? 1 : -1) : 0; x += jx;
    R(x + 4, y + 4, 6, 2, col); R(x + 5, y + 2, 4, 2, col); R(x + 6, y, 2, 2, col);
    R(x + 26, y + 4, 6, 2, col); R(x + 27, y + 2, 4, 2, col); R(x + 28, y, 2, 2, col);
    R(x + 3, y + 6, 30, 12, col); R(x + 1, y + 10, 34, 7, col);
    R(x + 9, y + 15, 18, 7, col);
    var openMouth = h.st === 'open' && !dead;
    if (openMouth) { R(x + 11, y + 21, 14, 5, L0); R(x + 12, y + 21, 2, 2, D0); R(x + 22, y + 21, 2, 2, D0); R(x + 10, y + 26, 16, 3, col); }
    else R(x + 10, y + 22, 16, 3, col);
    if (dead) {
      R(x + 9, y + 9, 1, 1, L0); R(x + 12, y + 9, 1, 1, L0); R(x + 10, y + 10, 2, 1, L0); R(x + 9, y + 11, 1, 1, L0); R(x + 12, y + 11, 1, 1, L0);
      R(x + 23, y + 9, 1, 1, L0); R(x + 26, y + 9, 1, 1, L0); R(x + 24, y + 10, 2, 1, L0); R(x + 23, y + 11, 1, 1, L0); R(x + 26, y + 11, 1, 1, L0);
    } else {
      var eye = (h.st === 'warn' && (G.t & 4)) ? L1 : L0;
      R(x + 9, y + 9, 5, 4, eye); R(x + 22, y + 9, 5, 4, eye);
      R(x + 11, y + 10, 2, 2, D0); R(x + 24, y + 10, 2, 2, D0);
    }
    for (var i = 0; i < 3; i++) R(x + 12 + i * 5, y - 5, 4, 3, i < h.hp ? D0 : D1);
  }
  function drawBoss() {
    var b = G.boss, shake = b.dying > 0 ? ((G.t & 2) ? 2 : -2) : 0;
    ctx.save(); ctx.translate(shake, 0);
    R(18, OY + 32, 124, 26, D0); R(26, OY + 36, 108, 3, D1);
    [24, 60, 90, 126].forEach(function (lx) { R(lx, OY + 56, 10, 12, D0); R(lx - 1, OY + 66, 12, 2, D0); });
    R(142, OY + 36, 8, 4, D0); R(148, OY + 30, 4, 8, D0); R(146, OY + 28, 6, 3, D0);
    b.heads.forEach(drawHead);
    ctx.restore();
  }
  function draw() {
    R(0, 0, W, H, L0);
    var sc = G.scene;
    if (G.black > 0) { R(0, 0, W, H, D0); return; }

    if (sc === 'boot') {
      var t = G.t, y = Math.min(40, t * 0.8);
      R(0, 0, W, H, L0);
      bigText('JULY', 48, (y | 0) - 10, D0, 4); bigText('BOY', 68, (y | 0) + 12, D1, 2);
      R(24, 24, 112, 2, D0); R(24, 66, 112, 2, D0);
      if (t > 60) ctext('THE DOG ATE THE SITE', 78, D1);
      if (t > 40 && ((t / 24) | 0) % 2 === 0) ctext('PRESS A', 100, D0);
      ctext('(C)1996 JULY RADIO', 130, D1);
      return;
    }
    if (sc === 'win') {
      R(0, 0, W, H, L0); R(4, 4, W - 8, H - 8, L0); R(4, 4, W - 8, 1, D0); R(4, H - 5, W - 8, 1, D0); R(4, 4, 1, H - 8, D0); R(W - 5, 4, 1, H - 8, D0);
      ctext('SITE RESTORED!', 16, D0); ctext('DOG DEFEATED', 26, D1);
      bmp(BMP.case, 46, 40); bmp(BMP.stickers, 70, 42); bmp(BMP.tee, 98, 41);
      ctext('YOU COLLECTED ALL THE MERCH', 62, D1);
      ctext('JULY RADIO MERCH DROP', 82, D0); ctext('COMING SOON', 90, D0);
      ctext('THANKS FOR PLAYING', 108, D1);
      if (G.winT > 60 && ((G.winT / 24) | 0) % 2 === 0) ctext('PRESS A', 122, D0);
      return;
    }

    ctx.drawImage(roomCanvas(G.room), 0, OY);
    drawItems();
    if (G.room === 'C') drawBoss();

    // sort NPCs + player by y
    var ents = G.npcs.map(function (n) { return { y: n.y, f: function () { person(n.x, OY + n.y, n.v, n.dir, ((G.t / 30) | 0) % 2, false); } }; });
    ents.push({ y: G.py, f: function () { if (G.invul > 0 && (G.t & 4)) return; person(G.px, OY + G.py, { hair: 6, shirt: D0 }, G.dir, G.fr, true); } });
    ents.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { e.f(); });

    G.shots.forEach(function (s) { var f = (s.spin >> 2) & 1; R(s.x, OY + s.y, 4, 4, D0); R(s.x + 1, OY + s.y + 1, 2, 2, f ? L0 : L1); });
    G.notes.forEach(function (n) { bmp(NOTE, n.x | 0, OY + (n.y | 0)); });

    drawHUD();
    ctext(ROOMS[G.room].name, 5, D1);

    if (G.toast) {
      var tw = textW(G.toast.s) + 8, tx = ((W - tw) / 2) | 0;
      R(tx, OY + 4, tw, 11, D0); R(tx + 1, OY + 5, tw - 2, 9, L0); text(G.toast.s, tx + 4, OY + 7, D0);
    }
    if (sc === 'dialog' && G.dlg) {
      var d = G.dlg, bx = 4, by = H - 40, bw = W - 8, bh = 36;
      R(bx, by, bw, bh, D0); R(bx + 1, by + 1, bw - 2, bh - 2, L0); R(bx + 2, by + 2, bw - 4, bh - 4, L1); R(bx + 3, by + 3, bw - 6, bh - 6, L0);
      var ty = by + 6;
      if (d.name) { R(bx + 6, by - 4, textW(d.name) + 6, 8, D0); text(d.name, bx + 9, by - 2, L0); }
      var shown = d.pages[d.p].slice(0, Math.floor(d.shown)), lines = wrap(d.pages[d.p], 35), count = 0;
      for (var i = 0; i < lines.length; i++) {
        var part = shown.length > count ? lines[i].slice(0, shown.length - count) : '';
        text(part, bx + 7, ty + i * 7, D0); count += lines[i].length + 1;
      }
      if (d.shown >= d.pages[d.p].length && ((G.t / 20) | 0) % 2 === 0) R(bx + bw - 12, by + bh - 9, 5, 3, D0);
    }
    if (sc === 'gameover') {
      R(20, 46, 120, 52, D0); R(22, 48, 116, 48, L0);
      ctext('GAME OVER', 56, D0); ctext('THE DOG IS STILL HUNGRY', 70, D1);
      if (((G.goT / 24) | 0) % 2 === 0) ctext('PRESS A TO TRY AGAIN', 84, D0);
    }
    if (G.boss && G.boss.dying > 0 && (G.t & 4)) R(0, OY, W, H - OY, L1);
  }

  // ── loop ───────────────────────────────────────────────────────────────────
  var last = 0, acc = 0;
  function frame(now) {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    acc += Math.min(100, now - last); last = now;
    while (active && acc >= 16.667) { update(); pressA = false; pressB = false; acc -= 16.667; }
    if (active) draw();
  }

  // ── input ──────────────────────────────────────────────────────────────────
  var KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  function onKeyDown(e) {
    if (!active) return;
    var k = e.key, d = KEYMAP[k];
    if (k === 'Escape') { finish(false); e.preventDefault(); e.stopPropagation(); return; }
    if (d) keys[d] = true;
    else if (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z') { if (!e.repeat) pressA = true; }
    else if (k === 'x' || k === 'X' || k === 'Shift') { if (!e.repeat) pressB = true; }
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  function onKeyUp(e) {
    if (!active) return;
    var d = KEYMAP[e.key]; if (d) { keys[d] = false; e.preventDefault(); e.stopPropagation(); }
  }
  function bindPad(el, name) {
    function down(e) { e.preventDefault(); if (name === 'a') pressA = true; else if (name === 'b') pressB = true; else keys[name] = true; el.classList.add('on'); }
    function up(e) { e.preventDefault(); if (name !== 'a' && name !== 'b') keys[name] = false; el.classList.remove('on'); }
    el.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, up); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ── overlay UI ─────────────────────────────────────────────────────────────
  var CSS = [
    '#foolRoot{position:fixed;inset:0;z-index:9500;background:rgba(8,8,8,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;opacity:0;transition:opacity .5s;overflow:auto;-webkit-user-select:none;user-select:none;font-family:"IBM Plex Mono","Courier New",monospace}',
    '#foolRoot.show{opacity:1}',
    '.fool-skip{background:none;border:1px solid #777;color:#aaa;font:10px/1 "IBM Plex Mono","Courier New",monospace;letter-spacing:.14em;text-transform:uppercase;padding:8px 12px;cursor:pointer}',
    '.fool-skip:hover{color:#fff;border-color:#fff}',
    '.fool-gb{background:#cfcdc2;border-radius:10px 10px 46px 10px;padding:18px 20px 22px;box-shadow:inset -3px -3px 0 #a9a79c,inset 3px 3px 0 #e8e6db,0 14px 40px rgba(0,0,0,.6)}',
    '.fool-bezel{background:#5b5e72;border-radius:8px 8px 28px 8px;padding:12px 16px 10px}',
    '.fool-bezel-top{color:#b9bccf;font-size:8px;letter-spacing:.18em;text-align:center;margin-bottom:8px;text-transform:uppercase}',
    '.fool-screen{background:#0f380f;padding:6px;line-height:0}',
    '.fool-screen canvas{image-rendering:pixelated;image-rendering:crisp-edges;display:block}',
    '.fool-brand{margin:12px 0 4px 6px;font-weight:600;font-style:italic;color:#2f3a8f;font-size:15px;letter-spacing:.04em}',
    '.fool-brand i{color:#7a2a6a;font-style:italic}',
    '.fool-controls{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:0 6px}',
    '.fool-dpad{position:relative;width:96px;height:96px}',
    '.fool-dpad button{position:absolute;width:32px;height:32px;border:0;background:#2b2b2f;color:#777;font-size:11px;padding:0;cursor:pointer;touch-action:none}',
    '.fool-dpad button.on{background:#000;color:#fff}',
    '.fool-dpad .u{left:32px;top:0;border-radius:4px 4px 0 0}.fool-dpad .d{left:32px;top:64px;border-radius:0 0 4px 4px}',
    '.fool-dpad .l{left:0;top:32px;border-radius:4px 0 0 4px}.fool-dpad .r{left:64px;top:32px;border-radius:0 4px 4px 0}',
    '.fool-dpad .c{left:32px;top:32px;background:#2b2b2f;width:32px;height:32px;position:absolute}',
    '.fool-ab{position:relative;width:104px;height:70px;transform:rotate(-20deg)}',
    '.fool-ab button{position:absolute;width:44px;height:44px;border-radius:50%;border:0;background:#8e2a63;color:#d9a9c6;font:700 12px "IBM Plex Mono",monospace;box-shadow:0 3px 0 #5d1a40;cursor:pointer;touch-action:none}',
    '.fool-ab button.on{transform:translateY(2px);box-shadow:0 1px 0 #5d1a40}',
    '.fool-ab .b{left:0;top:22px}.fool-ab .a{left:56px;top:6px}',
    '.fool-help{color:#8a8a8a;font-size:9px;letter-spacing:.1em;text-align:center;max-width:340px;line-height:1.6}',
    'html.fool-lock,html.fool-lock body{overflow:hidden!important}',
    '@media (max-width:640px){.fool-gb{padding:10px 8px 14px}.fool-bezel{padding:8px 6px 8px}.fool-screen{padding:4px}.fool-controls{padding:0 2px}}'
  ].join('\n');

  function fit() {
    if (!cv || !root) return;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var gb = root.querySelector('.fool-gb');
    var extraW = gb.offsetWidth - W;
    var extraH = root.querySelector('.fool-skip').offsetHeight + gb.offsetHeight + root.querySelector('.fool-help').offsetHeight + 24 - H;
    var availW = Math.min(window.innerWidth - 8, 700) - extraW;
    var availH = window.innerHeight - 12 - extraH;
    var s = Math.max(1, Math.min(4, Math.floor(availW / W), Math.floor(availH / H)));
    cv.style.width = (W * s) + 'px'; cv.style.height = (H * s) + 'px';
  }

  function buildUI() {
    styleEl = document.createElement('style'); styleEl.id = 'foolStyle'; styleEl.textContent = CSS; document.head.appendChild(styleEl);
    root = document.createElement('div'); root.id = 'foolRoot'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'July Boy: April Fools game');
    root.innerHTML =
      '<button class="fool-skip" type="button">✕ Skip game, restore site</button>' +
      '<div class="fool-gb">' +
        '<div class="fool-bezel"><div class="fool-bezel-top">◂ Dot matrix with no sound ▸</div><div class="fool-screen"><canvas width="' + W + '" height="' + H + '"></canvas></div></div>' +
        '<div class="fool-brand">JULY<i>BOY</i></div>' +
        '<div class="fool-controls">' +
          '<div class="fool-dpad"><button class="u" type="button" aria-label="Up">▲</button><button class="l" type="button" aria-label="Left">◀</button><div class="c"></div><button class="r" type="button" aria-label="Right">▶</button><button class="d" type="button" aria-label="Down">▼</button></div>' +
          '<div class="fool-ab"><button class="b" type="button" aria-label="B">B</button><button class="a" type="button" aria-label="A">A</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="fool-help">ARROWS / WASD MOVE · SPACE OR Z = A · ESC = SKIP</div>';
    document.body.appendChild(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    root.querySelector('.fool-skip').addEventListener('click', function () { finish(false); });
    bindPad(root.querySelector('.u'), 'up'); bindPad(root.querySelector('.d'), 'down');
    bindPad(root.querySelector('.l'), 'left'); bindPad(root.querySelector('.r'), 'right');
    bindPad(root.querySelector('.a'), 'a'); bindPad(root.querySelector('.b'), 'b');
    fit();
    requestAnimationFrame(function () { root.classList.add('show'); });
  }

  // ── "the site falls apart" ─────────────────────────────────────────────────
  var BREAK_SEL = 'header .header-brand > *, header .header-right, nav a, .win-card, .dock-icon, .fool-bar, .section.active > *, .holiday-flag, .fest-pumpkin, .fest-spider';
  function breakSite() {
    document.documentElement.classList.add('fool-lock');
    if (reduceMotion) return;
    Array.prototype.forEach.call(document.querySelectorAll(BREAK_SEL), function (el) {
      if (el.closest && el.closest('#foolRoot')) return;
      var fall = Math.random() < 0.55;
      var dx = (Math.random() - 0.5) * (fall ? 70 : 30), dy = fall ? 80 + Math.random() * window.innerHeight * 0.7 : (Math.random() - 0.5) * 30;
      var rot = (Math.random() - 0.5) * (fall ? 80 : 25), delay = Math.random() * 700;
      el.style.transition = 'translate 1.3s cubic-bezier(.6,0,1,.5) ' + delay + 'ms, rotate 1.3s ease-in ' + delay + 'ms';
      el.style.translate = dx + 'px ' + dy + 'px'; el.style.rotate = rot + 'deg';
      broken.push(el);
    });
  }
  function restoreSite() {
    document.documentElement.classList.remove('fool-lock');
    var list = broken; broken = [];
    list.forEach(function (el, i) {
      el.style.transition = 'translate .9s cubic-bezier(.2,.9,.3,1) ' + ((i % 14) * 40) + 'ms, rotate .9s ease-out ' + ((i % 14) * 40) + 'ms';
      el.style.translate = ''; el.style.rotate = '';
    });
    setTimeout(function () { list.forEach(function (el) { el.style.transition = ''; }); }, 2400);
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  function start() {
    if (active) return;
    active = true;
    breakSite();
    var delay = reduceMotion ? 0 : 2000;
    breakTimers.push(setTimeout(function () {
      if (!active) return;
      buildUI(); newGame(); last = 0; acc = 0;
      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('resize', fit);
      raf = requestAnimationFrame(frame);
    }, delay));
  }
  function finish(won) {
    if (!active) return;
    active = false; cancelAnimationFrame(raf);
    breakTimers.forEach(clearTimeout); breakTimers = [];
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('resize', fit);
    keys.up = keys.down = keys.left = keys.right = false; pressA = pressB = false;
    var r = root, s = styleEl; root = null; styleEl = null; cv = null; ctx = null;
    if (r) { r.classList.remove('show'); setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); if (s && s.parentNode) s.parentNode.removeChild(s); }, 550); }
    restoreSite();
    try { document.dispatchEvent(new CustomEvent('julyfool:end', { detail: { won: !!won } })); } catch (e) {}
  }

  window.JulyFool = { start: start, close: function () { finish(false); }, _g: function () { return G; }, _keys: keys };
})();
