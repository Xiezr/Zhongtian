# -*- coding: utf-8 -*-
"""v89.42 前后对比：逐格"两翼"采样（避开等级角标/名称条）→ 报告 + 拼图。
输出: _v8942_report.txt · _v8942_compare.png · _v8942_tiles.png（贴图一览）
"""
import os, json
import numpy as np
from PIL import Image, ImageDraw

BASE = r"C:\Users\18811\WorkBuddy\2026-09-19-02-16-20"
BEFORE = os.path.join(BASE, "_shot_before_raw.png")
AFTER = os.path.join(BASE, "_shot_after_raw.png")
GRID = os.path.join(BASE, "_shot_after_grid.json")
REPORT = os.path.join(BASE, "_v8942_report.txt")
COMPARE = os.path.join(BASE, "_v8942_compare.png")

CN = {"plain": "平地", "caoyuan": "草原", "zhaoze": "沼泽", "lake": "湖泊",
      "forest": "森林", "desert": "荒漠", "hill": "山地", "city": "城池"}
ORDER = ["plain", "caoyuan", "zhaoze", "lake", "forest", "desert", "hill", "city"]


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64)


def wings(a, cx, cy):
    """左右两翼（避开中间角标列）：rows cy-12..cy+2，左 cols cx-46..cx-16 / 右 cx+17..cx+47"""
    H, W = a.shape[:2]
    y0, y1 = int(cy) - 12, int(cy) + 3
    y0 = max(0, min(H - 2, y0)); y1 = max(y0 + 1, min(H, y1))
    out = []
    for x0, x1 in ((int(cx) - 46, int(cx) - 16), (int(cx) + 17, int(cx) + 47)):
        x0 = max(0, min(W - 2, x0)); x1 = max(x0 + 1, min(W, x1))
        out.append(a[y0:y1, x0:x1])
    return out


def wing_stats(ws):
    ms, ss, gs, vecs = [], [], [], []
    for w in ws:
        lum = w.mean(axis=2)
        ms.append(w.reshape(-1, 3).mean(axis=0))
        ss.append(lum.std())
        gs.append((np.abs(np.diff(lum, axis=1)).mean() + np.abs(np.diff(lum, axis=0)).mean()) / 2)
        vecs.append(lum.reshape(-1))
    return np.mean(ms, axis=0), float(np.mean(ss)), float(np.mean(gs)), np.concatenate(vecs)


def main():
    vb, va = load(BEFORE), load(AFTER)
    g = json.load(open(GRID, encoding="utf-8"))
    v = g["view"]
    ox, oy, HW, HH = v["ox"], v["oy"], v["HW"], v["HH"]
    agg = {}
    zoom_tile = None
    for t in g["tiles"]:
        gx, gy, terr = t["gx"], t["gy"], t["terrain"]
        cx = ox + (gx - gy) * HW
        cy = oy + (gx + gy) * HH
        if cx < 60 or cx > vb.shape[1] - 60 or cy < 40 or cy > vb.shape[0] - 30:
            continue
        mb, sb, gb, vcb = wing_stats(wings(vb, cx, cy))
        ma, sa, ga, vca = wing_stats(wings(va, cx, cy))
        d = agg.setdefault(terr, {"n": 0, "b": [], "a": [], "sb": [], "sa": [], "gb": [], "ga": [], "v": []})
        d["n"] += 1; d["b"].append(mb); d["a"].append(ma)
        d["sb"].append(sb); d["sa"].append(sa)
        d["gb"].append(gb); d["ga"].append(ga)
        if len(d["v"]) < 40:
            d["v"].append((vcb, vca))
        if terr == "lake" and zoom_tile is None and 220 < cx < vb.shape[1] - 220 and 160 < cy < vb.shape[0] - 140:
            zoom_tile = (cx, cy)

    lines = []
    lines.append("=== v89.42 野地贴图前后对比（seed=4242 · 视野中心 (40,40) · 13x7@104）===")
    lines.append("采样 = 格心左右两翼（rows -12..+2，避开等级角标与名称条）")
    lines.append("")
    lines.append("%-5s %3s | %-9s -> %-9s | %5s -> %5s | %5s -> %5s | %6s" % (
        "地形", "格数", "改前均色", "改后均色", "std前", "std后", "梯度前", "梯度后", "同族相似"))
    for terr in ORDER:
        if terr not in agg:
            continue
        d = agg[terr]
        mb = np.mean(d["b"], axis=0); ma = np.mean(d["a"], axis=0)

        def hx(c):
            return "#%02x%02x%02x" % (int(c[0]), int(c[1]), int(c[2]))
        # 同族相似度：逐格两两相关性（1=互相复印；低=有变化）
        sims_b, sims_a = [], []
        vs = d["v"]
        for i in range(len(vs)):
            for j in range(i + 1, len(vs)):
                for k, bucket in ((0, sims_b), (1, sims_a)):
                    x, y = vs[i][k] - vs[i][k].mean(), vs[j][k] - vs[j][k].mean()
                    den = (np.sqrt((x * x).sum()) * np.sqrt((y * y).sum()))
                    if den > 1e-6:
                        bucket.append(float((x * y).sum() / den))
        simB = float(np.mean(sims_b)) if sims_b else float("nan")
        simA = float(np.mean(sims_a)) if sims_a else float("nan")
        lines.append("%-5s %3d | %s -> %s | %5.1f -> %5.1f | %5.2f -> %5.2f | %.2f -> %.2f" % (
            CN.get(terr, terr), d["n"], hx(mb), hx(ma),
            np.mean(d["sb"]), np.mean(d["sa"]), np.mean(d["gb"]), np.mean(d["ga"]), simB, simA))
    txt = "\n".join(lines)
    open(REPORT, "w", encoding="utf-8").write(txt)
    print(txt)

    # ---- 拼图：before / after + 湖区放大 ----
    def cap(img, label):
        out = Image.new("RGB", (img.width, img.height + 30), (20, 20, 22))
        out.paste(img, (0, 30))
        ImageDraw.Draw(out).text((10, 9), label, fill=(240, 230, 190))
        return out
    top = cap(Image.fromarray(vb.astype(np.uint8)), "BEFORE  v89.40  程序化矢量（地形全手绘，无贴图）")
    bot = cap(Image.fromarray(va.astype(np.uint8)), "AFTER   v89.42  即梦像素贴图 x7 + 逐格镜像变体（同屏 6 种野地）")
    zt = zoom_tile or (vb.shape[1] // 2, vb.shape[0] // 2)
    zx, zy = int(zt[0]), int(zt[1])
    box = (max(0, zx - 140), max(0, zy - 80), min(vb.shape[1], zx + 140), min(vb.shape[0], zy + 80))
    zb = Image.fromarray(vb.astype(np.uint8)).crop(box).resize((560, 320), Image.NEAREST)
    za = Image.fromarray(va.astype(np.uint8)).crop(box).resize((560, 320), Image.NEAREST)
    czb, cza = cap(zb, "BEFORE  zz"), cap(za, "AFTER  zz")
    czb = cap(zb, "BEFORE  湖区/荒漠/山地 2x"); cza = cap(za, "AFTER   湖区/荒漠/山地 2x")
    W = max(top.width, bot.width)
    h = top.height + bot.height + 10 + czb.height + cza.height
    sheet = Image.new("RGB", (W, h), (20, 20, 22))
    y = 0
    for im in (top, bot, czb, cza):
        sheet.paste(im, (0, y)); y += im.height
    sheet.save(COMPARE)
    print("\n拼图: _v8942_compare.png (%dx%d)" % (sheet.width, sheet.height))

    # ---- 贴图一览（7 张按 104x52 显示尺度 + 2x2 平铺）----
    DIR = r"E:\Deepseekdb\assets\icons\ui"
    TW, TH = 104, 52
    pad = 14
    gal = Image.new("RGB", (pad + 7 * (TW + pad), pad + 40 + TH * 2 + 26), (26, 26, 28))
    dr = ImageDraw.Draw(gal)
    for i, terr in enumerate(["plain", "caoyuan", "forest", "zhaoze", "lake", "desert", "hill"]):
        im = Image.open(os.path.join(DIR, "ai_terrain_%s.png" % terr)).convert("RGB")
        tile = im.resize((TW, TH), Image.LANCZOS)   # ≈ 游戏内显示尺度（采样窗→菱形外接框）
        x = pad + i * (TW + pad)
        gal.paste(tile, (x, 24))
        # 2x2 交错（模拟相邻格）
        for k in range(4):
            g2 = im.crop((0, 0, 200, 100)).resize((TW, TH), Image.LANCZOS)
            gal.paste(g2, (x + (k % 2) * (TW // 2), 24 + TH + (k // 2) * (TH // 2)))
        dr.text((x, 8), "%s  %s" % (terr, CN.get(terr, "")), fill=(230, 220, 180))
    gal.save(os.path.join(BASE, "_v8942_tiles.png"))
    print("贴图一览: _v8942_tiles.png")


if __name__ == "__main__":
    main()
