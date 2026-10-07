# -*- coding: utf-8 -*-
"""v89.224b8：初始前置拆表（BUILD_PREREQ_INIT 只拦"新建"）—— 修 §191④/§220③c。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b8'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, BASE + p)
def span(f, start, end, new, must=None):
    s = rd(f)
    i = s.find(start); j = s.find(end, i + 1) if i >= 0 else -1
    assert i >= 0 and j > i, '[%s] span 缺失 %r %r' % (f, start[:40], end[:40])
    if must: assert must in s[i:j]
    wr(f, s[:i] + new + s[j:]); LOG.append('%s span :: %s' % (f, start[:40]))

span('js/data.js',
     '  DATA.BUILD_PREREQ = {\n',
     '  /* v89.224（老板 6）：**升级依赖**',
     "  DATA.BUILD_PREREQ = {\n"
     "    /* v68 原 6 条：**建造与升级同一把尺**（升到任何等级都看它）—— 沿用不动。 */\n"
     "    zhaoxianguan:     { kezhan: 2 },     // 先酒馆后招募站：有安顿来客之处，方可设馆纳贤\n"
     "    gongjiangzuofang: { tiejiangpu: 3 }, // 机工坊：器械以铁作底，锻造间 Lv3 起步\n"
     "    xiaochang:        { junying: 2 },    // 先募兵（训练营）再练兵（练兵场）\n"
     "    yizhan:           { shichang: 2 },   // 驿传通商：先有交易站才有驿路\n"
     "    honglusi:         { kezhan: 3 },     // 基因实验室：线索与人力来自酒馆 Lv3\n"
     "    majiu:            { junying: 3 },    // 养马为骑军基础：训练营 Lv3\n"
     "  };\n"
     "\n"
     "  /* v89.224（老板 6）：「务必使所有可以合理关联的建筑建立初始建造和后续升级的等级依赖」——\n"
     "     **初始建造前置**（本表只在「新建」那一下查，不拦升级 —— 否则「居所 2」会被读成永久门槛；\n"
     "     升级链另行逐级挂钩，见 BUILD_UP_DEPS）。判定唯一出口仍为 GAME.buildPrereqOf。 */\n"
     "  DATA.BUILD_PREREQ_INIT = {\n"
     "    kezhan:           { minfang: 2 },   // 酒馆：先有人居，方可聚众\n"
     "    junying:          { minfang: 2 },   // 训练营：先有人居，方可募兵\n"
     "    shuyuan:          { minfang: 3 },   // 研习所：聚居渐盛方谈研学\n"
     "    cangku:           { minfang: 2 },   // 货仓：依民居而设\n"
     "    shichang:         { minfang: 3 },   // 交易站：要有集市人气\n"
     "    tiejiangpu:       { junying: 2 },   // 锻造间：炉火为军械而燃\n"
     "    fenghuotai:       { junying: 2 },   // 瞭望塔：隶属军务\n"
     "  };\n"
     "\n",
     must='kezhan')

s = rd('js/domain.js')
old = "    /* v89.224（老板 6）：**升级依赖** —— 本建筑升到 N 级，依赖建筑不得低于 N − gap。"
new = ("    /* v89.224（老板 6）：**初始建造前置**（只查「新建」，不拦升级）——\n"
       "       升级链由下一条 BUILD_UP_DEPS 逐级挂钩；判定同一把尺。 */\n"
       "    var _rqInit224 = DATA.BUILD_PREREQ_INIT && DATA.BUILD_PREREQ_INIT[bid];\n"
       "    if (_rqInit224 && (nextLv || 1) <= 1) {\n"
       "      for (var k2 in _rqInit224) {\n"
       "        var cur2 = GAME.buildingLevel(city, k2);\n"
       "        if (cur2 < _rqInit224[k2]) list.push({ bid: k2, name: (DATA.BUILDINGS[k2] || {}).name || k2, need: _rqInit224[k2], cur: cur2 });\n"
       "      }\n"
       "    }\n"
       + old)
assert s.count(old) == 1
wr('js/domain.js', s.replace(old, new))
LOG.append('js/domain.js :: 初始前置分支插入')

print('[b8] %d 处' % len(LOG))
for l in LOG: print('  ' + l)
