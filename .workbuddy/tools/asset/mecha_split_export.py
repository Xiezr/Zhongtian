# -*- coding: utf-8 -*-
"""机甲部件切分 · 第二步：把各连通域导出为透明 PNG + 拼对照图（供老板确认）"""
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
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
fg = ~((mn > 205) & ((mx - mn) < 22))

lab = np.zeros((H, W), np.int32); cur = 0; comps = []
for y in range(H):
    for x in range(W):
        if fg[y, x] and lab[y, x] == 0:
            cur += 1; q = deque([(y, x)]); lab[y, x] = cur
            ys = []; xs = []
            while q:
                cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur; q.append((ny, nx))
            comps.append({"id": cur, "bbox": (min(xs), min(ys), max(xs), max(ys)), "area": len(ys)})
comps = [c for c in comps if c["area"] > 120]
comps.sort(key=lambda c: (c["bbox"][1], c["bbox"][0]))

rgba = np.dstack([np.asarray(im), np.full((H, W), 255, np.uint8)])
outim = Image.fromarray(rgba, "RGBA")
a = np.asarray(outim).copy()

for i, c in enumerate(comps):
    m = (lab == c["id"])
    x0, y0, x1, y1 = c["bbox"]
    piece = a[y0:y1 + 1, x0:x1 + 1].copy()
    piece[~m[y0:y1 + 1, x0:x1 + 1]] = [0, 0, 0, 0]
    Image.fromarray(piece, "RGBA").save(os.path.join(OUT, "p%02d.png" % i))
    print("p%02d  box=(%d,%d,%d,%d)  %dx%d" % (i, x0, y0, x1, y1, x1 - x0, y1 - y0))

# 拼图：11 片并排（缩放到高 200）
tiles = [Image.open(os.path.join(OUT, "p%02d.png" % i)).convert("RGBA") for i in range(len(comps))]
scaled = [t.resize((max(1, int(t.width * 200 / t.height)), 200)) for t in tiles]
gap = 10; tw = sum(t.width for t in scaled) + gap * (len(scaled) + 1)
sheet = Image.new("RGBA", (tw, 200 + 60), (40, 44, 52, 255))
d = ImageDraw.Draw(sheet)
xx = gap
for i, t in enumerate(scaled):
    sheet.alpha_composite(t, (xx, 40))
    d.text((xx + t.width // 2 - 5, 12), str(i), fill=(255, 220, 80))
    xx += t.width + gap
sheet.convert("RGB").save(os.path.join(OUT, "_montage.png"))
print("saved _montage.png")
