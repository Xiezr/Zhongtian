# v157.83 · 修「球体不跟手 · 乱滚」= 相机姿态换 turntable

- 日期：2026-11-16
- 版本：`v157.82` → `v157.83`
- 主战场：`js/map3d.js`（`placeCamera` 姿态构造 / `_spinTick` / 地表平移）
- 关联断言：新增 `smoke-test.js §586s`（五层），`§586r` 全部保持绿

---

## 一、需求原文

> 球体不是跟着鼠标走，而是乱滚。

---

## 二、根因：最短弧姿态把「俯角」转成了「画面 roll」

拖动映射没坏 —— v157.80 的 `camO.pitch += dy·K` / `camO.yaw -= dx·K` 纯累加是对的，
`§586r` 的 400 帧数值面至今是绿的。坏的只有一句：

```js
camO.quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), _dv);
```

`setFromUnitVectors(Z, dir)` 求的是**最短弧**：轴 = `Z × dir`（一定是水平轴），
角 = `acos(Z·dir)`。它只保证 `+Z` 落到 `dir`，**up 完全不管** ——
相机 up 被这条水平轴带着一起转了 θ，于是：

```
画面 roll = 俯角
```

### 纯数学实测

脚本：`.workbuddy/tmp/cam_roll_probe.js`（手写矩阵，不依赖 three.js、不依赖渲染）。
A = 现网最短弧；B = turntable（固定 up 的欧拉构造）。

| pitch | A（现网）roll | B（turntable）roll |
|---|---|---|
| 0° | 0.00° | 0.00° |
| 24.1° | **10.30°** | 0.00° |
| 51.6° | **23.09°** | 0.00° |
| 80.2° | **39.20°** | 0.00° |
| 90.0° | **45.80°** | 0.00° |
| 103.1° | **123.90°** | 180.00° |
| 143.2° | **76.33°** | 180.00° |

400 帧连续上拖（每帧 −4.5px）：

```
逐帧 dir 最大转角 = 1.289°（两法位置一致 —— 位置从来没错，错的是朝向）
A 最短弧：单帧 roll 跳变最大 = 89.05° ；视线偏离球心帧数 = 30
B 欧拉  ：|pitch|<90° 恒 0，跨极点单帧 180°
```

> `视线偏离球心 30 帧`：最短弧在 `dir ≈ −Z` 时退化（轴长趋 0），
> three 退到"取任一垂直轴转 180°"，那个 quat 的 -Z 不再指向球心。
> 位置对、朝向错 —— 这正是"球在乱滚但位置没动"的观感来源之一。

**结论**：玩家拖哪儿，球都像"自己滚"，是因为画面被一条与俯角成正比的 roll 持续扭转；
越过极点时这条 roll 还会单帧猛跳近 90°。

---

## 三、修法：turntable（与 OrbitControls 同构）

```js
R = Ry(yaw) · Rx(−pitch) · Rz(roll)          // three: Euler(-pitch, yaw, roll, 'YXZ')
```

| 项 | 作用 |
|---|---|
| `Ry·Rx` | 把 `+Z` 精确转到 `dir`（视线正对球心），up 由 Ry 保持竖直 |
| `Rz` | 绕**局部视线轴**滚，不改变 `dir` —— 相机位置一点不动 |

`roll = _camRollOf(pitch)`：

```js
W = 0.08                    // 过渡半宽，单位 π（≈14.4°）
f = pitch / π; n = floor(f); frac = f − n
frac ≤ 0.5−W  →  n·π
frac ≥ 0.5+W  →  (n+1)·π
中间          →  (n + smoothstep(t))·π
```

- `|pitch| ≤ 75.6°` → **roll ≡ 0**：地平线水平，拖动方向 = 内容移动方向（常规视角全覆盖）
- 每跨一个极点（`90° + 180°·n`）→ 在 ±14.4° 拖动带内 smoothstep 转 180°

**为什么极点必须翻 180°**：沿经线滚过极点，球面上的"上方"必然翻转 —— 拓扑事实，躲不掉。
只有两种做法：突变（越极点那帧翻半圈，实测单帧 180°，比现状更丑）vs **分摊**（本版）。
分摊后画面读作"球从眼前滚过去"，与物理一致。

---

## 四、顺带修掉的两个自转 bug（同一个"姿态多真值"病根）

### ① `quat` 转了，`yaw` 没转 → 一拖就跳回

```js
// 旧
camO.quat = camO.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(Y, ang));
camO._euler = [camO.yaw, camO.pitch];   // 假装干净
```

`quat` 已转 N 度、`yaw` 停在旧值。玩家一拖动 → `camO.quat = null` → placeCamera 按旧 yaw 重建
→ **画面瞬间跳回自转前**，然后接着自转。

数学上 `premultiply(Ry(θ)) ≡ yaw += θ`（因为 `R = Ry(y)·Rx(−p)·Rz(r)`），
改为直接累加 `camO.yaw`，姿态回到单一真值。

### ② 默认自转与「观察窗口不动」冲突

`M.spinOn` 原来默认 `true`（60 秒一圈）：玩家没点任何按钮，球就一直在漂，
与老板 v157.34 立的口径「位置与朝向都只由玩家改」直接冲突。
改为**默认静止**；`🌏 自转` 按钮保留，一键恢复。

---

## 五、实机验证

脚本：`.workbuddy/tools/show/shot_v15783_roll.js`（Playwright + SwiftShader 真渲染）。

```
起始  {"pitch":24.06,"yaw":45.84,"roll":0.00,"rAlt":570,"surf":false}

① 右拖 200px  maxStep=0.52°  frozen=0/100  maxRoll=0.00°   Δlon=−57.30°
   → 契约「右拖 = 内容左移 = 经度减小」成立；全程零 roll

② 下拖 200px  maxStep=0.57°  frozen=0/100  maxRoll=18.72°  Δlat=+57.30°
   → 契约「下拖 = 内容下移 = 纬度增大」成立
   → maxRoll 18.72° 是因为这一拖直接把 pitch 推到 81°，进入极点过渡带（设计内）

③ 上拖 3 轮   maxStep=1.43°  frozen=0/390
   → 连续越过极点 3 次，零冻结帧、零跳变

④ 自转 2s 后拖 1px：dir 跳变 0.081°（旧版 quat/yaw 不同步会跳十几度）

⑤ 高空轨道跳变（_camJumps, surf=false & rAlt>100）= 0 条 · 页面异常 0

ROLLFIX_PASS
```

截图：

- `v15783_a_start.png` —— 初始正视，球居中、无异常倾斜
- `v15783_b_pole.png` —— 越过极点后
- `v15783_c_far.png` / `v15783_d_near.png` —— 远/近景

---

## 六、断言：新增 `§586s`（五层）

| 层 | 判据 | 实测 |
|---|---|---|
| 结构面 | 姿态唯一出口 = `setFromEuler(Euler(−pitch, yaw, _camRollOf(pitch), 'YXZ'))` | 在岗 |
| 反向证据 | 相机姿态链上 `setFromUnitVectors(… (0,0,1) …)` 计数 = 0 | 0 处 |
| 数值面 | 真调 `_camRollOf`：常规恒 0；0→4π 扫描单步 < 6° | 2513 步 · 单步 2.69° |
| 行为面 | 真算矩阵：`R·(0,0,1) ≡ 球坐标 dir`；`\|pitch\|≤75°` roll ≈ 0 | 误差 0 · roll 1e-6° |
| 自转面 | `camO.yaw += _spinAng` 在岗 · `premultiply` 旧写法 0 处 | ✓ |
| 默认面 | `M.spinOn = false` + `setSpin` 保留 | ✓ |

`§586r`（v157.80/81 的拖动累加与反算删除）六条全部保持绿 —— 本版**没有动拖动映射**。

---

## 七、门禁

`gate.py --staged` → **GATE_EXIT=0**，墙钟 **745.2 秒**：audit 全 0 / chain 47-0 / invariants 40-0 / **smoke 4538-0** / e2e 1103-0 / audit_v89134 四查全过 / audit_v89179c 67-0 / audit_v89229b 兵种链 0 / audit_v15730 5-0。

产物：`v157.83` · hash `3ed0fe735c61a74a` · `?v=3ed0fe73` · 三包 4485247 字节 · 模块 89。

---

## 八、回退

```bash
cp .workbuddy/backup/map3d.v15782.js js/map3d.js
cp .workbuddy/backup/main.v15782.js   js/main.js
cp .workbuddy/backup/需求档案.v15782.md 需求档案.md
# 再重建：node .workbuddy/tools/map/gen_index.js && python .workbuddy/tools/patch/build_bundle.py
```

或 `git revert`。

---

## 九、诚实说明

1. **越极点画面会翻 180°**：球面拓扑的必然。本版分摊到 ±14.4° 拖动带里平滑完成；
   常规视角（|pitch| < 75°）完全看不到 roll。
2. **自转默认关是行为变更**：老板若要默认转，改 `M.spinOn = true` 一行，
   并把 `§586s 默认面` 同步改成 `true`。
3. 全文件仍有 2 处 `camO.pitch = Math.asin(...)`：`M.lookAtDir`（外部定位入口）与
   地表平移收尾（一次性，非每帧）—— `§586r 根因面` 仍是"应 2 处"，没有回升。
