/* debug_create.js —— 检查创建屏枚举（不动 profile 目录，用 localStorage 清理回到创建屏） */
'use strict';
const { chromium } = require('playwright-core');
const core = require('./lib/core');
const { Bot } = require('./lib/bot');

(async () => {
  const bot = new Bot();
  await bot.launch();
  await bot.gotoGame();
  // 清存档回创建屏
  await bot.page.evaluate(`(function(){ try { localStorage.removeItem('sanguo_save_v3'); } catch(e){} })()`);
  await bot.page.reload({ waitUntil: 'load' });
  await bot.page.waitForFunction(
    `(function(){ var c=document.getElementById('screen-create'); return c && !c.classList.contains('hidden'); })()`,
    null, { timeout: 15000 }).catch(() => {});
  const state = await bot.page.evaluate(`(function(){
    var g = document.getElementById('screen-game'), c = document.getElementById('screen-create');
    return { gameHidden: g ? g.className : null, createHidden: c ? c.className : null,
      createBtns: c ? c.querySelectorAll('button, [data-action]').length : -1 };
  })()`);
  console.log('STATE', JSON.stringify(state));
  const els = await bot.enumInteractive();
  console.log('ENUM count=', els ? els.length : 'null');
  if (els) els.forEach(d => console.log(' ', d.idx, d.tag, d.action, JSON.stringify(d.label), 'disabled=' + d.disabled));
  await bot.browser.close();
  process.exit(0);
})().catch(e => { console.error('DBG_FAIL', e); process.exit(1); });
