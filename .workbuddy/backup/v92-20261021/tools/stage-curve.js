/* 三阶段玩家 vs 野地：把"装备/科技/羁绊/专精/将领"全部算进去 */
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
G.newGame({ name: 'stage', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
const EQ = Object.values(D.EQUIP || {});
function bestSet(mode) {           /* mode: 'atk' | 'def' | 'mix' */
  const bySlot = {};
  for (const e of EQ) {
    const v = mode === 'atk' ? (e.atk || 0) : mode === 'def' ? (e.def || 0) : (e.atk || 0) + (e.def || 0);
    if (!bySlot[e.slot] || v > bySlot[e.slot].v) bySlot[e.slot] = { v, e };
  }
  const out = {};
  for (const s in bySlot) out[s] = bySlot[s].e.id;
  return out;
}
const SET_ATK = bestSet('atk'), SET_DEF = bestSet('def'), SET_MIX = bestSet('mix');
function mkGen(lv, rank, set) {
  const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance');
  G.rankOf(g); G.guardFillOf(g);
  if (set) g.equip = Object.assign({}, set);
  return g;
}
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const W = lv => G.wildDefenseAt(ciOf(180, 300), lv);

/* 用 withBoost 装"科技/羁绊/增益"三件套 */
function stageBoost(atkTech, defTech, hpTech, bondAtk, bondDef, buffAtk) {
  return {
    techs: {}, world: {},
    buffs: buffAtk ? { military: { atk: buffAtk, cap: 0 } } : {},
    atkMult: 1 + bondAtk, siegeMult: 1, cityDefMult: 1, defAdd: bondDef,
  };
}
function fight(a, gen, w, boost) {
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
  });
}
/* 科技：用 techs 表直接给满级 */
function maxTechs() {
  const t = {};
  (D.TECH_ALL || D.TECH).forEach(x => { t[x.id] = x.lv || 0; });
  return t;
}
const STAGES = [
  { name: '前期', lv: 12, rank: 'ying', set: null, cap: 30000, boost: stageBoost(0, 0, 0, 0, 0, 0), techs: false },
  { name: '前期+', lv: 24, rank: 'ying', set: SET_MIX, cap: 30000, boost: stageBoost(0, 0, 0, 0, 0, 0), techs: false },
  { name: '中期', lv: 84, rank: 'ming', set: SET_MIX, cap: 70000, boost: stageBoost(0, 0, 0, 0, 0, 0), techs: 'half' },
  { name: '中期+', lv: 120, rank: 'tian', set: SET_MIX, cap: 100000, boost: stageBoost(0, 0, 0, 0.15, 0.15, 0.1), techs: 'half' },
  { name: '后期', lv: 240, rank: 'tian', set: SET_MIX, cap: 150000, boost: stageBoost(0, 0, 0, 0.2, 0.2, 0.15), techs: 'full' },
];
console.log('阶段        将级  编成上限   对 Lv3    Lv6     Lv10    Lv13    Lv15');
for (const s of STAGES) {
  const g = mkGen(s.lv, s.rank, s.set);
  let boost = s.boost;
  if (s.techs) {
    const t = {};
    (D.TECH_ALL || D.TECH).forEach(x => {
      const mx = x.lv || 0;
      t[x.id] = s.techs === 'full' ? mx : Math.floor(mx * 0.5);
    });
    boost = Object.assign({}, boost, { techs: t });
  }
  const row = [];
  for (const lv of [3, 6, 10, 13, 15]) {
    const a = { zhuzhan: Math.round(s.cap * 0.5), huopao: Math.round(s.cap * 0.3), taitan: Math.round(s.cap * 0.2) };
    const f = fight(a, g, W(lv), boost);
    row.push(((f.win ? '胜' : '败') + f.loss.toFixed(0) + '%').padStart(7));
  }
  console.log(s.name.padEnd(9) + String(s.lv).padStart(4) + String(s.cap / 10000 + '万').padStart(8) + '   ' + row.join(' '));
}
const gg = mkGen(240, 'tian', SET_MIX);
const aa = G.genAttrs(gg);
console.log('\n后期将实际数值：atkPct +' + (100 * aa.atkPct).toFixed(0) + '% · defPct +' + (100 * aa.defPct).toFixed(0) +
  '% · 血量×' + G.battle.hpMult(gg).toFixed(2));
