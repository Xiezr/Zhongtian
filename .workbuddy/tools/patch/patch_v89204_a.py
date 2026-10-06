# -*- coding: utf-8 -*-
"""v89.204 批次 A：data.js —— 民心占领机制数据层
  A1 DATA.SIEGE：scope 扩至全部城池 / heartsLoss=20 / 动态 chip 四键退役
  A2 DATA.INVASION.loseCity: false -> true（撤销"输了不丢城"红线）
规则来源：老板「据点、城池占领以民心为基础，战斗成功，败方失去20点民心，
民心为0时可以被占领（如为我方，除主城不可被占领外，别的城池将会被敌方占领）」
"""
import io, sys

P = 'E:/Deepseekdb/js/data.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, tag + ' count=' + str(c)
    s2 = s.replace(old, new)
    wr(P, s2)
    print('[ok] ' + tag)

# ── A1：SIEGE 表 ──
A1_OLD = """  DATA.SIEGE = {
    scope: ['fort', 'county'],      /* 试点范围：野外据点 + 县城（郡/州/都仍是决战） */
    repairPerDay: 8,                /* 每整日守备恢复（%）：围而不攻会前功尽弃 */
    /* 破防强度 —— **实测标定**（v89.94 探针扫参，别凭感觉改）：
       45（原口径）→ 一场围攻 2 波就下城，"五五开"波数只占 14%；
       16 → 4~7 波一场围攻，逐波扫过平衡点，带内波数 **21%**（验收线 20%），总波数 758。
       → 围攻变成"每波都要决定投多少"，而不是"两波速通"。 */
    chipBase: 16,                   /* 战力比 1:1 时单波破防 16% */
    chipMin: 10, chipMax: 45,       /* 单波破防上下限（保底有进展 / 强军 3 波可下） */
    defScale: 0.35,                 /* 守备 0% 时守军仍保留 35%（残兵据守） */
    defThr: 0.30,                   /* 守备 0% 时城防系数仍保留 30% */
    retreatChipMul: 0.5,            /* 主动撤退：本波破防按半计 */
    /* \u26d4 v89.198（老板「清除战法这个玩法」· 2026-10-05）：战法系数
       （encircle / surprise）随玩法全撤退役 —— 沿革与去向见下方 DATA.OPS 墓碑；
       围攻（chipBase/上下限/恢复/保底）等其余口径不受影响。 */
  };"""
A1_NEW = """  DATA.SIEGE = {
    /* v89.204（老板 1）：「据点、城池占领以民心为基础，战斗成功，败方失去20点民心，
       民心为0时可以被占领」——
       守备值（hold）的口径**改制为民心**：单场**获胜** −heartsLoss（固定 20），
       民心归零 + 本战获胜 = 拔城；战败 / 主动撤退**不折损民心**。
       沿革：v89.94 原口径为「不论胜负都破防 · 破防量按战力比 16×比 夹在 [10,45] ·
       撤退半计（retreatChipMul）」—— 四键（chipBase/chipMin/chipMax/retreatChipMul）
       随本轮整条退役（回退点 = v89.203 快照）。 */
    scope: ['fort', 'county', 'jun', 'zhou', 'capital'],   /* v89.204：全部城池纳入围攻（名城不再是决战制） */
    repairPerDay: 8,                /* 每整日民心恢复（%）：围而不攻会前功尽弃 */
    heartsLoss: 20,                 /* v89.204：单场获胜，守方失去的民心（老板给定 20） */
    defScale: 0.35,                 /* 民心 0% 时守军仍保留 35%（残兵据守） */
    defThr: 0.30,                   /* 民心 0% 时城防系数仍保留 30% */
    /* \u26d4 v89.198（老板「清除战法这个玩法」· 2026-10-05）：战法系数
       （encircle / surprise）随玩法全撤退役 —— 沿革与去向见下方 DATA.OPS 墓碑。 */
  };"""
rep('A1 SIEGE 表', A1_OLD, A1_NEW, 'heartsLoss: 20,')

# ── A2：INVASION.loseCity ──
A2_OLD = "    loseCity: false,          // \u26d4 体验红线：输了不丢城"
A2_NEW = """    loseCity: true,           /* v89.204（老板 1）：撤销"输了不丢城"红线 ——
                                 民心归零且城破 → 城池被敌方占领（主城不可被占，见 GAME.cityFallen） */"""
rep('A2 loseCity', A2_OLD, A2_NEW, 'loseCity: true,')

print('patch A done')
