/* ============================================================
 * 动作三角参数网格（v91.96）
 * 问题：hold −25%受创 / −20%输出 这组参数下，"驻守"永远不如"推进"（AI 实证：镜像局全灭）。
 * 方法：把 hold 的受创/输出、移动折损三个参数一起扫，看
 *   ① 每个场景的最优动作是否随场景变化（= 真三角，不是换了个支配动作）
 *   ② 有没有某个动作在所有场景都垫底（= 陷阱，参数不合格）
 * 判据（两轴）：我损更低 **且** 敌损更高 才算"支配"。
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
G.newGame({ name: 'g', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };

const CASES = [
  { n: '镜像', mine: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 },
    foe: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 } },
  { n: '远程vs近战潮', mine: { daodanche: 900, zhuzhan: 300 }, foe: { buxingji: 2600 } },
  { n: '近战vs远程阵', mine: { zhuzhan: 1200, buxingji: 800 }, foe: { daodanche: 900, dunwei: 500 } },
  { n: '混编vs重甲', mine: { zhuzhan: 600, daodanche: 500, wuren: 60 }, foe: { dunwei: 1400, huopao: 30 } },
  { n: '空军vs地面', mine: { wuren: 120, zhuzhan: 400 }, foe: { buxingji: 1500, daodanche: 300 } },
  { n: '偏弱vs强敌', mine: { zhuzhan: 500, daodanche: 400 }, foe: { zhuzhan: 900, daodanche: 700 } },
];

function runStance(c, s) {
  const plan = () => { const m = {}; Object.keys(c.mine).forEach((k) => { m[k] = { s: s }; }); return { atk: m }; };
  const env = T.begin(JSON.parse(JSON.stringify(c.mine)), null, JSON.parse(JSON.stringify(c.foe)), 0, null,
    { stances: {}, plan: plan });
  env.runAll();
  const r = env.finish();
  return { my: 100 * (r.atkLoss || 0) / men(c.mine), foe: 100 * (r.defLoss || 0) / men(c.foe), rounds: r.rounds };
}

const ORIG_DMG = T.stanceDmgMul;
function setParams(taken, takenLater, dmg, cut, firePen) {
  T.stanceDmgMul = function (u) {
    var base = ORIG_DMG(u);
    var mvd = (u && u._moved) || 0;
    if (firePen > 0 && mvd > 0) base *= 1 - firePen * Math.min(1, mvd / T.MOVE_TARGET_REF);
    return base;
  };
  D.STANCES.forEach((x) => {
    if (x.id === 'hold') { x.taken = taken; x.takenLater = takenLater; x.dmg = dmg; }
    if (x.id === 'retreat') { x.taken = 1.25; x.dmg = 0.6; }
  });
  T.MOVE_TARGET_CUT = cut;
}

const GRID = [];

[0.75, 0.70, 0.65].forEach((tk) => [0.9, 0.8].forEach((dm) => [0.2, 0.3, 0.4].forEach((fp) => GRID.push({ tk, dm, cut: 0.2, fp }))));

console.log('每个场景的最优动作（按"我损低、敌损高"两轴判；[败]=没打赢）');
console.log('参数(受创/输出/移动折损)'.padEnd(24) + CASES.map((c) => c.n.slice(0, 7).padStart(9)).join('') + '   陷阱动作');
GRID.forEach((g) => {
  setParams(g.tk, Math.max(0.9, g.tk + 0.15), g.dm, g.cut, g.fp);
  const per = CASES.map((c) => {
    const rs = { advance: runStance(c, 'advance'), hold: runStance(c, 'hold'), retreat: runStance(c, 'retreat') };
    /* 支配：某动作 我损更低（差>1点）且 敌损更高（差>1点） */
    const names = ['advance', 'hold', 'retreat'];
    const nLab = { advance: '进', hold: '守', retreat: '退' };
    const dominated = new Set();
    names.forEach((a) => names.forEach((b) => {
      if (a !== b && rs[a].my < rs[b].my - 1 && rs[a].foe > rs[b].foe + 1) dominated.add(b);
    }));
    /* 最优：未被支配里，我损最低 */
    const alive = names.filter((x) => !dominated.has(x));
    alive.sort((a, b) => rs[a].my - rs[b].my);
    return { best: nLab[alive[0]] || '?', rs, dominated: [...dominated].map((x) => nLab[x]) };
  });
  const lab = '守' + (g.tk * 100).toFixed(0) + '%/出' + (g.dm * 100).toFixed(0) + '%/移动罚' + (g.fp * 100).toFixed(0) + '%';
  /* 全场景都被支配的动作 = 陷阱 */
  const trap = ['进', '守', '退'].filter((n) => per.every((p) => p.dominated.indexOf(n) >= 0));
  console.log(lab.padEnd(24) + per.map((p) => p.best.padStart(9)).join('') + '   ' + (trap.length ? '⚠ ' + trap.join(',') : '—'));
});
