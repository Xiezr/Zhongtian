# -*- coding: utf-8 -*-
"""
patch_v89118g_cockpit.py — 驾驶舱补驱动（晋爵 / 扩张 / 名城门槛）

做法：改写**生成器** patch_v89118d_playtest.py，再重跑它生成 play_v89118.js。
  G1：driveV89118 内补 ③晋爵（v89.108 领地上限后不晋爵就扩不动）与 ④扩张（建新城）。
  G2：往生成器里**插入两条 edit 调用** —— 由生成器去改源文件的 MILE 表
      （名城攻坚 at 19200→7200、门槛 150000→20000，让 30h 试玩真打一场名城）。
  G3：inv_final.json 输出补 promotes / promoteMsg。
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


# ---------- G1：driveV89118 补 ③晋爵 / ④扩张 ----------
edit("""  /* ③ 来犯排期推进（只记进度，供收尾对账） */
  var slotNow = G.invasionSlotOf ? G.invasionSlotOf(G.realNow()) : 0;
  if (slotNow > INV.slotLast) INV.slotLast = slotNow;
}""",
"""  /* ③ 晋爵（v89.118 补驱动）：领地上限 = 下一档爵位门槛（v89.108）——
        不晋爵就扩不动：旧驾驶舱因此整场停在 2 城（实测）。 */
  if (tNow - (INV.lastPromoteAt || -1e9) >= 240) {
    INV.lastPromoteAt = tNow;
    var pr = null;
    try { pr = G.systems.promote(); } catch (e3) { noteErr('promote', e3); }
    if (pr && pr.ok) {
      INV.promotes = (INV.promotes || 0) + 1;
      RUN('🏅 晋爵：' + pr.msg + '（领地上限 ' + G.cityCapOf() + ' 座）');
    } else if (pr && !pr.ok && !INV.promoteMsg) {
      INV.promoteMsg = String(pr.msg || '');          /* 首次记录原因（分析用） */
    }
  }
  /* ④ 扩张（v89.118 补驱动）：有爵位空间就找平原建新城 —— 覆盖多城路径 */
  if (tNow - (INV.lastExpandAt || -1e9) >= 480) {
    INV.lastExpandAt = tNow;
    var capE = G.cityCapOf ? G.cityCapOf() : 0;
    if ((st.cities || []).length < capE) {
      var spotE = findPlainSpot();
      if (spotE) {
        var reE = null;
        try { reE = G.buildCityAt(spotE.x, spotE.y); } catch (e4) { noteErr('expand', e4); }
        if (reE && reE.ok) RUN('🏙 建新城：' + (reE.msg || '') + '（城 ' + st.cities.length + '/' + capE + '）');
      }
    }
  }
  /* ⑤ 来犯排期推进（只记进度，供收尾对账） */
  var slotNow = G.invasionSlotOf ? G.invasionSlotOf(G.realNow()) : 0;
  if (slotNow > INV.slotLast) INV.slotLast = slotNow;
}""",
'G1 晋爵+扩张驱动')

# ---------- G2：插入两条 edit 调用（改源文件 MILE 表） ----------
G2_BLOCK = '''# ---------- 3.5 名城攻坚战（改**源文件** MILE 表：提前 + 降门槛） ----------
edit("""  { id: 'npcAtk', at: 19200, done: false, retries: 0, fn: function () {""",
"""  { id: 'npcAtk', at: 7200, done: false, retries: 0, fn: function () {""",
'G2a 名城攻坚提前')
edit("""      if (totalArmy() < 150000) { RUN('📋 名城攻坚评估：兵力 ' + fmtNum(totalArmy()) + ' 不足以挑战名城（跳过实攻，作为内容深度结论）'); return 'ok'; }""",
"""      /* v89.118：门槛 150000 → 20000（30h 试玩实测兵力 12.6 万，旧门槛永远跳过；
         降门槛让试玩**真打一场名城** —— 覆盖斗将 / 名城守将 / 守城沙盘两路）。 */
      if (totalArmy() < 20000) { RUN('📋 名城攻坚评估：兵力 ' + fmtNum(totalArmy()) + ' 不足以挑战名城（跳过实攻，作为内容深度结论）'); return 'ok'; }""",
'G2b 名城门槛')

'''
edit("# ---------- 4. 8.5 段（新功能驱动 + 不变量 + 视图体检） ----------",
     G2_BLOCK + "# ---------- 4. 8.5 段（新功能驱动 + 不变量 + 视图体检） ----------",
     'G2 插入名城 edit 调用')

# ---------- G3：inv_final 补字段 ----------
edit("""    sandbox: { checked: INV.sandboxChecked, noSandbox: INV.defReportNoSbx },
    duelMentions: INV.duelMentions,""",
"""    sandbox: { checked: INV.sandboxChecked, noSandbox: INV.defReportNoSbx },
    duelMentions: INV.duelMentions,
    promotes: INV.promotes || 0,
    promoteMsg: INV.promoteMsg || '',""",
'G3 inv_final 补字段')

tmp = GEN + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, GEN)
print('生成器已更新（三处）→ 重新生成 play_v89118.js')
