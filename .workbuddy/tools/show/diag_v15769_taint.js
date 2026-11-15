'use strict';
/* v157.69 实机取证（真浏览器 · 不出图）：那条「污染到了变质线 / 棚户死人」军情确实不再发射。
 * 三层判据（防平凡解）：
 *   ① 检测器自检：先注入一条旧文案 → 必须命中 1 条（证明不是在空流上数 0）；
 *   ② 移除该注入 → 真跑 6 个月月结 → 命中 0 条；
 *   ③ 消息流确实可写（对照消息在流里）+ 污染账确实推进 + 棚户 / 村社零变化。
 * 用法：node diag_v15769_taint.js
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var path = require('path');
var ROOT = 'E:/Deepseekdb';
var LOG = path.join(ROOT, '.workbuddy/tmp/diag_v15769_taint.log');
fs.writeFileSync(LOG, '');
function log(s) { fs.appendFileSync(LOG, String(s) + '\n'); console.log(s); }

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', function (e) { log('EXC ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') log('PAGE-ERR ' + m.text()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && GAME.taint', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '取证', cityName: '灰岗', region: '碎垣', mapSeed: 20261115, portraitSeed: 8 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await p.waitForFunction(function () {
    var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on');
  }, null, { timeout: 90000 });

  var r = await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    var KEY = '到了变质线';
    function hits() {
      return G.msgLog().filter(function (x) {
        return String(x.msg || '').indexOf(KEY) >= 0 || String(x.msg || '').indexOf('没能撑过这个月') >= 0;
      }).length;
    }

    /* ① 检测器自检：注入旧文案（war 类 = 旧发射点的真实类别），必须命中 */
    var OLD = '☢ 星球 4·前哨城外的污染到了变质线，棚户里 130 个人没能撑过这个月。';
    G.log(OLD, 'war');
    var selfCheck = hits();
    var arr = G.msgLog();
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i].msg === OLD) { arr.splice(i, 1); break; }
    }
    var afterRemove = hits();

    /* ② 真跑 6 个月月结（与 smoke §586k 同口径：污染恒在变质线以上） */
    var c = (st.cities || [])[0];
    if (!c) return { err: '无城池' };
    c.taint = 3000; c.shanty = 260;
    st.taintMonth = null;
    var t0 = c.taint, sh0 = c.shanty, rets = [];
    for (var m = 0; m < 6; m++) {
      st.world.elapsed = m * 4800;
      rets.push(G.taint.tick());
    }
    G.log('v157.69 取证对照消息', 'sys');

    var msgs = G.msgLog().map(function (x) { return String(x.msg || ''); });
    return {
      version: G.VERSION,
      taintKeys: Object.keys(G.DATA.TAINT),
      surgeVillageLoss: G.DATA.SURGE && G.DATA.SURGE.villageLoss,
      selfCheck: selfCheck,
      afterRemove: afterRemove,
      hitsAfter6Months: hits(),
      msgCount: msgs.length,
      hasProbe: msgs.indexOf('v157.69 取证对照消息') >= 0,
      taintFrom: t0,
      taintTo: c.taint,
      shantyFrom: sh0,
      shantyTo: c.shanty,
      ticks: rets.map(function (x) { return x ? (x.first ? 'first' : 'month') : 'null'; }).join(','),
      mutMul: G.taint.mutMulOf(c)
    };
  });

  log(JSON.stringify(r, null, 2));
  /* 实机口径（先量后定 · §89.3）：首城建筑等级和与 smoke 的 vm 桩不同，
   * deltaOf = lvlSum×0.08 − 3.2 → 实测每月 −0.92，6 次月结共 −4.6。
   * 判据取「确实下降 ≥1」+「6 次 tick 全返回非 null」，不照抄 vm 桩的 −10；
   * 下限 + tick 形态 + 检测器自检三条一起防「什么都没跑」的平凡解。 */
  var pass = !r.err
    && r.selfCheck === 1 && r.afterRemove === 0 && r.hitsAfter6Months === 0
    && r.hasProbe === true && r.msgCount >= 1
    && r.taintTo < r.taintFrom - 1 && r.shantyTo === r.shantyFrom
    && r.ticks === 'first,month,month,month,month,month'
    && r.taintKeys.indexOf('shantyLossAt') < 0 && r.taintKeys.indexOf('villageLoss') < 0
    && r.surgeVillageLoss === 0.05 && r.mutMul < 1
    && String(r.version) === 'v157.69';
  log('REAL_BROWSER_PASS=' + pass);
  await b.close();
  process.exit(pass ? 0 : 1);
})().catch(function (e) {
  log('FATAL ' + (e && e.stack || e));
  process.exit(1);
});
