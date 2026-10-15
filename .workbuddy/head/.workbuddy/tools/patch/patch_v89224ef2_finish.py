# -*- coding: utf-8 -*-
"""v89.224ef2：ef 补丁收尾 —— 修正"建材料"误伤 + 补齐 ui 粮草行 + 遗迹注释 + 依赖链表。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224ef2'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, BASE + p)
def rep(f, old, new, cnt=1):
    s = rd(f); c = s.count(old)
    assert c == cnt, '[%s] 锚点计数 %d != %d :: %r' % (f, c, cnt, old[:90])
    wr(f, s.replace(old, new)); LOG.append('%s ×%d :: %s' % (f, cnt, old[:44].replace('\n', '⏎')))

# 1) 误伤修正：改建材料不足
rep('js/domain.js', "msg: '本城改碎石料不足（跨城需走「本境调运」）' };", "msg: '本城改建材料不足（跨城需走「本境调运」）' };")

# 2) ui 粮草行（锚点尾缀修正）
rep('js/ui.js', "'粮草不足或体力不足时<b>暂停但不关开关</b>，恢复后继续。</div>';" if False else "'粮草不足或体力不足时<b>暂停但不关开关</b>，恢复后自动继续。</div>';",
    "'净水不足或体力不足时<b>暂停但不关开关</b>，恢复后自动继续。</div>';")

# 3) 遗迹注释收口
rep('js/ui.js', '       "独立空间"：关闭键直接回游戏视图，而不是弹回进遗迹前那一层）。 */',
    '       "独立空间"：关闭键直接回游戏视图，而不是弹回进基因实验室前那一层）。 */')
rep('js/ui.js',
    '           病根（老板报的"基因实验室↔选种死循环"）：种下种子后 openFarm() 把遗迹压成\n'
    '           第三层 → 关闭一次弹回选种、再关回遗迹、再关又回选种……永远出不去。 */',
    '           病根（老板报的"基因实验室↔立项窗死循环"）：立项弹窗把实验室压成\n'
    '           第三层 → 关闭一次弹回立项窗、再关回实验室、再关又回立项窗……永远出不去。 */')
rep('js/ui.js', '       "基因实验室关闭后直接会到城池界面才对"（而不是弹回进遗迹前的政务厅面板）。 */',
    '       "基因实验室关闭后直接会到城池界面才对"（而不是弹回进实验室前的建筑面板）。 */')
rep('js/ui.js', '改名/主城/遗迹照常可用；v89.174：其下接「在建队列」 */', '改名/主城照常可用；v89.174：其下接「在建队列」 */')
rep('js/ui.js', '         施工中分支与已建分支共用（升级期间改名/主城/遗迹照常可用）。 */',
    '         施工中分支与已建分支共用（升级期间改名/主城照常可用）。 */')
rep('js/ui.js', '游商不售、只能征战/遗迹所得）。**新增可上架类型时两处都要有**。 */',
    '游商不售、只能征战/采集所得）。**新增可上架类型时两处都要有**。 */')

# 4) 建筑依赖链表（data + domain）
rep('js/data.js',
    "  DATA.BUILD_PREREQ = {\n"
    "    zhaoxianguan:     { kezhan: 2 },     // 先酒馆后招募站：有安顿来客之处，方可设馆纳贤\n"
    "    gongjiangzuofang: { tiejiangpu: 3 }, // 机工坊：器械以铁作底，锻造间 Lv3 起步\n"
    "    xiaochang:        { junying: 2 },    // 先募兵（训练营）再练兵（练兵场）\n"
    "    yizhan:           { shichang: 2 },   // 驿传通商：先有交易站才有驿路\n"
    "    honglusi:         { kezhan: 3 },     // 派系驻地开山收徒：先有安置门人的酒馆 Lv3（原「鸿胪寺主迎来送往」）\n"
    "    majiu:            { junying: 3 },    // 养马为骑军基础：训练营 Lv3\n"
    "  };",
    "  DATA.BUILD_PREREQ = {\n"
    "    /* v89.224（老板 6）：「务必使所有可以合理关联的建筑建立初始建造和后续升级的等级依赖」——\n"
    "       初始建造前置补齐（原先 6 条 → 现 14 条；居所 / 政务厅为根）；升级依赖见 BUILD_UP_DEPS。 */\n"
    "    kezhan:           { minfang: 2 },   // 酒馆：先有人居，方可聚众\n"
    "    junying:          { minfang: 2 },   // 训练营：先有人居，方可募兵\n"
    "    shuyuan:          { minfang: 3 },   // 研习所：聚居渐盛方谈研学\n"
    "    cangku:           { minfang: 2 },   // 货仓：依民居而设\n"
    "    shichang:         { minfang: 3 },   // 交易站：要有集市人气\n"
    "    tiejiangpu:       { junying: 2 },   // 锻造间：炉火为军械而燃\n"
    "    fenghuotai:       { junying: 2 },   // 瞭望塔：隶属军务\n"
    "    zhaoxianguan:     { kezhan: 2 },    // 先酒馆后招募站：有安顿来客之处，方可设馆纳贤\n"
    "    gongjiangzuofang: { tiejiangpu: 3 }, // 机工坊：器械以铁作底，锻造间 Lv3 起步\n"
    "    xiaochang:        { junying: 2 },   // 先募兵（训练营）再练兵（练兵场）\n"
    "    yizhan:           { shichang: 2 },  // 驿传通商：先有交易站才有驿路\n"
    "    honglusi:         { kezhan: 3 },    // 基因实验室：线索与人力来自酒馆 Lv3\n"
    "    majiu:            { junying: 3 },   // 养马为骑军基础：训练营 Lv3\n"
    "  };\n"
    "\n"
    "  /* v89.224（老板 6）：**升级依赖** —— 逐级生效的等级挂钩（不是「一个孤立等级」）。\n"
    "     语义：本建筑要升到 N 级，依赖建筑不得低于 N − gap（只能追、不能甩 —— 与\n"
    "     v89.191 PAIR_GAP 同一思路，天然无死锁：每条链都落在无依赖的根「居所」上）。\n"
    "     判定唯一出口：GAME.buildPrereqOf（与初始前置同一把尺，界面提示 + 内核拦截共用）。\n"
    "     hiLv 宽限：本座曾达等级 ≥ 目标时免闸（老档不倒退封死，与科技闸 v89.220 同口径）。 */\n"
    "  DATA.BUILD_UP_DEPS = {\n"
    "    kezhan:           { dep: 'minfang',    gap: 2 },\n"
    "    junying:          { dep: 'minfang',    gap: 2 },\n"
    "    shuyuan:          { dep: 'minfang',    gap: 2 },\n"
    "    cangku:           { dep: 'minfang',    gap: 2 },\n"
    "    zhaoxianguan:     { dep: 'kezhan',     gap: 2 },\n"
    "    shichang:         { dep: 'cangku',     gap: 2 },\n"
    "    gongjiangzuofang: { dep: 'tiejiangpu', gap: 2 },\n"
    "    tiejiangpu:       { dep: 'junying',    gap: 2 },\n"
    "    fenghuotai:       { dep: 'junying',    gap: 2 },\n"
    "    xiaochang:        { dep: 'junying',    gap: 2 },\n"
    "    yizhan:           { dep: 'shichang',   gap: 2 },\n"
    "    honglusi:         { dep: 'kezhan',     gap: 2 },\n"
    "    majiu:            { dep: 'junying',    gap: 2 },\n"
    "  };")

rep('js/domain.js',
    "    var req = DATA.BUILD_PREREQ && DATA.BUILD_PREREQ[bid];\n"
    "    if (req) {\n"
    "      for (var k in req) {\n"
    "        var cur = GAME.buildingLevel(city, k);\n"
    "        if (cur < req[k]) list.push({ bid: k, name: (DATA.BUILDINGS[k] || {}).name || k, need: req[k], cur: cur });\n"
    "      }\n"
    "    }",
    "    var req = DATA.BUILD_PREREQ && DATA.BUILD_PREREQ[bid];\n"
    "    if (req) {\n"
    "      for (var k in req) {\n"
    "        var cur = GAME.buildingLevel(city, k);\n"
    "        if (cur < req[k]) list.push({ bid: k, name: (DATA.BUILDINGS[k] || {}).name || k, need: req[k], cur: cur });\n"
    "      }\n"
    "    }\n"
    "    /* v89.224（老板 6）：**升级依赖** —— 本建筑升到 N 级，依赖建筑不得低于 N − gap。\n"
    "       与 v89.191 配对闸同思路（只能追、不能甩 → 天然无死锁，链条收敛于居所）；\n"
    "       全表见 DATA.BUILD_UP_DEPS。hiLv 宽限：本座曾达等级 ≥ 目标时免闸（老档不倒退封死）。 */\n"
    "    var _upd224 = DATA.BUILD_UP_DEPS && DATA.BUILD_UP_DEPS[bid];\n"
    "    if (_upd224) {\n"
    "      var _nx224 = nextLv || (GAME.buildingLevel(city, bid) + 1);\n"
    "      var _need224 = _nx224 - (_upd224.gap || 2);\n"
    "      var _hi224 = piece ? Math.max(piece.hiLv || 0, piece.lvl || 0) : 0;\n"
    "      if (_need224 > 0 && _hi224 < _nx224) {\n"
    "        var _curU224 = GAME.buildingLevel(city, _upd224.dep);\n"
    "        if (_curU224 < _need224) {\n"
    "          var _depNm224 = (DATA.BUILDINGS[_upd224.dep] || {}).name || _upd224.dep;\n"
    "          list.push({ bid: _upd224.dep, name: _depNm224, need: _need224, cur: _curU224, upGate: true,\n"
    "            why: '「' + ((DATA.BUILDINGS[bid] || {}).name || bid) + '」要升到 Lv' + _nx224\n"
    "              + '，需先把「' + _depNm224 + '」升到 Lv' + _need224 + '（当前 Lv' + _curU224 + '）' });\n"
    "        }\n"
    "      }\n"
    "    }")

print('[ef2] %d 处' % len(LOG))
for l in LOG: print('  ' + l)
