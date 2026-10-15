# -*- coding: utf-8 -*-
"""v89.162 补丁 C：smoke 加 §162 段（内政→税收 · 分解对齐 · 界面文案 · 档案在册）"""
import io

R = 'E:/Deepseekdb/'
p = 'smoke-test.js'

s = io.open(R + p, 'r', encoding='utf-8', newline='').read()
if '162. v89.162（城主六维加成' in s:
    print('skip：§162 已在')
    raise SystemExit(0)

ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

NEW = """  /* ============================================================
   * §162. v89.162（老板 2）：
   *   ① 列举城主的六维对生产/战斗的加成（界面可查 · 六维悬停 + 城池面板）
   *   ② **内政对税收也应有加成**（新落点：mayorBonus.tax · 与产量/建造同率同封顶）
   *   ③ 顺修：税收分解与结算在"带税制加成"时分叉（分解少了 税制/城主 两项 = 显示两本账）
   * ============================================================ */
  console.log('\\n===== 162. v89.162（城主六维加成 · 内政→税收） =====');
  (function () {
    var fs162 = require('fs'), p162 = require('path');
    var sS162 = stripComment(fs162.readFileSync(p162.join(__dirname, 'js', 'state.js'), 'utf8'));
    var dS162 = stripComment(fs162.readFileSync(p162.join(__dirname, 'js', 'domain.js'), 'utf8'));
    var uS162 = fs162.readFileSync(p162.join(__dirname, 'js', 'ui.js'), 'utf8');

    check('§162 城主税加成出口：mayorBonus.tax 存在（两分支都给键 · 与产量同率同封顶）', (function () {
      return /tax: Math\\.min\\(1\\.5, a\\.nz \\* 0\\.01 \\* faint\\),/.test(dS162)
        && /return \\{ name: null, prod: 0, build: 0, tax: 0, research: 0, def: 0, faint: 1 \\};/.test(dS162);
    })());
    check('§162 结算接入：cityProdPerSec 城主税加成与"税制加成"同层相加（加法口径）', (function () {
      return /var mbTax162 = GAME\\.mayorBonus\\(city\\)\\.tax \\|\\| 0;/.test(sS162)
        && /\\(1 \\+ GAME\\.cityBonusNum\\(city, 'taxPct'\\) \\+ mbTax162\\)/.test(sS162);
    })());
    check('§162 ★ 真调：城主在任 → 税收 ×2.5（内政 200 封顶 +150%）· 解任即还原', (function () {
      var st = G.newGame({ name: 's162a', region: '司隶' });
      var c = st.cities[0];
      st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });
      var g0 = st.generals[0];
      g0.nz = 200;
      var no = G.cityProdPerSec(c).gold;
      g0.cityId = c.id; g0.status = 'mayor';
      var yes = G.cityProdPerSec(c).gold;
      st.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
      var back = G.cityProdPerSec(c).gold;
      return Math.abs(G.mayorBonus(c).tax) < 1e-9
        && Math.abs(yes / no - 2.5) < 1e-9 && Math.abs(back - no) < 1e-12;
    })());
    check('§162 线性（封顶前）：内政 80 → 税收 +80%', (function () {
      var st = G.state, c = st.cities[0];
      var bk = st.generals.map(function (gg) { return [gg.status, gg.cityId, gg.nz]; });
      try {
        st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });
        var g0 = st.generals[0];
        g0.nz = 80; g0.cityId = c.id; g0.status = 'mayor';
        return Math.abs(G.mayorBonus(c).tax - 0.8) < 1e-9;
      } finally {
        st.generals.forEach(function (gg, i) { gg.status = bk[i][0]; gg.cityId = bk[i][1]; gg.nz = bk[i][2]; });
      }
    })());
    check('§162 ★ 全境：带爵位+城主+宝物时 分解各项之和 = 结算（修分叉）', (function () {
      var st = G.newGame({ name: 's162b', region: '司隶' });
      var c = st.cities[0];
      st.rank = 10;
      st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });
      var g0 = st.generals[0];
      g0.nz = 120; g0.cityId = c.id; g0.status = 'mayor';
      st.buffs = st.buffs || {};
      st.buffs.prod = { gold: 0.25 }; st.buffs.prodUntil = {};
      var p1 = G.productionPerSec().gold;
      var s1 = G.prodBreakdown('gold').reduce(function (a, x) { return a + x.val; }, 0);
      return Math.abs(p1 - s1) <= Math.max(1e-9, Math.abs(p1) * 1e-9);
    })());
    check('§162 ★ 单城：分解 = 该城税收结算 + 俸禄行（带城主）', (function () {
      var st = G.newGame({ name: 's162c', region: '司隶' });
      var c = st.cities[0];
      st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });
      var g0 = st.generals[0];
      g0.nz = 120; g0.cityId = c.id; g0.status = 'mayor';
      var rows = G.prodBreakdown('gold', c);
      var s1 = rows.reduce(function (a, x) { return a + x.val; }, 0);
      var sal = rows.filter(function (x) { return x.name.indexOf('爵位俸禄') === 0; })
        .reduce(function (a, x) { return a + x.val; }, 0);
      var p1 = G.cityProdPerSec(c).gold;
      return Math.abs(s1 - (p1 + sal)) <= Math.max(1e-9, Math.abs(s1) * 1e-9);
    })());
    check('§162 分解行：含「城主内政」（值=基础×加成）与「税制加成…」；未任命 → 城主行消失', (function () {
      var st = G.newGame({ name: 's162d', region: '司隶' });
      var c = st.cities[0];
      st.rank = 10;
      st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });
      var g0 = st.generals[0];
      g0.nz = 120; g0.cityId = c.id; g0.status = 'mayor';
      var rows = G.prodBreakdown('gold', c);
      var hasMayor = rows.some(function (x) { return x.name === '城主内政'; });
      var hasCity = rows.some(function (x) { return x.name === '税制加成（名城/爵位/主城/神器）'; });
      var may = rows.filter(function (x) { return x.name === '城主内政'; })[0];
      var base = rows[0].val;
      var okVal = !!(may && Math.abs(may.val - base * 1.2) < Math.max(1e-9, base * 1e-6));
      st.generals.forEach(function (x) { x.status = 'idle'; x.cityId = null; });
      var gone = !G.prodBreakdown('gold', c).some(function (x) { return x.name === '城主内政'; });
      return hasMayor && hasCity && okVal && gone;
    })());
    check('§162 防回退：旧"合并基数"分解（baseG）不得复活', (function () {
      return sS162.indexOf('var baseG = tax + salary;') < 0
        && /税制加成（名城\\/爵位\\/主城\\/神器）/.test(sS162);
    })());
    check('§162 界面：六维悬停含"税收 +" · 城池面板城主行悬停给全部加成 · 防御体检文案', (function () {
      return /if \\(mb\\.tax\\) p2\\.push\\('税收 \\+'/.test(uS162)
        && /Math\\.round\\(mbC\\.tax \\* 100\\)/.test(uS162)
        && /内政→产量\\/建造\\/税收、智谋→研究\\/城防/.test(uS162);
    })());
    check('§162④ 需求档案在册（v89.162 · 老板原文关键句逐字）', (function () {
      var arc = fs162.readFileSync(p162.join(__dirname, '需求档案.md'), 'utf8');
      return arc.indexOf('v89.162') >= 0
        && arc.indexOf('列举城主的六维对生产，战斗的加成') >= 0
        && arc.indexOf('内政对税收也应有加成') >= 0;
    })());
  })();

"""

assert s.count(ANCHOR) == 1, '锚点数=%d' % s.count(ANCHOR)
s = s.replace(ANCHOR, NEW + ANCHOR)
io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
print('§162 已插入 · 新长度', len(s))
