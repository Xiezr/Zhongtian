/* v89.164 实机验证（真浏览器）：
   ① 出征面板「战术」下拉首项 = ⚡ 智能战斗（通用方案）+ 图 v89164-tactic-smart.png
   ② 战场顶栏「⚡ 智能」指示 + 完成一回合后智能指令落进 rec.cmd（长枪→轻骑）
      + 图 v89164-bt-smart.png
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89164_smart.js */
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
    G.newGame({ name: '验164', cityName: '许都', region: '碎垣', mapSeed: 20260964 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    return { smartOn: G.battle.smartOnOf() };
  });
  console.log('  开局智能开关（默认）= ' + boot.smartOn);
  chk('智能战斗默认开', boot.smartOn === true);
  await p.waitForTimeout(800);

  console.log('===== ① 出征面板 · 战术下拉 =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    G.ui.openExpModal({ kind: 'wild', x: c.x + 2, y: c.y + 2 });
    var sel = document.getElementById('exp-tactic');
    if (!sel) return null;
    var opts = [];
    for (var i = 0; i < sel.options.length; i++) opts.push(sel.options[i].textContent);
    var row = sel.closest('.exp-sel') || sel.parentElement;
    var r = (row || sel).getBoundingClientRect();
    return { opts: opts, val: sel.value, rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null };
  });
  if (r1) {
    console.log('  下拉选项 = ' + r1.opts.slice(0, 4).join(' | ') + ' … · 当前值=' + r1.val);
    chk('★ 首项 = 「⚡ 智能战斗（通用方案）」且默认选中', r1.opts[0].indexOf('⚡ 智能战斗') >= 0 && r1.val === 'smart');
    var rc1 = await p.evaluate(function () {
      var m = document.querySelector('#modal-root .modal') || document.querySelector('#modal-root .inner-panel');
      var r = m ? m.getBoundingClientRect() : null;
      return r ? { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 620) } : null;
    });
    if (rc1) {
      await p.screenshot({ path: OUT + 'v89164-tactic-smart.png',
        clip: { x: Math.max(0, rc1.x), y: Math.max(0, rc1.y), width: rc1.w, height: rc1.h } });
      console.log('    📷 v89164-tactic-smart.png');
    }
  } else { chk('出征面板战术下拉', false, '#exp-tactic 缺失'); }

  console.log('===== ② 战场 · ⚡ 智能指示 + 首回合指令落账 =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    G.ui.closeAllModals();
    var g = G.state.generals[0];
    g.status = 'idle'; g.cityId = c.id;
    var rec = {
      id: 'btS164', kind: 'expedition', side: 'atk',
      target: { kind: 'wild', x: c.x + 2, y: c.y + 2, name: '荒野·试' }, modeId: 'raid',
      atkArmy: { yibing: 500, changqiang: 500, daodun: 400, gongjian: 400, qingji: 200, tieji: 100 },
      genId: g.id, cityId: c.id, scheme: null, ops: 'assault',
      sim: { scArmy: { yibing: 300, gongjian: 200, changqiang: 200 }, scVal: 0, scGen: null,
        scNote: null, simOpts: {}, duel: null, genSim: null, boost: null },
      round: 0, cnt: 60, state: 'live', cmd: {}, history: [], snapLast: null, evLast: [], gapLast: null,
      bornAt: Date.now(),
    };
    G.state.battles = G.state.battles || [];
    G.state.battles.push(rec);
    G._bsess = G._bsess || {};
    G._bsess[rec.id] = G.battle._makeEnv(rec);
    G.ui.openBattlefield(rec.id);
    var m = document.querySelector('#modal-root');
    return { hasSmart: !!m.querySelector('.bt-smart'), txt: m.querySelector('.bt-smart') ? m.querySelector('.bt-smart').textContent : '' };
  });
  console.log('  战场顶栏智能指示 = ' + r2.hasSmart + ' 「' + r2.txt + '」');
  chk('★ 战场顶栏出现「⚡ 智能」', r2.hasSmart === true && r2.txt.indexOf('⚡') >= 0);

  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var btn = document.querySelector('#modal-root [data-action="bt-done"]');
    if (!btn) return null;
    btn.click();
    return true;
  });
  await p.waitForTimeout(500);
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var rec = G.state.battles.filter(function (x) { return x.id === 'btS164'; })[0];
    if (!rec) return null;
    var tk = null;
    var sels = document.querySelectorAll('#modal-root [data-action="bt-stance"]');
    if (sels.length) tk = sels[0].getAttribute('data-troop');
    return { cmd: rec.cmd, round: rec.round, firstTroop: tk,
      firstStance: tk ? (document.querySelector('#modal-root [data-action="bt-stance"][data-troop="' + tk + '"]') || {}).value : null };
  });
  if (r4) {
    console.log('  完成一回合后 rec.cmd = ' + JSON.stringify(r4.cmd).slice(0, 200));
    chk('★ 智能指令落账：长枪→轻骑（target 写入 rec.cmd）',
      !!(r4.cmd.changqiang && r4.cmd.changqiang.t === 'qingji'),
      r4.cmd && r4.cmd.changqiang ? JSON.stringify(r4.cmd.changqiang) : '无');
    chk('骑兵→弓（target）', !!(r4.cmd.qingji && r4.cmd.qingji.t === 'gongjian'));
    var rc2 = await p.evaluate(function () {
      var top = document.querySelector('#modal-root .bt-top') || document.querySelector('#modal-root .modal');
      var r = top ? top.getBoundingClientRect() : null;
      return r ? { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 240) } : null;
    });
    if (rc2) {
      await p.screenshot({ path: OUT + 'v89164-bt-smart.png',
        clip: { x: Math.max(0, rc2.x - 6), y: Math.max(0, rc2.y - 6), width: Math.min(rc2.w + 12, 1600), height: rc2.h + 12 } });
      console.log('    📷 v89164-bt-smart.png');
    }
  } else { chk('完成回合', false, '按钮缺失'); }

  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('FATAL: ' + e.message); process.exit(2); });
