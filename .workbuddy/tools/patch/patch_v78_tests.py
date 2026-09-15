# -*- coding: utf-8 -*-
"""v78 · 测试层：smoke §59 链条改种子制 + 新增 §63（灵草时序/种子经济/灵淬）+ e2e 三处。

配合 patch_v78_core.py / patch_v78_ui.py。
"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== H. smoke §59 链条改种子制 ==')
patch(SMOKE,
"""  var gold73 = st73.res.gold;
  var rp73 = G.farmPlant(0, 'tieying');
  check('链条②：买种即种，扣黄金 5000', rp73.ok && st73.res.gold === gold73 - 5000, rp73.msg);""",
"""  var gold73 = st73.res.gold;
  /* v78：播种改种子制 —— 先发种子；"即种"不变，黄金分文不动 */
  st73.items['seed_fan'] = 2;
  var rp73 = G.farmPlant(0, 'tieying');
  check('链条②（v78 改）：种子播种 —— 消耗 ×1、不扣黄金', rp73.ok && st73.items['seed_fan'] === 1 && st73.res.gold === gold73, rp73.msg);""",
'H1 链条②种子制')

patch(SMOKE,
"""  G.farmPlant(1, 'yunlingcao');
  G.tickFarm(12 * 3600);""",
"""  st73.items['seed_yunling'] = 1;
  G.farmPlant(1, 'yunlingcao');
  G.tickFarm(12 * 3600);""",
'H2 链条⑥种子')

patch(SMOKE,
"""    st73.res.gold = 1000000;
    G.farmPlant(2, 'yusuihua');
    G.farmPlant(3, 'tanxiangshu');""",
"""    st73.res.gold = 1000000;
    st73.items['seed_fan'] = 2;
    G.farmPlant(2, 'yusuihua');
    G.farmPlant(3, 'tanxiangshu');""",
'H3 链条⑧种子')

print()
print('== I. smoke 新增 §63 ==')
SEC63 = """  /* ============================================================
   * ===== 63. v78：灵草时序 / 种子活动制 / 隐藏「灵淬」（老板三条） =====
   * ============================================================ */
  console.log('\\n===== 63. v78 三条（灵草时长 · 种子活动制 · 灵淬隐藏加成） =====');
  (function () {
    var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var dS = stripComment(rd('data'));
    var stS = stripComment(rd('state'));
    var domS = stripComment(rd('domain'));
    var batS = stripComment(rd('battle'));
    var uS = stripComment(rd('ui'));
    var sysS = stripComment(rd('systems'));

    /* ---------- ① 灵草时序 & 种子数据 ---------- */
    console.log('  --- ① 灵草作物时间逐级拉长 + 种子全表化 ---');
    check('数据：灵草时长逐级翻倍 12/24/48/96（v78 拉长化龙参 36→48、天授果 48→96）', (function () {
      var hs = {};
      (DATA.FARM.crops || []).forEach(function (c) { if (c.herb) hs[c.id] = c.hours; });
      return hs.yunlingcao === 12 && hs.xisuizhi === 24 && hs.hualongshen === 48 && hs.tianshouguo === 96;
    })(), '蕴灵草 12 / 洗髓芝 24 / 化龙参 48 / 天授果 96');
    check('数据：时长严格递增且增量逐档变大（+12 / +24 / +48）', (function () {
      var arr = ['yunlingcao', 'xisuizhi', 'hualongshen', 'tianshouguo'].map(function (id) {
        var c = DATA.FARM_CROP_BY_ID[id]; return c ? c.hours : 0;
      });
      return arr[1] > arr[0] && arr[2] > arr[1] && arr[3] > arr[2]
        && (arr[1] - arr[0]) < (arr[2] - arr[1]) && (arr[2] - arr[1]) < (arr[3] - arr[2]);
    })());
    check('数据：10 作物全带 seedItem（黄金价 seed 字段退役）', (function () {
      var cs = DATA.FARM.crops || [];
      return cs.length === 10 && cs.every(function (c) { return !!c.seedItem && c.seed === undefined; });
    })());
    check('数据：5 种种子道具（type=seed：凡植 + 四灵种）', (function () {
      var seeds = (DATA.ITEMS || []).filter(function (x) { return x.type === 'seed'; });
      var ids = seeds.map(function (x) { return x.id; }).sort().join(',');
      return seeds.length === 5 && ids === 'seed_fan,seed_hualong,seed_tianshou,seed_xisui,seed_yunling';
    })());
    check('数据：掉落表 SEED_DROP（5 行 · 高级种有 minLv 门槛 · 战事 ×0.85）', (function () {
      var t = DATA.SEED_DROP;
      if (!t || !t.table || t.table.length !== 5 || t.battleMult !== 0.85) return false;
      var m = {}; t.table.forEach(function (r) { m[r.id] = r; });
      return m.seed_fan.minLv === 1 && m.seed_xisui.minLv === 3
        && m.seed_hualong.minLv === 6 && m.seed_tianshou.minLv === 8;
    })());

    /* ---------- ② 播种 = 种子制（不花黄金） ---------- */
    console.log('  --- ② 播种种子制（域层唯一出口） ---');
    var st78 = G.newGame({ name: 'v78验收', region: '司隶' });
    check('实测：无种子拒绝（提示去哪儿找）', (function () {
      var r = G.farmPlant(0, 'yunlingcao');
      return !r.ok && r.msg.indexOf('种子') >= 0 && r.msg.indexOf('采集与征战') >= 0;
    })());
    check('实测：有种子即种 —— 消耗 ×1、黄金分文不动', (function () {
      st78.res.gold = 123456;
      st78.items['seed_yunling'] = 2;
      var r = G.farmPlant(0, 'yunlingcao');
      return r.ok && st78.items['seed_yunling'] === 1 && st78.res.gold === 123456;
    })());
    check('实测：farmPlant 里不再有黄金扣减', codeOf(domS, 'GAME.farmPlant = function').indexOf('gold') < 0);

    /* ---------- ③ 种子掉落（采集 / 战斗两条口） ---------- */
    console.log('  --- ③ 种子掉落（采集归来 / 出征缴获） ---');
    check('掉落：满级野地全中时 5 种各 1（打桩随机 0）', (function () {
      var bk = G.state.items;
      G.state.items = {};
      var got = withFixedRandom([0], function () { return G.grantSeedDrop(10, 1, ''); });
      G.state.items = bk;
      return got.length === 5 && got.join('|').indexOf('凡植种子×1') >= 0 && got.join('|').indexOf('天授种子×1') >= 0;
    })());
    check('掉落：1 级低级地高掷全空（0.99 → 一颗不掉）', (function () {
      var bk = G.state.items;
      G.state.items = {};
      var got = withFixedRandom([0.99], function () { return G.grantSeedDrop(1, 1, ''); });
      G.state.items = bk;
      return got.length === 0;
    })());
    check('掉落：天授种子 lv7 不掉、lv8 起可掉（minLv 门槛）', (function () {
      var bk = G.state.items;
      G.state.items = {};
      var lv7 = withFixedRandom([0], function () { return G.grantSeedDrop(7, 1, '').join('|'); });
      G.state.items = {};
      var lv8 = withFixedRandom([0], function () { return G.grantSeedDrop(8, 1, '').join('|'); });
      G.state.items = bk;
      return lv7.indexOf('天授种子') < 0 && lv8.indexOf('天授种子') >= 0;
    })());
    check('挂钩：采集归来（finishGather）与出征获胜（expedition）各调一次',
      domS.indexOf('GAME.grantSeedDrop(g.level || 1, 1') >= 0
      && batS.indexOf('GAME.grantSeedDrop(seedLv, DATA.SEED_DROP.battleMult') >= 0);
    check('挂钩：宝物随机池排除种子（种子走专属口）', domS.indexOf("it.type !== 'seed'") >= 0);
    check('界面：种子不「使用」——useItem 指路秘境 + 背包行「去播种」',
      sysS.indexOf('种子要到种田秘境播种') >= 0 && uS.indexOf('data-action="open-farm">去播种') >= 0);
    check('界面：选种弹窗显示种子持有数 / 缺种禁用（不再有黄金价）',
      uS.indexOf("持有 <b>' + have + '</b>") >= 0 && uS.indexOf("缺 ' + U.escape(sd.name)") >= 0
      && uS.indexOf('金 不足') < 0);
    check('界面：背包「种子（种田秘境）」分类与图标系列',
      uS.indexOf("seed: '种子（种田秘境）'") >= 0
      && uS.indexOf("seed_fan: '🌾'") >= 0 && uS.indexOf("seed_tianshou: '🍑'") >= 0);

    /* ---------- ④ 隐藏设定：灵淬 ---------- */
    console.log('  --- ④ 隐藏设定：灵草升档额外加四维（灵淬） ---');
    check('数据：四档 ascend 齐备（良2/英3/名5/天8，全链 18）', (function () {
      var R = DATA.GEN_RANK_BY_ID;
      return R.liang.ascend === 2 && R.ying.ascend === 3 && R.ming.ascend === 5 && R.tian.ascend === 8
        && (R.liang.ascend + R.ying.ascend + R.ming.ascend + R.tian.ascend) === 18;
    })());
    check('实测：凡品用蕴灵草 → 良材，四维各 +2 且计数 ascend=1', (function () {
      var g = st78.generals[0];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong, y0 = g.yw, z0 = g.zm, n0 = g.nz;
      st78.items['yunlingcao'] = 1;
      var r = G.systems.useItem('yunlingcao', g.id);
      return r.ok && g.rank === 'liang'
        && g.tong === t0 + 2 && g.yw === y0 + 2 && g.zm === z0 + 2 && g.nz === n0 + 2 && g.ascend === 1;
    })());
    check('实测：全链走完（凡→良→英→名→天）四维各 +18（2+3+5+8）、计数 4', (function () {
      var g = st78.generals[1];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong;
      [['yunlingcao', 'liang'], ['xisuizhi', 'ying'], ['hualongshen', 'ming'], ['tianshouguo', 'tian']].forEach(function (pair) {
        st78.items[pair[0]] = 1;
        G.systems.useItem(pair[0], g.id);
      });
      return g.rank === 'tian' && g.tong === t0 + 18 && g.ascend === 4;
    })());
    check('隐藏性：界面无「灵淬 / 隐藏加成」字样（机制不显式提示）',
      uS.indexOf('灵淬') < 0 && uS.indexOf('隐藏加成') < 0);
    check('结构：加成只走 rankUpUse 唯一出口（ascend 只在 data 声明 + state 消费）', (function () {
      var body = codeOf(stS, 'GAME.rankUpUse = function');
      return body.indexOf('nr.ascend') >= 0 && (dS.match(/ascend/g) || []).length >= 4;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
"""
patch(SMOKE,
"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
""",
SEC63,
'I1 新增 §63')

print()
print('== J. e2e 三处 ==')
patch(E2E,
"""    G.state.res.gold = 3000000;
    G.ui.openGuanfu();""",
"""    G.state.res.gold = 3000000;
    /* v78：播种改种子制 —— 先发种子（材料 ×2 / 灵草 ×1），再走界面 */
    G.state.items = G.state.items || {};
    G.state.items['seed_fan'] = (G.state.items['seed_fan'] || 0) + 2;
    G.state.items['seed_yunling'] = (G.state.items['seed_yunling'] || 0) + 1;
    G.ui.openGuanfu();""",
'J1 e2e 发种子')

patch(E2E,
"""      check('v73：选种弹窗列出 10 种作物（6 材料 + 4 灵草）',
        (mh73.match(/data-action="farm-plant"/g) || []).length === 10);""",
"""      check('v73：选种弹窗列出 10 种作物（6 材料 + 4 灵草）',
        (mh73.match(/data-action="farm-plant"/g) || []).length === 10);
      check('v78：选种行显示种子消耗（凡植种子 -1 / 不花黄金）',
        mh73.indexOf('凡植种子') >= 0 && mh73.indexOf('-1）') >= 0 && mh73.indexOf('金 不足') < 0);""",
'J2 e2e 种子消耗断言')

patch(E2E,
"""  check('装备详情含选将穿戴', eqHtml.indexOf('穿给谁') >= 0);""",
"""  check('v78：装备详情不再有「穿给谁」（穿戴走将领侧）',
    eqHtml.indexOf('穿给谁') < 0 && eqHtml.indexOf('到「将领」面板点对应部位') >= 0);""",
'J3 e2e 撤穿给谁')

print()
print('全部完成。')
