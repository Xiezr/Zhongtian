/* v61 几何探针：**攻占后城格数按等级变小**（6×4 / 8×4 / 8×5）
   棋盘渲染必须照样撑得住 —— ui.fitTile / isoMetrics / govPalaceHTML 都按 col/row 参数化，
   但"参数化"是读代码得出的结论，必须在真浏览器里量一遍。 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const check = (n, ok, extra) => out.push([ok ? 'OK  ' : 'FAIL', n, extra || '']);

  for (const vp of [[1600, 950], [1366, 768], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1400);
    const ni = await p.$('input[placeholder*="名字"]');
    if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程');
    await p.waitForTimeout(2000);
    const tag = vp[0] + 'x' + vp[1];

    for (const lv of [1, 3, 6, 8]) {
      const r = await p.evaluate((lv) => {
        const G = GAME, s = G.state, c = s.cities[0];
        /* 模拟"攻占了这一档的城"：cells 换成该等级的满配布局 */
        const plan = G.cityPlanOf(lv);
        c.col = plan.col; c.row = plan.row;
        c.cells = plan.cells.map(x => ({ build: x.build ? { id: x.build.id, lvl: x.build.lvl } : null,
          pending: null, official: !!x.official }));
        c.wallLv = plan.wallLv;
        G.ui._cityId = c.id;
        G.ui.setView('city');
        const box = document.querySelector('#view-box') || document.querySelector('.ui-page');
        const board = document.querySelector('.iso-board') || document.querySelector('.board');
        /* 官府用 .gov-palace 判（内部可能是位图或内联 SVG 两条路径，
           锚 .gov-svg 会误判成"没渲染"） */
        const gov = document.querySelector('.gov-palace');
        return {
          col: c.col, row: c.row, cells: c.cells.length,
          boardW: board ? Math.round(board.getBoundingClientRect().width) : -1,
          boardH: board ? Math.round(board.getBoundingClientRect().height) : -1,
          boxW: box ? Math.round(box.clientWidth) : -1,
          boxH: box ? Math.round(box.clientHeight) : -1,
          gov: !!gov,
          hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
          vScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
        };
      }, lv);
      await p.waitForTimeout(500);
      check(tag + ' Lv' + lv + ' 格数与 col×row 一致', r.cells === r.col * r.row, r.col + '×' + r.row + '=' + r.cells);
      check(tag + ' Lv' + lv + ' 棋盘不超出容器宽', r.boardW <= r.boxW + 2, 'board ' + r.boardW + ' / box ' + r.boxW);
      check(tag + ' Lv' + lv + ' 棋盘不超出容器高', r.boardH <= r.boxH + 2, 'board ' + r.boardH + ' / box ' + r.boxH);
      check(tag + ' Lv' + lv + ' 官府宫殿照常渲染', r.gov === true);
      check(tag + ' Lv' + lv + ' 无横向滚动条', r.hScroll === false && r.vScroll === false,
        'h=' + r.hScroll + ' v=' + r.vScroll);
    }
    /* 新增：野外城池弹窗与出征预览（多了"城内建筑已建满"那一块，要重测不溢出） */
    for (const [nm, call] of [
      ['野外城池面板', `G.ui.openFortModal(${0})`],
      ['出征野外城池', `G.ui.openExpModal({kind:'fort', x:0, y:0})`],
    ]) {
      const r = await p.evaluate((name) => {
        const G = GAME, s = G.state;
        if (!s.map.grid && G.map.generate) G.map.generate();
        let f = null;
        for (let x = 0; x < 60 && !f; x++) for (let y = 0; y < 60 && !f; y++) {
          const q = G.map.fortAt(x, y);
          if (q && q.level >= 6) f = q;
        }
        if (!f) for (let x = 0; x < 60 && !f; x++) for (let y = 0; y < 60 && !f; y++) f = G.map.fortAt(x, y);
        if (!f) return null;
        G.ui.closeModal && G.ui.closeModal();
        if (name === '野外城池面板') G.ui.openFortModal(f);
        else { G.ui._cityId = s.cities[0].id; G.ui.openExpModal({ kind: 'fort', x: f.x, y: f.y }); }
        const m = document.querySelector('.modal .inner-panel');
        const body = document.querySelector('.modal .m-body') || m;
        return {
          over: m ? (m.getBoundingClientRect().bottom > window.innerHeight + 1) : null,
          scroll: body ? body.scrollHeight > body.clientHeight + 2 : null,
          hasPlan: m ? (m.textContent.indexOf('城内建筑') >= 0) : false,
          hasBar: m ? (m.textContent.indexOf('军营 ×2') >= 0) : false,
        };
      }, nm);
      await p.waitForTimeout(500);
      if (!r) { check(tag + ' ' + nm + ' 前置：找到野外城池', false); continue; }
      check(tag + ' ' + nm + '：不溢出屏幕', r.over === false);
      check(tag + ' ' + nm + '：无内部滚动条', r.scroll === false);
      check(tag + ' ' + nm + '：显示城内建筑与军营 ×2', r.hasPlan && r.hasBar);
    }
    await p.close();
  }
  await b.close();
  const bad = out.filter(x => x[0] === 'FAIL');
  out.forEach(x => console.log('  ' + x[0] + ' ' + x[1] + (x[2] ? '  [' + x[2] + ']' : '')));
  console.log('\n几何探针：' + (out.length - bad.length) + ' 通过 / ' + bad.length + ' 失败');
})();
