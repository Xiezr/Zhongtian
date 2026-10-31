/* v156.16 诊断：地图 3D 每帧抛 "Cannot read properties of undefined (reading 'x')"
 * 用法：node .workbuddy/tools/show/diag_v15616_rendererr.js
 *
 * 思路（照登在 需求档案 里的方法）：
 *   ① three r160 的 WebGLRenderer 是**函数构造 + this.render = ...**（不是 class，原型打补丁无效），
 *      所以先包一层构造器把实例抓出来（window.__R3），再包实例上的 render 抓 scene/camera；
 *   ② 然后对 scene 的每个 child 做「只隐藏它 → 重新 render 一次」的二分，
 *      看错误在隐藏谁之后消失；没消失就再往下钻一层。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });

  /* ① 抓实例：构造器是函数，直接替换 */
  await p.evaluate(function () {
    var Orig = window.THREE.WebGLRenderer;
    window.THREE.WebGLRenderer = function () {
      var r = new (Function.prototype.bind.apply(Orig, [null].concat([].slice.call(arguments))))();
      window.__R3 = r;
      return r;
    };
    window.THREE.WebGLRenderer.prototype = Orig.prototype;
  });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: 'H', region: 'R', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    if (G.prologue && G.prologue.off) { try { G.prologue.off('diag'); } catch (e) {} }
    if (st.prologue) st.prologue.on = false;
    G.ui.enterGame();
    try { G.ui.setView('map'); } catch (e) {}
  });
  await p.waitForTimeout(1800);
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) {} });

  var out = await p.evaluate(function () {
    var R3 = window.__R3;
    if (!R3) return { err: '没抓到 renderer 实例' };
    /* ② 抓 scene / camera：包实例 render（实例上是自有属性，包得住） */
    var sc = null, cam = null;
    var origRender = R3.render;
    R3.render = function (s, c) { sc = s; cam = c; return origRender.apply(this, arguments); };
    function tryRender() {
      if (!sc || !cam) return 'no-scene';
      try { R3.render(sc, cam); return null; } catch (e) { return String(e && e.message || e); }
    }
    var base0 = tryRender();
    if (!sc || !cam) {
      /* 还没渲染过 → 主动催一次（ui.renderMapCanvas 内部就是 M.render → R3.render） */
      try { GAME.ui.renderMapCanvas(); } catch (e0) {}
      if (!sc || !cam) return { err: '催了一次 render 仍没拿到 scene/camera', base0: base0 };
    }
    var baseline = tryRender();
    if (!baseline) return { baseline: null, note: '这一次没抛（可能是首帧才抛）', rootAll: sc.children.map(function (o, i) { return i + ': ' + label(o); }) };

    function label(o) {
      var m = o.material ? (o.material.type || '?') : '-';
      return (o.type || '?') + '|' + (o.name || '-') + '|' + m + '|children=' + (o.children ? o.children.length : 0);
    }
    function bisect(list) {
      var res = [];
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        var was = o.visible;
        o.visible = false;
        var e = tryRender();
        o.visible = was;
        res.push({ i: i, label: label(o), stillErrors: !!e, msg: e ? e.slice(0, 60) : null });
      }
      return res;
    }
    var first = bisect(sc.children).filter(function (r) { return !r.stillErrors; });
    var deep = null;
    if (!first.length) {
      /* 都没消掉 → 钻一层：对每个有孩子的 group 再试 */
      for (var gi = 0; gi < sc.children.length; gi++) {
        var g = sc.children[gi];
        if (!g.children || !g.children.length) continue;
        var sub = bisect(g.children).filter(function (r) { return !r.stillErrors; });
        if (sub.length) { deep = { parent: label(g), hits: sub }; break; }
      }
    }
    return {
      baseline: baseline,
      rootCount: sc.children.length,
      rootHits: first.slice(0, 6),
      deep: deep,
      rootAll: sc.children.map(function (o, i) { return i + ': ' + label(o); })
    };
  });

  console.log(JSON.stringify(out, null, 1).slice(0, 4000));
  await b.close();
})();
