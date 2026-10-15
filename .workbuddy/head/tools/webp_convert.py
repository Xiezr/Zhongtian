# -*- coding: utf-8 -*-
"""把工具输出的 PNG(带 alpha) 转回 WebP(lossless)，保持透明底。
独立脚本，由 normalize_portraits.py 调用，避免内联字符串语法坑。
用法: python webp_convert.py <src_png> <dst_webp>
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
if im.mode != "RGBA":
    im = im.convert("RGBA")
im.save(dst, "WEBP", lossless=True)
print(dst, im.mode, im.size)
