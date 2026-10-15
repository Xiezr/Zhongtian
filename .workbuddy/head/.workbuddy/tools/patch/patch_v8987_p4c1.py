# -*- coding: utf-8 -*-
"""v89.87 需求4c-1：快照数据补全（towers / maxRounds / gapLast）"""
import io

# ---------- tactic.js：snap 补 towers/maxRounds ----------
P1 = r'E:\Deepseekdb\js\tactic.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()
old1 = "      return { round: round, field: D, atk: atk.map(cp), def: def.map(cp) };"
new1 = """      return { round: round, field: D, atk: atk.map(cp), def: def.map(cp),
        maxRounds: T.MAX_ROUNDS,
        /* 攻城时的城防箭塔（界面显示"余 N / M 座"用） */
        towers: (opts.sieging && towerStart > 0) ? { start: towerStart, left: towerAliveNow() } : null };"""
assert s1.count(old1) == 1, ('tactic', s1.count(old1))
io.open(P1, 'w', encoding='utf-8', newline='').write(s1.replace(old1, new1, 1))
print('OK tactic.js snap')

# ---------- battle.js：stepBattle 存 gapLast；rec 初值补 gapLast ----------
P2 = r'E:\Deepseekdb\js\battle.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()
old2 = """    rec.round = r.r;
    rec.evLast = r.events || [];
    rec.snapLast = r.snap || null;"""
new2 = """    rec.round = r.r;
    rec.gapLast = r.gap;
    rec.evLast = r.events || [];
    rec.snapLast = r.snap || null;"""
assert s2.count(old2) == 1, ('step', s2.count(old2))
s2 = s2.replace(old2, new2, 1)

old3 = """      cmd: {}, history: [], snapLast: null, evLast: [],
      bornAt: U.now(),"""
new3 = """      cmd: {}, history: [], snapLast: null, evLast: [], gapLast: null,
      bornAt: U.now(),"""
assert s2.count(old3) == 1, ('rec', s2.count(old3))
s2 = s2.replace(old3, new3, 1)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('OK battle.js gapLast')
