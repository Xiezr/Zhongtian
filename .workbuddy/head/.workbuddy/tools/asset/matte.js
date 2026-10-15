/* v35-b：AI 生成图的背景检测 + 抠底（四角采样 → 距离阈值 → alpha 归零） */
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const RAW = 'E:/Deepseekdb/assets/icons/raw/';
const OUTD = 'E:/Deepseekdb/assets/icons/ui/';

function hex(r, g, b) { return '#' + ((r << 16 | g << 8 | b).toString(16)).padStart(6, '0'); }

function cornerColors(png) {
  const pts = [[3, 3], [png.width - 4, 3], [3, png.height - 4], [png.width - 4, png.height - 4]];
  return pts.map(pt => {
    const i = (png.width * pt[1] + pt[0]) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
  });
}

fs.mkdirSync(OUTD, { recursive: true });
const files = fs.readdirSync(RAW).filter(f => f.endsWith('.png'));
console.log('=== 背景检测 ===');
const info = files.map((f, idx) => {
  const png = PNG.sync.read(fs.readFileSync(RAW + f));
  const cs = cornerColors(png);
  const avg = [0, 1, 2].map(k => Math.round(cs.reduce((s, c) => s + c[k], 0) / cs.length));
  const spread = Math.max(...cs.map(c => Math.abs(c[0] - avg[0]) + Math.abs(c[1] - avg[1]) + Math.abs(c[2] - avg[2])));
  console.log('  ' + f.slice(-12) + '  四角=' + cs.map(c => hex(c[0], c[1], c[2])).join(' ') + '  一致性偏差=' + spread);
  return { f, png, bg: avg, spread };
});

/* 抠底：离背景色近的 → 透明；边缘留 8 级羽化避免锯齿 */
console.log('=== 抠底 ===');
info.forEach((it, idx) => {
  const png = it.png, n = png.width * png.height;
  const T = 42, SOFT = 26;
  let cleared = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.abs(png.data[o] - it.bg[0]) + Math.abs(png.data[o + 1] - it.bg[1]) + Math.abs(png.data[o + 2] - it.bg[2]);
    if (d < T) { png.data[o + 3] = 0; cleared++; }
    else if (d < T + SOFT) { png.data[o + 3] = Math.round(255 * (d - T) / SOFT); }
  }
  const name = 'ai_' + (idx === 0 ? 'guanfu' : 'infantry') + '.png';
  fs.writeFileSync(OUTD + name, PNG.sync.write(png));
  console.log('  ' + name + '  清除像素=' + (cleared / n * 100).toFixed(1) + '%');
});

/* 复检 */
console.log('=== 抠后复检 ===');
fs.readdirSync(OUTD).filter(f => f.endsWith('.png')).forEach(f => {
  const png = PNG.sync.read(fs.readFileSync(OUTD + f));
  let t = 0, o = 0, sat = 0;
  const colors = new Set();
  let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (png.width * y + x) * 4;
    if (png.data[i + 3] < 24) { t++; continue; }
    o++;
    colors.add((png.data[i] << 16 | png.data[i + 1] << 8 | png.data[i + 2]).toString(16));
    const mx = Math.max(png.data[i], png.data[i + 1], png.data[i + 2]);
    const mn = Math.min(png.data[i], png.data[i + 1], png.data[i + 2]);
    if (mx > 55 && mx - mn > 26) sat++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  console.log('  ' + f + '  透底=' + (t / (png.width * png.height) * 100).toFixed(1) + '%  颜色数=' + colors.size
    + '  彩色=' + (sat / Math.max(1, o) * 100).toFixed(1) + '%  主体占宽=' + ((maxX - minX) / png.width * 100).toFixed(0)
    + '%  主体占高=' + ((maxY - minY) / png.height * 100).toFixed(0) + '%');
});
