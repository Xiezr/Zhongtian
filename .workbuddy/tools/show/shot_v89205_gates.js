/* v89.205 实机验收：将领面板挂件行退役 + 卸下迁入选择窗
   ------------------------------------------------------------
   老板需求：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」
   ① 将领面板：信息区无挂件行（.gp-attach186 零节点）· 装备栏「🔮 宝具」入口在（title 含佩/换/卸）
   ② 真点入口 → 选择窗（未佩态：「当前未佩」+ 列表佩上）
   ③ 真点「佩上」→ 再开窗：已佩态「当前：避难所徽章」+ 卸下按钮（截图）
   ④ 真点「卸下」→ 清空 + 库存守恒 + 窗重开（当前未佩 · 卸下消失）
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
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v205', cityName: '许都', region: '碎垣', mapSeed: 20261007 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.state.items['bao_yuxi'] = 2;
    G.state.items['bao_tongque'] = 1;
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._cityId = c.id;
  });

  /* ══ ① 将领面板：信息区无挂件行 + 装备栏入口 ══ */
  var w1 = await p.evaluate(function () {
    var G = window.GAME;
    var g = G.state.generals[0];
    G.ui.openGenEquip(g.id);
    var pane = document.querySelector('.gen-pane');
    var idZone = pane ? pane.querySelector('.gp-id') : null;
    var btn = document.querySelector('.gen-pane [data-action="attach-pick"][data-slot="bao"]');
    return {
      noLine: pane ? pane.querySelectorAll('.gp-attach186').length : -1,
      idText: idZone ? (idZone.textContent || '').replace(/\s+/g, ' ').slice(0, 120) : '',
      hasBtn: !!btn,
      btnTxt: btn ? (btn.textContent || '') : '',
      btnTitle: btn ? (btn.getAttribute('title') || '') : '',
      inSec: !!(btn && btn.closest('.gp-sec')),
    };
  });
  chk('①a 信息区挂件行零节点（.gp-attach186 = ' + w1.noLine + '）', w1.noLine === 0, JSON.stringify(w1));
  chk('①b 信息区文字不含「🔮 宝具」（实测「' + w1.idText.slice(0, 60) + '」）',
    w1.idText.indexOf('🔮') < 0, w1.idText);
  chk('①c 装备栏「🔮 宝具」入口在（装备栏标题行内 · ' + w1.btnTxt + '）',
    w1.hasBtn && w1.inSec && w1.btnTxt.indexOf('宝具') >= 0, JSON.stringify({ has: w1.hasBtn, in: w1.inSec }));
  chk('①d 入口 title 载明「点开可佩 / 换 / 卸」（信息不丢）',
    /点开可佩/.test(w1.btnTitle) && /卸/.test(w1.btnTitle), w1.btnTitle.slice(0, 70));
  await p.screenshot({ path: E + 'v89205-pane.png' });

  /* ══ ② 真点入口 → 未佩态选择窗 ══ */
  await p.evaluate(function () {
    var btn = document.querySelector('.gen-pane [data-action="attach-pick"][data-slot="bao"]');
    if (btn) btn.click();
  });
  await sleep(420);
  var w2 = await p.evaluate(function () {
    var mr = document.querySelector('#modal-root');
    var t = mr ? mr.textContent : '';
    return {
      open: !!mr && !!mr.querySelector('.inner-panel'),
      cur: t.indexOf('当前未佩') >= 0,
      rows: mr ? mr.querySelectorAll('.xc-row').length : 0,
      onBtn: !!document.querySelector('#modal-root [data-action="attach-on"]'),
      offBtn: !!document.querySelector('#modal-root [data-action="attach-off"]'),
    };
  });
  chk('②a 选择窗打开（未佩态「当前未佩」）', w2.open && w2.cur, JSON.stringify(w2));
  chk('②b 列表 ' + w2.rows + ' 行（库存宝具）· 佩上按钮在 · 未佩时无卸下按钮',
    w2.rows >= 2 && w2.onBtn && !w2.offBtn, JSON.stringify(w2));

  /* ══ ③ 真点「佩上」→ 关窗回面板 → 再开窗（已佩态） ══ */
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="attach-on"][data-item="bao_yuxi"]');
    if (btn) btn.click();
  });
  await sleep(420);
  var w3 = await p.evaluate(function () {
    var G = window.GAME, g = G.state.generals[0];
    return { on: !!(g.attach && g.attach.bao === 'bao_yuxi'), items: G.state.items['bao_yuxi'] || 0,
      modal: !!document.querySelector('#modal-root .inner-panel') };
  });
  chk('③a 佩上真调：attach.bao = bao_yuxi · 库存 2→1 · 关窗回面板',
    w3.on && w3.items === 1 && !w3.modal, JSON.stringify(w3));
  /* 面板上不该出现挂件行（已佩后依然零节点） */
  await p.evaluate(function () {
    var btn = document.querySelector('.gen-pane [data-action="attach-pick"][data-slot="bao"]');
    if (btn) btn.click();
  });
  await sleep(420);
  var w3b = await p.evaluate(function () {
    var mr = document.querySelector('#modal-root');
    var t = mr ? mr.textContent : '';
    var off = document.querySelector('#modal-root [data-action="attach-off"]');
    return {
      noLine: document.querySelectorAll('.gen-pane .gp-attach186').length,
      cur: t.indexOf('当前：') >= 0 && t.indexOf('避难所徽章') >= 0,
      eff: t.indexOf('指挥 +6') >= 0,
      off: !!off, offTxt: off ? off.textContent : '',
    };
  });
  chk('③b 已佩态选择窗：回显「当前：避难所徽章（指挥 +6）」+ 卸下按钮（实为「' + w3b.offTxt + '」）',
    w3b.cur && w3b.eff && w3b.off, JSON.stringify(w3b));
  chk('③c 已佩后面板信息区仍零挂件行（' + w3b.noLine + '）', w3b.noLine === 0, 'n=' + w3b.noLine);
  await p.screenshot({ path: E + 'v89205-pick.png' });

  /* ══ ④ 真点「卸下」→ 清空 + 守恒 + 窗重开 ══ */
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="attach-off"]');
    if (btn) btn.click();
  });
  await sleep(420);
  var w4 = await p.evaluate(function () {
    var G = window.GAME, g = G.state.generals[0];
    var mr = document.querySelector('#modal-root');
    var t = mr ? mr.textContent : '';
    return {
      off: !(g.attach && g.attach.bao), items: G.state.items['bao_yuxi'] || 0,
      curNo: t.indexOf('当前未佩') >= 0,
      offBtn2: !!document.querySelector('#modal-root [data-action="attach-off"]'),
      toast: (document.querySelector('#toast') ? document.querySelector('#toast').textContent : ''),
    };
  });
  chk('④a 卸下真调：attach.bao 清空 · 库存 1→2（守恒）', w4.off && w4.items === 2, JSON.stringify(w4));
  chk('④b 窗重开刷新：「当前未佩」+ 卸下按钮消失', w4.curNo && !w4.offBtn2, JSON.stringify(w4));
  await p.screenshot({ path: E + 'v89205-off.png' });

  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
