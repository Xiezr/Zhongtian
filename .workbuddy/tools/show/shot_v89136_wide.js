/* v89.136 实机脚本：四条需求的可见面验证（自带判定 + 截图）
 * ------------------------------------------------------------
 * 判定清单：
 *   ① 地块界面「采集」区：开始采集（原地开工 · 驻军保留）→ 进度 → 收获（真点）
 *   ② 将领面板三行同构：单行（<34px）· 数值列定宽等宽 · 进度条等长 · ＋贴右（右缘差 ≤2px）
 *   ③ 战场：双方将领行（悬停六维）· 我方反击白色片段（span.bt-me）· 结束行进播报窗（无战果弹窗）
 *   ④ 出征战术细分：掠夺/占领两小页（真点切换）· 练兵块已退役
 * 截图：v89136-gather.png / pane3.png / bt.png / tac.png
 * 跑法：node .workbuddy/tools/show/shot_v89136_wide.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ── 造局：城 + 带将驻军的湖泊野地 ── */
  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260929 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.army = { yibing: 6000, changqiang: 3000 };
    c.res.gold = 1e7;
    var lord = G.lordGeneralOf();
    lord.status = 'idle'; lord.cityId = c.id;
    var g1 = null;
    (st.generals || []).forEach(function (g) { if (!g1 && g.id !== lord.id) g1 = g; });
    if (!g1) { g1 = G.makeGeneral('驻将甲', 12, 'garrison', c.id, false); st.generals.push(g1); }
    g1.status = 'garrison'; g1.cityId = c.id;
    var wxy = null;
    for (var yy = 3; yy < 220 && !wxy; yy++) {
      for (var xx = 3; xx < 220; xx++) {
        var tl = G.map.tile(xx, yy);
        if (tl && tl.terrain === 'lake' && !G.map.wildAt(xx, yy) && !G.map.npcAt(xx, yy)) {
          wxy = { x: xx, y: yy }; break;
        }
      }
    }
    st.wilds.push({ x: wxy.x, y: wxy.y, type: 'lake', level: 10, levelDay: 0,
      garrison: { troops: { yibing: 5000, changqiang: 2000 }, cityId: c.id, genId: g1.id } });
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    return { wx: wxy.x, wy: wxy.y, g1: g1.name, cid: c.id };
  });
  console.log('  造局：湖泊(' + init.wx + ',' + init.wy + ') 驻将=' + init.g1);
  /* 注：战斗段靶子另选（Lv8+ 且有守将的野地 × 1.5 倍兵力），见下文。 */

  /* ══ ① 地块界面「采集」区：开始采集 → 进度 → 收获 ══ */
  var v1 = await p.evaluate(function (xy) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openLandModal(xy.wx, xy.wy);
    var root = document.getElementById('modal-root');
    var html = root.innerHTML;
    var hasZone = html.indexOf('op-zone-t">采集') >= 0;
    var hasBtn = !!root.querySelector('[data-action="wild-garrison-gather"]');
    var hint = html.indexOf('原地开工') >= 0;
    if (hasBtn) root.querySelector('[data-action="wild-garrison-gather"]').click();
    return { hasZone: hasZone, hasBtn: hasBtn, hint: hint };
  }, init);
  await p.waitForTimeout(500);
  var v1b = await p.evaluate(function (xy) {
    var G = window.GAME;
    var rec = G.gatherAt(xy.wx, xy.wy);
    var w = G.map.wildAt(xy.wx, xy.wy);
    var gar = G.wildGarrisonTotal(w.garrison);
    /* 灌 8 小时 → 重开面板 → 收获键应亮 */
    if (rec) rec.elapsed = 8 * 3600;
    G.ui.openLandModal(xy.wx, xy.wy);
    var root = document.getElementById('modal-root');
    var fin = root.querySelector('[data-action="gather-finish"]');
    var html = root.innerHTML;
    var prog = html.indexOf('已采') >= 0 && html.indexOf('预计收成') >= 0;
    return { ok: !!rec && rec.inPlace === true, genId: rec ? rec.genId : null,
      garKeep: gar, prog: prog, finDown: fin ? fin.hasAttribute('disabled') : true, hasFin: !!fin };
  }, init);
  chk('① 地块界面含独立「采集」区（开始采集键 + 原地开工说明）',
    v1.hasZone && v1.hasBtn && v1.hint);
  chk('① 开始采集 = 原地开工（inPlace · 驻军不抽空）',
    v1b.ok && v1b.garKeep === 7000, 'genId=' + v1b.genId + ' 驻军=' + v1b.garKeep);
  chk('① 采集区显示进度 + 预计收成；满 1 小时后收获可用',
    v1b.prog && v1b.hasFin && !v1b.finDown);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89136-gather.png' });

  var v1c = await p.evaluate(function (xy) {
    var G = window.GAME;
    var resKey = G.gatherResOf('lake');
    var before = G.state.res[resKey] || 0;
    var root = document.getElementById('modal-root');
    var fin = root.querySelector('[data-action="gather-finish"]');
    if (fin) fin.click();
    return { resKey: resKey, before: before };
  }, init);
  await p.waitForTimeout(500);
  var v1d = await p.evaluate(function (arg) {
    var G = window.GAME;
    var w = G.map.wildAt(arg.xy.wx, arg.xy.wy);
    return { after: G.state.res[arg.rb.resKey] || 0, gone: !G.gatherAt(arg.xy.wx, arg.xy.wy),
      gar: G.wildGarrisonTotal(w.garrison) };
  }, { xy: init, rb: v1c });
  chk('① 收获：资源入账 + 采集队清空 + 驻军原样（不搬兵）',
    v1d.after > v1c.before && v1d.gone && v1d.gar === 7000,
    v1c.resKey + ' ' + v1c.before + ' → ' + v1d.after + ' · 驻军 ' + v1d.gar);

  /* ══ ② 将领面板三行同构（几何量测） ══ */
  var v2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var g = null;
    (G.state.generals || []).forEach(function (x) { if (!g && !G.isLordGeneral(x)) g = x; });
    var h = G.ui.genPane(g);
    var el = document.createElement('div');
    el.innerHTML = h;
    el.style.position = 'fixed'; el.style.left = '-9999px'; el.style.top = '0';
    /* ⚠️ 容器必须给足宽 —— genPane 是「左列 1/4」布局：容器 900 时左列仅 225px → 行折两行（假红）。
       1300px ≈ 真弹窗 xxl（左列 ~325px），与真机一致。 */
    el.style.width = '1300px';
    document.body.appendChild(el);
    /* 只取**三条目标行**（体力/精力/忠诚）——攻击/防御行不是本轮对象。 */
    var rows = [];
    el.querySelectorAll('.gd-line').forEach(function (r) {
      var t = r.textContent || '';
      if (t.indexOf('体力') === 0 || t.indexOf('精力') === 0 || t.indexOf('忠诚') === 0) rows.push(r);
    });
    var out = { n: rows.length, h: [], nw: [], bw: [], pr: [] };
    rows.forEach(function (r) {
      var num = r.querySelector('.gd-num');
      var bar = r.querySelector('.gd-bar');
      var plus = r.querySelector('.gd-plus');
      var rr = r.getBoundingClientRect();
      out.h.push(Math.round(rr.height));
      out.nw.push(num ? Math.round(num.getBoundingClientRect().width) : -1);
      out.bw.push(bar ? Math.round(bar.getBoundingClientRect().width) : -1);
      out.pr.push(plus ? Math.round(rr.right - plus.getBoundingClientRect().right) : -999);
    });
    document.body.removeChild(el);
    return out;
  });
  var oneLine = v2.n === 3 && v2.h.every(function (x) { return x > 0 && x <= 34; });
  var numEq = v2.n === 3 && v2.nw.every(function (x) { return x === v2.nw[0]; });
  var barEq = v2.n === 3 && v2.bw.every(function (x) { return x === v2.bw[0]; });
  var plusRight = v2.n === 3 && v2.pr.every(function (x) { return Math.abs(x - v2.pr[0]) <= 2 && x <= 3; });
  chk('② 体力/精力/忠诚 三行各单行（<34px）', oneLine, '行数 ' + v2.n + ' · 高 ' + v2.h.join('/'));
  chk('② 数值列定宽等宽（不随位数变）', numEq, '宽 ' + v2.nw.join('/'));
  chk('② 进度条等长', barEq, '宽 ' + v2.bw.join('/'));
  chk('② 加号贴最右（三条右缘一致 ≤3px）', plusRight, '右缘差 ' + v2.pr.join('/'));
  await p.evaluate(function () {
    var G = window.GAME;
    var g = null;
    (G.state.generals || []).forEach(function (x) { if (!g && !G.isLordGeneral(x)) g = x; });
    G.ui.setView('generals');
    G.ui._genSel = g.id;
    G.ui.renderView('generals');
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89136-pane3.png' });

  /* ══ ③ 战场：双方将领 / 白色我方片段 / 结束行进记录 ══ */
  var bt0 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var st = G.state, c = st.cities[0];
    st.settings.battleWatch = true;
    st.world.weather = 'clear';
    var g = G.makeGeneral('观战预备', 3, 'idle', c.id, false);
    st.generals.push(g);
    G.setStaNow(g, 1000); g.energy = 100;
    st.settings.battleSec = 600;
    /* v89.136 实机经验（§32.4 同源）：靶子要「**有守将** + 势均力敌」——
       ① Lv8+ 野地才有高概率守将（WILD_GEN_CHANCE），且 wildDefenseAt 是确定性函数 →
          脚本可**预判**（直接读 .gen）→ 挑"必有守将"的那个；
       ② 兵力 = 守军总量 × 1.5（拉锯 10+ 回合 → 才会产生"我方反击"片段）；
       ③ 守军规模大 → 城内先把兵补足。 */
    var t = null;
    for (var r = 1; r <= 30 && !t; r++) {
      for (var dy = -r; dy <= r && !t; dy++) for (var dx = -r; dx <= r && !t; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city' || G.map.wildAt(x, y)) continue;
        var lvN = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : 0;
        if (lvN < 8) continue;
        var dN = G.wildDefenseAt(x, y, lvN);
        if (dN.gen) { t = { x: x, y: y, lv: lvN, total: dN.total }; break; }
      }
    }
    if (!t) return { ok: false, why: '无「Lv8+ 且有守将」的野地' };
    var armyN = Math.max(100, Math.round(t.total * 1.5));
    c.army.yibing = Math.max(c.army.yibing || 0, armyN * 2);
    var army = G.autoPickTroops(armyN, c);
    var r2 = G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'raid', army, g.id);
    var rec = (st.battles || [])[0] || null;
    return { ok: !!rec, id: rec ? rec.id : null, lv: t.lv, total: t.total,
      msg: (r2 && r2.msg) || '' };
  });
  if (!bt0.ok) { chk('③ 战场造局（挂起观战）', false, bt0.why || '未找到靶子'); }
  else {
    await p.evaluate(function (id) { window.GAME.ui.openBattlefield(id); }, bt0.id);
    await p.waitForTimeout(600);
    var v3a = await p.evaluate(function () {
      var G = window.GAME;
      var board = document.getElementById('modal-root');
      var gens = board.querySelectorAll('.bt-gen');
      var txt = [], tips = [];
      gens.forEach(function (e) { txt.push(e.textContent.trim()); tips.push(e.getAttribute('title') || ''); });
      return { n: gens.length, txt: txt.join(' ~ '), tip: tips.join(' # ') };
    });
    chk('③ 战场双方将领行（各一 · 悬停含六维：统率/勇武/…）',
      v3a.n === 2 && /统率/.test(v3a.tip) && /勇武/.test(v3a.tip),
      (v3a.txt + ' · tip[' + v3a.tip.replace(/\n/g, ' ').slice(0, 66) + ']'));
    /* 自动战斗跑完 */
    await p.evaluate(function () {
      var el = document.querySelector('#modal-root [data-action="bt-auto"]');
      if (el) el.click();
    });
    await p.waitForTimeout(24000);   /* 大兵力拉锯：回合多，给足结算时间 */
    var v3b = await p.evaluate(function () {
      var log = document.getElementById('bt-log');
      var html = log ? log.innerHTML : '';
      var txt = log ? (log.textContent || '') : '';
      var plain = txt.replace(/\u0001|\u0002/g, '');
      return { hasMe: html.indexOf('class="bt-me"') >= 0,
        meTxt: /我方\S+反击/.test(plain),
        kill: txt.indexOf('歼') >= 0,
        endLine: txt.indexOf('🏁 战斗结束') >= 0,
        endPanel: document.getElementById('modal-root').innerHTML.indexOf('战场 · 战果') >= 0,
        rounds: (html.match(/回合/g) || []).length };
    });
    console.log('    ③ 详情：回合块 ' + v3b.rounds + ' · 有歼伤 ' + v3b.kill
      + ' · bt-me=' + v3b.hasMe + ' · 我方反击=' + v3b.meTxt);
    chk('③ 我方反击片段 = 白色（span.bt-me）· 文案「我方…反击」',
      v3b.hasMe && v3b.meTxt, 'bt-me=' + v3b.hasMe + ' 我方反击=' + v3b.meTxt);
    chk('③ 结束行进播报窗（🏁）· 无战果弹窗', v3b.endLine && !v3b.endPanel);
    await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89136-bt.png' });
  }

  /* ══ ④ 出征战术细分（两小页 + 练兵退役） ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._marchTab = 'exp';
    G.ui.setView('marches');
  });
  await p.waitForTimeout(500);
  var v4 = await p.evaluate(function () {
    var G = window.GAME;
    var vc = document.getElementById('view-container');
    var html = vc.innerHTML;
    var tabs = html.indexOf('data-action="exp-tac-sub"') >= 0
      && html.indexOf('🚩 占领战术') >= 0 && html.indexOf('🔥 掠夺战术') >= 0;
    var noTrain = html.indexOf('练兵') < 0 && html.indexOf('xc-spar') < 0;
    var cur0 = G.ui._expTac;
    var el = vc.querySelector('[data-action="exp-tac-sub"][data-v="raid"]');
    if (el) el.click();
    return { tabs: tabs, noTrain: noTrain, cur0: cur0 || 'occupy' };
  });
  await p.waitForTimeout(500);
  var v4b = await p.evaluate(function () {
    var G = window.GAME;
    var vc = document.getElementById('view-container');
    return { cur: G.ui._expTac,
      raidOn: vc.querySelector('[data-action="exp-tac-sub"][data-v="raid"]').className.indexOf('on') >= 0
        ? true : /class="dt on"[^>]*data-v="raid"|data-v="raid"[^>]*class="dt on"/.test(vc.innerHTML) };
  });
  chk('④ 出征战术两小页（掠夺/占领）· 练兵块已退役', v4.tabs && v4.noTrain);
  chk('④ 真点「掠夺战术」小页 → 切换生效', v4b.cur === 'raid' && v4b.raidOn,
    'cur=' + v4b.cur + ' on=' + v4b.raidOn);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89136-tac.png' });

  chk('全程零 JS 错误', errs.length === 0, errs.slice(0, 2).join(' | ') || '—');

  console.log(FAIL ? '\n⛔ ' + FAIL + ' 项未达标' : '\n✅ 实机全项达标');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('脚本异常', e); process.exit(2); });
