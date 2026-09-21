/* probe_v8986_p23_train.js —— 整改 P-23 / P-19 / P-05 探针 */
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
  function el(id) { return document.getElementById(id); }
  function mroot() { return document.querySelector('#modal-root').innerHTML; }

  var st = G.newGame({ name: '探针', cityName: '许都' });
  if (!st.map.grid) G.map.generate();
  G.state = st;
  var city = st.cities[0];
  var gen = st.generals[0];
  gen.status = 'idle';
  G.setStaNow(gen, 1000);
  gen.energy = 100;

  /* ---------- P-23 · 兵力悬殊二次确认 ---------- */
  var fort = null;
  (function () {
    for (var y = city.y - 30; y <= city.y + 30 && !fort; y++) for (var x = city.x - 30; x <= city.x + 30 && !fort; x++) {
      var f = G.map.fortAt(x, y);
      if (f && f.level >= 4) fort = f;
    }
  })();
  ck('P-23 前置：找到 Lv4+ 据点（守军显著）', !!fort, fort ? (fort.name + ' Lv' + fort.level) : '无');
  if (fort) {
    city.army = { changqiang: 200 };
    G.ui.openExpModal({ kind: 'fort', x: fort.x, y: fort.y });
    G.ui._expMode = 'occupy';
    el('exp-gen').value = gen.id;
    el('exp-changqiang').value = '200';
    var pw = G.ui.expPowerOf();
    ck('P-23 前置：战力比 < 0.5', !!pw && pw.def > 0 && pw.mine > 0 && pw.ratio < 0.5,
      pw ? ('mine=' + pw.mine + ' def=' + pw.def + ' ratio=' + (Math.round(pw.ratio * 100) / 100)) : 'null');

    var marches0 = (st.marches || []).length;
    G.doExpConfirm();          /* 第一次点击：应"上膛"，不发兵 */
    ck('P-23★ 首击不发兵', (st.marches || []).length === marches0, String((st.marches || []).length));
    ck('P-23★ 上膛标记已置位', G.ui._expForceArmed === true);
    var btn = document.querySelector('#modal-root [data-action="exp-confirm"]');
    ck('P-23★ 按钮变红并复述战力比', btn.className.indexOf('red') >= 0 && btn.innerHTML.indexOf('兵力悬殊') >= 0,
      btn.innerHTML.replace(/<[^>]+>/g, ''));

    G.doExpConfirm();          /* 第二次点击：真发兵 */
    ck('P-23★ 再击发兵（行军队列 +1）', (st.marches || []).length === marches0 + 1, String((st.marches || []).length));
    ck('P-23★ 上膛标记已清', G.ui._expForceArmed === false);
    st.marches = [];

    /* 对照：兵力充足（拉满 5 万）不拦 */
    city.army = { changqiang: 60000 };
    G.ui._expMode = 'occupy';
    G.ui.openExpModal({ kind: 'fort', x: fort.x, y: fort.y });
    el('exp-gen').value = gen.id;
    el('exp-changqiang').value = '50000';
    G.doExpConfirm();
    ck('P-23 对照：兵力充足一击即发', (st.marches || []).length === 1, String((st.marches || []).length));
    st.marches = [];

    /* 对照：掠夺己方野地（和平派驻）不拦 —— 用野地模拟 */
    var wildNear = null;
    (function () {
      for (var r = 1; r <= 30 && !wildNear; r++) {
        for (var dy = -r; dy <= r && !wildNear; dy++) for (var dx = -r; dx <= r && !wildNear; dx++) {
          var tl = G.map.tile(city.x + dx, city.y + dy);
          if (tl && tl.terrain !== 'plain' && tl.terrain !== 'city') wildNear = { x: city.x + dx, y: city.y + dy, type: tl.terrain };
        }
      }
    })();
    if (wildNear) {
      st.wilds = [{ x: wildNear.x, y: wildNear.y, type: wildNear.type, level: 3, levelDay: G.questDayIndex(), garrison: { troops: {} } }];
      city.army = { changqiang: 100 };
      G.ui.openExpModal({ kind: 'wild', x: wildNear.x, y: wildNear.y });
      G.ui._expMode = 'occupy';
      el('exp-gen').value = gen.id;
      el('exp-changqiang').value = '100';
      G.doExpConfirm();
      ck('P-23 对照：占领己方野地（不接战）一击即发', (st.marches || []).length === 1, String((st.marches || []).length));
      st.marches = [];
    }
  }

  /* ---------- P-19 / P-05 · 募兵面板 ---------- */
  /* 前置：保证选中的是义兵（pop 1）且面板可渲染 */
  G.ui._trainFilter = 'normal';
  G.ui._trainTab = 'inf';
  G.ui._trainSel = 'yibing';
  var tY = G.data ? null : null;
  var unit = (G.DATA || DATA).TROOPS ? null : null;

  /* 情形①：人口耗尽 → reason=pop */
  st.res.pop = 0;
  st.res.grain = 999999; st.res.wood = 999999; st.res.iron = 999999;
  var lim1 = G.trainLimitOf('yibing');
  ck('P-19 前置①：trainLimitOf 归因 pop', lim1.cap === 0 && lim1.reason === 'pop',
    'cap=' + lim1.cap + ' reason=' + lim1.reason);
  var h1 = G.ui.troopsHTML();
  ck('P-19★ 面板出现"人口不足"', h1.indexOf('人口不足') >= 0);
  ck('P-05★ 面板出现"每兵占人口 1（可用 0）"', h1.indexOf('每兵占人口 1（可用 0）') >= 0);

  /* 情形②：资源不足 → reason=res 且点名缺什么 */
  st.res.pop = 100000;
  st.res.grain = 100000; st.res.wood = 100000; st.res.iron = 0;
  var lim2 = G.trainLimitOf('yibing');
  ck('P-19 前置②：trainLimitOf 归因 res', lim2.cap === 0 && lim2.reason === 'res',
    'cap=' + lim2.cap + ' reason=' + lim2.reason + ' lack=' + lim2.lack.join(','));
  var h2 = G.ui.troopsHTML();
  ck('P-19★ 面板出现"资源不足 —— 缺 铁"', h2.indexOf('资源不足') >= 0 && h2.indexOf('铁') >= 0);

  /* 情形③：正常（cap>0）→ 无归因行；口径与 maxTrainCount 一致 */
  st.res.iron = 1000000;
  var lim3 = G.trainLimitOf('yibing');
  var mx3 = G.maxTrainCount('yibing', city.id);
  ck('P-19 对照：正常时归因行为空', lim3.cap > 0 && lim3.reason === '' && mx3 === lim3.cap,
    'cap=' + lim3.cap + ' max=' + mx3);
  var h3 = G.ui.troopsHTML();
  ck('P-19 对照：正常面板无"人口不足/资源不足"', h3.indexOf('人口不足') < 0 && h3.indexOf('资源不足') < 0);
  ck('P-05 对照：正常面板仍有"每兵占人口"', h3.indexOf('每兵占人口 1（可用 ') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
