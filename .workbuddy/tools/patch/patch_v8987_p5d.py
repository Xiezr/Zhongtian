# -*- coding: utf-8 -*-
"""v89.87 需求2：UI 接线（调兵/驻守面板加将领 · 采集改 dispatch）+ 白名单"""
import io

# ============================================================
# ① ui.js：doTroopMove 传将领 + openTroopMove 加将领选择
# ============================================================
P1 = r'E:\Deepseekdb\js\ui.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()

old1 = """    var r = GAME.doTransferTroops(from.id, tid, army);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openTroopMove(from.id); }
  };"""
new1 = """    /* v89.87（需求 2）：调兵走行军通道，须带带队将领（老板拍板"一律要选将"） */
    var genEl = document.getElementById('tm-gen');
    var genId = genEl ? genEl.value : null;
    var r = GAME.doTransferTroops(from.id, tid, army, genId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openTroopMove(from.id); }
  };"""
assert s1.count(old1) == 1, ('tm-do', s1.count(old1))
s1 = s1.replace(old1, new1, 1)

old2 = """    ui.openShell({
      title: '⚔ 军队派驻',
      sub: '自' + U.escape(from.name) + '调出',
      size: 'sm',
      body:
        '<div class="ui-sub">调往</div>' +
        '<div class="gd-chips">' + others.map(function (c) {
          return '<span class="chip' + (c.id === to.id ? ' on' : '') + '" data-action="tm-to" data-i="' + from.id +
            '" data-v="' + c.id + '">' + U.escape(c.name) + ' <i class="gd-sub">' + GAME.cityDist(from, c) + ' 格</i></span>';
        }).join('') + '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">兵力</div>' + rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-hint">派驻即时到达，<b>兵士不损耗</b>（损耗只在物资运输上）。目标城校场容量不足会被拒。</div></div>',
      foot: '<div class="m-foot"><button class="btn gold" data-action="tm-do">派驻</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };"""
new2 = """    /* v89.87（需求 2）：调兵改走**行军通道** —— 须选带队将领 */
    var _gens = (s.generals || []).filter(function (g) {
      return GAME.genCityOf(g) === from.id && (!g.status || g.status === 'idle') &&
        !(GAME.gatherByGen && GAME.gatherByGen(g.id));
    });
    var genSel = '<select id="tm-gen" style="width:100%;padding:5px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
      _gens.map(function (g) {
        return '<option value="' + g.id + '">' + U.escape(g.name) + '（Lv' + (g.level || 1) + '）</option>';
      }).join('') + '</select>';
    ui.openShell({
      title: '⚔ 军队派驻',
      sub: '自' + U.escape(from.name) + '调出',
      size: 'sm',
      body:
        '<div class="ui-sub">调往</div>' +
        '<div class="gd-chips">' + others.map(function (c) {
          return '<span class="chip' + (c.id === to.id ? ' on' : '') + '" data-action="tm-to" data-i="' + from.id +
            '" data-v="' + c.id + '">' + U.escape(c.name) + ' <i class="gd-sub">' + GAME.cityDist(from, c) + ' 格</i></span>';
        }).join('') + '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">带队将领</div>' +
        (_gens.length ? genSel : '<div class="q-empty">本城无空闲将领 —— 派兵须有将领带队（出征/守将/采集中的不能派）。</div>') +
        '<div class="ui-sub" style="margin-top:8px;">兵力</div>' + rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-hint">兵力按<b>行军通道</b>开拨：有行军时间（军务总览可查看/召回），抵达后入编目标城；校场容量不足会被拒。</div></div>',
      foot: '<div class="m-foot"><button class="btn gold" data-action="tm-do">派兵</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };"""
assert s1.count(old2) == 1, ('tm-panel', s1.count(old2))
s1 = s1.replace(old2, new2, 1)

# ② openWildGarrison 加将领选择
old3 = """      '<div class="modal-scroll"><table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
        '</colgroup><thead><tr><th>兵种</th><th class="num">城内</th>' +
        '<th class="ctr">派驻数量</th><th class="ctr">全带</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +"""
new3 = """      /* v89.87（需求 2）：驻守改走**行军通道** —— 须选带队将领 */
      (function () {
        var _gs = (s.generals || []).filter(function (g) {
          return GAME.genCityOf(g) === c.id && (!g.status || g.status === 'idle') &&
            !(GAME.gatherByGen && GAME.gatherByGen(g.id));
        });
        return '<div class="ui-sub" style="margin-top:6px;">带队将领</div>' +
          (_gs.length
            ? '<select id="wg-gen" style="width:100%;padding:5px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
              _gs.map(function (g) {
                return '<option value="' + g.id + '">' + U.escape(g.name) + '（Lv' + (g.level || 1) + '）</option>';
              }).join('') + '</select>'
            : '<div class="q-empty">本城无空闲将领 —— 派兵须有将领带队（出征/守将/采集中的不能派）。</div>');
      })() +
      '<div class="modal-scroll"><table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
        '</colgroup><thead><tr><th>兵种</th><th class="num">城内</th>' +
        '<th class="ctr">派驻数量</th><th class="ctr">全带</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +"""
assert s1.count(old3) == 1, ('wg-panel', s1.count(old3))
s1 = s1.replace(old3, new3, 1)

# 驻守面板的提示文案（原来写"驻军守地不衰减…"）——补一句行军
old4 = """        '<span class="op-hint">驻军守地不衰减；上限按野地等级计，日后掉级不会把已驻的兵赶回城</span>' +"""
new4 = """        '<span class="op-hint">走行军通道前往（军务可查看/召回）；驻军守地不衰减，上限按野地等级计</span>' +"""
assert s1.count(old4) == 1, ('wg-hint', s1.count(old4))
s1 = s1.replace(old4, new4, 1)

io.open(P1, 'w', encoding='utf-8', newline='').write(s1)
print('OK ui.js 两个面板')

# ============================================================
# ③ main.js：doWildGarrisonDo 传将领 + doStartGather 改 dispatchGather
# ============================================================
P2 = r'E:\Deepseekdb\js\main.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()

old5 = """    var r = GAME.doWildGarrison(xy.x, xy.y, army, c.id);
    ui.toast(r.msg);"""
new5 = """    /* v89.87（需求 2）：驻守走行军通道，须带带队将领 */
    var genEl = document.getElementById('wg-gen');
    var genId = genEl ? genEl.value : null;
    var r = GAME.doWildGarrison(xy.x, xy.y, army, c.id, genId);
    ui.toast(r.msg);"""
assert s2.count(old5) == 1, ('wg-do', s2.count(old5))
s2 = s2.replace(old5, new5, 1)

old6 = """    var r = GAME.startGather(xy.x, xy.y, genId, army);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openGathers(); }
  };"""
new6 = """    /* v89.87（需求 2）：采集改走**行军通道**（出发扣兵，抵达后开始采） */
    var r = GAME.dispatchGather(xy.x, xy.y, genId, army);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openGathers(); }
  };"""
assert s2.count(old6) == 1, ('sg-do', s2.count(old6))
s2 = s2.replace(old6, new6, 1)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('OK main.js 两处')

# ============================================================
# ④ smoke 白名单：tm-gen / wg-gen
# ============================================================
P3 = r'E:\Deepseekdb\smoke-test.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()
old7 = """        || /id="bt-t-/.test(tag)                         /* 战场界面逐兵种目标（v89.87） */"""
new7 = """        || /id="bt-t-/.test(tag)                         /* 战场界面逐兵种目标（v89.87） */
        || /id="tm-gen"/.test(tag) || /id="wg-gen"/.test(tag)   /* v89.87：调兵/驻守的带队将领 */"""
assert s3.count(old7) == 1, ('wl', s3.count(old7))
s3 = s3.replace(old7, new7, 1)
io.open(P3, 'w', encoding='utf-8', newline='').write(s3)
print('OK smoke 白名单')
