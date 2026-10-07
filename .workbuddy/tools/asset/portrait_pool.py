# -*- coding: utf-8 -*-
"""英雄肖像建池 —— 去背景（**凸包保留半身**）+ 缩 512 WebP + 分类打标。

老板口径（v89.238）：
  **以人物轮廓为界**——头/颈/胸/肩属"内部"，一律保留，**不许被清**。
  外部背景（含左上/右下角）直接清除。

做法（为什么用凸包）：
  纯边缘洪水会从**脖子/肩窝的窄缝**钻进人物内部，吃掉该留的色块。
  → 取**最大前景连通块**（人物半身），求其**凸包**（头+肩的包围多边形），
    凸包内**全保留**（无论深浅），外部清除。半身像的轮廓恰好近似凸形，凸包=干净的半身抠图。

用法：
  python .workbuddy/tools/asset/portrait_pool.py <源目录> [分类json] [输出目录]
  分类 json：{"文件名(不含扩展名)": ["m|f", "human|beast|mutant"], ...}
  省略分类时全部按 m/human。
"""
import os, sys, io, json
import numpy as np
from PIL import Image, ImageDraw
from collections import deque

BASE = r"E:/Deepseekdb"
OUT = os.path.join(BASE, "assets", "portraits", "pool")


def fg_mask(im, ltol=22, guard=170):
    """前景 = ~(从边洪水可达的背景)。局部判据(跟随渐变)+与背景色差上限(防漏进人)。"""
    a = np.asarray(im.convert("RGB")).astype(int)
    H, W = a.shape[:2]
    bg = np.median(np.concatenate([a[2:16, 2:16].reshape(-1, 3), a[2:16, -16:-2].reshape(-1, 3),
                                   a[-16:-2, 2:16].reshape(-1, 3), a[-16:-2, -16:-2].reshape(-1, 3)]), 0)
    vis = np.zeros((H, W), bool)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            vis[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if not vis[y, x]:
                vis[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not vis[ny, nx]:
                if abs(a[ny, nx] - a[y, x]).sum() < ltol and abs(a[ny, nx] - bg).sum() < guard:
                    vis[ny, nx] = True; q.append((ny, nx))
    return ~vis


def convex_hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def hull_mask(im):
    """**正交凸包**（逐行取 x 极值 + 逐列取 y 极值 → 填充）。
    背景向人物逼近，但内凹（脖子/肩窝窄缝、异常弯折）被填平 ——
    跟随轮廓、不破坏头/颈/胸/肩的内部色块。"""
    fg = fg_mask(im)
    H, W = fg.shape
    mask = np.zeros((H, W), bool)
    for y in range(H):
        xs = np.nonzero(fg[y])[0]
        if len(xs):
            mask[y, xs.min():xs.max() + 1] = True
    for x in range(W):
        ys = np.nonzero(fg[:, x])[0]
        if len(ys):
            mask[ys.min():ys.max() + 1, x] = True
    return mask


def build(src, size=512):
    im = Image.open(src)
    m = hull_mask(im)
    a = np.asarray(im.convert("RGB")); al = (m * 255).astype("uint8")
    rgba = Image.fromarray(np.dstack([a, al]), "RGBA")
    ys, xs = (al > 40).nonzero()
    if len(xs) == 0:
        return None
    c = rgba.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    PAD = 0.03; tgt = int(size * (1 - 2 * PAD)); k = tgt / max(c.size)
    c = c.resize((max(1, int(c.width * k)), max(1, int(c.height * k))), Image.LANCZOS)
    cv = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cv.paste(c, ((size - c.width) // 2, (size - c.height) // 2), c)
    return cv


def main():
    src_dir = sys.argv[1]
    cls = json.load(io.open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else {}
    out = sys.argv[3] if len(sys.argv) > 3 else OUT
    os.makedirs(out, exist_ok=True)
    tags = []; cnt = {}
    for fn in sorted(os.listdir(src_dir)):
        key = os.path.splitext(fn)[0]
        g, st = cls.get(key, ["m", "human"])
        cv = build(os.path.join(src_dir, fn))
        if cv is None:
            continue
        tg = "%s_%s" % (g, st); cnt[tg] = cnt.get(tg, 0) + 1
        nm = "%s_%02d.webp" % (tg, cnt[tg])
        cv.save(os.path.join(out, nm), "WEBP", quality=92)
        tags.append({"file": nm, "gender": g, "style": st})
    json.dump(tags, io.open(os.path.join(out, "tags.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("建池 %d 张 → %s" % (len(tags), out))
    for k in sorted(cnt):
        print("  %-12s %d" % (k, cnt[k]))


if __name__ == "__main__":
    main()
