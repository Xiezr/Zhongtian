/* 反解：守将装齐（品质全套×0.7）后，各档守军要多少人才能让"该来的玩家"达到目标攻损 */
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
G.newGame({ name: 'cc', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
function fullSet(q) { const A = {}, Dd = {}; for (const e of EQ) { if (qOf(e) !== q) continue; A[e.slot] = Math.max(A[e.slot] || 0, e.atk || 0); Dd[e.slot] = Math.max(Dd[e.slot] || 0, e.def || 0); } return { atk: Object.values(A).reduce((a, b) => a + b, 0), def: Object.values(Dd).reduce((a, b) => a + b, 0) }; }
const FS = {}; [1, 2, 3, 4, 5, 6].forEach(q => FS[q] = fullSet(q));
function bestSet() { const by = {}; for (const e of EQ) { const v = (e.atk || 0) * 0.5 + (e.def || 0); if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e }; } const o = {}; for (const s in by) o[s] = by[s].e.id; return o; }
const SET_MIX = bestSet();
function mkGen(lv, rank, set) { const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance'); G.rankOf(g); G.guardFillOf(g); if (set) g.equip = Object.assign({}, set); return g; }
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const TIER = lv => lv <= 3 ? 1 : lv <= 6 ? 2 : lv <= 9 ? 3 : lv <= 12 ? 4 : lv <= 14 ? 5 : 6;
const GQ = {}; for (let lv = 0; lv <= 15; lv++) GQ[lv] = lv ? TIER(lv) : 0;
D.GUARD_GEAR = { mul: 1, atk: [], def: [] };
for (let lv = 0; lv <= 15; lv++) { const q = GQ[lv]; D.GUARD_GEAR.atk[lv] = q ? Math.round(FS[q].atk * 0.7) : 0; D.GUARD_GEAR.def[lv] = q ? Math.round(FS[q].def * 0.7) : 0; }
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const STAGE_OF = lv => lv <= 3 ? { n: '前期', lv: 12, rk: 'ying', set: null, cap: 30000, techs: null, b: [0, 0, 0] }
  : lv <= 6 ? { n: '前期+', lv: 30, rk: 'ying', set: SET_MIX, cap: 40000, techs: null, b: [0, 0, 0] }
  : lv <= 9 ? { n: '中期', lv: 96, rk: 'ming', set: SET_MIX, cap: 80000, techs: halfT(), b: [0.1, 0.1, 0.05] }
  : lv <= 12 ? { n: '中期+', lv: 150, rk: 'tian', set: SET_MIX, cap: 120000, techs: halfT(), b: [0.15, 0.15, 0.1] }
  : { n: '后期', lv: 240, rk: 'tian', set: SET_MIX, cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] };
const TARGET = lv => lv <= 3 ? 6 : lv <= 6 ? 10 : lv <= 9 ? 22 : lv <= 12 ? 28 : 45;
function lossAt(lv, k) {
  const base = G.wildDefenseAt(ciOf(180, 300), lv);
  const s = STAGE_OF(lv);
  const scale = k * s.cap / Math.max(1, base.total);
  const army = {}; for (const id in base.army) army[id] = Math.max(1, Math.round(base.army[id] * scale));
  const a = { zhuzhan: Math.round(s.cap * .5), huopao: Math.round(s.cap * .3), taitan: Math.round(s.cap * .2) };
  const g = mkGen(s.lv, s.rk, s.set);
  const boost = { techs: s.techs || {}, world: {}, buffs: s.b[2] ? { military: { atk: s.b[2], cap: 0 } } : {}, atkMult: 1 + s.b[0], siegeMult: 1, cityDefMult: 1, defAdd: s.b[1] };
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, g, army, 0, base.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), cnt: men(army) };
  });
}
console.log('野地 阶段    目标   守军/玩家上限 反解 k   守军人数   实测    结果');
const out = [];
for (let lv = 1; lv <= 15; lv++) {
  const tgt = TARGET(lv);
  let lo = 0.05, hi = 3.0;
  if (lossAt(lv, hi).loss < tgt) { console.log('Lv' + lv + ' 上限 3.0 也达不到目标'); continue; }
  if (lossAt(lv, lo).loss > tgt) { console.log('Lv' + lv + ' 最低 0.05 已超目标'); continue; }
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (lossAt(lv, m).loss < tgt) lo = m; else hi = m; }
  const k = (lo + hi) / 2, f = lossAt(lv, k);
  out.push({ lv, k: +k.toFixed(2) });
  console.log('Lv' + String(lv).padEnd(3) + STAGE_OF(lv).n.padEnd(7) + (tgt + '%').padStart(4) + k.toFixed(2).padStart(12) + String(f.cnt).padStart(9) + f.loss.toFixed(0).padStart(7) + '%  ' + (f.win ? '胜' : '败'));
}
console.log('\nk 表（守军人数 = k × 该阶段玩家出征上限）: ' + JSON.stringify(out.map(o => o.k)));
