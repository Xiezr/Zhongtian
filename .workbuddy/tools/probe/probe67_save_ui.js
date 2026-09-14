/* ============================================================
 * probe67_save_ui.js —— 存档管理面板：量溢出 + 出图
 * 判据（老板硬规矩）：**弹窗内禁止下拉条** → body 的 scrollHeight 必须 ≤ clientHeight。
 * 用法: NODE_PATH=<...>/node_modules node .workbuddy/tools/probe67_save_ui.js
 * ============================================================ */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  let bad = 0;
  for (const vp of [[1600, 950], [1440, 900], [1366, 768]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    p.on('pageerror', e => console.log('  ⚠️ 页面异常：' + e.message));
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1200);
    const ni = await p.$('input[placeholder*="名字"]');
    if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程');
    await p.waitForTimeout(1600);

    /* 先存两槽，面板才有"有档"的样子可看 */
    await p.evaluate(`(function(){
      var G=GAME; if(!G.state.map.grid && G.map.generate) G.map.generate();
      G.saveTo('s1');
      G.saveTo('main'); G.rotateAuto(); G.saveTo('s3');
      G.ui.openSaveManager();
    })()`);
    await p.waitForTimeout(400);

    const g = await p.evaluate(`(function(){
      var body = document.querySelector('#modal-root .m-body') || document.querySelector('#modal-root .modal-body');
      var shell = document.querySelector('#modal-root > *');
      if (!body) return { err: '找不到弹窗体' };
      var rows = document.querySelectorAll('#modal-root .sv-row').length;
      return { rows: rows, sh: body.scrollHeight, ch: body.clientHeight,
               shellH: shell ? Math.round(shell.getBoundingClientRect().height) : 0,
               vh: window.innerHeight };
    })()`);
    if (g.err) { console.log('  ❌ ' + vp.join('x') + ' ' + g.err); bad++; await p.close(); continue; }
    const over = g.sh - g.ch;
    const ok = over <= 0;
    if (!ok) bad++;
    console.log((ok ? 'OK    ' : 'FAIL  ') + vp.join('x') + '  槽位 ' + g.rows + ' 行 · 弹窗高 ' + g.shellH +
      ' / 视口 ' + g.vh + ' · 正文 ' + g.sh + ' vs ' + g.ch + (ok ? '（不出滚动条）' : ('（溢出 ' + over + 'px）')));

    /* 空槽与有档并存的对照图 */
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v67-save-' + vp[0] + 'x' + vp[1] + '.png' });
    await p.close();
  }
  console.log(bad ? ('❌ ' + bad + ' 个分辨率不合格') : '✅ 全部分辨率：弹窗无滚动条');
  await b.close();
})();
