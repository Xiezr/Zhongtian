/* 选项对照：Lv14/15 只涨数量、不换质量（构成冻结在 Lv13） */
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
G.newGame({ name: 'var', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
/* Lv13 的构成比例 */
const w13 = G.wildDefenseAt(ciOf(180, 300), 13);
const c13 = men(w13.army);
const SHARE = {}; for (const id in w13.army) SHARE[id] = w13.army[id] / c13;
function build(total) { const a = {}; for (const id in SHARE) a[id] = Math.max(1, Math.round(total * SHARE[id])); return a; }
function test(a, lv) {
  const w = G.wildDefenseAt(ciOf(180, 300), lv);
  const atk = { zhuzhan: 50000, huopao: 30000, taitan: 20000 };
  const r = G.tactic.simulate(atk, GEN, a, 0, w.gen || null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / men(atk) };
}
console.log('Lv13 构成冻结，只涨人数（10 万混编攻损）：');
for (const total of [40000, 50000, 60000, 70000, 80000]) {
  const rows = [13, 14, 15].map(lv => { const f = test(build(total), lv); return 'Lv' + lv + ':' + (f.win ? '胜' : '败') + f.loss.toFixed(0) + '%'; });
  console.log('  人数 ' + String(total).padStart(6) + '  ' + rows.join('  '));
}
