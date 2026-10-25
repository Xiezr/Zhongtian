/* 守将拉平方案对比（只读，不改引擎）
   现状：野地/据点守将 = 进化体(grow 3) × 折损 dim 0.5 / atkDim 0.25
   目标：守将/玩家 落在 0.6~0.8（设计原话是"比玩家英雄稍逊色"），同时量出难度代价
   选项：只调折损 / 折损+资质爬梯（按野地等级给 进化→觉醒→天启）
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
G.newGame({ name: 'guardfix', cityName: '灰岗', mapSeed: 20261016 });

function playerGen(lv) {
  const g = G.makeGeneral('玩家将', lv, 'idle', null, true, 'tian', 'balance');
  G.rankOf(g); G.guardFillOf(g);
  return g;
}
/* rankId + fold 由调用方决定 */
function guardGen(lv, rankId, fold) {
  const g = G.makeGeneral('守将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, fold);
  g.wild = true;
  return g;
}
function attr(g) {
  const a = G.genAttrs(g);
  return { q: g.tong, atk: g.attack, atkPct: a.atkPct, sta: a.sta };
}

const P120 = attr(playerGen(120));
console.log('=== 玩家将 Lv120 基准 ===');
console.log('  四维 ' + P120.q + ' · 攻防 ' + P120.atk + ' · 攻击加成 ' + (P120.atkPct * 100).toFixed(1) + '%');

const FOLDS = {
  '现状 0.5/0.25': { dim: 0.5, staPct: 0.8, atkDim: 0.25 },
  '折损 0.8/0.8': { dim: 0.8, staPct: 0.9, atkDim: 0.8 },
  '折损 1.0/1.0': { dim: 1.0, staPct: 1.0, atkDim: 1.0 },
};
const RANKS = {
  '进化体(现状)': 'ying',
  '觉醒体': 'ming',
  '天启体': 'tian',
};

console.log('\n=== 属性比（守将 ÷ 玩家，同 Lv120）===');
console.log('  ' + '资质 \\ 折损'.padEnd(16) + Object.keys(FOLDS).map(k => k.padStart(14)).join(''));
for (const rk in RANKS) {
  const row = Object.keys(FOLDS).map(fk => {
    const a = attr(guardGen(120, RANKS[rk], FOLDS[fk]));
    return ((a.q / P120.q).toFixed(2) + '×').padStart(14);
  });
  console.log('  ' + rk.padEnd(16) + row.join(''));
}

/* ---- 战力代价：攻方 10 万人口纯主战·玩家将 Lv240，守军用不同守将 ---- */
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
const PG = playerGen(240);
function capacity(gen) {
  const probe = n => {
    const def = { zhuzhan: Math.max(1, Math.round(n / D.TROOPS.zhuzhan.pop)) };
    const r = G.tactic.simulate(ATK, PG, def, 0, gen, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 5000, hi = 4000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo / 10000;
}
const base = capacity(null);
console.log('\n=== 战力代价（攻方 10 万人口·玩家将 Lv240；数字＝能打赢的守军人口）===');
console.log('  无将守军 ............ ' + base.toFixed(1) + '  （基准 1.00×）');
for (const rk in RANKS) for (const fk in FOLDS) {
  const v = capacity(guardGen(120, RANKS[rk], FOLDS[fk]));
  console.log(('  ' + rk + ' · ' + fk).padEnd(34) + v.toFixed(1).padStart(6)
    + '  攻方需求 ×' + (base / v).toFixed(2) + '（相对无将）');
}

/* ---- 若保持"总战力"不变，守军数量要乘多少 ---- */
console.log('\n=== 若要把战力拉回现状（守军数量补偿系数）===');
const cur = capacity(guardGen(120, 'ying', FOLDS['现状 0.5/0.25']));
for (const rk of ['ming', 'tian']) {
  const v = capacity(guardGen(120, rk, FOLDS['折损 0.8/0.8']));
  console.log('  ' + rk + ' + 0.8/0.8 ✔ 守军数量 ×' + (cur / v).toFixed(2) + ' 可把难度拉回现状');
}
