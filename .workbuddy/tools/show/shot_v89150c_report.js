'use strict';
/* v89.150 实机验证 C（真浏览器）：老板 3 / 5 ——
   ③ 战报正文 = 三块（战斗总结 / 战斗收获 / 兵种损耗），回放与纪要不在
   ⑤ 「战斗待指挥」清单（标题 + 三列表格：目标 / 战斗类型 / 是否观战）
   跑法：node .workbuddy/tools/show/shot_v89150c_report.js */
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
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 造局：打一场野地（即时结算）→ 拿战报；再挂起一场（拿待指挥清单） */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '报', cityName: '许都', region: '豫州', mapSeed: 20260950 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 12;
    c.army = { changqiang: 20000, gongjian: 6000, qingji: 5000 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    var wl = null;
    for (var rr = 3; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 6 && lv <= 9)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    /* ① 即时结算一场（battleWatch=false）→ 立刻出战报 */
    st.settings.battleWatch = false;
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid',
      { changqiang: 9000, qingji: 4000 }, g.id, {});
    var rep = (st.reports || [])[0];
    /* ② 观战挂起一场（拿待指挥清单） */
    st.settings.battleWatch = true;
    g.stamina = 999; g.energy = 999;
    c.army = { changqiang: 12000 };
    var r2 = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'occupy', { changqiang: 8000 }, g.id, {});
    return { ok: r.ok, repId: rep ? GAME.repRidOf(rep) : null, repTitle: rep ? rep.title : '',
      repType: rep ? rep.type : '', pending: !!r2.pending, listN: G.ui.battleListOf().length, msg: r2.msg || '' };
  });
  console.log('造局: ' + JSON.stringify(r1));
  chk('即时战报已入档', r1.ok === true && !!r1.repId, r1.repTitle);
  chk('另有一场待指挥（清单 1 场）', r1.pending === true && r1.listN >= 1, '待指挥 ' + r1.listN);

  /* ============ ③ 战报正文三块 ============ */
  console.log('===== ③ 战报正文（三块 · 无回放/纪要）=====');
  await p.evaluate(function (rid) { window.GAME.ui.viewReportText(rid); }, r1.repId);
  await p.waitForTimeout(500);
  var m3 = await p.evaluate(function () {
    var root = document.querySelector('#modal-root .modal');
    var txt = root ? (root.textContent || '') : '';
    /* 板块标题（.seal / sealH 的渲染形态） */
    var heads = [];
    Array.prototype.forEach.call(root ? root.querySelectorAll('.seal-t, .sd-h, .m-title, div') : [], function (el) {
      var t = (el.textContent || '').trim();
      if (/^(战斗总结|战斗收获|兵种损耗|分回合回放|回合纪要|战斗场景)/.test(t) && t.length < 24) heads.push(t.slice(0, 12));
    });
    var out = {
      heads: heads.slice(0, 8),
      hasSum: txt.indexOf('战斗总结') >= 0, hasGain: txt.indexOf('战斗收获') >= 0, hasLoss: txt.indexOf('兵种损耗') >= 0,
      hasReplay: txt.indexOf('分回合回放') >= 0 || txt.indexOf('上一帧') >= 0 || txt.indexOf('关键帧') >= 0,
      hasLog: txt.indexOf('回合纪要') >= 0,
      gainRows: root ? root.querySelectorAll('.rp-gain .rp-glabel').length : 0,
      sumLines: root ? root.querySelectorAll('.rp-lines.rp-sum .rp-line').length : 0,
      evLines: root ? root.querySelectorAll('.rp-lines.rp-evts .rp-line').length : 0,
      lossRows: root ? root.querySelectorAll('.rp-tbl tbody tr').length : 0,
      overlay: (function () { var m = root; return m ? Math.round(m.scrollHeight - m.clientHeight) : -1; })(),
      gainPreview: [],
    };
    Array.prototype.forEach.call(root ? root.querySelectorAll('.rp-gain .rp-glabel') : [], function (el) {
      out.gainPreview.push((el.textContent || '').trim());
    });
    return out;
  });
  console.log('  板块：' + JSON.stringify(m3.heads));
  console.log('  总结 ' + m3.sumLines + ' 行 · 事件 ' + m3.evLines + ' 行 · 收获 ' + m3.gainRows + ' 行（' + m3.gainPreview.join('/') + '）· 损耗表 ' + m3.lossRows + ' 行');
  chk('③ 三块齐（战斗总结 / 战斗收获 / 兵种损耗）', m3.hasSum && m3.hasGain && m3.hasLoss);
  chk('③ 回放板块已删（无「分回合回放」/逐帧按钮/关键帧）', m3.hasReplay === false);
  chk('③ 回合纪要已删', m3.hasLog === false);
  chk('③ 战斗总结**逐行**（≥2 行）', m3.sumLines >= 2, m3.sumLines + ' 行');
  chk('③ 战斗收获**两列分类分行**（≥1 行带类别标签）', m3.gainRows >= 1, m3.gainPreview.join(' / '));
  chk('③ 兵种损耗表在（≥1 行）', m3.lossRows >= 1, m3.lossRows + ' 行');
  chk('③ 弹窗不溢出（无下拉条）', m3.overlay <= 1, 'over=' + m3.overlay);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89150-report.png' });

  /* ============ ⑤ 战斗待指挥清单 ============ */
  console.log('===== ⑤ 战斗待指挥清单（标题 + 三列表格）=====');
  var m5 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openBattleList();
    var root = document.querySelector('#modal-root .modal');
    var txt = root ? (root.textContent || '') : '';
    var ths = [];
    Array.prototype.forEach.call(root ? root.querySelectorAll('th') : [], function (th) { ths.push((th.textContent || '').trim()); });
    var rows = root ? root.querySelectorAll('tbody tr') : [];
    var first = rows.length ? rows[0] : null;
    return {
      title: txt.indexOf('战斗待指挥') >= 0, heads: ths,
      rows: rows.length,
      cells: first ? Array.prototype.map.call(first.querySelectorAll('td'), function (td) { return (td.textContent || '').trim(); }) : [],
      btns: root ? root.querySelectorAll('[data-action="bt-open"]').length : 0,
      overlay: root ? Math.round(root.scrollHeight - root.clientHeight) : -1,
      k: (G.appKOf ? G.appKOf() : 1),
      modalW: root ? Math.round(root.getBoundingClientRect().width / (G.appKOf ? G.appKOf() : 1)) : -1,
    };
  });
  console.log('  表头 ' + JSON.stringify(m5.heads) + ' · ' + m5.rows + ' 行 · 首行 ' + JSON.stringify(m5.cells) + ' · 观战键 ' + m5.btns);
  chk('⑤ 标题「战斗待指挥」在位', m5.title === true);
  chk('⑤ 三列表头 = 目标 / 战斗类型 / 是否观战',
    m5.heads.join('/') === '目标/战斗类型/是否观战', m5.heads.join('/'));
  chk('⑤ 表格有行（待指挥战斗）+ 每行一个「观战」按钮',
    m5.rows >= 1 && m5.btns === m5.rows, m5.rows + ' 行 / ' + m5.btns + ' 键');
  chk('⑤ 行内容三列齐（目标名 / 类型 / 按钮）', m5.cells.length === 3, JSON.stringify(m5.cells));
  chk('⑤ 清单弹窗不溢出', m5.overlay <= 1, 'over=' + m5.overlay + ' · 宽 ' + m5.modalW);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89150-btlist.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
