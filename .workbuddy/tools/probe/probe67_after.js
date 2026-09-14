const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const check = (n, ok, ex) => out.push([ok ? 'OK  ' : 'FAIL', n, ex || '']);
  for (const vp of [[1600, 950], [1440, 900], [1366, 768]]) {
    const tag = vp[0] + 'x' + vp[1];
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1300);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程'); await p.waitForTimeout(1800);
    await p.evaluate(`(function(){ const G=GAME,s=G.state,c=s.cities[0];
      if(!s.map.grid&&G.map.generate) G.map.generate();
      c.res.grain=98765432; c.res.wood=1234567; c.res.stone=1234567; c.res.iron=1234567; c.res.gold=1234567;
      c.army={yibing:123456, gongjian:23456, xiliangtieqi:1234};
      G.ui._garrisonOpen = true; G.refreshAll(); })()`);
    await p.waitForTimeout(600);
    /* 视觉间距 = 两盒之间的空隙 + 后一列的内边距 + 竖线宽度（border-box 下后两者在列内部） */
    const d = await p.evaluate(`(function(){
      function vis(prev, next){
        if(!prev||!next) return null;
        var a=prev.getBoundingClientRect(), n=next.getBoundingClientRect();
        var cs=getComputedStyle(next);
        var pl=parseFloat(cs.paddingLeft)||0, bl=parseFloat(cs.borderLeftWidth)||0;
        return { box: Math.round(n.left-a.right), pl: pl, bl: bl,
          visual: Math.round(n.left-a.right+pl+bl), border: cs.borderLeftStyle+' '+cs.borderLeftWidth };
      }
      var rows=[].slice.call(document.querySelectorAll('#res-bar .res-line')).filter(function(el){ return el.querySelector('.amt'); });
      var rs=rows.map(function(el){
        var amt=el.querySelector('.amt'), rate=el.querySelector('.rate-wrap'), plus=el.querySelector('.plus-btn');
        return { t: amt.textContent.trim()+' | '+(rate?rate.textContent.trim():''),
          gap: vis(amt, rate), rateW: rate?Math.round(rate.getBoundingClientRect().width):null,
          rowH: Math.round(el.getBoundingClientRect().height), overflow: el.scrollWidth-el.clientWidth };
      });
      var gbs=[].slice.call(document.querySelectorAll('.gb-row')).map(function(el){
        var c=el.querySelector('.gb-c'), f=el.querySelector('.gb-f');
        return { t: c.textContent.trim()+' | '+f.textContent.trim(), gap: vis(c,f),
          overflow: el.scrollWidth-el.clientWidth };
      });
      var bar=document.querySelector('#res-bar'), gbl=document.querySelector('.gb-list');
      return { rs: rs, gbs: gbs, barOverflowX: bar? bar.scrollWidth-bar.clientWidth : null,
        gbOverflowX: gbl? gbl.scrollWidth-gbl.clientWidth : null };
    })()`);
    const r0 = d.rs[0] || {}, g0 = d.gbs[0] || {};
    check(tag + ' 资源行：存量与增速的视觉间距 >= 14px', (r0.gap ? r0.gap.visual : 0) >= 14,
      '盒间距 ' + (r0.gap ? r0.gap.box : '?') + ' + 内边距 ' + (r0.gap ? r0.gap.pl : '?')
      + ' + 竖线 ' + (r0.gap ? r0.gap.bl : '?') + ' = ' + (r0.gap ? r0.gap.visual : '?') + 'px（改前 6px）');
    check(tag + ' 资源行：两列之间有发丝竖线', !!(r0.gap && r0.gap.bl >= 1), r0.gap ? r0.gap.border : '');
    check(tag + ' 资源行：增速列宽 >= 70px', (r0.rateW || 0) >= 70, r0.rateW + 'px');
    check(tag + ' 资源行：不溢出、不折行', d.rs.every(x => x.overflow <= 0 && x.rowH <= 30),
      d.rs.map(x => x.rowH + 'px/' + x.overflow).join(' '));
    check(tag + ' 资源栏无横向溢出', d.barOverflowX === 0, 'overflowX ' + d.barOverflowX);
    check(tag + ' 驻军行：数量与耗粮的视觉间距 >= 14px（含竖线）', (g0.gap ? g0.gap.visual : 0) >= 14,
      g0.gap ? (g0.gap.box + ' + ' + g0.gap.pl + ' + ' + g0.gap.bl + ' = ' + g0.gap.visual + 'px（改前 6px）') : '');
    check(tag + ' 驻军行：不溢出', d.gbs.every(x => x.overflow <= 0), d.gbs.map(x => x.overflow).join(' '));
    check(tag + ' 驻军列表无横向溢出', d.gbOverflowX === 0, 'overflowX ' + d.gbOverflowX);
    if (vp[0] === 1440) await p.screenshot({ path: __dirname + '/v67-1-sidebar-1440x900.png' });
    await p.close();
  }
  await b.close();
  console.log('');
  let bad = 0;
  out.forEach(r => { if (r[0] !== 'OK  ') bad++; console.log(r[0] + '  ' + r[1] + (r[2] ? '  [' + r[2] + ']' : '')); });
  console.log('\n合计 ' + out.length + ' 项，失败 ' + bad + ' 项');
})();
