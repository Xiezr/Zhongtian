/* ============================================================
 * shot_v89156b_exp.js  实机：出征界面新布局（战斗型 / 己方野地）+ 侦察失败公文
 *   截图 3 张：
 *     · v89156-exp-battle.png  无主野地（战斗型：右列含预估 · 左列逐行含道具下拉 · 标题额度）
 *     · v89156-exp-own.png     己方野地（驻守：**无预估** + 标题「派驻上限」）
 *     · v89156-scout-fail.png  侦察失败公文（真路径：带守将野地 + 固定随机为失败）
 *   量测：弹窗纵向溢出（不许滚动条）、关键元素位置（左列/右列）。
 * 运行：node .workbuddy/tools/show/shot_v89156b_exp.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const pw = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/shots/';

let PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  const init = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    G.ui.enterGame();
    G.ui.closeAllModals();
    var c = G.state.cities[0];
    G.ui._cityId = c.id;
    if (!G.state.map.grid) G.map.generate();      /* ⚠️ 实机地图惰性生成 —— 不生成则 tile()=null → "坐标越界" */
    /* 练兵场 Lv5（标题显示"练兵场出征上限"）+ 一点兵 */
    c.cells.push({ build: { id: 'xiaochang', lvl: 5 }, pending: null });
    c.army = c.army || {};
    c.army.changqiang = 3200;
    c.army.gongjian = 1500;
    c.res.grain = 5e5; c.res.wood = 5e5; c.res.stone = 5e5; c.res.iron = 5e5; c.res.gold = 5e5;
    /* 找一块未占野地（靶） */
    var tx = -1, ty = -1;
    for (var rr = 2; rr <= 20 && tx < 0; rr++) {
      for (var dy = -rr; dy <= rr && tx < 0; dy++) for (var dx = -rr; dx <= rr && tx < 0; dx++) {
        var x = c.x + dx, y = c.y + dy;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;        /* ⚠️ tile 有效性必查（越界 → "坐标越界"） */
        if (G.map.npcAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
        if ((G.map.wildLevelNow(x, y) || 0) > 0) { tx = x; ty = y; }
      }
    }
    /* 己方野地（另一块） */
    var ox = c.x + 7, oy = c.y + 7;
    G.state.wilds = [{ x: ox, y: oy, type: 'lake', level: 6, day: 0, startDay: 0 }];
    return { tx: tx, ty: ty, ox: ox, oy: oy };
  });
  await p.waitForTimeout(500);
  console.log('seed: 靶野地 (' + init.tx + ',' + init.ty + ') · 己方野地 (' + init.ox + ',' + init.oy + ')');

  function R(el, k) { return el.getBoundingClientRect(); }

  /* ---------- ① 出征（战斗型 · 无主野地） ---------- */
  console.log('===== ① 出征界面 · 战斗型（无主野地） =====');
  await p.evaluate(function (o) { window.GAME.ui.openExpModal({ kind: 'wild', x: o.tx, y: o.ty }); }, init);
  await p.waitForTimeout(600);
  const r1 = await p.evaluate(function () {
    var G = window.GAME;
    var k = G.ui.appKOf ? G.ui.appKOf() : 1;
    var root = document.querySelector('#modal-root');
    var panel = root.querySelector('.inner-panel');
    var box = root.querySelector('.modal');
    var q = function (s) { return root.querySelector(s); };
    var rect = function (el) { var r2 = el.getBoundingClientRect(); return { t: r2.top / k, l: r2.left / k }; };
    var capEl = document.getElementById('exp-cap-t');
    var colL = root.querySelector('.exp-col-l'), colR = root.querySelector('.exp-col-r');
    var items = root.querySelector('.exp-a-items');
    var est = root.querySelector('.exp-a-est');
    var troops = root.querySelector('.exp-a-troops');
    return {
      overflow: panel.scrollHeight - panel.clientHeight,
      panelH: panel.clientHeight,
      capTxt: capEl ? capEl.textContent : '(无)',
      hasLimits: !!document.getElementById('exp-limits'),
      limitsTxt: (document.getElementById('exp-limits') || {}).textContent || '',
      hasItemSel: !!q('#exp-item-sel'),
      itemOpts: q('#exp-item-sel') ? q('#exp-item-sel').options.length : -1,
      hasEst: !!est,
      estAfterTroops: !!(est && troops && (troops.compareDocumentPosition(est) & 4)) !== false && !!(est && troops) && !!(troops.compareDocumentPosition(est) & 4),
      itemsInLeft: !!(items && colL && colR) && (function () {
        var ic = items.getBoundingClientRect(), lc = colL.getBoundingClientRect(), rc = colR.getBoundingClientRect();
        return ic.left >= lc.left - 6 && ic.left < rc.left;
      })(),
      quadCols: (function () {
        var qd = root.querySelector('.exp-quad');
        return qd ? getComputedStyle(qd).gridTemplateColumns.split(' ').length : -1;
      })(),
      hasWildcap: !!document.getElementById('exp-wildcap')
    };
  });
  console.log('    cap=' + r1.capTxt + ' · 溢出=' + r1.overflow + 'px · quad列数=' + r1.quadCols);
  chk('标题 = 练兵场出征上限标签', /练兵场出征上限/.test(r1.capTxt), r1.capTxt);
  chk('限制行容器在（无限制时为空）', r1.hasLimits, '内容="' + r1.limitsTxt.slice(0, 24) + '"');
  chk('可用道具 = 下拉框（在左列）', r1.hasItemSel && r1.itemsInLeft, 'options=' + r1.itemOpts);
  chk('预估在右列、位于派遣兵力之后', r1.hasEst && r1.estAfterTroops);
  chk('四块已单列（quad 单列）', r1.quadCols === 1, 'cols=' + r1.quadCols);
  chk('旧 exp-wildcap 已退役', !r1.hasWildcap);
  chk('弹窗无纵向溢出（不许滚动条）', r1.overflow <= 0, 'overflow=' + r1.overflow + ' · 正文高=' + r1.panelH);
  await p.locator('#modal-root .inner-panel').screenshot({ path: OUT + 'v89156-exp-battle.png' });

  /* ---------- ② 出征（己方野地 · 驻守 → 无预估） ---------- */
  console.log('===== ② 出征界面 · 己方野地（驻守） =====');
  await p.evaluate(function (o) { window.GAME.ui.openExpModal({ kind: 'wild', x: o.ox, y: o.oy }); }, init);
  await p.waitForTimeout(600);
  const r2 = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    var panel = root.querySelector('.inner-panel');
    var capEl = document.getElementById('exp-cap-t');
    return {
      overflow: panel.scrollHeight - panel.clientHeight,
      capTxt: capEl ? capEl.textContent : '(无)',
      hasEst: !!root.querySelector('.exp-a-est'),
      hasCargo: !!root.querySelector('.exp-a-cargo')
    };
  });
  console.log('    cap=' + r2.capTxt + ' · 溢出=' + r2.overflow + 'px');
  chk('己方野地：**无预估**', !r2.hasEst);
  chk('己方野地：标题 = 派驻上限', /派驻上限/.test(r2.capTxt), r2.capTxt);
  chk('己方野地无辎重区（transfer 专属）', !r2.hasCargo);
  chk('弹窗无纵向溢出', r2.overflow <= 0, 'overflow=' + r2.overflow);
  await p.locator('#modal-root .inner-panel').screenshot({ path: OUT + 'v89156-exp-own.png' });

  /* ---------- ③ 侦察失败（真路径 → 公文页） ---------- */
  console.log('===== ③ 侦察失败（真路径） =====');
  const r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    /* 找带守将的野地 */
    var c = G.currentCity(), foe = null;
    for (var rr = 2; rr <= 30 && !foe; rr++) {
      for (var dy = -rr; dy <= rr && !foe; dy++) for (var dx = -rr; dx <= rr && !foe; dx++) {
        var x = c.x + dx, y = c.y + dy;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;        /* ⚠️ tile 有效性必查 */
        if (G.map.npcAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
        var lv = G.map.wildLevelNow(x, y);
        if (!(lv > 0)) continue;
        var d = G.wildDefenseAt(x, y, lv);
        if (d && d.gen) foe = { x: x, y: y, lv: lv, name: d.gen.name };
      }
    }
    if (!foe) return { noFoe: true };
    var gen = G.state.generals[0];
    gen.status = 'idle';
    gen.stamina = G.staMax(gen); gen.energy = 100;
    var bk = window.Math.random;
    window.Math.random = function () { return 0.999; };     /* 必定失败 */
    var rf = G.battle.expedition({ kind: 'wild', x: foe.x, y: foe.y }, 'scout', {}, gen.id);
    window.Math.random = bk;
    /* 打开公文 · 侦查页（⚠️ 先设页签再渲染 —— 反了会渲染成默认页且不再重绘） */
    G.ui._docTab = 'scout';
    G.ui.setView('reports');
    G.ui.renderView('reports');
    return { ok: rf && rf.ok, fail: rf && rf.fail, msg: String(rf && rf.msg || '').slice(0, 80),
      foe: foe, repTitle: (G.state.reports[0] || {}).title || '' };
  });
  await p.waitForTimeout(700);
  console.log('    ' + JSON.stringify(r3).slice(0, 160));
  if (!r3.noFoe) {
    chk('真路径侦察失败（fail + msg）', r3.ok === true && r3.fail === true, r3.msg);
    chk('失败公文落账（侦查失败 · X）', /^侦查失败 · /.test(r3.repTitle), r3.repTitle);
    chk('公文侦查页含「侦查失败」行', await p.evaluate(function () {
      var vc = document.querySelector('#view-container');
      return (vc ? vc.textContent : '').indexOf('侦查失败') >= 0;
    }));
    await p.locator('#view-container').screenshot({ path: OUT + 'v89156-scout-fail.png' });   /* 元素图（整页图背景干扰判据） */
  } else {
    chk('找到带守将野地（前置）', false, '未找到 —— 跳过截图');
  }

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
