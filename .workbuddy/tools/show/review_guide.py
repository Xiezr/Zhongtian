# -*- coding: utf-8 -*-
"""v89.42 定稿验收图：改前/改后 + 2x 放大 + 7 块贴图 + 中文说明，合成单图。
输出: _v8942_guide.png
"""
import os, json
from PIL import Image, ImageDraw, ImageFont

BASE = r"C:\Users\18811\WorkBuddy\2026-09-19-02-16-20"
BEFORE = os.path.join(BASE, "_shot_before_raw.png")
AFTER = os.path.join(BASE, "_shot_after_raw.png")
GRID = os.path.join(BASE, "_shot_after_grid.json")
TILES = os.path.join(BASE, "_v8942_tiles.png")
OUT = os.path.join(BASE, "_v8942_guide.png")

W, M, GAP = 1392, 20, 32
BG = (24, 24, 27)
CREAM = (238, 230, 198)
DIM = (172, 165, 146)
GOLD = (232, 190, 110)

F_TITLE = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 28)
F_SUB   = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 17)
F_CAP   = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 19)
F_BUL   = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 22)
F_FOOT  = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 16)

vb = Image.open(BEFORE).convert("RGB")
va = Image.open(AFTER).convert("RGB")

def fit(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)

PW = 660
vb_s, va_s = fit(vb, PW), fit(va, PW)

# 缩放中心：取第一个带安全边距的湖泊格（与对比图同逻辑）
g = json.load(open(GRID, encoding="utf-8"))
v = g["view"]; ox, oy, HW, HH = v["ox"], v["oy"], v["HW"], v["HH"]
zoom = None
for t in g["tiles"]:
    if t["terrain"] == "lake":
        cx = ox + (t["gx"] - t["gy"]) * HW
        cy = oy + (t["gx"] + t["gy"]) * HH
        if 230 < cx < vb.width - 230 and 170 < cy < vb.height - 130:
            zoom = (cx, cy); break
if zoom is None:
    zoom = (vb.width / 2, vb.height / 2)
zx = int(min(max(zoom[0], 170), vb.width - 170))
zy = int(min(max(zoom[1], 100), vb.height - 100))
box = (zx - 165, zy - 94, zx + 165, zy + 94)
zb = vb.crop(box).resize((660, 376), Image.NEAREST)
za = va.crop(box).resize((660, 376), Image.NEAREST)

tiles = Image.open(TILES).convert("RGB")
tiles_s = tiles.resize((round(tiles.width * 1.4), round(tiles.height * 1.4)), Image.LANCZOS)

bullets = [
    "① 平地：加了一层很淡的草纹（原来是素色底）——地图不再显得空",
    "② 湖泊：从灰蒙蒙变成深蓝水面＋波纹",
    "③ 森林／山地／沼泽：明暗层次更清楚，贴近参考图的复古像素质感",
    "④ 全图：每格有轻微镜像变化，避免「复读机式重复」；整体为老三国的复古哑光色",
]
FOOT = "附注：贴图各约 100KB（旧写实版约 1.4MB/张），由裁切流水线 tools/asset/crop_terrain.py 生成，可复跑核验。"

H = 82
H += 28 + vb_s.height
H += 24 + 28 + 376
H += 24 + 28 + tiles_s.height
H += 24 + len(bullets) * 37 + 18 + 30 + M

sheet = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(sheet)

d.text((M, 14), "野地地图改版 v89.42 · 定稿验收图", font=F_TITLE, fill=CREAM)
d.text((M, 54), "同一张地图、同一视角（种子锁定）；左侧＝改前，右侧＝改后", font=F_SUB, fill=DIM)
d.line((M, 84 - 4, W - M, 84 - 4), fill=(72, 72, 76), width=1)

y = 82
d.text((M, y + 3), "改前 · v89.40（无贴图）", font=F_CAP, fill=DIM)
d.text((M + PW + GAP, y + 3), "改后 · v89.42（即梦贴图 ×7）", font=F_CAP, fill=GOLD)
y += 28
sheet.paste(vb_s, (M, y)); sheet.paste(va_s, (M + PW + GAP, y))
y += vb_s.height + 24

d.text((M, y + 3), "改前 · 2 倍放大", font=F_CAP, fill=DIM)
d.text((M + PW + GAP, y + 3), "改后 · 2 倍放大", font=F_CAP, fill=GOLD)
y += 28
sheet.paste(zb, (M, y)); sheet.paste(za, (M + PW + GAP, y))
y += 376 + 24

cap = "素材来源：从即梦参考图裁出的 7 块地形贴图（≈ 游戏内显示尺寸）"
tw = d.textlength(cap, font=F_CAP)
d.text(((W - tw) / 2, y + 3), cap, font=F_CAP, fill=CREAM)
y += 28
sheet.paste(tiles_s, ((W - tiles_s.width) // 2, y))
y += tiles_s.height + 24

for ln in bullets:
    mk, rest = ln[0], ln[1:].lstrip()
    d.text((M, y), mk, font=F_BUL, fill=GOLD)
    mw = d.textlength(mk, font=F_BUL)
    d.text((M + mw + 8, y), rest, font=F_BUL, fill=CREAM)
    y += 37

y += 6
d.line((M, y, W - M, y), fill=(72, 72, 76), width=1)
y += 8
d.text((M, y), FOOT, font=F_FOOT, fill=DIM)

sheet.save(OUT)
print("OK %s (%dx%d)" % (OUT, sheet.width, sheet.height))
