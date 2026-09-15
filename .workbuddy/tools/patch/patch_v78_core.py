# -*- coding: utf-8 -*-
"""v78 · 核心层：灵草时序拉长 + 种子改为活动获得（去黄金） + 隐藏「灵淬」升档加成。

老板原文（需求档案 v78 节）：
  1. 种地秘境的灵草作物时间逐级再拉长一点。种子只有通过将领其他活动获得，而不是花金币
  2. 一个隐藏设定，将领低资质通过蕴灵草等提升资质时，能比直接招募获得额外提升
     （你来衡量一下，不要太失衡）

落点：
  data.js   —— 4 灵草时长 12/24/48/96（逐级翻倍）· 10 作物改 seedItem（去黄金价）·
               5 种种子道具 · DATA.SEED_DROP 掉落表 · GEN_RANKS 加 ascend（灵淬）
  state.js  —— rankUpUse：升档时按新档 ascend 给四维加成（隐藏机制唯一出口）
  domain.js —— farmPlant 改种子制；新增 GAME.grantSeedDrop（掉落唯一出口）；
               finishGather 挂种子掉落；宝物池排除种子
  battle.js —— expedition 获胜块挂种子缴获
  systems.js—— useItem 加 seed 分支（种子不直接使用，指路秘境）
"""
import io
import sys

DATA = r'E:\Deepseekdb\js\data.js'
ST = r'E:\Deepseekdb\js\state.js'
DOM = r'E:\Deepseekdb\js\domain.js'
BAT = r'E:\Deepseekdb\js\battle.js'
SYS = r'E:\Deepseekdb\js\systems.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    # ⚠️ 行尾铁律：**先试 LF 变体，找不到才试 CRLF**（elif，不是两个都收）。
    # 老写法两个都收、取 cands[-1]，会把"单行锚点 + 多行新文本"的新文本强行转成
    # CRLF —— 落在 LF 文件里就是混行尾（v78 实测踩中，13+3 行污染）
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== A. data.js ==')
# A1 · 农场段头注释（黄金买种 → 种子制）
patch(DATA,
"""   *   黄金 → 秘境买种子 → 灵田播种 → 游戏时间生长 → 收获""",
"""   *   种子（采集 / 征战所得，**不花黄金**）→ 灵田播种 → 游戏时间生长 → 收获""",
'A1a 农场段头链')
patch(DATA,
"""   *   · seed  = 种子价（黄金）—— 黄金因此有了新用途（与需求 1 一拍即合）""",
"""   *   · seedItem = 所需种子（v78：种子只能从将领活动获得 —— 采集归来 / 出征缴获，
   *               见 GAME.grantSeedDrop 与 DATA.SEED_DROP；**不花黄金**）""",
'A1b 段头字段说明')

# A2 · 10 个作物：黄金价 → seedItem；4 灵草时长拉到 12/24/48/96（逐级翻倍）
patch(DATA,
"""      { id: 'tieying',     name: '铁英树', icon: '🌳', hours: 6,  seed: 5000,   mat: 'bintie',  rare: 'yuntie',     rareP: 0.15, qty: [2, 4], desc: '根须吸铁成英，可炼镔铁；偶结陨铁' },""",
"""      { id: 'tieying',     name: '铁英树', icon: '🌳', hours: 6,  seedItem: 'seed_fan', mat: 'bintie',  rare: 'yuntie',     rareP: 0.15, qty: [2, 4], desc: '根须吸铁成英，可炼镔铁；偶结陨铁' },""",
'A2a 铁英树')
patch(DATA,
"""      { id: 'tanxiangshu', name: '檀香树', icon: '🌲', hours: 6,  seed: 5000,   mat: 'tanmu',   rare: 'jianmu',     rareP: 0.15, qty: [2, 4], desc: '香气沉郁、坚重近铁，可伐檀木' },""",
"""      { id: 'tanxiangshu', name: '檀香树', icon: '🌲', hours: 6,  seedItem: 'seed_fan', mat: 'tanmu',   rare: 'jianmu',     rareP: 0.15, qty: [2, 4], desc: '香气沉郁、坚重近铁，可伐檀木' },""",
'A2b 檀香树')
patch(DATA,
"""      { id: 'xipiteng',    name: '犀皮藤', icon: '🪴', hours: 6,  seed: 5000,   mat: 'xige',    rare: 'jiaoge',     rareP: 0.15, qty: [2, 4], desc: '藤皮七层如犀甲，可制犀革' },""",
"""      { id: 'xipiteng',    name: '犀皮藤', icon: '🪴', hours: 6,  seedItem: 'seed_fan', mat: 'xige',    rare: 'jiaoge',     rareP: 0.15, qty: [2, 4], desc: '藤皮七层如犀甲，可制犀革' },""",
'A2c 犀皮藤')
patch(DATA,
"""      { id: 'jiaojinteng', name: '蛟筋藤', icon: '🌿', hours: 6,  seed: 5000,   mat: 'jiaojin', rare: 'longjin',    rareP: 0.15, qty: [2, 4], desc: '藤筋韧可曳石，绞之为索' },""",
"""      { id: 'jiaojinteng', name: '蛟筋藤', icon: '🌿', hours: 6,  seedItem: 'seed_fan', mat: 'jiaojin', rare: 'longjin',    rareP: 0.15, qty: [2, 4], desc: '藤筋韧可曳石，绞之为索' },""",
'A2d 蛟筋藤')
patch(DATA,
"""      { id: 'yusuihua',    name: '玉髓花', icon: '🌸', hours: 6,  seed: 5000,   mat: 'yangzhi', rare: 'kunshan',    rareP: 0.15, qty: [2, 4], desc: '花凝玉髓，温润如脂' },""",
"""      { id: 'yusuihua',    name: '玉髓花', icon: '🌸', hours: 6,  seedItem: 'seed_fan', mat: 'yangzhi', rare: 'kunshan',    rareP: 0.15, qty: [2, 4], desc: '花凝玉髓，温润如脂' },""",
'A2e 玉髓花')
patch(DATA,
"""      { id: 'yunjinsang',  name: '云锦桑', icon: '🍃', hours: 6,  seed: 5000,   mat: 'shujin',  rare: 'yunjin',     rareP: 0.15, qty: [2, 4], desc: '桑叶吐丝成锦，日光流转' },""",
"""      { id: 'yunjinsang',  name: '云锦桑', icon: '🍃', hours: 6,  seedItem: 'seed_fan', mat: 'shujin',  rare: 'yunjin',     rareP: 0.15, qty: [2, 4], desc: '桑叶吐丝成锦，日光流转' },""",
'A2f 云锦桑')
patch(DATA,
"""      { id: 'yunlingcao',  name: '蕴灵草', icon: '🌱', hours: 12, seed: 20000,  herb: 'yunlingcao',  desc: '灵气温养，助 凡品 将领洗出 良材 之资' },""",
"""      { id: 'yunlingcao',  name: '蕴灵草', icon: '🌱', hours: 12, seedItem: 'seed_yunling',  herb: 'yunlingcao',  desc: '灵气温养，助 凡品 将领洗出 良材 之资' },""",
'A2g 蕴灵草')
patch(DATA,
"""      { id: 'xisuizhi',    name: '洗髓芝', icon: '🍄', hours: 24, seed: 60000,  herb: 'xisuizhi',    desc: '洗髓伐骨，助 良材 将领跃入 英杰 之列' },""",
"""      { id: 'xisuizhi',    name: '洗髓芝', icon: '🍄', hours: 24, seedItem: 'seed_xisui',    herb: 'xisuizhi',    desc: '洗髓伐骨，助 良材 将领跃入 英杰 之列' },""",
'A2h 洗髓芝')
patch(DATA,
"""      { id: 'hualongshen', name: '化龙参', icon: '🪷', hours: 36, seed: 150000, herb: 'hualongshen', desc: '鱼跃龙门之参，助 英杰 将领跻身 名世' },""",
"""      { id: 'hualongshen', name: '化龙参', icon: '🪷', hours: 48, seedItem: 'seed_hualong', herb: 'hualongshen', desc: '鱼跃龙门之参，助 英杰 将领跻身 名世' },""",
'A2i 化龙参（36→48）')
patch(DATA,
"""      { id: 'tianshouguo', name: '天授果', icon: '🍑', hours: 48, seed: 400000, herb: 'tianshouguo', desc: '百年一熟的天授之果，名世 亦可问鼎 天授' },""",
"""      { id: 'tianshouguo', name: '天授果', icon: '🍑', hours: 96, seedItem: 'seed_tianshou', herb: 'tianshouguo', desc: '百年一熟的天授之果，名世 亦可问鼎 天授' },""",
'A2j 天授果（48→96）')

# A3 · 5 种种子道具（挂到 rank_up 灵草道具之后）
patch(DATA,
"""    { id: 'tianshouguo', name: '天授果', type: 'rank_up', from: 'ming', to: 'tian', price: 0, desc: '将领资质：名世 → 天授（种田秘境产）' },""",
"""    { id: 'tianshouguo', name: '天授果', type: 'rank_up', from: 'ming', to: 'tian', price: 0, desc: '将领资质：名世 → 天授（种田秘境产）' },
    /* v78（老板需求 1）：**种子** —— 种田秘境专用，**不花金币**，
       只能从将领活动获得（采集归来 / 出征缴获；见 DATA.SEED_DROP 与 GAME.grantSeedDrop）。
       凡植种子对应 6 种材料作物；四种灵种一一对应四档灵草。 */
    { id: 'seed_fan',      name: '凡植种子', type: 'seed', price: 30,   desc: '寻常灵植之种：于种田秘境可种 6 种材料作物（来源：采集归来 / 出征缴获）' },
    { id: 'seed_yunling',  name: '蕴灵种子', type: 'seed', price: 150,  desc: '蕴灵草之种：种成可助 凡品 将领洗出 良材 之资（来源：采集归来 / 出征缴获）' },
    { id: 'seed_xisui',    name: '洗髓种子', type: 'seed', price: 450,  desc: '洗髓芝之种：种成可助 良材 将领跃入 英杰 之列（来源：中高级野地 / 名城缴获）' },
    { id: 'seed_hualong',  name: '化龙种子', type: 'seed', price: 1200, desc: '化龙参之种：种成可助 英杰 将领跻身 名世（来源：高级野地 / 名城缴获）' },
    { id: 'seed_tianshou', name: '天授种子', type: 'seed', price: 3600, desc: '天授果之种：种成可助 名世 将领问鼎 天授（来源：顶级野地 / 州城·帝都缴获）' },""",
'A3 五种种子道具')

# A4 · DATA.SEED_DROP 掉落表（挂在 FARM_CROP_BY_ID 之后）
patch(DATA,
"""  DATA.FARM_CROP_BY_ID = {};
  DATA.FARM.crops.forEach(function (c) { DATA.FARM_CROP_BY_ID[c.id] = c; });""",
"""  DATA.FARM_CROP_BY_ID = {};
  DATA.FARM.crops.forEach(function (c) { DATA.FARM_CROP_BY_ID[c.id] = c; });

  /* v78（老板需求 1）：种子掉落表 —— **唯一出口** GAME.grantSeedDrop。
     种子只能从将领活动获得（采集归来 / 出征获胜），**没有黄金购买口**。
     每次结算按来源等级 lv（野地 1~10 级；城池按档折算 cityLv）掷下表：
       p = base + perLv × lv；lv < minLv 不掉。
     调平衡只改这张表（数据驱动，别处不许另起概率）。 */
  DATA.SEED_DROP = {
    battleMult: 0.85,   /* 战事结算的整体折扣（采集是主渠道） */
    cityLv: { fort: 4, county: 3, jun: 5, zhou: 7, capital: 9 },
    table: [
      { id: 'seed_fan',      name: '凡植种子', minLv: 1, base: 0.45,  perLv: 0.030, qty: [1, 2] },
      { id: 'seed_yunling',  name: '蕴灵种子', minLv: 1, base: 0.030, perLv: 0.013, qty: [1, 1] },
      { id: 'seed_xisui',    name: '洗髓种子', minLv: 3, base: 0.010, perLv: 0.008, qty: [1, 1] },
      { id: 'seed_hualong',  name: '化龙种子', minLv: 6, base: 0.006, perLv: 0.004, qty: [1, 1] },
      { id: 'seed_tianshou', name: '天授种子', minLv: 8, base: 0.004, perLv: 0.003, qty: [1, 1] },
    ],
  };""",
'A4 种子掉落表')

# A5 · GEN_RANKS 加 ascend（灵淬：升档时四维各加的隐藏加成）
patch(DATA,
"""    { id: 'liang', name: '良材', color: '#5fbf6a', star: 2, w: 27, wg: 0.00, base: [46, 62], grow: 2, price: 1.8, lvCap: 100,""",
"""    /* v78（老板需求 2 · 隐藏设定）：`ascend` = 灵草升档时四维**各加**的点数
       （「低资质将领通过灵草提升资质时，能比直接招募获得额外提升」）——
       取新档的成长值：良材 2 / 英杰 3 / 名世 5 / 天授 8，全链 +18/维。
       机制刻意隐藏：界面不提示，只在属性里体现；数值集中在此，调平衡只改这里。 */
    { id: 'liang', name: '良材', color: '#5fbf6a', star: 2, w: 27, wg: 0.00, base: [46, 62], grow: 2, price: 1.8, lvCap: 100, ascend: 2,""",
'A5a 良材 ascend')
patch(DATA,
"""    { id: 'ying', name: '英杰', color: '#4a9be0', star: 3, w: 0.25, wg: 0.09, base: [64, 84], grow: 3, price: 3.2, lvCap: 140,""",
"""    { id: 'ying', name: '英杰', color: '#4a9be0', star: 3, w: 0.25, wg: 0.09, base: [64, 84], grow: 3, price: 3.2, lvCap: 140, ascend: 3,""",
'A5b 英杰 ascend')
patch(DATA,
"""    { id: 'ming', name: '名世', color: '#b06fd8', star: 4, w: 0.075, wg: 0.17, base: [86, 106], grow: 5, price: 7.0, lvCap: 180,""",
"""    { id: 'ming', name: '名世', color: '#b06fd8', star: 4, w: 0.075, wg: 0.17, base: [86, 106], grow: 5, price: 7.0, lvCap: 180, ascend: 5,""",
'A5c 名世 ascend')
patch(DATA,
"""    { id: 'tian', name: '天授', color: '#e0a83c', star: 5, w: 0.02, wg: 0.28, base: [108, 140], grow: 8, price: 16.0, lvCap: 240,""",
"""    { id: 'tian', name: '天授', color: '#e0a83c', star: 5, w: 0.02, wg: 0.28, base: [108, 140], grow: 8, price: 16.0, lvCap: 240, ascend: 8,""",
'A5d 天授 ascend')

print()
print('== B. state.js ==')
# B1 · rankUpUse：升档给四维灵淬加成（隐藏机制唯一出口）
patch(ST,
"""    g.rank = item.to;
    var nr = DATA.GEN_RANK_BY_ID[item.to] || {};
    return {
      ok: true,
      msg: '🧬 ' + g.name + ' 资质提升：' + cur.name + ' → ' + (nr.name || item.to) + '（' + item.name + '）',
    };""",
"""    g.rank = item.to;
    var nr = DATA.GEN_RANK_BY_ID[item.to] || {};
    /* v78（老板需求 2 · 隐藏设定）：「将领低资质通过蕴灵草等提升资质时，能比直接招募
       获得额外提升」—— 灵草淬炼过的根基更实：每次升档，四维各 +新档 ascend。
       数值见 DATA.GEN_RANKS[].ascend（良材2 / 英杰3 / 名世5 / 天授8，全链 +18/维）。
       机制**刻意隐藏**：界面不加提示，只在属性与战力里体现（老板：不要太失衡）。
       计数落 g.ascend（随存档走，供统计与将来展示）。 */
    var asc78 = nr.ascend || 0;
    if (asc78 > 0) {
      g.tong = (g.tong || 0) + asc78;
      g.yw = (g.yw || 0) + asc78;
      g.zm = (g.zm || 0) + asc78;
      g.nz = (g.nz || 0) + asc78;
      g.ascend = (g.ascend || 0) + 1;
    }
    return {
      ok: true,
      msg: '🧬 ' + g.name + ' 资质提升：' + cur.name + ' → ' + (nr.name || item.to) + '（' + item.name + '）',
    };""",
'B1 rankUpUse 灵淬加成')

print()
print('== C. domain.js ==')
# C0 · 域层段头链条注释
patch(DOM,
"""   * 链条：黄金买种 → 灵田播种 → 游戏时间生长 → 收获""",
"""   * 链条：种子（采集 / 征战所得，v78 起不花黄金）→ 灵田播种 → 游戏时间生长 → 收获""",
'C0 域层段头链')
# C1 · farmPlant 改种子制
patch(DOM,
"""  /* 播种 = 买种（黄金，从当前城扣）+ 落地。即买即种，不做种子库存 */
  GAME.farmPlant = function (idx, cropId) {
    var f = GAME.farmOf();
    var c = GAME.farmCrop(cropId);
    if (!c) return { ok: false, msg: '未知作物' };
    if (idx < 0 || idx >= f.plots.length) return { ok: false, msg: '地块不存在' };
    if (f.plots[idx]) return { ok: false, msg: '这块地还占着' };
    var city = GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池' };
    var R = GAME.res(city);
    if ((R.gold || 0) < c.seed) return { ok: false, msg: '黄金不足（种子需 ' + U.fmt(c.seed) + '）' };
    R.gold -= c.seed;
    f.plots[idx] = { crop: cropId, elapsed: 0, totalTime: Math.round(c.hours * 3600) };
    GAME.log('🌱 秘境播种：' + c.name + '（-' + U.fmt(c.seed) + ' 金）');
    return { ok: true, msg: '播下 ' + c.name + '（-' + U.fmt(c.seed) + ' 金）' };
  };""",
"""  /* 播种 = 用**种子**落地（v78 · 老板需求 1：「种子只有通过将领其他活动获得，
     而不是花金币」）。种子从采集归来 / 出征缴获里掷（GAME.grantSeedDrop），
     不设黄金购买口；播种消耗 ×1。 */
  GAME.farmPlant = function (idx, cropId) {
    var f = GAME.farmOf();
    var c = GAME.farmCrop(cropId);
    if (!c) return { ok: false, msg: '未知作物' };
    if (idx < 0 || idx >= f.plots.length) return { ok: false, msg: '地块不存在' };
    if (f.plots[idx]) return { ok: false, msg: '这块地还占着' };
    var s = GAME.state, items = s.items = s.items || {};
    var seedId = c.seedItem;
    var seedName = farmItemName(seedId);
    if (!seedId || (items[seedId] || 0) < 1) {
      return { ok: false, msg: '缺「' + seedName + '」—— 种子从采集与征战中获得' };
    }
    items[seedId] -= 1;
    if (items[seedId] <= 0) delete items[seedId];
    f.plots[idx] = { crop: cropId, elapsed: 0, totalTime: Math.round(c.hours * 3600) };
    GAME.log('🌱 秘境播种：' + c.name + '（用 ' + seedName + '×1）');
    return { ok: true, msg: '播下 ' + c.name + '（' + seedName + ' -1）' };
  };""",
'C1 farmPlant 种子制')

# C2 · grantSeedDrop（挂在 tickFarm 之后）
patch(DOM,
"""  /* 生长推进（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.tickFarm = function (secGame) {
    var s = GAME.state;
    if (!s || !s.farm || !s.farm.plots) return;
    s.farm.plots.forEach(function (p) {
      if (p && p.elapsed < p.totalTime) p.elapsed = Math.min(p.totalTime, p.elapsed + secGame);
    });
  };""",
"""  /* 生长推进（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.tickFarm = function (secGame) {
    var s = GAME.state;
    if (!s || !s.farm || !s.farm.plots) return;
    s.farm.plots.forEach(function (p) {
      if (p && p.elapsed < p.totalTime) p.elapsed = Math.min(p.totalTime, p.elapsed + secGame);
    });
  };
  /* v78（老板需求 1）：种子掉落 —— **唯一出口**（采集归来 / 出征获胜各调一次）。
     sourceLv：野地 1~10 级；城池走 DATA.SEED_DROP.cityLv 折算（县城 3 … 都城 9）。
     mult：战事 ×battleMult；采集 1。返回掉落文案数组，同时写进 s.items。 */
  GAME.grantSeedDrop = function (sourceLv, mult, label) {
    var tbl = DATA.SEED_DROP;
    var s = GAME.state;
    if (!tbl || !s || !tbl.table) return [];
    s.items = s.items || {};
    var lv = Math.max(1, Math.min(10, Math.round(sourceLv || 1)));
    var m = (mult == null ? 1 : mult);
    var got = [];
    tbl.table.forEach(function (row) {
      if (lv < row.minLv) return;
      if (Math.random() >= (row.base + row.perLv * lv) * m) return;
      var n = U.randInt(Math.random, row.qty[0], row.qty[1]);
      if (n <= 0) return;
      s.items[row.id] = (s.items[row.id] || 0) + n;
      got.push(row.name + '×' + n);
    });
    if (got.length && label) GAME.log(label + '：' + got.join('、'));
    return got;
  };""",
'C2 grantSeedDrop')

# C3 · finishGather 挂种子掉落 + 消息合并
patch(DOM,
"""    /* 兵力与将领归还 */
    var city = GAME.cityById(g.cityId) || GAME.currentCity();""",
"""    /* v78（老板需求 1）：种子 —— 采集归来的另一项收获（种子的主渠道） */
    var seedGot = GAME.grantSeedDrop(g.level || 1, 1, '🌱 采集所得种子');
    /* 兵力与将领归还 */
    var city = GAME.cityById(g.cityId) || GAME.currentCity();""",
'C3a finishGather 种子钩')
patch(DOM,
"""    var msg = '采集收获：' + (resName || '无') + ' +' + U.fmt(y.amount) + (got ? '，另得宝物「' + got + '」' : '');
    GAME.log('📦 ' + msg);
    return { ok: true, msg: msg, res: y.res, amount: y.amount, treasure: got };""",
"""    var msg = '采集收获：' + (resName || '无') + ' +' + U.fmt(y.amount) + (got ? '，另得宝物「' + got + '」' : '')
      + (seedGot.length ? '，另得 ' + seedGot.join('、') : '');
    GAME.log('📦 ' + msg);
    return { ok: true, msg: msg, res: y.res, amount: y.amount, treasure: got, seeds: seedGot };""",
'C3b finishGather 消息')

# C4 · 宝物池排除种子（种子有自己的掉落口，不在宝物随机池里）
patch(DOM,
"""      var pool = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && it.type !== 'material' && it.type !== 'blueprint'
          && it.price <= G.treasureMaxPrice;
      });""",
"""      var pool = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && it.type !== 'material' && it.type !== 'blueprint'
          && it.type !== 'seed'   /* v78：种子走 grantSeedDrop 专属口，不进宝物随机池 */
          && it.price <= G.treasureMaxPrice;
      });""",
'C4 宝物池排除种子')

print()
print('== D. battle.js ==')
# D1 · gains 结构加 seeds
patch(BAT,
"""    var gains = { res: null, mats: [], equip: [], hero: null, beauty: null };""",
"""    var gains = { res: null, mats: [], equip: [], hero: null, beauty: null, seeds: [] };""",
'D1 gains.seeds')
# D2 · 获胜块挂种子缴获
patch(BAT,
"""      /* 军械：掠夺亦可得图纸与成品 */
      var eq = GAME.battle.rollEquipLoot(t);
      if (eq.length) { gains.equip = eq; GAME.log('缴获军械：' + eq.join('、')); }""",
"""      /* 军械：掠夺亦可得图纸与成品 */
      var eq = GAME.battle.rollEquipLoot(t);
      if (eq.length) { gains.equip = eq; GAME.log('缴获军械：' + eq.join('、')); }

      /* v78（老板需求 1）：种子 —— 出征获胜的缴获之一（种子另一主渠道是采集）。
         城档折算见 DATA.SEED_DROP.cityLv；野地按自身等级。 */
      var seedLv = (t.kind === 'wild')
        ? (t.lv || 1)
        : (((DATA.SEED_DROP || {}).cityLv || {})[t.dropType || 'county'] || (t.lv || 3));
      var seedGot = GAME.grantSeedDrop(seedLv, DATA.SEED_DROP.battleMult, '缴获种子');
      if (seedGot.length) gains.seeds = seedGot;""",
'D2 出征种子缴获')

print()
print('== E. systems.js ==')
# E1 · useItem 加 seed 分支（种子不直接使用）
patch(SYS,
"""    } else if (item.type === 'mount_buff') {""",
"""    } else if (item.type === 'seed') {
      /* v78（老板需求 1）：种子**不直接使用** —— 播种在种田秘境里（官府 → 种田秘境） */
      return { ok: false, msg: '种子要到种田秘境播种（官府 → 🌾 种田秘境）' };
    } else if (item.type === 'mount_buff') {""",
'E1 useItem seed 分支')

print()
print('全部完成。')
