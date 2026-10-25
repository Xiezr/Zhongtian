const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, addEventListener() {}, appendChild() {},
    setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [],
  getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() {}, readyState: 'complete' };
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;

/* ---- ① 兵种性价比 ---- */
const rows = [];
for (const id in D.TROOPS) {
  const t = D.TROOPS[id];
  if (t.nocombat) continue;
  const cost = t.cost || {};
  const res = (cost.grain || 0) / 1000 + (cost.wood || 0) / 1000 + (cost.stone || 0) / 1000 + (cost.iron || 0) / 1000;
  const power = G.power ? G.power.troopOf(id) : (t.atk * t.hp);
  rows.push({ id, name: t.name || id, pop: t.pop, time: t.time, res: +res.toFixed(2), power,
    perRes: +(power / Math.max(0.01, res)).toFixed(0), perPop: +(power / t.pop).toFixed(0),
    perTime: +(power / Math.max(1, t.time)).toFixed(0) });
}
rows.sort((a, b) => b.perRes - a.perRes);
console.log('════ 兵种性价比（战力/单位资源）════');
console.log('兵种      人口  训练s   资源k   战力      战力/资源   战力/人口  战力/秒');
rows.forEach(r => console.log(
  r.name.padEnd(9) + String(r.pop).padStart(4) + String(r.time).padStart(7) + String(r.res).padStart(8) +
  String(r.power).padStart(10) + String(r.perRes).padStart(12) + String(r.perPop).padStart(10) + String(r.perTime).padStart(9)));

/* v126：headline 只统计**战斗兵种**（原写法把运输平台/侦察单元也算进来，
   于是"最低性价比 14"其实是后勤单位，得出的"差 15 倍"是口径错误 —— 
   战斗兵种内部的真实落差是 2.8 倍）。后勤兵种仍列在表里，只是不参与最高/最低。 */
const fighters = rows.filter(r => {
  const t = (G.DATA.TROOPS || {})[r.id] || {};
  return !t.nocombat && (t.atk || 0) >= 100;
});
const best = fighters[0] || rows[0], worst = fighters[fighters.length - 1] || rows[rows.length - 1];
console.log('\n最高性价比：' + best.name + '（' + best.perRes + '）· 最低：' + worst.name + '（' + worst.perRes + '）→ 差 ' + (best.perRes / worst.perRes).toFixed(1) + ' 倍'
  + '　（仅战斗兵种 ' + fighters.length + ' 个；后勤/侦察不计入）');

/* ---- ② 星球递增推演 ---- */
const E0 = D.WILD_DEF_ORIG_TOTAL[D.WILD_DEF_ORIG_TOTAL.length - 1];  // 野地 Lv10 = 40000
const CITY_CAP = 50000;   // 单城兵力上限（政务厅 Lv10 + 满净化厂，代码注释口径）
console.log('\n════ 星球 ×1.5 推演（敌方基准 = 野地 Lv10 = ' + E0 + '）════');
const scen = [
  ['保守：每星球 1 城', n => CITY_CAP * (1 + (n - 1) * 1)],
  ['常规：每星球 2 城', n => CITY_CAP * (1 + (n - 1) * 2)],
  ['乐观：每星球 3 城', n => CITY_CAP * (1 + (n - 1) * 3)],
  ['极限：每星球 5 城', n => CITY_CAP * (1 + (n - 1) * 5)],
  ['科技外溢 1.25^n', n => CITY_CAP * 2 * Math.pow(1.25, n - 1)],
  ['科技外溢 1.4^n', n => CITY_CAP * 2 * Math.pow(1.4, n - 1)],
];
for (const [label, P] of scen) {
  let wall = null;
  for (let n = 1; n <= 30; n++) {
    const E = E0 * Math.pow(1.5, n - 1);
    if (P(n) < E) { wall = n; break; }
  }
  console.log('  ' + label.padEnd(18) + ' → 第 ' + (wall == null ? '>30' : wall) + ' 个星球撞墙');
}
console.log('\n逐年对照（每星球3城 / 敌方×1.5）：');
console.log(' 星球  敌方常规目标   玩家总兵力    余量');
for (let n = 1; n <= 14; n++) {
  const E = E0 * Math.pow(1.5, n - 1), P = CITY_CAP * (1 + (n - 1) * 3);
  console.log('  ' + String(n).padStart(2) + String(Math.round(E)).padStart(13) + String(P).padStart(13) +
    '   ' + (P / E).toFixed(2) + '×');
}
