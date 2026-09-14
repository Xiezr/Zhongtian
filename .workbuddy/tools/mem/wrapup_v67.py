# -*- coding: utf-8 -*-
"""收尾：日志追加 · 刷新工具索引（本轮新增的脚本要入册）。"""
import io, os, subprocess

LOGS = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
ROOT = r'E:\Deepseekdb'
PY = r'C:\Users\18811\.workbuddy\binaries\python\envs\default\Scripts\python.exe'

APPEND = """

## v67 第四轮（2026-09-14 · 老板：「按推荐方式进行，集中存放」）

### 做了什么（全部完成）

| 项 | 结果 |
|---|---|
| **DESIGN.md 拆分** | 232KB 混合体 → `docs/设计规范.md`（8KB/原 1~10 章）+ `docs/_史料/设计史.md`（224KB/原 11 章起）+ `DESIGN.md` 指针（628B）。**章号全部保留**，历史指路不断 |
| **docs 分档** | 顶层 10 份（活）· `_史料/` 6 份（历轮说明/v66/快照/清理记录）· `_参考/` 5 份（数值检索报告/战斗检索/资源方案/供需图谱/野地公式） |
| **tools 分子目录** | 67 个 → 8 组：`patch/ break/ probe/ gen/ asset/ audit/ mem/ show/`；**目录即分组**；`README_INDEX.md` 由 `gen/gen_tools_index.py` 自动生成 |
| **引用转接** | docs 路径 9 份 · 章节式 8 处（需求档案里的"第 43~49 章"→设计史）· tools 路径 16 份；**终检残留 0** |
| **日志蒸馏** | ⛔ **实测后放弃**（详见下） |
| **82.4MB 原料** | 按建议**保留** |

### ⛔ 本轮最该记的一条：我的"估计"被自己的"实测"推翻了

我上一轮建议"09-13 日志可压到 15KB，因为内容已在历轮说明+备忘里"。
按此执行时，判据写成**可验证**的形式：只删"在 docs 里能找到同一行"的内容。
结果：**全篇 2325 行只命中 4 行（0.05%）** —— 那份日志是**唯一的现场记录**，压它＝丢信息。

**结论：不蒸馏**，并把实验误删的 4 行全部回填（2 行代码回原位，2 行在文件头明确标注
"位置不可考、内容一字不差"）。

**教训**：*"我估计这些内容别处有"* 与 *"实测这些内容别处有"* 是两回事。
凡"删/压/合并"，先把判据写成**能跑出数字**的形式再动手 —— 这次是判据救了我。
（同类前科：v67 把 55MB 记成 28KB，也是"估"而不是"量"。）

### 现在的入口体系（四层，各一个入口）

| 层 | 入口 | 体量 | 自动注入 |
|---|---|---|---|
| L1 强制规则 | `MEMORY.md` | 9,596 字符 | ✅ |
| L2 设计规范 | `docs/设计规范.md` | 4,716 | ❌ |
| L3 案例细则 | `docs/AI工作备忘.md` | 28,215 | ❌ |
| L4 史料 | `docs/_史料/` | ~250KB | ❌ |
| 总入口 | `docs/项目地图.md` | 9KB | ❌ |

### 验收

smoke **1880/0** · e2e **661/0**（无运行时错误）· audit 全 0。
本轮只动文档与工具（`js/` 里只改了注释里的路径），三套测试仍全绿。
"""

io.open(os.path.join(LOGS, '2026-09-14.md'), 'a', encoding='utf-8', newline='').write(APPEND)
print('① 日志 +%d 字符' % len(APPEND))

r = subprocess.run([PY, os.path.join(ROOT, '.workbuddy', 'tools', 'gen', 'gen_tools_index.py')],
                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
print('② ' + r.stdout.decode('utf-8', 'replace').strip())

# 本轮新增的脚本入册检查
import glob
idx = io.open(os.path.join(ROOT, '.workbuddy', 'tools', 'README_INDEX.md'), encoding='utf-8').read()
newly = ['distill_log_0913.py', 'fix_log_0913.py', 'finalize_v67.py', 'slim_and_locate.py',
         'trim_last.py', 'consolidate_tools.py', 'consolidate_docs.py', 'consolidate_docs2.py',
         'audit_refs.py', 'memory_v67c.py']
miss = [f for f in newly if f not in idx]
print('③ 本轮新增脚本入册：%d/%d%s' % (len(newly) - len(miss), len(newly),
                                      ('  未入册：%s' % miss) if miss else ' ✅'))
