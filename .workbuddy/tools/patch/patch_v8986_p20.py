# -*- coding: utf-8 -*-
"""v89.86 整改 · P-20 军务总览页
   背景：91 兵散在 4 块野地 + 2 支采集队在外，全站没有一个页面能一眼看全"兵都在哪"。
   修法：行军视图（data-view="marches"）升级为「军务总览」五段：
        城内 / 驻守野地 / 采集队 / 行军 / 伤兵；顶栏标签「行军」→「军务」。
"""
import io
import os
import sys

UI = r'E:\Deepseekdb\js\ui.js'
HT = r'E:\Deepseekdb\index.html'
SM = r'E:\Deepseekdb\smoke-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


OLD = io.open(r'E:\Deepseekdb\.workbuddy\tmp\marches_old.txt', encoding='utf-8', newline='').read()

NEW = """  /* ============================================================
   * v89.86（整改 P-20）：行军视图 → **军务总览**
   * ------------------------------------------------------------
   * 老板实测：91 兵散在 4 块野地、2 支采集队在外，全站没有一个页面能
   * 一眼看全"我的兵都在哪"（只能逐块点开野地弹窗）。
   * 本页收敛为五段：城内 / 驻守野地 / 采集队 / 行军 / 伤兵。
   * data-view="marches" 与既有动作（召回 / 收获 / 治疗）一字未动 —— 只换内容。
   * ============================================================ */
  ui.marchesHTML = function () {
    var s = GAME.state;
    var c = GAME.currentCity();

    /* ---------- ① 城内（全境各城在城兵力） ---------- */
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
      : '<div class="q-empty">尚无城池。</div>';

    /* ---------- ② 驻守野地 ---------- */
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
      : '<div class="q-empty">暂无野地驻军（占下野地后点「派驻」即在此处可见）。</div>';

    /* ---------- ③ 采集队 ---------- */
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
          '<button class="btn sm red" data-action="gather-abandon" data-id="' + g.id + '">撤回</button></td>' +
        '</tr>';
    }).join('');
    var gatherBlock = glist.length
      ? '<table class="tbl"><thead><tr><th>野地</th><th class="ctr">坐标</th><th class="ctr">带队</th><th class="num">兵力</th><th class="num">预计收成</th><th class="ctr">操作</th></tr></thead><tbody>' + grows + '</tbody></table>'
      : '<div class="q-empty">暂无在外采集队。</div>';

    /* ---------- ④ 行军（**全境**队列，不只看当前城） ---------- */
    var list = (s.marches || []).slice();
    var marchTot = 0;
    var rows = list.map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      marchTot += n;
      var left = Math.max(0, (m.totalTime - m.elapsed) / GAME.timeScale());
      var from = GAME.cityById(m.cityId);
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (from ? U.escape(from.name) : '—') + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="ctr">' + md.name + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td style="min-width:150px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.pct + '% · 余 ' + U.durExact(left) + '</span></td>' +
        '<td class="ctr"><button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td>' +
        '</tr>';
    }).join('');
    var marchBlock = list.length
      ? '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">出发</th><th class="ctr">主将</th><th class="ctr">方式</th><th class="num">兵力</th><th>行军进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="text-align:center;margin-top:10px;"><button class="btn gold" data-action="march-rush">⚡ 急行军令（立即抵达）</button></div>'
      : '<div class="q-empty">当前没有在途行军队列。在地图上对野地 / 据点 / 城池点「出兵」即会进入行军。</div>';

    return '<div class="ui-page">' +
      '<div class="gold-heading">⚔ 军务总览</div>' +
      '<div class="ui-sub" style="text-align:center;margin-bottom:10px;">' +
        '在城 ' + U.numText(cityTot, 0) + '　·　驻守 ' + U.numText(garTot, 0) +
        '　·　采集 ' + U.numText(gatherTot, 0) + '　·　行军 ' + U.numText(marchTot, 0) +
        '　·　伤兵 ' + U.numText(s.wounded || 0, 0) + '</div>' +
      '<div class="q-sec"><span class="q-sec-t">① 城内</span><span class="q-sec-n">' + (s.cities || []).length + ' 城</span></div>' +
      cityBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">② 驻守野地</span><span class="q-sec-n">' + garList.length + ' 处</span></div>' +
      garBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">③ 采集队</span><span class="q-sec-n">' + glist.length + ' / ' + DATA.GATHER.maxActive + ' 队</span></div>' +
      gatherBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">④ 行军</span><span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">⑤ 伤兵</span></div>' +
      ui.woundedBlock('view') +
      '</div>';
  };

"""


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ① ui.js · 整段替换
edit(UI, OLD, NEW, 'P-20 · 军务总览五段')

# ② index.html · 顶栏标签 行军 → 军务
edit(HT, r"""    <div class="tab" data-view="marches"><i class="ti" data-nav="march"></i>行军</div>""",
     r"""    <div class="tab" data-view="marches"><i class="ti" data-nav="march"></i>军务</div>""",
     'P-20 · 顶栏改「军务」')

# ③ smoke · 标签断言同步
edit(SM, r"""  check('「行军」菜单存在且**不带数值徽标**（v41 需求 3）',
    /data-view="marches"><i class="ti" data-nav="march"><\/i>行军<\/div>/.test(hS31)
    && !/tab-badge-march/.test(hS31));""",
     r"""  /* v89.86（整改 P-20）：行军视图升级为「军务总览」，标签随之改「军务」（data-view 不变） */
  check('「军务」菜单存在且**不带数值徽标**（v41 需求 3 · v89.86 更名）',
    /data-view="marches"><i class="ti" data-nav="march"><\/i>军务<\/div>/.test(hS31)
    && !/tab-badge-march/.test(hS31));""",
     'P-20 · smoke 断言同步')

print('DONE')
