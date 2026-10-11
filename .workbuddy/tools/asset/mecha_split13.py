# -*- coding: utf-8 -*-
"""机甲部件切分 · 第三步：13 部位（小腿/脚掌在脚踝处再切）+ 命名对照图"""
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

# 连通域
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
base = Image.fromarray(rgba, "RGBA")
A = np.asarray(base).copy()

def cut(box, mask, drop_top=0, drop_bot=0, cut_y=None):
    x0, y0, x1, y1 = box
    if cut_y is not None:
        if drop_top: y0 = max(y0, cut_y)
        if drop_bot: y1 = min(y1, cut_y - 1)
    piece = A[y0:y1 + 1, x0:x1 + 1].copy()
    piece[~mask[y0:y1 + 1, x0:x1 + 1]] = [0, 0, 0, 0]
    return Image.fromarray(piece, "RGBA")

# 脚踝切分线：在 shin+foot 块里找 [1285,1320] 内最窄行（脖子/踝）
def ankle_y(cid):
    m = (lab == cid)
    best, by = 10 ** 9, 1300
    for y in range(1285, 1321):
        xs = np.where(m[y])[0]
        if len(xs):
            wdt = xs.max() - xs.min()
            if wdt < best: best, by = wdt, y
    return by

m09 = (lab == comps[9]["id"]); m10 = (lab == comps[10]["id"])
ay9 = ankle_y(comps[9]["id"]); ay10 = ankle_y(comps[10]["id"])
print("ankle y: left=%d right=%d" % (ay9, ay10))

# 命名（按 x 列 + y 行判定）
named = {}
def put(name, img):
    img.save(os.path.join(OUT, name + ".png")); named[name] = img

put("head",     cut(comps[0]["bbox"], lab == comps[0]["id"]))
put("arm_ur",   cut(comps[1]["bbox"], lab == comps[1]["id"]))   # 右上臂
put("arm_ul",   cut(comps[2]["bbox"], lab == comps[2]["id"]))   # 左上臂
put("chest",    cut(comps[3]["bbox"], lab == comps[3]["id"]))
put("forearm_r",cut(comps[4]["bbox"], lab == comps[4]["id"]))   # 右前臂
put("waist",    cut(comps[5]["bbox"], lab == comps[5]["id"]))
put("forearm_l",cut(comps[6]["bbox"], lab == comps[6]["id"]))   # 左前臂
put("thigh_r",  cut(comps[7]["bbox"], lab == comps[7]["id"]))   # 右大腿
put("thigh_l",  cut(comps[8]["bbox"], lab == comps[8]["id"]))   # 左大腿
put("shin_l",   cut(comps[9]["bbox"], m09, drop_bot=True, cut_y=ay9))   # 左小腿
put("foot_l",   cut(comps[9]["bbox"], m09, drop_top=True, cut_y=ay9))   # 左脚掌
put("shin_r",   cut(comps[10]["bbox"], m10, drop_bot=True, cut_y=ay10)) # 右小腿
put("foot_r",   cut(comps[10]["bbox"], m10, drop_top=True, cut_y=ay10)) # 右脚掌

order = ["head", "chest", "waist", "arm_ul", "arm_ur", "forearm_l", "forearm_r",
         "thigh_l", "thigh_r", "shin_l", "shin_r", "foot_l", "foot_r"]
ZH = {"head": "头", "chest": "胸", "waist": "腰", "arm_ul": "左上臂", "arm_ur": "右上臂",
      "forearm_l": "左前臂", "forearm_r": "右前臂", "thigh_l": "左大腿", "thigh_r": "右大腿",
      "shin_l": "左小腿", "shin_r": "右小腿", "foot_l": "左脚掌", "foot_r": "右脚掌"}

Hh = 180
scaled = []
for n in order:
    t = named[n]
    scaled.append(t.resize((max(1, int(t.width * Hh / t.height)), Hh)))
gap = 12
tw = sum(t.width for t in scaled) + gap * (len(scaled) + 1)
sheet = Image.new("RGBA", (tw, Hh + 70), (32, 36, 44, 255))
d = ImageDraw.Draw(sheet)
xx = gap
for i, n in enumerate(order):
    t = scaled[i]
    sheet.alpha_composite(t, (xx, 46))
    d.text((xx + t.width // 2 - len(ZH[n]) * 4, 28), ZH[n], fill=(255, 220, 90))
    xx += t.width + gap
sheet.convert("RGB").save(os.path.join(OUT, "_montage13.png"))
print("saved _montage13.png ; parts:", len(named))
for n in order:
    print("  %-10s %s  %dx%d" % (n, ZH[n], named[n].width, named[n].height))
