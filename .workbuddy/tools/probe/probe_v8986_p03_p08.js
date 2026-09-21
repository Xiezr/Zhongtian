/* probe_v8986_p03_p08.js —— 整改 P-03（前往）/ P-08（可达性过滤）探针 */
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
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) { require(R + 'js/' + f + '.js'); });
  var G = global.GAME, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }
  function mroot() { return document.querySelector('#modal-root').innerHTML; }

  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;
  var city = st.cities[0];

  /* ---------- P-08 · 可达性 ---------- */
  var defArmy = null, defTieqi = null, defMinfang = null;
  G.DATA.RANDOM_QUESTS.forEach(function (q) {
    if (q.metric === 'armyTotal') defArmy = q;
    if (q.metric === 'troopCount' && q.sub === 'tieji') defTieqi = q;
    if (q.id === 'r18') defMinfang = q;
  });
  /* 人口上限压低 */
  city.cells = city.cells || [];
  city.cells.forEach(function (c) { if (c && c.build && c.build.id === 'minfang') c.build.lvl = 1; });
  var popCap = G.maxPopOf(city);
  st.cities.forEach(function (c2) { c2.maxPop = Math.min(c2.maxPop || popCap, popCap); });
  ck('P-08 前置：人口上限样本 < 500', popCap < 500, 'popCap=' + popCap);
  G.maxPopOf = (function (orig) { return function (ct) { return Math.min(orig.call(G, ct) || 0, 200); }; })(G.maxPopOf);
  ck('P-08★ 养兵 500 vs 人口上限 200 → 不可达', G.questReachable(defArmy) === false, 'goal=' + defArmy.goal);
  G.maxPopOf = (function () { return function () { return 5000; }; })();
  ck('P-08 人口上限 5000 → 可达', G.questReachable(defArmy) === true);
  ck('P-08★ 未解锁兵种（铁骑）→ 不可达', G.questReachable(defTieqi) === false, 'unlock=' + JSON.stringify(G.DATA.TROOPS.tieji.unlock));
  city.cells[3] = { build: { id: 'junying', lvl: 10 } };
  city.cells[4] = { build: { id: 'majiu', lvl: 10 } };
  city.cells[5] = { build: { id: 'shuyuan', lvl: 10 } };
  ck('P-08 解锁后（军营10 + 马厩10）→ 可达', G.questReachable(defTieqi) === true);

  /* 生成侧：连续强制刷新 40 批，不该出现不可达项 */
  var seen = 0, bad = 0;
  for (var i = 0; i < 40; i++) {
    st.quests.pool = []; st.quests.poolDay = -1;
    G.ensureDailyQuests(true);
    (st.quests.pool || []).forEach(function (e) {
      var d = G.randomQuestDef(e.id);
      if (!d) return;
      seen++;
      if (!G.questReachable(d)) bad++;
    });
  }
  ck('P-08★ 40 批生成无不可达项', bad === 0, seen + ' 项中不可达 ' + bad);

  /* ---------- P-03 · 前往映射 ---------- */
  function defOf(id) { var out = null; (G.DATA.QUESTS || []).forEach(function (q) { if (q.id === id) out = q; }); return out; }
  var g01 = defOf('g01');    /* bldCount minfang */
  var g15 = defOf('g15');    /* techLevel zhongzhi */
  var g19 = defOf('g19');    /* trainTotal */
  var j1 = G.ui.questJumpOf(g01), j2 = G.ui.questJumpOf(g15), j3 = G.ui.questJumpOf(g19);
  ck('P-03 映射：建筑类 → 城池', j1 && j1.view === 'city');
  ck('P-03 映射：科技类 → 科技面板', j2 && j2.view === 'tech');
  ck('P-03 映射：军事类 → 兵营', j3 && j3.view === 'troops');

  /* 详情页 foot 含「前往」 */
  G.ui.openQuestDetail('growth', 'g01');
  ck('P-03★ 任务详情含「前往」按钮', /data-action="quest-go"[^>]*data-id="g01"/.test(mroot()));

  /* 执行：把民房全拆掉 → 前往应开「建造选择器」（城内空地） */
  city.cells.forEach(function (c, i) { if (c && c.build && c.build.id === 'minfang') city.cells[i] = {}; });
  G.ui.doQuestGo('growth', 'g01');
  ck('P-03★ 无民房时前往 → 开建造选择器', mroot().indexOf('选择要建造的建筑') >= 0, 'view=' + G.ui.view);
  /* 有民房 → 直开该格面板 */
  city.cells[6] = { build: { id: 'minfang', lvl: 2 } };
  G.ui.doQuestGo('growth', 'g01');
  var h2 = mroot();
  ck('P-03★ 有民房时前往 → 直开该格（民房面板 · Lv2）',
    h2.indexOf('民房') >= 0 && h2.indexOf('Lv2') >= 0 && h2.indexOf('选择要建造的建筑') < 0);
  /* 科技类 → 切到科技视图（面板/视图均可，判 ui.view） */
  G.ui.doQuestGo('growth', 'g15');
  ck('P-03 科技类前往 → ui.view = tech', G.ui.view === 'tech', G.ui.view);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
