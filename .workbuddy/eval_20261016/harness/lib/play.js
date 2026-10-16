/* ============================================================
 * play.js —— 人格章程机器人 / 混沌猴子 / 边界用例
 * ============================================================ */
'use strict';
const core = require('./core');
const { sweep } = require('./sweep');

/* ---------- 通用辅助 ---------- */
async function clampQtyInputs(bot) {
  await bot.page.evaluate(`(function(){
    document.querySelectorAll('input[type=number]').forEach(function(el){
      try { el.value = '1'; el.dispatchEvent(new Event('input', {bubbles:true})); } catch(_){}
    });
  })()`).catch(() => {});
}

async function clickFirst(bot, action, opts) {
  opts = opts || {};
  const els = await bot.enumInteractive();
  const hit = (els || []).filter(d => d.action === action && !d.disabled);
  if (!hit.length) {
    if (opts.recordMiss) core.covState(action, 'blocked', '当前无可点目标');
    return null;
  }
  return await bot.clickDesc(hit[0], { sid: opts.sid || 'P' });
}

async function openAndConfirm(bot, opener, confirmRe, sid) {
  const r0 = await clickFirst(bot, opener, { sid });
  if (!r0) return null;
  await bot.wait(350);
  const els = await bot.enumInteractive();
  const modalBtns = (els || []).filter(d => d.inModal && !d.disabled &&
    !core.DANGER_BLOCK.has(d.action) && d.action !== 'close-modal' && d.action !== opener);
  const re = confirmRe ? new RegExp(confirmRe) : null;
  let pick = re ? modalBtns.find(d => re.test(d.action || '')) : null;
  if (!pick) pick = modalBtns.find(d => /confirm|do-|build|train|buy|sell|use|equip|start|apply|upgrade/.test(d.action || '')) || modalBtns[0];
  if (!pick) { await bot.closeModals(); return null; }
  const r = await bot.clickDesc(pick, { sid });
  await bot.wait(250);
  return r;
}

/* ---------- 人格章程 ---------- */
const CHARTERS = [
  { id: 'C0', name: '建档与初始设置', views: ['settings'],
    profile: /^(create|chip|set|gender|avatar|city-random|pick-lord)/ },
  { id: 'C1', name: '城主', views: ['city', 'ext', 'admin'],
    profile: /^(build|confirm-build|confirm-upgrade|ext-|rush|cancel-build|demolish|city-|assign|promote|set-main|tax|toggle-auto-upgrade|open-|hearts)/ },
  { id: 'C2', name: '统帅', views: ['generals', 'marches', 'city'],
    profile: /^(gen-|train|select-train|exp-|bt-|march-|auto-|siege|tower|conscript|heal|release|dismiss|promote|lord-|do-|troop|inn-|open-troops|open-inn|open-wall|open-outposts)/ },
  { id: 'C3', name: '商人', views: ['shop', 'bag', 'admin'],
    profile: /^(shop|market|bag|forge|enh|equip|unequip|use|quick|consign|qb|mat|sell|buy|salvage|open-market|open-forge|open-enhance|open-store|open-workshop|open-xiaochang|ling|chip)/ },
  { id: 'C4', name: '探索者', views: ['map', 'ext'],
    profile: /^(map|wild|wonder|gather|scout|fort|ext|galaxy|sky|toggle-auto-gather|open-wilds|open-outposts)/ },
  { id: 'C5', name: '集大成者', views: ['collection', 'admin', 'settings', 'reports'],
    profile: /^(collect|rep|doc|msg|artifact|tactic|tac|jieyue|planet|adm|save|open-|farm|theme|zoom|mk-|report|moment|am-|mp)/ }
];

/* ---------- 各人格的目标驱动例程 ---------- */
const routines = {
  async C1(bot) {
    // 建设循环：开建造列表 → 确认首个可建 → 升级府衙
    for (let i = 0; i < 4; i++) {
      await bot.nav('city'); await bot.wait(200);
      await openAndConfirm(bot, 'build-cell', /confirm-build|build-/, 'C1');
      await bot.closeModals();
      await openAndConfirm(bot, 'build-cell', /confirm-upgrade/, 'C1');
      await bot.closeModals();
      await bot.wait(300);
    }
    await clickFirst(bot, 'rush-build', { sid: 'C1' });   // 加速券（无券则 blocked）
    await bot.closeModals();
    await bot.nav('ext'); await bot.wait(200);
    await openAndConfirm(bot, 'ext-cell', /ext-build|confirm/, 'C1');
    await bot.closeModals();
    await clickFirst(bot, 'toggle-auto-upgrade', { sid: 'C1' });
    await clickFirst(bot, 'set-main-city', { sid: 'C1' });
    await clickFirst(bot, 'tax-step', { sid: 'C1' });
    await bot.wait(200);
    await clickFirst(bot, 'tax-step', { sid: 'C1' });
  },

  async C2(bot) {
    await bot.nav('generals'); await bot.wait(250);
    await clickFirst(bot, 'gen-pick', { sid: 'C2' });
    await bot.wait(200);
    await clickFirst(bot, 'gen-rankup', { sid: 'C2' });
    await clickFirst(bot, 'gen-stat-plus', { sid: 'C2' });
    await clickFirst(bot, 'gen-auto-equip', { sid: 'C2' });
    await bot.nav('admin'); await bot.wait(200);
    await openAndConfirm(bot, 'open-inn', /inn-recruit/, 'C2');
    await bot.closeModals();
    await bot.nav('city'); await bot.wait(200);
    await openAndConfirm(bot, 'open-troops', /confirm-train|select-train/, 'C2');
    await bot.closeModals();
    await bot.nav('marches'); await bot.wait(250);
    await clickFirst(bot, 'exp-open', { sid: 'C2' });
    await bot.wait(300);
    await clickFirst(bot, 'exp-pick', { sid: 'C2' });
    await clickFirst(bot, 'exp-max', { sid: 'C2' });
    await clickFirst(bot, 'exp-confirm', { sid: 'C2' });   // 兵力不足则 blocked（合法记录）
    await bot.closeModals();
    await clickFirst(bot, 'auto-march-once', { sid: 'C2' });
    await clickFirst(bot, 'toggle-auto-march', { sid: 'C2' });
    await clickFirst(bot, 'toggle-auto-train', { sid: 'C2' });
    await clickFirst(bot, 'toggle-auto-lord', { sid: 'C2' });
    await clickFirst(bot, 'toggle-auto-heal', { sid: 'C2' });
    await clickFirst(bot, 'toggle-auto-research', { sid: 'C2' });
  },

  async C3(bot) {
    await bot.nav('shop'); await bot.wait(250);
    await clickFirst(bot, 'shop-cat', { sid: 'C3' });
    await bot.wait(200);
    await clampQtyInputs(bot);
    await clickFirst(bot, 'shop-buy', { sid: 'C3' });
    await bot.nav('admin'); await bot.wait(200);
    await clickFirst(bot, 'open-market', { sid: 'C3' });
    await bot.wait(400);
    await clampQtyInputs(bot);
    await clickFirst(bot, 'market-buy', { sid: 'C3' });
    await clampQtyInputs(bot);
    await clickFirst(bot, 'market-sell', { sid: 'C3' });
    await bot.closeModals();
    await bot.nav('bag'); await bot.wait(250);
    await clickFirst(bot, 'bag-tab', { sid: 'C3' });
    await clickFirst(bot, 'bag-sort', { sid: 'C3' });
    await clickFirst(bot, 'bag-detail', { sid: 'C3' });
    await bot.wait(250);
    await clickFirst(bot, 'use-item', { sid: 'C3' });
    await clickFirst(bot, 'equip-item', { sid: 'C3' });
    await clickFirst(bot, 'quick-item', { sid: 'C3' });
    await openAndConfirm(bot, 'open-enhance', /enhance-item|enh-pick/, 'C3');
    await bot.closeModals();
    await openAndConfirm(bot, 'open-forge', /forge-item|forge-pick/, 'C3');
    await bot.closeModals();
    await openAndConfirm(bot, 'open-store', /qb-buy|shop-buy/, 'C3');
    await bot.closeModals();
    await clampQtyInputs(bot);
    await clickFirst(bot, 'consign-sell', { sid: 'C3' });
    await bot.closeModals();
  },

  async C4(bot) {
    await bot.nav('map'); await bot.wait(600);
    await clickFirst(bot, 'map-center', { sid: 'C4' });
    await clickFirst(bot, 'map-mycity', { sid: 'C4' });
    await clickFirst(bot, 'map-capital', { sid: 'C4' });
    await clickFirst(bot, 'map-toggle-labels', { sid: 'C4' });
    await clickFirst(bot, 'galaxy-open', { sid: 'C4' });
    await bot.wait(400);
    await clickFirst(bot, 'planet-tab', { sid: 'C4' });
    await bot.closeModals();
    // 画布点击：扫几个偏移点（野地/NPC/据点）
    const vp = bot.page.viewportSize();
    for (const [dx, dy] of [[0.5, 0.4], [0.42, 0.55], [0.6, 0.5], [0.35, 0.45], [0.65, 0.6]]) {
      try {
        await bot.page.mouse.click(Math.round(vp.width * dx), Math.round(vp.height * dy));
        await bot.wait(450);
        const modal = await bot.lite();
        core.recBehavior.write({ sid: 'C4', type: 'canvas-click', label: dx + ',' + dy,
          result: { modalOpen: modal ? modal.modal : null, modalTitle: modal ? modal.modalTitle : null } });
        await bot.closeModals();
      } catch (e) {}
    }
    await bot.nav('ext'); await bot.wait(250);
    await clickFirst(bot, 'toggle-auto-gather', { sid: 'C4' });
    await clickFirst(bot, 'wild-fortintel', { sid: 'C4' });
    await clickFirst(bot, 'scout-open', { sid: 'C4' });
    await bot.closeModals();
  },

  async C5(bot) {
    await bot.nav('collection'); await bot.wait(250);
    await clickFirst(bot, 'collect-cat', { sid: 'C5' });
    await bot.wait(150);
    await clickFirst(bot, 'collect-cat', { sid: 'C5' });
    await clickFirst(bot, 'collect-series', { sid: 'C5' });
    await bot.nav('reports'); await bot.wait(250);
    await clickFirst(bot, 'rep-filter', { sid: 'C5' });
    await clickFirst(bot, 'doc-tab', { sid: 'C5' });
    await clickFirst(bot, 'view-report', { sid: 'C5' });
    await bot.closeModals();
    await bot.nav('admin'); await bot.wait(250);
    await clickFirst(bot, 'planet-tab', { sid: 'C5' });
    await clickFirst(bot, 'adm-cat-pick', { sid: 'C5' });
    await clickFirst(bot, 'open-guanfu', { sid: 'C5' });
    await bot.closeModals();
    await openAndConfirm(bot, 'open-jieyue', /jieyue-gen|jieyue-expand/, 'C5');
    await bot.closeModals();
    await openAndConfirm(bot, 'open-tactic', /tac-apply|tactic-set/, 'C5');
    await bot.closeModals();
    await openAndConfirm(bot, 'open-artifacts', /hearts-boost/, 'C5');
    await bot.closeModals();
    await openAndConfirm(bot, 'open-lab', /farm-projects|farm-start/, 'C5');
    await bot.closeModals();
    await bot.nav('settings'); await bot.wait(250);
    await clickFirst(bot, 'save', { sid: 'C5' });
    await openAndConfirm(bot, 'open-saves', /save-slot-write/, 'C5');
    await bot.closeModals();
    await clickFirst(bot, 'save-slot-export', { sid: 'C5' });
    await bot.wait(600);
    await bot.closeModals();
    // 主题与比例
    await clickFirst(bot, 'chip-set', { sid: 'C5' });
  }
};

/* ---------- 混沌猴子 ---------- */
async function monkey(bot, durMs, sid) {
  const t0 = Date.now();
  let n = 0;
  core.logEvent('monkey-start', { sid, durMs });
  while (Date.now() - t0 < durMs) {
    const roll = Math.random();
    try {
      if (roll < 0.3) {
        const v = core.VIEWS[Math.floor(Math.random() * core.VIEWS.length)];
        await bot.nav(v);
      } else if (roll < 0.45) {
        await bot.key(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Escape', 'Tab', 'Shift+1', 'Shift+2', 'Shift+3'][Math.floor(Math.random() * 14)], { sid: 'M' });
      } else {
        const els = await bot.enumInteractive();
        const list = (els || []).filter(d => !d.disabled && !core.DANGER_BLOCK.has(d.action));
        if (list.length) {
          const d = list[Math.floor(Math.random() * list.length)];
          await bot.clickDesc(d, { sid: 'M' });
        }
      }
      n++;
    } catch (e) { /* 猴子不许停 */ }
    await bot.wait(300 + Math.random() * 900);
  }
  core.logEvent('monkey-end', { sid, actions: n });
  return n;
}

/* ---------- 边界用例 ---------- */
async function edgeCases(bot) {
  const sid = 'E';
  core.logEvent('edge-start', {});
  // 整个边界阶段（含刷新/导入往返）标记为边界窗口：速率/回退类不变量在窗口内不检查
  bot.markEdge(180000);
  // 1) 键盘全覆盖
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Shift+1', 'Shift+2', 'Shift+3', 'Escape']) {
    await bot.key(k, { sid }); await bot.wait(120);
  }
  // 2) 连点（竞态）：同一按钮 200ms 内双击 ×3 组
  await bot.nav('city'); await bot.wait(300);
  const els = await bot.enumInteractive();
  const cells = (els || []).filter(d => d.action === 'build-cell' && !d.disabled).slice(0, 3);
  for (const d of cells) {
    try {
      await bot.page.evaluate(`(function(){ var el=document.querySelector('[data-ev-idx="${d.idx}"]'); if(el){el.click();el.click();} })()`);
      core.recBehavior.write({ sid, type: 'double-click', action: d.action, label: d.label });
      await bot.wait(350);
      await bot.closeModals();
    } catch (e) {}
  }
  // 3) 模态堆叠：连开两个模态
  await clickFirst(bot, 'open-saves', { sid });
  await bot.wait(300);
  await bot.page.evaluate(`(function(){ var b=document.querySelector('#view-container [data-action="open-market"], #view-container [data-action="open-forge"]'); if(b) b.click(); })()`).catch(() => {});
  await bot.wait(400);
  await bot.key('Escape', { sid }); await bot.wait(200);
  await bot.key('Escape', { sid }); await bot.wait(200);
  // 4) 刷新 → 离线补算/归来报告
  const before = await bot.lite();
  await bot.page.reload({ waitUntil: 'domcontentloaded' });
  await bot.wait(2500);
  const after = await bot.lite();
  core.recBehavior.write({ sid, type: 'reload', result: {
    gtBefore: before ? before.gt : null, gtAfter: after ? after.gt : null,
    modalAfter: after ? after.modal : null, modalTitle: after ? after.modalTitle : null } });
  await bot.closeModals();
  // 5) 视口变化（ responsiveness ）
  await bot.page.setViewportSize({ width: 420, height: 900 });
  await bot.wait(900);
  const overflow = await bot.page.evaluate(`(function(){
    return { sw: document.documentElement.scrollWidth, iw: window.innerWidth,
      sh: document.documentElement.scrollHeight, ih: window.innerHeight };
  })()`).catch(() => null);
  core.recBehavior.write({ sid, type: 'viewport', result: overflow });
  await bot.shot('edge_viewport_420');
  await bot.page.setViewportSize({ width: 1600, height: 900 });
  await bot.wait(600);
  // 6) 导入往返（先导出本轮新档，再写回第一个空手动槽 —— 不用历史遗留导出）
  const fs = require('fs');
  const path = require('path');
  const expDir = core.LOGS;
  let expFile = null;
  try {
    await bot.nav('settings'); await bot.wait(300);
    await clickFirst(bot, 'open-saves', { sid });
    await bot.wait(400);
    await clickFirst(bot, 'save-slot-export', { sid });
    await bot.wait(1200);
    await bot.closeModals();
    expFile = fs.readdirSync(expDir).filter(f => f.startsWith('export_')).sort().pop();
  } catch (e) { core.logEvent('edge-export-fail', { msg: String(e.message).slice(0, 120) }); }
  if (expFile) {
    try {
      const txt = fs.readFileSync(path.join(expDir, expFile), 'utf8');
      await bot.nav('settings'); await bot.wait(250);
      await clickFirst(bot, 'open-saves', { sid });
      await bot.wait(300);
      await clickFirst(bot, 'save-import-toggle', { sid });
      await bot.wait(250);
      await bot.page.evaluate(`(function(){
        var ta = document.getElementById('sv-paste');
        if (ta) { ta.value = ${JSON.stringify(txt.slice(0, 4000000))}; ta.dispatchEvent(new Event('input',{bubbles:true})); }
      })()`).catch(() => {});
      await clickFirst(bot, 'save-import-text', { sid });
      await bot.wait(500);
      await bot.closeModals();
    } catch (e) { core.logEvent('edge-import-fail', { msg: String(e.message).slice(0, 120) }); }
  } else {
    core.logEvent('edge-import-skip', { msg: '无导出存档文件' });
  }
  core.logEvent('edge-end', {});
}

/* ---------- 会话执行器 ---------- */
async function runCharter(bot, charter, budgetMs) {
  const t0 = Date.now();
  core.logEvent('charter-start', { id: charter.id, name: charter.name, budgetMs });
  let rounds = 0;
  while (Date.now() - t0 < budgetMs) {
    rounds++;
    const remain = budgetMs - (Date.now() - t0);
    const sweepBudget = Math.min(remain, 150000);
    const r = await sweep(bot, {
      sid: charter.id, views: charter.views, profile: charter.profile,
      maxClicks: 26, perViewMax: 14, gap: 80
    });
    if (routines[charter.id]) {
      try { await routines[charter.id](bot); } catch (e) {
        core.logEvent('routine-fail', { id: charter.id, msg: String(e.message || e).slice(0, 140) });
      }
    }
    await bot.closeModals();
    if (remain - sweepBudget <= 0) break;
  }
  core.logEvent('charter-end', { id: charter.id, rounds });
}

module.exports = { CHARTERS, routines, monkey, edgeCases, runCharter, clampQtyInputs, clickFirst, openAndConfirm };
