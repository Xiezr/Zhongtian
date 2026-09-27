/* v89.158 实机验证：悬停保护（真浏览器 · 真悬停 3 秒不被打断）+ 容量分账渲染
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89158_hover.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* 起一座仓库（让悬停出现"仓库（N 级合计）"分账行）+ 给点资源 */
    var c = G.currentCity();
    for (var i = 0; i < c.cells.length; i++) {
      if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'cangku', lvl: 2 }; break; }
    }
    c.res.grain = 123456; c.res.wood = 654321;
    G.ui.renderSide();
  });
  await p.waitForTimeout(1200);   /* 等 1~2 个 tick 让界面稳定 */

  console.log('===== ① 真悬停资源栏 → 3 秒不被打断（核心判据） =====');
  /* 标记当前节点 + 记录悬停期间它是否被替换 */
  await p.evaluate(function () {
    window.__h158 = {
      amt: document.querySelector('#res-bar .res-line .amt'),
      rate: document.querySelector('#res-bar .res-line .rate-wrap'),
      cityAttr: document.querySelector('#city-attrs .res-line'),
      outs: 0,
    };
    document.addEventListener('mouseout', function (e) {
      if (e.target && e.target.className === 'amt') window.__h158.outs++;
    }, true);
  });
  await p.hover('#res-bar .res-line .amt');
  await p.waitForTimeout(400);
  var s0 = await p.evaluate(function () {
    return { amtSame: document.querySelector('#res-bar .res-line .amt') === window.__h158.amt };
  });
  await p.waitForTimeout(3000);   /* 跨 3 个 tick */
  var s1 = await p.evaluate(function () {
    var amt = document.querySelector('#res-bar .res-line .amt');
    return {
      amtSame: amt === window.__h158.amt,             /* 悬停区：应 true（保护生效） */
      cityAttrSame: document.querySelector('#city-attrs .res-line') === window.__h158.cityAttr, /* 非悬停区：应 false（照常重绘） */
      outs: window.__h158.outs,
      tip: (amt.getAttribute('title') || ''),
    };
  });
  console.log('  hover+400ms amtSame=' + s0.amtSame + ' | hover+3.4s amtSame=' + s1.amtSame
    + ' | 非悬停区被替换=' + !s1.cityAttrSame + ' | mouseout=' + s1.outs);
  chk('悬停 3 秒后 .amt 仍是同一节点（周期重绘被跳过）', s1.amtSame);
  chk('非悬停区（城池属性行）照常重绘（对照：保护只挡悬停区）', !s1.cityAttrSame);
  await p.screenshot({ path: OUT + 'v89158-hover-hold.png' });

  console.log('===== ② 容量悬停分账（title 文本） =====');
  console.log('  title = ' + JSON.stringify(s1.tip));
  chk('含「上限」与「现有」', s1.tip.indexOf('上限') >= 0 && s1.tip.indexOf('现有') >= 0);
  chk('分账行（仓库 N 级合计 / 基础储量）',
    s1.tip.indexOf('级合计') >= 0 || s1.tip.indexOf('基础储量') >= 0);
  chk('城外堆场行（+X · 不吃仓储加成）', s1.tip.indexOf('城外堆场') >= 0);
  chk('账目自洽（分账数值之和 = 上限 值）', (function () {
    var mCap = s1.tip.match(/上限 ([0-9.,]+万?)/);
    var mCang = s1.tip.match(/合计）：([0-9.,]+万?)/);
    var mExt = s1.tip.match(/城外堆场：\+([0-9.,]+万?)/);
    if (!mCap || !mCang || !mExt) return false;
    function num(t) { var v = parseFloat(t.replace(/,/g, '')); return t.indexOf('万') >= 0 ? v * 1e4 : v; }
    var cap = num(mCap[1]), cang = num(mCang[1]), ext = num(mExt[1]);
    /* 显示粒度是 0.1 万（≈1000）——容差 2500 */
    return Math.abs(cap - (cang + ext)) <= 2500;
  })());

  console.log('===== ③ 移开 → 恢复重绘 =====');
  await p.hover('#city-attrs');   /* 移到非 res-bar 区域 */
  await p.waitForTimeout(1300);
  var s2 = await p.evaluate(function () {
    return { amtSwapped: document.querySelector('#res-bar .res-line .amt') !== window.__h158.amt };
  });
  chk('移开后 .amt 被替换（重绘恢复）', s2.amtSwapped);

  console.log('===== ④ 仓库面板（拆账文案） =====');
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); window.GAME.ui.openStore(); });
  await p.waitForTimeout(400);
  var s3 = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    var txt = (panel ? panel.textContent : '').replace(/\s+/g, ' ');
    return { txt: txt, box: (function () {
      var r = panel.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    })(), overflow: panel.scrollHeight - panel.clientHeight };
  });
  console.log('  面板 = ' + s3.txt.slice(0, 200));
  chk('标题 = 仓库 · Lv2（多仓叠加）', s3.txt.indexOf('仓库 · Lv2（多仓叠加）') >= 0);
  chk('无溢出', s3.overflow <= 1);
  await p.screenshot({ path: OUT + 'v89158-store-panel.png', clip: { x: s3.box.x, y: s3.box.y, width: s3.box.w, height: s3.box.h } });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('===== ⑤ 超上限存量不被削（真跑 tick） =====');
  var s4 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    var cap = G.storeCapOf(c);
    var bk = c.res.grain;
    c.res.grain = cap + 250000;
    G.tickOnce();
    var got = c.res.grain;
    c.res.grain = bk;
    return { cap: cap, got: Math.round(got), kept: got === cap + 250000 };
  });
  chk('超上限 25 万维持不变（只封增长、不砍已有）', s4.kept, 'got=' + s4.got + ' cap=' + Math.round(s4.cap));

  console.log('\n结果：' + PASS + ' 过关 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
