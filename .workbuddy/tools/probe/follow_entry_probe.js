/* 人物视角入口探针（v158.8）：验证底栏「人物」按钮能切进/切出第三人称跟随态
 * 测三点：
 *   A. 底栏存在 follow-toggle 按钮（data-action）
 *   B. 点击按钮 → M.FOLLOW 变 true（进入人物视角）
 *   C. 再点 → M.FOLLOW 变 false（退出）+ 按钮高亮跟随变化
 *   D. Tab 键切换 → 按钮高亮同步（走 setFollow 同一条出口）
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
  await p.waitForFunction('window.GAME && window.GAME.map3d', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: 'follow', cityName: '灰岗', mapSeed: 20261023 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(2500);

  /* A. 底栏存在人物按钮 */
  const A = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="follow-toggle"]');
    return { has: !!btn, text: btn ? btn.textContent : null, title: btn ? btn.title : null };
  });
  ok('A1 底栏存在「人物」按钮', A.has === true, 'text=' + A.text);

  /* B. 点击按钮 → 进入跟随态 */
  const B = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="follow-toggle"]');
    if (!btn) return { ok: false };
    btn.click();
    return new Promise((resolve) => {
      setTimeout(() => {
        const M = GAME.map3d;
        const btn2 = document.querySelector('[data-action="follow-toggle"]');
        resolve({
          follow: !!M.FOLLOW,
          btnGold: btn2 ? btn2.classList.contains('gold') : false,
          btnText: btn2 ? btn2.textContent : null
        });
      }, 300);
    });
  });
  ok('B1 点击按钮 → FOLLOW=true（进入人物视角）', B.follow === true, 'FOLLOW=' + B.follow);
  ok('B2 按钮高亮 + 文案变「人物 ✓」', B.btnGold === true && /人物/.test(B.btnText || ''), 'gold=' + B.btnGold + ' text=' + B.btnText);

  /* C. 再点 → 退出跟随态 */
  const C = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="follow-toggle"]');
    if (!btn) return { ok: false };
    btn.click();
    return new Promise((resolve) => {
      setTimeout(() => {
        const M = GAME.map3d;
        const btn2 = document.querySelector('[data-action="follow-toggle"]');
        resolve({
          follow: !!M.FOLLOW,
          btnGold: btn2 ? btn2.classList.contains('gold') : false,
          btnText: btn2 ? btn2.textContent : null
        });
      }, 300);
    });
  });
  ok('C1 再点按钮 → FOLLOW=false（退出）', C.follow === false, 'FOLLOW=' + C.follow);
  ok('C2 按钮取消高亮 + 文案回「人物」', C.btnGold === false && /人物/.test(C.btnText || '') && !/✓/.test(C.btnText || ''), 'gold=' + C.btnGold + ' text=' + C.btnText);

  /* D. Tab 键切换 → 按钮高亮同步（走 setFollow 同一条出口） */
  const D = await p.evaluate(() => {
    // 模拟 Tab 键（keydown code=Tab）
    const ev = new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return new Promise((resolve) => {
      setTimeout(() => {
        const M = GAME.map3d;
        const btn2 = document.querySelector('[data-action="follow-toggle"]');
        resolve({
          follow: !!M.FOLLOW,
          btnGold: btn2 ? btn2.classList.contains('gold') : false
        });
      }, 300);
    });
  });
  ok('D1 Tab 键 → FOLLOW=true 且按钮高亮同步', D.follow === true && D.btnGold === true, 'FOLLOW=' + D.follow + ' gold=' + D.btnGold);

  console.log('    └ 运行时错误: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('探针崩溃:', e); process.exit(2); });
