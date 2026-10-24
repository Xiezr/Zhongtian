/* ============================================================
 * audit_v125b_perf_ui.js —— 实机 UI 性能门禁（v125b · 审核 P0-1 的常驻尺子）
 * ------------------------------------------------------------
 * 为什么需要它：`smoke §87` 的性能护栏只量 `tickOnce`（逻辑层），
 *   **覆盖不到渲染路径**。于是 `P.spots` 按 4000 次抽样逐格跑 BFS（3712 次 / 2.4s）
 *   一直绿灯，直到实机点击测出「前传一次清剿同步阻塞 7.2 秒」。
 *
 * 判据（都带下限，防"空数据飞快"的平凡解）：
 *   ① 正式局：ui.setView 五个视图各 < 100ms，且每个视图 DOM 节点 ≥ 300
 *   ② 前传态：GAME.refreshAll() 三轮取最小 < 400ms（修前 2,511ms）
 *   ③ 前传态：prologue.spots() 精确距离调用 ≤ 20 次，且返回 ≥ 1 处
 *
 * 用法：
 *   NODE_PATH=<...>/node_modules node .workbuddy/tools/audit/audit_v125b_perf_ui.js
 *   退出码 0 = 全绿；1 = 有红项
 * ============================================================ */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
/* v131：`distOf` 上界从 20 放到 40 —— 它现在是 **O(视野环内格数)**，
   而前传的出生点会"就近挪到有事的格子"（P.begin），环内格数随之变化，
   实测同一份代码在不同出生点上是 20 / 21 次。绑死 20 等于绑死一个位置。
   40 仍是原 BFS 实现（3,712 次）的 1/90 —— 只要不回到那个量级，判据就还有效。 */
const TH = { viewMs: 100, nodes: 300, refreshMs: 400, distOf: 40 };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT.replace(/\\/g, '/') + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* ---------- ① 正式局：视图切换 ---------- */
  const v = await p.evaluate((th) => {
    const G = window.GAME, out = { times: {}, nodes: {} };
    G.newGame({ name: '性能审核', cityName: '灰岗', mapSeed: 20261023 });
    G.ui.enterGame();
    ['city', 'admin', 'generals', 'bag', 'map'].forEach((k) => {
      const t = performance.now();
      G.ui.setView(k);
      out.times[k] = Math.round(performance.now() - t);
      out.nodes[k] = document.querySelectorAll('*').length;
    });
    out.cities = (G.state.cities || []).length;
    return out;
  }, TH);

  console.log('① 正式局视图切换（阈值 ' + TH.viewMs + 'ms）');
  ok('新建局有城（下限：1 座，防"空局面飞快"）', v.cities >= 1, '城 ' + v.cities);
  Object.keys(v.times).forEach((k) => {
    ok('setView(' + k + ') < ' + TH.viewMs + 'ms', v.times[k] < TH.viewMs, v.times[k] + 'ms');
    ok('  └ ' + k + ' 渲染节点 ≥ ' + TH.nodes, v.nodes[k] >= TH.nodes, v.nodes[k] + ' 个');
  });

  /* ---------- ④ 出征面板：军师估算 ---------- */
  console.log('④ 出征面板「军师估算」（v127）');
  const est = await p.evaluate(() => {
    const G = window.GAME, c = G.currentCity ? G.currentCity() : null;
    if (!c) return { err: 'no city' };
    if (G.city && G.city.armyAdd) G.city.armyAdd(c, { buxingji: 6000, daodanche: 3000, dunwei: 2000, zhuzhan: 800 });
    let ci = -1;
    const sp = G.sphereOf();
    for (let i = 0; i < sp.cells.length; i++) {
      if (sp.cells[i] && sp.cells[i].type && !G.map.ownCityAt(i)) { ci = i; break; }
    }
    try { G.ui.openExpModal({ kind: 'wild', ci: ci }); } catch (e) { return { err: e.message }; }
    const fill = { buxingji: 6000, daodanche: 3000, dunwei: 2000, zhuzhan: 800 };
    Object.keys(fill).forEach((id) => {
      const el = document.getElementById('exp-' + id);
      if (el) { el.value = String(fill[id]); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    const box = document.getElementById('exp-power');
    if (!box) return { err: 'no #exp-power' };
    /* v127 修过一处 `+ +`（一元加号把空字符串变成 0，面板上挂着孤零零的 "0"）——这里钉住它 */
    const stray = Array.from(box.childNodes)
      .filter((n) => n.nodeType === 3 && /^\s*\d+\s*$/.test(n.nodeValue || ''))
      .map((n) => n.nodeValue);
    return {
      stray: stray,
      hasEst: (box.textContent || '').indexOf('预计损兵') >= 0,
      text: (box.textContent || '').replace(/\s+/g, ' ').slice(0, 110),
    };
  });
  ok('面板能打开且有内容', !est.err, est.err || 'ok');
  ok('不出现孤立数字节点（+ + 强制转换类 bug）', !!est.stray && est.stray.length === 0, JSON.stringify(est.stray || []));
  ok('含「预计损兵」', !!est.hasEst, est.text || '');

  /* ---------- ②③ 前传态 ---------- */
  const pr = await p.evaluate((th) => {
    const G = window.GAME, out = {};
    G.newGame({ name: '性能审核', cityName: '灰岗', prologue: true });
    G.ui.enterGame();
    if (!G.state.map.grid && G.map && G.map.generate) G.map.generate();

    const sp = G.sphereOf ? G.sphereOf() : G.sphere;
    let n = 0;
    const orig = sp.distOf;
    sp.distOf = function (a, b) { n++; return orig.apply(this, arguments); };
    const spots = G.prologue.spots();
    sp.distOf = orig;
    out.distOf = n;
    out.spots = spots.length;

    let best = 1e9;
    for (let i = 0; i < 3; i++) { const t = Date.now(); G.refreshAll(); const d = Date.now() - t; if (d < best) best = d; }
    out.refreshMin = best;
    out.on = G.prologue.on();
    return out;
  }, TH);

  console.log('② 前传 refreshAll（阈值 ' + TH.refreshMs + 'ms · 修前 2,511ms）');
  ok('确实处于前传态（下限：on===true，防测错场景）', pr.on === true, 'on=' + pr.on);
  ok('refreshAll 三轮取最小 < ' + TH.refreshMs + 'ms', pr.refreshMin < TH.refreshMs, pr.refreshMin + 'ms');
  console.log('③ 前传 spots 距离调用上界');
  ok('返回 ≥ 1 处（下限：防"空结果也通过"）', pr.spots >= 1, pr.spots + ' 处');
  ok('distOf ≤ ' + TH.distOf + ' 次（原 3,712 次 · O(环内格数)）', pr.distOf <= TH.distOf, pr.distOf + ' 次');
  ok('无页面运行时异常', errs.length === 0, errs.slice(0, 2).join(' | ') || '无');

  /* ---------- ④⑤ 层叠守卫（v130：前传 HUD 压住弹窗的回归） ----------
     病根：前传层挂在 body 上、z-index:70，而全站弹窗活在 #app-scale 里 ——
     那个节点带 transform:scale()，是**独立层叠上下文**，内部 z-index:1000 对外等于 auto。
     于是前传 HUD 压住整幅画面和所有弹窗，出征面板的「占领/掠夺」点不动。
     判据直接问浏览器"这个坐标最上面是谁"，不猜 z-index 数值。 */
  const layer = await p.evaluate(() => {
    const G = window.GAME, out = {};
    const ps = document.getElementById('prologue-screen');
    out.hudExists = !!ps;
    out.hudParent = ps && ps.parentNode ? (ps.parentNode.id || ps.parentNode.tagName) : null;
    out.hudPos = ps ? getComputedStyle(ps).position : null;
    /* 打开出征面板（前传态下仍可打开 —— 这是玩家会做的事） */
    const sp = G.sphereOf ? G.sphereOf() : G.sphere;
    let ci = -1;
    for (let i = 0; i < sp.cells.length; i++) {
      if (sp.cells[i] && sp.cells[i].type && !(G.map.ownCityAt && G.map.ownCityAt(i))) { ci = i; break; }
    }
    out.ci = ci;
    try { G.ui.openExpModal({ kind: 'wild', ci: ci }); } catch (e) { out.openErr = e.message; }
    const el = document.querySelector('#modal-root [data-action="exp-confirm"]');
    if (!el) { out.btn = 'missing'; return out; }
    const rc = el.getBoundingClientRect();
    const cx = Math.round(rc.left + rc.width / 2), cy = Math.round(rc.top + rc.height / 2);
    const hit = document.elementsFromPoint(cx, cy)[0];
    out.btnText = (el.textContent || '').trim();
    out.btnY = Math.round(rc.top);
    out.hitIsBtn = !!(hit && (hit === el || el.contains(hit)));
    out.hitTag = hit ? (hit.tagName + '#' + (hit.id || '-')) : 'null';
    /* 前传 HUD 的实际占位（判断是否真的与按钮重叠） */
    const hb = ps ? ps.getBoundingClientRect() : null;
    out.hudRect = hb ? [Math.round(hb.top), Math.round(hb.bottom)] : null;
    try { G.ui.closeAllModals(); } catch (e) {}
    return out;
  });
  console.log('④ 前传 HUD 的层叠归属');
  ok('前传 HUD 必须挂在 #app-scale 内（与弹窗同一栈）', layer.hudParent === 'app-scale', '父节点=' + layer.hudParent);
  ok('前传 HUD 用 absolute（不是 fixed，fixed 会跳出缩放坐标系）', layer.hudPos === 'absolute', 'position=' + layer.hudPos);
  console.log('⑤ 前传态下出征确认按钮可点（回归守卫）');
  ok('面板里找得到确认按钮', layer.btn === 'undefined' || layer.btn === 'missing' ? false : true, '按钮=' + (layer.btnText || layer.btn || '?'));
  ok('按钮位置在最上层（修前被前传 HUD 盖住）', layer.hitIsBtn === true, '该点最上层=' + layer.hitTag);

  /* ---------- ⑥ 城内 3D（v142）：进得去、看得见人、走得出城门 ----------
     为什么这三条必须在实机里量：
       · **俯角**是相机算出来的，smoke 里没有 THREE，算不出来；
       · **玩家在不在画面里**要投影到 NDC —— 这个问题让老板看到的就是"城里没人"；
       · **走出城门**是键盘走出来的，改代码看不出来。
     判据都带上下限（俯角区间、NDC 区间、像素体积下限），"等于某个值"那种校验过不了平凡解。 */
  const cityIn = await p.evaluate(() => {
    const G = window.GAME;
    G.newGame({ name: '城内审核', cityName: '灰岗', mapSeed: 20261025 });
    G.ui.enterGame(); G.ui.setView('city');
    const c = G.currentCity();
    const ids = ['minfang', 'shuyuan', 'junying', 'cangku', 'tiejiangpu', 'shichang'];
    for (let i = 0; i < c.cells.length; i++) {
      if (c.cells[i].official) continue;
      if (i % 4 === 0) continue;
      c.cells[i].build = { id: ids[i % ids.length], lvl: (i % 5) + 1 };
    }
    const r = G.scene3d.openCity();
    return { ok: !!r.ok, buildings: c.cells.filter((x) => x.build).length };
  });
  await p.waitForTimeout(900);
  const cd = await p.evaluate(() => window.GAME.scene3d._debug());
  console.log('⑥ 城内 3D（v142：能逛的街区）');
  ok('进得去（openCity 成功 · cityView=true · 有碰撞体）',
    cityIn.ok === true && !!cd && cd.cityView === true && cd.bounded === true,
    '建筑 ' + cityIn.buildings + ' 栋 · 碰撞盒 ' + (cd ? cd.solids : '?' ));
  ok('俯角在 55°~75°（街区视角，不是俯瞰也不是平视）',
    !!cd && cd.pitchDeg >= 55 && cd.pitchDeg <= 75, (cd ? cd.pitchDeg : '?') + '°');
  ok('玩家投影落在画面内（NDC x∈[-1,1] · y∈[-0.9,0.5]）',
    !!cd && Math.abs(cd.ndc.x) < 1 && cd.ndc.y > -0.9 && cd.ndc.y < 0.5,
    cd ? ('ndc=' + cd.ndc.x.toFixed(2) + ',' + cd.ndc.y.toFixed(2)) : '无 _debug');
  /* 画面真的画了东西：纯色 PNG 会非常小，有建筑/街道/人物的会大一个量级 */
  const shotPath = path.join(ROOT, '.workbuddy', 'shots', 'audit-city.png');
  let shotSize = 0;
  try {
    await p.screenshot({ path: shotPath });
    shotSize = require('fs').statSync(shotPath).size;
  } catch (e) { shotSize = 0; }
  ok('画面有内容（截图 ≥ 60KB，防"白屏也算通过"）', shotSize >= 60000, Math.round(shotSize / 1024) + 'KB');
  /* 走出城门：一路往南按 S，越过门槛就该关场景 */
  await p.keyboard.down('s');
  await p.waitForTimeout(3200);
  await p.keyboard.up('s');
  await p.waitForTimeout(400);
  const closed = await p.evaluate(() => window.GAME.scene3d.current());
  ok('走到城门就出城（不用回头按 E）', closed === null, 'current=' + closed);
  /* 进屋：3D 里点建筑 → 开**那一格**的建筑面板（不是"回城市页"了事）。
     这一步是"屋里进得去"的实机证据 —— smoke 只能验参数交接，验不了面板真出现。 */
  const enter = await p.evaluate(() => {
    const G = window.GAME;
    G.scene3d.openCity();
    const c = G.currentCity();
    let idx = -1;
    for (let i = 0; i < c.cells.length; i++) {
      if (c.cells[i] && c.cells[i].build && c.cells[i].build.id) { idx = i; break; }
    }
    const r = idx >= 0 ? G.scene3d.enterBuilding(idx) : { ok: false };
    const root = document.querySelector('#modal-root');
    const txt = root ? (root.textContent || '') : '';
    try { G.ui.closeAllModals(); } catch (e) {}
    return { ok: !!r.ok, idx: idx, hasPanel: /Lv\s*\d/.test(txt), scene: G.scene3d.current(), len: txt.length };
  });
  ok('进屋：点建筑 → 打开那一格的建筑面板（3D 已关）',
    enter.ok === true && enter.hasPanel === true && enter.scene === null,
    'idx=' + enter.idx + ' · 面板 ' + enter.len + ' 字');

  /* 地图动线：城市面板 →「进城逛逛（3D）」一步落到街上（v60 老板要求"别一点地图就进城"，
     所以入口仍在面板里；这一条验的是"点了之后真的进了 3D，而不是停在 2D 棋盘"）。
     ⚠️ 这一段**开一个新页面**做：同页前面刚走过"进城→出城→进屋"，残留的 live 面板重绘
     会把结果搅成假红（第一版就是这么红的：按钮在、点了没反应）。 */
  const p2c = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const e2c = [];
  p2c.on('pageerror', (e) => e2c.push(e.message));
  await p2c.goto('file:///' + ROOT.replace(/\\/g, '/') + '/index.html');
  await p2c.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p2c.evaluate(() => {
    const G = window.GAME;
    G.newGame({ name: '地图进城', cityName: '灰岗', mapSeed: 20261025 });
    G.ui.enterGame();
    G.ui.setView('map');
    G.ui.openCityPanel(G.currentCity());
  });
  await p2c.waitForTimeout(400);
  const mapBtn = await p2c.locator('[data-action="city-enter-3d"]').count();
  const mapIn = await p2c.evaluate(() => {
    const G = window.GAME;
    const b2 = document.querySelector('[data-action="city-enter-3d"]');
    if (b2) b2.click();
    const d = G.scene3d._debug ? G.scene3d._debug() : null;
    return { scene: G.scene3d.current(), pitch: d ? d.pitchDeg : null };
  });
  ok('地图面板「进城逛逛（3D）」直接落到街上',
    mapBtn >= 1 && mapIn.scene === 'city' && mapIn.pitch >= 55,
    '按钮 ' + mapBtn + ' 个 · scene=' + mapIn.scene + ' · ' + (mapIn.pitch || '-') + '°'
      + (e2c.length ? ' · 异常 ' + e2c[0] : ''));
  await p2c.close();

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针自身异常：' + e.message); process.exit(2); });
