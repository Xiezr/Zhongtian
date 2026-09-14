# `.workbuddy/tools/` 索引

> 开发期工具，**不进游戏运行期**。目录就是分组；本文件由 `gen/gen_tools_index.py` 自动生成。
> 归属判据与总地图见 `docs/项目地图.md`。**新增脚本请放进对应目录**（放在根目录会被列进"未归类"）。

| 目录 | 个数 | 干什么 |
|---|---|---|
| `asset/` | 8 | 抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。 |
| `audit/` | 10 | 结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。 |
| `break/` | 9 | 逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。 |
| `gen/` | 4 | 素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。 |
| `mem/` | 9 | MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。 |
| `patch/` | 12 | **事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。 |
| `probe/` | 17 | jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。 |
| `show/` | 4 | 给老板看的对照图 / 曲线校准 / 素材巡视。 |
| **合计** | **73** | |

## asset/（素材处理）

抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。

- `avatar_atlas.py`（8KB）
- `crop_pd3.py`（6KB）
- `gallery31.js`（4KB）　— 图标画廊截图：把全部图标以 96px 网格渲染成单页，便于统一评估设计感
- `gallery33.js`（6KB）　— v33 最终验收：99 图标几何验证（getBoundingClientRect，不受承台干扰）+ 总览图 + 城内统计
- `matte.js`（3KB）　— v35-b：AI 生成图的背景检测 + 抠底（四角采样 → 距离阈值 → alpha 归零）
- `portrait_gallery.js`（2KB）　— 头像画廊：渲染多种资质+性别的程序化头像
- `recolor_buildings.py`（8KB）
- `rename_matte.js`（3KB）　— v35-c：AI 原图 → 按 id 重命名 → 抠底 → 输出 ui/；并做风格一致性复检

## audit/（审计与核对）

结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。

- `audit_colors.js`（5KB）　— 配色审计：把 index.html 里 4 套主题的关键变量解析出来，
- `audit_refs.py`（3KB）
- `consolidate_docs.py`（9KB）
- `consolidate_docs2.py`（5KB）
- `consolidate_tools.py`（5KB）
- `read_recycle.py`（2KB）
- `survey_project.py`（5KB）
- `survey_project2.py`（3KB）
- `trash_paths.py`（3KB）
- `verify_v66_edits.py`（5KB）

## break/（破坏测试）

逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。

- `break_v60.py`（7KB）
- `break_v61.py`（5KB）
- `break_v62.py`（4KB）
- `break_v63.py`（6KB）
- `break_v64.py`（7KB）
- `break_v65.py`（10KB）
- `break_v66.py`（6KB）
- `break_v67.py`（5KB）
- `break_v67_save.py`（6KB）

## gen/（生成器与索引）

素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。

- `atlas_split.js`（4KB）　— v35-e：图集切分流水线 —— 一张 2×2 图集切成 4 个标准透明图标
- `gen_bitmaps.js`（3KB）　— v35-g：扫描 assets/icons/ui/ 生成 js/bitmaps.js（位图素材登记表）
- `gen_gicons.js`（13KB）　— 从 @iconify-json/game-icons 提取项目所需的 81 个图标，生成 js/gicons.js
- `gen_tools_index.py`（5KB）

## mem/（记忆维护）

MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。

- `distill_log_0913.py`（3KB）
- `finalize_v67.py`（4KB）
- `fix_log_0913.py`（3KB）
- `memory_v67c.py`（4KB）
- `slim_and_locate.py`（4KB）
- `slim_memory_template.py`（7KB）
- `slim_memory_v67.py`（25KB）
- `trim_last.py`（1KB）
- `wrapup_v67.py`（4KB）

## patch/（变更日志（补丁脚本））

**事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。

- `apply_abandon.py`（14KB）
- `apply_cols.py`（6KB）
- `finish_cleanup_v67.py`（8KB）
- `finish_cleanup_v67b.py`（8KB）
- `finish_cleanup_v67c.py`（9KB）
- `patch_v67_save.py`（23KB）
- `patch_v67_save2.py`（9KB）
- `patch_v67_save3.py`（19KB）
- `patch_v67_save3b.py`（4KB）
- `patch_v67_save4.py`（4KB）
- `patch_v67_terrain.py`（3KB）
- `v26-j.py`（14KB）

## probe/（探针（几何 / 界面 / 存档））

jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。

- `probe.js`（1KB）
- `probe60_geom.js`（5KB）　— v60 真实浏览器几何探针：老板的硬规矩（弹窗不许出现滚动条、内容不许溢出）
- `probe61_board.js`（5KB）　— v61 几何探针：**攻占后城格数按等级变小**（6×4 / 8×4 / 8×5）
- `probe62_geom.js`（3KB）
- `probe63_geom.js`（7KB）
- `probe64_geom.js`（6KB）
- `probe65_geom.js`（9KB）
- `probe66_sta.js`（6KB）
- `probe66_ui.js`（9KB）
- `probe67_after.js`（4KB）
- `probe67_cols.js`（4KB）
- `probe67_save.js`（5KB）
- `probe67_save2.js`（6KB）
- `probe67_save3.js`（5KB）
- `probe67_save_ui.js`（3KB）
- `probe67_tbl.js`（3KB）
- `probe_v43.js`（5KB）　— v43 战斗数值探针：复现"2000 铁骑兵一轮只打死 80 个长枪兵"。

## show/（展示与校准）

给老板看的对照图 / 曲线校准 / 素材巡视。

- `calib_series.js`（7KB）　— 建筑图标系列配色标定（v2）。
- `compare34.js`（9KB）　— v34 风格对比：同一批元素，四种画风 —— 现状(西方奇幻金属) / 中国色木刻 / MingCute / IconPark
- `scan6.js`（4KB）
- `tile_show.js`（3KB）　— v35-f：批量拼图（可复用）—— 传 id:中文列表，输出总览图

---

**跑测试**：`node audit.js` · `node smoke-test.js` · `NODE_PATH='…\node\workspace\node_modules' node e2e-test.js`

**跑工具**（路径含子目录）：`node .workbuddy/tools/gen/gen_bitmaps.js`（.js 用 node、.py 用 python）。
