# -*- coding: utf-8 -*-
"""v89.194 批次G：smoke §194 断言段（本轮五条需求 + UI 三处 + 雷达圈）"""
import io

R = 'E:/Deepseekdb/'
SM = R + 'smoke-test.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

MARK = '§194② 营造金五档'
s = rd(SM)
if s.count(MARK) >= 1:
    print('[skip] §194 段（已落盘）')
    raise SystemExit(0)

SECTION = u'''  /* ============================================================
   * §194. v89.194（老板本批）：S1 建筑营造金 · S2 价格口径 · S3 藏珍阁 ·
   *   S4 欠俸忠诚 · UI 三处（按钮位移 §194① 已在原处升级）· 前哨雷达圈（欧氏）
   * ============================================================ */
  console.log('\\n===== 194. v89.194（营造金 · 藏珍阁 · 欠俸忠诚 · 雷达圈） =====');
  (function () {
    var fs194 = require('fs'), p194 = require('path');
    var raw194 = function (f) { return fs194.readFileSync(p194.join(__dirname, 'js', f), 'utf8'); };
    var rd194 = function (f) { return stripComment(raw194(f)); };
    var dS194 = rd194('domain.js'), uS194 = rd194('ui.js'), mS194 = rd194('main.js');
    var hS194 = raw194('..\\index.html') || '';
    if (!hS194) hS194 = fs194.readFileSync(p194.join(__dirname, 'index.html'), 'utf8');

    console.log('  --- ② S1：建筑营造金（Lv9 起）---');
    /* v89.192 报告 S1 拍板值：Lv9=3000 / Lv10=6000 / Lv11=12000 / Lv12+=24000；
       Lv1-8 零金 = 保前期流畅的**护栏**（防误伤）。 */
    check('§194② 营造金五档：升 Lv9/10/11/12+ = 3000/6000/12000/24000 · Lv1-8 零金', (function () {
      var g = function (bid, lv) { var c = DATA.BUILDINGS[bid].levelCost(lv); return c && c.gold ? c.gold : 0; };
      return g('guanfu', 7) === 0 && g('guanfu', 8) === 3000
        && g('guanfu', 9) === 6000 && g('guanfu', 10) === 12000
        && g('guanfu', 11) === 24000 && g('guanfu', 12) === 24000 && g('guanfu', 20) === 24000
        && g('minfang', 8) === 3000 && g('chengqiang', 8) === 3000
        && (G.extBuildCost('farm', 8).gold || 0) === 0;
    })());
    check('§194② 唯一出口 DATA.buildGoldAt（低档 0 / 越档封顶）', (function () {
      return DATA.buildGoldAt(8) === 0 && DATA.buildGoldAt(9) === 3000
        && DATA.buildGoldAt(99) === 24000;
    })());
    check('§194② 真调支付/退款链：canAffordIn 按金判 · payCostIn 扣金 · refundCert 退还', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194pay', cityName: '许都' });
      G.state = st;
      try {
        var c = st.cities[0];
        var cost = { gold: 3000, grain: 100, wood: 100, stone: 100, iron: 100 };
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 999999; });
        G.goldAdd(-G.goldOf());
        var no = G.canAffordIn(c, cost) === false;
        G.goldAdd(3500);
        var yes = G.canAffordIn(c, cost) === true;
        G.payCostIn(c, cost);
        var afterPay = G.goldOf() === 500;
        G.refundCert(cost, 1.0, c);
        var afterBack = G.goldOf() === 3500;
        return no && yes && afterPay && afterBack;
      } finally { G.state = bk; }
    })());
    check('§194② 缺料提示唯一出口：costLackMsg 报缺项（金标"全境通用"）· 五处同源', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194lack', cityName: '许都' });
      G.state = st;
      try {
        var c = st.cities[0];
        G.goldAdd(-G.goldOf());
        var msg = GAME.costLackMsg(c, { gold: 3000, grain: 500 });
        var okMsg = /金 3,000/.test(msg) && /粮食 500/.test(msg) && /全境通用/.test(msg);
        var n = (dS194.match(/GAME\\.costLackMsg\\(city, cost\\) \\|\\|/g) || []).length;
        return okMsg && n === 5;
      } finally { G.state = bk; }
    })());

    console.log('  --- ③ S2：商品价格表口径 ---');
    /* 老板：「兵圣可不是4000」——4000 是**内部价**（商城实售口径 = ×100 = 40 万金）。
       本断言把"实售口径"钉死，防后人再把内部价当实售价引用。 */
    check('§194③ 价格口径锚：兵圣内部价 4000 × 100 = 实售 40 万金（商城统一口径）', (function () {
      var u = raw194('ui.js');
      var it = DATA.ITEM_BY_ID.bingsheng;
      return it && it.price === 4000 && it.price * 100 === 400000
        && DATA.ITEM_BY_ID.bingxian_yipian.price * 100 === 240000
        && /it\\.price \\* 100/.test(u) && /price \\* 100/.test(u);
    })());
    check('§194③ 价格表唯一来源：ITEMS[].price（在售件皆有价且 ×100 为整数金）', (function () {
      var shop = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && !it.noShop && !it.dropOnly && !!G.ui.SHOP_CATS[it.type];
      });
      var bad = shop.filter(function (it) { return !(it.price * 100 > 0); });
      return shop.length >= 100 && bad.length === 0;
    })());

    console.log('  --- ④ S3：藏珍阁（收藏）---');
    check('§194④ 数据表：18 系列 / 73 件 / id 全唯一 / 与 ITEMS 零冲突 / 价格为正', (function () {
      var C = DATA.COLLECT || { series: [] };
      var ids = {}, dup = 0, n = 0, badP = 0;
      (C.series || []).forEach(function (sr) {
        (sr.items || []).forEach(function (it) {
          n++; if (ids[it.id]) dup++; ids[it.id] = 1;
          if (!(it.price > 0)) badP++;
        });
      });
      var clash = (DATA.ITEMS || []).filter(function (x) { return ids[x.id]; }).length;
      return C.series.length === 18 && n === 73 && dup === 0 && clash === 0 && badP === 0
        && /col_zhangliao/.test(JSON.stringify(C));
    })());
    check('§194④ 购买唯一出口：扣金 / 入藏 / 重复拒 / 金不足拒（不扣金）· 真调', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194col', cityName: '许都' });
      G.state = st;
      try {
        var it1 = DATA.COLLECT.series[0].items[0];
        G.goldAdd(1000000 - G.goldOf());
        var g0 = G.goldOf();
        var r1 = G.collectBuy(it1.id);
        var paid = r1.ok === true && (g0 - G.goldOf()) === it1.price && G.collectHaveOf(it1.id) === true;
        var r2 = G.collectBuy(it1.id);
        var again = r2.ok === false && G.goldOf() === g0 - it1.price;
        G.goldAdd(-G.goldOf());
        var it2 = DATA.COLLECT.series[0].items[1];
        var r3 = G.collectBuy(it2.id);
        var poor = r3.ok === false && G.goldOf() === 0 && !G.collectHaveOf(it2.id);
        return paid && again && poor;
      } finally { G.state = bk; }
    })());
    check('§194④ 集齐系列：声望入账（真调）· 编年史在册 · 全收 allRep 幂等', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194col2', cityName: '许都' });
      G.state = st;
      try {
        G.goldAdd(5e7);
        var sr = DATA.COLLECT.series[0];
        var rep0 = st.rep || 0;
        sr.items.forEach(function (it) { G.collectBuy(it.id); });
        var got = (st.rep || 0) - rep0 === sr.rep;
        var d = G.collectSeriesDoneOf(sr.id);
        var chron = (st.chronicle || []).length;
        /* 全收集 → allRep 一次；随后再触发一次收藏购买（重复分支）→ 不再发 */
        (DATA.COLLECT.series || []).forEach(function (s2) {
          (s2.items || []).forEach(function (it) { G.collectBuy(it.id); });
        });
        var stAll = G.collectStatOf();
        var bonus = st.collectAllBonus === 1;
        var repA = st.rep || 0;
        G.collectBuy(sr.items[0].id);         /* 重复 → 拒 */
        var idem = (st.rep || 0) === repA;
        return got && d.done === true && chron >= 1 && bonus
          && stAll.have === stAll.total && idem;
      } finally { G.state = bk; }
    })());
    check('§194④ 一键集齐：预检总价（不足不买半套）· 逐件走同一出口', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194col3', cityName: '许都' });
      G.state = st;
      try {
        var sr = DATA.COLLECT.series[1];
        G.goldAdd(-G.goldOf());
        var r1 = G.collectBuySeries(sr.id);
        var noHalf = r1.ok === false && G.collectSeriesDoneOf(sr.id).have === 0;
        G.goldAdd(5e6);
        var r2 = G.collectBuySeries(sr.id);
        var d = G.collectSeriesDoneOf(sr.id);
        var r3 = G.collectBuySeries(sr.id);
        return noHalf && r2.ok === true && r2.bought === d.total && d.done === true && r3.ok === false;
      } finally { G.state = bk; }
    })());
    check('§194④ 界面结构：导航 tab / renderView 分支 / collectHTML / 三 case（源码级）', (function () {
      return hS194.indexOf('data-view="collection"><i class="ti" data-nav="collection"></i>收藏') >= 0
        && uS194.indexOf("else if (v === 'collection') box.innerHTML = ui.collectHTML();") >= 0
        && uS194.indexOf('ui.collectHTML = function') >= 0
        && uS194.indexOf('data-action="collect-buy"') >= 0
        && uS194.indexOf('data-action="collect-series"') >= 0
        && mS194.indexOf("case 'collect-cat':") >= 0
        && mS194.indexOf("case 'collect-buy':") >= 0
        && mS194.indexOf("case 'collect-series':") >= 0
        && raw194('icons.js').indexOf('collection:') >= 0;
    })());

    console.log('  --- ⑤ S4：欠俸降忠诚 + 0 忠诚禁出征 ---');
    check('§194⑤ 欠俸扣忠诚（真调）：−10 · 君主豁免 · 连欠封顶 −20', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194loy', cityName: '许都' });
      G.state = st;
      try {
        var gens = (st.generals || []).filter(function (x) { return !G.isLordGeneral(x); });
        var lord = (st.generals || []).filter(function (x) { return G.isLordGeneral(x); })[0];
        if (!gens.length || !lord) return false;
        var g1 = gens[0], l0 = g1.loyalty, lL = lord.loyalty;
        G.goldAdd(-G.goldOf());
        st.salaryAt = st.world.elapsed - 8 * 86400;
        var r1 = G.settleGenSalary();
        var d1 = (l0 - g1.loyalty) === 10 && r1 && r1.drop === 10 && lord.loyalty === lL;
        st.salaryAt = st.world.elapsed - 25 * 86400;
        var r2 = G.settleGenSalary();
        var d2 = !!(r2 && r2.drop === 20);
        return d1 && d2;
      } finally { G.state = bk; }
    })());
    check('§194⑤ 忠诚 0 禁出征（唯一出口 marchBlockOf）· 恢复后可出征', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194loy2', cityName: '许都' });
      G.state = st;
      try {
        var g1 = (st.generals || []).filter(function (x) { return !G.isLordGeneral(x); })[0];
        if (!g1) return false;
        var bkL = g1.loyalty;
        g1.loyalty = 0;
        var blocked = G.marchBlockOf(g1) === '忠诚已尽（赏赐珠宝可安抚）' && G.canMarch(g1) === false;
        g1.loyalty = 30;
        var ok = G.marchBlockOf(g1) === null && G.canMarch(g1) === true;
        g1.loyalty = bkL;
        return blocked && ok;
      } finally { G.state = bk; }
    })());
    check('§194⑤ 口径反转在册：DATA 字段 + 域层扣减（源码级）', (function () {
      return /salaryDrop: 10,/.test(raw194('data.js'))
        && /salaryDropMax: 20,/.test(raw194('data.js'))
        && /v89\\.194（老板 S4）/.test(raw194('domain.js'))
        && /欠俸挫伤军心/.test(raw194('domain.js'));
    })());

    console.log('  --- ⑥ UI 三处 ---');
    check('§194⑥ 城主标签退役（mayor 不渲染）· 月俸行 · 宝具备注行退役（源码级）', (function () {
      return uS194.indexOf("g.status !== 'mayor'") >= 0
        && uS194.indexOf('gp-sal194') >= 0
        && uS194.indexOf("'月俸：' + (GAME.isLordGeneral(g)") >= 0
        && /if \\(!pool186\\.length\\) return '';/.test(uS194)
        && uS194.indexOf('未佩宝具（打据点/名城有几率缴获）') < 0;
    })());
    check('§194⑥ 月俸 1.5 倍（真调 genSalaryOf）：城主/守将 ×1.5 · 普通不变 · 同城两职等值', (function () {
      var g = { level: 10, rank: 'fan', tong: 50, nz: 50, yw: 50, zm: 50, status: 'idle' };
      var base = G.genSalaryOf(g);
      g.status = 'mayor';
      var mayor = G.genSalaryOf(g);
      g.status = 'guard';
      var guard = G.genSalaryOf(g);
      return base > 0 && Math.abs(mayor - base * 1.5) <= 1 && mayor === guard;
    })());

    console.log('  --- ⑦ 前哨雷达圈（欧氏）---');
    check('§194⑦ 覆盖判定欧氏（真调）：轴向命中 / 半径+1 不命中 / 对角线不命中 / 半对角命中', (function () {
      var bk = G.state;
      var st = G.newGame({ name: 'v194radar', cityName: '许都' });
      G.state = st;
      try {
        var c0 = st.cities[0];
        st.forts = st.forts || {};
        st.forts['100,100'] = { x: 100, y: 100, lv: 6, name: 't', day: 0, cityId: c0.id };
        var R = G.fortRadiusOf(st.forts['100,100']);
        var out = R === 10
          && !!G.fortAuraAt(100 + R, 100)
          && G.fortAuraAt(100 + R + 1, 100) === null
          && G.fortAuraAt(100 + R, 100 + R) === null
          && !!G.fortAuraAt(107, 107);
        delete st.forts['100,100'];
        return out;
      } finally { G.state = bk; }
    })());
    check('§194⑦ 渲染结构：己方过滤 / 椭圆几何 √2 / 淡填充 / 图层在野地框之前（源码级）', (function () {
      var m = raw194('map.js');
      return /if \\(!f194 \\|\\| !f194\\.cityId\\) continue;/.test(m)
        && /R194 \\* HW \\* 1\\.4142/.test(m) && /R194 \\* HH \\* 1\\.4142/.test(m)
        && /rgba\\(140,220,170,\\.055\\)/.test(m)
        && m.indexOf('④a 己方前哨：雷达辐射圈') >= 0
        && m.indexOf('④a 己方前哨：雷达辐射圈') < m.indexOf('④ 已占野地：金色菱形框')
        && /if \\(!ctx \\|\\| !ctx\\.ellipse\\) return;/.test(m);
    })());
  })();

'''

anchor = u"  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
c = s.count(anchor)
assert c == 1, 'anchor count=' + str(c)
s = s.replace(anchor, u"  })();\n\n" + SECTION + u"  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');")
wr(SM, s)
s2 = rd(SM)
assert s2.count(MARK) == 1, '写后自检失败'
print('[ok] §194 段已插入')
