# -*- coding: utf-8 -*-
"""v89.1 测试：smoke §75（幕景/幕题/徽章/对白/样式）+ e2e 剧本视觉断言（横幅/时间线/结算卡）。探针幂等。"""
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

# ============ ① smoke §75 ============
SEC75 = r'''console.log('\n===== 75. v89.1 剧本视觉化（幕景 / 幕题 / 徽章 / 结算卡） =====');
(function () {
  var uS1 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var hS1 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var css1 = hS1.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  console.log('  --- ① 数据：幕景与幕题 ---');
  check('v89.1：12 活动各有幕景水印 · 36 幕各有幕题（2~8 字）', (function () {
    var F = DATA.SCENE_FLOW || {};
    var acts = Object.keys(DATA.LING_ACT || {});
    if (acts.length !== 12) return false;
    var n = 0;
    for (var i = 0; i < acts.length; i++) {
      var f = F[acts[i]];
      if (!f || !f.art) return false;
      for (var j = 0; j < f.stages.length; j++) {
        var s2 = f.stages[j].s;
        if (!s2 || s2.length < 2 || s2.length > 8) return false;
        n++;
      }
    }
    return n === 36;
  })());

  console.log('  --- ② 辅助函数（徽章 / 对白） ---');
  check('v89.1：倾向徽章映射（攻/获/险/稳/缘 · 无修正不出徽章）', (function () {
    if (!GAME.ui.sxfBadges) return false;
    if (GAME.ui.sxfBadges({}).length !== 0) return false;
    var s2 = GAME.ui.sxfBadges({ pow: 1.08, reward: 1.15, wound: 0.6, luck: 0.08 });
    if (s2.indexOf('攻 +8%') < 0 || s2.indexOf('获 +15%') < 0) return false;
    if (s2.indexOf('稳 -40%') < 0 || s2.indexOf('缘 +8') < 0 || s2.indexOf('险') >= 0) return false;
    return GAME.ui.sxfBadges({ wound: 1.2 }).indexOf('险 +20%') >= 0;
  })());
  check('v89.1：对白高亮（「」成段 · 先转义后切分）', (function () {
    if (!GAME.ui.sxfQuote) return false;
    var s2 = GAME.ui.sxfQuote('甲喝道：「来将通名！」乙笑。');
    if (s2.indexOf('<span class="sxf-q">「来将通名！」</span>') < 0) return false;
    if (s2.indexOf('甲喝道：') < 0) return false;
    return GAME.ui.sxfQuote('<b>「x」</b>').indexOf('&lt;b&gt;') >= 0;
  })());

  console.log('  --- ③ UI 挂点与样式 ---');
  check('v89.1：横幅 / 幕题 / 行程 / 徽章 / 结算卡均接线', (function () {
    return uS1.indexOf('sxf-hero') >= 0 && uS1.indexOf('sxf-hero-art') >= 0
      && uS1.indexOf('sxf-stage-tt') >= 0 && uS1.indexOf('sxf-timeline') >= 0
      && uS1.indexOf('sxf-bdg') >= 0 && uS1.indexOf('sxf-emblem') >= 0
      && uS1.indexOf('fly.art ||') >= 0 && uS1.indexOf('st.s ?') >= 0;
  })());
  check('v89.1：样式与动效齐（.sxf-* 五类 + sxfIn / sxfPop）', (function () {
    return ['.sxf-wrap {', '.sxf-hero {', '.sxf-emblem {', '.sxf-timeline {', '.sxf-bdg {'].every(function (t) {
      return css1.indexOf(t) >= 0;
    }) && /@keyframes sxfIn/.test(css1) && /@keyframes sxfPop/.test(css1);
  })());
})();

'''

sub(r'E:\Deepseekdb\smoke-test.js',
    "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    SEC75 + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    'smoke §75', '===== 75. v89.1')

# ============ ② e2e 剧本视觉断言（地宫块内） ============
OLD_E2E = """    check('v89：地宫探险进入全屏（第 1 幕）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('地宫') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(220);
    check('v89：结算屏出现（专属退出「出宫回城」）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && !!el.querySelector('[data-action="sxf-exit"]') && el.textContent.indexOf('出宫回城') >= 0;
    })());"""

NEW_E2E = """    check('v89：地宫探险进入全屏（第 1 幕）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('地宫') >= 0;
    })());
    check('v89.1：幕景横幅（水印 · 幕题 · 倾向徽章 · 选项齐）', (function () {
      const el = document.getElementById('scene-fx');
      const f = G.DATA.SCENE_FLOW.desert_scene;
      const tt = el.querySelector('.sxf-stage-tt');
      return !!el.querySelector('.sxf-hero') && !!el.querySelector('.sxf-hero-art')
        && (el.querySelector('.sxf-hero-art').textContent || '').length >= 1
        && !!tt && tt.textContent === f.stages[0].s
        && el.querySelectorAll('.sxf-bdg').length >= 1
        && el.querySelectorAll('.sxf-opt').length >= 2
        && el.textContent.indexOf('第 1 / ' + f.stages.length + ' 幕') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    check('v89.1：行程时间线随选择累积（幕题 + 抉择）', (function () {
      const el = document.getElementById('scene-fx');
      return el.querySelectorAll('.sxf-tl-item').length === 1
        && el.textContent.indexOf('行程') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(220);
    check('v89：结算屏出现（专属退出「出宫回城」）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && !!el.querySelector('[data-action="sxf-exit"]') && el.textContent.indexOf('出宫回城') >= 0;
    })());
    check('v89.1：结算卡（光晕徽记 · 战果面板 · 耗用账单）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el.querySelector('.sxf-emblem') && !!el.querySelector('.sxf-loot')
        && el.textContent.indexOf('耗：精力') >= 0
        && el.textContent.indexOf('余：精力') >= 0;
    })());"""

sub(r'E:\Deepseekdb\e2e-test.js', OLD_E2E, NEW_E2E, 'e2e 剧本视觉断言', 'v89.1：幕景横幅')

print()
print('完成。')
