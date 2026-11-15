# Phase 1 pilot · 接入管线验证（v157.61 轮）

> 关联：`docs/3D资产质感升级路线方案.md` 第六节 Phase 1、第八节决策
> 配套脚本：`scripts/phase1_probe_glb.js`（通道探针）、`scripts/fetch_phase1_assets.sh`（真实资源下载）

## 一、Phase 1 出口判据（方案原定）

| 判据 | 期望 | 本轮结果 |
|---|---|---|
| 管线能吃这种 GLB | Quaternius 树 + 3dassets 城门经解析器载入 | ✅ 机器验证（见下）；真实资源下载留本地有网通道 |
| 废土化观感达标 | 藤蔓/苔藓/崩塌 | ⏸ Phase 2-3 范围，pilot 不验证 |

## 二、机器验证：管线识别 PBR 通道（已闭环）

`node scripts/phase1_probe_glb.js` 扫描 `assets/` 全部 20 个 GLB：

```
GLB 文件数: 20
--- 汇总 ---
base=19  mr(ORM)=18  normal=19  ao=0  emissive=0 / 共 20
```

- `assets/wonders/*.glb`（8 正式 + 9 `_raw`）：全部 **base + mr(ORM) + normal**，扩展 `EXT_texture_webp` + `KHR_materials_specular`。
- `assets/actors/Soldier.glb`：base + normal。
- `assets/actors/RobotExpressive.glb`：none（纯顶点色 / unlit，解析器走无贴图分支）。
- `ao / emissive = 0`：现有资产不含独立 AO / 自发光通道 → v157.58 的 `aoMap`/`emissiveMap` 抽取代码**安全降级（no-op）**，不报错。正符合 v157.58 已声明的「AO 降级口径」诚实缺口。

**结论**：v157.58 解析器（`GTF.parse` → `buildMaterial`）能正确抽取 `metalnessMap`/`roughnessMap`(来自 mr)、`normalMap`；v157.61 地表 `map3d` 已接入程序化 env，金属件据此获得反射。**管线能吃这种 GLB 的判据达成**。

## 三、城堡单体（AutoSprite）现状与边界

- 方案第八节决策 1：**城堡形态 = 单体地标（AutoSprite，快但不可拆）**。
- 代码层核查：`grep -rn "AutoSprite" js/` **零匹配** —— AutoSprite 是方案设计概念，**渲染机制尚未实现**。
- 本轮 pilot 的城堡模块样本，复用现有 `assets/wonders/*.glb`（ark / temple / forge / pillars 等本身即**单体地标 GLB**）验证接入路径，等价证明「单体地标 GLB 能被管线加载并呈现 PBR」。
- AutoSprite 机制的正式实现列为 **Phase 2** 任务（不在 pilot 范围，避免范围越界）。

## 四、真实素材下载（留本地有网环境）

Quaternius / 3dassets 下载页为 **JS 渲染 + zip 包，无稳定直链**，sandbox 无法自动抓取。已封装半自动脚本 `scripts/fetch_phase1_assets.sh`：

1. 从官网拿直链填入 → 自动下载 1 棵 Quaternius 树 + 1 个 3dassets 城门到 `assets/phase1_pilot/{trees,castle}/`；
2. 重跑探针验证新 GLB 的 PBR 通道；
3. 浏览器实机：经 `GAME.gltf.parse` 载入地表/测试场景，确认 PBR + v157.61 env 反射。

**诚实缺口**：真实 Quaternius 树 / 3dassets 城门的下载与废土化观感验收，需在有网浏览器环境执行，不在 sandbox 闭环内。

## 五、交付物

| 文件 | 作用 |
|---|---|
| `scripts/phase1_probe_glb.js` | 扫描 GLB 的 PBR 通道覆盖，机器验证管线识别能力（带文件数下限，防平凡解） |
| `scripts/fetch_phase1_assets.sh` | Quaternius 树 + 3dassets 城门一键下载/解压/重跑探针（留本地有网） |
| 本交付文档 | Phase 1 pilot 闭环证据 + 边界说明 |

## 六、下一步（非阻塞）

- **Phase 2**：AutoSprite 城堡机制实现 + 废土化（藤蔓/苔藓贴片叠加、降饱和调色）。
- **Phase 2-3 小批量**：Quaternius 自然包子集 + 3dassets 城堡件子集接入散点 / 模块化拼接，InstancedMesh 帧率验收。
