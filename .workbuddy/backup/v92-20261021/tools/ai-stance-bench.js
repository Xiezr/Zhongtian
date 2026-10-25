/* ============================================================
 * AI 选动作多场景基准（v91.96）
 * 为什么不能只看镜像局：镜像局是"同编成互撞"，最优点几乎必然是"快打快结束"，
 * 单场景调参必然过拟合。这里放 6 个不同对手，看规则是否**跨场景**都站得住。
 * 评价口径：我方战损率（越低越好）+ 是否赢；同时报"相对全默认的改善"。
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
G.newGame({ name: 'ai', cityName: '灰岗', mapSeed: 20261020 });

const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };

/* 六场：编成差异拉开（近战/远程/空军/重甲/混编/镜像） */
const CASES = [
  { n: '镜像', mine: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 },
    foe: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 } },
  { n: '我远程 vs 近战潮', mine: { daodanche: 900, zhuzhan: 300 }, foe: { buxingji: 2600 } },
  { n: '我近战 vs 远程阵', mine: { zhuzhan: 1200, buxingji: 800 }, foe: { daodanche: 900, dunwei: 500 } },
  { n: '混编 vs 重甲', mine: { zhuzhan: 600, daodanche: 500, wuren: 60 }, foe: { dunwei: 1400, huopao: 30 } },
  { n: '空军 vs 地面', mine: { wuren: 120, zhuzhan: 400 }, foe: { buxingji: 1500, daodanche: 300 } },
  { n: '我偏弱 vs 强敌', mine: { zhuzhan: 500, daodanche: 400 }, foe: { zhuzhan: 900, daodanche: 700 } },
];

function one(c, smart) {
  const env = T.begin(JSON.parse(JSON.stringify(c.mine)), null, JSON.parse(JSON.stringify(c.foe)), 0, null, { stances: {} });
  const rec = { side: 'atk', cmd: {} };
  let guard = 0;
  while (!env.over && guard++ < 40) {
    if (smart) G.battle.smartApply(rec, env);
    const st = env.step(); if (!st) break;
  }
  const fin = env.finish();
  let aL = 0, dL = 0;
  for (const k in fin.atkLossBy) aL += fin.atkLossBy[k];
  for (const k in fin.defLossBy) dL += fin.defLossBy[k];
  return { loss: 100 * aL / men(c.mine), foe: 100 * dL / men(c.foe), win: fin.winner === 'atk' || dL >= men(c.foe) * 0.999, aL, dL };
}

const ORIG = G.battle.smartStanceOf;
const RULES = {
  'A 现行': ORIG,
  'B 安全窗口才守': function (u, gap, plan, mode, ctx) {
    plan = plan || G.battle.smartPlanOf(); mode = mode || 'echelon';
    if (mode === 'turtle') return 'hold';
    if (mode === 'charge') return 'advance';
    const er = (u.er != null ? u.er : (u.range || 0));
    if (mode === 'line') return (gap <= er) ? 'hold' : 'advance';
    if (mode === 'spear' && plan.fastestId && u.id === plan.fastestId) return 'advance';
    if ((u.range || 0) >= 500) {
      if (gap > er * (plan.rangeK || 1)) return 'advance';
      if (ctx && gap <= ctx.threat) return 'advance';
      return 'hold';
    }
    const isCav = (u.spd || 0) >= 400;
    const k = isCav ? (plan.gapCav != null ? plan.gapCav : 250) : (plan.gapInf != null ? plan.gapInf : 250);
    return (gap <= k) ? 'hold' : 'advance';
  },
  'C 全推进': function () { return 'advance'; },
  'D 远程守·近战冲': function (u, gap, plan, mode, ctx) {
    plan = plan || G.battle.smartPlanOf(); mode = mode || 'echelon';
    const er = (u.er != null ? u.er : (u.range || 0));
    if ((u.range || 0) >= 500) {
      if (gap > er * (plan.rangeK || 1)) return 'advance';
      if (ctx && gap <= ctx.threat) return 'advance';
      return 'hold';
    }
    return 'advance';
  },
};

const base = CASES.map((c) => one(c, false));
console.log('场景基准（全默认 = 不给指令）：');
CASES.forEach((c, i) => console.log('  ' + c.n.padEnd(18) + (base[i].win ? '胜' : '败') + ' 我损 ' + base[i].loss.toFixed(0) + '%'));
console.log('');
const head = '规则'.padEnd(16) + CASES.map((c) => c.n.slice(0, 6).padStart(8)).join('') + '  平均战损  相对全默认';
console.log(head);
Object.keys(RULES).forEach((rn) => {
  G.battle.smartStanceOf = RULES[rn];
  const rs = CASES.map((c) => one(c, true));
  const avg = rs.reduce((a, x) => a + x.loss, 0) / rs.length;
  const bavg = base.reduce((a, x) => a + x.loss, 0) / base.length;
  console.log(rn.padEnd(16) + rs.map((x) => (x.win ? '' : '败') + x.loss.toFixed(0).padStart(6)).join('') + '   ' + avg.toFixed(1).padStart(6) + '   ' + ((avg / bavg - 1) * 100).toFixed(0) + '%');
});
G.battle.smartStanceOf = ORIG;
