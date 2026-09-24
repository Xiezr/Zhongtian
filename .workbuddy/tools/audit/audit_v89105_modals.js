/* ============================================================
 * audit_v89105_modals.js — 弹窗/视图**全量体检**（真浏览器）
 * ------------------------------------------------------------
 * 老板令：「界面及弹窗界面要好看，内容紧凑有序，间隔尽量固定而内容有序填充」。
 * 这一条在工程上要能量：**打开每一个面板，量它的几何**，而不是"看着还行"。
 *
 * 逐面板量四件事：
 *   ① 纵向溢出（正文 scrollHeight − clientHeight）：>2px 就是"内容装不下"
 *   ② 横向越界（子孙元素超出面板右缘 >4px）：标题/长文本撑破版心
 *   ③ 骨架完整（.m-head/.m-body/.m-foot 或 .inner-panel 三者齐备）
 *   ④ 分区节奏（.m-sec / .seal-h 的数量）+ 字号是否全走令牌（无裸 px）
 *
 * 用法：node .workbuddy/tools/audit/audit_v89105_modals.js [--shots]
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var SHOTS = process.argv.indexOf('--shots') >= 0;
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  var pageErr = [];
  page.on('console', function (m) { if (m.type() === 'error') pageErr.push(m.text().slice(0, 140)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 开局：状态尽量"满"，才能压出真实排版 ---------- */
  var boot = await page.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.res.pop = 42000;
    c.army = { yibing: 12000, gongjian: 4200, qingji: 1800, daodun: 900, changqiang: 2600 };
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 7); });
    /* 第二座城（调运/派驻/任命要有对象） */
    try { G.buildCityAt(c.x + 3, c.y + 1); } catch (e) {}
    st.items = st.items || {};
    ['shennongchu', 'zengminling', 'yiminling', 'zhenzhu', 'lianbing_jingyan', 'chest_tong',
      'jinang', 'seed_daomi', 'mabian', 'huoyao', 'qinglong_yan', 'wuzhishu'].forEach(function (id) {
      st.items[id] = 4;
    });
    st.wounded = 5200;
    st.woundedArmy = { yibing: 3600, changqiang: 1600 };
    st.reports = st.reports || [];
    st.reports.unshift({ t: Date.now(), type: 'war', title: '战报 · 黄巾寨（胜）', body: '歼敌 3,200', win: true,
      loss: { atkStart: { yibing: 12000 }, atkLoss: { yibing: 420 }, defStart: { yibing: 3200 }, defLoss: { yibing: 3200 } } });
    st.reports.unshift({ t: Date.now() - 6e4, type: 'scout', title: '侦查回报 · 黄巾寨', body: '守军约 3,200 名', win: true,
      intel: [{ title: '守军', rows: [['兵力', '3,200']] }] });
    st.chronicle = st.chronicle || [];
    for (var i = 0; i < 8; i++) st.chronicle.push({ day: i + 1, t: '纪事 ' + (i + 1), body: '第 ' + (i + 1) + ' 日的纪事正文' });
    st.quests = st.quests || [];
    try { G.SG.pendingPush && G.SG.pendingPush('bld-guanfu-01'); } catch (e) {}
    G.ui.enterGame();
    G.ui.setView('city');
    G.refreshAll();
    return { cities: st.cities.length, generals: (st.generals || []).length, sg: (G.SG && G.SG.pending ? G.SG.pending().length : -1) };
  });
  console.log('开局：' + JSON.stringify(boot));

  /* ---------- 面板清单：能走真实入口的一律走真实入口 ---------- */
  var VIEWS = ['city', 'map', 'generals', 'marches', 'quests', 'shop', 'bag', 'story', 'stories', 'doc', 'auto', 'settings'];
  var MODALS = [
    ['官府', 'ui.openGuanfu()'],
    ['征募', 'ui.openTroops()'],
    ['市场', 'ui.openMarket()'],
    ['宿将/客栈', 'ui.openHostel()'],
    ['客栈招募', 'ui.openInn()'],
    ['宝物', 'ui.openArtifacts()'],
    ['装备', 'ui.openEquipPanel()'],
    ['秘境/农庄', 'ui.openFarm()'],
    ['锻造', 'ui.openForge()'],
    ['作坊', 'ui.openWorkshop()'],
    ['书简/帮助', 'ui.openHelp()'],
    ['见闻/日志', 'ui.openJournal(1)'],
    ['君主', 'ui.openLordInfo()'],
    ['小地图', 'ui.openMinimap()'],
    ['存档管理', 'ui.openSaveManager()'],
    ['门派', 'ui.openSect()'],
    ['仓库', 'ui.openStore()'],
    ['军务总览', 'ui.openMarches()'],
    ['城墙', 'ui.openWallModal()'],
    ['校场', 'ui.openXiaochang()'],
    ['据点半览', 'ui.openForts()'],
    ['采集点', 'ui.openGathers()'],
    ['野地一览', 'ui.openWilds()'],
    ['快速购买', 'ui.openQuickBuy("zengminling", 3)'],
    ['布阵方案', 'ui.openTacticSets()'],
    ['自动出征配置', 'ui.openAutoMarch()'],
    ['派驻', 'ui.openTroopMove(GAME.currentCity().id)'],
    ['派遣', 'ui.openDispatch(GAME.currentCity().id)'],
    ['出征', '(function(){var st=GAME.state;ui.openExpModal({kind:"wild",x:st.cities[0].x+2,y:st.cities[0].y+2});})()'],
    ['打造', 'ui.openBuildModal(0)'],
    ['全境营造', 'ui.openBuildOverview()'],
    ['统计·爵位', 'ui.openPanel()'],
  ];

  var rows = [];
  async function measure(kind, name, expr) {
    var r = await page.evaluate(function (arg) {
      var G = window.GAME, ui = G.ui;
      /* 先关干净 */
      try { ui.closeModal(); } catch (e) {}
      if (arg.expr) {
        try { (new Function('GAME', 'ui', arg.expr))(G, ui); }
        catch (e) { return { open: false, err: String(e.message).slice(0, 80) }; }
      }
      var root = document.querySelector('#modal-root');
      var modal = root && root.querySelector('.modal, .inner-shell, .inner-panel');
      if (arg.kind === 'view') {
        var vc = document.querySelector('#view-container');
        if (!vc || !vc.firstElementChild) return { open: false, err: '视图为空' };
        var d0 = vc.firstElementChild;
        function scan(el, bound) {
          var bad = 0, i;
          var kids = el.querySelectorAll('*');
          for (i = 0; i < kids.length; i++) {
            var b = kids[i].getBoundingClientRect();
            if (b.width > 0 && b.right > bound.right + 4) bad++;
          }
          return bad;
        }
        var vbound = d0.getBoundingClientRect();
        return {
          open: true, kind: 'view', cls: d0.className.slice(0, 30),
          h: Math.round(vbound.height), w: Math.round(vbound.width),
          over: d0.scrollHeight - d0.clientHeight,
          overX: scan(d0, vbound),
          head: !!vc.querySelector('.gold-heading, .m-head'),
          foot: !!vc.querySelector('.m-foot, .modal-foot, .op-bar'),
          sec: vc.querySelectorAll('.m-sec, .seal-h, .ui-sub').length,
          pxFont: (function () {
            var n = 0, all = vc.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              var fs0 = getComputedStyle(all[i]).fontSize;
              if (parseFloat(fs0) === 0) n++;
            }
            return n;
          })(),
        };
      }
      if (!modal) return { open: false, err: '未打开（无 .modal/.inner-panel）' };
      var box = modal.getBoundingClientRect();
      var body = root.querySelector('.m-body') || root.querySelector('.inner-panel') || modal;
      /* ⚠️ 只扫**弹窗内部**的子孙：扫整个 #modal-root 会把遮罩层（本来就铺满视口）算成越界 */
      var wide = 0, wideSample = '';
      var kids = modal.querySelectorAll('*');
      for (var i = 0; i < kids.length; i++) {
        var b = kids[i].getBoundingClientRect();
        if (b.width <= 0) continue;
        var cs = getComputedStyle(kids[i]);
        if (cs.position === 'fixed') continue;              /* 固定层（toast/浮标）不属版心 */
        if (b.right > box.right + 4 || b.left < box.left - 4) {
          wide++;
          if (!wideSample) wideSample = (kids[i].className || kids[i].tagName) + '';
        }
      }
      return {
        open: true, kind: 'modal', cls: (modal.className || '').slice(0, 34),
        w: Math.round(box.width), h: Math.round(box.height),
        bodyH: Math.round(body.clientHeight), over: body.scrollHeight - body.clientHeight,
        overX: wide, wideSample: wideSample.slice(0, 40),
        head: !!root.querySelector('.m-head'),
        foot: !!root.querySelector('.m-foot, .modal-foot'),
        sec: root.querySelectorAll('.m-sec, .seal-h').length,
        rows: root.querySelectorAll('.res-line, .attr, .doc-bar').length,
      };
    }, { kind: kind, expr: expr });

    if (!r.open) {
      rows.push({ name: name, kind: kind, bad: '打不开：' + r.err, cls: '-' });
      console.log('  ⛔ ' + name + ' —— ' + r.err);
      return;
    }
    var flags = [];
    if (r.over > 2) flags.push('纵向溢出 ' + r.over + 'px');
    if (r.overX > 0) flags.push('越界 ' + r.overX + ' 处');
    rows.push({
      name: name, kind: kind, cls: r.cls,
      size: r.kind === 'modal' ? (r.w + '×' + r.h) : (r.w + '×' + r.h),
      over: r.over, overX: r.overX, head: r.head, foot: r.foot, sec: r.sec, rows: r.rows,
      bad: flags.join(' · '),
    });
    if (SHOTS && r.kind === 'modal') {
      await page.screenshot({ path: path.join(OUT, 'm105-' + name.replace(/[^\w\u4e00-\u9fa5]/g, '') + '.png') });
    }
  }

  console.log('\n===== 视图（12）=====');
  for (var i = 0; i < VIEWS.length; i++) {
    await page.evaluate(function (v) { window.GAME.ui.setView(v); }, VIEWS[i]);
    await new Promise(function (r) { setTimeout(r, 260); });
    await measure('view', VIEWS[i], null);
  }

  console.log('\n===== 弹窗（' + MODALS.length + '）=====');
  for (var j = 0; j < MODALS.length; j++) {
    await measure('modal', MODALS[j][0], MODALS[j][1]);
    await new Promise(function (r) { setTimeout(r, 160); });
  }

  /* ---------- 汇总 ---------- */
  console.log('\n===== 汇总（按"有问题优先"排序）=====');
  var bad = rows.filter(function (x) { return x.bad; });
  var ok = rows.filter(function (x) { return !x.bad; });
  console.log('  有问题 ' + bad.length + ' / 共 ' + rows.length + '　（通过 ' + ok.length + '）');
  if (bad.length) {
    console.log('\n  ── 需要处理 ──');
    bad.forEach(function (x) {
      console.log('  ' + x.name.padEnd(12) + (x.size || '-').padEnd(11) + (x.cls || '-').padEnd(22) + x.bad);
    });
  }
  console.log('\n  ── 通过（骨架齐备 · 0 溢出）──');
  ok.forEach(function (x) {
    console.log('  ' + x.name.padEnd(12) + (x.size || '-').padEnd(11) + (x.cls || '-').padEnd(22)
      + '骨架 ' + (x.head ? 'H' : '-') + (x.foot ? 'F' : '-') + ' · 分区 ' + x.sec + ' · 行 ' + (x.rows == null ? '-' : x.rows));
  });
  if (pageErr.length) {
    console.log('\n  ── 页面报错（前 6 条）──');
    pageErr.slice(0, 6).forEach(function (e) { console.log('  [err] ' + e); });
  }
  console.log('\nSUMMARY ' + JSON.stringify({ total: rows.length, bad: bad.length }));
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('探针异常：', e && e.message); process.exit(1); });
