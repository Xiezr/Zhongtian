# -*- coding: utf-8 -*-
"""v89.194 批次F3：藏珍阁 UI（collectHTML）+ renderView 分支 + main.js 动作 + index.html（tab/CSS）"""
import io

R = 'E:/Deepseekdb/'
UI = R + 'js/ui.js'
MAIN = R + 'js/main.js'
HTML = R + 'index.html'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败'
    print('[ok] ' + tag)

# ─────────────────────────────────────────────
# F3-1. ui.js：ui.collectHTML / setColCat / renderCollect
# ─────────────────────────────────────────────
COLLECT_UI = u'''  /* ============================================================
   * v89.194（老板 S3）：**藏珍阁**（收藏视图）—— 与商城 / 背包并列的整页菜单
   * ------------------------------------------------------------
   * 结构：标题（全库统计）→ 系列 chips（全部 + 18 系，带完成度与 ✓）
   *   → 当前系列说明 + 一键集齐 → 藏品网格（4 列 / 每页 12）→ 底部翻页。
   * 卡片：图标 / 名 + 副题 / 所属系列 / 价格 + 购买（已藏 = 金框 ✓ 已入藏）。
   * 动作全走唯一出口：collect-buy / collect-series（域层才是硬闸；
   *   按钮置灰只是提示 —— v89.189 口径：可点+说明，用了 data-why）。
   * ============================================================ */
  ui.COL_PER_PAGE = 12;      /* 每页 12 席（4 列 × 3 行） */
  ui._colCat = 'all';
  ui.collectHTML = function () {
    var s = GAME.state;
    var C = DATA.COLLECT || { series: [] };
    var stat = GAME.collectStatOf();
    var cat = ui._colCat || 'all';
    /* 拍平：全部藏品 + 归属系列（过滤与展示全走这一份） */
    var all = [];
    (C.series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) { all.push({ it: it, sr: sr }); });
    });
    var cur = null;
    (C.series || []).forEach(function (sr) { if (sr.id === cat) cur = sr; });
    var list = cur ? all.filter(function (x) { return x.sr.id === cur.id; }) : all;
    var per = ui.COL_PER_PAGE;
    var p = ui.pageOf('collect', list.length, per);
    var slice = list.slice(p.from, p.to);
    ui.pagerHTML('collect', list.length, per);

    var chips = [['all', '🏛 全部', stat.have + '/' + stat.total, false]]
      .concat((C.series || []).map(function (sr) {
        var d = GAME.collectSeriesDoneOf(sr.id);
        return [sr.id, sr.icon + ' ' + sr.name, d.have + '/' + d.total, d.done];
      }));
    var chipsHTML = chips.map(function (c2) {
      return '<span class="chip col-chip' + (c2[0] === cat ? ' on' : '') + (c2[3] ? ' done' : '') +
        '" data-action="collect-cat" data-c="' + c2[0] + '">' + c2[1] +
        '<i>' + c2[2] + (c2[3] ? ' ✓' : '') + '</i></span>';
    }).join('');

    var cards = slice.map(function (x) {
      var have = GAME.collectHaveOf(x.it.id);
      var can = (GAME.goldOf() || 0) >= x.it.price;
      return '<div class="col-card' + (have ? ' owned' : '') + '">' +
        '<div class="col-ico">' + (x.sr.icon || '🏺') + '</div>' +
        '<div class="col-nm">' + U.escape(x.it.name) +
          (x.it.sub ? '<span class="col-sub">' + U.escape(x.it.sub) + '</span>' : '') + '</div>' +
        '<div class="col-sr">' + U.escape(x.sr.name) + '</div>' +
        (have
          ? '<div class="col-own">✓ 已入藏</div>'
          : '<div class="col-buy"><span class="col-price">' + U.fmt(x.it.price) + ' 金</span>' +
            '<button class="btn sm' + (can ? ' gold' : ' dim') + '" data-action="collect-buy" data-item="' + x.it.id + '"' +
            (can ? '' : ' disabled data-why="黄金不足：需 ' + U.fmt(x.it.price) + ' 金"') + '>购买</button></div>') +
        '</div>';
    }).join('');

    var curMissing = cur ? (cur.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); }) : [];
    var headDesc = cur
      ? (cur.icon + ' ' + U.escape(cur.name) + ' —— ' + U.escape(cur.desc || ''))
      : '成系列收藏名将与佳人的珍品 —— 集齐一系可得声望。';
    return '<div class="ui-page col-page">' +
      '<div class="gold-heading">🏛 藏珍阁' +
        ui.help('通过购买成系列的收藏品，消耗后期金币。\\n' +
          '藏品纯为荣誉（不给战斗属性）；**集齐一系**得该系声望，' +
          '全 ' + stat.seriesTotal + ' 系集齐另得 ' + U.fmt(C.allRep || 0) + ' 声望。\\n' +
          '卡上金额为**金**（全境通用池）；已入藏的藏品不再出售（一物一藏）。') +
        '<span class="ui-sub">　已藏 <b>' + stat.have + '</b> / ' + stat.total +
          ' 件　·　系列 <b>' + stat.seriesDone + '</b> / ' + stat.seriesTotal + '</span>' +
      '</div>' +
      '<div class="shop-cats col-cats">' + chipsHTML + '</div>' +
      '<div class="col-desc"><span>' + headDesc + '</span>' +
        (cur
          ? '<button class="btn sm' + (curMissing.length ? ' gold' : ' dim') + '" data-action="collect-series" data-s="' + cur.id + '"' +
            (curMissing.length ? '' : ' disabled data-why="本系列已集齐"') +
            '>一键集齐本系（' + curMissing.length + ' 件）</button>'
          : '') +
      '</div>' +
      (cards ? '<div class="col-grid">' + cards + '</div>' : '<div class="q-empty">暂无藏品。</div>') +
      '</div>';
  };
  ui.setColCat = function (c) { ui._colCat = c; ui._pages['collect'] = 1; ui.renderCollect(); };
  ui.renderCollect = function () {
    if (ui.view !== 'collection') return;
    ui.repaintView(function () { return ui.collectHTML(); });
  };

'''
F1_OLD = """  /* ============================================================
   * 商城（v18 重制）"""
F1_NEW = COLLECT_UI + """  /* ============================================================
   * 商城（v18 重制）"""
rep(UI, 'F3-1 collectHTML', F1_OLD, F1_NEW, 'ui.collectHTML = function () {')

# ─────────────────────────────────────────────
# F3-2. ui.js：renderView 分支
# ─────────────────────────────────────────────
rep(UI, 'F3-2 renderView 分支',
"""    else if (v === 'bag') box.innerHTML = ui.bagHTML();""",
"""    else if (v === 'bag') box.innerHTML = ui.bagHTML();
    /* v89.194（老板 S3）：收藏（藏珍阁）—— 与商城 / 背包并列的整页视图 */
    else if (v === 'collection') box.innerHTML = ui.collectHTML();""",
"else if (v === 'collection') box.innerHTML = ui.collectHTML();")

# ─────────────────────────────────────────────
# F3-3. main.js：三个动作 case
# ─────────────────────────────────────────────
rep(MAIN, 'F3-3 动作 case',
"""      /* 商城分类（v18：固定网格 + 分类页签） */
      case 'shop-cat': ui.setShopCat(el.dataset.c); break;""",
"""      /* 商城分类（v18：固定网格 + 分类页签） */
      case 'shop-cat': ui.setShopCat(el.dataset.c); break;
      /* v89.194（老板 S3）：藏珍阁 —— 系列切换 / 单件购买 / 一键集齐（逻辑全在域层出口） */
      case 'collect-cat': ui.setColCat(el.dataset.c); break;
      case 'collect-buy': {
        var _cbr194 = GAME.collectBuy(el.dataset.item);
        ui.toast(_cbr194.ok ? ('🏺 「' + _cbr194.item.name + '」已入藏') : _cbr194.msg);
        if (_cbr194.ok) ui.renderCollect();
        break;
      }
      case 'collect-series': {
        var _csr194 = GAME.collectBuySeries(el.dataset.s);
        ui.toast(_csr194.ok ? ('🏆 集齐 ' + _csr194.bought + ' 件（金 −' + GAME.utils.fmt(_csr194.cost) + '）') : _csr194.msg);
        if (_csr194.ok) ui.renderCollect();
        break;
      }""",
"case 'collect-cat': ui.setColCat(el.dataset.c); break;")

# ─────────────────────────────────────────────
# F3-4. index.html：导航 tab
# ─────────────────────────────────────────────
rep(HTML, 'F3-4 导航 tab',
"""    <div class="tab" data-view="bag"><i class="ti" data-nav="bag"></i>背包</div>""",
"""    <div class="tab" data-view="bag"><i class="ti" data-nav="bag"></i>背包</div>
    <!-- v89.194（老板 S3）：收藏（藏珍阁）—— 与商城 / 背包并列 -->
    <div class="tab" data-view="collection"><i class="ti" data-nav="collection"></i>收藏</div>""",
'data-view="collection"><i class="ti" data-nav="collection"></i>收藏</div>')

# ─────────────────────────────────────────────
# F3-5. index.html：收藏 CSS
# ─────────────────────────────────────────────
CSS_OLD = """  /* ============ 商城（v18：分类 + 固定网格 + 分页）============ */"""
CSS_NEW = """  /* ============ v89.194（老板 S3）：藏珍阁（收藏视图）============ */
  .col-cats { flex-wrap: wrap; }
  .col-chip i { font-style: normal; margin-left: var(--sp-1); color: var(--text-dim); font-size: var(--fs-cap); }
  .col-chip.done { border-color: rgba(var(--gold-rgb),.65); }
  .col-chip.done i { color: var(--gold-light); }
  .col-desc { display: flex; align-items: center; gap: var(--sp-4); color: var(--text-dim);
    font-size: var(--fs-sub); margin: var(--sp-2) 0 var(--sp-3); }
  .col-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-4); }
  .col-card { background: rgba(var(--sh-rgb),.22); border: 1px solid var(--line);
    border-radius: var(--r-lg); padding: var(--sp-4); min-height: 132px;
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); }
  .col-card.owned { border-color: rgba(var(--gold-rgb),.55); background: rgba(var(--gold-rgb),.06); }
  .col-ico { font-size: 30px; line-height: 1.2; }
  .col-nm { font-weight: 700; color: var(--gold-light); text-align: center; }
  .col-sub { display: block; font-weight: 400; color: var(--text-dim); font-size: var(--fs-cap); }
  .col-sr { color: var(--text-dim); font-size: var(--fs-sub); }
  .col-own { color: var(--green-ok); font-weight: 700; margin-top: auto; }
  .col-buy { display: flex; align-items: center; gap: var(--sp-3); margin-top: auto; }
  .col-price { color: var(--gold-light); font-variant-numeric: tabular-nums; }

  /* ============ 商城（v18：分类 + 固定网格 + 分页）============ */"""
rep(HTML, 'F3-5 收藏 CSS', CSS_OLD, CSS_NEW, 'v89.194（老板 S3）：藏珍阁（收藏视图）')

print('\n批次 F3 完成。')
