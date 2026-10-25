/* ============================================================
 * 复核：动作系统到底有没有"杠杆"（v91.98）
 * ------------------------------------------------------------
 * 上一轮的结论建立在**稻草人口径**上：我测的"驻守"是从第 1 回合就原地不动，
 * 而开局在射程外 → 等于白站几回合。那不是"驻守"，那是"不准备"。
 *
 * 本轮用 `opts.plan` 实现三条**都合理**的策略，再比：
 *   P1 全进      ：一路推进，停在射程边缘（引擎默认 advance）
 *   P2 到边缘守  ：推进到刚好进射程就守（= P1 的等价物，作对照）
 *   P3 到近半程守：推进到"近半程"（er×0.5，衰减 1.0 那一档）再守  ← 公平的"驻守"
 * 判据：如果 P3 在某些场景明显优于 P1，说明动作有杠杆，之前结论要修正；
 *       如果 P3 恒等于/劣于 P1，说明"位置"这东西在伤害模型里确实不产生取舍。
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
require('E:/Deepseekdb/js/bundle-core.js');
require('E:/Deepseekdb/js/bundle-war.js');
require('E:/Deepseekdb/js/bundle-ui.js');
const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'rv', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };

D.STANCE_TRIANGLE_ON = true;
D.CONTACT.on = true;

/* 公平策略：推进到 er×k 再守；近战一律推进（它不推进就没戏） */
const toBand = (k) => (snap) => {
  const eFront = snap.def.filter((u) => u.count > 0).reduce((a, u) => Math.max(a, u.adv), 0);
  const m = {};
  snap.atk.filter((u) => u.count > 0).forEach((u) => {
    if ((u.range || 0) >= 500) {
      const gap = snap.field - u.adv - eFront;
      m[u.id] = { s: gap <= u.er * k ? 'hold' : 'advance' };
    } else m[u.id] = { s: 'advance' };
  });
  return { atk: m };
};

function fight(mine, foe, planFn, stopK) {
  const bak = T.ADVANCE_STOP_K_RANGED;
  T.ADVANCE_STOP_K_RANGED = stopK == null ? 1 : stopK;
  try {
    const opts = { stances: {} };
    if (planFn) opts.plan = planFn;
    const env = T.begin(JSON.parse(JSON.stringify(mine)), null, JSON.parse(JSON.stringify(foe)), 0, null, opts);
    env.runAll();
    const r = env.finish();
    return { my: 100 * (r.atkLoss || 0) / men(mine), foe: 100 * (r.defLoss || 0) / men(foe), rounds: r.rounds, win: r.winner === 'atk' };
  } finally { T.ADVANCE_STOP_K_RANGED = bak; }
}

const CASES = [
  { n: '镜像', mine: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 },
    foe: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 } },
  { n: '远程vs近战潮', mine: { daodanche: 900, zhuzhan: 300 }, foe: { buxingji: 2600 } },
  { n: '近战vs远程阵', mine: { zhuzhan: 1200, buxingji: 800 }, foe: { daodanche: 900, dunwei: 500 } },
  { n: '混编vs重甲', mine: { zhuzhan: 600, daodanche: 500, wuren: 60 }, foe: { dunwei: 1400, huopao: 30 } },
  { n: '空军vs地面', mine: { wuren: 120, zhuzhan: 400 }, foe: { buxingji: 1500, daodanche: 300 } },
  { n: '偏弱vs强敌', mine: { zhuzhan: 500, daodanche: 400 }, foe: { zhuzhan: 900, daodanche: 700 } },
];

const POL = [
  ['P1 全进（停射程边缘）', null, 1.0],
  ['P2 到边缘即守', toBand(1.0), 1.0],
  ['P3 到近半程才守', toBand(0.5), 1.0],
  ['P4 全进（停近半程）', null, 0.5],
];
console.log('动作策略对照（三角开 · 接触面开）· 格子 = 我损% / 回合');
console.log('策略'.padEnd(22) + CASES.map((c) => c.n.slice(0, 7).padStart(10)).join(''));
POL.forEach(([name, plan, sk]) => {
  const rs = CASES.map((c) => fight(c.mine, c.foe, plan, sk));
  console.log(name.padEnd(22) + rs.map((x) => ((x.win ? '' : '败') + x.my.toFixed(0) + '%/' + x.rounds + 'r').padStart(10)).join(''));
});
