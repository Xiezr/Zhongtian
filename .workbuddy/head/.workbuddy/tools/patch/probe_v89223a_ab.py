# -*- coding: utf-8 -*-
"""v89.223 探针 A：兵牌简称（ab）现状 + 产品侧旧词粗扫 + 工具目录计数。
运行: cd /e/Deepseekdb && python .workbuddy/tools/patch/probe_v89223a_ab.py
输出: .workbuddy/tmp/probe223a.txt
"""
import io, re, glob, os, time

def rd(p):
    try:
        return io.open(p, encoding='utf-8', newline='').read()
    except Exception:
        return ''

OUT = []
def w(x=''):
    OUT.append(str(x))

w('probe v89.223a  @ ' + time.strftime('%H:%M:%S'))
w('')

# ---------- 0 目录结构 ----------
w('===== 0) 目录结构 =====')
w('root: ' + ', '.join(sorted(os.listdir('.'))))
for d in ['js', 'css', 'docs', '.workbuddy/tools']:
    if os.path.isdir(d):
        names = sorted(os.listdir(d))
        w('%s (%d): %s' % (d, len(names), ', '.join(names[:70])))
for d in ['.workbuddy/tools/patch', '.workbuddy/tools/probe', '.workbuddy/tools/qa',
          '.workbuddy/tools/gen', '.workbuddy/tools/git', '.workbuddy/tools/check']:
    if os.path.isdir(d):
        names = sorted(os.listdir(d))
        w('%s (%d): %s' % (d, len(names), ', '.join(names[:90])))
if os.path.isdir('.workbuddy/backup'):
    w('backup 最近 8: ' + ', '.join(sorted(os.listdir('.workbuddy/backup'))[-8:]))
w('')

# ---------- 1 TROOPS 区块 ----------
w('===== 1) js/data.js TROOPS 区块 =====')
s = rd('js/data.js')
hitlines = [i + 1 for i, ln in enumerate(s.split('\n')) if 'TROOPS' in ln]
w('TROOPS 出现行: %s' % hitlines[:15])
m = re.search(r"TROOPS\s*[:=]\s*\[", s)
if m:
    j = m.start()
    seg = s[j:j + 9000]
    k = seg.find('\n];')
    w(seg[:(k + 3) if k >= 0 else 9000])
else:
    w('!! 未找到 TROOPS 数组定义')
w('')

# ---------- 1b ab 值逐行 ----------
w('===== 1b) ab 值逐行 =====')
for i, ln in enumerate(s.split('\n'), 1):
    if re.search(r"ab\s*:", ln):
        w('data.js:%d  %s' % (i, ln.strip()[:220]))
abs_ = re.findall(r"ab\s*:\s*['\"]([^'\"]*)['\"]", s)
w('ab 值序列: %r' % abs_)
w('数量=%d 去重=%d%s' % (len(abs_), len(set(abs_)),
                       ' ！！有重复' if len(abs_) != len(set(abs_)) else ''))
w('')

files2 = sorted(glob.glob('js/*.js')) + ['index.html', 'smoke-test.js', 'e2e-test.js']

# ---------- 2 ab 消费点 ----------
w('===== 2) ab / troopAbOf 消费点（js + index + 用例） =====')
for f in files2:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        hit = ('troopAbOf' in ln) or re.search(r"\.ab\b", ln) or re.search(r"\[\s*'ab'\s*\]", ln) \
              or re.search(r"\bab\s*:", ln) or re.search(r"\{\s*ab\s*\}", ln)
        if hit:
            w('%s:%d  %s' % (f, i, ln.strip()[:200]))
w('')

# ---------- 3 旧简称字面量 ----------
w('===== 3) 旧简称作为字面量出现（排除 data.js 定义行） =====')
old_set = sorted(set(x for x in abs_ if len(x) == 1))
w('旧字集合: %s' % ''.join(old_set))
for f in files2:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for c in old_set:
            if ("'" + c + "'") in ln or ('"' + c + '"') in ln:
                if f == 'js/data.js' and re.search(r"ab\s*:", ln):
                    continue
                w('%s:%d [%s]  %s' % (f, i, c, ln.strip()[:200]))
                break
w('')

# ---------- 4 版本号 ----------
w('===== 4) 版本号 =====')
for f in ['js/main.js', 'index.html']:
    t = rd(f)
    n = 0
    for i, ln in enumerate(t.split('\n'), 1):
        if 'VERSION' in ln or '?v=' in ln:
            w('%s:%d  %s' % (f, i, ln.strip()[:180]))
            n += 1
            if n > 40:
                w('...（截断）')
                break
w('')

# ---------- 5 产品侧旧词粗扫 ----------
OLD = ['长枪', '枪兵', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '战象', '青州',
       '刀盾', '藤甲', '投石', '弓兵', '弓箭', '弓手', '戟兵', '弩兵', '刀牌',
       '义兵', '民夫', '冲车', '云梯', '井阑', '床弩', '抛石', '府兵', '乡勇', '禁军',
       '御林', '校刀', '都督', '都尉', '刺史', '太守', '州城', '郡城', '县城',
       '州治', '郡治', '都城', '帝都', '许都', '邺城', '许昌', '京都', '王城',
       '州郡', '郡县', '史册', '故事集', '列传', '编年', '起居注']
w('===== 5) 产品侧旧词粗扫（js/* + index.html + css） =====')
prod = sorted(glob.glob('js/*.js')) + sorted(glob.glob('css/*.css')) + ['index.html']
for f in prod:
    t = rd(f)
    for i, ln in enumerate(t.split('\n'), 1):
        for word in OLD:
            if word in ln:
                w('%s:%d (%s) %s' % (f, i, word, ln.strip()[:190]))
                break
w('')

# ---------- 6 工具目录计数 ----------
w('===== 6) 工具目录旧词计数（仅列有命中文件 top70） =====')
cnt = {}
tool_files = glob.glob('.workbuddy/tools/**/*.py', recursive=True) + \
             glob.glob('.workbuddy/tools/**/*.js', recursive=True)
for f in tool_files:
    t = rd(f)
    c = sum(t.count(word) for word in OLD)
    if c:
        cnt[f] = c
for f, c in sorted(cnt.items(), key=lambda x: -x[1])[:70]:
    w('%5d  %s' % (c, f))
w('工具文件总数=%d 有旧词文件数=%d' % (len(tool_files), len(cnt)))
w('')

# ---------- 7 smoke 段定位与尾部 ----------
w('===== 7) smoke 段定位 / 头部 harness / 尾部 =====')
t = rd('smoke-test.js')
tl = t.split('\n')
w('总行数=%d' % len(tl))
for i, ln in enumerate(tl, 1):
    st = ln.strip()
    if re.search(r'§22[23]', st):
        w('L%d  %s' % (i, st[:170]))
w('---- smoke 头 36 行 ----')
for ln in tl[:36]:
    w(ln[:170])
w('---- smoke 尾部 12 行 ----')
for ln in tl[-12:]:
    w(ln[:170])
w('')

io.open('.workbuddy/tmp/probe223a.txt', 'w', encoding='utf-8', newline='').write('\n'.join(OUT))
print('probe223a.txt written, lines=%d' % len(OUT))
