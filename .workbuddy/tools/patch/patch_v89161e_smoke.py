# -*- coding: utf-8 -*-
"""v89.161 补丁 E：smoke —— ① 四条旧断言随口径升级（花费按城 / 金不通运）
② 新增 §161 一节（金池 + 谁的城用谁的货）"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'smoke-test.js'


def rep(tag, old, new, guard):
    s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-42s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 命中 %d 次' % (tag, n)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-42s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── ① 都城越过 12 级：造局给"该城"备料 ──
rep('smoke · 都城越级用例按城备料',
    """  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { s.res[k] = 9e8; });
  s.queues.build = [];
  var doCity = G.makeCity({ id: 'v54_do', name: 'v54都城', x: 500, y: 500, type: 'capital' });
  var selfCity = G.makeCity({ id: 'v54_self', name: 'v54自建', x: 501, y: 501, type: 'self' });
  /* v68：官府拉满 —— 本段验证的是名城档位加成，不是官府总闸 */
  govMax(doCity); govMax(selfCity);
  s.cities.push(doCity, selfCity);""",
    """  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { s.res[k] = 9e8; });
  s.queues.build = [];
  var doCity = G.makeCity({ id: 'v54_do', name: 'v54都城', x: 500, y: 500, type: 'capital' });
  var selfCity = G.makeCity({ id: 'v54_self', name: 'v54自建', x: 501, y: 501, type: 'self' });
  /* v68：官府拉满 —— 本段验证的是名城档位加成，不是官府总闸 */
  govMax(doCity); govMax(selfCity);
  G.registerCity(doCity); G.registerCity(selfCity);
  /* v89.161（老板 5）：花费按**该城**结算 —— 造局要把两座城的货都备足
     （改前一律用当前城的货，所以老写法只给当前城备料也能过）。 */
  [doCity, selfCity].forEach(function (ct) {
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(ct)[k] = 9e8; });
  });""",
    'v89.161（老板 5）：花费按**该城**结算 —— 造局要把两座城的货都备足')

# ── ② 无官府的城：同样给该城备料 ──
rep('smoke · 无官府城用例按城备料',
    """        cx.cells[0].build = { id: 'minfang', lvl: 5 };
        st54.cities.push(cx);
        var up = G.upgradeAt(cx.id, 0);""",
    """        cx.cells[0].build = { id: 'minfang', lvl: 5 };
        G.registerCity(cx);
        /* v89.161：花费按该城结算 —— 这座城的货要自己备（改前用当前城） */
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(cx)[k] = 9e8; });
        var up = G.upgradeAt(cx.id, 0);""",
    '这座城的货要自己备')

# ── ③ 载重口径（金不通运） ──
rep('smoke · 载重口径去金',
    """    check('③ 载重口径：只认可运资源（人口/材料不计重）', (function () {
      return G.cargoLoadOf({ grain: 100, gold: 50 }) === 150
        && G.cargoLoadOf({ pop: 9999, jewel: 3, grain: 1 }) === 1;
    })());""",
    """    check('③ 载重口径：只认可运资源（人口/材料不计重 · v89.161 起**金也不计重**）', (function () {
      /* 老板 5：金是玩家层级通用资源（唯一池），不进运输清单 —— 运金 = 从池子搬到池子 */
      return G.cargoLoadOf({ grain: 100, gold: 50 }) === 100
        && G.cargoLoadOf({ pop: 9999, jewel: 3, grain: 1 }) === 1;
    })());""",
    'v89.161 起**金也不计重**')

# ── ④ 派生断言（TRANSPORT_KEYS 去金） ──
rep('smoke · 派生断言去金',
    """      return G.RES_KEYS.join(',') === DATA.RES_ORDER.concat(['pop']).join(',')
        && G.TRANSPORT_KEYS.join(',') === DATA.RES_ORDER.join(',')
        && DATA.RES_ORDER.indexOf('pop') < 0;""",
    """      return G.RES_KEYS.join(',') === DATA.RES_ORDER.concat(['pop']).join(',')
        /* v89.161（老板 5）：运输清单 = RES_ORDER **去金**（金全境通用，无需运输） */
        && G.TRANSPORT_KEYS.join(',') === DATA.RES_ORDER.filter(function (k) { return k !== 'gold'; }).join(',')
        && G.TRANSPORT_KEYS.indexOf('gold') < 0
        && DATA.RES_ORDER.indexOf('pop') < 0;""",
    '运输清单 = RES_ORDER **去金**')

# ── ⑤ 新增 §161 ──
SEC = r"""  /* ============================================================
   * §161. v89.161（老板 5）：
   *   黄金上收**玩家层级**（唯一池 s.gold · 各城 res.gold 是同一口池子的访问器）
   *   建造花费"**谁的建筑用谁的城**"（货按城 · 金通用）· 返还进该城 · 调运清单去金
   * ============================================================ */
  console.log('\n===== 161. v89.161（黄金上收玩家池 · 谁的城用谁的货） =====');
  (function () {
    var fs161 = require('fs'), p161 = require('path');
    var sS161 = stripComment(fs161.readFileSync(p161.join(__dirname, 'js', 'state.js'), 'utf8'));
    var dS161 = stripComment(fs161.readFileSync(p161.join(__dirname, 'js', 'domain.js'), 'utf8'));
    var uS161 = fs161.readFileSync(p161.join(__dirname, 'js', 'ui.js'), 'utf8');

    check('§161 唯一出口群：goldOf / goldAdd / goldBind / attachGold / migrateGoldPool / registerCity', (function () {
      return ['goldOf', 'goldAdd', 'goldBind', 'attachGold', 'migrateGoldPool', 'registerCity']
        .every(function (n) { return (sS161.match(new RegExp('GAME\\.' + n + ' = function', 'g')) || []).length === 1; });
    })());
    check('§161 收支唯一出口：canAffordIn / payCostIn（旧 canAfford/payCost = 当前城薄转发）', (function () {
      return /GAME\.canAffordIn = function/.test(dS161) && /GAME\.payCostIn = function/.test(dS161)
        && /GAME\.canAfford = function \(cost\) \{ return GAME\.canAffordIn\(GAME\.currentCity\(\), cost\); \}/.test(dS161)
        && /GAME\.payCost = function \(cost\) \{ return GAME\.payCostIn\(GAME\.currentCity\(\), cost\); \}/.test(dS161);
    })());
    check('§161 金是唯一池：写一处 = 全城可见（真调）', (function () {
      var st = G.state, c = G.currentCity();
      var bkGold = st.gold;
      try {
        var c2 = G.makeCity({ id: 'sm161x', name: 'sm161乙', x: 630, y: 630, type: 'self' });
        G.registerCity(c2);
        G.res(c2).gold = 4242;
        var seen = G.res(c).gold;
        var same = (G.goldOf() === 4242) && (seen === 4242);
        G.res(c).gold = 3131;
        var back = (G.res(c2).gold === 3131);
        st.cities = st.cities.filter(function (x) { return x.id !== 'sm161x'; });
        return same && back;
      } finally { st.gold = bkGold; }
    })());
    check('§161 老档迁移：各城金相加入池 + 幂等（不翻倍）', (function () {
      var fake = { cities: [{ res: { grain: 0, gold: 120 } }, { res: { grain: 0, gold: 380 } }] };
      G.migrateGoldPool(fake);
      var once = fake.gold;
      G.migrateGoldPool(fake);
      return once === 500 && fake.gold === 500;
    })());
    check('§161 ★ 谁的城用谁的货：在甲城升乙城的建筑 → 报"本城资源不足"，甲城货分毫未动', (function () {
      var st = G.state, c = G.currentCity();
      var bkCity = G.ui._cityId, bkQ = (st.queues.build || []).slice();
      try {
        G.ui._cityId = c.id;
        var cB = G.makeCity({ id: 'sm161y', name: 'sm161乙城', x: 631, y: 631, type: 'self' });
        G.registerCity(cB);
        cB.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 5e6; G.res(cB)[k] = 0; });
        st.queues.build = [];
        var mi = -1;
        cB.cells.forEach(function (x, i) { if (mi < 0 && x.build && x.build.id === 'minfang') mi = i; });
        var sum4 = function (R) { return (R.grain || 0) + (R.wood || 0) + (R.stone || 0) + (R.iron || 0); };
        var beforeA = sum4(G.res(c));
        var r = G.upgradeAt(cB.id, mi);
        var blocked = r.ok === false && /本城资源不足/.test(r.msg || '') && sum4(G.res(c)) === beforeA;
        /* 给该城备料 → 放行，且只扣该城 */
        var cost = DATA.BUILDINGS.minfang.levelCost(cB.cells[mi].build.lvl);
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(cB)[k] = cost[k] || 0; });
        var beforeB = sum4(G.res(cB));
        st.queues.build = []; cB.cells[mi].pending = null;
        var r2 = G.upgradeAt(cB.id, mi);
        var paidB = r2.ok === true && sum4(G.res(cB)) < beforeB && sum4(G.res(c)) === beforeA;
        st.cities = st.cities.filter(function (x) { return x.id !== 'sm161y'; });
        st.queues.build = bkQ;
        return blocked && paidB;
      } finally { G.ui._cityId = bkCity; }
    })());
    check('§161 ★ 金通用：货按城（差 1 也不行）· 金走玩家池（真调 payCostIn）', (function () {
      var st = G.state, c = G.currentCity();
      var bkCity = G.ui._cityId, bkGold = st.gold;
      try {
        G.ui._cityId = c.id;
        var cC = G.makeCity({ id: 'sm161z', name: 'sm161丙城', x: 632, y: 632, type: 'self' });
        G.registerCity(cC);
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(cC)[k] = 0; });
        var mix = { grain: 1000, gold: 500 };
        G.res(cC).grain = 1000;
        var ok1 = G.canAffordIn(cC, mix) === true;
        G.res(cC).grain = 999;
        var ok2 = G.canAffordIn(cC, mix) === false;      /* 货差 1：金再多也不替货 */
        G.res(cC).grain = 1000; st.gold = 9000;
        G.payCostIn(cC, mix);
        var paid = Math.round(G.res(cC).grain) === 0 && G.goldOf() === 8500;
        st.cities = st.cities.filter(function (x) { return x.id !== 'sm161z'; });
        return ok1 && ok2 && paid;
      } finally { G.ui._cityId = bkCity; st.gold = bkGold; }
    })());
    check('§161 返还进该城：拆除 / 取消建造（源码级 · 两处都带 city 参数）', (function () {
      return /GAME\.refundCert = function \(cost, ratio, city\)/.test(dS161)
        && /GAME\.refundCert\(step, DATA\.DEMOLISH_RATE, city\)/.test(dS161)
        && /GAME\.refundCert\(out, DATA\.DEMOLISH_RATE, city\)/.test(dS161)
        && /var _rd161 = GAME\.cityById\(q\.cityId\) \|\| GAME\.currentCity\(\)/.test(dS161);
    })());
    check('§161 调运清单去金 + 金悬停写"全境通用"+ 折损现实换算出口', (function () {
      return G.TRANSPORT_KEYS.indexOf('gold') < 0
        && /黄金：\*\*全境通用\*\*/.test(uS161)
        && /ui\.rotPeriodRealText = function/.test(uS161)
        && /（金：全境通用 · 粮木石铁：按本城结算）/.test(uS161);
    })());
    check('§161 新城入库唯一出口：3 处 cities.push 全部改走 registerCity（源码级）', (function () {
      var bS161 = stripComment(fs161.readFileSync(p161.join(__dirname, 'js', 'battle.js'), 'utf8'));
      return /\bGAME\.registerCity\(/.test(dS161.replace(/GAME\.registerCity = function[\s\S]{0,400}?\n  \};/, ''))
        && /\bGAME\.registerCity\(/.test(bS161)
        && !/s\.cities\.push\(/.test(bS161.replace(/attachGold[\s\S]{0,80}?registerCity/, ''))
        && (bS161.match(/GAME\.registerCity\(/g) || []).length === 2;
    })());
    check('§161④ 需求档案在册（v89.161 · 老板原文关键句逐字）', (function () {
      var arc = fs161.readFileSync(p161.join(__dirname, '需求档案.md'), 'utf8');
      return arc.indexOf('v89.161') >= 0
        && arc.indexOf('什么城池的建筑就用对应城池的') >= 0
        && arc.indexOf('只有黄金是玩家层级通用的') >= 0
        && arc.indexOf('不可跨城消耗资源，需要转运') >= 0;
    })());
  })();

"""
OLDT = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
rep('smoke · 新增 §161 节', OLDT, SEC + OLDT, '161. v89.161（黄金上收玩家池 · 谁的城用谁的货）')

print('\n补丁 E 完成。')
