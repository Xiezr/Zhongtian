/* ============================================================
 * eval.js —— 主编排器：12h · 600× · 全功能按钮浸泡评测
 * 用法: node eval.js [--hours 12] [--fast]
 *   --hours N  总运行现实小时（默认 12）
 *   --fast     压缩计划（验证跑用：每章程 ~90s）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const core = require('./lib/core');
const { Bot } = require('./lib/bot');
const { sweep, reachSweep } = require('./lib/sweep');
const { CHARTERS, monkey, edgeCases, runCharter } = require('./lib/play');

const HOURS = (() => {
  const i = process.argv.indexOf('--hours');
  return i >= 0 ? Number(process.argv[i + 1]) || 12 : 12;
})();
const FAST = process.argv.includes('--fast');
const TOTAL_MS = HOURS * 3600 * 1000;

const PHASES = FAST ? [
  { id: 'C1', dur: 100000 }, { id: 'C2', dur: 100000 }, { id: 'C3', dur: 90000 },
  { id: 'C4', dur: 90000 }, { id: 'C5', dur: 90000 }
] : [
  { id: 'C1', dur: 2.25 * 3600e3 }, { id: 'C2', dur: 2 * 3600e3 }, { id: 'C3', dur: 2 * 3600e3 },
  { id: 'C4', dur: 2 * 3600e3 }, { id: 'C5', dur: 2 * 3600e3 }
];
const BOOTSTRAP_MS = FAST ? 60000 : 15 * 60e3;
const C6_MS = FAST ? 120000 : 75 * 60e3;
const MONKEY_EVERY = FAST ? 45000 : 45 * 60e3;      // 每这么久插一次混沌爆发
const MONKEY_DUR = FAST ? 25000 : 90e3;

const t0 = Date.now();
const el = () => Date.now() - t0;
const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 3600) + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

async function main() {
  core.heartbeat(`===== 评测启动 hours=${HOURS} fast=${FAST} =====`);
  core.logEvent('run-start', { hours: HOURS, fast: FAST, actions: core.ACTIONS.length });

  /* ---- 0. 清空上一轮日志（JSONL 为追加模式，保证本轮数据纯净） ---- */
  for (const f of ['behavior.jsonl', 'samples.jsonl', 'events.jsonl', 'heartbeat.log']) {
    try { fs.writeFileSync(path.join(core.LOGS, f), ''); } catch (e) {}
  }

  /* ---- 1. 静态服务器（子进程） ---- */
  const server = spawn(process.execPath, [path.join(__dirname, 'server.js'), core.GAME_DIR, String(core.PORT)], {
    stdio: 'ignore', detached: false
  });
  await new Promise(r => setTimeout(r, 1200));

  /* ---- 2. 浏览器（持久化上下文；存档由 bootstrap 清 localStorage 实现清档开局） ---- */
  const bot = new Bot();
  await bot.launch();

  /* ---- 3. 监控循环（独立于会话，贯穿全程） ---- */
  const monitor = setInterval(async () => {
    try {
      const r = await bot.sample();
      if (r.viol.length) core.heartbeat('违例 ' + r.viol.map(v => v.id + ':' + v.msg.slice(0, 60)).join(' ; '));
    } catch (e) { core.heartbeat('监控异常: ' + String(e.message).slice(0, 100)); }
  }, 30000);
  const covTimer = setInterval(() => core.flushCoverage(), 300000);
  const hbTimer = setInterval(() => {
    const c = core.covSnapshot().stat;
    core.heartbeat(`运行 ${fmt(el())}/${fmt(TOTAL_MS)} 覆盖 touched=${c.touched} blocked=${c.blocked} pending=${c.pending} 点击=${bot.stats.clicks} 恢复=${bot.stats.recovers}`);
  }, 60000);

  /* ---- 4. 建档（C0） ---- */
  core.heartbeat('—— 建档阶段 ——');
  await bootstrap(bot);
  await bot.shot('boot_city');

  /* ---- 5. 阶段循环 ---- */
  let lastMonkey = 0;
  for (const ph of PHASES) {
    if (stopping || el() > TOTAL_MS - C6_MS - 60000) break;
    const charter = CHARTERS.find(c => c.id === ph.id);
    const phaseEnd = el() + ph.dur;
    core.heartbeat(`—— 章程 ${charter.id} ${charter.name} 开始（预算 ${fmt(ph.dur)}）——`);
    while (el() < phaseEnd && !stopping && el() < TOTAL_MS - C6_MS - 60000) {
      try {
        await runCharter(bot, charter, Math.min(phaseEnd - el(), FAST ? 45000 : 300000));
      } catch (e) {
        core.heartbeat('会话异常: ' + String(e.message).slice(0, 120));
        const ok = await bot.recover(e);
        if (!ok) { core.heartbeat('恢复失败，等待 30s 重试'); await bot.wait(30000); }
      }
      // 混沌爆发
      if (el() - lastMonkey > MONKEY_EVERY && !stopping) {
        await monkey(bot, MONKEY_DUR, ph.id);
        lastMonkey = el();
      }
    }
    await bot.shot('phase_' + ph.id);
    core.flushCoverage();
  }

  /* ---- 6. C6：边界用例 + 覆盖补扫 ---- */
  if (!stopping && el() < TOTAL_MS - 120000) {
    core.heartbeat('—— C6 边界用例 + 覆盖补扫 ——');
    try { await edgeCases(bot); } catch (e) { core.logEvent('edge-fail', { msg: String(e.message).slice(0, 140) }); }
    // 边界用例含页面刷新：倍率会重置为默认值，补扫前重设 600× 保持浸泡条件
    try { await setTimescale(bot, 600, 'C6'); } catch (e) {}
    await bot.nav('city'); await bot.wait(300);
    try { await reachSweep(bot, { sid: 'C6' }); } catch (e) { core.logEvent('reach-fail', { msg: String(e.message).slice(0, 140) }); }
    // 补扫后再来一轮全视图基础扫描
    for (const v of core.VIEWS) {
      try { await sweep(bot, { sid: 'C6', views: [v], maxClicks: 14, perViewMax: 14 }); } catch (e) {}
    }
    await bot.shot('c6_done');
  }

  /* ---- 7. C7：收尾 ---- */
  core.heartbeat('—— 收尾 ——');
  try {
    const final = await bot.sample();
    core.logEvent('final-state', final);
    fs.writeFileSync(path.join(core.LOGS, 'final_state.json'), JSON.stringify(final, null, 1));
    await bot.shot('final_city');
    // 存档导出留证
    await bot.nav('settings'); await bot.wait(300);
    await bot.page.evaluate(`(function(){ var b=document.querySelector('#view-container [data-action="save"]'); if(b) b.click(); })()`).catch(() => {});
    await bot.wait(500);
    await bot.page.evaluate(`(function(){ var b=document.querySelector('#view-container [data-action="open-saves"]'); if(b) b.click(); })()`).catch(() => {});
    await bot.wait(400);
    await bot.page.evaluate(`(function(){ var b=document.querySelector('#modal-root [data-action="save-slot-export"]'); if(b) b.click(); })()`).catch(() => {});
    await bot.wait(1500);
  } catch (e) {}
  core.flushCoverage();
  const stat = core.covSnapshot().stat;
  core.logEvent('run-end', { stat, stats: bot.stats, elapsed: el() });
  core.heartbeat(`===== 评测结束 ${fmt(el())} 覆盖=${JSON.stringify(stat)} 点击=${bot.stats.clicks} =====`);
  try { await bot.browser.close(); } catch (e) {}
  clearInterval(monitor); clearInterval(covTimer); clearInterval(hbTimer);
  try { server.kill(); } catch (e) {}
  // 自动进入分析
  try {
    const { execFileSync } = require('child_process');
    execFileSync(process.execPath, [path.join(__dirname, 'analyze.js')], { stdio: 'inherit' });
  } catch (e) { core.heartbeat('analyze 失败: ' + String(e.message).slice(0, 120)); }
  process.exit(0);
}

/* ---------- 建档 ---------- */
async function bootstrap(bot) {
  await bot.gotoGame();
  // 清掉上一次运行遗留的存档（主档/元数据/槽位索引），强制走创建屏。
  // 否则 boot 检测到 hasSave() 会直接读档进游戏，建档阶段被整体跳过。
  await bot.page.evaluate(`(function(){
    try {
      Object.keys(localStorage).filter(function(k){ return k.indexOf('sanguo') === 0; })
        .forEach(function(k){ localStorage.removeItem(k); });
    } catch(e){}
  })()`).catch(() => {});
  await bot.gotoGame();   // 重新导航：boot 时无存档 → 停在创建屏（并重装 action 包裹）
  // 等创建屏
  await bot.page.waitForFunction(
    `(function(){ var c=document.getElementById('screen-create'); return c && !c.classList.contains('hidden'); })()`,
    null, { timeout: 15000 }).catch(() => {});
  core.logEvent('bootstrap', { step: 'create-screen' });

  // 创建屏按钮全触及（create-start 最后点；create-continue 无存档时仅 toast，可安全先点）
  const btns = await bot.enumInteractive();
  for (const d of btns) {
    if (d.idx < 2000) continue;                       // 只点创建屏（idx>=2000）
    if (d.disabled) { core.covState(d.action || 'create:' + d.label, 'blocked', d.why); continue; }
    if (d.action === 'create-start') continue;        // 最后点
    if (d.tag === 'SELECT' || (d.type && ['range', 'text'].includes(d.type))) {
      if (d.type === 'text') continue;
    }
    try { await bot.clickDesc(d, { sid: 'C0', wait: 200 }); } catch (e) {}
    await bot.wait(80);
  }
  // 填名 + 开局
  await bot.page.evaluate(`(function(){
    var n = document.getElementById('create-name');
    if (n) { n.value = '评测君主'; n.dispatchEvent(new Event('input',{bubbles:true})); }
  })()`).catch(() => {});
  const startBtn = (await bot.enumInteractive()).find(d => d.action === 'create-start');
  if (startBtn) await bot.clickDesc(startBtn, { sid: 'C0', wait: 500 });
  core.logEvent('bootstrap', { step: 'create-start' });
  // 等进游戏
  await bot.page.waitForFunction(
    `(function(){ return window.GAME && GAME.state && !document.getElementById('screen-game').classList.contains('hidden'); })()`,
    null, { timeout: 20000 }).catch(() => {});
  const inGame = await bot.page.evaluate(`(function(){ return !!(window.GAME && GAME.state); })()`).catch(() => false);
  core.logEvent('bootstrap', { step: 'in-game', ok: inGame });
  if (!inGame) throw new Error('建档失败：未能进入游戏');

  // 600× 设置（走设置页芯片 —— 真实 UI 路径）
  await setTimescale(bot, 600, 'C0');
  await bot.nav('city'); await bot.wait(400);
}

/* 走设置页芯片设置时间倍率（刷新后倍率会重置为默认值，需重设） */
async function setTimescale(bot, v, sid) {
  await bot.nav('settings'); await bot.wait(400);
  const chip = await bot.page.evaluate(`(function(){
    var c = document.querySelector('#view-container .chip[data-after="timescale"][data-v="${v}"]');
    if (c) { c.click(); return true; } return false;
  })()`).catch(() => false);
  await bot.wait(400);
  const ts = await bot.page.evaluate(`(function(){ return GAME.timeScale(); })()`).catch(() => 0);
  core.logEvent('bootstrap', { step: 'timescale-' + v, chipClicked: chip, ts, sid });
  core.recBehavior.write({ sid: sid || 'C0', type: 'sys', label: 'set-timescale-' + v, result: { ts } });
  core.covTouch('chip-set', { view: 'settings' });
  if (v === 600) await bot.shot('boot_settings_600');
  return ts;
}

main().catch(e => {
  core.heartbeat('FATAL ' + String(e.stack || e).slice(0, 400));
  core.logEvent('fatal', { msg: String(e.stack || e).slice(0, 600) });
  process.exit(1);
});
