/* ============================================================
 * audit_v89117_fonts.js — **字体体系体检**（v89.117 · 老板「字体统一设计一下」）
 * ------------------------------------------------------------
 * 量七样（全部只读，不改任何文件）：
 *   ① index.html 里所有 font-size 的**值分布**（令牌 / 裸 px 各多少）
 *   ② 裸 px 清单（逐个报所在选择器）—— "没有归令牌"的就是要收敛的
 *   ③ font-weight 分布（项目口径：400 / 700 / 800 三档）
 *   ④ line-height 分布
 *   ⑤ js/**里内联 style="font-size:…" 的用量（逃逸出样式表的那些）
 *   ⑥ 令牌健全性：:root 定义 vs 全文引用（引用未定义 / 定义未引用）
 *   ⑦ 字号令牌的**层级单调性**（h1 > h2 > h3 ≥ body > sub > cap）
 *
 * 用法：node .workbuddy/tools/audit/audit_v89117_fonts.js [--gate]
 *   --gate：有任何①裸 px / ⑥未定义引用 / ⑦单调性破坏 → 退出码 1
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var GATE = process.argv.indexOf('--gate') >= 0;

var html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
/* 剥注释：说明文字里提到 font-size 不算数（本项目踩过多次） */
var css = html.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- ① 令牌表 ---------- */
var rootBlock = (css.match(/:root\s*\{[\s\S]*?\n    \}/) || [''])[0];
var tokens = {};
var tre = /--(fs-[a-z0-9]+)\s*:\s*([0-9.]+)px/g, tm;
while ((tm = tre.exec(css)) !== null) tokens['--' + tm[1]] = Number(tm[2]);
console.log('===== ① :root 字号令牌（' + Object.keys(tokens).length + ' 个）=====');
Object.keys(tokens).sort(function (a, b) { return tokens[b] - tokens[a]; })
  .forEach(function (k) { console.log('   ' + k.padEnd(12) + tokens[k] + 'px'); });

/* ---------- ② font-size 值分布 ---------- */
var decl = css.match(/font-size:\s*[^;}]+/g) || [];
var byVal = {};
decl.forEach(function (d) {
  var v = d.replace(/font-size:\s*/, '').replace(/\s+/g, ' ').trim();
  (byVal[v] = byVal[v] || []).push(v);
});
console.log('\n===== ② font-size 值分布（共 ' + decl.length + ' 处）=====');
var bare = [];
Object.keys(byVal).sort(function (a, b) { return byVal[b].length - byVal[a].length; })
  .forEach(function (v) {
    /* 令牌 = 任何 var(--*)（fs 字号族 / isz 图标尺寸族 / sxf 局部族都算"有名字"）；
       裸值 = 数字字面量（px / em / rem）——那才是要收敛的对象。 */
    var isToken = /^var\(--[a-z0-9-]+\)$/.test(v);
    if (!isToken) bare.push(v);
    console.log('   ' + String(byVal[v].length).padStart(4) + ' 处  ' + v + (isToken ? '' : '   ← 裸值'));
  });

/* ---------- ③ font-weight ---------- */
var fw = css.match(/font-weight:\s*[^;}]+/g) || [];
var fwCnt = {};
fw.forEach(function (d) { var v = d.replace(/font-weight:\s*/, '').trim(); fwCnt[v] = (fwCnt[v] || 0) + 1; });
console.log('\n===== ③ font-weight 分布（共 ' + fw.length + ' 处）=====');
Object.keys(fwCnt).sort(function (a, b) { return fwCnt[b] - fwCnt[a]; })
  .forEach(function (v) { console.log('   ' + String(fwCnt[v]).padStart(4) + ' 处  ' + v); });

/* ---------- ④ line-height ---------- */
var lh = css.match(/line-height:\s*[^;}]+/g) || [];
var lhCnt = {};
lh.forEach(function (d) { var v = d.replace(/line-height:\s*/, '').trim(); lhCnt[v] = (lhCnt[v] || 0) + 1; });
console.log('\n===== ④ line-height 分布（共 ' + lh.length + ' 处）=====');
Object.keys(lhCnt).sort(function (a, b) { return lhCnt[b] - lhCnt[a]; })
  .forEach(function (v) { console.log('   ' + String(lhCnt[v]).padStart(4) + ' 处  ' + v); });

/* ---------- ⑤ js 里内联 font-size ---------- */
console.log('\n===== ⑤ js 内联 style 里的 font-size =====');
var jsDir = path.join(R, 'js');
var jsBare = 0, jsTok = 0;
fs.readdirSync(jsDir).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  var s = fs.readFileSync(path.join(jsDir, f), 'utf8');
  var m = s.match(/font-size:[^;'"\\]*/g) || [];
  var tok = m.filter(function (x) { return /var\(--fs-/.test(x); }).length;
  var b = m.filter(function (x) { return /px/.test(x); });
  jsTok += tok; jsBare += b.length;
  if (m.length) {
    console.log('   ' + f.padEnd(14) + ' 共 ' + m.length + ' 处（令牌 ' + tok + ' / 裸 px ' + b.length + '）'
      + (b.length ? '　裸值例：' + b.slice(0, 3).join(' | ') : ''));
  }
});
console.log('   —— 小计：令牌 ' + jsTok + ' 处 / **裸 px ' + jsBare + ' 处**');

/* ---------- ⑥ 令牌健全性 ---------- */
var refRe = /var\(--(fs-[a-z0-9]+)\)/g, rm;
var refs = {};
while ((rm = refRe.exec(css)) !== null) refs['--' + rm[1]] = (refs['--' + rm[1]] || 0) + 1;
var fsRefsJs = {};
fs.readdirSync(jsDir).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
  var s = fs.readFileSync(path.join(jsDir, f), 'utf8');
  var m, r2 = /var\(--(fs-[a-z0-9]+)\)/g;
  while ((m = r2.exec(s)) !== null) fsRefsJs['--' + m[1]] = (fsRefsJs['--' + m[1]] || 0) + 1;
});
var undef = [], unused = [];
Object.keys(refs).concat(Object.keys(fsRefsJs)).forEach(function (k) {
  if (!tokens[k] && undef.indexOf(k) < 0) undef.push(k);
});
Object.keys(tokens).forEach(function (k) {
  if (!refs[k] && !fsRefsJs[k]) unused.push(k);
});
console.log('\n===== ⑥ 令牌健全性 =====');
console.log('   引用未定义：' + (undef.length ? undef.join('、') : '无 ✅'));
console.log('   定义未引用：' + (unused.length ? unused.join('、') : '无 ✅'));

/* ---------- ⑦ 层级单调性 ---------- */
console.log('\n===== ⑦ 字号层级（单调性检查）=====');
/* 层级：一级标题 > 二级标题 > 导语/按钮 > 三级标题(=正文) > 正文 > 次要 > 极小 */
var ORDER = ['--fs-h1', '--fs-h2', '--fs-lead', '--fs-h3', '--fs-body', '--fs-sub', '--fs-cap'];
var last = Infinity, monoOK = true, line = [];
ORDER.forEach(function (k) {
  if (tokens[k] == null) { line.push(k + '=?'); return; }
  if (tokens[k] > last) { monoOK = false; line.push(k + '=' + tokens[k] + '⚠'); }
  else line.push(k + '=' + tokens[k]);
  last = tokens[k];
});
console.log('   ' + line.join('  >  '));
console.log('   单调递减：' + (monoOK ? '✅' : '❌ 破坏'));

/* ---------- 汇总 ---------- */
console.log('\n===== 汇总 =====');
console.log('   index.html 裸 px 值种类：' + bare.length + (bare.length ? '（' + bare.join(' / ') + '）' : ''));
console.log('   js 内联裸 px：' + jsBare + ' 处');
var bad = (bare.length > 0 && GATE) || undef.length || !monoOK;
if (GATE) {
  console.log(bad ? '\n❌ 未过（--gate）' : '\n✅ 通过（--gate）');
  process.exit(bad ? 1 : 0);
}
process.exit(0);
