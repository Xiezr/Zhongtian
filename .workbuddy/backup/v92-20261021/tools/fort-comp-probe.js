/* 据点守军数量补偿：comp = C新 / C旧 */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
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
const st = G.newGame({ name: 'fort', cityName: '灰岗', mapSeed: 20261016 });
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
function pg(lv) { const g = G.makeGeneral('玩家将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const PG = pg(240);
function capacity(gen, defMix) {
  const probe = n => {
    const def = {};
    for (const id in defMix) def[id] = Math.max(1, Math.round(defMix[id] * n));
    const r = G.tactic.simulate(ATK, PG, def, 0, gen, { kind: 'fort', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 1000, hi = 6000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo;
}
const MIX = { buxingji: 0.6, dunwei: 0.2, daodanche: 0.2, fujiche: 0.1 };  /* 据点守军构成（Lv4+） */
console.log('  据点lv  守将Lv  资质  旧atkPct  新atkPct     C旧     C新    comp');
const out = [];
for (const lv of [1, 5, 10]) {
  st.settings.guardBalance = false;
  const o = G.makeGeneral('守将', 60 + 10 * (lv - 1), 'guard', null, false, 'ming', 'balance');
  G.guardFillOf(o, D.GUARD_FOLD); o.npcGuard = true;
  const co = capacity(o, MIX);
  st.settings.guardBalance = true;
  const n = G.makeGeneral('守将', 60 + 10 * (lv - 1), 'guard', null, false, 'ming', 'balance');
  G.guardFillOf(n, D.GUARD_FOLD_V2); G.guardBal.applyGear(n, 'fort', lv); n.npcGuard = true;
  const cn = capacity(n, MIX);
  out.push({ lv, comp: +(cn / co).toFixed(3) });
  console.log('  ' + String(lv).padEnd(7) + String(60 + 10 * (lv - 1)).padStart(6) + '  ming' +
    (G.genAttrs(o).atkPct * 100).toFixed(0).padStart(8) + '%' + (G.genAttrs(n).atkPct * 100).toFixed(0).padStart(9) + '%' +
    String(co).padStart(9) + String(cn).padStart(8) + (cn / co).toFixed(3).padStart(7));
  st.settings.guardBalance = false;
}
console.log('\ncomp 表（lv1..10 线性插值）：');
const a = out[0].comp, b = out[1].comp, c = out[2].comp;
for (let lv = 1; lv <= 10; lv++) {
  const v = lv <= 5 ? a + (b - a) * (lv - 1) / 4 : b + (c - b) * (lv - 5) / 5;
  process.stdout.write(lv + ':' + v.toFixed(2) + '  ');
}
console.log('');
