# -*- coding: utf-8 -*-
"""v89.126 补丁 F：修 §106② 判据（占用比 = 级数比，而不是"级数减半"）"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()

old = """    /* ② 未满配按级数比例（城外减半 → 占用约一半） */
    var c2_106 = mkFull106('self', 12);
    c2_106.extGrid = c2_106.extGrid.slice(0, Math.floor(c2_106.extGrid.length / 2));
    var half106 = G.popLaborOf(c2_106);
    var full106 = G.popLaborOf(mkFull106('self', 12));
    check('§106② 未满配按比例：一半级数 → 占用约一半',
      half106 > 0 && Math.abs(half106 / full106 - 0.5) < 0.02,
      half106 + ' / ' + full106 + ' = ' + (half106 / full106 * 100).toFixed(1) + '%');"""
new = """    /* ② 未满配按级数比例：**占用比 === 级数比**（城外减半 → 占用落到级数份额） */
    var c2_106 = mkFull106('self', 12);
    c2_106.extGrid = c2_106.extGrid.slice(0, Math.floor(c2_106.extGrid.length / 2));
    var fullCity106 = mkFull106('self', 12);
    var half106 = G.popLaborOf(c2_106);
    var full106 = G.popLaborOf(fullCity106);
    var lvRatio106 = G.popLaborLevelsOf(c2_106) / G.popLaborLevelsOf(fullCity106);
    check('§106② 未满配按比例：占用比 = 级数比',
      half106 > 0 && Math.abs(half106 / full106 - lvRatio106) < 0.01,
      '占用比 ' + (half106 / full106 * 100).toFixed(1) + '% = 级数比 '
      + (lvRatio106 * 100).toFixed(1) + '%（' + G.popLaborLevelsOf(c2_106)
      + '/' + G.popLaborLevelsOf(fullCity106) + ' 级）');"""
assert s.count(old) == 1, '锚点计数 %d' % s.count(old)
s = s.replace(old, new)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:300]
print('✓ 补丁 F 完成（§106② 判据 = 占用比 vs 级数比）')
