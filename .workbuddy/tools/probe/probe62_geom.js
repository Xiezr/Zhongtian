const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const check = (n, ok, ex) => out.push([ok ? 'OK  ' : 'FAIL', n, ex || '']);
  for (const vp of [[1600, 950], [1366, 768], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1400);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程'); await p.waitForTimeout(2000);
    const tag = vp[0] + 'x' + vp[1];
    const r = await p.evaluate(() => {
      const G = GAME, s = G.state, c = s.cities[0];
      let slot = -1;
      c.cells.forEach((x, i) => { if (slot < 0 && !x.official) slot = i; });
      c.cells[slot].build = { id: 'gongjiangzuofang', lvl: 8 };
      c.wallLv = 8; c.def = 30;
      c.res = { grain: 9e6, wood: 9e6, stone: 9e6, iron: 9e6, gold: 9e6, pop: 20000 };
      G.ui._cityId = c.id; G.refreshAll();
      G.buildTowers(c.id, 6);
      G.ui.openWorkshop(slot);
      const m = document.querySelector('.modal .inner-panel');
      const body = document.querySelector('.modal .m-body') || m;
      const txt = m ? m.textContent : '';
      return {
        over: m ? (m.getBoundingClientRect().bottom > window.innerHeight + 1) : null,
        scroll: body ? body.scrollHeight > body.clientHeight + 2 : null,
        chips: document.querySelectorAll('.modal [data-action="tower-build"]').length,
        hasSrc: txt.indexOf('城防折出') >= 0 && txt.indexOf('作坊自建') >= 0,
        hasSiege: txt.indexOf('制造器械') >= 0,
        hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    await p.waitForTimeout(400);
    check(tag + ' 作坊面板不溢出屏幕', r.over === false);
    check(tag + ' 作坊面板无内部滚动条', r.scroll === false);
    check(tag + ' 建造 chips 存在', r.chips >= 1, r.chips + ' 个');
    check(tag + ' 箭塔两个来源都写清楚', r.hasSrc === true);
    check(tag + ' 器械入口仍在', r.hasSiege === true);
    check(tag + ' 无横向滚动条', r.hScroll === false);
    await p.close();
  }
  await b.close();
  const bad = out.filter(x => x[0] === 'FAIL');
  out.forEach(x => console.log('  ' + x[0] + ' ' + x[1] + (x[2] ? '  [' + x[2] + ']' : '')));
  console.log('\n几何探针：' + (out.length - bad.length) + ' 通过 / ' + bad.length + ' 失败');
})();
