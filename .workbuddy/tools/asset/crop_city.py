# -*- coding: utf-8 -*-
"""v89.43：城池贴图裁切流水线（与 crop_terrain.py 同一套铁律）。

背景：城池此前 100% 矢量绘制（drawCityArt 等距盒体）；老板拍板改为
「铺满菱形顶面、与地形同口径」的像素位图，矢量城退为素材缺席时的兜底。

设计要点：
  ① 游戏侧 blitArtRect 只取素材**中心 45%×41%** —— 裁切位置按条带对准建筑主体。
  ② 输出统一 256×256（与 ART_MAX 1:1）。
  ③ **零调色铁律**（同 crop_terrain.py v89.42b 起）：禁色相偏移与柔化，
     源图本色即上线色；确需对齐只允许 ±5% 明度微调（本批未使用）。
  ④ ⚠️ 水印禁区：B 图右下「即梦AI」水印 ≈ x≥1990 且 y≥1270 —— 四档窗口全部避开。

用法：
  python crop_city.py --check
  python crop_city.py --apply [--only county|jun|zhou|capital]
"""
import os, sys, argparse
import numpy as np
from PIL import Image

BASE = r"E:\Deepseekdb"
OUTDIR = os.path.join(BASE, "assets", "icons", "ui")
SRC = {
    "B": os.path.join(BASE, "assets", "icons",
                      "jimeng-2026-09-16-6873-@图片1 严格完全参考这张老三国策略游戏的复古像素等距斜45度画风，生成一套适配....png"),
}
# tier: (源图, 中心x, 中心y, 尺寸) —— 人眼终选（统计打分只做初筛）
#   capital 大石堡主楼 / zhou 石塔楼群 / jun 城墙塔楼＋宅院 / county 村舍小院
SPEC = {
    "county":  ("B", 2400, 1090, 256),
    "jun":     ("B", 1920, 1152, 256),
    "zhou":    ("B", 2048, 1024, 256),
    "capital": ("B", 2140, 1040, 256),
}


def band_stats(crop, size):
    a = np.asarray(crop).astype(np.float64)
    bw, bh = int(size * 0.45), int(size * 0.45 / 2)
    x0, y0 = (size - bw) // 2, (size - bh) // 2
    b = a[y0:y0 + bh, x0:x0 + bw]
    lum = b.mean(axis=2)
    return "#%02x%02x%02x" % tuple(int(v) for v in b.reshape(-1, 3).mean(axis=0)), lum.std()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    print("%-9s %-6s %-16s %-9s %6s %s" % ("tier", "源图", "裁切中心", "条带均色", "std", "动作"))
    for tier, (key, cx, cy, size) in SPEC.items():
        if args.only and tier != args.only:
            continue
        im = Image.open(SRC[key]).convert("RGB")
        W, H = im.size
        x0 = max(0, min(W - size, cx - size // 2))
        y0 = max(0, min(H - size, cy - size // 2))
        crop = im.crop((x0, y0, x0 + size, y0 + size))
        hexc, std = band_stats(crop, size)
        action = "-"
        if args.apply:
            dst = os.path.join(OUTDIR, "ai_city_%s.png" % tier)
            crop.save(dst)
            back = Image.open(dst)
            assert back.size == (size, size), "落盘回查失败 " + tier
            action = "写入 %d×%d" % back.size
        print("%-9s %-6s (%4d,%4d,%4d) %-9s %6.1f %s" % (tier, key, x0, y0, size, hexc, std, action))
    if not args.apply:
        print("\n（检查模式：未写盘。用 --apply 落位）")


if __name__ == "__main__":
    main()
