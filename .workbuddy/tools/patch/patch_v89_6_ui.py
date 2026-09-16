# -*- coding: utf-8 -*-
"""v89.6 UI 补丁：奇遇横幅/结算线索行/野地探奇入口/见闻录面板/探察提示"""
import io

P = r'E:\Deepseekdb\js\ui.js'
d = io.open(P, encoding='utf-8', newline='').read()

# ① SXF_KIND 补「奇遇」
OLD1 = """  ui.SXF_KIND = { fight: '征伐', trial: '试炼', gather: '采撷', cultivate: '修真', visit: '访贤', scene: '游历' };"""
NEW1 = """  ui.SXF_KIND = { fight: '征伐', trial: '试炼', gather: '采撷', cultivate: '修真', visit: '访贤', scene: '游历', wonder: '奇遇' };"""
assert d.count(OLD1) == 1, ('ui 锚点①', d.count(OLD1))
d = d.replace(OLD1, NEW1, 1)

# ② 奇遇横幅改「奇缘紫」底纹
OLD2 = """    var tint = '';
    if (tdef.color) {
      var v = parseInt(tdef.color.slice(1), 16);
      var rgb = (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255);
      tint = 'background:linear-gradient(135deg,rgba(' + rgb + ',.24),rgba(' + rgb + ',.04) 62%),var(--panel-bg);';
    }"""
NEW2 = """    var tint = '';
    if (tdef.color) {
      var v = parseInt(tdef.color.slice(1), 16);
      var rgb = (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255);
      tint = 'background:linear-gradient(135deg,rgba(' + rgb + ',.24),rgba(' + rgb + ',.04) 62%),var(--panel-bg);';
    }
    /* v89.6：奇遇横幅改「奇缘紫」底纹 —— 与江湖活动一眼区分（看颜色就知道是奇遇） */
    if (fx.kind === 'wonder') {
      tint = 'background:linear-gradient(135deg,rgba(var(--wonder-rgb),.26),rgba(var(--wonder-rgb),.05) 62%),var(--panel-bg);';
    }"""
assert d.count(OLD2) == 1, ('ui 锚点②', d.count(OLD2))
d = d.replace(OLD2, NEW2, 1)

# ③ 结算屏：线索行（紫框虚线）
OLD3 = """      if (!res.escaped || fx.spent) {
        h += '<div class="sxf-cost">耗：精力 -' + a.energy + ' · 体力 -' + a.stam +"""
NEW3 = """      if (res.clue) h += '<div class="sxf-clue">' + U.escape(res.clue) + '</div>';
      if (!res.escaped || fx.spent) {
        h += '<div class="sxf-cost">耗：精力 -' + a.energy + ' · 体力 -' + a.stam +"""
assert d.count(OLD3) == 1, ('ui 锚点③', d.count(OLD3))
d = d.replace(OLD3, NEW3, 1)

# ④ jianghuHTML：奇遇入口（已现形未探才有；未现形零暗示）
OLD4 = """      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">野地 Lv' + lv4 +
        ' · 难度 ×' + lvN4.toFixed(1) + ' · 收益 ×' + lvR4.toFixed(1) +
        '　—— 江湖诸事随缘而现，精华用于蕴养修炼装备</div>';
    if (res) {"""
NEW4 = """      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">野地 Lv' + lv4 +
        ' · 难度 ×' + lvN4.toFixed(1) + ' · 收益 ×' + lvR4.toFixed(1) +
        '　—— 江湖诸事随缘而现，精华用于蕴养修炼装备</div>';
    /* v89.6：奇遇入口 —— 已现形才露面；未现形不给任何暗示（隐藏点是探索层的地基） */
    var ws6 = GAME.wonderSiteOf ? GAME.wonderSiteOf(x, y) : null;
    if (ws6) {
      var cost6 = (DATA.WONDER && DATA.WONDER.cost) || { energy: 6, stam: 2 };
      if (ws6.done) {
        h += '<div class="wnr-line wnr-done">✦ 此地奇遇已探 —— 缘止于此</div>';
      } else if (ws6.revealed) {
        h += '<div class="wnr-line">✦ 此地似有异象未探　' +
          '<button class="btn sm wnr-btn" data-action="do-wonder" data-x="' + x + '" data-y="' + y + '">' +
          '探奇（精' + cost6.energy + ' · 体' + cost6.stam + '）</button></div>';
      }
    }
    if (res) {"""
assert d.count(OLD4) == 1, ('ui 锚点④', d.count(OLD4))
d = d.replace(OLD4, NEW4, 1)

# ⑤ openLandModal：就近探察 + 提示行（两个分支各插一次）
OLD5 = """  ui.openLandModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;
    var tile = GAME.map.tile(x, y);
    var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);"""
NEW5 = """  ui.openLandModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;
    var tile = GAME.map.tile(x, y);
    /* v89.6：就近探察 —— 开格即见方圆二格内的未现形奇遇点位（探索层的"环顾四周"） */
    var wsurv6 = GAME.wonderSurvey ? GAME.wonderSurvey(x, y) : 0;
    var wsurvLine = wsurv6 > 0
      ? '<div class="wnr-line wnr-new">📜 环顾四周，探得异迹 ' + wsurv6 + ' 处 —— 已记于见闻（图中寻「✦」往探）</div>'
      : '';
    var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);"""
assert d.count(OLD5) == 1, ('ui 锚点⑤', d.count(OLD5))
d = d.replace(OLD5, NEW5, 1)

OLD6 = """        ui.jianghuHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +"""
NEW6 = """        wsurvLine + ui.jianghuHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +"""
assert d.count(OLD6) == 1, ('ui 锚点⑥', d.count(OLD6))
d = d.replace(OLD6, NEW6, 1)

OLD7 = """      ui.jianghuHTML(x, y) +
      stat + ops +"""
NEW7 = """      wsurvLine + ui.jianghuHTML(x, y) +
      stat + ops +"""
assert d.count(OLD7) == 1, ('ui 锚点⑦', d.count(OLD7))
d = d.replace(OLD7, NEW7, 1)

# ⑥ 见闻录面板（插在 closeSceneFx 之后）
OLD8 = """    GAME.refreshAll();
    ui.openLandModal(fx.chk.x, fx.chk.y);   /* 原地回野地弹窗（显示结果与「今日已做」） */
  };"""
NEW8 = """    GAME.refreshAll();
    ui.openLandModal(fx.chk.x, fx.chk.y);   /* 原地回野地弹窗（显示结果与「今日已做」） */
  };

  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：见闻录 —— 奇遇图鉴
   * ------------------------------------------------------------
   * 三档分组（逸闻 / 奇珍 / 绝景）；未录者只留「？？？」剪影；
   * 已现形未探的点位列「待探线索」，带「前往」（回地图居中赴线索）。
   * ============================================================ */
  ui.openJournal = function () {
    ui.openModal(ui.journalHTML());
  };
  ui.journalHTML = function () {
    var ws = GAME.wonderState ? GAME.wonderState() : { r: {}, d: {}, j: {} };
    var all = DATA.WONDERS || {};
    var ids = Object.keys(all);
    var got = ids.filter(function (id) { return ws.j[id]; }).length;
    var sites = GAME.wonderSites ? GAME.wonderSites() : [];
    var pending = [];
    var known = 0;
    sites.forEach(function (it) {
      var k = it.x + ',' + it.y;
      if (ws.d[k]) known++;
      else if (ws.r[k]) { known++; pending.push(it); }
    });
    pending.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    var h = '<div class="gold-heading">📜 见闻录 · 天下奇遇</div>';
    h += '<div class="jnl-stat">奇遇点位 <b>' + sites.length + '</b> 处　·　已知 <b>' + known +
      '</b>　未探 <b>' + pending.length + '</b>　·　已录见闻 <b>' + got + ' / ' + ids.length + '</b></div>';
    h += '<div class="jnl-sec">✦ 待探线索</div>';
    if (pending.length) {
      h += '<div class="jnl-list">';
      pending.slice(0, 10).forEach(function (it) {
        h += '<div class="jnl-row"><span class="jnl-nm">' + it.x + ',' + it.y + ' · ' +
          GAME.wonderBandName(it.band) + '</span>' +
          '<button class="btn sm wnr-btn" data-action="journal-go" data-x="' + it.x + '" data-y="' + it.y + '">前往</button></div>';
      });
      h += '</div>';
    } else {
      h += '<div class="jnl-empty">暂无线索 —— 江湖诸事走完，或可闻得异迹</div>';
    }
    ['small', 'rare', 'epic'].forEach(function (t) {
      var list = ids.filter(function (id) { return (all[id] || {}).tier === t; });
      var g2 = list.filter(function (id) { return ws.j[id]; }).length;
      h += '<div class="jnl-sec">' + GAME.wonderTierName(t) + '（' + g2 + '/' + list.length + '）</div><div class="jnl-grid">';
      list.forEach(function (id) {
        var w = all[id] || {};
        var has = !!ws.j[id];
        h += '<div class="jnl-card' + (has ? ' has' : '') + '">' +
          '<span class="jnl-ic">' + (has ? w.ic : '？') + '</span>' +
          '<span class="jnl-nm">' + (has ? U.escape(w.name) : '？？？') + '</span>' +
          '<span class="jnl-txt">' + (has ? U.escape(w.txt || '') : '未录 · 江湖之行或可闻得') + '</span>' +
          '</div>';
      });
      h += '</div>';
    });
    h += '<div class="modal-foot"><button class="btn" data-action="close-modal">合上册子</button></div>';
    return h;
  };"""
assert d.count(OLD8) == 1, ('ui 锚点⑧', d.count(OLD8))
d = d.replace(OLD8, NEW8, 1)

# ⑦ doWonder（插在 doJianghu 尾之后）
OLD9 = """    var r = GAME.sceneStart(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('剧本缺失'); return; }
    ui.openSceneFx(r.fx);
  };"""
NEW9 = """    var r = GAME.sceneStart(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('剧本缺失'); return; }
    ui.openSceneFx(r.fx);
  };
  /* v89.6：探奇 —— 已现形点位 → 奇遇全屏剧本（君主亲往；扣费与锁在首次选择时落） */
  ui.doWonder = function (x, y) {
    var lg = GAME.lordGeneralOf();
    var r = GAME.wonderStart(x, y, lg ? lg.id : '');
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('奇物未载于册'); return; }
    ui.openSceneFx(r.fx);
  };"""
assert d.count(OLD9) == 1, ('ui 锚点⑨', d.count(OLD9))
d = d.replace(OLD9, NEW9, 1)

# ⑧ 底栏地图 dock：加「见闻录」按钮
OLD10 = """        '<button class="btn sm" data-action="map-capital">洛阳</button>' +
      '</div>');"""
NEW10 = """        '<button class="btn sm" data-action="map-capital">洛阳</button>' +
        '<button class="btn sm" data-action="open-journal">📜 见闻录</button>' +
      '</div>');"""
assert d.count(OLD10) == 1, ('ui 锚点⑩', d.count(OLD10))
d = d.replace(OLD10, NEW10, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK ui.js: 奇遇入口 / 见闻录 / 探察提示 / dock 按钮 已写入')
