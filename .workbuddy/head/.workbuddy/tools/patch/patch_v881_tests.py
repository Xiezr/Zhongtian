# -*- coding: utf-8 -*-
"""v88.1 测试更新：smoke §72 改写为「场景整合」+ e2e v87 段替换为 v88.1 段。标记切割。"""
import io

# ============ 1) smoke §72 整段替换 ============
P1 = r'E:\Deepseekdb\smoke-test.js'
d = io.open(P1, encoding='utf-8', newline='').read()

MARK_A = "console.log('\\n===== 72. v87 野地专属场景 =====');"
MARK_B = "console.log('\\n===== 73. v88 灵气双轨装备 + 江湖游历 =====');"

if 'v88.1 场景整合' in d:
    print('SKIP smoke §72 已改写')
else:
    i = d.find(MARK_A)
    j = d.find(MARK_B)
    assert i > 0 and j > i, 'smoke §72 定位失败 i=%d j=%d' % (i, j)
    NEW72 = """console.log('\\n===== 72. v88.1 场景整合（地形专属并入江湖游历） =====');
(function () {
  /* 本节需要"有地形"的地图（前序不保证 grid 已生成） */
  if (!(GAME.state.map && GAME.state.map.grid)) GAME.map.generate();
  var uS881 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var sS881 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');

  console.log('  --- ① 整合结构 ---');
  check('v88.1：六地形场景并入 LING_ACT（kind scene · 单地形 · outcomes 齐）', (function () {
    if (DATA.WILD_SCENES) return false;   /* 旧表已删 */
    var ids = Object.keys(DATA.LING_ACT).filter(function (k) { return DATA.LING_ACT[k].kind === 'scene'; });
    if (ids.length !== 6) return false;
    var okAll = true;
    ids.forEach(function (k) {
      var a = DATA.LING_ACT[k];
      if (!a.outcomes || !a.outcomes.length || !a.spots || a.spots.length !== 1) okAll = false;
      var tw = 0;
      (a.outcomes || []).forEach(function (o) { if (!o.w || !o.t) okAll = false; tw += o.w; });
      if (tw <= 0) okAll = false;
    });
    return okAll;
  })());
  check('v88.1：旧体系移除（函数/UI/分发）· 新链接线（一处入口）', (function () {
    var goneFn = !GAME.wildSceneCheck && !GAME.wildSceneDo && !GAME.wildSceneOf;
    var goneState = sS881.indexOf('GAME.wildSceneDo = function') < 0
      && sS881.indexOf('GAME.wildSceneCheck = function') < 0;
    var goneUI = uS881.indexOf('ui.wildSceneHTML = function') < 0
      && uS881.indexOf('do-wild-scene') < 0;
    var newWire = uS881.indexOf('ui.jianghuHTML(x, y)') >= 0;
    return goneFn && goneState && goneUI && newWire;
  })());

  console.log('  --- ② 六地形招牌（各恰 1 个 scene） ---');
  check('实测：每地形恰 1 个 scene 活动', (function () {
    var ters = ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'];
    var okAll = true;
    ters.forEach(function (t) {
      var scs = GAME.jianghuActsAt(t).filter(function (x) { return x.def.kind === 'scene'; });
      if (scs.length !== 1) okAll = false;
    });
    return okAll;
  })());

  console.log('  --- ③ 豪杰归营（经江湖链 · 权重定向必出） ---');
  check('实测：绿林探访（jianghu 链）豪杰来投 · 归当前城 · 每日锁', (function () {
    var s = GAME.state, gen = s.generals[0];
    var hill = DATA.LING_ACT.hill_scene;
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
    if (s.jianghu) delete s.jianghu[p.x + ',' + p.y + '|hill_scene'];
    gen.energy = 100;
    GAME.setStaNow(gen, 100);
    var n0 = s.generals.length;
    var r = GAME.jianghuDo(p.x, p.y, gen.id, 'hill_scene');
    var n1 = s.generals.length;
    var last = s.generals[n1 - 1];
    hill.outcomes.forEach(function (o, i) { o.w = bakW[i]; });
    if (!r.ok || n1 !== n0 + 1) return false;
    if (!last || last.cityId !== GAME.currentCity().id) return false;
    if (GAME.jianghuDo(p.x, p.y, gen.id, 'hill_scene').ok) return false;   /* 每日锁（s.jianghu） */
    return true;
  })());
})();

"""
    d = d[:i] + NEW72 + d[j:]
    io.open(P1, 'w', encoding='utf-8', newline='').write(d)
    print('OK smoke §72 已改写（v88.1）')

# =========# 附注：§73 第①条「江湖活动表齐」断言同步更新（6 -> 12 项：6 通用 + 6 场景）——
#   已直接落地于 smoke-test.js（v88.1 改动跟进；否则场景并入后该断言必红）。

# === 2) e2e v87 段替换 ============
P2 = r'E:\Deepseekdb\e2e-test.js'
e = io.open(P2, encoding='utf-8', newline='').read()

EA = "  /* ============================================================\n   * v87（老板）：野地专属场景（真实 DOM）"
EB = "  /* ============================================================\n   * v88（老板）：灵气双轨装备 + 江湖游历（真实 DOM）"

if 'v88.1. 场景整合' in e:
    print('SKIP e2e v87 段已替换')
else:
    i = e.find(EA)
    j = e.find(EB)
    assert i > 0 and j > i, 'e2e v87 段定位失败 i=%d j=%d' % (i, j)
    NEWE = """  /* ============================================================
   * v88.1：场景整合（地形专属并入江湖游历 · 真实 DOM）
   * ============================================================ */
  console.log('\\n--- v88.1. 场景整合（真实 DOM） ---');
  {
    let hp = null;
    for (let y = 3; y < 200 && !hp; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) { hp = { x, y }; break; }
      }
    }
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(hp.x, hp.y);            /* 未占 → 出兵弹窗 */
    await sleep(200);
    check('v88.1：弹窗仅一个游历区块（含「绿林探访」按钮 · 无旧「地形专属」）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && !!root.querySelector('[data-action="do-jianghu"][data-act="hill_scene"]')
        && root.textContent.indexOf('地形专属') < 0;
    })());
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="hill_scene"]'));
    await sleep(300);
    check('v88.1：执行「绿林探访」原地回显（今日已做）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('今日已做') >= 0;
    })());
    /* 已占分支同样只有新区块 */
    G.state.wilds.push({ x: hp.x, y: hp.y, type: 'hill', level: 4 });
    G.ui.openLandModal(hp.x, hp.y);
    await sleep(160);
    check('v88.1：已占野地面板同为新区块（无旧区块）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && root.textContent.indexOf('地形专属') < 0;
    })());
    G.ui.closeModal();
    await sleep(60);
  }

"""
    e = e[:i] + NEWE + e[j:]
    io.open(P2, 'w', encoding='utf-8', newline='').write(e)
    print('OK e2e v87 段已替换（v88.1）')

print()
print('全部完成。')
