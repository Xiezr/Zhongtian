# -*- coding: utf-8 -*-
"""v89.236 清理轮：docs 全量分类扫描（只读）
输出三档：A=汉代风格残留 / B=评测评估材料 / C=现行文档
判据：
- A 汉代风格：命中 三国/汉代/江湖/门派/武林/武侠/异人/灵气/修仙 等词 且 废土痕迹少
  但注意：历轮交付文档（v89xxx）里出现"换皮前"的引述是正常史档，不算 A
- B 评测：文件名或内容含 测评/评测/评估/审查/推演/试玩报告
- C：其余
"""
import io, os, re

D = 'E:/Deepseekdb/docs'
HAN = ['三国', '汉代', '江湖', '门派', '武林', '武侠', '异人', '灵气', '修仙', '诸子', '百家',
       '热血三国', '魏蜀吴', '曹魏', '蜀汉', '东吴', '太守', '都城', '郡守', '县令', '招贤馆',
       '校场', '客栈', '城墙', '灵田', '灵脉', '功法', '武学', '游历', '门客', '幕僚']
FEI = ['废土', '余烬', '幸存者', '聚落', '重镇', '辖区', '生化', '机甲', '净水', '生物质']
EVAL = ['测评', '评测', '评估', '审查', '评价', '推演', '试玩报告', '复核报告']

rows = []
for f in sorted(os.listdir(D)):
    p = os.path.join(D, f)
    if not os.path.isfile(p) or not f.endswith('.md'):
        continue
    s = io.open(p, encoding='utf-8', errors='replace').read()
    head = s[:600]
    title = s.split('\n')[0].strip()[:60]
    han = sum(s.count(w) for w in HAN)
    fei = sum(s.count(w) for w in FEI)
    ev = any(w in f for w in EVAL) or any(w in head for w in EVAL)
    size = len(s)
    rows.append((f, title, han, fei, ev, size))

print('=' * 100)
print('A 档候选：汉代风格显著（汉语词 >> 废土词）且非 v89xxx 交付文档')
print('=' * 100)
for f, t, han, fei, ev, size in rows:
    is_v89 = bool(re.match(r'^v89\d{3}', f)) or f.startswith('v898') or f.startswith('v899')
    if han >= 30 and han > fei * 3 and not is_v89:
        print('  %-44s han=%-5d fei=%-4d eval=%-5s %dKB | %s' % (f, han, fei, ev, size // 1024, t))

print()
print('=' * 100)
print('B 档候选：评测/评估材料（含历轮 v89xxx 内的评测报告）')
print('=' * 100)
for f, t, han, fei, ev, size in rows:
    if ev:
        print('  %-44s han=%-5d fei=%-4d %dKB | %s' % (f, han, fei, size // 1024, t))

print()
print('=' * 100)
print('C 档：其余活文档（抽查前 60）')
print('=' * 100)
cnt = 0
for f, t, han, fei, ev, size in rows:
    is_v89 = bool(re.match(r'^v89\d{3}', f)) or f.startswith('v898') or f.startswith('v899')
    is_a = han >= 30 and han > fei * 3 and not is_v89
    if not is_a and not ev:
        cnt += 1
        if cnt <= 60:
            print('  %-44s han=%-5d fei=%-4d %dKB | %s' % (f, han, fei, size // 1024, t))
print()
print('总文件数:', len(rows), ' A档:', sum(1 for r in rows if r[2] >= 30 and r[2] > r[3] * 3 and not (re.match(r'^v89\d{3}', r[0]) or r[0].startswith('v898') or r[0].startswith('v899'))),
      ' B档:', sum(1 for r in rows if r[4]))
