# -*- coding: utf-8 -*-
"""v90.93 批次C2 配套：smoke 口径同步（全屏剧本退役）。"""
import io, os

ROOT = 'E:/Deepseekdb'
FILES = {}

def rd(rel):
    with io.open(os.path.join(ROOT, rel), 'r', encoding='utf-8', newline='') as f:
        return f.read()

def load(rel):
    if rel not in FILES:
        FILES[rel] = rd(rel)

def repl(rel, old, new, cnt=1):
    s = FILES[rel]
    n = s.count(old)
    if n != cnt:
        raise SystemExit('[%s] anchor count = %d (want %d)\n---\n%s\n---' % (rel, n, cnt, old[:400]))
    FILES[rel] = s.replace(old, new)

def cut(rel, start, end, new, cnt=1):
    s = FILES[rel]
    n = s.count(start)
    if n != cnt:
        raise SystemExit('[%s] start count = %d (want %d)\n---\n%s\n---' % (rel, n, cnt, start[:300]))
    i = s.find(start)
    j = s.find(end, i)
    if j < 0:
        raise SystemExit('[%s] end not found after start: %s' % (rel, end[:200]))
    j += len(end)
    tgt = s[i:j]
    if tgt.count(end) != 1:
        raise SystemExit('[%s] end appears %d times inside block' % (rel, tgt.count(end)))
    FILES[rel] = s[:i] + new + s[j:]

load('smoke-test.js')

# ---------- §74①：非君主探索被拒 —— 去掉 sceneStart 引用 ----------
repl('smoke-test.js',
    "    return okBag && !GAME.jianghuDo(p.x, p.y, ng.id, 'cai').ok && !GAME.sceneStart(p.x, p.y, ng.id, 'cai').ok;",
    "    /* v90.93\uff1a\u5168\u5c4f\u5267\u672c\u9000\u5f79 \u2014\u2014 \u975e\u541b\u4e3b\u5728\u300c\u63a2\u7d22\u300d\u4e0a\u540c\u6837\u8d70 jianghuDo\uff08\u95f8\u95e8\u5728 jianghuCheck\uff09\u3002 */\n"
    "    return okBag && !GAME.jianghuDo(p.x, p.y, ng.id, 'cai').ok;")

# ---------- §74② 整段 → 退役守卫 ----------
SEC74B_HEAD = "  console.log('  --- \u2461 \u5168\u5c4f\u5267\u672c\u6570\u636e\u4e0e\u5f15\u64ce ---');\n"
SEC74C_HEAD = "  console.log('  --- \u2462 UI \u6302\u70b9 ---');\n"

NEW74B = """  console.log('  --- \u2461 \u5168\u5c4f\u5267\u672c\uff08v90.93 \u9000\u5f79\u5b88\u536b\uff09 ---');
  /* v90.93\uff08\u8001\u677f\u300c\u53bb\u6389\u7eaa\u4e8b\u5267\u672c\u300d\u4e2d\u7684\u300c\u5168\u5c4f\u5267\u672c\u300d\uff09\uff1a
     \u539f\u672c\u8fd9\u91cc\u7684\u4e09\u6761\u6b63\u5411\u65ad\u8a00\uff08SCENE_FLOW \u8868\u9f50 / \u4e09\u6bb5\u5f15\u64ce / \u53ef\u590d\u73b0\uff09
     \u6309 \u00a70.7 \u7ffb\u8f6c\u4e3a**\u96f6\u6b8b\u7559\u5b88\u536b** + \u4e00\u6761\u300c\u4e00\u6b21\u6027\u7ed3\u7b97\u771f\u8c03\u300d\u5b9e\u6d4b\u3002 */
  check('v90.93\uff1a\u5168\u5c4f\u5267\u672c\u6574\u6761\u9000\u5f79\uff08\u6570\u636e \u00b7 \u5f15\u64ce \u00b7 UI \u00b7 \u52a8\u4f5c \u5168\u6e05\uff09', (function () {
    return DATA.SCENE_FLOW === undefined
      && typeof GAME.sceneFx === 'undefined'
      && typeof GAME.sceneBegin === 'undefined' && typeof GAME.sceneStart === 'undefined'
      && typeof GAME.scenePick === 'undefined' && typeof GAME.sceneEscape === 'undefined'
      && typeof GAME.ui.openSceneFx === 'undefined'
      && typeof GAME.ui.sceneFxHTML === 'undefined'
      && typeof GAME.ui.renderSceneFx === 'undefined'
      && typeof GAME.ui.closeSceneFx === 'undefined'
      && typeof GAME.ui.sxfBadges === 'undefined'
      && typeof GAME.ui.sxfTimingStop === 'undefined'
      && typeof GAME.doScenePick === 'undefined' && typeof GAME.doSceneEscape === 'undefined'
      && typeof GAME.map.paintScene === 'undefined'
      && !/case 'sxf-/.test(stripComment(mS89.slice(0)));
  })());
  check('\u5b9e\u6d4b\uff1a\u8352\u91ce\u6d3b\u52a8\u8d70\u4e00\u6b21\u6027\u7ed3\u7b97\uff08\u5185\u6838\u5b9e\u8c03 \u00b7 \u6263\u8d39/\u843d\u9501/\u7ed3\u679c\u9f50\uff09', (function () {
    var s = GAME.state, lg = GAME.lordGeneralOf();
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === 'forest' && !GAME.map.fortAt(xx, yy)
            && GAME.jianghuActsAt(xx, yy).some(function (k) { return k.id === 'cai'; })) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    s.jianghu = {};
    lg.energy = 100; GAME.setStaNow(lg, 100);
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var r = GAME.jianghuDo(p.x, p.y, lg.id, 'cai');
    if (!r.ok || !r.name || typeof r.text !== 'string' || typeof r.bad !== 'boolean') return false;
    if (lg.energy !== 92) return false;                                 /* \u91c7\u96c6 8\uff1a\u76f4\u63a5\u6263\u8d39 */
    if (!GAME.jianghuDone(s, p.x, p.y, 'cai', day)) return false;       /* \u843d\u9501 */
    return GAME.jianghuDo(p.x, p.y, lg.id, 'cai').ok === false;         /* \u4eca\u65e5\u5df2\u505a \u2192 \u62d2 */
  })());
"""
cut('smoke-test.js', SEC74B_HEAD, SEC74C_HEAD, NEW74B + SEC74C_HEAD)

# ---------- §74③ 第一条检查 → 退役守卫 ----------
repl('smoke-test.js',
"""  check('v89\uff1a\u5168\u5c4f\u5c42\u4e0e\u4e8b\u4ef6\u6302\u70b9\u9f50\uff08#scene-fx \u00b7 \u4e09\u6848\u4ef6 \u00b7 \u515c\u5e95 one-shot \u4fdd\u7559\uff09', (function () {
    return uS89.indexOf('ui.openSceneFx = function') >= 0
      && uS89.indexOf("'scene-fx'") >= 0
      && uS89.indexOf('ui.sceneFxHTML = function') >= 0
      && uS89.indexOf('ui.closeSceneFx = function') >= 0
      && mS89.indexOf("case 'sxf-choice'") >= 0
      && mS89.indexOf("case 'sxf-escape'") >= 0
      && mS89.indexOf("case 'sxf-exit'") >= 0
      && uS89.indexOf('GAME.jianghuDo(x, y, gid, actId)') >= 0;
  })());""",
"""  /* v90.93\uff1a\u539f\u300c\u5168\u5c4f\u5c42\u4e0e\u4e8b\u4ef6\u6302\u70b9\u9f50\u300d\u6b63\u5411\u65ad\u8a00 \u2192 \u9000\u5f79\u5b88\u536b
     \uff08\u5168\u5c4f\u5c42\u4e0e\u4e09\u6848\u4ef6\u5df2\u968f\u5267\u672c\u79fb\u9664\uff1bone-shot \u51fa\u53e3\u4ecd\u5728\u5c97\uff09\u3002 */
  check('v90.93\uff1a\u5168\u5c4f\u5c42\u4e0e\u5267\u672c\u6848\u4ef6\u96f6\u6b8b\u7559\uff08#scene-fx / sxf-* case \u5168\u6e05\uff09', (function () {
    var u = stripComment(uS89.slice(0)), m = stripComment(mS89.slice(0));
    return u.indexOf('scene-fx') < 0 && u.indexOf('ui.openSceneFx = function') < 0
      && m.indexOf('sxf-') < 0
      && u.indexOf('GAME.jianghuDo(x, y, gid, actId)') >= 0;   /* \u5e95\u5c42\u51fa\u53e3\u4fdd\u7559 */
  })());""")

# ---------- §75 整段 → 退役守卫 ----------
SEC75 = "console.log('\\n===== 75. v89.1 \u5267\u672c\u89c6\u89c9\u5316\uff08\u5e55\u666f / \u5e55\u9898 / \u5fbd\u7ae0 / \u7ed3\u7b97\u5361\uff09 =====');\n"
SEC76 = "console.log('\\n===== 76. v89.2 \u573a\u666f\u5316\uff08\u573a\u666f\u753b\u5e03 / \u70ed\u70b9\u70b9\u9009 / \u65f6\u673a\u6761\uff09 =====');\n"
SEC77 = "console.log('\\n===== 77. v89.3 \u6587\u6848\u7edf\u4e00\uff08\u7075\u7269\u5fd7 / \u96c5\u540d / \u95e8\u7c7b\u7ae0\uff09 =====');\n"
SEC78 = "console.log('\\n===== 78. v89.4 \u91ce\u5730\u751f\u6001\uff08\u9010\u5730\u5206\u5e03 \u00b7 \u6982\u7387\u51fa\u73b0 \u00b7 \u7b49\u7ea7\u8054\u52a8\uff09 =====');\n"

NEW75 = """console.log('\\n===== 75. v89.1 \u5267\u672c\u89c6\u89c9\u5316\uff08v90.93 \u968f\u5168\u5c4f\u5267\u672c\u9000\u5f79\uff09 =====');
(function () {
  var hS1 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var css1 = stripComment(hS1.match(/<style[^>]*>([\\s\\S]*?)<\\/style>/)[1]);
  var uS1 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');

  check('v90.93\uff1a\u5267\u672c\u89c6\u89c9\u5316\u6837\u5f0f\u65cf\u6574\u65cf\u79fb\u9664\uff08.sxf-* / #scene-fx / sxf \u52a8\u753b\uff09', (function () {
    var fams = ['.sxf-wrap', '.sxf-hero', '.sxf-narr', '.sxf-opts', '.sxf-bdg',
      '.sxf-result', '.sxf-emblem', '.sxf-loot', '.sxf-cost', '.sxf-scene',
      '.sxf-canvas', '.sxf-spots', '.sxf-sc-tip', '.sxf-timing', '.sxf-tk',
      '.sxf-mark', '.sxf-opt-ic', '.sxf-tl-cap'];
    return fams.every(function (t) { return css1.indexOf(t) < 0; })
      && css1.indexOf('scene-fx') < 0
      && !/@keyframes sxf(In|Pop|Ping)/.test(css1);
  })());
  check('v90.93\uff1a\u5267\u672c UI \u51fa\u53e3\u6574\u65cf\u79fb\u9664\uff08ui.sxf* / *SceneFx / SXF_* \u5e38\u91cf\uff09', (function () {
    var gone = ['sxfBadges', 'sxfQuote', 'sxfOptIcon', 'sxfStageMode', 'sxfTimingGrade',
      'sxfTimingPos', 'sxfTimingStart', 'sxfTimingClear', 'sxfTimingStop',
      'openSceneFx', 'renderSceneFx', 'sceneFxHTML', 'paintSceneFx', 'closeSceneFx'];
    return gone.every(function (k) { return typeof GAME.ui[k] === 'undefined'; })
      && GAME.ui.SXF_KIND === undefined && GAME.ui.SXF_ANCHORS === undefined
      && GAME.ui._sceneFx === undefined
      && stripComment(uS1).indexOf('ui.openSceneFx') < 0;
  })());
})();

"""
cut('smoke-test.js', SEC75, SEC76, NEW75 + SEC76)

NEW76 = """console.log('\\n===== 76. v89.2 \u573a\u666f\u5316\uff08v90.93 \u968f\u5168\u5c4f\u5267\u672c\u9000\u5f79\uff09 =====');
(function () {
  var uS2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var mpS2 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'map.js'), 'utf8');

  check('v90.93\uff1a\u573a\u666f\u753b\u5e03\u51fa\u53e3\u6574\u65cf\u79fb\u9664\uff08paintScene / SCENE_KEYS / SCENE_W|H\uff09', (function () {
    var mp = stripComment(mpS2);
    return GAME.map.paintScene === undefined && GAME.map.SCENE_KEYS === undefined
      && GAME.map.SCENE_W === undefined && GAME.map.SCENE_H === undefined
      && mp.indexOf('SCENE_PAINT') < 0 && mp.indexOf('paintScene') < 0;
  })());
  check('v90.93\uff1a\u65f6\u673a\u6761\u4e0e\u5267\u672c\u52a8\u4f5c\u63a5\u7ebf\u79fb\u9664\uff08case sxf-stop / ui.sxfTimingStop \u96f6\u6b8b\u7559\uff09', (function () {
    var u = stripComment(uS2), m = stripComment(mS2);
    return m.indexOf('sxf-stop') < 0 && m.indexOf('ui.sxfTimingStop') < 0
      && u.indexOf('ui.sxfTimingClear') < 0 && u.indexOf('ui.paintSceneFx') < 0
      && u.indexOf('GAME.map.paintScene') < 0 && u.indexOf('sxf-canvas') < 0;
  })());
})();

"""
cut('smoke-test.js', SEC76, SEC77, NEW76 + SEC77)

NEW77 = """console.log('\\n===== 77. v89.3 \u6587\u6848\u7edf\u4e00\uff08v90.93 \u968f\u5168\u5c4f\u5267\u672c\u9000\u5f79\uff09 =====');
(function () {
  check('v89.3\uff08\u4fdd\u7559\uff09\uff1a\u6d3b\u52a8\u547d\u540d\u53e3\u5f84\uff08\u5730\u5f62\u62db\u724c 4 \u5b57 \u00b7 \u901a\u7528 2 \u5b57\uff09', (function () {
    var keys = ['hill_scene', 'lake_scene', 'zhaoze_scene', 'desert_scene', 'forest_scene', 'caoyuan_scene'];
    return keys.every(function (k) { return DATA.LING_ACT[k] && DATA.LING_ACT[k].name.length === 4; })
      && DATA.LING_ACT.lake_scene.name === '\u4e34\u6e56\u5782\u9493'
      && ['tao', 'qie', 'shi', 'cai', 'xiu', 'bai'].every(function (k) {
        return DATA.LING_ACT[k] && DATA.LING_ACT[k].name.length === 2; });
  })());
  check('v90.93\uff1a\u6a2a\u5e45\u4e13\u5c5e\u6587\u6848\u5c42\u9000\u5f79\uff08cat \u95e8\u7c7b\u7ae0 / alias \u96c5\u540d \u96f6\u6b8b\u7559\uff09', (function () {
    var A = DATA.LING_ACT || {}, keys = Object.keys(A);
    return keys.length === 12 && keys.every(function (k) {
      return A[k].cat === undefined && A[k].alias === undefined;
    }) && DATA.SCENE_FLOW === undefined;
  })());
})();

"""
cut('smoke-test.js', SEC77, SEC78, NEW77 + SEC78)

# ---------- 落盘 ----------
for rel, code in FILES.items():
    old = rd(rel)
    if code == old:
        print('  = %s (no change)' % rel)
        continue
    for b in ['<<<<<<<', '>>>>>>>', '\ufffd']:
        if b in code:
            raise SystemExit('[%s] bad marker %r' % (rel, b))
    tmp = os.path.join(ROOT, rel + '.tmpC2t')
    with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(code)
    os.replace(tmp, os.path.join(ROOT, rel))
    print('  * %s  (%d -> %d chars)' % (rel, len(old), len(code)))

print('patchC2 tests done')
