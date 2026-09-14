# -*- coding: utf-8 -*-
"""建筑图标「系列配色」v3。
================================================================================
老板第三轮反馈（v45-c）：
  「民房、仓库之类的饱和度又太高了，就全变红了；军营、烽火台、校场还是偏灰色；
    好像饱和度高了，但本质颜色并没有变好。」

v45-b 的错在哪：那把**整幅图的所有像素置成同一个色相**（H_new = 常数）。
  · 图标里的木料、瓦片、夯土、石基本来色相各异，被抹平后整座建筑成了**单色块** ——
    这就是"本质颜色并没有变好"。
  · 为了让单色块够显眼，饱和度只能往上顶（gain 最高 3.2 倍）→ "饱和度又太高"。
  · 同色块压到暖区就成了发红的砖（仓库 340°），压到冷区又因为彩度不够像水泥（军营 210°）。

v3 的两条根本改动：
  ① **色相增量旋转**：H_new = H_orig + Δ（Δ = 目标均值 − 原均值）。
     保留图内各材质之间的**相对色相差**，木料/瓦片/石基重新分开 —— 质感回来。
  ② **饱和度只做微调**：gain 夹在 [0.85, 1.18]，上限 0.50。
     不再把低饱和素材硬拔到 0.55+，从根上治"饱和度太高"。
  ③ 明度仍按系列分档（官署最亮、仓廪最暗），系列区分改由「明度档 + 冷暖」承担，
     不再靠"把暖色强行染红"。
"""
import os
import sys
import numpy as np
from PIL import Image

UI = r'E:/Deepseekdb/assets/icons/ui'
BAK = os.path.join(UI, '_gold_backup')

SERIES = {
    'mil':   ['junying', 'xiaochang', 'fenghuotai'],
    'edu':   ['shuyuan', 'zhaoxianguan'],
    'road':  ['yizhan'],
    'biz':   ['shichang', 'tiejiangpu', 'gongjiangzuofang'],
    'store': ['cangku', 'majiu'],
    'live':  ['minfang', 'kezhan'],
    'gov':   ['guanfu', 'honglusi'],
}

# 系列 → (目标**平均色相**, 明度乘数, 明度偏移)
#   色相分配：暖族四个（朱红→土褐→金→麦黄）刻意挨得近 ——
#   民房/官署/仓廪本来就是木石夯土的同类色，硬拉开色相只会"变红变紫"。
#   它们的区分交给**明度档**（官署最亮 → 民房次之 → 工商中 → 仓廪最暗）+ 饱和度。
#   冷族三个（竹青/铁青/靛蓝）离得远，冷暖和明度一起构成"这是哪一行当"的第一眼线索。
TARGET = {
    'biz':   (12,  1.02, 0.00),   # 朱红偏赭（炉火、摊铺）—— 暖族里饱和度最高
    'store': (32,  0.94, -0.01),  # 深土褐（夯土仓廪）—— 暖族里最暗
    'gov':   (46,  1.14, 0.03),   # 暖金（金瓦朱柱）—— 暖族里最亮
    'live':  (74,  1.06, 0.02),   # 麦黄（新木新瓦民居）
    'edu':   (132, 1.16, 0.04),   # 竹青（青瓦竹简）—— 原本最暗，提得最多
    'mil':   (196, 1.06, 0.02),   # 铁青（甲胄、青砖）
    'road':  (250, 1.04, 0.02),   # 靛蓝（驿卒服色、靛染）
}

S_GAIN_MIN, S_GAIN_MAX = 0.85, 1.18
S_CAP = 0.50


def rgb2hsl(a):
    """a: (H,W,4) float。**必须先把 RGB 归一到 0~1**，否则 l 落在 0~255、
    `1-|2l-1|` 变负数，饱和度会算出 99.99% 这种假值（踩过）。"""
    rgb = a[:, :, :3] / 255.0
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = np.max(rgb, axis=2)
    mn = np.min(rgb, axis=2)
    d = mx - mn
    l = (mx + mn) / 2.0
    s = np.where(d < 1e-9, 0.0, d / np.maximum(1e-9, 1.0 - np.abs(2 * l - 1)))
    h = np.zeros_like(mx)
    nz = d > 1e-9
    rr, gg, bb = np.where(nz, r, 1), np.where(nz, g, 1), np.where(nz, b, 1)
    dd = np.where(nz, d, 1)
    hh = np.zeros_like(mx)
    m1 = nz & (mx == rr)
    m2 = nz & (mx == gg)
    m3 = nz & (mx == bb)
    hh[m1] = (((gg - bb) / dd) % 6)[m1]
    hh[m2] = ((bb - rr) / dd + 2)[m2]
    hh[m3] = ((rr - gg) / dd + 4)[m3]
    return hh * 60.0, np.clip(s, 0, 1), np.clip(l, 0, 1)


def hsl2rgb(h, s, l):
    h = (h % 360.0) / 60.0
    c = (1 - np.abs(2 * l - 1)) * s
    x = c * (1 - np.abs(h % 2 - 1))
    m = l - c / 2
    z = np.zeros_like(h)
    cond = h.astype(int) % 6
    r = np.select([cond == 0, cond == 1, cond == 2, cond == 3, cond == 4, cond == 5], [c, x, z, z, x, c])
    g = np.select([cond == 0, cond == 1, cond == 2, cond == 3, cond == 4, cond == 5], [x, c, c, x, z, z])
    b = np.select([cond == 0, cond == 1, cond == 2, cond == 3, cond == 4, cond == 5], [z, z, x, c, c, x])
    return (np.clip((r + m) * 255, 0, 255), np.clip((g + m) * 255, 0, 255), np.clip((b + m) * 255, 0, 255))


def mean_hue(h, s, mask):
    """向量平均（按饱和度加权）—— 直接算术平均会在 0°/360° 交界算错。"""
    hx = float((np.cos(h * np.pi / 180) * s)[mask].sum())
    hy = float((np.sin(h * np.pi / 180) * s)[mask].sum())
    v = np.degrees(np.arctan2(hy, hx))
    return float(v + 360 if v < 0 else v)


def recolor(path, tgt_h, lmul, ladd):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float64)
    alpha = a[:, :, 3]
    op = alpha > 40
    if op.sum() < 100:
        return None
    h, s, l = rgb2hsl(a)
    cur_h = mean_hue(h, s, op)
    cur_s = float(s[op].mean())
    """① 色相**增量**旋转：Δ 一致地加给每个像素 → 图内材质之间的相对色相差**原样保留**。"""
    delta = tgt_h - cur_h
    h2 = h + delta
    """② 饱和度只微调：不再"把整图拔到某个绝对饱和度"。"""
    gain = float(np.clip(1.0, S_GAIN_MIN, S_GAIN_MAX)) if cur_s <= 1e-6 else \
        float(np.clip((cur_s * 1.05) / cur_s, S_GAIN_MIN, S_GAIN_MAX))
    s2 = np.clip(s * gain, 0, S_CAP)
    """③ 明度按系列整体缩放，层次不动。"""
    l2 = np.clip(l * lmul + ladd, 0, 1)
    r, g, b = hsl2rgb(h2, s2, l2)
    out = np.dstack([r, g, b, alpha]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), cur_h, delta, cur_s, float(s2[op].mean()), float(l2[op].mean())


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'measure'
    os.makedirs(BAK, exist_ok=True)
    if mode == 'restore':
        import shutil
        n = 0
        for ids in SERIES.values():
            for bid in ids:
                bp = os.path.join(BAK, 'ai_%s.png' % bid)
                if os.path.exists(bp):
                    shutil.copy2(bp, os.path.join(UI, 'ai_%s.png' % bid))
                    n += 1
        print('已从 _gold_backup 还原 %d 张原图' % n)
        return
    print('%-16s %-6s %8s %9s %8s %8s' % ('建筑', '系列', '原色相', '色相增量', '新饱和', '新亮度'))
    print('-' * 62)
    for ser, ids in SERIES.items():
        tgt_h, lmul, ladd = TARGET[ser]
        for bid in ids:
            p = os.path.join(UI, 'ai_%s.png' % bid)
            if not os.path.exists(p):
                print('  %-14s 缺失' % bid); continue
            if mode == 'apply':
                bp = os.path.join(BAK, 'ai_%s.png' % bid)
                if not os.path.exists(bp):
                    import shutil
                    shutil.copy2(p, bp)
                r = recolor(p, tgt_h, lmul, ladd)
                if not r:
                    print('  %-14s 跳过（几乎全透明）' % bid); continue
                img, ch, dl, cs, ns, nl = r
                img.save(p, optimize=True)
                print('%-16s %-6s %7.1f° %+8.1f° %7.2f%% %7.2f%%' % (bid, ser, ch, dl, ns * 100, nl * 100))
            else:
                im = Image.open(p).convert('RGBA')
                a = np.asarray(im).astype(np.float64)
                op = a[:, :, 3] > 40
                h, s, l = rgb2hsl(a)
                print('%-16s %-6s %7.1f°  (目标 %.0f°)  饱和 %.1f%%  亮度 %.1f%%' %
                      (bid, ser, mean_hue(h, s, op), tgt_h, s[op].mean() * 100, l[op].mean() * 100))
    if mode == 'apply':
        print('\n原图备份在 assets/icons/ui/_gold_backup/')


if __name__ == '__main__':
    main()
