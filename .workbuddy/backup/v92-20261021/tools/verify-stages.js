/* 独立验证：三条路径互证
   A. tactic.simulate（我原来用的）
   B. tactic.begin + runAll + finish（引擎另一条公开路径）
   C. 多格采样（同等级不同坐标，看离散度）
   D. 常数反转（PCT_PER_DEF 10 ↔ 100，看曲线是否随之翻转）
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
G.newGame({ name: 'vf', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
function setOf(qMax) { const by = {}; for (const e of EQ) { if (qOf(e) > qMax) continue; const v = (e.atk || 0) * 0.5 + (e.def || 0); if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e }; } const o = {}; for (const s in by) o[s] = by[s].e.id; return o; }
function mkGen(lv, rank, set) { const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance'); G.rankOf(g); G.guardFillOf(g); if (set) g.equip = Object.assign({}, set); return g; }
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const S = {
  mid2: { n: '中期+', lv: 150, rk: 'tian', set: setOf(4), cap: 120000, techs: halfT(), b: [0.1, 0.1, 0.05] },
  late: { n: '后期', lv: 240, rk: 'tian', set: setOf(6), cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] },
};
function boostOf(s) {
  return { techs: s.techs || {}, world: {}, buffs: s.b[2] ? { military: { atk: s.b[2], cap: 0 } } : {}, atkMult: 1 + s.b[0], siegeMult: 1, cityDefMult: 1, defAdd: s.b[1] };
}
function armyOf(s) { return { zhuzhan: Math.round(s.cap * .5), huopao: Math.round(s.cap * .3), taitan: Math.round(s.cap * .2) }; }
function viaSimulate(a, gen, w, s) {
  return G.battle.withBoost(boostOf(s), function () {
    const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
  });
}
function viaBegin(a, gen, w, s) {
  return G.battle.withBoost(boostOf(s), function () {
    const env = G.tactic.begin(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    env.runAll();
    const r = env.finish();
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
  });
}
const TILES = [[180, 300], [200, 310], [220, 290], [240, 305], [260, 295]];
function pickTiles(lv) {
  const out = [];
  for (const [x, y] of TILES) { const w = G.wildDefenseAt(ciOf(x, y), lv); if (w && w.army) out.push(w); }
  return out;
}
function stat(arr) { const s = arr.slice().sort((a, b) => a - b); return { med: s[(s.length - 1) >> 1], min: s[0], max: s[s.length - 1] }; }

console.log('=== 验证一：两条引擎路径是否同源（同一场，simulate vs begin+runAll）===');
console.log('  野地  阶段    simulate         begin+runAll     一致');
for (const [lv, key] of [[12, 'mid2'], [15, 'late']]) {
  const s = S[key], g = mkGen(s.lv, s.rk, s.set), w = pickTiles(lv)[0];
  const A = viaSimulate(armyOf(s), g, w, s), B = viaBegin(armyOf(s), g, w, s);
  const same = (A.win === B.win) && Math.abs(A.loss - B.loss) < 0.05 && A.rounds === B.rounds;
  console.log('  Lv' + String(lv).padEnd(4) + s.n.padEnd(6) +
    ((A.win ? '胜' : '败') + A.loss.toFixed(1) + '%/' + A.rounds + 'r').padStart(12) +
    ((B.win ? '胜' : '败') + B.loss.toFixed(1) + '%/' + B.rounds + 'r').padStart(18) +
    (same ? '   ✅' : '   ❌'));
}
console.log('');
console.log('=== 验证二：同等级 5 块地采样（离散度）===');
console.log('  野地  阶段    中位   最好   最差   样本地数');
for (const [lv, key] of [[9, 'mid2'], [12, 'mid2'], [15, 'late']]) {
  const s = S[key], g = mkGen(s.lv, s.rk, s.set), ws = pickTiles(lv);
  const ls = ws.map(w => viaSimulate(armyOf(s), g, w, s).loss);
  const st = stat(ls);
  console.log('  Lv' + String(lv).padEnd(4) + s.n.padEnd(6) + st.med.toFixed(0).padStart(5) + '%' +
    st.min.toFixed(0).padStart(6) + '%' + st.max.toFixed(0).padStart(6) + '%' + String(ws.length).padStart(8));
}
console.log('');
console.log('=== 验证三：把常数改回去（PCT_PER_DEF 100 → 10），曲线必须翻回"碾压" ===');
console.log('  口径             Lv12(中期+)   Lv15(后期)');
for (const per of [100, 10]) {
  G.PCT_PER_DEF = per;
  const m = S.mid2, l = S.late;
  const gm = mkGen(m.lv, m.rk, m.set), gl = mkGen(l.lv, l.rk, l.set);
  const a1 = viaSimulate(armyOf(m), gm, pickTiles(12)[0], m);
  const a2 = viaSimulate(armyOf(l), gl, pickTiles(15)[0], l);
  console.log('  PCT_PER_DEF=' + String(per).padEnd(4) + (a1.loss.toFixed(0) + '%').padStart(10) + (a2.loss.toFixed(0) + '%').padStart(13));
}
G.PCT_PER_DEF = 100;
