# -*- coding: utf-8 -*-
"""patch_v8996_b_sync.py — v89.96 同步（UI 文案 / battle 注释 / smoke 断言；幂等可复跑）"""
import io
import subprocess

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
# ① js/ui.js —— GEN_DIMS 文案 + 注释
# ============================================================
P = 'js/ui.js'
s = load(P)

s = rep(s, """    { k: 'yw', n: '勇武', color: '#c9705a',
      use: '攻击值 +10 · 每 10 攻值→全军攻 +1%',""",
"""    { k: 'yw', n: '勇武', color: '#c9705a',
      use: '全军攻击 +0.05%/点（每20点+1%）',""", 'GEN_DIMS 勇武文案')

s = rep(s, """    { k: 'zm', n: '智谋', color: '#4a9be0',
      use: '防御值 +10 · 每 10 防值→全军防 +1%',""",
"""    { k: 'zm', n: '智谋', color: '#4a9be0',
      use: '全军防御 +0.05%/点（每20点+1%）',""", 'GEN_DIMS 智谋文案')

s = rep(s, """    /* v52（老板给定换算链）：属性不再"一点一趴"直接进乘区，
       而是先折算成攻防值，再按"每 10 点 = +1%"进全军。
       这里写的**就是代码里的同一组常量**（GAME.ATK_PER_YW / PCT_PER_ATK 等），
       改常量忘了改文案会被 smoke 的一致性断言拦下。 */""",
"""    /* v52（老板给定换算链）→ v89.96 改双刻度（见 domain.js atkPctOf 注释）：
       勇武每 20 点 +1%（无上限属性单独降率）、装备每 10 攻值 +1%（v52 保留）。
       这里写的**就是代码里的同一组常量**（GAME.YW_PCT / PCT_PER_ATK 等），
       改常量忘了改文案会被 smoke 的一致性断言拦下。 */""", 'GEN_DIMS 注释')

s = rep(s, """     勇武 → battle.js atkMult = 1 + a.atkPct × cover（atkPct = 攻值/10/100，v52 换算链）
     智谋 → battle.js defBonus / atkDefBonus += a.defPct（同上）""",
"""     勇武 → atkMult = 1 + a.atkPct × cover（atkPct = 勇武×0.0005 + 装备攻值/1000；v89.96）
     智谋 → battle.js defBonus / defMult += a.defPct（同上）""", '五维作用注释')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('ui.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])

# ============================================================
# ② js/battle.js —— 注释同步
# ============================================================
P = 'js/battle.js'
s = load(P)
s = rep(s, """      /* 将领加成 —— v52 走「属性 → 攻防值 → 百分比」这条链（老板给定）：
           1 勇武 = 10 攻击值、每 10 攻击值 = 全军攻击 +1%
           1 智谋 = 10 防御值、每 10 防御值 = 全军防御 +1%
         攻防值里**已经含**装备/套装的 atk/def（genAttrs 统一算），
         所以原来那条 `× (1 + a.atk/10000)` 的旁路必须删掉 —— 留着就是双计。 */""",
"""      /* 将领加成 —— v52 链、v89.96 改双刻度（唯一原子见 domain.js atkPctOf）：
           勇武：每 20 点 → 全军攻击 +1%（无上限属性，单独降率）
           装备：每 10 攻击值 → 全军攻击 +1%（v52 口径，有天花板）
           genAttrs.atkPct 是**唯一换算原子**，UI / 战报 / 战斗引擎三处同源；
           旧 `× (1 + a.atk/10000)` 旁路与 tactic 侧的"装备绝对值加法"均已清除。 */""", 'battle 注释')
save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('battle.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])

# ============================================================
# ③ smoke-test.js —— 三组断言同步
# ============================================================
P = 'smoke-test.js'
s = load(P)

s = rep(s, """  check('作用为固定文案（短句），且数字与常量一致', (function () {
    /* v65（老板）：「压缩一下六维的作用单元格长度」→ 文案改短句。
       但"短"不等于"可以不与代码一致"：这里的每个数字仍逐一对上常量，改常量忘改文案会红。 */
    return /攻击值 \\+10/.test(uiS) && /每 10 攻值→全军攻 \\+1%/.test(uiS)
      && /防御值 \\+10/.test(uiS) && /每 10 防值→全军防 \\+1%/.test(uiS)
      && /带兵 \\+100 · 人口上限 \\+1000/.test(uiS)
      && G.ATK_PER_YW === 10 && G.DEF_PER_ZM === 10 && G.PCT_PER_ATK === 10 && G.PCT_PER_DEF === 10
      && !/'全军攻击 \\+' \\+ a\\.yw/.test(uiS) && !/'全军防御 \\+' \\+ a\\.zm/.test(uiS);
  })(), '含 ATK_PER_YW=' + G.ATK_PER_YW + ' PCT_PER_ATK=' + G.PCT_PER_ATK);""",
"""  check('作用为固定文案（短句），且数字与常量一致', (function () {
    /* v65（老板）：「压缩一下六维的作用单元格长度」→ 文案改短句。
       但"短"不等于"可以不与代码一致"：这里的每个数字仍逐一对上常量，改常量忘改文案会红。
       v89.96：换算链改双刻度（勇武 0.0005/点 · 装备 1/10 攻值），文案与常量同步换。 */
    return /全军攻击 \\+0\\.05%\\/点/.test(uiS) && /全军防御 \\+0\\.05%\\/点/.test(uiS)
      && /带兵 \\+100/.test(uiS)
      && G.ATK_PER_YW === 10 && G.DEF_PER_ZM === 10 && G.PCT_PER_ATK === 10 && G.PCT_PER_DEF === 10
      && G.YW_PCT === 0.0005 && G.ZM_PCT === 0.0005
      && !/'全军攻击 \\+' \\+ a\\.yw/.test(uiS) && !/'全军防御 \\+' \\+ a\\.zm/.test(uiS);
  })(), '含 ATK_PER_YW=' + G.ATK_PER_YW + ' YW_PCT=' + G.YW_PCT + ' PCT_PER_ATK=' + G.PCT_PER_ATK);""",
'断言1：文案+常量')

s = rep(s, """  check('实测：攻防值 = 属性×10 + 装备，全军% = 攻防值÷10÷100', (function () {
    var st = G.newGame({ name: '换算' });
    var g = st.generals[0];
    /* 剥掉所有装备，先只验属性那一段 */
    g.equip = {};
    g.yw = 100; g.zm = 40; g.tong = 50;
    g.attack = 0; g.defense = 0;
    var a = G.genAttrs(g);
    var okBare = a.atkVal === 1000 && a.defVal === 400
      && Math.abs(a.atkPct - 1) < 1e-9 && Math.abs(a.defPct - 0.4) < 1e-9;
    /* 再装一件有攻击的武器：攻击值并入同一条链（而不是走旧代码那条 /10000 旁路） */
    g.equip = { weapon: 'yt_sword' };
    var b = G.genAttrs(g);
    var wAtk = DATA.EQUIP.yt_sword.atk || 0;
    var wYw = DATA.EQUIP.yt_sword.yw || 0;
    var okEquip = b.atkVal === (100 + wYw) * 10 + wAtk
      && Math.abs(b.atkPct - b.atkVal / 1000) < 1e-9;
    /* 换算原子必须与派生字段一致（防"公式抄两份、改一处"） */
    var okAtom = b.atkVal === G.atkValOf(b.yw, b.atk) && b.defVal === G.defValOf(b.zm, b.def)
      && Math.abs(b.atkPct - G.pctOfVal(b.atkVal, G.PCT_PER_ATK)) < 1e-12;
    return okBare && okEquip && okAtom;
  })(), '裸装 勇武100→+100%、智谋40→+40%');""",
"""  check('实测：攻值 = 属性×10 + 装备（展示）；全军% = 勇武×0.0005 + 装备/1000（v89.96 双刻度）', (function () {
    var st = G.newGame({ name: '换算' });
    var g = st.generals[0];
    /* 剥掉所有装备，先只验属性那一段 */
    g.equip = {};
    g.yw = 100; g.zm = 40; g.tong = 50;
    g.attack = 0; g.defense = 0;
    var a = G.genAttrs(g);
    var okBare = a.atkVal === 1000 && a.defVal === 400
      && Math.abs(a.atkPct - 100 * G.YW_PCT) < 1e-9 && Math.abs(a.defPct - 40 * G.ZM_PCT) < 1e-9;
    /* 再装一件有攻击的武器：装备攻值并入同一条百分比链（每 10 攻值 +1%，v52 保留） */
    g.equip = { weapon: 'yt_sword' };
    var b = G.genAttrs(g);
    var wAtk = DATA.EQUIP.yt_sword.atk || 0;
    var wYw = DATA.EQUIP.yt_sword.yw || 0;
    var okEquip = b.atkVal === (100 + wYw) * 10 + wAtk
      && Math.abs(b.atkPct - ((100 + wYw) * G.YW_PCT + wAtk / G.PCT_PER_ATK / 100)) < 1e-9;
    /* 换算原子必须与派生字段一致（防"公式抄两份、改一处"） */
    var okAtom = b.atkVal === G.atkValOf(b.yw, b.atk) && b.defVal === G.defValOf(b.zm, b.def)
      && Math.abs(b.atkPct - G.atkPctOf(b.yw, b.atk)) < 1e-12
      && Math.abs(b.defPct - G.defPctOf(b.zm, b.def)) < 1e-12;
    return okBare && okEquip && okAtom;
  })(), '裸装 勇武100→+' + (100 * G.YW_PCT * 100) + '% · 装备并入同一原子');""",
'断言2：换算实测')

s = rep(s, """  /* v89.95：伤害总闸（DATA.BATTLE.damageScale）下调后，拆 100 座箭塔需要更多回合
     —— 窗口按"能拆完但不拖到 30 回合"重设。 */
  return r.towerStart === 100 && r.towerLeft === 0 && hitRound >= 3 && hitRound <= 28
    /* 拆完之后必须继续打守军 → 守损 > 0 且能赢 */
    && r.defLoss > 0 && r.winner === 'atk' && r.rounds < 30;""",
"""  /* v89.96：撤末端系数 + 箭塔耐久 ×3（与兵种 hp ×10 同调）后，拆 100 座箭塔约 29 回合
     —— 窗口按"能拆完但不拖到 30 回合"重设。 */
  return r.towerStart === 100 && r.towerLeft === 0 && hitRound >= 3 && hitRound <= 30
    /* 拆完之后必须继续打守军 → 守损 > 0 且能赢 */
    && r.defLoss > 0 && r.winner === 'atk' && r.rounds < 30;""", '断言3：拆塔窗口')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('smoke check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:400])
print('==== synced items: %d ====' % N_OK[0])
