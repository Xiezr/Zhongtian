/* ============================================================
 * probe_v89120b_sim_behavior.js — 「推演：兵种实际行为与设定不符」实证探针
 * ------------------------------------------------------------
 * 老板原话：「战场推演也有，兵种实际行为和设定不一样」
 * 取证四条：
 *   ① 回放态改设定（sd-stance）→ sim 是否吃到？画面是否跟着变？
 *   ② 推演态改设定 → sim.cmds 是否落库、sd.cur 是否即时反馈？
 *   ③ 推演态点「完成回合」→ 引擎是否真按设定走（adv 单调性）
 *   ④ 单位 id 口径：sd.cur 的 id 与引擎 list[i].id 是否同源
 * 用法：node .workbuddy/tools/probe/probe_v89120b_sim_behavior.js
 * ============================================================ */
'use strict';
var path = require('path');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push(String(e && e.message).slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局 + 真打一场（多回合才有推演空间） */
  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '演', cityName: '许都' });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame && G.ui.enterGame();
    G.ui.closeAllModals();
    var c = G.currentCity();
    /* 选 L5~L7 野地（守军够强 → 多回合） */
    var tgt = null, CMAX = G.COORD_MAX || 499, bestLv = 0;
    for (var dx = -10; dx <= 10; dx++) {
      for (var dy = -10; dy <= 10; dy++) {
        if (!dx && !dy) continue;
        var xx = c.x + dx, yy = c.y + dy;
        if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
        if (lv >= 5 && lv <= 7 && lv > bestLv) { bestLv = lv; tgt = { x: xx, y: yy, lv: lv }; }
      }
    }
    if (!tgt) {
      for (var dx2 = -10; dx2 <= 10 && !tgt; dx2++) for (var dy2 = -10; dy2 <= 10 && !tgt; dy2++) {
        if (!dx2 && !dy2) continue;
        var x2 = c.x + dx2, y2 = c.y + dy2;
        if (x2 < 0 || y2 < 0 || x2 > CMAX || y2 > CMAX) continue;
        var t2 = G.map.tile(x2, y2);
        if (t2 && t2.terrain !== 'city') tgt = { x: x2, y: y2, lv: G.map.wildLevelNow(x2, y2) };
      }
    }
    if (!tgt) return { err: 'no wild' };
    c.army = { yibing: 4000, changqiang: 2000, gongjian: 1200, qingji: 600 };
    var g = (st.generals || []).filter(function (x) { return !x.status || x.status === 'idle'; })[0];
    if (!g) return { err: 'no gen' };
    g.cityId = c.id; g.status = 'idle';
    if (G.setStaNow) G.setStaNow(g, 200); g.energy = 200;
    st.settings = st.settings || {}; st.settings.battleWatch = false;
    var d = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, name: '演武场', lv: tgt.lv },
      'raid', JSON.parse(JSON.stringify(c.army)), g.id, null, null, null);
    if (!d || d.ok === false) return { err: 'dispatch:' + ((d && d.msg) || '-') };
    (st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
    G.march.tick();
    var ri = -1;
    (st.reports || []).forEach(function (r, i) { if (ri < 0 && r.type !== 'scout') ri = i; });
    return { ri: ri, wild: tgt, rounds: ri >= 0 ? ((st.reports[ri].scene || {}).rounds || 0) : -1 };
  });
  if (boot.err) { console.log('⛔ 建局失败：' + boot.err); await browser.close(); process.exit(1); }
  console.log('建局：掠报 i=' + boot.ri + ' 史实回合数=' + boot.rounds + ' 靶 Lv' + boot.wild.lv);

  /* 打开沙盘 */
  await page.evaluate(function (i) { window.GAME.ui.openSandbox(i); }, boot.ri);
  await new Promise(function (r) { setTimeout(r, 600); });

  var base = await page.evaluate(function () {
    var G = window.GAME, sd = G.ui._sd, sb = sd.sb;
    return {
      verify: !!sb.verify, mode: sd.mode, hasSim: !!sd.sim,
      ourSide: G.ui.sdOurSide(sb),
      atk: sd.cur.atk.map(function (u) { return u.id + ':' + u.stance + ':' + Math.round(u.adv) + ':' + u.count; }),
      def: sd.cur.def.map(function (u) { return u.id + ':' + u.stance + ':' + Math.round(u.adv) + ':' + u.count; }),
      footBtns: (function () {
        var out = [];
        document.querySelectorAll('#sd-wrap [data-action]').forEach(function (e) {
          var a = e.getAttribute('data-action');
          if (/sd-/.test(a) && /done|sim|next|play|first/.test(a)) {
            out.push(a + (e.disabled ? '(禁)' : '') + ' 「' + (e.textContent || '').trim().slice(0, 12) + '」');
          }
        });
        return out;
      })(),
    };
  });
  console.log('\n===== 沙盘初始 =====');
  console.log('  verify=' + base.verify + ' mode=' + base.mode + ' 我方侧=' + base.ourSide);
  console.log('  我军：' + base.atk.join('　'));
  console.log('  敌军：' + base.def.join('　'));
  console.log('  帧控按钮：' + base.footBtns.join('　'));

  /* ---------- 测试 1：回放态改设定 ---------- */
  console.log('\n===== 测试 1：回放态（replay）改设定 =====');
  var t1 = await page.evaluate(function () {
    var G = window.GAME, sd = G.ui._sd;
    var mySide = G.ui.sdOurSide(sd.sb);
    var myUnits = (mySide === 'atk' ? sd.cur.atk : sd.cur.def);
    var u0 = myUnits[0];
    var before = u0.stance;
    G.ui.sdSetCmd(u0.id, { s: 'hold' });       /* 界面下拉改「驻守」的动作走这里 */
    var after = u0.stance;
    return { id: u0.id, before: before, after: after, hasSim: !!sd.sim,
      cmdsWritten: sd.sim ? Object.keys(sd.sim.cmds).join(',') : '(无 sim)' };
  });
  console.log('  改 ' + t1.id + '：' + t1.before + ' → ' + t1.after
    + '（sim=' + t1.hasSim + '，cmds=' + t1.cmdsWritten + '）');
  console.log('  判读：after 没变成 hold ⇒ 回放态改设定**静默失效**（下拉框却显示了新值）');

  /* ---------- 进入推演 ---------- */
  await page.evaluate(function () { window.GAME.ui.sdSimEnter(); });
  await new Promise(function (r) { setTimeout(r, 400); });
  var t2a = await page.evaluate(function () {
    var G = window.GAME, sd = G.ui._sd;
    return { mode: sd.mode, hasSim: !!sd.sim,
      our: (G.ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def)
        .map(function (u) { return u.id + ':' + u.stance + ':' + Math.round(u.adv); }) };
  });
  console.log('\n===== 进入推演（sd-sim）=====');
  console.log('  mode=' + t2a.mode + ' sim=' + t2a.hasSim + ' 我军：' + t2a.our.join('　'));

  /* ---------- 测试 2：推演态改设定 + 完成回合 ---------- */
  console.log('\n===== 测试 2：推演态改设定 → 完成回合 =====');
  var t2 = await page.evaluate(function () {
    var G = window.GAME, sd = G.ui._sd;
    var mySide = G.ui.sdOurSide(sd.sb);
    var myUnits = (mySide === 'atk' ? sd.cur.atk : sd.cur.def);
    var u0 = myUnits[0], u1 = myUnits[1] || u0;
    var rec = { id: u0.id, bef: { s: u0.stance, adv: Math.round(u0.adv) } };
    G.ui.sdSetCmd(u0.id, { s: 'hold' });
    rec.aftSet = { s: u0.stance };
    rec.cmds = JSON.parse(JSON.stringify(sd.sim.cmds));
    rec.other = { id: u1.id, bef: Math.round(u1.adv) };
    /* 点「完成回合」（sd-done） */
    var btn = document.querySelector('#sd-wrap [data-action="sd-done"]');
    rec.hasDoneBtn = !!btn && !btn.disabled;
    if (btn && !btn.disabled) btn.click();
    return rec;
  });
  await new Promise(function (r) { setTimeout(r, 500); });
  var t2b = await page.evaluate(function (o) {
    var G = window.GAME, sd = G.ui._sd;
    var mySide = G.ui.sdOurSide(sd.sb);
    var list = (mySide === 'atk' ? sd.cur.atk : sd.cur.def);
    var u = null, uo = null;
    list.forEach(function (x) {
      if (x.id === o.holdId) u = x;
      if (x.id === o.otherId) uo = x;
    });
    /* 新帧里该兵种有没有 move 事件 */
    var sim = sd.sim || {};
    var lastFrames = (sim.frames || []).slice(-8).map(function (f) { return f.join('/'); });
    return {
      after: u ? { s: u.stance, adv: Math.round(u.adv), count: u.count } : null,
      other: uo ? { adv: Math.round(uo.adv) } : null,
      round: sd.cur.round, nFrames: (sim.frames || []).length,
      lastFrames: lastFrames, over: !!sim.over,
    };
  }, { holdId: t2.id, otherId: t2.other.id });
  console.log('  设定：' + t2.id + ' 动作 ' + t2.bef.s + ' → hold（sd.cur 即时反馈=' + t2.aftSet.s + '）');
  console.log('  sim.cmds = ' + JSON.stringify(t2.cmds));
  console.log('  完成回合：按钮在册=' + t2.hasDoneBtn);
  console.log('  回合后：' + t2.id + ' → 动作 ' + (t2b.after ? t2b.after.s : '?')
    + '，adv ' + t2.bef.adv + ' → ' + (t2b.after ? t2b.after.adv : '?')
    + '（对比 ' + t2.other.id + ' adv ' + t2.other.bef + ' → ' + (t2b.other ? t2b.other.adv : '?') + '）');
  console.log('  回合 ' + t2b.round + '，帧总数 ' + t2b.nFrames + '，末帧：' + t2b.lastFrames.join('　'));
  console.log('  判读：hold 兵的 adv 若**没变**且没有 m 帧 ⇒ 设定生效；若 adv 增加 ⇒ 设定没生效');

  console.log('\n页面错误：' + (errs.length ? errs.join(' | ') : '无'));
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
