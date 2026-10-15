# -*- coding: utf-8 -*-
"""v89.195 批次B5：老档攻防补发（rankOf 两条路径）+ guardFillOf 攻防段加固
B5a state.js  rankOf 提前返回路径：攻防欠账按已过等级补发（排除守将）
B5b state.js  rankOf 反推路径：同款
B5c domain.js guardFillOf 攻防段改 if(fold) 无条件定值 + atkAcc/defAcc 置 0 标记"""
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

# ---------------- B5a：rankOf 提前返回路径 ----------------
B5A_OLD = """      var rkE = DATA.GEN_RANK_BY_ID[g.rank];
      if (g.freePts == null) {
        g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rkE.grow || 1);
      }
      return rkE;"""
B5A_NEW = """      var rkE = DATA.GEN_RANK_BY_ID[g.rank];
      if (g.freePts == null) {
        g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rkE.grow || 1);
      }
      /* v89.195（老板 3）：攻防"取整抹平"的历史欠账**按已过等级补发**（与 freePts 同法、
         同位置、两条路径都走）——只补不削；atkAcc 置 0 兼作"已处理"标记（幂等：新将
         Lv1 的补发值 = base 10，不动）。排除守将（g.npcGuard / g.wild：不升级、攻防由
         guardFillOf 按折损档定值 —— 此处若补会把折损顶穿）。 */
      if (g.atkAcc == null && !g.npcGuard && !g.wild) {
        g.atkAcc = 0;
        var _gb195r = DATA.GEN_BASE || { attack: 10, defense: 10 };
        var _std195r = Math.round((_gb195r.attack || 10) + Math.max(0, ((g.level || 1) - 1)) * 0.4 * (rkE.grow || 1));
        if ((g.attack || 0) < _std195r) g.attack = _std195r;
        if ((g.defense || 0) < _std195r) g.defense = _std195r;
      }
      return rkE;"""
rep('js/state.js', 'B5a rankOf-forward-backfill', B5A_OLD, B5A_NEW, 'if (g.atkAcc == null && !g.npcGuard && !g.wild) {')

# ---------------- B5b：rankOf 反推路径 ----------------
B5B_OLD = """    var sum = (g.tong || 0) + (g.yw || 0) + (g.zm || 0) + (g.nz || 0);
    var rk = g.hero ? GAME.heroRank(sum) : (function () {
      /* 客栈旧档：按四维均值反推最接近的资质 */
      var avg = sum / 4, best = DATA.GEN_RANKS[0];
      DATA.GEN_RANKS.forEach(function (r) {
        if (avg >= (r.base[0] + r.base[1]) / 2 - 4) best = r;
      });
      return best;
    })();
    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    /* v74（老板需求 5）：自由属性点字段的懒初始化（一次性）——
       旧档将领**按已过等级补发**：每级 = 该资质成长值（与 applyLevelGrowth 同口径）。
       标记方式就是字段本身（null = 还没初始化过；之后每升一级 += 成长值）。 */
    if (g.freePts == null) {
      g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rk.grow || 1);
    }
    return rk;"""
B5B_NEW = """    var sum = (g.tong || 0) + (g.yw || 0) + (g.zm || 0) + (g.nz || 0);
    var rk = g.hero ? GAME.heroRank(sum) : (function () {
      /* 客栈旧档：按四维均值反推最接近的资质 */
      var avg = sum / 4, best = DATA.GEN_RANKS[0];
      DATA.GEN_RANKS.forEach(function (r) {
        if (avg >= (r.base[0] + r.base[1]) / 2 - 4) best = r;
      });
      return best;
    })();
    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    /* v74（老板需求 5）：自由属性点字段的懒初始化（一次性）——
       旧档将领**按已过等级补发**：每级 = 该资质成长值（与 applyLevelGrowth 同口径）。
       标记方式就是字段本身（null = 还没初始化过；之后每升一级 += 成长值）。 */
    if (g.freePts == null) {
      g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rk.grow || 1);
    }
    /* v89.195（老板 3）：攻防欠账补发（与上方 freePts 同法；理由与排除面见提前返回路径注释）。 */
    if (g.atkAcc == null && !g.npcGuard && !g.wild) {
      g.atkAcc = 0;
      var _gb195q = DATA.GEN_BASE || { attack: 10, defense: 10 };
      var _std195q = Math.round((_gb195q.attack || 10) + Math.max(0, ((g.level || 1) - 1)) * 0.4 * (rk.grow || 1));
      if ((g.attack || 0) < _std195q) g.attack = _std195q;
      if ((g.defense || 0) < _std195q) g.defense = _std195q;
    }
    return rk;"""
rep('js/state.js', 'B5b rankOf-infer-backfill', B5B_OLD, B5B_NEW, 'if (g.atkAcc == null && !g.npcGuard && !g.wild) {\n      g.atkAcc = 0;\n      var _gb195q')

# ---------------- B5c：guardFillOf 攻防段加固 ----------------
B5C_OLD = """    var _atkK195 = fold ? Math.max(0, Math.min(1, fold.atkDim == null ? 0.25 : fold.atkDim)) : 0;
    if (_atkK195 > 0) {
      var _gb195g = DATA.GEN_BASE || { attack: 10, defense: 10 };
      g.attack = Math.round((_gb195g.attack || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
      g.defense = Math.round((_gb195g.defense || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
    }"""
B5C_NEW = """    var _atkK195 = fold ? Math.max(0, Math.min(1, fold.atkDim == null ? 0.25 : fold.atkDim)) : 0;
    if (fold) {
      var _gb195g = DATA.GEN_BASE || { attack: 10, defense: 10 };
      g.attack = Math.round((_gb195g.attack || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
      g.defense = Math.round((_gb195g.defense || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
      /* ⚠️ atkAcc/defAcc 置 0 兼作"已处理"标记：守将（野地/据点）**不走** rankOf 的
         玩家侧欠账补发 —— 否则后续任何 rankOf 调用都会把守将攻防顶到满量标准线
         （折损 atkDim 被顶穿：实测 47 → 158）。0 折（回退档）时本段仍赋 base 10。 */
      g.atkAcc = 0; g.defAcc = 0;
    }"""
rep('js/domain.js', 'B5c guardFill-mark', B5C_OLD, B5C_NEW, 'g.atkAcc = 0; g.defAcc = 0;\n    }')

print('批次B5 完成')
