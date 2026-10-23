/* ============================================================
 * audit_v125b_playtest_dist.js —— 玩法分布的"随机 200 局面"检验（可复跑）
 * ------------------------------------------------------------
 * 为什么需要它：单点样本会把"条件结论"当成"普遍结论"。本项目踩过两次——
 *   · fun-audit 挑的 Lv12 苦战样本 → 选靶跨度 26 点（真实，但只占 7% 局面）
 *   · 我上一版挑的 Lv8 碾压样本 → 选靶跨度 0 点（也真实，占 93% 局面）
 * 只有分布能同时容纳两者。本脚本沿用 fun-audit 的 harness（满将 + 半科技 + withBoost），
 * 随机抽 200 个局面，报"动作/选靶"跨度的中位/p75/p90/最大值。
 *
 * 用法：NODE_PATH=<...>/node_modules node .workbuddy/tools/audit/audit_v125b_playtest_dist.js
 * ============================================================ */
/* 分布检验 v2 —— **沿用 fun-audit 的 harness**（补满将领 + withBoost 半科技 + 同一守军坐标），
 * 只把"挑一个样本"换成"随机抽 200 个局面"，看动作/选靶的跨度分布。
 *
 * v1 的错误（诚实记录）：makeGeneral(..., isStarter=false) 且没调 rankOf/guardFillOf、
 * 也没套 withBoost → 玩家侧被系统性削弱，多数局面直接全灭，
 * 于是"选靶跨度"被压成 0（全 100% 死亡，选谁都是死）。本轮修正后重跑。
 *
 * 用法：node .workbuddy/tmp/a1023/x_dist2.js
 */
'use strict';
const path = require('path');
const R = 'E:/Deepseekdb/';

/* ---------- 与 fun-audit.js 完全一致的加载壳 ---------- */
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function el() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return el(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const _c = {};
global.document = { createElement: el, querySelector: (s) => (_c[s] = _c[s] || el()), querySelectorAll: () => [],
  getElementById: (id) => (_c['#' + id] = _c['#' + id] || el()), addEventListener() {}, readyState: 'complete' };
require(path.join(R, 'js/bundle-core.js'));
require(path.join(R, 'js/bundle-war.js'));
require(path.join(R, 'js/bundle-ui.js'));

const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'dist2', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = Math.floor((x.lv || 0) / 2); }); return t; };
const mkGen = (lv) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; };
const BOOST = (techs, b) => ({ techs: techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });
const gen = mkGen(150);
const TECHS = halfT(), B = 0.12;

const out = []; const P = (...x) => out.push(x.join(' '));

/* 确定性随机 */
let seed = 20261023;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const COMBAT = Object.keys(D.TROOPS).filter((k) => {
  const t = D.TROOPS[k];
  return !t.nocombat && (t.atk || 0) >= 100 && (t.hp || 0) > 0;
});
// 排除运输/采集类（atk 低于 100 的已排除；板车 atk 5 也会被排除）
function randArmy() {
  const n = 2 + Math.floor(rnd() * 3);
  const types = [];
  while (types.length < n) { const t = COMBAT[Math.floor(rnd() * COMBAT.length) % COMBAT.length]; if (types.indexOf(t) < 0) types.push(t); }
  const w = types.map(() => 0.2 + rnd());
  const sw = w.reduce((a, b) => a + b, 0);
  const total = 40000 + Math.floor(rnd() * 120000);
  const a = {};
  types.forEach((t, i) => a[t] = Math.max(1, Math.round(total * w[i] / sw)));
  return a;
}
function run(mine, level, ci, stances) {
  const opts = { kind: 'wild', pid: 1 };
  if (stances) opts.stances = stances;   /* v2 修正：引擎读的是 opts.stances，不是 opts.plan */
  const w = G.wildDefenseAt(ci, level);
  return G.battle.withBoost(BOOST(TECHS, B), () => T.simulate(mine, gen, w.army, 0, w.gen || null, opts));
}
const lossOf = (r, mine) => (r.winner === 'atk' ? (100 * r.atkLoss / Math.max(1, men(mine))) : 100);

const N = 200;
const stanceS = [], targetS = [], winRate = [];
const detail = [];
for (let i = 0; i < N; i++) {
  const lv = 8 + Math.floor(rnd() * 8);
  const mine = randArmy();
  const ci = ciOf(180, 300) + i * 97;
  const base = run(mine, lv, ci, null);
  base.winner === 'atk' && winRate.push(1);

  /* 动作：全驻守 / 全后退 vs 默认 */
  const holdAtk = {}; Object.keys(mine).forEach((k) => holdAtk[k] = { s: 'hold' });
  const rHold = run(mine, lv, ci, { atk: holdAtk });
  stanceS.push(Math.abs(lossOf(rHold, mine) - lossOf(base, mine)));

  /* 选靶：守军每个兵种各指定一次 */
  const w = G.wildDefenseAt(ci, lv);
  const losses = [];
  Object.keys(w.army).forEach((tid) => {
    const st = {}; Object.keys(mine).forEach((k) => st[k] = { t: tid });
    const r = run(mine, lv, ci, { atk: st });
    losses.push(lossOf(r, mine));
  });
  if (losses.length >= 2) {
    const sp = Math.max(...losses) - Math.min(...losses);
    targetS.push(sp);
    if (sp >= 10) detail.push('Lv' + lv + ' 兵力' + men(mine) + ' 跨度' + sp.toFixed(0) + '（' + losses.map((x) => x.toFixed(0)).join('/') + '）');
  }
}
function stat(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  const q = (p) => a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0;
  return { med: q(0.5), p75: q(0.75), p90: q(0.9), over10: 100 * arr.filter((x) => x >= 10).length / arr.length, max: a[a.length - 1] || 0 };
}
const ss = stat(stanceS), ts = stat(targetS);

P('=== 随机 ' + N + ' 局面（Lv8~15 · 随机编成 4~16 万 · 随机守军构成 · 半科技+0.12 加成 · 满状态将领） ===');
P('基准胜率 ' + (100 * winRate.length / N).toFixed(0) + '%');
P(['', '中位', 'p75', 'p90', '最大', '≥10点的比例'].join('\t'));
P(['动作（全驻守 vs 默认）', ss.med.toFixed(0), ss.p75.toFixed(0), ss.p90.toFixed(0), ss.max.toFixed(0), ss.over10.toFixed(0) + '%'].join('\t'));
P(['选靶（守军兵种间跨度）', ts.med.toFixed(0), ts.p75.toFixed(0), ts.p90.toFixed(0), ts.max.toFixed(0), ts.over10.toFixed(0) + '%'].join('\t'));
P('');
if (ss.med === 0 && ss.max === 0) P('  ⚠ 动作注入后完全无变化 —— 先怀疑 harness 注入无效，别急着下结论');
P('跨度 ≥10 点的选靶样本（最多 8 条）：');
detail.slice(0, 8).forEach((d) => P('  ' + d));

console.log(out.join('\n'));
process.exit(0);
