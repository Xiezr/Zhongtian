# -*- coding: utf-8 -*-
"""v89.232 取证：S1 漏网逐处上下文 dump"""
import io

R = 'E:/Deepseekdb/'
JOBS = [
    ('js/data.js', 1650, 20, '建筑专精描述'),
    ('js/data.js', 3480, 12, '巡政/征调'),
    ('js/data.js', 3878, 12, '陷阵？'),
    ('js/data.js', 3905, 22, '季节天气'),
    ('js/data.js', 4003, 8, '侦察叙事'),
    ('js/data.js', 4380, 10, '垂钓'),
    ('js/data.js', 4412, 10, '行猎'),
    ('js/data.js', 4526, 10, '棋局'),
    ('js/data.js', 5168, 12, '壁垒刀盾'),
    ('js/ui.js', 7600, 46, '派系面板'),
    ('js/ui.js', 7735, 12, '比价'),
    ('js/ui.js', 8705, 12, '金全境'),
    ('js/ui.js', 9402, 12, '粮·产'),
    ('js/ui.js', 14635, 12, '库藏'),
    ('js/ui.js', 13035, 10, '可采材料'),
    ('js/ui.js', 17062, 10, '材料研发'),
    ('js/systems.js', 650, 14, 'systems 658 上下文'),
    ('js/main.js', 2428, 14, '地形加成'),
    ('js/state.js', 415, 12, 'state 422 上下文'),
    ('js/battle.js', 956, 12, 'battle 963'),
    ('js/battle.js', 2096, 14, 'battle 2103 粮尽'),
    ('js/questdata.js', 148, 22, '任务 r01/r06'),
    ('js/domain.js', 5028, 34, '资源不足'),
    ('js/domain.js', 7850, 10, '粮木石铁各+'),
    ('js/domain.js', 8130, 50, '派系驻地文案'),
]
for f, ln, n, tag in JOBS:
    s = io.open(R + f, encoding='utf-8').read()
    lines = s.split('\n')
    a = max(0, ln - 1)
    b = min(len(lines), a + n)
    print('\n===== %s L%d~%d 【%s】=====' % (f, a + 1, b, tag))
    for i in range(a, b):
        print('  %5d| %s' % (i + 1, lines[i]))
