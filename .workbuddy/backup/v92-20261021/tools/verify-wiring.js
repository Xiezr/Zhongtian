/* 真实链路对账：battle.resolveTarget 交给战斗的守军/守将，是否与探针取的一致 */
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
G.newGame({ name: '预热', cityName: '灰岗', mapSeed: 20261016 });
const st = G.newGame({ name: 'wire', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
console.log('坐标        等级  真实链路守军  探针守军  守将一致  人数和一致');
let okAll = true;
for (const [x, y] of [[180, 300], [200, 310], [220, 290], [240, 305]]) {
  const ci = ciOf(x, y);
  const t = G.battle.resolveTarget({ kind: 'wild', ci: ci });
  if (!t || !t.ok) { console.log('  (' + x + ',' + y + ') 解析失败'); okAll = false; continue; }
  const w = G.wildDefenseAt(ci, t.lv);
  const sameArmy = JSON.stringify(t.garrison) === JSON.stringify(w.army);
  const sameGen = (t.guard && w.gen) ? (t.guard === w.gen || (t.guard.level === w.gen.level && t.guard.rank === w.gen.rank)) : (t.guard === w.gen);
  if (!sameArmy || !sameGen) okAll = false;
  console.log('  (' + x + ',' + y + ')' + String(t.lv).padStart(5) + String(men(t.garrison)).padStart(12) +
    String(w.total).padStart(10) + (sameGen ? '    ✅' : '    ❌') + (sameArmy ? '        ✅' : '        ❌'));
}
console.log(okAll ? '\n结论：游戏真正交给战斗的守军/守将，与探针取的是同一份数据。' : '\n结论：存在不一致，探针口径需重查。');
