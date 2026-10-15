# -*- coding: utf-8 -*-
"""v89.233 批 3：语义描述改 —— 垂钓/行猎产出顺滑 · 旧钱→旧币 · analyze 正则对齐。

① data.js：垂钓「鱼→净水」与行猎「野味→净水」顺滑化（保留灵物"肥鱼"意象 + 补"活水"口径）；
② data.js：'掘出旧钱' → '掘出旧币'（货币统一批的连带）；
③ analyze_600.py：入侵损失正则仍搜旧资源名（粮食/木材/石料/铁锭）→ 假 0；
   改逐资源独立查找（消息只带非零项、顺序不保证）+ 输出标签去「金」。
"""
import io

R = 'E:/Deepseekdb/'
LOG = []


def rep(path, tag, old, new, cnt=1):
    p = R + path
    s = io.open(p, encoding='utf-8', newline='').read()
    c = s.count(old)
    assert c == cnt, '%s · %s count=%d want=%d' % (path, tag, c, cnt)
    s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    LOG.append('[ok] %s · %s' % (path, tag))


# ① 垂钓：desc + 两条产水 outcome（保留"肥鱼"；补"活水"口径）
rep('js/data.js', 'lake-desc',
    "desc: '泽畔垂钓：肥鱼入篓，偶得水中沉物。',",
    "desc: '泽畔垂钓：肥鱼入篓，活水同汲；偶得水中沉物。',")
rep('js/data.js', 'lake-o1',
    "{ w: 44, t: '肥鱼入篓', grain: [800, 2000] }",
    "{ w: 44, t: '肥鱼入篓，活水同汲', grain: [800, 2000] }")
rep('js/data.js', 'lake-o2',
    "{ w: 22, t: '杂鱼数尾', grain: [200, 600] }",
    "{ w: 22, t: '杂鱼数尾，几瓢活水', grain: [200, 600] }")

# ② 行猎：desc + 产水 outcome（补"山泉"口径）
rep('js/data.js', 'forest-desc',
    "desc: '入林行猎：白鹿灵迹出没之地，皮毛物资俱是军资，亦可得野味。',",
    "desc: '入林行猎：白鹿灵迹出没之地，皮毛物资俱是军资，野味与山泉俱得。',")
rep('js/data.js', 'forest-o',
    "{ w: 22, t: '猎得野味', grain: [500, 1500] }",
    "{ w: 22, t: '猎得野味，寻得山泉', grain: [500, 1500] }")

# ③ 旧钱 → 旧币
rep('js/data.js', 'oldcoin',
    "{ w: 18, t: '掘出旧钱', gold: [1500, 4000] }",
    "{ w: 18, t: '掘出旧币', gold: [1500, 4000] }")

# ④ analyze_600.py 入侵损失正则与标签
rep('.workbuddy/tools/playtest/analyze_600.py', 'inv-regex',
    """pat = re.compile(r'粮食 −([\\d.万亿]+)、木材 −([\\d.万亿]+)、石料 −([\\d.万亿]+)、铁锭 −([\\d.万亿]+)、旧币 −([\\d.万亿k]+)')
def num(sx):
    m = re.match(r'([\\d.]+)([万亿k]?)', sx or '')
    if not m: return 0
    v = float(m.group(1)); u = m.group(2)
    return v * (1e4 if u == '万' else 1e8 if u == '亿' else 1e3 if u == 'k' else 1)
tot = [0, 0, 0, 0, 0]
for e in inv_hit:
    m = pat.search(e.get('msg', ''))
    if m:
        for i in range(5): tot[i] += num(m.group(i + 1))
w('- 被破累计损失：净水 %s · 生物质 %s · 电能 %s · 废钢 %s · 金 %s' % tuple(fmt(x) for x in tot))""",
    """# v89.233：产品日志随资源/货币换代（粮食/木材/石料/铁锭 → 净水/生物质/电能/废钢）；
# 且消息只带「非零项」、顺序由对象键序决定 —— 固定序整段匹配必假 0，改逐资源独立查找。
def num(sx):
    sx = (sx or '').strip()
    u = ''
    if sx.endswith('万'): u = '万'; sx = sx[:-1]
    elif sx.endswith('亿'): u = '亿'; sx = sx[:-1]
    elif sx.endswith('k'): u = 'k'; sx = sx[:-1]
    v = float((sx.replace(',', '') or '0'))
    return v * (1e4 if u == '万' else 1e8 if u == '亿' else 1e3 if u == 'k' else 1)
def grabn(msg, name):
    m = re.search(re.escape(name) + r' −([\\d,.]+[万亿k]?)', msg or '')
    return num(m.group(1)) if m else 0
tot = [sum(grabn(e.get('msg', ''), n) for e in inv_hit) for n in ['净水', '生物质', '电能', '废钢', '旧币']]
w('- 被破累计损失：净水 %s · 生物质 %s · 电能 %s · 废钢 %s · 旧币 %s' % tuple(fmt(x) for x in tot))""")

print('\n'.join(LOG))
print('done')
