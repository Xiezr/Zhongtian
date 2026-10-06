/* v89.188 实机量测（真浏览器 · 只读量测，不改产品）：
   ① 将领界面现状：解雇按钮/名称/资质徽章/晋升行 的 rect —— 验证"切将位置漂移"是否成立
   ② 列表行要素现状：grow-name / grow-lv / rank-badge 的 x —— 验证列表要素参差
   ③ 民心民怨行：民居面板 vs 官府面板 —— 验证"所有建筑都挂民心"的 bug
   跑法：NODE_PATH=... node .workbuddy/tools/show/measure_v89188_gen.js */
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
    G.newGame({ name: '量188', cityName: '许都', region: '碎垣', mapSeed: 20260928 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* 造三将：p1 素人 / p2 美人+守将（双标签+状态标） / p3 史实名将 */
    var c = G.state.cities[0];
    var p1 = G.makeGeneral('测一', 50, 'idle', null, false, 'ying', 'balance');
    var p2 = G.makeGeneral('花木兰', 80, 'guard', null, true, 'ming', 'power');
    var p3 = G.makeGeneral('关云长', 120, 'idle', 'guanyu', false, 'tian', 'command');
    p1.cityId = c.id; p2.cityId = c.id; p3.cityId = c.id;
    G.state.generals.push(p1, p2, p3);
    G.ui.setView('city');
  });
  await p.waitForTimeout(500);

  /* ---------- ① 将领界面：三将对比 ---------- */
  var res = await p.evaluate(function () {
    var G = window.GAME, k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left / k * 10) / 10, w: Math.round(r.width / k * 10) / 10, h: Math.round(r.height / k * 10) / 10 };
    }
    function snapG(genId) {
      G.ui._genSel = genId;
      G.ui.setView('generals');
      G.ui.renderView('generals');
      var pane = document.querySelector('.gen-pane');
      if (!pane) return { err: 'no-pane' };
      var idB = pane.querySelector('.gp-id');
      var nameB = idB ? idB.querySelector('.gp-name') : null;
      var subs = idB ? idB.querySelectorAll(':scope > .gp-sub') : [];
      return {
        nameRow: R(nameB),
        dismiss: R(pane.querySelector('.gp-nameops .btn')),
        rankBadge: R(pane.querySelector('.gp-id .rank-badge')),
        rankSubRow: R(subs[0]),          /* 资质行（徽章所在行） */
        rankUpLine: R(pane.querySelector('.gp-rankup')),
        gpOps: R(pane.querySelector('.gp-ops')),
        paneW: R(pane),
        nameText: nameB ? nameB.textContent.slice(0, 24) : '',
      };
    }
    var gs = G.state.generals;
    var p1 = gs.filter(function (g) { return g.name === '测一'; })[0];
    var p2 = gs.filter(function (g) { return g.name === '花木兰'; })[0];
    var p3 = gs.filter(function (g) { return g.name === '关云长'; })[0];
    var o1 = snapG(p1.id), o2 = snapG(p2.id), o3 = snapG(p3.id);
    /* 列表行：切回全列表，量非选中态的行（选中行有 sel 类） */
    G.ui._genSel = p1.id; G.ui.renderView('generals');
    var rows = document.querySelectorAll('.gen-row:not(.empty)');
    var list = [];
    rows.forEach(function (row, i) {
      var nm = row.querySelector('.grow-name');
      var lv = row.querySelector('.grow-lv');
      var rb = row.querySelector('.rank-badge');
      var loy = row.querySelector('.grow-loy');
      list.push({ i: i, name: nm ? nm.textContent.slice(0, 10) : '',
        nameX: R(nm) ? R(nm).x : null, nameW: R(nm) ? R(nm).w : null,
        lvX: R(lv) ? R(lv).x : null, rbX: R(rb) ? R(rb).x : null, rbW: R(rb) ? R(rb).w : null,
        loyX: R(loy) ? R(loy).x : null });
    });
    return { p1: o1, p2: o2, p3: o3, list: list };
  });
  console.log('===== ① 将领界面（详情区）三将对比 =====');
  ['p1', 'p2', 'p3'].forEach(function (kk) {
    var o = res[kk];
    if (!o || o.err) { console.log(kk + ': ' + JSON.stringify(o)); return; }
    console.log(kk + '  「' + o.nameText + '」');
    console.log('   名称行   x=' + (o.nameRow && o.nameRow.x) + ' w=' + (o.nameRow && o.nameRow.w));
    console.log('   解雇按钮 x=' + (o.dismiss && o.dismiss.x) + ' w=' + (o.dismiss && o.dismiss.w) + ' h=' + (o.dismiss && o.dismiss.h));
    console.log('   资质徽章 x=' + (o.rankBadge && o.rankBadge.x) + ' w=' + (o.rankBadge && o.rankBadge.w));
    console.log('   资质行   x=' + (o.rankSubRow && o.rankSubRow.x) + ' w=' + (o.rankSubRow && o.rankSubRow.w));
    console.log('   晋升行   x=' + (o.rankUpLine && o.rankUpLine.x) + ' w=' + (o.rankUpLine && o.rankUpLine.w) + ' h=' + (o.rankUpLine && o.rankUpLine.h));
    console.log('   pane 宽 ' + (o.paneW && o.paneW.w));
  });
  console.log('===== ② 左侧列表要素 x 坐标 =====');
  res.list.forEach(function (r) {
    console.log('  #' + r.i + ' 「' + r.name + '」 nameX=' + r.nameX + ' nameW=' + r.nameW + ' lvX=' + r.lvX + ' rbX=' + r.rbX + ' rbW=' + r.rbW + ' loyX=' + r.loyX);
  });

  /* ---------- ③ 民心民怨行：民居 vs 官府 ---------- */
  var res3 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var pairs = [];
    (c.cells || []).forEach(function (cell, idx) {
      if (!cell || !cell.build) return;
      pairs.push({ idx: idx, bid: cell.build.id, lvl: cell.build.lvl });
    });
    var guanfu = pairs.filter(function (x) { return x.bid === 'guanfu'; })[0];
    var other = pairs.filter(function (x) { return x.bid !== 'guanfu'; })[0];
    function probe(idx) {
      G.ui.closeAllModals();
      G.ui.openBuildModal(idx);
      var txt = (document.querySelector('#modal-root') || {}).textContent || '';
      var has = txt.indexOf('民心 / 民怨') >= 0;
      var btn = !!document.querySelector('#modal-root [data-action="hearts-soothe"]');
      G.ui.closeAllModals();
      return { has: has, btn: btn };
    }
    return {
      guanfu: guanfu ? probe(guanfu.idx) : null,
      guanfuBid: guanfu ? guanfu.bid : null,
      other: other ? probe(other.idx) : null,
      otherBid: other ? other.bid : null,
    };
  });
  console.log('===== ③ 民心 / 民怨 段：面板对比（现状取证）=====');
  console.log('  官府(' + res3.guanfuBid + ')：有民心段=' + (res3.guanfu && res3.guanfu.has) + ' 有措施按钮=' + (res3.guanfu && res3.guanfu.btn));
  console.log('  其他(' + res3.otherBid + ')：有民心段=' + (res3.other && res3.other.has) + ' 有措施按钮=' + (res3.other && res3.other.btn) + '  ← 老板报的 bug 点');

  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
