# `.workbuddy/tools/` 索引

> 开发期工具，**不进游戏运行期**。目录就是分组；本文件由 `gen/gen_tools_index.py` 自动生成。
> 归属判据与总地图见 `docs/项目地图.md`。**新增脚本请放进对应目录**（放在根目录会被列进"未归类"）。

| 目录 | 个数 | 干什么 |
|---|---|---|
| `asset/` | 8 | 抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。 |
| `audit/` | 12 | 结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。 |
| `break/` | 15 | 逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。 |
| `gen/` | 4 | 素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。 |
| `git/` | 3 | **收尾同步的唯一入口**。`sync.py` 默认干跑、`--apply` 才落盘（干跑先行是本项目铁律）；`gate.py` 是三件套门禁的**唯一出口**（pre-commit 钩子与 sync 都调它）；`install_hooks.py` 把 `hooks/` 里的钩子装进 `.git/hooks/`。 |
| `git/hooks/` | 2 | 存这里是为了**进版本库** —— `.git/hooks/` 不被 git 跟踪，换台机器克隆后必须跑 `install_hooks.py` 重装。⚠️ **行尾必须 LF**，CRLF 会让 `#!/bin/sh` 失效。 |
| `mem/` | 10 | MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。 |
| `patch/` | 33 | **事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。 |
| `probe/` | 17 | jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。 |
| `show/` | 4 | 给老板看的对照图 / 曲线校准 / 素材巡视。 |
| **合计** | **108** | |

## asset/（素材处理）

抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。

- `avatar_atlas.py`（8KB）　— 头像图集体检 + 切分 + 抠底。
- `crop_pd3.py`（6KB）　— 裁切 v3（定稿）：**从上往下裁，只去掉顶部留白**。
- `gallery31.js`（4KB）　— 图标画廊截图：把全部图标以 96px 网格渲染成单页，便于统一评估设计感
- `gallery33.js`（6KB）　— v33 最终验收：99 图标几何验证（getBoundingClientRect，不受承台干扰）+ 总览图 + 城内统计
- `matte.js`（3KB）　— v35-b：AI 生成图的背景检测 + 抠底（四角采样 → 距离阈值 → alpha 归零）
- `portrait_gallery.js`（2KB）　— 头像画廊：渲染多种资质+性别的程序化头像
- `recolor_buildings.py`（8KB）　— 建筑图标「系列配色」v3。
- `rename_matte.js`（3KB）　— v35-c：AI 原图 → 按 id 重命名 → 抠底 → 输出 ui/；并做风格一致性复检

## audit/（审计与核对）

结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。

- `audit_colors.js`（5KB）　— 配色审计：把 index.html 里 4 套主题的关键变量解析出来，
- `audit_refs.py`（3KB）　— 搬迁前普查：谁引用了 DESIGN.md / docs 里的文件 / tools 里的脚本。
- `consolidate_docs.py`（9KB）　— 集中存放 · 第一步：docs 分档 + 拆 DESIGN.md + 引用转接。
- `consolidate_docs2.py`（5KB）　— 集中存放 · 第二步：引用转接 + 终检（docs 分档与 DESIGN 拆分已在第一步完成）。
- `consolidate_tools.py`（5KB）　— 集中存放 · 第三步：tools 分子目录 + 引用转接 + 重写索引生成器。
- `economy_audit.js`（8KB）　— 经济审计：金币收入构成（v68 · 老板「审计一下」）
- `ladder_audit.js`（6KB）　— 数值阶梯审计 —— 回答一个问题：**从开局到洛阳，这条路走得通吗？
- `read_recycle.py`（2KB）　— 解析 E: 回收站的 $I 元数据，列出"刚刚被删的原始路径"。
- `survey_project.py`（5KB）　— 项目全景盘点：产物清单 + 规则分布 + 引用关系（为"是否完整/精简/集中"提供证据）。
- `survey_project2.py`（3KB）　— 补充盘点：素材分解 · 记忆体量 · 项目自建技能 · 测试规模。
- `trash_paths.py`（3KB）　— 把「无用图标」逐项送进回收站 —— 逐项回查，遇错不中断。
- `verify_v66_edits.py`（5KB）　— v66 改动落盘核验（第二版：正/反向分开写，标记与真实源码一致）。

## break/（破坏测试）

逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。

- `break_build_gate.py`（5KB）　— 破坏测试：确认第 54 节（建造前置 · 逐步探索）的三条核心断言**真的会红**。
- `break_dialog_unify.py`（5KB）　— 破坏测试：确认第 56 节（弹窗统一规范）的核心守卫**真的会红**。
- `break_gate.py`（2KB）　— 破坏测试：确认 git/gate.py 的判据**真的会红**（红不了的就是装饰）。
- `break_gov_center.py`（4KB）　— 破坏测试：确认第 55 节（官府居中 + 迁移）的核心断言**真的会红**。
- `break_hooks.py`（3KB）　— 端到端破坏测试：确认 pre-commit 钩子**真的会拦住**坏提交（拦不住就是装饰）。
- `break_invasion.py`（5KB）　— 破坏测试：确认第 53 节（定期来袭）的三条核心断言**真的会红**。
- `break_v60.py`（7KB）　— v60 破坏测试：往生产代码注入 15 类 bug，验证新护栏**逐条变红**。
- `break_v61.py`（5KB）　— v61 破坏测试：注入 10 类 bug，验证护栏逐条变红。
- `break_v62.py`（4KB）　— v62 破坏测试：注入 9 类 bug，验证护栏逐条变红。
- `break_v63.py`（6KB）　— v63 破坏测试：逐条注入 bug，确认新护栏**真的会红**（而不是恒真装饰）。
- `break_v64.py`（7KB）　— v64 破坏测试（带备份与完整性校验）。
- `break_v65.py`（10KB）　— v65 破坏测试（带备份与完整性校验）。
- `break_v66.py`（6KB）　— v66 破坏测试：逐条注入"退回改前写法"，确认对应断言真的变红。
- `break_v67.py`（5KB）　— v67 破坏测试：注入"退回改前写法"，确认对应断言真的变红。
- `break_v67_save.py`（6KB）　— v67 存档系统 · 破坏测试：逐类注入故障，确认新断言**真的会红**。

## gen/（生成器与索引）

素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。

- `atlas_split.js`（4KB）　— v35-e：图集切分流水线 —— 一张 2×2 图集切成 4 个标准透明图标
- `gen_bitmaps.js`（3KB）　— v35-g：扫描 assets/icons/ui/ 生成 js/bitmaps.js（位图素材登记表）
- `gen_gicons.js`（13KB）　— 从 @iconify-json/game-icons 提取项目所需的 81 个图标，生成 js/gicons.js
- `gen_tools_index.py`（6KB）　— 生成 `.workbuddy/tools/README_INDEX.md` —— 按**目录**分组（v67 起目录就是分组）。

## git/（Git 同步与门禁）

**收尾同步的唯一入口**。`sync.py` 默认干跑、`--apply` 才落盘（干跑先行是本项目铁律）；`gate.py` 是三件套门禁的**唯一出口**（pre-commit 钩子与 sync 都调它）；`install_hooks.py` 把 `hooks/` 里的钩子装进 `.git/hooks/`。

- `gate.py`（6KB）　— 三件套门禁 —— 提交前跑 audit / smoke / e2e，红了就不许提交。
- `install_hooks.py`（4KB）　— 安装 / 卸载 / 检查本仓的两个 git 钩子。
- `sync.py`（12KB）　— 收尾一键同步 —— 汇总改动 → 过门禁 → 提交 → 推送到 GitHub。

## git/hooks/（Git 钩子本体）

存这里是为了**进版本库** —— `.git/hooks/` 不被 git 跟踪，换台机器克隆后必须跑 `install_hooks.py` 重装。⚠️ **行尾必须 LF**，CRLF 会让 `#!/bin/sh` 失效。

- `post-commit`（2KB）　— Deepseekdb-managed-hook v1 —— 提交后自动推送到 GitHub
- `pre-commit`（1KB）　— Deepseekdb-managed-hook v1 —— 提交前跑三件套门禁

## mem/（记忆维护）

MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。

- `distill_log_0913.py`（3KB）　— 蒸馏 2026-09-13 日志（82KB）。
- `finalize_v67.py`（4KB）　— 收口：日志空行 · MEMORY 同步整改结论 · 定位浏览器 store（存档位置）。
- `fix_log_0913.py`（3KB）　— 回填蒸馏误删的 4 行 + 用**实测结论**替换那个错误的说明头。
- `measure_dialog.py`（2KB）　— 量"本次对话的记录"有多少与 docs 重复（决定压缩能删多少、以及会不会丢信息）。
- `memory_v67c.py`（4KB）　— v67 第三轮记忆：项目盘点 + 地图 + 判断（追加日志；MEMORY.md 只加一行索引）。
- `slim_and_locate.py`（4KB）　— MEMORY 超限 256 字符 → 精修（内容不丢，只收紧句子）＋ 定位浏览器 store。
- `slim_memory_template.py`（7KB）　— 最后一次瘦身：把「素材与图标」「配色细则」整段迁到 docs/AI工作备忘.md，
- `slim_memory_v67.py`（25KB）　— v67 记忆整理：MEMORY.md 压回注入上限内，明细下移到 docs/AI工作备忘.md。
- `trim_last.py`（1KB）　— MEMORY 还差 37 字符：三处收紧（不删任何规则）。
- `wrapup_v67.py`（4KB）　— 收尾：日志追加 · 刷新工具索引（本轮新增的脚本要入册）。

## patch/（变更日志（补丁脚本））

**事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。

- `apply_abandon.py`（14KB）　— v67 补丁 B：放弃城池（唯一入口 + 城池关联数据登记表 + 界面入口）。
- `apply_cols.py`（6KB）　— v67 补丁 A：侧栏「资源 / 驻军」两列数字各自成列、拉开间距。
- `finish_cleanup_v67.py`（8KB）　— v67 清理收尾：
- `finish_cleanup_v67b.py`（8KB）　— v67 清理收尾（第二次执行 —— 上一轮在「合并旧文档」处被中断）。
- `finish_cleanup_v67c.py`（9KB）　— v67 清理收尾 · 第三次（补齐上一轮崩溃点之后的剩余动作）。
- `patch_build_gate.py`（11KB）　— v68 · 逐步探索：建造前置规则（老板 2026-09-14 需求）
- `patch_build_gate_fix.py`（8KB）　— v68 修正：buildPrereqOf 支持"新建语义"，并适配受影响的既有测试。
- `patch_build_gate_fix2.py`（3KB）　— v68 修正 2：govMax 作用域提升。
- `patch_build_gate_fix3.py`（2KB）　— v68 修正 3：第 54 节测试自身的 bug —— free54 需能"避开已在用的格"。
- `patch_build_gate_test.py`（10KB）　— v68 · 建造前置：e2e 适配 + smoke 第 54 节断言。
- `patch_dialog_doc.py`（7KB）　— v68 · 弹窗统一：smoke 第 56 节守卫 + docs/设计规范.md §11。
- `patch_dialog_unify.py`（23KB）　— v68 · 弹窗统一（老板 2026-09-14：「点击建筑出来的弹窗……尽量统一」）
- `patch_git_docs.py`（7KB）　— 补丁：把「版本库 + 自动同步」写进 docs/项目地图.md，并订正被我改旧的数字。
- `patch_gov_center.py`（16KB）　— v68 · 官府居中（老板 2026-09-14）：
- `patch_gov_center_fix.py`（5KB）　— v68 官府居中 · 修正：剩余 4 处断言适配。
- `patch_invasion.py`（15KB）　— 第 2 期 · 防守（定期被攻打）—— 核心机制落地。
- `patch_invasion_dedupe.py`（4KB）　— 补丁 7：删掉重复的 `GAME.resName`，并补防回退断言。
- `patch_invasion_docs.py`（6KB）　— 补丁 6（收尾）：三份文档同步 —— 登记新出口 + 标注第 2 期落地 + 更正第 1 期误判。
- `patch_invasion_resname.py`（3KB）　— 补丁 3/3：修 `DATA.RESOURCES` 的取值方式。
- `patch_invasion_severity.py`（3KB）　— 补丁 5：修 severity 的返回口径。
- `patch_invasion_test.py`（8KB）　— 补丁 4：给「定期来袭」补 smoke 断言（第 53 节）。
- `patch_invasion_ui.py`（4KB）　— 补丁 2/2：把「定期来袭」的输出值接进界面（照断粮警示的成例）。
- `patch_ladder_doc.py`（6KB）　— 补丁：更正「数值断层」这条过期结论。
- `patch_play2_doc.py`（18KB）　— 把老板第二轮玩法清单（9 项）并入 docs/玩法扩展规划.md。
- `patch_play3_doc.py`（6KB）　— 第三轮：把拍板结果与落地清单并入 docs/玩法扩展规划.md（追加第十六章）。
- `patch_play4_doc.py`（3KB）　— 第四轮：追加 16.6（官府居中）+ 16.7（弃城核实结论）到 docs/玩法扩展规划.md。
- `patch_v67_save.py`（23KB）　— v67 · 补一套存档系统（老板：「补一个存档，看什么存档设计合适」）。
- `patch_v67_save2.py`（9KB）　— v67 · 存档系统 补丁 2/2：对话框 · 导出导入 · 首页入口 · 样式。
- `patch_v67_save3.py`（19KB）　— v67 · 存档系统 补丁 3/3：修 audit 死函数 · 更新受影响的断言 · 补新护栏。
- `patch_v67_save3b.py`（4KB）　— 补丁 3b：把 e2e 的存档面板用例插到收尾的 `G.ui.setView('city');` 之前。
- `patch_v67_save4.py`（4KB）　— 补丁 4：把 smoke 那条"面板 7 行"从"查 CSS 存在"改成"查渲染源"。
- `patch_v67_terrain.py`（3KB）　— 收口：退役最后一张地形位图 ai_terrain_city.png + 重生成注册表 + 收紧断言。
- `v26-j.py`（14KB）　— v26 批九：smoke 第 39 节 —— v26 五项需求的防回退断言

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
