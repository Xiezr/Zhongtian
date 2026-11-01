'use strict';
/* ============================================================
 * profile_smoke.js —— 给 smoke 做**外部**分段计时（不改被测代码）
 * ------------------------------------------------------------
 * 做法：spawn `node smoke-test.js`，逐行读 stdout 并打时间戳，
 *       按 `===== 段名 =====` 聚合，得到"哪一段吃了多少秒"。
 * 为什么外部做：smoke 是 4.7 万行的剧本，往里加计时器要改几十处、
 *   还可能影响判据；而"每行到达时间"是零侵入的。
 *
 * 用法：node .workbuddy/tools/prof/profile_smoke.js [--top 15]
 * 产物：.workbuddy/tmp/smoke_profile.json  + 控制台排行
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var ROOT = path.join(__dirname, '..', '..', '..');
var TOP = 15;
for (var i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--top') TOP = Number(process.argv[i + 1]) || 15;
}

var t0 = Date.now();
var segs = [];
var cur = { name: '(开头：环境与加载)', t: t0, lines: 0, pass: 0, fail: 0 };
var lastT = t0;

var p = spawn(process.execPath, ['smoke-test.js'], {
  cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe']
});

var pending = '';
function onChunk(chunk) {
  pending += chunk.toString('utf8');
  var lines = pending.split('\n');
  pending = lines.pop();                      /* 最后一段可能不完整，留到下次 */
  var now = Date.now();
  for (var i = 0; i < lines.length; i++) {
    var L = lines[i];
    var m = /^\s*=====\s*(.+?)\s*=====\s*$/.exec(L);
    if (m) {
      cur.dur = now - cur.t;
      segs.push(cur);
      cur = { name: m[1], t: now, lines: 0, pass: 0, fail: 0 };
      lastT = now;
      continue;
    }
    cur.lines++;
    if (L.indexOf('✅') >= 0) cur.pass++;
    else if (L.indexOf('❌') >= 0) cur.fail++;
  }
  lastT = now;
}
p.stdout.on('data', onChunk);
p.stderr.on('data', function () { /* three 的弃用告警走 stderr，不参与计时 */ });

p.on('close', function (code) {
  if (pending) { cur.lines++; }
  cur.dur = Date.now() - cur.t;
  segs.push(cur);
  var total = Date.now() - t0;

  var rows = segs.map(function (s) {
    return { name: s.name, dur: s.dur, pass: s.pass, fail: s.fail, lines: s.lines };
  }).sort(function (a, b) { return b.dur - a.dur; });

  var out = {
    totalMs: total, totalSec: +(total / 1000).toFixed(1),
    segCount: rows.length,
    sumCheckPass: rows.reduce(function (a, r) { return a + r.pass; }, 0),
    sumCheckFail: rows.reduce(function (a, r) { return a + r.fail; }, 0),
    top: rows.slice(0, TOP),
    all: rows
  };
  var outFile = path.join(ROOT, '.workbuddy/tmp/smoke_profile.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));

  console.log('smoke 总墙钟 ' + out.totalSec + ' 秒   段数 ' + rows.length
    + '   断言 ' + out.sumCheckPass + ' 通过 / ' + out.sumCheckFail + ' 失败   退出码 ' + code);
  console.log('\n最慢的 ' + TOP + ' 段：');
  console.log('  秒     占比   段名');
  rows.slice(0, TOP).forEach(function (r) {
    console.log('  ' + (r.dur / 1000).toFixed(1).padStart(6)
      + '  ' + (r.dur / total * 100).toFixed(1).padStart(5) + '%   ' + r.name.slice(0, 60));
  });
  var topSum = rows.slice(0, 10).reduce(function (a, r) { return a + r.dur; }, 0);
  console.log('\n前 10 段合计 ' + (topSum / 1000).toFixed(1) + ' 秒 = 全量的 '
    + (topSum / total * 100).toFixed(0) + '%');
  console.log('明细写入 ' + outFile);
});
