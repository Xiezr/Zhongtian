# -*- coding: utf-8 -*-
"""v89.144 —— e2e-test.js 断言升级
   出征页：容量口径随「军队校场扩容」搬家 → 本用例改查目标入口（含 §144 定宽/默认空/无备注）
   新增：军队校场扩容页用例（容量 + 节钺入口）
"""
import io

P = 'E:/Deepseekdb/e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

rep(
"""  /* 出征页（act）：容量口径（人马）+ 目标入口 + 节钺入口 */
  G.ui._marchTab = 'act';
  G.ui.setView('marches');
  await sleep(120);
  const act21_v21 = vc.innerHTML;
  check('出征页呈现本城出征容量（人马口径）与目标入口（第 9/11 条 + §142 五类分行）',
    act21_v21.indexOf('出征容量') >= 0 && act21_v21.indexOf('人马') >= 0
    && act21_v21.indexOf('data-action="exp-act-pick"') >= 0
    && act21_v21.indexOf('data-action="exp-act-go"') >= 0
    /* v89.142：5 类分行 + 按钮在底部 —— DOM 顺序：按钮出现在最后一个目标下拉之后 */
    && (act21_v21.indexOf('exp-act-go') > act21_v21.lastIndexOf('exp-act-pick')));""",
"""  /* 军队校场扩容页（expand · v89.144 老板 3：从出征页整块搬家、独立页签放军务总览右边） */
  G.ui._marchTab = 'expand';
  G.ui.setView('marches');
  await sleep(120);
  const expd21_v21 = vc.innerHTML;
  check('军队校场扩容页（军务总览右边）：出征容量（人马口径）+ 节钺 · 校场扩编入口',
    expd21_v21.indexOf('军队校场扩容') >= 0
    && expd21_v21.indexOf('出征容量') >= 0 && expd21_v21.indexOf('人马') >= 0
    && expd21_v21.indexOf('data-action="jieyue-xc"') >= 0);
  /* 出征页（act）：目标入口 + 5 类分行（容量口径已随页签搬走） */
  G.ui._marchTab = 'act';
  G.ui.setView('marches');
  await sleep(120);
  const act21_v21 = vc.innerHTML;
  check('出征页呈现目标入口（第 9/11 条 + §142 五类分行 + §144 定宽下拉/默认空/去备注）',
    act21_v21.indexOf('data-action="exp-act-pick"') >= 0
    && act21_v21.indexOf('data-action="exp-act-go"') >= 0
    /* v89.144（老板 4）：定宽类 + 空首项（默认不选） */
    && act21_v21.indexOf('act-sel') >= 0
    && act21_v21.indexOf('<option value=""></option>') >= 0
    /* v89.144（老板 4）：「共 N · 列最近 N」备注整条去掉 */
    && !/共 \\d+ · 列最近/.test(act21_v21)
    /* v89.142：5 类分行 + 按钮在底部 —— DOM 顺序：按钮出现在最后一个目标下拉之后 */
    && (act21_v21.indexOf('exp-act-go') > act21_v21.lastIndexOf('exp-act-pick')));""",
    'e2e 出征页 + 新增校场扩容页',
    done_when='军队校场扩容页（军务总览右边）')

save('e2e 全部')
print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
