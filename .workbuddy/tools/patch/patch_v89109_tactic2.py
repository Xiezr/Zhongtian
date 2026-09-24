# -*- coding: utf-8 -*-
"""v89.109：tactic.js —— playerDef 透传（我方城防御读玩家战术）+ 出城部队起/余统计"""
import io, os
p = r'E:/Deepseekdb/js/tactic.js'
s = io.open(p, encoding='utf-8').read()

# ① def 侧 ctx 加 playerDef
a1 = """    var def = T.unitsOf(defArmy, 'def', defGen,
      { sieging: !!opts.sieging, override: stances.def || null });"""
b1 = """    var def = T.unitsOf(defArmy, 'def', defGen,
      /* v89.109：`playerDef` = 守方是**我方城池**（防御战）→ 读玩家「防守战术」设置；
         NPC 守方不传（仍用默认动作）—— 见 GAME.tacticOf 的 def 分支。 */
      { sieging: !!opts.sieging, playerDef: !!opts.playerDef, override: stances.def || null });"""
assert a1 in s, '①未命中'
s = s.replace(a1, b1, 1)

# ② 统计出城部队初始数（放在 aStart 统计旁）
a2 = """    var dStart = def.reduce(function (n, u) { return n + u.start; }, 0);"""
b2 = """    var dStart = def.reduce(function (n, u) { return n + u.start; }, 0);
    /* v89.109：出城迎战部队的初始人数（掠夺前置判据"先歼灭野战军"要用） */
    var defSortieStart = 0;
    def.forEach(function (u) { if (u.sortie) defSortieStart += u.start; });"""
assert a2 in s, '②未命中'
s = s.replace(a2, b2, 1)

# ③ finish：算 defSortieLeft 并进 _fin
a3 = """    var aBy = lossBy(atk), dBy = lossBy(def);"""
b3 = """    var aBy = lossBy(atk), dBy = lossBy(def);
    /* v89.109：出城迎战部队的**存活**人数（0 = 野战军已被歼灭） */
    var defSortieLeft = 0;
    def.forEach(function (u) { if (u.sortie && u.count > 0) defSortieLeft += u.count; });"""
assert a3 in s, '③未命中'
s = s.replace(a3, b3, 1)

a4 = """      atkRemainBy: aBy.remain, defRemainBy: dBy.remain,
    };"""
b4 = """      atkRemainBy: aBy.remain, defRemainBy: dBy.remain,
      /* v89.109（老板「杀死出城迎战的军队才能掠夺」）：守方**出城迎战部队**的起/余 ——
         掠夺闸（battle.lootGateOf）与战报都读它。 */
      defSortieStart: defSortieStart, defSortieLeft: defSortieLeft,
    };"""
assert a4 in s, '④未命中'
s = s.replace(a4, b4, 1)

io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('tactic.js：playerDef + sortie 统计完成')
