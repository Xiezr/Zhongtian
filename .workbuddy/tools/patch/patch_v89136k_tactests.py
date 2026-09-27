# -*- coding: utf-8 -*-
# v89.136 批5-e：smoke/e2e 练兵退役 + 战术细分 断言更新 + §117 新增
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)
def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点 = ' + str(n)
    return s.replace(old, new)

s = rd('smoke-test.js')

# ============================================================
# ① 5927：校场面板退役（trainBlockHTML 改负向）
# ============================================================
old1 = """  check('校场面板退役（演武/阅兵迁「出征战术」页尾 · 伤兵营仍在军务处）',
    !/ui\\.openXiaochang = function/.test(uS34)
    && /ui\\.trainBlockHTML = function/.test(uS34)
    && /ui\\.woundedBlock = function \\(host\\)/.test(uS34));"""
new1 = """  check('校场面板退役（v89.136 起练兵块也退役 · 伤兵营仍在军务处）',
    !/ui\\.openXiaochang = function/.test(uS34)
    && !/ui\\.trainBlockHTML = function/.test(uS34)
    && /ui\\.woundedBlock = function \\(host\\)/.test(uS34));"""
s = rep1(s, old1, new1, '① 校场面板退役')

# ============================================================
# ② 5936：校场入口文案（去「练兵」）
# ============================================================
old2 = """    /xiaochang: \\{ label: "🏹 进入军务（出征 · 练兵 · 伤兵）"/.test(uS34)"""
new2 = """    /xiaochang: \\{ label: "🏹 进入军务（出征 · 伤兵）"/.test(uS34)"""
s = rep1(s, old2, new2, '② 校场文案')

# ============================================================
# ③ 9335：open-tactic 传细分量
# ============================================================
old3 = """    && /case 'open-tactic': ui\\.openTacticModal\\(\\); break;/.test(m)"""
new3 = """    && /case 'open-tactic': ui\\.openTacticModal\\(ui\\._expMode === 'raid' \\? 'raid' : 'occupy'\\); break;/.test(m)
    && /case 'exp-tac-sub':/.test(m)"""
s = rep1(s, old3, new3, '③ open-tactic')

# ============================================================
# ④ 12018：马厩断言（删 xc-spar 判据）
# ============================================================
old4 = """    return tbl.indexOf('majiu') < 0
      && /if \\(b\\.id === 'majiu'\\) extra/.test(uS)      /* 属性行保留 */
      && /case 'xc-spar'/.test(rd('main'));               /* 同日另加的校场动作（同一轮） */
  })());"""
new4 = """    return tbl.indexOf('majiu') < 0
      && /if \\(b\\.id === 'majiu'\\) extra/.test(uS);      /* 属性行保留 */
    /* v89.136：`case 'xc-spar'` 判据随练兵退役删除（见下一条的退役断言） */
  })());"""
s = rep1(s, old4, new4, '④ 马厩')

# ============================================================
# ⑤ 12024：练兵接线 → 退役断言
# ============================================================
old5 = """  check('v89.80：校场练兵接线（唯一出口组 + 分发 + 每日次数 + 君主不占校场）', (function () {
    var dm = rd('domain'), mn = rd('main'), us = rd('ui');
    return /GAME\\.xcSpar = function/.test(dm) && /GAME\\.xcReview = function/.test(dm)
      && /GAME\\.xcSparDoneToday = function/.test(dm) && /GAME\\.xcReviewDoneToday = function/.test(dm)
      && /GAME\\.xcDay = function/.test(dm)
      /* 演武必须走经验唯一入口，体力走唯一读写口 */
      && /GAME\\.battle\\.gainExp\\(g, gain, '校场演武'\\)/.test(dm)
      && /GAME\\.setStaNow\\(g, GAME\\.staNow\\(g\\) - sta\\)/.test(dm)
      && /case 'xc-spar'/.test(mn) && /case 'xc-review'/.test(mn)
      && /data-action="xc-spar"/.test(us)
      && /data-action="xc-review"/.test(us)
      && /今日已演武/.test(us) && /今日已阅兵/.test(us);
  })());"""
new5 = """  check('v89.136：练兵（演武/阅兵）整组退役（域/界面/动作/数据 四处墓碑 · 防回魂）', (function () {
    var dm = rd('domain'), mn = rd('main'), us = rd('ui'), dd = rd('data');
    return !/GAME\\.xcSpar = function/.test(dm) && !/GAME\\.xcReview = function/.test(dm)
      && !/GAME\\.xcDay = function/.test(dm) && !/GAME\\.xcCfg = function/.test(dm)
      && !/ui\\.trainBlockHTML = function/.test(us)
      && !/case 'xc-spar':/.test(mn) && !/case 'xc-review':/.test(mn) && !/case 'xc-gen-pick':/.test(mn)
      && !/DATA\\.XIAOCHANG = \\{/.test(dd);
  })());"""
s = rep1(s, old5, new5, '⑤ 练兵退役')

# ============================================================
# ⑥ 12037：演武行为用例 → 整段删（调用已删函数）
# ============================================================
st6 = s.find("  check('v89.80 行为：演武真扣金与体力并发经验；当日二次必拒；阅兵涨民心且当日仅一次', (function () {")
assert st6 > 0, '演武行为用例起点未找到'
en6mark = """      s.xcDay = bakDay; s.hearts = bakHearts; cell.build = saved;
    }
  })());
"""
en6 = s.find(en6mark, st6)
assert en6 > st6, '演武行为用例终点未找到'
en6 += len(en6mark)
s = s[:st6] + """  /* ⛔ v89.136 移除：'v89.80 行为：演武真扣金与体力并发经验…' 整段 —— 练兵退役（老板第 4 条）。
     退役断言见上方「练兵整组退役」一条（域/界面/动作/数据四处墓碑，防回魂）。 */
""" + s[en6:]

# ============================================================
# ⑦ §114③：练兵块 → 细分小页
# ============================================================
old7 = """    check('§114③ 出征战术页含「练兵」块（校场面板退役后演武/阅兵的新家）', (function () {
      var put = function (bid) {
        var idx = -1;
        (c114.cells || []).forEach(function (cell, i) { if (idx < 0 && !cell.build) idx = i; });
        c114.cells[idx] = { build: { id: bid, lvl: 2 } };
      };
      put('xiaochang');
      var h = G.ui.marchExpHTML();
      return h.indexOf('练兵') >= 0 && h.indexOf('data-action="xc-spar"') >= 0
        && h.indexOf('data-action="xc-review"') >= 0 && h.indexOf('data-action="xc-gen-pick"') >= 0;
    })());"""
new7 = """    check('§114③/§136 出征战术页：掠夺/占领两小页（细分）；练兵块已退役', (function () {
      var h = G.ui.marchExpHTML();
      return h.indexOf('data-action="exp-tac-sub"') >= 0
        && h.indexOf('🚩 占领战术') >= 0 && h.indexOf('🔥 掠夺战术') >= 0
        && h.indexOf('练兵') < 0 && h.indexOf('data-action="xc-spar"') < 0
        && h.indexOf('data-action="xc-review"') < 0;
    })());"""
s = rep1(s, old7, new7, '⑦ §114③')

old8 = """    check('§114③ 战术下拉变更 → 真调 setTactic（select 路径可用）', (function () {
      var g = G.state.generals[0];
      var before = JSON.stringify(GAME.tacticsOf('atk')['yibing'] || {});
      GAME.setTactic('atk', 'yibing', { s: 'hold' });
      var mid = (GAME.tacticsOf('atk')['yibing'] || {}).s;
      GAME.setTactic('atk', 'yibing', { s: 'advance' });
      var back = (GAME.tacticsOf('atk')['yibing'] || {}).s;
      return mid === 'hold' && back === 'advance';
    })(), 'hold → advance');"""
new8 = """    check('§136 战术细分：细分覆盖通用（逐兵种）· 清细分回通用（tacticsFor 唯一读口）', (function () {
      var bak = JSON.stringify(GAME.state.tactics || {});
      try {
        GAME.setTactic('atk', 'yibing', { s: 'hold' });          /* 通用 */
        GAME.setTactic('occupy', 'yibing', { s: 'retreat' });    /* 占领细分覆盖 */
        var occ = GAME.tacticsFor('occupy')['yibing'] || {};
        var raid = GAME.tacticsFor('raid')['yibing'] || {};
        var o1 = occ.s === 'retreat' && raid.s === 'hold';       /* 掠夺未细分 → 沿用通用 */
        GAME.clearTactics('occupy');
        var o2 = (GAME.tacticsFor('occupy')['yibing'] || {}).s === 'hold';
        /* 战斗读口同源：tacticOf('atk', …, {modeId:'occupy'}) 取细分表 */
        var t1 = GAME.tacticOf('atk', 'yibing', { modeId: 'occupy' });
        var t2 = GAME.tacticOf('atk', 'yibing', { modeId: 'raid' });
        GAME.setTactic('occupy', 'yibing', { s: 'retreat' });
        t1 = GAME.tacticOf('atk', 'yibing', { modeId: 'occupy' });
        var o3 = t1.s === 'retreat' && t2.s === 'hold';
        return o1 && o2 && o3;
      } finally { GAME.state.tactics = JSON.parse(bak); }
    })());"""
s = rep1(s, old8, new8, '⑧ §114③ 战术设置')

wr('smoke-test.js', s)
print('OK · smoke-test.js', len(s))

# ============================================================
# ⑨ e2e：出征战术页断言
# ============================================================
e = rd('e2e-test.js')
old9 = """  check('出征战术页：两列「动作/目标」下拉 + 练兵块；无在途行军（第 10/13 条）',
    extac21_v21.indexOf('tac-grid') >= 0
    && extac21_v21.indexOf('class="city-select tl-sel"') >= 0
    && extac21_v21.indexOf('练兵') >= 0
    && extac21_v21.indexOf('data-action="xc-spar"') >= 0
    && extac21_v21.indexOf('data-action="xc-review"') >= 0
    && extac21_v21.indexOf('🚩 在途') < 0);"""
new9 = """  check('出征战术页：两列下拉 + 掠夺/占领两小页；无在途行军、无练兵（第 10/13 条 + §136）',
    extac21_v21.indexOf('tac-grid') >= 0
    && extac21_v21.indexOf('class="city-select tl-sel"') >= 0
    && extac21_v21.indexOf('data-action="exp-tac-sub"') >= 0
    && extac21_v21.indexOf('🚩 占领战术') >= 0
    && extac21_v21.indexOf('练兵') < 0
    && extac21_v21.indexOf('data-action="xc-spar"') < 0
    && extac21_v21.indexOf('🚩 在途') < 0);"""
e = rep1(e, old9, new9, '⑨ e2e')
wr('e2e-test.js', e)
print('OK · e2e-test.js', len(e))
