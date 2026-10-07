# -*- coding: utf-8 -*-
# v89.229 探针 B：兵种体系全貌（18 现状 → 14 目标）
import io, re
BASE = 'E:/Deepseekdb/'
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()

d = rd('js/data.js')

print('=' * 30, 'B1 DATA.TROOPS 全表', '=' * 30)
i = d.find('DATA.TROOPS = {')
j = d.find('\n  };', i)
seg = d[i:j]
# 逐条抓 id/cat/name 与属性字段
for m in re.finditer(r"^    (\w+):\s*\{([^\n]*(?:\n(?!^    \w+:)[^\n]*)*)", seg, re.M):
    tid, body = m.group(1), m.group(2)
    nm = re.search(r"name: '([^']+)'", body)
    cat = re.search(r"cat: '([^']+)'", body)
    ab = re.search(r"ab: '([^']+)'", body)
    print('  %-14s cat=%-10s ab=%-3s %s' % (tid, cat.group(1) if cat else '?', ab.group(1) if ab else '?', nm.group(1) if nm else '?'))

print()
print('=' * 30, 'B2 关键字段全量（逐兵种一行短摘要）', '=' * 30)
for m in re.finditer(r"^    (\w+):\s*\{([^\n]*(?:\n(?!^    \w+:)[^\n]*)*)", seg, re.M):
    tid, body = m.group(1), m.group(2)
    keys = re.findall(r"(\w+):", body)
    kv = dict(re.findall(r"(\w+):\s*([^,\n]+)", body))
    keep = {k: kv.get(k) for k in ['name', 'cat', 'atk', 'def', 'hp', 'spd', 'range', 'pop', 'up', 'upTo', 'tier', 'lvNeed', 'cost'] if k in kv}
    print('  %-14s %s' % (tid, str(keep)[:190]))

print()
print('=' * 30, 'B3 派生表：TROOP_ORDER / 分类 / 建筑产兵', '=' * 30)
for key in ['TROOP_ORDER', 'TROOP_CATS', 'CAT_CN', 'TROOP_CAT']:
    k = d.find('DATA.' + key)
    if k >= 0:
        print('  DATA.%s 在 JS 第 %d 行附近' % (key, d[:k].count('\n') + 1))
        print('     ' + d[k:k + 260].split('\n')[0][:200])
# 建筑产兵
print()
print('  -- BUILDINGS 里的 troops 字段 --')
b = rd('js/data.js')
for m in re.finditer(r"id: '(\w+)', series: '(\w+)', name: '([^']+)'([^\n]*(?:\n(?!^    \w+:)[^\n]*)*)", b):
    if 'troop' in m.group(4):
        t = re.search(r"troop[s]?:\s*([^\n]+)", m.group(4))
        print('   %-14s %s → %s' % (m.group(1), m.group(3), t.group(1)[:110] if t else '?'))

print()
print('=' * 30, 'B4 升级链（up/upTo 或 lv 链）', '=' * 30)
for w in ['upTo', 'up:', 'upgradeTo', 'chain']:
    c = seg.count(w)
    if c: print('  TROOPS 内 %s ×%d' % (w, c))
# 训练上限/解锁
print()
print('  -- 训练相关出口 --')
u = rd('js/ui.js')
for m in re.finditer(r"(trainLimitOf|canTrain|troopUnlock|TRAIN_)\w*[^\n]*", d + '\n' + u):
    pass
for fn in ['trainLimitOf', 'canTrain', 'TRAIN']:
    for m in re.finditer(r"[^\n]*" + fn + r"[^\n]*", d):
        s = m.group(0).strip()
        if 'function' in s or ':' in s[:60]:
            print('   data: %s' % s[:150])
            break
