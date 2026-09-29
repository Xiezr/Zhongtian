# -*- coding: utf-8 -*-
"""v89.194 批次C：smoke 断言跟进（金门槛造局补前置 + 缺料提示新口径）
纪律：锚点唯一断言（脚本内）+ 幂等（新特征计数）+ newline='' + 写后 node --check
"""
import io

R = 'E:/Deepseekdb/'
SM = R + 'smoke-test.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark, cnt=1):
    s = rd(SM)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(SM, s)
    s2 = rd(SM)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败'
    print('[ok] ' + tag)

# C1. §159④：造局补金（Lv9 起升级另需营造金）
rep('C1 §159④ 补金',
"""      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
      /* 12→13 的珠宝需求补足（本用例验门槛，不验材料） */""",
"""      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
      /* v89.194（老板 S1）：Lv9 起升级另需营造金 —— 本用例验门槛，成本一并备足 */
      S102.gold = 1e9;
      /* 12→13 的珠宝需求补足（本用例验门槛，不验材料） */""",
'S102.gold = 1e9;')

# C2. 珠宝断言的支付前置（同）
rep('C2 珠宝用例补金',
"""      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { st.res[k] = 1e9; });
      st.items = {};
      var no = G.canAfford(cost);""",
"""      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { st.res[k] = 1e9; });
      st.gold = 1e9;    /* v89.194：升 13 级另需营造金 2.4 万（本用例只验珠宝那一维） */
      st.items = {};
      var no = G.canAfford(cost);""",
'st.gold = 1e9;    /* v89.194：升 13 级另需营造金 2.4 万')

# C3. 界面判据：'珠宝不足（' 已并入 costLackMsg 唯一出口（升级判据，§0.7）
rep('C3 界面判据升级',
"""      return /💎 珠宝/.test(u4) && /GAME\\.costJewelText/.test(u4)
        && /珠宝不足（/.test(d4);""",
"""      /* v89.194：升级判据 —— 缺料提示统一走 GAME.costLackMsg（珠宝在缺料清单里，
         costJewelText 是它的珠宝段出口）。旧判据查"珠宝不足（"字面（已并入出口）。 */
      return /💎 珠宝/.test(u4) && /GAME\\.costJewelText/.test(u4)
        && /GAME\\.costLackMsg/.test(d4);""",
'/GAME\\.costLackMsg/.test(d4);')

# C4. §108④：补金
rep('C4 §108④ 补金',
'    st108.res.grain = 1e9; st108.res.wood = 1e9; st108.res.stone = 1e9; st108.res.iron = 1e9;',
"""    st108.res.grain = 1e9; st108.res.wood = 1e9; st108.res.stone = 1e9; st108.res.iron = 1e9;
    st108.gold = 1e9;   /* v89.194（老板 S1）：Lv9 起升级另需营造金（本用例验时间曲线） */""",
'st108.gold = 1e9;   /* v89.194（老板 S1）')

# C5. §157③：补金 + 备份/还原
rep('C5 §157③ 补金',
"""      var bk = { lvl: c.cells[gIdx].build.lvl, wall: JSON.stringify(G.wallSlotOf(c)),
        q: (s.queues.build || []).slice(), res: {} };
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { bk.res[k] = c.res[k]; c.res[k] = 1e9; });""",
"""      var bk = { lvl: c.cells[gIdx].build.lvl, wall: JSON.stringify(G.wallSlotOf(c)),
        q: (s.queues.build || []).slice(), res: {}, gold: c.res.gold };
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { bk.res[k] = c.res[k]; c.res[k] = 1e9; });
      c.res.gold = 1e9;   /* v89.194（老板 S1）：11→12 另需营造金 2.4 万（本用例验城墙门槛） */""",
'c.res.gold = 1e9;   /* v89.194（老板 S1）：11→12 另需营造金 2.4 万')
rep('C5b §157③ 还原金',
"""        Object.keys(bk.res).forEach(function (k) { c.res[k] = bk.res[k]; });
      }
      if (!(r1 && r1.ok === false && /城墙/.test(r1.msg || '')))""",
"""        Object.keys(bk.res).forEach(function (k) { c.res[k] = bk.res[k]; });
        c.res.gold = bk.gold;   /* v89.194：金一并还原 */
      }
      if (!(r1 && r1.ok === false && /城墙/.test(r1.msg || '')))""",
'c.res.gold = bk.gold;   /* v89.194：金一并还原 */')

# C6. §159③：备份变量 + 补金 + 还原
rep('C6a §159③ 备份变量',
'    var bkCity159b = G.ui._cityId, bkRes159b = {}, bkItems159b = {};',
'    var bkCity159b = G.ui._cityId, bkRes159b = {}, bkItems159b = {}, bkGold159b = st.gold;',
'bkGold159b = st.gold;')
rep('C6b §159③ 补金',
"""        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
        var _c = DATA.BUILDINGS.minfang.levelCost(12) || {};""",
"""        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
        st.gold = 1e9;    /* v89.194（老板 S1）：12→13 另需营造金 2.4 万（本用例验官府总闸） */
        var _c = DATA.BUILDINGS.minfang.levelCost(12) || {};""",
'st.gold = 1e9;    /* v89.194（老板 S1）：12→13 另需营造金')
rep('C6c §159③ 还原金',
"""        for (var jk2 in bkItems159b) st.items[jk2] = bkItems159b[jk2];
        G.ui._cityId = bkCity159b;""",
"""        for (var jk2 in bkItems159b) st.items[jk2] = bkItems159b[jk2];
        st.gold = bkGold159b;   /* v89.194：金一并还原 */
        G.ui._cityId = bkCity159b;""",
'st.gold = bkGold159b;   /* v89.194：金一并还原 */')

# C7. §161：判据升级（新缺料提示口径 · §0.7）
rep('C7 §161 判据升级',
"        var blocked = r.ok === false && /本城资源不足/.test(r.msg || '') && sum4(G.res(c)) === beforeA;",
"""        /* v89.194：缺料提示统一走 costLackMsg（"缺 粮食 …（现 0）"）——判据跟新口径 */
        var blocked = r.ok === false && /(本城资源不足|缺 )/.test(r.msg || '') && sum4(G.res(c)) === beforeA;""",
"var blocked = r.ok === false && /(本城资源不足|缺 )/.test(r.msg || '')")

print('\n批次 C 全部完成。')
