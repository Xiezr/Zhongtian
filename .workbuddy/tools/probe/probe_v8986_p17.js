/* probe_v8986_p17.js —— 整改 P-17 探针：离线推进上限 + 五折折算 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _c = {};
  function mk(t) { return { tagName: t || 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {}, classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } }, addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; }, getAttribute: function (k) { return this._attrs[k] || null; }, getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; }, getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
  global.document = { createElement: mk, querySelector: function (s) { if (!_c[s]) _c[s] = mk(); return _c[s]; }, querySelectorAll: function () { return []; }, getElementById: function (id) { var k = '#' + id; if (!_c[k]) _c[k] = mk(); return _c[k]; }, addEventListener: function () {}, readyState: 'complete', _cache: _c };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {}; global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;
  var R = 'E:/Deepseekdb/';
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) { require(R + 'js/' + f + '.js'); });
  var G = global.GAME, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }

  /* 两轮对拍：同一初始状态，cap=0（全量） vs cap=7（截断+五折） */
  function run(secReal, capDays) {
    var st = G.newGame({ name: 'x', cityName: '许都' });
    if (!st.map.grid) G.map.generate();
    G.state = st;
    st.settings.timeScale = 120;
    st.settings.offlineCapDays = capDays;
    st.world.elapsed = st.world.elapsed || 0;
    var e0 = st.world.elapsed;
    var g0 = st.res.grain || 0;
    /* 关闭随机干扰源便于对拍：无将无兵（离职/哗变无关） */
    st.generals = [];
    st.cities.forEach(function (c) { c.army = {}; });
    G.offlineCatchup(secReal);
    return {
      dElapsed: st.world.elapsed - e0,
      dGrain: (st.res.grain || 0) - g0,
      overflow: G._offlineOverflow || 0,
      cap: G.offlineCapDays(),
    };
  }

  var SEC = 36576;                       // 10.16 小时
  var full = run(SEC, 0);
  var capped = run(SEC, 7);
  console.log('     全量：elapsed+' + full.dElapsed + ' 粮+' + Math.round(full.dGrain) + ' overflow=' + full.overflow);
  console.log('     上限7日：elapsed+' + Math.round(capped.dElapsed) + ' 粮+' + Math.round(capped.dGrain) + ' overflow=' + Math.round(capped.overflow));

  ck('① 全量（不限）：历法按满额推进（≈50.8 游戏日）',
    Math.abs(full.dElapsed - SEC * 120) < SEC, 'Δ=' + full.dElapsed);
  ck('① 全量无溢出段', full.overflow === 0);
  ck('② 上限 7 日：历法只推进 7 游戏日', Math.abs(capped.dElapsed - 7 * 86400) < 2000, 'Δ=' + Math.round(capped.dElapsed));
  ck('② 溢出段被识别', capped.overflow > 30000, 'overflow=' + Math.round(capped.overflow));
  var ratio = capped.dGrain / full.dGrain;
  /* 期望 ≈ (applied + 0.5×overflow)/total = (5040 + 15768)/36576 = 0.5696 */
  ck('③ 资源折算 ≈ 五折（56.96% ±6pp）', ratio > 0.50 && ratio < 0.64, '实测 ' + (ratio * 100).toFixed(1) + '%');

  /* ④ 上限 30 日：10.16h@120× = 50.8 日 > 30 日 → 有溢出但历法推进 30 日 */
  var c30 = run(SEC, 30);
  ck('④ 上限 30 日：历法推进 30 游戏日', Math.abs(c30.dElapsed - 30 * 86400) < 2000, 'Δ=' + Math.round(c30.dElapsed));
  ck('④ 上限 30 日仍有溢出（50.8 > 30）', c30.overflow > 10000, 'overflow=' + Math.round(c30.overflow));

  /* ⑤ 默认值（settings 缺失 → 7） */
  var stD = G.newGame({ name: 'x', cityName: '许都' });
  if (!stD.map.grid) G.map.generate();
  G.state = stD;
  delete stD.settings.offlineCapDays;
  ck('⑤ 未设置时默认 7 日', G.offlineCapDays() === 7, String(G.offlineCapDays()));

  /* ⑥ 设置卡渲染 */
  var h = G.ui.settingsHTML();
  ck('⑥ 设置页含「离线推进上限」卡与 chips', h.indexOf('离线推进上限') >= 0 && h.indexOf('data-after="offlinecap"') >= 0);
  ck('⑥ 含 1/3/7/30/不限 五档', /data-v="1"/.test(h) && /data-v="30"/.test(h) && /data-v="0"/.test(h) && h.indexOf('不限') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
