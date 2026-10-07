/* v35-e：图集切分流水线 —— 一张 2×2 图集切成 4 个标准透明图标
 * 流程：均分象限 → 抠底 → 按内容 bbox 重裁 → 居中到统一画布
 * 这一步是"降本 75%"的关键：91 张图从 91 次生成降到 23 次。
 */
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const RAW = 'E:/Deepseekdb/assets/icons/raw/';
const UI = 'E:/Deepseekdb/assets/icons/ui/';
const CANVAS = 1024;      // 输出画布
const PAD = 0.06;         // 内容四周留白比例
const MIN_PX = 32;        // 去散点：小于此面积的连通块清零（AI 图集背景噪点残留）

/* 去散点：把"非主体"的漂浮连通块清零（AI 图集背景噪点抠底后的残留小点 → 视觉"毛边"）。
   做法：按 alpha>0 求连通域（含抗锯齿半透明边，使其随主体一起保留），
   面积 < minPx 的连通块整体清零。必须在**最终画布**上做（缩放会把弱 alpha 又切成小点）。 */
function despeckle(png, minPx) {
  const w = png.width, h = png.height, d = png.data;
  const seen = new Uint8Array(w * h);
  const st = new Int32Array(w * h);
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const s0 = sy * w + sx;
      if (seen[s0] || d[s0 * 4 + 3] === 0) continue;
      let sp = 0; st[sp++] = s0; seen[s0] = 1;
      const pts = [];
      while (sp > 0) {
        const p = st[--sp]; pts.push(p);
        const px = p % w, py = (p - px) / w;
        if (px > 0)     { const q = p - 1; if (!seen[q] && d[q * 4 + 3] > 0) { seen[q] = 1; st[sp++] = q; } }
        if (px < w - 1) { const q = p + 1; if (!seen[q] && d[q * 4 + 3] > 0) { seen[q] = 1; st[sp++] = q; } }
        if (py > 0)     { const q = p - w; if (!seen[q] && d[q * 4 + 3] > 0) { seen[q] = 1; st[sp++] = q; } }
        if (py < h - 1) { const q = p + w; if (!seen[q] && d[q * 4 + 3] > 0) { seen[q] = 1; st[sp++] = q; } }
      }
      if (pts.length < minPx) for (const p of pts) d[p * 4 + 3] = 0;
    }
  }
  return png;
}

function matteInPlace(png, ox, oy, w, h) {
  /* 四角采样背景色（在该象限内取） */
  const pts = [[ox + 3, oy + 3], [ox + w - 4, oy + 3], [ox + 3, oy + h - 4], [ox + w - 4, oy + h - 4]];
  const cs = pts.map(pt => { const o = (png.width * pt[1] + pt[0]) * 4; return [png.data[o], png.data[o + 1], png.data[o + 2]]; });
  const bg = [0, 1, 2].map(k => Math.round(cs.reduce((s, c) => s + c[k], 0) / cs.length));
  const T = 46, SOFT = 28;
  for (let y = oy; y < oy + h; y++) {
    for (let x = ox; x < ox + w; x++) {
      const o = (png.width * y + x) * 4;
      const d = Math.abs(png.data[o] - bg[0]) + Math.abs(png.data[o + 1] - bg[1]) + Math.abs(png.data[o + 2] - bg[2]);
      if (d < T) png.data[o + 3] = 0;
      else if (d < T + SOFT) png.data[o + 3] = Math.round(255 * (d - T) / SOFT);
    }
  }
  /* 内容 bbox（按 alpha） */
  let minX = ox + w, minY = oy + h, maxX = ox, maxY = oy, cnt = 0;
  for (let y = oy; y < oy + h; y++) {
    for (let x = ox; x < ox + w; x++) {
      const o = (png.width * y + x) * 4;
      if (png.data[o + 3] < 24) continue;
      cnt++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { bg, minX, minY, maxX, maxY, cnt, area: w * h };
}

function cropCenter(src, box, out) {
  const cw = box.maxX - box.minX + 1, ch = box.maxY - box.minY + 1;
  const scale = (1 - PAD * 2) * CANVAS / Math.max(cw, ch);
  const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
  const dx = Math.round((CANVAS - dw) / 2), dy = Math.round((CANVAS - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = box.minX + Math.floor(x / scale), sy = box.minY + Math.floor(y / scale);
      if (sx > box.maxX || sy > box.maxY) continue;
      const so = (src.width * sy + sx) * 4, dof = (CANVAS * (dy + y) + (dx + x)) * 4;
      out.data[dof] = src.data[so]; out.data[dof + 1] = src.data[so + 1];
      out.data[dof + 2] = src.data[so + 2]; out.data[dof + 3] = src.data[so + 3];
    }
  }
}

/* 用法：node atlas_split.js <图集文件名> <id1,id2,id3,id4> [输出目录]
   象限顺序：左上 / 右上 / 左下 / 右下
   [输出目录] 省略 = 直接落 assets/icons/ui/（老行为）；
   给了则落到该目录（供 wasteland_batch 先装前体检、过了再入库）。 */
const file = process.argv[2];
const ids = (process.argv[3] || '').split(',').map(s => s.trim()).filter(Boolean);
const outArg = process.argv[4];
const OUT = outArg ? (outArg.replace(/[\\/]+$/, '') + '/') : UI;
if (!file || !ids.length) { console.log('用法: node atlas_split.js <图集.png> <id1,id2,id3,id4> [输出目录]'); process.exit(1); }
if (outArg) fs.mkdirSync(OUT, { recursive: true });

const src = PNG.sync.read(fs.readFileSync(RAW + file));
const HW = Math.floor(src.width / 2), HH = Math.floor(src.height / 2);
const quads = [
  ['左上', 0, 0], ['右上', HW, 0], ['左下', 0, HH], ['右下', HW, HH],
];
console.log('图集 ' + file + '  ' + src.width + 'x' + src.height + ' → 象限 ' + HW + 'x' + HH);

ids.forEach((id, i) => {
  if (i >= 4) return;
  const [qname, ox, oy] = quads[i];
  const working = PNG.sync.read(fs.readFileSync(RAW + file));   // 每象限独立处理
  const r = matteInPlace(working, ox, oy, HW, HH);
  const out = new PNG({ width: CANVAS, height: CANVAS });
  cropCenter(working, r, out);
  despeckle(out, MIN_PX);                                      // 去散点（最终画布）
  fs.writeFileSync(OUT + 'ai_' + id + '.png', PNG.sync.write(out));
  const cw = r.maxX - r.minX + 1, ch = r.maxY - r.minY + 1;
  console.log('  ' + qname + ' → ai_' + id + '.png   背景#' + r.bg.map(v => v.toString(16).padStart(2, '0')).join('')
    + '  内容 ' + cw + 'x' + ch + '（占象限 ' + (cw / HW * 100).toFixed(0) + '%x' + (ch / HH * 100).toFixed(0) + '%）'
    + (cw / HW > 0.94 && ch / HH > 0.94 ? '  ⚠可能切到邻格' : ''));
});
console.log('完成 ' + Math.min(ids.length, 4) + ' 张');
