/* dbg8986_inn.js —— P-15 调试：打印客栈面板渲染 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _c = {};
  function mk(t) {
    return { tagName: t || 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; } };
  }
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
  var city = st.cities[0];
  city.cells = city.cells || []; city.cells[0] = { build: { id: 'zhaoxianguan', lvl: 1 } }; city.cells[1] = { build: { id: 'kezhan', lvl: 1 } };
  console.log('innLevel', G.innLevel(city));
  var cap0 = G.genSlotsOf(city);
  while (G.generalsIn(city).length < cap0) { st.generals.push({ id: 'pg' + st.generals.length, name: '探针将', level: 1, cityId: city.id, status: 'idle', loyalty: 80, energy: 100, stamina: 100 }); }
  try { G.ui.openInn(); } catch (e) { console.log('openInn 抛错:', e.message, e.stack ? e.stack.split('\n')[1] : ''); }
  var h = document.querySelector('#modal-root').innerHTML;
  console.log('html len', h.length);
  console.log('含 升招贤馆至:', h.indexOf('升招贤馆至') >= 0);
  console.log('含 无空位:', h.indexOf('无空位') >= 0);
  var i = h.indexOf('note-warn');
  console.log('note-warn 段:', JSON.stringify(h.substr(i, 220)));
  i = h.indexOf('inn-recruit');
  console.log('招募按钮段:', JSON.stringify(h.substr(i - 100, 260)));
  process.exit(0);
})();
