# -*- coding: utf-8 -*-
"""v89.198 批次D：main.js 战法动作/校验退役"""

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

def cut(path, tag, old, new):
    s = rd(path)
    c = s.count(old)
    if c == 0:
        print('[skip] ' + tag + '（已缩减/已落盘）')
        return
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

M = 'E:/Deepseekdb/js/main.js'

# D1 action case 退役
rep(M, 'D1 case exp-ops 退役',
"""      /* v89.94（B2 · E2）：战法三选（强攻/围困/奇袭）—— 唯一出口 ui.setExpOps */
      case 'exp-ops': ui.setExpOps(el.dataset.v); break;""",
"""      /* ⛔ v89.198（老板「清除战法这个玩法」）：战法三选动作整条退役（连 ui.setExpOps 一起清除）。 */""",
    '战法三选动作整条退役')

# D2 出行校验块退役
rep(M, 'D2 确认链战法校验退役',
"""    /* v89.94（B2 · E2）：战法校验（与 prepare/dispatch 同一判据）——
       奇袭没计略 / 围困打野地 → 拦在这里并说明原因，不静默降级。 */
    var _ops94 = GAME.opsIdOf(ui._expOps);
    var _opsIssue94 = GAME.opsConfigIssueOf(_ops94, ui._expRes, ui._expScheme || null);
    if (_opsIssue94) { ui.toast('⚠️ ' + _opsIssue94); return; }""",
"""    /* ⛔ v89.198（老板「清除战法这个玩法」）：战法出行校验随玩法全撤退役。 */""",
    '：战法出行校验随玩法全撤退役。 */')

# D3 dispatch 调用去参
rep(M, 'D3 dispatch 调用去 ops 参',
"""    var r = GAME.march.dispatch(target, mode, atk, _genSend137, _schemeSend137, _ops94);""",
"""    var r = GAME.march.dispatch(target, mode, atk, _genSend137, _schemeSend137);""",
    'GAME.march.dispatch(target, mode, atk, _genSend137, _schemeSend137);')

# D4 战法复位删除
cut(M, 'D4 战法复位退役',
"""      ui._expScheme = null;      /* v86：计已随军出发，面板状态清空 */
      ui._expOps = 'assault';    /* v89.94：战法回到默认（防下次误带围困上野地） */""",
"""      ui._expScheme = null;      /* v86：计已随军出发，面板状态清空 */""")

print('批次D 完成')
