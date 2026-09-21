/* probe_v8986_p02_p15_p26.js —— 整改 P-02 / P-15 / P-26 探针 */
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
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
    .forEach(function (f) { require(R + 'js/' + f + '.js'); });

  var G = global.GAME, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }
  function mroot() { return document.querySelector('#modal-root').innerHTML; }

  /* ---------- P-02 favicon ---------- */
  var html = require('fs').readFileSync(R + 'index.html', 'utf8');
  ck('P-02★ index.html 含 rel=icon', /<link rel="icon"/.test(html));
  ck('P-02★ favicon 为 data-URI（无外部文件依赖）', /rel="icon" href="data:image\/svg\+xml,/.test(html));

  var st = G.newGame({ name: '探针', cityName: '许都' });
  if (!st.map.grid) G.map.generate();
  G.state = st;
  var city = st.cities[0];

  /* ---------- P-15 客栈空位引导 ---------- */
  city.cells = city.cells || [];
  city.cells[0] = { build: { id: 'guanfu', lvl: 1 } };
  city.cells[1] = { build: { id: 'zhaoxianguan', lvl: 1 } };
  city.cells[2] = { build: { id: 'kezhan', lvl: 1 } };
  /* 让本城将领数 >= 席位（席位 = 招贤馆 Lv1 + 加成） */
  var cap0 = G.genSlotsOf(city);
  var used0 = G.generalsIn(city).length;
  ck('P-15 前置：席位口径可用', cap0 > 0, 'cap=' + cap0 + ' used=' + used0);
  /* 塞将补满 */
  while (G.generalsIn(city).length < cap0) {
    st.generals.push({ id: 'probe_g' + st.generals.length, name: '探针将' + st.generals.length, level: 1, cityId: city.id, status: 'idle', loyalty: 80, energy: 100, stamina: 100 });
  }
  var chk15 = G.canRecruitGeneral(city);
  ck('P-15 前置：客栈已满（校验拒绝）', chk15.ok === false, chk15.msg || '');
  G.ui.openInn();
  var ih = mroot();
  /* 情形 A：招贤馆 Lv1 = 官府 Lv1（被官府压顶）→ 报两步链 */
  ck('P-15★A 被官府压顶时报"先升官府至 Lv2，再升招贤馆可添 1 席"',
    ih.indexOf('先升官府至 Lv2，再升招贤馆可添 1 席') >= 0, '（招贤馆 Lv1 / 官府 Lv1）');
  ck('P-15★A 招募按钮带 title 原因', /data-action="inn-recruit"[^>]*title="[^"]*"/.test(ih));
  /* 情形 B：官府 Lv3 → 招贤馆可自升 → 报单步文案 */
  city.cells[0] = { build: { id: 'guanfu', lvl: 3 } };
  G.ui.openInn();
  var ih2 = mroot();
  ck('P-15★B 官府够高时报"升招贤馆至 Lv2 可添 1 席"',
    ih2.indexOf('升招贤馆至 Lv2 可添 1 席') >= 0, '（招贤馆 Lv1 / 官府 Lv3）');

  /* ---------- P-26 新城提示 ---------- */
  var plain = null;
  for (var yy = city.y - 8; yy <= city.y + 8 && !plain; yy++) {
    for (var xx = city.x - 8; xx <= city.x + 8 && !plain; xx++) {
      var tl = G.map.tile(xx, yy);
      if (tl && tl.terrain === 'plain' && !G.map.wildAt(xx, yy) && !G.map.fortAt(xx, yy)) {
        var own = G.map.ownCityAt ? G.map.ownCityAt(xx, yy) : null;
        if (!own) plain = { x: xx, y: yy };
      }
    }
  }
  ck('P-26 前置：找到可筑城平原', !!plain, plain ? (plain.x + ',' + plain.y) : '无');
  if (plain) {
    /* 筑城前置：该平原须为**已占野地**（canBuildCityAt 口径）+ 资源充足 */
    st.wilds = (st.wilds || []).concat([{ x: plain.x, y: plain.y, type: 'plain', level: 1, levelDay: G.questDayIndex() }]);
    st.res.grain = 999999; st.res.wood = 999999; st.res.stone = 999999; st.res.iron = 999999; st.res.gold = 999999;
    var rr = G.buildCityAt(plain.x, plain.y);
    ck('P-26 前置：筑城成功', rr.ok === true, rr.msg);
    if (rr.ok) {
      G.ui.openNewCityNotice(rr.city);
      var nh = mroot();
      ck('P-26★ 提示弹窗含守备力 0 与风险', nh.indexOf('守备力') >= 0 && nh.indexOf('城池不会丢') >= 0);
      ck('P-26★ 含"调兵"快捷入口', nh.indexOf('data-action="newcity-send-troop"') >= 0);
      ck('P-26★ 从主城/当前城出发', /data-from="[^"]+"/.test(nh) && nh.indexOf('data-to="' + rr.city.id + '"') >= 0);
    }
  }

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
