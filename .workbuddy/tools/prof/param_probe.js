#!/usr/bin/env node
/* ============================================================
 * param_probe.js —— **调参接线探针**（v157.29 · 调参自检第 1 轮）
 * ------------------------------------------------------------
 * 回答一个问题：**我调的这个数，到底有没有接线？**
 *
 * 三种判据，互补：
 *   ① 源码引用：这个字段名在 js/（除 data.js）里出现过吗？
 *      0 次 → 死字段（写了没人读，调它一定没效果）。
 *   ② 出口变异：把这个数值改 2 倍，游戏自己的计算出口结果变不变？
 *      不变 → 没接线（或只被界面/文案消费）。
 *   ③ 可达性：数组型数值表的下标超过 `maxLevel` 吗？
 *      超了 → 那一档**永远升不到**，改它等于改注释。
 *
 * 为什么不用 Proxy 追踪读路径：多个模块在加载时就把 `GAME.DATA` 存进局部
 * （`var D = GAME.DATA`），Proxy 只包住入口、包不住旧引用 → 会漏报成"没人读"。
 * 变异法测的是**结果**，不受影响。
 *
 * 用法：
 *   node .workbuddy/tools/prof/param_probe.js              # 文本报告
 *   node .workbuddy/tools/prof/param_probe.js --json       # 机器可读
 *   node .workbuddy/tools/prof/param_probe.js --fail-on-dead  # 有死字段/不可达就退 1
 * 退出码：0 正常 / 1 有问题（仅 --fail-on-dead）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const JS = path.join(ROOT, 'js');
const JSON_OUT = process.argv.includes('--json');
const FAIL_ON_DEAD = process.argv.includes('--fail-on-dead');

/* ---- 沙箱：按加载顺序跑源码 ----
   顺序要点：data 必须在 rules 之前（rules.js 加载时就抓住 GAME.DATA）；
   `import './core.js'` 是 ESM 语法，vm 里必须剥掉 —— 不剥就是 SyntaxError，
   经济/阶梯两把尺子就是这么坏掉的（v157.29 修复）。 */
const sb = { console: console, document: undefined, location: undefined };
sb.window = sb;
vm.createContext(sb);
['core', 'data', 'rules', 'state', 'systems', 'domain', 'map', 'story', 'portraits']
  .forEach(function (f) {
    const src = fs.readFileSync(path.join(JS, f + '.js'), 'utf8').replace(/^\s*import\s+[^\n]*$/gm, '');
    vm.runInContext(src, sb, { filename: f + '.js' });
  });
const G = sb.GAME, D = G.DATA;
if (!G.newGame) { console.error('✗ 模块加载失败'); process.exit(2); }

/* ---- 固定场景：1 城 · 官府 6 · 民居 ×4（与 econ 审计同构，保证可比） ---- */
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });
const s = G.state;
const city = s.cities[0];
const GF = [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3];
city.cells.forEach(function (c) { c.build = null; c.pending = null; c.official = false; });
GF.forEach(function (i) { city.cells[i].build = { id: 'guanfu', lvl: 6 }; city.cells[i].official = true; });
let placed = 0;
for (let i = 0; i < city.cells.length && placed < 4; i++) {
  if (!city.cells[i].official && !city.cells[i].build) {
    city.cells[i].build = { id: 'minfang', lvl: 6 };
    placed++;
  }
}
s.hearts = 100;

const r2 = function (v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v * 1000) / 1000 : String(v); };

/* ---- 出口快照：只放"玩家算得到的账"，不放 UI/文案 ---- */
const OUTLETS = [];
function outlet(name, fn) { OUTLETS.push({ name: name, fn: fn }); }
outlet('maxPopOf', function () { return G.maxPopOf(city); });
outlet('cityProdPerSec', function () {
  const p = G.cityProdPerSec(city), o = {};
  Object.keys(p).sort().forEach(function (k) { o[k] = r2(p[k]); });
  return o;
});
outlet('cityDailyYield', function () {
  const y = G.cityDailyYield(city), o = {};
  Object.keys(y).sort().forEach(function (k) { o[k] = r2(y[k]); });
  return o;
});
outlet('troopPower×17', function () {
  const o = {};
  Object.keys(D.TROOPS).forEach(function (id) { o[id] = r2(G.rules.troopPower(id)); });
  return o;
});
outlet('combatMod', function () { return G.rules.combatMod(); });
outlet('prodMult', function () { return { grain: r2(G.rules.prodMult('grain')), wood: r2(G.rules.prodMult('wood')) }; });
outlet('levelCost', function () {
  const o = {};
  Object.keys(D.BUILDINGS).forEach(function (id) {
    const b = D.BUILDINGS[id], arr = [];
    for (let lv = 1; lv <= 3; lv++) {
      try { arr.push(r2(b.levelCost ? b.levelCost(lv) : null)); } catch (e) { arr.push('E'); }
    }
    o[id] = arr.join('/');
  });
  return o;
});

function snapshot() {
  const o = {};
  OUTLETS.forEach(function (x) {
    try { o[x.name] = x.fn(); } catch (e) { o[x.name] = 'ERR:' + e.message; }
  });
  return JSON.stringify(o);
}

/* ---- 叶子枚举 ----
   · kind='scalar'：对象的直接数字字段
   · kind='array' ：数组元素，**字段名取数组名**（pop / cap / speed / costLadder），
                    否则只能拿到下标、refs 永远是 0（第一版就把这三张表误判成死字段）
   · idkey=true   ：在 unlock.* / cost.* 这类"按名字索引"的表里，键是数据 id 不是代码字段 */
const TABLES = ['TROOPS', 'BUILDINGS', 'SEASONS', 'WEATHERS', 'POWER', 'POP_CFG', 'GROWTH', 'TROOPLV', 'RANK', 'RANK_BONUS', 'TECH'];
const leaves = [];
function walk(node, pathStr, depth, parentKey, idkey) {
  if (depth > 6 || node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach(function (v, i) {
      if (typeof v === 'number') {
        leaves.push({ path: pathStr + '[' + i + ']', obj: node, key: i, field: parentKey || pathStr, idx: i, kind: 'array', idkey: !!idkey, val: v });
      } else walk(v, pathStr + '[' + i + ']', depth + 1, parentKey, idkey);
    });
    return;
  }
  if (typeof node === 'object') {
    Object.keys(node).forEach(function (k) {
      const v = node[k];
      /* unlock.* / tasks.* 是"按 id 索引"的表：键本身是数据，不是代码里读的字段 */
      const isIdMap = (k === 'unlock' || k === 'tasks' || k === 'tech' || k === 'cost' || k === 'prod');
      if (typeof v === 'number') {
        leaves.push({ path: pathStr + '.' + k, obj: node, key: k, field: k, idx: -1, kind: 'scalar', idkey: !!idkey, val: v });
      } else if (typeof v === 'object') {
        walk(v, pathStr + '.' + k, depth + 1, k, idkey || isIdMap);
      }
    });
  }
}
TABLES.forEach(function (t) { if (D[t]) walk(D[t], t, 0, t, false); });

/* ---- 源码引用计数（js/ 全部，排除 data.js 自己与三个 bundle） ---- */
const srcFiles = fs.readdirSync(JS).filter(function (f) {
  return f.endsWith('.js') && f.indexOf('bundle-') !== 0 && f !== 'data.js';
});
const srcAll = srcFiles.map(function (f) { return fs.readFileSync(path.join(JS, f), 'utf8'); }).join('\n');
const refCache = {};
function refCount(name) {
  if (!name || typeof name !== 'string' || /^\d+$/.test(name)) return 0;
  if (refCache[name] !== undefined) return refCache[name];
  const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
  const m = srcAll.match(re);
  refCache[name] = m ? m.length : 0;
  return refCache[name];
}

/* ---- 逐叶子变异 ---- */
const base = snapshot();
const dead = [], changed = [];
leaves.forEach(function (lf) {
  const old = lf.obj[lf.key];
  const nv = old === 0 ? 1 : old * 2;
  if (nv === old) return;
  let after = null;
  try { lf.obj[lf.key] = nv; after = snapshot(); }
  catch (e) { after = 'ERR'; }
  finally { lf.obj[lf.key] = old; }
  const rec = {
    path: lf.path, table: lf.path.split('.')[0], field: lf.field, kind: lf.kind,
    idx: lf.idx, idkey: lf.idkey, val: old, refs: refCount(lf.field),
  };
  if (after === base) dead.push(rec); else changed.push(rec);
});

/* ---- 分类 ---- */
function capOf(rec) {
  /* 上限用 **MAX_LEVEL_ABS**（45），不是 b.maxLevel（12）：
     旧都/名城能盖到 24~45（data.js 按 ABS 一次性外推），用 12 判会把
     30 多档正常数据误报成"不可达"—— 第一版就是这么误报的。 */
  if (rec.table !== 'BUILDINGS') return null;
  return typeof D.MAX_LEVEL_ABS === 'number' ? D.MAX_LEVEL_ABS : null;
}
const unreachable = [];   /* 数组下标 ≥ MAX_LEVEL_ABS：那一档永远升不到 */
const trueDead = [];      /* 引用 0 次 + 出口无反应 + 不是 id 键 + 不是不可达 */
const idle = [];          /* 出口无反应但有引用（多半只喂界面/别的路径） */
dead.forEach(function (r) {
  const ml = capOf(r);
  if (r.kind === 'array' && ml != null && r.idx >= ml) { unreachable.push(r); return; }
  if (r.idkey) { idle.push(r); return; }
  if (r.refs === 0) trueDead.push(r); else idle.push(r);
});

function group(list, keyFn) {
  const m = {};
  list.forEach(function (r) {
    const k = keyFn(r);
    if (!m[k]) m[k] = { field: k, n: 0, refs: r.refs, maxIdx: r.idx, sample: r.path };
    m[k].n++;
    if (r.idx > m[k].maxIdx) m[k].maxIdx = r.idx;
  });
  return Object.keys(m).map(function (k) { return m[k]; })
    .sort(function (a, b) { return a.refs - b.refs || b.n - a.n; });
}
const gDead = group(trueDead, function (r) { return r.table + '.' + r.field; });
const gUnreach = group(unreachable, function (r) { return r.table + '.' + r.field; });
const gIdle = group(idle, function (r) { return r.table + '.' + r.field; });

const result = {
  tables: TABLES, leaves: leaves.length, outlets: OUTLETS.map(function (x) { return x.name; }),
  changedLeaves: changed.length, deadLeaves: dead.length,
  trueDead: gDead, unreachable: gUnreach, idle: gIdle,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 1));
  process.exit(FAIL_ON_DEAD && (gDead.length || gUnreach.length) ? 1 : 0);
}

const L = [];
L.push('══ 调参接线探针 ══');
L.push('  参数叶子 ' + leaves.length + ' 个（' + TABLES.join(' / ') + '）');
L.push('  出口 ' + OUTLETS.length + ' 个：' + OUTLETS.map(function (x) { return x.name; }).join(' · '));
L.push('  改值后有反应 ' + changed.length + ' 个 · 无反应 ' + dead.length + ' 个');
L.push('');
function block(title, list, cell) {
  if (!list.length) return;
  L.push(title);
  L.push('  ' + '表.字段'.padEnd(38) + '条目  引用  说明');
  list.forEach(function (x) {
    L.push('  ' + x.field.padEnd(38) + String(x.n).padStart(4) + '  ' + String(x.refs).padStart(4) + '  ' + cell(x));
  });
  L.push('');
}
block('  ❌ 死字段（源码零引用 + 出口无反应 —— 调它一定没有效果）', gDead,
  function () { return '删掉或接线，别留着占位'; });
block('  ⚠️ 不可达等级条目（数组下标 ≥ MAX_LEVEL_ABS —— 那一档永远升不到）', gUnreach,
  function (x) {
    return '绝对上限 Lv' + D.MAX_LEVEL_ABS + '，后面 ' + x.n + ' 档是死数据';
  });
/* 这一堆是"出口没覆盖但源码有引用"的字段，数量太多、没有行动价值 ——
   只列最可疑的（引用 ≤ 1 次），其余只报数量。第一版把 700 多条全打出来，
   report 本身就成了噪音，没人会看。 */
const gIdleSuspect = group(idle.filter(function (r) { return !r.idkey && r.refs <= 1; }),
  function (r) { return r.table + '.' + r.field; });
block('  · 存疑：出口无反应且源码只有 ≤1 处引用（人工确认是否真在用）', gIdleSuspect.slice(0, 12),
  function (x) { return x.refs + ' 处引用'; });
if (gIdle.length) L.push('  （另有 ' + Math.max(0, gIdle.length - 12) + ' 个字段有引用但不在这些出口，多数是界面/其它系统在用，不列）');
if (!gDead.length && !gUnreach.length) L.push('  ✅ 没有死字段、没有不可达条目');
L.push('  口径：出口只含"玩家算得到的账"（人口上限/产量/日结/战力/天气修正/建造造价），不含 UI 数字。');
console.log(L.join('\n'));
process.exit(FAIL_ON_DEAD && (gDead.length || gUnreach.length) ? 1 : 0);
