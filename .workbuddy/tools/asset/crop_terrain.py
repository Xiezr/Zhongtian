# -*- coding: utf-8 -*-
"""v89.42：地形贴图裁切流水线（从即梦参考图裁切 → 归一化 → 落位 assets/icons/ui/）。

背景：野地七地形贴图（ai_terrain_*.png）由三张即梦像素风参考图裁切而来。
本脚本是**唯一可复跑入口** —— SPEC 表即"哪张图、哪个位置、怎么调色"的全部真相。

设计要点（为什么这么裁）：
  ① 游戏侧 blitArtRect 只取素材**中心 45%×41%** 铺到菱形外接框 ——
     所以真正上屏的是"中心条带"，裁切位置按条带纯净度选（见 _crop_scan2 的历史）。
  ② 输出统一 256×256：与 ART_MAX=256 的预缩放 1:1，链路只经一次重采样。
  ③ **零调色铁律（v89.42b 起）**：禁用色相偏移（h_shift）与柔化（soft）——
     上一版平地靠 h+47°/提亮36%/柔化38% 硬凑出"浅青绿"，结果和其余六张不是一个画风。
     现在源图本色即上线色；若确需对齐，只允许 ±5% 以内的明度微调。

用法：
  python crop_terrain.py --check            # 只统计（不写文件）
  python crop_terrain.py --apply            # 裁切并写入 assets/icons/ui/
  python crop_terrain.py --apply --only lake
"""
import os, sys, argparse
import numpy as np
from PIL import Image, ImageEnhance

BASE = r"E:\Deepseekdb"
OUTDIR = os.path.join(BASE, "assets", "icons", "ui")
SRC = {
    "A": os.path.join(BASE, "assets", "icons",
                      "jimeng-2026-09-16-5040-@图片1 100%复刻这张原版老三国策略游戏的斜等距像素地图质感，生成大尺寸可裁....png"),
    "B": os.path.join(BASE, "assets", "icons",
                      "jimeng-2026-09-16-6873-@图片1 严格完全参考这张老三国策略游戏的复古像素等距斜45度画风，生成一套适配....png"),
    "C": os.path.join(BASE, "assets", "icons",
                      "jimeng-2026-09-16-8846-@图片1 严格完全参考这张老三国策略游戏的复古像素等距斜45度画风，生成一套适配....png"),
}
# terrain: (源图, 中心x, 中心y, 尺寸, 后处理)
# 后处理键：h_shift（色相偏移°）/ s_mul（饱和倍率）/ v_mul（明度倍率）/ soft（向均色柔化 0~1）
# v89.42b 重做版（2026-09-19）：七张全部推翻重选 ——
#   · 只在 B / C 两张源图取材（A 偏亮偏淡：S=0.28/V=0.77，与 B/C 的 0.45/0.53 不同源，混用会有拼贴感）
#   · 后处理一律 None（零调色，见铁律③）
#   · 坐标 = 裁切窗口中心，均由 _remix_scan*.py 按"真实上屏采样带(115x56)"评分选出
SPEC = {
    "plain":   ("B",  320,  192, 256, None),
    "caoyuan": ("B", 1280,  512, 256, None),
    "forest":  ("C", 1376, 1088, 256, None),
    "zhaoze":  ("B",  660, 1120, 256, None),
    "lake":    ("B", 1856,  800, 256, None),
    "desert":  ("B",  128,  512, 256, None),
    "hill":    ("C", 1470,  600, 256, None),
}


def grade(im, h_shift=0.0, s_mul=1.0, v_mul=1.0, soft=1.0):
    hsv = np.array(im.convert("HSV")).astype(np.float32)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    H = (H + h_shift * 255.0 / 360.0) % 255
    S = np.clip(S * s_mul, 0, 255)
    V = np.clip(V * v_mul, 0, 255)
    res = Image.fromarray(np.stack([H, S, V], axis=-1).astype(np.uint8), mode="HSV").convert("RGB")
    res = ImageEnhance.Contrast(res).enhance(1.05)
    if soft < 1.0:
        b = np.asarray(res).astype(np.float32)
        m = b.reshape(-1, 3).mean(axis=0)
        res = Image.fromarray(np.clip(m + (b - m) * soft, 0, 255).astype(np.uint8))
    return res


def band_stats(crop, size):
    """真实上屏条带（中心 45%x41% 的进一步 2:1 采样带）统计"""
    a = np.asarray(crop).astype(np.float64)
    bw, bh = int(size * 0.45), int(size * 0.45 / 2)
    x0 = (size - bw) // 2
    y0 = (size - bh) // 2
    b = a[y0:y0 + bh, x0:x0 + bw]
    lum = b.mean(axis=2)
    return "#%02x%02x%02x" % tuple(int(v) for v in b.reshape(-1, 3).mean(axis=0)), lum.std()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="写盘（缺省只检查）")
    ap.add_argument("--check", action="store_true", help="显式检查模式（与缺省一致）")
    ap.add_argument("--only", default="", help="只处理指定地形")
    args = ap.parse_args()

    print("%-9s %-6s %-16s %-9s %6s %s" % ("terrain", "源图", "裁切中心", "条带均色", "std", "动作"))
    for terr, (key, cx, cy, size, grad) in SPEC.items():
        if args.only and terr != args.only:
            continue
        src = SRC[key]
        if not os.path.exists(src):
            print("%-9s 源图缺失：%s" % (terr, os.path.basename(src)[:40]))
            continue
        im = Image.open(src).convert("RGB")
        W, H = im.size
        x0 = max(0, min(W - size, cx - size // 2))
        y0 = max(0, min(H - size, cy - size // 2))
        crop = im.crop((x0, y0, x0 + size, y0 + size))
        if grad:
            crop = grade(crop, grad.get("h_shift", 0), grad.get("s_mul", 1.0),
                         grad.get("v_mul", 1.0), grad.get("soft", 1.0))
        hexc, std = band_stats(crop, size)
        action = "-"
        if args.apply:
            dst = os.path.join(OUTDIR, "ai_terrain_%s.png" % terr)
            crop.save(dst)
            back = Image.open(dst)
            assert back.size == (size, size), "落盘回查失败 " + terr
            action = "写入 %d×%d" % back.size
        print("%-9s %-6s (%4d,%4d,%4d) %-9s %6.1f %s" % (terr, key, x0, y0, size, hexc, std, action))
    if not args.apply:
        print("\n（检查模式：未写盘。用 --apply 落位）")


if __name__ == "__main__":
    main()
