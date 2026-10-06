/* v89.190 实机量测（真浏览器 · 只读量测，不改产品）：
   ① 将领界面：君主 vs 普通将 的行高位移（name/rank/desc/exp 各行 top/height）
      + 五个按钮（解雇 / 晋升 / 经验＋ / 军中 / 修炼）的 rect —— 老板报"占位太大 + 位移差异"
   ② 均衡重复取证：资质徽章文本 vs .gp-style 文本
   跑法：NODE_PATH=... node .workbuddy/tools/show/measure_v89190_btns.js */
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
    G.newGame({ name: '量190', cityName: '许都', region: '碎垣', mapSeed: 20260929 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    var p1 = G.makeGeneral('测一', 50, 'idle', null, false, 'ying', 'balance');
    p1.cityId = c.id;
    G.state.generals.push(p1);
    G.ui.setView('city');
  });
  await p.waitForTimeout(500);

  var res = await p.evaluate(function () {
    var G = window.GAME, k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left / k * 10) / 10, y: Math.round(r.top / k * 10) / 10,
        w: Math.round(r.width / k * 10) / 10, h: Math.round(r.height / k * 10) / 10 };
    }
    function snapG(genId, label) {
      G.ui._genSel = genId;
      G.ui.setView('generals');
      G.ui.renderView('generals');
      var pane = document.querySelector('.gen-pane');
      if (!pane) return { label: label, err: 'no-pane' };
      var idB = pane.querySelector('.gp-id');
      var nameB = idB ? idB.querySelector('.gp-name') : null;
      var subs = idB ? idB.querySelectorAll(':scope > .gp-sub') : [];
      var expRow = pane.querySelector('.gp-exprow');
      var badge = pane.querySelector('.gp-id .rank-badge');
      var style = pane.querySelector('.gp-id .gp-style');
      var opBtn = pane.querySelector('.gp-nameops .btn');
      var rankBtn = pane.querySelector('.gp-rankrow .btn');
      var expBtn = pane.querySelector('.gp-expadd');
      var setBtns = pane.querySelectorAll('[data-action="toggle-equip-set"]');
      return {
        label: label,
        name: nameB ? nameB.textContent.slice(0, 20) : '',
        paneH: R(pane) && R(pane).h,
        idH: R(idB) && R(idB).h,
        nameRow: R(nameB),
        sub0: subs[0] ? R(subs[0]) : null,    /* 资质行 */
        sub1: subs[1] ? R(subs[1]) : null,    /* desc 行 */
        expRow: R(expRow),
        dismiss: R(opBtn),
        rankup: R(rankBtn),
        expadd: R(expBtn),
        setA: setBtns[0] ? R(setBtns[0]) : null,
        setB: setBtns[1] ? R(setBtns[1]) : null,
        badgeText: badge ? badge.textContent : '',
        styleText: style ? style.textContent : '',
        expText: expRow ? expRow.textContent.replace(/\s+/g, ' ') : '',
        nameCls: nameB ? nameB.className : '',
        btnCls: opBtn ? opBtn.className : '',
      };
    }
    var gs = G.state.generals;
    var lord = gs.filter(function (g) { return G.isLordGeneral(g); })[0];
    var p1 = gs.filter(function (g) { return g.name === '测一'; })[0];
    var oL = snapG(lord.id, '君主');
    var o1 = snapG(p1.id, '测一');
    return { lord: oL, p1: o1 };
  });

  console.log('===== ① 将领界面：君主 vs 普通将（行高位移）=====');
  ['lord', 'p1'].forEach(function (kk) {
    var o = res[kk];
    if (!o || o.err) { console.log(kk + ': ' + JSON.stringify(o)); return; }
    console.log('[' + o.label + '] 「' + o.name + '」 pane高=' + o.paneH + ' gp-id高=' + o.idH);
    console.log('   名称行 top=' + (o.nameRow && o.nameRow.y) + ' h=' + (o.nameRow && o.nameRow.h) + ' cls=' + o.nameCls);
    console.log('   资质行 top=' + (o.sub0 && o.sub0.y) + ' h=' + (o.sub0 && o.sub0.h));
    console.log('   desc行 top=' + (o.sub1 && o.sub1.y) + ' h=' + (o.sub1 && o.sub1.h));
    console.log('   经验行 top=' + (o.expRow && o.expRow.y) + ' h=' + (o.expRow && o.expRow.h));
    console.log('   解雇   ' + JSON.stringify(o.dismiss));
    console.log('   晋升   ' + JSON.stringify(o.rankup));
    console.log('   经验＋ ' + JSON.stringify(o.expadd) + ' cls=' + o.btnCls);
    console.log('   军中   ' + JSON.stringify(o.setA));
    console.log('   修炼   ' + JSON.stringify(o.setB));
    console.log('   徽章文本 = 「' + o.badgeText.trim() + '」');
    console.log('   style文本 = 「' + o.styleText + '」');
    console.log('   经验行文本 = 「' + o.expText + '」');
  });
  var L = res.lord, N = res.p1;
  if (L && N && L.nameRow && N.nameRow) {
    console.log('===== ② 差异汇总 =====');
    console.log('  gp-id 高：君主 ' + L.idH + ' vs 普通 ' + N.idH + '  Δ=' + Math.round((N.idH - L.idH) * 10) / 10);
    console.log('  名称行高：君主 ' + L.nameRow.h + ' vs 普通 ' + N.nameRow.h + '  Δ=' + Math.round((N.nameRow.h - L.nameRow.h) * 10) / 10);
    console.log('  资质行高：君主 ' + (L.sub0 && L.sub0.h) + ' vs 普通 ' + (N.sub0 && N.sub0.h));
    console.log('  经验行高：君主 ' + (L.expRow && L.expRow.h) + ' vs 普通 ' + (N.expRow && N.expRow.h));
    console.log('  菜单位移：资质行top 君主 ' + (L.sub0 && L.sub0.y) + ' vs 普通 ' + (N.sub0 && N.sub0.y)
      + '　经验行top 君主 ' + (L.expRow && L.expRow.y) + ' vs 普通 ' + (N.expRow && N.expRow.y));
    console.log('  解雇 x=' + (N.dismiss && N.dismiss.x) + '（君主无）  晋升 x=' + (N.rankup && N.rankup.x));
    console.log('  名字区宽（.gp-nm 定宽）实测：' + JSON.stringify(N.nameRow));
  }
  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
