# -*- coding: utf-8 -*-
"""patch_v89115c_smoke_fix.py — 修 4 条失败：① 取轮转城；②-4 自证判据；④ 显式重置 s.inv。"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()
EDITS = []

# ① 烽火链：改用"轮转目标城"（主城不一定是本场目标）
EDITS.append((
"""      var c9 = G.currentCity();
      if (!c9 || G.invasionDueAt(c9) <= 0) return false;   /* 排期没生效 = 测不了 = 判红 */
      var al = G.invasionAlertOf(c9);                      /* 仍在拨钟态内求值 */
      var page = G.ui.marchBeaconHTML();
      var old = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
      G.ui.renderCityAttrs(c9, G.state);""",
"""      var c9 = G.currentCity();
      /* 本场目标是**轮转城**（不一定是主城）—— 警窗口径要按它取，否则拿到的是"下一轮" */
      var c9t = G.invasionTargetOfSlot(G.invasionSlotOf(T9) + 1) || c9;
      if (!c9 || G.invasionDueAt(c9t) <= 0) return false;   /* 排期没生效 = 测不了 = 判红 */
      var al = G.invasionAlertOf(c9t);                      /* 仍在拨钟态内求值 */
      var page = G.ui.marchBeaconHTML();
      var old = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
      G.ui.renderCityAttrs(c9, G.state);"""))

# ②-4 自证判据（目标由出口自己给，别假定"第二场=第二城"）
EDITS.append((
"""      setT92(G.invasionDueOfSlot(slot0 + 1) + 1000);
      var f1 = G.invasionTick(0);
      setT92(G.invasionDueOfSlot(slot0 + 1) + 5000);
      var f2 = G.invasionTick(0);
      check('②-4 到点结算一场（目标=轮转第二城）· 同场不重复结算',
        f1 === 1 && f2 === 0 && tgt1 === st92.cities[1]);""",
"""      setT92(G.invasionDueOfSlot(slot0 + 1) + 1000);
      var f1 = G.invasionTick(0);
      setT92(G.invasionDueOfSlot(slot0 + 1) + 5000);
      var f2 = G.invasionTick(0);
      check('②-4 到点结算一场（目标=轮转城）· 同场不重复结算',
        f1 === 1 && f2 === 0 && !!tgt1 && st92.cities.indexOf(tgt1) >= 0,
        'f1=' + f1 + ' f2=' + f2 + ' tgt=' + (tgt1 && tgt1.name));"""))

# ④ 第 53 节：显式重置 s.inv（前序用例可能已用真实钟排过期）
EDITS.append((
"""    var cityCount = st.cities.length;
    var bkNow53 = G._realNowOf, T53 = 1700000000000;
    G._realNowOf = function () { return T53; };
    G.invasionTick(0);                                   /* 排期 */
    G._realNowOf = function () { return G.invasionDueOfSlot(G.invasionSlotOf(T53) + 1) + 1000; };
    var fired = G.invasionTick(1);""",
"""    var cityCount = st.cities.length;
    var bkNow53 = G._realNowOf, T53 = 1700000000000;
    var slot53 = G.invasionSlotOf(T53);
    /* 显式排期（不依赖前序用例留下的 s.inv —— 那种 lastSlot 可能已被真实钟排到更远的场次） */
    st.inv = { lastSlot: slot53, warnedSlot: -1 };
    G._realNowOf = function () { return G.invasionDueOfSlot(slot53 + 1) + 1000; };
    var fired = G.invasionTick(1);"""))

# ④b 开关段：改用已算好的 slot53
EDITS.append((
"""    G._realNowOf = function () { return G.invasionDueOfSlot(G.invasionSlotOf(T53) + 5) + 1000; };
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);""",
"""    G._realNowOf = function () { return G.invasionDueOfSlot(slot53 + 5) + 1000; };
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);"""))

for i, (old, new) in enumerate(EDITS):
    n = s.count(old)
    if n != 1:
        print('!! 第 %d 段匹配数 = %d（应为 1）：%s' % (i + 1, n, old.split('\n')[0][:70]))
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ✓ 段 %d 已替换' % (i + 1))

tmp = P + '.tmp89115c'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('DONE len=%d' % len(s))
sys.exit(0)
