# -*- coding: utf-8 -*-
# v89.157 补丁 H：给指定发射点补第三参（主题）—— 人事 / 内政 / 市易
import io, re

FILES = ['E:/Deepseekdb/js/state.js', 'E:/Deepseekdb/js/systems.js',
         'E:/Deepseekdb/js/domain.js', 'E:/Deepseekdb/js/story.js']

TARGETS = [
    # keyword, sub
    (u'训练完成', 'admin'), (u'科技完成', 'admin'),
    (u'晋升爵位', 'staff'), (u'招募成功', 'staff'), (u'相亲结缘', 'staff'),
    (u'贤才来归', 'staff'), (u'解雇', 'staff'), (u'换装', 'staff'), (u'卸下', 'staff'),
    (u'练功', 'staff'), (u'突破成功', 'staff'), (u'忠诚尽失', 'staff'),
    (u'自动招募', 'staff'),
    (u'市易', 'trade'), (u'寄售', 'trade'),
    (u'城池改名', 'admin'), (u'迁址', 'admin'), (u'筑新城', 'admin'),
    (u'为主城', 'admin'), (u'供奉', 'admin'), (u'打造', 'admin'),
    (u'百炼', 'admin'), (u'蕴养', 'admin'), (u'拆解', 'admin'),
    (u'自动研究', 'admin'), (u'贤才', 'staff'),
]

def parse_calls(s):
    """返回 [(start, end, args)] —— end = ')' 的下一位置"""
    out = []
    for m in re.finditer(r'GAME\.log\(', s):
        i = m.end(); depth = 1; j = i; strq = None; args = []; cur = ''
        while j < len(s) and depth > 0:
            ch = s[j]
            if strq:
                cur += ch
                if ch == '\\':
                    cur += s[j + 1] if j + 1 < len(s) else ''
                    j += 2; continue
                if ch == strq: strq = None
                j += 1; continue
            if ch in '\'"':
                strq = ch; cur += ch; j += 1; continue
            if ch == '(': depth += 1
            if ch == ')':
                depth -= 1
                if depth == 0:
                    args.append(cur); out.append((m.start(), j + 1, args)); break
            if ch == ',' and depth == 1:
                args.append(cur); cur = ''; j += 1; continue
            cur += ch; j += 1
    return out

total = {}
for P in FILES:
    s = io.open(P, encoding='utf-8', newline='').read()
    calls = parse_calls(s)
    # 从后往前改，避免位置漂移
    hits = []
    for st, en, args in calls:
        if len(args) != 2:
            continue
        a0 = args[0]
        for kw, sub in TARGETS:
            if kw in a0 and (u"'" + sub + u"'") not in a0:
                hits.append((st, en, kw, sub))
                break
    if not hits:
        continue
    for st, en, kw, sub in sorted(hits, key=lambda x: -x[0]):
        s = s[:en - 1] + u", '" + sub + u"'" + s[en - 1:]
        total[sub] = total.get(sub, 0) + 1
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print(P.split('/')[-1], '->', len(hits), '处', [h[2] + ':' + h[3] for h in hits])

print('汇总:', total)
# 写后自检
for P in FILES:
    chk = io.open(P, encoding='utf-8', newline='').read()
    assert u'{{' not in chk
print('patch H done')
