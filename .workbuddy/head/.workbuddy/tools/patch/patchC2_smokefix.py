# -*- coding: utf-8 -*-
"""v90.93 批次C2：修 smoke 两条越界守卫
  A) §80⑥ 场景机保留面守卫 → 翻转为「保留面在岗 + 退役面零残留」双侧口径
  B) §130② layerRoot 消费处 4→3（第 4 处随全屏剧本退役）+ 加零残留守卫
纪律：备份 → 内存替换 → 锚点 count==1 → 原子写回 → 幂等重跑
"""
import io, os, sys, shutil, time

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'smoke-test.js')
BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.93C')
os.makedirs(BK, exist_ok=True)

src = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(src)

# ---------- 备份（仅首次，不覆盖已有基线） ----------
bk = os.path.join(BK, 'smoke-test.js')
if not os.path.exists(bk):
    shutil.copy2(P, bk)
    print('[backup] %s' % bk)
else:
    print('[backup] 已存在，跳过（保留基线）')

# ---------- A) §80⑥ ----------
OLD_A = """  check('\u00a780\u2465 \u4fdd\u7559\u9762\u5728\u5c97\uff1a\u573a\u666f\u673a\uff08\u8352\u91ce\u6d3b\u52a8\u5171\u7528\uff09\u4e0e\u8352\u91ce\u5f39\u7a97\u4e0d\u53d7\u4f24', (function () {
    return typeof GAME.sceneBegin === 'function' && typeof GAME.sceneStart === 'function'
      && typeof GAME.scenePick === 'function' && typeof GAME.jianghuCheck === 'function'
      && typeof GAME.jianghuRoll === 'function'
      && /ui\\.doJianghu = function/.test(u80);
  })());"""

NEW_A = """  check('\u00a780\u2465 \u4fdd\u7559\u9762\u5728\u5c97\uff1a\u8352\u91ce\u5185\u6838\u4e0e\u8352\u91ce\u5f39\u7a97\u4e0d\u53d7\u4f24\uff08v90.93\uff1a\u573a\u666f\u673a\u968f\u5168\u5c4f\u5267\u672c\u9000\u5f79\uff09', (function () {
    /* v90.93\uff08\u8001\u677f\u300c\u53bb\u6389\u7eaa\u4e8b\u5267\u672c\u300d\u4e2d\u7684\u300c\u5168\u5c4f\u5267\u672c\u300d\uff09\uff1a\u539f\u5171\u7528\u9762\u300c\u573a\u666f\u673a\u300d\u4e09\u51fa\u53e3\u5df2\u968f\u5267\u672c\u6574\u6761\u9000\u5f79\uff0c
       \u672c\u5b88\u536b\u6309 \u00a70.7 \u7ffb\u8f6c\u4e3a**\u53cc\u4fa7\u53e3\u5f84** \u2014\u2014 \u4fdd\u7559\u9762\u5728\u5c97\uff08\u8352\u91ce\u5185\u6838 + \u5f39\u7a97\u5165\u53e3\uff09 + \u9000\u5f79\u9762\u96f6\u6b8b\u7559\u3002 */
    return typeof GAME.jianghuCheck === 'function' && typeof GAME.jianghuRoll === 'function'
      && typeof GAME.jianghuDo === 'function'
      && typeof GAME.sceneBegin === 'undefined' && typeof GAME.sceneStart === 'undefined'
      && typeof GAME.scenePick === 'undefined' && typeof GAME.sceneEscape === 'undefined'
      && typeof GAME.sceneFx === 'undefined'
      && /ui\\.doJianghu = function/.test(u80);
  })());"""

# ---------- B) §130② ----------
OLD_B = """    check('\u00a7130\u2461 \u6d6e\u5c42\u6362\u7b97\u51fa\u53e3\uff08toCanvasXY / layerRoot / canvasSize\uff09+ \u52a8\u6001\u5c42\u6302\u753b\u5e03\u5750\u6807\u7cfb', (function () {
      var ok = /ui\\.toCanvasXY = function/.test(u130) && /ui\\.layerRoot = function/.test(u130)
        && /ui\\.canvasSize = function/.test(u130) && /GAME\\.appKOf = function/.test(m130c);
      var okUse = (u130.match(/ui\\.layerRoot\\(\\)/g) || []).length >= 4
        && /ui\\.toCanvasXY\\(r\\.left \\+ r\\.width \\/ 2, r\\.top\\)/.test(u130);
      var okMap = /GAME\\.appKOf \\? GAME\\.appKOf\\(\\) : 1/.test(fs130.readFileSync(p130.join(__dirname, 'js', 'map.js'), 'utf8'));
      _r130b = '\u51fa\u53e3' + (ok ? '\u2713' : '\u2717') + ' \u6d88\u8d39' + (u130.match(/ui\\.layerRoot\\(\\)/g) || []).length + '\u5904 \u00b7 map ' + (okMap ? '\u2713' : '\u2717');
      return ok && okUse && okMap;
    })(), _r130b);"""

NEW_B = """    check('\u00a7130\u2461 \u6d6e\u5c42\u6362\u7b97\u51fa\u53e3\uff08toCanvasXY / layerRoot / canvasSize\uff09+ \u52a8\u6001\u5c42\u6302\u753b\u5e03\u5750\u6807\u7cfb\uff08v90.93\uff1a\u5267\u672c\u6d6e\u5c42\u9000\u5f79 \u00b7 \u6d88\u8d39 4\u21923\uff09', (function () {
      var ok = /ui\\.toCanvasXY = function/.test(u130) && /ui\\.layerRoot = function/.test(u130)
        && /ui\\.canvasSize = function/.test(u130) && /GAME\\.appKOf = function/.test(m130c);
      /* v90.93\uff1a\u7b2c 4 \u4e2a\u6d88\u8d39\u70b9\u539f\u5728\u5168\u5c4f\u5267\u672c\u753b\u5e03\u5c42\uff08ui.renderSceneFx\uff09\uff0c\u968f\u5267\u672c\u6574\u6761\u9000\u5f79 \u2192 \u4e0b\u9650 4\u21923\uff1b
         \u540c\u6b65\u52a0\u300c\u9000\u5f79\u9762\u96f6\u6b8b\u7559\u300d\u5b88\u536b\uff0c\u9632\u6b62\u95e8\u69db\u88ab\u65e0\u58f0\u653e\u6c34\u3002 */
      var useN = (u130.match(/ui\\.layerRoot\\(\\)/g) || []).length;
      var okUse = useN >= 3
        && /ui\\.toCanvasXY\\(r\\.left \\+ r\\.width \\/ 2, r\\.top\\)/.test(u130)
        && stripComment(u130).indexOf('renderSceneFx') < 0;
      var okMap = /GAME\\.appKOf \\? GAME\\.appKOf\\(\\) : 1/.test(fs130.readFileSync(p130.join(__dirname, 'js', 'map.js'), 'utf8'));
      _r130b = '\u51fa\u53e3' + (ok ? '\u2713' : '\u2717') + ' \u6d88\u8d39' + useN + '\u5904 \u00b7 map ' + (okMap ? '\u2713' : '\u2717');
      return ok && okUse && okMap;
    })(), _r130b);"""

changed = 0
for name, old, new in (('A', OLD_A, NEW_A), ('B', OLD_B, NEW_B)):
    c = src.count(old)
    if c == 0:
        if new in src:
            print('[%s] 已是新口径，幂等跳过' % name)
            continue
        print('[%s] !! 锚点未命中 count=0 —— 中止' % name); sys.exit(2)
    if c != 1:
        print('[%s] !! 锚点不唯一 count=%d —— 中止' % (name, c)); sys.exit(3)
    src = src.replace(old, new, 1)
    changed += 1
    print('[%s] 替换 1 处' % name)

if changed == 0:
    print('无改动，退出'); sys.exit(0)

# ---------- 原子写回 ----------
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(src)
os.replace(tmp, P)
print('[write] ok  %d -> %d 字节' % (n0, len(src)))
