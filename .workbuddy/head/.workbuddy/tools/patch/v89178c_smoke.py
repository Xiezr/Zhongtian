# -*- coding: utf-8 -*-
"""v89.178 补丁 C：smoke 断言升级（6 处口径变更）+ 新增 §178 段
   升级清单：
     C1 8491  枪克骑"1:1 打赢" → "同人口胜 + 同数量重创 ≥55%"（新表实测）
     C2 9145  相克查询数值（×3/×4/×5）→ 新表（×2/×2/×3/×2.5…）
     C3 9492  相克补两项（×4 / ×2）→ ×2 / ×1.5
     C4 §131⑤ troopCounterOf 的 mul 3 → 2.5
     C5 §164③ 智能交换比判据：on.dL > off.dL（敌损）→ on.aL < off.aL*0.5（我损砍半）
     C6 §94   出征预估文案（情报 Lv / 此战凶险）升级
     C7 §⑦    exp-sum 元素断言升级（已退役）
   新增：§178 段（4 条：表值锚定 / 克制实测比值 / 源码级文案 / 预估块骨架 + 档案在册）
   跑法：python .workbuddy/tools/patch/v89178c_smoke.py"""
import io

P = 'smoke-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
assert '\r\n' not in s, 'CRLF detected'

PAIRS = []

# ---------------- C1：枪克骑实测 ----------------
PAIRS.append((
"""check('实测：枪克骑标定生效（长枪 1:1 打赢轻骑——克制不再名存实亡）', (function () {
  var r = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 6000 }, 0, null, { kind: 'wild' });
  return r.winner === 'atk';
})(), '长枪 6000 vs 轻骑 6000');""",
"""check('实测：枪克骑标定生效（同人口胜；同数量（骑2倍人口）重创敌军 ≥55%）', (function () {
  /* v89.178：克制降档后口径升级（枪×2.5 / 拒马×3）——
     同人口（6000 枪 vs 3000 骑，各 6000 pop）长枪**胜**；
     同数量（骑 2 倍人口）**败但敌损 ≥55%**（靠克制顶住人口劣势）。
     改前实测：同数量也胜（损 42%）—— 那是克制过强的证据（2 倍人口劣势还能赢）。 */
  var r1 = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 3000 }, 0, null, { kind: 'wild' });
  if (r1.winner !== 'atk') return false;
  var r2 = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 6000 }, 0, null, { kind: 'wild' });
  return r2.defLoss >= 6000 * 0.55;
})(), '同人口胜 · 同数量敌损 ≥55%');"""))

# C1b：邻近历史注释跟进（×3/×5 → ×2.5/×3）
PAIRS.append((
"""     （枪打骑 ×3 + 长枪拒马 ×5，见 data.js COUNTER 表），长枪是铁骑的**天敌**，""",
"""     （v89.178 起：枪打骑 ×2.5 + 长枪拒马 ×3，见 data.js COUNTER 表），长枪是铁骑的**天敌**，"""))

# ---------------- C2：相克查询数值 ----------------
PAIRS.append((
"""  return T.counterDefOf('daodun', 'gongjian') === 3
    && T.counterDefOf('daodun', 'chuangnu') === 3
    && T.counterDefOf('qingji', 'gongjian') === 4
    && T.counterDefOf('tieji', 'toudan') === 2
    && T.counterDefOf('chongche', 'gongjian') === 5
    /* 原版明确：冲车只防**弓**，不防弩、不防投 */
    && T.counterDefOf('chongche', 'toudan') === 1
    && T.counterAtkOf('changqiang', { qingji: 1 }) === 3        /* v89.96 标定：2→3 */
    && T.counterDefOf('changqiang', 'qingji') === 5             /* v89.96：长枪拒马（挨骑打 ×5） */
    && T.counterAtkOf('chuangnu', { chongche: 1 }) === 3""",
"""  return T.counterDefOf('daodun', 'gongjian') === 2
    && T.counterDefOf('daodun', 'chuangnu') === 2
    && T.counterDefOf('qingji', 'gongjian') === 2
    && T.counterDefOf('tieji', 'toudan') === 1.5
    && T.counterDefOf('chongche', 'gongjian') === 3
    /* 原版明确：冲车只防**弓**，不防弩、不防投 */
    && T.counterDefOf('chongche', 'toudan') === 1
    && T.counterAtkOf('changqiang', { qingji: 1 }) === 2.5      /* v89.178：3→2.5 */
    && T.counterDefOf('changqiang', 'qingji') === 3             /* v89.178：拒马 5→3 */
    && T.counterAtkOf('chuangnu', { chongche: 1 }) === 3        /* v89.178：器械专项保留 */"""))

# ---------------- C3：相克补两项 ----------------
PAIRS.append((
"""check('相克补两项：虎豹骑同轻骑（防远程×4）、西凉铁骑同铁骑（×2）；突骑仍无',
  G.tactic.counterDefOf('hubaoqi', 'gongjian') === 4
  && G.tactic.counterDefOf('hubaoqi', 'toudan') === 4
  && G.tactic.counterDefOf('xiliangtieqi', 'gongjian') === 2
  && G.tactic.counterDefOf('tuqibing', 'gongjian') === 1""",
"""check('相克补两项：虎豹骑同轻骑（防远程×2）、西凉铁骑同铁骑（×1.5）；突骑仍无',
  G.tactic.counterDefOf('hubaoqi', 'gongjian') === 2
  && G.tactic.counterDefOf('hubaoqi', 'toudan') === 2
  && G.tactic.counterDefOf('xiliangtieqi', 'gongjian') === 1.5
  && G.tactic.counterDefOf('tuqibing', 'gongjian') === 1"""))

# ---------------- C4：§131⑤ 反查出口 ----------------
PAIRS.append((
"""      return cq && cq.beats.some(function (x) { return x.id === 'qingji' && x.mul === 3; })""",
"""      return cq && cq.beats.some(function (x) { return x.id === 'qingji' && x.mul === 2.5; })"""))

# ---------------- C5：§164③ 智能交换比判据 ----------------
PAIRS.append((
"""      var off = run(false), on = run(true);
      var rOff = off.aL > 0 ? off.dL / off.aL : 0;
      var rOn = on.aL > 0 ? on.dL / on.aL : 0;
      _r164sim = 'off=' + rOff.toFixed(2) + ' → on=' + rOn.toFixed(2);
      return rOn > rOff * 2 && on.dL > off.dL;""",
"""      var off = run(false), on = run(true);
      var rOff = off.aL > 0 ? off.dL / off.aL : 0;
      var rOn = on.aL > 0 ? on.dL / on.aL : 0;
      _r164sim = 'off=' + rOff.toFixed(2) + ' → on=' + rOn.toFixed(2)
        + '（我损 ' + off.aL + '→' + on.aL + '）';
      /* v89.178：克制降档后重测（镜像小局 0.83→1.97；我方损失 1767→671）。
         判据升级：交换比 ≥2× **且我方损失砍半** —— 智能方案的设计目标是"我方少死"
         （v89.176 老板：减少伤亡很重要）；旧判据 "on.dL > off.dL"（敌方多死）已删。 */
      return rOn > rOff * 2 && on.aL < off.aL * 0.5;"""))

# ---------------- C6：§94 文案断言 ----------------
PAIRS.append((
"""    check('E2：界面文案是"军师估算"（不再写"战力估算：一键正解"）', (function () {
      return uS94.indexOf('⚔️ 军师估算') >= 0 && uS94.indexOf('情报 Lv') >= 0
        && uS94.indexOf('此战凶险：胜则可入史册') >= 0;
    })());""",
"""    check('E2：界面文案是"军师估算"；v89.178 起区间/情报条退役、「此战凶险」并入兵力标签', (function () {
      return uS94.indexOf('⚔️ 军师估算') >= 0
        && uS94.indexOf('pw74.intelLv') < 0
        && uS94.indexOf('区间：我 1 : ') < 0
        && uS94.indexOf('兵力偏少，此战凶险') >= 0;
    })());"""))

# ---------------- C7：§⑦ exp-sum 断言 ----------------
PAIRS.append((
"""  check('⑦ 结构：总览/战力行 + 每兵种行 [上限][清空]（v89.144 起从标题栏挪进行内）+ 动作注册', (function () {
    return /id="exp-sum"/.test(uS) && /id="exp-power"/.test(uS)""",
"""  check('⑦ 结构：预估块（march/power/haul；v89.178 起 #exp-sum「共派遣」退役）'
    + ' + 每兵种行 [上限][清空] + 动作注册', (function () {
    return !/id="exp-sum"/.test(uS) && /id="exp-power"/.test(uS)"""))

for old, new in PAIRS:
    c = s.count(old)
    assert c == 1, 'anchor count=%d: %s' % (c, old[:70])
    s = s.replace(old, new)

# ---------------- C8：新增 §178 段（插在 §177 收尾后、结果行前） ----------------
ANCHOR = "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(ANCHOR) == 1, 'tail anchor'

SEC178 = """  })();

  /* ═══════════════════════════════════════════════════════════════
   * §178（v89.178）——兵种克制降档（老板：「兵种克制太厉害了……外的系数给到3倍，
   *   游戏体感很差。766弓箭手杀伤35个敌方轻骑兵，这合理吗。」）
   *   + 出征预估文案精简（共派遣 / 区间·情报 / 此战凶险 三处）
   * ═══════════════════════════════════════════════════════════════ */
  (function () {
    console.log('  --- §178 克制降档与出征文案 ---');
    var fs178 = require('fs'), p178 = require('path');
    var uS178 = fs178.readFileSync(p178.join(__dirname, 'js', 'ui.js'), 'utf8');
    var _r178b = '';

    check('§178① 新表锚定：攻向枪 2.5 / 弩器械 3（专项保留）；防向全线降档', (function () {
      var A = DATA.COUNTER_ATK, Df = DATA.COUNTER_DEF;
      return A.changqiang.qingji === 2.5 && A.changqiang.xiliangtieqi === 2.5
        && A.chuangnu.chongche === 3
        && Df.daodun.gongjian === 2 && Df.changqiang.qingji === 3
        && Df.qingji.gongjian === 2 && Df.tieji.gongjian === 1.5
        && Df.chongche.gongjian === 3 && Df.hubaoqi.gongjian === 2 && Df.xiliangtieqi.gongjian === 1.5;
    })());

    check('§178② 克制不再是"打不动"：766 弓打轻骑首杀 ≥ 无克制的 55%（改前实测 43%）', (function () {
      /* 对照组：临时清空防御向表（弓不在攻表 -> 等价"无克制"）-> 同场景再跑。
         首杀 = 我方第一次 attack 事件的 kill（与手测口径一致）。
         注：绝对值受**天气**影响（雨天弓射程 −20% 改变开火时机）——
         比值口径把天气消掉（同一环境下两个数同倍变化）。 */
      function firstKill(A, B) {
        var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
        var first = 0, g = 0;
        while (!env.over && g++ < 40) {
          var st = env.step();
          (st.events || []).forEach(function (e) {
            if (e.kind === 'attack' && e.side === 'atk' && !first) first = e.kill || 0;
          });
        }
        return first;
      }
      var kept, raw, bakK = DATA.COUNTER_DEF;
      try {
        kept = firstKill({ gongjian: 766 }, { qingji: 800 });
        DATA.COUNTER_DEF = {};
        raw = firstKill({ gongjian: 766 }, { qingji: 800 });
      } finally { DATA.COUNTER_DEF = bakK; }
      _r178b = '克制下 ' + kept + ' / 无克制 ' + raw + ' = ' + (raw > 0 ? (kept / raw).toFixed(2) : '?');
      return raw > 0 && kept / raw >= 0.55;
    })(), _r178b);

    check('§178③ 出征预估源码级：共派遣/区间/情报条退役；「兵力偏少，此战凶险」在册', (function () {
      var S = uS178;
      return S.indexOf("'👥 共派遣") < 0
        && S.indexOf('区间：我 1 : ') < 0
        && S.indexOf('pw74.intelLv') < 0
        && S.indexOf('font-weight:700;">⚑') < 0
        && S.indexOf('兵力偏少，此战凶险') >= 0
        && /var pow73 = \\$\\('#exp-power'\\);/.test(S);
    })());

    check('§178④ 预估块骨架：march/power/haul 三框（#exp-sum 退役）', (function () {
      var h = G.ui.expEstBlockHTML();
      return h.indexOf('id="exp-march"') >= 0 && h.indexOf('id="exp-power"') >= 0
        && h.indexOf('id="exp-haul"') >= 0 && h.indexOf('exp-sum') < 0;
    })());

    var arc178 = fs178.readFileSync(p178.join(__dirname, '需求档案.md'), 'utf8');
    check('§178⑤ 需求档案在册（v89.178 · 老板原文关键句）',
      arc178.indexOf('v89.178') >= 0
      && arc178.indexOf('766弓箭手') >= 0
      && arc178.indexOf('兵力偏少，此战凶险') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

s = s.replace(ANCHOR, SEC178)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch C OK: smoke-test.js updated, len=%d' % len(s))
