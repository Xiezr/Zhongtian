# ============================================================
# ⛔ v89.225 已退役：族旗管线（本文件运行即退出，代码仅作历史追溯）。
#   沿革：v89.107 立 —— 老板第四次说"颜色很不对劲"后，族色编码改为
#         "小面积高饱和族旗"；本文件给 16 座建筑图标在右下角外侧画燕尾旗。
#   退役：v89.225 —— 老板令「建筑前边的带颜色棋子是什么，能否用地块颜色区分，
#         不然好突兀」：族色编码从"图标上的小旗"迁到"城内地块染色"
#         （js/data.js 的 DATA.SERIES[].plot + index.html 的 --ser-* 主题变量）。
#   已清：贴旗的 16 张图标由 gen/wasteland_batch.py（重切不画旗）重新导出。
#   防线：wasteland_batch.py 的 gate ③（逐张无旗校验）+ smoke §225。
# ============================================================
import io, re
# -*- coding: utf-8 -*-
"""v89.107 建筑图标 · 第三步：给每座建筑画一面**族旗**。

为什么走"旗"而不是"整体染色"：
  · 大面积染色 = 材质失真（老板连说三轮"颜色不对劲"）；
  · 小面积高饱和色块 = 天然可辨（红灯笼/朱旗挂灰墙上是常态），且**测量上可控**；
  · 旗是三国标配物件，不是"游戏色块"。

族旗色 = 由 DATA.SERIES[族].paint 提升饱和度/压缩明度得到（自动推导，不另抄表），
并**当场用 CIEDE2000 验两两 ≥15**（不够就按结果调这个文件的 boost 参数）。
"""
import os, sys, math, json, colorsys
# from PIL import Image, ImageDraw   # ⛔ v89.225 退役：绘图 import 移除（运行只打印退役说明）

# ⛔ v89.225 早退守卫（必须在一切解析/绘图代码之前 —— v89.226 复核修正）：
#   原守卫生效点在文件末尾（line 120），而模块级解析（读 DATA.SERIES[].flag）更早执行
#   —— flag 字段退役后，运行本文件会在解析段 assert 崩掉、而非打印退役说明。
#   本守卫提前到解析之前，保证「运行 = 打印退役说明并退出」。
if __name__ == '__main__':
    sys.exit('⛔ 本工具已于 v89.225 退役（族旗 → 地块染色）。\n'
             '   物证与防线：gen/wasteland_batch.py 的 gate ③（逐张无旗）· smoke §225。\n'
             '   下方代码为 v89.107 原始实现，只读参考，勿再执行。')

R = r'E:/Deepseekdb'
SRC = os.path.join(R, '.workbuddy/tmp/atlas/icons')     # 第二轮重绘（自然材质）
OUT = os.path.join(R, '.workbuddy/tmp/atlas/flagged')
os.makedirs(OUT, exist_ok=True)

# ============================================================
# 唯一来源：族归属与旗色都从 js/data.js 读（不另抄表 —— v89.106 的教训）
# ============================================================
DATA_JS = os.path.join(R, 'js', 'data.js')
_src = io.open(DATA_JS, encoding='utf-8').read()
SER_BLOCK = _src[_src.index('DATA.SERIES = {'):]
SER_BLOCK = SER_BLOCK[:SER_BLOCK.index('\n  };')]
FLAG = {}
SER_RE = re.compile(r"^    ([a-z]+):\s*\{.*?flag:\s*\{\s*h:\s*([\d.]+),\s*s:\s*([\d.]+),\s*l:\s*([\d.]+)\s*\}")
for line in SER_BLOCK.split('\n'):
    mf = SER_RE.match(line)
    if mf:
        FLAG[mf.group(1)] = (float(mf.group(2)), float(mf.group(3)), float(mf.group(4)))
assert len(FLAG) == 7, 'DATA.SERIES.flag 解析失败：%r' % FLAG

# 族归属：从 data.js 的 BUILDINGS（id/series 对）+ SERIES_OF 派生
BLD_BLOCK = _src[_src.index('DATA.BUILDINGS = {'):]
BLD_BLOCK = BLD_BLOCK[:BLD_BLOCK.index('\n  };')]
SER_OF = dict(re.findall(r"id: '([a-z]+)', series: '([a-z]+)'", BLD_BLOCK))


def hsl2rgb(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l / 100.0, s)
    return (round(r * 255), round(g * 255), round(b * 255))


def srgb2lab(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = f(c[0]), f(c[1]), f(c[2])
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    def h(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = h(x), h(y), h(z)
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]


def de00(c1, c2):
    A, B = srgb2lab(c1), srgb2lab(c2)
    L1, a1, b1, L2, a2, b2 = A + B
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p + 180) % 360 - 180
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hbp = (h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else ((h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def draw_flag(im, color):
    """燕尾旗：深木旗杆 + 横挑 + 三角燕尾布。位置固定在右下角外侧，不盖屋顶。"""
    W, H = im.size
    d = ImageDraw.Draw(im)
    px, py = int(W * 0.845), int(H * 0.60)          # 杆顶
    ph = int(H * 0.30)                               # 杆长
    pole_w = max(2, int(W * 0.012))
    wood = (92, 62, 38, 255)
    dark = tuple(int(c * 0.55) for c in color) + (255,)
    cloth = tuple(color) + (255,)
    # 杆
    d.rectangle([px, py, px + pole_w, py + ph], fill=wood)
    d.rectangle([px - int(pole_w * 0.6), py + ph, px + int(pole_w * 1.6), py + ph + int(pole_w * 0.8)], fill=wood)
    # 横挑 + 燕尾布（左侧飘出）
    fw, fh = int(W * 0.20), int(H * 0.115)
    top = py + int(H * 0.012)
    d.polygon([(px, top), (px - fw, top + int(fh * 0.10)),
               (px - fw, top + fh), (px - int(fw * 0.45), top + int(fh * 0.72)),
               (px, top + fh)], fill=cloth)
    # 布面下缘暗一档（有厚度感）
    d.line([(px - int(fw * 0.45), top + int(fh * 0.72)), (px, top + fh)], fill=dark, width=max(2, int(W * 0.006)))
    return im


if __name__ == '__main__':
    sys.exit('⛔ 本工具已于 v89.225 退役（族旗 → 地块染色）。\n'
             '   物证与防线：gen/wasteland_batch.py 的 gate ③（逐张无旗）· smoke §225。\n'
             '   下方代码为 v89.107 原始实现，只读参考，勿再执行。')

    # 1) 旗色两两可分（CIEDE2000）—— 不够就调 FLAG 再跑
    keys = sorted(FLAG)
    rgbs = {k: hsl2rgb(*FLAG[k]) for k in keys}
    mn, pair = 999, None
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            d = de00(rgbs[keys[i]], rgbs[keys[j]])
            if d < mn:
                mn, pair = d, (keys[i], keys[j])
    for k in keys:
        print('  旗色 %-6s h%3d s%.2f l%.0f  rgb%s' % (k, FLAG[k][0], FLAG[k][1], FLAG[k][2], rgbs[k]))
    print('  旗色两两最小 ΔE00 = %.1f（%s）%s' % (mn, '/'.join(pair), '✅' if mn >= 15 else '❌ 需调'))
    if mn < 15:
        sys.exit(1)
    # 2) 画旗
    n = 0
    for bid, ser in SER_OF.items():
        sp = os.path.join(SRC, 'ai_%s.png' % bid)
        if not os.path.exists(sp):
            print('  ⚠ 缺素材 ' + bid); continue
        im = Image.open(sp).convert('RGBA')
        draw_flag(im, rgbs[ser])
        im.save(os.path.join(OUT, 'ai_%s.png' % bid))
        n += 1
    print('  已出 %d 张带旗图标 → %s' % (n, OUT))
