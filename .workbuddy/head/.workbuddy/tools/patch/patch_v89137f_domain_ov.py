# -*- coding: utf-8 -*-
"""v89.137 补丁 F：domain.js —— 全境营造总览数据层整条退役（墓碑）"""
import io, sys, os, re

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'domain.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

# ── 定位段头（连续段：注释块 + buildQueueOf + buildOverview + rushAllBuilds） ──
start_mark = "  /* ============================================================\n   * v89.102（测评遗留落地 · v89.101 §7 第 1 条）：**全境营造总览**"
i0 = s.find(start_mark)
if i0 < 0:
    print('❌ 找不到段头'); sys.exit(1)

# 段尾 = rushAllBuilds 函数结束（从 `GAME.rushAllBuilds = function () {` 起括号配平）
jmark = s.find('GAME.rushAllBuilds = function () {', i0)
if jmark < 0:
    print('❌ 找不到 rushAllBuilds'); sys.exit(1)
k = s.find('{', jmark)
depth = 0
j = k
while j < len(s):
    ch = s[j]
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0:
            break
    j += 1
# 收尾吞掉 `;` 与本行换行
jend = s.find(';', j)
assert jend > 0 and jend - j < 3, '函数尾异常'
seg = s[i0:jend + 1]
print('将删除片段 %d 字节（%d 行）：\n--- 首 3 行 ---' % (len(seg), seg.count('\n')))
print('\n'.join(seg.split('\n')[:3]))
print('--- 末 2 行 ---')
print('\n'.join(seg.split('\n')[-3:]))

tomb = """  /* ============================================================
   * ⛔ v89.137（老板 4）：「不要全境营造总览，重复」——整条退役
   * ------------------------------------------------------------
   * 删净清单（防死代码，一并不留）：`GAME.buildOverview` / `GAME.rushAllBuilds` /
   * `GAME.buildQueueOf`（唯一消费点是下面的 rush-ov case 与该面板本身）+
   * `ui.openBuildOverview` + 官府要务段的入口按钮 + 动作 `open-build-ov` /
   * `rush-ov` / `rush-ov-all`。
   * 单体提速不受影响：建筑面板的「⚡ 提速」走 `GAME.queueRushPay`（保留）。
   * 如需恢复：本段代码见 `backup/v89137/domain.js`（判据：`buildOverview` 一等公民）。
   * ============================================================ */"""
s = s[:i0] + tomb + s[jend + 1:]

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'GAME.buildOverview = function' not in chk, 'buildOverview 残留'
assert 'GAME.rushAllBuilds = function' not in chk, 'rushAllBuilds 残留'
assert 'GAME.buildQueueOf = function' not in chk, 'buildQueueOf 残留'
assert 'GAME.queueRushPay = function' in chk, '误删 queueRushPay！'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
print('✅ domain.js 补丁F 完成：%d → %d 字节' % (n0, len(chk)))
