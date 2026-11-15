# v157.58 交付 · gltf 解析器 PBR 通道扩展（Phase 0）

**日期**：2026-11-15
**关联方案**：`docs/3D资产质感升级路线方案.md` 第八节（4 项已拍板）
**关联台账**：`需求档案.md` v157.58 行

## 一、老板拍板（过目方案第八节后）
| # | 决策点 | 拍板 |
|---|---|---|
| 1 | 城堡形态 | 单体地标（AutoSprite，快但不可拆） |
| 2 | 废土残破程度 | 轻做旧（干净 + 苔藓） |
| 3 | env 反射 | 接受程序化 env（无 HDRI 外链、零依赖） |
| 4 | 第一步 | **先动 Phase 0 解析器**（参谋长拍板：解析器是硬前置，先用现有 wonder GLB 验证"更质感"，再让 pilot 在已具备 PBR 能力的管线上验证资产接入） |

## 二、关键前置发现（避免重蹈 v157.56 覆辙）
`js/bundle-war.js` 是 `build_bundle.py` 按 `js/modules.json` `layout.war` 拼接的**构建产物**，
真正源码是 **`js/gltf.js`**。本版所有解析器改动落源码后重建，未手改产物。

## 三、改了什么（源码 `js/gltf.js` + `js/scene3d.js`）
| # | 文件 | 改动 | 作用 |
|---|---|---|---|
| 1 | gltf.js `GTF.parse` | 抽 `metallicRoughnessTexture`→`metalnessMap`+`roughnessMap`；`occlusionTexture`→`aoMap`；`emissiveTexture`+`emissiveFactor`→`emissiveMap` | 接上 ORM/AO/emissive 三通道（此前全丢弃） |
| 2 | gltf.js `GTF.bakeGeometry` | 为 aoMap 补第二套 UV：同时设 `uv2`(r150) 与 `uv1`(r151+)；无 TEXCOORD_1 时复制主 UV 降级 | AO 才能正确采样，兼容两版 three |
| 3 | gltf.js `GTF.buildMaterial` | 新增 `_load(url,apply,kind)`：颜色纹理走 sRGB、数据纹理走线性；接 `mat.metalnessMap/roughnessMap/aoMap/emissiveMap` | 金属/粗糙/AO 真实生效，且 colorSpace 不再失真 |
| 4 | gltf.js `GTF.buildMaterial` | emissive 修正：有 `emissiveTexture` 优先用它（真·自发光）；否则保留旧 `emissiveMap=baseColor×0.18` 补背光 | 无 emissive 资产不退化为背面死黑 |
| 5 | gltf.js `GTF.buildMaterial` | metalness 上限放开：有 env（`GTF._envOK`）时不夹 0.25 | 金属件才有反射（配合 scene3d 程序化 env） |
| 6 | gltf.js + scene3d.js | `GTF._envOK` + `setEnvAvailable(b)`；scene3d 在 PMREM 生成 `scene.environment` 后 `setEnvAvailable(true)` | 仅"有 env 的场景"放开上限，map3d/duel3d 仍 0.25 兜底 |
| 7 | gltf.js | `GAME.gltfVersion` v92.00→v157.58 | 版本对齐 |
| 8 | smoke-test.js | 新增 §586b 源特征守卫（三通道抽取 + 材质接线 + 双 UV + env 联动） | 回归守护 |

## 四、.env 现状澄清（决策③）
`js/scene3d.js` **早已具备程序化 PMREM env**（从程序化天空 `eq` 生成 `scene.environment`，无 HDRI 外链），
本版只是让解析器"感知"到它（放开 metalness 上限），使 env 反射真正被材质利用。
> 注：地图（map3d）流程目前**无 PMREM**，放在地表 biome 的资产仍走 0.25 兜底（不黑但反射弱）——见下"缺口①"。

## 五、验证
- `node --check js/{gltf,scene3d}.js` / `smoke-test.js` ✅；`build_bundle.py` ✅（hash `3cc0af0af61c39d8`，`index.html ?v=` 同步）。
- 新代码已确认进入产物（`bundle-war.js` 三通道/双 UV/`_envOK` 全命中；`bundle-ui.js` scene3d `setEnvAvailable(true)` 命中）。
- **全量门禁**：后台任务 `hN9VJU`，结果回填台账。

## 六、诚实缺口（非阻塞）
1. **map3d 无 env**：地表 biome 资产反射弱（不黑），需后续给 map3d 也加 PMREM（Phase 0.5，独立任务，本版不动地图防回退）。
2. **AO 降级**：无 TEXCOORD_1 时复用主 UV，精确 AO 需资产自带第二套 UV。
3. **观感需实机拍板**：§586b 只保证通道"命中"，真实质感由老板浏览器实机确认。
4. 需求档案总览表仍停在 v157.12（历史欠账）。

## 七、回退
`.workbuddy/backup/20261115-phase0-gltf/{gltf.js.before, scene3d.js.before}` 覆盖即还原；产物回滚源码后重跑 `build_bundle.py` + `gen_index.js`。
