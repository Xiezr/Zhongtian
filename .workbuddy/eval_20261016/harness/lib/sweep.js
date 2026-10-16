/* ============================================================
 * sweep.js —— 系统化按钮覆盖引擎
 * 动态枚举 → 过滤 → 真实点击 → 记录行为链 → 模态递归 → 安全取消
 * ============================================================ */
'use strict';
const core = require('./core');

/* 输入类元素特殊处理 */
async function interactSpecial(bot, d, sid) {
  const before = await bot.lite();
  let ok = false;
  try {
    if (d.tag === 'SELECT') {
      await bot.page.evaluate(`(function(){
        var el = document.querySelector('[data-ev-idx="${d.idx}"]');
        if (el && el.options) { el.selectedIndex = Math.min(el.selectedIndex + 1, el.options.length - 1);
          el.dispatchEvent(new Event('change', {bubbles:true})); }
      })()`);
      ok = true;
    } else if (d.type === 'range') {
      await bot.page.evaluate(`(function(){
        var el = document.querySelector('[data-ev-idx="${d.idx}"]');
        if (el) { el.focus(); }
      })()`);
      await bot.page.keyboard.press('ArrowRight');
      ok = true;
    } else if (d.type === 'text') {
      await bot.page.evaluate(`(function(){
        var el = document.querySelector('[data-ev-idx="${d.idx}"]');
        if (el) { el.value = '评测' + Math.floor(Math.random()*90+10); el.dispatchEvent(new Event('input',{bubbles:true})); }
      })()`);
      ok = true;
    }
  } catch (e) { ok = false; }
  await bot.wait(280);
  const after = await bot.lite();
  core.recBehavior.write({
    sid, type: 'input', action: d.action, label: d.label, tag: d.tag,
    view: before ? before.view : null, inModal: d.inModal,
    result: { fired: after && before ? after.actN > before.actN : null, toast: after ? after.toast : null }
  });
  if (d.action && !d.disabled) core.covTouch(d.action, { view: before ? before.view : null });
  return ok;
}

/* ---------- 主扫描 ---------- */
async function sweep(bot, opts) {
  opts = opts || {};
  const sid = opts.sid || 'S';
  const profile = opts.profile || null;             // RegExp：优先点匹配的动作
  const maxClicks = opts.maxClicks || 40;
  const perActionMax = opts.perActionMax || 3;
  const allowDanger = !!opts.allowDanger;           // 人格受控执行用
  const views = opts.views || null;
  const perViewMax = opts.perViewMax || Math.ceil(maxClicks / (views ? views.length : 1));

  let clicked = 0;
  const sessionActs = {};
  const targetViews = views || [await bot.page.evaluate(`(function(){ return (GAME.ui&&GAME.ui.view)||'city'; })()`).catch(() => 'city')];

  for (const v of targetViews) {
    if (clicked >= maxClicks) break;
    if (v) { await bot.nav(v); await bot.wait(250); }
    let viewClicks = 0;
    // 一轮：表层按钮；二轮：若有点击开出模态，模态内按钮已由枚举覆盖（idx>=1000）
    for (let round = 0; round < 2; round++) {
      const els = await bot.enumInteractive();
      if (!els || !els.length) break;
      // 过滤 + 排序
      let list = els.filter(d => {
        if (d.disabled) return false;                       // disabled 不点（记 blocked 由枚举侧完成）
        if (!allowDanger && core.DANGER_BLOCK.has(d.action)) return false;
        return true;
      });
      // disabled 记账
      els.filter(d => d.disabled && d.action).forEach(d => core.covState(d.action, 'blocked', d.why || 'disabled'));
      if (profile) {
        list.sort((a, b) => {
          const pa = profile.test(a.action || '') ? 0 : 1;
          const pb = profile.test(b.action || '') ? 0 : 1;
          return pa - pb;
        });
      }
      for (const d of list) {
        if (clicked >= maxClicks || viewClicks >= perViewMax) break;
        const key = d.action || (d.tag + ':' + d.label);
        sessionActs[key] = (sessionActs[key] || 0) + 1;
        if (sessionActs[key] > perActionMax) continue;
        if (['SELECT'].includes(d.tag) || (d.type && ['range', 'text'].includes(d.type))) {
          await interactSpecial(bot, d, sid);
        } else {
          await bot.clickDesc(d, { sid });
        }
        clicked++; viewClicks++;
        await bot.wait(opts.gap == null ? 90 : opts.gap);
        // 点了 ask 类 → 期待确认模态 → 取消（绝不确认）
        if (d.action && core.ASK_ACTIONS.has(d.action)) {
          await bot.wait(250);
          await bot.closeModals();
        }
      }
      // 关掉本轮扫出的模态，回到表层
      await bot.closeModals();
    }
  }
  return { clicked, sessionActs };
}

/* ---------- 覆盖驱动补扫（C6）: 对未触及动作尝试抵达 ---------- */
const REACH_MAP = [
  [/^forge-/, ['city', 'open-forge']],
  [/^enh-/, ['bag', 'open-enhance']],
  [/^ling-/, ['bag', 'ling-temper-open']],
  [/^market-/, ['admin', 'open-market']],
  [/^shop-/, ['shop', null]],
  [/^bag-/, ['bag', null]],
  [/^collect-/, ['collection', null]],
  [/^gen-/, ['generals', null]],
  [/^exp-/, ['marches', 'exp-open']],
  [/^march-/, ['marches', null]],
  [/^save-/, ['settings', 'open-saves']],
  [/^planet-/, ['admin', 'planet-gen-open']],
  [/^adm-/, ['admin', null]],
  [/^tac-|^tactic-/, ['generals', 'open-tactic']],
  [/^jieyue-/, ['admin', 'open-jieyue']],
  [/^inn-/, ['admin', 'open-inn']],
  [/^farm-/, ['city', 'open-lab']],
  [/^wild-/, ['ext', 'open-wilds']],
  [/^fort-/, ['ext', 'open-outposts']],
  [/^tower-|^city-transport/, ['city', 'open-wall']],
  [/^wonder-/, ['map', 'wonder-open']],
  [/^bt-|^sd-/, ['marches', null]],
  [/^auto-|^am-/, ['auto', null]],
  [/^build-|^confirm-build|^confirm-upgrade|^rush-build|^cancel-build/, ['city', 'build-cell']],
  [/^ext-/, ['ext', 'ext-cell']],
  [/^qb-/, ['shop', null]],
  [/^mp-|^rep-/, ['reports', null]],
  [/^mat-|^quick-|^use-|^equip-|^unequip-|^bag-/, ['bag', null]],
  [/^switch-|^view/, [null, null]],
  [/^chip-|^set-/, ['settings', null]],
  [/^doc-|^msg-/, ['reports', null]],
  [/^train-|^select-train|^troop-|^conscript/, ['city', 'open-troops']],
  [/^heal-|^release-|^assign-|^promote|^dismiss/, ['generals', null]],
  [/^lord-/, ['admin', 'open-lord']],
  [/^sky-|^moment-/, ['city', null]],
  [/^galaxy-/, ['map', 'galaxy-open']],
  [/^open-/, ['city', null]]
];

async function reachSweep(bot, opts) {
  opts = opts || {};
  const sid = opts.sid || 'C6';
  const cov = core.covSnapshot().detail;
  const pending = Object.keys(cov).filter(k => !k.startsWith('view:') && !k.startsWith('key:') && cov[k].state === 'pending');
  core.heartbeat('补扫开始：待触及动作 ' + pending.length + ' 个');
  for (const act of pending) {
    let tried = false;
    for (const [re, [view, opener]] of REACH_MAP) {
      if (!re.test(act)) continue;
      tried = true;
      try {
        if (view) { await bot.nav(view); await bot.wait(200); }
        if (opener) {
          await bot.page.evaluate(`(function(){
            var b = document.querySelector('#view-container [data-action="${opener}"], #modal-root [data-action="${opener}"]');
            if (b) b.click();
          })()`).catch(() => {});
          await bot.wait(400);
        }
        const els = await bot.enumInteractive();
        const hit = (els || []).filter(d => d.action === act && !d.disabled);
        if (hit.length) {
          await bot.clickDesc(hit[0], { sid });
          await bot.wait(150);
        }
        await bot.closeModals();
      } catch (e) { /* 单条失败不影响全局 */ }
      break;
    }
    if (!tried) core.covState(act, 'unreachable', '无已知入口映射');
  }
  core.flushCoverage();
  core.heartbeat('补扫结束');
}

module.exports = { sweep, reachSweep, interactSpecial };
