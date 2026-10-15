'use strict';
/* v89.223 实机验证：兵牌简称换代（真浏览器读 .bt-rnm 全量简称）
   跑法：node .workbuddy/tools/show/shot_v89223_ab.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ===== 造局：挂起一场野地战（矛/盾/弩/王 上阵） ===== */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验223', cityName: '灰岗', region: '碎垣', mapSeed: 20260951 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 9;
    c.army = { changqiang: 6000, daodun: 2000, gongjian: 900, hubaoqi: 100 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    var wl = null;
    for (var rr = 3; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 7)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    st.settings.battleWatch = true;
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid',
      { changqiang: 6000, daodun: 2000, gongjian: 900 }, g.id, {});
    var rec = null; (st.battles || []).forEach(function (bb) { rec = bb; });
    if (!rec) return { err: 'no-rec', msg: r.msg };
    return { ok: true, recId: rec.id, wl: wl,
      ab: { cq: G.troopAbOf('changqiang'), dd: G.troopAbOf('daodun'), gj: G.troopAbOf('gongjian'),
        hb: G.troopAbOf('hubaoqi'), nj: G.troopAbOf('nanjiangxiangbing') } };
  });
  console.log('造局: ' + JSON.stringify(r1));
  if (!r1.ok) { console.log('结果：' + PASS + ' 通过 / ' + (FAIL + 1) + ' 失败'); await b.close(); process.exit(1); }
  chk('出口 troopAbOf：长矛手=矛 · 盾卫=盾 · 弩手=弩 · 王牌战车=王 · 变异巨兽=兽',
    r1.ab.cq === '矛' && r1.ab.dd === '盾' && r1.ab.gj === '弩' && r1.ab.hb === '王' && r1.ab.nj === '兽',
    JSON.stringify(r1.ab));

  /* ===== 打开战场 → 读 .bt-rnm 全量简称 ===== */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var rec = null; (G.state.battles || []).forEach(function (bb) { rec = bb; });
    G.ui.openBattlefield(rec.id);
  });
  await p.waitForTimeout(1000);
  var m = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var els = root.querySelectorAll('.bt-rnm');
    var texts = [];
    for (var i = 0; i < els.length; i++) {
      /* 只取首个文本节点 = 可见的那个简称字（.tip-src 是隐藏全名，别算进来） */
      var c0 = els[i].childNodes[0];
      texts.push(c0 && c0.nodeType === 3 ? String(c0.textContent).trim() : els[i].textContent.trim().slice(0, 1));
    }
    return { n: els.length, texts: texts, units: root.querySelectorAll('#bt-field .bt-unit').length };
  });
  console.log('  .bt-rnm: ' + JSON.stringify(m));
  var OLD = ['枪', '弓', '轻', '铁', '辎', '冲', '投', '青', '藤', '虎', '西', '象', '义'];
  var bad = m.texts.filter(function (t) { return t.length === 1 && OLD.indexOf(t) >= 0; });
  chk('兵牌简称全量：无旧字（枪/弓/轻/铁/辎/冲/投/青/藤/虎/西/象/义）',
    bad.length === 0 && m.n >= 3, 'n=' + m.n + ' bad=' + bad.join(','));
  chk('我方兵牌含「矛」与「盾」（长矛手/盾卫上阵）',
    m.texts.indexOf('矛') >= 0 && m.texts.indexOf('盾') >= 0, m.texts.join('|'));
  chk('战场棋盘有兵牌位（.bt-unit ≥ 2）', m.units >= 2, 'units=' + m.units);

  await p.screenshot({ path: '.workbuddy/shots/v89223-ab.png' });
  console.log('  截图: .workbuddy/shots/v89223-ab.png');
  chk('运行期无页面错误', errs.length === 0, errs.slice(0, 2).join(' ; '));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
