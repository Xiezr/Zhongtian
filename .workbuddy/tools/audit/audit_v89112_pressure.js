/* ============================================================
 * audit_v89112_pressure.js — 弹窗**海量数据压测**（真浏览器）
 * ------------------------------------------------------------
 * 老板令（原话）：「怎么小小弹窗，搞一堆右侧下拉条，能不能充分利用界面版面，
 *   说了多少次，设置合理的界面大小，避免使用下拉条，条目过多的分页」
 *
 * 与 audit_v89105_modals.js 的分工：
 *   · v105 = 「骨架体检」（小数据量、判骨架/越界）—— 它全绿 ≠ 玩家看不到滚动条；
 *   · 本工具 = 「**载荷体检**」：把游戏推到后期（多城/满物品/几十战报/8 采集队/
 *     大视口据点），逐个打开弹窗，量三件事：
 *       ① 主溢出（.m-body / .inner-panel 的 scrollHeight − clientHeight）
 *       ② **弹窗内可滚动容器数**（含嵌套 —— 老板看到的"一堆下拉条"就是它）
 *       ③ 弹窗尺寸 vs 画布 1440×900（利用率，看是不是"小窗装大内容"）
 *
 * 用法：node .workbuddy/tools/audit/audit_v89112_pressure.js [--shots]
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var SHOTS = process.argv.indexOf('--shots') >= 0;
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

var MODALS = [
  /* ⛔ v89.141（复核）：`ui.openGuanfu` 在 v89.135 退役 → 改开官府格的建筑面板 */
  ['官府（建筑面板）', '(function(){var c=GAME.currentCity();for(var i=0;i<c.cells.length;i++){if(c.cells[i].official){return ui.openBuildModal(i);}}return ui.openBuildModal(0);})()'],
  ['征募/训练', 'ui.openTroops()'],
  ['市场', 'ui.openMarket()'],
  ['酒馆招募', 'ui.openInn()'],
  ['宝物', 'ui.openArtifacts()'],
  ['装备', 'ui.openEquipPanel()'],
  ['基因实验室', 'ui.openFarm()'],
  ['锻造', 'ui.openForge()'],
  ['作坊', 'ui.openWorkshop()'],
  ['书简/帮助', 'ui.openHelp()'],
  ['见闻/日志', 'ui.openJournal(1)'],
  ['君主', 'ui.openLordInfo()'],
  ['存档管理', 'ui.openSaveManager()'],
  ['门派', 'ui.openSect()'],
  ['货仓', 'ui.openStore()'],
  ['军务总览', 'ui.openMarches()'],
  /* ⛔ v89.141（复核）：`openWallModal` 在 v89.126 退役 → `openBuildModal("wall")`；
     `openXiaochang` 在 v89.133 退役（点建筑功能 = 直接进军务视图，不再是弹窗）→ 删除条目 */
  ['围墙（环城槽）', 'ui.openBuildModal("wall")'],
  ['据点半览', 'ui.openForts()'],
  /* ⛔ v89.141（复核）：`ui.openGathers` 在 v89.136 退役 → 改开"已占野地的地块界面" */
  ['野地地块（采集区）', '(function(){var st=GAME.state,c=st.cities[0];st.wilds=st.wilds||[];var spot=null;for(var dx=2;dx<=14&&!spot;dx++){for(var dy=-14;dy<=14&&!spot;dy++){var t=GAME.map.tile(c.x+dx,c.y+dy);if(t&&t.terrain!=="city"&&!GAME.map.wildAt(c.x+dx,c.y+dy)){spot={x:c.x+dx,y:c.y+dy};}}}if(!spot)return ui.toast("无空野地");st.wilds.push({x:spot.x,y:spot.y,type:"lake",level:8,day:0,startDay:0});return ui.openLandModal(spot.x,spot.y);})()'],
  ['野地一览', 'ui.openWilds()'],
  ['布阵方案', 'ui.openTacticSets()'],
  ['防守战术', '(function(){ui._marchTab="def";ui.openMarches();})()'],
  ['自动出征配置', 'ui.openAutoMarch()'],
  ['出征', '(function(){var st=GAME.state;ui.openExpModal({kind:"wild",x:st.cities[0].x+2,y:st.cities[0].y+2});})()'],
  ['本境调运', '(function(){var st=GAME.state;if(st.cities.length<2)return ui.toast("无第二城");return ui.openExpModal({kind:"own",id:st.cities[1].id});})()'],
  ['打造', 'ui.openBuildModal(0)'],
  /* ⛔ v89.137：「全境营造总览」面板整条退役（老板判重）——条目随之删除 */
  ['统计·爵位', 'ui.openPanel()'],
  ['统计·物品', 'ui.setView("items")'],
  ['背包', 'ui.setView("bag")'],
  ['公文·战报', '(function(){ui.setView("reports");ui.setDocTab("war");})()'],
  ['公文·系统', '(function(){ui.setView("reports");ui.setDocTab("sys");})()'],
  /* v89.120：报告身份 rid 化 —— 按唯一出口取号再打开（不再是数组下标） */
  ['战报详情', '(function(){var st=GAME.state;if(!st.reports.length)return;ui.viewReport(GAME.repRidOf(st.reports[0]));})()'],
  ['商店', 'ui.openShop()'],
  /* ⛔ v89.141（复核）：`ui.openDispatch` 在 v89.138 退役（并入出征界面）→ 同上，本境调运即其形态 */
  ['派遣（本境调运·出征界面）', '(function(){var st=GAME.state;if(st.cities.length<2)return ui.toast("无第二城");return ui.openExpModal({kind:"own",id:st.cities[1].id});})()'],
  ['派驻', 'ui.openTroopMove(GAME.currentCity().id)'],
];

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 压测载荷：**真实试玩存档**（10 现实小时·600× 的实际进度）+ 极限补料 ---------- */
  var savePath = path.join(R, '.workbuddy/tmp/playtest600/cap108/final_state.json');
  var saveRaw = fs.existsSync(savePath) ? fs.readFileSync(savePath, 'utf8') : null;
  var load = await page.evaluate(function (raw) {
    var G = window.GAME, DATA = G.DATA;
    var st;
    if (raw) {
      st = JSON.parse(raw);
      G.adoptState(st);                            /* 走真实读档后处理（迁移/补字段全跑） */
    } else {
      st = G.newGame({ name: '压测', cityName: '灰岗', region: '碎垣', mapSeed: 20260923 });
    }
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { if (c.res) c.res[k] = Math.max(c.res[k] || 0, 9e6); });
    /* 极限补料：把"列表型弹窗"压到爆 */
    var wt = ['plain', 'forest', 'hill', 'marsh', 'lake'];
    var wl = [];
    for (var i = 0; i < 30; i++) {
      wl.push({ x: 40 + (i % 15) * 2, y: 40 + Math.floor(i / 15) * 2,
        type: wt[i % 5], lv: 3 + (i % 7), levelDay: 1 });
    }
    st.wilds = wl;                                  /* 30 片野地 */
    st.gathers = [];
    for (var gi = 0; gi < 8; gi++) {
      var gen = G.makeGeneral('采集将' + (gi + 1), 30, 'gather', c.id, false);
      gen.stamina = 200; gen.energy = 200;
      st.generals.push(gen);
      st.gathers.push({ id: 'px' + (gi + 1), x: 60 + gi, y: 60, type: wt[gi % 5],
        level: 4 + (gi % 5), genId: gen.id, troops: 1200 + gi * 100, at: (st.world && st.world.elapsed || 0) + 7200 });
    }
    (DATA.ITEMS || []).forEach(function (it) { if (it && it.id) st.items[it.id] = 3; });  /* 全物品 */
    /* v89.141（复核修复）：补第二城 —— v105 载荷体检同款问题（原造局只 1 城，
       "本境调运/派驻/派遣"等面板失去对象，压不出真实载荷）。 */
    try {
      var _spot = null;
      for (var _rr = 2; _rr <= 10 && !_spot; _rr++) {
        for (var _dx = -_rr; _dx <= _rr && !_spot; _dx++) {
          for (var _dy = -_rr; _dy <= _rr && !_spot; _dy++) {
            var _t = G.map.tile(c.x + _dx, c.y + _dy);
            if (_t && _t.terrain === 'plain' && !G.map.wildAt(c.x + _dx, c.y + _dy)
              && !(G.map.npcAt && G.map.npcAt(c.x + _dx, c.y + _dy))) {
              _spot = { x: c.x + _dx, y: c.y + _dy };
            }
          }
        }
      }
      if (_spot && st.cities.length < 2) {
        st.wilds = st.wilds || [];
        st.wilds.push({ x: _spot.x, y: _spot.y, lv: 3, day: 0, type: 'plain' });
        G.buildCityAt(_spot.x, _spot.y);
      }
    } catch (e) {}
    try { G.map._view = { vx: Math.max(0, c.x - 13), vy: Math.max(0, c.y - 13), span: 26 }; } catch (e) {}
    return { cities: st.cities.length, wilds: st.wilds.length, gathers: st.gathers.length,
      items: Object.keys(st.items || {}).length, reports: (st.reports || []).length,
      generals: st.generals.length, rank: st.rank };
  }, saveRaw);
  console.log('压测载荷：' + JSON.stringify(load));

  /* ---------- 逐弹窗测量 ---------- */
  var rows = [];
  for (var j = 0; j < MODALS.length; j++) {
    var name = MODALS[j][0], expr = MODALS[j][1];
    var r = await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { open: false, err: String(err && err.message).slice(0, 60) }; }
      var root = document.querySelector('#modal-root');
      var modal = root.querySelector('.modal');
      /* 视图模式（setView）：量 .view-box（大界面天然可滚，只报"内容远超一屏"的极端值） */
      if (!modal) {
        var vb = document.querySelector('#view-container') || document.querySelector('.view-box');
        if (!vb) return { open: false, err: '无 .modal / .view-box' };
        var vOver = Math.round(vb.scrollHeight - vb.clientHeight);
        return { open: true, w: Math.round(vb.getBoundingClientRect().width),
          h: Math.round(vb.getBoundingClientRect().height), cls: 'view', viewMode: true,
          mainOver: vOver, scrolls: [] };
      }
      var box = modal.getBoundingClientRect();
      var main = root.querySelector('.m-body') || root.querySelector('.inner-panel') || modal;
      /* 全容器扫描：所有**实际可滚**的元素（含嵌套） */
      var scrolls = [];
      var all = modal.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var cs = getComputedStyle(all[i]);
        if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue;
        var d = all[i].scrollHeight - all[i].clientHeight;
        if (d > 2) {
          scrolls.push({ cls: (all[i].className || all[i].tagName).toString().slice(0, 26),
            d: Math.round(d), self: all[i] === main });
        }
      }
      /* 主容器即使在 scrolls 里也要标定 */
      var mainOver = Math.round(main.scrollHeight - main.clientHeight);
      if (mainOver > 2 && !scrolls.some(function (s) { return s.self; })) {
        scrolls.unshift({ cls: '（主）' + (main.className || '').slice(0, 20), d: mainOver, self: true });
      }
      return {
        open: true, w: Math.round(box.width), h: Math.round(box.height),
        cls: (modal.className || '').replace('modal wood-frame', '').trim(),
        mainOver: mainOver, scrolls: scrolls,
      };
    }, expr);
    if (!r.open) {
      rows.push({ name: name, bad: '打不开：' + r.err });
      console.log('  ⛔ ' + name + ' —— ' + r.err);
      continue;
    }
    var scrollN = r.scrolls.length;
    var overAll = r.scrolls.reduce(function (t, s) { return t + s.d; }, 0);
    rows.push({ name: name, w: r.w, h: r.h, cls: r.cls, mainOver: r.mainOver,
      scrollN: scrollN, scrolls: r.scrolls, overAll: overAll });
    var tag = (r.mainOver > 2 || scrollN > 0) ? '⚠' : '✓';
    console.log('  ' + tag + ' ' + name.padEnd(11) + (r.w + '×' + r.h).padEnd(10) + (r.cls || 'md').padEnd(10)
      + '主溢出 ' + String(r.mainOver).padStart(4) + 'px · 滚动容器 ' + scrollN
      + (scrollN ? '（' + r.scrolls.map(function (s) { return s.cls + ':' + s.d; }).join(' | ') + '）' : ''));
    if (SHOTS && (r.mainOver > 2 || scrollN > 0)) {
      await page.screenshot({ path: path.join(OUT, 'm112-' + name.replace(/[^\w\u4e00-\u9fa5]/g, '') + '.png') });
    }
    await page.keyboard.press('Escape').catch(function () {});
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    await new Promise(function (rr) { setTimeout(rr, 90); });
  }

  /* ---------- 汇总 ---------- */
  var bad = rows.filter(function (x) {
    if (x.bad) return true;
    if (x.cls === 'view') return false;             /* 视图（大界面）本来就允许滚动，不算坏 */
    return x.mainOver > 2 || x.scrollN > 0;
  });
  console.log('\n===== 汇总：载荷体检 =====');
  console.log('  有滚动条/溢出 ' + bad.length + ' / 共 ' + rows.length);
  if (bad.length) {
    console.log('\n  ── 需要处理（按滚动容器数降序）──');
    bad.slice().sort(function (a, b) { return (b.scrollN || 0) - (a.scrollN || 0) || (b.mainOver || 0) - (a.mainOver || 0); })
      .forEach(function (x) {
        console.log('  ' + x.name.padEnd(11) + ((x.w || '?') + '×' + (x.h || '?')).padEnd(10)
          + '主溢出 ' + String(x.mainOver == null ? '?' : x.mainOver).padStart(4)
          + ' · 滚动容器 ' + (x.scrollN == null ? '?' : x.scrollN));
      });
  }
  var clean = rows.filter(function (x) { return !x.bad && x.mainOver <= 2 && x.scrollN === 0; });
  console.log('\n  ── 零滚动（合格）── ' + clean.map(function (x) { return x.name; }).join(' · '));
  console.log('\nSUMMARY ' + JSON.stringify({ total: rows.length, bad: bad.length,
    scrollFree: clean.length }));
  await browser.close();
  /* v89.112：--gate = 断言模式（0 问题才 0；供门禁/回归使用） */
  var GATE = process.argv.indexOf('--gate') >= 0;
  process.exit(GATE ? (bad.length === 0 ? 0 : 1) : 0);
})().catch(function (e) { console.error('探针异常：', e && e.message); process.exit(1); });
