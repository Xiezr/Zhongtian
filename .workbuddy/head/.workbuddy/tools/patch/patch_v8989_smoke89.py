# -*- coding: utf-8 -*-
"""
v89.89 · smoke §89 固化断言（v6 期待清单八条：A2/A3/A4/B1/C3/C4/D4/E3）
插入到 'console.log(结果：...)' 之前（独立 IIFE，建局/还原照 v89.88 段手法）。
"""
import io, sys

P = r'E:\Deepseekdb\smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

ANCHOR = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

NEW = """  /* ================= v89.89（v6 期待清单：A2/A3/A4/B1/C3/C4/D4/E3） ================= */
  (function () {
    var fs89 = require('fs'), path89 = require('path');
    var uS89 = fs89.readFileSync(path89.join(__dirname, 'js', 'ui.js'), 'utf8');
    var dS89 = fs89.readFileSync(path89.join(__dirname, 'js', 'domain.js'), 'utf8');
    var mS89 = fs89.readFileSync(path89.join(__dirname, 'js', 'main.js'), 'utf8');
    var stS89 = fs89.readFileSync(path89.join(__dirname, 'js', 'state.js'), 'utf8');
    var bS89 = fs89.readFileSync(path89.join(__dirname, 'js', 'battle.js'), 'utf8');
    var hS89 = fs89.readFileSync(path89.join(__dirname, 'index.html'), 'utf8');

    var oldState = G.state;
    var S89 = G.newGame({ name: 'v89.89', cityName: '许都' });
    if (!S89.map.grid) G.map.generate();
    G.state = S89;
    var city89 = S89.cities[0];

    /* ---- ① C3：门派晋升（占城来源 + 门槛重估 + 唯一出口） ---- */
    check('v89.89（C3）：门派声望来源扩容（占城分档）+ 门槛重估（长老 60000）', (function () {
      var R = DATA.SECT_RANKS, CQ = DATA.SECT_CONQUER_REP;
      var okR = !!R && R.length === 5 && R[0].rep === 0 && R[1].rep === 1000 && R[2].rep === 6000
        && R[3].rep === 25000 && R[4].rep === 60000;
      var okC = !!CQ && CQ.county === 1500 && CQ.jun === 4000 && CQ.zhou === 12000 && CQ.capital === 30000;
      if (!okR || !okC) return false;
      if (!/GAME\\.sectRepGain = function/.test(dS89) || !/GAME\\.sectRepGain\\('task', gain\\)/.test(dS89)) return false;
      if (!/GAME\\.sectRepGain\\('conquer'/.test(bS89)) return false;
      /* 行为：未入派拒发 */
      var st = G.sectState(), bak = { id: st.id, rep: st.rep, founder: st.founder };
      st.id = null; st.rep = 0;
      var r0 = G.sectRepGain('conquer', 5000);
      var okReject = r0.ok === false && st.rep === 0;
      /* 行为：入派（临时驻地）→ 发放 + 晋升检测（800+400 跨 1000） */
      var cell = null;
      (city89.cells || []).forEach(function (c) { if (!cell && !c.build) cell = c; });
      if (!cell) return false;
      var saved = cell.build;
      cell.build = { id: 'honglusi', lvl: 1 };
      var j = G.doSectJoin('xuanhe');
      var r1 = G.sectRepGain('conquer', 800);
      var r2 = G.sectRepGain('conquer', 400);
      var okGain = j.ok && r1.ok && r1.gain === 800 && r2.rankUp === '外门弟子';
      /* 还原 */
      st.id = bak.id; st.rep = bak.rep; st.founder = bak.founder; st.tasks = {}; st.leftAt = 0;
      cell.build = saved;
      return okReject && okGain;
    })());

    /* ---- ② A2：离线归来报告（快照归集 + 分类弹窗） ---- */
    check('v89.89（A2）：离线归来报告（快照归集 · 分类弹窗 · 载入即弹）', (function () {
      if (!/GAME\\._offlineReport = \\{/.test(stS89)) return false;
      if (!/ui\\.offlineReportHTML = function/.test(uS89) || !/ui\\.openOfflineReport = function/.test(uS89)) return false;
      if (!/if \\(off >= 60 && GAME\\._offlineReport\\) ui\\.openOfflineReport\\(\\);/.test(uS89)) return false;
      /* 渲染级：手工塞一份报告 → 分类区块齐 → 还原 */
      var bak = G._offlineReport;
      G._offlineReport = { secReal: 36000, applied: 18000, overflow: 18000, capDays: 7,
        res: { grain: 1234, wood: -50, stone: 0, iron: 10, gold: 2, pop: 0 },
        done: { build: 2, tech: 1, train: 3 },
        reports: ['测试战报甲'], reportsN: 1, wounded: 20, marchMsg: '大军抵达测试' };
      var html = G.ui.offlineReportHTML();
      var ok = html.indexOf('归来报告') >= 0 && html.indexOf('资源净变') >= 0
        && html.indexOf('在办完成') >= 0 && html.indexOf('战报与事件') >= 0
        && html.indexOf('五折折算') >= 0 && html.indexOf('建造完工 2 项') >= 0
        && html.indexOf('测试战报甲') >= 0;
      G._offlineReport = bak;
      return ok;
    })());

    /* ---- ③ A3：歼敌值口径解释 ---- */
    check('v89.89（A3）：战报「歼敌值」口径悬停解释', (function () {
      return /title="歼敌值 = 按歼灭敌军的资源造价折算（与将领经验同一口径）"/.test(bS89);
    })());

    /* ---- ④ A4：材料产地悬停 + 跳转 ---- */
    check('v89.89（A4）：材料产地悬停（data-tip）+ 🗺️ 跳转（州治解析）', (function () {
      if (!/data-tip="产地：/.test(uS89) || !/data-action="mat-go"/.test(uS89)) return false;
      if (!/ui\\.matGoTargetOf = function/.test(uS89) || !/GAME\\.doMatGo = function/.test(mS89)) return false;
      if (!/ui\\._mapMark = \\{ x: t\\.x, y: t\\.y, until:/.test(mS89)) return false;
      /* 行为：第一个有州特产的材料 → 目标可解析（读操作） */
      var mid = null;
      for (var k in (DATA.STATE_SPECIALTY || {})) { mid = DATA.STATE_SPECIALTY[k].mat; break; }
      var t = mid ? G.ui.matGoTargetOf(mid) : null;
      return !!t && typeof t.x === 'number' && typeof t.y === 'number';
    })());

    /* ---- ⑤ B1：任务一键全领（复用出口 · 无新结算路径 · 防重领） ---- */
    check('v89.89（B1）：任务一键全领（复用 claimQuest / claimRandomQuest 出口）', (function () {
      if (!/GAME\\.doClaimAllQuests = function/.test(mS89)) return false;
      if (!/case 'quest-claim-all': GAME\\.doClaimAllQuests\\(\\); break;/.test(mS89)) return false;
      if (!/data-action="quest-claim-all"/.test(uS89)) return false;
      /* 复用两出口的证据 */
      if (!/GAME\\.claimQuest\\(q\\.id\\)/.test(mS89) || !/GAME\\.claimRandomQuest\\(entry\\.id\\)/.test(mS89)) return false;
      /* 行为（无副作用版）：全部标记已领 + 空池 → 一键跑不崩、不新增 */
      var s = S89;
      var bakDone = JSON.stringify(s.quests.done || {}), bakPool = s.quests.pool;
      s.quests.pool = [];
      (DATA.QUESTS || []).forEach(function (q2) { s.quests.done[q2.id] = true; });
      var n0 = JSON.stringify(s.quests.done);
      G.doClaimAllQuests();
      var ok = JSON.stringify(s.quests.done) === n0;      /* 无新入账 */
      s.quests.done = JSON.parse(bakDone); s.quests.pool = bakPool;
      return ok;
    })());

    /* ---- ⑥ D4：战报筛选 + 收藏 ---- */
    check('v89.89（D4）：战报筛选（胜/败/收藏）+ 行内收藏（随档字段）', (function () {
      if (!/ui\\.setRepFilter = function/.test(uS89) || !/ui\\.toggleRepFav = function/.test(uS89)) return false;
      if (!/case 'rep-filter': ui\\.setRepFilter\\(el\\.dataset\\.v\\); break;/.test(mS89)) return false;
      if (!/case 'rep-fav': ui\\.toggleRepFav\\(Number\\(el\\.dataset\\.i\\)\\); break;/.test(mS89)) return false;
      /* 行为：临时战报数组 → 渲染筛选 → 还原 */
      var s = S89;
      var bakRep = s.reports, bakF = G.ui._repFilter;
      s.reports = [
        { t: Date.now(), title: 'D4胜甲', body: 'x', win: true },
        { t: Date.now(), title: 'D4败乙', body: 'x', win: false },
      ];
      G.ui._repFilter = 'lose';
      var hL = G.ui.reportsHTML();
      G.ui._repFilter = 'win';
      var hW = G.ui.reportsHTML();
      s.reports[0].fav = true;
      G.ui._repFilter = 'fav';
      var hF = G.ui.reportsHTML();
      var ok = hL.indexOf('D4败乙') >= 0 && hL.indexOf('D4胜甲') < 0
        && hW.indexOf('D4胜甲') >= 0 && hW.indexOf('D4败乙') < 0
        && hF.indexOf('D4胜甲') >= 0 && hF.indexOf('D4败乙') < 0
        && hL.indexOf('data-action="rep-fav"') >= 0;
      s.reports = bakRep; G.ui._repFilter = bakF;
      return ok;
    })());

    /* ---- ⑦ C4：故事集（已读回看 + 收集进度） ---- */
    check('v89.89（C4）：故事集（已读显名可重读 · 未读？？？ · 分类进度）', (function () {
      if (!/data-action="story-read-at"/.test(uS89)) return false;
      if (!/case 'story-read-at': ui\\.openStory\\(el\\.dataset\\.sid, false\\); break;/.test(mS89)) return false;
      if (!/ui\\.SG_KIND/.test(uS89)) return false;
      var all = G.SG.list();
      if (!all.length) return false;
      /* 行为：写一篇已读 → 渲染 → 还原 */
      var bakSt = S89.stories;
      S89.stories = {};
      S89.stories[all[0].id] = { done: ['e1'], n: 2, grade: 'good' };
      var html = G.ui.storyHTML();
      var ok = html.indexOf('📖 故事集') >= 0
        && html.indexOf('《' + all[0].title + '》') >= 0
        && html.indexOf('《？？？》') >= 0
        && html.indexOf('data-action="story-read-at"') >= 0
        && html.indexOf('已读 1 / ' + all.length) >= 0;
      S89.stories = bakSt;
      return ok;
    })());

    /* ---- ⑧ E3：人口三段条 ---- */
    check('v89.89（E3）：募兵面板人口三段条（可征/上限/增势 · 唯一出口）', (function () {
      if (!/GAME\\.popGrowthOf = function/.test(dS89)) return false;
      if (!/var growth = GAME\\.popGrowthOf\\(city\\);/.test(stS89)) return false;
      if (!/class="pop-3"/.test(uS89)) return false;
      /* 行为：出口值 = max(1, 上限×0.0005) */
      var g1 = G.popGrowthOf(city89);
      var okG = g1 === Math.max(1, G.maxPopOf(city89) * 0.0005);
      /* 渲染：切兵种页 → 三段条在 */
      var bakTab = G.ui._trainTab, bakFil = G.ui._trainFilter, bakSel = G.ui._trainSel;
      G.ui._trainTab = 'inf'; G.ui._trainFilter = 'normal'; G.ui._trainSel = 'yibing';
      var ht = G.ui.troopsHTML();
      var okH = ht.indexOf('pop-3') >= 0 && ht.indexOf('可征') >= 0
        && ht.indexOf('上限') >= 0 && ht.indexOf('增势') >= 0;
      G.ui._trainTab = bakTab; G.ui._trainFilter = bakFil; G.ui._trainSel = bakSel;
      return okG && okH;
    })());

    G.state = oldState;
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

assert s.count(ANCHOR) == 1, s.count(ANCHOR)
io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(ANCHOR, NEW, 1))
print('OK smoke §89 段写入')
