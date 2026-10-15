# -*- coding: utf-8 -*-
"""v67 第三轮记忆：项目盘点 + 地图 + 判断（追加日志；MEMORY.md 只加一行索引）。"""
import io

LOG = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\2026-09-14.md'
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\MEMORY.md'

APPEND = """

## v67 第三轮（2026-09-14 · 老板问"规则和产物在哪、是否完整精简集中"）

**先盘点再回答**（`.workbuddy/tools/survey_project{,2}.py`），产出两个入口文件：
- `docs/项目地图.md` —— **产物七类 + 规则四层的唯一入口**
- `.workbuddy/tools/README_INDEX.md` —— 62 个工具按用途分 8 组（`gen_tools_index.py` 可重生成）

### 盘出来的硬事实

| 项 | 数 |
|---|---|
| 总规模 | 360 文件 / 124.8MB（**素材 119.2MB，代码只 1.4MB**） |
| 运行期真正需要的素材 | **36.9MB**（`icons/ui` 91 + `pool` 40 + `hero_*` 30）；**82.4MB 是原料**（待拍板） |
| 测试 | smoke 11336 行 / 1840 check · e2e 3658 行 / 659 · audit 277 行 |
| **DESIGN.md** | 123,887 字符 / 4107 行 —— **只有 4%（4416 字符 / 第 1~10 章）是"当前规范"，96% 是按版本编的史书** |
| 文档 | docs 18 份 / 582KB（活规范与史料混放） |
| 工具 | 62 个 / ~400KB（原先无索引、无分组） |
| 记忆 | MEMORY 9.5KB（卡在 9600 上限内）+ 日志 09-12 43.7KB · **09-13 82.1KB 未蒸馏** · 09-14 9KB |
| 自建技能 | 6 个 / 96KB（两个大的各 30K+） |

### 三项判断

- **完整 ✅**：七类产物各有唯一位置、都有护栏（91↔91、破坏测试 8/8、MEMORY 字符上限断言）；
  缺的只是"入口"——本次补上。顺手删掉被取代的占位文件 `README_变更日志.md`。
- **精简 ⚠️**：运行期很干净（15 模块 1.4MB、零依赖）；**文档臃肿** ——
  DESIGN.md 96% 是史书、docs 活规范与快照混放、82KB 日志未蒸馏、tools 里有同一件事的两个版本。
- **集中 ❌**：规则散在 **4 份主文件 + 6 个技能**，且**只有 L1（MEMORY.md）会被自动注入上下文**
  —— 写在 DESIGN.md / 备忘里的规则，不主动去读就等于不存在。**这是当前最该收的一处。**

### 给出的建议（分"可做/需拍板"）

低风险：DESIGN.md 顶部加"1~10 章=规范、11 章起=编年史"的导航行并把 30+ 个历史测试数标注清楚；
蒸馏 09-12/09-13 日志；删与模板重复的 `slim_memory_v67.py`。
需拍板：**DESIGN.md 拆成「设计规范.md + 设计史.md」**、docs 史料移入 `docs/_史料/`、
tools 分子目录（会动 DESIGN.md 里的路径引用，需同步转接）、82.4MB 原料去留。

### 本轮新增的"读法约定"

**任何一个"东西在哪"的问题只看 `docs/项目地图.md`**；
**"能不能改"先查 MEMORY §一.8 的唯一出口清单**；
**"为什么当初这么改"按断言名 grep `tools/patch_*.py`**（补丁脚本 = 事实上的变更日志）。
"""

io.open(LOG, 'a', encoding='utf-8', newline='').write(APPEND)
print('① 日志 +%d 字符' % len(APPEND))

s = io.open(MEM, encoding='utf-8', newline='').read()
n0 = len(s)
old = ('> 案例现场、实测数字、逐轮明细、**单一出口全量清单**、界面细目、待拍板积压\n'
       '> → `docs/AI工作备忘.md`（§三/§八/§十一/§十二/§十三）· `docs/vNN改动说明.md` ·\n'
       '> `docs/资产清理记录_v67.md` · 每日日志。')
new = ('> 案例现场、实测数字、逐轮明细、**单一出口全量清单**、界面细目、待拍板积压\n'
       '> → `docs/AI工作备忘.md`（§三/§八/§十一~§十四）· `docs/vNN改动说明.md` · 每日日志。\n'
       '> **"东西在哪"只看 `docs/项目地图.md`**（产物七类 + 规则四层 + 工具索引）。')
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new, 1)
io.open(MEM, 'w', encoding='utf-8', newline='').write(s)
print('② MEMORY.md：%d → %d 字符（上限 9600，余量 %d）' % (n0, len(s), 9600 - len(s)))
assert len(s) < 9600, '超限：%d' % len(s)
