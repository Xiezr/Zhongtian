# -*- coding: utf-8 -*-
"""v90.94：把「版本与档案在册」一组守卫里的版本正则由 v89\\.\\d+ 放宽为 v\\d+\\.\\d+。
   依据：需求档案.md §v90.87b 段自述的四步走第 3 步 ——
        「7 条历史断言按 §139.5/§229c⑧ 先例放宽为 v\\d+\\.\\d+」。
   放宽后「现行版本号正确性」由 §199④（格式）+ §199⑥（档案自洽）保证，非变松。"""
import io
import os
import shutil

P = r'E:\Deepseekdb\smoke-test.js'
BK = r'E:\Deepseekdb\.workbuddy\backup\v90.94-lordbreak\smoke-test.js.preVer3'

OLD_RE = r"GAME\.VERSION = 'v89\.\d+'"
NEW_RE = r"GAME\.VERSION = 'v\d+\.\d+'"
OLD_CMT = '由 §199④ 逐轮锁'
NEW_CMT = '由 §199④ 锁格式（同 §199⑥ 档案自洽）'

s = io.open(P, encoding='utf-8', newline='').read()
n0 = len(s)

c1 = s.count(OLD_RE)
c2 = s.count(OLD_CMT)
assert c1 == 14, '版本正则耦合点 %d 处（应 14）' % c1
assert c2 >= 3, '注释耦合点 %d 处（应 >= 3）' % c2

s = s.replace(OLD_RE, NEW_RE)
s = s.replace(OLD_CMT, NEW_CMT)

# 写后自检
assert r"GAME\.VERSION = 'v89\.\d+'" not in s, '自检失败：仍有 v89 耦合'
assert s.count(NEW_RE) == 15, '自检失败：NEW 计数 %d（应 15 = 放宽 14 + §199④ 1）' % s.count(NEW_RE)

if not os.path.exists(BK):
    shutil.copy2(P, BK)
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('[OK] smoke-test.js %d -> %d 字符 · 放宽 %d 处正则 + %d 处注释' % (n0, len(s), c1, c2))
