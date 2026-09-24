# -*- coding: utf-8 -*-
"""v89.117 补丁 H5 —— e2e 两条 v21/v89.86 断言升级（军务总览 ⑤ 段）

① 「行军视图渲染伤兵营」：总览页 ⑤ 段改两营紧凑卡 ——
   判据从 `data-heal-host="view"`（woundedBlock 的标记）改为：
   两营都在 + 治疗键在 + 数量与治疗费仍可见（信息不丢，只是换了容器）。
② 「军务总览五段齐（… 伤兵）」：⑤ 段名义变为「⑤ 两营（伤兵 · 俘虏）」。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
P = R + 'e2e-test.js'
s = io.open(P, encoding='utf-8').read()

OLD1 = """  check('行军视图渲染伤兵营', marches21_v21.indexOf('伤兵营') >= 0
    && marches21_v21.indexOf('data-heal-host="view"') >= 0);"""
NEW1 = """  /* v89.117（老板「还是没有俘虏营或者降兵营…要让玩家看得到」）：
     军务总览 ⑤ 段改**两营并列紧凑卡**（不再是单独 woundedBlock 的 data-heal-host="view"）——
     判据随容器变：两营都在 + 治疗键在（信息与操作一个不少）。 */
  check('行军视图渲染**两营**（伤兵营 + 俘虏营）',
    marches21_v21.indexOf('伤兵营') >= 0 && marches21_v21.indexOf('俘虏营') >= 0
    && marches21_v21.indexOf('data-action="heal-wounded"') >= 0
    && marches21_v21.indexOf('camp-card') >= 0);"""
if s.count(OLD1) != 1:
    print('!! 段 1 匹配 %d' % s.count(OLD1)); sys.exit(1)
s = s.replace(OLD1, NEW1, 1)
print('  ✓ 段 1 行军视图两营')

OLD2 = """      check('v89.86（P-20）：军务总览五段齐（城内 / 驻守野地 / 采集队 / 行军 / 伤兵）',
        mv86.indexOf('① 城内') >= 0 && mv86.indexOf('② 驻守野地') >= 0 && mv86.indexOf('③ 采集队') >= 0
        && mv86.indexOf('④ 行军') >= 0 && mv86.indexOf('⑤ 伤兵') >= 0);"""
NEW2 = """      check('v89.86（P-20）：军务总览五段齐（城内 / 驻守野地 / 采集队 / 行军 / **两营**）',
        mv86.indexOf('① 城内') >= 0 && mv86.indexOf('② 驻守野地') >= 0 && mv86.indexOf('③ 采集队') >= 0
        && mv86.indexOf('④ 行军') >= 0 && mv86.indexOf('⑤ 两营') >= 0
        && mv86.indexOf('伤兵营') >= 0 && mv86.indexOf('俘虏营') >= 0);"""
if s.count(OLD2) != 1:
    print('!! 段 2 匹配 %d' % s.count(OLD2)); sys.exit(1)
s = s.replace(OLD2, NEW2, 1)
print('  ✓ 段 2 五段齐')

b = io.open(R + '.workbuddy/backup/v89117/e2e-test.js', encoding='utf-8').read()
print('  花括号净变化 %+d' % ((s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))))
tmp = P + '.tmp117h5'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('补丁 H5 完成')
