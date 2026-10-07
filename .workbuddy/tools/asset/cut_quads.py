# -*- coding: utf-8 -*-
"""四格图 → 地形/城池贴图（**整块压缩法**）。

老板定的裁切口径（v89.226）：
  **取原图的完整对象，整块压缩进 256 —— 不要抠小块。**
  抠小块 → 上地图"树不是树、草不是草"；整块压缩 → 保住完整特征，一眼可辨。

做法：2×2 图的每一格 → 找物体外接框（去白底）→ 整块等比缩放到 256 居中（留 4% 边）。
输出 256×256 PNG，直接可用（引擎按中心 45% 采样铺菱形）。

用法：
  python .workbuddy/tools/asset/cut_quads.py              # 按内置映射切（raw 的 1~4.png）
  python .workbuddy/tools/asset/cut_quads.py --check
"""
import os, sys, argparse
import numpy as np
from PIL import Image

BASE = r"E:/Deepseekdb"
RAW = os.path.join(BASE, "assets", "icons", "raw")
UI = os.path.join(BASE, "assets", "icons", "ui")
SIZE, PAD = 256, 0.04

# 内置映射：raw 文件名 → 四格(0=TL,1=TR,2=BL,3=BR) → 目标
# 老板重命名后：1=水/沙/草/沼 · 2=松林/沙丘/山岩/木寨 · 3=草丛 · 4=城池
MAP = {
    "1": [("terrain", "lake", 0), ("terrain", "desert", 1), ("terrain", "plain", 2), ("terrain", "zhaoze", 3)],
    "2": [("terrain", "forest", 0), ("terrain", None, 1), ("terrain", "hill", 2), ("fort", "fort", 3)],
    "3": [("terrain", "caoyuan", 0), ("terrain", None, 1), ("terrain", None, 2), ("terrain", None, 3)],
    "4": [("city", "county", 0), ("city", "jun", 1), ("city", "zhou", 2), ("city", "capital", 3)],
}


def quad(im, idx):
    hw, hh = im.size[0] // 2, im.size[1] // 2
    qy, qx = [(0, 0), (0, 1), (1, 0), (1, 1)][idx]
    return im.crop((qx * hw, qy * hh, (qx + 1) * hw, (qy + 1) * hh))


def build(q, size=SIZE):
    """四格之一 → 256 贴图（**软抠底、全量保留**）：
      按"距纯白的曼哈顿距离"做软 alpha（近白渐透明），其余全保留，仅缩放到 256。
      不用硬阈值（会留抗锯齿白边），也不用裁剪/重构。
    引擎侧配合把采样范围改成 100%（map.js blitArtRect 的 USE），整张素材铺进菱形。"""
    a = np.asarray(q.convert("RGB")).astype(float)
    d = np.abs(255.0 - a).sum(2)                       # 纯白=0，越大越有色
    T, SOFT = 100, 60                                  # 软抠底阈值（去白边、不伤浅色主体）
    alpha = np.clip((d - T) / SOFT, 0, 1)
    rgba = q.convert("RGBA")
    rgba.putalpha(Image.fromarray((alpha * 255).astype("uint8"), "L"))
    return rgba.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    n = 0
    for fn, entries in MAP.items():
        p = os.path.join(RAW, fn + ".png")
        if not os.path.exists(p):
            print("  ⚠ 缺 raw/%s.png" % fn); continue
        im = Image.open(p).convert("RGB")
        for grp, name, idx in entries:
            if name is None:
                continue
            out = build(quad(im, idx))
            dst = os.path.join(UI, "ai_%s.png" % name if grp == "fort" else "ai_%s_%s.png" % (grp, name))
            if not a.check:
                out.save(dst)
            print("  %s ← raw/%s.png[%d]  (%s)" % (os.path.basename(dst), fn, idx, grp))
            n += 1
    print(("\n（干跑）共 %d 张" % n) if a.check else ("\n✅ 已切 %d 张（整块压缩 256）" % n))


if __name__ == "__main__":
    main()
