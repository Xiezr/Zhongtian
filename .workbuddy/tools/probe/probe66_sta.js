/* ============================================================
 * probe66_sta.js —— v66 体力链因子表（给老板看的数字，不是结论）
 * 打印：不同"等级/资质 + 装备档"下的 体力上限 / 全军生命加成 / 出征门槛占比
 * 用法: node .workbuddy/tmp/probe66_sta.js
 * ============================================================ */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  function makeEl(tag) {
    return { tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
      getContext: function () { var noop = function () {}; return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: noop, drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, arc: noop, ellipse: noop, save: noop, restore: noop, clip: noop, rect: noop, translate: noop, scale: noop, rotate: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop, closePath: noop, quadraticCurveTo: noop, bezierCurveTo: noop, fillText: noop, strokeText: noop, setLineDash: noop, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: noop }; }, createRadialGradient: function () { return { addColorStop: noop }; }, createPattern: function () { return null; }, roundRect: noop }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; } };
  }
  var _c = {};
  global.document = { createElement: makeEl, querySelector: function (s) { if (!_c[s]) _c[s] = makeEl(); return _c[s]; },
    querySelectorAll: function () { return []; }, addEventListener: function () {}, readyState: 'complete', _cache: _c };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  require('../../../Deepseekdb/js/data.js');
  require('../../../Deepseekdb/js/state.js');
  require('../../../Deepseekdb/js/questdata.js');
  require('../../../Deepseekdb/js/systems.js');
  require('../../../Deepseekdb/js/domain.js');

  var G = global.GAME, DATA = G.DATA;
  var st = G.newGame({ name: 'probe66' });
  G.state = st;
  st.techs = st.techs || {};

  var crAll = {};
  DATA.EQUIP_SLOTS.forEach(function (sl) { crAll[sl] = 'cr_' + sl + '_4'; });
  var ytAll = { head: 'yt_helm', neck: 'yt_neck', shoulder: 'yt_should', chest: 'yt_chest', back: 'yt_back',
    waist: 'yt_waist', arm: 'yt_arm', feet: 'yt_feet', ring: 'yt_ring', pendant: 'yt_pend',
    weapon: 'yt_sword', mount: 'jueying' };

  var CASES = [
    ['凡品 Lv1 · 无装', 'fan', 1, {}],
    ['凡品 Lv1 · 2件神品散件', 'fan', 1, { head: 'cr_head_4', chest: 'cr_chest_4' }],
    ['凡品 Lv60 · 无装', 'fan', 60, {}],
    ['凡品 Lv60 · 12件神品散件', 'fan', 60, crAll],
    ['良材 Lv100 · 12件神品散件', 'liang', 100, crAll],
    ['天授 Lv240 · 无装', 'tian', 240, {}],
    ['天授 Lv240 · 倚天3件', 'tian', 240, { head: 'yt_helm', neck: 'yt_neck', shoulder: 'yt_should' }],
    ['天授 Lv240 · 倚天12件', 'tian', 240, ytAll],
  ];

  var modes = ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).filter(function (m) { return m.stamina; });
  var minCost = modes.length ? Math.min.apply(null, modes.map(function (m) { return m.stamina; })) : 0;
  var maxCost = modes.length ? Math.max.apply(null, modes.map(function (m) { return m.stamina; })) : 0;

  function pad(s, n) { var o = String(s); while (o.length < n) o += ' '; return o; }
  function lpad(s, n) { var o = String(s); while (o.length < n) o = ' ' + o; return o; }

  console.log('');
  console.log('v66 体力链因子表');
  console.log('公式：全军生命加成 = ' + DATA.STAMINA.hpCap + ' × 体力 / (体力 + ' + DATA.STAMINA.hpK
    + ')，渐近上限 +' + (DATA.STAMINA.hpCap * 100) + '%（DATA.STAMINA.hpCap / hpK 是唯一旋钮）');
  console.log('出征体力消耗：最便宜 ' + minCost + '，最贵 ' + maxCost + '（门槛列 = 最贵那次占上限的比例）');
  console.log('────────────────────────────────────────────────────────────────────');
  console.log(pad('情形', 24) + lpad('体力上限', 10) + lpad('装备贡献', 10) + lpad('全军生命', 10) + lpad('最贵出征', 10));
  console.log('────────────────────────────────────────────────────────────────────');
  CASES.forEach(function (c) {
    var g = { level: c[2], nz: 50, rank: c[1], style: 'balance', tong: 50, yw: 50, zm: 50,
      speed: 10, attack: 0, defense: 0, equip: c[3], perm: {} };
    var mx = G.staMax(g), eq = Math.round(G.staEquipOf(g));
    console.log(pad(c[0], 24) + lpad(mx, 10) + lpad('+' + eq, 10)
      + lpad((G.staHpBonus(g) * 100).toFixed(1) + '%', 10)
      + lpad((maxCost / mx * 100).toFixed(1) + '%', 10));
  });
  console.log('────────────────────────────────────────────────────────────────────');
  console.log('说明：最贵出征占上限 <2% 即"体力再也拦不住出征"，止血散（10% 上限）一剂回一大截。');
  console.log('');
})();
