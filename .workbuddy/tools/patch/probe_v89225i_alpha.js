var fs = require('fs');
var PNG = require('pngjs').PNG;
var R = 'E:/Deepseekdb/';

/* 检查旗区域透明性：旗是不是画在透明底上（决定"去旗"是否安全） */
function alphaProbe(f) {
  var png = PNG.sync.read(fs.readFileSync(f));
  var W = png.width, H = png.height;
  function alphaAt(x, y) { return png.data[((W * y + x) << 2) + 3]; }
  /* 旗几何（flag_bldg_icons.py）：杆顶(432,307) 杆长153 杆宽6；旗面 x330-432 y313-372；底座 ~y460-465 */
  var samples = {
    '旗面中心(380,340)': [380, 340],
    '旗内左(345,340)': [345, 340],
    '旗内右(420,340)': [420, 340],
    '旗上沿外(380,300)': [380, 300],
    '旗下沿外(380,380)': [380, 380],
    '旗左外(315,340)': [315, 340],
    '旗右外(445,340)': [445, 340],
    '杆中(435,380)': [435, 380],
    '杆底(435,455)': [435, 455],
    '底座(433,462)': [433, 462],
    '杆底外(435,475)': [435, 475],
    '左上区(150,150)': [150, 150],
    '右下角外(480,480)': [480, 480]
  };
  var out = {};
  Object.keys(samples).forEach(function (k) {
    var p = samples[k];
    out[k] = alphaAt(p[0], p[1]);
  });
  return out;
}

['ai_zhaoxianguan', 'ai_junying', 'ai_guanfu', 'ai_kezhan'].forEach(function (nm) {
  console.log('===== ' + nm + ' =====');
  console.log(JSON.stringify(alphaProbe(R + 'assets/icons/ui/' + nm + '.png')));
});

/* 精确色匹配统计：旗色/深木/暗色 在整图的像素数（判断是否可精确抠除） */
function colorMatch(f, targets) {
  var png = PNG.sync.read(fs.readFileSync(f));
  var cnt = targets.map(function () { return 0; });
  for (var i = 0; i < png.data.length; i += 4) {
    for (var t = 0; t < targets.length; t++) {
      var c = targets[t];
      if (Math.abs(png.data[i] - c[0]) <= 12 && Math.abs(png.data[i + 1] - c[1]) <= 12 && Math.abs(png.data[i + 2] - c[2]) <= 12) { cnt[t]++; break; }
    }
  }
  return cnt;
}

console.log();
console.log('===== 精确色匹配（旗色 / 深木 92,62,38 / 暗色） =====');
var FLAG_RGB = { gov: [205, 160, 55], live: [231, 227, 213], store: [104, 76, 39], edu: [44, 125, 100], mil: [43, 82, 136], biz: [196, 70, 59], road: [110, 155, 175] };
var SER = { guanfu: 'gov', minfang: 'live', shuyuan: 'edu', junying: 'mil', xiaochang: 'mil', shichang: 'biz', cangku: 'store', chengqiang: 'mil', yizhan: 'road', fenghuotai: 'mil', majiu: 'store', kezhan: 'live', zhaoxianguan: 'edu', honglusi: 'gov', tiejiangpu: 'biz', gongjiangzuofang: 'biz' };
Object.keys(SER).forEach(function (bid) {
  var f = R + 'assets/icons/ui/ai_' + bid + '.png';
  var fc = FLAG_RGB[SER[bid]];
  var dark = [Math.round(fc[0] * 0.55), Math.round(fc[1] * 0.55), Math.round(fc[2] * 0.55)];
  var c = colorMatch(f, [fc, [92, 62, 38], dark]);
  console.log(bid + ' |旗色像素=' + c[0] + ' |深木=' + c[1] + ' |暗线=' + c[2]);
});
process.exit(0);
