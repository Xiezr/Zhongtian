# -*- coding: utf-8 -*-
"""v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」。
① ui.js：新增 ui.mapTipFor（浮层内容，走既有唯一出口）。
② main.js：bindEvents 加地图画布的 mousemove / mouseout（按格节流）。
"""
import io

UI = r'E:\Deepseekdb\js\ui.js'
MJ = r'E:\Deepseekdb\js\main.js'

# ============================================================
# ① ui.js：ui.mapTipFor（插在 ui.tipFor 之后）
# ============================================================
s = io.open(UI, encoding='utf-8', newline='').read()
anchor = """    var t = node.closest('[data-tip]');
    if (t) {
      var txt = t.getAttribute('data-tip') || '';
      if (txt) return { html: U.escape(txt), anchor: t };
    }
    return null;
  };
"""
assert s.count(anchor) == 1, ('ui anchor', s.count(anchor))
add = anchor + """
  /* ============================================================
   * v89.88（老板需求 4）：大地图悬浮浮层的内容 —— 「坐标 + 等级」
   * ------------------------------------------------------------
   * 输入 = `GAME.map.pick` 的命中对象（与点击走**同一条**拾取路径）。
   * 等级一律走既有唯一出口，不另造一份：
   *   · 城池     → `GAME.cityLvOf`（城等级 = 官府 = 建筑，一号到底）
   *   · 野外城池 → `fort.level`（等级每日变化）
   *   · 野地     → `GAME.map.wildLevelNow`（已占读记录值、无主读日盐值）
   * 输出用既有浮层类（.tip-t / .tip-l），与 data-tip 提示同一套样式 ——
   * 一层、一套定位规则（tipPos 四面夹进视口），不会飞出屏幕。
   * ============================================================ */
  ui.mapTipFor = function (hit) {
    if (!hit || hit.x == null) return null;
    var head = '', rows = [];
    function line(txt) { rows.push('<div class="tip-l">' + txt + '</div>'); }
    if (hit.kind === 'player' && hit.city) {
      head = '🏯 ' + U.escape(hit.city.name) + '（己方）';
      line('城等级 <b>Lv' + GAME.cityLvOf(hit.city) + '</b> · 点击进入城池面板');
    } else if (hit.kind === 'npc' && hit.city) {
      var tier = (DATA.CITY_TIER || {})[hit.city.type] || '名城';
      head = '🏯 ' + U.escape(GAME.cityFullName(hit.city));
      line('城等级 <b>Lv' + GAME.cityLvOf(hit.city) + '</b> · ' + U.escape(tier) + '　点击可出征');
    } else if (hit.kind === 'fort' && hit.fort) {
      head = '🏕 ' + U.escape(GAME.fortLabelOf(hit.fort));
      line('野外城池 <b>Lv' + hit.fort.level + '</b> · 等级每日变化　点击可出征');
    } else {
      var tile = GAME.map.tile(hit.x, hit.y);
      var ter = (tile && DATA.TERRAIN[tile.terrain]) || null;
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(hit.x, hit.y) : 0;
      var own = GAME.map.wildAt(hit.x, hit.y);
      head = (ter ? ter.name : '空地') + (own ? '（己方 · 已占）' : '');
      line('野地 <b>Lv' + lv + '</b>' + (lv > 0 ? ' · 点击可出征' : ' · 无守军'));
    }
    var cur = GAME.currentCity && GAME.currentCity();
    var d = cur ? Math.max(Math.abs(cur.x - hit.x), Math.abs(cur.y - hit.y)) : null;
    line('📍 坐标 <b>(' + hit.x + ', ' + hit.y + ')</b>'
      + (d == null ? '' : '　距 ' + U.escape(cur.name) + ' ' + d + ' 格'));
    return '<div class="tip-t">' + head + '</div>' + rows.join('');
  };
"""
s = s.replace(anchor, add, 1)
io.open(UI, 'w', encoding='utf-8', newline='').write(s)
print('OK ui.js')

# ============================================================
# ② main.js：bindEvents 里加 mousemove / mouseout
# ============================================================
m = io.open(MJ, encoding='utf-8', newline='').read()
anchor2 = """      handleCanvasClick(e);
    });
    /* v45（需求 3）：`<select>` 触发的是 change 而非 click，走不了上面那套 click 委托。"""
assert m.count(anchor2) == 1, ('mj anchor', m.count(anchor2))
add2 = """      handleCanvasClick(e);
    });
    /* ============================================================
     * v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」
     * ------------------------------------------------------------
     * 复用既有浮层系统（ui.tipShow / tipHide，与 data-tip 提示同一层渲染）。
     * 按"格"节流：同一格内的 mousemove 不重绘（浮层稳稳停住，不追鼠标抖）；
     * 换格才更新、移出画布即收起。拾取走 GAME.map.pick（与点击同一条路）。
     * ============================================================ */
    var _mapHoverKey = null;
    document.addEventListener('mousemove', function (e) {
      var t = e.target;
      if (!t || t.id !== 'mapCanvas') return;
      var hit = GAME.map.pick(t, e.clientX, e.clientY);
      var key = hit ? (hit.kind + '@' + hit.x + ',' + hit.y) : 'none';
      if (key === _mapHoverKey) return;                       /* 同格：不重绘 */
      _mapHoverKey = key;
      var tip = (hit && GAME.ui.mapTipFor) ? GAME.ui.mapTipFor(hit) : null;
      if (!tip) { GAME.ui.tipHide(); return; }
      GAME.ui.tipShow(tip, {
        getBoundingClientRect: function () {
          return { left: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 };
        },
      });
    });
    document.addEventListener('mouseout', function (e) {
      if (!e.target || e.target.id !== 'mapCanvas') return;
      _mapHoverKey = null;
      GAME.ui.tipHide();
    });
    /* v45（需求 3）：`<select>` 触发的是 change 而非 click，走不了上面那套 click 委托。"""
m = m.replace(anchor2, add2, 1)
io.open(MJ, 'w', encoding='utf-8', newline='').write(m)
print('OK main.js')
