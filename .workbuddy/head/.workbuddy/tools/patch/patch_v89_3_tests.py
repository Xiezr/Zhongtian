# -*- coding: utf-8 -*-
"""v89.3 测试 —— smoke-test.js §77 + e2e-test.js 横幅断言

smoke §77（四组）：
  ① 灵物名就位（灵鲤/白鹿/灵蛇/灵驹）+ 旧称清退
  ② 活动命名统一（通用 2 字 / 招牌 4 字）+ 12 门类章与雅名齐全唯一
  ③ 横幅渲染（临湖垂钓 · 金鳞之约 · 垂纶）+ 样式接线
e2e：地宫横幅「古冢探幽 / 探幽」断言。
"""
import io

# ---------- smoke ----------
PS = r'E:\Deepseekdb\smoke-test.js'
s = io.open(PS, encoding='utf-8', newline='').read()

ANCHOR_S = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"

BLOCK = r"""console.log('\n===== 77. v89.3 文案统一（灵物志 / 雅名 / 门类章） =====');
(function () {
  var uS3 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var css3 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8').match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  console.log('  --- ① 灵物命名（鹿非鹿 · 鱼非鱼） ---');
  check('v89.3：灵物名就位（灵鲤 / 白鹿 / 灵蛇 / 灵驹）', (function () {
    var f = DATA.SCENE_FLOW;
    var s1 = f.lake_scene.stages[1].s + f.lake_scene.stages[1].t;
    var s2 = f.forest_scene.stages[1].s + f.forest_scene.stages[1].t;
    var s3 = f.cai.stages[1].t;
    var s4 = f.caoyuan_scene.stages[0].t + f.caoyuan_scene.stages[1].t;
    return s1.indexOf('灵鲤') >= 0 && s2.indexOf('白鹿') >= 0
      && s3.indexOf('灵蛇') >= 0 && s4.indexOf('灵驹') >= 0;
  })());
  check('v89.3：灵物旧称清退（花蛇 / 野物 / 大物 / 兽迹 / 小鱼 / 烈马 / 马群 / 良马）', (function () {
    var d3 = JSON.stringify(DATA.SCENE_FLOW) + JSON.stringify(DATA.LING_ACT);
    return ['花蛇', '野物', '大物', '兽迹', '小鱼', '烈马', '马群', '良马'].every(function (w3) {
      return d3.indexOf(w3) < 0;
    });
  })());

  console.log('  --- ② 活动命名（通用 2 字 · 招牌 4 字 · 雅名与门类章） ---');
  check('v89.3：地形招牌名统一 4 字（垂钓 → 临湖垂钓）', (function () {
    var keys = ['hill_scene', 'lake_scene', 'zhaoze_scene', 'desert_scene', 'forest_scene', 'caoyuan_scene'];
    return keys.every(function (k3) { return DATA.LING_ACT[k3].name.length === 4; })
      && DATA.LING_ACT.lake_scene.name === '临湖垂钓'
      && ['tao', 'qie', 'shi', 'cai', 'xiu', 'bai'].every(function (k3) { return DATA.LING_ACT[k3].name.length === 2; });
  })());
  check('v89.3：12 活动门类章（cat 2 字）与雅名（alias 4 字）齐全且唯一', (function () {
    var keys = ['tao', 'qie', 'shi', 'cai', 'xiu', 'bai', 'hill_scene', 'lake_scene', 'zhaoze_scene', 'desert_scene', 'forest_scene', 'caoyuan_scene'];
    var cats = {}, aliases = {};
    for (var i3 = 0; i3 < keys.length; i3++) {
      var a3 = DATA.LING_ACT[keys[i3]];
      if (!a3 || !a3.cat || !a3.alias) return false;
      if (a3.cat.length !== 2 || a3.alias.length !== 4) return false;
      if (cats[a3.cat] || aliases[a3.alias]) return false;
      cats[a3.cat] = 1; aliases[a3.alias] = 1;
    }
    return true;
  })());

  console.log('  --- ③ 渲染接线（横幅雅名 + 样式） ---');
  check('v89.3：横幅渲染雅名与门类章（临湖垂钓 · 金鳞之约 · 垂纶）', (function () {
    var lg3 = GAME.lordGeneralOf();
    var fx3 = { chk: { act: DATA.LING_ACT.lake_scene, gen: lg3, x: 3, y: 3, day: 0, lv: 1 },
      fly: DATA.SCENE_FLOW.lake_scene, actId: 'lake_scene',
      stage: 0, picks: [], mods: { pow: 1, reward: 1, wound: 1, luck: 0 },
      spent: false, phase: 'stage', result: null, grade: null };
    var h3 = GAME.ui.sceneFxHTML(fx3);
    return h3.indexOf('sxf-hero-alias') >= 0 && h3.indexOf('金鳞之约') >= 0
      && h3.indexOf('临湖垂钓') >= 0 && h3.indexOf('不似凡鱼') >= 0
      && /sxf-hero-kind[^>]*>垂纶</.test(h3);
  })());
  check('v89.3：样式与接线齐（.sxf-hero-alias + ui 消费 a.cat / a.alias）', (function () {
    return css3.indexOf('.sxf-hero-alias {') >= 0
      && uS3.indexOf('sxf-hero-alias') >= 0
      && uS3.indexOf('a.cat || ui.SXF_KIND[a.kind]') >= 0;
  })());
})();

"""

if '77. v89.3' in s:
    print('SKIP smoke 已含 §77')
else:
    c = s.count(ANCHOR_S)
    if c != 1:
        raise SystemExit('!! smoke 锚点异常（出现 %d 次）' % c)
    s = s.replace(ANCHOR_S, BLOCK + ANCHOR_S, 1)
    io.open(PS, 'w', encoding='utf-8', newline='').write(s)
    print('OK smoke §77 已写入')

# ---------- e2e ----------
PE = r'E:\Deepseekdb\e2e-test.js'
e = io.open(PE, encoding='utf-8', newline='').read()

OLD_E = ("        && el.textContent.indexOf('第 1 / ' + f.stages.length + ' 幕') >= 0;\n"
         "    })());\n"
         "    click(document.querySelector('#scene-fx [data-action=\"sxf-choice\"]'));")
NEW_E = ("        && el.textContent.indexOf('第 1 / ' + f.stages.length + ' 幕') >= 0;\n"
         "    })());\n"
         "    check('v89.3：横幅文案统一（雅名「古冢探幽」· 门类章「探幽」）', (function () {\n"
         "      const al = document.querySelector('#scene-fx .sxf-hero-alias');\n"
         "      const kd = document.querySelector('#scene-fx .sxf-hero-kind');\n"
         "      return !!al && al.textContent === '古冢探幽' && !!kd && kd.textContent === '探幽';\n"
         "    })());\n"
         "    click(document.querySelector('#scene-fx [data-action=\"sxf-choice\"]'));")

if 'v89.3：横幅文案统一' in e:
    print('SKIP e2e 已含 v89.3 断言')
else:
    c = e.count(OLD_E)
    if c != 1:
        raise SystemExit('!! e2e 锚点异常（出现 %d 次）' % c)
    e = e.replace(OLD_E, NEW_E, 1)
    io.open(PE, 'w', encoding='utf-8', newline='').write(e)
    print('OK e2e v89.3 断言已写入')
