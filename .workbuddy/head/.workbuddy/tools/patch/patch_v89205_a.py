# -*- coding: utf-8 -*-
# v89.205 批次 A：挂件行（将领名称信息下的「🔮 宝具」行）整行退役 + 卸下迁入选择窗
# 锚点纪律：每段先 count==1 预检；幂等 guard = 新特征计数（§99.1）。
import io, sys

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    assert '\r\n' not in s, 'CRLF leak!'          # 保真 LF（§42.2）
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

UI = 'E:/Deepseekdb/js/ui.js'
MAIN = 'E:/Deepseekdb/js/main.js'

# ---------------- A1: 删 attachLines186 定义块（含块头注释），换墓碑 ----------------
s = rd(UI)
if 'var attachLines186' not in s:      # 可执行形态判定（墓碑注释里含裸名，别用裸名当 guard —— §67.2）
    print('[skip] A1 attachLines186 已退役')
else:
    start = s.index('    /* v89.186（老板 1）：**挂件行（宝具）** —— 按 DATA.ATTACH_SLOTS 遍历渲染')
    end = s.index('    /* v89.188（老板 2）：「资质晋升', start)
    tomb = (
        '    /* ⛔ v89.205（老板）：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」\n'
        '       —— 挂件行（.gp-sub.gp-attach186）**整行退役**：已佩回显 / 佩上 / 更换 / 卸下\n'
        '       四件全部收进装备栏标题行的「🔮 宝具」入口（ui.openAttachPick 选择窗）：\n'
        '       窗内「当前：X（效果）」承担回显 · 点其他件即更换 · 已佩行改「卸下」按钮（同轮迁入）·\n'
        '       库存空态文案承担来源说明。沿革：v89.186 建（挂件行 + 面板行内换/卸）→\n'
        '       v89.194 未佩备注行下线 → v89.205 整行退役。 */\n'
    )
    s = s[:start] + tomb + s[end:]
    wr(UI, s)
    print('[ok] A1 挂件行定义块退役（含墓碑）')

# ---------------- A2: 删 html 拼接里的 attachLines186 + ----------------
s = rd(UI)
if '          attachLines186 +\n' not in s:
    print('[skip] A2 拼接行已删')
else:
    old = '          attachLines186 +\n'
    assert s.count(old) == 1, 'A2 count=' + str(s.count(old))
    new = ('          /* ⛔ v89.205：attachLines186（挂件行）已整行退役 —— 入口在装备栏「🔮 宝具」按钮\n'
           '             （点开选择窗：佩 / 换 / 卸 / 合成；详见上方墓碑）。 */\n')
    s = s.replace(old, new)
    wr(UI, s)
    print('[ok] A2 拼接行退役')

# ---------------- A3: 卸下迁入选择窗「当前件」行（列表行保持原样） ----------------
# 设计说明（探针 ④ 抓出的修正）：列表只列**库存 > 0** 的件 —— 单件宝具装上后库存归零、
# 列表为空，卸下若挂列表行则永远够不着。因此卸下挂在「当前：X」行（当前佩的那一件）。
s = rd(UI)
if ">卸下</button>'\n          : '当前未佩'" in s:
    print('[skip] A3 卸下已迁入当前件行')
else:
    old_cur = "        (cur ? '当前：<b>' + U.escape(cur.name) + '</b>（' + U.escape(ui.attachEffDesc186(cur)) + '）' : '当前未佩') + '</div>' +"
    assert s.count(old_cur) == 1, 'A3 count=' + str(s.count(old_cur))
    new_cur = (
        "        /* v89.205（老板）：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」——\n"
        "           面板挂件行退役，卸下入口迁入本窗「当前件」行。为何不挂列表行：列表只列**库存 > 0**\n"
        "           的件，单件宝具装上后库存归零、列表为空 —— 卸下必须挂在\"当前佩的那一件\"上。\n"
        "           （列表行保留「已佩(置灰) / 佩上」原语义：库里还有同款时的状态表达与再佩入口。） */\n"
        "        (cur\n"
        "          ? '当前：<b>' + U.escape(cur.name) + '</b>（' + U.escape(ui.attachEffDesc186(cur)) + '）' +\n"
        "            '<button class=\"btn sm red\" data-action=\"attach-off\" data-gen=\"' + genId +\n"
        "            '\" data-slot=\"' + slotId + '\">卸下</button>'\n"
        "          : '当前未佩') + '</div>' +"
    )
    s = s.replace(old_cur, new_cur)
    wr(UI, s)
    print('[ok] A3 卸下迁入当前件行')

# ---------------- A4: 装备栏「🔮 宝具」按钮 title 补「佩/换/卸」 ----------------
s = rd(UI)
old_t = "+ ' title=\"宝具：与装备并行的增幅挂件（打据点 / 名城缴获；选择窗内可合成 2 低=中 · 2 中=高）\">🔮 宝具</button>' +"
if '点开可佩 / 换 / 卸' in s:
    print('[skip] A4 title 已更新')
else:
    assert s.count(old_t) == 1, 'A4 count=' + str(s.count(old_t))
    new_t = "+ ' title=\"宝具：与装备并行的增幅挂件（打据点 / 名城缴获）。点开可佩 / 换 / 卸（窗内已佩件可卸下）；窗内可合成 2 低=中 · 2 中=高\">🔮 宝具</button>' +"
    s = s.replace(old_t, new_t)
    wr(UI, s)
    print('[ok] A4 title 更新')

# ---------------- A5: main.js doDetach 重开选择窗 + 注释更新 ----------------
s = rd(MAIN)
if 'doDetach 同迁入选择窗' in s:
    print('[skip] A5 doDetach 已更新')
else:
    old_c = ('  /* v89.186（老板 1）：挂件装/卸（宝具）——与 doEquip 同构：真调出口 → toast → 刷新。\n'
             '     doAttach 在**选择窗内**执行（装完关窗回将领页）；doDetach 在面板行内直接点。 */')
    assert s.count(old_c) == 1, 'A5c count=' + str(s.count(old_c))
    new_c = ('  /* v89.186（老板 1）：挂件装/卸（宝具）——与 doEquip 同构：真调出口 → toast → 刷新。\n'
             '     doAttach 在**选择窗内**执行（装完关窗回将领页）；\n'
             '     v89.205（老板）：doDetach 同迁入选择窗（面板挂件行退役）——执行后**重开本窗刷新**。 */')
    s = s.replace(old_c, new_c)
    old_f = ('  GAME.doDetach = function (genId, slotId) {\n'
             '    var g = null;\n'
             '    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) g = x; });\n'
             '    var r = GAME.attachUnequip(g, slotId);\n'
             '    ui.toast(r.msg);\n'
             '    if (r.ok) GAME.refreshAll();\n'
             '  };')
    assert s.count(old_f) == 1, 'A5f count=' + str(s.count(old_f))
    new_f = ('  GAME.doDetach = function (genId, slotId) {\n'
             '    var g = null;\n'
             '    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) g = x; });\n'
             '    var r = GAME.attachUnequip(g, slotId);\n'
             '    ui.toast(r.msg);\n'
             '    if (r.ok) {\n'
             '      GAME.refreshAll();\n'
             '      /* v89.205（老板）：面板挂件行退役 —— 卸下入口迁入选择窗（窗内已佩件的「卸下」键）。\n'
             '         执行后重开本窗刷新（"当前"行 / 列表「卸下↔佩上」/ 计数）——与 doBaoFuse 同款；\n'
             '         不关窗（留窗便于"卸旧→佩新"连续操作）。 */\n'
             '      if (ui._attachGen186 === genId && ui._attachSlot186 === slotId) ui.openAttachPick(genId, slotId);\n'
             '    }\n'
             '  };')
    assert s.count(old_f) == 1, 'A5f2 count=' + str(s.count(old_f))
    s = s.replace(old_c, new_c)
    s = s.replace(old_f, new_f)
    wr(MAIN, s)
    print('[ok] A5 doDetach 重开选择窗')

print('=== A 批完成 ===')
