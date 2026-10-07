# -*- coding: utf-8 -*-
"""废土·余烬纪元 · 位图替换**批驱动 + 装前门禁**（阶段 3）。

读 wasteland_batches.json（批次唯一真相源），对一批图集循环：
    切分 → 装前体检 → （全过才）入库 → 打印过/拒表

为什么要有"装前门禁"：历史上建筑图标被投诉 4 轮「颜色不对劲」，根因是单色剪影
（图内色散仅 7°）。本驱动**在装机之前**就把不合格批次挡下 —— 不合格只会浪费一次
生成，不会污染线上素材。判据镜像 smoke-test.js 的像素断言（见 gate）。

v89.225 沿革：**"贴族旗"退役** —— 老板令「建筑前边的带颜色棋子好突兀，
能否用地块颜色区分」：族色编码从"图标上的小旗"迁到"城内地块染色"
（`DATA.SERIES[].plot` + index.html `--ser-*`）。本驱动的建筑切分不再画旗，
gate ③ 相应**反转**为"逐张无族旗色"（防回潮；墓碑色表见 HIST_FLAG_RGB）。

用法：
  python .workbuddy/tools/gen/wasteland_batch.py --list
  python .workbuddy/tools/gen/wasteland_batch.py --batch W-B1 --check   # 只体检（切到暂存，不装）
  python .workbuddy/tools/gen/wasteland_batch.py --batch W-B1 --apply   # 体检全过才装
  python .workbuddy/tools/gen/wasteland_batch.py --all --check
  python .workbuddy/tools/gen/wasteland_batch.py --batch W-B1 --apply --force   # 忽略门禁强装（记录）
"""
import os, sys, re, io, json, math, shutil, subprocess, argparse

BASE = r"E:/Deepseekdb"
JSONP = os.path.join(BASE, ".workbuddy", "tools", "asset", "wasteland_batches.json")
UI = os.path.join(BASE, "assets", "icons", "ui")
RAW = os.path.join(BASE, "assets", "icons", "raw")
TMP = os.path.join(BASE, ".workbuddy", "tmp", "atlas")
STAGE = os.path.join(BASE, ".workbuddy", "tmp", "wasteland")
PREBAK = os.path.join(BASE, ".workbuddy", "backup", "pre_wasteland")
NODE = "node"
GROUND = (0x8b, 0x9a, 0x78)          # 地色（smoke:10928）

# ---------- 颜色数学（与 smoke-test.js / flag_bldg_icons.py 同口径）----------

def srgb2lab(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = f(c[0]), f(c[1]), f(c[2])
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    def h(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = h(x), h(y), h(z)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]


def de00(c1, c2):
    A, B = srgb2lab(c1), srgb2lab(c2)
    L1, a1, b1, L2, a2, b2 = A + B
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p + 180) % 360 - 180
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hbp = (h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else ((h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def rgb_of_hsl(h, s, l):              # l 收 0~1 小数（与 smoke 一致）
    import colorsys
    r, g, b = colorsys.hls_to_rgb(((h % 360) + 360) % 360 / 360.0, l, s)
    return (round(r * 255), round(g * 255), round(b * 255))


# ---------- 数据源：族归属与旗色都从 js/data.js 读（不另抄表）----------

def load_ser_of():
    """族归属（建筑 → 族）从 js/data.js 读（唯一来源；gate 的建筑②用）。
    ⛔ v89.225：原 `load_series` 兼读的 `flag` 旗色随族旗退役删除 ——
    族色编码已迁到 `DATA.SERIES[].plot`（地块染色），不需要在本工具里解析。"""
    src = io.open(os.path.join(BASE, "js", "data.js"), encoding="utf-8").read()
    bblk = src[src.index("DATA.BUILDINGS = {"):]
    bblk = bblk[:bblk.index("\n  };")]
    ser_of = dict(re.findall(r"id: '([a-z]+)', series: '([a-z]+)'", bblk))
    return ser_of


# ---------- 像素体检（镜像 smoke-test.js）----------

def _png_pixels(path):
    from PIL import Image
    import numpy as np
    im = Image.open(path).convert("RGBA")
    return np.asarray(im).astype(np.float64), im.size


def metrics(path):
    """返回：alpha 覆盖率 / 内容占宽高比 / 图内色散 / 各角背景 alpha。"""
    arr, (w, h) = _png_pixels(path)
    a = arr[..., 3]
    solid = a >= 24
    cov = float(solid.sum()) / (w * h) if w * h else 0.0
    if solid.sum() == 0:
        return {"coverage": 0.0, "boxW": 0.0, "boxH": 0.0, "hueSpread": None, "corners": [0, 0, 0, 0]}
    ys, xs = solid.nonzero()
    boxW = (xs.max() - xs.min() + 1) / w
    boxH = (ys.max() - ys.min() + 1) / h
    return {"coverage": cov, "boxW": boxW, "boxH": boxH, "hueSpread": hue_spread(arr), "corners": _corners(a)}


def _corners(a, r=4):
    h, w = a.shape
    return [float(a[:r, :r].mean()), float(a[:r, -r:].mean()), float(a[-r:, :r].mean()), float(a[-r:, -r:].mean())]


def hue_spread(arr):
    """图内色散（度）—— 与 smoke hueSpread 同口径：加权合成向量模长 → 圆标准差。
    只统计有彩像素（s>0.12），step = max(1, w//140)。单色剪影 ≈7° · 材质重绘 15~40°。"""
    h, w = arr.shape[:2]
    step = max(1, w // 140)
    hx = hy = wsum = 0.0
    n = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            if arr[y, x, 3] < 40:
                continue
            r, g, b = arr[y, x, 0] / 255.0, arr[y, x, 1] / 255.0, arr[y, x, 2] / 255.0
            mx, mn = max(r, g, b), min(r, g, b)
            d = mx - mn
            l = (mx + mn) / 2
            s = d / (1 - abs(2 * l - 1)) if d > 1e-6 else 0
            if s <= 0.12:
                continue
            if mx == r:
                hh = ((g - b) / d) % 6
            elif mx == g:
                hh = (b - r) / d + 2
            else:
                hh = (r - g) / d + 4
            hh *= 60
            if hh < 0:
                hh += 360
            hx += math.cos(math.radians(hh)) * s
            hy += math.sin(math.radians(hh)) * s
            wsum += s
            n += 1
    if n < 20 or wsum <= 0:
        return None
    R = math.hypot(hx / wsum, hy / wsum)
    return math.sqrt(max(0.0, -2 * math.log(max(R, 1e-9)))) * 180 / math.pi


def hue_sat(path):
    """镜像 smoke-test.js hueSat：采样实心像素 → 圆均色相 h + 均饱和 s + 均明度 l。
    用于**族均值色 vs 地色**的判据（smoke:10928）。"""
    arr, (w, h) = _png_pixels(path)
    step = max(1, w // 140)
    sSum = lSum = 0.0
    n = 0
    hx = hy = 0.0
    for y in range(0, h, step):
        for x in range(0, w, step):
            if arr[y, x, 3] < 40:
                continue
            r, g, b = arr[y, x, 0] / 255.0, arr[y, x, 1] / 255.0, arr[y, x, 2] / 255.0
            mx, mn = max(r, g, b), min(r, g, b)
            d = mx - mn
            l = (mx + mn) / 2
            s = d / (1 - abs(2 * l - 1)) if d > 1e-6 else 0
            sSum += s
            lSum += l
            n += 1
            if d > 1e-6:
                if mx == r:
                    hh = ((g - b) / d) % 6
                elif mx == g:
                    hh = (b - r) / d + 2
                else:
                    hh = (r - g) / d + 4
                hh *= 60
                if hh < 0:
                    hh += 360
                hx += math.cos(math.radians(hh)) * s
                hy += math.sin(math.radians(hh)) * s
    if not n:
        return None
    mh = math.degrees(math.atan2(hy, hx))
    if mh < 0:
        mh += 360
    return {"h": mh, "s": sSum / n * 100, "l": lSum / n * 100, "n": n}


def series_mean(paths):
    """一组图的 hueSat 均值（镜像 smoke 的 measured[ser]）。"""
    hs = [hue_sat(p) for p in paths]
    hs = [x for x in hs if x]
    if not hs:
        return None
    return {"h": sum(x["h"] for x in hs) / len(hs),
            "s": sum(x["s"] for x in hs) / len(hs),
            "l": sum(x["l"] for x in hs) / len(hs)}


def has_color(path, want, tol=12, min_hits=8):
    """图里是否真含接近目标色的像素（镜像 smoke hasColor）。
    ⛔ v89.225：原 gate ③"逐张含族旗"的判据载体，随族旗退役已无调用方 ——
    保留为通用工具（供未来其它"素材色彩在册"校验复用），不再是门禁环节。"""
    arr, (w, h) = _png_pixels(path)
    step = max(1, w // 160)
    hit = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            if arr[y, x, 3] < 200:
                continue
            if de00(arr[y, x, :3].tolist(), want) <= tol:
                hit += 1
    return hit, min_hits


# ---------- 切分 ----------

def run(cmd, **kw):
    env = dict(os.environ)
    # atlas_split.js 需要 pngjs —— 装在 WorkBuddy 的 node workspace 里
    extra = os.path.join(os.path.expanduser("~"), ".workbuddy", "binaries", "node", "workspace", "node_modules")
    if os.path.isdir(extra):
        env["NODE_PATH"] = extra + os.pathsep + env.get("NODE_PATH", "")
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, **kw)
    if p.returncode != 0:
        print("    ✗ 子进程失败:", " ".join(cmd))
        print((p.stdout or "") + (p.stderr or ""))
    return p.returncode == 0


def find_atlas(name):
    for d in (RAW, os.path.join(TMP)):
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None


def is_building_batch(batch):
    return bool(batch.get("atlases")) and all(a.get("group") == "building" for a in batch["atlases"])


def _despeckle(alpha, min_px=24):
    """去掉面积小于 min_px 的漂浮连通块（AI 图集背景噪点抠底后的残留小点）。
    alpha 是 uint8 前景掩码（0/255）。返回清过散点的新掩码。"""
    import numpy as np
    from collections import deque
    m = alpha > 128
    h, w = m.shape
    seen = np.zeros_like(m, dtype=bool)
    out = np.zeros_like(m, dtype=bool)
    for y in range(h):
        for x in range(w):
            if m[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; pts = []
                while q:
                    cy, cx = q.popleft(); pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                if len(pts) >= min_px:
                    for (py, px) in pts:
                        out[py, px] = True
    return np.where(out, 255, 0).astype(np.uint8)


def split_batch(batch, atlas_dir):
    """把一批图集切到 per-batch 暂存目录；返回 {id: staged_path}。"""
    out = {}
    stage = os.path.join(STAGE, batch["batch"])
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage, exist_ok=True)
    for a in batch["atlases"]:
        atlas = os.path.join(atlas_dir, a["atlas"]) if atlas_dir else None
        if not atlas or not os.path.exists(atlas):
            atlas = find_atlas(a["atlas"])
        if not atlas:
            print("    ⚠ 缺图集 " + a["atlas"] + "（跳过）")
            continue
        g = a["group"]
        suf = a.get("suffix", "")
        if g == "building":
            # 建筑：连通域洪水填充抠底（不伤内部浅色墙）+ 512 居中
            #   （v89.225："贴族旗"步骤退役 —— 族色编码改"地块染色"，见 gate ③ 注释）
            _split_building_floodfill(atlas, a["ids"], stage, suf)
        else:
            run([NODE, os.path.join(BASE, ".workbuddy", "tools", "gen", "atlas_split.js"), a["atlas"], ",".join(a["ids"]), stage])
        for id_ in a["ids"]:
            key = id_ + suf
            p = os.path.join(stage, "ai_%s.png" % key)
            if os.path.exists(p):
                out[key] = p
    return out


def _split_building_floodfill(atlas, ids, stage, suf=""):
    """建筑专用切分：连通域洪水填充抠底 + 512 画布居中（对齐 split_atlas.py 口径）。
    为什么内联：split_atlas.py 输出到固定目录 + 只认写死的 GROUPS；驱动要落自定义暂存目录。
    ⛔ v89.225 退役"贴族旗"（原 `draw_flag(canvas, …)` 调用）—— 老板令「带颜色棋子
       好突兀，能否用地块颜色区分」：族色编码从"图标上的小旗"迁到"城内地块染色"
       （`DATA.SERIES[].plot` + index.html 的 `--ser-*` 主题变量）。
       若旗回潮：本文件 gate ③ 与 smoke §225 双重拦截。"""
    from PIL import Image, ImageDraw
    import numpy as np
    from collections import deque
    TOL, PAD, SIZE = 46, 0.035, 512
    im = Image.open(atlas).convert("RGB")
    rgb = np.asarray(im).astype(np.int16)
    H, W = rgb.shape[:2]
    ch, cw = H // 2, W // 2
    for i, bid in enumerate(ids[:4]):
        y0, x0 = (i // 2) * ch, (i % 2) * cw
        m = int(round(ch * 0.02))
        cell = rgb[y0 + m:y0 + ch - m, x0 + m:x0 + cw - m]
        hh, ww = cell.shape[:2]
        border = np.concatenate([cell[0, :], cell[-1, :], cell[:, 0], cell[:, -1]])
        bg = np.median(border, axis=0)
        cand = np.sqrt(((cell - bg) ** 2).sum(axis=2)) < TOL
        vis = np.zeros_like(cand, dtype=bool)
        q = deque()
        for x in range(ww):
            for y in (0, hh - 1):
                if cand[y, x] and not vis[y, x]:
                    vis[y, x] = True; q.append((y, x))
        for y in range(hh):
            for x in (0, ww - 1):
                if cand[y, x] and not vis[y, x]:
                    vis[y, x] = True; q.append((y, x))
        while q:
            y, x = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < hh and 0 <= nx < ww and cand[ny, nx] and not vis[ny, nx]:
                    vis[ny, nx] = True; q.append((ny, nx))
        alpha = np.where(vis, 0, 255).astype(np.uint8)
        # 去散点：AI 图集背景有噪点，抠底后残留漂浮小点（视觉"毛边"）。只留面积够的连通域。
        alpha = _despeckle(alpha, min_px=24)
        rgba = np.dstack([cell.astype(np.uint8), alpha])
        ys, xs = (alpha > 24).nonzero()
        if len(xs) == 0:
            continue
        crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        cimg = Image.fromarray(crop, "RGBA")
        side = max(cimg.size)
        scale = (1 - PAD * 2) * SIZE / side
        cimg = cimg.resize((max(1, round(cimg.width * scale)), max(1, round(cimg.height * scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.paste(cimg, ((SIZE - cimg.width) // 2, (SIZE - cimg.height) // 2), cimg)
        # 二次去散点：LANCZOS 缩放会把弱 alpha 又切成小点，在最终画布上再清一遍
        ca = np.asarray(canvas).copy()
        ca[..., 3] = _despeckle(ca[..., 3], min_px=16)
        canvas = Image.fromarray(ca, "RGBA")
        canvas.save(os.path.join(stage, "ai_%s.png" % (bid + suf)))


# ⛔ v89.225 退役：`draw_flag`（燕尾旗：深木旗杆 + 横挑 + 三角燕尾布）整条删除。
#   沿革：v89.107 立（族色编码 = 小面积高饱和色旗）→ v89.225 撤
#   （老板：「建筑前边的带颜色棋子是什么，能否用地块颜色区分，不然好突兀」）。
#   去向：`DATA.SERIES[].plot` + index.html `--ser-*` 主题变量（城内地块染色）。
#   历史上贴旗的 16 张图标在 v89.225 已由"本文件重切不画旗"清除；若旗回潮，
#   本文件 gate ③（无旗校验）与 smoke §225 会当场拦下。


# ---------- 门禁 ----------

# v89.225：历史族旗色（RGB）—— 旗退役后**仅作墓碑比对**（gate ③"无旗"校验的对照色），
# 不是"要贴的目标"。有旗时每张图在旗位区域命中 ≈4800px，无旗后只剩自然材质的零星近似。
HIST_FLAG_RGB = [
    (205, 160, 55),   # gov 旧币（42°/60%/51%）
    (231, 227, 213),  # live 素（48°/27%/87%）
    (104, 76, 39),    # store 赭（34°/45%/28%）
    (44, 125, 100),   # edu 青碧（162°/48%/33%）
    (43, 82, 136),    # mil 靛（215°/52%/35%）
    (196, 70, 59),    # biz 朱（5°/54%/50%）
    (110, 155, 175),  # road 青灰（199°/29%/56%）
]
FLAG_BOX = (0.62, 0.58, 0.87, 0.78)   # 旗位区域（相对比例：旗面 x0.645~0.845 + 旗杆外沿）


def flag_px_in_box(path, colors, tol=15):
    """旗位区域内"任一历史族旗色"的最大命中像素数（欧氏距离 ≤ tol）。
    全采样（不 step）—— 区域约 128×102 px，代价可忽略。
    tol=15 经 16 张实测标定：无旗 ≤448（自然材质零星近似）· 有旗 ≈4806（精确平涂，
    PIL polygon 硬边缘无抗锯齿）—— 判别力 ~10×；阈值见 guards.buildingNoFlagMaxPx。"""
    arr, (w, h) = _png_pixels(path)
    x0, y0 = int(w * FLAG_BOX[0]), int(h * FLAG_BOX[1])
    x1, y1 = int(w * FLAG_BOX[2]), int(h * FLAG_BOX[3])
    best = 0
    for want in colors:
        hit = 0
        for y in range(y0, y1):
            for x in range(x0, x1):
                if arr[y, x, 3] < 200:
                    continue
                dr = arr[y, x, 0] - want[0]
                dg = arr[y, x, 1] - want[1]
                db = arr[y, x, 2] - want[2]
                if dr * dr + dg * dg + db * db <= tol * tol:
                    hit += 1
        if hit > best:
            best = hit
    return best


def gate(staged, batch, ser_of, guards):
    """装配前体检 —— 镜像 smoke-test.js 的建筑判据 + 通用完整性。
    返回 (per_image_rows, batch_fails)。batch_fails 非空 = 整批拒。"""
    is_building = is_building_batch(batch)
    rows = []
    batch_fails = []

    # ---- 通用：每张 alpha 覆盖 / bbox 合理性 ----
    for id_, p in sorted(staged.items()):
        mt = metrics(p)
        why = []
        if mt["coverage"] < guards["alphaCoverageMin"]:
            why.append("覆盖%.3f<%.2f(疑似空图)" % (mt["coverage"], guards["alphaCoverageMin"]))
        if mt["boxW"] > 0.94 and mt["boxH"] > 0.94:
            why.append("占满(疑似切到邻格)")
        rows.append([id_, mt, not why, why])

    if not is_building:
        return rows, batch_fails

    # ---- 建筑①：批内图内色散**平均** ≥15°（smoke:10892 是批均值，非逐张）----
    spreads = [mt["hueSpread"] for _, mt, _, _ in rows if mt["hueSpread"] is not None]
    avg_spread = sum(spreads) / len(spreads) if spreads else 0.0
    if avg_spread < guards["buildingHueSpreadMin"]:
        batch_fails.append("图内色散均值 %.1f° < %d（单色剪影未除）" % (avg_spread, guards["buildingHueSpreadMin"]))

    # ---- 建筑②：每族均色 vs 地色 ΔE00 ≥12（smoke:10928）----
    by_ser = {}
    for id_, p in staged.items():
        ser = ser_of.get(id_)
        if ser:
            by_ser.setdefault(ser, []).append(p)
    for ser, paths in by_ser.items():
        m = series_mean(paths)
        if not m:
            batch_fails.append("族 %s 均色缺失" % ser)
            continue
        d = de00(rgb_of_hsl(m["h"], m["s"] / 100.0, m["l"] / 100.0), GROUND)
        if d < guards["seriesGroundDeltaE00Min"]:
            batch_fails.append("族 %s 糊进地面 ΔE00=%.1f <12" % (ser, d))

    # ---- 建筑③：逐张**无族旗色**（v89.225 口径反转：族旗退役，防回潮）----
    #   判据 = 旗位区域（FLAG_BOX = 原 draw_flag 几何外沿）内，"任一历史族旗色"
    #   （HIST_FLAG_RGB 墓碑色表）命中像素 < guards["buildingNoFlagMaxPx"]。
    #   有旗时每张 ≈4800px；无旗后自然材质只会有零星近似（阈值经 16 张实测标定）。
    for id_, p in staged.items():
        hits = flag_px_in_box(p, HIST_FLAG_RGB)
        if hits >= guards["buildingNoFlagMaxPx"]:
            batch_fails.append("%s 旗位含族旗色 %d≥%d（旗回潮？）" % (id_, hits, guards["buildingNoFlagMaxPx"]))

    return rows, batch_fails


def print_table(rows):
    print("    %-22s %6s %6s %6s  %s" % ("id", "覆盖", "占宽", "色散", "泛完整性"))
    for id_, mt, ok, why in rows:
        hs = "-" if mt["hueSpread"] is None else "%.0f" % mt["hueSpread"]
        print("    %-22s %6.2f %6.2f %6s  %s" % (id_, mt["coverage"], mt["boxW"], hs, "✅" if ok else "⛔ " + ";".join(why)))


# ---------- 安装 ----------

def install(staged, batch):
    """把暂存目录里全部图**同名覆盖**到 assets/icons/ui/；装前把旧图另存到 pre_wasteland/。"""
    bdir = os.path.join(PREBAK, batch["batch"])
    os.makedirs(bdir, exist_ok=True)
    n = 0
    for id_, p in sorted(staged.items()):
        dst = os.path.join(UI, "ai_%s.png" % id_)
        if os.path.exists(dst):
            shutil.copy2(dst, os.path.join(bdir, "ai_%s.png" % id_))   # 装前旧图另存
        shutil.copy2(p, dst)
        n += 1
    return n


# ---------- 进度 ----------

def status(spec):
    """一览：每批图集到位几张 / 缺失哪些 + 已装/未装。"""
    print("\n══ 进度一览（图集到位情况）══\n")
    for b in spec["atlasBatches"]:
        have, miss = [], []
        for a in b["atlases"]:
            (have if find_atlas(a["atlas"]) else miss).append(a["atlas"])
        mark = "✅" if not miss else ("◑" if have else "○")
        print("  %s %-6s %-22s 图集 %d/%d" % (mark, b["batch"], b.get("label"), len(have), len(b["atlases"])))
        if miss:
            print("        缺: " + ", ".join(miss))
    print("\n  贴图批（W-T1/T2/T3）走 crop_terrain.py / crop_city.py，需参考图，见规格书 §四。")
    print("  出图 prompt: python .workbuddy/tools/gen/wasteland_prompts.py --batch <批号>")


# ---------- 主 ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--atlas-dir")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    spec = json.load(io.open(JSONP, encoding="utf-8"))
    guards = spec["guards"]
    ser_of = load_ser_of()

    if args.status:
        status(spec); return
    if args.list:
        for b in spec["atlasBatches"] + spec["textureBatches"]:
            print("  %-6s %-22s %3d  %s" % (b["batch"], b.get("label", b.get("group")), b["count"], b.get("method")))
        return

    batches = spec["atlasBatches"]
    if args.batch:
        batches = [b for b in batches if b["batch"] == args.batch]
    elif not args.all:
        print("请给 --batch <id> 或 --all；--list 看批次；--status 看进度"); return
    if not batches:
        print("没有匹配的批次（贴图批走 crop_*.py，不在此驱动）"); return

    total_fail = 0
    installed_any = False
    for batch in batches:
        print("\n══ %s %s ══" % (batch["batch"], batch.get("label", "")))
        staged = split_batch(batch, args.atlas_dir)
        if not staged:
            print("    （无图集，跳过 —— 先生成：wasteland_prompts.py --batch %s）" % batch["batch"])
            continue
        rows, batch_fails = gate(staged, batch, ser_of, guards)
        print_table(rows)
        ok_img = sum(1 for r in rows if r[2])
        print("    逐张完整性：%d/%d 过" % (ok_img, len(rows)))
        if batch_fails:
            print("    ⛔ 批级判据未过：")
            for f in batch_fails:
                print("       - " + f)
            total_fail += len(batch_fails)
        else:
            print("    ✅ 批级判据全过")
        if args.apply:
            if batch_fails and not args.force:
                print("    → 拒绝入库（批级判据未过）。修图重出，或 --force 强装（记录）。")
            else:
                n = install(staged, batch)
                installed_any = True
                print("    → 入库 %d 张%s" % (n, "（--force 忽略门禁，已记录）" if batch_fails else ""))

                # 自动收尾：重生成登记表 + 素材层校验
                print("    → 重生成登记表 gen_bitmaps.js …")
                run([NODE, os.path.join(BASE, ".workbuddy", "tools", "gen", "gen_bitmaps.js")])
                print("    → 素材层校验（穷举 layerOf）…")
                subprocess.run([NODE, os.path.join(BASE, ".workbuddy", "tools", "asset", "verify_wasteland.js")],
                               env=dict(os.environ, NODE_PATH=os.path.join(os.path.expanduser("~"), ".workbuddy", "binaries", "node", "workspace", "node_modules")))
        else:
            print("    → 体检完成；加 --apply 一键入库")
    if installed_any:
        print("\n✅ 已入库。下一步：")
        print("   node .workbuddy/tools/asset/verify_wasteland.js      # 看回退情况")
        print("   node smoke-test.js                                    # 门禁（建筑色散/族旗）")
    if total_fail and not args.force:
        sys.exit(1)


if __name__ == "__main__":
    main()
