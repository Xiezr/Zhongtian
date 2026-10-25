/* 最终标定：按真实装备档，逐档反解守军人数 × k */
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
G.newGame({ name: 'cr', cityName: '灰岗', mapSeed: 20261016 });
const men = a => { let n = 0; for (const k in a) n += a[k]; return n; };
const EQ = Object.values(D.EQUIP || {});
const qOf = e => e.q || e.quality || 0;
function setOf(qMax) { const by = {}; for (const e of EQ) { if (qOf(e) > qMax) continue; const v = (e.atk || 0) * 0.5 + (e.def || 0); if (!by[e.slot] || v > by[e.slot].v) by[e.slot] = { v, e }; } const o = {}; for (const s in by) o[s] = by[s].e.id; return o; }
function mkGen(lv, rank, set) { const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance'); G.rankOf(g); G.guardFillOf(g); if (set) g.equip = Object.assign({}, set); return g; }
function ciOf(x, y) { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); }
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const S = {
  e1: { lv: 12, rk: 'ying', set: null, cap: 30000, techs: null, b: [0, 0, 0] },
  e2: { lv: 40, rk: 'ying', set: setOf(2), cap: 40000, techs: null, b: [0, 0, 0] },
  m1: { lv: 96, rk: 'ming', set: setOf(3), cap: 80000, techs: halfT(), b: [0.05, 0.05, 0] },
  m2: { lv: 150, rk: 'tian', set: setOf(4), cap: 120000, techs: halfT(), b: [0.1, 0.1, 0.05] },
  l1: { lv: 240, rk: 'tian', set: setOf(6), cap: 150000, techs: fullT(), b: [0.2, 0.2, 0.15] },
};
const STAGE_OF = lv => lv <= 3 ? S.e1 : lv <= 6 ? S.e2 : lv <= 9 ? S.m1 : lv <= 12 ? S.m2 : S.l1;
const TARGET = lv => lv <= 3 ? 8 : lv <= 6 ? 10 : lv <= 9 ? 22 : lv <= 12 ? 28 : 45;
function run(lv, k) {
  const base = G.wildDefenseAt(ciOf(180, 300), lv), s = STAGE_OF(lv);
  const army = {}; for (const id in base.army) army[id] = Math.max(1, Math.round(base.army[id] * k));
  const a = { zhuzhan: Math.round(s.cap * .5), huopao: Math.round(s.cap * .3), taitan: Math.round(s.cap * .2) };
  const g = mkGen(s.lv, s.rk, s.set);
  const boost = { techs: s.techs || {}, world: {}, buffs: s.b[2] ? { military: { atk: s.b[2], cap: 0 } } : {}, atkMult: 1 + s.b[0], siegeMult: 1, cityDefMult: 1, defAdd: s.b[1] };
  return G.battle.withBoost(boost, function () {
    const r = G.tactic.simulate(a, g, army, 0, base.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), cnt: men(army) };
  });
}
console.log('野地 阶段   目标   k     人数     实测   结果');
const ks = [];
for (let lv = 1; lv <= 15; lv++) {
  const tgt = TARGET(lv);
  let lo = 0.3, hi = 12;
  if (run(lv, lo).loss > tgt) { ks.push(1); console.log('Lv' + lv + ' k=0.3 已超'); continue; }
  if (run(lv, hi).loss < tgt) { ks.push(12); console.log('Lv' + lv + ' k=12 仍不足'); continue; }
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (run(lv, m).loss < tgt) lo = m; else hi = m; }
  const k = (lo + hi) / 2, f = run(lv, k);
  ks.push(+k.toFixed(2));
  console.log('Lv' + String(lv).padEnd(3) + STAGE_OF(lv).rk.padEnd(6) + (tgt + '%').padStart(4) + k.toFixed(2).padStart(6) + String(f.cnt).padStart(8) + f.loss.toFixed(0).padStart(7) + '%  ' + (f.win ? '胜' : '败'));
}
console.log('\nk = ' + JSON.stringify(ks));
