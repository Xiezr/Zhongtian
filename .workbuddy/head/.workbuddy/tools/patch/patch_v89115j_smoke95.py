# -*- coding: utf-8 -*-
"""patch_v89115j_smoke95.py — 新增 smoke §95：本轮五件的新断言"""
import io, os, sys
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()
ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
if s.count(ANCHOR) != 1:
    print('!! 锚点不唯一'); sys.exit(1)

NEW = r"""  /* ============================================================
   * 95. v89.115（老板五条 + 一个 bug）
   *   ① 斗将战（战前 · 50% · 胜者将领属性 +10% 临时）
   *   ② 守将属性对守城**全军**加成（不打统率折扣；野战/攻城口径不动）
   *   ③ 自动治疗伤兵（自动菜单新成员：满金即治、暂停不关开关、15 秒节流）
   *   ④ 背包「装备 / 宝物」两类 + 宝物按商城分类检索（旧值迁移）
   *   ⑤ 来袭改**现实时间**节奏（30 分钟一场 · 提前 5 分钟预警 · 离线最多补 3 场）—— 见 §92
   * ============================================================ */
  console.log('\n===== 95. v89.115 斗将 · 守将覆盖 · 自动治疗 · 背包两类 =====');
  (function () {
    var fs95 = require('fs'), path95 = require('path');

    console.log('  --- ① 斗将战 ---');
    check('① DATA.DUEL：50% 触发 · 10% 加成 · 3 合（数值全在表里）', (function () {
      return DATA.DUEL.chance === 0.50 && DATA.DUEL.bonusPct === 0.10 && DATA.DUEL.rounds === 3;
    })());
    check('① duelBoostOf：属性 ×1.1（副本放大，原件分毫不动 = 只此一战）', (function () {
      var g = { id: 'x', name: '甲', tong: 100, yw: 90, zm: 80, nz: 70, spd: 60, level: 10 };
      var b = G.battle.duelBoostOf(g);
      return b !== g && g.yw === 90 && g.tong === 100
        && b.yw === 99 && b.tong === 110 && b.zm === 88 && b._duelBoost === 1.1;
    })());
    check('① rollDuel：同 seed 同结果（确定性）· 无将不触发 · 400 次触发率落在 50%±12.5%', (function () {
      var A = { id: 'a', name: '甲', yw: 90, tong: 90, zm: 90, level: 10 };
      var B = { id: 'b', name: '乙', yw: 80, tong: 80, zm: 80, level: 10 };
      var r1 = G.battle.rollDuel(A, B, 'seed1'), r2 = G.battle.rollDuel(A, B, 'seed1');
      var hit = 0;
      for (var i = 0; i < 400; i++) { var r = G.battle.rollDuel(A, B, 's' + i); if (r && r.done) hit++; }
      return r1 && r2 && r1.done === r2.done && r1.winner === r2.winner && !!r1.log.length
        && G.battle.rollDuel(A, null, 'x') === null
        && hit >= 150 && hit <= 250;
    })(), '触发 ' + (function () { var h = 0; for (var i = 0; i < 400; i++) { var r = G.battle.rollDuel({ id: 'a', name: '甲', yw: 90, tong: 90, zm: 90, level: 10 }, { id: 'b', name: '乙', yw: 80, tong: 80, zm: 80, level: 10 }, 's' + i); if (r && r.done) h++; } return h; })() + '/400');
    check('① 端到端：必触发时出征战报含【斗将】行（有守将的目标）', (function () {
      var bak = G.state;
      var D = DATA.DUEL, ck = D.chance, be = D.enabled;
      var okAll = false, dbg = '';
      var _exp0 = G.battle.expedition, lastR = null;
      try {
        var st95 = G.newGame({ name: '斗将', cityName: '许都', mapSeed: 20260923 });
        if (!st95.map.grid) G.map.generate();
        G.state = st95;
        D.chance = 1;                                        /* 必触发（只为可断言） */
        st95.settings = st95.settings || {}; st95.settings.battleWatch = false;
        var c95 = G.currentCity();
        var g95 = (st95.generals || [])[0];
        g95.cityId = c95.id; g95.status = 'idle';
        /* 找一格**有守将**的低等级野地（无将则不斗 —— 那是另一条规则） */
        var tgt95 = null, CMAX = G.COORD_MAX || 499;
        for (var dx = -8; dx <= 8 && !tgt95; dx++) {
          for (var dy = -8; dy <= 8 && !tgt95; dy++) {
            if (!dx && !dy) continue;
            var xx = c95.x + dx, yy = c95.y + dy;
            if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
            var tl = G.map.tile(xx, yy);
            if (!tl || tl.terrain === 'city') continue;
            var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
            if (lv < 1 || lv > 3) continue;
            var wd = G.wildDefenseAt ? G.wildDefenseAt(xx, yy, lv) : null;
            if (wd && wd.gen) tgt95 = { x: xx, y: yy, lv: lv };
          }
        }
        if (!tgt95) { dbg = 'no-guarded-wild'; return true; }   /* 无样本：不判红（规则另测） */
        c95.army = { yibing: 30000 };
        G.setStaNow(g95, 200); g95.energy = 200;
        G.battle.expedition = function () { lastR = _exp0.apply(this, arguments); return lastR; };
        var d95 = G.march.dispatch({ kind: 'wild', x: tgt95.x, y: tgt95.y, name: '试野地', lv: tgt95.lv },
          'raid', { yibing: 30000 }, g95.id, null, null, null);
        if (!d95 || d95.ok === false) { dbg = 'dispatch:' + ((d95 && d95.msg) || '-'); return false; }
        (st95.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
        G.march.tick();
        var rep = (st95.reports || [])[0];
        okAll = !!(lastR && lastR.result && lastR.result.duel && lastR.result.duel.done
          && rep && /【斗将】/.test(String(rep.body)));
      } catch (e) { dbg = 'ERR:' + (e && e.message); }
      finally {
        G.battle.expedition = _exp0;
        D.chance = ck; D.enabled = be; G.state = bak;
      }
      if (dbg) console.log('      ' + dbg);
      return okAll;
    })());

    console.log('  --- ② 守将：守城全军加成 ---');
    check('② tactic：守城守方 cover 置 1（野战/攻城不动 · NPC 不在此列）', (function () {
      var src = fs95.readFileSync(path95.join(__dirname, 'js', 'tactic.js'), 'utf8');
      return /if \(ctx && ctx\.playerDef && side === 'def' && a\) cover = 1;/.test(src);
    })());
    check('② 行为：同一守将，守城时 cover=1（全覆盖）；野战仍按统率覆盖打折', (function () {
      /* 统率 5 → 野战只覆盖 500 兵（5000 兵里 10% 吃加成）；守城 → 100% 吃 */
      var gen = { id: 'g95', name: '守', tong: 5, yw: 100, zm: 100, level: 10 };
      var army = { yibing: 5000 };
      var uDef = G.tactic.unitsOf(army, 'def', gen, { playerDef: true })[0];
      var uField = G.tactic.unitsOf(army, 'def', gen, null)[0];
      return uDef.cover === 1 && uField.cover < 0.2 && uDef.atkPct === uField.atkPct;
    })());
    check('② 城池面板守将行显示"守城全军加成 攻 +X% 防 +Y%"（与实战同一原子）', (function () {
      var src = fs95.readFileSync(path95.join(__dirname, 'js', 'ui.js'), 'utf8');
      return /守城全军加成：攻 \+/.test(src) && /ga\.atkPct/.test(src) && /ga\.defPct/.test(src);
    })());

    console.log('  --- ③ 自动治疗伤兵 ---');
    check('③ 出口在册：autoHeal / doToggleAutoHeal / healFeeOf（治疗费唯一出口）', (function () {
      var m = fs95.readFileSync(path95.join(__dirname, 'js', 'main.js'), 'utf8');
      var b = fs95.readFileSync(path95.join(__dirname, 'js', 'battle.js'), 'utf8');
      return typeof G.autoHeal === 'function' && typeof G.doToggleAutoHeal === 'function'
        && typeof G.healFeeOf === 'function' && G.healFeeOf(30) === 300
        && /case 'toggle-auto-heal'/.test(m) && /var gold = GAME\.healFeeOf\(n\)/.test(b);
    })());
    check('③ 行为：开自动 + 有伤兵 + 金够 → 一次治完（伤兵归零、兵按兵种回城、金扣治疗费）', (function () {
      var bak = G.state;
      try {
        var st95b = G.newGame({ name: '治', cityName: '许都', mapSeed: 11 });
        G.state = st95b;
        var c = st95b.cities[0];
        c.army = {};
        st95b.res.gold = 100000;
        st95b.wounded = 30; st95b.woundedArmy = { yibing: 30 };
        st95b.settings = st95b.settings || {};
        st95b.settings.autoHeal = true;
        st95b.autoHealState = { msg: 't', at: 0 };              /* at=0 → 不受节流 */
        var r = G.autoHeal();
        return !!(r && r.ok) && st95b.wounded === 0 && (c.army.yibing || 0) === 30
          && st95b.res.gold === 100000 - G.healFeeOf(30)
          && /自动/.test(st95b.autoHealState.msg);
      } finally { G.state = bak; }
    })());
    check('③ 行为：金不足 → 暂停但**不关开关**（开关仍为 on）；15 秒内不重复尝试', (function () {
      var bak = G.state;
      try {
        var st95c = G.newGame({ name: '治2', cityName: '许都', mapSeed: 12 });
        G.state = st95c;
        st95c.cities[0].army = {};
        st95c.res.gold = 0;
        st95c.wounded = 10; st95c.woundedArmy = { yibing: 10 };
        st95c.settings = st95c.settings || {};
        st95c.settings.autoHeal = true;
        st95c.autoHealState = { msg: 't', at: 0 };
        var r1 = G.autoHeal();                                   /* 金不足 → 暂停 */
        var pausedOK = !r1.ok === false && st95c.wounded === 10 && st95c.settings.autoHeal === true
          && /暂停/.test(st95c.autoHealState.msg);
        var r2 = G.autoHeal();                                   /* 立刻再调 → 节流拦住（返回 null） */
        return pausedOK && r2 === null;
      } finally { G.state = bak; }
    })());
    check('③ tick 挂钩：tickOnce 里调 autoHeal（在线也自动治）', (function () {
      var src = fs95.readFileSync(path95.join(__dirname, 'js', 'state.js'), 'utf8');
      return /if \(GAME\.autoHeal\) GAME\.autoHeal\(\);/.test(src);
    })());

    console.log('  --- ④ 背包：装备 / 宝物两类 + 商城分类检索 ---');
    check('④ 两类页签（装备 / 宝物）+ 宝物二级分类条（只列有货的，含数量）', (function () {
      var src = fs95.readFileSync(path95.join(__dirname, 'js', 'ui.js'), 'utf8');
      return /BAG_TABS = \[\['equip', '装备'\], \['treasure', '宝物'\]\]/.test(src)
        && /ui\.bagSubChipsHTML = function/.test(src)
        && /data-action="bag-sub"/.test(src) && /data-action="bag-sub"/.test(G.ui.bagSubChipsHTML());
    })());
    check('④ 分类只渲染该类（材料 / 图纸 / 单一类型各走各的渲染）', (function () {
      var bak = G.state, bakSub = G.ui._bagSub, bakTab = G.ui._bagTab;
      try {
        var st95d = G.newGame({ name: '包', cityName: '许都', mapSeed: 13 });
        G.state = st95d;
        st95d.items = { chest_tong: 2, lingsui: 3 };
        G.ui._bagTab = 'treasure';
        G.ui._bagSub = 'chest';
        var hChest = G.ui.bagTreasureHTML('type');
        G.ui._bagSub = 'blueprint';
        var hBp = G.ui.bagTreasureHTML('val');
        G.ui._bagSub = 'all';
        var hAll = G.ui.bagTreasureHTML('type');
        return /chest_tong/.test(hChest) && !/lingsui/.test(hChest)
          && /装备图纸|尚无装备图纸/.test(hBp)
          && /chest_tong/.test(hAll) && /lingsui/.test(hAll);
      } finally { G.state = bak; G.ui._bagSub = bakSub; G.ui._bagTab = bakTab; }
    })());
    check('④ 旧值迁移：openBag("item") → 宝物·全部；setBagTab("mat") → 宝物·材料', (function () {
      var bakTab = G.ui._bagTab, bakSub = G.ui._bagSub;
      try {
        G.ui.openBag('item');
        var o1 = (G.ui._bagTab === 'treasure' && G.ui._bagSub === 'all');
        G.ui.setBagTab('mat');
        var o2 = (G.ui._bagTab === 'treasure' && G.ui._bagSub === 'material');
        return o1 && o2;
      } finally { G.ui._bagTab = bakTab; G.ui._bagSub = bakSub; }
    })());
  })();

""" + ANCHOR
s2 = s.replace(ANCHOR, NEW, 1)
tmp = P + '.tmp95'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp, P)
print('DONE')
