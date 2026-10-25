const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'dbg', cityName: '灰岗', mapSeed: 20261016 });
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
let w = null, wx = -1;
for (let x = 180; x < 320; x++) { const t = G.wildDefenseAt(ciOf(x, 300), 15); if (t && t.gen) { w = t; wx = x; break; } }
const g = G.makeGeneral('将', 240, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g);
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
console.log('野地 x=' + wx + ' 守军 ' + w.total + ' 守将 Lv' + w.gen.level + ' 资质' + w.gen.rank + ' atkPct ' + (G.genAttrs(w.gen).atkPct * 100).toFixed(0) + '%');
console.log('守军构成 ' + JSON.stringify(w.army));
const CASES = [
  ['纯主战10万', { zhuzhan: 100000 }],
  ['主5东3坦2', { zhuzhan: 50000, huopao: 30000, taitan: 20000 }],
  ['东5坦5', { huopao: 50000, taitan: 50000 }],
  ['主5东3坦2（按人口等价 40万）', { zhuzhan: 200000, huopao: 120000, taitan: 80000 }],
];
for (const [n, a] of CASES) {
  const r = G.tactic.simulate(a, g, w.army, w.gen, null, { kind: 'wild', pid: 1 });
  console.log('  ' + n.padEnd(30) + '人头' + String(men(a)).padStart(8) + ' 胜方' + r.winner + ' 攻损' + r.atkLoss + ' (' + (100 * r.atkLoss / men(a)).toFixed(1) + '%) 回合' + r.rounds);
}
