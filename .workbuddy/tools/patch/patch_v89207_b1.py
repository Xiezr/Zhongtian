# -*- coding: utf-8 -*-
# v89.207 批次 B1：三条连带断言升级（§193① §193② §193③ §200①）
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    assert '\r\n' not in s, 'CRLF leak!'
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

SMOKE = 'E:/Deepseekdb/smoke-test.js'

# B1-a：§193① LOOP_GAP 断言行文本 → 字段级
rep(SMOKE, 'B1a §193①', 
    "        && /DATA.LOOP_GAP = \\{ gapSec: 5, toastSec: 300, battleAutoSec: 300 \\};/.test(dS193);   /* v89.200 加 battleAutoSec */",
    "        /* v89.207（老板 2）规则变更：LOOP_GAP 加 reportSec（大缺口弹「离线纪要」门槛）——\n"
    "           判据从\"整行文本\"升级为\"关键字段齐全\"（防未来加字段再翻红）。 */\n"
    "        && (function () {\n"
    "             var lgs = (dS193.match(/DATA\\.LOOP_GAP = \\{[\\s\\S]{0,260}?\\};/) || [''])[0];\n"
    "             return /gapSec: 5/.test(lgs) && /toastSec: 300/.test(lgs)\n"
    "               && /battleAutoSec: 300/.test(lgs) && /reportSec: 1800/.test(lgs);\n"
    "           })();",
    'LOOP_GAP 加 reportSec')

# B1-b：§193② 标题 + return 段
rep(SMOKE, 'B1b §193② 标题',
    "check('§193② 静默补偿：队列推完 · offline 编年史不增 · 不生成归来报告（真调 · 沙坑）', (function () {",
    "check('§193②（v89.207 口径）静默补偿：队列推完 · offline 编年史不增 · 生成「离线纪要」（via=online）· 不设 _offlineSec（真调 · 沙坑）', (function () {",
    '§193②（v89.207 口径）')

rep(SMOKE, 'B1c §193② return',
    "          && offN() === a0\n"
    "          && (G._offlineReport || {}).sentinel === true\n"
    "          && G._offlineSec === 777;",
    "          && offN() === a0\n"
    "          /* v89.207（老板 2）规则变更：静默**也归集**报告（via=online → UI 弹「离线纪要」）——\n"
    "             原判据\"哨兵保持\"反转为\"哨兵被新报告覆盖且 via 标记正确\"。 */\n"
    "          && (G._offlineReport || {}).sentinel !== true\n"
    "          && (G._offlineReport || {}).via === 'online'\n"
    "          && G._offlineSec === 777;   /* _offlineSec 仍不设（读档提示口径） */",
    "原判据\"哨兵保持\"反转为")

# B1-d：§193③ 对照加 via=reload
rep(SMOKE, 'B1d §193③',
    "        return offN() === a0 + 1 && (G._offlineReport || {}).sentinel2 !== true && G._offlineSec === 600;",
    "        return offN() === a0 + 1 && (G._offlineReport || {}).sentinel2 !== true\n"
    "          && (G._offlineReport || {}).via === 'reload'   /* v89.207：读档路径 via=reload */\n"
    "          && G._offlineSec === 600;",
    "读档路径 via=reload")

# B1-e：§200① battleAutoSec 行尾
rep(SMOKE, 'B1e §200①',
    "        && /battleAutoSec: 300 \\};/.test(dS200)",
    "        && /battleAutoSec: 300/.test(dS200)   /* v89.207：表尾加 reportSec 后不再断言行尾 */",
    '表尾加 reportSec 后不再断言行尾')

print('=== B1 完成 ===')
