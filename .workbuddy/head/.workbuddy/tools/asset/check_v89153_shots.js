'use strict';
/* v89.153 像素体检（先量后定）：公文系统页主题色 / 小标签筛选 / 收获 toast
   ------------------------------------------------------------
   量测口径（元素截图 · 深色主题 · 1578×877）：
     · 「主题色」= 与 DATA.MSG_SUBS/TAG_COLOR 逐值比对（容差 26）的像素计数；
     · sys 页分带（实测）：y0-50 页签 / y50-100 chips（各色 chip）/ y100-150 任务摘要头 /
       y150-250 任务摘要行（task）/ y250-300 采集收获行（gather 628）/
       y300-350 天时行（weather 265）/ y350-400 改元行（era 386）/
       y400-450 军情行（war 646）/ y450-500 系统行+分页条（sys 967）
     · era 页消息带（y140-180）：era 242（改元消息）· gather/weather/war = 0（筛选生效）
     · toast（542×72）：暖色（era 3722 + build 916）—— 金色的收获提示条
   跑法：node .workbuddy/tools/asset/check_v89153_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(n, ok, x) {
  if (ok) { PASS++; console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
var COLORS = { era: [237, 208, 138], weather: [143, 208, 232], build: [201, 160, 106],
  gather: [123, 201, 111], war: [224, 168, 60], task: [111, 183, 224], sys: [168, 167, 175] };
function near(px, c, tol) { return Math.abs(px[0] - c[0]) <= tol && Math.abs(px[1] - c[1]) <= tol && Math.abs(px[2] - c[2]) <= tol; }
function scan(png, y0, y1) {
  var out = {};
  Object.keys(COLORS).forEach(function (k) { out[k] = 0; });
  for (var y = y0; y < y1; y++) for (var x = 0; x < png.width; x++) {
    var i = (png.width * y + x) << 2, px = [png.data[i], png.data[i + 1], png.data[i + 2]];
    Object.keys(COLORS).forEach(function (k) { if (near(px, COLORS[k], 26)) out[k]++; });
  }
  return out;
}
function bright(png) {
  var c = 0;
  for (var i = 0; i < png.data.length; i += 4) {
    if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
  }
  return c;
}

var A = load('v89153-doc-sys.png'), B = load('v89153-doc-era.png'), T = load('v89153-gather-toast.png');
console.log('尺寸：sys ' + A.width + '×' + A.height + ' · era ' + B.width + '×' + B.height +
  ' · toast ' + T.width + '×' + T.height);
chk('① 两页同尺寸且非空（>1000px 宽）', A.width === B.width && A.height === B.height && A.width > 1000);

var body = scan(A, 150, 500);      /* sys 页消息带（摘要行 + 消息行 + 分页条） */
console.log('  sys 消息带（y150-500）色分布：' + JSON.stringify(body));
chk('② 系统页消息带出现「采集收获」主题色（gather ≥ 300）', body.gather >= 300, body.gather + ' px');
chk('③ 系统页消息带出现「天时」主题色（weather ≥ 100）', body.weather >= 100, body.weather + ' px');
chk('④ 系统页消息带出现「改元」主题色（era ≥ 100）', body.era >= 100, body.era + ' px');
chk('⑤ 系统页消息带出现「军情」主题色（war ≥ 300）', body.war >= 300, body.war + ' px');
chk('⑥ 系统页消息带出现「系统」主题色（sys ≥ 300）', body.sys >= 300, body.sys + ' px');
var taskBand = scan(A, 150, 260);
chk('⑦ 任务摘要行（task 色 ≥ 200 · 摘要置顶）', taskBand.task >= 200, taskBand.task + ' px');

var chipsBand = scan(A, 50, 100);
console.log('  chips 带（y50-100）色分布：' + JSON.stringify(chipsBand));
chk('⑧ 小标签行 = 多彩（chips 带 ≥ 3 种主题色各 ≥ 100）', (function () {
  var n = 0;
  Object.keys(chipsBand).forEach(function (k) { if (chipsBand[k] >= 100) n++; });
  return n >= 3;
})(), JSON.stringify(chipsBand));

var eraMsg = scan(B, 140, 180);
console.log('  era 页消息带（y140-180）色分布：' + JSON.stringify(eraMsg));
chk('⑨ 切「改元」后消息带只剩改元色（era ≥ 100）', eraMsg.era >= 100, eraMsg.era + ' px');
chk('⑩ 切「改元」后其它主题色消失（gather/weather/war ≤ 20 —— 筛选生效）',
  eraMsg.gather <= 20 && eraMsg.weather <= 20 && eraMsg.war <= 20,
  JSON.stringify({ g: eraMsg.gather, w: eraMsg.weather, wa: eraMsg.war }));

var tb = scan(T, 0, T.height), br = bright(T);
console.log('  toast 色分布：' + JSON.stringify(tb) + ' · 亮像素 ' + br);
chk('⑪ 收获 toast 非空且为暖色提示条（era+build ≥ 2000）', br >= 1000 && (tb.era + tb.build) >= 2000,
  (tb.era + tb.build) + ' px');

console.log('\n===== ' + PASS + ' pass / ' + FAIL + ' fail =====');
process.exit(FAIL ? 1 : 0);
