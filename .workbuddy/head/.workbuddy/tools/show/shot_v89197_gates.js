/* v89.197 实机验收：
   ① 出征面板统一行：名称列等宽（.exp-lab 布局宽一致 · 各行 select 左缘对齐）
   ② 战法 chips 三态：强攻 on / 奇袭 off（无计略）/ 围困可点（据点目标）
   ③ 悬停浮层：#tip-layer 显示战法说明（与全站同规格）
   ④ 军师估算计入战法：点围困 → 守军数字变低 + "战法/计略已计入"提示行
   ⑤ 截图：面板全窗 / 战法行特写 / 悬停画面 */
var E = 'E:/Deepseekdb/.workbuddy/shots/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  var fails = 0;
  function chk(tag, ok, extra) {
    console.log((ok ? '✅ ' : '❌ ') + tag + (extra ? '  [' + extra + ']' : ''));
    if (!ok) fails++;
    return ok;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* 建局 + 找一个低等级据点作为目标 */
  var fortInfo = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验收客', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    G.state.world.weather = 'clear';
    if (!G.state.map.grid) G.map.generate();
    G.goldAdd(5000000 - G.goldOf());
    var c = G.state.cities[0];
    c.army = { qingji: 50000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    var ft = null;
    for (var y = 0; y < 200 && !ft; y++) {
      for (var x = 0; x < 200 && !ft; x++) {
        var f = G.map.fortAt(x, y);
        if (f && f.level <= 4) ft = { x: x, y: y, name: f.name, lv: f.level };
      }
    }
    return ft;
  });
  if (!fortInfo) { console.log('无据点，退出'); await b.close(); process.exit(1); }
  console.log('目标据点：' + fortInfo.name + ' Lv' + fortInfo.lv + ' @' + fortInfo.x + ',' + fortInfo.y);

  /* 开出征面板（据点目标 → 围困可用、奇袭无计略置灰） */
  await p.evaluate(function (ft) {
    var G = window.GAME;
    G.ui.openExpModal({ kind: 'fort', x: ft.x, y: ft.y });
  }, fortInfo);
  await sleep(420);

  /* ① 统一行：名称列等宽 + select 左缘对齐 */
  var r1 = await p.evaluate(function () {
    var labs = document.querySelectorAll('#modal-root .exp-lab');
    var sels = document.querySelectorAll('#modal-root .exp-row > select');
    var w = [], sx = [], names = [];
    Array.prototype.forEach.call(labs, function (x) { w.push(x.offsetWidth); names.push(x.textContent.trim()); });
    Array.prototype.forEach.call(sels, function (x) { sx.push(Math.round(x.getBoundingClientRect().left)); });
    var uniqW = {}, uniqX = {};
    w.forEach(function (v) { uniqW[v] = 1; });
    sx.forEach(function (v) { uniqX[v] = 1; });
    return { names: names, wUniq: Object.keys(uniqW), xUniq: Object.keys(uniqX), n: labs.length, nSel: sels.length };
  });
  chk('① 出征统一行：' + r1.n + ' 个名称列（' + r1.names.join('/') + '）· 名称宽一致=' + r1.wUniq.join('|')
    + ' · 下拉左缘一致=' + r1.xUniq.join('|'), r1.n >= 8 && r1.wUniq.length === 1 && r1.xUniq.length === 1
    && r1.nSel >= 7, JSON.stringify(r1));
  await p.screenshot({ path: E + 'v89197-exp-panel.png' });

  /* ② 战法 chips 三态（强攻 on / 奇袭 off · 据点目标下围困可点） */
  var r2 = await p.evaluate(function () {
    var chips = document.querySelectorAll('#modal-root #exp-ops .chip');
    var out = [];
    Array.prototype.forEach.call(chips, function (c) {
      out.push(c.textContent.trim() + ':' + (c.classList.contains('on') ? 'on' : (c.classList.contains('off') ? 'off' : '可')));
    });
    return out.join(' ');
  });
  chk('② 战法 chips 三态（强攻 on / 围困 可 / 奇袭 off）', /强攻:on/.test(r2) && /奇袭:off/.test(r2) && /围困:可/.test(r2), r2);

  /* ③ 悬停战法名称 → #tip-layer 显示说明 */
  var opsLabBox = await p.evaluate(function () {
    var labs = document.querySelectorAll('#modal-root .exp-lab');
    for (var i = 0; i < labs.length; i++) {
      if (labs[i].textContent.trim() === '战法') {
        var r = labs[i].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  });
  if (opsLabBox) {
    await p.mouse.move(opsLabBox.x, opsLabBox.y);
    await sleep(500);
  }
  var r3 = await p.evaluate(function () {
    var t = document.getElementById('tip-layer');
    return { on: !!t && t.classList.contains('on'), txt: (t && t.textContent || '').slice(0, 60) };
  });
  chk('③ 悬停浮层：#tip-layer 显示战法说明', r3.on && r3.txt.indexOf('正面决战') >= 0, r3.txt);
  await p.screenshot({ path: E + 'v89197-hover-tip.png' });
  await p.mouse.move(10, 10);
  await sleep(200);

  /* ④ 军师估算计入战法：填兵力（先给数据再开面板的教训——此处面板已开，补填+重算）
     点围困 → 守军数字变低 + 提示行 */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var inp = document.getElementById('exp-qingji');
    if (inp) inp.value = '4000';
    if (G.ui.updateExpMarch) G.ui.updateExpMarch();
    var powEl = document.getElementById('exp-power');
    var before = powEl ? powEl.textContent : '';
    var m0 = /守军 约 ([\d,]+)/.exec(before);
    var chip = document.querySelector('#modal-root [data-action="exp-ops"][data-v="encircle"]');
    if (chip) chip.click();
    var after = (document.getElementById('exp-power') || {}).textContent || '';
    var m1 = /守军 约 ([\d,]+)/.exec(after);
    var n0 = m0 ? Number(m0[1].replace(/,/g, '')) : -1;
    var n1 = m1 ? Number(m1[1].replace(/,/g, '')) : -1;
    return { n0: n0, n1: n1, hasNote: after.indexOf('战法/计略已计入：围困 −12%') >= 0,
      tail: after.slice(-90) };
  });
  chk('④ 军师估算计入围困：守军 ' + r4.n0 + ' → ' + r4.n1 + '（应 ≈×0.88）+ 提示行',
    r4.n0 > 0 && r4.n1 > 0 && r4.n1 < r4.n0 && r4.hasNote, JSON.stringify(r4.tail));
  await p.screenshot({ path: E + 'v89197-est-encircle.png' });

  /* ④b 战法行特写（元素截图：chips + 名称） */
  try {
    await p.locator('#modal-root #exp-ops').first().screenshot({ path: E + 'v89197-ops-chips.png' });
    console.log('  （战法行特写已出图）');
  } catch (e) { console.log('  战法行特写失败：' + e.message); }

  console.log(fails ? ('\n实机验收：' + fails + ' 项失败') : '\n实机验收：全部通过');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
