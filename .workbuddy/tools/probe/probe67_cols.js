/* ============================================================
 * probe67_cols.js —— 量「资源栏 / 统计账册」的列与间距（改前基线 + 改后对比）
 * 用法: NODE_PATH=<...>/node_modules node .workbuddy/tmp/probe67_cols.js
 * ============================================================ */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const vp of [[1600, 950], [1440, 900], [1366, 768]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1300);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程'); await p.waitForTimeout(1800);
    await p.evaluate(`(function(){ const G=GAME,s=G.state,c=s.cities[0];
      if(!s.map.grid&&G.map.generate) G.map.generate();
      ['grain','wood','stone','iron','gold'].forEach(function(k){ c.res[k]=1234567; });
      c.res.grain = 98765432;
      G.refreshAll(); })()`);
    await p.waitForTimeout(500);
    const d = await p.evaluate(`(function(){
      var R = function(el){ if(!el) return null; var r=el.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; };
      var bar = document.querySelector('#res-bar');
      var rows = [].slice.call(document.querySelectorAll('#res-bar .res-line'));
      var out = rows.map(function(el){
        var lbl=el.querySelector('.lbl'), val=el.querySelector('.val');
        var amt=el.querySelector('.amt'), rate=el.querySelector('.rate-wrap')||el.querySelector('.num-rate');
        var plus=el.querySelector('.plus-btn'), badge=el.querySelector('.item-badge');
        var a=R(amt), rt=R(rate);
        return { lbl: lbl?lbl.textContent.trim():'', lblR:R(lbl), valR:R(val), amtR:a, rateR:rt,
          plusR:R(plus), badgeR:R(badge),
          gapAmt2Rate: (a&&rt)?(rt[0]-a[1]):null,
          gapRate2Plus: (rt&&plus)?(R(plus)[0]-rt[1]):null,
          rowW: Math.round(el.getBoundingClientRect().width),
          amtTxt: amt?amt.textContent.trim():'', rateTxt: rate?rate.textContent.trim():'' };
      });
      /* 统计账册 */
      GAME.ui.setView('stats');
      var led = document.querySelector('.ledger');
      var lg = [].slice.call(document.querySelectorAll('.lg-row')).map(function(el){
        var k=el.querySelector('.lg-k'), v=el.querySelector('.lg-v'), sub=el.querySelector('.lg-sub');
        return { k: k?k.textContent.trim():'', v: v?v.textContent.trim():'',
          kR:R(k), vR:R(v), subR:R(sub),
          gapKV: (k&&v)?(R(v)[0]-R(k)[1]):null,
          subGapInV: sub&&v? (R(sub)[0]-R(v)[0]) : null };
      });
      return { barW: bar?Math.round(bar.getBoundingClientRect().width):null,
        sideW: (function(){ var x=document.querySelector('#sidebar')||document.querySelector('.side'); return x?Math.round(x.getBoundingClientRect().width):null; })(),
        rows: out, lg: lg.slice(0,6), ledW: led?Math.round(led.getBoundingClientRect().width):null,
        lgRowW: lg.length?Math.round(document.querySelector('.lg-row').getBoundingClientRect().width):null };
    })()`);
    console.log('===== ' + vp[0] + 'x' + vp[1] + '  侧栏宽 ' + d.sideW + '  资源栏宽 ' + d.barW + '  账册宽 ' + d.ledW + ' =====');
    d.rows.forEach(r => {
      console.log('  ' + r.lbl + '  行宽' + r.rowW
        + ' lbl' + JSON.stringify(r.lblR) + ' amt' + JSON.stringify(r.amtR)
        + ' rate' + JSON.stringify(r.rateR)
        + '  存量→速率间距 ' + r.gapAmt2Rate + '  速率→+ 间距 ' + r.gapRate2Plus
        + '   「' + r.amtTxt + ' | ' + r.rateTxt + '」');
    });
    console.log('  -- 账册（值/副值）--');
    d.lg.forEach(r => console.log('     「' + r.k + '」「' + r.v + '」 kR' + JSON.stringify(r.kR)
      + ' vR' + JSON.stringify(r.vR) + ' subR' + JSON.stringify(r.subR) + ' 值→副值 ' + r.subGapInV));
    await p.close();
  }
  await b.close();
})();
