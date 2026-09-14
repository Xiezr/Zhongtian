# -*- coding: utf-8 -*-
"""裁切 v3（定稿）：**从上往下裁，只去掉顶部留白**。

两次失败的教训：
  v1 用背景色四角采样定 bbox —— 古画背景是渐晕绢色，估不准
     → guanyu/machao 满幅(0.92)、liubei/sunquan 只剩一条(HW 4.9)
  v2 改用边缘密度找「最密集区」—— 但最密集处是**衣纹/下摆**，
     不是脸（脸是低梯度平滑区）→ caocao 裁到 y=386/730（下半身）

正解：古代人物画像「头必在上部」这个先验极强，所以
  **只做一件事：往下找第一个有内容的行，从那里开始裁正方形。**
  x 用该带内的内容中心居中（图比正方形宽时才生效）。
自检：裁切区上边缘必须有内容（否则说明上部留白没去干净）。
"""
import os, glob, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

SRC = r'E:/Deepseekdb/assets/portraits/pd_src'
DST = r'E:/Deepseekdb/assets/portraits'
BAK = r'E:/Deepseekdb/assets/portraits/_ai_backup'
TMP = r'E:/Deepseekdb/.workbuddy/tmp'
SIDE = 512
ENH = (1.10, 1.16, 1.12)
AW = 240
SEARCH = 0.30   # 顶部留白只在图像上部 30% 内搜索，避免"第一个内容行"跑到画面中部


def edges(im):
    W, H = im.size
    g = im.convert('L').resize((AW, max(1, int(H * AW / W))), Image.LANCZOS)
    a = np.asarray(g, dtype=np.float32)
    a = a - a.mean()
    gx = np.zeros_like(a); gy = np.zeros_like(a)
    gx[:, 1:-1] = a[:, 2:] - a[:, :-2]
    gy[1:-1, :] = a[2:, :] - a[:-2, :]
    return np.sqrt(gx ** 2 + gy ** 2)


def first_content_row(ry, limit):
    """在 [0, limit) 内找第一个显著内容行；找不到返回 0"""
    thr = max(ry.mean() * 0.55, ry.mean() + 0.15 * ry.std())
    for i in range(min(limit, len(ry))):
        if ry[i] > thr:
            # 要求后续 3 行也超阈（抗单行噪点）
            if all(ry[j] > thr * 0.7 for j in range(i, min(i + 3, len(ry)))):
                return i
    return 0


def longest_band(prof, thr):
    on = prof > thr
    idx = np.where(on)[0]
    if idx.size == 0:
        return 0, len(prof) - 1
    segs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p <= 6: p = i
        else: segs.append((s, p)); s = p = i
    segs.append((s, p))
    segs.sort(key=lambda t: (-(t[1] - t[0]), t[0]))
    return segs[0]


def main():
    os.makedirs(BAK, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, '*.jpg')))
    rows, warn = [], []

    for f in files:
        key = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGB')
        W, H = im.size
        e = edges(im); eh, ew = e.shape
        ry = e.mean(axis=1)

        # ① 顶部留白 → y0
        fr = first_content_row(ry, int(eh * SEARCH))
        y0 = int(fr / eh * H)
        y0 = max(0, min(y0, H - 48))

        # ② 正方形边长：全宽优先
        side = int(min(W, H - y0))
        if side < 48: side = min(W, H); y0 = 0

        # ③ x 居中（用该带的列密度中心）
        x0 = 0
        if side < W:
            band = e[int(fr):min(eh, int((y0 + side) / H * eh)), :]
            if band.shape[0] < 3: band = e[fr:fr + 3, :]
            rx = band.mean(axis=0)
            tx = rx.mean() + 0.30 * rx.std()
            bx0, bx1 = longest_band(rx, tx)
            ccx = (bx0 + bx1 + 1) / 2 / ew * W
            x0 = int(round(ccx - side / 2))
            x0 = max(0, min(x0, W - side))

        cut = im.crop((x0, y0, x0 + side, y0 + side))

        # ④ 自检：裁切区上 1/5 必须有内容（顶白已去净）
        et = edges(cut)
        top = et[:max(2, et.shape[0] // 5), :]
        dens = float(et.mean() / (e.mean() + 1e-6))
        top_ok = float(top.mean()) > float(et.mean()) * 0.35
        if not top_ok:
            warn.append('%s 裁切区顶部仍是留白（上方 1/5 密度不足）' % key)
        if dens < 0.55:
            warn.append('%s 裁切区整体密度仅整图 %.0f%%' % (key, dens * 100))

        big = cut.resize((SIDE, SIDE), Image.LANCZOS)
        c, co, sh = ENH
        big = ImageEnhance.Contrast(big).enhance(c)
        big = ImageEnhance.Color(big).enhance(co)
        big = ImageEnhance.Sharpness(big).enhance(sh)

        out = os.path.join(DST, 'hero_%s.webp' % key)
        if os.path.exists(out):
            b = os.path.join(BAK, 'hero_%s.webp' % key)
            if not os.path.exists(b): shutil.copy2(out, b)
        big.save(out, 'WEBP', quality=90, method=5)
        rows.append(dict(key=key, src=im, cut=big, dens=dens, top=top_ok,
                         kb=os.path.getsize(out) / 1024, size=(W, H),
                         crop=(x0, y0, side)))
        print('%-14s %4dx%-5d y0=%3d(%2.0f%%) 边长%3d  x0=%3d  密度%3.0f%%  顶%4s  %5.1fKB' % (
            key, W, H, y0, y0 / H * 100, side, x0, dens * 100,
            'ok' if top_ok else '空', rows[-1]['kb']))

    if rows:
        CW, GAP, HDR, COLS = 132, 10, 22, 4
        cellw = CW * 2 + GAP * 3; rh = CW + HDR + GAP
        rn = (len(rows) + COLS - 1) // COLS
        cv = Image.new('RGB', (COLS * cellw + GAP, rn * rh + GAP), (24, 26, 30))
        dr = ImageDraw.Draw(cv)
        try: fnt = ImageFont.truetype(r'C:/Windows/Fonts/msyh.ttc', 13)
        except Exception: fnt = ImageFont.load_default()
        for i, r in enumerate(rows):
            cx = GAP + (i % COLS) * cellw; cy = GAP + (i // COLS) * rh
            s = r['src'].copy(); s.thumbnail((CW, CW), Image.LANCZOS)
            cv.paste(s, (cx + (CW - s.width) // 2, cy + HDR + (CW - s.height) // 2))
            dr.rectangle([cx, cy + HDR, cx + CW, cy + HDR + CW], outline=(70, 74, 80))
            cv.paste(r['cut'].resize((CW, CW), Image.LANCZOS), (cx + CW + GAP, cy + HDR))
            dr.text((cx, cy + 4), '%s %dx%d' % (r['key'], r['size'][0], r['size'][1]),
                    fill=(230, 230, 230), font=fnt)
            dr.text((cx + CW + GAP, cy + 4), 'y0=%d %s' % (r['crop'][1], 'ok' if r['top'] else 'BAD'),
                    fill=(150, 220, 150) if r['top'] else (240, 150, 150), font=fnt)
        p = os.path.join(TMP, 'pd_gallery.png')
        cv.save(p); print('\n对照拼图 → %s' % p)

    print('成功 %d 张' % len(rows))
    if warn:
        print('⚠ %d 条：' % len(warn))
        for w in warn: print('   ' + w)


main()
