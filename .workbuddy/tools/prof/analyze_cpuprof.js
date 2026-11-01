'use strict';
/* 解析 node --cpu-prof 产物：按「自身采样数」排出热点函数与热点文件。
   为什么不用火焰图 UI：这里只需要回答一个问题 —— **1.3 秒的 newGame 花在哪个函数上**。
   用法：node analyze_cpuprof.js [.cpuprofile] [--top 20] */
var fs = require('fs');
var path = require('path');

var dir = path.join(__dirname, '..', '..', 'tmp', 'cpuprof');
var file = process.argv[2];
if (!file || file[0] === '-') {
  if (!fs.existsSync(dir)) { console.log('没有 prof 目录：' + dir); process.exit(1); }
  var cands = fs.readdirSync(dir).filter(function (f) { return /\.cpuprofile$/.test(f); });
  if (!cands.length) { console.log('目录里没有 .cpuprofile'); process.exit(1); }
  file = path.join(dir, cands[0]);
}
var TOP = 20;
for (var i = 2; i < process.argv.length; i++) if (process.argv[i] === '--top') TOP = Number(process.argv[i + 1]) || 20;

var p = JSON.parse(fs.readFileSync(file, 'utf8'));
var nodes = p.nodes || [];
var totalSamples = (p.samples || []).length || nodes.reduce(function (a, n) { return a + (n.hitCount || 0); }, 0);
if (!totalSamples) { console.log('无采样数据'); process.exit(1); }

var byFn = {};      /* key: url#name */
var byFile = {};
nodes.forEach(function (n) {
  var cf = n.callFrame || {};
  var hit = n.hitCount || 0;
  if (!hit) return;
  var name = cf.functionName || '(anonymous)';
  var url = cf.url || '';
  var short = url ? path.basename(url) : '(native)';
  var k = short + '#' + name;
  if (!byFn[k]) byFn[k] = { name: name, file: short, url: url, line: (cf.lineNumber || 0) + 1, hit: 0 };
  byFn[k].hit += hit;
  if (!byFile[short]) byFile[short] = 0;
  byFile[short] += hit;
});

function pct(v) { return (v / totalSamples * 100).toFixed(1) + '%'; }
var fns = Object.keys(byFn).map(function (k) { return byFn[k]; }).sort(function (a, b) { return b.hit - a.hit; });
var files = Object.keys(byFile).map(function (f) { return { f: f, hit: byFile[f] }; }).sort(function (a, b) { return b.hit - a.hit; });

console.log('采样总数 ' + totalSamples + '（约等于主线程 CPU 时间片）  来源 ' + path.basename(file));
console.log('\n=== 热函数 Top ' + TOP + '（self） ===');
fns.slice(0, TOP).forEach(function (f, i) {
  console.log('  ' + String(i + 1).padStart(2) + '. ' + pct(f.hit).padStart(6)
    + '  ' + String(f.hit).padStart(7) + '  ' + f.file + ':' + f.line + '  ' + f.name.slice(0, 42));
});
console.log('\n=== 热文件 Top 12（self 合计） ===');
files.slice(0, 12).forEach(function (x) {
  console.log('  ' + pct(x.hit).padStart(6) + '  ' + String(x.hit).padStart(7) + '  ' + x.f);
});
var lib = files.filter(function (x) { return /bundle-|three/.test(x.f); });
var libHit = lib.reduce(function (a, x) { return a + x.hit; }, 0);
console.log('\nbundle 内代码合计 ' + pct(libHit) + '；其余（node 运行时/GC/其它）' + pct(totalSamples - libHit));
