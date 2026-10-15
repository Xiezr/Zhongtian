# -*- coding: utf-8 -*-
"""v89.223 探针 C：候选修改点完整原文 + smoke 守卫依赖 + 活工具明细。
运行: cd /e/Deepseekdb && python .workbuddy/tools/patch/probe_v89223c_final.py
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
        w('L%d| %s' % (i, lines[i - 1][:215]))
    w('')

# ---------- A 候选修改点 ----------
ctx('js/data.js', 2818, 2836, 'progression')
ctx('js/data.js', 965, 992, 'counter history')
ctx('js/data.js', 1025, 1064, 'target table')
ctx('js/domain.js', 3538, 3552, 'gather cmt')
ctx('js/tactic.js', 566, 582, 'atk chain')
ctx('js/tactic.js', 636, 654, 'ranged cls')
ctx('js/tactic.js', 993, 1012, 'bowbow')
ctx('js/questdata.js', 66, 84, 'g20')

# ---------- B smoke 关键段 ----------
ctx('smoke-test.js', 26888, 26924, 's151 check')
ctx('smoke-test.js', 34650, 34730, 's222 guard')
ctx('smoke-test.js', 32738, 32764, 's199 check')

# ---------- C 用例文件候选字符串引用 ----------
CANDS = ['弓弩扩充', '强弓劲弩', '补足弓手', '战象', '壁垒刀盾', '强弩之末', '史书纪事', '不弹窗',
         '弓箭兵', '枪找骑', '弓 220', '弓打弓', '龙枪兵', '枪盾', '弓弩']
w('===== C) smoke/e2e 候选字符串引用 =====')
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for c in CANDS:
            if c in ln:
                w('%s:%d [%s] %s' % (f, i, c, ln.strip()[:200]))
                break
w('')

# ---------- D 活工具目录明细（audit/gen/break/mem/asset/playtest/play） ----------
OLD = ['长枪', '枪兵', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '战象', '青州',
       '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '戟兵', '弩兵', '刀牌',
       '义兵', '民夫', '冲车', '云梯', '井阑', '床弩', '抛石', '府兵', '乡勇', '禁军',
       '御林', '校刀', '都督', '都尉', '刺史', '太守', '州城', '郡城', '县城',
       '州治', '郡治', '都城', '帝都', '州郡', '郡县', '史册', '故事集', '许都', '洛阳', '许昌', '邺城']
w('===== D) 活工具明细 =====')
for sd in ['audit', 'gen', 'break', 'mem', 'asset', 'playtest', 'play']:
    for f in sorted(glob.glob('.workbuddy/tools/%s/**/*.*' % sd, recursive=True)):
        if not f.replace('\\', '/').rsplit('.', 1)[-1] in ('js', 'py'):
            continue
        t = rd(f)
        hits = []
        for i, ln in enumerate(t.split('\n'), 1):
            for x in OLD:
                if x in ln:
                    hits.append('%s:%d [%s] %s' % (os.path.basename(f), i, x, ln.strip()[:170]))
                    break
        if hits:
            w('---- %s ----' % f)
            for h in hits[:10]:
                w('  ' + h)
w('')

# ---------- E v89216 补丁（装备名映射检查） ----------
import glob as g2
fs = sorted(g2.glob('.workbuddy/tools/patch/*v89216*'))
w('===== E) v89216 补丁文件 =====')
w(', '.join(os.path.basename(x) for x in fs))
for f in fs:
    t = rd(f)
    for key in ['壁垒', '刀盾', '装', '军装']:
        if key in t:
            w('HIT[%s] %s' % (key, f))
w('')

# ---------- F 其他面 ----------
w('===== F) 其他面 =====')
t = rd('.workbuddy/tools/README_INDEX.md')
if t:
    hits = [ln for ln in t.split('\n') if any(x in ln for x in OLD)]
    w('README_INDEX.md 命中 %d 行' % len(hits))
    for ln in hits[:20]:
        w('  ' + ln.strip()[:190])
for f in sorted(g2.glob('tools/**/*.py', recursive=True)):
    t = rd(f)
    c = sum(t.count(x) for x in OLD)
    w('root %s 命中 %d' % (f, c))
for pat in ['assets/**/*.js', 'assets/**/*.json', 'assets/**/*.txt', 'assets/**/*.md']:
    for f in sorted(g2.glob(pat, recursive=True)):
        t = rd(f)
        c = sum(t.count(x) for x in OLD)
        if c:
            w('asset %s 命中 %d' % (f, c))
w('')
t = rd('smoke-test.js')
for i, ln in enumerate(t.split('\n'), 1):
    if ('BUILD' in ln) or ('?v=' in ln) or ('8989' in ln):
        w('smoke BUILD/v: %d  %s' % (i, ln.strip()[:180]))
w('')
io.open('.workbuddy/tmp/probe223c.txt', 'w', encoding='utf-8', newline='').write('\n'.join(OUT))
print('probe223c.txt lines=%d' % len(OUT))
