/* probe_v8986_p25.js —— 整改 P-25 复现探针：600× 行军抵达的"军账守恒"
   场景：
     ① 正常占点（回归基线）：占据点 → 战报 + 据点移除 + 军账对平
     ② 目标抵达前熄灭（竞态模拟）：发兵后把据点标记为当日已破 → 抵达时目标不在
        —— 修复前：dispatch 已扣的兵凭空消失、无战报无日志；修复后：原路折返 + 日志
     ③ 侦查带兵（发现项）：斥候带兵抵达后，兵是否归还
     ④ 结算中抛异常（注入）：军账是否兜底退回
   运行：node .workbuddy/tools/probe/probe_v8986_p25.js */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _elCache = {};
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; },
    };
  }
  global.document = {
    createElement: function (tag) { return makeEl(tag); },
    querySelector: function (sel) { if (!_elCache[sel]) _elCache[sel] = makeEl(); return _elCache[sel]; },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { var k = '#' + id; if (!_elCache[k]) _elCache[k] = makeEl(); return _elCache[k]; },
    addEventListener: function () {}, readyState: 'complete', _cache: _elCache,
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var R = 'E:/Deepseekdb/';
  require(R + 'js/data.js');
  require(R + 'js/state.js');
  require(R + 'js/questdata.js');
  require(R + 'js/systems.js');
  require(R + 'js/domain.js');
  require(R + 'js/map.js');
  require(R + 'js/battle.js');
  require(R + 'js/tactic.js');
  require(R + 'js/icons.js');
  require(R + 'js/gicons.js');
  require(R + 'js/bitmaps.js');
  require(R + 'js/portraits.js');
  require(R + 'js/story.js');
  require(R + 'js/ui.js');
  require(R + 'js/main.js');

  var G = global.GAME, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }
  function armyTotal(city) {
    var n = 0;
    for (var k in (city.army || {})) n += city.army[k];
    return n;
  }
  function woundedTotal() {
    var n = 0;
    for (var k in (G.state.woundedArmy || {})) n += G.state.woundedArmy[k];
    return n;
  }
  function logTail(n) {
    /* GAME.log 是 unshift：最新在 [0] */
    var lg = G.state.log || [];
    return lg.slice(0, n).map(function (x) { return x && x.msg ? x.msg : String(x); }).join(' / ');
  }

  var st = G.newGame({ name: '探针', cityName: '许都' });
  if (!st.map.grid) G.map.generate();
  G.state = st;
  st.settings.timeScale = 600;                    /* 600× 复现口径 */

  var city = st.cities[0];
  var gen = st.generals[0];
  gen.status = 'idle';

  /* 找据点（扫周边 40 格，按等级升序——用最低等级的做"可胜"基线） */
  function findForts() {
    var out = [];
    for (var y = city.y - 40; y <= city.y + 40; y += 1) {
      for (var x = city.x - 40; x <= city.x + 40; x += 1) {
        var f = G.map.fortAt(x, y);
        if (f) out.push({ f: f, d: Math.abs(x - city.x) + Math.abs(y - city.y) });
      }
    }
    out.sort(function (a, b) { return (a.f.level - b.f.level) || (a.d - b.d); });
    return out;
  }
  var forts = findForts();
  ck('探针前置：周边有据点', forts.length >= 2, forts.length + ' 座');

  function dispatchOccupy(f, army) {
    var target = { kind: 'fort', x: f.x, y: f.y, name: f.name };
    var p = G.battle.prepare(target, 'occupy', army, gen.id, {});
    if (!p.ok) return { ok: false, msg: p.msg };
    return G.march.dispatch(target, 'occupy', army, gen.id);
  }
  function tickTo() { for (var i = 0; i < 400; i++) G.march.tick(); }

  /* ---------- ① 正常占点（回归基线） ---------- */
  city.army = { changqiang: 400 };
  gen.status = 'idle';
  G.setStaNow(gen, 1000);
  gen.energy = 100;
  var f1 = forts[0].f;
  G.map.fortsRazed = {};
  var before1 = armyTotal(city), rep1 = (st.reports || []).length;
  var d1 = dispatchOccupy(f1, { changqiang: 200 });
  ck('① 占点行军已发出', d1.ok === true, d1.msg || '');
  ck('① 出发即扣兵（军账暂时挂在行军队列）', armyTotal(city) === before1 - 200, String(armyTotal(city)));
  tickTo();
  var rep2 = (st.reports || []).length;
  ck('① 抵达生成战报', rep2 === rep1 + 1, rep1 + ' → ' + rep2);
  var r1 = (st.reports || [])[0];
  ck('① 战报标题为占领战报', !!r1 && /占领/.test(r1.title || ''), r1 ? r1.title : '无');
  var won1 = !!(r1 && r1.win);
  ck('① 胜则据点移除 / 败则据点保留（与战果一致）',
    won1 ? G.map.fortAt(f1.x, f1.y) === null : G.map.fortAt(f1.x, f1.y) !== null,
    (won1 ? '胜' : '败') + ' / ' + (G.map.fortAt(f1.x, f1.y) === null ? '已移除' : '仍在'));
  var acc1 = armyTotal(city) + woundedTotal();
  ck('① 军账守恒：城内 + 伤兵 ≤ 派出前且 > 派出前一半', acc1 <= before1 && acc1 > before1 - 200,
    '城内 ' + armyTotal(city) + ' + 伤兵 ' + woundedTotal() + ' vs 前 ' + before1);
  /* 若首战失利、据点未移除：换一个（等级最低的未破据点）重打，保证 ② 的前置干净 */
  if (G.map.fortAt(f1.x, f1.y) !== null) {
    for (var fi = 0; fi < forts.length; fi++) {
      if (G.map.fortAt(forts[fi].f.x, forts[fi].f.y)) { f1 = forts[fi].f; break; }
    }
  }

  /* ---------- ② 目标抵达前熄灭（竞态模拟） ---------- */
  city.army = { changqiang: 400 };
  gen.status = 'idle';
  G.setStaNow(gen, 1000);
  gen.energy = 100;
  var f2 = forts[1].f;
  var before2 = armyTotal(city), repW2 = woundedTotal(), rp2 = (st.reports || []).length;
  var d2 = dispatchOccupy(f2, { changqiang: 200 });
  ck('② 占点行军已发出', d2.ok === true, d2.msg || '');
  /* 竞态模拟：行军途中目标熄灭（当日被拔除 / 数据翻新） */
  G.map.razeFort(f2.x, f2.y);
  ck('② 竞态已注入（目标已不在）', G.map.fortAt(f2.x, f2.y) === null);
  tickTo();
  var acc2b = armyTotal(city);
  ck('②★ 军账守恒：200 兵原路折返', acc2b === before2,
    '城内 ' + acc2b + ' vs 前 ' + before2 + (acc2b === before2 ? '' : '（丢了 ' + (before2 - acc2b) + '）'));
  ck('② 未生成战报（没有战斗）', (st.reports || []).length === rp2, rp2 + ' → ' + (st.reports || []).length);
  ck('② 伤兵未变', woundedTotal() === repW2, String(woundedTotal()));
  var lg2 = logTail(6);
  ck('② 有"进军中止/折返"日志', /折返|中止|行军中断/.test(lg2), lg2.slice(0, 120));

  /* ---------- ③ 侦查带兵（发现项） ---------- */
  city.army = { yibing: 300 };
  gen.status = 'idle';
  G.setStaNow(gen, 1000);
  gen.energy = 100;
  var before3 = armyTotal(city), wound3 = woundedTotal();
  var w3 = null;
  (function () {
    for (var y = city.y - 30; y <= city.y + 30 && !w3; y++) for (var x = city.x - 30; x <= city.x + 30 && !w3; x++) {
      var tl = G.map.tile(x, y);
      if (tl && tl.terrain !== 'plain' && tl.terrain !== 'city' && !G.map.wildAt(x, y)) w3 = { x: x, y: y };
    }
  })();
  ck('③ 前置：找到野地目标', !!w3, w3 ? (w3.x + ',' + w3.y) : '无');
  if (w3) {
    st.wilds = st.wilds || [];
    var d3 = G.march.dispatch({ kind: 'wild', x: w3.x, y: w3.y }, 'scout', { yibing: 100 }, gen.id);
    ck('③ 侦查行军已发出（带 100 兵）', d3.ok === true, d3.msg || '');
    tickTo();
    var acc3 = armyTotal(city) + (woundedTotal() - wound3);
    console.log('     ③ 城内 ' + armyTotal(city) + ' / 伤兵增 ' + (woundedTotal() - wound3) + ' / 派前 ' + before3);
    ck('③★ 侦查带兵也须归还', acc3 === before3, '差 ' + (before3 - acc3));
  }

  /* ---------- ④ 结算异常兜底（注入） ---------- */
  city.army = { changqiang: 400 };
  gen.status = 'idle';
  G.setStaNow(gen, 1000);
  gen.energy = 100;
  var f4 = forts[0].f;    /* 用回第一个据点：raze 标记不同日会复活 —— 手动清掉当日标记 */
  st.fortsRazed = {};
  /* 若 fortAt 仍为 null（防御），换个还有的 */
  if (!G.map.fortAt(f4.x, f4.y) && forts.length > 2) f4 = forts[2].f;
  var before4 = armyTotal(city);
  var d4 = dispatchOccupy(f4, { changqiang: 200 });
  ck('④ 行军已发出', d4.ok === true, d4.msg || '');
  var origSim = G.battle.simulate;
  G.battle.simulate = function () { throw new Error('注入的结算异常'); };
  tickTo();
  G.battle.simulate = origSim;
  var acc4 = armyTotal(city);
  ck('④★ 异常后军账兜底退回', acc4 === before4, '城内 ' + acc4 + ' vs 前 ' + before4);
  var lg4 = logTail(6);
  ck('④ 有异常/折返日志', /折返|中止|异常/.test(lg4), lg4.slice(0, 120));

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
