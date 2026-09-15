# -*- coding: utf-8 -*-
"""v73 UI 层补丁：将领界面头部 / 建筑弹窗去顶图+吸底 / 种田秘境界面 / 官府入口

老板五条中的 ③④⑤ 的界面部分：
  ④ 将领界面头部精简：去 🧑‍✈️（头像+飞机）与席位文字，只留「将领」+ 本城/全境 chips。
  ⑤ 建筑弹窗：四处顶部图标块整体撤除；底栏 .bldg-foot 改**吸底**（sticky）。
  ③ 种田秘境：官府入口 + 秘境面板 + 选种弹窗 + 宝物背包灵草分类 + 主循环刷新。

锚点唯一校验 + 幂等（new 已在则跳过）+ 行尾自动保持。
"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


def P(*a):
    return os.path.join(ROOT, *a)


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    total = t.count('\n')
    crlf = t.count('\r\n') > (total - t.count('\r\n'))

    def to_dom(s):
        return s.replace('\n', '\r\n') if crlf else s.replace('\r\n', '\n')

    def to_alt(s):
        return s.replace('\r\n', '\n') if crlf else s.replace('\n', '\r\n')

    pairs = [(to_dom(old), to_dom(new))]
    if to_alt(old) != to_dom(old):
        pairs.append((to_alt(old), to_alt(new)))
    for o2, n2 in pairs:
        if n2 in t:
            print('  · %s：已改过（跳过）' % tag)
            return
    hit = [(o, n) for o, n in pairs if t.count(o) == 1]
    if not hit:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(pairs[0][0])))
        sys.exit(1)
    o2, n2 = hit[0]
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(o2, n2, 1))
    print('  ✓ %s' % tag)


UI = P('js', 'ui.js')
MAIN = P('js', 'main.js')
HTML = P('index.html')

print('========== ④ 将领界面头部（ui.js） ==========')

patch(
    UI,
    """    var heroN = pool.filter(function (g) { return g.hero; }).length;
    var scopeChips = '<span class="chips gen-scope">' + ui.GEN_SCOPES.map(function (p2) {
      return '<span class="chip' + (p2[0] === scope ? ' on' : '') +
        '" data-action="gen-scope" data-v="' + p2[0] + '">' + p2[1] + '</span>';
    }).join('') + '</span>';
    var scopeNote = scope === 'city'
      ? '（本城 ' + pool.length + ' / ' + cap + ' 席 · 全境 ' + s.generals.length + ' / '
        + GAME.genSlotsTotal() + ' 席）'
      : '（全境 ' + pool.length + ' / ' + cap + ' 席）';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🧑‍✈️ 将领' + scopeNote +
        (heroN ? '　名将 ' + heroN : '') + scopeChips +""",
    """    var scopeChips = '<span class="chips gen-scope">' + ui.GEN_SCOPES.map(function (p2) {
      return '<span class="chip' + (p2[0] === scope ? ' on' : '') +
        '" data-action="gen-scope" data-v="' + p2[0] + '">' + p2[1] + '</span>';
    }).join('') + '</span>';
    /* v73（老板）：「将领的界面顶部，怎么有个头像加一个飞机啊？不要搞
       （本城 2 / 11 席 · 全境 2 / 11 席）这些文字，直接将领加本城/全境切换按钮就行」
       —— 标题只留「将领」二字 + 本城/全境 chips：🧑‍✈️（人+飞机）/ 席位文字 /
       名将计数一律撤下（席位口径仍在 ⓘ 里说明，具体数字去招贤馆面板看）。 */
    return '<div class="ui-page">' +
      '<div class="gold-heading">将领' + scopeChips +""",
    'U1 将领头部精简',
)

print()
print('========== ⑤ 建筑弹窗：去顶部图标（ui.js 四处） ==========')

patch(
    UI,
    """      /* v68（弹窗统一）：施工中弹窗与正常态**同构** ——
         图标 +「名称 · Lv→Lv」+ 描述，危险操作进底栏（设计规范 §11）。 */
      /* v72（老板报障）：「官府升级中点击 → 界面内容很大，出现下拉框和左右拉框」——
         图标收进尺寸盒 .dlg-ico：位图 <img class="ico"> 没有容器尺寸规则时按**固有尺寸
         1024px** 渲染，把弹窗（660×620）撑成 1036×1349，上下 + 左右滚动条同时出现。
         位图 / 矢量 / emoji 三种回退都收进盒内（.dlg-ico .ico { 1em }）。 */
      var icB = GAME.icons.forBuilding(isUpgrade ? cell.build.id : cell.pending.buildId)
        || (isUpgrade ? (DATA.BUILDINGS[cell.build.id] || {}).icon : (pb2 || {}).icon) || '';
      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span class="dlg-ico" style="font-size:40px;">' +
          icB + '</span></div>' +
        '<div class="gold-heading">' + (pb2 ? pb2.name : '建筑') +""",
    """      /* v68（弹窗统一）：施工中弹窗与正常态**同构** ——「名称 · Lv→Lv」+ 描述，
         危险操作进底栏（设计规范 §11）。
         v73（老板）：「建筑点开界面，顶部的图标也不要留，还是旧图标」——
         顶部图标块整体撤除（城内 / 城外 × 正常 / 施工中 四处一起撤），
         v72 的 .dlg-ico 尺寸盒随之退休 —— 没有图标，就没有 1024px 撑爆的土壤。 */
      ui.openModal(
        '<div class="gold-heading">' + (pb2 ? pb2.name : '建筑') +""",
    'U2a 城内·施工中去图标',
)

patch(
    UI,
    """      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:40px;">' + b.icon + '</span></div>' +
        '<div class="gold-heading">' + b.name + ' · Lv' + cell.build.lvl + '</div>' +""",
    """      ui.openModal(
        /* v73（老板）：顶部图标不留（旧 emoji 图标本就不如棋盘位图，索性撤下） */
        '<div class="gold-heading">' + b.name + ' · Lv' + cell.build.lvl + '</div>' +""",
    'U2b 城内·正常去图标',
)

patch(
    UI,
    """      ui.openModal(
        /* v72（老板报障）：同城内「升级中」—— 图标收进尺寸盒 .dlg-ico（位图防 1024px 固有尺寸撑爆） */
        '<div style="text-align:center;margin-bottom:8px;"><span class="dlg-ico" style="font-size:40px;">' +
          (GAME.icons.forExt(e.type) || (DATA.EXT_BUILDINGS[e.type] || {}).icon) + '</span></div>' +
        '<div class="gold-heading">' + pendName + (isUpE ? (' · Lv' + e.lv + ' → Lv' + (e.lv + 1)) : '') + '</div>' +""",
    """      ui.openModal(
        /* v73（老板）：顶部图标不留（与城内两处同批撤除） */
        '<div class="gold-heading">' + pendName + (isUpE ? (' · Lv' + e.lv + ' → Lv' + (e.lv + 1)) : '') + '</div>' +""",
    'U2c 城外·施工中去图标',
)

patch(
    UI,
    """      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:40px;">' + eb.icon + '</span></div>' +
        '<div class="gold-heading">' + eb.name + ' · Lv' + e.lv + '</div>' +""",
    """      ui.openModal(
        /* v73（老板）：顶部图标不留（与城内两处同批撤除） */
        '<div class="gold-heading">' + eb.name + ' · Lv' + e.lv + '</div>' +""",
    'U2d 城外·正常去图标',
)

print()
print('========== ③ 官府入口（ui.js） ==========')

patch(
    UI,
    """    /* v29（需求 6）：队列总览从「公文」迁到这里 —— 建造/募兵本就属城务 */
    /* v65：队列只列前 4 条（多的给一行摘要）—— 面板高度因此可控 */
    var queueBox = '<div class="op-zone"><div class="op-zone-t">在办事项 · 建造 / 募兵 / 自动 / 行军</div>' +
      ui.queueBody(4) + '</div>';""",
    """    /* v73（老板需求 3）：「官府可进入另外一个菜单，种田秘境」——
       入口放征收之后（同属"这块地盘能做什么"的动作区），一行按钮 + 一句去向。 */
    var farmBox = '<div class="op-zone"><div class="op-zone-t">种田秘境</div>' +
      '<div class="op-row">' +
        '<button class="btn gold" data-action="open-farm">🌾 进入秘境</button>' +
        '<span class="op-hint">个人田庄：种灵植，收高阶打造材料与资质灵草</span>' +
      '</div></div>';

    /* v29（需求 6）：队列总览从「公文」迁到这里 —— 建造/募兵本就属城务 */
    /* v65：队列只列前 4 条（多的给一行摘要）—— 面板高度因此可控 */
    var queueBox = '<div class="op-zone"><div class="op-zone-t">在办事项 · 建造 / 募兵 / 自动 / 行军</div>' +
      ui.queueBody(4) + '</div>';""",
    'U3 官府·秘境入口',
)

patch(
    UI,
    """    ui.openModal(head + body + yieldBox + spBox + queueBox +""",
    """    ui.openModal(head + body + farmBox + yieldBox + spBox + queueBox +""",
    'U4 官府·拼接 farmBox',
)

print()
print('========== ③ 秘境界面（ui.js） ==========')

patch(
    UI,
    """    return html;
  };
})();""",
    """    return html;
  };

  /* ============================================================
   * 种田秘境（v73 · 老板需求 3）：官府 → 另一个菜单
   * ------------------------------------------------------------
   * 「背景是个人种田空间」：整页暖土渐变（金色三元组低透明 → 四主题自适配），
   * 六格灵田。空地 → 选种（即买即种）；生长中 → 进度 + 倒计时（每秒刷新）；
   * 成熟 → 收获。面板只管展示与派发 data-action，逻辑全在 GAME.farm*（域层）。
   * ============================================================ */
  ui.openFarm = function () {
    ui.openModal('<div class="ui-page farm-space">' + ui.farmHTML() + '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };
  ui.farmHTML = function () {
    var f = GAME.farmOf();
    var ripeN = 0;
    var cells = f.plots.map(function (p, i) {
      var st = GAME.farmPlotState(i);
      var body, act = '';
      if (st.state === 'empty') {
        body = '<div class="farm-ic">🟫</div><div class="farm-crop">空地</div>' +
          '<div class="farm-sub">待播种</div>';
        act = '<button class="btn sm gold" data-action="farm-seeds" data-idx="' + i + '">播种</button>';
      } else if (st.state === 'growing') {
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="pbar"><i data-farm-bar="' + i + '" style="width:' + st.pct + '%;"></i></div>' +
          '<div class="farm-sub" data-farm-left="' + i + '">成熟还需 ' +
            U.durExact(st.left / GAME.timeScale()) + '</div>';
      } else {
        ripeN++;
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="farm-sub" style="color:var(--gold-light);">✨ 已成熟</div>';
        act = '<button class="btn sm gold" data-action="farm-harvest" data-idx="' + i + '">收获</button>';
      }
      return '<div class="farm-cell' + (st.state === 'ripe' ? ' ripe' : '') + '">' + body + act + '</div>';
    }).join('');
    return '<div class="gold-heading">🌾 种田秘境</div>' +
      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种下即扣黄金，生长走游戏时间</div>' +
      '<div class="farm-grid">' + cells + '</div>' +
      (ripeN
        ? '<div class="op-row" style="justify-content:flex-end;">' +
            '<button class="btn gold" data-action="farm-harvest-all">一键收获（' + ripeN + '）</button></div>'
        : '') +
      '<div class="op-zone"><div class="op-zone-t">作物与去向</div>' +
        '<div class="attr"><span class="k">材料作物</span><span class="v">3 阶打造主料（镔铁 / 檀木 / 犀革 / 蛟筋 / 羊脂玉 / 蜀锦），有机率出 4 阶</span></div>' +
        '<div class="attr"><span class="k">灵草作物</span><span class="v">蕴灵草 / 洗髓芝 / 化龙参 / 天授果 —— 将领资质逐档提升</span></div>' +
        '<div class="attr"><span class="k">去向</span><span class="v">材料 → 铁匠铺打造；灵草 → 宝物背包 → 选将领使用</span></div>' +
      '</div>';
  };
  /* 选种弹窗：列出全部作物（6 材料 + 4 灵草），种下即扣黄金 */
  ui.openFarmSeeds = function (idx) {
    var city = GAME.currentCity();
    var R = GAME.res(city);
    var rows = (DATA.FARM.crops || []).map(function (c) {
      var afford = (R.gold || 0) >= c.seed;
      var yieldTxt;
      if (c.herb) {
        yieldTxt = '收 灵草 ×1（将领资质提升一档）';
      } else {
        var m3 = DATA.MATERIAL_BY_ID[c.mat] || {};
        var m4 = DATA.MATERIAL_BY_ID[c.rare] || {};
        yieldTxt = '收 ' + (m3.name || c.mat) + ' ×' + c.qty[0] + '~' + c.qty[1] +
          '（' + Math.round((c.rareP || 0.15) * 100) + '% 出 ' + (m4.name || c.rare) + '）';
      }
      return '<div class="farm-seed">' +
        '<div class="farm-ic">' + c.icon + '</div>' +
        '<div class="farm-seed-main">' +
          '<div class="farm-crop">' + c.name + '</div>' +
          '<div class="farm-sub">' + U.escape(c.desc) + '</div>' +
          '<div class="farm-sub">⏱ ' + c.hours + ' 游戏小时　' + yieldTxt + '</div>' +
        '</div>' +
        '<button class="btn sm' + (afford ? ' gold' : '') + '" data-action="farm-plant" data-idx="' + idx +
          '" data-crop="' + c.id + '"' + (afford ? '' : ' disabled') + '>' +
          (afford ? '种下 · ' + U.fmt(c.seed) + ' 金' : '金 ' + U.fmt(c.seed) + ' 不足') + '</button>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🌱 第 ' + (idx + 1) + ' 块地 · 选种</div>' +
      '<div class="ui-sub" style="text-align:center;">种下即扣黄金；成熟后回秘境面板收获。</div>' +
      rows +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };
})();""",
    'U5 秘境界面（openFarm / openFarmSeeds）',
)

print()
print('========== ③ 主循环刷新 + 类型映射（ui.js） ==========')

patch(
    UI,
    """    var bars = document.querySelectorAll('[data-build-bar]');
    for (var b = 0; b < bars.length; b++) {
      var bk = bars[b].getAttribute('data-build-bar');
      var bp = bk.split(':');
      var pr = GAME.buildProgress(bp[0], Number(bp[1]));
      bars[b].style.width = (pr ? pr.pct : 100) + '%';
    }
  };""",
    """    var bars = document.querySelectorAll('[data-build-bar]');
    for (var b = 0; b < bars.length; b++) {
      var bk = bars[b].getAttribute('data-build-bar');
      var bp = bk.split(':');
      var pr = GAME.buildProgress(bp[0], Number(bp[1]));
      bars[b].style.width = (pr ? pr.pct : 100) + '%';
    }
    /* v73：种田秘境 —— 面板开着时倒计时每秒走、成熟即换出「收获」按钮
       （与征收冷却同一套"弹窗不整页重绘、靠这里每秒同步"的口径）。 */
    var fLeft = document.querySelectorAll('[data-farm-left]');
    for (var f1 = 0; f1 < fLeft.length; f1++) {
      var fi1 = Number(fLeft[f1].getAttribute('data-farm-left'));
      var fs1 = GAME.farmPlotState(fi1);
      fLeft[f1].textContent = fs1.state === 'ripe'
        ? '✨ 已成熟'
        : ('成熟还需 ' + U.durExact(fs1.left / GAME.timeScale()));
    }
    var fBars = document.querySelectorAll('[data-farm-bar]');
    for (var f2 = 0; f2 < fBars.length; f2++) {
      var fi2 = Number(fBars[f2].getAttribute('data-farm-bar'));
      fBars[f2].style.width = GAME.farmPlotState(fi2).pct + '%';
    }
    if (document.querySelector('.farm-space')) {
      var fr = GAME.farmOf(), ripeN = 0;
      for (var f3 = 0; f3 < fr.plots.length; f3++) {
        if (GAME.farmPlotState(f3).state === 'ripe') ripeN++;
      }
      var shownN = document.querySelectorAll('.farm-cell [data-action="farm-harvest"]').length;
      if (ripeN !== shownN) ui.openFarm();
    }
  };""",
    'U6 updateProgress 秘境同步',
)

patch(
    UI,
    """    var CN = {
      jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',
      boost: '加速', exp: '经验', stamina: '体力精力', perm: '永久丹药', mount_buff: '坐骑',
    };""",
    """    var CN = {
      jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',
      boost: '加速', exp: '经验', stamina: '体力精力', perm: '永久丹药', mount_buff: '坐骑',
      rank_up: '灵草（提升资质）',
    };""",
    'U7 背包分类加 灵草',
)

patch(
    UI,
    """      exp: '📗', stamina: '🧪', perm: '💊', mount_buff: '🐎', attr_buff: '🔯',""",
    """      exp: '📗', stamina: '🧪', perm: '💊', mount_buff: '🐎', attr_buff: '🔯',
      rank_up: '🌿',""",
    'U8 宝物图标加 灵草',
)

patch(
    UI,
    """      var needGen = ['jewel', 'attr_buff', 'exp', 'stamina', 'perm', 'mount_buff'].indexOf(item.type) >= 0;""",
    """      var needGen = ['jewel', 'attr_buff', 'exp', 'stamina', 'perm', 'mount_buff', 'rank_up'].indexOf(item.type) >= 0;""",
    'U9 needGen 加 灵草',
)

print()
print('========== ③ 动作分发（main.js） ==========')

patch(
    MAIN,
    """      case 'open-guanfu': ui.openGuanfu(); break;""",
    """      case 'open-guanfu': ui.openGuanfu(); break;
      /* v73（老板需求 3）：种田秘境（官府 → 另外一个菜单）。
         播种 / 收获后**留在秘境里刷新** —— 地块状态变化要立刻看得见。 */
      case 'open-farm': ui.openFarm(); break;
      case 'farm-seeds': ui.openFarmSeeds(Number(el.dataset.idx)); break;
      case 'farm-plant': {
        var fpr = GAME.farmPlant(Number(el.dataset.idx), el.dataset.crop);
        ui.toast(fpr.msg);
        if (fpr.ok) { GAME.refreshAll(); ui.openFarm(); }
        break;
      }
      case 'farm-harvest': {
        var fhr = GAME.farmHarvest(Number(el.dataset.idx));
        ui.toast(fhr.msg);
        if (fhr.ok) { GAME.refreshAll(); ui.openFarm(); }
        break;
      }
      case 'farm-harvest-all': {
        var far = GAME.farmHarvestAll();
        ui.toast(far.msg);
        if (far.ok) { GAME.refreshAll(); ui.openFarm(); }
        break;
      }""",
    'M1 秘境动作分发',
)

print()
print('========== ⑤ + ③ 样式（index.html） ==========')

patch(
    HTML,
    """  .bldg-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px;
    margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--line-strong); }
  .bldg-foot .btn.sm { font-size: var(--fs-cap); padding: 3px 9px; }""",
    """  /* v73（老板）：「取消升级和关闭按钮要固定在底部，对不同建筑来说位置都要固定」——
      **吸底**：正文再长，底栏也钉在弹窗下沿（sticky），六处建筑弹窗同一位置。
      负边距 = .inner-panel 的 padding(12px)：出血到面板边缘，滚过底下的内容被盖住。 */
  .bldg-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px;
    position: sticky; bottom: 0; z-index: 3;
    margin: 12px -12px -12px; padding: 8px 12px 10px;
    border-top: 1px solid var(--line-strong);
    background: var(--panel-bg);
    box-shadow: 0 -6px 12px rgba(var(--sh-rgb),.28); }
  .bldg-foot .btn.sm { font-size: var(--fs-cap); padding: 3px 9px; }""",
    'H1 bldg-foot 吸底',
)

patch(
    HTML,
    """  /* 弹窗身份图标尺寸盒（v72 · 老板报障「官府升级中点击 → 内容很大、下拉+左右拉框」）：
     位图 <img class="ico"> 缺容器尺寸规则时按**固有尺寸 1024px** 渲染，把弹窗撑爆。
     口径与 .tile-art/.ticon 一致：容器负责尺寸：1em 跟随 span 的内联图标字号（"仅剩图标"的裸像素用法，见 smoke 审计）。 */
  .dlg-ico { display: inline-block; line-height: 1; }
  .dlg-ico .ico { width: 1em; height: 1em; display: inline-block; vertical-align: middle; }

  /* ============ 提示条 toast ============ */""",
    """  /* ============ 种田秘境（v73 · 老板需求 3） ============
     「背景是个人种田空间」：整页暖土渐变（金色三元组低透明 → 四主题自动适配），
     六格灵田；生长中是进度条 + 倒计时（每秒由 ui.updateProgress 刷新）。
     （v72 的 .dlg-ico 尺寸盒随「顶部图标块撤除」一起退役 —— 没有图标，就没有 1024px。） */
  .farm-space {
    background:
      radial-gradient(120% 70% at 50% 0%, rgba(var(--gold-rgb),.10), transparent 62%),
      linear-gradient(180deg, rgba(var(--gold-rgb),.06), rgba(var(--sh-rgb),.10));
    border: 1px solid var(--line-strong); border-radius: var(--r-lg);
  }
  .farm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); margin: var(--sp-4) 0; }
  .farm-cell {
    display: flex; flex-direction: column; gap: var(--sp-2); align-items: center; text-align: center;
    background: linear-gradient(180deg, rgba(var(--gold-rgb),.10), rgba(var(--gold-rgb),.02));
    border: 1px solid var(--line-strong); border-radius: var(--r-md);
    padding: var(--sp-4) var(--sp-3);
  }
  .farm-cell .pbar { width: 100%; }
  .farm-cell.ripe { border-color: var(--gold); box-shadow: 0 0 10px rgba(var(--gold-rgb),.30); }
  .farm-ic { font-size: 2.2em; line-height: 1.1; }
  .farm-crop { color: var(--gold-light); font-weight: 700; font-size: var(--fs-lead); }
  .farm-sub { color: var(--text-dim); font-size: var(--fs-sub); }
  .farm-seed {
    display: flex; align-items: center; gap: var(--sp-4);
    background: rgba(var(--sh-rgb),.22); border: 1px solid var(--line-strong);
    border-radius: var(--r-md); padding: var(--sp-4); margin-bottom: var(--sp-3);
  }
  .farm-seed .farm-ic { font-size: 1.6em; }
  .farm-seed-main { flex: 1; min-width: 0; }

  /* ============ 提示条 toast ============ */""",
    'H2 dlg-ico 退役 + 秘境样式',
)

print()
print('========== UI 层补丁完成 ==========')
