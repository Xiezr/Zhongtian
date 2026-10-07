'use strict';
/* v89.153 实机验证：公文系统页（三源合一 + 小标签 + 主题色）+ 采集收获明细 toast
   跑法：node .workbuddy/tools/show/shot_v89153_doc.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 造七类消息各一两条（覆盖全部小标签） */
    G.log('军情：赵云率军抵达许都', 'war');
    G.log('军情：缴获粮草三千石', 'war');
    G.log('任务完成：屯田（可领取）', 'task');
    G.log('🎏 改元 建安：时代之志，抚民以德', 'task', 'era');
    G.log('天时：大雨（行军迟缓）', 'sys', 'weather');
    G.log('建筑完成：居所 升级', 'sys', 'build');
    G.log('📦 采集收获（湖泊 Lv8）：净水 +60.0万；珠宝 蚌珠×2', 'sys', 'gather');
    G.log('江湖：有人在酒馆提起你的名字');
    /* 采集（供收获 toast） */
    var RESOK = G.DATA.GATHER.resOf || {};
    var spot = null;
    for (var rr = 2; rr <= 16 && !spot; rr++) {
      for (var dy = -rr; dy <= rr && !spot; dy++) for (var dx = -rr; dx <= rr && !spot; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || !RESOK[tl.terrain]) continue;
        if (G.map.npcAt && G.map.npcAt(x, y)) continue;
        if (G.map.wildAt(x, y)) continue;
        spot = { x: x, y: y, t: tl.terrain };
      }
    }
    st.wilds = st.wilds || [];
    st.wilds.push({ x: spot.x, y: spot.y, type: spot.t, level: 8, day: 0, startDay: 0 });
    var gen = st.generals[0];
    gen.status = 'garrison';
    G.map.wildAt(spot.x, spot.y).garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
    G.ui.setView('reports');
    return { spot: spot };
  });
  await p.waitForTimeout(700);

  /* ---------- ① 系统页（默认页） ---------- */
  console.log('===== ① 公文 · 系统页（三源合一 + 小标签 + 主题色） =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#view-container') || document.body;
    var html = root.innerHTML;
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.doc-tabs [data-action="doc-tab"]'))
      .map(function (el) { return el.getAttribute('data-v'); });
    var chips = Array.prototype.slice.call(document.querySelectorAll('#view-container .msg-channels .ch'))
      .map(function (el) { return el.getAttribute('data-v') + ':' + el.textContent.trim(); });
    var feed = document.querySelector('#msg-feed');
    var colors = feed ? Array.prototype.slice.call(feed.querySelectorAll('.bb-line')).slice(0, 8)
      .map(function (el) { return (el.getAttribute('style') || '').replace(/.*color:\s*/, '').replace(/;.*/, ''); }) : [];
    return {
      tabs: tabs, chips: chips,
      title: (html.match(/📜 公文 · ([^<]+)</) || [])[1] || '',
      hasTask: !!document.querySelector('#msg-task'),
      hasFeed: !!feed,
      lineColors: colors,
      feedLines: feed ? feed.querySelectorAll('.bb-line').length : 0
    };
  });
  console.log('    tabs = ' + r1.tabs.join(' / ') + ' | title = ' + r1.title);
  console.log('    chips = ' + r1.chips.join(' · '));
  console.log('    行色 = ' + r1.lineColors.join(' '));
  chk('页签顺序 = 系统/战报/侦查（3 个）', r1.tabs.join(',') === 'sys,war,scout');
  chk('默认页 = 系统（标题）', r1.title === '系统');
  chk('小标签含 全部 + 军情/任务/改元/天时/建造/采集收获/系统', r1.chips.length >= 8
    && r1.chips[0] === 'all:全部' && r1.chips.indexOf('era:改元') >= 0
    && r1.chips.indexOf('gather:采集收获') >= 0 && r1.chips.indexOf('war:军情') >= 0);
  chk('任务摘要区在（#msg-task）', r1.hasTask);
  chk('消息区在（#msg-feed）且 ≥6 行', r1.hasFeed && r1.feedLines >= 6, r1.feedLines + ' 行');
  var uniq = {}; r1.lineColors.forEach(function (c) { uniq[c] = 1; });
  chk('消息行字体色不同（≥3 种主题色）', Object.keys(uniq).length >= 3, Object.keys(uniq).join(' '));
  await p.locator('#view-container').screenshot({ path: OUT + 'v89153-doc-sys.png' });

  /* ---------- ② 切「改元」标签 ---------- */
  console.log('===== ② 小标签筛选（切「改元」） =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setMsgTag('era');
    var feed = document.querySelector('#msg-feed');
    return {
      tag: G.ui._msgTag,
      text: feed ? feed.textContent : '',
      lines: feed ? feed.querySelectorAll('.bb-line').length : 0,
      hasTask: !!document.querySelector('#msg-task')
    };
  });
  chk('切到改元：只剩改元消息', r2.tag === 'era' && /改元/.test(r2.text) && !/军情/.test(r2.text)
    && !/天时/.test(r2.text), r2.lines + ' 行');
  chk('切到改元：任务摘要隐藏', !r2.hasTask);
  await p.locator('#view-container').screenshot({ path: OUT + 'v89153-doc-era.png' });
  var r3 = await p.evaluate(function () {
    window.GAME.ui.setMsgTag('all');
    return true;
  });

  /* ---------- ③ 采集收获 toast（明细带数量） ---------- */
  console.log('===== ③ 采集收获明细（toast） =====');
  var shot = false;
  for (var i = 0; i < 12 && !shot; i++) {
    var r3b = await p.evaluate(function (o) {
      var G = window.GAME;
      G.startGather(o.x, o.y, { changqiang: 5000 }, { cityId: G.currentCity().id });
      var g = G.gatherList().filter(function (x) { return x.x === o.x && x.y === o.y; })[0];
      if (!g) return null;
      g.elapsed = 24 * 3600;
      G.doFinishGather(g.id);            /* 走真实 UI 包装（toast） */
      var el = document.querySelector('#toast');
      return { text: el ? el.textContent : '', jewel: new RegExp('珠宝').test(el ? el.textContent : '') };
    }, init.spot);
    if (r3b && r3b.jewel) {
      console.log('    toast = ' + r3b.text);
      chk('收获 toast 含「珠宝 XX×N」（数量在）', /珠宝 .+×\d+/.test(r3b.text), r3b.text.slice(0, 60));
      await p.locator('#toast').screenshot({ path: OUT + 'v89153-gather-toast.png' });
      shot = true;
    } else if (r3b) {
      console.log('    （第 ' + (i + 1) + ' 次未见珠宝：' + r3b.text.slice(0, 50) + '）');
    }
    await p.waitForTimeout(150);
  }
  chk('多次收获可见珠宝明细（12 次内）', shot);
  if (!shot) await p.locator('#toast').screenshot({ path: OUT + 'v89153-gather-toast.png' });

  chk('无页面报错', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log('\n===== ' + PASS + ' pass / ' + FAIL + ' fail =====');
  process.exit(FAIL ? 1 : 0);
})();
