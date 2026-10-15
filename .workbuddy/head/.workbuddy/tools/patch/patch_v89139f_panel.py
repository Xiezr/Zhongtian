# -*- coding: utf-8 -*-
"""v89.139 批四-3：ui.js openLandModal —— 己方野地面板（老板 3）：
   去（已占）/ 产量加成挪进 note / 驻军板块精简（删开采·衰减·备注行，兵力只给总数）/
   采集区改「设置采集 + 收获」两按钮（去召回）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① note：产量加成并入 + 珠宝门槛提示 ──
rep("""    var note = gatherRes
      ? '此地可采：<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>' +
        (matNames ? '　材料：' + matNames : '') +
        (jewelNames135.length ? '　珠宝：<b style="color:var(--gold-light)">' + jewelNames135.join(' · ') + '</b>（收获偶得）' : '')
      : '此地为平地，<b>无可采之物</b>，仅提供产量加成（已占后可筑新城）。';""",
"""    /* v89.139（老板 3）：「产量加成放在此地可采那行后边」——
       从标题下的居中行挪进 note（与"可采清单"同处一行，信息成组）。 */
    var addLine139 = addStr ? '　产量加成 ' + addStr : '';
    /* v89.139（老板 4）：高档珠宝有野地等级门槛（见 DATA.GATHER.jewelMinLv）——界面写明。
       门槛 = 本地形所有珠宝里**最高**的那道（"要 LvN+ 才可能出全"）。 */
    var jewelLvHint139 = '';
    if (jewelNames135.length) {
      var _minLv139 = 1;
      ((DATA.GATHER.jewelTable || {})[tile.terrain] || []).forEach(function (jid) {
        var mv = ((DATA.GATHER.jewelMinLv || {})[jid]) || 1;
        if (mv > _minLv139) _minLv139 = mv;
      });
      jewelLvHint139 = _minLv139 > 1 ? ('（Lv' + _minLv139 + '+ 野地收获偶得）') : '（收获偶得）';
    }
    var note = gatherRes
      ? '此地可采：<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>' +
        (matNames ? '　材料：' + matNames : '') +
        (jewelNames135.length ? '　珠宝：<b style="color:var(--gold-light)">' + jewelNames135.join(' · ') + '</b>' + jewelLvHint139 : '') +
        addLine139
      : '此地为平地，<b>无可采之物</b>' + (addLine139 ? '；' + addLine139 : '') +
        '（已占后可筑新城）。';""",
    'note 产量加成')

# ── ② 驻军板块精简 ──
rep("""    var stat = '<div class="op-zone"><div class="op-zone-t">驻军</div>' +
      (garN
        ? '<div class="attr"><span class="k">将领</span><span class="v">' +
            (garGen135
              ? (U.escape(garGen135.name) + ' Lv' + garGen135.level +
                 '　<span class="ui-sub">驻守野地</span>')
              : '<span style="color:var(--warn);">无将领 —— 只可驻留、不可开采（派驻时带将补驻）</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">兵力</span><span class="v">' + garRows135.join('　·　') +
            '　共 <b>' + U.numText(garN, 0) + '</b>' +
            (gar ? '　<span class="ui-sub">来自 ' + U.escape((GAME.cityById(gar.cityId) || {}).name || '本城') + '</span>' : '') +
          '</span></div>' +
          (at
            ? '<div class="attr"><span class="k">📦 开采</span><span class="v">' +
                U.durExact((at.elapsed || 0) / Math.max(1, GAME.timeScale())) + ' / ' +
                DATA.GATHER.maxHours + ' 小时' +
                (garGen135 ? '（' + U.escape(garGen135.name) + ' 带队）' : '') + '</span></div>'
            : '')
        : '<div class="q-empty">暂无驻军 —— 点下方「派驻」派兵并选将领入驻（守地不衰减）</div>') +
      '<div class="attr"><span class="k">📉 等级衰减</span><span class="v" style="color:' +
        (garN ? 'var(--green-ok)' : 'var(--warn)') + ';">' +
        (garN ? '驻军守地 · 不衰减（每现实日 −1 级只降野地，不动驻军）'
              : '每现实日 −1 级（派驻可免除）') + '</span></div>' +
      '<div class="op-hint">' + (garN
        ? (garGen135 ? '开采由驻守将领带队（原地开工，驻军不移动）' : '开采须有将领带队 —— 再次「派驻」并选一位将领即可补驻')
        : '首队须带将入驻；此后增援不带将（只并兵）') + '</div>' +
      '</div>';""",
"""    /* v89.139（老板 3）：「驻军菜单下的开采行，等级衰减行，和备注行都不要；
       兵力显示总数量即可」—— 驻军板块收敛成两行：将领 + 兵力（总数）。
       （开采进度移步「采集」区显示；等级衰减与驻守规则从面板撤除，
         相应语义仍在玩法里生效，见 DATA.WILD_GARRISON / wildDecayTick。） */
    var stat = '<div class="op-zone"><div class="op-zone-t">驻军</div>' +
      (garN
        ? '<div class="attr"><span class="k">将领</span><span class="v">' +
            (garGen135
              ? (U.escape(garGen135.name) + ' Lv' + garGen135.level +
                 '　<span class="ui-sub">驻守野地</span>')
              : '<span style="color:var(--warn);">无将领 —— 只可驻留、不可开采（派驻时带将补驻）</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">兵力</span><span class="v"><b>' + U.numText(garN, 0) + '</b> 名' +
            (gar ? '　<span class="ui-sub">来自 ' + U.escape((GAME.cityById(gar.cityId) || {}).name || '本城') + '</span>' : '') +
          '</span></div>'
        : '<div class="q-empty">暂无驻军 —— 点下方「派驻」派兵并选将领入驻（守地不衰减）</div>') +
      '</div>';""",
    '驻军板块精简')

# ── ③ 采集区：两按钮（设置采集 + 收获） ──
rep("""    var gatherBox = '';
    if (gatherRes) {
      gatherBox = '<div class="op-zone"><div class="op-zone-t">采集</div>';
      if (at) {
        var gy136 = GAME.gatherYield(at);
        var gLeftH136 = Math.max(0, DATA.GATHER.minHours - gy136.hours);
        var gName136 = '（无将）';
        (GAME.state.generals || []).forEach(function (g0) { if (g0.id === at.genId) gName136 = g0.name; });
        gatherBox +=
          '<div class="attr"><span class="k">进度</span><span class="v">' +
            '<span style="display:inline-block;width:132px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + gy136.pct + '%;background:linear-gradient(180deg,var(--gold-light),var(--gold-dark));"></i></span>' +
            '已采 ' + gy136.hours.toFixed(2) + ' / ' + DATA.GATHER.maxHours + ' 游戏时　' +
            (gy136.capReached ? '<span style="color:var(--gold-light);">已封顶</span>'
              : gy136.ready ? '<span style="color:var(--green-ok);">可收获</span>'
              : '<span style="color:var(--text-dim);">还需 ' + U.dur(gLeftH136 * 3600 / GAME.timeScale()) + ' 现实时间满 1 小时</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">预计收成</span><span class="v">' +
            U.numText(gy136.amount, 0) + ' ' + (RES_NAME[gy136.res] || gy136.res || '') +
            '　<span class="ui-sub">带队 ' + U.escape(gName136) + '</span>' +
          '</span></div>' +
          '<div class="op-row">' +
            '<button class="btn gold" data-action="gather-finish" data-id="' + at.id + '"' + (gy136.ready ? '' : ' disabled') + '>📦 收获</button>' +
            /* v89.138（老板 0）：召回 = 撤回驻军（采集中的军队回城）—— 与军务/附属野地同一动作 */
            '<button class="btn" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y +
              '" title="召回：停止开采，兵与将回城（满 1 小时先自动收获）">🏳️ 召回</button>' +
          '</div>';
      } else if (garN > 0 && gar && gar.genId) {
        gatherBox += '<div class="op-row">' +
          '<button class="btn gold" data-action="wild-garrison-gather" data-x="' + x + '" data-y="' + y + '">⛏️ 开始采集</button>' +
          '<span class="op-hint">由驻守将领带队 · 原地开工（驻军不移动）</span></div>';
      } else if (garN > 0) {
        gatherBox += '<div class="q-empty">驻军无将领 —— 补驻一位将领后即可开采（「增派驻军」时选将）</div>';
      } else {
        gatherBox += '<div class="q-empty">暂无驻军 —— 先「派驻」（须选带队将领）</div>';
      }
      gatherBox += '</div>';
    }""",
"""    /* v89.139（老板 3）：「采集菜单下设置采集和收获两个按钮，**不要召回**」——
       两个按钮**常显**（不可用时置灰 + 悬停写明原因）；
       召回退出本区（撤回驻军仍在地块操作区，语义不变）。 */
    var gatherBox = '';
    if (gatherRes) {
      gatherBox = '<div class="op-zone"><div class="op-zone-t">采集</div>';
      var gy139 = at ? GAME.gatherYield(at) : null;
      if (at && gy139) {
        var gLeftH139 = Math.max(0, DATA.GATHER.minHours - gy139.hours);
        var gName139 = '（无将）';
        (GAME.state.generals || []).forEach(function (g0) { if (g0.id === at.genId) gName139 = g0.name; });
        gatherBox +=
          '<div class="attr"><span class="k">进度</span><span class="v">' +
            '<span style="display:inline-block;width:132px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + gy139.pct + '%;background:linear-gradient(180deg,var(--gold-light),var(--gold-dark));"></i></span>' +
            '已采 ' + gy139.hours.toFixed(2) + ' / ' + DATA.GATHER.maxHours + ' 游戏时　' +
            (gy139.capReached ? '<span style="color:var(--gold-light);">已封顶</span>'
              : gy139.ready ? '<span style="color:var(--green-ok);">可收获</span>'
              : '<span style="color:var(--text-dim);">还需 ' + U.dur(gLeftH139 * 3600 / GAME.timeScale()) + ' 现实时间满 1 小时</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">预计收成</span><span class="v">' +
            U.numText(gy139.amount, 0) + ' ' + (RES_NAME[gy139.res] || gy139.res || '') +
            '　<span class="ui-sub">带队 ' + U.escape(gName139) + ' · 负重上限 ' + U.numText(gy139.loadCap || 0, 0) + '</span>' +
          '</span></div>';
      }
      var canSet139 = !at && garN > 0 && gar && gar.genId;
      var canFin139 = !!(at && gy139 && gy139.ready);
      var setTitle139 = at ? '已在采集中'
        : (!garN ? '先派驻军（首次须带将）'
          : (!(gar && gar.genId) ? '驻军须有将领带队（「增派驻军」时选一位将领补驻）' : '由驻守将领带队 · 原地开工'));
      var finTitle139 = !at ? '尚未开始采集'
        : (canFin139 ? '' : '满 1 游戏小时方可收获');
      gatherBox += '<div class="op-row">' +
        '<button class="btn' + (canSet139 ? ' gold' : '') + '" data-action="wild-garrison-gather" data-x="' + x +
          '" data-y="' + y + '"' + (canSet139 ? '' : ' disabled') +
          (setTitle139 ? ' title="' + setTitle139 + '"' : '') + '>⚙️ 设置采集</button>' +
        '<button class="btn' + (canFin139 ? ' gold' : '') + '" data-action="gather-finish" data-id="' +
          (at ? at.id : '') + '"' + (canFin139 ? '' : ' disabled') +
          (finTitle139 ? ' title="' + finTitle139 + '"' : '') + '>📦 收获</button>' +
        '</div>';
      if (!at && garN > 0 && gar && !gar.genId) {
        gatherBox += '<div class="q-empty">驻军无将领 —— 补驻一位将领后即可开采（「增派驻军」时选将）</div>';
      } else if (!at && !garN) {
        gatherBox += '<div class="q-empty">暂无驻军 —— 先「派驻」（须选带队将领）</div>';
      }
      gatherBox += '</div>';
    }""",
    '采集区两按钮')

# ── ④ 已占标题去（已占）+ 删居中行 ──
rep("""    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '（已占）</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
        base.toLocaleString() + ' 名　·　产量加成 ' + (addStr || '无') + '</div>' +
      '<div class="note">' + note + '</div>' +""",
"""    /* v89.139（老板 3）：「湖泊 Lv10（已占），不要（已占）」+「都己方了，怎么还显示守军约多少名」
       —— 已占面板不再自称"已占"（入口本来就是己方野地），也不再显示守军数
       （守军只在**未占领**时的出击面板里有意义）。产量加成已并入上方 note 行。 */
    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' +
      '<div class="note">' + note + '</div>' +""",
    '已占标题精简')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'canSet139' in chk and 'addLine139' in chk, '落盘校验失败'
assert '（已占）</div>' not in chk, '（已占）残留'
print('✅ ui.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
