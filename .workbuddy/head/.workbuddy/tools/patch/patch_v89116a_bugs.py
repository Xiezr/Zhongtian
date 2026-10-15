# -*- coding: utf-8 -*-
"""v89.116 补丁 A：三个小 bug —— ①守将函数名笔误 ②显示比例无监听 ③快购按用途过滤

纪律：先备（已在 backup/v89116）→ 逐处替换（每处 count 必须 == 1）→ 原子落盘 → 写后自检。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ============================================================
# ① 守将函数名笔误：GAME.guardOf 不存在（真名 guardGeneralOf）→ 永远拿到 null
#    受害：守城结算（战报永远"（无守将）"、守将加成不进战斗）+ 防守体检列
# ============================================================
edit('js/state.js',
     "    var guard = GAME.guardOf ? GAME.guardOf(city) : null;",
     "    /* v89.116（老板「守城的战斗报告仍然是假的」· 病根之一）：\n"
     "       这里原来写 `GAME.guardOf(city)` —— **该函数不存在**（真名 `guardGeneralOf`），\n"
     "       三元判断永远落 null：守将不进战斗、战报永远写「（无守将）」。\n"
     "       守将加成（tactic 的 cover=1 全覆盖）因此从未在守城战里生效过。 */\n"
     "    var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;",
     'state.js 守将')

edit('js/ui.js',
     "      var guard = GAME.guardOf ? GAME.guardOf(ct) : null;",
     "      var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(ct) : null;   /* v89.116：函数名笔误修正 */",
     'ui.js 防守体检守将')

# ============================================================
# ② 显示比例：滑块根本没有监听（拖动无反应）
#    · main.js：补 input（实时预览）+ change（落库重绘）
#    · ui.js：GAME.doSetZoom 旁补 GAME.previewZoom（只改 DOM，不重绘，防拖动中断）
# ============================================================
edit('js/ui.js',
     """  ui.zoomStyle = function () { return 'zoom:' + (ui.zoom() / 100) + ';'; };""",
     """  ui.zoomStyle = function () { return 'zoom:' + (ui.zoom() / 100) + ';'; };
  /* ============================================================
   * v89.116（老板「设置里的显示比例实质改不了比例」）—— **病根**：
   *   `ui.zoomBarHTML` 画出了 `#zoom-range` 滑块，但**全仓没有任何 input/change 监听**
   *   （v89.104 把档次 chips 换成 range 时，只删了旧的 `after==='zoom'` 分支，
   *   忘了给新滑块接线）→ 拖动无任何反应，设置里的百分比只是个摆设。
   * 现在两条路：
   *   · `previewZoom(v)` —— input 事件里**只改 DOM**（不重绘），拖动不中断；
   *   · `GAME.doSetZoom(v)` —— change 事件里落库 + 重绘（走既有唯一出口）。
   * ============================================================ */
  ui.previewZoom = function (v) {
    var z = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, Math.round(Number(v) || 100)));
    document.querySelectorAll('.city-iso').forEach(function (el) { el.style.zoom = (z / 100); });
    var t = document.getElementById('zoom-txt');
    if (t) t.textContent = z + '%';
    return z;
  };""",
     'ui.js 缩放预览')

edit('js/main.js',
     """    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'train-count') GAME.syncTrainQty(e.target.value);
    });""",
     """    /* v89.116（老板「显示比例实质改不了比例」）：滑块此前**没有监听** ——
       input 只做实时预览（不重绘，拖动不断），change 才落库 + 重绘。 */
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'zoom-range' && ui.previewZoom) ui.previewZoom(e.target.value);
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'zoom-range') GAME.doSetZoom(Number(e.target.value));
    });
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'train-count') GAME.syncTrainQty(e.target.value);
    });""",
     'main.js 缩放监听')

# ============================================================
# ③ 快购按用途过滤：openQuickCat(cat, scope) —— 训练加速面板只列 target==='train'
# ============================================================
edit('js/ui.js',
     """  ui.openQuickCat = function (cat) {
    var list = (DATA.ITEMS || []).filter(function (x) { return x.price > 0 && x.type === cat; });
    if (!list.length) { ui.toast('该类别暂无可购之物'); return; }
    var rows = list.map(function (it) {""",
     """  /* v89.116（老板「快购没有针对性，我加速兵种招募的怎么还买到缩短建造、行军什么的」）
     —— **病根**：`boost` 类里混装了研究 / 建造 / 训练 / 行军 / 市场五种用途的宝物，
     快购却整类端上来（点"购买加速宝物"给的是**全部加速宝物**）。
     口径：调用点必须声明**用途**（= `DATA.ITEMS[].target`，与"背包里可用于加速募兵的宝物"
     `S.trainBoostItems` 同一字段），快购只列该用途的；
     另给一个「看全部加速宝物」的显式入口 —— 想通买的人有路，但不能默认塞给玩家。 */
  ui.QB_SCOPE_CN = { research: '研究', build: '建造', train: '募兵训练', march: '行军', trade: '市场交易' };
  ui.qbScopeItemsOf = function (cat, scope) {
    return (DATA.ITEMS || []).filter(function (x) {
      if (!(x.price > 0) || x.type !== cat) return false;
      if (scope && x.target !== scope) return false;
      return true;
    });
  };
  ui.openQuickCat = function (cat, scope) {
    var list = ui.qbScopeItemsOf(cat, scope);
    if (!list.length) {
      ui.toast(scope ? ('该用途暂无可购之物（' + (ui.QB_SCOPE_CN[scope] || scope) + '）') : '该类别暂无可购之物');
      return;
    }
    var rows = list.map(function (it) {""",
     'ui.js openQuickCat 签名')

edit('js/ui.js',
     """    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape((ui.SHOP_CATS && ui.SHOP_CATS[cat]) || cat) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">现有黄金 ' + U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '<div class="modal-scroll">' + rows + '</div>' +   /* v89.112：撤内联 440px 上限 */
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');""",
     """    var scopeCn = scope ? (ui.QB_SCOPE_CN[scope] || scope) : '';
    var allN = ui.qbScopeItemsOf(cat, null).length;
    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape((ui.SHOP_CATS && ui.SHOP_CATS[cat]) || cat)
        + (scopeCn ? '（' + scopeCn + '专用）' : '') + '</div>' +
      '<div class="ui-sub" style="text-align:center;">现有黄金 ' + U.numText(GAME.state.res.gold || 0, 0)
        + (scope ? '　·　此处只列<b>' + scopeCn + '</b>用途的宝物（共 ' + list.length + ' / ' + allN + ' 种）' : '') + '</div>' +
      '<div class="modal-scroll">' + rows + '</div>' +   /* v89.112：撤内联 440px 上限 */
      '<div class="m-foot">' +
        (scope ? '<button class="btn" data-action="qb-cat" data-cat="' + cat + '">看全部加速宝物</button>' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>');""",
     'ui.js 快购标题与全部入口')

# 训练加速面板的两处按钮 → 带上用途
edit('js/ui.js',
     """        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm" data-action="qb-cat" data-cat="boost">🛒 购买更多</button></div>' + '</div>'
      : '<div class="q-empty" style="margin-top:8px;">背包里没有加速宝物 —— 可就地购买（见下）</div>' +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm gold" data-action="qb-cat" data-cat="boost">🛒 购买加速宝物</button></div>';""",
     """        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm" data-action="qb-cat" data-cat="boost" data-scope="train">🛒 购买训练宝物</button></div>' + '</div>'
      : '<div class="q-empty" style="margin-top:8px;">背包里没有训练加速宝物 —— 可就地购买（见下）</div>' +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm gold" data-action="qb-cat" data-cat="boost" data-scope="train">🛒 购买训练宝物</button></div>';""",
     'ui.js 训练面板快购按钮')

edit('js/main.js',
     """      case 'qb-cat': ui.openQuickCat(el.dataset.cat); break;""",
     """      case 'qb-cat': ui.openQuickCat(el.dataset.cat, el.dataset.scope || null); break;""",
     'main.js qb-cat 派发')

edit('js/main.js',
     """        if (_rq2.ok) ui.openQuickCat(el.dataset.cat);""",
     """        if (_rq2.ok) ui.openQuickCat(el.dataset.cat, el.dataset.scope || null);""",
     'main.js qb-cat 派发（第二处）')

# ---------------- 执行 ----------------
def main():
    files = {}
    for path, old, new, tag in EDITS:
        p = R + path
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
        s = files[p]
        n = s.count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次（要求 1）→ 中止' % (tag, n))
            return 1
        files[p] = s.replace(old, new, 1)
        print('  ✓ %s' % tag)
    # 写后自检 + 原子落盘
    # ⚠️ 括号配平必须与**备份**比 delta —— 原文件里字符串/正则本就含花括号
    #    （state.js 实测 1124{ / 1126} 是正常值），拿绝对值判会误红。
    bak = R + '.workbuddy/backup/v89116/'
    for p, s in files.items():
        assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
        b = io.open(bak + os.path.basename(p), encoding='utf-8').read()
        d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d（应为 0）→ 中止' % (p, d0))
            return 1
        tmp = p + '.tmp116a'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (path_name(p), d0))
    print('补丁 A 完成')
    return 0


def path_name(p):
    return p.replace(R, '')


sys.exit(main())
