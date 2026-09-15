# -*- coding: utf-8 -*-
"""v73 核心层补丁：黄金闸门 / 资质再降10倍 / 种田秘境（数据 + 域 + 系统）

老板五条中的 ①②③ —— 数据与逻辑部分：
  ① 限制黄金的获取：DATA.GOLD_GATE（税收 / 俸禄 / 岁贡三出口统一打折），
     征收黄金系数 0.06 → 0.02。
  ② 高资质将领概率再降 10 倍：GEN_RANKS 英杰/名世/天授 w 再 ÷10；
     名将直取 0.30 → 0.03。
  ③ 种田秘境：DATA.FARM 作物表（6 材料 + 4 灵草）+ 4 种资质灵草道具
     + GAME.farm* 域函数 + 生长推进（在线 tick / 离线补算）+ GAME.rankUpUse
     + systems.useItem 的 rank_up 分支。

锚点唯一校验 + 幂等（new 已在则跳过）+ 行尾自动保持（LF/CRLF 探测）。
"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


def P(*a):
    return os.path.join(ROOT, *a)


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    total = t.count('\n')
    crlf = t.count('\r\n') > (total - t.count('\r\n'))

    def to_dom(s):
        return s.replace('\n', '\r\n') if crlf else s.replace('\r\n', '\n')

    def to_alt(s):
        return s.replace('\r\n', '\n') if crlf else s.replace('\n', '\r\n')

    pairs = [(to_dom(old), to_dom(new))]
    if to_alt(old) != to_dom(old):
        pairs.append((to_alt(old), to_alt(new)))
    for o2, n2 in pairs:
        if n2 in t:
            print('  · %s：已改过（跳过）' % tag)
            return
    hit = [(o, n) for o, n in pairs if t.count(o) == 1]
    if not hit:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(pairs[0][0])))
        sys.exit(1)
    o2, n2 = hit[0]
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(o2, n2, 1))
    print('  ✓ %s' % tag)


DATAJS = P('js', 'data.js')
DOMJS = P('js', 'domain.js')
STJS = P('js', 'state.js')
SYSJS = P('js', 'systems.js')

print('========== ① + ③ 数据层（data.js） ==========')

# ---------- D1：黄金闸门 + 种田秘境数据 ----------
patch(
    DATAJS,
    """  /* 离线补齐的现实日上限（防止长期离线后一次性涌入过多材料） */
  DATA.YIELD_MAX_DAYS = 30;""",
    """  /* 离线补齐的现实日上限（防止长期离线后一次性涌入过多材料） */
  DATA.YIELD_MAX_DAYS = 30;

  /* ============================================================
   * 黄金闸门（v73 · 老板需求 1「限制黄金的获取」）
   * ------------------------------------------------------------
   * 黄金有四个进项：税收（每秒）· 爵位俸禄（每秒）· 州郡岁贡（每现实日）·
   * 官府征收（冷却 1 游戏小时，见 domain.js LEVY_RES_RATE）。
   * 三个进项各挂一处系数，**全部只读这张表** —— 将来再调档（更松 / 更狠）
   * 只改这里一行的数字，不碰业务代码。
   * v73 口径：全线收紧到三成；征收黄金份额同步 0.06 → 0.02。
   * ============================================================ */
  DATA.GOLD_GATE = { tax: 0.3, salary: 0.3, yield: 0.3 };

  /* ============================================================
   * 种田秘境（v73 · 老板需求 3）
   * ------------------------------------------------------------
   * 老板原话：「官府可进入另外一个菜单，种田秘境（背景是个人种田空间，
   * 可种植装备打造、将领提升资质的植物，设计一个完整链条，
   * 将这个作为高级别材料的获取途径）」
   *
   * 完整链条（一环不缺）：
   *   黄金 → 秘境买种子 → 灵田播种 → 游戏时间生长 → 收获
   *        ├─ 材料作物 → 3 阶主产（有机率出 4 阶）→ 铁匠铺打造高阶装备
   *        └─ 灵草作物 → 蕴灵草 / 洗髓芝 / 化龙参 / 天授果 → 将领资质逐档提升
   *
   * 数值全表化（加作物 = 加一行；调价 / 调时长只改本表）：
   *   · hours = **游戏小时**（吃时间倍率，与建造 / 研究同一把尺）
   *   · seed  = 种子价（黄金）—— 黄金因此有了新用途（与需求 1 一拍即合）
   *   · mat   = 3 阶主产材料 + 产出区间 qty；rare / rareP = 4 阶副产与几率
   *   · herb  = 灵草作物：收 1 株对应灵草（道具 id 与作物 id 同名）
   * ============================================================ */
  DATA.FARM = {
    plots: 6,
    crops: [
      { id: 'tieying',     name: '铁英树', icon: '🌳', hours: 6,  seed: 5000,   mat: 'bintie',  rare: 'yuntie',     rareP: 0.15, qty: [2, 4], desc: '根须吸铁成英，可炼镔铁；偶结陨铁' },
      { id: 'tanxiangshu', name: '檀香树', icon: '🌲', hours: 6,  seed: 5000,   mat: 'tanmu',   rare: 'jianmu',     rareP: 0.15, qty: [2, 4], desc: '香气沉郁、坚重近铁，可伐檀木' },
      { id: 'xipiteng',    name: '犀皮藤', icon: '🪴', hours: 6,  seed: 5000,   mat: 'xige',    rare: 'jiaoge',     rareP: 0.15, qty: [2, 4], desc: '藤皮七层如犀甲，可制犀革' },
      { id: 'jiaojinteng', name: '蛟筋藤', icon: '🌿', hours: 6,  seed: 5000,   mat: 'jiaojin', rare: 'longjin',    rareP: 0.15, qty: [2, 4], desc: '藤筋韧可曳石，绞之为索' },
      { id: 'yusuihua',    name: '玉髓花', icon: '🌸', hours: 6,  seed: 5000,   mat: 'yangzhi', rare: 'kunshan',    rareP: 0.15, qty: [2, 4], desc: '花凝玉髓，温润如脂' },
      { id: 'yunjinsang',  name: '云锦桑', icon: '🍃', hours: 6,  seed: 5000,   mat: 'shujin',  rare: 'yunjin',     rareP: 0.15, qty: [2, 4], desc: '桑叶吐丝成锦，日光流转' },
      { id: 'yunlingcao',  name: '蕴灵草', icon: '🌱', hours: 12, seed: 20000,  herb: 'yunlingcao',  desc: '灵气温养，助 凡品 将领洗出 良材 之资' },
      { id: 'xisuizhi',    name: '洗髓芝', icon: '🍄', hours: 24, seed: 60000,  herb: 'xisuizhi',    desc: '洗髓伐骨，助 良材 将领跃入 英杰 之列' },
      { id: 'hualongshen', name: '化龙参', icon: '🪷', hours: 36, seed: 150000, herb: 'hualongshen', desc: '鱼跃龙门之参，助 英杰 将领跻身 名世' },
      { id: 'tianshouguo', name: '天授果', icon: '🍑', hours: 48, seed: 400000, herb: 'tianshouguo', desc: '百年一熟的天授之果，名世 亦可问鼎 天授' },
    ],
  };
  DATA.FARM_CROP_BY_ID = {};
  DATA.FARM.crops.forEach(function (c) { DATA.FARM_CROP_BY_ID[c.id] = c; });""",
    'D1 黄金闸门 + 秘境作物表',
)

# ---------- D2：GEN_RANKS 注释（v73 第二轮下调） ----------
patch(
    DATAJS,
    """    /* v66（老板）：「客栈天授级将领出现概率降低 10 倍，其他高资质降低 8、6 啥的」——
       高资质的 `w` 整体下调，**低资质（凡品/良材）不动**：
         天授 2 → 0.2（÷10）· 名世 6 → 0.75（÷8）· 英杰 15 → 2.5（÷6）
       客栈 1 级时的占比因此变成：
         天授 0.25% / 名世 0.93% / 英杰 3.11% / 良材 33.6% / 凡品 62.2%
       ⚠️ 光改 `w` 是**无效的** —— `GAME.rankWeights` 里原有一道 `Math.max(0.5, …)`
       下限，会把 0.2 直接抬回 0.5（降幅只剩 2.5 倍）。v66 把下限改成**按自身基准的 5%**
       （见 state.js），既拦住负权重、又不吃掉这次下调。 */""",
    """    /* v66（老板）：「客栈天授级将领出现概率降低 10 倍，其他高资质降低 8、6 啥的」
       v73（老板）：「限制高资质将领的直接获取，概率再降 10 倍」——
       高资质的 `w` 在 v66 基础上**再 ÷10**（低资质凡品 / 良材两轮都没动）：
         天授 2 → 0.2 → 0.02（累计 ÷100）· 名世 6 → 0.75 → 0.075（累计 ÷80）
         · 英杰 15 → 2.5 → 0.25（累计 ÷60）
       客栈 1 级时的占比因此变成：
         天授 0.026% / 名世 0.10% / 英杰 0.32% / 良材 34.9% / 凡品 64.6%
       与「名将直取 0.30 → 0.03」（domain.js makeCandidate）是一套组合拳：
       高资质将领从此以**种田秘境灵草养成**为主路（见 DATA.FARM）。
       ⚠️ 光改 `w` 是**无效的** —— `GAME.rankWeights` 里原有一道 `Math.max(0.5, …)`
       下限，会把 0.2 直接抬回 0.5（降幅只剩 2.5 倍）。v66 把下限改成**按自身基准的 5%**
       （见 state.js），既拦住负权重、又不吃掉这两轮下调。 */""",
    'D2 GEN_RANKS 注释（v73）',
)

# ---------- D3/D4/D5：三档权重再 ÷10 ----------
patch(
    DATAJS,
    "{ id: 'ying', name: '英杰', color: '#4a9be0', star: 3, w: 2.5, wg: 0.09,",
    "{ id: 'ying', name: '英杰', color: '#4a9be0', star: 3, w: 0.25, wg: 0.09,",
    'D3 英杰 2.5 → 0.25',
)
patch(
    DATAJS,
    "{ id: 'ming', name: '名世', color: '#b06fd8', star: 4, w: 0.75, wg: 0.17,",
    "{ id: 'ming', name: '名世', color: '#b06fd8', star: 4, w: 0.075, wg: 0.17,",
    'D4 名世 0.75 → 0.075',
)
patch(
    DATAJS,
    "{ id: 'tian', name: '天授', color: '#e0a83c', star: 5, w: 0.2, wg: 0.28,",
    "{ id: 'tian', name: '天授', color: '#e0a83c', star: 5, w: 0.02, wg: 0.28,",
    'D5 天授 0.2 → 0.02',
)

# ---------- D6：资质灵草道具 ----------
patch(
    DATAJS,
    """    { id: 'hugu_lingdan', name: '虎骨灵丹', type: 'perm', attr: 'yw', amount: 1, price: 200, desc: '勇武永久+1（每将上限50）' },
    /* 坐骑 */""",
    """    { id: 'hugu_lingdan', name: '虎骨灵丹', type: 'perm', attr: 'yw', amount: 1, price: 200, desc: '勇武永久+1（每将上限50）' },
    /* 灵草（v73 · 种田秘境产）：把将领资质**升一档**。灵草与档位一一对应
       （from → to），price 0 = 不进货架 —— 唯一来源是秘境灵田，
       高资质将领因此从"客栈直取"转向"养成"。 */
    { id: 'yunlingcao', name: '蕴灵草', type: 'rank_up', from: 'fan', to: 'liang', price: 0, desc: '将领资质：凡品 → 良材（种田秘境产）' },
    { id: 'xisuizhi', name: '洗髓芝', type: 'rank_up', from: 'liang', to: 'ying', price: 0, desc: '将领资质：良材 → 英杰（种田秘境产）' },
    { id: 'hualongshen', name: '化龙参', type: 'rank_up', from: 'ying', to: 'ming', price: 0, desc: '将领资质：英杰 → 名世（种田秘境产）' },
    { id: 'tianshouguo', name: '天授果', type: 'rank_up', from: 'ming', to: 'tian', price: 0, desc: '将领资质：名世 → 天授（种田秘境产）' },
    /* 坐骑 */""",
    'D6 四种资质灵草道具',
)

print()
print('========== ①② 域层（domain.js） ==========')

# ---------- D7：名将直取 0.30 → 0.03 ----------
patch(
    DOMJS,
    """    if (lv >= 5 && Math.random() < 0.30) {""",
    """    /* v73（老板「限制高资质将领的直接获取，概率再降 10 倍」）：名将直取
       0.30 → 0.03。池内史实名将按 HERO_RANK_LINE 皆是英杰以上的高资质，
       与 DATA.GEN_RANKS 权重再 ÷10 是一套组合拳 —— 高资质将领从此以
       「秘境灵草养成」为主路（见 DATA.FARM）。 */
    if (lv >= 5 && Math.random() < 0.03) {""",
    'D7 名将直取 0.30 → 0.03',
)

# ---------- D8：岁贡黄金打折 ----------
patch(
    DOMJS,
    """    return {
      gold: y.gold, rep: y.rep,""",
    """    return {
      /* v73（老板「限制黄金的获取」）：岁贡黄金走 DATA.GOLD_GATE.yield ——
         展示（官府面板）与结算（settleDailyYield）共用这一出口，不会两本账。 */
      gold: Math.round(y.gold * (DATA.GOLD_GATE.yield || 1)), rep: y.rep,""",
    'D8 岁贡黄金打折',
)

# ---------- D9：税收黄金打折（cityProdPerSec 在 state.js） ----------
patch(
    STJS,
    """    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.perkNum(city, 'taxPct'));""",
    """    /* v73（老板「限制黄金的获取」）：税收按 DATA.GOLD_GATE.tax 收紧 */
    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.perkNum(city, 'taxPct'))
      * (DATA.GOLD_GATE.tax || 1);""",
    'D9 税收黄金打折',
)

# ---------- D10：征收黄金份额 0.06 → 0.02 ----------
patch(
    DOMJS,
    """  DATA.LEVY_RES_RATE = { grain: 0.30, wood: 0.22, stone: 0.16, iron: 0.10, gold: 0.06 };""",
    """  /* v73（老板「限制黄金的获取」）：征收黄金份额 0.06 → 0.02（与 DATA.GOLD_GATE 同口径） */
  DATA.LEVY_RES_RATE = { grain: 0.30, wood: 0.22, stone: 0.16, iron: 0.10, gold: 0.02 };""",
    'D10 征收黄金 0.06 → 0.02',
)

# ---------- D11：种田秘境域函数 ----------
FARM_FUNCS = """
  /* ============================================================
   * 种田秘境（v73 · 老板需求 3）：个人田庄 —— 种灵植，收高阶材料与资质灵草
   * ------------------------------------------------------------
   * 链条：黄金买种 → 灵田播种 → 游戏时间生长 → 收获
   *      ├─ 材料作物 → 3 阶主产（有机率出 4 阶）→ 铁匠铺高阶打造
   *      └─ 灵草作物 → 蕴灵草 / 洗髓芝 / 化龙参 / 天授果 → 资质逐档提升
   * 数据全在 DATA.FARM（加作物 = 加一行）；生长吃**游戏时间**：
   * 与建造 / 研究同一把尺 —— 在线主循环与离线补算各推一次（tickFarm），
   * 调时间倍率、挂机离线都有效，不需要另起一套计时。
   * 存档：s.farm 懒初始化（旧档缺失即补），不动 SAVE_VERSION。
   * ============================================================ */
  GAME.farmOf = function () {
    var s = GAME.state;
    if (!s.farm) s.farm = { plots: [] };
    var n = (DATA.FARM && DATA.FARM.plots) || 6;
    while (s.farm.plots.length < n) s.farm.plots.push(null);
    return s.farm;
  };
  GAME.farmCrop = function (id) { return (DATA.FARM_CROP_BY_ID || {})[id] || null; };
  /* 单块地状态：empty / growing / ripe（left = 剩余游戏秒） */
  GAME.farmPlotState = function (idx) {
    var f = GAME.farmOf(), p = f.plots[idx];
    if (!p) return { state: 'empty' };
    var total = p.totalTime || 0;
    var left = Math.max(0, total - (p.elapsed || 0));
    return {
      state: left <= 0 ? 'ripe' : 'growing',
      crop: GAME.farmCrop(p.crop), left: left,
      pct: total ? Math.min(100, Math.floor((p.elapsed || 0) / total * 100)) : 100,
    };
  };
  /* 播种 = 买种（黄金，从当前城扣）+ 落地。即买即种，不做种子库存 */
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
  };
  /* 生长推进（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.tickFarm = function (secGame) {
    var s = GAME.state;
    if (!s || !s.farm || !s.farm.plots) return;
    s.farm.plots.forEach(function (p) {
      if (p && p.elapsed < p.totalTime) p.elapsed = Math.min(p.totalTime, p.elapsed + secGame);
    });
  };
  /* 材料 / 道具名（材料在 MATERIAL_BY_ID、灵草在 ITEMS，两表各查一次） */
  function farmItemName(id) {
    var m = DATA.MATERIAL_BY_ID[id];
    if (m) return m.name;
    var nm = id;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) nm = x.name; });
    return nm;
  }
  /* 收获：成熟才给 —— 材料作物 = 3 阶主产 ×区间 + 4 阶副产（几率）；灵草作物 = 1 株 */
  GAME.farmHarvest = function (idx) {
    var s = GAME.state, f = GAME.farmOf();
    var st = GAME.farmPlotState(idx);
    if (st.state === 'empty') return { ok: false, msg: '这块地空着' };
    if (st.state !== 'ripe') {
      return { ok: false, msg: st.crop.name + ' 还差 ' + U.durExact(st.left / GAME.timeScale()) + ' 成熟' };
    }
    var c = st.crop, items = s.items = s.items || {};
    var got = [];
    if (c.herb) {
      items[c.herb] = (items[c.herb] || 0) + 1;
      got.push(farmItemName(c.herb) + ' ×1');
    } else {
      var q = U.randInt(Math.random, c.qty[0], c.qty[1]);
      items[c.mat] = (items[c.mat] || 0) + q;
      got.push(farmItemName(c.mat) + ' ×' + q);
      if (c.rare && Math.random() < (c.rareP || 0.15)) {
        items[c.rare] = (items[c.rare] || 0) + 1;
        got.push(farmItemName(c.rare) + ' ×1');
      }
    }
    f.plots[idx] = null;
    var txt = got.join('、');
    GAME.log('🌾 秘境收获：' + c.name + ' → ' + txt);
    return { ok: true, msg: '收获 ' + txt };
  };
  /* 一键收获：把成熟的全收了（面板里的快捷按钮） */
  GAME.farmHarvestAll = function () {
    var f = GAME.farmOf(), got = [], any = false;
    for (var i = 0; i < f.plots.length; i++) {
      if (GAME.farmPlotState(i).state !== 'ripe') continue;
      var r = GAME.farmHarvest(i);
      if (r.ok) { any = true; got.push(r.msg.replace(/^收获 /, '')); }
    }
    if (!any) return { ok: false, msg: '没有成熟的作物' };
    return { ok: true, msg: '收获 ' + got.join('、') };
  };
"""
patch(
    DOMJS,
    """  /* 训练进度（城） */
  /* 科技进度 */
})();""",
    """  /* 训练进度（城） */
  /* 科技进度 */
""" + FARM_FUNCS + """
})();""",
    'D11 秘境域函数（farm*）',
)

print()
print('========== ②③ 状态层（state.js） ==========')

# ---------- D12：rankUpUse ----------
patch(
    STJS,
    """    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    return rk;
  };""",
    """    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    return rk;
  };

  /* 资质灵草（v73 · 种田秘境产物）：把将领的资质**升一档**。
     灵草与档位**一一对应**（凡→良 蕴灵草 / 良→英 洗髓芝 / 英→名 化龙参 /
     名→天 天授果，见 DATA.ITEMS 的 rank_up 型）。只改 rank 字段 ——
     等级上限与每级成长都走 rankOf，改完自动生效（不需要动等级）。 */
  GAME.rankUpUse = function (g, item) {
    var cur = GAME.rankOf(g);
    if (cur.id === item.to) return { ok: false, msg: g.name + ' 已是「' + cur.name + '」，无需此物' };
    if (cur.id !== item.from) {
      var fr = DATA.GEN_RANK_BY_ID[item.from] || {};
      return {
        ok: false,
        msg: '「' + item.name + '」只可用于「' + (fr.name || '?') + '」将领（' + g.name + ' 现为「' + cur.name + '」）',
      };
    }
    g.rank = item.to;
    var nr = DATA.GEN_RANK_BY_ID[item.to] || {};
    return {
      ok: true,
      msg: '🧬 ' + g.name + ' 资质提升：' + cur.name + ' → ' + (nr.name || item.to) + '（' + item.name + '）',
    };
  };""",
    'D12 GAME.rankUpUse',
)

# ---------- D13：在线主循环推进 ----------
patch(
    STJS,
    """    if (GAME.tickGathers) GAME.tickGathers(ts);""",
    """    if (GAME.tickGathers) GAME.tickGathers(ts);
    /* v73：种田秘境生长 —— 与建造队列同口径（dtReal × ts） */
    if (GAME.tickFarm) GAME.tickFarm(dtReal * ts);""",
    'D13 主循环 tickFarm',
)

# ---------- D14：离线补算推进 ----------
patch(
    STJS,
    """    var advance = function (q) { q.elapsed += secReal * ts; };
    s.queues.build.forEach(advance);
    /* v24（需求 8）：募兵队列按军营分组推进（与在线主循环共用同一实现） */
    GAME.advanceTrainQueues(secReal * ts);""",
    """    var advance = function (q) { q.elapsed += secReal * ts; };
    s.queues.build.forEach(advance);
    /* v24（需求 8）：募兵队列按军营分组推进（与在线主循环共用同一实现） */
    GAME.advanceTrainQueues(secReal * ts);
    /* v73：秘境作物按同一段离线时长推进（挂机回来地里的东西也该熟了） */
    if (GAME.tickFarm) GAME.tickFarm(secReal * ts);""",
    'D14 离线补算 tickFarm',
)

# ---------- D15：俸禄黄金打折 ----------
patch(
    STJS,
    """      out.gold += salary * gm / 3600 * GAME.timeScale();""",
    """      /* v73（老板「限制黄金的获取」）：俸禄同口径收紧（DATA.GOLD_GATE.salary） */
      out.gold += salary * gm / 3600 * GAME.timeScale() * (DATA.GOLD_GATE.salary || 1);""",
    'D15 俸禄黄金打折',
)

print()
print('========== ③ 系统层（systems.js） ==========')

# ---------- D16：useItem 的 rank_up 分支 ----------
patch(
    SYSJS,
    """    } else if (item.type === 'mount_buff') {""",
    """    } else if (item.type === 'rank_up') {
      /* v73（种田秘境）：资质灵草 —— 校验与升档走唯一出口 GAME.rankUpUse */
      var g7 = S._findGen(targetGenId);
      if (!g7) return { ok: false, msg: '请选择将领' };
      var ru7 = GAME.rankUpUse(g7, item);
      if (!ru7.ok) return ru7;
      ok = true; msg = ru7.msg;
    } else if (item.type === 'mount_buff') {""",
    'D16 useItem rank_up 分支',
)

print()
print('========== 核心层补丁完成 ==========')
