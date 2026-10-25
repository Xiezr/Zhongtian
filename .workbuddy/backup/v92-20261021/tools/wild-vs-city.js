/* 后期玩家军 vs 野地守军：同一把尺量"野地是否偏弱"
   玩家口径：出征上限（练兵场 Lv10 = 10 万人头）+ 城防专精/节钺加成后的实际上限
*/
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
const st = G.newGame({ name: 'wvc', cityName: '灰岗', mapSeed: 20261016 });
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
function wild(lv) { for (let x = 180; x < 320; x++) { const w = G.wildDefenseAt(ciOf(x, 300), lv); if (w && w.gen) return w; } return G.wildDefenseAt(ciOf(180, 300), lv); }
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
function fight(a, gen, w) {
  const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
}
/* 按人头分配编成 */
function split(total, shares) { const o = {}; for (const id in shares) o[id] = Math.round(total * shares[id]); return o; }

const GEN = pg(240);
console.log('出征上限：练兵场 Lv10 = ' + G.battle.MARCH_MEN_PER_LV * 10 +
  ' 人；野地驻军上限 Lv15 = ' + (15 * 10000) + '（×前哨 1.8 = ' + (15 * 10000 * 1.8) + '）');
console.log('');
console.log('=== 10 万顶配玩家军 打 野地 Lv13-15（攻损越低 = 野地越弱）===');
const COMPS = [
  ['纯主战', { zhuzhan: 1 }],
  ['主战50+东风30+泰坦20', { zhuzhan: .5, huopao: .3, taitan: .2 }],
  ['东风50+泰坦50', { huopao: .5, taitan: .5 }],
  ['泰坦40+东风60', { taitan: .4, huopao: .6 }],
];
for (const [name, sh] of COMPS) {
  const line = [];
  for (const lv of [13, 14, 15]) {
    const w = wild(lv);
    const f = fight(split(100000, sh), GEN, w);
    line.push('Lv' + lv + ':' + (f.win ? '胜' : '败') + ' ' + f.loss.toFixed(1) + '%/' + f.rounds + 'r');
  }
  console.log('  ' + name.padEnd(22) + line.join('   '));
}
console.log('');
console.log('=== 守军要多少人才能让 10 万玩家军损失 25% / 50%？ ===');
for (const lv of [13, 14, 15]) {
  const base = wild(lv);
  const cnt = men(base.army);
  function scale(k) {
    const a = {}; for (const id in base.army) a[id] = Math.max(1, Math.round(base.army[id] * k));
    return a;
  }
  function lossAt(k) {
    const a = scale(k);
    const r = G.tactic.simulate(split(100000, { zhuzhan: .5, huopao: .3, taitan: .2 }), GEN, a, base.gen || null, null, { kind: 'wild', pid: 1 });
    return { loss: 100 * r.atkLoss / 100000, win: r.winner === 'atk' };
  }
  let lo = 0.2, hi = 30;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (lossAt(m).loss < 25) lo = m; else hi = m; }
  const k25 = (lo + hi) / 2;
  lo = k25; hi = 30;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (lossAt(m).loss < 50) lo = m; else hi = m; }
  const k50 = (lo + hi) / 2;
  console.log('  Lv' + lv + ' 现守军 ' + cnt + ' → 25% 损需 ×' + k25.toFixed(2) + '（' + Math.round(cnt * k25) + '）' +
    ' · 50% 损需 ×' + k50.toFixed(2) + '（' + Math.round(cnt * k50) + '）');
}
console.log('');
console.log('=== 顶级将 vs 普通将（Lv120）在同一场 Lv15 的差别 ===');
for (const L of [120, 180, 240]) {
  const g = pg(L);
  const f = fight(split(100000, { zhuzhan: .5, huopao: .3, taitan: .2 }), g, wild(15));
  console.log('  将 Lv' + String(L).padEnd(4) + (f.win ? '胜' : '败') + ' 攻损 ' + f.loss.toFixed(1) + '%');
}
