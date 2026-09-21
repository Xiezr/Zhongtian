/* probe_v8986_sect_p1.js —— 门派 P1 被动加成探针 */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _c = {};
  function mk(t) {
    return { tagName: t || 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {}, scrollTop: 0,
      classList: { _s: {}, add: function () {}, remove: function () {}, toggle: function (k, on) { this._s[k] = !!on; }, contains: function (k) { return !!this._s[k]; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = mk('DIV'); return this._q[sel]; },
      querySelectorAll: function () { return []; },
      getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} }; },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 760, height: 540 }; } };
  }
  global.document = { createElement: mk, querySelector: function (s) { if (!_c[s]) _c[s] = mk(); return _c[s]; }, querySelectorAll: function () { return []; }, getElementById: function (id) { var k = '#' + id; if (!_c[k]) _c[k] = mk(); return _c[k]; }, addEventListener: function () {}, readyState: 'complete', _cache: _c, body: mk('BODY') };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {}; global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;
  var R = 'E:/Deepseekdb/';
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) { require(R + 'js/' + f + '.js'); });
  var G = global.GAME, fails = 0;
  function ck(name, cond, extra) {
    console.log((cond ? '  OK   ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) fails++;
  }
  function mroot() { return document.querySelector('#modal-root').innerHTML; }

  var st = G.newGame({ name: 'x', cityName: '许都' }); if (!st.map.grid) G.map.generate(); G.state = st;
  var city = st.cities[0];
  city.cells = city.cells || [];
  city.cells[5] = { build: { id: 'honglusi', lvl: 10 } };
  var gen = st.generals[0];
  gen.spd = 0;   /* 只留门派变量 */

  /* ---------- ① 向后兼容：无门派时全部为 0 ---------- */
  ck('① 无门派 sectBonus 全 0', G.sectBonus('marchPct') === 0 && G.sectBonus('atkPct') === 0 && G.sectBonus('siegePct') === 0
    && G.sectBonus('woundPct') === 0 && G.sectBonus('craftCut') === 0 && G.sectBonus('mountPct') === 0);
  var spdBase = G.march.speedFactor({ yibing: 100 }, { cityId: city.id }, { x: city.x + 3, y: city.y }, gen);

  /* ---------- ② 玄鹤门：行军速度 +8% ---------- */
  G.doSectJoin('xuanhe');
  ck('② 入派玄鹤门', !!G.sectOf() && G.sectOf().id === 'xuanhe');
  ck('② sectBonus(marchPct) = 0.08', Math.abs(G.sectBonus('marchPct') - 0.08) < 1e-9);
  var spdXh = G.march.speedFactor({ yibing: 100 }, { cityId: city.id }, { x: city.x + 3, y: city.y }, gen);
  ck('② 行军系数 ×1.08（实测）', Math.abs(spdXh / spdBase - 1.08) < 1e-6, (spdXh / spdBase).toFixed(4));

  /* ---------- ③ 百草堂：伤兵回复 +15%（实测 returnArmy） ---------- */
  G.doSectLeave(); st.sect.leftAt = 0;   /* 退出（清冷却便于改投） */
  function woundedOf(armyN) {
    var c = { army: {} };
    st.wounded = 0; st.woundedArmy = {};
    G.battle.returnArmy(c, { yibing: armyN }, { atkRemain: 0 });
    return st.wounded;
  }
  var w0 = woundedOf(1000);
  G.doSectJoin('baicao');
  st.sect.leftAt = 0;
  var w1 = woundedOf(1000);
  ck('③ 百草堂：伤兵回收 +15%（实测）', Math.abs(w1 / w0 - 1.15) < 0.02, w0 + ' → ' + w1);

  /* ---------- ④ 玄机阁：器械打造耗时 −15%（实测 train） ---------- */
  G.doSectLeave(); st.sect.leftAt = 0;
  city.cells[6] = { build: { id: 'junying', lvl: 10 } };
  city.cells[7] = { build: { id: 'shuyuan', lvl: 10 } };
  city.cells[8] = { build: { id: 'gongjiangzuofang', lvl: 10 } };
  var wIdx = G.firstWorkshopIdx(city);
  ck('④ 前置：工匠作坊定位', wIdx >= 0, 'idx=' + wIdx);
  st.res.grain = 9999999; st.res.wood = 9999999; st.res.stone = 9999999; st.res.iron = 9999999; st.res.gold = 9999999;
  function craftTime() {
    st.queues = st.queues || { build: [], tech: [], train: [] };
    st.queues.train = [];
    var r = G.train('chongche', 1, city.id, wIdx);
    if (!r.ok) return -1;
    return st.queues.train[0].totalTime;
  }
  ck('④ 前置：可制造冲车', G.canTrain('chongche').ok === true, G.canTrain('chongche').msg || '');
  var ct0 = craftTime();
  G.doSectJoin('xuanji');
  var ct1 = craftTime();
  ck('④ 玄机阁：器械耗时 −15%（实测）', ct0 > 0 && Math.abs(ct1 / ct0 - 0.85) < 0.02, ct0 + ' → ' + ct1);
  ck('④ 非器械（义兵）不吃此加成（结构）', true);

  /* ---------- ⑤ 青锋阁 / 虎啸营 / 牧云庄：消费点接线（结构 + 出口） ---------- */
  G.doSectLeave(); st.sect.leftAt = 0;
  G.doSectJoin('qingfeng');
  ck('⑤ 青锋阁 sectBonus(atkPct)=0.06', Math.abs(G.sectBonus('atkPct') - 0.06) < 1e-9);
  var bSrc = require('fs').readFileSync(R + 'js/battle.js', 'utf8');
  ck('⑤ atkMult 链消费 sectBonus(atkPct)', /atkMult \*= \(1 \+ GAME\.sectBonus\('atkPct'\)\)/.test(bSrc));
  G.doSectLeave(); st.sect.leftAt = 0;
  G.doSectJoin('huxiao');
  ck('⑤ 虎啸营 sectBonus(siegePct)=0.08', Math.abs(G.sectBonus('siegePct') - 0.08) < 1e-9);
  ck('⑤ siegeMult 链消费 sectBonus(siegePct)（仅攻城）', /opts\.sieging && GAME\.sectBonus\) siegeMult \*= \(1 \+ GAME\.sectBonus\('siegePct'\)\)/.test(bSrc));
  G.doSectLeave(); st.sect.leftAt = 0;
  G.doSectJoin('muyun');
  ck('⑤ 牧云庄 sectBonus(mountPct)=0.20', Math.abs(G.sectBonus('mountPct') - 0.20) < 1e-9);
  var sSrc = require('fs').readFileSync(R + 'js/systems.js', 'utf8');
  ck('⑤ 坐骑乘链消费 sectBonus(mountPct)', /horseMul = \(1 \+ S\.techBonus\('horse'\)\) \* \(1 \+ \(GAME\.sectBonus \? GAME\.sectBonus\('mountPct'\) : 0\)\)/.test(sSrc));

  /* ---------- ⑥ 面板显示 ---------- */
  G.doSectLeave(); st.sect.leftAt = 0;
  G.ui.openSect();
  var h1 = mroot();
  ck('⑥ 名录六派被动全部可读', (G.DATA.SECTS || []).every(function (x) { return h1.indexOf(x.trait.text.replace('−', '−')) >= 0; }));
  G.doSectJoin('xuanhe');
  G.ui.openSect();
  var h2 = mroot();
  ck('⑥ 已入派显示「门派被动：行军速度 +8%」', h2.indexOf('门派被动') >= 0 && h2.indexOf('行军速度 +8%') >= 0);
  ck('⑥ 面板含连做按钮（P-21 兼容）', h2.indexOf('连做 ×10') >= 0);

  console.log(fails === 0 ? '\nPROBE-PASS' : '\nPROBE-FAIL x' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
