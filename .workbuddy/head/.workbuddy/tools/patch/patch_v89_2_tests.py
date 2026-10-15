# -*- coding: utf-8 -*-
"""v89.2 测试：① sxfTimingStop 防误触守卫 ② smoke §76（场景/时机/交互） ③ e2e 三处流程改「停手」+ 新断言。探针幂等。"""
import io

def sub(path, old, new, tag, probe):
    d = io.open(path, encoding='utf-8', newline='').read()
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, '%s 锚点命中 %d 处' % (tag, c)
    d = d.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(d)
    print('OK ' + tag)

# ============ ① 防误触守卫 ============
sub(r'E:\Deepseekdb\js\ui.js',
"""  /* 停手 → 按命中档选对应选项（pos 可注入：测试用） */
  ui.sxfTimingStop = function (pos) {
    var p = (typeof pos === 'number') ? pos : ui.sxfTimingPos();
    ui.sxfTimingClear();
    GAME.doScenePick(ui.sxfTimingGrade(p));
  };""",
"""  /* 停手 → 按命中档选对应选项（pos 可注入：测试用） */
  ui.sxfTimingStop = function (pos) {
    var fx = ui._sceneFx;
    if (!fx || fx.phase !== 'stage') return;        /* 防误触：流程已结束 */
    var st = fx.fly.stages[fx.stage];
    if (!st || !st.t2) return;                      /* 只在时机幕生效（连点不越幕） */
    var p = (typeof pos === 'number') ? pos : ui.sxfTimingPos();
    ui.sxfTimingClear();
    GAME.doScenePick(ui.sxfTimingGrade(p));
  };""",
    'v89.2 sxfTimingStop 防误触', '防误触：流程已结束')

# ============ ② e2e：hill_scene 末幕改停手 ============
sub(r'E:\Deepseekdb\e2e-test.js',
"""    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(200);
    check('v88.1/v89：终幕结算屏（专属退出按钮出现）', (function () {""",
"""    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    /* v89.2：末幕是「时机判定」——点「抱拳！」停手（而不是再点选择） */
    click(document.querySelector('#scene-fx [data-action="sxf-stop"]'));
    await sleep(200);
    check('v88.1/v89：终幕结算屏（专属退出按钮出现）', (function () {""",
    'e2e hill 末幕改停手', '点「抱拳！」停手')

# ============ ③ e2e：xiu 末幕改停手 ============
sub(r'E:\Deepseekdb\e2e-test.js',
"""    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(200);
    check('v88/v89：结算屏含收获（灵气精华）与专属退出', (function () {""",
"""    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    /* v89.2：末幕是「时机判定」——点「收功！」停手 */
    click(document.querySelector('#scene-fx [data-action="sxf-stop"]'));
    await sleep(200);
    check('v88/v89：结算屏含收获（灵气精华）与专属退出', (function () {""",
    'e2e xiu 末幕改停手', '点「收功！」停手')

# ============ ④ e2e：沙漠首幕加场景断言 + 末幕改停手 ============
sub(r'E:\Deepseekdb\e2e-test.js',
"""    check('v89：地宫探险进入全屏（第 1 幕）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('地宫') >= 0;
    })());""",
"""    check('v89：地宫探险进入全屏（第 1 幕）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('地宫') >= 0;
    })());
    check('v89.2：场景画布 + 热点点选（在画里选点，不是点按钮）', (function () {
      const el = document.getElementById('scene-fx');
      const spots = el.querySelectorAll('.sxf-spot');
      return !!el.querySelector('canvas.sxf-canvas')
        && spots.length >= 2
        && spots.length === el.querySelectorAll('[data-action="sxf-choice"]').length
        && (spots[0].getAttribute('style') || '').indexOf('left:') >= 0
        && el.textContent.indexOf('点画中之处') >= 0;
    })());""",
    'e2e 沙漠首幕场景断言', 'v89.2：场景画布 + 热点点选')

sub(r'E:\Deepseekdb\e2e-test.js',
"""    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(220);
    check('v89：结算屏出现（专属退出「出宫回城」）', (function () {""",
"""    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    check('v89.2：末幕时机条（轨道 · 指针 · 停手钮）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el.querySelector('.sxf-tk') && !!el.querySelector('.sxf-mark')
        && !!el.querySelector('[data-action="sxf-stop"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-stop"]'));
    await sleep(220);
    check('v89：结算屏出现（专属退出「出宫回城」）', (function () {""",
    'e2e 沙漠末幕改停手', 'v89.2：末幕时机条')

# ============ ⑤ smoke §76 ============
SEC76 = r'''console.log('\n===== 76. v89.2 场景化（场景画布 / 热点点选 / 时机条） =====');
(function () {
  var uS2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var hS2 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var css2 = hS2.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  console.log('  --- ① 场景插画（12 幅全可绘制） ---');
  check('v89.2：paintScene 出口 + 12 场景名册', (function () {
    return !!GAME.map.paintScene && (GAME.map.SCENE_KEYS || []).length === 12;
  })());
  check('v89.2：12 幅场景全部绘制无异常（记录式桩 ctx）', (function () {
    function mkCtx2() {
      var grad = { addColorStop: function () {} };
      var c2 = {};
      ['beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
        'arc', 'ellipse', 'rect', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect',
        'save', 'restore', 'translate', 'scale', 'rotate', 'setTransform', 'clip',
        'fillText', 'strokeText', 'setLineDash'].forEach(function (n) { c2[n] = function () {}; });
      c2.measureText = function () { return { width: 8 }; };
      c2.createLinearGradient = function () { return grad; };
      c2.createRadialGradient = function () { return grad; };
      return c2;
    }
    var all = true;
    (GAME.map.SCENE_KEYS || []).forEach(function (k) {
      try { if (GAME.map.paintScene(mkCtx2(), k, 123) !== true) all = false; }
      catch (e) { all = false; }
    });
    return all && GAME.map.paintScene(null, 'lake', 1) === false;
  })());
  check('v89.2：每个活动都有一幅对应的场景画（scene × 12 · 全名册内）', (function () {
    var F = DATA.SCENE_FLOW || {}, keys = Object.keys(DATA.LING_ACT || {});
    var names = GAME.map.SCENE_KEYS || [];
    var n = 0;
    keys.forEach(function (k) { if (F[k] && F[k].scene && names.indexOf(F[k].scene) >= 0) n++; });
    return n === 12;
  })());

  console.log('  --- ② 时机幕（三档结局） ---');
  check('v89.2：12 处时机幕（t2 + 三档：首档增益 / 末档折损）', (function () {
    var F = DATA.SCENE_FLOW || {}, keys = Object.keys(DATA.LING_ACT || []);
    var n = 0, bad = 0;
    keys.forEach(function (k) {
      var f = F[k]; if (!f) return;
      f.stages.forEach(function (st) {
        if (!st.t2) return;
        n++;
        var g0 = st.o[0].e || {}, g2 = st.o[2].e || {};
        var up = (g0.pow > 1) || (g0.reward > 1);
        var down = (g2.pow < 1) || (g2.reward < 1);
        if (st.o.length !== 3 || !up || !down) bad++;
      });
    });
    return n === 12 && bad === 0;
  })());
  check('v89.2：时机判定纯函数（正中 0.5 → 0 · 其余 → 1 · 边缘 → 2）', (function () {
    var f = GAME.ui.sxfTimingGrade;
    if (!f) return false;
    return f(0.5) === 0 && f(0.44) === 0 && f(0.56) === 0
      && f(0.35) === 1 && f(0.7) === 1 && f(0.1) === 2 && f(0.9) === 2;
  })());

  console.log('  --- ③ 渲染与接线（三种交互各就各位） ---');
  check('v89.2：三种交互分别渲染（第 1 幕热点 / 次幕按钮 / 末幕时机条）', (function () {
    var s2 = GAME.state, lg = GAME.lordGeneralOf();
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'hill' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    s2.jianghu = {};
    lg.energy = 100; GAME.setStaNow(lg, 100);
    var st0 = GAME.sceneStart(p.x, p.y, lg.id, 'tao');
    if (!st0.ok) return false;
    var h0 = GAME.ui.sceneFxHTML(GAME.sceneFx);
    var isSpot = h0.indexOf('sxf-canvas') >= 0 && h0.indexOf('sxf-spots') >= 0
      && h0.indexOf('sxf-spot-lb') >= 0 && (h0.match(/data-action="sxf-choice"/g) || []).length === 3
      && h0.indexOf('点画中之处') >= 0;
    GAME.scenePick(0);
    var h1 = GAME.ui.sceneFxHTML(GAME.sceneFx);
    var isChoice = h1.indexOf('sxf-opt-ic') >= 0 && h1.indexOf('sxf-spots') < 0
      && (h1.match(/data-action="sxf-choice"/g) || []).length === 3;
    GAME.scenePick(0);
    var h2 = GAME.ui.sceneFxHTML(GAME.sceneFx);
    var isTiming = h2.indexOf('sxf-timing') >= 0 && h2.indexOf('sxf-tk') >= 0
      && h2.indexOf('sxf-mark') >= 0 && h2.indexOf('data-action="sxf-stop"') >= 0
      && h2.indexOf('击鼓！') >= 0 && h2.indexOf('sxf-spots') < 0;
    GAME.sceneFx = null;
    return isSpot && isChoice && isTiming;
  })());
  check('v89.2：sxf-stop 接线 + 绘制/计时器收口', (function () {
    return mS2.indexOf("case 'sxf-stop'") >= 0 && mS2.indexOf('ui.sxfTimingStop') >= 0
      && uS2.indexOf('ui.sxfTimingClear') >= 0 && uS2.indexOf('ui.paintSceneFx') >= 0
      && uS2.indexOf('GAME.map.paintScene') >= 0
      && /ui\.sxfTimingStop = function \(pos\) \{\r?\n    var fx = ui\._sceneFx;/.test(uS2);
  })());
  check('v89.2：样式齐（画布 / 热点 / 时机条 / 图标 + sxfPing）', (function () {
    return ['.sxf-scene {', '.sxf-canvas {', '.sxf-spots {', '.sxf-spot-hit {',
      '.sxf-tk {', '.sxf-mark {', '.sxf-opt-ic {', '.sxf-sc-tip {'].every(function (t) {
      return css2.indexOf(t) >= 0;
    }) && /@keyframes sxfPing/.test(css2);
  })());
})();

'''

sub(r'E:\Deepseekdb\smoke-test.js',
    "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    SEC76 + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    'smoke §76', '===== 76. v89.2')

print()
print('完成。')
