/* 将领 vs 编成：谁在决定胜负（只读探针，不改引擎）
   做法：把 genAttrs 的 atkPct/defPct 乘一个系数 k（k=0 等于是"去掉将领的伤害影响"），
   然后比较两条轴对同一场仗的撬动幅度：
     A 轴 = 换将领（0 → 顶配武器）
     B 轴 = 换编成（纯兵 → 混编）
   同一度量：净损差（攻方损兵% - 守方损兵%）
*/
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0;
global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() {
  return {
    tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; }
  };
}
const cache = {};
global.document = {
  createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [],
  getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete'
};
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;

G.newGame({ name: 'axis', cityName: '灰岗', mapSeed: 20261016 });

/* ---- 可调：将领影响系数 k（1=现状；0=完全去掉） ---- */
let K = 1;
const rawGenAttrs = G.genAttrs;
G.genAttrs = function (g) {
  const a = rawGenAttrs.call(G, g);
  if (K === 1) return a;
  const o = Object.assign({}, a);
  o.atkPct = (a.atkPct || 0) * K;
  o.defPct = (a.defPct || 0) * K;
  /* spd 与 sta（血量）也一并在 0 档归零，才是"彻底无将" */
  if (K === 0) { o.spd = 0; o.sta = 0; o.staMax = 0; }
  return o;
};

function mkGen(o) {
  return Object.assign({ id: 'g', name: 't', level: 1, tong: 100, yw: 0, zm: 0, nz: 0, speed: 20, sta: 400, staMax: 400, equip: {}, attach: [] }, o);
}
/* 用武力模拟装备攻击（atkPct = atk/1000，故 yw = 20×atk 等效） */
const G_NONE = null;
const G_1400 = mkGen({ yw: 28000 });   /* atkPct 14? 不：yw*0.0005*20… 见下校验 */
const G_5200 = mkGen({ yw: 5200 * 20 });
const G_9000 = mkGen({ yw: 9000 * 20 });

/* 编成（同人口：按 pop 折算，各 60000 pop 量级） */
function comp(shares) {
  const out = {};
  for (const id in shares) {
    const t = D.TROOPS[id];
    out[id] = Math.max(1, Math.round(shares[id] * 60000 / t.pop));
  }
  return out;
}
const C = {
  '纯主战': comp({ zhuzhan: 1 }),
  '纯炮兵': comp({ huopao: 1 }),
  '纯泰坦': comp({ taitan: 1 }),
  '纯轰炸': comp({ wuren: 1 }),
  '主战70+炮30': comp({ zhuzhan: 0.7, huopao: 0.3 }),
  '坦40+炮60': comp({ taitan: 0.4, huopao: 0.6 }),
  '主战+炮+轰': comp({ zhuzhan: 1 / 3, huopao: 1 / 3, wuren: 1 / 3 }),
};

function margin(atk, def, gen) {
  const r = G.tactic.simulate(atk, gen || null, def, 0, null, { kind: 'wild', pid: 1 });
  const sa = Object.values(atk).reduce((a, b) => a + b, 0);
  const sd = Object.values(def).reduce((a, b) => a + b, 0);
  return 100 * r.defLoss / Math.max(1, sd) - 100 * r.atkLoss / Math.max(1, sa);  /* 正=攻方占优 */
}

console.log('=== 校验：武力换 atkPct 的等效关系 ===');
const a0 = rawGenAttrs.call(G, mkGen({ yw: 9000 * 20 }));
console.log('  yw=180000 → atkPct =', a0.atkPct.toFixed(2), '（目标 9.00，即武器 atk 9000 的 +900%）');

console.log('\n=== A 轴：同一编成，只换将领（净损差，正=攻方占优）===');
const defA = C['纯主战'];
for (const [name, atk] of [['纯炮兵', C['纯炮兵']], ['坦40+炮60', C['坦40+炮60']]]) {
  const row = [];
  for (const [gl, g] of [['无将', G_NONE], ['武器1400', G_1400], ['武器5200', G_5200], ['武器9000', G_9000]]) {
    K = 1;
    row.push(gl + ' ' + margin(atk, defA, g).toFixed(1));
  }
  console.log(('  ' + name).padEnd(14), row.join('  |  '));
}

console.log('\n=== A 轴在 k=0（彻底去将）时的落差 ===');
for (const [name, atk] of [['纯炮兵', C['纯炮兵']], ['坦40+炮60', C['坦40+炮60']]]) {
  const v1 = (K = 1, margin(atk, defA, G_9000));
  const v0 = (K = 0, margin(atk, defA, G_9000));
  console.log(('  ' + name).padEnd(14), '现状 ' + v1.toFixed(1), '→ 去将 ' + v0.toFixed(1), ' 落差 ' + Math.abs(v1 - v0).toFixed(1));
}
K = 1;

console.log('\n=== B 轴：同一将领，只换编成（打纯主战守军）===');
for (const [gl, g] of [['无将', G_NONE], ['武器9000', G_9000]]) {
  K = 1;
  const row = [];
  for (const n of ['纯炮兵', '纯泰坦', '纯轰炸', '主战70+炮30', '坦40+炮60', '主战+炮+轰']) {
    row.push(n + ' ' + margin(C[n], defA, g).toFixed(1));
  }
  console.log('  ' + gl + '：');
  row.forEach(r => console.log('     ', r));
}

console.log('\n=== 编成循环赛（7 套互打），看"去将"是否让编成重新决定胜负 ===');
function rr(g) {
  const names = Object.keys(C);
  const sc = {};
  names.forEach(n => sc[n] = 0);
  for (let i = 0; i < names.length; i++) for (let j = 0; j < names.length; j++) {
    if (i === j) continue;
    sc[names[i]] += margin(C[names[i]], C[names[j]], g);
  }
  return names.map(n => [n, sc[n] / (names.length - 1)]).sort((a, b) => b[1] - a[1]);
}
for (const [label, g, k] of [['现状 + 武器9000', G_9000, 1], ['现状 + 无将', G_NONE, 1], ['去将(k=0) + 武器9000', G_9000, 0]]) {
  K = k;
  const r = rr(g);
  console.log('  ' + label + '：' + r.map((x, i) => (i + 1) + '.' + x[0] + ' ' + x[1].toFixed(1)).join('  '));
  console.log('     榜首-榜尾 跨度 = ' + (r[0][1] - r[r.length - 1][1]).toFixed(1));
}
K = 1;
