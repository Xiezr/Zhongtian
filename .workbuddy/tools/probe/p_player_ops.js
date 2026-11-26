/* 真人操作演示：从地图上「点一格」开始，全程真实鼠标点击，逐步截图 + 记录点到的元素 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pops';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const log = [];
function step(n, text, extra) {
  const line = 'STEP ' + n + ' · ' + text + (extra ? '   [' + extra + ']' : '');
  console.log(line); log.push(line);
}
const waitBoot = async (p) => {
  for (let i = 0; i < 100; i++) {
    const on = await p.evaluate(() => {
      const ov = document.getElementById('boot-loading');
      return ov ? ov.classList.contains('on') : false;
    });
    if (!on) return true;
    await p.waitForTimeout(200);
  }
  return false;
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });

  /* ── 开局：走创角界面（真实按钮，不是 newGame） ── */
  const first = await p.evaluate(() => {
    const scr = document.getElementById('screen-create');
    return { visible: scr && !scr.classList.contains('hidden') };
  });
  step(1, '开局停在创角屏', 'visible=' + first.visible);
  await p.screenshot({ path: OUT + '/01_create.png' });

  /* ══ 先填名字（真实键盘逐个字符）══ 不填点开始会被拦：ui.doCreate 里 `if (!name) return` */
  const nameBox = await p.evaluate(() => {
    const el = document.getElementById('create-name');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      val: el.value || '', ph: el.placeholder || '' };
  });
  if (!nameBox) throw new Error('找不到名字输入框');
  step(2, '点名字输入框', 'placeholder="' + nameBox.ph + '" 当前值="' + nameBox.val + '"');
  await p.mouse.click(nameBox.x, nameBox.y);
  await p.keyboard.type('北辰', { delay: 90 });          /* 逐字符输入 */
  const typed = await p.evaluate(() => document.getElementById('create-name').value);
  step(3, '键盘输入名字', 'value="' + typed + '"');

  /* 真点「开始新的征程」 */
  const startBtn = await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, .btn'));
    const b = btns.find((x) => /开始|征程|出发/.test((x.textContent || '')) && x.offsetParent);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { text: (b.textContent || '').trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!startBtn) throw new Error('找不到开始按钮');
  await p.mouse.click(startBtn.x, startBtn.y);
  step(4, '点「' + startBtn.text + '」', 'x=' + Math.round(startBtn.x) + ' y=' + Math.round(startBtn.y));
  await p.waitForTimeout(2500);

  /* 关教程弹窗（真实点击） */
  for (let i = 0; i < 6; i++) {
    const btn = await p.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('button, .btn'));
      const b = bs.find((x) => x.offsetParent && /知道了|开始建设|继续|关闭|跳过|确定/.test((x.textContent || '')));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      if (!r.width) return null;
      return { text: (b.textContent || '').trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!btn) break;
    await p.mouse.click(btn.x, btn.y);
    step(5, '关遮罩/弹窗：点「' + btn.text + '」');
    await p.waitForTimeout(700);
  }

  /* 切到地图（真实点顶栏「地图」） */
  const mapTab = await p.evaluate(() => {
    const t = document.querySelector('#topnav .tab[data-view="map"]') || document.querySelector('[data-view="map"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { text: (t.textContent || '').trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!mapTab) throw new Error('找不到地图页签');
  await p.mouse.click(mapTab.x, mapTab.y);
  step(6, '点顶栏「' + mapTab.text + '」进地图', 'x=' + Math.round(mapTab.x) + ' y=' + Math.round(mapTab.y));
  /* 等画布真的插进 DOM（setView('map') 会触发分帧构建，6 秒左右） */
  let canvasOk = false;
  for (let i = 0; i < 150; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas');
      const ov = document.getElementById('boot-loading');
      return { canvas: !!c, w: c ? c.clientWidth : 0, boot: ov ? ov.classList.contains('on') : false,
        view: (GAME.ui && GAME.ui.view) || '' };
    });
    if (st.canvas && st.w > 0 && !st.boot) { canvasOk = true; break; }
    await p.waitForTimeout(200);
  }
  const viewNow = await p.evaluate(() => ({ view: GAME.ui.view, canvas: !!document.getElementById('mapCanvas') }));
  step(7, '地图视图就绪', JSON.stringify({ canvasOk, viewNow }));
  if (!canvasOk) throw new Error('画布没起来（view=' + JSON.stringify(viewNow) + '）');
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/02_map.png' });

  /* ══ 镜头先对准自己的城（玩家会点「回本城」，而不是凭感觉找）══ */
  const myCityBtn = await p.evaluate(() => {
    const b = document.querySelector('[data-action="map-mycity"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { t: (b.textContent || '').trim(), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
  });
  if (myCityBtn && myCityBtn.w > 0) {
    step(8, '点「' + myCityBtn.t + '」把镜头对准本城', 'x=' + myCityBtn.x + ' y=' + myCityBtn.y);
    await p.mouse.click(myCityBtn.x, myCityBtn.y);
    await p.waitForTimeout(1200);
  } else {
    step(8, '没找到「回本城」按钮（跳过）');
  }

  /* 拉近一点（真实滚轮），让格子大到能点准 */
  await p.mouse.move(720, 450);
  for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(90); }
  await p.waitForTimeout(1200);
  const zoom = await p.evaluate(() => {
    const M = GAME.map3d;
    return { dist: +M.camO.dist.toFixed(1), eyeAbove: +(M.camO.dist - M.R).toFixed(1), surf: !!M._surf };
  });
  step(9, '滚轮拉近 14 格', JSON.stringify(zoom));
  await p.screenshot({ path: OUT + '/03_zoom.png' });

  /* 找一个**屏幕上能看到、已探明、能建采集场**的格子，算它的屏幕坐标 */
  const target = await p.evaluate(() => {
    const M = GAME.map3d, RS = GAME.resource, cam = M._cam;
    const rect = document.getElementById('mapCanvas').getBoundingClientRect();
    const cells = M._collider.cells;
    const cityCis = {}; (GAME.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    const pci = M.playerCi();
    const best = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; if (!c || cityCis[i]) continue;
      if (GAME.fog.get(i) <= 0) continue;
      /* 必须是**野地格**：`M.cellKind[ci]` 是渲染层维护的权威分类
         （city/fort/camp/village/ruin/wild…）。上一版用 `map.wildAt` 判错了
         ——它只返回"已生成交战记录的野地"，普通格一律 null，于是候选变 0。 */
      let kind = null;
      try { kind = (M.cellKind && M.cellKind[i]) || 'wild'; } catch (e) { kind = 'wild'; }
      if (kind !== 'wild') continue;
      let rv = null; try { rv = RS.view(i); } catch (e) { rv = null; }
      if (!rv) continue;
      const v = new THREE.Vector3(c.dir[0] * M.R, c.dir[1] * M.R, c.dir[2] * M.R).project(cam);
      if (Math.abs(v.x) > 0.85 || Math.abs(v.y) > 0.85 || v.z > 1) continue;   /* 留边，别点到 UI 上 */
      const sx = rect.left + (v.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      if (sx < rect.left + 40 || sx > rect.right - 40 || sy < rect.top + 60 || sy > rect.bottom - 120) continue;
      best.push({ ci: i, type: c.type, res: rv.res, scanned: !!rv.scanned, x: Math.round(sx), y: Math.round(sy),
        distToMe: +(Math.acos(Math.max(-1, Math.min(1, c.dir[0] * cells[pci].dir[0] + c.dir[1] * cells[pci].dir[1] + c.dir[2] * cells[pci].dir[2]))) * M.R).toFixed(1) });
    }
    /* 优先"未勘探、能建厂、离我 >11 米"的（这样能演示走过去） */
    best.sort((a, c) => (c.distToMe > 11 ? 1 : 0) - (a.distToMe > 11 ? 1 : 0));
    return { cands: best.length, pick: best[0] || null };
  });
  console.log('候选格 ' + target.cands + ' 个，选：' + JSON.stringify(target.pick));
  if (!target.pick) throw new Error('屏幕上没有可点的资源格');
  const T = target.pick;

  /* ══ 真点地图上那一格 ══ */
  step(10, '在地图上点这一格（' + T.type + '，离我 ' + T.distToMe + ' 米）', 'x=' + T.x + ' y=' + T.y);
  await p.mouse.click(T.x, T.y);
  await p.waitForTimeout(900);
  const panel1 = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    if (!m) return { open: false };
    const head = (m.querySelector('.gold-heading') || {}).textContent || '';
    const btns = Array.from(m.querySelectorAll('button, .btn')).map((b) => ({
      t: (b.textContent || '').trim(), a: b.getAttribute('data-action') || '',
      r: (function () { const q = b.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()
    })).filter((x) => x.t);
    return { open: true, head: head.trim(), btns: btns.slice(0, 8),
      txt: (m.textContent || '').replace(/\s+/g, ' ').slice(0, 260) };
  });
  console.log('—— 面板：' + JSON.stringify({ head: panel1.head, btns: panel1.btns.map((b) => b.t) }));
  step(11, '弹出地块面板「' + (panel1.head || '?') + '」');
  await p.screenshot({ path: OUT + '/04_cell_panel.png' });

  /* ══ 真点「走过去勘探」══ */
  const goBtn = (panel1.btns || []).find((b) => b.a === 'res-go-scan' || b.a === 'res-scan');
  if (goBtn) {
    step(12, '点面板按钮「' + goBtn.t + '」', 'x=' + goBtn.r.x + ' y=' + goBtn.r.y);
    await p.mouse.click(goBtn.r.x, goBtn.r.y);
    await p.waitForTimeout(700);
    const walking = await p.evaluate(() => {
      const M = GAME.map3d;
      const qh = document.getElementById('quest-hint');
      return { target: M.walkTarget(), hud: qh ? (qh.textContent || '').trim() : '',
        modal: !!document.querySelector('.modal-mask'), walkThen: M._walkThen || null };
    });
    step(13, '面板关闭、小人开始走', JSON.stringify(walking));
    await p.screenshot({ path: OUT + '/05_walking.png' });

    /* ============================================================
     * headless 的 rAF 被节流到 ~1fps（46 秒走不完 24 米），这里用 60fps 补偿推进。
     * 真机上这段由渲染循环驱动；到达后 `_openCellPanel` 也在渲染循环里，
     * 所以补偿时把同一行也补上（`openLandModalCi` 是它的公开出口）。
     * ⚠️ 这只是补"headless 缺帧"，操作路径（点哪、点什么按钮）一个字没省。
     * ============================================================ */
    await p.evaluate(() => {
      window.__pump = setInterval(() => {
        for (let i = 0; i < 12; i++) {
          let r = null;
          try { r = GAME.map3d.stepWalkTo(1 / 60); } catch (e) { }
          if (r && r.arrived) {
            try { GAME.ui.openLandModalCi(r.ci); } catch (e2) { }   /* 渲染循环同一行 */
            clearInterval(window.__pump); window.__pump = null;
            return;
          }
        }
      }, 16);
    });
    let arrived = null;
    for (let i = 0; i < 60; i++) {
      await p.waitForTimeout(300);
      arrived = await p.evaluate(() => {
        const M = GAME.map3d;
        return { ci: M.playerCi(), target: M.walkTarget(), modal: !!document.querySelector('.modal-mask'),
          scan: (function () { try { const rv = GAME.resource.view(M.playerCi()); return !!(rv && rv.scanned); } catch (e) { return null; } })() };
      });
      if (arrived.target < 0) break;
    }
    await p.evaluate(() => { if (window.__pump) { clearInterval(window.__pump); window.__pump = null; } });
    await p.waitForTimeout(700);
    step(14, '走到了', JSON.stringify(arrived));
    await p.screenshot({ path: OUT + '/06_arrived.png' });
  }

  /* ══ 到达后的面板：真点「建采集场」══ */
  const panel2 = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    if (!m) return { open: false };
    const btns = Array.from(m.querySelectorAll('button, .btn')).map((b) => ({
      t: (b.textContent || '').trim(), a: b.getAttribute('data-action') || '',
      r: (function () { const q = b.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()
    })).filter((x) => x.t);
    return { open: true, head: ((m.querySelector('.gold-heading') || {}).textContent || '').trim(), btns: btns.slice(0, 8) };
  });
  console.log('—— 到达后面板：' + JSON.stringify({ head: panel2.head, btns: (panel2.btns || []).map((b) => b.t) }));
  const buildBtn = (panel2.btns || []).find((b) => b.a === 'res-build-open' || b.a === 'res-go-build');
  if (buildBtn) {
    step(15, '点「' + buildBtn.t + '」', 'x=' + buildBtn.r.x + ' y=' + buildBtn.r.y);
    await p.mouse.click(buildBtn.r.x, buildBtn.r.y);
    await p.waitForTimeout(900);
    const panel3 = await p.evaluate(() => {
      const m = document.querySelector('.modal-mask');
      if (!m) return { open: false };
      const btns = Array.from(m.querySelectorAll('button, .btn')).map((b) => ({
        t: (b.textContent || '').trim(), a: b.getAttribute('data-action') || '',
        r: (function () { const q = b.getBoundingClientRect(); return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2) }; })()
      })).filter((x) => x.t);
      return { open: true, head: ((m.querySelector('.gold-heading') || {}).textContent || '').trim(), btns: btns.slice(0, 10) };
    });
    console.log('—— 选建面板：' + JSON.stringify({ head: panel3.head, btns: (panel3.btns || []).map((b) => b.t) }));
    await p.screenshot({ path: OUT + '/07_build_pick.png' });
    const doBtn = (panel3.btns || []).find((b) => /开工|建造/.test(b.t) && !/取消/.test(b.t));
    if (doBtn) {
      step(16, '点「' + doBtn.t + '」', 'x=' + doBtn.r.x + ' y=' + doBtn.r.y);
      await p.mouse.click(doBtn.r.x, doBtn.r.y);
      await p.waitForTimeout(1000);
      const after = await p.evaluate(() => {
        const q = (GAME.state.queues && GAME.state.queues.build) || [];
        return { queues: q.length, last: q.length ? { type: q[q.length - 1].type, ci: q[q.length - 1].ci } : null };
      });
      step(17, '开工后施工队列', JSON.stringify(after));
      await p.screenshot({ path: OUT + '/08_queued.png' });
    }
  }

  console.log('=== 页面错误 ===', JSON.stringify(errs.slice(0, 4)));
  fs.writeFileSync(OUT + '/steps.txt', log.join('\n'));
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
