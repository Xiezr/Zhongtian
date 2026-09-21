/* probe_v8986_p21.js —— 整改 P-21 探针：门派任务连做 */
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
  function mroot() { return document.querySelector('#modal-root').innerHTML; }

  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;
  /* 前置：门派驻地（honglusi）；入派门槛读 GAME.sectChk() */
  var city = st.cities[0];
  city.cells = city.cells || [];
  if (!city.cells.some(function (c) { return c && c.build && c.build.id === 'honglusi'; })) {
    city.cells[5] = { build: { id: 'honglusi', lvl: 1 } };
  }
  var join = G.doSectJoin('qingfeng');
  ck('前置：入派青锋阁', join.ok === true, join.msg);
  st.res.gold = 5000000;
  var stt = G.sectState();
  stt.tasks = {};                      /* 清空今日计数，保证起点干净 */
  var dayKey = G.questDayIndex();

  /* ---------- ① 连做 ×10 ---------- */
  var rep0 = stt.rep;
  var r1 = G.doSectTaskBulk('chores', 10);
  ck('① 连做 ×10 成功计数', r1.ok === true && r1.count === 10, r1.msg);
  ck('① 声望正确累加（12×10）', stt.rep - rep0 === 120, '+' + (stt.rep - rep0));
  ck('① 日计数正确（10）', (stt.tasks[dayKey] || 0) === 10, String(stt.tasks[dayKey] || 0));

  /* ---------- ② 一键做完 → 到日额上限停止 ---------- */
  var r2 = G.doSectTaskBulk('chores', 0);
  ck('② 一键做完补满日额（再 30 次）', r2.ok === true && r2.count === 30, r2.msg);
  ck('② 日额封顶 40', (stt.tasks[dayKey] || 0) === 40, String(stt.tasks[dayKey]));
  var r3 = G.doSectTaskBulk('chores', 10);
  ck('② 到顶后再连做 → 拒绝且不动账', r3.ok === false && (stt.tasks[dayKey] || 0) === 40, r3.msg);

  /* ---------- ③ 资源不足 → 中途停止并说明 ---------- */
  stt.tasks = {};                       /* 归零再来 */
  st.res.gold = 30000;                  /* 只够一次演武（3 万）*/
  var rep1 = stt.rep;
  var r4 = G.doSectTaskBulk('drill', 10);
  ck('③ 资源只够 1 次 → 做 1 次即停', r4.ok === true && r4.count === 1 && r4.stopped === true, r4.msg);
  ck('③ 停止原因在文案里', /不敷所费/.test(r4.msg), r4.msg);
  ck('③ 声望只加 1 次（80）', stt.rep - rep1 === 80, '+' + (stt.rep - rep1));
  ck('③ 三次连做不动余额（不预检）', (st.res.gold || 0) === 0, 'gold=' + st.res.gold);

  /* ---------- ④ 面板含连做按钮 ---------- */
  stt.tasks = {};
  st.res.gold = 500000;
  G.ui.openSect();
  var h = mroot();
  ck('④ 面板含「连做 ×10」按钮', h.indexOf('data-action="sect-task-bulk"') >= 0 && h.indexOf('连做 ×10') >= 0);
  ck('④ 面板含「一键做完」按钮', h.indexOf('一键做完') >= 0);
  ck('④ 连做按钮带 n=10 与 n=0 两档', /data-n="10"/.test(h) && /data-n="0"/.test(h));

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
