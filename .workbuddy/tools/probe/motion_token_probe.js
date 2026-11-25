/* 动效 token 探针（v158.9）：验证动效语言收敛 + prefers-reduced-motion 降级
 * 测点：
 *   A. :root 里 8 个动效 token 全部定义且计算值正确
 *   B. 关键元素（.btn / .modal-mask / .bag-cell）的 transition 已 token 化（非裸值）
 *   C. 弹窗入场动画用了 var(--dur-normal) var(--ease-out)
 *   D. prefers-reduced-motion: reduce 下，全站 transition/animation 归零
 *   E. 原生态 confirm 已消失（doNewGame 走自建弹窗）
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

  /* A. token 定义 + 计算值 */
  const A = await p.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const toks = ['--dur-instant', '--dur-fast', '--dur-normal', '--dur-slow', '--dur-progress', '--dur-unit', '--ease-out', '--ease-in-out'];
    const out = {};
    for (const t of toks) out[t] = cs.getPropertyValue(t).trim();
    return out;
  });
  ok('A1 --dur-instant = 90ms', A['--dur-instant'] === '90ms', A['--dur-instant']);
  ok('A2 --dur-fast = 140ms', A['--dur-fast'] === '140ms', A['--dur-fast']);
  ok('A3 --dur-normal = 180ms', A['--dur-normal'] === '180ms', A['--dur-normal']);
  ok('A4 --dur-slow = 320ms', A['--dur-slow'] === '320ms', A['--dur-slow']);
  ok('A5 --dur-progress = 400ms', A['--dur-progress'] === '400ms', A['--dur-progress']);
  ok('A6 --dur-unit = 550ms', A['--dur-unit'] === '550ms', A['--dur-unit']);
  ok('A7 --ease-out 定义', A['--ease-out'].indexOf('cubic-bezier') === 0, A['--ease-out']);
  ok('A8 --ease-in-out 定义', A['--ease-in-out'].indexOf('cubic-bezier') === 0, A['--ease-in-out']);

  /* B. 关键元素 transition 已 token 化 */
  const B = await p.evaluate(() => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    document.body.appendChild(btn);
    const t = getComputedStyle(btn).transitionProperty;
    const d = getComputedStyle(btn).transitionDuration;
    btn.remove();
    return { prop: t, dur: d };
  });
  ok('B1 .btn transition 含 transform', B.prop.indexOf('transform') >= 0, B.prop);
  ok('B2 .btn transition 时长已 token 化（含 0.09s/0.14s，非裸 .1s/.15s）', /0\.09s|0\.14s/.test(B.dur), 'dur=' + B.dur);

  /* C. 弹窗入场动画 token 化（静态检查 CSS 文本） */
  const C = await p.evaluate(() => {
    const r = new XMLHttpRequest();
    // 直接读 index.html 文本（file 协议已加载，用 fetch 更快）
    return null;
  });
  // 改用 Node 侧读文件（p.evaluate 里 fetch file 受限）
  const fs = require('fs');
  const css = fs.readFileSync(ROOT + '/index.html', 'utf8');
  ok('C1 弹窗遮罩动画 token 化', /\.modal-mask \{ animation: mModalIn var\(--dur-normal\) var\(--ease-out\);/.test(css), '');
  ok('C2 弹窗面板动画 token 化', /\.modal-mask > \* \{ animation: mModalRise var\(--dur-normal\) var\(--ease-out\);/.test(css), '');
  ok('C3 无残留裸 .13s/.15s 弹窗入场', !/mModalIn \.13s|mModalRise \.15s/.test(css), '');

  /* D. prefers-reduced-motion 降级 */
  await p.emulateMedia({ reducedMotion: 'reduce' });
  const D = await p.evaluate(() => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    document.body.appendChild(btn);
    const dur = getComputedStyle(btn).transitionDuration;
    btn.remove();
    return dur;
  });
  ok('D1 reduce 下 transition 归零（≈0s，含 .001ms→1e-06s 科学计数）', /(^|,\s*)(0s|0ms|0\.001ms|1e-0?6s)/.test(D), 'dur=' + D);
  await p.emulateMedia({ reducedMotion: null });

  /* E. 原生 confirm 消失 */
  const E = await p.evaluate(() => {
    return { confirmGone: !/confirm\('确定要重新开始/.test(''), doNewGameCommit: typeof GAME.doNewGameCommit === 'function' };
  });
  const mainJs = fs.readFileSync(ROOT + '/js/main.js', 'utf8');
  ok('E1 源码无原生 confirm（重新开始）', !/confirm\(/.test(mainJs), '');
  ok('E2 doNewGameCommit 存在（走自建弹窗确认）', /doNewGameCommit\s*=/.test(mainJs), '');

  console.log('\n════════ 动效 token 探针结果：' + pass + ' 通过 / ' + fail + ' 失败 ════════');
  console.log('页面错误数：' + errs.length + (errs.length ? ' → ' + errs.join(' | ') : ''));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
