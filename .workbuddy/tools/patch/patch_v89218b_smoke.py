# -*- coding: utf-8 -*-
"""v89.218 · 故事系统退役 —— smoke-test.js 断言改写

原则（§0.7）：规则变更的断言**按新口径重写**，不删 —— 全部升级为"零残留守卫"。
"""
import io

R = 'E:/Deepseekdb/'
p = R + 'smoke-test.js'
s = io.open(p, encoding='utf-8', newline='').read()
orig_len = len(s)


def rep(old, new, tag, expect=None):
    global s
    c = s.count(old)
    if c == 0:
        print('  [MISS] %s' % tag)
        return
    if expect is not None and c != expect:
        raise SystemExit('❌ %s: count=%d expect=%d' % (tag, c, expect))
    s = s.replace(old, new)
    print('  [ok] %s x%d' % (tag, c))


# ═══════════ ① 头部：story/vol requires → 撤除 ═══════════
i0 = s.index("  /* 文字游戏故事库（story/）：与 index.html 同序 —— 数据先行，ui/main 后取 */")
i1 = s.index("  require('./story/vol-84.js');\n") + len("  require('./story/vol-84.js');\n")
s = s[:i0] + "  /* ⛔ v89.218（老板「故事全部去除」）：84 卷故事库（story/）已删，require 一并撤除。 */\n" + s[i1:]
print('  [ok] 头部 requires')

# ═══════════ ② rng 触发钩子 → 撤除 ═══════════
rep("  /* v89.29：逸闻奇遇 —— 测试期默认关闭随机触发（避免打断用例）；\n"
    "     需要走触发链的用例自行用 GAME.SG.TRIG.pin / rng 精确控制。 */\n"
    "  if (global.GAME && global.GAME.SG && global.GAME.SG.TRIG) global.GAME.SG.TRIG.rng = function () { return 0.999; };\n",
    "  /* ⛔ v89.218：逸闻奇遇触发钩子随故事系统退役（不再需要测试期 rng 钉死）。 */\n",
    'rng钩子')

# ═══════════ ③ §18 叙事层 ═══════════
rep("  check('五张数据表齐全',\n"
    "    DATA.BONDS.length >= 8 && DATA.ERAS.length >= 10 && DATA.CHRONICLE_RULES.length > 10 &&\n"
    "    DATA.ENCOUNTERS.length >= 8 && DATA.TITLES.length >= 6 && DATA.SEASONS.length === 4 &&\n"
    "    Object.keys(DATA.WEATHERS).length === 5,\n"
    "    '羁绊' + DATA.BONDS.length + '/年号' + DATA.ERAS.length + '/纪事' + DATA.CHRONICLE_RULES.length +\n"
    "    '/奇遇' + DATA.ENCOUNTERS.length + '/称号' + DATA.TITLES.length);",
    "  /* v89.218：CHRONICLE_RULES（纪事规则）/ TITLES（称号评定）随史册退役 —— 判据收窄为三张表。 */\n"
    "  check('三张数据表齐全（v89.218：纪事/称号两表已退役）',\n"
    "    DATA.BONDS.length >= 8 && DATA.ERAS.length >= 10 && DATA.ENCOUNTERS.length >= 8 &&\n"
    "    DATA.SEASONS.length === 4 && Object.keys(DATA.WEATHERS).length === 5\n"
    "    && DATA.CHRONICLE_RULES === undefined && DATA.TITLES === undefined,\n"
    "    '羁绊' + DATA.BONDS.length + '/年号' + DATA.ERAS.length + '/奇遇' + DATA.ENCOUNTERS.length);",
    '§18-数据表')

rep("  console.log('  --- 史书纪事 ---');\n"
    "  check('史册已有条目', (S18.chronicle || []).length > 0, (S18.chronicle || []).length + ' 条');\n"
    "  check('里程碑已记账', (S18.chronicle || []).some(function (e) { return e.tag === 'milestone'; }));\n"
    "  check('逐年快照已记账', (S18.chronicle || []).some(function (e) { return e.tag === 'annual'; }));\n"
    "  ST.chronicleAdd('是岁，试记一笔。', 'note');\n"
    "  check('可手动记账', S18.chronicle[S18.chronicle.length - 1].text.indexOf('试记一笔') >= 0);\n"
    "  check('史册文本可导出', ST.chronicleText(3).indexOf('【') >= 0);\n"
    "  check('占位符已替换为实值', ST.fill('{era}{yy}{season}').indexOf('{') < 0, ST.fill('{era}{yy}{season}，兵{army}'));\n"
    "  var big = [];\n"
    "  for (var ci = 0; ci < 400; ci++) ST.chronicleAdd('压测条目' + ci, 'note');\n"
    "  check('史册超长自动截断（防存档膨胀）', S18.chronicle.length <= 300, S18.chronicle.length + ' 条');\n",
    "  console.log('  --- 史书纪事（v89.218 退役）---');\n"
    "  check('v89.218：纪事机制整条退役（记账/导出/填值/快照四组出口全清）', (function () {\n"
    "    return typeof ST.chronicleAdd === 'undefined' && typeof ST.chronicleText === 'undefined'\n"
    "      && typeof ST.fill === 'undefined' && typeof ST.checkMilestones === 'undefined'\n"
    "      && typeof ST.chronicleYearSnapshot === 'undefined' && typeof ST.recordOffline === 'undefined'\n"
    "      && S18.chronicle === undefined && S18.chronicleDone === undefined && S18.eraHistory === undefined;\n"
    "  })());\n",
    '§18-纪事块')

rep("  S18.generals.length = 1;   // 只留初始将领，清空羁绊\n"
    "  ST.chronicleDone = {};\n",
    "  S18.generals.length = 1;   // 只留初始将领，清空羁绊\n",
    '§18-chronicleDone行')

rep("  check('改元写入史册', (S18.chronicle || []).some(function (e) { return e.tag === 'era'; }));",
    "  check('改元写入公文（v89.218：原写入史册；改元播报仍可见）',\n"
    "    (S18.msgLog || []).some(function (m) { return /改元/.test(m.msg); }));",
    '§18-改元')

rep("  var rewards = DATA.ENCOUNTERS.concat(DATA.CHRONICLE_RULES).length;\n", "", '§18-rewards死变量')

rep("  console.log('  --- 战力折算 ---');\n"
    "  var pb18 = ST.powerBreakdown();\n"
    "  check('战力折算返回明细', !!pb18 && typeof pb18.index === 'number');\n"
    "  check('国力指数为正', pb18.index > 0, U.fmt(pb18.index));\n"
    "  check('折算含甲兵/动员/建筑/科技四项',\n"
    "    typeof pb18.army === 'number' && typeof pb18.reserve === 'number' &&\n"
    "    typeof pb18.buildings === 'number' && typeof pb18.tech === 'number',\n"
    "    '兵' + pb18.army + ' 动员' + pb18.reserve + ' 建筑' + pb18.buildings + ' 科技' + pb18.tech);\n"
    "  var idx0 = pb18.index;\n"
    "  S18.res.grain += 500000; S18.res.wood += 500000; S18.res.iron += 500000;\n"
    "  check('资源增加 → 可动员战力上升', ST.powerBreakdown().reserve > pb18.reserve,\n"
    "    U.fmt(pb18.reserve) + ' → ' + U.fmt(ST.powerBreakdown().reserve));\n",
    "  console.log('  --- 战力折算（v89.218 退役）---');\n"
    "  check('v89.218：战力折算展示出口退役（四清）· 战力尺 troopPower 仍在岗', (function () {\n"
    "    return typeof ST.powerBreakdown === 'undefined' && typeof ST.powerIndex === 'undefined'\n"
    "      && typeof ST.reservePower === 'undefined' && typeof ST.currentPower === 'undefined'\n"
    "      && typeof ST.troopPower === 'function' && ST.troopPower('yibing') > 0;\n"
    "  })());\n",
    '§18-战力折算')

rep("  console.log('  --- 称号与属性丹 ---');\n"
    "  var t18 = ST.evaluateTitle();\n"
    "  check('称号判定可用', !!t18 && !!t18.name, t18.rank + ' · ' + t18.name);\n"
    "  check('称号按城池数从高到低匹配', DATA.TITLES[0].cond.minCities >= DATA.TITLES[1].cond.minCities);\n"
    "  S18.items.fengwang_migao = 3;\n",
    "  console.log('  --- 称号（v89.218 退役）与属性丹 ---');\n"
    "  check('v89.218：称号评定退役（evaluateTitle + DATA.TITLES 双清）',\n"
    "    typeof ST.evaluateTitle === 'undefined' && DATA.TITLES === undefined);\n"
    "  S18.items.fengwang_migao = 3;\n",
    '§18-称号')

# ═══════════ ④ §19 离线（史书条目 → 归来报告） ═══════════
rep("  var e19 = S19.world.elapsed;\n"
    "  var chron0 = (S19.chronicle || []).length;\n"
    "  var gold19 = S19.res.gold;\n"
    "  G.offlineCatchup(600);          // 模拟离线 10 分钟（精确段）\n"
    "  check('离线补算推进历法时间', S19.world.elapsed > e19,\n"
    "    '+' + Math.round(S19.world.elapsed - e19) + ' 游戏秒');\n"
    "  check('离线期间资源有结算', S19.res.gold !== gold19 || S19.res.grain > 0);\n"
    "  check('离线归来只记少量史书（不逐年涌出）',\n"
    "    (S19.chronicle || []).length - chron0 <= 3,\n"
    "    '+' + ((S19.chronicle || []).length - chron0) + ' 条');\n"
    "  var last19 = S19.chronicle[S19.chronicle.length - 1];\n"
    "  check('离线归来有专门条目', last19 && last19.tag === 'offline', last19 && last19.text.slice(0, 24) + '…');\n",
    "  var e19 = S19.world.elapsed;\n"
    "  var gold19 = S19.res.gold;\n"
    "  G.offlineCatchup(600);          // 模拟离线 10 分钟（精确段）\n"
    "  check('离线补算推进历法时间', S19.world.elapsed > e19,\n"
    "    '+' + Math.round(S19.world.elapsed - e19) + ' 游戏秒');\n"
    "  check('离线期间资源有结算', S19.res.gold !== gold19 || S19.res.grain > 0);\n"
    "  /* v89.218：原「离线归来记史书」三条断言随史册退役 —— 归来可见性由「归来报告」承接。 */\n"
    "  check('v89.218：离线归来报告已归集（原史书条目位置）',\n"
    "    !!(G._offlineReport && G._offlineReport.secReal >= 600), JSON.stringify(G._offlineReport || {}).slice(0, 60));\n"
    "  check('v89.218：chronicle 字段不再写入（老档字段不复活）', S19.chronicle === undefined);\n",
    '§19-离线')

# ═══════════ ⑤ §28 菜单顺序 ═══════════
rep("  check('#6 菜单分组顺序：城池·地图 ‖ 将领·军务·任务 ‖ 商城·背包 ‖ 史册·公文 ‖ 自动·设置',\n"
    "    (function () {\n"
    "      /* v89.104（老板）：「将将领，军务，任务放一起」＋删「统计」——\n"
    "         新顺序：城池·地图 ‖ 将领·军务·任务（三者相邻）‖ 商城·背包 ‖ 史册·公文 ‖ 自动·设置 */\n"
    "      var order = ['data-view=\"city\"', 'data-view=\"map\"', 'nav-sep', 'data-view=\"generals\"', 'data-view=\"marches\"',\n"
    "        'data-view=\"tasks\"', 'nav-sep', 'data-view=\"shop\"', 'data-view=\"bag\"',\n"
    "        'nav-sep', 'data-view=\"story\"', 'data-view=\"reports\"', 'nav-sep', 'data-view=\"auto\"', 'data-view=\"settings\"'];",
    "  check('#6 菜单分组顺序：城池·地图 ‖ 将领·军务·任务 ‖ 商城·背包 ‖ 公文 ‖ 自动·设置（v89.218：史册/故事集退役）',\n"
    "    (function () {\n"
    "      /* v89.104（老板）：「将将领，军务，任务放一起」＋删「统计」——\n"
    "         v89.218（老板「不再保留史册，故事集」）：两页签退役 —— 新顺序：\n"
    "         城池·地图 ‖ 将领·军务·任务（三者相邻）‖ 商城·背包 ‖ 公文 ‖ 自动·设置 */\n"
    "      var order = ['data-view=\"city\"', 'data-view=\"map\"', 'nav-sep', 'data-view=\"generals\"', 'data-view=\"marches\"',\n"
    "        'data-view=\"tasks\"', 'nav-sep', 'data-view=\"shop\"', 'data-view=\"bag\"',\n"
    "        'nav-sep', 'data-view=\"reports\"', 'nav-sep', 'data-view=\"auto\"', 'data-view=\"settings\"'];",
    '§28-菜单顺序')

# ═══════════ ⑥ §31 两条 ═══════════
rep("  check('史书纪事已撤出史册页（v89.104：没有实质内容，整段退役）',\n"
    "    !/ui\\.pageOf\\('chronicle'/.test(uS31) && !/ui\\.pagerHTML\\('chronicle'/.test(uS31));",
    "  /* v89.218（老板「不再保留史册，故事集」）：整页退役 —— 判据升级为\"可执行形态全清\"。 */\n"
    "  check('v89.218：史册页整页退役（storyHTML / 页签 / 纪事分页三清）', (function () {\n"
    "    var u31 = uS31.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');\n"
    "    return u31.indexOf('ui.storyHTML = function') < 0\n"
    "      && !/ui\\.pageOf\\('chronicle'/.test(u31) && !/ui\\.pagerHTML\\('chronicle'/.test(u31)\n"
    "      && !/data-view=\"story\"/.test(hS31) && !/data-view=\"stories\"/.test(hS31);\n"
    "  })());",
    '§31-退役页')

rep("  check('实测：史册页不再渲染纪事条目（数据仍记，只是不占版面）', (function () {\n"
    "    var s = G.state, backup = s.chronicle;\n"
    "    var many = [];\n"
    "    for (var i = 0; i < 45; i++) many.push({ era: '元兴', seasonName: '春', tag: 'war', text: '第 ' + i + ' 条纪事' });\n"
    "    s.chronicle = many;\n"
    "    if (G.ui && G.ui._pages) G.ui._pages.chronicle = 1;\n"
    "    if (G.ui) G.ui._bottom = [];\n"
    "    var html = G.ui.storyHTML();\n"
    "    var n = (html.match(/chron-item/g) || []).length;\n"
    "    var bar = (G.ui._bottom || []).join('');\n"
    "    s.chronicle = backup;\n"
    "    /* v89.104（老板）：「不要史书纪事了」—— 史册页既不渲染条目、也不再登记纪事分页条 */\n"
    "    return n === 0 && bar.indexOf('共 45 项') < 0;\n"
    "  })());\n",
    "  check('v89.218：故事系统全退出界面（SG 引擎 / 阅读器 / 待阅 三组出口 undefined）', (function () {\n"
    "    return typeof GAME.SG === 'undefined' && typeof G.ui.storyHTML === 'undefined'\n"
    "      && typeof G.ui.storiesHTML === 'undefined' && typeof G.ui.openStory === 'undefined'\n"
    "      && typeof G.ui.sgPendingHTML === 'undefined' && typeof G.ui.sgTryTrigger === 'undefined';\n"
    "  })());\n",
    '§31-实测块')

# ═══════════ ⑦ §48 故事锚点（整段语句替换） ═══════════
i0 = s.index("  check('v89.74：故事锚点迁移（外交→政务厅 · 荒野→派系驻地 · 全库再无「鸿胪寺」）', (function () {")
i1 = s.index("  check('v89.74：派系 P0 骨架", i0)
s = s[:i0] + ("  check('v89.218：故事库整条退役（原 v89.74「锚点迁移」断言 —— 内容层 84 卷已删、锚点体系全清）', (function () {\n"
              "    return typeof GAME.SG === 'undefined'\n"
              "      && !require('fs').existsSync(require('path').join(__dirname, 'story'));\n"
              "  })());\n") + s[i1:]
print('  [ok] §48-锚点')

# ═══════════ ⑧ §81 整节替换（18504 起 → 82 节前） ═══════════
i0 = s.index("/* ============================================================\n"
             " * 81. 文字游戏 · 故事库（story/ · GAME.SG / ui.SG_*）\n"
             " * ============================================================ */")
i1 = s.index("/* ============================================================\n"
             " * 82. v89.7 · 头像可更换 + 供奉公文静默（老板）")
SEC81 = (
    "/* ============================================================\n"
    " * 81. 文字游戏 · 故事库（story/）—— v89.218 退役记录\n"
    " * ------------------------------------------------------------\n"
    " * ⛔ 老板：「故事全部去除，不再保留史册，故事集」。\n"
    " * 本段原为 60+ 条故事库断言（数据 / 引擎 / 触发 / 接线 / 逐卷就位）。现已整条退役，\n"
    " * 取而代之的是「零残留守卫」——防止任何一处复活成\"半套系统\"。\n"
    " * ============================================================ */\n"
    "(function () {\n"
    "  console.log('\\n===== 81. 故事库退役（v89.218 · 零残留守卫） =====');\n"
    "  var fs81 = require('fs'), path81 = require('path');\n"
    "  var rd81 = function (f) { return fs81.readFileSync(path81.join(__dirname, f), 'utf8'); };\n"
    "  var sc81 = function (s2) { return String(s2).replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/(^|[^:\\\\])\\/\\/[^\\n]*/g, '$1'); };\n"
    "  var st81 = rd81('js/state.js'), u81 = rd81('js/ui.js'), m81 = rd81('js/main.js');\n"
    "  var h81 = rd81('index.html'), stOry81 = rd81('js/story.js');\n"
    "\n"
    "  check('① 引擎零残留：GAME.SG 全套出口不在（可执行形态）', (function () {\n"
    "    var forms = ['GAME.SG = {}', 'GAME.SG.list = function', 'GAME.SG.roll = function',\n"
    "      'GAME.SG.rollAct = function', 'GAME.SG.defer = function', 'GAME.SG.settle = function',\n"
    "      'GAME.SG.PENDING_CAP'];\n"
    "    var st = sc81(st81);\n"
    "    return forms.every(function (f) { return st.indexOf(f) < 0; });\n"
    "  })());\n"
    "  check('② 界面零残留：storyHTML / storiesHTML / 阅读器 / 触发出口不在', (function () {\n"
    "    var u = sc81(u81);\n"
    "    return ['ui.storyHTML = function', 'ui.storiesHTML = function', 'ui.openStory = function',\n"
    "      'ui.sgTryTrigger = function', 'ui.sgTryAct = function', 'ui.sgRender = function',\n"
    "      'ui.sgClose = function', 'ui.sgPendingHTML = function', 'ui.SG_MURAL', 'ui.SG_KIND',\n"
    "      'ui.SG_PER_PAGE'].every(function (f) { return u.indexOf(f) < 0; });\n"
    "  })());\n"
    "  check('③ 动作零残留：story-* 五个 case 与 sgTry 调用 / onActionDone 不在', (function () {\n"
    "    var m = sc81(m81);\n"
    "    return [\"case 'story-pick'\", \"case 'story-read'\", \"case 'story-read-at'\", \"case 'story-drop'\",\n"
    "      \"case 'story-exit'\", 'ui.sgTryAct', 'ui.sgTryTrigger', 'GAME.onActionDone'].every(function (f) { return m.indexOf(f) < 0; });\n"
    "  })());\n"
    "  check('④ 页面零残留：两个页签 / 徽标 / 84 个脚本标签 / 阅读器样式全清', (function () {\n"
    "    return h81.indexOf('data-view=\"story\"') < 0 && h81.indexOf('data-view=\"stories\"') < 0\n"
    "      && h81.indexOf('tab-badge-story') < 0 && h81.indexOf('story/vol-') < 0\n"
    "      && h81.indexOf('story-fx') < 0 && h81.indexOf('.sg-grid') < 0 && h81.indexOf('.sgr-wrap') < 0;\n"
    "  })());\n"
    "  check('⑤ 内容层已删：story/ 目录不存在（84 卷）', !fs81.existsSync(path81.join(__dirname, 'story')));\n"
    "  check('⑥ 叙事数据层退役：CHRONICLE_RULES / TITLES / chronicleAdd / recordOffline 全清', (function () {\n"
    "    var st = sc81(st81);\n"
    "    return G.DATA.CHRONICLE_RULES === undefined && G.DATA.TITLES === undefined\n"
    "      && typeof G.story.chronicleAdd === 'undefined' && typeof G.story.recordOffline === 'undefined'\n"
    "      && typeof G.story.evaluateTitle === 'undefined'\n"
    "      && st.indexOf('chronicleAdd') < 0 && st.indexOf('onActionDone') < 0;\n"
    "  })());\n"
    "  check('⑦ 保留下来的世界层仍在岗（天时 / 年号 / 羁绊 / 奇遇 / 战力尺）', (function () {\n"
    "    return typeof G.story.tick === 'function' && typeof G.story.combatMod === 'function'\n"
    "      && typeof G.story.prodMult === 'function' && typeof G.story.skyLine === 'function'\n"
    "      && typeof G.story.encounterRoll === 'function' && typeof G.story.troopPower === 'function'\n"
    "      && typeof G.story.settleEraGoal === 'function' && (G.DATA.BONDS || []).length >= 8;\n"
    "  })());\n"
    "  check('⑧ 数字键续号已收窄：Shift+1~3（公文/自动/设置）', (function () {\n"
    "    var m = sc81(m81);\n"
    "    return /Digit\\(\\[1-3\\]\\)/.test(m) && m.indexOf(\"'reports', 'auto', 'settings'\") >= 0\n"
    "      && m.indexOf(\"'story', 'stories'\") < 0;\n"
    "  })());\n"
    "  check('⑨ 奇遇可见性迁移：巡野所得写公文（不再写史册）', (function () {\n"
    "    return stOry81.indexOf('巡野所得') >= 0 && stOry81.indexOf('chronicleAdd') < 0;\n"
    "  })());\n"
    "  check('⑩ 需求档案在册（v89.218 · 老板原话逐字）', (function () {\n"
    "    var arc = rd81('需求档案.md');\n"
    "    return arc.indexOf('v89.218') >= 0 && arc.indexOf('故事全部去除，不再保留史册，故事集') >= 0;\n"
    "  })());\n"
    "})();\n"
    "\n"
)
s = s[:i0] + SEC81 + s[i1:]
print('  [ok] §81整节')

# ═══════════ ⑨ §85 故事待阅（整条 check 替换） ═══════════
i0 = s.index("    check('v89.86（P-06）：故事待阅（触发入列 · 阅读出列 · 徽标 · 上限 30）', (function () {")
i1 = s.index("    check('v89.86（P-03）：任务「前往」", i0)
s = s[:i0] + ("    check('v89.218：故事待阅退役（原 v89.86 P-06 断言 —— 徽标 / 入列 / 开卷 / 往事上限整条移除）', (function () {\n"
              "      return typeof G8.SG === 'undefined'\n"
              "        && global.document.querySelectorAll('#tab-badge-story').length === 0\n"
              "        && ht8.indexOf('tab-badge-story') < 0;\n"
              "    })());\n") + s[i1:]
print('  [ok] §85-待阅')

# ═══════════ ⑩ §89 C4 ═══════════
i0 = s.index("    /* ---- ⑦ C4：故事集（已读回看 + 收集进度） ---- */")
i1 = s.index("    /* ---- ⑧ E3：人口三段条 ---- */", i0)
s = s[:i0] + ("    /* ---- ⑦ C4：故事集（v89.218 退役） ---- */\n"
              "    check('v89.218：故事集视图退役（原 v89.89 C4 断言 —— storiesHTML / story-read-at 全清）', (function () {\n"
              "      return typeof G.ui.storiesHTML === 'undefined' && typeof G.ui.openStory === 'undefined'\n"
              "        && !/data-action=\"story-read-at\"/.test(uS89)\n"
              "        && mS89.indexOf(\"case 'story-read-at'\") < 0\n"
              "        && !/ui\\.SG_KIND/.test(uS89.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''));\n"
              "    })());\n"
              "\n") + s[i1:]
print('  [ok] §89-C4')

# ═══════════ ⑪ §93 E10 ═══════════
i0 = s.index("    console.log('  --- E10 故事待阅：超限折入往事（不丢） ---');")
i1 = s.index("    console.log('  --- E11 度支归集", i0)
s = s[:i0] + ("    console.log('  --- E10 故事待阅（v89.218 退役） ---');\n"
              "    check('v89.218：故事待阅退役（原 E10「超限折入往事」断言 —— SG 引擎全清）', (function () {\n"
              "      return typeof G.SG === 'undefined' && s93.sgPending === undefined;\n"
              "    })());\n"
              "\n") + s[i1:]
print('  [ok] §93-E10')

# ═══════════ ⑫ §85b 菜单 ═══════════
rep("    check('⑧ 菜单：删「统计」、加「故事集」、将领/军务/任务相邻', (function () {\n"
    "      return !/data-view=\"stats\"/.test(h4) && /data-view=\"stories\"/.test(h4)\n"
    "        && /data-view=\"generals\"[\\s\\S]{0,260}data-view=\"marches\"[\\s\\S]{0,260}data-view=\"tasks\"/.test(h4);\n"
    "    })());",
    "    check('⑧ 菜单：删「统计」、史册/故事集退役（v89.218）、将领/军务/任务相邻', (function () {\n"
    "      return !/data-view=\"stats\"/.test(h4) && !/data-view=\"stories\"/.test(h4)\n"
    "        && !/data-view=\"story\"/.test(h4)\n"
    "        && /data-view=\"generals\"[\\s\\S]{0,260}data-view=\"marches\"[\\s\\S]{0,260}data-view=\"tasks\"/.test(h4);\n"
    "    })());",
    '§85b-菜单')

# ═══════════ ⑬ 待阅逸闻 6×5 / 故事集独立成页（整对替换） ═══════════
i0 = s.index("    /* v89.116（老板「设计更紧凑，如5行*6列，增加翻页，全部列出」）：\n"
             "       6 列 × 5 行 = 30 格一页 + 底部条翻页（旧口径是固定 20 格、多的不列出）。 */\n"
             "    check('⑨ 待阅逸闻 6 列 × 5 行（30 格/页）· 空格子占位 · 翻页列全', (function () {")
i1 = s.index("    console.log('  --- ⑩ 地图放大 20% ---');", i0)
s = s[:i0] + ("    check('⑨ v89.218：待阅逸闻 / 史册 / 故事集三组界面全清（可执行形态）', (function () {\n"
              "      var u = u4.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');\n"
              "      return u.indexOf('ui.SG_GRID_COLS') < 0 && u.indexOf('ui.SG_PER_PAGE') < 0\n"
              "        && u.indexOf('ui.storyHTML = function') < 0 && u.indexOf('ui.storiesHTML = function') < 0\n"
              "        && u.indexOf('ui.sgPendingHTML = function') < 0 && !/class=\"sg-grid\"/.test(u);\n"
              "    })());\n"
              "\n") + s[i1:]
print('  [ok] 待阅6x5/故事集对')

# ═══════════ ⑭ §96 ① 三条 → 退役守卫 ═══════════
i0 = s.index("    console.log('  --- ① 待阅逸闻：6×5 + 翻页（需求 1）---');")
i1 = s.index("    console.log('  --- ② 快购按用途过滤（需求 2）---');", i0)
s = s[:i0] + ("    console.log('  --- ① 待阅逸闻（v89.218 退役）---');\n"
              "    check('v89.218：待阅逸闻面板退役（原 v89.116 ①：6×5 网格 / 字号序 / 翻页三条断言）', (function () {\n"
              "      return typeof G.ui.SG_GRID_COLS === 'undefined' && typeof G.ui.SG_PER_PAGE === 'undefined'\n"
              "        && G.ui.SG_KIND === undefined\n"
              "        && !/\\.sg-grid/.test(stripComment(h96));\n"
              "    })());\n"
              "\n") + s[i1:]
print('  [ok] §96-①')

# ═══════════ ⑮ §193 ②③ 离线（编年史 → 退役） ═══════════
rep("    check('§193②（v89.207 口径）静默补偿：队列推完 · offline 编年史不增 · 生成「离线纪要」（via=online）· 不设 _offlineSec（真调 · 沙坑）', (function () {",
    "    check('§193②（v89.207 口径 · v89.218 更新）静默补偿：队列推完 · 生成「离线纪要」（via=online）· 不设 _offlineSec（真调 · 沙坑）', (function () {",
    '§193②-标题')
rep("        var offN = function () {\n"
    "          return (G.state.chronicle || []).filter(function (r) { return r.tag === 'offline'; }).length;\n"
    "        };\n"
    "        var a0 = offN();\n"
    "        G._offlineReport = { sentinel: true };\n"
    "        G._offlineSec = 777;\n"
    "        var rc = G.loopGapCatchup(2 * 3600);\n"
    "        return rc.mode === 'catchup'\n"
    "          && G.state.queues.train.length === 0\n"
    "          && (G.state.cities[0].army || {}).yibing >= 300\n"
    "          && offN() === a0\n",
    "        G._offlineReport = { sentinel: true };\n"
    "        G._offlineSec = 777;\n"
    "        var rc = G.loopGapCatchup(2 * 3600);\n"
    "        return rc.mode === 'catchup'\n"
    "          && G.state.queues.train.length === 0\n"
    "          && (G.state.cities[0].army || {}).yibing >= 300\n"
    "          && G.state.chronicle === undefined   /* v89.218：编年史字段退役（原 offN 断言） */\n",
    '§193②-诊断')
rep("    check('§193③ 对照 · 读档路径（非静默）：offline 编年史 +1 · 生成归来报告（防\"静默过度\"）', (function () {\n"
    "      var bk = G.state, bkRep = G._offlineReport, bkSec = G._offlineSec;\n"
    "      try {\n"
    "        G.newGame({ name: 'gap193b', region: '烬环' });\n"
    "        var offN = function () {\n"
    "          return (G.state.chronicle || []).filter(function (r) { return r.tag === 'offline'; }).length;\n"
    "        };\n"
    "        var a0 = offN();\n"
    "        G._offlineReport = { sentinel2: true };\n"
    "        G._offlineSec = 0;\n"
    "        G.offlineCatchup(600);\n"
    "        return offN() === a0 + 1 && (G._offlineReport || {}).sentinel2 !== true\n",
    "    check('§193③ 对照 · 读档路径（非静默）：生成归来报告（防\"静默过度\"）· v89.218 编年史已退役', (function () {\n"
    "      var bk = G.state, bkRep = G._offlineReport, bkSec = G._offlineSec;\n"
    "      try {\n"
    "        G.newGame({ name: 'gap193b', region: '烬环' });\n"
    "        G._offlineReport = { sentinel2: true };\n"
    "        G._offlineSec = 0;\n"
    "        G.offlineCatchup(600);\n"
    "        return G.state.chronicle === undefined && (G._offlineReport || {}).sentinel2 !== true\n",
    '§193③-对照')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('\nsmoke-test.js 改写完成（%d → %d 字节）' % (orig_len, len(s)))
