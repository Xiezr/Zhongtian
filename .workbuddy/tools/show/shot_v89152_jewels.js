'use strict';
/* v89.152 实机验证（真浏览器）：未占野地产出行 4 行 / 无备注行 / 三键落底 · 已占无产出。
   跑法：node .workbuddy/tools/show/shot_v89152_jewels.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 找一块**可采地形**格（先看未占态，再加记录看已占态 —— 同一地块两态对照） */
    var RESOK = G.DATA.GATHER.resOf || {};
    var free = null;
    for (var rr = 2; rr <= 16 && !free; rr++) {
      for (var dy = -rr; dy <= rr && !free; dy++) for (var dx = -rr; dx <= rr && !free; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || !RESOK[tl.terrain]) continue;
        if (G.map.npcAt && G.map.npcAt(x, y)) continue;
        if (G.map.wildAt(x, y)) continue;
        free = { x: x, y: y, t: tl.terrain };
      }
    }
    return { free: free, own: null };
  });
  await p.waitForTimeout(600);
  console.log('seed: free=' + JSON.stringify(init.free));

  /* ---------- ① 未占野地：产出行 4 行 + 无备注 + 三键落底 ---------- */
  console.log('===== ① 未占野地面板（产出分行 · 无备注 · 三键底部） =====');
  var r1 = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openLandModal(o.free.x, o.free.y);
    var seg = document.querySelector('#modal-root').innerHTML;
    var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    var rows = {};
    ['资源', '产量加成', '材料', '珠宝'].forEach(function (k) { rows[k] = seg.indexOf('>' + k + '<') >= 0; });
    /* 三键位置（渲染顺序） */
    var iScout = seg.lastIndexOf('data-mode="scout"');
    var iOcc = seg.lastIndexOf('data-mode="occupy"');
    var iProd = seg.lastIndexOf('op-zone-t">产出');
    /* 产出行文本（供人眼核对） */
    var box = seg.match(/<div class="op-zone op-zone-eq"><div class="op-zone-t">产出<\/div>[\s\S]*?<\/div><\/div>/);
    return {
      rows: rows,
      noHint: seg.indexOf('打下来后军队就地驻守') < 0 && seg.indexOf('Lv0 无驻军位') < 0,
      noOldNote: seg.indexOf('此地可采') < 0,
      btnText: seg.indexOf('data-mode="occupy">🚩 占领</button>') >= 0,
      noOldBtn: seg.indexOf('data-mode="occupy">🚩 占领并驻守') < 0,
      btnBottom: iScout > iProd && iOcc > iProd,
      overflow: panel ? panel.scrollHeight - panel.clientHeight : -1,
      prodText: (box ? box[0] : '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    };
  }, init);
  chk('产出行 4 行齐备', r1.rows['资源'] && r1.rows['产量加成'] && r1.rows['材料'] && r1.rows['珠宝']);
  chk('无「占领/掠夺」备注行 · 无旧「此地可采」', r1.noHint && r1.noOldNote);
  chk('按钮文案「🚩 占领」（不带"并驻守"）', r1.btnText && r1.noOldBtn);
  chk('三键在产出区之后（落底）', r1.btnBottom);
  chk('弹窗无溢出（不滚）', r1.overflow <= 0, 'overflow=' + r1.overflow);
  console.log('    产出区: ' + r1.prodText);
  await p.locator('#modal-root .inner-panel').screenshot({ path: OUT + 'v89152-land-unowned.png' });

  /* ---------- ② 已占野地：不显示产出行（把 ① 的地块"占下来"再看） ---------- */
  console.log('===== ② 已占野地面板（无产出） =====');
  var r2 = await p.evaluate(function (o) {
    var G = window.GAME;
    var st = G.state;
    /* 给该地块补"已占"记录（真实数据形状：st.wilds 记录即"我方野地"） */
    st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === o.free.x && z.y === o.free.y); });
    st.wilds.push({ x: o.free.x, y: o.free.y, type: o.free.t, level: 8, day: 0, startDay: 0 });
    var w = G.map.wildAt(o.free.x, o.free.y);
    if (!w) return { err: 'wildAt null after push', len: st.wilds.length, o: o };
    G.ui.closeAllModals();
    G.ui.openLandModal(o.free.x, o.free.y);
    var seg = document.querySelector('#modal-root').innerHTML;
    var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    var res = {
      noProd: seg.indexOf('op-zone-t">产出') < 0 && seg.indexOf('>产量加成<') < 0
        && seg.indexOf('>材料<') < 0 && seg.indexOf('>珠宝<') < 0,
      noOldNote: seg.indexOf('此地可采') < 0,
      hasZones: seg.indexOf('op-zone-t">驻军') >= 0 && seg.indexOf('op-zone-t">地块操作') >= 0
        && seg.indexOf('op-zone-t">危险操作') >= 0,
      overflow: panel ? panel.scrollHeight - panel.clientHeight : -1
    };
    /* 还原（不动后续用例口径） */
    st.wilds = st.wilds.filter(function (z) { return !(z.x === o.free.x && z.y === o.free.y); });
    return res;
  }, init);
  if (r2.err) { console.log('  ❌ ' + r2.err + ' len=' + r2.len + ' o=' + JSON.stringify(r2.o)); }
  chk('已占：无产出行 4 行 · 无「此地可采」', !!r2.noProd && !!r2.noOldNote);
  chk('已占：驻军/地块操作/危险操作三区仍在', !!r2.hasZones);
  chk('已占：弹窗无溢出', r2.overflow <= 0, 'overflow=' + r2.overflow);
  await p.locator('#modal-root .inner-panel').screenshot({ path: OUT + 'v89152-land-owned.png' });

  chk('无页面报错', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log('\n===== ' + PASS + ' pass / ' + FAIL + ' fail =====');
  process.exit(FAIL ? 1 : 0);
})();
