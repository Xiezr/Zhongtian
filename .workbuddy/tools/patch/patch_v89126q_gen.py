# -*- coding: utf-8 -*-
"""v89.126 补丁 Q：
① 时间表生成器：城墙口径更新（lvl×60 兜底 / 占格文案）
② smoke §104 注释更新（城墙兜底从 `|| 60` 改为格子路径的 `lvl×60`）
"""
import io, os, subprocess

R = r'E:/Deepseekdb'

# ① 生成器
P = os.path.join(R, '.workbuddy/tools/gen/gen_v89125_build_times.js')
s = io.open(P, encoding='utf-8').read()
pairs = [
    ("    /* 城墙：时间列是哨兵 0 → 按结算同款兜底 60 秒显示（否则总览全是 0.00，误导） */\n"
     "    if (k === 'chengqiang') t = 60;",
     "    /* 城墙：时间列是哨兵 0 → 按结算同款兜底「等级×60」显示（占格后走通用升级路径） */\n"
     "    if (k === 'chengqiang') t = lv * 60;"),
    ("out.push('> 城墙的时间列是**哨兵 0**（代码兜底 60 游戏秒/级，总览与明细均按兜底值显示）—— 见 §5 特例说明。');",
     "out.push('> 城墙的时间列是**哨兵 0**（代码兜底 = 等级×60 游戏秒，总览与明细均按兜底值显示）—— 见 §5 特例说明。');"),
    ("""  if (k === 'chengqiang') {
    out.push('');
    out.push('- 时间列**全 0 = 哨兵**：每级基准 = **60 游戏秒**（与等级无关，代码兜底 `cost.time || 60`）。');
    out.push('- 0→1 修建同样 60 游戏秒；实际 = `max(60 × 城建倍率, 5 现实秒)` —— 默认倍率下 = **5 现实秒/级**。');
    out.push('- 城防技术只减资源（石料 −5%/级，封顶 −60%），**不减时间**。');
    out.push('- （v89.125 修复：旧外推把哨兵 0 变成 1、2 秒 —— 表里从此不再出现假时间。）');
    out.push('');
    return;
  }""",
     """  if (k === 'chengqiang') {
    out.push('');
    out.push('- v89.126 起城墙**占城内一格**（与其它建筑并列管理），升级走通用 `upgradeAt`。');
    out.push('- 时间列**全 0 = 哨兵** → 格子升级兜底 = **等级×60 游戏秒**（Lv→Lv+1）；0→1 为 60 游戏秒。');
    out.push('- 实际 = `max(等级×60 × 城建倍率, 5 现实秒)` —— 默认倍率下前 10 级被地板抬到 **5 现实秒/级**，');
    out.push('  11 级起 = 等级×0.5 现实秒（600→660→720…游戏秒 / 120）。');
    out.push('- 城防技术减城墙资源成本（−5%/级，封顶 −60%），**不减时间**。');
    out.push('- （v89.125 修复：旧外推把哨兵 0 变成 1、2 秒 —— 表里从此不再出现假时间。）');
    out.push('');
    return;
  }"""),
    ("out.push('- **每级基准 60 游戏秒**（时间列哨兵 0 → 兜底）；0→1 修建 60 游戏秒。');",
     "out.push('- **每级基准 = 等级×60 游戏秒**（时间列哨兵 0 → 格子升级兜底）；0→1 修建 60 游戏秒。');"),
    ("out.push('- 实际 = `max(60 × 城建倍率, 最短 5 现实秒)` → 默认 120× 下 **5 现实秒/级**。');",
     "out.push('- 实际 = `max(等级×60 × 城建倍率, 最短 5 现实秒)` → 默认 120× 下前 10 级 **5 现实秒/级**，之后随等级微增。');"),
    ("out.push('- 走独立出口 `wallCost / buildWall / upgradeWall`（不在城内格子上）。');",
     "out.push('- v89.126：**占城内一格**，与其它建筑同一套出口（buildAt / upgradeAt / cancelRefundOf）；');\n"
     "out.push('  环城视觉（isoWallSVG）保留，点环城或点城墙格 = 同一个建筑面板。');"),
]
for i, (old, new) in enumerate(pairs):
    c = s.count(old)
    assert c == 1, '生成器锚点 %d 计数 %d' % (i, c)
    s = s.replace(old, new)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, '生成器 node --check 失败：' + r.stderr[:300]
print('✓ 生成器补丁（6 处）')

# ② smoke §104 注释
P2 = os.path.join(R, 'smoke-test.js')
s2 = io.open(P2, encoding='utf-8').read()
old2 = ("    /* ① 城墙：levelCost(lv).time 恒为哨兵 0 —— 升级走 `cost.time || 60` 兜底。\n"
        "       逐级扫到 45（含外推段），任何一级变正数都算回归。 */")
new2 = ("    /* ① 城墙：levelCost(lv).time 恒为哨兵 0 —— 升级走**格子路径兜底** `lvl × 60`\n"
        "       （v89.126 占格后与其它建筑同一路径；旧 `cost.time || 60` 随独立出口一并退役）。\n"
        "       逐级扫到 45（含外推段），任何一级变正数都算回归。 */")
assert s2.count(old2) == 1, 'smoke 注释锚点 %d' % s2.count(old2)
s2 = s2.replace(old2, new2)
tmp2 = P2 + '.tmp_v89126'
io.open(tmp2, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp2, P2)
r2 = subprocess.run(['node', '--check', P2], capture_output=True, text=True)
assert r2.returncode == 0, 'smoke node --check 失败：' + r2.stderr[:300]
print('✓ smoke §104 注释更新')

# 重跑生成器
r3 = subprocess.run(['node', os.path.join(R, '.workbuddy/tools/gen/gen_v89125_build_times.js')],
                    capture_output=True, text=True, cwd=R)
print(r3.stdout.strip()[:200] or r3.stderr[:300])
