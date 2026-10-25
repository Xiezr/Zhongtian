/* 玩家将领培养：从开局兵到练级轨迹（只读）
   ③ 开局可得兵（步行机/盾卫/自走火炮/伏击车）能不能低损打野？要多少人？
   ④ 练级轨迹：每级挑"能 5% 低损、经验最高"的野地 → 每级几场、累计几场
   ⑤ 成本：每场损失补员要多少训练秒（÷120 = 现实分钟）
*/
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [],
  getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: '路线', cityName: '灰岗', mapSeed: 20261016 });

function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const W = {};
for (let lv = 1; lv <= 10; lv++) {
  let best = null;
  for (let x = 200; x < 300; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) { best = w; break; } }
  W[lv] = best || G.wildDefenseAt(ciOf(200, 300), lv);
}
function playerGen(lv, rankId) {
  const cap = (D.GEN_RANK_BY_ID[rankId] || {}).lvCap || 240;
  const g = G.makeGeneral('主将', Math.min(lv, cap), 'idle', null, true, rankId, 'balance');
  G.rankOf(g); G.guardFillOf(g);
  return g;
}
function army(shares, men) {
  const out = {}; let pop = 0;
  for (const id in shares) pop += shares[id] / D.TROOPS[id].pop;
  for (const id in shares) out[id] = Math.max(1, Math.round(men * (shares[id] / D.TROOPS[id].pop) / pop));
  return out;
}
function menOf(a) { let n = 0; for (const k in a) n += a[k]; return n; }
function trainSec(a) { let s = 0; for (const k in a) s += a[k] * (D.TROOPS[k].time || 0); return s; }
function fight(a, gen, w) {
  const r = G.tactic.simulate(a, gen, w.army, w.gen || null, null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', lossPct: 100 * r.atkLoss / Math.max(1, menOf(a)), rounds: r.rounds, r };
}
function minMen(gen, w, shares, lim) {
  const probe = m => { const f = fight(army(shares, m), gen, w); return f.win && f.lossPct <= lim; };
  let lo = 100, hi = 200000;
  if (!probe(hi)) return null;
  if (probe(lo)) return lo;
  for (let i = 0; i < 14; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) hi = m; else lo = m; }
  return hi;
}

console.log('=== ③ 开局兵能不能低损打野（攻损 ≤5% · 天启体将，将级对齐守将级）===');
const EARLY = {
  '纯步行机': { buxingji: 1 },
  '纯盾卫': { dunwei: 1 },
  '步行机+火炮': { buxingji: 0.6, daodanche: 0.4 },
  '伏击车+火炮': { fujiche: 0.5, daodanche: 0.5 },
};
console.log('  野地  守军   纯步行机    纯盾卫    步行机+火炮  伏击车+火炮');
for (let lv = 1; lv <= 10; lv++) {
  const w = W[lv];
  const gen = playerGen(Math.max(30, w.gen ? w.gen.level : 30), 'tian');
  const cells = [];
  for (const name in EARLY) {
    const m = minMen(gen, w, EARLY[name], 5);
    cells.push((m == null ? '打不动' : (m / 10000).toFixed(2) + '万').padStart(11));
  }
  console.log('  Lv' + String(lv).padEnd(4) + String(w.total).padStart(5) + cells.join(''));
}

console.log('\n=== ④ 练级轨迹（主战编成 · 每级挑"低损且经验最高"的野地）===');
const BEST = { zhuzhan: 1 };
let totalFights = 0, totalTrainSec = 0, totalMen = 0;
const marks = [];
console.log('  将级   最优野地  每场经验  占本级  需场次   累计场次  累计补员(人)  累计训练(现实分)');
for (let L = 12; L <= 240; L += 6) {
  const gen = playerGen(L, 'tian');
  const need = G.expNeedOf(gen);
  let best = null;
  for (let lv = 1; lv <= 10; lv++) {
    const w = W[lv];
    const m = minMen(gen, w, BEST, 5);
    if (m == null) continue;
    const a = army(BEST, m * 1.1);
    const f = fight(a, gen, w);
    if (!f.win) continue;
    const e = G.battle.battleExp(f.r.defLossBy, gen);
    const pen = G.battle.expPenaltyOf(L, lv);
    const gain = Math.round(e.gain * pen.mul);
    const per = gain / need;                       /* 每场占本级比例 */
    if (gain > 0 && (best == null || per > best.per)) best = { lv, gain, per, m, lossPct: f.lossPct };
  }
  if (!best) { console.log('  Lv' + L + ' 无可行野地'); continue; }
  const fights = Math.ceil(1 / best.per);
  /* 每场损失 = 兵力 × 攻损% → 补员训练秒 */
  const lossMen = Math.round(best.m * 1.1 * best.lossPct / 100);
  const secPerFight = lossMen * (D.TROOPS.zhuzhan.time || 150);
  totalFights += fights; totalTrainSec += secPerFight * fights; totalMen += lossMen * fights;
  if (L % 30 === 0 || L === 12) marks.push({ L, lv: best.lv, gain: best.gain, per: best.per, fights, totalFights, totalMen, min: totalTrainSec / 120 / 60 });
  console.log('  ' + String(L).padEnd(5) + String('Lv' + best.lv).padEnd(9) + String(best.gain).padStart(8) +
    (100 * best.per).toFixed(0).padStart(7) + '%' + String(fights).padStart(7) + String(totalFights).padStart(10) +
    String(totalMen).padStart(13) + (totalTrainSec / 120 / 60).toFixed(1).padStart(16));
}
console.log('\n  关键节点：');
marks.forEach(m => console.log('   到 Lv' + String(m.L).padEnd(4) + ' 打 Lv' + m.lv + ' 野地 · 每场 ' + m.gain + ' 经验（' +
  (100 * m.per).toFixed(0) + '%）· 该级需 ' + m.fights + ' 场 · 累计 ' + m.totalFights + ' 场 · 累计补员 ' +
  (m.totalMen / 10000).toFixed(1) + ' 万人 · 累计训练 ' + m.min.toFixed(0) + ' 分钟'));
