/* ============================================================
 * probe67_save2.js —— 存档规模实测（开局的 3.8KB 不算数，要量"后期"）
 *  ① 造一座 20 城 / 120 将 / 30 天 的中后期档，量真实落盘体积
 *  ② 量 5MB 配额能放几份这样的档（决定槽位数）
 *  ③ 量单次 saveGame 的耗时（决定"要不要每次 tick 都存"）
 * 用法: NODE_PATH=<...>/node_modules node .workbuddy/tools/probe67_save2.js
 * ============================================================ */
const { chromium } = require('playwright-core');
const kb = n => (n / 1024).toFixed(1) + 'KB';

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  p.on('pageerror', e => console.log('  ⚠️ 页面异常：' + e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForTimeout(1300);
  const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
  await p.click('text=开始新的征程');
  await p.waitForTimeout(2000);

  /* ---------- 造中后期档 ---------- */
  const rich = await p.evaluate(`(function(){
    var G=GAME, s=G.state;
    var out = { steps: [] };
    if (!s.map.grid && G.map && G.map.generate) { G.map.generate(); out.steps.push('map.generate'); }

    /* 20 座自家城池：直接照着第一座克隆，走 makeCity 保证字段齐 */
    var base = s.cities[0];
    while (s.cities.length < 20) {
      var lv = 5 + (s.cities.length % 6);
      var x = -160 + s.cities.length * 16, y = -120 + s.cities.length * 11;
      var c = G.makeCity({ name: '样本城' + s.cities.length, x: x, y: y, level: lv,
                           type: 'county', origId: 90 + s.cities.length });
      if (!c) break;
      /* 给点库存 / 兵 / 建筑，让它像"真玩过" */
      ['grain','wood','stone','iron','gold'].forEach(function(k,i){ c.res[k] = 50000 + i * 12345; });
      if (c.army) { for (var a in c.army) c.army[a] = 800 + Math.floor(Math.random()*2000); }
    }
    out.steps.push('cities=' + s.cities.length);

    /* 120 名将领（走 makeGeneral，含装备/等级） */
    var names = ['关羽','张飞','赵云','马超','黄忠','魏延','姜维','诸葛亮','庞统','法正'];
    while (s.generals.length < 120) {
      var ci = s.cities[s.generals.length % s.cities.length];
      var nm = names[s.generals.length % names.length] + (s.generals.length);
      var g = G.makeGeneral(nm, 30 + (s.generals.length % 80), 'idle', ci.id, false);
      if (!g) break;
      try { G.systems.autoEquip ? G.systems.autoEquip(g) : null; } catch(e){}
    }
    out.steps.push('generals=' + s.generals.length);

    /* 公文/日志堆满（看它们有没有上限） */
    for (var i = 0; i < 300; i++) {
      try { G.pushMsg ? G.pushMsg('样本公文 ' + i, 'sys') : null; } catch(e){}
    }
    out.steps.push('msgLog=' + ((s.msgLog||[]).length) + ' log=' + ((s.log||[]).length));

    /* 推进时间：离线补算 30 天（= 30*24*3600 游戏秒） */
    try { G.simulateBulk(24 * 30); out.steps.push('simulateBulk(30d)'); } catch(e){ out.steps.push('simulateBulk 失败:' + e.message); }
    return out;
  })()`);
  console.log('=== 造档过程 ===');
  rich.steps.forEach(s => console.log('  · ' + s));

  /* ---------- 落盘体积 ---------- */
  const sz = await p.evaluate(`(function(){
    var G=GAME, s=G.state;
    var t0 = performance.now();
    var ok = G.saveGame();
    var t1 = performance.now();
    var raw = localStorage.getItem('sanguo_save_v3') || '';
    var meta = localStorage.getItem('sanguo_meta_v3') || '';
    /* 各字段在"真正落盘的那份 JSON"里的占比 */
    var parts = [];
    try {
      var obj = JSON.parse(raw);
      Object.keys(obj).forEach(function(k){
        var v = JSON.stringify(obj[k]); parts.push([k, v ? v.length : 0]);
      });
      parts.sort(function(a,b){ return b[1]-a[1]; });
    } catch(e){}
    return { ok: ok, ms: (t1 - t0), main: raw.length, meta: meta.length,
             parts: parts.slice(0, 10), cities: s.cities.length, gens: s.generals.length };
  })()`);
  console.log('');
  console.log('=== 落盘实测（20 城 / ' + sz.gens + ' 将 / 30 天）===');
  console.log('  存档主档 : ' + sz.main + ' B (' + kb(sz.main) + ')   写入耗时 ' + sz.ms.toFixed(1) + ' ms');
  console.log('  轻量索引 : ' + sz.meta + ' B');
  console.log('  字段占比：');
  sz.parts.forEach(function (x) {
    console.log('    ' + x[0].padEnd(14) + String(x[1]).padStart(8) + ' B   ' + (x[1] / sz.main * 100).toFixed(1) + '%');
  });

  /* ---------- 配额能放几份 ---------- */
  const slot = await p.evaluate(`(function(){
    var raw = localStorage.getItem('sanguo_save_v3') || '';
    var one = raw.length;
    var quota = 0, lo = 0, hi = 20 * 1024 * 1024;
    try {
      while (lo <= hi) { var mid = Math.floor((lo+hi)/2);
        try { localStorage.setItem('__q__', 'x'.repeat(mid)); quota = mid; lo = mid + 1024; }
        catch (e) { hi = mid - 1024; } }
    } catch(e){}
    try { localStorage.removeItem('__q__'); } catch(e){}
    return { one: one, quota: quota, n: Math.floor(quota / one) };
  })()`);
  console.log('');
  console.log('=== 槽位容量推算 ===');
  console.log('  配额 ' + (slot.quota / 1048576).toFixed(2) + ' MB ÷ 单档 ' + kb(slot.one) + ' = **' + slot.n + ' 份**');

  /* ---------- 单次 saveGame 耗时（连测 20 次） ---------- */
  const perf = await p.evaluate(`(function(){
    var t = [], G=GAME;
    for (var i=0;i<20;i++){ var a=performance.now(); G.saveGame(); t.push(performance.now()-a); }
    t.sort(function(x,y){return x-y;});
    return { min: t[0], med: t[10], max: t[19] };
  })()`);
  console.log('  单次存盘：最快 ' + perf.min.toFixed(1) + ' ms · 中位 ' + perf.med.toFixed(1) + ' ms · 最慢 ' + perf.max.toFixed(1) + ' ms');

  await b.close();
})();
