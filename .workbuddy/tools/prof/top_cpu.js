/* 读 .cpuprofile，按"自身耗时(self time)"排出前 N 个函数。
 * 用法：node .workbuddy/tools/prof/top_cpu.js <cpuprofile 路径> [N=25]
 */
'use strict';
var fs = require('fs');
var file = process.argv[2];
var N = parseInt(process.argv[3] || '25', 10);
if (!file) { console.error('用法: node top_cpu.js <cpuprofile> [N]'); process.exit(1); }

var prof = JSON.parse(fs.readFileSync(file, 'utf8'));
var byId = {};
prof.nodes.forEach(function (n) { byId[n.id] = n; });

/* timeDeltas[i] 是第 i 个 sample 与上一个的间隔（微秒），归到 samples[i] 的节点 */
var self = {};
var total = 0;
for (var i = 0; i < prof.samples.length; i++) {
  var id = prof.samples[i];
  var dt = prof.timeDeltas[i] || 0;
  if (dt < 0) dt = 0;
  self[id] = (self[id] || 0) + dt;
  total += dt;
}

var rows = Object.keys(self).map(function (id) {
  var n = byId[id] || {};
  var cf = n.callFrame || {};
  var url = (cf.url || '').replace(/^file:\/\/\/E:\/Deepseekdb\//, '');
  return {
    ms: self[id] / 1000,
    fn: cf.functionName || '(anonymous)',
    url: url,
    line: cf.lineNumber >= 0 ? cf.lineNumber + 1 : 0
  };
}).sort(function (a, b) { return b.ms - a.ms; });

console.log('总采样时长 ' + (total / 1e6).toFixed(1) + 's · 不同函数 ' + rows.length);
console.log('--- 自身耗时 Top ' + N + ' ---');
rows.slice(0, N).forEach(function (r) {
  console.log(
    (r.ms / 1000).toFixed(2).padStart(7) + 's  ' +
    ((r.ms / (total / 1000)) * 100).toFixed(1).padStart(5) + '%  ' +
    r.fn.slice(0, 42).padEnd(44) + r.url + ':' + r.line
  );
});

/* 按"文件"汇总，回答"是哪个模块吃掉的时间" */
var byFile = {};
rows.forEach(function (r) {
  var k = r.url || '(native)';
  byFile[k] = (byFile[k] || 0) + r.ms;
});
console.log('--- 按文件汇总 Top 10 ---');
Object.keys(byFile).sort(function (a, b) { return byFile[b] - byFile[a]; }).slice(0, 10)
  .forEach(function (k) {
    console.log((byFile[k] / 1000).toFixed(2).padStart(7) + 's  ' + k);
  });
