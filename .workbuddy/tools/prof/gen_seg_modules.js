'use strict';
/* ============================================================
 * gen_seg_modules.js —— 给 238 个测试段打「涉及哪些模块文件」标签
 * ------------------------------------------------------------
 * 老板 2026-11-02：「资产属于不同层级……当我要调整元素时，只有这个元素、
 *   它的引用和它的依赖需要做复核吧」
 *
 * 这就是"牵动面"的正解 —— 不靠搜关键词，靠**符号 → 文件**的索引：
 *   · `ui.foo()` → 查 project-index 的 symbols 表 → 定义在 js/ui-xxx.js
 *   · `GAME.bar()` → 同理 → js/battle.js 等
 *   · 再按 modules.json 的 deps 做**一跳传递**（改 map3d 也会影响引用它的 ui-space 段）
 *
 * 产物 `.workbuddy/seg-modules.json`：段号 → { title, files[], checks }
 * 用途：`node .workbuddy/tools/prof/smoke_touching.js --file js/ui-space.js`
 *   只跑"涉及 ui-space 的段"，而不是 4661 条全量。
 * ============================================================ */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..', '..');
var idx = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy/index/project-index.json'), 'utf8'));
var mods = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/modules.json'), 'utf8'));
var SYM = idx.symbols || {};
var lines = fs.readFileSync(path.join(ROOT, 'smoke-test.js'), 'utf8').split('\n');

/* 段边界 */
var segs = [];
for (var i = 0; i < lines.length; i++) {
  var m = /=====\s*(\d+)\.\s*(.+?)\s*=====/.exec(lines[i]);
  if (m) segs.push({ no: m[1], title: m[2], line: i });
}
segs.forEach(function (s, k) { s.end = (k + 1 < segs.length) ? segs[k + 1].line : lines.length; });

/* 模块 → 直接依赖（一跳） */
var depsOf = {};
(mods.modules || []).forEach(function (m) { depsOf[m.name] = m.deps || []; });
function modOf(file) { return String(file || '').replace(/^js\//, '').replace(/\.js$/, ''); }

var out = { note: '段号 → 涉及模块。由 gen_seg_modules.js 生成，改断言后重跑。', segs: {} };
var unk = {};

segs.forEach(function (s) {
  var files = {}, checks = 0;
  for (var j = s.line; j < s.end; j++) {
    var L = lines[j];
    if (/^\s*check\(/.test(L)) checks++;
    /* ui.foo / GAME.ui.foo / GAME.bar —— 三类引用都查符号表 */
    var re = /\b(?:GAME\.)?ui\.([A-Za-z_$][\w$]*)/g, m1;
    while ((m1 = re.exec(L))) {
      var hit = SYM['ui.' + m1[1]];
      if (hit) files[hit.file] = 1; else unk['ui.' + m1[1]] = 1;
    }
    var re2 = /\bGAME\.([A-Za-z_$][\w$]*)/g, m2;
    while ((m2 = re2.exec(L))) {
      if (m2[1] === 'ui') continue;
      var h2 = SYM['GAME.' + m2[1]];
      if (h2) files[h2.file] = 1; else unk['GAME.' + m2[1]] = 1;
    }
  }
  /* 一跳传递：段用到 A，而 B 依赖 A → B 也算（改 B 会波及 A 的行为） */
  var direct = Object.keys(files).filter(function (f) { return /^js\//.test(f); });
  var directMods = {};
  direct.forEach(function (f) { directMods[modOf(f)] = 1; });
  Object.keys(depsOf).forEach(function (m) {
    if ((depsOf[m] || []).some(function (d) { return directMods[d]; })) directMods[m] = 1;
  });
  var all = Object.keys(directMods).map(function (x) { return 'js/' + x + '.js'; });
  out.segs[s.no] = { title: s.title, files: all.sort(), checks: checks, direct: direct.sort() };
});

var outFile = path.join(ROOT, '.workbuddy/seg-modules.json');
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));

/* 统计 */
var counts = {};
Object.keys(out.segs).forEach(function (k) {
  out.segs[k].files.forEach(function (f) { counts[f] = (counts[f] || 0) + 1; });
});
var rows = Object.keys(counts).map(function (f) { return { f: f, n: counts[f], ck: 0 }; })
  .sort(function (a, b) { return b.n - a.n; });

var totalChecks = Object.keys(out.segs).reduce(function (a, k) { return a + out.segs[k].checks; }, 0);
console.log('段 ' + segs.length + ' 个 · 断言 ' + totalChecks + ' 条 · 涉及文件 ' + rows.length + ' 个');
console.log('查不到归属的符号 ' + Object.keys(unk).length + ' 个（多为测试局部变量，正常）');
console.log('\n=== 被最多段涉及的 15 个文件（改它们动静最大） ===');
rows.slice(0, 15).forEach(function (r) {
  var ck = Object.keys(out.segs).reduce(function (a, k) {
    return a + (out.segs[k].files.indexOf(r.f) >= 0 ? out.segs[k].checks : 0);
  }, 0);
  console.log('  ' + String(r.n).padStart(3) + ' 段 / ' + String(ck).padStart(4) + ' 条  ' + r.f);
});
console.log('\n=== 改动面最小的 10 个（只牵动少量段 —— 这正是"改它只跑那几段"的价值） ===');
rows.slice(-10).reverse().forEach(function (r) {
  var ck = Object.keys(out.segs).reduce(function (a, k) {
    return a + (out.segs[k].files.indexOf(r.f) >= 0 ? out.segs[k].checks : 0);
  }, 0);
  console.log('  ' + String(r.n).padStart(3) + ' 段 / ' + String(ck).padStart(4) + ' 条  ' + r.f);
});
console.log('\n→ ' + outFile);
