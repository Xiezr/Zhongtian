# -*- coding: utf-8 -*-
"""v89.223 终态残留验证：产品侧（js/+index.html）旧词分布 = 预期保留面？
运行: python scan_v89223_verify.py
"""
import io, glob

def rd(p):
    try:
        return io.open(p, encoding='utf-8', newline='').read()
    except Exception:
        return ''

OLD = ['长枪', '枪兵', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '战象', '青州',
       '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '戟兵', '弩兵', '刀牌',
       '义兵', '民夫', '冲车', '云梯', '井阑', '床弩', '抛石', '府兵', '乡勇', '禁军',
       '御林', '校刀', '都督', '都尉', '刺史', '太守', '州城', '郡城', '县城',
       '州治', '郡治', '都城', '帝都', '州郡', '郡县', '史册', '故事集',
       '许都', '邺城', '许昌', '洛阳', '司隶', '宛县']
KEEP_HINTS = {
    '沿革/退役注': ['原', 'v89.218', 'v89.216', '退役', '留档'],
    '概念/习语/名称': ['枪阵', '拒马', '投石问路', '投石其中', '银枪', '双枪', '枪克', '龙枪', '枪找'],
}

print('==== 产品侧（js/* + index.html）旧词命中明细 ====')
n = 0
for f in sorted(glob.glob('js/*.js')) + ['index.html']:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for w in OLD:
            if w in ln:
                n += 1
                print('%s:%d [%s] %s' % (f, i, w, ln.strip()[:150]))
                break
print('小计 %d 行' % n)
print()

print('==== 用例文件（smoke/e2e）旧 ab 单字在 ab 语境的命中 ====')
OLD_AB = list('枪弓轻铁辎冲投青藤虎西象义')
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    hits = 0
    for i, ln in enumerate(t.split('\n'), 1):
        if '§223-guard' in ln:
            print('%s: 进入 §223 守卫段（其 OLD223 词表与注释含旧字 —— 设计使然，跳过）' % f)
            break
        for c in OLD_AB:
            if c in ln and ('bt-rnm' in ln or 'troopAb' in ln or '简称' in ln):
                hits += 1
                print('%s:%d [%s] %s' % (f, i, c, ln.strip()[:150]))
    print('%s: ab 语境旧字命中 %d' % (f, hits))

print()
print('==== 活工具（audit/asset/play/playtest）夹具残留 ====')
for f in sorted(glob.glob('.workbuddy/tools/audit/*.js') + glob.glob('.workbuddy/tools/asset/*.js')
                + glob.glob('.workbuddy/tools/play/*.js') + glob.glob('.workbuddy/tools/playtest/*.js')):
    t = rd(f)
    for w in ["cityName: '许都'", '义兵', '民夫', '铁骑']:
        c = t.count(w)
        if c and 'namescan' not in f:
            print('%s [%s] x%d' % (f, w, c))
print('（空 = 活工具夹具已全同步；namescan/risk 为扫描器词表，设计保留）')
