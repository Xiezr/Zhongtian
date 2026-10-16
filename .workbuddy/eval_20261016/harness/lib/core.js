/* ============================================================
 * core.js —— 评测共享内核：配置 / 危险清单 / 覆盖账本 / 记录器 / 页面注入
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');                 // .workbuddy/eval_20261016
const GAME_DIR = path.resolve(ROOT, '../../..');             // E:/Deepseekdb
const LOGS = path.join(ROOT, 'logs');
const SHOTS = path.join(ROOT, 'shots');
const REPORTS = path.join(ROOT, 'reports');
for (const d of [LOGS, SHOTS, REPORTS]) { try { fs.mkdirSync(d, { recursive: true }); } catch (e) {} }

const PORT = 8901;
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const USER_DATA = path.join(ROOT, 'browser-profile');

const VIEWS = ['city', 'ext', 'map', 'generals', 'marches', 'admin', 'shop', 'bag',
  'collection', 'reports', 'auto', 'settings', 'galaxy'];

/* 326 个静态动作注册表（js/main.js GAME.action 分发器全集） */
let ACTIONS = [];
try { ACTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'actions.json'), 'utf8')); } catch (e) {}
if (!ACTIONS.length) { console.error('FATAL: actions.json 缺失'); process.exit(1); }

/* ---------- 危险动作策略 ---------- */
/* 黑名单：点击仅用于验证"有确认/有反馈"，绝不确认执行。
 * 白名单例外见 PERSONA_OK（人格在受控条件下可执行，如 market-sell 限 1 单位）。 */
const DANGER_BLOCK = new Set([
  'new-game', 'demolish-do', 'demolish-whole-do', 'save-slot-drop-do', 'save-slot-load-do',
  'wild-abandon-do', 'troop-disband-do', 'city-abandon-arm', 'fort-abandon-arm',
  'salvage-equip-do', 'sell-equip-do', 'release-captives', 'tactic-del', 'tac-del', 'plan-del',
  'planet-create', 'planet-create-stay', 'do-jianghu', 'cg-clear', 'consign-all', 'jieyue-xc',
  'gather-finish', 'wild-withdraw', 'march-rush', 'train-rush', 'rush-build', 'rush-ext',
  'rush-tech', 'do-train-boost', 'lord-break', 'city-move-do', 'move-do', 'hearts-soothe',
  'delete'
]);
/* ask 类：点击后期望弹出确认模态，随后取消 —— 记录"防错设计是否到位" */
const ASK_ACTIONS = new Set([
  'demolish-ask', 'wild-abandon-ask', 'troop-disband-ask', 'city-abandon-arm', 'fort-abandon-arm',
  'salvage-equip-ask', 'sell-equip-ask', 'cancel-build-ask', 'move-ask', 'city-move-ask',
  'save-slot-drop', 'save-slot-load', 'new-game'
]);

/* ---------- JSONL 记录器 ---------- */
class Jsonl {
  constructor(file) { this.file = path.join(LOGS, file); this.n = 0; }
  write(obj) {
    obj.t = new Date().toISOString();
    try { fs.appendFileSync(this.file, JSON.stringify(obj) + '\n'); this.n++; } catch (e) {}
  }
}
const recBehavior = new Jsonl('behavior.jsonl');
const recSample = new Jsonl('samples.jsonl');
const recEvent = new Jsonl('events.jsonl');

function logEvent(kind, data) { recEvent.write(Object.assign({ kind }, data || {})); }

/* ---------- 覆盖账本 ---------- */
const coverage = {   // action -> {state, note, firstAt, lastAt, count, view}
  _meta: { startedAt: new Date().toISOString() }
};
for (const a of ACTIONS) coverage[a] = { state: 'pending', note: '', count: 0, view: '' };
for (const v of VIEWS) coverage['view:' + v] = { state: 'pending', note: '视图tab', count: 0, view: v };
coverage['key:1-9'] = { state: 'pending', note: '键盘切页', count: 0 };
coverage['key:shift1-3'] = { state: 'pending', note: '键盘续号', count: 0 };
coverage['key:esc'] = { state: 'pending', note: '关弹窗', count: 0 };
coverage['key:tab-enter'] = { state: 'pending', note: '弹窗内导航', count: 0 };

function covTouch(action, extra) {
  const c = coverage[action];
  if (!c) { coverage[action] = { state: 'touched', note: '注册表外', count: 0, view: '' }; }
  const e = coverage[action];
  if (e.state === 'pending' || e.state === 'unreachable') e.state = 'touched';
  e.count = (e.count || 0) + 1;
  e.lastAt = new Date().toISOString();
  if (extra && extra.note && !e.note) e.note = extra.note;
  if (extra && extra.view) e.view = extra.view;
}
function covState(action, state, note) {
  const e = coverage[action] || (coverage[action] = { state: 'pending', note: '', count: 0, view: '' });
  if (state === 'blocked' && e.state === 'touched') return;   // touched 优先
  e.state = state;
  if (note) e.note = note;
}
function covSnapshot() {
  const stat = { touched: 0, opened: 0, blocked: 0, pending: 0, unreachable: 0, total: 0 };
  const detail = {};
  for (const k in coverage) {
    if (k === '_meta') continue;
    const st = coverage[k].state === 'touched' ? 'touched' : coverage[k].state;
    stat[st] = (stat[st] || 0) + 1; stat.total++;
    detail[k] = coverage[k];
  }
  return { at: new Date().toISOString(), stat, detail };
}
function flushCoverage() {
  try { fs.writeFileSync(path.join(LOGS, 'coverage.json'), JSON.stringify(covSnapshot(), null, 1)); } catch (e) {}
}

/* ---------- 页面注入（instrumentation） ---------- */
const INIT_SCRIPT = `(function(){
  window.__ev = { errors: [], actions: [], warns: [] };
  window.addEventListener('error', function(e){
    __ev.errors.push({t:Date.now(), k:'error', m:String(e.message||'').slice(0,300),
      src:(e.filename||'')+':'+(e.lineno||0)+':'+(e.colno||0)});
    if (__ev.errors.length>400) __ev.errors.splice(0,200);
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason;
    __ev.errors.push({t:Date.now(), k:'rejection', m:String((r&&r.message)||r||'').slice(0,300)});
    if (__ev.errors.length>400) __ev.errors.splice(0,200);
  });
  var _ce = console.error ? console.error.bind(console) : null;
  console.error = function(){
    try { __ev.errors.push({t:Date.now(), k:'console.error', m:Array.prototype.join.call(arguments,' ').slice(0,300)}); } catch(_){}
    if (_ce) _ce.apply(null, arguments);
  };
  var _cw = console.warn ? console.warn.bind(console) : null;
  console.warn = function(){
    try { __ev.warns.push({t:Date.now(), m:Array.prototype.join.call(arguments,' ').slice(0,200)}); if(__ev.warns.length>200) __ev.warns.splice(0,100); } catch(_){}
    if (_cw) _cw.apply(null, arguments);
  };
  // GAME.action 包裹（确认点击真的触发了业务动作）
  var _try = 0;
  var _iv = setInterval(function(){
    if (window.GAME && GAME.action && !GAME.__evWrapped) {
      GAME.__evWrapped = true;
      var _act = GAME.action;
      GAME.action = function(name, el){
        var r;
        try { r = _act.call(GAME, name, el); }
        catch(e){ __ev.errors.push({t:Date.now(), k:'action-throw', m:name+': '+String(e&&e.message||e).slice(0,200)}); throw e; }
        __ev.actions.push({t:Date.now(), name:String(name)});
        if (__ev.actions.length>600) __ev.actions.splice(0,300);
        return r;
      };
      clearInterval(_iv);
    }
    if (++_try > 400) clearInterval(_iv);
  }, 50);
  // 帧计数（FPS 采样用）
  window.__fps = { n: 0 };
  (function loop(){ window.__fps.n++; requestAnimationFrame(loop); })();
})();`;

/* ---------- 状态采样（页面内执行） ---------- */
const SAMPLE_FN = `function(){
  var s = GAME.state; if (!s) return null;
  var res = {grain:0,wood:0,stone:0,iron:0};
  var pop = 0, army = 0, bldN = 0, bldLv = 0, extN = 0, extLv = 0;
  (s.cities||[]).forEach(function(c){
    var R = GAME.res(c) || {};
    for (var k in res) res[k] += (Number(R[k])||0);
    pop += (Number(R.pop)||0);
    army += (GAME.armyTotal ? GAME.armyTotal(c) : 0);
    (c.cells||[]).forEach(function(cl){ if (cl && cl.build) { bldN++; bldLv += (cl.build.lvl||1); } });
    (c.extGrid||[]).forEach(function(g){ if (g && g.type) { extN++; extLv += (g.lv||1); } });
  });
  var q = s.queues || {};
  var items = 0; for (var k in (s.items||{})) items += (s.items[k]||0);
  var deepBad = [];
  function scan(o, p, d){
    if (d > 4) return;
    if (typeof o === 'number') { if (!isFinite(o)) deepBad.push(p); return; }
    if (o && typeof o === 'object') {
      for (var k2 in o) { try { scan(o[k2], p+'.'+k2, d+1); } catch(_){ } }
    }
  }
  scan({res:res, gold:s.gold, hearts:s.hearts, tax:s.tax, rank:s.rank}, 's', 0);
  return {
    gt: (s.world && s.world.elapsed) || 0,
    year: (s.world && s.world.year) || 0,
    day: Math.floor(((s.world && s.world.elapsed)||0)/86400),
    res: res, gold: s.gold||0, pop: pop, army: army,
    cities: (s.cities||[]).length, wilds: (s.wilds||[]).length,
    bldN: bldN, bldLv: bldLv, extN: extN, extLv: extLv,
    gens: (s.generals||[]).length,
    gensAvgLv: (s.generals||[]).length ? Math.round((s.generals||[]).reduce(function(a,g){return a+(g.level||g.lv||1);},0)/(s.generals||[]).length*10)/10 : 0,
    qBuild: (q.build||[]).length, qTrain: (q.train||[]).length, qTech: (q.tech||[]).length,
    marches: (s.marches||[]).length, battles: (s.battles||[]).length,
    items: items, inv: (s.inventory||[]).length, forged: (s.forged||[]).length,
    hearts: s.hearts, tax: s.tax, rank: s.rank, rep: s.rep,
    planets: (s.planets||[]).length,
    msgLog: (s.msgLog||[]).length, log: (s.log||[]).length, reports: (s.reports||[]).length,
    stats: s.stats || {},
    heap: (performance.memory ? performance.memory.usedJSHeapSize : 0),
    deepBad: deepBad,
    ts: GAME.timeScale ? GAME.timeScale() : 0
  };
}`;

/* ---------- 心跳 ---------- */
let hbFile = null;
function heartbeat(msg) {
  const line = new Date().toISOString() + ' ' + msg + '\n';
  try { fs.appendFileSync(path.join(LOGS, 'heartbeat.log'), line); } catch (e) {}
  console.log('[HB] ' + msg);
}

module.exports = {
  ROOT, GAME_DIR, LOGS, SHOTS, REPORTS, PORT, BASE, CHROME, USER_DATA, VIEWS, ACTIONS,
  DANGER_BLOCK, ASK_ACTIONS, INIT_SCRIPT, SAMPLE_FN,
  recBehavior, recSample, recEvent, logEvent,
  coverage, covTouch, covState, covSnapshot, flushCoverage, heartbeat
};
