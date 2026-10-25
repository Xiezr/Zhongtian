/* ============================================================
 * power_calib.js  —  战力评估系数标定（node 运行，放项目根目录）
 * 用法: node power_calib.js
 * 目的：用真实战斗引擎测量「射程 / 速度」在实战中的边际优势，
 *       为 GAME.power 的兵种/英雄系数提供实证依据（而非拍脑袋）。
 * ============================================================ */
(function () {
  /* ---- 无头 GAME 引导（照搬 chain-audit.js） ---- */
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _elCache = {};
  function makeEl(tag) {
    return { tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
      querySelector: function () { return makeEl(); }, querySelectorAll: function () { return []; },
      getContext: function () { return null; }, getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; } };
  }
  global.document = { createElement: function (t) { return makeEl(t); }, querySelector: function (s) { return _elCache[s] || ( _elCache[s] = makeEl()); },
    querySelectorAll: function () { return []; }, getElementById: function (id) { return _elCache['#' + id] || ( _elCache['#' + id] = makeEl()); }, addEventListener: function () {}, readyState: 'complete' };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {}; global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var fs = require('fs');
  var _LOG = 'power_calib.log';
  try { fs.unlinkSync(_LOG); } catch (e) {}
  function line(s) { fs.appendFileSync(_LOG, s + '\n'); }
  require('./js/bundle-core.js');
  require('./js/bundle-war.js');
  require('./js/bundle-ui.js');
  var G = global.GAME, DATA = G.DATA;
  if (!G || !DATA) throw new Error('bundle 求值异常');
  G.newGame({ name: '标定', cityName: '标定城' });
  if (G.DATA.DEFAULT_SETTINGS) G.DATA.DEFAULT_SETTINGS.battleWatch = false;

  /* ---- 注入合成兵种（不改真实数据，进程退出即弃） ---- */
  function syn(id, over) {
    DATA.TROOPS[id] = Object.assign({ id: id, grp: 2, name: id, hp: 4000, atk: 400, def: 300, range: 50, spd: 300, load: 100, pop: 1, time: 30, cost: {} }, over);
  }
  syn('__melee', { range: 50, spd: 300 });
  [50, 400, 800, 1000, 1200, 1600].forEach(function (r) { syn('__r' + r, { range: r, spd: 300 }); });
  [100, 200, 300, 400, 500, 800, 1200].forEach(function (v) { syn('__s' + v, { range: 50, spd: v }); });

  var N = 100000;
  function duel(atkId, defId, atkGen, defGen) {
    var atk = {}, def = {}; atk[atkId] = N; def[defId] = N;
    var r = G.battle.simulateDice(atk, atkGen || null, def, 0, defGen || null, {});
    return { win: r.winner, aRem: Math.round(r.atkRemain / N * 1000) / 10, dRem: Math.round(r.defRemain / N * 1000) / 10, rd: r.rounds };
  }
  function line(s) { console.log(s); }

  /* ===== 1) 射程扫掠 ===== */
  line('\n===== 射程优势（远程一方 vs 近战基线；各 10 万）=====');
  line('range | 攻方余% | 守方余% | 胜方 | 回合');
  [50, 400, 800, 1000, 1200, 1600].forEach(function (r) {
    var d = duel('__r' + r, '__melee');
    line(('' + r).padStart(5) + ' | ' + ('' + d.aRem + '%').padStart(7) + ' | ' + ('' + d.dRem + '%').padStart(7) + ' | ' + d.win.padStart(3) + ' | ' + d.rd);
  });

  /* ===== 2) 速度扫掠 ===== */
  line('\n===== 速度优势（快方 vs 慢方 spd300，均为近战）=====');
  line('atkSpd | 攻方余% | 守方余% | 胜方 | 回合');
  [100, 200, 300, 400, 500, 800, 1200].forEach(function (v) {
    var d = duel('__s' + v, '__melee');
    line(('' + v).padStart(6) + ' | ' + ('' + d.aRem + '%').padStart(7) + ' | ' + ('' + d.dRem + '%').padStart(7) + ' | ' + d.win.padStart(3) + ' | ' + d.rd);
  });

  /* ===== 3) 将领攻击加成锚定 ===== */
  line('\n===== 将领加成锚定（主战机甲 10 万；攻方带将）=====');
  function fakeGen(yw, zm) { return { id: '__g', name: '__g', speed: 0, level: 1, tong: 0, yw: yw || 0, zm: zm || 0, nz: 0, attack: 0, defense: 0, spdAdd: 0 }; }
  var nb = G.battle.simulateDice({ zhuzhan: N }, null, { zhuzhan: N }, 0, null, {});
  line('无将   | 攻余% ' + Math.round(nb.atkRemain/N*1000)/10 + '  守余% ' + Math.round(nb.defRemain/N*1000)/10 + '  胜 ' + nb.winner);
  [0.05, 0.10, 0.20, 0.30].forEach(function (p) {
    var gen = fakeGen(Math.round(p / G.YW_PCT), Math.round(p / G.ZM_PCT));
    var a = G.genAttrs(gen);
    var d = G.battle.simulateDice({ zhuzhan: N }, gen, { zhuzhan: N }, 0, null, {});
    line('atkPct ' + (a.atkPct*100).toFixed(1) + '% | 攻余% ' + Math.round(d.atkRemain/N*1000)/10 + '  守余% ' + Math.round(d.defRemain/N*1000)/10 + '  胜 ' + d.winner);
  });

  /* ===== 4) 现有兵种战力抽样 ===== */
  line('\n===== 现有兵种战力（STORY.troopPower）抽样 =====');
  ['buxingji','dunwei','daodanche','wuzhi','zhuzhan','huopao','wuren','taitan','kuanglie'].forEach(function (id) {
    var t = DATA.TROOPS[id]; if (!t) return;
    line((t.name + '(' + id + ')').padEnd(14) + ' hp' + t.hp + ' atk' + t.atk + ' def' + t.def + ' rng' + t.range + ' spd' + t.spd + ' => 战力 ' + Math.round(G.story.troopPower(id)));
  });

  line('\n标定完成。');
})();
