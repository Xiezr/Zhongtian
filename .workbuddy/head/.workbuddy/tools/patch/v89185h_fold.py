# -*- coding: utf-8 -*-
"""v89.185 · 守将折损旋钮：DATA.GUARD_FOLD（wild/fort 折半；npcCityGuard 不折保持既有平衡）。"""
import io

def rep(s, tag, old, new, n=1):
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    return s.replace(old, new, 1)

# ---------- data.js ----------
P = 'js/data.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s
s = rep(s, 'D1',
"  DATA.WILD_DECAY = { perDay: 2, heldPerDay: 1 };",
"""  DATA.WILD_DECAY = { perDay: 2, heldPerDay: 1 };
  /* v89.185（老板 2 · 平衡旋钮）：**野外守将折损** —— 等级/资质"真转战力"的折扣。
     来由（probe_v89185d/e 实测）：makeGeneral 生成的野地/据点守将此前的四维不随等级、
     体力停在 100 —— "等级"只是标签（半残将，有将仅 +12%~31% 压力）。本轮把等级转成
     真战力后（guardFillOf），守军战力跃升过猛：无折时据点 Lv10 一场不可胜（守胜）、
     野地 Lv10 我损 ×2.36。fold 扫描定档**半折**：
       · dim   = 0.5：四维成长折半（守将 ≈ "半个等级"的将）；
       · staPct= 0.5：体力增量折半（基础 100 不动）。
     实测（我方 1.5×守军 · 英杰 Lv60 满状态）：野地 Lv10 ×1.65（0.5 折）/ 据点 Lv10
     从"守胜"回到"我胜（损 33%）"。**名城守将（npcCityGuard）不折** —— 它一直是满量
     口径（v89.73 起），保持既有平衡；本旋钮只服务"野外（野地/据点）"两处新形态。
     调平衡只改本表（守将生成处全读它）。 */
  DATA.GUARD_FOLD = { dim: 0.5, staPct: 0.5 };""")
assert s != orig
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('data OK')

# ---------- domain.js ----------
P2 = 'js/domain.js'
s = io.open(P2, 'r', encoding='utf-8', newline='').read()
orig = s
# guardFillOf：加 fold 参数
s = rep(s, 'D2',
"""  GAME.guardFillOf = function (g) {
    if (!g) return g;
    var rk = GAME.rankOf(g);
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st = x; });
    if (!st) st = (DATA.GEN_STYLES || [])[0] || { mul: { tong: 1, nz: 1, yw: 1, zm: 1 } };
    var m = st.mul;
    var mSum = (m.tong + m.nz + m.yw + m.zm) || 4;
    var f = 5 / mSum;
    var dims = ['tong', 'yw', 'zm', 'nz'], up = Math.max(0, (g.level || 1) - 1);
    dims.forEach(function (d) {
      g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f);
    });
    g.freePts = 0;
    if (GAME.setStaNow && GAME.staMax) GAME.setStaNow(g, GAME.staMax(g));
    return g;
  };""",
"""  GAME.guardFillOf = function (g, fold) {
    if (!g) return g;
    var rk = GAME.rankOf(g);
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st = x; });
    if (!st) st = (DATA.GEN_STYLES || [])[0] || { mul: { tong: 1, nz: 1, yw: 1, zm: 1 } };
    var m = st.mul;
    var mSum = (m.tong + m.nz + m.yw + m.zm) || 4;
    var f = 5 / mSum;
    /* v89.185：折损旋钮（传 fold 才生效；不传 = 满量，与原实现逐点等价）——
       wild/fort 传 DATA.GUARD_FOLD（半折）；npcCityGuard 不传（名城维持既有平衡）。 */
    var dimK = fold ? Math.max(0, Math.min(1, fold.dim == null ? 1 : fold.dim)) : 1;
    var staK = fold ? Math.max(0, Math.min(1, fold.staPct == null ? 1 : fold.staPct)) : 1;
    var dims = ['tong', 'yw', 'zm', 'nz'], up = Math.max(0, (g.level || 1) - 1);
    dims.forEach(function (d) {
      g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f * dimK);
    });
    g.freePts = 0;
    if (GAME.setStaNow && GAME.staMax) {
      var mx = GAME.staMax(g);
      GAME.setStaNow(g, Math.round(100 + (mx - 100) * staK));
    }
    return g;
  };""")
# wildDefenseAt：传折损
s = rep(s, 'D3',
"      GAME.guardFillOf(g);",
"      GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：野外守将折损（半折，见 DATA.GUARD_FOLD） */")
assert s != orig
io.open(P2, 'w', encoding='utf-8', newline='').write(s)
print('domain OK')

# ---------- map.js ----------
P3 = 'js/map.js'
s = io.open(P3, 'r', encoding='utf-8', newline='').read()
orig = s
s = rep(s, 'M1',
"    GAME.guardFillOf(g);   /* v89.185：等级/资质真转战力（四维按等级 + 满体力） */",
"    GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：等级/资质真转战力（野外守将折损半折） */")
assert s != orig
io.open(P3, 'w', encoding='utf-8', newline='').write(s)
print('map OK')

# ---------- state.js（npcCityGuard 注释收敛）----------
P4 = 'js/state.js'
s = io.open(P4, 'r', encoding='utf-8', newline='').read()
orig = s
s = rep(s, 'S1',
"""    /* v89.185（老板 2）：四维/体力统一走 **GAME.guardFillOf**（守将成型唯一出口）——
       与野地 / 据点守将同一把尺（此前本函数手写同款公式、另两处却走 makeGeneral 的
       "纯 base 区间"口径 → 双口径；guardFillOf 与本公式逐点等价：
       base[1]×特性权重 + (等级−1)×成长×特性权重×(5/Σ权重) —— v89.73 的推导见其头注）。 */
    GAME.guardFillOf(g);""",
"""    /* v89.185（老板 2）：四维/体力统一走 **GAME.guardFillOf**（守将成型唯一出口）——
       与野地 / 据点守将同一把尺（此前本函数手写同款公式、另两处却走 makeGeneral 的
       "纯 base 区间"口径 → 双口径；guardFillOf 与本公式逐点等价：
       base[1]×特性权重 + (等级−1)×成长×特性权重×(5/Σ权重) —— v89.73 的推导见其头注）。
       ⚠️ 不传 fold：名城守将维持既有满量口径（v89.73 起）；折损只服务野外（DATA.GUARD_FOLD）。 */
    GAME.guardFillOf(g);""")
assert s != orig
io.open(P4, 'w', encoding='utf-8', newline='').write(s)
print('state OK')
