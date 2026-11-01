/* ui 函数快照：把 js/ui*.js 里每个 `ui.xxx = …` 定义的源码切片并哈希，
 * 用于**证明拆分是纯搬运**（逐条比对拆分前后的 sha1，任何一条不同都说明动了逻辑）。
 *
 * 切片规则：从 `^  ui.<name>` 起，到下一个缩进 2 空格的行（或文件尾）为止。
 *   ui.js 里所有 `ui.xxx =` 都在 IIFE 顶层、缩进 2，所以这条规则是准的。
 *
 * 用法：
 *   node .workbuddy/tools/prof/snapshot_ui_fns.js --save  before   # 拆分前
 *   node .workbuddy/tools/prof/snapshot_ui_fns.js --save  after    # 拆分后
 *   node .workbuddy/tools/prof/snapshot_ui_fns.js --diff  before after
 */
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var ROOT = path.join(__dirname, '..', '..', '..');
var JS = path.join(ROOT, 'js');

function collect(onePath) {
  var files = onePath ? [onePath] : fs.readdirSync(JS).filter(function (f) {
    return /^ui.*\.js$/.test(f) && f.indexOf('bundle-') !== 0;
  }).sort();
  var out = {}, stats = {};
  files.forEach(function (f) {
    /* 单文件模式（--src）给的是相对仓库根的路径；扫描模式给的是 js/ 下的文件名 */
    var full = path.isAbsolute(f) ? f : (SRC_ONE ? path.resolve(ROOT, f) : path.join(JS, f));
    var lines = fs.readFileSync(full, 'utf8').split('\n');
    var label = path.basename(f);
    var starts = [];
    for (var i = 0; i < lines.length; i++) {
      var m = /^  ui\.([A-Za-z_$][\w$]*)\s*=/.exec(lines[i]);
      if (m) starts.push({ line: i, name: m[1] });
    }
    var n = 0;
    starts.forEach(function (s, k) {
      var end = lines.length;
      for (var j = s.line + 1; j < lines.length; j++) {
        if (/^  [^ ]/.test(lines[j])) { end = j; break; }
      }
      /* 末尾空行不计入（搬运时可能被 trim） */
      var idx = end;
      /* 尾部剥掉空行与 IIFE 收尾 —— 某个函数恰好是文件最后一个时，
         `})();` 会落进切片，导致 sha1 假red（第一次拆分时 _foldOpen/zoomStyle 就是这种） */
      while (idx > s.line + 1) {
        var tv = lines[idx - 1].trim();
        if (tv === '' || tv === '})();') idx--; else break;
      }
      var body = lines.slice(s.line, idx).join('\n');
      var h = crypto.createHash('sha1').update(body, 'utf8').digest('hex').slice(0, 12);
      /* 同名重复定义：保留全部（用 #k 区分），这类重叠本身就是要查的问题 */
      var key = s.name + (out[s.name] ? '#' + k : '');
      out[key] = h;
      n++;
    });
    stats[label] = n;
  });
  return { fns: out, stats: stats };
}

var args = process.argv.slice(2);
var SRC_ONE = null;
(function () {
  var i = args.indexOf('--src');
  if (i >= 0 && i + 1 < args.length) SRC_ONE = args[i + 1];
})();

if (args[0] === '--save') {
  var tag = args[1] || 'snap';
  var d = collect(SRC_ONE);
  var dst = path.join(ROOT, '.workbuddy', 'ui-fn-snapshot-' + tag + '.json');
  fs.writeFileSync(dst, JSON.stringify(d, null, 1), 'utf8');
  console.log('已保存 ' + dst);
  console.log('函数总数 ' + Object.keys(d.fns).length);
  Object.keys(d.stats).forEach(function (f) { console.log('  ' + f + ': ' + d.stats[f]); });
} else if (args[0] === '--diff') {
  var a = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy', 'ui-fn-snapshot-' + args[1] + '.json'), 'utf8'));
  var b = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy', 'ui-fn-snapshot-' + args[2] + '.json'), 'utf8'));
  var ka = Object.keys(a.fns), kb = Object.keys(b.fns);
  var onlyA = ka.filter(function (k) { return !b.fns[k]; });
  var onlyB = kb.filter(function (k) { return !a.fns[k]; });
  var diff = ka.filter(function (k) { return b.fns[k] && b.fns[k] !== a.fns[k]; });
  console.log('══ 拆分等价性 ══');
  console.log('  前 ' + ka.length + ' 个 · 后 ' + kb.length + ' 个');
  console.log('  只在拆分前存在：' + onlyA.length + (onlyA.length ? ' → ' + onlyA.slice(0, 8).join(',') : ' ✓'));
  console.log('  只在拆分后存在：' + onlyB.length + (onlyB.length ? ' → ' + onlyB.slice(0, 8).join(',') : ' ✓'));
  console.log('  函数体变了：' + diff.length + (diff.length ? ' → ' + diff.slice(0, 8).join(',') : ' ✓'));
  /* 判据：
       丢失（onlyA）→ 必然失败（函数不见了）
       函数体变（diff）→ 必然失败（逻辑被改）
       新增（onlyB）→ **允许**，但必须列出来供人看一眼：
         拆分本身会新增基础设施（如 ui._dom），那不是"改动"，是"新增"。
  */
  if (onlyB.length) {
    console.log('  新增（允许，请过目）：' + onlyB.join(', '));
  }
  var ok = !onlyA.length && !diff.length;
  console.log(ok ? '\n✅ 逐条一致 —— 拆分是纯搬运，零逻辑改动'
    : '\n❌ 有差异，拆分动了逻辑，必须查清');
  process.exit(ok ? 0 : 1);
} else {
  var c = collect();
  console.log('函数总数 ' + Object.keys(c.fns).length);
  Object.keys(c.stats).forEach(function (f) { console.log('  ' + f + ': ' + c.stats[f]); });
}
