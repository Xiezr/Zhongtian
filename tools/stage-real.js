/* 真实阶段装备：按品质分档（前期无/q2/q3-q4/q5/q6），重测三阶段 */
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
G.newGame({ name: 'sr', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
function setOf(qMax) {
  const by = {};
  for (const e of EQ) {
    if (qOf(e) > qMax) continue;
    const v = (e.atk || 0) * 0.5 + (e.def || 0);
    if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e };
  }
  const o = {}; for (const s in by) o[s] = by[s].e.id;
  return o;
}
function mkGen(lv, rank, set) { const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance'); G.rankOf(g); G.guardFillOf(g); if (set) g.equip = Object.assign({}, set); return g; }
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const STAGES = [
  { n: '前期 Lv12 / 3万 / 无装', lv: 12, rk: 'ying', set: null, cap: 30000, techs: null, b: [0, 0, 0] },
  { n: '前期+ Lv40 / 4万 / q2', lv: 40, rk: 'ying', set: setOf(2), cap: 40000, techs: null, b: [0, 0, 0] },
  { n: '中期 Lv96 / 8万 / q3', lv: 96, rk: 'ming', set: setOf(3), cap: 80000, techs: halfT(), b: [0.05, 0.05, 0] },
  { n: '中期+ Lv150 / 12万 / q4', lv: 150, rk: 'tian', set: setOf(4), cap: 120000, techs: halfT(), b: [0.1, 0.1, 0.05] },
  { n: '后期 Lv240 / 15万 / q6', lv: 240, rk: 'tian', set: setOf(6), cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] },
];
function fight(a, gen, w, s) {
  const boost = { techs: s.techs || {}, world: {}, buffs: s.b[2] ? { military: { atk: s.b[2], cap: 0 } } : {}, atkMult: 1 + s.b[0], siegeMult: 1, cityDefMult: 1, defAdd: s.b[1] };
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)) };
  });
}
console.log('阶段                          Lv3   Lv6   Lv9   Lv12  Lv15');
for (const s of STAGES) {
  const g = mkGen(s.lv, s.rk, s.set), row = [];
  for (const lv of [3, 6, 9, 12, 15]) {
    const w = G.wildDefenseAt(ciOf(180 + lv, 300), lv);
    const a = { zhuzhan: Math.round(s.cap * .5), huopao: Math.round(s.cap * .3), taitan: Math.round(s.cap * .2) };
    const f = fight(a, g, w, s);
    row.push(((f.win ? '胜' : '败') + f.loss.toFixed(0) + '%').padStart(7));
  }
  console.log(s.n.padEnd(28) + row.join(' '));
}
for (const s of STAGES) {
  const g = mkGen(s.lv, s.rk, s.set), x = G.genAttrs(g);
  console.log('  ' + s.n.split(' ')[0].padEnd(4) + ' atkPct +' + (100 * x.atkPct).toFixed(0) + '% / defPct +' + (100 * x.defPct).toFixed(0) + '%');
}
