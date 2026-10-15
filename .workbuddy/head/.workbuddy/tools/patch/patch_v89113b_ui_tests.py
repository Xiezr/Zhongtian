# -*- coding: utf-8 -*-
"""v89.113b · 城主收尾：城池面板/烽火页显示 + 文案 + smoke 升级"""
import io, os, shutil

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:80])
    return s.replace(a, b, 1)

def rw(p, s, name):
    shutil.copy2(p, os.path.join(BK, name))
    io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(p + '.tmp', p)

# ============================================================
# A. ui.js
# ============================================================
up = os.path.join(R, 'js', 'ui.js')
u = io.open(up, encoding='utf-8').read()

# A1：城池面板 —— 城主行（与守将并列）
a = """    var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;"""
b = """    var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
    /* v89.113（老板需求 3）：城主（文治）与守将（武功）同级并列 */
    var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(city) : null;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;"""
u = sub_txt(u, a, b, 'A1 mayor 变量')

a = """          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? U.escape(guard.name) + ' Lv' + guard.level : '<span class="ui-sub">未任命</span>') + '</span></div>'"""
b = """          '<div class="attr"><span class="k">📜 城主</span><span class="v">' +
            (mayor ? U.escape(mayor.name) + ' Lv' + mayor.level
                   + '　<span class="ui-sub">内政·智谋</span>' : '<span class="ui-sub">未任命（内政/智谋加成为零）</span>') + '</span></div>' +
          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? U.escape(guard.name) + ' Lv' + guard.level
                   + '　<span class="ui-sub">征兵·对阵</span>' : '<span class="ui-sub">未任命</span>') + '</span></div>'"""
u = sub_txt(u, a, b, 'A2 城主行')

# A3：烽火页 —— 城主列 + 城主风险项
a = """      if (!guard) risks.push('未任命守将');
      return '<tr><td>' + U.escape(ct.name) + '</td>' +
        '<td class="num">' + U.numText(army, 0) + '</td>' +
        '<td class="num">' + (wall > 0 ? 'Lv' + wall : '—') + '</td>' +
        '<td class="num">' + towers + '</td>' +
        '<td>' + (guard ? U.escape(guard.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td class="num">' + U.numText(def, 0) + '</td>' +"""
b = """      if (!guard) risks.push('未任命守将');
      /* v89.113：城主缺席 = 内政/智谋加成为零（城池面板会写明），体检里点出来 */
      var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(ct) : null;
      if (!mayor) risks.push('未任命城主');
      return '<tr><td>' + U.escape(ct.name) + '</td>' +
        '<td class="num">' + U.numText(army, 0) + '</td>' +
        '<td class="num">' + (wall > 0 ? 'Lv' + wall : '—') + '</td>' +
        '<td class="num">' + towers + '</td>' +
        '<td>' + (mayor ? U.escape(mayor.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td>' + (guard ? U.escape(guard.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td class="num">' + U.numText(def, 0) + '</td>' +"""
u = sub_txt(u, a, b, 'A3 烽火页城主列')

a = """      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/守将加成)（与来袭结算同一出口 defensePowerOf）。\\n' +
        '"齐备"= 有驻军 + 有城墙 + 有守将；缺哪项就在那行里点出来。') +
      '</div>' + (rows ? '<table class="tbl"><thead><tr><th>城池</th><th class="num">驻军</th><th class="num">城墙</th>' +
        '<th class="num">箭塔</th><th>守将</th><th class="num">防御力</th><th>风险</th></tr></thead><tbody>' + rows + '</tbody></table>'"""
b = """      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/城主智谋加成)（与来袭结算同一出口 defensePowerOf）。\\n' +
        '城主（文治）= 内政→产量/建造、智谋→研究/城防；守将（武功）= 勇武→征兵、战时对阵。\\n' +
        '"齐备"= 有驻军 + 有城墙 + 有城主 + 有守将；缺哪项就在那行里点出来。') +
      '</div>' + (rows ? '<table class="tbl"><thead><tr><th>城池</th><th class="num">驻军</th><th class="num">城墙</th>' +
        '<th class="num">箭塔</th><th>城主</th><th>守将</th><th class="num">防御力</th><th>风险</th></tr></thead><tbody>' + rows + '</tbody></table>'"""
u = sub_txt(u, a, b, 'A4 烽火 help/表头')

# A5：两处"出征/守将/采集中的不能派" → 加城主
for old, new, tag in [
  ("'<div class=\"q-empty\">本城无空闲将领 —— 派兵须有将领带队（出征/守将/采集中的不能派）。</div>'",
   "'<div class=\"q-empty\">本城无空闲将领 —— 派兵须有将领带队（出征/城主/守将/采集中的不能派）。</div>'",
   'A5a'),
  ("' 现任守将，需先解除任命才能调走。</b>'", "' 现任城主/守将，需先解除任命才能调走。</b>'", 'A5b'),
]:
    cnt = u.count(old)
    assert cnt >= 1, tag + ' 未命中'
    u = u.replace(old, new)

rw(up, u, 'ui.v89113a.js')
print('A. ui.js：城池面板/烽火页/文案 已完成')

# ============================================================
# B. smoke-test.js
# ============================================================
sp = os.path.join(R, 'smoke-test.js')
s = io.open(sp, encoding='utf-8').read()

# B1：守将加成段 → 城主/守将分工段
a = """  console.log('\\n===== 19. 守将加成 / 装备战斗 / 存档索引 / 离线补算 =====');
  var S19 = G.state;

  console.log('  --- 守将对城池的加成 ---');
  /* v63（老板）：「守将属性只对当前城池起加成作用」——
     `guardBonusTotal`（全境守将之和）已**删除**，改为一律 `guardBonus(city)`。
     所以这里同时钉两件事：入口在、且**全境口径的旧入口不再存在**。 */
  check('守将加成函数存在', typeof G.guardBonus === 'function');
  check('全境口径的 guardBonusTotal 已删除（防后门）',
    typeof G.guardBonusTotal !== 'function');
  S19.generals.forEach(function (g) { g.status = 'idle'; });
  check('无守将时加成为零', (function () {
    var b = G.guardBonus(S19.cities[0]);
    return b.prod === 0 && b.train === 0;
  })());
  var city19 = S19.cities[0];
  var grainNo = G.productionPerSec().grain;
  var g19 = S19.generals[0];
  g19.cityId = city19.id; g19.status = 'guard';
  var gb19 = G.guardBonus(city19);
  check('任命后取到守将加成', !!gb19.name, gb19.name);
  check('内政 → 产量加成', gb19.prod > 0, '+' + (gb19.prod * 100).toFixed(1) + '%');
  check('勇武 → 征兵加速', gb19.train > 0, '+' + (gb19.train * 100).toFixed(1) + '%');
  check('智谋 → 研究加速', gb19.research > 0, '+' + (gb19.research * 100).toFixed(1) + '%');
  check('智谋 → 城防加成', gb19.def > 0, '+' + (gb19.def * 100).toFixed(1) + '%');
  var grainYes = G.productionPerSec().grain;
  check('守将在任 → 粮食产量实际提升', grainYes > grainNo,
    grainNo.toFixed(2) + ' → ' + grainYes.toFixed(2) + '/秒');"""
b = """  console.log('\\n===== 19. 城主·守将分工 / 装备战斗 / 存档索引 / 离线补算 =====');
  var S19 = G.state;

  console.log('  --- 城主（文治）与守将（武功）分工（v89.113 老板需求 3）---');
  /* 老板令：「添加一个与守将同级的职位，名为城主，城主的**内政和智谋**起当前守将的作用。
     后续守将的功能将会更新：1）勇武对征兵速度加成；2）守城战时作为我方将领对阵。」
     本段钉住分工的两侧 —— 谁给什么加成、谁**不**给什么（防回潮）。 */
  check('城主加成函数存在（与守将同级）', typeof G.mayorBonus === 'function');
  check('全境口径的 guardBonusTotal 已删除（防后门）',
    typeof G.guardBonusTotal !== 'function');
  S19.generals.forEach(function (g) { g.status = 'idle'; });
  var city19 = S19.cities[0];
  check('无城主/无守将时加成为零', (function () {
    var mb0 = G.mayorBonus(city19), gb0 = G.guardBonus(city19);
    return mb0.prod === 0 && mb0.def === 0 && mb0.research === 0 && gb0.train === 0;
  })());
  var grainNo = G.productionPerSec().grain;
  var g19 = S19.generals[0];
  g19.cityId = city19.id; g19.status = 'mayor';
  var mb19 = G.mayorBonus(city19);
  check('任命城主后取到加成', !!mb19.name, mb19.name);
  check('城主·内政 → 产量加成', mb19.prod > 0, '+' + (mb19.prod * 100).toFixed(1) + '%');
  check('城主·智谋 → 研究加速', mb19.research > 0, '+' + (mb19.research * 100).toFixed(1) + '%');
  check('城主·智谋 → 城防加成', mb19.def > 0, '+' + (mb19.def * 100).toFixed(1) + '%');
  check('城主**不**给征兵加速（那是守将的武职）', !G.guardBonus(city19).train);
  var grainYes = G.productionPerSec().grain;
  check('城主在任 → 粮食产量实际提升', grainYes > grainNo,
    grainNo.toFixed(2) + ' → ' + grainYes.toFixed(2) + '/秒');
  var g19g = S19.generals[1];
  g19g.cityId = city19.id; g19g.status = 'guard';
  check('守将·勇武 → 征兵加速', G.guardBonus(city19).train > 0,
    '+' + (G.guardBonus(city19).train * 100).toFixed(1) + '%');
  check('守将**不**给产量加成（已迁城主，防两个出口）',
    !G.prodFactors('grain', city19).some(function (f) { return f.name === '守将内政'; }));
  check('prodFactors 的产量项名为「城主内政」',
    G.prodFactors('grain', city19).some(function (f) { return f.name === '城主内政'; }));"""
s = sub_txt(s, a, b, 'B1 分工段')

# B2：一城一守将段 —— 加成链改用「城主·内政」验证
a = """    gA.nz = 20; gB.nz = 90;
    var r1 = G.assignGeneral(gA.id, 'guard', cityA.id);
    var prodA = G.guardBonus(cityA).prod;
    var r2 = G.assignGeneral(gB.id, 'guard', cityA.id);
    var prodB = G.guardBonus(cityA).prod;
    check('任命第二人 → 第一人自动解任（不留双任）',
      gA.status === 'idle' && gA.cityId === null && gB.status === 'guard' && gB.cityId === cityA.id,
      'A=' + gA.status + ' B=' + gB.status);
    check('加成链改由**新守将**的属性计算（内政 20 → 90）',
      G.guardGeneralOf(cityA) === gB && prodB > prodA && Math.abs(prodB - 0.9) < 1e-9,
      (prodA * 100).toFixed(1) + '% → ' + (prodB * 100).toFixed(1) + '%');"""
b = """    gA.nz = 20; gB.nz = 90;
    /* v89.113：内政加成归城主 —— 本段改测**城主任命链**（守将的链由勇武项另测） */
    var r1 = G.assignGeneral(gA.id, 'mayor', cityA.id);
    var prodA = G.mayorBonus(cityA).prod;
    var r2 = G.assignGeneral(gB.id, 'mayor', cityA.id);
    var prodB = G.mayorBonus(cityA).prod;
    check('任命第二人 → 第一人自动解任（不留双任）',
      gA.status === 'idle' && gA.cityId === null && gB.status === 'mayor' && gB.cityId === cityA.id,
      'A=' + gA.status + ' B=' + gB.status);
    check('加成链改由**新城主**的属性计算（内政 20 → 90）',
      G.mayorGeneralOf(cityA) === gB && prodB > prodA && Math.abs(prodB - 0.9) < 1e-9,
      (prodA * 100).toFixed(1) + '% → ' + (prodB * 100).toFixed(1) + '%');
    /* v89.113：守将侧同款链（勇武 20 → 90 → 征兵 +10% → +45%） */
    gA.status = 'idle'; gB.status = 'idle';
    gA.yw = 20; gB.yw = 90;
    G.assignGeneral(gA.id, 'guard', cityA.id);
    var trA = G.guardBonus(cityA).train;
    G.assignGeneral(gB.id, 'guard', cityA.id);
    var trB = G.guardBonus(cityA).train;
    check('守将链随新将重算（勇武 20 → 90 → 征兵 10% → 45%）',
      G.guardGeneralOf(cityA) === gB && Math.abs(trB - 0.45) < 1e-9 && trB > trA,
      (trA * 100).toFixed(1) + '% → ' + (trB * 100).toFixed(1) + '%');
    /* 一人一职互斥：把 gB 从守将改成城主 → 守将位自动空出（status 单值） */
    G.assignGeneral(gB.id, 'mayor', cityA.id);
    check('一人一职（守将改任城主 → 守将位不再挂在该将名下）',
      gB.status === 'mayor' && !G.guardGeneralOf(cityA));"""
s = sub_txt(s, a, b, 'B2 一城一守将')

# B3：结构断言升级（12251 段）
a = """  check('结构：四个消费点都收窄到"按城取"（产量 / 建造 / 征兵 / 研究）', (function () {
    return /GAME\\.prodFactors = function \\(r, city(, mpGlobal)?\\)/.test(stS)   /* v89.107：加可选的全境专精参数 */
      && /GAME\\.guardBuildMult = function \\(city\\)/.test(dmS)
      && /GAME\\.guardBonus\\(city\\)/.test(codeOf(dmS, 'GAME._rawGuardBuildMult = function'))
      && /guardBonus\\(city\\)/.test(codeOf(dmS, 'GAME.train = function'))
      && /guardBonus\\(_gcity\\)/.test(syS);
  })());"""
b = """  check('结构：四个消费点都收窄到"按城取"（产量-城主 / 建造-城主 / 征兵-守将 / 研究-城主）', (function () {
    /* v89.113：内政/智谋的经营项归城主（mayorBonus）、勇武征兵归守将（guardBonus） */
    return /GAME\\.prodFactors = function \\(r, city(, mpGlobal)?\\)/.test(stS)   /* v89.107：加可选的全境专精参数 */
      && /GAME\\.cityBuildMult = function \\(city\\)/.test(dmS)
      && /GAME\\.mayorBonus\\(city\\)/.test(codeOf(dmS, 'GAME._rawCityBuildMult = function'))
      && /guardBonus\\(city\\)/.test(codeOf(dmS, 'GAME.train = function'))
      && /mayorBonus\\(_gcity\\)/.test(syS)
      && /GAME\\.mayorBonus\\(city\\)/.test(codeOf(dmS, 'GAME.cityDefenseBase = function'));
  })());"""
s = sub_txt(s, a, b, 'B3 结构断言')

# B4：A城/B城实测段 —— '守将内政' → '城主内政'（角色改 mayor）
a = """      var g = st.generals[0];
      g.cityId = a.id; g.status = 'guard'; g.loyalty = 100;
      var hasA = G.prodFactors('grain', a).some(function (f) { return f.name === '守将内政'; });
      var hasB = G.prodFactors('grain', b).some(function (f) { return f.name === '守将内政'; });
      if (!hasA || hasB) return false;
      var g2 = G.makeGeneral('副城守将', 20, 'guard', b.id, false, 'liang', 'balance');
      g2.loyalty = 100;
      st.generals.push(g2);
      var bb = G.guardBonus(b);
      return bb.name === g2.name && bb.prod > 0;"""
b = """      /* v89.113：产量加成读**城主**（角色改为 mayor） */
      var g = st.generals[0];
      g.cityId = a.id; g.status = 'mayor'; g.loyalty = 100;
      var hasA = G.prodFactors('grain', a).some(function (f) { return f.name === '城主内政'; });
      var hasB = G.prodFactors('grain', b).some(function (f) { return f.name === '城主内政'; });
      if (!hasA || hasB) return false;
      var g2 = G.makeGeneral('副城城主', 20, 'mayor', b.id, false, 'liang', 'balance');
      g2.loyalty = 100;
      st.generals.push(g2);
      var bb = G.mayorBonus(b);
      return bb.name === g2.name && bb.prod > 0;"""
s = sub_txt(s, a, b, 'B4 A/B 城实测')

rw(sp, s, 'smoke.v89113a.js')
print('B. smoke-test.js：4 段口径升级完成')
