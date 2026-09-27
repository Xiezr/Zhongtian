# -*- coding: utf-8 -*-
"""v89.151 批 C：battle.js —— unitFinalOf 字段兜底 + totalDef（悬停"全军防御"）"""
import io

P = 'E:/Deepseekdb/js/battle.js'
s = io.open(P, encoding='utf-8', newline='').read()

OLD = """  GAME.battle.unitFinalOf = function (u, gen) {
    if (!u || !DATA.TROOPS[u.id]) return null;
    var T = GAME.tactic, t = DATA.TROOPS[u.id];
    if (!T) return null;
    var atk = Math.round(T.perAtk(u));
    var def = Math.round(T.perDef(u));
    var hp = Math.round(T.perHp(u, gen || null));
    var cnt = u.count || 0;
    return {
      id: u.id, name: t.name || u.name || u.id,
      atk: atk, baseAtk: t.atk,
      def: def, baseDef: t.def,
      hp: hp, baseHp: u.hpPer || t.hp,
      range: t.range, spd: u.spd || t.spd,
      count: cnt, totalAtk: atk * cnt, totalHp: hp * cnt,
    };
  };"""

NEW = """  GAME.battle.unitFinalOf = function (u, gen) {
    if (!u || !DATA.TROOPS[u.id]) return null;
    var T = GAME.tactic, t = DATA.TROOPS[u.id];
    if (!T) return null;
    /* v89.151（老板 5）：悬停读的是**战场快照**（快照字段曾漏 hpPer/atkPct/defPct/cover，
       见 tactic.snapUnits 的病根注释）—— 这里对缺失字段做**规范化兜底**，
       保证"外部构造/老档快照"也拿得到计算值而不是 NaN：
       基础值兜底（hpPer→t.hp 等），加成缺失按 0 计。 */
    var uu = {
      id: u.id, count: u.count || 0, vsCity: !!u.vsCity,
      hpPer: u.hpPer || t.hp,
      atkPct: u.atkPct || 0, defPct: u.defPct || 0, cover: u.cover || 0,
    };
    var atk = Math.round(T.perAtk(uu));
    var def = Math.round(T.perDef(uu));
    var hp = Math.round(T.perHp(uu, gen || null));
    var cnt = uu.count;
    return {
      id: u.id, name: t.name || u.name || u.id,
      atk: atk, baseAtk: t.atk,
      def: def, baseDef: t.def,
      hp: hp, baseHp: u.hpPer || t.hp,
      range: t.range, spd: u.spd || t.spd,
      /* v89.151（老板 5）：悬停要「全军血量 / 全军攻击 / **全军防御**」三行 ——
         totalDef = 单位防 × 人数（与 totalAtk/totalHp 同尺）。 */
      count: cnt, totalAtk: atk * cnt, totalDef: def * cnt, totalHp: hp * cnt,
    };
  };"""

assert s.count(OLD) == 1, 'count=' + str(s.count(OLD))
s = s.replace(OLD, NEW)
assert '\r\n' not in s
assert s.count('totalDef: def * cnt') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('battle.js 落盘 OK · len=' + str(len(s)))
