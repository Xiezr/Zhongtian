# -*- coding: utf-8 -*-
"""v89.87：smoke §87 固化断言（四需求）—— 插在结果输出前"""
import io

P = r'E:\Deepseekdb\smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
assert s.count(anchor) == 1, ('anchor', s.count(anchor))

SEC = """  /* ============================================================
   * 87. v89.87（老板需求四条）：快购 / 派兵统一行军 / 战斗规则 / 观战
   * ------------------------------------------------------------
   * 独立建局（结尾恢复旧 state）；观战实测会开界面 → 结尾 closeModal 清 timer。
   * ============================================================ */
  console.log('\\n--- 87. v89.87 老板需求四条 ---');
  (function () {
    var oldState = G.state;
    var S87 = G.newGame({ name: 'v87', cityName: '许都' });
    if (!S87.map.grid) G.map.generate();
    G.state = S87;
    var c87 = S87.cities[0];
    var uS87 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mS87 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');

    /* ---- 需求 1：快购 ---- */
    check('v89.87（快购）：组件 + 六接入点 + 四动作齐备', (function () {
      var io87 = /ui\\.openQuickBuy = function/.test(uS87) && /ui\\.openQuickCat = function/.test(uS87)
        && /ui\\.qbArt = function/.test(uS87);
      var points = (uS87.match(/data-action="qb-item"/g) || []).length >= 2
        && (uS87.match(/data-action="qb-cat"/g) || []).length >= 3;
      var acts = /case 'qb-item'/.test(mS87) && /case 'qb-buy'/.test(mS87)
        && /case 'qb-cat'/.test(mS87) && /case 'qb-cat-buy'/.test(mS87);
      return io87 && points && acts;
    })());
    check('v89.87（快购）：弹窗渲染（锦囊）+ 种子开售（页签）', (function () {
      S87.res.gold = 999999;
      G.ui.openQuickBuy('jinang', 2);
      var qh = global.document.querySelector('#modal-root').innerHTML;
      var uiOk = qh.indexOf('快购') >= 0 && qh.indexOf('锦囊') >= 0 && qh.indexOf('qb-qty') >= 0;
      G.ui.closeModal();
      var seedOk = G.ui.shopItems().some(function (it) { return it.type === 'seed'; })
        && !!G.ui.SHOP_CATS.seed;
      return uiOk && seedOk;
    })());

    /* ---- 需求 2：派兵统一走行军 ---- */
    check('v89.87（派兵）：调兵走行军（出发留途 · 抵达入城 · 将随军）', (function () {
      var c2 = G.makeCity({ id: 'c87b', name: '副城', x: c87.x + 3, y: c87.y + 3 });
      S87.cities.push(c2);
      var gen87 = S87.generals[0];
      gen87.status = 'idle'; gen87.cityId = c87.id;
      c87.army = { yibing: 500 };
      S87.marches = [];
      var tt = G.doTransferTroops(c87.id, c2.id, { yibing: 300 }, gen87.id);
      var stage1 = tt.ok && S87.marches.length === 1 && c87.army.yibing === 200
        && (c2.army.yibing || 0) === 0;                      /* 在途 → 未入城 */
      var m87 = S87.marches[0];
      if (m87) { m87.elapsed = m87.totalTime; G.march.tick(); }
      var stage2 = (c2.army.yibing || 0) === 300 && gen87.cityId === c2.id
        && gen87.status === 'idle';                          /* 抵达 → 入城 + 将随军 */
      return stage1 && stage2;
    })());
    check('v89.87（派兵）：采集走行军（出发留途 · 抵达成队）', (function () {
      var w87 = null;
      for (var dy = 7; dy <= 11 && !w87; dy++) for (var dx = 7; dx <= 11 && !w87; dx++) {
        var tl = G.map.tile(c87.x + dx, c87.y + dy);
        if (tl && tl.terrain !== 'city' && !G.map.wildAt(c87.x + dx, c87.y + dy)) {
          w87 = { x: c87.x + dx, y: c87.y + dy, t: tl.terrain };
        }
      }
      if (!w87) return false;
      S87.wilds = S87.wilds || [];
      S87.wilds.push({ x: w87.x, y: w87.y, type: w87.t, level: 3, day: 0, startDay: 0 });
      var gen87 = S87.generals[0];
      gen87.status = 'idle';
      S87.marches = [];
      var dg = G.dispatchGather(w87.x, w87.y, gen87.id, { yibing: 100 });
      var stage1 = dg.ok && S87.marches.length === 1 && !G.gatherAt(w87.x, w87.y);
      var gm = S87.marches[0];
      if (gm) { gm.elapsed = gm.totalTime; G.march.tick(); }
      var stage2 = !!G.gatherAt(w87.x, w87.y) && gen87.status === 'gather';
      return stage1 && stage2;
    })());

    /* ---- 需求 3：战斗规则 ---- */
    check('v89.87（战斗）：主目标吃满 + 溢出 30% 溅射（含翻转判据）', (function () {
      if (G.tactic.SPLASH_PCT !== 0.30) return false;
      var env1 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x' });
      var r1 = env1.step();
      var ev1 = (r1.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
      var okSplash = !!ev1 && ev1.hits.length >= 2 && !ev1.hits[0].splash
        && ev1.hits[1].splash === true;
      var old = G.tactic.SPLASH_PCT;
      G.tactic.SPLASH_PCT = 0;
      var env0 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x' });
      var r0 = env0.step();
      G.tactic.SPLASH_PCT = old;
      var ev0 = (r0.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
      var flip = !ev0 || (ev0.hits || []).slice(1).length === 0;      /* 关溅射 → 无后续条 */
      return okSplash && flip;
    })());
    check('v89.87（战斗）：反击不限次（20v20 拉锯实测 ≥ 2 次）', (function () {
      var env2 = G.tactic.begin({ yibing: 20 }, null, { yibing: 20 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x' });
      env2.runAll();
      var all = env2.finish();
      var ctr = 0;
      (all.roundsLog || []).forEach(function (rr) {
        (rr.events || []).forEach(function (e) { if (e.kind === 'counter' && e.side === 'atk') ctr++; });
      });
      return ctr >= 2;
    })());

    /* ---- 需求 4：观战 ---- */
    check('v89.87（观战）：引擎会话 API + 界面组件齐备', (function () {
      var api = ['_needWatch', '_makeEnv', '_suspendExpedition', 'stepBattle', 'autoBattle',
        'finishBattle', 'tick', 'restoreBattles', 'pendingCount']
        .every(function (k) { return typeof G.battle[k] === 'function'; });
      var uiOk = /ui\\.openBattlefield = function/.test(uS87) && /ui\\.onBattleDone = function/.test(uS87)
        && /ui\\.btPendingBlock = function/.test(uS87) && /data-action="bt-done"/.test(uS87)
        && /data-action="bt-auto"/.test(uS87);
      var mOk = /case 'bt-done'/.test(mS87) && /case 'bt-auto'/.test(mS87) && /case 'bt-open'/.test(mS87);
      return api && uiOk && mOk;
    })());
    check('v89.87（观战）：挂起 → 步进 → 自动结算（军账闭合）', (function () {
      var wt = null;
      for (var dy = 13; dy <= 16 && !wt; dy++) for (var dx = 13; dx <= 16 && !wt; dx++) {
        var tl = G.map.tile(c87.x + dx, c87.y + dy);
        if (tl && tl.terrain !== 'city' && !G.map.wildAt(c87.x + dx, c87.y + dy)) {
          wt = { x: c87.x + dx, y: c87.y + dy, t: tl.terrain };
        }
      }
      if (!wt) return false;
      var gen87 = S87.generals[0];
      gen87.status = 'idle'; gen87.cityId = c87.id;
      S87.settings.battleWatch = true;
      c87.army = { changqiang: 600 };
      S87.marches = [];
      var d = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'raid', { changqiang: 300 }, gen87.id);
      if (!d.ok) { S87.settings.battleWatch = false; return false; }
      var m = S87.marches[0];
      m.elapsed = m.totalTime;
      G.march.tick();
      var pending = S87.battles.length === 1 && S87.battles[0].state === 'live';
      var rec = S87.battles[0];
      var sr = rec ? G.battle.stepBattle(rec.id) : null;
      var stepped = !!sr && sr.r === 1 && (sr.events || []).length >= 0;
      if (rec && G.battle._recOf(rec.id)) G.battle.autoBattle(rec.id);
      var closed = S87.battles.length === 0;
      S87.settings.battleWatch = false;
      G.ui.closeModal();      /* 清观战界面 timer */
      return pending && stepped && closed;
    })());

    G.ui.closeModal();
    G.state = oldState;
  })();

""" + anchor

s = s.replace(anchor, SEC, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK smoke §87 段（%d 条 check）' % SEC.count("check('"))
