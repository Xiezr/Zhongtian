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

## 代码结构（地基第 1 期后）

```
index.html          只加载 2 个脚本：vendor/three.min.js + js/bundle.js
js/main.js          唯一入口（import 列表 = 执行顺序）
js/core.js          window.GAME 单例
js/items.js         GAME.items   背包（唯一出口）
js/generals.js      GAME.gen     英雄状态机
js/cities.js        GAME.city    城市/资源/队列/城兵
js/ship.js          GAME.ship    空间站/战舰
js/bundle.js        构建产物（提交入库）
```

**改源码 → 重建 bundle → 提交**，三步缺一不可。

## 已知未修

`GAME.newGame` 里 `sphere.ensure()` 早于 `GAME.state` 赋值 → 全新会话首局球面按 seed 1 构建
（种子错配）。修它要连同"出生点校验依赖球面"的时序一起改，会移动地形并波及布局断言，
留待单独一轮。
