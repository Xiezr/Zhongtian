# -*- coding: utf-8 -*-
# v89.152e：ui.js openLandModal —— 产出行拆 4 行 / 删备注行 / 按钮文案 / 已占不显示产出
import io, re

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

# ---------- 段 1：add 数据源与 addStr 格式 ----------
A_OLD = u"    var add = GAME.wildAddOf(tile.terrain, lv) || {};\n    var addStr = '';\n    for (var r in add) addStr += '（' + (RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%）';"
A_NEW = u"""    /* v89.152：加成数据源统一为 _terKey139（野地记录优先）—— 与结算侧（state.js 读 w.type）同源 */
    var add = GAME.wildAddOf(_terKey139, lv) || {};
    var addStr = '';
    /* v89.152：产出行拆行后不再需要括号包裹，多资源用全角空格分隔 */
    for (var r in add) addStr += (addStr ? '　' : '') + (RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%';"""
if u"addStr += (addStr ? '　' : '')" not in s:
    assert s.count(A_OLD) == 1, 'A count=' + str(s.count(A_OLD))
    s = s.replace(A_OLD, A_NEW)
    print('A: add source + addStr fmt')
else:
    print('A: skip')

# ---------- 段 2：addLine139 退役 ----------
B_OLD = u"""    /* v89.139（老板 3）：「产量加成放在此地可采那行后边」——
       从标题下的居中行挪进 note（与"可采清单"同处一行，信息成组）。 */
    var addLine139 = addStr ? '　产量加成 ' + addStr : '';
"""
B_NEW = u"""    /* ⛔ v89.152（老板 1）：`addLine139`（产量加成并入 note 行）退役 ——
       产出行拆为独立 4 行（资源/产量加成/材料/珠宝），产量加成有自己的行。 */
"""
if u"`addLine139`（产量加成并入 note 行）退役" not in s:
    assert s.count(B_OLD) == 1, 'B count=' + str(s.count(B_OLD))
    s = s.replace(B_OLD, B_NEW)
    print('B: drop addLine139')
else:
    print('B: skip')

# ---------- 段 3：note 块退役（替换为注释墓碑） ----------
C_OLD = u"""    var note = gatherRes
      ? '此地可采：<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>' +
        (matNames ? '　材料：' + matNames : '') +
        (jewelNames135.length ? '　珠宝：<b style="color:var(--gold-light)">' + jewelNames135.join(' · ') + '</b>' + jewelLvHint139 : '') +
        addLine139
      : '此地为平地，<b>无可采之物</b>' + (addLine139 ? '；' + addLine139 : '') +
        '（已占后可筑新城）。';
"""
C_NEW = u"""    /* ⛔ v89.152（老板 1）：`note` 单行块退役 —— 未占面板的产出改在下方 prodBox 里**分行呈现**
       （资源 / 产量加成 / 材料 / 珠宝 四行）；已占面板不再显示产出行（老板 5）。 */
"""
if u"未占面板的产出改在下方 prodBox 里**分行呈现**" not in s:
    assert s.count(C_OLD) == 1, 'C count=' + str(s.count(C_OLD))
    s = s.replace(C_OLD, C_NEW)
    print('C: drop note')
else:
    print('C: skip')

# ---------- 段 4：未占分支（含 prodBox 与按钮文案） ----------
D_OLD = u"""    /* ---------- 未占领：只给出兵入口 ---------- */
    if (!owned) {
      ui.openModal(
        '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        '<div class="note">' + note + '</div>' +
        /* v89.83（老板「占领后就自动驻军，直至召回；掠夺则直接撤军」）——
           两种目的在这里说清，省得点进去才发现兵回不回城是另一件事。
           v89.86（整改 P-11）：Lv0 野地驻军上限为 0 —— 文案按等级动态，
           不能再写"就地驻守"（与实际"军队全回城"落差太大，老板实测记下）。 */
        '<div class="op-hint" style="text-align:center;">🚩 <b>占领</b>：' +
          (lv > 0
            ? '打下来后军队就地驻守（守地不衰减，直至召回）'
            : '<b style="color:var(--warn);">Lv0 无驻军位</b>（军队打完回城；升到 Lv1+ 才有驻军位）') +
          '　·　🔥 <b>掠夺</b>：打完直接撤军</div>' +
        wsurvLine + (GAME.jianghuWildMounted ? ui.jianghuHTML(x, y) : '') +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="scout">🔭 侦查</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="raid">🔥 掠夺</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="occupy">🚩 占领并驻守</button>' +
          '<button class="btn" data-action="close-modal">关闭</button></div>'
      );
      return;
    }"""
D_NEW = u"""    /* ---------- 未占领：产出行（4 行）+ 出兵入口（v89.152 老板 1/3/4） ----------
       老板：「1.产出分行呈现资源，产量加成，材料，珠宝；
       3.不要显示这行备注：🚩 占领：Lv0 无驻军位（军队打完回城；升到 Lv1+ 才有驻军位）　·　🔥 掠夺：打完直接撤军；
       4.侦察，掠夺，占领（不用占领并驻守）固定放菜单底部」——
       原「此地可采…」单行 note 与"占领/掠夺"备注行整条退役；三键固定弹窗底部。 */
    if (!owned) {
      var prodBox =
        '<div class="op-zone op-zone-eq"><div class="op-zone-t">产出</div>' +
        '<div class="attr"><span class="k">资源</span><span class="v">' +
          (gatherRes
            ? '<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>（占领后可派军采集）'
            : '<span class="ui-sub">无可采之物（平原不可采集）</span>') +
        '</span></div>' +
        '<div class="attr"><span class="k">产量加成</span><span class="v">' +
          (addStr || '<span class="ui-sub">—</span>') + '</span></div>' +
        '<div class="attr"><span class="k">材料</span><span class="v">' +
          (matNames || '<span class="ui-sub">—</span>') + '</span></div>' +
        '<div class="attr"><span class="k">珠宝</span><span class="v">' +
          (jewelNames135.length
            ? '<b style="color:var(--gold-light)">' + jewelNames135.join(' · ') + '</b>' + jewelLvHint139
            : '<span class="ui-sub">—</span>') +
        '</span></div>' +
        (tile.terrain === 'plain' ? '<div class="q-empty">💡 平原：占领后可在其上筑新城</div>' : '') +
        '</div>';
      ui.openModal(
        '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        prodBox +
        wsurvLine + (GAME.jianghuWildMounted ? ui.jianghuHTML(x, y) : '') +
        /* v89.152（老板 4）：三键固定放菜单底部；文案「占领」（不带"并驻守"） */
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="scout">🔭 侦查</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="raid">🔥 掠夺</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="occupy">🚩 占领</button>' +
          '<button class="btn" data-action="close-modal">关闭</button></div>'
      );
      return;
    }"""
if u'<div class="op-zone-t">产出</div>' not in s:
    assert s.count(D_OLD) == 1, 'D count=' + str(s.count(D_OLD))
    s = s.replace(D_OLD, D_NEW)
    print('D: unoccupied branch')
else:
    print('D: skip')

# ---------- 段 5：已占分支删 note 行 ----------
E_OLD = u"""      '<div class="note">' + note + '</div>' +
      wsurvLine + (GAME.jianghuWildMounted ? ui.jianghuHTML(x, y) : '') +
      stat + gatherBox + ops +"""
E_NEW = u"""      wsurvLine + (GAME.jianghuWildMounted ? ui.jianghuHTML(x, y) : '') +
      stat + gatherBox + ops +"""
if u"'<div class=\"note\">' + note + '</div>' +\n      wsurvLine" in s:
    assert s.count(E_OLD) == 1, 'E count=' + str(s.count(E_OLD))
    s = s.replace(E_OLD, E_NEW)
    print('E: occupied branch')
else:
    print('E: skip')

# ---------- 段 6：已占注释末句更新 ----------
F_OLD = u"""       （守军只在**未占领**时的出击面板里有意义）。产量加成已并入上方 note 行。 */"""
F_NEW = u"""       （守军只在**未占领**时的出击面板里有意义）。
       v89.152（老板 5）：**已占野地不显示产出行**（产出是"要不要打"的决策信息，
       已在占领那一刻完成使命）—— 原 note 整行退役。 */"""
if u"已占野地不显示产出行" not in s:
    assert s.count(F_OLD) == 1, 'F count=' + str(s.count(F_OLD))
    s = s.replace(F_OLD, F_NEW)
    print('F: comment')
else:
    print('F: skip')

# ---------- 写盘 + 自检 ----------
def cb(t):
    return (len(re.findall(r'(?<![\\^])\{', t)), len(re.findall(r'(?<![\\^])\}', t)))
assert cb(s) == cb(io.open(P, encoding='utf-8', newline='').read()), 'brace changed'
io.open(P, 'w', encoding='utf-8', newline='').write(s)

chk = io.open(P, encoding='utf-8', newline='').read()
# 判据用"可执行形态"（注释里引用了老板原话"不用占领并驻守"，裸名会误伤 —— 本仓老坑）
assert u'data-mode="occupy">🚩 占领</button>' in chk, 'new button text missing'
assert u'data-mode="occupy">🚩 占领并驻守</button>' not in chk, 'old button text remains'
assert u"op-hint\" style=\"text-align:center;\">🚩 <b>占领</b>" not in chk
assert chk.count(u'<div class="op-zone-t">产出</div>') == 1
assert chk.count(u'var note = gatherRes') == 0
print('OK len %d -> %d' % (orig, len(chk)))
