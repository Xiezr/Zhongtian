'use strict';
/* ============================================================
 * smoke_touching.js —— 只跑「涉及某个文件」的测试段
 * ------------------------------------------------------------
 * 老板 2026-11-02：「当我要调整元素时，只有这个元素、它的引用和它的依赖需要做复核吧」
 *
 * 数据来源 `.workbuddy/seg-modules.json`（gen_seg_modules.js 生成）：
 *   段 → 它**直接调用**的模块（按符号表反查文件），不含传递依赖。
 * 为什么不用传递：实测传一步就覆盖 143/238 段（因为 state 是上帝模块）——
 *   那等于全量，没有意义。传递影响留给提交时的 gate 兜底。
 *
 * 实测覆盖率（直接口径）：
 *   js/ui-space.js   8 段 / 111 条
 *   js/map3d.js      3 段 / 380 条
 *   js/battle.js    20 段 / 1261 条
 *   js/gltf.js       1 段 /  62 条
 *
 * 用法：
 *   node smoke_touching.js --file js/ui-space.js            # 只列段（不跑）
 *   node smoke_touching.js --file js/ui-space.js --run      # 切片跑
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..', '..');
var args = process.argv.slice(2);
var FILE = null, RUN = args.indexOf('--run') >= 0, LIST = args.indexOf('--list') >= 0;
for (var i = 0; i < args.length; i++) if (args[i] === '--file') FILE = args[i + 1];
if (!FILE) {
  console.log('用法: node smoke_touching.js --file js/ui-space.js [--run]');
  process.exit(1);
}
if (FILE.charAt(0) !== 'j') FILE = 'js/' + FILE.replace(/^js\//, '').replace(/\.js$/, '') + '.js';

var segMod = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy/seg-modules.json'), 'utf8'));
var hits = Object.keys(segMod.segs).filter(function (no) {
  return (segMod.segs[no].direct || []).indexOf(FILE) >= 0;
}).map(Number).sort(function (a, b) { return a - b; });

if (!hits.length) {
  console.log('没有段直接涉及 ' + FILE + '（可能只被间接引用）→ 改它请跑全量/门禁');
  process.exit(1);
}
var checks = hits.reduce(function (a, no) { return a + segMod.segs[String(no)].checks; }, 0);
console.log('涉及 ' + FILE + ' 的段 ' + hits.length + ' 个 / 断言 ' + checks + ' 条：');
hits.forEach(function (no) {
  var s = segMod.segs[String(no)];
  console.log('  #' + String(no).padStart(3) + '  ' + String(s.checks).padStart(3) + ' 条  ' + s.title.slice(0, 50));
});
if (!RUN) { console.log('\n（加 --run 才真的跑）'); process.exit(0); }

/* ---- 切片：prelude + 目标段 + 收尾 ---- */
var lines = fs.readFileSync(path.join(ROOT, 'smoke-test.js'), 'utf8').split('\n');
var segs = [];
for (var n = 0; n < lines.length; n++) {
  var m = /=====\s*(\d+)\.\s*(.+?)\s*=====/.exec(lines[n]);
  if (m) segs.push({ no: Number(m[1]), line: n, title: m[2] });
}
segs.forEach(function (s, k) { s.end = (k + 1 < segs.length) ? segs[k + 1].line : lines.length; });
var preludeEnd = segs.length ? segs[0].line : lines.length;

var body = lines.slice(0, preludeEnd);
/* 切片的 prelude 里补一次**标准开局**：全量时前面的段早就开过局了，被切的段默认
   GAME.state 可用；跳段后没有，于是 ui.mapHTML 这类直接读 state 的函数会抛。 */
body = body.concat([
  "  /* v156.38 切片前置：标准开局（各段若自己 newGame 会覆盖，重复无害） */",
  "  try { var _st0 = G.newGame({ name: 'slice', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 }); if (!_st0.map.grid) G.map.generate(); } catch (e0) { console.log('  ⚠️ 切片前置开局失败: ' + e0.message); }"
]);
hits.forEach(function (no) {
  var s = segs.filter(function (x) { return x.no === no; })[0];
  if (!s) return;
  body = body.concat(lines.slice(s.line, s.end));
});
body = body.concat([
  "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败' + (WARN ? (' / ' + WARN + ' 待修（实现类·不阻断）') : ''));",
  '  process.exit(FAIL ? 1 : 0);',
  '})();'
]);

var tmp = path.join(ROOT, '.tmp_touching.js');
fs.writeFileSync(tmp, body.join('\n'));
try { new Function(body.join('\n')); } catch (e) {
  console.log('⚠️ 切片试编译失败（跳段导致作用域断裂）：' + e.message);
  console.log('   → 改这个文件请跑全量：node .workbuddy/tools/prof/smoke_fast.js');
  process.exit(2);
}
console.log('\n切片 ' + tmp + '（' + body.length + ' 行），开始跑…');
var t0 = Date.now();
var r = cp.spawnSync(process.execPath, [tmp], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
var out = (r.stdout || '') + (r.stderr || '');
var tail = out.split('\n').filter(function (L) { return /❌|⚠️|^结果/.test(L); });
tail.forEach(function (L) { console.log(L); });
if (!/^结果/m.test(out)) {
  console.log('⚠️ 切片跑崩（没打印汇总）—— 说明段间还有隐式依赖，请跑全量');
  console.log(out.split('\n').slice(-12).join('\n'));
  process.exit(2);
}
console.log('\n墙钟 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒（全量约 458 秒）');
try { fs.unlinkSync(tmp); } catch (e) { }
