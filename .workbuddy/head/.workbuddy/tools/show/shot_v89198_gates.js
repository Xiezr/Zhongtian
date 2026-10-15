/* v89.198 实机验收：① 出征面板（战法全撤 + 备注四项） ② 管理弹窗（统一行） */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
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
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'x', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { changqiang: 5000, gongbing: 3000 };
    G.state.items.jinang = (G.state.items.jinang || 0) + 5;
    G.ui.enterGame(); G.ui.closeAllModals();
  });
  await new Promise(function (r) { setTimeout(r, 400); });

  /* ── ① 出征面板 ── */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var t = null;
    for (var y = 0; y < 240 && !t; y++) {
      for (var x = 0; x < 240 && !t; x++) {
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        var wl = G.map.wildLevelNow(x, y);
        if (wl > 0 && wl <= 5) t = { kind: 'wild', x: x, y: y };
      }
    }
    window.__t198 = t || { kind: 'wild', x: c.x + 3, y: c.y + 2 };
    G.ui.openExpModal(window.__t198);
    return { t: t };
  });
  await new Promise(function (r) { setTimeout(r, 700); });
  var d1 = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel') || document.body;
    var txt = panel.textContent || '';
    var vital = panel.querySelector('#exp-gen-vital');
    var genSec = panel.querySelector('.exp-a-gen');
    var tgt = panel.querySelector('.exp-a-target');
    var labs = Array.prototype.map.call(panel.querySelectorAll('.exp-lab'), function (x) { return x.textContent.trim(); });
    var over = panel.scrollHeight - panel.clientHeight;
    return {
      noOps: !panel.querySelector('#exp-ops'),
      noZhenwei: txt.indexOf('阵位 ') < 0,
      noJinang: txt.indexOf('锦囊 ×') < 0,
      vital: vital ? vital.textContent.trim() : null,
      inGen: !!(vital && genSec && genSec.contains(vital)),
      recInTgt: !!(tgt && /相称建议/.test(tgt.textContent)),
      labs: labs, over: over,
    };
  });
  chk('① 战法行退役 · 阵位/锦囊备注退役',
    d1.noOps && d1.noZhenwei && d1.noJinang,
    'noOps=' + d1.noOps + ' noZhenwei=' + d1.noZhenwei + ' noJinang=' + d1.noJinang);
  chk('① 主将栏「精力/体力」（真填充）· 选定主将后显示', !!d1.vital && /精力/.test(d1.vital) && /体力/.test(d1.vital) && d1.inGen,
    d1.vital);
  chk('① 目标栏「相称建议」在册', d1.recInTgt, '');
  chk('① 7 个名称列（无战法）', d1.labs.length === 7 && d1.labs.indexOf('战法') < 0, d1.labs.join(','));
  chk('① 出征弹窗无滚动溢出', d1.over <= 0, 'over=' + d1.over);
  await p.screenshot({ path: E + 'v89198-exp.png' });

  /* ── ② 管理弹窗（自动出征·详细配置）── */
  await p.evaluate(function () { window.GAME.ui.openAutoMarch(); });
  await new Promise(function (r) { setTimeout(r, 600); });
  var d2 = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel') || document.body;
    var txt = panel.textContent || '';
    var labs = Array.prototype.map.call(panel.querySelectorAll('.exp-lab'), function (x) { return x.textContent.trim(); });
    var sels = Array.prototype.map.call(panel.querySelectorAll('.exp-row > select'), function (s) {
      var r = s.getBoundingClientRect();
      return Math.round(r.left);
    });
    var uniq = {}; sels.forEach(function (v) { uniq[v] = 1; });
    var over = panel.scrollHeight - panel.clientHeight;
    return {
      labs: labs, selLefts: sels, uniq: Object.keys(uniq).length,
      noZhenwei: txt.indexOf('阵位 ') < 0,
      hasSet: !!panel.querySelector('[data-action="open-tactic-set"]'),
      over: over, nSel: sels.length,
    };
  });
  var need = ['执行将领', '目标类型', '目标等级', '搜索距离', '出征方式', '计略', '出征战术', '出征频率', '每日上限'];
  chk('② 统一行：9 个名称列齐备', need.every(function (n) { return d2.labs.indexOf(n) >= 0; }) && d2.labs.length === 9,
    d2.labs.join(','));
  chk('② 跨行下拉左缘全等（去重 = 1 · ' + d2.nSel + ' 个下拉）', d2.uniq === 1, 'lefts=' + d2.selLefts.join(','));
  chk('② 无阵位行 · 出征战术行含「设置」链', d2.noZhenwei && d2.hasSet, '');
  chk('② 管理弹窗无滚动溢出', d2.over <= 0, 'over=' + d2.over);
  await p.screenshot({ path: E + 'v89198-ammodal.png' });

  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
