# -*- coding: utf-8 -*-
"""v89.148 —— smoke 断言升级（需求 2/3 的口径变化）
   ① bt-board 加 flex 前缀（2 处）
   ② bt-top 加 flex:0 0 auto（1 处）
   ③ bt-wrap overflow + bt-log 50%（3 处）
   ④ 侧栏表头去"（N 队）"（2 处）
   ⑤ §124① 顶部斗将行退役（1 处）
"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)
n_ok = 0

def rep(old, new, tag, count=1):
    global s, n_ok
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    n_ok += 1
    print('  [ok]    ' + tag)

# ---------- ① bt-board（2 处，同一串） ----------
rep(
r"""      return /\.bt-board \{ display: grid; grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h96)""",
r"""      /* v89.148（老板 3）：.bt-board 前面加了 `flex: 1 1 auto; ... overflow: hidden;` 前缀 —— 判据放宽为"规则块内含列宽" */
      return /\.bt-board \{[^}]*grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h96)""",
    '①-1 ⑧ 上部分三列')

rep(
r"""    check('⑦ 三列 1.1fr 3.8fr 1.1fr（v89.140：侧栏收窄、战场放宽）',
      /\.bt-board \{ display: grid; grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h97));""",
r"""    check('⑦ 三列 1.1fr 3.8fr 1.1fr（v89.140：侧栏收窄、战场放宽 · v89.148 前缀 flex 不判）',
      /\.bt-board \{[^}]*grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h97));""",
    '①-2 ⑦ 三列')

# ---------- ② bt-top ----------
rep(
r"""      var okCss = /\.bt-top \{ display: grid; grid-template-columns: 1fr auto 1fr;/.test(h101);""",
r"""      /* v89.148（老板 3）：.bt-top 加 `flex: 0 0 auto;` 前缀（不伸缩） */
      var okCss = /\.bt-top \{ flex: 0 0 auto; display: grid; grid-template-columns: 1fr auto 1fr;/.test(h101);""",
    '② ③ 三键在读秒行')

# ---------- ③ wrap + log（§118③） ----------
rep(
"""    check('§118③ 回合记录下移到底 + 16 行：CSS（wrap 撑满自滚 · log 可压缩 + 336 理想高）+ BT_LOG_MAX=64', (function () {
      /* v89.138（清单③）：极端载荷（12 兵种）下 shell 的 overflow:hidden 会裁掉记录区底部
         → wrap 改自滚容器、log 改 `flex:1 1 336px`（理想 336 可压缩）+ min-height 140 保底 */
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; \\}/.test(h118)
        && /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h118)
        && /ui\\.BT_LOG_MAX = 64;/.test(uc);
    })());""",
"""    check('§118③/§148 回合记录下移到底 + 16 行：CSS（v89.148：wrap **固定不滚** · log = **底部二分之一**）+ BT_LOG_MAX=64', (function () {
      /* v89.138：极端载荷下记录区底部被裁 → wrap 改自滚 / log 可压缩；
         ⛔ v89.148（老板 3）改口径：「固定回合播报为底部二分之一，位置固定，高度固定」——
         wrap 回 **overflow: hidden**（布局固定不滚）、log = `flex: 0 0 50%`。 */
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; \\}/.test(h118)
        && /\\.bt-log \\{ flex: 0 0 50%; max-height: none; min-height: 0;/.test(h118)
        && /ui\\.BT_LOG_MAX = 64;/.test(uc);
    })());""",
    '③-1 §118③')

# ---------- ③ wrap + log（§119⑥） ----------
rep(
"""    check('§119⑥ 清单③：战场极端载荷兜底（wrap 自滚 + log 可压缩 · v89.141 上限 340）', (function () {
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; \\}/.test(h)
        && /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h);
    })());""",
"""    check('§119⑥/§148 战场布局固定（v89.148：wrap 不滚 + log 底部二分之一 · 旧"自滚/可压缩"口径退役）', (function () {
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; \\}/.test(h)
        && /\\.bt-log \\{ flex: 0 0 50%; max-height: none; min-height: 0;/.test(h);
    })());""",
    '③-2 §119⑥')

# ---------- ③ bt-log（§121② 回合记录降高） ----------
rep(
"""    check('§121② 回合记录降高（250 理想 / 340 上限 / 130 保底；v89.141 补硬上限）', (function () {
      return /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h);
    })());""",
"""    check('§121②/§148 回合记录 = **底部二分之一**（v89.148：flex 0 0 50% · 高度固定不再浮动）', (function () {
      return /\\.bt-log \\{ flex: 0 0 50%; max-height: none; min-height: 0;/.test(h);
    })());""",
    '③-3 §121②')

# ---------- ③ bt-log（§122④） ----------
rep(
"""    check('§122④ 战场记录框硬上限 340px（按建议：不硬钉 250、不无限撑到 425）',
      /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h122));""",
"""    check('§122④/§148 战场记录框 = 底部二分之一（v89.148：固定 50% · 旧"硬上限 340"口径退役）',
      /\\.bt-log \\{ flex: 0 0 50%; max-height: none; min-height: 0;/.test(h122));""",
    '③-4 §122④')

# ---------- ④ 侧栏表头（§120② 源码） ----------
rep(
"""        /* ⚠️ 源码是 `+ ' 队）</div>'` —— 末尾别带上引号（第一版就栽在"多了一个 ' "） */
        && /ui\\.btSideName\\(side\\) \\+ '（' \\+ myList\\.length \\+ ' 队）/.test(body)""",
"""        /* v89.148（老板 3）：「上方这个备注去掉：我军（3 队）、敌军（5 队）」——
           表头只留"我军 / 敌军"（负向断言防它复活）。 */
        && /ui\\.btSideName\\(side\\) \\+ '<\\/div>'/.test(body)
        && !/'（' \\+ myList\\.length \\+ ' 队）'/.test(body)""",
    '④-1 §120② 源码')

# ---------- ④ 侧栏表头（§120② 实测） ----------
rep(
"""      /* v89.140：只列在场（2 格 = 长枪 + 弓）· 无 off 灰暗格 · 表头 N 队 */
      var nOn = (html.match(/class="bt-card"/g) || []).length
        + (html.match(/class="bt-card dead"/g) || []).length;
      return nOn === 2 && html.indexOf('class="bt-card off"') < 0
        && html.indexOf('（2 队）') >= 0;""",
"""      /* v89.140：只列在场（2 格 = 长枪 + 弓）· 无 off 灰暗格；
         v89.148：表头的"（2 队）"备注**已去掉**（老板 3）。 */
      var nOn = (html.match(/class="bt-card"/g) || []).length
        + (html.match(/class="bt-card dead"/g) || []).length;
      return nOn === 2 && html.indexOf('class="bt-card off"') < 0
        && html.indexOf('（2 队）') < 0 && html.indexOf('我军') >= 0;""",
    '④-2 §120② 实测')

# ---------- ④ 侧栏列宽（§121②） ----------
rep(
r"""    check('§121② 战场侧栏两行制 CSS（bt-l1/bt-l2）+ 无图标 + 列宽 1.1/3.8/1.1', (function () {
      return /\.bt-l1, \.bt-l2 \{ display: flex; align-items: center; gap: 4px; min-width: 0; \}/.test(h)
        && /\.bt-board \{ display: grid; grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h)
        && /\.bt-card \{ display: flex; flex-direction: column; gap: 1px; padding: 2px var\(--sp-1\);/.test(h);
    })());""",
r"""    check('§121② 战场侧栏两行制 CSS（bt-l1/bt-l2）+ 无图标 + 列宽 1.1/3.8/1.1', (function () {
      return /\.bt-l1, \.bt-l2 \{ display: flex; align-items: center; gap: 4px; min-width: 0; \}/.test(h)
        && /\.bt-board \{[^}]*grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h)
        && /\.bt-card \{ display: flex; flex-direction: column; gap: 1px; padding: 2px var\(--sp-1\);/.test(h);
    })());""",
    '④-3 §121② 列宽')

# ---------- ⑤ §124① 顶部斗将行退役 ----------
rep(
"""    /* ---- ① 斗将顶部固定行（老板 1） ---- */
    check('§124① 斗将结果**顶部固定一行**（btDuelBarHTML 排在 bt-top 之前 · 文案唯一出口 btDuelLine）', (function () {
      var okSrc = /ui\\.btDuelLine = function/.test(u124)
        && /ui\\.btDuelBarHTML = function/.test(u124)
        && /return ui\\.btDuelBarHTML\\(rec\\) \\+ ui\\.btTopHTML\\(rec, snap\\)/.test(u124)
        && /\\.bt-duelbar \\{/.test(h124);
      var g = (GAME.state.generals || [])[0];
      if (!g) return false;
      var foe = G.makeGeneral('顶部行测乙', 22, 'guard', null, false);
      var ch = DATA.DUEL.chance;
      DATA.DUEL.chance = 1;                      /* 必触发（用完还原） */
      try {
        var d = GAME.battle.rollDuel(g, foe, 's144');
        var line = G.ui.btDuelLine({ sim: { duel: d } });
        var bar = G.ui.btDuelBarHTML({ sim: { duel: d } });
        var log = G.ui.btDuelHTML({ sim: { duel: d } });
        var none = G.ui.btDuelBarHTML({ sim: {} }) + G.ui.btDuelLine(null) + G.ui.btDuelBarHTML(null);
        return okSrc && line.indexOf('战前斗将') >= 0
          && bar.indexOf('bt-duelbar') >= 0 && bar.indexOf('战前斗将') >= 0
          && log.indexOf('bt-ev duel') >= 0
          && none === '';                        /* 未触发 / 无会话 → 顶部不占位 */
      } finally { DATA.DUEL.chance = ch; }
    })());""",
"""    /* ---- ① 斗将播报**只留一处**（v89.148 老板 2：「出现在 2 处，保留回合记录中的就行」） ---- */
    check('§124①/§148 斗将播报**只在回合记录里**（顶部固定行退役 · 文案唯一出口 btDuelLine）', (function () {
      var okSrc = /ui\\.btDuelLine = function/.test(u124)
        && /ui\\.btDuelBarHTML = function/.test(u124) === false      /* 顶部行函数整条删除 */
        && /\\.bt-duelbar \\{/.test(h124) === false                  /* 样式同删 */
        && /return ui\\.btTopHTML\\(rec, snap\\) \\+ ui\\.btBoardHTML\\(snap\\)/.test(u124);
      var g = (GAME.state.generals || [])[0];
      if (!g) return false;
      var foe = G.makeGeneral('顶部行测乙', 22, 'guard', null, false);
      var ch = DATA.DUEL.chance;
      DATA.DUEL.chance = 1;                      /* 必触发（用完还原） */
      try {
        var d = GAME.battle.rollDuel(g, foe, 's144');
        var line = G.ui.btDuelLine({ sim: { duel: d } });
        var log = G.ui.btDuelHTML({ sim: { duel: d } });
        var none = G.ui.btDuelLine(null) + G.ui.btDuelHTML(null) + G.ui.btDuelHTML({ sim: {} });
        var html = G.ui.battlefieldHTML({ id: 'x', sim: { duel: d }, snapLast: null });
        return okSrc && line.indexOf('战前斗将') >= 0
          && log.indexOf('bt-ev duel') >= 0 && log.indexOf('战前斗将') >= 0
          && html.indexOf('bt-duelbar') < 0          /* 战场 HTML 里不再有顶部行 */
          && none === '';                            /* 未触发 / 无会话 → 不占位 */
      } finally { DATA.DUEL.chance = ch; }
    })());""",
    '⑤ §124① 顶部行退役')

assert '\\r\\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ALL OK（' + str(n_ok) + ' 处）· len ' + str(orig_len) + ' -> ' + str(len(s)))
