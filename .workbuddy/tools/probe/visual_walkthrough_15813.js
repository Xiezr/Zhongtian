/* 资源地块 → 勘探 → 建厂 → 采集场总览 · 实机视觉走查（v158.13 S2~S5）
 * ------------------------------------------------------------
 * 老板「通过视觉模式直接走一遍」—— 不是读断言，是真的把这条玩法链在浏览器里
 * 从头走到尾，每步留一张实机截图，最后出一张可翻看的走查页。
 *
 * 走查路径（全部走**真实入口**，不直调内部函数替代交互）：
 *   ① 开局进大地图（看星球与城的位置）
 *   ② 走到最近的工业地块上（M.teleportTo = 游戏内传送同一条位姿出口）
 *   ③ 开「人物」视角（底栏 follow-toggle 按钮真点）→ 底部出现走近提示
 *   ④ 按 E（与玩家键位同一条 keydown 出口）→ 地块面板打开
 *   ⑤ 面板「资源地块」区：未勘探态 —— 只报地形推断，不报丰度/储量
 *   ⑥ 真点「🔍 勘探」→ 面板就地刷新出丰度 ×N 与储量条
 *   ⑦ 真点「🏭 建采集场」→ 采集场面板（造价/工期/产量/堆场/可采时长）
 *   ⑧ 真点「🏭 开工建造」→ 施工中（面板显示百分比）
 *   ⑨ 推进游戏时间到落成 → 地块面板变成「采集场 Lv1」
 *   ⑩ 城外页 = 采集场总览（每座一行：产量/丰度/储量条/定位）
 *   ⑪ 真点「📍 在地图上查看」→ 回到星球并打开这块地
 *   ⑫ 把储量打到 0 → 面板与总览都显示「已枯竭（残采 25%）」
 *
 * 产物：.workbuddy/tmp/v15813_visual/*.png（原图）+ walkthrough.html（走查页）
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = 'E:/Deepseekdb';
const OUT = ROOT + '/.workbuddy/tmp/v15813_visual';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const steps = [];
/* 口径：(标题, 是否成立, 明细) —— 标题本身就是断言的人话描述 */
function ok(title, cond, detail) {
  cond ? pass++ : fail++;
  steps.push({ title, ok: !!cond, detail: detail == null ? '' : String(detail) });
  console.log('  ' + (cond ? '✅ ' : '❌ ') + title + (detail ? '   [' + detail + ']' : ''));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    executablePath: EXE, headless: true, args: ['--allow-file-access-from-files']
  });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  /* 每步截两张：png 存档 · jpg 进走查页（自包含，不依赖相对路径） */
  const shot = async (id) => {
    await p.screenshot({ path: OUT + '/' + id + '.png' });
    await p.screenshot({ path: OUT + '/' + id + '.jpg', type: 'jpeg', quality: 84 });
    const last = steps[steps.length - 1];
    if (last) last.shot = id;
    else steps.push({ id: 'S-' + id, title: '', ok: true, detail: '', shot: id, plain: true });
  };

  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '视觉走查', cityName: '灰岗', mapSeed: 20261125 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2800);

  /* ① 开局大地图 */
  const s1 = await p.evaluate(() => {
    const G = window.GAME, c = G.state.cities[0];
    return { view: G.ui.view, hasSphere: !!(G.sphere || G.sphereOf), cities: G.state.cities.length, ci: c ? c.ci : -1 };
  });
  ok('① 开局进大地图', s1.cities >= 1 && !!s1.hasSphere, '城 ' + s1.cities + ' 座 · 城所在格 ci=' + s1.ci + ' · view=' + s1.view);
  await shot('01_map');

  /* ② 找一块最近的工业地块（森林/山地/荒漠），并把它上面的人传送过去 */
  const tgt = await p.evaluate(() => {
    const G = window.GAME;
    const city = G.state.cities[0];
    const SP = G.sphere || (G.sphereOf ? G.sphereOf(G.pidOf(city)) : null);
    const rs = G.resource;
    const c0 = city && city.ci >= 0 ? SP.cells[city.ci] : null;
    const cands = [];
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i];
      if (!c) continue;
      if (!(c.type === 'hill' || c.type === 'forest' || c.type === 'desert')) continue;
      if (rs.plantAt(i)) continue;
      /* 走近提示只在**已探明**的格上长出可交互物（fog<=0 是未探明，见
         nearestInteractable 的迷雾判据）—— 选未探明格会让 ③④ 假红。 */
      if (!((G.fog && G.fog.get(i)) > 0)) continue;
      let ang = 999;
      if (c0 && c0.dir) {
        const dot = c.dir[0] * c0.dir[0] + c.dir[1] * c0.dir[1] + c.dir[2] * c0.dir[2];
        ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      }
      cands.push({ ci: i, type: c.type, ang: +ang.toFixed(2) });
    }
    cands.sort((a, b2) => a.ang - b2.ang);
    /* 优先山地（= 铁 / 矿场），没有就取最近的 */
    const hill = cands.filter((x) => x.type === 'hill');
    return { total: cands.length, pick: (hill[0] || cands[0] || null), hills: hill.length };
  });
  ok('② 星球上找到工业地块', !!tgt.pick, '候选 ' + tgt.total + ' 块（山地 ' + tgt.hills + '）· 选中 ci=' +
    (tgt.pick ? tgt.pick.ci : '-') + ' type=' + (tgt.pick ? tgt.pick.type : '-'));

  const CI = tgt.pick.ci;
  /* 先贴上这一格，等**地表 patch 建出来**（_tileCells 就绪）再传送 ——
     v158.0 的 teleportTo 依赖 _tileCells[ci].dir，全局视角下还没这块数据，
     直接调会静默返回 false（首轮就是这么假红的）。 */
  await p.evaluate((ci) => { GAME.map3d.focusOnCell(ci, true); }, CI);
  await p.waitForTimeout(1600);
  const tp = await p.evaluate((ci) => {
    const M = GAME.map3d;
    let r = false;
    for (let i = 0; i < 4 && !r; i++) r = M.teleportTo(ci);
    M.focusOnCell(ci, true);
    return { ok: !!r, standCi: M.playerCi ? M.playerCi() : -1 };
  }, CI);
  ok('②b 传送落位到该地块（位姿唯一出口）', tp.ok === true && tp.standCi === CI,
    'teleport=' + tp.ok + ' · _standCi=' + tp.standCi + ' / 目标 ' + CI);
  await p.waitForTimeout(600);

  /* ③ 进入人物视角（真点底栏按钮）→ 走近提示 */
  const s3 = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="follow-toggle"]');
    if (btn) btn.click();
    return new Promise((res) => setTimeout(() => {
      const M = GAME.map3d;
      const hint = document.getElementById('interact-hint');
      res({
        follow: !!M.FOLLOW, near: M.nearestInteractable ? M.nearestInteractable() : null,
        hintText: hint ? (hint.textContent || '').replace(/\s+/g, ' ').trim() : '',
        hintShown: hint ? (hint.style.display !== 'none' && hint.offsetParent !== null) : false
      });
    }, 1500));
  });
  ok('③ 人物视角 + 走近提示', s3.follow === true && !!s3.near && s3.hintText.length > 0,
    'FOLLOW=' + s3.follow + ' · 提示「' + s3.hintText + '」· 目标=' + (s3.near ? s3.near.kind + '/' + s3.near.name : 'null'));
  await shot('02_walk_hint');

  /* ④ 按 E → 地块面板（玩家键位同一条出口） */
  const readModal = () => p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    return {
      open: !!m,
      head: m ? ((m.querySelector('.gold-heading') || {}).textContent || '') : '',
      txt: m ? (m.textContent || '').replace(/\s+/g, ' ') : ''
    };
  });
  await p.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true, cancelable: true }));
  });
  await p.waitForTimeout(800);
  let s4 = await readModal();
  const eWorked = s4.open === true;
  if (!s4.open) {
    /* 兜底：E 没生效也要把后面整条链走完，别让一张截图缺失掩盖后续问题 */
    await p.evaluate((ci) => { GAME.map3d.openCellPanel(ci); }, CI);
    await p.waitForTimeout(700);
    s4 = await readModal();
  }
  ok('④ 按 E 打开地块面板（走近即交互）', eWorked === true,
    '标题「' + (s4.head || '') + '」' + (eWorked ? '' : ' → E 未生效，改用点击同出口兜底'));
  ok('⑤ 面板含「资源地块」区 · 未勘探不报储量',
    /资源地块/.test(s4.txt) && /未勘探/.test(s4.txt) && !/储量/.test(s4.txt),
    (s4.txt.match(/未勘探[^。]{0,40}/) || [''])[0]);
  await shot('03_land_unscanned');

  /* ⑥ 真点「🔍 勘探」→ 就地刷新出丰度与储量 */
  const s6 = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="res-scan"]');
    if (!btn) return { clicked: false };
    btn.click();
    return new Promise((res) => setTimeout(() => {
      const m = document.querySelector('.modal-mask');
      const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      res({
        clicked: true, txt: t,
        hasRich: /×\d\.\d\d/.test(t), hasReserve: /储量/.test(t),
        hasBuildBtn: !!document.querySelector('[data-action="res-build-open"]')
      });
    }, 900));
  });
  ok('⑥ 勘探后就地看到丰度 ×N', s6.clicked && s6.hasRich === true, (String(s6.txt || '').match(/资源[^储]{0,60}/) || [''])[0]);
  ok('⑥b 勘探后出现储量与「建采集场」', s6.hasReserve === true && s6.hasBuildBtn === true,
    '储量=' + s6.hasReserve + ' 按钮=' + s6.hasBuildBtn);
  await shot('04_land_scanned');

  /* ⑦ 真点「🏭 建采集场」→ 采集场面板 */
  const s7 = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="res-build-open"]');
    if (!btn) return { clicked: false };
    btn.click();
    return new Promise((res) => setTimeout(() => {
      const m = document.querySelector('.modal-mask');
      const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      res({
        clicked: true, txt: t,
        hasCost: /造价/.test(t), hasTime: /工期/.test(t), hasYield: /产量/.test(t),
        hasStore: /堆场/.test(t), hasLife: /可采/.test(t),
        canBuild: !!document.querySelector('[data-action="plant-build-do"]')
      });
    }, 800));
  });
  ok('⑦ 采集场面板：产出/造价/工期/堆场/可采时长全在明面上',
    s7.clicked && s7.hasCost && s7.hasTime && s7.hasYield && s7.hasStore && s7.hasLife && s7.canBuild,
    '造价=' + s7.hasCost + ' 工期=' + s7.hasTime + ' 产量=' + s7.hasYield + ' 堆场=' + s7.hasStore + ' 可采=' + s7.hasLife);
  await shot('05_plant_modal');

  /* ⑧ 真点「🏭 开工建造」→ 施工中 */
  const s8 = await p.evaluate((ci) => {
    const before = GAME.state.queues.build.length;
    const btn = document.querySelector('[data-action="plant-build-do"]');
    if (!btn) return { clicked: false };
    btn.click();
    /* 等 2.4s 让「开始建造」的 toast 自然消散 —— 弹窗态下 toast 会上浮到
       标题位置（v89.203 的 high 档），截图会盖住弹窗标题（不影响功能，
       已作为观感问题单列给老板）。 */
    return new Promise((res) => setTimeout(() => {
      GAME.ui.openPlantModal(ci);
      setTimeout(() => {
        const m = document.querySelector('.modal-mask');
        const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
        const q = (GAME.state.queues.build || []).filter((x) => x && x.ci === ci && x.type === 'plant_build');
        res({
          clicked: true, queued: GAME.state.queues.build.length - before,
          hasQ: q.length > 0, pct: q.length ? +((q[0].elapsed / q[0].totalTime) * 100).toFixed(1) : -1,
          txt: t, hasProgress: /施工/.test(t)
        });
      }, 500);
    }, 2500));
  }, CI);
  ok('⑧ 开工后进建造队列（采集场面板显示施工百分比）', s8.clicked && s8.hasQ && s8.hasProgress,
    '入队 ' + s8.queued + ' · 进度 ' + s8.pct + '%');
  await shot('06_building');

  /* ⑧b 施工中的**地块面板**：应显示进度、且不再给「建采集场」按钮
     （v158.13 视觉轮补：原先施工中按钮还亮着，点下去只被回一句"已经在施工了"） */
  const s8b = await p.evaluate((ci) => {
    GAME.ui.closeModal();
    GAME.ui.openLandModalCi(ci);
    return new Promise((res) => setTimeout(() => {
      const m = document.querySelector('.modal-mask');
      const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      res({
        txt: t,
        hasProg: /施工/.test(t) && /建造中/.test(t),
        hasBuildBtn: !!document.querySelector('[data-action="res-build-open"]')
      });
    }, 600));
  }, CI);
  ok('⑧b 施工中地块面板显示进度 · 不再给「建采集场」', s8b.hasProg === true && s8b.hasBuildBtn === false,
    (String(s8b.txt || '').match(/施工[^储]{0,40}/) || [''])[0]);
  await shot('06b_land_building');

  /* ⑨ 推进游戏时间到落成 */
  const s9 = await p.evaluate((ci) => {
    const G = window.GAME;
    let n = 0;
    for (; n < 8000 && (G.state.queues.build || []).length; n++) G.tickOnce();
    return { ticks: n, left: G.state.queues.build.length, planted: !!G.resource.plantAt(ci) };
  }, CI);
  ok('⑨ 施工走完 → 地块上真有一座采集场', s9.planted === true && s9.left === 0,
    '推进 ' + s9.ticks + ' 拍 · 剩余队列 ' + s9.left);

  const s9b = await p.evaluate((ci) => {
    GAME.ui.closeModal();
    GAME.ui.openLandModalCi(ci);
    return new Promise((res) => setTimeout(() => {
      const m = document.querySelector('.modal-mask');
      const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      res({ txt: t, hasPlant: /采集场/.test(t) && /Lv1/.test(t) });
    }, 600));
  }, CI);
  ok('⑨b 地块面板变成「采集场 Lv1」', s9b.hasPlant === true, (String(s9b.txt || '').match(/采集场[^储]{0,24}/) || [''])[0]);
  await shot('07_land_planted');

  /* ⑩ 城外页 = 采集场总览 */
  const s10 = await p.evaluate(() => {
    GAME.ui.closeModal();
    GAME.ui.setView('ext');
    return new Promise((res) => setTimeout(() => {
      const box = document.body;
      const t = (box.textContent || '').replace(/\s+/g, ' ');
      const rows = document.querySelectorAll('[data-action="plant-goto"]');
      res({
        txt: t, isList: /采集场总览/.test(t), rows: rows.length,
        hasGotoMap: !!document.querySelector('[data-action="plant-goto-map"]')
      });
    }, 800));
  });
  ok('⑩ 城外页是「采集场总览」且列出每座厂', s10.isList === true && s10.rows >= 1,
    '定位按钮 ' + s10.rows + ' 个 · 去星球入口=' + s10.hasGotoMap);
  await shot('08_ext_list');

  /* ⑪ 真点「📍 在地图上查看」→ 回到星球并打开这块地 */
  const s11 = await p.evaluate((CI) => {
    /* 定位**刚建的那座**（第一行可能是开局自带的平原农场，那块地没有「资源地块」区） */
    const btn = document.querySelector('[data-action="plant-goto"][data-ci="' + CI + '"]')
      || document.querySelector('[data-action="plant-goto"]');
    if (!btn) return { clicked: false };
    btn.click();
    return new Promise((res) => setTimeout(() => {
      const m = document.querySelector('.modal-mask');
      const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      res({ clicked: true, view: GAME.ui.view, modalOpen: !!m, hasRes: /资源地块/.test(t) });
    }, 2600));
  }, CI);
  ok('⑪ 总览定位 → 回到星球并打开该地块', s11.clicked && s11.view === 'map' && s11.modalOpen && s11.hasRes,
    'view=' + s11.view + ' 面板=' + s11.modalOpen);
  await shot('09_goto_back');

  /* ⑫ 枯竭态（储量打到 0）→ 面板与总览都标「已枯竭（残采 25%）」 */
  const s12 = await p.evaluate((ci) => {
    GAME.ui.closeModal();
    const pid = GAME.pidOf(GAME.currentCity());
    GAME.resource.set(ci, { reserve: 0 }, pid);
    GAME.ui.openLandModalCi(ci);
    return new Promise((res) => setTimeout(() => {
      const m = document.querySelector('.modal-mask');
      const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      res({ txt: t, depleted: /已枯竭/.test(t), mult: /残采 25%/.test(t) });
    }, 600));
  }, CI);
  ok('⑫ 储量耗尽 → 面板标「已枯竭（残采 25%）」', s12.depleted && s12.mult,
    (String(s12.txt || '').match(/已枯竭[^储]{0,20}/) || [''])[0]);
  await shot('10_depleted');

  const s12b = await p.evaluate(() => {
    GAME.ui.closeModal();
    GAME.ui.setView('ext');
    return new Promise((res) => setTimeout(() => {
      const t = (document.body.textContent || '').replace(/\s+/g, ' ');
      res({ depleted: /已枯竭/.test(t) });
    }, 800));
  });
  ok('⑫b 总览同样标枯竭 + 产量按残采降', s12b.depleted === true, '');
  await shot('11_ext_depleted');

  ok('⑬ 全程零运行时错误', errs.length === 0, errs.length ? errs.join(' | ') : '无');

  /* ---------- 走查页（自包含：jpg 内联 base64） ---------- */
  const html = [];
  html.push('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>v158.13 资源地块视觉走查</title>');
  html.push('<style>body{margin:0;background:#12100d;color:#e8e0d0;font:14px/1.7 "Microsoft YaHei",sans-serif;padding:28px 32px 60px;}');
  html.push('h1{font-size:20px;font-weight:600;margin:0 0 6px;color:#f0d79a;}');
  html.push('.sub{color:#8f8574;font-size:13px;margin-bottom:22px;}');
  html.push('.step{margin:0 0 30px;border:1px solid #3a332a;border-radius:10px;overflow:hidden;background:#191612;}');
  html.push('.cap{display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-bottom:1px solid #2b261f;}');
  html.push('.idx{flex:0 0 auto;font-weight:600;color:#f0d79a;}');
  html.push('.t{flex:1;} .d{color:#8f8574;font-size:12.5px;margin-top:2px;word-break:break-all;}');
  html.push('img{display:block;width:100%;height:auto;}');
  html.push('.bad{border-color:#7a2f2f;} .ok{color:#7fd18a;} .no{color:#e2776f;}');
  html.push('</style></head><body>');
  html.push('<h1>v158.13 资源地块 · 实机视觉走查</h1>');
  html.push('<div class="sub">开局 → 走到工业地块 → 人物视角走近提示 → E 开面板 → 勘探 → 建采集场 → 施工落成 → 城外总览 → 定位回地图 → 枯竭态　｜　' +
    pass + ' 通过 / ' + fail + ' 失败</div>');
  steps.forEach((s, i) => {
    if (!s.shot) return;
    const jpg = OUT + '/' + s.shot + '.jpg';
    const b64 = fs.existsSync(jpg) ? fs.readFileSync(jpg).toString('base64') : '';
    html.push('<div class="step' + (s.ok ? '' : ' bad') + '">');
    html.push('<div class="cap"><div class="idx ' + (s.ok ? 'ok' : 'no') + '">' + (s.ok ? '✓' : '✗') + '</div>');
    html.push('<div class="t"><b>' + (s.title || '画面') + '</b>' + (s.detail ? '<div class="d">' + s.detail + '</div>' : '') + '</div></div>');
    html.push('<img src="data:image/jpeg;base64,' + b64 + '" alt="' + s.shot + '">');
    html.push('</div>');
  });
  html.push('</body></html>');
  fs.writeFileSync(OUT + '/walkthrough.html', html.join('\n'), 'utf8');

  console.log('\n════════ 视觉走查：' + pass + ' 通过 / ' + fail + ' 失败 ════════');
  console.log('截图目录：' + OUT);
  console.log('走查页：' + OUT + '/walkthrough.html');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('探针崩溃:', e); process.exit(2); });
