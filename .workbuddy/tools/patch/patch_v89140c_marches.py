# -*- coding: utf-8 -*-
"""v89.140 批三：军务总览（去驻守野地/采集队块 + 去统计行 + 城内表改兵种表头）+ 校场关菜单"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:30]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp140'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:60]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


patch('js/ui.js', [
    # ① 城内表：改"城池 + 合计 + 各兵种列"
    ("""    /* ---------- ① 城内（全境各城在城兵力） ---------- */
    var cityTot = 0;
    var cityRows = (s.cities || []).map(function (ct) {
      var tot = 0, parts = [];
      Object.keys(ct.army || {}).forEach(function (k) {
        var n = ct.army[k] || 0;
        if (n <= 0) return;
        tot += n; cityTot += n;
        parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.numText(n, 0));
      });
      return '<tr><td>' + U.escape(ct.name) +
        ((GAME.isMainCity && GAME.isMainCity(ct)) ? ' <span class="city-tier mt">主城</span>' : '') +
        ((c && ct.id === c.id) ? ' <span style="color:var(--gold-light);font-size:var(--fs-cap);">当前</span>' : '') + '</td>' +
        '<td class="num">' + U.numText(tot, 0) + '</td>' +
        '<td style="color:var(--text-dim);font-size:var(--fs-sub);">' +
          ((parts.slice(0, 6).join(' · ') + (parts.length > 6 ? ' …' : '')) || '—') + '</td></tr>';
    }).join('');
    var cityBlock = (s.cities || []).length
      ? '<table class="tbl"><thead><tr><th>城池</th><th class="num">在城兵力</th><th>兵种明细</th></tr></thead><tbody>' + cityRows + '</tbody></table>'
      : '<div class="q-empty">尚无城池。</div>';""",
     """    /* ---------- ① 城内（v89.140 老板 2：表头 = 各兵种名称，逐格显示数量） ----------
       老板原话：「兵种明显直接增加表头为各兵种名称，分别显示数量。**固定行宽**，
       超过 1W 的以万缩略显示」——
       · 列 = 全境**出现过**的兵种（按 DATA.TROOPS 顺序；没兵的兵种不占列）；
       · 数量一律走 `U.fmt`（≥1 万 → X.X 万；< 1 万千分位）；
       · 列宽固定（CSS `.mc-tbl`，table-layout: fixed）—— 数量长短不再撑动版式。 */
    var troopCols = Object.keys(DATA.TROOPS).filter(function (tid) {
      if (DATA.TROOPS[tid].nocombat) return false;
      return (s.cities || []).some(function (ct) { return ((ct.army || {})[tid] || 0) > 0; });
    });
    var cityRows = (s.cities || []).map(function (ct) {
      var cells = troopCols.map(function (tid) {
        var n = (ct.army || {})[tid] || 0;
        return '<td class="num">' + (n > 0 ? U.fmt(n) : '<span style="opacity:.25;">—</span>') + '</td>';
      }).join('');
      return '<tr><td class="mc-name">' + U.escape(ct.name) +
        ((GAME.isMainCity && GAME.isMainCity(ct)) ? ' <span class="city-tier mt">主城</span>' : '') +
        ((c && ct.id === c.id) ? ' <span style="color:var(--gold-light);font-size:var(--fs-cap);">当前</span>' : '') + '</td>' +
        '<td class="num">' + U.fmt(GAME.armyTotal(ct)) + '</td>' + cells + '</tr>';
    }).join('');
    var cityBlock = (s.cities || []).length
      ? '<table class="tbl mc-tbl"><thead><tr><th class="mc-name">城池</th><th class="num">合计</th>' +
        troopCols.map(function (tid) { return '<th class="num">' + U.escape(DATA.TROOPS[tid].name) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + cityRows + '</tbody></table>'
      : '<div class="q-empty">尚无城池。</div>';""",
     '城内表兵种表头'),

    # ② 删"② 驻守野地"块
    ("""    /* ---------- ② 驻守野地 ---------- */
    var garList = (s.wilds || []).filter(function (w) { return GAME.wildGarrisonTotal(w.garrison) > 0; });
    var garTot = 0;
    var garRows = garList.map(function (w) {
      var terr = DATA.TERRAIN[w.type] || { name: w.type };
      var gn = GAME.wildGarrisonTotal(w.garrison);
      garTot += gn;
      var troops = (w.garrison && w.garrison.troops) || {};
      var parts = [];
      Object.keys(troops).forEach(function (k) { if (troops[k] > 0) parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.numText(troops[k], 0)); });
      var gcity = (w.garrison && w.garrison.cityId) ? GAME.cityById(w.garrison.cityId) : null;
      return '<tr><td>' + terr.name + ' Lv' + (w.level || 0) + '</td>' +
        '<td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="num">' + U.numText(gn, 0) + '</td>' +
        '<td style="color:var(--text-dim);font-size:var(--fs-sub);">' + (parts.join(' · ') || '—') +
          (gcity ? '　<span style="opacity:.7;">（原属 ' + U.escape(gcity.name) + '）</span>' : '') + '</td>' +
        '<td class="ctr"><button class="btn sm" data-action="wild-garrison-open" data-x="' + w.x + '" data-y="' + w.y + '">增派</button> ' +
          '<button class="btn sm red" data-action="wild-withdraw" data-x="' + w.x + '" data-y="' + w.y + '">召回</button></td></tr>';
    }).join('');
    var garBlock = garList.length
      ? '<table class="tbl"><thead><tr><th>野地</th><th class="ctr">坐标</th><th class="num">驻军</th><th>兵种明细</th><th class="ctr">操作</th></tr></thead><tbody>' + garRows + '</tbody></table>'
      : '<div class="q-empty">暂无野地驻军（占下野地后点「派驻」即在此处可见）。</div>';""",
     """    /* ⛔ v89.140（老板 2）：「军务总览中，**不再显示驻守野地和采集队菜单**」——
       两块（含各自的列表与合计）整段退役：驻军的唯一落点 = **附属野地界面**
       （每野地一行：将领 / 驻军 / 操作），采集的唯一落点 = 地块与军务处。
       合计值 `garTot` 随统计行一并退役（那个统计行也在本轮删掉）。 */""",
     '删驻守野地块'),

    # ③ 删"③ 采集队"块
    ("""    /* ---------- ③ 采集队 ---------- */
    var glist = GAME.gatherList();
    var gatherTot = 0;
    var grows = glist.map(function (g) {
      var y = GAME.gatherYield(g);
      var gen = null;
      (s.generals || []).forEach(function (x) { if (x.id === g.genId) gen = x; });
      var tn = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : g.type;
      var n = g.troops || 0;
      gatherTot += n;
      return '<tr>' +
        '<td>' + tn + ' Lv' + (g.level || 1) + '</td>' +
        '<td class="ctr">' + g.x + ',' + g.y + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '<span style="color:var(--text-dim);">驻军开采</span>') + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td class="num">' + U.numText(y.amount, 0) + ' ' + (ui.RES_NAME[y.res] || '') + '</td>' +
        '<td class="ctr"><button class="btn sm gold" data-action="gather-finish" data-id="' + g.id + '">收获</button> ' +
          /* v89.138（老板 0）：「召回不是从采集变成驻军，而是**采集中的军队回到城市**」——
             采集与驻军已合并（兵在驻军 · 原地开工），于是「召回」= **撤回驻军**（同一动作同一语义）：
             停采（满 1 小时先自动收获）+ 兵与将回城。 */
          '<button class="btn sm red" data-action="wild-withdraw" data-x="' + g.x + '" data-y="' + g.y +
            '" title="召回：停止开采，兵与将回城（满 1 小时先自动收获）">召回</button></td>' +
        '</tr>';
    }).join('');
    var gatherBlock = glist.length
      ? '<table class="tbl"><thead><tr><th>野地</th><th class="ctr">坐标</th><th class="ctr">带队</th><th class="num">兵力</th><th class="num">预计收成</th><th class="ctr">操作</th></tr></thead><tbody>' + grows + '</tbody></table>'
      : '<div class="q-empty">暂无在外采集队。</div>';""",
     """    /* ⛔ v89.140（老板 2）：采集队块同上退役（"不再显示…采集队菜单"）——
       采集的进度/收获统一在**地块界面**与**军务处**操作；
       全境采集一览在「附属野地」（已含带领将领与驻军数）。 */""",
     '删采集队块'),

    # ④ 顶部：删统计行 + 删两块渲染 + 编号重排
    ("""    return '<div class="ui-page">' + ui.marchTabHTML() +
      '<div class="gold-heading">⚔ 军务总览</div>' +
      '<div class="ui-sub" style="text-align:center;margin-bottom:10px;">' +
        '在城 ' + U.numText(cityTot, 0) + '　·　驻守 ' + U.numText(garTot, 0) +
        '　·　采集 ' + U.numText(gatherTot, 0) + '　·　行军 ' + U.numText(marchTot, 0) +
        '　·　征战 ' + (btPend ? btPend.n : 0) +
        /* v89.132：统计行的「伤兵」一并撤（两营信息只在军务处；角标仍提示待处理数） */
        '</div>' +
      '<div class="q-sec"><span class="q-sec-t">① 城内</span><span class="q-sec-n">' + (s.cities || []).length + ' 城</span></div>' +
      cityBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">② 驻守野地</span><span class="q-sec-n">' + garList.length + ' 处</span></div>' +
      garBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">③ 采集队</span><span class="q-sec-n">' + glist.length + ' / ' + DATA.GATHER.maxActive + ' 队</span></div>' +
      gatherBlock +
      (btPend ? '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">⚔ 征战中</span><span class="q-sec-n">' + btPend.n + ' 处</span></div>' + btPend.html : '') +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">④ 行军</span><span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +""",
     """    /* v89.140（老板 2）：① 统计行（"在城 X · 驻守 Y · 采集 Z …"）**整行去掉**；
       ② 驻守野地 / 采集队两块去掉；③ 编号重排为 ① 城内 / ② 征战中 / ③ 行军。 */
    return '<div class="ui-page">' + ui.marchTabHTML() +
      '<div class="gold-heading">⚔ 军务总览</div>' +
      '<div class="q-sec" style="margin-top:6px;"><span class="q-sec-t">① 城内</span><span class="q-sec-n">' + (s.cities || []).length + ' 城</span></div>' +
      cityBlock +
      (btPend ? '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">② ⚔ 征战中</span><span class="q-sec-n">' + btPend.n + ' 处</span></div>' + btPend.html : '') +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">' + (btPend ? '③' : '②') + ' 行军</span><span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +""",
     '军务顶部改版'),

], ['mc-tbl'])

# ══════ main.js：校场关菜单 ══════
patch('js/main.js', [
    ("""      case 'open-xiaochang': ui.setView('marches'); ui._marchTab = 'over'; break;""",
     """      /* v89.140（老板 3）：「校场点击进入军务之后，应**关闭建筑菜单**，进入军务界面」——
         实测确实留在建筑菜单里（setView 只切中央视图，弹层仍在栈上）→ 先全关再切。 */
      case 'open-xiaochang': ui.closeAllModals(); ui.setView('marches'); ui._marchTab = 'over'; break;""",
     '校场关菜单'),
], ['closeAllModals(); ui.setView'])
print('✅ 完成：' + ' / '.join(ok))
