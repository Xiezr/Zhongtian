# -*- coding: utf-8 -*-
"""v89.155 补丁 B：ui.js —— 
B1 docPerOf（公文按高度铺满）B2 三处消费+分页登记 B3 召回按钮出口+就地重绘
B4 openWilds 换出口 B5 openLandModal 换出口 B6 内置排序标号+三处应用
B7 资源悬停加堆场 B8 城外面板容量行/空地 tip 修复
分段落盘 + **显式幂等守卫**（避免 old 是 new 前缀时的重复插入）+ strip 三层自检。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
def strip_js(t):
    t = t.replace('\\(', '').replace('\\)', '').replace('\\{', '').replace('\\}', '')
    t = re.sub(r'/\*[\s\S]*?\*/', '', t)
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", t)
    t = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', t)
    return t

P = 'js/ui.js'
s = rd(P)
done = []
def seg(tag, old, new, guard):
    global s
    if guard in s:
        done.append(tag + ' skip'); return
    assert s.count(old) == 1, tag + ' anchor count=' + str(s.count(old))
    s = s.replace(old, new)
    done.append(tag + ' OK')

# ================= B1：docPerOf 新出口 =================
A1 = u"  ui.DOC_PER = 10;"
N1 = u"""  ui.DOC_PER = 10;
  /* ============================================================
   * v89.155（老板 1）：公文**每页条数按可用高度算**（铺满到底，不再固定 15/10）
   * ------------------------------------------------------------
   * 老板原话：「公文的显示没界面底部到底，没铺满界面就分页了」。
   * 实测（1600×1000 实机 · 布局值，v89.155 量）：
   *   #view-container 高 787px；标题+页签+chips 合计头高 ≈127px；
   *   系统页消息行高 24.65px（任务摘要区另占 ≈104px）；
   *   战报/侦查行（.doc-bar）高 33.33px；底注（"共 N 条"）保留 28px。
   * → 系统页默认（含摘要）= (787−127−104−28)/24.65 = 21 条；
   *   切到单主题标签（无摘要）= 25 条；战报页 = (787−127−28)/33.33 = 18 份。
   * 口径：per = floor((视图高 − 头 − 底注 − 摘要) / 行高)，下限 8 / 上限 60；
   *   拿不到布局（桩 / jsdom）→ 回落 MSG_PER / DOC_PER（旧值保留为兜底）。
   *   ⚠️ 头/摘要/底注是**实测量值** —— 改公文版式后重跑量测并更新（改动点集中在本段）。
   * ============================================================ */
  ui.DOC_HEAD_H = 127;      /* 标题 + 页签 + chips 合计（实测 126.7） */
  ui.DOC_TASK_H = 104;      /* 任务摘要区（实测 103.1，仅「全部/任务」标签出现） */
  ui.DOC_FOOT_H = 28;       /* 底注"共 N 条"保留高度 */
  ui.DOC_LINE_H = { sys: 24.65, war: 33.33, scout: 33.33 };   /* 行高（实测） */
  ui.docPerOf = function (kind) {
    var fb = (kind === 'sys') ? ui.MSG_PER : ui.DOC_PER;
    var vcH = 0;
    try {
      var vc = document.getElementById('view-container');
      if (vc && vc.clientHeight) vcH = vc.clientHeight;
    } catch (e) { vcH = 0; }
    if (!vcH) vcH = 787;      /* 标准画布（1440×900）的实测值兜底 */
    var avail = vcH - ui.DOC_HEAD_H - ui.DOC_FOOT_H;
    if (kind === 'sys' && (ui._msgTag === 'all' || ui._msgTag === 'task')) avail -= ui.DOC_TASK_H;
    if (avail < 120) return fb;                       /* 布局异常（窗口畸形）→ 兜底 */
    return Math.max(8, Math.min(60, Math.floor(avail / (ui.DOC_LINE_H[kind] || 26))));
  };"""
seg('B1', A1, N1, u'ui.docPerOf = function')

# ================= B2：三处 per + 分页登记 =================
seg('B2a', u"    var pg = ui.pageOf('docwar', hit.length, ui.DOC_PER);",
    u"    var pg = ui.pageOf('docwar', hit.length, ui.docPerOf('war'));",
    u"pageOf('docwar', hit.length, ui.docPerOf('war'))")
seg('B2b', u"      var pg2 = ui.pageOf('docscout', sc.length, ui.DOC_PER);",
    u"      var pg2 = ui.pageOf('docscout', sc.length, ui.docPerOf('scout'));",
    u"pageOf('docscout', sc.length, ui.docPerOf('scout'))")
seg('B2c', u"      var pg = ui.pageOf('docsys', hit.length, ui.MSG_PER);",
    u"      var pg = ui.pageOf('docsys', hit.length, ui.docPerOf('sys'));",
    u"pageOf('docsys', hit.length, ui.docPerOf('sys'))")
seg('B2d',
    u"    if (id === 'war' || id === 'scout') { total = ui.docCountOf(id); per = ui.DOC_PER; }\n    else { total = ui.docCountOf(id); per = ui.MSG_PER; }   /* v89.153：task 页退役，系统页照常分页 */",
    u"    /* v89.155（老板 1）：每页条数与正文同源（docPerOf）—— 翻页条与列表不许两把尺 */\n    if (id === 'war' || id === 'scout') { total = ui.docCountOf(id); per = ui.docPerOf(id); }\n    else { total = ui.docCountOf(id); per = ui.docPerOf('sys'); }   /* v89.153：task 页退役，系统页照常分页 */",
    u"per = ui.docPerOf(id); }")

# ================= B3：召回按钮出口 + 就地重绘（插在 openWilds 之前） =================
A3 = u"  /* 附属野地弹窗（原版「附属野地」） */\n  ui.openWilds = function () {"
N3 = u"""  /* ============================================================
   * v89.155（老板 2）：野地「召回驻军」按钮的**唯一渲染出口**（三态）
   * ------------------------------------------------------------
   * 老板原话：「召回军队时，第一次点击变黄色，第二次点击执行召回并变回无驻军的绿色，
   *   2 秒内无点击则返回红色（己方野地界面的召回驻军同步调整，就不要显示一大段说明
   *   或者文字弹窗了）。召回后不要弹窗己方小野地界面，直接执行召回即可」。
   * 三态：无驻军 = 绿（disabled）；有驻军 = 红；已上膛（_wdArm138 命中本坐标）= 黄。
   * 两处消费（附属野地操作列 / 地块面板「地块操作」）**同读本出口** ——
   * live 逐秒重绘时按钮按状态重建（上膛的黄色不会被每秒重绘冲掉）。
   * `data-lbl` 存原始文案（wdRepaint 重绘时回传，列表"🏳️ 召回"与地块"🏳️ 召回驻军"各保持）。
   * ============================================================ */
  ui.wildWdBtnHTML = function (x, y, opts) {
    opts = opts || {};
    var hasGar = (opts.hasGar != null) ? opts.hasGar
      : GAME.wildGarrisonTotal(GAME.wildGarrisonAt(x, y)) > 0;
    var armed = hasGar && ui._wdArm138 === (x + ',' + y);
    var sz = opts.xs ? ' xs' : '';
    var lbl = opts.label || '🏳️ 召回';
    if (!hasGar) {
      return '<button class="btn' + sz + ' green" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y +
        '" data-lbl="' + U.escape(lbl) + '" disabled title="该野地没有驻军">' + lbl + '</button>';
    }
    return '<button class="btn' + sz + (armed ? ' gold' : ' red') + '" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y +
      '" data-lbl="' + U.escape(lbl) + '" title="' + (armed ? '再点一次执行（2 秒内有效）' : '撤回驻军（将领随军回城）—— 连点两次执行') + '">' +
      (armed ? '⚠️ 再点一次' : lbl) + '</button>';
  };
  /* 上膛/回落的**就地重绘**（唯一出口）—— 点击与 2 秒超时都调它；
     按坐标找当前屏幕上的召回按钮（列表 / 地块面板同屏至多一处），用同一渲染出口重建。
     桩环境（无 querySelectorAll）自动跳过 —— 不影响测试口径。 */
  ui.wdRepaint = function (x, y) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var root = null;
    try { root = document.getElementById('modal-root') || document.body; } catch (e) { return; }
    if (!root || !root.querySelectorAll) return;
    var btns = root.querySelectorAll('[data-action="wild-withdraw"]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!b.dataset || Number(b.dataset.x) !== Number(x) || Number(b.dataset.y) !== Number(y)) continue;
      b.outerHTML = ui.wildWdBtnHTML(x, y, {
        xs: !!(b.classList && b.classList.contains('xs')),
        label: b.dataset.lbl || '🏳️ 召回'
      });
    }
  };

  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {"""
seg('B3', A3, N3, u'ui.wildWdBtnHTML = function')

# ================= B4：openWilds 操作列换出口 =================
A4 = u"""        (_hasGar137
          ? '<button class="btn xs red" data-action="wild-withdraw" data-x="' + w.x + '" data-y="' + w.y +
            '" title="撤回驻军（将领随军回城）">🏳️ 召回</button>'
          : '<button class="btn xs" data-action="wild-withdraw" disabled title="该野地没有驻军">🏳️ 召回</button>') +"""
N4 = u"""        /* v89.155（老板 2）：三态按钮（红→黄→绿）走唯一出口；上膛态进 live 渲染 */
        ui.wildWdBtnHTML(w.x, w.y, { xs: true, hasGar: _hasGar137 }) +"""
seg('B4', A4, N4, u"ui.wildWdBtnHTML(w.x, w.y, { xs: true")

# ================= B5：openLandModal 地块操作换出口 =================
A5 = u"""        ? '<button class="btn" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 增派驻军</button>' +
          '<button class="btn" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y + '">🏳️ 召回驻军</button>'"""
N5 = u"""        ? '<button class="btn" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 增派驻军</button>' +
          /* v89.155（老板 2）：与附属野地同一条出口（第一次黄 / 第二次执行 / 2 秒回落）；不再有任何说明文字 */
          ui.wildWdBtnHTML(x, y, { hasGar: true, label: '🏳️ 召回驻军' })"""
seg('B5', A5, N5, u"ui.wildWdBtnHTML(x, y, { hasGar: true, label: '🏳️ 召回驻军' })")

# ================= B6：内置排序标号 =================
A6 = u"  ui.shopItems = function () {"
N6 = u"""  /* ============================================================
   * v89.155（老板 4）：商品/背包的**内置排序标号**（不显示）
   * ------------------------------------------------------------
   * 老板原话：「改变商品排序规则，同功能商品按其功能由小到大相邻排序。
   *   建议内置一套通用性强的内置排序标号（不直接显示在商品或背包界面）」。
   * 口径：标号 = 功能族 × 1000 + 族内强度档（0~999）——
   *   · 功能族 = 效果维度（eff 的键；产量宝物的维度在 `res` 字段）；
   *     同族商品必然相邻（例：攻击四鼓 atk 0.10/0.15/0.25/0.35 连排升序）；
   *   · 族内档位 = 效果值 ×1000；无效果的商品（珠宝/图纸/加速…）用 price 当档位；
   *   · 想手动指定顺序：在物品上写 `ord`（数字）→ 直接生效（覆盖派生）。
   * 消费点三处（同读本出口）：商城营业顺序 / 背包宝物页组内顺序 / 快购列表。
   * ============================================================ */
  ui.ITEM_FAM = {
    /* 军事 buff：按效果维度分族 */
    atk: 101, def: 102, wound: 103, cap: 104,
    /* 属性符：按四维/速度分族 */
    tong_mult: 201, yw_mult: 202, zm_mult: 203, nz_mult: 204, spd: 205,
    /* 产量宝物：按资源维度分族（itemFamOf 用 'res_' 前缀查表） */
    res_grain: 301, res_wood: 302, res_stone: 303, res_iron: 304, res_gold: 305,
    /* 建造减耗：单族 */
    build: 401
  };
  ui.ITEM_TYPE_FAM = {
    jewel: 501, talis: 502, boost: 503, exp: 504, stamina: 505, energy: 506, chest: 507,
    neigong: 508, perm: 509, rank_up: 510, seed: 511, mount_buff: 512, corvee: 513,
    essence: 514, pop_boost: 515, pop_fill: 516, material: 517, blueprint: 518
  };
  ui.itemFamOf = function (it) {
    if (!it) return 999;
    if (it.eff && typeof it.eff === 'object') {
      var ks = Object.keys(it.eff);
      for (var i = 0; i < ks.length; i++) if (ui.ITEM_FAM[ks[i]] != null) return ui.ITEM_FAM[ks[i]];
    }
    if (it.res && ui.ITEM_FAM['res_' + it.res] != null) return ui.ITEM_FAM['res_' + it.res];
    if (it.type === 'build_cost') return ui.ITEM_FAM.build;
    if (ui.ITEM_TYPE_FAM[it.type] != null) return ui.ITEM_TYPE_FAM[it.type];
    return 900;                                   /* 未知新类型：统一殿后（族内按 price） */
  };
  ui.itemPowOf = function (it) {
    var v = null;
    if (it && it.eff && typeof it.eff === 'object') {
      var ks = Object.keys(it.eff);
      if (ks.length) v = Math.abs(Number(it.eff[ks[0]]) || 0);
    } else if (it && typeof it.eff === 'number') v = Math.abs(it.eff);
    if (v == null) v = ((it && it.price) || 0) / 1000;      /* 无效果 → 价格当档位 */
    return Math.max(0, Math.min(999, Math.round(v * 1000)));
  };
  ui.itemOrdOf = function (it) {
    if (it && typeof it.ord === 'number') return it.ord;    /* 手写标号优先 */
    return ui.itemFamOf(it) * 1000 + ui.itemPowOf(it);
  };

  ui.shopItems = function () {"""
seg('B6a', A6, N6, u'ui.itemOrdOf = function')

# B6b 商城营业顺序
seg('B6b',
    u"    var items = all.filter(function (it) { return cur.types.indexOf(it.type) >= 0; });",
    u"    /* v89.155（老板 4）：同功能相邻、由小到大（内置标号，不显示） */\n    var items = all.filter(function (it) { return cur.types.indexOf(it.type) >= 0; })\n      .sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });",
    u"cur.types.indexOf(it.type) >= 0; })\n      .sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });")

# B6c 背包宝物组内顺序
seg('B6c',
    u"      if (sort === 'val') arr = arr.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });",
    u"      if (sort === 'val') arr = arr.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });\n\n      /* v89.155（老板 4）：默认（按类型）排序 = 内置标号（同功能相邻 · 由小到大） */\n      else arr = arr.slice().sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });",
    u"      else arr = arr.slice().sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });")

# B6d 快购列表
A6D = u"""  ui.qbScopeItemsOf = function (cat, scope) {
    return (DATA.ITEMS || []).filter(function (x) {
      if (!(x.price > 0) || x.type !== cat) return false;
      if (x.noShop) return false;    /* v89.121：快购列表与商城同口径（下架=绝版，不列） */
      if (scope && x.target !== scope) return false;
      return true;
    });
  };"""
N6D = u"""  ui.qbScopeItemsOf = function (cat, scope) {
    return (DATA.ITEMS || []).filter(function (x) {
      if (!(x.price > 0) || x.type !== cat) return false;
      if (x.noShop) return false;    /* v89.121：快购列表与商城同口径（下架=绝版，不列） */
      if (scope && x.target !== scope) return false;
      return true;
    }).sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });   /* v89.155：与商城同一标号 */
  };"""
seg('B6d', A6D, N6D, u"/* v89.155：与商城同一标号 */")

# ================= B7：资源悬停显式化堆场 =================
A7 = u"""      var amtTip = ((k === 'gold')
        ? '黄金：货币，不受仓储上限约束'
        : (meta ? meta.name : k) + '　上限 ' + U.amtText(cap)
          + '（已占 ' + (cap > 0 ? Math.round(val / cap * 100) : 0) + '%）')
        + '\\n现有 ' + U.numText(val, 0);"""
N7 = u"""      /* v89.155（老板 5）：把「城外资源建筑堆场」的贡献显式写进悬停 ——
         老板原话：「感觉资源建筑没加容量上限呢？还是悬停显示不对？」
         （机制一直在（storeCapOf 含 extStoreCapOf），但界面**零处**显示它 → 看起来像没加）。 */
      var extCap = (k === 'gold' || !GAME.extStoreCapOf) ? 0 : GAME.extStoreCapOf(GAME.currentCity());
      var amtTip = ((k === 'gold')
        ? '黄金：货币，不受仓储上限约束'
        : (meta ? meta.name : k) + '　上限 ' + U.amtText(cap)
          + '（已占 ' + (cap > 0 ? Math.round(val / cap * 100) : 0) + '%）'
          + (extCap > 0 ? '\\n其中城外堆场 +' + U.amtText(extCap) + '（资源建筑按等级所出 · 不吃仓储加成）' : ''))
        + '\\n现有 ' + U.numText(val, 0);"""
seg('B7', A7, N7, u'其中城外堆场 +')

# ================= B8：城外面板（已建容量行 + 空地 tip 修 undefined） =================
seg('B8a',
    u"        '<div class=\"attr\"><span class=\"k\">产量</span><span class=\"v good\">' + U.perHourText(prodH) + '/时</span></div>' +",
    u"        '<div class=\"attr\"><span class=\"k\">产量</span><span class=\"v good\">' + U.perHourText(prodH) + '/时</span></div>' +\n        /* v89.155（老板 5）：本块为全城堆场容量的贡献（唯一出口 extStoreCapOneOf，与总量同尺） */\n        '<div class=\"attr\"><span class=\"k\">另加仓储上限</span><span class=\"v good\">+' + U.fmt(GAME.extStoreCapOneOf(e)) + '</span></div>' +",
    u'另加仓储上限')
seg('B8b',
    u"      var tip = eb2.desc + '｜耗' + U.fmt(cost0[0]) + '粮 · 产' + eb2.prod[0] + '/时' +\n        (afford ? '｜材料不足' : '');",
    u"""      var tip = eb2.desc + '｜耗' + U.fmt(cost0[0]) + '粮 · 产' + eb2.prod[0] + '/时' +
        /* v89.155（老板 5）：desc 已补（原先读 undefined → 悬停显示"undefined｜耗…"）；另加堆场信息 */
        '｜每级另加仓储上限 +' + U.fmt(Math.round((DATA.BASE_STORE || 0) / (DATA.EXT_STORE_DIV || 1))) +
        (afford ? '｜材料不足' : '');""",
    u"'｜每级另加仓储上限 +'")

wr(P, s)
s2 = rd(P)
_bk = strip_js(io.open(R + 'backup/v89155/ui.js.before', encoding='utf-8', newline='').read())
_sa = strip_js(s2)
assert (_sa.count(u'{') - _sa.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), 'brace'
assert (_sa.count(u'(') - _sa.count(u')')) == (_bk.count(u'(') - _bk.count(u')')), 'paren'
print('docPerOf count =', s2.count(u'ui.docPerOf('))
assert s2.count(u'ui.docPerOf = function') == 1 and s2.count(u'ui.docPerOf(') == 5
assert s2.count(u'ui.wildWdBtnHTML = function') == 1 and s2.count(u'ui.wildWdBtnHTML(') == 3
assert s2.count(u'ui.itemOrdOf = function') == 1 and s2.count(u'ui.itemOrdOf(') == 6
assert s2.count(u'GAME.extStoreCapOneOf(e)') == 1
print('ui.js done:', done)
