/* v35-c：AI 原图 → 按 id 重命名 → 抠底 → 输出 ui/；并做风格一致性复检 */
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const RAW = 'E:/Deepseekdb/assets/icons/raw/';
const UI = 'E:/Deepseekdb/assets/icons/ui/';
fs.mkdirSync(UI, { recursive: true });

/* 按生成时间排序 → 映射 id（生成顺序即此表顺序） */
const ORDER = ['guanfu', 'infantry_tmp', 'minfang', 'shuyuan', 'junying', 'xiaochang'];
const CN_NAME = { guanfu: '官府', infantry_tmp: '汉代甲士(样本)', minfang: '民房', shuyuan: '书院', junying: '兵营', xiaochang: '校场' };

const files = fs.readdirSync(RAW).filter(f => f.endsWith('.png'))
  .map(f => ({ f, t: fs.statSync(RAW + f).mtimeMs }))
  .sort((a, b) => a.t - b.t);

console.log('=== 重命名 + 抠底 ===');
const done = [];
files.forEach((it, i) => {
  const id = ORDER[i] || ('unknown' + i);
  const png = PNG.sync.read(fs.readFileSync(RAW + it.f));
  /* 四角采样背景色 */
  const pts = [[3, 3], [png.width - 4, 3], [3, png.height - 4], [png.width - 4, png.height - 4]];
  const cs = pts.map(pt => { const o = (png.width * pt[1] + pt[0]) * 4; return [png.data[o], png.data[o + 1], png.data[o + 2]]; });
  const bg = [0, 1, 2].map(k => Math.round(cs.reduce((s, c) => s + c[k], 0) / cs.length));
  const spread = Math.max(...cs.map(c => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2])));

  /* 抠底 */
  const T = 42, SOFT = 26;
  let cleared = 0;
  for (let k = 0; k < png.width * png.height; k++) {
    const o = k * 4;
    const d = Math.abs(png.data[o] - bg[0]) + Math.abs(png.data[o + 1] - bg[1]) + Math.abs(png.data[o + 2] - bg[2]);
    if (d < T) { png.data[o + 3] = 0; cleared++; }
    else if (d < T + SOFT) { png.data[o + 3] = Math.round(255 * (d - T) / SOFT); }
  }
  const outName = 'ai_' + id + '.png';
  fs.writeFileSync(UI + outName, PNG.sync.write(png));

  /* 复检 */
  let t = 0, o2 = 0, sat = 0;
  const colors = new Set();
  let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const o = (png.width * y + x) * 4;
    if (png.data[o + 3] < 24) { t++; continue; }
    o2++;
    colors.add((png.data[o] << 16 | png.data[o + 1] << 8 | png.data[o + 2]).toString(16));
    const mx = Math.max(png.data[o], png.data[o + 1], png.data[o + 2]);
    const mn = Math.min(png.data[o], png.data[o + 1], png.data[o + 2]);
    if (mx > 55 && mx - mn > 26) sat++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const tot = png.width * png.height;
  const w = ((maxX - minX) / png.width * 100).toFixed(0);
  const h = ((maxY - minY) / png.height * 100).toFixed(0);
  const flag = (+w >= 99 && +h >= 99) ? '  ⚠主体满框(背景可能没抠净)' : '';
  console.log('  ' + id.padEnd(14) + ' 背景#' + bg.map(v => v.toString(16).padStart(2, '0')).join('')
    + ' 偏' + String(spread).padStart(3) + '  抠除' + (cleared / tot * 100).toFixed(0).padStart(2) + '%'
    + '  透底' + (t / tot * 100).toFixed(0).padStart(2) + '%  色' + String(colors.size).padStart(6)
    + '  主体' + w + '%x' + h + '%' + flag);
  done.push({ id, name: CN_NAME[id] || id, file: outName, colors: colors.size });
});
fs.writeFileSync('E:/Deepseekdb/.workbuddy/tmp/ai_index.json', JSON.stringify(done, null, 1));
console.log('\n完成 ' + done.length + ' 张 → assets/icons/ui/');
