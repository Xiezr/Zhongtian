# -*- coding: utf-8 -*-
"""修 gen_v89170_widgets.js：
   图1：① log 轴下限 100 → 35（旧曲线起点 40.5 不再越界）② 三段注移到右下空白区
        ③ 折角标注移到曲线上方 + 引线 ④ Lv100 标注移到点右下方（避免贴线）
   图2：① 删副标题（与刻度标签重叠）② x 轴口径改 Lv1~Lv200 线性映射
        ③ 底部说明并入"横轴/灰名"提示"""
import io

P = 'E:/Deepseekdb/.workbuddy/tools/tmp/gen_v89170_widgets.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

FIXES = []

# ① ay 公式（log 下限 35 → log10=1.544；上 6 → 跨度 4.456）
FIXES.append((
    "function ay(v) { return (240 - (Math.log10(v) - 2) / 4 * 204).toFixed(1); }",
    """/* log 轴下限 = log10(35)：旧曲线起点 40.5 也在面板内（改前下限 100 会让它越界） */
function ay(v) { return (240 - (Math.log10(v) - 1.544) / 4.456 * 204).toFixed(1); }"""))

# ② 面板 A 刻度线 y（按新映射重算）
FIXES.append((
    "[[240, '100'], [189, '1千'], [138, '1万'], [87, '10万'], [36, '100万']].forEach(function (g) {",
    "[[219, '100'], [173, '1千'], [128, '1万'], [82, '10万'], [36, '100万']].forEach(function (g) {"))

# ③ 三段注 → 右下空白区
FIXES.append((
    """s.push('<text x="76" y="52" font-size="11" fill="' + T2 + '">— 新曲线（现 · 单段幂律）：全程平滑、整体上抬</text>');
s.push('<text x="76" y="70" font-size="11" fill="' + T2 + '">— 旧曲线（改前 · 两段式）：前 30 级贴底 + 折角</text>');
s.push('<text x="76" y="88" font-size="11" fill="' + T3 + '">- - 线性参照（Lv1 实需 → Lv240 的 100 万 连成的直线）</text>');""",
    """/* 三段注放**右下空白区**（曲线在左上爬升后，右下全空；改前放左上会与曲线相交 238 处） */
s.push('<text x="280" y="188" font-size="11" fill="' + T2 + '">— 新曲线（现 · 单段幂律）：全程平滑、整体上抬</text>');
s.push('<text x="280" y="206" font-size="11" fill="' + T2 + '">— 旧曲线（改前 · 两段式）：前 30 级贴底 + 折角</text>');
s.push('<text x="280" y="224" font-size="11" fill="' + T3 + '">- - 线性参照（Lv1 实需 → Lv240 的 100 万 连成的直线）</text>');"""))

# ④ 折角标注 → 曲线上方（y-28）+ 引线
FIXES.append((
    """s.push('<circle cx="' + ax(30) + '" cy="' + ay(needOld(30)) + '" r="3" fill="' + G2 + '"/>');
s.push('<text x="' + (parseFloat(ax(30)) - 6) + '" y="' + (parseFloat(ay(needOld(30))) + 18) + '" font-size="11" text-anchor="middle" fill="' + G2 + '">旧：Lv30 折角</text>');""",
    """s.push('<circle cx="' + ax(30) + '" cy="' + ay(needOld(30)) + '" r="3" fill="' + G2 + '"/>');
/* 折角标注放折角点**上方**（旧曲线下方全是它自己爬升的轨迹，会相交） */
s.push('<line x1="' + ax(30) + '" y1="' + (parseFloat(ay(needOld(30))) - 8) + '" x2="' + ax(30) + '" y2="' + (parseFloat(ay(needOld(30))) - 24) + '" stroke="' + G2 + '" stroke-width="1" stroke-dasharray="2 2"/>');
s.push('<text x="' + ax(30) + '" y="' + (parseFloat(ay(needOld(30))) - 28) + '" font-size="11" text-anchor="middle" fill="' + G2 + '">旧：Lv30 折角</text>');"""))

# ⑤ 面板 B 的 Lv100 标注 → 点右下方（贴线太近）
FIXES.append((
    """s.push('<text x="' + (parseFloat(ax(100)) + 8) + '" y="' + (parseFloat(by(needNew(100))) - 8) + '" font-size="11" fill="' + G1 + '">Lv100：33.5 万（线性的 81%）</text>');""",
    """/* 标注放点**右下方**（放上方会与线性参照虚线贴身） */
s.push('<text x="' + (parseFloat(ax(100)) + 10) + '" y="' + (parseFloat(by(needNew(100))) + 16) + '" font-size="11" fill="' + G1 + '">Lv100：33.5 万（线性的 81%）</text>');"""))

# ⑥ 图2：lx 口径（Lv1@X0 ~ Lv200@X1）+ 刻度数组改
FIXES.append((
    """var X0 = 224, X1 = 620, LMAX = 200;
function lx(lv) { return (X0 + lv / LMAX * (X1 - X0)).toFixed(1); }
/* 轴刻度 */
[0, 50, 100, 150, 200].forEach(function (g) {
  s2.push('<line x1="' + lx(g) + '" y1="' + (TOP - 6) + '" x2="' + lx(g) + '" y2="' + (TOP + ITEMS.length * ROWH - 12) + '" stroke="' + GL + '" stroke-width="1"/>');
  s2.push('<text x="' + lx(g) + '" y="' + (TOP - 12) + '" font-size="11" text-anchor="middle" fill="' + T3 + '">' + (g === 0 ? 'Lv1' : 'Lv' + (g + 1)) + '</text>');
});""",
    """var X0 = 224, X1 = 620, LV0 = 1, LV1 = 200;
function lx(lv) { return (X0 + (lv - LV0) / (LV1 - LV0) * (X1 - X0)).toFixed(1); }
/* 轴刻度（Lv1 起 · 线性映射） */
[1, 50, 100, 150, 200].forEach(function (g) {
  s2.push('<line x1="' + lx(g) + '" y1="' + (TOP - 6) + '" x2="' + lx(g) + '" y2="' + (TOP + ITEMS.length * ROWH - 12) + '" stroke="' + GL + '" stroke-width="1"/>');
  s2.push('<text x="' + lx(g) + '" y="' + (TOP - 12) + '" font-size="11" text-anchor="middle" fill="' + T3 + '">Lv' + g + '</text>');
});"""))

# ⑦ 图2：删副标题（与刻度标签重叠）
FIXES.append((
    """s2.push('<text x="24" y="40" font-size="11" fill="' + T3 + '">横轴 = 升到的等级 · 标签 = 商城售价（内部价 ×100 金）· 灰字为已下架档</text>');
""",
    ""))

# ⑧ 图2：底部说明补口径
FIXES.append((
    """s2.push('<text x="24" y="' + (H - 12) + '" font-size="11" fill="' + T3 + '">兵仙遗篇（24 万金）：Lv1 → 86（旧 177）· 千古兵圣（40 万金）：Lv1 → 118（旧 196）</text>');""",
    """s2.push('<text x="24" y="' + (H - 12) + '" font-size="11" fill="' + T3 + '">横轴 = 升到的等级 · 名后灰字 = 已下架档 ｜ 兵仙遗篇（24 万金）：Lv1 → 86（旧 177）· 千古兵圣（40 万金）：Lv1 → 118（旧 196）</text>');"""))

for old, new in FIXES:
    assert s.count(old) == 1, '锚点计数=%d: %s' % (s.count(old), old[:60])
    s = s.replace(old, new)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('生成器修改完成（8 处）')
