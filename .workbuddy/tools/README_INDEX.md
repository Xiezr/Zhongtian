# `.workbuddy/tools/` 索引

> 开发期工具，**不进游戏运行期**。目录就是分组；本文件由 `gen/gen_tools_index.py` 自动生成。
> 归属判据与总地图见 `docs/项目地图.md`。**新增脚本请放进对应目录**（放在根目录会被列进"未归类"）。

| 目录 | 个数 | 干什么 |
|---|---|---|
| `asset/` | 23 | 抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。 |
| `audit/` | 20 | 结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。 |
| `break/` | 21 | 逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。 |
| `gen/` | 6 | 素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。 |
| `git/` | 3 | **收尾同步的唯一入口**。`sync.py` 默认干跑、`--apply` 才落盘（干跑先行是本项目铁律）；`gate.py` 是三件套门禁的**唯一出口**（pre-commit 钩子与 sync 都调它）；`install_hooks.py` 把 `hooks/` 里的钩子装进 `.git/hooks/`。 |
| `git/hooks/` | 2 | 存这里是为了**进版本库** —— `.git/hooks/` 不被 git 跟踪，换台机器克隆后必须跑 `install_hooks.py` 重装。⚠️ **行尾必须 LF**，CRLF 会让 `#!/bin/sh` 失效。 |
| `mem/` | 10 | MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。 |
| `patch/` | 509 | **事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。 |
| `play/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `playtest/` | 20 | **待归类**：确认用途后放进上面的某个目录。 |
| `probe/` | 101 | jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。 |
| `show/` | 40 | 给老板看的对照图 / 曲线校准 / 素材巡视。 |
| **合计** | **756** | |

## asset/（素材处理）

抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。

- `avatar_atlas.py`（8KB）　— 头像图集体检 + 切分 + 抠底。
- `build_atlas_src.py`（2KB）　— v89.107 建筑图标重绘 · 第一步：把 4 张原图拼成 2×2 图集（白底），
- `check_v89103_shots.js`（4KB）
- `check_v89116_shots.js`（3KB）
- `check_v89117_shots.js`（4KB）
- `check_v89118_shots.js`（3KB）
- `check_v89119_shots.js`（3KB）
- `check_v89120_shots.js`（4KB）
- `check_v89121_flags_on_screen.py`（2KB）　— v89121 · 实机截图里的族旗可见性：找高饱和像素簇（旗布）+ 报告颜色与位置
- `crop_city.py`（3KB）　— v89.43：城池贴图裁切流水线（与 crop_terrain.py 同一套铁律）。
- `crop_pd3.py`（6KB）　— 裁切 v3（定稿）：**从上往下裁，只去掉顶部留白**。
- `crop_terrain.py`（6KB）　— v89.42：地形贴图裁切流水线（从即梦参考图裁切 → 归一化 → 落位 assets/icons/ui/）。
- `diag_bldg_materials.py`（3KB）　— 诊断：原图（_gold_backup）与现图，各自的**图内色相结构** ——
- `flag_bldg_icons.py`（6KB）　— v89.107 建筑图标 · 第三步：给每座建筑画一面**族旗**。
- `gallery31.js`（4KB）　— 图标画廊截图：把全部图标以 96px 网格渲染成单页，便于统一评估设计感
- `gallery33.js`（6KB）　— v33 最终验收：99 图标几何验证（getBoundingClientRect，不受承台干扰）+ 总览图 + 城内统计
- `make_portrait_refs.py`（4KB）　— 将领肖像 · 参考图套件生成。
- `matte.js`（3KB）　— v35-b：AI 生成图的背景检测 + 抠底（四角采样 → 距离阈值 → alpha 归零）
- `portrait_gallery.js`（2KB）　— 头像画廊：渲染多种资质+性别的程序化头像
- `rename_matte.js`（3KB）　— v35-c：AI 原图 → 按 id 重命名 → 抠底 → 输出 ui/；并做风格一致性复检
- `split_atlas.py`（6KB）　— v89.107 建筑图标重绘 · 第二步：图集 → 体检 → 切分 → 抠底 → 统一裁切 → 出对照图。
- `verify_v89102_troop_icons.js`（4KB）
- `verify_v89106_screen.js`（11KB）

## audit/（审计与核对）

结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。

- `audit_colors.js`（5KB）　— 配色审计：把 index.html 里 4 套主题的关键变量解析出来，
- `audit_refs.py`（3KB）　— 搬迁前普查：谁引用了 DESIGN.md / docs 里的文件 / tools 里的脚本。
- `audit_v89105_chains.js`（23KB）
- `audit_v89105_css_tokens.js`（10KB）　— 取 <style> 段（含多条 style）
- `audit_v89105_modals.js`（11KB）
- `audit_v89112_pressure.js`（11KB）
- `audit_v89116_refs.js`（4KB）　— 白名单：动态挂载 / 测试或工具注入 / 平台/浏览器提供 / 本项目约定的外部注入点
- `audit_v89117_fonts.js`（7KB）　— 剥注释：说明文字里提到 font-size 不算数（本项目踩过多次）
- `audit_v89121_inventory.js`（6KB）
- `consolidate_docs.py`（9KB）　— 集中存放 · 第一步：docs 分档 + 拆 DESIGN.md + 引用转接。
- `consolidate_docs2.py`（5KB）　— 集中存放 · 第二步：引用转接 + 终检（docs 分档与 DESIGN 拆分已在第一步完成）。
- `consolidate_tools.py`（5KB）　— 集中存放 · 第三步：tools 分子目录 + 引用转接 + 重写索引生成器。
- `diag_v89105_overflow.js`（3KB）　— 诊断：7 个溢出弹窗的**高度分布**（哪个块把窗口撑爆了）
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
- `break_quest_ready.py`（5KB）　— 破坏测试：确认第 57 节（可领取任务置顶 + 行内领取）的核心断言**真的会红**。
- `break_v60.py`（7KB）　— v60 破坏测试：往生产代码注入 15 类 bug，验证新护栏**逐条变红**。
- `break_v61.py`（5KB）　— v61 破坏测试：注入 10 类 bug，验证护栏逐条变红。
- `break_v62.py`（4KB）　— v62 破坏测试：注入 9 类 bug，验证护栏逐条变红。
- `break_v63.py`（6KB）　— v63 破坏测试：逐条注入 bug，确认新护栏**真的会红**（而不是恒真装饰）。
- `break_v64.py`（7KB）　— v64 破坏测试（带备份与完整性校验）。
- `break_v65.py`（10KB）　— v65 破坏测试（带备份与完整性校验）。
- `break_v66.py`（6KB）　— v66 破坏测试：逐条注入"退回改前写法"，确认对应断言真的变红。
- `break_v67.py`（5KB）　— v67 破坏测试：注入"退回改前写法"，确认对应断言真的变红。
- `break_v67_save.py`（6KB）　— v67 存档系统 · 破坏测试：逐类注入故障，确认新断言**真的会红**。
- `break_v70.py`（5KB）　— 破坏测试：确认第 58 节（v70 五项需求）的核心断言**真的会红**。
- `break_v8986.py`（6KB）　— v89.86 破坏测试：对整改 21 条 + 门派 P1 的 smoke §85 断言逐一注入，确认**变红**（可翻转）。
- `break_v8987.py`（7KB）　— v89.87 破坏测试：对四需求（快购/派兵统一/战斗规则/观战）的 §87 断言逐一注入，
- `break_v8988.py`（7KB）　— v89.88 破坏测试：对「野外城池改造 + 地图悬浮」的 §88/§⑦ 断言逐一注入，确认**变红**。
- `break_v8989.py`（7KB）　— v89.89 破坏测试：对「v6 期待清单八条（A2/A3/A4/B1/C3/C4/D4/E3）」的 §89 断言逐一注入，

## gen/（生成器与索引）

素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。

- `atlas_split.js`（4KB）　— v35-e：图集切分流水线 —— 一张 2×2 图集切成 4 个标准透明图标
- `gen_bitmaps.js`（3KB）　— v35-g：扫描 assets/icons/ui/ 生成 js/bitmaps.js（位图素材登记表）
- `gen_gicons.js`（13KB）　— 从 @iconify-json/game-icons 提取项目所需的 81 个图标，生成 js/gicons.js
- `gen_tools_index.py`（6KB）　— 生成 `.workbuddy/tools/README_INDEX.md` —— 按**目录**分组（v67 起目录就是分组）。
- `gen_v89125_build_times.js`（9KB）　— v89.125：生成 docs/v89125-建筑建造时间表.md
- `gen_v8950_content.js`（20KB）

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
- `fix8940_smoke_lord.py`（3KB）　— 修正 smoke 的君主运行时断言：现场补临时君主/对照将（打完移除），保证不放空。
- `patch_build_gate.py`（11KB）　— v68 · 逐步探索：建造前置规则（老板 2026-09-14 需求）
- `patch_build_gate_fix.py`（8KB）　— v68 修正：buildPrereqOf 支持"新建语义"，并适配受影响的既有测试。
- `patch_build_gate_fix2.py`（3KB）　— v68 修正 2：govMax 作用域提升。
- `patch_build_gate_fix3.py`（2KB）　— v68 修正 3：第 54 节测试自身的 bug —— free54 需能"避开已在用的格"。
- `patch_build_gate_test.py`（10KB）　— v68 · 建造前置：e2e 适配 + smoke 第 54 节断言。
- `patch_city_attr_slim.py`（13KB）　— v71 · 城池属性只显示城池命名（侧栏短名 + 下拉框带坐标；配套 patch_city_attr_slim2.py）
- `patch_city_attr_slim2.py`（11KB）　— v71 续 · 城池下拉框单城也保留 + 选项显示州郡县坐标（配套 patch_city_attr_slim.py）
- `patch_dialog_doc.py`（7KB）　— v68 · 弹窗统一：smoke 第 56 节守卫 + docs/设计规范.md §11。
- `patch_dialog_unify.py`（23KB）　— v68 · 弹窗统一（老板 2026-09-14：「点击建筑出来的弹窗……尽量统一」）
- `patch_git_docs.py`（7KB）　— 补丁：把「版本库 + 自动同步」写进 docs/项目地图.md，并订正被我改旧的数字。
- `patch_gold_v2.py`（4KB）　— v89.91 patch v2：修黄金脑「购书过度购买」bug + 补日志。
- `patch_gov_center.py`（16KB）　— v68 · 官府居中（老板 2026-09-14）：
- `patch_gov_center_fix.py`（5KB）　— v68 官府居中 · 修正：剩余 4 处断言适配。
- `patch_guanfu_dlg_ico.py`（6KB）　— v72 · 修：官府（及城外建筑）「升级中」弹窗被 1024px 位图撑爆（老板：
- `patch_invasion.py`（15KB）　— 第 2 期 · 防守（定期被攻打）—— 核心机制落地。
- `patch_invasion_dedupe.py`（4KB）　— 补丁 7：删掉重复的 `GAME.resName`，并补防回退断言。
- `patch_invasion_docs.py`（6KB）　— 补丁 6（收尾）：三份文档同步 —— 登记新出口 + 标注第 2 期落地 + 更正第 1 期误判。
- `patch_invasion_resname.py`（3KB）　— 补丁 3/3：修 `DATA.RESOURCES` 的取值方式。
- `patch_invasion_severity.py`（3KB）　— 补丁 5：修 severity 的返回口径。
- `patch_invasion_test.py`（8KB）　— 补丁 4：给「定期来袭」补 smoke 断言（第 53 节）。
- `patch_invasion_ui.py`（4KB）　— 补丁 2/2：把「定期来袭」的输出值接进界面（照断粮警示的成例）。
- `patch_ladder_doc.py`（6KB）　— 补丁：更正「数值断层」这条过期结论。
- `patch_lib_plan.py`（5KB）　— v1：设计文档加 3.6 扩充池 + 规划 §十八 补素材库索引。幂等。
- `patch_ling_plan.py`（4KB）　— v1：玩法扩展规划.md §十八 追加（修炼装备·灵气 + 江湖游历设计挂钩）。幂等。
- `patch_plan_rxsg.py`（16KB）　— 规划文档补丁：第四轮 —— 热血三国玩法对照 · 缺口清单与可行性（2026-09-16）。
- `patch_play2_doc.py`（18KB）　— 把老板第二轮玩法清单（9 项）并入 docs/玩法扩展规划.md。
- `patch_play3_doc.py`（6KB）　— 第三轮：把拍板结果与落地清单并入 docs/玩法扩展规划.md（追加第十六章）。
- `patch_play4_doc.py`（3KB）　— 第四轮：追加 16.6（官府居中）+ 16.7（弃城核实结论）到 docs/玩法扩展规划.md。
- `patch_play_600x_v2.py`（11KB）　— patch_play_600x_v2.py — 修复驾驶舱 v1 的三处逻辑缺陷并落盘（python 定点替换）。
- `patch_play_600x_v3.py`（10KB）　— patch_play_600x_v3.py — 幂等修复驾驶舱（每项：已有→跳过；缺失→替换）。
- `patch_play_600x_v4.py`（5KB）　— patch_play_600x_v4.py — 幂等补丁：采集前置（须自家野地）+ 持续占领 + 里程碑时序。
- `patch_play_600x_v5.py`（11KB）　— patch_play_600x_v5.py — 幂等补丁（v4）：真人操作补齐。
- `patch_play_600x_v6.py`（3KB）　— patch_play_600x_v6.py — 幂等终修（正式跑前的最后补丁）。
- `patch_play_exit.py`（1KB）
- `patch_play_farm2.py`（5KB）　— 生成 play_farm2_600x.js：与 play_gold_600x.js 逐字同骨架，
- `patch_play_gold.py`（8KB）　— v89.91：从 play_600x.js fork 出 play_gold_600x.js（黄金流对照驾驶舱）。
- `patch_quest_ready.py`（24KB）　— v69：任务列表 —— 可领取的自动置顶 + 行右侧直接「领取」。
- `patch_quest_ready_e2efix.py`（4KB）　— v69 修正（e2e）：领取按钮按 **rq57 自己的 id** 取，不取"第一个"。
- `patch_quest_ready_fix.py`（3KB）　— v69 修正：① 第 57 节 withState 跨节不可见 → 用本地 helper
- `patch_quest_ready_live.py`（6KB）　— v69 补缺：让「达标即置顶」是**真·自动**。
- `patch_story_engine.py`（6KB）　— patch_story_engine.py —— 把「文字游戏 · 故事库引擎」挂进 js/state.js
- `patch_story_final.py`（5KB）　— patch_story_final.py -- (a) wild entry for UNOWNED tiles, (b) e2e section 81
- `patch_story_smoke.py`（5KB）　— patch_story_smoke.py -- add smoke section 81 (text game / story library)
- `patch_story_smoke2.py`（2KB）　— patch_story_smoke2.py -- fix smoke 81 assertion semantics
- `patch_story_ui.py`（9KB）　— patch_story_ui.py -- wire the text-game reader into js/ui.js
- `patch_story_vol01.py`（2KB）　— patch_story_vol01.py —— 补足 vol-01 三处幕文字数（每幕 >= 250 判据）
- `patch_story_wire.py`（5KB）　— patch_story_wire.py -- wire the text game into main.js / index.html / smoke-test.js
- `patch_v67_save.py`（23KB）　— v67 · 补一套存档系统（老板：「补一个存档，看什么存档设计合适」）。
- `patch_v67_save2.py`（9KB）　— v67 · 存档系统 补丁 2/2：对话框 · 导出导入 · 首页入口 · 样式。
- `patch_v67_save3.py`（19KB）　— v67 · 存档系统 补丁 3/3：修 audit 死函数 · 更新受影响的断言 · 补新护栏。
- `patch_v67_save3b.py`（4KB）　— 补丁 3b：把 e2e 的存档面板用例插到收尾的 `G.ui.setView('city');` 之前。
- `patch_v67_save4.py`（4KB）　— 补丁 4：把 smoke 那条"面板 7 行"从"查 CSS 存在"改成"查渲染源"。
- `patch_v67_terrain.py`（3KB）　— 收口：退役最后一张地形位图 ai_terrain_city.png + 重生成注册表 + 收紧断言。
- `patch_v70_adapt.py`（5KB）　— v70 适配：让既有测试跟上「君主也是将领」这一新事实（不改测试意图，只改口径）。
- `patch_v70_city_lord.py`（25KB）　— v70 · 第 2 块（坐标与迁址）+ 第 3 块（君主将领）。
- `patch_v70_create.py`（18KB）　— v70 · 第 4 块：创建界面（老板需求 5）。
- `patch_v70_geo.py`（16KB）　— v70 · 第 1 块：州郡县标识 + 城外满配数量表 + 城内仓库 4 座。
- `patch_v70_test.py`（22KB）　— v70 测试：smoke 第 58 节（五项需求的断言）+ e2e 追加（真实 DOM 走查）。
- `patch_v73_core.py`（21KB）　— v73 核心层补丁：黄金闸门 / 资质再降10倍 / 种田秘境（数据 + 域 + 系统）
- `patch_v73_docs.py`（12KB）　— v73 文档补丁：设计规范 §11 修订 + §14 新增 / AI工作备忘 §16 / 需求档案 v73 登记
- `patch_v73_tests.py`（26KB）　— v73 测试补丁：口径修正（prodBreakdown）+ smoke/e2e 守卫更新 + 新增 v73 断言节
- `patch_v73_ui.py`（21KB）　— v73 UI 层补丁：将领界面头部 / 建筑弹窗去顶图+吸底 / 种田秘境界面 / 官府入口
- `patch_v74_core.py`（9KB）　— v74 核心层补丁：①取消人口加成 / ⑤按类型成长 + 自由属性点
- `patch_v74_docs.py`（8KB）　— v74 文档补丁：设计规范 §15 + AI工作备忘 §17 + 需求档案 v74 登记
- `patch_v74_fix.py`（12KB）　— v74 收尾修复：rankOf 补发路径 / 创建界面固定画布 / vh 换算 / 注释校准 / 测试口径收口
- `patch_v74_tests.py`（27KB）　— v74 测试补丁：守卫翻转（16 处）+ 新增第 60 节（v74 七条）
- `patch_v74_ui.py`（32KB）　— v74 UI 层补丁：③④⑤⑥ 将领档案改造 + ⑦ 出征界面完善 + ② 固定像素画布
- `patch_v75_docs.py`（8KB）　— v75 · 客栈招募界面 —— 文档补丁
- `patch_v75_fix.py`（6KB）　— v75 修 · 客栈候选行紧凑几何（行高 52 → 36）
- `patch_v75_tests.py`（9KB）　— v75 · 客栈招募界面 —— 测试补丁（e2e 两处翻转 + smoke 新增第 61 节）
- `patch_v75_ui.py`（16KB）　— v75 · 客栈招募界面（老板五条）—— UI 层补丁
- `patch_v76_docs.py`（11KB）　— v76 · 文档补丁
- `patch_v76_fix.py`（5KB）　— v76 修 · 三处真机验收抓出的偏差（均已落盘，本脚本留档；重跑全跳过）
- `patch_v76_tests.py`（24KB）　— v76 · 四条 —— 测试补丁（smoke 8 处 + e2e 3 处翻转/重做）
- `patch_v76_ui.py`（28KB）　— v76 · 四条（布局 / 地图导航 / 将领分页 / 建筑弹窗）—— 代码+样式补丁
- `patch_v77_core.py`（27KB）　— v77 · 核心层：月俸体系（7 游戏日结算）+ 百炼强化 + 内功 + 宝箱/徭役令数据。
- `patch_v77_docs.py`（11KB）　— v77 · 文档补丁：设计规范 §18 / AI工作备忘 §20 / 需求档案 v77。
- `patch_v77_fix.py`（7KB）　— v77 · 修复补丁：SHOP_CATS 补新货 / §62 转义修正 / 六处守卫收窄。
- `patch_v77_tests.py`（21KB）　— v77 · 测试补丁：翻转旧守卫（五处）+ 新增 smoke 第 62 节 + e2e 三处更新。
- `patch_v77_ui.py`（37KB）　— v77 · UI 层：客栈表格 / 君主面板分栏 / 野地下拉框 / 三按钮退役 / 百炼强化 / 内功显示。
- `patch_v78_core.py`（21KB）　— v78 · 核心层：灵草时序拉长 + 种子改为活动获得（去黄金） + 隐藏「灵淬」升档加成。
- `patch_v78_docs.py`（7KB）　— v78 · 文档补丁：设计规范 §19（新增）/ AI工作备忘 §二十一 / 需求档案 v78。
- `patch_v78_tests.py`（11KB）　— v78 · 测试层：smoke §59 链条改种子制 + 新增 §63（灵草时序/种子经济/灵淬）+ e2e 三处。
- `patch_v78_ui.py`（13KB）　— v78 · UI 层：选种改种子制 / 在手种子一览 / 种子背包行（去播种）/ 装备详情撤「穿给谁」。
- `patch_v79_a.py`（16KB）　— v79-A · 核心层：爵位加成 + 主城 + 神器（数据 / 状态 / 消费点）。
- `patch_v79_b.py`（13KB）　— v79-B · UI 层：爵位加成展示 / 主城标识与设置入口 / 神器面板。
- `patch_v79_c.py`（24KB）　— v79-C · 装备单件化：实例模型 { u, id, enh } + 同名 甲/乙 序号 + 按件强化。
- `patch_v79_d.py`（26KB）　— v79-D · UI 层：装备单件化显示（背包 / 详情 / 强化 / 换装 / 人形）。
- `patch_v79_e.py`（14KB）　— v79-E · 测试新增：smoke §64（v79 四条）+ e2e v79 真实 DOM 段。
- `patch_v80_docs.py`（11KB）　— v80 · 文档层：设计规范（§11.2/11.3 更新 + §16.4 + §21）/ AI工作备忘 §二十三 / 需求档案 v80。
- `patch_v80_tests.py`（16KB）　— v80 · 测试层：smoke 三处翻转 + 两处守卫升级 + 新增 §65；e2e 一处翻转 + 新增 v80 段。
- `patch_v80_ui.py`（16KB）　— v80 · UI 层：客栈固定表 / 建筑吸底操作区 / 兵营步兵骑兵分页与数量直输。
- `patch_v81_docs.py`（5KB）　— v81 · 文档补丁：设计规范 §22 / AI工作备忘 §二十四 / 需求档案 v81。
- `patch_v81_fix.py`（4KB）　— v81 · 修复补丁：五处 smoke 老测试给 troopsHTML() 先切步兵页。
- `patch_v81_tests.py`（13KB）　— v81 · 测试补丁：smoke 两处守卫演进 + 新增 §66；e2e 六处跟进 + v81 新段。
- `patch_v81_ui.py`（11KB）　— v81 · 主补丁：君主卡名称并入信息表首行 / 兵营三页制（队列 · 步兵 · 骑兵）。
- `patch_v82_core.py`（5KB）　— v82 · 核心层：君主凡品开局（①）/ 官府征收整段退役（③）。
- `patch_v82_css.py`（14KB）　— v82 · 字体统一（老板④）：各级标题 / 文字 / 备注的格式（族）、大小（七档）、粗细（三档）。
- `patch_v82_docs.py`（7KB）　— v82 · 文档补丁：设计规范 §23 / 备忘 §二十五 / 需求档案 v82。
- `patch_v82_fix.py`（4KB）　— v82 · 修复补丁：extraLand 退役（防 audit 零引用）+ 两处重复语句收编。
- `patch_v82_tests.py`（15KB）　— v82 · 测试补丁：老守卫跟进（征收退役 / 文案 / 字体共享规则）+ 新增 §67 + e2e 两处。
- `patch_v82_ui.py`（9KB）　— v82 · UI 层：官府面板重做（去征收 / 城名居中）/ 君主面板去档位文字 / 建筑弹窗去野地行 / 改名弹窗去原名。
- `patch_v83_core.py`（7KB）　— v83 · 核心层：野地经验惩罚机制（每 12 级一个台阶 · 掠夺 / 占领野地时生效）。
- `patch_v83_docs.py`（4KB）　— v83 · 文档补丁：设计规范 §24 / 备忘 §二十六 / 需求档案 v83。
- `patch_v83_fix.py`（3KB）　— v83 · 夹具修复：§57 任务置顶夹具的存量 flake（r18 与 g01/g02 同指标冲突）。
- `patch_v83_tests.py`（8KB）　— v83 · 测试补丁：smoke 新增 §68（台阶 / 系数 / 战报 / 出征全链路）+ e2e 小段。
- `patch_v84_core.py`（4KB）　— v84 · 核心层：兵种卡去「拥有」行 / 辎重车→骑兵、斥候→步兵。
- `patch_v84_docs.py`（6KB）　— v84 · 文档：设计规范 §25 / AI工作备忘 §二十七 / 需求档案 v84。
- `patch_v84_fix.py`（3KB）　— v84 · 顺手修存量 flake：e2e 第 23 节「出征弹窗行军预估」的固定偏移坐标。
- `patch_v84_tests.py`（7KB）　— v84 · 测试补丁：smoke 改判 v37 卡面行数断言（2 → 1）+ 新增 §69；e2e 新增 v84 段。
- `patch_v85_core.py`（5KB）　— v85 · 核心层（I）：民房去人口统计入口 / 地图占满+放大（fitMapCell 搜索式自适应）。
- `patch_v85_css.py`（3KB）　— v85 · CSS：底部缩略地图（条尾 40px）+ 天下大势面板（方形缩略图 + 图例）。
- `patch_v85_docs.py`（7KB）　— v85 · 文档：设计规范 §26 / AI工作备忘 §二十八 / 需求档案 v85。
- `patch_v85_fix.py`（4KB）　— v85 · 修复：两处存量守卫的兼容（smoke 首跑 2158/2 定位）。
- `patch_v85_fix2.py`（9KB）　— v85.1 · 全面复核修复：缩略地图「城点 × 州色块」零错位。
- `patch_v85_fix2_docs.py`（5KB）　— v85.1 · 文档补丁：复核修正记录（设计规范 §26.3 / 备忘 §28.5 / 档案 v85 复核段）。
- `patch_v85_fix2_tests.py`（2KB）　— v85.1 · 测试补丁：新增「174 城零错位」断言（复核修复的关键不变量）。
- `patch_v85_mini.py`（13KB）　— v85 · 核心层（II）：缩略地图 —— 数据派生（map.js）+ 渲染/面板/底部条（ui.js）。
- `patch_v85_tests.py`（10KB）　— v85 · 测试补丁：e2e 两处旧断言改判（12×6 → 13×11 / 动态）+ e2e v85 段 + smoke §70。
- `patch_v86_battle.py`（11KB）　— v86 · 核心层（II）：battle.js —— 计谋效果接线（全部作用于入参/结算，不改引擎）。
- `patch_v86_data.py`（5KB）　— v86 · 数据层：DATA.SCHEMES（计谋八计）+ 锦囊道具。
- `patch_v86_docs.py`（8KB）　— v86 · 文档补丁：设计规范 §27 / 备忘 §二十九 / 需求档案 v86 段。
- `patch_v86_state.py`（9KB）　— v86 · 核心层（I）：state.js —— 计谋出口组 + invasion 接线（空城计/坚壁清野）。
- `patch_v86_tests.py`（17KB）　— v86 · 测试补丁：smoke §71（九条 · 结构+行为）+ e2e v86 段（真实 DOM）。
- `patch_v86_ui.py`（13KB）　— v86 · UI 层：出征面板计略行 + 计略选择弹窗 + 城池布防 + 商城分类 + 事件分发。
- `patch_v86_ui2.py`（9KB）　— v86 · UI 改造（II）：计略选择由"子弹窗"改为**出征面板内嵌展开区**。
- `patch_v87_core.py`（14KB）　— v87 · 数据层 + 核心层：野地专属场景（老板「2.为各类野地设计专属弹窗场景」）。
- `patch_v87_docs.py`（7KB）　— v87 · 文档补丁：设计规范 §28 / 备忘 §三十 / 需求档案 v87 段。
- `patch_v87_tests.py`（9KB）　— v87 · 测试补丁：smoke §72（五条）+ e2e v87 段（真实 DOM）。
- `patch_v87_ui.py`（7KB）　— v87 · UI 层：野地弹窗「地形专属场景」区块（未占/已占两分支）+ 执行 + 分发。
- `patch_v881_core.py`（6KB）　— v88.1 整合（state.js）：删 wildScene 组（3 函数）→ 并入 jianghuDo 的 scene 分支。探针幂等。
- `patch_v881_data.py`（6KB）　— v88.1 整合（data.js）：六地形场景并入 LING_ACT（kind scene）+ 删除 WILD_SCENES 表。探针幂等。
- `patch_v881_docs.py`（5KB）　— v88.1 文档：设计规范 §28 批注 + §29.6 / 档案 v88.1 段 / 备忘 §31.4。行尾适配 + 探针幂等。
- `patch_v881_tests.py`（7KB）　— v88.1 测试更新：smoke §72 改写为「场景整合」+ e2e v87 段替换为 v88.1 段。标记切割。
- `patch_v881_ui.py`（7KB）　— v88.1 整合（ui.js + main.js）：删 wildSceneHTML/doWildScene / 接线永删 / scene 置顶 / 分发删除。
- `patch_v88_data.py`（11KB）　— v88 数据层：灵气装备（双轨修炼侧）+ 蕴养表 + 江湖活动 + 灵气精华。探针幂等。
- `patch_v88_docs.py`（8KB）　— v88 文档：设计规范 §29 / 备忘 §三十一 / 档案 v88 段 / 规划 §十八补记。探针幂等 + 行尾适配。
- `patch_v88_e2e.py`（5KB）　— v88 e2e 段：双轨切换 / 蕴养面板 / 江湖游历（真实 DOM）。探针幂等。
- `patch_v88_main.py`（2KB）　— v88 main.js：事件分发 4 条 + do* 包装 2 个。探针幂等。
- `patch_v88_state.py`（10KB）　— v88 状态层（state.js）：双轨切换 + 灵力出口 + 江湖游历出口组。探针幂等。
- `patch_v88_systems.py`（10KB）　— v88 核心分流（systems.js）：equipBagOf 唯一出口 + 9 处双轨改造。探针幂等。
- `patch_v88_tests.py`（7KB）　— v88 测试：smoke §73 段（双轨/蕴养/江湖）。探针幂等。
- `patch_v88_tools.py`（7KB）　— v88 工具层（domain.js）：双轨装备寻址兼容 + 品质名 + 蕴养函数组。探针幂等。
- `patch_v88_tools2.py`（3KB）　— v88 工具层补充（domain.js）：军装强化/拆解对灵气件的防护。探针幂等。
- `patch_v88_ui.py`（13KB）　— v88 UI 第一批（ui.js）：品质色到6 / 描述加灵力 / 两袋寻址 / genPane 双轨 / dollSlot 重写 + 修复 / dollLingPanel。探…
- `patch_v88_ui2.py`（15KB）　— v88 UI 第二批（ui.js）：openEqSlot 双轨 / openLingTemper / jianghuHTML / 弹窗接线 / 装备总览页。探针幂等。
- `patch_v8910.py`（6KB）　— patch_v8910.py —— v89.10 接线：卷 03~05 装载 + 新锚点断言
- `patch_v89100_a_consign.py`（10KB）　— v89.100-A：道具寄售通道（按购买价 75% 回收）
- `patch_v89100_b_smoke.py`（5KB）　— v89.100-B：冒烟第 100 节（道具寄售验收钉子）
- `patch_v89100_c_rush.py`（8KB）　— v89.100-C：推演脑 econ / loot 两模式（对 play_rush_1x.js 的增量，幂等）
- `patch_v89100_d_fix.py`（3KB）　— v89.100-D：三处修复（首测暴露）
- `patch_v89100_e_consign_only.py`（5KB）　— v89.100-E：寄售通道支持类型白名单（only）+ 脑改为只卖战利品
- `patch_v89101_d_span.py`（5KB）　— patch_v89101_d_span.py — v89.101 城流跨越（span 模式）
- `patch_v89101_e_span2.py`（3KB）　— patch_v89101_e_span2.py — v89.101b 城流跨越 · 校准版
- `patch_v89101_f_span3.py`（3KB）　— patch_v89101_f_span3.py — v89.101c 城流跨越 · 二校准
- `patch_v89101_g_span4.py`（2KB）　— patch_v89101_g_span4.py — v89.101d 城流跨越 · 三校准（官府总闸）
- `patch_v89105_alias.py`（9KB）
- `patch_v89105_asserts.py`（6KB）
- `patch_v89105_e2e_restore1.py`（6KB）
- `patch_v89105_e2e_restore2.py`（3KB）　— v89.105 事故复建 · 批次 2：统计页退役 / 战报两页 / 整叠使用 / 商城 / 故事集
- `patch_v89105_e2e_restore2b.py`（4KB）
- `patch_v89105_e2e_restore3.py`（7KB）
- `patch_v89105_fix_selfref.py`（2KB）
- `patch_v89105_fix_selfref2.py`（2KB）
- `patch_v89105_modal.py`（11KB）
- `patch_v89105_modal2.py`（7KB）
- `patch_v89105_surfaces.py`（6KB）
- `patch_v89105_tokens.py`（12KB）
- `patch_v89107_docpage.py`（2KB）　— v89.107 公文页重做：把 ui.js 的「消息频道」整段换成「五类独立页签」。
- `patch_v89107_msgkind.py`（4KB）　— v89.107 消息分类打标：把"发射点声明类别"落到 GAME.log 调用点上。
- `patch_v89107_msgkind2.py`（1KB）　— v89.107 打标 · 第二批（行号按 state.js 插入后的新编号重取）。
- `patch_v89109_fix.py`（5KB）　— v89.109 收尾：data-tside 改名（避 audit 的 data-side 约定）+ 在途"再出征"入口 + 断言更新
- `patch_v89109_fix3.py`（3KB）　— v89.109 收尾3：invasionArmyOf 最小分配 bug + 坚壁清野断言场景（兵力在别城）
- `patch_v89109_invasion.py`（13KB）　— v89.109：state.js —— 来袭防御战战斗化（战报+回放）+ 掠夺 gate + 城墙口径对齐
- `patch_v89109_jianbi.py`（3KB）　— v89.109 收尾2：坚壁清野对兵损同样生效 + 断言改到破防场景
- `patch_v89109_loot_checks.py`（4KB）　— v89.109：更新两条 loot 断言（假想档位 → 真实关系）
- `patch_v89109_loot_fix2.py`（1KB）　— v89.109 fix2：断言1 的县城量纲折算（粮食单项 → 合计）
- `patch_v89109_lootgate.py`（4KB）　— v89.109：battle.js —— lootGateOf（掠夺前置闸·唯一出口）+ raid 落账接线
- `patch_v89109_tactic2.py`（2KB）　— v89.109：tactic.js —— playerDef 透传（我方城防御读玩家战术）+ 出城部队起/余统计
- `patch_v89109_tactic_sortie.py`（4KB）　— v89.109：tactic.js 接 sortie（出城迎战）—— 常量 + 展开 + 墙保护 + 拦拆墙
- `patch_v89109_tactics.py`（6KB）　— v89.109：domain.js 战术段重写 —— 分侧（atk/def）+ sortie（出城迎战）+ 老档迁移
- `patch_v89109_ui.py`（13KB）　— v89.109：UI 层 —— 战术分侧渲染 + 军务出征/防守页改造 + main 动作支持 side
- `patch_v8910_docs.py`（11KB）　— patch_v8910_docs.py —— v89.10 文档：README 进度 / 需求档案 / 设计规范 §40 / AI工作备忘 §42+§43
- `patch_v89110_danger.py`（25KB）
- `patch_v89110_tests.py`（15KB）
- `patch_v89111_inv.py`（27KB）
- `patch_v89111_tests.py`（13KB）
- `patch_v89112_modals.py`（16KB）
- `patch_v89112b_modals.py`（8KB）
- `patch_v89112c_modals.py`（2KB）　— v89.112c · 弹窗整改收尾：装备 -217 / 战报 -67 的最后一轮压缩
- `patch_v89113_mayor.py`（19KB）
- `patch_v89113b_ui_tests.py`（15KB）　— v89.113b · 城主收尾：城池面板/烽火页显示 + 文案 + smoke 升级
- `patch_v89113c_inv.py`（9KB）
- `patch_v89113d_texts.py`（8KB）
- `patch_v89114a_load.py`（4KB）
- `patch_v89115a_smoke92.py`（6KB）
- `patch_v89115b_smoke_tail.py`（6KB）
- `patch_v89115c_smoke_fix.py`（4KB）　— patch_v89115c_smoke_fix.py — 修 4 条失败：① 取轮转城；②-4 自证判据；④ 显式重置 s.inv。
- `patch_v89115d_auto.py`（18KB）
- `patch_v89115e_bag.py`（15KB）
- `patch_v89115f_bag_tests.py`（3KB）　— patch_v89115f_bag_tests.py — 背包四类 → 两类（装备/宝物）+ 二级分类的测试升级
- `patch_v89115g_guard.py`（3KB）　— patch_v89115g_guard.py — 需求 1：守将属性对守城全军加成（全覆盖）
- `patch_v89115h_duel.py`（11KB）　— patch_v89115h_duel.py — 需求 2：斗将战（战前 · 50% · 胜者将领属性 +10% 临时）
- `patch_v89115i_bag_e2e.py`（9KB）　— patch_v89115i_bag_e2e.py — ① ui.openBag / bagHTML 支持旧页签值迁移；② e2e 断言升级
- `patch_v89115j_smoke95.py`（11KB）　— patch_v89115j_smoke95.py — 新增 smoke §95：本轮五件的新断言
- `patch_v89116a_bugs.py`（10KB）　— v89.116 补丁 A：三个小 bug —— ①守将函数名笔误 ②显示比例无监听 ③快购按用途过滤
- `patch_v89116b_defsandbox.py`（19KB）　— v89.116 补丁 B：守城战报接**真沙盘**（老板需求 4）
- `patch_v89116c_sdview.py`（7KB）　— v89.116 补丁 C：沙盘视角的收尾（sdLine / sdPaint / sdSimEnd / 推演入口 / 打开提示）
- `patch_v89116d2_captive_state.py`（2KB）　— v89.116 补丁 D2：守城侧的俘虏明细（补 D 里漏掉的两处）
- `patch_v89116d_captive.py`（14KB）　— v89.116 补丁 D：俘虏营（按兵种） + 自动治疗触发记录（老板需求 3 / 7）
- `patch_v89116e_affairs.py`（14KB）　— v89.116 补丁 E：军务处「伤兵营 / 俘虏营」（逐兵种）+ 自动治疗触发记录（UI 层）
- `patch_v89116f_sg_doc.py`（13KB）　— v89.116 补丁 F：待阅逸闻 6×5 + 翻页（需求 1） · 公文去掉烽火页签（需求 6）
- `patch_v89116g_battleui.py`（23KB）　— v89.116 补丁 G：实时战斗界面重排（老板需求 8）+ 敌方默认目标口径
- `patch_v89116h_btcss.py`（8KB）　— v89.116 补丁 H：战场新布局的 CSS + 退役 btCmdHTML / bt-cmd* 样式
- `patch_v89116i_tests.py`（15KB）　— v89.116 补丁 I：测试适配（10 处旧口径）+ 新增 §96（九条需求各一条断言）
- `patch_v89116j_stats.py`（3KB）　— v89.116 补丁 J：兵种数值梳理（老板需求 9）
- `patch_v89116k_sec96fix.py`（5KB）　— v89.116 §96 断言修正（五处）：剥注释取 CSS / 篇名计数 / 快购用途判据 / autoHeal 出口 / 退役判据
- `patch_v89116l_sec96fix2.py`（2KB）　— v89.116 §96 断言修正（续）：日志窗行数判据容错 + 退役判据改查"定义式"
- `patch_v89116m_sec96fix3.py`（6KB）　— v89.116 §96 修正（三）：btRoundLine 返回行文本（可测）+ 两条判据按"源码可查的事实"重写
- `patch_v89116n_refs.py`（6KB）　— v89.116 补丁 N：**同族 bug 一次清干净** —— "引用了不存在的成员" 五个修复
- `patch_v89116o2_auditfix.py`（2KB）　— v89.116 补丁 O2：audit.js ⑥ 节 —— 补本地 stripComment + 扩全模块扫描清单
- `patch_v89116o_auditrefs.py`（6KB）　— v89.116 补丁 O：把"未定义引用"审计**接进 audit.js**（同族 bug 的制度性防护）
- `patch_v89116p_sec96refs.py`（2KB）　— v89.116 补丁 P：§96 追加"同族 bug 清剿 + 未定义引用审计"三条断言
- `patch_v89117a2_maskel.py`（5KB）　— v89.117 补丁 A2 —— 弹窗栈的**能力判据**修正（smoke DOM 桩适配）
- `patch_v89117a_modalstack.py`（12KB）　— v89.117 补丁 A —— 弹窗**层级栈** + 同级重绘去闪（老板需求 6）
- `patch_v89117b2_affairs.py`（3KB）　— v89.117 补丁 B2（重写）—— 军务处两卡改走 ui.campCard
- `patch_v89117b_camps.py`（14KB）　— v89.117 补丁 B —— 俘虏营/伤兵营可见化 + 规则上桌面（老板需求 1）
- `patch_v89117d_fonts.py`（8KB）　— v89.117 补丁 D —— 字体体系统一：字号 / 字重 / 行高 / 角色（老板需求 3）
- `patch_v89117f2_smokefix.py`（1KB）　— 修复 smoke-test.js 里被 heredoc 吃掉反斜杠的三处（v89.117 · 第二轮）
- `patch_v89117f_smokefix.py`（2KB）　— 修复 smoke-test.js 里被 heredoc 吃掉反斜杠的两处（v89.117）
- `patch_v89117g_forge.py`（11KB）　— v89.117 补丁 E —— 铁匠铺：打造键收敛到底部 + 具体套装筛选（老板需求 4）
- `patch_v89117h_bag.py`（15KB）　— v89.117 补丁 F —— 背包装备页：列全（含穿戴）+ 细分类（老板需求 5）
- `patch_v89117i_battle.py`（13KB）　— v89.117 补丁 G —— 战斗界面再压缩 + 阵亡变暗 + 逐兵种回合行（老板需求 7）
- `patch_v89117j_smoke_bt.py`（5KB）　— v89.117 补丁 H1 —— 两条 v89.116 战斗界面断言升级到新口径（需求 7）
- `patch_v89117k_e2e.py`（10KB）　— v89.117 补丁 H2 —— 弹窗栈引入后的 e2e 适配 + 铁匠铺新口径
- `patch_v89117l_e2e2.py`（4KB）　— v89.117 补丁 H3 —— e2e 最后两条
- `patch_v89117m_archive.py`（33KB）　— v89.117 补档 —— 需求档案：补录 v89.92 ~ v89.117（老板需求 0「注意记录前述的所有需求」）
- `patch_v89117n_fix6.py`（5KB）　— v89.117 补丁 H4 —— 六条断言/样式适配（§97 首跑 + 两条旧口径 + 标尺）
- `patch_v89117o_e2e3.py`（3KB）　— v89.117 补丁 H5 —— e2e 两条 v21/v89.86 断言升级（军务总览 ⑤ 段）
- `patch_v89118a_captive_elephant.py`（15KB）
- `patch_v89118b_invasion_auto.py`（17KB）
- `patch_v89118c_tests.py`（11KB）
- `patch_v89118d_playtest.py`（17KB）
- `patch_v89118f_boost.py`（13KB）
- `patch_v89118g_cockpit.py`（4KB）
- `patch_v89118h_cockpit2.py`（4KB）
- `patch_v89118i_cockpit3.py`（5KB）
- `patch_v89118m_archive.py`（7KB）
- `patch_v89119a2_battle_fix.py`（3KB）　— patch_v89119a2_battle_fix.py — 补上 battle.js evLine 的函数收尾（v89.119）
- `patch_v89119a_counter_order.py`（13KB）　— patch_v89119a_counter_order.py — 反击记录配对（v89.119）
- `patch_v89119b_sec100.py`（1KB）　— 把 §100 片段插到 smoke-test.js 的汇总行之前（短脚本：读→改→原子落盘→自检）
- `patch_v89119c_sec100fix.py`（1KB）　— 修 §100 ⑥ 的源码级正则：battle.js 用中间变量 hk/hi（与 tactic/ui 的内联写法不同）
- `patch_v89119d_checkfn.py`（4KB）　— patch_v89119d_checkfn.py — 修「把函数当布尔传」的恒真断言（v89.119）
- `patch_v89119e_audit77.py`（5KB）　— patch_v89119e_audit77.py — audit.js 加第 ⑦ 节：恒真断言扫描（v89.119）
- `patch_v89119f_polish.py`（5KB）　— patch_v89119f_polish.py — 配对文案统一为「对方X反击」（v89.119）
- `patch_v89119g_report_dedup.py`（5KB）　— patch_v89119g_report_dedup.py — 战报正文页去重与收高（v89.119）
- `patch_v89119h_tall.py`（5KB）　— patch_v89119h_tall.py — 战报正文页专属加高档（v89.119）
- `patch_v89119i_archive.py`（6KB）　— patch_v89119i_archive.py — 需求档案补 v89.119 + smoke 档案断言
- `patch_v89120a_report_rid.py`（14KB）　— v89.120 补丁 A：战报身份 rid 化（根治「战报异常跳转」）
- `patch_v89120b_sim_btn_log.py`（14KB）　— v89.120 补丁 B：需求 2（回放态设定即生效）+ 需求 3（三键上移读秒行）+ 需求 4（回合记录倒叙）
- `patch_v89120c_tests.py`（6KB）　— v89.120 补丁 C：测试适配 + §101 新断言 + e2e 真 DOM 增补
- `patch_v89120d_sec101fix.py`（5KB）　— v89.120 补丁 D：修 §101 两处断言写法（都是断言自己的问题，代码无 bug）
- `patch_v89120e_e2e.py`（2KB）　— v89.120 补丁 E：e2e D4 收藏用例升级（dataset.i → dataset.rid）
- `patch_v89120f_archive.py`（6KB）　— v89.120 补档案：总览表 + 逐轮明细 + 遗留更新（老板「注意记录前述的所有需求」）
- `patch_v89126a_pop_cfg.py`（3KB）　— v89.126 补丁 A：人口增速改「固定 2 小时补满（现实时间）」
- `patch_v89126b_pop_rate.py`（5KB）　— v89.126 补丁 B：人口增速口径落地（domain/state/ui 三处）
- `patch_v89126c_smoke.py`（5KB）　— v89.126 补丁 C：smoke 断言升级
- `patch_v89126d_labor.py`（10KB）　— v89.126 补丁 D：劳作占用人口（需求 2）
- `patch_v89126e_smoke_labor.py`（5KB）　— v89.126 补丁 E：smoke 新增 §106（劳作占用：满配 12.5% / 比例 / 可征 / 守卫真调）
- `patch_v89126f_smoke_fix.py`（2KB）　— v89.126 补丁 F：修 §106② 判据（占用比 = 级数比，而不是"级数减半"）
- `patch_v89126g1_wall_state.py`（9KB）　— v89.126 补丁 G1：城墙并入建筑体系（data / state / battle）
- `patch_v89126g2_wall_code.py`（12KB）　— v89.126 补丁 G2：城墙并入建筑体系（domain / ui / main）
- `patch_v89126h_smoke_wall1.py`（7KB）　— v89.126 补丁 H：smoke 城墙专区断言升级（批次 1）
- `patch_v89126i2_citydef.py`（3KB）　— v89.126 补丁 I2：citydef 折扣接线（仅 ③）
- `patch_v89126i_wall_fix.py`（6KB）　— v89.126 补丁 I：
- `patch_v89126j_smoke_auto.py`（6KB）　— v89.126 补丁 J：重写「①城墙纳入自动建造」断言段（v64 旧口径 → v89.126 占格口径）
- `patch_v89126k_smoke_wall2.py`（6KB）　— v89.126 补丁 K：smoke 城墙消费类断言升级
- `patch_v89126l_final.py`（8KB）　— v89.126 补丁 L：收尾批
- `patch_v89126m_e2e.py`（5KB）　— v89.126 补丁 M：e2e 城墙断言升级
- `patch_v89126n_e2e2.py`（3KB）　— v89.126 补丁 N：e2e 点墙环 —— 前置先跑、再取 wallHit（防 refreshAll 重建 DOM 后引用失效）
- `patch_v89126o_diag.py`（1KB）　— v89.126 补丁 O（临时诊断）：给点墙环断言加 DBG 输出
- `patch_v89126p_e2e3.py`（2KB）　— v89.126 补丁 P：e2e 点墙环断言定稿（打开建造菜单 + 翻页见「城墙」）
- `patch_v89126q_gen.py`（5KB）　— v89.126 补丁 Q：
- `patch_v89127a_tips_fmt.py`（4KB）
- `patch_v89127b_smoke.py`（4KB）　— v89.127 补丁 B：smoke 断言 —— U.fmt 千级逗号 + §107 城墙入城迁移提示（3 条）
- `patch_v89128a_domain.py`（7KB）　— v89.128 补丁 A（domain.js）：城墙回环城槽 —— 槽访问唯一出口 cellOf / wallSlotOf
- `patch_v89128b2_state.py`（2KB）　— v89.128 补丁 B2（state.js）：清理三处残留
- `patch_v89128b_state.py`（9KB）　— v89.128 补丁 B（state.js）：城墙回环城槽
- `patch_v89128c_ui.py`（15KB）　— v89.128 补丁 C：城墙回环城槽 —— 界面层与转正提取
- `patch_v89128d_smoke.py`（12KB）　— v89.128 补丁 D：smoke 城墙断言升级（占格 → 环城槽）
- `patch_v89128e_smoke2.py`（9KB）　— v89.128 补丁 E：smoke 剩余 8 条红点升级（转正提取 / 迁移口径 / 正则可升级）
- `patch_v89128f_e2e.py`（8KB）　— v89.128 补丁 F：e2e 城墙断言升级（环城视觉=建筑外观 / 环城槽面板 / 自动升级）
- `patch_v89128g_buildtime.py`（7KB）　— v89.128 补丁 G：需求 3+4 —— 建造时间重设计
- `patch_v89128h_smoke3.py`（10KB）　— v89.128 补丁 H（smoke）：§104 口径升级（哨兵 0 → 曲线）+ 新增 §108（12 级循环/≤24h/区分度）
- `patch_v89128j_leftbar.py`（16KB）　— v89.128 补丁 J：需求 7+8 左栏统计改造
- `patch_v89128k_gather.py`（12KB）　— v89.128 补丁 K：需求 5 —— 自动采集/自动收获 + 野地驻军规则
- `patch_v89129a_wall_time.py`（6KB）　— patch_v89129a_wall_time.py —— v89.129 需求 1：城墙独立建造时间 + 资源重排。
- `patch_v89129b_fort_guard.py`（7KB）　— patch_v89129b_fort_guard.py —— v89.129 需求 2：据点守将（唯一缺口）。
- `patch_v89129c_recgen.py`（7KB）　— patch_v89129c_recgen.py —— v89.129 需求 2：相称尺子 + 出征面板建议行。
- `patch_v89129d_smoke.py`（9KB）　— patch_v89129d_smoke.py —— v89.129：smoke §111 断言（插在"结果："行之前）。
- `patch_v89130_archive.py`（9KB）　— patch_v89130_archive.py —— 档案：① 总览补 v89.121~130 ② v89.128 逐字原文
- `patch_v89131a_data.py`（6KB）　— v89.131 补丁 A：data.js
- `patch_v89131b2_domain.py`（3KB）　— v89.131 补丁 B2：domain.js —— 精力公式拆成"零件唯一出口"（energyPartsOf）
- `patch_v89131b_domain.py`（3KB）　— v89.131 补丁 B：domain.js —— 精力三出口（上限 / 当前 / 写入）
- `patch_v89131c_systems.py`（2KB）　— v89.131 补丁 C：systems.js —— useItem 新增 'energy' 分支（对照 stamina 分支）
- `patch_v89131d_state.py`（5KB）　— v89.131 补丁 D：state.js —— 回复口径改「现实时间百分比（24h 满）」
- `patch_v89131e1_ui_pane.py`（12KB）　— v89.131 补丁 E1：ui.js —— genPane 状态区改造
- `patch_v89131e2_ui_picker.py`（8KB）　— v89.131 补丁 E2：体力/精力道具选择窗 + 动作派发 + 商城页签 + 提示表
- `patch_v89131f_css.py`（7KB）　— v89.131 补丁 F：index.html —— 将领档案版面改造
- `patch_v89131g_smoke.py`（16KB）　— v89.131 补丁 G：smoke-test.js 升级 8 处 + 新增 §112
- `patch_v8914.py`（16KB）　— patch_v8914.py — v89.14：卷 09~18 接线（60 篇）+ 残留清理 + 校验器判据 11/12
- `patch_v8914_docs.py`（14KB）　— patch_v8914_docs.py — v89.14 文档补录
- `patch_v8928_theme_check.py`（2KB）　— v89.28 题材线（江湖 / 修炼 / 四夷）· check.py 判据 12 扩展
- `patch_v8928_theme_docs.py`（17KB）　— v89.28 题材线文档补录（README / 需求档案 / 设计规范 / 工作备忘 / 工作记忆）
- `patch_v8928_theme_wire.py`（10KB）　— v89.28 题材线接线：index.html 装载 + smoke 断言 + e2e 真实点击
- `patch_v8929_docs.py`（11KB）　— v89.29 文档补录：README（入口改版）/ 需求档案 / 设计规范 / 工作备忘 / 工作记忆
- `patch_v8929_e2e.py`（10KB）　— v89.29 e2e 补丁：守卫 + §81 故事区整体重写
- `patch_v8929_engine.py`（13KB）　— v89.29 逸闻入口改版：列表菜单 → 概率奇遇
- `patch_v8929_smoke.py`（9KB）　— v89.29 smoke 补丁：概率奇遇（引擎口径 / 接线 / 叠层 / ext）+ 测试期默认关随机
- `patch_v8930_docs.py`（13KB）　— v89.30 文档补录：README §九 + 需求档案 + 设计规范 + 工作备忘（§43 表 + §51）+ 工作记忆
- `patch_v8930_wire.py`（7KB）　— v89.30 接线补丁：卷 39~44（36 篇）装载 + smoke 断言 + e2e VOL89 表
- `patch_v8931_docs.py`（12KB）　— v89.31 文档补录：README §八/§九 + 需求档案 + 设计规范 §45 + 工作备忘 §52 + 工作记忆
- `patch_v8931_engine.py`（19KB）　— v89.31 动作触发补丁（引擎 + UI + 挂点）
- `patch_v8931_tests.py`（11KB）　— v89.31 测试补丁：smoke（引擎 + 接线）· e2e（战事触发链 + 动作触发块）
- `patch_v8932_docs.py`（14KB）　— v89.32 文档补录：README §九（进度表/合计/可玩路径）+ 需求档案 + 设计规范 + 工作备忘 + 工作记忆
- `patch_v8932_wire.py`（6KB）　— v89.32 接线：铺量七批（卷 45~50 · 36 篇）
- `patch_v8933_docs.py`（13KB）　— v89.33 文档补录：README §九（进度表/合计/可玩路径/亮点/待办19）+ 需求档案 + 设计规范 + 工作备忘 + 工作记忆
- `patch_v8933_wire.py`（6KB）　— v89.33 接线：志异线样张三卷（vol-51 练功 / vol-52 灵异 / vol-53 志怪 · 18 篇）
- `patch_v8934_docs.py`（14KB）　— v89.34 文档补录：README §九 + 待办 + 需求档案 + 设计规范 + AI工作备忘 + 工作记忆。
- `patch_v8934_wire.py`（8KB）　— v89.34 接线补丁：铺量批（卷 54~59 · 36 篇 · 四线齐发）接入 index.html / smoke / e2e。
- `patch_v8935_docs.py`（11KB）　— v89.35 文档补录：README（进度表/合计/可玩路径/待办）+ 需求档案 + 设计规范 + 工作备忘 + 工作记忆
- `patch_v8935_wire.py`（6KB）　— v89.35 接线补丁：index.html 装载 / smoke 卷断言 / e2e VOL89 表（卷 60~65 · 36 篇）
- `patch_v8936_army.py`（20KB）　— v89.36：军粮口径改造（老板「维持军队无需耗粮食，相应招募提供耗粮3倍」）
- `patch_v8936_tests.py`（15KB）　— v89.36 测试补丁：smoke-test.js 旧军粮断言 → 新口径（维持退役 / 募兵×3 / 烽火接链）
- `patch_v8937_docs.py`（14KB）　— 文档补录：v89.36（军粮口径改造）+ v89.37（故事库铺量八批 卷 66~71）
- `patch_v8937_wire.py`（6KB）　— v89.37 接线：故事库卷 66~71（36 篇）入位后的四处接线
- `patch_v8938_docs.py`（10KB）　— v89.38 文档补录：README（进度表/合计/可玩路径/待办）+ 需求档案 + 设计规范 + 备忘
- `patch_v8938_wire.py`（6KB）　— v89.38 故事库接线：卷 72~77（35 篇 · 地理锚点收官批）
- `patch_v8939_docs.py`（12KB）　— v89.39 文档补录：README（进度表/合计/可玩路径/入口/待办）+ 需求档案 + 设计规范 + 备忘 + 记忆
- `patch_v8939_misc.py`（10KB）　— v89.39 总补丁
- `patch_v8940_docs.py`（6KB）　— v89.40 补丁 3/3：文档层（需求档案 / 设计规范 / 工作备忘 / 工作记忆）
- `patch_v8940_points_loyalty.py`（11KB）　— v89.40 补丁 1/3：代码层
- `patch_v8940_tests.py`（9KB）　— v89.40 补丁 2/3：测试层
- `patch_v8941_close.py`（12KB）　— v89.41 会话收尾补丁：
- `patch_v8942_docs.py`（13KB）　— v89.42 补丁 4/4：文档同步（五处）
- `patch_v8942_docs2.py`（2KB）　— v89.42 补丁 4b：项目地图 · 工具计数与截图数（精确锚点重试）
- `patch_v8942_map.py`（5KB）　— v89.42 补丁 1/2：map.js —— 野地贴图回归 + 逐格镜像变体
- `patch_v8942_tests.py`（5KB）　— v89.42 补丁 2/2：smoke-test.js —— v67 地形位图护栏改写为新不变量
- `patch_v8942_tex_mix.py`（3KB）　— v89.42 补丁 3：texVariant 换 32 位混合哈希
- `patch_v897.py`（18KB）
- `patch_v897_docs.py`（6KB）
- `patch_v897b.py`（1KB）　— v89.7 补丁修正 b：ui.js 君主面板「头像」行补 IIFE 收尾 `})() +`
- `patch_v8986_audit_cleanup.py`（4KB）　— v89.86 顺手修复 · audit 两告警（均由 v89.4x~8x 未提交改动引入，非本批新增）
- `patch_v8986_docs.py`（8KB）　— v89.86 · 文档同步：开发整改清单（状态）/ 试玩测评报告（banner）/ 需求档案 /
- `patch_v8986_docs2.py`（9KB）　— v89.86 · 文档同步（续）：设计规范 §98 / AI工作备忘 §106 / 门派系统规则 §十七
- `patch_v8986_docs3.py`（3KB）　— v89.86 · 备忘 §十一 登记新增出口（项目铁律：「新增出口必须登记」）
- `patch_v8986_e2e_add.py`（5KB）　— v89.86 · e2e 增量：整改清单关键 UI 触点（真实 DOM）
- `patch_v8986_e2e_fix.py`（8KB）　— v89.86 · e2e 存量失败修复（全部由 v89.4x~v89.85 未提交改动引入，与整改 21 条无关）
- `patch_v8986_e2e_fix2.py`（3KB）　— v89.86 · e2e 收尾两条（存量口径问题，非本次整改引入）
- `patch_v8986_e2e_fix3.py`（4KB）　— v89.86 · e2e 收尾：① P-06 战事触发块（阅读器元素须重查 —— 该用例里是首次创建）；
- `patch_v8986_p02_p15_p26.py`（7KB）　— v89.86 整改 · P-02 favicon + P-15 客栈空位引导 + P-26 新城裸城提示
- `patch_v8986_p03_p08.py`（8KB）　— v89.86 整改 · P-03 任务「前往」按钮 + P-08 随机任务可达性过滤
- `patch_v8986_p06.py`（8KB）　— v89.86 整改 · P-06 故事「稍后阅读」
- `patch_v8986_p06_tests.py`（10KB）　— v89.86 · P-06 测试同步：触发语义从「命中即开卷」→「入待阅 · 从待阅开卷」
- `patch_v8986_p07.py`（10KB）　— v89.86 整改 · P-07 黄金消耗出口：建造 / 科技队列的花金提速
- `patch_v8986_p12_p13.py`（7KB）　— v89.86 整改 · P0 显示缺陷：
- `patch_v8986_p15_fix.py`（2KB）　— v89.86 补 · P-15 引导链补上"官府压顶"分支（v68 规则：城内建筑 ≤ 官府等级）
- `patch_v8986_p17.py`（9KB）　— v89.86 整改 · P-17 离线推进上限
- `patch_v8986_p18.py`（15KB）　— v89.86 整改 · P-18 自动化预算闸门
- `patch_v8986_p1_texts.py`（13KB）　— v89.86 整改 · P1 文案与前置提示四项：
- `patch_v8986_p20.py`（10KB）　— v89.86 整改 · P-20 军务总览页
- `patch_v8986_p20_tests.py`（2KB）　— v89.86 · P-20 测试同步：军务总览（全境口径 + 五段结构）
- `patch_v8986_p21.py`（5KB）　— v89.86 整改 · P-21 门派任务连做（×10 / 一键做完）
- `patch_v8986_p23_train.py`（16KB）　— v89.86 整改 · P-23 兵力悬殊二次确认 + P-19 募兵上限归因 + P-05 人口占用说明
- `patch_v8986_p25.py`（7KB）　— v89.86 整改 · P0 竞态：P-25 行军抵达「军账守恒」
- `patch_v8986_questid_fix.py`（2KB）　— v89.86 顺手修复（真 bug · 存量数据）：随机任务 r07 / r09 的兵种 id 对不上
- `patch_v8986_sect_p1.py`（11KB）　— v89.86 · 门派 P1 · 六派被动加成实装（老板拍板；走既有消费链，不新增战斗公式）
- `patch_v8986_smoke.py`（17KB）　— v89.86 · smoke 增量：把整改清单 21 条 + 门派 P1 的**关键不变量**固化进回归网。
- `patch_v8986_smoke_fix2.py`（2KB）　— v89.86 · smoke 三处断言修复（以 .py 文件执行 —— heredoc 会改写反斜杠）
- `patch_v8986_smoke_stub.py`（2KB）　— v89.86 · smoke 环境：makeEl 补 querySelector/querySelectorAll（故事阅读器 sgRender 要读子元素）
- `patch_v8987_docs.py`（7KB）　— v89.87：文档同步（设计规范 §99 · 工作备忘 §107 · 需求档案 v89.87 段）
- `patch_v8987_e2e90.py`（4KB）　— v89.87：e2e §90 战场界面（真实 DOM：挂起→界面→指令→完成→自动→战果）
- `patch_v8987_p1.py`（13KB）　— v89.87 需求1：就地快购（组件 + 六接入点 + 种子开售/页签）—— SHOP_CATS 在 ui.js
- `patch_v8987_p3.py`（7KB）　— v89.87 需求3：战斗单目标攻击 + 30% 溢出溅射（老板拍板）
- `patch_v8987_p4a.py`（6KB）　— v89.87 需求4a：战斗引擎会话步进 API（机械重构，行为一致）
- `patch_v8987_p4b1.py`（12KB）　— v89.87 需求4b：战斗观战会话 —— battle.js 核心（挂起/推进/落账重放/恢复）
- `patch_v8987_p4b2.py`（5KB）　— v89.87 需求4b2：观战接入点 —— 设置项 / 初始 state / 主循环 / boot / 测试引导
- `patch_v8987_p4c1.py`（2KB）　— v89.87 需求4c-1：快照数据补全（towers / maxRounds / gapLast）
- `patch_v8987_p4c2.py`（15KB）　— v89.87 需求4c-2：战场观战界面（ui.js）——渲染 / 指令 / 动画 / 倒计时 / 结束面板
- `patch_v8987_p4c3.py`（5KB）　— v89.87 需求4c-3：接线（closeModal 拆装 / 军务征战中段 / main 动作分发 / onMarchArrive）
- `patch_v8987_p4c4.py`（4KB）　— v89.87 需求4c-4：战场界面 CSS + BUILD 版本升级（8985→8987）
- `patch_v8987_p4c5.py`（3KB）　— v89.87 需求4c-5：按项目 UI 规约修正 —— 色走变量 / 图标容器含 img / 下拉框实名在册
- `patch_v8987_p4c6.py`（3KB）　— v89.87 需求4c-6：audit 清零 —— data-side→data-bside（避保留名）/ pendingCount 接线
- `patch_v8987_p5_core.py`（19KB）　— v89.87 需求2：派兵统一走行军通道（data/battle/domain 核心）
- `patch_v8987_p5_core2.py`（10KB）　— v89.87 需求2：domain.js 三函数（承 p5_core：data/battle 已落盘）
- `patch_v8987_p5d.py`（8KB）　— v89.87 需求2：UI 接线（调兵/驻守面板加将领 · 采集改 dispatch）+ 白名单
- `patch_v8987_p5e1.py`（4KB）　— v89.87 需求2：smoke 三处断言更新（模态数 / 驻军走行军 / 上限断言补抵达）
- `patch_v8987_p5e2.py`（5KB）　— v89.87 需求2 收尾：出征面板过滤调派类（panel:false）+ e2e 采集段适配
- `patch_v8987_smoke87.py`（8KB）　— v89.87：smoke §87 固化断言（四需求）—— 插在结果输出前
- `patch_v8988_docs.py`（8KB）　— v89.88 文档同步：设计规范 §100 / 工作备忘 §108 / 需求档案 v89.88。
- `patch_v8988_e2e.py`（5KB）　— v89.88：e2e 增量 —— §91 大地图悬浮浮层（真实 DOM）。
- `patch_v8988_fort.py`（11KB）　— v89.88（老板需求 1~3）：野外城池（据点）改造 —— 等级分布 / 守军×10 / 满配。
- `patch_v8988_hover.py`（6KB）　— v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」。
- `patch_v8988_loot.py`（2KB）　— v89.88（老板需求 3「资源满配」）：battle.js 两处 ——
- `patch_v8988_smoke.py`（17KB）　— v89.88：smoke-test.js 更新 + 新增 §88 断言块。
- `patch_v8988_ui.py`（5KB）　— v89.88（老板需求 5）：界面打磨（审计先行 —— 只补真缺口）。
- `patch_v8989_a2.py`（9KB）
- `patch_v8989_a3a4.py`（9KB）
- `patch_v8989_b1d4.py`（10KB）
- `patch_v8989_c3.py`（8KB）
- `patch_v8989_c4e3.py`（10KB）
- `patch_v8989_docs.py`（9KB）　— v89.89 文档同步：设计规范 §101 · 工作备忘 §109 · 需求档案 v89.89 段
- `patch_v8989_e2e92.py`（7KB）　— v89.89 · e2e §92 段（真实 DOM：A2 归来报告 / B1 一键全领 / C4 故事集 / D4 战报筛选收藏 / E3 三段条）
- `patch_v8989_smoke89.py`（10KB）
- `patch_v898_code.py`（27KB）
- `patch_v898_tests.py`（13KB）
- `patch_v899.py`（8KB）　— patch_v899.py —— v89.9 接线：卷 02 装载 + 空态断言动态化 + e2e 新锚点用例
- `patch_v8991_docs.py`（4KB）　— ── ① 需求档案 v89.91 ──
- `patch_v8992_strat.py`（17KB）　— patch_v8992_strat.py — 由 play_gold_600x.js 生成 play_strat_600x.js（v89.92 多策略驾驶舱）
- `patch_v8994_a_data.py`（5KB）　— v89.94（B2 战斗三件套）Patch A —— 数据层：DATA.SIEGE / DATA.OPS / DATA.REPLAY。
- `patch_v8994_b_domain.py`（7KB）　— v89.94 Patch B —— js/domain.js：围攻守备值核心 + 战法唯一出口。
- `patch_v8994_c1_battle.py`（14KB）　— v89.94 Patch C1 —— js/battle.js：
- `patch_v8994_c2_battle.py`（8KB）　— v89.94 Patch C2 —— js/battle.js：回放关键帧 / 以少胜多 / 行军通道带 ops。
- `patch_v8994_d_ui.py`（19KB）　— v89.94 Patch D —— js/ui.js：
- `patch_v8994_e2_main.py`（6KB）　— v89.94 Patch E（补）—— js/main.js 四处改动（上一版脚本的写盘块被误删）。
- `patch_v8994_e_main.py`（8KB）　— v89.94 Patch E —— js/main.js：战法 chip / 撤退 / 回放控制 三个动作 + 确认闸改保守口径。
- `patch_v8994_g_smoke.py`（17KB）　— v89.94 Patch G —— smoke-test.js 第 97 节：B2 战斗三件套的验收断言。
- `patch_v8995_a_market.py`（10KB）　— v89.95 Patch A —— 经济：黄金兑换比递减（物多价贱）+ 通商券真通道。
- `patch_v8995_b2_speed.py`（5KB）　— v89.95 Patch B2 —— 速度受控成长：每 5 级 +1（自然成长）+ 自由点投放上限。
- `patch_v8995_b2b_speed.py`（3KB）　— v89.95 Patch B2b —— genAttrs（domain.js）与 addFreePoint（state.js）分开打。
- `patch_v8995_b_tactic.py`（8KB）　— v89.95 Patch B —— 战斗核心：取消溅射（一击一目标）+ 战场纵深/推进上限 + 速度受控成长。
- `patch_v8995_h2_rename.py`（2KB）　— v89.95 Patch H2 —— 稀缺资源改名：虎符 → **节钺**（虎符之名已被商城符类占用，实测撞名）。
- `patch_v8995_h_hufu.py`（12KB）　— v89.95 Patch H —— A1 虎符：黄金买不到的稀缺资源（发展限制器）。
- `patch_v8995_t2_smoke.py`（9KB）　— v89.95 Patch T2 —— 末条断言对齐 + 新增第 98 节（经济：虎符 / 折价 / 通商券）。
- `patch_v8995_t_smoke.py`（8KB）　— v89.95 Patch T —— smoke 断言对齐（去溅射 / 纵深 / 速度受控 / 伤害系数）。
- `patch_v8996_a_src.py`（19KB）　— patch_v8996_a_src.py — v89.96 伤害链源头标定（撤末端系数；幂等可复跑）
- `patch_v8996_b_sync.py`（10KB）　— patch_v8996_b_sync.py — v89.96 同步（UI 文案 / battle 注释 / smoke 断言；幂等可复跑）
- `patch_v8996_c_final.py`（6KB）　— patch_v8996_c_final.py — v89.96 定稿批（幂等可复跑）
- `patch_v8996_d_assert.py`（6KB）　— patch_v8996_d_assert.py — v89.96 断言同步（第三批；幂等可复跑）
- `patch_v8996_e_rounds.py`（3KB）　— patch_v8996_e_rounds.py — v89.96 回合上限断言定稿（幂等）
- `patch_v8998_rush.py`（33KB）
- `patch_v8999_a_pop.py`（15KB）　— v89.99-A 主补丁：人口经济四件套（幂等；锚点缺失即报错退出）
- `patch_v8999_b_smoke.py`（9KB）　— v89.99-B 冒烟第 99 节：人口经济四件套的验收断言（幂等）
- `patch_v8999_c_fix.py`（2KB）　— v89.99-C 三处登记修复（幂等）：
- `patch_v8999_d_rush.py`（15KB）　— v89.99-D 推演脑：阶段自适应 + 人口银行 + 增民令/税制策略（幂等）
- `patch_v8999_e_tune.py`（3KB）　— v89.99-E 脑校准（幂等）：保留线回落 / 增民令绝对门槛 / 税制阈值 / 放人节流
- `patch_v8999_f_tune2.py`（1KB）　— v89.99-F 脑校准（幂等）：体力药剂门槛 —— 围攻的燃料优先于金（条件驱动）
- `patch_v8999_g_tune3.py`（2KB）　— v89.99-G 脑校准（幂等）：体力药剂改"备弹制度" —— 围攻波次上限的最后一根钉子
- `patch_v8999_h_tune4.py`（3KB）　— v89.99-H 脑校准（幂等）：① 收割队随军力伸缩（否则门槛永远够不着）② 放人全城扫描
- `patch_v899_docs.py`（10KB）　— patch_v899_docs.py —— v89.9 文档补录：README 进度 / 项目地图 / 需求档案 / 设计规范 / 工作备忘
- `patch_v899b.py`（4KB）　— patch_v899b.py —— v89.9 接线修正：建筑逸闻块脱三元（无功能建筑漏入口）
- `patch_v89_1_css.py`（6KB）　— v89.1 CSS：index.html 追加 .sxf-* 剧本视觉化样式与两段动效（插入 </style> 前）。探针幂等。
- `patch_v89_1_data.py`（3KB）　— v89.1 数据：SCENE_FLOW 每活动加幕景水印 art、每幕加幕题 s（插入式；原文案零改动）。探针幂等。
- `patch_v89_1_docs.py`（7KB）　— v89.1 文档：设计规范 §31 · 备忘 §33 · 需求档案 v89.1 · 规划补记 · 设计文档 v1.3。探针幂等。
- `patch_v89_1_fix.py`（3KB）　— v89.1 修补：① e2e 两处「精力严格相等」断言改容差版（浮点再生脆弱点）
- `patch_v89_1_tests.py`（7KB）　— v89.1 测试：smoke §75（幕景/幕题/徽章/对白/样式）+ e2e 剧本视觉断言（横幅/时间线/结算卡）。探针幂等。
- `patch_v89_1_ui.py`（9KB）　— v89.1 UI：sceneFxHTML 视觉升级（幕景横幅 / 行程时间线 / 幕题条 / 对白高亮 / 倾向徽章 / 结算卡）。
- `patch_v89_2_css.py`（4KB）　— v89.2 CSS：场景画布 / 热点点选 / 时机条 / 选项图标 + sxfPing 脉冲。插入 </style> 前。探针幂等。
- `patch_v89_2_data.py`（9KB）　— v89.2 数据：① 12 活动各配一幅场景画（scene 字段）② 12 处关键幕改为「时机判定」（t2 + 三档结局）。
- `patch_v89_2_docs.py`（7KB）　— v89.2 文档：设计规范 §32 · 备忘 §34 · 需求档案 v89.2 · 规划二十·补记 · 设计文档 v1.4。探针幂等。
- `patch_v89_2_fix_trig.py`（2KB）　— v89.2 修复：古阵光圈的刻度用**预置单位圆表**，不调用 Math.sin/cos
- `patch_v89_2_scene.py`（29KB）　— v89.2 场景插画（map.js）：12 活动各一幅程序化风景画 + GAME.map.paintScene 出口。
- `patch_v89_2_tests.py`（11KB）　— v89.2 测试：① sxfTimingStop 防误触守卫 ② smoke §76（场景/时机/交互） ③ e2e 三处流程改「停手」+ 新断言。探针幂等。
- `patch_v89_2_ui.py`（15KB）　— v89.2 UI：sceneFxHTML 场景化改造 —— 场景画布 + 热点点选（spot）+ 时机条（timing）+ 选项图标。
- `patch_v89_3_copy.py`（10KB）　— v89.3 文案统一 · 灵物志 —— js/data.js
- `patch_v89_3_css.py`（1KB）　— v89.3 样式 —— index.html：.sxf-hero-alias（雅名金色小字）
- `patch_v89_3_docs.py`（7KB）　— v89.3 文档补丁 —— 五份文档追加（设计规范 §33 / 备忘 §35 / 规划二十一 / 档案 v89.3 / 设计文档 v1.5）
- `patch_v89_3_tests.py`（6KB）　— v89.3 测试 —— smoke-test.js §77 + e2e-test.js 横幅断言
- `patch_v89_3_ui.py`（1KB）　— v89.3 横幅接线 —— js/ui.js：雅名（alias）+ 门类章（cat 兜底 kind）
- `patch_v89_4_data.py`（2KB）　— v89.4 数据 —— js/data.js：DATA.JH_SPREAD（野地生态参数）
- `patch_v89_4_docs.py`（7KB）　— v89.4 文档补丁 —— 五份文档追加（设计规范 §34 / 备忘 §36 / 规划二十二 / 档案 v89.4 / 设计文档 v1.6）
- `patch_v89_4_state.py`（4KB）　— v89.4 引擎 —— js/state.js：
- `patch_v89_4_tests.py`（15KB）　— v89.4 测试 —— smoke（找格升级 + §78）+ e2e（找格升级 + 荒僻/有事格新块）
- `patch_v89_4_ui.py`（3KB）　— v89.4 UI —— js/ui.js：jianghuHTML 按 (x,y) 取分布 + 荒僻空态 + 等级收益行
- `patch_v89_5_data.py`（1KB）　— v89.5 数据补丁：DATA.JH_MARK（灵机之地阈值）
- `patch_v89_5_docs.py`（7KB）　— v89.5 文档补丁 —— 五份文档追加（设计规范 §35 / 备忘 §37 / 规划二十三 / 档案 v89.5 / 设计文档 v1.7）
- `patch_v89_5_map.py`（3KB）　— v89.5 地图补丁：drawJhPennant（江湖旗画笔）+ 野地信息层接线
- `patch_v89_5_state.py`（1KB）　— v89.5 引擎补丁：GAME.jianghuSpotInfo（灵机之地判定，唯一出口）
- `patch_v89_5_tests.py`（10KB）　— v89.5 测试补丁：smoke §79（灵机语义/阈值/记录式渲染/点选）+ e2e 19b（悬旗接线）
- `patch_v89_5_ui.py`（1KB）　— v89.5 UI 补丁：mapPickText 补江湖事后缀（有事报数/灵机加标/荒僻明示）
- `patch_v89_6_css.py`（4KB）　— v89.6 CSS 补丁：--wonder 语义色（四主题）+ 奇遇/见闻录样式
- `patch_v89_6_data.py`（21KB）　— v89.6 数据补丁：DATA.WONDER（奇遇配置）+ DATA.WONDERS（24 条奇遇剧本）
- `patch_v89_6_docs.py`（9KB）　— v89.6 文档补丁 —— 五份文档追加（设计规范 §36 / 备忘 §38 / 规划二十四 / 档案 v89.6 / 设计文档 v1.8）
- `patch_v89_6_flakefix.py`（5KB）　— v89.6 顺手修存量 flake：e2e「达标后无需手动刷新」（门禁环境 2/3 假红，两处合修）
- `patch_v89_6_main.py`（1KB）　— v89.6 main.js 补丁：do-wonder / open-journal / journal-go 接线
- `patch_v89_6_map.py`（3KB）　— v89.6 地图补丁：drawWonderStar（奇缘星）+ 渲染接线
- `patch_v89_6_state.py`（18KB）　— v89.6 引擎补丁：奇遇点位生成 / 线索 / 探奇三段 + 场景机共用（sceneBegin）
- `patch_v89_6_tests.py`（16KB）　— v89.6 测试补丁：smoke §80（奇遇册/点位/线索/探奇/图鉴/渲染）+ e2e 19c（全流程）
- `patch_v89_6_ui.py`（10KB）　— v89.6 UI 补丁：奇遇横幅/结算线索行/野地探奇入口/见闻录面板/探察提示
- `patch_v89_data.py`（17KB）　— v89 数据层：全屏江湖场景剧本 DATA.SCENE_FLOW（12 活动 · 对话/事件导向 · 专属退出）。探针幂等。
- `patch_v89_docs.py`（7KB）　— v89 文档：设计规范 §30 · 备忘 §32 · 需求档案 v89 · 规划补记 · 设计文档 v1.2。探针幂等。
- `patch_v89_e2e.py`（10KB）　— v89 e2e（e2e-test.js）：v88.1/v88 段剧本化改造 + v89 新段（君主专属 + 全屏交互）。探针幂等。
- `patch_v89_flow.py`（13KB）　— v89 流程引擎（state.js）：jianghuDo 拆 Check/Spend/Roll + sceneStart/Pick/Escape + mods 接线。探针幂等。
- `patch_v89_lord.py`（15KB）　— v89 君主专属收口：修炼线（装备/蕴养/游历）唯一闸门 GAME.canCultivate + 老档迁移。探针幂等。
- `patch_v89_main.py`（2KB）　— v89 事件（main.js）：sxf-choice / sxf-escape / sxf-exit 分发 + doScene 包装。探针幂等。
- `patch_v89_tests.py`（10KB）　— v89 测试（smoke-test.js）：§73 君主化（generals[0] -> 君主） + §74 新段（君主闸门 + 全屏剧本）。探针幂等。
- `patch_v89_ui.py`（9KB）　— v89 全屏场景 UI（ui.js）：活动按钮 → 全屏剧本 → 专属退出结算屏。探针幂等。
- `v26-j.py`（14KB）　— v26 批九：smoke 第 39 节 —— v26 五项需求的防回退断言
- `v89116_sec96.js`（21KB）
- `v89117_sec97.js`（18KB）
- `v89118_sec98.js`（9KB）
- `v89119_sec100.js`（10KB）
- `v89120_sec101.js`（9KB）

## play/（未归类）

待归类：请确认用途后归档。

- `lifecycle_v89121.js`（33KB）

## playtest/（未归类）

待归类：请确认用途后归档。

- `analyze_600.py`（12KB）　— analyze_600.py — 600× 全量推演数据分析器。
- `analyze_gold.py`（9KB）　— v89.91 黄金流 vs 基线对照分析器
- `analyze_rush.js`（6KB）　— v89.98d：A2 三跑综合提取 → digest_rush.md
- `analyze_rush_b.js`（4KB）　— v89.98b：A1→A4 演进对照 + A4 里程碑时间线
- `analyze_rush_d.js`（6KB）　— v89.99 三跑对照分析：rushD_{1x,120x,600x} + A2→A4 演进（1×）
- `analyze_rush_e.js`（7KB）　— v89.99 定稿三跑对照：rushE_{1x,120x,600x} + A2→A4→E 演进 + 围攻明细归因
- `analyze_rush_f.js`（7KB）　— v89.99 定稿三跑对照：rushF_{1x,120x,600x} + A2→A4→E 演进 + 围攻明细归因
- `analyze_rush_g.js`（7KB）　— v89.99 定稿三跑对照：rushG_{1x,120x,600x} + A2→A4→E 演进 + 围攻明细归因
- `analyze_strat.py`（7KB）　— analyze_strat.py — v89.92 四模式对照分析（gold / buff / equip / all）
- `analyze_v89100.js`（6KB）　— v89.100 三跑对照分析器：econ（纯经济）/ loot（战利品变现）/ rushG（军事基准）
- `analyze_v89107_play30h.js`（6KB）
- `batch_v89100.js`（4KB）　— v89.100 批量对照：4 seed × 3 模式（rush / loot / lootx）
- `batch_v89100b.js`（4KB）　— v89.100 批量对照：4 seed × 3 模式（rush / loot / lootx）
- `gold_section.js`（15KB）
- `play_600x.js`（40KB）
- `play_farm2_600x.js`（41KB）　— FARM2
- `play_gold_600x.js`（57KB）　— GOLD v1
- `play_rush_1x.js`（107KB）　— RUSH v1 (v89.98) —— 1× 300h 全系统极限流
- `play_strat_600x.js`（73KB）　— STRAT v1 (v89.92)
- `play_v89118.js`（84KB）　— v89.118 试玩评测驾驶舱

## probe/（探针（几何 / 界面 / 存档））

jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。

- `dbg8986_bag.js`（4KB）　— dbg8986_bag.js —— 调试 v89.51 背包分组断言缺哪个词
- `dbg8986_inn.js`（4KB）　— dbg8986_inn.js —— P-15 调试：打印客栈面板渲染
- `dbg8986_smoke2.js`（5KB）　— dbg8986_smoke2.js —— 调试 smoke 新增断言里 P-06 / P-08 的失败原因
- `dbg8987_ctr.js`（1KB）　— debug: 反击场景日志
- `dbg8987_p23.js`（2KB）　— v89.87 调试：复现 P-23 断言，打印各中间值
- `dbg8987_wg.js`（2KB）　— debug: 驻军走行军的失败点
- `dbg8988_rounds.js`（2KB）
- `dbg8988_splash.js`（2KB）
- `dbg8989_pop3.js`（1KB）
- `dbg8989_weather.js`（1KB）
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
- `probe_v89101_explore.js`（16KB）
- `probe_v89101b_explore.js`（13KB）
- `probe_v89101c_explore.js`（10KB）
- `probe_v89102_sandbox.js`（6KB）
- `probe_v89102b_sandbox.js`（8KB）
- `probe_v89102c_rankcap.js`（10KB）
- `probe_v89103_contact.js`（7KB）
- `probe_v89103b_fort.js`（6KB）
- `probe_v89103c_cargo.js`（8KB）
- `probe_v89104a_engine.js`（8KB）
- `probe_v89107_100cities.js`（6KB）
- `probe_v89107_doc.js`（3KB）　— 探针：为什么"真打一场"没出战报、"真拨时刻"没出烽火 —— 打印出口返回值
- `probe_v89109_fortres.js`（4KB）
- `probe_v89109_inv.js`（2KB）
- `probe_v89109_sortie.js`（2KB）
- `probe_v89110_caps.js`（3KB）　— v89.110 探针：两条上限的真实数值取证
- `probe_v89111_inv.js`（4KB）　— v89.111 探针：来袭新节奏（每日 9 时一场 · 目标轮转 · 提前 4 时只报一次 · 离线补算）
- `probe_v89112_seg.js`（6KB）
- `probe_v89114_load.js`（7KB）
- `probe_v89114b_haul.js`（5KB）
- `probe_v89116_defsb.js`（7KB）
- `probe_v89116_gap.js`（4KB）
- `probe_v89116_stats.js`（7KB）
- `probe_v89117_flicker.js`（8KB）
- `probe_v89118_elephant.js`（5KB）
- `probe_v89118_verify.js`（5KB）
- `probe_v89119_arena.js`（4KB）
- `probe_v89119_arena2.js`（3KB）　— probe_v89119_arena2.js — 选靶子（第二版：L5~L7 档 + 多倍兵力）
- `probe_v89119_counter.js`（3KB）
- `probe_v89120_report_nav.js`（14KB）
- `probe_v89120b_sim_behavior.js`（10KB）
- `probe_v89121a_flag_loc.py`（3KB）　— probe_v89121a · 族旗在图标上的位置与占比（回答"图标前边为什么有面旗"）
- `probe_v89121b_flag_diff.py`（2KB）　— probe_v89121b · 族旗位置 = 源图（未挂旗）与成品图（assets/icons/ui）的差异像素
- `probe_v89121c_noshop_refs.py`（1KB）　— v89121 清点辅助：noShop 物品的"额外引用"审查（找真断链嫌疑）
- `probe_v89121d_reward_scan.py`（2KB）　— v89121：产出渠道全扫描 —— 找出"任务/逸闻/奇遇/游历"等表里给了哪些物品 id，
- `probe_v89122_invasion_toggle.js`（3KB）
- `probe_v89125_build_time_migration.js`（4KB）　— v89.125 探针：建筑时间表口径（城墙哨兵 0）与移民令新语义
- `probe_v89126_labor_calib.js`（5KB）　— v89.126 探针：劳作占用校准与守卫真调（需求 2）
- `probe_v89127_migrate_tip.js`（3KB）　— v89.127 探针：① U.fmt 千级新格式（k 退役）② 城墙入城迁移不再静默
- `probe_v89128a_time_audit.js`（4KB）　— v89.128 需求 1 探针：时间口径总表 —— 以 1 倍速为基准，枚举全部时间数值
- `probe_v89129_audit.js`（6KB）
- `probe_v89131_energy_domain.js`（5KB）　— v89.131 探针：精力公式设计的数值域采样
- `probe_v89131_jieyue.js`（4KB）　— v89.131 探针：节钺设定全表（老板「只有攻打名城才给的那什么节X，列出其设定」）
- `probe_v89131_pane_geom.js`（3KB）　— v89.131 探针：将领档案面板几何量测（真浏览器）
- `probe_v8942_map_shot.js`（6KB）　— _shot_map.js — 地图视图截图探针（before/after 通用 · v89.42）
- `probe_v8942_tex.js`（4KB）　— v89.41 行为探针：texVariant 确定性与分布 + 地图渲染回归（不抛错）
- `probe_v8986_p02_p15_p26.js`（7KB）　— probe_v8986_p02_p15_p26.js —— 整改 P-02 / P-15 / P-26 探针
- `probe_v8986_p03_p08.js`（7KB）　— probe_v8986_p03_p08.js —— 整改 P-03（前往）/ P-08（可达性过滤）探针
- `probe_v8986_p06.js`（6KB）　— probe_v8986_p06.js —— 整改 P-06 探针：故事待阅
- `probe_v8986_p07.js`（8KB）　— probe_v8986_p07.js —— 整改 P-07 探针：建造 / 科技队列花金提速
- `probe_v8986_p12_p13.js`（7KB）　— probe_v8986_p12_p13.js —— 整改 P-12/P-13 渲染探针
- `probe_v8986_p17.js`（6KB）　— probe_v8986_p17.js —— 整改 P-17 探针：离线推进上限 + 五折折算
- `probe_v8986_p18.js`（8KB）　— probe_v8986_p18.js —— 整改 P-18 探针：自动化预算闸门
- `probe_v8986_p1_texts.js`（11KB）　— probe_v8986_p1_texts.js —— 整改 P-24 / P-11 / P-04 / P-16 渲染探针
- `probe_v8986_p20.js`（6KB）　— probe_v8986_p20.js —— 整改 P-20 探针：军务总览五段
- `probe_v8986_p21.js`（6KB）　— probe_v8986_p21.js —— 整改 P-21 探针：门派任务连做
- `probe_v8986_p23_train.js`（9KB）　— probe_v8986_p23_train.js —— 整改 P-23 / P-19 / P-05 探针
- `probe_v8986_p25.js`（11KB）　— probe_v8986_p25.js —— 整改 P-25 复现探针：600× 行军抵达的"军账守恒"
- `probe_v8986_sect_p1.js`（8KB）　— probe_v8986_sect_p1.js —— 门派 P1 被动加成探针
- `probe_v8987_battle.js`（11KB）　— v89.87 探针：需求3（单目标+30%溅射/反击不限次） + 需求4（观战挂起/步进/重放/落账）
- `probe_v8987_p12.js`（8KB）　— v89.87 探针：需求1（快购）+ 需求2（派兵统一走行军）
- `probe_v8988_fort.js`（10KB）　— v89.88 探针：需求1~3（野外城池：等级分布 / 守军×10 / 满配）
- `probe_v8989_a2.js`（4KB）
- `probe_v8989_bd.js`（9KB）
- `probe_v8989_c3.js`（6KB）
- `probe_v8992_equip_buff.js`（12KB）　— SIM 时钟（与推演驾驶舱同口径：全探针内可手动推进）
- `probe_v8993_behavior.js`（8KB）
- `probe_v8993_facts.js`（7KB）　— SIM 时钟
- `probe_v8994_battle.js`（25KB）
- `probe_v8996_dmgchain.js`（9KB）
- `probe_v8997_exploits.js`（10KB）
- `probe_v8997b_exploits.js`（10KB）
- `probe_v8997c_exploits.js`（7KB）
- `probe_v8999_train_cap.js`（1KB）　— 复现"募兵上限"之谜：用 rushF_1x 终局存档直接问游戏

## show/（展示与校准）

给老板看的对照图 / 曲线校准 / 素材巡视。

- `compare34.js`（9KB）　— v34 风格对比：同一批元素，四种画风 —— 现状(西方奇幻金属) / 中国色木刻 / MingCute / IconPark
- `make_v89121_flag_matrix.py`（3KB）　— v89121 · 七族旗色对照图（回答"图标上的旗是什么"）
- `review_guide.py`（4KB）　— v89.42 定稿验收图：改前/改后 + 2x 放大 + 7 块贴图 + 中文说明，合成单图。
- `review_guide_b.py`（5KB）　— v89.42b 验收指南：v89.42a(推翻) vs v89.42b(重做) + 2x 放大 + 7 块新贴图，合成单图。
- `scan6.js`（4KB）
- `shot_compare.py`（7KB）　— v89.42 前后对比：逐格"两翼"采样（避开等级角标/名称条）→ 报告 + 拼图。
- `shot_v89102_sandbox.js`（7KB）
- `shot_v89102b_rankcap.js`（4KB）
- `shot_v89103.js`（9KB）
- `shot_v89103b_field.js`（8KB）
- `shot_v89104_views.js`（5KB）
- `shot_v89105_ui.js`（4KB）
- `shot_v89106_bldg.js`（6KB）
- `shot_v89107_beacon.js`（6KB）
- `shot_v89107_doc.js`（7KB）
- `shot_v89108_cap_inn.js`（7KB）
- `shot_v89109_def.js`（7KB）
- `shot_v89110_danger.js`（10KB）
- `shot_v89111_inv.js`（6KB）
- `shot_v89112_modals.js`（6KB）
- `shot_v89113_mayor_inv.js`（7KB）
- `shot_v89114.js`（12KB）
- `shot_v89115.js`（9KB）
- `shot_v89116.js`（14KB）
- `shot_v89117.js`（14KB）
- `shot_v89118.js`（6KB）
- `shot_v89119.js`（10KB）
- `shot_v89120.js`（13KB）
- `shot_v89121_shop.js`（3KB）
- `shot_v89122_invasion.js`（4KB）
- `shot_v89123_rate.js`（4KB）
- `shot_v89124_pop.js`（4KB）
- `shot_v89125_migration.js`（4KB）
- `shot_v89126_three.js`（8KB）
- `shot_v89128_final.js`（3KB）　— v89.128 实机图：① 自动化面板（新增自动采集/收获）② 营造总览（新时长：官府 11→12 = 18h）
- `shot_v89128_leftbar.js`（4KB）　— v89.128 需求 7/8 实机图：左栏统计（人口行/按钮统一/野地行/人口道具弹窗）+ 对齐复验
- `shot_v89128_wall.js`（4KB）　— v89.128 需求 6 实机图：城墙环城结构（未建不画 / 修上画环 / 点环城开面板）
- `shot_v89129_three.js`（7KB）　— v89.129 实机图（三个场景）：
- `shot_v89131_pane.js`（9KB）　— v89.131 实机脚本：将领档案版面（自带判定）+ 截图
- `tile_show.js`（3KB）　— v35-f：批量拼图（可复用）—— 传 id:中文列表，输出总览图

---

**跑测试**：`node audit.js` · `node smoke-test.js` · `NODE_PATH='…\node\workspace\node_modules' node e2e-test.js`

**跑工具**（路径含子目录）：`node .workbuddy/tools/gen/gen_bitmaps.js`（.js 用 node、.py 用 python）。
