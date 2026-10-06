/* v89.201 诊断E：滚动保留专项（click 前 dump 全部关键读数） */
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
    G.newGame({ name: 'v201', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    var has = false;
    c.cells.forEach(function (cell) { if (cell.build && cell.build.id === 'tiejiangpu') { cell.build.lvl = 10; has = true; } });
    if (!has) {
      for (var i2 = 0; i2 < c.cells.length; i2++) {
        if (!c.cells[i2].build && !c.cells[i2].official) { c.cells[i2].build = { id: 'tiejiangpu', lvl: 10 }; break; }
      }
    }
    G.ui._cityId = c.id;
    var ids = Object.keys(G.DATA.EQUIP).filter(function (id) { return !G.DATA.EQUIP[id].ling; }).slice(0, 18);
    ids.forEach(function (id) { try { G.addEquip(id); } catch (e) { } });
    ids.slice(0, 12).forEach(function (id) { try { G.addEquip(id); } catch (e) { } });
    G.state.res.gold = 5e8; G.state.res.iron = 5e8; G.state.res.stone = 5e8;
  });

  var r = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.ENH_PER_PAGE = 60;
    G.ui._pages['enh'] = 1;
    G.ui._enhFilter = 'all';
    G.ui.openEnhance();
    var root = document.getElementById('modal-root');
    var panels = root.querySelectorAll('.inner-panel');
    var panel = panels[0];
    var mbody = panel.querySelector('.m-body');
    /* click 前全部读数 */
    var pre = {
      nPanels: panels.length,
      per: G.ui.ENH_PER_PAGE,
      nCards: panel.querySelectorAll('.enh-card').length,
      panelH: panel.offsetHeight,
      panelScrollH: panel.scrollHeight,
      mbodyH: mbody ? mbody.offsetHeight : -1,
      mbodyScrollH: mbody ? mbody.scrollHeight : -1,
      mbodyClientH: mbody ? mbody.clientHeight : -1,
      overflowY: (function () { try { return getComputedStyle(panel).overflowY; } catch (e) { return '?'; } })(),
      chain: (function () {
        var out = [], n = panel;
        for (var i = 0; i < 4 && n; i++) {
          out.push(n.className ? n.className : n.tagName);
          n = n.parentElement;
        }
        return out.join(' < ');
      })(),
    };
    if (mbody) mbody.scrollTop = 300;
    pre.afterSet = mbody ? mbody.scrollTop : -2;
    /* 点第 11 张卡 */
    var cards = panel.querySelectorAll('.enh-card');
    var tgt = cards[Math.min(10, cards.length - 1)];
    pre.target = tgt ? tgt.getAttribute('data-key') : 'none';
    pre.targetTop = tgt ? tgt.offsetTop : -1;
    if (tgt) tgt.click();
    return pre;
  });
  console.log('⑤ click 前读数: ' + JSON.stringify(r, null, 1));
  await p.waitForTimeout(450);
  var r2 = await p.evaluate(function () {
    /* ⚠️ 重新查节点（点选触发重建，旧引用会变孤儿 —— §65.2） */
    var panel = document.querySelector('#modal-root .inner-panel');
    var mbody = panel.querySelector('.m-body');
    return {
      mbodyScrollH: mbody ? mbody.scrollHeight : -1,
      mbodyClientH: mbody ? mbody.clientHeight : -1,
      scrollTopAfter: mbody ? mbody.scrollTop : -2,
      sel: String(window.GAME.ui._enhSel || ''),
      nCards: panel.querySelectorAll('.enh-card').length,
    };
  });
  console.log('⑤ click 后: ' + JSON.stringify(r2));
  await p.evaluate(function () { window.GAME.ui.ENH_PER_PAGE = 15; });

  await b.close();
  process.exit(0);
})();
