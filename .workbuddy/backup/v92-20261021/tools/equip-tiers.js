/* 各品质"全套"攻/防合计（22 槽各取该品质最高）—— 用来给守将定等效装备档 */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'eqt', cityName: '灰岗', mapSeed: 20261016 });
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
const byQ = {};
for (const e of EQ) {
  const q = qOf(e); if (!q) continue;
  const s = byQ[q] = byQ[q] || { atk: {}, def: {} };
  s.atk[e.slot] = Math.max(s.atk[e.slot] || 0, e.atk || 0);
  s.def[e.slot] = Math.max(s.def[e.slot] || 0, e.def || 0);
}
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
console.log('品质  件数   全套 atk   全套 def   → 玩家 atkPct / defPct（仅装备）');
for (const q of Object.keys(byQ).sort((a, b) => a - b)) {
  const cnt = EQ.filter(e => qOf(e) == q).length;
  const A = sum(byQ[q].atk), Dd = sum(byQ[q].def);
  console.log('  q' + q + String(cnt).padStart(6) + String(A).padStart(11) + String(Dd).padStart(11) +
    '   +' + (A / 10).toFixed(0) + '% / +' + (Dd / 10).toFixed(0) + '%');
}
console.log('\n当前守将等效装备表（DATA.GUARD_GEAR）:');
console.log('  atk = ' + JSON.stringify(D.GUARD_GEAR.atk));
console.log('  def = ' + JSON.stringify(D.GUARD_GEAR.def));
console.log('  mul = ' + D.GUARD_GEAR.mul);
console.log('→ 守将 Lv15 拿到 atk ' + Math.round(D.GUARD_GEAR.atk[15] * D.GUARD_GEAR.mul) +
  ' / def ' + Math.round(D.GUARD_GEAR.def[15] * D.GUARD_GEAR.mul) + '，而玩家 q6 全套是 atk ' +
  sum(byQ[6].atk) + ' / def ' + sum(byQ[6].def));
