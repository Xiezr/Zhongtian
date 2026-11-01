'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('EXC', e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '测', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('admin');
    return 'ok';
  });
  await p.waitForFunction(() => { var o=document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 90000 });
  await p.waitForTimeout(1000);

  async function snap(tag) {
    return await p.evaluate(function () {
      var btn = document.querySelector('#view-container [data-action="open-world"]');
      var nav = document.getElementById('nav-ev');
      return {
        btn: !!btn,
        cls: btn ? btn.className : '',
        txt: btn ? (btn.textContent || '').trim() : '',
        anim: btn ? getComputedStyle(btn).animationName : '',
        navEv: !!nav
      };
    });
  }

  var before = await snap('before');
  console.log('顶栏 #nav-ev 存在? ' + before.navEv + '（应为 false）');
  console.log('行政页按钮存在? ' + before.btn + '　文案「' + before.txt + '」　class=' + before.cls);

  // 造一个挂起事件
  var ev = await p.evaluate(function () {
    var G = window.GAME;
    var list = G.DATA.EVENTS || [];
    if (!list.length) return null;
    var id = list[0].id;
    G.state.ev = { id: id, at: Date.now() };
    return { id: id, name: list[0].name };
  });
  console.log('造事件: ' + JSON.stringify(ev));

  await p.waitForTimeout(1400);   // 等 syncBadges 跑一拍
  var after = await snap('after');
  console.log('有事件后：按钮 ' + (after.btn ? '在' : '不在') + '　文案「' + after.txt + '」');
  console.log('  class=' + after.cls + '　animation=' + after.anim);

  // 再切一次视图，确认渲染时就带 class（不依赖 syncBadges）
  await p.evaluate(function () { window.GAME.ui.setView('city'); });
  await p.waitForTimeout(300);
  await p.evaluate(function () { window.GAME.ui.setView('admin'); });
  await p.waitForTimeout(500);
  var re = await snap('re');
  console.log('切走再切回：class=' + re.cls + '　文案「' + re.txt + '」　animation=' + re.anim);

  var pass = !re.navEv || true;
  var ok = before.navEv === false && re.btn && re.cls.indexOf('ev-on') >= 0 && re.anim === 'ev-breathe';
  console.log('');
  console.log(ok ? '✅ 顶栏已移除 · 行政页按钮在事件时呼吸' : '❌ 不符合预期');
  await p.screenshot({ path: '.workbuddy/shots/admin_world_btn.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('ERR', e && e.message); process.exit(1); });
