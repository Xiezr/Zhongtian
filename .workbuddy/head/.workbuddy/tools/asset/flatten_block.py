# -*- coding: utf-8 -*-
"""形态校正：把 isometric 立体块的**顶面菱形**反投影成正方形材质（256×256），
供地图贴图使用（引擎再按菱形裁剪铺格）。

用途：手上有"立在白底上的等距 3D 地块/城池方块"素材（顶面是斜 45° 菱形），
想直接当地形贴图用 —— 但游戏要的是**平铺菱形图案**（俯视材质）。
做法：把顶面那个菱形，做一次四边形反投影（diamond→square），
把等距透视"拉平"回俯视材质。这就是"利用其贴图 + 形态调整适配"。

原理：等距投影把正方形压成 2:1 菱形。反投影 = 把菱形四点映射回方形四角。
  顶面菱形 N(顶)/E(右)/S(下)/W(左) → 输出正方形 上左/上右/下右/下左
  对应：N→TL, E→TR, S→BR, W→BL

用法：
  python .workbuddy/tools/asset/flatten_block.py <图集.png> <out1,out2,out3,out4> [输出目录]
  省略输出目录 = .workbuddy/tmp/flat/
"""
import os, sys, argparse
import numpy as np
from PIL import Image

BASE = r"E:/Deepseekdb"
DEF_OUT = os.path.join(BASE, ".workbuddy", "tmp", "flat")


def top_face_src(cell):
    """量出顶面菱形四角，返回 QUAD 源序 (N, W, S, E) 的扁元组 (x,y,x,y,x,y,x,y)。
    QUAD 源序对应目标四角 (TL, BL, BR, TR)：N→TL, W→BL, S→BR, E→TR。"""
    a = np.asarray(cell.convert("RGBA"))
    rgb = a[..., :3].astype(int)
    al = a[..., 3]
    nw = (rgb.sum(axis=2) < 720) & (al > 50)          # 非白内容
    ys, xs = np.nonzero(nw)
    ytop, ybot = int(ys.min()), int(ys.max())
    widths = []
    for y in range(ytop, ybot + 1):
        r = np.nonzero(nw[y])[0]
        widths.append(int(r.max() - r.min()) if len(r) else -1)
    yc = ytop + int(np.argmax(widths))                 # 最宽行 = 东西角
    r = np.nonzero(nw[yc])[0]
    xL, xR = int(r.min()), int(r.max())
    xc = (xL + xR) / 2.0
    yS = yc + (yc - ytop)                              # 南角（顶面，对称于北角）
    return (xc, ytop, xL, yc, xc, yS, xR, yc)          # N, W, S, E


def flatten(cell, size=256):
    """顶面菱形 → 正方形材质。"""
    src = top_face_src(cell)
    return cell.convert("RGBA").transform((size, size), Image.QUAD, src, Image.BICUBIC)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("atlas")
    ap.add_argument("ids")
    ap.add_argument("out", nargs="?")
    a = ap.parse_args()
    ids = [s.strip() for s in a.ids.split(",") if s.strip()]
    out = a.out or DEF_OUT
    os.makedirs(out, exist_ok=True)
    im = Image.open(a.atlas).convert("RGBA")
    hw, hh = im.size[0] // 2, im.size[1] // 2
    quads = [(0, 0), (0, 1), (1, 0), (1, 1)]
    for i, id_ in enumerate(ids[:4]):
        qy, qx = quads[i]
        cell = im.crop((qx * hw, qy * hh, (qx + 1) * hw, (qy + 1) * hh))
        flat = flatten(cell)
        p = os.path.join(out, id_ + ".png")
        flat.save(p)
        print("  %s → %s  (256×256)" % (id_, p))
    print("完成 %d 张" % min(len(ids), 4))


if __name__ == "__main__":
    main()
