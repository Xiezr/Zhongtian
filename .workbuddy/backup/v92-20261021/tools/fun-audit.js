/* ============================================================
 * 好玩度体检（v91.99 复盘 · 以"选择"为尺子）
 * ------------------------------------------------------------
 * 老板的话：「好玩应该在合理前」。
 * 那么第一问题不是"数值是否自洽"，而是：**玩家在一场仗里到底做了几个有效的决定？**
 * 一个决定"有效"的定义：换个选法，战损/胜负明显不同（≥8 个百分点）。
 *
 * 逐个量：① 编成 ② 动作 ③ 目标 ④ 兵种数量（多带/少带）
 * 以及：⑤ 野地等级曲线是否平滑（有没有"跳过一级突然打不过"的断崖）
 * ============================================================ */
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function el() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; },
    querySelector() { return el(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const _c = {};
global.document = { createElement: el, querySelector: (s) => (_c[s] = _c[s] || el()), querySelectorAll: () => [], getElementById: (id) => (_c['#' + id] = _c['#' + id] || el()), addEventListener() {}, readyState: 'complete' };
require('E:/Deepseekdb/js/bundle.js');
const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'fun', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = Math.floor((x.lv || 0) / 2); }); return t; };
const mkGen = (lv) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; };
const BOOST = (techs, b) => ({ techs: techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });

function fight(mine, gen, wl, techs, b, plan) {
  const w = G.wildDefenseAt(ciOf(180, 300) + wl, wl);
  if (!w) return null;
  const opts = { kind: 'wild', pid: 1 };
  if (plan) opts.plan = plan;
  const r = G.battle.withBoost(BOOST(techs, b), () => T.simulate(mine, gen, w.army, 0, w.gen || null, opts));
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(mine)), rounds: r.rounds };
}
const P = (s) => console.log(s);
const gen = mkGen(150);
const TECHS = halfT(), B = 0.12, N = 70000;

P('========== ① 编成：换配方，战损差多少 ==========');
P('（同人数 7 万、同科技、打 Lv12；跨度 ≥8 点 = "编成"是个有效决定）');
const COMPS = [
  ['主战60+东风40', { zhuzhan: 6, huopao: 4 }],
  ['主战50+东风30+泰坦20', { zhuzhan: 5, huopao: 3, taitan: 2 }],
  ['主战100', { zhuzhan: 10 }],
  ['东风100', { huopao: 10 }],
  ['迫击炮60+东风40', { paojiban: 6, huopao: 4 }],
  ['重装60+东风40', { zhongjiqiang: 6, huopao: 4 }],
  ['轨道60+东风40', { guidaopao: 6, huopao: 4 }],
  ['步行机100', { buxingji: 10 }],
];
const compRes = [];
COMPS.forEach(([n, r]) => {
  const tot = Object.keys(r).reduce((a, x) => a + r[x], 0);
  const army = {}; Object.keys(r).forEach((k) => { army[k] = Math.round(N * r[k] / tot); });
  const x = fight(army, gen, 12, TECHS, B);
  compRes.push({ n, ...x });
  P('   ' + n.padEnd(24) + (x.win ? '胜' : '败') + ' 损 ' + x.loss.toFixed(0) + '% / ' + x.rounds + 'r');
});
const best = Math.min(...compRes.map((x) => x.loss)), worst = Math.max(...compRes.map((x) => x.loss));
P('   → 最好 ' + best.toFixed(0) + '% · 最差 ' + worst.toFixed(0) + '% · **跨度 ' + (worst - best).toFixed(0) + ' 点**');

P('');
P('========== ② 动作：换动作，战损差多少 ==========');
P('（同编成 主战60+东风40、同目标；跨度 ≥8 点 = "动作"是个有效决定）');
const ACT = ['advance', 'hold', 'retreat'];
const actRes = [];
ACT.forEach((s) => {
  const army = { zhuzhan: 42000, huopao: 28000 };
  const plan = () => ({ atk: { zhuzhan: { s: s }, huopao: { s: s } } });
  const x = fight(army, gen, 12, TECHS, B, plan);
  actRes.push({ s, ...x });
  P('   ' + ({ advance: '全体前进', hold: '全体驻守', retreat: '全体后退' })[s] + '  ' + (x.win ? '胜' : '败') + ' 损 ' + x.loss.toFixed(0) + '% / ' + x.rounds + 'r');
});
const aMin = Math.min(...actRes.map((x) => x.loss)), aMax = Math.max(...actRes.map((x) => x.loss));
P('   → **跨度 ' + (aMax - aMin).toFixed(0) + ' 点**');

P('');
P('========== ③ 目标：指定 vs 不指定 ==========');
(function () {
  const army = { zhuzhan: 42000, huopao: 28000 };
  function run(tid) {
    const w = G.wildDefenseAt(ciOf(180, 300) + 12, 12);
    const ids = Object.keys(w.army || {});
    const target = tid || ids[0];
    const plan = () => ({ atk: { zhuzhan: { t: target }, huopao: { t: target } } });
    const r = G.battle.withBoost(BOOST(TECHS, B), () => T.simulate(army, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1, plan: plan }));
    return 100 * r.atkLoss / Math.max(1, men(army));
  }
  const w = G.wildDefenseAt(ciOf(180, 300) + 12, 12);
  const ids = Object.keys(w.army || {});
  const out = ids.map((id) => ({ id, name: (D.TROOPS[id] || {}).name || id, loss: run(id) }));
  out.forEach((x) => P('   死盯 ' + x.name.padEnd(8) + ' 损 ' + x.loss.toFixed(0) + '%'));
  const lo = Math.min(...out.map((x) => x.loss)), hi = Math.max(...out.map((x) => x.loss));
  P('   → **跨度 ' + (hi - lo).toFixed(0) + ' 点**（0~3 点 = 选靶无效）');
})();

P('');
P('========== ④ 兵力：多带/少带 ==========');
[50000, 60000, 70000, 80000, 90000].forEach((n) => {
  const army = { zhuzhan: Math.round(n * 0.6), huopao: Math.round(n * 0.4) };
  const x = fight(army, gen, 12, TECHS, B);
  P('   ' + String(n).padStart(6) + ' 人 → ' + (x.win ? '胜' : '败') + ' 损 ' + x.loss.toFixed(0) + '%');
});

P('');
P('========== ⑤ 野地曲线：相邻级是不是"断崖" ==========');
P('（同一支 7 万标准编成，逐级打上去）');
for (let wl = 8; wl <= 15; wl++) {
  const army = { zhuzhan: 42000, huopao: 28000 };
  const x = fight(army, gen, wl, TECHS, B);
  if (!x) continue;
  P('   Lv' + String(wl).padStart(2) + ' ' + (x.win ? '胜' : '败') + ' 损 ' + String(x.loss.toFixed(0)).padStart(3) + '% / ' + x.rounds + 'r');
}
