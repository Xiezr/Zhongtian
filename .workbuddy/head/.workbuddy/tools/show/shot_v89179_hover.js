/* v89.179 实机验证（真浏览器）：「克制全撤」后的战场兵牌悬停
   ① 出征 → 进战场 → 悬停 步行机兵牌（曾经的"克制行大户"）→ 富浮层截图
   ② 量：浮层五段纸面面板在；**克制/抗性/被克 与 cnt- 类全无**；战场 DOM 零残留
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89179_hover.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1120 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var setup = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验179', cityName: '许都', region: '碎垣', mapSeed: 20260979 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.map.generate();
    var s = G.state, c = s.cities[0];
    s.settings.battleWatch = true;
    s.world.weather = 'clear';
    var g = G.makeGeneral('观战预备', 1, 'idle', c.id, false);
    s.generals.push(g);
    G.setStaNow(g, 1000); g.energy = 100;
    var wt = null;
    for (var r = 1; r <= 40 && !wt; r++) {
      for (var dy = -r; dy <= r && !wt; dy++) for (var dx = -r; dx <= r && !wt; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        var wlv = G.map.wildLevelNow(x, y);
        if (wlv < 2 || wlv > 6) continue;
        wt = { x: x, y: y };
      }
    }
    if (!wt) return { ok: false, msg: '未找到野地' };
    var wlv2 = G.map.wildLevelNow(wt.x, wt.y);
    var wd = G.wildDefenseAt(wt.x, wt.y, wlv2);
    var send = {};
    for (var gk in (wd.army || {})) send[gk] = wd.army[gk];
    /* v89.179：确保阵中有"步行机"（演示"曾经的克制行大户"） */
    send.changqiang = (send.changqiang || 0) + 2000;
    c.army = {};
    for (var gk2 in send) c.army[gk2] = send[gk2];
    s.marches = [];
    var d = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'raid', send, g.id);
    var m = s.marches[0];
    if (m) { m.elapsed = m.totalTime; G.march.tick(); }
    return { ok: d.ok === true && s.battles.length === 1, msg: d.msg, lv: wlv2, units: Object.keys(send).join(',') };
  });
  chk('① 出征挂起（Lv' + setup.lv + ' 野地）', setup.ok, (setup.msg || '') + ' 兵种: ' + setup.units);

  if (!setup.ok) { await b.close(); process.exit(1); }
  await p.waitForTimeout(600);
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-open"]');
    if (btn) btn.click();
  });
  var inBt = await p.evaluate(function () { return !!document.querySelector('#modal-root #bt-field'); });
  chk('② 进入战场界面', inBt);
  await p.waitForTimeout(400);

  /* ③ 悬停 步行机兵牌（没有就退回首张） */
  var diag = await p.evaluate(function () {
    var u = document.querySelector('#bt-field .bt-unit');
    return {
      units: document.querySelectorAll('#bt-field .bt-unit').length,
      rn: document.querySelectorAll('#bt-field .bt-rnm').length,
      dt: document.querySelectorAll('#bt-field [data-tip-el]').length,
      sample: u ? u.outerHTML.slice(0, 600) : '(none)'
    };
  });
  console.log('  诊断: ' + JSON.stringify(diag));
  var hh = await p.evaluateHandle(function () {
    /* 战场兵牌 = .bt-unit 本身带 data-tip-el（浮层内容在内部 .tip-src） */
    return document.querySelector('#bt-field .bt-unit[data-troop="changqiang"]')
      || document.querySelector('#bt-field .bt-unit[data-tip-el]');
  });
  var which = await hh.evaluate(function (el) {
    return el ? ('data-troop=' + el.getAttribute('data-troop')
      + ' · tip-src=' + (el.querySelector('.tip-src') ? '在' : '缺')) : 'null';
  });
  if (which === 'null') {
    chk('③ 找到可悬停兵牌', false);
  } else {
    chk('③ 找到可悬停兵牌', true, which);
    await hh.hover();
    await p.waitForTimeout(450);
    var tip = await p.evaluate(function () {
      /* 浮层 = body 上的 #tip-layer（v37 全站唯一），激活态带 .on */
      var el = document.getElementById('tip-layer');
      if (el && el.classList.contains('on')) {
        var r = el.getBoundingClientRect();
        if (r.width > 30) {
          return { html: el.innerHTML, text: el.textContent,
            rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
        }
      }
      return null;
    });
    if (!tip) {
      chk('④ 富浮层弹出', false);
    } else {
      chk('④ 富浮层弹出（宽 ' + Math.round(tip.rect.width) + 'px）', true);
      chk('⑤ 五段纸面面板在（数量/射程/全军血量/攻/防）',
        tip.text.indexOf('数量') >= 0 && tip.text.indexOf('射程') >= 0 && tip.text.indexOf('全军血量') >= 0
        && tip.text.indexOf('全军攻击') >= 0 && tip.text.indexOf('全军防御') >= 0);
      chk('⑥ 克制行已绝迹（克制/抗性/被克 与 cnt- 类全无）',
        tip.text.indexOf('克制') < 0 && tip.text.indexOf('抗性') < 0 && tip.text.indexOf('被克') < 0
        && tip.html.indexOf('cnt-') < 0);
      var domClean = await p.evaluate(function () {
        return document.querySelectorAll('.cnt-good, .cnt-bad').length === 0
          && (document.querySelector('#modal-root').innerText || '').indexOf('抗性：') < 0;
      });
      chk('⑦ 战场 DOM 无 cnt- 残留', domClean);
      await p.screenshot({ path: OUT + 'v89179-hover.png', clip: {
        x: Math.max(0, Math.min(tip.rect.x - 40, 1680 - tip.rect.width - 80)),
        y: Math.max(0, Math.min(tip.rect.y - 40, 1120 - tip.rect.height - 80)),
        width: Math.min(1680, tip.rect.width + 80),
        height: Math.min(1120, tip.rect.height + 80) } });
      console.log('  截图: v89179-hover.png');
    }
  }
  await p.screenshot({ path: OUT + 'v89179-battle.png' });
  console.log('  截图: v89179-battle.png');
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
