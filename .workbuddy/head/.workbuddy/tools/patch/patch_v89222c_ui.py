# -*- coding: utf-8 -*-
"""v89.222c · 产品侧收尾：ui.js 三处旧城名引述 + 一处旧城名引语；main.js 版本号"""
import io, sys, os

R = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
bad = []
log = []

def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

FILES = {}

def rep(path, tag, old, new, expect=1):
    s = FILES.get(path)
    if s is None:
        s = FILES[path] = rd(path)
    c = s.count(old)
    if c == expect:
        FILES[path] = s.replace(old, new)
        log.append('[ok]   %s %s x%d' % (path, tag, c)); return
    if c == 0 and new and s.count(new) >= 1:
        log.append('[skip] %s %s（已落盘）' % (path, tag)); return
    bad.append('%s %s count=%d expect=%d | %s' % (path, tag, c, expect, old[:70]))

# ui.js：3 处「许都」引述（v89.221 注释过一遍的漏网）+ 1 处「善无」引语（v89.217 的漏网）
rep('js/ui.js', 'U1 缩略图注释', '许都紧邻首府', '灰岗紧邻首府')
rep('js/ui.js', 'U2 战报示例', '「【许都】攻城胜利」', '「【灰岗】攻城胜利」')
rep('js/ui.js', 'U3 战报示例2', '（已入许都府库；随军载重 …）', '（已入灰岗府库；随军载重 …）')
rep('js/ui.js', 'U4 侦查引语', '侦查 善无」', '侦查 矿口」')
# main.js：版本号
rep('js/main.js', 'version', "GAME.VERSION = 'v89.221';", "GAME.VERSION = 'v89.222';")

# ui.js 残留自检：许都 / 善无 归零
u = FILES.get('js/ui.js', '')
if u.count('许都'):
    bad.append('ui.js 许都残留 %d' % u.count('许都'))
if u.count('善无'):
    bad.append('ui.js 善无残留 %d' % u.count('善无'))

if bad:
    print('\n'.join(log)); print('\n❌ 失配 %d：' % len(bad))
    for b in bad: print('   ' + b)
    sys.exit(1)

if DRY:
    print('\n'.join(log)); print('\n[dry] 未落盘'); sys.exit(0)

for path, s in FILES.items():
    wr(path, s)
print('\n'.join(log))
print('\n✅ v89.222c 落盘（%d 个文件）' % len(FILES))
