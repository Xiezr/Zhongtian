/* ============================================================
 * bot.js —— 浏览器引擎：生命周期 / 安全点击 / 枚举 / 采样 / 不变量
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const core = require('./core');

const EV = '__ev';   // 页面注入的全局记录器

/* ---------- 页面内：枚举可见交互元素 ---------- */
const ENUM_FN = `function(){
  var out = [];
  var game = document.querySelector('#screen-game');
  var modalRoot = document.querySelector('#modal-root');
  var create = document.querySelector('#screen-create');
  var scopeSel = 'button, [data-action], .tab[data-view], .chip, select, input[type=range], input[type=checkbox], input[type=text]';
  function visible(el){
    var r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    var st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return false;
    if (parseFloat(st.opacity) === 0) return false;
    if (!el.offsetParent && st.position !== 'fixed') return false;
    return true;
  }
  function desc(el, i){
    var act = el.getAttribute('data-action') || null;
    var view = el.getAttribute('data-view') || null;
    var label = (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 24);
    if (!label && el.getAttribute('title')) label = el.getAttribute('title').slice(0,24);
    if (!label && el.getAttribute('aria-label')) label = el.getAttribute('aria-label').slice(0,24);
    if (!label) label = el.tagName.toLowerCase();
    var inModal = !!(el.closest('#modal-root'));
    var disabled = !!(el.disabled || el.closest('[disabled]'));
    var why = el.getAttribute('data-why') || (el.closest('[data-why]') ? el.closest('[data-why]').getAttribute('data-why') : '');
    el.setAttribute('data-ev-idx', String(i));
    return { idx: i, action: act, view: view, label: label, tag: el.tagName,
      inModal: inModal, disabled: disabled, why: (why||'').slice(0,120),
      type: el.type || null, value: (el.value != null ? String(el.value).slice(0,30) : null) };
  }
  if (game && !game.classList.contains('hidden')) {
    var els = game.querySelectorAll(scopeSel);
    var i = 0;
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      if (!visible(el)) continue;
      if (el.closest('#modal-root')) continue;   // 模态内统一在下面扫
      out.push(desc(el, i++));
    }
  }
  if (modalRoot) {
    var mels = modalRoot.querySelectorAll(scopeSel);
    var k = 1000;
    for (var m = 0; m < mels.length; m++) {
      var mel = mels[m];
      if (!visible(mel)) continue;
      out.push(desc(mel, k++));
    }
  }
  if (create && !create.classList.contains('hidden')) {
    var cels = create.querySelectorAll(scopeSel);
    var c = 2000;
    for (var q = 0; q < cels.length; q++) {
      var cel = cels[q];
      if (!visible(cel)) continue;
      out.push(desc(cel, c++));
    }
  }
  return out;
}`;

/* ---------- 页面内：轻量前后状态 ---------- */
const LITE_FN = `function(){
  var s = GAME.state; if (!s) return null;
  var res = {grain:0,wood:0,stone:0,iron:0}, army=0, pop=0;
  (s.cities||[]).forEach(function(c){
    var R = GAME.res(c)||{};
    for (var k in res) res[k] += (Number(R[k])||0);
    army += (GAME.armyTotal?GAME.armyTotal(c):0);
    pop += (Number(R.pop)||0);
  });
  var q = s.queues||{};
  return {
    gt: (s.world&&s.world.elapsed)||0,
    grain: Math.round(res.grain), wood: Math.round(res.wood), stone: Math.round(res.stone),
    iron: Math.round(res.iron), gold: s.gold||0, army: army, pop: pop,
    gens: (s.generals||[]).length,
    qB: (q.build||[]).length, qT: (q.train||[]).length, qX: (q.tech||[]).length,
    marches: (s.marches||[]).length, items: (s.items?Object.keys(s.items).length:0),
    view: (GAME.ui&&GAME.ui.view)||null,
    modal: !!document.querySelector('#modal-root .modal'),
    toast: (GAME.ui&&GAME.ui._notes||[]).map(function(n){return n.type+':'+n.msg;}).join(' | ').slice(0,160),
    errN: (window.__ev?window.__ev.errors.length:0),
    actN: (window.__ev?window.__ev.actions.length:0),
    modalTitle: (function(){ var t=document.querySelector('#modal-root .modal .m-title, #modal-root .modal .gold-heading'); return t?t.textContent.trim().slice(0,40):null; })()
  };
}`;

/* ---------- 不变量 ---------- */
function checkInvariants(cur, prev, meta) {
  const v = [];
  // 边界用例/刷新窗口内：时钟速率与回退检查没有意义（刷新会重置倍率、补算会跳变），只查硬性数值
  const edgeWindow = !!(meta && meta.edgeWindow);
  if (!cur) {
    // 从未拿到过有效样本 → 只是启动噪声（监控早于游戏就绪），不计违例
    if (prev) v.push({ id: 'I0', msg: 'state 为 null（游戏未就绪/已退出）' });
    return v;
  }
  const fin = x => typeof x === 'number' && isFinite(x);
  if (!fin(cur.gt) || cur.gt < 0) v.push({ id: 'I3', msg: '游戏时钟异常: ' + cur.gt });
  // 倍率在区间内变化（如刷新后重置）→ 期望速率不可计算，跳过速率/回退检查
  const scaleChanged = prev && prev.ts !== cur.ts;
  if (prev && fin(prev.gt) && cur.gt < prev.gt && !edgeWindow && !scaleChanged) v.push({ id: 'I1', msg: `时钟回退: ${prev.gt} → ${cur.gt}` });
  if (prev && fin(prev.gt) && meta && meta.realDt > 3 && !edgeWindow && !scaleChanged) {
    const expect = meta.realDt * (cur.ts || 1);
    const actual = cur.gt - prev.gt;
    if (actual < expect * 0.5) v.push({ id: 'I2', msg: `时钟速率过低: ${meta.realDt}s 现实仅推进 ${actual} 游戏秒（期望≈${Math.round(expect)}，倍率 ${cur.ts}）` });
    if (actual > expect * 2.2) v.push({ id: 'I2', msg: `时钟速率过高: ${meta.realDt}s 现实推进 ${actual} 游戏秒（期望≈${Math.round(expect)}）` });
  }
  for (const k of ['grain', 'wood', 'stone', 'iron', 'gold', 'pop', 'army']) {
    if (!fin(cur[k]) || cur[k] < 0) v.push({ id: 'I3', msg: `资源/兵力异常 ${k}=${cur[k]}` });
  }
  if (cur.hearts != null && (cur.hearts < 0 || cur.hearts > 100)) v.push({ id: 'I6', msg: `民心越界 ${cur.hearts}` });
  if (cur.tax != null && (cur.tax < 0 || cur.tax > 1)) v.push({ id: 'I6', msg: `税率越界 ${cur.tax}` });
  if (cur.deepBad && cur.deepBad.length) v.push({ id: 'I3', msg: '深层 NaN/Infinity: ' + cur.deepBad.slice(0, 5).join(',') });
  if (cur.heap > 1.2e9) v.push({ id: 'I9', msg: `堆内存超限 ${(cur.heap / 1e6).toFixed(0)}MB` });
  if (cur.msgLog > 1000) v.push({ id: 'I10', msg: `msgLog 膨胀 ${cur.msgLog} 条` });
  if (cur.qB < 0 || cur.qT < 0 || cur.qX < 0) v.push({ id: 'I4', msg: '队列长度为负' });
  if (meta && meta.saveSize && meta.saveSize > 4.5e6) v.push({ id: 'I8', msg: `存档体积 ${(meta.saveSize / 1e6).toFixed(2)}MB 逼近 5MB 配额` });
  return v;
}

/* ---------- Bot ---------- */
class Bot {
  constructor() {
    this.browser = null;
    this.ctx = null;
    this.page = null;
    this.lastSample = null;
    this.lastSampleAt = Date.now();
    this.edgeUntil = 0;          // 边界用例窗口截止（窗口内不查速率/回退类不变量）
    this.downloads = [];
    this.stats = { clicks: 0, jsClicks: 0, realClicks: 0, recovers: 0, errors: 0 };
  }

  /* 标记一段"边界窗口"：期间的不变量检查只保留硬性数值项 */
  markEdge(ms) { this.edgeUntil = Date.now() + (ms || 60000); }

  async launch() {
    this.browser = await chromium.launchPersistentContext(core.USER_DATA, {
      executablePath: core.CHROME, headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader', '--disable-gpu-sync', '--memory-pressure-off'],
      viewport: { width: 1600, height: 900 },
      acceptDownloads: true
    });
    this.ctx = this.browser;
    this.page = this.ctx.pages()[0] || await this.ctx.newPage();
    await this.page.addInitScript(core.INIT_SCRIPT);
    this.page.on('dialog', async d => {
      core.logEvent('dialog', { type: d.type(), msg: (d.message() || '').slice(0, 160) });
      await d.dismiss().catch(() => {});
    });
    this.page.on('download', async dl => {
      const name = 'export_' + Date.now() + '.json';
      try { await dl.saveAs(path.join(core.LOGS, name)); this.downloads.push(name); }
      catch (e) { core.logEvent('download-fail', { msg: String(e.message).slice(0, 120) }); }
    });
    this.page.on('filechooser', async fc => {
      core.logEvent('filechooser', { });
    });
    core.heartbeat('浏览器已启动（持久化上下文）');
  }

  async gotoGame() {
    const p = this.page;
    await p.goto(core.BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForFunction(() => window.GAME && window.GAME.state !== undefined, null, { timeout: 20000 })
      .catch(() => {});
    // 安装 action 包裹（页面加载后 GAME 才存在）
    await p.evaluate(`(function(){
      if (window.GAME && GAME.action && !GAME.__evWrapped) {
        GAME.__evWrapped = true;
        var _act = GAME.action;
        GAME.action = function(name, el){
          var r;
          try { r = _act.call(GAME, name, el); }
          catch(e){ (window.__ev||(window.__ev={errors:[],actions:[]})).errors.push({t:Date.now(),k:'action-throw',m:String(name)+': '+String(e&&e.message||e).slice(0,200)}); throw e; }
          (window.__ev||(window.__ev={errors:[],actions:[]})).actions.push({t:Date.now(), name:String(name)});
          return r;
        };
      }
    })()`).catch(() => {});
  }

  /* 页面崩溃/断开 → 同上下文新页（localStorage 存档保留） */
  async recover(reason) {
    core.logEvent('recover', { reason: String(reason).slice(0, 160) });
    this.stats.recovers++;
    try { if (this.page && !this.page.isClosed()) await this.page.close().catch(() => {}); } catch (e) {}
    try {
      this.page = await this.ctx.newPage();
      await this.page.addInitScript(core.INIT_SCRIPT);
      this.page.on('dialog', async d => { core.logEvent('dialog', { msg: (d.message() || '').slice(0, 120) }); await d.dismiss().catch(() => {}); });
      this.page.on('download', async dl => {
        const name = 'export_' + Date.now() + '.json';
        try { await dl.saveAs(path.join(core.LOGS, name)); this.downloads.push(name); } catch (e) {}
      });
      await this.gotoGame();
      // 等自动读档
      await this.page.waitForFunction(
        () => window.GAME && GAME.state && !document.getElementById('screen-game').classList.contains('hidden'),
        null, { timeout: 15000 }).catch(() => {});
      core.heartbeat('已恢复：新页面 + 自动读档');
      return true;
    } catch (e) {
      core.heartbeat('恢复失败: ' + e.message);
      return false;
    }
  }

  async safeEval(fnStr, arg) {
    const expr = '(' + fnStr + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')';
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await this.page.evaluate(expr); }
      catch (e) {
        const msg = String(e.message || e);
        if (/crash|closed|Target|Session|Connection|Execution context/i.test(msg) && attempt === 0) {
          const ok = await this.recover(msg);
          if (ok) continue;
        }
        throw e;
      }
    }
  }

  async enumInteractive() {
    return await this.safeEval(ENUM_FN);
  }

  async lite() {
    try { return await this.safeEval(LITE_FN); } catch (e) { return null; }
  }

  async sample() {
    let saveSize = 0;
    try {
      saveSize = await this.page.evaluate(`(function(){
        var raw = null; try { raw = localStorage.getItem('sanguo_save_v3'); } catch(e){}
        return raw ? raw.length : 0;
      })()`);
    } catch (e) {}
    const cur = await this.safeEval(core.SAMPLE_FN);
    const now = Date.now();
    const meta = { realDt: (now - this.lastSampleAt) / 1000, saveSize, edgeWindow: this.edgeUntil > Date.now() };
    const viol = checkInvariants(cur, this.lastSample, meta);
    const fps = await this.page.evaluate(`(function(){ var n = window.__fps?window.__fps.n:0; window.__fps.n = 0; return n; })()`).catch(() => 0);
    const errs = await this.page.evaluate(`(function(){ var e = window.__ev?window.__ev.errors:[]; var c = e.length; window.__ev.errors = []; return c; })()`).catch(() => 0);
    const rec = Object.assign({}, cur, { realDt: meta.realDt, fps, errN: errs, saveSize });
    core.recSample.write(rec);
    for (const v of viol) {
      core.logEvent('invariant', v);
      await this.shot('viol_' + v.id + '_' + Date.now());
      // 抓违例前后各 5 条行为链由 recorder 保证（behavior.jsonl 天然有序）
    }
    this.lastSample = cur; this.lastSampleAt = now;
    return { cur, viol, fps, errs };
  }

  /* 单击一次（不含重试） */
  async _clickOnce(d, opts, before) {
    opts = opts || {};
    const sid = opts.sid || 'X';
    let path = 'js';
    // SELECT / number / range：游戏走委托 change 事件分发，真实 click 不产生 change
    // （Playwright 点 SELECT 只是开下拉，actN 不涨 → 误报"无效果"）。这些类型直接走 change 派发。
    const changeLike = d.tag === 'SELECT' ||
      (d.tag === 'INPUT' && ['number', 'range'].includes(d.type || ''));
    if (changeLike) {
      try {
        await this.page.evaluate(`(function(){
          var el = document.querySelector('[data-ev-idx="${d.idx}"]');
          if (!el && ${JSON.stringify(d.action || '')}) {
            var all = document.querySelectorAll('[data-action="${d.action}"]');
            for (var i = 0; i < all.length; i++) {
              var t = (all[i].textContent||'').trim().replace(/\\s+/g,' ').slice(0,24);
              if (t === ${JSON.stringify(d.label || '')}) { el = all[i]; break; }
            }
          }
          if (el) {
            if (el.tagName === 'SELECT') { el.selectedIndex = Math.min(el.selectedIndex+1, el.options.length-1); }
            else if (el.type === 'number') { el.value = '2'; el.dispatchEvent(new Event('input',{bubbles:true})); }
            else if (el.type === 'range') { el.value = String(Math.min(Number(el.max||100), Number(el.value||0)+20)); }
            el.dispatchEvent(new Event('change',{bubbles:true}));
          }
        })()`);
        path = 'js-change';
        this.stats.jsClicks++;
      } catch (e2) {
        core.logEvent('click-fail', { sid, action: d.action, label: d.label, msg: String(e2.message || e2).slice(0, 120) });
        return null;
      }
    } else {
      try {
        const loc = this.page.locator('[data-ev-idx="' + d.idx + '"]').first();
        await loc.click({ timeout: 1600 });
        path = 'real';
        this.stats.realClicks++;
      } catch (e) {
        // 回退：JS click（同一事件委托路径）；先按 idx 找，再按 action+label 找新鲜节点
        try {
          await this.page.evaluate(`(function(){
            var el = document.querySelector('[data-ev-idx="${d.idx}"]');
            if (!el && ${JSON.stringify(d.action || '')}) {
              var all = document.querySelectorAll('[data-action="${d.action}"]');
              for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent||'').trim().replace(/\\s+/g,' ').slice(0,24);
                if (t === ${JSON.stringify(d.label || '')}) { el = all[i]; break; }
              }
            }
            if (el) {
              if (el.tagName === 'SELECT') { el.selectedIndex = Math.min(el.selectedIndex+1, el.options.length-1); el.dispatchEvent(new Event('change',{bubbles:true})); }
              else el.click();
            }
          })()`);
          path = 'js';
          this.stats.jsClicks++;
        } catch (e2) {
          core.logEvent('click-fail', { sid, action: d.action, label: d.label, msg: String(e2.message || e2).slice(0, 120) });
          return null;
        }
      }
    }
    this.stats.clicks++;
    await this.page.waitForTimeout(opts.wait == null ? 320 : opts.wait);
    const after = await this.lite();
    const rec = {
      t: new Date().toISOString(), gt: before ? before.gt : null, sid, type: 'click',
      sel: 'data-ev-idx=' + d.idx, action: d.action, label: d.label, tag: d.tag,
      view: before ? before.view : null, inModal: d.inModal,
      result: {
        fired: after && before ? (after.actN > before.actN) : null,
        modalOpen: after ? after.modal : null,
        modalTitle: after ? after.modalTitle : null,
        toast: after ? after.toast : null,
        errDelta: after && before ? (after.errN - before.errN) : null,
        path
      },
      delta: before && after ? {
        grain: after.grain - before.grain, wood: after.wood - before.wood,
        stone: after.stone - before.stone, iron: after.iron - before.iron,
        gold: after.gold - before.gold, army: after.army - before.army,
        qB: after.qB - before.qB, qT: after.qT - before.qT, qX: after.qX - before.qX,
        marches: after.marches - before.marches
      } : null
    };
    core.recBehavior.write(rec);
    if (d.action) {
      if (d.disabled) core.covState(d.action, 'blocked', d.why || 'disabled');
      else core.covTouch(d.action, { view: rec.view, note: d.why });
    }
    if (d.view) core.covTouch('view:' + d.view, { view: d.view });
    if (rec.result.errDelta > 0) {
      core.logEvent('click-error', { sid, action: d.action, label: d.label, view: rec.view });
      await this.shot('err_' + (d.action || 'x') + '_' + Date.now());
    }
    return rec;
  }

  /* 点击一个枚举描述符；无效果时按 action+label 找新鲜节点重试一次 */
  async clickDesc(d, opts) {
    opts = opts || {};
    const before = await this.lite();
    const rec = await this._clickOnce(d, opts, before);
    if (rec && rec.result.fired === false && !rec.result.modalOpen && !opts.retry && d.action) {
      let fresh = null;
      try {
        const els = await this.enumInteractive();
        fresh = (els || []).find(x => x.action === d.action && x.label === d.label && !x.disabled && x.idx !== d.idx)
             || (els || []).find(x => x.action === d.action && !x.disabled);
      } catch (e) {}
      if (fresh) {
        const rec2 = await this._clickOnce(fresh, Object.assign({}, opts, { retry: true }), before);
        if (rec2 && rec2.result.fired) return rec2;
        if (rec2) rec2.retried = true;
        if (rec2) core.recBehavior.write({ t: new Date().toISOString(), sid: opts.sid, type: 'retry-note',
          action: d.action, label: d.label, result: { fired: rec2.result.fired, modalOpen: rec2.result.modalOpen } });
        return rec2 || rec;
      }
      // 重试后仍无效果 → 记入事件（候选死按钮/需前置条件）
      core.logEvent('no-effect', { sid: opts.sid, action: d.action, label: d.label,
        view: rec.view, inModal: d.inModal, retried: !!fresh });
    }
    return rec;
  }

  async nav(view) {
    const before = await this.lite();
    try {
      await this.page.click('#topnav .tab[data-view="' + view + '"]', { timeout: 2000 });
    } catch (e) {
      await this.page.evaluate(`(function(){
        var t = document.querySelector('#topnav .tab[data-view="${view}"]'); if (t) t.click();
      })()`).catch(() => {});
    }
    await this.page.waitForTimeout(420);
    const after = await this.lite();
    core.covTouch('view:' + view, { view });
    core.recBehavior.write({
      sid: 'nav', type: 'nav', view, label: 'tab:' + view,
      result: { from: before ? before.view : null, to: after ? after.view : null, ok: after && after.view === view }
    });
    return after && after.view === view;
  }

  async key(k, opts) {
    opts = opts || {};
    const before = await this.lite();
    try {
      await this.page.keyboard.press(k);
    } catch (e) { return null; }
    await this.page.waitForTimeout(opts.wait == null ? 380 : opts.wait);
    const after = await this.lite();
    const map = { '1': 'key:1-9', '2': 'key:1-9', '3': 'key:1-9', '4': 'key:1-9', '5': 'key:1-9',
      '6': 'key:1-9', '7': 'key:1-9', '8': 'key:1-9', '9': 'key:1-9',
      'Shift+1': 'key:shift1-3', 'Shift+2': 'key:shift1-3', 'Shift+3': 'key:shift1-3',
      'Escape': 'key:esc', 'Tab': 'key:tab-enter', 'Enter': 'key:tab-enter' };
    if (map[k]) core.covTouch(map[k]);
    core.recBehavior.write({
      sid: opts.sid || 'key', type: 'key', label: k,
      result: { from: before ? before.view : null, to: after ? after.view : null,
        modalBefore: before ? before.modal : null, modalAfter: after ? after.modal : null }
    });
    return after;
  }

  async closeModals() {
    for (let i = 0; i < 6; i++) {
      const open = await this.page.evaluate(`(function(){ return !!document.querySelector('#modal-root .modal'); })()`).catch(() => false);
      if (!open) return;
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(220);
    }
    // 兜底：点关闭钮
    await this.page.evaluate(`(function(){
      var x = document.querySelector('#modal-root .modal-x'); if (x) x.click();
    })()`).catch(() => {});
    await this.page.waitForTimeout(200);
  }

  async shot(name) {
    try {
      const p = path.join(core.SHOTS, name + '.png');
      await this.page.screenshot({ path: p, fullPage: false });
      core.logEvent('shot', { file: name + '.png' });
      return p;
    } catch (e) { return null; }
  }

  async wait(ms) { await this.page.waitForTimeout(ms); }
}

module.exports = { Bot, ENUM_FN, LITE_FN, checkInvariants };
