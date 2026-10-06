# -*- coding: utf-8 -*-
# v89.207 批次 B2：新增 §207 段（smoke + e2e）+ 版本号 v89.207
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    assert '\r\n' not in s, 'CRLF leak!'
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

SMOKE = 'E:/Deepseekdb/smoke-test.js'
E2E = 'E:/Deepseekdb/e2e-test.js'
MAIN = 'E:/Deepseekdb/js/main.js'

# ══════ B2-a：smoke §207 段 ══════
s = rd(SMOKE)
if '§207（v89.207）' in s:
    print('[skip] B2a smoke §207 已在')
else:
    anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert s.count(anchor) == 1, 'B2a anchor=' + str(s.count(anchor))
    frag = """  /* ============================================================
   * §207（v89.207）：快赢五条 + 离线纪要 + 战斗增速档
   *   老板：「1.按快赢建议执行 2.完善离线补偿，沙盘推演，睡眠补偿」
   *   ① 图标 title（快赢①）② 数字键（快赢②）③ toast 合并（快赢③）
   *   ④ 增速档（快赢④）⑤ 离线纪要（老板 2）⑥ 节拍唯一出口 ⑦ 档案在册
   * ============================================================ */
  (function () {
    var fs207 = require('fs'), p207 = require('path');
    var uS207 = fs207.readFileSync(p207.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mS207 = fs207.readFileSync(p207.join(__dirname, 'js', 'main.js'), 'utf8');
    var dS207 = fs207.readFileSync(p207.join(__dirname, 'js', 'data.js'), 'utf8');
    var uStrip207 = stripComment(uS207);

    /* ① 图标按钮 title（快赢① · 全仓唯二缺口已补） */
    check('§207①（快赢①）纯图标按钮全带 title（数量步进 −/＋ 实查）', (function () {
      return /data-d="-1" title="减少数量"/.test(uS207)
        && /data-d="1" title="增加数量"/.test(uS207);
    })());

    /* ② 数字快捷键（快赢②） */
    check('§207②（快赢②）数字键 1-9 切视图 + 输入/弹窗态护栏（源码形态）', (function () {
      return /_vi207 = \\['city'/.test(mS207)
        && /_tn207 === 'INPUT'/.test(mS207)
        && /ui\\.modalVisible && ui\\.modalVisible\\(\\)\\) return;/.test(mS207)
        && /ui\\.setView\\(_vi207\\[/.test(mS207);
    })());

    /* ③ toast 合并（快赢③）：真调 */
    check('§207③（快赢③）toast 相邻同文案合并（×N）· 异文案不合并（真调）', (function () {
      var bk = ui._notes.slice(), bkTimer = ui._toastTimer;
      try {
        ui._notes = [];
        ui.notify('info', '测试甲');
        ui.notify('info', '测试甲');
        ui.notify('info', '测试乙');
        var n = ui._notes;
        return n.length === 2 && n[0].n === 2 && n[0].msg === '测试甲' && n[1].n === 1;
      } finally {
        ui._notes = bk;
        if (ui._toastTimer) clearTimeout(ui._toastTimer);
        ui._toastTimer = bkTimer;
      }
    })());

    /* ④ 增速档（快赢④）：结构 + 真调节拍折算 */
    check('§207④（快赢④）增速档：出口组 + 表值 + 两宿主在册 + 真调节拍折算（含脏值回落）', (function () {
      var okSrc = uStrip207.indexOf('ui.btWatchDelay = function') >= 0
        && uStrip207.indexOf('ui.btSpdHTML = function') >= 0
        && /DATA\\.BATTLE_WATCH = \\{ firstMs: 620, eventMs: 260, speeds: \\[1, 2, 4\\] \\};/.test(dS207)
        && uS207.indexOf('ui.btSpdHTML() +') >= 0
        && /\\(sim \\? '' : ui\\.btSpdHTML\\(\\)\\) \\+/.test(uS207);
      var bk = ui._btSpd;
      try {
        ui._btSpd = 1;
        var d1 = ui.btWatchDelay(260);
        ui._btSpd = 2; var d2 = ui.btWatchDelay(260);
        ui._btSpd = 4; var d4 = ui.btWatchDelay(260);
        ui._btSpd = 3; var d3 = ui.btWatchDelay(260);
        return okSrc && d1 === 260 && d2 === 130 && d4 === 65 && d3 === 260;
      } finally { ui._btSpd = bk; }
    })());

    /* ⑤ 离线纪要（老板 2）：门槛 + 双通道触发 + via 归集 + 标题分流（真调渲染） */
    check('§207⑤（老板 2）离线纪要：reportSec 门槛 · 双通道触发 · via 归集 · 标题分流（真调渲染）', (function () {
      var okSrc = /reportSec: 1800/.test(dS207)
        && /function _gapNotify207\\(gap\\)/.test(mS207)
        && mS207.indexOf('_gapNotify207(_pulse199.gap)') >= 0
        && mS207.indexOf('_gapNotify207(r.gap)') >= 0
        && uS207.indexOf("via: _silent193 ? 'online' : 'reload'") >= 0
        && /_online207 \\? '离线纪要' : '归来报告'/.test(uS207);
      var bk = G._offlineReport;
      try {
        G._offlineReport = { secReal: 3700, applied: 3700, overflow: 0, capDays: 7, via: 'online',
          res: {}, done: {}, reports: [], reportsN: 0, wounded: 0, marchMsg: '', autoBattles: 0 };
        var h1 = ui.offlineReportHTML();
        G._offlineReport.via = 'reload';
        var h2 = ui.offlineReportHTML();
        return okSrc && h1.indexOf('离线纪要') >= 0 && h1.indexOf('归来报告') < 0
          && h2.indexOf('归来报告') >= 0 && h2.indexOf('离线纪要') < 0;
      } finally { G._offlineReport = bk; }
    })());

    /* ⑥ btPlay 旧散数退役（节拍唯一出口） */
    check('§207⑥ btPlay 节拍接唯一出口（260/620 = 表值 · 裸 setTimeout 零残留）', (function () {
      var seg = codeOf(uS207, 'ui.btPlay = function');
      return seg.indexOf('ui.btWatchDelay((DATA.BATTLE_WATCH || {}).eventMs || 260)') >= 0
        && seg.indexOf('ui.btWatchDelay((DATA.BATTLE_WATCH || {}).firstMs || 620)') >= 0
        && seg.indexOf('setTimeout(next, 260)') < 0
        && seg.indexOf('setTimeout(next, 620)') < 0;
    })());

    /* ⑦ 需求档案在册 */
    check('§207⑦ 需求档案在册（v89.207 · 老板原文关键句）', (function () {
      var a = fs207.readFileSync(p207.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.207') >= 0 && a.indexOf('按快赢建议执行') >= 0;
    })());
  })();

"""
    s = s.replace(anchor, frag + anchor)
    wr(SMOKE, s)
    print('[ok] B2a smoke §207 已插')

# ══════ B2-b：e2e §207 段 ══════
s = rd(E2E)
if '§207（v89.207）' in s:
    print('[skip] B2b e2e §207 已在')
else:
    anchor = '\n  return finish();'
    assert s.count(anchor) == 1, 'B2b anchor=' + str(s.count(anchor))
    frag = """

  /* ============================================================
   * §207（v89.207）：数字快捷键（真派发）· 离线纪要（真渲染）· 增速档（真调）
   * ============================================================ */
  {
    console.log('\\n--- §207. v89.207 快赢 + 离线纪要 + 增速档（真实 DOM） ---');

    /* ①/② 数字键真派发 + 两条护栏（弹窗开着 / 输入态） */
    const bkView207 = G.ui.view;
    try {
      G.ui.setView('reports');
      await sleep(160);
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true }));
      await sleep(200);
      check('§207① 数字键 1 → 切城池视图（真派发）', G.ui.view === 'city', 'view=' + G.ui.view);
      G.ui.openModal('<div class="gold-heading">测试窗</div>');
      await sleep(150);
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', bubbles: true }));
      await sleep(200);
      const inModal207 = !!G.ui.modalVisible();
      const viewA207 = G.ui.view;
      G.ui.closeAllModals();
      await sleep(100);
      check('§207② 弹窗打开时数字键不切视图（护栏）', inModal207 && viewA207 === 'city', 'view=' + viewA207);
      const inp207 = document.createElement('input');
      document.body.appendChild(inp207);
      inp207.focus();
      inp207.dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true }));
      await sleep(200);
      const viewB207 = G.ui.view;
      if (inp207.parentNode) inp207.parentNode.removeChild(inp207);
      check('§207③ 输入框聚焦时数字键不切视图（不抢输入）', viewB207 === 'city', 'view=' + viewB207);
    } catch (e207a) {
      check('§207① 数字键真派发', false, String(e207a && e207a.message || e207a));
    } finally {
      G.ui.closeAllModals();
      G.ui.setView(bkView207);
      await sleep(120);
    }

    /* ④ 离线纪要 / 归来报告 标题分流（真渲染 · 真弹窗） */
    const bkRep207 = G._offlineReport;
    try {
      G._offlineReport = { secReal: 3700, applied: 3700, overflow: 0, capDays: 7, via: 'online',
        res: {}, done: {}, reports: [], reportsN: 0, wounded: 0, marchMsg: '', autoBattles: 0 };
      G.ui.openOfflineReport();
      await sleep(220);
      const mrT207 = (document.querySelector('#modal-root') || {}).textContent || '';
      check('§207④ 离线纪要弹窗（via=online · 真渲染 + 知道了键）',
        mrT207.indexOf('离线纪要') >= 0 && mrT207.indexOf('知道了') >= 0,
        mrT207.slice(0, 60));
      G.ui.closeAllModals();
      await sleep(100);
      G._offlineReport.via = 'reload';
      G.ui.openOfflineReport();
      await sleep(220);
      const mrT207b = (document.querySelector('#modal-root') || {}).textContent || '';
      check('§207⑤ 归来报告弹窗（via=reload 标题分流）', mrT207b.indexOf('归来报告') >= 0,
        mrT207b.slice(0, 60));
      G.ui.closeAllModals();
      await sleep(100);
    } catch (e207b) {
      check('§207④ 离线纪要真渲染', false, String(e207b && e207b.message || e207b));
    } finally {
      G._offlineReport = bkRep207;
      G.ui.closeAllModals();
      await sleep(80);
    }

    /* ⑥ 增速档真调 + 按钮组真渲染（结构） */
    const bkSpd207 = G.ui._btSpd;
    try {
      G.ui.btSpdSet(2);
      const d2207 = G.ui.btWatchDelay(260);
      G.ui.btSpdSet(4);
      const d4207 = G.ui.btWatchDelay(620);
      check('§207⑥ 增速档真调：2× → 130ms · 4× → 155ms（620 / 4）',
        d2207 === 130 && d4207 === 155, 'd2=' + d2207 + ' d4=' + d4207);
      const wrap207 = document.createElement('div');
      wrap207.innerHTML = G.ui.btSpdHTML();
      const btns207 = wrap207.querySelectorAll('[data-action="bt-spd"]');
      check('§207⑦ 增速按钮组三档齐备（1×/2×/4× · 唯一渲染出口）', btns207.length === 3,
        'n=' + btns207.length);
    } catch (e207c) {
      check('§207⑥ 增速档真调', false, String(e207c && e207c.message || e207c));
    } finally {
      G.ui._btSpd = bkSpd207;
    }
  }"""
    s = s.replace(anchor, frag + anchor)
    wr(E2E, s)
    print('[ok] B2b e2e §207 已插')

# ══════ B2-c：版本号 ══════
s = rd(MAIN)
if "GAME.VERSION = 'v89.207'" in s:
    print('[skip] B2c main 版本号已在')
else:
    old = "GAME.VERSION = 'v89.205';"
    assert s.count(old) == 1, 'B2c count=' + str(s.count(old))
    s = s.replace(old, "GAME.VERSION = 'v89.207';")
    wr(MAIN, s)
    print('[ok] B2c main 版本号 v89.207')

s = rd(SMOKE)
old = "/GAME\\.VERSION = 'v89\\.205'/.test(mS199)   /* v89.205：版本号每轮迭代更新（本条随轮升级） */"
if "v89\\.207'/.test(mS199)" in s:
    print('[skip] B2c smoke 版本断言已在')
else:
    assert s.count(old) == 1, 'B2c-s count=' + str(s.count(old))
    s = s.replace(old, "/GAME\\.VERSION = 'v89\\.207'/.test(mS199)   /* v89.207：版本号每轮迭代更新（本条随轮升级） */")
    wr(SMOKE, s)
    print('[ok] B2c smoke 版本断言')

print('=== B2 完成 ===')
