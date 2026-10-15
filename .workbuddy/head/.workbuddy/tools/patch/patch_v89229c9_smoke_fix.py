# -*- coding: utf-8 -*-
"""v89.229c9：smoke 红单按新口径重写（兵种重构 18→14 · 三组分页 · cat 退役）
铁律：先备份 -> 逐段落盘 -> 写后自检（括号配平 + 坏值模式）-> node --check（外层跑）
幂等：每段以"新特征计数"为 guard（§99.1）
"""
import io, os, re, shutil, sys, datetime

ROOT = r'E:\Deepseekdb'
P_SMOKE = os.path.join(ROOT, 'smoke-test.js')
BAK = os.path.join(ROOT, '.workbuddy', 'backup', 'v89229c9')
os.makedirs(BAK, exist_ok=True)


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []


def rep(tag, old, new, mark, cnt=1):
    """mark = 新特征串（落盘后应出现 ≥1 次）；命中即跳过（幂等）。"""
    s = rd(P_SMOKE)
    if mark in s:
        LOG.append('[skip] ' + tag)
        return True
    c = s.count(old)
    if c != cnt:
        LOG.append('[FAIL] ' + tag + ' old.count=' + str(c) + '（期望 ' + str(cnt) + '）')
        return False
    wr(P_SMOKE, s.replace(old, new))
    LOG.append('[ok]   ' + tag)
    return True


# ---------------------------------------------------------------- 备份
if not os.path.exists(os.path.join(BAK, 'smoke-test.js')):
    shutil.copy2(P_SMOKE, os.path.join(BAK, 'smoke-test.js'))

# ================================================================ ① 兵种数 / 数值口径
rep('a1 兵种数 18→14',
    "check('18 兵种', Object.keys(DATA.TROOPS).length === 18, Object.keys(DATA.TROOPS).length + '种');",
    "check('14 兵种', Object.keys(DATA.TROOPS).length === 14, Object.keys(DATA.TROOPS).length + '种');",
    "check('14 兵种'")

rep('a2 自行火炮：坦度之最 → 唯一耗电能',
    """  check('自行火炮：血厚于所有常规兵（攻守城器械靠坦度与破阵）',
    /* v89.96：hp 全表 ×6 后写死数字会"改平衡即红"——改**相对判据**
       （与下一条"自行火炮攻与射程之最"同风格）。 */
    DATA.TROOPS.huopao.hp > DATA.TROOPS.zhuzhan.hp
    && DATA.TROOPS.huopao.hp > DATA.TROOPS.taitan.hp
    && DATA.TROOPS.huopao.def === 600 && DATA.TROOPS.huopao.craft === true);""",
    """  check('自行火炮：全军唯一耗电能（stone）的兵种（攻城器械的工业成本 · v89.229 承迫击炮原型）',
    /* v89.96 立的是"相对判据"（不写死数字）；v89.229（兵种重构 18→14）后**判据本体换型**：
       旧「破门车 血 36000 / 防 600 = 全军坦度之最」随合并并入自行火炮 —— 而自行火炮取
       **迫击炮**数值（hp 6600 / def 200），坦度之最已归泰坦机甲（15000）。
       改用**资源口径**做判据（更本质）：只有攻城器械吃「电能」（stone）—— 与废土四资源体系同构，
       也是"器械 = 工业产品"的数值证据。 */
    DATA.TROOPS.huopao.craft === true && DATA.TROOPS.huopao.mech === true
    && DATA.TROOPS.huopao.cost.stone > 0
    && Object.keys(DATA.TROOPS).every(function (id) {
      return id === 'huopao' || !(DATA.TROOPS[id].cost || {}).stone;
    }));""",
    '全军唯一耗电能（stone）的兵种')

rep('a3 8 小时收成含负重闸',
    """  var expect8 = Math.round(Math.min(1000 * DATA.TROOPS.buxingji.gather, DATA.GATHER.powerCap)
    * (1 + 8 * DATA.GATHER.levelBonus) * 8);
  check('8 游戏小时收成按公式计算', y8.ready === true && y8.amount === expect8, '收成 ' + y8.amount + '（期望 ' + expect8 + '）');""",
    """  /* v89.229（兵种重构）：步行机承**长矛手**原型（采集力 4 · 负重 60）——
     公式值涨到 121600，**越过负重闸**（1000 × 60 × loadMul 2 = 120000，v89.139 立的闸），
     故期望值 = min(公式值, 负重闸)；闸门读唯一出口 GAME.gatherLoadOf（不另算一份）。 */
  var raw8 = Math.round(Math.min(1000 * DATA.TROOPS.buxingji.gather, DATA.GATHER.powerCap)
    * (1 + 8 * DATA.GATHER.levelBonus) * 8);
  var cap8 = Math.round(G.gatherLoadOf(g15) * (G.loadMul || 0));
  var expect8 = Math.min(raw8, cap8);
  check('8 游戏小时收成按公式计算（含负重闸封顶 · v89.229 口径）',
    y8.ready === true && y8.amount === expect8,
    '收成 ' + y8.amount + '（期望 ' + expect8 + ' = min(公式 ' + raw8 + ', 负重闸 ' + cap8 + '）');""",
    '含负重闸封顶 · v89.229 口径')

# ================================================================ ② 侦察分层（重复键）
rep('b1 侦察分层夹具去重（0 级）',
    "      garrison: { buxingji: 100, buxingji: 40 } };\n    var sc = G.battle.scoutTarget(tgt, stS.generals[0]);",
    "      /* v89.229：夹具去重 —— 旧 {yibing:100, changqiang:40} 两兵种合并后键相同\n         （JS 对象字面量重复键只留最后一个），改为两道不同兵种，总数 140 不变 */\n      garrison: { buxingji: 100, dunwei: 40 } };\n    var sc = G.battle.scoutTarget(tgt, stS.generals[0]);",
    '{ buxingji: 100, dunwei: 40 } };\n    var sc = G.battle.scoutTarget(tgt, stS.generals[0]);')

rep('b2 侦察分层夹具去重（满级 / 大雾）',
    "      garrison: { buxingji: 100, buxingji: 40 } };",
    "      garrison: { buxingji: 100, dunwei: 40 } };",
    '      garrison: { buxingji: 100, dunwei: 40 } };')

rep('b3 侦察名册字符串换代',
    "    return sc.totalExact === true && sc.gNum === 140 && names === '步行机:100,步行机:40'",
    "    return sc.totalExact === true && sc.gNum === 140 && names === '步行机:100,盾卫:40'",
    "names === '步行机:100,盾卫:40'")

# ================================================================ ③ 募兵面板口径
rep('c1 #7 四页分页',
    """  check('#7 面板含本类兵种分页（v80 两页 → v81 三页：队列 / 步兵 / 机车，计数行退役）', (function () {
    var th = codeOf(uS16, 'ui.troopsHTML = function');
    return /data-action="train-tab"/.test(th) && /data-page="que"/.test(th)
      && /data-page="inf"/.test(th) && /data-page="cav"/.test(th)
      && th.indexOf('ids.filter') < 0;
  })())""",
    """  check('#7 面板分页（v80 两页 → v81 三页 → v89.229 四页：队列 / 后勤支援 / 主力战斗 / 尖端武装）', (function () {
    var th = codeOf(uS16, 'ui.troopsHTML = function');
    return /data-action="train-tab"/.test(th) && /data-page="que"/.test(th)
      && /data-page="g1"/.test(th) && /data-page="g2"/.test(th) && /data-page="g3"/.test(th)
      && th.indexOf('ids.filter') < 0;
  })())""",
    'v89.229 四页：队列 / 后勤支援')

rep('c2 #14 统一入口',
    """  check('#14 募兵面板按建筑分流（v89.211 新规：open-siege 传本作坊自己的 idx）',
    /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx, 'siege'\\)/.test(mS16)
    && /ui\\.openTroops = function/.test(uS16) && /_trainFilter === 'siege'/.test(uS16))""",
    """  check('#14 募兵面板统一入口（v89.229 兵种重构：filter 参退役 · 工位由选中兵种 craft 解析）',
    /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx\\)/.test(mS16)
    && /ui\\.openTroops = function \\(idx\\)/.test(uS16)
    && /var kind = \\(sel && sel\\.craft\\) \\? 'craft' : 'train';/.test(uS16)
    && !/ui\\._trainFilter = /.test(uS16))""",
    'v89.229 兵种重构：filter 参退役')

rep('c3 机工坊入口（主段）',
    """  check('机工坊入口直接开器械面板（不再切中央视图 · v89.211 其传本作坊 idx）',
    /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx, 'siege'\\)/.test(mS32));""",
    """  check('机工坊入口直接开募兵面板（不再切中央视图 · v89.229 统一面板传本作坊 idx）',
    /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx\\)/.test(mS32));""",
    '统一面板传本作坊 idx')

rep('c4 可点选兵种卡（主段）',
    """    G.ui._trainFilter = 'normal';
    /* v81：兵种卡在步兵/机车页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return (html.match(/data-action="select-train"/g) || []).length >= 2;
  })())""",
    """    /* v81：兵种卡在分组页（首页是募兵队列）；v89.229：三组分页 g1/g2/g3，filter 参退役 ——
       卡数按**本组表项**数、可点选数按唯一出口 canTrain（界面与门槛同源）。 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g2';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var ids2 = Object.keys(DATA.TROOPS).filter(function (id) { return DATA.TROOPS[id].grp === 2; });
    var cards = (html.match(/data-troop="/g) || []).length;
    var okN = (html.match(/data-action="select-train"/g) || []).length;
    var expN = ids2.filter(function (id) { return G.canTrain(id).ok; }).length;
    return cards === ids2.length && okN === expN && okN >= 1;
  })())""",
    "卡数按**本组表项**数")

rep('c5 可点选兵种卡（实测段）',
    """    G.ui._trainFilter = 'normal';
    /* v81：兵种卡在步兵/机车页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var hit = (G.ui.troopsHTML().match(/data-action="select-train"/g) || []).length >= 2;
    G.ui._trainTab = bkTab;
    return hit;
  })())""",
    """    /* v81：兵种卡在分组页（首页是募兵队列）；v89.229：三组分页，filter 参退役 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g1';
    var h1 = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var ids1 = Object.keys(DATA.TROOPS).filter(function (id) { return DATA.TROOPS[id].grp === 1; });
    var ok1 = (h1.match(/data-action="select-train"/g) || []).length;
    var exp1 = ids1.filter(function (id) { return G.canTrain(id).ok; }).length;
    return ok1 === exp1 && (h1.match(/data-troop="/g) || []).length === ids1.length;
  })())""",
    "var ids1 = Object.keys(DATA.TROOPS)")

rep('c6 两工位队列文案',
    """  check('募兵面板显示所属训练营与本营队列',
    /ui\\.trainQueueBlock = function/.test(uS37) && /本营募兵队列/.test(uS37)
    && /募兵训练营/.test(uS37))""",
    """  check('募兵面板显示所属工位与本工位队列（v89.229：训练营 / 机工坊各一块）',
    /ui\\.trainQueueBlock = function/.test(uS37) && /本营募兵队列/.test(uS37)
    && /本作坊制造队列/.test(uS37))""",
    '本作坊制造队列')

rep('c7 兵种卡瘦身（g1 页）',
    """    /* v81：兵种卡在步兵/机车页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    /* 逐卡判定（整页有 15 张卡，不是 1 张）：""",
    """    /* v81：兵种卡在分组页（首页是募兵队列）；v89.229：组 1 = 后勤支援（4 张） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g1';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    /* 逐卡判定（整页有 4 张卡，不是 1 张）：""",
    '组 1 = 后勤支援（4 张）')

rep('c8 悬停内容（g1 页）',
    """    /* v81：兵种卡在步兵/机车页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var m = h.match(/<div class="tcard-tip tip-src">([\\s\\S]*?)<\\/div><\\/div>/);""",
    """    /* v81：兵种卡在分组页（首页是募兵队列）；v89.229：组 1 = 后勤支援 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g1';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var m = h.match(/<div class="tcard-tip tip-src">([\\s\\S]*?)<\\/div><\\/div>/);""",
    'v89.229：组 1 = 后勤支援')

rep('c9 ② 实测卡面零 tstat（g1 页）',
    """      var bkF = G.ui._trainFilter, bkT = G.ui._trainTab;
      G.ui._trainFilter = 'normal'; G.ui._trainTab = 'inf';
      var h = G.ui.troopsHTML();
      G.ui._trainFilter = bkF; G.ui._trainTab = bkT;""",
    """      var bkT = G.ui._trainTab;
      G.ui._trainTab = 'g1';                       /* v89.229：filter 参退役 · 组 1 后勤支援 */
      var h = G.ui.troopsHTML();
      G.ui._trainTab = bkT;""",
    "/* v89.229：filter 参退役 · 组 1 后勤支援 */")

rep('c10 募兵耗粮计价',
    """  check('实测：募兵耗粮 ×3（步行机 10 名恰好扣 2400 = 240/名）', (function () {""",
    """  check('实测：募兵耗粮按 data.js 计价（步行机 450/名 · 10 名恰好扣 4500）', (function () {""",
    '步行机 450/名 · 10 名恰好扣 4500')

rep('c11 募兵耗粮断言值',
    """      return r.ok === true && (before - c.res.grain) === 2400
        && DATA.TROOPS.buxingji.cost.grain === 240
        && DATA.TROOPS.zhuzhan.cost.grain === 6000
        && !('food' in DATA.TROOPS.buxingji);
    } finally { G.state = keep; }
  })(), '步行机粮 80→240 · 主战机甲 2000→6000 · food 字段移除')""",
    """      /* v89.229：步行机承长矛手价 450（=150×3 · 旧"×3"口径仍在）·
         主战机甲承重甲战车 5400（=1800×3） */
      return r.ok === true && (before - c.res.grain) === 4500
        && DATA.TROOPS.buxingji.cost.grain === 450
        && DATA.TROOPS.zhuzhan.cost.grain === 5400
        && !('food' in DATA.TROOPS.buxingji);
    } finally { G.state = keep; }
  })(), '步行机承长矛手价 450（=150×3）· 主战机甲承重甲战车 5400（=1800×3）· food 字段移除')""",
    '步行机承长矛手价 450')

# ================================================================ ④ 战场几何
rep('d1 战场距离单调链',
    """    return D(one('buxingji'), one('buxingji')) === eff('buxingji', 'buxingji')
      && D(one('buxingji'), one('buxingji')) === eff('buxingji', 'buxingji')
      && D(one('daodanche'), one('buxingji')) === eff('daodanche', 'buxingji')
      && D(one('huopao'), one('buxingji')) === eff('huopao', 'buxingji')
      /* 射程越远 → 战场越宽（近战也参与比较，所以步行机 < 步行机 < 导弹车 < 自行火炮） */
      && raw('buxingji') < raw('buxingji') && raw('buxingji') < raw('daodanche')""",
    """    /* v89.229（兵种重构）：旧夹具两头是 民兵/长矛手（合并后同 id）—— 首项改用**盾卫**
       （射程 30 < 步行机 50），单调链仍成立：盾卫 < 步行机 < 导弹车 < 自行火炮。 */
    return D(one('dunwei'), one('dunwei')) === eff('dunwei', 'dunwei')
      && D(one('buxingji'), one('buxingji')) === eff('buxingji', 'buxingji')
      && D(one('daodanche'), one('buxingji')) === eff('daodanche', 'buxingji')
      && D(one('huopao'), one('buxingji')) === eff('huopao', 'buxingji')
      /* 射程越远 → 战场越宽（近战也参与比较，所以盾卫 < 步行机 < 导弹车 < 自行火炮） */
      && raw('dunwei') < raw('buxingji') && raw('buxingji') < raw('daodanche')""",
    "raw('dunwei') < raw('buxingji')")

rep('d2 stepsToWall 先后链',
    """  return T.MARCH_UNIT === 1
    && st('fujiche', 1399) < st('buxingji', 1399)
    && st('buxingji', 1399) < st('huopao', 1399)
    /* 纵深越小，步数越少（单调） */
    && st('buxingji', 1399) > st('buxingji', 249)
    && st('daodanche', 1399) === 1;""",
    """  /* v89.229（兵种重构）：旧第三条"长矛手 < 破门车"随合并失效 —— 自行火炮射程 1600 > 纵深 1399，
     1 步即开火（**比步行机更快**），真正慢的是**板车**（射程 10 · 速 180 → 8 步）。 */
  return T.MARCH_UNIT === 1
    && st('fujiche', 1399) < st('buxingji', 1399)
    && st('buxingji', 1399) < st('banche', 1399)
    && st('buxingji', 1399) < st('huopao', 1399)   /* 射程 ≥ 纵深 → 1 步开火（器械不受纵深拖累） */
    /* 纵深越小，步数越少（单调） */
    && st('buxingji', 1399) > st('buxingji', 249)
    && st('daodanche', 1399) === 1;""",
    "st('buxingji', 1399) < st('banche', 1399)")

rep('d3 带远程接敌（去重 + 慢者换板车）',
    """  var cav = ['fujiche', 'kuanglie', 'zhuzhan', 'zhuzhan', 'wuzhi'].map(st);""",
    """  var cav = ['fujiche', 'kuanglie', 'zhuzhan', 'wuzhi'].map(st);   /* v89.229：去重（旧两骑合并） */""",
    "var cav = ['fujiche', 'kuanglie', 'zhuzhan', 'wuzhi'].map(st);")

rep('d4 带远程接敌判据（器械→板车）',
    """    && st('huopao') > st('buxingji');         /* 器械最慢 */""",
    """    && st('banche') > st('buxingji');         /* v89.229：真正慢的是板车（射程 10）；自行火炮射程 1600 → 1 步开火 */""",
    "&& st('banche') > st('buxingji');")

rep('d5 带远程接敌 dbg 去重',
    """  return '纵深' + D + '下 机车' + ['fujiche', 'kuanglie', 'zhuzhan', 'zhuzhan', 'wuzhi'].map(st).join('/') +
    '步 步行机' + st('buxingji') + '步 自行火炮' + st('huopao') + '步';""",
    """  return '纵深' + D + '下 机车' + ['fujiche', 'kuanglie', 'zhuzhan', 'wuzhi'].map(st).join('/') +
    '步 步行机' + st('buxingji') + '步 板车' + st('banche') + '步';""",
    "'步 步行机' + st('buxingji') + '步 板车'")

rep('d6 反击：隔空打判据',
    """  /* 远程隔空打纯近战（步行机射程 20，走到跟前就被打光了）→ 不该有反击 */
  var far = cnt(G.tactic.simulate({ daodanche: 2000 }, null, { buxingji: 2000 }, 0, null, { kind: 'wild' }));
  return melee > 0 && far === 0;""",
    """  /* 远程隔空打纯近战 → 不该有反击。
     v89.229（兵种重构）：步行机承**长矛手速度 300**（> 导弹车 250），2000:2000 时能一路贴脸 → 会吃反击；
     判据改为**压倒性远程**（20000 : 500，近战在接敌前被清空）—— 口径（隔空打不被反击）不变，
     只把"必死"的量级写明（旧民兵速度 200 < 250，"走到跟前就被打光"天然成立）。 */
  var far = cnt(G.tactic.simulate({ daodanche: 20000 }, null, { buxingji: 500 }, 0, null, { kind: 'wild' }));
  return melee > 0 && far === 0;""",
    '压倒性远程**（20000 : 500')

rep('d7 反击 dbg 同步',
    """  return '近战互殴 ' + cnt(G.tactic.simulate({ buxingji: 2000 }, null, { buxingji: 2000 }, 0, null, { kind: 'wild' })) +
    ' 次 / 隔空打 ' + cnt(G.tactic.simulate({ daodanche: 2000 }, null, { buxingji: 2000 }, 0, null, { kind: 'wild' })) + ' 次';""",
    """  return '近战互殴 ' + cnt(G.tactic.simulate({ buxingji: 2000 }, null, { buxingji: 2000 }, 0, null, { kind: 'wild' })) +
    ' 次 / 隔空打(2万:5百) ' + cnt(G.tactic.simulate({ daodanche: 20000 }, null, { buxingji: 500 }, 0, null, { kind: 'wild' })) + ' 次';""",
    "隔空打(2万:5百)")

rep('d8 回合上限：阵列去重',
    """      ['buxingji', 'buxingji', 'dunwei', 'dianci'].forEach(function (x) {
        ['buxingji', 'buxingji', 'dunwei'].forEach(function (y) {""",
    """      /* v89.229（兵种重构）：旧阵列含 民兵+长矛手（合并后同 id）—— 去重后仍是三档 × 两档；
         最慢的一对仍是"步行机/盾卫"（低攻对低攻 → 撞顶 1 场，允许 ≤3）。 */
      ['buxingji', 'dunwei', 'dianci'].forEach(function (x) {
        ['buxingji', 'dunwei'].forEach(function (y) {""",
    "['buxingji', 'dunwei', 'dianci'].forEach(function (x)")

rep('d9 双倍区：近战侧换步行机',
    """  var melee = dbl({ huopao: 3000 }, 'huopao');
  var far = dbl({ huopao: 3000 }, 'huopao');
  return melee > 0 && far === 0;""",
    """  /* v89.229（兵种重构）：近战侧 = **步行机**（射程 50 < 墙前距离 → 冲脸进双倍区）·
     远程侧 = 自行火炮（射程 1600 → "前进"在射程边界停，不进双倍区）。
     旧夹具 破门车/迫击炮 合并后同 id（且自行火炮是远程），两侧取不同兵种。 */
  var melee = dbl({ buxingji: 3000 }, 'buxingji');
  var far = dbl({ huopao: 3000 }, 'huopao');
  return melee > 0 && far === 0;""",
    "var melee = dbl({ buxingji: 3000 }, 'buxingji');")

rep('d10 双倍区 dbg 同步',
    """  return '自行火炮（近战）双倍回合 ' + dbl({ huopao: 3000 }, 'huopao') +
    '　自行火炮（远程）双倍回合 ' + dbl({ huopao: 3000 }, 'huopao');""",
    """  return '步行机（近战）双倍回合 ' + dbl({ buxingji: 3000 }, 'buxingji') +
    '　自行火炮（远程）双倍回合 ' + dbl({ huopao: 3000 }, 'huopao');""",
    "'步行机（近战）双倍回合 '")

rep('d11 单目标制：后排换泰坦机甲',
    """      /* 前排：40 盾卫（先动、占最前）；后排：4000 自行火炮（慢，进不了战）。
         7000 导弹车一轮的**原始伤害足以杀数千**，但只准打光前排的 40 名 ——
         溢出若还在溅射，后排 4000 自行火炮会被顺带打掉，这条断言就红。 */
      var env1 = G.tactic.begin({ daodanche: 7000 }, null, { dunwei: 40, huopao: 4000 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x', field: 700 });""",
    """      /* 前排：40 盾卫（先动、占最前）；后排：4000 泰坦机甲（射程 70 < 纵深 700 → 进不了战）。
         7000 导弹车一轮的**原始伤害足以杀数千**，但只准打光前排的 40 名 ——
         溢出若还在溅射，后排 4000 泰坦机甲会被顺带打掉，这条断言就红。
         v89.229（兵种重构）：旧后排 破门车（近战 · 血厚）合并后并入自行火炮 ——
         而自行火炮射程 1600 > 纵深 700，会开火并**吃反击**（后排掉血 = 假红），
         故后排改用泰坦机甲（射程 70 · 血 15000 · 本轮最厚重的单位），"进不了战"的前提不变。 */
      var env1 = G.tactic.begin({ daodanche: 7000 }, null, { dunwei: 40, taitan: 4000 }, 0, null,
        { sieging: false, kind: 'wild', defName: 'x', field: 700 });""",
    "{ dunwei: 40, taitan: 4000 }, 0, null,")

rep('d12 单目标制：cc 取泰坦机甲',
    """      (env1.units.def || []).forEach(function (u) { if (u.id === 'huopao') cc = u; });
      var okOne = !!ev1 && ev1.hits.length === 1 && ev1.hits[0].splash !== true;""",
    """      (env1.units.def || []).forEach(function (u) { if (u.id === 'taitan') cc = u; });
      var okOne = !!ev1 && ev1.hits.length === 1 && ev1.hits[0].splash !== true;""",
    "if (u.id === 'taitan') cc = u;")

# ================================================================ ⑤ 分页归类
rep('e1 v80 常备兵两页 → 三组',
    """  check('v80：常备兵全部归入步兵/机车两页（无遗漏、无器械混入）', (function () {
    var inf = 0, cav = 0, bad = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      var t = DATA.TROOPS[id];
      if (t.craft) return;
      if (t.cat === 'inf') inf++;
      else if (t.cat === 'cav') cav++;
      else bad++;
    });
    return bad === 0 && inf + cav === 15 && inf > 0 && cav > 0;
  })())""",
    """  check('v89.229：全部 14 兵种都归入三组分页（grp 1/2/3 · 无遗漏、无编外）', (function () {
    var g = { 1: 0, 2: 0, 3: 0 }, bad = 0, craft = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      var t = DATA.TROOPS[id];
      if (t.craft) craft++;                    /* 器械并入组 3，不再单列一页 */
      if (g[t.grp] == null) bad++; else g[t.grp]++;
    });
    return bad === 0 && g[1] + g[2] + g[3] === 14 && g[1] > 0 && g[2] > 0 && g[3] > 0
      && craft === 2;
  })())""",
    '全部 14 兵种都归入三组分页')

rep('e2 v80 兵营页重排分页键',
    """    return th.indexOf('gold-heading') < 0 && th.indexOf('ids.filter') < 0
      && th.indexOf('q-sec-n') < 0 && th.indexOf('本城尚未建造') >= 0
      && /data-action="train-tab"/.test(th) && /data-page="inf"/.test(th) && /data-page="cav"/.test(th);""",
    """    return th.indexOf('gold-heading') < 0 && th.indexOf('ids.filter') < 0
      && th.indexOf('q-sec-n') < 0 && th.indexOf('本城尚未建造') >= 0
      && /data-action="train-tab"/.test(th) && /data-page="g1"/.test(th)
      && /data-page="g2"/.test(th) && /data-page="g3"/.test(th);""",
    """&& /data-page="g2"/.test(th) && /data-page="g3"/.test(th);""")

rep('e3 v81 三页切换键 + 队列块出口',
    """    return /data-page="que"/.test(th) && /data-page="inf"/.test(th) && /data-page="cav"/.test(th)
      && /isQueueTab/.test(th) && th.indexOf('ui.trainQueueBlock(bar, c, kind)') >= 0;""",
    """    return /data-page="que"/.test(th) && /data-page="g1"/.test(th) && /data-page="g2"/.test(th)
      && /data-page="g3"/.test(th)
      && /isQueueTab/.test(th) && /ui\\.trainQueueBlock\\(_bars\\[0\\], c, 'train'\\)/.test(th);""",
    "/ui\\.trainQueueBlock\\(_bars\\[0\\], c, 'train'\\)/")

rep('e4 v81 main.js 白名单',
    """    /case 'train-tab': ui\\._trainTab = \\(\\['que', 'inf', 'cav'\\]\\.indexOf\\(el\\.dataset\\.page\\) >= 0\\)/.test(mS))""",
    """    /case 'train-tab': ui\\._trainTab = \\(\\['que', 'g1', 'g2', 'g3'\\]\\.indexOf\\(el\\.dataset\\.page\\) >= 0\\)/.test(mS))""",
    "\\['que', 'g1', 'g2', 'g3'\\]\\.indexOf\\(el\\.dataset\\.page\\)")

rep('e5 v84 cat → grp',
    """  check('v84：侦察单元归步兵、运输平台归机车（cat 仅决定分页归属）',
    DATA.TROOPS.zhencha.cat === 'inf' && DATA.TROOPS.yunshu.cat === 'cav')""",
    """  check('v89.229：分页归属只认 grp（cat 字段退役 · 侦察单元/运输平台同归组 1）',
    !('cat' in DATA.TROOPS.zhencha) && !('cat' in DATA.TROOPS.yunshu)
    && DATA.TROOPS.zhencha.grp === 1 && DATA.TROOPS.yunshu.grp === 1
    && DATA.TROOPS.buxingji.grp === 2 && DATA.TROOPS.taitan.grp === 3)""",
    '分页归属只认 grp')

rep('e6 两页互斥 → 三页互斥',
    """  check('实测：侦察单元卡在步兵页、运输平台卡在机车页（两页互斥）', (function () {
    var bkF = G.ui._trainFilter, bkT = G.ui._trainTab, bkS = G.ui._trainSel;
    G.ui._trainFilter = 'normal';
    G.ui._trainTab = 'inf';
    var hInf = G.ui.troopsHTML();
    G.ui._trainTab = 'cav';
    var hCav = G.ui.troopsHTML();
    G.ui._trainFilter = bkF; G.ui._trainTab = bkT; G.ui._trainSel = bkS;
    var card = function (h, id) {
      return new RegExp('<div class="troop-card[^>]*data-troop="' + id + '"').test(h);
    };
    return card(hInf, 'zhencha') && !card(hCav, 'zhencha')
      && card(hCav, 'yunshu') && !card(hInf, 'yunshu');
  })())""",
    """  check('实测：每个兵种只出现在本组页（三页互斥 · v89.229 分组）', (function () {
    var bkT = G.ui._trainTab, bkS = G.ui._trainSel;
    var card = function (h, id) {
      return new RegExp('<div class="troop-card[^>]*data-troop="' + id + '"').test(h);
    };
    var at = function (tab) { G.ui._trainTab = tab; return G.ui.troopsHTML(); };
    var h1 = at('g1'), h2 = at('g2'), h3 = at('g3');
    G.ui._trainTab = bkT; G.ui._trainSel = bkS;
    return card(h1, 'banche') && !card(h2, 'banche') && !card(h3, 'banche')
      && card(h2, 'buxingji') && !card(h1, 'buxingji') && !card(h3, 'buxingji')
      && card(h3, 'taitan') && !card(h1, 'taitan') && !card(h2, 'taitan');
  })())""",
    '每个兵种只出现在本组页')

# ================================================================ ⑥ 负重 / 两营 / 杂项
rep('f1 D 俘获口径夹具去重',
    """      var r1 = G.battle.captiveGain(c99, { defLoss: 1000 }, tF, null, { buxingji: 600, buxingji: 400 });""",
    """      /* v89.229：夹具去重（旧 义兵/长矛手 合并后同 id）—— 拆分口径不变（按损失比 600:400） */
      var r1 = G.battle.captiveGain(c99, { defLoss: 1000 }, tF, null, { buxingji: 600, dunwei: 400 });""",
    "{ buxingji: 600, dunwei: 400 });")

rep('f2 D 俘获拆分断言',
    """      var split = (r1.byType.buxingji === 48 && r1.byType.buxingji === 32);""",
    """      var split = (r1.byType.buxingji === 48 && r1.byType.dunwei === 32);""",
    "r1.byType.dunwei === 32")

rep('f3 ① 负重标定（步行机 60）',
    """    check('① 负重标定：步行机 50（步兵基准）· 板车 500 · 运输平台 20000 · 侦察单元 30', (function () {
      return D94.TROOPS.buxingji.load === 50 && D94.TROOPS.banche.load === 500""",
    """    check('① 负重标定：步行机 60（步兵基准 · 承长矛手）· 板车 500 · 运输平台 20000 · 侦察单元 30', (function () {
      return D94.TROOPS.buxingji.load === 60 && D94.TROOPS.banche.load === 500""",
    '步行机 60（步兵基准 · 承长矛手）')

rep('f4 ① 搬运计划三态（载重 6000）',
    """      /* 去程辎重挤占运力：100 步行机 5000 载重 − 4000 辎重 = 1000 */""",
    """      /* 去程辎重挤占运力：100 步行机 6000 载重（承长矛手 60）× − 4000 辎重 = 2000 */""",
    '100 步行机 6000 载重')

rep('f5 ① 搬运计划 Dv.cap',
    """        && Dv.cap === 1000 && Dv.kept <= Dv.cap && Dv.kept > 0 && Dv.factor < 1;""",
    """        && Dv.cap === 2000 && Dv.kept <= Dv.cap && Dv.kept > 0 && Dv.factor < 1;""",
    "&& Dv.cap === 2000 && Dv.kept")

rep('f6 ③ 两营夹具去重',
    """        s.wounded = 900; s.woundedArmy = { buxingji: 600, buxingji: 300 };""",
    """        /* v89.229：夹具去重（旧 义兵/长矛手 合并后同 id） */
        s.wounded = 900; s.woundedArmy = { buxingji: 600, dunwei: 300 };""",
    "s.woundedArmy = { buxingji: 600, dunwei: 300 };")

rep('f7 ③ 两营名册断言',
    """        return /步行机/.test(h) && /步行机/.test(h) && /伏击车/.test(h) && /来历不明/.test(h)""",
    """        return /步行机/.test(h) && /盾卫/.test(h) && /伏击车/.test(h) && /来历不明/.test(h)""",
    "/盾卫/.test(h) && /伏击车/.test(h)")

rep('f8 ⑦ 自动治疗界面文案',
    """          && /步行机/.test(his) && /弩/.test(his) && /800/.test(his);""",
    """          && /步行机/.test(his) && /导弹车/.test(his) && /800/.test(his);""",
    "/导弹车/.test(his) && /800/.test(his);")

rep('f9 ① 俘虏营明细去重',
    """        st.captives = { buxingji: 40, buxingji: 12 };""",
    """        /* v89.229：夹具去重（旧 义兵/长矛手 合并后同 id） */
        st.captives = { buxingji: 40, dunwei: 12 };""",
    "st.captives = { buxingji: 40, dunwei: 12 };")

rep('f10 ⑤ 回放帧夹具换盾卫',
    """        var r = G.tactic.simulate({ buxingji: 4000 }, null, { buxingji: 6000 }, 0, null, { kind: 'wild' });
        var rf = G.battle.replayFramesOf(r);""",
    """        /* v89.229：旧夹具 长矛手 vs 民兵 合并后同 id（同名互射会把配对键串台）——
           保留"两种不同兵种"的原始意图：步行机 4000 vs 盾卫 6000。 */
        var r = G.tactic.simulate({ buxingji: 4000 }, null, { dunwei: 6000 }, 0, null, { kind: 'wild' });
        var rf = G.battle.replayFramesOf(r);""",
    "{ buxingji: 4000 }, null, { dunwei: 6000 }")

rep('f11 §120⑦ 负重顶（走数据表）',
    """      var ok = yTie.loadLimited === true && yTie.amount === yTie.loadCap
        && yMin.loadLimited === false
        && yZhou.amount > yTie.amount
        && yTie.loadCap === Math.round(600000 * 2) && yZhou.loadCap > yTie.loadCap;""",
    """      /* v89.229：主战机甲承重甲战车（负重 220）→ 载重 3000×220=66 万 × loadMul 2 = 132 万。
         不写死数字 —— 走数据表（唯一出口 GAME.gatherLoadOf 同源），改平衡即自动跟随。 */
      var capTie = Math.round(3000 * D94.TROOPS.zhuzhan.load * (D94.GATHER.loadMul || 1));
      var ok = yTie.loadLimited === true && yTie.amount === yTie.loadCap
        && yMin.loadLimited === false
        && yZhou.amount > yTie.amount
        && yTie.loadCap === capTie && yZhou.loadCap > yTie.loadCap;""",
    'var capTie = Math.round(3000 * D94.TROOPS.zhuzhan.load')

rep('f12 §120⑦ 标题去硬编码数字',
    """    check('§120⑦ 实测：纯主战机甲触负重顶（291.6万→120万）· 板车不触顶 · 运输平台解锁采力', (function () {""",
    """    check('§120⑦ 实测：纯主战机甲触负重顶（截到载重上限）· 板车不触顶 · 运输平台解锁采力', (function () {""",
    '纯主战机甲触负重顶（截到载重上限）')

rep('f13 §121⑥ 夹具去重',
    """        c0.army = { buxingji: 1000, buxingji: 800, daodanche: 600 };""",
    """        /* v89.229：夹具去重（旧 义兵/长矛手 合并后同 id） */
        c0.army = { buxingji: 1000, dunwei: 800, daodanche: 600 };""",
    "c0.army = { buxingji: 1000, dunwei: 800, daodanche: 600 };")

rep('f14 §121⑥ 断言去重',
    """        ok = byCfg.total === 500 && byCfg.army.buxingji === 500
          && (byCfg.army.buxingji || 0) === 0 && (byCfg.army.daodanche || 0) === 0""",
    """        ok = byCfg.total === 500 && byCfg.army.buxingji === 500
          && (byCfg.army.dunwei || 0) === 0 && (byCfg.army.daodanche || 0) === 0""",
    "(byCfg.army.dunwei || 0) === 0")

# ================================================================ ⑦ 简称 / 形态 / 时长
rep('g1 §129③ 简称 14 兵种',
    """  check('§129③ 一字简称：18 兵种齐备 · 两两唯一 · 唯一出口 troopAbOf（缺字段兜底首字）', (function () {""",
    """  check('§129③ 一字简称：14 兵种齐备 · 两两唯一 · 唯一出口 troopAbOf（缺字段兜底首字）', (function () {""",
    '一字简称：14 兵种齐备')

rep('g2 §129③ 基数与出口值',
    """      return bad.length === 0 && ids.length >= 18
        && G.troopAbOf('buxingji') === '矛' && G.troopAbOf('taitan') === '兽'
        && G.troopAbOf('__no_such__') === '';""",
    """      return bad.length === 0 && ids.length >= 14
        && G.troopAbOf('buxingji') === '步' && G.troopAbOf('taitan') === '泰'
        && G.troopAbOf('__no_such__') === '';""",
    "G.troopAbOf('buxingji') === '步'")

rep('g3 §129③/§151 侧栏简称',
    """      return /<i class="bt-rnm" data-tip-el="1">矛<span class="tip-src">/.test(html)""",
    """      return /<i class="bt-rnm" data-tip-el="1">步<span class="tip-src">/.test(html)""",
    'data-tip-el="1">步<span class="tip-src">')

rep('g4 §130① 形态出口改 ride',
    """      var okFn = /GAME\\.troopShapeOf = function/.test(d130)
        && /if \\(t\\.craft\\) return 'siege';/.test(d130) && /t\\.cat === 'cav'/.test(d130);""",
    """      var okFn = /GAME\\.troopShapeOf = function/.test(d130)
        && /if \\(t\\.craft\\) return 'siege';/.test(d130)
        && /if \\(t\\.ride\\) return 'cav';/.test(d130)
        && d130.indexOf("t.cat === 'cav'") < 0;      /* v89.229：cat 退役 → ride 显式字段 */""",
    "/if \\(t\\.ride\\) return 'cav';/")

rep('g5 §163 表序即分组序 + 面值',
    """  check('§163 排序保持 + 卡面显示（步行机「10秒」/ 导弹车「1分」/ 泰坦机甲「5分」）', (function () {
    var inf = ['buxingji', 'banche', 'zhencha', 'kuanglie', 'buxingji', 'dianci', 'dunwei', 'daodanche'];
    for (var i = 1; i < inf.length; i++) if (DATA.TROOPS[inf[i]].time < DATA.TROOPS[inf[i - 1]].time) return false;
    var cav = ['wuzhi', 'kuanglie', 'fujiche', 'yunshu', 'zhuzhan', 'zhuzhan', 'taitan'];
    for (var j = 1; j < cav.length; j++) if (DATA.TROOPS[cav[j]].time < DATA.TROOPS[cav[j - 1]].time) return false;
    return U.dur(DATA.TROOPS.buxingji.time) === '10秒' && U.dur(DATA.TROOPS.daodanche.time) === '1分'
      && U.dur(DATA.TROOPS.taitan.time) === '5分';
  })())""",
    """  check('§163 表序即分组序（grp 连续块 · 无交错）+ 卡面显示（步行机「30秒」/ 导弹车「1分」/ 泰坦机甲「5分」）', (function () {
    /* v89.229（兵种重构）**规则变更**：旧的"同类内按时长升序"排序断言随分页重构退役 ——
       新表序 = 老板给定的三组分页序（后勤支援 4 / 主力战斗 5 / 尖端武装 5），
       组块**连续**才是新口径的不变量（面板按表序渲染，组页互斥）。 */
    var ids = Object.keys(DATA.TROOPS), seen = {}, seq = [];
    for (var i = 0; i < ids.length; i++) {
      var g = DATA.TROOPS[ids[i]].grp;
      if (seen[g]) return false;                 /* 同组再出现 = 交错 */
      if (seq.length && seq[seq.length - 1] === g) continue;
      seq.push(g); seen[g] = 1;
      if (g !== seq.length) return false;        /* 组号必须按 1,2,3 顺序出现 */
    }
    var cnt = {};
    ids.forEach(function (id) { cnt[DATA.TROOPS[id].grp] = (cnt[DATA.TROOPS[id].grp] || 0) + 1; });
    return seq.length === 3 && cnt[1] === 4 && cnt[2] === 5 && cnt[3] === 5
      && U.dur(DATA.TROOPS.buxingji.time) === '30秒' && U.dur(DATA.TROOPS.daodanche.time) === '1分'
      && U.dur(DATA.TROOPS.taitan.time) === '5分';
  })())""",
    '表序即分组序（grp 连续块')

rep('g6 §164② 五条对齐关系换代',
    """  check('§164② ★ 狂猎=步行机 · 盾卫=电磁盾卫 · 伏击车=狂猎 · 主战机甲=主战机甲 · 武装直升机>导弹车', (function () {
    var T = DATA.TROOPS;
    return T.kuanglie.time === T.buxingji.time
      && T.dunwei.time === T.dianci.time
      && T.fujiche.time === T.kuanglie.time
      && T.zhuzhan.time === T.zhuzhan.time
      && T.wuzhi.time > T.daodanche.time;
  })(), '旧军/步行机 ' + DATA.TROOPS.kuanglie.time + ' · 盾卫/电磁盾卫 ' + DATA.TROOPS.dunwei.time
    + ' · 武装直升机 ' + DATA.TROOPS.wuzhi.time + '>导弹车 ' + DATA.TROOPS.daodanche.time
    + ' · 伏击车/狂猎 ' + DATA.TROOPS.fujiche.time + ' · 主战机甲/主战机甲 ' + DATA.TROOPS.zhuzhan.time)""",
    """  check('§164②/§229 ★ 征兵时长承原型：狂猎=伏击车 · 盾卫=电磁盾卫 · 武装直升机>导弹车 · 主战机甲>步行机 · 泰坦机甲最慢', (function () {
    /* v89.229（兵种重构）**规则变更**：五条对齐关系的锚点随 18→14 换代 ——
       合并后仍成立的是"原型对"：狂猎=王牌战车 70 = 伏击车=摩托游骑 70 ·
       盾卫 35 = 电磁盾卫=防暴甲兵 35 · 武装直升机=突击摩托 65 > 导弹车=弩手 60 ·
       主战机甲=重甲战车 150 > 步行机=长矛手 30 · 泰坦机甲=变异巨兽 300 = 全表最慢。 */
    var T = DATA.TROOPS;
    return T.kuanglie.time === T.fujiche.time
      && T.dunwei.time === T.dianci.time
      && T.wuzhi.time > T.daodanche.time
      && T.zhuzhan.time > T.buxingji.time
      && T.taitan.time > T.zhuzhan.time
      && Object.keys(T).every(function (id) { return T[id].time <= T.taitan.time; });
  })(), '狂猎/伏击车 ' + DATA.TROOPS.kuanglie.time + ' · 盾卫/电磁盾卫 ' + DATA.TROOPS.dunwei.time
    + ' · 武装直升机 ' + DATA.TROOPS.wuzhi.time + '>导弹车 ' + DATA.TROOPS.daodanche.time
    + ' · 主战机甲 ' + DATA.TROOPS.zhuzhan.time + '>步行机 ' + DATA.TROOPS.buxingji.time
    + ' · 泰坦机甲 ' + DATA.TROOPS.taitan.time + '（全表最慢）')""",
    '征兵时长承原型：狂猎=伏击车')

rep('g7 §164③ 镜像小局去重（合并量补回）',
    """      var A = { buxingji: 500, buxingji: 500, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 };""",
    """      /* v89.229（兵种重构）：旧阵列 民兵 500 + 长矛手 500 合并为**步行机 1000**
         （同 id 的重复键在对象字面量里只剩一个，必须显式相加 —— 否则镜像局兵力少一半）。 */
      var A = { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 };""",
    "var A = { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 };")

rep('g8 §180① 三器械 mech',
    """  check('§180① 拆械表：无人轰炸机 vsMech=3 · 四器械 mech 标签 · 非器械零污染', (function () {
    var T = DATA.TROOPS;
    var mechIds = Object.keys(T).filter(function (k) { return T[k].mech; }).sort();
    return T.wuren.vsMech === 3
      && mechIds.join(',') === 'huopao,wuren,huopao,yunshu'
      && !T.buxingji.mech && !T.fujiche.mech && !T.daodanche.mech;
  })())""",
    """  check('§180① 拆械表：无人轰炸机 vsMech=3 · 三器械 mech 标签（四原型合并）· 非器械零污染', (function () {
    /* v89.229（兵种重构）：mech 集合随 18→14 换代 —— 破门车+迫击炮 合并为自行火炮
       → 器械从四项变三 id（huopao / wuren / yunshu），集合语义不变。 */
    var T = DATA.TROOPS;
    var mechIds = Object.keys(T).filter(function (k) { return T[k].mech; }).sort();
    return T.wuren.vsMech === 3
      && mechIds.join(',') === 'huopao,wuren,yunshu'
      && !T.buxingji.mech && !T.fujiche.mech && !T.daodanche.mech;
  })())""",
    "三器械 mech 标签（四原型合并）")

rep('g9 §211⑥ 源码链统一入口',
    """      return /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx, 'siege'\\)/.test(mS211)
        && /_b211 \\? _b211\\.idx : null/.test(uS211)
        && /_bar211 \\? _bar211\\.idx : null/.test(mS211);""",
    """      return /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx\\)/.test(mS211)
        && /_b211 \\? _b211\\.idx : null/.test(uS211)
        && /_bar211 \\? _bar211\\.idx : null/.test(mS211);""",
    "return /case 'open-siege': ui\\.openTroops\\(el\\.dataset\\.idx\\)/.test(mS211)")

# ================================================================ ⑧ §223 简称逐字对表
rep('h1 §223 映射表换代',
    """    var MAP223 = { banche: '搬', buxingji: '民', zhencha: '斥', buxingji: '矛', dunwei: '盾', daodanche: '弩',
      fujiche: '摩', zhuzhan: '装', yunshu: '运', wuren: '重', huopao: '破', huopao: '炮',
      kuanglie: '旧', dianci: '防', wuzhi: '突', kuanglie: '王', zhuzhan: '甲', taitan: '兽' };
    var OLD223 = ['枪', '弓', '轻', '铁', '辎', '冲', '投', '青', '藤', '虎', '西', '象', '义'];""",
    """    /* v89.229（兵种重构）：18 兵种 → 14 兵种，一字简称逐项换代
       （板伏侦运步盾弹直主狂磁炮轰泰 —— 两两唯一）。 */
    var MAP223 = { banche: '板', fujiche: '伏', zhencha: '侦', yunshu: '运',
      buxingji: '步', dunwei: '盾', daodanche: '弹', wuzhi: '直', zhuzhan: '主',
      kuanglie: '狂', dianci: '磁', huopao: '炮', wuren: '轰', taitan: '泰' };
    /* 上一代（18 兵种）的简称里**未被继承**的字 —— 全部必须零残留。
       盾/运/炮 三个字被新表继承（盾卫/运输平台/自行火炮承原型），故不列入。 */
    var OLD223 = ['搬', '民', '斥', '矛', '弩', '摩', '装', '重', '破', '旧', '防', '突', '王', '甲', '兽'];""",
    "var MAP223 = { banche: '板', fujiche: '伏'")

rep('h2 §223① 标题与基数',
    """    check('§223① 兵牌简称换代逐字对表（18 兵种 · 两两唯一 · 旧字零残留 · 出口同源）', (function () {""",
    """    check('§223①/§229① 兵牌简称逐字对表（14 兵种 · 两两唯一 · 旧字零残留 · 出口同源）', (function () {""",
    '兵牌简称逐字对表（14 兵种')

rep('h3 §223① 基数断言',
    """      /* 基数自证：18 项全在表内（防"表被删空也全绿"的平凡解） */
      return bad.length === 0 && keys.length === 18
        && Object.keys(DATA.TROOPS).length === keys.length;""",
    """      /* 基数自证：14 项全在表内（防"表被删空也全绿"的平凡解） */
      return bad.length === 0 && keys.length === 14
        && Object.keys(DATA.TROOPS).length === keys.length;""",
    "return bad.length === 0 && keys.length === 14")

rep('h4 §223② 标题换代',
    """    check('§223② data.js 可执行形态：旧字 ab 定义零残留 + 18 新字全在册', (function () {""",
    """    check('§223②/§229② data.js 可执行形态：旧字 ab 定义零残留 + 14 新字全在册', (function () {""",
    '旧字 ab 定义零残留 + 14 新字全在册')

rep('h5 §223④ 任务文案换代',
    """    check('§223④ 产品侧收尾在册：任务文案换弩 · icons 换「泰坦机甲」', (function () {
      var q223 = rd223('js/questdata.js'), ic223 = rd223('js/icons.js');
      return q223.indexOf("title: '导弹车扩充'") >= 0 && q223.indexOf('补足导弹车') >= 0
        && q223.indexOf("title: '强弩之利'") >= 0 && q223.indexOf('强弩利矢') >= 0
        && ic223.indexOf('/* 泰坦机甲 */') >= 0 && ic223.indexOf('/* 战象 */') < 0;
    })(), '')""",
    """    check('§223④/§229④ 产品侧收尾在册：任务文案换代（导弹车/自行火炮）· icons 换「泰坦机甲」', (function () {
      var q223 = rd223('js/questdata.js'), ic223 = rd223('js/icons.js');
      /* v89.229：任务文案随兵种重构换代（弩手 → 导弹车；旧「强弩之利」→「炮火破城」） */
      return q223.indexOf("title: '导弹列阵'") >= 0 && q223.indexOf('补足导弹车') >= 0
        && q223.indexOf("title: '炮火破城'") >= 0 && q223.indexOf('炮火可碎城楼') >= 0
        && ic223.indexOf('/* 泰坦机甲 */') >= 0 && ic223.indexOf('/* 战象 */') < 0;
    })(), '')""",
    '任务文案换代（导弹车/自行火炮）')

# ---------------------------------------------------------------- 写后自检
s = rd(P_SMOKE)
bad = []
if s.count('\r\n'):
    bad.append('CRLF 混入 ' + str(s.count('\r\n')))
for pat in ['//s*', '\\\\u{', 'check(  ', 'undefinedundefined']:
    if pat in s:
        bad.append('坏值模式 ' + pat)
braces = len(re.findall(r'(?<![\\^])\{', s)) - len(re.findall(r'(?<![\\^])\}', s))
LOG.append('花括号差值 = ' + str(braces) + '（应 0）')
if braces != 0:
    bad.append('括号不配平')
LOG.append('文件长度 = ' + str(len(s)))
if bad:
    LOG.append('!!! 自检失败：' + ' | '.join(bad))
else:
    LOG.append('自检通过')

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c9_report.txt'), 'w', encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
