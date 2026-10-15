# -*- coding: utf-8 -*-
"""v90.93 批次C2：全屏剧本（荒野场景流程）整条退役。"""
import io, os, re

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

TOMB = ("  /* \u26d4 v90.93 \u9000\u5f79\uff1a**\u5168\u5c4f\u5267\u672c**\uff08\u8352\u91ce\u573a\u666f\u6d41\u7a0b\uff09\u6574\u6761 \u2014\u2014\n"
        "     \u8001\u677f\u300c\u53bb\u6389\u7eaa\u4e8b\u5267\u672c\u300d\u4e2d\u7684\u300c\u5168\u5c4f\u5267\u672c\u300d\u3002\n"
        "     \u73b0\u884c\u53e3\u5f84\uff1a\u8352\u91ce\u6d3b\u52a8\u6309\u94ae \u2192 **\u4e00\u6b21\u6027\u7ed3\u7b97**\uff08one-shot\uff0cui.doJianghu\uff09\u3002\n"
        "     \u5185\u6838\uff08jianghuCheck / jianghuSpend / jianghuRoll\uff09\u539f\u6837\u4fdd\u7559 \u2014\u2014\n"
        "     \u4e00\u6b21\u6027\u7ed3\u7b97\u672c\u5c31\u662f\u5b83\u539f\u672c\u5c31\u6709\u7684\u300c\u65e0\u5267\u672c\u515c\u5e95\u300d\u51fa\u53e3\u3002 */\n")

# ============================================================
# 1) js/data.js —— 删 DATA.SCENE_FLOW + LING_ACT 的 cat/alias
# ============================================================
load('js/data.js')
cut('js/data.js',
    "/* ============================================================\n   * v89 \u00b7 \u5168\u5c4f\u8352\u91ce\u573a\u666f\u5267\u672c\uff08\u8001\u677f\uff1a\u300c\u4e13\u5c5e\u5168\u5c4f\u4ea4\u4e92 + \u7279\u5b9a\u9000\u51fa\u300d\uff09\n",
    "        escape:  { ic: '\U0001f40e', t: '\u52d2\u9a6c\u56de\u57ce', s: '\u98ce\u5411\u4e0d\u5bf9\uff0c\u4e0d\u4e0e\u826f\u9a79\u8f83\u52b2' } } },\n  };\n",
    "/* \u26d4 v90.93 \u9000\u5f79\uff1a`DATA.SCENE_FLOW`\uff08v89 \u5168\u5c4f\u8352\u91ce\u573a\u666f\u5267\u672c\uff0c12 \u6d3b\u52a8 \u00d7 2~3 \u5e55\uff09\u6574\u65cf\u6e05\u9664 \u2014\u2014\n"
    "   \u8001\u677f\u300c\u53bb\u6389\u7eaa\u4e8b\u5267\u672c\u300d\u4e2d\u7684\u300c\u5168\u5c4f\u5267\u672c\u300d\u3002\n"
    "   \u6d88\u8d39\u9762\uff08state.js \u7684 sceneBegin / sceneStart / scenePick / sceneEscape\uff1bui.js \u7684\n"
    "   openSceneFx / renderSceneFx / sceneFxHTML / sxf* \u5168\u65cf\uff1bmain.js \u7684\u56db\u4e2a case\uff09\u5df2\u540c\u6b65\u79fb\u9664\u3002\n"
    "   \u8352\u91ce\u6d3b\u52a8\u672c\u4f53\uff08DATA.LING_ACT / JH_SPREAD / JH_MARK\uff09\u4e0e\u5185\u6838\n"
    "   \uff08GAME.jianghuCheck / jianghuSpend / jianghuRoll\uff09**\u539f\u6837\u4fdd\u7559**\u3002 */\n")

# LING_ACT 的 cat / alias（v89.3 为全屏横幅引入，横幅退役后成孤儿字段）
_n = len(re.findall(r"cat: '[^']*', alias: '[^']*', ", FILES['js/data.js']))
if _n != 12:
    raise SystemExit('LING_ACT cat/alias count = %d (want 12)' % _n)
FILES['js/data.js'] = re.sub(r"cat: '[^']*', alias: '[^']*', ", "", FILES['js/data.js'])
FILES['js/data.js'] = FILES['js/data.js'].replace(
    "    /* ---- \u5730\u5f62\u4e13\u5c5e\uff08v87\u300c\u91ce\u5730\u4e13\u5c5e\u573a\u666f\u300d-> v88.1 \u6574\u5408\uff1a\u4ece WILD_SCENES \u539f\u6837\u5e76\u5165\uff09----\n",
    "    /* ---- \u5730\u5f62\u4e13\u5c5e\uff08v87\u300c\u91ce\u5730\u4e13\u5c5e\u573a\u666f\u300d-> v88.1 \u6574\u5408\uff1a\u4ece WILD_SCENES \u539f\u6837\u5e76\u5165\uff09----\n"
    "       \u26d4 v90.93\uff1a\u5404\u6761\u7684 `cat`\uff08\u95e8\u7c7b\u7ae0\uff09\u4e0e `alias`\uff08\u96c5\u540d\uff09\u4e24\u5b57\u6bb5\u968f\u5168\u5c4f\u5267\u672c\u9000\u5f79\n"
    "       \uff08\u5b83\u4eec\u53ea\u5728\u5e55\u666f\u6a2a\u5e45\u91cc\u88ab\u8bfb\uff0c\u60ac\u7a7a\u6570\u636e\u4e0d\u7559\uff09\u3002 */\n")

# ============================================================
# 2) js/state.js —— 删 GAME.sceneFx / sceneBegin / sceneStart / scenePick / sceneEscape
# ============================================================
load('js/state.js')
cut('js/state.js',
    "  /* --------- v89 \u00b7 \u5168\u5c4f\u8352\u91ce\u573a\u666f\u6d41\u7a0b\uff08\u8001\u677f\uff1a\u300c\u4e13\u5c5e\u5168\u5c4f\u754c\u9762 + \u7279\u5b9a\u9000\u51fa\u300d\uff09 --------- */\n",
    "    fx.result = { ok: true, name: fx.fly.escLabel || '\u5c31\u6b64\u79bb\u53bb', text: '', bad: true, escaped: true, grade: 'escape' };\n    return { ok: true, fx: fx };\n  };\n",
    TOMB)

# ============================================================
# 3) js/ui.js —— doJianghu 收敛为 one-shot；其余全屏剧本 UI 整段移除
# ============================================================
load('js/ui.js')
OLD_UI = """  /* v89\uff08\u8001\u677f\uff09\uff1a\u300c\u4e3a\u6bcf\u9879\u6d3b\u52a8\u505a\u4e13\u5c5e\u5168\u5c4f\u4ea4\u4e92\u754c\u9762 + \u7279\u5b9a\u9000\u51fa\u300d\u2014\u2014
     \u6d3b\u52a8\u6309\u94ae \u2192 \u5168\u5c4f\u5267\u672c\uff08\u5bf9\u8bdd / \u4e8b\u4ef6 2~3 \u5e55\uff09\u2192 \u4e13\u5c5e\u9000\u51fa\u7ed3\u7b97\u5c4f\u3002
     \u5168\u5c4f\u5c42 #scene-fx \u6302\u5728 body \u4e0a\uff08z=1500\uff1a\u9ad8\u4e8e\u5f39\u7a97 1000\u3001\u4f4e\u4e8e toast 2000\uff09\uff0c
     \u4e0d\u5360 modal-root \u2014\u2014 \u5f39\u7a97\u662f\u5355\u6839\u66ff\u6362\u7cfb\u7edf\uff0c\u4e24\u8005\u4e92\u4e0d\u5e72\u6270\u3002 */
  ui._sceneFx = null;
  ui.doJianghu = function (x, y, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var lg = GAME.lordGeneralOf();       /* v89\uff1a\u541b\u4e3b\u4e13\u5c5e\uff08\u95f8\u95e8\u5728 jianghuCheck\uff0c\u8fd9\u91cc\u4fbf\u4e8e\u515c\u5e95\uff09 */
    if (lg && (!gid || gid !== lg.id)) gid = lg.id;
    if (!(DATA.SCENE_FLOW || {})[actId]) {
      /* \u65e0\u5267\u672c\u515c\u5e95\uff08\u672a\u6765\u65b0\u589e\u6d3b\u52a8\uff09\uff1a\u76f4\u63a5\u4e00\u6b21\u6027\u7ed3\u7b97 \u2014\u2014 one-shot \u51fa\u53e3\u4fdd\u7559 */
      var r0 = GAME.jianghuDo(x, y, gid, actId);
      if (!r0.ok) { ui.toast(r0.msg); return; }
      ui._jhResult = { xy: x + ',' + y, name: r0.name, text: r0.text, bad: r0.bad };
      ui.toast('\u262f ' + r0.name + (r0.text ? '\uff08' + r0.text + '\uff09' : ''));
      GAME.refreshAll();
      ui.openLandModal(x, y);
      return;
    }
    var r = GAME.sceneStart(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('\u5267\u672c\u7f3a\u5931'); return; }
    ui.openSceneFx(r.fx);
  };
"""
NEW_UI = """  /* v90.93\uff08\u8001\u677f\u300c\u53bb\u6389\u7eaa\u4e8b\u5267\u672c\u300d\u4e2d\u7684\u300c\u5168\u5c4f\u5267\u672c\u300d\uff09\uff1a
     \u6d3b\u52a8\u6309\u94ae \u2192 **\u4e00\u6b21\u6027\u7ed3\u7b97**\uff08one-shot\uff09\u3002
     \u539f\u300c\u4e13\u5c5e\u5168\u5c4f\u4ea4\u4e92 + \u7279\u5b9a\u9000\u51fa\u300d\u7684\u5168\u5c4f\u5267\u672c\uff08#scene-fx\uff1a2~3 \u5e55\u5bf9\u8bdd /
     \u9009\u62e9\u7d2f\u8ba1\u4fee\u6b63\u7cfb\u6570 / \u573a\u666f\u753b\u5e03\u4e0e\u70ed\u70b9 / \u65f6\u673a\u6761 / \u4e13\u5c5e\u7ed3\u7b97\u5c4f\uff09\u6574\u6761\u9000\u5f79\uff1a
       \u00b7 ui\uff1a_sceneFx / openSceneFx / renderSceneFx / closeSceneFx / sceneFxHTML /
         paintSceneFx / sxfBadges / sxfQuote / sxfOptIcon / SXF_KIND / SXF_ANCHORS /
         sxfStageMode / sxfTimingGrade / sxfTimingPos / sxfTimingStart /
         sxfTimingClear / sxfTimingStop\uff08\u4e0e .sxf-* \u6837\u5f0f\u65cf\u3001#scene-fx \u5168\u5c4f\u5c42\uff09\uff1b
       \u00b7 \u5f15\u64ce\uff1aGAME.sceneFx / sceneBegin / sceneStart / scenePick / sceneEscape\uff1b
       \u00b7 \u6570\u636e\uff1aDATA.SCENE_FLOW\uff1b\u5730\u56fe\uff1aGAME.map.paintScene / SCENE_KEYS\u3002
     \u5185\u6838\uff08jianghuCheck / jianghuSpend / jianghuRoll\uff09\u539f\u6837\u4fdd\u7559 \u2014\u2014
     \u4e0b\u9762\u8fd9\u6bb5\u5c31\u662f\u5b83\u539f\u672c\u5c31\u6709\u7684\u300c\u65e0\u5267\u672c\u515c\u5e95\u300d\u51fa\u53e3\u3002 */
  ui.doJianghu = function (x, y, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var lg = GAME.lordGeneralOf();       /* v89\uff1a\u541b\u4e3b\u4e13\u5c5e\uff08\u95f8\u95e8\u5728 jianghuCheck\uff0c\u8fd9\u91cc\u4fbf\u4e8e\u515c\u5e95\uff09 */
    if (lg && (!gid || gid !== lg.id)) gid = lg.id;
    var r0 = GAME.jianghuDo(x, y, gid, actId);
    if (!r0.ok) { ui.toast(r0.msg); return; }
    ui._jhResult = { xy: x + ',' + y, name: r0.name, text: r0.text, bad: r0.bad };
    ui.toast('\u262f ' + r0.name + (r0.text ? '\uff08' + r0.text + '\uff09' : ''));
    GAME.refreshAll();
    ui.openLandModal(x, y);
  };
  /* \u26d4 v90.80\uff1aui.doWonder\uff08\u63a2\u5947\uff09\u968f\u5947\u9047\u7cfb\u7edf\u6574\u6761\u9000\u5f79\u3002 */
"""
repl('js/ui.js', OLD_UI, NEW_UI)

cut('js/ui.js',
    "  ui.openSceneFx = function (fx) { ui._sceneFx = fx; ui.renderSceneFx(); };\n",
    "    ui.openLandModal(fx.chk.x, fx.chk.y);   /* \u539f\u5730\u56de\u91ce\u5730\u5f39\u7a97\uff08\u663e\u793a\u7ed3\u679c\u4e0e\u300c\u4eca\u65e5\u5df2\u505a\u300d\uff09 */\n  };\n",
    "")

# ============================================================
# 4) js/main.js —— 删四个 case + doScenePick / doSceneEscape
# ============================================================
load('js/main.js')
repl('js/main.js',
    "      /* v89\uff1a\u5168\u5c4f\u8352\u91ce\u5267\u672c\uff08\u9009\u62e9 / \u4e2d\u9014\u9000\u51fa / \u6536\u5c3e\u5173\u95ed\uff09 */\n"
    "      case 'sxf-choice': GAME.doScenePick(Number(el.dataset.i)); break;\n"
    "      case 'sxf-escape': GAME.doSceneEscape(); break;\n"
    "      case 'sxf-stop': ui.sxfTimingStop(); break;   /* v89.2\uff1a\u65f6\u673a\u6761\u505c\u624b */\n"
    "      case 'sxf-exit': ui.closeSceneFx(); break;\n",
    "      /* \u26d4 v90.93\uff1acase sxf-choice / sxf-escape / sxf-stop / sxf-exit\n"
    "         \u968f\u5168\u5c4f\u5267\u672c\uff08\u8352\u91ce\u573a\u666f\u6d41\u7a0b\uff09\u6574\u6761\u9000\u5f79\uff08\u89c1 ui.doJianghu \u540c\u6b3e\u5893\u7891\uff09\u3002 */\n")

repl('js/main.js',
    "  /* v89\uff1a\u5168\u5c4f\u5267\u672c \u2014\u2014 \u9009\u62e9 / \u4e2d\u9014\u9000\u51fa\uff08\u7ed3\u7b97\u5c4f\u7531 ui.renderSceneFx \u5c31\u5730\u91cd\u7ed8\uff09 */\n"
    "  GAME.doScenePick = function (i) {\n"
    "    var r = GAME.scenePick(i);\n"
    "    if (!r.ok) { if (r.msg) ui.toast(r.msg); return; }\n"
    "    ui.renderSceneFx();\n"
    "  };\n"
    "  GAME.doSceneEscape = function () {\n"
    "    var r = GAME.sceneEscape();\n"
    "    if (!r.ok) { if (r.msg) ui.toast(r.msg); return; }\n"
    "    ui.renderSceneFx();\n"
    "  };\n",
    "  /* \u26d4 v90.93\uff1aGAME.doScenePick / GAME.doSceneEscape\uff08\u5168\u5c4f\u5267\u672c\u7684\u9009\u62e9\u4e0e\u4e2d\u9014\u9000\u51fa\uff09\n"
    "     \u968f\u5168\u5c4f\u5267\u672c\u6574\u6761\u9000\u5f79 \u2014\u2014 \u8352\u91ce\u6d3b\u52a8\u73b0\u8d70 ui.doJianghu \u7684\u4e00\u6b21\u6027\u7ed3\u7b97\u3002 */\n")

# ============================================================
# 5) js/map.js —— 删场景插画（paintScene / SCENE_KEYS / SCENE_PAINT 全族）
# ============================================================
load('js/map.js')
cut('js/map.js',
    "  /* ============================================================\n   * v89.2\uff1a**\u573a\u666f\u63d2\u753b**\uff08\u8001\u677f\u300c\u6211\u60f3\u770b\u89c1\u4e2a\u6e56\uff0c\u800c\u4e0d\u662f\u4e00\u884c\u5b57\u300d\uff09\n",
    "  GAME.map.SCENE_W = SCENE_W;\n  GAME.map.SCENE_H = SCENE_H;\n",
    "  /* \u26d4 v90.93 \u9000\u5f79\uff1a\u573a\u666f\u63d2\u753b\uff08v89.2\uff09\u2014\u2014 `GAME.map.paintScene` / `SCENE_KEYS` /\n"
    "     `SCENE_W` / `SCENE_H` \u4e0e\u5185\u90e8 `SCENE_PAINT`\uff0812 \u5e45\u7a0b\u5e8f\u5316\u98ce\u666f\uff09\u3001\u65d7\u5e1c\u539f\u8bed `sFlag`\n"
    "     \u4e00\u5e76\u5220\u9664\uff1a\u5b83\u4eec\u53ea\u4f9b `ui.paintSceneFx`\uff08\u5168\u5c4f\u5267\u672c\u753b\u5e03\uff09\u8c03\u7528\uff0c\n"
    "     \u968f\u5168\u5c4f\u5267\u672c\u9000\u5f79\u540e\u6210\u4e3a\u65e0\u5f15\u7528\u6b7b\u4ee3\u7801\u3002 */\n")

# ============================================================
# 6) index.html —— 删 .sxf-* 样式族
# ============================================================
load('index.html')
cut('index.html',
    "  /* ---------- v89.1 \u5168\u5c4f\u5267\u672c\u89c6\u89c9\u5316\uff08\u5e55\u666f\u6a2a\u5e45 / \u5e55\u9898 / \u5fbd\u7ae0 / \u7ed3\u7b97\u5361\uff09 ---------- */\n",
    "    100% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb), 0), 0 2px 6px rgba(var(--sh-rgb), .5); }\n  }\n",
    "  /* \u26d4 v90.93 \u9000\u5f79\uff1a\u5168\u5c4f\u5267\u672c\u89c6\u89c9\u5316\u6837\u5f0f\u6574\u65cf \u2014\u2014\n"
    "     .sxf-wrap / .sxf-hero* / .sxf-timeline / .sxf-stage* / .sxf-narr / .sxf-q / .sxf-opts /\n"
    "     .sxf-opt* / .sxf-bdg / .sxf-note / .sxf-result / .sxf-emblem / .sxf-exit* / .sxf-loot* /\n"
    "     .sxf-cost / .sxf-scene / .sxf-canvas / .sxf-spots / .sxf-spot* / .sxf-sc-tip /\n"
    "     .sxf-timing / .sxf-tk / .sxf-zone* / .sxf-mark / .sxf-tm* / @keyframes sxfIn|sxfPop|sxfPing\n"
    "     \u4e0e #scene-fx \u5168\u5c4f\u5c42\u4e00\u5e76\u6e05\u9664\uff08\u8001\u677f\u300c\u53bb\u6389\u7eaa\u4e8b\u5267\u672c\u300d\u4e2d\u7684\u300c\u5168\u5c4f\u5267\u672c\u300d\uff09\u3002 */\n")

# ============================================================
# 落盘
# ============================================================
def check(code, rel):
    for b in ['<<<<<<<', '>>>>>>>', '\ufffd']:
        if b in code:
            raise SystemExit('[%s] bad marker %r' % (rel, b))

for rel, code in FILES.items():
    old = rd(rel)
    if code == old:
        print('  = %s (no change)' % rel)
        continue
    check(code, rel)
    tmp = os.path.join(ROOT, rel + '.tmpC2')
    with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(code)
    os.replace(tmp, os.path.join(ROOT, rel))
    print('  * %s  (%d -> %d chars)' % (rel, len(old), len(code)))

print('patchC2 core done')
