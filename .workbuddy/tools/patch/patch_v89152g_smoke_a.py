# -*- coding: utf-8 -*-
# v89.152g：smoke-test.js 断言升级（珠宝新体系 + 面板产出行 + 迁移节）
# 纪律：逐段落盘（每段 replace 后立即 write） + 幂等守卫（新特征已存在则跳过）
import io, re

P = 'E:/Deepseekdb/smoke-test.js'
S = io.open(P, encoding='utf-8', newline='').read()
orig = len(S)
n_done = 0


def rep(tag, old, new, guard=None):
    """段替换：guard 命中则跳过；否则 old 必须 count==1；替换后立即写盘"""
    global S, n_done
    g = guard or new[:40]
    if g in S:
        print('  skip ' + tag)
        return
    c = S.count(old)
    assert c == 1, tag + ' count=' + str(c)
    S = S.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(S)
    n_done += 1
    print('  OK   ' + tag)


# ---------- 1. 初始宝物 ----------
rep('init-items',
    u"check('初始宝物', s.items.shennongchu === 1 && s.items.zhenzhu === 5);",
    u"check('初始宝物', s.items.shennongchu === 1 && s.items.bengzhu === 5);   /* v89.152：初始珠宝 = 蚌珠 */",
    guard=u's.items.bengzhu === 5')

# ---------- 2. 晋爵造数 ----------
rep('rank-seed',
    u"s.rep = 5000; s.res.gold = 100000; s.items.zhenzhu = 15; s.items.shanhu = 10; s.items.liuli = 5; // 15-10=5 留给后续用例",
    u"s.rep = 5000; s.res.gold = 100000; s.items.bengzhu = 15; s.items.mila = 10; // v89.152：公士需求=蚌珠10+蜜蜡5（扣后各余 5）",
    guard=u's.items.bengzhu = 15')

# ---------- 3. 赏赐 ----------
rep('gift',
    u"""  var r11 = G.systems.useItem('zhenzhu', g0.id);
  check('珍珠赏赐忠诚+5', r11.ok === true && g0.loyalty === 75, '忠=' + g0.loyalty);""",
    u"""  var r11 = G.systems.useItem('bengzhu', g0.id);
  check('蚌珠赏赐忠诚+5', r11.ok === true && g0.loyalty === 75, '忠=' + g0.loyalty);""")

# ---------- 4. 平地可筑城（产出行版） ----------
rep('plain-city',
    u"""  check('平地可筑城且写明无采集价值',
    /平地，<b>无可采之物<\\/b>/.test(uS36) && /data-action="build-city"/.test(uS36));""",
    u"""  /* v89.152（老板 1/5）：产出改在未占面板**分行呈现**（资源/产量加成/材料/珠宝）；
     平地的"无采集价值"落在产出行里（"无可采之物（平原不可采集）"+ 筑城提示）。 */
  check('平地可筑城且写明无采集价值（v89.152 产出行版）',
    /无可采之物（平原不可采集）/.test(uS36) && /占领后可在其上筑新城/.test(uS36)
    && /data-action="build-city"/.test(uS36));""")

# ---------- 5. itemEffect stub ----------
rep('itemeffect-stub',
    u"    var it = { id: 'zhenzhu', name: '珍珠', type: 'jewel', loyalty: 5, price: 2, desc: '赏赐忠诚 +5（爵位晋升亦需）' };",
    u"    var it = { id: 'bengzhu', name: '蚌珠', type: 'jewel', loyalty: 5, price: 2, desc: '赏赐忠诚 +5（湖泊所产）' };")

# ---------- 6. 背包宝物页 ----------
rep('bag-jewel',
    u"""    st.items = st.items || {};
    st.items.zhenzhu = 3;
    G.ui._bagTab = 'item';
    var h = G.ui.bagItemHTML('type');
    var first = h.indexOf('珍珠');""",
    u"""    st.items = st.items || {};
    st.items.bengzhu = 3;                     /* v89.152：蚌珠（新体系低档珠） */
    G.ui._bagTab = 'item';
    var h = G.ui.bagItemHTML('type');
    var first = h.indexOf('蚌珠');""", guard=u'st.items.bengzhu = 3')

# ---------- 7. NEW_ITEM_IDS 样本 ----------
rep('new-item-ids',
    u"  var NEW_ITEM_IDS = ['xueshanhu', 'chuanguo', 'huyi', 'sixiang', 'jifeng', 'shennongling', 'taozhufu',",
    u"  var NEW_ITEM_IDS = ['jiaorenlei', 'dushanyu', 'huyi', 'sixiang', 'jifeng', 'shennongling', 'taozhufu',")

# ---------- 8. 背包使用对象 ----------
rep('bag-target-a',
    u"    s.items = { zhenzhu: 1 };                  /* 珍珠：忠诚 +30 */",
    u"    s.items = { bengzhu: 1 };                  /* 蚌珠：忠诚 +5 */")
rep('bag-target-b',
    u"    var r = GAME.systems.useItem('zhenzhu', tid);",
    u"    var r = GAME.systems.useItem('bengzhu', tid);")

# ---------- 9. 寄售 A/B 段 ----------
rep('consign-a2',
    u"""    check('A2 单价 = price×100×rate（珍珠 2 → 150）',
      G.systems.consignPriceOf('zhenzhu') === Math.floor(2 * 100 * 0.75),
      'zhenzhu=' + G.systems.consignPriceOf('zhenzhu'));""",
    u"""    check('A2 单价 = price×100×rate（蚌珠 2 → 150）',
      G.systems.consignPriceOf('bengzhu') === Math.floor(2 * 100 * 0.75),
      'bengzhu=' + G.systems.consignPriceOf('bengzhu'));""")
rep('consign-b',
    u"""    S100.items.zhenzhu = 2;
    var g100 = S100.res.gold;
    var rB100 = G.systems.consignItem('zhenzhu', 1);
    check('B1 寄售 1 件珍珠：金 +150', rB100.ok === true && S100.res.gold === g100 + 150,
      'gold ' + g100 + ' → ' + S100.res.gold);
    check('B2 库存 2 → 1', S100.items.zhenzhu === 1);
    var rB2 = G.systems.consignItem('zhenzhu', 0);        /* 0 = 全部 */
    check('B3 数量 0 = 全部寄售（1 → 清空）', rB2.ok === true && !S100.items.zhenzhu,
      'gold=' + S100.res.gold);
    var rB3 = G.systems.consignItem('zhenzhu', 1);""",
    u"""    S100.items.bengzhu = 2;
    var g100 = S100.res.gold;
    var rB100 = G.systems.consignItem('bengzhu', 1);
    check('B1 寄售 1 件蚌珠：金 +150', rB100.ok === true && S100.res.gold === g100 + 150,
      'gold ' + g100 + ' → ' + S100.res.gold);
    check('B2 库存 2 → 1', S100.items.bengzhu === 1);
    var rB2 = G.systems.consignItem('bengzhu', 0);        /* 0 = 全部 */
    check('B3 数量 0 = 全部寄售（1 → 清空）', rB2.ok === true && !S100.items.bengzhu,
      'gold=' + S100.res.gold);
    var rB3 = G.systems.consignItem('bengzhu', 1);""")

# ---------- 10. 寄售 E1/E2 ----------
rep('consign-e1',
    u"""      S100.items = { zhenzhu: 1, fatie: 1, lianbing_jingyan: 1 };
      var lst = G.systems.consignList({ only: ['jewel', 'material'] });
      var ids = lst.map(function (x) { return x.id; });
      return ids.indexOf('zhenzhu') >= 0 && ids.indexOf('fatie') >= 0""",
    u"""      S100.items = { bengzhu: 1, fatie: 1, lianbing_jingyan: 1 };
      var lst = G.systems.consignList({ only: ['jewel', 'material'] });
      var ids = lst.map(function (x) { return x.id; });
      return ids.indexOf('bengzhu') >= 0 && ids.indexOf('fatie') >= 0""")
rep('consign-e2',
    u"""      S100.items = { zhenzhu: 2, fatie: 2, lianbing_jingyan: 2 };
      var r = G.systems.consignAll({ only: ['jewel', 'material'] });
      return r.ok === true && !S100.items.zhenzhu && !S100.items.fatie""",
    u"""      S100.items = { bengzhu: 2, fatie: 2, lianbing_jingyan: 2 };
      var r = G.systems.consignAll({ only: ['jewel', 'material'] });
      return r.ok === true && !S100.items.bengzhu && !S100.items.fatie""")

io.open(P, 'w', encoding='utf-8', newline='').write(S)
print('PART-A done (%d segs), len %d -> %d' % (n_done, orig, len(S)))
