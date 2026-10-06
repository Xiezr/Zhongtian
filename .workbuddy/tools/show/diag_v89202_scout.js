/* v89.202 诊断：侦查报告「可下拉」现状量测
   ------------------------------------------------------------
   目的：回答"装不下时到底能不能下拉" —— 为需求 2（可下拉 or 板块分页）定夺取证。
   量三样（逐场景）：面板高 / 内容高 / 可滚性 / 滚到底后底部块可见性。
   场景：A 标准 1600×1000 · B 小窗 1366×768 · C 极端 --app-h=620（面板高被钳小）
   载荷：真跑一次满级侦查 → 再加料（编制扩到 20 兵种 + 多行库藏/建筑/战利品）。
   ⚠️ 只读不改：全部通过游戏出口造局，不动存档文件。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

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
    G.newGame({ name: 'diag202', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._cityId = c.id;
  });

  /* 造一份极端载荷的侦查 r（真跑一次 + 加料） */
  var made = await p.evaluate(function () {
    var G = window.GAME;
    var s = G.state, c0 = G.currentCity();
    G.techSet('zhencha', 10, c0);
    if (s.world) s.world.weather = 'clear';
    var gen = null;
    (s.generals || []).forEach(function (g) { if (!gen && g.status !== 'march') gen = g; });
    var npc = (s.map.cities || [])[0];
    var r = null, tries = 0;
    while (tries++ < 8) {
      G.setStaNow(gen, 999); gen.energy = 999;
      var bk = Math.random; Math.random = function () { return 0.001; };
      try { r = G.battle.expedition({ kind: 'city', id: npc.id }, 'scout', { changqiang: 50 }, gen.id); }
      finally { Math.random = bk; }
      if (r && r.ok) break;
    }
    if (!r || !r.ok) return { ok: false };
    /* 加料到极端：编制扩到 20 兵种 */
    var names = ['长枪兵', '刀盾兵', '弓箭手', '轻骑兵', '重步兵', '弩兵', '投石车', '冲车', '突骑兵',
      '虎豹骑', '象兵', '藤甲兵', '连弩兵', '井阑', '云梯', '火矢兵', '大盾兵', '游骑', '死士', '弓骑兵'];
    r.roster = names.map(function (nm, i) { return { name: nm, n: 1200 + i * 111 }; });
    r.totalExact = true; r.gNum = r.roster.reduce(function (a, x) { return a + x.n; }, 0);
    if (r.resReport) { r.resReport.rows = r.resReport.rows.concat([
      { name: '粮', v: 999999 }, { name: '木', v: 888888 }, { name: '石', v: 777777 }]); }
    if (r.buildReport) { r.buildReport.items = [
      { name: '官府', n: 1 }, { name: '民房', n: 12 }, { name: '农田', n: 4 }, { name: '伐木场', n: 4 },
      { name: '采石场', n: 4 }, { name: '铁矿场', n: 4 }, { name: '兵营', n: 2 }, { name: '校场', n: 1 },
      { name: '仓库', n: 3 }, { name: '医馆', n: 1 }, { name: '客栈', n: 1 }, { name: '集市', n: 2 },
      { name: '铁匠铺', n: 1 }, { name: '藏书阁', n: 1 }, { name: '寺庙', n: 1 }]; }
    if (r.loot) { r.loot = r.loot.concat(['顺手拾获 铁矿石 ×3', '顺手拾获 药草 ×2']); }
    return { ok: true, name: npc.name, rosterN: r.roster.length };
  });
  console.log('造局：ok=' + made.ok + ' target=' + made.name + ' roster=' + made.rosterN);

  var SCEN = [
    { tag: 'A 标准1600×1000', w: 1600, h: 1000, appH: null },
    { tag: 'B 小窗1366×768', w: 1366, h: 768, appH: null },
    { tag: 'C 极端app-h620', w: 1600, h: 1000, appH: '620px' },
  ];
  for (var si = 0; si < SCEN.length; si++) {
    var sc = SCEN[si];
    await p.setViewportSize({ width: sc.w, height: sc.h });
    await sleep(350);
    var out = await p.evaluate(function (appH) {
      var G = window.GAME;
      if (appH) document.documentElement.style.setProperty('--app-h', appH);
      else document.documentElement.style.removeProperty('--app-h');
      /* 重开侦查面板（上一步收尾时可能已被关闭）——直接重开，r 从“上一次”取不到就重造 */
      G.ui.closeAllModals();
      return 1;
    }, sc.appH);
    /* 重新造 r 并打开面板（每次场景独立，防状态漂移） */
    var opened = await p.evaluate(function () {
      var G = window.GAME;
      var s = G.state, c0 = G.currentCity();
      var gen = null;
      (s.generals || []).forEach(function (g) { if (!gen && g.status !== 'march') gen = g; });
      var npc = (s.map.cities || [])[0];
      var r = null, tries = 0;
      while (tries++ < 8) {
        G.setStaNow(gen, 999); gen.energy = 999;
        var bk = Math.random; Math.random = function () { return 0.001; };
        try { r = G.battle.expedition({ kind: 'city', id: npc.id }, 'scout', { changqiang: 50 }, gen.id); }
        finally { Math.random = bk; }
        if (r && r.ok) break;
      }
      if (!r || !r.ok) return { ok: false };
      var names = ['长枪兵', '刀盾兵', '弓箭手', '轻骑兵', '重步兵', '弩兵', '投石车', '冲车', '突骑兵',
        '虎豹骑', '象兵', '藤甲兵', '连弩兵', '井阑', '云梯', '火矢兵', '大盾兵', '游骑', '死士', '弓骑兵'];
      r.roster = names.map(function (nm, i) { return { name: nm, n: 1200 + i * 111 }; });
      r.totalExact = true;
      G.ui.closeAllModals();
      G.ui.openScoutResult({ kind: 'city', name: npc.name }, r);
      return { ok: true };
    });
    await sleep(450);
    var m = await p.evaluate(function () {
      var G = window.GAME;
      var panel = document.querySelector('#modal-root .inner-panel');
      if (!panel) return { err: 'no panel' };
      var sc = panel.querySelector('.m-body') || panel;
      var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
      /* 量：面板可见高 / 内容高 / 可滚性 */
      var sh = sc.scrollHeight, ch = sc.clientHeight, over = sh - ch;
      var canScroll = false, afterSet = -1;
      try { sc.scrollTop = 99999; afterSet = sc.scrollTop; canScroll = afterSet > 0; } catch (e) { }
      /* 滚到底后：最后一个内容块是否在可视区内 */
      var kids = sc.children;
      var last = kids[kids.length - 1];
      var pRect = sc.getBoundingClientRect();
      var lRect = last ? last.getBoundingClientRect() : null;
      var bottomVisible = lRect ? (lRect.bottom <= pRect.bottom + 1) : null;
      var heads = [];
      var hh = panel.querySelectorAll('.seal-h');
      for (var i = 0; i < hh.length; i++) heads.push(hh[i].textContent.trim().slice(0, 6));
      var firstHeadTop = hh.length ? hh[0].getBoundingClientRect().top : -1;
      sc.scrollTop = 0;
      var backToTop = sc.scrollTop === 0;
      return { k: k, sh: sh, ch: ch, over: over, canScroll: canScroll, afterSet: afterSet,
        bottomVisible: bottomVisible, heads: heads.length, nTrow: panel.querySelectorAll('.sc-trow').length,
        firstHeadTop: Math.round(firstHeadTop), backToTop: backToTop,
        modalH: Math.round(document.querySelector('#modal-root .modal').getBoundingClientRect().height / k) };
    });
    console.log('--- ' + sc.tag + ' ---');
    console.log(JSON.stringify(m));
  }

  await b.close();
  process.exit(0);
})();
