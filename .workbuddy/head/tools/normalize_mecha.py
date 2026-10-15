# -*- coding: utf-8 -*-
"""机甲素材标准化（v90.37）—— **一次处理、统一规格、游戏只用标准件**。

口径（唯一规则，可复用于任何原始机甲图）：
  1) 去背：**边界洪水填充**（只去与四边框相连的近白；机甲内部浅灰/白一并保留，不侵蚀）
     + **封闭白块清除**（被机体围住的背景白块〔腿间/臂-躯干间〕按"又白又平"判据单独清，
       浅色装甲有受光纹理故不清 —— 见 strip_bg 内注释）
  2) 裁切：trim 到前景外框
  3) 归一：等比缩放使内容**按高度撑满**（高 = 标准框高 × 0.96），水平居中，铺到透明画布
     （v90.51：画布加宽到 1280，宽机身也不裁切 —— 每台机甲都撑满框高）
  4) 输出：assets/mecha/<name>.png（统一 **1280×1472** 透明 PNG）

用法：把原始机甲图放进 assets/mecha_raw/，命名 <name>.png|.jpg|.jpeg，
      python tools/normalize_mecha.py  → 输出 assets/mecha/<name>.png
（新素材只需丢进 raw 目录重跑，不改任何游戏代码 / 不加任何规则。）
"""
import os, sys
import numpy as np
from PIL import Image
from collections import deque

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "assets", "mecha_raw")
OUT = os.path.join(BASE, "assets", "mecha")
FW, FH = 1280, 1472         # 标准框（v90.51：加宽，令每台机甲都按**高度**撑满、不留白；与部件栏 .doll-fig 一致）

def strip_bg(im):
    """去背景（v90.42 重定 · **边缘感知**）：
       ① 边缘感知洪水填充：从四边框起，只泡**近白**(mn>200&色散<40) **且平坦**(梯度<EDGE) 的像素 ——
          遇机甲**轮廓的强梯度**即停 → **不去机体**；背景的 JPEG 噪声（低梯度）一并泡掉。
          （纯色散阈值分不开"背景噪声/机甲受光面"——实测重叠；梯度能分开。）
       ② **只留最大前景连通块** → 删残留背景 / 腿间被困白块 / 周围线框碎块（机体是唯一最大块）。
       实测：mk01（噪声白背景残渣）、mk07（浅色头盔被啃）均修复，本体零损。"""
    W, H = im.size
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mn = np.minimum(np.minimum(r, g), b); mx = np.maximum(np.maximum(r, g), b)
    near_white = (mn > 200) & ((mx - mn) < 40)
    grad = np.zeros((H, W), np.int16)
    grad[1:, :] = np.maximum(grad[1:, :], np.abs(a[1:, :] - a[:-1, :]).max(2))
    grad[:, 1:] = np.maximum(grad[:, 1:], np.abs(a[:, 1:] - a[:, :-1]).max(2))
    EDGE = 38                                   # 轮廓梯度门槛：≥此值 = 机甲边，洪水停下
    # 封闭背景块判据（实测标定，见 v90.47 注释）：背景块又白又平、装甲有纹理，两组分离明显——
    #   原始 1536² 图：背景 flat≥0.96/mean_grad≤6；装甲 flat≤0.88/mean_grad≥7。
    MIN_AREA = 3000                             # <此面积的封闭白块视为机体高光/细节，不动
    FLAT = 0.93                                 # 块内"近零梯度(梯度<15)"像素占比 ≥ 此值 = 平坦背景
    MG = 8.0                                    # 且块内平均梯度 < 此值（背景实测 3~6，装甲实测 ≥8）
    bg = np.zeros((H, W), bool); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if near_white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if near_white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    # v90.47（老板：2 的左右臂内、8/13 的左臂内仍有残留）——**封闭背景块判据化清除**。
    #   旧法（v90.43~46 的高风险区种子点）只能清种子落点附近，位置一变就漏（臂内侧缝窄，种子偏了就清不到）。
    #   改**按区域性质**判（不靠位置）：机体被边框洪水去背后，残余背景是**封闭的近白连通块**
    #   （腿间 / 臂-躯干间 / 腋下），其性质 = **又白又平**（内部无反光细节）；而机体的浅色装甲
    #   （哪怕纯白，如 mk12）都有受光纹理 → 用"**平坦度**"分开。见下方 enclosed-flat 块。
    while q:
        cy, cx = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = cy + dy, cx + dx
                if (0 <= ny < H and 0 <= nx < W and near_white[ny, nx] and not bg[ny, nx]
                        and grad[ny, nx] < EDGE):
                    bg[ny, nx] = True; q.append((ny, nx))
    # v90.47 封闭背景块清除：边框洪水后仍残留的**非背景近白**，即被机体围住的封闭白块。
    #   逐连通块判"**又白又平**"（≥FLAT 的像素内部梯度极小 + 均值梯度 <MG）才清；落在装甲上 =
    #   有纹理/受光渐变 → 不清（mk12 纯白装甲实测平坦度≤0.88，安全）。与位置无关，先清块再"只留最大块"收边。
    enc_white = near_white & (~bg)
    elab = np.zeros((H, W), np.int32); ecur = 0
    for y in range(H):
        for x in range(W):
            if enc_white[y, x] and elab[y, x] == 0:
                ecur += 1; eq = deque([(y, x)]); elab[y, x] = ecur
                n = 0; touch = False; gsum = 0; gflat = 0
                while eq:
                    cy, cx = eq.popleft(); n += 1
                    gv = int(grad[cy, cx]); gsum += gv; gflat += 1 if gv < 15 else 0
                    if cy == 0 or cy == H - 1 or cx == 0 or cx == W - 1: touch = True
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if (0 <= ny < H and 0 <= nx < W and enc_white[ny, nx]
                                    and elab[ny, nx] == 0):
                                elab[ny, nx] = ecur; eq.append((ny, nx))
                if (not touch and n >= MIN_AREA
                        and (gflat / n) >= FLAT and (gsum / n) < MG):
                    bg[elab == ecur] = True
    fg = ~bg
    # 只留最大前景连通块（删背景残留 / 腿间空块 / 周围线框）
    lab = np.zeros((H, W), np.int32); cur = 0; best = 0; bestn = 0
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
                if n > bestn: bestn = n; best = cur
    al = np.where(lab == best, 255, 0).astype(np.uint8)
    # v90.48：**去掉 MinFilter(3) 收边** —— 1px 腐蚀会把 2px 级细杆（天线/鞭状天线）
    #   腐蚀成断续虚线（实测 mk15 碎成 18 块、天线成点线）。细特征完整优先于 1px 白边收束。
    return Image.fromarray(np.dstack([np.asarray(im), al]), "RGBA")

def normalize(src, name):
    im = strip_bg(Image.open(src).convert("RGB"))
    ys, xs = np.where(np.asarray(im)[:, :, 3] > 0)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = im.size
    # v90.51（老板「部分机甲还是小」）：**按高度归一** —— 每台机甲都撑满框高，不再因机身宽而缩到 ~70%。
    #   （画布已加宽到 FW，宽机甲缩到高 = FH*0.96 后宽仍 < FW，不会裁切；最宽的 mk10 实测 ≈ 0.90*1379 = 1241 < 1300。）
    k = (FH * 0.96) / h
    im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    canvas.paste(im, ((FW - im.size[0]) // 2, (FH - im.size[1]) // 2), im)
    canvas.save(os.path.join(OUT, name + ".png"))
    return canvas.size

def main():
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(RAW)):
        stem, ext = os.path.splitext(f)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"): continue
        print(stem, normalize(os.path.join(RAW, f), stem)); n += 1
    print("标准化完成：", n, "张 →", OUT)

if __name__ == "__main__":
    main()
