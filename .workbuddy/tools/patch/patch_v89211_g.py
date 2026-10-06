# -*- coding: utf-8 -*-
"""v89.211 补丁 G：测试升级（规则变更重写 + §211 新段）
   G1 攻占"库存继承"断言：empty===1 → 0 空格 + 原墙格民房（v89.211 新规）
   G2 攻占"满配城"断言：minfang total-22 → total-21
   G3/G4 open-siege 源码断言 → 新串
   G5 §107① 城墙迁移：补 assert 原墙格补建民房
   G6 §199④ 版本号 → v89.211
   G7 smoke §211 新段
   G8 e2e §211 新段（真 DOM）
"""
import io
R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

s = rd('smoke-test.js')

# ---------------- G1: 攻占（库存继承）断言 ----------------
if "v89.211 规则变更" in s and "wIdx211" in s:
    print('[skip] G1 已改')
else:
    old = """  check('实测：攻占后建筑就地转正 + 库存继承', (function () {"""
    new = """  check('实测：攻占后建筑就地转正 + 库存继承 + 原墙格补建民居（v89.211 新规）', (function () {"""
    s = sub1(s, old, new, 'G1a')
    old = """      var empty = nc.cells.filter(function (c) { return !c.build; }).length;
      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);
      /* v89.128：城墙提取到环城槽 —— 原墙格释放（empty 应为 1）、等级保留在槽 */
      return empty === 1 && nc.res.grain === want"""
    new = """      var empty = nc.cells.filter(function (c) { return !c.build && !c.pending; }).length;
      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);
      /* v89.211 规则变更（老板 2「占领后发现一格未建造」）：v89.128 城墙提取到环城槽后，
         原墙格**补建民房**（不再留空）—— 占来的"满配城"48 格全建成；等级保留在槽。 */
      var wIdx211 = G.wallPlanIdxOf();
      return empty === 0 && wIdx211 > 0
        && !!nc.cells[wIdx211].build && nc.cells[wIdx211].build.id === 'minfang'
        && nc.res.grain === want"""
    s = sub1(s, old, new, 'G1b')
    wr('smoke-test.js', s)
    print('[ok] G1 攻占库存断言')

# ---------------- G2: 满配城断言 ----------------
s = rd('smoke-test.js')
if "v89.211 规则变更（老板 2）：城墙从影子格" in s:
    print('[skip] G2 已改')
else:
    old = """  check('实测：攻占后建筑与格数就地转正（拿到的就是满配城）', (function () {"""
    new = """  check('实测：攻占后建筑与格数就地转正（拿到的就是满配城 · v89.211 原墙格补民居）', (function () {"""
    s = sub1(s, old, new, 'G2a')
    old = """      /* v63：布局按**建筑等级**算（郡城 → 7+4=11），否则比的是另一座城 */
      var want = G.cityPlanOf(7, G.npcBuildLvOf(tgt)), c = countOf({ cells: nc.cells });
      /* v89.128：城墙从影子格提取到**环城槽**（不占 cells）——等级保留、那一格释放 */
      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row
        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 22"""
    new = """      /* v63：布局按**建筑等级**算（郡城 → 7+4=11），否则比的是另一座城 */
      var want = G.cityPlanOf(7, G.npcBuildLvOf(tgt)), c = countOf({ cells: nc.cells });
      /* v89.211 规则变更（老板 2）：城墙从影子格提取到环城槽（不占 cells）后，
         原墙格**补建民房** —— 民房 26→27（= total−21）；等级保留在槽。 */
      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row
        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 21"""
    s = sub1(s, old, new, 'G2b')
    wr('smoke-test.js', s)
    print('[ok] G2 满配城断言')

# ---------------- G3/G4: open-siege 源码断言 ----------------
s = rd('smoke-test.js')
old3 = """  check('#14 募兵面板按建筑分流',
    /case 'open-siege': ui\\.openTroops\\(ui\\._trainBIdx, 'siege'\\)/.test(mS16)
    && /ui\\.openTroops = function/.test(uS16) && /_trainFilter === 'siege'/.test(uS16));"""
new3 = """  check('#14 募兵面板按建筑分流（v89.211 新规：open-siege 传本作坊自己的 idx）',
    /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx, 'siege'\\)/.test(mS16)
    && /ui\\.openTroops = function/.test(uS16) && /_trainFilter === 'siege'/.test(uS16));"""
if "open-siege 传本作坊自己的 idx" in s:
    print('[skip] G3 已改')
else:
    s = sub1(s, old3, new3, 'G3')
    wr('smoke-test.js', s)
    print('[ok] G3')

s = rd('smoke-test.js')
old4 = """  check('工匠作坊入口直接开器械面板（不再切中央视图）',
    /case 'open-siege': ui\\.openTroops\\(ui\\._trainBIdx, 'siege'\\)/.test(mS32));"""
new4 = """  check('工匠作坊入口直接开器械面板（不再切中央视图 · v89.211 其传本作坊 idx）',
    /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx, 'siege'\\)/.test(mS32));"""
if "v89.211 其传本作坊 idx" in s:
    print('[skip] G4 已改')
else:
    s = sub1(s, old4, new4, 'G4')
    wr('smoke-test.js', s)
    print('[ok] G4')

# ---------------- G5: §107① 补 assert ----------------
s = rd('smoke-test.js')
old5 = """    check('§107① 格子城墙 → 环城槽（Lv7 保留 · 格释放 · 消息含「城墙调整」）',
      !!(c127a.wall && c127a.wall.build && c127a.wall.build.lvl === 7)
      && c127a.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; }).length === 0
      && (last127.msg || '').indexOf('城墙调整') >= 0,
      (last127.msg || '(无消息)').slice(0, 70));"""
new5 = """    check('§107① 格子城墙 → 环城槽（Lv7 保留 · 原墙格补建民居[v89.211] · 消息含「城墙调整」）',
      !!(c127a.wall && c127a.wall.build && c127a.wall.build.lvl === 7)
      && c127a.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; }).length === 0
      /* v89.211 新规（老板 2）：释放格补建民房（同等级），不再留空 */
      && !!c127a.cells[47].build && c127a.cells[47].build.id === 'minfang' && c127a.cells[47].build.lvl === 7
      && (last127.msg || '').indexOf('城墙调整') >= 0,
      (last127.msg || '(无消息)').slice(0, 70));"""
if "原墙格补建民居[v89.211]" in s:
    print('[skip] G5 已改')
else:
    s = sub1(s, old5, new5, 'G5')
    wr('smoke-test.js', s)
    print('[ok] G5 §107①')

# ---------------- G6: 版本号 ----------------
s = rd('smoke-test.js')
old6 = """      return /GAME\\.VERSION = 'v89\\.210'/.test(mS199)   /* v89.210：版本号每轮迭代更新（本条随轮升级） */"""
new6 = """      return /GAME\\.VERSION = 'v89\\.211'/.test(mS199)   /* v89.211：版本号每轮迭代更新（本条随轮升级） */"""
if "v89\\.211'" in s:
    print('[skip] G6 已改')
else:
    s = sub1(s, old6, new6, 'G6')
    wr('smoke-test.js', s)
    print('[ok] G6 版本断言')

# ---------------- G7: smoke §211 新段 ----------------
s = rd('smoke-test.js')
if '§211① 强化乘数唯一出口' in s:
    print('[skip] G7 §211 已在册')
else:
    anchor = """        && a210.indexOf('Shift+1-5') >= 0;
    })());
  })();"""
    block = """        && a210.indexOf('Shift+1-5') >= 0;
    })());

    /* ============================================================
     * §211（v89.211）强化数值链显示收敛 + 占城空格补齐 + 器械工位归一（老板 1/2/3）
     * ------------------------------------------------------------
     * ① 强化乘数/描述唯一出口（eqEnhMulOf / eqLingMulOf / equipDescOf）
     * ② equipScore 按件计入强化（决策链）
     * ③ 占城 0 空格（原墙格补民房 · 真调）+ 存量修复 migrateWallCell211（含两负例）
     * ④ 器械：陈旧工位回落（真调）+ 无作坊城提示准确 + 三条源码链
     * ============================================================ */
    console.log('  --- §211 强化数值链 / 占城空格 / 器械工位 ---');
    check('§211① 强化乘数唯一出口（equipDescOf 按件显示 · +10 = ×1.8）', (function () {
      if (typeof G.equipDescOf !== 'function' || typeof G.eqEnhMulOf !== 'function') return false;
      var it = DATA.EQUIP.yt_sword;
      var hi = { u: 99801, id: 'yt_sword', enh: 10 };
      return Math.abs(G.eqEnhMulOf(hi) - 1.8) < 1e-9
        && G.equipDescOf(hi).indexOf(String(Math.round(it.atk * 1.8))) >= 0
        && G.equipDescOf({ u: 99802, id: 'yt_sword', enh: 0 }).indexOf(String(it.atk)) >= 0;
    })());
    check('§211② 装备评分按件计入强化（+10 > +0 · 谱直传零误杀）', (function () {
      var it = DATA.EQUIP.yt_sword;
      var hi = G.systems.equipScore({ u: 99803, id: 'yt_sword', enh: 10 });
      var lo = G.systems.equipScore({ u: 99804, id: 'yt_sword', enh: 0 });
      var exp = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
        + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4 + 50;
      return hi > lo && Math.abs(G.systems.equipScore(it) - exp) < 0.01;
    })());
    check('§211③ 占城 0 空格（原墙格补民房 · 真调 onConquer）', (function () {
      var keep = G.state, st = G.newGame({ name: 'v211c', mapSeed: 7 });
      try {
        G.state = st;
        if (!st.map.grid) G.map.generate();
        var tgt = null;
        (st.map.cities || []).forEach(function (x) { if (x.type === 'county' && !tgt) tgt = x; });
        if (!tgt) return false;
        G.onConquer(tgt, { winner: 'atk' }, st.generals[0]);
        var nc = null;
        st.cities.forEach(function (x) { if (x.origId === tgt.id) nc = x; });
        if (!nc) return false;
        var wIdx = G.wallPlanIdxOf();
        var empt = nc.cells.filter(function (x) { return !x.build && !x.pending; }).length;
        return wIdx > 0 && empt === 0
          && !!nc.cells[wIdx].build && nc.cells[wIdx].build.id === 'minfang'
          && !!(nc.wall && nc.wall.build);
      } finally { G.state = keep; }
    })());
    check('§211④ 存量修复 migrateWallCell211（签名命中补 · 自建城/两空格不碰）', (function () {
      var keep = G.state, st = G.newGame({ name: 'v211f', mapSeed: 8 });
      try {
        G.state = st;
        if (!st.map.grid) G.map.generate();
        var tgt = null;
        (st.map.cities || []).forEach(function (x) { if (x.type === 'county' && !tgt) tgt = x; });
        G.onConquer(tgt, { winner: 'atk' }, st.generals[0]);
        var nc = null;
        st.cities.forEach(function (x) { if (x.origId === tgt.id) nc = x; });
        var wIdx = G.wallPlanIdxOf();
        nc.cells[wIdx].build = null; nc.cells[wIdx].pending = null;   /* 退回旧版释放现场 */
        delete st._wallCell211;
        G.migrateWallCell211(st);
        var fixed = !!(nc.cells[wIdx].build && nc.cells[wIdx].build.id === 'minfang');
        nc.cells[wIdx].build = null;
        nc.cells[5].build = null; nc.cells[5].pending = null;         /* 两空格 → 签名不符 */
        delete st._wallCell211;
        G.migrateWallCell211(st);
        var neg = !nc.cells[wIdx].build;
        var p1 = st.cities[0];
        var e0 = 0; (p1.cells || []).forEach(function (x) { if (!x.build && !x.pending) e0++; });
        delete st._wallCell211;
        G.migrateWallCell211(st);
        var e1 = 0; (p1.cells || []).forEach(function (x) { if (!x.build && !x.pending) e1++; });
        return fixed && neg && e0 === e1 && e0 > 0;
      } finally { G.state = keep; }
    })());
    check('§211⑤ 器械工位：陈旧 idx 回落（真调）· 无作坊城提示准确', (function () {
      var keep = G.state, st = G.newGame({ name: 'v211t', mapSeed: 7 });
      try {
        G.state = st;
        var c0 = st.cities[0];
        G.ui._cityId = c0.id;
        c0.cells[22].build = { id: 'gongjiangzuofang', lvl: 7 };
        c0.cells[18].build = { id: 'junying', lvl: 10 };
        c0.cells[11].build = { id: 'shuyuan', lvl: 10 };
        c0.res.pop = 500000;
        G.goldAdd(9999999);
        c0.res.grain = 9999999; c0.res.wood = 9999999; c0.res.stone = 9999999; c0.res.iron = 9999999;
        var r1 = G.train('toudan', 1, c0.id, 18);   /* 陈旧军营格 → 应回落作坊 22 */
        var ok1 = r1.ok === true && G.trainQueuesOf(c0, 22, 'craft').length === 1
          && G.trainQueuesOf(c0, 18, 'craft').length === 0;
        var c1 = G.makeCity({ id: 'p2x', name: '无作坊', x: c0.x + 9, y: c0.y + 9 });
        c1.cells[11].build = { id: 'shuyuan', lvl: 10 };
        st.cities.push(c1);
        var r2 = G.train('toudan', 1, c1.id, 18);
        return ok1 && r2.ok === false && r2.msg.indexOf('工匠作坊') >= 0;
      } finally { G.state = keep; G.ui._cityId = null; }
    })());
    check('§211⑥ 源码链：open-siege 用本作坊 idx · openTroops 归一 · doTrain 读解析工位', (function () {
      var fs211 = require('fs'), p211 = require('path');
      var mS211 = fs211.readFileSync(p211.join(__dirname, 'js', 'main.js'), 'utf8');
      var uS211 = fs211.readFileSync(p211.join(__dirname, 'js', 'ui.js'), 'utf8');
      return /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx, 'siege'\\)/.test(mS211)
        && /_b211 \\? _b211\\.idx : null/.test(uS211)
        && /_bar211 \\? _bar211\\.idx : null/.test(mS211);
    })());
    check('§211⑦ 读档迁移释放块改补建民房 + 存量修复挂载（源码 · 唯一口径）', (function () {
      var fs211b = require('fs'), p211b = require('path');
      var sS211 = fs211b.readFileSync(p211b.join(__dirname, 'js', 'state.js'), 'utf8');
      return /v89\\.211[\\s\\S]{0,600}x\\.build = \\{ id: 'minfang'/.test(sS211)
        && /GAME\\.migrateWallCell211\\(st\\)/.test(sS211);
    })());
  })();"""
    s = sub1(s, anchor, block, 'G7')
    wr('smoke-test.js', s)
    print('[ok] G7 §211 smoke')

# ---------------- G8: e2e §211 新段 ----------------
s = rd('e2e-test.js')
if '§211e①' in s:
    print('[skip] G8 §211e 已在册')
else:
    anchor = "\n  return finish();\n}"
    block = """

  /* ============================================================
   * §211（v89.211）强化显示 / 器械工位链（真实 DOM · 真点）
   * ============================================================ */
  try {
    const _bkCityId211 = G.ui._cityId;
    const c211 = G.currentCity() || G.state.cities[0];
    G.ui._cityId = c211.id;
    let w211 = -1, b211 = -1, s211 = -1;
    c211.cells.forEach((cc, i) => {
      if (!cc.build) return;
      if (cc.build.id === 'gongjiangzuofang' && w211 < 0) w211 = i;
      if (cc.build.id === 'junying' && b211 < 0) b211 = i;
      if (cc.build.id === 'shuyuan' && s211 < 0) s211 = i;
    });
    if (w211 < 0) { w211 = c211.cells.findIndex((x) => !x.build && !x.official); c211.cells[w211] = { build: { id: 'gongjiangzuofang', lvl: 7 }, pending: null }; }
    if (b211 < 0) { b211 = c211.cells.findIndex((x, i) => !x.build && !x.official && i !== w211); c211.cells[b211] = { build: { id: 'junying', lvl: 10 }, pending: null }; }
    if (s211 < 0) { s211 = c211.cells.findIndex((x, i) => !x.build && !x.official && i !== w211 && i !== b211); c211.cells[s211] = { build: { id: 'shuyuan', lvl: 10 }, pending: null }; }
    c211.res.pop = Math.max(c211.res.pop || 0, 500000);
    G.goldAdd(9999999);
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { c211.res[k] = Math.max(c211.res[k] || 0, 9999999); });
    const q0_211 = G.trainQueuesOf(c211, w211, 'craft').length;
    G.ui.openTroops(b211, 'siege');            /* 陈旧军营格（病根场景） */
    await sleep(220);
    check('§211e① 器械面板入场归一（陈旧军营格 → 本城作坊格）', G.ui._trainBIdx === w211,
      'got=' + G.ui._trainBIdx + ' want=' + w211);
    const card211 = document.querySelector('#modal-root .troop-card[data-troop="toudan"]');
    check('§211e② 投石车卡可选（无灰）', !!card211 && !card211.classList.contains('disabled'));
    if (card211) {
      click(card211);
      await sleep(160);
      const go211 = document.querySelector('#modal-root [data-action="confirm-train"]');
      if (go211) click(go211);
      await sleep(260);
    }
    const q1_211 = G.trainQueuesOf(c211, w211, 'craft');
    check('§211e③ 真点提交成功（队列+1 落在作坊 · 不再假报无作坊）',
      q1_211.length === q0_211 + 1 && q1_211[q1_211.length - 1].troopId === 'toudan',
      'q=' + q0_211 + '→' + q1_211.length);
    G.ui.closeAllModals();
    await sleep(80);

    /* 装备面板：+10 武器在槽位行显示强化后攻值（equipDescOf 唯一出口的真视图） */
    const g211e = G.state.generals[0];
    if (g211e) {
      g211e.equip = g211e.equip || {};
      const keepW211 = g211e.equip.weapon || null;
      if (keepW211) { const ix0 = G.state.inventory.indexOf(keepW211); if (ix0 >= 0) G.state.inventory.splice(ix0, 1); }
      const it211e = G.addEquip('yt_sword', 10);
      g211e.equip.weapon = it211e;
      G.ui._equipGen = g211e.id;
      G.ui.openEquipPanel();
      await sleep(240);
      const mrT211 = (document.querySelector('#modal-root') || {}).textContent || '';
      const atk211 = Math.round(DATA.EQUIP.yt_sword.atk * 1.8);
      check('§211e④ 装备面板槽位行显示强化后攻值（攻' + atk211 + '）', mrT211.indexOf('攻' + atk211) >= 0,
        mrT211.slice(0, 90));
      G.ui.closeAllModals();
      await sleep(60);
      if (keepW211) g211e.equip.weapon = keepW211; else delete g211e.equip.weapon;
      const ix1 = G.state.inventory.findIndex((x) => x.u === it211e.u);
      if (ix1 >= 0) G.state.inventory.splice(ix1, 1);
    }
    G.ui._cityId = _bkCityId211;
  } catch (e211e) {
    check('§211e 链', false, String(e211e && e211e.message || e211e));
  }

  return finish();
}"""
    s = sub1(s, anchor, block, 'G8')
    wr('e2e-test.js', s)
    print('[ok] G8 §211e e2e')

print('DONE')
