/* 情景：防御百分比做软饱和（3×(1−e^(−x/2))），看三阶段能否落进目标区间 */
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
G.newGame({ name: 'dcs', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
const EQ = Object.values(D.EQUIP || {});
function bestSet() { const by = {}; for (const e of EQ) { const v = (e.atk || 0) * 0.5 + (e.def || 0); if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e }; } const o = {}; for (const s in by) o[s] = by[s].e.id; return o; }
const SET_MIX = bestSet();
function mkGen(lv, rank, set) { const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance'); G.rankOf(g); G.guardFillOf(g); if (set) g.equip = Object.assign({}, set); return g; }
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const STAGES = [
  { n: '前期Lv12', lv: 12, rk: 'ying', set: null, cap: 30000, techs: null, b: [0, 0, 0] },
  { n: '中期Lv120', lv: 120, rk: 'tian', set: SET_MIX, cap: 100000, techs: halfT(), b: [0.15, 0.15, 0.1] },
  { n: '后期Lv240', lv: 240, rk: 'tian', set: SET_MIX, cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] },
];
function fight(a, gen, w, s) {
  const boost = { techs: s.techs || {}, world: {}, buffs: s.b[2] ? { military: { atk: s.b[2], cap: 0 } } : {}, atkMult: 1 + s.b[0], siegeMult: 1, cityDefMult: 1, defAdd: s.b[1] };
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)) };
  });
}
function run(tag) {
  console.log('\n' + tag);
  console.log('  阶段          Lv3   Lv6   Lv10  Lv12  Lv15');
  for (const s of STAGES) {
    const g = mkGen(s.lv, s.rk, s.set), row = [];
    for (const lv of [3, 6, 10, 12, 15]) {
      const w = G.wildDefenseAt(ciOf(180 + lv, 300), lv);
      const a = { zhuzhan: Math.round(s.cap * .5), huopao: Math.round(s.cap * .3), taitan: Math.round(s.cap * .2) };
      row.push(((fight(a, g, w, s).win ? '胜' : '败') + fight(a, g, w, s).loss.toFixed(0) + '%').padStart(6));
    }
    console.log('  ' + s.n.padEnd(12) + row.join(' '));
  }
}
run('① 现状（防御无上限）');
/* 软饱和：defPct' = K*(1-e^(-x/K2))，K=3 / K2=2 → 上限 +300% */
const orig = G.tactic.perDef;
G.tactic.perDef = function (u) {
  var t = D.TROOPS[u.id];
  var pctRaw = (u.defPct || 0) * (u.cover || 0);
  var pct = 3 * (1 - Math.exp(-pctRaw / 2));
  pct *= (1 + (G.systems && G.systems.techBonus ? G.systems.techBonus('def') : 0));
  return Math.max(1, t.def * (1 + pct));
};
run('② 防御软饱和到 +300%（perDef 最多 ×4）');
