/* 将领影响力测量（只读，不改引擎）
   目标：把"将领对战斗的影响"换算成可比较的标量
   ① 有将 vs 无将 → 胜负/损兵差
   ② 将领强度刻度（武力/谋略/指挥/装备/体力）→ 依次加大
   ③ 等效兵力：把"无将一方"的兵力乘以 k，直到打平 → k 就是将领值多少兵
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

G.newGame({ name: '将领测', cityName: '灰岗', mapSeed: 20261016 });

function mkGen(o) {
  const g = { id: 'g', name: '测将', level: 1, tong: 0, yw: 0, zm: 0, nz: 0, speed: 0, sta: 100, staMax: 100, equip: {}, attach: [] };
  return Object.assign(g, o);
}
/* 标准将：一个"跟得上进度"的典型值 */
const G_STD = mkGen({ tong: 100, yw: 100, zm: 100, nz: 100, speed: 20, sta: 400, staMax: 400 });
const G_ONE = mkGen({ tong: 10, yw: 10, zm: 10, nz: 10, speed: 0, sta: 100, staMax: 100 });   /* 刚开局 */
const G_TOP = mkGen({ tong: 300, yw: 300, zm: 300, nz: 300, speed: 80, sta: 1200, staMax: 1200 }); /* 满级 */
const G_CHEAT = mkGen({ tong: 900, yw: 900, zm: 900, nz: 900, speed: 200, sta: 3000, staMax: 3000 });

const ATK = { zhuzhan: 4000, dongfeng: 800 };
const DEF = { buxingji: 9000 };

function fight(atkGen, atkArmy, defArmy) {
  const r = G.tactic.simulate(atkArmy, atkGen, defArmy, 0, null, { kind: 'wild', pid: 1 });
  const aStart = Object.values(atkArmy).reduce((a, b) => a + b, 0);
  return {
    winner: r.winner, rounds: r.rounds,
    atkLossPct: 100 * r.atkLoss / Math.max(1, aStart),
    defLossPct: 100 * r.defLoss / Math.max(1, Object.values(defArmy).reduce((a, b) => a + b, 0))
  };
}

console.log('=== ① 有将 / 无将 / 不同强度（攻方 4000 主战 + 800 东风，守方 9000 步行机）===');
for (const [label, g] of [['无将', null], ['新手将 10/10/10', G_ONE], ['常规将 100', G_STD], ['顶配将 300', G_TOP], ['超模 900', G_CHEAT]]) {
  const f = fight(g, ATK, DEF);
  console.log(('  ' + label).padEnd(22), '胜', f.winner, '回合', String(f.rounds).padStart(2), '攻损', f.atkLossPct.toFixed(1) + '%', '守损', f.defLossPct.toFixed(1) + '%');
}

console.log('\n=== ② 指挥覆盖（兵多将少时，覆盖决定加成吃不吃得到）===');
for (const tong of [10, 50, 100, 200]) {
  const g = mkGen({ tong, yw: 100, zm: 100, nz: 100, speed: 20, sta: 400, staMax: 400 });
  const big = { zhuzhan: 30000 };
  const f = fight(g, big, { buxingji: 60000 });
  console.log(('  指挥 ' + tong).padEnd(14), '覆盖上限 ' + (tong * 100) + ' 兵 / 实带 30000', '胜', f.winner, '攻损', f.atkLossPct.toFixed(1) + '%');
}

console.log('\n=== ③ 等效兵力：无将方要加多少兵才能打平有将方 ===');
/* 攻方有将 vs 守方(无将)加兵 —— 守方兵越多越难打；找到"有将方还能赢"的上限 */
function winRate(gen, defN) {
  const f = fight(gen, ATK, { buxingji: defN });
  return f.winner === 'atk';
}
for (const [label, g] of [['无将', null], ['常规将 100', G_STD], ['顶配将 300', G_TOP]]) {
  let lo = 5000, hi = 400000;
  for (let i = 0; i < 22; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (winRate(g, mid)) lo = mid; else hi = mid;
  }
  console.log(('  ' + label).padEnd(16), '最多能打赢的守军 =', lo, '（约 ' + (lo / 9000).toFixed(2) + ' 倍基准）');
}
