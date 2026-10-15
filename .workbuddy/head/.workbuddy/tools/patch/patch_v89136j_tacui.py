# -*- coding: utf-8 -*-
# v89.136 批5-c：ui.js —— 出征战术细分（掠夺/占领两小页）+ 练兵块退役 + 弹窗细分
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)
def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点 = ' + str(n)
    return s.replace(old, new)

u = rd('js/ui.js')

# ============================================================
# ① trainBlockHTML → 墓碑（整函数：从注释头到函数尾 "  };"）
# ============================================================
s0 = u.find('  /* 练兵块（演武 / 阅兵）—— 校场面板退役后的新家：出征战术页尾（练兵 = 出征前的准备）。')
assert s0 > 0, '练兵块注释头未找到'
# 函数尾：找 'ui.trainBlockHTML = function' 后的第一个 '\n  };\n'（该函数体内无同级 "  };"）
f0 = u.find('  ui.trainBlockHTML = function () {', s0)
assert f0 > s0, 'trainBlockHTML 起点未找到'
f1 = u.find('\n  };\n', f0)
assert f1 > f0, 'trainBlockHTML 尾未找到'
grave = """  /* ⛔ v89.136 移除：`ui.trainBlockHTML`（练兵块 · 演武 / 阅兵）——
     老板第 4 条：「不要练兵 · 校场这个菜单和演武和阅兵，相应功能去除」。
     随本块一并退役：动作 `xc-spar` / `xc-review` / `xc-gen-pick`（main.js 墓碑）、
     域函数组 `GAME.xcSpar / xcReview / …`（domain.js 墓碑）、数据表 `DATA.XIAOCHANG`（data.js 墓碑）。
     校场建筑本身保留（出征队列 / 每队兵力上限的限额职能不变，见 BLDG_FUNC）。 */"""
u = u[:s0] + grave + u[f1 + len('\n  };\n') - 1:]   # 保留尾部的 ';' 与换行
# 上面切片把 '  };\n' 整体删除并留 '\n' —— 复核一下（防切坏）
assert 'ui.trainBlockHTML = function' not in u, 'trainBlockHTML 未删净'

# ============================================================
# ② marchExpHTML 重写（tabs + 细分 + 删练兵调用）
# ============================================================
old2 = """    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    return '<div class="story-card"><div class="gold-heading">⚔️ 出征战术' +
      ui.help('每兵种两栏下拉：**动作**（前进 / 防御 / 后退 —— 决定初始站位与推进方式）＋ '
        + '**目标**（敌方某一兵种 / 箭塔 / 自动）。\\n'
        + '动作：前进 = 每回合推进（到射程即停）；防御 = 原地不动、**受伤减半**；'
        + '后退 = 每回合后撤（躲箭塔双倍攻击区）。\\n'
        + '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转打守军）。\\n'
        + '这里是**出征战术**：你出兵时生效；防守战术在「防守战术」页单独设。') + '</div>' +
      ui.tacticBlockHTML('atk') + '</div>' +
      ui.trainBlockHTML();
  };"""
new2 = """    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    /* v89.136（老板 4）：「出征战术**细分掠夺，占领**，分别允许进行相应的默认战术设置」——
       本页改**两小页**（掠夺 / 占领，样式与「防守战术」页内小页同构）：
       每页只设该模式下的默认战术；未单独设置的兵种**沿用通用表**（老档数据所在）。
       页面显示"生效值"（细分覆盖通用 —— 与战斗读取同一口径 GAME.tacticsFor）。 */
    var tsub = (ui._expTac === 'raid') ? 'raid' : 'occupy';
    var tabs = '<div class="def-tabs">' +
      [['occupy', '🚩 占领战术'], ['raid', '🔥 掠夺战术']].map(function (t) {
        return '<span class="dt' + (tsub === t[0] ? ' on' : '') + '" data-action="exp-tac-sub" data-v="' + t[0] +
          '">' + t[1] + '</span>';
      }).join('') + '</div>';
    return '<div class="story-card"><div class="gold-heading">⚔️ 出征战术' +
      ui.help('出征战术**按出征方式细分**（「掠夺 / 占领」两个小页分别设置）。\\n'
        + '每兵种两栏下拉：**动作**（前进 / 防御 / 后退 —— 决定初始站位与推进方式）＋ '
        + '**目标**（敌方某一兵种 / 箭塔 / 自动）。\\n'
        + '动作：前进 = 每回合推进（到射程即停）；防御 = 原地不动、**受伤减半**；'
        + '后退 = 每回合后撤（躲箭塔双倍攻击区）。\\n'
        + '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转打守军）。\\n'
        + '未单独设置的兵种**沿用通用战术**（老档的设置继续生效）；'
        + '「恢复默认」只清本小页的细分设置；防守战术在「防守战术」页单独设。') + '</div>' +
      tabs +
      '<div class="ui-sub" style="margin:2px 0 6px;">当前（' +
        (tsub === 'raid' ? '掠夺' : '占领') + '）：' + GAME.tacticSummary(tsub) + '</div>' +
      ui.tacticBlockHTML(tsub) + '</div>';
  };"""
u = rep1(u, old2, new2, '② marchExpHTML')

# ============================================================
# ③ tacticBlockOf：细分数据源（合并视图）
# ============================================================
old3 = """  ui.tacticBlockOf = function (side, id) {
    side = side === 'def' ? 'def' : 'atk';
    var isDef = side === 'def';
    var tr = DATA.TROOPS[id];
    var set = GAME.tacticsOf(side)[id] || {};"""
new3 = """  ui.tacticBlockOf = function (side, id) {
    /* v89.136（老板 4）：'raid'/'occupy' 是**出征细分页** ——
       显示走合并视图（细分覆盖通用 · 与战斗读取同一口径），写入 data-tside 落细分表。 */
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var isDef = side === 'def';
    var isSub = (side === 'raid' || side === 'occupy');
    var tr = DATA.TROOPS[id];
    var set = (isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side))[id] || {};"""
u = rep1(u, old3, new3, '③ tacticBlockOf')

# ============================================================
# ④ openTacticModal：值域 + 标题 + 说明
# ============================================================
old4 = """  ui.openTacticModal = function (side) {
    side = side === 'def' ? 'def' : 'atk';
    var isDef = side === 'def';
    var ids = ui.tacticTroopIds();"""
new4 = """  ui.openTacticModal = function (side) {
    /* v89.136（老板 4）：支持细分（'raid'/'occupy'）—— 出征面板的「逐兵种」按当前出征方式打开。 */
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var isDef = side === 'def';
    var isSub = (side === 'raid' || side === 'occupy');
    var ids = ui.tacticTroopIds();"""
u = rep1(u, old4, new4, '④a openTacticModal 头')

old5 = """    ui.openShell({
      title: isDef ? '🛡️ 防守战术' : '⚔️ 出征战术',
      sub: '当前：' + GAME.tacticSummary(side) + ui.help("""
new5 = """    ui.openShell({
      title: isDef ? '🛡️ 防守战术'
        : (side === 'raid' ? '⚔️ 出征战术 · 掠夺'
          : (side === 'occupy' ? '⚔️ 出征战术 · 占领' : '⚔️ 出征战术')),
      sub: '当前：' + GAME.tacticSummary(side) + ui.help("""
u = rep1(u, old5, new5, '④b openTacticModal 标题')

# ============================================================
# ⑤ BLDG_FUNC 校场文案（去「练兵」）
# ============================================================
old6 = """    xiaochang: { label: "🏹 进入军务（出征 · 练兵 · 伤兵）", act: "open-xiaochang" },"""
new6 = """    xiaochang: { label: "🏹 进入军务（出征 · 伤兵）", act: "open-xiaochang" },"""
u = rep1(u, old6, new6, '⑤ 校场文案')

# ---------- 写后自检 ----------
assert 'ui.trainBlockHTML = function' not in u, 'trainBlockHTML 未删净'
assert 'ui.trainBlockHTML()' not in u, 'trainBlockHTML 调用残留'
for sent in ['ui._expTac', 'data-action="exp-tac-sub"', 'GAME.tacticsFor(side) : GAME.tacticsOf(side)',
             '⚔️ 出征战术 · 掠夺']:
    assert u.count(sent) >= 1, '丢失哨兵: ' + sent

wr('js/ui.js', u)
print('OK · ui.js', len(u))
