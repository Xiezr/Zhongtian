/* v89.203 实机验收：① toast 中上（弹窗内不挡底键 / 无弹窗回底部 · 几何真量）
   ② 防守默认全员前进（真浏览器出口验证）
   ③ 名城占领全流程（弱化守军 → 拿下 → 君主列表显示）
   ④ 爵位管理城池数（列头 / 首档 9 / 说明） */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v203', cityName: '许都', region: '豫州', mapSeed: 20260935 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._cityId = c.id;
  });

  /* ══ ① toast 中上（弹窗内不挡底键 · 几何真量）══ */
  await p.evaluate(function () {
    var G = window.GAME;
    ['lg_weapon_1'].forEach(function (id) { try { G.addEquip(id); } catch (e) { } });
    G.state.items = G.state.items || {}; G.state.items.lingsui = 500;
    G.ui._lingSel = null; G.ui._lingFilter = 'all';
    G.ui.closeAllModals();
    G.ui.openLingTemper();
  });
  await sleep(450);
  await p.evaluate(function () { window.GAME.ui.notify('info', '实机校验提示（弹窗内）'); });
  await sleep(180);
  var r1 = await p.evaluate(function () {
    var t = document.getElementById('toast');
    var foot = document.querySelector('#modal-root .m-foot');
    var tr = t.getBoundingClientRect();
    var fr = foot ? foot.getBoundingClientRect() : null;
    return { high: t.classList.contains('high'), top: Math.round(tr.top), bottom: Math.round(tr.bottom),
      footTop: fr ? Math.round(fr.top) : null, vh: window.innerHeight,
      text: (t.textContent || '').slice(0, 30) };
  });
  chk('①a 弹窗内 toast：high=' + r1.high + ' · top=' + r1.top + '（上半屏）· bottom=' + r1.bottom + ' ≤ 底键顶 ' + r1.footTop + '（不挡操作键）',
    r1.high && r1.top < r1.vh * 0.35 && r1.footTop != null && r1.bottom <= r1.footTop + 1,
    JSON.stringify(r1));
  await p.screenshot({ path: E + 'v89203-toast.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(220);
  await p.evaluate(function () { window.GAME.ui.notify('info', '实机校验提示（无弹窗）'); });
  await sleep(180);
  var r2 = await p.evaluate(function () {
    var t = document.getElementById('toast');
    var tr = t.getBoundingClientRect();
    return { high: t.classList.contains('high'), top: Math.round(tr.top), vh: window.innerHeight };
  });
  chk('①b 无弹窗 toast：high=' + r2.high + '（应 false）· top=' + r2.top + '（下半屏）',
    !r2.high && r2.top > r2.vh * 0.6, JSON.stringify(r2));

  /* ══ ② 防守默认全员前进（真浏览器）══ */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    return {
      siege: (G.DATA.STANCE_DEFAULT || {}).siege,
      def: (G.DATA.STANCE_DEFAULT || {}).def,
      s1: G.tacticOf('def', 'changqiang', { sieging: true }).s,
      s2: G.tacticOf('def', 'changqiang', { sieging: false }).s,
    };
  });
  chk('② 守方默认：siege 特例=' + r3.siege + ' · def=' + r3.def + ' · 攻城守方=' + r3.s1 + ' · 野地守方=' + r3.s2,
    r3.siege === undefined && r3.def === 'advance' && r3.s1 === 'advance' && r3.s2 === 'advance',
    JSON.stringify(r3));

  /* ══ ③ 名城占领全流程（弱化守军 → 拿下 → 君主列表）══ */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, c0 = G.currentCity();
    st.world.weather = 'clear';
    var lord = G.lordGeneralOf();
    lord.status = 'idle';
    c0.army = { qingji: 99999 };
    var npc = null;
    (st.map.cities || []).forEach(function (x) {
      if (!npc && (x.type === 'zhou' || x.type === 'capital')) npc = x;
    });
    if (!npc) npc = (st.map.cities || [])[0];
    if (!npc) return { err: 'no npc' };
    var name0 = npc.name, type0 = npc.type;
    /* 弱化守军（诊断造局：验证归属链本身） */
    if (npc.garrison && typeof npc.garrison === 'object') {
      Object.keys(npc.garrison).forEach(function (k) {
        if (typeof npc.garrison[k] === 'number') npc.garrison[k] = 50;
      });
    }
    var conquered = false;
    for (var w = 0; w < 3 && !conquered; w++) {
      G.setStaNow(lord, 999); lord.energy = 999;
      var bk = Math.random; Math.random = function () { return 0.001; };
      var dr;
      try { dr = G.battle.expedition({ kind: 'city', id: npc.id }, 'occupy', { qingji: 99999 }, lord.id); }
      finally { Math.random = bk; }
      if (!dr || !dr.ok) break;
      var n = 0;
      while (st.marches.length && n < 500) {
        G.march.tick(); n++;
        if (st.battles && st.battles.length) break;
      }
      if (!(st.battles || []).length) break;
      G.offlineCatchup(600);
      conquered = (st.cities || []).some(function (c) { return c.origId === npc.id || (c.x === npc.x && c.y === npc.y); });
    }
    return { name: name0, type: type0, ok: conquered, cities: st.cities.length };
  });
  chk('③a 名城占领全流程：' + r4.name + '（' + r4.type + '）入版图 → 城数 ' + r4.cities,
    r4.ok === true, JSON.stringify(r4));
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openLordInfo();
    return 1;
  });
  await sleep(400);
  var r6 = await p.evaluate(function () {
    var shell = document.querySelector('#modal-root .inner-panel');
    var names = [];
    Array.prototype.slice.call(shell.querySelectorAll('.lord-city .ls-nm')).forEach(function (n) {
      names.push(n.textContent.trim().slice(0, 10));
    });
    return { names: names };
  });
  chk('③b 君主界面「城池一览」显示新占名城（' + (r6.names || []).join(' / ') + '）',
    (r6.names || []).some(function (n) { return n.indexOf('洛阳') >= 0; }) || (r6.names || []).length >= 2,
    JSON.stringify(r6));
  await p.screenshot({ path: E + 'v89203-occupy.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ══ ④ 爵位管理城池数 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('rank');
  });
  await sleep(400);
  var r7 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var txt = vc ? (vc.textContent || '') : '';
    var head = false;
    Array.prototype.slice.call(vc.querySelectorAll('th')).forEach(function (th2) {
      if (th2.textContent.trim() === '管理城池') head = true;
    });
    var row0 = vc.querySelector('.tbl tbody tr');
    var tds = [];
    if (row0) Array.prototype.slice.call(row0.querySelectorAll('td')).forEach(function (td) { tds.push(td.textContent.trim().slice(0, 14)); });
    /* 下一级面板的城池行 */
    var resLine = '';
    Array.prototype.slice.call(vc.querySelectorAll('.res-line')).forEach(function (x2) {
      if (x2.textContent.indexOf('领地上限') >= 0) resLine = x2.textContent.trim().slice(0, 34);
    });
    return { head: head, tds: tds, has9: txt.indexOf('平民 9 座') >= 0, resLine: resLine };
  });
  chk('④a 爵位页：列头「管理城池」在册 · 首档行 ' + JSON.stringify(r7.tds),
    r7.head === true, JSON.stringify(r7));
  chk('④b 说明「平民 9 座」在册 · 城池行「' + r7.resLine + '」',
    r7.has9 === true && /\/9\b/.test(r7.resLine), r7.resLine);
  await p.screenshot({ path: E + 'v89203-rank.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
