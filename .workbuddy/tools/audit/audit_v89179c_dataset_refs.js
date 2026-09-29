/* ============================================================
 * audit_v89179c_dataset_refs.js —— `el.dataset.X` 读取必须有对应的 `data-X` 发射
 * ------------------------------------------------------------
 * 病根（v89.179c 老板第 1 条）：`main.js` 的 `case 'qb-cat-buy'` 读
 *   `el.dataset.scope` 重渲染，但 `ui.js` 的「买入」按钮模板**没写**
 *   `data-scope` → `undefined` → 静默退化成"整类端上来"。
 * 这类 bug 的特征：**不报错、不抛异常、只是行为悄悄变错**。
 * 本审计把它变成可机检的：main.js 里每一处 `el.dataset.X` 读，
 *   必须在 ui.js / index.html / main.js 里找到 `data-X=`（含 camelCase→kebab 归一）。
 * 用法：node .workbuddy/tools/audit/audit_v89179c_dataset_refs.js
 * 退出码：0 = 无缺口；1 = 有缺口
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = path.join(__dirname, '..', '..', '..');   /* 仓库根 */

function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }

/* 去注释（避免注释里的示例串被当成真代码）
   ⚠️ 必须**保留换行数**，否则报出来的行号是"折叠注释后"的假行号（v89.179c 首版踩过）。 */
function stripComment(src) {
  return src
    /* 块注释：内容换成空格，但换行原样保留 → 行号不移位 */
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    /* 行注释：只砍掉 // 之后到行尾（不吞换行） */
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

var READERS = ['js/main.js', 'js/ui.js'];
var EMITTERS = ['js/ui.js', 'js/main.js', 'index.html'];

function toKebab(k) { return k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }

/* ---- 1. 采集读取点 / **动态写入点** ----
   ⚠️ 只扫 `data-X=` 会漏掉"运行时赋值"这种发射方式：
   `next.dataset.on = '1'`（ui.js 的 live 层切换）就是靠它发射的 —— v89.179c 首版把它
   误报成"无发射"（假阳性）。所以写入点也算发射。 */
var reads = {};        /* key -> [ "file:line" ] */
var dynWrites = {};    /* key -> [ "file:line" ]（dataset.X = ... 运行时发射） */
READERS.forEach(function (rel) {
  var src = stripComment(rd(path.join(R, rel)));
  src.split('\n').forEach(function (line, i) {
    var at = rel + ':' + (i + 1);
    /* 一次性区分"写"与"读"：捕获组 2 存在 = 赋值（后面不是 =，排除 ==/===） */
    var ALL = /\.dataset\.([A-Za-z_][A-Za-z0-9_]*)(\s*=(?!=))?/g, m;
    while ((m = ALL.exec(line)) !== null) {
      if (m[2]) (dynWrites[m[1]] = dynWrites[m[1]] || []).push(at);
      else (reads[m[1]] = reads[m[1]] || []).push(at);
    }
    var re2 = /\.dataset\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g;
    while ((m = re2.exec(line)) !== null) {
      (reads[m[1]] = reads[m[1]] || []).push(at);
    }
  });
});

/* ---- 2. 采集发射点（静态模板里写死的 data-X= ）---- */
var emits = {};
EMITTERS.forEach(function (rel) {
  var src = stripComment(rd(path.join(R, rel)));
  var re = /data-([a-zA-Z0-9-]+)\s*=/g, m;
  while ((m = re.exec(src)) !== null) {
    var k = m[1].toLowerCase();
    emits[k] = emits[k] || [];
    emits[k].push(rel);
  }
});
/* index.html 里的 data-action 等也算（上面已含），另补"动态拼接"的名单：
   ui.js 里 data-* 常见写法是 '...data-scope="' + x + '"' —— 上面的正则已能命中
   前缀 data-scope=。若某属性只通过变量名拼（'data-' + k + '="'），本审计无法覆盖，
   故额外把"白名单式变量"记下来供人工复核。 */

/* ---- 3. 比对 ---- */
var missing = [];
Object.keys(reads).sort().forEach(function (k) {
  var keb = toKebab(k);
  if (!emits[k] && !emits[keb] && !dynWrites[k] && !dynWrites[keb]) missing.push({ key: k, kebab: keb, at: reads[k] });
});

console.log('=== v89.179c · el.dataset.X 读取/发射 一致性审计 ===');
console.log('读取端 ' + READERS.join(' / ') + '（去注释后）· 发射端 ' + EMITTERS.join(' / ') + ' + 运行时 dataset.X= 赋值');
console.log('读取到的 dataset 键 ' + Object.keys(reads).length + ' 个 · 静态发射 ' + Object.keys(emits).length
  + ' 个 · 运行时发射 ' + Object.keys(dynWrites).length + ' 个');
console.log('');
console.log('键'.padEnd(16) + '| 归一名'.padEnd(18) + '| 读取点');
console.log('-'.repeat(16) + '|' + '-'.repeat(18) + '|--------');
Object.keys(reads).sort().forEach(function (k) {
  var keb = toKebab(k);
  var hit = emits[k] || emits[keb];
  var dyn = dynWrites[k] || dynWrites[keb];
  console.log((k + (hit || dyn ? '' : '  ⚠')).padEnd(16) + '| ' + keb.padEnd(16) + '| '
    + (reads[k].length > 3 ? reads[k].slice(0, 3).join(' ') + ' …(+' + (reads[k].length - 3) + ')' : reads[k].join(' '))
    + (hit ? '   ✅ 模板发射' : (dyn ? '   ✅ 运行时赋值' : '   ❌ 无发射（静默 undefined 风险）')));
});

console.log('');
var nKeys = Object.keys(reads).length;
if (missing.length === 0) {
  console.log('✅ 无缺口 —— 每个 dataset 读取都有对应的 data-* 模板发射 / 运行时赋值');
  /* 标准汇总行：让 gate.py 的 run_one 认得它（与 smoke/e2e 同口径）。 */
  console.log('结果：' + nKeys + ' 通过 / 0 失败');
  process.exit(0);
}
console.log('❌ 发现 ' + missing.length + ' 个"读取但无发射"的 dataset 键（潜在静默 undefined）：');
missing.forEach(function (m) {
  console.log('   ' + m.key + '（data-' + m.kebab + '） ← ' + m.at.join(' '));
});
console.log('结果：' + (nKeys - missing.length) + ' 通过 / ' + missing.length + ' 失败');
process.exit(1);
