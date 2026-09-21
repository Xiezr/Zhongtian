# -*- coding: utf-8 -*-
"""v89.42b 验收指南：v89.42a(推翻) vs v89.42b(重做) + 2x 放大 + 7 块新贴图，合成单图。
输出: _v8942b_guide.png
"""
import os, json
from PIL import Image, ImageDraw, ImageFont

BASE = r"C:\Users\18811\WorkBuddy\2026-09-19-02-16-20"
BEFORE = os.path.join(BASE, "_shot_after_raw.png")      # v89.42a（推翻）
AFTER = os.path.join(BASE, "_shot_v42c_raw.png")        # v89.42b（重做 · 终）
GRID = os.path.join(BASE, "_shot_v42c_grid.json")
ASSETS = r"E:\Deepseekdb\assets\icons\ui"
OUT = os.path.join(BASE, "_v8942b_guide.png")

W, M, GAP = 1392, 20, 32
BG = (24, 24, 27); CREAM = (238, 230, 198); DIM = (172, 165, 146); GOLD = (232, 190, 110)
F_TITLE = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 28)
F_SUB = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 17)
F_CAP = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 19)
F_BUL = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 22)
F_FOOT = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 16)
F_TN = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 15)

vb = Image.open(BEFORE).convert("RGB")
va = Image.open(AFTER).convert("RGB")

def fit(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)

PW = 660
vb_s, va_s = fit(vb, PW), fit(va, PW)

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

# ---- 7 块贴图条（直接读线上素材，中心 45%×41% 条带 = 上屏窗口）----
CN = {"plain": "平地", "caoyuan": "草原", "zhaoze": "沼泽", "lake": "湖泊",
      "forest": "森林", "desert": "荒漠", "hill": "山地"}
ORDER = ["plain", "caoyuan", "zhaoze", "lake", "forest", "desert", "hill"]
TS, TGAP = 128, 62
strip = Image.new("RGB", (len(ORDER) * (TS + TGAP) - TGAP, TS + 26), BG)
sd = ImageDraw.Draw(strip)
for i, k in enumerate(ORDER):
    im = Image.open(os.path.join(ASSETS, "ai_terrain_%s.png" % k)).convert("RGB")
    w2, h2 = im.size
    band = im.crop((int(w2 * .275), int(h2 * .295), int(w2 * .725), int(h2 * .705)))
    x0 = i * (TS + TGAP)
    strip.paste(band.resize((TS, TS), Image.LANCZOS), (x0, 0))
    tw = sd.textlength(CN[k], font=F_TN)
    sd.text((x0 + (TS - tw) / 2, TS + 3), CN[k], font=F_TN, fill=DIM)

bullets = [
    "① 平地：不再强行调色——回到参考图本来的黄草色，与全图风格统一",
    "② 沼泽：换成浮萍泥沼（B 图真实湿地）；山地：换成岩石山体",
    "③ 七张全部出自 B/C 两张同源参考图，笔触光照一致（A 图弃用）",
    "④ 全部零后处理：源图什么样，上屏就什么样（旧版备份 tmp/terrain_v8942a/）",
]
FOOT = "附注：裁切流水线 tools/asset/crop_terrain.py（SPEC 表 v89.42b）可复跑核验；上图贴图条＝素材中心 45%×41% 条带（上屏窗口）。"

H = 82
H += 28 + vb_s.height
H += 24 + 28 + 376
H += 24 + 28 + strip.height
H += 24 + len(bullets) * 37 + 18 + 30 + M

sheet = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(sheet)

d.text((M, 14), "野地贴图重做 v89.42b · 验收指南", font=F_TITLE, fill=CREAM)
d.text((M, 54), "同一张地图、同一视角（种子锁定）；左侧＝上一版（推翻），右侧＝重做版", font=F_SUB, fill=DIM)
d.line((M, 80, W - M, 80), fill=(72, 72, 76), width=1)

y = 82
d.text((M, y + 3), "上一版 · v89.42a（含调色）", font=F_CAP, fill=DIM)
d.text((M + PW + GAP, y + 3), "重做版 · v89.42b（零调色）", font=F_CAP, fill=GOLD)
y += 28
sheet.paste(vb_s, (M, y)); sheet.paste(va_s, (M + PW + GAP, y))
y += vb_s.height + 24

d.text((M, y + 3), "上一版 · 2 倍放大", font=F_CAP, fill=DIM)
d.text((M + PW + GAP, y + 3), "重做版 · 2 倍放大", font=F_CAP, fill=GOLD)
y += 28
sheet.paste(zb, (M, y)); sheet.paste(za, (M + PW + GAP, y))
y += 376 + 24

cap = "素材一览：七张贴图的上屏条带（中心 45%×41%）"
tw = d.textlength(cap, font=F_CAP)
d.text(((W - tw) / 2, y + 3), cap, font=F_CAP, fill=CREAM)
y += 28
sheet.paste(strip, ((W - strip.width) // 2, y))
y += strip.height + 24

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
