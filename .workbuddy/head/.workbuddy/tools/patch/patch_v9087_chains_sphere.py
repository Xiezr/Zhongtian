# -*- coding: utf-8 -*-
"""v90.87 复核：chains 工具补加载 sphere.js（v90.73 新增模块，工具未跟上）。"""
import io

P = 'E:/Deepseekdb/.workbuddy/tools/audit/audit_v89105_chains.js'
s = io.open(P, encoding='utf-8').read()

OLD = "['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',\n 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']"
NEW = "/* 加载列表与 index.html 同源：v90.73 起产品含 sphere.js（球系化）——\n   缺它 GAME.sphere 为空，据点/地图类链路会假红（v90.87 复核修复）。 */\n['data', 'state', 'questdata', 'systems', 'domain', 'map', 'sphere', 'battle', 'tactic', 'icons',\n 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']"

MARK = "'map', 'sphere', 'battle'"
if MARK in s:
    print('[skip] 已含 sphere')
else:
    assert s.count(OLD) == 1, 'anchor count=' + str(s.count(OLD))
    io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW))
    print('[ok] chains 加载列表补 sphere')

s2 = io.open(P, encoding='utf-8').read()
assert MARK in s2, 'selfcheck fail: mark missing'
print('[selfcheck] ok · size=' + str(len(s2)))
