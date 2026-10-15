# -*- coding: utf-8 -*-
"""废土调色 —— 给现有地图贴图统一上「废土·余烬纪元」色调（**只变色，不动几何**）。

为什么走调色而不是换图：
  现有 7 地形 + 4 城池贴图**几何已完美**（无缝 / 方向一致 / 分辨率够），
  唯一不符的是"亮绿亮蓝"的色调。换一张新图反而重新引入接缝/方向/清晰度问题；
  调色则在**保留全部几何**的前提下把色调拧到废土。

做法（像素级 HSV 重映射，写回 PNG）：
  ① 降饱和（sat）+ 压暗（val）
  ② 植被（绿相）→ 枯黄：色相往暖挪
  ③ 水（青蓝相）→ 浑浊：色相往灰青拉
  ④ 统一叠一层暖褐"尘"，去"鲜亮感"

铁律（沿用本项目素材纪律）：不用 CSS 滤镜，一律像素级重映射写进 PNG。

用法：
  python .workbuddy/tools/asset/grade_tiles.py --check      # 干跑（只报会改哪些）
  python .workbuddy/tools/asset/grade_tiles.py --apply      # 套用（写回 ui/，先快照）
  python .workbuddy/tools/asset/grade_tiles.py --apply --only terrain
"""
import os, sys, io, shutil, argparse
import numpy as np
from PIL import Image

BASE = r"E:/Deepseekdb"
UI = os.path.join(BASE, "assets", "icons", "ui")
BAK = os.path.join(BASE, ".workbuddy", "backup", "pre_grade")

TERRAIN = ["plain", "caoyuan", "zhaoze", "lake", "forest", "desert", "hill"]
CITY = ["capital", "zhou", "jun", "county"]
FORT = ["fort"]

# 调色参数（v2：**保留色相**——不把绿往暖挪、不叠尘，否则荒漠/草原撞色、森林糊掉）
SAT = 0.68      # 饱和倍率（降但不狠）
VAL = 0.96      # 明度倍率
CONTRAST = 1.10 # 对比倍率（提，保纹理清晰）
WARM = 5        # 整体色相微暖（度）


def grade(im):
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    alpha = a[..., 3]
    hsv = np.asarray(Image.fromarray(a[..., :3].astype("uint8")).convert("HSV")).astype(np.float32)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    S = np.clip(S * SAT, 0, 255)
    V = np.clip(V * VAL, 0, 255)
    H = np.clip(((H * (360 / 255.0) + WARM) % 360) * (255 / 360.0), 0, 255)   # 只整体微暖，不动个别相
    rgb = np.asarray(Image.fromarray(np.stack([H, S, V], -1).astype("uint8"), "HSV").convert("RGB")).astype(np.float32)
    rgb = np.clip((rgb - 128) * CONTRAST + 128, 0, 255)                        # 提对比，保细节
    return Image.fromarray(np.dstack([rgb, alpha]).astype("uint8"), "RGBA")


def targets(only):
    keys = []
    if only in (None, "terrain"):
        keys += [("ai_terrain_%s.png" % t, "terrain") for t in TERRAIN]
    if only in (None, "city"):
        keys += [("ai_city_%s.png" % c, "city") for c in CITY]
    if only in (None, "terrain"):
        keys += [("ai_%s.png" % f, "fort") for f in FORT]
    return keys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--only", choices=["terrain", "city"])
    a = ap.parse_args()
    files = targets(a.only)
    if a.apply:
        os.makedirs(BAK, exist_ok=True)
    n = 0
    for fn, grp in files:
        p = os.path.join(UI, fn)
        if not os.path.exists(p):
            print("  ⚠ 缺 " + fn); continue
        if a.apply:
            shutil.copy2(p, os.path.join(BAK, fn))       # 装前快照
            grade(Image.open(p)).save(p)
            print("  ✓ %s（%s）" % (fn, grp))
            n += 1
        else:
            print("  将调色 " + fn)
    print(("\n✅ 已调色 %d 张（快照在 %s）" % (n, BAK)) if a.apply
          else "\n（干跑）共 %d 张；加 --apply 执行" % len(files))


if __name__ == "__main__":
    main()
