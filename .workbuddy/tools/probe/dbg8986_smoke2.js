/* dbg8986_smoke2.js —— 调试 smoke 新增断言里 P-06 / P-08 的失败原因 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _c = {};
  function mk(t) {
    return { tagName: t || 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {}, scrollTop: 0,
      classList: { _s: {}, add: function () {}, remove: function () {}, toggle: function (k, on) { this._s[k] = !!on; }, contains: function (k) { return !!this._s[k]; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = mk('DIV'); return this._q[sel]; },
      querySelectorAll: function () { return []; },
      getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; } };
  }
  global.document = { createElement: mk, querySelector: function (s) { if (!_c[s]) _c[s] = mk(); return _c[s]; }, querySelectorAll: function () { return []; }, getElementById: function (id) { var k = '#' + id; if (!_c[k]) _c[k] = mk(); return _c[k]; }, addEventListener: function () {}, readyState: 'complete', _cache: _c, body: mk('BODY') };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {}; global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;
  var R = 'E:/Deepseekdb/';
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story'].forEach(function (f) { require(R + 'js/' + f + '.js'); });
  require('fs').readdirSync(R + 'story').filter(function (f) { return /^vol-\d+\.js$/.test(f); }).sort().forEach(function (f) { require(R + 'story/' + f); });
  require(R + 'js/ui.js'); require(R + 'js/main.js');
  var G = global.GAME;
  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;

  /* P-06 分解 */
  console.log('--- P-06 ---');
  console.log('初始 _run =', G.SG._run ? (G.SG._run.st || {}).id : null);
  st.sgPending = [];
  G.SG.TRIG.pin = 'bld-guanfu-01'; G.SG.TRIG._lastAt = 0;
  var fired = G.ui.sgTryTrigger('building', 'guanfu');
  console.log('fired =', fired, ' pending =', st.sgPending.length, ' _run =', G.SG._run ? (G.SG._run.st || {}).id : null);
  G.ui.syncBadges();
  var b = global.document.getElementById('tab-badge-story');
  console.log('badge =', b.textContent, 'hidden =', b.classList.contains('hidden'));
  G.ui.sgReadPending('bld-guanfu-01');
  console.log('read 后 pending =', st.sgPending.length, ' _run =', G.SG._run ? (G.SG._run.st || {}).id : null);
  G.SG.close();
  st.sgPending = [];
  G.SG.list().slice(0, 35).forEach(function (x) { G.SG.defer(x.id); });
  console.log('cap =', st.sgPending.length);
  st.sgPending = [];
  console.log('index badge 存在 =', /id="tab-badge-story"/.test(require('fs').readFileSync(R + 'index.html', 'utf8')));

  /* P-08 分解 */
  console.log('--- P-08 ---');
  var defArmy = null; (G.DATA.RANDOM_QUESTS || []).forEach(function (q) { if (q.metric === 'armyTotal') defArmy = q; });
  console.log('defArmy =', defArmy && defArmy.id);
  var orig = G.maxPopOf;
  G.maxPopOf = function () { return 200; };
  console.log('bad(200) =', G.questReachable(defArmy));
  G.maxPopOf = function () { return 6000; };
  console.log('good(6000) =', G.questReachable(defArmy));
  G.maxPopOf = orig;
  var mis = 0, seen = 0;
  (G.DATA.RANDOM_QUESTS || []).concat(G.DATA.QUESTS || []).forEach(function (q) {
    if (q.metric !== 'troopCount' || !q.sub) return;
    seen++;
    if (!G.DATA.TROOPS[q.sub]) { mis++; console.log('  对不上:', q.id, q.sub); }
  });
  console.log('troopCount sub: seen =', seen, ' mis =', mis);
  process.exit(0);
})();
