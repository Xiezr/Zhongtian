/* ============================================================
 * probe67_save.js —— 量「存档体积 / 配额余量 / 各字段占比」
 * 用途：为"网页游戏该用什么存档设计"提供实测依据（不是拍脑袋）。
 * 用法: NODE_PATH=<...>/node_modules node .workbuddy/tools/probe67_save.js
 * ============================================================ */
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForTimeout(1300);
  const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
  await p.click('text=开始新的征程');
  await p.waitForTimeout(2000);

  const kb = n => (n / 1024).toFixed(1) + 'KB';

  /* ---------- 1) 开局态 ---------- */
  const fresh = await p.evaluate(`(function(){
    var G=GAME, s=G.state;
    var json = JSON.stringify(s);
    var keys = Object.keys(s);
    var parts = keys.map(function(k){
      var v = JSON.stringify(s[k]);
      return [k, v ? v.length : 0];
    }).sort(function(a,b){ return b[1]-a[1]; });
    return { total: json.length, version: s.version, parts: parts.slice(0,12) };
  })()`);
  console.log('=== 开局态存档 ===');
  console.log('  JSON 总长 : ' + fresh.total + ' 字节 (' + kb(fresh.total) + ')  version=' + fresh.version);
  console.log('  字段占比（前 12）：');
  fresh.parts.forEach(function (x) { console.log('    ' + x[0].padEnd(16) + fresh.total ? '' : ''); });
  fresh.parts.forEach(function (x) {
    console.log('    ' + x[0].padEnd(16) + String(x[1]).padStart(9) + ' B   ' + (x[1] / fresh.total * 100).toFixed(1) + '%');
  });

  /* ---------- 2) 推进 10 游戏日后再量（消息/战报/队列会长） ---------- */
  const later = await p.evaluate(`(function(){
    var G=GAME, s=G.state;
    try { if (G.simulateBulk) G.simulateBulk(24*10); } catch(e){}
    try { G.refreshAll(); } catch(e){}
    var json = JSON.stringify(s);
    var keys = Object.keys(s);
    var parts = keys.map(function(k){ var v=JSON.stringify(s[k]); return [k, v?v.length:0]; })
                    .sort(function(a,b){ return b[1]-a[1]; });
    return { total: json.length, parts: parts.slice(0,10),
             msg: (s.msgLog||[]).length, gen: (s.generals||[]).length,
             city: (s.cities||[]).length, d0: s.day };
  })()`);
  console.log('');
  console.log('=== 推进 10 游戏日后（day=' + later.d0 + '）===');
  console.log('  JSON 总长 : ' + later.total + ' 字节 (' + kb(later.total) + ')');
  console.log('  城池 ' + later.city + ' 座 · 将领 ' + later.gen + ' 名 · 公文 ' + later.msg + ' 条（分页上限外还会截断）');
  later.parts.forEach(function (x) {
    console.log('    ' + x[0].padEnd(16) + String(x[1]).padStart(9) + ' B   ' + (x[1] / later.total * 100).toFixed(1) + '%');
  });

  /* ---------- 3) localStorage 现状 + 配额实测 ---------- */
  const quota = await p.evaluate(`(function(){
    var used = 0, keys = [];
    for (var i=0;i<localStorage.length;i++){
      var k = localStorage.key(i);
      var n = (localStorage.getItem(k)||'').length + k.length;
      used += n; keys.push([k, n]);
    }
    /* 二分找这个来源的 localStorage 配额 */
    var probeKey = '__quota_probe__';
    var lo = 0, hi = 20 * 1024 * 1024, best = 0;
    try {
      while (lo <= hi) {
        var mid = Math.floor((lo+hi)/2);
        try { localStorage.setItem(probeKey, 'x'.repeat(mid)); best = mid; lo = mid + 1024; }
        catch (e) { hi = mid - 1024; }
      }
    } catch (e) {}
    try { localStorage.removeItem(probeKey); } catch (e) {}
    return { used: used, keys: keys, quota: best };
  })()`);
  console.log('');
  console.log('=== localStorage 现状 ===');
  console.log('  已用合计 : ' + quota.used + ' 字节 (' + kb(quota.used) + ')');
  quota.keys.forEach(function (k) { console.log('    ' + k[0].padEnd(24) + String(k[1]).padStart(9) + ' B'); });
  console.log('  实测配额 : ' + quota.quota + ' 字节 = ' + (quota.quota / 1048576).toFixed(2) + ' MB');

  /* ---------- 4) 导出/导入入口现状 ---------- */
  const ui = await p.evaluate(`(function(){
    var s = document.body.innerHTML;
    return { hasExport: /导出/.test(s), hasImport: /导入/.test(s), hasSlot: /存档槽|槽位/.test(s) };
  })()`);
  console.log('');
  console.log('=== 界面入口现状 ===');
  console.log('  导出按钮:' + ui.hasExport + '  导入按钮:' + ui.hasImport + '  槽位字样:' + ui.hasSlot);

  await b.close();
})();
