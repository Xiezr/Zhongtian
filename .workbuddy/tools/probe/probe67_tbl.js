const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const vp of [[1440, 900], [1366, 768]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1300);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程'); await p.waitForTimeout(1800);
    await p.evaluate(`(function(){ const G=GAME,s=G.state,c=s.cities[0];
      if(!s.map.grid&&G.map.generate) G.map.generate();
      c.res.grain=98765432; c.res.wood=1234567; G.refreshAll();
      GAME.ui.setView('stats'); })()`);
    await p.waitForTimeout(600);
    const d = await p.evaluate(`(function(){
      var t = document.querySelector('.ui-page table.tbl');
      if(!t) return {none:true};
      var th = [].slice.call(t.querySelectorAll('thead th')).map(function(x){
        var r=x.getBoundingClientRect(); return { t:x.textContent.trim(), w:Math.round(r.width), l:Math.round(r.left), r:Math.round(r.right) }; });
      var tr = t.querySelector('tbody tr');
      var td = tr?[].slice.call(tr.querySelectorAll('td')).map(function(x){
        var r=x.getBoundingClientRect(); return { t:x.textContent.replace(/\\s+/g,' ').trim(), w:Math.round(r.width), l:Math.round(r.left), r:Math.round(r.right),
          pad: getComputedStyle(x).paddingLeft + '/' + getComputedStyle(x).paddingRight, cls: x.className }; }):[];
      var gaps=[]; for(var i=1;i<td.length;i++) gaps.push(Math.round(td[i].l - td[i-1].r));
      return { tableW: Math.round(t.getBoundingClientRect().width),
        pageScrollX: document.documentElement.scrollWidth > window.innerWidth+1,
        th: th, td: td, gaps: gaps,
        gb: [].slice.call(document.querySelectorAll('.gb-row')).map(function(el){
          var n=el.querySelector('.gb-n'), c=el.querySelector('.gb-c'), f=el.querySelector('.gb-f');
          var R=function(x){ if(!x) return null; var r=x.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.right),Math.round(r.width)]; };
          return { nR:R(n), cR:R(c), fR:R(f), gap: (c&&f)?Math.round(f.getBoundingClientRect().left - c.getBoundingClientRect().right):null }; }) };
    })()`);
    console.log('===== ' + vp[0] + 'x' + vp[1] + ' 统计页表格 宽 ' + d.tableW + ' 横向溢出 ' + d.pageScrollX + ' =====');
    if (!d.none) {
      d.th.forEach((x, i) => console.log('   th[' + i + '] ' + x.t + ' w' + x.w + ' [' + x.l + ',' + x.r + ']'
        + '  td「' + (d.td[i] ? d.td[i].t : '-') + '」 w' + (d.td[i] ? d.td[i].w : '-')
        + ' pad' + (d.td[i] ? d.td[i].pad : '-') + ' cls' + (d.td[i] ? d.td[i].cls : '-')
        + ' 相邻间距' + (d.gaps[i - 1] !== undefined ? d.gaps[i - 1] : '-')));
    }
    await p.evaluate(`GAME.ui.setView('city')`);
    await p.waitForTimeout(300);
    console.log('   驻军行：' + JSON.stringify(d.gb));
    await p.close();
  }
  await b.close();
})();
