# -*- coding: utf-8 -*-
"""v89.222 · 收尾：记忆追加 + 技能沉淀（§132 + §131.3 决议标注）"""
import io, os, sys

R = 'E:/Deepseekdb/'
MEM = 'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-10-06.md'
SKILL = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

frag_mem = rd(R + '.workbuddy/tools/patch/v89222_mem.txt').rstrip('\n') + '\n'
frag_132 = rd(R + '.workbuddy/tools/patch/v89222_skill132.txt').rstrip('\n') + '\n'
bad = []

# ── ① 记忆追加 ──
m = rd(MEM)
if 'v89.222' in m:
    print('[skip] 记忆已在')
else:
    m = m.rstrip('\n') + '\n' + frag_mem
    if not DRY: wr(MEM, m)
    print('[ok] 记忆追加（%d 字符）' % len(m))

# ── ② 技能：§131.3 决议标注 ──
k = rd(SKILL)
old = '改它反而造乱（本轮决定：产品侧全清、用例层挂账待批——透明度写进交付文档）。'
new = ('改它反而造乱（当时决定：产品侧全清、用例层挂账待批）。\n'
       '  **→ 已解决（v89.222）**：老板令「历史标题引述等全面更换」——用例层已按 §132 定式批清理完'
       '（历史引述统一换为现行词，如「铁骑赢长枪」→「装甲战车赢长矛手」）。')
c = k.count(old)
if c == 1:
    k = k.replace(old, new)
    print('[ok] §131.3 决议标注')
elif c == 0 and '已解决（v89.222）' in k:
    print('[skip] §131.3 已标注')
else:
    bad.append('§131.3 anchor count=%d' % c)

# ── ③ 技能：追加 §132 ──
if '## §132.' in k or '§132. 用例层' in k:
    print('[skip] §132 已在')
else:
    k = k.rstrip('\n') + '\n\n' + frag_132
    print('[ok] §132 追加')

if bad:
    print('❌ ' + ' / '.join(bad)); sys.exit(1)
if not DRY:
    wr(SKILL, k)
print('✅ v89.222 收尾落盘（skill %d 字符）' % len(k))
