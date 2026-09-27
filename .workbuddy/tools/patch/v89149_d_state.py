# -*- coding: utf-8 -*-
"""v89.149 批 D：state.js —— 守城落账段发声望（守方视角 · 读 atkLossBy）"""
import io

P = 'E:/Deepseekdb/js/state.js'
BAK = 'E:/Deepseekdb/backup/v89149/state.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()

A = """    var repDrop = Math.round(severity * (L.repDrop || 0));"""
N = """    /* v89.149（老板 1）：**守城视角**落一笔战功声望（我方 = 守方）——
       敌军 = 攻方 → 歼灭军力读 `atkLossBy`（视角由 `battleRepView` 显式转换，
       不靠猜字段 —— 与 v89.116「captiveGain 靠 target 猜视角必错」同一条教训）。
       口径与出征同源（GAME.battle.grantBattleRep 唯一出口，表在 DATA.REP_RULE）。 */
    if (result && GAME.battle && GAME.battle.grantBattleRep) {
      try {
        GAME.battle.grantBattleRep(result, 'def', held, '守城');
      } catch (e4) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 声望异常：', e4);
      }
    }
    var repDrop = Math.round(severity * (L.repDrop || 0));"""

if 'grantBattleRep(result, \'def\', held' in s and A not in s:
    print('SKIP(已落) 守城声望')
else:
    n = s.count(A)
    assert n == 1, '锚点不唯一/缺失 count=' + str(n)
    s = s.replace(A, N)
    print('OK 守城声望')

assert s.count("grantBattleRep(result, 'def', held, '守城')") == 1
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('state.js 落盘 · len=' + str(len(s)))
