/* ============================================================
 * tools/eval-audit.js  「评估方式」独立评测
 * ------------------------------------------------------------
 * 把游戏里各处"评估/评分"拿出来，用**真实战斗结果**对照，
 * 判断哪些是真预测、哪些只能排序、哪些是自嗨指标。
 *
 * 评测对象
 *   ① 战力评估 GAME.power.armyOf / genOf（战力面板、自动探索都用它）
 *   ② 装备评分 GAME.systems.equipScore（"一键最优"的判据）
 *   ③ 目标评分 GAME.strat.scoreTarget（AI 选靶：击杀3.0/伤害2.0/威胁1.2/挡路0.8）
 *
 * 方法（每条都要求"能证伪"）
 *   ① N 场真实战斗：比 powerA/powerD 的胜负预测 vs 实测；power 比与战损做 Spearman。
 *   ② 同槽位"评分最高件 vs 评分最低件"各打同一场：高分件若打不过低分件 → 评分误导。
 *      ⚠️ 必须先证明"评分差"与"实战差"的量级关系，否则只能说明排序对、尺度骗人。
 *   ③ 先证明 plan 注入真的生效（动作对照：守住 vs 前进），再比"指定目标"的 9 种选择；
 *      最后看 scoreTarget 的排序是否命中实测最优。
 *   ④ 同一支军队只换将领加点方向：genOf.power 的排名 vs 实测战损排名。
 *
 * 用法：node tools/eval-audit.js > tools/eval-audit.log 2>&1
 * ============================================================ */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require(path.join(__dirname, '..', 'js', 'bundle.js'));
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'ev', cityName: '灰岗', mapSeed: 20261016 });

const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };
const ciOf = (x, y) => { const c = G.sphere && G.sphere.ciOfXY ? G.sphere.ciOfXY(x, y) : -1; return c >= 0 ? c : -(Math.abs(x * 100003 + y * 31) % 2000000000 + 1); };
const TILES = [[180, 300], [200, 310], [220, 290], [240, 305], [260, 295]];
const tiles = lv => TILES.map(([x, y]) => G.wildDefenseAt(ciOf(x, y), lv)).filter(w => w && w.army);
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const SET_BY_Q = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' };
function fullSet(q) { const o = {}; for (const id in D.EQUIP) { const e = D.EQUIP[id]; if (e.set === SET_BY_Q[q]) o[e.slot] = id; } return o; }
function mkGen(lv, eq) { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); if (eq) g.equip = Object.assign({}, eq); return g; }
const BOOST = b => ({ techs: b.techs || {}, world: {}, buffs: {}, atkMult: 1 + (b.atk || 0), siegeMult: 1, cityDefMult: 1, defAdd: b.def || 0 });
function sim(a, gen, w, b) {
  return G.battle.withBoost(BOOST(b), () => {
    const r = G.tactic.simulate(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 });
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
  });
}
function runPlan(a, gen, w, b, makePlan) {
  return G.battle.withBoost(BOOST(b), () => {
    const env = G.tactic.begin(a, gen, w.army, 0, w.gen || null, { kind: 'wild', pid: 1, plan: makePlan });
    env.runAll();
    const r = env.finish();
    return { win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(a)), rounds: r.rounds };
  });
}
function rank(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(arr.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function spearman(x, y) {
  const rx = rank(x), ry = rank(y), n = x.length;
  let d2 = 0; for (let i = 0; i < n; i++) d2 += (rx[i] - ry[i]) ** 2;
  return 1 - 6 * d2 / (n * (n * n - 1));
}

/* ---------------- ① 战力评估 ---------------- */
console.log('========== ① 战力评估：能不能预测胜负 ==========');
console.log('  场景            我方战力    守方战力   战力比   实测      战损   判定');
const STAGES = [
  { n: '前期', lv: 40, q: 3, techs: {}, b: { atk: 0.05, def: 0.05 }, armies: [8000, 15000] },
  { n: '中期', lv: 120, q: 3, techs: halfT(), b: { atk: 0.10, def: 0.10 }, armies: [40000, 70000] },
  { n: '后期', lv: 240, q: 6, techs: fullT(), b: { atk: 0.20, def: 0.20 }, armies: [150000] },
];
const rows = [];
STAGES.forEach(s => {
  const g = mkGen(s.lv, fullSet(s.q));
  s.armies.forEach(cap => {
    const army = { zhuzhan: Math.round(cap * .5), huopao: Math.round(cap * .3), taitan: Math.round(cap * .2) };
    [3, 6, 9, 12, 15].forEach(lv => {
      const w = tiles(lv)[0], dg = w.gen || null;
      const pA = G.power.armyOf(army, g).total;
      const pD = G.power.armyOf(w.army, dg).total;
      const r = sim(army, g, w, s);
      const pred = pA > pD;
      rows.push({ ratio: pA / Math.max(1, pD), loss: r.loss, win: r.win, hit: pred === r.win });
      console.log(`  ${(s.n + ' Lv' + lv).padEnd(14)} ${String(pA).padStart(9)} ${String(pD).padStart(10)}` +
        ` ${(pA / Math.max(1, pD)).toFixed(2).padStart(7)}  ${(r.win ? '胜' : '败')}  ${(r.loss.toFixed(0) + '%').padStart(6)}  ${pred === r.win ? '✅' : '❌'}`);
    });
  });
});
const hit = rows.filter(r => r.hit).length / rows.length;
console.log(`\n  胜负命中率 ${(hit * 100).toFixed(0)}%（${rows.filter(r => r.hit).length}/${rows.length}）` +
  ` · 战力比 vs 战损 Spearman ${spearman(rows.map(r => r.ratio), rows.map(r => r.loss)).toFixed(2)}`);

/* ---------------- ② 装备评分 ---------------- */
console.log('\n========== ② 装备评分：高分件是否真的更强 ==========');
console.log('  槽位        高分件（评分）                 低分件（评分）                 战损差(高-低)');
const army2 = { zhuzhan: 30000, huopao: 18000, taitan: 12000 };
const w2 = tiles(12)[0];
const B2 = { techs: halfT(), b: { atk: 0.1, def: 0.1 } };
let better = 0, worse = 0;
['weapon', 'chest', 'head', 'waist', 'foot_l', 'neck', 'mount'].forEach(slot => {
  const cands = Object.keys(D.EQUIP).map(id => ({ id, e: D.EQUIP[id] }))
    .filter(x => x.e.slot === slot && !x.e.ling && (x.e.q || 0) <= 5)
    .map(x => ({ id: x.id, e: x.e, sc: G.systems.equipScore(x.e) }))
    .sort((a, b) => b.sc - a.sc);
  if (cands.length < 2) return;
  const best = cands[0], worst = cands[cands.length - 1];
  const gA = mkGen(120, Object.assign({}, fullSet(3), { [slot]: best.id }));
  const gB = mkGen(120, Object.assign({}, fullSet(3), { [slot]: worst.id }));
  const rA = sim(army2, gA, w2, B2), rB = sim(army2, gB, w2, B2);
  const d = rA.loss - rB.loss;
  if (d < 0) better++; else if (d > 0) worse++;
  console.log(`  ${slot.padEnd(10)} ${(best.e.name + '(' + best.sc.toFixed(0) + ')').padEnd(30)} ` +
    `${(worst.e.name + '(' + worst.sc.toFixed(0) + ')').padEnd(30)} ${(d > 0 ? '+' : '') + d.toFixed(1)}${d <= 0 ? ' ✅' : ' ⚠'}`);
});
console.log(`  → 高分件更优 ${better}/${better + worse} 次`);

/* ---------------- ③ 选靶评分 ---------------- */
console.log('\n========== ③ 选靶评分：AI 选的是不是最优 ==========');
const gA3 = mkGen(150, fullSet(4));
const army3 = { zhuzhan: 45000, huopao: 27000, taitan: 18000 };
const w3 = tiles(12)[0];
const B3 = { techs: halfT(), b: { atk: 0.1, def: 0.1 } };
const UIDS = Object.keys(army3);
function planAll(cfg) {                       /* cfg: { stance?, target? } */
  return () => {
    const m = {};
    UIDS.forEach(k => { m[k] = {}; if (cfg.stance) m[k].s = cfg.stance; if (cfg.target) m[k].t = cfg.target; });
    return { atk: m };
  };
}
/* 3a 先证 plan 生效：全场"守住"vs"前进" */
const rAdv = runPlan(army3, gA3, w3, B3, planAll({ stance: 'advance' }));
const rHold = runPlan(army3, gA3, w3, B3, planAll({ stance: 'hold' }));
console.log(`  3a plan 是否生效：前进 损 ${rAdv.loss.toFixed(1)}% / ${rAdv.rounds}r · 守住 损 ${rHold.loss.toFixed(1)}% / ${rHold.rounds}r` +
  ` → ${Math.abs(rAdv.loss - rHold.loss) > 0.5 || rAdv.rounds !== rHold.rounds ? '生效 ✅' : '未生效 ❌（后面的选靶对比无意义）'}`);
/* 3b 指定目标 */
const res = Object.keys(w3.army || {}).map(id => ({ id, name: (D.TROOPS[id] || {}).name || id, ...runPlan(army3, gA3, w3, B3, planAll({ stance: 'advance', target: id })) }));
res.sort((a, b) => a.loss - b.loss);
res.forEach((x, i) => console.log(`  ${i === 0 ? '★最优' : '     '} 先打 ${x.name.padEnd(8)} → ${x.win ? '胜' : '败'} 损 ${x.loss.toFixed(1)}% / ${x.rounds}r`));
console.log(`  → 最好/最差目标战损差 ${(res[res.length - 1].loss - res[0].loss).toFixed(1)} 个百分点`);
/* 3c AI 评分排序 */
const env0 = G.tactic.begin(army3, gA3, w3.army, 0, w3.gen || null, { kind: 'wild', pid: 1 });
const su = env0.snap();
const myU = (su.atk || [])[0], foes = (su.def || []).slice();
if (myU && G.strat && G.strat.scoreTarget) {
  const ranked = foes.map(f => ({ name: f.name, sc: G.strat.scoreTarget(myU, f, foes, { side: 'atk', field: su.field }) })).sort((a, b) => b.sc - a.sc);
  console.log('  AI 评分排序：' + ranked.map(x => x.name + '(' + x.sc.toFixed(2) + ')').join(' > '));
  console.log('  → AI 首选「' + ranked[0].name + '」· 实测最优「' + res[0].name + '」' + (ranked[0].name === res[0].name ? ' ✅ 一致' : ' ❌ 不一致'));
}

/* ---------------- ④ 将领战力排名 ---------------- */
console.log('\n========== ④ 将领战力：排名是否可信 ==========');
const army4 = { zhuzhan: 45000, huopao: 27000, taitan: 18000 };
const w4 = tiles(12)[0];
const rows4 = [];
[{ n: '全投武力', k: 'yw' }, { n: '全投谋略', k: 'zm' }, { n: '全投指挥', k: 'tong' }, { n: '全投治理', k: 'nz' }].forEach(b => {
  const g = mkGen(150, fullSet(4));
  g[b.k] = (g[b.k] || 0) + 9000;
  const pw = G.power.genOf(g, army4).power;
  const r = sim(army4, g, w4, B3);
  const A = G.genAttrs(g);
  rows4.push({ n: b.n, pw, loss: r.loss, win: r.win, dr: G.coverOf(A.tong, 1, 1).dr, atk: A.atkPct });
});
rows4.forEach(x => console.log(`  ${x.n.padEnd(8)} 战力 ${String(Math.round(x.pw)).padStart(12)} · 全军攻 +${Math.round(x.atk * 100)}% · 减伤 ${(x.dr * 100).toFixed(1)}% · 实测 ${x.win ? '胜' : '败'} 损 ${x.loss.toFixed(1)}%`));
console.log('  → 战力排名：' + rows4.slice().sort((a, b) => b.pw - a.pw).map(x => x.n).join(' > '));
console.log('  → 实测排名：' + rows4.slice().sort((a, b) => a.loss - b.loss).map(x => x.n).join(' > '));
console.log('  → genOf.power 与战损 Spearman ' + spearman(rows4.map(x => x.pw), rows4.map(x => -x.loss)).toFixed(2));
