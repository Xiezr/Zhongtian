# -*- coding: utf-8 -*-
"""v89.223 探针 D：ab 镜像全量扫描 + 保留/修改判定所需的最后取证。
运行: cd /e/Deepseekdb && python .workbuddy/tools/patch/probe_v89223d_mirror.py
"""
import io, re, glob, os

def rd(p):
    try:
        return io.open(p, encoding='utf-8', newline='').read()
    except Exception:
        return ''

OUT = []
def w(x=''):
    OUT.append(str(x))

# ---------- 1 ab 镜像扫描（smoke/e2e） ----------
OLD_AB = list('枪弓轻铁辎冲投青藤虎西象义')
CTX = ['bt-rnm', 'troopAb', '简称', '兵牌']
w('== 1) 旧简称字符 × ab 语境的命中（smoke/e2e） ==')
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for c in OLD_AB:
            if c in ln and any(k in ln for k in CTX):
                w('%s:%d [%s] %s' % (f, i, c, ln.strip()[:200]))
                break
w('')
w('== 1b) >X< 形态（任意位置） ==')
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for c in OLD_AB:
            if ('>' + c + '<') in ln:
                w('%s:%d [%s] %s' % (f, i, c, ln.strip()[:200]))
                break
w('')

# ---------- 2 概念词计数（决定保留面） ----------
w('== 2) 概念词/保留面计数（js/*） ==')
for kw in ['枪阵', '拒马', '枪克', '龙枪', '枪找', '枪胜', '骑胜', '弓打弓', '枪盾', '战象', '投石车', '太守系']:
    cnt = 0
    locs = []
    for f in sorted(glob.glob('js/*.js')) + ['index.html', 'smoke-test.js', 'e2e-test.js']:
        t = rd(f)
        c = t.count(kw)
        if c:
            cnt += c
            for i, ln in enumerate(t.split('\n'), 1):
                if kw in ln:
                    locs.append('%s:%d' % (os.path.basename(f), i))
    w('%-6s x%-3d  %s' % (kw, cnt, ', '.join(locs[:10])))
w('')

# ---------- 3 icons 枪阵 上下文 ----------
t = rd('js/icons.js')
lines = t.split('\n')
w('== 3) icons.js 230-272 ==')
for i in range(230, 273):
    w('L%d| %s' % (i, lines[i - 1][:200]))
w('')
w('== 3b) js/data.js beast 标记 ==')
d = rd('js/data.js')
for i, ln in enumerate(d.split('\n'), 1):
    if 'beast' in ln:
        w('data.js:%d  %s' % (i, ln.strip()[:200]))
w('')
w('== 3c) 大都督兵法 / 守御刀盾 是否在现行数据 ==')
for kw in ['大都督兵法', '守御刀盾', '守御骏马', '大都督']:
    hits = []
    for f in sorted(glob.glob('js/*.js')):
        t2 = rd(f)
        if kw in t2:
            hits.append(f)
    w('%s: %s' % (kw, hits or '（无）'))
w('')

# ---------- 4 index.html 178-190 + gold-line usage ----------
h = rd('index.html')
hl = h.split('\n')
w('== 4) index.html 178-190 ==')
for i in range(178, 191):
    w('L%d| %s' % (i, hl[i - 1][:200]))
w('--gold-line 出现 %d 次' % h.count('--gold-line'))
w('')

# ---------- 5 smoke BUILD 检查体 ----------
w('== 5) smoke BUILD/v 检查体（12310-12342） ==')
tl = rd('smoke-test.js').split('\n')
for i in range(12310, 12343):
    w('L%d| %s' % (i, tl[i - 1][:200]))
w('')

# ---------- 6 需求档案关键词核对 ----------
w('== 6) 需求档案关键词 ==')
a = rd('需求档案.md')
for kw in ['弓打弓', '弓手', '弓弩', '枪找骑', '龙枪兵', '壁垒刀盾', '强弩之末', '战象', '兵牌简称', '干']:
    c = a.count(kw)
    w('%s x%d' % (kw, c))
w('')

# ---------- 7 其他可能引用点 ----------
w('== 7) questdata 标题在别处引用 ==')
for kw in ['弓弩之利', '弓弩扩充', '强弩之末', '强弓劲弩']:
    hits = []
    for f in sorted(glob.glob('js/*.js')) + ['smoke-test.js', 'e2e-test.js', 'index.html']:
        t2 = rd(f)
        if kw in t2:
            hits.append('%s:%s' % (os.path.basename(f), ','.join(str(x) for x in [i for i, ln in enumerate(t2.split('\n'), 1) if kw in ln][:3])))
    w('%s: %s' % (kw, hits or '（无）'))
w('')
io.open('.workbuddy/tmp/probe223d.txt', 'w', encoding='utf-8', newline='').write('\n'.join(OUT))
print('probe223d.txt lines=%d' % len(OUT))
