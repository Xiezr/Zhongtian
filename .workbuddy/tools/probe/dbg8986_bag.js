/* dbg8986_bag.js —— 调试 v89.51 背包分组断言缺哪个词 */
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
  var G = global.GAME;
  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;
  /* 复现 e2e 步骤 */
  G.state.items = Object.assign({}, G.state.items, { corvee: 1, jinang: 1, kaogongji: 1, lingsui: 3 });
  (G.DATA.ITEMS || []).forEach(function (it) { if (it.type === 'neigong') G.state.items[it.id] = 1; });
  var h = G.ui.bagItemHTML();
  ['秘籍', '政令', '锦囊', '营造', '精华'].forEach(function (w) {
    console.log(w, h.indexOf(w) >= 0);
  });
  ['corvee', 'jinang', 'kaogongji', 'lingsui'].forEach(function (id) {
    var it = (G.DATA.ITEMS || []).filter(function (x) { return x.id === id; })[0];
    console.log('item', id, it ? ('type=' + it.type + ' name=' + it.name) : '（不存在）');
  });
  console.log('h len', h.length);
  var i = h.indexOf('政令'); console.log('政令 idx', i);
  process.exit(0);
})();
