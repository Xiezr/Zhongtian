/* v89.157 像素体检：公文徽章/铺满 · 将领条 · 城墙要求 · 逐回合弹窗 · 地块 4×3 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var pass = 0, fail = 0;
function chk(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function count(png, test) { var c = 0; for (var i = 0; i < png.data.length; i += 4) { if (test(png.data[i], png.data[i + 1], png.data[i + 2])) c++; } return c; }
function bandBright(png, y0, y1) {
  var c = 0;
  for (var y = y0; y < y1; y++) for (var x = 0; x < png.width; x++) {
    var i = (png.width * y + x) << 2;
    if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++;
  }
  return c;
}
function rows(png) {
  var out = [], cur = null, need = Math.max(3, Math.round(png.width * 0.004));
  for (var y = 0; y < png.height; y++) {
    var c = 0;
    for (var x = 0; x < png.width; x++) { var i = (png.width * y + x) << 2; if (0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2] > 110) c++; }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

console.log('===== ① 公文 · 系统页（徽章 + 铺满） =====');
var A = load('v89157-doc-sys.png');
chk('图非空（≥1500×850）', A.width >= 1500 && A.height >= 850, A.width + 'x' + A.height);
var gold = count(A, function (r, g, b) { return r > 200 && g > 180 && b < 160 && r - b > 50; });
var purple = count(A, function (r, g, b) { return r > 150 && b > 180 && g < 150 && b - g > 40; });
var cyan = count(A, function (r, g, b) { return g > 150 && b > 150 && r < 140 && g - r > 30; });
var green = count(A, function (r, g, b) { return g > 140 && g - r > 50 && g - b > 40; });
var amber = count(A, function (r, g, b) { return r > 180 && g > 120 && b < 110 && r - b > 80; });
chk('五主题色齐现（改元金/人事紫/市易青/采集绿/军情琥珀 —— 徽章 + 文本上色）',
  gold >= 3000 && purple >= 1200 && cyan >= 4000 && green >= 3000 && amber >= 2500,
  '金=' + gold + ' 紫=' + purple + ' 青=' + cyan + ' 绿=' + green + ' 琥珀=' + amber);
var botBand = bandBright(A, A.height - 40, A.height);
chk('内容到底（底部 40px 有文字行·旧版此处为空白）', botBand >= 1000, '底部带亮像素=' + botBand);

console.log('===== ② 将领页（三条单行 + 进度条） =====');
var B = load('v89157-gen-rows.png');
var barG = count(B, function (r, g, b) { return g > 120 && g - b > 30 && g - r > 20; });
var barB = count(B, function (r, g, b) { return b > 140 && b - r > 40 && b - g > 20; });
chk('图非空 + 进度条色块（体力绿 / 精力蓝 / 忠诚色）', B.width >= 1000 && B.height >= 600 && barG >= 1500 && barB >= 400,
  B.width + 'x' + B.height + ' 绿=' + barG + ' 蓝=' + barB);

console.log('===== ③ 官府 · 城墙要求 =====');
var C = load('v89157-wall-req.png');
var cRows = rows(C).length, cBright = bandBright(C, 0, C.height);
chk('图非空 + 多行文案（城墙要求行在册）', C.width >= 600 && cRows >= 12 && cBright >= 8000,
  C.width + 'x' + C.height + ' 行组=' + cRows + ' 亮=' + cBright);

console.log('===== ④ 逐回合文字复盘 =====');
var D = load('v89157-rounds.png');
var dRows = rows(D).length, dBright = bandBright(D, 0, D.height);
chk('图非空 + 12 行回合 + 头尾（行组 ≥ 10）', D.width >= 900 && dRows >= 10 && dBright >= 15000,
  D.width + 'x' + D.height + ' 行组=' + dRows + ' 亮=' + dBright);

console.log('===== ⑤ 城外地块（4×3 居中） =====');
var E = load('v89157-ext-lv1.png');
var eRows = rows(E).length, eBright = bandBright(E, 0, E.height);
chk('图非空（棋盘 + 12 亮格）', E.width >= 1000 && eRows >= 3 && eBright >= 2000,
  E.width + 'x' + E.height + ' 行组=' + eRows + ' 亮=' + eBright);

console.log('\n===== 像素体检：' + pass + ' pass / ' + fail + ' fail =====');
process.exit(fail ? 1 : 0);
