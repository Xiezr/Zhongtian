# 《我在废土有座城》项目交接文档

> 交接时点：**2026-10-18** · 版本：**v91.76 / BUILD 9330** · 面向**下一位接手的会话（人或 AI）**：先读本文，再读 `docs/接力卡-星际战舰.md`，再动手。

---

## 一、30 秒上手

- **形态**：纯前端单机网页游戏（废土换皮）。**零后端**；`index.html` 双击即玩（`file://`）。
- **跑起来**：直接开 `E:/Deepseekdb/index.html` 即可；或
  `python -m http.server 8777 --directory E:/Deepseekdb` → `http://localhost:8777/`。
- **源码根**：`E:\Deepseekdb`（当前工作目录 `E:\app_projects\biztrip` 是**另一份无关项目**，别改错仓）。
- **目录**：`index.html`（全部 CSS）· `js/`（23 个源文件 + `bundle.js` 构建产物）· `assets/` · `docs/` · `.workbuddy/`（门禁/工具/历史备份）。
- **门禁三件套**（改完必跑）：audit **0** · smoke **3768/0** · e2e **1099/0**。

---

## 二、架构速览（v91.61 地基改造后）

**加载方式**：`index.html` 只加载 2 个脚本 —— `vendor/three.min.js` + **`js/bundle.js`**。
`js/main.js` 的 **import 列表 = 执行顺序**：

```
core → data → state → systems → items → generals → cities → ship → domain
→ map → sphere → gltf → map3d → battle → tactic → icons → gicons → bitmaps
→ portraits → story → ui → main
```

> ⚠️ **改任何 `js/*.js` 后必须重建 bundle**：
> `python .workbuddy/tools/patch/build_bundle.py`（漏了会被 smoke 的陈旧守卫拦下）。
> 校验：`python .workbuddy/tools/patch/build_bundle.py --check`。

| 模块 | 职责 |
|---|---|
| `core.js` | `window.GAME` 单例。 |
| `data.js` | **全部静态配置**（建筑/科技/装备/兵种/奇观/战舰/据点/遗迹…）。改数值先来这里。 |
| `state.js` | 存档结构、`newGame`、`adoptState`（**读档迁移链**）、`tickOnce`（主循环）、`simulateBulk`（离线补算）、**星球与世界归一出口**、`GAME.res`。 |
| `items.js` | 背包归属 `GAME.items`（count/has/add/sub/take/addAll/list）。 |
| `generals.js` | 英雄状态机 `GAME.gen`（7 态 · claim 原子互斥）。 |
| `cities.js` | 城市只读出口 `GAME.city`（byId/anywhere/all/armyTotal/…）+ 资源/队列/城兵唯一写入口。 |
| `ship.js` | 星际战舰/空间站引擎 `GAME.ship`（12 舰种 · 蓝图门槛 · 部件/属性）。 |
| `domain.js` | 领域逻辑（城建/出征/弃城/装备/基因实验室/奇观/战储压缩…）。 |
| `map.js` | 地形/据点/名城/野地逻辑 + 球面投影视图；`DATA.MAP_W=MAP_H=500`。 |
| `sphere.js` | **球面世界内核**（纯 JS · 可多实例工厂 `GAME.createSphere()`）；六边格 `cells`（40962）。 |
| `map3d.js` | 3D 星球地图（Three.js · 只做渲染与拾取）。 |
| `scene3d.js` | **2.5D 场景运行时**（v140 · 10 场景 + city 街区 · 正交相机 + WASD + 交互节点 · v143 起正式玩法也走它：`ui.doJianghu → S.play`，双宿主结算 + 时段光照 + 城内行人；v143.3 起正式局红圈遭遇走 `jianghuDo('tao')` 唯一账本）。 |
| `battle.js` / `tactic.js` | 行军/战斗结算 / 战斗沙盘引擎。 |
| `icons.js` / `gicons.js` / `bitmaps.js` | 图标出口（矢量兜底 / game-icons / AI 位图注册表）。 |
| `ui.js` | **全部界面**（视图 + 弹窗）。 |
| `main.js` | 启动 + **点击事件总派发**（`data-action` → `case`）+ `GAME.doXxx`。 |

### 坐标 / 地形口径
- **地形 SSOT = 球面内核**：`GAME.sphere.terrainAt(x,y)` / `ciOfXY` / `cells[ci].type`。
- **平面 `(x,y)`** 仍是存储/显示主键；界面显示经纬（`GAME.map.coordText`）。
- **`ci` 只在球内唯一** —— 跨星球实体一律带 `pid`（见下）。

---

## 三、本批大改（v91.71 → v91.76）

| 版本 | 内容 |
|---|---|
| **v91.76** | 出征界面**固定化**：7 方式（侦查/掠夺/占领/派遣/运输/派驻/探索）· 目标/出发分层 · 运输原路返回 · 目标“其他目标”弹窗 |
| v91.75 | 出征界面汇总整理（目标只列一个 / 主将只列一个 · 形态摘要） |
| **v91.74** | **星球世界归一**：不做切片，只做地图显示切片（见 §四） |
| v91.73 | 奇观⚡不可选中 · 自动基因研究默认开启 |
| v91.72 | 星际战舰 B 期（12 舰种蓝图）+ 本批十六条（见 `需求档案.md`） |
| v91.71 | 星际战舰 A 期：空间站 + 卡牌船坞 + 10 部件 + 11 属性 |

### v91.74 世界归一（最重要的结构性变化）
- **世界数据全局一份**：`s.cities / s.wilds / s.forts / s.queues / s.marches / s.gathers / s.battles / s.sieges`，每条记录带 **`pid`**。
- **`s.mapSlices` 已退役**（老档 `migratePlanetWorld74` 一次性合并，幂等标记 `planetWorldMig74`）。
- **据点类字典键**：`p<pid>|c<ci>`；`GAME.fortKey / GAME.fk(pid)` 是唯一键出口；老裸键 `c<ci>` 兼容读（= 当前星）。
- **`sliceOf(pid)` / `mapSliceOf(pid)` 只是过滤视图**（只读）；`_savePlanetSlice / _loadPlanetSlice` 已空实现。
- **`enterPlanet(id)` 只换球面 + 重建地图投影**，不再换数据；每星球自己的开始圈 `planet.worldStart`。
- **全境推进**：`tickOnce` / `simulateBulk` / 自动升级·征兵·研究·基因研究·采集 / **外敌来犯** 都遍历所有星球（背景星球不再停表）。
- ⚠️ **新增按格查表的代码必须带 `pid`**：`map.wildAt(ci, pid)`、`gatherAt(ci,pid)`、`fortOwnAt(ci,pid)`、`fortAuraAt(ci,pid)`；否则跨星球会重号误命中。

### v91.76 出征界面（固定界面）
- 方式恒列 7 种，不适用**置灰**并写原因（唯一判定 `ui.expModeAvailOf`，执行端 `battle.prepare` 同源）。
- **到达性限制由目标决定，出发性限制由派出城决定**；主将/方案/预估/限制性信息/辎重统一读 `ui.expFromCity()`。
- 目标 = **当前目标 + 「其他目标」弹窗**（本星球：己方城市/己方野地/周围30格野地/周围30格据点/名城按区/奇观）。
- 奇观统一为 **探索**：`探索层级` >0 = 挑战该层守卫，否则按探索行动采集。
- **派遣** = 兵将归属变化；**运输** = 负重调资源（送达后原路返回 `roundTrip`）；**派驻** = 己方野地藏兵（无将不可采集）。
- 派遣/运输/派驻**可不带英雄**；运输只按运力校验。
- 详见 **`docs/出征界面汇总.md`**（入口清单 + 共用主档 + 7 方式差异 + 门禁）。

---

## 四、门禁（改完必跑）

```bash
NODE=C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-6/node.exe
export NODE_PATH=C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules
$NODE audit.js          # 结构审计：死函数/孤儿/重复/零引用 → 全 0
$NODE smoke-test.js     # 逻辑冒烟 → 3768 通过 / 0 失败
$NODE e2e-test.js       # 端到端（真实 DOM + HTTP）→ 1099 通过 / 0 失败
python .workbuddy/tools/patch/build_bundle.py   # 改 js 后必须重建
```

- **pre-commit 钩子**会再跑一遍三件套 + 数据表卫生；Windows 下建议前缀
  `PYTHONIOENCODING=utf-8 PYTHONUTF8=1 git commit ...`。**不要 `SKIP_GATE=1` 绕过。**
- **提交只 add 自己的文件**：`git add -A` 会卷进 `.workbuddy/eval_*/browser-profile/Cookies`（被锁 → fatal）。
- 工作区里若有 `assets/icons/其他种族兵种/` 等**未跟踪目录**，可能是老板另放的素材，**别删**。

---

## 五、必守约定 / 常见坑

1. **改 js 必须重建 bundle**（见 §二），否则 smoke 红。
2. **改 `js/*.js` 保 LF**：CRLF 会挂 smoke 的 `\n` 正则断言。
3. **禁止正则批量改“键名是变量”的代码**：v91.69 曾把 `army[k]` 批量写成 `{ k: … }`，25 处静默错兵。
4. **SSOT**：一个数/一处逻辑只有一个出口；界面与执行端读同一出口（例：`expModeAvailOf` ↔ `battle.prepare`）。
5. **设计令牌 lint**：`index.html` 样式表禁裸 px/hex/字号/圆角；网格/canvas 类视图用**内联 style** + `var(--*)` 令牌。
6. **改数值/规则的测试口径**：改断言口径，**别删断言、别放宽到失去意义**。
7. **版本三连**：`bump_version.py --bump --version vX.YY`（改 `GAME.VERSION` + `index.html` BUILD/`?v=`）。
   版本号必须写进 `需求档案.md`，smoke §199⑥ 会查“代码升了、档案没升”。
8. **性能护栏**：`100 城 tickOnce` 取三轮最小值 < 6ms（真回归 ≈10.5ms）；新增逐城逻辑别破坏它。
9. **并发会话**：本仓可能与别的会话同时在改；动手前看 `git status` / 文件 mtime，冲突先问老板。

---

## 六、当前状态与下一步

**已完成**：地基改造（v91.61–v91.69）· 星际战舰 A/B 期（v91.71–v91.72）· 本批十六条（v91.73）·
星球世界归一（v91.74）· 出征界面汇总与固定化（v91.75–v91.76）。

**星际战舰后续分期**（见 `docs/接力卡-星际战舰.md`）：
- **C** 部件/属性深化（数值调优、部件协同）
- **D** 3D 构造图（three.js 程序化几何；无 WebGL 必须降级为静态图）。※ v143.1~v143.4 已通最后一公里：10 个 2.5D 场景接入正式玩法（含红圈遭遇走清剿账）+ 城内行人 + 时段光照；D 期剩余 = 建造时的 3D 预览。**斗将正式化**（序章 duel 内核 + v136 面板 → 正式局场景遭遇改交互斗将）是待拍板候选：动它 = 改战斗结算口径（LING_ACT.win/lose 映射），需老板定数值；现状正式局遭遇走数值账本 `jianghuDo('tao')`（唯一账本，不两本账）
- **E** 投送（`s.interstellar` 顶层通道）+ 殖民
- **F** 舰队战 + 终局

**已知未修 / 待办**：
1. **`newGame` 球面时序**：`sphere.ensure()` 早于 `GAME.state` 赋值 → 全新会话首局球面按 seed 1 构建（种子错配）。修复会移动地形、波及布局断言，需单独一轮。
2. **旧 `transfer` 别名**：`DATA.EXPEDITION.modes` 里保留 `transfer`（内部/自动/脚本兼容），界面不展示；后续可评估是否彻底移除。
3. **奇观层级**：层级 = 挑战该层守卫；界面已接，若老板希望“层级 = 采集深度”再改口径。
4. **运输返程**：当前按“去程耗时”返程；未做中途召回的特殊显示（沿用通用召回）。
5. **2D 兜底地图**（`map3d` 关闭时）不支持“地图看别星”，仍强制 map = active。

**需要老板定夺**：
- 探索层级语义（挑战守军 / 采集深度 / 两者合并）——当前按“挑战守军”实现。
- 星际战舰 C 期的具体数值方向（**机制已就绪**：v142.4 modifier 管道试点落地 —— 属性计算改走可插拔管道、公式冻结数据生长；老板拍板数值后，新系统 = 一张 `DATA.SHIP_*` 表 + 一行来源注册，评估结论见 `需求档案.md` v142.4）。

---

## 七、去哪找信息

| 想知道… | 看 |
|---|---|
| **当前进度 / 下一步** | `docs/接力卡-星际战舰.md`（最优先） |
| **逐条需求 + 落地状态** | `需求档案.md`（**唯一台账**，末尾「逐轮明细」） |
| **出征界面细节** | `docs/出征界面汇总.md` |
| 项目全貌 / 文件索引 | `docs/项目地图.md` |
| 踩坑教训 | `docs/AI工作备忘.md` |
| 数据表含义 | `docs/数值系统数据字典.md` · `docs/数据表索引.md` |
| 门禁/工具脚本 | `.workbuddy/tools/`（`git/gate.py`、`patch/build_bundle.py`、`patch/bump_version.py`） |

**git**：`main` 分支；post-commit 自动 push。远程 `Xiezr/Zhongtian`（GitHub 偶不可达 → `git ls-remote origin main` 核验）。

---

## 八、工作方式（老板偏好）

- **别磨、果断执行**：先一次想全约束/依赖/可行解；探查并行一次到位。
- **不清楚就问**：边界不明/多种可能时先问，问了就一次问全。
- **视觉/布局改动**：先截图/量尺寸定位，再改。
- **大改先落可验收子集**：每刀过门禁再下一刀，别把半成品留在工作区。
- **改完立即跑门禁**；报红先判断是“口径该更新”还是“真回归”。
