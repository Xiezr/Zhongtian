# -*- coding: utf-8 -*-
"""v89.160 补丁 E：smoke —— ① 升级旧"同级城内优先"结构断言（口径退役）
② 新增 §160 一节（逾溢折损 6 条 + 自动升级顺延 5 条）"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'smoke-test.js'


def rep(tag, old, new, guard):
    s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-40s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 命中 %d 次' % (tag, n)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-40s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── ① 结构断言升级：城内优先口径退役 ──
rep('smoke · 结构断言升级（取消城内优先）',
    """  check('结构：同级排序只剩「城内建筑（含城墙）→ 城外资源」', (function () {
    var body = codeOf(dmS, 'GAME.autoUpgrade = function');
    return /KIND_ORD = \\{ city: 0, ext: 2 \\}/.test(body)
      && /KIND_ORD\\[a\\.kind\\] - KIND_ORD\\[b\\.kind\\]/.test(body);
  })());""",
    """  check('结构：v89.160 起**取消城内优先** —— 只按等级（同级按候选收集序 ord）', (function () {
    var body = codeOf(dmS, 'GAME.autoUpgrade = function');
    /* 老板 2：「取消城内优先」—— 旧口径 KIND_ORD（城内 0 / 城外 2 的分档）必须**整条退役** */
    return body.indexOf('KIND_ORD') < 0
      && /cands\\.forEach\\(function \\(c, i\\) \\{ c\\.ord = i; \\}\\)/.test(body)
      && /return a\\.ord - b\\.ord;/.test(body);
  })());""",
    'v89.160 起**取消城内优先**')

# ── ② 新增 §160 ──
SEC = r"""  /* ============================================================
   * §160. v89.160：
   *   ① 逾溢折损（超出仓容上限的部分每游戏日折损 25% · 鼠灾/火灾/风化/腐蚀）
   *   ② 自动升级：取消城内优先 + 某项不足则**顺延**下一项（全部试遍才暂停）
   * ============================================================ */
  console.log('\n===== 160. v89.160（逾溢折损 · 自动升级顺延） =====');
  (function () {
    var fs160 = require('fs'), p160 = require('path');
    var dS160 = stripComment(fs160.readFileSync(p160.join(__dirname, 'js', 'domain.js'), 'utf8'));
    var sS160 = stripComment(fs160.readFileSync(p160.join(__dirname, 'js', 'state.js'), 'utf8'));
    var uS160 = fs160.readFileSync(p160.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mS160 = fs160.readFileSync(p160.join(__dirname, 'js', 'main.js'), 'utf8');
    /* 本节自带造局器（§126 的 withState 是本文件**另一段 IIFE 内的局部函数**，
       在文件末尾不可见 —— 这正是"同名变量别跨段用"的老坑） */
    function withFresh160(name, fn) {
      var keep = G.state;
      try {
        var st = G.newGame({ name: name });
        G.state = st;
        if (G.map.generate) G.map.generate();
        return fn(st);
      } finally { G.state = keep; }
    }

    /* ---- ① 逾溢折损 ---- */
    check('§160① 数据表口径：4 种受限资源 / 25% / 1 游戏日 / 老板点名的四灾',
      (function () {
        var C = DATA.OVERFLOW || {};
        return JSON.stringify(C.keys) === JSON.stringify(['grain', 'wood', 'stone', 'iron'])
          && C.ratio === 0.25 && C.periodGameHours === 24
          && ['鼠灾', '火灾', '风化', '腐蚀'].every(function (n) {
            return (C.events || []).some(function (e) { return e.name === n; });
          });
      })());
    check('§160① 唯一出口群：overflowRotOf / overflowLossOf / overflowEventOf / settleOverflowRot 各 1 处',
      (function () {
        return (dS160.match(/GAME\.overflowRotOf = function/g) || []).length === 1
          && (dS160.match(/GAME\.overflowLossOf = function/g) || []).length === 1
          && (dS160.match(/GAME\.overflowEventOf = function/g) || []).length === 1
          && (dS160.match(/GAME\.settleOverflowRot = function/g) || []).length === 1;
      })());
    check('§160① 真调：1 期 = 超出部分的 25% · 只发一条公文（含灾种与损失明细）· 黄金豁免',
      (function () {
        var st = G.state, c = G.currentCity();
        var bkG = st.res.grain, bkGold = st.res.gold, bkAt = st.overflowAt, bkW = st.world.elapsed;
        var n0 = (st.msgLog || []).length;
        try {
          var cap = G.storeCapOf(c);
          G.res(c).grain = cap + 100000; G.res(c).gold = 9e9;
          if (st.overflowAt == null) { G.settleOverflowRot(); }
          st.overflowAt = st.world.elapsed;
          st.world.elapsed += 86400;
          var r = G.settleOverflowRot();
          var L160 = st.msgLog || [];
          var msg = (L160[L160.length - 1] || {}).msg || '';
          var named = (DATA.OVERFLOW.events || []).some(function (e) { return msg.indexOf(e.name) >= 0; });
          return r && r.total === 25000 && Math.round(G.res(c).grain) === Math.round(cap + 75000)
            && (st.msgLog || []).length === n0 + 1 && named && /损失/.test(msg)
            && G.res(c).gold === 9e9;
        } finally {
          st.res.grain = bkG; st.res.gold = bkGold; st.overflowAt = bkAt; st.world.elapsed = bkW;
        }
      })());
    check('§160① 真调：多期按 (1−0.75^n) 复利 · 超出 ≥1 至少损 1 · 未超则静默',
      (function () {
        var st = G.state, c = G.currentCity();
        var bkG = st.res.grain, bkAt = st.overflowAt, bkW = st.world.elapsed;
        try {
          var cap = G.storeCapOf(c);
          st.overflowAt = st.world.elapsed;
          G.res(c).grain = cap + 100000;
          st.world.elapsed += 2 * 86400;
          var r2 = G.settleOverflowRot();
          var ok2 = r2.periods === 2 && r2.total === Math.round(100000 * (1 - Math.pow(0.75, 2)));
          G.res(c).grain = cap + 2;                 /* 小额：至少损 1 */
          st.world.elapsed += 86400;
          var r3 = G.settleOverflowRot();
          G.res(c).grain = cap - 1;                 /* 未超：静默 */
          var n0 = (st.msgLog || []).length;
          st.world.elapsed += 86400;
          var r4 = G.settleOverflowRot();
          var quiet = (r4 == null || r4.total === 0) && (st.msgLog || []).length === n0;
          /* 不足一期不结算 */
          G.res(c).grain = cap + 100000;
          st.overflowAt = st.world.elapsed;
          st.world.elapsed += 3600;
          var r5 = G.settleOverflowRot();
          return ok2 && r3.total === 1 && quiet && r5 === null && G.res(c).grain === cap + 100000;
        } finally {
          st.res.grain = bkG; st.overflowAt = bkAt; st.world.elapsed = bkW;
        }
      })());
    check('§160① 挂钩：tickOnce 与 simulateBulk **同一个**结算函数（在线/离线不各写一份）',
      /GAME\.settleOverflowRot\(\)/.test(sS160)
      && (sS160.match(/GAME\.settleOverflowRot\(\)/g) || []).length === 2);
    check('§160① 界面出口：侧栏悬停折损行 + 仓库面板折损行（机制可见）',
      /超出部分每游戏日折损/.test(uS160) && /逾溢折损：超出仓容上限的部分/.test(uS160)
      && /当前超出上限/.test(uS160));

    /* ---- ② 自动升级：取消城内优先 + 顺延 ---- */
    check('§160② 真调：贵项排在前面也不挡路 —— 顺延命中后面那一项（不再当场暂停）',
      (function () {
        return withFresh160('v160skip', function (st) {
          var c = st.cities[0];
          c.cells.forEach(function (x) { if (x.build && x.build.id !== 'guanfu') x.build = null; });
          c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
          G.extGridOf(c).forEach(function (e) { e.type = null; e.lv = 0; e.pending = null; });
          c.cells[0].build = { id: 'tiejiangpu', lvl: 1 };   /* 贵（6238）且在遍历序前面 */
          c.cells[1].build = { id: 'minfang', lvl: 1 };      /* 便宜（1720） */
          if (G.wallSlotOf(c).build) G.wallSlotOf(c).build = null;
          var costM = DATA.BUILDINGS.minfang.levelCost(1);
          ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = costM[k] || 0; });
          st.settings.autoUpgrade = true;
          st.queues.build.length = 0;
          var r = G.autoUpgrade();
          var q = (st.queues.build || []).filter(function (x) { return x.cityId === c.id; });
          st.queues.build.length = 0;
          c.cells[1].pending = null;
          return !!(r && r.ok) && r.target && r.target.idx === 1 && /民房/.test(r.target.name || '')
            && q.length === 1 && Number(q[0].gridIndex) === 1;
        });
      })(), '旧口径：第一项不足就暂停 → 后面的项永远轮不到');
    check('§160② 真调：全部试遍仍无一可动 → 暂停（开关不关 · 文案写明"试遍"）',
      (function () {
        return withFresh160('v160all', function (st) {
          var c = st.cities[0];
          st.settings.autoUpgrade = true;
          st.queues.build.length = 0;
          ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 0; });
          var r = G.autoUpgrade();
          var okp = !!(r && r.paused === true) && st.settings.autoUpgrade === true
            && /试遍/.test((st.autoState || {}).msg || '');
          st.settings.autoUpgrade = false; st.autoState = null;
          return okp;
        });
      })());
    check('§160② 文案同步（面板说明 + 开启提示都不再说"城内优先"）',
      /不再区分城内城外/.test(uS160) && /顺延试下一项/.test(uS160)
      && /某项不足则顺延下一项/.test(mS160)
      && uS160.indexOf('同级城内优先') < 0 && mS160.indexOf('同级城内优先') < 0);
    check('§160② 需求档案在册（v89.160 · 老板原文关键句逐字）', (function () {
      var arc = fs160.readFileSync(p160.join(__dirname, '需求档案.md'), 'utf8');
      return arc.indexOf('v89.160') >= 0
        && arc.indexOf('扣减超出部分的百分之25%') >= 0
        && arc.indexOf('鼠灾，火灾，风化，腐蚀') >= 0
        && arc.indexOf('自动升级取消城内优先') >= 0;
    })());
  })();

"""
OLDT = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
NEWT = SEC + OLDT
rep('smoke · 新增 §160 节', OLDT, NEWT, '160. v89.160（逾溢折损 · 自动升级顺延）')

print('\n补丁 E 完成。')
