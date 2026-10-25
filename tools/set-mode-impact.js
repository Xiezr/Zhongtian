/* ============================================================
 * tools/set-mode-impact.js  套装口径改动的实测影响（混搭 vs 整套）
 * ------------------------------------------------------------
 * 背景：v91.92 起套装**只取已达成的最高档**（原为逐档累加）。
 *   后果一：同一件数下总加成变小（后期削尾）；
 *   后果二：**整套 > 混搭** 的差距被放大 —— 必须量出来，
 *           否则"一键最优"给玩家配出来的混搭会悄悄变弱。
 *
 * 用法：node tools/set-mode-impact.js
 * 口径与 tools/verify-stages.js 完全一致（同阶段参数、同地块、同引擎）。
 * ============================================================ */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require(path.join(__dirname, '..', 'js', 'bundle-core.js'));
require(path.join(__dirname, '..', 'js', 'bundle-war.js'));
require(path.join(__dirname, '..', 'js', 'bundle-ui.js'));
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'sm', cityName: '灰岗', mapSeed: 20261016 });

const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || 0;
/* 混搭：逐槽按"攻×0.5+防"取最强（= 游戏里"一键装备"的评分口径） */
function mixOf(qMax) {
  const by = {};
  for (const e of EQ) { if (qOf(e) > qMax) continue; const v = (e.atk || 0) * 0.5 + (e.def || 0); if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e }; }
  const o = {}; for (const s in by) o[s] = by[s].e.id; return o;
}
/* 整套：同档三套里挑"武力+攻击值"总和最高的那套，19 槽全穿 */
function fullOf(setId) {
  const o = {};
  for (const e of EQ) if (e.set === setId) o[e.slot] = e.id;
  return o;
}
const SET_BY_Q = { 4: 'rare_zhan', 6: 'divine_zhan' };

const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const ST = {
  mid2: { n: '中期+', lv: 150, rank: 'tian', q: 4, cap: 120000, techs: halfT(), b: [0.1, 0.1, 0.05] },
  late: { n: '后期', lv: 240, rank: 'tian', q: 6, cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] },
};
function mkGen(s, eq) {
  const g = G.makeGeneral('将', s.lv, 'idle', null, true, s.rank, 'balance');
  G.rankOf(g); G.guardFillOf(g);
  /* 极值练法：自由点全投武力（后期玩家的自然选择） */
  g.freePts = 0;
  if (eq) g.equip = Object.assign({}, eq);
  return g;
}
function boostOf(s) { return { techs: s.techs || {}, world: {}, buffs: {}, atkMult: 1 + s.b[0], siegeMult: 1, cityDefMult: 1, defAdd: s.b[1] }; }
function armyOf(s) { return { zhuzhan: Math.round(s.cap * .5), huopao: Math.round(s.cap * .3), taitan: Math.round(s.cap * .2) }; }
const TILES = [[180, 300], [200, 310], [220, 290], [240, 305], [260, 295]];
const ciOf = (x, y) => { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
const tiles = lv => TILES.map(([x, y]) => G.wildDefenseAt(ciOf(x, y), lv)).filter(w => w && w.army);
function run(s, g, lv) {
  const a = armyOf(s), w = tiles(lv)[0];
  return G.battle.withBoost(boostOf(s), () => {
    const r = G.tactic.simulate(a, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
  });
}

console.log('=== 套装改动实测：混搭 vs 整套（同阶段参数 · 与 verify-stages 同口径）===');
[[12, 'mid2', 4], [15, 'late', 6]].forEach(([lv, key, q]) => {
  const s = ST[key];
  const mix = mixOf(q), full = fullOf(SET_BY_Q[q]);
  const gm = mkGen(s, mix), gf = mkGen(s, full);
  const am = G.genAttrs(gm), af = G.genAttrs(gf);
  const rm = run(s, gm, lv), rf = run(s, gf, lv);
  const drM = G.coverOf(am.tong, 1, men(armyOf(s))).dr;
  const drF = G.coverOf(af.tong, 1, men(armyOf(s))).dr;
  console.log(`\n  [${s.n} · 野地 Lv${lv}]`);
  console.log(`    混搭（一键最优口径）  全军攻 +${Math.round(am.atkPct * 100)}% · 减伤 ${(drM * 100).toFixed(1)}% · ` +
    `${rm.win ? '胜' : '败'} 损 ${rm.loss.toFixed(1)}% / ${rm.rounds}r`);
  console.log(`    整套 ${D.SETS[SET_BY_Q[q]].name}      全军攻 +${Math.round(af.atkPct * 100)}% · 减伤 ${(drF * 100).toFixed(1)}% · ` +
    `${rf.win ? '胜' : '败'} 损 ${rf.loss.toFixed(1)}% / ${rf.rounds}r`);
  console.log(`    整套相对混搭：攻击倍率 ${(af.atkPct / Math.max(1e-9, am.atkPct)).toFixed(2)}× · 战损差 ${(rm.loss - rf.loss).toFixed(1)} 个百分点`);
});

console.log('\n=== 指挥溢出减伤的读数（不同指挥 / 不同兵团）===');
console.log('  指挥      15 万兵     3 万兵     700 兵');
[1500, 3000, 6000, 12000, 19134].forEach(t => {
  const c = [150000, 30000, 700].map(T => (G.coverOf(t, 1, T, T).dr * 100).toFixed(1) + '%');
  console.log('  ' + String(t).padEnd(8) + c.map(x => x.padStart(9)).join('  '));
});
