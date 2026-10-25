/* 重标定野地守军补偿（v91.89：Lv7-15 高阶化 + 上限 15）
   做法：临时把 comp 旁路成 1，测"顶级将带主战，5% 低损需要多少人"，
   再按目标曲线反推 comp（target / measured）。
*/
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: 'c15', cityName: '灰岗', mapSeed: 20261016 });

/* 旁路补偿：只测"真实战力" */
/* 不旁路：用真实 comp */


function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function wild(lv) { for (let x = 180; x < 320; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) return w; } return G.wildDefenseAt(ciOf(180, 300), lv); }
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
function men(a) { let n = 0; for (const k in a) n += a[k]; return n; }
function fight(n, w) { const r = G.tactic.simulate({ zhuzhan: n }, GEN, w.army, w.gen || null, null, { kind: 'wild', pid: 1 }); return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, n), r }; }
function minMen(w) {
  const probe = n => { const f = fight(n, w); return f.win && f.loss <= 5; };
  if (!probe(100000)) return null;
  let lo = 100, hi = 100000;
  if (probe(lo)) return lo;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) >> 1; if (probe(m)) hi = m; else lo = m; }
  return hi;
}
/* 目标曲线：Lv7..15 所需攻方人头（顶级将） */
const TARGET = { 7: 2000, 8: 3000, 9: 4500, 10: 6500, 11: 9000, 12: 13000, 13: 19000, 14: 27000, 15: 38000 };
console.log('  野地  守军     守将Lv  守军战力   真实需要(人头)  目标   comp');
const out = [];
for (let lv = 7; lv <= 15; lv++) {
  const w = wild(lv);
  const m = minMen(w);
  const power = G.battle.armyPowerTotal(w.army);
  const comp = m ? Math.max(0.02, Math.min(1, TARGET[lv] / m)) : null;
  out.push({ lv, comp: comp == null ? null : +comp.toFixed(3) });
  console.log('  Lv' + String(lv).padEnd(3) + String(w.total).padStart(8) + String(w.gen ? w.gen.level : 0).padStart(8) +
    String(power).padStart(10) + String(m == null ? '打不动' : m).padStart(14) + String(TARGET[lv]).padStart(8) +
    (comp == null ? '—' : comp.toFixed(2)).padStart(8));
}
console.log('\ncomp 表（Lv1-6 沿用 v91.88 实测，7-15 本轮）：');
const head = [0.94, 0.92, 0.692, 0.49, 0.376, 0.372];
const tail = out.map(o => o.comp);
console.log(JSON.stringify(head.concat(tail)));
