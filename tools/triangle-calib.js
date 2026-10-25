/* ============================================================
 * 动作三角标定探针（v91.96）
 * 目的：回答三个问题
 *   ① 移动折损取多少，才**不会**让「推进」在两轴上都优于「驻守」
 *      （不变量：移动减伤 < 驻守减伤 → 0.2 < 0.25）
 *   ② 打开动作三角后，三阶段（前舒适/中均势/后拼命）还成不成立
 *   ③ 那 7 条变红的断言，到底是"预期变化"还是"回归"
 * 用法：node tools/triangle-calib.js > tools/triangle-calib.log
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
G.newGame({ name: 'cal', cityName: '灰岗', mapSeed: 20261020 });

const out = [];
const P = (s) => { out.push(s); console.log(s); };
const men = (a) => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const ciOf = (x, y) => { const v = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return v >= 0 ? v : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = Math.floor((x.lv || 0) / 2); }); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach((x) => { t[x.id] = x.lv || 0; }); return t; };
const fullSet = (q) => { const o = {}; const set = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' }[q]; for (const id in D.EQUIP) { if (D.EQUIP[id].set === set) o[D.EQUIP[id].slot] = id; } return o; };
const mkGen = (lv, eq) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); if (eq) g.equip = Object.assign({}, eq); return g; };
const BOOST = (techs, b) => ({ techs: techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });

/* ---------- ① 动作三角不变量：单轴对照 ---------- */
P('========== ① 三角不变量：同一场仗，只改我方动作 ==========');
P('   判据：不存在一个动作在「受创」和「输出」两轴上都占优');
(function () {
  /* 势均力敌的两臂：我方 2 万主战 + 1 万自走火炮（有远程，站位才有意义）
     敌方 A = 近战主力（步行机 2.5 万）；敌方 B = 远程主力（自走火炮 1.2 万 + 盾卫 1 万） */
  const MY = { zhuzhan: 20000, daodanche: 10000 };
  const FOE = {
    近战敌: { buxingji: 25000 },
    远程敌: { daodanche: 12000, dunwei: 10000 },
  };
  function run(foe, myStance, moveCut) {
    const bak = T.MOVE_TARGET_CUT;
    T.MOVE_TARGET_CUT = moveCut;
    try {
      const plan = () => ({ atk: { zhuzhan: { s: myStance }, daodanche: { s: myStance } } });
      const env = T.begin(JSON.parse(JSON.stringify(MY)), null, JSON.parse(JSON.stringify(foe)), 0, null,
        { kind: 'wild', field: 900, plan: plan });
      env.runAll();
      const r = env.finish();
      return {
        myLoss: 100 * (r.atkLoss || 0) / men(MY),
        foeLoss: 100 * (r.defLoss || 0) / men(foe),
        rounds: r.rounds,
        win: r.winner === 'atk',
      };
    } finally { T.MOVE_TARGET_CUT = bak; }
  }
  Object.keys(FOE).forEach((fn) => {
    [0.4, 0.2].forEach((cut) => {
      const rows = [['advance', '推进'], ['hold', '驻守'], ['retreat', '后退']].map(([s, n]) => ({ n, ...run(FOE[fn], s, cut) }));
      const txt = rows.map((x) => x.n + ' ' + (x.win ? '' : '[败]') + '我损' + x.myLoss.toFixed(0) + '%/敌损' + x.foeLoss.toFixed(0) + '%/' + x.rounds + 'r');
      P('   ' + fn + ' · 折损' + (cut * 100) + '%  ' + txt.join('  |  '));
      /* 支配判定：某动作在"我损更低"和"敌损更高"两轴同时优于另一动作 */
      const dom = [];
      rows.forEach((a) => rows.forEach((b) => {
        if (a !== b && a.myLoss < b.myLoss - 0.5 && a.foeLoss > b.foeLoss + 0.5) dom.push(a.n + '>' + b.n);
      }));
      P('      支配关系：' + (dom.length ? '⚠ ' + dom.join(' , ') : '✅ 无（三动作各有取舍）'));
    });
  });
})();

/* ---------- ② 三阶段：折损 0.4 / 0.2 / 0（=旧口径） ---------- */
P('');
P('========== ② 三阶段：移动折损取值的整体影响 ==========');
P('   前期 Lv40/8千 · 前期+ Lv60/2万 · 中期 Lv120/4万 · 中期+ Lv150/7万 · 后期 Lv240/15万');
(function () {
  const cases = [
    ['前期', 40, 3, 8000, {}, 0.05],
    ['前期+', 60, 3, 20000, {}, 0.08],
    ['中期', 120, 3, 40000, halfT(), 0.10],
    ['中期+', 150, 4, 70000, halfT(), 0.12],
    ['后期', 240, 6, 150000, fullT(), 0.20],
  ];
  [0.4, 0.2, 0].forEach((cut) => {
    const bak = T.MOVE_TARGET_CUT;
    T.MOVE_TARGET_CUT = cut;
    P('   --- 移动折损 ' + (cut * 100) + '% ---');
    try {
      cases.forEach(([n, lv, q, cap, techs, b]) => {
        const g = mkGen(lv, fullSet(q));
        const army = { zhuzhan: Math.round(cap * 0.5), huopao: Math.round(cap * 0.3), taitan: Math.round(cap * 0.2) };
        const line = [];
        [[3, 'Lv3'], [6, 'Lv6'], [9, 'Lv9'], [12, 'Lv12'], [15, 'Lv15']].forEach(([wl, wn]) => {
          const w = G.wildDefenseAt(ciOf(180, 300) + wl, wl);
          if (!w) return;
          const r = G.battle.withBoost(BOOST(techs, b), () => T.simulate(army, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }));
          line.push(wn + ' ' + (r.winner === 'atk' ? '' : '败') + Math.round(100 * r.atkLoss / Math.max(1, men(army))) + '%');
        });
        P('     ' + n.padEnd(4) + ' ' + line.join(' · '));
      });
    } finally { T.MOVE_TARGET_CUT = bak; }
  });
})();
