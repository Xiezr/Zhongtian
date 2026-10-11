# -*- coding: utf-8 -*-
"""外挂模块图标标准化（v90.49）—— 供装备栏「外挂小框」的**固定模块图**用。

与 tools/normalize_mecha.py 同一套去背口径（边缘感知洪水填 + 只留主体），
输出**方形透明小图**（256×256，`object-fit: contain` 适配方框）。

类型固定（每类一张，不随装备变）：
  披风.png          → mod_cloak.png    （左右两片合成为一张对称披风）
  上，武器1.jpeg     → mod_weapon.png   （取一杆枪）
  机动模块1.jpeg     → mod_mobility.png
  辐射清除模块.jpeg  → mod_purge.png
输出：assets/icons/mecha_mod/*.png
"""
import os
import numpy as np
from PIL import Image
from collections import deque

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "assets", "icons", "装备部件", "散件图标")
OUT = os.path.join(BASE, "assets", "icons", "mecha_mod")
SIDE = 256


def fg_label(im):
    """去背 + 连通块标注：边缘感知洪水只去与四边框相连的近白（同 normalize_mecha 口径）。
       返回 (lab, comps)，comps 按面积降序 [(area, id)]。"""
    W, H = im.size
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    mn = a.min(2); mx = a.max(2)
    nw = (mn > 200) & ((mx - mn) < 40)
    grad = np.zeros((H, W), np.int16)
    grad[1:, :] = np.maximum(grad[1:, :], np.abs(a[1:] - a[:-1]).max(2))
    grad[:, 1:] = np.maximum(grad[:, 1:], np.abs(a[:, 1:] - a[:, :-1]).max(2))
    EDGE = 38
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


def save_square(im, mask, name):
    """mask 前景裁切、等比缩放进 SIDE 方画布居中，存盘。"""
    ys, xs = np.where(mask)
    sub = np.asarray(im.convert("RGBA")).copy()[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
    sub[:, :, 3] = (mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255).astype(np.uint8)
    im2 = Image.fromarray(sub, "RGBA")
    w, h = im2.size
    k = (SIDE * 0.94) / max(w, h)
    im2 = im2.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    canvas.paste(im2, ((SIDE - im2.size[0]) // 2, (SIDE - im2.size[1]) // 2), im2)
    canvas.save(os.path.join(OUT, name + ".png"))
    return canvas.size, int(mask.sum())


def largest(lab, comps):
    return lab == comps[0][1]


def multi(lab, comps, frac=0.40):
    """面积 ≥ 最大块 frac 的所有块并集（用于披风左右两片）。"""
    big = [c for a, c in comps if a >= comps[0][0] * frac]
    m = np.zeros(lab.shape, bool)
    for c in big: m |= (lab == c)
    return m


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("披风.png", "mod_cloak", "multi"),
        ("上，武器1.jpeg", "mod_weapon", "largest"),
        ("机动模块1.jpeg", "mod_mobility", "largest"),
        ("辐射清除模块.jpeg", "mod_purge", "largest"),
    ]
    for fn, out, mode in jobs:
        p = os.path.join(SRC, fn)
        if not os.path.exists(p): print("缺源图:", fn); continue
        im = Image.open(p).convert("RGBA")
        lab, comps = fg_label(im)
        mask = multi(lab, comps) if mode == "multi" else largest(lab, comps)
        print(out, save_square(im, mask, out))
    print("模块图标完成 →", OUT)


if __name__ == "__main__":
    main()
