/* ============================================================
 * verify_v89102_troop_icons.js — 兵种图标「体检」（素材管线 · 六之验证）
 * ------------------------------------------------------------
 * 为什么要有它：沙盘/战场的令牌、募兵卡都直接吃 assets/icons/ui/ai_<troop>.png，
 * 而"素材登记表在册"并不等于"文件在盘上、且不是空图" ——
 * 图集流水线吃过这个亏（AI 漏画一个象限 → 切出来是空 PNG，界面开天窗）。
 *
 * 判据（对 18 个兵种逐个跑）：
 *   · 文件在盘上 + 体积 > 1KB（0 字节/截断的 PNG 直接红）
 *   · 可解码 + 尺寸一致（同批素材应同尺寸，避免混入异源图）
 *   · 不透明像素占比落在 [DATA-ASSET.minA, maxA]：太小=没画像，太大=没抠底
 *   · 内容包围盒不能贴边（贴边=没裁干净，切图时四边会带邻格残影）
 * 用法：node .workbuddy/tools/asset/verify_v89102_troop_icons.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
var PNG = null;
try { PNG = require('pngjs').PNG; } catch (e) {
  /* 落到托管环境（项目侧无 node_modules） */
  module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
  PNG = require('pngjs').PNG;
}

var DATA = fs.readFileSync(path.join(R, 'js', 'data.js'), 'utf8');
/* 兵种 id：**只在 DATA.TROOPS 表内**抓（唯一来源，不另抄一份）
   ⚠️ 第一版全文件正则把装备槽（yt_*）/ 天气（clear/rain…）也吃进来了 54 条 ——
      定位到表头、按 `  };` 收尾，才是"这张表里的兵种"。 */
var head = DATA.indexOf('DATA.TROOPS = {');
if (head < 0) { console.log('未能定位 DATA.TROOPS（data.js 结构变了？）'); process.exit(2); }
var tail = DATA.indexOf('\n  };', head);
if (tail < 0) tail = DATA.length;
var block = DATA.slice(head, tail);
var ids = [];
var re = /^\s{4}([a-z_]+):\s*\{\s*id:\s*'([a-z_]+)',[^\n]*name:\s*'([^']+)'/gm;
var m;
while ((m = re.exec(block)) !== null) {
  if (ids.indexOf(m[2]) < 0) ids.push(m[2]);
}
console.log('DATA.TROOPS 兵种数 =', ids.length, '→', ids.join(', '));

var DIR = path.join(R, 'assets', 'icons', 'ui');
var bad = [], sizes = {}, ok = 0;
ids.forEach(function (id) {
  var f = path.join(DIR, 'ai_' + id + '.png');
  if (!fs.existsSync(f)) { bad.push(id + '：文件缺失'); return; }
  var st = fs.statSync(f);
  if (st.size < 1024) { bad.push(id + '：体积异常 ' + st.size + 'B'); return; }
  var png;
  try { png = PNG.sync.read(fs.readFileSync(f)); }
  catch (e) { bad.push(id + '：解码失败 ' + e.message); return; }
  var n = png.width * png.height, opaque = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
      var a = png.data[(y * png.width + x) * 4 + 3];
      if (a > 24) {
        opaque++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  var cov = opaque / n;
  var key = png.width + 'x' + png.height;
  sizes[key] = (sizes[key] || 0) + 1;
  var touch = (minX <= 1 || minY <= 1 || maxX >= png.width - 2 || maxY >= png.height - 2);
  var issues = [];
  if (cov < 0.05) issues.push('内容占比 ' + cov.toFixed(3) + ' 过小（疑似空图）');
  if (cov > 0.97) issues.push('内容占比 ' + cov.toFixed(3) + ' 过大（疑似没抠底）');
  if (touch) issues.push('内容贴边（裁切不干净）');
  if (issues.length) bad.push(id + '：' + issues.join('；'));
  else ok++;
  console.log('  ' + (issues.length ? '❌' : '✅') + ' ' + id.padEnd(16)
    + ' ' + key + '  ' + (st.size / 1024).toFixed(0) + 'KB  内容占比 ' + cov.toFixed(3));
});

console.log('\n尺寸分布 =', JSON.stringify(sizes));
console.log('体检结果：' + ok + ' / ' + ids.length + ' 通过' + (bad.length ? ('　问题 ' + bad.length + '：\n  - ' + bad.join('\n  - ')) : ''));
process.exit(bad.length ? 1 : 0);
