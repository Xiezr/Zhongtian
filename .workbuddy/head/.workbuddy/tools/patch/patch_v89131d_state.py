# -*- coding: utf-8 -*-
"""v89.131 补丁 D：state.js —— 回复口径改「现实时间百分比（24h 满）」
两处：① 在线 tickOnce（2400 段）② 离线 simulateBulk（1770 段）
并顺手把 loadGame 的 g.energy==null 兜底改到新口径（现算满值）。
用法：python patch_v89131d_state.py
"""
import io

P = 'E:/Deepseekdb/js/state.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    c = s.count(old)
    assert c == 1, '[%s] 锚点 %d 处（需 1）' % (tag, c)
    s = s.replace(old, new)
    n += 1
    print('  OK ' + tag)


# ---------- ① 离线补算（simulateBulk） ----------
rep("""        /* v29（需求 11）：体力上限不再是写死的 100，而是 GAME.staMax(g)
           v66：`g.stamina` 存的是**等级那一份的余量**（装备体力常备不失），
           所以这里按 staBaseMax 封顶，别把余量灌进装备那份里去。 */
        var mx = GAME.staBaseMax(g);
        g.stamina = Math.min(mx, (g.stamina == null ? mx : g.stamina) + gc.staPerHour * hours);
        g.energy = Math.min(100, (g.energy == null ? 100 : g.energy) + gc.enePerHour * hours);""",
"""        /* v29（需求 11）：体力上限不再是写死的 100，而是 GAME.staMax(g)
           v66：`g.stamina` 存的是**等级那一份的余量**（装备体力常备不失），
           所以这里按 staBaseMax 封顶，别把余量灌进装备那份里去。
           v89.131（老板「体力精力应随现实时间百分比回复，按现实时间24h可恢复满值」）：
           口径改**现实时间百分比** —— 速率 = 池子上限 ÷(recoverHours×3600) /现实秒，
           离线用 secReal（真实秒）直接乘。体力按"可用池"（staBaseMax，
           装备那份是常备额度不参与消耗）→ 显示值从下限到上限恰 24h；
           精力按 energyMaxOf（六维公式）→ 从 0 到满恰 24h。
           ⚠️ 直接写 g.stamina/g.energy（**不走 staNow/setStaNow**）：
           那两个出口带 Math.round，读-改-写会把每 tick 的零头抹掉（永远涨不上去）。 */
        var mx = GAME.staBaseMax(g);
        g.stamina = Math.min(mx, (g.stamina == null ? mx : g.stamina) + mx * rateRec131 * secReal);
        var enMx131 = GAME.energyMaxOf(g);
        g.energy = Math.min(enMx131,
          (g.energy == null ? enMx131 : g.energy) + enMx131 * rateRec131 * secReal);""",
    '离线段')

rep("""      var gc = DATA.GEN_COST, lo = DATA.LOYALTY, hours = ts / 3600 * secReal;""",
"""      var gc = DATA.GEN_COST, lo = DATA.LOYALTY, hours = ts / 3600 * secReal;
      var rateRec131 = 1 / ((gc.recoverHours || 24) * 3600);   /* v89.131：满回复 24 现实小时 */""",
    '离线段·速率常量')

# ---------- ② 在线 tickOnce ----------
rep("""    var gameHours = ts / 3600;                      // 本 tick 折合的游戏小时
    var deserters = [];
    s.generals.forEach(function (g) {
      var staMx = GAME.staBaseMax(g);   /* v66：余量口径（装备体力常备不失） */
      g.stamina = Math.min(staMx, (g.stamina == null ? staMx : g.stamina) + gc.staPerHour * gameHours);
      g.energy = Math.min(100, (g.energy == null ? 100 : g.energy) + gc.enePerHour * gameHours);""",
"""    var gameHours = ts / 3600;                      // 本 tick 折合的游戏小时
    /* v89.131（老板「体力精力应随现实时间百分比回复，24h 回满」）：
       回复与倍速解耦 —— 每小时回"上限的 1/24"，1 现实秒 = 上限/86400。
       实现是**直接写字段**（不走 staNow/setStaNow —— 它们带 round，读改写会抹零头）。 */
    var rateRec131 = 1 / ((gc.recoverHours || 24) * 3600);
    var deserters = [];
    s.generals.forEach(function (g) {
      var staMx = GAME.staBaseMax(g);   /* v66：余量口径（装备体力常备不失） */
      g.stamina = Math.min(staMx, (g.stamina == null ? staMx : g.stamina) + staMx * rateRec131 * dtReal);
      var enMx131 = GAME.energyMaxOf(g);
      g.energy = Math.min(enMx131, (g.energy == null ? enMx131 : g.energy) + enMx131 * rateRec131 * dtReal);""",
    '在线段')

# ---------- ③ loadGame 兜底（老档无 energy → 按新口径给满值） ----------
rep("""        if (g.energy == null) g.energy = 100;""",
"""        /* v89.131：老档缺 energy → 给**新口径的满值**（六维公式算出，非写死 100） */
        if (g.energy == null) g.energy = GAME.energyMaxOf ? GAME.energyMaxOf(g) : 100;""",
    '老档兜底')

assert s != orig and n == 4
assert 'staPerHour' not in s and 'enePerHour' not in s, '旧字段残留'
assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch D(state) OK · %d 处（LF 保持）' % n)
