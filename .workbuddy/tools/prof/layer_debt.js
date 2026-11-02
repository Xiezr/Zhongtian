#!/usr/bin/env node
/* ============================================================
 * layer_debt.js —— 分层欠条台账（生成 + 比对）
 * ------------------------------------------------------------
 * 老板 2026-11-02「可见有很多老旧体系下掩埋的问题，按新体系逐一梳理层次，捋清依赖」
 *
 * 这轮查清的事实（可复现）：
 *   ① "三层"（bundle-core / war / ui）是**打包分组**，不是依赖约束 ——
 *      build_bundle.py 只按 order 拼接，从不校验方向；
 *   ② 因此有 65 条反向依赖（core→ui 47 / core→war 12 / war→ui 6），
 *      不是"破坏分层"，是**从来没有这条规则**；
 *   ③ 反向调用是点状的：134 个调用点 / 50 个函数，
 *      58 处带存在性守卫（承认的债），43 处裸调用。
 *
 * 台账的用处：
 *   · 不改代码、不阻断。它是**欠条的清单**，让"新增一条"和"还清一条"都可见；
 *   · 下次有人问"我们分层了吗"，看这份文件，不用重新分析一遍。
 *
 * 用法：
 *   node .workbuddy/tools/prof/layer_debt.js            # 打印现状
 *   node .workbuddy/tools/prof/layer_debt.js --update   # 重写台账（改了代码后）
 *   node .workbuddy/tools/prof/layer_debt.js --diff     # 与台账比：新增/还清
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, '.workbuddy', 'layer-debt.json');
const mods = JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'modules.json'), 'utf8'));

/* 允许的方向：core 不依赖 war/ui；war 不依赖 ui */
const FORBIDDEN = { core: ['war', 'ui'], war: ['ui'], ui: [] };

const nameOf = {};
mods.modules.forEach((m) => { nameOf[m.name] = m; });

/* 分类：按被调函数名的前缀/语义，判断这条债的性质 */
function kindOf(fn) {
  if (/^(toast|notify|moment|flash|sceneCaption|hintGoto)/.test(fn)) return 'notify';
  if (/^(open|close)/.test(fn)) return 'open-ui';
  if (/^(rebuild|invalidate|render|syncHeader|fill)/.test(fn)) return 'refresh';
  return 'compute';
}

const rows = [];
mods.modules.forEach((m) => {
  const bad = FORBIDDEN[m.bundle] || [];
  (m.deps || []).forEach((d) => {
    const t = nameOf[d];
    if (!t || !bad.includes(t.bundle)) return;
    /* 数清这条边上的调用点，并按函数分类 */
    let src = '';
    try { src = fs.readFileSync(path.join(ROOT, m.file), 'utf8'); } catch (e) { return; }
    const calls = {};
    const re = new RegExp('\\bGAME\\.' + d.replace(/[-]/g, '\\-') + '\\.([A-Za-z_$][\\w$]*)', 'g');
    let mm;
    while ((mm = re.exec(src))) calls[mm[1]] = (calls[mm[1]] || 0) + 1;
    const detail = Object.keys(calls).map((fn) => ({ fn, n: calls[fn], kind: kindOf(fn) }))
      .sort((a, b) => b.n - a.n);
    rows.push({
      from: m.name, fromLayer: m.bundle, to: d, toLayer: t.bundle,
      sites: detail.reduce((a, x) => a + x.n, 0), calls: detail,
    });
  });
});

rows.sort((a, b) => b.sites - a.sites);
const byKind = {};
rows.forEach((r) => r.calls.forEach((c) => { byKind[c.kind] = (byKind[c.kind] || 0) + c.n; }));

const snap = {
  at: new Date().toISOString().slice(0, 19),
  note: '分层欠条。**三层是打包分组，不是依赖约束**（build_bundle 只按 order 拼接）。'
    + '这里记的是"实际存在的反向调用"，不是"违规"。新增一条要在这里可见，还清一条也要划掉。',
  rule: FORBIDDEN,
  totals: {
    edges: rows.length,
    sites: rows.reduce((a, r) => a + r.sites, 0),
    byKind,
  },
  edges: rows,
};

const argv = process.argv.slice(2);

if (argv.indexOf('--update') >= 0) {
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 1) + '\n');
  console.log('已写台账：' + rows.length + ' 条边 / ' + snap.totals.sites + ' 个调用点');
  process.exit(0);
}

if (argv.indexOf('--diff') >= 0) {
  let old = null;
  try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { old = null; }
  if (!old) { console.log('没有台账，先跑 --update'); process.exit(0); }
  const key = (e) => e.from + '→' + e.to;
  const oldSet = new Set(old.edges.map(key));
  const newSet = new Set(rows.map(key));
  const added = rows.filter((r) => !oldSet.has(key(r)));
  const gone = old.edges.filter((e) => !newSet.has(key(e)));
  /* v156.43：**边数不变但调用点变少**也要看得见。
     之前只比边：把 story 的 30 处 compute 搬走之后，diff 报「新增 0 还清 0」——
     这次重构在台账上完全隐形。工具的粒度错了，等于它看不见最重要的一类改善。 */
  const oldSites = {};
  old.edges.forEach((e) => { oldSites[key(e)] = e.sites; });
  const thin = [];
  rows.forEach((r) => {
    const k = key(r);
    if (oldSites[k] != null && oldSites[k] !== r.sites) thin.push({ k, from: oldSites[k], to: r.sites });
  });
  const oldTotal = (old.totals && old.totals.sites) || 0;
  const newTotal = snap.totals.sites;
  console.log('\n══ 欠条变动（' + old.at + ' → 现在）══');
  console.log('  新增 ' + added.length + ' 条边 · 还清 ' + gone.length + ' 条边'
    + ' · 调用点 ' + oldTotal + ' → ' + newTotal
    + (newTotal !== oldTotal ? '（' + (newTotal > oldTotal ? '+' : '') + (newTotal - oldTotal) + '）' : ''));
  thin.forEach((t) => console.log('    变瘦 ' + t.k + '：' + t.from + ' → ' + t.to + ' 处'));
  added.forEach((r) => console.log('  + ' + key(r) + '（' + r.sites + ' 处）'));
  gone.forEach((e) => console.log('  - ' + key(e) + '（原 ' + e.sites + ' 处）'));
  process.exit(added.length ? 1 : 0);
}

/* 默认：打印现状 */
console.log('\n══ 分层实况：三层是**打包分组**，没有依赖约束 ══\n');
console.log('  允许方向：core 不依赖 war/ui；war 不依赖 ui（rule 仅作参照，无人强制）\n');
console.log('  反向调用边 ' + rows.length + ' 条 / 调用点 ' + snap.totals.sites + ' 个\n');
console.log('  性质分布：');
Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a]).forEach((k) => {
  const label = { notify: '通知（可延迟，最容易解耦）', 'open-ui': '开界面（core 触发 UI）',
    refresh: '渲染刷新（core 要求重画）', compute: '计算（**功能放错层**）' }[k] || k;
  console.log('    ' + String(byKind[k]).padStart(3) + ' × ' + k.padEnd(10) + label);
});
console.log('\n  最重的 10 条边：');
rows.slice(0, 10).forEach((r) => {
  const kinds = [...new Set(r.calls.map((c) => c.kind))].join(',');
  console.log('    ' + (r.from + ' [' + r.fromLayer + '] → ' + r.to + ' [' + r.toLayer + ']').padEnd(42)
    + String(r.sites).padStart(3) + ' 处  ' + kinds);
});
console.log('\n  提示：这不是"违规清单"，是"从来没有规则"的证据。');
console.log('  要立规则得先改 70 处调用；台账只负责让新增/还清都可见。');
