/* 第二轮像素取证：把海区（画面左侧 82%）里所有像素按颜色分桶，找出"第二种颜色"到底是什么。
   输出 top 24 颜色桶（RGB + 占比 + 坐标范围）。 */
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
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const W = img.width, H = img.height;
    const d = g.getImageData(0, 0, W, H).data;
    const buckets = {};
    let n = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W * 0.82; x += 2) {
        const i = (y * W + x) * 4;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        n++;
        const k = (r >> 4) + '_' + (gg >> 4) + '_' + (b >> 4);
        if (!buckets[k]) buckets[k] = { cnt: 0, sr: 0, sg: 0, sb: 0, x0: 1e9, x1: -1, y0: 1e9, y1: -1 };
        const B = buckets[k];
        B.cnt++; B.sr += r; B.sg += gg; B.sb += b;
        if (x < B.x0) B.x0 = x; if (x > B.x1) B.x1 = x;
        if (y < B.y0) B.y0 = y; if (y > B.y1) B.y1 = y;
      }
    }
    const list = Object.keys(buckets).map(function (k) {
      const B = buckets[k];
      return { k: k, pct: +(B.cnt / n * 100).toFixed(2), rgb: [Math.round(B.sr / B.cnt), Math.round(B.sg / B.cnt), Math.round(B.sb / B.cnt)],
        box: [B.x0, B.y0, B.x1, B.y1], cnt: B.cnt };
    }).sort(function (a, b) { return b.cnt - a.cnt; });
    return { W: W, H: H, n: n, top: list.slice(0, 24), total: list.length };
  }, 'file:///E:/Deepseekdb/.workbuddy/tmp/v15784_step_56.png');

  console.log('尺寸 ' + out.W + 'x' + out.H + ' · 海区采样 ' + out.n + ' · 颜色桶 ' + out.total);
  out.top.forEach(function (t, i) {
    console.log((i + 1) + '. ' + t.pct + '%  RGB(' + t.rgb.join(',') + ')  区域 x' + t.box[0] + '-' + t.box[2] + ' y' + t.box[1] + '-' + t.box[3]);
  });
  await browser.close();
})();
