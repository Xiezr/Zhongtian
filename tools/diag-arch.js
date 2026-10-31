/* ============================================================
 * tools/diag-arch.js — 架构体检（只读，不改任何文件）
 * ------------------------------------------------------------
 * 为什么要有它：老板 2026-10-23 把架构决定权交过来（「拆、重建、分类整理、
 * 架构调整都由你决定」）。**先量再切** —— 没有数据的重构就是制造屎山。
 *
 * 输出四张表：
 *   ① 每模块的体积 / 定义数 / 出度 / 入度（找上帝模块与死模块）
 *   ② 跨包引用（core → war / core → ui / war → ui）—— 分层是否真的守住了
 *   ③ 模块级循环依赖（A 用 B 的 X、B 用 A 的 Y）
 *   ④ 被引用最多的出口（改动风险最高的那几个点）
 *
 * 用法：
 *   node tools/diag-arch.js > .workbuddy/tmp/arch.txt
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS = path.join(ROOT, 'js');

/* ---------- 一、从 build_bundle.py 取三包分组（唯一来源，不另抄一份） ---------- */
const py = fs.readFileSync(path.join(ROOT, '.workbuddy/tools/patch/build_bundle.py'), 'utf8');
const grab = (key) => {
  const m = new RegExp(key + "\\s*=\\s*\\[([\\s\\S]*?)\\]").exec(py);
  if (!m) throw new Error('build_bundle.py 里找不到 ' + key);
  return m[1].match(/'([a-z0-9_]+)'/g).map((s) => s.replace(/'/g, ''));
};
const ORDER = grab('ORDER');
const WAR = grab('WAR');
const UI = grab('UI');
const groupOf = {};
ORDER.forEach((m) => { groupOf[m] = WAR.indexOf(m) >= 0 ? 'war' : (UI.indexOf(m) >= 0 ? 'ui' : 'core'); });

/* ---------- 二、剥注释（注释里的名字不算引用） ---------- */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const src = {}, size = {}, defs = {}, refs = {};
ORDER.forEach((m) => {
  const p = path.join(JS, m + '.js');
  const raw = fs.readFileSync(p, 'utf8');
  const code = strip(raw);
  src[m] = code;
  size[m] = fs.statSync(p).size;

  /* 定义：GAME.xxx = / GAME.xxx.yyy = / GAME.xxx = { ... } —— 只取第一段标识符 */
  const d = new Set();
  const reDef = /GAME\.([A-Za-z_$][\w$]*)\s*=/g;
  let mm;
  while ((mm = reDef.exec(code))) d.add(mm[1]);
  defs[m] = d;

  /* 引用：所有 GAME.xxx（含 GAME.xxx.yyy 的前缀） */
  const r = {};
  const reRef = /GAME\.([A-Za-z_$][\w$]*)/g;
  while ((mm = reRef.exec(code))) r[mm[1]] = (r[mm[1]] || 0) + 1;
  refs[m] = r;
});

/* ---------- 三、出口归属（同名多定义 = 冲突，单独列出） ----------
 * ⚠️ v113 修正：归属只取**按 ORDER 最先定义它的那个模块**（= 加载顺序里的主定义）。
 *   第一版把"任一文件赋过值"都算成归属，于是 `GAME.state` 因为 main.js 里
 *   删档时写了 `GAME.state = null`，被算成"main 定义的槽"——
 *   `domain → main` 于是虚报 **208 处**，其中 204 处其实是 `GAME.state`。
 *   **量具错了，后面的架构判断全跟着错。** */
const owner = {};        /* 出口名 → 主归属模块（第一个定义的）*/
const allOwners = {};    /* 出口名 → [所有定义过它的模块] */
const dup = {};
ORDER.forEach((m) => {
  defs[m].forEach((k) => {
    if (!owner[k]) owner[k] = m;
    (allOwners[k] = allOwners[k] || []).push(m);
  });
});
Object.keys(allOwners).forEach((k) => { if (allOwners[k].length > 1) dup[k] = allOwners[k]; });

/* ---------- 四、跨包引用 ---------- */
const cross = { 'core>war': [], 'core>ui': [], 'war>ui': [] };
ORDER.forEach((m) => {
  Object.keys(refs[m]).forEach((k) => {
    const os = owner[k];
    if (!os) return;                       /* 未定义（可能是内建/拼错），另表列 */
    const targets = (typeof os === 'string' ? [os] : os).filter((x) => x !== m);
    targets.forEach((t) => {
      const a = groupOf[m], b = groupOf[t];
      if (a === b) return;
      const key = a + '>' + b;
      if (cross[key]) cross[key].push({ from: m, to: t, sym: k, n: refs[m][k] });
    });
  });
});

/* ---------- 五、模块级循环依赖 ---------- */
const edges = {};    /* m -> Set(依赖的模块) */
ORDER.forEach((m) => {
  edges[m] = new Set();
  Object.keys(refs[m]).forEach((k) => {
    [].concat(owner[k] || []).forEach((t) => { if (t !== m) edges[m].add(t); });
  });
});
const cycles = [];
const seenC = new Set();
ORDER.forEach((a) => {
  edges[a].forEach((b) => {
    if (!edges[b] || !edges[b].has(a)) return;
    const key = [a, b].sort().join('|');
    if (seenC.has(key)) return;
    seenC.add(key);
    cycles.push([a, b]);
  });
});

/* ---------- 六、入度（谁被最多模块用） ---------- */
const inDeg = {};
ORDER.forEach((m) => edges[m].forEach((t) => { inDeg[t] = (inDeg[t] || 0) + 1; }));
const topUsed = Object.keys(inDeg).sort((a, b) => inDeg[b] - inDeg[a]).slice(0, 15);

/* ---------- 输出 ---------- */
const L = [];
const kb = (n) => Math.round(n / 1024);
L.push('# 架构体检 · ' + new Date().toISOString().slice(0, 10));
L.push('');
L.push('模块 ' + ORDER.length + ' 个 · core ' + ORDER.filter((m) => groupOf[m] === 'core').length
  + ' / war ' + ORDER.filter((m) => groupOf[m] === 'war').length
  + ' / ui ' + ORDER.filter((m) => groupOf[m] === 'ui').length);
L.push('');

L.push('## 一、最大的 15 个模块');
L.push('| 模块 | 包 | KB | 定义数 | 依赖他模块 | 被依赖 |');
L.push('|---|---|---|---|---|---|');
ORDER.slice().sort((a, b) => size[b] - size[a]).slice(0, 15).forEach((m) => {
  L.push('| ' + m + ' | ' + groupOf[m] + ' | ' + kb(size[m]) + ' | ' + defs[m].size
    + ' | ' + edges[m].size + ' | ' + (inDeg[m] || 0) + ' |');
});
L.push('');

L.push('## 二、跨包引用（分层是否真的守住）');
Object.keys(cross).forEach((k) => {
  const list = cross[k];
  if (!list.length) { L.push('- **' + k + '**：0 处 ✅'); return; }
  const agg = {};
  list.forEach((x) => { const kk = x.from + ' → ' + x.to; agg[kk] = (agg[kk] || 0) + x.n; });
  L.push('- **' + k + '**：' + list.length + ' 处（按模块对聚合 ' + Object.keys(agg).length + ' 对）');
  Object.keys(agg).sort((a, b) => agg[b] - agg[a]).forEach((kk) => {
    L.push('  - ' + kk + ' ×' + agg[kk]);
  });
});
L.push('');

L.push('## 三、模块级循环依赖');
if (!cycles.length) L.push('（无）');
else cycles.forEach(([a, b]) => L.push('- ' + a + ' ↔ ' + b));
L.push('');

L.push('## 四、被最多模块依赖的出口（改动风险最高）');
L.push('| 出口槽 | 定义在 | 被几个模块依赖 |');
L.push('|---|---|---|');
topUsed.forEach((m) => {
  const n = ORDER.filter((x) => x !== m && edges[x] && edges[x].has(m)).length;
  L.push('| ' + m + '.js | ' + m + ' | ' + n + ' |');
});
L.push('');

L.push('## 五、同名多定义（可能是一个出口两份实现）');
if (!Object.keys(dup).length) L.push('（无）');
else Object.keys(dup).forEach((k) => L.push('- `GAME.' + k + '` 定义在：' + dup[k].join(' / ')));
L.push('');

/* 未定义就被引用的槽（拼写错误 / 已删残留） */
const undef = {};
ORDER.forEach((m) => {
  Object.keys(refs[m]).forEach((k) => { if (!owner[k]) undef[k] = (undef[k] || 0) + refs[m][k]; });
});
L.push('## 六、被引用但没有 `GAME.xxx =` 定义的槽');
if (!Object.keys(undef).length) L.push('（无）');
else {
  Object.keys(undef).sort((a, b) => undef[b] - undef[a]).slice(0, 20).forEach((k) => {
    L.push('- `GAME.' + k + '` ×' + undef[k] + '（可能是内建对象的方法名，或拼错）');
  });
}

/* ============================================================
 * 七、架构棘轮（ratchet）—— 只许降，不许升
 * ------------------------------------------------------------
 * 为什么不是"一次重构干净"：57 个模块、4000+ 断言、两年迭代，
 * 把 state（249 个出口 / 46 个模块依赖）拆开，失败概率远大于收益。
 *
 * 但腐化必须有个闸。做法是**棘轮**：
 *   · `arch-baseline.json` 记下当前每对跨层引用的次数；
 *   · `--check` 只判"有没有超过基线"—— 超了就是新增了跨层依赖，红；
 *   · 主动还债之后跑 `--write` 把基线压低，**基线从此只会更小**。
 * 这样新代码违规当场拦住，老债按自己的节奏还。
 * ============================================================ */
const BASE = path.join(ROOT, 'arch-baseline.json');
const mode = process.argv[2] || '';

/* v156.14 口径修正（老板「优先采用市场现有成熟方式」）：
 * 旧口径把**同一个符号被调用 N 次**算成 N 处跨层引用 —— 于是 prologue 里多调几次
 * `GAME.ui`/`GAME.main`，棘轮就红（14→44 / 12→30），但那不是分层被捅穿，只是同一根
 * 线用得多。成熟做法（dependency-cruiser 的 **known-violations 基线**）按**边**计数：
 * 一条边 = (来源模块, 目标模块, 越界符号) 的**存在性**，不乘调用次数。
 * 所以：基线单位 = **跨界符号数**（distinct symbol），调用次数只作为参考记录在
 * `_occurrences` 里（不进判据），真要追"用得越来越多"看它，但不当成架构违规。 */
function aggregate() {
  const out = { _occurrences: {} };
  Object.keys(cross).forEach((g) => {
    const syms = {};
    cross[g].forEach((x) => {
      const k = x.from + '>' + x.to;
      if (!syms[k]) syms[k] = {};                 /* 去重集合：符号 → 出现次数 */
      syms[k][x.sym] = (syms[k][x.sym] || 0) + x.n;
    });
    const agg = {};
    Object.keys(syms).forEach((k) => {
      agg[k] = Object.keys(syms[k]).length;       /* 判据单位：跨界符号数 */
      out._occurrences[g + ' ' + k] = Object.keys(syms[k])
        .reduce((a, s) => a + syms[k][s], 0);     /* 参考：调用次数（不进判据） */
    });
    out[g] = agg;
  });
  return out;
}

const groupsOf = (o) => Object.keys(o).filter((g) => g.charAt(0) !== '_');

if (mode === '--write') {
  const cur = aggregate();
  fs.writeFileSync(BASE, JSON.stringify(cur, null, 2) + '\n', 'utf8');
  const n = groupsOf(cur).reduce((a, g) => a + Object.keys(cur[g]).length, 0);
  const occ = Object.keys(cur._occurrences).reduce((a, k) => a + cur._occurrences[k], 0);
  console.log('✅ 已写入基线 arch-baseline.json（' + n + ' 条跨界边 · 参考调用 ' + occ + ' 次）');
  process.exit(0);
}

if (mode === '--json') {
  /* v156.14：机器可读输出（CI/其它脚本要对比基线时用它，别再正则抓人话）。
     只打印、不落盘 —— 需要在沙箱/CI 里重立基线时，把它重定向成 arch-baseline.json。 */
  process.stdout.write(JSON.stringify(aggregate(), null, 2) + '\n');
  process.exit(0);
}

if (mode === '--check') {
  if (!fs.existsSync(BASE)) {
    console.log('❌ 缺 arch-baseline.json（先跑 node tools/diag-arch.js --write）');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const cur = aggregate();
  const over = [];
  groupsOf(cur).forEach((g) => {
    Object.keys(cur[g]).forEach((k) => {
      const was = (base[g] || {})[k] || 0;
      if (cur[g][k] > was) over.push(g + ' ' + k + ' 跨界符号 ' + was + ' → ' + cur[g][k]);
    });
  });
  const total = groupsOf(cur).reduce((a, g) => a + Object.keys(cur[g]).length, 0);
  const occ = Object.keys(cur._occurrences).reduce((a, k) => a + cur._occurrences[k], 0);
  if (over.length) {
    console.log('❌ 跨层引用比基线多了 ' + over.length + ' 条：');
    over.slice(0, 12).forEach((s) => console.log('   ' + s));
    console.log('   新增跨层依赖要判空调用（GAME.x && GAME.x.y），或改用注册表挂载。');
    process.exit(1);
  }
  console.log('✅ 架构棘轮：' + total + ' 条跨界边 / 参考调用 ' + occ
    + ' 次，无新增（基线只降不升）');
  process.exit(0);
}

process.stdout.write(L.join('\n') + '\n');
