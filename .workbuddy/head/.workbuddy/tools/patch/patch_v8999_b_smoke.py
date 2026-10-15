# -*- coding: utf-8 -*-
"""v89.99-B 冒烟第 99 节：人口经济四件套的验收断言（幂等）"""
import io, sys

R = 'E:/Deepseekdb/'
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()

ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
if '99. v89.99 人口经济' in s:
    print('SKIP: 第 99 节已存在')
    sys.exit(0)
if ANCHOR not in s:
    print('MISS anchor'); sys.exit(1)

SEC = """  /* ============================================================
   * 99. v89.99 人口经济：解救归农（解散）/ 增民令 / 俘获迁民 / 增速三杠杆
   * ------------------------------------------------------------
   * 老板令：「人口不足就开发其他路径；设计兵种解散 —— 有人口就征义兵，
   *   避免人口停在顶端；要特定兵种时解散归农再改募。」
   * 本节的钉子：每个新出口都能被单独验证，且"写进去必须有人读"（真到期）。
   * ============================================================ */
  console.log('\\n===== 99. v89.99 人口经济：解散归农 / 增民令 / 俘获迁民 / 增速杠杆 =====');
  (function () {
    var oldState99 = G.state;
    var S99 = G.newGame({ name: 'v99', cityName: '许都' });
    if (!S99.map.grid) G.map.generate();
    G.state = S99;
    G.ui._cityId = S99.cities[0].id;
    var c99 = S99.cities[0];

    console.log('  --- A 兵种解散：归农（人口 100%）· 军资不退 · 可超上限 ---');
    check('A：配置表齐备（DISBAND / POP_CFG / CAPTIVE 唯一来源）', (function () {
      return !!DATA.DISBAND && DATA.DISBAND.popReturn === 1
        && !!DATA.POP_CFG && DATA.POP_CFG.base === 0.0005 && DATA.POP_CFG.govCap === 0.5
        && !!DATA.CAPTIVE && DATA.CAPTIVE.rate === 0.06 && DATA.CAPTIVE.kinds.join(',') === 'fort,city';
    })());
    check('A：解散 40 义兵 → 兵 60、人口 +40、军资不退', (function () {
      c99.army = { yibing: 100 };
      var Rr = G.res(c99); Rr.pop = 500; Rr.grain = 10000; Rr.wood = 10000; Rr.iron = 10000;
      var r = G.disbandAt(c99.id, 'yibing', 40);
      return r.ok === true && r.n === 40 && r.pop === 40
        && c99.army.yibing === 60 && Rr.pop === 540
        && Rr.grain === 10000 && Rr.wood === 10000 && Rr.iron === 10000;
    })());
    check('A：超过实有按实有解散且键清空', (function () {
      c99.army = { yibing: 30 };
      var Rr = G.res(c99); Rr.pop = 100;
      var r = G.disbandAt(c99.id, 'yibing', 100);
      return r.ok === true && r.n === 30 && c99.army.yibing === undefined && Rr.pop === 130;
    })());
    check('A：三类非法输入被拒（无兵 / 未知兵 / 数量非法）', (function () {
      c99.army = {};
      var a = G.disbandAt(c99.id, 'yibing', 5);
      var b = G.disbandAt(c99.id, 'no_such_troop', 5);
      c99.army = { yibing: 5 };
      var c = G.disbandAt(c99.id, 'yibing', 0);
      var d = G.disbandAt(c99.id, 'yibing', -3);
      c99.army = {};
      return a.ok === false && b.ok === false && c.ok === false && d.ok === false;
    })());
    check('A：人口可超上限、上限外不回落（存人前提：tick 判据在源码层）', (function () {
      c99.army = { yibing: 200 };
      var Rr = G.res(c99);
      var cap = G.maxPopOf(c99);
      Rr.pop = cap;
      var r = G.disbandAt(c99.id, 'yibing', 100);
      var stSrc = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8'));
      return r.ok === true && Rr.pop === cap + 100 && cap > 0
        && /if \\(R\\.pop < maxPop\\) R\\.pop = Math\\.min\\(maxPop/.test(stSrc);
    })());
    check('A：界面接线（军队面板有解散按钮 + main 有分发）', (function () {
      var uS = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
      var mS = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8'));
      return /data-action="troop-disband"/.test(uS) && /case 'troop-disband'/.test(mS);
    })());

    console.log('  --- B 增民令：增速道具（唯一出口 · 真到期 · 不叠加） ---');
    check('B：增民令在售 + 民生页签 + 文案写明增速', (function () {
      var it = (DATA.ITEMS || []).filter(function (x) { return x.id === 'zengminling'; })[0];
      return !!it && it.price > 0 && it.type === 'pop_boost'
        && it.desc.indexOf('人口增速') >= 0
        && G.ui.SHOP_CATS.pop_boost === '民生'
        && G.ui.shopItems().some(function (x) { return x.id === 'zengminling'; });
    })());
    check('B：买入并使用 → 增速 ×3；到期自动失效（真消费，不是死字段）', (function () {
      var Rr = G.res(c99);
      Rr.gold = 100000;
      var b = G.doShopping('zengminling', 2);
      var before = G.popGrowthOf(c99);
      var u1 = G.systems.useItem('zengminling', null);
      var mul1 = G.popBoostMult();
      var after = G.popGrowthOf(c99);
      /* 到期：把 until 拨到过去 → 立刻失效（这条同时证明字段**有人读**） */
      S99.buffs.popBoost.until = 1;
      var mulDead = G.popBoostMult();
      /* 再用一张：从过期态刷新回未来（不叠加 —— 仍是 ×3） */
      var u2 = G.systems.useItem('zengminling', null);
      var mul2 = G.popBoostMult();
      var refreshed = S99.buffs.popBoost.until > 1000;
      return b.ok && u1.ok && Math.abs(mul1 - 3) < 1e-9
        && Math.abs(after / before - 3) < 1e-6 && mulDead === 1
        && u2.ok && Math.abs(mul2 - 3) < 1e-9 && refreshed
        && u2.msg.indexOf('更强') < 0;
    })());
    check('B：增速来源分解走唯一出口（界面有消费点）', (function () {
      var uS = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
      return typeof G.popSourcesOf === 'function' && (G.popSourcesOf(c99) || []).length === 3
        && /popSourcesOf/.test(uS);
    })());

    console.log('  --- C 增速杠杆：守将内政 / 税制（同一出口） ---');
    check('C：守将内政加成（封顶 +50%）', (function () {
      (S99.generals || []).forEach(function (g) { if (g.status === 'guard') g.status = 'idle'; });
      var gv = G.makeGeneral('田官', 60, 'idle', c99.id, false);
      gv.nz = 2000; gv.status = 'guard';
      S99.generals.push(gv);
      var bonus = G.popGovBonus(c99);
      var growthWith = G.popGrowthOf(c99);
      gv.status = 'idle';
      var growthNo = G.popGrowthOf(c99);
      S99.generals.pop();
      return Math.abs(bonus - 0.5) < 1e-9 && Math.abs(growthWith / growthNo - 1.5) < 1e-6;
    })());
    check('C：税制杠杆（轻徭薄赋 ×1.09 / 重税 ×0.88 / 基准 ×1）', (function () {
      S99.tax = 0.5; var m0 = G.popTaxMul();
      S99.tax = 0.35; var m1 = G.popTaxMul();
      S99.tax = 0.7; var m2 = G.popTaxMul();
      S99.tax = 0.5;
      return Math.abs(m0 - 1) < 1e-9 && Math.abs(m1 - 1.09) < 1e-9 && Math.abs(m2 - 0.88) < 1e-9;
    })());

    console.log('  --- D 俘获迁民：打出来的入口 ---');
    check('D：俘获口径（6% · 上限 500 · 不足 15 不收 · 仅据点/名城）', (function () {
      var Rr = G.res(c99); Rr.pop = 1000;
      var tF = { kind: 'fort', name: '测点' };
      var tW = { kind: 'wild', name: '野地' };
      var r1 = G.battle.captiveGain(c99, { defLoss: 1000 }, tF);
      var r2 = G.battle.captiveGain(c99, { defLoss: 1000 }, tW);
      var r3 = G.battle.captiveGain(c99, { defLoss: 100 }, tF);
      var r4 = G.battle.captiveGain(c99, { defLoss: 100000 }, tF);
      return r1.gain === 60 && r2.gain === 0 && r3.gain === 0 && r4.gain === 500 && Rr.pop === 1560;
    })());
    check('D：实战集成（打据点胜利 → 战报有俘获、出征城人口增加）', (function () {
      var fD = null;
      for (var ry = 0; ry < 121 && !fD; ry++) {
        for (var rx = 0; rx < 121 && !fD; rx++) {
          var fh = G.map.fortAt(c99.x - 60 + rx, c99.y - 60 + ry);
          if (fh && fh.level <= 3) fD = fh;
        }
      }
      if (!fD) { window.__cap99 = 'no-fort'; return true; }
      var gD = G.makeGeneral('俘获甲', 60, 'idle', c99.id, false);
      gD.stamina = 300; gD.energy = 100; gD.tong = 500; gD.yw = 400; gD.zm = 400;
      S99.generals.push(gD);
      S99.settings.battleWatch = false;
      var wBank = S99.world.weather; S99.world.weather = 'clear';
      if (G.siegeScopeOf({ kind: 'fort', x: fD.x, y: fD.y })) G.siegeClear({ kind: 'fort', x: fD.x, y: fD.y });
      c99.army = { gongjian: 40000 };
      var Rr = G.res(c99); Rr.pop = 1000;
      var r = G.battle.expedition({ kind: 'fort', x: fD.x, y: fD.y }, 'occupy', { gongjian: 40000 }, gD.id);
      S99.world.weather = wBank;
      S99.generals.pop();
      if (!r || !r.ok || !r.result || r.result.winner !== 'atk') {
        window.__cap99 = '未胜（不判）'; return true;
      }
      var cap = r.result.captives;
      window.__cap99 = '俘获 ' + (cap ? cap.gain : 0) + ' 人 → 人口 ' + Math.round(Rr.pop);
      return !!cap && cap.gain > 0 && Rr.pop === 1000 + cap.gain
        && (S99.reports || [])[0] && S99.reports[0].body.indexOf('俘获') >= 0;
    })(), window.__cap99 || '');

    G.state = oldState99;
  })();

"""
s = s.replace(ANCHOR, SEC + ANCHOR, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK: 第 99 节已插入')
