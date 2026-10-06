# -*- coding: utf-8 -*-
"""v89.220 补丁 A：温室农场 → 基因实验室（老板 1）。

范围：全仓（js 6 文件 + index.html + smoke + e2e）；历史补丁脚本与需求档案**不动**。
顺序：① 含 emoji 的短语先定向（🌾 是资源/采集/野地等图标的重度复用词，只换"温室农场"那几处）
      ② 剩余纯文本全量替换 ③ 长句语义顺化 ④ 留命名沿革注释。
"""
import io, os, sys
R = 'E:/Deepseekdb/'

def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

FILES = ['js/data.js', 'js/domain.js', 'js/battle.js', 'js/state.js', 'js/ui.js',
         'js/systems.js', 'js/main.js', 'index.html', 'smoke-test.js', 'e2e-test.js']

# ① 含 emoji 的短语（定向，4 处）
EMOJI_OLD, EMOJI_NEW = '🌾 温室农场', '🧬 基因实验室'
print('== ① emoji 短语 ==')
tot1 = 0
for f in FILES:
    p = R + f
    s = rd(p)
    c = s.count(EMOJI_OLD)
    if c:
        s = s.replace(EMOJI_OLD, EMOJI_NEW)
        wr(p, s)
        print('  %-14s x%d' % (f, c)); tot1 += c
print('  合计 %d 处' % tot1)
assert tot1 == 4, 'emoji 短语预期 4 处，实得 %d' % tot1

# ①b 图标族注释里的 🌾（政务厅四按钮的图标族说明）
rep_u = R + 'js/ui.js'
s = rd(rep_u)
old = '图标统一 emoji 族（📝 / 🏛 / 🌾）'
assert s.count(old) == 1, 'ui 图标族注释 count=%d' % s.count(old)
wr(rep_u, s.replace(old, '图标统一 emoji 族（📝 / 🏛 / 🧬）'))
print('  ui.js 图标族注释 x1')

# ② 剩余纯文本全量替换
print('== ② 纯文本全量 ==')
tot2 = 0
for f in FILES:
    p = R + f
    s = rd(p)
    c = s.count('温室农场')
    if c:
        s = s.replace('温室农场', '基因实验室')
        wr(p, s)
        print('  %-14s x%d' % (f, c)); tot2 += c
print('  合计 %d 处' % tot2)

# ③ 长句语义顺化
print('== ③ 长句顺化 ==')
S3 = [
    ('js/ui.js',
     '基因实验室：个人田庄灵田种作物，收高阶打造材料与资质药草',
     '基因实验室：培育菌种与作物，收高阶打造材料与资质药草'),
    ('js/ui.js',
     "'个人田庄 · 六块灵田　种子由采集/征战获得，也可直接购买；生长走游戏时间'",
     "'个人实验室 · 六块培养槽　种子由采集/征战获得，也可直接购买；生长走游戏时间'"),
    ('js/data.js',
     '寻常作物之种：于基因实验室可种 6 种材料作物',
     '寻常作物之种：于基因实验室可培养 6 种材料作物'),
]
for f, old, new in S3:
    p = R + f
    s = rd(p)
    c = s.count(old)
    assert c == 1, '%s count=%d | %s' % (f, c, old[:40])
    wr(p, s.replace(old, new))
    print('  %-14s ok | %s' % (f, old[:36]))

# ④ 命名沿革注释（openFarm 段头）
p = R + 'js/ui.js'
s = rd(p)
old = """   * 基因实验室（v73 · 老板需求 3）：政务厅 → 另一个菜单"""
new = """   * 基因实验室（v73 立 · v89.220 老板拍板改名）：政务厅 → 另一个菜单
   *   ⚠ 命名沿革：种田秘境（v89.216 前）→ 温室农场（v89.216）→ 基因实验室（v89.220）。"""
assert s.count(old) == 1, 'openFarm 段头 count=%d' % s.count(old)
wr(p, s.replace(old, new))
print('  沿革注释 ok')

# ⑤ 写后核对：剥注释后"温室"应为 0（沿革注释除外）
print('== ⑤ 核对 ==')
import re
bad = []
for f in FILES:
    s = rd(R + f)
    s2 = re.sub(r'/\*[\s\S]*?\*/', '', s)
    s2 = re.sub(r'<!--[\s\S]*?-->', '', s2)
    s2 = re.sub(r'(^|[^:\\\\])//[^\n]*', r'\1', s2)
    n = s2.count('温室')
    if n:
        bad.append('%s 剥注释后残留 %d' % (f, n))
if bad:
    print('  ⚠ ' + '；'.join(bad))
else:
    print('  ✅ 剥注释后"温室"零残留（沿革注释里的保留）')
print('DONE')
