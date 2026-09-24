# -*- coding: utf-8 -*-
# 修 §100 ⑥ 的源码级正则：battle.js 用中间变量 hk/hi（与 tactic/ui 的内联写法不同）
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
BAK = 'E:/Deepseekdb/.workbuddy/backup/v89119/smoke-test.js'
s = io.open(P, encoding='utf-8').read()

OLD = """      var bOK = /hostOf\\[\\(e\\.side === 'atk' \\? 'a' : 'd'\\) \\+ '\\|' \\+ e\\.id\\]/.test(b99)
        && /hostOf\\[\\(e\\.side === 'atk' \\? 'd' : 'a'\\) \\+ '\\|' \\+ e\\.targetId\\]/.test(b99);"""
NEW = """      var bOK = /hostOf\\[\\(e\\.side === 'atk' \\? 'a' : 'd'\\) \\+ '\\|' \\+ e\\.id\\]/.test(b99)
        && /var hk = \\(e\\.side === 'atk' \\? 'd' : 'a'\\) \\+ '\\|' \\+ e\\.targetId;/.test(b99)
        && /var hi = hostOf\\[hk\\];/.test(b99);"""

if s.count(OLD) != 1:
    print('!! 锚点 %d 处 → 中止' % s.count(OLD))
    # 打印实际文本帮助定位
    i = s.find("var bOK = /hostOf")
    print(repr(s[i - 10:i + 300]))
    sys.exit(1)
s2 = s.replace(OLD, NEW, 1)
b = io.open(BAK, encoding='utf-8').read()
d = (s2.count('{') - s2.count('}')) - (b.count('{') - b.count('}'))
print('花括号净变化 %+d' % d)
tmp = P + '.tmp119sec100b'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp, P)
print('⑥ 正则已修')
