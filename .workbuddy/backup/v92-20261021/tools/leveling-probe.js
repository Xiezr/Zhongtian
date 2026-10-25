/* 玩家将领培养路径实测（只读）
   问题：什么时候能在「较少损伤」下打赢野地、赚够经验升将？
   口径：
     · 攻损 ≤ 5% 记为"低损"（≤10% 记"可接受"）
     · 攻方只用玩家可得兵种，按人口配比；将领等级/资质可调
     · 经验 = battleExp(歼敌资源) × 等级差衰减，单场封顶 0.8 级
     · 兵力换算：出征容量 = 练兵场等级 × 1 万人口 → 反推需要多少级练兵场
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
const st = G.newGame({ name: '练级', cityName: '灰岗', mapSeed: 20261016 });

function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function wildAt(lv) {
  /* 优先取"有守将"的那块（v91.88 后 7 级起基本都有将） */
  for (let x = 200; x < 300; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) return w; }
  return G.wildDefenseAt(ciOf(200, 300), lv);
}
function playerGen(lv, rankId) {
  const g = G.makeGeneral('主将', Math.min(lv, (D.GEN_RANK_BY_ID[rankId] || {}).lvCap || 240), 'idle', null, true, rankId, 'balance');
  G.rankOf(g); G.guardFillOf(g);
  return g;
}
const COMPS = {
  '纯主战': { zhuzhan: 1 },
  '主战70+炮30': { zhuzhan: 0.7, huopao: 0.3 },
  '坦40+炮60': { taitan: 0.4, huopao: 0.6 },
};
function army(shares, men) {
  const out = {}; let pop = 0;
  for (const id in shares) pop += shares[id] / D.TROOPS[id].pop;
  for (const id in shares) out[id] = Math.max(1, Math.round(men * (shares[id] / D.TROOPS[id].pop) / pop));
  return out;
}
function menOf(a) { let n = 0; for (const k in a) n += a[k]; return n; }

function fight(a, gen, w) {
  const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
  const start = menOf(a);
  return { win: r.winner === 'atk', lossPct: 100 * r.atkLoss / Math.max(1, start), rounds: r.rounds, r };
}
/* 最小人头：打赢且攻损 ≤ lim */
function minMen(gen, w, shares, lim) {
  const probe = m => { const f = fight(army(shares, m), gen, w); return f.win && f.lossPct <= lim; };
  let lo = 200, hi = 400000;
  if (!probe(hi)) return null;
  for (let i = 0; i < 14; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) hi = m; else lo = m; }
  return hi;
}

console.log('=== ① 每个野地等级：以 ≤5% 攻损取胜，最少要多少人（天启体将）===');
console.log('  野地  守军     守将Lv  纯主战       主战70+炮30   坦40+炮60    练兵场');
const rows = [];
for (let lv = 1; lv <= 10; lv++) {
  const w = wildAt(lv);
  const glv = w.gen ? w.gen.level : 0;
  const cells = [];
  let best = null;
  for (const name in COMPS) {
    const gen = playerGen(Math.max(30, glv), 'tian');   /* 将级对齐守将级（公平基准） */
    const m = minMen(gen, w, COMPS[name], 5);
    cells.push(m == null ? '—' : (m / 10000).toFixed(2) + '万');
    if (m != null && (best == null || m < best.men)) best = { name, men: m };
  }
  const xc = best ? Math.ceil(best.men / 10000) : null;
  rows.push({ lv, w, glv, best });
  console.log('  Lv' + String(lv).padEnd(4) + String(w.total).padStart(6) + String(glv).padStart(8) + '  ' +
    cells.map(c => c.padStart(12)).join('') + '  ' + (xc ? 'Lv' + xc : '—'));
}

console.log('\n=== ② 一场能拿多少经验（最优编成 · 将级=守将级）===');
console.log('  野地  歼敌资源   原始经验  衰减  实得经验  占本级(%)  需几场升 1 级');
for (const row of rows) {
  const lv = row.lv, w = row.w;
  if (!row.best) { console.log('  Lv' + lv + ' 打不动'); continue; }
  const gen = playerGen(Math.max(30, row.glv), 'tian');
  const f = fight(army(COMPS[row.best.name], row.best.men * 1.15), gen, w);
  const e = G.battle.battleExp(f.r.defLossBy, gen);
  const pen = G.battle.expPenaltyOf(gen.level, lv);
  const gain = Math.round(e.gain * pen.mul);
  const need = G.expNeedOf(gen);
  console.log('  Lv' + String(lv).padEnd(4) + String(e.value).padStart(9) + String(e.raw).padStart(9) +
    ('×' + pen.mul.toFixed(2)).padStart(7) + String(gain).padStart(10) +
    (100 * gain / need).toFixed(0).padStart(9) + '%' + (gain > 0 ? (need / gain).toFixed(1) : '—').padStart(11));
}
