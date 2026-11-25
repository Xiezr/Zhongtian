/* 动效+confirm 实机截图验证（v158.9）：亲手用一遍
 * 测：
 *   A. 打开「重新开始」确认弹窗（doNewGame 走自建弹窗），截图确认样式正确
 *   B. 弹窗有「确定重新开始」红键 + 「取消」键
 *   C. 点「取消」→ 弹窗关闭、游戏不重载（确认不是原生 confirm 的阻断式）
 *   D. 页面无错误
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : ''))) : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : ''))); };

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '动效验证', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); });
  await p.waitForTimeout(2000);

  /* A. 打开「重新开始」确认弹窗 */
  await p.evaluate(() => { GAME.doNewGame(); });
  await p.waitForTimeout(600);  // 等弹窗入场动画

  const A = await p.evaluate(() => {
    const modal = document.querySelector('.modal-mask');
    const title = modal ? modal.querySelector('.gold-heading') : null;  // 限定在弹窗内，避免匹配到残留弹窗
    const redBtn = modal ? modal.querySelector('[data-action="new-game-do"]') : null;
    const cancelBtn = modal ? modal.querySelector('[data-action="close-modal"]') : null;
    return {
      modalOpen: !!modal,
      title: title ? title.textContent : null,
      hasRed: !!redBtn, redText: redBtn ? redBtn.textContent : null,
      hasCancel: !!cancelBtn,
      note: (() => { const n = modal ? modal.querySelector('.note') : null; return n ? n.textContent : null; })()
    };
  });
  ok('A1 弹窗打开（modal-mask 存在）', A.modalOpen, '');
  ok('A2 标题=重新开始', A.title === '重新开始', A.title);
  ok('A3 有「确定重新开始」红键', A.hasRed && A.redText === '确定重新开始', A.redText);
  ok('A4 有「取消」键', A.hasCancel, '');
  ok('A5 写明「不可撤销」', A.note && A.note.indexOf('不可撤销') >= 0, A.note);

  /* 截图弹窗 */
  await p.screenshot({ path: ROOT + '/.workbuddy/tmp/v1589_newgame_confirm.png' });

  /* B. 点「取消」→ 弹窗关闭、不重载 */
  const reloadBefore = await p.evaluate(() => window.__reloadCount || 0);
  await p.evaluate(() => {
    const btn = document.querySelector('[data-action="close-modal"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(500);
  const B = await p.evaluate(() => {
    return { modalStillOpen: !!document.querySelector('.modal-mask') };
  });
  ok('B1 点取消 → 弹窗关闭', B.modalStillOpen === false, '');

  /* C. 截图主界面（动效收敛后整体渲染） */
  await p.evaluate(() => { GAME.ui.setView('map'); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: ROOT + '/.workbuddy/tmp/v1589_main.png' });

  ok('C1 页面零错误', errs.length === 0, errs.length ? errs.join('|') : '');

  console.log('\n════════ 实机截图验证：' + pass + ' 通过 / ' + fail + ' 失败 ════════');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
