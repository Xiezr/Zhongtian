# -*- coding: utf-8 -*-
"""patch_v8996_c_final.py — v89.96 定稿批（幂等可复跑）

依据 tools/probe 与 tmp 实测数据（见 docs/v8996 报告）：
  ① 兵种 hp：×10 → **×6**（义兵/刀盾对拼撞 30 上限；×6 后 义vs义 ~24 回合）
  ② 箭塔：hp 回 2000（守原版数据）、tough 1200 → **800**（标定 26 回合拆完 100 座）
  ③ 击杀取整：Math.floor → **Math.round**（修"20v20 义兵每回合 0.625 杀 → 永远 0 杀卡死"）
"""
import io
import re
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
# ① js/data.js：hp ×10 → ×6
# ============================================================
P = 'js/data.js'
s = load(P)
i0 = s.index('DATA.TROOPS = {')
i1 = s.index('};', i0)
block = s[i0:i1]
if 'hp: 600,' not in block:      # 幂等标记：民夫 1000→600
    block2 = re.sub(r'hp:\s*(\d+)', lambda m: 'hp: ' + str(int(round(int(m.group(1)) * 0.6))), block)
    s = s[:i0] + block2 + s[i1:]
    print('OK   hp ×10 → ×6（18 种）')
else:
    print('SKIP hp ×6')

s = rep(s, """  /* v89.96 耐久标定（老板「调整兵种属性」）：全部兵种 hp ×10 ——
     标定依据：裸兵杀率地基 = 兵攻 ÷ 兵血 = 220/300 = 0.73/回合（一击清场）；
     ×10 后 0.073/回合（≈14 回合一场），且兵种间相对强弱**完全不变**（同乘）。
     与"撤末端系数"的关系：v89.95 的伤害 ×0.34 是末端补丁，本表 ×10 是源头口径——
     两条数学上部分等效，但本表会对战力尺（STORY.troopPower 直接读本表）、
     守军、UI 显示、探针全线生效，不留"只有战斗变慢"的暗角。 */""",
"""  /* v89.96 耐久标定（老板「调整兵种属性」）：全部兵种 hp ×6 ——
     标定依据（双约束，实测见 probe_v8996_dmgchain / tmp/_cal96）：
       · 裸兵杀率地基 = 兵攻 ÷ 兵血 = 220/300 = 0.73/回合（一击清场）；
         ×6 后 0.12/回合（一回合打掉 12%）——带将主流对局 13 回合（目标 8~16）；
       · 最慢组合（义兵对拼，攻 50 / 血 1200）= 0.042/回合 → ~24 回合，
         不撞 30 回合上限（×10 时会撞顶，见 _cal96 的对等战矩阵）。
     兵种间相对强弱**完全不变**（同乘）；战力尺（STORY.troopPower 直接读本表）、
     守军、UI 显示、探针全线自动跟随，不留"只有战斗变慢"的暗角。 */""", 'TROOPS 抬头注释 ×6')

s = rep(s, """    /* v89.96 标定：hp 2000 → 6000（×3，与"撤末端系数 1/0.34≈2.94"同调）——
       撤系数后拆塔快 2.9 倍，耐久 ×3 把"拆 100 座"的节奏标回 ~29 回合（实测 27→29）。
       ⚠️ 塔的 atk **保持 300 不动**：实测 atk×3 会让攻城方损失 50% 且 30 回合拆不完。 */
    name: '箭塔', hp: 6000, atk: 300, def: 360, range: 1250,""",
"""    /* v89.96 标定：hp 保持原版 2000（不改塔本身），改 `tough` 1200 → 800 ——
       撤末端系数 + 属性覆盖降率（勇武 300 从 ×4 → ×1.15）后，拆塔速度约降至
       原来的 1/3.5；tough 800 把"投石 4000 + 中级将拆 100 座"标回 **26 回合**
       （实测扫参 tough∈{600,800,1000,1200} → 21/26/30/拆不完）。
       ⚠️ 塔的 atk 保持 300 不动（实测 atk×3 会让攻城方损失 50%、且 30 回合拆不完）。 */
    name: '箭塔', hp: 2000, atk: 300, def: 360, range: 1250,""", '箭塔 hp 回滚 + 注释')

s = rep(s, """    tough: 1200,""", """    tough: 800,""", 'tough 800')
s = rep(s, """       改 1200 后约 8~10 座/回合（原版是"十几回合清完城防"的量级）。 */""",
        """       v89.96 改 800 后约 4 座/回合（配"中级将 + 投石 4000"≈26 回合清 100 座）。 */""",
        'tough 注释', must=False)

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('data.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])

# ============================================================
# ② js/tactic.js：floor → round（两处击杀取整）
# ============================================================
P = 'js/tactic.js'
s = load(P)

s = rep(s, """        var k0 = Math.floor(eff0 / perHp0);
        if (k0 > tg0.count) k0 = tg0.count;          // 自然钳制：不能杀超过目标实有人数""",
"""        /* v89.96：取整用 **round** 而不是 floor ——
           floor 会让"伤害不足一个人份"的攻击恒为 0 杀：实测义兵 20v20
           （每回合 0.625 人份）双方站着不动到 30 回合（卡死）。
           round 的口径是"伤害接近一个人份就算一个战损"，小规模战斗必收敛；
           大部队（每次几百上千杀）round ≈ floor，节奏不受影响。 */
        var k0 = Math.round(eff0 / perHp0);
        if (k0 > tg0.count) k0 = tg0.count;          // 自然钳制：不能杀超过目标实有人数""", 'single 分支 round')

s = rep(s, """        var k = Math.floor(eff / perHp);
        if (k <= 0) break;""",
"""        var k = Math.round(eff / perHp);             /* v89.96：同 single 分支，round 防小规模卡死 */
        if (k <= 0) break;""", '循环分支 round')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('tactic.js check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300])
print('==== final-batch items: %d ====' % N_OK[0])
