/* v89.191 实机取证（真浏览器 · 真点真填）：
   老板报「自动征兵的触发线和目标的数值框都不可填写」——本探针逐层查：
   ① 输入框 DOM 属性（disabled/readonly/pointer-events）
   ② 点击后能否获得焦点（document.activeElement）
   ③ 键盘输入是否落地（value 变化）
   ④ 输入框位置有没有被别层盖住（elementFromPoint 命中的是谁）
   ⑤ change 落库链路（dispatch change → 状态与重绘是否正常）
   跑法：NODE_PATH=... node .workbuddy/tools/show/dbg_v89191_autotrain.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '探191', cityName: '许都', region: '豫州', mapSeed: 20260929 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* 打开自动化视图 → 自动征兵页 */
    G.ui._autoSel = 'train';
    G.ui.setView('auto');
    G.ui.renderView('auto');
  });
  await p.waitForTimeout(800);

  /* 第一轮：静态检查 */
  var s1 = await p.evaluate(function () {
    var G = window.GAME;
    var inps = document.querySelectorAll('#view-container input.at-num');
    var out = { count: inps.length, items: [] };
    Array.prototype.forEach.call(inps, function (el, i) {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      out.items.push({
        i: i, k: el.dataset.k, troop: el.dataset.troop || '',
        disabled: el.disabled, readOnly: el.readOnly,
        pe: cs.pointerEvents, us: cs.userSelect, width: cs.width,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      });
    });
    /* 命中测试：页面中心处第一个输入框，看 elementFromPoint 是谁 */
    if (inps.length) {
      var r0 = inps[0].getBoundingClientRect();
      var hit = document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2);
      out.hit = hit ? (hit.tagName + '.' + (hit.className || '') + ' [id=' + hit.id + ']') : null;
      out.hitIsInput = hit === inps[0];
      /* 往上找谁在拖后腿 */
      var chain = [];
      var cur = hit;
      while (cur && chain.length < 6) {
        var ccs = getComputedStyle(cur);
        chain.push(cur.tagName + '.' + (cur.className || '').toString().slice(0, 40) + ' pe=' + ccs.pointerEvents);
        cur = cur.parentElement;
      }
      out.hitChain = chain;
    }
    return out;
  });
  console.log('【静态检查】');
  console.log(JSON.stringify(s1, null, 1));

  /* 第二轮：真点 + 真打字 */
  var s2 = await p.evaluate(function () {
    var G = window.GAME;
    var el = document.querySelector('#view-container input.at-num');
    if (!el) return { err: 'no-input' };
    el.focus();
    var afterFocus = document.activeElement === el;
    el.value = '4321';
    var disp = (G.ui.view || '') + ' ' + (G.ui._autoSel || '');
    return { afterFocus: afterFocus, value: el.value, disp: disp };
  });
  console.log('【聚焦+赋值】');
  console.log(JSON.stringify(s2));

  /* 用真实键盘输入（先清空） */
  var r3 = { steps: [] };
  try {
    var loc = p.locator('#view-container input.at-num').first();
    await loc.click();
    await p.waitForTimeout(250);
    var st1 = await p.evaluate(function () {
      var el = document.querySelector('#view-container input.at-num');
      return el ? { focused: document.activeElement === el, value: el.value } : null;
    });
    r3.steps.push({ afterClick: st1 });
    await p.keyboard.press('Control+A');
    await p.keyboard.type('777', { delay: 60 });
    await p.waitForTimeout(250);
    var st2 = await p.evaluate(function () {
      var el = document.querySelector('#view-container input.at-num');
      var G = window.GAME;
      return el ? { focused: document.activeElement === el, value: el.value,
        stateVal: (G.autoTrainCfg().targets[el.dataset.troop] || {})[el.dataset.k] } : null;
    });
    r3.steps.push({ afterType: st2 });
    /* 触发 change（失焦） */
    await p.evaluate(function () {
      var el = document.querySelector('#view-container input.at-num');
      if (el) el.blur();
    });
    await p.waitForTimeout(400);
    var st3 = await p.evaluate(function () {
      var G = window.GAME;
      var el = document.querySelector('#view-container input.at-num');
      return { value: el ? el.value : '(框没了)', focused: document.activeElement === el,
        stateVal: el ? (G.autoTrainCfg().targets[el.dataset.troop] || {})[el.dataset.k] : null,
        view: G.ui.view, sel: G.ui._autoSel };
    });
    r3.steps.push({ afterBlur: st3 });
  } catch (e) { r3.err = String(e && e.message); }
  console.log('【真点真填】');
  console.log(JSON.stringify(r3, null, 1));

  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
