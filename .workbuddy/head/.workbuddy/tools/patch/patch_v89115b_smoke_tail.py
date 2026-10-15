# -*- coding: utf-8 -*-
"""
patch_v89115b_smoke_tail.py — smoke 剩余 5 处旧口径（第 53 节 / §93 实测 / 空城计）改现实时间。
每段：断言"替换前存在且唯一" → 替换；最后语法无关的自检（关键串 + node --check 另跑）。
"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()
orig_len = len(s)
EDITS = []

# ---- A. 第 53 节：排期断言 ----
EDITS.append((
"""    check('首次推进后给出排期（invasionDueAt = 下一个来犯时刻 · 目标=轮转城）', (function () {
      G.invasionTick(0);
      var due = G.invasionDueAt(c);
      return due > 0 && due === G.invasionDueOfDay(G.invasionDayOf(due))
        && (due - ((st.world && st.world.elapsed) || 0)) <= 86400;
    })());""",
"""    check('首次推进后给出排期（invasionDueAt = 下一场来犯时刻 · 目标=轮转城）', (function () {
      G.invasionTick(0);
      var due = G.invasionDueAt(c);
      var P = DATA.INVASION.realMin * 60000;                 /* v89.115：现实毫秒口径 */
      return due > 0 && due % P === 0 && due > G.realNow()
        && (due - G.realNow()) <= P * st.cities.length;
    })());"""))

# ---- B. 第 53 节：到点必触发 + 开关（拨现实钟）----
EDITS.append((
"""    /* ---- 到点必触发（v89.111：拨到当天 9:01，结算当天那一场）+ 不丢城 ---- */
    var cityCount = st.cities.length;
    var now = st.world.elapsed || 0;
    st.world.elapsed = G.invasionDueOfDay(G.invasionDayOf(now)) + 60;   /* 当天 9:01 */
    var fired = G.invasionTick(1);
    check('每日 9 时到点必触发（当天一场）', fired === 1, 'fired=' + fired);
    check('同日再推进不重复结算（一天只有一场）', G.invasionTick(0) === 0);""",
"""    /* ---- 到点必触发（v89.115：覆写现实钟，拨到"下一场 +1 秒"）+ 不丢城 ---- */
    var cityCount = st.cities.length;
    var bkNow53 = G._realNowOf, T53 = 1700000000000;
    G._realNowOf = function () { return T53; };
    G.invasionTick(0);                                   /* 排期 */
    G._realNowOf = function () { return G.invasionDueOfSlot(G.invasionSlotOf(T53) + 1) + 1000; };
    var fired = G.invasionTick(1);
    check('到点必触发（一场）', fired === 1, 'fired=' + fired);
    check('同一场再推进不重复结算（一场只打一次）', G.invasionTick(0) === 0);"""))

# ---- C. 第 53 节：开关边界 ----
EDITS.append((
"""    st.settings.invasion = false;
    st.world.elapsed += 86400 + 3600;    /* 再跨一天：开着闸必打，关着闸不许打 */
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);""",
"""    st.settings.invasion = false;
    /* v89.115：再跨 5 场（拨现实钟）：开着闸必打，关着闸不许打 */
    G._realNowOf = function () { return G.invasionDueOfSlot(G.invasionSlotOf(T53) + 5) + 1000; };
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);"""))

# ---- D. §93：源码扫描断言字段改名 ----
EDITS.append((
"""          && /I\\.attackHour/.test(seg) && /I\\.ratioMin/.test(seg) && /I\\.warnHours/.test(seg);""",
"""          && /I\\.realMin/.test(seg) && /I\\.ratioMin/.test(seg) && /I\\.warnMin/.test(seg);"""))

# ---- E. §93 实测：拨现实钟 ----
EDITS.append((
"""        var d93 = G.invasionDayOf((st93.world && st93.world.elapsed) || 0);
        var due93 = G.invasionDueOfDay(d93) + 60;
        if (due93 <= ((st93.world || {}).elapsed || 0)) { d93 += 1; due93 = G.invasionDueOfDay(d93) + 60; }
        st93.world.elapsed = due93;
        st93.inv = { lastDay: d93 - 1, warnedDay: -1 };
        var fired93 = G.invasionTick(0);""",
"""        /* v89.115：来袭改现实时间节奏 —— 覆写现实钟到"下一场 +1 秒"（用完还原） */
        var bkNow93 = G._realNowOf, T93 = 1700000000000;
        var slot93 = G.invasionSlotOf(T93) + 1;
        G._realNowOf = function () { return G.invasionDueOfSlot(slot93) + 1000; };
        st93.inv = { lastSlot: slot93 - 1, warnedSlot: -1 };
        var fired93 = G.invasionTick(0);
        G._realNowOf = bkNow93;"""))

# ---- F. 空城计：拨现实钟 ----
EDITS.append((
"""    var now0 = (s.world && s.world.elapsed) || 0;
    var d = G.invasionDayOf(now0);
    var due = G.invasionDueOfDay(d) + 60;
    if (due <= now0) { d += 1; due = G.invasionDueOfDay(d) + 60; }
    s.world.elapsed = due;
    GAME.schemeDefSet(c, 'kongcheng', null);
    s.inv = { lastDay: d - 1, warnedDay: -1 };
    var fired1 = GAME.invasionTick(0);
    var consumed = !GAME.schemeDefOf(c, 'kongcheng');
    s.inv = { lastDay: d - 1, warnedDay: -1 };
    var fired2 = GAME.invasionTick(0);""",
"""    /* v89.115：来袭改现实时间节奏 —— 覆写现实钟到"下一场 +1 秒"，用完还原 */
    var bkNowKC = G._realNowOf, TKC = 1700000000000;
    var slotKC = G.invasionSlotOf(TKC) + 1;
    G._realNowOf = function () { return G.invasionDueOfSlot(slotKC) + 1000; };
    GAME.schemeDefSet(c, 'kongcheng', null);
    s.inv = { lastSlot: slotKC - 1, warnedSlot: -1 };
    var fired1 = GAME.invasionTick(0);
    var consumed = !GAME.schemeDefOf(c, 'kongcheng');
    s.inv = { lastSlot: slotKC - 1, warnedSlot: -1 };
    var fired2 = GAME.invasionTick(0);
    G._realNowOf = bkNowKC;"""))

# ---- G. 空城计注释里的旧口径说明 ----
EDITS.append((
"""    /* v89.111：来袭改"每日 9 时一场（目标轮转）"——
       本用例临时只留一城（目标必然是它）+ 时钟拨到最近一个 9:01（最多 +1 天），
       并摆"这一天尚未结算"（s.inv.lastDay = 前一天）。用完还原。 */""",
"""    /* v89.115：来袭 = 现实时间节奏（每 realMin 分钟一场、目标轮转）——
       本用例临时只留一城（目标必然是它）+ 覆写现实钟到"下一场 +1 秒"，
       并摆"上一场已结算"（s.inv.lastSlot = 目标场 - 1）。用完还原。 */"""))

for i, (old, new) in enumerate(EDITS):
    n = s.count(old)
    if n != 1:
        print('!! 第 %d 段匹配数 = %d（应为 1）' % (i + 1, n))
        print('   片段首行: ' + old.split('\n')[0][:80])
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ✓ 段 %d 已替换' % (i + 1))

tmp = P + '.tmp89115b'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)

chk = io.open(P, encoding='utf-8').read()
bad = []
for kw in ['invasionDueOfDay(', 'invasionDayOf(', "lastDay:"]:
    if kw in chk:
        bad.append(kw)
print('DONE 剩余旧口径引用: %s  长度 %d -> %d' % (bad or '无', orig_len, len(chk)))
sys.exit(0 if not bad else 1)
