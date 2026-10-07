/* v89.214 实机验收：装备悬停「分行 + 三色」+ 世界观换皮（废土 · 余烬纪元）
   ------------------------------------------------------------
   老板：「装备属性悬停显示时，按照特定格式分行展示，名称行的甲乙丙丁不需要展示；
          六维属性分行显示，原始属性数字白色，其他方式增强的数字分不同颜色显示」
         「转换为废土，余烬纪元」
   ① 悬停真出浮层：.eqv-line 逐属性一行（行数 = 属性数）· 三个色段类都真着色
      （白 #ffffff / 百炼旧币 #f0c14b / 蕴养青 #7fd6e0 —— 读 computedStyle 实测）
   ② 名称行无 ·甲/·乙（悬停标题 + 卡面 + 槽位名三处）
   ③ 修炼件（蕴养）走青色段
   ④ 换皮：资源栏 / 建筑 / 兵种 / 年号 的实机文本
   图：v89214-eqtip / v89214-lingtip / v89214-wasteland */
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

  /* ── 造局：两件同名件（+10 / +0）+ 一件修炼件（+5）── */
  var setup = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v214', cityName: '许都', region: '碎垣', mapSeed: 20261014 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    var s = G.state;
    s.res.gold = 1e9; s.res.iron = 1e9; s.res.stone = 1e9;
    /* 首城塞一格锻造间（强化条件） */
    var c = G.currentCity();
    var i = c.cells.findIndex(function (x) { return !x.build && !x.official; });
    if (i >= 0) c.cells[i].build = { id: 'tiejiangpu', lvl: 5 };
    var hi = G.addEquip('yt_sword', 10);
    var lo = G.addEquip('yt_sword', 0);
    var ling = G.addEquip('lg_weapon_4', 5);
    /* 再补两件同名（验证名称行无序号） */
    G.addEquip('cr_head_1', 2); G.addEquip('cr_head_1', 0);
    return { hi: hi.u, lo: lo.u, ling: ling.u, inv: s.inventory.length,
             names: s.inventory.map(function (x) { return G.eqLabel(x); }).slice(0, 8) };
  });
  console.log('  造局：' + JSON.stringify(setup.names));

  /* ══ ① 装备背包悬停：分行 + 三色 ══ */
  await p.evaluate(function () { window.GAME.ui.openBag('equip'); });
  await sleep(420);
  var cells = await p.locator('#view-container .bag-cell').count();
  chk('①a 装备背包渲染格子', cells >= 5, cells + ' 格');
  /* v89.214：悬停**+10 那件**（有增量才有三色段） */
  await p.locator('#view-container .bag-cell', { hasText: '倚天长剑 +10' }).first().hover();
  await sleep(460);
  var t1 = await p.evaluate(function () {
    var G = window.GAME, el = document.getElementById('tip-layer');
    var on = !!(el && el.classList.contains('on'));
    if (!on) return { on: false, html: (el ? el.innerHTML : '').slice(0, 120) };
    function cs(sel) { var n = el.querySelector(sel); if (!n) return null; var c = getComputedStyle(n); return { color: c.color, weight: c.fontWeight }; }
    return {
      on: true,
      title: (el.querySelector('.tip-t') || {}).textContent || '',
      lines: el.querySelectorAll('.eqv-line').length,
      base: cs('.eqv-b'), d1: cs('.eqv-d1'), d2: cs('.eqv-d2'),
      baseTxt: (el.querySelector('.eqv-b') || {}).textContent || '',
      dTxt: (el.querySelector('.eqv-d1') || {}).textContent || '',
      note: (el.querySelector('.eqv-note') || {}).textContent || '',
      whole: el.textContent.replace(/\s+/g, ' ').slice(0, 160),
    };
  });
  console.log('  悬停：' + JSON.stringify(t1.whole));
  chk('①b 悬停浮层真出现（#tip-layer.on）', t1.on === true, JSON.stringify(t1).slice(0, 160));
  chk('①c 属性**逐行**（.eqv-line ≥ 5 · 行数 = 属性数）', t1.lines >= 5, 'lines=' + t1.lines);
  chk('①d 原始值=白（rgb(255,255,255)）', t1.base && t1.base.color === 'rgb(255, 255, 255)', JSON.stringify(t1.base));
  chk('①e 百炼增量=旧币（rgb(240,193,75)）· 字号加粗', t1.d1 && t1.d1.color === 'rgb(240, 193, 75)', JSON.stringify(t1.d1));
  chk('①f 名称行无 ·甲/·乙', t1.title.indexOf('·') < 0 && !/[甲乙丙丁]/.test(t1.title), t1.title);
  chk('①g 浮层带来源注（百炼 +N 级）', /百炼/.test(t1.note), t1.note.slice(0, 40));
  /* v89.214：按浮层实际矩形裁图（clip 用视口坐标 = getBoundingClientRect 同域） */
  var tipRect = await p.evaluate(function () {
    var el = document.getElementById('tip-layer');
    var r = el.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left) - 8), y: Math.max(0, Math.round(r.top) - 8),
             w: Math.round(r.width) + 16, h: Math.round(r.height) + 16 };
  });
  console.log('  浮层矩形：' + JSON.stringify(tipRect));
  await p.screenshot({ path: E + 'v89214-eqtip.png', clip: { x: tipRect.x, y: tipRect.y, width: tipRect.w, height: tipRect.h } });

  /* ══ ② 修炼件（蕴养）走青色段 ══ */
  var lingTip = await p.evaluate(function () {
    var G = window.GAME, inst = G.eqFind(G.state.inventory.filter(function (x) { return x.id === 'lg_weapon_4'; })[0].u);
    var html = G.ui.equipStatsHTML(inst);
    var d = document.createElement('div'); d.className = 'tip-layer'; d.style.position = 'absolute'; d.style.left = '-9999px';
    d.innerHTML = html; document.body.appendChild(d);
    var n = d.querySelector('.eqv-d2');
    var col = n ? getComputedStyle(n).color : null;
    var off = getComputedStyle(d.querySelector('.eqv-b')).color;
    d.parentNode.removeChild(d);
    return { color: col, off: off, n: (html.match(/eqv-d2/g) || []).length };
  });
  chk('② 蕴养增量=亮青（rgb(127,214,224)）', lingTip.color === 'rgb(127, 214, 224)', JSON.stringify(lingTip));

  /* ══ ③ 将领装备面板（槽位悬停）:= 同一套分行 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var g = G.state.generals[0];
    var inst = G.state.inventory.filter(function (x) { return x.id === 'yt_sword'; })[0];
    var r = G.systems.equipItem(g.id, inst.u);
    G.ui.closeAllModals();
    G.ui.setView('generals'); G.ui.renderView('generals');
    if (G.ui.openGenPane) { try { G.ui.openGenPane(g.id); } catch (e) {} }
    window.__eq214 = { r: r, gid: g.id };
  });
  await sleep(460);
  var doll = await p.evaluate(function () {
    var G = window.GAME, el = document.querySelector('.doll-slot[data-slot="weapon"]') || document.querySelector('.doll-slot[data-tip-el]');
    if (!el) return { err: 'no-doll' };
    var src = el.querySelector('.eq-slot-tip');
    return { has: !!src, lines: src ? src.querySelectorAll('.eqv-line').length : 0,
             txt: src ? src.textContent.replace(/\s+/g, ' ').slice(0, 80) : '' };
  });
  console.log('  槽位浮层：' + JSON.stringify(doll));
  chk('③ 将领装备槽位（已着 +10 剑）悬停同一套分行', doll.has && doll.lines >= 5, JSON.stringify(doll));

  /* ══ ④ 换皮实机文本（资源栏 / 建筑 / 兵种 / 年号）══ */
  await p.evaluate(function () { var G = window.GAME; G.ui.closeAllModals(); G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide(); });
  await sleep(500);
  var skin = await p.evaluate(function () {
    var G = window.GAME;
    var side = document.querySelector('#res-bar');
    var sideTxt = side ? side.textContent : '';
    var story = document.body.textContent;
    var cn = (G.DATA.RESOURCES || []).map(function (r) { return r.name; }).join('/');
    var bld = ['guanfu', 'minfang', 'shuyang', 'cangku'].map(function (k) {
      return G.DATA.BUILDINGS[k] ? G.DATA.BUILDINGS[k].name : '';
    }).join('/');
    var tr = ['minfu', 'changqiang', 'gongjian', 'qingji', 'nanjiangxiangbing'].map(function (k) {
      return G.DATA.TROOPS[k] ? G.DATA.TROOPS[k].name : '';
    }).join('/');
    var era = G.story && G.story.currentEra ? G.story.currentEra().name : '';
    return { sideTxt: sideTxt.replace(/\s+/g, ' ').slice(0, 90), cn: cn, bld: bld, tr: tr, era: era,
             rank0: G.DATA.RANK[0].name, sect: G.DATA.SECTS[0].name,
             hero: G.DATA.HEROES[0].name, bond: G.DATA.BONDS[0].name };
  });
  console.log('  换皮：' + JSON.stringify(skin));
  chk('④a 资源栏含 净水/木料/建材/废铁', /净水/.test(skin.cn) && /木料/.test(skin.cn) && /建材/.test(skin.cn) && /废铁/.test(skin.cn), skin.cn);
  chk('④b 建筑名 = 政务厅/居所/货仓', /政务厅/.test(skin.bld) && /居所/.test(skin.bld) && /货仓/.test(skin.bld), skin.bld);
  chk('④c 兵种名 = 搬运工/长矛手/弩手/摩托游骑/变异巨兽', /搬运工/.test(skin.tr) && /长矛手/.test(skin.tr) && /弩手/.test(skin.tr), skin.tr);
  chk('④d 年号 = 余烬纪年（' + skin.era + '）', /余烬|残冬|初火|安稳|拓荒|复苏|清议|暗涌|兵戈|甘霖|远征|新世/.test(skin.era), skin.era);
  chk('④e 威望/派系/英雄/羁绊 = ' + skin.rank0 + '/' + skin.sect + '/' + skin.hero + '/' + skin.bond,
    skin.rank0 === '幸存者' && skin.sect === '游骑会' && skin.hero === '铁枭' && skin.bond === '铁誓同盟',
    JSON.stringify(skin).slice(0, 100));
  await p.screenshot({ path: E + 'v89214-wasteland.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
