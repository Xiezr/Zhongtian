  console.log('\n===== 98. v89.118 四条需求 + 沙盘保真度（战斗加成快照） =====');
  (function () {
    var G = GAME, D98 = G.DATA;
    var _fs98 = require('fs'), _p98 = require('path');
    var b98 = _fs98.readFileSync(_p98.join(__dirname, 'js/battle.js'), 'utf8');
    var u98 = _fs98.readFileSync(_p98.join(__dirname, 'js/ui.js'), 'utf8');
    var s98 = _fs98.readFileSync(_p98.join(__dirname, 'js/state.js'), 'utf8');
    var m98 = _fs98.readFileSync(_p98.join(__dirname, 'js/main.js'), 'utf8');
    var bak98 = G.state;

    /* ---------- 需求 1：俘虏营 ---------- */
    check('① 俘虏人口唯一出口：captivePopOf = Σ(兵种数量 × 该兵种 pop)', (function () {
      var camp = { yibing: 10, gongjian: 5, nanjiangxiangbing: 2, unknown: 3 };
      var want = 10 * (D98.TROOPS.yibing.pop || 1) + 5 * (D98.TROOPS.gongjian.pop || 1)
        + 2 * (D98.TROOPS.nanjiangxiangbing.pop || 1) + 3 * 1;
      return G.captivePopOf(camp) === want && G.captivePopOf({}) === 0 && want > 17;
    })(), 'want=' + (function () {
      var c = { yibing: 10, gongjian: 5, nanjiangxiangbing: 2, unknown: 3 };
      return G.captivePopOf(c);
    })());

    check('① 收编那一刻才加人口：增量与 captivePopOf 同源（执行 + 按钮文案两处）', (function () {
      var st = G.newGame({ name: '俘', cityName: '许都' });
      G.state = st;
      try {
        st.captives = { gongjian: 6, changqiang: 3 };     /* pop 2 与 1 → 6×2+3 = 15 */
        var want = G.captivePopOf();
        var c0 = G.currentCity();
        var pop0 = G.res(c0).pop;
        var h0 = G.ui.campCard('captive');
        var r = G.doConscriptCaptives(c0.id);
        return want === 15 && r.ok && r.pop === 15
          && Math.round(G.res(c0).pop - pop0) === 15
          && h0.indexOf('人口 +' + U.numText(15, 0)) >= 0
          && G.captivesTotalOf() === 0;
      } finally { G.state = bak98; }
    })());

    check('① 俘虏营明细**纯文字**（无兵种图标）；伤兵营仍带图标（本轮只点名俘虏营）', (function () {
      var st = G.newGame({ name: '俘', cityName: '许都' });
      G.state = st;
      try {
        st.captives = { yibing: 40, changqiang: 12 };
        st.wounded = 10; st.woundedArmy = { yibing: 10 };
        var hC = G.ui.campCard('captive');
        var hW = G.ui.campCard('wounded');
        return hC.indexOf('营中不限量') >= 0
          && hC.indexOf('<img') < 0 && hC.indexOf('义兵') >= 0
          && hW.indexOf('<img') >= 0;
      } finally { G.state = bak98; }
    })());

    /* ---------- 需求 2：象兵不设克制 ---------- */
    check('② 象兵不进克制表（正常攻防）；同人口对长枪「赢但可打」（损 10%~60%）', (function () {
      var A = D98.COUNTER_ATK.changqiang || {}, Df = D98.COUNTER_DEF.changqiang || {};
      if (A.nanjiangxiangbing !== undefined || Df.nanjiangxiangbing !== undefined) return false;
      var r = G.tactic.simulate({ changqiang: 600 }, null, { nanjiangxiangbing: 120 }, 0, null, { kind: 'wild' });
      var lossPct = 100 * r.defLoss / 120;
      window.__ele118 = '枪损' + r.atkLoss + '/600 象损' + r.defLoss + '/120(' + Math.round(lossPct) + '%)';
      return r.winner === 'def' && lossPct >= 10 && lossPct <= 60;
    })(), window.__ele118 || '-');

    /* ---------- 需求 3：外敌来犯自动化 ---------- */
    check('③ 自动化含「外敌来犯」项；开/关读唯一出口 invasionAcceptOn', (function () {
      var hit = null;
      (G.ui.AUTO_ITEMS || []).forEach(function (x) { if (x.id === 'invasion') hit = x; });
      if (!hit || hit.act !== 'toggle-auto-invasion') return false;
      var st = G.newGame({ name: '犯', cityName: '许都' });
      G.state = st;
      try {
        var on0 = G.invasionAcceptOn();
        st.settings.invasion = false;
        var off = !G.invasionAcceptOn();
        st.settings.invasion = true;
        var on1 = G.invasionAcceptOn();
        return on0 === true && off && on1 === true
          && m98.indexOf("case 'toggle-auto-invasion'") >= 0
          && typeof G.doToggleInvasionAccept === 'function';
      } finally { G.state = bak98; }
    })());

    check('③ 规则块与烽火流水在自动化面板；军务·烽火只剩预警与布防（留指路行）', (function () {
      var st = G.newGame({ name: '犯', cityName: '许都' });
      if (!st.map.grid) G.map.generate();
      st.cities.push(G.makeCity({ id: 'b118', name: '二城', x: 265, y: 215 }));
      G.state = st;
      try {
        var pane = G.ui.autoPaneHTML('invasion');
        var page = G.ui.marchBeaconHTML();
        return pane.indexOf('来犯 · 触发与规则') >= 0
          && pane.indexOf('开关含义') >= 0
          && page.indexOf('来犯 · 触发与规则') < 0
          && page.indexOf('bb-line beacon') < 0
          && page.indexOf('自动化 · 外敌来犯') >= 0
          && page.indexOf('策略布防') >= 0;
      } finally { G.state = bak98; }
    })());

    check('③ 口径收口：settings.invasion === false 只出现在 invasionAcceptOn 内（一处）', (function () {
      var mm = s98.match(/settings\.invasion === false/g) || [];
      return mm.length === 1 && s98.indexOf('GAME.invasionAcceptOn = function') >= 0
        && s98.indexOf('!GAME.invasionAcceptOn()') >= 0;
    })());

    /* ---------- 需求 4：沙盘保真度（战斗加成快照） ---------- */
    (function () {
      var st = G.newGame({ name: '快照', cityName: '许都' });
      if (!st.map.grid) G.map.generate();
      st.settings = st.settings || {};
      st.settings.battleWatch = false;
      G.state = st;
      var _exp0 = G.battle.expedition;
      var rep = null, v0 = null, v1 = null, v2 = null, dbg = '';
      try {
        var cx = G.currentCity().x, cy = G.currentCity().y;
        st.wilds.push({ x: cx + 2, y: cy, type: 'plain', lv: 3, terrain: 'plain' });
        var g0 = st.generals[0];
        g0.cityId = G.currentCity().id; g0.status = 'idle';
        var c0 = G.currentCity();
        c0.army = { yibing: 4000 };
        if (G.setStaNow) G.setStaNow(g0, 200);
        g0.energy = 200;
        var d0 = G.march.dispatch({ kind: 'wild', x: cx + 2, y: cy, name: '快照野地', lv: 3, terrain: 'plain' },
          'raid', { yibing: 4000 }, g0.id, null, null, null);
        if (d0 && d0.ok !== false) {
          (st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
          G.march.tick();
          rep = st.reports[0];
        }
        if (rep && rep.sandbox) {
          v0 = G.battle.sandboxOf(rep);
          /* 篡改全局：科技暴涨 + 天时换季 + 战鼓注入 + 羁绊倍率拉满 */
          st.techs = st.techs || {};
          st.techs.zhandou = 9; st.techs.yibing = 9;
          st.world = st.world || {};
          st.world.weather = (st.world.weather === 'clear') ? 'rain' : 'clear';
          st.buffs = { military: { atk: 9.99, def: 9.99 } };
          var _atk0 = G.story.atkMult;
          G.story.atkMult = function () { return 99; };
          try { v1 = G.battle.sandboxOf(rep); } finally { G.story.atkMult = _atk0; }
          /* 对照：清掉配方里的 boost（旧档行为）→ 应用同一批篡改后必然不一致 */
          var rep2 = JSON.parse(JSON.stringify(rep));
          rep2.sandbox.boost = null;
          G.story.atkMult = function () { return 99; };
          try { v2 = G.battle.sandboxOf(rep2); } finally { G.story.atkMult = _atk0; }
          dbg = 'v0=' + (!!v0 && v0.verify) + ' v1=' + (!!v1 && v1.verify) + ' v2=' + (!!v2 && v2.verify)
            + '（v0 原始 / v1 篡改后带快照 / v2 篡改后去快照）';
        }
      } finally {
        G.battle.expedition = _exp0;
        G.state = bak98;
      }
      check('④ 配方带 boost，且 sandboxOf 走 withBoost 装回（源码级）', (function () {
        return b98.indexOf('GAME.battle.boostSnapshot = function') >= 0
          && b98.indexOf('GAME.battle.withBoost = function') >= 0
          && /boost: extra\.boost \|\| null/.test(b98)
          && /withBoost\(rc\.boost \|\| null/.test(b98);
      })());
      check('④ 保真度：原始 verify=true；**篡改全局后带着快照重跑仍 true**', function () {
        return !!v0 && v0.verify === true && !!v1 && v1.verify === true;
      }, dbg || '未取到战报');
      check('④ 对照：**清掉快照**后同一批篡改使 verify=false（证明快照在起作用）', function () {
        return !!v2 && v2.verify === false;
      }, dbg || '未取到战报');
    })();

    /* ---------- 需求 0：需求档案在册 ---------- */
    check('⓪ 需求档案补录到 v89.118（本轮四条在册）', (function () {
      var p = _p98.join(__dirname, '需求档案.md');
      if (!_fs98.existsSync(p)) return false;
      var t = _fs98.readFileSync(p, 'utf8');
      return t.indexOf('v89.118') >= 0
        && t.indexOf('俘虏在被收编那一刻才加人口') >= 0
        && t.indexOf('象兵不设置克制') >= 0
        && t.indexOf('外敌来犯') >= 0;
    })());
  })();
