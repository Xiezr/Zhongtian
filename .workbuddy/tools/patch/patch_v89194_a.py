# -*- coding: utf-8 -*-
"""v89.194 批次A：S1 建筑升级金成本 + S4 欠俸降忠诚（data/domain）
纪律：锚点唯一断言 · 幂等（新特征计数判据）· newline='' · 写后自检
"""
import io, sys, os

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败：mark 未落盘'
    print('[ok] ' + tag)

DATA = R + 'js/data.js'
DOM = R + 'js/domain.js'

# ─────────────────────────────────────────────
# A1. data.js：DATA.BUILD_GOLD + buildGoldAt（唯一出口）
# ─────────────────────────────────────────────
A1_OLD = "  function costTable(arr, bid) {"
A1_NEW = '''  /* ============================================================
   * v89.194（老板 S1「同意建筑加维持金」· 源自 v89.192 价值体系报告 S1）
   * ------------------------------------------------------------
   * 建筑/城墙 Lv9 起的**升级金币成本**（营造金）—— 让金币在"高级工程"上
   * 有一个真实去向（报告诊断：金入账每秒连续，大额支出此前只有月俸）。
   * 档位（报告拍板的示例档 · 单座/级）：
   *   Lv1-8 = 0（**保前期流畅**，护栏口径——测试钉死）
   *   Lv9 = 3,000 · Lv10 = 6,000 · Lv11 = 12,000 · Lv12+ = 24,000（封顶，与资源封顶同规）
   * 语义：`levelCost(lv).gold` = 升到 lv+1 级的金成本（lv = 升级前等级），
   *   本函数以**目标等级**计。城外地块（farm 等）**不含**（S1 口径 = 建筑/城墙）。
   * 量级：单座升 Lv9-12 合计 4.5 万金；一座城 ~16 座 ≈ 72 万金 —— 月俸级日流量的 1/3 量级。
   * 消费链已就绪：canAffordIn / payCostIn / refundCert / cancelRefundOf / costString /
   *   buildCostTip 均**已支持 gold 键**（v89.161 起），本表即插即用、零新出口。
   * ⚠ 调平衡只动这张表（tiers 数组 + from）。
   * ============================================================ */
  DATA.BUILD_GOLD = { from: 9, tiers: [3000, 6000, 12000, 24000] };
  function buildGoldAt(targetLevel) {
    var G0 = DATA.BUILD_GOLD;
    if (!G0 || !G0.tiers || !G0.tiers.length) return 0;
    if (targetLevel < G0.from) return 0;
    var i = targetLevel - G0.from;
    if (i >= G0.tiers.length) i = G0.tiers.length - 1;
    return G0.tiers[i];
  }
  DATA.buildGoldAt = buildGoldAt;    /* 探针/断言同读（唯一出口） */

  function costTable(arr, bid) {'''
rep(DATA, 'A1 BUILD_GOLD 表+出口', A1_OLD, A1_NEW, 'DATA.buildGoldAt = buildGoldAt;')

# ─────────────────────────────────────────────
# A2. data.js：costTable 产出带 gold
# ─────────────────────────────────────────────
A2_OLD = """      o.time = buildTimeSec(bid, lv);   /* v89.128：时间列 = 曲线（唯一出口） */
      var jw = DATA.jewelCostAt(lv);"""
A2_NEW = """      o.time = buildTimeSec(bid, lv);   /* v89.128：时间列 = 曲线（唯一出口） */
      /* v89.194（老板 S1）：Lv9 起升级需营造金 —— 唯一出口 DATA.buildGoldAt */
      var _g194 = buildGoldAt(lv + 1);
      if (_g194 > 0) o.gold = _g194;
      var jw = DATA.jewelCostAt(lv);"""
rep(DATA, 'A2 costTable 带 gold', A2_OLD, A2_NEW, 'var _g194 = buildGoldAt(lv + 1);')

# ─────────────────────────────────────────────
# A3. data.js：LOYALTY 加欠俸扣减字段
# ─────────────────────────────────────────────
A3_OLD = """    faintMul: 0.5,          // 忠诚低于 warnAt 时，该将加成打折（半效）
  };"""
A3_NEW = """    faintMul: 0.5,          // 忠诚低于 warnAt 时，该将加成打折（半效）
    /* v89.194（老板 S4）：「欠俸降低忠诚度，忠诚度为 0 时将领无法出征」——
       v14.1 的「欠俸只警示不惩罚」由此**口径反转**（老板本轮明确拍板）；
       v89.40「君主不会掉忠诚」继续成立（君主豁免在 settleGenSalary 内）。 */
    salaryDrop: 10,         // 欠俸结算一次：该城将领忠诚 −10 × 期数（capped 计）
    salaryDropMax: 20,      // 单次结算封顶 −20（连欠 30 期也不一刀砍死）
  };"""
rep(DATA, 'A3 LOYALTY 欠俸字段', A3_OLD, A3_NEW, 'salaryDrop: 10,')

# ─────────────────────────────────────────────
# A4. domain.js：settleGenSalary 欠俸 → 扣忠诚
# ─────────────────────────────────────────────
A4_OLD = """    var paid = 0, short = 0;
    (s.cities || []).forEach(function (ct) {
      var per = 0;
      ((s.generals) || []).forEach(function (g) {
        if (g.cityId === ct.id) per += GAME.genSalaryOf(g);
      });
      if (!per) return;
      var amount = per * capped;
      var R = GAME.res(ct);
      var have = R.gold || 0;
      if (have >= amount) { R.gold = have - amount; paid += amount; }
      else { R.gold = 0; paid += have; short += amount - have; }
    });
    if (!paid && !short) return { periods: capped, paid: 0, short: 0 };
    var line = '💰 将领月俸结算（' + capped + ' 期）：金 −' + U.fmt(paid);
    if (short > 0) line += '；⚠️ 府库不足，欠俸 ' + U.fmt(short) + ' 金';
    GAME.log(line);
    return { periods: capped, paid: paid, short: short };"""
A4_NEW = """    var paid = 0, short = 0, owed = [];    /* owed：欠俸的城（v89.194 忠诚扣减对象） */
    (s.cities || []).forEach(function (ct) {
      var per = 0;
      ((s.generals) || []).forEach(function (g) {
        if (g.cityId === ct.id) per += GAME.genSalaryOf(g);
      });
      if (!per) return;
      var amount = per * capped;
      var R = GAME.res(ct);
      var have = R.gold || 0;
      if (have >= amount) { R.gold = have - amount; paid += amount; }
      else { R.gold = 0; paid += have; short += amount - have; owed.push(ct); }
    });
    if (!paid && !short) return { periods: capped, paid: 0, short: 0 };
    var line = '💰 将领月俸结算（' + capped + ' 期）：金 −' + U.fmt(paid);
    if (short > 0) line += '；⚠️ 府库不足，欠俸 ' + U.fmt(short) + ' 金';
    GAME.log(line);
    /* v89.194（老板 S4）：「欠俸降低忠诚度，忠诚度为 0 时将领无法出征」——
       口径反转（v14.1「欠俸只警示不惩罚」→ 有一害）。扣减对象 = **欠俸城**的全部将领；
       量 = min(salaryDrop × 期数, salaryDropMax)；君主豁免（v89.40 同源）；
       归零后出征闸由 marchBlockOf 兜底（界面置灰 + 硬拦同读一个出口）；
       唯一恢复 = 珠宝赏赐（gen-gift / 赏赐忠诚 +5~+36）。 */
    var drop194 = 0;
    var L194 = DATA.LOYALTY || {};
    if (short > 0 && (L194.salaryDrop || 0) > 0) {
      drop194 = Math.min((L194.salaryDrop || 0) * capped,
        L194.salaryDropMax == null ? 20 : L194.salaryDropMax);
      var hit194 = 0;
      owed.forEach(function (ct) {
        ((s.generals) || []).forEach(function (g) {
          if (g.cityId !== ct.id) return;
          if (GAME.isLordGeneral && GAME.isLordGeneral(g)) return;   /* 君主不扣（v89.40 同源） */
          var cur194 = g.loyalty == null ? 70 : g.loyalty;
          g.loyalty = Math.max(0, cur194 - drop194);
          hit194++;
        });
      });
      if (hit194) {
        GAME.log('⚠️ 欠俸挫伤军心（' + owed.length + ' 城 · ' + hit194 + ' 将）：忠诚 −' + drop194
          + '（赏赐珠宝可安抚）', 'sys', 'staff');
      }
    }
    return { periods: capped, paid: paid, short: short, drop: drop194 };"""
rep(DOM, 'A4 欠俸扣忠诚', A4_OLD, A4_NEW, 'var drop194 = 0;')

# ─────────────────────────────────────────────
# A5. domain.js：marchBlockOf 忠诚归零加闸
# ─────────────────────────────────────────────
A5_OLD = """    var st = g.status || 'idle';
    /* 硬拦只有两条：城主 / 守将（老板原话「城主和守将不能执行出征动作」）。"""
A5_NEW = """    var st = g.status || 'idle';
    /* v89.194（老板 S4）：「忠诚度为 0 时将领无法出征」——第三条硬拦。
       恢复路径 = 珠宝赏赐（+5~+36/颗，见 gen-gift-pick）；君主豁免（忠诚恒 100 本不适用，防老档脏值）。 */
    var loy194 = (g.loyalty == null ? 70 : g.loyalty);
    if (loy194 <= 0 && !(GAME.isLordGeneral && GAME.isLordGeneral(g))) return '忠诚已尽（赏赐珠宝可安抚）';
    /* 硬拦只有两条：城主 / 守将（老板原话「城主和守将不能执行出征动作」）。"""
rep(DOM, 'A5 marchBlockOf 忠诚闸', A5_OLD, A5_NEW, 'if (loy194 <= 0 && !(GAME.isLordGeneral && GAME.isLordGeneral(g))) return')

print('\n批次 A 全部完成。')
