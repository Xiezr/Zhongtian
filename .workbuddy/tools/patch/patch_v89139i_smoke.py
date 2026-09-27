# -*- coding: utf-8 -*-
"""v89.139 批七：tactic.js 恢复 stepsToWall（smoke 在用）+ smoke 三条断言升级（箭头退役/距离新口径）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for old, new, tag in pairs:
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    tmp = p + '.tmp139'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:60]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


# ══════ tactic.js：恢复 stepsToWall（smoke §42 在用 · §48.4 教训：查引用面要含测试） ══════
patch('js/tactic.js', [
    ("""  /* ⛔ v89.139：`T.stepsToWall`（单侧"几步到墙"推算）**整条退役** ——
     零引用（全仓 grep 只有定义），且它的口径与 v89.103 的**共享轴**几何重复：
     接敌回合的正确算法 = ⌈D ÷ (vA+vD)⌉（双方同推），而它算的是"单侧独自推到开火"。
     新口径见 `battlefieldOf` 的 MARCH_ROUNDS_MIN 段。如需恢复：见 backup/v89139/tactic.js。 */""",
     """  /* 推算「几步到接触」—— 现在**接收战场距离本身**（`battlefieldOf` 算出），
     不再接场地种类：距离已经变成双方配兵的函数，"按场地查表"不成立了。
     界面把这条讲清楚，玩家才看得见兵种差异（骑兵 1 步 vs 器械靠射程先开火）。
     ⚠️ v89.139 注：这是**单侧**推进口径（"该兵种几步能开火"，用于攻城/机动对比）；
     两军迎面互推的接敌回合 = ⌈D ÷ (vA+vD)⌉，见 battlefieldOf 的 MARCH_ROUNDS_MIN 段。
     （v89.139 一度误判"零引用"而删 —— 实际 smoke §42 在用；引用面必须连测试一起 grep。） */
  T.stepsToWall = function (spd, range, D) {
    D = D || T.FIELD_MIN;
    var adv = 0, n = 0;
    /* 循环结束时 `adv + range >= D`，即**已经可以开火**，
       所以步数就是推进次数 n（不是 n+1 —— 多算一步会把轻骑兵的
       "1 步到墙"写成 2 步，与战场上的实际表现对不上）。 */
    while (adv + (range || 0) < D && n < 60) {
      var free = D - (range || 0) - adv;
      if (free <= 0) break;
      adv += Math.min(spd * T.MARCH_UNIT, free);
      n++;
    }
    return Math.max(1, n);
  };""",
     'stepsToWall 恢复'),
], ['T.stepsToWall = function'])

# ══════ smoke：三条断言升级 ══════
patch('smoke-test.js', [
    # ① 地图箭头 → 退役断言
    ("""  check('视野外名城有边缘方向提示（贴合画布边缘的箭头）',
    /视野外的州城\\/都城：边缘方向提示/.test(mapSrc22)
    && /Math\\.abs\\(c4\\.x - px\\) > Math\\.abs\\(c4\\.y - py\\)/.test(mapSrc22));""",
     """  /* v89.139（老板 1）：「目前地图中有几个上下左右的箭头，去掉」——
     边缘方向箭头整段退役（判据反转：查"已删净"的可执行形态，墓碑名不进判据）。 */
  check('地图方向箭头已退役（v89.139：视野外名城不再投影到画布边缘画 ◀▶▲▼）',
    /c4\\.x < px \\?/.test(mapSrc22) === false
    && /Math\\.abs\\(c4\\.x - px\\) > Math\\.abs\\(c4\\.y - py\\)/.test(mapSrc22) === false);""",
     'smoke 箭头退役'),

    # ② 战场距离公式 → 三下限
    ("""  check('战场距离 = 双方最远射程 + FIELD_MARGIN（并以 FIELD_MIN 兜底）', (function () {
    var T = G.tactic;
    /* ⚠️ 不写死数字：射程会被**科技**（抛射 +4%/级）与**天气**（雨天弓 −20%）影响，
       写死 1399 这种事会在别的天气下变成假红（第一版就栽在这）。
       改成按同一套倍率反算，验的是**公式与单调性**，不是某一组常数。 */
    var k = 1 + (G.battle.techOf ? G.battle.techOf('range') : 0);
    if (G.story && G.story.combatMod) k *= G.story.combatMod().archerRange;
    /* v89.95：短射程兵种的纵深吃 FIELD_MIN 兜底 → eff 必须同一口径，否则假红 */
    var raw = function (id) { return Math.round(DATA.TROOPS[id].range * k); };
    var eff = function (id) { return Math.max(T.FIELD_MIN, raw(id) + T.FIELD_MARGIN); };
    var D = function (a, b) { return T.battlefieldOf(a, b, 0, {}); };
    var one = function (id) { var o = {}; o[id] = 500; return o; };
    return D(one('yibing'), one('yibing')) === Math.max(T.FIELD_MIN, eff('yibing'))
      && D(one('changqiang'), one('yibing')) === eff('changqiang')
      && D(one('gongjian'), one('yibing')) === eff('gongjian')
      && D(one('toudan'), one('yibing')) === eff('toudan')
      /* 射程越远 → 战场越宽（近战也参与比较，所以义兵 < 长枪 < 弓 < 投石） */
      && raw('yibing') < raw('changqiang') && raw('changqiang') < raw('gongjian')
      && eff('gongjian') < eff('toudan')
      /* 取**双方**最远：弓对投石 = 投石那一边 */
      && D(one('gongjian'), one('toudan')) === eff('toudan')
      /* 斥候（nocombat）不参战，也不该把战场撑大 */
      && D(one('chihou'), one('yibing')) === eff('yibing');
  })(), (function () {
    var T = G.tactic, o = { yibing: 1 }, g = { gongjian: 1 };
    return '义兵 ' + T.battlefieldOf(o, o, 0, {}) + ' / 弓 ' + T.battlefieldOf(g, o, 0, {});
  })());""",
     """  check('战场距离 = max(最远射程+MARGIN, (双方最快速度和)×MARCH_ROUNDS_MIN, FIELD_MIN)（v89.139 速度参与）', (function () {
    var T = G.tactic;
    /* ⚠️ 不写死数字：射程会被**科技**（抛射 +4%/级）与**天气**（雨天弓 −20%）影响，
       写死 1399 这种事会在别的天气下变成假红（第一版就栽在这）。
       改成按同一套倍率反算，验的是**公式与单调性**，不是某一组常数。
       v89.139（老板 1）：「战场距离不对，考虑兵种速度和最远射程」——
       新增第二条下限：(双方最快单位速度之和) × MARCH_ROUNDS_MIN（接敌至少 3 回合）。 */
    var k = 1 + (G.battle.techOf ? G.battle.techOf('range') : 0);
    if (G.story && G.story.combatMod) k *= G.story.combatMod().archerRange;
    var raw = function (id) { return Math.round(DATA.TROOPS[id].range * k); };
    var spd = function (id) {
      var t = DATA.TROOPS[id];
      return Math.round(t.spd * ((G.battle.spdMult) ? G.battle.spdMult(t) : 1));
    };
    var eff = function (a, b) {
      return Math.max(T.FIELD_MIN, Math.max(raw(a), raw(b)) + T.FIELD_MARGIN,
        Math.round((spd(a) + spd(b)) * T.MARCH_ROUNDS_MIN));
    };
    var D = function (a, b) { return T.battlefieldOf(a, b, 0, {}); };
    var one = function (id) { var o = {}; o[id] = 500; return o; };
    return D(one('yibing'), one('yibing')) === eff('yibing', 'yibing')
      && D(one('changqiang'), one('yibing')) === eff('changqiang', 'yibing')
      && D(one('gongjian'), one('yibing')) === eff('gongjian', 'yibing')
      && D(one('toudan'), one('yibing')) === eff('toudan', 'yibing')
      /* 射程越远 → 战场越宽（近战也参与比较，所以义兵 < 长枪 < 弓 < 投石） */
      && raw('yibing') < raw('changqiang') && raw('changqiang') < raw('gongjian')
      && raw('gongjian') < raw('toudan')
      /* 取**双方**最远：弓对投石 = 投石那一边 */
      && D(one('gongjian'), one('toudan')) === eff('gongjian', 'toudan')
      /* 速度下限真的生效：轻骑 vs 轻骑（快）+ 短射程 → D 由速度项撑起 */
      && D(one('qingji'), one('qingji')) === Math.round(spd('qingji') * 2 * T.MARCH_ROUNDS_MIN)
      /* 斥候（nocombat）不参战，也不该把战场撑大/撑快 */
      && D(one('chihou'), one('yibing')) === eff('chihou', 'yibing')
      && spd('chihou') > spd('yibing');
  })(), (function () {
    var T = G.tactic, o = { yibing: 1 }, g = { gongjian: 1 }, q = { qingji: 1 };
    return '义兵 ' + T.battlefieldOf(o, o, 0, {}) + ' / 弓 ' + T.battlefieldOf(g, o, 0, {})
      + ' / 轻骑 ' + T.battlefieldOf(q, q, 0, {});
  })());""",
     'smoke 距离公式'),

    # ③ 默认纵深断言
    ("""    var a = G.battle.simulate({ yibing: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    var c = G.battle.simulate({ gongjian: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    return a.field === G.tactic.FIELD_MIN && c.field > a.field && a.engine === 'tactic'
      && c.field === G.tactic.battlefieldOf({ gongjian: 500 }, { yibing: 500 }, 0, {});""",
     """    var a = G.battle.simulate({ yibing: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    var c = G.battle.simulate({ gongjian: 500 }, null, { yibing: 500 }, 0, null, { kind: 'wild' });
    /* v89.139：纯近战纵深不再等于 FIELD_MIN（600）——速度下限（义兵 200×2×3=1200）接管 */
    return a.field === G.tactic.battlefieldOf({ yibing: 500 }, { yibing: 500 }, 0, {})
      && c.field > a.field && a.engine === 'tactic'
      && c.field === G.tactic.battlefieldOf({ gongjian: 500 }, { yibing: 500 }, 0, {});""",
     'smoke 默认纵深'),
], ['地图方向箭头已退役', 'MARCH_ROUNDS_MIN', '速度下限（义兵'])
print('✅ smoke 三段已改：' + ' / '.join(ok))
