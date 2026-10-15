# -*- coding: utf-8 -*-
"""v89.202 批次A：蕴养同款（面板改网格专属界面 + main 接线 + CSS 退役 + key 出口注释）

规范：锚点唯一断言 count==1 · 幂等 guard = 新特征计数 · newline='' 写盘 · 跑后 node --check。"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

# ============================================================
# A1 · ui.js：蕴养面板整段替换（注释块 + 函数体）→ 网格专属界面
# ============================================================
p_ui = R + 'js/ui.js'
s = rd(p_ui)
if s.count('ui._lingSel = null;') >= 1:
    print('[skip] A1 ui 蕴养面板')
else:
    start = s.index('  /* ============================================================\n   * v88 · 蕴养（修炼装备强化')
    anchor = s.index('ui.openLingTemper = function', start)
    end = s.index('\n  };\n', anchor) + len('\n  };\n')
    old_seg = s[start:end]
    assert 'enh-list' in old_seg and 'ling-temper-item' in old_seg and len(old_seg) < 4000, \
        'seg len=' + str(len(old_seg))
    print('    [seg 头] ' + repr(old_seg[:60]))
    print('    [seg 尾] ' + repr(old_seg[-60:]))

    NEW = r'''  /* ============================================================
   * v88 · 蕴养（修炼装备强化 —— 与百炼强化平行的独立面板）
   * ------------------------------------------------------------
   * 列出**已拥有**的修炼装备（背包 + 穿戴；GAME.lingTemperList），
   * 每件给下一级精华成本。等级与效果都走唯一出口（eqEnhOf / genEquipBonus /
   * lingPowerOf），这里只做呈现。
   * ⛔ v89.202（老板 1）：「蕴养同款」—— 照 v89.201 百炼专属界面重做：
   *   ① 单列列表（lg 小窗 · 每行一颗"蕴养 +N"键）改**专属界面**：xxl 档 +
   *      顶部筛选（全部/未满/圆满）+ 3 列网格卡片（品阶图 + 名称·序号 +
   *      大号 +N/上限 + 下级成本）+ 点选（ling-pick）+ **底部唯一蕴养键**
   *      （与百炼/打造同款"点选 + 底键"形态）+ 分页（ui.LING_PER_PAGE/页）。
   *   ② live 每秒刷新（灵气精华随采集/游历即时变）+ 操作后 reopenKeepScroll
   *      （滚动位保留，与百炼同）。
   * 件 key 出口复用 ui.enhKeyOf（uid ?? id · 两体系同一把尺，不另造）。
   * 旧"每行一颗蕴养键"的 .enh-list/.enh-row 单列家族随本轮整族退役（CSS 同步清）。
   * ============================================================ */
  ui.LING_PER_PAGE = 15;          /* 3 列 x 5 行（xxl 正文 ~690px，卡高 84px + 行距） */
  ui._lingSel = null;             /* 选中的件（key = 件号 u 或装备 id，String 化比对） */
  ui._lingFilter = 'all';         /* 筛选：all / todo（未满）/ done（圆满） */
  ui.setLingFilter = function (k) {
    ui._lingFilter = (k === 'todo' || k === 'done') ? k : 'all';
    ui._pages['ling'] = 1;
    ui.openLingTemper();
  };
  ui.lingPick = function (key) {
    if (key == null) return;
    key = String(key);
    ui._lingSel = (ui._lingSel === key) ? '' : key;
    ui.reopenKeepScroll(ui.openLingTemper);     /* 点选保留滚动位（v89.201 机制） */
  };
  ui.openLingTemper = function () {
    /* v89：蕴养君主专属 —— 无君主直接拒开 */
    if (!GAME.lordGeneralOf()) { ui.toast('君主不在，无从蕴养'); return; }
    var list = GAME.lingTemperList();
    var perLv = Math.round(((DATA.LING_TEMPER || {}).perLv || 0.08) * 100);
    var maxL = GAME.lingTemperMax();
    var ess = (GAME.state.items || {}).lingsui || 0;
    var filt = ui._lingFilter || 'all';
    var pool = list.filter(function (inst) {
      if (filt === 'todo') return GAME.eqEnhOf(inst) < maxL;
      if (filt === 'done') return GAME.eqEnhOf(inst) >= maxL;
      return true;
    });
    /* 选中件只认**池内**（换筛选把选中件筛出池外 → 自动清空，避免"看不见的选中"） */
    var selInst = null;
    pool.forEach(function (x) { if (ui.enhKeyOf(x) === ui._lingSel) selInst = x; });
    if (!selInst) ui._lingSel = '';
    var nTodo = list.filter(function (x) { return GAME.eqEnhOf(x) < maxL; }).length;
    var filtHtml = [['all', '全部', list.length], ['todo', '未满', nTodo], ['done', '圆满', list.length - nTodo]]
      .map(function (kk) {
        return '<span class="shop-cat' + (filt === kk[0] ? ' on' : '') +
          '" data-action="ling-filter" data-k="' + kk[0] + '">' + kk[1] + '<i>' + kk[2] + '</i></span>';
      }).join('');
    var pg = ui.modalPage('ling', pool, ui.LING_PER_PAGE, function () { ui.openLingTemper(); });
    var cards = pg.slice.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.eqEnhOf(inst);
      var key = ui.enhKeyOf(inst), sn = GAME.eqSerial(inst);
      var cost = lv < maxL ? GAME.lingTemperCost(inst) : null;
      return '<div class="enh-card' + (key === ui._lingSel ? ' on' : '') +
          '" data-action="ling-pick" data-key="' + key + '"' +
          ' title="' + U.escape(GAME.eqLabel(inst) + '　每级修炼属性 +' + perLv + '%') + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + (sn ? '·' + sn : '') + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxL + '</i></span>' +
          '<span class="ec-cost">' + (cost ? ('下级 灵气精华 ' + cost) : '已至圆满') + '</span>' +
        '</span></div>';
    }).join('') || '<div class="q-empty">' + (filt === 'todo' ? '全部修炼装备都已圆满。'
      : (filt === 'done' ? '还没有圆满的修炼装备。'
        : (GAME.jianghuWildMounted
          ? '还没有修炼装备。到野地「江湖游历」讨伐/试炼/采集，可得修炼装备与灵气精华。'
          : '还没有修炼装备。'))) + '</div>';
    /* 底键状态（与结算同一把尺：成本读 GAME.lingTemperCost、精华读 s.items.lingsui） */
    var selLv = selInst ? GAME.eqEnhOf(selInst) : -1;
    var selCost = (selInst && selLv < maxL) ? GAME.lingTemperCost(selInst) : null;
    var canT = !!selCost && ess >= selCost;
    var btnWhy = !selInst ? '先在下方点选一件修炼装备（可先切「未满」筛选）'
      : (selLv >= maxL ? '「' + GAME.eqLabel(selInst) + '」已至 +' + maxL + '（圆满）'
        : ('灵气精华不足：下一级需 ' + selCost + '（现有 ' + ess + '）'));
    ui.openShell({
      /* v89.202：逐秒刷新（灵气精华随采集/游历即时变；live 快照自动保滚动位） */
      live: function () { ui.openLingTemper(); },
      title: '☯ 蕴养 · 修炼装备',
      sub: '按件蕴养（同名以 甲/乙/丙 区分）　圆满 +' + maxL + '　每级修炼属性 +' + perLv + '%　灵气精华 ' + ess + '（野地采集 · 征战所得）',
      size: 'xxl',
      body: '<div class="forge-filter">' +
          '<span class="ff-k">筛选</span><span class="shop-cats">' + filtHtml + '</span>' +
          ui.help('蕴养按件记录：同名多件各有各的等级（甲/乙/丙 序号区分）。\n' +
            '每级修炼属性 +' + perLv + '%（走 genEquipBonus 唯一出口）。\n' +
            '点选一件 → 底部「蕴养」键逐级提升 —— 蕴养后选中保留，可连点提升。') +
        '</div>' +
        '<div class="enh-rows">' + cards + '</div>',
      foot: '<div class="m-foot">' + (pool.length ? pg.pager : '') +
        '<button class="btn' + (canT ? ' gold' : ' dim') + '" data-action="ling-temper-item"' +
          ' data-key="' + U.escape(ui._lingSel || '') + '"' +
          (canT ? '' : ' disabled data-why="' + U.escape(btnWhy) + '"') + '>☯ 蕴养' +
          (selInst && selLv < maxL ? ' +' + (selLv + 1) : '') + '</button>' +
        (selCost ? '<span class="op-hint">' + U.escape('下一级 灵气精华 ' + selCost) + '</span>' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
'''
    s = s[:start] + NEW + s[end:]
    wr(p_ui, s)
    print('[ok] A1 ui 蕴养面板（seg %d → %d 字符）' % (len(old_seg), len(NEW)))

# ============================================================
# A2 · main.js：case 接线 + doLingTemper 走 reopenKeepScroll
# ============================================================
rep('A2a main case 接线', R + 'js/main.js',
    "      case 'ling-temper-open': ui.openLingTemper(); break;\n"
    "      case 'ling-temper-item': GAME.doLingTemper(el.dataset.key); break;",
    "      case 'ling-temper-open': ui.openLingTemper(); break;\n"
    "      case 'ling-temper-item': GAME.doLingTemper(el.dataset.key); break;\n"
    "      case 'ling-pick': ui.lingPick(el.dataset.key); break;\n"
    "      case 'ling-filter': ui.setLingFilter(el.dataset.k); break;",
    "case 'ling-pick': ui.lingPick(el.dataset.key); break;")

rep('A2b doLingTemper reopenKeepScroll', R + 'js/main.js',
    "  GAME.doLingTemper = function (key) {\n"
    "    var r = GAME.lingTemper(key);\n"
    "    ui.toast(r.msg);\n"
    "    if (r.ok) { GAME.refreshAll(); ui.openLingTemper(); }\n"
    "  };",
    "  GAME.doLingTemper = function (key) {\n"
    "    var r = GAME.lingTemper(key);\n"
    "    ui.toast(r.msg);\n"
    "    /* v89.202：重开走 reopenKeepScroll —— 与百炼同（点一次不回顶部） */\n"
    "    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openLingTemper); }\n"
    "  };",
    "ui.reopenKeepScroll(ui.openLingTemper)")

# ============================================================
# A3 · index.html：.enh-list/.enh-row 单列家族退役（墓碑）
# ============================================================
p_html = R + 'index.html'
s = rd(p_html)
if s.count('v89.202（老板 1「蕴养同款」）') >= 1:
    print('[skip] A3 CSS 退役')
else:
    i0 = s.index('  .enh-list { display: flex; flex-direction: column; }')
    i1 = s.index('  .enh-cost { color: var(--text-dim); font-size: var(--fs-sub); }', i0)
    i1 += len('  .enh-cost { color: var(--text-dim); font-size: var(--fs-sub); }')
    assert s[i1] == '\n', 'A3 行尾异常: ' + repr(s[i1:i1 + 4])
    i1 += 1   # 含尾换行
    old_css = s[i0:i1]
    assert '.enh-row:last-child' in old_css and 'enh-nm' in old_css and 'enh-tag' in old_css, 'css seg'
    NEW_CSS = ('  /* \u26d4 v89.202（老板 1「蕴养同款」）：.enh-list / .enh-row / .enh-nm / .enh-tag /\n'
               '     .enh-cost 单列家族随蕴养面板改网格卡片（.enh-rows/.enh-card）整族退役 ——\n'
               '     原"每行一颗蕴养键"的单列形态无第二消费方（全仓唯一用点=蕴养面板）。 */\n')
    s = s[:i0] + NEW_CSS + s[i1:]
    wr(p_html, s)
    print('[ok] A3 CSS 退役（%d → %d 字符）' % (len(old_css), len(NEW_CSS)))

# ============================================================
# A4 · ui.js：enhKeyOf 注释补一句（两体系共用）
# ============================================================
rep('A4 enhKeyOf 注释', p_ui,
    "  /* 件 key 唯一出口（卡片点选 / 选中比对 / 底键 data-item 三处同源） */",
    "  /* 件 key 唯一出口（卡片点选 / 选中比对 / 底键 data-item 三处同源）\n"
    "     v89.202：蕴养面板同用（两体系同一把尺 · 不另造）。 */",
    "v89.202：蕴养面板同用")

print('批次A 完成')
