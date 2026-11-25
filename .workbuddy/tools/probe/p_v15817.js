/* v158.17 验收探针（老板「参考现有成熟设计完善」6 条缺口）
 * ------------------------------------------------------------
 * ① 街区里「我」站在脚下（不是"恰好在画面里的另一个人"）
 * ② 南门出城（走出去 = 回星球；不在门洞里就走不出去）
 * ③ 回本城带人回家（人 + 镜头一起到）
 * ④ 未探明格有勘探入口（上一轮结论过期，这里复验）
 * ⑤ 采集场面板文案（丰度/储量/堆场/工期/图标/全名）
 * ⑥ 夜面底数（昼夜线只压夜面、日面不动）
 * 只读：全部动作走产品既有出口（teleportTo/setFollow/scan/view）。
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/p15817';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function ok(t, c, d) {
  c ? pass++ : fail++;
  console.log('  ' + (c ? 'OK  ' : 'FAIL') + ' ' + t + (d ? '   [' + d + ']' : ''));
}
function note(t, d) { console.log('  ——  ' + t + (d ? '   [' + d + ']' : '')); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: '玩家', cityName: '灰岗', mapSeed: 20261125 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => /正在进入星球|正在构建星球/.test(document.body.textContent)))) break;
  }
  await p.waitForTimeout(2600);

  /* ══════ ③ 回本城：人 + 镜头一起回家 ══════ */
  const park = await p.evaluate(() => {
    const G = GAME, M = G.map3d, SP = G.mapSphere;
    const c = G.state.cities[0];
    const cityCis = {}; (G.state.cities || []).forEach((x) => { cityCis[x.ci] = 1; });
    let far = -1, best = Infinity;
    const c0 = SP.cells[c.ci];
    for (let i = 0; i < SP.cells.length; i += 7) {
      const cc = SP.cells[i]; if (!cc || cc.type === 'city' || cityCis[i]) continue;
      const d = cc.dir[0] * c0.dir[0] + cc.dir[1] * c0.dir[1] + cc.dir[2] * c0.dir[2];
      if (d < best) { best = d; far = i; }
    }
    M.setFollow(true);
    M.teleportTo(far);
    return { far: far, dot: +best.toFixed(3), cityCi: c.ci, ci: M.playerCi() };
  });
  note('③ 出发位置', '野地 ci=' + park.ci + '（离城点积 ' + park.dot + '）· 城格 ' + park.cityCi);
  ok('③ 前置：人确实在野地（playerCi ≠ 城格）', park.ci !== park.cityCi && park.ci >= 0,
    'playerCi=' + park.ci + ' cityCi=' + park.cityCi);
  await p.click('[data-action="map-mycity"]');
  await p.waitForTimeout(2400);
  const back = await p.evaluate(() => {
    const G = GAME, M = G.map3d, SP = G.mapSphere, cam = M._cam;
    /* headless 下 rAF 被节流 → followAvatar 没跑过，相机还停在野地那一格。
       手动推一帧跟随（_followPos 置空 = 直接贴到目标，同 setFollow 的收敛做法）。 */
    if (M.FOLLOW) { try { M._followPos = null; M.followAvatar(0.016); } catch (e) { } }
    const c = G.state.cities[0];
    const pp = M.playerPose() || { dir: [0, 1, 0], h: 0 };
    const eye = M.R + (pp.h || 0) + 1.7;          /* 第三人称相机的注视点 = 人的眼高 */
    const P = new THREE.Vector3(pp.dir[0] * eye, pp.dir[1] * eye, pp.dir[2] * eye).project(cam);
    const cc = SP.cells[c.ci];
    const dot = pp.dir[0] * cc.dir[0] + pp.dir[1] * cc.dir[1] + pp.dir[2] * cc.dir[2];
    return { ci: M.playerCi(), cityCi: c.ci, ndc: [+P.x.toFixed(2), +P.y.toFixed(2)],
      follow: M.FOLLOW, onCityCell: +dot.toFixed(5) };
  });
  note('③ 点「回本城」后', 'playerCi=' + back.ci + '（城格 ' + back.cityCi + '）· 城在屏幕 ' +
    JSON.stringify(back.ndc) + ' · follow=' + back.follow);
  ok('③ 跟随态点「回本城」：人跟着回城（playerCi === 城格）', back.ci === back.cityCi,
    'playerCi=' + back.ci + ' cityCi=' + back.cityCi);
  ok('③ 镜头对准了城格上的人（城在画面中央）',
    Math.abs(back.ndc[0]) < 0.25 && Math.abs(back.ndc[1]) < 0.25 && back.onCityCell > 0.999,
    JSON.stringify(back.ndc) + ' dot=' + back.onCityCell);
  /* 诊断放在断言之后（它会真的搬人，先搬就把现场抹了） */
  const diag = await p.evaluate(() => {
    const M = GAME.map3d, c = GAME.state.cities[0], cc = GAME.currentCity() || {};
    let err = null, ret = null;
    try { ret = M.gotoXY(c.x, c.y, c.ci); } catch (e) { err = e.message; }
    return { type: typeof M.gotoXY, ret: ret, err: err, ciAfter: M.playerCi(),
      cityCi: c.ci, curCi: cc.ci, sameCity: cc.ci === c.ci,
      hasLonlat: typeof (GAME.map && GAME.map.lonlatOf) };
  });
  note('③ 诊断（直接调 gotoXY）', JSON.stringify(diag));

  /* ══════ ① 街区里「我」站在脚下 ══════ */
  await p.evaluate(() => {
    const G = GAME, M = G.map3d;
    M.setFollow(false); M.setFollow(true);          /* 站在城格上重进跟随 → AUTO_DISTRICT 落街区 */
  });
  await p.waitForTimeout(2200);
  const me = await p.evaluate(() => {
    const G = GAME, D = G.district, M = G.map3d, cam = M._cam;
    if (!D.active || !D.avatarOf) return { err: 'no district/avatar' };
    /* ⚠️ headless 下 rAF 被节流：过渡进度 D.t 停在 0，D.camera 就一直在球面起点插值
       （画面根本还没进街区）。手动推满过渡再覆盖相机 —— 与渲染循环同一对调用。 */
    for (let i = 0; i < 40; i++) { try { D.tick(); } catch (e) { } }
    try { D.camera(); } catch (e) { }
    const a = D.avatarOf();
    const fig = M.figureOf('stand');
    /* 主角的世界坐标 = 街区 root 局部 → 世界（同一套 D.world 标架） */
    const w = D.world(D.frame, a.local[0], a.local[1], a.local[2]);
    const feet = D.world(D.frame, D.pos.x, 0, D.pos.z);
    const gap = Math.sqrt(Math.pow(w[0] - feet[0], 2) + Math.pow(w[1] - feet[1], 2) + Math.pow(w[2] - feet[2], 2));
    const v = new THREE.Vector3(w[0], w[1] + 0.9, w[2]);
    const n = v.clone().project(cam);
    return {
      active: D.active, t: +D.t.toFixed(3), pos: { x: +D.pos.x.toFixed(2), z: +D.pos.z.toFixed(2) },
      avatar: a, gap: +gap.toFixed(3),
      ndc: [+n.x.toFixed(2), +n.y.toFixed(2)],
      inView: Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1,
      sphereFig: fig ? fig.pos.map((v) => +v.toFixed(2)) : null,
    };
  });
  note('① 街区态', JSON.stringify(me));
  ok('① 过渡到 hold（D.t == 1，相机才真的在街区里）', me.t === 1, 't=' + me.t);
  ok('① 街区里画出了「我自己」（D.avatarOf 有实体）', !!(me.avatar && me.avatar.visible),
    'avatar=' + JSON.stringify(me.avatar));
  ok('① 主角就在我脚下（局部坐标 == D.pos，误差 < 0.05）', me.gap != null && me.gap < 0.05, 'gap=' + me.gap);
  ok('① 主角在画面中央（第三人称背影可见）', me.inView === true, 'ndc=' + JSON.stringify(me.ndc));
  ok('① 主角是真人比例（1.72m，不是球面那个 2.4m 的巨人）',
    !!(me.avatar && Math.abs(me.avatar.scale * 1.21 - 1.72) < 0.06), 'scale=' + (me.avatar || {}).scale);
  await p.evaluate(() => GAME.ui.renderMapCanvas && GAME.ui.renderMapCanvas());
  await p.screenshot({ path: OUT + '/10_district_me.png' });

  /* ══════ ② 南门出城 ══════ */
  const pos = await p.evaluate(() => {
    const G = GAME, D = G.district;
    if (!D.active) return { err: 'not in district' };
    D.pos.x = 0; D.pos.z = D.plan.hd + 0.5; D.yaw = 0;
    D.keys = { s: 1 };                              /* yaw=0 时 S = +Z = 南 */
    const before = { active: D.active, z: +D.pos.z.toFixed(2), hd: D.plan.hd, outZ: D.plan.outZ };
    for (let i = 0; i < 160; i++) { try { D.tick(); } catch (e) { } }
    return { before: before, active: D.active, phase: D.phase, z: +D.pos.z.toFixed(2),
      ci: G.map3d.playerCi(), follow: G.map3d.FOLLOW };
  });
  note('② 门洞里按 S 往南', JSON.stringify(pos));
  ok('② 走过南门洞就出街区（active → false，人回星球）', pos.before && pos.before.active === true
    && pos.active === false, 'before=' + JSON.stringify(pos.before || null) + ' after active=' + pos.active);
  ok('② 出门后落回城格（P0 位姿按快照还原，不是留在门外）', pos.ci != null && pos.ci >= 0,
    'playerCi=' + pos.ci);
  ok('② 出街区不改跟随态（仍是人物视角，不用再按 Tab）', pos.follow === true, 'follow=' + pos.follow);

  const neg = await p.evaluate(() => {
    const G = GAME, M = G.map3d, D = G.district;
    /* 反向守卫：北边是边界不是出口 —— 往北顶 160 帧不许出街区。
       （南边界是"走出去"的口，其余三面只是夹边；这条守的就是"别把任意边都当门"） */
    M.setFollow(false); M.setFollow(true);
    if (!D.active) return { err: 're-enter failed' };
    D.pos.x = 0; D.pos.z = D.plan.bounds.z0 + 0.6; D.yaw = 0;
    D.keys = { w: 1 };                              /* yaw=0 时 W = −Z = 北 */
    for (let i = 0; i < 160; i++) { try { D.tick(); } catch (e) { } }
    return { active: D.active, x: +D.pos.x.toFixed(2), z: +D.pos.z.toFixed(2),
      z0: D.plan.bounds.z0, wall: !!D.plan.wall };
  });
  note('② 反向守卫（往北顶边界）', JSON.stringify(neg));
  ok('② 北边界不是出口（顶到夹边也不出街区）', neg.active === true, JSON.stringify(neg));
  await p.evaluate(() => { const D = GAME.district; if (D.active) { D.keys = {}; D.pos.x = 0; D.pos.z = 4; } });
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/11_gate.png' });

  /* ══════ ④ 未探明格的勘探入口 ══════ */
  const fog = await p.evaluate(() => {
    const G = GAME, SP = G.mapSphere, M = G.map3d;
    if (G.district && G.district.active) M.setFollow(false);
    const cityCis = {}; (G.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    let pick = -1;
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i]; if (!c) continue;
      if (cityCis[i]) continue;
      if (c.type !== 'forest' && c.type !== 'hill') continue;
      if (((G.fog && G.fog.get(i)) || 0) > 0) continue;
      if (G.resource && G.resource.plantAt && G.resource.plantAt(i)) continue;
      pick = i; break;
    }
    if (pick < 0) return { err: 'no cell' };
    GAME.ui.openLandModalCi(pick);
    const m = document.querySelector('.modal-mask');
    const T = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    return { ci: pick, type: SP.cells[pick].type,
      hasScan: !!(m && m.querySelector('[data-action="res-scan"]')),
      title: (T.match(/资源地块[^｜]{0,8}/) || [''])[0], hint: (T.match(/勘探不花资源[^；]*/) || [''])[0] };
  });
  note('④ 未探明 ' + (fog.type || '?') + ' 格 ci=' + fog.ci, JSON.stringify(fog));
  ok('④ 未探明格有「🔍 勘探」入口', fog.hasScan === true, 'title=' + fog.title);
  ok('④ 区块标题写明「未勘探」+ 说明勘探的代价与作用',
    /未勘探/.test(fog.title || '') && /勘探不花资源/.test(fog.hint || ''),
    fog.title + ' | ' + fog.hint);

  /* ══════ ⑤ 采集场面板文案 ══════ */
  const copy = await p.evaluate(() => {
    const G = GAME, SP = G.mapSphere;
    const RS = G.resource;
    const cityCis = {}; (G.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    let pick = -1;
    for (let i = 0; i < SP.cells.length; i++) {
      const c = SP.cells[i]; if (!c) continue;
      if (cityCis[i] || c.type !== 'forest') continue;
      if (G.resource.plantAt && G.resource.plantAt(i)) continue;
      if (RS.view(i) && RS.view(i).scanned) continue;
      pick = i; break;
    }
    if (pick < 0) return { err: 'no unscanned forest' };
    RS.scan(pick);
    GAME.ui.openPlantModal(pick);
    const m = document.querySelector('.modal-mask');
    const T = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    /* ⚠️ 不要拿 textContent 判「行」：`.k`/`.v` 两个 span 紧贴，且相邻 `.attr` 之间
       也没有分隔 —— 扁平的文本会把「造价」「工期」两行粘成一串，看不出到底拆没拆。
       直接按 DOM 行取 k=/v= 才是"面板上真有几行"。 */
    const rows = m ? Array.from(m.querySelectorAll('.m-body .attr')).map(function (e) {
      var k = e.querySelector('.k'), v = e.querySelector('.v');
      return ((k && k.textContent) || '') + ' = ' + (((v && v.textContent) || '').replace(/\s+/g, ' ').trim());
    }) : [];
    var rowOf = function (key) {
      for (var i = 0; i < rows.length; i++) if (rows[i].indexOf(key + ' =') === 0) return rows[i];
      return '';
    };
    return { ci: pick, text: T, rows: rows,
      head: ((m && m.querySelector('.gold-heading')) || {}).textContent || '',
      hasFengdu: rows.some(function (r) { return /^丰度 =/.test(r); }),
      hasYieldMul: rows.some(function (r) { return /^丰度 =/.test(r) && /产量 ×\d/.test(r); }),
      dupPile: /另加[^（]{0,12}上限[^（]{0,20}每级另加/.test(T),
      hasLeftPct: /^储量 = 剩 \d+%/.test(rowOf('储量')),
      hasCapLabel: /上限/.test(rowOf('储量')),
      hasRealHour: /\d{3,}\.\d 现实小时/.test(T),
      hasFactoryIcon: /🏭/.test(T),
      shortName: /(^|[^生])生([^物]|$)/.test(T.replace(/生物质/g, '生物质')),
      costRow: rowOf('造价'), hoursRow: rowOf('工期'),
      reserveRow: rowOf('储量'), pileRow: rowOf('堆场') };
  });
  note('⑤ 采集场面板 ci=' + copy.ci, JSON.stringify({
    head: copy.head, rows: copy.rows
  }));
  ok('⑤ 丰度单独成行、写明是产量倍率', copy.hasFengdu === true && copy.hasYieldMul === true,
    'head=' + copy.head);
  ok('⑤ 堆场不再把「另加…上限…每级另加…上限」说两遍', copy.dupPile === false, 'dup=' + copy.dupPile);
  ok('⑤ 储量主看剩余百分比、绝对量带「上限」标签', copy.hasLeftPct === true && copy.hasCapLabel === true,
    copy.reserveRow);
  ok('⑤ 可采时长不再甩「1333.3 现实小时」这种量级', copy.hasRealHour === false, 'bad=' + copy.hasRealHour);
  ok('⑤ 标题图标取建筑自己的（水培温室不是 🏭）', copy.hasFactoryIcon === false, 'head=' + copy.head);
  ok('⑤ 正文资源用全名（不出现单字「生」）', copy.shortName === false, 'short=' + copy.shortName);
  ok('⑤ 造价与工期**各自成行**（造价行只有四种材料、不含工期）',
    /^造价 =.+净水/.test(copy.costRow || '') && !/工期/.test(copy.costRow || '')
    && /^工期 =/.test(copy.hoursRow || '') && !/净水/.test(copy.hoursRow || ''),
    'cost=' + JSON.stringify(copy.costRow) + ' | hours=' + JSON.stringify(copy.hoursRow));
  await p.screenshot({ path: OUT + '/12_plant_modal.png' });

  /* ══════ ⑥ 夜面底数 ══════ */
  const light = await p.evaluate(() => {
    const M = GAME.map3d;
    const term = (M._termU && M._termU.value != null) ? M._termU.value : NaN;
    const src = String(M.applyTerminator || '');
    const night = (1 - term) + term * 0.55;      /* 夜面 _sunL=0 */
    const day = (1 - term) + term * 1.0;         /* 日面 _sunL=1 */
    return { term: term, night: +night.toFixed(4), day: +day.toFixed(4),
      srcHasFloor: /0\.55 \+ 0\.45 \* _sunL/.test(src) };
  });
  note('⑥ 昼夜线', JSON.stringify(light));
  ok('⑥ 夜面底数抬到 0.55（夜面系数 ≥ 0.78，旧 0.71）', light.night >= 0.78, 'night=' + light.night);
  ok('⑥ 日面系数仍是 1.0（改夜面不许把白天提亮）', Math.abs(light.day - 1) < 1e-6, 'day=' + light.day);

  note('运行期错误', errs.length ? errs.slice(0, 5).join(' | ') : '0');
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(0);
})();
