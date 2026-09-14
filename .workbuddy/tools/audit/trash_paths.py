# -*- coding: utf-8 -*-
"""把「无用图标」逐项送进回收站 —— 逐项回查，遇错不中断。

为什么这么写：
  · send2trash 的 modern/legacy 两个接口在本机**会抛错但删除已生效**
    （回收站 $I 元数据证明：_gold_backup 及其内含 14 个文件、_old_iso 及其文件都已入站）。
    所以判据**不能是"接口没抛错"，必须是"删后 os.path.exists == False"**。
  · 抛错就中断的写法（上一版）会让一批删到一半就停 —— 这正是"半截收尾"的老毛病。
    改成：逐项 try/except + 每项回查 + 最后总对账。
"""
import os, io, time
from send2trash.win.legacy import send2trash as trash

UI = r'E:\Deepseekdb\assets\icons\ui'
# 待删：7 个旧版/备份目录 + 12 张未接线图标（与 bitmaps 注册表不相交）
TARGETS = ['_gold_backup', '_old_iso', '_old_terra', '_old_terra_v46', '_old_terra_v47',
           '_old_terra_v48', '_old_terra_v49',
           'ai_city_capital.png', 'ai_city_county.png', 'ai_city_jun.png', 'ai_city_zhou.png',
           'ai_fort.png', 'ai_terrain_caoyuan.png', 'ai_terrain_desert.png',
           'ai_terrain_forest.png', 'ai_terrain_hill.png', 'ai_terrain_lake.png',
           'ai_terrain_meadow.png', 'ai_terrain_zhaoze.png']
assert len(TARGETS) == 19

ok, gone_already, fail, freed = [], [], [], 0
for name in TARGETS:
    p = os.path.join(UI, name)
    if not os.path.exists(p):
        gone_already.append(name)
        continue
    if os.path.isdir(p):
        sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(p) for f in fs)
    else:
        sz = os.path.getsize(p)
    err = None
    try:
        trash(os.path.normpath(p))
    except Exception as e:
        err = type(e).__name__
    # 判据：删没删掉，只看文件还在不在
    if os.path.exists(p):
        fail.append((name, err or '调用返回但仍在'))
    else:
        ok.append((name, sz, err))
        freed += sz

print('=== 逐项结果 ===')
for name, sz, err in ok:
    print('   ✓ %-26s %8.1fKB%s' % (name, sz / 1024, '   （接口抛 %s，但已删）' % err if err else ''))
for name in gone_already:
    print('   – %-26s 之前已删' % name)
for name, why in fail:
    print('   ❌ %-26s %s' % (name, why))
print()
print('本次删成 %d 项 / %.1f MB；此前已删 %d 项；失败 %d 项' % (
    len(ok), freed / 1048576, len(gone_already), len(fail)))

# ---------- 终态核对 ----------
rest = sorted(os.listdir(UI))
png = [f for f in rest if f.lower().endswith('.png')]
dirs = [f for f in rest if os.path.isdir(os.path.join(UI, f))]
print()
print('=== 终态 ===')
print('   ui/ 剩 %d 项：png %d 个，目录 %s' % (len(rest), len(png), dirs or '无'))
print('   19 项里还剩: %s' % ([n for n in TARGETS if os.path.exists(os.path.join(UI, n))] or '全清'))
