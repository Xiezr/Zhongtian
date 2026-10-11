# -*- coding: utf-8 -*-
"""装备散件图标 · 洪水法拆分（v90.52）—— 把部件图里的**各个部件**拆成独立透明 PNG。

口径（同 normalize_mecha 的边缘感知洪水，保证不侵蚀部件本体）：
  1) 去背：边缘感知洪水（只去与四边框相连的**近白且平坦**的像素，遇部件轮廓梯度即停）
  2) 连通域拆分：去背后的前景分连通块 → 每块裁切、缩放进方形透明画布
  3) 只输出面积 ≥ MIN_AREA 的块（滤碎屑）；**跳过最大的整机块**（成图里那台组装好的机甲）

用法：把部件图放 assets/icons/装备散件图标/，python tools/split_parts.py <outdir>
"""
import os, sys
import numpy as np
from PIL import Image
from collections import deque

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "assets", "icons", "装备散件图标")
EDGE = 38
MIN_AREA = 8000            # 源图 1536+ 下，部件连通块 ≥ 此面积（滤碎屑/线条）
SIDE = 256                 # 输出方形边长


def foreground(im):
    """边缘感知洪水去背后，各连通块的布爾掩码 list（按面积降序）。"""
    W, H = im.size
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    mn = a.min(2); mx = a.max(2)
    nw = (mn > 200) & ((mx - mn) < 40)
    grad = np.zeros((H, W), np.int16)
    grad[1:, :] = np.maximum(grad[1:, :], np.abs(a[1:] - a[:-1]).max(2))
    grad[:, 1:] = np.maximum(grad[:, 1:], np.abs(a[:, 1:] - a[:, :-1]).max(2))
    bg = np.zeros((H, W), bool); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if nw[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if nw[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < H and 0 <= nx < W and nw[ny, nx] and not bg[ny, nx] and grad[ny, nx] < EDGE:
                    bg[ny, nx] = True; q.append((ny, nx))
    fg = ~bg
    lab = np.zeros((H, W), np.int32); cur = 0; comps = []
    for y in range(H):
        for x in range(W):
            if fg[y, x] and lab[y, x] == 0:
                cur += 1; q = deque([(y, x)]); lab[y, x] = cur; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and lab[ny, nx] == 0:
                                lab[ny, nx] = cur; q.append((ny, nx))
                comps.append((n, cur))
    comps.sort(reverse=True)
    return lab, comps


def save_part(im, mask, out_png):
    ys, xs = np.where(mask)
    sub = np.asarray(im.convert("RGBA")).copy()[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
    sub[:, :, 3] = (mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255).astype(np.uint8)
    im2 = Image.fromarray(sub, "RGBA")
    w, h = im2.size
    k = (SIDE * 0.94) / max(w, h)
    im2 = im2.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    canvas.paste(im2, ((SIDE - im2.size[0]) // 2, (SIDE - im2.size[1]) // 2), im2)
    canvas.save(out_png)
    return (w, h, int(mask.sum()))


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, ".workbuddy", "tmp", "parts")
    os.makedirs(outdir, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith((".png", ".jpg", ".jpeg")): continue
        stem = os.path.splitext(f)[0].replace(" ", "_")
        im = Image.open(os.path.join(SRC, f)).convert("RGBA")
        lab, comps = foreground(im)
        # 跳过最大块（组装好的整机）；其余 ≥ MIN_AREA 的当作部件
        parts = [c for c in comps[1:] if c[0] >= MIN_AREA]
        for i, (area, cid) in enumerate(parts):
            wh = save_part(im, lab == cid, os.path.join(outdir, "%s_p%02d.png" % (stem, i)))
            print("%s_p%02d  area=%d  bbox=%dx%d" % (stem, i, area, wh[0], wh[1]))
            n += 1
    print("共拆出", n, "件 →", outdir)


if __name__ == "__main__":
    main()
