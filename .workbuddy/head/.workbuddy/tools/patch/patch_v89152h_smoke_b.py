# -*- coding: utf-8 -*-
# v89.152h：smoke-test.js 断言升级 PART-B（§120⑤/⑥ 升级 · §121① · §131⑩ · 新增 §152 节）
import io

P = 'E:/Deepseekdb/smoke-test.js'
S = io.open(P, encoding='utf-8', newline='').read()
orig = len(S)
n_done = 0

def rep(tag, old, new, guard):
    global S, n_done
    if guard in S:
        print('  skip ' + tag)
        return
    c = S.count(old)
    assert c == 1, tag + ' count=' + str(c)
    S = S.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(S)
    n_done += 1
    print('  OK   ' + tag)

# ---------- 1. §120⑤ 源码级：addLine139 -> 产出行 ----------
rep('s120-5-src',
    u"        && /addLine139/.test(seg)                                       /* 产量加成并入 note */",
    u"        && /op-zone-t\">产出<\\/div>/.test(seg) && /jewelLvHint139/.test(seg)   /* v89.152：产出行 4 行（资源/产量加成/材料/珠宝） */",
    guard=u'v89.152：产出行 4 行')

# ---------- 2. §120⑤ 实测（已占面板） ----------
rep('s120-5-real',
    u"""      return html.indexOf('（已占）') < 0
        && html.indexOf('守军约') < 0
        && html.indexOf('产量加成') >= 0 && html.indexOf('此地可采') >= 0
        && /data-action="wild-garrison-gather"/.test(html)""",
    u"""      return html.indexOf('（已占）') < 0
        && html.indexOf('守军约') < 0
        /* v89.152（老板 5）：已占野地**不显示产出行** —— 产量加成/可采/材料/珠宝全撤 */
        && html.indexOf('op-zone-t">产出') < 0 && html.indexOf('>产量加成<') < 0
        && html.indexOf('此地可采') < 0 && html.indexOf('>材料<') < 0 && html.indexOf('>珠宝<') < 0
        && /data-action="wild-garrison-gather"/.test(html)""",
    guard=u'已占野地**不显示产出行**')

# ---------- 3. §120⑥ 覆盖断言 -> §152① ----------
rep('s120-6-a',
    u"""    check('§120⑥ 珠宝覆盖：爵位所需 9 种全有地形产出（含夜明珠·山） + 等级门槛 + 数量随级', (function () {
      var G2 = DATA.GATHER;
      var lad = DATA.jewelLadder();
      var need9 = ['zhenzhu', 'shanhu', 'liuli', 'hupo', 'manao', 'shuijing', 'feicui', 'yushi', 'yemingzhu'];
      var cov = {};
      Object.keys(G2.jewelTable).forEach(function (k) {
        G2.jewelTable[k].forEach(function (id) { cov[id] = 1; });
      });
      var all9 = need9.every(function (id) { return cov[id] === 1; });
      var allInLadder = need9.every(function (id) { return lad.indexOf(id) >= 0; });
      /* 三档结构（每地形 3 颗）—— Lv1 必有产出（见下条实测） */
      var threeTier = Object.keys(G2.jewelTable).every(function (k) {
        return G2.jewelTable[k].length === 3;
      });
      return all9 && allInLadder && threeTier
        && G2.jewelMinLv.yemingzhu === 8 && G2.jewelMinLv.zhenzhu === 1
        && G2.jewelCountPerLv > 0 && G2.jewelMidP > 0
        && /jewelMinLv/.test(dc) && /jewelCountPerLv/.test(dc)
        && /GAME\\.gatherJewelPick = function/.test(dc) && /avail = jt\\.filter/.test(dc);
    })());
    check('§120⑥ 实测：gatherJewelPick —— 每地形 Lv1 都有产出 · 高档需高等级 · 数量随级', (function () {
      /* 直调唯一出口（注入 rnd，不依赖真随机）：rp=0.12, rp+mp=0.37 */
      var P = G.gatherJewelPick;
      var rLow = function () { return 0.9; };    /* → 常见档（第 1 颗） */
      var rTop = function () { return 0.05; };   /* → 稀有档（最后一颗；两档时=第 2 颗） */
      /* ① 每地形 Lv1 都有产出（"任意等级都不空手"） */
      var allT = Object.keys(DATA.GATHER.jewelTable);
      var lv1ok = allT.every(function (t) { return P(t, 1, rLow) !== null; });
      /* ② 山地：Lv3 只出琉璃（玉石门槛 5 / 夜明珠门槛 8）；Lv5 出玉石；Lv8 出夜明珠 */
      var h3 = P('hill', 3, rTop), h5 = P('hill', 5, rTop), h8 = P('hill', 8, rTop);
      /* ③ 平地无珠宝；④ 数量 = 1 + ⌊lv×0.2⌋（Lv8 → 2 颗） */
      return lv1ok
        && h3.id === 'liuli' && h5.id === 'yushi' && h8.id === 'yemingzhu'
        && P('plain', 10, rLow) === null
        && h8.n === 1 + Math.floor(8 * DATA.GATHER.jewelCountPerLv)
        && P('lake', 2, rLow).n === 1;
    })());
    check('§120⑥ 实测：爵位 9 种珠宝需求 与 采集覆盖 交叉核对（RANK 逐档）', (function () {
      var need = {};
      (DATA.RANK || []).forEach(function (rk) {
        Object.keys(rk.jewel || {}).forEach(function (id) { need[id] = 1; });
      });
      var cov = {};
      Object.keys(DATA.GATHER.jewelTable).forEach(function (k) {
        DATA.GATHER.jewelTable[k].forEach(function (id) { cov[id] = 1; });
      });
      var missing = Object.keys(need).filter(function (id) { return !cov[id]; });
      return Object.keys(need).length === 9 && missing.length === 0;
    })());""",
    u"""    /* ---- ⑥ 珠宝体系（v89.152 重设：6 地形 x 3 档 = 18 种 · 共同构成爵位/建筑需求） ---- */
    check('§152① 体系：18 种 / 6 地形 x 3 档各归其位（无重复） / 价格唯一升序 / 常见档门槛 1', (function () {
      var G2 = DATA.GATHER;
      var lad = DATA.jewelLadder();
      var jewels = DATA.ITEMS.filter(function (x) { return x.type === 'jewel'; });
      var c18 = jewels.length === 18 && lad.length === 18;
      var all = [];
      var threeTier = Object.keys(G2.jewelTable).every(function (k) {
        if (G2.jewelTable[k].length !== 3) return false;
        G2.jewelTable[k].forEach(function (id) { all.push(id); });
        return true;
      });
      var uniq = {}; all.forEach(function (id) { uniq[id] = 1; });
      var exclusive = all.length === 18 && Object.keys(uniq).length === 18;
      var ps = jewels.map(function (j) { return j.price; });
      var pset = {}; ps.forEach(function (p) { pset[p] = 1; });
      var asc = true; for (var i = 1; i < ps.length; i++) if (ps[i] <= ps[i - 1]) asc = false;
      var t1 = Object.keys(G2.jewelTable).every(function (k) {
        return ((G2.jewelMinLv || {})[G2.jewelTable[k][0]] || 1) === 1;
      });
      /* 与材料表（另一条体系）零撞 id —— v89.152 真踩过（材料「青玉」） */
      var matIds = (DATA.MATERIALS || []).map(function (m) { return m.id; });
      var noClash = jewels.every(function (j) { return matIds.indexOf(j.id) < 0; });
      return c18 && threeTier && exclusive && Object.keys(pset).length === 18 && asc && t1 && noClash
        && G2.jewelMinLv.dushanyu === 8 && G2.jewelMinLv.bengzhu === 1
        && G2.jewelCountPerLv > 0 && G2.jewelMidP > 0
        && /jewelMinLv/.test(dc) && /jewelCountPerLv/.test(dc)
        && /GAME\\.gatherJewelPick = function/.test(dc) && /avail = jt\\.filter/.test(dc);
    })());
    check('§152① 实测：gatherJewelPick —— 每地形 Lv1 都有产出 · 高档需高等级 · 数量随级', (function () {
      /* 直调唯一出口（注入 rnd，不依赖真随机）：rp=0.12, rp+mp=0.37 */
      var P = G.gatherJewelPick;
      var rLow = function () { return 0.9; };    /* → 常见档（第 1 颗） */
      var rTop = function () { return 0.05; };   /* → 稀有档（最后一颗；两档时=第 2 颗） */
      var allT = Object.keys(DATA.GATHER.jewelTable);
      var lv1ok = allT.every(function (t) { return P(t, 1, rLow) !== null; });
      /* 山地：Lv3 只出绿松石（碧玺门槛 5 / 独山玉 8）；Lv5 出碧玺；Lv8 出独山玉 */
      var h3 = P('hill', 3, rTop), h5 = P('hill', 5, rTop), h8 = P('hill', 8, rTop);
      return lv1ok
        && h3.id === 'lvsongshi' && h5.id === 'bixi' && h8.id === 'dushanyu'
        && P('plain', 10, rLow) === null
        && h8.n === 1 + Math.floor(8 * DATA.GATHER.jewelCountPerLv)
        && P('lake', 2, rLow).n === 1;
    })());
    check('§152① 实测：爵位 18 种珠宝需求 与 采集覆盖 交叉核对（RANK 逐档 · "共同构成"）', (function () {
      var need = {};
      (DATA.RANK || []).forEach(function (rk) {
        Object.keys(rk.jewel || {}).forEach(function (id) { need[id] = 1; });
      });
      var cov = {};
      Object.keys(DATA.GATHER.jewelTable).forEach(function (k) {
        DATA.GATHER.jewelTable[k].forEach(function (id) { cov[id] = 1; });
      });
      var missing = Object.keys(need).filter(function (id) { return !cov[id]; });
      return Object.keys(need).length === 18 && missing.length === 0;
    })());""",
    guard=u'§152① 体系：18 种')

# ---------- 4. §121① 的一行 ----------
rep('s121-1',
    u"      /* ④ 未命中全地形珠时走原地形表：r=0.9 落**常见档**（hill → liuli；lake → zhenzhu） */\n      var norm = P('hill', 8, rMiss).id === 'liuli' && P('lake', 1, rMiss).id === 'zhenzhu';",
    u"      /* ④ 未命中全地形珠时走原地形表：r=0.9 落**常见档**（hill → lvsongshi；lake → bengzhu） */\n      var norm = P('hill', 8, rMiss).id === 'lvsongshi' && P('lake', 1, rMiss).id === 'bengzhu';",
    guard=u"hill → lvsongshi；lake → bengzhu")

# ---------- 5. §131⑩ op-zone-eq 计数 ----------
rep('s131-10',
    u"        && (u131s.match(/op-zone-eq/g) || []).length === 3",
    u"        && (u131s.match(/op-zone-eq/g) || []).length === 4   /* v89.152：+「产出」区 */",
    guard=u'v89.152：+「产出」区')

io.open(P, 'w', encoding='utf-8', newline='').write(S)
print('PART-B done (%d segs), len %d -> %d' % (n_done, orig, len(S)))
