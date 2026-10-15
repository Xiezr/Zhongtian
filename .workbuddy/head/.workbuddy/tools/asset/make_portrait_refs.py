# -*- coding: utf-8 -*-
"""将领肖像 · 参考图套件生成。

用途：为「单文本框 + ≤6 参考图」的生图工具准备上传素材，产出到
      `.workbuddy/tmp/avatars/refs/`：

  · ref-<id>.png        推荐 / 备选参考图的**铺底版**（透明底 → #f2f0ee 浅暖灰底，
                        防止工具把透明区域渲染成黑底、并暗示目标背景色）
  · pool-refsheet.png   全池 40 张一览（金框 = 推荐 6 张），供人工复核
  · README.md           说明（选择口径 / 换图方法）

选择口径（2026-09-16 定量筛选，详见 docs/AI肖像生成清单.md §2.5）：
  1. 标准度 = 与全池 H/S/L 均值的归一化距离（越小越接近池的"平均长相"）
  2. 锐度   = Laplacian 均值，要求不低于全池 25 分位（防糊图）
  3. 边缘   = 外圈 2% 带内 alpha 残留 ≈ 0（防脏边）
  推荐 6 = 男 m06/m08/m09 + 女 f06/f08/f10（男女各前 3）
  备选   = m05/m12/f05/f20（随时可换，换完重跑本脚本即可）

用法：
  <venv python> make_portrait_refs.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = 'E:/Deepseekdb/assets/portraits/pool'
OUT = 'E:/Deepseekdb/.workbuddy/tmp/avatars/refs'
BG = (242, 240, 238)  # #f2f0ee：目标浅暖灰

REC = ['m06', 'm08', 'm09', 'f06', 'f08', 'f10']
ALT = ['m05', 'm12', 'f05', 'f20']


def flatten(name):
    """读 pool/<name>.webp（透明底），铺到浅暖灰底上，返回 RGB 图。"""
    im = Image.open(os.path.join(BASE, name + '.webp')).convert('RGBA')
    bg = Image.new('RGB', im.size, BG)
    bg.paste(im, (0, 0), im)
    return bg


def font(sz):
    for p in (r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf'):
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    os.makedirs(OUT, exist_ok=True)

    # 1) 铺底版：推荐 6 + 备选 4
    for name in REC + ALT:
        im = flatten(name)
        im.save(os.path.join(OUT, 'ref-%s.png' % name), 'PNG')
    print('铺底版 %d 张 → ref-*.png' % len(REC + ALT))

    # 2) 全池一览（金框 = 推荐）
    names = ['m%02d' % i for i in range(1, 21)] + ['f%02d' % i for i in range(1, 21)]
    cell, pad, cols, top = 150, 10, 8, 46
    rows = (len(names) + cols - 1) // cols
    W = cols * (cell + pad) + pad
    H = top + rows * (cell + pad + 18) + pad
    sheet = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(sheet)
    d.text((pad + 4, 12), '池 40 张 · 金框 = 推荐参考图 6 张（其余可作备选）',
           font=font(18), fill=(58, 48, 32))
    f = font(13)
    for i, name in enumerate(names):
        cx = pad + (i % cols) * (cell + pad)
        cy = top + (i // cols) * (cell + pad + 18)
        sheet.paste(flatten(name).resize((cell, cell), Image.LANCZOS), (cx, cy))
        if name in REC:
            d.rectangle([cx - 3, cy - 3, cx + cell + 3, cy + cell + 3],
                        outline=(196, 154, 40), width=4)
        tag = name + ('  ★' if name in REC else '')
        d.text((cx + 2, cy + cell + 2), tag, font=f,
               fill=(74, 62, 44) if name in REC else (110, 100, 86))
    sheet.save(os.path.join(OUT, 'pool-refsheet.png'), 'PNG')
    print('一览图 %dx%d → pool-refsheet.png' % sheet.size)

    # 3) README（可追溯性）
    readme = (
        '# 参考图套件（将领肖像）\n\n'
        '- **用途**：喂给「单文本框 + ≤6 参考图」的生图工具，做风格一致性锚点；**整批 100 张不换**。\n'
        '- **上传用**：`ref-m06/08/09/f06/08/10.png`（推荐 6 张，铺底版）；'
        '备选 `ref-m05/m12/f05/f20.png` 可随时替换。\n'
        '- **复核用**：`pool-refsheet.png`（全池 40 张，金框 = 推荐）。\n'
        '- **选择口径**：标准度（离池均值最近）+ 锐度（≥25 分位）+ 边缘无残留；详见 `docs/AI肖像生成清单.md` §2.5。\n'
        '- **重新生成**：改 `make_portrait_refs.py` 顶部的 REC/ALT 名单后重跑，'
        '本目录为过程产物，随 tmp 清理无妨。\n'
    )
    with open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8') as fp:
        fp.write(readme)
    print('README.md')
    print('OUT =', OUT)


if __name__ == '__main__':
    main()
