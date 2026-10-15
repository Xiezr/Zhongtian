# -*- coding: utf-8 -*-
"""
patch_v89118h_cockpit2.py — 驾驶舱加固：沙盘验证记**战报引用**（消除错位）

背景：v89118_30h_full 报了 1 场 sandbox-verify-false（掠夺 平原 Lv6），
但**终档重跑同一条战报 verify=true**（60/60）。
诊断：`pendingVerify` 只是布尔 —— 检查发生在"下一次脑周期"，期间可能又插入
新战报，于是检查的 `st.reports[0]` **换了人**（错位假阳性）。
加固：标记时直接记**战报引用**；检查时若它已被挤出（60 上限）就跳过；
违规消息带 hist/sim 明细（下次真出问题一眼定位）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
GEN = R + '.workbuddy/tools/patch/patch_v89118d_playtest.py'
s = io.open(GEN, encoding='utf-8').read()


def edit(old, new, tag):
    global s
    n = s.count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次 → 中止' % (tag, n))
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ---------- 1. INV 字段：pendingVerify → pendingRep ----------
edit("""  sandboxChecked: 0, defReportNoSbx: 0,
  pendingVerify: false, slotLast: 0,""",
"""  sandboxChecked: 0, defReportNoSbx: 0,
  pendingRep: null, slotLast: 0,""",
'H1 INV 字段')

edit("""INV.count = function (msg) {
  if (msg.indexOf('🔥 烽火：') >= 0) INV.invasionWarn++;
  else if (msg.indexOf('🛡 ') === 0 && msg.indexOf('击退') >= 0) { INV.invasionHeld++; INV.pendingVerify = true; }
  else if (msg.indexOf('攻破城门') >= 0) { INV.invasionBreached++; INV.pendingVerify = true; }
  else if (msg.indexOf('城门失守但') >= 0) { INV.invasionFailBeacon++; INV.pendingVerify = true; }""",
"""INV.count = function (msg) {
  /* v89.118 加固：标记时直接抓**战报引用**（布尔标记会在下一次脑周期读到别人） */
  function markRep() {
    var rs = (GAME.state && GAME.state.reports) || [];
    INV.pendingRep = rs[0] || null;
  }
  if (msg.indexOf('🔥 烽火：') >= 0) INV.invasionWarn++;
  else if (msg.indexOf('🛡 ') === 0 && msg.indexOf('击退') >= 0) { INV.invasionHeld++; markRep(); }
  else if (msg.indexOf('攻破城门') >= 0) { INV.invasionBreached++; markRep(); }
  else if (msg.indexOf('城门失守但') >= 0) { INV.invasionFailBeacon++; markRep(); }""",
'H2 markRep')

# ---------- 2. driveV89118 的验证段 ----------
edit("""  /* ② 守城战报的沙盘 verify（来犯结算后核对一次） */
  if (INV.pendingVerify) {
    INV.pendingVerify = false;
    var rep0 = (st.reports || [])[0];
    if (rep0 && rep0.sandbox) {
      var sb = null;
      try { sb = G.battle.sandboxOf ? G.battle.sandboxOf(rep0) : null; } catch (e) { noteErr('sandboxOf', e); }
      if (sb && sb.verify === false) INV.viol('sandbox-verify-false', String(rep0.title || '').slice(0, 26));
      else if (sb) INV.sandboxChecked++;
      else INV.defReportNoSbx++;
    } else {
      /* 守城战报没配方 —— 记数（不算违规：未列阵/空城计等路径可能确实无沙盘） */
      if (rep0) INV.defReportNoSbx++;
    }
  }""",
"""  /* ② 战报沙盘 verify（v89.118 加固：核的是**标记时那条战报的引用**）——
        违规消息带 hist/sim 明细，真出问题一眼定位（错位假阳性已排除）。 */
  if (INV.pendingRep) {
    var rep0 = INV.pendingRep;
    INV.pendingRep = null;
    if (rep0 && (st.reports || []).indexOf(rep0) >= 0) {
      if (rep0.sandbox) {
        var sb = null;
        try { sb = G.battle.sandboxOf ? G.battle.sandboxOf(rep0) : null; } catch (e) { noteErr('sandboxOf', e); }
        if (sb && sb.verify === false) {
          var hR = rep0.sandbox.result || {};
          INV.viol('sandbox-verify-false', String(rep0.title || '').slice(0, 26)
            + '｜hist ' + hR.rounds + '/' + hR.atkLoss + '/' + hR.defLoss
            + '｜sim ' + sb.sim.rounds + '/' + sb.sim.atkLoss + '/' + sb.sim.defLoss);
        } else if (sb) INV.sandboxChecked++;
        else INV.defReportNoSbx++;
      } else {
        /* 没配方的战报 —— 记数（未列阵/空城计等路径可能确实无沙盘，不算违规） */
        INV.defReportNoSbx++;
      }
    }
  }""",
'H3 验证段加固')

tmp = GEN + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, GEN)
print('生成器已加固（三处）→ 重新生成 play_v89118.js')
