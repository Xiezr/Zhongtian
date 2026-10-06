# -*- coding: utf-8 -*-
"""v89.223 探针 B：上下文取证 + 产品广扫 + 工具目录分类 + 版本线索。
运行: cd /e/Deepseekdb && python .workbuddy/tools/patch/probe_v89223b_ctx.py
输出: .workbuddy/tmp/probe223b.txt
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

def ctx(f, a, b, tag=''):
    t = rd(f)
    if not t:
        w('!! missing %s' % f)
        return
    lines = t.split('\n')
    w('===== [%s] %s:%d-%d =====' % (tag, f, a, b))
    for i in range(max(1, a), min(len(lines), b) + 1):
        w('L%d| %s' % (i, lines[i - 1][:210]))
    w('')

# ---------- A 上下文 ----------
ctx('js/data.js', 1012, 1020, '战报实录引语')
ctx('js/data.js', 3004, 3011, '太守系沿革')
ctx('js/data.js', 3856, 3870, '史册注释')
ctx('js/data.js', 5088, 5098, '壁垒刀盾')
ctx('js/icons.js', 1041, 1048, '迫击炮注释')
ctx('js/icons.js', 1106, 1114, '战象注释')
ctx('js/questdata.js', 150, 160, '弓手任务')
ctx('js/state.js', 3092, 3100, '史册记账')
ctx('js/tactic.js', 356, 368, '龙枪兵')
ctx('index.html', 4226, 4258, '导航注释')
ctx('index.html', 3112, 3119, '史册样式注释')
ctx('js/main.js', 2794, 2801, '史册续号')
ctx('smoke-test.js', 26872, 26890, '§129③')

# ---------- B 广扫 ----------
OLD = ['长枪', '枪兵', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '战象', '青州',
       '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '戟兵', '弩兵', '刀牌',
       '义兵', '民夫', '冲车', '云梯', '井阑', '床弩', '抛石', '府兵', '乡勇', '禁军',
       '御林', '校刀', '都督', '都尉', '刺史', '太守', '州城', '郡城', '县城',
       '州治', '郡治', '都城', '帝都', '州郡', '郡县', '州界', '郡界', '辎重车', '弓骑', '龙枪',
       '史册', '故事集', '司隶', '洛阳', '许昌', '邺城', '宛县', '京都', '王城', '长安', '建业', '襄阳']
FILES = sorted(glob.glob('js/*.js')) + ['index.html', 'DESIGN.md', 'audit.js']
w('===== B) 广扫（产品侧） =====')
n = 0
for f in FILES:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for word in OLD:
            if word in ln:
                w('%s:%d [%s] %s' % (f, i, word, ln.strip()[:200]))
                n += 1
                break
w('小计 %d 行' % n)
w('')

# ---------- B2 单字扫描 ----------
CH = ['弓', '枪', '戟', '辎', '藤', '豹', '凉', '驽']
w('===== B2) 单字扫描（js/*） =====')
n = 0
for f in sorted(glob.glob('js/*.js')):
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for c in CH:
            if c in ln:
                w('%s:%d [%s] %s' % (f, i, c, ln.strip()[:200]))
                n += 1
                break
w('小计 %d 行' % n)
w('')

# ---------- C 工具目录分类 ----------
w('===== C) 工具目录（按子目录聚合） =====')
sub = {}
tf = glob.glob('.workbuddy/tools/**/*.py', recursive=True) + glob.glob('.workbuddy/tools/**/*.js', recursive=True)
for f in tf:
    t = rd(f)
    c = sum(t.count(x) for x in OLD)
    parts = f.replace('\\', '/').split('/')
    key = parts[2] if len(parts) > 2 else 'root'
    d = sub.setdefault(key, [0, 0])
    d[0] += 1
    if c:
        d[1] += 1
for k in sorted(sub):
    w('%-10s 文件 %4d · 含旧词 %4d' % (k, sub[k][0], sub[k][1]))
w('')
w('---- 非 patch 子目录的旧词文件 top40 ----')
non = []
for f in tf:
    if '/patch/' in f.replace('\\', '/'):
        continue
    c = sum(rd(f).count(x) for x in OLD)
    if c:
        non.append((f, c))
for f, c in sorted(non, key=lambda x: -x[1])[:40]:
    w('%5d  %s' % (c, f))
w('非 patch 命中文件 %d' % len(non))
w('')

# ---------- D 版本/工具线索 ----------
w('===== D) 版本与断言线索 =====')
for f in ['smoke-test.js', 'index.html', 'js/main.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        if '8989' in ln or 'GAME.VERSION' in ln:
            w('%s:%d  %s' % (f, i, ln.strip()[:180]))
w('')
w('---- bt-rnm / troopAbOf 在工具目录的引用 ----')
for f in glob.glob('.workbuddy/tools/**/*.js', recursive=True) + glob.glob('.workbuddy/tools/**/*.py', recursive=True):
    t = rd(f)
    if 'bt-rnm' in t or 'troopAbOf' in t:
        w('hit: %s' % f)
w('')
w('---- tools 各子目录清单 ----')
for d in ['.workbuddy/tools/break', '.workbuddy/tools/mem', '.workbuddy/tools/play', '.workbuddy/tools/playtest', '.workbuddy/tools/asset']:
    if os.path.isdir(d):
        names = sorted(os.listdir(d))
        w('%s (%d): %s' % (d, len(names), ', '.join(names[:40])))
w('')
sh = sorted(os.listdir('.workbuddy/tools/show')) if os.path.isdir('.workbuddy/tools/show') else []
w('tools/show 最近 46:')
w(', '.join(sh[-46:]))
w('')
w('---- root tools/ 与 backup/ ----')
for d in ['tools', 'backup']:
    if os.path.isdir(d):
        w('%s/: %s' % (d, ', '.join(sorted(os.listdir(d))[:30])))
w('')
w('---- icons.js 中带「原」的注释 ----')
t = rd('js/icons.js')
for i, ln in enumerate(t.split('\n'), 1):
    if '原' in ln and ('/*' in ln or ln.lstrip().startswith('*')):
        w('icons.js:%d  %s' % (i, ln.strip()[:190]))
w('')

io.open('.workbuddy/tmp/probe223b.txt', 'w', encoding='utf-8', newline='').write('\n'.join(OUT))
print('probe223b.txt lines=%d' % len(OUT))
