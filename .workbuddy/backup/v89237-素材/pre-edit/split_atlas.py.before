# -*- coding: utf-8 -*-
"""v89.107 建筑图标重绘 · 第二步：图集 → 体检 → 切分 → 抠底 → 统一裁切 → 出对照图。

抠底用**连通域洪水填充**（只抠"与边缘连通"的白底）—— 全局颜色距离会把建筑
内部的浅色（白墙、石基）一起抠成洞（管线技能 §三）。

用法：python split_atlas.py <图集png> <A|B|C|D> [--install]
"""
import os, sys, math
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

R = r'E:/Deepseekdb/assets/icons/ui'
BAK = os.path.join(R, '_gold_backup')
WORK = r'E:/Deepseekdb/.workbuddy/tmp/atlas'
OUTDIR = os.path.join(WORK, 'icons')
os.makedirs(OUTDIR, exist_ok=True)

GROUPS = {
    'A': ['guanfu', 'honglusi', 'junying', 'chengqiang'],
    'B': ['xiaochang', 'fenghuotai', 'shuyuan', 'zhaoxianguan'],
    'C': ['minfang', 'kezhan', 'cangku', 'majiu'],
    'D': ['shichang', 'tiejiangpu', 'gongjiangzuofang', 'yizhan'],
}
TOL = 46          # 背景距离阈值
PAD = 0.035       # 统一裁切留白
SIZE = 512


def cell_of(a, i):
    """四等分 + 四边内缩 2%"""
    h, w = a.shape[:2]
    ch, cw = h // 2, w // 2
    y0, x0 = (i // 2) * ch, (i % 2) * cw
    m = int(round(ch * 0.02))
    return a[y0 + m:y0 + ch - m, x0 + m:x0 + cw - m]


def flood_bg(rgb):
    """从四条边界洪水填充：只有与边缘连通的近背景像素才算背景"""
    h, w = rgb.shape[:2]
    border = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    cand = np.sqrt(((rgb - bg) ** 2).sum(axis=2)) < TOL
    vis = np.zeros_like(cand)
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
    return vis, bg


def hue_spread(rgba):
    """图内色相离散度（与 diag_bldg_materials.py 同口径）"""
    a = np.asarray(rgba, dtype=np.float32) / 255.0
    m = a[:, :, 3] > 0.125      # ⚠ alpha 已归一化到 0~1，别写 32
    r, g, b = a[:, :, 0][m], a[:, :, 1][m], a[:, :, 2][m]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    l = (mx + mn) / 2
    s = np.where(d < 1e-6, 0, d / np.maximum(1e-6, 1 - np.abs(2 * l - 1)))
    sel = s > 0.12
    if sel.sum() < 20:
        return 0.0, 0.0
    hh = np.zeros_like(mx)
    rmax = (mx == r); gmax = (mx == g) & ~rmax
    hh[rmax] = ((g - b)[rmax] / np.maximum(d, 1e-6)[rmax]) % 6
    hh[gmax] = ((b - r)[gmax] / np.maximum(d, 1e-6)[gmax]) + 2
    hh[~rmax & ~gmax] = ((r - g)[~rmax & ~gmax] / np.maximum(d, 1e-6)[~rmax & ~gmax]) + 4
    hh = (hh * 60 + 360) % 360
    rad = np.radians(hh[sel])
    Rl = float(np.hypot(np.cos(rad).mean(), np.sin(rad).mean()))
    spread = math.degrees(math.sqrt(max(0.0, -2 * math.log(max(Rl, 1e-9)))))
    return spread, float(sel.mean())


def build_cell(rgb):
    vis, bg = flood_bg(rgb)
    alpha = np.where(vis, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')
    # 边缘精修：256 上算 → MinFilter 腐蚀 1px → 轻羽化
    small = img.resize((256, 256), Image.LANCZOS)
    small.putalpha(small.getchannel('A').filter(ImageFilter.MinFilter(3)))
    small.putalpha(small.getchannel('A').filter(ImageFilter.GaussianBlur(0.7)))
    img = small.resize((rgb.shape[1], rgb.shape[0]), Image.LANCZOS)
    # 统一裁切
    bb = img.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if not bb:
        return None, None, bg
    img = img.crop(bb)
    k = min((SIZE * (1 - 2 * PAD)) / img.width, (SIZE * (1 - 2 * PAD)) / img.height)
    img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(img, ((SIZE - img.width) // 2, (SIZE - img.height) // 2), img)
    return canvas, bb, bg


def main():
    path, g = sys.argv[1], sys.argv[2]
    ids = GROUPS[g]
    src = Image.open(path).convert('RGB')
    a = np.asarray(src, dtype=np.float32)
    bg_bright = float(np.median(a))
    print('图集 %s · %s · 背景亮度中位数 %.0f' % (os.path.basename(path), g, bg_bright))
    ok = True
    rows = []
    for i, bid in enumerate(ids):
        rgb = cell_of(a, i)
        icon, bb, bg = build_cell(rgb)
        if icon is None:
            print('  ✗ %-16s 空象限（AI 漏画）' % bid); ok = False; continue
        cov = (icon.getchannel('A').point(lambda v: 255 if v > 12 else 0).histogram()[255] / (SIZE * SIZE))
        sp, colored = hue_spread(icon)
        master_sp, _ = hue_spread(Image.open(os.path.join(BAK, 'ai_%s.png' % bid)))
        rows.append((bid, cov, sp, master_sp, colored))
        flag = '' if 0.26 <= cov <= 0.95 else '  ⚠ 占格异常'
        print('  %-16s 占格 %.0f%%  色散 %2.0f°（原图 %2.0f°）  彩像素 %.0f%%%s'
              % (bid, cov * 100, sp, master_sp, colored * 100, flag))
        icon.save(os.path.join(OUTDIR, 'ai_%s.png' % bid))
    sp_avg = sum(r[2] for r in rows) / max(1, len(rows))
    m_avg = sum(r[3] for r in rows) / max(1, len(rows))
    print('  平均色散：新 %.0f° vs 原图 %.0f°（越大=材质层次越丰富）' % (sp_avg, m_avg))
    if '--install' in sys.argv and ok:
        import shutil
        for bid, *_ in rows:
            src_p, dst_p = os.path.join(OUTDIR, 'ai_%s.png' % bid), os.path.join(R, 'ai_%s.png' % bid)
            shutil.copyfile(dst_p, os.path.join(WORK, 'prev_ai_%s.png' % bid))
            shutil.copyfile(src_p, dst_p)
        print('已安装 %d 张到 %s（旧图备份在 %s）' % (len(rows), R, WORK))


if __name__ == '__main__':
    main()
