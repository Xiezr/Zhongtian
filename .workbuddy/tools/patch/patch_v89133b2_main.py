# -*- coding: utf-8 -*-
"""v89.133 补丁 P1b-2：main.js（P1b 的 ui.js 部分已落盘，本补丁只动 main.js）
跑：python .workbuddy/tools/patch/patch_v89133b2_main.py
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

old_ts = ("      case 'tactic-set': {\n"
          "        /* v89.109：战术分侧（atk = 出征 / def = 防守）—— chip 带 data-side */\n"
          "        var tSide = el.dataset.tside === 'def' ? 'def' : 'atk';\n"
          "        /* 「出城迎战」= 开关（不是互斥组）：取反 → 就地切视觉，不重绘整页 */\n"
          "        if (el.dataset.f === 'sortie') {\n"
          "          var TT = GAME.tacticsOf(tSide)[el.dataset.troop] || {};\n"
          "          GAME.setTactic(tSide, el.dataset.troop, { sortie: !TT.sortie });\n"
          "          el.classList.toggle('on');\n"
          "          break;\n"
          "        }\n"
          "        /* 点选即存：同组互斥只切 class、不重绘（与全站点选一致） */\n"
          "        var tg = el.dataset.g;\n"
          "        if (tg) {\n"
          "          var same = document.querySelectorAll('[data-action=\"tactic-set\"][data-g=\"' + tg + '\"]');\n"
          "          for (var ti = 0; ti < same.length; ti++) same[ti].classList.toggle('on', same[ti] === el);\n"
          "        }\n"
          "        var tp = {};\n"
          "        if (el.dataset.f === 's') tp.s = el.dataset.v;\n"
          "        else if (el.dataset.f === 't') tp.t = el.dataset.v;\n"
          "        GAME.setTactic(tSide, el.dataset.troop, tp);\n"
          "        break;\n"
          "      }\n")
new_ts = ("      case 'tactic-set': {\n"
          "        /* v89.133（第 13 条）：控件 chip → **select / checkbox** ——\n"
          "           值分别读 el.value / el.checked；旧 chip 的「就地切 class」不再需要\n"
          "           （原生控件自管选中态）。data-f：s=动作 · t=目标 · sortie=出城迎战。 */\n"
          "        var tSide = el.dataset.tside === 'def' ? 'def' : 'atk';\n"
          "        if (el.dataset.f === 'sortie') {\n"
          "          var TT = GAME.tacticsOf(tSide)[el.dataset.troop] || {};\n"
          "          var _sv = (el.tagName === 'INPUT') ? !!el.checked : !TT.sortie;\n"
          "          GAME.setTactic(tSide, el.dataset.troop, { sortie: _sv });\n"
          "          if (el.tagName !== 'INPUT') el.classList.toggle('on');\n"
          "          break;\n"
          "        }\n"
          "        var tp = {};\n"
          "        var _tv = (el.tagName === 'SELECT') ? el.value : el.dataset.v;\n"
          "        if (el.dataset.f === 's') tp.s = _tv;\n"
          "        else if (el.dataset.f === 't') tp.t = _tv;\n"
          "        GAME.setTactic(tSide, el.dataset.troop, tp);\n"
          "        break;\n"
          "      }\n")
mj = rep1(mj, old_ts, new_ts, 'm7 tactic-set')

old_del = ("    document.addEventListener('change', function (e) {\n"
           "      var el = e.target;\n"
           "      if (el && el.tagName === 'SELECT' && el.getAttribute && el.getAttribute('data-action')) {\n"
           "        GAME.action(el.getAttribute('data-action'), el);\n"
           "      }\n"
           "    });\n")
new_del = ("    document.addEventListener('change', function (e) {\n"
           "      var el = e.target;\n"
           "      /* v89.133：复选框同走动作表（战术「出城迎战」是首个勾选项） */\n"
           "      var _hit = el && el.getAttribute && el.getAttribute('data-action') &&\n"
           "        (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type === 'checkbox'));\n"
           "      if (_hit) GAME.action(el.getAttribute('data-action'), el);\n"
           "    });\n")
mj = rep1(mj, old_del, new_del, 'm8 change 委托')

old_mt = ("      /* v89.104（老板）军务页签：只换正文，动作全复用既有出口 */\n"
          "      case 'march-tab': {\n"
          "        ui._marchTab = el.dataset.v || 'over';\n"
          "        GAME.refreshView();\n"
          "        break;\n"
          "      }\n")
new_mt = (old_mt +
          "      /* v89.133（第 14 条）：防守页内两小页（全境防御 / 防守战术） */\n"
          "      case 'def-sub': ui._defSub = el.dataset.v === 'tac' ? 'tac' : 'over'; GAME.refreshView(); break;\n")
mj = rep1(mj, old_mt, new_mt, 'm9 def-sub')

assert mj.count("case 'def-sub'") == 1
assert mj.count("_tv = (el.tagName === 'SELECT')") == 1
assert mj.count("el.type === 'checkbox'") == 1
wr('js/main.js', mj)
print('OK · main.js', len(mj))
