# -*- coding: utf-8 -*-
"""v89.140 批四（重写）：铁匠铺（多按钮/分页到底/固定卡）· 商城（简介悬停）· 背包宝物（7 列格）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks, braces=True):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:30]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    if braces:
        assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp140'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:60]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


patch('js/ui.js', [
    # ① bagCell：支持 data-view（"指路类"格子要用）
    ("""  ui.bagCell = function (o) {
    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '');""",
     """  ui.bagCell = function (o) {
    /* v89.140：补 `data-view`（"指路类"用品的格子 → bag-go 需要目标视图） */
    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' + (o.view ? ' data-view="' + o.view + '"' : '') : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '');""",
     'bagCell 支持 view'),

    # ② 铁匠铺建筑功能：改数组
    ("""    tiejiangpu: { label: "⚒️ 打造", act: "open-forge" },""",
     """    /* v89.140（老板 4）：「铁匠铺建筑菜单界面，**新增一行增加一个百炼强化按钮**，
       与打造菜单格式相同。将打造界面里的百炼强化按钮删去」——
       铁匠铺格上直接出现两颗功能键（打造 / 百炼强化），打造面板底部不再挂它。 */
    tiejiangpu: [{ label: "⚒️ 打造", act: "open-forge" },
      { label: "⚒️ 百炼强化", act: "open-enhance" }],""",
     'BLDG_FUNC 铁匠铺双按钮'),

    # ③ 消费点支持数组
    ("""        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            /* ⛔ v89.138（老板 4）：标题行撤除（同上） */
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>' +
            '</div>' +
          '</div>') : ''; })() +""",
     """        (function () {
          /* v89.140：条目可以是**单条**或**数组**（铁匠铺 = 打造 + 百炼强化两颗） */
          var fs = [].concat(BLDG_FUNC[b.id] || []);
          if (!fs.length) return '';
          return '<div class="op-zone">' +
            /* ⛔ v89.138（老板 4）：标题行撤除（同上） */
            '<div class="op-row">' + fs.map(function (f) {
              return '<button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
                (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>';
            }).join('') + '</div>' +
          '</div>';
        })() +""",
     '消费点支持数组'),

    # ④ openForge：分页到底 + 删百炼按钮
    ("""        (rows.length ? '<div class="forge-rows">' + pg.slice.map(function (f) { return ui.forgeRow(f, lv); }).join('') + '</div>'
          : '<div class="q-empty">' + (kind === 'set' ? '该品质暂无套装件。'
            : kind === 'solo' ? '该品质暂无散件。' : '该品质暂无可打造之物。') + '</div>') +
        (rows.length ? pg.pager : ''),""",
     """        (rows.length ? '<div class="forge-rows">' + pg.slice.map(function (f) { return ui.forgeRow(f, lv); }).join('') + '</div>'
          : '<div class="q-empty">' + (kind === 'set' ? '该品质暂无套装件。'
            : kind === 'solo' ? '该品质暂无散件。' : '该品质暂无可打造之物。') + '</div>'),""",
     'openForge 去正文分页'),
    ("""      foot: '<div class="m-foot">' +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled') + '>⚒ 打造' +
          (selF ? '：' + U.escape(selF.item.name) : '（先在下方点选一件）') + '</button>' +
        (selF && selWhy ? '<span class="op-hint">' + U.escape(selWhy) + '</span>' : '') +
        '<button class="btn" data-action="open-enhance">⚒ 百炼强化</button>' +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
     """      /* v89.140（老板 5）：「翻页设置放在当前界面的**底部**」——分页条从正文末尾
         挪到 foot（弹窗下沿固定区），翻页不用再滚到底。
         v89.140（老板 4）：底部的「百炼强化」按钮**删去**（已搬到铁匠铺建筑菜单上）。 */
      foot: '<div class="m-foot">' + (rows.length ? pg.pager : '') +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled') + '>⚒ 打造' +
          (selF ? '：' + U.escape(selF.item.name) : '（先在下方点选一件）') + '</button>' +
        (selF && selWhy ? '<span class="op-hint">' + U.escape(selWhy) + '</span>' : '') +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
     'openForge 分页到底+删按钮'),

    # ⑤ itemRow：desc 悬停支持
    ("""    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + (o.sel ? ' on' : '') + '"' + pick + '>' +
      '<div class="ir-art">' + ui.itemArt(o.kind, o.id, o.q) + '</div>' +
      '<div class="ir-info">' +
        '<div class="ir-name">' + o.name + (o.tagHtml || '') + '</div>' +
        '<div class="ir-meta">' + (o.meta || '') + '</div>' +
        (o.desc ? '<div class="ir-desc">' + o.desc + '</div>' : '') +
      '</div>' +""",
     """    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + (o.sel ? ' on' : '') + '"' + pick + '>' +
      '<div class="ir-art">' + ui.itemArt(o.kind, o.id, o.q) + '</div>' +
      /* v89.140（老板 6）：「物品简介改**悬停显示**」——hoverDesc 时 desc 走 title
         （卡片内不再占一行 → 卡片等高、位置固定）。 */
      '<div class="ir-info"' + ((o.hoverDesc && o.desc)
        ? ' title="' + U.escape(String(o.desc).replace(/<[^>]+>/g, '')) + '"' : '') + '>' +
        '<div class="ir-name">' + o.name + (o.tagHtml || '') + '</div>' +
        '<div class="ir-meta">' + (o.meta || '') + '</div>' +
        ((!o.hoverDesc && o.desc) ? '<div class="ir-desc">' + o.desc + '</div>' : '') +
      '</div>' +""",
     'itemRow 悬停简介'),

    # ⑥ 商城：desc 走悬停
    ("""        meta: '单价 <b>' + U.numText(price, 0) + '</b> 金　持有 ' + U.numText(have, 0),
        desc: '<span style="color:var(--gold-light);">' +
          U.escape(GAME.itemEffect(it) || '') + '</span>',""",
     """        meta: '单价 <b>' + U.numText(price, 0) + '</b> 金　持有 ' + U.numText(have, 0),
        desc: GAME.itemEffect(it) || '',
        hoverDesc: true,          /* v89.140（老板 6）：简介悬停显示（卡片固定高、位置固定） */""",
     '商城 desc 悬停'),

    # ⑦ 背包宝物：整段换 bagCell（不留旧代码）
    ("""      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var inputId = 'ui-' + it.id;
        /* v89.104（老板）：去处由 ITEM_USE_ROUTE 决定 ——
           direct = 就地使用；其余 = 指路（按钮文案与提示都从表里取，不在卡里硬编码）。 */
        var route = ui.itemRouteOf(it);
        var actHtml;
        if (route.direct) {
          actHtml = '<button class="btn gold" data-action="use-bag-item" data-key="' + it.id +
            '" data-qty-from="' + inputId + '">使用</button>';
        } else if (route.act) {
          actHtml = '<button class="btn" data-action="' + route.act + '">' + route.btn + '</button>';
        } else {
          actHtml = '<button class="btn" data-action="bag-go" data-view="' + route.view + '">' + route.btn + '</button>';
        }
        rows.push(ui.itemRow({
          kind: 'item', id: it.id, q: 1,
          name: U.escape(it.name),
          tagHtml: '<span class="ir-tag">' + CN[tp].replace(/（.*/, '') + '</span>',
          meta: '持有 <b>' + U.numText(have, 0) + '</b>' + (it.price ? '　估值 ' + U.fmt(it.price * 100) + ' 金' : ''),
          desc: '<span style="color:var(--gold-light);">' +
            U.escape(GAME.itemEffect(it) || '') + '</span>' +
            (route.direct ? '' : '<span class="ui-sub">　↳ ' + U.escape(route.hint || '') + '</span>'),
          qtyHtml: route.direct ? ui.qtyInput(inputId, 1, 0, Math.max(1, have), true) : '',
          totalHtml: '',
          actHtml: actHtml,
        }));
      });""",
     """      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var tplName = CN[tp].replace(/（.*/, '');
        /* v89.140（老板 7）：「背包中的宝物也是，**建立统一的物品框和规格样式**，
           按每行可为 **7 个物品**并列的宽度设计。物品介绍**悬停显示**」——
           行卡片（.item-row + 数量框 + 按钮）整体退役，改与材料页同一个 `ui.bagCell`
           （统一物品框：图标 + 名称 + 数量角标 + 悬停介绍；容量条见 CSS `.bag-grid` 7 列）。
           动作按 ITEM_USE_ROUTE 分流（就地使用 / 指路），不另立规则：
             direct → 点击就地使用 1 个；route.act → 该动作；否则 → 跳到对应视图。 */
        var route = ui.itemRouteOf(it);
        var cell = {
          cls: 'q' + (((it.price || 0) >= 60) ? 4 : ((it.price || 0) >= 26) ? 3 : ((it.price || 0) >= 10) ? 2 : 1),
          ico: (GAME.icons.forItem ? GAME.icons.forItem(it.type, it.id) : '') || '💎',
          name: it.name, cnt: have,
          q: 1, noStar: true,
          title: it.name + '（' + tplName + '）',
          lore: '持有 ' + U.numText(have, 0) + (it.price ? '　估值 ' + U.fmt(it.price * 100) + ' 金' : ''),
          attr: (GAME.itemEffect(it) || '') +
            (route.direct ? '　（点击使用 1 个）' : ('　↳ ' + (route.hint || '需在对应界面使用'))),
          key: it.id,
        };
        if (route.direct) { cell.act = 'use-bag-item'; }
        else if (route.act) { cell.act = route.act; }
        else { cell.act = 'bag-go'; cell.view = route.view; }
        rows.push(ui.bagCell(cell));
      });""",
     '宝物改 bagCell'),
], ['rows.push(ui.bagCell(cell))', 'tiejiangpu: [{', 'fs.map', 'hoverDesc: true'])
print('✅ 完成：' + ' / '.join(ok))
