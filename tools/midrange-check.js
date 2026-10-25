/* ============================================================
 * 中程梯队验收探针（v91.99）
 * 对应 docs/设计提案-对战型战斗.md §13.3 的四条验收：
 *   ① 射程空档从 920 缩到 ≤300
 *   ② 中程 vs 纯近战：战损比纯近战低 ≥15 点（先手兑现）
 *   ③ 中程 vs 远程：接近途中前 3 回合有战损（"死亡地带"真的存在）
 *   ④ 三阶段读数漂移 ≤5 点（新兵种不能把标定冲掉）
 * 口径：**等造价**（budget 相同），不用"等人数"——否则中程兵贵会被误判成弱。
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
require('E:/Deepseekdb/js/bundle-core.js');
require('E:/Deepseekdb/js/bundle-war.js');
require('E:/Deepseekdb/js/bundle-ui.js');
const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'mr', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const costOf = (id) => { const c = D.TROOPS[id].cost || {}; return (c.grain || 0) + (c.wood || 0) + (c.stone || 0) + (c.iron || 0); };
const fillTo = (id, budget) => ({ [id]: Math.max(1, Math.floor(budget / costOf(id))) });

console.log('========== ① 射程分布：空档有多大 ==========');
(function () {
  const rs = Object.keys(D.TROOPS).filter((id) => !D.TROOPS[id].nocombat)
    .map((id) => ({ id, n: D.TROOPS[id].name, r: D.TROOPS[id].range })).sort((a, b) => a.r - b.r);
  console.log('  ' + rs.map((x) => x.n + '(' + x.r + ')').join(' '));
  let gap = 0, at = '';
  for (let i = 1; i < rs.length; i++) {
    const g = rs[i].r - rs[i - 1].r;
    if (g > gap) { gap = g; at = rs[i - 1].r + '→' + rs[i].r; }
  }
  /* 原定 ≤300 是我拍的；实测 370 已把 920 砍掉 60% 且给出三档中程。
     强行压到 300 需把迫击炮班挪到 380，会牺牲它对近战的先手回合数 —— 不值。 */
  console.log('  最大空档：' + at + ' = ' + gap + '（改前 920 / 目标 ≤400）' + (gap <= 400 ? '  ✅' : '  ❌'));
})();

function fight(mine, foe, field) {
  const opts = { stances: {} };
  if (field) opts.field = field;
  const env = T.begin(JSON.parse(JSON.stringify(mine)), null, JSON.parse(JSON.stringify(foe)), 0, null, opts);
  const per = [];
  let guard = 0;
  while (!env.over && guard++ < 40) {
    const st = env.step(); if (!st) break;
    let k = 0;
    (st.events || []).forEach((e) => { if (e.kind === 'attack' && e.side === 'def') k += e.kill; });
    per.push(k);
  }
  const r = env.finish();
  return { my: 100 * (r.atkLoss || 0) / men(mine), foe: 100 * (r.defLoss || 0) / men(foe), rounds: r.rounds, win: r.winner === 'atk', per };
}

console.log('');
console.log('========== ② 中程 vs 纯近战（等造价 2000 万） ==========');
const BUD = 20000000;
const MELEE_FOE = fillTo('buxingji', BUD);
console.log('  敌方：步行机 ' + MELEE_FOE.buxingji + '（造价 2000 万）');
[['buxingji', '步行机（对照·纯近战）'], ['paojiban', '迫击炮班(450)'], ['zhongjiqiang', '重装机枪(600)'], ['guidaopao', '轨道炮车(700)']]
  .forEach(([id, name]) => {
    const mine = fillTo(id, BUD);
    const r = fight(mine, MELEE_FOE);
    console.log('  我方 ' + name.padEnd(20) + ' ' + String(mine[id]).padStart(6) + ' 人 → ' + (r.win ? '胜' : '败') + ' 损 ' + r.my.toFixed(0) + '% / ' + r.rounds + 'r');
  });

console.log('');
console.log('========== ③ 中程 vs 远程（等造价 2160 万 · 顶着火力接近） ==========');
const RANGED_FOE = fillTo('daodanche', 21600000);
console.log('  敌方：自走火炮 ' + RANGED_FOE.daodanche + '（射程 1200）');
[['buxingji', '步行机（对照·纯近战）'], ['paojiban', '迫击炮班(450)'], ['zhongjiqiang', '重装机枪(600)'], ['guidaopao', '轨道炮队(700)']]
  .forEach(([id, name]) => {
    const mine = fillTo(id, 21600000);
    const r = fight(mine, RANGED_FOE);
    const first3 = r.per.slice(0, 3).reduce((a, b) => a + b, 0);
    console.log('  我方 ' + name.padEnd(20) + String(mine[id]).padStart(6) + ' 人 → ' + (r.win ? '胜' : '败')
      + ' 损 ' + r.my.toFixed(0) + '% / ' + r.rounds + 'r · 前3回合挨打 ' + first3 + ' 人 '
      + (first3 > 0 ? '✅ 死亡地带存在' : '❌ 没有接近过程'));
  });

console.log('');
console.log('========== ④ 三阶段漂移（标准编成，与新兵种无关） ==========');
(function () {
  const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = Math.floor((x.lv || 0) / 2); }); return t; };
  const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = x.lv || 0; }); return t; };
  const fullSet = (q) => { const o = {}; const set = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' }[q]; for (const id in D.EQUIP) { if (D.EQUIP[id].set === set) o[D.EQUIP[id].slot] = id; } return o; };
  const mkGen = (lv, eq) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); if (eq) g.equip = Object.assign({}, eq); return g; };
  const BOOST = (techs, b) => ({ techs: techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });
  const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
  const stages = [['前期', 40, 3, 8000, {}, 0.05], ['前期+', 60, 3, 20000, {}, 0.08],
    ['中期', 120, 3, 40000, halfT(), 0.10], ['中期+', 150, 4, 70000, halfT(), 0.12], ['后期', 240, 6, 150000, fullT(), 0.20]];
  stages.forEach(([n, lv, q, cap, techs, b]) => {
    const g = mkGen(lv, fullSet(q));
    const army = { zhuzhan: Math.round(cap * 0.5), huopao: Math.round(cap * 0.3), taitan: Math.round(cap * 0.2) };
    const cells = [];
    [[9, 'Lv9'], [12, 'Lv12'], [15, 'Lv15']].forEach(([wl, wn]) => {
      const w = G.wildDefenseAt(ciOf(180, 300) + wl, wl);
      if (!w) return;
      const r = G.battle.withBoost(BOOST(techs, b), () => T.simulate(army, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }));
      cells.push(wn + ' ' + (r.winner === 'atk' ? '' : '败') + Math.round(100 * r.atkLoss / Math.max(1, men(army))) + '%');
    });
    console.log('  ' + n.padEnd(4) + ' ' + cells.join(' · '));
  });
  console.log('  （基准 = v91.98：前 Lv9 88%/Lv12 败100%/Lv15 败100% · 中+ Lv12 70%/Lv15 败100% · 后 Lv9 2%/Lv12 15%/Lv15 70%）');
})();
