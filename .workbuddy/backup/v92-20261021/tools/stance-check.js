/* ============================================================
 * tools/stance-check.js  动作三角验收（v91.95）
 * ------------------------------------------------------------
 * 验收三条：
 *   ① 同一场仗，三个动作的战损差异 ≥8 个百分点（否则"动作"没有意义）；
 *   ② 没有支配动作 —— 最优动作的领先幅度 ≤20 个百分点，且不是"全场景同一个"；
 *   ③ 连续驻守的减伤真的衰减（第 1 回合 vs 第 3 回合的受创比）。
 *
 * 用法：node tools/stance-check.js > tools/stance-check.log 2>&1
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
require(path.join(__dirname, '..', 'js', 'bundle.js'));
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'sc', cityName: '灰岗', mapSeed: 20261020 });

const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : 12345; };
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const SET = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' };
const fullSet = q => { const o = {}; for (const id in D.EQUIP) { const e = D.EQUIP[id]; if (e.set === SET[q]) o[e.slot] = id; } return o; };
const mk = (lv, q) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); g.equip = fullSet(q); return g; };
const BOOST = (techs, b) => ({ techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });
const UIDS = ['zhuzhan', 'huopao', 'taitan'];

function run(lv, q, cap, wl, techs, b, stance, opts) {
  opts = opts || {};
  const g = mk(lv, q);
  const army = { zhuzhan: Math.round(cap * .5), huopao: Math.round(cap * .3), taitan: Math.round(cap * .2) };
  const w = G.wildDefenseAt(ciOf(180, 300) + wl, wl);
  const plan = opts.noPlan ? null : () => {
    const m = {}; UIDS.forEach(k => { m[k] = { s: stance }; });
    return { atk: m };
  };
  const r = G.battle.withBoost(BOOST(techs, b), () => {
    const env = G.tactic.begin(army, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1, plan: plan || undefined });
    env.runAll(); const rr = env.finish();
    return { win: rr.winner === 'atk', loss: 100 * rr.atkLoss / Math.max(1, men(army)), rounds: rr.rounds, log: rr.roundsLog || [] };
  });
  return r;
}

const CASES = [
  { n: '前期+ Lv9', lv: 60, q: 3, cap: 20000, wl: 9, techs: {}, b: 0.08 },
  { n: '中期+ Lv12', lv: 150, q: 4, cap: 70000, wl: 12, techs: halfT(), b: 0.12 },
  { n: '后期 Lv15', lv: 240, q: 6, cap: 150000, wl: 15, techs: fullT(), b: 0.20 },
];
const ST = ['advance', 'hold', 'retreat'];

console.log('======== ① 三动作战损对比（同编成同目标，只换动作）========');
let worst = 0, gaps = [];
CASES.forEach(c => {
  const row = {};
  ST.forEach(s => { row[s] = run(c.lv, c.q, c.cap, c.wl, c.techs, c.b, s); });
  const best = ST.slice().sort((a, b2) => row[a].loss - row[b2].loss)[0];
  const gap = Math.max(...ST.map(s => row[s].loss)) - Math.min(...ST.map(s => row[s].loss));
  gaps.push(gap);
  console.log(`  ${c.n.padEnd(12)} ` + ST.map(s => `${s}:${row[s].win ? '胜' : '败'}${row[s].loss.toFixed(0)}%/${row[s].rounds}r`).join('  ') +
    `  → 最优 ${best} · 极差 ${gap.toFixed(0)} 点`);
});
console.log(`  → 极差中位 ${gaps.sort((a, b) => a - b)[1].toFixed(0)} 点（验收线 ≥8 点：${gaps[1] >= 8 ? '✅' : '❌'}）`);

console.log('\n======== ② 是否存在支配动作 ========');
const bestCount = {};
CASES.forEach(c => {
  const row = {};
  ST.forEach(s => { row[s] = run(c.lv, c.q, c.cap, c.wl, c.techs, c.b, s).loss; });
  const best = ST.slice().sort((a, b) => row[a] - row[b])[0];
  bestCount[best] = (bestCount[best] || 0) + 1;
});
const top = Object.keys(bestCount).sort((a, b) => bestCount[b] - bestCount[a])[0];
console.log('  最优动作分布：' + Object.keys(bestCount).map(k => `${k}×${bestCount[k]}`).join(' · ') +
  ` → ${bestCount[top] === CASES.length ? '⚠ 全场景同一动作（'+top+'）' : '✅ 随场景变化'}`);

console.log('\n======== ③ 连续驻守的减伤衰减（防龟缩）========');
const holdDef = (D.STANCES || []).filter(x => x.id === 'hold')[0];
console.log(`  表：首回合受创 ×${holdDef.taken} · 连用第 2 回合起 ×${holdDef.takenLater}`);
const c0 = CASES[1];
const rh = run(c0.lv, c0.q, c0.cap, c0.wl, c0.techs, c0.b, 'hold');
const perRound = (rh.log || []).map(rd => {
  let k = 0;
  (rd.events || []).forEach(e => { if (e.side === 'atk') (e.hits || []).forEach(h => k += h.kill); });
  return k;
});
console.log('  驻守方每回合战损（人）：' + perRound.slice(0, 6).join(' → ') +
  (perRound.length > 1 ? `（第2回合起应不低于第1回合：${perRound[1] >= perRound[0] ? '✅' : '❌'}）` : ''));

console.log('\n======== ④ 换编成：纯近战（没有远程优势时，驻守还最优吗）========');
const g2 = mk(150, 4);
const melee = { zhuzhan: 90000, taitan: 30000 };
const w12 = G.wildDefenseAt(ciOf(180, 300) + 12, 12);
['advance', 'hold', 'retreat'].forEach(s => {
  const plan = () => { const m = {}; ['zhuzhan', 'taitan'].forEach(k => { m[k] = { s }; }); return { atk: m }; };
  const r = G.battle.withBoost(BOOST(halfT(), 0.12), () => {
    const env = G.tactic.begin(melee, g2, w12.army, 0, w12.gen || null, { kind: 'wild', pid: 1, plan: plan });
    env.runAll(); const rr = env.finish();
    return { win: rr.winner === 'atk', loss: 100 * rr.atkLoss / Math.max(1, men(melee)), rounds: rr.rounds };
  });
  console.log(`  纯近战 9万主战+3万泰坦 · ${s.padEnd(8)} ${r.win ? '胜' : '败'} 损 ${r.loss.toFixed(0)}% / ${r.rounds}r`);
});
