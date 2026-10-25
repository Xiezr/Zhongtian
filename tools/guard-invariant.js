/* 不变式：开关前后"同一场仗"应该打得一样（总战力持平） */
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
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: 'inv', cityName: '灰岗', mapSeed: 20261016 });
function playerGen(lv) { const g = G.makeGeneral('玩家将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const PG = playerGen(240);
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function findWild(lv, wantGen) {
  for (let x = 200; x < 300; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && (wantGen ? !!w.gen : true)) return w; }
  return null;
}
function battle(w) {
  const aN = Object.values(ATK).reduce((a, b) => a + b, 0);
  const dN = Object.values(w.army).reduce((a, b) => a + b, 0);
  const r = G.tactic.simulate(ATK, PG, w.army, w.gen || null, null, { kind: 'wild', pid: 1 });
  return { winner: r.winner, atkLossPct: 100 * r.atkLoss / aN, defLossPct: 100 * r.defLoss / Math.max(1, dN), rounds: r.rounds, n: w.total };
}
console.log('  野地  |  关：守军/胜负/攻损/回合  |  开：守军/胜负/攻损/回合');
for (const lv of [3, 6, 10]) {
  st.settings.guardBalance = false;
  const w0 = findWild(lv, lv >= 6); const b0 = battle(w0);
  st.settings.guardBalance = true;
  const w1 = findWild(lv, lv >= 6); const b1 = battle(w1);
  st.settings.guardBalance = false;
  console.log('  Lv' + String(lv).padEnd(3) +
    ' 将' + (w0.gen?'有':'无') + ' | ' + String(b0.n).padStart(6) + ' ' + b0.winner + ' ' + b0.atkLossPct.toFixed(1) + '% ' + String(b0.rounds).padStart(2) +
    ' | ' + String(b1.n).padStart(6) + ' ' + b1.winner + ' ' + b1.atkLossPct.toFixed(1) + '% ' + String(b1.rounds).padStart(2));
}
