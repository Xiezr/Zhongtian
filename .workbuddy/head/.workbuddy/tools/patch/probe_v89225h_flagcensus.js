var fs = require('fs');
var PNG = require('pngjs').PNG;
var R = 'E:/Deepseekdb/';

/* 族旗色（DATA.SERIES[].flag，h/s/l）→ HSL 转 RGB */
function hsl2rgb(h, s, l) {
  h /= 360;
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
}
var FLAG = {
  gov: hsl2rgb(42, 0.60, 0.51), live: hsl2rgb(48, 0.27, 0.87), store: hsl2rgb(34, 0.45, 0.28),
  edu: hsl2rgb(162, 0.48, 0.33), mil: hsl2rgb(215, 0.52, 0.35), biz: hsl2rgb(5, 0.54, 0.50),
  road: hsl2rgb(199, 0.29, 0.56)
};
console.log('族旗色 RGB:', JSON.stringify(FLAG));

/* 建筑全表（从 data.js 抄——已 dump 过） */
var BLDS = {
  guanfu: 'gov', minfang: 'live', shuyuan: 'edu', junying: 'mil', xiaochang: 'mil', shichang: 'biz',
  cangku: 'store', chengqiang: 'mil', yizhan: 'road', fenghuotai: 'mil', majiu: 'store',
  kezhan: 'live', zhaoxianguan: 'edu', honglusi: 'gov', tiejiangpu: 'biz', gongjiangzuofang: 'biz'
};

/* 旗区（flag_bldg_icons.py: px=0.845W=432, 旗面向左 fw=0.20W=102 → x330-432; top=0.612H=313, fh=59 → y313-372）
   采样核心区（避开边缘 AA）：x 340-425, y 318-365 */
function probe(file, ser) {
  if (!fs.existsSync(file)) return { err: 'missing' };
  var png = PNG.sync.read(fs.readFileSync(file));
  var W = png.width, H = png.height;
  var sx0 = Math.round(W * 0.665), sx1 = Math.round(W * 0.83);
  var sy0 = Math.round(H * 0.622), sy1 = Math.round(H * 0.71);
  var n = 0, r = 0, g = 0, b = 0, sat = 0, opq = 0;
  for (var y = sy0; y < sy1; y++) for (var x = sx0; x < sx1; x++) {
    var i = (W * y + x) << 2;
    var a = png.data[i + 3]; if (a < 60) continue;
    opq++;
    r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2];
    var mx = Math.max(png.data[i], png.data[i + 1], png.data[i + 2]);
    var mn = Math.min(png.data[i], png.data[i + 1], png.data[i + 2]);
    sat += mx === mn ? 0 : (mx - mn) / mx;
    n++;
  }
  var avg = n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
  var tgt = FLAG[ser];
  var dist = avg ? Math.round(Math.hypot(avg[0] - tgt[0], avg[1] - tgt[1], avg[2] - tgt[2])) : -1;
  /* 单体性：找该区最大连通近似色域（简化为：属于旗色±90 的像素数） */
  var hit = 0;
  for (var y2 = sy0; y2 < sy1; y2++) for (var x2 = sx0; x2 < sx1; x2++) {
    var j = (W * y2 + x2) << 2;
    if (png.data[j + 3] < 60) continue;
    var d2 = Math.hypot(png.data[j] - tgt[0], png.data[j + 1] - tgt[1], png.data[j + 2] - tgt[2]);
    if (d2 < 90) hit++;
  }
  return { avg: avg, distToFlag: dist, sat: +(sat / Math.max(1, n)).toFixed(3), opq: opq, flagPix: hit };
}

console.log('建筑 | 族 | 旗区均值 | 距旗色 | 饱和 | 不透明px | 似旗px');
Object.keys(BLDS).forEach(function (bid) {
  var f = R + 'assets/icons/ui/ai_' + bid + '.png';
  var s = probe(f, BLDS[bid]);
  console.log(bid + ' | ' + BLDS[bid] + ' | ' + (s.err || (s.avg.join(',') + ' | ' + s.distToFlag + ' | ' + s.sat + ' | ' + s.opq + ' | ' + s.flagPix)));
});
process.exit(0);
