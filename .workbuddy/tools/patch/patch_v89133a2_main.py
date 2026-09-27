# -*- coding: utf-8 -*-
"""v89.133 补丁 P1a-2：main.js（P1a 的 ui.js 部分已落盘，本补丁只动 main.js）
跑：python .workbuddy/tools/patch/patch_v89133a2_main.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

mj = rd('js/main.js')

old_c1 = ("      /* 校场（v21 需求 1：伤兵营归属军事建筑与行军，不再挂设置） */\n"
          "      case 'open-xiaochang': ui.openXiaochang(); break;\n")
new_c1 = ("      /* v89.133（v89.128 第二批第 10 条）：「校场不要现在的界面功能，点击建筑功能\n"
          "         直接进入'军务'界面」—— 校场面板退役，点建筑功能 = 切到军务视图。 */\n"
          "      case 'open-xiaochang': ui.setView('marches'); ui._marchTab = 'over'; break;\n")
mj = rep1(mj, old_c1, new_c1, 'm1 校场落点')

old_c2 = "      case 'xiaochang-exp': ui.closeModal(); ui.setView('map'); break;\n"
new_c2 = ("      /* ⛔ v89.133 退役：'xiaochang-exp'（校场面板的「出兵地图」）—— 面板退役，\n"
          "         出兵入口 = 地图点选 / 「军务 · 出征」页。 */\n")
mj = rep1(mj, old_c2, new_c2, 'm2 出兵地图退役')

old_c3 = "      case 'xc-spar': { var _xs = GAME.xcSpar(ui._xcGen); ui.toast(_xs.msg); ui.openXiaochang(); break; }\n"
new_c3 = ("      /* v89.133：练兵块迁到「出征战术」页尾 —— 重开面板改重绘当前视图 */\n"
          "      case 'xc-spar': { var _xs = GAME.xcSpar(ui._xcGen); ui.toast(_xs.msg); GAME.refreshView(); break; }\n")
mj = rep1(mj, old_c3, new_c3, 'm3 xc-spar')

old_c4 = "      case 'xc-review': { var _xr = GAME.xcReview(); ui.toast(_xr.msg); ui.openXiaochang(); break; }\n"
new_c4 = "      case 'xc-review': { var _xr = GAME.xcReview(); ui.toast(_xr.msg); GAME.refreshView(); break; }\n"
mj = rep1(mj, old_c4, new_c4, 'm4 xc-review')

old_c5 = ("      case 'jieyue-xc': {\n"
          "        var _jxR = GAME.jieyueExpand('xc', el.dataset.city);\n"
          "        ui.toast((_jxR.ok ? '🪓 ' : '⚠️ ') + _jxR.msg);\n"
          "        if (_jxR.ok) { GAME.refreshAll(); ui.openXiaochang(); }\n"
          "        break;\n"
          "      }\n")
new_c5 = ("      case 'jieyue-xc': {\n"
          "        var _jxR = GAME.jieyueExpand('xc', el.dataset.city);\n"
          "        ui.toast((_jxR.ok ? '🪓 ' : '⚠️ ') + _jxR.msg);\n"
          "        /* v89.133：入口在「军务 · 出征」页 —— refreshAll 重绘当前视图即可 */\n"
          "        if (_jxR.ok) GAME.refreshAll();\n"
          "        break;\n"
          "      }\n"
          "      /* v89.133（v89.128 第二批第 9/11 条）：出征页 —— 选目标 / 进军队行动 / 练兵选将 */\n"
          "      case 'exp-act-target': ui._actTarget = Number(el.value) || 0; break;\n"
          "      case 'exp-act-go': {\n"
          "        var _atl = ui.actTargetsOf(GAME.currentCity());\n"
          "        var _at = _atl[Number(ui._actTarget) || 0];\n"
          "        if (!_at) { ui.toast('请先选择目标'); break; }\n"
          "        ui.openExpModal(_at.tg);\n"
          "        break;\n"
          "      }\n"
          "      case 'xc-gen-pick': ui._xcGen = el.value; GAME.refreshView(); break;\n")
mj = rep1(mj, old_c5, new_c5, 'm5 jieyue-xc + 新动作')

# m6：doHeal 的 'xiaochang' 宿主分支随面板退役（死代码整条删）
old_c6 = ("    var host = document.querySelector('#modal-root [data-heal-host]');\n"
          "    var k = host ? host.dataset.healHost : '';\n"
          "    if (k === 'xiaochang') ui.openXiaochang();\n"
          "    else if (k === 'marches') ui.openMarches();\n")
new_c6 = ("    var host = document.querySelector('#modal-root [data-heal-host]');\n"
          "    var k = host ? host.dataset.healHost : '';\n"
          "    /* v89.133：'xiaochang' 宿主随校场面板退役（woundedBlock('xiaochang') 已删）——\n"
          "       现只剩行军队列弹窗这一个 host。 */\n"
          "    if (k === 'marches') ui.openMarches();\n")
mj = rep1(mj, old_c6, new_c6, 'm6 doHeal 宿主')

assert mj.count('openXiaochang') == 0, 'main 里 openXiaochang 残留'
assert mj.count("case 'exp-act-go'") == 1
wr('js/main.js', mj)
print('OK · main.js', len(mj))
