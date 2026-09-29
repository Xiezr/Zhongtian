# v89.176 档案数字同步：预测对账最终口径（81.7% / 62.5%）
import io

p = 'E:/Deepseekdb/需求档案.md'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    c = s.count(old)
    assert c == 1, tag + ' 命中 ' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

rep('对账召回 95.6%',
    '对账精确率 81.7%',
    '总览行')

rep('**召回 95.6%**（不漏报）· 精确率 57.5%——多报主因 =\n  「零伤开火不产生战报事件」+ 推演不模拟击杀（预警口径：宁多勿漏）。',
    '**精确率 81.7%**（判"将开火"准）· 召回 62.5%——对账基准 = "产生伤亡的开火口令"；\n  零伤交火不产生战报事件、且推演不模拟击杀（目标切换后够不着），故该值为**对账下界**；\n  口径取舍：曾对比"行动时刻版"（精确 81.7%/召回 62.5%）与"最终位置版"（两轮推演）——\n  取后者（见 contactForecast 注释），可见交火不漏标、纯零伤对射不承诺。',
    '③ 段')

rep('接敌预测**不模拟攻击致死**（"预告"不是"保证"）：精确率 57.5% 的偏差已量化，界面角标口径 = 宁多勿漏；',
    '接敌预测**不模拟攻击致死**（"预告"不是"保证"）：精确率 81.7% / 召回 62.5% 已量化（对账基准 = 有伤亡开火），\n  界面角标 = 见角标即"将交手"；',
    '⑤ 段')

io.open(p, 'w', encoding='utf-8', newline='').write(s)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert '95.6' not in chk.split('## v89.176')[1].split('## v89.177')[0] if '## v89.177' in chk else True
assert '81.7' in chk and '62.5' in chk
assert chk.count('## v89.176') == 1
print('NUMBERS-SYNCED')
