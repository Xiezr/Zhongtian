# -*- coding: utf-8 -*-
"""v89.42 补丁 4b：项目地图 · 工具计数与截图数（精确锚点重试）"""
import io, os, sys

MAP = r'E:\Deepseekdb\docs\项目地图.md'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8942e'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


edit(MAP, r"""    │   ├── README_INDEX.md    ← 工具索引（81 个，自动生成）
    │   ├── patch\ 变更日志（12）· break\ 破坏测试（11）· probe\ 探针（17）
    │   ├── gen\ 生成器（4）    · asset\ 素材处理（8）· audit\ 审计核对（10）
    │   ├── mem\ 记忆维护（10） · show\ 展示校准（4）""",
     r"""    │   ├── README_INDEX.md    ← 工具索引（319 个，自动生成）
    │   ├── patch\ 变更日志（237）· break\ 破坏测试（17）· probe\ 探针（19）
    │   ├── gen\ 生成器（4）     · asset\ 素材处理（10）· audit\ 审计核对（12）
    │   ├── mem\ 记忆维护（10）  · show\ 展示校准（5）""",
     '项目地图 · 工具计数')

edit(MAP, r"""    ├── shots\               验收截图（9 张）""",
     r"""    ├── shots\               验收截图（13 张）""",
     '项目地图 · 截图数')

src = read(MAP)
print('v89.42 出现 %d 次' % src.count('v89.42'))
