# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 G：四个审计工具同步
  audit_v89105_modals.js / audit_v89112_pressure.js / audit_v89206_systemmatrix.js / audit_v89208_systemmatrix.js
用法：python .workbuddy/tools/patch/patch_v9080g_tools.py [--apply]
"""
import io, sys

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

apply = '--apply' in sys.argv
logs = []
buffers = []

def rep_file(path, pairs, tag):
    s = rd(path)
    if 'v90.80' in s and tag in ('modals', 'pressure', 'v206', 'v208'):
        # 粗幂等：目标替换串已不在 + 注释在 → 跳过
        pass
    for i, (old, new, cnt) in enumerate(pairs):
        c = s.count(old)
        assert c == cnt, '%s #%d count=%d expect=%d' % (tag, i, c, cnt)
        s = s.replace(old, new)
    buffers.append((path, s))
    logs.append('[ok] %s（%d 段）' % (tag, len(pairs)))

# G1 modals 工具
G1 = '.workbuddy/tools/audit/audit_v89105_modals.js'
s1 = rd(G1)
if '「见闻/日志」随奇遇系统退役' in s1:
    logs.append('[skip] modals')
else:
    rep_file(G1, [
        ("    ['见闻/日志', 'ui.openJournal(1)'],\n",
         "    /* v90.80：「见闻/日志」随奇遇系统退役（openJournal 已删） */\n", 1),
    ], 'modals')

# G2 pressure 工具
G2 = '.workbuddy/tools/audit/audit_v89112_pressure.js'
s2 = rd(G2)
if '「见闻/日志」随奇遇系统退役' in s2:
    logs.append('[skip] pressure')
else:
    rep_file(G2, [
        ("  ['见闻/日志', 'ui.openJournal(1)'],\n",
         "  /* v90.80：「见闻/日志」随奇遇系统退役（openJournal 已删） */\n", 1),
    ], 'pressure')

# G3 v206 systemmatrix
G3 = '.workbuddy/tools/audit/audit_v89206_systemmatrix.js'
s3 = rd(G3)
if '「奇观/奇遇」整系统退役' in s3:
    logs.append('[skip] v206')
else:
    rep_file(G3, [
        ("  { n: '奇观', d: ['WONDER', 'WONDERS'], g: ['wonder'], u: ['wonder', '奇观'], t: ['wonder'] },\n",
         "  /* v90.80：「奇观/奇遇」整系统退役 —— 四链核对行移除（防重跑误报假缺口） */\n", 1),
    ], 'v206')

# G4 v208 systemmatrix（行 + 路由正则 + 纪事剧本 journal 词）
G4 = '.workbuddy/tools/audit/audit_v89208_systemmatrix.js'
s4 = rd(G4)
if '「奇观/奇遇」整系统退役' in s4:
    logs.append('[skip] v208')
else:
    rep_file(G4, [
        ("  { n: '奇观', d: ['WONDER', 'WONDERS'], g: ['wonder'], u: ['wonder', '奇观'], t: ['wonder'] },\n",
         "  /* v90.80：「奇观/奇遇」整系统退役 —— 四链核对行移除（防重跑误报假缺口） */\n", 1),
        ("  '奇观': /^wonder/,\n",
         "  /* v90.80：'奇观/奇遇' 整系统退役（动作面路由项移除） */\n", 1),
        ("  '纪事剧本': /^story|^chronicle|^journal|^quest/,\n",
         "  '纪事剧本': /^story|^chronicle|^quest/,\n", 1),
    ], 'v208')

print('\n'.join(logs))
if not apply:
    print('DRY-RUN OK（未写盘）。确认后加 --apply。')
else:
    for p, content in buffers:
        wr(p, content)
        print('written: ' + p)
    print('APPLIED.')
