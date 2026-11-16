/* 用浏览器解码截图，做像素统计（本机无 PIL / Add-Type 被拦）：
   · 全图颜色分类（海蓝 / 陆地绿 / 暖色斑块 / 其他）
   · 16×16 块热点图：暖色像素占比高的块 → 斑块位置与代表色
   · 海区内亮度分布（判断"雾状斑驳"是否显著）
   只报数据，不做判断。 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files']
  });
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  const out = await p.evaluate(async function (src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const W = img.width, H = img.height;
    const d = g.getImageData(0, 0, W, H).data;
    let blue = 0, green = 0, warm = 0, other = 0, n = 0;
    const lumHist = new Array(16).fill(0);
    const warmPts = [];
    const blocks = {};
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        n++;
        const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
        lumHist[Math.min(15, Math.floor(lum / 16))]++;
        let cls;
        if (r > 110 && r > b + 30 && gg > b + 10) { cls = 'warm'; warm++; }
        else if (b > r + 10 && b > 55) { cls = 'blue'; blue++; }
        else if (gg > r + 20 && gg > b + 10) { cls = 'green'; green++; }
        else { cls = 'other'; other++; }
        if (cls === 'warm') {
          warmPts.push([x, y]);
          const k = Math.floor(x / 32) + ',' + Math.floor(y / 32);
          if (!blocks[k]) blocks[k] = { cnt: 0, sx: 0, sy: 0, sr: 0, sg: 0, sb: 0 };
          const B = blocks[k]; B.cnt++; B.sx += x; B.sy += y; B.sr += r; B.sg += gg; B.sb += b;
        }
      }
    }
    const hot = Object.keys(blocks).map(function (k) {
      const B = blocks[k];
      return { k: k, cnt: B.cnt, cx: Math.round(B.sx / B.cnt), cy: Math.round(B.sy / B.cnt),
        rgb: [Math.round(B.sr / B.cnt), Math.round(B.sg / B.cnt), Math.round(B.sb / B.cnt)] };
    }).sort(function (a, b) { return b.cnt - a.cnt; }).slice(0, 14);
    return { W: W, H: H, n: n, blue: blue, green: green, warm: warm, other: other, lumHist: lumHist, hot: hot };
  }, 'file:///C:/Users/18811/.workbuddy/clipboard-images/clipboard-2026-11-16T10-41-07-169Z-cc0aaf9f.png');

  console.log('尺寸 = ' + out.W + 'x' + out.H + ' · 采样 ' + out.n);
  console.log('分类 海蓝=' + out.blue + ' (' + (out.blue / out.n * 100).toFixed(1) + '%)'
    + ' 绿=' + out.green + ' (' + (out.green / out.n * 100).toFixed(1) + '%)'
    + ' 暖色斑=' + out.warm + ' (' + (out.warm / out.n * 100).toFixed(2) + '%)'
    + ' 其他=' + out.other + ' (' + (out.other / out.n * 100).toFixed(1) + '%)');
  console.log('亮度直方图(16 档) = ' + out.lumHist.join(','));
  console.log('暖色斑块热点（32px 块）：');
  out.hot.forEach(function (h) {
    console.log('  中心(' + h.cx + ',' + h.cy + ') 像素数=' + h.cnt + ' 平均 RGB=' + h.rgb.join(','));
  });
  await browser.close();
})();
