/* v89.158 像素体检：悬停保持图 + 仓库面板拆账图
   运行：node .workbuddy/tools/asset/check_v89158_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function bright(png, y0, y1, x0, x1) {
  var c = 0;
  for (var y = (y0 || 0); y < Math.min((y1 == null ? png.height : y1), png.height); y++) {
    for (var x = (x0 || 0); x < Math.min((x1 == null ? png.width : x1), png.width); x++) {
      var i = (png.width * y + x) << 2;
      if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
    }
  }
  return c;
}
function rows(png) {
  var out = [], cur = null, need = Math.max(3, Math.round(png.width * 0.004));
  for (var y = 0; y < png.height; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) {
      var i = (png.width * y + x) << 2;
      if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
    }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

console.log('===== v89.158 像素体检 =====');
var A = load('v89158-hover-hold.png');
console.log('hover-hold: ' + A.width + 'x' + A.height + ' 亮像素=' + bright(A) + ' 左侧带=' + bright(A, 0, A.height, 0, 400));
chk('悬停保持图非空（1600×1000 · 亮像素 ≥ 5 万）', A.width === 1600 && A.height === 1000 && bright(A) >= 50000, 'bright=' + bright(A));
chk('侧栏带（x<400）确有内容（亮像素 ≥ 5000）', bright(A, 0, A.height, 0, 400) >= 5000);

var B = load('v89158-store-panel.png');
var rb = rows(B);
console.log('store-panel: ' + B.width + 'x' + B.height + ' 行组=' + rb.length + ' 亮像素=' + bright(B));
console.log('  行组 y: ' + rb.map(function (g) { return g.y0 + '-' + g.y1; }).join(' · '));
chk('仓库面板图非空（亮像素 ≥ 3000）', bright(B) >= 3000);
chk('版式指纹 = 6 行组（标题 + 每级 + 四资源行）', rb.length === 6, 'rows=' + rb.length);
chk('面板宽度合理（600~800）', B.width >= 600 && B.width <= 800, 'w=' + B.width);

console.log('\n结果：' + PASS + ' 过关 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
