# -*- coding: utf-8 -*-
"""v89.131 补丁 E1：ui.js —— genPane 状态区改造
① enMx 改走 GAME.energyMaxOf（六维公式）
② 自由属性点备注（gd-free-hint）去掉
③ 行序：体力 → 精力 → 攻击 → 防御 → 忠诚（最底）；体力/精力各带「＋」道具入口
④ 解雇按钮从 .gp-ops 移到人名行右侧（.gp-nameops）
用法：python patch_v89131e1_ui_pane.py
"""
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    c = s.count(old)
    assert c == 1, '[%s] 锚点 %d 处（需 1）' % (tag, c)
    s = s.replace(old, new)
    n += 1
    print('  OK ' + tag)


# ---------- ① enMx 唯一出口 ----------
rep("""    /* v89.116：原写 `GAME.energyMax`（不存在）→ 上限恒 100。
       真出口 = `GAME.staMax`（等级/资质/内政 + 装备与套装体力，见 domain.js 的注释）。 */
    var enMx = GAME.staMax ? GAME.staMax(g) : 100;""",
"""    /* v89.131（老板「精力的数值设定基于六维设计一个公式」）：
       上限 = GAME.energyMaxOf（六维加权公式，domain.js 唯一出口）。
       沿革：v89.116 曾借 `staMax` 当上限（GAME.energyMax 不存在）——
       那让"精力/上限"跟着体力涨而回复段又硬顶 100（两口径），本轮一并收口。 */
    var enMx = GAME.energyMaxOf(g);
    var enNow = GAME.energyNowOf(g);
    var eParts = GAME.energyPartsOf(g);
    var energyTip = '精力上限 ' + enMx + ' = 基准 ' + eParts.base
      + eParts.items.map(function (x) {
          return ' ＋ ' + x.n + ' ' + x.val + '×' + ((DATA.ENERGY.per || {})[x.k] || 0) + '=' + x.v;
        }).join('')
      + '\\n（六维公式 · DATA.ENERGY）回复：现实时间 '
      + ((DATA.GEN_COST.recoverHours || 24)) + ' 小时回满（与倍速无关）';""",
    'enMx 唯一出口')

# ---------- ② 去掉自由属性点备注 ----------
rep("""        /* v74（老板需求 5）：「增加一行自由属性点，用于玩家自行决定加点」 */
        '<tr class="gd-freep"><td colspan="3">自由属性点 <b class="fp-n">' +
          Math.round(g.freePts || 0) + '</b><span class="gd-free-hint">升级获得（每级 = 成长值）　' +
          '点右侧 ＋ 一次加点（可填数量），或用道具</span></td></tr>' +""",
"""        /* v74（老板需求 5）：「增加一行自由属性点，用于玩家自行决定加点」
           v89.131（老板）：「备注去掉：升级获得（每级 = 成长值）…或用道具」
           —— 说明文案撤下，只留数字（点右侧「＋」自然知道怎么用）。 */
        '<tr class="gd-freep"><td colspan="3">自由属性点 <b class="fp-n">' +
          Math.round(g.freePts || 0) + '</b></td></tr>' +""",
    '自由属性点备注')

# ---------- ③ 状态区：行序 + 加号 ----------
rep("""    var isLordGen = GAME.isLordGeneral(g);
    html += '<div class="gp-sec">状态</div>' +
      /* v20（需求 5）的规矩在这里同样适用：**页面只放信息型内容**，
         "出征消耗 / 低于 25 不可出征 / 侦查消耗"这类**规则解说**不常驻页面。 */
      (isLordGen ? '' :
      '<div class="gd-line">忠诚 <b style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">🎁 赏赐</button></div>') +
      /* 攻击 / 防御：**合计值 + 构成**（勇武 3,300 ＋ 装备 8,148 = 11,448）——
         老板要的"总数"，同时一眼能看出装备贡献了多少，不必再单列一行。
         v66：**体力同口径** —— 主数字改成"总体体力"（= 上限，含装备与套装），
         当前值退到右边括号里。改前主数字是"当前值"，于是老板看到
         「装备栏写着体力 +600，六维/状态里的体力却一点没变」→
         「部分将领的体力没有加上装备的数值」。 */
      '<div class="gd-line">攻击 <b>' + U.numText(a.atkVal, 0) + '</b>' +
        '<span class="gd-hint">勇武 ' + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' +
          U.numText(a.atk, 0) + '</span>' +
        '<span class="gd-hint">全军攻击 <b style="color:var(--green-ok);">+' + atkShow + '%</b></span></div>' +
      '<div class="gd-line">防御 <b>' + U.numText(a.defVal, 0) + '</b>' +
        '<span class="gd-hint">智谋 ' + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' +
          U.numText(a.def, 0) + '</span>' +
        '<span class="gd-hint">全军防御 <b style="color:var(--green-ok);">+' + defShow + '%</b></span></div>' +
      /* v66：主数字 = 总体体力（上限，含装备与套装）；当前值单独写在右边。
         装备构成（等级/资质/内政多少 + 装备多少）进 title ——
         1366/1280 下三组小字会把这一行挤成两行（几何探针实测 41px vs 17px），
         而装备贡献的逐行清单本来就在右栏「装备提供」里，不必在这里再说一遍。 */
      '<div class="gd-line" title="体力上限 ' + U.numText(staMx, 0) + ' = 等级/资质/内政 '
        + U.numText(staMx - staEqNow, 0) + ' ＋ 装备 ' + U.numText(staEqNow, 0) + '">体力 <b>'
        + U.numText(staMx, 0) + '</b>' + bar(staPct, '#6a9a4a') +
        '<span class="gd-hint">当前 ' + U.numText(staNow, 0) +
          '　全军生命 <b style="color:var(--green-ok);">+' + hpBonus + '%</b></span></div>' +
      '<div class="gd-line">精力 <b>' + Math.round(g.energy || 0) + '</b>' +
        bar((g.energy || 0) / Math.max(1, enMx) * 100, '#4a9be0') +
        '<span class="gd-hint">' + Math.round(g.energy || 0) + ' / ' + Math.round(enMx) + '</span></div>';""",
"""    var isLordGen = GAME.isLordGeneral(g);
    /* v89.131（老板）：「体力精力应当设计加号按钮，供道具使用，参考赏赐」
       —— 两个「＋」的选择窗与赏赐同构：选项来自 DATA.ITEMS + 背包，不复制配置。 */
    var staItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'stamina' && (s.items || {})[it.id] > 0;
    });
    var staHave = 0;
    staItems.forEach(function (it) { staHave += (s.items[it.id] || 0); });
    var enItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'energy' && (s.items || {})[it.id] > 0;
    });
    var enHave = 0;
    enItems.forEach(function (it) { enHave += (s.items[it.id] || 0); });
    /* v89.131（老板）：「体力，精力列在攻击，防御上方。…忠诚列在最下方」
       —— 新行序：体力 → 精力 → 攻击 → 防御 → 忠诚（君主不适用忠诚行）。 */
    html += '<div class="gp-sec">状态</div>' +
      /* v20（需求 5）的规矩在这里同样适用：**页面只放信息型内容**，
         "出征消耗 / 低于 25 不可出征 / 侦查消耗"这类**规则解说**不常驻页面。
         v66：主数字 = 总体体力（上限，含装备与套装）；当前值单独写在右边。 */
      '<div class="gd-line" title="体力上限 ' + U.numText(staMx, 0) + ' = 等级/资质/内政 '
        + U.numText(staMx - staEqNow, 0) + ' ＋ 装备 ' + U.numText(staEqNow, 0)
        + '\\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）">体力 <b>'
        + U.numText(staMx, 0) + '</b>' + bar(staPct, '#6a9a4a') +
        '<span class="gd-hint">当前 ' + U.numText(staNow, 0) +
          '　全军生命 <b style="color:var(--green-ok);">+' + hpBonus + '%</b></span>' +
        '<button class="btn sm gd-plus' + (staItems.length ? ' gold' : ' dim') + '" data-action="gen-sta-pick"' +
          ' data-gen="' + genId + '"' + (staItems.length ? '' : ' disabled') +
          ' title="' + (staItems.length ? '使用体力道具：背包 ' + staItems.length + ' 种 / ' + staHave + ' 件'
            : '背包中暂无体力道具。商城「体力」页签可购') + '">＋</button></div>' +
      /* 精力：主数字 = 当前值；上限由六维公式给出（悬停给逐项分解，同源 energyPartsOf） */
      '<div class="gd-line" title="' + U.escape(energyTip) + '">精力 <b>' + U.numText(enNow, 0) + '</b>' +
        bar(enNow / Math.max(1, enMx) * 100, '#4a9be0') +
        '<span class="gd-hint">' + U.numText(enNow, 0) + ' / ' + U.numText(enMx, 0) + '</span>' +
        '<button class="btn sm gd-plus' + (enItems.length ? ' gold' : ' dim') + '" data-action="gen-energy-pick"' +
          ' data-gen="' + genId + '"' + (enItems.length ? '' : ' disabled') +
          ' title="' + (enItems.length ? '使用精力道具：背包 ' + enItems.length + ' 种 / ' + enHave + ' 件'
            : '背包中暂无精力道具。商城「精力」页签可购') + '">＋</button></div>' +
      /* 攻击 / 防御：**合计值 + 构成**（勇武 3,300 ＋ 装备 8,148 = 11,448）——
         老板要的"总数"，同时一眼能看出装备贡献了多少，不必再单列一行。 */
      '<div class="gd-line">攻击 <b>' + U.numText(a.atkVal, 0) + '</b>' +
        '<span class="gd-hint">勇武 ' + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' +
          U.numText(a.atk, 0) + '</span>' +
        '<span class="gd-hint">全军攻击 <b style="color:var(--green-ok);">+' + atkShow + '%</b></span></div>' +
      '<div class="gd-line">防御 <b>' + U.numText(a.defVal, 0) + '</b>' +
        '<span class="gd-hint">智谋 ' + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' +
          U.numText(a.def, 0) + '</span>' +
        '<span class="gd-hint">全军防御 <b style="color:var(--green-ok);">+' + defShow + '%</b></span></div>' +
      /* v89.131（老板）：「忠诚列在最下方」—— 行序末位；赏赐入口仍在它右侧。 */
      (isLordGen ? '' :
      '<div class="gd-line">忠诚 <b style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">🎁 赏赐</button></div>');""",
    '状态区重排+加号')

# ---------- ④ 解雇移入人名行 ----------
rep("""          (GAME.isLordGeneral(g) ? '' :
            '<button class="btn sm" data-action="dismiss-gen" data-gen="' + genId + '">解雇</button>') +
        '</span>' +""",
"""        '</span>' +""",
    '解雇移出 gp-ops')

rep("""          '<b class="gp-name">' + U.escape(g.name) +
            (g.hero ? '<span class="gcard-tag hero">史实名将</span>' : '') +
            (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + statusTag74 + '</b>' +""",
"""          '<b class="gp-name">' + U.escape(g.name) +
            (g.hero ? '<span class="gcard-tag hero">史实名将</span>' : '') +
            (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + statusTag74 +
            /* v89.131（老板）：「解雇放在人名所在行右侧，稍带点距离」——
               从身份行右侧的操作列移进人名行（margin-left:auto 推到行右缘，
               padding-left 留出与姓名/标签的间距）。君主不给（v70 不可解雇）。 */
            (GAME.isLordGeneral(g) ? '' :
              '<span class="gp-nameops"><button class="btn sm" data-action="dismiss-gen"' +
                ' data-gen="' + genId + '">解雇</button></span>') +
          '</b>' +""",
    '解雇移入人名行')

assert s != orig and n == 5, 'n=%d' % n
assert 'gp-nameops' in s and 'gd-free-hint' not in s and 'gen-sta-pick' in s
assert s.count('gd-line">忠诚') == 1 and s.count('gd-line">攻击') == 1
assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch E1(ui/pane) OK · %d 处（LF 保持）' % n)
