/* v156.27c：给 smoke 一个统一入口 `__uiAll()`，把所有「读 js/ui.js 源码」收口。
 *
 * 背景：拆分后 `js/ui.js` 只剩 30 行骨架，而 smoke 里有 **200+ 处**断言直接
 *   读 `js/ui.js` 找特征串 → 一次性 658 条红。这不是拆分错了，是**断言硬编码了文件路径**。
 *
 * 做法（不改任何断言的判据，只改"源码从哪来"）：
 *   ① 定义 `__uiAll()` —— 按拆分前的顺序把 19 个文件拼起来（带缓存）
 *      → 内容与拆分前的 `ui.js` 等价，所以 `indexOf` / 正则全部照旧生效
 *   ② 三种写法全部改写：
 *        fs.readFileSync(path.join(__dirname,'js','ui.js'),'utf8')   → __uiAll()
 *        局部 helper（rd / rd31 / …）内部的 readFileSync            → 加三元判断
 *
 * ⛔ 以后写断言一律用 `__uiAll()`，不要再 `readFileSync('js/ui.js')`。
 */
'use strict';
var fs = require('fs');
var p = 'smoke-test.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('function __uiAll()') >= 0) { console.log('SKIP: 已打补丁'); process.exit(0); }

/* ---- ① 定义 __uiAll，插在 fsMod 声明之后 ---- */
var anchor = "  var fsMod = require('fs'), pathMod = require('path');";
if (s.indexOf(anchor) < 0) { console.error('✗ anchor fsMod'); process.exit(1); }

var def = anchor + `

  /* ============================================================
   * v156.27：\`ui.js\` 已拆成 19 个文件（见 docs/_史料/交付/v20261101i-ui拆分.md）。
   *   **所有"读 ui.js 源码"的断言一律走这里** —— 它把 19 个文件按拆分前的顺序
   *   拼成一份，内容与拆分前等价，所以 indexOf / 正则判断完全照旧。
   * ⛔ 不要再写 fs.readFileSync(...'js','ui.js'...)：那样只会读到 30 行骨架。
   * ============================================================ */
  var __uiAllCache = null;
  function __uiAll() {
    if (__uiAllCache != null) return __uiAllCache;
    var _f = require('fs'), _p = require('path');
    var NAMES = ['ui', 'ui-fx', 'ui-core', 'ui-modal', 'ui-shell', 'ui-battle', 'ui-city',
      'ui-army', 'ui-bag', 'ui-craft', 'ui-view', 'ui-build', 'ui-planet', 'ui-space',
      'ui-delve', 'ui-mapui', 'ui-exped', 'ui-report', 'ui-config'];
    __uiAllCache = NAMES.map(function (n) {
      try { return _f.readFileSync(_p.join(__dirname, 'js', n + '.js'), 'utf8'); } catch (e) { return ''; }
    }).join('\\n');
    return __uiAllCache;
  }`;
s = s.replace(anchor, def, 1);

/* ---- ② 直接调用：两种写法归一到 __uiAll() ---- */
var before = s.length;

/* 2a. require('fs').readFileSync(require('path').join(__dirname,'js','ui.js'),'utf8') */
s = s.replace(
  /require\('fs'\)\.readFileSync\(\s*require\('path'\)\.join\(__dirname,\s*'js',\s*'ui\.js'\),\s*'utf8'\s*\)/g,
  '__uiAll()');

/* 2b. XXX.readFileSync(YYY.join(__dirname,'js','ui.js'),'utf8') */
var n2 = 0;
s = s.replace(
  /([A-Za-z0-9_$]+)\.readFileSync\(\s*([A-Za-z0-9_$]+)\.join\(__dirname,\s*'js',\s*'ui\.js'\),\s*'utf8'\s*\)/g,
  function () { n2++; return '__uiAll()'; });

/* ---- ③ 局部 helper：在内部加三元判断（调用点不改）---- */
/* 3a. join(__dirname, 'js', f + '.js')  →  f === 'ui' */
var n3a = 0;
s = s.replace(
  /([A-Za-z0-9_$]+)\.readFileSync\(\s*([A-Za-z0-9_$]+)\.join\(__dirname,\s*'js',\s*f\s*\+\s*'\.js'\),\s*'utf8'\s*\)/g,
  function (m, a, b) {
    n3a++;
    return "((f === 'ui') ? __uiAll() : " + a + ".readFileSync(" + b + ".join(__dirname, 'js', f + '.js'), 'utf8'))";
  });

/* 3b. join(__dirname, 'js', f)  →  f === 'ui.js' */
var n3b = 0;
s = s.replace(
  /([A-Za-z0-9_$]+)\.readFileSync\(\s*([A-Za-z0-9_$]+)\.join\(__dirname,\s*'js',\s*f\),\s*'utf8'\s*\)/g,
  function (m, a, b) {
    n3b++;
    return "((f === 'ui.js') ? __uiAll() : " + a + ".readFileSync(" + b + ".join(__dirname, 'js', f), 'utf8'))";
  });

/* 3c. join(__dirname, f)  →  f === 'js/ui.js'（rd37 这类传相对路径的） */
var n3c = 0;
s = s.replace(
  /([A-Za-z0-9_$]+)\.readFileSync\(\s*([A-Za-z0-9_$]+)\.join\(__dirname,\s*f\),\s*'utf8'\s*\)/g,
  function (m, a, b) {
    n3c++;
    return "((f === 'js/ui.js') ? __uiAll() : " + a + ".readFileSync(" + b + ".join(__dirname, f), 'utf8'))";
  });

fs.writeFileSync(p, s, 'utf8');
console.log('__uiAll 定义已插入');
console.log('  直接调用 2b 改写：' + n2 + ' 处');
console.log('  helper 3a/3b/3c 改写：' + n3a + ' / ' + n3b + ' / ' + n3c + ' 处');
console.log('  文件长度 ' + before + ' → ' + s.length);
