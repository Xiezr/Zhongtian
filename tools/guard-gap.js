/* 玩家将 vs 野外/名城守将：属性与战力落差（只读，不改引擎）
   ① 同等级下四维/体力/攻防/加成的逐项对照
   ② 把守将换成同等级玩家将，攻方能打赢的守军人口会掉多少（= 守将弱了多少倍）
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
G.newGame({ name: 'guard', cityName: '灰岗', mapSeed: 20261016 });

/* ---------- 三个对象：玩家将 / 野外守将(折损) / 名城守将(不折) ---------- */
function playerGen(lv, rankId) {
  const g = G.makeGeneral('玩家将', lv, 'idle', null, true, rankId || 'tian', 'balance');
  /* 玩家将的攻防按 rankOf 的补发口径成型（与 makeGeneral 后的实际状态一致） */
  G.rankOf(g);
  G.guardFillOf(g);   /* 玩家将也走同一把尺（自由点按特性投放后的等价形态） */
  return g;
}
function wildGen(lv) {
  const g = G.makeGeneral('野地守将', lv, 'guard', null, false, 'ying', 'balance');
  G.guardFillOf(g, D.GUARD_FOLD);
  g.wild = true;
  return g;
}
function cityGen(lv) {
  const g = G.makeGeneral('名城守将', lv, 'guard', null, false, 'tian', 'balance');
  G.guardFillOf(g);   /* 不传 fold = 满量 */
  g.npcGuard = true;
  return g;
}
function snap(g) {
  const a = G.genAttrs(g);
  return {
    lv: g.level, tong: g.tong, yw: g.yw, zm: g.zm, nz: g.nz,
    atk: g.attack, def: g.defense,
    sta: Math.round(a.sta), staMax: Math.round(a.staMax),
    atkPct: +(a.atkPct * 100).toFixed(1), defPct: +(a.defPct * 100).toFixed(1),
    cover: a.tong * 100,
    hp: +((1 + (G.staHpBonus ? G.staHpBonus(g) : 0))).toFixed(3),
  };
}
const LVS = [60, 100, 120, 180, 240];
console.log('=== ① 逐项对照（玩家=天启体满量 / 野地=进化体折半 / 名城=天启体满量）===');
for (const lv of LVS) {
  const P = snap(playerGen(lv)), W = snap(wildGen(lv)), C = snap(cityGen(lv));
  console.log('\n  —— Lv' + lv + ' ——');
  console.log('    ' + '项'.padEnd(10) + '玩家将'.padStart(10) + '野地守将'.padStart(10) + '名城守将'.padStart(10));
  const rows = [['指挥 tong', 'tong'], ['武力 yw', 'yw'], ['谋略 zm', 'zm'], ['内政 nz', 'nz'],
  ['攻击 attack', 'atk'], ['防御 defense', 'def'], ['体力 sta', 'sta'], ['攻击加成%', 'atkPct'], ['防御加成%', 'defPct'], ['指挥覆盖', 'cover'], ['血量倍率', 'hp']];
  for (const [label, k] of rows) {
    console.log('    ' + label.padEnd(10) + String(P[k]).padStart(10) + String(W[k]).padStart(10) + String(C[k]).padStart(10));
  }
}

/* ---------- ② 战力落差 ---------- */
console.log('\n\n=== ② 战力落差：攻方固定(10万人口·纯主战·玩家将)，只换守将 ===');
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
function capacity(defGen, defArmyShares) {
  const probe = n => {
    const def = {};
    for (const id in defArmyShares) def[id] = Math.max(1, Math.round(defArmyShares[id] * n / D.TROOPS[id].pop));
    const r = G.tactic.simulate(ATK, playerGen(240), def, 0, defGen, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 5000, hi = 4000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo;
}
const SHARES = { zhuzhan: 1 };
for (const lv of [60, 120, 180]) {
  const noG = capacity(null, SHARES) / 10000;
  const wG = capacity(wildGen(lv), SHARES) / 10000;
  const pG = capacity(playerGen(lv), SHARES) / 10000;
  const cG = capacity(cityGen(lv), SHARES) / 10000;
  console.log('  守将 Lv' + String(lv).padEnd(4)
    + ' 无将 ' + noG.toFixed(1).padStart(6)
    + ' | 野地守将 ' + wG.toFixed(1).padStart(6) + '（' + (noG / wG).toFixed(2) + '×）'
    + ' | 玩家将 ' + pG.toFixed(1).padStart(6) + '（' + (noG / pG).toFixed(2) + '×）'
    + ' | 名城守将 ' + cG.toFixed(1).padStart(6) + '（' + (noG / cG).toFixed(2) + '×）');
}
console.log('  （数字＝攻方能打赢的守军人口；括号＝相对"无将"让攻方少打多少倍 → 越大＝守将越强）');
