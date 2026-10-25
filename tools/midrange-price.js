/* ============================================================
 * 中程梯队定价反推（v91.99）
 * ------------------------------------------------------------
 * 问题：按"线性战力/千资源"定的价，实战里中程兵等造价 100% 全灭。
 * 原因：本引擎是**平方律**（人人都能开火），不是线性加和 ——
 *   N 个单位的总战力 ∝ N² × hp × atk，所以 cost ∝ √(hp×atk)，
 *   而线性公式会把"贵而少"的兵当成亏本货。
 * 做法：固定敌方，二分"我方人数"，找胜率 50% 的临界人数 N*，
 *   则公平价 = 预算 / N*，再折算 k = cost / √(hp×atk) 与现有兵种对照。
 * ============================================================ */
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.navigator = { userAgent: 'node' };
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0; global.setInterval = () => 0;
global.localStorage = { getItem: () => null, setItem() {} };
function el() {
  return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return el(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 }; } };
}
global.document = { createElement: el, querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), addEventListener() {}, readyState: 'complete' };
require('E:/Deepseekdb/js/bundle-core.js');
require('E:/Deepseekdb/js/bundle-war.js');
require('E:/Deepseekdb/js/bundle-ui.js');
const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'p', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };

function fight(mine, foe) {
  const env = T.begin(JSON.parse(JSON.stringify(mine)), null, JSON.parse(JSON.stringify(foe)), 0, null, { stances: {} });
  env.runAll();
  const r = env.finish();
  return { my: 100 * (r.atkLoss || 0) / men(mine), foe: 100 * (r.defLoss || 0) / men(foe), win: r.winner === 'atk' || (r.defLoss || 0) >= men(foe) * 0.999 };
}
/* 二分：找到"打得平"的人数 */
function fairCount(id, foe, lo, hi) {
  var best = null;
  for (var n = lo; n <= hi; n += Math.max(1, Math.round(n * 0.03))) {
    var r = fight({ [id]: n }, foe);
    if (r.win && r.my <= 45) { best = n; break; }
  }
  return best;
}
const budget = 20000000;
const MELEE = { buxingji: 20618 };
const RANGED = { daodanche: 12000 };

console.log('敌方：步行机 20618（造价 2000 万）');
['buxingji','paojiban','zhongjiqiang','guidaopao'].forEach((id) => {
  const n = fairCount(id, MELEE, 500, 40000);
  const c = D.TROOPS[id].cost;
  const cost = (c.grain || 0) + (c.wood || 0) + (c.stone || 0) + (c.iron || 0);
  const k = cost / Math.sqrt(D.TROOPS[id].hp * D.TROOPS[id].atk);
  console.log('  ' + D.TROOPS[id].name.padEnd(6) + ' 达标人数 ' + String(n).padStart(6)
    + ' → 公平价 ' + String(Math.round(budget / n)).padStart(6) + '（现价 ' + cost + '）· k=' + k.toFixed(2));
});

console.log('');
console.log('敌方：自走火炮 12000（造价 2160 万）');
['buxingji','paojiban','zhongjiqiang','guidaopao'].forEach((id) => {
  const n = fairCount(id, RANGED, 100, 40000);
  const c = D.TROOPS[id].cost;
  const cost = (c.grain || 0) + (c.wood || 0) + (c.stone || 0) + (c.iron || 0);
  const k = cost / Math.sqrt(D.TROOPS[id].hp * D.TROOPS[id].atk);
  console.log('  ' + D.TROOPS[id].name.padEnd(6) + ' 临界人数 ' + String(n).padStart(6)
    + ' → 公平价 ' + String(Math.round(21600000 / n)).padStart(6) + '（现价 ' + cost + '）· k=' + k.toFixed(2));
});
console.log('');
console.log('k = cost / √(hp×atk)：现有兵种 步行机 ' + (970 / Math.sqrt(1800 * 150)).toFixed(2)
  + ' · 自走火炮 ' + (1800 / Math.sqrt(1920 * 220)).toFixed(2)
  + ' · 主战 ' + (10890 / Math.sqrt(8400 * 700)).toFixed(2)
  + ' · 东风 ' + (32200 / Math.sqrt(6600 * 950)).toFixed(2));
