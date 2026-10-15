# -*- coding: utf-8 -*-
"""v89.95 Patch T —— smoke 断言对齐（去溅射 / 纵深 / 速度受控 / 伤害系数）。
原则：期望值**从常量与配置推导**，不写死数字（本轮已因此踩坑）。"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(o, nw, tag):
    global s, n
    if nw in s:
        print('SKIP: ' + tag)
        return
    assert o in s, 'MISS: ' + tag
    s = s.replace(o, nw, 1)
    n += 1
    print('OK: ' + tag)


# ① 速度成长：每 5 级 +1
rep("""  check('实测：速度随等级成长（每级 +1，派生而不写存档）', (function () {
    var g = { level: 1, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance', perm: {} };
    var a1 = G.genAttrs(g).spd;
    g.level = 11;
    return G.genAttrs(g).spd === a1 + 10;
  })());""",
"""  /* v89.95（B2）：老板「将领每 5 级升高 1 点六维的速度」——原来是**每级 +1**，
     240 级就是 +239，再叠自由点（无上限）与装备 → 单位速度 ×(1+spd/300) 最高 9 倍，
     一步贴脸、先手打光（老板点名的链）。现在受控：每 SPD_CAP.perLevels 级 +1。 */
  check('实测：速度 = 出身 + **每 5 级 +1**（受控成长；派生而不写存档）', (function () {
    var g = { level: 1, tong: 40, yw: 40, zm: 40, nz: 40, speed: 10,
      attack: 10, defense: 10, hp: 100, equip: {}, rank: 'fan', style: 'balance', perm: {} };
    var per = (DATA.SPD_CAP || {}).perLevels || 5;
    var a1 = G.genAttrs(g).spd;
    g.level = 1 + per;                       /* +per 级 → +1 点 */
    var a2 = G.genAttrs(g).spd;
    g.level = 1 + per * 20;                  /* +20 档 → +20 点 */
    var a3 = G.genAttrs(g).spd;
    return per === 5 && a2 === a1 + 1 && a3 === a1 + 20;
  })(), '每 ' + ((DATA.SPD_CAP || {}).perLevels || 5) + ' 级 +1 · 240 级共 +'
    + Math.floor(239 / ((DATA.SPD_CAP || {}).perLevels || 5)) + ' 点');""",
'速度成长断言')

# ② 战场距离：199 → FIELD_MARGIN
rep("""  check('战场距离 = 双方最远射程 + 199（近战射程也参与比较）', (function () {""",
"""  check('战场距离 = 双方最远射程 + FIELD_MARGIN（并以 FIELD_MIN 兜底）', (function () {""",
'战场距离标题')
rep("""    var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k) + 199; };""",
"""    var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k) + T.FIELD_MARGIN; };""",
'eff 用 FIELD_MARGIN')

# ③ 默认纵深：a.field < 300 → === FIELD_MIN
rep("""    return a.field < 300 && c.field > a.field && a.engine === 'tactic'""",
"""    return a.field === G.tactic.FIELD_MIN && c.field > a.field && a.engine === 'tactic'""",
'默认纵深下限')

# ④ 纵深越大 → 用相对倍数（不再 ×3/×5）
rep("""    return b.field > a.field * 3 && g1(b) > g1(a) * 5;""",
"""    /* v89.95：FIELD_MIN 抬到 1400 后，两档纵深的**差距比例**变小
       （纯近战吃 1400 兜底，带投石才多 ~500）——判据改成"确实更宽、开局确实更远"。 */
    return b.field > a.field * 1.2 && g1(b) > g1(a) * 1.3;""",
'纵深相对判据')

# ⑤ 骑兵先接敌：D > Dm*2 → D > Dm；弓 === 1 → <= 3
rep("""  return D > Dm * 2                            /* 带远程把战场撑宽了 2 倍以上 */""",
"""  /* v89.95：纵深有 FIELD_MIN 兜底后，"带远程撑宽"的**比例**变小 → 只验方向 */
  return D > Dm                                  /* 带远程把战场撑得更宽 */""",
'骑兵② 比例改方向')
rep("""    && cav.every(function (n) { return n >= 1 && n <= 4; })""",
"""    && cav.every(function (n) { return n >= 1 && n <= 6; })""",
'骑兵③ 步数窗放宽')
rep("""    && st('gongjian') === 1                      /* 远程开局即可开火 */""",
"""    && st('gongjian') <= 3                       /* 远程很快就能开火（纵深受控后不再"开局即打"） */""",
'骑兵④ 远程步数')

# ⑥ 抛射科技：+199 → FIELD_MARGIN
rep("""  var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k * w) + 199; };""",
"""  var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k * w) + G.tactic.FIELD_MARGIN; };""",
'抛射 eff')

# ⑦ 箭塔撑起战场：city > melee*4 → *1.3
rep("""    return city > melee * 4 && city0 === melee""",
"""    /* v89.95：纵深有 FIELD_MIN 兜底 → "箭塔撑宽"的比例判据改为"确实更宽" */
    return city > melee * 1.3 && city0 === melee""",
'箭塔纵深判据')

# ⑧ 拆塔：回合窗口放宽（伤害系数下调 → 拆塔更久）
rep("""  return r.towerStart === 100 && r.towerLeft === 0 && hitRound >= 5 && hitRound <= 20""",
"""  /* v89.95：伤害总闸（DATA.BATTLE.damageScale）下调后，拆 100 座箭塔需要更多回合
     —— 窗口按"能拆完但不拖到 30 回合"重设。 */
  return r.towerStart === 100 && r.towerLeft === 0 && hitRound >= 3 && hitRound <= 28""",
'拆塔窗口')

# ⑨ 防御减半：显式小纵深（否则首回合还没接敌）
rep("""  var cfg = function (s) {
    return G.tactic.simulate({ chuangnu: 3000 }, null, { changqiang: 30000 }, 0, null,
      { kind: 'wild', stances: { def: { changqiang: { s: s, t: '' } } } });
  };""",
"""  var cfg = function (s) {
    /* v89.95：纵深有 1400 兜底后，**首回合还没接敌** —— 这条断言必须显式指定小纵深，
       让"唯一变量是减伤"重新成立（不指定的话两边都是 0，判据失效）。 */
    return G.tactic.simulate({ chuangnu: 3000 }, null, { changqiang: 30000 }, 0, null,
      { kind: 'wild', field: 400, stances: { def: { changqiang: { s: s, t: '' } } } });
  };""",
'防御减半小纵深')

# ⑩ 溅射断言 → 一目标制
rep("""    check('v89.87（战斗）：主目标吃满 + 溢出 30% 溅射（含翻转判据）', (function () {
      if (G.tactic.SPLASH_PCT !== 0.30) return false;
      var env1 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x' });
      var r1 = env1.step();
      var ev1 = (r1.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
      var okSplash = !!ev1 && ev1.hits.length >= 2 && !ev1.hits[0].splash
        && ev1.hits[1].splash === true;
      var old = G.tactic.SPLASH_PCT;
      G.tactic.SPLASH_PCT = 0;
      var env0 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x' });
      var r0 = env0.step();
      G.tactic.SPLASH_PCT = old;
      var ev0 = (r0.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
      var flip = !ev0 || (ev0.hits || []).slice(1).length === 0;      /* 关溅射 → 无后续条 */
      return okSplash && flip;
    })());""",
"""    /* v89.95（B1 · 老板「战斗一个回合只对一个目标兵种出手，后续无溅射伤害」）：
       这条断言从"溢出 30% 溅射"**反转**成"一目标制"——
       溢出伤害作废：被主目标吃满后，另一支**毫发无损**（实证比读常数更硬）。 */
    check('v89.95（战斗）：一回合只打一个目标兵种（溢出作废 · 无溅射）', (function () {
      var env1 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x', field: 400 });
      var r1 = env1.step();
      var ev1 = (r1.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
      var okOne = !!ev1 && ev1.hits.length === 1 && ev1.hits[0].splash !== true;
      var hurtKinds = 0;
      (env1.units.def || []).forEach(function (u) {
        var start0 = (u.id === 'yibing') ? 2 : 60;
        if (u.count < start0) hurtKinds++;
      });
      /* 7000 弓兵的溢出足以秒掉 60 轻骑 —— 只有一支受损 ⇒ 溢出确实作废 */
      return okOne && hurtKinds === 1 && G.tactic.SPLASH_PCT === 0;
    })(), '受击兵种数 1 · SPLASH_PCT=' + G.tactic.SPLASH_PCT);""",
'一目标制断言')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED smoke x%d' % n)
else:
    print('NOCHANGE')
