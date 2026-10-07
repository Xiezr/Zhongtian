# -*- coding: utf-8 -*-
"""v89.233 批 2 测试面同步：任务文案换代 → 4 处断言/注释按新口径重写。

含一处真 bug 修复：§228① 的"连带检查"`return '连带缺失（奇遇/任务）'` 在 `if (cond)`
下为 truthy → **从未生效**（死断言）；本轮改为真失败形态。
"""
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


# ① g01：立锥之地 → 残垣立命
rep('g01-title',
    "check('★ 顶块装的是达标项（g01 立锥之地 + 随机 ' + (rdef ? rdef.title : '—') + '）', (function () {",
    "check('★ 顶块装的是达标项（g01 残垣立命 + 随机 ' + (rdef ? rdef.title : '—') + '）', (function () {")
rep('g01-body',
    "return blk.indexOf('立锥之地') >= 0 && (!rdef || blk.indexOf(rdef.title) >= 0)",
    "return blk.indexOf('残垣立命') >= 0 && (!rdef || blk.indexOf(rdef.title) >= 0)")

# ② g02：民居渐稠 → 人烟渐聚
rep('g02-title',
    "check('未达标项不带领取按钮（g02 民居渐稠 无 data-q）',\n          html.indexOf('民居渐稠') >= 0 && html.indexOf('data-q=\"g02\"') < 0);",
    "check('未达标项不带领取按钮（g02 人烟渐聚 无 data-q）',\n          html.indexOf('人烟渐聚') >= 0 && html.indexOf('data-q=\"g02\"') < 0);")

# ③ §228① 连带检查：利刃初铸 → 初炉出品（顺修 truthy 死断言）
rep('s228-chain',
    "      if (d228.indexOf('遗落战刃') < 0 || q228.indexOf('利刃初铸') < 0) return '连带缺失（奇遇/任务）';\n      return true;",
    "      /* v89.233：任务名随文风批换代（'利刃初铸'→'初炉出品'）；\n         顺修：原 `return '连带缺失（奇遇/任务）'` 在 `if (cond)` 下为 truthy —— 该检查从未生效。 */\n      if (d228.indexOf('遗落战刃') < 0 || q228.indexOf('初炉出品') < 0) return false;\n      return true;")

# ④ 夹具注释：广厦之谋 → 多盖两间
rep('r18-note',
    "         v83 修复（存量 flake，2~3%）：跳过 bldCount/minfang 类（r18「广厦之谋」）——",
    "         v83 修复（存量 flake，2~3%）：跳过 bldCount/minfang 类（r18「多盖两间」）——")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('\n'.join(LOG))
print('done')
