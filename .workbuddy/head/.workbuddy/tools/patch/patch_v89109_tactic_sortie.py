# -*- coding: utf-8 -*-
"""v89.109：tactic.js 接 sortie（出城迎战）—— 常量 + 展开 + 墙保护 + 拦拆墙"""
import io, os, shutil
p = r'E:/Deepseekdb/js/tactic.js'
BK = r'E:/Deepseekdb/.workbuddy/backup'
shutil.copy2(p, os.path.join(BK, 'tactic.v89108.js'))
s = io.open(p, encoding='utf-8').read()

# ① 常量：出城迎战的前出位置
a1 = '  T.WALL_POS = 100;               /* 攻城时城墙（箭塔）所在位置（原版："城墙在位置 100"） */'
b1 = a1 + '''
  /* v89.109（老板「出城迎战的兵种，将可以将我方前线前移，阻止敌军靠近城墙」）：
     出城迎战部队的初始前出位置 —— **城墙（100）之外**。三个效果都是引擎既有机制
     自然产生：① 打击排序按 adv 降序 → 它先挨打（"先杀出城迎战的军队"）；
     ② 攻方主目标恒为最靠前的敌部队 → 它挡在阵前，城头守军挨不到打；
     ③ 守方仍有出城部队存活时**攻方拆不到墙**（见 actSide 的 wantTower）。 */
  T.SORTIE_ADV = 200;'''
assert a1 in s, '①未命中'
s = s.replace(a1, b1, 1)

# ② unitsOf：读 tc.sortie，且 adv 前移
a2 = """      var tc = (ctx && ctx.override && ctx.override[id])
        || (GAME.tacticOf ? GAME.tacticOf(side, id, ctx) : null);
      var stance = tc ? tc.s : 'advance';"""
b2 = """      var tc = (ctx && ctx.override && ctx.override[id])
        || (GAME.tacticOf ? GAME.tacticOf(side, id, ctx) : null);
      var stance = tc ? tc.s : 'advance';
      /* v89.109：防守侧「出城迎战」—— 前出到城墙之外（不改动作，改初始位置） */
      var sortie = !!(tc && tc.sortie);"""
assert a2 in s, '②未命中'
s = s.replace(a2, b2, 1)

a3 = """        stance: stance,
        target: tc ? tc.t : '',
        adv: T.STANCE_ROW[stance] || 0,"""
b3 = """        stance: stance,
        target: tc ? tc.t : '',
        sortie: sortie,
        adv: sortie ? T.SORTIE_ADV : (T.STANCE_ROW[stance] || 0),"""
assert a3 in s, '③未命中'
s = s.replace(a3, b3, 1)

# ③ 出城 = 放弃城墙护佑（不吃城头火力圈加成）
a4 = """      if (unit.side === 'def' && wallRange > 0 && unit.range >= 500) r = Math.max(r, wallRange);
      return r;
    }
    function onWallOf(unit) {
      return (unit.side === 'def') && wallRange > 0 && unit.range >= 500;
    }"""
b4 = """      /* v89.109：出城迎战的部队在**城外**，不再吃城头火力圈（出城 = 放弃城墙护佑） */
      if (unit.side === 'def' && !unit.sortie && wallRange > 0 && unit.range >= 500) r = Math.max(r, wallRange);
      return r;
    }
    function onWallOf(unit) {
      return (unit.side === 'def') && !unit.sortie && wallRange > 0 && unit.range >= 500;
    }"""
assert a4 in s, '④未命中'
s = s.replace(a4, b4, 1)

# ④ 拦拆墙：守方仍有出城部队存活 → 攻方拆不到墙
a5 = """        var wantTower = (u.target === DATA.TARGET_WALL) && opts.sieging && towerAliveNow() > 0;"""
b5 = """        /* v89.109（老板「阻止敌军靠近城墙」）：**守方仍有出城迎战部队存活时，攻方拆不到墙** ——
           野战军挡在城外，攻方必须先把它打完，才能逼近城墙拆工事。
           这就是"前线前移"的硬语义（也是需求 3「打破城墙 + 杀死出城迎战军队」的前置）。 */
        var _defSortieAlive = false;
        if (u.side === 'atk') {
          for (var _si = 0; _si < enemyUnits.length; _si++) {
            if (enemyUnits[_si].sortie && enemyUnits[_si].count > 0) { _defSortieAlive = true; break; }
          }
        }
        var wantTower = (u.target === DATA.TARGET_WALL) && opts.sieging
          && towerAliveNow() > 0 && !_defSortieAlive;"""
assert a5 in s, '⑤未命中'
s = s.replace(a5, b5, 1)

io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('tactic.js：sortie 四条接线完成')
