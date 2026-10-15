# -*- coding: utf-8 -*-
import io, os

ROOT = r'E:\Deepseekdb'


def edit(rel, subs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, encoding='utf-8', newline='').read()
    n0 = len(s)
    for old, new in subs:
        c = s.count(old)
        assert c == 1, '%s anchor count=%d [%s]' % (rel, c, old[:30])
        s = s.replace(old, new, 1)
    tmp = p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    print('%-16s %d -> %d' % (rel, n0, len(s)))


edit('js/ui.js', [
    ('''            /* v89.177（老板「综合考验」）：五关进度（政/城/军/资/宝）——未过项红字。
               口径 = GAME.lordTrialOf（唯一出口）；按钮高亮仍只看修为（界面不预判全部门槛）。 */''',
     '''            /* v89.177（老板「综合考验」）：四关进度（城/军/资/宝 · v90.92 政关随任务系统退役）——未过项红字。
               口径 = GAME.lordTrialOf（唯一出口）；按钮高亮仍看爵位（界面不预判全部门槛）。 */'''),
    ("""+ (_trial177.ok ? '五关俱过' : '未过') + '）：'""",
     """+ (_trial177.ok ? '四关俱过' : '未过') + '）：'"""),
])

edit('smoke-test.js', [
    ("""check('§177⑥c 君主面板考验清单在册（_trialHTML177 · 五关逐条）',""",
     """check('§177⑥c 君主面板考验清单在册（_trialHTML177 · 四关逐条 · v90.92 政关退役）',"""),
])

edit('e2e-test.js', [
    ("""check('v89.177 君主面板「突破考验」五关清单（真 DOM · 打开君主面板）',""",
     """check('v89.177 君主面板「突破考验」四关清单（真 DOM · 打开君主面板）',"""),
])
print('DONE')
