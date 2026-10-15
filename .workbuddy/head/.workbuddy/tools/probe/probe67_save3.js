/* ============================================================
 * probe67_save3.js —— 存档规模实测（v2 因循环无出口挂死，这里全部加护栏）
 * 目的：为"网页游戏该用什么存档设计"提供实测依据。
 *  ① 造中后期档（20 城 / 120 将 / 堆满公文与日志）→ 量真实落盘体积
 *  ② 5MB 配额 ÷ 单档 = 能放几份（决定槽位数）
 *  ③ 单次 saveGame 耗时（决定存档频率）
 * 用法: NODE_PATH=<...>/node_modules node .workbuddy/tools/probe67_save3.js
 * ============================================================ */
const { chromium } = require('playwright-core');
const kb = n => (n / 1024).toFixed(1) + 'KB';

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  p.on('pageerror', e => console.log('  ⚠️ 页面异常：' + e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForTimeout(1200);
  const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
  await p.click('text=开始新的征程');
  await p.waitForTimeout(1800);

  const rich = await p.evaluate(`(function(){
    var G=GAME, s=G.state, out=[];
    function guard(n, fn){ var i=0; while (i < n) { if (!fn(i)) break; i++; } return i; }

    /* 20 城：makeCity 只造对象，入数组要自己 push（battle.js 就是这么做的） */
    guard(19, function(i){
      var c = G.makeCity({ id: 'p' + (2 + i), name: '样本城' + (2 + i),
        x: -160 + i * 16, y: -120 + i * 11, level: 3 + (i % 8),
        type: (i % 3 === 0 ? 'county' : 'self'), origId: 90 + i });
      if (!c) return false;
      ['grain','wood','stone','iron','gold'].forEach(function(k, j){ c.res[k] = 50000 + j * 12345; });
      if (c.army) for (var a in c.army) c.army[a] = 800 + (i * 37) % 2000;
      c.wallLv = i % 8;
      s.cities.push(c);
      return true;
    });
    out.push('城池 ' + s.cities.length + ' 座');

    /* 120 将：同样手工入数组 */
    var names = ['关羽','张飞','赵云','马超','黄忠','魏延','姜维','诸葛亮','庞统','法正','徐庶','陆逊'];
    guard(119, function(i){
      var ci = s.cities[i % s.cities.length];
      var g = G.makeGeneral(names[i % names.length] + i, 5 + (i % 100), 'idle', ci.id, false);
      if (!g) return false;
      s.generals.push(g);
      return true;
    });
    out.push('将领 ' + s.generals.length + ' 名');

    /* 堆公文与日志：看有没有上限（state.js 注释说 log 保留 40 条） */
    guard(400, function(i){ try { G.log('量体样本 ' + i + '：' + '长文本'.repeat(6)); } catch(e){ return false; } return true; });
    out.push('log ' + ((s.log || []).length) + ' 条 · msgLog ' + ((s.msgLog || []).length) + ' 条');

    /* 野地若干 */
    guard(40, function(i){
      if (!s.wilds) return false;
      if (s.wilds.length >= 40) return false;
      s.wilds.push({ id: 'w' + i, x: 10 + i, y: 20 + i, terrain: 'forest', lv: 3, cityId: s.cities[0].id,
                     army: { bow: 500 }, gatherers: null });
      return true;
    });
    out.push('野地 ' + ((s.wilds || []).length) + ' 处');
    return out;
  })()`);
  console.log('=== 造档 ===');
  rich.forEach(s => console.log('  · ' + s));

  const sz = await p.evaluate(`(function(){
    var G=GAME, s=G.state;
    var t0 = performance.now(); var ok = G.saveGame(); var t1 = performance.now();
    var raw = localStorage.getItem('sanguo_save_v3') || '';
    var meta = localStorage.getItem('sanguo_meta_v3') || '';
    var parts = [];
    try { var o = JSON.parse(raw);
      Object.keys(o).forEach(function(k){ var v = JSON.stringify(o[k]); parts.push([k, v ? v.length : 0]); });
      parts.sort(function(a,b){ return b[1]-a[1]; });
    } catch(e){}
    return { ok: ok, ms: t1 - t0, main: raw.length, meta: meta.length, parts: parts.slice(0, 8) };
  })()`);
  console.log('');
  console.log('=== 落盘实测（20 城 / 120 将 / 堆满公文）===');
  console.log('  主档 ' + sz.main + ' B (' + kb(sz.main) + ')   写入 ' + sz.ms.toFixed(1) + ' ms   索引 ' + sz.meta + ' B   ok=' + sz.ok);
  sz.parts.forEach(function (x) {
    console.log('    ' + x[0].padEnd(14) + String(x[1]).padStart(8) + ' B   ' + (x[1] / sz.main * 100).toFixed(1) + '%');
  });

  const slot = await p.evaluate(`(function(){
    var one = (localStorage.getItem('sanguo_save_v3') || '').length;
    var quota = 0, lo = 0, hi = 20 * 1024 * 1024;
    try { while (lo <= hi) { var mid = Math.floor((lo + hi) / 2);
      try { localStorage.setItem('__q__', 'x'.repeat(mid)); quota = mid; lo = mid + 1024; }
      catch (e) { hi = mid - 1024; } } } catch(e){}
    try { localStorage.removeItem('__q__'); } catch(e){}
    return { one: one, quota: quota, n: Math.floor(quota / Math.max(1, one)) };
  })()`);
  console.log('');
  console.log('=== 槽位容量 ===');
  console.log('  配额 ' + (slot.quota / 1048576).toFixed(2) + ' MB ÷ 单档 ' + kb(slot.one) + ' = ' + slot.n + ' 份');

  const perf = await p.evaluate(`(function(){
    var t=[], G=GAME;
    for (var i=0;i<20;i++){ var a=performance.now(); G.saveGame(); t.push(performance.now()-a); }
    t.sort(function(x,y){return x-y;});
    return { min:t[0], med:t[10], max:t[19] };
  })()`);
  console.log('  单次存盘：最快 ' + perf.min.toFixed(1) + ' / 中位 ' + perf.med.toFixed(1) + ' / 最慢 ' + perf.max.toFixed(1) + ' ms');

  await b.close();
})();
