/* Lv14/15 的守军规模标定：让 10 万（当前出征上限）打出 20~25% 损耗 */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'tail', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function fight(k, lv, cap) {
  const w = G.wildDefenseAt(ciOf(180, 300), lv);
  const a = {}; for (const id in w.army) a[id] = Math.max(1, Math.round(w.army[id] * k));
  const atk = { zhuzhan: cap * .5, huopao: cap * .3, taitan: cap * .2 };
  const r = G.tactic.simulate(atk, GEN, a, 0, w.gen || null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / men(atk), cnt: men(a) };
}
console.log('目标：10 万军打出的攻损 ≈ 22%');
for (const lv of [14, 15]) {
  let lo = 0.05, hi = 1.0;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    const f = fight(m, lv, 100000);
    if (f.loss < 22) lo = m; else hi = m;
  }
  const k = (lo + hi) / 2;
  const f = fight(k, lv, 100000);
  const base = G.wildDefenseAt(ciOf(180, 300), lv).total;
  console.log('  Lv' + lv + ' 现有 ' + base + ' → ×' + k.toFixed(2) + ' = ' + Math.round(base * k) +
    '（实测算 ' + f.cnt + '）· 攻损 ' + f.loss.toFixed(1) + '% · ' + (f.win ? '胜' : '败'));
}
