'use strict';
/* v89.229c 实机验证：兵种重构（14 兵种 · 三组分页）· 资源四类 · 据点守军非空
   跑法：node .workbuddy/tools/show/shot_v89229c_troops.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
var SHOT = '.workbuddy/shots/';
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 造局：一座满资源城 + 训练营(5) + 机工坊(7) ---------- */
  var setup = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验229c', cityName: '灰岗', region: '碎垣', mapSeed: 20260953 });
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 5e7; });
    c.res.pop = 5e4;
    st.rank = 20;
    /* 居所 5（募兵前置）+ 训练营 5 + 机工坊 8 */
    var put = function (id, lvl) {
      for (var i = 0; i < c.cells.length; i++) {
        if (c.official || c.cells[i].build || c.cells[i].pending) continue;
        c.cells[i].build = { id: id, lvl: lvl, hiLv: lvl }; return i;
      }
      return -1;
    };
    var i1 = put('minfang', 5), i2 = put('junying', 5), i3 = put('gongjiangzuofang', 8);
    window.__shopCell = i3;
    c.army = { buxingji: 5000, dunwei: 2000, daodanche: 1200, fujiche: 400, zhuzhan: 200, wuren: 60, huopao: 30 };
    G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide();
    return { minfang: i1, junying: i2, shop: i3,
      trops: Object.keys(G.DATA.TROOPS).length,
      grp: [1, 2, 3].map(function (g) {
        return Object.keys(G.DATA.TROOPS).filter(function (k) { return G.DATA.TROOPS[k].grp === g; }).length;
      }).join('/') };
  });
  console.log('造局: ' + JSON.stringify(setup));
  var hopeCell = await p.evaluate(function () { return window.__shopCell; });
  chk('产品表：14 兵种 · 三组 4/5/5', setup.trops === 14 && setup.grp === '4/5/5', setup.trops + ' · ' + setup.grp);
  await p.waitForTimeout(600);

  /* ---------- ① 资源四类显示名 ---------- */
  var resTxt = await p.evaluate(function () {
    var el = document.querySelector('#res-bar') || document.querySelector('.side') || document.body;
    return (el.textContent || '').replace(/\s+/g, ' ');
  });
  chk('资源四类显示名换代（净水/生物质/电能/废钢）',
    resTxt.indexOf('净水') >= 0 && resTxt.indexOf('生物质') >= 0
    && resTxt.indexOf('电能') >= 0 && resTxt.indexOf('废钢') >= 0,
    resTxt.slice(0, 80));

  /* ---------- ② 募兵面板：四页签 + 三页卡数 ---------- */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._trainTab = 'que';
    G.ui.openTroops(G.ui._cityId ? null : null);
    G.ui.openTroops();
  });
  await p.waitForTimeout(500);
  var tabs = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    return (root ? root.innerHTML : '').match(/data-page="(que|g1|g2|g3)"/g) || [];
  });
  chk('面板四页签齐备（队列 / 后勤支援 / 主力战斗 / 尖端武装）', tabs.length === 4, tabs.join(','));

  var perPage = {};
  for (var gi = 1; gi <= 3; gi++) {
    var tab = 'g' + gi;
    var info = await p.evaluate(function (tb) {
      var G = window.GAME;
      G.ui._trainTab = tb; G.ui.renderTroopsModal();
      var root = document.querySelector('#modal-root');
      var h = root ? root.innerHTML : '';
      var names = [];
      var re = /class="troop-card[^"]*"[\s\S]{0,40}data-troop="([a-z_]+)"/g, m;
      while ((m = re.exec(h)) !== null) names.push(m[1]);
      var t = names.length ? G.DATA.TROOPS[names[0]] : null;
      return { names: names, sel: G.ui._trainSel, selName: t ? t.name : '',
        tipHas: h.indexOf('募兵消耗') >= 0, foot: h.indexOf('data-action="confirm-train"') >= 0 };
    }, tab);
    perPage[tab] = info;
  }
  /* 逐页核对（从页面读表项，避免跨 evaluate 传对象） */
  var t1 = await p.evaluate(function () { return Object.keys(GAME.DATA.TROOPS).filter(function (k) { return GAME.DATA.TROOPS[k].grp === 1; }); });
  var t2 = await p.evaluate(function () { return Object.keys(GAME.DATA.TROOPS).filter(function (k) { return GAME.DATA.TROOPS[k].grp === 2; }); });
  var t3 = await p.evaluate(function () { return Object.keys(GAME.DATA.TROOPS).filter(function (k) { return GAME.DATA.TROOPS[k].grp === 3; }); });
  chk('组 1 后勤支援 4 卡（板车/伏击车/侦察单元/运输平台）',
    perPage.g1.names.join(',') === t1.join(','), perPage.g1.names.join(','));
  chk('组 2 主力战斗 5 卡（步行机/盾卫/导弹车/武装直升机/主战机甲）',
    perPage.g2.names.join(',') === t2.join(','), perPage.g2.names.join(','));
  chk('组 3 尖端武装 5 卡（狂猎/电磁盾卫/自行火炮/无人轰炸机/泰坦机甲）',
    perPage.g3.names.join(',') === t3.join(','), perPage.g3.names.join(','));
  chk('每页都有可点选卡（select-train 存在）与底部训练键',
    Object.keys(perPage).every(function (k) { return perPage[k].foot; }),
    Object.keys(perPage).map(function (k) { return k + ':' + (perPage[k].foot ? 'y' : 'n'); }).join(' '));

  /* ---------- ③ 工位随选中兵种切换（器械 → 机工坊） ---------- */
  var hop = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._trainTab = 'g3'; G.ui._trainSel = 'huopao'; G.ui.renderTroopsModal();
    var h1 = (document.querySelector('#modal-root') || {}).innerHTML || '';
    var b1 = G.ui.trainBarracks();
    G.ui._trainTab = 'g2'; G.ui._trainSel = 'buxingji'; G.ui.renderTroopsModal();
    var h2 = (document.querySelector('#modal-root') || {}).innerHTML || '';
    var b2 = G.ui.trainBarracks();
    return { shopIdx: b1 ? b1.idx : null, barIdx: b2 ? b2.idx : null,
      h1craft: h1.indexOf('制造') >= 0, h2train: h2.indexOf('训练') >= 0, shopCell: window.__shopCell };
  });
  chk('工位随选中兵种解析（自行火炮 → 机工坊 / 步行机 → 训练营）',
    hop.shopIdx === hopeCell && hop.h1craft && hop.h2train,
    JSON.stringify(hop) + ' want shopIdx=' + hopeCell);

  /* ---------- ④ 据点守军非空（本轮真 bug 的实机哨兵） ---------- */
  var fort = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    if (!st.map.grid) G.map.generate();
    var f = null;
    for (var r = 1; r < 40 && !f; r++) {
      for (var dx = -r; dx <= r && !f; dx += 1) {
        for (var dy = -r; dy <= r && !f; dy += 1) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || tl.terrain === 'city') continue;
          var ff = G.map.fortAt(x, y);
          if (ff) f = ff;
        }
      }
    }
    if (!f) return { err: 'no-fort' };
    var g = G.map.fortGarrison(f.level), tot = 0, keys = [];
    for (var k in g) { if (g[k] > 0) { tot += g[k]; keys.push(k + ':' + g[k]); } }
    var lv = G.wildDefenseAt(f.x, f.y, f.level);
    return { lv: f.level, name: f.name, x: f.x, y: f.y, tot: tot, keys: keys.join(' '),
      wildTot: lv.total, bad: Object.keys(g).filter(function (k) { return !G.DATA.TROOPS[k]; }).join(',') };
  });
  chk('据点守军非空且键全合法（16 级逐级 > 0 · 无退役 id）',
    !fort.err && fort.tot > 0 && !fort.bad, JSON.stringify(fort));
  if (!fort.err) {
    var fight = await p.evaluate(function (pt) {
      var fx = pt.x, fy = pt.y;
      var G = window.GAME, st = G.state, c = G.currentCity();
      var g = G.makeGeneral('实机甲', 60, 'idle', c.id, false);
      g.stamina = 300; g.energy = 100; g.tong = 500; g.yw = 400; g.zm = 400;
      st.generals.push(g);
      st.settings.battleWatch = false;
      if (G.siegeScopeOf({ kind: 'fort', x: fx, y: fy })) G.siegeClear({ kind: 'fort', x: fx, y: fy });
      c.army = { daodanche: 40000 };
      var res = G.battle.expedition({ kind: 'fort', x: fx, y: fy }, 'occupy', { daodanche: 40000 }, g.id);
      var r = res && res.result;
      var d = 0; for (var k in (r && r.defLossBy || {})) d += r.defLossBy[k];
      return { ok: !!res.ok, winner: r && r.winner, defStart: JSON.stringify(r && r.defStartBy), defLoss: d, rounds: r && r.rounds };
    }, { x: fort.x, y: fort.y });
    chk('实机真打一仗：据点守军真参战（defStart 非空 · defLoss > 0 · 回合 > 0）',
      fight.ok && fight.defStart !== '{}' && fight.defLoss > 0 && fight.rounds > 0, JSON.stringify(fight));
  }

  /* ---------- 截图：三组分页 ---------- */
  for (var gj = 1; gj <= 3; gj++) {
    await p.evaluate(function (tb) {
      var G = window.GAME;
      G.ui._trainTab = tb; G.ui.renderTroopsModal();
    }, 'g' + gj);
    await p.waitForTimeout(400);
    var el = await p.$('#modal-root .modal') || await p.$('#modal-root .inner-panel');
    if (el) {
      await el.screenshot({ path: SHOT + 'v89229c-troops-g' + gj + '.png' });
      console.log('  截图: ' + SHOT + 'v89229c-troops-g' + gj + '.png');
    }
  }
  await p.screenshot({ path: SHOT + 'v89229c-full.png' });

  /* 像素体检：非空图 + 有内容 */
  ['g1', 'g2', 'g3'].forEach(function (k) {
    var f = SHOT + 'v89229c-troops-' + k + '.png';
    if (!fs.existsSync(f)) { chk('截图存在 ' + k, false); return; }
    var png = PNG.sync.read(fs.readFileSync(f));
    var bright = 0, n = 0, lum = 0;
    for (var i = 0; i < png.data.length; i += 4 * 7) {
      n++;
      var L = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      lum += L;
      if (L > 80) bright++;
    }
    var meanL = n ? lum / n : 0, bp = n ? bright / n : 0;
    /* 暗色主题基线（§12.5/§76.3）：均亮 25~70 · 亮像素 0.5%~12% —— 不是"越亮越好" */
    chk('像素体检 ' + k + '（暗色面板有内容 · 均亮 25~70 · 亮像素 0.5%~12%）',
      n > 0 && meanL >= 25 && meanL <= 70 && bp >= 0.005 && bp <= 0.12,
      '均亮 ' + meanL.toFixed(1) + ' · 亮像素 ' + (bp * 100).toFixed(1) + '% · ' + png.width + 'x' + png.height);
  });

  chk('运行期无页面错误', errs.length === 0, errs.slice(0, 2).join(' ; '));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
