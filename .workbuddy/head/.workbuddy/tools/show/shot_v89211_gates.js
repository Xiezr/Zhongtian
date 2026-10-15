/* v89.211 实机验收：强化显示链 · 占城空格补齐 · 器械工位归一（真浏览器 + 真 UI 链路）
   ------------------------------------------------------------
   ① 装备面板：+10 武器槽位行显示「攻5198」（=2888×1.8）；降回 +0 显示原值（同屏对照）
   ② 占城：真调 onConquer → 城内 0 空格、原墙格（idx37）补居所、围墙在环城槽；城市视图截图
   ③ 器械链：先开军营面板（污染 _trainBIdx）→ 开作坊面板 → 真点「造自行火炮/自行火炮等」→
      面板归一到作坊格 → 真点自行火炮 → 真点提交 → 队列落在作坊（不再假报"本城尚无工匠作坊"）
   ------------------------------------------------------------ */
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
  var errors = [];
  p.on('pageerror', function (e) { errors.push(String(e.message)); console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v211', cityName: '许都', region: '碎垣', mapSeed: 20261006 });
    if (!G.state.map.grid) G.map.generate();
    G.state.world.weather = 'clear';
    G.ui.enterGame();
    G.ui.closeAllModals();
  });
  await sleep(500);

  /* ══ ① 装备面板：强化显示（同屏对照 +10 / +0） ══ */
  var s1 = await p.evaluate(function () {
    var G = window.GAME;
    var g = G.state.generals[0];
    g.equip = g.equip || {};
    if (g.equip.weapon) G.state.inventory.push(g.equip.weapon);
    var inst = G.addEquip('yt_sword', 10);
    g.equip.weapon = inst;
    G.ui._equipGen = g.id;
    G.ui.setView('city');
    G.ui.openEquipPanel();
    return { uid: inst.u };
  });
  await sleep(500);
  var s1a = await p.evaluate(function () {
    var G = window.GAME;
    var rt = document.getElementById('modal-root');
    var txt = rt ? rt.textContent : '';
    var inst = null;
    G.state.generals[0].equip && (function () { inst = G.state.generals[0].equip.weapon; })();
    return { has5198: txt.indexOf('攻5198') >= 0, has2888: txt.indexOf('攻2888') >= 0,
      math: G.eqEnhMulOf(inst), desc: G.equipDescOf(inst) };
  });
  chk('①a 槽位行显示强化后攻值（攻5198 · 乘数 ' + s1a.math.toFixed(2) + '）',
    s1a.has5198 && !s1a.has2888, s1a.desc);
  await p.screenshot({ path: E + 'v89211-eq-plus10.png' });
  /* 降回 +0 → 显示原值（对照） */
  var s1b = await p.evaluate(function () {
    var G = window.GAME;
    var inst = G.state.generals[0].equip.weapon;
    inst.enh = 0;
    G.ui.reopenKeepScroll(G.ui.openEquipPanel);
    return true;
  });
  await sleep(450);
  var s1c = await p.evaluate(function () {
    var txt = (document.getElementById('modal-root') || {}).textContent || '';
    return { has5198: txt.indexOf('攻5198') >= 0, has2888: txt.indexOf('攻2888') >= 0 };
  });
  chk('①b 降回 +0 → 显示原值（攻2888 · 对照成立）', s1c.has2888 && !s1c.has5198, JSON.stringify(s1c));
  await p.screenshot({ path: E + 'v89211-eq-plus0.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(200);

  /* ══ ② 占城：0 空格 + 原墙格补居所 ══ */
  var s2 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var vic = null;
    (st.map.cities || []).forEach(function (x) { if (x.type === 'county' && !vic) vic = x; });
    if (!vic) return { err: 'no-county' };
    G.onConquer(vic, { winner: 'atk' }, st.generals[0]);
    var nc = null;
    st.cities.forEach(function (x) { if (x.origId === vic.id) nc = x; });
    if (!nc) return { err: 'no-new-city' };
    var wIdx = G.wallPlanIdxOf();
    var empt = [];
    nc.cells.forEach(function (c, i) { if (!c.build && !c.pending) empt.push(i); });
    /* 切到该城城市视图（截图证据） */
    G.ui._cityId = nc.id;
    G.ui.setView('city');
    G.ui.closeAllModals();
    return {
      name: nc.name, wIdx: wIdx, empt: empt.length,
      wallCell: JSON.stringify(nc.cells[wIdx].build),
      wall: nc.wall && nc.wall.build ? ('Lv' + nc.wall.build.lvl) : null,
      mf: nc.cells.filter(function (c) { return c.build && c.build.id === 'minfang'; }).length,
    };
  });
  await sleep(600);
  chk('②a 占城后 0 空格（' + s2.name + ' · ' + s2.empt + ' 格空）', s2.empt === 0, JSON.stringify(s2));
  chk('②b 原墙格（idx' + s2.wIdx + '）补居所 ' + s2.wallCell + ' · 围墙在环城槽 ' + s2.wall,
    s2.wallCell.indexOf('minfang') >= 0 && !!s2.wall);
  chk('②c 居所 27 座（26+墙位 1）', s2.mf === 27, 'mf=' + s2.mf);
  await p.screenshot({ path: E + 'v89211-city.png' });

  /* ══ ③ 器械链：军营污染 → 作坊入口 → 真点提交 ══ */
  var s3 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var c0 = st.cities[0];
    G.ui._cityId = c0.id;
    /* 造齐：作坊 22 / 军营 18 / 书院 11 */
    c0.cells[22].build = { id: 'gongjiangzuofang', lvl: 7 };
    c0.cells[18].build = { id: 'junying', lvl: 10 };
    c0.cells[11].build = { id: 'shuyuan', lvl: 10 };
    c0.res.pop = 500000;
    G.goldAdd(9999999);
    c0.res.grain = 9999999; c0.res.wood = 9999999; c0.res.stone = 9999999; c0.res.iron = 9999999;
    G.ui.setView('city');
    /* 先开军营面板（玩家真实序列：上一次点的是军营格） */
    G.ui.openTroops(18, 'normal');
    return { stale: G.ui._trainBIdx };
  });
  await sleep(350);
  /* 关掉，再从作坊入口走 */
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(150);
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openWorkshop(22);            /* = 点击城内「工匠作坊」格子开的面板 */
  });
  await sleep(350);
  await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="open-siege"]');
    if (b) b.click();
  });
  await sleep(450);
  var s3a = await p.evaluate(function () {
    var G = window.GAME;
    var txt = (document.getElementById('modal-root') || {}).textContent || '';
    return { bIdx: G.ui._trainBIdx, title: txt.slice(0, 40) };
  });
  chk('③a 作坊入口 → 器械面板归一到作坊格（_trainBIdx ' + s3.stale + ' → ' + s3a.bIdx + '）',
    s3a.bIdx === 22, JSON.stringify(s3a));
  /* 真点自行火炮卡 → 真点提交 */
  await p.evaluate(function () {
    var card = document.querySelector('#modal-root .troop-card[data-troop="toudan"]');
    if (card) card.click();
  });
  await sleep(350);
  var s3b = await p.evaluate(function () {
    var go = document.querySelector('#modal-root [data-action="confirm-train"]');
    return { has: !!go, disabled: go ? go.hasAttribute('disabled') : true };
  });
  chk('③b 自行火炮卡可选 · 提交键在册', s3b.has && !s3b.disabled, JSON.stringify(s3b));
  await p.evaluate(function () {
    var go = document.querySelector('#modal-root [data-action="confirm-train"]');
    if (go) go.click();
  });
  await sleep(600);
  var s3c = await p.evaluate(function () {
    var G = window.GAME;
    var c0 = G.state.cities[0];
    var q22 = G.trainQueuesOf(c0, 22, 'craft');
    var q18 = G.trainQueuesOf(c0, 18, 'craft');
    var txt = (document.getElementById('modal-root') || {}).textContent || '';
    var toastTxt = (document.getElementById('toast') || {}).textContent || '';
    return { q22: q22.length, q18: q18.length, troop: q22.length ? q22[q22.length - 1].troopId : null,
      panelHasQueue: txt.indexOf('自行火炮') >= 0, toast: toastTxt.slice(0, 60) };
  });
  chk('③c 真点提交成功：队列落在作坊 22（q22=' + s3c.q22 + ' · 兵种 ' + s3c.troop + '）',
    s3c.q22 === 1 && s3c.q18 === 0 && s3c.troop === 'toudan', JSON.stringify(s3c));
  chk('③d 面板当场显示队列（含自行火炮）· 无「本城尚无工匠作坊」假报',
    s3c.panelHasQueue && s3c.toast.indexOf('本城尚无工匠作坊') < 0, s3c.toast);
  await p.screenshot({ path: E + 'v89211-train.png' });

  chk('④ 全程零页面运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack || e)); process.exit(2); });
