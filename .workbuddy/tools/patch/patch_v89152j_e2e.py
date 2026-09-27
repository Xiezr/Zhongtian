# -*- coding: utf-8 -*-
# v89.152j：e2e-test.js 野地面板断言升级（产出行 4 行 / 已占无产出）
import io

P = 'E:/Deepseekdb/e2e-test.js'
S = io.open(P, encoding='utf-8', newline='').read()
orig = len(S)
n = 0

def rep(tag, old, new, guard):
    global S, n
    if guard in S:
        print('  skip ' + tag); return
    c = S.count(old)
    assert c == 1, tag + ' count=' + str(c)
    S = S.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(S)
    n += 1
    print('  OK   ' + tag)

# ① 已占地块界面（lm20）：不再用"此地可采"判，改判"无产出行"
rep('lm20',
    u"    check('野地弹窗标明可采资源', lm20.indexOf('此地可采') >= 0);",
    u"""    /* v89.152（老板 5）：已占野地**不显示产出行**（资源/产量加成/材料/珠宝都不显示） */
    check('已占野地不显示产出行（v89.152）',
      lm20.indexOf('此地可采') < 0 && lm20.indexOf('op-zone-t">产出') < 0
      && lm20.indexOf('>产量加成<') < 0);""",
    guard=u'已占野地不显示产出行（v89.152）')

# ② 未占弹窗（landHtml）：4 行判据
rep('landhtml',
    u"""  /* v15：可采地形显示"此地可采：X"，平原则明确"无可采之物" */
  check('野地弹窗标明可否采集', landHtml.indexOf('此地可采') >= 0 || landHtml.indexOf('无可采之物') >= 0,
    landHtml.indexOf('此地可采') >= 0 ? '可采' : '平原不可采');""",
    u"""  /* v89.152（老板 1）：未占面板产出**分行呈现** —— 资源 / 产量加成 / 材料 / 珠宝 四行；
     平地的"无可采之物"落在资源行（不再有旧的单行「此地可采」文案）。 */
  check('野地弹窗产出行 4 行（v89.152）',
    landHtml.indexOf('>资源<') >= 0 && landHtml.indexOf('>产量加成<') >= 0
    && landHtml.indexOf('>材料<') >= 0 && landHtml.indexOf('>珠宝<') >= 0
    && landHtml.indexOf('此地可采') < 0);
  /* v89.152（老板 3/4）：没有"占领/掠夺"备注行；按钮文案「占领」（不带"并驻守"） */
  check('野地弹窗无备注行 · 「占领」不带"并驻守"（v89.152）',
    landHtml.indexOf('打下来后军队就地驻守') < 0 && landHtml.indexOf('Lv0 无驻军位') < 0
    && landHtml.indexOf('data-mode="occupy">🚩 占领</button>') >= 0);""",
    guard=u'野地弹窗产出行 4 行（v89.152）')

# ③ 已占管理面板（landM）：产量加成 -> 无产出行
rep('landM',
    u"      && landM.indexOf('产量加成') >= 0);",
    u"""      /* v89.152（老板 5）：已占野地不显示产出行 */
      && landM.indexOf('op-zone-t">产出') < 0 && landM.indexOf('>产量加成<') < 0);""",
    guard=u'已占野地不显示产出行 */\n      && landM')

io.open(P, 'w', encoding='utf-8', newline='').write(S)
print('e2e done (%d), len %d -> %d' % (n, orig, len(S)))
