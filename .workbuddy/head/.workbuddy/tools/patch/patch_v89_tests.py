# -*- coding: utf-8 -*-
"""v89 测试（smoke-test.js）：§73 君主化（generals[0] -> 君主） + §74 新段（君主闸门 + 全屏剧本）。探针幂等。"""
import io

P = r'E:\Deepseekdb\smoke-test.js'
d = io.open(P, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in d[:4000] else '\n'

def sub(old, new, tag, probe):
    global d
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, tag + ' 锚点命中 %d 次' % c
    d = d.replace(old, new, 1)
    print('OK ' + tag)

# ---- §73② 换君主 + 清袋建基线 ----
sub(r"""  check('实测：切换分流（军装 atk960 / 修炼 atk420）· 百次切换不丢件', (function () {
    var s = GAME.state, g = s.generals[0];
    if (!g) return false;""",
r"""  check('实测：切换分流（君主 · 军装 atk960 / 修炼 atk420）· 百次切换不丢件', (function () {
    var s = GAME.state, g = GAME.lordGeneralOf();   /* v89：修炼线君主专属 */
    if (!g) return false;
    g.equip = {}; g.lingEquip = {}; g.equipOn = 'sha';   /* 本节为最后一节：清零建基线 */""",
    'T1 §73② 换君主', '/* v89：修炼线君主专属 */')

# ---- §73③ 换君主 ----
sub(r"""  check('实测：+1 扣 20 精华 · 灵力 130->140 · 六维 x1.08 · 防护', (function () {
    var s = GAME.state, g = s.generals[0];""",
r"""  check('实测：+1 扣 20 精华 · 灵力 130->140 · 六维 x1.08 · 防护', (function () {
    var s = GAME.state, g = GAME.lordGeneralOf();   /* v89：蕴养君主专属 */""",
    'T2 §73③ 换君主', '/* v89：蕴养君主专属 */')

# ---- §73④ 换君主 ----
sub(r"""  check('实测：地形矩阵（森林无切磋按钮）· 执行产精华 · 每日锁 · 种子化复现', (function () {
    var s = GAME.state, gen = s.generals[0];""",
r"""  check('实测：地形矩阵（森林无切磋按钮）· 执行产精华 · 每日锁 · 种子化复现', (function () {
    var s = GAME.state, gen = GAME.lordGeneralOf();   /* v89：游历君主专属 */""",
    'T3 §73④ 换君主', '/* v89：游历君主专属 */')

# ---- §74 追加 ----
SEC74 = r"""console.log('\n===== 74. v89 君主专属 + 全屏江湖剧本 =====');
(function () {
  var uS89 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS89 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var syS89 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8');

  console.log('  --- ① 君主闸门（唯一出口） ---');
  check('v89：canCultivate 唯一闸门 · 装备袋/切换/游历三链引用', (function () {
    if (!GAME.canCultivate || !GAME.canCultivate(GAME.lordGeneralOf())) return false;
    var ng0 = null;
    GAME.state.generals.forEach(function (g) { if (!ng0 && !GAME.isLordGeneral(g)) ng0 = g; });
    if (!ng0 || GAME.canCultivate(ng0)) return false;
    var stS = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
    return syS89.indexOf('GAME.canCultivate(g)') >= 0
      && stS.indexOf('GAME.canCultivate(g)') >= 0
      && stS.indexOf('GAME.canCultivate(gen)') >= 0;
  })());
  check('实测：非君主三拒（切换/穿修炼件）· 装备袋恒军装 · 游历被拒', (function () {
    var s = GAME.state, ng = null;
    s.generals.forEach(function (g) { if (!ng && !GAME.isLordGeneral(g)) ng = g; });
    if (!ng) return false;
    if (GAME.toggleEquipSet(ng.id, 'ling').ok) return false;
    var eI = GAME.addEquip('lg_weapon_1', 0);
    if (GAME.systems.equipItem(ng.id, eI).ok) return false;
    ng.equipOn = 'ling';   /* 旧档残留兜底 */
    var okBag = (GAME.systems.equipBagOf(ng) === (ng.equip || {}));
    ng.equipOn = 'sha';
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'forest' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    return okBag && !GAME.jianghuDo(p.x, p.y, ng.id, 'cai').ok && !GAME.sceneStart(p.x, p.y, ng.id, 'cai').ok;
  })());
  check('实测：迁移归还（非君主灵气件 → 背包 · 归位军装）', (function () {
    var s = GAME.state, ng = null;
    s.generals.forEach(function (g) { if (!ng && !GAME.isLordGeneral(g)) ng = g; });
    if (!ng) return false;
    var mI = GAME.addEquip('lg_chest_2', 0);
    ng.lingEquip = { chest: mI };
    ng.equipOn = 'ling';
    s.inventory = (s.inventory || []).filter(function (x) { return x !== mI; });
    s._lingLord1 = 0;
    GAME.migrateLordLing(s);
    return (s.inventory || []).indexOf(mI) >= 0 && !ng.lingEquip && ng.equipOn === 'sha';
  })());

  console.log('  --- ② 全屏剧本数据与引擎 ---');
  check('v89：SCENE_FLOW 齐（12 活动 · 幕≥2 · 选项/退出/文案齐全 · 键合法）', (function () {
    var F = DATA.SCENE_FLOW || {};
    var keys = Object.keys(DATA.LING_ACT || {});
    if (keys.length !== 12) return false;
    var n = 0;
    for (var i = 0; i < keys.length; i++) {
      var f = F[keys[i]];
      if (!f || !f.escLabel || !f.backLabel || !f.exits || !f.exits.win || !f.exits.escape) return false;
      if (!f.stages || f.stages.length < 2) return false;
      n++;
      for (var j = 0; j < f.stages.length; j++) {
        var st2 = f.stages[j];
        if (!st2.t || !st2.o || !st2.o.length) return false;
        for (var k2 = 0; k2 < st2.o.length; k2++) {
          var o = st2.o[k2];
          if (!o.l) return false;
          for (var ek in (o.e || {})) {
            if (['pow', 'reward', 'wound', 'luck'].indexOf(ek) < 0) return false;
          }
        }
      }
    }
    return n === 12;
  })());
  check('实测：三段引擎（未选不扣 · 首选定扣 · 末幕结算 grade · 锁落地）', (function () {
    var s = GAME.state, lg = GAME.lordGeneralOf();
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'forest' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    s.jianghu = {};
    lg.energy = 100; GAME.setStaNow(lg, 100);
    var st0 = GAME.sceneStart(p.x, p.y, lg.id, 'cai');
    if (!st0.ok || !st0.fx || lg.energy !== 100) return false;
    var esc = GAME.sceneEscape();
    if (!esc.ok || !GAME.sceneFx.result.escaped || lg.energy !== 100) return false;   /* 未动身：免费 */
    if (GAME.jianghuDone(s, p.x, p.y, 'cai', st0.fx.chk.day)) return false;          /* 且不落锁 */
    GAME.sceneFx = null;
    var st1 = GAME.sceneStart(p.x, p.y, lg.id, 'cai');
    if (!GAME.scenePick(0).ok || lg.energy !== 92) return false;                     /* 首选定扣（采集 8） */
    GAME.scenePick(0);
    var st3 = GAME.scenePick(0);
    var fx = GAME.sceneFx;
    if (!st3.resolved || fx.phase !== 'result' || !fx.result || !fx.result.grade) return false;
    if (['win', 'partial', 'lose'].indexOf(fx.grade) < 0) return false;
    if (!GAME.jianghuDone(s, p.x, p.y, 'cai', st1.fx.chk.day)) return false;         /* 结算后锁在 */
    GAME.sceneFx = null;
    return true;
  })());
  check('实测：可复现（同选择同结果）+ 选择累计修正 + 已动身退出计入', (function () {
    var s = GAME.state, lg = GAME.lordGeneralOf();
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'hill' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    var run = function (picks) {
      s.jianghu = {};
      lg.energy = 100; GAME.setStaNow(lg, 100);
      GAME.sceneStart(p.x, p.y, lg.id, 'tao');
      picks.forEach(function (i) { GAME.scenePick(i); });
      var fx = GAME.sceneFx;
      var out = { name: fx.result.name, text: fx.result.text, mods: JSON.stringify(fx.mods) };
      GAME.sceneFx = null;
      return out;
    };
    var a = run([0, 0, 0]);
    var b = run([0, 0, 0]);
    if (a.name !== b.name || a.text !== b.text) return false;
    var c = run([0, 1, 0]);
    if (!(JSON.parse(c.mods).pow > JSON.parse(a.mods).pow)) return false;
    s.jianghu = {};
    lg.energy = 100; GAME.setStaNow(lg, 100);
    GAME.sceneStart(p.x, p.y, lg.id, 'tao');
    GAME.scenePick(0);
    var eMid = lg.energy;
    GAME.sceneEscape();
    if (lg.energy !== eMid) return false;                                            /* 所耗不返 */
    if (!GAME.jianghuDone(s, p.x, p.y, 'tao', GAME.sceneFx.chk.day)) return false;   /* 今日计入 */
    GAME.sceneFx = null;
    return true;
  })());

  console.log('  --- ③ UI 挂点 ---');
  check('v89：全屏层与事件挂点齐（#scene-fx · 三案件 · 兜底 one-shot 保留）', (function () {
    return uS89.indexOf('ui.openSceneFx = function') >= 0
      && uS89.indexOf("'scene-fx'") >= 0
      && uS89.indexOf('ui.sceneFxHTML = function') >= 0
      && uS89.indexOf('ui.closeSceneFx = function') >= 0
      && mS89.indexOf("case 'sxf-choice'") >= 0
      && mS89.indexOf("case 'sxf-escape'") >= 0
      && mS89.indexOf("case 'sxf-exit'") >= 0
      && uS89.indexOf('GAME.jianghuDo(x, y, gid, actId)') >= 0;
  })());
  check('v89：君主专属 UI 收口（切换行只给君主 · 非君主文案 · 蕴养闸门）', (function () {
    return uS89.indexOf('var isCult = GAME.canCultivate(g);') >= 0
      && uS89.indexOf('修炼一途乃君主专属，钦定不假他人。') >= 0
      && uS89.indexOf('君主亲往') >= 0
      && uS89.indexOf('君主不在，无从蕴养') >= 0;
  })());
})();

"""

ANCHOR = r"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
c = d.count(ANCHOR)
assert c == 1, '文件尾锚点命中 %d 次' % c
if '===== 74.' in d:
    print('SKIP §74 已存在')
else:
    d = d.replace(ANCHOR, SEC74.replace('\n', NL) + ANCHOR, 1)
    print('OK §74 已写入')

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('全部完成。')

# ---- 备注：§72 绿林探访段与 §73② 灵力独立段亦同步换角君主（v89）----
