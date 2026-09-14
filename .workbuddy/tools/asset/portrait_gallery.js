/* 头像画廊：渲染多种资质+性别的程序化头像 */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForTimeout(800);
  const html = await page.evaluate(() => {
    const P = window.GAME.portraits;
    const ranks = ['fan', 'liang', 'ying', 'ming', 'tian'];
    const samples = [];
    let seed = 12345;
    for (let r of ranks) {
      for (let sex of [0, 1]) {
        const g = { name: '示例' + r + sex, rank: r, gender: sex ? 'female' : 'male', yw: 60, zm: 60, tong: 60, nz: 60, portraitSeed: seed++ };
        if (r === 'tian') { g.yw = 99; g.zm = 99; g.tong = 99; g.nz = 99; }
        samples.push({ label: r + (sex ? '/女' : '/男'), svg: P.svg(g, 140) });
      }
    }
    // 不同四维主色（统率 vs 勇武 vs 智谋 vs 内政）
    const dims = [
      { yw: 100, zm: 50, tong: 60, nz: 60, label: '勇武主' },
      { yw: 60, zm: 100, tong: 60, nz: 60, label: '智谋主' },
      { yw: 60, zm: 60, tong: 100, nz: 60, label: '统率主' },
      { yw: 60, zm: 60, tong: 60, nz: 100, label: '内政主' },
    ];
    dims.forEach((d, i) => samples.push({ label: d.label, svg: P.svg({ name: 'd' + i, rank: 'ying', gender: 'male', portraitSeed: 90000 + i, ...d }, 140) }));

    return '<style>' +
      'body{background:#1c1610;margin:0;padding:16px;font:12px/1.3 "Microsoft YaHei",sans-serif;color:#c9b389}' +
      '.wrap{display:flex;flex-wrap:wrap;gap:10px}' +
      '.cell{width:140px;text-align:center}' +
      '.art{margin:0 auto 4px;box-shadow:0 4px 12px rgba(0,0,0,.4)}' +
      '.lbl{color:#a08c66;margin-top:2px}' +
      '</style><div class="wrap">' + samples.map(s => '<div class="cell"><div class="art">' + s.svg + '</div><div class="lbl">' + s.label + '</div></div>').join('') + '</div>';
  });
  await page.setContent(html);
  await page.screenshot({ path: 'E:/Deepseekdb/.workbuddy/tmp/v31-portraits.png', fullPage: true });
  await browser.close();
  console.log('PORTRAIT_OK');
})().catch(e => { console.error(e.message); process.exit(1); });