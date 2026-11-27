# -*- coding: utf-8 -*-
"""v158.37 需求档案补录（追加型 · 幂等 · LF）"""
import io

P = 'E:/Deepseekdb/需求档案.md'
NL = chr(10)
MARK = '## v158.37 · 老板：「存在高度跳变。」'

with io.open(P, 'r', encoding='utf-8', newline='') as f:
    s = f.read()

assert s.count(MARK) == 0, 'v158.37 段已在册，拒绝重复追加'
assert s.count('## v158.36') == 1, 'v158.36 锚点应唯一'

sec = NL.join([
    '',
    '## v158.37 · 老板：「存在高度跳变。」',
    '',
    '### 需求（原文）',
    '',
    '> 存在高度跳变。',
    '',
    '### 病根与修法',
    '',
    '从真实开局逐帧取证（`p_height_jump.js`，固定 `mapSeed=20261127`）：静止 Δh=0、键盘走路 Δh≤0.059m、',
    '自然地形 0.1m 步进 Δ≤0.132m —— 三者都连续。唯一跳变在**自动走到达那一帧**：',
    '`stepWalkTo` 的到达阈值写死 0.6m，走到距目标格心 0.6m 就直接锁格心（含高度采样），',
    '38° 坡上一帧高度跳 0.518m、相机半径跳 0.528m。',
    '',
    '修法：阈值抽成具名常量 `M.WALK_TO_ARRIVE_M = 0.02`，收紧到 2cm 让 slerp 走完最后一段；',
    '高度仍逐帧走 `_groundAtUnit` → `setPlayerPose` 唯一出口，不新增第二套写入。',
    '',
    '### 断言处置（规则变更，不删不放宽）',
    '',
    '- `§613③`、`§619③` 锚点从 `if (dist <= 0.6)` 同步到 `if (dist <= M.WALK_TO_ARRIVE_M)`，标题注明 v158.37 口径。',
    '- 新增 `§620①~③`：阈值具名常量且 ≤0.05m（挡 0.6m 回退）/ 判据只读常量 / 高度都走 `_groundAtUnit` 不旁路直写。',
    '',
    '### 实测',
    '',
    '修复前 maxΔh=0.518m@61 → 修复后 0.033m@62（降 15.7×）；`p_height_jump` 7/0；三闸门全绿。',
    '回归探针：p_walk_scan 10/0 · p_stardew_ops 9/0 · p_click_e 4/0（复跑 3 次）· p_cam_free 7/0 · p_edgepan 9/0。',
    '交付见 `docs/_史料/交付/v15837-自动走到达高度跳变.md`。',
    '',
    '### 诚实缺口',
    '',
    '进地表一次性落地 `h:0→ground`（角色尚不可见时发生，非走路观感）本轮未改；',
    '若要消除需在 `surfaceMode(true)` 入口统一贴地，待老板定夺。',
    '',
])

s2 = s.rstrip(NL) + NL + sec
assert s2.count(NL) > s.count(NL) * 0.99, '换行数异常，拒绝写盘'
assert s2.count(MARK) == 1 and s2.count('存在高度跳变。') >= 2

with io.open(P, 'w', encoding='utf-8', newline='') as f:
    f.write(s2)
print('OK: 追加 v158.37 段，行数 %d → %d' % (s.count(NL), s2.count(NL)))
