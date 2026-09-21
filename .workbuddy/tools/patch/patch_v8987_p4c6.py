# -*- coding: utf-8 -*-
"""v89.87 需求4c-6：audit 清零 —— data-side→data-bside（避保留名）/ pendingCount 接线"""
import io

P = r'E:\Deepseekdb\js\ui.js'
s = io.open(P, encoding='utf-8', newline='').read()

# ① data-side 是 audit 保留属性名（要求 case 'side'）→ 战场的 DOM 数据属性改 data-bside
old1 = """      return '<div class="bt-unit ' + side + '" data-side="' + side + '" data-troop="' + u.id + '" ' +"""
new1 = """      return '<div class="bt-unit ' + side + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +"""
assert s.count(old1) == 1, ('tpl', s.count(old1))
s = s.replace(old1, new1, 1)

old2 = """        var el = document.querySelector('#bt-field [data-side="' + pair[0] + '"][data-troop="' + u.id + '"]');"""
new2 = """        var el = document.querySelector('#bt-field [data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');"""
assert s.count(old2) == 1, ('place', s.count(old2))
s = s.replace(old2, new2, 1)

old3 = """      var tEl = document.querySelector('#bt-field [data-side="' + (e.side === 'atk' ? 'def' : 'atk') +
        '"][data-troop="' + e.targetId + '"]');"""
new3 = """      var tEl = document.querySelector('#bt-field [data-bside="' + (e.side === 'atk' ? 'def' : 'atk') +
        '"][data-troop="' + e.targetId + '"]');"""
assert s.count(old3) == 1, ('ev', s.count(old3))
s = s.replace(old3, new3, 1)

# ② pendingCount 接线（军务段用它计数 —— 唯一出口）
old4 = """  ui.btPendingBlock = function () {
    var s = GAME.state;
    var list = (s.battles || []).filter(function (b) { return b.state === 'live'; });
    if (!list.length) return null;"""
new4 = """  ui.btPendingBlock = function () {
    var s = GAME.state;
    var n = GAME.battle.pendingCount();          /* 计数走唯一出口 */
    if (!n) return null;
    var list = (s.battles || []).filter(function (b) { return b.state === 'live'; });"""
assert s.count(old4) == 1, ('pend', s.count(old4))
s = s.replace(old4, new4, 1)

old5 = """    return { n: list.length,
      html: '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' };"""
new5 = """    return { n: n,
      html: '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' };"""
assert s.count(old5) == 1, ('ret', s.count(old5))
s = s.replace(old5, new5, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK ui.js data-bside + pendingCount 接线')
