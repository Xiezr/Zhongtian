/* 探针 v157.67 —— 「人口常满」插件行为取证（无限人口整条退役后的替代实现）
 * 跑法：node .workbuddy/tools/probe/probe_v15767_fullpop.js
 * 输出：.workbuddy/tmp/probe_v15767_fullpop.log（逐行 append，防本机 stdout 丢失）
 * 口径：只给 effPopCapOf 与 tickOnce 打桩，GAME.res / GAME.city.all 走真实出口。 */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path');
  var ROOT = path.resolve(__dirname, '..', '..', '..');
  var LOG = path.join(ROOT, '.workbuddy', 'tmp', 'probe_v15767_fullpop.log');
  try { fs.unlinkSync(LOG); } catch (e) { }
  function T(s) { fs.appendFileSync(LOG, s + '\n'); }

  T('0 start');
  global.window = global;
  global.localStorage = {
    _d: {}, getItem: function (k) { return this._d[k] || null; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  };
  var _elCache = {};
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () { }, remove: function () { }, toggle: function () { }, contains: function () { return false; } },
      addEventListener: function () { }, appendChild: function () { },
      setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = makeEl('DIV'); return this._q[sel]; },
      querySelectorAll: function () { return []; },
      getContext: function () {
        return {
          createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
          putImageData: function () { }, drawImage: function () { }, clearRect: function () { },
          fillRect: function () { }, strokeRect: function () { }, beginPath: function () { },
          arc: function () { }, ellipse: function () { }, save: function () { }, restore: function () { },
          clip: function () { }, rect: function () { }, translate: function () { }, scale: function () { },
          rotate: function () { }, fill: function () { }, stroke: function () { }, moveTo: function () { },
          lineTo: function () { }, closePath: function () { }, quadraticCurveTo: function () { },
          bezierCurveTo: function () { }, fillText: function () { }, strokeText: function () { },
          setLineDash: function () { }, measureText: function () { return { width: 10 }; },
          createLinearGradient: function () { return { addColorStop: function () { } }; },
          createRadialGradient: function () { return { addColorStop: function () { } }; },
          createPattern: function () { return null; }, roundRect: function () { }
        };
      },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; }
    };
  }
  global.document = {
    createElement: function (tag) { return makeEl(tag); },
    querySelector: function (sel) { if (!_elCache[sel]) _elCache[sel] = makeEl(); return _elCache[sel]; },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { var k = '#' + id; if (!_elCache[k]) _elCache[k] = makeEl(); return _elCache[k]; },
    addEventListener: function () { }, readyState: 'complete'
  };
  global.requestAnimationFrame = function () { return 0; };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () { };
  global.removeEventListener = function () { };
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  require(path.join(ROOT, 'js', 'bundle-core.js'));
  var G = global.GAME;
  /* plugins.js 属 ui 包，这里按源码 eval（IIFE、无 import），等价于页面加载顺序 */
  eval(fs.readFileSync(path.join(ROOT, 'js', 'plugins.js'), 'utf8'));
  T('1 core+plugins loaded · ids=' + (G.plugins ? G.plugins.stats().ids.join(',') : 'none'));
  T('2 无限人口已退役（infinite-pop 不在册）=' + (G.plugins && G.plugins.stats().ids.indexOf('infinite-pop') < 0));

  /* 最小 state：不调 newGame（会生成 25 万格地图，太重） */
  var fake = [{ name: '灰岗', res: { pop: 10 } }, { name: '灰丘', res: { pop: 20 } }];
  G.state = { cities: fake, msgLog: [], log: [], wilds: [], world: { elapsed: 0 }, generals: [], gathers: [], forts: {} };
  var caps = [100, 200];
  function effStub(c) { return caps[fake.indexOf(c)] || 0; }
  var origMax = G.maxPopOf, origGrow = G.popGrowthOf;
  G.effPopCapOf = effStub;
  var ticks = 0;
  var tickStub = function () { ticks++; };   /* 插件 _on 保存的就是这一份，_off 逐引用恢复到它 */
  G.tickOnce = tickStub;

  var on = G.plugins.enable('full-pop', true);
  T('3 开启 on=' + on + ' · tickOnce 已包装=' + (G.tickOnce !== tickStub));
  T('① 开启即满：A=' + fake[0].res.pop + '（期望 100）· B=' + fake[1].res.pop + '（期望 200）');

  fake[0].res.pop = 3;                 /* 模拟辐射云 / 遣散 / 战损减员 */
  G.tickOnce();
  T('② 减员→下一拍补回：A=' + fake[0].res.pop + ' · 原 tick 真被调用次数=' + ticks);

  caps[1] = 350;                      /* 造居所 / 民心回升 → 上限变高 */
  G.tickOnce();
  T('③ 上限提高→同步：B=' + fake[1].res.pop + '（期望 350）');

  caps[0] = 60;                       /* 民心下滑 → 上限降低 */
  G.tickOnce();
  T('④ 上限下降→同步回落：A=' + fake[0].res.pop + '（期望 60 · 「总为」= 真相等）');

  T('⑤ 三个上限出口引用不变：maxPopOf=' + (G.maxPopOf === origMax)
    + ' · popGrowthOf=' + (G.popGrowthOf === origGrow)
    + ' · effPopCapOf 仍是探针桩=' + (G.effPopCapOf === effStub));

  var off = G.plugins.disable('full-pop', true);
  fake[0].res.pop = 7;
  G.tickOnce();                        /* 关闭后走回原 tick，不再补 */
  T('⑥ 关闭 off=' + off + ' · tickOnce 逐引用恢复=' + (G.tickOnce === tickStub)
    + ' · 存量不回滚也不再补：A=' + fake[0].res.pop + '（期望 7）· ticks=' + ticks);
  T('DONE');
  process.exit(0);
})();
