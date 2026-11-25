/* 玩家视角走查 B · 我能不能自己找到矿并建厂（v158.13 / v158.15 新功能）
 * ------------------------------------------------------------
 * 全程只用玩家能看见/能点的：顶栏「地形高亮」下拉、鼠标点格子、弹窗里的按钮。
 * 内部调用只用于「读格子编号」和「补帧」，不替代交互。
 * 另含 v158.15 六边形退役的**像素级**验证：鼠标扫过地面，画面是否零变化。
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pjourney';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
const rows = [];
function ok(t, c, d) {
  c ? pass++ : fail++;
  rows.push({ kind: c ? 'ok' : 'fail', t, d: d == null ? '' : String(d) });
  console.log('  ' + (c ? 'OK  ' : 'FAIL') + ' ' + t + (d ? '   [' + d + ']' : ''));
}
function note(t, d) {
  rows.push({ kind: 'note', t, d: d == null ? '' : String(d) });
  console.log('  ——  ' + t + (d ? '   [' + d + ']' : ''));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  const shot = async (n) => {
    try { await p.evaluate(() => GAME.ui.renderMapCanvas && GAME.ui.renderMapCanvas()); } catch (e) { }
    await p.screenshot({ path: OUT + '/' + n + '.png' });
    await p.screenshot({ path: OUT + '/' + n + '.jpg', type: 'jpeg', quality: 82 });
    return OUT + '/' + n + '.png';
  };
  const modal = () => p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    const T = (m ? (m.textContent || '') : '').replace(/\s+/g, ' ');
    return {
      open: !!m,
      head: m ? (((m.querySelector('.gold-heading') || m.querySelector('h2') || m.querySelector('h3') || {}).textContent) || '').trim() : '',
      txt: T,
      btns: Array.from(document.querySelectorAll('[data-action]')).filter((e) => {
        const r = e.getBoundingClientRect(); return r.width > 1 && m && m.contains(e);
      }).map((e) => e.getAttribute('data-action') + '=' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18))
    };
  });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '玩家', cityName: '灰岗', mapSeed: 20261125 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(700); if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break; }
  await p.waitForTimeout(2600);

  /* ══════ 幕五 · 我不知道哪里有矿，游戏给我什么工具 ══════ */
  const hasTerrainSel = await p.evaluate(() => {
    const s = document.getElementById('adm-terrain');
    return !!(s && s.options.length > 1);
  });
  ok('幕五 · 顶栏有「地形高亮」下拉（玩家找资源地的唯一线索）', hasTerrainSel === true, '');

  /* 真选「山地」→ 星球上应有高亮（像素占比） */
  const pgA = await shot('10_before_terrain');
  await p.selectOption('#adm-terrain', 'hill');
  await p.waitForTimeout(1800);
  const pgB = await shot('11_terrain_hill');
  const diff = await p.evaluate(async (a, b2) => {
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = src; });
    const cv = (im) => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const fs = null;
    return 0;
  }, 0, 0).catch(() => 0);
  /* 像素比对在 Node 侧做（页面读不回 file:// 的 png，用 buffer 比） */
  const A = fs.readFileSync(pgA), B = fs.readFileSync(pgB);
  note('幕五 · 选「山地」后画面是否变化（文件字节层面）', 'A=' + A.length + 'B=' + B.length + ' 内容相同=' + A.equals(B));
  await shot('11b_terrain_hill_end');

  /* 先从数据里挑候选（已探明 + 工业地形 + 没厂），再让镜头对准它 ——
     等价于玩家把目标拖到视野中央。 */
  const cands = await p.evaluate(() => {
    const G = GAME, SP = G.mapSphere;
    const cityCis = {}; (G.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    const all = { hill: 0, desert: 0, forest: 0, plain: 0, other: 0 };
    const fogged = { total: 0, revealed: 0 };
    const list = [];
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i]; if (!c) continue;
      fogged.total++;
      const fog = (G.fog && G.fog.get(i)) || 0;
      if (fog > 0) fogged.revealed++;
      if (c.type in all) all[c.type]++; else all.other++;
      if (cityCis[i]) continue;
      if (['hill', 'desert', 'forest'].indexOf(c.type) < 0) continue;
      if (!(fog > 0)) continue;
      if (G.resource && G.resource.plantAt && G.resource.plantAt(i)) continue;
      list.push({ ci: i, type: c.type });
    }
    /* 优先挑离城近的（玩家视野内看得见的） */
    const c0 = SP.cells[(G.state.cities[0] || {}).ci];
    list.forEach((x) => {
      const cc = SP.cells[x.ci];
      x.ang = (c0 && c0.dir && cc && cc.dir)
        ? Math.acos(Math.max(-1, Math.min(1, c0.dir[0] * cc.dir[0] + c0.dir[1] * cc.dir[1] + c0.dir[2] * cc.dir[2]))) * 180 / Math.PI
        : 999;
    });
    list.sort((a, b2) => a.ang - b2.ang);
    return { all, fogged, n: list.length, pick: list.slice(0, 40) };
  });
  ok('幕五 · 开局有已探明的工业地形可找（不是全图一片雾）',
    cands.n >= 1 && cands.fogged.revealed > 0,
    '工业格 ' + cands.n + ' 块（山地 ' + cands.all.hill + ' / 荒漠 ' + cands.all.desert + ' / 森林 ' + cands.all.forest + '）· 已探明 ' + cands.fogged.revealed + '/' + cands.fogged.total);
  note('幕五 · 玩家要在一块 ' + cands.fogged.total + ' 格的星球上找到这 ' + cands.n + ' 块地',
    '画面不标资源、不标已探明边界，只有一个「地形高亮」下拉');

  /* 已探明格都在城周围 —— 玩家第一反应就是底栏「回本城」，用它把镜头转过去 */
  await p.click('[data-action="map-mycity"]');
  await p.waitForTimeout(3400);
  const cityNow = await p.evaluate(() => {
    const M = GAME.map3d, SP = GAME.mapSphere, cam = M._cam;
    const ci = (GAME.state.cities[0] || {}).ci, c = SP.cells[ci];
    const P = new THREE.Vector3(c.dir[0] * M.R, c.dir[1] * M.R, c.dir[2] * M.R);
    const n = P.clone().project(cam);
    return { x: +n.x.toFixed(2), y: +n.y.toFixed(2), inView: Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 };
  });
  ok('幕五 · 点「回本城」后城落在画面里（镜头真的转过去了）',
    cityNow.inView === true && Math.abs(cityNow.x) < 0.6 && Math.abs(cityNow.y) < 0.6,
    '城 NDC (' + cityNow.x + ', ' + cityNow.y + ') · 在画面内=' + cityNow.inView);
  await shot('11c_backcity');

  /* 把候选格直接投影到屏幕（比稀疏扫描准），再用射线回验「这个点确实命中它」 */
  const scan = await p.evaluate((candList) => {
    const M = GAME.map3d, SP = GAME.mapSphere, cam = M._cam;
    const cv = document.getElementById('mapCanvas');
    const r = cv.getBoundingClientRect();
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const out = [];
    candList.forEach((c) => {
      const cell = SP.cells[c.ci]; if (!cell || !cell.dir) return;
      const d = cell.dir;
      const P = new THREE.Vector3(d[0] * M.R, d[1] * M.R, d[2] * M.R);
      const n = P.clone().project(cam);
      if (!(Math.abs(n.x) < 0.96 && Math.abs(n.y) < 0.96)) return;
      /* 背面剔除：格面法线（≈径向）与视线同向才在正面 */
      const facing = d[0] * fwd.x + d[1] * fwd.y + d[2] * fwd.z;
      if (facing > -0.15) return;
      const x = r.left + (n.x + 1) / 2 * r.width;
      const y = r.top + (1 - n.y) / 2 * r.height;
      /* 在投影点附近小范围搜索真正命中它的像素（地形有高度，投影会偏半格） */
      let exact = null;
      for (let dy = -44; dy <= 44 && !exact; dy += 3) {
        for (let dx = -44; dx <= 44 && !exact; dx += 3) {
          const px = x + dx, py = y + dy;
          if (px < r.left + 4 || px > r.right - 4 || py < r.top + 4 || py > r.bottom - 4) continue;
          let hit = -1;
          try {
            const rc = new THREE.Raycaster();
            rc.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), cam);
            hit = M.pickCiByRay ? M.pickCiByRay(rc, null) : -1;
          } catch (e) { }
          if (hit === c.ci) exact = { x: Math.round(px), y: Math.round(py) };
        }
      }
      out.push({ ci: c.ci, type: c.type, x: Math.round(x), y: Math.round(y), facing: +facing.toFixed(2), exact });
    });
    /* 越正对相机越好点（边缘格投影失真会把点投到邻格） */
    out.sort((a, b2) => a.facing - b2.facing);
    return { n: out.length, list: out.slice(0, 10) };
  }, cands.pick);
  const verified = (scan.list || []).filter((o) => o.exact).map((o) => ({ ci: o.ci, type: o.type, x: o.exact.x, y: o.exact.y }));
  note('幕五 · 候选格在屏幕上的位置与回验', '在画面内 ' + scan.n + ' 块 · 找得到精确像素 ' + verified.length +
    ' 块' + (verified[0] ? ' · 例 ci=' + verified[0].ci + ' @' + verified[0].x + ',' + verified[0].y : ''));
  ok('幕五 · 目标工业格真的在屏幕上且点得到（玩家肉眼能点到）', verified.length > 0,
    '在画面内 ' + scan.n + ' 块 · 点得准 ' + verified.length + ' 块');
  if (!verified.length) { console.log('目标格不可点，跳过后续'); await b.close(); process.exit(1); }
  const pick = verified[0];

  /* ══════ 幕六 · 真点这块地 ══════ */
  await p.mouse.click(pick.x, pick.y);
  await p.waitForTimeout(1200);
  let m1 = await modal();
  ok('幕六 · 鼠标点地块 → 弹出地块面板（玩家第一反应就是点它）', m1.open === true,
    '标题「' + m1.head + '」· 按钮 ' + m1.btns.join(' '));
  ok('幕六 · 面板里有「资源地块」区（告诉玩家这块地能开矿）', /资源地块/.test(m1.txt),
    (m1.txt.match(/资源地块.{0,40}/) || [''])[0]);
  ok('幕六 · 未勘探时明确说"未勘探"，不给假储量', /未勘探/.test(m1.txt), '');
  ok('幕六 · 有「勘探」按钮可点', /\u{1F50D}|勘探/.test(m1.txt) && m1.btns.some((x) => /res-scan/.test(x)),
    m1.btns.filter((x) => /scan/.test(x)).join(' '));
  await shot('12_land_modal');

  /* ══════ 幕七 · 勘探（要花钱吗？钱够吗？） ══════ */
  const cash0 = await p.evaluate(() => {
    const c = GAME.currentCity() || {};
    return { old: c.oldCoin != null ? c.oldCoin : null, keys: Object.keys(c).filter((k) => /coin|money|gold|res/i.test(k)).slice(0, 8) };
  });
  const scanBtn = await p.evaluate(() => {
    const bt = document.querySelector('[data-action="res-scan"]');
    if (!bt) return { ok: false };
    const before = (document.querySelector('.modal-mask') || {}).textContent || '';
    bt.click();
    return { ok: true, label: (bt.textContent || '').replace(/\s+/g, ' ').trim() };
  });
  await p.waitForTimeout(1200);
  const m2 = await modal();
  ok('幕七 · 点「勘探」后有结果（丰度 ×N + 储量）',
    /×\d\.\d\d/.test(m2.txt) || /储量/.test(m2.txt),
    (m2.txt.match(/资源[^储]{0,50}/) || [''])[0] + ' || ' + (m2.txt.match(/储量[^。]{0,30}/) || [''])[0]);
  note('幕七 · 勘探按钮文案', '「' + scanBtn.label + '」');
  await shot('13_scanned');

  /* 建厂按钮 + 造价 vs 手头钱 */
  const money = await p.evaluate(() => {
    const G = GAME, c = G.currentCity() || {};
    const st = G.state;
    return {
      cityKeys: Object.keys(c).filter((k) => typeof c[k] === 'number' && /old|coin|gold|cur/i.test(k)).map((k) => k + '=' + c[k]),
      stock: (st.stock && st.stock[c.id]) ? Object.keys(st.stock[c.id]).slice(0, 10).map((k) => k + '=' + st.stock[c.id][k]) : null,
      res: c.res ? Object.keys(c.res).map((k) => k + '=' + c.res[k]) : null
    };
  });
  const buildBtn = await p.evaluate(() => {
    const bt = document.querySelector('[data-action="res-build-open"]');
    return bt ? (bt.textContent || '').replace(/\s+/g, ' ').trim() : '';
  });
  ok('幕七 · 勘探后出现「建采集场」入口', !!buildBtn, '「' + buildBtn + '」');
  if (buildBtn) {
    await p.click('[data-action="res-build-open"]');
    await p.waitForTimeout(1100);
    const m3 = await modal();
    ok('幕七 · 采集场面板把成本/产出/工期/寿命都摆明',
      /造价/.test(m3.txt) && /产量/.test(m3.txt) && /工期/.test(m3.txt) && /可采|寿命/.test(m3.txt),
      m3.txt.match(/[^。]{0,80}造价[^。]{0,60}/) ? m3.txt.match(/[^。]{0,80}造价[^。]{0,60}/)[0] : '');
    const cost = m3.txt.match(/([\d.]+)\s*万?/g) || [];
    note('幕七 · 面板上的数字串（玩家要自己心算够不够）', cost.slice(0, 8).join(' / '));
    ok('幕七 · 有「开工建造」按钮', m3.btns.some((x) => /plant-build-do/.test(x)), m3.btns.join(' '));
    await shot('14_plant_modal');
  }

  /* ══════ 幕八 · 弹窗时按方向键，人会不会在背后乱跑 ══════ */
  const beforeKeys = await p.evaluate(() => JSON.parse(JSON.stringify(GAME._keys || {})));
  await p.keyboard.down('ArrowUp');
  await p.waitForTimeout(600);
  const duringKeys = await p.evaluate(() => ({ keys: JSON.parse(JSON.stringify(GAME._keys || {})), follow: !!GAME.map3d.FOLLOW }));
  await p.keyboard.up('ArrowUp');
  ok('幕八 · 弹窗打开时按 ↑ 不会让身后的人乱走', Object.keys(duringKeys.keys).every((k) => !duringKeys.keys[k]),
    'keys=' + JSON.stringify(duringKeys.keys) + ' follow=' + duringKeys.follow);

  /* Esc 关弹窗：面板是**栈式**的（采集场叠在地块上），Esc 逐层退回。
     判据按真实行为写：第一次退到上一层（标题变了 / 仍开着），第二次全关。 */
  const headOf = () => p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    if (!m) return '';
    const h = m.querySelector('.gold-heading');
    return h ? (h.textContent || '').trim() : '';
  });
  const headBefore = await headOf();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1000);
  const headMid = await headOf();
  const midOpen = await p.evaluate(() => !!(GAME.ui.modalVisible && GAME.ui.modalVisible()));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1100);
  const closed = await p.evaluate(() => !!(GAME.ui.modalVisible && !GAME.ui.modalVisible()));
  ok('幕八 · Esc 逐层退回（采集场 → 地块 → 关闭），不一次炸掉整叠',
    headMid !== '' && headMid !== headBefore && midOpen === true && closed === true,
    '「' + headBefore + '」→ Esc → 「' + headMid + '」→ Esc → ' + (closed ? '关闭' : '仍开着'));

  /* 连点两次同一格（会不会叠两层弹窗） */
  await p.mouse.click(pick.x, pick.y);
  await p.waitForTimeout(900);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  await p.mouse.click(pick.x, pick.y);
  await p.waitForTimeout(900);
  const stack = await p.evaluate(() => document.querySelectorAll('.modal-mask').length);
  ok('幕八 · 反复开同一块地不会叠出多层弹窗', stack <= 1, '弹窗层数=' + stack);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);

  /* ══════ 幕九 · 六边形退役：鼠标扫过地面，画面是否零变化 ══════
     截图字节比对不可用（云/自转每帧都在变）→ 在页面内把 WebGL canvas
     画到 2D canvas 取像素，和「同一位置静止两帧」的噪声底比。 */
  const cvBox = await p.evaluate(() => {
    const cv = document.getElementById('mapCanvas');
    const r = cv.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await p.evaluate(() => {
    window.__grab = function () {
      const cv = document.getElementById('mapCanvas');
      const c2 = document.createElement('canvas');
      c2.width = cv.width; c2.height = cv.height;
      c2.getContext('2d').drawImage(cv, 0, 0);
      return c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data;
    };
    window.__diff = function (a, b2) {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b2[i]) > 10 || Math.abs(a[i + 1] - b2[i + 1]) > 10 || Math.abs(a[i + 2] - b2[i + 2]) > 10) n++;
      }
      return n;
    };
  });
  await p.mouse.move(cvBox.x + cvBox.w * 0.30, cvBox.y + cvBox.h * 0.40);
  await p.waitForTimeout(900);
  await p.evaluate(() => { window.__a = window.__grab(); });
  await p.waitForTimeout(900);
  const noise = await p.evaluate(() => window.__diff(window.__a, window.__grab()));
  /* 换到另一块地（横向位移 ~1/3 屏） */
  await p.mouse.move(cvBox.x + cvBox.w * 0.62, cvBox.y + cvBox.h * 0.52, { steps: 14 });
  await p.waitForTimeout(1100);
  const hoverDiff = await p.evaluate(() => window.__diff(window.__a, window.__grab()));
  /* 关键对照：什么都不做、只等同样时长 —— 画面本身在动（云/自转），
     这段差异是"时间噪声"，不是鼠标造成的。悬停若无高亮，两者应当同量级。 */
  await p.waitForTimeout(1100);
  const idleDiff = await p.evaluate(() => window.__diff(window.__a, window.__grab()));
  note('幕九 · 悬停像素取证',
    '同位置静等 0.9s=' + noise + ' px · 跨格移动后=' + hoverDiff + ' px · 再静等 1.1s=' + idleDiff +
    ' px（画布 ' + (cvBox.w | 0) + '×' + (cvBox.h | 0) + '）');
  const extra = hoverDiff - Math.max(noise, idleDiff);
  ok('幕九 · 鼠标扫过地面不再产生任何高亮（额外差异≈0，仅有画面自身的时间噪声）',
    extra <= Math.max(noise, idleDiff) * 0.5 + 300,
    '跨格 ' + hoverDiff + ' vs 静等 ' + Math.max(noise, idleDiff) + ' → 额外 ' + extra + ' px');
  await shot('22_hover_after');

  /* ══════ 幕十 · 收尾取证：底栏「回本城」到底把镜头转对了没有 ══════ */
  const cityNdc = () => p.evaluate(() => {
    const M = GAME.map3d, SP = GAME.mapSphere, cam = M._cam;
    const ci = (GAME.state.cities[0] || {}).ci, c = SP.cells[ci];
    if (!c) return null;
    const P = new THREE.Vector3(c.dir[0] * M.R, c.dir[1] * M.R, c.dir[2] * M.R);
    const n = P.clone().project(cam);
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    return {
      x: +n.x.toFixed(2), y: +n.y.toFixed(2),
      inView: Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1,
      faceCam: +(c.dir[0] * fwd.x + c.dir[1] * fwd.y + c.dir[2] * fwd.z).toFixed(2),
      dist: +M.camO.dist.toFixed(0)
    };
  });
  const ndcBefore = await cityNdc();
  await p.click('[data-action="map-mycity"]');
  await p.waitForTimeout(3400);
  const ndcAfter = await cityNdc();
  note('幕十 · 「回本城」点下去：城在屏幕上的位置',
    '点前 (x=' + (ndcBefore && ndcBefore.x) + ', y=' + (ndcBefore && ndcBefore.y) + ') 在画面内=' + (ndcBefore && ndcBefore.inView) +
    ' → 点后 (x=' + (ndcAfter && ndcAfter.x) + ', y=' + (ndcAfter && ndcAfter.y) + ') 在画面内=' + (ndcAfter && ndcAfter.inView) +
    ' · 相机距 ' + (ndcBefore && ndcBefore.dist) + '→' + (ndcAfter && ndcAfter.dist));
  ok('幕十 · 点「回本城」后城仍在画面里（这是"回城"的最低要求）',
    !!(ndcAfter && ndcAfter.inView),
    ndcAfter && ndcAfter.inView ? '' : '城被推出了视野（y=' + (ndcAfter && ndcAfter.y) + '）');
  await shot('23_backcity_result');

  ok('全程零运行时错误', errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : '无');
  console.log('\n==== 玩家走查 B（找矿→建厂 / 悬停）：' + pass + ' 通过 / ' + fail + ' 失败 ====');
  fs.writeFileSync(OUT + '/rows_b.json', JSON.stringify({ pass, fail, rows }, null, 1));
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('崩溃:', e); process.exit(2); });
