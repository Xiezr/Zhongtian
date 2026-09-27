# -*- coding: utf-8 -*-
# v89.141 批 B：UI 层
#   · index.html：.bt-log 硬上限 340px
#   · ui.js：城外 12 列 / bagCell data-bulk / 宝物页 bulk / openBulkUse
#   · main.js：contextmenu 委托 + bulk-use-ask/do
import io, os

ROOT = 'E:/Deepseekdb/'
ok = []

def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:40]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(rel + ':' + tag)
    assert '\r\n' not in s, rel + ' 行尾混入 CRLF'
    tmp = p + '.tmp141'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    assert len(chk) == len(s)
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))

# ══════════════ index.html ══════════════
patch('index.html', [
    ("""  /* v89.140（老板 1）：「底部的回合记录的记录框高度**稍降低**，为上方腾出空间」——
     理想高 336 → **250**（min 130 保底），腾出的 ~86px 归上方战场区。 */
  .bt-log { flex: 1 1 250px; max-height: none; min-height: 130px; overflow-y: auto;""",
     """  /* v89.140（老板 1）：「底部的回合记录的记录框高度**稍降低**，为上方腾出空间」——
     理想高 336 → **250**（min 130 保底），腾出的 ~86px 归上方战场区。
     v89.141（按建议执行）：补**硬上限 340px** —— 旧 `max-height:none` 在有富余时
     会一路撑到 ~425px（把"降高"又吃回去）；340 = 250 理想 + 90 弹性，
     常规载荷不再无限涨，极端载荷仍可压到 130（min-height 保底）。 */
  .bt-log { flex: 1 1 250px; max-height: 340px; min-height: 130px; overflow-y: auto;""",
     'bt-log 340'),
])

# ══════════════ ui.js ══════════════
patch('js/ui.js', [
    # ① 城外 12 列
    ("""    /* 88px 格子下 6 列要 7 行 = 616px，超出视区；8 列时上限 40 块
       = 5 行 = 440px、宽 704px，在固定视区内正合适。 */
    var COLS = 8;""",
     """    /* v89.141（老板 0）：「城外地块最多为 12×9 块」——**12 列**是老板指定的终极网格
       （108 = 12×9 整整）；8 列时代 96 块要 12 行（高度爆掉）、且 Lv1=12 块时末行缺口
       看着像"掉了块地"。12 列下：Lv1（12 块）= 1 整行、都城档 96 = 8 整行、
       满 108 = 9 整行，永不缺口。fitBoard 按窗口自适应格子边长（≥40px 下限）。 */
    var COLS = 12;""",
     'COLS 12'),

    # ② bagCell：data-bulk
    ("""    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' + (o.view ? ' data-view="' + o.view + '"' : '') : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '');""",
     """    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' + (o.view ? ' data-view="' + o.view + '"' : '') : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '') + (o.bulk ? ' data-bulk="1"' : '');""",
     'bagCell bulk'),

    # ③ 宝物页：悬停文案 + bulk 标记
    ("""          attr: (GAME.itemEffect(it) || '') +
            (route.direct ? '　（点击使用 1 个）' : ('　↳ ' + (route.hint || '需在对应界面使用'))),""",
     """          attr: (GAME.itemEffect(it) || '') +
            (route.direct ? '　（点击使用 1 个 · 右键批量）' : ('　↳ ' + (route.hint || '需在对应界面使用'))),""",
     '宝物悬停文案'),
    ("""        if (route.direct) { cell.act = 'use-bag-item'; }""",
     """        if (route.direct) { cell.act = 'use-bag-item'; cell.bulk = 1; }   /* v89.141：右键 = 批量小窗 */""",
     '宝物 bulk 标记'),

    # ④ openBulkUse（插在 ui.matCell 之前）
    ("""  ui.matCell = function (m, have, dim, sort) {""",
     """  /* v89.141（老板 0 · 按建议执行）：「宝物整叠使用」——
     单击仍 = 使用 1 个（v89.140 既定交互不变）；**右键**（contextmenu，见 main.js 委托）
     打开本窗 → 一次用 N 个（「最多」= 全部用完）。
     出口复用 GAME.doBagUse：≥2 走 useItemMany（与旧"数量框"时代同一出口，不另立规则）。 */
  ui.openBulkUse = function (itemId) {
    var s = GAME.state, have = (s.items || {})[itemId] || 0;
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it) { ui.toast('无此物品'); return; }
    if (have <= 0) { ui.toast('数量为 0，无法使用'); return; }
    var route = ui.itemRouteOf(it);
    if (!route.direct) { ui.toast(route.hint || '该物品需在对应界面使用'); return; }
    ui.openShell({
      title: '批量使用 · ' + U.escape(it.name),
      sub: '持有 ×' + have + '　（单击 = 用 1 个 · 右键 = 本窗）',
      size: 'sm',
      body: '<div class="attr"><span class="k">效果</span><span class="v good">' +
          U.escape(GAME.itemEffect(it) || '—') + '</span></div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('bulk-q', 1, 0, have) +
          '<span class="op-hint">用几个就生效几次（「最多」= 全部用完）</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="bulk-use-do" data-key="' + itemId + '">使用</button>' +
        '</div>',
    });
  };

  ui.matCell = function (m, have, dim, sort) {""",
     'openBulkUse'),
])

# ══════════════ main.js ══════════════
patch('js/main.js', [
    # ① contextmenu 委托（click 委托之后）
    ("""      handleCanvasClick(e);
    });
    /* ============================================================
     * v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」""",
     """      handleCanvasClick(e);
    });
    /* ============================================================
     * v89.141（老板 0 · 按建议执行）：背包宝物的**批量使用**入口 ——
     *   单击格子 = 用 1 个（既定）；**右键** = 开「用几个」小窗（整叠）。
     *   只认带 `data-bulk` 的格子（当前 = 宝物页的就地使用类）；其它位置右键
     *   行为不变（保留浏览器默认菜单）。
     * ============================================================ */
    document.addEventListener('contextmenu', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('[data-bulk]') : null;
      if (!t) return;
      e.preventDefault();
      GAME.action('bulk-use-ask', t);
    });
    /* ============================================================
     * v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」""",
     'contextmenu 委托'),

    # ② 两个 case
    ("""      case 'use-bag-item': {
        /* v29（需求 14）：使用数量取本行输入框 */
        var qf = el.getAttribute('data-qty-from');
        GAME.doBagUse(el.dataset.key, qf ? ui.qtyValueOf(qf) : 1);
        break;
      }""",
     """      case 'use-bag-item': {
        /* v29（需求 14）：使用数量取本行输入框 */
        var qf = el.getAttribute('data-qty-from');
        GAME.doBagUse(el.dataset.key, qf ? ui.qtyValueOf(qf) : 1);
        break;
      }
      /* v89.141（老板 0 · 按建议执行）：宝物整叠使用（右键开小窗 → 一次用 N 个） */
      case 'bulk-use-ask': ui.openBulkUse(el.dataset.key); break;
      case 'bulk-use-do': {
        var bq = ui.qtyValueOf('bulk-q');
        ui.closeModal();
        GAME.doBagUse(el.dataset.key, bq);
        break;
      }""",
     'bulk-use case'),
])

print('✅ 批 B 完成：' + ' / '.join(ok))
