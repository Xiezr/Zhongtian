/* 长跑探针：跑 N 个游戏月，看这个废土是不是"活"的。
 * 只看趋势，不做断言：人口/兵/资源/城数/惰性/老兵/竞争者/袭击/终局。
 * 用法：NODE_PATH=... node _sim_run.js  (放在项目根跑，读 js/bundle.js)
 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function () { return makeEl('DIV'); }, querySelectorAll: function () { return []; },
      getContext: function () {
        var noop = function () {};
        return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
          putImageData: noop, drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
          beginPath: noop, arc: noop, ellipse: noop, save: noop, restore: noop, clip: noop, rect: noop,
          translate: noop, scale: noop, rotate: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop,
          closePath: noop, quadraticCurveTo: noop, bezierCurveTo: noop, fillText: noop, strokeText: noop,
          setLineDash: noop, measureText: function () { return { width: 10 }; },
          createLinearGradient: function () { return { addColorStop: noop }; },
          createRadialGradient: function () { return { addColorStop: noop }; },
          createPattern: function () { return null; }, roundRect: noop };
      },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; },
    };
  }
  var cache = {};
  global.document = {
    createElement: makeEl, querySelector: function (s) { if (!cache[s]) cache[s] = makeEl(); return cache[s]; },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { var k = '#' + id; if (!cache[k]) cache[k] = makeEl(); return cache[k]; },
    addEventListener: function () {}, readyState: 'complete', _cache: cache,
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  /* ⚠️ v124 修：v104 拆包后 `js/bundle.js` 已经不存在，这个探针从那天起就是坏的
     （没人跑它，所以没人发现）。现在改读三包，顺序不能换。 */
  var _J = require('path').join(__dirname, '..', '..', '..', 'js');
  require(require('path').join(_J, 'bundle-core.js'));
  require(require('path').join(_J, 'bundle-war.js'));
  require(require('path').join(_J, 'bundle-ui.js'));
  var G = global.GAME;
  G.DATA.DEFAULT_SETTINGS.battleWatch = false;

  G.newGame({ name: '长跑', avatar: '🧑', gender: 'male', region: 'random' });
  var st = G.state;
  var c0 = G.currentCity();

  function snap(label) {
    var cities = G.city.all() || [];
    var pop = 0, army = 0, res = { grain: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    cities.forEach(function (c) {
      pop += (G.res(c).pop | 0);
      army += G.city.armyTotal(c);
      res.grain += c.res.grain | 0; res.wood += c.res.wood | 0;
      res.stone += c.res.stone | 0; res.iron += c.res.iron | 0; res.gold += c.res.gold | 0;
    });
    var idleMax = 0;
    cities.forEach(function (c) { idleMax = Math.max(idleMax, c.idle | 0); });
    var teams = (G.rival && G.rival.alive) ? G.rival.alive().length : 0;
    var teamPop = 0;
    if (G.rival && G.rival.alive) G.rival.alive().forEach(function (t) { teamPop += (t.pop | 0); });
    var vills = (G.village && G.village.listAll) ? G.village.listAll().length : 0;
    var held = 0;
    if (G.village && G.village.listAll) {
      G.village.listAll().forEach(function (ci) {
        var r = G.village.peek && G.village.peek(ci);
        if (r && r.heldBy) held++;
      });
    }
    console.log([label,
      '城 ' + cities.length,
      '人 ' + pop,
      '兵 ' + army,
      '粮 ' + Math.round(res.grain / 1000) + 'k',
      '木 ' + Math.round(res.wood / 1000) + 'k',
      '铁 ' + Math.round(res.iron / 1000) + 'k',
      '金 ' + Math.round(res.gold / 1000) + 'k',
      '惰性max ' + idleMax,
      '伤兵 ' + (st.wounded | 0),
      '竞争者 ' + teams + '/' + teamPop + '人',
      '村社 ' + vills + '(被占' + held + ')',
      '月 ' + Math.floor(((st.world || {}).elapsed || 0) / 4800)
    ].join(' · '));
  }

  var SPM = ((G.DATA.CALENDAR || {}).secPerYear || 57600) / 12;
  var MONTHS = parseInt(process.argv[2] || '240', 10);
  console.log('诊断: cells=' + ((G.sphere && G.sphere.cells) ? G.sphere.cells.length : 'null')
    + ' mapSphere=' + (!!G.mapSphere)
    + ' pc.ci=' + (c0 ? c0.ci : 'null')
    + ' mainCityId=' + st.mainCityId
    + ' cities=' + (G.city.all() || []).length
    + ' village.list=' + (G.village ? G.village.list().length : 'n/a')
    + ' village.listAll=' + (G.village && G.village.listAll ? G.village.listAll().length : 'n/a')
    + ' ruins=' + ((G.ruin && G.ruin.list) ? G.ruin.list().length : 'n/a'));
  (function probe(){
    var sp = G.sphereOf ? G.sphereOf() : (G.mapSphere || G.sphere);
    var n = sp.cells.length, land = 0, lake = 0, other = 0;
    var types = {};
    for (var i = 0; i < n; i++) {
      var t = sp.cells[i] && sp.cells[i].type;
      types[t] = (types[t] || 0) + 1;
      if (t === 'lake') lake++; else if (t) land++; else other++;
    }
    console.log('地形分布: ' + JSON.stringify(types).slice(0, 200));
    console.log('seed3=' + (sp.seed3 ? sp.seed3() : 'n/a') + ' listN=' + (sp.cells.length));
    console.log('chance=' + (G.DATA.VILLAGE || {}).chance);
  })();
  snap('开局');
  for (var m = 1; m <= MONTHS; m++) {
    /* 每 4800 游戏秒 = 1 个月；tickOnce 是"每秒"的，所以按月推进 elapsed 再拍一拍 */
    st.world.elapsed = m * SPM;
    G.tickOnce();
    if (m % 24 === 0) snap('第 ' + m + ' 月');
  }
  snap('收尾');

  /* 关键系统状态 */
  var out = {
    终局选项: (G.ending ? G.ending.choiceOf() : null),
    终局开门: (G.ending ? G.ending.opened() : null),
    老兵: c0 ? Math.round(G.veteran.avgLvlOf(c0.id) * 100) / 100 : 0,
    兵员等级: c0 ? G.trooplv.of(c0, 'buxingji') : 0,
    民怨: c0 ? G.unrest.of(c0) : 0,
    污染: c0 ? Math.round(G.taint.of(c0)) : 0,
    温度: G.climate ? G.climate.tempOf(5) : 0,
    云半径: G.surge ? G.surge.rOf(240) : 0,
    遗页: G.relic ? G.relic.pagesOf() : 0,
    残页可选: G.relic ? G.relic.options().filter(function (o) { return o.ok; }).length : 0,
  };
  console.log('系统状态：' + JSON.stringify(out));

  var teams2 = (G.rival && G.rival.arr) ? G.rival.arr() : [];
  console.log('竞争者明细：' + teams2.map(function (t) {
    return t.name + '(' + (t.pop | 0) + (t.dead ? ' 散' : '') + ' moved' + (t.moved | 0) + ')';
  }).join(' · '));
  console.log('兵源: pending=' + JSON.stringify(st.muster && st.muster.pending)
    + ' 台账条数=' + ((st.muster && st.muster.log) ? st.muster.log.length : 0)
    + ' 名声=' + (G.renown ? G.renown.score() : 'n/a'));
  console.log('村社/遗迹 post: v=' + G.village.listAll().length + ' r=' + G.ruin.list().length
    + ' seeded=' + JSON.stringify(st.rival && st.rival.seeded));
  process.exit(0);
})();
