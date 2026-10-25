/* 重算守军数量补偿：comp = C_新 / C_旧（同一攻方、同一守军编成） */
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
const st = G.newGame({ name: 'comp', cityName: '灰岗', mapSeed: 20261016 });
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
function playerGen(lv) { const g = G.makeGeneral('玩家将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const PG = playerGen(240);
function capacity(gen) {
  const probe = n => {
    const def = { zhuzhan: Math.max(1, Math.round(n / D.TROOPS.zhuzhan.pop)) };
    const r = G.tactic.simulate(ATK, PG, def, 0, gen, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 1500, hi = 4000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo;
}
function guardOf(lv, on) {
  st.settings.guardBalance = on;
  const g = G.makeGeneral('守将', 30 + 10 * (lv - 1), 'guard', null, false, on ? (D.GUARD_RANK_LADDER[lv - 1] || 'ying') : 'ying', 'balance');
  G.guardFillOf(g, on ? D.GUARD_FOLD_V2 : D.GUARD_FOLD);
  if (on) G.guardBal.applyGear(g, 'wild', lv);
  g.wild = true;
  return g;
}
console.log('守将等级 = 30+10×(lv−1)；comp = C新 / C旧（越强 → comp 越小）');
console.log('  lv  守将Lv  资质   旧atkPct  新atkPct    C旧      C新     comp');
const out = [];
for (const lv of [1,2,3,4,5,6,7,8,9,10]) {
  const o = guardOf(lv, false), n = guardOf(lv, true);
  const co = capacity(o), cn = capacity(n);
  const comp = cn / co;
  out.push({ lv, comp: +comp.toFixed(3) });
  console.log('  ' + String(lv).padEnd(4) + String(30 + 10 * (lv - 1)).padStart(6) + '  ' +
    (o.rank === n.rank ? n.rank : (o.rank + '→' + n.rank)).padEnd(10) +
    (G.genAttrs(o).atkPct * 100).toFixed(0).padStart(7) + '%' +
    (G.genAttrs(n).atkPct * 100).toFixed(0).padStart(8) + '%' +
    String(co).padStart(9) + String(cn).padStart(9) + comp.toFixed(3).padStart(8));
  st.settings.guardBalance = false;
}
