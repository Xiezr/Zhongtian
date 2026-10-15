# -*- coding: utf-8 -*-
"""v89.86 · e2e 收尾：① P-06 战事触发块（阅读器元素须重查 —— 该用例里是首次创建）；
   ② v18 行军菜单断言随 P-20 更名同步（军务总览 / 驻守野地）。"""
import io
import os
import sys

E2 = r'E:\Deepseekdb\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ① P-06 战事触发块：阅读器元素重查
edit(E2, r"""        const fx31 = document.querySelector('#story-fx');
        const pend31 = (G.SG.pending() || []).some((x) => x.sid === _pin31);
        check('★ v89.86（P-06）：战事触发 · 入待阅（相关建筑池 · ' + _pin31 + '）',
          pend31 && (!fx31 || fx31.style.display === 'none'));
        G.ui.sgReadPending(_pin31);
        await sleep(40);
        check('★ v89.86（P-06）：从待阅开卷（同一阅读器 · ' + _pin31 + '）',
          !!fx31 && fx31.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);
        const ex31 = fx31 && fx31.querySelector('[data-action="story-exit"]');
        if (ex31) { click(ex31); await sleep(30); }
        check('★ v89.86（P-06）：掩卷收起 · 待阅已出列', !!fx31 && fx31.style.display === 'none'
          && !(G.SG.pending() || []).some((x) => x.sid === _pin31));""",
     r"""        const fx31 = document.querySelector('#story-fx');
        const pend31 = (G.SG.pending() || []).some((x) => x.sid === _pin31);
        check('★ v89.86（P-06）：战事触发 · 入待阅（相关建筑池 · ' + _pin31 + '）',
          pend31 && (!fx31 || fx31.style.display === 'none'));
        G.ui.sgReadPending(_pin31);
        await sleep(40);
        /* ⚠️ 阅读器元素可能在本用例**首次创建** —— 必须重查，不能沿用开卷前抓的引用（否则是 null） */
        const fx31b = document.querySelector('#story-fx');
        check('★ v89.86（P-06）：从待阅开卷（同一阅读器 · ' + _pin31 + '）',
          !!fx31b && fx31b.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);
        const ex31 = fx31b && fx31b.querySelector('[data-action="story-exit"]');
        if (ex31) { click(ex31); await sleep(30); }
        check('★ v89.86（P-06）：掩卷收起 · 待阅已出列', !!fx31b && fx31b.style.display === 'none'
          && !(G.SG.pending() || []).some((x) => x.sid === _pin31));""",
     'e2e · P-06 战事块重查元素')

# ② 行军菜单断言随 P-20 同步
edit(E2, r"""    check('行军菜单渲染出征队列', mvh.indexOf('在外军队') >= 0 && mvh.indexOf(gen24.name) >= 0);""",
     r"""    /* v89.86（整改 P-20）：行军视图 → 军务总览（标题与五段结构随之更新） */
    check('军务总览渲染出征队列', mvh.indexOf('军务总览') >= 0 && mvh.indexOf(gen24.name) >= 0);""",
     'e2e · 军务总览标题')

edit(E2, r"""    check('行军菜单含在外驻军（采集）区', mvh.indexOf('在外驻军') >= 0);""",
     r"""    check('军务总览含驻守野地 / 采集队区', mvh.indexOf('驻守野地') >= 0 && mvh.indexOf('采集队') >= 0);""",
     'e2e · 军务总览驻守区')

print('DONE')
