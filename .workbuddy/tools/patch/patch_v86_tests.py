# -*- coding: utf-8 -*-
"""v86 · 测试补丁：smoke §71（九条 · 结构+行为）+ e2e v86 段（真实 DOM）。"""
import io
import sys

SM = r'E:\Deepseekdb\smoke-test.js'
E2 = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
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


SMOKE_SEC = r'''/* ============================================================
 * 71. v86（老板「按计划进行」· 第四轮 G1）：计谋 / 锦囊
 * ============================================================ */
console.log('\n===== 71. v86 计谋 / 锦囊 =====');
(function () {
  /* 本节需要"有地形"的地图（前序测试不保证 grid 已生成；这里是最后一节，生成无副作用） */
  if (!(GAME.state.map && GAME.state.map.grid)) GAME.map.generate();
  var uS86 = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
  var bS86 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');
  var sS86 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
  var mS86 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');

  console.log('  --- ① 表结构与死数据守卫 ---');
  check('v86：SCHEMES 八计（id 唯一 · 4/2/2 三门 · 消耗/效果/时长字段齐）', (function () {
    var list = DATA.SCHEMES || [];
    if (list.length !== 8) return false;
    var ids = {}, kinds = { attack: 0, march: 0, defense: 0 }, ok = true;
    list.forEach(function (sc) {
      if (ids[sc.id]) ok = false;
      ids[sc.id] = 1;
      if (!sc.name || !sc.icon || !sc.tip) ok = false;
      if (sc.jinang == null || sc.energy == null) ok = false;
      if (!sc.eff || !Object.keys(sc.eff).length) ok = false;
      if (kinds[sc.kind] == null) ok = false; else kinds[sc.kind]++;
      if (sc.kind === 'defense' && !sc.durH) ok = false;
    });
    return ok && kinds.attack === 4 && kinds.march === 2 && kinds.defense === 2;
  })());
  check('v86：全部 11 个效果键在逻辑模块有字面读取点（防死数据）', (function () {
    var all = bS86 + sS86;
    return ['guardPct', 'defCut', 'loyaltyDrop', 'faintAt', 'joinAt', 'joinChance',
      'lootPct', 'marchPct', 'woundedKeep', 'invSkip', 'invLossCut']
      .every(function (k) { return all.indexOf(k) >= 0; });
  })());
  check('v86：锦囊道具（talis · 商城分类页注册）', (function () {
    var it = (DATA.ITEMS || []).filter(function (x) { return x.id === 'jinang' && x.type === 'talis'; });
    return it.length === 1 && it[0].price > 0 && uS86.indexOf("talis: '锦囊'") >= 0;
  })());
  check('v86：UI 挂点齐备（计略行 / 选择弹窗 / 城池布防 / 携计提交）', (function () {
    return uS86.indexOf('ui.openExpScheme = function') >= 0
      && uS86.indexOf('ui.citySchemeHTML = function') >= 0
      && uS86.indexOf('id="exp-scheme-label"') >= 0
      && mS86.indexOf("case 'exp-scheme'") >= 0 && mS86.indexOf("case 'city-scheme-pick'") >= 0
      && mS86.indexOf('ui._expScheme || null') >= 0;
  })());

  console.log('  --- ② 校验 / 扣费 / 标记 ---');
  check('实测：校验拦截 + 施计扣费 + 标记累计 + 野地挑拨拒绝', (function () {
    var s = GAME.state, gen = s.generals[0];
    if (!gen) return false;
    var wt = null;
    for (var yy = 5; yy < 80 && !wt; yy++) {
      for (var xx = 5; xx < 80; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain !== 'city' && !GAME.map.fortAt(xx, yy)) { wt = { kind: 'wild', x: xx, y: yy }; break; }
      }
    }
    if (!wt) return false;
    var t = GAME.battle.resolveTarget(wt);
    if (!t.ok) return false;
    var bak = s.items;
    s.items = {};
    var noJa = GAME.schemePrepare('yaoyan', t, gen);
    s.items = bak || {};
    if (noJa.ok) return false;
    s.items.jinang = (s.items.jinang || 0) + 20;
    gen.energy = 100;
    var e0 = gen.energy;
    var ok1 = GAME.schemePrepare('yaoyan', t, gen);
    if (!ok1.ok) return false;
    var ja0 = s.items.jinang;
    GAME.schemeUse('yaoyan', t, gen);
    if (gen.energy !== Math.max(0, e0 - ok1.scheme.energy)) return false;
    if (s.items.jinang !== ja0 - ok1.scheme.jinang) return false;
    if (!(GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'yaoyan') >= 1)) return false;
    if (GAME.schemePrepare('tiaobo', t, gen).ok) return false;
    return true;
  })());

  console.log('  --- ③ 千里奔袭（行军 ×1.3） ---');
  check('实测：携千里奔袭行军耗时 = 不带计 ÷ 1.3 · m.scheme 随军', (function () {
    var s = GAME.state, gen = s.generals[0], c0 = s.cities[0];
    c0.army = c0.army || {};
    c0.army.yibing = (c0.army.yibing || 0) + 500;
    s.items.jinang = (s.items.jinang || 0) + 20;
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var wt2 = null;
    for (var yy = 5; yy < 80 && !wt2; yy++) {
      for (var xx = 5; xx < 80; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain !== 'city' && !GAME.map.fortAt(xx, yy)) { wt2 = { kind: 'wild', x: xx, y: yy }; break; }
      }
    }
    if (!wt2) return false;
    var r1 = GAME.march.dispatch(wt2, 'raid', { yibing: 100 }, gen.id);
    if (!r1.ok) return false;
    GAME.march.recall(r1.march.id);
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var r2 = GAME.march.dispatch(wt2, 'raid', { yibing: 100 }, gen.id, 'benxi');
    if (!r2.ok) return false;
    GAME.march.recall(r2.march.id);
    if (r2.march.scheme !== 'benxi') return false;
    var ratio = r1.march.totalTime / r2.march.totalTime;
    return Math.abs(ratio - 1.3) < 0.05;
  })());

  console.log('  --- ④ 战斗入参（妖言 −15% · 确定性） ---');
  check('实测：携妖言开战守军 = 原守军 ×0.85 + 战报注明', (function () {
    var s = GAME.state, gen = s.generals[0], c0 = s.cities[0];
    c0.army = c0.army || {};
    c0.army.yibing = (c0.army.yibing || 0) + 500;
    s.items.jinang = (s.items.jinang || 0) + 20;
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var wt3 = null;
    for (var yy = 5; yy < 80 && !wt3; yy++) {
      for (var xx = 5; xx < 80; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain !== 'city' && !GAME.map.fortAt(xx, yy)) { wt3 = { kind: 'wild', x: xx, y: yy }; break; }
      }
    }
    if (!wt3) return false;
    var t3 = GAME.battle.resolveTarget(wt3);
    var gSum = 0;
    for (var gk in (t3.garrison || {})) gSum += t3.garrison[gk];
    if (gSum <= 10) return false;
    var rA = GAME.battle.expedition(wt3, 'raid', { yibing: 100 }, gen.id, { scheme: 'yaoyan' });
    if (!rA.result || !rA.result.schemeNote) return false;
    if (rA.result.schemeNote.indexOf('守军逃散 15%') < 0) return false;
    var dA = 0;
    for (var dk in (rA.result.defStartBy || {})) dA += rA.result.defStartBy[dk];
    return Math.abs(dA / gSum - 0.85) < 0.02;
  })());
  check('实测：战斗可复现（同参数两次 defLossBy 一致，供对比断言）', (function () {
    var s = GAME.state, gen = s.generals[0], c0 = s.cities[0];
    c0.army.yibing = (c0.army.yibing || 0) + 400;
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var wt4 = null;
    for (var yy = 5; yy < 80 && !wt4; yy++) {
      for (var xx = 5; xx < 80; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain !== 'city' && !GAME.map.fortAt(xx, yy)) { wt4 = { kind: 'wild', x: xx, y: yy }; break; }
      }
    }
    if (!wt4) return false;
    var rb = GAME.battle.expedition(wt4, 'raid', { yibing: 100 }, gen.id);
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var rc = GAME.battle.expedition(wt4, 'raid', { yibing: 100 }, gen.id);
    return JSON.stringify(rb.result.defLossBy) === JSON.stringify(rc.result.defLossBy);
  })());

  console.log('  --- ⑤ 防御计（布防 / 到期 / 空城计 / 坚壁清野） ---');
  check('实测：布防生效 · 到期失效 · 一次性消耗', (function () {
    var s = GAME.state, c = s.cities[0];
    if (GAME.schemeDefOf(c, 'kongcheng')) return false;
    GAME.schemeDefSet(c, 'kongcheng', null);
    var act = GAME.schemeDefOf(c, 'kongcheng');
    if (!act || act.left <= 0) return false;
    if (GAME.schemeDefOf(c, 'kongcheng', act.until + 1)) return false;
    if (!GAME.schemeDefConsume(c, 'kongcheng')) return false;
    if (GAME.schemeDefOf(c, 'kongcheng')) return false;
    return true;
  })());
  check('实测：空城计使 invasionTick 跳过（翻转：无计必触发）', (function () {
    var s = GAME.state, c = s.cities[0];
    var I = DATA.INVASION;
    var bakUnlock = I.unlockCities;
    I.unlockCities = 1;
    var now = (s.world && s.world.elapsed) || 0;
    GAME.schemeDefSet(c, 'kongcheng', null);
    c.inv = { nextAt: now, warned: false };
    var fired1 = GAME.invasionTick(0);
    var consumed = !GAME.schemeDefOf(c, 'kongcheng');
    c.inv = { nextAt: now, warned: false };
    var fired2 = GAME.invasionTick(0);
    I.unlockCities = bakUnlock;
    return fired1 === 0 && consumed && fired2 >= 1;
  })());
  check('实测：坚壁清野使来袭损失 ×0.6（守备冻结 · 同城对照）', (function () {
    var s = GAME.state, c = s.cities[0];
    GAME.schemeDefConsume(c, 'jianbi');
    /* 冻结影响 severity 输入的守备（army / cells 城墙）与资源；两次结算前各恢复一次。
       （不用"双城同 id"对照：schemeDefOf 按 city.id 取键，同 id 会串门。） */
    var armySnap = JSON.stringify(c.army || {});
    var cellsSnap = JSON.stringify(c.cells || []);
    var wallSnap = c.wallLv;
    var refill = function () {
      c.army = JSON.parse(armySnap);
      c.cells = JSON.parse(cellsSnap);
      c.wallLv = wallSnap;
      c.res = c.res || {};
      ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 100000; });
    };
    refill();
    var d1 = GAME.invasionResolve(c);
    refill();
    GAME.schemeDefSet(c, 'jianbi', null);
    var d2 = GAME.invasionResolve(c);
    var g1 = (d1.resLost || {}).grain || 0, g2 = (d2.resLost || {}).grain || 0;
    if (g1 <= 0) return false;
    return Math.abs(g2 / g1 - 0.6) < 0.03;
  })());
})();
'''


print('== T1. smoke §71 ==')
patch(
    SM,
    """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);""",
    SMOKE_SEC + """
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);""",
    'T1 smoke 71',
    probe='71. v86 计谋 / 锦囊',
)

print()
print('== T2. e2e v86 段 ==')
patch(
    E2,
    """  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();""",
    """  /* ============================================================
   * v86（老板「按计划进行」· G1）：计谋（真实 DOM）
   * ============================================================ */
  console.log('\\n--- v86. 计谋 / 锦囊（真实 DOM） ---');
  {
    let wt = null;
    for (let y = 5; y < 80 && !wt; y++) {
      for (let x = 5; x < 80; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain !== 'city' && !G.map.fortAt(x, y)) { wt = { x, y }; break; }
      }
    }
    G.state.items = G.state.items || {};
    G.state.items.jinang = (G.state.items.jinang || 0) + 10;
    G.state.generals[0].energy = 100;
    GAME.setStaNow(G.state.generals[0], 100);

    G.ui.openExpModal({ kind: 'wild', x: wt.x, y: wt.y });
    await sleep(160);
    check('v86：出征面板含「计略」行', !!document.querySelector('#exp-scheme-label'));
    click(document.querySelector('#modal-root [data-action="exp-scheme"]'));
    await sleep(160);
    check('v86：计略弹窗（妖言/千里奔袭等六计可见）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('妖言惑众') >= 0
        && root.textContent.indexOf('千里奔袭') >= 0
        && root.textContent.indexOf('锦囊现有') >= 0;
    })());
    click(document.querySelector('#modal-root [data-action="exp-scheme-pick"][data-v="yaoyan"]'));
    await sleep(160);
    G.ui.closeModal();
    await sleep(100);
    check('v86：选定后出征面板标签更新', (function () {
      const lb = document.querySelector('#exp-scheme-label');
      return !!lb && lb.textContent.indexOf('妖言惑众') >= 0;
    })());
    /* 提交携计（需城内有兵） */
    const c86 = G.currentCity();
    c86.army = c86.army || {};
    c86.army.yibing = (c86.army.yibing || 0) + 100;
    G.ui.openExpModal({ kind: 'wild', x: wt.x, y: wt.y });
    await sleep(160);
    click(document.querySelector('#modal-root [data-action="exp-scheme"]'));
    await sleep(160);
    click(document.querySelector('#modal-root [data-action="exp-scheme-pick"][data-v="yaoyan"]'));
    await sleep(160);
    G.ui.closeModal();
    await sleep(100);
    const inp = document.querySelector('#exp-yibing');
    if (inp) { inp.value = '100'; }
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(200);
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      return (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
    })());
    /* 城池布防入口 */
    G.ui.setView('city');
    await sleep(220);
    check('v86：城池面板有「计略布防」入口', !!document.querySelector('[data-action="city-scheme"]'));
    click(document.querySelector('[data-action="city-scheme"]'));
    await sleep(160);
    check('v86：布防弹窗（空城计 / 坚壁清野）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('空城计') >= 0
        && root.textContent.indexOf('坚壁清野') >= 0;
    })());
    click(document.querySelector('#modal-root [data-action="city-scheme-pick"][data-v="kongcheng"]'));
    await sleep(200);
    check('v86：布防成功（kongcheng 生效）', (function () {
      const c = G.currentCity();
      return !!GAME.schemeDefOf(c, 'kongcheng');
    })());
  }

  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();""",
    'T2 e2e v86',
    probe='v86. 计谋 / 锦囊（真实 DOM）',
)



print()
print('== T3. 旧断言适配（dispatch 第 5 参） ==')
patch(
    SM,
    r"""check('界面出征走 dispatch（不是即刻 expedition）', /GAME\.march\.dispatch\(target, mode, atk, genSel\.value\)/.test(mS30));""",
    r"""check('界面出征走 dispatch（不是即刻 expedition）', /GAME\.march\.dispatch\(target, mode, atk, genSel\.value(, ui\._expScheme \|\| null)?\)/.test(mS30));""",
    'T3 dispatch 第 5 参',
    probe=r'genSel\.value(, ui\._expScheme',
)



print()
print('== T4. e2e 段裸 GAME → G 别名 ==')
patch(
    E2,
    """    G.state.generals[0].energy = 100;
    GAME.setStaNow(G.state.generals[0], 100);""",
    """    G.state.generals[0].energy = 100;
    G.setStaNow(G.state.generals[0], 100);""",
    'T4a setStaNow',
    probe='G.setStaNow',
)
patch(
    E2,
    """      return !!GAME.schemeDefOf(c, 'kongcheng');""",
    """      return !!G.schemeDefOf(c, 'kongcheng');""",
    'T4b schemeDefOf',
    probe="return !!G.schemeDefOf(c, 'kongcheng');",
)



print()
print('== T5. e2e 段全军拉满精力/体力 ==')
patch(
    E2,
    """    G.state.items = G.state.items || {};
    G.state.items.jinang = (G.state.items.jinang || 0) + 10;
    G.state.generals[0].energy = 100;
    G.setStaNow(G.state.generals[0], 100);""",
    """    G.state.items = G.state.items || {};
    G.state.items.jinang = (G.state.items.jinang || 0) + 10;
    /* 全军拉满精力/体力：ui._expGen 未必是 generals[0]（前序测试可能改过选择） */
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });""",
    'T5 全军拉满',
    probe='G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });',
)



print()
print('== T7. smoke 挂点断言适配（内联区函数名） ==')
patch(
    SM,
    """    return uS86.indexOf('ui.openExpScheme = function') >= 0""",
    """    return uS86.indexOf('ui.toggleExpScheme = function') >= 0
      && uS86.indexOf('ui.expSchemePanelHTML = function') >= 0""",
    'T7 toggle 挂点',
    probe="ui.toggleExpScheme = function') >= 0",
)

print()
print('全部完成。')
