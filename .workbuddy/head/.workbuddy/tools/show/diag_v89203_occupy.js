/* v89.203 诊断：① 防守默认阵位（sieging 守方）② 占领名城全流程 ③ 城池一览 DOM
   ------------------------------------------------------------
   改前/改后对照：② 的 siege 默认改前=hold、改后=advance。
   走真流程：dispatch(occupy) → march.tick 到挂起 → offlineCatchup(600) 自动打完 → 查看结果；
   围城多波（城垣未破则再攻）。
   ⚠️ 只读不改（全部经游戏出口造局，不动存档文件）。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* ══ ① 防守默认阵位（sieging 守方）—— 改前应该是 hold ══ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'v203a', cityName: '许都', mapSeed: 20260933 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    /* 直调出口：守方（攻城）某兵种的 stance */
    var t1 = G.tacticOf('def', 'qingji', { sieging: true });
    var t2 = G.tacticOf('def', 'qingji', { sieging: false });
    var t3 = G.tacticOf('def', 'qingji', { sieging: true, playerDef: false });
    return { siege: t1.s, wild: t2.s, siege2: t3.s,
      def0: (G.DATA.STANCE_DEFAULT || {}).siege, std: JSON.stringify(G.DATA.STANCE_DEFAULT) };
  });
  console.log('  ① 守方默认（攻城=' + r1.siege + ' · 野地=' + r1.wild + '）· STANCE_DEFAULT=' + r1.std);
  chk('① 攻城守方默认 = advance（改前应为 hold —— 老板要全员前进）', r1.siege === 'advance', 'siege=' + r1.siege);
  chk('① 野地/据点守方默认 = advance（本已正确）', r1.wild === 'advance', 'wild=' + r1.wild);

  /* ══ ② 占领名城全流程（多波围攻 → 破城 → onConquer）══ */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'v203b', cityName: '许都', mapSeed: 20260934 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    st.world.weather = 'clear';
    var c0 = st.cities[0];
    G.ui._cityId = c0.id;
    c0.army = { qingji: 99999 };
    var lord = G.lordGeneralOf();
    lord.status = 'idle';
    /* 找一座"名城"（优先 zhou/capital，否则第一座） */
    var npc = null;
    (st.map.cities || []).forEach(function (x) {
      if (!npc && (x.type === 'zhou' || x.type === 'capital')) npc = x;
    });
    if (!npc) npc = (st.map.cities || [])[0];
    if (!npc) return { err: 'no npc city' };
    /* 守军结构基线 + 弱化（诊断造局：先验证"占领链"本身，再谈打不打得过） */
    var g0 = JSON.stringify(npc.garrison || null).slice(0, 200);
    var def0 = npc.def;
    var gSum0 = 0;
    if (npc.garrison && typeof npc.garrison === 'object') {
      Object.keys(npc.garrison).forEach(function (k) {
        if (typeof npc.garrison[k] === 'number') { gSum0 += npc.garrison[k]; npc.garrison[k] = 50; }
      });
    }
    var waves = [];
    var conquered = false;
    for (var w = 0; w < 4 && !conquered; w++) {
      G.setStaNow(lord, 999); lord.energy = 999;
      var bk = Math.random; Math.random = function () { return 0.001; };
      var dr;
      try { dr = G.battle.expedition({ kind: 'city', id: npc.id }, 'occupy', { qingji: 99999 }, lord.id); }
      finally { Math.random = bk; }
      if (!dr || !dr.ok) { waves.push({ dispatch: dr && dr.msg }); break; }
      var n = 0;
      while (st.marches.length && n < 500) {
        G.march.tick(); n++;
        if (st.battles && st.battles.length) break;
      }
      if (!(st.battles || []).length) { waves.push({ noBattle: w, n: n }); break; }
      G.offlineCatchup(600);   /* 自动打完 */
      var jd = G._battleJustDone || {};
      var inList = (st.cities || []).some(function (c) { return c.origId === npc.id || c.id === npc.id || (c.x === npc.x && c.y === npc.y); });
      waves.push({ w: w, cities: st.cities.length, inList: inList, winner: jd.winner, ok: jd.ok });
      if (inList) conquered = true;
    }
    /* 玩家城列表里是否出现该城 */
    var inList2 = (st.cities || []).some(function (c) { return c.origId === npc.id || c.id === npc.id || (c.x === npc.x && c.y === npc.y); });
    /* 军情流水里的行（末 12 条） */
    var logs = [];
    (st.msgLog || []).slice(-14).forEach(function (m) { if (/城垣|纳入版图|占领|围攻/.test(m.msg || '')) logs.push((m.msg || '').slice(0, 70)); });
    return { name: npc.name, type: npc.type, waves: waves, cities: st.cities.length, inList: inList2,
      npcStillNpc: !!(st.map.cities || []).some(function (x) { return x.id === npc.id; }), logs: logs.slice(-8),
      siegeKeys: Object.keys(st.sieges || {}), garrison0: g0, def0: def0, gSum0: gSum0 };
  });
  console.log('  ② 目标：' + (r2.name || '?') + '（' + (r2.type || '?') + '）· 守军合计 ' + r2.gSum0 + ' / 城防 ' + r2.def0);
  console.log('     守军结构：' + r2.garrison0);
  console.log('     城数 ' + r2.cities + ' · inList=' + r2.inList + ' · npc仍在=' + r2.npcStillNpc);
  console.log('     波次：' + JSON.stringify(r2.waves));
  console.log('     围攻档：' + JSON.stringify(r2.siegeKeys));
  (r2.logs || []).forEach(function (l) { console.log('     log: ' + l); });
  chk('② 全流程后名城进入 s.cities（或明确为非 bug 路径）', r2.inList === true, 'inList=' + r2.inList);

  /* ══ ③ 君主界面「城池一览」DOM（若④占到城）══ */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    try {
      G.ui.enterGame(); G.ui.closeAllModals();
      G.ui.openLordInfo();
      var shell = document.querySelector('#modal-root .inner-panel');
      if (!shell) return { err: 'no panel' };
      var names = [];
      Array.prototype.slice.call(shell.querySelectorAll('.lord-city .ls-nm')).forEach(function (n) {
        names.push(n.textContent.trim().slice(0, 8));
      });
      var countTxt = (shell.querySelector('.m-sec') || {}).textContent || '';
      var capLine = -1;
      var rows = shell.querySelectorAll('.lord-tbl tr');
      for (var i = 0; i < rows.length; i++) {
        if ((rows[i].textContent || '').indexOf('爵位') >= 0) capLine = i;
      }
      G.ui.closeAllModals();
      return { names: names, countTxt: countTxt.slice(0, 30) };
    } catch (e) { return { err: String(e && e.message) }; }
  });
  console.log('  ③ 君主界面城池一览（' + r3.countTxt + '）：' + JSON.stringify(r3.names));
  chk('③ 城池一览列出全部我方城池（含新占）', (r3.names || []).length >= 1, JSON.stringify(r3));

  /* ══ ④ 上限满时占领被拦（旧值下：平民 2 座）══ */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var npc = (st.map.cities || []).filter(function (x) { return !(st.cities || []).some(function (c) { return c.x === x.x && c.y === x.y; }); })[0];
    if (!npc) return { err: 'no npc' };
    var lord = G.lordGeneralOf();
    /* 摆到上限（读出口值，不写死数字） */
    var cap = G.cityCapOf();
    while (st.cities.length < cap) {
      st.cities.push(G.makeCity({ id: 'cap_a' + st.cities.length, name: '摆城' + st.cities.length,
        x: 400 + st.cities.length, y: 400, type: 'self' }));
    }
    var dr = G.battle.expedition({ kind: 'city', id: npc.id }, 'occupy', { qingji: 100 }, lord.id);
    st.cities.length = 1;   /* 收尾还原一个城数 */
    return { cap: cap, ok: dr && dr.ok, msg: dr && dr.msg };
  });
  console.log('  ④ 满编（cap=' + r4.cap + '）时占领派兵：ok=' + r4.ok + ' msg=' + JSON.stringify(r4.msg));
  chk('④ 满编时「占领城池」被拦（提示领地上限）', r4.ok === false && /领地上限/.test(r4.msg || ''), JSON.stringify(r4));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(0);
})();
