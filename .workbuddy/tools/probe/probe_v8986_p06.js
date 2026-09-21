/* probe_v8986_p06.js —— 整改 P-06 探针：故事待阅 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _c = {};
  function mk(t) {
    var el = { tagName: t || 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {}, scrollTop: 0,
      classList: { _s: {}, add: function () {}, remove: function () {}, toggle: function (k, on) { this._s[k] = !!on; }, contains: function (k) { return !!this._s[k]; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = mk('DIV'); return this._q[sel]; },
      querySelectorAll: function (sel) { if (sel === '.sgr-bg') return [mk('DIV'), mk('DIV')]; return []; },
      getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; } };
    return el;
  }
  global.document = { createElement: mk, querySelector: function (s) { if (!_c[s]) _c[s] = mk(); return _c[s]; }, querySelectorAll: function () { return []; }, getElementById: function (id) { var k = '#' + id; if (!_c[k]) _c[k] = mk(); return _c[k]; }, addEventListener: function () {}, readyState: 'complete', _cache: _c, body: mk('BODY') };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {}; global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;
  var R = 'E:/Deepseekdb/';
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story'].forEach(function (f) { require(R + 'js/' + f + '.js'); });
  /* 故事卷（与 index.html 同序，全部加载） */
  require('fs').readdirSync(R + 'story').filter(function (f) { return /^vol-\d+\.js$/.test(f); })
    .sort().forEach(function (f) { require(R + 'story/' + f); });
  require(R + 'js/ui.js');
  require(R + 'js/main.js');
  var G = global.GAME, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }

  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;
  st.sgPending = [];

  /* ① 触发入待阅（不再开全屏） */
  G.SG.TRIG.pin = 'bld-guanfu-01'; G.SG.TRIG._lastAt = 0;
  var fired = G.ui.sgTryTrigger('building', 'guanfu');
  ck('① 触发返回 true（命中）', fired === true);
  ck('① 入待阅（1 条 · 标题/锚点齐）', (st.sgPending || []).length === 1
    && st.sgPending[0].sid === 'bld-guanfu-01' && !!st.sgPending[0].title && st.sgPending[0].kind === 'building',
    JSON.stringify(st.sgPending[0] || {}));
  ck('① 全屏阅读器未打开（_run 为空）', !G.SG._run);

  /* ② 重复触发同篇 → 不重复入列 */
  G.SG.TRIG._lastAt = 0;
  G.ui.sgTryTrigger('building', 'guanfu');
  ck('② 同篇重复触发不重复入列', (st.sgPending || []).length === 1, String(st.sgPending.length));

  /* ③ 动作触发同样入待阅 */
  var pF = G.SG.actPool('tech-done');
  var pinF = (pF.fresh[0] || pF.done[0]).st.id;
  G.SG.TRIG.pin = pinF; G.SG.TRIG._actAt = {};
  G.ui.sgTryAct('tech-done');
  ck('③ 动作触发入待阅（' + pinF + '）', (st.sgPending || []).some(function (x) { return x.sid === pinF; }),
    String(st.sgPending.length));

  /* ④ 徽标与待阅数一致 */
  G.ui.syncBadges();
  var badge = document.getElementById('tab-badge-story');
  ck('④ 顶栏史册徽标 = 待阅数', Number(badge.textContent) === st.sgPending.length && !badge.classList.contains('hidden'),
    badge.textContent);

  /* ⑤ 史册页渲染待阅区 */
  var h = G.ui.storyHTML();
  ck('⑤ 史册页含「待阅逸闻」区与阅读/忽略按钮',
    h.indexOf('待阅逸闻') >= 0 && h.indexOf('data-action="story-read"') >= 0 && h.indexOf('data-action="story-drop"') >= 0);

  /* ⑥ 阅读：出列 + 打开阅读器 */
  G.ui.sgReadPending('bld-guanfu-01');
  ck('⑥ 阅读后出列', !(st.sgPending || []).some(function (x) { return x.sid === 'bld-guanfu-01'; }));
  ck('⑥ 阅读器打开（第 1 段）', !!G.SG._run && G.SG._run.st.id === 'bld-guanfu-01');
  G.SG.close();

  /* ⑦ 忽略：出列且不开卷 */
  var n0 = st.sgPending.length;
  G.ui.sgDropPending(pinF);
  ck('⑦ 忽略后出列且不开卷', st.sgPending.length === n0 - 1 && (!G.SG._run || G.SG._run.st.id !== pinF));

  /* ⑧ 上限 30：灌 35 条只留 30（先删最旧） */
  st.sgPending = [];
  var ids = G.SG.list().slice(0, 35).map(function (x) { return x.id; });
  ids.forEach(function (sid) { G.SG.defer(sid); });
  ck('⑧ 待阅上限 30 条', st.sgPending.length === 30 &&
    st.sgPending[0].sid === ids[5] && st.sgPending[29].sid === ids[34], st.sgPending.length + ' 条');

  /* ⑨ 待阅入档（序列化含 sgPending） */
  var payload = G.savePayload();
  ck('⑨ 待阅随存档序列化', payload.indexOf('sgPending') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
