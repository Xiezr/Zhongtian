# -*- coding: utf-8 -*-
"""v89.167 收尾：备份 after + 工作记忆 + 技能 §81。
   运行：python .workbuddy/tools/patch/patch_v89167e_memory.py"""
import io, shutil, os

R = 'E:/Deepseekdb/'

# ── ① 备份 after ──
pairs = [
    ('js/domain.js', 'backup/v89167/domain.after.js'),
    ('js/ui.js', 'backup/v89167/ui.after.js'),
    ('js/main.js', 'backup/v89167/main.after.js'),
    ('smoke-test.js', 'backup/v89167/smoke-test.after.js'),
    ('e2e-test.js', 'backup/v89167/e2e-test.after.js'),
    ('需求档案.md', 'backup/v89167/需求档案.after.md'),
    ('docs/v89167-自动升级每城独立.md', 'backup/v89167/'),
    ('.workbuddy/tools/probe/probe_v89167_percity.js', 'backup/v89167/'),
    ('.workbuddy/tools/show/shot_v89167_percity.js', 'backup/v89167/'),
    ('.workbuddy/tools/asset/check_v89167_shots.js', 'backup/v89167/'),
    ('.workbuddy/tools/patch/patch_v89167a_percity.py', 'backup/v89167/'),
    ('.workbuddy/tools/patch/patch_v89167b_smoke_upgrade.py', 'backup/v89167/'),
    ('.workbuddy/tools/patch/patch_v89167c_smoke_archive.py', 'backup/v89167/'),
    ('.workbuddy/tools/patch/patch_v89167d_e2e.py', 'backup/v89167/'),
]
os.makedirs(R + 'backup/v89167', exist_ok=True)
for src, dst in pairs:
    d = R + dst
    if dst.endswith('/'):
        d = d + os.path.basename(src)
    shutil.copyfile(R + src, d)
print('  [ ok ] 备份完成（%d 文件）' % len(pairs))

# ── ② 工作记忆 ──
p = 'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-09-27.md'
add = """

---

## v89.167（自动升级 · 每城独立建造位 · 老板 1 条）

**老板原文**：自动升级建造，应该每个城池均遍历，分别升级，而不是所有城池一起，总共只升级3个建筑

**病根（"3"的来源）**：改前闸门 = `queues.build.length >= buildSlots(当前城)` ——
**全境队列总数 vs 单城位**（3 = 单城基础位）→ 全境排满 3 条即"队列已满"，其余城永远轮不上；
叠加"试建循环第一条成功就 return"（一次一条）→ 全境 3 条封顶。

**落地**：`cityRoomOf(ct)`（buildQueueUsed / buildSlots 逐城核对）替换全局闸门；
候选收集跳过满城；试建循环**排满各城空位**（doneN167 计数 · target 取第一条成功兼容旧断言）；
返回 `{ok,target,last,count}`；文案（状态行两态 / 面板说明 / 开启提示）全带"每城独立"。

**门禁**：audit 全 0 · smoke **3211/0**（新增 §167 共 7 条 · **4 条旧断言随口径升级**）·
e2e **1147/0**（新增 5 条）· 数据表四查过 · gate --full 通过 · modals 43/43 ·
探针 **10/0**（三城 [3,3,3] · count=9）· 实机 **7/0**（主循环自动排 · 2 图）· 像素体检 **8/0**。
**产物**：docs/v89167-自动升级每城独立.md · backup/v89167/ · 补丁 4 支 + 收尾 1 ·
probe/shot/check 各 1 · 技能 §81。

**本轮教训（入技能 §81）**：
① **"全境 vs 单城"的尺子错配**是额度类 bug 的母题（闸门两侧必须同一主体——"这个额度是谁的"）；
② **"第一条成功就 return"是隐蔽限额**——与闸门叠加出"总共 N 个"的观感；改"排满"要配套
（候选跳过满城不污染失败原因 / done 计数 / 返回结构兼容）；
③ 旧断言升级的**标准形态**：`=== 1`→`>= 1`、"第二次调用 ok"→"逐城不超各自位"、
   `=== null`→`!(x && x.ok)`、"两次调用"→"一次调用查结果"——影响面记进文档表格；
④ 造局两坑：**先占野地（push s.wilds）再筑城**（canBuildCityAt 查 map.wildAt=读 s.wilds，
   顺序反了永远"需先占领"，实中一次）；**多城造局先给爵位**（v89.108 领地上限）。
"""
s = io.open(p, 'r', encoding='utf-8', newline='').read()
if 'v89.167（自动升级' in s:
    print('  [skip] 记忆已写')
else:
    io.open(p, 'a', encoding='utf-8', newline='').write(add)
    print('  [ ok ] 工作记忆已追加')

# ── ③ 技能 §81 ──
q = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'
sk = io.open(q, 'r', encoding='utf-8', newline='').read()
if '## §81.' in sk:
    print('  [skip] 技能 §81 已存在')
else:
    io.open(q, 'a', encoding='utf-8', newline='').write("""
---

## §81. 「全境 vs 单城」的尺子错配 / "第一条成功就 return"是隐蔽限额（v89.167）

### 81.1 ⛔ 额度类闸门先问一句：「**这个额度是谁的**」——两侧必须同一主体

老板令「自动升级应该每个城池均遍历，分别升级，而不是所有城池一起，总共只升级 3 个建筑」→
病根是**两把尺子量一件事**：
```js
if ((s.queues.build || []).length >= GAME.buildSlots(city))   // ⛔ 全境总数 vs 单城位
```
**全境队列总数**（所有城合计）配**单城建造位**（=3）→ 全境排满 3 条即"队列已满"。
**规程**：凡"上限/额度/容量"类判据，左值右值必须**同一主体**（都按城，或都按全境）——
混用是最隐蔽的一类 bug（平时单城看不出，多城才炸）。
**落地形态**（可抄）：`cityRoomOf(ct) = buildQueueUsed(ct.id) < buildSlots(ct)` ——
两个**既有出口**逐城核对；"所有城都满"才报全境态（文案带上"合 N 位在办"给它一个数字自洽）。

### 81.2 ⛔ 「第一条成功就 `return`」= 隐蔽限额（与闸门叠加出"总共只升 N 个"）

试建循环原来"第一个排上就 `return`"（一次调用一条）——**它本身就是一个额度**（每调用 1 条）。
与 §81.1 的闸门叠加 → 玩家观感 = "总共只升级 3 个"。
**改"排满"的四件配套**（缺一件就有后遗症）：
1. **候选收集跳过"已满的城"**（`if (!cityRoomOf(ct)) return;`）——否则满城的候选会走
   `upgradeAt` 内部检查失败、污染"最后一个失败原因"与暂停文案；
2. **循环内每项前再查该城**（某城排满后其后续候选直接 `continue`，不算失败）；
3. **done 计数 + 首/末项**（`doneN167 / first167 / last167`）——返回结构增强的同时
   **`target` 保持"第一条成功"**（兼容旧断言语义，不炸老用例）；
4. **文案两态都要写**：排入态（"本轮排入 N 项（各城独立建造位）"）与满位态
   （"各城队列已满（合 N 位在办 · 每城独立）"）——实机断言写"两态皆可"，
   否则抓拍时刻不同就假红（本轮实中）。

### 81.3 旧断言升级的标准形态（口径变更影响面的活文档）

"一次一条 → 一次排满"牵动 4 条旧断言，升级形态照抄：
| 旧断言 | 升级为 |
|---|---|
| `queues.build.length === 1` | `>= 1`（一次排满） |
| 「继续排队下一个」（第二次调用 ok） | **「各城不超各自建造位」**（核心口径，逐城核对） |
| `au3 === null` | `!(au3 && au3.ok)`（"不再排入"——paused 也合法） |
| "两次调用各得一城"（城墙跨城） | "一次调用查队列 cityId 分布"（两城齐上） |

**规矩**：升级后的断言要在注释/文档里写明"为什么改"——它们就是**这次口径变更影响面**的活文档。

### 81.4 造局两坑（本轮实中）

1. **先占野地（push `s.wilds`）再筑城** —— `canBuildCityAt` 查 `GAME.map.wildAt`（**读的就是 s.wilds**）；
   顺序反了（先查后 push）→ 永远报"需先占领该野地，方可在其上筑城"。
2. **多城造局先给爵位** —— 建城受"领地上限随爵位"（v89.108）：平民只 2 城，
   `st.rank = 6` 起步才谈得上 3 城（否则静默建不出、断言莫名其妙）。
""")
    print('  [ ok ] 技能 §81 已追加')
