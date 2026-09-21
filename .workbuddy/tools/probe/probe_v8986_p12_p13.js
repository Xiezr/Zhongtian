/* probe_v8986_p12_p13.js —— 整改 P-12/P-13 渲染探针
   目标：① 科技面板按钮 = 「研究(黄金 X)」且无 NaN；② 采集面板无 undefined，
         标注改用采力口径；③ 采集估算 = gatherYield 真值。
   运行：cd E:\Deepseekdb && node .workbuddy/tools/probe/probe_v8986_p12_p13.js */
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

  var G = global.GAME, U = G.utils, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }

  var st = G.newGame({ name: '探针', cityName: '许都' });
  if (!st.map.grid) G.map.generate();
  G.state = st;

  /* ---- ① 科技面板 ---- */
  var c = st.cities[0];
  /* 建筑在 city.cells[].build（内部一格 → buildingLevel 取最大） */
  c.cells = c.cells || [];
  c.cells.push({ build: { id: 'shuyuan', lvl: 10 } });
  var th = G.ui.techHTML();
  ck('科技面板无 NaN', th.indexOf('NaN') < 0);
  ck('科技按钮印「研究(黄金 X)」', /研究\(黄金 [^)]+\)/.test(th));
  ck('科技按钮 title 带完整三项费用', /title="需 [^"]*黄金[^"]*木材[^"]*石料[^"]*"/.test(th));
  var m = th.match(/>研究\(黄金 ([^)]+)\)/);
  console.log('     按钮样例：研究(黄金 ' + (m ? m[1] : '?') + ')');
  var t1 = th.match(/title="需 ([^"]+)"/);
  console.log('     title 样例：需 ' + (t1 ? t1[1] : '?'));

  /* ---- ② 采集面板 ---- */
  function findWildNear(ter, cx, cy, r) {
    for (var d = 1; d <= r; d++) {
      for (var dx = -d; dx <= d; dx++) for (var dy = -d; dy <= d; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        var x = cx + dx, y = cy + dy, tl = G.map.tile(x, y);
        if (tl && tl.terrain === ter) return { x: x, y: y, type: ter };
      }
    }
    return null;
  }
  var w = findWildNear('lake', c.x, c.y, 40);
  ck('探针前置：找到湖泊野地', !!w, w ? (w.x + ',' + w.y) : '无');
  if (w) {
    G.state.wilds = [{ x: w.x, y: w.y, type: w.type, level: 3, levelDay: G.questDayIndex() }];
    var gen = st.generals[0];
    gen.status = 'idle'; gen.stamina = 100; gen.energy = 100;
    c.army = { yibing: 2000, changqiang: 500 };
    var chk = G.canStartGather(w.x, w.y);
    ck('探针前置：可派军采集', chk.ok === true, chk.msg || '');
    G.ui.openGatherModal(w.x, w.y);
    var gm = document.querySelector('#modal-root').innerHTML;
    ck('采集面板无 undefined', gm.indexOf('undefined') < 0);
    ck('采集面板印「单队采力上限 30,000」', gm.indexOf('单队采力上限') >= 0 && gm.indexOf('30,000') >= 0);
    ck('采力口径行就位（收成公式/每千采力）', gm.indexOf('采力 = 兵力 × 兵种采集效率之和') >= 0 && gm.indexOf('每千采力·每小时') >= 0);
    /* 估算真值核验：拿面板里的"建议派兵"重算一次 gatherYield 对拍 */
    var mv = gm.match(/id="gather-troops"[^>]*value="(\d+)"/);
    ck('派兵输入框 value 为数字（非 NaN）', !!mv && isFinite(Number(mv[1])), mv ? mv[1] : '无');
    if (mv) {
      var n = Number(mv[1]);
      var y2 = G.gatherYield({ type: w.type, level: 3, army: G.autoPickTroops(n), elapsed: 24 * 3600 });
      var note = gm.match(/采满预计可得 <b>([\d,]+)<\/b>/);
      ck('预计可得 = gatherYield 真值', !!note && note[1] === U.numText(y2.amount, 0), (note ? note[1] : '?') + ' vs ' + U.numText(y2.amount, 0));
      var pw = gm.match(/（采力 ([\d,]+)/);
      ck('采力 = gatherYield power', !!pw && pw[1] === U.numText(y2.power, 0), (pw ? pw[1] : '?') + ' vs ' + U.numText(y2.power, 0));
    }
  }

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
