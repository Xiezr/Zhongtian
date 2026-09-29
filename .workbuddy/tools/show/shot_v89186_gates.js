/* v89.186 实机验证（真浏览器）：
   ① 军务处 · 伤兵营显示"伤兵回收 75%"（唯一出口读数）
   ② 出征面板 · 苦战时伤兵提示行（💊 + 快购兵书按钮）+ 战备快购按钮
   ③「快购兵书」真点 → 弹窗（军事 · 伤兵专用：青囊书/续命书/医圣书）
   ④ 将领面板 · 宝具挂件行（佩上 → 展示效果摘要；玩法链路真跑）
   ⑤ 据点面板 · 新文案（拔除并收为前哨）
   ⑥ 情报站：s.forts 存在时出征面板显示"🗼 情报站覆盖：情报确凿"
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89186_gates.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验186', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    G.ui.setView('city');
    if (G.ui.renderSide) G.ui.renderSide();
    G.ui.closeAllModals();
  });
  await p.waitForTimeout(800);

  /* ① 军务处 · 伤兵营读数（75%） */
  var w1 = await p.evaluate(function () {
    var G = window.GAME;
    G.state.wounded = 1200; G.state.woundedArmy = { gongjian: 800, daodun: 400 };
    G.ui._marchTab = 'affairs';
    G.ui.setView('marches'); G.ui.renderView('marches');
    var h = document.querySelector('#view-container');
    return h ? h.textContent : '';
  });
  chk('① 伤兵营读数：含「75%」折伤兵（唯一出口）', w1.indexOf('按 75% 折为伤兵') >= 0,
    'found=' + (w1.indexOf('按 75% 折为伤兵') >= 0));
  {
    var clip = await p.evaluate(function () {
      var el = document.querySelector('#view-container .camp-cards');
      var r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(1100, r.width + 8), height: Math.min(600, r.height + 8) };
    });
    await p.screenshot({ path: OUT + 'v89186-wounded.png', clip: clip });
  }

  /* ② 出征面板 · 苦战提示行 + 战备快购（选一个高 Lv 野地、填少量兵制造苦战） */
  var w2 = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    var hit = null;
    for (var lv = 9; lv >= 6 && !hit; lv--) {
      for (var r = 1; r <= 16 && !hit; r++) for (var dy = -r; dy <= r && !hit; dy++) for (var dx = -r; dx <= r && !hit; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || tl.terrain !== 'plain') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        if (G.map.wildLevelNow(x, y) !== lv) continue;
        hit = { x: x, y: y, lv: lv };
      }
    }
    if (!hit) return { err: 'no-target' };
    /* v89.186 实机修：新局首城 army 为空（开局无兵）→ 先发兵才有输入框可填 */
    c.army = c.army || {};
    c.army.gongjian = 800; c.army.daodun = 400;
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'wild', x: hit.x, y: hit.y });
    /* 填少量兵（制造"苦战"：我方弱于守军 → ratioHi < 1） */
    var inp = document.getElementById('exp-gongjian');
    if (inp) inp.value = '800';
    G.ui.updateExpMarch();
    var el = document.getElementById('exp-wound186');
    var foot = document.querySelector('#modal-root .exp-foot');
    return { lv: hit.lv,
      woundHTML: el ? el.textContent : '(缺)',
      woundShown: !!(el && el.textContent && el.textContent.indexOf('伤兵回收') >= 0),
      qbBtn: !!(el && el.querySelector('[data-action="qb-cat"][data-scope="wound"]')),
      footQB: !!(foot && foot.textContent.indexOf('战备快购') >= 0) };
  });
  chk('② 苦战提示行：出现 + 含「伤兵回收 75%」+ 快购兵书按钮 + 底部战备快购',
    !w2.err && w2.woundShown && /伤兵回收 75%/.test(w2.woundHTML) && w2.qbBtn && w2.footQB,
    (w2.woundHTML || '').replace(/\s+/g, ' ').slice(0, 80));
  {
    var clip = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .modal');
      var r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(1400, r.width), height: Math.min(950, r.height) };
    });
    await p.screenshot({ path: OUT + 'v89186-exp.png', clip: clip });
  }

  /* ③ 真点「快购兵书」→ 弹窗（伤兵专用） */
  var w3 = await p.evaluate(function () {
    var btn = document.querySelector('#exp-wound186 [data-action="qb-cat"][data-scope="wound"]');
    if (!btn) return { err: 'no-btn' };
    btn.click();
    return {};
  });
  await p.waitForTimeout(400);
  var w3b = await p.evaluate(function () {
    var h = document.querySelector('#modal-root');
    var txt = h ? h.textContent : '';
    return { txt: txt.slice(0, 220),
      isWound: txt.indexOf('伤兵专用') >= 0 || txt.indexOf('伤兵') >= 0,
      hasQns: txt.indexOf('青囊书') >= 0, hasYs: txt.indexOf('医圣书') >= 0,
      noPozhen: txt.indexOf('破阵鼓') < 0 };
  });
  chk('③ 快购兵书弹窗：伤兵专用 · 含青囊书/医圣书 · 不含纯攻防品（破阵鼓）',
    !w3.err && w3b.isWound && w3b.hasQns && w3b.hasYs && w3b.noPozhen,
    (w3b.txt || '').replace(/\s+/g, ' ').slice(0, 90));
  await p.screenshot({ path: OUT + 'v89186-qb.png' });

  /* ④ 将领面板 · 宝具挂件行（造库存 → 真点佩上） */
  var w4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.state.items = G.state.items || {};
    G.state.items['bao_yuxi'] = 2;
    G.state.items['bao_tongque'] = 1;
    var g = G.state.generals[0];
    var tong0 = G.genAttrs(g).tong;
    G.ui.openGenEquip(g.id);
    var pane = document.querySelector('.gen-pane');
    var txt = pane ? pane.textContent : '';
    var btn = document.querySelector('.gp-attach186 [data-action="attach-pick"]');
    return { hasLine: txt.indexOf('宝具') >= 0, hasBtn: !!btn, tong0: tong0,
      line: (txt.match(/🔮[^<]{0,60}/) || [''])[0] };
  });
  chk('④a 将领面板挂件行：含「🔮 宝具」+ 佩上按钮', w4.hasLine && w4.hasBtn, (w4.line || '').slice(0, 60));
  /* 真点 → 弹窗 → 真点「佩上」 */
  await p.evaluate(function () {
    var btn = document.querySelector('.gp-attach186 [data-action="attach-pick"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(350);
  var w4b = await p.evaluate(function () {
    var rows = document.querySelectorAll('#modal-root .xc-row');
    var btn = document.querySelector('#modal-root [data-action="attach-on"][data-item="bao_yuxi"]');
    return { rows: rows.length, hasBtn: !!btn };
  });
  chk('④b 挂件选择窗：列出库存宝具（≥2 行）+ 有佩上按钮', w4b.rows >= 2 && w4b.hasBtn, 'rows=' + w4b.rows);
  var w4c = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="attach-on"][data-item="bao_yuxi"]');
    if (btn) btn.click();
    var G = window.GAME, g = G.state.generals[0];
    var r1 = { tong: G.genAttrs(g).tong, has: !!(g.attach && g.attach.bao === 'bao_yuxi'),
      items: G.state.items['bao_yuxi'] || 0 };
    return r1;
  });
  chk('④c 佩上真调：g.attach.bao = bao_yuxi · 库存 2→1 · genAttrs 统率 +6',
    w4c.has && w4c.items === 1 && w4c.tong === w4.tong0 + 6,
    'tong ' + w4.tong0 + '→' + w4c.tong + ' · items=' + w4c.items);
  await p.waitForTimeout(300);
  var w4d = await p.evaluate(function () {
    var pane = document.querySelector('.gen-pane');
    var txt = pane ? pane.textContent : '';
    return { line: (txt.match(/🔮[^<]{0,90}/) || [''])[0],
      hasOff: !!document.querySelector('.gp-attach186 [data-action="attach-off"]'),
      hasEff: txt.indexOf('统率 +6') >= 0 };
  });
  chk('④d 面板回显：显示宝具名 + 效果摘要（统率 +6）+ 卸下按钮', w4d.hasOff && w4d.hasEff,
    (w4d.line || '').slice(0, 80));
  await p.screenshot({ path: OUT + 'v89186-bao.png' });

  /* ④e 卸下真调 */
  var w4e = await p.evaluate(function () {
    var btn = document.querySelector('.gp-attach186 [data-action="attach-off"]');
    if (btn) btn.click();
    var G = window.GAME, g = G.state.generals[0];
    return { off: !(g.attach && g.attach.bao), items: G.state.items['bao_yuxi'] || 0 };
  });
  chk('④e 卸下真调：g.attach 清空 · 库存 1→2（守恒）', w4e.off && w4e.items === 2, 'items=' + w4e.items);

  /* ⑤ 据点面板新文案 */
  var w5 = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    var f = null;
    for (var r = 1; r <= 30 && !f; r++) for (var dy = -r; dy <= r && !f; dy++) for (var dx = -r; dx <= r && !f; dx++) {
      var q = G.map.fortAt(c.x + dx, c.y + dy);
      if (q) f = q;
    }
    if (!f) return { err: 'no-fort' };
    G.ui.closeAllModals();
    G.ui.openFortModal(f);
    var h = document.querySelector('#modal-root');
    var t = h ? h.textContent : '';
    return { ok: t.indexOf('拔除并收为前哨') >= 0 && t.indexOf('不占城池名额') >= 0,
      txt: (t.match(/🚩[^。]{0,90}/) || [''])[0] };
  });
  chk('⑤ 据点面板：按钮/提示为新语义（拔除并收为前哨 · 不占城池名额）', !w5.err && w5.ok,
    (w5.txt || '').slice(0, 90));
  await p.screenshot({ path: OUT + 'v89186-fort.png' });

  /* ⑥ 情报站：造 s.forts → 出征面板显示"情报确凿" */
  var w6 = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    var hit = null;
    for (var r = 2; r <= 20 && !hit; r++) for (var dy = -r; dy <= r && !hit; dy++) for (var dx = -r; dx <= r && !hit; dx++) {
      var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
      if (!tl || tl.terrain !== 'plain') continue;
      if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
      hit = { x: x, y: y };
    }
    if (!hit) return { err: 'no-target' };
    c.army = c.army || {};
    c.army.gongjian = 3000;                  /* 发兵（否则预测区显示"填入兵力后显示对比"） */
    G.state.forts = G.state.forts || {};
    G.state.forts['aura'] = { x: hit.x + 1, y: hit.y, lv: 3, name: '前哨A' };
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'wild', x: hit.x, y: hit.y });
    var inp = document.getElementById('exp-gongjian');
    if (inp) { inp.value = '3000'; }
    G.ui.updateExpMarch();
    var pw73 = document.getElementById('exp-power');
    var t = pw73 ? pw73.textContent : '';
    return { ok: t.indexOf('情报站覆盖：情报确凿') >= 0, txt: t.replace(/\s+/g, ' ').slice(0, 150) };
  });
  chk('⑥ 情报站覆盖：军师估算显示「🗼 情报站覆盖：情报确凿」', !w6.err && w6.ok,
    (w6.txt || '').slice(0, 110));
  await p.screenshot({ path: OUT + 'v89186-aura.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('脚本异常：' + (e && e.message)); process.exit(2); });
