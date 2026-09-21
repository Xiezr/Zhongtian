# -*- coding: utf-8 -*-
"""
v89.89 · A3 歼敌值口径解释 + A4 材料产地悬停与跳转

① battle.js：战报「歼敌值」加 title 悬停解释（与将领经验同口径）
② ui.js：
   · forgeRow 材料段：data-tip 产地说明 + 🗺️ 跳转图标
   · ui.matGoTargetOf（已据→自己的城；未据→州治）
   · renderMapCanvas 加定位标记（双色圆环，6 秒自灭）
③ main.js：GAME.doMatGo + case 'mat-go'（照 journal-go 时序）
④ index.html：.mat-go 样式
"""
import io, sys

R = 'E:\\Deepseekdb\\'
ok_all = True

def patch(path, pairs, tag):
    global ok_all
    s = io.open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print('[FAIL] %s 锚点命中 %d 次（应 1）：%s' % (tag, n, old[:100].replace('\n', '\\n')))
            ok_all = False
            return
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('[OK] %s' % tag)

# ============================================================
# ① battle.js：歼敌值解释
# ============================================================
patch(R + 'js\\battle.js', [
    ("""            : (result.defValue ? '<span style="color:var(--text-dim);">（歼敌值 ' + U.numText(result.defValue, 0) + ' 资源）</span>' : '')))""",
     """            : (result.defValue
              /* v89.89（A3 · 100+ 轮实玩期待）：口径就地解释 —— 悬停「歼敌值」看折算规则
                 （100+ 轮实玩实测："歼敌值 3,120 资源"口径费解）。 */
              ? '<span style="color:var(--text-dim);">（<span style="cursor:help;" '
                + 'title="歼敌值 = 按歼灭敌军的资源造价折算（与将领经验同一口径）">歼敌值</span> '
                + U.numText(result.defValue, 0) + ' 资源）</span>' : '')))"""),
], 'battle.js 歼敌值解释')

# ============================================================
# ② ui.js
# ============================================================
patch(R + 'js\\ui.js', [
    # 2a. 材料段：tip + 跳转图标
    ("""    var matParts = Object.keys(f.mats || {}).map(function (mk) {
      var md = DATA.MATERIAL_BY_ID[mk];
      var have = (GAME.state.items || {})[mk] || 0;
      var need = f.mats[mk];
      var states = ui.matSpecialtyStates(mk);
      var src = '';
      if (states.length) {
        var held = states.filter(function (st) { return myStates[st]; });
        src = '（' + states.join('/') + '特产' +
          (held.length ? '　<b style="color:var(--green-ok);">已据' + held.join('/') + '</b>' : '') + '）';
      }
      return '<span class="' + (have >= need ? '' : 'lack') + '">' +
        (md ? md.name : mk) + ' ' + have + '/' + need + src + '</span>';
    });""",
     """    var matParts = Object.keys(f.mats || {}).map(function (mk) {
      var md = DATA.MATERIAL_BY_ID[mk];
      var have = (GAME.state.items || {})[mk] || 0;
      var need = f.mats[mk];
      var states = ui.matSpecialtyStates(mk);
      var src = '';
      if (states.length) {
        var held = states.filter(function (st) { return myStates[st]; });
        src = '（' + states.join('/') + '特产' +
          (held.length ? '　<b style="color:var(--green-ok);">已据' + held.join('/') + '</b>' : '') + '）';
      }
      /* v89.89（A4 · 100+ 轮实玩期待）：产地就地可查 + 点击跳转 ——
         悬停出完整产地说明（哪些州 / 是否已据 / 跳转指引）；🗺️ 一键定位产地
         （已据 → 自己的城；未据 → 州治，照 journal-go 时序）。 */
      var mtip = states.length
        ? ' data-tip="产地：' + states.join('、') + '（州城特产）' +
          (held.length ? '；已据 ' + held.join('、') : '；尚未据有 —— 点 🗺️ 定位该州') + '"'
        : '';
      var mgo = states.length
        ? '<span class="mat-go" data-action="mat-go" data-mat="' + mk +
          '" title="前往产地（州城）">🗺️</span>'
        : '';
      return '<span class="' + (have >= need ? '' : 'lack') + '"' + mtip + '>' +
        (md ? md.name : mk) + ' ' + have + '/' + need + src + mgo + '</span>';
    });"""),
    # 2b. matGoTargetOf（放在 matSpecialtyStates 之后）
    ("""  ui.matSpecialtyStates = function (matId) {
    var out = [];
    for (var st in (DATA.STATE_SPECIALTY || {})) {
      if (DATA.STATE_SPECIALTY[st].mat === matId) out.push(st);
    }
    return out;
  };""",
     """  ui.matSpecialtyStates = function (matId) {
    var out = [];
    for (var st in (DATA.STATE_SPECIALTY || {})) {
      if (DATA.STATE_SPECIALTY[st].mat === matId) out.push(st);
    }
    return out;
  };
  /* v89.89（A4）：材料产地跳转目标 —— 已据该州 → 自己的城；未据 → 州治（NPC 州城）。
     州城被占后不在 NPC 列表里，但从自己的城（同州）找得到。返回 null = 无产地记录。 */
  ui.matGoTargetOf = function (matId) {
    var states = ui.matSpecialtyStates(matId);
    if (!states.length) return null;
    var st0 = states[0];
    var mine = (GAME.state.cities || []);
    for (var j = 0; j < mine.length; j++) {
      if (mine[j].state === st0) {
        return { x: mine[j].x, y: mine[j].y, name: mine[j].name, state: st0, owned: true };
      }
    }
    var list = ((GAME.state.map || {}).cities || []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === 'zhou' && list[i].state === st0) {
        return { x: list[i].x, y: list[i].y, name: list[i].name, state: st0, owned: false };
      }
    }
    return null;
  };"""),
    # 2c. renderMapCanvas 定位标记（syncMapInfo 前）
    ("""    var fr = ui.mapFrame;
    GAME.map.render(canvas, { vx: ui.mapView.x, vy: ui.mapView.y,
      spanX: fr.spanX, spanY: fr.spanY, cell: fr.cell,
      showLabels: ui._mapShowLabels !== false });
    ui.syncMapInfo();
  };""",
     """    var fr = ui.mapFrame;
    GAME.map.render(canvas, { vx: ui.mapView.x, vy: ui.mapView.y,
      spanX: fr.spanX, spanY: fr.spanY, cell: fr.cell,
      showLabels: ui._mapShowLabels !== false });
    /* v89.89（A4）：定位标记 —— 材料产地跳转等「已定位」场景的醒目提示。
       双色圆环（金/朱红按 450ms 相位交替），主循环每秒重绘负责"闪"；6 秒自灭。 */
    var mk = ui._mapMark;
    if (mk) {
      if (mk.until > Date.now()) {
        var vw = GAME.map._view;
        var mctx = canvas.getContext && canvas.getContext('2d');
        if (vw && vw.HW && mctx && mctx.beginPath) {
          var cx = vw.ox + (mk.x - mk.y) * vw.HW;
          var cy = vw.oy + (mk.x + mk.y) * vw.HH;
          var phase = Math.floor(Date.now() / 450) % 2 === 0;
          mctx.save();
          mctx.lineWidth = 3;
          mctx.strokeStyle = phase ? 'rgba(232,206,136,.95)' : 'rgba(168,58,44,.95)';
          mctx.beginPath();
          mctx.ellipse(cx, cy, vw.HW * 0.85, vw.HH * 0.85, 0, 0, Math.PI * 2);
          mctx.stroke();
          mctx.beginPath();
          mctx.arc(cx, cy, 3, 0, Math.PI * 2);
          mctx.fillStyle = phase ? 'rgba(232,206,136,.95)' : 'rgba(168,58,44,.95)';
          mctx.fill();
          mctx.restore();
        }
      } else {
        ui._mapMark = null;        /* 过期自灭 */
      }
    }
    ui.syncMapInfo();
  };"""),
], 'ui.js 产地提示 + 定位标记')

# ============================================================
# ③ main.js：doMatGo + 分发
# ============================================================
patch(R + 'js\\main.js', [
    ("""      case 'journal-go':
        ui.closeModal();""",
     """      /* v89.89（A4）：材料产地跳转 —— 关面板 → 切地图 → 居中 → 标记（照 journal-go 时序） */
      case 'mat-go': GAME.doMatGo(el.dataset.mat); break;
      case 'journal-go':
        ui.closeModal();"""),
    ("""  GAME.doClaimQuest = function (qid) {""",
     """  /* v89.89（A4 · 100+ 轮实玩期待）：材料产地一键定位 ——
     "读'材料不足'后要自己想起去哪弄" → 就地给坐标跳转；时序照 journal-go
     （关面板 → 切地图 → 居中 → 提示），另加 6 秒定位标记。 */
  GAME.doMatGo = function (mk) {
    var md = DATA.MATERIAL_BY_ID ? DATA.MATERIAL_BY_ID[mk] : null;
    var nm = (md && md.name) || mk;
    var t = ui.matGoTargetOf(mk);
    if (!t) { ui.toast(nm + '：暂无州城产地记录'); return; }
    ui.closeModal();
    if (ui.view !== 'map') ui.setView('map');
    ui.mapCenterOn(t.x, t.y);
    ui._mapMark = { x: t.x, y: t.y, until: Date.now() + 6000 };
    ui.renderMapCanvas();
    ui.toast(nm + '：「' + t.state + '」特产' +
      (t.owned ? '（已据）' : '（未据 —— 州治「' + t.name + '」）') +
      ' —— 已定位(' + t.x + ',' + t.y + ')');
  };
  GAME.doClaimQuest = function (qid) {"""),
], 'main.js doMatGo')

# ============================================================
# ④ index.html：.mat-go 样式
# ============================================================
patch(R + 'index.html', [
    ("""  .doc-bar .db-fav.on { opacity: 1; }""",
     """  .doc-bar .db-fav.on { opacity: 1; }
  /* v89.89（A4）：材料产地跳转图标 */
  .mat-go { cursor: pointer; opacity: .55; margin-left: 3px; }
  .mat-go:hover { opacity: 1; }"""),
], 'index.html mat-go 样式')

print('DONE' if ok_all else 'HAS-FAILURES')
sys.exit(0 if ok_all else 1)
