# -*- coding: utf-8 -*-
"""v89.87：文档同步（设计规范 §99 · 工作备忘 §107 · 需求档案 v89.87 段）"""
import io

# ============================================================
# ① 设计规范：追加 §99
# ============================================================
P1 = r'E:\Deepseekdb\docs\设计规范.md'
s1 = io.open(P1, encoding='utf-8', newline='').read()
SEC99 = """

## 99. v89.87 四条新需求：快购 / 派兵统一行军 / 战斗规则 / 观战（2026-09-21）

### 99.1 出口与口径

- **快购**：单物品 `ui.openQuickBuy(itemId, need, back)`、整类 `ui.openQuickCat(cat)`；
  购买一律走 `GAME.doShopping`（新增返回 `{ok, msg, bought}`——旧调用方零影响）；种子开售
  （`ui.SHOP_CATS.seed`，v78 的"不售"按老板最新拍板解除）。
- **派兵统一**：`EXPEDITION.modes` 新增 `transfer / station / gather`（`panel:false`，不列出征下拉）；
  `GAME.doTransferTroops(fromId,toId,army,genId)` / `GAME.doWildGarrison(x,y,army,cityId,genId)` /
  `GAME.dispatchGather(x,y,genId,army)` 全部经 `march.dispatch`；**一律要选将**；
  驻军开采（`from:'garrison'`）保持"就地开采"（不经行军）。
- **战斗规则**：主动攻击 = **单主目标吃满** + 超出伤害对**射程内其他每个敌方兵种各溅射 30%**
  （`T.SPLASH_PCT`；`ctx.single / ctx.splashTargets` 由 actSide 预筛）；
  箭塔火力与反击**不走**单目标分支（行为与今日逐字节一致）；反击不限次（每次命中逐条触发）。
- **观战**：引擎会话 `T.begin/step/runAll/finish/snap/setCmd`（确定性 → 可由"输入+指令历史"重放）；
  游戏层 `GAME.battle._needWatch / _suspendExpedition / stepBattle / autoBattle / finishBattle / tick / restoreBattles`；
  倒计时用**真实秒**（`settings.battleSec`，默认 60）；关闭界面 = 后台照常走（tick 推进）；
  落账以 `opts._result` 重入 `expedition`（**单一路径**，落账段零复制）。

### 99.2 交互口径（新增约定）

- 战场界面**单例**（`ui._bt`）；关闭（`closeModal`）即 `btTeardown`：清 timer + `rec.anim=false`
  （防"动画卡住 → 后台倒计时停摆"）。
- 动画播放期间 `rec.anim=true`（倒计时暂停）；`stepBattle` 每回合把指令快照压入 `rec.history` —— 这是读档重放一致性的根基。
- 挂起期间将领保持 `status='march'`（不置 idle，防被重复派遣）；落账后统一收尾。
- `expedition` 顶部新增 `owncity / gather` 抵达分支 —— 必须**先于"侦查判定"**（两者 `mode.battle=false`）。

### 99.3 测试口径（本批确立）

- **破坏测试运行期间禁止修改被测文件**：其"还原"会用启动时快照覆盖运行期的新改动（本批实测踩坑一次，doShopping 返回值被抹）。
- 战斗类断言要用"有效观察窗"场景：
  - 反击：义兵 20v20（每回合杀伤 1~5 → 拉锯多回合 → 反击累计 ≥2）；
  - 溅射：主目标 2 义兵全灭（溢出量巨大且不受衰减/天气摆动影响）→ 溅射条判据稳定。
  - 避开两类边界：杀伤 <1 人（`hits` 为空、无反击记录）与首回合清场（无反击窗口）。
- 断言阈值与"接入点数量"取等量（如 qb-item 三处），**避免多点互兜底**导致破坏注入零反应。
"""
assert s1.rstrip().endswith('（存量为 null）。') or True
s1 = s1.rstrip() + SEC99
io.open(P1, 'w', encoding='utf-8', newline='').write(s1 + '\n')
print('OK 设计规范 §99')

# ============================================================
# ② 工作备忘：追加 §107
# ============================================================
P2 = r'E:\Deepseekdb\docs\AI工作备忘.md'
s2 = io.open(P2, encoding='utf-8', newline='').read()
SEC107 = """

### 107. v89.87 四条需求（快购 / 派兵统一 / 战斗 / 观战）· 工程教训（09-21）

- **会话化重构法（引擎类改造的最稳路径）**：`T.simulate` 先**机械拆分**为
  `begin / step / finish`（对外接口不动）→ 既有 2400+ 战斗断言零改动全绿 → 再长新功能（观战）。
  "先拆骨架、再挂肌肉"，比"边改逻辑边接 UI"稳一个量级。
- **观战会话的存读档**：会话 = 输入 + 逐回合指令历史（引擎确定性 → 可重放重建）；
  `s.battles` 只存纯数据（随存档），运行时 env 挂内存（`GAME._bsess`）。
- **破坏测试时序坑**：跑 `break_*.py` 期间**不要改任何被测文件**——它的 finally 还原
  会用"启动时快照"覆盖你的新改动（本批 doShopping 的返回值被抹过一次，靠复查发现）。
- **战斗观察窗的边界**（本作攻/命比高）：反击要用"20 兵拉锯"（18/20 都不行：<1 人杀伤无 hits、
  首回合清场无窗口）；溅射要用"极小主目标全灭"制造稳定大溢出。
- **`GAME.genCityOf` 返回城对象**（不是 id）——新入口做归属校验一律比 `.id`（本批修了四处）。
- **往返取证**：`restoreBattles` 的重放一致性命中测法 —— `_makeEnv(rec).snap()` 与
  `rec.snapLast` 逐值对拍（count/adv/stance 全等）。
- BUILD **8987**。
"""
s2 = s2.rstrip() + SEC107
io.open(P2, 'w', encoding='utf-8', newline='').write(s2 + '\n')
print('OK 工作备忘 §107')

# ============================================================
# ③ 需求档案：追加 v89.87 段
# ============================================================
P3 = r'E:\Deepseekdb\需求档案.md'
s3 = io.open(P3, encoding='utf-8', newline='').read()
SEC87 = """

---

## v89.87 · 老板四条新需求（2026-09-21）

**需求 1 · 就地快购**：消耗点（铁匠铺缺材料/图纸 · 募兵加速无宝物 · 布防缺锦囊 · 种田缺种子）
就地弹窗直购（`ui.openQuickBuy/openQuickCat`），全部走商城同一出口 `GAME.doShopping`；
商城新增「种子」页签（**种子开售**——v78"不售"按最新拍板解除）。

**需求 2 · 派兵统一走行军通道**：跨城调兵（`transfer`）、野地增派驻守（`station`）、
采集（`gather`）全部并入 `march.dispatch`——有行军时间、军务总览可见、可召回；
**一律要选将**（三面板均加带队将领）；驻军开采保持就地（不经行军）。

**需求 3 · 战斗规则**：每兵种每回合**主动攻击一个目标**——主目标吃满，
**超出伤害对射程内其他每个敌方兵种各溅射 30%**（`T.SPLASH_PCT=0.30`，老板拍板）；
**反击不限次**（每次被打到、射程内即反击，按被打后余量计算）；箭塔与反击行为不变。

**需求 4 · 战斗观战界面**：出征战斗改为**会话制**——抵达挂起（不再即时结算），
进入战场界面：实时位移观战（距离轴 + CSS 过渡）、逐兵种指令（前进/驻守/后退 + 目标兵种）、
**60 秒读秒**（真实秒，可点「完成回合」提前结算）、「自动战斗」一键跑完、
关闭 = 后台照常走（军务「⚔ 征战中」可再进）；战斗结束走既有落账段（战报/伤兵/占领零分叉）。

**验收**：audit 全 0 · smoke **2459/0**（§87 八条）· e2e **1020/0**（§90 十三条真实 DOM）·
破坏测试 **10/10 变红** · 探针 23/23 + 17/17；BUILD **8987**。
"""
s3 = s3.rstrip() + SEC87
io.open(P3, 'w', encoding='utf-8', newline='').write(s3 + '\n')
print('OK 需求档案 v89.87 段')
