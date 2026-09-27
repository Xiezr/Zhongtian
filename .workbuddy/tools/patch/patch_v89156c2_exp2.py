# -*- coding: utf-8 -*-
# v89.156 patch C2：main.js「可用道具」动作改名 + index.html 四块改单列
import io

def rep1(path, old, new, tag, marks):
    s = io.open(path, encoding='utf-8', newline='').read()
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        s = s.replace(old, new)
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        print(tag + ' OK')
    elif any(mk in s for mk in marks):
        print(tag + ' skip（已落盘）')
    else:
        raise AssertionError(tag + ' anchor missing')

# ---------- ① main.js：exp-use-item → exp-use-item-pick（读下拉框） ----------
PM = 'E:/Deepseekdb/js/main.js'
OLD1 = (u"      case 'exp-use-item': {\n"
        u"        var _it = el.dataset.item, _gs = document.getElementById('exp-gen');\n"
        u"        var _gid = (_gs && _gs.value) || ui._expGen || '';\n"
        u"        var _r = GAME.systems.useItem(_it, _gid);\n"
        u"        ui.toast(_r.msg || (_r.ok ? '已使用' : '使用失败'));\n"
        u"        if (_r.ok) { ui.refreshExpItems(); ui.updateExpMarch(); }\n"
        u"        break;\n"
        u"      }")
NEW1 = (u"      /* v89.156（老板 2）：可用道具收成下拉框 —— 动作由「按 item 直接点」改「读下拉选择」\n"
        u"         （旧 `exp-use-item` 的按钮形态随 chips 列表一并退役，不留双形态）。 */\n"
        u"      case 'exp-use-item-pick': {\n"
        u"        var _sv = document.getElementById('exp-item-sel');\n"
        u"        var _it = _sv ? _sv.value : '';\n"
        u"        if (!_it) { ui.toast('请先在下拉框选择道具'); break; }\n"
        u"        var _gs = document.getElementById('exp-gen');\n"
        u"        var _gid = (_gs && _gs.value) || ui._expGen || '';\n"
        u"        var _r = GAME.systems.useItem(_it, _gid);\n"
        u"        ui.toast(_r.msg || (_r.ok ? '已使用' : '使用失败'));\n"
        u"        if (_r.ok) { ui.refreshExpItems(); ui.updateExpMarch(); }\n"
        u"        break;\n"
        u"      }")
rep1(PM, OLD1, NEW1, 'main exp-use-item-pick', [u"case 'exp-use-item-pick': {"])

# ---------- ② index.html：.exp-quad 单列 ----------
PH = 'E:/Deepseekdb/index.html'
OLD2 = (u"  .exp-quad { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n"
        u"    gap: var(--sp-3); align-items: start; }")
NEW2 = (u"  /* v89.156（老板 3）：「计略 出征方式 方案 出征战术和挪过来的可用道具不再分两列，\n"
        u"     逐行显示即可」—— 2×2 子网格改**单列**（顺序即版面，与 .exp-col-l 一致）。 */\n"
        u"  .exp-quad { display: grid; grid-template-columns: minmax(0, 1fr);\n"
        u"    gap: var(--sp-3); align-items: start; }")
rep1(PH, OLD2, NEW2, 'html exp-quad 单列', [u"逐行显示即可」—— 2×2 子网格改**单列**"])

# ---------- 自检 ----------
m = io.open(PM, encoding='utf-8', newline='').read()
h = io.open(PH, encoding='utf-8', newline='').read()
assert u"case 'exp-use-item':" not in m, 'old exp-use-item case remains'
assert m.count(u"case 'exp-use-item-pick': {") == 1
assert u'.exp-quad { display: grid; grid-template-columns: minmax(0, 1fr);' in h
print('SELF-CHECK PASS')
