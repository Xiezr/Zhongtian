/* 守将套餐：逐档算「属性比」与「守军数量补偿系数」（只读）
   档位 = 野地等级；守将等级 = 30 + 10×(lv−1)（DATA.WILD_GUARD_LV，未含 ±jit）
   旧：资质统一 进化体 + 折损 0.5/0.25
   新：资质随等级爬梯 + 折损 0.8/0.8
   补偿：守军数量 ×(新容量 / 旧容量)，让"总战力"与现状持平
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
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'pkg', cityName: '灰岗', mapSeed: 20261016 });

const OLD_FOLD = { dim: 0.5, staPct: 0.8, atkDim: 0.25 };
const NEW_FOLD = { dim: 0.8, staPct: 0.9, atkDim: 0.8 };
const LADDER = ['ying', 'ying', 'ying', 'ming', 'ming', 'ming', 'ming', 'tian', 'tian', 'tian'];  /* lv1..lv10 */

function gunit(lv, rankId, fold) {
  const g = G.makeGeneral('守将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, fold);
  g.wild = true;
  return g;
}
function playerGen(lv) {
  const g = G.makeGeneral('玩家将', lv, 'idle', null, true, 'tian', 'balance');
  G.rankOf(g); G.guardFillOf(g);
  return g;
}
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
const PG = playerGen(240);

function capacity(gen) {
  const probe = n => {
    const def = { zhuzhan: Math.max(1, Math.round(n / D.TROOPS.zhuzhan.pop)) };
    const r = G.tactic.simulate(ATK, PG, def, 0, gen, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 3000, hi = 4000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo / 10000;
}

console.log('=== 逐档：属性比 / 战力 / 补偿系数 ===');
console.log('  野地  守将Lv  旧资质  新资质  旧属性比  新属性比   旧容量  新容量  守军补偿');
for (const wl of [1, 3, 5, 7, 10]) {
  const glv = 30 + 10 * (wl - 1);
  const P = G.genAttrs(playerGen(glv)).tong;
  const go = gunit(glv, 'ying', OLD_FOLD), gn = gunit(glv, LADDER[wl - 1], NEW_FOLD);
  const ro = G.genAttrs(go).tong / P, rn = G.genAttrs(gn).tong / P;
  const co = capacity(go), cn = capacity(gn);
  console.log('  Lv' + String(wl).padEnd(4) + String(glv).padStart(6) + '  ' + '进化体'.padEnd(6)
    + (LADDER[wl - 1] === 'ying' ? '进化体' : LADDER[wl - 1] === 'ming' ? '觉醒体' : '天启体').padEnd(8)
    + ro.toFixed(2).padStart(8) + rn.toFixed(2).padStart(9)
    + co.toFixed(1).padStart(8) + cn.toFixed(1).padStart(8)
    + ('×' + (cn / co).toFixed(2)).padStart(11));
}
