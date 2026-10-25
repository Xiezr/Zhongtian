/* 后期 PvE 目标强度：野地 / 据点 / 名城，统一用"10 万顶配军能损多少"量 */
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
const st = G.newGame({ name: 'late', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
function pg(lv) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); return g; }
const GEN = pg(240);
const ARMY = { zhuzhan: 50000, huopao: 30000, taitan: 20000 };
function run(def, gen, opts) {
  const r = G.tactic.simulate(ARMY, GEN, def, 0, gen || null, opts);
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / men(ARMY), rounds: r.rounds };
}
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }

console.log('=== 目标强度：10 万军（主战5万/东风3万/泰坦2万 · 顶级将）===');
console.log('  目标                 守军数   结果  攻损   回合');
for (const lv of [13, 15]) {
  let w = null;
  for (let x = 180; x < 320; x++) { const t = G.wildDefenseAt(ciOf(x, 300), lv); if (t && t.gen) { w = t; break; } }
  w = w || G.wildDefenseAt(ciOf(180, 300), lv);
  const f = run(w.army, w.gen, { kind: 'wild', pid: 1 });
  console.log('  野地 Lv' + String(lv).padEnd(13) + String(w.total).padStart(8) +
    (f.win ? '   胜  ' : '   败  ') + f.loss.toFixed(1).padStart(6) + '%' + String(f.rounds).padStart(5));
}
for (const lv of [8, 10]) {
  const fort = { level: lv, x: 200 + lv, y: 260, ci: ciOf(200 + lv, 260) };
  const g = G.map.fortGarrison(lv), gd = G.fortGuardOf(fort);
  const f = run(g, gd, { kind: 'fort', sieging: true, wallLv: lv, defName: '据点Lv' + lv });
  console.log('  据点 Lv' + String(lv).padEnd(13) + String(men(g)).padStart(8) +
    (f.win ? '   胜  ' : '   败  ') + f.loss.toFixed(1).padStart(6) + '%' + String(f.rounds).padStart(5));
}
/* 名城：取 map.cities 里等级最高的三类（type 有 city 的） */
const npc = (st.map.cities || []).filter(c => c.garrison && Object.keys(c.garrison).length && c.type !== 'wild');
npc.sort((a, b) => (b.level || 0) - (a.level || 0));
console.log('  名城候选 ' + npc.length + ' 个，最高级 ' + (npc[0] ? npc[0].level : '-'));
for (const c of npc.slice(0, 3)) {
  const gd = G.npcCityGuard(c);
  const def = G.cityDefense ? G.cityDefense(c) : 0;
  const f = run(c.garrison, gd, { kind: 'city', sieging: true, wallLv: G.npcBuildLvOf ? G.npcBuildLvOf(c) : 10, defName: c.name, towers: G.towerCountOf ? G.towerCountOf(c) : null });
  console.log('  ' + (c.name || c.id).padEnd(18) + String(men(c.garrison)).padStart(8) +
    (f.win ? '   胜  ' : '   败  ') + f.loss.toFixed(1).padStart(6) + '%' + String(f.rounds).padStart(5) + '  Lv' + c.level);
}
