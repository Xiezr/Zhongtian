/* v89.204 截图像素体检（4 张：强化面板 / 商城底栏分页 / 侧栏民心 / 失城后）
   判据设计（先量后定）：
   ① 强化面板：暗色面板基线（avg 25~70 / bright 0.5%~6%）+ 卡面网格的行投影（≥8 个文字行组）
   ② 商城底栏：底栏带（图底部 ~120px）有"页码文本行" + gold 按钮带
   ③ 侧栏民心：主视图亮 + 左侧栏带金/暖像素（民心数值 + 悬停分解）
   ④ 失城：全屏 + toast/日志区出现"警示色"（红/橙系像素）
   运行：node .workbuddy/tools/asset/check_v89204_shots.js   （输出重定向到文件再读） */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function read(file) {
  var f = OUT + file;
  if (!fs.existsSync(f)) return null;
  return PNG.sync.read(fs.readFileSync(f));
}
function stats(png, x0, y0, x1, y1) {
  var sum = 0, n = 0, bright = 0, gold = 0, warm = 0;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(png.width, x1 == null ? png.width : x1);
  y1 = Math.min(png.height, y1 == null ? png.height : y1);
  for (var y = y0; y < y1; y++) {
    for (var x = x0; x < x1; x++) {
      var i = (y * png.width + x) * 4;
      var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += L; n++;
      if (L > 90) bright++;
      if (r > 150 && g > 110 && b < 110 && (r - b) > 60) gold++;
      if (r > 140 && r - b > 50) warm++;   /* 暖色（金/橙/红系） */
    }
  }
  return { avg: sum / (n || 1), brightPct: bright / (n || 1) * 100, gold: gold, warm: warm, n: n };
}
/* 行投影数文字行组：某行亮像素 ≥ 行宽×0.4% 记一行；连续行合并为"行组" */
function textRows(png, x0, y0, x1, y1) {
  var groups = 0, inRow = false;
  x1 = Math.min(png.width, x1); y1 = Math.min(png.height, y1);
  for (var y = y0; y < y1; y++) {
    var c = 0;
    for (var x = x0; x < x1; x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
    var has = c >= (x1 - x0) * 0.004;
    if (has && !inRow) { groups++; inRow = true; }
    if (!has) inRow = false;
  }
  return groups;
}

/* ① 强化面板（v89204-enh.png：1600×1000） */
(function () {
  var png = read('v89204-enh.png');
  if (!png) return chk('① 强化面板（缺图）', false);
  var all = stats(png, 0, 0);
  console.log('    [enh 全图] avg=' + all.avg.toFixed(1) + ' bright%=' + all.brightPct.toFixed(2)
    + ' gold=' + all.gold + ' 尺寸 ' + png.width + 'x' + png.height);
  chk('①a 强化面板：暗色基线（面板真的渲染了）',
    all.avg > 20 && all.avg < 75 && all.brightPct > 0.5 && all.brightPct < 8,
    'avg=' + all.avg.toFixed(1) + ' bright%=' + all.brightPct.toFixed(2));
  /* 卡片名称行 = 亮线（实测：y≈200/300/400/620 四条 >120 亮；1px 步进逐行数） */
  var nRows = 0;
  for (var y = 180; y < 760; y++) {
    var c = 0;
    for (var x = 220; x < 1380; x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
    if (c >= 120) nRows++;
  }
  chk('①b 卡片名称行亮线 ≥ 12 行（3×5 网格真的画出来了）', nRows >= 12, 'rows=' + nRows);
})();

/* ② 商城底栏分页（v89204-pager.png） */
(function () {
  var png = read('v89204-pager.png');
  if (!png) return chk('② 商城底栏（缺图）', false);
  var bar = stats(png, 100, png.height - 130, png.width - 100, png.height - 10);
  var rows = textRows(png, 300, png.height - 130, png.width - 300, png.height - 10);
  console.log('    [pager 底栏带] avg=' + bar.avg.toFixed(1) + ' bright%=' + bar.brightPct.toFixed(2)
    + ' gold=' + bar.gold + ' 行组=' + rows);
  chk('②a 底栏分页带：有内容（页码文本 + 按钮 · 行组 ≥ 1 且金像素在册）',
    rows >= 1 && bar.gold >= 40, 'rows=' + rows + ' gold=' + bar.gold);
})();

/* ③ 侧栏民心（v89204-hearts.png） */
(function () {
  var png = read('v89204-hearts.png');
  if (!png) return chk('③ 侧栏民心（缺图）', false);
  var all = stats(png, 0, 0);
  /* 左侧栏带（x 0~320）：民心行 + 战争创伤下的数值（金/暖色） */
  var side = stats(png, 0, 100, 330, 700);
  console.log('    [hearts 侧栏带] avg=' + side.avg.toFixed(1) + ' bright%=' + side.brightPct.toFixed(2)
    + ' gold=' + side.gold + ' warm=' + side.warm);
  chk('③a 侧栏带在册（数值/标签像素 + 暖色警示色）',
    side.avg > 15 && side.brightPct > 0.5 && side.warm >= 100,
    'avg=' + side.avg.toFixed(1) + ' warm=' + side.warm);
  chk('③b 全图正常渲染', all.avg > 15 && all.avg < 80, 'avg=' + all.avg.toFixed(1));
})();

/* ④ 失城（v89204-lost.png：战争日志页 · 首条 = 🏴 城陷战报） */
(function () {
  var png = read('v89204-lost.png');
  if (!png) return chk('④ 失城（缺图）', false);
  var all = stats(png, 0, 0);
  /* 报告页条目带（y 100~620）：条目文字行组（亮线）真的画出来了 */
  var mid = stats(png, 200, 100, 1400, 620);
  var nRows = 0;
  for (var y = 100; y < 620; y++) {
    var c = 0;
    for (var x = 200; x < 1400; x++) {
      var i = (y * png.width + x) * 4;
      var L = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      if (L > 90) c++;
    }
    if (c >= 60) nRows++;
  }
  console.log('    [lost 日志页] avg=' + all.avg.toFixed(1) + ' bright%=' + all.brightPct.toFixed(2)
    + ' 中带亮=' + mid.brightPct.toFixed(2) + '% 条目亮线行=' + nRows);
  chk('④a 战争日志页：条目亮线行 ≥ 8（🏴 城陷战报真的渲染了）',
    all.avg > 15 && nRows >= 8, 'rows=' + nRows);
})();

console.log('\n像素体检：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
