# -*- coding: utf-8 -*-
"""
v89.113c · ②守城伤兵+战报口径对齐 / ④战斗俘虏（全战斗）
----------------------------------------------------------
老板令：
 ②「守城为什么没有伤兵」+「守城的时候我的军队数量对不上，战斗力也对不上」
 ④「战斗胜利为什么没有俘虏」
"""
import io, os, shutil

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:80])
    return s.replace(a, b, 1)

def rw(p, s, name):
    shutil.copy2(p, os.path.join(BK, name))
    io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(p + '.tmp', p)

# ============================================================
# A. data.js —— CAPTIVE 扩展
# ============================================================
dp = os.path.join(R, 'js', 'data.js')
d = io.open(dp, encoding='utf-8').read()
a = """  DATA.CAPTIVE = { rate: 0.06, min: 15, cap: 500, kinds: ['fort', 'city'] };"""
b = """  /* v89.113（老板「战斗胜利为什么没有俘虏」）：**全战斗**都能俘获 ——
     原先只认 fort/city 两种目标（打野地、守城全都没有），且 cap 500 太低
     （歼灭 10 万也只见"俘 500"，等于看不见）。
     现在：kinds 覆盖野地/据点/名城/防御战；rate 8%、cap 3000。
     去向不变：**溃卒收编为民**（人口），与增民令/税制同一套经济。 */
  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };"""
d = sub_txt(d, a, b, 'A CAPTIVE')
rw(dp, d, 'data.v89113.js')
print('A. data.js：俘虏表已扩展')

# ============================================================
# B. battle.js —— captiveGain 视角参数 + 攻方战报俘虏行
# ============================================================
bp = os.path.join(R, 'js', 'battle.js')
b = io.open(bp, encoding='utf-8').read()

a = """  GAME.battle.captiveGain = function (city, result, target) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['fort', 'city'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = result.defLoss || 0;
    if (!(defLoss > 0)) return { gain: 0 };
    var gain = Math.round(defLoss * (cfg.rate == null ? 0.06 : cfg.rate));"""
b2 = """  /* v89.113：`enemyLoss` = 敌军损失的**显式口径**（可选）。
     攻方视角可直接读 result.defLoss；**防御战**里我方是守方、敌军损失在 result.atkLoss ——
     靠 target 自己猜一定会错（这正是"守城没有俘虏/数字对不上"的一类病根）。 */
  GAME.battle.captiveGain = function (city, result, target, enemyLoss) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['wild', 'fort', 'city', 'defense'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = (enemyLoss != null) ? enemyLoss : (result.defLoss || 0);
    if (!(defLoss > 0)) return { gain: 0 };
    var gain = Math.round(defLoss * (cfg.rate == null ? 0.08 : cfg.rate));"""
b = sub_txt(b, a, b2, 'B1 captiveGain')

# 攻方战报：俘虏行（战利品区）
a = """    if (gains.mats && gains.mats.length) lootLines.push('材料：' + gains.mats.join('、'));
    if (gains.equip && gains.equip.length) lootLines.push('军械：' + gains.equip.join('、'));"""
b3 = """    if (gains.mats && gains.mats.length) lootLines.push('材料：' + gains.mats.join('、'));
    if (gains.equip && gains.equip.length) lootLines.push('军械：' + gains.equip.join('、'));
    /* v89.113（老板「战斗胜利为什么没有俘虏」）：俘虏进战利品清单 —— 玩家一眼可见 */
    if (result.captives && result.captives.gain > 0) {
      lootLines.push('俘虏：' + U.fmt(result.captives.gain) + ' 众（溃卒收编为民）');
    }"""
b = sub_txt(b, a, b3, 'B2 战报俘虏行')
rw(bp, b, 'battle.v89113.js')
print('B. battle.js：俘虏口径与战报已接线')

# ============================================================
# C. state.js —— 守城伤兵 + 战报口径对齐 + 守城俘虏
# ============================================================
sp = os.path.join(R, 'js', 'state.js')
s = io.open(sp, encoding='utf-8').read()

# C1：兵损段加伤兵回收
a = """    var jbMul = _jb ? (1 - _jb.eff.invLossCut) : 1;
    if (result) {
      var lossBy = result.defLossBy || {};
      for (var tk in lossBy) {
        var nl = Math.floor(Math.min(lossBy[tk] || 0, city.army[tk] || 0) * jbMul);
        if (nl > 0) { city.army[tk] -= nl; out.troopsLost += nl; }
      }
    } else {"""
b = """    var jbMul = _jb ? (1 - _jb.eff.invLossCut) : 1;
    /* v89.113（老板「守城为什么没有伤兵」）：守城战与出征**同源伤兵回收** ——
       阵亡者按 woundedRate 折算为伤兵入营（可花金治疗归队）。
       改前这里直接 `-= nl` 就完了，伤兵营永远空着 —— 老板实际看到的就是"守城没有伤兵"。 */
    var wRate = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
    if (result) {
      var lossBy = result.defLossBy || {};
      for (var tk in lossBy) {
        var nl = Math.floor(Math.min(lossBy[tk] || 0, city.army[tk] || 0) * jbMul);
        if (nl > 0) {
          city.army[tk] -= nl; out.troopsLost += nl;
          var wnd = Math.floor(nl * wRate);
          if (wnd > 0) {
            s.woundedArmy = s.woundedArmy || {};
            s.woundedArmy[tk] = (s.woundedArmy[tk] || 0) + wnd;
            s.wounded = (s.wounded || 0) + wnd;
            out.wounded = (out.wounded || 0) + wnd;
          }
        }
      }
    } else {"""
s = sub_txt(s, a, b, 'C1 守城伤兵')

# C2：守城胜利 → 俘虏（敌军溃卒）
a = """    var repDrop = Math.round(severity * (L.repDrop || 0));"""
b = """    /* v89.113（老板「战斗胜利为什么没有俘虏」）：守城得手同样俘获溃卒 ——
       敌军损失（result.atkLoss）按同一张俘虏表收编为民（kind 'defense'）。 */
    if (held && result && GAME.battle && GAME.battle.captiveGain) {
      try {
        var _cap113 = GAME.battle.captiveGain(city, result, { kind: 'defense' }, result.atkLoss || 0);
        if (_cap113 && _cap113.gain > 0) {
          out.captives = _cap113;
          GAME.log.war('🪶 俘获溃卒：' + city.name + ' +' + U.fmt(_cap113.gain) + ' 人（收编为民）');
        }
      } catch (e3) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 俘虏异常：', e3);
      }
    }
    var repDrop = Math.round(severity * (L.repDrop || 0));"""
s = sub_txt(s, a, b, 'C2 守城俘虏')

# C3：战报首行口径对齐 + 伤兵/俘虏行
a = """    var defMen0 = 0;
    for (var dk in defArmy0) defMen0 += (defArmy0[dk] || 0);
    var lines = [];
    lines.push('来犯 ' + U.numText(ia.total || 0, 0) + ' 众（' + U.escape(src) + '）　守军 '
      + U.numText(defMen0, 0) + (guard ? '（' + U.escape(guard.name) + ' 统带）' : '（无守将）'));"""
b = """    var defMen0 = 0, scoutN = 0;
    for (var dk in defArmy0) {
      defMen0 += (defArmy0[dk] || 0);
      /* v89.113（老板「军队数量对不上」）：把"未列阵"的斥候单独点出来 ——
         战斗表只统计参战部队（斥候 nocombat 不列阵不挨打），而界面上驻军是含斥候的，
         两个数不说明白就是"对不上"。 */
      if (DATA.TROOPS[dk] && DATA.TROOPS[dk].nocombat) scoutN += (defArmy0[dk] || 0);
    }
    var defFight = Math.max(0, defMen0 - scoutN);
    var lines = [];
    /* v89.113：首行口径一次说全 ——
       来犯：兵力 + **战力**（与预警同一出口 ia.power）；
       守军：**参战**人数（与战斗表同口径）+ 未列阵斥候 + 统带守将 + **本城守备力**（界面同源）。 */
    lines.push('来犯 ' + U.numText(ia.total || 0, 0) + ' 众（约 ' + U.numText(ia.power || 0, 0)
      + ' 战力 · ' + U.escape(src) + '）　守军 ' + U.numText(defFight, 0) + ' 众'
      + (scoutN > 0 ? '（另 ' + U.numText(scoutN, 0) + ' 斥候未列阵）' : '')
      + (guard ? '（' + U.escape(guard.name) + ' 统带）' : '（无守将）')
      + '　守备力 ' + U.numText(out.def || 0, 0));"""
s = sub_txt(s, a, b, 'C3 战报首行')

# C4：战报加伤兵/俘虏行
a = """    if (out.wallDrop) lines.push('城墙 −' + out.wallDrop + ' 级');
    var rep = {"""
b = """    if (out.wallDrop) lines.push('城墙 −' + out.wallDrop + ' 级');
    /* v89.113：伤兵入营 + 俘获溃卒（与出征战报同款口径） */
    if (out.wounded > 0) lines.push('我军伤兵 ' + U.numText(out.wounded, 0) + ' 入营（可花金治疗归队）');
    if (out.captives && out.captives.gain > 0) {
      lines.push('俘获 ' + U.numText(out.captives.gain, 0) + ' 众（溃卒收编为民）');
    }
    var rep = {"""
s = sub_txt(s, a, b, 'C4 战报行')

rw(sp, s, 'state.v89113.js')
print('C. state.js：守城伤兵/口径/俘虏 已完成')
