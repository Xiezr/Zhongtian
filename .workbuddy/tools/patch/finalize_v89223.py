# -*- coding: utf-8 -*-
"""v89.223 收尾：工作记忆 + 技能沉淀（§133 + §131.3 补注）。
用法: DRY=1 python finalize_v89223.py
"""
import io, os, sys

MEM = 'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-10-06.md'
SK = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'
F_MEM = '.workbuddy/tools/patch/v89223_mem.txt'
F_SK = '.workbuddy/tools/patch/v89223_skill133.txt'
DRY = os.environ.get('DRY') == '1'

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

# 1) 工作记忆
mem = rd(MEM)
frag = rd(F_MEM)
if '## v89.223' in mem:
    print('[skip] 记忆已含 v89.223')
else:
    mem2 = mem.rstrip() + '\n\n---\n\n' + frag.rstrip() + '\n'
    if not DRY:
        wr(MEM, mem2)
    print('[ok] 记忆追加（%d -> %d 字节）' % (len(mem), len(mem2)))

# 2) 技能：§131.3 补注 + §133
sk = rd(SK)
fragsk = rd(F_SK)
changed = False
anchor = ('**→ 已解决（v89.222）**：老板令「历史标题引述等全面更换」——用例层已按 §132 定式批清理完'
          '（历史引述统一换为现行词，如「铁骑赢长枪」→「装甲战车赢长矛手」）。')
if '已解决（v89.223）' not in sk:
    c = sk.count(anchor)
    assert c == 1, '§131.3 锚点 count=%d' % c
    sk = sk.replace(anchor, anchor + '\n  **→ 已解决（v89.223）**：`troopAbOf` 的 ab 单字全换代（§133），'
                            '产品侧注释 / 任务文案 / 活工具夹具同批收尾。')
    changed = True
    print('[ok] §131.3 补注')
else:
    print('[skip] §131.3 补注已在')
if '## §133.' not in sk:
    sk = sk.rstrip() + '\n\n' + fragsk.strip() + '\n'
    changed = True
    print('[ok] §133 就绪')
else:
    print('[skip] §133 已在')
if changed and not DRY:
    wr(SK, sk)
    print('[ok] 技能落盘 %s' % SK)
elif changed and DRY:
    print('DRY 模式：未落盘')
