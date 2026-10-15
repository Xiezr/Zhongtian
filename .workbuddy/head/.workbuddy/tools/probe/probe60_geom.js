/* v60 真实浏览器几何探针：老板的硬规矩（弹窗不许出现滚动条、内容不许溢出） */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const check = (n, ok, extra) => { out.push([ok ? 'OK  ' : 'FAIL', n, extra || '']); };

  for (const vp of [[1600, 950], [1366, 768], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1400);
    const ni = await p.$('input[placeholder*="名字"]');
    if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程');
    await p.waitForTimeout(2000);
    await p.evaluate(() => {
      const G = GAME, s = G.state;
      const a = s.cities[0];
      const eq = Object.keys(G.DATA.EQUIP);
      s.inventory = [];
      for (let i = 0; i < 40; i++) s.inventory.push(eq[i % eq.length]);
      G.systems.autoEquipBest(s.generals[0].id);
      const z = G.makeCity({ id: 'demo_zhou', name: '襄阳', x: 200, y: 320, type: 'zhou', state: '荆州' });
      z.wallLv = 9; z.res = { grain: 520000, wood: 400000, stone: 300000, iron: 200000, gold: 310000, pop: 18000 };
      s.cities.push(z);
      G.ui._cityId = a.id;
      G.refreshAll();
    });
    await p.waitForTimeout(600);
    const tag = vp[0] + 'x' + vp[1];

    /* ① 将领页：装备提供的逐行清单真的渲染出来了 */
    await p.evaluate(() => GAME.ui.setView('generals'));
    await p.waitForTimeout(600);
    const gen = await p.evaluate(() => {
      const rows = document.querySelectorAll('.gen-pane .eq-grow');
      const texts = Array.prototype.map.call(rows, r => r.textContent.trim());
      return { n: rows.length, texts: texts.slice(0, 8), hasSum: !!document.querySelector('.gen-pane .eq-sum'),
        pageScroll: document.body.scrollWidth > window.innerWidth + 1 };
    });
    check(tag + ' 装备提供逐行清单渲染', gen.n > 0, gen.n + ' 行：' + gen.texts.join(' / '));
    check(tag + ' 带装总数行确已撤掉', gen.hasSum === false);
    check(tag + ' 将领页不横向溢出', gen.pageScroll === false);

    /* ② 城池面板 */
    await p.evaluate(() => {
      const s = GAME.state;
      GAME.ui.openCityPanel(s.cities.filter(c => c.type === 'zhou')[0]);
    });
    await p.waitForTimeout(600);
    const cp = await p.evaluate(() => {
      const m = document.querySelector('.modal .inner-panel');
      const body = document.querySelector('.modal .m-body') || m;
      const chips = document.querySelectorAll('.modal .city-opts .chip').length;
      return { chips: chips, scroll: body ? body.scrollHeight > body.clientHeight + 2 : null,
        over: m ? (m.getBoundingClientRect().bottom > window.innerHeight + 1) : null };
    });
    check(tag + ' 城池面板含名城专属选项', cp.chips >= 3, cp.chips + ' 项');
    check(tag + ' 城池面板不溢出屏幕', cp.over === false);
    check(tag + ' 城池面板无内部滚动条', cp.scroll === false);

    /* ③ 运输 / ④ 派遣 */
    for (const [name, fn] of [['resource 运输', 'openTransport'], ['将领派遣', 'openDispatch']]) {
      await p.evaluate((f) => {
        const s = GAME.state;
        GAME.ui.closeModal && GAME.ui.closeModal();
        GAME.ui[f](s.cities[0].id);
      }, fn);
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        const m = document.querySelector('.modal .inner-panel');
        const body = document.querySelector('.modal .m-body') || m;
        return { over: m ? (m.getBoundingClientRect().bottom > window.innerHeight + 1) : null,
          scroll: body ? body.scrollHeight > body.clientHeight + 2 : null,
          chips: document.querySelectorAll('.modal .chip').length };
      });
      check(tag + ' ' + name + '：不溢出', r.over === false);
      check(tag + ' ' + name + '：无滚动条', r.scroll === false);
      check(tag + ' ' + name + '：可选项目已渲染', r.chips >= 2, r.chips + ' 个');
    }

    /* ⑤ 出征弹窗（未占据城池的库藏 + 守将） */
    await p.evaluate(() => {
      const s = GAME.state;
      GAME.ui.closeModal && GAME.ui.closeModal();
      let t = null;
      s.map.cities.forEach(c => { if (c.level === 9 && !t) t = c; });
      if (!t) s.map.cities.forEach(c => { if (c.level === 7 && !t) t = c; });
      GAME.ui.openAttackModal(t);
    });
    await p.waitForTimeout(700);
    const exp = await p.evaluate(() => {
      const m = document.querySelector('.modal .inner-panel');
      const txt = m ? m.textContent : '';
      const body = document.querySelector('.modal .m-body') || m;
      return { hasRes: txt.indexOf('库藏') >= 0, hasGuard: txt.indexOf('守将') >= 0,
        over: m ? (m.getBoundingClientRect().bottom > window.innerHeight + 1) : null,
        scroll: body ? body.scrollHeight > body.clientHeight + 2 : null };
    });
    check(tag + ' 出征弹窗显示未占据城池库藏', exp.hasRes === true);
    check(tag + ' 出征弹窗显示该城守将', exp.hasGuard === true);
    check(tag + ' 出征弹窗不溢出 / 无滚动条', exp.over === false && exp.scroll === false);

    await p.close();
  }
  await b.close();
  const bad = out.filter(x => x[0] === 'FAIL');
  out.forEach(x => console.log('  ' + x[0] + ' ' + x[1] + (x[2] ? '  [' + x[2] + ']' : '')));
  console.log('\n几何探针：' + (out.length - bad.length) + ' 通过 / ' + bad.length + ' 失败');
})();
