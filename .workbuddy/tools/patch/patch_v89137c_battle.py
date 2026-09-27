# -*- coding: utf-8 -*-
"""v89.137 补丁 C：battle.js
  ① 建筑专精：驿站 / 烽火台消费点升级为带档数
  ② 无将驻援链路：prepare / expedition / dispatch / arrive 放行 genId=''
     （老板 7：增援已有驻将的野地不带将，但要走出征界面 → 走行军通道）
  ③ 新增 GAME.battle.unitFinalOf（兵种最终属性 · 战斗界面悬停用 · 唯一出口）
"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'battle.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次（须为 1）' % (tag, s.count(old)))
        sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ ① 驿站 / 烽火台：专精带档数 ══════════
rep(
"""      /* v28（需求 1）：驿站满级专精 —— 行军速度再 ×1.5 */
      if (GAME.mastery && GAME.masteryOf(fc, 'yizhan')) m *= 1.5;

      /* ⑤ 烽火台 10 级：27×27 范围内行军 +50%（半径 13 格）
         v28（需求 1）：满级专精把范围再放 6 格、强度再 +20% */
      var fh = GAME.buildingLevel(fc, 'fenghuotai') || 0;
      var bb = (GAME.mastery && GAME.masteryOf(fc, 'fenghuotai')) ? 0.2 : 0;""",
"""      /* v28（需求 1）：驿站建筑专精 —— 行军速度再 +0.5 倍/档
         （v89.137：三档 = ×1.5 / ×2.0 / ×2.5） */
      var _yz137 = GAME.mastery ? GAME.mastery('marchAdd', fc) : 0;
      if (_yz137 > 0) m *= (1 + _yz137);

      /* ⑤ 烽火台 10 级：27×27 范围内行军 +50%（半径 13 格）
         v28（需求 1）：建筑专精把范围再放 6 格、强度再 +20%/档（v89.137 三档） */
      var fh = GAME.buildingLevel(fc, 'fenghuotai') || 0;
      var bb = (GAME.mastery ? GAME.mastery('beaconBoost', fc) : 0);""",
'驿站/烽火台档数')

# ══════════ ② prepare：station 无将放行 ══════════
rep(
"""    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) gen = s.generals[i];
    if (!gen) return { ok: false, msg: '请选择出征将领' };
    /* v89.117（老板「城主和守将不能执行出征动作」）：与界面**同一判据**（唯一出口
       GAME.marchBlockOf）—— 界面置灰只是提示，这里才是拦得住的那道闸
       （自动出征 / 脚本 / 老档里的旧配置都会经过 prepare）。 */
    var _mb = GAME.marchBlockOf(gen);
    if (_mb) return { ok: false, msg: gen.name + ' 不可出征：' + _mb };""",
"""    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) gen = s.generals[i];
    /* v89.137（老板 7）：**station 增援允许不带将** ——
       野地已有将领驻守时，增援只并兵不换将（与 doWildGarrison 的"已有将→不带将"同规），
       而入口统一到出征界面后，"不带将"是界面上的正常形态（不是老档残迹）。
       判据挂在**目标野地的现役驻将**上（不是"玩家有没有选将"）—— else 分支保持原拦截。 */
    var _stNoGen137 = false;
    if (!gen && modeId === 'station' && GAME.map && GAME.map.wildAt) {
      var _tpre137 = GAME.battle.resolveTarget(target);
      if (_tpre137.ok && _tpre137.kind === 'wild') {
        var _wpre137 = GAME.map.wildAt(_tpre137.x, _tpre137.y);
        _stNoGen137 = !!(_wpre137 && _wpre137.garrison && _wpre137.garrison.genId);
      }
    }
    if (!gen && !_stNoGen137) return { ok: false, msg: '请选择出征将领' };
    /* v89.117（老板「城主和守将不能执行出征动作」）：与界面**同一判据**（唯一出口
       GAME.marchBlockOf）—— 界面置灰只是提示，这里才是拦得住的那道闸
       （自动出征 / 脚本 / 老档里的旧配置都会经过 prepare）。 */
    if (gen) {
      var _mb = GAME.marchBlockOf(gen);
      if (_mb) return { ok: false, msg: gen.name + ' 不可出征：' + _mb };
    }""",
'prepare 放行无将')

rep(
"""      if (GAME.staNow(gen) < GAME.staCostOf(mode, opts && opts.scheme)) {
        return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/'
          + GAME.staCostOf(mode, opts && opts.scheme) + '），休整或服止血散' };
      }
      if ((gen.energy || 0) < mode.energy) {
        return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + mode.energy + '），可服清心丸' };
      }""",
"""      /* v89.137：无将增援（station）不校验体力/精力（军队全体行动，没有带队人可扣） */
      if (gen && GAME.staNow(gen) < GAME.staCostOf(mode, opts && opts.scheme)) {
        return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/'
          + GAME.staCostOf(mode, opts && opts.scheme) + '），休整或服止血散' };
      }
      if (gen && (gen.energy || 0) < mode.energy) {
        return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + mode.energy + '），可服清心丸' };
      }""",
'prepare 体力守卫')

# ══════════ ③ expedition：扣体力段 gen 守卫 ══════════
rep(
"""      for (var a3 in atkArmy) city.army[a3] -= atkArmy[a3];
      GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, opts && opts.scheme));
      gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
    }""",
"""      for (var a3 in atkArmy) city.army[a3] -= atkArmy[a3];
      /* v89.137：无将增援（station）没有带队人可扣 —— 兵出去、体力不扣 */
      if (gen) {
        GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, opts && opts.scheme));
        gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
      }
    }""",
'expedition 扣体力守卫')

# ══════════ ④ dispatch：gen 守卫（体力/状态/记录/日志） ══════════
rep(
"""    /* v89.135：dispatch 时 scheme 已随军（scheme 变量在上方解析）—— 体力折扣同源 */
    GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, scheme));
    gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
    gen.status = 'march';""",
"""    /* v89.135：dispatch 时 scheme 已随军（scheme 变量在上方解析）—— 体力折扣同源
       v89.137：无将增援（station 补兵）没有主将 —— 跳过扣减与状态置位；m.genId 记空串，
       抵达时 arrive 按"设计上无将"放行（不是"主将已不在"）。 */
    if (gen) {
      GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, scheme));
      gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
      gen.status = 'march';
    }""",
'dispatch 体力守卫')

rep(
"""    var m = {
      id: 'mr' + (GAME._marchSeq = (GAME._marchSeq || 0) + 1),
      cityId: city.id, genId: gen.id, modeId: mode.id,""",
"""    var m = {
      id: 'mr' + (GAME._marchSeq = (GAME._marchSeq || 0) + 1),
      cityId: city.id, genId: gen ? gen.id : '', modeId: mode.id,   /* v89.137：'' = 无将增援 */""",
'dispatch 记录 genId')

rep(
"""    GAME.log.war('🛫 ' + gen.name + ' 率军出发 → ' + t.name + '（' + mode.name
      + (opsId !== 'assault' ? ' · ' + GAME.opsOf(opsId).name : '')
      + cargoTxt
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');""",
"""    GAME.log.war('🛫 ' + (gen ? gen.name + ' 率军' : '增援部队') + '出发 → ' + t.name + '（' + mode.name
      + (opsId !== 'assault' ? ' · ' + GAME.opsOf(opsId).name : '')
      + cargoTxt
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');""",
'dispatch 日志')

# ══════════ ⑤ arrive：折返条件 —— 无将不等于"主将已不在" ══════════
rep(
"""    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === m.genId) gen = s.generals[i];
    var city = GAME.cityById(m.cityId);
    if (!gen) {
      /* 将领已不在（解雇/离去）：兵力原路退回，避免凭空消失 */""",
"""    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === m.genId) gen = s.generals[i];
    var city = GAME.cityById(m.cityId);
    /* v89.137（老板 7）：`m.genId === ''` = **设计上的无将增援**（station 补兵，不走折返）；
       只有"记了将、人却已不在"（解雇/离去）才折返。 */
    if (!gen && !m.genId) gen = null;
    if (!gen && m.genId) {
      /* 将领已不在（解雇/离去）：兵力原路退回，避免凭空消失 */""",
'arrive 折返条件')

# arrive 里侦察归来日志用了 gen.name —— 现在 gen 可能为空；加守卫
rep(
"""    if (r.result && r.result.winner === 'scout') {
      GAME.log.war('🔭 ' + gen.name + ' 侦察归来：' + m.name);
    }""",
"""    if (r.result && r.result.winner === 'scout') {
      GAME.log.war('🔭 ' + (gen ? gen.name : '斥候') + ' 侦察归来：' + m.name);   /* v89.137：无将守卫 */
    }""",
'arrive 侦察日志')

# ══════════ ⑥ 新增 unitFinalOf（兵种最终属性 · 唯一出口） ══════════
rep(
"""  /* 队伍行军速度的“可读”表述（界面展示用） */
  GAME.march.speedText = function (army, from, to, gen) {""",
"""  /* ============================================================
   * v89.137（老板 2）：**兵种最终属性**（科技 / 将领 / 装备等全加成后）
   * ------------------------------------------------------------
   * 战斗界面悬停兵种时的唯一出口 —— 口径直接读战斗引擎自己的
   * perAtk / perDef / perHp（`GAME.tactic.*`），不另算一份，
   * "悬停里看到的数"与"结算时用的数"必然同一把尺。
   * 传入 u = 引擎单位（unitsOf 的产物：含 id / count / cover / atkPct / defPct / hpPer）；
   * gen = 该单位所属方的将领（我方法：rec.genId；敌方法：rec.sim.scGen）——
   * 生命加成走 T.perHp(u, gen)，与战斗里"被击方将领加血"同源。
   * 返回 null 表示不是有效兵种（调用方自行兜底）。
   * ⚠️ 不含"相克 / 攻城"这类**对局态**因子（那是 perAtk 的 opts，随打谁而变）——
   *   悬停给的是"这支部队自己的面板"，相克请见兵种说明。
   * ============================================================ */
  GAME.battle.unitFinalOf = function (u, gen) {
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
  };

  /* 队伍行军速度的“可读”表述（界面展示用） */
  GAME.march.speedText = function (army, from, to, gen) {""",
'unitFinalOf')

# ══════════ ⑦ 注释更名 ══════════
cnt137 = s.count('满级专精')
s = s.replace('满级专精', '建筑专精')
ok.append('注释更名×%d' % cnt137)

# ══════════ 写盘 + 自检 ══════════
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'unitFinalOf' in chk and '_stNoGen137' in chk, '新段未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
print('✅ battle.js 补丁完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
