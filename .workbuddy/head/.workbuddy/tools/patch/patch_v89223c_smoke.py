# -*- coding: utf-8 -*-
"""v89.223c：smoke —— §129③/§151 镜像与 §199④ 版本正则修正 + §223 守卫段插入。
用法: DRY=1 python patch_v89223c_smoke.py
"""
import io, os, sys

P = 'smoke-test.js'
SECF = '.workbuddy/tools/patch/v89223_sec_smoke.txt'
def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

DRY = os.environ.get('DRY') == '1'
s = rd(P)
SEC = rd(SECF)
assert '§223-guard' in SEC and SEC.rstrip().endswith('})();'), '§223 片段文件形态异常'

if '§223-guard' in s:
    print('[skip] §223 已落盘（幂等）')
    sys.exit(0)

REPS = [
    ("=== '枪' && G.troopAbOf('nanjiangxiangbing') === '象'",
     "=== '矛' && G.troopAbOf('nanjiangxiangbing') === '兽'", '§129③ 期望换新字'),
    ('data-tip-el="1">枪<span class="tip-src">',
     'data-tip-el="1">矛<span class="tip-src">', '§129③/§151 兵牌镜像'),
    ("'v89\\.222'/.test(mS199)", "'v89\\.223'/.test(mS199)", '§199④ 版本正则'),
    ('/* v89.222：版本号每轮迭代更新（本条随轮升级） */',
     '/* v89.223：版本号每轮迭代更新（本条随轮升级） */', '§199④ 注释'),
]
for old, new, tag in REPS:
    c = s.count(old)
    assert c == 1, '[%s] count=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    print('[ok] %s' % tag)

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, '结果行锚点异常'
s = s.replace(anchor, SEC + '\n\n' + anchor)
print('[ok] §223 守卫段插入（5 条）')

if DRY:
    print('DRY 模式：未落盘')
else:
    wr(P, s)
    print('已落盘 %s' % P)
