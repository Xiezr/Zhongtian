/* probe_v8986_p07.js —— 整改 P-07 探针：建造 / 科技队列花金提速 */
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
  st.settings.timeScale = 120;
  st.res.gold = 5000000;

  /* ---------- ① 城内建造队列：计价与支付 ---------- */
  st.queues.build = [];
  var b = G.DATA.BUILDINGS.minfang;
  var cost0 = b.levelCost(1);
  st.queues.build.push({ cityId: city.id, gridIndex: 0, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 30, totalTime: 120 });
  var q1 = G.queueAt('city', 0);
  ck('① queueAt 命中城内工程', !!q1);
  var price = G.queueRushCost(q1);
  /* 剩余 90/120=0.75；造价和 = 粮+木+石+铁；价 = ceil(和×0.2×0.75) */
  var sumV = (cost0.grain || 0) + (cost0.wood || 0) + (cost0.stone || 0) + (cost0.iron || 0);
  var want = Math.max(1, Math.ceil(sumV * 0.2 * 0.75));
  ck('① 价 = 工程价 20% × 剩余比例', price === want, price + ' vs ' + want);
  var gold0 = st.res.gold;
  var r1 = G.queueRushPay(q1, '营造工程');
  ck('① 支付成功 · 金扣减 · 队列已满进度', r1.ok === true && st.res.gold === gold0 - price && q1.elapsed === q1.totalTime,
    r1.msg + ' / gold ' + gold0 + '→' + st.res.gold);
  ck('① 已完工的再提速 → 拒绝', G.queueRushPay(q1).ok === false);
  /* 主循环一拍后落成 */
  G.applyBuildDone(q1);
  st.queues.build = [];
  ck('① 结算走后既有出口（不新开旁路）', typeof G.applyBuildDone === 'function');

  /* ---------- ② 金不足 → 拒绝且不动账 ---------- */
  st.queues.build = [{ cityId: city.id, gridIndex: 1, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 0, totalTime: 120 }];
  var q2 = G.queueAt('city', 1);
  st.res.gold = 1;
  var r2 = G.queueRushPay(q2, '营造工程');
  ck('② 金不足 → 拒绝 · 不动账 · 进度不变', r2.ok === false && st.res.gold === 1 && q2.elapsed === 0, r2.msg);
  st.res.gold = 5000000;

  /* ---------- ③ 科技队列：计价与支付 ---------- */
  st.queues.tech = [{ techId: 'zhongzhi', elapsed: 0, totalTime: 600 }];
  var q3 = G.queueAt('tech');
  ck('③ queueAt 命中科技队列', !!q3 && q3.techId === 'zhongzhi');
  var t = null; G.DATA.TECH.forEach(function (x) { if (x.id === 'zhongzhi') t = x; });
  var tc = G.DATA.techCost(t, (st.techs.zhongzhi || 0) + 1);
  var want3 = Math.max(1, Math.ceil(((tc.gold || 0) + (tc.wood || 0) + (tc.stone || 0)) * 0.2 * 1));
  ck('③ 科技提速价 = 研究费 20% × 剩余比例', G.queueRushCost(q3) === want3, G.queueRushCost(q3) + ' vs ' + want3);
  var r3 = G.queueRushPay(q3, '科技研究');
  ck('③ 科技提速支付', r3.ok === true && q3.elapsed === q3.totalTime, r3.msg);

  /* ---------- ④ 城墙 / 城外 ---------- */
  st.queues.build = [{ cityId: city.id, type: 'wall', buildId: 'chengqiang', targetLevel: 1, elapsed: 0, totalTime: 60 }];
  ck('④ queueAt 命中城墙工程', !!G.queueAt('wall'));
  ck('④ 城墙工程有价（>0）', G.queueRushCost(G.queueAt('wall')) > 0, String(G.queueRushCost(G.queueAt('wall'))));
  st.queues.build = [{ cityId: city.id, extIdx: 2, buildId: 'farm', type: 'ext_build', elapsed: 10, totalTime: 100 }];
  ck('④ queueAt 命中城外工程', !!G.queueAt('ext', 2));
  ck('④ 城外工程有价（>0）', G.queueRushCost(G.queueAt('ext', 2)) > 0, String(G.queueRushCost(G.queueAt('ext', 2))));

  /* ---------- ⑤ 入口按钮 ---------- */
  st.queues.build = [{ cityId: city.id, gridIndex: 0, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 10, totalTime: 120 }];
  city.cells[0].pending = { buildId: 'minfang', targetLevel: 2 };
  G.ui.openBuildModal(0);
  ck('⑤ 城内施工面板含 ⚡ 提速按钮', mroot().indexOf('data-action="rush-build"') >= 0);
  G.ui.closeModal();
  city.cells.forEach(function (c) { if (c) c.pending = null; });
  st.queues.build = [];
  st.queues.tech = [];          /* 清空科技队列 → 空态 */
  G.ui.openPanel('tech');
  ck('⑤ 科技面板无研究中时不显示提速按钮（空态）', mroot().indexOf('data-action="rush-tech"') < 0);
  st.queues.tech = [{ techId: 'zhongzhi', elapsed: 60, totalTime: 600 }];
  G.ui.openPanel('tech');
  ck('⑤ 科技面板研究中时含 ⚡ 提速按钮', mroot().indexOf('data-action="rush-tech"') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
