# -*- coding: utf-8 -*-
"""头像图集体检 + 切分 + 抠底。

v1 的判据误伤了胸像：要求"四边留 2% 边距"，但**头肩像本来就纵向铺满**
（头顶到胸口占满象限高度），于是 6 张被误判为"串格"。
v2 调整：
  · 纵向触边 = 正常（胸像特性），只在**横向**触边时警告
  · 背景判据从"min ≥ 238"放宽到"min ≥ 222"（浅灰米底也能用，
    因为抠底靠的是"与边缘同色连通"，不依赖纯白）
  · 切分时四边内缩 2%，避免把邻格的边缘切进来

抠底用**连通域洪水填充**而不是全局颜色距离：
只把「与图像边缘相连 且 颜色接近边缘背景」的像素设为透明。
人像内部的浅色（白衣、玉饰）不与边缘连通，因此不会被误抠 ——
这正是指标图标的 matte.js（全局距离）不能直接用于人像的原因。
"""
import sys, os, glob
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

POOL = r'E:/Deepseekdb/assets/portraits/pool'
TOL = 46          # 背景色容差（RGB 欧氏距离）
INSET = 0.02      # 四边内缩比例
AW = 256          # 连通性分析尺度（v43：128 → 256，边缘更精细，锯齿更少）


def quadrant_bg(q):
    a = np.asarray(q.convert('RGB').resize((AW, AW), Image.LANCZOS), dtype=np.float32)
    k = 8
    corners = np.concatenate([a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
                              a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3)])
    return a, np.median(corners, axis=0)


def flood_bg(a, bg):
    """返回「与边缘连通且接近背景色」的像素掩码（在 AW×AW 上）"""
    cand = np.sqrt(((a - bg) ** 2).sum(axis=2)) < TOL
    h, w = cand.shape
    vis = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not vis[y, x]:
                vis[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not vis[y, x]:
                vis[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = True; q.append((ny, nx))
    return vis


def cut_bg(q):
    """把背景抠成透明，返回 RGBA 图（尺寸不变）。

    v43 精修两处（老板："边界再扣精细一点"）：
      · mask 分析尺度 128 → 256，边缘更贴合、锯齿更少
      · 上采样后先 **MinFilter(3) 腐蚀 1px** 再羽化 ——
        背景色会在人像轮廓外留一圈"描边"，纯羽化只是把它糊开，
        腐蚀掉最外 1px 才是真正去掉它。
    """
    a, bg = quadrant_bg(q)
    mask = flood_bg(a, bg)
    m = Image.fromarray((mask * 255).astype(np.uint8), 'L').resize(q.size, Image.LANCZOS)
    m = m.filter(ImageFilter.MinFilter(3))
    m = m.filter(ImageFilter.GaussianBlur(0.7))
    out = q.convert('RGBA')
    al = np.asarray(out).copy()
    al[:, :, 3] = 255 - np.asarray(m)
    return Image.fromarray(al, 'RGBA'), mask.mean()


def tight_crop(rgba, pad=0.035):
    """按人像实际范围收紧并居中，让每张头像的"脸"大小一致。
    否则抠完直接显示，有的占满、有的只占六成，一列头像会参差不齐。"""
    al = np.asarray(rgba)[:, :, 3]
    ys, xs = np.where(al > 12)
    if not len(ys):
        return rgba
    sub = rgba.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    S = 512
    inner = int(S * (1 - 2 * pad))
    sub.thumbnail((inner, inner), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(sub, ((S - sub.width) // 2, (S - sub.height) // 2), sub)
    return out


def quad_stats(q):
    a, bg = quadrant_bg(q)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    m = d > TOL
    rows, cols = m.sum(axis=1), m.sum(axis=0)
    ry = np.where(rows > AW * 0.03)[0]
    rx = np.where(cols > AW * 0.03)[0]
    if ry.size == 0 or rx.size == 0:
        return dict(empty=True, bg=bg)
    return dict(empty=False, bg=bg, fill=float(m[ry[0]:ry[-1] + 1, rx[0]:rx[-1] + 1].mean()),
                bx0=rx[0] / AW, bx1=(rx[-1] + 1) / AW, by0=ry[0] / AW, by1=(ry[-1] + 1) / AW)


def report(path, quiet=False):
    im = Image.open(path)
    W, H = im.size
    hw, hh = W // 2, H // 2
    if not quiet:
        print('图集 %s  %dx%d' % (os.path.basename(path), W, H))
        print('%-5s %-16s %-26s %-7s %s' % ('象限', '背景色', '内容bbox(x0,y0,x1,y1)', '占格', '判定'))
        print('-' * 92)
    ok = True
    for i in range(4):
        q = im.crop(((i % 2) * hw, (i // 2) * hh, (i % 2) * hw + hw, (i // 2) * hh + hh))
        s = quad_stats(q)
        tag = ['左上', '右上', '左下', '右下'][i]
        if s['empty']:
            if not quiet:
                print('%-5s 空白 ✗' % tag)
            ok = False
            continue
        flags, warn = [], []
        if min(s['bg']) < 222:
            flags.append('背景过暗')
        if s['fill'] < 0.26:
            flags.append('人物过小')
        if s['bx0'] < 0.015 or s['bx1'] > 0.985:
            warn.append('横向贴边')
        if s['by0'] < 0.015 or s['by1'] > 0.985:
            warn.append('纵向铺满(胸像正常)')
        if flags:
            ok = False
        if not quiet:
            print('%-5s %-16s %-26s %-7.2f %s%s' % (
                tag, ','.join('%d' % v for v in s['bg']),
                '(%.2f,%.2f,%.2f,%.2f)' % (s['bx0'], s['by0'], s['bx1'], s['by1']), s['fill'],
                '✓' if not flags else '✗ ' + '、'.join(flags),
                '  ⚠ ' + '、'.join(warn) if warn else ''))
    return ok


def split(path, sex, start):
    os.makedirs(POOL, exist_ok=True)
    im = Image.open(path).convert('RGB')
    W, H = im.size
    hw, hh = W // 2, H // 2
    px, py = int(hw * INSET), int(hh * INSET)
    n = 0
    for qi in range(4):
        x0, y0 = (qi % 2) * hw + px, (qi // 2) * hh + py
        q = im.crop((x0, y0, x0 + hw - 2 * px, y0 + hh - 2 * py)).resize((512, 512), Image.LANCZOS)
        q, ratio = cut_bg(q)
        q = tight_crop(q)                      # v43：按人像收紧居中，脸的大小一致
        idx = start + n
        f = '%s/%s%02d.webp' % (POOL, sex, idx)
        q.save(f, 'WEBP', quality=90, method=5)
        print('  → %s  抠底 %.0f%%  (%.1f KB)' % (os.path.basename(f), ratio * 100, os.path.getsize(f) / 1024))
        n += 1
    return n


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'batch'
    if mode == 'check':
        sys.exit(0 if all(report(f) for f in sys.argv[2:]) else 1)
    if mode == 'split':
        if not report(sys.argv[2]):
            print('体检未通过，拒绝切分'); sys.exit(1)
        split(sys.argv[2], sys.argv[3], int(sys.argv[4]))
    else:                                  # batch：全部重切（覆盖旧结果，保持口径一致）
        files = sorted(glob.glob(r'E:/Deepseekdb/.workbuddy/tmp/avatars/*.png'))
        # v43：**只取前 10 张**（5 男 + 5 女）。补生成的那张排在后面，
        # 若按"i<5 为男、否则为女"分流，它会挂到女性编号上多切 4 张。
        files = files[:10]
        bad = []
        for i, f in enumerate(files):
            sex = 'm' if i < 5 else 'f'
            start = 1 + i * 4 if sex == 'm' else 1 + (i - 5) * 4
            print('=== %s → %s%02d~%s%02d ===' % (os.path.basename(f)[:46], sex, start, sex, start + 3))
            if report(f):
                split(f, sex, start)
            else:
                bad.append(os.path.basename(f)); print('  ✗ 跳过')
            print()
        ps = sorted(glob.glob(POOL + '/*.webp'))
        print('落库：男 %d / 女 %d' % (len([p for p in ps if 'm' in os.path.basename(p)[0]]),
                                      len([p for p in ps if os.path.basename(p)[0] == 'f'])))
        if bad:
            print('⚠ 跳过 %d 张：%s' % (len(bad), ', '.join(bad)))
