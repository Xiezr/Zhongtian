# -*- coding: utf-8 -*-
"""v89.211 补丁 E：main.js
   E1 open-siege 用本作坊自己的 idx
   E2 doTrain 读解析后工位
   E3 版本号 v89.211
"""
import io
R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

s = rd('js/main.js')

# ---------------- E1: open-siege ----------------
if "ui.openTroops(el.dataset.idx, 'siege')" in s:
    print('[skip] E1 open-siege 已改')
else:
    old = """      /* 工匠作坊 → 器械募兵面板（#14） */
      case 'open-siege': ui.openTroops(ui._trainBIdx, 'siege'); break;"""
    new = """      /* 工匠作坊 → 器械募兵面板（#14）
         v89.211（老板 3）：用**本作坊自己的 idx**（按钮已带 data-idx）——
         原传 ui._trainBIdx 是"上次点的军营格"，siege 面板显示回落掩盖了它，
         提交时 craftLevel(城, 军营格)=0 → 明明有作坊却报"本城尚无工匠作坊"。 */
      case 'open-siege': ui.openTroops(el.dataset.idx, 'siege'); break;"""
    s = sub1(s, old, new, 'E1')
    wr('js/main.js', s)
    print('[ok] E1 open-siege')

# ---------------- E2: doTrain ----------------
s = rd('js/main.js')
if '_bar211' in s:
    print('[skip] E2 doTrain 已改')
else:
    old = """  GAME.doTrain = function (troopId) {
    var count = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    /* v24（需求 8）：队列归属具体军营 —— 面板里选中的那一座 */
    var r = GAME.train(troopId, count, GAME.currentCity().id, ui._trainBIdx);
    ui.toast(r.msg);
    if (!r.ok) return;
    /* 募兵面板开在弹窗里，只重绘中央视图看不到新队列 */
    ui.openTroops(ui._trainBIdx, ui._trainFilter);
    GAME.refreshAll();
  };"""
    new = """  GAME.doTrain = function (troopId) {
    var count = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    /* v24（需求 8）：队列归属具体军营 —— 面板里选中的那一座。
       v89.211（老板 3）：提交读**解析后**工位（与显示同一份 resolver）——
       改前直传 ui._trainBIdx，陈旧值（如上次点的军营格）到这里就变成
       "本城尚无工匠作坊"的假报（老板实测）。 */
    var _bar211 = ui.trainBarracks();
    var _bidx211 = _bar211 ? _bar211.idx : null;
    var r = GAME.train(troopId, count, GAME.currentCity().id, _bidx211);
    ui.toast(r.msg);
    if (!r.ok) return;
    /* 募兵面板开在弹窗里，只重绘中央视图看不到新队列 */
    ui.openTroops(_bidx211, ui._trainFilter);
    GAME.refreshAll();
  };"""
    s = sub1(s, old, new, 'E2')
    wr('js/main.js', s)
    print('[ok] E2 doTrain')

# ---------------- E3: 版本号 ----------------
s = rd('js/main.js')
if "GAME.VERSION = 'v89.211'" in s:
    print('[skip] E3 版本号已升')
else:
    old = "  GAME.VERSION = 'v89.210';"
    new = "  GAME.VERSION = 'v89.211';"
    s = sub1(s, old, new, 'E3')
    wr('js/main.js', s)
    print('[ok] E3 版本号')

print('DONE')
