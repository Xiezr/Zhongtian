# -*- coding: utf-8 -*-
"""v89.128 补丁 J：需求 7+8 左栏统计改造
   ui.js：资源行去数量徽标 / 人口行（只显当前数 + 建筑人口悬停 + 加号按钮 + 去图标）/
          民心·税率去图标 + 税率按钮统一 plus-btn / 野地行改名与按钮缩小 / 新增 openQuickPop
   main.js：quick-pop 接线
   index.html：删 item-badge 两条 + tax-step 换 wild-go
   smoke：新增 §109（5 条）
   ⚠ newline='' 保持 LF
"""
import io

R = 'E:/Deepseekdb/'
n = 0


def do_file(fname, edits):
    global n
    P = R + fname
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = s
    for old, new, tag in edits:
        assert s.count(old) == 1, '[%s] %s 锚点 %d 个' % (fname, tag, s.count(old))
        s = s.replace(old, new)
        n += 1
        print('  ✓ [%s] %s' % (fname, tag))
    assert s != orig
    assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), '[%s] 花括号盈亏' % fname
    io.open(P, 'w', encoding='utf-8', newline='').write(s)


# ════════ ui.js ════════
do_file('js/ui.js', [
    # ① 资源行：去数量徽标（含未用的 have/itemId 变量）
    ("""      var itemId = RES_QUICK_ITEM[k];
      var have = (s.items && s.items[itemId]) || 0;
      var val = s.res[k] || 0;""",
     """      var val = s.res[k] || 0;""",
     '①a 资源行变量'),
    ("""          '<span class="plus-btn" data-action="quick-item" data-res="' + k + '" title="使用辅助宝物">+</span>' +
          (have ? '<span class="item-badge">×' + have + '</span>' : '') +
        '</span></div>';""",
     """          /* v89.128（老板）：「不要显示现有道具数量，纯粹一个加号按钮就行」 */
          '<span class="plus-btn" data-action="quick-item" data-res="' + k + '" title="使用辅助宝物">+</span>' +
        '</span></div>';""",
     '①b 去数量徽标'),
    # ② 人口行整段
    ("""      (function () {
        var popNow = Math.floor(s.res.pop || 0);
        var grow = Math.floor(GAME.popGrowthOf(c));
        if (popNow >= maxPop) grow = 0;
        var popSrc = '';
        try {
          (GAME.popSourcesOf(c) || []).forEach(function (x) {
            if (Math.abs(x.v) > 1e-9) popSrc += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
          });
        } catch (e) {}
        /* v89.126：补满预计（现实时间）—— "固定时间速率"的可读化 */
        var popEta = (popNow < maxPop && grow > 0)
          ? '\\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';
        /* v89.126（需求 2）：劳作占用（不可征兵）—— 悬停可见 */
        var popLab = GAME.popLaborOf(c);
        var popLabLine = popLab > 0
          ? '\\n劳作占用 ' + U.fmt(popLab) + '（城市产业，不可征兵）· 可征 ' + U.fmt(Math.max(0, popNow - popLab))
          : '';
        return '<div class="res-line pop-line"><span class="lbl">👥 人口</span><span class="val">' +
          /* ⚠️ "存量 + / 上限"必须是**一个** .amt 块（一个网格项）：
             裸文本会变成**独立网格项**，把 cap / rate-wrap 顶错一列
             （实测 rate 被挤进 15px 的 1.1em 列、右缘溢出到 449）。 */
          '<span class="amt">' + U.numHTML(popNow, 0) + '<span class="cap"> / ' + U.numText(maxPop, 0) + '</span></span>' +
          '<span class="rate-wrap" data-tip="人口增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)
            + ' 小时补满）：民房上限决定速率' + popSrc + popEta + popLabLine +
            (popNow >= maxPop ? '\\n已到上限 —— 不再增长（建/升民房可提上限）' : '') + '">' +
          '<span class="num-rate' + (grow > 0 ? '' : ' zero') + '">+' + U.perHourText(grow) + '/时</span>' +
          '</span></span></div>';
      })() +""",
     """      (function () {
        var popNow = Math.floor(s.res.pop || 0);
        var grow = Math.floor(GAME.popGrowthOf(c));
        if (popNow >= maxPop) grow = 0;
        var popSrc = '';
        try {
          (GAME.popSourcesOf(c) || []).forEach(function (x) {
            if (Math.abs(x.v) > 1e-9) popSrc += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
          });
        } catch (e) {}
        /* v89.126：补满预计（现实时间）—— "固定时间速率"的可读化 */
        var popEta = (popNow < maxPop && grow > 0)
          ? '\\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';
        /* v89.128（老板）：「悬停显示"建筑人口/上限人口"，建筑人口就是各建筑固定占据的
           人口数，这部分人口不可征兵」—— 劳作占用的**展示名**定为"建筑人口"。 */
        var popLab = GAME.popLaborOf(c);
        var popLabLine = '\\n建筑人口 ' + U.fmt(popLab) + ' / 上限人口 ' + U.numText(maxPop, 0)
          + '（建筑人口为各建筑固定占用，不可征兵）';
        return '<div class="res-line pop-line"><span class="lbl">人口</span><span class="val">' +
          /* v89.128（老板）：「人口只显示当前人口数，不显示上限，节约空间」——
             上限迁入悬停（与建筑人口合并给）。
             ⚠️ 存量仍是**一个** .amt 块（裸文本会变独立网格项、把后续列顶错位）。 */
          '<span class="amt">' + U.numHTML(popNow, 0) + '</span>' +
          '<span class="rate-wrap" data-tip="人口增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)
            + ' 小时补满）：民房上限决定速率' + popSrc + popEta + popLabLine +
            (popNow >= maxPop ? '\\n已到上限 —— 不再增长（建/升民房可提上限）' : '') + '">' +
          '<span class="num-rate' + (grow > 0 ? '' : ' zero') + '">+' + U.perHourText(grow) + '/时</span>' +
          '</span>' +
          /* v89.128（老板）：「人口增速这里加个类似资源增速的加号按钮，用于使用相关道具
             （不要显示现有道具数量）」——与资源 "+" 同款（plus-btn）。 */
          '<span class="plus-btn" data-action="quick-pop" title="使用人口道具（增民令 / 移民令）">+</span>' +
          '</span></div>';
      })() +""",
     '② 人口行整段'),
    # ③ 民心去图标
    ("""      '<div class="res-line"><span class="lbl">❤️ 民心 / 民怨</span><span class="val">' +""",
     """      /* v89.128（老板）：「民心/税率/人口前边的小图标去掉」 */
      '<div class="res-line"><span class="lbl">民心 / 民怨</span><span class="val">' +""",
     '③ 民心去图标'),
    # ④ 税率去图标 + 按钮统一 plus-btn
    ("""      '<div class="res-line"><span class="lbl">💰 税率</span><span class="val">' +
        '<button class="btn sm tax-step" data-action="tax-step" data-d="-5" title="税率 −5%">−</button>' +
        '<b style="font-variant-numeric:tabular-nums;margin:0 6px;">' + Math.round((s.tax || 0) * 100) + '%</b>' +
        '<button class="btn sm tax-step" data-action="tax-step" data-d="5" title="税率 +5%">＋</button>' +
      '</span></div>' +""",
     """      '<div class="res-line"><span class="lbl">税率</span><span class="val">' +
        /* v89.128（老板）：「可点击的功能按钮参考资源那里的按钮，统一图标风格大小和颜色」 */
        '<span class="plus-btn" data-action="tax-step" data-d="-5" title="税率 −5%">−</span>' +
        '<b style="font-variant-numeric:tabular-nums;margin:0 6px;">' + Math.round((s.tax || 0) * 100) + '%</b>' +
        '<span class="plus-btn" data-action="tax-step" data-d="5" title="税率 +5%">＋</span>' +
      '</span></div>' +""",
     '④ 税率按钮统一'),
    # ⑤ 野地行：label + 空选项
    ("""    }).join('') || '<option value="">暂无附属野地</option>';
    box.innerHTML = '<div class="res-line" title="已占野地（官府等级决定上限）。选一块点「进入」查看加成与采集。">' +
      '<span class="lbl">附属野地</span>' +""",
     """    }).join('') || '<option value="">暂无野地</option>';
    /* v89.128（老板）：「附属野地改成野地，现在换行了有点难看」——短标签 + 小按钮，一行放得下。 */
    box.innerHTML = '<div class="res-line" title="已占野地（官府等级决定上限）。选一块点「进入」查看加成与采集。">' +
      '<span class="lbl">野地</span>' +""",
     '⑤a 野地 label'),
    ("""        '<button class="btn sm gold" data-action="open-wilds">进入</button>' +""",
     """        /* v89.128（老板）：「进入按钮太大了点，适当缩小」 */
        '<button class="btn sm gold wild-go" data-action="open-wilds">进入</button>' +""",
     '⑤b 进入按钮缩小'),
    # ⑥ 新增 openQuickPop（在 openQuickItem 之后）
    ("""    ui.openModal('<div class="gold-heading">加快' + resName + '产量</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };""",
     """    ui.openModal('<div class="gold-heading">加快' + resName + '产量</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* ============================================================
   * v89.128（老板 需求 7）：「人口增长速度这里加个类似资源增速的加号按钮，
   *   用于使用相关道具（不要显示现有道具数量）」—— 人口道具快用：
   *   增民令（增速 buff）/ 移民令（一次性注入）。与资源 "+" 同款交互；
   *   左侧栏按钮上**不显数量**，持有与否在弹窗里说明。
   * ============================================================ */
  ui.openQuickPop = function () {
    var s = GAME.state;
    var cands = DATA.ITEMS.filter(function (it) {
      return (it.type === 'pop_boost' || it.type === 'pop_fill') && !it.noShop;
    });
    var rows = cands.map(function (it) {
      var have = (s.items && s.items[it.id]) || 0;
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:var(--gold-light);">' + it.name + ' <span style="color:var(--text-dim);font-size:var(--fs-cap);">持有 ' + have + '</span></span>' +
          (have ? '<button class="btn sm gold" data-action="use-item-quick" data-item="' + it.id + '">使用</button>'
                : '<span style="color:var(--text-dim);font-size:var(--fs-sub);">未持有（商城 · 民生页有售）</span>') +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + it.desc + '</div>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">人口道具（增民令 / 移民令）</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };""",
     '⑥ openQuickPop'),
])

# ════════ main.js ════════
do_file('js/main.js', [
    ("      case 'quick-item': ui.openQuickItem(el.dataset.res); break;",
     """      case 'quick-item': ui.openQuickItem(el.dataset.res); break;
      /* v89.128（需求 7）：人口道具快用（人口行 "+" 按钮） */
      case 'quick-pop': ui.openQuickPop(); break;""",
     'quick-pop 接线'),
])

# ════════ index.html ════════
do_file('index.html', [
    ("  .res-line .val .item-badge { color: var(--gold-light); font-size: var(--fs-cap); font-weight: 700; }\n",
     "",
     '删 item-badge CSS（1）'),
    ("  #res-bar .res-line .val .item-badge { position: absolute; right: -2px; top: -9px; }\n",
     "",
     '删 item-badge CSS（2）'),
    ("  .tax-step { padding: 0 var(--sp-2); line-height: 20px; }",
     "  /* v89.128：税率 ±按钮改用 plus-btn（删 .tax-step 专有样式）；野地「进入」小按钮 */\n"
     "  .wild-go { padding: 0 var(--sp-2); line-height: 20px; font-size: var(--fs-sub); }",
     'tax-step → wild-go'),
    ("        .tax-step 20px / .sd-chip 16px / .tac-k 22px）—— 那是\"垂直居中手段\"不是排版节奏。 */",
     "        .wild-go 20px / .sd-chip 16px / .tac-k 22px）—— 那是\"垂直居中手段\"不是排版节奏。 */",
     '注释行同步'),
])

# ════════ smoke §109 ════════
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
sect = """  /* ═══════════════════════════════════════════════════════════
   * §109（v89.128）左栏统计改造（老板需求 7/8）
   * ------------------------------------------------------------
   * 需求 7：人口只显当前数（悬停给"建筑人口/上限人口"）；人口增速加号按钮（不显数量）；
   *   民心/税率/人口去图标；可点击按钮统一 plus-btn（与资源 "+" 同款）。
   * 需求 8：资源道具按钮不显数量；「附属野地」→「野地」；「进入」按钮缩小。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var keep109 = G.state;
    var st109 = G.newGame({ name: 'v128u', cityName: '许都' });
    G.state = st109;
    var c109 = st109.cities[0];
    G.ui._cityId = c109.id;
    G.ui.renderResBar(c109, st109);
    G.ui.renderCityAttrs(c109, st109);
    var res109 = (global.document.querySelector('#res-bar') || {}).innerHTML || '';
    var at109 = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
    check('§109① 资源行不显示道具数量（plus-btn 在 · item-badge 无）',
      res109.indexOf('plus-btn') >= 0 && res109.indexOf('item-badge') < 0);
    var popSeg109 = at109.slice(at109.indexOf('pop-line'));
    popSeg109 = popSeg109.slice(0, Math.max(0, popSeg109.indexOf('</div>')));
    check('§109② 人口行只显当前数（无「/ 上限」）+ 人口道具加号按钮',
      at109.indexOf('pop-line') >= 0 && popSeg109.indexOf('cap">') < 0
      && popSeg109.indexOf('data-action="quick-pop"') >= 0,
      popSeg109.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').slice(0, 60));
    check('§109③ 民心/税率/人口行去图标（❤️/💰/👥 不再作 lbl 前缀）',
      at109.indexOf('<span class="lbl">❤️') < 0 && at109.indexOf('<span class="lbl">💰') < 0
      && at109.indexOf('<span class="lbl">👥') < 0);
    check('§109④ 野地行 label=「野地」+「进入」按钮走 wild-go（缩小）',
      (function () {
        G.ui.renderWildPick(c109, st109);
        var wp = (global.document.querySelector('#wild-pick-host') || {}).innerHTML || '';
        return wp.indexOf('<span class="lbl">野地</span>') >= 0 && wp.indexOf('wild-go') >= 0;
      })());
    G.ui.openQuickPop();
    var m109 = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
    check('§109⑤ 真调 quick-pop：弹窗含增民令 / 移民令',
      m109.indexOf('增民令') >= 0 && m109.indexOf('移民令') >= 0);
    try { G.ui.closeAllModals(); } catch (e) {}
    G.state = keep109;
  })();

"""
anchor = """  /* ═══════════════════════════════════════════════════════════
   * §105（v89.126）人口增速：固定时间速率（每 fillHours 现实小时补满）"""
assert s.count(anchor) == 1, '§105 锚点 %d' % s.count(anchor)
s = s.replace(anchor, sect + anchor)
n += 1
print('  ✓ [smoke] §109 段')
assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)

print('patch J OK · 共 %d 处' % n)
