# v158.5 · P5 内容与持久化 / IndexedDB 迁移（大世界路线第六阶段）

日期：2026-11-24　版本：`GAME.VERSION = 'v158.5'`　提交：见 git log（`feat: P5 IndexedDB 迁移`）

## 一、老板要求 → 交付对照

老板本轮：「继续实施计划。」→ 按总计划执行 P5。P5 共 3 片（任务链 / 程序化资产量产 / localStorage→IndexedDB 迁移），
其中**只有 IndexedDB 迁移**在老板「123 均授权」②里明确授权、且按路线排期到本轮；任务链会新增玩法系统、
程序化资产量产撞并行美术批（素材正被另一会话改），两者均按「范围纪律」不动、待单独授权。

下表左列是总计划 P5 §4 验收**原文**，右列是本轮实测：

| 计划原话 | 交付物 / 实测 |
|---|---|
| 存档从 localStorage 迁 IndexedDB 后位置/NPC/任务全部读回一致，且不再有 5MB 天花板 | 分块镜像；实测写 **5,366,359 字节 / 21 块**逐字读回（`===`）；位姿 `[0.25,0.5,0.75]` 补水读回逐字一致 |
| 分块存档（chunked persistence）+ 版本号 + 迁移幂等 | `CHUNK_BYTES=256KB`，`::meta` 记 `n/bytes/version/savedAt/checksum`；`SAVE_VERSION=3` 不升 v4，双读只认现版结构 |
| 切换后端 20 次无数据丢失 | F1 实测 20 次 `local⇄idb` 交替，本地 + 镜像 json 逐字一致（`flips=20 localOk=true idbOk=true`） |
| 存档写入出口唯一；反向证据：代码里无第二处 `indexedDB.open` | 全仓 **92 个源文件**中 `indexedDB` 只命中 `js/saveidb.js`；`.open(` 调用恰好 1 处 |
| 派生字段 0 入档 | `savePayload` 无 `npcPos` / 无 `SAVE_BACKEND` / 无 `idbMirror` / 无 `_sub153LL`；`fog.v` 未误删 |
| v3 老档迁入成功率 100% | 5 份独立老档 5/5 逐字读回；`idbHydrate` 走 `adoptState` 同一套迁移链 |
| 单档 ≤5MB | 单块 256KB 是记录体积上界；整档 >5MB 仍可写可读（**突破 localStorage 5MB 天花板**） |
| IndexedDB 配额/隐私模式不可用 → 自动降级回 localStorage 并提示，不阻断游戏 | E1/E2/E3 三态：`available=false` + 四个 API 全返回失败不抛 / `idbMirror=false` + `hydrate=null` + `saveTo` 仍 ok / reset 自愈可再写读 |

## 二、执行方向（开工前锁定）

- **只做已授权的一片**：不碰任务链与资产量产；不新增玩法系统、不碰美术素材。
- **localStorage 仍是同步权威**：所有同步出口（`saveTo/loadFrom/loadGame/saveGame`）的返回契约一字不改 →
  38 处存档断言 + 同步 boot 流程零回归。IDB 只做「成功之后的异步镜像」与「缺档时的异步补水」。
- **默认不改现状**：`SAVE_BACKEND='local'` 时适配层完全不介入，行为与 v158.4 逐字一致；只有显式切到 `'idb'` 才双写。
- **唯一出口**：全仓只有 `js/saveidb.js` 碰 `indexedDB`；`state.js` / `main.js` 一律经 `GAME.idb.*`；
  `GAME.savePayload()` 仍是唯一序列化出口，镜像复用同一份 `json`。
- **不废老档**：`SAVE_VERSION=3` 保持；不升 v4 强制作废，读回仍走既有迁移链（v3 迁入 / 现版原生双读）。
- **派生不入档**：NPC 位姿、格网迁移缓存等派生字段继续剔除；IDB 只是另一处落盘，不改存档内容。
- **任何一步失败都静默降级**：IDB 不可用/配额/隐私模式 → Promise 全 catch 吞掉，localStorage 照常，绝不阻断游戏。

## 三、落点

| 层 | 文件 : 位置 |
|---|---|
| 新模块 | `js/saveidb.js`（core 包，模块 **91→92**）：`GAME.idb` 的 `write/read/list/remove/clear/available`；`GAME.idbSetFactory/idbResetFactory/idbAvailable`；全仓唯一 `f.open(DB_NAME, DB_VER)` |
| 存档适配层 | `js/state.js` `dropSlot` 之后：`SAVE_BACKEND` / `setSaveBackend` / `idbMirror` / `idbHydrate` / `idbList` |
| 双写接线 | `js/state.js`：`saveGame()`（主档）与 `saveTo(id)`（槽位）**写成功之后**各调一次 `GAME.idbMirror(..., json, ...)`；`dropSlot()` 同步清镜像 |
| 双读接线 | `js/main.js` boot：`GAME.hasSave()` 为 false 且后端为 `idb` 时，`GAME.idbHydrate('main').then(...)` 异步补水；同步骨架 `ui.setCreate()` 不动 |
| 模块注册 | `js/modules.json` `layout.order` 在 `state` 后插 `saveidb`（`bundles.core` / `modules` / 顶层 `order` / `sourceHash` 由 `gen_index.js` 自动重建）；`smoke-test.js` ORDER 同步 |
| 台账 | `docs/项目地图.md` 模块数 91→92（三处）；`需求档案.md` 补 v158.5；总计划状态行更新 |
| 断言 | `smoke-test.js` §589ar~au 四条；探针 `.workbuddy/tools/probe/saveidb_probe.js`（26 条） |

## 四、实测（全绿）

- **探针 26/26**（真 Chrome headless + **原生 IndexedDB**，`file://` 页面，无 fake、无页面异常）：
  - A1~A4 唯一出口：接口齐全 / 默认 `local` / 唯一 `.open` / 双写双读都只经 `GAME.idb`。
  - B1~B5 分块：`bytes=5,366,359`、`chunks=21`、逐字读回 `same=true`、meta 五字段齐全、
    覆盖写 21 块→1 块且旧块清干净、`list` 可见 / `remove` 后读不到且索引摘除。
  - C1~C4 双写：`saveTo('s1')` 与 `saveGame()` 镜像 json 与 localStorage 逐字一致；
    `saveTo` 同步返回 <16.7ms（实测 0.1~0.4ms，异步镜像不阻塞主循环）；默认 local 不介入。
  - D1~D5 双读：删本地档补水成功（v3 / 城市 1 / 将领 2 / 位姿 `[0.25,0.5,0.75]` 逐项一致）；
    校验和损坏、缺块、非 v3 版本三种坏档全部拒绝；v3 老档 5/5 迁入。
  - E1~E3 降级：`idbSetFactory(null)` 后四个 API 全失败不抛、`idbMirror=false`/`hydrate=null`/`saveTo` 仍 ok、
    reset 自愈。
  - F1 切换后端 20 次无数据丢失；G1~G3 派生 0 入档 / P0~P4 出口逐字仍在 / `loadFrom` 同步契约 / `dropSlot` 清镜像。
- **smoke 4554/0**（§589ar~au 四条，含 20 次切换行为断言与两个 bug 的防回归正则）。
- **门禁**：`gate --full` 9 脚本全绿；`build_bundle.py --check` / `gen_index.js --check` 一致；e2e 1101/0。
- `gen_index → build_bundle → 两个 --check` 一致（最终 hash `9c7a2cd60757aead`）；三包无异常膨胀
  （core 2.437MB→2.455MB ≈ 新增 `saveidb.js` 13KB，war 逐字节未变，ui 仅 +718B）。
- `npm run arch` 红 **12 条**，与 `v15840-P4NPC生态与事件.md` 记录的 12 条逐条一致
  （`core>war duel3d/map3d/scene3d>gltf`、`main>battle`、`state>ui-fx` 等），**均不含 `saveidb`** ——
  `saveidb.js` 只 `import './core.js'`，与 district/vehicle/npc 同构，未引入新跨层边。属 v156.14 基线遗留，本轮不擅自改基线。

## 五、踩坑（首轮探针 19/26，两个真产品 bug）

1. **覆盖写把新块删掉**：`write` 原先把「清旧块」的 `st.delete` 塞在 `st.get(meta).onsuccess` 回调里发出，
   而 IndexedDB 事务内请求**按发出顺序执行** → 它排在所有 `st.put(parts[i])` 之后，把刚写好的新块 0 删掉，
   覆盖写后 `read` 直接失败（B4 / D1 / F1 三条红同源）。修产品代码：先用一次独立只读事务取旧块数，
   再在写事务里**先发 delete、后发 put**；修后 B4 `chunks 21→1`、读回新文本。
2. **`list` 索引永远空**：原实现在 `st.get(INDEX_KEY).onsuccess` **之外**读 `ids`，那一刻还是初始空数组，
   for 循环 0 次 → `idbList()` 恒为 `[]`（B5 / C1 / C2 / G3 的 `seen=false`）。修产品代码：
   把逐槽位取 meta 的循环移进 onsuccess 回调内发出。
3. **D1 基准取样时序**：首轮 `base.dir='none'`（写档那一刻 P0 `_avatar` 还没惰性补齐），
   而 `hydrate → adoptState` 会补出单位向量位姿 —— 这是产品正确行为，不是 bug。
   探针改为**显式落一个已知位姿** `[0.25,0.5,0.75]` 再比对，判据带 `d0.dir !== 'none'` 下限防平凡解。
4. **`audit.js` 判「死函数 13」拦 full 门禁**：13 条全是 `tx.oncomplete`×6 / `tx.onabort`×6 /
   `r.onblocked`×1 这类 IndexedDB 事件回调，其中 6 组来自**从未被调用的 `wrapReq`/`wrapTx` 死辅助函数**。
   audit 的 `defRe` 只认 `X.Y = function (` 形态并登记为函数定义，事件回调由浏览器调用、
   全仓没有显式调用点 → 被判「无引用」。按项目既定姿势修（**不加白名单、不放宽判据**）：
   删掉 `wrapReq`/`wrapTx` 死代码，抽出 `bindTx()` 用「具名函数 + 引用赋值」统一接三个事务事件，
   `r.onblocked` 同样具名化。修后 `audit.js` 汇总 `死函数 0 · 四项计数 [0,0,0,0]`；
   探针 26/26 与 smoke 4554/0 复跑全绿，产品行为零变化。

两个产品 bug 与这条门禁拦点均**修代码、不放宽断言/判据**，并把「先删后写 / 循环在 onsuccess 内」写成 §589ar 的防回归断言。

## 六、未做

- P5 另两片（任务链 `js/quest.js`、程序化资产量产）未授权未开工 —— 任务链会新增玩法系统、
  资产量产撞并行美术批，按范围纪律先请示。
- **未升 `SAVE_VERSION=4`、未强制作废 v3 老档**（计划「否掉」路径）；双写期 `SAVE_BACKEND='local'` 默认。
- 「老板用自己现有的档开一次，确认东西都还在」、真机 60fps p95 ≤16.7ms（连续 5 分钟）
  由老板实机判定，AI 不结案。
