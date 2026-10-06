/* v89.208 · 全面评价体系 · 维度⑧「测试体系的覆盖盲区」（元层）
   为什么需要它：上两轮都在量**产品**（规模/四链/交互面），没人量过**测试本身**。
   3554 条 smoke + 1251 条 e2e 是这套工程唯一的回归保险 —— 保险的**免赔范围**在哪？
   本脚本从"出口面"反向查：1485 个唯一出口里，有多少**一条断言都没碰过**。

   产出：
     ① 出口 × 测试 覆盖矩阵（GAME./ui. 出口 → smoke/e2e 命中数）
     ② 零覆盖出口清单（按文件分组 · 按"产品代码是否引用"分三档）
     ③ 断言密度：每千行代码的断言数（分模块）
     ④ 测试自身的口径风险：测试里出现的魔法数（与实现各写一份 = 漂移温床）

   用法：node .workbuddy/tools/audit/audit_v89208_cover.js */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }
var MOD = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main',
  'story', 'icons', 'gicons', 'portraits', 'bitmaps', 'questdata'];
var SMOKE = read('smoke-test.js'), E2E = read('e2e-test.js');
var TEST = SMOKE + '\n' + E2E;
function cnt(re, s) { return (String(s).match(re) || []).length; }

/* ── 抽取全部出口（含命名空间链）── */
var EXPORTS = [];
MOD.forEach(function (f) {
  var rel = 'js/' + f + '.js';
  var s = read(rel), lines = s.split('\n');
  lines.forEach(function (L, i) {
    var m = L.match(/^\s{2}(GAME(?:\.[\w$]+)+|ui\.[\w$]+)\s*=\s*function/);
    if (m) EXPORTS.push({ name: m[1], file: f, at: i + 1 });
  });
});

/* ── 产品代码（不含测试）里该出口名是否被引用 ── */
var PROD = MOD.map(function (f) { return read('js/' + f + '.js'); }).join('\n') + read('index.html');

console.log('══════ ① 出口 × 测试 覆盖矩阵 ══════');
var rows = EXPORTS.map(function (e) {
  var short = e.name.replace(/^(GAME|ui)\./, '');
  /* 用末段名匹配（避免 GAME.battle.foo 与 GAME.foo 混淆，取最后一段） */
  var leaf = e.name.split('.').pop();
  var re = new RegExp('\\b' + e.name.replace(/\./g, '\\.').replace(/\$/g, '\\$') + '\\b', 'g');
  var reLeaf = new RegExp('\\.' + leaf.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
  return {
    name: e.name, file: e.file, at: e.at,
    s: cnt(re, SMOKE) + cnt(reLeaf, SMOKE) * 0,
    e: cnt(re, E2E),
    prod: cnt(re, PROD) > 1            /* >1 = 除定义行外产品里还有引用 */
  };
});
var zero = rows.filter(function (r) { return r.s === 0 && r.e === 0; });
var onlySmoke = rows.filter(function (r) { return r.s > 0 && r.e === 0; });
console.log('  出口总数 ' + rows.length
  + ' · smoke 命中 ' + rows.filter(function (r) { return r.s > 0; }).length
  + ' · e2e 命中 ' + rows.filter(function (r) { return r.e > 0; }).length);
console.log('  ⚠ 零覆盖（smoke 0 且 e2e 0）' + zero.length + ' 个'
  + '（占 ' + (zero.length / rows.length * 100).toFixed(1) + '%）');
console.log('  · 仅 smoke 覆盖（无 e2e）' + onlySmoke.length + ' 个');

console.log('\n  零覆盖出口 · 按"产品代码是否还在用"分档：');
var inUse = zero.filter(function (r) { return r.prod; });
var ghost = zero.filter(function (r) { return !r.prod; });
console.log('    [真盲区 A] 产品在用 + 无任何断言 … ' + inUse.length + ' 个 ← 回归保险的免赔区');
console.log('    [幽灵出口 B] 产品也不用（只剩定义）… ' + ghost.length + ' 个 ← 与 audit.js「仅测试引用」互为镜像');

console.log('\n  ── [A] 真盲区清单（按文件分组）──');
var byFile = {};
inUse.forEach(function (r) { (byFile[r.file] = byFile[r.file] || []).push(r.name + ':' + r.at); });
Object.keys(byFile).sort(function (a, b) { return byFile[b].length - byFile[a].length; }).forEach(function (f) {
  console.log('    ' + f.padEnd(10) + '(' + String(byFile[f].length).padStart(3) + ')  ' + byFile[f].slice(0, 14).join('  ')
    + (byFile[f].length > 14 ? '  …+' + (byFile[f].length - 14) : ''));
});

console.log('\n  ── [B] 幽灵出口清单 ──');
ghost.slice(0, 40).forEach(function (r) { console.log('    ' + r.file.padEnd(10) + r.name + ':' + r.at); });
if (ghost.length > 40) console.log('    …另有 ' + (ghost.length - 40) + ' 个');

console.log('\n══════ ② 断言密度（每千行代码的断言数）══════');
(function () {
  var sAss = (SMOKE.match(/assert\s*\(/g) || []).length;
  var eAss = (E2E.match(/assert\s*\(/g) || []).length;
  var jsLines = MOD.reduce(function (a, f) { return a + read('js/' + f + '.js').split('\n').length; }, 0);
  console.log('  smoke assert ' + sAss + ' · e2e assert ' + eAss + ' · 合计 ' + (sAss + eAss));
  console.log('  js/ ' + jsLines + ' 行 → 密度 ' + ((sAss + eAss) / jsLines * 1000).toFixed(1) + ' 断言/千行');
  console.log('  smoke 文件 ' + SMOKE.split('\n').length + ' 行 · e2e 文件 ' + E2E.split('\n').length + ' 行');
  console.log('  e2e / smoke 比 ' + (eAss / sAss * 100).toFixed(0) + '%（真实 DOM 覆盖的相对强度）');
})();

console.log('\n══════ ③ 测试自身的口径风险（魔法数双写）══════');
(function () {
  /* 同一阈值在"实现"和"测试"里各写一遍 = 口径漂移温床（v89.207 的 ratio/ratioLo 就是这一类）。
     这里扫一批"看起来像判据"的数值常量，看两边是否各写一份。 */
  var NUMS = ['0.5', '0.25', '0.75', '0.12', '0.15', '100', '20', '30', '0.8', '1.5', '0.3'];
  var hits = [];
  NUMS.forEach(function (n) {
    var re = new RegExp('(?<![\\d.])' + n.replace('.', '\\.') + '(?![\\d])', 'g');
    var inTest = cnt(re, TEST);
    if (inTest < 3) return;
    var files = MOD.filter(function (f) { return cnt(re, read('js/' + f + '.js')) > 0; });
    if (files.length) hits.push({ n: n, test: inTest, files: files });
  });
  console.log('  字面量同时在「实现」与「测试」出现的（>=3 次测试命中）：');
  hits.forEach(function (h) {
    console.log('    ' + h.n.padEnd(6) + ' 测试 ' + String(h.test).padStart(4) + ' 次 · 实现侧分布 '
      + h.files.slice(0, 6).join(',') + (h.files.length > 6 ? '…' : ''));
  });
  console.log('  读法：这不是缺陷清单，是**漂移温床清单** —— 每一行都值得问一句');
  console.log('        "测试和实现是不是各写了一份这个数？"');
})();
