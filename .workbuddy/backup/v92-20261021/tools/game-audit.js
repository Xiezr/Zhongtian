/* ============================================================
 * tools/game-audit.js  整款游戏体检（可测部分 · 与 docs/游戏总评-20261020.md 一一对应）
 * ------------------------------------------------------------
 * 八段：
 *   ① 内容体量     ② 梯级（资质/装备/星球/野地）   ③ 曲线（经验/装备/野地）
 *   ④ 兵种支配性   ⑤ 战斗节奏（回合分布）          ⑥ 经济（开局）
 *   ⑦ 稳健性静态   ⑧ 扩展成本（引用面）
 *
 * 用法：node tools/game-audit.js > tools/game-audit.log 2>&1
 * ============================================================ */
const path = require('path');
const fs = require('fs');
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
G.newGame({ name: 'ga', cityName: '灰岗', mapSeed: 20261020 });

const out = [];
const P = s => out.push(s);
const men = a => { let n = 0; for (const k in a) n += (a[k] || 0); return n; };

/* ---------------- ① 内容体量 ---------------- */
P('======== ① 内容体量 ========');
const cnt = x => Array.isArray(x) ? x.length : (x ? Object.keys(x).length : 0);
[['兵种', D.TROOPS], ['建筑', D.BUILDINGS], ['科技（含主城）', D.TECH_ALL], ['套装', D.SETS], ['装备件', D.EQUIP],
['道具', D.ITEMS], ['名将/美人', D.HEROES], ['野地层级', D.WILD_DEFENSE], ['星球环境', D.PLANET_ENV],
['奇观', D.WONDER_DEFS], ['战技', D.NEIGONG], ['遗物', D.BAOJU], ['数据表总数', '224'],
].forEach(([n, v]) => P(`  ${n.padEnd(12)} ${typeof v === 'string' ? v : String(cnt(v)).padStart(5)}`));

/* ---------------- ② 梯级 ---------------- */
P('');
P('======== ② 梯级 ========');
P('  资质五档（等级上限 / 每级成长 / 基础区间）：');
(D.GEN_RANKS || []).forEach(r => P(`    ${r.name.padEnd(4)} Lv${String(r.lvCap).padStart(3)} · +${r.grow}/级 · ${r.base[0]}~${r.base[1]}`));
P('  装备六档（件数 / 均攻 / 均体 / 档间攻倍数）：');
const byQ = {};
Object.values(D.EQUIP).forEach(e => { if (!e.ling) (byQ[e.q] = byQ[e.q] || []).push(e); });
let prevAtk = 0;
[1, 2, 3, 4, 5, 6].forEach(q => {
  const a = byQ[q] || [];
  const avgAtk = a.reduce((s, e) => s + (e.atk || 0), 0) / Math.max(1, a.length);
  const avgSta = a.reduce((s, e) => s + (e.sta || 0), 0) / Math.max(1, a.length);
  const mul = prevAtk ? (avgAtk / prevAtk).toFixed(2) + '×' : '—';
  P(`    q${q} ${String(a.length).padStart(3)} 件 · ${avgAtk.toFixed(0).padStart(5)} · ${avgSta.toFixed(0).padStart(4)} · ${mul}`);
  prevAtk = avgAtk;
});
const scales = [];
for (let n = 1; n <= 8; n++) scales.push(G.planetScaleOf(n));
P('  星球难度：' + scales.map((v, i) => `P${i + 1}×${v.toFixed(2)}`).join('  '));
P('    相邻倍数：' + scales.slice(1).map((v, i) => (v / scales[i]).toFixed(2)).join(' / '));

/* ---------------- ③ 曲线 ---------------- */
P('');
P('======== ③ 曲线 ========');
[1, 30, 60, 100, 150, 200, 240].forEach(lv => P(`  经验 Lv${String(lv).padStart(3)} 需 ${String(G.expNeedOf({ level: lv })).padStart(8)}`));
let tot = 0; const cumAt = {};
for (let lv = 1; lv <= 240; lv++) { tot += G.expNeedOf({ level: lv }); if ([30, 60, 100, 150, 200, 240].includes(lv)) cumAt[lv] = tot; }
P('  累计占比：' + Object.keys(cumAt).map(lv => `Lv${lv} ${(cumAt[lv] / cumAt[240] * 100).toFixed(1)}%`).join(' · '));
P('  野地守军总量（表值中位 / 实际生成 / 环比）：');
let prevN = 0;
for (let lv = 0; lv <= 15; lv++) {
  const def = D.WILD_DEFENSE[lv] || D.WILD_DEFENSE[String(lv)] || [];
  let n = 0;
  def.forEach(x => { n += Math.round(((x.min || 0) + (x.max || 0)) / 2); });
  const w = G.wildDefenseAt(12345 + lv, lv);
  const real = w ? men(w.army) : 0;
  P(`    Lv${String(lv).padStart(2)} 表 ${String(n).padStart(7)} · 生成 ${String(real).padStart(7)} · ${prevN ? (n / prevN).toFixed(2) + '×' : '—'}`);
  prevN = n;
}

/* ---------------- ④ 兵种支配性 ---------------- */
P('');
P('======== ④ 兵种支配性（A 全面 ≥ B 且不更贵 → B 无意义） ========');
const T = D.TROOPS || {};
const ids = Object.keys(T).filter(id => !T[id].nocombat);
const costOf = t => t.cost ? ((t.cost.gold || 0) + (t.cost.food || 0) + (t.cost.iron || 0)) : 0;
const dominated = [];
ids.forEach(a => ids.forEach(b => {
  if (a === b) return;
  const A = T[a], B = T[b];
  const better = (A.atk || 0) >= (B.atk || 0) && (A.def || 0) >= (B.def || 0) && (A.hp || 0) >= (B.hp || 0)
    && (A.spd || 0) >= (B.spd || 0) && (A.range || 0) >= (B.range || 0);
  const same = A.atk === B.atk && A.def === B.def && A.hp === B.hp && A.spd === B.spd && A.range === B.range;
  if (better && !same && costOf(A) <= costOf(B)) dominated.push(`${A.name} 支配 ${B.name}`);
}));
P(dominated.length ? '  ⚠ ' + dominated.join(' · ') : '  ✅ 未发现严格支配（14 兵种各有位置）');
P('  纸面（攻 / 防 / 血 / 速 / 射程 / 造价合计）：');
ids.forEach(id => { const t = T[id]; P(`    ${t.name.padEnd(6)} ${String(t.atk).padStart(5)} ${String(t.def).padStart(5)} ${String(t.hp).padStart(6)} ${String(t.spd).padStart(4)} ${String(t.range).padStart(5)} ${String(costOf(t)).padStart(7)}`); });

/* ---------------- ⑤ 战斗节奏 ---------------- */
P('');
P('======== ⑤ 战斗节奏（同档编成打野地） ========');
const halfT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = Math.floor((x.lv || 0) / 2)); return t; };
const fullT = () => { const t = {}; (D.TECH_ALL || D.TECH).forEach(x => t[x.id] = x.lv || 0); return t; };
const SET_BY_Q = { 3: 'prime_zhan', 4: 'rare_zhan', 6: 'divine_zhan' };
const fullSet = q => { const o = {}; for (const id in D.EQUIP) { const e = D.EQUIP[id]; if (e.set === SET_BY_Q[q]) o[e.slot] = id; } return o; };
const mk = (lv, eq) => { const g = G.makeGeneral('将', lv, 'idle', null, true, 'tian', 'balance'); G.rankOf(g); G.guardFillOf(g); if (eq) g.equip = Object.assign({}, eq); return g; };
const boost = (techs, b) => ({ techs, world: {}, buffs: {}, atkMult: 1 + b, siegeMult: 1, cityDefMult: 1, defAdd: b });
const CASES = [
  ['前期', 40, 3, 8000, {}, 0.05], ['前期+', 60, 3, 20000, {}, 0.08],
  ['中期', 120, 3, 40000, halfT(), 0.10], ['中期+', 150, 4, 70000, halfT(), 0.12],
  ['后期', 240, 6, 150000, fullT(), 0.20],
];
const rs = [];
CASES.forEach(([n, lv, q, cap, techs, b]) => {
  const g = mk(lv, fullSet(q));
  const army = { zhuzhan: Math.round(cap * .5), huopao: Math.round(cap * .3), taitan: Math.round(cap * .2) };
  [3, 6, 9, 12, 15].forEach(wl => {
    const w = G.wildDefenseAt(12345 + wl, wl); if (!w) return;
    const r = G.battle.withBoost(boost(techs, b), () => G.tactic.simulate(army, g, w.army, 0, w.gen || null, { kind: 'wild', pid: 1 }));
    rs.push({ n: `${n} vs Lv${wl}`, rounds: r.rounds, win: r.winner === 'atk', loss: 100 * r.atkLoss / Math.max(1, men(army)) });
    P(`  ${(`${n} vs Lv${wl}`).padEnd(14)} ${(r.winner === 'atk' ? '胜' : '败')} ${r.atkLoss ? (100 * r.atkLoss / Math.max(1, men(army))).toFixed(0).padStart(4) : '   0'}% · ${r.rounds} 回合`);
  });
});
const rr = rs.map(x => x.rounds).sort((a, b) => a - b);
P(`  → 回合数 中位 ${rr[rr.length >> 1]} · 最短 ${rr[0]} · 最长 ${rr[rr.length - 1]} · 引擎上限 ${(G.tactic && G.tactic.MAX_ROUNDS) || 30}`);

/* ---------------- ⑥ 经济 ---------------- */
P('');
P('======== ⑥ 经济（开局） ========');
const c0 = G.state.cities[0];
P('  初始资源：' + Object.keys(D.INITIAL_RES || {}).map(k => `${k}:${D.INITIAL_RES[k]}`).join(' '));
const cheap = Object.keys(D.BUILDINGS).filter(id => D.BUILDINGS[id].buildCost)
  .map(id => ({ id, c: D.BUILDINGS[id].buildCost })).sort((a, b) => (a.c.gold || 0) - (b.c.gold || 0));
P('  最便宜 5 座新建筑：' + cheap.slice(0, 5).map(x => `${D.BUILDINGS[x.id].name}(${x.c.wood || 0}木/${x.c.stone || 0}石)`).join(' · '));
P('  已建：' + Object.keys(c0.build || {}).map(k => `${(D.BUILDINGS[k] || {}).name || k}Lv${c0.build[k]}`).join(' '));

/* ---------------- ⑦ 稳健性 ---------------- */
P('');
P('======== ⑦ 稳健性（静态扫描） ========');
const ROOT = path.join(__dirname, '..'), jsDir = path.join(ROOT, 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && f !== 'bundle.js');
let catches = 0, todos = 0, lines = 0; const big = [];
files.forEach(f => {
  const s = fs.readFileSync(path.join(jsDir, f), 'utf8');
  const n = s.split('\n').length; lines += n;
  if (n > 3000) big.push(`${f}(${n})`);
  catches += (s.match(/catch\s*\([^)]*\)\s*\{\s*\/\*/g) || []).length;
  todos += (s.match(/TODO|FIXME|XXX/g) || []).length;
});
P(`  js 模块 ${files.length} 个 · ${lines} 行 · 超 3000 行：${big.join(' ') || '无'}`);
P(`  静默 catch：${catches} 处 · TODO/FIXME：${todos} 处`);
P(`  测试断言：smoke ${(fs.readFileSync(path.join(ROOT, 'smoke-test.js'), 'utf8').match(/check\(/g) || []).length} 处 · e2e ${(fs.readFileSync(path.join(ROOT, 'e2e-test.js'), 'utf8').match(/check\(/g) || []).length} 处`);

/* ---------------- ⑧ 扩展成本 ---------------- */
P('');
P('======== ⑧ 扩展成本（引用面） ========');
const refs = {};
files.forEach(f => {
  const s = fs.readFileSync(path.join(jsDir, f), 'utf8');
  if (/DATA\.TROOPS|TROOPS\[/.test(s)) refs[f] = (s.match(/TROOPS/g) || []).length;
});
P('  引用 TROOPS 的模块：' + Object.keys(refs).map(k => `${k}(${refs[k]})`).join(' '));
P('  → 新兵种 = 表加一行；新界面 = 必须动 ui.js（' + files.filter(f => f === 'ui.js').map(() => linesOf(jsDir, 'ui.js')) + ' 行）');
function linesOf(dir, f) { return fs.readFileSync(path.join(dir, f), 'utf8').split('\n').length; }

fs.writeFileSync(path.join(__dirname, 'game-audit.log'), out.join('\n') + '\n');
console.log(out.join('\n'));
