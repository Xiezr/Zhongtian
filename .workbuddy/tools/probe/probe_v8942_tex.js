/* v89.41 行为探针：texVariant 确定性与分布 + 地图渲染回归（不抛错） */
const fs = require('fs');
const path = require('path');

/* ---- 浏览器 stub（同 smoke 最小集） ---- */
global.window = global;
global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
function makeEl() {
  return {
    tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    addEventListener: function () {}, appendChild: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
    getContext: function () {
      const noop = function () {};
      return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: noop, drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, arc: noop, ellipse: noop, save: noop, restore: noop, clip: noop, rect: noop, translate: noop, scale: noop, rotate: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop, closePath: noop, quadraticCurveTo: noop, bezierCurveTo: noop, fillText: noop, strokeText: noop, setLineDash: noop, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: noop }; }, createRadialGradient: function () { return { addColorStop: noop }; }, createPattern: function () { return null; }, roundRect: noop };
    },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; },
  };
}
global.document = { createElement: makeEl, querySelector: makeEl, querySelectorAll: function () { return []; }, addEventListener: function () {}, readyState: 'complete' };
global.requestAnimationFrame = function (f) { return f && f(); };
global.location = { search: '', href: 'file:///index.html' };
global.addEventListener = function () {};
global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
global.innerWidth = 1440; global.innerHeight = 900;

const R = 'E:/Deepseekdb';
require(R + '/js/data.js');
require(R + '/js/state.js');
require(R + '/js/systems.js');
require(R + '/js/domain.js');
require(R + '/js/map.js');

let fail = 0;
function t(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) fail++;
}

/* ① texVariant：从源码抽出实现，验确定性与分布 */
const src = fs.readFileSync(R + '/js/map.js', 'utf8');
const m = src.match(/function texVariant\(gx, gy\) \{([\s\S]*?)\n  \}/);
t('texVariant 实现存在', !!m);
let fn = null;
if (m) fn = new Function('gx', 'gy', m[1]);
if (fn) {
  const a = fn(123, 456), b = fn(123, 456);
  t('确定性：同格两次调用同值', a === b, a + '=' + b);
  const dist = [0, 0, 0, 0];
  let ok4 = true;
  for (let y = 0; y < 500; y += 7) for (let x = 0; x < 500; x += 7) {
    const v = fn(x, y);
    if (v < 0 || v > 3 || (v | 0) !== v) ok4 = false;
    dist[v]++;
  }
  t('取值域 0..3 且为整数', ok4, JSON.stringify(dist));
  const tot = dist.reduce((s, v) => s + v, 0);
  const worst = Math.max.apply(null, dist.map(v => Math.abs(v / tot - 0.25)));
  t('四变体分布均衡（最大偏差 < 8%）', worst < 0.08, (worst * 100).toFixed(1) + '%');
}

/* ② 地图渲染：新代码路径不抛错 */
try {
  GAME.newGame({ name: '探针', region: 'random' });
  GAME.map.generate();
  const canvas = makeEl();
  canvas.width = 1352; canvas.height = 728;
  GAME.map.render(canvas, { vx: 40, vy: 40, spanX: 13, spanY: 7, cell: 104 });
  t('map.render 在无素材环境走矢量兜底不抛错', true);
} catch (e) {
  t('map.render 在无素材环境走矢量兜底不抛错', false, e.message);
}

/* ③ 素材文件与登记表现场核对 */
const UI = R + '/assets/icons/ui/';
const need = ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'];
t('七张贴图在盘上', need.every(n => fs.existsSync(UI + 'ai_terrain_' + n + '.png')));
require(R + '/js/bitmaps.js');
t('BITMAPS.src("terrain", id) 返回路径', need.every(n => (BITMAPS.src('terrain', n) || '').indexOf('ai_terrain_' + n) >= 0));
t('BITMAPS.count = 98', BITMAPS.count === 98, String(BITMAPS.count));

console.log(fail ? ('PROBE FAIL ' + fail) : 'PROBE OK');
process.exit(fail ? 1 : 0);
