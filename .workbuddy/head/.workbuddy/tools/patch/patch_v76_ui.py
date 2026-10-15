# -*- coding: utf-8 -*-
"""v76 · 四条（布局 / 地图导航 / 将领分页 / 建筑弹窗）—— 代码+样式补丁

老板原文：
  1.城池的左侧统计框没有到底，跟右边的建筑范围框宽度不一致。
  2.底下有一个导航栏，可以考虑把地图的导航栏（上下左右，坐标之类）放到这个导航范围内
  3.将领界面，左侧将领列表12个空格每页，平分空间吧，当城池超过12个将领，自动在底部导航栏产生翻页菜单
  4.建筑的升级，拆除（1级，只能逐级拆除），移动/交换放在同一行上，并进行你的设计小巧思。
    建筑界面的关闭按钮在弹窗界面的最底部。这种备注去掉：招募将领（每级+1停留将领），市井传闻查名将坐标。
    拆毁可返还累计投入的 50%：粮食 58.2万 · 木材 359.2万 · 石料 184.3万 · 铁锭 75.6万

改动：
  L1  左栏 flex 化：最后一段拉伸到栏底（铺满到底）
  L2  .gb-list 固定 132px → 撑满（左栏铺满的主力）
  L3  .map-wrap 撤 78px 浮标让位
  L4  .map-dock 改为底部条内的静态排布
  U1  fitMapCell 让位 78 → 10
  U2  mapHTML：dock 改登记到底部导航条（ui._bottom.push）
  G1  GEN_SLOTS/GEN_PER 注释与常量
  G2  generalsHTML：12 席/页 + 底部条翻页
  G3  帮助文案更新
  G4  .gen-list 行平分高度
  B1  demolishRefund：逐级（本步投入的 50%）
  B2  demolishAt：逐级降级；Lv1 才整座移除
  B3  openBuildModal：去 desc / 去返还长备注 / 三键同排 / 关闭单独吸底
  B4  .bldg-acts/.bldg-act/.ba-sub CSS + .bldg-foot 居中
  B5  openDemolishConfirm：城内逐级文案
"""
import io, sys

UI = r'E:\Deepseekdb\js\ui.js'
HTML = r'E:\Deepseekdb\index.html'
DOM = r'E:\Deepseekdb\js\domain.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t or new.replace('\n', '\r\n') in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    cands = []
    if old in t:
        cands.append((old, new))
    else:
        old_c, new_c = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
        if old_c in t:
            cands.append((old_c, new_c))
    if not cands:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    old2, new2 = cands[0]
    c = t.count(old2)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, c))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


# ============================================================
# L1 · 左栏铺满到底（flex 列 + 末段拉伸）
# ============================================================
patch(
    HTML,
    """  .auth-side { min-height: 0; overflow-y: auto; scrollbar-gutter: stable; }""",
    """  .auth-side { min-height: 0; overflow-y: auto; scrollbar-gutter: stable;
    /* v76（老板）：「城池的左侧统计框没有到底」——左栏改 flex 列，
       最后一段（资源+驻军）拉伸到栏底：消灭底部留白、与右侧棋盘区底线一致；
       内容超长时照旧整体滚动。 */
    display: flex; flex-direction: column; }
  .auth-side > .side-block:last-child { flex: 1 1 auto; display: flex; flex-direction: column; }
  .auth-side > .side-block:last-child .garrison-bar { flex: 1 1 auto; display: flex; flex-direction: column; }""",
    'L1 左栏 flex 铺满',
)

# ============================================================
# L2 · .gb-list 撑满
# ============================================================
patch(
    HTML,
    """  .gb-list { height: 132px; overflow-y: auto; padding: 0 9px 8px; }""",
    """  /* v76（老板）：「左侧统计框没有到底」——驻军列表从固定 132px 改**撑满剩余高度**
     （左栏"铺满到底"的主力；兵多时列表内部照旧滚动）。 */
  .gb-list { flex: 1 1 auto; min-height: 132px; overflow-y: auto; padding: 0 9px 8px; }""",
    'L2 gb-list 撑满',
)

# ============================================================
# L3 · .map-wrap 撤浮标让位
# ============================================================
patch(
    HTML,
    """  .map-wrap { position: relative; padding: var(--sp-5); padding-bottom: 78px; }""",
    """  /* v76（老板）：导航迁入底部条后，这里不再需要为右下浮标让位（78px 撤） */
  .map-wrap { position: relative; padding: var(--sp-5); }""",
    'L3 map-wrap 撤让位',
)

# ============================================================
# L4 · .map-dock 改静态（底部条内）
# ============================================================
patch(
    HTML,
    """  .map-dock {
    /* v45（需求 2）：由右下角改为**水平居中** —— 老板要求"导航条居中放置"。
       ⚠️ 不能用 `left:50% + translateX(-50%)`：abspos 元素的 shrink-to-fit 是拿
       **「从 left 到包含块右缘」** 当可用宽度算的，left:50% 等于只给了一半宽度 ——
       浮标被挤窄 → 按钮里的字折行 → 整条从 44px 胖成 60px（实测踩过）。
       正确写法是 left/right 都贴边 + margin:auto + width:fit-content：
       可用宽度是整个包含块，再按内容自适应宽度并居中。 */
    position: absolute; left: 0; right: 0; bottom: var(--sp-5);
    margin: 0 auto;
    width: fit-content;
    /* v44（老板要求）：**整条压成一行** —— 原来「方向键 3×2 网格 ＋ 坐标竖排两行」
       共占三行高度。现在方向键横排 + 视野区间 + 点选坐标 + 坐标输入同处一行。 */
    display: flex; align-items: center; gap: 8px; padding: 7px 10px;
    background: rgba(12,14,18,.88); border: 1px solid var(--line-strong);
    border-radius: 8px; box-shadow: 0 4px 14px rgba(var(--sh-rgb),.5);
    max-width: calc(100% - var(--sp-5) * 2);
  }""",
    """  /* v76（老板）：「把地图的导航栏（上下左右，坐标之类）放到这个导航范围内」——
     地图导航迁入**底部固定导航条**（.bottombar，由 ui.mapHTML 登记、paintBottom 落画），
     改为静态排布、融入条内（条高 46px，v44 的"一行"布局原样保留）。
     历史：v24 收进右下浮标 → v45 浮标内水平居中 → v76 移入底部条。 */
  .map-dock {
    display: flex; align-items: center; gap: 8px; padding: 2px 4px;
    max-width: 100%;
  }""",
    'L4 map-dock 静态化',
)

# ============================================================
# U1 · fitMapCell 让位收缩
# ============================================================
patch(
    UI,
    """    var pad = 28, extraH = 78, breath = 16;   /* 28 = .map-wrap 内边距；78 = 右下浮标让位 */""",
    """    /* v76（老板）：地图导航迁入底部条 —— 不再为右下浮标让位（78 → 10，只留呼吸） */
    var pad = 28, extraH = 10, breath = 16;""",
    'U1 fitMapCell 让位',
)

# ============================================================
# U2 · mapHTML：dock → 底部导航条
# ============================================================
patch(
    UI,
    """    return '<div class="map-wrap">' +
      '<canvas id="mapCanvas"></canvas>' +
      '<div class="map-dock">' +
        '<div class="map-pad">' +
          mkBtn('left', -ui.MAP_STEP_X, 0, '◀') + mkBtn('up', 0, -ui.MAP_STEP_Y, '▲') +
          mkBtn('down', 0, ui.MAP_STEP_Y, '▼') + mkBtn('right', ui.MAP_STEP_X, 0, '▶') +
        '</div>' +
        '<span class="mk-sep"></span>' +
        '<span class="map-info" id="map-info">' + ui.mapInfoText() + '</span>' +
        '<span class="map-info mk-pick" id="map-pick-info">' + ui.mapPickText() + '</span>' +
        '<span class="mk-sep"></span>' +
        '<span class="mk-lbl">坐标</span>' +
        '<input id="map-gx" type="number" min="1" max="' + DATA.MAP_W + '" value="' + pc.x + '">' +
        '<span class="mk-lbl">,</span>' +
        '<input id="map-gy" type="number" min="1" max="' + DATA.MAP_H + '" value="' + pc.y + '">' +
        '<button class="btn sm gold" data-action="map-goto">前往</button>' +
        '<button class="btn sm" data-action="map-center">回主城</button>' +
        '<button class="btn sm" data-action="map-capital">洛阳</button>' +
      '</div>' +
      '</div>';""",
    """    /* v76（老板）：「底下有一个导航栏，可以考虑把地图的导航栏（上下左右，坐标之类）
       放到这个导航范围内」—— 导航不再挂地图页浮标，改登记到本帧的**底部固定导航条**
       （ui._bottom → paintBottom）；地图页本身只剩棋盘。 */
    ui._bottom.push('<div class="map-dock">' +
        '<div class="map-pad">' +
          mkBtn('left', -ui.MAP_STEP_X, 0, '◀') + mkBtn('up', 0, -ui.MAP_STEP_Y, '▲') +
          mkBtn('down', 0, ui.MAP_STEP_Y, '▼') + mkBtn('right', ui.MAP_STEP_X, 0, '▶') +
        '</div>' +
        '<span class="mk-sep"></span>' +
        '<span class="map-info" id="map-info">' + ui.mapInfoText() + '</span>' +
        '<span class="map-info mk-pick" id="map-pick-info">' + ui.mapPickText() + '</span>' +
        '<span class="mk-sep"></span>' +
        '<span class="mk-lbl">坐标</span>' +
        '<input id="map-gx" type="number" min="1" max="' + DATA.MAP_W + '" value="' + pc.x + '">' +
        '<span class="mk-lbl">,</span>' +
        '<input id="map-gy" type="number" min="1" max="' + DATA.MAP_H + '" value="' + pc.y + '">' +
        '<button class="btn sm gold" data-action="map-goto">前往</button>' +
        '<button class="btn sm" data-action="map-center">回主城</button>' +
        '<button class="btn sm" data-action="map-capital">洛阳</button>' +
      '</div>');
    return '<div class="map-wrap">' +
      '<canvas id="mapCanvas"></canvas>' +
      '</div>';""",
    'U2 dock 进底部条',
)

# ============================================================
# G1 · GEN_SLOTS / GEN_PER
# ============================================================
patch(
    UI,
    """  ui.GEN_SLOTS = 12;             /* 最低显示席位数（招贤馆房间不足时也画够） */
  /* v45（需求 1）：`ui.GEN_PER_PAGE` 已删除 —— 左清单改**整段滚动**，不再分页。
     老板明确点名"不要那么多页""不要限制每页的将领个数，这里允许他用下拉框（滚动）"。 */""",
    """  ui.GEN_SLOTS = 12;             /* 每页显示席位数（空着也画够 12 格） */
  /* v76（老板）：「左侧将领列表12个空格每页，平分空间吧，当城池超过12个将领，
     自动在底部导航栏产生翻页菜单」—— v45 的"整段滚动"回归**每页 12 席 + 底部条翻页**：
     每页固定 12 行（不足补空席、12 行平分面板高度），超过 12 位将领时
     翻页条登记到底部导航条（与其它长列表同一套机制）。 */
  ui.GEN_PER = 12;               /* 每页 12 席（= GEN_SLOTS） */""",
    'G1 GEN_PER',
)

# ============================================================
# G2 · generalsHTML：12 席/页 + 翻页
# ============================================================
patch(
    UI,
    """    /* v45（需求 1）：**取消分页** —— 老板要求"不要那么多页""不要限制每页的将领个数"，
       并明确允许这一处用滚动。理由也成立：分页会把"我到底有几个将"切成好几页，
       而右栏档案本来就要占地方，左栏滚动比翻页顺手。
       空席位仍照旧补足到 GEN_SLOTS（让人看见席位上限），靠滚动看全。 */
    var total = Math.max(ui.GEN_SLOTS, pool.length);
    /* 选中将领：默认第一位；无效（被解雇/换档/换范围）时回落 */
    var sel = null;
    pool.forEach(function (g) { if (g.id === ui._genSel) sel = g; });
    if (!sel) sel = pool[0] || null;
    ui._genSel = sel ? sel.id : null;

    var rows = [];
    for (var i = 0; i < total; i++) rows.push(ui.genRow(pool[i], i, cap, ui._genSel));""",
    """    /* v76（老板）：「12个空格每页，平分空间吧，当城池超过12个将领，
       自动在底部导航栏产生翻页菜单」—— 每页固定 12 席（不足以空席补满），
       超过 12 位将领时把翻页登记到底部导航条；席位号跨页连续（第 N 席 = from + i）。 */
    var pg = ui.pageOf('gen', pool.length, ui.GEN_PER);
    /* 选中将领：默认第一位；无效（被解雇/换档/换范围）时回落 */
    var sel = null;
    pool.forEach(function (g) { if (g.id === ui._genSel) sel = g; });
    if (!sel) sel = pool[pg.from] || pool[0] || null;
    ui._genSel = sel ? sel.id : null;

    var rows = [];
    for (var i = 0; i < ui.GEN_PER; i++) {
      var gi = pg.from + i;
      rows.push(ui.genRow(pool[gi], gi, cap, ui._genSel));
    }
    if (pg.maxPage > 1) ui.pagerHTML('gen', pool.length, ui.GEN_PER);""",
    'G2 generalsHTML 分页',
)

# ============================================================
# G3 · 帮助文案
# ============================================================
patch(
    UI,
    """          '左侧清单不再分页 —— 人多时直接滚动') +""",
    """          '左侧清单每页 12 席；超过 12 位将领时在底部导航条翻页') +""",
    'G3 帮助文案',
)

# ============================================================
# G4 · .gen-list 行平分高度
# ============================================================
patch(
    HTML,
    """    max-height: 100%; overflow-y: auto; scrollbar-gutter: stable; padding-right: 2px;
  }
  .gen-row {""",
    """    max-height: 100%; overflow-y: auto; scrollbar-gutter: stable; padding-right: 2px;
  }
  /* v76（老板）：「12个空格每页，平分空间吧」——12 行平分清单高度（行随面板伸缩，
     高度不足时才退回滚动 + 最小行高兜底）。 */
  .gen-list > .gen-row { flex: 1 1 0; min-height: 40px; }
  .gen-row {""",
    'G4 gen-row 平分',
)

# ============================================================
# B1 · demolishRefund 逐级
# ============================================================
patch(
    DOM,
    """  /* 城内建筑拆毁（返还累计投入的 50%） */
  GAME.demolishRefund = function (city, gridIndex) {
    var cell = city && city.cells[gridIndex];
    if (!cell || !cell.build) return null;
    var b = DATA.BUILDINGS[cell.build.id];
    if (!b) return null;
    return GAME.scaledCost(GAME.investedIn(b, cell.build.lvl), DATA.DEMOLISH_RATE);
  };""",
    """  /* 城内建筑拆毁（v76 老板：「拆除（1级，只能逐级拆除）」）——
     每次只降 1 级：返还**本步投入**（达到当前等级的那一份造价 = 累计差）的 50%；
     Lv1 时拆除 = 整座移除（返还首级投入的 50%）。 */
  GAME.demolishRefund = function (city, gridIndex) {
    var cell = city && city.cells[gridIndex];
    if (!cell || !cell.build) return null;
    var b = DATA.BUILDINGS[cell.build.id];
    if (!b) return null;
    var lv = cell.build.lvl;
    var inv = GAME.investedIn(b, lv), prev = GAME.investedIn(b, Math.max(0, lv - 1));
    var step = { grain: inv.grain - prev.grain, wood: inv.wood - prev.wood,
      stone: inv.stone - prev.stone, iron: inv.iron - prev.iron };
    return GAME.scaledCost(step, DATA.DEMOLISH_RATE);
  };""",
    'B1 demolishRefund 逐级',
)

# ============================================================
# B2 · demolishAt 逐级
# ============================================================
patch(
    DOM,
    """    var b = DATA.BUILDINGS[cell.build.id];
    var lv = cell.build.lvl;
    var inv = GAME.investedIn(b, lv);
    var back = GAME.scaledCost(inv, DATA.DEMOLISH_RATE);
    GAME.refundCert(inv, DATA.DEMOLISH_RATE);
    cell.build = null;
    cell.pending = null;
    /* 清掉该格的建造/升级队列项，避免队列完成后写入已拆毁的格子 */
    s.queues.build = (s.queues.build || []).filter(function (q) {
      return !(q.cityId === cityId && q.gridIndex === gridIndex);
    });
    GAME.statBump('demolished', 1);
    GAME.log('拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back));
    return { ok: true, msg: '已拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back), back: back };
  };""",
    """    var b = DATA.BUILDINGS[cell.build.id];
    var lv = cell.build.lvl;
    /* v76（老板）：「拆除（1级，只能逐级拆除）」—— 一级一级拆：
       Lv>1 每次只降 1 级；拆到 Lv1 再拆才整座移除（腾出地块）。
       返还 = 本步投入（累计差）的 50%。 */
    var inv = GAME.investedIn(b, lv), prev = GAME.investedIn(b, Math.max(0, lv - 1));
    var step = { grain: inv.grain - prev.grain, wood: inv.wood - prev.wood,
      stone: inv.stone - prev.stone, iron: inv.iron - prev.iron };
    var back = GAME.scaledCost(step, DATA.DEMOLISH_RATE);
    GAME.refundCert(step, DATA.DEMOLISH_RATE);
    if (lv > 1) {
      cell.build.lvl = lv - 1;
      GAME.statBump('demolished', 1);
      GAME.log('拆 ' + b.name + ' Lv' + lv + ' → Lv' + (lv - 1) + '，返还 ' + GAME.costString(back));
      return { ok: true, msg: '已拆 1 级：' + b.name + ' Lv' + lv + ' → Lv' + (lv - 1) + '，返还 ' + GAME.costString(back), back: back };
    }
    cell.build = null;
    cell.pending = null;
    /* 清掉该格的建造/升级队列项，避免队列完成后写入已拆毁的格子 */
    s.queues.build = (s.queues.build || []).filter(function (q) {
      return !(q.cityId === cityId && q.gridIndex === gridIndex);
    });
    GAME.statBump('demolished', 1);
    GAME.log('拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back));
    return { ok: true, msg: '已拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back), back: back };
  };""",
    'B2 demolishAt 逐级',
)

# ============================================================
# B3 · openBuildModal：去 desc / 去备注 / 三键同排 / 关闭吸底
# ============================================================
patch(
    UI,
    """      ui.openModal(
        /* v73（老板）：顶部图标不留（旧 emoji 图标本就不如棋盘位图，索性撤下） */
        '<div class="gold-heading">' + b.name + ' · Lv' + cell.build.lvl + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' + b.desc + '</div>' + extra +
        (dRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(dRef) + '</div>' : '') +
        barQueue +
        /* v68（老板「弹窗统一」· 设计规范 §11）：建筑弹窗统一动线三段 ——
           ① 功能行「用建筑」：进功能面板（金色主按钮）；
           ② 升级行「建建筑」：费用与按钮**同行**（改前费用在上、按钮在下，隔着一整块信息区）；
           ③ 底栏「管建筑」：危险（左）· 关闭（中，天然误点缓冲）· 管理（右）
              —— v28「拆毁左下、移动右下、中间留白」的原摆位保留，关闭正好居中。 */
        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            '<div class="op-zone-t">功能</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button></div>' +
          '</div>') : ''; })() +
        '<div class="op-zone">' +
          '<div class="op-zone-t">升级</div>' +
          '<div class="op-row op-row-between">' +
            '<span class="op-kv">费用 <b>' + costStr + '</b></span>' +
            (upCost ? '<button class="btn" data-action="confirm-upgrade" data-idx="' + idx + '">升级 → Lv' + (cell.build.lvl + 1) + '</button>' : '<span class="op-done">' + (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span>') +
          '</div></div>' +
        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="' + (dRef ? '返还累计投入的 50%：' + GAME.costString(dRef) : '不可恢复') + '（需二次确认）">拆毁</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          (b.id === 'guanfu' ? '<span></span>'
            : '<button class="btn sm" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换</button>') +
        '</div>'
      );""",
    """      ui.openModal(
        /* v73（老板）：顶部图标不留（旧 emoji 图标本就不如棋盘位图，索性撤下）。
           v76（老板）：「这种备注去掉：招募将领（每级+1停留将领），市井传闻查名将坐标」——
           标题下的建筑描述（b.desc）连同「拆毁可返还累计投入的 50%：粮…」长备注一并撤除。 */
        '<div class="gold-heading">' + b.name + ' · Lv' + cell.build.lvl + '</div>' +
        extra +
        barQueue +
        /* v68（弹窗统一 · 设计规范 §11）动线：① 功能「用建筑」（金色主按钮）；
           v76（老板）：「建筑的升级，拆除（1级，只能逐级拆除），移动/交换放在同一行上，
           并进行你的设计小巧思。建筑界面的关闭按钮在弹窗界面的最底部」——
           ② 操作三键**同排**、等宽，每键带一行小字说明后果（费用 / 降级去向 / 用途）；
           ③ 关闭单独一行、钉在弹窗最底部。 */
        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            '<div class="op-zone-t">功能</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button></div>' +
          '</div>') : ''; })() +
        '<div class="bldg-acts">' +
          (upCost
            ? '<button class="btn gold bldg-act" data-action="confirm-upgrade" data-idx="' + idx + '">⬆ 升级 → Lv' + (cell.build.lvl + 1) +
                '<span class="ba-sub">费用 ' + costStr + '</span></button>'
            : '<button class="btn bldg-act dim" disabled>⬆ 升级<span class="ba-sub">' +
                (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span></button>') +
          '<button class="btn red bldg-act" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="拆除需二次确认">⛏ 拆 1 级<span class="ba-sub">' +
            (cell.build.lvl > 1 ? ('Lv' + cell.build.lvl + ' → Lv' + (cell.build.lvl - 1)) : '整座移除') + '</span></button>' +
          (b.id === 'guanfu' ? ''
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +
        '</div>' +
        '<div class="bldg-foot">' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
        '</div>'
      );""",
    'B3 openBuildModal 改造',
)

# B3b · 删掉不再使用的 dRef 变量
patch(
    UI,
    """      var dRef = GAME.demolishRefund(c, idx);
      var extra = '';""",
    """      var extra = '';""",
    'B3b 删 dRef',
)

# ============================================================
# B4 · .bldg-acts CSS + .bldg-foot 居中
# ============================================================
patch(
    HTML,
    """  /* v28（需求 7）：拆毁（左）与移动/交换（右）分居两端、且都收小。
     两端分离是为了避免误点 —— 拆毁不可逆，紧挨着移动很容易点错。 */""",
    """  /* v76（老板）：「升级，拆除，移动/交换放在同一行上，并进行你的设计小巧思」——
     三键同排、等宽；每键下方一行小字说明后果（费用 / 降级去向 / 用途）。
     （v28 的"拆毁左、移动右分居两端"随 v76 的三键同排一并退役 —— 老板点名要同行。） */
  .bldg-acts { display: flex; gap: 8px; margin-top: 10px; }
  .bldg-acts .bldg-act { flex: 1 1 0; display: flex; flex-direction: column; align-items: center;
    gap: 1px; padding: 7px 4px; line-height: 1.15; }
  .bldg-acts .bldg-act .ba-sub { font-size: var(--fs-cap); font-weight: 400; opacity: .72; }""",
    'B4a bldg-acts CSS',
)
patch(
    HTML,
    """  /* v73（老板）：「取消升级和关闭按钮要固定在底部，对不同建筑来说位置都要固定」——
     **吸底**：正文再长，底栏也钉在弹窗下沿（sticky），六处建筑弹窗同一位置。
     几何校准（真机实测）：左右负边距 = .inner-panel 的 padding(12px) → 出血到面板边缘；
     `bottom: -12px` + 底部垫 22px → 钉在**面板下沿**（实测底沿差 13px → 1px，三档滚动全对齐）。 */
  .bldg-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px;""",
    """  /* v73（老板）：「取消升级和关闭按钮要固定在底部，对不同建筑来说位置都要固定」——
     **吸底**：正文再长，底栏也钉在弹窗下沿（sticky），六处建筑弹窗同一位置。
     几何校准（真机实测）：左右负边距 = .inner-panel 的 padding(12px) → 出血到面板边缘；
     `bottom: -12px` + 底部垫 22px → 钉在**面板下沿**（实测底沿差 13px → 1px，三档滚动全对齐）。
     v76（老板）：「建筑界面的关闭按钮在弹窗界面的最底部」—— 操作三键上移后，
     底栏只剩「关闭」一枚，居中摆放（原 space-between 三格摆位随三键同排退役）。 */
  .bldg-foot { display: flex; justify-content: center; align-items: center; gap: 8px;""",
    'B4b bldg-foot 居中',
)

# ============================================================
# B5 · openDemolishConfirm：城内逐级文案
# ============================================================
patch(
    UI,
    """    var html = '<div class="gold-heading">拆毁 ' + U.escape(name) + ' Lv' + lv + '</div>';
    html += '<div class="attr"><span class="k">返还</span><span class="v good">' + (back ? GAME.costString(back) : '—') + '</span></div>';
    html += '<div class="note">返还按<b style="color:var(--gold-light)">累计投入的 50%</b> 计算，损失不可追回。</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="demolish-do" data-kind="' + kind + '" data-idx="' + idx + '">确定拆毁</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';""",
    """    /* v76（老板）：「拆除（1级，只能逐级拆除）」——
       城内是**降 1 级**（Lv1 才整座移除）；城外仍为整座拆毁（未动）。 */
    var isCity = (kind !== 'ext');
    var html = '<div class="gold-heading">' + (isCity
      ? ('拆 1 级 · ' + U.escape(name) + ' Lv' + lv + (lv > 1 ? ' → Lv' + (lv - 1) : '（整座移除）'))
      : ('拆毁 ' + U.escape(name) + ' Lv' + lv)) + '</div>';
    html += '<div class="attr"><span class="k">返还</span><span class="v good">' + (back ? GAME.costString(back) : '—') + '</span></div>';
    html += '<div class="note">' + (isCity
      ? '逐级拆除：每次只降 1 级，返还本步投入的 50%；拆到 Lv1 再拆即整座移除（腾出地块）。'
      : '返还按<b style="color:var(--gold-light)">累计投入的 50%</b> 计算，损失不可追回。') + '</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="demolish-do" data-kind="' + kind + '" data-idx="' + idx + '">' + (isCity && lv > 1 ? '确定拆 1 级' : '确定拆毁') + '</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';""",
    'B5 openDemolishConfirm',
)

print('\n主补丁落盘完成。')
