# -*- coding: utf-8 -*-
"""v89.126 补丁 A：人口增速改「固定 2 小时补满（现实时间）」
—— data.js 的 POP_CFG（注释段 + 配置块）。
安全三件套：备份已在 backup/v89126；原子落盘（异常不写）；写后自检（node --check + 锚点断言）。
"""
import io, os, re, subprocess, sys

R = r'E:/Deepseekdb'
P = os.path.join(R, 'js', 'data.js')
s = io.open(P, encoding='utf-8').read()
orig = s

# ── ① 注释段：定位「· POP_CFG —— 增速公式的三条杠杆」行，替换该行起 3 行 ──
lines = s.split('\n')
hit = None
for i, L in enumerate(lines):
    if 'POP_CFG —— 增速公式的三条杠杆' in L:
        hit = i
        break
assert hit is not None, '注释锚点未命中（· POP_CFG —— …）'
assert '守将内政（安置流民）' in lines[hit + 1], '注释第 2 行不符：' + lines[hit + 1]
assert '保底 1/时' in lines[hit + 2], '注释第 3 行不符：' + lines[hit + 2]
new_note = [
    '   * v89.126（老板）：「人口增长模式太磨人了…我提议人口增长速度总是',
    '   *   **每 2 小时即可补充人口至上限**，即按固定时间速率」（旧公式前期',
    '   *   8 间民房 = 上限 800、保底 1/时 → 补满要 800 游戏小时，体感"根本没增加"）。',
    '   *   基数从"上限 × 0.05%/游戏时 + 保底 1"改为 **fillHours（现实小时）补满**：',
    '   *   增速 = 上限 ÷ fillHours —— **与上限大小无关、补满时长恒定**。',
    '   *   口径 = **现实时间**（"跟上玩家游戏时长"；与资源产量的"游戏小时"',
    '   *   是两个口径，界面文案必须写明"现实时间"）。三条杠杆（守将内政 /',
    '   *   增民令 / 税制）保留 —— 补满时长因此可短于 fillHours。',
    '   *   ⚠️ 旧字段 `base`（0.0005）与 `minPerHour`（保底 1）随新公式**退役**：',
    '   *   新公式最小值 = 上限 ÷ fillHours（上限 ≥ 1 时恒 > 0），不需要保底。',
]
lines[hit:hit + 3] = new_note
s = '\n'.join(lines)

# ── ② 配置块：替换 DATA.POP_CFG 内的 base / minPerHour 两行 ──
old_cfg = ("  DATA.POP_CFG = {\n"
           "    base: 0.0005,        /* 每小时 = 民房上限 × 0.05% */\n"
           "    minPerHour: 1,       /* 保底 1/时 */\n")
assert s.count(old_cfg) == 1, 'POP_CFG 配置锚点计数 %d（应为 1）' % s.count(old_cfg)
new_cfg = ("  DATA.POP_CFG = {\n"
           "    fillHours: 2,        /* 现实小时：无加成时，从 0 补满至上限的时长（固定时间速率） */\n")
s = s.replace(old_cfg, new_cfg)

assert s != orig, '没有任何替换发生'
# 原子落盘：先写临时文件，再替换
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)

# 写后自检
chk = io.open(P, encoding='utf-8').read()
assert 'fillHours: 2' in chk and 'minPerHour' not in chk
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:300]
print('✓ data.js 补丁 A 完成（POP_CFG → fillHours=2；base/minPerHour 退役）')
print('  行数 %d → %d' % (orig.count('\n') + 1, chk.count('\n') + 1))
