# -*- coding: utf-8 -*-
"""机甲部件切分 · 第四步：在原图上叠 13 部位名称（供老板确认对应关系）"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from collections import deque
import os

SRC = r"E:/Deepseekdb/assets/icons/装备部件/部件.jpeg"
OUT = r"E:/Deepseekdb/.workbuddy/tmp/mecha_parts"
FONT = ImageFont.truetype(r"C:/Windows/Fonts/msyhbd.ttc", 34)

im = Image.open(SRC).convert("RGB"); W, H = im.size
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

# id -> 名称 + 标注锚点（用块中心）
LBL = {
    comps[0]["id"]: "head 头",
    comps[1]["id"]: "arm_ur 右上臂",
    comps[2]["id"]: "arm_ul 左上臂",
    comps[3]["id"]: "chest 胸",
    comps[4]["id"]: "forearm_r 右前臂",
    comps[5]["id"]: "waist 腰",
    comps[6]["id"]: "forearm_l 左前臂",
    comps[7]["id"]: "thigh_r 右大腿",
    comps[8]["id"]: "thigh_l 左大腿",
}
dbg = im.copy(); d = ImageDraw.Draw(dbg)
for c in comps:
    x0, y0, x1, y1 = c["bbox"]
    col = (255, 60, 60)
    d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline=col, width=3)
    if c["id"] in LBL:
        tx = x0; ty = max(0, y0 - 38)
        d.rectangle([tx - 2, ty - 2, tx + d.textlength(LBL[c["id"]], font=FONT) + 6, ty + 38], fill=(20, 22, 28))
        d.text((tx + 2, ty), LBL[c["id"]], fill=(255, 225, 120), font=FONT)
# 双肢块：小腿/脚掌在踝处画切分线并标名
def ankle_y(cid):
    m = (lab == cid); best, by = 10 ** 9, 1300
    for y in range(1285, 1321):
        xs = np.where(m[y])[0]
        if len(xs):
            w = xs.max() - xs.min()
            if w < best: best, by = w, y
    return by
for cid, side in ((comps[9]["id"], "左"), (comps[10]["id"], "右")):
    x0, y0, x1, y1 = [c for c in comps if c["id"] == cid][0]["bbox"]
    ay = ankle_y(cid)
    d.line([x0 - 6, ay, x1 + 6, ay], fill=(80, 200, 255), width=4)
    d.text((x1 + 8, (y0 + ay) // 2 - 18), side + "小腿", fill=(140, 220, 255), font=FONT)
    d.text((x1 + 8, (ay + y1) // 2 - 18), side + "脚掌", fill=(140, 220, 255), font=FONT)
dbg.save(os.path.join(OUT, "_named13.png"))
print("saved _named13.png")
