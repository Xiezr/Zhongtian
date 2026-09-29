# -*- coding: utf-8 -*-
"""v89.195 批次B：为将领资质补全属性（老板 3）
B1 state.js   applyLevelGrowth 攻防成长改小数累积器（修 round 抹平）
B2 state.js   rankUpUse 升档补齐攻防（只补不削 + toast 列出）
B3 domain.js  guardFillOf 守将攻防成型（独立折损旋钮 atkDim）
B4 data.js    DATA.GUARD_FOLD 加 atkDim: 0.25（探针标定）
每段独立写盘 + 幂等守卫。"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- B1 state.js：攻防累积器 ----------------
B1_OLD = """    g.attack = Math.round(g.attack + step * 0.4);
    g.defense = Math.round(g.defense + step * 0.4);"""
B1_NEW = """    /* v89.195（老板 3）：「为将领资质补全属性」——攻防成长**取整抹平**修复：
       旧写法 `Math.round(g.attack + step*0.4)` 每级都把小数回吞 —— 凡品（0.4/级）
       永远 +0（实测 Lv100 攻防仍 10）、良材 0.8 与英杰 1.2 被双双抹成 +1/级
       （"资质决定成长"在攻防这条链上名存实亡）。
       改为**小数累积器**：每级入账 step×0.4，整点入账、余数留池（实测长期均值
       = 0.4×成长值：凡 0.4 / 良 0.8 / 英 1.2 / 名 2.0 / 天 3.2）。
       atkAcc/defAcc 随档序列化；老档缺省 0（不追溯历史，只影响未来升级 ——
       升档补齐由 GAME.rankUpUse 负责）。 */
    g.atkAcc = (g.atkAcc || 0) + step * 0.4;
    var atkTake = Math.floor(g.atkAcc);
    if (atkTake > 0) { g.attack += atkTake; g.atkAcc -= atkTake; }
    g.defAcc = (g.defAcc || 0) + step * 0.4;
    var defTake = Math.floor(g.defAcc);
    if (defTake > 0) { g.defense += defTake; g.defAcc -= defTake; }"""
rep('js/state.js', 'B1 levelGrowth-accumulator', B1_OLD, B1_NEW, 'g.atkAcc = (g.atkAcc || 0) + step * 0.4;')

# ---------------- B2 state.js：升档补齐攻防 ----------------
B2_OLD = """    var freeLump = (DATA.RANKUP_FREE_PTS || {})[item.to] || 0;
    if (freeLump > 0) g.freePts = (g.freePts || 0) + freeLump;
    /* 晋升所见即所得：固定属性 / 淬炼奖励 / 自由点 三项逐一列出 */
    var extra = [];
    if (filled > 0) extra.push('四维补足至「' + (nr.name || item.to) + '」基准 ' + baseFloor);
    if (asc78 > 0) extra.push('四维 +' + asc78 + '（灵草淬炼）');
    if (freeLump > 0) extra.push('自由属性点 +' + freeLump);"""
B2_NEW = """    var freeLump = (DATA.RANKUP_FREE_PTS || {})[item.to] || 0;
    if (freeLump > 0) g.freePts = (g.freePts || 0) + freeLump;
    /* v89.195（老板 3）：「为将领资质补全属性」——**攻防也补**。
       攻防成长受资质影响（每级 0.4×成长值，见 applyLevelGrowth），但升档从不动它 ——
       "凡品练上来的将"升到高资质后，攻防仍停在旧档的累积水平（实测 Lv60 凡品
       升到名世：攻防 10，而直接招募的名世 ~208+）——与四维"不低于地板"的
       补全精神不一致。口径：**补足到"全程按新资质成长"的标准线**，只补不削：
       标准线 = GEN_BASE.attack + (等级−1) × 0.4 × 新成长值。 */
    var _lv195 = Math.max(1, g.level || 1);
    var _gb195 = DATA.GEN_BASE || { attack: 10, defense: 10 };
    var _std195 = Math.round((_gb195.attack || 10) + (_lv195 - 1) * 0.4 * (nr.grow || 1));
    var _dAtk195 = Math.max(0, _std195 - (g.attack || 0));
    var _dDef195 = Math.max(0, _std195 - (g.defense || 0));
    if (_dAtk195 > 0) g.attack = _std195;
    if (_dDef195 > 0) g.defense = _std195;
    /* 晋升所见即所得：固定属性 / 淬炼奖励 / 自由点 / 攻防 四项逐一列出 */
    var extra = [];
    if (filled > 0) extra.push('四维补足至「' + (nr.name || item.to) + '」基准 ' + baseFloor);
    if (asc78 > 0) extra.push('四维 +' + asc78 + '（灵草淬炼）');
    if (freeLump > 0) extra.push('自由属性点 +' + freeLump);
    if (_dAtk195 > 0 || _dDef195 > 0) {
      extra.push('攻防补足至「' + (nr.name || item.to) + '」Lv' + _lv195 + ' 标准（攻 +' + _dAtk195 + ' · 防 +' + _dDef195 + '）');
    }"""
rep('js/state.js', 'B2 rankup-attdef', B2_OLD, B2_NEW, '_dAtk195 = Math.max(0, _std195 - (g.attack || 0));')

# ---------------- B3 domain.js：守将攻防成型 ----------------
B3_OLD = """    var dims = ['tong', 'yw', 'zm', 'nz'], up = Math.max(0, (g.level || 1) - 1);
    dims.forEach(function (d) {
      g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f * dimK);
    });
    g.freePts = 0;"""
B3_NEW = """    var dims = ['tong', 'yw', 'zm', 'nz'], up = Math.max(0, (g.level || 1) - 1);
    dims.forEach(function (d) {
      g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f * dimK);
    });
    g.freePts = 0;
    /* v89.195（老板 3）：**攻防也"成型"** —— 旧出口只补四维与体力，攻防（全军加成的
       另一半来源，见 genAttrs 的 atkPct/defPct）遗漏，野地/据点守将恒为 base 10（+1%）。
       与四维同一把尺（同乘折损），但攻防是"全局加成"更敏感 —— 用**独立折损旋钮**
       fold.atkDim（默认 0.25 = dim 的一半）：探针（probe_v89195c）实测折 0.5 会把
       "据点 Lv10 可胜边界"从 1.4× 推到 1.5×；折 0.25 时边界与既有口径完全一致
       （1.4× 可胜），增量贡献 +3.7%~7.7% 全军攻击 —— "资质相称"可见、不破墙。
       ⚠️ 名城守将（不传 fold）**不补攻防** —— 维持 v89.73 起的既有平衡
       （其手写对象本就没有 attack/defense 字段，genAttrs 读作 0）。 */
    var _atkK195 = fold ? Math.max(0, Math.min(1, fold.atkDim == null ? 0.25 : fold.atkDim)) : 0;
    if (_atkK195 > 0) {
      var _gb195g = DATA.GEN_BASE || { attack: 10, defense: 10 };
      g.attack = Math.round((_gb195g.attack || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
      g.defense = Math.round((_gb195g.defense || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
    }"""
rep('js/domain.js', 'B3 guardFill-attdef', B3_OLD, B3_NEW, 'var _atkK195 = fold ? Math.max(0, Math.min(1, fold.atkDim')

# ---------------- B4 data.js：atkDim ----------------
B4_OLD = "  DATA.GUARD_FOLD = { dim: 0.5, staPct: 0.8 };"
B4_NEW = """  /* v89.195（老板 3 · 探针 probe_v89195c 标定）：「为将领资质补全属性」——
     守将的**攻防成长**也成型（v89.185 只补了四维与体力）。atkDim = 攻防成长折损，
     独立于 dim（攻防直接产"全军加减成"，更敏感）：
       · 0.25（定稿）→ 据点 Lv10 可胜边界与既有口径一致（1.4× 我胜）；增量 +3.7%~7.7%。
       · 0.5（否决）→ 边界被推到 1.5×（我损 +37%~45%），过强。
       · 0（关）→ 退回"守将攻防恒 = base 10"。一处表值即可回退。 */
  DATA.GUARD_FOLD = { dim: 0.5, staPct: 0.8, atkDim: 0.25 };"""
rep('js/data.js', 'B4 GUARD_FOLD.atkDim', B4_OLD, B4_NEW, 'atkDim: 0.25 };')

print('批次B 完成')
