# -*- coding: utf-8 -*-
"""
build-assets.py — 把原有素材加工成新废土能直接用的小图

为什么要有这一步：
  原素材是 512²/1024² 的成品图，白的白、大的大。
  地形是航拍照片（直接缩），单位/建筑是白底立绘（要抠掉白底）。
  跑一次，生成 new-wasteland/assets/ 下的全部图片。

用法：
  python tools/build-assets.py
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                    # new-wasteland/
SRC = os.path.join(os.path.dirname(ROOT), 'assets', 'icons', 'ui')
OUT_T = os.path.join(ROOT, 'assets', 'terrain')
OUT_I = os.path.join(ROOT, 'assets', 'icon')

# 地形：直接缩成 128 的小照片
TERRAIN = [
    'terrain_plain', 'terrain_caoyuan', 'terrain_forest',
    'terrain_hill', 'terrain_lake', 'terrain_desert', 'terrain_zhaoze',
]

# 单位 / 建筑：白底立绘，要抠
CUTOUT = [
    'banche', 'fujiche', 'yunshu', 'buxingji', 'dunwei', 'daodanche', 'wuzhi', 'zhuzhan',
    'paojiban', 'zhongjiqiang', 'kuanglie', 'dianci', 'huopao', 'wuren', 'taitan', 'guidaopao',
    'zhencha',
    'yizhan', 'cangku', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital',
]


def key_white(img, near=236, soft=210):
    """把接近纯白的像素变透明，边缘做一点羽化，避免锯齿。"""
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mn = min(r, g, b)
            if mn >= near:
                px[x, y] = (r, g, b, 0)
            elif mn >= soft:
                # 236 -> 0，210 -> 255 的线性过渡
                na = int(255 * (near - mn) / float(near - soft))
                px[x, y] = (r, g, b, max(0, min(255, na)))
    return img


def crop_content(img, pad=4):
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(img.width, x1 + pad); y1 = min(img.height, y1 + pad)
    return img.crop((x0, y0, x1, y1))


def main():
    if not os.path.isdir(SRC):
        print('找不到素材目录: ' + SRC)
        return 1
    os.makedirs(OUT_T, exist_ok=True)
    os.makedirs(OUT_I, exist_ok=True)

    print('地形（缩成 128 的小照片）')
    for name in TERRAIN:
        src = os.path.join(SRC, 'ai_%s.png' % name)
        if not os.path.exists(src):
            print('  跳过（缺图）: ' + name)
            continue
        im = Image.open(src).convert('RGB').resize((128, 128), Image.LANCZOS)
        dst = os.path.join(OUT_T, '%s.jpg' % name.replace('terrain_', ''))
        im.save(dst, 'JPEG', quality=84, optimize=True)
        print('  %-16s %5.1f KB' % (os.path.basename(dst), os.path.getsize(dst) / 1024.0))

    print('立绘（抠白底 + 裁边 + 128）')
    for name in CUTOUT:
        src = os.path.join(SRC, 'ai_%s.png' % name)
        if not os.path.exists(src):
            print('  跳过（缺图）: ' + name)
            continue
        im = Image.open(src)
        im = key_white(im)
        im = crop_content(im)
        im.thumbnail((128, 128), Image.LANCZOS)
        dst = os.path.join(OUT_I, '%s.png' % name)
        im.save(dst, 'PNG', optimize=True)
        print('  %-16s %5.1f KB  %s' % (os.path.basename(dst), os.path.getsize(dst) / 1024.0, im.size))

    total = 0
    for d in (OUT_T, OUT_I):
        for f in os.listdir(d):
            total += os.path.getsize(os.path.join(d, f))
    print('\n合计 %.1f KB' % (total / 1024.0))
    return 0


if __name__ == '__main__':
    sys.exit(main())
