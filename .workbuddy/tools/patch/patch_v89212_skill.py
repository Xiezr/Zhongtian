# -*- coding: utf-8 -*-
# 沉淀 SKILL §123（append 模式，防 Edit 撞字符差异）
import io

P = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'

sec = """
## §123. 「均摊口径」缺陷改造（各资源/各类别共用一份） / 分账四件套 / 实机读侧栏的渲染时机（v89.212）

### 123.1 ⛔ 「各 X 数量不同，但最终结果一样」= **均摊口径**缺陷
老板原话「各资源地块数量不同，但是最终储存上限一样，应该是地块多的存的多吧」——
先找"是不是有一个数被多类共用"：`extStoreCapOf` 把 Σ(所有地块等级) 摊给四资源共用 →
哪类地块多、哪类少，上限全一样（改前实证：4田1木 与 1田4木 两城四资源全等 366.7万）。
**凡"多类别共用一份 pool"的口径，都是这类投诉的温床**（战斗加成/产量/容量/席位皆同族）。

### 123.2 分账改造四件套（照抄）
1. **底账出口**（新）：一次遍历算出**逐类**值 —— `GAME.extStoreCapByResOf(city)` →
   `{ grain, wood, stone, iron }`（归类映射走数据表：`EXT_BUILDINGS[type].res`，未知类型不计入）；
2. **合并口径保留**：`extStoreCapOf(city[, key])` 无 key = **Σ分账**（不是"总和取整一次"——
   账目自洽优先：合计 = 各类相加）；带 key = 该类；
3. **分账字段**：`storePartsOf` 增 `extByRes` / `capByRes`（`capByRes[k] = base + extByRes[k]`）；
4. **取值出口带 key**：`storeCapOf(city[, key])` —— 业务判定一律带 key，不带 key 只留给展示/兼容。
**取整纪律**：逐类在"该类等级和"上取整一次再相加 —— 与旧"总和取整"差 ≤ 类别数
（老断言期望值要按新口径重写，例：3×round(1×200万/6) + round(12×200万/6) = 4999999 ≠ 5000000）。

### 123.3 分账改造的**消费点清单**（逐资源循环里的 cap 一律带 key）
`tickOnce` · 离线 bulk · `simulateOfflineOverflow` · `overflowRotOf` · `addResCapped` ·
`transportPlanOf` · `systems._openChest` —— 七处。
⛔ **性能纪律（§11 的教训复用）**：循环内**不要**逐资源调出口（每 tick 城×资源次）——
**每城 `storePartsOf(ct).capByRes` 一次**、循环内查表；改完跑一次满城 tick 量时感受。
**老测试的连带**：凡"摆超限值/算封顶期望"的用例（storeCapOf 无 key 当尺度）全要升级为按资源
（smoke §158/§159/§160 · e2e §158/§160 本轮共 12 处）——判据语义才与实现同尺。

### 123.4 行序类需求（单列布局）
「左侧排序：A，B，C…」在**单列 grid** 上 = DOM 顺序即视觉顺序 → 只改渲染顺序（块体一字不动）。
断言三层：源码级"第 1~N 块 class 序"（§156 模式升级）+ 探针"目标序" + 实机真 DOM
（`querySelectorAll('.exp-quad .exp-sec')` 的序 **且** `offsetTop` 单调）——后两条防"源码对了但渲染没排"。

### 123.5 ⛔ 实机脚本读**主循环渲染的元素**（侧栏等）前，先主动渲染一次
`ui.enterGame()` 只做 `setView('city')` —— **侧栏（renderSide）不在其中**，由主循环**每秒**拍。
实机脚本 boot 后 ~0.5s 读 `#res-bar …` → **命中 0**（表现为读 title 全空），
且随后取 `[0].getBoundingClientRect()` 直接 `TypeError` 崩掉整个脚本。
**修法**：读侧栏/底栏/顶栏前 `G.ui.renderSide()`（或等 ≥1.2s）——e2e 里本就这么干
（`G.ui.renderSide();` 是既有惯例）；"选择器命中 0"先怀疑**渲染时机**，再怀疑选择器。

### 123.6 UI 文案改"按类动态"时，断言要查**拼接形态**
标签从写死（`另加仓储上限`）改为按归属资源动态（`'另加' + _rn212 + '上限'`）后：
- 值断言查**结果串**（`另加石料上限`，用该类型的真实资源名）；
- 源码级断言查**拼接形态**（`'｜每级另加' + (_rnB || '资源') + '上限 +'`）——
  查结果串会在"资源名映射变了"时误红。
"""

with io.open(P, 'r', encoding='utf-8', newline='') as f:
    s = f.read()
if '## §123.' in s:
    print('[skip] §123 已在册')
else:
    with io.open(P, 'w', encoding='utf-8', newline='') as f:
        f.write(s.rstrip() + '\n' + sec)
    print('[ok] §123 已沉淀')
