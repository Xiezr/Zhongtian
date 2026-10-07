# -*- coding: utf-8 -*-
"""v89.224b5：smoke 10 失败修复 + SHOP_CATS seed 页签退役。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b5'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)
def rep(f, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    assert c == cnt, '[%s] 锚点计数 %d != %d :: %r' % (f, c, cnt, old[:80])
    wr(f, s.replace(old, new))
    LOG.append('%s ×%d :: %s' % (f, cnt, old[:44].replace('\n', '⏎')))

# 1) ⑧c⑥：提示词「药草淬炼」→「血清调试」
rep('smoke-test.js', "    && /四维补足/.test(r.msg) && /自由属性点/.test(r.msg) && /淬炼/.test(r.msg);",
    "    && /四维补足/.test(r.msg) && /自由属性点/.test(r.msg) && /血清调试/.test(r.msg);")

# 2) v89.74 派系入口：面板改为数组（实验室 + 派系）
rep('smoke-test.js',
    "  check('v89.74：派系入口挂在建筑面板（BLDG_FUNC.honglusi → open-sect）+ 五个动作都接了分发', (function () {\n"
    "    var mS2 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');\n"
    "    return /honglusi:\\s*\\{\\s*label: \"⚔️ 派系\",\\s*act: \"open-sect\"\\s*\\}/.test(uS)",
    "  check('v89.74 / v89.224：派系入口挂在建筑面板（→ open-sect）· 实验室入口同格（→ open-lab）', (function () {\n"
    "    var mS2 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');\n"
    "    return /honglusi:\\s*\\[\\{\\s*label: \"🧬 基因实验室\",\\s*act: \"open-lab\"\\s*\\},\\s*\\{ label: \"⚔️ 派系\",\\s*act: \"open-sect\"\\s*\\}\\]/.test(uS)")
rep('smoke-test.js', "      && /case 'open-sect'/.test(mS2) && /case 'sect-join'/.test(mS2) && /case 'sect-found'/.test(mS2)",
    "      && /case 'open-sect'/.test(mS2) && /case 'open-lab'/.test(mS2)\n"
    "      && /case 'sect-join'/.test(mS2) && /case 'sect-found'/.test(mS2)")

# 3) 背包药草 → 血清
rep('smoke-test.js',
    "  check('背包：药草有分类与图标（rank_up）',\n    /rank_up: '药草（提升资质）'/.test(uS73) && /rank_up: '🌿'/.test(uS73));",
    "  check('背包：血清有分类与图标（rank_up）',\n    /rank_up: '血清（提升资质）'/.test(uS73) && /rank_up: '🌿'/.test(uS73));")

# 4) §118② 政务厅要务按钮 + 我的两处 open-lab 判据字面形态修正
rep('smoke-test.js',
    "    check('§118② 政务厅要务：四个按钮规格统一（全 btn sm · 图标全 emoji 族）+ 无全境营造总览', (function () {\n"
    "      var seg = uc.slice(uc.indexOf('政务厅要务'), uc.indexOf('政务厅要务') + 2600);\n"
    "      return seg.indexOf('open-build-ov') < 0 && seg.indexOf('🏗') < 0\n"
    "        && seg.indexOf('📝 修改城名') >= 0 && seg.indexOf('🏛 设为主城') >= 0\n"
    "        && seg.indexOf('🏛 本城即主城') >= 0 && seg.indexOf('🧬 基因实验室') >= 0\n"
    "        /* 统一规格：这三颗都是 btn sm（gold 只作配色，不再是 btn gold 的尺寸档） */\n"
    "        && /btn sm' \\+ \\(isMain135/.test(seg) === false\n"
    "        && /class=\"btn sm[^\"]*\" data-action=\"open-farm\"/.test(seg);\n"
    "    })());",
    "    check('§118② / v89.224 政务厅要务：按钮规格统一（全 btn sm · emoji 族）· 实验室按钮已撤（迁建筑格）', (function () {\n"
    "      var seg = uc.slice(uc.indexOf('政务厅要务'), uc.indexOf('政务厅要务') + 2600);\n"
    "      return seg.indexOf('open-build-ov') < 0 && seg.indexOf('🏗') < 0\n"
    "        && seg.indexOf('📝 修改城名') >= 0 && seg.indexOf('🏛 设为主城') >= 0\n"
    "        && seg.indexOf('🏛 本城即主城') >= 0\n"
    "        && seg.indexOf('🧬 基因实验室') < 0 && seg.indexOf('open-farm') < 0 && seg.indexOf('open-lab') < 0;\n"
    "    })());")
rep('smoke-test.js', "    return /data-action=\"open-lab\"/.test(uS73) && /data-action=\"farm-projects\"/.test(uS73)",
    "    return /\"open-lab\"/.test(uS73) && /data-action=\"farm-projects\"/.test(uS73)")
rep('smoke-test.js', "          && RAW220.ui.indexOf('data-action=\"open-lab\"') >= 0",
    "          && RAW220.ui.indexOf('\"open-lab\"') >= 0")

# 5) 我的提取判据笔误：plot0 种的是 yunlingcao（激活血清），不是钢锭
rep('smoke-test.js',
    "    check('实测：提取产物入包（钢锭 ×2~4）', (function () {\n"
    "      G.tickFarm(12 * 3600);\n"
    "      var h = G.farmHarvest(0);\n"
    "      return h.ok && ((st78.items || {}).bintie || 0) >= 2;\n"
    "    })());",
    "    check('实测：提取产物入包（激活血清 ×1）', (function () {\n"
    "      G.tickFarm(12 * 3600);\n"
    "      var h = G.farmHarvest(0);\n"
    "      return h.ok && ((st78.items || {}).yunlingcao || 0) >= 1;\n"
    "    })());")

# 6) SHOP_CATS：seed 页签退役
rep('js/ui.js',
    "    /* v89.87（老板拍板 · 需求 1）：**种子开售** —— 配合\"就地快购全覆盖\"。\n"
    "       v78 曾定\"种子不售、仅采集/征战产出\"；本批按最新拍板开售（价格早已在表中）。 */\n"
    "    seed: '种子',\n",
    "    /* ⛔ v89.224：种子货架退役（老板 2「不要播种 / 种子」）—— seed 页签整条删除。 */\n")

print('[b5] %d 处' % len(LOG))
for l in LOG: print('  ' + l)
