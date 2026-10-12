# 《热血三国·单机版》项目交接文档

> 交接时点：**2026-10-12** · 版本：**BUILD 9136**（v90.64）· 面向**下一位接手的会话（人或 AI）**：先读本文，再动手。

---

## 一、30 秒上手

- **形态**：纯前端单机游戏（三国题材 → **废土**换皮）。零构建、零外链依赖；`index.html` 双击即玩（`file://` 或本地 http server）。
- **跑起来**：`python -m http.server 8777 --directory E:/Deepseekdb` → 浏览器开 `http://localhost:8777/`。
- **目录**：`index.html`（~4500 行，含全部 CSS）· `js/`（16 模块）· `assets/`（754MB 素材）· `docs/`（活文档）· `tools/`（素材标准化脚本）· `.workbuddy/`（门禁/工具/记忆，见 §五）。
- **门禁三件套**（改完必跑，见 §三）：`audit` 全 0 · `smoke 3642/0` · `e2e 1132/0`。

---

## 二、架构速览

**加载序**（`index.html` 底部 `<script>`，顺序不可乱）：
`data → state → questdata → systems → domain → map → map3d → battle → tactic → icons → gicons → bitmaps → portraits → story → ui → main`

| 模块 | 职责 |
|---|---|
| `data.js` | **全部静态配置**（建筑/科技/装备/兵种/地图常量/名城表…）。改数值先来这里。 |
| `state.js` | 存档结构、`newGame`、`adoptState`（读档迁移链）、`tickOnce`（主循环推进）、资源出口 `GAME.res`。 |
| `systems.js` | 玩法系统（装备/科技/招募/研究…）。`S.*` 挂到 `GAME.systems`。 |
| `domain.js` | 领域逻辑（城建/出征入口/弃城/装备详情…）。`GAME.*`。 |
| `map.js` | **2D 方格地图** + 据点/名城/野地逻辑 + `pick`。`DATA.MAP_W=MAP_H=500`。 |
| `map3d.js` | **3D 星球地图**（Three.js，`vendor/three.min.js`）：cube-sphere 地形 + 40962 六边地块 + 行政体系。**当前主地图用这个**（`GAME.map3d.enabled`）。 |
| `battle.js` / `tactic.js` | 战斗引擎 / 战术。 |
| `icons.js` / `gicons.js` / `bitmaps.js` | 图标出口（矢量兜底 / game-icons / **AI 位图注册表**）。`ICON.forXxx()`、`ICON.bmBuildingTier()`。 |
| `ui.js` | **全部界面**（视图 + 弹窗）。`ui.*`。 |
| `main.js` | 启动 + **点击事件总派发**（`data-action` → `case`）+ `GAME.doXxx` 动作。 |

**关键坐标口径**：**存储/逻辑用平面 (x,y)**（存档、战斗、行军、距离全按 x,y）；**界面一律显示球系经纬**（`GAME.map.coordText(x,y)` → `N°E M°N`，`coordText(city)` 已走球系）。两者经 `GAME.map.lonlatOf` / `GAME.map.dirOf` 确定性互转。

**设计画布**：1440×900，整体 `transform: scale(0.8533)` 适配窗口。布局锁死在这张画布上——**改尺寸前先量边界**（见 §四）。

---

## 三、门禁（改完必跑）

```bash
node audit.js                    # 结构审计：死函数/孤儿按钮/重复定义/零引用 → 目标全 0
node smoke-test.js               # 逻辑冒烟（无 DOM）→ 目标 3642 通过 / 0 失败
NODE_PATH='C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules' node e2e-test.js
                                 # 端到端（真实 DOM + HTTP）→ 目标 1132 通过 / 0 失败
```
- **pre-commit 钩子**自动跑 `.workbuddy/tools/git/gate.py`（三件套 + 数据表卫生）。Windows 下 **GBK 会让 gate.py 崩**（打印 ✅ 失败）→ 提交时前缀 `PYTHONUTF8=1 PYTHONIOENCODING=utf-8 git commit ...`。**不要用 `SKIP_GATE=1` 绕过**。
- **基线务必先记**：跑之前先确认当前基线（本机 3642/1132）；出现红点先判断是不是**并发在制品**（他人可能同时在改 `map.js` 等）。

---

## 四、必守约定 / 常见坑

1. **改 `js/**` 或 `assets/**` 后必须 bump 版本号**：`index.html` 顶部 `<!-- BUILD NNNN -->` + **全部** `?v=NNNN`（`V=$(grep -oE '\?v=[0-9]+' index.html|head -1|grep -oE '[0-9]+'); sed -i "s/BUILD $V/BUILD $((V+1))/; s/?v=$V/?v=$((V+1))/g" index.html`）。无自动版本号，否则浏览器缓存旧脚本（"改了没生效"十有八九是这个）。验收时用 `index.html?cb=<随机>` 强刷。
2. **改 `js/*.js` 保 LF**：CRLF 会挂 smoke 里 `\n` 正则断言。
3. **单一事实来源（SSOT）**：一个数/一处逻辑只有一个出口（`GAME.xxx` 函数），界面/测试都读它，**不各写一份**。改一处别忘了它的消费点。
4. **布局是固定画布 + 零余量**：英雄页部件栏正好填满 900dp 画布，**改尺寸前一次量全约束**（可用高/宽、行距、不重叠、出框），在纸面求可行解，别"改一版跑一遍"。
5. **门禁/测试是验收不是探路**：想清楚再改，一次成型。
6. **素材标准化流程**（勿逐图打补丁）：原始图入 `_raw` → `tools/normalize_*.py` 产出标准件 → 游戏只读标准件。去背用**边缘感知洪水**（边界洪水 + 只留最大前景块）。改完素材**重跑该脚本 + `gen_bitmaps.js`**。
7. **图片注册表 `js/bitmaps.js` 自动生成**：`node .workbuddy/tools/gen/gen_bitmaps.js`（扫描 `assets/icons/ui/`）。**勿手改**。

---

## 五、去哪找信息

| 想知道… | 看 |
|---|---|
| **最近在做什么**（逐条需求 + 落地状态） | `docs/需求台账-v9012-13.md`（最新在末尾 §v90.xx） |
| 项目全貌 / 文件索引 / 历史 | `docs/项目地图.md` |
| **踩坑教训**（很值钱，改前扫一眼） | `docs/AI工作备忘.md` |
| 数据表含义 | `docs/数值系统数据字典.md` · `docs/数据表索引.md` |
| 素材规格 / 出图 / 换皮 | `docs/图标适配流程.md` · `docs/废土地形生成规格.md` · `docs/美术换皮方法论.md` |
| 门禁/工具脚本 | `.workbuddy/tools/`（`git/gate.py`、`gen/gen_bitmaps.js`、`asset/…`） |

---

## 六、当前状态（v90.64）

**已收口（近期迭代）**：机甲素材 mk01~25 + 部件拆分；装备栏（去装备图/机甲放大/外挂浮层小框/出售/按套装装备/去+N角标）；研究队列**每城独立**（各城并行）；坐标界面**球系**；3D 星球图（名称非粗体/不透明遮挡背面/己方城引名/据点不相邻·不共名城·海面减半/海面纳入行省）；政务厅弃城入口；行军/派遣中将领不可另接调遣；同格拒建城；迁址后地图色块随动；**城内建筑 6/12 级新皮肤**；**政务厅按等级取皮肤**；**募兵营改「左列兵种清单 / 右侧详情」**（队列移入训练营建筑菜单）。详见 §五 的台账末尾。

**已知未决 / 待老板定夺**：
- **球面地形两处系统问题**：① **荒漠恒为 0**（`map3d.cellType` 的 `e<0.25` 与 `en<0.16` 量纲冲突）；② **海洋占比随种子在 18%~77% 间剧烈波动**（fbm 低频 + 硬阈值 SEA=0.52）。要给目标比例即可修。
- **老档"多城同格"**：`GAME.migrateCityCells` 读档时自动就近挪开（已接线）；`registerCity` 同格拒收（防将来）。
- 星球背面标签遮挡靠 `depthTest:true`（性能 OK），若同屏标签过多可考虑按视锥剔除。

---

## 七、工作方式（老板偏好）

- **别磨、果断执行**：先一次想全约束/依赖/可行解再动手；探查**并行一次到位**；别增量试错、反复预览、过度拆分。
- **不清楚就问**（边界不明/多种可能时先问，别自己锚定着做）；问了就一次问全。
- **视觉/布局改动**：先截图/量尺寸定位，再改；一个脚手架够用不写第二个。
- **改了就跑门禁**；素材改了记得 bump 版本 + 重生成注册表。
