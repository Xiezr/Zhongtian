# -*- coding: utf-8 -*-
"""v73 测试补丁：口径修正（prodBreakdown）+ smoke/e2e 守卫更新 + 新增 v73 断言节

【代码口径修正】（真 bug，两处"瀑布式分解"断言抓出来的）
  · state.js prodBreakdown 的税收 / 俸禄行未挂黄金闸门 ——
    展示与结算两本账，分解各项之和 ≠ 总产量。

【守卫更新】
  · v66 权重守卫 ×2：CUT 改为累计口径（÷100 / ÷80 / ÷60），概率 0.25% → 0.026%
  · v72 dlg-ico 守卫（smoke + e2e）：翻转为"顶部图标已连根撤除"
  · 施工中弹窗同构守卫：不再要求图标，改要求"没有图标"
  · 黄金仓库豁免断言：改为直接压测豁免（不依赖净收入符号）
  · e2e 将领页席位断言：席位文字已撤 → 改由列表内容验证两栏范围

【新增】
  · smoke 第 59 节：v73 五条的结构 + 实测（含秘境全链条 9 步）
  · e2e v73 节：官府入口 → 秘境面板 → 选种 → 种下 → 成熟 → 收获（真实 DOM）
"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


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


ST = P_ST = os.path.join(ROOT, 'js', 'state.js')
SMOKE = os.path.join(ROOT, 'smoke-test.js')
E2E = os.path.join(ROOT, 'e2e-test.js')

print('========== FIX：prodBreakdown 挂闸门（展示与结算同口径） ==========')
patch(
    ST,
    """      var tax = popCap * (s.hearts || 100) / 100 * (s.tax || 0);
      var salary = (DATA.RANK[s.rank || 0].salary || 0);
      rows.push({ name: '税收（人口' + U.numText(popCap, 0) + '×民心' + Math.round(s.hearts || 100) + '%×税率' + Math.round((s.tax || 0) * 100) + '%）', val: tax / 3600 * ts });
      if (salary) rows.push({ name: '爵位俸禄', val: salary / 3600 * ts });""",
    """      /* v73：黄金闸门与 cityProdPerSec / productionPerSec 同口径 ——
         否则"分解各项之和 = 总产量"对不上（显示与结算是两本账，本项目的老病）。 */
      var tax = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);
      var salary = (DATA.RANK[s.rank || 0].salary || 0) * (DATA.GOLD_GATE.salary || 1);
      rows.push({ name: '税收（人口' + U.numText(popCap, 0) + '×民心' + Math.round(s.hearts || 100) + '%×税率' + Math.round((s.tax || 0) * 100) + '%）', val: tax / 3600 * ts });
      if (salary) rows.push({ name: '爵位俸禄', val: salary / 3600 * ts });""",
    'F1 prodBreakdown 税收/俸禄挂闸门',
)

print()
print('========== S1：v66 权重守卫（第 2X 节） ==========')
patch(
    SMOKE,
    """    /* v66（老板）：「客栈天授级将领出现概率降低 10 倍，其他高资质降低 8、6 啥的」
       → 天授 ÷10 · 名世 ÷8 · 英杰 ÷6，低资质不动。
       断言写成"倍率"而不是写死数字，将来老板再调档位时只改 CUT 一处。 */
    var CUT = { tian: 10, ming: 8, ying: 6 };""",
    """    /* v66（老板）：「客栈天授级将领出现概率降低 10 倍，其他高资质降低 8、6 啥的」
       v73（老板）：「限制高资质将领的直接获取，概率再降 10 倍」—— 累计口径：
       天授 ÷100 · 名世 ÷80 · 英杰 ÷60（v66 的 ÷10/8/6 之后再各 ÷10），低资质两轮不动。
       断言写成"倍率"而不是写死数字，将来老板再调档位时只改 CUT 一处。 */
    var CUT = { tian: 100, ming: 80, ying: 60 };""",
    'S1a CUT 累计倍率',
)
patch(
    SMOKE,
    """    check('实测：高资质权重按 ÷10 / ÷8 / ÷6 下调', (function () {""",
    """    check('实测：高资质权重按累计 ÷100 / ÷80 / ÷60 下调（v73 再降10倍）', (function () {""",
    'S1b 检查名',
)
patch(
    SMOKE,
    """    check('实测：客栈1级 天授概率降到 0.25%', Math.abs(pctOf(w1, 'tian') - 0.25) < 0.05,
      pctOf(w1, 'tian').toFixed(2) + '%');""",
    """    check('实测：客栈1级 天授概率 ≈0.026%（v66 时 0.25%，两轮共 ÷100）',
      Math.abs(pctOf(w1, 'tian') - 0.026) < 0.01,
      pctOf(w1, 'tian').toFixed(3) + '%');""",
    'S1c 天授概率 0.026%',
)

print()
print('========== S2：smoke v72 尺寸盒守卫 → v73 无顶图守卫 ==========')
patch(
    SMOKE,
    """  /* v72（老板报障）：两处「升级中」弹窗的图标必须收进 .dlg-ico 尺寸盒 ——
     位图缺容器规则会按固有尺寸 1024px 把弹窗撑出上下+左右滚动条（几何实测 1036×1349）。 */
  check('v72：升级中弹窗图标有尺寸盒（.dlg-ico，位图不再按 1024px 固有尺寸撑爆弹窗）', (function () {
    return (uS.match(/class="dlg-ico"/g) || []).length >= 2
      && /class="dlg-ico" style="font-size:40px;"/.test(uS)
      && /width: 1em/.test(cssBlock(hS, '.dlg-ico .ico'))
      && /height: 1em/.test(cssBlock(hS, '.dlg-ico .ico'));
  })());""",
    """  /* v72（老板报障「官府升级中点击被撑爆」）→ v73（老板「顶部的图标也不要留」）：
     四处建筑弹窗（城内/城外 × 正常/施工中）的顶部图标块整体撤除，
     .dlg-ico 尺寸盒随之退役 —— 没有图标，就没有 1024px 固有尺寸撑爆的土壤。 */
  check('v73：建筑弹窗再无顶部图标块（v72 的 1024px 撑爆问题连根拔除）', (function () {
    var bld = codeOf(uS, 'ui.openBuildModal = function');
    var ext = codeOf(uS, 'ui.openExtModal = function');
    return bld.indexOf('dlg-ico') < 0 && ext.indexOf('dlg-ico') < 0
      && bld.indexOf('class="bldg-foot"') >= 0 && ext.indexOf('class="bldg-foot"') >= 0
      && uS.indexOf('class="dlg-ico"') < 0
      && stripComment(hS).indexOf('.dlg-ico') < 0;
  })());""",
    'S2 v73 无顶图守卫（smoke）',
)

print()
print('========== S3：黄金仓库豁免断言（改为直接压测豁免） ==========')
patch(
    SMOKE,
    """  check('#10 实测：黄金可突破仓库上限', (function () {
    var st = F16;
    st.cities[0].cells.forEach(function (c) { if (c.build && c.build.id === 'cangku') c.build = null; });
    var cap = G.storeCap();
    st.res.gold = cap;
    for (var i = 0; i < 3; i++) G.tickOnce();
    return st.res.gold > cap;
  })(), '仓库 ' + U.fmt(G.storeCap()));""",
    """  check('#10 实测：黄金可突破仓库上限', (function () {
    /* v73：改为**直接压测上限豁免** —— 旧写法依赖"产金 > 俸禄"的净流入，
       黄金闸门收紧后新城的净流入可正可负（税收 30/h vs 俸禄 40/h），
       与"黄金是否受仓容约束"这个待测点无关。现在：先放到 cap 之上，跑两 tick，
       只要没被夹回 cap 就是豁免生效。 */
    var st = F16;
    st.cities[0].cells.forEach(function (c) { if (c.build && c.build.id === 'cangku') c.build = null; });
    var cap = G.storeCap();
    st.res.gold = cap + 500000;
    G.tickOnce(); G.tickOnce();
    return st.res.gold > cap;
  })(), '仓库 ' + U.fmt(G.storeCap()));""",
    'S3 黄金豁免断言改写',
)

print()
print('========== S4：第 50 节 双守卫（v66 段落） ==========')
patch(
    SMOKE,
    """  check('实测：天授 / 名世 / 英杰 权重按 ÷10 / ÷8 / ÷6 下调', (function () {
    var CUT = { tian: 10, ming: 8, ying: 6 }, ORIG = { tian: 2, ming: 6, ying: 15 };""",
    """  check('实测：天授 / 名世 / 英杰 权重按累计 ÷100 / ÷80 / ÷60 下调', (function () {
    var CUT = { tian: 100, ming: 80, ying: 60 }, ORIG = { tian: 2, ming: 6, ying: 15 };""",
    'S4a 第50节 CUT',
)
patch(
    SMOKE,
    """  check('实测：客栈1级 天授概率 0.25%（旧版 2%）', (function () {
    var ws = G.rankWeights(1), t = 0, v = 0;
    ws.forEach(function (x) { t += x.w; if (x.rank.id === 'tian') v = x.w; });
    return Math.abs(v / t * 100 - 0.25) < 0.05;
  })());""",
    """  check('实测：客栈1级 天授概率 ≈0.026%（v66 为 0.25%）', (function () {
    var ws = G.rankWeights(1), t = 0, v = 0;
    ws.forEach(function (x) { t += x.w; if (x.rank.id === 'tian') v = x.w; });
    return Math.abs(v / t * 100 - 0.026) < 0.01;
  })());""",
    'S4b 第50节概率',
)

print()
print('========== S5：施工中弹窗同构守卫 ==========')
patch(
    SMOKE,
    """    check('施工中弹窗与正常态同构（图标 + 名称 · Lv→Lv + 描述）',
      /icons\\.forBuilding\\(isUpgrade \\? cell\\.build\\.id : cell\\.pending\\.buildId\\)/.test(u56)
      && /升级中 · 后台施工/.test(u56));""",
    """    check('施工中弹窗与正常态同构（名称 · Lv→Lv + 描述；v73 起不设顶部图标）',
      /升级中 · 后台施工/.test(u56)
      && !/icons\\.forBuilding\\(isUpgrade \\? cell\\.build\\.id : cell\\.pending\\.buildId\\)/.test(u56));""",
    'S5 同构守卫翻转为"无图标"',
)

print()
print('========== S6：新增第 59 节（v73 五条） ==========')

NEW_SEC = """
/* ============================================================
 * ===== 59. v73：黄金闸门 / 资质再降10倍 / 种田秘境 / 将领头 / 建筑弹窗 =====
 * ============================================================ */
console.log('\\n===== 59. v73 五条（黄金 · 资质 · 秘境 · 将领头 · 建筑弹窗） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uS73 = stripComment(rd('ui'));
  var stS73 = stripComment(rd('state'));
  var dS73 = stripComment(rd('domain'));
  var hS73 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var hS73c = stripComment(hS73);

  /* ---------- ① 黄金闸门 ---------- */
  console.log('  --- ① 黄金获取限制（GOLD_GATE） ---');
  check('结构：四个黄金出口全部挂到 DATA.GOLD_GATE（税收/俸禄/岁贡 + 征收系数）', (function () {
    return /DATA\\.GOLD_GATE\\.tax/.test(stS73) && /DATA\\.GOLD_GATE\\.salary/.test(stS73)
      && /DATA\\.GOLD_GATE\\.yield/.test(dS73)
      && /LEVY_RES_RATE = \\{ grain: 0\\.30, wood: 0\\.22, stone: 0\\.16, iron: 0\\.10, gold: 0\\.02 \\}/.test(dS73);
  })(), 'GATE=' + JSON.stringify(DATA.GOLD_GATE));
  check('实测：岁贡黄金按闸门打折（郡城 40000 → 12000）', (function () {
    var tmp = G.makeCity({ id: 'tmpY73', name: '郡城', x: 5, y: 5, type: 'jun', res: {} });
    var y = G.cityDailyYield(tmp);
    return y && y.gold === Math.round(40000 * DATA.GOLD_GATE.yield);
  })());
  check('实测：黄金产量分解与 cityProdPerSec 同口径（瀑布式不重不漏）', (function () {
    var st = G.newGame({ name: '税测', region: '司隶' });
    var c = st.cities[0];
    var p = G.cityProdPerSec(c);
    var rows = G.prodBreakdown('gold', c);
    var sum = 0;
    rows.forEach(function (r) { sum += r.val; });
    return Math.abs(sum - p.gold) <= Math.max(1e-6, p.gold * 1e-9);
  })());
  check('实测：黄金不受仓库上限夹制（放到 cap 之上，跑两 tick 不被夹回）', (function () {
    var st = G.newGame({ name: '上限测试', region: '司隶' });
    var cap = G.storeCap();
    st.res.gold = cap + 500000;
    G.tickOnce(); G.tickOnce();
    return st.res.gold > cap;
  })());

  /* ---------- ② 资质再降 10 倍 ---------- */
  console.log('  --- ② 高资质概率再降 10 倍 ---');
  check('实测：英杰 / 名世 / 天授 权重再 ÷10（0.25 / 0.075 / 0.02）', (function () {
    var w = {};
    DATA.GEN_RANKS.forEach(function (r) { w[r.id] = r.w; });
    return Math.abs(w.ying - 0.25) < 1e-9 && Math.abs(w.ming - 0.075) < 1e-9 && Math.abs(w.tian - 0.02) < 1e-9;
  })(), '英杰 ' + DATA.GEN_RANK_BY_ID.ying.w + ' · 名世 ' + DATA.GEN_RANK_BY_ID.ming.w + ' · 天授 ' + DATA.GEN_RANK_BY_ID.tian.w);
  check('结构：名将直取概率 0.30 → 0.03（组合拳的另一半）', /lv >= 5 && Math\\.random\\(\\) < 0\\.03/.test(dS73));
  check('实测：客栈1级 天授概率 ≈0.026%（两轮共 ÷100）', (function () {
    var ws = G.rankWeights(1), t = 0, v = 0;
    ws.forEach(function (x) { t += x.w; if (x.rank.id === 'tian') v = x.w; });
    return Math.abs(v / t * 100 - 0.026) < 0.01;
  })());

  /* ---------- ③ 种田秘境（完整链条逐环实测） ---------- */
  console.log('  --- ③ 种田秘境（锻造材料 + 资质灵草 完整链条） ---');
  check('数据：10 种作物（6 材料 + 4 灵草）全表化 · 6 块灵田', (function () {
    var cs = (DATA.FARM && DATA.FARM.crops) || [];
    var mats = cs.filter(function (c) { return !!c.mat; });
    var herbs = cs.filter(function (c) { return !!c.herb; });
    return cs.length === 10 && mats.length === 6 && herbs.length === 4 && DATA.FARM.plots === 6;
  })());
  check('数据：4 种灵草道具（rank_up 型，档位一一对应）', (function () {
    var need = {
      yunlingcao: ['fan', 'liang'], xisuizhi: ['liang', 'ying'],
      hualongshen: ['ying', 'ming'], tianshouguo: ['ming', 'tian'],
    };
    var ok = true;
    Object.keys(need).forEach(function (id) {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      if (!it || it.type !== 'rank_up' || it.from !== need[id][0] || it.to !== need[id][1]) ok = false;
    });
    return ok;
  })());
  var st73 = G.newGame({ name: '秘境验收', region: '司隶' });
  st73.res.gold = 1000000;
  check('链条①：初始六块空地', G.farmOf().plots.length === 6 && G.farmPlotState(0).state === 'empty');
  var gold73 = st73.res.gold;
  var rp73 = G.farmPlant(0, 'tieying');
  check('链条②：买种即种，扣黄金 5000', rp73.ok && st73.res.gold === gold73 - 5000, rp73.msg);
  check('链条③：生长中不可收获（提示准确剩余）', (function () {
    var h = G.farmHarvest(0);
    return !h.ok && /成熟/.test(h.msg);
  })());
  G.tickFarm(6 * 3600);
  check('链条④：推进 6 游戏小时即成熟', G.farmPlotState(0).state === 'ripe');
  var b73 = st73.items['bintie'] || 0;
  var rh73 = G.farmHarvest(0);
  check('链条⑤：收获进背包（镔铁 ×2~4；地块清空）',
    rh73.ok && (st73.items['bintie'] || 0) >= b73 + 2 && G.farmPlotState(0).state === 'empty', rh73.msg);
  G.farmPlant(1, 'yunlingcao');
  G.tickFarm(12 * 3600);
  var rh73b = G.farmHarvest(1);
  check('链条⑥：灵草可收获（蕴灵草 ×1）', rh73b.ok && (st73.items['yunlingcao'] || 0) >= 1, rh73b.msg);
  var g73 = st73.generals[0];
  g73.rank = 'fan';
  var use73 = G.systems.useItem('yunlingcao', g73.id);
  check('链条⑦：灵草把 凡品 → 良材（唯一出口 rankUpUse）', use73.ok && g73.rank === 'liang', use73.msg);
  check('链条⑦b：档位不符拒绝并说明（良材不能用蕴灵草）', (function () {
    st73.items['yunlingcao'] = (st73.items['yunlingcao'] || 0) + 1;
    var r = G.systems.useItem('yunlingcao', g73.id);
    return !r.ok && /只可用于/.test(r.msg);
  })());
  check('链条⑧：一键收获（多处成熟一次收）', (function () {
    st73.res.gold = 1000000;
    G.farmPlant(2, 'yusuihua');
    G.farmPlant(3, 'tanxiangshu');
    G.tickFarm(6 * 3600);
    var r = G.farmHarvestAll();
    return r.ok && G.farmPlotState(2).state === 'empty' && G.farmPlotState(3).state === 'empty';
  })());
  check('链条⑨：离线补算同口径推进（tickFarm(secReal × ts)）', /GAME\\.tickFarm\\(secReal \\* ts\\)/.test(stS73));
  check('界面：官府入口 + 面板/选种/收获动作齐备', (function () {
    return /data-action="open-farm"/.test(uS73) && /data-action="farm-seeds"/.test(uS73)
      && /data-action="farm-plant"/.test(uS73) && /data-action="farm-harvest"/.test(uS73)
      && /ui\\.openFarm = function/.test(uS73) && /ui\\.openFarmSeeds = function/.test(uS73);
  })());
  check('界面：主循环秒刷新（倒计时 data-farm-left / 进度 data-farm-bar）',
    /data-farm-left/.test(uS73) && /data-farm-bar/.test(uS73));
  check('样式：农场底纹 / 地块 / 成熟高亮（.farm-space / .farm-grid / .farm-cell.ripe）',
    /\\.farm-space \\{/.test(cssBlock(hS73, '.farm-space')) && /\\.farm-grid \\{/.test(cssBlock(hS73, '.farm-grid'))
      && /\\.farm-cell\\.ripe \\{/.test(cssBlock(hS73, '.farm-cell.ripe')));
  check('背包：灵草有分类与图标（rank_up）',
    /rank_up: '灵草（提升资质）'/.test(uS73) && /rank_up: '🌿'/.test(uS73));

  /* ---------- ④ 将领界面头部 ---------- */
  console.log('  --- ④ 将领界面头部（头像+飞机不要 / 席位文字不要） ---');
  check('结构：标题只剩「将领」+ 本城/全境 chips（🧑‍✈️ / 席位文字 / 名将计数全撤）', (function () {
    var body = codeOf(uS73, 'ui.generalsHTML = function');
    return /class="gold-heading">将领' \\+ scopeChips/.test(body)
      && body.indexOf('scopeNote') < 0 && body.indexOf('名将 ') < 0 && body.indexOf('\\u{1F9D1}') < 0;
  })());

  /* ---------- ⑤ 建筑弹窗 ---------- */
  console.log('  --- ⑤ 建筑弹窗（去顶图 + 底栏吸底） ---');
  check('结构：四处建筑弹窗顶部图标块已撤（城内×2 / 城外×2）', (function () {
    var body = codeOf(uS73, 'ui.openBuildModal = function');
    var ext = codeOf(uS73, 'ui.openExtModal = function');
    return body.indexOf('dlg-ico') < 0 && ext.indexOf('dlg-ico') < 0
      && body.indexOf('font-size:40px;"><span') < 0 && ext.indexOf('font-size:40px;"><span') < 0;
  })());
  check('结构：.dlg-ico 尺寸盒随图标一起退役（JS 与 CSS 双清零）',
    uS73.indexOf('dlg-ico') < 0 && hS73c.indexOf('.dlg-ico') < 0);
  check('样式：底栏吸底（sticky + 出血到面板边缘 + 不透明底）', (function () {
    var b = cssBlock(hS73, '.bldg-foot {');
    return /position: sticky/.test(b) && /bottom: 0/.test(b)
      && /margin: 12px -12px -12px/.test(b) && /background: var\\(--panel-bg\\)/.test(b);
  })(), cssBlock(hS73, '.bldg-foot {').replace(/\\s+/g, ' ').slice(0, 84));
})();

"""

patch(
    SMOKE,
    """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""",
    NEW_SEC + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""",
    'S6 新增第 59 节',
)

print()
print('========== E1：e2e v72 守卫 → v73 无顶图 ==========')
patch(
    E2E,
    """    /* v72（老板报障「官府升级中点击被撑爆」）：图标必须带尺寸盒（.dlg-ico .ico）——
       1024px 位图溢出在 jsdom 量不出，靠这条钉结构 + 真浏览器几何脚本兜底。 */
    check('v72：升级中面板图标有尺寸盒（.dlg-ico .ico）',
      !!document.querySelector('#modal-root .dlg-ico .ico'));""",
    """    /* v72（老板报障「官府升级中点击被撑爆」）→ v73（老板「顶部的图标也不要留」）：
       顶部图标块整体撤除 —— 连根拔除 1024px 位图撑爆的土壤，同时清掉旧 emoji 观感。 */
    check('v73：升级中面板不再有顶部图标（.dlg-ico 连根退役）',
      !document.querySelector('#modal-root .dlg-ico')
      && mh24.indexOf('class="dlg-ico"') < 0);""",
    'E1 无顶图守卫（e2e）',
)

print()
print('========== E2：将领页席位断言 → 标题精简 + 两栏范围实测 ==========')
patch(
    E2E,
    """  check('将领页本城栏写「本城 N / M 席」，M = **本城**招贤馆席位数', (function () {
    const m = /本城 (\\d+) \\/ (\\d+) 席/.exec(genHtml64);
    return !!m && Number(m[2]) === G.genSlotsOf(city64)
      && Number(m[1]) === G.generalsIn(city64).length;
  })(), (genHtml64.match(/本城 \\d+ \\/ \\d+ 席[^）]*/) || ['未找到'])[0]);
  check('将领页同时给出全境合计（各城席位数之和，不是本城那个数）',
    genHtml64.indexOf('全境 ' + G.state.generals.length + ' / ' + G.genSlotsTotal() + ' 席') >= 0,
    '期望 全境 ' + G.state.generals.length + ' / ' + G.genSlotsTotal() + ' 席');""",
    """  /* v73（老板）：「不要搞（本城 2 / 11 席 · 全境 2 / 11 席）这些文字，
     直接将领加本城/全境切换按钮就行」—— 标题的席位文字已撤。
     ⚠️ 旧断言的本意（本城栏 vs 全境栏**范围分得开**）不能跟着删 ——
     改由**列表内容**实测：给别城塞一位将领，本城栏不该出现、全境栏必须出现。 */
  check('v73：将领页标题精简（无席位文字；本城/全境切换 chips 在位）', (function () {
    return !/本城 \\d+ \\/ \\d+ 席/.test(genHtml64) && genHtml64.indexOf('席 · 全境') < 0
      && genHtml64.indexOf('gen-scope') >= 0 && genHtml64.indexOf('>将领<') >= 0;
  })(), (genHtml64.match(/class="gold-heading">[^<]{0,24}/) || ['未找到'])[0]);
  const other73 = G.makeGeneral('侧城将', 1, 'idle', side64.id, false);
  G.state.generals.push(other73);
  G.ui._genScope = 'city';
  G.ui.renderView('generals');
  await sleep(120);
  const cityHtml73 = document.querySelector('#view-container').innerHTML;
  G.ui._genScope = 'all';
  G.ui.renderView('generals');
  await sleep(120);
  const allHtml73 = document.querySelector('#view-container').innerHTML;
  G.ui._genScope = 'city';
  G.state.generals = G.state.generals.filter((g) => g.id !== other73.id);
  check('v73：本城/全境两栏范围仍分得开（别城将领只出现在全境栏）',
    cityHtml73.indexOf('侧城将') < 0 && allHtml73.indexOf('侧城将') >= 0);""",
    'E2 席位断言翻转 + 两栏实测',
)

print()
print('========== E3：新增 e2e v73 节（秘境全流程走真实 DOM） ==========')

NEW_E2E = """
  /* ============================================================
   * v73（老板五条）：种田秘境 / 建筑弹窗底栏 —— 真实 DOM 走一遍
   * ============================================================ */
  console.log('\\n--- v73. 种田秘境 · 建筑弹窗底栏（真实 DOM） ---');
  {
    G.state.res.gold = 3000000;
    G.ui.openGuanfu();
    await sleep(140);
    let mh73 = document.querySelector('#modal-root').innerHTML;
    check('v73：官府面板有「种田秘境」入口',
      mh73.indexOf('data-action="open-farm"') >= 0 && mh73.indexOf('种田秘境') >= 0);
    const farmBtn73 = document.querySelector('#modal-root [data-action="open-farm"]');
    if (farmBtn73) {
      click(farmBtn73);
      await sleep(140);
      mh73 = document.querySelector('#modal-root').innerHTML;
      check('v73：秘境面板六格灵田 + 播种入口',
        (mh73.match(/class="farm-cell/g) || []).length >= 6 && mh73.indexOf('data-action="farm-seeds"') >= 0);
      click(document.querySelector('#modal-root [data-action="farm-seeds"]'));
      await sleep(130);
      mh73 = document.querySelector('#modal-root').innerHTML;
      check('v73：选种弹窗列出 10 种作物（6 材料 + 4 灵草）',
        (mh73.match(/data-action="farm-plant"/g) || []).length === 10);
      const plantBtn73 = Array.from(document.querySelectorAll('#modal-root [data-action="farm-plant"]'))
        .find((b) => b.getAttribute('data-crop') === 'tieying');
      if (plantBtn73) {
        click(plantBtn73);
        await sleep(170);
        mh73 = document.querySelector('#modal-root').innerHTML;
        check('v73：种下后留在秘境（生长中 + 倒计时元素在位）',
          mh73.indexOf('成熟还需') >= 0 && !!document.querySelector('#modal-root [data-farm-left]'));
        G.tickFarm(8 * 3600);
        G.ui.openFarm();
        await sleep(130);
        const hv73 = document.querySelector('#modal-root [data-action="farm-harvest"]');
        check('v73：成熟地块出现「收获」按钮', !!hv73);
        if (hv73) {
          click(hv73);
          await sleep(170);
          check('v73：收获入包（镔铁）', (G.state.items['bintie'] || 0) > 0,
            '镔铁 ×' + (G.state.items['bintie'] || 0));
        }
      }
      G.ui.closeModal();
      await sleep(80);
    }

    /* 建筑弹窗：无顶图 + 取消升级/关闭同在吸底底栏 */
    const c73 = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { if (c73.res) c73.res[k] = 5000000; });
    const built73 = c73.cells.findIndex((x) => x.build && !x.pending);
    if (built73 >= 0) {
      G.ui.openBuildModal(built73);
      await sleep(130);
      check('v73：建筑弹窗无顶部图标块',
        !document.querySelector('#modal-root .dlg-ico')
        && document.querySelector('#modal-root').innerHTML.indexOf('class="dlg-ico"') < 0);
      check('v73：底栏 .bldg-foot 含关闭按钮（吸底那一条）', (function () {
        const foot = document.querySelector('#modal-root .bldg-foot');
        return !!foot && !!foot.querySelector('[data-action="close-modal"]');
      })());
      G.ui.closeModal();
      await sleep(80);
    }
    const empty73 = c73.cells.findIndex((x) => !x.official && !x.build && !x.pending);
    if (empty73 >= 0) {
      G.buildAt(c73.id, empty73, 'junying');
      let guard73 = 0;
      while (G.state.queues.build.length && guard73++ < 30) {
        const q = G.state.queues.build[0];
        q.elapsed = q.totalTime;
        G.applyBuildDone(q);
        const qi = G.state.queues.build.indexOf(q);
        if (qi >= 0) G.state.queues.build.splice(qi, 1);
      }
      const up73 = G.upgradeAt(c73.id, empty73);
      check('v73：升级队列已起（底栏断言夹具）', !!up73 && up73.ok, up73 && up73.msg);
      G.ui.openBuildModal(empty73);
      await sleep(130);
      check('v73：升级中弹窗也无顶图，取消升级与关闭同在底栏', (function () {
        const foot = document.querySelector('#modal-root .bldg-foot');
        return !document.querySelector('#modal-root .dlg-ico') && !!foot
          && !!foot.querySelector('[data-action="cancel-build"]')
          && !!foot.querySelector('[data-action="close-modal"]');
      })());
      G.ui.closeModal();
      await sleep(80);
    }
  }

"""
patch(
    E2E,
    """  G.ui.setView('city');
  await sleep(60);
  return finish();
}""",
    NEW_E2E + """  G.ui.setView('city');
  await sleep(60);
  return finish();
}""",
    'E3 新增 e2e v73 节',
)

print()
print('========== 测试补丁完成 ==========')
