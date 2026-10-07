# -*- coding: utf-8 -*-
"""v89.226 复核补丁 · 工具卫生五项：
A check_v89121_flags_on_screen.py 墓碑早退（旗时代一次性检查器，旗退役后运行会误导）
B verify_v89106_screen.js 注释去旗（仅注释层）
C wasteland_batches.json W-B1 note 纠正（"必贴族旗" → "不贴旗"）
D probe_v89225k_flagstat.js 输出标签纠正（UI 已无旗）
E design_v89225_plot.py 头部标注（v1 草稿；最终值+变换以应用面与 smoke 为准）
"""
import io, os, json

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    tmp = BASE + p + '.tmp226'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)


# ---------- A 墓碑早退 ----------
p = '.workbuddy/tools/asset/check_v89121_flags_on_screen.py'
s = rd(p)
if 'v89.225 退役' in s:
    print('[skip] A 已墓碑')
else:
    anchor = "from collections import defaultdict\n"
    assert s.count(anchor) == 1, 'A anchor x%d' % s.count(anchor)
    add = anchor + """
# ⛔ v89.225 退役（v89.226 复核补墓）：族旗管线整体退役，族色改由城内地块承载
#   （DATA.SERIES[].plot + --ser-*）。本检查器（v89.121 立）以"截图里找高饱和旗布簇"
#   为唯一判据 —— 旗已不存在，运行只会输出误导结论。守卫在扫描代码之前强制退出。
#   现行防线：gen/wasteland_batch.py gate ③（逐张无旗）· smoke §225（零残留 + 墓碑色普查）。
if __name__ == '__main__':
    sys.exit('⛔ 本工具已于 v89.225 退役（族旗 → 地块染色）。\\n'
             '   现行防线：gen/wasteland_batch.py gate ③ · smoke §225。')
"""
    wr(p, s.replace(anchor, add))
    print('[ok] A 墓碑')

# ---------- B 注释去旗 ----------
p = '.workbuddy/tools/asset/verify_v89106_screen.js'
s = rd(p)
c = s.count('族旗/彩绘')
if c == 0:
    print('[skip] B 已更新')
else:
    assert c == 2, 'B count x%d' % c
    wr(p, s.replace('族旗/彩绘', '材质高光/彩绘'))
    print('[ok] B 注释 x2')

# ---------- C batches.json note ----------
p = '.workbuddy/tools/asset/wasteland_batches.json'
s = rd(p)
old = '切分后必贴族旗(flag_bldg_icons.py)；装前色散门禁 ≥15°'
if old not in s:
    print('[skip] C 已更新')
else:
    assert s.count(old) == 1, 'C count x%d' % s.count(old)
    new = '切分后不贴旗（v89.225 族旗退役 · gate③ 逐张无旗）；装前色散门禁 ≥15°'
    wr(p, s.replace(old, new))
    json.loads(rd(p))   # 写后自检
    print('[ok] C note')

# ---------- D probe 标签 ----------
p = '.workbuddy/tools/patch/probe_v89225k_flagstat.js'
s = rd(p)
old = "[['stage(重切后)', stage], ['UI(带旗现行)', ui], ['backup(带旗旧)', bak]]"
if old not in s:
    print('[skip] D 已更新')
else:
    assert s.count(old) == 1, 'D count x%d' % s.count(old)
    new = "[['stage(重切后·无旗)', stage], ['UI(现行·无旗)', ui], ['backup(v89225 备份·带旗版)', bak]]"
    wr(p, s.replace(old, new))
    print('[ok] D 标签')

# ---------- E design 头部 ----------
p = '.workbuddy/tools/patch/design_v89225_plot.py'
s = rd(p)
if 'v89.226 复核标注' in s:
    print('[skip] E 已标注')
else:
    old = '"""v89.225 地块色设计 · ΔE00 矩阵实测\n8 族 = gov/biz/store/live/edu/road/mil/recruit；4 主题各有一版渲染色。\n先跑 v1 候选，看矩阵数值再调。"""'
    assert s.count(old) == 1, 'E anchor x%d' % s.count(old)
    new = ('"""v89.225 地块色设计 · ΔE00 矩阵实测（**v1 草稿** —— 保留作迭代起点）\n'
           '8 族 = gov/biz/store/live/edu/road/mil/recruit；4 主题各有一版渲染色。\n'
           '先跑 v1 候选，看矩阵数值再调。\n\n'
           '⛔ v89.226 复核标注：本文件停在 v1 候选（live 78° / store 28° 等）——\n'
           '   **最终落地值不在本文件**。准绳 = js/data.js `DATA.SERIES[].plot`（默认主题 HSL）\n'
           '   + index.html `--ser-*`（4 主题 hex）；主题变换 = light(s×0.95/l×1.15cap85) /\n'
           '   bamboo(s×0.88/l×1.19cap85) / dark2(l×0.76)，已由 smoke §225③/③b 逐字节锁定\n'
           '   （复核复现脚本：.workbuddy/tools/patch/check_v89226_themes.py · 32/32）。"""')
    wr(p, s.replace(old, new))
    print('[ok] E 标注')

print('--- 自检 ---')
import ast
for pp in ['.workbuddy/tools/asset/check_v89121_flags_on_screen.py',
           '.workbuddy/tools/patch/design_v89225_plot.py']:
    ast.parse(rd(pp))
    print('py OK', pp)
json.loads(rd('.workbuddy/tools/asset/wasteland_batches.json'))
print('json OK')
print('ALL DONE')
