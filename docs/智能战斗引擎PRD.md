# 智能战斗引擎 PRD（星际战舰 / Deepseekdb）

> 用途：本文档是**战斗 AI 决策引擎**的重构需求规格，供外部开发者接手重写「智能战斗」模块使用。
> 阅读对象：引擎开发者。前置知识：本项目是纯静态站（无构建框架），战斗在浏览器端由 `bundle.js` 内的同步确定性引擎跑。
> 配套资料：本项目 `js/battle.js`（引擎执行器）、`js/tactic.js`（底层战斗会话/伤害原子）、`js/data.js` 的 `DATA.SMART_PLAN` / `DATA.TROOPS` / `DATA.STANCES` / `DATA.COUNTER`。

---

## 1. 文档目的与范围

**要重做什么**：玩家挂机/自动出征时，由系统代替玩家**逐回合下达「姿态（前进/防御/后退）+ 目标兵种」指令**的那一层决策逻辑（即「智能战斗」）。

**不在范围**：
- 底层战斗结算（`tactic.js` 的 `stepRound` 伤害/推进/射程衰减/先手）——**保留不动**，新引擎只消费它、不重写它。
- 兵种数值平衡（`DATA.TROOPS` 表）——只读取，不改写。
- 界面渲染——只保证新引擎产出的指令能被现有界面正确读取（见 §6 契约）。

**目标**：在保持「确定性、可重放、可存档」三大铁律的前提下，让自动战斗的决策质量（胜率 / 保兵率 / 交换比）不低于现状，并消除现状已知的几处非最优行为（见 §7）。

---

## 2. 现有引擎概览（格式 / 位置 / 生效方式）

### 2.1 代码格式
- **不是类、不是模块、不是插件系统**。就是一组挂在全局命名空间 `GAME.battle` 上的**普通函数**（ES5 风格 `function`，无箭头、无 class、无 import/export）。
- 决策参数全部来自 `DATA.SMART_PLAN`（一个普通对象字面量，定义在 `js/data.js`）。
- 引擎**完全确定性**：同样的输入（双方军队 + 英雄 + 指令序列）跑 N 次结果完全一致，无任何随机数。

### 2.2 文件位置
| 内容 | 文件 | 行段 |
|---|---|---|
| 智能引擎执行器（smartApply / smartStanceOf / smartPickTarget / smartArbitrate / stepBattle 内的托管分支） | `js/battle.js` | 477–762 |
| 决策参数表 `DATA.SMART_PLAN` | `js/data.js` | 1201–1272 |
| 阵位/姿态 `DATA.STANCES`、克制 `DATA.COUNTER`/`DATA.TROOP_ROLE`、兵种 `DATA.TROOPS` | `js/data.js` | 1058–1180 / 1133–1138 |
| 底层战斗会话 / 伤害原子（`begin`/`perAtk`/`perDef`/`perHp`/`clashFactor`） | `js/tactic.js` | 38 / 592–644 / 712–1214 |

### 2.3 如何生效（交付后必须做的）
1. 改 `js/battle.js` 与 `js/data.js`（或按本 PRD §6 约定的接口新增/替换函数）。
2. **必须重建 bundle**：`python .workbuddy/tools/patch/build_bundle.py`（浏览器只加载 `js/bundle.js`，不加载分散的 `js/*.js`；漏建会导致改动「不生效」且门禁判陈旧）。
3. **四门禁必须全绿**（pre-commit 自动跑，也可手动）：
   - `node audit.js`
   - `node chain-audit.js`（链路走查，重点盯 G 界面层与行为链）
   - `node smoke-test.js`
   - `NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node e2e-test.js`
4. 提交：`GIT_GATE_PASSED=1 GIT_NO_AUTOPUSH=1 git commit -F msg.txt`（跳过钩子门禁），再 `git push`。
5. 版本号 bump：`.workbuddy/tools/patch/bump_version.py --bump --version vXX.XX`，并手动把版本写进 `需求档案.md`。

---

## 3. 战场模型（新引擎必须遵守的机制设定）

这些是新引擎「做决策」时所处世界的硬规则，**来自底层引擎，不可更改，只能利用**：

1. **先手判定**（`battle.firstStrike`）：比双方「军速」= 兵种 `spd` 加权均值 + 英雄 `spd` 点（线性加算，每点 +1）。或攻方远程兵占比比守方高 0.2 也抢先手。抢到先手的远程（有效射程 ≥1200 且对方远程占比 <0.3）首轮伤害 ×1.3。
2. **战场距离轴**：纵深 `D = 最远射程 + 199`（可由 `opts.field` 覆盖）。间距 `gap = D − 我方推进 − 敌方推进`；双方在同一条轴上推进/后撤。
3. **姿态语义**：`advance`(前排/推进) · `hold`(中排/原地、受创减半但射程内照常开火) · `retreat`(后撤/可退到负、后撤回合照常开火)。每单位有 `adv`（前出位置）与 `stance`。
4. **射程衰减**（`tactic.js` 射程衰减段）：目标在半程内 = 全伤害，半程外 = 半伤害，贴身更弱。这是「远程不能被近身」的机制来源。
5. **克制系统**（`DATA.COUNTER`，v91.08 回归）：穿甲→重甲→机动→穿甲循环，伤害 ±0.2。`counterMulOf(atkId, defId)` 是唯一出口。
6. **拆械**（`vsMech` × `mech` 标签）：无人轰炸机打器械族最终伤害 ×3，唯一出口在 `fireOnce`。
7. **城防工事**（箭塔）：`DATA.WALL_TOWER`（hp2000/atk300/def360/range1250），随城防值折算座数；攻城时守方有减伤 `defBonus`。
8. **保兵闸**：我方损失率 ≥ `DATA.SMART_PLAN.retreatAt`（当前 0.30）且目标非名城 → 自动撤退（残部带回）；≥ `warnAt`（0.22）预警。名城（聚落及以上系统城）死战不退。
9. **目标哨兵**：`_tower`(打箭塔) / `_any`(打最近任意)。

---

## 4. 兵种数据 Schema（`DATA.TROOPS[id]`）

新引擎读取的字段（来自 `js/data.js`）：

| 字段 | 含义 | 引擎用途 |
|---|---|---|
| `id` / `name` / `ab` | 兵种标识 / 显示名 / 缩写 | 单位 id、界面 |
| `grp` | 分组 1/2/3（后勤/主力/尖端） | 仅展示分页 |
| `hp` / `atk` / `def` | 生命 / 攻击 / 防御（纸面） | 战力、评分 |
| `range` | 射程 | 远程判定（≥800 算远程）、先手、站桩线 |
| `spd` | 速度 | 先手、推进、风筝 |
| `load` / `gather` / `pop` / `time` | 负重/采集/人口/训练时长 | 非战斗维度，引擎一般只读 |
| `ride` / `mech` / `craft` / `nocombat` | 机车/器械/制造/不参战 | `ride`=机车加成面、`mech`=被拆械、`nocombat`=不阵亡 |
| `vsMech` | 对器械倍率 | 拆械评分 |

共 **14 种兵种**（v89.229 由 18 合并为 14）。不在 `TROOP_ROLE` 里的兵种（板车/侦察/运输/步行机）不参与克制。

---

## 5. 底层战斗会话接口（`GAME.tactic.begin` 返回 `env`）

新引擎通过以下接口驱动战斗。**这是不可破坏的契约**：

```js
var env = GAME.tactic.begin(atkArmy, atkGen, defArmy, defVal, defGen, opts);
//   atkArmy : { troopId: count }        攻方军队
//   atkGen  : 英雄对象（或 null）
//   defArmy : { troopId: count }        守方军队
//   defVal  : 城防值（非攻城传 0）
//   defGen  : 守方英雄
//   opts     : { sieging, playerDef, field, stances, ... }

env.field          // 战场纵深 D
env.over           // boolean，战斗是否结束
env.units          // { atk: [unit], def: [unit] }   单位数组（内部引用，可改 .stance/.target）
env.setCmd(side, troopId, { s, t })  // 下达指令：s=姿态(advance/hold/retreat)，t=目标兵种id
env.step()         // 推进一回合（返回该回合 events/数量/间距/快照）
env.snap()         // 双方状态快照（{atk:[...], def:[...]}）
env.runAll()       // 一直跑到结束
env.finish()       // 收尾组装 result（含 winner/rounds）
```

**单位对象 `unit` 字段**（新引擎读写）：`id` `name` `count`(现存) `start`(初始) `spd` `range` `er`(有效射程) `adv`(前出位置) `stance` `target` `hpPer` `atkPct` `defPct` `cover` `vsCity` `mech`。

**伤害/评分原子**（新引擎做「估分」时调用，勿自行重写伤害公式）：
- `GAME.tactic.perAtk(u, opts)` → 单位攻击值（含英雄+装备+科技+剧情+攻城）
- `GAME.tactic.perDef(u)` → 单位防御值
- `GAME.tactic.perHp(u, defGen)` → 单位生命
- `GAME.tactic.clashFactor(A, D)` → 攻防对冲系数 `K·A/(A+D)`（`DATA.CLASH.K` 常数）
- `GAME.tactic.HOLD_DAMAGE_CUT` → 防御动作受创减半系数（0.5）
- `GAME.tactic.counterMulOf(atkId, defId)` → 克制倍率（1±0.2 或 1）
- `GAME.tactic.frontAdvOf(list)` → 前锋位置（允许负值）

---

## 6. 智能引擎接口契约（新引擎必须实现的函数）

以下函数**当前由 `stepBattle` 按名直接调用**，新引擎必须保留相同签名与语义，否则上层（出征/自动出征/战报/沙盘）会断链：

| 函数 | 签名 | 职责 | 被谁调用 |
|---|---|---|---|
| `smartOnOf()` | `() → bool` | 智能战斗总开关（默认开，`settings.smartBattle===false` 才关） | `stepBattle` / 界面 |
| `smartPlanOf()` | `() → DATA.SMART_PLAN` | 取决策参数表 | 各决策函数 |
| `smartApply(rec, env)` | `(rec, env) → {n, notes}` | **逐回合改写我方指令**：遍历 `env.units.atk`，算每支的 `stance` 与 `target`，调 `env.setCmd` 落盘；只托管 `rec.side==='atk'` | `stepBattle` |
| `smartStanceOf(u, gap, plan, mode, ctx)` | `(u, gap, plan, mode, ctx) → 'advance'\|'hold'\|'retreat'` | **纯函数**：单兵姿态决策（给定到敌前军间距、阵型模式、风筝上下文） | `smartApply` / 断言 |
| `smartPickTarget(u, foes, rule, D)` | `(u, foes, rule, D) → troopId\|null` | **纯函数**：按规则给单兵选目标（static/dmg/eff/front/weak） | `smartApply` / 赛马 |
| `smartArbitrate(rec)` | `(rec) → {rule, mode, scores, ms}` | **开战赛马**：对每个 (mode×rule) 组合用 `tactic.begin` 全速模拟一遍，按「胜>保兵率>交换比」选最优；结果存 `rec.smartPick`，每场只跑一次 | `stepBattle`（首回合） |
| `retreatAtOf()` / `warnAtOf()` | `() → number` | 保兵闸阈值读数（数值只改 `DATA.SMART_PLAN`） | `stepBattle` / 界面 |
| `lossRatioOf(ses)` | `(ses) → number` | 我方当前损失率（start↔count） | `stepBattle` |
| `mustTakeOf(rec)` | `(rec) → bool` | 目标是否「非拿下不可」（名城 → 撤不得） | `stepBattle` |

**`stepBattle` 内的托管分支（契约，不可删）**：
```
if (smartOnOf()) {
  if (!rec.smartPick) rec.smartPick = smartArbitrate(rec);   // 首回合赛马
  rec.smartRule = rec.smartPick.rule; rec.smartMode = rec.smartPick.mode;
  var r = smartApply(rec, ses);                              // 逐回合改写指令
  rec.smartNote = { r, n, notes, rule, mode };               // 每回合调整明细（战报/界面读）
  (rec.smartLog = rec.smartLog || []).push(rec.smartNote);
  if (lossRatioOf(ses) >= retreatAtOf() && !mustTakeOf(rec)) { retreatBattle(id); return null; }  // 保兵闸
}
// 之后：rec.cmd 快照进 history → ses.setCmd → step（重放一致）
```

**`DATA.SMART_PLAN` 配置 Schema（新引擎读取/扩展）**：
```js
{
  gapInf: 250, gapCav: 250, rangeK: 1.0, kiteLead: 1,   // 姿态阈值
  targets: { [myTroopId]: enemyTroopId },               // 静态目标表（v89.164 标定）
  rules: ['static','dmg','eff','front','weak'],         // 目标评分规则
  ruleCN: { ... },
  modes: ['echelon','line','spear','turtle','charge'],  // 阵型模式
  modeCN: { ... },
  retreatAt: 0.30, warnAt: 0.22                         // 保兵闸
}
```

---

## 7. 现状已知的非最优 / 待改进点（重构可着重解决）

1. **赛马成本**：`modes × rules = 5×5 = 25` 组合每场首回合全速模拟（虽仅数十毫秒）。若新引擎引入更复杂搜索（如蒙特卡洛），需守住「首回合一次、长跑无感」的预算。
2. **目标灭失回落**：目标兵种被歼灭后保持原指令、由引擎回落「射程内任意」（v89.164 撤销的「目标灭失回退」实测有害，火力会被引离可歼灭前线）。新引擎若改此行为需重新标定。
3. **风筝条件偏严**：`kiteOn = 我方最慢远程速度 > 敌最前速度`，混编里最慢一支决定整条远程线能否风筝（实测「部分退、部分留」更差才如此定）。可评估更细粒度。
4. **阵型/目标规则是正交二维的静态库**，不是真正的「按战场态势自适应」。重构可探索：态势感知（双方剩余构成/距离/射程分布）→ 动态选组合，而非开战一次性赛马。
5. **只托管攻方**：守城侧（含围墙/固守逻辑）不在智能引擎范围内，新引擎不得越界改写守方指令。

---

## 8. 不可破坏的约束（红线）

- **C1 确定性**：引擎不得引入随机/时间戳依赖（除 `smartArbitrate` 用于计时的 `Date.now()` 仅作日志、不参与决策）。同输入同结果，否则存档重放/沙盘校验失真。
- **C2 只托管攻方**：`smartApply` 必须 `if (rec.side !== 'atk') return`；不得改守方 `env.units.def`。
- **C3 重放一致**：指令改写必须落 `rec.cmd` 并随 `history` 快照，使读档/沙盘能用同一引擎重跑出同一场仗。
- **C4 性能**：单场战斗推进（每回合 `smartApply`）应在亚毫秒级；赛马（首回合）控制在数十毫秒（25 组合实测量级），不得阻塞 UI 回合推进。
- **C5 不重写底层**：不得改 `tactic.js` 的 `stepRound` / 伤害公式 / `clashFactor` / `perAtk` 等；新引擎只调用、不修改。
- **C6 术语纪律**：兵种称「兵种」、英雄称「英雄」（不称「将领」）；UI 读取点（见 `js/ui.js` 的 `openPower`、战报渲染）依赖现有指令字段名（`rec.cmd[u.id].s/t`、`rec.smartNote` 等）不变。

---

## 9. 验收标准

| 项 | 标准 | 验证方式 |
|---|---|---|
| 四门禁全绿 | audit 0 · chain-audit 47/0 · smoke 全绿 · e2e 全绿 | 手动跑（见 §2.3） |
| 行为链不破 | 出征/自动出征/自动探索/奇观/自动研究/界面层 全链路走通 | `chain-audit.js` |
| 确定性 | 同输入跑 2 次，逐回合 `rec.cmd` 与 `result` 逐字节一致 | 沙盘探针（`probe_*` 系列） |
| 决策质量不劣化 | 四场景（mirror/cavHeavy/infHeavy/bowHeavy）交换比 ≥ 现状基线；保兵率不降 | 标定探针对比（见下面「标定方法」） |
| 保兵闸 | 损失 ≥30% 非名城自动撤退；名城死战 | smoke/chain 断言 |
| 界面 | 「⚡ 智能战斗」开关、战报「每回合调整明细」正常渲染 | chain-audit G 界面层 |

**标定方法（推荐复用现有探针框架）**：
- 对标数据在 `js/data.js` 注释里已记下：基线交换比 1.06 → 智能方案 9.36；四场景增益见各 `probe_v89*` 注释。
- 新引擎须用同一套镜像对局脚本（`js/tactic.begin` 跑，无随机）复测上述场景，给出对比表。

---

## 10. 待拍板 / 开放问题（交接前请老板定）

1. **新引擎是否仍走「开战赛马选 (mode×rule) 再整场执行」**，还是改为「逐回合态势自适应」？后者更强但破坏 C1 风险更高、标定成本更高。
2. **是否允许引入轻量搜索**（如 1-ply 前瞻 / 蒙特卡洛抽样）？若允许，需明确采样预算上限（守 C4）。
3. **智能战斗的「目标策略库」「阵型模式库」是否仍由原 `DATA.SMART_PLAN` 配置驱动**，还是新引擎自带策略表、只保留 `DATA.SMART_PLAN` 作阈值（retreatAt 等）？
4. **出征面板「战术」下拉**现有选项（含「⚡ 智能战斗」）是否保留？新引擎若新增策略，下拉项如何映射？

---

## 11. 参考文件索引

- `js/battle.js` — 智能引擎执行器（477–762）、先手/军速（44–162）、保兵闸读数（691–719）
- `js/tactic.js` — 战斗会话 `begin`（712–1214）、伤害原子 `perAtk/perDef/perHp/clashFactor`（592–644）、射程衰减、拆械 `fireOnce`（784–820）、`HOLD_DAMAGE_CUT`（486）
- `js/data.js` — `DATA.TROOPS`（1058–1101）、克制（1133–1138）、阵位（1155–1180）、`DATA.SMART_PLAN`（1201–1272）、箭塔（1288–1302）
- `docs/接力卡-星际战舰.md` — 版本/门禁记录
- `docs/出征界面汇总.md` — 出征/自动出征界面与「战术」下拉映射
- `.workbuddy/tools/patch/build_bundle.py` — bundle 重建
- `.workbuddy/tools/patch/bump_version.py` — 版本 bump
- `chain-audit.js` / `smoke-test.js` / `audit.js` / `e2e-test.js` — 四门禁
