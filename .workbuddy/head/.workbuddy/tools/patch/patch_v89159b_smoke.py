# -*- coding: utf-8 -*-
"""v89.159 补丁 B：升级 smoke 三段旧断言（爵位解锁口径）+ 新增 §159 节（3 条需求各自的断言）。
分段落盘 + 幂等守卫 + 写后自检（node --check）。"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'smoke-test.js'


def read(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def write(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


def rep(tag, old, new, guard):
    s = read(P)
    if guard and guard in s:
        print('  [skip] %-40s 已落盘' % tag); sys.stdout.flush()
        return
    n = s.count(old)
    assert n == 1, '%s 锚点命中 %d 次' % (tag, n)
    s = s.replace(old, new)
    assert new in s, tag + ' 落盘失败'
    write(P, s)
    print('  [ ok ] %-40s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── ① 上限链：官府先升，其他建筑随之上（新增"严格 ≤ 官府"两行） ──
OLD1 = """      [0, 1, 5, 21].forEach(function (rk) {
        var selfM = capWith('self', 12, rk, true);
        var selfN = capWith('self', 12, rk, false);
        var capM = capWith('capital', 24, rk, true);
        var capN = capWith('capital', 24, rk, false);
        /* 主城：12 + rk / 24 + rk；非主城：恒 12 / 24 */
        if (selfM.cap !== 12 + rk) bad.push('自建主城 rk' + rk + '=' + selfM.cap);
        if (capM.cap !== 24 + rk) bad.push('都城主城 rk' + rk + '=' + capM.cap);
        if (selfN.cap !== 12) bad.push('自建非主城 rk' + rk + '=' + selfN.cap);
        if (capN.cap !== 24) bad.push('都城非主城 rk' + rk + '=' + capN.cap);
        if (selfM.gov !== 12 + rk) bad.push('主城官府 rk' + rk + '=' + selfM.gov);
        if (selfM.lift !== rk || selfN.lift !== 0) bad.push('解锁量 rk' + rk + '=' + selfM.lift + '/' + selfN.lift);
      });
      S102.rank = oldRank; S102.mainCityId = oldMain;
      return bad.length === 0;
    })(), '自建 12→33 / 都城 24→45（满档）· 非主城恒 12/24');"""
NEW1 = """      [0, 1, 5, 21].forEach(function (rk) {
        /* v89.159（老板 2 拍板「严格 ≤ 官府」）：要看到"爵位解锁"落到其他建筑上，
           必须把官府也升到"档位 + 解锁"（其他建筑随官府走，不再自己超前 N 级）；
           后两行同时钉住新规矩：官府没升时，其他建筑**不得超过官府**。 */
        var selfM = capWith('self', 12 + rk, rk, true);
        var selfN = capWith('self', 12, rk, false);
        var capM = capWith('capital', 24 + rk, rk, true);
        var capN = capWith('capital', 24, rk, false);
        var hold = capWith('self', 12, rk, true);          /* 官府停在 12 */
        var holdN = capWith('self', 12 + rk, rk, false);   /* 非主城：官府再高也没用 */
        /* 主城：官府 12+rk/24+rk → 民房 12+rk/24+rk；非主城：恒 12 / 24 */
        if (selfM.cap !== 12 + rk) bad.push('自建主城 rk' + rk + '=' + selfM.cap);
        if (capM.cap !== 24 + rk) bad.push('都城主城 rk' + rk + '=' + capM.cap);
        if (selfN.cap !== 12) bad.push('自建非主城 rk' + rk + '=' + selfN.cap);
        if (capN.cap !== 24) bad.push('都城非主城 rk' + rk + '=' + capN.cap);
        if (selfM.gov !== 12 + rk) bad.push('主城官府 rk' + rk + '=' + selfM.gov);
        if (selfM.lift !== rk || selfN.lift !== 0) bad.push('解锁量 rk' + rk + '=' + selfM.lift + '/' + selfN.lift);
        if (hold.cap > hold.gov) bad.push('严格闸 rk' + rk + ' 民房' + hold.cap + ' > 官府' + hold.gov);
        if (holdN.cap !== 12) bad.push('非主城严格 rk' + rk + '=' + holdN.cap);
      });
      S102.rank = oldRank; S102.mainCityId = oldMain;
      return bad.length === 0;
    })(), '解锁抬官府上限（自建 12→33 / 都城 24→45）· 其他建筑严格 ≤ 官府（v89.159）');"""
rep('smoke · 上限链口径升级', OLD1, NEW1, '严格闸 rk')

# ── ② 官府总闸：改成"严格 ≤ 官府"的真调三态 ──
OLD2 = """    check('④ 官府总闸随爵位同步抬升（否则"解锁了却被官府卡住"）', (function () {
      var c = G.makeCity({ id: 'rc_gate', name: 'g', x: 3, y: 3, type: 'self' });
      c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
      var oldRank = S102.rank, oldMain = S102.mainCityId;
      S102.rank = 5; S102.mainCityId = c.id;
      var capM = G.buildCapOf(c, 'minfang');        /* min(12+5, 12+5) = 17 */
      var preA = G.buildPrereqOf(c, 'minfang', 17); /* 17 ≤ 12+5 → 无 gate */
      S102.mainCityId = null;
      S102.rank = 5;
      var capN = G.buildCapOf(c, 'minfang');        /* 仍 12 */
      S102.rank = oldRank; S102.mainCityId = oldMain;
      return capM === 17 && preA.ok === true && capN === 12;
    })());"""
NEW2 = """    check('④ 官府总闸（v89.159 严格 ≤ 官府）：解锁后仍要先升官府，官府到位才放行', (function () {
      var c = G.makeCity({ id: 'rc_gate', name: 'g', x: 3, y: 3, type: 'self' });
      var setGov = function (lv) { c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = lv; }); };
      setGov(12);
      var oldRank = S102.rank, oldMain = S102.mainCityId;
      S102.rank = 5; S102.mainCityId = c.id;
      var capM = G.buildCapOf(c, 'minfang');        /* min(12+5, 12) = 12（严格） */
      var preA = G.buildPrereqOf(c, 'minfang', 17); /* 17 > 官府 12 → gate 指向官府 Lv17 */
      var gate = preA.ok === false && preA.list.length === 1
        && preA.list[0].bid === 'guanfu' && preA.list[0].need === 17 && preA.list[0].gate === true;
      setGov(17);
      var preB = G.buildPrereqOf(c, 'minfang', 17); /* 官府到位 → 放行 */
      var capB = G.buildCapOf(c, 'minfang');        /* = 官府 17 */
      S102.mainCityId = null;
      S102.rank = 5;
      var capN = G.buildCapOf(c, 'minfang');        /* 非主城：自身档位 12 的顶更紧 */
      S102.rank = oldRank; S102.mainCityId = oldMain;
      return capM === 12 && gate && preB.ok === true && capB === 17 && capN === 12;
    })());"""
rep('smoke · 官府总闸严格化', OLD2, NEW2, 'v89.159 严格 ≤ 官府）：解锁后仍要先升官府')

# ── ③ 真通道：先升官府 → 其他建筑随之上 ──
OLD3 = """    check('④ 真通道：主城可以真的升过旧硬顶 12 级（域层守卫放行）', (function () {
      var c = S102.cities[0];
      var idx = -1;
      c.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'minfang') idx = i; });
      if (idx < 0) {
        idx = c.cells.findIndex(function (x) { return !x.build && !x.official; });
        if (idx < 0) return false;
        c.cells[idx].build = { id: 'minfang', lvl: 12 };
      }
      var gIdx = -1;
      c.cells.forEach(function (x, i) { if (gIdx < 0 && x.build && x.build.id === 'guanfu') gIdx = i; });
      if (gIdx >= 0) c.cells[gIdx].build.lvl = 12;
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
      S102.mainCityId = c.id;
      c.cells[idx].build.lvl = 12;
      S102.rank = 0;
      var r0 = G.upgradeAt(c.id, idx);              /* 平民：仍被 12 级硬顶拦住 */
      /* 清掉可能的队列/待办，回到干净态 */
      S102.queues.build = (S102.queues.build || []).filter(function (q) { return Number(q.gridIndex) !== idx; });
      c.cells[idx].pending = null;
      c.cells[idx].build.lvl = 12;
      S102.rank = 5;
      var r5 = G.upgradeAt(c.id, idx);              /* 大夫：上限 17 → 放行 */
      var queued = !!GAME.queueAt('city', idx);
      S102.queues.build = (S102.queues.build || []).filter(function (q) { return Number(q.gridIndex) !== idx; });
      c.cells[idx].pending = null;
      return r0.ok === false && /已达最高等级/.test(r0.msg || '') && r5.ok === true && queued;
    })());"""
NEW3 = """    check('④ 真通道（v89.159）：主城**先升官府** → 其他建筑随之上，真能升过旧硬顶 12 级', (function () {
      var c = S102.cities[0];
      var idx = -1;
      c.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'minfang') idx = i; });
      if (idx < 0) {
        idx = c.cells.findIndex(function (x) { return !x.build && !x.official; });
        if (idx < 0) return false;
        c.cells[idx].build = { id: 'minfang', lvl: 12 };
      }
      var gIdx = -1;
      c.cells.forEach(function (x, i) { if (gIdx < 0 && x.build && x.build.id === 'guanfu') gIdx = i; });
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
      /* 12→13 的珠宝需求补足（本用例验门槛，不验材料） */
      var _c13 = DATA.BUILDINGS.minfang.levelCost(12) || {};
      if (_c13.jewel) {
        S102.jewels = S102.jewels || {};
        for (var jk in _c13.jewel) S102.jewels[jk] = Math.max(S102.jewels[jk] || 0, _c13.jewel[jk]);
      }
      S102.mainCityId = c.id; S102.rank = 5;
      c.cells[idx].build.lvl = 12;
      if (gIdx >= 0) c.cells[gIdx].build.lvl = 12;
      var rA = G.upgradeAt(c.id, idx);              /* 官府 12：严格闸 → 拦（报需官府 Lv13） */
      var blocked = rA.ok === false && rA.short === '需官府 Lv13';
      S102.queues.build = (S102.queues.build || []).filter(function (q) { return Number(q.gridIndex) !== idx; });
      c.cells[idx].pending = null;
      if (gIdx >= 0) c.cells[gIdx].build.lvl = 13;  /* 先升官府 */
      var rB = G.upgradeAt(c.id, idx);              /* 官府 13 → 放行（13 ≤ 上限 12+5 = 17） */
      var queued = !!GAME.queueAt('city', idx);
      S102.queues.build = (S102.queues.build || []).filter(function (q) { return Number(q.gridIndex) !== idx; });
      c.cells[idx].pending = null;
      return blocked && rB.ok === true && queued;
    })());"""
rep('smoke · 真通道改"先升官府"', OLD3, NEW3, '主城**先升官府** → 其他建筑随之上')

# ── ④ 新增 §159 一节（插在总结算之前） ──
SEC = r"""  /* ============================================================
   * §159. v89.159：
   *   ① 将领**自身升级** → 状态刷新（体力/精力回满）—— 老板 1
   *   ② 民房等"多座建筑"的升级门槛按**本座**目标等级（老板 2 的真 bug）
   *   ③ 官府总闸**严格 ≤ 官府等级**（老板 2 拍板；爵位解锁抬的是官府自己的上限）
   * ============================================================ */
  console.log('\n===== 159. v89.159（升级回满 · 本座门槛 · 严格总闸） =====');
  (function () {
    var fs159 = require('fs'), p159 = require('path');
    var uS159 = fs159.readFileSync(p159.join(__dirname, 'js', 'ui.js'), 'utf8');
    var dS159 = stripComment(fs159.readFileSync(p159.join(__dirname, 'js', 'domain.js'), 'utf8'));
    var bS159 = stripComment(fs159.readFileSync(p159.join(__dirname, 'js', 'battle.js'), 'utf8'));

    /* ---- ① 升级即回满 ---- */
    check('§159① 将领升级 → 体力/精力双回满（真调 gainExp，读数走 staNow/energyNowOf）', (function () {
      var st = G.state;
      var g = (st.generals || []).filter(function (x) { return !x.isLord; })[0];
      if (!g) return false;
      var bk = { lv: g.level, exp: g.exp, sta: g.stamina, ene: g.energy };
      try {
        G.setStaNow(g, Math.round(G.staMax(g) * 0.2));
        G.setEnergyNow(g, Math.round(G.energyMaxOf(g) * 0.15));
        G.battle.gainExp(g, G.expNeedOf(g) + 1, '§159');
        return g.level > bk.lv && G.staNow(g) === G.staMax(g) && G.energyNowOf(g) === G.energyMaxOf(g);
      } finally {
        g.level = bk.lv; g.exp = bk.exp; g.stamina = bk.sta; g.energy = bk.ene;
      }
    })(), '升级 → 满；未升级不动（见下条对照）');
    check('§159① 对照：只涨经验**不升级** → 体力/精力原样（不是"一涨经验就回满"）', (function () {
      var st = G.state;
      var g = (st.generals || []).filter(function (x) { return !x.isLord; })[0];
      if (!g) return false;
      var bk = { lv: g.level, exp: g.exp, sta: g.stamina, ene: g.energy };
      try {
        G.setStaNow(g, Math.round(G.staMax(g) * 0.3));
        G.setEnergyNow(g, Math.round(G.energyMaxOf(g) * 0.3));
        var s0 = G.staNow(g), e0 = G.energyNowOf(g);
        if (G.expNeedOf(g) <= 2) return false;            /* 需足够空间给"不升级"的经验 */
        G.battle.gainExp(g, 1, '§159对照');
        return g.level === bk.lv && G.staNow(g) === s0 && G.energyNowOf(g) === e0;
      } finally {
        g.level = bk.lv; g.exp = bk.exp; g.stamina = bk.sta; g.energy = bk.ene;
      }
    })());
    check('§159① 唯一出口（源码）：回满只写在 checkLevelUp 内一处（多级连升只回一次）',
      (function () {
        var i0 = bS159.indexOf('GAME.checkLevelUp = function');
        var i1 = bS159.indexOf('GAME.battle.gainExp = function');
        if (i0 < 0 || i1 < 0 || i1 <= i0) return false;
        var seg = bS159.slice(i0, i1);
        return /GAME\.setStaNow\(gen, GAME\.staMax\(gen\)\)/.test(seg)
          && /GAME\.setEnergyNow\(gen, GAME\.energyMaxOf\(gen\)\)/.test(seg)
          && (bS159.match(/GAME\.setStaNow\(gen, GAME\.staMax\(gen\)\)/g) || []).length === 1
          && (bS159.match(/GAME\.setEnergyNow\(gen, GAME\.energyMaxOf\(gen\)\)/g) || []).length === 1;
      })());

    /* ---- ② 多座建筑：门槛按本座等级 ---- */
    check('§159② 多座民房门槛按**本座**等级（Lv4 + Lv3 混存 · 真调三态 + 界面同源）', (function () {
      var st = G.state;
      var c = G.makeCity({ id: 'v159a', name: 'v159城', x: 600, y: 600, type: 'self' });
      var bkQ = (st.queues.build || []).slice();
      st.cities.push(c);
      try {
        var idxs = [];
        c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'minfang') idxs.push(i); });
        if (idxs.length < 2) return false;
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
        c.cells[idxs[0]].build.lvl = 4; c.cells[idxs[1]].build.lvl = 3;
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
        var preLow = G.buildPrereqOf(c, 'minfang', 4);        /* 本座 Lv3 → 4 */
        var rLow = G.upgradeAt(c.id, idxs[1]);                /* ★ 老板场景：应放行 */
        st.queues.build = bkQ.slice();
        c.cells[idxs[1]].pending = null;
        var rHigh = G.upgradeAt(c.id, idxs[0]);               /* Lv4 → 5：正确被拦（需官府 5） */
        st.queues.build = bkQ.slice();
        c.cells[idxs[0]].pending = null;
        /* 界面与内核同源（源码级 · 两处都传本座等级） */
        var nPanel = (uS159.match(/GAME\.buildPrereqOf\(c, cell\.build\.id, cell\.build\.lvl \+ 1\)/g) || []).length;
        var nCore = (dS159.match(/GAME\.buildPrereqOf\(city, cell\.build\.id, cell\.build\.lvl \+ 1\)/g) || []).length;
        return preLow.ok === true && rLow.ok === true
          && rHigh.ok === false && rHigh.short === '需官府 Lv5'
          && nPanel === 1 && nCore === 1;
      } finally {
        st.cities = st.cities.filter(function (x) { return x.id !== 'v159a'; });
        st.queues.build = bkQ.slice();
      }
    })(), '改前：另一座 Lv4 让本座被按"4→5"拦下（报需官府 Lv5）');

    /* ---- ③ 严格 ≤ 官府 ---- */
    check('§159③ 总闸严格化（源码）：buildCapOf 不再 `govLv + lift`；门槛 need = next', (function () {
      var i0 = dS159.indexOf('GAME.buildCapOf = function');
      var i1 = dS159.indexOf('GAME.buildPrereqOf = function');
      if (i0 < 0 || i1 < 0 || i1 <= i0) return false;
      var seg = dS159.slice(i0, i1);
      return !/Math\.min\(cap, govLv \+ lift\)/.test(seg)
        && /Math\.min\(cap, govLv\)/.test(seg)
        && /next > govLv && next <= govCap/.test(dS159)
        && !/next > govLv \+ lift/.test(dS159);
    })());
    check('§159③ 主城：其他建筑上限 = 官府等级；先升官府即放行（真调两态）', (function () {
      var st = G.state;
      var c = G.makeCity({ id: 'v159b', name: 'v159b城', x: 601, y: 601, type: 'self' });
      var bkQ = (st.queues.build || []).slice();
      var bkMain = st.mainCityId, bkRank = st.rank;
      st.cities.push(c);
      try {
        var gi = -1, mi = -1;
        c.cells.forEach(function (x, i) {
          if (x.build && x.build.id === 'guanfu' && gi < 0) gi = i;
          if (x.build && x.build.id === 'minfang' && mi < 0) mi = i;
        });
        if (gi < 0) return false;
        if (mi < 0) {
          mi = c.cells.findIndex(function (x) { return !x.build && !x.official; });
          if (mi < 0) return false;
          c.cells[mi].build = { id: 'minfang', lvl: 12 };
        }
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
        var _c = DATA.BUILDINGS.minfang.levelCost(12) || {};
        if (_c.jewel) { st.jewels = st.jewels || {}; for (var jk in _c.jewel) st.jewels[jk] = Math.max(st.jewels[jk] || 0, _c.jewel[jk]); }
        st.mainCityId = c.id; st.rank = 5;
        c.cells[gi].build.lvl = 12; c.cells[mi].build.lvl = 12;
        var capA = G.buildCapOf(c, 'minfang');
        var rA = G.upgradeAt(c.id, mi);
        var blocked = rA.ok === false && rA.short === '需官府 Lv13';
        st.queues.build = bkQ.slice(); c.cells[mi].pending = null;
        c.cells[gi].build.lvl = 13;                     /* 先升官府 */
        var capB = G.buildCapOf(c, 'minfang');
        var rB = G.upgradeAt(c.id, mi);
        var ok2 = rB.ok === true;
        st.queues.build = bkQ.slice(); c.cells[mi].pending = null;
        return capA === 12 && blocked && capB === 13 && ok2;
      } finally {
        st.cities = st.cities.filter(function (x) { return x.id !== 'v159b'; });
        st.queues.build = bkQ.slice();
        st.mainCityId = bkMain; st.rank = bkRank;
      }
    })());
    check('§159③ 界面：上限行写清"受官府 LvN 限制 · 升官府可提升"（源码级）',
      /受官府 Lv/.test(uS159) && /升官府可提升/.test(uS159));

    /* ---- ④ 档案在册 ---- */
    check('§159④ 需求档案在册（v89.159 · 老板原文关键句逐字）', (function () {
      var arc = fs159.readFileSync(p159.join(__dirname, '需求档案.md'), 'utf8');
      return arc.indexOf('v89.159') >= 0
        && arc.indexOf('升级时将领刷新状态') >= 0
        && arc.indexOf('民房点不了升级') >= 0
        && arc.indexOf('其他建造等级不能超过官府等级') >= 0;
    })());
  })();

"""
OLDT = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
NEWT = SEC + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
rep('smoke · 新增 §159 节', OLDT, NEWT, '159. v89.159（升级回满 · 本座门槛 · 严格总闸）')

print('\n补丁 B 全部完成。')
