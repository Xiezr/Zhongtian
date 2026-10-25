/* 练级轨迹（带出征上限）：主战编成，练兵场 Lv1 = 1 万人头 */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: 'traj', cityName: '灰岗', mapSeed: 20261016 });
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const W = {};
for (let lv = 1; lv <= 15; lv++) { let g = null; for (let x = 180; x < 320; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) { g = w; break; } } W[lv] = g || G.wildDefenseAt(ciOf(180, 300), lv); }
function playerGen(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
function menOf(a) { let n = 0; for (const k in a) n += a[k]; return n; }
const CAP = 100000;   /* 练兵场 Lv10 上限，允许后期多带 */
function fight(a, gen, w) { const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }); return { win: r.winner === 'atk', lossPct: 100 * r.atkLoss / Math.max(1, menOf(a)), r }; }
function minMen(gen, w) {
  const probe = m => { const f = fight({ zhuzhan: m }, gen, w); return f.win && f.lossPct <= 5; };
  if (!probe(CAP)) return null;
  let lo = 100, hi = CAP;
  if (probe(lo)) return lo;
  for (let i = 0; i < 12; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) hi = m; else lo = m; }
  return hi;
}
console.log('  将级  最优野地  需要主战  攻损   每场经验  占本级  该级场次  累计场次  累计补员  累计训练(分)');
let tf = 0, tmen = 0, tsec = 0;
for (let L = 12; L <= 240; L += 12) {
  const gen = playerGen(L), need = G.expNeedOf(gen);
  let best = null;
  for (let lv = 1; lv <= 15; lv++) {
    const m = minMen(gen, W[lv]); if (m == null) continue;
    const f = fight({ zhuzhan: m }, gen, W[lv]); if (!f.win) continue;
    const e = G.battle.battleExp(f.r.defLossBy, gen);
    const gain = Math.round(e.gain * G.battle.expPenaltyOf(L, lv).mul);
    if (gain <= 0) continue;
    const per = gain / need;
    if (best == null || per > best.per) best = { lv, m, gain, per, loss: f.lossPct };
  }
  if (!best) { console.log('  Lv' + L + ' 打不动'); continue; }
  const fights = Math.ceil(1 / best.per);
  const lossMen = Math.round(best.m * best.loss / 100);
  const sec = lossMen * D.TROOPS.zhuzhan.time;
  tf += fights; tmen += lossMen * fights; tsec += sec * fights;
  console.log('  ' + String(L).padEnd(5) + String('Lv' + best.lv).padEnd(9) + String(best.m).padStart(7) +
    (best.loss.toFixed(1) + '%').padStart(7) + String(best.gain).padStart(9) + (100 * best.per).toFixed(0).padStart(7) + '%' +
    String(fights).padStart(8) + String(tf).padStart(9) + String(tmen).padStart(9) + (tsec / 120 / 60).toFixed(0).padStart(12));
}
