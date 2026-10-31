# Deepseekdb · 项目说明（Claude Code 每次会话自动读本文件）

> 这是一个**纯静态单机网页游戏**（无后端），源码根 = 本目录。

## 🚩 开工前先读

**当前进度与下一步 → [`docs/接力卡-星际战舰.md`](docs/接力卡-星际战舰.md)**

那份接力卡包含：已完成版本清单、当前阶段、下一步具体步骤、踩坑记录。
**不要从零探索，先读它。**

需求唯一台账：`需求档案.md`（禁止另开第二本）。

## ⚠️ 三条硬纪律（违反必红）

1. **改完 `js/` 必须重建 bundle**
   ```
   python .workbuddy/tools/patch/build_bundle.py
   ```
   漏了 → smoke 的陈旧守卫会拦下提交。

2. **提交前跑三件套**（pre-commit 钩子会自动跑，但本地先跑更快）
   ```
   node audit.js
   node smoke-test.js
   node e2e-test.js
   ```

3. **禁止用正则批量改「键名是变量」的代码**
   曾把 `army[k] = …` 批量改成 `{ k: … }`，动态键变成字面量，25 处静默算错兵。
   这类改动手工逐处，改完立刻跑 smoke。

## 环境

- Node：`C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-6/node.exe`
- `NODE_PATH=C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules`
- 无头实机（playwright）：见记忆 `reference_deepseekdb_headless`
- 版本号：走 `.workbuddy/tools/patch/bump_version.py`

## 代码结构（v104 起三包 · 67 个源模块）

```
index.html          只加载 4 个脚本，顺序即求值顺序：
                    vendor/three.min.js → js/bundle-core.js → js/bundle-war.js → js/bundle-ui.js
js/main.js          动作层（不是入口脚本）：启动 + 事件总派发（data-action）+ GAME.doXxx
js/registry.js      模块注册表 GAME.reg：tick（月度）/ panel（世界账本）/ actions（动作）
js/core.js          window.GAME 单例
js/data.js          全部静态配置（建筑/科技/兵种/奇观/战舰/投送/战场提问…）
js/state.js         存档结构·newGame·tickOnce 主循环·simulateBulk 离线·世界归一
js/items.js         GAME.items   背包（唯一出口）
js/generals.js      GAME.gen     英雄状态机
js/cities.js        GAME.city    资源·队列·城兵
js/ship.js          GAME.ship    空间站/战舰（12 舰种 · 蓝图 · modifier 管道）
js/colony.js        GAME.colony  星际投送/殖民        js/fleet.js  GAME.fleet 舰队远征
js/sphere.js        地形唯一事实源（球面内核，40962 格）   js/map.js  据点/野地/投影
js/map3d.js         Three.js 星球      js/scene3d.js  10 个 2.5D 场景 + 城内街区
js/ui.js            全部界面（约 21k 行）  js/gltf.js  自研极简 GLB 解析（零外链）
js/bundle-core.js / bundle-war.js / bundle-ui.js   构建产物（提交入库）
```

**改源码 → 重建三包 → 五件套 → 提交**，四步缺一不可
（重建：`python .workbuddy/tools/patch/build_bundle.py`；门禁见 `docs/HANDOVER.md` §五）。

## 已知未修

~~`GAME.newGame` 里 `sphere.ensure()` 早于 `GAME.state` 赋值（首局球面按 seed 1 构建）~~
→ **v155b 已修**：新局顺序改成 种子 → 建球面 → 算出生点 → 生成城。

其余未修项见 `docs/HANDOVER.md` §七「已知未修」（buildCapOf 次座口径 · transfer 旧别名 ·
2D 兜底不看别星 · 运输返程 · 护送/斩首近似 · flaky ⑧c⑨ · 更细格网 · 据点抽稀 · 奇观形状）。

