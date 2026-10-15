# -*- coding: utf-8 -*-
"""v89.179a —— 克制系统全撤（老板：「得了，不算了，取消所有克制关系，
直接按兵种纸面数据计算，复核纸面数据机制是否合理」）

改动面（六件套）：
  data.js     —— 删两张相克表（墓碑注释）+ 3 条 desc + SMART_PLAN 相克注释 + 两处杂注释
  tactic.js   —— 删 counterAtkOf/counterDefOf + perAtk/perDef 因子 + fireOnce/城头/攻城 消费点
  battle.js   —— dice 折算 + smartPickTarget + 两处注释
  ui.js       —— troopCounterOf + 悬停"克制/抗性/被克"三行（墓碑）
  questdata.js—— 两条任务文案
  index.html  —— .cnt-good/.cnt-bad 悬停配色（墓碑）
逐文件原子：任何一条锚缺失 → 该文件不落盘（打印 ❌ 供修复）。
"""
import io, sys

R = 'E:/Deepseekdb/'
FAILS = []

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def E(s, name, old, new, cnt=1):
    """精确替换（恒真断言：命中数必须 == cnt；已应用判定：new 在、old 不在）"""
    global FAILS
    n = s.count(old)
    if n == cnt:
        return s.replace(old, new)
    if n == 0 and new and new[:36] in s:
        print('  [already] ' + name)
        return s
    FAILS.append(name + ' (hit=' + str(n) + ', want=' + str(cnt) + ')')
    print('  ❌ ' + name + ' hit=' + str(n))
    return s

def cut(s, name, a_tok, b_tok, repl):
    """区间替换：[a 行首, b 行首) → repl。用于多行块（免逐字缩进风险）。"""
    global FAILS
    try:
        ia = s.index(a_tok)
        ib = s.index(b_tok, ia)
    except ValueError as e:
        if repl[:36] in s:
            print('  [already] ' + name)
            return s
        FAILS.append(name + ' (anchor miss)')
        print('  ❌ ' + name + ' anchor miss: ' + str(e))
        return s
    ia_ls = s.rindex('\n', 0, ia) + 1
    ib_ls = s.rindex('\n', 0, ib) + 1
    assert ia_ls < ib_ls, name
    return s[:ia_ls] + repl + s[ib_ls:]

def line_out(s, name, tok, repl_line=None, must_contain=None):
    """删/换一整行（tok 所在行）。"""
    global FAILS
    try:
        i = s.index(tok)
    except ValueError:
        if repl_line and repl_line[:30] in s:
            print('  [already] ' + name)
            return s
        FAILS.append(name + ' (line miss)')
        print('  ❌ ' + name + ' line miss')
        return s
    ls = s.rindex('\n', 0, i) + 1
    le = s.index('\n', i) + 1
    seg = s[ls:le]
    if must_contain and must_contain not in seg:
        FAILS.append(name + ' (segment mismatch)')
        print('  ❌ ' + name + ' segment mismatch: ' + repr(seg[:60]))
        return s
    if repl_line is None:
        return s[:ls] + s[le:]
    lead = seg[:len(seg) - len(seg.lstrip())]
    return s[:ls] + lead + repl_line + '\n' + s[le:]

print('===== data.js =====')
s = rd('js/data.js')
s = E(s, 'D1 头注释', '③ 军事           TROOPS / 相克 / 阵位 / 城防 / TECH',
      '③ 军事           TROOPS / 阵位 / 城防 / TECH')
s = E(s, 'D2 枪 desc', "desc: '克制骑兵，阵型严整' }", "desc: '攻守均衡，阵型严整' }")
s = E(s, 'D3 盾 desc', "desc: '高防御，克远程，炮灰首选' }", "desc: '高防御，炮灰首选' }")
s = E(s, 'D4 象 desc', "desc: '南疆巨兽，血厚守坚；无相克，凭蛮力硬拼' }",
      "desc: '南疆巨兽，血厚守坚，凭蛮力硬拼' }")
s = E(s, 'D5 象兵注释尾',
      '· 定位从"攻守双绝"改为**血牛重坦**（hp/pop 全表最高 3000、atk/pop 124 最低）。 */',
      '· 定位从"攻守双绝"改为**血牛重坦**（hp/pop 全表最高 3000、atk/pop 124 最低）。\n'
      '       v89.179：克制全撤后全表都是"无克制、硬碰硬"口径 —— 象兵的"先例"成为常态。 */')
# 相克两表整体退役（区间替换）
TOMB = '''  /* ============================================================
   * 兵种相克 —— **v89.179 全撤**（老板：「得了，不算了，取消所有克制关系，
   *   直接按兵种纸面数据计算，复核纸面数据机制是否合理」）
   * ------------------------------------------------------------
   * 这里原本是两张"方向表"（v57 B 套）：`COUNTER_ATK[我][你]`（我打你时我攻 ×N）
   * 与 `COUNTER_DEF[我][你]`（我挨你打时我防 ×N）。四次调整的终点：
   *   v57 建表 → v89.96 枪克骑标定（×3/×5）→ v89.118 象兵先例（不进表）
   *   → v89.178 全表降档（老板「外部系数太猛」）→ **v89.179 全撤（定稿）**。
   * 全撤动因（标定矩阵实证 · .workbuddy/tools/probe/probe_v89179a/b）：
   *   克制系数就是**胜负手** —— 同一对局在系数矩阵里能从"枪胜"横跨到"骑胜"，
   *   任何取值都在替玩家决定"谁该赢"；老板定调「克制只能局部放大优势，
   *   不得改变整体态势」→ 实操结论 = 全部取消，战斗**直接按 TROOPS 纸面数值**计算。
   * 去向（同批退役，不留死代码）：`T.counterAtkOf / counterDefOf`（tactic.js）、
   *   dice 折算（battle.damageOf）、开火/智能评分/城头火线（tactic.fireOnce、
   *   battle.smartPickTarget）、界面「克制/抗性/被克」三行与 `ui.troopCounterOf`。
   * 纸面数据机制复核：docs/v89179 + probe_v89179c（全兵种对局矩阵与阶梯读数）。
   * ============================================================ */
'''
try:
    i0 = s.index('兵种相克（v57')
    k0 = s.rindex('  /* ============================================================', 0, i0)
    i1 = s.index('DATA.COUNTER_DEF = {', i0)
    i2 = s.index('\n  };', i1) + len('\n  };')
    old = s[k0:i2]
    assert 'qingji: 2.5' in old and 'xiliangtieqi: { gongjian: 1.5' in old and '突骑（tuqibing）**保持没有因子**' in old
    s = s[:k0] + TOMB + s[i2:]
    print('  [ok] D6 相克两表退役（' + str(len(old)) + ' 字符 → 墓碑）')
except AssertionError as e:
    FAILS.append('D6 区间断言'); print('  ❌ D6 区间断言失败')
except ValueError as e:
    if 'v89.179 全撤' in s:
        print('  [already] D6 相克两表退役')
    else:
        FAILS.append('D6 区间'); print('  ❌ D6 ' + str(e))
s = E(s, 'D7 SMART 段注释',
      '   · 目标表（targets）：按相克表把火力引到"最该打的目标"（枪找骑 ×3、骑切后排…）；',
      '   · 目标表（targets）：按 v89.164 静态标定把火力引到"最该打的目标"（枪找骑、骑切后排…）；')
s = E(s, 'D8 目标表注释',
      '    /* 目标指派（我方兵种 → 敌方代表兵种）——依据相克表 + "切后排"常识，扫参确定 */',
      '    /* 目标指派（我方兵种 → 敌方代表兵种）——依据 v89.164 静态标定 + "切后排"常识，扫参确定\n'
      '       （v89.179 起克制已全撤：目标偏好只是推进侧重，不再有任何倍率支撑） */')
s = E(s, 'D9 枪目标注释', "changqiang: 'qingji',        /* 长枪 → 轻骑（打骑 ×3 · 挨骑 ×5 防御） */",
      "changqiang: 'qingji',        /* 长枪 → 轻骑（v89.164 静态标定） */")
s = E(s, 'D10 盾目标注释', "daodun: 'gongjian',          /* 刀盾 → 弓（防射 ×3 顶箭冲锋 · 弓防最低） */",
      "daodun: 'gongjian',          /* 刀盾 → 弓（弓防最低 · v89.164 静态标定） */")
s = E(s, 'D11 弩目标注释', "chuangnu: 'chuangnu',        /* 床弩 → 器械（×3 反器械） */",
      "chuangnu: 'chuangnu',        /* 床弩 → 器械（对器械族） */")
s = E(s, 'D12 骑族注释', "      /* 骑族 → 弓（骑防远程 ×2~×4 · 冲散后排火力） */",
      "      /* 骑族 → 弓（冲散后排火力 · v89.164 静态标定） */")
s = E(s, 'D13 源头注释', '   * 平衡一律在源头修（本文件的兵种 hp / 相克表 / 箭塔耐久，',
      '   * 平衡一律在源头修（本文件的兵种 hp / 箭塔耐久，')
if not any(x.startswith(('D1', 'D2', 'D3', 'D4', 'D5', 'D6')) for x in FAILS):
    wr('js/data.js', s)
    print('  ✅ data.js 落盘')
else:
    print('  ⛔ data.js 有失败项，不落盘')

print('===== tactic.js =====')
s = rd('js/tactic.js')
s = E(s, 'T1 头注释', '× 兵种克制 × 攻城修正', '× 攻城修正')
s = E(s, 'T2 v89.96 注', '   *   · 相克表：枪克骑标定（data.js COUNTER_ATK / COUNTER_DEF）',
      '   *   · 相克表：**v89.179 已全撤**（战斗按兵种纸面数值；沿革见 data.js 墓碑）')
s = E(s, 'T3 perAtk 文档', '     （将领/装备 → 科技 → 符 → 剧情 → 相克 → 攻城）。',
      '     （将领/装备 → 科技 → 符 → 剧情 → 攻城）。')
s = E(s, 'T4 perAtk 因子删除',
      '''    /* v57：相克改成 **B 套的攻击向因子**（`COUNTER_ATK[我][你]`，×2 或 ×3）。
       不再是"单向 ×1.5"——那张表连"盾打枪/骑打弓"都算加成，而 B 套明确说没有。 */
    if (opts && opts.counterMul > 1) pct *= opts.counterMul;
''', '')
s = E(s, 'T5 perDef 签名/因子', '''  T.perDef = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.def;                                  // 兵种基础防（v89.96：装备并链）
    /* v57：相克的**防御向**因子（B 套的核心）——"我挨你打时我的兵防 ×N"。
       刀盾防远程 ×3、轻骑防远程 ×4、铁骑 ×2、冲车防弓 ×5。
       它与装备防御一起被放大（口径上"兵防"是整体概念），不再区分来源。 */
    if (opts.defMul > 1) base *= opts.defMul;''', '''  T.perDef = function (u) {
    var t = DATA.TROOPS[u.id];
    var base = t.def;                                  // 兵种基础防（v89.96：装备并链）''')
# 两条出口整体退役（区间替换）
s = cut(s, 'T6 counter 出口退役', '相克（v57 · B 套：分方向两向因子）',
        'T.counterDefOf = function (defenderId, attackerId) {', '''  /* ---------- 兵种相克（已退役）----------
     v89.179：克制系统全撤（老板「取消所有克制关系，直接按兵种纸面数据计算」）——
     `counterAtkOf / counterDefOf` 两条出口随 data.js 两张表一并删除：战斗伤害
     只剩"兵种纸面数值 × 加成链"，不再有"打谁 / 被谁打"的对局态乘数。
     历史注记：防御向出口曾误收 army 对象 → 整套防御向静默失效（全靠实测打印发现）；
     相克系统的功过与全撤依据见 docs/v89179。 */
''')
# 注意：cut 到 counterDefOf 行首——函数体还在，再整段切掉
try:
    i = s.index('T.counterDefOf = function')
    j = s.index('\n  };', i) + len('\n  };')
    seg = s[i:j]
    assert 'counterDefOf' in seg and len(seg) < 400
    s = s[:i] + s[j:]
    print('  [ok] T6b counterDefOf 函数体删除')
except (ValueError, AssertionError) as e:
    if 'T.counterDefOf = function' not in s:
        print('  [already] T6b')
    else:
        FAILS.append('T6b'); print('  ❌ T6b ' + str(e))
# fireOnce：enemyArmyOf 函数 + 变量 + perAtk 调用
try:
    ia = s.index('/* 把部队列表折成')
    ib = s.index('/* 一次开火：', ia)
    ia_ls = s.rindex('\n', 0, ia) + 1
    ib_ls = s.rindex('\n', 0, ib) + 1
    seg = s[ia_ls:ib_ls]
    assert 'enemyArmyOf' in seg and '供克制判定使用' in seg
    s = s[:ia_ls] + s[ib_ls:]
    print('  [ok] T7 enemyArmyOf 删除')
except (ValueError, AssertionError) as e:
    if 'enemyArmyOf' not in s:
        print('  [already] T7')
    else:
        FAILS.append('T7'); print('  ❌ T7 ' + str(e))
try:
    i = s.index('var enemyArmy = enemyArmyOf(enemyUnits);')
    ls = s.rindex('\n', 0, i) + 1
    le = s.index('\n', i) + 1
    s = s[:ls] + s[le:]
    print('  [ok] T8 enemyArmy 变量删除')
except ValueError:
    print('  [already] T8')
try:
    ia = s.index('var perA = T.perAtk(shooter, {')
    ib = s.index('});', ia)
    ib_le = s.index('\n', ib) + 1
    ia_ls = s.rindex('\n', 0, ia) + 1
    lead = s[ia_ls:ia]
    seg = s[ia_ls:ib_le]
    assert 'counterMul' in seg and 'T.counterAtkOf' in seg
    s = s[:ia_ls] + lead + 'var perA = T.perAtk(shooter, { sieging: !!opts.sieging, siegeMult: ctx.siegeMult });\n' + s[ib_le:]
    print('  [ok] T9 fireOnce perAtk 调用')
except (ValueError, AssertionError) as e:
    if 'counterMul' not in s:
        print('  [already] T9')
    else:
        FAILS.append('T9'); print('  ❌ T9 ' + str(e))
s = E(s, 'T10 single 分支 cf0',
      '        var cf0 = T.clashFactor(perA, T.perDef(tg0, { defMul: T.counterDefOf(tg0.id, shooter.id) }));',
      '        var cf0 = T.clashFactor(perA, T.perDef(tg0));')
# 循环分支：注释 + defMul 行 + cf 行
try:
    ia = s.index('/* v57（相克 B 套）：防御向因子只看')
    ib = s.index('T.perDef(tg, { defMul: defMul }));', ia)
    ib_le = s.index('\n', ib) + 1
    ia_ls = s.rindex('\n', 0, ia) + 1
    lead = s[ia_ls:ia]
    seg = s[ia_ls:ib_le]
    assert 'defMul = T.counterDefOf' in seg and 'clashFactor' in seg
    s = s[:ia_ls] + lead + 'var cf = T.clashFactor(perA, T.perDef(tg));\n' + s[ib_le:]
    print('  [ok] T11 循环分支 cf 简化')
except (ValueError, AssertionError) as e:
    if 'clashFactor(perA, T.perDef(tg, { defMul' not in s:
        print('  [already] T11')
    else:
        FAILS.append('T11'); print('  ❌ T11 ' + str(e))
# 城头：删除 defMul 行 + 简化 cf
try:
    ia = s.index('刀盾抗箭 ×3、轻骑抗箭 ×4、冲车防弓 ×5 都对工事生效')
    ib = s.index("var defMul = T.counterDefOf(tg.id, 'gongjian');", ia)
    # 注释块行首到 defMul 行尾
    ia_ls = s.rindex('\n', 0, ia) + 1
    ib_le = s.index('\n', ib) + 1
    s = s[:ia_ls] + s[ib_le:]
    print('  [ok] T12a 城头注释+defMul 行删除')
except ValueError as e:
    if 'counterDefOf' not in s:
        print('  [already] T12a')
    else:
        FAILS.append('T12a'); print('  ❌ T12a ' + str(e))
s = E(s, 'T12b 城头 cf 简化', 'var cf = T.clashFactor(power, T.perDef(tg, { defMul: defMul }));',
      'var cf = T.clashFactor(power, T.perDef(tg));')
s = E(s, 'T13 攻城 tPerA', 'T.perAtk(u, { counterMul: 1, sieging: !!opts.sieging, siegeMult: siegeMult })',
      'T.perAtk(u, { sieging: !!opts.sieging, siegeMult: siegeMult })')
if not any(x.startswith(('T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13')) for x in FAILS):
    wr('js/tactic.js', s)
    print('  ✅ tactic.js 落盘')
else:
    print('  ⛔ tactic.js 有失败项，不落盘')

print('===== battle.js =====')
s = rd('js/battle.js')
s = E(s, 'B1 damageOf 折算删除', '''      /* v57：相克改成 B 套（见 data.js 的 COUNTER_ATK / COUNTER_DEF）。
         这里是**攻击向**：与 tactic 引擎读同一张表，不另写一套。 */
      var mult = GAME.tactic ? GAME.tactic.counterAtkOf(id, defenderArmy) : 1;
      /* **防御向**：dice 引擎没有 A/D 对冲，用"守方对这支攻方兵种的最高防御因子"
         折算成除法（×N 防御 ≈ 伤害 ÷N）。方向与量级与 tactic 的 2A/(A+D) 一致，
         但不完全等价 —— dice 本就是简化回退引擎，切引擎时相克强度会有差异。 */
      var defMul = 1;
      for (var did in defenderArmy) {
        if ((defenderArmy[did] || 0) <= 0) continue;
        var dm = GAME.tactic ? GAME.tactic.counterDefOf(did, id) : 1;
        if (dm > defMul) defMul = dm;
      }''', '''      /* v89.179：克制系统全撤 —— dice 回退引擎与 tactic 主引擎同口径：
         伤害 = 兵种纸面攻 × 加成链（不再有"打谁 / 被谁打"的对局态因子）。 */''')
s = E(s, 'B2 damageOf 公式', '      var dmg = cnt * t.atk * mult * atkMult / defMul;',
      '      var dmg = cnt * t.atk * atkMult;')
s = E(s, 'B3 smartPick 开头', '''    var T = GAME.tactic;
    var enemyArmy = {};
    list.forEach(function (e) { enemyArmy[e.id] = (enemyArmy[e.id] || 0) + e.count; });
    var perA = T.perAtk(u, { counterMul: T.counterAtkOf(u.id, enemyArmy) });
    var best = null, bestSc = -Infinity;
    list.forEach(function (e) {
      var cf = T.clashFactor(perA, T.perDef(e, { defMul: T.counterDefOf(e.id, u.id) }));''',
      '''    var T = GAME.tactic;
    var perA = T.perAtk(u);
    var best = null, bestSc = -Infinity;
    list.forEach(function (e) {
      var cf = T.clashFactor(perA, T.perDef(e));''')
s = E(s, 'B4 smartPick 注释', '规则：dmg = 期望实伤（perAtk×相克×防御对冲÷单兵HP）；eff = 有效杀（防溢出，',
      '规则：dmg = 期望实伤（perAtk×防御对冲÷单兵HP · v89.179 起无相克项）；eff = 有效杀（防溢出，')
s = E(s, 'B5 unitFinalOf 注释1', '   * ⚠️ 不含"相克 / 攻城"这类**对局态**因子（那是 perAtk 的 opts，随打谁而变）——',
      '   * ⚠️ 不含"攻城"这类**对局态**因子（那是 perAtk 的 opts，随打谁而变）——')
s = E(s, 'B6 unitFinalOf 注释2', '   *   悬停给的是"这支部队自己的面板"，相克请见兵种说明。',
      '   *   悬停给的是"这支部队自己的面板"。')
if not any(x.startswith(('B1', 'B2', 'B3', 'B4', 'B5', 'B6')) for x in FAILS):
    wr('js/battle.js', s)
    print('  ✅ battle.js 落盘')
else:
    print('  ⛔ battle.js 有失败项，不落盘')

print('===== ui.js =====')
s = rd('js/ui.js')
s = cut(s, 'U1 troopCounterOf 退役', 'v89.151（老板 5）：兵种"克制 / 被克"反查', 'ui.btUnitTip = function',
        '''  /* v89.179：克制系统全撤 —— `ui.troopCounterOf`（克制/抗性/被克反查，v89.151 唯一出口）
     随两张相克表一并退役；兵种悬停不再有"克制 / 抗性 / 被克"三行
     （v89.157 的"无相克不显示"至此演进为"全局无相克"）。 */
''')
try:
    ia = s.index('    var c = ui.troopCounterOf(u.id);')
    ib = s.index('    h += \'<div class="tip-a">', ia)
    seg = s[ia:ib]
    assert 'cnt-good' in seg and 'cnt-bad' in seg
    s = s[:ia] + '    /* v89.179：克制/抗性/被克三行随全撤删除。 */\n' + s[ib:]
    print('  [ok] U2 悬停三行删除')
except (ValueError, AssertionError) as e:
    if 'troopCounterOf' not in s:
        print('  [already] U2')
    else:
        FAILS.append('U2'); print('  ❌ U2 ' + str(e))
s = E(s, 'U3 悬停文档注释', '       克制（绿）→ 抗性（绿）→ 被克（红）；收尾一行带队与加成说明。',
      '       收尾一行带队与加成说明（v89.179：克制三行随全撤删除）。')
if not any(x.startswith(('U1', 'U2', 'U3')) for x in FAILS):
    wr('js/ui.js', s)
    print('  ✅ ui.js 落盘')
else:
    print('  ⛔ ui.js 有失败项，不落盘')

print('===== questdata.js =====')
s = rd('js/questdata.js')
s = E(s, 'Q1 g21', "desc: '枪阵森严，拒马破骑。'", "desc: '枪阵森严，拒马如林。'")
s = E(s, 'Q2 r04', "desc: '枪兵克制骑兵，宜多备之。'", "desc: '枪阵严整，宜多备之。'")
if not any(x.startswith(('Q1', 'Q2')) for x in FAILS):
    wr('js/questdata.js', s)
    print('  ✅ questdata.js 落盘')
else:
    print('  ⛔ questdata.js 有失败项，不落盘')

print('===== index.html =====')
s = rd('index.html')
s = E(s, 'H1 悬停配色退役', '''  /* v89.151（老板 5）：悬停里的相克两行 —— 克制/抗性 = 绿字 · 被克 = 红字（老板点名颜色） */
  .tip-layer .tip-l.cnt-good { color: var(--green-ok); }
  .tip-layer .tip-l.cnt-bad { color: var(--red-light); }''',
      '''  /* v89.179：.cnt-good/.cnt-bad（悬停相克行配色）随克制全撤删除。 */''')
if not any(x.startswith('H1') for x in FAILS):
    wr('index.html', s)
    print('  ✅ index.html 落盘')
else:
    print('  ⛔ index.html 有失败项，不落盘')

print('')
if FAILS:
    print('❌ 失败清单：')
    for f in FAILS:
        print('   - ' + f)
    sys.exit(1)
print('✅ 全部落盘完成')
