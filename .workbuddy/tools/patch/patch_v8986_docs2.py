# -*- coding: utf-8 -*-
"""v89.86 · 文档同步（续）：设计规范 §98 / AI工作备忘 §106 / 门派系统规则 §十七"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def append(p, text, tag):
    src = read(p)
    if text.strip()[:120] in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    if not src.endswith('\n'):
        src += '\n'
    write(p, src + text)
    assert text.strip()[:120] in read(p), '落盘回查失败：' + tag
    print('OK  ' + tag)


# ============ 设计规范 §98 ============
append(os.path.join(ROOT, 'docs', '设计规范.md'), """

## 98. v89.86 开发整改清单执行（21 条 + 门派 P1）（2026-09-20）

> 来源 `docs/开发整改清单.md`；全量执行明细与验收见 `docs/v8986改动说明.md`。
> 本节只登记**会影响后续开发方式的规范与出口**。

### 98.1 新增唯一出口（登记进 §十一 清单）

| 语义 | 出口 | 说明 |
|---|---|---|
| 出征战力比 | `ui.expPowerOf()` | 预估行与"兵力悬殊二次确认"共用 —— 面板报的值 = 确认闸判的值 |
| 募兵上限归因 | `GAME.trainLimitOf(troopId)` | `{cap,popBound,resBound,reason,lack}`；`maxTrainCount` 收编为其 `cap` |
| 前置"升级中" | `GAME.pendingUpgradeOf(city, bid)` | 建造队列是唯一事实来源（与 `wallPendingOf` 同一手法） |
| 军账守恒 | `_expArmySettled`（battle.js 局部） | `march.arrive` 置 false；expedition 在归还点置 true；失败兜底折返防双重回补 |
| 自动化预算 | `GAME.autoBudgetCheck(cost)` + `GAME.autoReservePct()` | 「花完至少留下花前存量的 pct%」；只拦自动化 |
| 离线推进上限 | `GAME.offlineCapDays()` + `GAME.simulateOfflineOverflow()` | 超限段五折折算资源/供奉；历法/月俸/入侵/队列不推进 |
| 队列花金提速 | `GAME.queueAt(kind,ref)` / `queueRushCost` / `queueRushPay` | 按位置查找（不依赖渲染下标）；立即完成价 = 工程价 20% × 剩余比例 |
| 故事待阅 | `GAME.SG.pending/defer/takePending` | 触发只入列；阅读统一走 `ui.openStory`；上限 30 条 |
| 任务前往 | `ui.questJumpOf(def)` / `ui.doQuestGo(kind,id)` | metric→去处一处归表；建筑类定位到对应格 |
| 任务可达性 | `GAME.questReachable(def)` | 生成侧只在 `rollBatch` 一处拦（三条生成路径全过它） |
| 门派被动 | `GAME.sectBonus(key)` + `GAME.sectTraitText(sc)` | 六派被动唯一发放口；无门派返回 0（逐字节兼容） |

### 98.2 交互口径（新增约定）

- **战力悬殊二次确认**：战力比 < 0.5 时首击只"上膛"（按钮变红复述战力比，置 `ui._expForceArmed`），
  再击才发兵；兵力/将领/方式一变即还原（`ui.resetExpConfirm` 唯一出口）。
  侦查与"占领己方野地（不战）"不设此闸。
- **故事触发 = 待阅**：`sgTryTrigger/sgTryAct` 一律经 `ui.sgDefer` 入待阅（不再全屏弹出）；
  顶栏「史册」徽标 = 待阅数；史册页「待阅逸闻」区阅读/忽略。
- **军务总览**：`data-view="marches"` 内容升级为五段（城内/驻守野地/采集队/行军/伤兵），
  行军段为**全境**口径（含出发城列）；顶栏标签「军务」。
- **离线推进上限**：默认 7 游戏日（1/3/7/30/不限可调）；超限段五折折算。
- **自动化预算闸门**：默认保留 5%（0/5/10/20/30）；超线候选跳过，全挡则暂停（不关开关）；
  手动建造/研究不受影响。

### 98.3 测试口径（本轮确立）

- **smoke 的 DOM stub 已补 `querySelector/querySelectorAll`**（`.sgr-bg` 固定两张）——
  故事阅读器（`ui.sgRender`）等"读子元素"的界面函数可在 smoke 里跑。
- **jsdom 里"量尺寸"断言必红**：布局类断言要么注入 rect 桩、要么改**结构口径**
  （如"满界面档 = modal.classList.contains('modal-max')"）。
- **e2e 抓取元素引用要趁新鲜**：阅读器等"首次创建"的元素，必须在打开后**重查**，
  不能沿用打开前抓的引用（存量为 null）。
- **负向判据要限定作用域**：`!/m\\.cityId === c\\.id/` 这类全文件否定会误伤
  同形的其它统计（ui.js:622 的行军计数仍在按城过滤，那是另一件事）。
""", '设计规范 §98')

# ============ AI工作备忘 §106 ============
append(os.path.join(ROOT, 'docs', 'AI工作备忘.md'), """

### 106. v89.86 整改清单执行 · 工程教训与口径（09-20）

**一、真 bug 两枚（都不是"看"出来的，是"扫"出来的）**

1. **任务 sub 与兵种 id 对不上**：`r07 铁骑成军`（'tieqi'）/ `r09 飞石破城`（'toushiche'）/
   `g22 铁骑三千`（'tieqi'）——`questMetric('troopCount', sub)` 恒 0，三条任务**永远做不完**
   并占每日名额。兵种实际 id 是 `tieji` / `toudan`。
   发现方式：写 P-08 可达性过滤探针时顺手做"sub 全量对齐扫描"，一网打尽。
   → 已在 smoke §85 加守卫：`troopCount` 的 sub 必须命中 `DATA.TROOPS`。
2. **`ui.openTacticModal` 同名覆盖**：v89.59 的"战术预设管理"占了 v26"逐兵种编辑器"的函数名，
   后定义整段盖掉前者 —— 「逐兵种」按钮打开的一直是预设页。更名 `ui.openTacticSets` 归位。
   audit 的"重复定义"检查正好抓它；顺手清掉注释里的 `data-action="..."` 字面量误报
   （audit 不剥注释 —— 写注释时别写完整的 data-action 模式）。

**二、行为探针的价值（本轮 13 组 probe）**

- **P-25 的"竞态"是探针复现出来的**：`march.arrive → prepare` 在目标途中熄灭时返回 `!ok`，
  dispatch 已扣的兵**没有归还路径**（凭空消失、无日志）。600× 只是放大了触发概率。
  "派出去的兵必须有去向（归城/驻军/伤兵/战报）"由此固化为 `_expArmySettled` 不变量。
- **采样探针会踩夹具坑**：P-18 第一版探针"全部候选击穿保留线"测不出来 —— 城外候选
  造价便宜从闸门溜过去了。**夹具要能区分被测对象**（老教训第 N 次）。

**三、三条新测试纪律**

1. **smoke 的 stub 要跟着被测代码长**：本轮给 makeEl 补了 `querySelector/All`
   （`.sgr-bg` 固定两张），故事阅读器才能在 smoke 里跑真实渲染路径。
2. **jsdom 不做布局**：v89.47 的三条"量尺寸"断言在 jsdom 里**永远红**（rect 全 0）。
   布局断言要么注入 rect 桩（如点选跳转），要么改**结构口径**（`modal-max` 类在不在、
   `fitMini()` 侧长与 canvas 内部分辨率是否对齐）。
3. **e2e 的元素引用有"有效期"**：`#story-fx` 可能是本用例**首次创建** ——
   开卷前抓的引用是 null，必须在动作之后**重查**。同类：DOM 引用是活的，
   中间被别的断言重开就换内容（v89.6 已记过一次，这次是"元素本身还不存在"）。

**四、存量 e2e 的批量修复口径（v89.42~85 遗留 30 处 + 中断）**

- 江湖游历 v89.45 起默认剥离 → 相关五个测试块**显式临时挂载** `GAME.jianghuWildMounted = true`，
  跑完还原（与 smoke 同法：测的是"层本身"，与"默认剥离"两个判据都保住）。
- 提速面板改版（v89.49）→ 旧文案断言同步。
- 商城计数阈值随现行口径（`price>0 且 type∈SHOP_CATS`，实测 187）下调。
- 背包分组断言在**分页**下不稳 → 改判分组表（`ui.BAG_ITEM_CN` 唯一出口）+ 每类有实物。

**五、本轮结果**：audit 全 0 · smoke **2451/0** · e2e **1007/0** ·
破坏测试 **12/12 变红**（`break_v8986.py`）· 探针 13 组全绿。BUILD 8986。
""", '备忘 §106')

# ============ 门派系统规则 §十七 施工记录 ============
append(os.path.join(ROOT, 'docs', '门派系统规则.md'), """- **v89.86 · P1 被动加成已实装**（2026-09-20 · 老板拍板）：六派被动全部落在**既有消费链**上 ——
  玄鹤门 行军速度 +8%（`march.speedFactor`）· 青锋阁 部队攻击 +6%（battle `atkMult`）·
  百草堂 战后伤兵回复 +15%（`returnArmy` 回收率）· 虎啸营 攻城伤害 +8%（`siegeMult`，仅攻城）·
  玄机阁 器械打造耗时 −15%（`GAME.train`，仅 craft）· 牧云庄 坐骑装备属性 +20%
  （`genEquipBonus` 坐骑乘链）。
  唯一出口 `GAME.sectBonus(key)`；**无门派时各链与今日逐字节一致**（破坏测试覆盖）。
  面板（名录 + 已入派态）显示被动文案（`GAME.sectTraitText`）。
  ⚠️ 与 §四 原表的差异：牧云庄原拟「坐骑产出 +20%」——"坐骑产出"无既有链，
  改「坐骑装备属性 +20%」（同驯马技巧链），守住"加成只走既有出口"的铁律。
  ⚠️ 仍待做：门派专属兵种（Lv7）、专属装备图纸（Lv6 阶段任务）、门派战（Lv10）、
  占州城 → 门派声望对接（与 §十三 P1 其余项 / P2 一并排期）。
""", '门派规则 §十七 P1 记录')

print('DONE')
