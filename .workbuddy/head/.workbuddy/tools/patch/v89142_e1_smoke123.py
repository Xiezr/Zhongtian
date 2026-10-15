# v89.142 E1：smoke-test.js —— 新增 §123（本轮 7 条需求的门禁断言）
# 跑法：python .workbuddy/tools/patch/v89142_e1_smoke123.py
import io
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/smoke-test.js.before', encoding='utf-8', newline='').read()

MARK = """    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
assert s.count(MARK) == 1, 'anchor count=' + str(s.count(MARK))

NEW = """    })());
  })();

  /* ═══════════════════════════════════════════════════════════
   * §123（v89.142）：老板 7 条 —— 地块 12×8 / 军务三处 / 收编转兵支金 /
   *   出征「上限」/ 斗将播报
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs123 = require('fs'), p123 = require('path');
    var rd123 = function (f) { return fs123.readFileSync(p123.join(__dirname, 'js', f), 'utf8'); };
    var strip123 = function (x) { return x.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''); };
    var u123 = strip123(rd123('ui.js')), b123 = strip123(rd123('battle.js'));
    var m123 = strip123(rd123('main.js')), do123 = strip123(rd123('domain.js'));
    var h123 = fs123.readFileSync(p123.join(__dirname, 'index.html'), 'utf8');

    /* ---- ① 城外地块 12×8（老板 1） ---- */
    check('§123① 城外地块 12×8=96（老板拍板）+ 中心扩散唯一出口 + 未解锁暗格', (function () {
      return DATA.EXT_CAP_MAX === 96 && DATA.EXT_COLS === 12 && DATA.EXT_ROWS === 8
        && /GAME\\.extSlotOrder = function/.test(do123)
        && /GAME\\.extNextLvOf = function/.test(do123)
        && /data-action="ext-locked"/.test(u123)
        && /case 'ext-locked'/.test(m123)
        && /\\.iso-tile\\.locked \\.tile-face/.test(h123)
        && DATA.EXT_COLS * DATA.EXT_ROWS === DATA.EXT_CAP_MAX;
    })());

    /* ---- ② 出征页：目标 5 类分行 + 按钮在底部（老板 2） ---- */
    check('§123② 出征页目标 5 类分行（我方城池/我方野地/名城/野地/野外据点）+ 按钮在界面底部', (function () {
      var bkId = G.ui._cityId, bkPick = G.ui._actPick;
      try {
        var c = GAME.currentCity() || (GAME.state.cities || [])[0];
        G.ui._cityId = c.id;
        G.ui._actPick = null;
        var groups = G.ui.actTargetGroups(c);
        var keys = groups.map(function (g) { return g.key; }).join(',');
        var h = G.ui.marchActHTML();
        var iGo = h.indexOf('data-action="exp-act-go"');
        var iLast = h.lastIndexOf('data-action="exp-act-pick"');
        var labelsOk = ['我方城池', '我方野地', '名城', '野地', '野外据点']
          .every(function (nm) { return h.indexOf(nm) >= 0; });
        return keys === 'owncity,ownwild,npc,wild,fort' && labelsOk
          && iGo > iLast && iLast > 0
          && /case 'exp-act-pick'/.test(m123) && /ui\\.actPickOf\\(\\)/.test(m123)
          && /ui\\.actTargetGroups = function/.test(u123);
      } finally { G.ui._cityId = bkId; G.ui._actPick = bkPick; }
    })());

    /* ---- ③ 出征战术页按钮在底部（老板 3） ---- */
    check('§123③ 出征战术页：掠夺/占领按钮在底部（战术表之后）', (function () {
      var keep = G.ui._expTac;
      try {
        G.ui._expTac = 'raid';
        var h = G.ui.marchExpHTML();
        return h.indexOf('data-action="exp-tac-sub"') > h.indexOf('tac-grid')
          && h.indexOf('🚩 占领战术') >= 0 && h.indexOf('🔥 掠夺战术') >= 0;
      } finally { G.ui._expTac = keep; }
    })());

    /* ---- ④ 防守战术页按钮在底部（老板 4） ---- */
    check('§123④ 防守战术页：防守战术/全境防御按钮在底部（两个小页都验 · 位置一致）', (function () {
      var keep = G.ui._defSub;
      try {
        G.ui._defSub = 'tac';
        var hT = G.ui.marchDefHTML();
        G.ui._defSub = 'over';
        var hO = G.ui.marchDefHTML();
        return hT.indexOf('data-action="def-sub"') > hT.indexOf('tac-grid')
          && hO.indexOf('data-action="def-sub"') > hO.indexOf('class="tbl"')
          && hO.indexOf('🛡️ 全境防御') >= 0 && hO.indexOf('⚔️ 防守战术') >= 0;
      } finally { G.ui._defSub = keep; }
    })());

    /* ---- ⑤ 收编转兵 + 支金（老板 5） ---- */
    check('§123⑤ 收编 = 逐兵种入本城军队 + 支金（造价 50% · unknown→民夫 · 金不足整单拒绝）', (function () {
      var st = GAME.state;
      var c = GAME.currentCity() || (st.cities || [])[0];
      if (!c) return false;
      var bkCap = st.captives, bkGold = st.res.gold;
      var bkArmy = JSON.parse(JSON.stringify(c.army || {}));
      var bkPop = G.res(c).pop;
      try {
        st.captives = { yibing: 10, unknown: 5 };
        var plan = GAME.conscriptPlanOf();
        var okPlan = plan.men === 15 && plan.byType.yibing === 10 && plan.byType.minfu === 5
          && (DATA.CAPTIVE.conscriptPct === 0.5);
        st.res.gold = plan.cost + 1;
        var g0 = st.res.gold, m0 = GAME.battle.marchMenOf(c.army);
        var r = GAME.doConscriptCaptives(c.id);
        var okDo = r.ok && (GAME.battle.marchMenOf(c.army) - m0) === 15
          && (g0 - st.res.gold) === plan.cost && G.res(c).pop === bkPop;
        /* 金不足：整单拒绝（不动兵、不扣金、俘虏还在） */
        st.captives = { yibing: 10 }; st.res.gold = 1;
        var m1 = GAME.battle.marchMenOf(c.army);
        var rDeny = GAME.doConscriptCaptives(c.id);
        var okDeny = rDeny.ok === false && st.res.gold === 1
          && GAME.battle.marchMenOf(c.army) === m1 && GAME.captivesTotalOf() === 10;
        return okPlan && okDo && okDeny
          && /GAME\\.troopGoldCostOf = function/.test(b123)
          && /GAME\\.conscriptPlanOf = function/.test(b123)
          && /GAME\\.doConscriptCaptives = function/.test(b123);
      } finally {
        st.captives = bkCap; st.res.gold = bkGold; c.army = bkArmy;
      }
    })());

    /* ---- ⑥ 出征「上限」填入（老板 6） ---- */
    check('§123⑥ 兵力表头「上限」：三口径（野地派驻余量 / 目标城余量 / 校场容量）唯一出口', (function () {
      var st = GAME.state;
      var c = GAME.currentCity() || (st.cities || [])[0];
      if (!c) return false;
      var src = rd123('ui.js');
      var okSrc = /上限<\\/button>/.test(src) && !/全带<\\/button>/.test(src)
        && /ui\\.expFillCapOf = function/.test(u123)
        && /ui\\.expFillTipOf = function/.test(u123)
        && /ui\\.expFillCapOf\\(c74, ui\\._expRes, ui\\._expMode\\)/.test(m123);
      /* 三口径真调（假城 + 临时野地，用完还原） */
      var tmp = G.makeCity({ id: 't142cap', name: 'T142', col: c.x, row: c.y });
      var bkWilds = st.wilds;
      try {
        tmp.cells.forEach(function (x) { if (x.build && x.build.id === 'xiaochang') x.build.lvl = 5; });
        var hasXc = tmp.cells.some(function (x) { return x.build && x.build.id === 'xiaochang'; });
        if (!hasXc) return false;
        var capCity = G.ui.expFillCapOf(tmp, { kind: 'city', id: 'x' }, 'occupy');
        /* 己方野地：派驻上限 − 现有驻军 */
        var wx = c.x + 1, wy = c.y + 1;
        st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wx && z.y === wy); });
        st.wilds.push({ x: wx, y: wy, type: 'plain', level: 5, day: 0 });
        var w = G.map.wildAt(wx, wy);
        w.garrison = { troops: { yibing: 8000 }, cityId: c.id, genId: null };
        var capWild = G.ui.expFillCapOf(c, { kind: 'wild', x: wx, y: wy }, 'station');
        w.garrison = null;
        return okSrc
          && capCity === GAME.battle.marchCapOf(tmp) && capCity > 0
          && capWild === GAME.wildGarrisonCap(5) - 8000
          /* 无校场 → null（不设限，与 prepare 的 cap>0 判据同规） */
          && G.ui.expFillCapOf({ id: 'noXc142', cells: [], army: {} }, { kind: 'city', id: 'y' }, 'occupy') === null;
      } finally {
        st.wilds = bkWilds;
        var i142 = st.cities.indexOf(tmp);
        if (i142 >= 0) st.cities.splice(i142, 1);
      }
    })());

    /* ---- ⑦ 斗将播报（老板 7） ---- */
    check('§123⑦ 斗将：rec.sim 存 duel/genSim（挂起不丢）+ 回合战况播报行 + 战报【斗将】', (function () {
      var s = GAME.state;
      var g = (s.generals || [])[0];
      if (!g) return false;
      var foe = G.makeGeneral('斗将测乙', 20, 'guard', null, false);
      var ch = DATA.DUEL.chance;
      DATA.DUEL.chance = 1;                    /* 必触发（用完还原） */
      try {
        var d = GAME.battle.rollDuel(g, foe, 's142');
        var okRoll = !!d && d.done === true && !!d.winnerName && (d.rounds || 0) >= 1;
        var html = G.ui.btDuelHTML({ sim: { duel: d } });
        var empty = G.ui.btDuelHTML({ sim: {} });
        var okSrc = /duel: simIn\\.duel \\? U\\.deep\\(simIn\\.duel\\) : null/.test(b123)
          && /genSim: simIn\\.genSim \\? U\\.deep\\(simIn\\.genSim\\) : null/.test(b123)
          && /rec\\.sim\\.genSim \\|\\| gen/.test(b123)
          && /result\\.duel = duel/.test(b123)
          && /【斗将】/.test(b123)
          && /\\.bt-ev\\.duel/.test(h123);
        return okRoll && html.indexOf('战前斗将') >= 0 && html.indexOf('bt-ev duel') >= 0
          && empty === '' && okSrc;
      } finally { DATA.DUEL.chance = ch; }
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

s = s.replace(MARK, NEW)
assert s.count('§123⑦') == 1
assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}'))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE smoke-test.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
