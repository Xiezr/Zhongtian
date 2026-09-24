/* ============================================================
 * shot_v89107_doc.js — 公文五页签实机截图（v89.107）
 * ------------------------------------------------------------
 * 内容尽量走**游戏自己的出口**造：
 *   · 战报 → GAME.battle.expedition(...) 真打一场
 *   · 烽火 → 把 city.inv.nextAt 拨到临点，GAME.invasionTick() 真触发预警/来犯
 *   · 侦查 → 真派一次斥候（mode 'scout'）
 *   · 任务/系统 → GAME.log.task / GAME.log.sys（就是生产环境的那个出口）
 * 出图：v89107-doc-{war,scout,beacon,task,sys}.png
 * 顺带量：页签数、页签条数、正文溢出
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var seed = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.res.pop = 42000;
    c.army = { changqiang: 6000, gongjian: 3000, qingji: 1200 };
    /* 城内建几座（给系统消息一点真实来源） */
    var free = [];
    c.cells.forEach(function (x, i) { if (!x.official) free.push(i); });
    ['minfang', 'junying', 'shichang', 'cangku'].forEach(function (bid, k) {
      c.cells[free[k]].build = { id: bid, lvl: 4 };
    });
    G.ui.enterGame();
    G.ui.setView('reports');
    G.refreshAll();
    /* 造内容需要的两个前置（都是真实开关/出口）：
       ① battleWatch=false → 出征**自动结算**（战场观战关掉才会直接出战报）；
       ② 第 2 座城 → 定期来袭的解锁线是 2 城（DATA.INVASION.unlockCities） */
    st.settings.battleWatch = false;
    var w = null;
    for (var rr = 1; rr <= 4 && !w; rr++) {
      for (var wx = -rr; wx <= rr && !w; wx++) for (var wy = -rr; wy <= rr && !w; wy++) {
        var wt = G.map.tile(c.x + wx, c.y + wy);
        if (wt && wt.terrain === 'plain') w = { x: c.x + wx, y: c.y + wy };
      }
    }
    var got2 = false;
    if (w) {
      st.wilds = st.wilds || [];
      if (!st.wilds.some(function (x) { return x.x === w.x && x.y === w.y; })) {
        st.wilds.push({ x: w.x, y: w.y, type: 'plain', lv: 3 });
      }
      var city2 = G.buildCityAt(w.x, w.y);
      got2 = !!(city2 && city2.ok !== false);
    }
    return { city: c.name, second: got2, cities: st.cities.length };
  });
  console.log('开局：' + seed.city + ' · 建第二城 ' + (seed.second ? '✓' : '✗') + ' · 共 ' + seed.cities + ' 城');

  /* ---- 造内容（真出口） ---- */
  var made = await page.evaluate(function () {
    var G = window.GAME, s = G.state, c = G.currentCity(), out = { war: 0, scout: 0, beacon: 0 };
    /* ① 真打一场：找附近一块野地出征 */
    var t = null;
    for (var r = 1; r <= 4 && !t; r++) {
      for (var dx = -r; dx <= r && !t; dx++) {
        for (var dy = -r; dy <= r && !t; dy++) {
          var tt = G.map.tile(c.x + dx, c.y + dy);
          if (tt && tt.terrain !== 'city' && tt.terrain !== 'lake') t = { x: c.x + dx, y: c.y + dy, terrain: tt.terrain };
        }
      }
    }
    var gen = (s.generals || [])[0];
    if (t && gen) {
      gen.cityId = c.id; gen.status = 'idle';
      /* 打三场：三份战报（列表感要看得出来） */
      [1, 2, 3].forEach(function (k) {
        c.army = { changqiang: 6000, gongjian: 3000, qingji: 1200 };
        G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'raid',
          { changqiang: 2000, gongjian: 1000, qingji: 400 }, gen.id);
      });
      out.war = (s.reports || []).filter(function (x) { return x.type !== 'scout'; }).length;
      /* ② 真派一次斥候（侦查 → 结构化回报） */
      var r2 = G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'scout',
        { qingji: 200 }, gen.id);
      out.scout = (s.reports || []).filter(function (x) { return x.type === 'scout'; }).length;
    }
    /* ③ 烽火：把来袭时刻拨到预警窗内（真走 invasionTick 的预警分支），
       再拨到已到点（真结算一次来犯）—— 两轮，烽火页就有预警 + 战果两类行 */
    if (!c.inv) c.inv = { nextAt: 0, warned: false };
    var I = G.DATA.INVASION || {};
    [1, 2].forEach(function () {
      var now = (s.world && s.world.elapsed) || 0;
      c.inv.warned = false;
      c.inv.nextAt = now + ((I.warnHours || 12) + 4) * 3600;
      G.invasionTick(0);
      c.inv.warned = false;
      c.inv.nextAt = (s.world && s.world.elapsed) || 0;
      G.invasionTick(1);
    });
    out.beacon = G.msgsOf('beacon').length;
    /* ④ 任务 / 系统：走真实出口 */
    G.log.task('完成任务：屯田兴学（奖励：黄金 800 · 声望 20）');
    G.log.sys('🏗️ 建筑完成：军营 → Lv4');
    G.log.sys('🪓 得节钺 ×1（赏赐）· 现有 3');
    G.log.sys('🏯 城池改名：许都 → 许都');
    G.ui.setView('reports');
    G.refreshAll();
    return out;
  });
  console.log('造内容：战报 ' + made.war + ' 份 · 侦查回报 ' + made.scout + ' 份 · 烽火 ' + made.beacon + ' 条');

  await new Promise(function (r) { setTimeout(r, 500); });
  var tabs = ['war', 'scout', 'beacon', 'task', 'sys'];
  for (var i = 0; i < tabs.length; i++) {
    var info = await page.evaluate(function (id) {
      var el = document.querySelector('.doc-tabs [data-v="' + id + '"]');
      if (el) el.click();                       /* 点击 = 走真实动作派发（验接线） */
      return {
        clicked: !!el,
        tab: window.GAME.ui._docTab,
        counts: Array.prototype.map.call(document.querySelectorAll('.doc-tabs .mt'), function (x) {
          return x.textContent.replace(/\s+/g, '');
        })
      };
    }, tabs[i]);
    await new Promise(function (r) { setTimeout(r, 320); });
    var geo = await page.evaluate(function () {
      var b = document.querySelector('#doc-body');
      return { over: b ? (b.scrollHeight - b.clientHeight) : -1,
        lines: b ? b.querySelectorAll('.bb-line, .doc-bar').length : 0 };
    });
    var f = path.join(OUT, 'v89107-doc-' + tabs[i] + '.png');
    await page.screenshot({ path: f });
    console.log('✓ v89107-doc-' + tabs[i] + '.png  （页签=' + info.tab + ' · 正文 ' + geo.lines +
      ' 行 · 纵向溢出 ' + geo.over + '）');
    if (i === 0) console.log('   页签条：' + info.counts.join(' | '));
  }

  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('截图失败：' + (e && e.stack || e)); process.exit(1); });
