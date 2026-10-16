# 评测方案 · 《我在废土有座城》v91.18 独立评测（600× · 12 现实小时）

> 对象：`E:\Deepseekdb`（index.html + js/ 全模块，GAME 命名空间）
> 原则：**不复用本项目任何既有评测脚本/报告的方法论**（`.workbuddy/tools/playtest/`、历史 600× 报告仅作背景事实，不作方法依据）。本方案按软件测试行业通用方法体系独立设计。
> 运行态：无头 Chromium（Playwright）+ 本地 HTTP 服务，`timeScale=600`，连续运行 **12 现实小时**（≈300 游戏日）。

---

## 一、方法论选型与行业依据

| # | 方法 | 行业出处 | 在本评测中的落地 |
|---|---|---|---|
| M1 | **基于风险的会话测试管理（SBTM）** | Context-Driven School（James Bach）；ISTQB 高级测试大纲 | 5 个章程会话（人格机器人）+ 混沌会话，每个会话有明确 charter、时间盒、探查记录 |
| M2 | **模型化功能覆盖测试** | ISO/IEC/IEEE 29119 测试设计技术 | 从分发器静态提取 **327 个 data-action** 建动作注册表，作为"全功能按钮"的判定基准；运行时动态枚举 DOM 交互元素与注册表双向对账 |
| M3 | 长时浸泡/ soak 测试 | 性能测试行业惯例 | 12h × 600× 连续运行，30s 采样，监控内存/错误累积/时间记账/状态量纲 |
| M4 | 人物角色场景测试 | 游戏行业 playtest 惯例 | 城主/统帅/商人/探索者/集大成者 5 类玩家画像，按真实游玩目标驱动 |
| M5 | 混沌/随机测试（Smart Monkey） | 随机测试经典手法 | 周期性随机爆发：随机视图、随机点击、随机按键，寻找崩溃/卡死/异常态 |
| M6 | 启发式评估（Nielsen 十大可用性原则） | 人机交互通用 | 探查中同步记录 UX 缺陷（可见性/反馈/防错/一致性等），单列一类发现 |
| M7 | 缺陷管理（ISTQB） | 缺陷生命周期 | 所有发现按 严重度×优先级 分级，行为链逐步可复现 |
| M8 | 对账/不变式检查 | 基于属性的测试思路 | 12 条状态不变量每次采样校验（时间单调、无负值、无 NaN、队列自洽、内存趋势等） |

**为什么不用既有方式**：既有 `r600_playtest.js` = Node 直加载模块 + `simulateBulk` 补算，测的是"域层纯函数在批量推进下的数值健康"，**没有任何真实 UI 交互、没有真实按钮点击、没有渲染/事件层**。本方案从**真实浏览器 + 真实 DOM 点击 + 真实主循环**切入，覆盖域层之上的整机行为，与既有方法互补且不重叠。

---

## 二、测试范围

**范围内**：创建屏 → 游戏主界面全部 12 个视图（city/ext/map/generals/marches/admin/shop/bag/collection/reports/auto/settings + galaxy）→ 全部模态面板 → 键盘快捷键 → 存档系统（导出/导入/槽位）→ 600× 下 300 游戏日的经济/战斗/建造/研究/英雄/自动化全链路。

**范围外**：美术资源主观质量；服务器/联机（单机游戏无）；代码审查（另立项）。

---

## 三、测试章程（SBTM Charters）

| ID | 章程 | 时间窗 | 动作画像（正则） |
|---|---|---|---|
| C0 | 建档与初始设置：创建屏全按钮、600× 设置、主题/比例 | 0:00–0:15 | create-*, chip-set, set-* |
| C1 | 城主：建设/升级/资源/税率/自动化 | 0:15–2:30 | build-*, confirm-build, confirm-upgrade, ext-*, rush-*, tax-step, set-main-city, assign-mayor, demolish-ask |
| C2 | 统帅：募兵/英雄/出征/战斗/军务 | 2:30–4:30 | train-*, select-train, gen-*, exp-*, bt-*, march-*, auto-march*, siege, tower-build |
| C3 | 商人：游商/市易/背包/锻造/强化/寄售 | 4:30–6:30 | shop-*, market-*, bag-*, forge-*, enh-*, equip-*, consign-*, qb-* |
| C4 | 探索者：地图/野地/奇观/采集/侦查 | 6:30–8:30 | map-*, wild-*, wonder-*, gather*, scout-*, fort-* |
| C5 | 集大成者：收藏/神器/战术/节度/星球/存档 | 8:30–10:30 | collect-*, artifacts, tactic-*, tac-*, jieyue-*, planet-*, adm-*, save*, open-lab, farm-* |
| C6 | 全覆盖复扫 + 键盘 + 边界用例 | 10:30–11:45 | 全部（复扫未触及项） |
| C7 | 收尾：终态采样、存档导出、报告 | 11:45–12:00 | save-* |

每个章程会话内：先**动态扫描**该视图全部可见按钮（逐一点击），再按画像做**目标驱动**操作（有资源就建设、有兵就出征）。混沌猴在 C1–C5 期间每 ~45min 爆发 90s。

---

## 四、覆盖账本（判定"所有功能按钮均需触及"的唯一基准）

1. **静态注册表**：分发器 327 个 action（`js/main.js` `GAME.action` 的 case 全集）+ 12 个视图 tab + 键盘快捷键（1-9 / Shift+1-3 / Esc / Tab / Enter）。
2. **动态枚举**：每视图/每模态下 `button:not([disabled]), [data-action]:not([disabled]), .tab[data-view], .chip, select, input[type=range]` 中**可见**元素逐个真实点击。
3. **对账**：每个 action 记一态——
   - `touched`：真实点击且触发了业务动作（in-page `GAME.action` 包裹器确认）
   - `opened`：点击后仅弹出面板/确认框（ask 类，随后取消）
   - `blocked`：按钮存在但 disabled，记录禁用原因（data-why）
   - `unreachable`：12h 内未遇到可点场景（记录解锁条件推断）
4. **死按钮检测**：DOM 里有 `data-action` 但注册表中无此 action（孤儿），或注册表中有但 UI 永不呈现（死代码）——双向清单进报告。

---

## 五、不变量（每次 30s 采样校验，违反即抓现场）

| ID | 不变量 |
|---|---|
| I1 | 游戏时钟 `world.elapsed` 单调递增，绝不回退 |
| I2 | 时钟速率 ≈ timeScale±20%（600× 下 1 现实秒 ≈ 600 游戏秒），补算事件单独记账 |
| I3 | 全部资源有限、非负、无 NaN/Infinity |
| I4 | 兵力/队列数为非负整数；队列进度 `elapsed ≤ totalTime` |
| I5 | 英雄数 ≥1，忠诚/体力 ∈ [0,100] |
| I6 | 民心 ∈ [0,100]，税率 ∈ [0,1] |
| I7 | 人口 ≥0 且不超仓容上限的 5 倍（防爆） |
| I8 | 存档 JSON < 4.5MB（localStorage 5MB 配额红线） |
| I9 | JS 堆内存 < 1.2GB 且无 2h 单调爬升（泄漏趋势） |
| I10 | msgLog/log 数组长度有界（≤1000） |
| I11 | 页面无未捕获异常/未处理 rejection（error 钩子累计） |
| I12 | 地图/map3d 渲染循环存活（canvas 存在且 map3d.enabled） |

违反任一 → 立即截图 + 全状态 dump + 事件记录（含前后 5 条行为链）。

---

## 六、安全策略（防止自动化毁档）

- **原生对话框**（confirm 等）：一律 dismiss（= 取消），内容记入事件流。
- **危险动作黑名单**（只允许"点击→验证有确认→取消"，永不确认执行）：
  `new-game, demolish-do, demolish-whole-do, save-slot-drop-do, save-slot-load-do, wild-abandon-do, troop-disband-do, city-abandon-arm, fort-abandon-arm, salvage-equip-do, sell-equip-do, release-captives, tactic-del, tac-del, plan-del, planet-create, planet-create-stay, do-jianghu, cg-clear, consign-all, jieyue-xc, gather-finish, wild-withdraw, march-rush, train-rush, rush-build, rush-ext, rush-tech, do-train-boost`
- **资源消耗类**（market-sell/shop-buy/use-item 等）：允许真实执行但每次限 1 单位/1 件，模拟真实玩家误操作成本。
- 持久化浏览器上下文（userDataDir），localStorage 存档跨重启保留 → 支持"关页重进/离线补算"边界测试。

---

## 七、记录格式（行为链）

`logs/behavior.jsonl`，每次交互一行：
```json
{"t":"ISO8601","gt":游戏秒,"sid":"C1","type":"click|key|nav|dialog|sys",
 "sel":"button[data-action=confirm-build]","action":"confirm-build","label":"建造",
 "view":"city","modal":"bldg-list","result":{"fired":true,"modal":null,"toast":"建造中…","err":0},
 "delta":{"grain":-1200,"qBuild":+1},"shot":null}
```
`logs/samples.jsonl`：30s 全量状态采样。`logs/events.jsonl`：错误/违例/阶段/截图/恢复。`logs/coverage.json`：覆盖账本快照（每 5min 落盘）。

---

## 八、进入/退出准则

- **进入**：冒烟通过（加载 0 错误、tick 推进、地图渲染、600× 生效）。
- **退出**：12h 跑完且 —— ① 无 I1–I12 未记录违例；② 覆盖率报告产出（touched+opened+blocked+unreachable 四态齐全）；③ 行为链 ≥ 3000 条或覆盖停滞说明；④ 报告三件套（总报告/整改建议/扩充玩法建议）完成。

## 九、交付物

```
.workbuddy/eval_20261016/
  harness/            # 评测工程（可复跑）
  logs/               # 行为链/采样/事件/覆盖账本
  shots/              # 关键截图
  reports/测评报告.md      # 总报告
  reports/整改建议.md      # 缺陷分级 + 复现链 + 修复建议
  reports/扩充玩法建议.md  # 基于实测短板的玩法扩充
```
