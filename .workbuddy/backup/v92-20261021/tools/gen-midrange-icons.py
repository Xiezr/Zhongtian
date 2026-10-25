# -*- coding: utf-8 -*-
"""
v91.99 · 中程梯队三张兵种位图的**占位**生成器（无 PIL 依赖，纯 zlib 手写 PNG）
----------------------------------------------------------------------------
为什么要有这个脚本：
  §230② 兵种链体检要求「位图登记了，磁盘文件就必须在」。中程三个兵种属于新内容，
  正式美术要等贴图批；但链路不能因此断（断了就是"游戏里看不见这支兵"）。
  这里用极简剪影顶上，线条/配色沿用 icons.js 的 TR 表色板，保证同屏不违和。

替换方式：贴图批出图后直接覆盖 assets/icons/ui/ai_<id>.png 即可，无需改代码。

用法：python tools/gen-midrange-icons.py
输出：assets/icons/ui/ai_paojiban.png / ai_zhongjiqiang.png / ai_guidaopao.png
"""
import os
import struct
import zlib

SS = 2                      # 超采样倍数（2 → 1024 输出用 2048 画，边缘平滑）
OUT = 1024
W = OUT * SS


def blank(w, h):
    return [[(0, 0, 0, 0)] * w for _ in range(h)]


def poly_fill(buf, pts, color):
    """凸/凹多边形扫描线填充（非零绕数简化版：奇偶规则）"""
    n = len(pts)
    ys = [p[1] for p in pts]
    y0, y1 = max(0, int(min(ys))), min(len(buf) - 1, int(max(ys)))
    for y in range(y0, y1 + 1):
        yc = y + 0.5
        xs = []
        for i in range(n):
            x1, yy1 = pts[i]
            x2, yy2 = pts[(i + 1) % n]
            if (yy1 <= yc < yy2) or (yy2 <= yc < yy1):
                xs.append(x1 + (yc - yy1) * (x2 - x1) / (yy2 - yy1))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a, b = int(round(xs[i])), int(round(xs[i + 1]))
            row = buf[y]
            for x in range(max(0, a), min(len(row), b + 1)):
                row[x] = color


def rect(buf, x0, y0, x1, y1, color):
    poly_fill(buf, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], color)


def thick_line(buf, x0, y0, x1, y1, w, color):
    dx, dy = x1 - x0, y1 - y0
    ln = (dx * dx + dy * dy) ** 0.5 or 1
    nx, ny = -dy / ln * w / 2, dx / ln * w / 2
    poly_fill(buf, [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], color)


def circle(buf, cx, cy, r, color):
    y0, y1 = int(cy - r) - 1, int(cy + r) + 1
    for y in range(max(0, y0), min(len(buf), y1 + 1)):
        dy = y + 0.5 - cy
        if abs(dy) > r:
            continue
        dx = (r * r - dy * dy) ** 0.5
        row = buf[y]
        for x in range(max(0, int(cx - dx)), min(len(row), int(cx + dx) + 1)):
            if (x + 0.5 - cx) ** 2 + dy * dy <= r * r:
                row[x] = color


def ring(buf, cx, cy, r, w, color):
    y0, y1 = int(cy - r) - 1, int(cy + r) + 1
    for y in range(max(0, y0), min(len(buf), y1 + 1)):
        dy = y + 0.5 - cy
        if abs(dy) > r:
            continue
        dx = (r * r - dy * dy) ** 0.5
        for sgn in (-1, 1):
            x = int(cx + sgn * dx)
            thick_line(buf, x - w / 2, y + 0.5, x + w / 2, y + 0.5, w, color)


def tone(h):
    """一个色 → 三档明暗（暗/本色/亮），沿用 icons.js TR 表的 tone 三段式"""
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    def s(k):
        return (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), 255)
    return [s(0.80), s(1.0), s(1.22)]


def downsample(buf):
    out = []
    for y in range(OUT):
        row = []
        for x in range(OUT):
            r = g = b = a = 0
            for dy in range(SS):
                for dx in range(SS):
                    p = buf[y * SS + dy][x * SS + dx]
                    r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3]
            if a == 0:
                row.append((0, 0, 0, 0))
            else:
                row.append((r // a, g // a, b // a, a // (SS * SS)))
        out.append(row)
    return out


def write_png(path, rows):
    raw = b''.join(b'\x00' + b''.join(struct.pack('BBBB', *p) for p in row) for row in rows)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    hdr = struct.pack('>IIBBBBB', len(rows[0]), len(rows), 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', hdr)
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


def draw_paojiban(buf):
    dark, mid, light = tone('#645b40'), tone('#8a7f5c'), tone('#a89a74')
    # 座钣
    circle(buf, W * .50, W * .84, W * .20, dark[0])
    rect(buf, W * .30, W * .80, W * .70, W * .88, dark[1])
    # 炮管（斜置）
    thick_line(buf, W * .46, W * .78, W * .63, W * .26, W * .13, mid[1])
    thick_line(buf, W * .46, W * .78, W * .63, W * .26, W * .07, light[2])
    # 炮口
    circle(buf, W * .63, W * .26, W * .075, dark[2])
    # 支架
    thick_line(buf, W * .47, W * .70, W * .30, W * .86, W * .035, dark[0])
    thick_line(buf, W * .52, W * .70, W * .70, W * .86, W * .035, dark[0])
    # 炮弹
    circle(buf, W * .26, W * .72, W * .045, light[0])
    rect(buf, W * .245, W * .60, W * .275, W * .72, light[1])


def draw_zhongjiqiang(buf):
    dark, mid, light = tone('#564a3c'), tone('#7a6a58'), tone('#96846f')
    # 三脚架
    thick_line(buf, W * .50, W * .56, W * .34, W * .88, W * .035, dark[0])
    thick_line(buf, W * .50, W * .56, W * .66, W * .88, W * .035, dark[0])
    thick_line(buf, W * .50, W * .58, W * .50, W * .90, W * .032, dark[2])
    # 枪身
    rect(buf, W * .30, W * .42, W * .64, W * .55, mid[1])
    rect(buf, W * .30, W * .42, W * .64, W * .46, light[2])
    # 枪管 + 消焰器
    rect(buf, W * .64, W * .455, W * .84, W * .505, dark[1])
    rect(buf, W * .84, W * .435, W * .88, W * .525, dark[0])
    # 弹箱
    rect(buf, W * .34, W * .26, W * .48, W * .42, light[0])
    thick_line(buf, W * .48, W * .30, W * .56, W * .44, W * .05, dark[2])
    # 握把
    thick_line(buf, W * .40, W * .55, W * .37, W * .66, W * .04, dark[1])


def draw_guidaopao(buf):
    dark, mid, light = tone('#4f545d'), tone('#6d7480'), tone('#8b93a0')
    # 车轮
    circle(buf, W * .34, W * .76, W * .105, dark[0])
    circle(buf, W * .34, W * .76, W * .045, mid[2])
    circle(buf, W * .64, W * .76, W * .105, dark[0])
    circle(buf, W * .64, W * .76, W * .045, mid[2])
    # 车体
    rect(buf, W * .22, W * .50, W * .72, W * .70, mid[1])
    rect(buf, W * .22, W * .50, W * .72, W * .565, light[0])
    # 炮管（轨道）
    rect(buf, W * .44, W * .395, W * .92, W * .49, dark[1])
    rect(buf, W * .44, W * .415, W * .92, W * .435, light[2])
    # 线圈（三环）
    for i in range(3):
        x = W * (.56 + i * .10)
        rect(buf, x, W * .375, x + W * .022, W * .51, mid[0])
    # 炮口
    rect(buf, W * .905, W * .365, W * .935, W * .52, dark[0])


def main():
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'assets', 'icons', 'ui')
    jobs = [('ai_paojiban.png', draw_paojiban),
            ('ai_zhongjiqiang.png', draw_zhongjiqiang),
            ('ai_guidaopao.png', draw_guidaopao)]
    for name, fn in jobs:
        buf = blank(W, W)
        fn(buf)
        rows = downsample(buf)
        path = os.path.join(base, name)
        write_png(path, rows)
        print('写盘 %s（%d 字节）' % (path, os.path.getsize(path)))


if __name__ == '__main__':
    main()
