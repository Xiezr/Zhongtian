# -*- coding: utf-8 -*-
"""v89.233 批 1 测试面同步：货币「金→旧币」相关的 5 条断言按新口径重写（§0.7 规则变更）。"""
import io

R = 'E:/Deepseekdb/'
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
LOG = []


def rep(tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, '%s count=%d want=%d' % (tag, c, cnt)
    s = s.replace(old, new)
    LOG.append('[ok] ' + tag)


# ① v89.49 接线：面板段文案"花金买时间"→"花旧币买时间"
rep('v89.49-1',
    "return /train-rush/.test(fn) && /花金买时间/.test(fn) && /宝物加速/.test(fn)",
    "return /train-rush/.test(fn) && /花旧币买时间/.test(fn) && /宝物加速/.test(fn)")

# ② 收编入军：标题 + "费 X 金" 判据 → 旧币
rep('conscript-2',
    "check('① 收编入军：逐兵种入军 + 支金（造价 50%）· 幸存者**不动** · 界面与执行同源', (function () {",
    "check('① 收编入军：逐兵种入军 + 支旧币（造价 50%）· 幸存者**不动** · 界面与执行同源（v89.233 货币统一）', (function () {")
rep('conscript-3',
    "&& h0.indexOf('费 ' + U.numText(plan.cost, 0) + ' 金') >= 0",
    "&& h0.indexOf('费 ' + U.numText(plan.cost, 0) + ' 旧币') >= 0")

# ③ §161 调运：标题 + "（金：全境通用…）" 判据 → 旧币
rep('s161-4',
    "check('§161 调运清单去金 + 金悬停写\"全境通用\"+ 折损现实换算出口', (function () {",
    "check('§161 调运清单去旧币 + 货币悬停写\"全境通用\"+ 折损现实换算出口（v89.233 货币统一）', (function () {")
rep('s161-5',
    "&& /（金：全境通用 · 净水\\/生物质\\/电能\\/废钢：按本城结算）/.test(uS161);",
    "&& /（旧币：全境通用 · 净水\\/生物质\\/电能\\/废钢：按本城结算）/.test(uS161);")

# ④ §194② 缺料提示：标题 + "金 3,000" 判据 → "旧币 3,000"
rep('s194-6',
    "check('§194② 缺料提示唯一出口：costLackMsg 报缺项（金标\"全境通用\"）· 五处同源', (function () {",
    "check('§194② 缺料提示唯一出口：costLackMsg 报缺项（旧币标\"全境通用\"）· 五处同源（v89.233 货币统一）', (function () {")
rep('s194-7',
    "var okMsg = /金 3,000/.test(msg) && /净水 500/.test(msg) && /全境通用/.test(msg);",
    "var okMsg = /旧币 3,000/.test(msg) && /净水 500/.test(msg) && /全境通用/.test(msg);")

# ⑤ §229b⑬ RES_NAME：金→币（v89.233 货币统一：单字简称用'币'）
rep('s229b13-8',
    "check('§229b⑬ ui.RES_NAME/RES_ICON 与资源换代同源（水/生/电/钢 · 四图标）', (function () {\n      var uu = strip229b(u9);\n      return /ui\\.RES_NAME = \\{ grain: '水', wood: '生', stone: '电', iron: '钢', gold: '金' \\}/.test(uu)",
    "check('§229b⑬ ui.RES_NAME/RES_ICON 与资源换代同源（水/生/电/钢/币 · v89.233 货币统一）', (function () {\n      var uu = strip229b(u9);\n      return /ui\\.RES_NAME = \\{ grain: '水', wood: '生', stone: '电', iron: '钢', gold: '币' \\}/.test(uu)")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('\n'.join(LOG))
print('done')
