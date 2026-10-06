# -*- coding: utf-8 -*-
"""v89.198 批次G：修补被本轮改动打穿的 4 条旧断言"""

import io

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

S = 'E:/Deepseekdb/smoke-test.js'

rep(S, 'G-a dispatch 调用断言升级',
"""    /GAME\\.march\\.dispatch\\(target, mode, atk, _genSend137, _schemeSend137, _ops94\\)/.test(mS30));""",
"""    /GAME\\.march\\.dispatch\\(target, mode, atk, _genSend137, _schemeSend137\\)/.test(mS30));""",
    'GAME\\.march\\.dispatch\\(target, mode, atk, _genSend137, _schemeSend137\\)')

rep(S, 'G-b sel 签名断言升级',
"""      && /var sel = function \\(id, label, opts\\)/.test(all)""",
"""      && /var sel = function \\(id, opts\\)/.test(all)            /* v89.198：统一行（label 走 expRowHTML） */""",
    'v89.198：统一行（label 走 expRowHTML）')

rep(S, 'G-c 弹窗战术断言升级',
"""check('出征弹窗显示本次战术（含"调整"入口）', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var seg = codeOf(u, 'ui.openExpModal = function');
  return seg.length > 500 && /GAME\\.tacticSummary\\(\\)/.test(seg)
    && /data-action="open-tactic"/.test(seg);
})());""",
"""check('出征弹窗含出征战术行（v89.198：阵位摘要/逐兵种链退役，「设置」链保留）', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var seg = codeOf(u, 'ui.openExpModal = function');
  return seg.length > 500 && /id="exp-tactic"/.test(seg)
    && /data-action="open-tactic-set"/.test(seg)
    && seg.indexOf('exp-tac-sum') < 0;
})());""",
    '阵位摘要/逐兵种链退役，「设置」链保留')

rep(S, 'G-d v89.156 阵位负判',
"""      /* 只换容器：四块的 id 与 handler 一个都不能丢 */
      && /id="exp-scheme-sel"/.test(exp) && /id="exp-mode"/.test(exp)
      && /id="exp-plan"/.test(exp) && /id="exp-tactic"/.test(exp) && /id="exp-tac-sum"/.test(exp);""",
"""      /* 只换容器：四块的 id 与 handler 一个都不能丢（v89.198：阵位摘要行退役，判据反转） */
      && /id="exp-scheme-sel"/.test(exp) && /id="exp-mode"/.test(exp)
      && /id="exp-plan"/.test(exp) && /id="exp-tactic"/.test(exp) && !/id="exp-tac-sum"/.test(exp);""",
    '阵位摘要行退役，判据反转')

print('批次G 完成')
