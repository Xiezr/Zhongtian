/* v15789 P0 像素体检：改前 vs 改后（三角度）
   量四样（全在"球体所在的中央区域"，避开顶栏/底栏/黑背景）：
     ① 平均亮度   ② 亮像素占比(>200)   ③ 过曝/削顶占比(三通道≥250)   ④ 局部对比度（Sobel 梯度均值）
   ④ 是"地形有没有立体感"的客观代理：法线参与受光后，起伏处的明暗梯度必然上升。
   用法：node .workbuddy/tools/asset/check_v15789_p0.js */
const fs = require('fs');
const { PNG } = require('pngjs');

const DIR = '.workbuddy/tmp/';
const TAGS = ['a', 'b', 'c'];
/* 中央区域：球体在 1280×720 视口里大致落在 x 210~870 / y 55~560（三角度略有差异，取交集附近） */
const X0 = 300, X1 = 800, Y0 = 90, Y1 = 540;

function stat(p) {
  const png = PNG.sync.read(fs.readFileSync(p));
  let lum = 0, bright = 0, clip = 0, n = 0;
  const hist = new Float64Array(256);
  const W = png.width, H = png.height;
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const o = (y * W + x) * 4;
      const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum += L; hist[Math.min(255, Math.max(0, Math.round(L)))]++; n++;
      if (L > 200) bright++;
      if (r >= 250 && g >= 250 && b >= 250) clip++;
    }
  }
  /* Sobel 梯度（只取水平方向即可代表"明暗起伏"；4 邻域简化） */
  let grad = 0, gn = 0;
  for (let y = Y0 + 1; y < Y1 - 1; y++) {
    for (let x = X0 + 1; x < X1 - 1; x++) {
      const o = (y * W + x) * 4, orr = o + 4, ol = o - 4, od = o + W * 4, ou = o - W * 4;
      const L = 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
      const Lr = 0.2126 * png.data[orr] + 0.7152 * png.data[orr + 1] + 0.0722 * png.data[orr + 2];
      const Ll = 0.2126 * png.data[ol] + 0.7152 * png.data[ol + 1] + 0.0722 * png.data[ol + 2];
      const Ld = 0.2126 * png.data[od] + 0.7152 * png.data[od + 1] + 0.0722 * png.data[od + 2];
      const Lu = 0.2126 * png.data[ou] + 0.7152 * png.data[ou + 1] + 0.0722 * png.data[ou + 2];
      grad += Math.abs(Lr - Ll) + Math.abs(Ld - Lu);
      gn++;
    }
  }
  let acc = 0, p90 = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.9) { p90 = i; break; } }
  return {
    mean: +(lum / n).toFixed(1),
    p90: p90,
    brightPct: +(100 * bright / n).toFixed(2),
    clipPct: +(100 * clip / n).toFixed(3),
    grad: +(grad / gn).toFixed(2)
  };
}

let fail = 0;
console.log('view  before{mean,bright%,clip%,grad}  after{…}   判定（okDark 看 P90，不再看 mean）');
for (const t of TAGS) {
  const b = stat(DIR + 'v15789_p0_before_' + t + '.png');
  const a = stat(DIR + 'v15789_p0_after_' + t + '.png');
  const dGrad = +(((a.grad - b.grad) / (b.grad || 1)) * 100).toFixed(1);
  const dMean = +(a.mean - b.mean).toFixed(1);
  /* 判据：① 局部对比度上升（立体感受光的客观代理）② 不整体变暗超过 12 ③ 削顶不超 0.5% */
  const okGrad = a.grad > b.grad * 1.05;
  /* v157.89b：判据从"平均亮度"改为"高亮端 P90"。
     理由：浮雕明暗**必然**压暗谷地 → 均值下降是设计的预期结果，不是"变暗了"。
     "整幅变暗"的正确观测是"亮的地方还亮不亮"，即高分位；均值只作为旁证打印。*/
  const okDark = a.p90 >= b.p90 * 0.95;
  const okClip = a.clipPct < 0.5;
  const pass = okGrad && okDark && okClip;
  if (!pass) fail++;
  console.log(
    ' ' + t + '   {' + b.mean + ',' + b.brightPct + ',' + b.clipPct + ',' + b.grad + '}' +
    '  {' + a.mean + ',' + a.brightPct + ',' + a.clipPct + ',' + a.grad + '}' +
    '  grad' + (dGrad >= 0 ? '+' : '') + dGrad + '% mean' + (dMean >= 0 ? '+' : '') + dMean +
    ' P90 ' + b.p90 + '→' + a.p90 +
    '  ' + (pass ? 'PASS' : 'FAIL[' + (okGrad ? '' : '对比度未升 ') + (okDark ? '' : '整体过暗 ') + (okClip ? '' : '削顶超标') + ']')
  );
}
console.log(fail === 0 ? 'RESULT: ALL PASS' : 'RESULT: ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
