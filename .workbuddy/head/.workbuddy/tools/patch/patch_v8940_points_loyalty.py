# -*- coding: utf-8 -*-
"""v89.40 补丁 1/3：代码层
① 自由属性点支持一次加 N 点（qty 透传：state 出口 + ui 弹窗 + main 分发）
② 君主不掉忠（battle 战败守卫）+ 详情/悬停不出忠诚行（ui）
"""
import io, os, sys

R = r'E:\Deepseekdb'
S = R + r'\js\state.js'
U = R + r'\js\ui.js'
M = R + r'\js\main.js'
B = R + r'\js\battle.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8940'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


# ============ ① state.js：addFreePoint 批量 ============
edit(S, r'''  GAME.addFreePoint = function (g, stat) {
    if (!g || ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'].indexOf(stat) < 0) {
      return { ok: false, msg: '该属性不支持加点' };
    }
    if ((g.freePts || 0) < 1) {
      return { ok: false, msg: '自由属性点不足（升级获得：每级 = 资质成长值）' };
    }
    g.freePts -= 1;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + 1;
    else if (stat === 'sta') g.staAdd = (g.staAdd || 0) + 1;
    else g[stat] = (g[stat] || 0) + 1;
    GAME.log('🎯 ' + g.name + ' ' + nm + ' +1（自由点 -1，余 ' + g.freePts + '）');
    return { ok: true, msg: g.name + ' ' + nm + ' +1（余 ' + g.freePts + ' 点）' };
  };''', r'''  /* v89.40（老板）：「输入计划增加的数量，一次加点」—— qty 缺省 1（单点口径不变），
     超过余额按余额截断（回报实加的数字）。唯一出口不变，仍是本函数。 */
  GAME.addFreePoint = function (g, stat, qty) {
    if (!g || ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'].indexOf(stat) < 0) {
      return { ok: false, msg: '该属性不支持加点' };
    }
    var have = Math.floor(g.freePts || 0);
    if (have < 1) {
      return { ok: false, msg: '自由属性点不足（升级获得：每级 = 资质成长值）' };
    }
    var n = Math.floor(Number(qty) || 0);
    if (n < 1) n = 1;
    if (n > have) n = have;
    g.freePts -= n;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + n;
    else if (stat === 'sta') g.staAdd = (g.staAdd || 0) + n;
    else g[stat] = (g[stat] || 0) + n;
    GAME.log('🎯 ' + g.name + ' ' + nm + ' +' + n + '（自由点 -' + n + '，余 ' + g.freePts + '）');
    return { ok: true, msg: g.name + ' ' + nm + ' +' + n + '（余 ' + g.freePts + ' 点）' };
  };''', 'state.js · addFreePoint 支持 qty')

# ============ ② ui.js · 六维表脚注（改写提示） ============
edit(U, r"""'点右侧 ＋ 逐点分配，或用道具</span></td></tr>' +""",
     r"""'点右侧 ＋ 一次加点（可填数量），或用道具</span></td></tr>' +""",
     'ui.js · 六维表脚注（一次加点）')

# ============ ③ ui.js · 加点弹窗：＋1 → 数量框 + 加点 ============
edit(U, r"""        '<div class="stat-row"><span class="sr-name">🎯 消耗 1 点</span>' +
          '<span class="sr-sub">剩 ' + fp + ' 点</span>' +
          '<button class="btn sm' + (fp > 0 ? ' gold' : ' dim') + '" data-action="stat-plus-free"' +
            ' data-gen="' + genId + '" data-stat="' + stat + '"' + (fp > 0 ? '' : ' disabled') +
            ' title="' + (fp > 0 ? nm + ' +1（只增不减）' : '自由属性点不足：升级获得，每级 = 资质成长值') + '">＋1</button></div>' +""",
     r"""        /* v89.40（老板）：「输入计划增加的数量，一次加点」—— ＋1 按钮升级为
           数量框 +「加点」：单点默认 1 仍一键，批量填数或点「最多」后一次到账。 */
        '<div class="stat-row"><span class="sr-name">🎯 一次加点</span>' +
          '<span class="sr-sub">剩 ' + fp + ' 点</span>' +
          ui.qtyInput('fp-add-' + genId, 1, 0, fp) +
          '<button class="btn sm' + (fp > 0 ? ' gold' : ' dim') + '" data-action="stat-plus-free"' +
            ' data-gen="' + genId + '" data-stat="' + stat + '" data-qty-from="fp-add-' + genId + '"' +
            (fp > 0 ? '' : ' disabled') +
            ' title="' + (fp > 0 ? nm + ' 一次加点（填数量或点「最多」，只增不减）' : '自由属性点不足：升级获得，每级 = 资质成长值') + '">加点</button></div>' +""",
     'ui.js · 加点弹窗数量框')

# ============ ④ ui.js · 加点弹窗 help 补一句 ============
edit(U, r"""        ui.help('自由属性点：每升 1 级获得 = 资质成长值（凡品 +1 … 天授 +8）。\n' +
          '只能加、不能减；四项主属性另有永久丹药（商城 · 丹药），每将每项上限 50。'),""",
     r"""        ui.help('自由属性点：每升 1 级获得 = 资质成长值（凡品 +1 … 天授 +8）。\n' +
          '支持一次加多点：填数量（或点「最多」）后点「加点」；只能加、不能减。\n' +
          '四项主属性另有永久丹药（商城 · 丹药），每将每项上限 50。'),""",
     'ui.js · 加点弹窗 help')

# ============ ⑤ ui.js · genPane：君主要素（isLordGen 变量） ============
edit(U, r"""    var jewelTotal = 0;
    jewels.forEach(function (it) { jewelTotal += (s.items[it.id] || 0); });""",
     r"""    var jewelTotal = 0;
    jewels.forEach(function (it) { jewelTotal += (s.items[it.id] || 0); });
    /* v89.40（老板）：「君主不会掉忠诚」—— 忠诚行与赏赐入口对君主整体不适用
       （君主忠诚恒为 100：battle 战败守卫 + 本页不出行；普通将领一切照旧）。 */
    var isLordGen = GAME.isLordGeneral(g);""",
     'ui.js · isLordGen 变量')

# ============ ⑥ ui.js · genPane：忠诚行对君主整体不出 ============
edit(U, r"""      '<div class="gd-line">忠诚 <b style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">🎁 赏赐</button></div>' +""",
     r"""      (isLordGen ? '' :
      '<div class="gd-line">忠诚 <b style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">🎁 赏赐</button></div>') +""",
     'ui.js · 忠诚行君主豁免')

# ============ ⑦ ui.js · genRow 悬停浮层：君主不带忠诚 ============
edit(U, r"""          '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(GAME.expNeedOf(g), 0) +
          '　忠诚 ' + Math.round(g.loyalty || 0) + '</div>' +""",
     r"""          '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(GAME.expNeedOf(g), 0) +
          (GAME.isLordGeneral(g) ? '' : '　忠诚 ' + Math.round(g.loyalty || 0)) + '</div>' +""",
     'ui.js · 悬停浮层君主豁免')

# ============ ⑧ main.js · 分发带上 qty ============
edit(M, r"""      case 'stat-plus-free': GAME.doStatPlusFree(el.dataset.gen, el.dataset.stat); break;""",
     r"""      /* v89.40（老板）：加点支持一次加 N 点 —— qty 来自加点弹窗的数量框（缺省 1） */
      case 'stat-plus-free':
        GAME.doStatPlusFree(el.dataset.gen, el.dataset.stat,
          el.dataset.qtyFrom ? ui.qtyValueOf(el.dataset.qtyFrom) : 1);
        break;""",
     'main.js · stat-plus-free 带 qty')

# ============ ⑨ main.js · doStatPlusFree 接 qty ============
edit(M, r"""  /* v74（老板需求 5）：自由属性点分配（唯一出口 GAME.addFreePoint）；分配后留在弹窗里刷新 */
  GAME.doStatPlusFree = function (genId, stat) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var r = GAME.addFreePoint(g, stat);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openStatPlus(genId, stat); }
  };""",
     r"""  /* v74（老板需求 5）：自由属性点分配（唯一出口 GAME.addFreePoint）；分配后留在弹窗里刷新 */
  /* v89.40（老板）：支持一次加 N 点（qty 来自加点弹窗的数量框，缺省 1） */
  GAME.doStatPlusFree = function (genId, stat, qty) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var r = GAME.addFreePoint(g, stat, qty);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openStatPlus(genId, stat); }
  };""",
     'main.js · doStatPlusFree 接 qty')

# ============ ⑩ battle.js · 战败扣忠：君主豁免 ============
edit(B, r"""      var lLoss = (DATA.LOYALTY && DATA.LOYALTY.defeatLoss) || 8;
      var lBefore = gen.loyalty == null ? 70 : gen.loyalty;
      gen.loyalty = Math.max(0, lBefore - lLoss);
      GAME.log((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）'
        + '，' + gen.name + ' 忠诚 -' + lLoss + '（现 ' + Math.round(gen.loyalty) + '）');
      if (gen.loyalty < (DATA.LOYALTY.warnAt || 50)) {
        GAME.log('⚠️ ' + gen.name + ' 忠诚已低于 ' + DATA.LOYALTY.warnAt + '，加成减半，宜以珠宝赏赐安抚。');
      }""",
     r"""      var lLoss = (DATA.LOYALTY && DATA.LOYALTY.defeatLoss) || 8;
      var lBefore = gen.loyalty == null ? 70 : gen.loyalty;
      /* v89.40（老板）：「君主不会掉忠诚」—— 战败挫伤不适用于君主
         （与「不可解雇 / 绝不离去」同源：忠诚对君主无意义，详情页也不再出忠诚行）。 */
      if (GAME.isLordGeneral(gen)) {
        GAME.log((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）');
      } else {
        gen.loyalty = Math.max(0, lBefore - lLoss);
        GAME.log((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）'
          + '，' + gen.name + ' 忠诚 -' + lLoss + '（现 ' + Math.round(gen.loyalty) + '）');
        if (gen.loyalty < (DATA.LOYALTY.warnAt || 50)) {
          GAME.log('⚠️ ' + gen.name + ' 忠诚已低于 ' + DATA.LOYALTY.warnAt + '，加成减半，宜以珠宝赏赐安抚。');
        }
      }""",
     'battle.js · 君主战败豁免')

print('\nALL DONE（10 处）')
