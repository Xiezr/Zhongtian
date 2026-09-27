# -*- coding: utf-8 -*-
"""v89.133 补丁 P2：将领面板状态三行（老板本轮需求 2）
- 体力行：`体力 [上限] 当前 X 全军生命 +Y%` → `体力 当前/上限 [bar] [＋]`（两备注进悬停）
- 攻击行：去「勇武 X ＋ 装备 Y」（移入悬停）；防御行同构（智谋 ＋ 装备 → 悬停）
实测依据（diag_v89133_probe.js）：三行现状 h=46px = **折成两行**（单行 21px）。
跑：python .workbuddy/tools/patch/patch_v89133c_pane.py
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

ui = rd('js/ui.js')

# ---- ① 体力行 ----
old1 = ("      /* v20（需求 5）的规矩在这里同样适用：**页面只放信息型内容**，\n"
        "         \"出征消耗 / 低于 25 不可出征 / 侦查消耗\"这类**规则解说**不常驻页面。\n"
        "         v66：主数字 = 总体体力（上限，含装备与套装）；当前值单独写在右边。 */\n"
        "      '<div class=\"gd-line\" title=\"体力上限 ' + U.numText(staMx, 0) + ' = 等级/资质/内政 '\n"
        "        + U.numText(staMx - staEqNow, 0) + ' ＋ 装备 ' + U.numText(staEqNow, 0)\n"
        "        + '\\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）\">体力 <b>'\n"
        "        + U.numText(staMx, 0) + '</b>' + bar(staPct, '#6a9a4a') +\n"
        "        '<span class=\"gd-hint\">当前 ' + U.numText(staNow, 0) +\n"
        "          '　全军生命 <b style=\"color:var(--green-ok);\">+' + hpBonus + '%</b></span>' +\n")
new1 = ("      /* v20（需求 5）的规矩在这里同样适用：**页面只放信息型内容**，\n"
        "         \"出征消耗 / 低于 25 不可出征 / 侦查消耗\"这类**规则解说**不常驻页面。\n"
        "         v89.133（老板）：「将领的生命，体力行压缩成 1 行，只显示数值 XX/XX 和加号，\n"
        "         '当前 5,673'这个备注不要，'全军生命 +70%'这个备注悬停显示」——\n"
        "         主数字改「当前 / 上限」（实机实测：旧形态 h=46px 折成两行 → 现单行），\n"
        "         两个文字备注全部进悬停（上限构成 + 全军生命 + 回复规则）。 */\n"
        "      '<div class=\"gd-line\" title=\"体力 ' + U.numText(staNow, 0) + ' / ' + U.numText(staMx, 0)\n"
        "        + '（当前 / 上限）\\n上限 = 等级/资质/内政 ' + U.numText(staMx - staEqNow, 0)\n"
        "        + ' ＋ 装备 ' + U.numText(staEqNow, 0)\n"
        "        + '\\n全军生命 +' + hpBonus + '%（体力直接决定全军生命的厚度）'\n"
        "        + '\\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）\">体力 <b>'\n"
        "        + U.numText(staNow, 0) + '</b>/' + U.numText(staMx, 0) + bar(staPct, '#6a9a4a') +\n")
ui = rep1(ui, old1, new1, '① 体力行')

# ---- ② 攻击/防御行 ----
old2 = ("      /* 攻击 / 防御：**合计值 + 构成**（勇武 3,300 ＋ 装备 8,148 = 11,448）——\n"
        "         老板要的\"总数\"，同时一眼能看出装备贡献了多少，不必再单列一行。 */\n"
        "      '<div class=\"gd-line\">攻击 <b>' + U.numText(a.atkVal, 0) + '</b>' +\n"
        "        '<span class=\"gd-hint\">勇武 ' + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' +\n"
        "          U.numText(a.atk, 0) + '</span>' +\n"
        "        '<span class=\"gd-hint\">全军攻击 <b style=\"color:var(--green-ok);\">+' + atkShow + '%</b></span></div>' +\n"
        "      '<div class=\"gd-line\">防御 <b>' + U.numText(a.defVal, 0) + '</b>' +\n"
        "        '<span class=\"gd-hint\">智谋 ' + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' +\n"
        "          U.numText(a.def, 0) + '</span>' +\n"
        "        '<span class=\"gd-hint\">全军防御 <b style=\"color:var(--green-ok);\">+' + defShow + '%</b></span></div>' +\n")
new2 = ("      /* 攻击 / 防御：v89.133（老板）：「'勇武 18,890 ＋ 装备 685'这个备注不要」——\n"
        "         构成（勇武/智谋 × 系数 ＋ 装备）移入**悬停**；行上只留总数 + 全军加成。\n"
        "         防御行为对称处理（同族同改，一并压回单行）。 */\n"
        "      '<div class=\"gd-line\" title=\"攻击 ' + U.numText(a.atkVal, 0) + ' = 勇武 '\n"
        "        + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' + U.numText(a.atk, 0) + '\">攻击 <b>'\n"
        "        + U.numText(a.atkVal, 0) + '</b>' +\n"
        "        '<span class=\"gd-hint\">全军攻击 <b style=\"color:var(--green-ok);\">+' + atkShow + '%</b></span></div>' +\n"
        "      '<div class=\"gd-line\" title=\"防御 ' + U.numText(a.defVal, 0) + ' = 智谋 '\n"
        "        + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' + U.numText(a.def, 0) + '\">防御 <b>'\n"
        "        + U.numText(a.defVal, 0) + '</b>' +\n"
        "        '<span class=\"gd-hint\">全军防御 <b style=\"color:var(--green-ok);\">+' + defShow + '%</b></span></div>' +\n")
ui = rep1(ui, old2, new2, '② 攻防行')

# 自检
assert ui.count("'</b>/' + U.numText(staMx, 0) + bar(staPct") == 1, '体力行新形态缺失'
assert ui.count("'　全军生命 <b style=\"color:var(--green-ok);\">+' + hpBonus") == 0, '旧备注残留'
assert ui.count("'<span class=\"gd-hint\">勇武 ' + U.numText(a.yw * GAME.ATK_PER_YW") == 0, '攻构成残留'
assert ui.count("'<span class=\"gd-hint\">智谋 ' + U.numText(a.zm * GAME.DEF_PER_ZM") == 0, '防构成残留'
wr('js/ui.js', ui)
print('OK · ui.js', len(ui))
