/* ============================================================
 * 接触面验证探针（v91.97）
 * 回答三件事：
 *   ① 接触面打开后，"藏后排"（肉盾前进 / 远程驻守）是否终于成为可行战术？
 *   ② 打开 vs 关闭，六场景的战损/回合怎么变（会不会把三阶段标定冲掉）？
 *   ③ 阵位数 2 vs 3（指挥解锁）差多少
 * 口径：同一编成、同一对手，只改"接触面开关"与"分兵种动作"。
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
G.newGame({ name: 'cs', cityName: '灰岗', mapSeed: 20261020 });
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };

function fight(mine, foe, planFor) {
  const opts = { stances: {} };
  if (planFor) opts.plan = planFor;
  const env = T.begin(JSON.parse(JSON.stringify(mine)), null, JSON.parse(JSON.stringify(foe)), 0, null, opts);
  env.runAll();
  const r = env.finish();
  return { my: 100 * (r.atkLoss || 0) / men(mine), foe: 100 * (r.defLoss || 0) / men(foe), rounds: r.rounds, win: r.winner === 'atk' };
}
const CONST = (mine, s) => { const m = {}; Object.keys(mine).forEach((k) => { m[k] = { s: s }; }); return () => ({ atk: m }); };
/* 藏后排：近战前进、远程驻守 */
const SHIELD = (mine) => () => {
  const m = {};
  Object.keys(mine).forEach((k) => {
    const rg = (D.TROOPS[k] || {}).range || 0;
    m[k] = { s: rg >= 500 ? 'hold' : 'advance' };
  });
  return { atk: m };
};

const CASES = [
  { n: '镜像', mine: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 },
    foe: { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 } },
  { n: '远程vs近战潮', mine: { daodanche: 900, zhuzhan: 300 }, foe: { buxingji: 2600 } },
  { n: '近战vs远程阵', mine: { zhuzhan: 1200, buxingji: 800 }, foe: { daodanche: 900, dunwei: 500 } },
  { n: '混编vs重甲', mine: { zhuzhan: 600, daodanche: 500, wuren: 60 }, foe: { dunwei: 1400, huopao: 30 } },
  { n: '空军vs地面', mine: { wuren: 120, zhuzhan: 400 }, foe: { buxingji: 1500, daodanche: 300 } },
  { n: '偏弱vs强敌', mine: { zhuzhan: 500, daodanche: 400 }, foe: { zhuzhan: 900, daodanche: 700 } },
];

console.log('========== ① 接触面开/关 × 三种动作口径 ==========');
console.log('（每个格子 = 我损% / 回合数；[败] = 没打赢）');
Object.keys(D.CONTACT).length;
[false, true].forEach((tri) => [false, true].forEach((on) => {
  D.STANCE_TRIANGLE_ON = tri; D.CONTACT.on = on;
  console.log('--- 三角 ' + (tri?'开':'关') + ' · 接触面 ' + (on ? '开（阵位 2）' : '关') + ' ---');
  CASES.forEach((c) => {
    const a = fight(c.mine, c.foe, CONST(c.mine, 'advance'));
    const h = fight(c.mine, c.foe, CONST(c.mine, 'hold'));
    const s = fight(c.mine, c.foe, SHIELD(c.mine));
    const f = (x) => (x.win ? '' : '[败]') + x.my.toFixed(0) + '%/' + x.rounds + 'r';
    console.log('  ' + c.n.padEnd(14) + ' 全进 ' + f(a).padStart(12) + '  全守 ' + f(h).padStart(12) + '  藏后排 ' + f(s).padStart(12));
  });
}));

console.log('');
console.log('========== ② 阵位数：2 vs 3（指挥解锁） ==========');
D.CONTACT.on = true;
const c1 = CASES[0];
const two = fight(c1.mine, c1.foe, SHIELD(c1.mine));
const bak = D.CONTACT.slots;
D.CONTACT.slots = 3;
const three = fight(c1.mine, c1.foe, SHIELD(c1.mine));
D.CONTACT.slots = bak;
console.log('  镜像 · 藏后排：2 阵位 我损 ' + two.my.toFixed(0) + '%/' + two.rounds + 'r  ·  3 阵位 我损 ' + three.my.toFixed(0) + '%/' + three.rounds + 'r');

console.log('');
console.log('========== ③ 三阶段（接触面开/关，全默认动作） ==========');
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = Math.floor((x.lv || 0) / 2); }); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = x.lv || 0; }); return t; };
const fullSet = (q) => { const o = {}; const set = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' }[q]; for (const id in D.EQUIP) { if (D.EQUIP[id].set === set) o[D.EQUIP[id].slot] = id; } return o; };
const mkGen = (lv, eq) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); if (eq) g.equip = Object.assign({}, eq); return g; };
const BOOST = (techs, b) => ({ techs: techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });
const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
const stages = [
  ['前期', 40, 3, 8000, {}, 0.05],
  ['前期+', 60, 3, 20000, {}, 0.08],
  ['中期', 120, 3, 40000, halfT(), 0.10],
  ['中期+', 150, 4, 70000, halfT(), 0.12],
  ['后期', 240, 6, 150000, fullT(), 0.20],
];
[false, true].forEach((on) => {
  D.CONTACT.on = on;
  const lines = [];
  stages.forEach(([n, lv, q, cap, techs, b]) => {
    const g = mkGen(lv, fullSet(q));
    const army = { zhuzhan: Math.round(cap * 0.5), huopao: Math.round(cap * 0.3), taitan: Math.round(cap * 0.2) };
    const cells = [];
    [[6, 'Lv6'], [9, 'Lv9'], [12, 'Lv12'], [15, 'Lv15']].forEach(([wl, wn]) => {
      const w = G.wildDefenseAt(ciOf(180, 300) + wl, wl);
      if (!w) return;
      const r = G.battle.withBoost(BOOST(techs, b), () => T.simulate(army, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }));
      cells.push(wn + ' ' + (r.winner === 'atk' ? '' : '败') + Math.round(100 * r.atkLoss / Math.max(1, men(army))) + '%/' + r.rounds + 'r');
    });
    lines.push('  ' + n.padEnd(4) + ' ' + cells.join(' · '));
  });
  console.log('--- 接触面 ' + (on ? '开' : '关') + ' ---');
  lines.forEach((l) => console.log(l));
});
D.CONTACT.on = false;
