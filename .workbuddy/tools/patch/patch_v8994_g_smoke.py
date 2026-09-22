# -*- coding: utf-8 -*-
"""v89.94 Patch G —— smoke-test.js 第 97 节：B2 战斗三件套的验收断言。
插在最终汇总行之前（幂等：命中标记即跳过）。"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()

MARK = '97. v89.94（B2 战斗三件套'
ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

BLOCK = u"""  /* ============================================================
   * 97. v89.94（B2 战斗三件套）：围攻战 / 军师估算 / 战报回放
   * ------------------------------------------------------------
   * 三件套各自的验收钉子（老板拍板的验收线写进断言，防漂移）：
   *   · E1 围攻：守备值五件套（范围/键/读写/缩放/破防）· 多波次下城 · 撤退半计
   *               · 按日恢复 · 撤退不算战败（不扣忠诚）
   *   · E2 估算：区间（误差随侦察技巧收窄）· 战法三选（围困/奇袭）的校验与真实效果
   *   · E3 回放：关键帧 ≤10 且闭环 · 战报增量 < 2KB（验收线）· 以少胜多
   * ============================================================ */
  console.log('\\n===== 97. v89.94（B2 战斗三件套：围攻 / 军师估算 / 战报回放） =====');
  (function () {
    var oldState94 = G.state;
    var S94 = G.newGame({ name: 'v94', cityName: '许都' });
    if (!S94.map.grid) G.map.generate();
    G.state = S94;
    var c94 = S94.cities[0];
    var mS94 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');
    var uS94 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
    var hS94 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    var f94 = null, g94 = null;
    /* 找一座低级据点当靶（近处优先，扫 121×121） */
    for (var ry = 0; ry < 121 && !f94; ry++) {
      for (var rx = 0; rx < 121 && !f94; rx++) {
        var fh = G.map.fortAt(c94.x - 60 + rx, c94.y - 60 + ry);
        if (fh && fh.level <= 3) f94 = fh;
      }
    }

    console.log('  --- E1 围攻：守备值核心（配置 / 五件套 / 破防 / 缩放 / 按日恢复） ---');
    check('E1：配置表齐备（试点范围 / 每日恢复 / 破防上下限 / 衰减保底）', (function () {
      var C = DATA.SIEGE || {};
      return C.scope.join(',') === 'fort,county' && C.repairPerDay > 0
        && C.chipBase > 0 && C.chipMin < C.chipBase && C.chipMax > C.chipBase
        && C.defScale > 0 && C.defScale < 1 && C.defThr > 0 && C.defThr < 1
        && C.encircle && C.encircle.marchMul > 1 && C.encircle.garrisonCut > 0
        && C.surprise && C.surprise.schemeMul > 1;
    })());
    check('E1：守备值八件出口齐备（唯一出口，不许上层摸 s.sieges）', ['siegeScopeOf', 'siegeKeyOf', 'siegeStateOf',
      'siegeHoldOf', 'siegeScaleOf', 'siegeChipOf', 'siegeChipApply', 'siegeClear', 'siegeTextOf']
      .every(function (k) { return typeof G[k] === 'function'; }));
    check('E1：试点范围 = 据点/县城（野地/郡城不在内）', (function () {
      return G.siegeScopeOf({ kind: 'fort', x: 1, y: 1 })
        && G.siegeScopeOf({ kind: 'city', cityType: 'county', npc: { id: 'cty_x' } })
        && !G.siegeScopeOf({ kind: 'wild', x: 1, y: 1 })
        && !G.siegeScopeOf({ kind: 'city', cityType: 'jun', npc: { id: 'jun_x' } });
    })());
    check('E1：破防 = 45%×战力比（保底 8 / 封顶 55 / 围困 ×1.5 = 68）', (function () {
      var ok = G.siegeChipOf(1, 'assault') === 45
        && G.siegeChipOf(0.05, 'assault') === DATA.SIEGE.chipMin
        && G.siegeChipOf(9, 'assault') === DATA.SIEGE.chipMax
        && G.siegeChipOf(1, 'encircle') === 68;
      return ok;
    })(), '1:1 → ' + G.siegeChipOf(1, 'assault') + '% · 围困 → ' + G.siegeChipOf(1, 'encircle') + '%');
    check('E1：守备 → 守军/城防缩放（100% 原样 / 0% 落保底）', (function () {
      var tF = { kind: 'fort', x: 5, y: 5 };
      var s0 = G.siegeScaleOf(tF);
      var okTop = Math.abs(s0.garrison - 1) < 1e-9 && Math.abs(s0.def - 1) < 1e-9;
      G.siegeChipApply(tF, 100);
      var s1 = G.siegeScaleOf(tF);
      var okBot = Math.abs(s1.garrison - DATA.SIEGE.defScale) < 1e-9
        && Math.abs(s1.def - DATA.SIEGE.defThr) < 1e-9 && s1.hold === 0;
      G.siegeClear(tF);
      return okTop && okBot;
    })());
    check('E1：按日恢复（+8%/整日）与"围解即清档"', (function () {
      var tF = { kind: 'fort', x: 6, y: 6 };
      var day = G.siegeDayIdx();
      S94.sieges = S94.sieges || {};
      S94.sieges[G.siegeKeyOf(tF)] = { hold: 50, waves: 1, day: day - 2 };
      var okRepair = G.siegeHoldOf(tF) === 66;                 /* 50 + 8×2 */
      S94.sieges[G.siegeKeyOf(tF)] = { hold: 95, waves: 1, day: day - 1 };
      var h2 = G.siegeHoldOf(tF);
      var okClear = h2 === 100 && !S94.sieges[G.siegeKeyOf(tF)];
      return okRepair && okClear;
    })());

    console.log('  --- E2 军师估算：区间（不给一键正解） ---');
    check('E2：误差随侦察技巧收窄（Lv0 ±55% → Lv8 + ±10% 封底）', (function () {
      var e0 = G.ui.expEstErrOf(0), e3 = G.ui.expEstErrOf(3), e8 = G.ui.expEstErrOf(8), e20 = G.ui.expEstErrOf(20);
      return Math.abs(e0 - 0.55) < 1e-9 && Math.abs(e3 - 0.34) < 1e-9
        && Math.abs(e8 - 0.10) < 1e-9 && Math.abs(e20 - 0.10) < 1e-9;
    })(), 'Lv0 ' + Math.round(G.ui.expEstErrOf(0) * 100) + '% · Lv3 ' + Math.round(G.ui.expEstErrOf(3) * 100)
      + '% · Lv8 ' + Math.round(G.ui.expEstErrOf(8) * 100) + '%');
    check('E2：expPowerOf 返回**区间**（err/lo/hi/ratioLo/ratioHi/intelLv）', (function () {
      var tW = G.battle.resolveTarget({ kind: 'wild', x: c94.x + 3, y: c94.y + 8 });
      if (!tW.ok) return false;
      var bak = G.ui._expRes;
      G.ui._expRes = tW;
      var pw = G.ui.expPowerOf();
      G.ui._expRes = bak;
      if (!pw || !(pw.def > 0)) return false;
      return pw.lo < pw.def && pw.def < pw.hi
        && Math.abs(pw.err - G.ui.expEstErrOf(pw.intelLv)) < 1e-9
        && pw.ratioLo != null && pw.ratioHi != null && pw.ratioHi > pw.ratioLo;
    })(), (function () {
      var tW = G.battle.resolveTarget({ kind: 'wild', x: c94.x + 3, y: c94.y + 8 });
      var bak = G.ui._expRes; G.ui._expRes = tW;
      var pw = G.ui.expPowerOf(); G.ui._expRes = bak;
      return pw ? ('守军 ' + pw.def + ' ±' + Math.round(pw.err * 100) + '%') : 'n/a';
    })());
    check('E2：界面文案是"军师估算"（不再写"战力估算：一键正解"）', (function () {
      return uS94.indexOf('⚔️ 军师估算') >= 0 && uS94.indexOf('情报 Lv') >= 0
        && uS94.indexOf('此战凶险：胜则可入史册') >= 0;
    })());

    console.log('  --- E2 战法三选：校验与真实效果 ---');
    check('E2：战法表齐备 + 不可用判据（奇袭须计略 / 围困须据点城池）', (function () {
      var ids = (DATA.OPS || []).map(function (o) { return o.id; }).join(',');
      var noScheme = G.opsConfigIssueOf('surprise', { kind: 'fort', x: 1, y: 1 }, null);
      var withScheme = G.opsConfigIssueOf('surprise', { kind: 'fort', x: 1, y: 1 }, 'yaoyan');
      var wildEnc = G.opsConfigIssueOf('encircle', { kind: 'wild', x: 1, y: 1 }, null);
      var fortEnc = G.opsConfigIssueOf('encircle', { kind: 'fort', x: 1, y: 1 }, null);
      return ids === 'assault,encircle,surprise' && !!noScheme && !withScheme && !!wildEnc && !fortEnc;
    })());
    check('E2：不可用战法在**出行校验**处被拦（不静默降级）', (function () {
      var r1 = G.march.dispatch({ kind: 'fort', x: f94.x, y: f94.y }, 'raid', { gongjian: 100 }, S94.generals[0].id, null, 'surprise');
      var r2 = G.march.dispatch({ kind: 'wild', x: c94.x + 4, y: c94.y + 4 }, 'raid', { gongjian: 100 }, S94.generals[0].id, null, 'encircle');
      return r1.ok === false && r2.ok === false;
    })());
    check('E2：围困行军 ×1.5（同参数对照强攻）', (function () {
      if (!f94) return false;
      var gW = G.makeGeneral('战法甲', 60, 'idle', c94.id, false);
      gW.stamina = 300; gW.energy = 100; S94.generals.push(gW);
      var tgtF = { kind: 'fort', x: f94.x, y: f94.y };
      S94.marches = [];
      c94.army = { gongjian: 9000 };
      var dA = G.march.dispatch(tgtF, 'raid', { gongjian: 1000 }, gW.id, null, 'assault');
      var tA = dA.ok ? S94.marches[0].totalTime : 0;
      S94.marches = []; c94.army = { gongjian: 9000 };
      gW.stamina = 300; gW.energy = 100; gW.status = 'idle';
      var dE = G.march.dispatch(tgtF, 'raid', { gongjian: 1000 }, gW.id, null, 'encircle');
      var tE = dE.ok ? S94.marches[0].totalTime : 0;
      var okEnc = S94.marches[0] && S94.marches[0].ops === 'encircle';
      S94.marches = []; gW.status = 'idle';
      return dA.ok && dE.ok && okEnc && tE === Math.round(tA * 1.5);
    })(), '强攻 vs 围困 = ' + '1 : 1.5');
    check('E2：围困真进战报（守军疲敝 −12% 写进注脚）', (function () {
      if (!f94 || !g94) return false;
      var n0 = S94.reports.length;
      G.battle.expedition({ kind: 'fort', x: f94.x, y: f94.y }, 'raid', { gongjian: 2000 }, g94.id, { ops: 'encircle' });
      var rep = S94.reports[0];
      return S94.reports.length === n0 + 1 && !!rep && rep.body.indexOf('围困 · 守军疲敝 −12%') >= 0;
    })());
    check('E2：奇袭把计略放大 ×1.5（妖言：15% → 残敌注脚 23%）', (function () {
      if (!f94 || !g94) return false;
      g94.stamina = 300; g94.energy = 100;
      c94.army = { gongjian: 3000 };
      G.battle.expedition({ kind: 'fort', x: f94.x, y: f94.y }, 'raid', { gongjian: 2000 }, g94.id,
        { ops: 'surprise', scheme: 'yaoyan' });
      var rep = S94.reports[0];
      return !!rep && rep.body.indexOf('守军逃散 23%') >= 0;
    })());

    console.log('  --- E1 围攻：多波次全流程（真实结算到破城） ---');
    if (f94) {
      g94 = G.makeGeneral('围攻甲', 60, 'idle', c94.id, false);
      g94.stamina = 300; g94.energy = 100; g94.tong = 500; g94.yw = 400; g94.zm = 400;
      S94.generals.push(g94);
      S94.settings.battleWatch = false;
      var wBank = S94.world.weather; S94.world.weather = 'clear';
      var wave = 0, sgLast = null;
      c94.army = { gongjian: 6000 };
      var r1 = G.battle.expedition({ kind: 'fort', x: f94.x, y: f94.y }, 'occupy', { gongjian: 6000 }, g94.id);
      sgLast = r1 && r1.result && r1.result.siege;
      check('E1：第 1 波只破防不下城（守备余 >0 / 据点仍在 / 战报有围攻段）', !!sgLast && sgLast.hold > 0
        && G.map.fortAt(f94.x, f94.y) !== null
        && S94.reports[0].body.indexOf('【围攻】') >= 0,
        sgLast ? ('破防 ' + sgLast.chip + '% → 余 ' + sgLast.hold + '%') : '无记录');
      while (G.map.fortAt(f94.x, f94.y) && wave < 8) {
        wave++;
        g94.stamina = 300; g94.energy = 100;
        c94.army = { gongjian: 6000 };
        G.battle.expedition({ kind: 'fort', x: f94.x, y: f94.y }, 'occupy', { gongjian: 6000 }, g94.id);
      }
      check('E1：多波次围攻最终破城（≤8 波）', G.map.fortAt(f94.x, f94.y) === null, '共 '
        + (wave + 1) + ' 波（含首波）');
      check('E1：下城即清围攻档（不留孤儿行）', !(S94.sieges || {})['f:' + f94.x + ',' + f94.y]);
      S94.settings.battleWatch = true;
      check('E1：观战挂起 → 逐回合 → **主动撤退**（半计破防 + 残部归城）', (function () {
        var fB = null;
        for (var ry2 = 0; ry2 < 121 && !fB; ry2++) {
          for (var rx2 = 0; rx2 < 121 && !fB; rx2++) {
            var fh2 = G.map.fortAt(c94.x - 60 + rx2, c94.y - 60 + ry2);
            if (fh2 && fh2.level >= 8) fB = fh2;         /* 找高级据点：一回合打不完 */
          }
        }
        if (!fB) return false;
        var gB = G.makeGeneral('撤退乙', 60, 'idle', c94.id, false);
        gB.stamina = 300; gB.energy = 100; S94.generals.push(gB);
        S94.marches = [];
        c94.army = { gongjian: 6000 };
        var dB = G.march.dispatch({ kind: 'fort', x: fB.x, y: fB.y }, 'occupy', { gongjian: 6000 }, gB.id);
        if (!dB.ok || (S94.battles || []).length !== 1) return false;
        var mB = S94.marches[0];
        mB.elapsed = mB.totalTime;
        G.march.tick();
        var recB = S94.battles[0];
        var stB = recB ? G.battle.stepBattle(recB.id) : null;
        var loyBefore = gB.loyalty == null ? 70 : gB.loyalty;
        var liveB = !!(recB && G.battle._recOf(recB.id));
        var rRet = liveB ? G.battle.retreatBattle(recB.id) : null;
        var sgRet = rRet && rRet.result && rRet.result.siege;
        var armyBack = (c94.army.gongjian || 0) >= 5000;
        var noBattle = (S94.battles || []).length === 0;
        var loyKept = (gB.loyalty == null ? 70 : gB.loyalty) === loyBefore;
        S94.settings.battleWatch = false;
        window.__r94ret = { stepped: !!stB, chip: sgRet ? sgRet.chip : null,
          retreat: !!(rRet && rRet.result && rRet.result.retreat), armyBack: armyBack,
          noBattle: noBattle, loyKept: loyKept, hold: sgRet ? sgRet.hold : null };
        return !!stB && stB.r === 1 && liveB && !!sgRet && sgRet.chip >= 1
          && sgRet.chip < DATA.SIEGE.chipBase && armyBack && noBattle && loyKept;
      })(), (function () {
        var r = window.__r94ret || {};
        return '撤退破防 ' + r.chip + '%（半计）· 残部归城 ' + (r.armyBack ? '✓' : '✗')
          + ' · 忠诚未扣 ' + (r.loyKept ? '✓' : '✗');
      })());
      S94.world.weather = wBank;
    } else {
      check('E1：多波次围攻最终破城（≤8 波）', false, '未找到据点靶子');
    }

    console.log('  --- E3 战报回放：关键帧 / 增量 / 以少胜多 ---');
    check('E3：分回合回放已入档（帧 ≤10 · 末帧标记 final · 带条带）', (function () {
      var rep = (S94.reports || []).filter(function (r) { return r.replay; })[0];
      if (!rep) return false;
      var rp = rep.replay, kt = (rp.key || []).map(function (k) { return k.tag; });
      return rp.frames.length >= 2 && rp.frames.length <= (DATA.REPLAY.maxFrames || 10)
        && kt[kt.length - 1] === 'final' && !!rp.frames[0].s && typeof rp.frames[0].ev === 'string';
    })());
    check('E3：战报增量 < 2KB/场（验收线，逐个取最坏）', (function () {
      var worst = 0, n = 0;
      (S94.reports || []).slice(0, 6).forEach(function (r) {
        if (!r.replay) return;
        var r2 = {};
        for (var k in r) if (k !== 'replay') r2[k] = r[k];
        var d = JSON.stringify(r).length - JSON.stringify(r2).length;
        if (d > worst) worst = d;
        n++;
      });
      window.__r94size = { worst: worst, n: n };
      return n > 0 && worst > 0 && worst < 2048;
    })(), (function () {
      var z = window.__r94size || {};
      return '最坏 ' + z.worst + ' B（' + z.n + ' 场取样）';
    })());
    check('E3：以少胜多判定（弱胜强 ✓ / 强胜弱 ✗ / 败不算 ✗）', (function () {
      var w1 = { winner: 'atk', atkStartBy: { changqiang: 50 }, defStartBy: { changqiang: 100 }, defBonusEff: 0 };
      var w2 = { winner: 'atk', atkStartBy: { changqiang: 100 }, defStartBy: { changqiang: 100 }, defBonusEff: 0 };
      var w3 = { winner: 'def', atkStartBy: { changqiang: 10 }, defStartBy: { changqiang: 100 }, defBonusEff: 0 };
      return G.battle.underdogOf(w1) === true && G.battle.underdogOf(w2) === false && G.battle.underdogOf(w3) === false;
    })());
    check('E3：战报详情接回放 + 列表带 🏅 徽记（界面接线）', (function () {
      return /ui\.replaySectionHTML = function/.test(uS94)
        && /data-action="rep-play"/.test(uS94) && /ui\.replayJump = function/.test(uS94)
        && /r\.underdog \? '🏅 ' : ''/.test(uS94) && /id="rep-fbox"/.test(uS94);
    })());
    check('E3/E1：界面与动作齐备（回放控制 / 战法块 / 撤退键 + CSS）', (function () {
      var uiOk = typeof G.ui.replaySectionHTML === 'function' && typeof G.ui.replaySet === 'function'
        && typeof G.ui.replayToggle === 'function' && typeof G.ui.replayJump === 'function'
        && typeof G.ui.expOpsBlockHTML === 'function' && typeof G.ui.setExpOps === 'function'
        && /id="exp-ops"/.test(G.ui.expOpsBlockHTML());
      var one = G.ui.replaySectionHTML({ rounds: 3, key: [], retreat: false,
        frames: [{ r: 1, a: 10, d: 10, gap: 0, s: '▓····▓', ev: '' }] });
      var wOk = ['bt-retreat', 'exp-ops', 'rep-prev', 'rep-next', 'rep-play', 'rep-jump']
        .every(function (a) { return mS94.indexOf("case '" + a + "'") >= 0; });
      var cOk = hS94.indexOf('.rp-ctl') >= 0 && hS94.indexOf('.rp-ev') >= 0 && hS94.indexOf('.exp-ops-row') >= 0;
      return uiOk && /data-action="rep-play"/.test(one) && /data-action="rep-jump"/.test(one) && wOk && cOk;
    })());
    check('E1：围攻状态写进出征面板（守备/波次/每日恢复）', (function () {
      var tW = { kind: 'fort', x: 7, y: 7 };
      G.siegeChipApply(tW, 30);
      var txt = G.siegeTextOf(tW);
      G.siegeClear(tW);
      return txt.indexOf('守备 70%') >= 0 && txt.indexOf('已围攻 1 波') >= 0 && txt.indexOf('恢复') >= 0;
    })());

    G.state = oldState94;
  })();

"""

if MARK in s:
    print('SKIP: 97 节已存在')
elif ANCHOR in s:
    s = s.replace(ANCHOR, BLOCK + ANCHOR, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED smoke-test.js 97 节  (+%d bytes)' % len(BLOCK.encode('utf-8')))
else:
    raise SystemExit('ANCHOR MISSING (summary line)')
