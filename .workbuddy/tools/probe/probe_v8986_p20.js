/* probe_v8986_p20.js —— 整改 P-20 探针：军务总览五段 */
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

  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;
  var city = st.cities[0];
  st.mainCityId = city.id;                 /* 主城标：新档默认未设，官府里设 —— 探针直接设 */
  city.army = { changqiang: 200, yibing: 91 };

  /* 二城：验证"全境"口径 */
  var c2 = G.makeCity({ id: 'new_9_9', name: '新城2', x: city.x + 3, y: city.y + 3, type: 'self', state: '' });
  c2.army = { minfu: 30 };
  st.cities.push(c2);

  /* 驻守野地：两块 */
  st.wilds = [
    { x: 100, y: 100, type: 'lake', level: 3, garrison: { cityId: city.id, troops: { changqiang: 60 } } },
    { x: 101, y: 101, type: 'forest', level: 2, garrison: { cityId: city.id, troops: { yibing: 31 } } },
    { x: 102, y: 102, type: 'hill', level: 1, garrison: { troops: {} } },   /* 无驻军 —— 不应出现 */
  ];

  /* 采集队：一支 */
  st._gatherSeq = 0;
  st.gathers = [{ id: 'ga1', x: 100, y: 100, type: 'lake', level: 3, genId: null, army: { yibing: 20 }, troops: 20, cityId: city.id, elapsed: 7200, origin: 'garrison' }];

  /* 行军：一支（从二城出发 —— 验证全境口径） */
  var gen = st.generals[0]; gen.status = 'march';
  st.marches = [{ id: 'mr1', cityId: c2.id, genId: gen.id, modeId: 'raid', target: { kind: 'wild', x: 110, y: 110 }, tx: 110, ty: 110, name: '森林 Lv2', kind: 'wild', army: { minfu: 30 }, elapsed: 10, totalTime: 120, scheme: null }];

  /* 伤兵 */
  st.wounded = 42; st.woundedArmy = { changqiang: 42 };

  var h = G.ui.marchesHTML();
  ck('① 标题 = 军务总览', h.indexOf('⚔ 军务总览') >= 0);
  ck('① 汇总行含五段数字（在城 321 / 驻守 91 / 采集 20 / 行军 30 / 伤兵 42）',
    h.indexOf('在城 321') >= 0 && h.indexOf('驻守 91') >= 0 && h.indexOf('采集 20') >= 0 &&
    h.indexOf('行军 30') >= 0 && h.indexOf('伤兵 42') >= 0);
  ck('② 五段标题齐（城内/驻守野地/采集队/行军/伤兵）',
    h.indexOf('① 城内') >= 0 && h.indexOf('② 驻守野地') >= 0 && h.indexOf('③ 采集队') >= 0 &&
    h.indexOf('④ 行军') >= 0 && h.indexOf('⑤ 伤兵') >= 0);
  ck('③ 城内段列出两城（许都含主城标 + 新城2）', h.indexOf('许都') >= 0 && h.indexOf('新城2') >= 0 && h.indexOf('主城') >= 0);
  ck('③ 驻守段两块野地 + 兵种明细 + 增派/召回按钮',
    h.indexOf('湖泊 Lv3') >= 0 && h.indexOf('长枪兵 60') >= 0 &&
    h.indexOf('data-action="wild-garrison-open"') >= 0 && h.indexOf('data-action="wild-withdraw"') >= 0);
  ck('③ 无驻军野地不出现在驻守段', h.indexOf('山地 Lv1') < 0);
  ck('④ 采集段：驻军开采角标 + 收获/撤回', h.indexOf('驻军开采') >= 0 && h.indexOf('data-action="gather-finish"') >= 0);
  ck('⑤ 行军段为全境口径（含二城出发的队列 · 出发列）',
    h.indexOf('data-action="march-recall"') >= 0 && h.indexOf('新城2') >= 0 && h.indexOf('出发') >= 0);
  ck('⑥ 伤兵段复用 woundedBlock（治疗按钮在）', h.indexOf('🏥 伤兵营') >= 0 && h.indexOf('data-action="heal-wounded"') >= 0);

  /* 空态对照 */
  st.wilds = []; st.gathers = []; st.marches = []; st.wounded = 0;
  var h2 = G.ui.marchesHTML();
  ck('⑦ 空态三连（驻守/采集/行军空提示）',
    h2.indexOf('暂无野地驻军') >= 0 && h2.indexOf('暂无在外采集队') >= 0 && h2.indexOf('没有在途行军队列') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
