/* probe_v8986_p18.js —— 整改 P-18 探针：自动化预算闸门 */
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

  /* ---------- ① autoBudgetCheck 口径 ---------- */
  st.settings.autoReservePct = 5;
  st.res.stone = 100000;
  var r1 = G.autoBudgetCheck({ stone: 50000 });
  ck('① 花 5 万（余 5 万 ≥ 5%）→ 放行', r1.ok === true);
  var r2 = G.autoBudgetCheck({ stone: 96000 });
  ck('① 花 9.6 万（余 4000 < 5%）→ 拦下', r2.ok === false, r2.msg);
  st.settings.autoReservePct = 0;
  ck('① 设为 0（不设限）→ 放行一切', G.autoBudgetCheck({ stone: 100000 }).ok === true);
  st.settings.autoReservePct = 5;

  /* ---------- ② autoUpgrade：闸门跳过 / 全挡暂停 ---------- */
  city.cells = city.cells || [];
  city.cells[0] = { build: { id: 'guanfu', lvl: 1 } };
  city.cells[1] = { build: { id: 'minfang', lvl: 1 } };
  city.extGrid = [];                       /* 去掉城外候选，保持场景确定 */
  city.wallLv = 12;                        /* 城墙满 → 不进候选 */
  st.queues = st.queues || { build: [], tech: [] };
  function clearPend() {
    st.queues.build = [];
    city.cells.forEach(function (c) { if (c) c.pending = null; });
  }
  st.settings.autoUpgrade = true;
  clearPend();
  st.res.grain = 100000; st.res.wood = 100000; st.res.stone = 100000; st.res.iron = 100000; st.res.gold = 100000;
  var rOk = G.autoUpgrade();
  ck('② 正常资源下自动升级可下单', !!rOk && rOk.ok === true, rOk && rOk.msg);
  clearPend();
  /* 资源压到地板：任何升级都会击穿 5% 线 → 全部候选被挡 → 暂停（gated） */
  st.res.grain = 1; st.res.wood = 1; st.res.stone = 1; st.res.iron = 1; st.res.gold = 1;
  var rGate = G.autoUpgrade();
  ck('② 全部候选击穿保留线 → 暂停（gated）', !!rGate && rGate.paused === true && rGate.gated === true,
    rGate && (rGate.reason || rGate.msg));
  ck('② 暂停语提到"保留下限"', /保留下限|预算闸门/.test((st.autoState && st.autoState.msg) || ''), (st.autoState || {}).msg);
  /* 关闸门（0%）→ 资源不足会走「资源不足」暂停（口径回归），不再是 gated */
  st.settings.autoReservePct = 0;
  var rGate0 = G.autoUpgrade();
  ck('② 闸门关（0%）→ 回到"资源不足"语义（不再 gated）',
    !!rGate0 && rGate0.paused === true && !!rGate0.reason && /不足/.test(rGate0.reason),
    rGate0 && (rGate0.reason || rGate0.msg));
  st.settings.autoReservePct = 5;

  /* 手动不受影响：upgradeAt 照常（资源够即可，不看保留线） */
  clearPend();
  var costMan = G.DATA.BUILDINGS.guanfu.levelCost(1);
  st.res.grain = costMan.grain; st.res.wood = costMan.wood; st.res.stone = costMan.stone; st.res.iron = costMan.iron;
  var rMan = G.upgradeAt(city.id, 0);
  ck('② 手动升级不受闸门影响（同一资源量可下单）', rMan.ok === true, rMan.msg);
  clearPend();

  /* ---------- ③ autoResearch 上限 ---------- */
  city.cells[2] = { build: { id: 'shuyuan', lvl: 10 } };
  st.techs = {}; (G.DATA.TECH || []).forEach(function (t) { st.techs[t.id] = 0; });
  st.techs.zhongzhi = 5;                  /* 已到 5 */
  st.settings.autoResearch = true;
  st.settings.autoTechMaxLv = 3;
  st.res.gold = 9999999; st.res.wood = 9999999; st.res.stone = 9999999; st.res.grain = 9999999; st.res.iron = 9999999;
  st.queues.tech = [];
  G.autoResearch();
  var qT = st.queues.tech[0];
  var picked = qT ? qT.techId : undefined;
  ck('③ 自动研究只挑 lv < 上限(3) 的科技（zhongzhi 已 Lv5 不被挑）',
    !!picked && picked !== 'zhongzhi' && (st.techs[picked] || 0) < 3,
    'picked=' + picked + ' 状态=' + ((st.autoTechState || {}).msg));
  /* 把手动把全部科技都推到 3 —— 上限内无可研 → 应报"已到自动研究上限" */
  st.queues.tech = [];
  (G.DATA.TECH || []).forEach(function (t) { st.techs[t.id] = 3; });
  var rT2 = G.autoResearch();
  ck('③ 上限内全部到顶 → 报"已到自动研究上限"',
    /上限/.test((st.autoTechState && st.autoTechState.msg) || ''), (st.autoTechState || {}).msg);

  /* ---------- ④ autoReserveLine ---------- */
  st.settings.autoTechMaxLv = 5;
  var line = G.ui.autoReserveLine();
  ck('④ 现状行含保留比例与研究上限', line.indexOf('5%') >= 0 && line.indexOf('Lv5') >= 0, line);
  st.settings.autoReservePct = 0;
  ck('④ 不设限文案正确', G.ui.autoReserveLine().indexOf('不设下限') >= 0, G.ui.autoReserveLine());

  /* ---------- ⑤ 自动化页渲染 ---------- */
  st.settings.autoReservePct = 10; st.settings.autoTechMaxLv = 3;
  var h = G.ui.autoHTML();
  ck('⑤ 自动化页含"预算闸门"卡', h.indexOf('预算闸门') >= 0);
  ck('⑤ 含两个 chirp 组（reservePct / techMaxLv）', h.indexOf('data-k="reservePct"') >= 0 && h.indexOf('data-k="techMaxLv"') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
