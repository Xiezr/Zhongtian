# -*- coding: utf-8 -*-
"""城内建筑皮肤标准化（v90.63）—— 把 assets/icons/城内建筑/<名>1|2|3.png
（2048×1152 等距插图 · 白底）统一为**建筑图标格式**（512×512 透明 PNG），
落到 assets/icons/ui/ai_<id>.png（档1）/ ai_<id>_t2.png（档2 · Lv≥6）/ ai_<id>_t3.png（档3 · Lv≥12）。

去背口径同 normalize_mecha（边界洪水去白底 + 只留最大前景块），不蚀建筑本体。
"""
import os
import numpy as np
from PIL import Image
from collections import deque

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "assets", "icons", "城内建筑")
OUT = os.path.join(BASE, "assets", "icons", "ui")
SIDE = 512
# 皮肤名 → 建筑 id（城内建筑 id 见 js/data.js）
MAP = {
    "居所": "minfang",
    "政务厅": "guanfu",
    "招募站": "zhaoxianguan",
    "瞭望塔": "fenghuotai",
    "研习所": "shuyuan",
    "练兵场": "xiaochang",
    "训练营": "junying",
    "酒馆": "kezhan",
    "基因实验室": "honglusi",
    "工厂": "gongjiangzuofang",       # 机工坊
    "精密制造厂": "tiejiangpu",        # 锻造间
}


def strip_bg(im):
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
    lab = np.zeros((H, W), np.int32); cur = 0; best = 0; bn = 0
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
                if n > bn: bn = n; best = cur
    al = np.where(lab == best, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([np.asarray(im.convert("RGB")), al]), "RGBA")


def norm(src):
    im = strip_bg(Image.open(src))
    ys, xs = np.where(np.asarray(im)[:, :, 3] > 0)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = im.size
    k = (SIDE * 0.94) / max(w, h)
    im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
    canvas.paste(im, ((SIDE - im.size[0]) // 2, (SIDE - im.size[1]) // 2), im)
    return canvas


def main():
    n = 0
    for name, bid in MAP.items():
        for tier, suffix in ((1, ''), (2, '_t2'), (3, '_t3')):
            src = os.path.join(SRC, "%s%d.png" % (name, tier))
            if not os.path.exists(src):
                print("缺源图:", src); continue
            out = os.path.join(OUT, "ai_%s%s.png" % (bid, suffix))
            norm(src).save(out)
            print("ai_%s%s.png ← %s%d.png" % (bid, suffix, name, tier)); n += 1
    print("建筑皮肤标准化完成：", n, "件 →", OUT)


if __name__ == "__main__":
    main()
