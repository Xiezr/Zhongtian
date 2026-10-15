# -*- coding: utf-8 -*-
"""v89.107 建筑图标重绘 · 第一步：把 4 张原图拼成 2×2 图集（白底），
交给图生图重绘（同角度同轮廓、只换材质与颜色）。
"""
import os, sys
from PIL import Image

R = r'E:/Deepseekdb/assets/icons/ui'
BAK = os.path.join(R, '_gold_backup')
OUT = r'E:/Deepseekdb/.workbuddy/tmp/atlas'

# v89.237：_gold_backup 已随素材清理移出（可恢复）——缺席时给出明确出路，不抛栈。
if not os.path.isdir(BAK):
    sys.exit('[v89.237] _gold_backup 不在素材区（17:41 清理移出）。\n'
             '  如需重拼图集源，先恢复其一：\n'
             '    git checkout HEAD -- assets/icons/ui/_gold_backup\n'
             '    或 .workbuddy/backup/v89237-素材/gold_backup/ → assets/icons/ui/_gold_backup/')
os.makedirs(OUT, exist_ok=True)

# 四张一组（同族相邻，风格更易统一）：每格 512，画布 1024，留 12px 白缝
GROUPS = {
    'A': ['guanfu', 'honglusi', 'junying', 'chengqiang'],          # 官署 + 军事
    'B': ['xiaochang', 'fenghuotai', 'shuyuan', 'zhaoxianguan'],   # 军事 + 文教
    'C': ['minfang', 'kezhan', 'cangku', 'majiu'],                 # 民居 + 仓廪
    'D': ['shichang', 'tiejiangpu', 'gongjiangzuofang', 'yizhan'], # 工商 + 驿传
}
CELL, GUT = 512, 12


def tile(im, size):
    """等比缩到 size 内并居中（透明→白底）"""
    im = im.convert('RGBA')
    k = min(size / im.width, size / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new('RGB', (size, size), (255, 255, 255))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


for g, ids in GROUPS.items():
    W = CELL * 2 + GUT
    canvas = Image.new('RGB', (W, W), (255, 255, 255))
    for i, bid in enumerate(ids):
        im = Image.open(os.path.join(BAK, 'ai_%s.png' % bid))
        canvas.paste(tile(im, CELL), ((i % 2) * (CELL + GUT), (i // 2) * (CELL + GUT)))
    p = os.path.join(OUT, 'atlas_%s_src.png' % g)
    canvas.save(p)
    print('%s: %s → %s' % (g, ' '.join(ids), p))
