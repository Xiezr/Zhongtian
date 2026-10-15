/* v89.176 像素体检（快速）：两张实机图非空 + 暗色主题基线 + 结构带亮度
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89176_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(n, c, e) { if (c) { PASS++; console.log('  ✅ ' + n + (e ? '  [' + e + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (e ? '  [' + e + ']' : '')); } }

['v89176-battle.png', 'v89176-sandbox.png'].forEach(function (f) {
  var fp = S + f;
  var size = fs.statSync(fp).size;
  var p = PNG.sync.read(fs.readFileSync(fp));
  var n = 0, sum = 0, bright = 0;
  for (var y = 0; y < p.height; y += 3) for (var x = 0; x < p.width; x += 3) {
    var j = (p.width * y + x) << 2;
    var L = 0.2126 * p.data[j] + 0.7152 * p.data[j + 1] + 0.0722 * p.data[j + 2];
    sum += L; n++; if (L > 110) bright++;
  }
  var avg = sum / n, bp = bright / n * 100;
  console.log('== ' + f + '  ' + p.width + 'x' + p.height + '  ' + Math.round(size / 1024) + 'KB  均亮 ' + avg.toFixed(1) + ' · 亮像素 ' + bp.toFixed(2) + '%');
  chk('非空图 + 暗色主题基线（尺寸对 + 均亮 20~80 + 亮像素 0.3%~10%）',
    size > 40000 && avg > 20 && avg < 80 && bp > 0.3 && bp < 10,
    avg.toFixed(1) + ' / ' + bp.toFixed(2) + '%');
});

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
