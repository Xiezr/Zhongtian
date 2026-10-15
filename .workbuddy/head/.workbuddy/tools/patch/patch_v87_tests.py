# -*- coding: utf-8 -*-
"""v87 · 测试补丁：smoke §72（五条）+ e2e v87 段（真实 DOM）。"""
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
 * 72. v87（老板「为各类野地设计专属弹窗场景」）：野地专属场景
 * ============================================================ */
console.log('\n===== 72. v87 野地专属场景 =====');
(function () {
  /* 本节需要"有地形"的地图（前序测试不保证 grid 已生成；最后一节，生成无副作用） */
  if (!(GAME.state.map && GAME.state.map.grid)) GAME.map.generate();
  var uS87 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS87 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');

  console.log('  --- ① 表结构与挂点 ---');
  check('v87：六地形场景齐（字段/权重/产出齐备）', (function () {
    var W = DATA.WILD_SCENES || {};
    var ters = ['hill', 'lake', 'zhaoze', 'desert', 'forest', 'caoyuan'];
    var ok = true;
    ters.forEach(function (k) {
      var sc = W[k];
      if (!sc || !sc.name || !sc.icon || !sc.desc) ok = false;
      if (!(sc.energy > 0) || !(sc.stam > 0)) ok = false;
      if (!sc.outcomes || !sc.outcomes.length) ok = false;
      var tw = 0;
      (sc.outcomes || []).forEach(function (o) { if (!o.w || !o.t) ok = false; tw += o.w; });
      if (tw <= 0) ok = false;
    });
    return ok && Object.keys(W).length === 6;
  })());
  check('v87：UI 挂点齐备（区块/执行/两分支/分发）', (function () {
    return uS87.indexOf('ui.wildSceneHTML = function') >= 0
      && uS87.indexOf('ui.doWildScene = function') >= 0
      && uS87.indexOf('ui.wildSceneHTML(x, y)') >= 0
      && mS87.indexOf("case 'do-wild-scene'") >= 0;
  })());

  console.log('  --- ② 校验与执行（六地形逐一行之） ---');
  check('实测：plain 拒绝 · 六地形产出键全合法', (function () {
    var s = GAME.state, gen = s.generals[0];
    if (!gen) return false;
    var found = {}, plainXY = null;
    for (var yy = 3; yy < 200 && (Object.keys(found).length < 6 || !plainXY); yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city' || GAME.map.fortAt(xx, yy)) continue;
        if (tl.terrain === 'plain') { if (!plainXY) plainXY = { x: xx, y: yy }; continue; }
        if (!found[tl.terrain]) found[tl.terrain] = { x: xx, y: yy };
      }
    }
    if (Object.keys(found).length < 6) return false;
    if (plainXY && GAME.wildSceneCheck(plainXY.x, plainXY.y, gen.id).ok) return false;
    s.items = s.items || {};
    var okAll = true;
    Object.keys(found).forEach(function (ter) {
      var p = found[ter];
      gen.energy = 100;
      GAME.setStaNow(gen, 100);
      var r = GAME.wildSceneDo(p.x, p.y, gen.id);
      if (!r.ok) { okAll = false; return; }
      if (String(r.text).indexOf('undefined') >= 0) okAll = false;
    });
    Object.keys(s.items).forEach(function (k) {
      var it = (DATA.ITEMS || []).filter(function (x) { return x.id === k; })[0];
      var mat = (DATA.MATERIAL_BY_ID || {})[k];
      if (!it && !mat) okAll = false;
    });
    return okAll;
  })());
  check('实测：每日锁（同日二跑拒）· 种子化复现（清锁同参同果）', (function () {
    var s = GAME.state, gen = s.generals[0];
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'forest' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var r1 = GAME.wildSceneDo(p.x, p.y, gen.id);
    if (!r1.ok) return false;
    if (GAME.wildSceneDo(p.x, p.y, gen.id).ok) return false;      /* 每日锁 */
    var bak = s.wildScenes;
    s.wildScenes = {};
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var r2 = GAME.wildSceneDo(p.x, p.y, gen.id);
    s.wildScenes = bak;
    return r2.ok && r2.name === r1.name && r2.text === r1.text;
  })());

  console.log('  --- ③ 绿林豪杰（权重定向 · 必出） ---');
  check('实测：豪杰归营（将领数 +1 · 归属当前城）', (function () {
    var s = GAME.state, gen = s.generals[0];
    var hill = DATA.WILD_SCENES.hill;
    var bakW = hill.outcomes.map(function (o) { return o.w; });
    hill.outcomes.forEach(function (o) { o.w = o.hero ? 100 : 0; });
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'hill' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) { hill.outcomes.forEach(function (o, i) { o.w = bakW[i]; }); return false; }
    if (s.wildScenes) delete s.wildScenes[p.x + ',' + p.y];
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var n0 = s.generals.length;
    var r = GAME.wildSceneDo(p.x, p.y, gen.id);
    var n1 = s.generals.length;
    var last = s.generals[n1 - 1];
    hill.outcomes.forEach(function (o, i) { o.w = bakW[i]; });
    return r.ok && n1 === n0 + 1 && !!last && last.cityId === GAME.currentCity().id;
  })());
})();
'''


print('== Y1. smoke §72 ==')
patch(
    SM,
    """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);""",
    SMOKE_SEC + """
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);""",
    'Y1 smoke 72',
    probe='72. v87 野地专属场景',
)

print()
print('== Y2. e2e v87 段 ==')
patch(
    E2,
    """  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();""",
    """  /* ============================================================
   * v87（老板）：野地专属场景（真实 DOM）
   * ============================================================ */
  console.log('\\n--- v87. 野地专属场景（真实 DOM） ---');
  {
    let hp = null;
    for (let y = 3; y < 200 && !hp; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) { hp = { x, y }; break; }
      }
    }
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });
    G.state.wildScenes = {};
    G.state.wilds = G.state.wilds || [];
    G.ui.openLandModal(hp.x, hp.y);            /* 未占 → 出兵弹窗 */
    await sleep(160);
    check('v87：野地弹窗含地形专属区块（绿林探访）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('绿林探访') >= 0
        && root.textContent.indexOf('地形专属') >= 0;
    })());
    check('v87：区块含带队将领与出发按钮', (function () {
      return !!document.querySelector('#modal-root [data-action="do-wild-scene"]')
        && !!document.querySelector('#ws-gen');
    })());
    click(document.querySelector('#modal-root [data-action="do-wild-scene"]'));
    await sleep(240);
    check('v87：执行后原地回显（今日已探）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('今日已探过') >= 0;
    })());
    /* 已占分支也含区块（直接注册一块已占野地） */
    G.state.wilds.push({ x: hp.x, y: hp.y, type: 'hill', level: 4 });
    G.ui.openLandModal(hp.x, hp.y);
    await sleep(160);
    check('v87：已占野地管理面板也含场景区块', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('地形专属') >= 0;
    })());
    G.ui.closeModal();
    await sleep(60);
  }

  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();""",
    'Y2 e2e v87',
    probe='v87. 野地专属场景（真实 DOM）',
)



print()
print('== Y3. §72 每日锁测试先清锁 ==')
patch(
    SM,
    """    if (!p) return false;
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var r1 = GAME.wildSceneDo(p.x, p.y, gen.id);
    if (!r1.ok) return false;""",
    """    if (!p) return false;
    if (s.wildScenes) delete s.wildScenes[p.x + ',' + p.y];   /* ②段可能已探过：先清锁 */
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var r1 = GAME.wildSceneDo(p.x, p.y, gen.id);
    if (!r1.ok) return false;""",
    'Y3 清锁',
    probe='/* ②段可能已探过：先清锁 */',
)

print()
print('全部完成。')
