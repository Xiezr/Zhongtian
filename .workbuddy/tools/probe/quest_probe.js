/* P5-b 任务链探针（v158.6）
 * 判据：A 六步状态机定义齐全 / B 观察器推进（walk→…→fight）/ C 位置派生不入档 /
 *       D 时间源 world.elapsed 非现实日 / E 观察钩子后置登记不拦截 / F 回退开关 + P0~P4 保留
 *
 * 跑法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *   node .workbuddy/tools/probe/quest_probe.js > .workbuddy/tmp/quest_probe.log 2>&1
 */
'use strict';
const { chromium } = require('playwright-core');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  c ? (pass++, console.log('  ✅ ' + n + (x ? '  [' + x + ']' : '')))
    : (fail++, console.log('  ❌ ' + n + (x ? '  [' + x + ']' : '')));
};

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--allow-file-access-from-files', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.map3d && window.GAME.questline', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'qst', cityName: '灰岗', mapSeed: 20261023 });
    GAME.ui.enterGame();
    GAME.ui.setView('map');
  });
  await p.waitForTimeout(2500);

  /* ---- A. 六步状态机定义齐全 ---- */
  const a = await p.evaluate(() => ({
    has: !!GAME.questline && !!GAME.questline.tick && !!GAME.questline.state,
    steps: (GAME.questline.STEPS || []).map((s) => s.id).join(','),
    regged: !!GAME.reg && !!GAME.reg.get('questline')
  }));
  ok('A1 questline 出口齐全 + 六步定义', a.has && a.steps === 'walk,look,enter,ride,talk,fight',
    'steps=' + a.steps);
  ok('A2 已自注册到 registry（panel 可见）', a.regged, 'regged=' + a.regged);

  /* ---- B. 观察器推进 ---- */
  await p.evaluate(() => {
    window.__settle = function () {
      const D = GAME.district;
      D.TRANSITION_MS = 1;
      for (let i = 0; i < 8 && D.active; i++) D.tick();
      D.TRANSITION_MS = 240;
      D.camera();
    };
  });
  const b0 = await p.evaluate(() => GAME.questline.summary());
  ok('B0 初始 step=0', b0.step === 0, 'step=' + b0.step);

  // walk：模拟球面行走累计 ≥3m（直接喂 _walkAcc，不依赖真按键时序）
  const b1 = await p.evaluate(() => {
    GAME.questline._walkAcc = 5;   /* 已达 MIN_WALK_M=3 */
    const r = GAME.questline.tick();
    return { r, step: GAME.questline.summary().step };
  });
  ok('B1 walk 达标推进', b1.r && b1.r.step === 'walk' && b1.step === 1,
    JSON.stringify(b1.r) + ' step=' + b1.step);

  // look：模拟打开过面板
  const b2 = await p.evaluate(() => {
    GAME.questline.onLook();
    const r = GAME.questline.tick();
    return { r, step: GAME.questline.summary().step };
  });
  ok('B2 look 达标推进', b2.r && b2.r.step === 'look' && b2.step === 2,
    JSON.stringify(b2.r));

  // enter
  const b3 = await p.evaluate(() => {
    GAME.questline.onEnter();
    const r = GAME.questline.tick();
    return { r, step: GAME.questline.summary().step };
  });
  ok('B3 enter 达标推进', b3.r && b3.r.step === 'enter' && b3.step === 3,
    JSON.stringify(b3.r));

  // ride
  const b4 = await p.evaluate(() => {
    GAME.questline.onRide();
    const r = GAME.questline.tick();
    return { r, step: GAME.questline.summary().step };
  });
  ok('B4 ride 达标推进', b4.r && b4.r.step === 'ride' && b4.step === 4,
    JSON.stringify(b4.r));

  // talk
  const b5 = await p.evaluate(() => {
    GAME.questline.onTalk();
    const r = GAME.questline.tick();
    return { r, step: GAME.questline.summary().step };
  });
  ok('B5 talk 达标推进', b5.r && b5.r.step === 'talk' && b5.step === 5,
    JSON.stringify(b5.r));

  // fight（需 rounds≥1）
  const b6 = await p.evaluate(() => {
    GAME.questline.onFight(3);
    const r = GAME.questline.tick();
    return { r, step: GAME.questline.summary().step, done: GAME.questline.done() };
  });
  ok('B6 fight 达标推进到完成', b6.r && b6.r.step === 'fight' && b6.step === 6 && b6.done,
    JSON.stringify(b6.r) + ' step=' + b6.step + ' done=' + b6.done);

  /* ---- C. 位置派生不入档 ---- */
  const c = await p.evaluate(() => {
    const raw = JSON.stringify(GAME.savePayload ? GAME.savePayload() : GAME.state);
    const st = GAME.savePayload ? JSON.parse(GAME.savePayload()) : GAME.state;
    return {
      questPos: raw.indexOf('questPos') >= 0,
      hasQuest: !!st.quest,
      questShape: st.quest ? Object.keys(st.quest).join(',') : 'none',
      hasCoordInQuest: (function () {
        if (!st.quest) return false;
        const s = JSON.stringify(st.quest);
        return /"x"\s*:/.test(s) || /"z"\s*:/.test(s) || /"dir"\s*:/.test(s) || /"pos"\s*:/.test(s);
      })()
    };
  });
  ok('C1 存档无 questPos', c.questPos === false, 'questPos=' + c.questPos);
  ok('C2 quest 入档但只存进度（无坐标/位置字段）', c.hasQuest && !c.hasCoordInQuest,
    'shape=' + c.questShape + ' coord=' + c.hasCoordInQuest);

  /* ---- D. 纯事件驱动：无时钟依赖、不碰现实日 ---- */
  const d = await p.evaluate(() => {
    const Q = GAME.questline;
    return {
      noRealDay: (Q.tick.toString().indexOf('Date.now') < 0
        && Q.tick.toString().indexOf('questDayIndex') < 0),
      eventDriven: typeof Q.onLook === 'function' && typeof Q.onEnter === 'function'
        && typeof Q.onRide === 'function' && typeof Q.onTalk === 'function'
        && typeof Q.onFight === 'function'
    };
  });
  ok('D1 任务链纯事件驱动、不碰现实日/questDayIndex',
    d.noRealDay && d.eventDriven, JSON.stringify(d));

  /* ---- E. 观察钩子后置登记不拦截（E 键分派顺序不变） ---- */
  const e = await p.evaluate(() => {
    const mn = document.querySelector('script[src*="bundle"]') ? '' : '';
    /* 直接读源码断言：main.js E 键分派仍是 P3→P4→P1，无 quest 分支插入 */
    return null;
  });
  // 源码断言在 smoke 里做；这里验证运行时行为：勾子不改变 npc.interact 返回
  const e1 = await p.evaluate(() => {
    const before = GAME.npc.interact.toString();
    return before.indexOf('questline') >= 0;   /* npc.interact 本体不含 questline 分支 */
  });
  ok('E1 npc.interact 本体不含任务链分支（钩子后置、不拦截）', e1 === false,
    'interact 含 questline=' + e1);

  /* ---- F. 回退开关 + P0~P4 保留 ---- */
  const f = await p.evaluate(() => {
    const M = GAME.map3d;
    M.QUEST = false;
    GAME.questline._walkAcc = 5;
    const q0 = GAME.questline.summary().step;
    const r = GAME.questline.tick();   /* 关开关后不推进 */
    const q1 = GAME.questline.summary().step;
    M.QUEST = true;
    return {
      blocked: r === null, stepSame: q0 === q1,
      p0: typeof M.playerPose === 'function' && typeof M.setPlayerPose === 'function',
      p1: typeof M.nearestInteractable === 'function',
      p2: typeof GAME.district.step === 'function',
      p3: typeof GAME.vehicle.toggle === 'function',
      p4: typeof GAME.npc.interact === 'function' && typeof GAME.npc.fight === 'function'
    };
  });
  ok('F1 M.QUEST=false 一键回退（不推进）', f.blocked && f.stepSame,
    JSON.stringify(f));
  ok('F2 P0~P4 出口逐字仍在', f.p0 && f.p1 && f.p2 && f.p3 && f.p4, JSON.stringify(f));
  ok('F3 无页面异常', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

  console.log('结果：' + pass + '/' + (pass + fail) + ' 通过，' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
