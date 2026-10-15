# -*- coding: utf-8 -*-
"""v89.210 补丁 C —— main.js：
   ① keydown：转发 modalKeyNav（弹窗键盘流）+ Shift+1~5 续号
   ② case 'exp-sim'（战前推演）+ case 'sky-go'（状态条跳转）
   ③ 读档失败文案（含"存档损坏"态）
   ④ 版本号 v89.210
"""
import io

P = 'E:/Deepseekdb/js/main.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(s)


def sec(tag, old, new, mark, cnt=1):
    global s
    if mark in s:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)


# ---------------- C1a: keydown 转发 modalKeyNav ----------------
sec('C1a modalKeyNav 转发',
    "      var _tn207 = (e.target && e.target.tagName) || '';",
    "      /* v89.210（规划二）：弹窗键盘流 —— Tab 焦点圈 / Enter 激活 div[data-action]。\n"
    "         放在输入态守卫之前（弹窗内输入框的 Tab 也要圈住）；无弹窗时自然空转。 */\n"
    "      if (ui.modalKeyNav && ui.modalKeyNav(e)) return;\n"
    "      var _tn207 = (e.target && e.target.tagName) || '';",
    'ui.modalKeyNav && ui.modalKeyNav(e)')

# ---------------- C1b: Shift+1~5 续号 ----------------
sec('C1b Shift 续号',
    '      var _n207 = parseInt(e.key, 10);',
    "      /* v89.210（规划一 · 老板「按建议执行」）：Shift+1~5 → 第 10~14 个页签\n"
    "         （史册 / 故事集 / 公文 / 自动 / 设置）—— 1-9 不动，纯续号、零记忆成本。\n"
    "         判定用 e.code（布局无关）：Shift 下 e.key 会变 !@#$%，不能按字符判。 */\n"
    "      if (e.shiftKey && /^Digit([1-5])$/.test(e.code || '')) {\n"
    "        var _vi210 = ['story', 'stories', 'reports', 'auto', 'settings'];\n"
    "        ui.setView(_vi210[Number((e.code || '').slice(5)) - 1]);\n"
    "        e.preventDefault();\n"
    "        return;\n"
    "      }\n"
    '      var _n207 = parseInt(e.key, 10);',
    '_vi210 = ')

# ---------------- C2: case exp-sim ----------------
sec('C2 case exp-sim',
    "      case 'exp-confirm': GAME.doExpConfirm(); break;",
    "      case 'exp-confirm': GAME.doExpConfirm(); break;\n"
    "      /* v89.210：战前推演（出征前预演一场 · 与实战同源引擎、不落账） */\n"
    "      case 'exp-sim': ui.openExpSim(); break;",
    "case 'exp-sim': ui.openExpSim(); break;")

# ---------------- C3: case sky-go ----------------
sec('C3 case sky-go',
    "      case 'open-store': ui.openStore(); break;",
    "      case 'open-store': ui.openStore(); break;\n"
    "      /* v89.210（规划三）：环境状态条 chip 点击 → 跳对应页 / 面板（data-go / data-city） */\n"
    "      case 'sky-go': {\n"
    "        var _go210 = el.dataset.go;\n"
    "        if (_go210 === 'marches') { ui._marchTab = 'beacon'; ui.setView('marches'); }\n"
    "        else if (_go210 === 'city') { if (el.dataset.city) ui.setCity(el.dataset.city); ui.setView('city'); }\n"
    "        else if (_go210 === 'store') { ui.openStore(); }\n"
    "        break;\n"
    "      }",
    "case 'sky-go': {")

# ---------------- C4: 读档失败文案 ----------------
sec('C4 读档文案',
    "    if (!st) { ui.toast('读取失败：该槽位为空，或存档版本不符'); return; }",
    "    if (!st) { ui.toast('读取失败：该槽位为空，或存档已损坏（版本不符 / 数据不完整）'); return; }",
    '或存档已损坏')

# ---------------- C5: 版本号 ----------------
sec('C5 版本号',
    "  GAME.VERSION = 'v89.209';",
    "  GAME.VERSION = 'v89.210';",
    "GAME.VERSION = 'v89.210';")

for mk in ['ui.modalKeyNav && ui.modalKeyNav(e)', '_vi210 = ', "case 'exp-sim': ui.openExpSim(); break;",
           "case 'sky-go': {", '或存档已损坏', "GAME.VERSION = 'v89.210';"]:
    assert mk in s, '缺标记：' + mk
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('写入完成 ' + str(n0) + ' -> ' + str(len(s)) + ' 字节')
print('done')
