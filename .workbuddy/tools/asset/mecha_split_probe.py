# -*- coding: utf-8 -*-
"""机甲部件切分 · 第一步：去白底 + 连通域标注 + 出对照图（供老板确认）"""
import numpy as np
from PIL import Image, ImageDraw
from collections import deque
import os

SRC = r"E:/Deepseekdb/assets/icons/装备部件/部件.jpeg"
OUT = r"E:/Deepseekdb/.workbuddy/tmp/mecha_parts"
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGB")
W, H = im.size
arr = np.asarray(im).astype(np.int16)
print("size", W, H)

# 去白底：近白 = 背景（R,G,B 都高且彼此接近）
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
fg = ~((mn > 205) & ((mx - mn) < 22))   # 前景掩码
print("fg pixels", int(fg.sum()))

# 连通域（8 邻域 BFS）
lab = np.zeros((H, W), np.int32)
cur = 0
comps = []
for y in range(H):
    for x in range(W):
        if fg[y, x] and lab[y, x] == 0:
            cur += 1
            q = deque([(y, x)]); lab[y, x] = cur
            ys = []; xs = []
            while q:
                cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur; q.append((ny, nx))
            y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)
            comps.append({"id": cur, "bbox": (x0, y0, x1, y1), "area": len(ys)})

comps = [c for c in comps if c["area"] > 120]   # 去噪点
comps.sort(key=lambda c: (c["bbox"][1], c["bbox"][0]))
print("components (>120px):", len(comps))
for i, c in enumerate(comps):
    x0, y0, x1, y1 = c["bbox"]
    print("  #%2d  xy=(%3d,%3d) wh=(%3d,%3d) area=%d" % (i, x0, y0, x1 - x0, y1 - y0, c["area"]))

# 对照图：原图 + 编号框
dbg = im.copy(); d = ImageDraw.Draw(dbg)
for i, c in enumerate(comps):
    x0, y0, x1, y1 = c["bbox"]
    d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline=(255, 0, 0), width=2)
    d.text((x0 + 2, y0 + 2), str(i), fill=(0, 0, 255))
dbg.save(os.path.join(OUT, "_labeled.png"))
print("saved", os.path.join(OUT, "_labeled.png"))
