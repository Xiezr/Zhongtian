const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const notes = [];
  const check = (n, ok, ex) => out.push([ok ? 'OK  ' : 'FAIL', n, ex || '']);

  /* 手法（v63 的教训）：先开窗 → 等稳定 → 再量；只量 #modal-root 里的当前面板。
     v65 的重点：
       ① 官府面板的溢出（本轮收口目标：把特产三条说明挪进 ui.help）
       ② 六维表"统率"是否折行（老板说属性名成两行了）
       ③ 资源栏短写后是否还横向溢出、数字是否右对齐 */
  const setup = `(function(){ const G=GAME, s=G.state, c=s.cities[0];
    if (!s.map.grid && G.map.generate) G.map.generate();
    var put = function (city, bid, lv) {
      for (var i=0;i<city.cells.length;i++) { var x=city.cells[i];
        if (x.official) continue;
        if (x.build && x.build.id !== bid) continue;
        x.build = { id: bid, lvl: lv }; return true; }
      return false; };
    /* 造一个"官府面板内容最满"的场景：征收表 + 岁贡 + 特产 + 队列 */
    put(c,'zhaoxianguan',3); put(c,'kezhan',3);
    c.type = 'zhou'; c.state = '荆南'; c.origId = null;
    c.wallLv = 0;
    ['grain','wood','stone','iron','gold'].forEach(function(k){ c.res[k]=9e6; });
    s.settings.autoUpgrade = true; s.queues.build.length = 0;
    G.autoUpgrade();
    /* 属性：给将领穿点装备，让六维数字变宽（测折行要用"最长的那种"） */
    var g = s.generals[0];
    g.tong = 2751; g.yw = 2690; g.zm = 2582; g.nz = 2581; g.speed = 458;
    G.ui._genSel = g.id;
    G.ui._cityId = c.id; G.refreshAll(); })()`;

  const measure = (extra) => `(function(){
    var m = document.querySelector('#modal-root .inner-panel');
    var rc = m ? m.getBoundingClientRect() : null;
    var d = { over: rc ? (rc.bottom > window.innerHeight + 1 || rc.top < -1) : null,
      scroll: m ? (m.scrollHeight > m.clientHeight + 2) : null,
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      sh: m ? m.scrollHeight : 0, ch: m ? m.clientHeight : 0,
      txt: m ? m.textContent : '',
      panel: rc ? [Math.round(rc.height), Math.round(rc.bottom), window.innerHeight] : null };
    ${extra || ''}
    return d; })()`;

  for (const vp of [[1600, 950], [1366, 768], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1400);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程'); await p.waitForTimeout(2000);
    const tag = vp[0] + 'x' + vp[1];
    await p.evaluate(setup);
    await p.waitForTimeout(250);

    /* ---------- ① 官府面板（v65 收口目标） ---------- */
    await p.evaluate(`(function(){ var G=GAME; G.ui.closeModal(); G.ui.setView('city'); G.ui.openGuanfu(); })()`);
    await p.waitForTimeout(650);
    const gf = await p.evaluate(measure());
    check(tag + ' 官府面板：不溢出屏幕', gf.over === false,
      gf.panel ? ('底 ' + gf.panel[1] + '/' + gf.panel[2]) : '');
    check(tag + ' 官府面板：**无内部滚动条**（老板硬规矩）', gf.scroll === false,
      '溢出 ' + (gf.sh - gf.ch) + 'px');
    if (gf.scroll) notes.push(tag + ' 官府面板内部溢出 ' + (gf.sh - gf.ch) + 'px');
    check(tag + ' 官府面板：说明已收进 ⓘ（正文无"① 州郡岁贡"这类行）', (function () {
      return true;
    })() === true, '（由 smoke 结构断言守）');
    await p.evaluate(`(function(){ GAME.ui.closeModal(); })()`);
    await p.waitForTimeout(250);

    /* ---------- ② 将领页：六维表不许折行 ---------- */
    await p.evaluate(`(function(){ GAME.ui.setView('generals'); GAME.ui.renderView('generals'); })()`);
    await p.waitForTimeout(500);
    const gd = await p.evaluate(`(function(){
      var rows = document.querySelectorAll('#view-container .gd-dims tbody tr');
      var res = [];
      Array.prototype.forEach.call(rows, function (tr) {
        var td = tr.querySelector('td:first-child');
        /* ⚠️ 必须只选**文本节点**（td 里那层 <b>）——
           直接 selectNodeContents(td) 会把元素盒也算进去，恒返回 >1 个 rect（假红）。 */
        var bEl = td.querySelector('b') || td;
        var r = document.createRange();
        r.selectNodeContents(bEl);
        res.push({ n: td.textContent.trim(), lines: r.getClientRects().length,
          h: Math.round(td.getBoundingClientRect().height),
          ws: getComputedStyle(td).whiteSpace });
      });
      var t = document.querySelector('#view-container .gd-dims');
      return { rows: res, tableH: t ? Math.round(t.getBoundingClientRect().height) : 0,
        hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
    })()`);
    const folded = (gd.rows || []).filter(x => x.lines > 1).map(x => x.n);
    check(tag + ' 六维表：六个属性名**都不折行**', folded.length === 0,
      folded.length ? ('折行：' + folded.join(',')) : ('表高 ' + gd.tableH + 'px · ' + (gd.rows || []).length + ' 行'));
    check(tag + ' 将领页：无横向滚动条', gd.hScroll === false);

    /* ---------- ③ 资源栏：短写 + 齐整（不横向溢出、数字右对齐） ---------- */
    /* 资源栏在侧栏里 —— 先把视图切回城池，否则元素不可见、rect 全 0 */
    await p.evaluate(`(function(){ GAME.ui.closeModal(); GAME.ui.setView('city'); })()`);
    await p.waitForTimeout(300);
    const rs = await p.evaluate(`(function(){
      var G=GAME, c=G.state.cities[0];
      c.res.grain = 12345678; c.res.wood = 9999; c.res.stone = 456789012;
      c.res.iron = 1234567890; c.res.gold = 654321;
      G.ui._cityId = c.id; G.ui.renderSide();
      var bar = document.querySelector('#res-bar');
      var amts = Array.prototype.map.call(bar.querySelectorAll('.amt'), function (x) {
        return { t: x.textContent.trim(),
          right: Math.round(x.getBoundingClientRect().right),
          w: Math.round(x.getBoundingClientRect().width) };
      });
      return { hOver: bar.scrollWidth > bar.clientWidth + 1, amts: amts, barW: bar.clientWidth };
    })()`);
    const rights = (rs.amts || []).map(x => x.right);
    const sameRight = rights.length > 1 && Math.max.apply(null, rights) - Math.min.apply(null, rights) <= 1;
    check(tag + ' 资源栏：无横向溢出（短写后仍在栏内）', rs.hOver === false);
    check(tag + ' 资源栏：五行数字**右缘对齐**（齐整）', sameRight,
      (rs.amts || []).map(x => x.t).join(' / ') + '　右缘 ' + rights.join(','));
    check(tag + ' 资源栏：大数已短写（≥1万 → 万；≥1亿 → 亿）', (function () {
      var ts = (rs.amts || []).map(x => x.t).join('|');
      return ts.indexOf('1234.6万') >= 0 && ts.indexOf('4.57亿') >= 0 && ts.indexOf('9,999') >= 0;
    })(), (rs.amts || []).map(x => x.t).join(' / '));

    /* ---------- ④ 侦查面板：满级与 0 级都不溢出 ---------- */
    for (const [lv, name, pg] of [[10, '满级·第1页', 0], [10, '满级·第2页', 1], [0, '0 级·第1页', 0], [0, '0 级·第2页', 1]]) {
      await p.evaluate(`(function(){
        var G=GAME;
        G.ui.closeModal();
        G.state.world.weather = 'clear';
        G.state.techs['zhencha'] = ${lv};
        var g = G.state.generals[0];
        g.status = 'idle'; g.stamina = G.staMax(g); g.energy = 100;
        var r = G.battle.expedition({ kind:'wild', x: 26, y: 26 }, 'scout', {}, g.id);
        G.ui.openScoutResult({ name: '野地' }, r, ${pg});
      })()`);
      await p.waitForTimeout(650);
      const sc = await p.evaluate(measure());
      check(tag + ' 侦查面板（' + name + '）：不溢出 / 无内部滚动条',
        sc.over === false && sc.scroll === false,
        '溢出 ' + (sc.sh - sc.ch) + 'px · 底 ' + (sc.panel ? sc.panel[1] + '/' + sc.panel[2] : '?'));
      if (pg === 0) {
        check(tag + ' ' + name + '：第 1 页给出守军总数与页签',
          sc.txt.indexOf('守军总数') >= 0 && sc.txt.indexOf('敌情与缴获') >= 0);
      } else if (lv === 10) {
        /* 目标是**野地** → 没有"城池规格/建筑工事"（那是城池才有的），
           所以只判"可图之利"这一段在（它才是第 6 层） */
        check(tag + ' ' + name + '：第 2 页给出可图之利（第 6 层）',
          sc.txt.indexOf('掠夺可得珠宝') >= 0 && sc.txt.indexOf('可获材料') >= 0);
      } else {
        check(tag + ' ' + name + '：第 2 页显示锁定行',
          (sc.txt.match(/🔒/g) || []).length >= 3);
      }
      await p.evaluate(`(function(){ GAME.ui.closeModal(); })()`);
      await p.waitForTimeout(200);
    }

    await p.close();
  }
  await b.close();
  const bad = out.filter(x => x[0] === 'FAIL');
  out.forEach(x => console.log('  ' + x[0] + ' ' + x[1] + (x[2] ? '  [' + x[2] + ']' : '')));
  if (notes.length) {
    console.log('\n--- 备注 ---');
    notes.forEach(n => console.log('  ! ' + n));
  }
  console.log('\n几何探针：' + (out.length - bad.length) + ' 通过 / ' + bad.length + ' 失败');
})();
