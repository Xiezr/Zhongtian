# -*- coding: utf-8 -*-
"""v89.230 收尾：技能 §139 + 工作记忆 追加（双 guard 幂等）。"""
import io

def app(frag, target, guard, label):
    s = io.open(target, encoding='utf-8', newline='').read()
    if guard in s:
        print('[skip] ' + label)
        return
    f = io.open(frag, encoding='utf-8', newline='').read()
    if not s.endswith('\n'):
        s += '\n'
    io.open(target, 'w', encoding='utf-8', newline='').write(s + f)
    print('[ok] ' + label)

app('.workbuddy/tmp/p229b_skill139.md',
    'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md',
    '## §139', '技能 §139 已追加')

app('.workbuddy/tmp/p229b_mem.md',
    'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-10-07.md',
    '## v89.230 兵种链路', '工作记忆已追加')
