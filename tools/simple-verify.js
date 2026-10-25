/* v91.90 验收：守军表直接人数 → 所需兵力 / 经验 / 掠夺 / 补员 */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: 'simple', cityName: '灰岗', mapSeed: 20261016 });
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function wild(lv) { for (let x = 180; x < 320; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) return w; } return G.wildDefenseAt(ciOf(180, 300), lv); }
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
function fight(n, w) { const r = G.tactic.simulate({ zhuzhan: n }, GEN, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }); return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, n), r }; }
function minMen(w) {
  const probe = n => { const f = fight(n, w); return f.win && f.loss <= 5; };
  if (!probe(100000)) return null;
  let lo = 50, hi = 100000;
  if (probe(lo)) return lo;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) >> 1; if (probe(m)) hi = m; else lo = m; }
  return hi;
}
console.log(' 野地  守军    需要主战  攻损   经验      掠夺(万)  补员(万)   净(万)');
let prev = 0, mono = true;
for (let lv = 3; lv <= 15; lv++) {
  const w = wild(lv), m = minMen(w);
  if (m == null) { console.log('  Lv' + lv + ' 打不动'); continue; }
  if (m < prev) mono = false;
  prev = m;
  const per = fight(m, w);
  const e = G.battle.battleExp(per.r.defLossBy, GEN);
  const loot = G.battle.genLoot({ kind: 'wild', type: 'wild', lv }, 1.2);
  const lootSum = loot.grain + loot.wood + loot.stone + loot.iron;
  const cost = m * per.loss / 100 * D.TROOPS.zhuzhan.cost.grain * 0 + m * per.loss / 100 *
    (D.TROOPS.zhuzhan.cost.grain + D.TROOPS.zhuzhan.cost.wood + D.TROOPS.zhuzhan.cost.stone + D.TROOPS.zhuzhan.cost.iron);
  console.log('  Lv' + String(lv).padEnd(3) + String(w.total).padStart(7) + String(m).padStart(10) +
    (per.loss.toFixed(1) + '%').padStart(7) + String(e.gain).padStart(9) +
    (lootSum / 1e4).toFixed(0).padStart(10) + (cost / 1e4).toFixed(0).padStart(9) +
    ((lootSum - cost) / 1e4).toFixed(0).padStart(9));
}
console.log('\n单调（需要兵力逐级递增）：' + (mono ? '✅' : '❌'));
