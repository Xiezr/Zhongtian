/* 出征上限 → 野地可打性：上限抬到 12/15/20 万时，各档野地的攻损 */
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
G.newGame({ name: 'caps', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const W = lv => G.wildDefenseAt(ciOf(180, 300), lv);
function fight(a, w) {
  const r = G.tactic.simulate(a, GEN, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
}
console.log('编成 = 主战50% + 东风30% + 泰坦20%（按人头）');
console.log('上限   Lv10      Lv11      Lv12      Lv13      Lv14      Lv15');
for (const cap of [100000, 120000, 150000, 200000]) {
  const row = [];
  for (const lv of [10, 11, 12, 13, 14, 15]) {
    const f = fight({ zhuzhan: cap * .5, huopao: cap * .3, taitan: cap * .2 }, W(lv));
    row.push(((f.win ? '胜' : '败') + f.loss.toFixed(0) + '%').padStart(8));
  }
  console.log(String(cap / 10000).padStart(3) + '万' + row.join(' '));
}
console.log('');
console.log('=== 出征上限的实际上限（练兵场10 + 节钺2 + 专精）===');
const s = G.state, city = s.cities[0];
const base = G.battle.marchCapOf(city);
console.log('  当前城（练兵场 Lv' + (G.buildingLevel(city, 'xiaochang') || 0) + '）容量 ' + base);
console.log('  MARCH_MEN_PER_LV = ' + G.battle.MARCH_MEN_PER_LV + '；节钺上限 ' + ((D.JIEYUE || {}).xcMax || 0) + ' 级');
