# -*- coding: utf-8 -*-
"""v89.166 收尾：备份 after + 工作记忆 + 技能 §80。
   运行：python .workbuddy/tools/patch/patch_v89166d_memory.py"""
import io, shutil, os

R = 'E:/Deepseekdb/'

# ── ① 备份 after ──
pairs = [
    ('js/main.js', 'backup/v89166/main.after.js'),
    ('smoke-test.js', 'backup/v89166/smoke-test.after.js'),
    ('e2e-test.js', 'backup/v89166/e2e-test.after.js'),
    ('需求档案.md', 'backup/v89166/需求档案.after.md'),
    ('docs/v89166-进入城池菜单全关.md', 'backup/v89166/'),
    ('.workbuddy/tools/probe/probe_v89166_enter.js', 'backup/v89166/'),
    ('.workbuddy/tools/show/shot_v89166_enter.js', 'backup/v89166/'),
    ('.workbuddy/tools/asset/check_v89166_shots.js', 'backup/v89166/'),
]
os.makedirs(R + 'backup/v89166', exist_ok=True)
for src, dst in pairs:
    d = R + dst
    if dst.endswith('/'):
        d = d + os.path.basename(src)
    shutil.copyfile(R + src, d)
print('  [ ok ] 备份完成')

# ── ② 工作记忆 ──
p = 'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-09-27.md'
add = """

---

## v89.166（进入城池 = 菜单全关 + 城内大界面 · 老板 1 条）

**老板原文**：地图上点击我方城市，点击进入城池，城市菜单界面应关闭，直接显示城内大界面

**病根（改前取证）**：`case 'city-enter'` 的关闭调用计数 = **0**（弹窗盖着城内视图）；
同语义的君主面板 `lord-city-enter` 有 1 次 closeModal —— 又是"同语义两入口一接一漏"（§79.1 复遇）。

**落地**：两入口统一 `ui.closeAllModals()`（清栈+完整关闭 · 与种田秘境/开校场同款既有出口）；
顺序 = closeAllModals 在 setCity 之前（先关菜单再切城；同一帧完成不闪）。
全量清点 setCity 全部 4 个调用点：city-enter✅修 / lord-city-enter✅统一 /
switch-city（顶栏切换器·无菜单上下文）不动 / chip-set after='city'（城内 chip·留在弹窗是对的）不动。

**门禁**：audit 全 0 · smoke **3203/0**（新增 §166 共 4 条）· e2e **1142/0**（新增 7 条 · 点真按钮）·
数据表四查过 · gate --full 通过 · modals 43/43 · 探针 **8/0** · 实机 **7/0**（2 图）· 像素体检 **8/0**。
**产物**：docs/v89166-进入城池菜单全关.md · backup/v89166/ · 补丁 4 支 · probe/shot/check 各 1 · 技能 §80。

**本轮教训（入技能 §80）**：
① 每次改/查一个"动作"时，**grep 同语义的全部宿主**（setCity 4 处清单化）——"一接一漏"已成模式；
② **"关闭"的出口两分法**：语义=回主界面 → `closeAllModals`；语义=回上一级 → `closeModal`。
   "进入XX"类动作（进入城池/进入战斗）一律**全关**；
③ 源码级"顺序断言"手法：段切片 + `indexOf(A) < indexOf(B)` 确认先后（本轮锁"先关菜单后切城"）。
"""
s = io.open(p, 'r', encoding='utf-8', newline='').read()
if 'v89.166（进入城池' in s:
    print('  [skip] 记忆已写')
else:
    io.open(p, 'a', encoding='utf-8', newline='').write(add)
    print('  [ ok ] 工作记忆已追加')

# ── ③ 技能 §80 ──
q = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'
sk = io.open(q, 'r', encoding='utf-8', newline='').read()
if '## §80.' in sk:
    print('  [skip] 技能 §80 已存在')
else:
    io.open(q, 'a', encoding='utf-8', newline='').write("""
---

## §80. 同语义宿主清单化 / "关闭"的两分法 / 顺序不变量断言（v89.166）

### 80.1 ⛔ 每次动一个"动作"，先 grep 同语义的**全部宿主**（清单化）

老板令「进入城池，城市菜单界面应关闭」→ 病灶又是"**同语义两入口、一个接了一个漏**"：
`case 'city-enter'`（城池面板）关闭调用 **0 次**；`case 'lord-city-enter'`（君主面板）有 1 次。
**动作规程**（本轮定型）：
1. 先找"那个动作"的**标志串**（本轮 = `ui.setCity(` / `setView('city')`）→ grep 全仓调用点；
2. 每个调用点过一遍三问：**有没有菜单要关？关了会不会错？语义是"回主界面"还是"留在原地"？**
3. 输出一张清单表（有菜单要关 / 无菜单上下文 / 不关是对的），逐条给处置。
§79.1（同一数据两渲染宿主）与本条（同一动作两入口）是同一族问题的两种面貌 ——
**"同义词的第二个宿主"永远是漏网高发位**。

### 80.2 ⛔ "关闭"的两分法：`closeAllModals`（回主界面）vs `closeModal`（回上一级）

本项目的弹层关闭有两种语义（都是既有出口，不要新造）：

| 语义 | 出口 | 场景样例 |
|---|---|---|
| **离开全部菜单、回主界面** | `ui.closeAllModals()` | 「进入城池」「进入战斗」「种田秘境关闭键」「开校场」 |
| **回上一级菜单** | `ui.closeModal()` | 一般弹窗的关闭/取消（v89.117 弹栈设计） |

**判据**：动作名字里带"**进入/开始/打开某个场景**"的一律**全关**；
"**返回/取消/关闭本页**"用 `closeModal`（保留上级）。
本轮 `lord-city-enter` 从 `closeModal` 改 `closeAllModals` 就是按此判据统一（有上级时 closeModal 会停在别的菜单里，与"进入"语义不符）。
**顺序**：全关要放在**切城/切视图之前**（先关菜单、再设目标状态）——同一帧内 JS 同步执行完才 paint，不会闪。

### 80.3 源码级"顺序不变量"断言（轻量 · 好用）

要锁住"**A 必须在 B 之前**"这类顺序（本轮 = 先关菜单后切城），不用跑 DOM：
```js
var seg = src.slice(src.indexOf("case 'city-enter'"), src.indexOf("case 'city-transport'"));
check(..., seg.indexOf('ui.closeAllModals();') >= 0
        && seg.indexOf('ui.closeAllModals();') < seg.indexOf('ui.setCity('));
```
要点：① **段切片要有明确的起止标志串**（相邻 case / 下一函数注释）；② 负向补一条
（"两段无裸 closeModal"）防回退；③ 配合探针的"动作序列真调 + e2e 点真按钮"三层，
源码层管"顺序"、探针层管"状态产出"、e2e/实机层管"玩家真点的效果"。
""")
    print('  [ ok ] 技能 §80 已追加')
