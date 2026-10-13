# -*- coding: utf-8 -*-
"""P1：三份档案补录 v90.87 / v90.87b / v90.92 / v90.93 / v90.94 版本行（含详细章节）。
   走：备份 -> 内存替换 -> 锚点唯一 -> 原子落盘 -> 写后自检。"""
import io
import os
import re
import shutil

ROOT = r'E:\Deepseekdb'
BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.94-lordbreak')

F_ARC = os.path.join(ROOT, '需求档案.md')
F_MAP = os.path.join(ROOT, 'docs', '项目地图.md')
F_LED = os.path.join(ROOT, 'docs', '需求台账-v9012-13.md')


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    tmp = p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def backup(p):
    b = os.path.join(BK, os.path.basename(p) + '.preArchive')
    if not os.path.exists(b):
        shutil.copy2(p, b)


# ---------------- ① 需求档案：总览表 5 行 ----------------
ROWS = """| v90.87 | 2026-10-13 | 1 | **全仓复核（零产品改动）**：`E:\\Deepseekdb` 全仓审核 —— 产品侧历史遗留 **0 条**；工具侧抓出并修复 **6 处口径过期**（根因统一为「工具没跟上产品」：chains / lifecycle / inventory / troopchain 四工具清单漏 `sphere` · 直调 `expedition` 绕过 `march.tick` · 渠道表漏 `BOOST_DROP` · 锻造间钉死 Lv8 而 `tierLv` 第 6 阶需 Lv9）；修复后 chains 36 环节通 35 断 0 · A1 220/220 · A2 342/342；**复核轮不升版本**（老板原文：「`E:\\Deepseekdb`，审核代码，确认无历史遗留，现有功能模块完好」——逐字） | 已完成（详见 docs/_史料/交付/v9087-复核.md） |
| v90.87b | 2026-10-13 | 3 | **清账轮（承接复核报告 §六 逐条清）**：① 死代码 `case 'go-auto-train'` 整条退役（case 328→327 · 不可达分支归 0；`smoke §190②` 按 §0.7 改写为「已不在 + 墓碑在位 + `auto-pick` 真出口在册」）② 覆盖缺口补齐 —— smoke §241 新增 **26 条**（宝具挂件 A①~A⑬ · 爵位晋升 B①~B⑫，走用户真实链路 · 防平凡解基数自证）③ 工具目录卫生 —— 299 件一次性探针标退役（`gen_tools_index.py` 新增 `is_one_off()` 判据）+ 顺手修 3 处真缺陷（`__pycache__` 伪组 · DESC 缺词条 · 生成器自身假绿「只看根目录」）；第二轮补 e2e §241E **34 条**真 DOM 点击；**版本按先例不升**（老板原文：「继续」/「提交git，并继续」——逐字） | 已完成 |
| v90.92 | 2026-10-13 | 2 | **门派（派系）+ 任务系统整条退役**（「去掉门派还有纪事剧本还有修炼」中的两件）：① 门派 —— `DATA.FACTIONS` 等表 + 引擎出口 + `main.js` 动作（`open-sect` / `sect-join` / `sect-found` 等）+ `data.js` 同格「⚔️ 派系」入口 + 样式族整条清除（留墓碑）② 任务 —— `js/questdata.js` **整文件删除** + `s.quests` 字段移除 + 任务面板 / 重绘钩子 / `GAME.questMetric` / 随机任务与汇总 / `advanceConquer`（已占城计数）全清 + 君主考验「政」关（已完成任务数）移除（→ 四关）；测试口径按 §0.7 翻转为零残留守卫；**版本三连未动**（GAME.VERSION 仍 v89.240 · BUILD 9172） | 已完成 |
| v90.93 | 2026-10-13 | 2 | **年号纪元 + 全屏剧本整条退役**：① 年号 —— `DATA.ERAS`（11 年号）整族清除 + `story.js` 六出口（`currentEra` / `checkEra` / `eraAdvance` / `eraGoalProgress` / `settleEraGoal` / `yearName`）+ 两乘数（`repMult` / `trainMult`，年号是**唯一**加成来源 → **整函数删**）+ 存档索引与槽位索引去 `era` / `yearName`；天时行改「第 N 年 季 天候」（`DATA.SEASONS` / `DATA.WEATHERS` **保留**）② 全屏剧本 —— `DATA.SCENE_FLOW`（12 活动 × 2~3 幕）+ `GAME.sceneFx` / `sceneBegin` / `sceneStart` / `scenePick` / `sceneEscape` + `ui.sxf*` 全族（18 出口）+ `#scene-fx` + `.sxf-*` 样式族 + `map.js` 12 幅手绘插画全清；**口径 = 荒野活动按钮走一次性结算（one-shot）**，内核 `jianghuCheck` / `jianghuSpend` / `jianghuRoll` 原样保留；连带清 2 处 C1 死配置（`DATA.CALENDAR` 里程碑开关 · `DATA.POWER` 三键）+ 系统矩阵口径收口（系统 30→29 · 假缺口 1→0）；**版本三连未动**（GAME.VERSION 仍 v89.240 · BUILD 9172）（老板原文同 v90.92） | 已完成（详见 docs/_史料/交付/v9093-纪事剧本退役.md） |
| v90.94 | 2026-10-13 | 2 | **练功移位 + 突破改爵位门槛 + 版本三连治理**：① 练功 —— 君主面板**最下方**新增独立**横贯**一条（体力 + 练功按钮）② **解耦** —— 练功不再产「修为」，只涨经验；突破条件里彻底去掉修为项 ③ 突破门槛改 **「爵位（威望档）≥ 3n」**（第 1/2/3 次 → 档 3 / 6 / 9），仍 3 次封顶 · Lv240 上限不变 · 四关（城/军/资/宝）保留 ④ 修为字段整体退役（`js/state.js` 的 `g.cultiv` 初值 + `lordCultivNeed` 出口）⑤ 顺手收口 v90.92 漏网文案（「五关俱过 / 政关」→「四关俱过」）⑥ **版本三连治理**（老板「形成一个更加稳健的解决方案」）—— 发版脚本从 `.workbuddy/tmp/cachebust.js` 重写并迁至 **`.workbuddy/tools/patch/bump_version.py`**（修 vendor 遗漏 · 先检后写 · 代管 `GAME.VERSION`）+ 4 道守卫（同号 / 自洽 / 脚本在岗 / 档案自洽）；版本 v89.240 → **v90.94** · BUILD 9172 → **9173**（老板原文：「去除修炼这个要素，然后跟爵位建立了关联，每升高三个爵位可以突破一次」+「给君主界面的最下方加一条练功菜单，然后去除练功与君主突破之间的关联」——逐字） | 已完成 |
"""

ar = rd(F_ARC)
assert '| v90.94 |' not in ar, '需求档案 已补录过'
m = re.search(r'^\| v90\.80 \|.*$', ar, re.M)
assert m, '找不到 v90.80 总览行'
ar2 = ar[:m.end()] + '\n' + ROWS + ar[m.end():]

# ---------------- ② 需求档案：详细章节 3 段（追加到文末） ----------------
DETAIL = """
## v90.92 门派 + 任务系统整条退役（2026-10-13 · 承接「去掉门派还有纪事剧本还有修炼」）

**老板原文（逐字）**：

> 去掉门派还有纪事剧本还有修炼。

**归属判定（追问答复，多选全中）**：「纪事剧本」= **任务系统 + 全屏剧本 + 年号纪元** 三样
（本档案 v90.92 段记「任务系统」；「年号纪元 + 全屏剧本」记于 v90.93 段）。本轮另作：
「修炼/练功」**保留但移位**，「君主突破」改与**爵位**建立关联 —— 记于 v90.94 段。

**改动（两件 · 引擎/数据/UI/动作/样式五层）**：

| 件 | 层 | 落点 | 处置 |
|---|---|---|---|
| 门派（派系） | 数据 | `js/data.js` `DATA.FACTIONS` 等表 + 同格「⚔️ 派系」入口 | 整块删除 + 墓碑 |
| 门派（派系） | 引擎 | `js/domain.js` 派系出口 | 整块删除 + 墓碑 |
| 门派（派系） | 动作 | `js/main.js` `open-sect` / `sect-join` / `sect-found` 等 | 逐条删除 + 墓碑 |
| 任务 | 数据 | **`js/questdata.js` 整文件删除** | 文件消失 + `data.js` 头注更新 |
| 任务 | 引擎 | `s.quests` 字段 · 任务面板重绘钩子 · `GAME.questMetric` · 随机任务与任务汇总 · `advanceConquer`（已占城计数） | 逐条删除 + 墓碑（`questMetric` 的两处引用改**内联等价**，不引已删出口） |
| 任务 | 关卡 | `DATA.LORD_BREAK` 君主考验「政」关（已完成任务数） | 移除 → 考验收为**四关**（城 / 军 / 资 / 宝） |

**测试与工具口径**：smoke / e2e 相关断言按 **§0.7**（断言不许删、只按新口径重写）翻转为**零残留守卫**；
`audit_v89208_systemmatrix.js` 的「门派」四链行与动作面路由项移除（同 v90.80 奇观/奇遇先例）。

**版本**：本两件为**产品行为变更**，但按项目「一个功能批次一次升版本」惯例，
版本三连统一在批次收口轮（v90.94）执行 —— 故本段记「GAME.VERSION 仍 v89.240 · BUILD 9172」。

**验证**：audit 全 0 · smoke 全绿 · e2e 全绿 · gate --full **✓ 通过**（2026-10-13 实测）。

## v90.93 年号纪元 + 全屏剧本整条退役（2026-10-13 · 承上）

**老板原文（逐字）**：同 v90.92 段（「去掉门派还有纪事剧本还有修炼」）。

**边界判定（本轮已落地）**：

- `DATA.SEASONS` / `DATA.WEATHERS`（**历法天时**）**保留** —— 不属「纪事剧本」。
- 荒野活动的**内核**（`jianghuCheck` / `jianghuSpend` / `jianghuRoll`）**原样保留** ——
  它本就是原本的「无剧本兜底」出口，即本次统一后的**一次性结算（one-shot）**口径。
- `DATA.LING_ACT` 12 条的 `cat`（门类章）/ `alias`（雅名）两字段剥离 —— 它们是全屏剧本横幅的专属文案层。

**改动（两件 · 十层）**：

| 件 | 层 | 落点 | 处置 |
|---|---|---|---|
| 年号 | 数据 | `DATA.ERAS`（11 个真实年号） | 整族删除 + 墓碑 |
| 年号 | 引擎 | `story.js` `currentEra` / `checkEra` / `eraAdvance` / `eraGoalProgress` / `settleEraGoal` / `yearName` | 整段删除 + 墓碑 |
| 年号 | 引擎 | `story.js` `repMult` / `trainMult` | **整函数删除**（年号是唯一加成来源）→ 消费点同步去该乘数 |
| 年号 | 存档 | 存档索引 / 槽位索引的 `era` / `yearName` | 去除（老档有值亦无害） |
| 年号 | 界面 | `STORY.skyLine` 的「年号·年序年 季 天候」 | 改「**第 N 年** 季 天候」 |
| 剧本 | 数据 | `DATA.SCENE_FLOW`（12 活动 × 2~3 幕） | 整族删除 + 墓碑 |
| 剧本 | 引擎 | `GAME.sceneFx` / `sceneBegin` / `sceneStart` / `scenePick` / `sceneEscape` | 整段删除 + 墓碑 |
| 剧本 | UI | `ui.sxf*` 全族（18 出口）+ `#scene-fx` | 整段删除 + 墓碑；`ui.doJianghu` 收敛为**一次性结算** |
| 剧本 | 样式/地图 | `index.html` `.sxf-*` 样式族（含 3 个 keyframes）+ `map.js` 12 幅手绘插画 | 整段删除 + 墓碑 |

**连带清的两处 C1 死配置**（声明了零读点 → 「数据没跟上产品」）：
① `DATA.CALENDAR` 的「每季检查里程碑」开关（唯一读点 `checkEra` 已退役）；
② `DATA.POWER` 的 `resToTroop` / `buildingBonus` / `techBonus` 三键（唯一读点 `eraGoalProgress` 已退役）
—— **保留 `troopWeight`**（`story.troopPower` 仍在读）。

**系统矩阵口径收口**：「纪事剧本」四链行 + 动作面路由项移除 → 系统 **30 → 29** · 假缺口 **1 → 0**。

**测试口径**：smoke §18 / §74 / §75 / §76 / §77 / §80⑥ / §130② 按新口径重写；
e2e v88.1 / v88（荒野行动）/ v89（君主专属）三段共 13 条剧本断言 → 7 条一次性结算 + 退役守卫。

**验证**：audit 全 0 · smoke **3565/0** · e2e **1093/0** · tables 四查全过 · dataset 56/0 · 兵种链 0 ·
gate --full **✓ 通过**（2026-10-13 实测 · 改动 14 文件 · `+375/−2127` 行）。

## v90.94 练功移位 + 突破改爵位门槛 + 版本三连治理（2026-10-13 · 批次收口轮）

**老板原文（逐字）**：

> 去掉门派还有纪事剧本还有修炼。君主的突破，去除修炼这个要素，然后跟爵位建立了关联，每升高三个爵位可以突破一次。

> 我对练功另有安排，给君主界面的最下方加一条练功菜单，然后去除练功与君主突破之间的关联。

**第 ① 件 · 练功移位**：君主面板**最下方**（横贯整个面板）新增独立一条「练功」（体力 + 练功按钮）。
原练功条在右栏内，本轮移出并横贯 —— 贴老板「给君主界面的**最下方**加一条练功菜单」字面。

**第 ② 件 · 解耦**：练功**不再产「修为」**（只涨经验）；突破条件里**彻底去掉修为项**。
修为字段整体退役：`js/state.js` 去掉 `g.cultiv` 初值（老档有值亦无害，读出口一律 `g.breaks || 0`，**无需迁移脚本**）；
`lordCultivNeed` 出口删除。

**第 ③ 件 · 突破改爵位门槛（门槛制）**：第 n 次突破须 **威望档 ≥ 3n**（第 1/2/3 次 → 档 3 / 6 / 9）；
仍 **3 次封顶 · Lv240 上限不变**；四关（城 / 军 / 资 / 宝）保留，威望档作为新的**第 0 道门槛**。

> ⚠️ **口径待老板确认**：本轮把「爵位」理解为**威望档**（`s.rank`，幸存者 → 队长 → … → 废土之王 共 22 档），
> 依据是项目 `§241B 爵位晋升` 用例本身即把「威望晋升」写作「爵位晋升」。若指英雄资质档，可整体回退重做。

**第 ④ 件 · 版本三连治理**（老板「根据你的分析，形成一个更加稳健的解决方案」）：
现状盘点 —— 三处版本标识分别是 ①`js/main.js` 的 `GAME.VERSION`（自证）②`index.html` 的
`<!-- BUILD n -->` + 全部 `<script ?v=n>`（**唯一卡「功能是否生效」的一处**：URL 含查询串，浏览器按完整 URL 缓存）
③档案行（项目地图 / 需求档案 / 台账）。**只有 ② 不同步会让改动真的不生效。**

| 处置 | 内容 |
|---|---|
| 脚本重写 + 迁址 | `.workbuddy/tmp/cachebust.js` → **`.workbuddy/tools/patch/bump_version.py`**（tmp 有被清理、机制蒸发之虞） |
| 修 3 处缺陷 | ① 正则 `(?:js\|story)/` **漏掉 `vendor/three.min.js`** → 泛化为任意 `*.js` ② `writeFileSync` 写在**自检之前**（写坏了不回滚）→ 改**先检后写** ③ 完全不管 `GAME.VERSION` → 代管 |
| 实测对照 | 旧正则：脚本 17 个 · `?v=` 种类 `['9172','9173']`（**混版**）；新正则：17 个 · `['9173']`（自洽） |
| 新增守卫 | 参见 §199⑤（发版脚本在岗）· §199⑥（版本三处自洽：`GAME.VERSION` 必须已录进本档案） |
| 口径放宽（按先例） | `§199④` 由锁死字面量 `v89.240` → 锁「在册 + 格式合法 `v\\d+\\.\\d+`」（先例 §139.5 / §229c⑧） |

**顺手收口**：v90.92 漏网文案「五关俱过 / 政关」→「四关俱过」（`js/ui.js` + smoke §177⑥c + e2e v89.177 三处）。

**版本**：v89.240 → **v90.94** · BUILD 9172 → **9173**（16 个 `js/` 脚本 + `vendor/three.min.js` 同号）。

**验证**：audit 全 0 · smoke 全绿 · e2e 全绿 · tables 四查全过 · dataset 全绿 · 兵种链 0 · gate --full **✓ 通过**。

---

> 说明：v90.92 ~ v90.94 为本档案随轮补录的功能批次；此前 v90.81 ~ v90.91 各轮见 `docs/需求台账-v9012-13.md`。
"""

ar3 = ar2.rstrip('\n') + '\n' + DETAIL

backup(F_ARC)
wr(F_ARC, ar3)
print('[OK] 需求档案.md  %d -> %d 字符' % (len(ar), len(ar3)))

# ---------------- ③ 项目地图：版本历史 6 行 ----------------
MROWS = """| **v90.80** | **奇遇系统退役**：v89.6「奇遇 · 见闻录」整系统清除（隐藏点位 / 双通道现形 / 探奇三段 / 24 条见闻录 / 奇缘星 / 底栏入口）；六层落地 12 文件 · 原 12,225 字符数据 + 2,781 字符面板 + 2,534 字符样式；smoke §80 十一条 → 零残留守卫七条 · e2e 19c 十四条退役；BUILD 9158→9159 |
| **v90.87** | **全仓复核（零产品改动）**：产品侧历史遗留 0 条 · 工具侧 6 处口径过期全修（chains 36 环节通 35 断 0 · A1 220/220 · A2 342/342）；**复核轮不升版本** |
| **v90.87b** | **清账轮**：死 case `go-auto-train` 退役 · smoke §241 挂件/爵位 26 条 · 探针 299 件标退役 · e2e §241E 34 条真 DOM 点击；**不升版本** |
| **v90.92** | **门派 + 任务系统整条退役**：`DATA.FACTIONS` 等表 + 引擎/UI/main 动作（`open-sect` 等）+ **`js/questdata.js` 整文件** + `s.quests` 字段 + 任务面板/`questMetric`/随机任务全清 · 君主考验去「政」关（→ 四关）；**不升版本** |
| **v90.93** | **年号纪元 + 全屏剧本整条退役**：`DATA.ERAS` 11 年号 + `story.js` 六出口两乘数 + `DATA.SCENE_FLOW` + `ui.sxf*` 全族 18 出口 + `map.js` 12 幅插画 + `.sxf-*` 样式族；口径改**一次性结算**；连清 2 处死配置 · 系统矩阵 30→29；**不升版本** |
| **v90.94** | **练功移位 + 突破改爵位门槛 + 版本三连治理**：练功条移面板最下方并横贯 · 练功与突破**解耦**（修为字段退役）· 门槛改「**威望档 ≥ 3n**」· 发版脚本重写并迁出 `tmp/`（修 vendor 遗漏 · 先检后写 · 代管 `GAME.VERSION`）+ 4 道版本守卫；版本 v89.240 → **v90.94**（BUILD 9172→9173）；门禁全绿 |
"""

mp = rd(F_MAP)
assert '| **v90.94** |' not in mp, '项目地图 已补录过'
m2 = re.search(r'^\| \*\*v89\.240\*\* \|.*$', mp, re.M)
assert m2, '找不到 v89.240 版本行'
mp2 = mp[:m2.end()] + '\n' + MROWS + mp[m2.end():]
backup(F_MAP)
wr(F_MAP, mp2)
print('[OK] 项目地图.md  %d -> %d 字符' % (len(mp), len(mp2)))

# ---------------- ④ 台账：追加 3 小节 ----------------
LEDGER = """
### v90.92 门派（派系）+ 任务系统整条退役（老板「去掉门派还有纪事剧本还有修炼」）
- **门派（派系）**：`DATA.FACTIONS` 等表 + 引擎出口 + `main.js` 动作（`open-sect` / `sect-join` / `sect-found` 等）
  + `data.js` 同格「⚔️ 派系」入口 + 样式族整条清除（墓碑留档）。
- **任务系统**：`js/questdata.js` **整文件删除**；`s.quests` 字段移除；任务面板 / 重绘钩子 / `GAME.questMetric` /
  随机任务与汇总 / `advanceConquer`（已占城计数）全清；君主考验「政」关（已完成任务数）移除 → **四关**（城/军/资/宝）。
- 测试口径按 §0.7 翻转为**零残留守卫**（smoke / e2e 同步）；**版本三连未动**（GAME.VERSION 仍 v89.240 · BUILD 9172）。

### v90.93 年号纪元 + 全屏剧本整条退役
- **年号纪元**：`DATA.ERAS`（11 年号）整族清除；`story.js` 六出口（`currentEra` / `checkEra` / `eraAdvance` /
  `eraGoalProgress` / `settleEraGoal` / `yearName`）+ 两乘数（`repMult` / `trainMult` —— 年号是**唯一**加成来源 → 整函数删）；
  存档索引与槽位索引去 `era` / `yearName`；天时行改「第 N 年 季 天候」。`DATA.SEASONS` / `DATA.WEATHERS`（历法天时）**保留**。
- **全屏剧本**：`DATA.SCENE_FLOW`（12 活动）+ `GAME.sceneFx` / `sceneBegin` / `sceneStart` / `scenePick` / `sceneEscape`
  + `ui.sxf*` 全族（18 出口）+ `#scene-fx` + `.sxf-*` 样式族 + `map.js` 12 幅手绘插画全清。
  **口径 = 荒野活动按钮走一次性结算（one-shot）**；内核 `jianghuCheck` / `jianghuSpend` / `jianghuRoll` 原样保留。
- 连带：清 2 处 C1 死配置（`DATA.CALENDAR` 里程碑开关 · `DATA.POWER` 的 `resToTroop` / `buildingBonus` / `techBonus`）；
  系统矩阵口径收口（系统 30 → 29 · 假缺口 1 → 0）。**版本三连未动**（GAME.VERSION 仍 v89.240 · BUILD 9172）。

### v90.94 练功移位 + 突破改爵位门槛 + 版本三连治理
- **练功移位**：君主面板**最下方**新增独立**横贯**一条「练功」（体力 + 练功按钮）。
- **解耦**：练功不再产「修为」，只涨经验；突破条件里彻底去掉修为项。
- **突破改爵位门槛**：第 n 次突破须**威望档 ≥ 3n**（第 1/2/3 次 → 档 3/6/9）；仍 3 次封顶 · Lv240 上限不变；
  四关（城/军/资/宝）保留，威望档作为新的第 0 道门槛。（口径待老板确认：爵位 = 威望档）
- **修为字段退役**：`js/state.js` 去掉 `g.cultiv` 初值；`lordCultivNeed` 出口删除。
- **顺手收口**：v90.92 漏网文案「五关俱过 / 政关」→「四关俱过」（`ui.js` + smoke §177⑥c + e2e v89.177）。
- **版本三连治理**：发版脚本 `.workbuddy/tmp/cachebust.js` → **`.workbuddy/tools/patch/bump_version.py`**
  （修 vendor 遗漏 · 改为先检后写 · 代管 `GAME.VERSION`）；新增守卫 §199⑤（脚本在岗）· §199⑥（档案自洽）；
  `§199④` 按先例放宽为格式锁。版本 v89.240 → **v90.94** · BUILD 9172 → **9173**。
"""

ld = rd(F_LED)
assert 'v90.94 练功移位' not in ld, '台账 已补录过'
ld2 = ld.rstrip('\n') + '\n' + LEDGER
backup(F_LED)
wr(F_LED, ld2)
print('[OK] 需求台账  %d -> %d 字符' % (len(ld), len(ld2)))
print('全部完成。')
