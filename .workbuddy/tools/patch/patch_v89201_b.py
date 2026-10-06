# -*- coding: utf-8 -*-
"""v89.201 批次B：铁匠铺多选打造（_forgeSelList + 全选/清空 + doForge 多件）+ reopenKeepScroll 通用出口"""
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

D = 'E:/Deepseekdb/'
U = D + 'js/ui.js'
M = D + 'js/main.js'
S = D + 'smoke-test.js'
E = D + 'e2e-test.js'

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    wr(path, s.replace(old, new)); print('[ok] ' + tag)

# ══════════ B1 · ui.js：ui.reopenKeepScroll 通用出口 ══════════
rep(U, 'B1 reopenKeepScroll',
    "  ui.modalVisible = function () { return !!$('#modal-root').innerHTML; };",
    """  ui.modalVisible = function () { return !!$('#modal-root').innerHTML; };
  /* v89.201（老板 3）：**重开弹窗保留滚动位置** ——
     病根：操作后 `ui.openXxx()` 重开面板 → `.inner-panel` 被重建 → scrollTop 归零
     （百炼强化"点一次、滚动条就自动回到顶部，又得手动滚动下来"）。
     做法：复用 live 机制的快照/回填两个出口（_liveSnap 收滚动位、_liveRestore 写回）——
     一处定义、任何"操作后重开"的面板都能用。 */
  ui.reopenKeepScroll = function (fn) {
    var snap = null;
    try { snap = ui._liveSnap(); } catch (e) { }
    fn();
    if (snap) { try { ui._liveRestore(snap); } catch (e2) { } }
  };""",
    '重开弹窗保留滚动位置')

# ══════════ B2 · ui.js：_forgeSelList 初始化 ══════════
rep(U, 'B2 _forgeSelList 初始化',
    "  ui._forgeQ = 1;",
    """  ui._forgeQ = 1;
  /* v89.201（老板 2）：「打造套装可以多选套件，一次性打造」——
     选中从**单值**（_forgeSel）升级为**保序数组** _forgeSelList；旧单值整条退役。 */
  ui._forgeSelList = [];""",
    '_forgeSelList = [];')

# ══════════ B3 · ui.js：forgePick 多选 + forgeClear/forgeAllSet 出口 ══════════
rep(U, 'B3 forgePick 多选',
    """  /* v89.117：点选一件（再按底部「打造」）—— 只重绘面板，不弹新窗（同级刷新） */
  ui.forgePick = function (itemId) {
    if (!itemId) return;
    ui._forgeSel = (ui._forgeSel === itemId) ? '' : String(itemId);
    ui.openForge();
  };""",
    """  /* v89.117：点选一件（再按底部「打造」）—— 只重绘面板，不弹新窗（同级刷新）
     v89.201（老板 2）：**多选** —— 点一件加入选集、再点一次取消（toggle），
     底部一键**一次打造全部选中件**（套装整套一起打的场景）。 */
  ui.forgePick = function (itemId) {
    if (!itemId) return;
    ui._forgeSelList = ui._forgeSelList || [];
    var i = ui._forgeSelList.indexOf(String(itemId));
    if (i >= 0) ui._forgeSelList.splice(i, 1);
    else ui._forgeSelList.push(String(itemId));
    ui.openForge();
  };
  /* v89.201：清空选集 / 全选当前列表（toggle：已全选时再点=取消全选） */
  ui.forgeClear = function () { ui._forgeSelList = []; ui.openForge(); };
  ui.forgeAllSet = function () {
    var pool = ui._forgePool || [];
    var ids = pool.map(function (f) { return String(f.id); });
    var allIn = ids.length > 0 && ids.every(function (id) {
      return (ui._forgeSelList || []).indexOf(id) >= 0;
    });
    ui._forgeSelList = allIn ? [] : ids;
    ui.openForge();
  };""",
    'ui.forgeClear = function')

# ══════════ B4 · ui.js：forgeRow 选中态（多选） ══════════
rep(U, 'B4 forgeRow 选中态',
    """      actHtml: '<span class="ir-pick">' + (ui._forgeSel === f.id ? '✔ 已选' : '点选') + '</span>',
      pickAction: 'forge-pick', pickItem: f.id, sel: (ui._forgeSel === f.id),""",
    """      actHtml: '<span class="ir-pick">' + ((ui._forgeSelList || []).indexOf(String(f.id)) >= 0 ? '✔ 已选' : '点选') + '</span>',
      pickAction: 'forge-pick', pickItem: f.id,
      sel: ((ui._forgeSelList || []).indexOf(String(f.id)) >= 0),""",
    "indexOf(String(f.id)) >= 0 ? '✔ 已选'")

# ══════════ B5 · ui.js：openForge selF 单件段 → selIds/blockList 段 ══════════
rep(U, 'B5 openForge 选中段',
    """    /* 选中件：只认**在册**的那一件（换筛选/换品质后，选中的东西可能不在当前页） */
    var selF = null;
    list.forEach(function (f) { if (f.id === ui._forgeSel) selF = f; });
    if (!selF) { ui._forgeSel = ''; }
    var selOk = false, selWhy = '';
    if (selF) {
      var b2 = [];
      if (!selF.tierOk) b2.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[selF.q - 1] || 7));
      if (!selF.bpOk) b2.push('缺图纸');
      if (!selF.matsOk) b2.push('材料不足');
      if (!GAME.canAfford(selF.cost)) b2.push('资材不足');
      selOk = !b2.length; selWhy = b2.join('　');
    }""",
    """    /* 选中集：只认**在册**的件（v89.201：单选 → 多选保序数组 _forgeSelList；
       跨页/跨品质保留 —— 换筛选后仍在册的不清空） */
    var listById = {};
    list.forEach(function (f) { listById[f.id] = f; });
    var selIds = (ui._forgeSelList || []).filter(function (id) { return !!listById[id]; });
    ui._forgeSelList = selIds;
    /* 逐件预检：**至少一件可造**才能按（部分可造时点按 = 能造的造掉、不能的留在选集） */
    var blockList = [];
    selIds.forEach(function (id) {
      var f2 = listById[id], b2 = [];
      if (!f2.tierOk) b2.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[f2.q - 1] || 7));
      if (!f2.bpOk) b2.push('缺图纸');
      if (!f2.matsOk) b2.push('材料不足');
      if (!GAME.canAfford(f2.cost)) b2.push('资材不足');
      if (b2.length) blockList.push(f2.item.name + '（' + b2.join('、') + '）');
    });
    var selOk = selIds.length > 0 && blockList.length < selIds.length;
    var selWhy = blockList.join('；');""",
    'selIds.length > 0 && blockList.length < selIds.length')

# ══════════ B6 · ui.js：openForge 记录池子（全选用）+ rows 后 ══════════
rep(U, 'B6 _forgePool 记录',
    "    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });",
    """    ui._forgePool = pool;    /* v89.201：当前筛选池（「全选」的作用域 = 玩家眼下看到的这批） */
    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });""",
    'ui._forgePool = pool;')

# ══════════ B7 · ui.js：foot 打造键多选化 + 清空/全选 ══════════
rep(U, 'B7 foot 多选键',
    """      foot: '<div class="m-foot">' + (rows.length ? pg.pager : '') +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled data-why="' + U.escape(selF ? (selWhy || '当前不可打造') : '先在下方点选一件要打造的装备') + '"') + '>⚒ 打造' +
          (selF ? '：' + U.escape(selF.item.name) : '（先在下方点选一件）') + '</button>' +
        (selF && selWhy ? '<span class="op-hint">' + U.escape(selWhy) + '</span>' : '') +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
    """      foot: '<div class="m-foot">' + (rows.length ? pg.pager : '') +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled data-why="' + U.escape(selIds.length
            ? ('选集内均不可打造：' + selWhy) : '先在下方点选一件要打造的装备（可多选）') + '"') + '>⚒ 打造' +
          (selIds.length === 1 ? '：' + U.escape(listById[selIds[0]].item.name)
            : (selIds.length ? ' ' + selIds.length + ' 件' : '（先在下方点选）')) + '</button>' +
        (selIds.length ? '<button class="btn" data-action="forge-clear">✕ 清空选择</button>' : '') +
        (selIds.length && selWhy ? '<span class="op-hint">' + U.escape(selWhy.slice(0, 48)) + '</span>' : '') +
        (pool.length ? '<button class="btn" data-action="forge-allset" title="全选当前列表（含本页之外），再点一次取消">⚑ 全选</button>' : '') +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
    'data-action="forge-allset"')

# ══════════ B8 · main.js：doForge 多件 + case 增加 ══════════
rep(M, 'B8 doForge 多件',
    """  GAME.doForge = function (itemId) {
    /* v89.117：底部唯一打造键不带 data-item —— 缺省取**选中件**（ui._forgeSel） */
    if (!itemId && ui._forgeSel) itemId = ui._forgeSel;
    var r = GAME.forge(itemId);
    ui.toast(r.msg);
    if (r.ok) { ui.openForge(); GAME.refreshAll(); }
  };""",
    """  GAME.doForge = function (itemId) {
    /* v89.201（老板 2）：「打造套装可以多选套件，一次性打造」——
       无参（底部唯一键）= 取**选中集**（ui._forgeSelList，保序）逐件结算；
       带参（data-item）时只造那一件（旧链兼容）。
       逐个结算语义：能造的扣料造出、缺料的跳过并汇报（不做"全或无"的半途而废）。 */
    var ids = itemId ? [String(itemId)] : (ui._forgeSelList || []).slice();
    if (!ids.length) { ui.toast('先在下方点选要打造的装备（可多选）'); return; }
    var made = [], failed = [], lastOkMsg = '';
    ids.forEach(function (id) {
      var r0 = GAME.forge(id);
      if (r0.ok) { made.push(id); lastOkMsg = r0.msg; } else failed.push(r0.msg);
    });
    if (ids.length === 1) ui.toast(made.length ? lastOkMsg : failed[0]);
    else if (made.length && !failed.length) ui.toast('⚒ 打造完成 ' + made.length + ' 件');
    else if (made.length) ui.toast('⚒ 已造 ' + made.length + ' 件 · ' + failed.length + ' 件未成（' + failed[0] + '）');
    else ui.toast(failed[0]);
    /* 成功的移出选集（失败的留在选集里 —— 补料后可直接再按） */
    ui._forgeSelList = (ui._forgeSelList || []).filter(function (id) { return made.indexOf(id) < 0; });
    if (made.length) GAME.refreshAll();
    ui.reopenKeepScroll(ui.openForge);   /* v89.201：重开保留滚动位（不再"点一次跳回顶部"） */
  };""",
    'ui.reopenKeepScroll(ui.openForge)')

rep(M, 'B9 case 增加',
    "      case 'forge-pick': ui.forgePick(el.dataset.item); break;",
    """      case 'forge-pick': ui.forgePick(el.dataset.item); break;
      /* v89.201（老板 2）：多选打造 —— 清空选集 / 全选当前列表（toggle） */
      case 'forge-clear': ui.forgeClear(); break;
      case 'forge-allset': ui.forgeAllSet(); break;""",
    "case 'forge-clear': ui.forgeClear(); break;")

# ══════════ B10 · smoke：v89.117 实测段升级为多选语义 ══════════
rep(S, 'B10 smoke 点选实测升级',
    """    check('④ 实测：选中/取消点选是**同级重绘**（不进弹层栈）', (function () {
      var keep = ui97_saveStack();
      try {
        G.ui.closeAllModals();
        G.ui._forgeSel = '';
        G.ui.forgePick('cr_head_1');
        var a = G.ui._forgeSel;
        G.ui.forgePick('cr_head_1');
        var b = G.ui._forgeSel;
        return a === 'cr_head_1' && b === '' && ((G.ui._modalStack || []).length === 0);
      } finally { ui97_restoreStack(keep); }
    })());""",
    """    check('④ 实测：点选/取消是**同级重绘**（不进弹层栈）· v89.201 起为**多选集**', (function () {
      var keep = ui97_saveStack();
      try {
        G.ui.closeAllModals();
        G.ui._forgeSelList = [];
        G.ui.forgePick('cr_head_1');
        var a = (G.ui._forgeSelList || []).join(',');
        G.ui.forgePick('cr_weapon_1');            /* 第二件：多选共存 */
        var ab = (G.ui._forgeSelList || []).join(',');
        G.ui.forgePick('cr_head_1');              /* 再点第一件：toggle 取消 */
        var b = (G.ui._forgeSelList || []).join(',');
        return a === 'cr_head_1' && ab === 'cr_head_1,cr_weapon_1' && b === 'cr_weapon_1'
          && ((G.ui._modalStack || []).length === 0);
      } finally { ui97_restoreStack(keep); }
    })());""",
    'v89.201 起为**多选集**')

# ══════════ B11 · e2e：_forgeSel 引用改数组 ══════════
rep(E, 'B11 e2e _forgeSel 引用',
    "G.ui._forgeKind = 'all'; G.ui._forgeSet = ''; G.ui._forgeQ = 1; G.ui._forgeSel = '';",
    "G.ui._forgeKind = 'all'; G.ui._forgeSet = ''; G.ui._forgeQ = 1; G.ui._forgeSelList = [];",
    'G.ui._forgeSelList = [];\n  let pickRow')

print('批次B 完成')
