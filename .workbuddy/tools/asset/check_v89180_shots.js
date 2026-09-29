/* v89.180 像素体检：战场图（v89180-battle）· 悬停图（v89180-tip）
   口径：暗色主题基线 均亮 20~70 / 亮像素 0.5%~8%；另做"下半区文字行"投影检查。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(n, c, e) { if (c) { PASS++; console.log('  ✅ ' + n + (e ? '  [' + e + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (e ? '  [' + e + ']' : '')); } }

['v89180-battle.png', 'v89180-tip.png'].forEach(function (f) {
  var p = PNG.sync.read(fs.readFileSync(S + f));
  var sum = 0, n = 0, bright = 0;
  for (var y = 0; y < p.height; y += 2) for (var x = 0; x < p.width; x += 2) {
    var j = (p.width * y + x) << 2;
    var L = 0.2126 * p.data[j] + 0.7152 * p.data[j + 1] + 0.0722 * p.data[j + 2];
    sum += L; n++; if (L > 110) bright++;
  }
  console.log('== ' + f + ' ' + p.width + 'x' + p.height + ' 均亮=' + (sum / n).toFixed(1) + ' 亮像素=' + (bright / n * 100).toFixed(2) + '%');
  chk(f + ' 尺寸正常', p.width >= 1600 && p.height >= 1000, p.width + 'x' + p.height);
  chk(f + ' 均亮在暗色基线（20~75）', sum / n > 20 && sum / n < 75, (sum / n).toFixed(1));
  chk(f + ' 亮像素占比正常（0.3%~8%）', bright / n > 0.003 && bright / n < 0.08, (bright / n * 100).toFixed(2) + '%');
});

/* 战场图：中部偏下（回合记录区）应有文字行（逐行投影） */
(function () {
  var p = PNG.sync.read(fs.readFileSync(S + 'v89180-battle.png'));
  var y0 = Math.floor(p.height * 0.55), y1 = Math.floor(p.height * 0.98);
  var rows = 0;
  for (var y = y0; y < y1; y += 2) {
    var c = 0;
    for (var x = 0; x < p.width; x += 2) {
      var j = (p.width * y + x) << 2;
      if (0.2126 * p.data[j] + 0.7152 * p.data[j + 1] + 0.0722 * p.data[j + 2] > 110) c++;
    }
    if (c > (p.width / 2) * 0.01) rows++;
  }
  chk('战场图下部（回合记录区）文字行 ≥ 20', rows >= 20, rows + ' 行');
})();

console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
