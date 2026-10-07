'use strict';
/* v89.231 实机验证：科技体系调整（24 项术语换代 · 5 组分节渲染 · 引用链文案）
   跑法：node .workbuddy/tools/show/shot_v89231_tech.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
var SHOT = '.workbuddy/shots/';
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 造局：一座城 + 研习所 5 ---------- */
  var setup = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验231', cityName: '灰岗', region: '碎垣', mapSeed: 20261007 });
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 5e7; });
    c.res.pop = 5e4;
    st.rank = 20;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.official || c.cells[i].build || c.cells[i].pending) continue;
      c.cells[i].build = { id: 'shuyuan', lvl: 5, hiLv: 5 }; break;
    }
    G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide();
    return { techs: G.DATA.TECH.length, cats: (G.DATA.TECH_CATS || []).map(function (x) { return x.key; }).join('/') };
  });
  console.log('造局: ' + JSON.stringify(setup));
  chk('产品表：24 项 · 5 组', setup.techs === 24 && setup.cats === 'res/mil/eng/logi/intel', setup.techs + ' · ' + setup.cats);
  await p.waitForTimeout(500);

  /* ---------- ① 研习所面板（同建筑按钮入口）：五组分节 + 24 名 ---------- */
  await p.evaluate(function () { window.GAME.ui.openPanel('tech', '📜 科技 · 研究'); });
  await p.waitForTimeout(400);
  var dom = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var txt = (root ? root.textContent : '').replace(/\s+/g, ' ');
    var catRows = root ? root.querySelectorAll('.tech-cat').length : 0;
    var trs = root ? root.querySelectorAll('table.tbl tbody tr').length : 0;
    var groups = ['资源产出', '军事武装', '工程建设', '机动后勤', '情报指挥'];
    var missG = groups.filter(function (n) { return txt.indexOf(n) < 0; });
    var techs = ['净化技术', '栽培技术', '蓄能技术', '熔炼技术', '募兵整训', '战斗条令', '装甲强化',
      '弹道校正', '生命维持', '再生技术', '锻造工艺', '量产工艺', '废墟重建', '防御工事', '仓储扩容',
      '机动行军', '机车操控', '传动系统', '座驾改装', '载重优化', '废墟搜刮', '指挥链路', '侦察网络', '逆向工程'];
    var missT = techs.filter(function (n) { return txt.indexOf(n) < 0; });
    return { catRows: catRows, trs: trs, missG: missG.join(','), missT: missT.join(','), len: txt.length };
  });
  chk('研习所面板：五组分节行在屏（.tech-cat ×5）', dom.catRows === 5, 'catRows=' + dom.catRows);
  chk('研习所面板：表体 29 行 = 24 数据 + 5 分组', dom.trs === 29, 'trs=' + dom.trs);
  chk('研习所面板：五组标题逐字在屏', dom.missG === '', '缺=' + (dom.missG || '0'));
  chk('研习所面板：24 项新名逐字在屏', dom.missT === '', '缺=' + (dom.missT || '0'));
  await p.screenshot({ path: SHOT + 'v89231-tech-panel.png' });
  console.log('  📷 ' + SHOT + 'v89231-tech-panel.png');

  /* ---------- ② 真点研习所格 → 建筑面板（研究加速行换代）---------- */
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await p.waitForTimeout(150);
  var cellSel = await p.evaluate(function () {
    var tiles = document.querySelectorAll('.iso-tile');
    for (var i = 0; i < tiles.length; i++) {
      if ((tiles[i].textContent || '').indexOf('研习所') >= 0 && tiles[i].getAttribute('data-action')) {
        return { idx: tiles[i].getAttribute('data-idx'), act: tiles[i].getAttribute('data-action') };
      }
    }
    return null;
  });
  chk('城内找到研习所格（可点）', !!cellSel && !!cellSel.act, JSON.stringify(cellSel));
  if (cellSel) {
    await p.click('.iso-tile[data-action="' + cellSel.act + '"][data-idx="' + cellSel.idx + '"]');
    await p.waitForTimeout(350);
    var bp = await p.evaluate(function () {
      var root = document.querySelector('#modal-root');
      var txt = (root ? root.textContent : '').replace(/\s+/g, ' ');
      return { txt: txt.slice(0, 260), hasAcc: txt.indexOf('逆向工程每级 -5%') >= 0, hasCnt: txt.indexOf('可研究科技') >= 0 };
    });
    chk('研习所建筑面板：「研究加速 = 逆向工程每级 -5%」在屏', bp.hasAcc, bp.txt.slice(0, 120));
    chk('研习所建筑面板：「可研究科技 N / 24」在屏', bp.hasCnt);
  }

  /* ---------- ③ 兵种 desc 换代抽样（运行时数据）---------- */
  var desc = await p.evaluate(function () {
    var G = window.GAME;
    return {
      zhencha: G.DATA.TROOPS.zhencha.desc,
      fujiche: G.DATA.TROOPS.fujiche.desc,
      daodanche: G.DATA.TROOPS.daodanche.desc,
      zhuzhan: G.DATA.TROOPS.zhuzhan.desc,
    };
  });
  chk('兵种 desc：侦察单元「需侦察网络」', desc.zhencha.indexOf('需侦察网络') >= 0, desc.zhencha);
  chk('兵种 desc：伏击车三名连换（战斗条令/机动行军/机车操控）',
    desc.fujiche.indexOf('战斗条令') >= 0 && desc.fujiche.indexOf('机动行军') >= 0 && desc.fujiche.indexOf('机车操控') >= 0, desc.fujiche);
  chk('兵种 desc：导弹车「需弹道校正」', desc.daodanche.indexOf('需弹道校正') >= 0, desc.daodanche);
  chk('兵种 desc：主战机甲（机车操控/装甲强化）',
    desc.zhuzhan.indexOf('机车操控') >= 0 && desc.zhuzhan.indexOf('装甲强化') >= 0, desc.zhuzhan);

  /* ---------- ④ 像素体检 ---------- */
  var f = SHOT + 'v89231-tech-panel.png';
  var png = PNG.sync.read(fs.readFileSync(f));
  var bright = 0, n = 0, lum = 0;
  for (var i = 0; i < png.data.length; i += 4 * 7) {
    n++;
    var L = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    lum += L;
    if (L > 80) bright++;
  }
  var meanL = n ? lum / n : 0, bp = n ? bright / n : 0;
  chk('像素体检（暗色面板有内容 · 均亮 25~70 · 亮像素 0.5%~12%）',
    n > 0 && meanL >= 25 && meanL <= 70 && bp >= 0.005 && bp <= 0.12,
    '均亮 ' + meanL.toFixed(1) + ' · 亮像素 ' + (bp * 100).toFixed(1) + '% · ' + png.width + 'x' + png.height);

  chk('运行期零页面错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n实机结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('FATAL', e); process.exit(2); });
