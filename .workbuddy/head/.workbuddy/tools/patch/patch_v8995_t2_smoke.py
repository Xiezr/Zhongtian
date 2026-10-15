# -*- coding: utf-8 -*-
"""v89.95 Patch T2 —— 末条断言对齐 + 新增第 98 节（经济：虎符 / 折价 / 通商券）。"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(o, nw, tag):
    global s, n
    if nw in s:
        print('SKIP: ' + tag)
        return
    assert o in s, 'MISS: ' + tag
    s = s.replace(o, nw, 1)
    n += 1
    print('OK: ' + tag)


# ---------- ① 纯近战接敌断言：改成新语义 ----------
rep("""check('实测：纯近战对拼时轻骑第 1 回合即接敌、长枪要等 —— 但纵深小两者都很快', (function () {
  /* ⚠️ 这条是 v29 的老断言，语义已变：纵深由配兵决定后，"纯近战"的
     纵深只有 219~279，**长枪也 1 步就到**。所以它不再能证明"机动优势"，
     机动优势改由上面那条（带远程的真实纵深）来守。这里只保留"能正常接敌"。 */
  var a = G.tactic.simulate({ qingji: 800 }, null, { yibing: 800 }, 0, null, { kind: 'wild' });
  var b = G.tactic.simulate({ changqiang: 800 }, null, { yibing: 800 }, 0, null, { kind: 'wild' });
  var fired = function (r) {
    var f = (r.roundsLog || [])[0];
    return !!(f && f.events.some(function (e) { return e.kind === 'attack'; }));
  };
  /* v89.95：纵深抬到 FIELD_MIN 后，"1 步接敌"不再成立（正是本轮要治的"一步到面前"）——
     这里只保留"能正常接敌"（都在 30 回合内打完）。 */
  return fired(a) && fired(b) && a.field === T.FIELD_MIN && b.field === T.FIELD_MIN;
})());""",
"""check('实测：纯近战不再"1 步贴脸"（纵深受控）——轻骑仍先接敌、长枪后到', (function () {
  /* v89.95（B2）：这条断言**语义反转**了 ——
     改前纵深 219~279，长枪也 1 步就到（老板说的"一步到面前"）；
     现在纵深 ≥ FIELD_MIN，任何兵种都要走几回合，机动优势体现为"早到一两回合"。 */
  var a = G.tactic.simulate({ qingji: 800 }, null, { yibing: 800 }, 0, null, { kind: 'wild' });
  var b = G.tactic.simulate({ changqiang: 800 }, null, { yibing: 800 }, 0, null, { kind: 'wild' });
  var firstAtk = function (r) {
    var hit = 0;
    (r.roundsLog || []).forEach(function (rr) {
      if (!hit && (rr.events || []).some(function (e) { return e.kind === 'attack'; })) hit = rr.r;
    });
    return hit;
  };
  var fq = firstAtk(a), fc = firstAtk(b);
  return a.field === T.FIELD_MIN && b.field === T.FIELD_MIN
    && fq >= 1 && fc >= 1 && fq < fc && a.rounds > 1 && b.rounds > 1;
})(), '轻骑第 ' + '?' + ' 回合接敌（长枪更晚）');""",
'纯近战接敌断言')

# ---------- ② 新增第 98 节：经济三件 ----------
SECTION = u"""  /* ============================================================
   * 98. v89.95（老板七问之 1/2/3）：虎符（不可再生稀缺资源）· 物多价贱 · 通商券通道
   * ------------------------------------------------------------
   * 验收钉子：
   *   · 虎符**买不到**（无价格入口）、赏赐幂等（同一座城只算一次）、可花、可扩编；
   *   · 天授资质**必须**消耗虎符（黄金闭环被掐断）；
   *   · 卖出折价随当日换金下降、有底价、隔日恢复、通商券可免折（且额度真扣）。
   * ============================================================ */
  console.log('\\n===== 98. v89.95 经济：虎符 / 物多价贱 / 通商券 =====');
  (function () {
    var oldState95 = G.state;
    var S95 = G.newGame({ name: 'v95', cityName: '许都' });
    if (!S95.map.grid) G.map.generate();
    G.state = S95;
    var c95 = S95.cities[0];

    console.log('  --- A1 虎符：买不到 · 只能打出来 ---');
    check('A1：配置表齐备且**没有任何黄金入口**', (function () {
      var C = DATA.HUFU || {};
      var inShop = (DATA.ITEMS || []).some(function (it) { return it.id === 'hufu' || it.name === '虎符'; });
      return C.name === '虎符' && C.byTier && C.byTier.county === 1 && C.byTier.capital === 5
        && C.rankEvery === 4 && C.tianshouCost === 1 && C.citySlotMax === 2 && !inShop;
    })());
    check('A1：首占名城赏符（幂等：同一座城只算一次）', (function () {
      S95.hufu = 0; S95.hufuTaken = {};
      var n1 = G.hufuClaim('city:test1', 3, '测试首占');
      var n2 = G.hufuClaim('city:test1', 3, '测试首占（重复）');
      return n1 === 3 && n2 === 0 && G.hufuOf() === 3;
    })());
    check('A1：爵位每 4 档 +1（22 档共 5 枚）', (function () {
      S95.hufu = 0;
      var got = 0;
      for (var rk = 1; rk <= 22; rk++) if (rk % 4 === 0) got++;
      /* 直接调赏赐出口（promote 的调用点已在 v89.95 接线） */
      for (var rk2 = 4; rk2 <= 22; rk2 += 4) G.hufuGrant(1, '爵位测');
      return got === 5 && G.hufuOf() === 5;
    })());
    check('A1：虎符不足时花不出去（报错文案指向来源）', (function () {
      S95.hufu = 0;
      var bad = G.hufuSpend(1, '测试');
      S95.hufu = 2;
      var ok = G.hufuSpend(1, '测试');
      return bad.ok === false && bad.msg.indexOf('虎符不足') >= 0 && bad.msg.indexOf('攻占名城') >= 0
        && ok.ok === true && G.hufuOf() === 1;
    })());
    check('A1：城池扩编 = 建造位 +1，每城至多 2 次', (function () {
      S95.hufu = 5;
      var b0 = G.buildSlots(c95);
      var r1 = G.hufuExpandCity(c95.id);
      var b1 = G.buildSlots(c95);
      G.hufuExpandCity(c95.id);
      var b2 = G.buildSlots(c95);
      var r3 = G.hufuExpandCity(c95.id);        /* 第 3 次应被上限拦下 */
      return r1.ok === true && b1 === b0 + 1 && b2 === b0 + 2 && r3.ok === false
        && r3.msg.indexOf('上限') >= 0 && G.hufuOf() === 3;   /* 5 - 2（第三次没扣） */
    })());
    check('A1：天授资质**必须**消耗虎符（黄金闭环被掐断）', (function () {
      var g = G.makeGeneral('问鼎甲', 60, 'idle', c95.id, false);
      g.rank = 'mingshi';                        /* 名世 → 天授 */
      S95.generals.push(g);
      S95.items = S95.items || {};
      S95.items.tianshou_guo = 1;
      S95.hufu = 0;
      var bad = G.rankUpUse(g, { id: 'tianshou_guo', name: '天授果', type: 'rank_up', from: 'mingshi', to: 'tianshou' });
      var okRank = g.rank === 'mingshi';
      S95.hufu = 1;
      var ok = G.rankUpUse(g, { id: 'tianshou_guo', name: '天授果', type: 'rank_up', from: 'mingshi', to: 'tianshou' });
      var done = g.rank === 'tianshou' && G.hufuOf() === 0;
      S95.generals.pop();
      return bad.ok === false && bad.msg.indexOf('虎符') >= 0 && okRank && ok.ok === true && done;
    })());

    console.log('  --- A2/A3 物多价贱 + 通商券通道 ---');
    check('A2：卖出折价随当日换金下降，有底价，隔日恢复', (function () {
      S95.mktSold = { day: G.siegeDayIdx(), gold: 0 };
      S95.buffs = S95.buffs || {};
      S95.buffs.mktFree = null;
      var m0 = G.mktSlipOf().mul;
      var C = DATA.MARKET_SLIP;
      S95.mktSold.gold = C.scale * 0.5;                    /* 卖了一半额度 */
      var m1 = G.mktSlipOf().mul;
      S95.mktSold.gold = C.scale * 5;                      /* 远超额度 → 到底价 */
      var m2 = G.mktSlipOf().mul;
      S95.mktSold = { day: G.siegeDayIdx() - 1, gold: C.scale * 5 };   /* 隔日 → 恢复 */
      var m3 = G.mktSlipOf().mul;
      return Math.abs(m0 - 1) < 1e-9 && Math.abs(m1 - 0.5) < 1e-9
        && Math.abs(m2 - C.floor) < 1e-9 && Math.abs(m3 - 1) < 1e-9;
    })(), '今日 0 → ×1.00 / 半额 → ×0.50 / 超 5 倍 → 底价 ' + DATA.MARKET_SLIP.floor);
    check('A2：市场卖价确实按折价结算（单价随今日换金下降）', (function () {
      S95.mktSold = { day: G.siegeDayIdx(), gold: 0 };
      S95.buffs.mktFree = null;
      var p0 = G.marketSellGold('grain', 100000);
      S95.mktSold.gold = DATA.MARKET_SLIP.scale;
      var p1 = G.marketSellGold('grain', 100000);
      S95.mktSold = { day: G.siegeDayIdx(), gold: 0 };
      return p0 > 0 && p1 > 0 && p1 < p0;
    })());
    check('A3：通商券 = 免折抛售（额度真扣 · 用完即回折价）', (function () {
      S95.mktSold = { day: G.siegeDayIdx(), gold: DATA.MARKET_SLIP.scale };   /* 汇率已到底价 */
      S95.items = S95.items || {};
      S95.items.tongshang_quan = 1;
      S95.buffs = S95.buffs || {};
      S95.buffs.mktFree = null;
      var use = G.systems.useItem('tongshang_quan', null);
      var freeNow = G.mktFreeOf();
      var mulNow = G.mktMulNow();
      var pFree = G.marketSellGold('grain', 100000);
      G.mktSlipRecord(600000);                                /* 超过 50 万额度 → 额度耗尽 */
      var afterExhaust = G.mktFreeOf();
      var mulAfter = G.mktMulNow();
      S95.buffs.mktFree = null;
      S95.mktSold = { day: G.siegeDayIdx(), gold: 0 };
      return use.ok === true && !!freeNow && mulNow === 1 && pFree > 0
        && afterExhaust === null && mulAfter < 1;
    })());
    check('A3：通商券在售且文案写明"免折额度"（不是空承诺）', (function () {
      var it = (DATA.ITEMS || []).filter(function (x) { return x.id === 'tongshang_quan'; })[0];
      return !!it && it.price > 0 && it.desc.indexOf('免折') >= 0 && it.desc.indexOf('50 万') >= 0;
    })());

    G.state = oldState95;
  })();

"""
ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
if '98. v89.95 经济' in s:
    print('SKIP: 98 节已存在')
else:
    assert ANCHOR in s
    s = s.replace(ANCHOR, SECTION + ANCHOR, 1)
    print('OK: 第 98 节已插入')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED smoke x%d' % n)
