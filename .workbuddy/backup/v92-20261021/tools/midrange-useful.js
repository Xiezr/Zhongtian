/* ============================================================
 * 中程兵"到底有没有优势"—— 真实战局对照（v91.99 复盘）
 * ------------------------------------------------------------
 * 老板问：「改完之后怎么样，没看出来优势在哪，实现你的期望了吗」
 * 上一轮我只给了"等造价单挑"的数（中程 vs 纯近战），那是**理想对照**，
 * 不代表玩家真会用它。这里换成**真实战局**三问：
 *   ① 同人数（出征容量受限 · 后期真实约束）：中程编成 vs 老标准编成
 *   ② 同造价（资源受限 · 前期真实约束）：同上
 *   ③ 接触面开/关：它到底帮了谁
 * 对手 = 真实野地守军（Lv6/9/12/15，按阶段给科技与装备）。
 * ============================================================ */
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function el() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; },
    querySelector() { return el(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const _c = {};
global.document = { createElement: el, querySelector: (s) => (_c[s] = _c[s] || el()), querySelectorAll: () => [], getElementById: (id) => (_c['#' + id] = _c['#' + id] || el()), addEventListener() {}, readyState: 'complete' };
require('E:/Deepseekdb/js/bundle.js');
const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'u', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const costOf = (id) => { const c = D.TROOPS[id].cost || {}; return (c.grain || 0) + (c.wood || 0) + (c.stone || 0) + (c.iron || 0); };
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = Math.floor((x.lv || 0) / 2); }); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = x.lv || 0; }); return t; };
const fullSet = (q) => { const o = {}; const set = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' }[q]; for (const id in D.EQUIP) { if (D.EQUIP[id].set === set) o[D.EQUIP[id].slot] = id; } return o; };
const mkGen = (lv, eq) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); if (eq) g.equip = Object.assign({}, eq); return g; };
const BOOST = (techs, b) => ({ techs: techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });
const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };

/* 按比例铺满：ratio = { id: 权重 }，总量 = total（人数）或 budget（造价） */
function build(ratio, total, byCost) {
  const w = {};
  let denom = 0;
  Object.keys(ratio).forEach((id) => { denom += ratio[id]; });
  const army = {};
  Object.keys(ratio).forEach((id) => {
    const v = ratio[id] / denom;
    army[id] = byCost ? Math.floor(total * v / costOf(id)) : Math.floor(total * v);
  });
  Object.keys(army).forEach((k) => { if (army[k] <= 0) delete army[k]; });
  return army;
}
function run(army, gen, wl, techs, b) {
  const w = G.wildDefenseAt(ciOf(180, 300) + wl, wl);
  if (!w) return null;
  const r = G.battle.withBoost(BOOST(techs, b), () => T.simulate(army, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }));
  return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(army)), rounds: r.rounds };
}

const STAGES = [
  { n: '前期', lv: 40, q: 3, men: 8000, techs: {}, b: 0.05, wls: [6, 9] },
  { n: '中期', lv: 120, q: 3, men: 40000, techs: halfT(), b: 0.10, wls: [9, 12] },
  { n: '中期+', lv: 150, q: 4, men: 70000, techs: halfT(), b: 0.12, wls: [12, 15] },
  { n: '后期', lv: 240, q: 6, men: 150000, techs: fullT(), b: 0.20, wls: [12, 15] },
];
const COMPS = [
  { n: '老标准(主战/东风/泰坦)', r: { zhuzhan: 5, huopao: 3, taitan: 2 } },
  { n: '中程A(轨道+东风+主战)', r: { guidaopao: 4, huopao: 3, zhuzhan: 3 } },
  { n: '中程B(迫击炮+重机+东风)', r: { paojiban: 4, zhongjiqiang: 3, huopao: 3 } },
  { n: '中程C(迫击炮+主战+东风)', r: { paojiban: 4, zhuzhan: 3, huopao: 3 } },
];

console.log('========== ① 同人数（出征容量受限）· 真实野地 ==========');
STAGES.forEach((s) => {
  const gen = mkGen(s.lv, fullSet(s.q));
  console.log('-- ' + s.n + '  Lv' + s.lv + ' · ' + s.men + ' 人 --');
  COMPS.forEach((c) => {
    const army = build(c.r, s.men, false);
    const cells = s.wls.map((wl) => {
      const r = run(army, gen, wl, s.techs, s.b);
      return r ? ('Lv' + wl + ' ' + (r.win ? '' : '败') + r.loss.toFixed(0) + '%') : '';
    });
    console.log('   ' + c.n.padEnd(22) + cells.join(' · ').padEnd(24) + ' 人数 ' + men(army));
  });
});

console.log('');
console.log('========== ② 同造价（资源受限）· 真实野地 ==========');
STAGES.forEach((s) => {
  const gen = mkGen(s.lv, fullSet(s.q));
  const budget = s.men * 1500;      /* 以"每兵 1500 资源"为基准预算 */
  console.log('-- ' + s.n + '  预算 ' + (budget / 1e4).toFixed(0) + ' 万 --');
  COMPS.forEach((c) => {
    const army = build(c.r, budget, true);
    const cells = s.wls.map((wl) => {
      const r = run(army, gen, wl, s.techs, s.b);
      return r ? ('Lv' + wl + ' ' + (r.win ? '' : '败') + r.loss.toFixed(0) + '%') : '';
    });
    console.log('   ' + c.n.padEnd(22) + cells.join(' · ').padEnd(24) + ' 人数 ' + men(army));
  });
});

console.log('');
console.log('========== ③ 接触面：开 / 关（老标准编成 · 同人数） ==========');
STAGES.forEach((s) => {
  const gen = mkGen(s.lv, fullSet(s.q));
  const army = build(COMPS[0].r, s.men, false);
  [true, false].forEach((on) => {
    D.CONTACT.on = on;
    const cells = s.wls.map((wl) => {
      const r = run(army, gen, wl, s.techs, s.b);
      return r ? ('Lv' + wl + ' ' + (r.win ? '' : '败') + r.loss.toFixed(0) + '%') : '';
    });
    console.log('   ' + s.n.padEnd(4) + (on ? '接触面开 ' : '接触面关 ') + cells.join(' · '));
  });
  D.CONTACT.on = true;
});
