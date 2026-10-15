# -*- coding: utf-8 -*-
"""去白底（更干净：把抗锯齿灰边一并算背景）+ 机甲整体 / 披风左右分割导出。"""
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

def cut_white(src, out, th_min=200, th_spread=50, pad=2):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    bg = (mn > th_min) & ((mx - mn) < th_spread)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 收边：2px 腐蚀吃掉白晕/抗锯齿灰边，再轻微羽化避免硬锯齿
    al = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(5))
    al = al.filter(ImageFilter.GaussianBlur(0.6))
    rgba = np.dstack([np.asarray(im), np.asarray(al)])
    img = Image.fromarray(rgba, "RGBA")
    ys, xs = np.where(np.asarray(al) > 0)
    if len(xs):
        img = img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad),
                        xs.max() + 1 + pad, ys.max() + 1 + pad))
    img.save(out)
    return img.size

print("mecha", cut_white(r"E:/Deepseekdb/assets/icons/装备部件/部件.jpeg",
                         r"E:/Deepseekdb/assets/icons/ui/mecha.png"))

# ---- 披风：左右各半，连通域分两组（按 x）----
im = Image.open(r"E:/Deepseekdb/assets/icons/装备部件/披风.png").convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.int16)
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
mn = np.minimum(np.minimum(r, g), b); mx = np.maximum(np.maximum(r, g), b)
bg = (mn > 178) & ((mx - mn) < 42)
fg = ~bg
lab = np.zeros((H, W), np.int32); cur = 0; comps = []
for y in range(H):
    for x in range(W):
        if fg[y, x] and lab[y, x] == 0:
            cur += 1; q = deque([(y, x)]); lab[y, x] = cur; ys = []; xs = []
            while q:
                cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur; q.append((ny, nx))
            comps.append({"id": cur, "bbox": (min(xs), min(ys), max(xs), max(ys)), "area": len(ys)})
comps = [c for c in comps if c["area"] > 200]
comps.sort(key=lambda c: c["bbox"][0])   # 按 x：左半 / 右半
full = np.dstack([np.asarray(im), np.where(bg, 0, 255).astype(np.uint8)])
base = Image.fromarray(full, "RGBA")
A = np.asarray(base).copy()
# 合并同一半的多连通块（一个半可能碎成几块）
mid = W / 2
halves = {"L": [], "R": []}
for c in comps:
    x0, y0, x1, y1 = c["bbox"]
    halves["L" if (x0 + x1) / 2 < mid else "R"].append(c)
for side, cs in halves.items():
    if not cs: print("cape", side, "EMPTY"); continue
    x0 = min(c["bbox"][0] for c in cs); y0 = min(c["bbox"][1] for c in cs)
    x1 = max(c["bbox"][2] for c in cs); y1 = max(c["bbox"][3] for c in cs)
    m = np.zeros((H, W), bool)
    for c in cs: m |= (lab == c["id"])
    piece = A[y0:y1 + 1, x0:x1 + 1].copy()
    piece[~m[y0:y1 + 1, x0:x1 + 1]] = [0, 0, 0, 0]
    im2 = Image.fromarray(piece, "RGBA")
    al = np.asarray(im2.split()[3]); al = np.asarray(Image.fromarray(al, "L").filter(ImageFilter.MinFilter(3)))
    im2.putalpha(Image.fromarray(al, "L"))
    ys, xs = np.where(np.asarray(al) > 0)
    im2 = im2.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    im2.save(r"E:/Deepseekdb/assets/icons/ui/cape_" + side + ".png")
    print("cape", side, im2.size)
