# -*- coding: utf-8 -*-
"""收口：日志空行 · MEMORY 同步整改结论 · 定位浏览器 store（存档位置）。"""
import io, os, glob, json

LOGS = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
MEM = os.path.join(LOGS, 'MEMORY.md')

# ---------- ① 日志多余空行 ----------
p = os.path.join(LOGS, '2026-09-13.md')
s = io.open(p, encoding='utf-8', newline='').read()
s2 = s.replace('> - `- 老板：「将领，人口，资源等是归属于城池的数据，切换城池时，只统计、呈现当前的数据即可」`\n\n\n\n',
               '> - `- 老板：「将领，人口，资源等是归属于城池的数据，切换城池时，只统计、呈现当前的数据即可」`\n\n')
if s2 != s:
    io.open(p, 'w', encoding='utf-8', newline='').write(s2)
    print('① 日志空行已整理（%d → %d）' % (len(s), len(s2)))
else:
    print('① 日志空行无需整理')

# ---------- ② MEMORY 同步 ----------
m = io.open(MEM, encoding='utf-8', newline='').read()
n0 = len(m)


def rep(old, new, label):
    global m
    c = m.count(old)
    if c != 1:
        print('   ⚠ [%s] 锚点 %d 次，跳过' % (label, c))
        return
    m = m.replace(old, new, 1)
    print('   ✓ %s' % label)


print('② MEMORY 同步')
# 2.1 tools 路径（迁移脚本已改过，这里只复核）
rep('（几何探针/破坏测试/生成器/落盘核验）→ `.workbuddy/tools/`（42 个），**文档引用一律写 tools 路径**；',
    '（几何探针/破坏测试/生成器/落盘核验）→ `.workbuddy/tools/<分类>/`（8 组 67 个），\n'
    '  **目录即分组、文档引用要带分类**（索引 `tools/README_INDEX.md` 自动生成）；', 'tools 路径说明')
# 2.2 遗留：把已定的三件事写进去
rep('- **v67 已定的事**：地图地形**全程序化绘制**（AI 地形贴图路线退役，21 项素材进回收站）；\n'
    '  `bitmaps.js` 91 项与磁盘一一对应。',
    '- **v67 已定的事**：地图地形**全程序化绘制**（AI 地形贴图路线退役，21 项素材进回收站）；\n'
    '  `bitmaps.js` 91 项与磁盘一一对应；**文档集中存放**（`DESIGN.md` 拆成 `docs/设计规范.md` +\n'
    '  `docs/_史料/设计史.md`，docs 分活/`_史料`/`_参考` 三层，tools 分 8 组）；\n'
    '  **日志不蒸馏**（实测 09-13 全篇 2325 行与 docs 只重叠 4 行 → 压它等于丢现场）；\n'
    '  **82.4MB 素材原料保留**（`icons/raw` 38.2 + `portraits/_raw` 41.3 + `pd_src` 2.9）。',
    '遗留：v67 已定的事')

io.open(MEM, 'w', encoding='utf-8', newline='').write(m)
print('   MEMORY.md：%d → %d 字符（上限 9600，余量 %d）' % (n0, len(m), 9600 - len(m)))
assert len(m) < 9600, '超限：%d' % len(m)

# ---------- ③ 定位浏览器 store（"存档位置"） ----------
print()
print('③ 定位游戏存档（localStorage）在磁盘上的位置')
cands = [
    r'C:\Users\18811\AppData\Local\Microsoft\Edge\User Data\Default\Local Storage\leveldb',
    r'C:\Users\18811\AppData\Local\Microsoft\Edge\User Data\Profile 1\Local Storage\leveldb',
    r'C:\Users\18811\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb',
]
found = []
for c in cands:
    if os.path.isdir(c):
        n = len(os.listdir(c))
        sz = sum(os.path.getsize(os.path.join(c, f)) for f in os.listdir(c)
                 if os.path.isfile(os.path.join(c, f)))
        found.append(c)
        print('   ✅ %-72s %d 个文件 / %.1fMB' % (c, n, sz / 1048576))
    else:
        print('   —  %s' % c)
print()
print('   结论：%s' % ('浏览器把 localStorage 放在上面这个 leveldb 目录里（二进制，不能直接读）；'
                      '要"带走存档"用游戏里的导出功能。' if found else '未找到浏览器 profile。'))
io.open(os.path.join(LOGS, '..', 'tmp_save_paths.txt'), 'w', encoding='utf-8').write('\n'.join(found))
