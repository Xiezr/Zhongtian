# -*- coding: utf-8 -*-
"""v89.185 · 新增 §185 断言段（smoke + e2e）——六维不封口 / 守将体系 / 衰减-2 / 民心人口 / weak / 撤退沙盘同源。"""
import io

# ================= smoke =================
P = 'smoke-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s
anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, 'anchor count'
seg = """  /* ═══════════════════════════════════════════════════════════
   * §185（v89.185）老板 7 条：六维不封口 · 守将体系 · 衰减-2 · 民心人口 · 智能 weak · 撤退沙盘同源
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    /* ① 六维不封口 */
    check('§185① 六维尾段不封口：450 后恒定 +0.25%/点（内政）· 表无 maxK 截断', (function () {
      var f = G.curveBonusOf;
      var a = f(450, 0.01, 150), b = f(450 + 1000, 0.01, 150);
      return Math.abs((b - a) - 2.5) < 1e-9 && !('maxK' in (DATA.MAYOR_CURVE || {}));
    })());

    /* ② 衰减表 */
    check('§185② 野地衰减表在册（-2/日 · 驻军 -1/日 · 任何保护不为 0）', (function () {
      var WD = DATA.WILD_DECAY || {};
      return WD.perDay === 2 && WD.heldPerDay === 1;
    })());

    /* ③ 守将体系 */
    check('§185③a 守将三表在册（野地 30/10/10 · 据点 60/10/10 · 名城区间上抬 + 折损表）', (function () {
      var W = DATA.WILD_GUARD_LV || {}, F = DATA.FORT_GUARD_LV || {};
      var N = DATA.NPC_GUARD_LV || {}, FD = DATA.GUARD_FOLD || {};
      return W.base === 30 && W.perLv === 10 && F.base === 60 && F.perLv === 10
        && N.county[0] === 120 && N.capital[1] === 240
        && FD.dim === 0.5 && FD.staPct === 0.5;
    })());

    check('§185③b 野地守将实测（Lv5 → Lv70~79 · 资质英杰）', (function () {
      var got = 0, ok = true, rankOk = true;
      for (var i = 0; i < 90 && got < 8; i++) {
        var wd = G.wildDefenseAt(30 + (i % 9), 200 + ((i / 9) | 0), 5);
        if (!wd.gen) continue;
        got++;
        if (!(wd.gen.level >= 70 && wd.gen.level <= 79)) ok = false;
        if (wd.gen.rank !== 'ying') rankOk = false;
      }
      return got > 0 && ok && rankOk;
    })());

    check('§185③c 据点守将实测（Lv5 → Lv100~109 · 资质名世）', (function () {
      var g = G.fortGuardOf({ x: 33, y: 44, level: 5 });
      return g.level >= 100 && g.level <= 109 && g.rank === 'ming';
    })());

    check('§185③d 守将成型含折损（四维 < 满量 · 体力增量折半 · 名城不折）', (function () {
      var g1 = G.makeGeneral('折', 100, 'guard', null, false, 'ying', 'balance');
      G.guardFillOf(g1, DATA.GUARD_FOLD);
      var g2 = G.makeGeneral('满', 100, 'guard', null, false, 'ying', 'balance');
      G.guardFillOf(g2);
      /* 折：四维成长 ×0.5（base 84 + 99×3×1.25×0.5 ≈ 270）· 满：≈ 455 */
      var okFold = g1.yw < g2.yw && (g2.yw - g1.yw) > 150;
      var okSta = g1.stamina < g2.stamina && g1.stamina > 100;
      /* 名城（不传 fold）= 满量口径 */
      var g3 = G.npcCityGuard({ id: 'ncx185', type: 'county', level: 10, name: '测' });
      var okNpc = g3.tong > 500;   /* 天授 Lv120+ 满量：四维几百起步 */
      return okFold && okSta && okNpc;
    })(), '折四维 ' + G.guardFillOf(G.makeGeneral('x', 100, 'guard', null, false, 'ying', 'balance'), DATA.GUARD_FOLD).yw);

    check('§185③e 守将确定性含四维（同一天同坐标两次全等 · v89.185 传确定性 rand）', (function () {
      var hit = null;
      for (var i = 0; i < 40 && !hit; i++) {
        var wd = G.wildDefenseAt(60 + (i % 8), 240 + ((i / 8) | 0), 7);
        if (wd.gen) hit = { x: 60 + (i % 8), y: 240 + ((i / 8) | 0) };
      }
      if (!hit) return true;   /* 全无将（0.66^40 极低）不判红 */
      var a = G.wildDefenseAt(hit.x, hit.y, 7).gen, b = G.wildDefenseAt(hit.x, hit.y, 7).gen;
      return a.name === b.name && a.level === b.level && a.yw === b.yw && a.tong === b.tong
        && a.stamina === b.stamina;
    })());

    /* ④ 民心人口 */
    check('§185④a effPopCapOf = 基础上限 × 民心%（税率 50 → 折半）', (function () {
      var keep = G.state;
      var st = G.newGame({ name: 'v185a', cityName: '许都' });
      G.state = st;
      var c = st.cities[0];
      var base = G.maxPopOf(c);
      st.tax = 0.5; G.applyHearts();
      var half = G.effPopCapOf(c);
      st.tax = 0; G.applyHearts();
      var full = G.effPopCapOf(c);
      G.state = keep;
      return full === base && half === Math.round(base * 0.5) && half < full;
    })());

    check('§185④b 只封增长不削存量（民心掉 → 人口保留 · 不再增长）', (function () {
      var keep = G.state;
      var st = G.newGame({ name: 'v185b', cityName: '许都' });
      G.state = st;
      var c = st.cities[0];
      st.tax = 0.5; G.applyHearts();
      var eff = G.effPopCapOf(c);
      c.res.pop = eff + 100;    /* 存量高于有效上限（民心后来掉了的情形） */
      G.tickOnce();
      var kept = G.res(c).pop;
      G.state = keep;
      return kept === eff + 100;   /* 不削存量（若被削回 eff 则红） */
    })());

    check('§185④c UI 同源：人口行悬停含「民心 X% 折算」', (function () {
      G.newGame({ name: 'v185c', cityName: '许都', region: '豫州', mapSeed: 20260926 });
      var c = G.currentCity(), st = G.state;
      G.ui.renderCityAttrs(c, st);
      var h = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
      return h.indexOf('民心 ') >= 0 && h.indexOf('折算') >= 0;
    })());

    /* ⑤ 智能 weak 规则 */
    check('§185⑤ smartPickTarget weak 真调：选每兵生命最低的目标（与出口同尺）', (function () {
      var env = G.tactic.begin({ changqiang: 500 }, null, { daodun: 500, gongjian: 200, toudan: 100 }, 0, null, {});
      var u = env.units.atk[0];
      var pick = G.battle.smartPickTarget(u, env.units.def, 'weak', env.field);
      var lowest = null, lv = Infinity;
      env.units.def.forEach(function (e) { var ph = G.tactic.perHp(e, null); if (ph < lv) { lv = ph; lowest = e.id; } });
      return pick === lowest && pick === 'gongjian';
    })());

    /* ⑥ 撤退沙盘同源（手动撤退路径 · 与智能撤退同一出口 retreatBattle） */
    check('§185⑥ 撤退的沙盘重跑 verify=true（v89.185b：rc.result.retreat → 重跑对齐停止）', (function () {
      var keep = G.state, kcid = G.ui._cityId;
      var st = G.newGame({ name: 'v185r', cityName: '许都', region: '豫州', mapSeed: 20260926 });
      G.state = st;
      try {
        if (!st.map.grid) G.map.generate();
        var c = st.cities[0];
        var wt = null;
        for (var r1 = 1; r1 <= 12 && !wt; r1++) for (var dy = -r1; dy <= r1 && !wt; dy++) for (var dx = -r1; dx <= r1 && !wt; dx++) {
          var xx = c.x + dx, yy = c.y + dy, tl = G.map.tile(xx, yy);
          if (!tl || tl.terrain !== 'plain') continue;
          if (G.map.wildAt(xx, yy) || G.map.fortAt(xx, yy)) continue;
          wt = { x: xx, y: yy };
        }
        if (!wt) return true;
        var g = G.makeGeneral('撤', 3, 'idle', c.id, false, 'ying', 'balance');
        st.generals.push(g);
        st.marches = []; st.reports = []; st.battles = [];
        c.army = { yibing: 500 };
        st.res.grain = 1e6; st.res.wood = 1e6; st.res.stone = 1e6; st.res.iron = 1e6;
        st.settings.smartBattle = false;   /* 确定性：本用例专测"手动撤退"路径（智能撤退走同一出口） */
        G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'raid', { yibing: 500 }, g.id);
        var m = st.marches[0];
        if (!m) return true;
        m.elapsed = m.totalTime; G.march.tick();
        var b = st.battles[0];
        if (!b) return true;
        G.battle.stepBattle(b.id);
        G.battle.stepBattle(b.id);
        G.battle.retreatBattle(b.id);       /* 主动撤退（智能保兵闸走同一出口） */
        var rep = (st.reports || [])[0];
        if (!rep || !rep.sandbox) return false;
        var sb = G.battle.sandboxOf(rep);
        return !!rep.sandbox.result.retreat && !!sb && sb.verify === true && sb.rounds === rep.sandbox.result.rounds;
      } finally {
        G.state = keep; G.ui._cityId = kcid;
      }
    })());
  })();

"""
s = s.replace(anchor, seg + anchor, 1)
assert s != orig
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke §185 OK, len=' + str(len(s)))

# ================= e2e =================
P2 = 'e2e-test.js'
s = io.open(P2, 'r', encoding='utf-8', newline='').read()
orig = s
anchor2 = "  console.log('\\n--- 运行期错误汇总 ---');"
assert s.count(anchor2) == 1, 'e2e anchor count=' + str(s.count(anchor2))
seg2 = """  console.log('\\n--- §185. 民心人口 / 守将体系（v89.185） ---');
  {
    /* ① 人口行显示"民心 x% 折算"（真 DOM · 有效上限） */
    G.ui.closeAllModals();
    G.ui.setView('city');
    await sleep(80);
    const popTip = document.querySelector('#city-attrs .pop-line .rate-wrap');
    check('§185a 人口行悬停含「民心 X% 折算」（有效人口上限 · 真 DOM）',
      !!popTip && /民心 \\d+% 折算/.test(popTip.getAttribute('data-tip') || ''),
      popTip ? (popTip.getAttribute('data-tip') || '').replace(/\\s+/g, ' ').slice(0, 80) : '缺 .rate-wrap');

    /* ② 野地衰减文案（守地减半口径）——源码级 + 表值同查 */
    const wd = (window.GAME && window.GAME.DATA && window.GAME.DATA.WILD_DECAY) || {};
    check('§185b 衰减表（-2/日 · 驻军 -1/日）与文案同口径', wd.perDay === 2 && wd.heldPerDay === 1,
      JSON.stringify(wd));
  }

"""
s = s.replace(anchor2, seg2 + anchor2, 1)
assert s != orig
io.open(P2, 'w', encoding='utf-8', newline='').write(s)
print('e2e §185 OK, len=' + str(len(s)))
