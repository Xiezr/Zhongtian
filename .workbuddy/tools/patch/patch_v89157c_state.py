# -*- coding: utf-8 -*-
# v89.157 补丁 C：state.js —— 产量加成改"各自作用于基础产量再相加"（含黄金与分解口径）
import io
P = 'E:/Deepseekdb/js/state.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

# ---------- ① cityProdPerSec：主循环加法叠加 ----------
OLD1 = u"""    /* v79：「本城产量」加成 = 名城档位 + 爵位 + 主城 + 神器（唯一汇总口） */
    var perkProd = 1 + GAME.cityBonusNum(city, 'prodPct');
    var base = GAME.prodBasePerHourOf(city);
    for (var r2 in base) {
      var m = 1;
      GAME.prodFactors(r2, city, mpG).forEach(function (f) { m *= (1 + f.d); });
      out[r2] = base[r2] * m * perkProd / 3600 * ts;
    }
"""
NEW1 = u"""    /* v79：「本城产量」加成 = 名城档位 + 爵位 + 主城 + 神器（唯一汇总口）
       v89.157（老板 4）：「资源产量的各种加成，应分别对**基础产量**加成，叠加的话有点夸张了」——
       旧口径是**连乘**（(1+a)(1+b)…），高配下叠乘放大幅度失真；现在改为**加法叠加**：
         总倍率 = 1 + Σ各加成（科技/宝物/野地/天时/城主内政/开工率/专精） + 本城加成。
       分解口径（prodBreakdown）与之一字不差 —— 各项之和 = 总值，不许两把尺。 */
    var perkProd = GAME.cityBonusNum(city, 'prodPct');
    var base = GAME.prodBasePerHourOf(city);
    for (var r2 in base) {
      var mAdd = perkProd;
      GAME.prodFactors(r2, city, mpG).forEach(function (f) { mAdd += (f.d || 0); });
      out[r2] = base[r2] * Math.max(0, 1 + mAdd) / 3600 * ts;
    }
"""
if u'mAdd += (f.d || 0)' in s:
    done.append('1 skip')
else:
    assert s.count(OLD1) == 1, 'C1 count=' + str(s.count(OLD1))
    s = s.replace(OLD1, NEW1)
    done.append('1 OK')

# ---------- ② 黄金路径：同口径（宝物 + 天时 各自作用于基础税收） ----------
OLD2 = u"""    var gm = 1;
    var itemM2 = GAME.prodBuffMult();
    if (itemM2.gold) gm = 1 + itemM2.gold;
    if (GAME.story) gm *= GAME.story.prodMult('gold');
    out.gold += taxGold * gm / 3600 * ts;
"""
NEW2 = u"""    /* v89.157：黄金同口径（加法叠加）—— 宝物 / 天时各自作用于基础税收后相加 */
    var gm = 1 + (GAME.prodBuffMult().gold || 0);
    if (GAME.story) gm += (GAME.story.prodMult('gold') - 1);
    out.gold += taxGold * Math.max(0, gm) / 3600 * ts;
"""
if u'var gm = 1 + (GAME.prodBuffMult().gold || 0);' in s:
    done.append('2 skip')
else:
    assert s.count(OLD2) == 1, 'C2 count=' + str(s.count(OLD2))
    s = s.replace(OLD2, NEW2)
    done.append('2 OK')

# ---------- ③ 分解（黄金段）：天时贡献不再乘 (1+宝物) ----------
OLD3 = u"""        if (Math.abs(smg - 1) > 1e-9) rows.push({ name: '天时（季/天候/年号）' + (smg >= 1 ? '+' : '') + Math.round((smg - 1) * 100) + '%', val: baseG * (1 + (itemM.gold || 0)) * (smg - 1) / 3600 * ts });"""
NEW3 = u"""        if (Math.abs(smg - 1) > 1e-9) rows.push({ name: '天时（季/天候/年号）' + (smg >= 1 ? '+' : '') + Math.round((smg - 1) * 100) + '%', val: baseG * (smg - 1) / 3600 * ts });"""
if u"""val: baseG * (smg - 1) / 3600 * ts });""" in s:
    done.append('3 skip')
else:
    assert s.count(OLD3) == 1, 'C3 count=' + str(s.count(OLD3))
    s = s.replace(OLD3, NEW3)
    done.append('3 OK')

# ---------- ④ 分解（资源段）：先乘后加 → 各自作用于基础 ----------
OLD4 = u"""    var acc = base;
    GAME.prodFactors(r, city).forEach(function (f) {
      var contrib = acc * f.d;
      rows.push({ name: f.name + ' ' + (f.d >= 0 ? '+' : '') + Math.round(f.d * 1000) / 10 + '%', val: contrib });
      acc += contrib;
    });
"""
NEW4 = u"""    /* v89.157（老板 4）：加成**各自作用于基础产量再相加**（旧为连乘瀑布）——
       每项贡献 = 基础 × 本项增量；各项之和 = 总值（与 cityProdPerSec 同一把尺）。 */
    GAME.prodFactors(r, city).forEach(function (f) {
      rows.push({ name: f.name + ' ' + (f.d >= 0 ? '+' : '') + Math.round(f.d * 1000) / 10 + '%', val: base * f.d });
    });
"""
if u'val: base * f.d });' in s:
    done.append('4 skip')
else:
    assert s.count(OLD4) == 1, 'C4 count=' + str(s.count(OLD4))
    s = s.replace(OLD4, NEW4)
    done.append('4 OK')

# ---------- ⑤ 注释口径：瀑布 → 加法 ----------
OLD5 = u"""  /* 产量分解（/秒）：瀑布式求和，各项相加**正好等于**总产量。
     需求 11：悬停产量显示「基础 + 各类加成/扣除」。 */"""
NEW5 = u"""  /* 产量分解（/秒）：**加法分解**（v89.157 起每项 = 基础 × 本项增量），
     各项相加**正好等于**总产量。需求 11：悬停产量显示「基础 + 各类加成/扣除」。 */"""
if u'**加法分解**' in s:
    done.append('5 skip')
else:
    assert s.count(OLD5) == 1, 'C5 count=' + str(s.count(OLD5))
    s = s.replace(OLD5, NEW5)
    done.append('5 OK')
# 段内小注释（在 acc 之上，可能没被 ④ 覆盖到）
if u'/* 瀑布分解：每项贡献 = 之前累积乘数 × 本项增量 × 基数 */\n    /* v89.157' in s:
    s = s.replace(u'/* 瀑布分解：每项贡献 = 之前累积乘数 × 本项增量 × 基数 */\n    /* v89.157',
                  u'/* v89.157')
    done.append('5b OK')
elif u'/* 瀑布分解：每项贡献 = 之前累积乘数 × 本项增量 × 基数 */' in s:
    s = s.replace(u'    /* 瀑布分解：每项贡献 = 之前累积乘数 × 本项增量 × 基数 */\n', u'')
    done.append('5b OK(clean)')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert u'mAdd += (f.d || 0)' in chk and u'var m = 1;\n      GAME.prodFactors' not in chk
assert chk.count(u'var acc = base;') == 0 and chk.count(u'val: base * f.d });') == 1
assert chk.count(u'{') == s.count(u'{') and chk.count(u'}') == s.count(u'}')
print('patch C done:', done, 'len', orig, '->', len(s))
