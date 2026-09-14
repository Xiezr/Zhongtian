# -*- coding: utf-8 -*-
"""MEMORY 超限 256 字符 → 精修（内容不丢，只收紧句子）＋ 定位浏览器 store。"""
import io, os

LOGS = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
MEM = os.path.join(LOGS, 'MEMORY.md')
m = io.open(MEM, encoding='utf-8', newline='').read()
n0 = len(m)


def rep(old, new, label):
    global m
    c = m.count(old)
    assert c == 1, '[%s] 锚点 %d 次' % (label, c)
    m = m.replace(old, new, 1)


rep('- **工具与产物的家（v67 起）**：一次性探针 → `.workbuddy/tmp/`（**用完即清**）；可复用的\n'
    '  （几何探针/破坏测试/生成器/落盘核验）→ `.workbuddy/tools/<分类>/`（8 组 67 个），\n'
    '  **目录即分组、文档引用要带分类**（索引 `tools/README_INDEX.md` 自动生成）；\n'
    '  验收截图 → `.workbuddy/shots/`。',
    '- **工具与产物的家**：一次性探针 → `.workbuddy/tmp/`（用完即清）；可复用的 → `.workbuddy/tools/<分类>/`\n'
    '  （8 组 67 个，**目录即分组**，文档引用要带分类；索引 `tools/README_INDEX.md` 自动生成）；\n'
    '  验收截图 → `.workbuddy/shots/`。', 'tools 家')

rep('  自动存档是否加"关键节点也存"；**仍未删的 82MB 原料**：`icons/raw` 38MB · `portraits/_raw` 41MB ·\n'
    '  `pd_src` 2.9MB）。',
    '  自动存档是否加"关键节点也存"）。', '待拍板去重')

rep('- **v67 已定的事**：地图地形**全程序化绘制**（AI 地形贴图路线退役，21 项素材进回收站）；\n'
    '  `bitmaps.js` 91 项与磁盘一一对应；**文档集中存放**（`DESIGN.md` 拆成 `docs/设计规范.md` +\n'
    '  `docs/_史料/设计史.md`，docs 分活/`_史料`/`_参考` 三层，tools 分 8 组）；\n'
    '  **日志不蒸馏**（实测 09-13 全篇 2325 行与 docs 只重叠 4 行 → 压它等于丢现场）；\n'
    '  **82.4MB 素材原料保留**（`icons/raw` 38.2 + `portraits/_raw` 41.3 + `pd_src` 2.9）。',
    '- **v67 已定**：地形**全程序化绘制**（AI 地形贴图退役，21 项素材进回收站）；`bitmaps.js` 91↔磁盘 91；\n'
    '  **文档集中存放**（DESIGN.md → `docs/设计规范.md` + `docs/_史料/设计史.md`；docs 分活/`_史料`/`_参考`；\n'
    '  tools 分 8 组）；**日志不蒸馏**（实测与 docs 只重叠 4 行/2325 → 压它＝丢现场）；**82.4MB 原料保留**。',
    'v67 已定')

rep('  ⚠️ **备份目录会把之后的修改一起还原掉**（v66 栽过）：改完夹具要删旧备份再跑。',
    '  ⚠️ **备份目录会把之后的修改一起还原掉**（v66）→ 改完夹具先删旧备份。', '破坏测试警示')

rep('- 四套主题：正文 ≥ 7:1、次要文字 ≥ 4.5:1、层级亮度单调递进（`.workbuddy/tools/audit/audit_colors.js`）。',
    '- 四套主题：正文 ≥ 7:1、次要 ≥ 4.5:1、层级亮度单调递进（`tools/audit/audit_colors.js`）。', '配色')

io.open(MEM, 'w', encoding='utf-8', newline='').write(m)
print('MEMORY.md：%d → %d 字符（上限 9600，余量 %d）' % (n0, len(m), 9600 - len(m)))
assert len(m) < 9600, '仍超：%d' % len(m)

# ---------- 定位浏览器 store ----------
print()
print('=== 游戏存档（localStorage）在磁盘上的位置 ===')
cands = [
    r'C:\Users\18811\AppData\Local\Microsoft\Edge\User Data\Default\Local Storage\leveldb',
    r'C:\Users\18811\AppData\Local\Microsoft\Edge\User Data\Profile 1\Local Storage\leveldb',
    r'C:\Users\18811\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb',
    r'C:\Users\18811\AppData\Local\Microsoft\Edge\User Data',
]
found = []
for c in cands:
    if os.path.isdir(c):
        n = sum(len(fs) for _, _, fs in os.walk(c))
        sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(c) for f in fs)
        found.append(c)
        print('   ✅ %-78s %4d 个文件 / %6.1fMB' % (c, n, sz / 1048576))
    else:
        print('   —  %s' % c)
io.open(os.path.join(LOGS, '_save_paths.txt'), 'w', encoding='utf-8').write('\n'.join(found))
print()
print('   共找到 %d 个可用目录（已写入 _save_paths.txt 供"打开文件夹"用）' % len(found))
