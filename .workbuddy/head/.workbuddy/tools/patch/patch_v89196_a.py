# -*- coding: utf-8 -*-
"""v89.196 批次A：为将领资质补全属性 v2（老板 1）
A1 data.js  DATA.RANKUP_AWARD 升档奖励表（50/100/200/400/800 按目标档）
A2 state.js rankUpUse 四维段：补地板 → **按等级重演**
A3 state.js rankUpUse 自由点等级差补 + 数值奖励段 + extra 文案
"""
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

# ---------------- A1 data.js：RANKUP_AWARD ----------------
A1_OLD = "  DATA.RANKUP_FREE_PTS = { liang: 25, ying: 60, ming: 140, tian: 280 };"
A1_NEW = """  DATA.RANKUP_FREE_PTS = { liang: 25, ying: 60, ming: 140, tian: 280 };

  /* ============================================================
   * v89.196（老板 1 · 2）：「作为提升资质的奖励，额外再给予一定的属性数值奖励，
   *   如各 50，100，200，400，800」——**升档数值奖励表**（按**目标档**取值）。
   * 口径：
   *   · 发放维度：**四维（统率/内政/勇武/智谋）各 +N** 与 **体力上限 +N**（staAdd）；
   *     ⚠️ 速度**不参与** —— 速度量级为几十（全档成长一致、每 5 级 +1），
   *     +50~800 会直接击穿先手/机动体系（探针实证：+800 即 10 倍速度）。
   *     若将来要纳入速度，在本表加 spd 字段并在 rankUpUse 发放段接线即可。
   *   · fan: 50 为**表占位**（升档不会以凡品为目标；与老板给出的五个数一一对应）。
   *   · 与 RANKUP_FREE_PTS（自由点 lump）**叠加**：那份是"自由属性点"（要玩家逐点分配），
   *     本表是"直接属性数值"（立即可见）——老板原话的两件事。
   * 调平衡只改这张表；发放在 GAME.rankUpUse 唯一出口。 */
  DATA.RANKUP_AWARD = { fan: 50, liang: 100, ying: 200, ming: 400, tian: 800 };"""
rep('js/data.js', 'A1 RANKUP_AWARD', A1_OLD, A1_NEW, 'DATA.RANKUP_AWARD = { fan: 50')

# ---------------- A2 state.js：四维段升级（等级重演） ----------------
A2_OLD = """    /* v89.179c（老板 3 ①）：**补全该资质的固定属性** —— 低档将领的四维本来低于新档地板
       （凡品 30 / 良材 46 / 英杰 64 / 名世 86 / 天授 108 = GEN_RANKS[].base[0]），
       只改 rank 不补属性的话，"升了档"却仍是旧档的属性骨架，名不副实。
       晋升后四维一律补足到新档 base[0] 下限（只补不削，已高于地板的不动）。 */
    var baseFloor = (nr.base && nr.base[0]) || 0;
    var filled = 0;
    if (baseFloor > 0) {
      var _ks = ['tong', 'yw', 'zm', 'nz'];
      for (var _ki = 0; _ki < _ks.length; _ki++) {
        if ((g[_ks[_ki]] || 0) < baseFloor) { g[_ks[_ki]] = baseFloor; filled++; }
      }
    }"""
A2_NEW = """    /* v89.196（老板 1-1）：「按相应高资质补全**等级相关的六维**和自由属性点」——
       把 v89.179c 的"补地板"（只到 base[0]）升级为**按等级重演**：
       升档后四维应达到"若从一开始就是新资质、练到当前等级"的水平：
         target[d] = 新档基础(base[0]) × 风格系数 + (等级−1) × 新成长 × 系数 × (4/Σm)
       （与升级链 applyLevelGrowth 同一成长式；只补不削。
         老板本轮的定义：基础属性 = "基于资质、0 级也存在"（= base[0]）；
         每级固定增长 = grow；风格偏科由风格系数保留。） */
    var baseFloor = (nr.base && nr.base[0]) || 0;
    var _lv196 = Math.max(1, g.level || 1);
    var _st196 = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) _st196 = x; });
    var _m196 = (_st196 && _st196.mul) || { tong: 1, nz: 1, yw: 1, zm: 1 };
    var _msum196 = (_m196.tong + _m196.nz + _m196.yw + _m196.zm) || 4;
    var _f196 = 4 / _msum196;
    var _up196 = _lv196 - 1;
    var filled = 0;
    if (baseFloor > 0) {
      var _ks = ['tong', 'yw', 'zm', 'nz'];
      for (var _ki = 0; _ki < _ks.length; _ki++) {
        var _d196 = _ks[_ki];
        var _t196 = Math.round(baseFloor * (_m196[_d196] || 1)
          + _up196 * (nr.grow || 1) * (_m196[_d196] || 1) * _f196);
        if ((g[_d196] || 0) < _t196) { g[_d196] = _t196; filled++; }
      }
    }"""
rep('js/state.js', 'A2 四维等级重演', A2_OLD, A2_NEW, 'var _t196 = Math.round(baseFloor * (_m196[_d196] || 1)')

# ---------------- A3 state.js：自由点差补 + 奖励段 + extra ----------------
A3_OLD = """    var freeLump = (DATA.RANKUP_FREE_PTS || {})[item.to] || 0;
    if (freeLump > 0) g.freePts = (g.freePts || 0) + freeLump;"""
A3_NEW = """    var freeLump = (DATA.RANKUP_FREE_PTS || {})[item.to] || 0;
    if (freeLump > 0) g.freePts = (g.freePts || 0) + freeLump;
    /* v89.196（老板 1-1 后半）：**自由属性点的等级差补** —— "按相应高资质补全
       **等级相关**的……自由属性点"：历史每级按旧资质的成长值发放（applyLevelGrowth /
       rankOf 懒补），升档后按新资质补差额：
         Δ = (等级−1) × (新成长 − 旧成长)（只补正差；升档只升，负差不存在）。 */
    var _pt196 = Math.max(0, (Math.max(1, g.level || 1) - 1) * ((nr.grow || 1) - (cur.grow || 1)));
    if (_pt196 > 0) g.freePts = (g.freePts || 0) + _pt196;
    /* v89.196（老板 1-2）：「作为提升资质的奖励，额外再给予一定的属性数值奖励」——
       数值见 DATA.RANKUP_AWARD（按目标档：良 100 / 英 200 / 名 400 / 天 800）。
       发放：四维各 +N + 体力上限 +N（staAdd）；速度不参与（表注有理由）。 */
    var _aw196 = ((DATA.RANKUP_AWARD || {})[item.to]) || 0;
    if (_aw196 > 0) {
      g.tong = (g.tong || 0) + _aw196;
      g.yw = (g.yw || 0) + _aw196;
      g.zm = (g.zm || 0) + _aw196;
      g.nz = (g.nz || 0) + _aw196;
      g.staAdd = (g.staAdd || 0) + _aw196;
    }"""
rep('js/state.js', 'A3 等级差补+奖励', A3_OLD, A3_NEW, '_pt196 = Math.max(0, (Math.max(1, g.level || 1) - 1)')

A4_OLD = """    if (filled > 0) extra.push('四维补足至「' + (nr.name || item.to) + '」基准 ' + baseFloor);
    if (asc78 > 0) extra.push('四维 +' + asc78 + '（灵草淬炼）');
    if (freeLump > 0) extra.push('自由属性点 +' + freeLump);"""
A4_NEW = """    if (filled > 0) extra.push('四维补足至「' + (nr.name || item.to) + '」Lv' + _lv196 + ' 标准');
    if (asc78 > 0) extra.push('四维 +' + asc78 + '（灵草淬炼）');
    if (_pt196 > 0) extra.push('自由属性点 +' + _pt196 + '（等级差补）');
    if (freeLump > 0) extra.push('自由属性点 +' + freeLump);
    if (_aw196 > 0) extra.push('资质奖励：四维各 +' + _aw196 + ' · 体力上限 +' + _aw196);"""
rep('js/state.js', 'A4 extra 文案', A4_OLD, A4_NEW, "'」Lv' + _lv196 + ' 标准'")

print('批次A 完成')
