/* 野地后期强度（修正版）：simulate(atkArmy, atkGen, defArmy, defVal, defGen, opts)
   ⚠️ 守将必须走**第 5 参 defGen**（第 4 参是城防数值）—— 之前的探针传错位置，
      守将加成没参与，导致"野地很弱"的假结论。本脚本是唯一正确口径。 */
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
G.newGame({ name: 'wlc', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function wild(lv) { return G.wildDefenseAt(ciOf(180, 300), lv); }
function fight(a, w) {
  const r = G.tactic.simulate(a, GEN, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
}
const CAP = 100000;
console.log('野地 | 守军 | 守将 | 10万纯主战 | 10万混编(主5东3坦2)');
for (const lv of [9, 10, 11, 12, 13, 14, 15]) {
  const w = wild(lv);
  const a1 = fight({ zhuzhan: 100000 }, w);
  const a2 = fight({ zhuzhan: 50000, huopao: 30000, taitan: 20000 }, w);
  console.log('Lv' + String(lv).padEnd(3) + String(w.total).padStart(7) + String(w.gen ? 'Lv' + w.gen.level : '无').padStart(6) +
    '  ' + (a1.win ? '胜' : '败') + a1.loss.toFixed(1).padStart(6) + '%/' + a1.rounds + 'r' +
    '  ' + (a2.win ? '胜' : '败') + a2.loss.toFixed(1).padStart(6) + '%/' + a2.rounds + 'r');
}
console.log('');
console.log('=== 攻损 ≤5% 所需纯主战（出征上限 10 万）===');
for (const lv of [10, 12, 13, 14, 15]) {
  const w = wild(lv);
  const probe = n => { const f = fight({ zhuzhan: n }, w); return f.win && f.loss <= 5; };
  if (!probe(CAP)) { console.log('  Lv' + lv + ' 10 万也达不到 5%'); continue; }
  let lo = 100, hi = CAP;
  if (probe(lo)) { console.log('  Lv' + lv + ' 只需 ' + lo); continue; }
  for (let i = 0; i < 14; i++) { const m = (lo + hi) >> 1; if (probe(m)) hi = m; else lo = m; }
  console.log('  Lv' + lv + ' 需要 ' + hi + '（上限 10 万的 ' + (100 * hi / CAP).toFixed(0) + '%）');
}
