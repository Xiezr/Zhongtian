# -*- coding: utf-8 -*-
"""v89.223g：文档口径校正（记忆/档案：活工具同步范围 + 收尾计数 16）。
用法: DRY=1 python patch_v89223g_fixdoc.py
"""
import io, os, sys

MEM = 'C:/Users/18811/WorkBuddy/2026-09-20-23-39-22/.workbuddy/memory/2026-10-06.md'
ARC = '需求档案.md'
def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

DRY = os.environ.get('DRY') == '1'
FIXES = [
    (MEM,
     '- 活工具夹具 17 文件 33 处：许都→灰岗（audit/asset/play/playtest）· audit 链义兵→民兵/民夫→搬运工；',
     '- 活工具同步（audit/asset/play/playtest 17 文件）：夹具 许都→灰岗 · 链/驾驶舱显示词'
     '（义兵→民兵 · 轻骑→摩托游骑 · 铁骑→装甲战车 · 民夫→搬运工）36 处；'),
    (ARC,
     '② 产品侧收尾 15 处（战报示例',
     '② 产品侧收尾 16 处（战报示例'),
    (ARC,
     '③ 活工具夹具（audit/asset/play/playtest 17 文件：许都→灰岗 · audit 链显示词同步）',
     '③ 活工具夹具与显示词（audit/asset/play/playtest 17 文件：许都→灰岗 · audit 链与 playtest 显示词同步）'),
    (ARC,
     '许都→灰岗 17 处 + RUN 标签 12 处 + audit 链显示词 9 处',
     '许都→灰岗 17 处 + RUN 标签 12 处 + 链/驾驶舱显示词 36 处（audit 14 · playtest 22）'),
    (ARC,
     '· domain.js ×1 | 15 处 |',
     '· domain.js ×1 · main.js ×1（版本号） | 16 处 |'),
]
ok = 0
for f, old, new in FIXES:
    s = rd(f)
    if old not in s:
        if new in s:
            print('[skip] 已改: %s' % old[:38])
            ok += 1
            continue
        raise AssertionError('锚点缺失 [%s]: %s' % (f, old[:50]))
    c = s.count(old)
    assert c == 1, '[%s] count=%d' % (f, c)
    if not DRY:
        wr(f, s.replace(old, new))
    print('[ok] %s' % old[:48])
    ok += 1
print(('DRY 完成' if DRY else '已落盘') + '（%d/%d）' % (ok, len(FIXES)))
