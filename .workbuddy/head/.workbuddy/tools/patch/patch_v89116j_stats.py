# -*- coding: utf-8 -*-
"""v89.116 补丁 J：兵种数值梳理（老板需求 9）

探针（probe_v89116_stats.js）取证三类问题，按"只修客观错误"处置：
  ① **desc 与实际数值不符** 3 处（辎重车 / 投石车 / 西凉铁骑）——文案是客观错误，必改；
  ② **象兵没有任何克制关系**（全表唯一：COUNTER_ATK / COUNTER_DEF 里都不出现）
     —— 与 data.js 自述的原则（"同族里只有轻/铁被克，另三种变成'无弱点的骑兵'，关系会断裂"）
     自相矛盾；实测 长枪 600 人口 vs 象兵 600 人口 → 长枪全灭、象兵损 9，
     按同族口径把象兵并入"长枪克骑兵"两张表；
  ③ 突骑兵不在"刀盾挡箭"表 —— **实测刀盾已胜**（损 280 杀 300），不追加倍率，只在文档里留观测。
"""
import io, os, sys

R = 'E:/Deepseekdb/'


def main():
    p = R + 'js/data.js'
    s = io.open(p, encoding='utf-8').read()
    edits = []

    # ① desc 同步（三处）
    edits.append((
        """desc: '负重5000，专属运资' }""",
        """desc: '专属运资，负重冠绝全军' }""",
        '辎重车 desc'))
    edits.append((
        """desc: '攻800射程1600，攻城巨炮（工匠作坊制造）' }""",
        """desc: '攻950射程1600，攻城巨炮（工匠作坊制造）' }""",
        '投石车 desc'))
    edits.append((
        """desc: '攻450防400，攻守兼备' }""",
        """desc: '攻700防400，攻守兼备' }""",
        '西凉铁骑 desc'))

    # ② 象兵并入"长枪克骑兵"两张表 + 注释同步
    edits.append((
        """    changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },""",
        """    changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3,
      /* v89.116（老板「兵种数值是否有误，梳理」）：**南疆象兵**补进来 ——
         它是全表唯一"两张相克表都不出现"的战斗兵种（既不被克、也无克制），
         与下面那条自述原则直接矛盾（"同族里只有轻/铁被克，另三种变成无弱点的骑兵"）。
         实测（probe_v89116_stats）：各 600 人口，长枪全灭、象兵仅损 9 —— 名副其实"无弱点"。
         归入长枪的拒马口径（长枪阵本就是拒兽/拒骑的阵形），与其余五种骑兵同族同办。 */
      nanjiangxiangbing: 3 },""",
        '相克表 长枪→象兵'))
    edits.append((
        """    changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5 },""",
        """    changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5,
      nanjiangxiangbing: 5 },""",
        '相克表 象兵攻长枪'))

    for old, new, tag in edits:
        n = s.count(old)
        if n != 1:
            print('!! [%s] 匹配 %d 次 → 中止' % (tag, n))
            return 1
        s = s.replace(old, new, 1)
        print('  ✓ %s' % tag)

    b = io.open(R + '.workbuddy/backup/v89116/data.js', encoding='utf-8').read()
    d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
    if d0 != 0:
        print('!! 花括号净变化 %+d → 中止' % d0)
        return 1
    tmp = p + '.tmp116j'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
    print('  → 落盘 data.js（净 %+d）' % d0)
    print('补丁 J 完成')
    return 0


sys.exit(main())
