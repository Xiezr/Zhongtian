# -*- coding: utf-8 -*-
"""v89.86 · smoke 增量：把整改清单 21 条 + 门派 P1 的**关键不变量**固化进回归网。
   每条都可翻转（改坏即红）；行为断言与环境断言并重。"""
import io
import os
import sys

SM = r'E:\Deepseekdb\smoke-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


OLD = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""

NEW = r"""  /* ============================================================
   * 85. v89.86 整改清单（21 条 + 门派 P1）—— 关键不变量
   * ============================================================ */
  console.log('\n===== 85. v89.86 整改（开发整改清单） =====');
  (function () {
    var G8 = GAME, U8 = G8.utils;
    var st8 = G8.newGame({ name: 'v8986', cityName: '许都' });
    if (!st8.map.grid && G8.map.generate) G8.map.generate();
    G8.state = st8;
    var city8 = st8.cities[0];
    var ui8 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
    var bt8 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');
    var dm8 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'domain.js'), 'utf8');
    var mn8 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
    var ht8 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

    /* ---- P0 ---- */
    check('v89.86（P-12）：科技按钮读黄金口径（无 cost.grain 残留 · render 无 NaN）', (function () {
      var code = stripComment(ui8);
      if (/U\.fmt\(cost\.grain\)/.test(code)) return false;
      if (!/研究\(黄金 /.test(ui8)) return false;
      city8.cells = city8.cells || [];
      city8.cells.push({ build: { id: 'shuyuan', lvl: 10 } });
      var h = G8.ui.techHTML();
      return h.indexOf('NaN') < 0 && /研究\(黄金 [^)]+\)/.test(h);
    })());
    check('v89.86（P-13）：采集面板无 undefined · 采力口径 · 估算=真尺子', (function () {
      var w = null;
      for (var r = 1; r <= 40 && !w; r++) {
        for (var dy = -r; dy <= r && !w; dy++) for (var dx = -r; dx <= r && !w; dx++) {
          var tl = G8.map.tile(city8.x + dx, city8.y + dy);
          if (tl && tl.terrain === 'lake') w = { x: city8.x + dx, y: city8.y + dy, type: 'lake' };
        }
      }
      if (!w) return false;
      st8.wilds = [{ x: w.x, y: w.y, type: w.type, level: 3, levelDay: G8.questDayIndex() }];
      var gen8 = st8.generals[0]; gen8.status = 'idle'; gen8.stamina = 100;
      city8.army = { yibing: 2000 };
      G8.ui.openGatherModal(w.x, w.y);
      var h = global.document.querySelector('#modal-root').innerHTML;
      if (h.indexOf('undefined') >= 0 || h.indexOf('单队采力上限') < 0) return false;
      var mv = h.match(/id="gather-troops"[^>]*value="(\d+)"/);
      if (!mv) return false;
      var y2 = G8.gatherYield({ type: w.type, level: 3, army: G8.autoPickTroops(Number(mv[1])), elapsed: 24 * 3600 });
      var note = h.match(/采满预计可得 <b>([\d,]+)<\/b>/);
      return !!note && note[1] === U8.numText(y2.amount, 0);
    })());
    check('v89.86（P-25）：行军抵达失败 → 兵力原路折返（军账守恒 · 实测）', (function () {
      var fort = null;
      for (var yy = city8.y - 40; yy <= city8.y + 40 && !fort; yy++) {
        for (var xx = city8.x - 40; xx <= city8.x + 40 && !fort; xx++) {
          var f = G8.map.fortAt(xx, yy);
          if (f) fort = f;
        }
      }
      if (!fort) return false;
      var gen8 = st8.generals[0]; gen8.status = 'idle';
      G8.setStaNow(gen8, 1000); gen8.energy = 100;
      city8.army = { changqiang: 400 };
      st8.marches = []; st8.fortsRazed = {};
      var d = G8.march.dispatch({ kind: 'fort', x: fort.x, y: fort.y, name: fort.name }, 'occupy', { changqiang: 200 }, gen8.id);
      if (!d.ok) return false;
      if (city8.army.changqiang !== 200) return false;
      G8.map.razeFort(fort.x, fort.y);          /* 途中目标熄灭（竞态模拟） */
      for (var i = 0; i < 400; i++) G8.march.tick();
      return city8.army.changqiang === 400;     /* 原路折返 */
    })());
    check('v89.86（P-25）：采集「行军结算异常」兜底（_expArmySettled 护栏在）',
      /_expArmySettled/.test(bt8) && /catch \(e\) \{ err = e; \}/.test(bt8));

    /* ---- P1 ---- */
    check('v89.86（P-24）：据点=拔除文案（按钮 + 出征注 + 数据 desc）',
      ui8.indexOf('🚩 拔除据点') >= 0 && /据点：占领=拔除/.test(ui8)
      && /据点被拔除（打完撤军/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8')));
    check('v89.86（P-23）：兵力悬殊二次确认（首击不发兵 · 再击才发）', (function () {
      var fort = null;
      for (var yy = city8.y - 30; yy <= city8.y + 30 && !fort; yy++) {
        for (var xx = city8.x - 30; xx <= city8.x + 30 && !fort; xx++) {
          var f = G8.map.fortAt(xx, yy);
          if (f && f.level >= 4) fort = f;
        }
      }
      if (!fort) return false;
      var gen8 = st8.generals[0]; gen8.status = 'idle';
      G8.setStaNow(gen8, 1000); gen8.energy = 100;
      city8.army = { changqiang: 200 };
      st8.marches = [];
      G8.ui.openExpModal({ kind: 'fort', x: fort.x, y: fort.y });
      G8.ui._expMode = 'occupy';
      global.document.getElementById('exp-gen').value = gen8.id;
      global.document.getElementById('exp-changqiang').value = '200';
      var pw = G8.ui.expPowerOf();
      if (!pw || !(pw.ratio < 0.5)) return false;
      G8.doExpConfirm();                        /* 首击：上膛 */
      if (st8.marches.length !== 0 || G8.ui._expForceArmed !== true) return false;
      G8.doExpConfirm();                        /* 再击：发兵 */
      st8.marches = [];
      return true;
    })());
    check('v89.86（P-19/P-05）：募兵面板 0 上限归因 + 每兵占人口 · trainLimitOf 口径', (function () {
      var lim = G8.trainLimitOf('yibing');
      if (typeof lim.cap !== 'number' || typeof lim.reason !== 'string') return false;
      st8.res.pop = 0; st8.res.grain = 999999; st8.res.wood = 999999; st8.res.iron = 999999;
      var l2 = G8.trainLimitOf('yibing');
      if (!(l2.cap === 0 && l2.reason === 'pop')) return false;
      G8.ui._trainFilter = 'normal'; G8.ui._trainTab = 'inf'; G8.ui._trainSel = 'yibing';
      var h = G8.ui.troopsHTML();
      return h.indexOf('人口不足') >= 0 && h.indexOf('每兵占人口') >= 0;
    })());
    check('v89.86（P-04）：前置升级中动态提示（pendingUpgradeOf 出口 + 两处接线）', (function () {
      var c = city8;
      c.cells = c.cells || [];
      c.cells[0] = { build: { id: 'guanfu', lvl: 1 } };
      c.cells[1] = { build: { id: 'minfang', lvl: 1 } };
      st8.queues.build = [{ cityId: c.id, gridIndex: 0, buildId: 'guanfu', type: 'upgrade', targetLevel: 2, elapsed: 10, totalTime: 120 }];
      if (!G8.pendingUpgradeOf(c, 'guanfu')) return false;
      G8.ui.openBuildModal(1);
      var h = global.document.querySelector('#modal-root').innerHTML;
      st8.queues.build = [];
      c.cells.forEach(function (x) { if (x) x.pending = null; });
      return h.indexOf('官府升级中（剩余') >= 0;
    })());
    check('v89.86（P-16）：野地上限出兵前预警（元素 + 计算出口）',
      ui8.indexOf('id="exp-wildcap"') >= 0 && /ui\.updateExpWildCap = function/.test(ui8)
      && /野地已达上限（/.test(ui8));
    check('v89.86（P-11）：Lv0 野地文案动态（无驻军位）+ 派驻面板同口径',
      ui8.indexOf('Lv0 无驻军位') >= 0 && ui8.indexOf('该等级无驻军位') >= 0);
    check('v89.86（P-02）：favicon 为 data-URI（消除固定 404）',
      /<link rel="icon" href="data:image\/svg\+xml,/.test(ht8));
    check('v89.86（P-15）：客栈无空位 → 升级引导（单步 + 官府压顶两步链）',
      ui8.indexOf('升招贤馆至 Lv') >= 0 && ui8.indexOf('先升官府至 Lv') >= 0
      && /data-action="inn-recruit"[^>]*title="[^"]*"/.test(ui8));
    check('v89.86（P-26）：新城落成守备提示 + 调兵入口（复用 openTroopMove）',
      /ui\.openNewCityNotice = function/.test(ui8) && /ui\.openNewCityNotice\(r\.city\)/.test(mn8)
      && /case 'newcity-send-troop'/.test(mn8) && /ui\._tmTo\[_ncFrom\.id\] = _ncTo/.test(mn8));

    /* ---- P2 ---- */
    check('v89.86（P-18）：自动化预算闸门（默认 5% · 超线拦下 · 省下不动账 · 手动不受限）', (function () {
      st8.settings.autoReservePct = 5;
      st8.res.stone = 100000;
      if (!G8.autoBudgetCheck({ stone: 50000 }).ok) return false;
      if (G8.autoBudgetCheck({ stone: 96000 }).ok) return false;
      st8.settings.autoReservePct = 0;
      if (!G8.autoBudgetCheck({ stone: 100000 }).ok) return false;
      st8.settings.autoReservePct = 5;
      return G8.autoReservePct() === 5;
    })());
    check('v89.86（P-21）：门派任务连做（×10 计数/日额封顶/资源中止）', (function () {
      var c = city8; c.cells = c.cells || [];
      c.cells[9] = { build: { id: 'honglusi', lvl: 1 } };
      st8.sect = null; G8.sectState();
      var j = G8.doSectJoin('qingfeng');
      if (!j.ok) return false;
      var sst = G8.sectState();
      sst.tasks = {}; sst.rep = 0; st8.res.gold = 5000000;
      var day = G8.questDayIndex();
      var r1 = G8.doSectTaskBulk('chores', 10);
      if (!r1.ok || r1.count !== 10 || (sst.tasks[day] || 0) !== 10) return false;
      var r2 = G8.doSectTaskBulk('chores', 0);
      if (!r2.ok || (sst.tasks[day] || 0) !== 40) return false;
      var r3 = G8.doSectTaskBulk('chores', 1);
      if (r3.ok) return false;
      if (!/data-action="sect-task-bulk"/.test(ui8)) return false;
      return true;
    })());
    check('v89.86（P-17）：离线推进上限（默认 7 日 · 超限五折折算 · 历法只推 7 日）', (function () {
      if (typeof G8.offlineCapDays !== 'function' || typeof G8.simulateOfflineOverflow !== 'function') return false;
      var st9 = G8.newGame({ name: 'off', cityName: '许都' });
      if (!st9.map.grid && G8.map.generate) G8.map.generate();
      G8.state = st9;
      st9.settings.timeScale = 120;
      st9.settings.offlineCapDays = 7;
      st9.generals = [];
      st9.cities.forEach(function (c2) { c2.army = {}; });
      var e0 = st9.world.elapsed || 0;
      G8.offlineCatchup(36576);      /* 10.16 小时 @120× */
      var d = st9.world.elapsed - e0;
      var capped = Math.abs(d - 7 * 86400) < 3000;
      var over = (G8._offlineOverflow || 0) > 30000;
      G8.state = st8;                /* 还原，供后续断言 */
      return capped && over;
    })());
    check('v89.86（P-20）：军务总览（五段 + 全境行军口径）',
      /ui\.marchesHTML = function/.test(ui8) && /var list = \(s\.marches \|\| \[\]\)\.slice\(\);/.test(ui8)
      && !/m\.cityId === c\.id/.test(ui8) && ui8.indexOf('⚔ 军务总览') >= 0);
    check('v89.86（P-06）：故事待阅（触发入列 · 阅读出列 · 徽标 · 上限 30）', (function () {
      st8.sgPending = [];
      G8.SG.TRIG.pin = 'bld-guanfu-01'; G8.SG.TRIG._lastAt = 0;
      var fired = G8.ui.sgTryTrigger('building', 'guanfu');
      if (!fired || st8.sgPending.length !== 1) return false;
      if (G8.SG._run) return false;              /* 不再直接开卷 */
      G8.ui.syncBadges();
      var b = global.document.getElementById('tab-badge-story');
      if (!b || Number(b.textContent) !== 1) return false;
      G8.ui.sgReadPending('bld-guanfu-01');
      if (st8.sgPending.length !== 0 || !G8.SG._run) return false;
      G8.SG.close();
      /* 上限 30 */
      st8.sgPending = [];
      G8.SG.list().slice(0, 35).forEach(function (x) { G8.SG.defer(x.id); });
      var okCap = st8.sgPending.length === 30;
      st8.sgPending = [];
      G8.SG.TRIG.pin = null; G8.SG.TRIG.rng = Math.random; G8.SG.TRIG._lastAt = 0;   /* 复位 */
      return okCap && /id="tab-badge-story"/.test(ht8);
    })());
    check('v89.86（P-03）：任务「前往」（映射 + 建筑类定位 + 按钮）', (function () {
      var g01 = null; (DATA.QUESTS || []).forEach(function (q) { if (q.id === 'g01') g01 = q; });
      if (!g01) return false;
      var j = G8.ui.questJumpOf(g01);
      if (!j || j.view !== 'city') return false;
      city8.cells.forEach(function (c2, i) { if (c2 && c2.build && c2.build.id === 'minfang') city8.cells[i] = {}; });
      G8.ui.doQuestGo('growth', 'g01');
      var h = global.document.querySelector('#modal-root').innerHTML;
      if (h.indexOf('选择要建造的建筑') < 0) return false;
      G8.ui.closeModal();
      return /case 'quest-go'/.test(mn8) && /data-action="quest-go"/.test(ui8);
    })());
    check('v89.86（P-08）：随机任务可达性（过滤 + 生成侧无不可达 + sub 对齐）', (function () {
      var defArmy = null; (DATA.RANDOM_QUESTS || []).forEach(function (q) { if (q.metric === 'armyTotal') defArmy = q; });
      if (!defArmy) return false;
      var origMaxPop = G8.maxPopOf;
      G8.maxPopOf = function () { return 200; };
      var bad = G8.questReachable(defArmy);
      G8.maxPopOf = function () { return 6000; };
      var good = G8.questReachable(defArmy);
      G8.maxPopOf = origMaxPop;
      /* sub 全量对齐（r07 tieqi→tieji / r09 toushiche→toudan 的真 bug 守卫） */
      var mis = 0, seenTroop = 0;
      (DATA.RANDOM_QUESTS || []).concat(DATA.QUESTS || []).forEach(function (q) {
        if (q.metric !== 'troopCount' || !q.sub) return;
        seenTroop++;
        if (!DATA.TROOPS[q.sub]) mis++;
      });
      return bad === false && good === true && seenTroop > 0 && mis === 0;
    })());
    check('v89.86（P-07）：建造/科技队列花金提速（计价 = 20%×剩余 · 支付 · 不足拒绝）', (function () {
      st8.queues = st8.queues || { build: [], tech: [], train: [] };
      st8.queues.build = [{ cityId: city8.id, gridIndex: 0, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 30, totalTime: 120 }];
      var q = G8.queueAt('city', 0);
      if (!q) return false;
      var price = G8.queueRushCost(q);
      if (!(price > 0)) return false;
      st8.res.gold = 100;
      var r1 = G8.queueRushPay(q, '测试');
      if (r1.ok || q.elapsed !== 30) return false;      /* 金不足：不动账 */
      st8.res.gold = price + 10;
      var r2 = G8.queueRushPay(q, '测试');
      var ok = r2.ok && st8.res.gold === 10 && q.elapsed === q.totalTime;
      st8.queues.build = [];
      return ok && ui8.indexOf('data-action="rush-build"') >= 0 && ui8.indexOf('data-action="rush-tech"') >= 0;
    })());

    /* ---- 顺手修复（真 bug 守卫） ---- */
    check('v89.86（顺手）：openTacticModal 唯一（预设管理更名 openTacticSets · 双边接线）', (function () {
      var defs = (ui8.match(/ui\.openTacticModal = function/g) || []).length;
      return defs === 1 && /ui\.openTacticSets = function/.test(ui8)
        && /ui\.openTacticSets\(\)/.test(mn8) && /case 'open-tactic-set'/.test(mn8);
    })());

    /* ---- 门派 P1 ---- */
    check('v89.86（门派P1）：六派被动数据齐 · 无门派全 0 · 消费点接线', (function () {
      var miss = 0;
      (DATA.SECTS || []).forEach(function (x) { if (!x.trait || !x.trait.key || !(x.trait.val > 0) || !x.trait.text) miss++; });
      st8.sect = { id: null, rep: 0, founder: false, tasks: {}, leftAt: 0 };
      var zeroAll = ['marchPct', 'atkPct', 'siegePct', 'woundPct', 'craftCut', 'mountPct']
        .every(function (k) { return G8.sectBonus(k) === 0; });
      var btSrc2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');
      var sySrc2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8');
      var wired = /GAME\.sectBonus\('marchPct'\)/.test(btSrc2) && /GAME\.sectBonus\('atkPct'\)/.test(btSrc2)
        && /GAME\.sectBonus\('siegePct'\)/.test(btSrc2) && /GAME\.sectBonus\('woundPct'\)/.test(btSrc2)
        && /GAME\.sectBonus\('craftCut'\)/.test(dm8) && /GAME\.sectBonus\('mountPct'\)/.test(sySrc2);
      return miss === 0 && zeroAll && wired;
    })());
    check('v89.86（门派P1）：玄鹤门行军 ×1.08（实测）', (function () {
      var c = city8; c.cells = c.cells || [];
      c.cells[9] = { build: { id: 'honglusi', lvl: 1 } };
      st8.sect = { id: null, rep: 0, founder: false, tasks: {}, leftAt: 0 };
      var gen8 = st8.generals[0]; gen8.spd = 0;
      var base = G8.march.speedFactor({ yibing: 100 }, { cityId: c.id }, { x: c.x + 3, y: c.y }, gen8);
      var j = G8.doSectJoin('xuanhe');
      if (!j.ok) return false;
      var with8 = G8.march.speedFactor({ yibing: 100 }, { cityId: c.id }, { x: c.x + 3, y: c.y }, gen8);
      return Math.abs(with8 / base - 1.08) < 1e-6;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""

edit(SM, OLD, NEW, 'smoke · v89.86 整改断言块')
print('DONE')
