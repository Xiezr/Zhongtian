/* v89.135 实机脚本：11 条需求的可见面验证（自带判定 + 截图）
 * ------------------------------------------------------------
 * 判定清单：
 *   ① 野地面板「驻军」板块（将领 + 逐兵种 + 开采状态 · 与地块操作并列）
 *   ② 驻军开采 → 采集卡显示将领名（无「（将已不在）」）· 驻军保留
 *   ③ live 实时刷新（采集面板 1 秒内自动更新）
 *   ④ 秘境链：选种→秘境「回跳」（不压栈）· 秘境关闭 = 全关回视图（closeAll）
 *   ⑤ 官府简化：官府格建筑面板「官府要务」直显（改名/主城/秘境）· 无「官府事务」
 *   ⑥ 建筑升级键：费用进悬停（资源行/珠宝行）· 按钮两行（升级 / LvX → LvX+1）· 无「费用」
 *   ⑦ 精力行：单行（数值 + 条 + 加号）· 无重复 hint
 * 截图：v89135-land.png / gathers.png / farm.png / gov.png / upgrade.png / pane.png
 * 跑法：node .workbuddy/tools/show/shot_v89135_wide.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ── 造局：城 + 我方野地（带将驻军）+ 君主空闲 ── */
  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260928 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.army = { yibing: 6000, changqiang: 3000 };
    c.res.gold = 1e7;
    /* 君主空闲（驻军用别的将） */
    var gens = st.generals;
    var lord = G.lordGeneralOf();
    lord.status = 'idle'; lord.cityId = c.id;
    var g1 = gens.filter(function (g) { return g.id !== lord.id; })[0] || G.makeGeneral('驻将甲', 12, 'garrison', c.id);
    if (!gens.filter(function (g) { return g.id === g1.id; }).length) st.generals.push(g1);
    g1.status = 'garrison'; g1.cityId = c.id;
    /* 我方湖泊 Lv10（**扫真湖泊格** —— 面板按地图 terrain 渲染，摆错地形就点不出开采键）：
       带将驻军 */
    var wxy = null;
    for (var yy = 3; yy < 220 && !wxy; yy++) {
      for (var xx = 3; xx < 220; xx++) {
        var tl = G.map.tile(xx, yy);
        if (tl && tl.terrain === 'lake' && !G.map.wildAt(xx, yy) && !G.map.npcAt(xx, yy)) {
          wxy = { x: xx, y: yy }; break;
        }
      }
    }
    st.wilds.push({ x: wxy.x, y: wxy.y, type: 'lake', level: 10, levelDay: 0,
      garrison: { troops: { yibing: 5000, changqiang: 2000 }, cityId: c.id, genId: g1.id } });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    return { wx: wxy.x, wy: wxy.y, g1: g1.name, cid: c.id };
  });
  await p.waitForTimeout(600);
  console.log('造局：野地 (' + init.wx + ',' + init.wy + ') · 驻将 ' + init.g1);

  /* ══ ① 野地面板：驻军板块 ══ */
  var v1 = await p.evaluate(function (xy) {
    var G = window.GAME;
    G.ui.openLandModal(xy.wx, xy.wy);
    var root = document.getElementById('modal-root');
    var t = root.textContent || '';
    var zones = [];
    root.querySelectorAll('.op-zone-t').forEach(function (z) { zones.push(z.textContent.trim()); });
    return {
      hasZone: zones.indexOf('驻军') >= 0, zones: zones.join('/'),
      hasGen: t.indexOf('驻将甲') >= 0 || t.indexOf('驻守野地') >= 0,
      hasTroops: t.indexOf('义兵') >= 0 && t.indexOf('长枪兵') >= 0,
      jia: t.indexOf('等级衰减') >= 0,
      noFake: t.indexOf('将已不在') < 0
    };
  }, init);
  chk('① 野地面板有「驻军」板块（与地块操作并列）', v1.hasZone, v1.zones);
  chk('① 驻军板块含将领 + 逐兵种明细', v1.hasGen && v1.hasTroops, (v1.hasGen ? '将领✔ ' : '') + (v1.hasTroops ? '兵种✔' : ''));
  chk('① 含等级衰减行 · 无「将已不在」', v1.jia && v1.noFake);
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89135-land.png' });

  /* ══ ② 驻军开采 → 采集面板（将领名 · 驻军保留） ══ */
  var v2 = await p.evaluate(function (xy) {
    var G = window.GAME;
    var root = document.getElementById('modal-root');
    var btn = root.querySelector('[data-action="wild-garrison-gather"]');
    if (!btn) return { noBtn: true };
    btn.click();
    var w = G.map.wildAt(xy.wx, xy.wy);
    var gth = G.gatherAt(xy.wx, xy.wy);
    return {
      garKeep: G.wildGarrisonTotal(w.garrison),
      gatherGen: gth ? gth.genId : null, gatherOrigin: gth ? gth.origin : null
    };
  }, init);
  await p.waitForTimeout(500);
  chk('② 驻军开采：驻军保留（原地开工）', v2.garKeep === 7000, '驻军 ' + v2.garKeep);
  chk('② 采集队带将领 genId（不再 null）', !!v2.gatherGen, String(v2.gatherGen));
  var v2b = await p.evaluate(function (g1name) {
    var G = window.GAME;
    G.ui.openGathers();
    var root = document.getElementById('modal-root');
    var t = root.textContent || '';
    return { has: t.indexOf(g1name) >= 0, noFake: t.indexOf('将已不在') < 0,
      txt: t.replace(/\s+/g, ' ').slice(0, 100) };
  }, init.g1);
  chk('② 采集卡显示将领名 · 无「（将已不在）」', v2b.has && v2b.noFake, v2b.txt);
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89135-gathers.png' });

  /* ══ ③ live 实时刷新（采集面板 1 秒内自动更新） ══ */
  var v3a = await p.evaluate(function () {
    var G = window.GAME;
    var g = (G.gatherList() || [])[0];
    if (!g) return '(无采集队)';
    g.elapsed = 3600 * 8;                      /* 灌 8 小时（不靠 UI 操作） */
    var root = document.getElementById('modal-root');
    var m = (root.textContent || '').match(/已采 ([\d.]+)\//);
    return m ? m[1] : '(未匹配)';
  });
  await p.waitForTimeout(1600);                 /* 让主循环跑 1~2 拍 */
  var v3b = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var m = (root.textContent || '').match(/已采 ([\d.]+)\//);
    return m ? m[1] : '(未匹配)';
  });
  chk('③ live 实时刷新：灌 8h → 面板 1.6 秒内自动更新', v3a !== v3b, v3a + ' → ' + v3b);

  /* ══ ④ 秘境链：回跳 + closeAll ══ */
  var v4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    /* 官府格 → 建筑面板 → 点种田秘境 */
    var c = G.currentCity();
    G.ui.openBuildModal(G.govCellsOf(c.col, c.row)[0]);
    var root = document.getElementById('modal-root');
    var govTxt = root.textContent || '';
    var hasGov = govTxt.indexOf('官府要务') >= 0
      && !!root.querySelector('[data-action="open-farm"]') && !!root.querySelector('[data-action="open-rename-city"]');
    root.querySelector('[data-action="open-farm"]').click();
    var depth1 = (G.ui._modalStack || []).length;   /* 开了秘境（栈 [官府] → 深度 1） */
    /* 进选种（子级）→ 再"种下后回秘境"（openFarm 应回跳不压栈） */
    var farmOk = G.ui._modalTitle && G.ui._modalTitle.indexOf('种田秘境') >= 0;
    G.ui.openFarmSeeds(0);
    var depth2 = (G.ui._modalStack || []).length;   /* [官府, 秘境] → 2 */
    G.ui.openFarm();                                /* 回跳：应截断到秘境层（栈回 [官府] = 1） */
    var depth3 = (G.ui._modalStack || []).length;
    var title3 = G.ui._modalTitle;
    /* 关闭秘境（closeAll）→ 应全关 */
    G.ui.closeModal();
    var closed = !G.ui._maskEl || !G.ui._maskEl.isConnected;
    return { hasGov: hasGov, farmOk: farmOk, depth1: depth1, depth2: depth2, depth3: depth3,
      title3: title3, closed: closed };
  });
  chk('④ 官府建筑面板含「官府要务」（改名/秘境键齐）', v4.hasGov);
  chk('④ 秘境链：进选种压栈（' + v4.depth2 + '）→ 回秘境**回跳**（' + v4.depth3 + '，不压第 3 层）',
    v4.depth1 === 1 && v4.depth2 === 2 && v4.depth3 === 1 && v4.title3.indexOf('种田秘境') >= 0,
    'title3=' + v4.title3);
  chk('④ 秘境关闭 = 全关（closeAll 回视图）', v4.closed);

  /* ══ ⑤ 官府简化 + ⑥ 升级键（官府格旁找一座可升级建筑）══ */
  var v6 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    /* 官府先升到 5 级 —— 否则非官府建筑上限被总闸压成 1（居所升不了，无升级键） */
    G.govCellsOf(c.col, c.row).forEach(function (i) {
      if (c.cells[i].build) c.cells[i].build.lvl = Math.max(5, c.cells[i].build.lvl || 1);
    });
    var idx = -1;
    (c.cells || []).forEach(function (cell, i) {
      if (idx < 0 && cell.build && cell.build.id === 'minfang') idx = i;
    });
    if (idx < 0) c.cells[0].build = { id: 'minfang', lvl: 3 };
    G.ui.openBuildModal(idx >= 0 ? idx : 0);
    var root = document.getElementById('modal-root');
    var upBtn = root.querySelector('[data-action="confirm-upgrade"]');
    var sub = upBtn ? upBtn.querySelector('.ba-sub') : null;
    return {
      hasBtn: !!upBtn,
      label: upBtn ? upBtn.textContent.replace(/\s+/g, ' ') : '',
      title: upBtn ? (upBtn.getAttribute('title') || '') : '',
      subTxt: sub ? sub.textContent : '',
      noCostWord: upBtn ? upBtn.textContent.indexOf('费用') < 0 : false
    };
  });
  chk('⑥ 升级键两行：升级 + LvX → LvX+1（无「费用」二字）',
    v6.hasBtn && /Lv\d+ → Lv\d+/.test(v6.subTxt) && v6.noCostWord,
    v6.label + ' · sub=' + v6.subTxt);
  chk('⑥ 费用进悬停（title 含资源 + 珠宝行两行结构）',
    v6.title.indexOf('粮') >= 0 && v6.title.indexOf('\n') >= 0,
    v6.title.replace(/\n/g, ' / ').slice(0, 80));
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89135-upgrade.png' });

  /* 官府面板截图（已关，重开一次） */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    G.ui.openBuildModal(G.govCellsOf(c.col, c.row)[0]);
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89135-gov.png' });

  /* ══ ⑦ 精力行单行 ══ */
  var v7 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var g = G.state.generals[0];
    var h = G.ui.genPane(g);
    var i = h.indexOf('精力 <b>');
    var seg = i >= 0 ? h.slice(i, i + 260) : '';
    var oneLine = false;
    try {
      var el = document.createElement('div');
      el.innerHTML = h;
      document.body.appendChild(el);
      var lines = el.querySelectorAll('.gd-line');
      if (lines[0]) oneLine = lines[0].getBoundingClientRect().height < 34;
      document.body.removeChild(el);
    } catch (e) { }
    return { has: i >= 0, seg: seg.replace(/<[^>]*>/g, '|').slice(0, 70),
      slash: /精力 <b>[\d,]+<\/b>\//.test(seg), noHint: seg.indexOf('gd-hint') < 0, oneLine: oneLine };
  });
  chk('⑦ 精力行 = 数值/上限 + 条 + 加号（去重复 hint）',
    v7.has && v7.slash && v7.noHint, v7.seg);
  chk('⑦ 精力行单行渲染（<34px）', v7.oneLine);
  await p.evaluate(function () {
    window.GAME.ui.setView('generals');
    window.GAME.ui._genSel = window.GAME.state.generals[0].id;
    window.GAME.ui.renderView('generals');
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89135-pane.png' });

  chk('全程零 JS 错误', errs.length === 0, errs.slice(0, 2).join(' | ') || '—');

  console.log(FAIL ? '\n⛔ ' + FAIL + ' 项未达标' : '\n✅ 实机全项达标');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('脚本异常', e); process.exit(2); });
