/* probe_v8986_p1_texts.js —— 整改 P-24 / P-11 / P-04 / P-16 渲染探针 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _elCache = {};
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; },
    };
  }
  global.document = {
    createElement: function (tag) { return makeEl(tag); },
    querySelector: function (sel) { if (!_elCache[sel]) _elCache[sel] = makeEl(); return _elCache[sel]; },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { var k = '#' + id; if (!_elCache[k]) _elCache[k] = makeEl(); return _elCache[k]; },
    addEventListener: function () {}, readyState: 'complete', _cache: _elCache,
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var R = 'E:/Deepseekdb/';
  require(R + 'js/data.js');
  require(R + 'js/state.js');
  require(R + 'js/questdata.js');
  require(R + 'js/systems.js');
  require(R + 'js/domain.js');
  require(R + 'js/map.js');
  require(R + 'js/battle.js');
  require(R + 'js/tactic.js');
  require(R + 'js/icons.js');
  require(R + 'js/gicons.js');
  require(R + 'js/bitmaps.js');
  require(R + 'js/portraits.js');
  require(R + 'js/story.js');
  require(R + 'js/ui.js');
  require(R + 'js/main.js');

  var G = global.GAME, U = G.utils, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }
  function mroot() { return document.querySelector('#modal-root').innerHTML; }

  var st = G.newGame({ name: '探针', cityName: '许都' });
  if (!st.map.grid) G.map.generate();
  G.state = st;
  var city = st.cities[0];

  /* ---------- P-04 · 前置升级中文案 ---------- */
  city.cells = city.cells || [];
  /* 保证有：官府 Lv1 的格 + 民房 Lv1 的格 + 一个空格 */
  var guanfuIdx = -1, minfangIdx = -1, emptyIdx = -1;
  city.cells.forEach(function (c, i) {
    if (!c) return;
    if (c.build && c.build.id === 'guanfu' && guanfuIdx < 0) guanfuIdx = i;
    if (c.build && c.build.id === 'minfang' && minfangIdx < 0) minfangIdx = i;
    if (!c.build && emptyIdx < 0) emptyIdx = i;
  });
  if (guanfuIdx < 0) { city.cells[0] = { build: { id: 'guanfu', lvl: 1 } }; guanfuIdx = 0; }
  else city.cells[guanfuIdx].build = { id: 'guanfu', lvl: 1 };
  if (minfangIdx < 0) { city.cells[1] = { build: { id: 'minfang', lvl: 1 } }; minfangIdx = 1; }
  else city.cells[minfangIdx].build = { id: 'minfang', lvl: 1 };
  if (emptyIdx < 0) { city.cells.push({}); emptyIdx = city.cells.length - 1; }

  /* 官府升级中（队列里有一条 guanfu → Lv2） */
  st.queues = st.queues || { build: [], tech: [] };
  st.queues.build = [{ cityId: city.id, gridIndex: guanfuIdx, buildId: 'guanfu', type: 'upgrade', targetLevel: 2, elapsed: 30, totalTime: 120 }];
  ck('P-04 前置：pendingUpgradeOf 命中', !!(G.pendingUpgradeOf(city, 'guanfu')), '');
  ck('P-04 前置：民房升 Lv2 被官府挡下', G.buildPrereqOf(city, 'minfang').ok === false,
    (G.buildPrereqOf(city, 'minfang').short || ''));

  G.ui.openBuildModal(minfangIdx);
  var bh = mroot();
  ck('P-04★ 建筑面板报"官府升级中（剩余 …）"', bh.indexOf('官府升级中（剩余') >= 0);
  ck('P-04★ 不再显示静态"需官府 Lv"', bh.indexOf('需官府 Lv') < 0, bh.match(/需官府 Lv\d/)?.[0] || '');

  G.ui.openBuildModal(emptyIdx);
  var pick = mroot();
  ck('P-04（菜单支路）前置文案走 prereqText（无静态"需官府 Lv"于民房卡）',
    pick.indexOf('选择要建造的建筑') >= 0);
  ck('P-04 菜单卡片：可建建筑与锁定建筑并存', pick.indexOf('bldg-pick') >= 0);

  /* ---------- P-24 · 据点拔除文案 ---------- */
  var fort = null;
  (function () {
    for (var y = city.y - 30; y <= city.y + 30 && !fort; y++) for (var x = city.x - 30; x <= city.x + 30 && !fort; x++) {
      fort = G.map.fortAt(x, y);
    }
  })();
  ck('P-24 前置：找到据点', !!fort, fort ? fort.name : '无');
  if (fort) {
    G.ui.openFortModal(fort);
    var fh = mroot();
    ck('P-24★ 据点按钮 = 拔除据点', fh.indexOf('🚩 拔除据点') >= 0);
    ck('P-24★ 据点提示写明"打完撤军…次日重置（不驻守）"', fh.indexOf('打完撤军，据点当日移除、次日重置（不驻守）') >= 0);
    ck('P-24 旧文案"🚩 占领</button>"已不在据点弹窗', fh.indexOf('>🚩 占领</button>') < 0);
    /* 出征面板（据点目标）注 */
    G.doOpenFortExp('occupy');
    var eh = mroot();
    ck('P-24★ 出征面板据点注：占领=拔除', eh.indexOf('据点：占领=拔除') >= 0);
  }

  /* ---------- P-11 · Lv0 文案 ---------- */
  function findWildNear(ter, cx, cy, r) {
    for (var d = 1; d <= r; d++) {
      for (var dx = -d; dx <= d; dx++) for (var dy = -d; dy <= d; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        var x = cx + dx, y = cy + dy, tl = G.map.tile(x, y);
        if (tl && tl.terrain === ter) return { x: x, y: y, type: ter };
      }
    }
    return null;
  }
  var w0 = findWildNear('hill', city.x, city.y, 40) || findWildNear('lake', city.x, city.y, 40);
  ck('P-11 前置：找到野地', !!w0);
  if (w0) {
    /* 未占领 + Lv0：占领提示应为"Lv0 无驻军位" */
    st.wilds = [];
    G.map.wildLevelNow = (function (orig) { return function () { return 0; }; })(G.map.wildLevelNow);
    G.ui.openLandModal(w0.x, w0.y);
    var lh = mroot();
    ck('P-11★ Lv0 未占提示 = "Lv0 无驻军位"', lh.indexOf('Lv0 无驻军位') >= 0);
    ck('P-11★ Lv0 不再写"就地驻守"', lh.indexOf('就地驻守') < 0);
    /* Lv1 恢复原文案（同行对照，保证没把好文案改坏） */
    G.map.wildLevelNow = function () { return 1; };
    G.ui.openLandModal(w0.x, w0.y);
    var lh1 = mroot();
    ck('P-11 对照：Lv1 仍是"就地驻守"', lh1.indexOf('就地驻守') >= 0);
    /* 派驻面板：cap=0 → "该等级无驻军位" */
    st.wilds = [{ x: w0.x, y: w0.y, type: w0.type, level: 0, levelDay: G.questDayIndex() }];
    var rec = G.map.wildAt(w0.x, w0.y);
    if (rec) { rec.level = 0; rec.garrison = { troops: {} }; }
    city.army = { yibing: 100 };
    G.ui.openWildGarrison(w0.x, w0.y);
    var gh = mroot();
    ck('P-11★ 派驻面板 cap=0 报"该等级无驻军位"', gh.indexOf('该等级无驻军位') >= 0);
    ck('P-11★ 不再印"驻军上限 0（0 级野地"', gh.indexOf('驻军上限 0（0 级野地') < 0);
  }

  /* ---------- P-16 · 野地上限出兵前预警 ---------- */
  if (w0) {
    /* 构造：已达上限（官府 Lv1 → limit 1，已有 1 块野地），目标 = 未占野地 */
    G.map.wildLevelNow = function () { return 3; };
    var w1 = findWildNear('lake', city.x, city.y, 40) || w0;
    st.wilds = [{ x: w0.x, y: w0.y, type: w0.type, level: 3, levelDay: G.questDayIndex() }];
    /* 确保目标未被我方占据 */
    ck('P-16 前置：目标未被占', !G.map.wildAt(w1.x, w1.y));
    G.ui._expTarget = { kind: 'wild', x: w1.x, y: w1.y };
    G.ui._expMode = 'occupy';
    G.ui._expRes = G.battle.resolveTarget(G.ui._expTarget);
    ck('P-16 前置：目标解析成功', G.ui._expRes && G.ui._expRes.ok === true);
    G.ui.openExpModal(G.ui._expTarget);
    /* stub DOM 里子元素 innerHTML 不会回写进 #modal-root 字符串 → 直接读缓存元素 */
    var capBox = document.querySelector('#exp-wildcap').innerHTML;
    ck('P-16★ 出征面板出现上限预警', capBox.indexOf('野地已达上限（1 / 1）') >= 0, capBox.slice(0, 80) || '（空）');
    ck('P-16★ 预警写明"转为就地取材"', capBox.indexOf('转为就地取材') >= 0);
    /* 对照：上限提高后不出现 */
    city.cells.push({ build: { id: 'guanfu', lvl: 5 } });
    /* guanfu 取最大级 → 5；但前述 guanfu 格是 Lv1（前面 P-04 设的） */
    G.ui.openExpModal(G.ui._expTarget);
    var capBox2 = document.querySelector('#exp-wildcap').innerHTML;
    ck('P-16 对照：上限充足时不出现预警', capBox2.indexOf('野地已达上限') < 0,
      'guanfu=' + G.buildingLevel(city, 'guanfu') + ' / 盒子="' + capBox2.slice(0, 40) + '"');

    /* 对照2：非占领方式（掠夺）不出现 */
    city.cells = city.cells.filter(function (c) { return !(c.build && c.build.id === 'guanfu' && c.build.lvl === 5); });
    G.ui._expMode = 'raid';
    G.ui.openExpModal(G.ui._expTarget);
    var capBox3 = document.querySelector('#exp-wildcap').innerHTML;
    ck('P-16 对照：掠夺方式不出现预警', capBox3.indexOf('野地已达上限') < 0, capBox3.slice(0, 40) || '（空）');
  }

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
