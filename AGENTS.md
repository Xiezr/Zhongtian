# AGENTS.md — 本项目的工作规则（给 AI 助手看）

> 这些规则是**默认自动执行**的，不需要每轮再问一遍。
> 依据：老板 2026-10-21「定时任务每 15 分钟比较合适吧，基于你目前的一个停顿频率」。

## 一、每轮收尾必做（不问、直接做）

1. 改了 `js/*.js` → `python .workbuddy/tools/patch/build_bundle.py`
2. `node tools/selfcheck.js --fast`（约 1.5 分钟 · 八项）
3. 有改动就提交；**提交命令必须后台跑并重定向到文件**
   （pre-commit 门禁 3~4 分钟，前台 120 秒会被 SIGTERM，`git commit` 直接失败）
4. 追加记忆到 `.workbuddy/memory/YYYY-MM-DD.md`

**判据**：`selfcheck --fast` 全绿才允许说"本轮完成"。
红项必须当场解释清楚——是真问题，还是判据本身写错了（两种情况都要修）。

## 二、为什么是 --fast 而不是全量

全量含 e2e（约 2 分钟），一轮收尾跑不起；e2e 由**提交时的 pre-commit** 自然覆盖。
定时任务每小时跑一次 --fast 兜底（我不在的时间窗），全量留给提交与每天的首次运行。

## 三、定时任务

- `Deepseekdb 每小时自检`（automation）· `FREQ=HOURLY;INTERVAL=1` · 跑 `--fast`。
- 定时任务**只报告不提交**：它没有"这轮改了什么"的上下文，自动提交会把半成品固化。
- 定时任务的最小粒度是 **1 小时**（没有 MINUTELY），所以"每 15 分钟"由**每轮收尾**来覆盖，
  而不是硬凑一个时钟任务。

## 四、已知的坑（写在这里，省得下次再踩）

- **模块清单是四份**：`build_bundle.py ORDER` / `smoke-test.js` 守卫 ORDER /
  `audit.js MODULES` / `audit.js REF_MODULES`。加新模块四份都要加。
- **`data-action` / `data-view` / `data-side` / `data-tab` 是保留属性名**：
  自定义参数属性不要用这四个（audit 会把它们当成"动作"扫描）。
- **改大函数的收尾括号，不要拿 `}` 当 Edit 锚点**——会连带吃掉相邻块的闭合。
- **新模块第一行抄齐** `var GAME / var X / var U = GAME.utils`。
- 自检产物必须落在 `.workbuddy/tmp/`，**不要写进版本库**（否则检查污染工作区）。
- **新模块起名前必须先 grep 命名空间**：`grep -rn "GAME.<ns>\|DATA.<NS>" js/`。
  v94.1 踩过两次：`DATA.TECH` 是**既有科技树（数组）**（data.js:1396），
  我把它覆盖成对象 → `ui.techHTML` 的 `DATA.TECH.length` 直接崩；
  `GAME.dig` 系列也被既有的 `GAME.digCapOf / digCapOfMain`（科技等级上限）占着。
  最后落脚到 `DATA.RELIC` + `GAME.relic`（都空）才算干净。
- **改名不要用裸 `str.replace('GAME.tech', 'GAME.x')`**：它会把 `GAME.techCapOf`
  一起改成 `GAME.xCapOf`（本次就是这么把科技上限函数改没的，smoke 报
  `GAME.digCapOfMain is not a function`）。用 `\b` 或负向前瞻，改完再 grep
  一遍"旧前缀 + 大写字母"的所有变体。
- **tickOnce 是每秒跑的**：新系统一律月度语义时，在外面包一层
  `if (s._wqMonth !== wm)` 门（见 state.js v94.1 注释），
  否则 100 城压测的 `tickOnce < 6ms` 会被几次函数调用顶穿。
- **每秒被调的加成出口必须缓存**（`growth.settleYield → relic.mulOf`）：
  每次重建数组在 100 城下就是 3ms 级开销。
- **`GAME.city.add` 不吃负数**：它的第一行是 `n >= 0 ? Math.floor(n) : 0` ——
  传 `-300` 会**静默变成 0**（不报错、也没扣）。扣资源一律走 `GAME.city.sub`。
  v95 踩过：净化/烧柴/建工事/安抚/叛乱五处全写成 `add(city,k,-n)`，全都没生效，
  直到断言里"库存没少"才照出来。
- **动 `state.*` 字段前先 grep**：`s.wounded`（数字）+ `s.woundedArmy` 是既有的
  伤兵系统，我第一版另造了一个"分城伤兵池"直接把它冲垮（smoke §193② 红）。
  同类的还有 `s.tech`（科技）、`s.veterans`（不存在的字段别乱加）。
- **新模块的月度 tick 要包 try/catch**（state.js 的 `_safeTick`）：
  一个模块抛错会拖停整拍 `tickOnce`，建造/训练队列全不走。
- **写断言时 stub 的生命周期要覆盖到被测函数内部**：
  `setskill.arm()` 内部会再调一次 `unlockedOf()`，stub 提前恢复 → 必然拒绝（假红）。
- **改引擎数值必须限定在"玩家自己的那一路"**：给 `tactic.unitsOf` 加作战目标修正时，
  第一版无条件按兵力比算，把 NPC 互打 / 拆械测试 / 智能方案对比全改了
  （smoke §164③ 平均战损 42.5%→63.5%，§180②/§181② 一起红）。
  正确写法是判 `opts.playerAtk && !opts.playerDef`，只动玩家亲自出征的那一场。
  **凡是"全局生效"的数值改动，先问一句：这会不会改掉测试里那些对比基准？**
- **后台提交跑 pre-commit 时，禁止再改 `js/` 或重建 bundle**：门禁会读到半新半旧的文件，
  报出莫名其妙的单条红（v98.1 就这么被拦下一次，4001/1）。等待期间只读文件、写文档。
- **加模块走注册表（`js/registry.js`），不要再往 ui/main/state 三处各写一遍**：
  模块文件末尾 `GAME.reg.add({ id, order, tick, panel, actions })` 一次声明，
  界面块 / 动作 / 月度结算都从注册表走。
  剩下要改的只有四份**静态清单**（build_bundle ORDER · smoke ORDER · audit MODULES ×2）
  和 `main.js` 的 import —— 那五处是纯登记，不承载逻辑。
  迁移样板见 `js/muster.js` / `js/trooplv.js` / `js/idle.js` / `js/ending.js` 末尾。
  ⚠️ panel 里要用 `var sec = ctx.sec;`（`sec` 是 ui.js 的局部函数，模块里没有）；
  漏了就是 ReferenceError，被 `RG.panels` 的 try/catch 吞成"这块没加载"（v100 踩过）。
- **迁走代码必须删干净**：`smoke §322④` 钉着"ui.js 里不许留第二份面板"。
  两份逻辑比一份烂代码更糟 —— 改一处、另一处不动，谁都看不出哪份在生效。
- **改了机制，检查工具要跟着改**：动作迁进注册表后，`audit.js` 原来只认 main.js 的
  `case`，会报一堆"点了没反应"的假红；现在它也扫各模块 `reg.add` 里的 actions 键。
  门禁替新机制撒谎，比没有门禁更危险。
- **长跑探针是"世界还活着吗"的唯一证据**：`node .workbuddy/tools/sim/sim-run.js 240`
  （N = 游戏月）。新开一局、按月推进、周期性打表（城/人/兵/资源/惰性/竞争者/村社/污染）。
  v98.6 就是它照出"20 年过去村社 0 处、竞争者 0 支"—— 而当时门禁全绿。
  **凡是"世界层"的改动，跑一次长跑探针再看趋势，别只信断言。**
  脚本末尾必须 `process.exit(0)`：游戏主循环有定时器，node 进程不会自己退。
- **双球面的 ci 不通用**：`GAME.sphere`（逻辑）与 `GAME.mapSphere`（渲染）是两颗球，
  `makeSphere()` 造出来时**没有 cells**（要等 map3d 首次渲染）。
  取球面一律走 `GAME.sphereOf()`（state.js 的既有出口），
  **不要写 `GAME.mapSphere || GAME.sphere`** —— 对象存在时 `||` 不走兜底，拿到空球还没报错。
  断言也要用同一个出口，否则"模块写 A 球、断言查 B 球"全是假红。
- **加任何 `GAME.xxx = function` 之前先 grep 这个名字**：我在 sphere.js 里又定义了一次
  `GAME.sphereOf`（同名不同义），把既有的"按 pid 取球面"覆盖掉，audit 的重复定义计数当场照出。
- **heredoc 里的反斜杠会被编码吃掉**：`\s` 传给 python 后变成 `s`，
  断言里的正则成了 `/playerAtk:/s*true/`（语法错误）。断言里改用 `indexOf`，少用正则。
- **⛔ Windows 上 `io.open(p,'w')` 会把 `\n` 悄悄变成 `\r\n`**，而这个仓库**混着两种换行**：
  `smoke-test.js` 是 CRLF，`index.html` / `chain-audit.js` 是 LF。
  一次"只改三行"的替换会把整个文件重写（v104 实测 smoke 83,365 行全变），
  并且依赖 `\n` 的正则断言当场假红（§204⑦ 的 `.pager {\n    display: flex;`）。
  **规矩**：改文件前先 `git show HEAD:<file> | od -c | head -3` 看原换行；
  用 `io.open(p,'rb')` 读写 + 显式 `replace`；改完 `git diff --stat` 核对
  "变动的行数 ≈ 我以为改的行数"，对不上就是换行被动了。
- **三包顺序不能改**（v104 拆分）：`bundle-core`（引擎与数据）→ `bundle-war`（战斗/战术/素材表）
  → `bundle-ui`（天时数值层 / 界面 / 3D / main）。`index.html` 三个 `<script>` 顺序执行，
  `window.GAME` 全局共享 —— 挪动任意一个包的位置，求值顺序就变了。
  构建只认 `build_bundle.py` 的 `GROUPS`（`WAR` / `UI` 两个名单），
  四份清单（ORDER / smoke ORDER / audit MODULES ×2）里的模块名一个都不用动。

## 五、设计判据（老板 2026-10-22 立 · 优先级高于"设定写得好"）

> 「加入你是玩家，你会觉得好玩吗，好玩的就值得做。我的想法是玩家不要背负太多，
> 但是你可以不接受。」

1. **设定要严，游戏要轻 —— 这是两件事，不冲突。**
   文档里把旧世界怎么死的写到底（废墟得有物理成因，否则遗迹就是随机刷的箱子）；
   但玩家端只留**物证**和**后果**：遗迹给材料不给剧情，面板给数字不给背景。
   玩家不需要读懂值班记录，只需要知道"穿旧制服过岗，机器不拦"。
2. **不许给玩家派遗产。**
   反面（v102 初稿踩过）：把终局"关灯"写成"替陈小满走完他没走完的三公里"——
   那是把前人的遗愿变成玩家的作业。玩家可以为了自己的理由关灯（对面水泵也停了），
   但那个理由必须是他自己算出来的。
3. **判据只认"能不能按"。**
   一个设定如果只改变文本、不改变玩家能按的按钮 / 能看到的后果 / 能算的账，
   就不该进游戏 —— 留在文档里。**深不深刻不算分，"他会不会再按一次"才算分。**
4. **不自作多情地深化。** 老板原话"不用过分深刻"：
   冒出"要不要让玩家体会失去"这类念头时，先问一句"这条会让他少按两个键吗"。

## 六、架构约定（v106 · 老板 2026-10-23 把决定权交过来）

> 「至于游戏架构的问题，你来解决，包括拆啊，或者重建啊，或者这个做好这个
> 分类整理啊，架构调整啊，这个都由你来决定。」

### 决定：**不重构，上棘轮**

诊断数据（`node tools/diag-arch.js`）：57 模块 · state 249 个出口 / 被 46 个模块依赖 /
18 组循环 · core→war 14 处、core→ui 58 处、war→ui 8 处、63 对跨层引用。
把 state 拆开要动 4000+ 条断言，**失败概率远大于收益**。
所以不搬文件，改做三件事：修 bug / 立层规矩 / 上棘轮。

### 三层（= 三个包，顺序不能乱）

| 层 | 包 | 内容 |
|---|---|---|
| 引擎 | `bundle-core` | data / state / domain + 所有玩法模块 |
| 战斗 | `bundle-war` | battle / tactic / strategy / icons / 素材表 |
| 界面 | `bundle-ui` | story / ui / map3d / **main（动作层）** |

`main.js` 不是"入口脚本"，它是**动作层**：106 个 `GAME.doXxx`、被 42 个模块依赖。
在 core 里新增对它的调用 = 又加一层反向依赖。

### 三条硬规矩

1. **core 引用 war / ui 一律判空**：`GAME.battle && GAME.battle.gainExp`。
   不判空的话，只加载 core 的探针（`_pg.js` 就踩过）会**静默跳过**整段逻辑 ——
   不报错、没效果，最难查。
2. **跨层引用只许降不许升**：`arch-baseline.json` 记着 63 对的当前次数。
   新增一处 → `selfcheck` 第 8 项红。主动还债后跑
   `node tools/diag-arch.js --write` 把基线压低，**基线从此只会更小**。
3. **诊断先于改造**：要动架构先跑 `node tools/diag-arch.js > .workbuddy/tmp/arch.txt`，
   看跨层、循环、同名多定义、被引最多的槽。**没有数据的重构就是制造屎山。**

### 已知但**暂时不动**的债（写下来，免得下次又"发现"一遍）

- `state` 是上帝模块（249 出口 · 46 依赖 · 18 循环）—— 拆分需要重做状态层的加载顺序。
- `domain → main` 208 处：业务层调动作函数，根因是历史上把动作写在 main.js。
- `GAME.state` 在 main.js:3112 又赋了一次 null（删档用），**不是**第二份状态出口。
- 同名多定义：`_cndSeq`（state/domain）、`_loopLastAt` / `_buildDirty`（state/main）、
  `_bsess`（battle/ui）—— 都是运行时标记，**不是**两份逻辑，已核。


