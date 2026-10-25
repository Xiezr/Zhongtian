/* 守将等效装备重排：按"玩家各品质全套"给，测三阶段玩家的攻损能否命中目标 */
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
G.newGame({ name: 'ggf', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
function fullSet(q) {
  const atk = {}, def = {};
  for (const e of EQ) {
    if (qOf(e) !== q) continue;
    atk[e.slot] = Math.max(atk[e.slot] || 0, e.atk || 0);
    def[e.slot] = Math.max(def[e.slot] || 0, e.def || 0);
  }
  return { atk: Object.values(atk).reduce((a, b) => a + b, 0), def: Object.values(def).reduce((a, b) => a + b, 0) };
}
const FS = { 1: fullSet(1), 2: fullSet(2), 3: fullSet(3), 4: fullSet(4), 5: fullSet(5), 6: fullSet(6) };
function bestSet(mode) {
  const by = {};
  for (const e of EQ) {
    const v = mode === 'atk' ? (e.atk || 0) : (e.atk || 0) * 0.5 + (e.def || 0);
    if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e };
  }
  const o = {}; for (const s in by) o[s] = by[s].e.id; return o;
}
const SET_MIX = bestSet('mix');
function mkGen(lv, rank, set) {
  const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance');
  G.rankOf(g); G.guardFillOf(g);
  if (set) g.equip = Object.assign({}, set);
  return g;
}
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const wCache = {};
function W(lv) { return wCache[lv] || (wCache[lv] = G.wildDefenseAt(ciOf(180, 300), lv)); }
function freshW(lv) { return G.wildDefenseAt(ciOf(180 + off, 300), lv); }
let off = 0;
function setGear(mul, tierOfLv) {
  const t = { mul: mul, atk: [], def: [] };
  for (let lv = 0; lv <= 15; lv++) {
    const q = tierOfLv(lv);
    t.atk[lv] = q ? Math.round(FS[q].atk * mul) : 0;
    t.def[lv] = q ? Math.round(FS[q].def * mul) : 0;
  }
  D.GUARD_GEAR = t;
}
function fight(a, gen, w, techs, bondAtk, bondDef, buffAtk) {
  const boost = { techs: techs || {}, world: {}, buffs: buffAtk ? { military: { atk: buffAtk, cap: 0 } } : {},
    atkMult: 1 + (bondAtk || 0), siegeMult: 1, cityDefMult: 1, defAdd: bondDef || 0 };
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)) };
  });
}
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const STAGES = [
  { n: '前期Lv12', lv: 12, rk: 'ying', set: null, cap: 30000, techs: null, b: [0, 0, 0] },
  { n: '中期Lv120', lv: 120, rk: 'tian', set: SET_MIX, cap: 100000, techs: halfT(), b: [0.15, 0.15, 0.1] },
  { n: '后期Lv240', lv: 240, rk: 'tian', set: SET_MIX, cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] },
];
function run(label) {
  console.log('\n--- ' + label + ' ---');
  console.log('阶段         Lv3    Lv6    Lv10   Lv12   Lv15');
  for (const s of STAGES) {
    const g = mkGen(s.lv, s.rk, s.set);
    const row = [];
    for (const lv of [3, 6, 10, 12, 15]) {
      off = 1;   /* 换一格，避免旧守将缓存 */
      const w = freshW(lv);
      const a = { zhuzhan: Math.round(s.cap * 0.5), huopao: Math.round(s.cap * 0.3), taitan: Math.round(s.cap * 0.2) };
      const f = fight(a, g, w, s.techs, s.b[0], s.b[1], s.b[2]);
      row.push(((f.win ? '胜' : '败') + f.loss.toFixed(0) + '%').padStart(7));
    }
    console.log(s.n.padEnd(12) + row.join(' '));
  }
}
const tiers = lv => lv <= 0 ? 0 : lv <= 3 ? 1 : lv <= 6 ? 2 : lv <= 9 ? 3 : lv <= 12 ? 4 : lv <= 14 ? 5 : 6;
run('现状（守将 def 档仍是旧的 327）');
for (const mul of [0.5, 0.7, 0.9]) { setGear(mul, tiers); run('守将等效装备 = 玩家同档全套 ×' + mul); }
