/* 稳健性：阶段玩家强度上下浮动时，结论是否还成立（不是只在"顶配"那一点上）
   V1 后期：将级 180/210/240 × 装备 q5/q6  → 打 Lv15
   V2 中期：将级 96/120/150 × 装备 q3/q4  → 打 Lv12
*/
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
G.newGame({ name: 'rb', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
function setOf(qMax) { const by = {}; for (const e of EQ) { if (qOf(e) > qMax) continue; const v = (e.atk || 0) * 0.5 + (e.def || 0); if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e }; } const o = {}; for (const s in by) o[s] = by[s].e.id; return o; }
function mkGen(lv, rank, set) { const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance'); G.rankOf(g); G.guardFillOf(g); if (set) g.equip = Object.assign({}, set); return g; }
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
function run(lv, genLv, q, cap, techs, bond) {
  const g = mkGen(genLv, 'tian', setOf(q));
  const w = G.wildDefenseAt(ciOf(180 + lv, 300), lv);
  const a = { zhuzhan: Math.round(cap * .5), huopao: Math.round(cap * .3), taitan: Math.round(cap * .2) };
  const boost = { techs: techs, world: {}, buffs: { military: { atk: bond[2], cap: 0 } }, atkMult: 1 + bond[0], siegeMult: 1, cityDefMult: 1, defAdd: bond[1] };
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)) };
  });
}
console.log('V1 后期玩家打 Lv15（目标 40~55%）');
console.log('  将级  q5装备   q6装备');
for (const gl of [180, 210, 240]) {
  const a = run(15, gl, 5, 150000, fullT(), [0.2, 0.2, 0.15]);
  const b = run(15, gl, 6, 150000, fullT(), [0.2, 0.2, 0.15]);
  console.log('  ' + String(gl).padEnd(5) + (a.loss.toFixed(0) + '%').padStart(7) + (b.loss.toFixed(0) + '%').padStart(9));
}
console.log('');
console.log('V2 中期玩家打 Lv12（目标 20~30%）');
console.log('  将级  q3装备   q4装备');
for (const gl of [96, 120, 150]) {
  const a = run(12, gl, 3, 120000, halfT(), [0.1, 0.1, 0.05]);
  const b = run(12, gl, 4, 120000, halfT(), [0.1, 0.1, 0.05]);
  console.log('  ' + String(gl).padEnd(5) + (a.loss.toFixed(0) + '%').padStart(7) + (b.loss.toFixed(0) + '%').padStart(9));
}
console.log('');
console.log('V3 出征规模 ±25%（后期 q6 将 240 打 Lv15）');
for (const k of [0.75, 1.0, 1.25]) {
  const f = run(15, 240, 6, Math.round(150000 * k), fullT(), [0.2, 0.2, 0.15]);
  console.log('  ' + Math.round(150000 * k) + ' 人 → ' + (f.win ? '胜' : '败') + ' 损 ' + f.loss.toFixed(0) + '%');
}
