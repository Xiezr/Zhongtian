# -*- coding: utf-8 -*-
# v89.200 批次 C：旧断言升级（4 处）+ §200 段插入
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

S = 'smoke-test.js'

def rep(tag, old, new, mark, cnt=1):
    s = rd(S)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(S, s.replace(old, new))
    print('[ok] ' + tag)

# ── C1 §156③（城池目标）判据升级：预估移左列下方 ──
rep('C1 §156③ 预估位置',
    u"""          ok = iL >= 0 && iR > iL && iIt > iL && iIt < iR && iEs > iR && iEs > iTr
            && html.indexOf('id="exp-cap-t"') >= 0""",
    u"""          /* v89.200（老板 3）：预估从右列**移回左列下方**（iEs 在道具块之后、右列之前；
             兵力块 iTr 恒在右列 —— 规则变更所致，非放宽）。 */
          ok = iL >= 0 && iR > iL && iIt > iL && iIt < iR && iEs > iIt && iEs < iR && iTr > iR
            && html.indexOf('id="exp-cap-t"') >= 0""",
    u'v89.200（老板 3）：预估从右列**移回左列下方**（iEs 在道具块之后、右列之前；')
rep('C1b §156③ 标题',
    u"""    check('§156③ 出征（城池目标）：额度标签 + 限制容器 + 道具下拉（左列） + 预估（右列 · 兵种后）', (function () {""",
    u"""    check('§156③ 出征（城池目标）：额度标签 + 限制容器 + 道具下拉（左列） + 预估（v89.200 移左列下方）', (function () {""",
    u'§156③ 出征（城池目标）：额度标签 + 限制容器 + 道具下拉（左列） + 预估（v89.200 移左列下方）')

# ── C2 v89.156 四块断言：预估调用点移左列 ──
rep('C2 四块断言',
    u"""      && iR > 0 && iEstCall > iR                                /* 预估调用点在右列 */""",
    u"""      && iR > 0 && iEstCall > idx[4] && iEstCall < iR           /* v89.200：预估调用点在左列下方（可用道具之后） */""",
    u'v89.200：预估调用点在左列下方（可用道具之后）')
rep('C2b 四块断言标题',
    u"""  check('v89.156：出征四块**逐行**（单列）+ 可用道具紧随其后（预估搬右列 · 原 v89.66 2×2 退役）', (function () {""",
    u"""  check('v89.156/v89.200：出征四块**逐行**（单列）+ 可用道具紧随其后（预估 v89.200 移左列下方 · 原 v89.66 2×2 退役）', (function () {""",
    u'§156/v89.200：出征四块**逐行**（单列）+ 可用道具紧随其后（预估 v89.200 移左列下方')

# ── C3 §193① LOOP_GAP 表判据升级（加 battleAutoSec） ──
rep('C3 §193① LOOP_GAP',
    u"""        && /DATA.LOOP_GAP = \\{ gapSec: 5, toastSec: 300 \\};/.test(dS193);""",
    u"""        && /DATA.LOOP_GAP = \\{ gapSec: 5, toastSec: 300, battleAutoSec: 300 \\};/.test(dS193);   /* v89.200 加 battleAutoSec */""",
    u'battleAutoSec: 300 \\};/.test(dS193)')

# ── C4 §197⑤b .exp-row 判据升级（position: relative） ──
rep('C4 §197⑤b',
    u"""        && /\\.exp-row \\{ display: flex;/.test(hc)""",
    u"""        && /\\.exp-row \\{ position: relative; display: flex;/.test(hc)   /* v89.200：加 relative（链接绝对定位的锚） */""",
    u'\\.exp-row \\{ position: relative; display: flex;/.test(hc)')

# ── C5 §200 段插入（结果行之前） ──
s = rd(S)
if u'§200（v89.200）' in s:
    print('[skip] C5 §200 段')
else:
    sec = io.open('E:/Deepseekdb/.workbuddy/tmp/sec200.js', 'r', encoding='utf-8', newline='').read()
    anchor = u"  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    c = s.count(anchor)
    assert c == 1, 'C5 anchor count=' + str(c)
    s = s.replace(anchor, sec + u'\n' + anchor)
    wr(S, s)
    print('[ok] C5 §200 段插入')

print('批次C 完成')
