/* v89.162 实机验证（真浏览器）：
   ① 将领详情六维表：内政行悬停含「税收 +X%」（城主在任 · 真渲染 title）+ 图 v89162-gen-dims.png
   ② 城池面板：城主行悬停给全部加成（内政→产量/建造/税收 · 智谋→研究/城防）+ 图 v89162-city-mayor.png
   ③ 侧栏黄金悬停：产量分解含「城主内政」行（tip 层真渲染）+ 图 v89162-gold-tip.png
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89162_mayor.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验162', cityName: '许都', region: '碎垣', mapSeed: 20260962 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.currentCity();
    G.state.generals.forEach(function (g) { g.status = 'idle'; g.cityId = null; });
    G.state.rank = 6;                          /* 爵位 6 级 → 税制 +6% + 俸禄（让分账行齐全） */
    var g = G.state.generals[0];
    g.nz = 600; g.zm = 300;                    /* 内政封顶 +150% · 智谋 300 → +100% */
    var r = G.assignGeneral(g.id, 'mayor', c.id);
    return { ok: r.ok, name: g.name, id: g.id, city: c.name,
      mb: G.mayorBonus(c) };
  });
  console.log('  城主 = ' + boot.name + ' @ ' + boot.city
    + ' · mayorBonus = ' + JSON.stringify({ prod: boot.mb.prod, build: boot.mb.build, tax: boot.mb.tax, research: boot.mb.research, def: boot.mb.def }));
  chk('造局：城主任命成功且税加成 = +150%', boot.ok === true && Math.abs(boot.mb.tax - 1.5) < 1e-9);
  await p.waitForTimeout(900);

  console.log('===== ① 将领详情六维表（内政行悬停含税收） =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('generals');
    G.ui._genSel = G.state.generals[0].id;      /* 选中城主本人 */
    G.ui.renderView('generals');
    var out = { n: 0, tip: '', rowTip: '' };
    var rows = document.querySelectorAll('.gd-dims tbody tr');
    out.n = rows.length;
    for (var i = 0; i < rows.length; i++) {
      var td = rows[i].querySelector('td');
      var t = (td && td.textContent) || '';
      if (/内政/.test(t)) { out.tip = td.getAttribute('title') || ''; out.rowTip = t; }
    }
    return out;
  });
  console.log('    内政行 tip = ' + r1.tip.replace(/\n/g, ' | ').slice(0, 160));
  chk('六维表含 6 维 + 自由点行（>=6 行 · 内政行在位）', r1.n >= 6, 'rows=' + r1.n);
  chk('★ 内政行悬停含「城主加成：…税收 +150%」', /城主加成/.test(r1.tip) && /税收 \+150%/.test(r1.tip)
    && /产量 \+150%/.test(r1.tip) && /建造 \+150%/.test(r1.tip));
  var rc1 = await p.evaluate(function () {
    var tb = document.querySelector('.gd-dims');
    var r = tb ? tb.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (rc1) {
    await p.screenshot({ path: OUT + 'v89162-gen-dims.png',
      clip: { x: Math.max(0, rc1.x - 8), y: Math.max(0, rc1.y - 8), width: Math.min(rc1.w + 16, 1584), height: rc1.h + 16 } });
    console.log('    📷 v89162-gen-dims.png');
  }
  chk('六维表截图（6 行达标）', !!rc1);

  console.log('===== ② 城池面板（城主行悬停全加成） =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openCityPanel(G.currentCity());
    var m = document.querySelector('#modal-root');
    var span = null;
    (m.querySelectorAll('.attr') || []).forEach(function (row) {
      var k = row.querySelector('.k');
      if (k && /城主/.test(k.textContent || '')) span = row.querySelector('.ui-sub');
    });
    return { tip: span ? (span.getAttribute('title') || '') : '', has: !!span,
      panel: !!m.querySelector('.inner-panel') };
  });
  console.log('    城主行悬停 = ' + r2.tip.replace(/\n/g, ' | ').slice(0, 170));
  chk('★ 城池面板城主行悬停含「内政 → 产量 +150% · 建造 +150% · 税收 +150%」',
    /内政 → 产量 \+150%/.test(r2.tip) && /建造 \+150%/.test(r2.tip) && /税收 \+150%/.test(r2.tip));
  chk('★ 且含「智谋 → 研究/城防」', /智谋 → 研究/.test(r2.tip) && /城防/.test(r2.tip));
  var rc2 = await p.evaluate(function () {
    var box = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    var r = box ? box.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 560) } : null;
  });
  if (rc2) {
    await p.screenshot({ path: OUT + 'v89162-city-mayor.png',
      clip: { x: Math.max(0, rc2.x), y: Math.max(0, rc2.y), width: rc2.w, height: rc2.h } });
    console.log('    📷 v89162-city-mayor.png');
  }

  console.log('===== ③ 侧栏黄金悬停（分解含「城主内政」行 · tip 真渲染） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('city');                        /* 回到城池视图（侧栏悬停的真实场景） */
    G.ui.renderSide();
  });
  await p.waitForTimeout(260);                   /* 等视图/遮罩动画安定 */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.renderSide();
    var wrap = null;
    document.querySelectorAll('#res-bar .res-line').forEach(function (row) {
      var lbl = row.querySelector('.lbl');
      if (lbl && /金/.test(lbl.textContent || '')) {
        var w = row.querySelector('.rate-wrap');
        if (w) wrap = w.getBoundingClientRect();
      }
    });
    return wrap ? { cx: wrap.left + wrap.width / 2, cy: wrap.top + wrap.height / 2 } : null;
  });
  if (r3) {
    var _hit = await p.evaluate(function (xy) {
      var e = document.elementFromPoint(xy.x, xy.y);
      var row = e && e.closest ? e.closest('.res-line') : null;
      var lbl = row && row.querySelector('.lbl');
      return { el: e ? (e.tagName + '.' + String(e.className || '').split(' ')[0]) : 'null',
        lbl: lbl ? (lbl.textContent || '').trim() : '(无行)' };
    }, { x: r3.cx, y: r3.cy });
    console.log('    命中元素 = ' + _hit.el + ' · 所属资源行 = 「' + _hit.lbl + '」');
    await p.mouse.move(r3.cx, r3.cy);
    await p.waitForTimeout(120);
    var r4 = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      return { on: !!(el && el.classList.contains('on')), txt: el ? (el.textContent || '') : '' };
    });
    if (!r4.on) {                                  /* 再等一拍（主循环时机）后复读一次 */
      await p.waitForTimeout(700);
      r4 = await p.evaluate(function () {
        var el = document.getElementById('tip-layer');
        return { on: !!(el && el.classList.contains('on')), txt: el ? (el.textContent || '') : '' };
      });
    }
    console.log('    tip 显示 = ' + r4.on + ' · 全内容 = ' + r4.txt.replace(/\n/g, ' | ').slice(0, 300));
    chk('★ tip 层真渲染「城主内政」行', r4.on && r4.txt.indexOf('城主内政') >= 0);
    chk('tip 含「税制加成（名城/爵位/主城/神器）」行（爵位 6 → +6%）', r4.txt.indexOf('税制加成') >= 0);
    chk('tip 含「税收（人口…）」「爵位俸禄」行', r4.txt.indexOf('税收（人口') >= 0 && r4.txt.indexOf('爵位俸禄') >= 0);
    var rc3 = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      var r = el ? el.getBoundingClientRect() : null;
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    });
    if (rc3) {
      await p.screenshot({ path: OUT + 'v89162-gold-tip.png',
        clip: { x: Math.max(0, rc3.x - 10), y: Math.max(0, rc3.y - 10), width: Math.min(rc3.w + 20, 1220), height: rc3.h + 20 } });
      console.log('    📷 v89162-gold-tip.png');
    }
  } else {
    chk('侧栏黄金行可定位', false, '未找到 #res-bar 金行 .rate-wrap');
  }

  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('FATAL: ' + e.message); process.exit(2); });
