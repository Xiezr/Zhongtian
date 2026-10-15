# v89.237 assets 旧产物清理（兵种素材批）

> 时间：2026-10-07 17:2x~17:4x · 性质：**素材清理轮**（产品行为零变化 · 不升 GAME.VERSION）
> 老板原话：「E:\Deepseekdb\assets，旧产物去除」

---

## 一、判定：assets 全量三态扫描（清理前 170 文件）

| # | 对象 | 数量 | 时间线 | 引用面 | 判定 |
|---|---|---|---|---|---|
| 1 | `icons/raw/atlas_A~D_src.png` | 4 | 16:39 更新 | wasteland_batches.json 引用 + smoke 断言「可重新切图」 | **在用 → 保留** |
| 2 | `icons/ui/ai_*.png` | 99 | 13:39~16:41（14 新 + 28 改） | `bitmaps.js` 登记（双向差 0 · 生成器重跑零差异） | **在用 → 保留** |
| 3 | `icons/ui/_gold_backup/` | 16 | 13:39（恢复） | `build_atlas_src.py` 管线源 + smoke 铁断言「v89.106 起必须活着」 | **在用 → 保留**（见缺口） |
| 4 | `icons/兵种/` | 13 | 09:46~15:45 入 · 16:39 产出 14/14 成品 | **零引用**（代码/工具/测试/文档全零） | **已消费素材 → 清理** ✅ |
| 5 | `icons/英雄及头像/` | 38 | 17:20 入 · 17:34♰ 处理中 | 处理链进行中（pool_v2 产出） | **新素材 → 保留** |

♰ 清点后追加观察：17:34:57~17:35:13 出现 `assets/portraits/pool_v2/`（38 webp + tags.json），
与本批 38 张源图一一对应 —— 「英雄及头像」正由贴图批/头像批处理链消费中，本批全程未触碰。

## 二、清理执行（兵种素材批）

**判据链（五证）**：
1. **14/14 成品在册**：ui/ 的 14 张新兵种图 16:39:10~16:41 全产出（banche/fujiche/…/taitan）；
2. **编号全覆盖**：13 个源文件覆盖编号 1~14（"9左上 14左下"复合文件含 2 号），与老板 v89.229 兵种清单序号一一对应
   （"11 电磁盾卫"=dianci、"13 轰炸机"=wuren）；
3. **形体验证**：`11 电磁盾卫.jpeg` 主体 bbox 121×117（比 1.03）↔ `ai_dianci.png` 109×104（比 1.05）——
   宽高比吻合（±2%）；
4. **零引用**：全仓（js/smoke/e2e/tools/docs）扫描 `兵种/` 路径 = 0 命中；
5. **时间线闭合**：15:45 最后素材补入 → 16:39 全产出 → 17:2x 清点（近 10 分钟无写入）。

**执行**：
- 备份：`.workbuddy/backup/v89237-素材/兵种/`（13 文件 · 39MB · **md5 逐文件守恒核对 ✓**）
- 删除：`rm -rv assets/icons/兵种` → 删后验证：目录已清 · raw/ui/英雄及头像 三目录完好
- 素材真身：13 张扩展名 .jpeg 实为 **PNG 格式**（生成工具导出命名）——备份保留原样

## 三、连带维护

| 项 | 动作 |
|---|---|
| `docs/项目地图.md` | 素材章节更新：`icons/兵种` → `icons/英雄及头像`（新素材工作区）；体积 `~97MB` → `~247MB`（两处） |
| `.gitignore` | 原料区新增 `assets/icons/英雄及头像/`（38 个 / 约 187MB · 防误进版本库）；合计句 82MB → 269MB |
| 运行期资产复核 | `bitmaps.js` 登记 ↔ 磁盘双向差 **0/0**；生成器重跑 **零差异** |

## 四、诚实缺口 / 待老板定夺

1. **`_gold_backup/`（16 张"金色版"原图）**：名称带 gold、内容为旧配色时代原图，**易被误认为旧产物**；
   实为"素材管线原图来源与回退底片"（smoke 铁断言 `v89.106 起必须活着`）。**本批未动** ——
   如需退役，须走"退役三清"（断言 + `build_atlas_src.py`/`split_atlas.py`/`wasteland_prompts.py` 引用一起改），请明示。
   **→ 17:4x 已移出素材区并完成三清收口：见 §六。**
2. **本批对"旧产物"的认定**：按"已消费 + 零引用 + 旧批次"三判据锁定「兵种/」。
   如老板指的是其他对象，请指出 —— 其余各目录定性已列于上表（全在用）。
3. `assets/portraits/pool_v2/`（46 个新文件）与 `_hero_*` 检查图属**并行处理链**产出，本批未触碰、未评估。

## 五、复现与还原

```bash
# 校验备份完整性（13 文件·md5 全同）
cd "E:/Deepseekdb/.workbuddy/backup/v89237-素材/兵种" && md5sum *
# 还原（如需）
cp -r "E:/Deepseekdb/.workbuddy/backup/v89237-素材/兵种" "E:/Deepseekdb/assets/icons/"
# 运行期资产复核（双向差 0）
node .workbuddy/tools/gen/gen_bitmaps.js && git diff --stat -- js/bitmaps.js
```

---

## 六、17:4x 承接：城池四图 + _gold_backup 移出处置（素材清理收口）

**事实**（回收站 $I 元数据 · 已本地化时区）：`ai_city_{capital,jun,zhou,county}.png` **17:40:45** 移出；`ui/_gold_backup/`（16 张）**17:41:06** 移出 —— 均入**回收站（可还原）**。

**老板口径（逐字 · 17:4x）**：

> 无用之物给我删，需要UI，贴图我会重新制作。

> 我直说，城内建筑，兵种的UI我改好了，英雄头像正在搞，别的都考虑重新制作。

**处置（本批执行 · 全部实测）**：

| # | 面 | 动作 | 证据 |
|---|---|---|---|
| ① | smoke | 三处改「清理期 · 存在/在位即校验」：`v89.43 城池四图`（缺位放行 · 归位自动恢复 256×256）· `v89.42 登记表`（改守“登记 ↔ 磁盘 一致”）· `v89.106 _gold_backup`（缺位放行 · 归位自动 16/16） | `[0/4（余者待重制 · 矢量兜底）]` · `[0/16（清理期缺位 · 可恢复）]` 均 ✅ |
| ② | 登记表 | `gen_bitmaps.js` 重跑：**99→95 条**（diff 仅 4 条城池行 + count） | 与磁盘双向差 **0** ✅ |
| ③ | 管线脚本 | `build_atlas_src.py` / `diag_bldg_materials.py` 缺席守卫（打印恢复路径 · exit 1）· `split_atlas.py` 对比段缺原图 → nan 降级 · `wasteland_prompts.py` 提示串更新 | 守卫实跑 exit=1 + 恢复指引 ✅ · `py_compile` ×4 过 |
| ④ | 备份三处 | 回收站（原物）· **git**（tracked）· `.workbuddy/backup/v89237-素材/{city4(4) · gold_backup(16) · pre-edit(6)}/` | 全部落地 ✅ |
| ⑤ | 资产层复核 | `verify_wasteland.js`：building 16/16 · troop 14/14 · terrain 7/7 · mat 24/24 · slot 12/12 · **city 0/4（预期"退回矢量"）** · 登记表 95 条 · 磁盘缺失 0 · 无未登记 PNG | ✅ |

**门禁**：smoke **3634/0**（收口前 2 红：城池四图 + `_gold_backup`）· `gate --full` **✓ 全绿**（audit 全 0 · e2e 1132/0 · 四查 · dataset 56/0 · 兵种链 0 错）。

## 七、城池贴图归位 / 全退 操作手册

**① 新图归位（重制 · 建议同名 256×256 PNG）**：
```bash
cp <新图> E:/Deepseekdb/assets/icons/ui/ai_city_{county,jun,zhou,capital}.png
node .workbuddy/tools/gen/gen_bitmaps.js   # 登记表收录（不跑则游戏仍走矢量兜底）
node smoke-test.js                         # 断言自动恢复 256×256 严格校验
```

**② 旧图回退（三选一）**：回收站还原 / `git checkout HEAD -- assets/icons/ui/ai_city_county.png`（四张各跑）/ `cp .workbuddy/backup/v89237-素材/city4/* assets/icons/ui/`；之后同样跑 `gen_bitmaps.js`。

**③ 永久不要（固化退役）**：smoke 三处「清理期」措辞固化为永久口径；如需连 `ai_city_` 前缀映射一起退役，照「退役三清」办理（本轮已示范：断言 + 4 脚本 + 文档）。
