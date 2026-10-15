# -*- coding: utf-8 -*-
"""patch_v8996_a_src.py — v89.96 伤害链源头标定（撤末端系数；幂等可复跑）

老板批注：「伤害计算不要乱定系数，计算过程应当简洁，
  如果出现平衡性问题，是否调整兵种属性？或者控制影响战斗的其他因素」

本补丁（全部改**源头**，不动末端）：
  ① 删 T.DAMAGE_SCALE（v89.95 的末端总闸）与 DATA.BATTLE
  ② 兵种 hp ×10（耐久量级：杀率地基 0.73/回合 → 0.073）
  ③ 勇武/智谋覆盖 1%/点 → 0.05%/点（每 20 点 +1%），并**并链**：
     tactic 里的散装 yw/zm/eqAtk/eqDef 四个字段删除，改读 genAttrs.atkPct/defPct
     （与 UI 展示、battle 结算同一个换算原子 —— 修掉"显示与实战分离"）
  ④ 箭塔耐久 ×3（与撤系数同调：拆 100 座 27→29 回合）
  ⑤ 相克表标定：枪克骑 攻 ×2→×3；新增"长枪拒马" 防 ×5
  ⑥ 文案：兵种 desc 过时数字、GEN_DIMS 六维作用、battle/domain 注释
"""
import io
import re
import subprocess
import sys

ROOT = 'E:/Deepseekdb/'


def load(p):
    return io.open(ROOT + p, encoding='utf-8').read()


def save(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)


N_OK = [0]


def rep(s, old, new, tag, must=True):
    if new in s:
        print('SKIP ' + tag)
        return s
    if old not in s:
        if must:
            print('MISS ' + tag)
            raise AssertionError('anchor missing: ' + tag)
        print('soft-miss ' + tag)
        return s
    N_OK[0] += 1
    print('OK   ' + tag)
    return s.replace(old, new, 1)


# ============================================================
# ① js/tactic.js
# ============================================================
P = 'js/tactic.js'
s = load(P)

s = rep(s, """  T.MARCH_UNIT = 1;
  /* v89.95：伤害总闸（读 DATA.BATTLE.damageScale）—— 一击清场的根因见 data.js 注释 */
  T.DAMAGE_SCALE = (function () {
    var d = (DATA.BATTLE || {}).damageScale;
    return (typeof d === 'number' && d > 0) ? d : 1;
  })();
""", """  T.MARCH_UNIT = 1;
  /* ============================================================
   * v89.96（老板批注「伤害计算不要乱定系数，计算过程应当简洁」）：
   * v89.95 的 `T.DAMAGE_SCALE`（末端总闸）**已删除** —— 平衡一律在源头修：
   *   · 兵种耐久：hp ×10（data.js；杀率地基从 0.73/回合 → 0.073）
   *   · 属性覆盖：勇武/智谋 每 20 点 +1%（genAttrs.atkPct/defPct，唯一换算原子）
   *   · 相克表：枪克骑标定（data.js COUNTER_ATK / COUNTER_DEF）
   * 伤害公式回到直读关系：k = perAtk × 数量 × cf ÷ perHp（无任何隐藏乘数）。
   * ============================================================ */
""", '删 T.DAMAGE_SCALE 定义')

s = rep(s, """        /* 攻方视角的攻击加成；守方部队同样带自己的将领 */
        yw: a ? a.yw : 0, eqAtk: a ? (a.atk || 0) : 0,
        /* v29（需求 11）：防御侧的两个来源 —— 智谋（每点 +1% 防御）与装备防御。
           它们不再塞进"生命值放大"，而是进入 perDef()，参与攻防对冲。 */
        zm: a ? a.zm : 0, eqDef: a ? (a.def || 0) : 0,""",
"""        /* v89.96（老板「控制影响战斗的其他因素」）：攻/防加成**只走一个来源** ——
           genAttrs 的 atkPct/defPct（唯一换算原子见 domain.js atkPctOf/defPctOf）。
           旧版在这里散装 yw/zm/eqAtk/eqDef 四个字段、在 perAtk/perDef 里各乘一遍，
           与 UI 展示（v52 换算链）相差 4 倍 —— 属"显示与实战分离"，已并链。 */
        atkPct: a ? (a.atkPct || 0) : 0,
        defPct: a ? (a.defPct || 0) : 0,""", 'unitsOf 字段并链')

s = rep(s, """  /* 该部队的**单位**攻击值（不含数量）：基础 + 装备攻击×覆盖，再乘各类百分比 */
  T.perAtk = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.atk + u.eqAtk * u.cover;         // 「兵种基础值 + 将领/装备加成」
    var pct = 1;
    pct *= (1 + u.yw * 0.01 * u.cover);           // 勇武：每点 +1% 全军攻击
    pct *= (1 + TB('atk'));                       // 兵器技巧等
""", """  /* 该部队的**单位**攻击值（不含数量）：兵种基础攻 × 加成链
     （将领/装备 → 科技 → 符 → 剧情 → 相克 → 攻城）。
     v89.96：将领与装备**合入同一条百分比链**（genAttrs.atkPct，每 20 点勇武 +1%、
     装备每 10 攻值 +1%）—— 旧版把装备攻击值当"绝对值加到兵种攻上"
     （弓 220 + 装备 8000 = ×37），与 UI 展示链相差 4 倍；已并链。 */
  T.perAtk = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.atk;                                  // 兵种基础攻（唯一来源）
    var pct = 1 + (u.atkPct || 0) * (u.cover || 0);    // 将领+装备（atkPct 唯一换算原子）
    pct *= (1 + TB('atk'));                            // 兵器技巧等
""", 'perAtk 并链')

s = rep(s, """  T.perDef = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.def + (u.eqDef || 0) * (u.cover || 0);
""", """  T.perDef = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.def;                                  // 兵种基础防（v89.96：装备并链）
""", 'perDef base 并链')

s = rep(s, """    if (opts.defMul > 1) base *= opts.defMul;
    var pct = 1;
    pct *= (1 + (u.zm || 0) * 0.01 * (u.cover || 0));   // 智谋：每点 +1% 全军防御
    pct *= (1 + TB('def'));                             // 护甲/练兵一类科技
""", """    if (opts.defMul > 1) base *= opts.defMul;
    var pct = 1 + (u.defPct || 0) * (u.cover || 0);     // 将领+装备（defPct 唯一换算原子）
    pct *= (1 + TB('def'));                             // 护甲/练兵一类科技
""", 'perDef 并链')

s = rep(s, """      var av = perA * shooter.count * (ctx.decay || 1) * T.DAMAGE_SCALE;""",
        """      var av = perA * shooter.count * (ctx.decay || 1);""", 'fireOnce 去系数')

s = rep(s, """      var av = power * wallFireMul * T.DAMAGE_SCALE;""",
        """      var av = power * wallFireMul;""", '城头火力去系数')

s = rep(s, """            var tAv = tPerA * u.count * T.rangeDecay(gap, effRange) * T.DAMAGE_SCALE;""",
        """            var tAv = tPerA * u.count * T.rangeDecay(gap, effRange);""", '拆塔去系数')

s = rep(s, """  /* 受击部队的单位生命。
     v29（需求 11）：这里**只剩**兵种生命与补给/体力加成 ——
     智谋与装备护甲已移到 perDef()，不再重复计算（否则同一个防御属性被算两遍）。 */""",
"""  /* 受击部队的单位生命。
     v29（需求 11）：这里**只剩**兵种生命与补给/体力加成 ——
     智谋与装备护甲已移到 perDef()，不再重复计算（否则同一个防御属性被算两遍）。
     v89.96：兵种生命本身 ×10（源头耐久标定，见 data.js TROOPS 注释）。 */""", 'perHp 注释')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('tactic.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])

# ============================================================
# ② js/data.js
# ============================================================
P = 'js/data.js'
s = load(P)

# —— ②-a 删 DATA.BATTLE 块 ——
s = rep(s, """  /* ============================================================
   * v89.95（B1 余波 · 老板「根本没有回合对战乐趣」）：**伤害总闸**
   * ------------------------------------------------------------
   * 实测病根：单位攻击值 ≈ 兵种攻 ×（1 + 勇武×覆盖%）——勇武 300 就是 ×4，
   * 再叠装备/科技/剧情；一击可杀 1660 名义兵（对面只有 600）。
   * 于是"一次齐射清场"，战斗 1~3 回合结束 —— 去不去溅射都救不回来。
   * 口径：所有伤害（主动攻击 / 反击 / 城头火力 / 拆箭塔）**统一乘本系数**，
   * 只改节奏不改相对强弱（谁强还是谁强，但要打上好几回合）。
   * 标定方式：探针实测"典型对局回合数"落进 8~16 回合（见 tools/probe）。
   * ============================================================ */
  DATA.BATTLE = { damageScale: 0.34 };
""", """  /* ============================================================
   * v89.96（老板批注「伤害计算不要乱定系数，计算过程应当简洁」）：
   * v89.95 的 `DATA.BATTLE.damageScale`（末端总闸）**已删除** ——
   * 平衡一律在源头修（本文件的兵种 hp / 相克表 / 箭塔耐久，
   * 加 domain.js 的属性覆盖系数）。标定探针：
   * .workbuddy/tools/probe/probe_v8996_dmgchain.js（扫参表与实测回合数都在里面）。
   * ============================================================ */
""", '删 DATA.BATTLE')

# —— ②-b 兵种 hp ×10（只处理 TROOPS 块） ——
i0 = s.index('DATA.TROOPS = {')
i1 = s.index('};', i0)
block = s[i0:i1]
n_hp = len(re.findall(r'hp:\s*\d+', block))
assert n_hp == 18, 'expect 18 troops, got %d' % n_hp
if 'hp: 1000,' not in block:      # 幂等标记：民夫 100→1000
    block2 = re.sub(r'hp:\s*(\d+)', lambda m: 'hp: ' + str(int(m.group(1)) * 10), block)
    s = s[:i0] + block2 + s[i1:]
    print('OK   兵种 hp ×10（18 种）')
else:
    print('SKIP 兵种 hp ×10')

# —— ②-c TROOPS 块抬头注释（标定依据） ——
s = rep(s, """  DATA.TROOPS = {
    minfu:   { id: 'minfu',""", """  /* v89.96 耐久标定（老板「调整兵种属性」）：全部兵种 hp ×10 ——
     标定依据：裸兵杀率地基 = 兵攻 ÷ 兵血 = 220/300 = 0.73/回合（一击清场）；
     ×10 后 0.073/回合（≈14 回合一场），且兵种间相对强弱**完全不变**（同乘）。
     与"撤末端系数"的关系：v89.95 的伤害 ×0.34 是末端补丁，本表 ×10 是源头口径——
     两条数学上部分等效，但本表会对战力尺（STORY.troopPower 直接读本表）、
     守军、UI 显示、探针全线生效，不留"只有战斗变慢"的暗角。 */
  DATA.TROOPS = {
    minfu:   { id: 'minfu',""", 'TROOPS 抬头注释')

# —— ②-d desc 过时数字 ——
s = rep(s, "desc: '血5000防600，城墙杀手（工匠作坊制造）'",
        "desc: '重甲巨车，城墙杀手（工匠作坊制造）'", '冲车 desc', must=False)
s = rep(s, "desc: '血2500，战场重坦' }", "desc: '南疆巨兽，战场重坦' }", '象兵 desc', must=False)
s = rep(s, "desc: '血2500，战场重坦'", "desc: '南疆巨兽，战场重坦'", '象兵 desc（兜底）', must=False)

# —— ②-e 箭塔耐久 ×3 ——
s = rep(s, """  DATA.WALL_TOWER = {
    name: '箭塔', hp: 2000, atk: 300, def: 360, range: 1250,""",
"""  DATA.WALL_TOWER = {
    /* v89.96 标定：hp 2000 → 6000（×3，与"撤末端系数 1/0.34≈2.94"同调）——
       撤系数后拆塔快 2.9 倍，耐久 ×3 把"拆 100 座"的节奏标回 ~29 回合（实测 27→29）。
       ⚠️ 塔的 atk **保持 300 不动**：实测 atk×3 会让攻城方损失 50% 且 30 回合拆不完。 */
    name: '箭塔', hp: 6000, atk: 300, def: 360, range: 1250,""", '箭塔耐久')

# —— ②-f COUNTER 表标定 ——
s = rep(s, """    /* 枪克骑：长枪对骑兵 ×200%（原版写"骑兵（轻/铁）"；
       突骑/虎豹骑/西凉铁骑是我们自扩展的同族兵种，一并算骑兵——
       否则同族里只有轻/铁被克，另三种变成"无弱点的骑兵"，关系会断裂） */
    changqiang: { qingji: 2, tieji: 2, tuqibing: 2, hubaoqi: 2, xiliangtieqi: 2 },""",
"""    /* 枪克骑：长枪对骑兵 ×300%（v89.96 标定）——
       ⚠️ 原版 B 套为 ×200%，但本作骑兵 hp 2 倍 + 攻 2.3 倍，实测 ×2 时
       "枪 vs 骑 1:1 完败（损 6000/敌 891）"——克制名存实亡。
       攻 ×3 + 防御向"长枪拒马"×5 后：枪 vs 骑 1:1 胜、战损 3398:6000（1:1.77）。
       扫参表见 probe_v8996_dmgchain 的 K/N 候选矩阵（K3/N5 胜出）。
       突骑/虎豹骑/西凉铁骑是我们自扩展的同族兵种，一并算骑兵——
       否则同族里只有轻/铁被克，另三种变成"无弱点的骑兵"，关系会断裂） */
    changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },""", '枪克骑 攻×3')

s = rep(s, """    /* 刀盾防远程 ×300%（"盾牌挡箭"这一常识的结构化） */
    daodun: { gongjian: 3, chuangnu: 3, toudan: 3 },""",
"""    /* 刀盾防远程 ×300%（"盾牌挡箭"这一常识的结构化） */
    daodun: { gongjian: 3, chuangnu: 3, toudan: 3 },
    /* v89.96 标定：**长枪拒马**（枪挨骑打时兵防 ×5）——与上表的"枪打骑 ×3"配套。
       依据：原版只有攻击向一条，实测不足以体现"枪克骑"（见上表注释）；
       防御向补强符合 B 套"克制靠挨打少实现"的框架（同"刀盾挡箭"的逻辑）。 */
    changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5 },""", '长枪拒马')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('data.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])

# ============================================================
# ③ js/domain.js
# ============================================================
P = 'js/domain.js'
s = load(P)

s = rep(s, """  /* 将领真实属性（含装备/丹药/符） */
  /* ============================================================
   * v52（老板给定）：将领属性 → 军队加成的换算链
   * ------------------------------------------------------------
   *   1 勇武 = 10 攻击值          1 智谋 = 10 防御值
   *   每 10 攻击值 = 全军攻击 +1%   每 10 防御值 = 全军防御 +1%
   * 老板还要求「将领属性对军队的加成**不直接增加**」——
   *   改前是 `1 + yw/100`（勇武一点直接一趴进乘区），
   *   改后走「属性 → 攻防值 → 百分比」这条链，**装备/套装的 atk/def 也并入同一条链**
   *   （老板：「装备的属性注意按逻辑加成到将领属性中」）。
   *
   * 一个必须写明的数学事实：勇武那一段与旧公式**数值等价**
   *   （yw×10 ÷10 ÷100 = yw/100）。真正变的是**装备攻防的口径**：
   *   旧代码把装备攻击按 `/10000` 并入（+650 → +6.5%），
   *   新链按 `/1000`（+650 → +65%），**强度 ×10**，且与勇武同一条链、可直接相加。
   * ============================================================ */
  GAME.ATK_PER_YW = 10;      /* 1 勇武 → 10 攻击值 */
  GAME.DEF_PER_ZM = 10;      /* 1 智谋 → 10 防御值 */
  GAME.PCT_PER_ATK = 10;     /* 每 10 攻击值 → 全军攻击 +1% */
  GAME.PCT_PER_DEF = 10;     /* 每 10 防御值 → 全军防御 +1% */""",
"""  /* 将领真实属性（含装备/丹药/符） */
  /* ============================================================
   * v52（老板给定）→ v89.96（老板批注「不要乱定系数」）改定：
   *   将领属性 → 军队加成的换算链
   * ------------------------------------------------------------
   *   「攻击值」概念保留（展示用）：1 勇武 = 10 攻击值、1 智谋 = 10 防御值
   *   「全军百分比」走**双刻度**（各有依据，不是拍脑袋）：
   *     · 勇武/智谋 是**无上限成长**的属性（天授 Lv240 勇武 5869）——
   *       旧口径 yw/100（每点 +1%）在此尺度下 ×59.7，一击清场；
   *       新口径 yw×0.0005（**每 20 点 +1%**）→ 顶配 ×3.93 / 英杰 Lv60 ×1.30
   *       （标定：probe_v8996_dmgchain 实测"带将均势对局 8~16 回合"）。
   *     · 装备攻/防值**有天花板**（12 槽），保留 v52 口径：每 10 攻击值 +1%。
   *   换算原子**只有一份**（atkPctOf / defPctOf）——UI 展示（ui.genPane 的
   *   "全军攻击 +X%"）、战报结算（battle.calcDamage）与战斗引擎
   *   （tactic.perAtk/perDef）全部读它。v89.96 并链前，tactic 把装备当
   *   "绝对值加法"另算一份（与展示相差 4 倍）——属"显示与实战分离"，已修。
   * ============================================================ */
  GAME.ATK_PER_YW = 10;      /* 1 勇武 → 10 攻击值（展示口径，v52 保留） */
  GAME.DEF_PER_ZM = 10;      /* 1 智谋 → 10 防御值（展示口径，v52 保留） */
  GAME.PCT_PER_ATK = 10;     /* 装备：每 10 攻击值 → 全军攻击 +1%（v52 保留） */
  GAME.PCT_PER_DEF = 10;     /* 装备：每 10 防御值 → 全军防御 +1%（v52 保留） */
  GAME.YW_PCT = 0.0005;      /* 勇武：每点 → 全军攻击 +0.05%（每 20 点 +1%；v89.96 标定） */
  GAME.ZM_PCT = 0.0005;      /* 智谋：每点 → 全军防御 +0.05%（v89.96 标定） */""", 'domain 换算链注释+常量')

s = rep(s, """  GAME.atkValOf = function (yw, atkEq) { return (yw || 0) * GAME.ATK_PER_YW + (atkEq || 0); };
  GAME.defValOf = function (zm, defEq) { return (zm || 0) * GAME.DEF_PER_ZM + (defEq || 0); };
  GAME.pctOfVal = function (val, per) { return (val || 0) / (per || 1) / 100; };""",
"""  GAME.atkValOf = function (yw, atkEq) { return (yw || 0) * GAME.ATK_PER_YW + (atkEq || 0); };
  GAME.defValOf = function (zm, defEq) { return (zm || 0) * GAME.DEF_PER_ZM + (defEq || 0); };
  GAME.pctOfVal = function (val, per) { return (val || 0) / (per || 1) / 100; };
  /* 全军攻/防百分比 —— **唯一换算原子**（双刻度口径见上方注释块）。
     装备部分复用 pctOfVal（v52 的 /10/100），勇武部分走 YW_PCT —— 两条腿各有依据。 */
  GAME.atkPctOf = function (yw, eqAtk) { return (yw || 0) * GAME.YW_PCT + GAME.pctOfVal(eqAtk, GAME.PCT_PER_ATK); };
  GAME.defPctOf = function (zm, eqDef) { return (zm || 0) * GAME.ZM_PCT + GAME.pctOfVal(eqDef, GAME.PCT_PER_DEF); };""", 'atkPctOf/defPctOf 原子')

s = rep(s, """    a.atkVal = GAME.atkValOf(a.yw, a.atk);                 /* 将领攻击值 */
    a.defVal = GAME.defValOf(a.zm, a.def);                 /* 将领防御值 */
    a.atkPct = GAME.pctOfVal(a.atkVal, GAME.PCT_PER_ATK);  /* 全军攻击加成（小数） */
    a.defPct = GAME.pctOfVal(a.defVal, GAME.PCT_PER_DEF);  /* 全军防御加成（小数） */""",
"""    a.atkVal = GAME.atkValOf(a.yw, a.atk);                 /* 将领攻击值（展示） */
    a.defVal = GAME.defValOf(a.zm, a.def);                 /* 将领防御值（展示） */
    a.atkPct = GAME.atkPctOf(a.yw, a.atk);                 /* 全军攻击加成（唯一原子；v89.96 双刻度） */
    a.defPct = GAME.defPctOf(a.zm, a.def);                 /* 全军防御加成（同上） */""", 'a.atkPct 走路原子')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('domain.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])
print('==== patched items: %d ====' % N_OK[0])
