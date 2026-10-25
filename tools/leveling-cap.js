/* 玩家培养路径 v2：把「出征上限」和「兵种可得性」都算进去（只读）
   约束：出征容量 = 练兵场等级 × 1 万人头（marchCapOf）
   问：给定 将级 + 练兵场等级，能 5% 低损打穿到几级野地？
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
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: 'path2', cityName: '灰岗', mapSeed: 20261016 });

function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const W = {};
for (let lv = 1; lv <= 10; lv++) {
  let g = null;
  for (let x = 200; x < 300; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) { g = w; break; } }
  W[lv] = g || G.wildDefenseAt(ciOf(200, 300), lv);
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
function fight(a, gen, w) {
  const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', lossPct: 100 * r.atkLoss / Math.max(1, menOf(a)), rounds: r.rounds, r };
}
/* 在容量上限内，能否 5% 低损打赢（二分找最小人头） */
function minMen(gen, w, shares, capMen) {
  const probe = m => { const f = fight(army(shares, m), gen, w); return f.win && f.lossPct <= 5; };
  if (!probe(capMen)) return null;
  let lo = 100, hi = capMen;
  if (probe(lo)) return lo;
  for (let i = 0; i < 12; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) hi = m; else lo = m; }
  return hi;
}

const TROOPS_NOTE = { '步行机': 'buxingji', '主战机甲': 'zhuzhan' };
const COMPS = { '步行机': { buxingji: 1 }, '主战': { zhuzhan: 1 }, '主战+炮': { zhuzhan: 0.7, huopao: 0.3 } };

console.log('=== ④ 给定「将级 × 练兵场」，5% 低损能打到几级野地（主战编成）===');
console.log('  将级 \\ 练兵场    Lv2(2万) Lv3(3万) Lv4(4万) Lv5(5万) Lv7(7万) Lv10(10万)');
for (const L of [12, 24, 36, 48, 60, 90, 120, 180, 240]) {
  const gen = playerGen(L, 'tian');
  const cells = [];
  for (const xc of [2, 3, 4, 5, 7, 10]) {
    const cap = xc * 10000;
    let best = 0;
    for (let lv = 1; lv <= 10; lv++) if (minMen(gen, W[lv], COMPS['主战'], cap) != null) best = lv;
    cells.push(('Lv' + best).padStart(9));
  }
  console.log('  ' + String(L).padEnd(14) + cells.join(''));
}

console.log('\n=== ⑤ 开局（只有步行机）能打到几级 ===');
console.log('  将级 \\ 练兵场    Lv2(2万) Lv3(3万) Lv5(5万) Lv10(10万)');
for (const L of [12, 24, 36, 60, 90, 120]) {
  const gen = playerGen(L, 'tian');
  const cells = [];
  for (const xc of [2, 3, 5, 10]) {
    const cap = xc * 10000;
    let best = 0;
    for (let lv = 1; lv <= 10; lv++) if (minMen(gen, W[lv], COMPS['步行机'], cap) != null) best = lv;
    cells.push(('Lv' + best).padStart(9));
  }
  console.log('  ' + String(L).padEnd(14) + cells.join(''));
}
