# -*- coding: utf-8 -*-
"""v89.137 补丁 P：battle.js —— arrive 的 gen 空引用修复（无将增援抵达必崩 · 探针实测抓出）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'battle.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# 清理废行 + 补 gen 守卫
rep(
"""    /* v89.137（老板 7）：`m.genId === ''` = **设计上的无将增援**（station 补兵，不走折返）；
       只有"记了将、人却已不在"（解雇/离去）才折返。 */
    if (!gen && !m.genId) gen = null;
    if (!gen && m.genId) {""",
"""    /* v89.137（老板 7）：`m.genId === ''` = **设计上的无将增援**（station 补兵，不走折返）；
       只有"记了将、人却已不在"（解雇/离去）才折返。 */
    if (!gen && m.genId) {""",
'清理废行')

rep(
"""    /* v89.87：观战挂起（pending）时将领**保持征战在外**，不置 idle ——
       等 finishBattle 落账后统一收尾（否则战斗中将领会被当成空闲可再派遣） */
    if (!(r && r.pending) && gen.status === 'march') gen.status = 'idle';""",
"""    /* v89.87：观战挂起（pending）时将领**保持征战在外**，不置 idle ——
       等 finishBattle 落账后统一收尾（否则战斗中将领会被当成空闲可再派遣）。
       v89.137：`gen` 可能为 null（无将增援 · station 补兵）—— 守卫防空引用。 */
    if (gen && !(r && r.pending) && gen.status === 'march') gen.status = 'idle';""",
'arrive gen 守卫')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'if (gen && !(r && r.pending) && gen.status' in chk, '未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平'
print('✅ battle.js 补丁P 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
