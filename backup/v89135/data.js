/* ============================================================
 * data.js  静态配置数据 —— 真实热血三国数值版（v2）
 * 数值来源：《热血三国数值系统检索报告》s20728.rxsg.ledu.com 实测+官方
 * 单位约定：产量/俸禄 = 每小时；时间 = 游戏秒（受 TIME_SCALE 倍率影响）
 * 挂到 window.GAME.DATA
 * ============================================================ */
/* ============================================================
 * 【分区导航】（v89.134 · 需求「梳理各种数据表，代码块和引用关系」）
 * ------------------------------------------------------------
 * 本文件是**全部静态数值的唯一来源**，分段归入 16 区。
 * 改数值：先在本区找目标 → 进对应分段（行号见 docs/数据表索引.md，
 * 由 .workbuddy/tools/gen/gen_tables_index.js 自动生成，改表后重跑）。
 *
 *   ① 资源与常量     RESOURCES / RES_ORDER / 仓储基准 / 黄金闸门
 *   ② 建筑           BUILDINGS / 建造时间 / 前置 / 城内布局 / 城外建筑与地块
 *   ③ 军事           TROOPS / 相克 / 阵位 / 城防 / TECH
 *   ④ 装备与宝物     EQUIP / SETS / ITEMS / 打造 / 强化 / 材料 / 经验道具
 *   ⑤ 爵位           RANK / RANK_BONUS
 *   ⑥ 地图与野地     TERRAIN / GATHER / MAP 常量 / 野地守军 / 州特产
 *   ⑦ 入侵与战斗     INVASION / DUEL / AUTO_MARCH / SIEGE / OPS / 战法 / 回放
 *   ⑧ 人口           POP_CFG / POP_LABOR / DISBAND / CAPTIVE
 *   ⑨ 将领           HEROES / BEAUTIES / 君主 / 资质 / 经验 / 体力 / 精力 / 内功 / 俸禄 / 校场
 *   ⑩ 市场与流转     市场买卖 / 寄售 / 募兵提速 / 种田秘境
 *   ⑪ 名城与门派     CITY_PERK / 守将区间 / 门派
 *   ⑫ 运输与出征     NEW_CITY_EXT / 运输派遣 / 出征三方式 / 行军
 *   ⑬ 任务           ⛔ 本文件不再定义 —— 唯一来源是 questdata.js
 *   ⑭ 趣味系统       BONDS / SEASONS / 史书 / 秘境 / 称号 / 计谋 / 灵气
 *   ⑮ 界面           THEME / 建筑系列 / 公文
 *   ⑯ v89 新系统     江湖场景 / 套装扩展 / 表重建（ITEM_BY_ID 等）
 * ============================================================ */
(function () {
  window.GAME = window.GAME || {};
  var DATA = {};

  /* ---------------- 资源 --------------- */
  DATA.RESOURCES = [
    { key: 'grain', name: '粮食', icon: '🌾', color: '#d9b25a' },
    { key: 'wood',  name: '木材', icon: '🪵', color: '#a9744b' },
    { key: 'stone', name: '石料', icon: '⛰️', color: '#9b9b9b' },
    { key: 'iron',  name: '铁锭', icon: '🔩', color: '#a5b5c9' },
    { key: 'gold',  name: '黄金', icon: '💰', color: '#e6a400' },
    { key: 'pop',   name: '人口', icon: '👥', color: '#9fd6a0' },
  ];
  /* 资源（不含人口）的**结算遍历顺序** —— 唯一数据源（v89.134 接线）。
     战利品结算 / 掠夺 / 运输 / 批量 UI 等 7 处遍历一律读本表，
     不要再就地写 ['grain','wood',...] 字面量（改资源集只改这里）。
     `GAME.RES_KEYS`（含 pop · state.js）与 `GAME.TRANSPORT_KEYS`（domain.js）
     均由本表派生。 */
  DATA.RES_ORDER = ['grain', 'wood', 'stone', 'iron', 'gold'];

  /* ============================================================
   * 城内功能建筑（16种 · 1~10级逐级消耗表，来自报告2.x）
   * 表项 = [粮, 木, 石, 铁, 时间秒]
   * ============================================================ */
  function lerpCost(a, b, n) {
    // 等比插值生成中间级（用于只有首末级的建筑，2.8节近似）
    var out = [], ratio = Math.pow(b[0] / a[0], 1 / (n - 1));
    for (var i = 0; i < n; i++) {
      var r = Math.pow(ratio, i);
      out.push([Math.round(a[0] * r), Math.round(a[1] * Math.pow(b[1] / a[1], i / (n - 1))),
                Math.round(a[2] * Math.pow(b[2] / a[2], i / (n - 1))),
                Math.round(a[3] * Math.pow(b[3] / a[3], i / (n - 1))),
                Math.round(a[4] * Math.pow(b[4] / a[4], i / (n - 1)))]);
    }
    return out;
  }
  /* 本地确定性随机（data.js 早于 state.js 加载，不能借用 GAME.utils） */
  function localRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
   * 建筑等级上限（v28 · 需求 1）：10 → 12
   * ------------------------------------------------------------
   * 16 张造价表都是按 10 级标定的。新增 11/12 级若逐张手写，
   * 就是 32 行数字 —— 极易串行或漏项，而且改一处就要核对十六处。
   * 这里改为**按末段增速外推**：口径唯一、确定、可写断言。
   * ============================================================ */
  DATA.MAX_BLEVEL = 12;

  /* ============================================================
   * 主城 · 爵位解锁建筑等级上限（v89.102 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「主城（每个玩家只能设定一座主城）可随爵位逐步解锁官府及其他建筑
   *   等级上限，爵位每级解锁建筑等级上限 1 级」。
   *   · 坡度 `MAIN_CITY_BUILD_PER_RANK = 1` —— 每 1 档爵位 → +1 级上限（**主城专属**，
   *     别城不享受：这正是"选都城"的核心回报，与驻跸加成同一个池子）；
   *   · 满档解锁量 `RANK_BUILD_LIFT_MAX = 21` —— 爵位满档时能多盖 21 级
   *     （爵位 22 档 → 序号 0~21）。
   * ⚠️ 这两个数**必须声明在等级表之前**：下面所有"按等级取值"的表（人口/仓储/驿站/
   *   城外产量/城外上限/各级造价）都在声明时**按 `MAX_LEVEL_ABS` 一次性外推**，
   *   声明之后再改数值，表不会跟着长 → 高等级取到 undefined
   *   （症状：升级按钮忽然消失 / 产量变 NaN）。`DATA.RANK` 在文件后半段才声明，
   *   所以这里用常量，并在 RANK 定义之后**核对一次**（见 RANK_BONUS 段末的守卫）。
   * ============================================================ */
  DATA.MAIN_CITY_BUILD_PER_RANK = 1;
  DATA.RANK_BUILD_LIFT_MAX = 21;

  /* ============================================================
   * 名城建筑等级上限（v54 定表 · v89.76 校准）
   *   自建城 +0 · **县城 +0（= 12）** · 郡城 +4（= 16） · 州城 +8（= 20） · 都城 +12（= 24）
   * ------------------------------------------------------------
   * 老板 v89.76 定的满配系列就是 **12 / 16 / 20 / 24** —— 基准 `MAX_BLEVEL`=12，
   * 所以**县城加成是 0**（v54 原表给的是 +2 → 14，与"县城 12"冲突，本轮校准）。
   * 自建城（self）不是名城，不加成。
   * 口径唯一：`GAME.buildCapOf(city, bid)` 是"一级建筑能盖到几级"的**唯一出口**
   * （升级守卫、自动建造、UI 的升级按钮都读它）。
   * ⚠️ 凡是**按等级取值的表**都必须能覆盖到 `MAX_LEVEL_ABS`，
   *   否则 24 级会取到 undefined → 产量/人口变成 NaN（这类表共五张，见下面各处注释）。
   * v89.102：`MAX_LEVEL_ABS` 首次出现"**主城爵位解锁**"这一项 ——
   *   12（基准）+ 12（都城）+ 21（爵位满档）= **45**，正是主城能盖到的最高级。
   * ============================================================ */
  DATA.CITY_BUILD_BONUS = { self: 0, county: 0, jun: 4, zhou: 8, capital: 12 };
  DATA.MAX_LEVEL_ABS = DATA.MAX_BLEVEL;
  (function () {
    for (var k in DATA.CITY_BUILD_BONUS) {
      var v = DATA.MAX_BLEVEL + DATA.CITY_BUILD_BONUS[k];
      if (v > DATA.MAX_LEVEL_ABS) DATA.MAX_LEVEL_ABS = v;
    }
    /* v89.102：+ 主城爵位满档解锁（12+12+21 = 45） */
    DATA.MAX_LEVEL_ABS += DATA.RANK_BUILD_LIFT_MAX * DATA.MAIN_CITY_BUILD_PER_RANK;
  })();

  /* 等级序列外推（v54）—— 给名城更高的等级上限供数。
     两把尺子，各按该表**末段自己记的节奏**续写，不手抄数字（手抄必然漏项）：
       growRatio：末段是比例增长（人口/仓储/产量都是"约 ×1.18/级"，v28 的注释写了这条）
       growStep ：末段是等差（驿站速度每级 +0.5）
     比例那把尺子与数值量纲无关，所以 100→7800 的产量表和 10000→780000 的仓储表
     可以用同一条规则，不必各写一遍。 */
  function growRatio(arr, n) {
    while (arr.length < n) {
      var k = arr.length;
      arr.push(Math.max(1, Math.round(arr[k - 1] * (arr[k - 1] / arr[k - 2]))));
    }
    return arr;
  }
  function growStep(arr, n, step) {
    while (arr.length < n) {
      arr.push(Math.round((arr[arr.length - 1] + step) * 100) / 100);
    }
    return arr;
  }

  function extRows(rows, n) {
    var out = rows.slice();
    while (out.length < n) {
      var last = out[out.length - 1], prev = out[out.length - 2] || last;
      var next = [];
      for (var i = 0; i < last.length; i++) {
        /* v89.125：**0 是哨兵值**（= "本表不指定该项，由消费点兜底"）。
           城墙 time 列全 0，升级走 `cost.time || lvl × 60` 的兜底；
           旧外推 `max(1, 0×1.85) = 1` 会把哨兵变成 1、2 秒的"假时间" ——
           城墙 Lv10 之后升级变"瞬间完成"（真 bug，本轮修）。
           判据：外推段 0 必须保持 0（smoke §104① 逐级扫到 45 钉住）。 */
        if (last[i] <= 0) { next.push(0); continue; }
        var r = prev[i] ? last[i] / prev[i] : 1.85;
        next.push(Math.max(1, Math.round(last[i] * r)));
      }
      out.push(next);
    }
    return out;
  }

  /* ============================================================
   * v89.104（老板）：「建筑继续升级这个，在某级别之后消耗资源不再增加，
   * 换成需要更多其他材料如珍珠等，避免耗费的资源膨胀，级数你来定」
   * ------------------------------------------------------------
   * 级数定在 **Lv12**（= `DATA.MAX_BLEVEL`，自建城的基准满级）：
   *   · 1→12 级：纯资源，按手写表（沿用原节奏，不动既有平衡）；
   *   · **12 级之后：资源成本冻结在「12→13」那一档**（不再按 ×1.85 外推 ——
   *     改前 33 级要粮 1,289 亿，数字已经不像钱了）；
   *   · 门槛改由**珠宝**承担：每级要一种珠宝，品类按"珠宝阶梯"每 4 级上移一档，
   *     数量随级递增（2 + ⌊(lv−12)/3⌋ 颗）。
   * ⚠️ 阶梯**从 DATA.ITEMS 的 jewel 表派生**（按 price 升序：珍珠→夜明珠），
   *    不另抄一份名单 —— 改珠宝表就是改阶梯。
   * ⚠️ 珠宝需求随 cost 对象走（`cost.jewel = { 物品id: 数量 }`）：
   *    `canAfford` / `payCost` / 界面三处读同一份（见 GAME.jewelNeedOf）。
   * ============================================================ */
  DATA.JEWEL_COST = {
    fromLevel: 12,     /* 12 级之后的升级（13 级起）改吃珠宝 */
    base: 2,           /* 13 级起：2 颗 */
    stepEvery: 3,      /* 每 3 级 +1 颗 */
    tierEvery: 4,      /* 每 4 级上移一档珠宝 */
  };
  /* 珠宝阶梯（按 price 升序）—— 唯一来源是 DATA.ITEMS 的 jewel 型条目。
     ⚠️ **惰性求值**：本段代码在 DATA.ITEMS 之前执行（costTable 要给 BUILDINGS 用），
     直接在这里枚举会得到空阶梯（= 高等级升不动）。所以第一次用时才算并缓存。 */
  DATA.JEWEL_LADDER = null;
  DATA.jewelLadder = function () {
    if (DATA.JEWEL_LADDER && DATA.JEWEL_LADDER.length) return DATA.JEWEL_LADDER;
    var js = (DATA.ITEMS || []).filter(function (x) { return x.type === 'jewel'; });
    js.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    DATA.JEWEL_LADDER = js.map(function (x) { return x.id; });
    return DATA.JEWEL_LADDER;
  };
  /* 升到 lv+1 级时的珠宝需求（唯一出口）：返回 { 物品id: 数量 } 或 null */
  DATA.jewelCostAt = function (lv) {
    var J = DATA.JEWEL_COST, lad = DATA.jewelLadder();
    if (!J || !lad.length || lv < J.fromLevel) return null;
    var step = Math.max(0, Math.floor(lv) - J.fromLevel);
    var tier = Math.min(lad.length - 1, Math.floor(step / Math.max(1, J.tierEvery)));
    var n = J.base + Math.floor(step / Math.max(1, J.stepEvery));
    var o = {};
    o[lad[tier]] = n;
    return o;
  };

  /* ============================================================
   * v89.128（老板 需求 3/4）：「建造时间不友好（官府 11-12 要 37 天）…最长不要超过
   *   48h；每 12 级循环使用建造时长（13-24 级分别使用 1-12 级的时长，类推）」
   *   「使单次建造用时不超过 24，且各建筑之间有区分度」——**建造时间曲线**：
   * ------------------------------------------------------------
   * 唯一出口 `buildTimeSec(bid, lv)` = T_max × ((k+1)/12)^1.5，k = lv % 12
   *   · **1 倍速基准**（1 现实秒 = 1 游戏秒；倍速只缩短现实等待，不参与设计）；
   *   · 序号语义：`lv` = 升级前等级（0 = 建造），返回"升到 lv+1 级"的耗时（游戏秒）；
   *   · **12 级循环**：升到 13 级用升到 1 级的时长、…、升到 24 级用升到 12 级的；
   *     25-36 再循环，37-45 用前 9 档 —— 高等级不再"越等越久"；
   *   · 曲线为舒缓递增（1.5 次幂），起点 = T_max/41.6、终点 = T_max；
   *   · **单次上限**：最重建筑（城墙 T_max 24h）≤ 24h（老板硬上限）；
   *   · **区分度** = 各建筑自己的 T_max（城墙 24h → 校场 5h，见下表）。
   * ------------------------------------------------------------
   * v89.129（老板）：「城墙作为建筑，理应有独立的建造时间，和其他任何建筑一样。
   *   规划建造时间，结合现实里耗材，耗资，耗时的特点」
   *   —— 城墙此前有两个"不配套"：① 资源全表最轻（8 万，仅为体系的 0.34%）却耗时第二重；
   *   ② 曲线与其他建筑共用 1.5 次幂（起点 0.58h，出现"35 分钟修一段城墙"的廉价期）。
   *   定稿两条（见 BUILD_TIME_EXP 与 CHENGQIANG 成本表）：
   *   · **时间 = 双料之王**：T_max 24h（顶格）+ 独立**线性**曲线（起点 2h、终点 24h）——
   *     现实城墙无"廉价期"，任何一段都是高强度工程（脚手架/材料运输随高度递增是
   *     1.5 次幂，但那是内政建筑的形状；城墙同级是"同一圈墙的连续加固"，工程量均匀）；
   *   · **资源 = 耗材/耗资之王**：11→12 档 3,482 万（全表最高，超过驿站 2,355 万），
   *     石料占 66%（现实城墙 = 砖石夯土工程，石料是绝对主材）；资源/小时比
   *     （145 万/时）与体系同量级（军营 68 万 ~ 驿站 294 万）——"耗材/耗资/耗时"三者相称。
   * ⚠ 资源列**不循环**（保持 v89.104 的 12 级后封顶）——"高等级持续高投入"不变。
   * ============================================================ */
  DATA.BUILD_TIME_H_MAX = {
    guanfu: 18, honglusi: 15, shichang: 12, junying: 11, shuyuan: 11,
    /* v89.129：城墙 10 → 24（顶格）——「耗材/耗资/耗时」三者相称的"耗时之王" */
    chengqiang: 24, zhaoxianguan: 9, gongjiangzuofang: 9,
    cangku: 8, yizhan: 8, fenghuotai: 8,
    tiejiangpu: 7, majiu: 6, kezhan: 6, minfang: 6, xiaochang: 5,
    /* 城外资源地块（4 座同类，同级同价便于对比） */
    farm: 6, forest: 6, quarry: 6, mine: 6,
  };
  /* v89.129：曲线**指数**按建筑可独立（默认 1.5 = 舒缓递增；城墙 1.0 = 线性）。
     为什么城墙是线性：见上方注释块 —— "同一圈墙的连续加固"工程量均匀、
     无"35 分钟修一段"的廉价期（线性起点 = T_max/12 = 2h）。 */
  DATA.BUILD_TIME_EXP = {
    chengqiang: 1.0,
  };
  function buildTimeSec(bid, lv) {
    var h = DATA.BUILD_TIME_H_MAX[bid] || 6;
    var e = DATA.BUILD_TIME_EXP[bid] || 1.5;
    var k = ((lv % 12) + 12) % 12;
    return Math.round(h * 3600 * Math.pow((k + 1) / 12, e));
  }
  DATA.buildTimeSec = buildTimeSec;   /* 城外（domain.extBuildCost）与工具同读此出口 */
  function costTable(arr, bid) {
    /* [粮,木,石,铁,秒] 数组 -> 升到第 lv+1 级的费用。
       表长不足 MAX_LEVEL_ABS（= 基准 12 + 名城最高加成 12 = 24）时自动外推（见上）。
       v54：这里从 MAX_BLEVEL 改成 MAX_LEVEL_ABS —— 都城的官府/兵营要能盖到 24 级，
       表短了会走到 `if (!r) return null`，表现为"升级按钮忽然消失"。
       v89.104：**Lv12 之后资源封顶**（见上面 DATA.JEWEL_COST 的注释）+ 珠宝需求。
       v89.128：**时间列不再用行里的手写值、也不再封顶** —— 一律走 buildTimeSec 曲线
       （12 级循环 + 单次 ≤24h；行数组第 5 列成为历史遗迹，仅作对照参考）。 */
    var rows = extRows(arr, DATA.MAX_LEVEL_ABS);
    var freezeAt = (DATA.JEWEL_COST && DATA.JEWEL_COST.fromLevel) || 12;
    return function (lv) {
      var r = (lv >= freezeAt) ? rows[freezeAt - 1] : rows[lv];   /* 资源封顶：用「12→13」那一档 */
      if (!r) return null;
      var o = { grain: r[0], wood: r[1], stone: r[2], iron: r[3] };
      o.time = buildTimeSec(bid, lv);   /* v89.128：时间列 = 曲线（唯一出口） */
      var jw = DATA.jewelCostAt(lv);
      if (jw) o.jewel = jw;
      return o;
    };
  }

  var GUANFU = [
    null, // 等级1：初始自带，不可建造
    [2600, 6225, 5190, 2075, 3995],
    [5340, 12760, 10650, 4265, 8670],
    [10860, 25840, 21600, 8665, 18385],
    [21855, 51685, 43280, 17400, 38055],
    [43490, 102075, 85700, 34535, 76870],
    [85595, 199045, 167625, 67760, 151430],
    [166565, 383160, 323855, 131385, 290745],
    [320465, 728005, 617915, 251735, 543690],
    [609530, 1365010, 1164155, 476535, 989515],
  ];

  DATA.BUILDINGS = {
    guanfu: {
      id: 'guanfu', series: 'gov', name: '官府', icon: '🏯', desc: '一城枢机 —— 升堂理政、课税安民。每级 +1 附属野地上限、+3 城外空地。',
      buildCost: null, maxLevel: 12, prod: null, // 初始自带 Lv1
      levelCost: costTable(GUANFU, 'guanfu'),
      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」——
         原「城外空地」数值副本（12 + (lv-1)×3 的老口径）随显示撤除退役；
         真实机制唯一出口 = DATA.EXT_CAP_BY_LV + GAME.extCap。 */
    },
    minfang: {
      id: 'minfang', series: 'live', name: '民房', icon: '🏠', desc: '编户齐民，烟火所聚 —— 提供人口上限。',
      buildCost: { grain: 100, wood: 500, stone: 125, iron: 100 }, maxLevel: 12, prod: null,
      levelCost: costTable([[100,500,125,100,150],[210,1040,260,210,335],[425,2125,530,425,725],[870,4305,1080,865,1530],[1750,8615,2165,1740,3170],[3480,17010,4285,3455,6405],[6845,33175,8380,6775,12620],[13325,63860,16195,13140,24230],[25635,121335,30895,25175,45310],[48760,227500,58210,47655,82460]], 'minfang'),
      /* v28：11/12 级人口（沿用末段约 ×1.18、×1.2 的节奏）
         v54：再按同一节奏续到 24 —— 民房在都城能盖到 24，表短了人口上限就是 NaN。 */
      pop: growRatio([100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800],
        DATA.MAX_LEVEL_ABS),
    },
    shuyuan: {
      id: 'shuyuan', series: 'edu', name: '书院', icon: '📜', desc: '聚士讲学，稽古治典 —— 等级决定可研究的科技上限（每城同时研究 1 项）。',
      buildCost: { grain: 120, wood: 2500, stone: 1500, iron: 200 }, maxLevel: 12, prod: null,
      levelCost: costTable([[120,2500,1500,200,960],[250,5190,3115,415,2130],[515,10635,6390,855,4625],[1045,21535,12960,1735,9805],[2100,43070,25970,3480,20295],[4175,85060,51420,6905,40995],[8215,165870,100575,13550,80760],[15990,319300,194315,26275,155065],[30765,606670,370750,50345,289970],[58515,1137510,698495,95305,527740]], 'shuyuan'),
    },
    junying: {
      id: 'junying', series: 'mil', name: '军营', icon: '⚔️', desc: '募兵练卒之所 —— 等级决定可训练的兵种。',
      buildCost: { grain: 800, wood: 1200, stone: 1500, iron: 1000 }, maxLevel: 12, prod: null,
      levelCost: costTable([[800,1200,1500,1000,600],[1660,2490,3115,2075,1330],[3420,5105,6390,4265,2890],[6950,10335,12960,8665,6130],[13985,20675,25970,17400,12685],[27835,40830,51420,34535,25625],[54780,79620,100575,67760,50475],[106600,153265,194315,131385,96915],[205100,291200,370750,251735,181230],[390100,546005,698495,476535,329840]], 'junying'),
    },
    xiaochang: {
      id: 'xiaochang', series: 'mil', name: '校场', icon: '🏹', desc: '点兵演武之地 —— N 级 = N 支出征队列，每队 N×1 万人马（按人数计，不占人口）。',
      buildCost: { grain: 100, wood: 600, stone: 2000, iron: 150 }, maxLevel: 12, prod: null,
      levelCost: costTable([[100,600,2000,150,60],[210,1245,4150,310,135],[425,2550,8520,640,305],[870,5170,17280,1300,655],[1750,10335,34625,2610,1370],[3480,20415,68560,5180,2775],[6845,39810,134100,10165,5440],[13325,76630,259085,19710,10310],[25635,145600,494335,37760,18870],[48760,273000,931325,71480,33300]], 'xiaochang'),
    },
    shichang: {
      /* v89.62（老板「市场去除商队计数和限制，去除相应标注」）：
         描述里的"每级+1商队"随概念一并退场 —— 市场等级的作用是**降低折损**。 */
      id: 'shichang', series: 'biz', name: '市场', icon: '🏪', desc: '通有无、平物价 —— 交易四种资源与黄金；等级越高折损越小（无市场亦可交易，折损最重）。',
      buildCost: { grain: 1000, wood: 1000, stone: 1000, iron: 1000 }, maxLevel: 12, prod: null,
      levelCost: costTable([[1000,1000,1000,1000,1500],[2080,2075,2075,2075,3330],[4270,4255,4260,4265,7225],[8690,8615,8640,8665,15320],[17485,17230,17315,17400,31710],[34795,34025,34280,34535,64055],[68475,66350,67050,67760,126190],[133250,127720,129540,131385,242285],[256375,242670,247165,251735,453075],[487625,455005,465660,476535,824595]], 'shichang'),
    },
    cangku: {
      id: 'cangku', series: 'store', name: '仓库', icon: '🏚️', desc: '仓廪实而后安 —— 保护资源不被掠夺；一旦城破，护佑即失。',
      buildCost: { grain: 100, wood: 1500, stone: 1000, iron: 500 }, maxLevel: 12, prod: null,
      levelCost: costTable([[100,1500,1000,500,1200],[210,3115,2075,1040,2665],[425,6380,4260,2135,5780],[870,12920,8640,4330,12255],[1750,25840,17315,8700,25370],[3480,51035,34280,17270,51245],[6845,99520,67050,33880,100955],[13325,191580,129540,65695,193830],[25635,364000,247165,125865,362460],[48760,682505,465660,238265,659680]], 'cangku'),
      /* v54：仓库保护上限同人口表一个节奏，续到 24 级 */
      cap: growRatio([10000, 30000, 60000, 100000, 150000, 210000, 280000, 360000, 450000, 550000, 660000, 780000],
        DATA.MAX_LEVEL_ABS),
    },
    chengqiang: {
      id: 'chengqiang', series: 'mil', name: '城墙', icon: '🧱', desc: '高墙深池，御敌于外 —— 耐久 100×N 万，守军防御 +10N%，远程射程 +3N%。',
      /* v89.129（老板「结合现实里耗材，耗资，耗时的特点」）：**资源表重写** ——
         旧表 10 档、80000 封顶、全表最轻（0.34%）——"耗材巨/耗资巨"的城墙却最便宜，
         与耗时（第二重）严重倒挂。新表 12 档、每档 ×2（17,000 → 3,482 万，全表之最）：
           · 石 66% / 木 14% / 粮 12% / 铁 8% —— 砖石夯土工程，石料绝对主导；
           · 资源/小时（145 万/时）落在体系带内（军营 68 万 ~ 驿站 294 万）；
           · `buildCost` 与 `levelCost(0)` 逐字一致（项目惯例，两条路同一笔账）。 */
      buildCost: { grain: 2000, wood: 2400, stone: 11200, iron: 1400 }, maxLevel: 12, prod: null,
      levelCost: costTable([
        [2000, 2400, 11200, 1400], [4100, 4800, 22400, 2700], [8200, 9500, 44900, 5400],
        [16300, 19000, 89800, 10900], [32600, 38100, 179500, 21800], [65300, 76200, 359000, 43500],
        [130600, 152300, 718100, 87000], [261100, 304600, 1436200, 174100],
        [522200, 609300, 2872300, 348200], [1044500, 1218600, 5744600, 696300],
        [2089000, 2437100, 11489300, 1392600], [4177900, 4874200, 22978600, 2785300],
      ], 'chengqiang'),
    },
    yizhan: {
      id: 'yizhan', series: 'road', name: '驿站', icon: '🏇', desc: '置驿传命，通达四方 —— 己方城池间行军提速（1.5 倍起步）。',
      buildCost: { grain: 1500, wood: 5000, stone: 4500, iron: 500 }, maxLevel: 12, prod: null,
      levelCost: costTable([[1500,5000,4500,500,3600],[3000,10000,9000,1000,7990],[6000,20000,18000,2000,17345],[12000,40000,36000,4000,36765],[24000,80000,72000,8000,76105],[48000,160000,144000,16000,153735],[96000,320000,288000,32000,302860],[192000,640000,576000,64000,581485],[384000,1280000,1152000,128000,1087380],[768000,2560000,2304000,256000,1979035]], 'yizhan'),
      /* v54：驿站速度是等差（每级 +0.5），续到 24 级 */
      speed: growStep([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7], DATA.MAX_LEVEL_ABS, 0.5),
    },
    fenghuotai: {
      id: 'fenghuotai', series: 'mil', name: '烽火台', icon: '🔥', desc: '烽燧相望，警讯千里 —— 侦察：8 级看兵力、9 级看将领、10 级看科技；满级 27×27 范围内行军 +50%。',
      buildCost: { grain: 150, wood: 1500, stone: 500, iron: 1500 }, maxLevel: 12, prod: null,
      levelCost: costTable([[150,1500,500,1500,1080],[300,3000,1000,3000,2400],[600,6000,2000,6000,5205],[1200,12000,4000,12000,11030],[2400,24000,8000,24000,22830],[4800,48000,16000,48000,46120],[9600,96000,32000,96000,90855],[19200,192000,64000,192000,174445],[38400,384000,128000,384000,326215],[76800,768000,256000,768000,593710]], 'fenghuotai'),
    },
    majiu: {
      id: 'majiu', series: 'store', name: '马厩', icon: '🐎', desc: '牧养战马，蓄力千里 —— 养马与坐骑培育，骑兵与坐骑必备。',
      buildCost: { wood: 2000, stone: 800, iron: 1000, grain: 1200 }, maxLevel: 12, prod: null,
      levelCost: costTable([[2000,800,1000,1200,540],[4000,1600,2000,2400,1200],[8000,3200,4000,4800,2600],[16000,6400,8000,9600,5515],[32000,12800,16000,19200,11415],[64000,25600,32000,38400,23060],[128000,51200,64000,76800,45430],[256000,102400,128000,153600,87225],[512000,204800,256000,307200,163105],[1024000,409600,512000,614400,296855]], 'majiu'),
    },
    kezhan: {
      id: 'kezhan', series: 'live', name: '客栈', icon: '🍶', desc: '招贤纳士，广听市井 —— 招募将领（每级 +1 停留将领）；市井传闻可查名将坐标。',
      buildCost: { grain: 300, wood: 2000, stone: 1000, iron: 400 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([300,2000,1000,400,480], [146285,910005,465660,190615,263870], 10), 'kezhan'),
    },
    zhaoxianguan: {
      id: 'zhaoxianguan', series: 'edu', name: '招贤馆', icon: '🎎', desc: '筑馆延宾，礼贤下士 —— 将领居所（每级 +1 房间），无空房不可招新。',
      buildCost: { grain: 400, wood: 2500, stone: 1200, iron: 700 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([400,2500,1200,700,720], [195050,1137510,558795,333575,395805], 10), 'zhaoxianguan'),
    },
    /* v89.74（老板：「鸿胪寺已拆除，将其替换名称为门派，并提供至建造名单」）——
       只改**显示名 / 图标 / 说明**，`id` 一律保持 `honglusi`：
       这个 id 被存档键、10 篇故事锚点（bld-honglusi-01..10）、满级专精、
       建筑分类、建造前置、UNIQUE_BUILDINGS 全面引用 —— 改 id 会连带
       存档不兼容与 10 篇故事的锚点重编，收益为零（玩家只看得到 name）。
       既有的「满级专精：全城产量 +6%」**原样保留**（不推翻已上线数值）。
       名称用 v89.62 门派系统拍板定的「门派驻地」（老板当时对"门派建筑叫什么"的答复）；
       前置沿用客栈 Lv3（原为"鸿胪寺主迎来送往"，现读作"开山收徒，须先有安置门人的客栈"）。 */
    honglusi: {
      id: 'honglusi', series: 'gov', name: '门派驻地', icon: '🗡️',
      desc: '江湖门墙，习武论道 —— 入派修习、结交同道；五阶声望由门派任务累积。',
      buildCost: { grain: 250, wood: 2000, stone: 500, iron: 300 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([250,2000,500,300,1440], [121905,910005,232830,142960,791615], 10), 'honglusi'),
    },
    tiejiangpu: {
      id: 'tiejiangpu', series: 'biz', name: '铁匠铺', icon: '⚒️', desc: '炉火照夜，锻铁成兵 —— 打造武器与装备强化。',
      buildCost: { grain: 350, wood: 1000, stone: 600, iron: 1200 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([350,1000,600,1200,360], [170670,455005,279395,571840,197905], 10), 'tiejiangpu'),
    },
    gongjiangzuofang: {
      id: 'gongjiangzuofang', series: 'biz', name: '工匠作坊', icon: '🛠️', desc: '百工群集，匠心营器 —— 制造攻守城器械。',
      buildCost: { grain: 450, wood: 1500, stone: 500, iron: 1500 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([450,1500,500,1500,1080], [219430,682505,232830,714800,593710], 10), 'gongjiangzuofang'),
    },
  };

  /* v89.126（老板）：「将城墙与其他建筑并列管理，只是一个有特殊功能的建筑」——
     城墙**占一格**、进建造列表；建造 / 升级 / 取消 / 提速全走通用出口
     （buildAt / upgradeAt / cancelRefundOf / queueValueOf），不再有独立面板与队列类型。
     历史上（v16~v89.125）城墙"不占格"（等级存 `city.wallLv`）——
     老档由 loadGame 迁移进格子；视觉上"环城一圈"保留（isoWallSVG，点它=打开城墙格面板）。 */
  DATA.BUILD_ORDER = ['minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai', 'chengqiang'];

  /* ============================================================
   * 建造前置（v68 · 老板需求「让玩家逐步探索」）
   * ------------------------------------------------------------
   * 与 buildCapOf 的「官府总闸」分工：
   *   · 总闸（代码内）→ 等级上限：城内建筑（含城墙）等级 ≤ 官府等级
   *   · 本表（数据）  → 建造前置：先有 X 才能建 / 升 Y
   * 检查在 buildAt 与 upgradeAt 两端都生效（建造与升级同一把尺）。
   * 判定唯一出口：GAME.buildPrereqOf（UI 提示与内核拦截共用）。
   * ============================================================ */
  DATA.BUILD_PREREQ = {
    zhaoxianguan:     { kezhan: 2 },     // 先客栈后招贤馆：有安顿来客之处，方可设馆纳贤
    gongjiangzuofang: { tiejiangpu: 3 }, // 工匠作坊：器械以铁作底，铁匠铺 Lv3 起步
    xiaochang:        { junying: 2 },    // 先募兵（军营）再练兵（校场）
    yizhan:           { shichang: 2 },   // 驿传通商：先有市场才有驿路
    honglusi:         { kezhan: 3 },     // 门派驻地开山收徒：先有安置门人的客栈 Lv3（原「鸿胪寺主迎来送往」）
    majiu:            { junying: 3 },    // 养马为骑军基础：军营 Lv3
  };

  /* ============================================================
   * 满配城池的城内布局（v61 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「野地里的城池，应默认其建筑全都建满了，城内所有建筑各1个，
   *   兵营2个，其他建民房，位置也相对固定一下。城池的地块数量根据等级，数量你来定」
   *
   * 这是**系统生成的城**（野外城池 + 未占据名城）共用的布局规则，
   * 一个出口 `GAME.cityPlanOf`，别处不要再自己铺格子（铺法不一致就是新的"两个出口"）。
   *   ① 官府：**棋盘正中** 2×2（v68 起与玩家城 `makeCity` 走同一出口 `GAME.govCellsOf`，
   *      这样攻占后玩家看到的还是自己熟悉的格局）；
   *   ② 军营 **2 座**，紧挨官府（第一优先占位）；
   *   ③ 其余建筑**各 1 座**（`BUILD_ORDER` 去民房后的 12 种）；
   *   ④ 剩下的格子**全部民房** —— 民房数直接决定人口上限，
   *      所以"满配城"的人口由格数表与民房等级表共同决定，不再是拍脑袋。
   *   ⑤ 位置"相对固定"：所有非官府格按**到城池中心**的曼哈顿距离升序取用
   *      （同距按格号），于是核心功能建筑永远在中间、民房永远在最外圈 ——
   *      跨等级、跨城池都遵循同一条规则，玩家看得懂、也能预期。
   *
   * 格数**统一 8 列 × 6 行 = 48 格**（v65 · 老板）：
   *   老板原话：「城内建筑按照 6*8，官府靠右居中位置固定，**怎么现在变成4*8了？**」
   *   —— v63 的"按等级分档"（1~2级 6×4 / 3~4级 8×4 / …）会让低等级城只有 4 行，
   *   老板随手点到的正好是那几座，于是看到 8×4。既然他要"满配"，就不该有高低档：
   *   **所有系统城一律 48 格**，只有建筑等级随档位变（见 `GAME.npcBuildLvOf`）。
   *   8 列也是硬约束：攻占后建筑就地转正（v60），系统城比玩家城宽就会越界。
   * ============================================================ */
  /* ============================================================
   * 仓储容量的两个基准常量（v89.81 提到数据层 —— 原先散落在 domain.js）
   * ------------------------------------------------------------
   * `BASE_STORE`：每"仓等级"的容量底，也是无仓库时的保底。
   * `TECH_MAX_LV`：科技可研究的最高等级（满级加成 = 等级 × 各项 per）。
   * 两者都是**唯一出口**：玩家侧 `GAME.storeCapOf` 与名城库藏派生
   * （`DATA.NPC_CITY_RES.resByTier`）共用，别处不许再写一遍数字。
   * ============================================================ */
  DATA.BASE_STORE = 2000000;
  DATA.TECH_MAX_LV = 10;

  DATA.CITY_PLAN = {
    /* [列, 行] —— **唯一来源**：改这里就是改全图所有系统城的棋盘尺寸。
       原先的 `sizeByLevel` 档位表已删（v65）：所有档位填同一个值就是死数据。 */
    size: [8, 6],
    /* 城等级的满级（系统城的库藏/守军派生都按它做上限） */
    maxLevel: 10,
    /* 落位优先级：军营成对排最前（要紧挨官府），其余 12 种各 1 座，余格民房 */
    /* v70（老板）：「城内所有建筑 1 个，但是军营 2 个，**仓库 4 个**，其他以民居填充」——
       仓库 1 → 4（分仓：营建与养兵都吃存量，仓容是经营主线），四座挨着排、成"仓廪区"。
       民房数随之 30 → 27（人口上限按民房座数派生，见 `GAME.planPopCapOf`，自动跟着走）。
       v89.126：城墙占格 → order 收录 chengqiang，民房 27 → 26（人口上限同步派生）。 */
    order: ['junying', 'junying', 'shuyuan', 'xiaochang', 'shichang',
      'cangku', 'cangku', 'cangku', 'cangku',
      'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai', 'chengqiang'],
    filler: 'minfang',
  };

  /* ============================================================
   * 侦查情报分层（v65 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「不同侦察技巧等级应该可以侦察出**不同类型**的信息，比如，
   *   资源数量，兵种数量，将领名称属性，建筑等级和数量，可获得的宝物/特产等」
   *
   * 改前：一次侦查**全给**（v27 的"一次给出六项"），侦察技巧只影响顺手拾获率 ——
   *   于是这条科技在情报上没有成长感，"升它有什么用"答不上来。
   * 改后：每一层情报挂一个**解锁等级**，等级不到就查不到那一条（界面里写明还差几级）。
   *   `unlock` 从 1 起、逐层 +2，满级 10 恰好全开。
   *   唯一出口 `GAME.battle.intelTiersOf()`，战斗侧与界面都读它，不许各判一遍。
   *
   * ⚠️ 顺手拾获（材料/宝物）**不受分层影响** —— 那是"顺手拿到的"，不是"看出来的"，
   *    仍按 `TB('scout')` 提升数量与概率。
   * ============================================================ */
  DATA.SCOUT_INTEL = [
    { id: 'total', unlock: 1, name: '守军总数',
      hint: '敌军共多少人（未研究时只能估个大概）' },
    { id: 'res', unlock: 3, name: '资源数量',
      hint: '城内库藏：粮草 / 木材 / 石料 / 铁锭 / 黄金 / 人口' },
    { id: 'troops', unlock: 5, name: '兵种编制',
      hint: '逐兵种的**准确**数量（此前只能看个总数）' },
    { id: 'guard', unlock: 7, name: '守将名册',
      hint: '守将姓名、资质、等级与六维' },
    { id: 'build', unlock: 9, name: '建筑工事',
      hint: '城内建筑种类与座数、城墙等级、城防与箭塔' },
    { id: 'spoils', unlock: 10, name: '可图之利',
      hint: '可获珠宝、材料、军械、可采资源与占领后的产量加成' },
  ];

  /* v89.36（老板「维持军队无需耗粮食」）：缺粮哗变系统（DATA.STARVE /
     starveStep / mutinyOf / isStarving）随「军队维持耗粮」一并退役 ——
     军队不再吃粮，断粮与哗变失去触发条件；粮改为**募兵时一次性消耗**。 */

  /* ============================================================
   * 城外资源建筑（4种 · 数量制，上限=12+(官府等级-1)×3）
   * 产量统一 = 占用人口×10 /h（10级 5500/h）；消耗逐级≈×2
   * ============================================================ */
  var FARM_COST = extRows([[50,300,200,150,60],[100,600,400,300,135],[200,1200,800,600,305],[400,2400,1600,1200,655],[800,4800,3200,2400,1370],[1600,9600,6400,4800,2775],[3200,19200,12800,9600,5440],[6400,38400,25600,19200,10310],[12800,76800,51200,38400,18870],[25600,153600,102400,76800,33300],
                    [51200,307200,204800,153600,62000],[102400,614400,409600,307200,115000]], DATA.MAX_LEVEL_ABS);
  /* v54：产量表同样续到 MAX_LEVEL_ABS —— 城外地块在都城能升到 24 级，
     表短一级就是 `prod[23] = undefined` → 该地块产量直接变 NaN。 */
  var PROD_H = growRatio([100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800],
    DATA.MAX_LEVEL_ABS);
  DATA.EXT_BUILDINGS = {
    farm:   { id: 'farm', name: '农田', icon: '🌾', res: 'grain', prod: PROD_H, cost: FARM_COST,
              costBias: function (r) { return [r[0], r[1], r[2], r[3], r[4]]; } },
    forest: { id: 'forest', name: '伐木场', icon: '🪓', res: 'wood', prod: PROD_H,
              cost: FARM_COST.map(function (r) { return [Math.round(r[0]*1), Math.round(r[1]*1.5), Math.round(r[2]*0.6), Math.round(r[3]*0.5), r[4]]; }) },
    quarry: { id: 'quarry', name: '采石场', icon: '⛰️', res: 'stone', prod: PROD_H,
              cost: FARM_COST.map(function (r) { return [Math.round(r[0]*0.8), Math.round(r[1]*0.5), Math.round(r[2]*1.6), Math.round(r[3]*0.5), r[4]]; }) },
    mine:   { id: 'mine', name: '铁矿场', icon: '⛏️', res: 'iron', prod: PROD_H,
              cost: FARM_COST.map(function (r) { return [Math.round(r[0]*0.8), Math.round(r[1]*0.5), Math.round(r[2]*0.5), Math.round(r[3]*1.6), r[4]]; }) },
  };
  DATA.EXT_BUILD_ORDER = ['farm', 'forest', 'quarry', 'mine'];

  /* v24（需求 7）：城外地块上限按官府等级查表。
     原公式 12+(官府-1)×3 在 10 级得 39 —— 8 列排下来末行只剩 7 格，
     看着像"缺了一块"。本表 10 级给 40（正好 5 整行），中间等级沿用原节奏。 */
  /* ============================================================
   * 满级专精（v28 · 需求 1）
   * ------------------------------------------------------------
   * 建筑上限由 10 提到 12 之后，"12 级"必须给出**机制层**的回报，
   * 否则玩家到 10 级就没有目标、11/12 级只是两行更贵的数字。
   *
   * 每一条都接在真实消费点上（括号内是消费点，改这里务必同步改那里）：
   *   buildSlot      GAME.buildSlots          同时建造的队列数
   *   popPct         GAME.maxPopOf            人口上限
   *   techPct        GAME.systems.research    科技研究耗时
   *   trainSlot      GAME.trainQueueSlots     募兵队列位（每座军营）
   *   marchCapPct    GAME.battle.prepare      校场出征容量
   *   storePct       GAME.storeCap            仓储上限
   *   defPct         GAME.cityDefense         城防值（守军减伤）
   *   marchAdd       GAME.march.speedFactor   行军速度系数
   *   prodPct        GAME.prodFactors         全城资源产量
   *   genRoom        GAME.genSlotsOf(city)    该城将领席位数
   *   innSlot        GAME.innSlots           客栈候选将领数
   *   craftTimePct   GAME.train（craft 兵种）  器械打造耗时
   *   beaconBoost    GAME.march.speedFactor  烽火台行军加成的范围与强度
   * ============================================================ */
  DATA.MASTERY = [
    { bid: 'guanfu', key: 'buildSlot', val: 1, txt: '同时建造 +1 队' },
    { bid: 'minfang', key: 'popPct', val: 0.20, txt: '本城人口上限 +20%' },
    { bid: 'shuyuan', key: 'techPct', val: 0.25, txt: '科技研究速度 +25%' },
    { bid: 'junying', key: 'trainSlot', val: 1, txt: '本营募兵队列位 +1' },
    { bid: 'xiaochang', key: 'marchCapPct', val: 0.25, txt: '出征容量 +25%' },
    { bid: 'shichang', key: 'caravanPct', val: 0.10, txt: '交易折损 −10%' },
    { bid: 'cangku', key: 'storePct', val: 0.50, txt: '仓储存量 +50%' },
    { bid: 'chengqiang', key: 'defPct', val: 0.25, txt: '城防 +25%' },
    { bid: 'yizhan', key: 'marchAdd', val: 0.5, txt: '行军速度再 +0.5 倍' },
    { bid: 'fenghuotai', key: 'beaconBoost', val: 0.2, txt: '烽火加成范围 +6 格、强度 +20%' },
    { bid: 'majiu', key: 'prodPct', val: 0.06, txt: '全城产量 +6%' },
    { bid: 'kezhan', key: 'innSlot', val: 2, txt: '候选将领 +2 位' },
    { bid: 'zhaoxianguan', key: 'genRoom', val: 2, txt: '将领房间 +2' },
    { bid: 'honglusi', key: 'prodPct', val: 0.06, txt: '全城产量 +6%' },
    { bid: 'tiejiangpu', key: 'prodPct', val: 0.06, txt: '全城产量 +6%' },
    { bid: 'gongjiangzuofang', key: 'craftTimePct', val: 0.15, txt: '器械打造耗时 −15%' },
  ];

  DATA.EXT_CAP_BY_LV = [12, 15, 18, 21, 24, 27, 30, 33, 36, 40, 44, 48];
  /* v54：官府在名城能盖得更高（都城到 24），表要跟着长。
     末段步长沿用 +4（就是 10→12 级那一档的步长），口径唯一、可写断言。
     不续的话 `extCap` 会一直取到最后一项 48 —— 都城 20 级官府还只能占 48 块地。 */
  (function () {
    while (DATA.EXT_CAP_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      DATA.EXT_CAP_BY_LV.push(DATA.EXT_CAP_BY_LV[DATA.EXT_CAP_BY_LV.length - 1] + 4);
    }
  })();

  /* ============================================================
   * 城外地块的**数量表**（v70 · 老板）—— 唯一出口 `GAME.extPlanOf`
   * ------------------------------------------------------------
   * 老板原话：「城外根据官府等级，也要满建筑，你设计一个各建筑数量对应官府等级表，使数量合理」
   * 改前：按 ['farm','farm','forest','quarry','mine'] 循环填满上限 ——
   *   数量比恒为 2:2:1:1:1，与官府等级没有关系（等于没设计）。
   * 改后：`EXT_PLAN_BY_LV[lv-1] = [农田, 伐木场, 采石场, 铁矿场]`，
   *   **合计恰等于 `EXT_CAP_BY_LV[lv-1]`**（"满建筑"= 一块不空、一块不多）。
   *
   * 设计口径（可复算、可断言）：
   *   · 粮是养兵主线（v89.36 起"养"由维持耗粮改为**募兵一次性耗粮**，粮依然吃重）→ 农田恒占 1/3 上下；
   *   · 早期营建吃木石、装备吃铁 → 采石/铁矿从 2 长到 9，中后期追上农田的增速；
   *   · 四类各 ≥ 2 块：任何等级都不会"某资源无产地"。
   * 逐档合计：12/15/18/21/24/27/30/33/36/40/44/48 —— 与上限表逐项相等。
   * 13 级起（名城官府可到 24）按末段步长 +4 续：四类各 +1。
   * ============================================================ */
  DATA.EXT_PLAN_BY_LV = [
    [5, 3, 2, 2],   [6, 4, 2, 3],   [7, 5, 3, 3],   [8, 6, 4, 3],
    [9, 7, 4, 4],   [10, 8, 5, 4],  [11, 9, 5, 5],  [12, 10, 6, 5],
    [13, 11, 6, 6], [14, 12, 7, 7], [15, 13, 8, 8], [16, 14, 9, 9],
  ];
  (function () {
    while (DATA.EXT_PLAN_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      var last = DATA.EXT_PLAN_BY_LV[DATA.EXT_PLAN_BY_LV.length - 1];
      DATA.EXT_PLAN_BY_LV.push(last.map(function (n) { return n + 1; }));
    }
  })();

  /* ============================================================
   * 兵种（18种 · 报告8.1/8.2/8.3：hp/atk/def/射程/速度/负重/人口/训练秒）
   * ------------------------------------------------------------
   * v89.36（老板「维持军队无需耗粮食，相应招募提供耗粮3倍」）：
   *   · 每兵每小时耗粮（food）与「军队维持耗粮」整体退役（缺粮/哗变一并下线）；
   *   · 粮改为**成军一次性消耗** —— 全部兵种 cost.grain ×3。
   * ============================================================ */
  /* ============================================================
   * 兵种（18种）
   * ------------------------------------------------------------
   * v28（需求 0）：高等级兵种的攻/血做过一次校正。起因是实测发现
   * **人口约束下最贵的兵最弱**：
   *     人口 5500 时，铁骑 1833 打不过长枪 5500（攻 64万 vs 82万、
   *     有效生命 825万 vs 412万）—— HP 只决定"能撑多久"，杀伤由攻击决定，
   *     所以"每人口攻击"低的兵种必输。
   * 校正口径：从长枪兵（pop1 / atk150 / hp300 / def150 → atk/pop 150、
   * ehp/pop 750）往上，**每人口攻击与每人口有效生命双双不低于上一档**。
   * 角色特化兵种例外，靠各自的定位取胜：
   *     弓箭手 / 床弩 / 投石车 —— 靠射程（1200 / 1400 / 1600）
   *     刀盾兵 / 冲车 —— 靠坦度（ehp/pop 1400 / 8400）
   *     斥候 —— 不参战（nocombat）；民夫 / 辎重车 —— 后勤（负重）
   * ============================================================ */
  /* v84（老板）：「辎重车是骑兵吧，斥候是步兵」——
     cat 只决定**募兵分页归属**（inf → 步兵页 / cav → 骑兵页），与战场定位无关：
     斥候（侦察）归步兵页，辎重车（后勤货运）归骑兵页。 */
  /* v89.96 耐久标定（老板「调整兵种属性」）：全部兵种 hp ×6 ——
     标定依据（双约束，实测见 probe_v8996_dmgchain / tmp/_cal96）：
       · 裸兵杀率地基 = 兵攻 ÷ 兵血 = 220/300 = 0.73/回合（一击清场）；
         ×6 后 0.12/回合（一回合打掉 12%）——带将主流对局 13 回合（目标 8~16）；
       · 最慢组合（义兵对拼，攻 50 / 血 1200）= 0.042/回合 → ~24 回合，
         不撞 30 回合上限（×10 时会撞顶，见 _cal96 的对等战矩阵）。
     兵种间相对强弱**完全不变**（同乘）；战力尺（STORY.troopPower 直接读本表）、
     守军、UI 显示、探针全线自动跟随，不留"只有战斗变慢"的暗角。 */
  /* v89.114（老板「为兵种增加负重属性，战斗所能携带的物资 / 掠夺返回的物资数量，
     与军队总负重有关；探索适用各兵种的负重数值」）——**负重标定**。
     ------------------------------------------------------------
     load 从本轮起吃**两条线**：① 出征随军辎重的运力（v89.103）；
     ② **掠夺战利品的搬运上限**（本轮新增：战利品总重 > 随军载重时，
     只能搬走载重范围内的部分，余留库中 —— 见 battle.haulPlanOf）。
     标定基准（让"打得起就搬得走"成立，复核数据见 probe_v89114_load.js）：
       · **基准：一名步兵 = 50**（随身干粮与水之外的余量）；
       · 步战主力 45~60 —— 甲械越重、能背回的越少（刀盾 50 / 弓箭 45 / 长枪 60）；
       · 骑兵 = 步兵 ×4~5（一人一马）：轻骑 250 / 铁骑 200（人马具甲）/ 突骑 120 / 虎豹 150；
       · 战象 = 步兵 ×16（驮载之王）：800；
       · 后勤专精：民夫 = 步兵 ×10（500）；辎重车 = 步兵 ×400（**20000**，一车顶 40 人挑）；
       · 器械（床弩 20 / 冲车 25 / 投石车 30）：自身就是"被运的货"，无携行余力；
       · 斥候 30（不列阵，但能背）。
     标定效果：纯战兵编队可搬同级战利品约 1/4~1/3；**编入约 1% 辎重车（或 5% 民夫）
     即可全数搬回** —— "带不带后勤"从此是一道真题，而不是一句空话。 */
  DATA.TROOPS = {
    minfu:   { id: 'minfu', cat: 'inf', name: '民夫', icon: '🪓', hp: 600,  atk: 5,   def: 10, range: 10,   spd: 180,  gather: 2, load: 500,  pop: 1, time: 40,   cost: { grain: 150, wood: 150, iron: 10 }, unlock: { junying: 1 }, desc: '基础民夫，战力孱弱，可运输' },
    yibing:  { id: 'yibing', cat: 'inf', name: '义兵', icon: '🗡️', hp: 1200, atk: 50,  def: 50, range: 20,  spd: 200,  gather: 3, load: 50,   pop: 1, time: 20,   cost: { grain: 240, wood: 100, iron: 50 }, unlock: { junying: 1 }, desc: '聚集的义军，初具战力' },
    chihou:  { id: 'chihou', cat: 'inf', name: '斥候', icon: '🦅', hp: 600,  atk: 20,  def: 20, range: 20,  spd: 3000, gather: 1, load: 30,    pop: 1, nocombat: true, time: 90,   cost: { grain: 360, wood: 200, iron: 150 }, unlock: { junying: 2, shuyuan: 2 }, desc: '极限速度，侦察/截援必备' },
    changqiang: { id: 'changqiang', cat: 'inf', name: '长枪兵', icon: '🔱', hp: 1800, atk: 150, def: 150, range: 50, spd: 300, gather: 4, load: 60, pop: 1, time: 140, cost: { grain: 450, wood: 500, iron: 100 }, unlock: { junying: 2, shuyuan: 2 }, desc: '克制骑兵，阵型严整' },
    daodun:  { id: 'daodun', cat: 'inf', name: '刀盾兵', icon: '🛡️', hp: 2400, atk: 130, def: 250, range: 30, spd: 275, gather: 4, load: 50, pop: 1, time: 210, cost: { grain: 600, wood: 150, iron: 400 }, unlock: { junying: 3, shuyuan: 3 }, desc: '高防御，克远程，炮灰首选' },
    gongjian: { id: 'gongjian', cat: 'inf', name: '弓箭手', icon: '🏹', hp: 1920, atk: 220, def: 50, range: 1200, spd: 250, gather: 5, load: 45, pop: 2, time: 340, cost: { grain: 900, wood: 350, iron: 300 }, unlock: { junying: 4, shuyuan: 4 }, desc: '远程主力，射程1200' },
    qingji:  { id: 'qingji', cat: 'cav', name: '轻骑兵', icon: '🐎', hp: 3720, atk: 340, def: 180, range: 80, spd: 1000, gather: 6, load: 250, pop: 2, time: 480, cost: { grain: 3000, wood: 600, iron: 500 }, unlock: { junying: 5, majiu: 1 }, desc: '机动突袭，抓将主力（需马厩）' },
    tieji:   { id: 'tieji', cat: 'cav', name: '铁骑兵', icon: '🐴', hp: 7200, atk: 520, def: 350, range: 70, spd: 600, gather: 9, load: 200, pop: 3, time: 1450, cost: { grain: 6000, wood: 500, iron: 2500 }, unlock: { junying: 7, shuyuan: 6, majiu: 3 }, desc: '重装铁骑，攻守兼备（需马厩3）' },
    zhouche: { id: 'zhouche', cat: 'cav', name: '辎重车', icon: '🛺', hp: 4200, atk: 10, def: 60, range: 10, spd: 150, gather: 1, load: 20000, pop: 4, time: 970, cost: { grain: 1800, wood: 1500, iron: 350 }, unlock: { junying: 5 }, desc: '专属运资，负重冠绝全军' },
    chuangnu: { id: 'chuangnu', name: '床弩', icon: '🏹', hp: 5400, atk: 500, def: 160, range: 1400, spd: 120, gather: 2, load: 20, pop: 3, time: 2910, cost: { grain: 7500, wood: 3000, iron: 1800 }, craft: true, unlock: { junying: 8, shuyuan: 8, gongjiangzuofang: 3 }, desc: '强力远程，攻城利器（工匠作坊制造）' },
    chongche: { id: 'chongche', name: '冲车', icon: '🚩', hp: 36000, atk: 620, def: 600, range: 50, spd: 160, gather: 2, load: 25, pop: 5, time: 4370, cost: { grain: 12000, wood: 6000, iron: 1500 }, craft: true, unlock: { junying: 9, shuyuan: 8, gongjiangzuofang: 5 }, desc: '重甲巨车，城墙杀手（工匠作坊制造）' },
    toudan:  { id: 'toudan', name: '投石车', icon: '🪨', hp: 6600, atk: 950, def: 200, range: 1600, spd: 100, gather: 2, load: 30, pop: 4, time: 5830, cost: { grain: 15000, wood: 5000, stone: 8000, iron: 1200 }, craft: true, unlock: { junying: 10, shuyuan: 10, gongjiangzuofang: 7 }, desc: '攻950射程1600，攻城巨炮（工匠作坊制造）' },
    /* 特殊兵种（需对应州城 + 科技） */
    qingzhoubing: { id: 'qingzhoubing', cat: 'inf', name: '青州兵', icon: '🥷', hp: 3720, atk: 350, def: 200, range: 60, spd: 350, gather: 6, load: 80, pop: 2, time: 115, cost: { grain: 2400, wood: 600, iron: 400 }, unlock: { junying: 8, shuyuan: 6, city: 'qingzhou', tech: { xingjun: 5 } }, desc: '青州精兵' },
    tengjiabing: { id: 'tengjiabing', cat: 'inf', name: '藤甲兵', icon: '🛡️', hp: 3600, atk: 340, def: 350, range: 60, spd: 300, gather: 5, load: 55, pop: 2, time: 170, cost: { grain: 1800, wood: 300, iron: 500 }, unlock: { junying: 8, shuyuan: 7, city: 'yizhou', tech: { fanghu: 8 } }, desc: '防350，刀枪不入（惧火）' },
    tuqibing: { id: 'tuqibing', cat: 'cav', name: '突骑兵', icon: '🏇', hp: 3840, atk: 330, def: 150, range: 1000, spd: 450, gather: 7, load: 120, pop: 2, time: 270, cost: { grain: 3600, wood: 500, iron: 800 }, unlock: { junying: 9, shuyuan: 7, majiu: 3, city: 'hebei', tech: { paoshe: 5, jiayu: 5 } }, desc: '骑射突袭，射程1000' },
    hubaoqi: { id: 'hubaoqi', cat: 'cav', name: '虎豹骑', icon: '🪓', hp: 4800, atk: 510, def: 250, range: 70, spd: 850, gather: 10, load: 150, pop: 3, time: 385, cost: { grain: 4500, wood: 800, iron: 1200 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'sili', tech: { tongshuai: 9, lianbing: 7 } }, desc: '曹魏精锐骑兵' },
    xiliangtieqi: { id: 'xiliangtieqi', cat: 'cav', name: '西凉铁骑', icon: '🐻', hp: 8400, atk: 700, def: 400, range: 80, spd: 750, gather: 10, load: 220, pop: 4, time: 1160, cost: { grain: 5400, wood: 700, iron: 2000 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'liangzhou', tech: { jiayu: 7 } }, desc: '攻700防400，攻守兼备' },
    /* v89.118（老板「象兵不设置克制，正常攻防」）：数值按"无克制、硬碰硬"重新标定 ——
       hp 18000→15000 · atk 880→620 · def 400→300（probe_v89118_elephant 实测）：
         · 撤克制的原值：对象兵对步兵近乎无损（损 8%）＝"无弱点"换个法子回来；
         · 标定后：对长枪/刀盾胜而损 17~19%（强但肉疼）；同人口西凉铁骑可全歼象兵（凉骑损 52%）；
         · 定位从"攻守双绝"改为**血牛重坦**（hp/pop 全表最高 3000、atk/pop 124 最低）。 */
    nanjiangxiangbing: { id: 'nanjiangxiangbing', cat: 'cav', name: '南疆象兵', icon: '🐘', hp: 15000, atk: 620, def: 300, range: 70, spd: 400, gather: 12, load: 800, pop: 5, time: 3500, cost: { grain: 9000, wood: 1000, iron: 2500 }, unlock: { junying: 9, shuyuan: 8, city: 'yizhou', tech: { yiliao: 8, zhandou: 7 } }, desc: '南疆巨兽，血厚守坚；无相克，凭蛮力硬拼' },
  };

  /* ============================================================
   * 兵种相克（v57 · 老板选 **B 套**：分方向的攻/防两向因子）
   * ------------------------------------------------------------
   * 原版有两套互相矛盾的说法（见 `docs/_参考/热血三国战斗设定检索.md` 第七节）：
   *   A 套（官方攻略）：**互克**框架，算在**攻击方**（我打你，我攻击力 ×N）
   *   B 套（玩家实测帖）：主要算在**防御方**（我被你打，我防御力 ×N），
   *       且明确反驳 A 套的"盾打枪 110% / 骑打弓 120%"——「这两个都没有任何加成」。
   * 老板选 B。所以这里**不再是一张互克表，而是两张方向不同的表**：
   *   · `COUNTER_ATK[我][你]` = 我打你时，**我的兵攻** ×N
   *   · `COUNTER_DEF[我][你]` = 我挨你打时，**我的兵防** ×N
   * 这条改动的实质：从"堆克制表"变成"每个兵种的固有特性"（刀盾抗箭、
   * 轻骑吃箭少、冲车像盾车），所以"盾打枪""骑打弓"这种说法在新结构里
   * **不存在**——不是被削弱，而是压根没有这项。
   * ============================================================ */
  DATA.COUNTER_ATK = {
    /* 枪克骑：长枪对骑兵 ×300%（v89.96 标定）——
       ⚠️ 原版 B 套为 ×200%，但本作骑兵 hp 2 倍 + 攻 2.3 倍，实测 ×2 时
       "枪 vs 骑 1:1 完败（损 6000/敌 891）"——克制名存实亡。
       攻 ×3 + 防御向"长枪拒马"×5 后：枪 vs 骑 1:1 胜、战损 3398:6000（1:1.77）。
       扫参表见 probe_v8996_dmgchain 的 K/N 候选矩阵（K3/N5 胜出）。
       突骑/虎豹骑/西凉铁骑是我们自扩展的同族兵种，一并算骑兵——
       否则同族里只有轻/铁被克，另三种变成"无弱点的骑兵"，关系会断裂）
       ⚠️ v89.118（老板令「象兵不设置克制，正常攻防」）：**象兵不进克制表** ——
         它的强弱只由自身 hp/atk/def 决定（数值已按 probe_v89118_elephant 标定：
         对步兵赢但损 15~20%，被同人口西凉铁骑全歼 —— "强但可打"）。 */
    changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },
    /* 床弩打器械 ×300%（原版点名：冲车 / 辎重 / 投石 / 床弩） */
    chuangnu: { chongche: 3, zhouche: 3, toudan: 3, chuangnu: 3 },
  };
  DATA.COUNTER_DEF = {
    /* 刀盾防远程 ×300%（"盾牌挡箭"这一常识的结构化） */
    daodun: { gongjian: 3, chuangnu: 3, toudan: 3 },
    /* v89.96 标定：**长枪拒马**（枪挨骑打时兵防 ×5）——与上表的"枪打骑 ×3"配套。
       依据：原版只有攻击向一条，实测不足以体现"枪克骑"（见上表注释）；
       防御向补强符合 B 套"克制靠挨打少实现"的框架（同"刀盾挡箭"的逻辑）。 */
    /* v89.118（老板令「象兵不设置克制，正常攻防」）：象兵不进这张表 ——
       它与骑兵同族但按自己的血厚硬拼，不享"拒马"的防御向加成。 */
    changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5 },
    /* 轻骑防远程 ×400% —— 这就是"骑兵冲弓阵"的机制来源：
       B 套没有"骑打弓 +120%"那条，克制是通过**自己挨打少**实现的 */
    qingji: { gongjian: 4, chuangnu: 4, toudan: 4 },
    /* 铁骑防远程 ×200%（重甲但不如轻骑灵活） */
    tieji: { gongjian: 2, chuangnu: 2, toudan: 2 },
    /* 冲车防弓 ×500% —— **只防弓，不防弩、不防投**（原版明确写） */
    chongche: { gongjian: 5 },
    /* v59（老板："虎豹骑参考轻骑兵，西凉铁骑参考铁骑，突骑不用"）：
       这两种是我们自扩展的同族骑兵，原版只点名了轻骑（×4）与铁骑（×2），
       于是按**同族类比**取同一因子 —— 依据是老板的指示 + 同族同属性，
       **不是原版直接点名**（这一点在文档里要写明，免得后人以为有原文出处）。 */
    hubaoqi: { gongjian: 4, chuangnu: 4, toudan: 4 },
    xiliangtieqi: { gongjian: 2, chuangnu: 2, toudan: 2 },
    /* ⚠️ 突骑（tuqibing）**保持没有因子**（老板："突骑不用"）——
       这是"压根没有这项"，不是"被削弱"。 */
  };

  /* ============================================================
   * 阵位与指挥指令（v59 · 老板"阵位+指挥指令也加上"）
   * ------------------------------------------------------------
   * 照搬原版（`docs/_参考/热血三国战斗设定检索.md` §九，2024 新战术指挥系统）：
   *   · 每个兵种两个变量：**动作**（前进 / 防御 / 后退）+ **目标**（敌方某一兵种）
   *   · **默认动作决定初始站位**：前进 = 100（第一排）/ 防御 = 50（第二排）/ 后退 = 0（第三排）
   *   · 攻城时城墙在位置 100，所以"前排在城墙前"
   *   · 若指定目标在射程内 → 优先打指定目标；否则打射程内任意目标
   *   · 原版在「校场 → 出征 → 出征战术」设默认动作，防守方在「校场 → 防守战术」设
   * `row` 就是初始前出距离：位置 = 前出距离（我们的 adv 轴）。
   * ============================================================ */
  /* v60（老板拍板）：「防御照常开火，只要在射程内」——
     所以"防御"是"原地不动 + 受创减半"，**不是**"本回合不攻击"。
     这也是 T.HOLD_DAMAGE_CUT 那段两源冲突的最终裁决。 */
  DATA.STANCES = [
    { id: 'advance', name: '前进', row: 100, icon: '➡️', desc: '每回合向敌阵推进' },
    { id: 'hold', name: '防御', row: 50, icon: '🛡️', desc: '原地不动，受创减半；射程内照常开火' },
    { id: 'retreat', name: '后退', row: 0, icon: '⬅️', desc: '向己方后撤，拉开距离' },
  ];
  /* 战术的默认值 ——
     · 攻方：前进（不推进就打不到人，近战尤其）
     · **攻城时的守方：防御**（照搬原版攻城战的常态"城墙原地防御"：依城而战、
       把"接近"这件事完全交给攻方，配合箭塔才有"顶着箭雨走"的压迫感）
     · **野地/据点的守方：前进** —— 这一条是 v59 实测逼出来的：
       野地守军若也"防御"（原地不动），射程 50 的近战守军会被射程 1200 的弓兵
       在射程外**白打整个 30 回合**（实测：同兵种 3000 对 3000，守方全灭、攻方零损失）。
       原版的"原地防御"是**守城**行为（有城墙可依），不该推广到没有工事的野地。 */
  DATA.STANCE_DEFAULT = { atk: 'advance', def: 'advance', siege: 'hold' };
  /* 目标选择的特殊值：打城防工事（箭塔）—— 原版攻城战的核心动作
     （战报实录："[攻]弓箭兵前进454，攻击981145，[守]箭塔6666-272=6394"）。 */
  DATA.TARGET_WALL = '_tower';

  /* ============================================================
   * 城防工事：箭塔（v59 · 老板"城墙改用箭塔吧，照搬原版"）
   * ------------------------------------------------------------
   * **数据照搬** 4399 官方「城防介绍」页，逐项一致：
   *   箭塔 生命 2000 · 攻击 300 · 防御 360 · 射程 1250
   *   建造前提：城墙 3 级 + 抛射技巧 3 级
   * （原版城防共五种：陷阱/拒马/箭塔/滚木/擂石。只有箭塔是**持续火力**，
   *   其余四种是一次性消耗品或纯障碍；我们没有工事建造流程，
   *   写进来而无消费点就是死数据，所以只做箭塔。）
   *
   * ⚠️ `perDef` 是**我们特有的映射系数、不是原版数据**：原版由玩家自己建造工事，
   * 我们没有建造流程，于是把 `cityDefense()` 的城防值折成箭塔座数。
   * 标定依据：使城头火力与 v58 已实测平衡的量级相当（详见 docs/v59说明）。
   * ============================================================ */
  DATA.WALL_TOWER = {
    /* v89.96 标定：hp 保持原版 2000（不改塔本身），改 `tough` 1200 → 800 ——
       撤末端系数 + 属性覆盖降率（勇武 300 从 ×4 → ×1.15）后，拆塔速度约降至
       原来的 1/3.5；tough 800 把"投石 4000 + 中级将拆 100 座"标回 **26 回合**
       （实测扫参 tough∈{600,800,1000,1200} → 21/26/30/拆不完）。
       ⚠️ 塔的 atk 保持 300 不动（实测 atk×3 会让攻城方损失 50%、且 30 回合拆不完）。 */
    name: '箭塔', hp: 2000, atk: 300, def: 360, range: 1250,
    wallOffset: 100,   // 墙位移：城防件射程的固定部分（原版式里的 "+100"）
    perDef: 0.5,       // 每 2 点城防值 = 1 座箭塔（映射系数，非原版）
    /* 量纲换算：把"攻城方的伤害点数"换成"打掉几座箭塔"。原版伤害量纲比本作大
       两个数量级（原版单次杀伤百万级，本作几百），直接除以 2000 生命会一回合拆光全城。
       它只影响"拆箭塔要几回合"，**不影响箭塔火力本身** —— 实测标定值，非原版数据。
       标定过程：投石 4000 打城防 200（100 座）——tough=200 时一回合拆 58 座（2 回合拆完）；
       v89.96 改 800 后约 4 座/回合（配"中级将 + 投石 4000"≈26 回合清 100 座）。 */
    tough: 800,
    /* ============================================================
     * v62（老板）：「工匠作坊可以造箭塔，箭塔默认参与防守」
     * ------------------------------------------------------------
     * 箭塔从此有**两个来源**，但**只有一个出口** `GAME.towerCountOf(city)`：
     *   ① 城防折出（v59 照搬原版：每 2 点城防 = 1 座）—— 系统城与玩家城都有；
     *   ② **工匠作坊造出**（本组参数）—— 只有玩家自己的城有，NPC 城不产。
     * "默认参与防守" = 造好即计入本城守备力与城头火力，
     * **不需要任何指派/开关**（玩家点一下建造就完事，上阵由引擎自动算）。
     *
     * ⚠️ 为什么只让玩家城有：NPC 城的作坊是 v61 派生的"满配"，
     * 若自动给它们加 24 座箭塔，攻城难度会凭空跳一档（v59 已标定的平衡会漂）。
     * ============================================================ */
    buildMaxPerLv: 2,                    // 作坊每级可造 2 座（12 级 → 24 座）
    buildCost: { wood: 2000, stone: 3000, iron: 800 },   // 每座造价
    homeDef: 2,                          // 每座自建箭塔给本城守备力的贡献
  };

  /* ============================================================
   * 科技（23项 · 报告2.3b）
   * lv 解锁的书院等级；type 供计算；desc 效果
   * ============================================================ */
  DATA.TECH = [
    { id: 'zhongzhi', name: '种植技术', lv: 1, type: 'grain', per: 0.05, desc: '粮食产量 +5%/级' },
    { id: 'kanfa', name: '砍伐技术', lv: 1, type: 'wood', per: 0.05, desc: '木材产量 +5%/级' },
    { id: 'lianbing', name: '练兵技巧', lv: 1, type: 'train', per: 0.04, desc: '训练速度 +4%/级' },
    { id: 'wajue', name: '挖掘技术', lv: 2, type: 'stone', per: 0.05, desc: '石料产量 +5%/级' },
    { id: 'yelian', name: '冶炼技术', lv: 2, type: 'iron', per: 0.05, desc: '铁锭产量 +5%/级' },
    { id: 'zhandou', name: '战斗技巧', lv: 2, type: 'atk', per: 0.03, desc: '军队攻击 +3%/级' },
    { id: 'dazao', name: '打造技巧', lv: 3, type: 'forge', per: 0.03, desc: '打造材料消耗 −3%/级' },
    { id: 'zhencha', name: '侦察技巧', lv: 3, type: 'scout', per: 0.03, desc: '侦查情报分层解锁（等级越高看得越多），顺手拾获率 +3%/级' },
    { id: 'fanghu', name: '防护技巧', lv: 3, type: 'def', per: 0.03, desc: '我军受创 −3%/级（与装备护甲叠加）' },
    { id: 'fuzhong', name: '负重技巧', lv: 4, type: 'load', per: 0.05, desc: '掠夺与采集收获 +5%/级' },
    { id: 'xingjun', name: '行军技巧', lv: 4, type: 'march', per: 0.04, desc: '全军速度 +4%/级（影响先手判定）' },
    /* v58（老板「全按建议实现」）：**4%/级 → 5%/级**，对齐原版（满级 10 级 = ×1.5）。
       为什么值得改：v57 把"战场距离 = 最远射程 + 199"落地后，抛射不再只加射程，
       它同时**把开战间距推远**。改成 5% 后满抛射弓 = 1200×1.5+199 = **1999**，
       与原版公开实测值（满抛射弓 1999 / 床弩 2299 / 投石 2599）**逐项精确对上**。 */
    { id: 'paoshe', name: '抛射技巧', lv: 4, type: 'range', per: 0.05, desc: '远程射程 +5%/级（原版口径；射程同时抬高战场距离 → 先手）' },
    { id: 'jiayu', name: '驾驭技巧', lv: 5, type: 'ride', per: 0.04, desc: '骑兵速度 +4%/级（影响先手判定）' },
    { id: 'jianzhu', name: '建筑技术', lv: 5, type: 'build', per: 0.05, desc: '建造与升级耗时 −5%/级' },
    { id: 'chucun', name: '储存技术', lv: 6, type: 'store', per: 0.05, desc: '仓库存量 +5%/级' },
    { id: 'buji', name: '补给技巧', lv: 6, type: 'hp', per: 0.03, desc: '士兵生命 +3%/级（同战损下活下来的人更多）' },
    { id: 'tongshuai', name: '统帅能力', lv: 7, type: 'command', per: 0.01, desc: '将领统率覆盖 +1%/级（更多士卒吃满将领加成）' },
    { id: 'chengfang', name: '城防技术', lv: 8, type: 'citydef', per: 0.05, desc: '城墙建造与升级成本 −5%/级' },
    { id: 'weixiu', name: '维修技术', lv: 9, type: 'repair', per: 0.03, desc: '伤兵回收率 +3%/级' },
    { id: 'qianglue', name: '抢掠技巧', lv: 10, type: 'pillage', per: 0.03, desc: '掠夺资源收获 +3%/级' },
    { id: 'hecheng', name: '合成技巧', lv: 3, type: 'synth', per: 0.03, desc: '打造黄金消耗 −3%/级' },
    { id: 'chelun', name: '车轮技术', lv: 4, type: 'wheel', per: 0.05, desc: '器械速度 +5%/级（影响先手判定）' },
    { id: 'xunma', name: '驯马技巧', lv: 5, type: 'horse', per: 0.05, desc: '坐骑装备属性 +5%/级' },
    { id: 'yanjiu', name: '研究技巧', lv: 3, type: 'study', per: 0.05, desc: '科技研究速度 +5%/级' },
  ];
  /* 科技研究消耗（v16 改为原版口径：**以黄金为主**，另需少量木石）
     原版「科技需在书院使用黄金进行研究」；此前耗粮木石铁，未体现黄金的硬需求。 */
  DATA.techCost = function (tech, lv) {
    var mult = Math.pow(2, lv - 1);
    var kind = { grain: 1, wood: 1, stone: 1, iron: 1 }[tech.type] || 1;
    return {
      gold: Math.round(1200 * mult * kind),
      wood: Math.round(120 * mult),
      stone: Math.round(80 * mult),
    };
  };

  /* ============================================================
   * 装备（报告3.2/3.3/3.6/3.7）
   * slot: 部位；套装成套加成按件数
   * ============================================================ */
  DATA.EQUIP_SLOTS = ['head', 'neck', 'shoulder', 'chest', 'back', 'waist', 'arm', 'feet', 'ring', 'pendant', 'weapon', 'mount'];
  DATA.EQUIP_SLOT_NAMES = { head: '头盔', neck: '坠饰', shoulder: '肩铠', chest: '战铠', back: '披风', waist: '腰甲', arm: '臂甲', feet: '战靴', ring: '戒指', pendant: '佩饰', weapon: '武器', mount: '坐骑' };
  /* ⛔ v89.134 移除：`DATA.EQUIP_QUALITY`（旧 6 档色名）——
     装备品质名的唯一来源是 `DATA.Q_NAME`（4 档 凡/良/珍/神）；
     本表长期零引用（v89.134 盘点器抓出）。 */

  /* ============================================================
   * 装备
   * ------------------------------------------------------------
   * ⚠️ **`sta` 字段 = 源数据表（数值系统数据字典 3.6 / 3.7）里的「体力」列**。
   *   v66 之前它叫 `hp`，于是同一份数值在界面上有两个名字：
   *   「六维/状态的体力」（出征消耗池）与「装备汇总的体力」（其实是全军生命加成），
   *   老板一眼就看出对不上：「部分将领的体力没有加上装备的数值」。
   *   v66 把这一列**并入体力上限**（`GAME.staMax`），并把字段名改回 `sta` ——
   *   现在"装备体力"与"体力上限"是一条链，不再有两套说法。
   * ============================================================ */
  DATA.EQUIP = {
    /* 倚天套 11件 + 绝影（报告3.7 完整单件 · 每件体力 600） */
    yt_helm:  { id: 'yt_helm', name: '倚天战盔', set: 'yitian', slot: 'head', q: 4, tong: 65, nz: 39, yw: 46, zm: 52, sta: 600, spd: 1, atk: 0 },
    yt_neck:  { id: 'yt_neck', name: '倚天坠饰', set: 'yitian', slot: 'neck', q: 4, tong: 55, nz: 31, yw: 62, zm: 67, sta: 600, spd: 1 },
    yt_should:{ id: 'yt_should', name: '倚天肩铠', set: 'yitian', slot: 'shoulder', q: 4, tong: 55, nz: 31, yw: 62, zm: 67, sta: 600, spd: 1 },
    yt_chest: { id: 'yt_chest', name: '倚天战铠', set: 'yitian', slot: 'chest', q: 4, tong: 59, nz: 29, yw: 65, zm: 50, sta: 600, spd: 1 },
    yt_back:  { id: 'yt_back', name: '倚天披风', set: 'yitian', slot: 'back', q: 4, tong: 55, nz: 31, yw: 62, zm: 67, sta: 600, spd: 1 },
    yt_waist: { id: 'yt_waist', name: '倚天腰甲', set: 'yitian', slot: 'waist', q: 4, tong: 46, nz: 35, yw: 45, zm: 38, sta: 600, spd: 1 },
    yt_arm:   { id: 'yt_arm', name: '倚天臂甲', set: 'yitian', slot: 'arm', q: 4, tong: 52, nz: 39, yw: 50, zm: 42, sta: 600, spd: 1 },
    yt_feet:  { id: 'yt_feet', name: '倚天长靴', set: 'yitian', slot: 'feet', q: 4, tong: 38, nz: 36, yw: 66, zm: 28, sta: 600, spd: 5 },
    yt_ring:  { id: 'yt_ring', name: '倚天玺戒', set: 'yitian', slot: 'ring', q: 4, tong: 57, nz: 40, yw: 57, zm: 46, sta: 600, spd: 1 },
    yt_pend:  { id: 'yt_pend', name: '倚天佩饰', set: 'yitian', slot: 'pendant', q: 4, tong: 48, nz: 24, yw: 48, zm: 60, sta: 600, spd: 1 },
    yt_sword: { id: 'yt_sword', name: '倚天长剑', set: 'yitian', slot: 'weapon', q: 4, tong: 52, nz: 57, yw: 31, zm: 31, sta: 600, spd: 8, atk: 2888 },
    jueying:  { id: 'jueying', name: '绝影', set: 'yitian', slot: 'mount', q: 4, tong: 29, nz: 31, yw: 39, zm: 31, sta: 600, spd: 120 },
    /* ============================================================
     * 名将套 / 神武套（v38 · 需求 3）：由各 3 件补足到 **12 件（全槽位）**
     * ------------------------------------------------------------
     * 原状：两套各只有 头/武器/坐骑 3 件，而门槛写着 5/7/9/11/13/16 ——
     * 玩家永远只能拿到首档，后面的档位是纯摆设（神武套首档 4 件更是
     * 一档都拿不到）。补齐到 12 件后 3/5/7/11 四档全部可达。
     * 数值基准 = **同品质同槽位散件 ×1.12**，再加一条套装特色属性；
     * 旧 6 件也一并提到同一标准（原先远弱于散件，套装没有打造价值）。
     * ============================================================ */
    /* 名将套（q2 精良）：头/胸/肩/臂/腰/足/背/颈/戒/佩/武/骑 */
    ms_h1:  { id: 'ms_h1',  name: '名将盔',     set: 'mingjiang', slot: 'head',     q: 2, sta: 260, def: 270, yw: 12 },
    ms_c1:  { id: 'ms_c1',  name: '名将战铠',   set: 'mingjiang', slot: 'chest',    q: 2, sta: 260, def: 370 },
    ms_s1:  { id: 'ms_s1',  name: '名将肩铠',   set: 'mingjiang', slot: 'shoulder', q: 2, sta: 260, def: 270 },
    ms_ar1: { id: 'ms_ar1', name: '名将臂甲',   set: 'mingjiang', slot: 'arm',      q: 2, sta: 260, def: 246, yw: 8 },
    ms_wa1: { id: 'ms_wa1', name: '名将腰甲',   set: 'mingjiang', slot: 'waist',    q: 2, sta: 260, def: 246 },
    ms_f1:  { id: 'ms_f1',  name: '名将战靴',   set: 'mingjiang', slot: 'feet',     q: 2, sta: 260, spd: 26 },
    ms_b1:  { id: 'ms_b1',  name: '名将披风',   set: 'mingjiang', slot: 'back',     q: 2, sta: 260, zm: 26 },
    ms_n1:  { id: 'ms_n1',  name: '名将项坠',   set: 'mingjiang', slot: 'neck',     q: 2, sta: 260, tong: 26 },
    ms_r1:  { id: 'ms_r1',  name: '名将指环',   set: 'mingjiang', slot: 'ring',     q: 2, sta: 260, tong: 26 },
    ms_p1:  { id: 'ms_p1',  name: '名将玉佩',   set: 'mingjiang', slot: 'pendant',  q: 2, sta: 260, zm: 26 },
    ms_w1:  { id: 'ms_w1',  name: '雌雄双剑',   set: 'mingjiang', slot: 'weapon',   q: 2, sta: 260, atk: 296, yw: 10 },
    ms_m1:  { id: 'ms_m1',  name: '名将坐骑',   set: 'mingjiang', slot: 'mount',    q: 2, sta: 260, spd: 44 },
    /* 神武套（q3 稀有） */
    sw_h1:  { id: 'sw_h1',  name: '神武盔',     set: 'shenwu', slot: 'head',     q: 3, sta: 470, def: 572, yw: 15 },
    sw_c1:  { id: 'sw_c1',  name: '神武战铠',   set: 'shenwu', slot: 'chest',    q: 3, sta: 470, def: 784 },
    sw_s1:  { id: 'sw_s1',  name: '神武肩铠',   set: 'shenwu', slot: 'shoulder', q: 3, sta: 470, def: 572 },
    sw_ar1: { id: 'sw_ar1', name: '神武臂甲',   set: 'shenwu', slot: 'arm',      q: 3, sta: 470, def: 520 },
    sw_wa1: { id: 'sw_wa1', name: '神武腰甲',   set: 'shenwu', slot: 'waist',    q: 3, sta: 470, def: 520 },
    sw_f1:  { id: 'sw_f1',  name: '神武战靴',   set: 'shenwu', slot: 'feet',     q: 3, sta: 470, spd: 52 },
    sw_b1:  { id: 'sw_b1',  name: '神武披风',   set: 'shenwu', slot: 'back',     q: 3, sta: 470, zm: 44 },
    sw_n1:  { id: 'sw_n1',  name: '神武项坠',   set: 'shenwu', slot: 'neck',     q: 3, sta: 470, tong: 44 },
    sw_r1:  { id: 'sw_r1',  name: '神武指环',   set: 'shenwu', slot: 'ring',     q: 3, sta: 470, tong: 44 },
    sw_p1:  { id: 'sw_p1',  name: '神武玉佩',   set: 'shenwu', slot: 'pendant',  q: 3, sta: 470, zm: 44 },
    sw_w1:  { id: 'sw_w1',  name: '神武刀',     set: 'shenwu', slot: 'weapon',   q: 3, sta: 470, atk: 625, yw: 12 },
    sw_m1:  { id: 'sw_m1',  name: '神武马',     set: 'shenwu', slot: 'mount',    q: 3, sta: 470, spd: 92 },
    yt_free1: { id: 'yt_free1', name: '新手布衣', slot: 'chest', q: 1, def: 10, sta: 100 },
    yt_free2: { id: 'yt_free2', name: '新手木剑', slot: 'weapon', q: 1, atk: 15 },
    yt_free3: { id: 'yt_free3', name: '枣红马', slot: 'mount', q: 1, spd: 20 },
  };
  /* ============================================================
   * 套装加成（v38 · 需求 3 重定门槛）
   * ------------------------------------------------------------
   * 统一为 **3 / 5 / 7 / 11 件** 四档，**累计生效**（达到即叠上，不替换）。
   * 旧门槛有三个真问题（实测）：
   *   · 倚天套门槛 13/15/16 —— 槽位只有 12 个，**永远达不到**
   *   · 名将套/神武套各只有 3 件，5/7/9/11/13/16 全是死门槛
   *   · 神武套首档就是 4 件 > 3 件总量 → **整套加成一档都拿不到**
   * 门槛列在 DATA.SET_TIERS 里作为单一来源，测试会校验三套与它一致。
   * ============================================================ */
  DATA.SET_TIERS = [3, 5, 7, 11];
  DATA.SETS = {
    /* v52：三套补上**体力（sta）**加成 —— 老板：「体力都没加上套装的体力」。
       放在 3 件档：体力是"续航"属性（还驱动全军生命加成），早拿到早有感；
       数值按套装强度递增（名将 25 / 神武 40 / 倚天 60）。
       参考基准：体力上限 Lv1 = 100、Lv60 凡品 ≈162、Lv240 天授 ≈2108
       —— 所以 +60 对低级将很显著，对满级将约 +3%。
       ⚠️ `bonus`（文案）与 `eff`（真值）是两份，改一份必须改另一份；
       smoke 有一条断言按 eff 现算文案并与 bonus 比对（"改一处忘一处"会被拦下）。 */
    yitian: { name: '倚天套',
      bonus: { 3: '勇武+100　体力+60', 5: '防御+650', 7: '内政+100', 11: '统率+150　攻击+650　速度+7' },
      eff: { 3: { yw: 100, sta: 60 }, 5: { def: 650 }, 7: { nz: 100 }, 11: { tong: 150, atk: 650, spd: 7 } } },
    mingjiang: { name: '名将套',
      bonus: { 3: '防御+60　体力+25', 5: '攻击+50', 7: '内政+20　智谋+18', 11: '统率+40　勇武+30　速度+12' },
      eff: { 3: { def: 60, sta: 25 }, 5: { atk: 50 }, 7: { nz: 20, zm: 18 }, 11: { tong: 40, yw: 30, spd: 12 } } },
    shenwu: { name: '神武套',
      bonus: { 3: '防御+120　体力+40', 5: '攻击+150', 7: '勇武+40　智谋+30', 11: '统率+60　攻击+300　速度+4' },
      eff: { 3: { def: 120, sta: 40 }, 5: { atk: 150 }, 7: { yw: 40, zm: 30 }, 11: { tong: 60, atk: 300, spd: 4 } } },
  };

  /* ============================================================
   * 宝物（报告5.x 精选可操作项 + 数据字典键）
   * type: jewel/attr_buff/prod_buff/military/boost/exp/drug/mount
   * ------------------------------------------------------------
   * v89.104（老板）：「商场同类产品档次太多了，一个经验包，各种级别都有，
   * 没有代表性，建议最多分 4 档即可。体力恢复也是。统一审核确认」
   *   · 口径：**每个"同名族"在商城最多 4 档**（体力恢复 14 档 → 只留 4 档）；
   *   · 实现：条目上的 `noShop: true`（`ui.shopItems()` 是唯一过滤口）；
   *   · 分族与审核结果见 docs/v89104-界面整备.md，
   *     smoke 有一条"商城每族 ≤4 档"的门禁断言（防回潮）。
   *
   * v89.121（老板拍板「承认绝版」）—— 下架档位的**产出口径**：
   *   下架 = **停止产出**。商城不上架，掉落 / 任务 / 炼制**亦不给** ——
   *   『下架的档位不删除，掉落照给』是 v89.104 写下的旧说法，
   *   但全生命周期模拟（v89.121）实测**从未接线**（种子/徭役令除外，它们另有渠道）。
   *   现按老板拍板定稿：**绝版** —— 这些档位只对**老存档已持有**的玩家有意义
   *   （仍可正常使用与寄售），新玩家不再获得。
   *   ⛔ 若日后要让某档回归，**必须同时接上产出渠道**（否则就是"玩家拿不到的死物"）；
   *   smoke §102② 冻结了「渠道缺口基线（23 项）」，新增即红。
   * ============================================================ */
  DATA.ITEMS = [
    /* 珠宝（赏赐忠诚） */
    { id: 'zhenzhu', name: '珍珠', type: 'jewel', loyalty: 5, price: 2, desc: '赏赐忠诚 +5（爵位晋升亦需）' },
    { id: 'shanhu', name: '珊瑚', type: 'jewel', loyalty: 10, price: 4, desc: '赏赐忠诚 +10' },
    { id: 'liuli', name: '琉璃', type: 'jewel', loyalty: 15, price: 7, desc: '赏赐忠诚 +15' },
    { id: 'hupo', name: '琥珀', type: 'jewel', loyalty: 20, price: 10, desc: '赏赐忠诚 +20' },
    { id: 'manao', name: '玛瑙', type: 'jewel', loyalty: 25, price: 14, desc: '赏赐忠诚 +25' },
    { id: 'shuijing', name: '水晶', type: 'jewel', loyalty: 30, price: 19, desc: '赏赐忠诚 +30' },
    { id: 'feicui', name: '翡翠', type: 'jewel', loyalty: 40, price: 26, desc: '赏赐忠诚 +40' },
    { id: 'yushi', name: '玉石', type: 'jewel', loyalty: 50, price: 36, desc: '赏赐忠诚 +50' },
    { id: 'yemingzhu', name: '夜明珠', type: 'jewel', loyalty: 60, price: 48, desc: '赏赐忠诚 +60' },
    /* v86（老板「按计划进行」· 第四轮 G1）：锦囊 —— 施展计谋所需 */
    { id: 'jinang', name: '锦囊', type: 'talis', price: 15, desc: '施展计谋所需。妙计千条，藏于囊中。' },
    /* v88（灵气装备）：灵气精华 —— 蕴养修炼装备的专属材料（price 0 = 商城不售）。
       v89.51（老板「产生和消耗路径打通」）：**产出随江湖游历剥离而改道** ——
       改前唯一来源是野地「江湖游历」，游历下架后蕴养就成了"有消耗口、无产出"的死水；
       现在并入采集归来 / 出征缴获两条常驻渠道（GAME.grantEssenceDrop），
       游历复挂后它仍是产出之一。 */
    { id: 'lingsui', name: '灵气精华', type: 'essence', price: 0, desc: '天地游离灵气凝成之物。蕴养修炼装备所需，于野地采集与征战中获得。' },
    /* 符类（将领增益24h） */
    { id: 'hufu', name: '虎符', type: 'attr_buff', eff: { tong_mult: 0.5 }, dur: 24, price: 120, desc: '带兵人数+50%（24h）' },
    { id: 'wenquxing', name: '文曲星符', type: 'attr_buff', eff: { nz_mult: 0.25 }, dur: 24, price: 60, desc: '将领内政+25%（24h）' },
    { id: 'wuquxing', name: '武曲星符', type: 'attr_buff', eff: { yw_mult: 0.25 }, dur: 24, price: 60, desc: '将领勇武+25%（24h）' },
    { id: 'zhiduoxing', name: '智多星符', type: 'attr_buff', eff: { zm_mult: 0.25 }, dur: 24, price: 60, desc: '将领智谋+25%（24h）' },
    /* 生产类（+25%产量24h） */
    { id: 'shennongchu', name: '神农锄', type: 'prod_buff', res: 'grain', eff: 0.25, dur: 24, price: 5, desc: '粮食产量+25%（24h）' },
    { id: 'lubanfu', name: '鲁班斧', type: 'prod_buff', res: 'wood', eff: 0.25, dur: 24, price: 5, desc: '木材产量+25%（24h）' },
    { id: 'kaishanchui', name: '开山锤', type: 'prod_buff', res: 'stone', eff: 0.25, dur: 24, price: 5, desc: '石料产量+25%（24h）' },
    { id: 'xuantielu', name: '玄铁炉', type: 'prod_buff', res: 'iron', eff: 0.25, dur: 24, price: 5, desc: '铁锭产量+25%（24h）' },
    { id: 'shuilibian', name: '税吏鞭', type: 'prod_buff', res: 'gold', eff: 0.25, dur: 24, price: 10, desc: '黄金收入+25%（24h）' },
    /* v89.99（老板「增加道具如增民令」）：**民生类** —— 人口增速道具。
       与生产类同纪律：同类只取最强（不叠加）+ 到期真消费（popBoostMult 读 until）。 */
    { id: 'zengminling', name: '增民令', type: 'pop_boost', eff: 2.0, dur: 24, price: 30,
      desc: '人口增速 +200%（24h）—— 轻徭薄赋、劝课农桑，流民闻风来归' },
    /* v89.104（老板）：移民令 —— 一次性大额人口注入（存量，不是加速度）+ 高定价（120 金）。
       v89.125（老板）：「移民令改为**每次使用增加 25% 上限人口的人数**吧」——
       语义从"补到上限的 ratio"（≥ 即拒绝）改为 **每次 +上限×ratio（封顶上限，可多次叠加）**：
         · 旧：人口占上限 40% 时用 → 只补 10%（"补到"语义，越早用越亏）；
         · 新：任何时点用 → 都是 +25%（"增加"语义，与"移民来投"的字面一致）。
       消费点 = systems.useItem 的 pop_fill 分支（唯一）；价格 120 金不动（老板未要求）。
       ⚠️ 与增民令的分工：增民令 = 增速（可持续、便宜）；移民令 = 存量（一次性、贵）。 */
    { id: 'yiminling', name: '移民令', type: 'pop_fill', ratio: 0.25, price: 120,
      desc: '一次性：本城人口 +上限的 25%（可多次使用，封顶人口上限）' },
    { id: 'kaogongji', name: '考工记秘录', type: 'build_cost', eff: 0.3, dur: 24, price: 60, desc: '1~20级建筑建造成本-30%（24h）' },
    /* 军事类 */
    { id: 'xianzhenzhangu', name: '陷阵战鼓', type: 'military_buff', eff: { atk: 0.10 }, dur: 24, price: 8, desc: '军队攻击+10%（24h）' },
    { id: 'baguazhentu', name: '八卦阵图', type: 'military_buff', eff: { def: 0.10 }, dur: 24, price: 8, desc: '军队防御+10%（24h）' },
    { id: 'qingnangshu', name: '青囊书', type: 'military_buff', eff: { wound: 0.30 }, dur: 24, price: 80, desc: '战损30%转伤兵（24h）' },
    { id: 'junqi', name: '军旗', type: 'military_buff', eff: { cap: 0.25 }, dur: 24, price: 15, desc: '出征人数上限+25%（24h）' },
    /* 加速 */
    { id: 'mojia_canjuan', name: '墨家残卷', type: 'boost', target: 'research', amount: 15, price: 5, desc: '缩短1项研究15分钟' },
    { id: 'mojia_tuzhi', name: '墨家图纸', type: 'boost', target: 'research', amount: 180, price: 22, desc: '缩短1项研究3小时' },
    { id: 'mojia_baodian', name: '墨家宝典', type: 'boost', target: 'research', pct: 0.35, price: 120, desc: '缩短1项研究35%' },
    { id: 'luban_canye', name: '鲁班残页', type: 'boost', target: 'build', amount: 15, price: 5, desc: '缩短1项建造15分钟' },
    { id: 'luban_shuce', name: '鲁班书册', type: 'boost', target: 'build', amount: 480, price: 60, desc: '缩短1项建造8小时' },
    { id: 'luban_quanji', name: '鲁班全集', type: 'boost', target: 'build', pct: 0.30, price: 120, desc: '建造时间-30%' },
    { id: 'hanxin_sanpian', name: '韩信三篇', type: 'boost', target: 'train', pct: 0.30, price: 25, once: true, desc: '训练时间-30%（每队列限1）' },
    { id: 'hanxin_dianbing', name: '韩信点兵术', type: 'boost', target: 'train', pct: 0.50, price: 60, desc: '训练时间-50%' },
    { id: 'jixingjunling', name: '急行军令', type: 'boost', target: 'march', amount: 10, price: 15, desc: '行军时间缩短为10秒' },
    { id: 'muniuliuma', name: '木牛流马', type: 'boost', target: 'trade', pct: 0.9, price: 40, desc: '市场交易时间缩短90%' },
    /* 经验/丹药
       v89.43：经验曲线缩到 1/32（满级累计 100 万），道具面额同步 ÷30 ——
       保持"约 100 份治军之道到满级"这一原本的设计手感（旧：3180 万 ÷ 30 万 ≈ 106 份；
       新：100 万 ÷ 1 万 = 100 份）。面额不改的话，一本治军之道 = 全程 30%，直接破坏成长线。 */
    { id: 'lianbing_jingyan', name: '练兵经验', type: 'exp', amount: 100, price: 10, desc: '将领经验+100' },
    { id: 'bingfa_xinde', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '兵法心得', type: 'exp', amount: 1000, price: 60, desc: '将领经验+1000' },
    { id: 'zhijun_zhidao', name: '治军之道', type: 'exp', amount: 10000, price: 300, desc: '将领经验+10000' },
    { id: 'zhixuesan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '止血散', type: 'stamina', amount: 0.1, price: 5, desc: '恢复将领体力10%' },
    { id: 'jiuzhuangyao', name: '金疮药', type: 'stamina', amount: 0.3, price: 15, desc: '恢复将领体力30%' },
    { id: 'dahuandan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '大还丹', type: 'stamina', amount: 0.6, price: 30, desc: '恢复将领体力60%' },
    { id: 'jiuzhuanhuanhundan', name: '九转还魂丹', type: 'stamina', amount: 1.0, price: 80, desc: '恢复将领体力100%' },
    { id: 'fengwang_migao', name: '蜂王蜜膏', type: 'perm', attr: 'tong', amount: 1, price: 200, desc: '统率永久+1（每将上限50）' },
    { id: 'lingzhi_yulu', name: '灵芝玉露', type: 'perm', attr: 'nz', amount: 1, price: 200, desc: '内政永久+1（每将上限50）' },
    { id: 'shedan_shenwan', name: '蛇胆神丸', type: 'perm', attr: 'zm', amount: 1, price: 200, desc: '智谋永久+1（每将上限50）' },
    { id: 'hugu_lingdan', name: '虎骨灵丹', type: 'perm', attr: 'yw', amount: 1, price: 200, desc: '勇武永久+1（每将上限50）' },
    /* 灵草（v73 · 种田秘境产）：把将领资质**升一档**。灵草与档位一一对应
       （from → to），price 0 = 不进货架 —— 唯一来源是秘境灵田，
       高资质将领因此从"客栈直取"转向"养成"。 */
    { id: 'yunlingcao', name: '蕴灵草', type: 'rank_up', from: 'fan', to: 'liang', price: 0, desc: '将领资质：凡品 → 良材（种田秘境产）' },
    { id: 'xisuizhi', name: '洗髓芝', type: 'rank_up', from: 'liang', to: 'ying', price: 0, desc: '将领资质：良材 → 英杰（种田秘境产）' },
    { id: 'hualongshen', name: '化龙参', type: 'rank_up', from: 'ying', to: 'ming', price: 0, desc: '将领资质：英杰 → 名世（种田秘境产）' },
    { id: 'tianshouguo', name: '天授果', type: 'rank_up', from: 'ming', to: 'tian', price: 0, desc: '将领资质：名世 → 天授（种田秘境产）' },
    /* v78（老板需求 1）：**种子** —— 种田秘境专用。
       来源两条：① 将领活动（采集归来 / 出征缴获，见 DATA.SEED_DROP）；
       ② **商城购买**（v89.87 老板拍板"种子开售 + 快购全覆盖"，价格即本表 price）。
       v89.93（整改 U4）：desc 里的"来源"曾只写①，玩家不知道商城能买
       （实测推演侧也没走这条路）—— 现统一写全两个来源，与在售状态一致。 */
    { id: 'seed_fan',      name: '凡植种子', type: 'seed', price: 30,   desc: '寻常灵植之种：于种田秘境可种 6 种材料作物（来源：商城 / 采集归来 / 出征缴获）' },
    { id: 'seed_yunling',  name: '蕴灵种子', type: 'seed', price: 150,  desc: '蕴灵草之种：种成可助 凡品 将领洗出 良材 之资（来源：商城 / 采集归来 / 出征缴获）' },
    { id: 'seed_xisui', noShop: true, /* v89.104：商城下架（族内已有 4 档） */    name: '洗髓种子', type: 'seed', price: 450,  desc: '洗髓芝之种：种成可助 良材 将领跃入 英杰 之列（来源：商城 / 中高级野地 / 名城缴获）' },
    { id: 'seed_hualong',  name: '化龙种子', type: 'seed', price: 1200, desc: '化龙参之种：种成可助 英杰 将领跻身 名世（来源：商城 / 高级野地 / 名城缴获）' },
    { id: 'seed_tianshou', name: '天授种子', type: 'seed', price: 3600, desc: '天授果之种：种成可助 名世 将领问鼎 天授（来源：商城 / 顶级野地 / 州城·帝都缴获）' },
    /* 坐骑 */
    { id: 'mabian', name: '马鞭', type: 'mount_buff', amount: 2, price: 20, desc: '将领速度+2（1h，需蓝坐骑）' },
    { id: 'hanxue_mabian', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '汗血马鞭', type: 'mount_buff', amount: 5, price: 80, desc: '将领速度+5（1h，需紫坐骑）' },
    /* ============================================================
     * v77 新货（老板「丰富商场道具（符合时代背景和游戏背景），包括不限于……」）
     * ============================================================ */
    /* 宝箱：开启随机获得资源 / 黄金 / 珠宝 / 材料 / 图纸（见 S._openChest） */
    { id: 'chest_tong', name: '青铜宝箱', type: 'chest', tier: 1, price: 25, desc: '开启随机获得：资源 / 黄金 / 珠宝 / 一阶材料' },
    { id: 'chest_yin', name: '白银宝箱', type: 'chest', tier: 2, price: 70, desc: '开启随机获得：丰厚资源 / 黄金 / 二阶材料（小概率图纸）' },
    { id: 'chest_jin', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '鎏金宝箱', type: 'chest', tier: 3, price: 180, desc: '开启随机获得：高阶材料 / 图纸 / 珠宝（小概率徭役令）' },
    /* 内功秘籍：修习后随重数提供属性特性（每将一门，见 DATA.NEIGONG） */
    { id: 'book_sunzi', name: '《孙子兵法》', type: 'neigong', teach: 'sunzi', price: 80, desc: '修习内功「庙算」：智谋随重数增长（最高 10 重）' },
    { id: 'book_liutao', name: '《太公六韬》', type: 'neigong', teach: 'liutao', price: 80, desc: '修习内功「将略」：统率随重数增长（最高 10 重）' },
    { id: 'book_wuqin', name: '《五禽戏》', type: 'neigong', teach: 'wuqin', price: 80, desc: '修习内功「养生」：内政随重数增长（最高 10 重）' },
    { id: 'book_yuenv', name: '《越女剑经》', type: 'neigong', teach: 'yuenv', price: 80, desc: '修习内功「剑心」：勇武随重数增长（最高 10 重）' },
    /* 徭役令：征发徭役，短时扩充营造队列（与官府专精/名城 perk 叠加） */
    { id: 'corvee', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '徭役令', type: 'corvee', dur: 24, add: 3, price: 120, desc: '24 小时内同时建造队列 +3' },
  ];

  /* ============================================================
   * 爵位（报告7.1 · 22级）
   * ============================================================ */
  /* v79（老板「爵位加成，可看下能加成哪些数据」）：爵位的**第二层回报** ——
     第一层是俸禄（gold/h），这一层挂真实经营加成。22 级逐级递增，曲线在这里生成：
       产/税 +1%/级（封顶 +21%）· 仓储 +2%/级 · Lv8 起同时建造 +1（Lv16 起 +2）
       · 每 3 级 +1 附属野地上限 · 每 4 级 每城将领席位 +1
     消费统一走 GAME.cityBonusNum（与名城/主城/神器同池），不许各处自拼。
     ⚠️ 原表的 shiyi（食邑）/ recruit（招募）两个字段从无消费点（纯显示占位），v79 一并清掉。 */
  DATA.RANK = [
    { name: '平民', city: 1, rep: 0, gold: 0, jewel: {}, salary: 0 },
    { name: '公士', city: 2, rep: 1000, gold: 20000, jewel: { zhenzhu: 10, shanhu: 5 }, salary: 1000 },
    { name: '上造', city: 3, rep: 2000, gold: 40000, jewel: { shanhu: 10, liuli: 5 }, salary: 2000 },
    { name: '簪袅', city: 4, rep: 4000, gold: 60000, jewel: { liuli: 10, hupo: 5 }, salary: 5000 },
    { name: '不更', city: 5, rep: 8000, gold: 80000, jewel: { hupo: 10, manao: 5 }, salary: 10000 },
    { name: '大夫', city: 6, rep: 16000, gold: 100000, jewel: { manao: 10, shuijing: 5 }, salary: 20000 },
    { name: '官大夫', city: 7, rep: 32000, gold: 200000, jewel: { shuijing: 10, feicui: 5 }, salary: 20000 },
    { name: '公大夫', city: 8, rep: 64000, gold: 300000, jewel: { feicui: 10, yushi: 5 }, salary: 20000 },
    { name: '公乘', city: 9, rep: 128000, gold: 400000, jewel: { yushi: 10, yemingzhu: 5 }, salary: 20000 },
    { name: '五大夫', city: 10, rep: 256000, gold: 500000, jewel: { zhenzhu: 20, shanhu: 15, liuli: 10, hupo: 5 }, salary: 20000 },
    { name: '左庶长', city: 11, rep: 512000, gold: 600000, jewel: { shanhu: 20, liuli: 15, hupo: 10, manao: 5 }, salary: 30000 },
    { name: '右庶长', city: 12, rep: 1024000, gold: 800000, jewel: { liuli: 20, hupo: 15, manao: 10, shuijing: 5 }, salary: 30000 },
    { name: '左更', city: 13, rep: 2048000, gold: 1000000, jewel: { hupo: 20, manao: 15, shuijing: 10, feicui: 5 }, salary: 50000 },
    { name: '中更', city: 14, rep: 4096000, gold: 2000000, jewel: { manao: 20, shuijing: 15, feicui: 10, yushi: 5 }, salary: 50000 },
    { name: '右更', city: 15, rep: 8192000, gold: 3000000, jewel: { shuijing: 20, feicui: 15, yushi: 10, yemingzhu: 5 }, salary: 50000 },
    { name: '少上造', city: 16, rep: 16384000, gold: 4000000, jewel: { zhenzhu: 50, shanhu: 40, liuli: 30, hupo: 20, manao: 10 }, salary: 50000 },
    { name: '大上造', city: 17, rep: 32768000, gold: 5000000, jewel: { shanhu: 50, liuli: 40, hupo: 30, manao: 20, shuijing: 10 }, salary: 50000 },
    { name: '驷车庶长', city: 18, rep: 65536000, gold: 6000000, jewel: { liuli: 50, hupo: 40, manao: 30, shuijing: 20, feicui: 10 }, salary: 75000 },
    { name: '大庶长', city: 19, rep: 131072000, gold: 7500000, jewel: { hupo: 50, manao: 40, shuijing: 30, feicui: 20, yushi: 10 }, salary: 75000 },
    { name: '关内侯', city: 20, rep: 262144000, gold: 10000000, jewel: { manao: 50, shuijing: 40, feicui: 30, yushi: 20, yemingzhu: 10 }, salary: 100000 },
    { name: '位列诸侯', city: 21, rep: 524288000, gold: 20000000, jewel: { zhenzhu: 100, liuli: 80, manao: 60, feicui: 40, yemingzhu: 20 }, salary: 100000 },
    { name: '裂土封王', city: 22, rep: 1048576000, gold: 50000000, jewel: { shanhu: 100, hupo: 90, shuijing: 80, yushi: 70, yemingzhu: 50 }, salary: 200000 },
  ];
  /* v79：爵位加成曲线 —— 与 DATA.RANK 同序、由表生成（改曲线只改这一段）：
     产/税 +1%/级 · 储 +2%/级 · Lv8 起同时建造 +1（Lv16 起 +2）
     · 每 3 级 +1 附属野地上限 · 每 4 级 每城将领席位 +1。
     消费统一走 GAME.cityBonusNum（与名城/主城/神器同池）。 */
  DATA.RANK_BONUS = DATA.RANK.map(function (r, i) {
    return {
      prodPct: +(i * 0.01).toFixed(2),
      taxPct: +(i * 0.01).toFixed(2),
      storePct: +(i * 0.02).toFixed(2),
      buildSlot: i >= 16 ? 2 : (i >= 8 ? 1 : 0),
      wildCap: Math.floor(i / 3),
      genCap: Math.floor(i / 4),
      /* v89.102（老板「爵位每级解锁建筑等级上限 1 级」）：**主城专属** ——
         这里只出"爵位允许解锁多少级"，是否生效由 `GAME.rankBuildCapOf(city)`
         按主城判定（唯一出口；别处不要再拿这个键自己拼）。 */
      buildCap: i * DATA.MAIN_CITY_BUILD_PER_RANK,
    };
  });
  /* v89.102：**档数 ⇄ 上限解锁量的守卫**。
     `RANK_BUILD_LIFT_MAX` 必须早于等级表声明（表按 MAX_LEVEL_ABS 一次性外推），
     而 `DATA.RANK` 在文件后半段 —— 两处真值可能被改歪一处。
     改歪的后果很隐蔽：主城能盖到 45 级，可费用/产量表只到 24 → 取到 undefined。
     这里**核对并自动补常量**（只兜常量；表已在下方按旧值外推，仍在安全侧），
     同时留一条 smoke 断言把两边钉在一起。 */
  (function () {
    var need = (DATA.RANK.length - 1) * DATA.MAIN_CITY_BUILD_PER_RANK;
    if (need !== DATA.RANK_BUILD_LIFT_MAX) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[data] 爵位档数（' + DATA.RANK.length + '）与 RANK_BUILD_LIFT_MAX='
          + DATA.RANK_BUILD_LIFT_MAX + ' 不一致（应为 ' + need + '）—— 请同步 MAX_LEVEL_ABS 的推导');
      }
      if (need > DATA.RANK_BUILD_LIFT_MAX) DATA.RANK_BUILD_LIFT_MAX = need;
    }
  })();

  /* ============================================================
   * 地形（真实7种）+ 野地加成
   * 【v15 修正】原版是**每级线性**叠加，不是「满级值 − 缺口×衰减」：
   *   平原 / 草原  粮 +3%/级
   *   沼泽         粮 +5%/级
   *   湖泊         粮 +8%/级   ← 10 级 = +80%（此前误算为 +35%，野地价值被严重低估）
   *   森林         木 +5%/级
   *   荒漠         石 +5%/级
   *   山地         铁 +5%/级
   * 这正是高等级野地值得反复争夺的根本原因。
   * ============================================================ */
  DATA.TERRAIN = {
    plain:   { name: '平原', color: '#b8c08a', move: 1.0, buildable: true,  add: { grain: 0.03 }, desc: '可建新城。粮 +3%/级' },
    caoyuan: { name: '草原', color: '#a9c08a', move: 1.0, buildable: false, add: { grain: 0.03 }, desc: '粮 +3%/级' },
    zhaoze:  { name: '沼泽', color: '#8a9d6b', move: 1.4, buildable: false, add: { grain: 0.05 }, desc: '粮 +5%/级' },
    lake:    { name: '湖泊', color: '#5f86a3', move: 1.6, buildable: false, add: { grain: 0.08 }, desc: '粮 +8%/级（粮产最高）' },
    forest:  { name: '森林', color: '#4e7a3c', move: 1.4, buildable: false, add: { wood: 0.05 },  desc: '木 +5%/级' },
    desert:  { name: '荒漠', color: '#cbb277', move: 1.8, buildable: false, add: { stone: 0.05 }, desc: '石 +5%/级' },
    hill:    { name: '山地', color: '#9c8871', move: 1.6, buildable: false, add: { iron: 0.05 },  desc: '铁 +5%/级' },
    city:    { name: '城池', color: null, move: 1.0, buildable: false, add: null, step: 0 },
  };
  DATA.TERRAIN_WEIGHTS = [['plain', 0.18], ['caoyuan', 0.14], ['zhaoze', 0.12], ['lake', 0.10], ['forest', 0.18], ['desert', 0.12], ['hill', 0.16]];

  /* 野地加成统一按 `add[res] × 等级` 计算（见 GAME.wildAddOf）。
     ⛔ v89.134 移除：`DATA.WILD_ADD`（旧按等级查表）—— 空占位表已无
     任何引用（盘点器 v2 全仓核验），删除以免误导「还有人在读它」。 */

  /* ============================================================
   * 野地采集（v15 · 原版核心机制）
   * ------------------------------------------------------------
   * 占领野地后可派军「采集」，把**闲置兵力**转化为资源 —— 这是野地驻军的
   * 唯一价值所在，也是珠宝/宝物/野生名将的核心来源之一。
   * 原版实测规则：
   *   · 湖泊/沼泽 → 粮、森林 → 木、荒漠 → 石、山地 → 铁；**平地不能采集**
   *   · 收成 = 野地等级 × 驻军数量 × 采集时长
   *   · **不足 1 小时收获为零（并重置计时）**，**24 小时封顶**
   *   · **将领等级只影响宝物概率，不影响资源收成**
   *   · 放弃采集 / 军队被消灭 → 立即取消，没有任何收益
   * ============================================================ */
  DATA.GATHER = {
    /* v29（需求 0）：单兵不再是"人人一样"，改为按兵种取「采集效率」。
       收成不再看人头，而看**采集力** = Σ(兵种数量 × 兵种采集效率)：
         · 同样 5000 人，民夫产 10000 采力，铁骑产 45000 —— 精锐一个顶四个；
         · 反过来说，达到同一采力上限所需的人更少，好兵可以省下来打仗。
       basePerHour 保留为**民夫基准**，也用作旧数据（只有人数、没有兵种）的折算率。 */
    basePerHour: 2,          // 民夫每兵每游戏小时的基础收成（= 民夫 gather 值）
    levelBonus: 0.35,        // 野地每级 +35% 收成
    /* 上限取 30000：民夫 15000 人 / 长枪 7500 / 铁骑 3333 / 虎豹 3000 触顶。
       特意定在"民夫满 5000 人（= 10000 采力）够不着"的位置 —— 否则人人触顶，
       高级兵种的效率优势又被抹平了；也刻意让**5000 民夫的收成与旧版完全一致**，
       不打破老玩家对"一块野地大概能产多少"的直觉。 */
    powerCap: 30000,         // 单队**采集力**上限（超出不再增益，防后期数值爆炸）
    minHours: 1,             // 不足 1 游戏小时收获为零
    maxHours: 24,            // 24 游戏小时封顶
    maxActive: 3,            // 同时最多 3 支采集队
    stamina: 6,              // 开始采集消耗的将领体力
    treasureBase: 0.02,      // 宝物概率基数（×√小时）
    treasurePerGenLv: 0.001, // 将领每级 +0.1%
    treasureCap: 0.65,       // 单次宝物概率上限
    treasureMaxPrice: 40,    // 可采到的宝物价位上限（小件）
    /* 各地形可采资源（**平原/平地不可采集** —— 原版铁律） */
    resOf: { caoyuan: 'grain', zhaoze: 'grain', lake: 'grain', forest: 'wood', desert: 'stone', hill: 'iron' },
  };

  /* ============================================================
   * 地图（500×500 · 报告12.2/12.3 真实坐标）
   * ============================================================ */
  /* ============================================================
   * 野地驻军上限（v29 · 需求 0）
   * ------------------------------------------------------------
   * 可派驻数量 = 野地等级 × 10000。等级 10 的野地最多驻 10 万。
   * **只在派驻时校验**：野地等级日后衰减（每现实日 −1 级）不会把已驻扎的军队
   * 赶回城 —— 驻军的价值恰恰是"守住这块地不掉级"，若反过来因掉级而强制撤军，
   * 就会出现"越守越少"的荒诞结果。
   * ============================================================ */

  /* ============================================================
   * 定期来袭（第 2 期 · 防守玩法）
   * ------------------------------------------------------------
   * 动机：防线零件（城墙 / 箭塔 / 城防值 / 驻军 / 守将）全都建好了，
   * 但**没有任何东西会来打玩家** —— `cityDefense()` 的战斗消费点只有一处
   * 且被 `t.npc` 门控（只对 NPC 城生效）。玩家修城墙只改变一个显示数字。
   * 本表让那套零件真正转起来。
   *
   * 口径（改这里务必同步 MEMORY 与备忘「十一、单一出口全量清单」）：
   *   · 来袭规模 = **玩家全境战力 × ratio**（不是固定值）→ 自动随阶段缩放，
   *     且产生真实取舍：**兵收拢则守得住，兵分散则挨打**。
   *   · 守备力 = **本城兵力战力 ×（1 + 城防/defDivisor）** → 城墙/箭塔在这里被真正消费。
   *   · `loseCity:false` 是**体验红线**：输了掉资源/兵/城墙等级，不丢城。
   *   · 时间基准用 `world.elapsed`（游戏秒），不用现实日。
   * ============================================================ */
  /* v89.111（老板「自动攻城固定每日9点即可，提前4h提醒一次，无需频繁报告来袭预警」）：
     来袭从"每城各自 2~4 天的随机间隔"改成**每天固定一场**（目标城按日轮转）。
     v89.115（老板「为啥每分钟都被打一次」——附 23:34~23:37 连炸三城的日志）：
     **周期口径从"游戏日"改为"现实时间"**：
       病根 = 旧口径"每日 9 时（游戏时）"在 600× 时速下等于**每 2.4 现实分钟一场**，
       挂机一小时挨 25 场（日志里 23:34 打主城、23:36 打新城2、23:37 破门就是它）。
       老板在 v89.113 已定过原则：**特定游戏活动采用真实世界时间**（自动攻城同办）。
       现在：· 每 `realMin` 现实分钟一场，目标城按场轮转 —— 确定、可预判、人人有份；
             · 预警 = 提前 `warnMin` 现实分钟**只报一次**（口径写明"现实时间"）；
             · 离线补算上限 `catchUpMax` 场（其余"敌军见无隙可乘自行散去"，见 invasionTick）。
     退役口径：attackHour / warnHours（游戏时刻）；baseDays / minDays / tightenPerCity（更早的间隔）。 */
  DATA.INVASION = {
    enabled: true,
    unlockCities: 2,          // 玩家达到几座城才开始有人来打（别一开局就挨打）
    realMin: 30,              // ⏰ 每场间隔（**现实分钟**）—— 600× 下不再"每分钟被打"
    warnMin: 5,               // 预警提前量（现实分钟；到点前只报一次）
    catchUpMax: 3,            // 离线补算上限（场）：离开太久不该回来挨十几刀
    intelBeaconMax: 3,        // 烽火台**情报等级**上限（Lv1 +战力 / Lv2 +兵种明细）
    ratioMin: 0.28,           // 来袭战力 ÷ 玩家全境战力 —— 下界
    ratioMax: 0.45,           // 上界（<0.5 保证"兵收拢就守得住"是可达的）
    defDivisor: 480,          // 城防换算守备力乘区的除数：城防 240 → +50%
    loseCity: false,          // ⛔ 体验红线：输了不丢城
    loss: { resPct: 0.15, troopPct: 0.10, wallDrop: 1, repDrop: 5 },
    sources: ['流寇', '郡国游兵', '坞堡私兵'],
  };

  /* ============================================================
   * v89.115（老板）：「设计斗将战，为将领个人战，军队作战中概率触发（50%），
   *   斗将战在军队战前进行，斗将战胜利将获得临时 10% 将领属性加成，
   *   从而提高胜方全军战斗力」
   * ------------------------------------------------------------
   * 数值全在这张表；触发/对拼/加成的实现见 battle.rollDuel / duelBoostOf。
   *   · 触发概率 = chance（50%，老板给定；只掷一次，结果随战报走）；
   *   · 加成 = bonusPct（10%，老板给定）—— 加到**胜方将领的属性**上（临时），
   *     经 genAttrs 的加成链（atkPct/defPct/统率覆盖/速度）传导到**全军**；
   *   · 对拼合数 = rounds（每合比一次"勇武为主、统率智谋为辅"的战力）。
   * ============================================================ */
  DATA.DUEL = {
    enabled: true,
    chance: 0.50,        // 触发概率（军队战前的一次判定）
    bonusPct: 0.10,      // 胜者将领属性加成（临时；仅本战）
    rounds: 3,           // 对拼合数（逐合判定，先占先多者胜）
  };

  DATA.WILD_GARRISON = { perLevel: 10000 };

  /* 攻防对冲（v29 · 需求 11）—— 见 js/tactic.js 的 perAtk/perDef 使用处 */
  DATA.CLASH = { K: 2.0 };

  /* ============================================================
   * 自动出征（v29 · 需求 5）
   * ------------------------------------------------------------
   * 目的：让将领**自动扫周边地块赚经验**，不必每块地手点一遍。
   * 这里只放"可调参数"；安全边界（只派空闲将、体力不足不出发、
   * 器械不编入、只从当前城取兵）写在 domain.js 的实现里，
   * 不给玩家关掉的机会 —— 那些是防止自动系统把家底掏空的红线。
   * ============================================================ */
  DATA.AUTO_MARCH = {
    freqOptions: [1, 3, 5, 10, 20, 30],                 // 现实分钟
    troopOptions: [500, 2000, 5000, 10000, 20000, 50000],
    /* v89.83（老板「等级的选择直接给出等级列表」）：等级候选**按目标类型给真实等级**。
       改前是一张通用表 [12,16,20,24] —— 选「野地」时它一个目标都筛不出来，
       因为野地本身只有 0~10 级（选项与目标不同源 = 本项目最经典的失效模式）。
       ⚠️ 加新目标类型时**必须**在这里补一行，否则该类型的等级列表为空。 */
    levelOptionsByTarget: {
      wild: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      fort: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      city: [12, 16, 20, 24],                        /* 城等级 = 档位等级（县12/郡16/州20/都24） */
    },
    targetOptions: [['wild', '野地'], ['fort', '野外城池'], ['city', '名城']],
    /* v89.83（老板「目标的选择可以加上距离」）：搜索半径可调（切比雪夫距离，单位：格）。
       唯一出口 GAME.autoMarchRadius(cfg) —— 改前这个 14 是写死在弹窗与后端各一份的。 */
    radiusOptions: [6, 10, 14, 20, 30],
    defaultRadius: 14,
    defaultFreqMin: 5,
    /* v89.65（老板「自动出征精细化」）：**自动出征特有**的护栏字段 ——
       出征界面没有、只有"无人值守连打"才需要，故单列在此。
         dailyOptions  每日次数上限（0 = 不限）—— 防挂机把兵打光
       v89.83（老板「无需兵力留守这个菜单项」）：`keepOptions`（城内留守兵力）已**退役** ——
       它与「单次兵力」是同一件事的两种说法（单次派 5000 本身就意味着其余留守在城），
       多一个旋钮只会让人算两遍。 */
    dailyOptions: [0, 3, 5, 10, 20],
    /* v89.93（整改 E9）：**目标轮换（轮空池）** —— 最近打过的 N 个目标优先跳过。
       改前取"最近的一块"，实测 37 场里 27 场反复打同一坐标（挂机叙事退化成单点循环）。
       池子只做"优先跳过"：所有候选都被池子挡住时**放行**（绝不因轮换而停摆）。 */
    ringSize: 4,
    /* 编队优先级：先上精锐，器械与斥候/辎重一律不编入 */
    troopOrder: ['tieji', 'hubaoqi', 'xiliangtieqi', 'tuqibing', 'qingji',
      'nanjiangxiangbing', 'qingzhoubing', 'tengjiabing', 'daodun',
      'changqiang', 'gongjian', 'yibing', 'minfu'],
  };

  DATA.MAP_W = 500;
  DATA.MAP_H = 500;

  var ZHOU = [
    { name: '幽州', city: '蓟县', x: 365, y: 45, jun: [['高柳',305,35],['沮阳',335,35],['涿县',345,55],['渔阳',375,35],['土垠',395,55],['昌辽',445,35],['襄平',465,25],['高句骊',485,25],['阳乐',465,55],['朝鲜',485,75]] },
    { name: '徐州', city: '郯县', x: 425, y: 225, jun: [['开阳',435,215],['彭城',395,235],['下邳',415,245],['广陵',455,275]] },
    { name: '荆州', city: '汉寿', x: 255, y: 355, jun: [['宛县',255,275],['西陵',325,315],['江陵',255,335],['临沅',245,355],['临湘',295,375],['泉陵',235,395],['郴县',285,405]] },
    { name: '兖州', city: '昌邑', x: 365, y: 195, jun: [['陈留',335,205],['定陶',355,205],['濮阳',345,185],['任城',375,185],['无盐',375,175],['奉高',405,165],['卢县',385,155]] },
    { name: '并州', city: '晋阳', x: 265, y: 115, jun: [['阴馆',275,85],['善无',255,75],['云中',235,55],['九原',195,45],['临戎',155,55],['肤施',195,135],['离石',225,135],['长子',275,165]] },
    { name: '益州', city: '雒县', x: 105, y: 285, jun: [['阴平道',95,255],['成都',95,285],['南郑',135,265],['武阳',95,305],['汉嘉',65,305],['江州',135,325],['邛都',55,345],['朱提',65,365],['故且兰',155,375],['不韋',5,405],['滇池',65,405]] },
    { name: '冀州', city: '鄗县', x: 315, y: 115, jun: [['邺县',335,165],['邯郸',315,145],['甘陵',365,135],['廮陶',335,125],['信都',345,125],['元氏',315,125],['卢奴',315,95],['乐成',375,105],['南皮',385,105]] },
    { name: '交州', city: '广信', x: 265, y: 465, jun: [['胥浦',125,485],['龙编',145,465],['西卷',135,495],['合浦',225,485],['布山',245,475],['番禺',305,475]] },
    { name: '扬州', city: '寿春', x: 375, y: 295, jun: [['阴陵',405,295],['舒县',395,325],['宛陵',435,315],['吴县',455,325],['山阴',475,335],['南昌',365,375]] },
    { name: '青州', city: '临淄', x: 435, y: 145, jun: [['东平陵',395,145],['平原',385,135],['剧县',445,145],['临济',435,125],['黄县',465,115]] },
    { name: '豫州', city: '谯县', x: 355, y: 245, jun: [['平舆',325,275],['陈县',325,245],['阳翟',305,235],['相县',375,245],['雎阳',355,225],['鲁县',375,205]] },
    { name: '凉州', city: '陇县', x: 115, y: 205, jun: [['敦煌',5,15],['居延',45,35],['候宫',65,45],['禄福',15,65],['觻得',15,75],['姑臧',45,115],['允吾',45,175],['狄道',65,185],['冀县',95,195],['临泾',115,175],['富平',135,165],['下辨',105,215]] },
  ];
  /* ------------------------------------------------------------
   * 县城（系统城池第三档）：每州 5 座，共 65 座
   * 与郡城错开命名，避免重名
   * ------------------------------------------------------------ */
  DATA.COUNTY_NAMES = {
    司隶: ['京县', '密县', '新城', '宜阳', '陆浑'],
    兖州: ['东平', '山阳', '济阴', '巨野', '宁阳'],
    徐州: ['朐县', '东海', '琅琊', '利城', '淮阴'],
    青州: ['北海', '乐安', '甾川', '高密', '胶东'],
    冀州: ['巨鹿', '常山', '安平', '河间', '中山'],
    并州: ['上党', '太原', '西河', '雁门', '定襄'],
    幽州: ['上谷', '右北平', '辽西', '辽东', '代县'],
    益州: ['巴郡', '广汉', '犍为', '牂牁', '越嶲'],
    凉州: ['武威', '张掖', '酒泉', '汉阳', '金城'],
    交州: ['南海', '苍梧', '交趾', '九真', '日南'],
    扬州: ['庐江', '九江', '丹阳', '会稽', '豫章'],
    荆州: ['襄阳', '武陵', '长沙', '桂阳', '零陵'],
    豫州: ['汝南', '颍川', '梁国', '沛国', '谯郡'],
  };

  /* ------------------------------------------------------------
   * 野外城池（动态生成，不入存档）
   *   · 密度 1/12 —— 每 12×12 的范围内约 12 座（用户指定）
   *   · 位置由 hash(坐标, 地图种子) 确定，因此每局不同、但同局稳定
   *   · 等级 1~10 **逐日重掷**（v89.88：8/9/10 各 30% + 低档 10% 的构造性配额，
   *     见 `GAME.map._fortLevelTable`），守军随之不同
   *   · 掉落：一阶材料 + 资源 + 珠宝，偶有军械（资源按等级满配放大，见 genLoot）
   * ------------------------------------------------------------ */
  /* ============================================================
   * v89.94（B2 · E1 围攻战）：据点/县城的**守备值** —— 多波次投入、可撤退、按日结算
   * ------------------------------------------------------------
   * 病根（v8992 四跑实测）：军事只有"稳赢"与"必败"两档 ——
   *   野地 50~2,000（97% 胜率）；据点 Lv4+ 需 1~3 万兵、Lv8~10 需 6~22 万；
   *   名城 50 万起。而军力天花板 3.2 万 → **断层 1.5~15 倍**，中间没有台阶。
   * 修法：据点/县城的目标不再是"一战定生死"，而是**守备值 100% → 0%**：
   *   · 每战（不论胜负）按战力比破防 —— 保底 chipMin、封顶 chipMax，
   *     "再投一点就能赢"；
   *   · 守备越低，守军与城防**同步衰减**（defScale / defThr 保底）→ 后面几波更好打；
   *   · 每整日未攻 → 守备恢复 repairPerDay（催连续施压，不自作聪明地"攒一年再打"）；
   *   · 守备归零 + 胜 → 下城（据点拔除 / 县城易主）；
   *   · 战斗中可**主动撤退**（破防按 retreatChipMul 半计，残部带回）。
   *     ⚠️ 只有「占领」破防 —— 「掠夺」是取财，不动守备（两个心智模型不混）。
   * ⚠️ 难度总闸在这里：嫌难打就调 defScale 与 chipBase，不动别处。
   * ============================================================ */
  /* ============================================================
   * v89.95（B2 · 老板「将领每 5 级升高 1 点六维的速度」）：**速度的成长总闸**
   * ------------------------------------------------------------
   * 病根（实测）：速度曾是"每级 +1 + 自由点想投多少投多少"——
   *   240 级天授把自由点全砸速度 → spd ≈ 60+239+1920+装备 ≈ 2400，
   *   进战斗后单位速度 ×(1+spd/300) = **9 倍** → 轻骑 1000×9 = 9000/回合，
   *   一步贴脸、先手打光、溅射收场（老板点名的那条链）。
   * 现在两条闸：
   *   ① 自然成长 = **每 perLevels 级 +1**（默认 5 级 1 点，240 级共 +47）；
   *   ② 自由点投放上限 = base + floor(等级 / perLevels)（另有装备/坐骑一条独立来源）。
   * ⚠️ 装备与坐骑的速度不动（那是"收集"的回报）；这里管的是**无上限的成长**。
   * ============================================================ */
  DATA.SPD_CAP = { perLevels: 5, base: 10 };

  /* ============================================================
   * v89.99（老板：「开发增加人口增长的其他路径」·「设计兵种解散」）
   * **人口经济四件套**配置 —— 全部唯一来源，别处不许再写第二份。
   * ------------------------------------------------------------
   * v89.126（老板）：「人口增长模式太磨人了…我提议人口增长速度总是
   *   **每 2 小时即可补充人口至上限**，即按固定时间速率」（旧公式前期
   *   8 间民房 = 上限 800、保底 1/时 → 补满要 800 游戏小时，体感"根本没增加"）。
   *   基数从"上限 × 0.05%/游戏时 + 保底 1"改为 **fillHours（现实小时）补满**：
   *   增速 = 上限 ÷ fillHours —— **与上限大小无关、补满时长恒定**。
   *   口径 = **现实时间**（"跟上玩家游戏时长"；与资源产量的"游戏小时"
   *   是两个口径，界面文案必须写明"现实时间"）。三条杠杆（守将内政 /
   *   增民令 / 税制）保留 —— 补满时长因此可短于 fillHours。
   *   ⚠️ 旧字段 `base`（0.0005）与 `minPerHour`（保底 1）随新公式**退役**：
   *   新公式最小值 = 上限 ÷ fillHours（上限 ≥ 1 时恒 > 0），不需要保底。
   * · DISBAND —— 兵种解散：人口 100% 归农；**军资不退**（那是"仓储费"，
   *     退了就能"募→散"刷资源，闭环会漏）。人口可超上限（见 tickOnce：
   *     上限只是增长线，超了不增长也不回落）——这就是"人口银行"的前提。
   * · CAPTIVE —— 俘获迁民：打胜据点/名城，按敌军损失比例收编为人口
   *     （野地无民可俘；小仗不收编，避免"刷麻了"）。
   * ============================================================ */
  DATA.POP_CFG = {
    fillHours: 2,        /* 现实小时：无加成时，从 0 补满至上限的时长（固定时间速率） */
    govPerNz: 0.0005,    /* 守将内政 1 点 → 增速 +0.05% */
    govCap: 0.5,         /* 内政加成封顶 +50% */
    taxPivot: 0.5,       /* 税制杠杆支点：50% 税率 = 不增不减 */
    taxCoef: 0.6,        /* 税率每低 10% → 增速 +6%（轻徭薄赋则户口滋殖） */
    taxFloor: 0.6, taxCeil: 1.4,
  };
  /* ============================================================
   * v89.126（老板）：「要让人口对玩家形成部分制约，一个现实城市，
   *   不太可能全部人口一下全被征兵了。让除民房以外的建筑（城内，城墙，
   *   城外），分别固定占用部分人口额（劳作），则这部分人口是不能用于征兵的，
   *   建议在各级政府满配建筑下，占人口 10%-15%」
   * ------------------------------------------------------------
   * 模型 = **按"满配进度"折算**（唯一出口组在 domain.js）：
   *   劳作占用 = 人口上限 × fullPct × min(1, 已建级数 ÷ 满配级数)
   *   · 满配（非民房建筑全部盖到城池上限 + 城外地块建满）→ 恰好 fullPct；
   *   · 未满配 → 按级数比例小一点（"城市产业规模越大，占用越多"）；
   *   · 已建级数 = 城内非民房建筑（含城墙）等级和 + 城外地块等级和。
   * 为什么不用"每级固定人数"：人口上限随民房按 ×1.18^L 指数涨、建筑级数
   *   按线性涨 —— 固定人数在县城满配 ≈13%、到都城只剩 ≈6%、45 级时 <1%
   *   （测量见探针 probe_v89126_labor_calib.js），撑不住 10%-15% 的验收区间。
   *   折算模型让**任何规模的城池满配都是 fullPct**（12.5% = 区间中值）。
   * 口径：劳作占用只约束**征兵**（cannot 用于募兵）；不影响生产 / 税收 / 增长。
   * ============================================================ */
  DATA.POP_LABOR = {
    fullPct: 0.125,      /* 满配时劳作占用 = 人口上限的 12.5%（老板区间 10%-15% 中值） */
  };
  DATA.DISBAND = { popReturn: 1 };
  /* v89.113（老板「战斗胜利为什么没有俘虏」）：**全战斗**都能俘获 ——
     原先只认 fort/city 两种目标（打野地、守城全都没有），且 cap 500 太低
     （歼灭 10 万也只见"俘 500"，等于看不见）。
     现在：kinds 覆盖野地/据点/名城/防御战；rate 8%、cap 3000。
     去向不变：**溃卒收编为民**（人口），与增民令/税制同一套经济。 */
  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };
  /* v89.116：沙盘回放的帧间隔（毫秒）—— 原先 `DATA.SANDBOX.frameMs` 从没定义，
     界面里的 `|| 420` 才是真值（常量钉在界面 = 以后没人找得到）。
     现在权威值在本表；界面那处兜底只为防御（注释已标明）。 */
  DATA.SANDBOX = { frameMs: 420 };
  /* v89.116（老板「自动治疗下放一个触发记录」）：触发记录保留条数（超出丢最旧的）。
     界面在「自动化 · 治疗」页列出来，8 条约合"最近两三场仗"的量。 */
  DATA.AUTO_HEAL_LOG_MAX = 8;

  /* ============================================================
   * v89.96（老板批注「伤害计算不要乱定系数，计算过程应当简洁」）：
   * v89.95 的 `DATA.BATTLE.damageScale`（末端总闸）**已删除** ——
   * 平衡一律在源头修（本文件的兵种 hp / 相克表 / 箭塔耐久，
   * 加 domain.js 的属性覆盖系数）。标定探针：
   * .workbuddy/tools/probe/probe_v8996_dmgchain.js（扫参表与实测回合数都在里面）。
   * ============================================================ */


  DATA.SIEGE = {
    scope: ['fort', 'county'],      /* 试点范围：野外据点 + 县城（郡/州/都仍是决战） */
    repairPerDay: 8,                /* 每整日守备恢复（%）：围而不攻会前功尽弃 */
    /* 破防强度 —— **实测标定**（v89.94 探针扫参，别凭感觉改）：
       45（原口径）→ 一场围攻 2 波就下城，"五五开"波数只占 14%；
       16 → 4~7 波一场围攻，逐波扫过平衡点，带内波数 **21%**（验收线 20%），总波数 758。
       → 围攻变成"每波都要决定投多少"，而不是"两波速通"。 */
    chipBase: 16,                   /* 战力比 1:1 时单波破防 16% */
    chipMin: 10, chipMax: 45,       /* 单波破防上下限（保底有进展 / 强军 3 波可下） */
    defScale: 0.35,                 /* 守备 0% 时守军仍保留 35%（残兵据守） */
    defThr: 0.30,                   /* 守备 0% 时城防系数仍保留 30% */
    retreatChipMul: 0.5,            /* 主动撤退：本波破防按半计 */
    /* 战法系数（v89.94 · E2）：改平衡只动这四个数 */
    encircle: { marchMul: 1.5, garrisonCut: 0.12, chipMul: 1.5 },
    surprise: { schemeMul: 1.5 },
  };

  /* ============================================================
   * v89.94（B2 · E2）：出兵前的**战法三选**（强攻 / 围困 / 奇袭）
   * ------------------------------------------------------------
   * 口径：三者都只作用于**战斗入参**（与计略同一条路），零引擎改动。
   *   · 强攻：无修正（默认，正面决战）；
   *   · 围困：行军 ×1.5（围师必久），守军 −12%（断粮疲敌），破防 ×1.5；
   *   · 奇袭：须先选定一门计略，本战计略效果 ×1.5（依附既有计略出口）。
   * ⚠️ 数值总闸：围困/奇袭的系数都在此表，调平衡只改这里。
   * ============================================================ */
  DATA.OPS = [
    { id: 'assault', name: '强攻', icon: '⚔️', scope: null, require: null,
      desc: '正面决战，无额外修正。战力相当时胜负由临阵决断（阵位 / 目标 / 计略）决定。' },
    { id: 'encircle', name: '围困', icon: '🧱', scope: ['fort', 'city'], require: null,
      desc: '围师必久：行军 ×1.5，守军 −12%（断粮疲敌），破防 +50%。' },
    { id: 'surprise', name: '奇袭', icon: '🗡️', scope: null, require: 'scheme',
      desc: '出敌不意：须先选定一门计略，本战计略效果 ×1.5。' },
  ];

  /* ============================================================
   * v89.94（B2 · E3）：战报**分回合回放**的存储口径
   * ------------------------------------------------------------
   * 只存关键帧（首 2 + 尾 2 + 首杀/破塔/折半/最烈），避免 roundsLog
   * 全量入档把存档吹大。验收线：战报增量 < 2KB/场（probe 实测）。
   * ============================================================ */
  DATA.REPLAY = { maxFrames: 10, maxEv: 56 };

  DATA.FORT = {
    density: 1 / 12,
    /* v89.88（老板需求 3「普通城 8，9，10 级城分别占 30%」）：等级上限 8 → 10 ——
       补齐 9/10 两档（自动出征的等级候选早已是 1~10，此前这两档永远筛不出目标）。 */
    levelMin: 1, levelMax: 10,
    /* v89.88（老板需求 3）：等级分布 —— 8/9/10 各 `highPct`（合计 90%），
       1~7 级合计 `lowPct` 均分。**构造性配额**（全图按当日哈希排序切段，
       不是掷点 —— v89.72 的教训：掷点占比不成立）。 */
    levelDist: { high: [8, 9, 10], highPct: 0.30, lowPct: 0.10 },
    safeRadius: 3,          // 出生点与名城周围不生成
    nameA: ['青石', '黑风', '白狼', '铁门', '落雁', '断魂', '野狐', '黄沙', '苍岩',
      '卧牛', '伏虎', '盘龙', '孤鹰', '寒水', '乱石', '望云', '赤松', '枯木'],
    nameB: ['营', '寨', '坞', '堡', '关', '屯'],
    /* v89.88（老板需求 1/2「野外城池总归要比野地兵多」「兵力乘以 10 倍」）：
       50 → **500**（×10）。实测口径：每一级的守军都 ≥ 同级野地
       `DATA.WILD_DEFENSE` 的**上限**（Lv1 500 vs 76 · Lv5 7,228 vs 1,480 ·
       Lv8 53,596 vs 11,470 · Lv10 ≈ 203,900 vs 57,500）——
       "比野地还弱、不配称之为城"从根上消除（smoke 有逐级守卫）。 */
    garrisonBase: 500,
    garrisonGrowth: 1.95,
  };

  /* v89.79（老板）：「为何有个城等级是 Lv7，城等级不是跟随官府等级吗？」
     ------------------------------------------------------------
     **城等级 = 官府等级 = 建筑等级**，一号到底。名城的城等级由**档位**唯一决定：
       县城 12 · 郡城 16 · 州城 20 · 都城 24
       （= MAX_BLEVEL 12 + 档位加成 0/4/8/12 —— 与 GAME.buildCapOf 同一把尺子）
     于是 96 座郡城全是 Lv16、65 座县城全是 Lv12：同级城同规格。
     唯一出口 `GAME.cityLvOf`（名城取档位、自建城取**官府等级**、野外据点取自身等级）。

     ⛔ 退役口径（v89.72~v89.78）：等级 1~10 按权重分布（旧 NPC_LEVEL_W / npcLevelAssign）。
     它让"同级城"在守军与库藏上差 **7 倍以上** —— 因为守军 = 据点守军 × 档位倍数，
     而据点守军是 `50 × 1.95^(等级-1)` 的**指数**，等级差 1 级就是 1.95 倍。
     老板 v89.79：「为何同级城守军差这么多……谁规定了这么大守军数量范围吗」
     ⇒ 换档位基准（见 DATA.NPC_CITY_RES.garrisonByTier / resByTier）。 */
  DATA.NPC_TIER_LV = { capital: 24, zhou: 20, jun: 16, county: 12 };

  /* 生成 109 座名城（洛阳+12州城+96郡城） */
  DATA.NPC_CITIES = [];
  (function () {
    var id = 0;
    DATA.NPC_CITIES.push({ id: 'cap', name: '洛阳', x: 265, y: 215, type: 'capital', state: '司隶', level: DATA.NPC_TIER_LV.capital, def: 110, rep: 400 });
    ZHOU.forEach(function (z) {
      id++;
      DATA.NPC_CITIES.push({ id: 'zhou_' + id, name: z.city, x: z.x, y: z.y, type: 'zhou', state: z.name, level: DATA.NPC_TIER_LV.zhou, def: 90, rep: 300, special: true });
      z.jun.forEach(function (j) {
        id++;
        DATA.NPC_CITIES.push({ id: 'jun_' + id, name: j[0], x: j[1], y: j[2], type: 'jun', state: z.name,
          level: DATA.NPC_TIER_LV.jun, def: 60, rep: 120 });
      });
    });
    /* 司隶 5 郡（都城洛阳所在州，无州城） */
    [['弘农',225,225],['槐里',165,225],['高陵',185,205],['安邑',235,175],['怀县',295,195]].forEach(function (j) {
      id++;
      DATA.NPC_CITIES.push({ id: 'jun_' + id, name: j[0], x: j[1], y: j[2], type: 'jun', state: '司隶',
        level: DATA.NPC_TIER_LV.jun, def: 60, rep: 120 });
    });
    /* ---- 县城（每州 5 座，绕本州既有城池散开） ---- */
    var used = {};
    DATA.NPC_CITIES.forEach(function (c) { used[c.name] = true; });
    var occupied = {};
    DATA.NPC_CITIES.forEach(function (c) { occupied[c.x + ',' + c.y] = true; });
    ZHOU.concat([{ name: '司隶', city: '洛阳', x: 265, y: 215 }]).forEach(function (z) {
      var names = DATA.COUNTY_NAMES[z.name] || [];
      /* 本州已有城池坐标作为播种点 */
      var seeds = DATA.NPC_CITIES.filter(function (c) { return c.state === z.name; })
        .map(function (c) { return [c.x, c.y]; });
      if (!seeds.length) seeds = [[z.x, z.y]];
      names.forEach(function (nm, ci) {
        if (used[nm]) return;
        var sd = (z.x * 31 + z.y * 17 + ci * 137) % 99991;
        var rand = localRng(sd);
        for (var tryN = 0; tryN < 40; tryN++) {
          var base = seeds[Math.floor(rand() * seeds.length)];
          var px = Math.round(base[0] + (rand() * 2 - 1) * 14);
          var py = Math.round(base[1] + (rand() * 2 - 1) * 14);
          if (px < 4 || py < 4 || px > DATA.MAP_W - 5 || py > DATA.MAP_H - 5) continue;
          if (occupied[px + ',' + py]) continue;
          occupied[px + ',' + py] = true;
          used[nm] = true;
          id++;
          DATA.NPC_CITIES.push({ id: 'cty_' + id, name: nm, x: px, y: py,
            type: 'county', state: z.name,
            level: DATA.NPC_TIER_LV.county, def: 40, rep: 60 });
          break;
        }
      });
    });
  })();

  /* 玩家出生州（司隶附近，洛阳 265,215 周边）—— 旧口径的固定出生点，
     v70 起只作**兜底**（正常走 GAME.pickStartPos，按所选州落位）。 */
  DATA.START_POS = { x: 275, y: 225 };

  /* 出生州清单（v70 · 老板需求 5）—— 创建界面「城池归属」的选项：就是十三州。
     选哪个州，出生城就落在该州州治近旁（司隶以都城洛阳为锚），见 GAME.pickStartPos。 */
  DATA.START_STATES = ['司隶', '兖州', '豫州', '徐州', '青州', '冀州', '幽州',
    '并州', '凉州', '益州', '荆州', '扬州', '交州'];

  /* 城池档位显示名（君主面板城池列表用） */
  DATA.CITY_TIER = { self: '自建城', capital: '都城', zhou: '州城', jun: '郡城', county: '县城' };

  /* ============================================================
   * 将领（报告12.5 名将Top20 + 12.6 美人/女将）
   * ============================================================ */
  DATA.HEROES = [
    { name: '曹操', yw: 89, zm: 113, tong: 120, nz: 115, x: 315, y: 245, city: '许昌' },
    { name: '周瑜', yw: 87, zm: 117, tong: 119, nz: 104, x: 305, y: 325, city: '赤壁' },
    { name: '司马懿', yw: 78, zm: 117, tong: 118, nz: 113, x: 325, y: 95, city: '广年' },
    { name: '陆逊', yw: 85, zm: 116, tong: 117, nz: 105, x: 215, y: 325, city: '辰阳' },
    { name: '邓艾', yw: 105, zm: 109, tong: 115, nz: 94, x: 95, y: 255, city: '阴平道' },
    { name: '吕蒙', yw: 99, zm: 109, tong: 112, nz: 95, x: 85, y: 115, city: '兴隆' },
    { name: '姜维', yw: 108, zm: 110, tong: 111, nz: 82, x: 115, y: 275, city: '剑阁' },
    { name: '孙坚', yw: 110, zm: 90, tong: 114, nz: 89, x: 375, y: 205, city: '鲁县' },
    { name: '赵云', yw: 117, zm: 92, tong: 112, nz: 79, x: 315, y: 125, city: '元氏' },
    { name: '关羽', yw: 118, zm: 91, tong: 116, nz: 75, x: 285, y: 325, city: '华容' },
    { name: '陆抗', yw: 78, zm: 106, tong: 112, nz: 103, x: 235, y: 195, city: '垣县' },
    { name: '羊祜', yw: 79, zm: 103, tong: 111, nz: 105, x: 445, y: 25, city: '涿鹿' },
    { name: '诸葛亮', yw: 47, zm: 120, tong: 113, nz: 117, x: 255, y: 285, city: '隆中' },
    { name: '孙策', yw: 113, zm: 84, tong: 113, nz: 85, x: 435, y: 315, city: '宛陵' },
    { name: '徐庶', yw: 79, zm: 114, tong: 104, nz: 97, x: 255, y: 295, city: '新野' },
    { name: '张辽', yw: 112, zm: 95, tong: 115, nz: 71, x: 275, y: 85, city: '阴馆' },
    { name: '鲁肃', yw: 68, zm: 112, tong: 99, nz: 109, x: 365, y: 355, city: '大田' },
    { name: '贾诩', yw: 59, zm: 118, tong: 106, nz: 103, x: 195, y: 205, city: '临晋' },
    { name: '吕布', yw: 161, zm: 10, tong: 7, nz: 3, x: 275, y: 215, city: '洛阳' },
    { name: '张飞', yw: 155, zm: 30, tong: 60, nz: 20, x: 275, y: 215, city: '洛阳' },
    { name: '马超', yw: 148, zm: 40, tong: 90, nz: 35, x: 115, y: 205, city: '陇县' },
    { name: '黄忠', yw: 140, zm: 55, tong: 80, nz: 40, x: 255, y: 355, city: '汉寿' },
    { name: '典韦', yw: 150, zm: 25, tong: 55, nz: 15, x: 335, y: 205, city: '陈留' },
    { name: '许褚', yw: 145, zm: 30, tong: 50, nz: 18, x: 335, y: 205, city: '陈留' },
    { name: '孙权', yw: 82, zm: 97, tong: 94, nz: 108, x: 375, y: 295, city: '寿春' },
    { name: '刘备', yw: 92, zm: 100, tong: 100, nz: 95, x: 255, y: 335, city: '江陵' },
    { name: '袁绍', yw: 88, zm: 95, tong: 105, nz: 90, x: 315, y: 115, city: '鄗县' },
    { name: '董卓', yw: 105, zm: 85, tong: 90, nz: 60, x: 265, y: 215, city: '洛阳' },
  ];
  /* 美人（12.6） */
  DATA.BEAUTIES = [
    { name: '貂蝉', tong: 89, nz: 98, yw: 102, zm: 120, x: 195, y: 235 },
    { name: '林黛玉', tong: 87, nz: 96, yw: 26, zm: 126, x: 0, y: 0 },
    { name: '小乔', tong: 75, nz: 83, yw: 72, zm: 89, x: 455, y: 295 },
    { name: '大乔', tong: 80, nz: 75, yw: 68, zm: 87, x: 365, y: 315 },
    { name: '甄氏', tong: 63, nz: 80, yw: 67, zm: 96, x: 335, y: 165 },
    { name: '苏小小', tong: 67, nz: 82, yw: 42, zm: 94, x: 0, y: 0 },
    { name: '木婉清', tong: 75, nz: 85, yw: 92, zm: 78, x: 0, y: 0 },
    { name: '聂小倩', tong: 54, nz: 86, yw: 92, zm: 78, x: 0, y: 0 },
    { name: '甘夫人', tong: 56, nz: 60, yw: 40, zm: 80, x: 135, y: 315 },
    { name: '邹氏', tong: 62, nz: 51, yw: 42, zm: 44, x: 345, y: 185 },
    { name: '樊氏', tong: 45, nz: 64, yw: 22, zm: 67, x: 265, y: 355 },
  ];
  /* ⛔ v89.134 移除：`DATA.GENERAL_NAMES`（旧随机名池）——
     名将走 `DATA.HEROES`；野地守将名字走 `WILD_LORD_SURNAME / WILD_LORD_GIVEN /
     WILD_LORD_TITLE` 三表（domain.js 生成守将时读）。本表长期零引用。 */
  DATA.INITIAL_GENERAL = '赵子龙';

  /* ============================================================
   * 君主将领（v70 · 老板：「增加一个角色将领（即玩家角色本身）」）
   * ------------------------------------------------------------
   * 资质选**名世**（当世罕有，可镇一方）：比招募池里的良材高一档、不到天授 ——
   * 君主强在"能镇场"，不强在碾压名将（名将仍要去招贤馆招）。
   * 六维取资质区间的中值（不掷骰，见 `GAME.makeLordGeneral`）。
   * ── 后续「普通将领不具备的功能」往 `LORD_TRAITS` 加行即可：
   *    将领档案里会渲染成「君主特权」；普通将领返回空数组、整块不显示。
   * ============================================================ */
  /* v89.65（老板）：「君主默认资质为天授，但每 60 级需要完成一个任务才能继续升级」
     ------------------------------------------------------------
     开局即**天授**（六维取该档中值，不掷骰）。但 240 不再是平滑天花板 ——
     等级上限被切成 **60 级一段共 4 段**：到段顶（Lv60/120/180）必须
     **练功攒修为 → 突破** 才能续升；Lv240 是段顶也是天授上限。
     闸门只落在 GAME.genLevelCap（等级上限唯一出口）：
     升级判定、经验道具闸门、详情页、君主面板**全部自动认这套分段**，
     不需要在任何调用点再判一次（"两个出口"是本项目最经典的失效模式）。
     v82 那套「凡品开局 + 灵草逐档升」对**君主**退役；灵草仍可用于其余将领，
     GAME.rankUpUse 一字未动。 */
  DATA.LORD_GEN = { rankId: 'tian', styleId: 'balance', level: 1 };

  /* ============================================================
   * 君主「练功 → 突破」（v89.65 · 老板：「君主练功然后突破，这很合理」）
   * ------------------------------------------------------------
   * 两个动作，各一个唯一出口：
   *   练功 GAME.doLordTrain —— 花**体力**（+ 少量粮），产**修为**（常产）与
   *        **经验**（只在没到段顶时给）。体力靠时间恢复，故练功天然限速，
   *        不必另设冷却字段。
   *   突破 GAME.doLordBreak —— 段顶且修为够 → 跨段：等级上限 +60、境界进一阶、
   *        发自由属性点（走既有 freePts 加点体系，不另造一套成长口径）。
   * 修为与突破次数存在**君主将领身上**（g.cultiv / g.breaks）：
   * 老档读不到即视为 0（`g.breaks || 0`），所以**不需要迁移脚本**。
   * ============================================================ */
  DATA.LORD_BREAK = {
    step: 60,                     // 每段 60 级（老板口径）
    trainSta: 6,                  // 每次练功消耗体力
    trainGrainPct: 0.004,         // 练功耗粮 = 本级所需经验 × 0.4%（随等级水涨船高）
    cultivBase: 8,                // 修为 = base + 等级 × perLv
    cultivPerLv: 0.4,
    expPct: 0.10,                 // 练功给经验 = 本级所需 × 10%（未到段顶才给）
    /* 第 n 次突破所需修为（下标 = 已突破次数）—— 每段递增，越上层越难 */
    needs: [0, 320, 1100, 3600],
    /* 突破奖励：自由属性点（下标 = 突破后的次数） */
    freePts: [0, 40, 100, 240],
    /* 境界名（下标 = 已突破次数）：段顶前都叫「初窥」 */
    realms: ['初窥', '小成', '大成', '圆满'],
  };
  /* v89.80（老板）：「去除君主的备注：👑 君主特权：👑 帐下不离 君主本人 ——
     不可解雇，也不会因忠诚低下离去」—— 将领档案里的**特权展示块**撤空。
     ⚠️ 只是撤展示，**机制仍在**：君主不可解雇由域层的离职判定保证
        （将领档案连"解雇"按钮都不给君主，见 ui 的 dismiss 分支），
        "不会离职"则由君主将领的 loyalty 恒 100 承担 —— 与这张表无关。
     保留本表（空数组）而不是删掉变量：它是"君主专属特权"的**扩张位**，
     将来加特权（如独有计略）只往这里加一行，界面自动渲染（length ? ... : ''）。 */
  DATA.LORD_TRAITS = [];

  /* ============================================================
   * 校场 · 练兵（v89.80 · 老板「发掘校场的更多功能选项，历史和游戏中，校场还有哪些功能？」）
   * ------------------------------------------------------------
   * 校场原本只有「出征队列 / 每队兵力上限 / 伤兵营」，是个纯限额面板；
   * 而历史上校场的第一职能恰恰是**练兵演武**（将士在此操演武艺、以战代练）。
   * 于是补两项可操作功能 —— 都接既有出口，不新造数值口径：
   *   · 演武：选一位将领，耗金 + 体力 → 该将得经验（走 GAME.battle.gainExp 唯一入口）
   *   · 阅兵：耗金 + 粮 → 民心 +（走 s.hearts）
   * ⚠️ 与「君主练功」的分工：练功是君主专属（产修为、能突破、有段顶闸门）；
   *    演武面向**任何将领**，只给经验、每将每日一次 —— 日常练手，不是闭关修炼。
   *    故演武**不给修为、不给自由点**：那两样是君主修行体系的专属产物，
   *    混进来会让突破体系失焦（"练功"与"演武"会变成同一件事）。
   * ⚠️ 两项都有**每日次数**（s.xcDay，按现实日归零，与客栈招募/门派任务同一套
   *    GAME.questDayIndex 口径）—— 否则校场就成了无限刷经验的后门，
   *    直接绕开商城经验道具与出征收益，把养成曲线打穿。
   * ⚠️ 演武收益只与**该将本级所需经验**挂钩（百分比），所以高等级将领
   *    拿到的绝对量更大但占比恒定 —— 不需要为等级另写一张表。
   * ============================================================ */
  DATA.XIAOCHANG = {
    sparSta: 5,             // 演武消耗体力
    sparGoldBase: 600,      // 演武耗金 = base + 校场等级 × perLv
    sparGoldPerLv: 220,
    sparExpPct: 0.08,       // 演武所得经验 = 该将本级所需 × 8%
    reviewGold: 2000,       // 阅兵耗金
    reviewGrain: 2000,      // 阅兵耗粮
    reviewHearts: 4,        // 阅兵民心 +（上限 100）
  };

  /* 初始将领属性 */
  /* v26（需求 2）：speed 由 0 改为 10 —— 它现在是**五维之一**，恒为 0 就不是一维。
     史实名将在 makeHero 里给 20（出身更好），其余靠等级成长与坐骑/套装拉开。 */
  DATA.GEN_BASE = { tong: 45, nz: 45, yw: 45, zm: 45, attack: 10, defense: 10, speed: 10, hp: 100, stamina: 100, energy: 100, loyalty: 70, salary: 20 };

  /* ============================================================
   * 将领月俸（v77 · 老板「为将领设计俸禄体系……经过 7 个游戏日结算 1 次」）
   * ------------------------------------------------------------
   * 口径：**每 7 游戏日**结算一期，从各将所在城的府库扣除。
   *   月俸 =（base + 等级×perLevel + 四维和×perAttr）× 资质系数
   * 设计意图（老板原话）：「不要搞崩经济，但是将领越多，经济负担越重」——
   *   · 线性于将领数量：一两名将不痛，上规模的将领团才是真负担；
   *   · 等级与四维定价：练得越强，俸禄越贵（养成有维持成本）；
   *   · 资质系数：高资质将领身价高，但资质是稀缺品，负担可控。
   * 参考量级（默认 120× 时间倍率，1 游戏日 = 12 现实分钟）：
   *   良材 Lv1 约 490 金/期（≈3 金/游戏时）；名世 Lv30 约 2.1 万/期。
   * 前端展示与结算同源：GAME.genSalaryOf（唯一出口）。
   * ⚠️ 调平衡只动这张表；结算入口唯一（GAME.settleGenSalary）。
   * ============================================================ */
  DATA.GEN_SALARY = {
    periodDays: 7,       // 结算周期：7 游戏日
    base: 120,           // 每将每期底俸
    perLevel: 150,       // 每级 +150
    perAttr: 1.2,        // 四维（统率+内政+勇武+智谋）每点 +1.2
    rankMul: { fan: 1, liang: 1.6, ying: 2.6, ming: 4.2, tian: 7 },
    maxPeriods: 30,      // 离线补结上限（期）：防止长挂后一把扣穿
  };

  /* ============================================================
   * 将领资质（v11）
   * 资质决定三件事：① 初始属性区间 ② 每级成长点 ③ 招募价倍率
   * 高资质出现概率极低，但数值与成长都更夸张 —— 拉开档次差异
   * w  : 客栈 1 级时的出现权重
   * wg : 客栈每升 1 级，该资质权重的相对增幅（负值=越高级越少见）
   * base: 单项属性初始区间 [下限, 上限]
   * grow: 每升 1 级，四维各增加的点数
   * ============================================================ */
  DATA.GEN_RANKS = [
    /* v29（需求 2）：资质还决定**等级上限** —— 低资质喂再多经验也上不去。
       五档等差 +40（凡品 60 → 天授 240），让"资质"从"成长快一点"变成
       "天花板相差 4 倍"的真门槛。 */
    { id: 'fan', name: '凡品', color: '#9c9c8c', star: 1, w: 50, wg: -0.06, base: [30, 44], grow: 1, price: 1.0, lvCap: 60,
      desc: '寻常之才，可为县吏。等级上限 60。' },
    /* v78（老板需求 2 · 隐藏设定）：`ascend` = 灵草升档时四维**各加**的点数
       （「低资质将领通过灵草提升资质时，能比直接招募获得额外提升」）——
       取新档的成长值：良材 2 / 英杰 3 / 名世 5 / 天授 8，全链 +18/维。
       机制刻意隐藏：界面不提示，只在属性里体现；数值集中在此，调平衡只改这里。 */
    { id: 'liang', name: '良材', color: '#5fbf6a', star: 2, w: 27, wg: 0.00, base: [46, 62], grow: 2, price: 1.8, lvCap: 100, ascend: 2,
      desc: '可当一郡之任。等级上限 100。' },
    /* v66（老板）：「客栈天授级将领出现概率降低 10 倍，其他高资质降低 8、6 啥的」
       v73（老板）：「限制高资质将领的直接获取，概率再降 10 倍」——
       高资质的 `w` 在 v66 基础上**再 ÷10**（低资质凡品 / 良材两轮都没动）：
         天授 2 → 0.2 → 0.02（累计 ÷100）· 名世 6 → 0.75 → 0.075（累计 ÷80）
         · 英杰 15 → 2.5 → 0.25（累计 ÷60）
       客栈 1 级时的占比（v89.62 对名世/天授再 ÷5 之后的现值）：
         天授 0.005% / 名世 0.019% / 英杰 0.32% / 良材 34.9% / 凡品 64.7%
       与「名将直取 0.30 → 0.03」（domain.js makeCandidate）是一套组合拳：
       高资质将领从此以**种田秘境灵草养成**为主路（见 DATA.FARM）。
       ⚠️ 光改 `w` 是**无效的** —— `GAME.rankWeights` 里原有一道 `Math.max(0.5, …)`
       下限，会把 0.2 直接抬回 0.5（降幅只剩 2.5 倍）。v66 把下限改成**按自身基准的 5%**
       （见 state.js），既拦住负权重、又不吃掉这两轮下调。 */
    { id: 'ying', name: '英杰', color: '#4a9be0', star: 3, w: 0.25, wg: 0.09, base: [64, 84], grow: 3, price: 3.2, lvCap: 140, ascend: 3,
      desc: '一方之良将，千军易得一将难求。等级上限 140。' },
    /* v89.62（老板）：「名世、天授的客栈刷新频率还是太高了，再降低 5 倍概率」
       —— 只在 v66/v73 的基础上**再 ÷5**（英杰与低资质不动）：
          名世 0.075 → 0.015（累计 ÷400）· 天授 0.02 → 0.004（累计 ÷500）
       英杰保持 0.25（老板本轮只点名名世/天授）。
       ⚠️ 依旧只改 `w` 即可：GAME.rankWeights 的下限是"按自身基准的 5%"
       （r.w × 0.05），随 w 同步缩小，不会再出现"改了下限吃掉降幅"的静默失效。 */
    { id: 'ming', name: '名世', color: '#b06fd8', star: 4, w: 0.015, wg: 0.17, base: [86, 106], grow: 5, price: 7.0, lvCap: 180, ascend: 5,
      desc: '当世罕有，可镇一方。等级上限 180。' },
    { id: 'tian', name: '天授', color: '#e0a83c', star: 5, w: 0.004, wg: 0.28, base: [108, 140], grow: 8, price: 16.0, lvCap: 240, ascend: 8,
      desc: '天授之资，百年一出。等级上限 240。' },
  ];

  /* ============================================================
   * 经验曲线（v89.82 · 老板澄清锚点：「**239 升 240 需要 100 万经验**，
   *   而不是 1 级升到 240 需要 100 万」）
   * ------------------------------------------------------------
   * ⛔ 退役口径（v89.43~v89.81）：把「100 万」当成 **1→240 的累计**，
   *    于是整条曲线被压到 1/32 —— 240 级单级只要 8982 经验，
   *    与"天授之资、百年一出"的定位完全不符（一场攻城就能顶掉好几级）。
   * ✅ 现在：把 100 万放在**曲线的锚点**上（need(240) = 1,000,000），
   *    形状沿用老板选的「前期二次起步」，但中后期从**线性改指数**：
   *      ⚠️ 线性 + 锚点在 240 会**断层** —— 210 级要涨到 100 万，平均每级 4760，
   *         于是 Lv31 会从 490 突跳到 5250（10 倍台阶）。指数则天然平滑衔接。
   *    ① Lv1~30（二次起步）：need = base + quad×Lv²        —— 41 → 490
   *    ② Lv31~240（指数递增）：need = 490 × growth^(Lv−30)  —— 508 → 1,000,000
   *       growth 由 needTop 反解 = (100万 / 490)^(1/210) ≈ 1.03696（每级 +3.7%）
   *    关键节点：Lv1 41 · Lv30 490 · Lv60 ≈1455 · Lv100 ≈6170 · Lv150 ≈3.8万
   *             Lv200 ≈23.7万 · **Lv240 = 100 万**
   *    累计（total）= Σ need(1..240)，**加载时累加算出**，供经验道具按百分比取额。
   * 与 v29 旧曲线的关系：旧曲线累计 3180 万 —— 本次（≈2800 万）与它同量级，
   *    所以那批道具的**旧面额与旧价格口径也是对的**（见 EXP_ITEM_SPEC 的 was 列）。
   * 老存档经验池仍按新曲线归一（见 domain.js migrateExpScale）——
   *    新 need **逐级都不小于旧 need**，所以截断只会更少，不会白送等级。
   * 调平衡只改这三个数：base / quad（前段形状）· seg1To（分段点）· needTop（锚点）。
   * ============================================================ */
  DATA.EXP_CURVE = {
    seg1To: 30, base: 40, quad: 0.5,
    topLv: 240,            /* 天授等级上限 —— 曲线定义的"最高一级" */
    needTop: 1000000,      /* 老板拍板：239→240 单级需 100 万 */
    growth: 0,             /* 由锚点反解，见下方 IIFE */
    total: 0,              /* Σ need(1..topLv)，同样由 IIFE 算出 */
  };
  (function () {
    var C = DATA.EXP_CURVE, s = C.seg1To;
    var seg2Base = C.base + C.quad * s * s;              /* 490 —— 与二次段末端正好衔接 */
    C.growth = Math.pow(C.needTop / seg2Base, 1 / (C.topLv - s));
    var sum = 0;
    for (var lv = 1; lv <= C.topLv; lv++) {
      sum += (lv <= s) ? (C.base + C.quad * lv * lv) : (seg2Base * Math.pow(C.growth, lv - s));
    }
    C.total = Math.round(sum);
  })();

  /* ============================================================
   * 体力（v29 · 需求 11）
   * ------------------------------------------------------------
   * 体力从"只影响出征资格的资源"升为**第六维**：
   *   ① 上限随等级成长，成长量受资质（每级成长点）与内政影响；
   *   ② 战斗时按**当前体力**放大全军生命 —— 累了就打不动，打完仗要休整；
   *   ③ 生命加成用双曲函数而非硬上限，避免"到某个等级后加成恒定"的断崖：
   *        bonus = hpCap × 体力 / (体力 + hpK)
   *      体力 100（1 级）→ +8.9%　体力 500 → +30.8%　体力 1400 → +51%，渐近 80%。
   * ============================================================ */
  DATA.STAMINA = {
    base: 100,        // 1 级体力上限
    /* 每级成长 = 资质成长点 × perLevel × (1 + 内政/1000)。取 1.0 时：
       凡品 Lv60 → 体力 162（生命 +16.8%）；英杰 Lv140 → 538（+32.2%）；
       名世 Lv180 → 1040（+45.4%）；天授 Lv240 → 2108（+57.9%）。
       渐近上限 +80% 留出丹药与未来成长空间。 */
    perLevel: 1.0,
    nzDiv: 1000,      // 内政影响：内政 1000 使成长量翻倍
    hpCap: 0.8,       // 全军生命加成的渐近上限
    hpK: 800,         // 半程常数：体力 = hpK 时达到上限的一半
  };
  /* ============================================================
   * 精力上限（v89.131 · 老板「精力的数值设定基于六维设计一个公式」）
   * ------------------------------------------------------------
   * 精力是"统筹调度"的资源（远征/计略/游历都烧它），所以上限由**六维**派生：
   *
   *     精力上限 = base + 统帅×per.tong + 勇武×per.yw + 智谋×per.zm
   *                     + 内政×per.nz + 速度×per.spd + 体力上限×per.sta
   *
   * 权重设计的来由（探针 probe_v89131_energy_domain.js 实测数值域）：
   *   · 智谋（0.5）权重最高 —— 运筹帷幄最耗心力，与它已承担的"研究/城防"角色同族；
   *   · 统帅 / 勇武 / 内政（各 0.25）次之；速度（0.5）体现"奔波"的体力开销；
   *   · 第六维"体力上限"（0.03）贡献最小 —— 它是 161~2245 的大数池，
   *     只取零头才不会被它一项吃满（否则精力变成体力的复制品）。
   * 数值域（实测）：开局基准将 ≈104 · 凡品 Lv60 ≈102 · 良材 Lv100 ≈133 ·
   *   英杰 Lv140 ≈168 · 名世 Lv180 ≈215 · 天授 Lv240 ≈288。
   * 消耗侧（同轮取证）：远征 5~9 · 计略 8~18 · 游历 6~20 —— 高低资质差 2.8 倍，
   *   与"名将能连轴转、新兵跑两趟就得歇"的设计意图一致。
   * ⚠️ 所有数值只在本表调（唯一来源）；上限出口 = GAME.energyMaxOf（domain.js）。
   * ============================================================ */
  DATA.ENERGY = {
    base: 40,
    per: { tong: 0.25, yw: 0.25, zm: 0.5, nz: 0.25, spd: 0.5, sta: 0.03 },
  };

  DATA.GEN_RANK_BY_ID = {};
  DATA.GEN_RANKS.forEach(function (r) { DATA.GEN_RANK_BY_ID[r.id] = r; });

  /* 资质倾向（偏科）：只作用于「良材」及以上，凡品一律均衡 */
  DATA.GEN_STYLES = [
    { id: 'balance', name: '均衡', w: 30, mul: { tong: 1.00, nz: 1.00, yw: 1.00, zm: 1.00 } },
    { id: 'war', name: '猛将', w: 27, mul: { tong: 1.10, nz: 0.60, yw: 1.45, zm: 0.68 } },
    { id: 'wis', name: '智将', w: 25, mul: { tong: 1.02, nz: 1.12, yw: 0.62, zm: 1.45 } },
    { id: 'gov', name: '能臣', w: 18, mul: { tong: 0.96, nz: 1.50, yw: 0.58, zm: 1.10 } },
  ];

  /* ============================================================
   * 内功（v77 · 老板「将领技能学习书……设计将领内功修炼体系，
   *                可增加将领特性（根据功法和等级）」）
   * ------------------------------------------------------------
   * 每将同时只修**一门**内功（换书＝转修，旧功散去重头计）；
   * 每门 10 重（maxLv），第 N 重提供 attr +per×N 的属性特性（trait 名）。
   * 加成在 GAME.genAttrs 里统一并入（唯一出口）——与装备/丹药同层求和，
   * 战斗、生产、界面全走同一条链。书在商城购得（type 'neigong'）。
   * ============================================================ */
  DATA.NEIGONG = [
    { id: 'sunzi',  name: '孙子兵法', trait: '庙算', attr: 'zm',  per: 4, maxLv: 10, desc: '未战先算，多算胜少算。智谋 +4/重。' },
    { id: 'liutao', name: '太公六韬', trait: '将略', attr: 'tong', per: 4, maxLv: 10, desc: '文韬武略，驭众之要。统率 +4/重。' },
    { id: 'wuqin',  name: '五禽戏',   trait: '养生', attr: 'nz',  per: 4, maxLv: 10, desc: '导引吐纳，形神俱养。内政 +4/重。' },
    { id: 'yuenv',  name: '越女剑经', trait: '剑心', attr: 'yw',  per: 4, maxLv: 10, desc: '越女论剑，一人当百。勇武 +4/重。' },
  ];

  /* 史实名将的资质判定线（按四维总和） */
  DATA.HERO_RANK_LINE = [
    { min: 420, id: 'tian' },
    { min: 380, id: 'ming' },
    { min: 330, id: 'ying' },
    { min: 280, id: 'liang' },
    { min: 0, id: 'fan' },
  ];

  /* ============================================================
   * 将领消耗与忠诚（v11）
   * 此前 stamina/energy 只恢复不消耗、loyalty 只涨不落 —— 均为"死属性"
   * ============================================================ */
  DATA.GEN_COST = {
    marchStamina: 25,      // 出征（攻城/掠夺）消耗体力
    scoutEnergy: 8,        // 侦察 / 讨伐野地消耗精力
    /* v89.131（老板「体力精力应随现实时间百分比回复，按现实时间24h可恢复满值设计速率」）：
       `staPerHour/enePerHour`（游戏小时 · 固定点数）退役 —— 固定点数在 600× 下
       = 每现实小时回 1800 点（小池子几十秒满、大池子按比例失衡）；
       改为**百分比口径**：满值 = 100%，24 现实小时回满 → 速率 = 上限 ÷ 86400 /秒。
       好处：① 与倍速解耦（任何倍速下都是"一天养满一个将"）；
             ② 大小池子同体验（新兵与天授都是 24h 一循环）；
             ③ 道具（体力族 14 档 / 精力族 4 档）成为"加速的快捷车道"。
       实现在 state.js 两处（在线 tickOnce / 离线 simulateBulk），数值只改这里。 */
    recoverHours: 24,      // 满回复所需**现实小时**（体力与精力同一口径）
    minStaminaToMarch: 25, // 体力低于此值不可出征
    minEnergyToScout: 8,
  };
  /* v74（老板需求 1）：「取消将领对人口上限的加成」—— POP_PER_TONG 随之下线
     （原"报告 9.2：统率 1 点 = 影响 100 军队 + 1000 人口"的人口那一半已撤除）。 */

  /* ------------------------------------------------------------
   * 忠诚（v14.1 调整）
   * **不再随时间 / 民心 / 欠俸衰减** —— 玩家没做错事就不该掉忠诚。
   * 唯一下降途径：**出征战败**（defeatLoss）。赏赐珠宝仍可提升。
   * 保留低忠诚的后果：加成打折、极低时可能离去。
   * ------------------------------------------------------------ */
  DATA.LOYALTY = {
    defeatLoss: 8,          // 出征战败：参战将领忠诚 -8
    warnAt: 50,             // 低于此值给出警示（加成减半）
    desertAt: 12,           // 低于此值每小时有概率离去
    desertChancePerHour: 0.004,
    faintMul: 0.5,          // 忠诚低于 warnAt 时，该将加成打折（半效）
  };

  /* ============================================================
   * 装备打造（v11）：装备获取的主要途径
   * 铁匠铺等级决定可打造品质；套装件需对应「图纸」
   * ============================================================ */
  DATA.FORGE = {
    /* 铁匠铺等级 → 可打造的最高品质 */
    tierLv: [1, 3, 5, 7],
    /* 各品质基准成本 */
    costByQ: {
      1: { gold: 800, iron: 300, wood: 200, stone: 100 },
      2: { gold: 4000, iron: 1500, wood: 1000, stone: 500 },
      3: { gold: 20000, iron: 7000, wood: 4500, stone: 2200 },
      4: { gold: 90000, iron: 30000, wood: 20000, stone: 10000 },
    },
    setMul: 2.2,          // 套装件成本倍率（散件更便宜）
    slotMul: { weapon: 1.6, mount: 2.0, chest: 1.25, head: 1.1 },
    slotMulDef: 1.0,
  };

  /* ============================================================
   * 铁匠铺 · 百炼强化（v77 · 老板「装备可进行强化」）
   * ------------------------------------------------------------
   * 模型（v79 改）：强化等级记在**单件**上（inst.enh = 0..max，同名各升各的；见 GAME.enhance）——
   *   本项目装备是"同一图纸的量产件"（背包/穿戴都存 id、不存实例），
   *   因此强化按"种"累计：同种装备共享等级，日后新打造的也继承。
   * 效果：每级 全部装备属性 +perLv（在 genEquipBonus 里乘上去，唯一出口；
   *   套装加成不参与强化，避免"叠上叠"）。
   * 成本：随强化等级线性上升，取该品质打造基准成本的一个系数。
   * ============================================================ */
  DATA.ENHANCE = {
    max: 10,             // 最高 +10
    perLv: 0.08,         // 每级：装备全属性 +8%
    goldMul: 0.35,       // 单级成本 = 打造基准 × 系数 × (当前等级 + 1)
    ironMul: 0.22,
    stoneMul: 0.22,
  };

  /* 可打造散件（12 槽位 × 4 品质，脚本生成；套装件另见 EQUIP 表） */
  /* 四档命名（与所用材料品阶呼应；主系列见 FORGE.matBySlot） */
  DATA.CRAFT_SLOTS = [
    { id: 'weapon',   primary: 'iron',    names: ['铁刀', '钢刀', '宝刀', '神兵'],       stat: 'atk', v: [78, 264, 558, 960] },
    { id: 'head',     primary: 'iron',    names: ['皮盔', '铁盔', '镔铁盔', '陨铁盔'],   stat: 'def', v: [72, 242, 511, 880] },
    { id: 'chest',    primary: 'iron',    names: ['皮甲', '铁甲', '明光铠', '陨铁铠'],   stat: 'def', v: [98, 330, 700, 1200] },
    { id: 'shoulder', primary: 'iron',    names: ['皮肩', '铁肩铠', '吞肩甲', '陨铁肩'], stat: 'def', v: [72, 242, 511, 880] },
    { id: 'arm',      primary: 'iron',    names: ['皮臂', '铁臂甲', '护心臂', '陨铁臂'], stat: 'def', v: [66, 220, 464, 800] },
    { id: 'waist',    primary: 'leather', names: ['皮带', '硝革带', '蟠龙带', '蛟革带'], stat: 'def', v: [66, 220, 464, 800] },
    { id: 'feet',     primary: 'leather', names: ['草鞋', '皮靴', '犀革靴', '踏云靴'],   stat: 'spd', v: [5, 20, 44, 78] },
    { id: 'neck',     primary: 'jade',    names: ['河石坠', '青玉坠', '羊脂坠', '昆山坠'], stat: 'tong', v: [10, 22, 38, 56] },
    { id: 'ring',     primary: 'jade',    names: ['河石戒', '青玉戒', '羊脂戒', '昆山戒'], stat: 'tong', v: [10, 22, 38, 56] },
    { id: 'pendant',  primary: 'jade',    names: ['木佩', '青玉佩', '羊脂佩', '昆山佩'],  stat: 'zm', v: [10, 22, 38, 56] },
    { id: 'back',     primary: 'silk',    names: ['麻布披风', '细绢披风', '蜀锦披风', '云锦披风'], stat: 'zm', v: [10, 22, 38, 56] },
    { id: 'mount',    primary: 'leather', names: ['驽马', '良马', '骏马', '龙驹'],       stat: 'spd', v: [9, 36, 82, 146] },
  ];
  /* 品阶 → 打造散件的**体力**（源数据表的「体力」列；v66 起并进体力上限） */
  DATA.Q_STA = { 1: 80, 2: 220, 3: 420, 4: 700 };
  DATA.Q_NAME = { 1: '凡品', 2: '良品', 3: '珍品', 4: '神品' };
  /* 品阶 → 该品阶主材料名（用于「部位未写 names 时」的兜底命名）。
     此前该表被引用却从未定义，只因所有 CRAFT_SLOTS 都写了 names 才没炸 ——
     属潜伏地雷：新增一个漏写 names 的部位就会崩在下面那行。 */
  DATA.Q_MAT = { 1: '凡铁', 2: '精铁', 3: '镔铁', 4: '陨铁' };
  (function () {
    DATA.CRAFT_SLOTS.forEach(function (sl) {
      for (var q = 1; q <= 4; q++) {
        var id = 'cr_' + sl.id + '_' + q;
        if (DATA.EQUIP[id]) continue;
        var it = { id: id, name: (sl.names && sl.names[q - 1]) || (DATA.Q_MAT[q] + sl.name),
          slot: sl.id, q: q, sta: DATA.Q_STA[q], craft: true };
        it[sl.stat] = sl.v[q - 1];
        DATA.EQUIP[id] = it;
      }
    });
  })();

  /* 装备图纸（q3/q4 套装件的前置） */
  DATA.BLUEPRINTS = [
    { id: 'bp_mingjiang', name: '名将套图纸', type: 'blueprint', set: 'mingjiang', price: 60, forgeLv: 3,
      desc: '凭此可在铁匠铺打造「名将套」（需铁匠铺 Lv3）' },
    { id: 'bp_shenwu', name: '神武套图纸', type: 'blueprint', set: 'shenwu', price: 110, forgeLv: 5,
      desc: '凭此可在铁匠铺打造「神武套」（需铁匠铺 Lv5）' },
    { id: 'bp_yitian', name: '倚天套图纸', type: 'blueprint', set: 'yitian', price: 320, forgeLv: 7,
      desc: '凭此可在铁匠铺打造「倚天套」（需铁匠铺 Lv7）' },
  ];

  /* 图纸并入宝物表（可入背包、可商城购买、可掉落） */
  DATA.ITEMS = DATA.ITEMS || [];
  DATA.BLUEPRINTS.forEach(function (bp) {
    var exists = false;
    DATA.ITEMS.forEach(function (it) { if (it.id === bp.id) exists = true; });
    if (!exists) DATA.ITEMS.push(bp);
  });

  /* ============================================================
   * 打造材料（v12）
   * 材料取代原来的"只用资源打造"：每种装备按部位吃不同材料，
   * 材料来自「攻打野地（按地形）」与「攻占城池（按等级）」，商城可购基础料
   * ============================================================ */
  /* ---- 六大系列（每系列四品阶） ---- */
  DATA.MAT_SERIES = [
    { id: 'iron',    name: '铁系', tone: '#98a2b2', use: '刀兵甲胄之骨' },
    { id: 'wood',    name: '木系', tone: '#a8814c', use: '弓弩器械之干' },
    { id: 'leather', name: '革系', tone: '#a06f4a', use: '甲裳靴履之肤' },
    { id: 'sinew',   name: '筋系', tone: '#b89a6c', use: '弓弦索具之力' },
    { id: 'jade',    name: '玉系', tone: '#74b0a6', use: '佩饰玺绶之华' },
    { id: 'silk',    name: '丝系', tone: '#c07f96', use: '战袍旗幡之彩' },
  ];
  DATA.MAT_SERIES_BY_ID = {};
  DATA.MAT_SERIES.forEach(function (x) { DATA.MAT_SERIES_BY_ID[x.id] = x; });

  DATA.MATERIALS = [
    /* 铁系：兵刃甲胄之本 */
    { id: 'fatie',   series: 'iron',    tier: 1, name: '凡铁',   price: 10,  desc: '寻常生铁，炉火可锻。山野矿脉皆出。' },
    { id: 'jingtie', series: 'iron',    tier: 2, name: '精铁',   price: 34,  desc: '百炼去杂，刃口不卷。唯城池武库有之。' },
    { id: 'bintie',  series: 'iron',    tier: 3, name: '镔铁',   price: 105, desc: '折叠锻打千层，纹如流水，削铁如泥。' },
    { id: 'yuntie',  series: 'iron',    tier: 4, name: '陨铁',   price: 330, desc: '天外坠铁，非人间炉火所能熔。' },
    /* 木系：弓弩器械之干 */
    { id: 'songmu',  series: 'wood',    tier: 1, name: '松木',   price: 8,   desc: '山林易得，作柄作杆。' },
    { id: 'nanmu',   series: 'wood',    tier: 2, name: '楠木',   price: 28,  desc: '纹理细密，经年不蠹，造弓之上材。' },
    { id: 'tanmu',   series: 'wood',    tier: 3, name: '檀木',   price: 88,  desc: '香气沉郁，坚重几与铁石同。' },
    { id: 'jianmu',  series: 'wood',    tier: 4, name: '建木',   price: 280, desc: '上古通天之木，得其一段可造神兵之柄。' },
    /* 革系：甲裳靴履之肤 */
    { id: 'cuge',    series: 'leather', tier: 1, name: '粗革',   price: 8,   desc: '寻常兽皮鞣制，聊以蔽体。' },
    { id: 'xiaoge',  series: 'leather', tier: 2, name: '硝革',   price: 30,  desc: '硝石熟制，柔韧耐磨。' },
    { id: 'xige',    series: 'leather', tier: 3, name: '犀革',   price: 95,  desc: '犀皮七层，箭矢难透。' },
    { id: 'jiaoge',  series: 'leather', tier: 4, name: '蛟革',   price: 300, desc: '蛟龙之皮，入水不濡，刀枪难入。' },
    /* 筋系：弓弦索具之力 */
    { id: 'shoujin', series: 'sinew',   tier: 1, name: '兽筋',   price: 10,  desc: '野兽之筋，曝晒捶打可作弓弦。' },
    { id: 'niujin',  series: 'sinew',   tier: 2, name: '牛筋',   price: 32,  desc: '千斤之牛之筋，韧而不断。' },
    { id: 'jiaojin', series: 'sinew',   tier: 3, name: '蛟筋',   price: 100, desc: '绞之为索，可曳巨石。' },
    { id: 'longjin', series: 'sinew',   tier: 4, name: '龙筋',   price: 320, desc: '真龙之筋，一丝可当千钧。' },
    /* 玉系：佩饰玺绶之华 */
    { id: 'heshi',   series: 'jade',    tier: 1, name: '河石',   price: 12,  desc: '河中卵石，琢磨可成小件。' },
    { id: 'qingyu',  series: 'jade',    tier: 2, name: '青玉',   price: 36,  desc: '色青质密，为佩为玺。' },
    { id: 'yangzhi', series: 'jade',    tier: 3, name: '羊脂玉', price: 110, desc: '温润如脂，王侯所宝。' },
    { id: 'kunshan', series: 'jade',    tier: 4, name: '昆山玉', price: 340, desc: '昆山之玉，天下至宝，得之可镇国。' },
    /* 丝系：战袍旗幡之彩 */
    { id: 'mabu',    series: 'silk',    tier: 1, name: '麻布',   price: 8,   desc: '粗麻织就，为袍为帐。' },
    { id: 'xijuan',  series: 'silk',    tier: 2, name: '细绢',   price: 26,  desc: '蚕丝细绢，轻柔生光。' },
    { id: 'shujin',  series: 'silk',    tier: 3, name: '蜀锦',   price: 92,  desc: '蜀中织锦，一寸千金。' },
    { id: 'yunjin',  series: 'silk',    tier: 4, name: '云锦',   price: 290, desc: '云霞之锦，日光下五色流转。' },
  ];
  /* v89.116（"引用了不存在的成员"同族清剿）：`DATA.ITEM_BY_ID` 一直被 state.js 的
     存档摘要读着（`DATA.ITEM_BY_ID && DATA.ITEM_BY_ID[id] ? .name : id`）——
     表不存在 → 摘要里永远显示原始 id（`chest_tong` 而不是「青铜宝箱」）。
     与 MATERIAL_BY_ID 同构，一次建表、各处直读。 */
  DATA.ITEM_BY_ID = {};
  (DATA.ITEMS || []).forEach(function (it) { DATA.ITEM_BY_ID[it.id] = it; });

  DATA.MATERIAL_IDS = DATA.MATERIALS.map(function (m) { return m.id; });
  DATA.MATERIAL_BY_ID = {};
  DATA.MATERIALS.forEach(function (m) {
    DATA.MATERIAL_BY_ID[m.id] = m;
    m.seriesName = DATA.MAT_SERIES_BY_ID[m.series] ? DATA.MAT_SERIES_BY_ID[m.series].name : m.series;
  });
  /* 系列 × 品阶 → 材料 id */
  DATA.MAT_BY_SERIES = {};
  DATA.MATERIALS.forEach(function (m) {
    DATA.MAT_BY_SERIES[m.series] = DATA.MAT_BY_SERIES[m.series] || {};
    DATA.MAT_BY_SERIES[m.series][m.tier] = m.id;
  });
  DATA.MAT_OF = function (series, tier) {
    var t = Math.max(1, Math.min(4, tier || 1));
    return (DATA.MAT_BY_SERIES[series] || {})[t] || null;
  };
  /* 材料并入宝物表（可入背包、可商城购买、可掉落） */
  DATA.ITEMS = DATA.ITEMS || [];
  DATA.MATERIALS.forEach(function (m) {
    var exists = false;
    DATA.ITEMS.forEach(function (it) { if (it.id === m.id) exists = true; });
    if (!exists) {
      DATA.ITEMS.push({ id: m.id, name: m.name, type: 'material', price: m.price,
        tier: m.tier, series: m.series, desc: m.desc });
    }
  });

  /* ------------------------------------------------------------
   * 装备配方：部位决定「吃哪几个系列」，品质决定「吃第几品阶」
   * 例：武器 = 铁系 + 木系 + 筋系，品质4 则吃 陨铁 + 建木 + 龙筋
   * ------------------------------------------------------------ */
  DATA.FORGE.matBySlot = {
    weapon:   ['iron', 'wood', 'sinew'],
    head:     ['iron', 'leather'],
    chest:    ['iron', 'leather'],
    shoulder: ['iron', 'leather'],
    arm:      ['iron', 'leather'],
    waist:    ['leather', 'iron'],
    back:     ['silk', 'leather'],
    feet:     ['leather', 'sinew'],
    neck:     ['jade', 'iron'],
    ring:     ['jade', 'iron'],
    pendant:  ['jade', 'silk'],
    mount:    ['leather', 'sinew', 'silk'],
  };
  /* 品质 → 各系列需求量（主料 / 次料 / 辅料） */
  DATA.FORGE.qtyByQ = { 1: [3, 2, 1], 2: [6, 4, 2], 3: [10, 7, 4], 4: [16, 11, 6] };
  DATA.FORGE.setMatMul = 1.5;    // 套装件材料 ×1.5
  DATA.FORGE.salvageRate = 0.4;  // 拆解装备时回收的比例
  DATA.DEMOLISH_RATE = 0.5;      // 拆毁建筑返还累计投入的比例

  /* ------------------------------------------------------------
   * 材料获取：低阶采于野地（按地形），高阶唯征战城池可得
   * ------------------------------------------------------------ */
  /* ============================================================
   * 野地守军（v27 · 需求 3）
   * ------------------------------------------------------------
   * 每个等级给出**兵种 + 数量范围**（min~max）。当日实际值由
   * `GAME.wildDefenseAt(x, y)` 按 (坐标, 现实日) 确定性掷出：
   *   · 同一天内反复看，数字完全一致 —— 侦查看到的即是真的
   *   · 每现实日换一批 —— "今天这块地好打，明天可能就不是了"
   *   · 等级越高，兵种越硬、规模越大、带守将的概率越高
   * ============================================================ */
  /* v55（老板："感觉目前有点少了"）：**守军总数对齐原版**。
     原版各级野地守军总数（`docs/数值系统数据字典.md` §6.4「野地等级 × 守军兵力」，
     来源：乐都《热血三国(正版复刻)》官网攻略 + 4399 野地兵种介绍 + 开方游戏实测）：
       20 / 50 / 150 / 200 / 500 / 1000 / 2000 / 4000 / 8000 / 20000 / 40000
     改前我们的中值合计只有 22/57/113/202/220/425/730/1225/1935/2915/4560 ——
     低等级（0~3）基本对得上，**4 级起就系统性偏少，10 级只有原版的 1/9**，
     而玩家的军队规模到后期是几万级（官府 Lv10 满农田能养 5 万+），
     所以"感觉少了"是数量级的差距，不是感觉问题。
     本次**只重标定总数，不动兵种构成比例与区间形状**（比例本身是合理的：
     义兵→枪→盾→弓→轻骑→藤甲/铁骑/床弩/投石的递进与原版一致）。
     每一级的新中值合计与原版总数的偏差 ≤1.2%（见 smoke 的实测断言）。 */
  DATA.WILD_DEF_ORIG_TOTAL = [20, 50, 150, 200, 500, 1000, 2000, 4000, 8000, 20000, 40000];
  DATA.WILD_DEFENSE = [
    /* Lv0 */ [{ id: 'yibing', min: 9, max: 30 }],
    /* Lv1 */ [{ id: 'yibing', min: 25, max: 60 }, { id: 'changqiang', min: 1, max: 16 }],
    /* Lv2 */ [{ id: 'yibing', min: 65, max: 160 }, { id: 'changqiang', min: 16, max: 60 }],
    /* Lv3 */ [{ id: 'yibing', min: 70, max: 170 }, { id: 'changqiang', min: 30, max: 85 }, { id: 'gongjian', min: 10, max: 40 }],
    /* Lv4 */ [{ id: 'changqiang', min: 140, max: 360 }, { id: 'daodun', min: 70, max: 200 }, { id: 'gongjian', min: 55, max: 170 }],
    /* Lv5 */ [{ id: 'changqiang', min: 260, max: 660 }, { id: 'daodun', min: 140, max: 400 }, { id: 'gongjian', min: 95, max: 310 }, { id: 'qingji', min: 30, max: 110 }],
    /* Lv6 */ [{ id: 'changqiang', min: 520, max: 1250 }, { id: 'daodun', min: 300, max: 770 }, { id: 'gongjian', min: 190, max: 580 }, { id: 'qingji', min: 80, max: 300 }],
    /* Lv7 */ [{ id: 'changqiang', min: 980, max: 2350 }, { id: 'daodun', min: 590, max: 1450 }, { id: 'gongjian', min: 390, max: 1100 }, { id: 'qingji', min: 200, max: 620 }, { id: 'tengjiabing', min: 65, max: 290 }],
    /* Lv8 */ [{ id: 'changqiang', min: 1900, max: 4550 }, { id: 'daodun', min: 1150, max: 2750 }, { id: 'gongjian', min: 790, max: 2050 }, { id: 'qingji', min: 450, max: 1250 }, { id: 'tengjiabing', min: 250, max: 870 }],
    /* Lv9 */ [{ id: 'changqiang', min: 4650, max: 11000 }, { id: 'daodun', min: 2900, max: 6700 }, { id: 'gongjian', min: 2050, max: 5200 }, { id: 'qingji', min: 1250, max: 3150 }, { id: 'tieji', min: 410, max: 1650 }, { id: 'chuangnu', min: 210, max: 820 }],
    /* Lv10 */ [{ id: 'changqiang', min: 8750, max: 21100 }, { id: 'daodun', min: 5450, max: 13200 }, { id: 'gongjian', min: 4050, max: 9650 }, { id: 'qingji', min: 2450, max: 6150 }, { id: 'tieji', min: 1050, max: 4050 }, { id: 'chuangnu', min: 610, max: 2300 }, { id: 'toudan', min: 260, max: 1050 }],
  ];
  /* ============================================================
   * v55（老板："战胜后将领经验也比较少"）：**改成原版经验规则**。
   * 原版（`docs/数值系统数据字典.md` §9.5「将领升级经验系统」）：
   *   · 每消灭对方 **1000 资源**的军队得 **1 经验**；**胜方经验 ×2**
   *   · **单场经验上限 = 当前升级所需经验的 90%**
   *     （原文举例：1 级升 2 级只需 100 经验，刷 10 级野地也只拿 90）
   * **v56 老板拍板改了两条**（原版是我们的来源，不是我们的规范）：
   *   · 封顶 90% → **80%**（"一场 0.8 级"）；理由见下面 capPct 的注释。
   *   · **败方不给经验**（原版"胜方×2"暗含败方拿一半）→ 删掉 `loseMul`。
   * 改前我们用的是 `野地等级 × 12`（线性），而升级需求是 `等级² × 100`（二次），
   * 于是越到后期越离谱 —— 实测：Lv30 将领打 Lv10 野地要 **750 场**才升一级、
   * Lv50 打 Lv10 要 **840 场**。这不是"系数小一点"，是**公式错了**。
   * 换成原版规则后，经验与"实际歼灭的敌军规模"挂钩，封顶天然防溢出。
   * ============================================================ */
  DATA.EXP_RULE = {
    perResource: 1000,   // 每 1000 资源 = 1 经验
    winMul: 2,           // 胜方 ×2
    /* v56（老板拍板）：**封顶从 90% 收到 80%** ——「一场 0.8 级」。
       原版写的是 90%，但那样"打得赢就必涨 0.9 级"，野地等级只决定
       "能不能打"、不决定"值不值得打"，梯度被抹平了（打 Lv10 与打 Lv9 收益一样）。
       80% 保留"打一块高级野地就很值"的手感，同时让高级野地仍然更划算。 */
    capPct: 0.8,         // 单场封顶 = 升级需求的 80%
    scout: 30,           // 侦察（无风险，固定小额）
  };
  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，野地 1~10 级按「每 12 级一个台阶」对将领等级：
     ≤12 打 1 级吃满、13~24 打 2 级吃满、…、>120 打 10 级吃满（台阶封顶在 10 级野地）；
     打低于自己台阶的野地每差一档 ×decay，地板 minMul（不至于完全归零）。
     调平衡只改这里的四个数；只作用于野地（城池/野外城池的歼灭经验口径不变）。 */
  DATA.EXP_PENALTY = { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 };
  /* 当日规模波动：同一等级在 0.85~1.15 之间浮动（让"今天这块地"有差别） */
  DATA.WILD_DEFENSE_WAVE = [0.85, 1.15];
  /* 驻将概率：低等级野地无将，7 级起明显有将 */
  DATA.WILD_GEN_CHANCE = [0, 0, 0, 0.04, 0.08, 0.14, 0.22, 0.34, 0.48, 0.64, 0.8];
  /* 占野者为贼寇 / 山民，名字自成一系，不与客栈招募的将领重名 */
  DATA.WILD_LORD_SURNAME = ['张', '李', '王', '刘', '陈', '孙', '周', '吴', '胡', '韩', '赵', '吕'];
  DATA.WILD_LORD_GIVEN = ['霸', '虎', '狼', '枭', '豹', '蛮', '彪', '犷', '狩', '砺', '峋', '魈'];
  DATA.WILD_LORD_TITLE = ['渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅'];

  /* 名城守将（v60 · 需求 6）：太守 / 都尉一系，名字另起一池 ——
     与「贼寇」（WILD_LORD_*）和「客栈招募」都不重名，一眼能看出是系统城的人。 */
  DATA.NPC_GUARD_SURNAME = ['荀', '钟', '程', '贾', '董', '田', '沮', '审', '逢', '许',
    '杨', '乐', '郭', '满', '毛', '夏', '曹', '孙', '赵', '张', '李', '王', '刘', '吕'];
  DATA.NPC_GUARD_GIVEN = ['渊', '攸', '繇', '诩', '昭', '丰', '授', '配', '纪', '贡',
    '登', '阜', '进', '淮', '宠', '玠', '尚', '洪', '昂', '咨', '松', '邈', '毗', '逵'];
  DATA.NPC_GUARD_TITLE = ['太守', '都尉', '校尉', '长史', '中郎将', '偏将军'];

  DATA.WILD_MATERIAL = {
    forest:  { songmu: [2, 4], shoujin: [1, 2] },
    hill:    { fatie: [2, 4], heshi: [0, 2] },
    desert:  { heshi: [2, 4], cuge: [1, 2] },
    caoyuan: { cuge: [2, 4], mabu: [1, 3] },
    zhaoze:  { shoujin: [2, 3], cuge: [1, 2] },
    lake:    { shoujin: [2, 3], mabu: [1, 2] },
    plain:   { cuge: [1, 2], mabu: [1, 2] },
  };

  /* ============================================================
   * 州特产 + 名城岁贡（v14）
   * ------------------------------------------------------------
   * 说明：原版《热血三国》**没有**「城池特产」这一设定 —— 资源加成完全来自
   * 附属野地，城池提供的是税收（黄金）与建筑位。此处按需求做了「**州特产**」
   * 变体：与地理绑定，占该州城池即产出该州特产材料。
   * 作用：让「打哪里」直接决定「能造什么装备」，把地理与打造链打通。
   *
   * 深究：三/四阶材料原本只在州城(12)/都城(1) 的一次性掉落里，占完即断供。
   * 岁贡给出一条**持续**补给线，使长线目标（神品套装）可持续追求。
   * 结算锚定**现实日**（与野外城池等级同源），离线按天数差补齐。
   * ============================================================ */
  /* 十三州各出一种特产材料（覆盖六系 · 一阶1 / 二阶6 / 三阶5 / 四阶1）
   * 司隶为京畿，特尚方所贮「陨铁」（四阶）—— 占都城即得四阶材料的持续来源，
   * 解开「州城/都城一次掉落后占完即断供」的长期断层。 */
  DATA.STATE_SPECIALTY = {
    '司隶': { mat: 'yuntie',  tier: 4, lore: '京畿武库，百工所聚，天外之铁入于尚方。' },
    '冀州': { mat: 'jingtie', tier: 2, lore: '河北沃野，铁矿遍山，精铁堪用。' },
    '兖州': { mat: 'xiaoge',  tier: 2, lore: '济水之滨，皮革殷阜。' },
    '豫州': { mat: 'xijuan',  tier: 2, lore: '中州沃土，桑麻繁盛，细绢为贡。' },
    '青州': { mat: 'niujin',  tier: 2, lore: '青齐之地，牛马成群，筋革是出。' },
    '徐州': { mat: 'nanmu',   tier: 2, lore: '徐方山林深远，楠木可造强弓。' },
    '扬州': { mat: 'qingyu',  tier: 2, lore: '江淮之南，玉矿隐见。' },
    '荆州': { mat: 'shujin',  tier: 3, lore: '荆楚织造之盛，锦帛充于市肆。' },
    '益州': { mat: 'tanmu',   tier: 3, lore: '蜀道深处多檀木，坚重几与铁石同。' },
    '并州': { mat: 'fatie',   tier: 1, lore: '并代苦寒，冶铁甚众，凡铁易得。' },
    '凉州': { mat: 'xige',    tier: 3, lore: '河西走马之地，犀革难得而坚。' },
    '幽州': { mat: 'jiaojin', tier: 3, lore: '幽燕近海，渔猎所得蛟筋为奇货。' },
    '交州': { mat: 'yangzhi', tier: 3, lore: '交趾以南，美玉温润如脂。' },
  };

  /* 名城岁贡（按城档位 · 每现实日结算一次）
   * matQty 为该城特产材料的日产量区间；州城另有州治加成（见 STATE_SEAT_BONUS） */
  DATA.CITY_YIELD = {
    capital: { name: '都城', gold: 300000, rep: 200, matQty: [6, 10] },
    zhou:    { name: '州城', gold: 120000, rep: 60,  matQty: [5, 9] },
    jun:     { name: '郡城', gold: 40000,  rep: 20,  matQty: [4, 8] },
    county:  { name: '县城', gold: 15000,  rep: 10,  matQty: [3, 6] },
  };
  /* 州治加成：占有该州州城（司隶为都城）时，本州所有城池特产产量 ×此倍率 */
  DATA.STATE_SEAT_BONUS = 1.5;
  /* 离线补齐的现实日上限（防止长期离线后一次性涌入过多材料） */
  DATA.YIELD_MAX_DAYS = 30;

  /* ============================================================
   * 黄金闸门（v73 · 老板需求 1「限制黄金的获取」）
   * ------------------------------------------------------------
   * 黄金有三个进项：税收（每秒）· 爵位俸禄（每秒）· 州郡岁贡（每现实日）。
   * 三个进项各挂一处系数，**全部只读这张表** —— 将来再调档（更松 / 更狠）
   * 只改这里一行的数字，不碰业务代码。
   * v73 口径：全线收紧到三成。
   * v82（老板「官府不需要征收物质这个功能去除」）：第四口（官府征收）随功能退役，
   * 本表只余三口。
   * v89.48（老板「市场可以售卖资源，换取黄金」）：**第四条入口 = 市场售卖**。
   * 它自带核价口径（见 DATA.MARKET_SELL），故这里默认 1（不再额外收紧）；
   * 将来若要"卖资源换金再砍一刀"，改这一行即可，不必动业务代码。
   * ============================================================ */
  DATA.GOLD_GATE = { tax: 0.3, salary: 0.3, yield: 0.3, market: 1 };

  /* ============================================================
   * v89.95（A2 · 老板）：**物多价贱** —— 当日卖得越多，兑换比越低
   * ------------------------------------------------------------
   * 老板原话：「每日售卖获得的黄金越多，将会导致黄金兑换比越低（物多价贱，
   *   最终甚至一文不值，使得售卖资源变得无利可图）」。
   * 病根：卖资源是**无上限**的黄金入口 —— 资源换金 → 金买一切 → 玩家"无所不能"，
   *   而产量本身是指数增长（v8992 实测：满仓一轮 ≈ 1.1 亿金），于是经济失控。
   * 口径（唯一出口 GAME.mktSlipOf）：
   *   · 市场每日能"吃下"的黄金当量 = scale（默认 20 万金/游戏日）；
   *   · 当日累计换金越多，汇率乘数越低：mul = max(floor, 1 − 已换金 / scale)；
   *   · 每**游戏日**清零（隔日恢复）；floor = 0.10 → "再卖也是一折，无利可图"。
   * 通商券（free）：把"免折额度"还给玩家 —— 见 DATA.MARKET_SLIP.free。
   * ⚠️ 总闸就在这里：嫌卡得太死只改 scale/floor，别在各处写第二份。
   * ============================================================ */
  /* ============================================================
   * v89.95（A1 · 老板）：**节钺** —— 黄金买不到的"不可再生"资源
   * ------------------------------------------------------------
   * 老板原话：「原游戏以充值所得的元宝和装备作为不可再生资源……我们这个既然是
   *   单机游戏，如何创造和规划一种不可再生的难以获得的资源，合理设计其获得途径，
   *   嵌入当前经济系统中，使得作为玩家的发展限制器，否则玩家将通过黄金无所不能」。
   * 定位：**不是数值，而是"开门"** —— 它不解锁强度，只解锁"再往上走"的资格：
   *   · 问鼎天授（名世 → 天授，每将 1 枚）：顶档资质从此不是"种一株天授果"就能到；
   *   · 城池扩编（每城 +1 建造位，每城最多 citySlotMax 次）：城市铺开的节奏闸；
   *   · 校场扩编（每城 出征容量 +1 万人马，每城最多 xcMax 次）· v89.132 新增：
   *     军力投放的节奏闸 —— 只加出征容量，不动募兵名额与练兵收益；
   *   · 招贤纳士（每城 将领席位 +1，每城最多 genMax 次）· v89.132 新增：
   *     人才容量的节奏闸。
   * 获得途径（**只能打出来 / 赐下来，绝不能买**）：
   *   · 首次攻占名城：县城 1 / 郡城 2 / 州城 3 / 都城 5（同一座城只算一次）；
   *   · 爵位每 rankEvery 档 → +1（22 档共 5 枚，赏赐性质）；
   * 与战斗玩家的关系（老板第 3 问）：**打仗是节钺的唯一大宗来源** ——
   *   不想蹲田的人靠开疆拓土换编制与顶档，这就是"替代内容"。
   * ⚠️ 总闸：数量与用途都在本表，别处不许再写一份。
   * ============================================================ */
  DATA.JIEYUE = {
    name: '节钺', icon: '🪓',
    byTier: { county: 1, jun: 2, zhou: 3, capital: 5 },
    rankEvery: 4,
    citySlotMax: 2,               /* 城建扩编：建造位 +1（每城至多 2 次） */
    xcMax: 2,                     /* v89.132：校场扩编 —— 出征容量 +1 万人马（每城至多 2 次） */
    genMax: 2,                    /* v89.132：招贤纳士 —— 本城将领席位 +1（每城至多 2 次） */
    tianshouCost: 1,
    tianshouTo: 'tian',           /* 顶档的资质 id（gen.rank 用的就是它） */
    desc: '黄金买不到的「开门」资源：首占名城（县1/郡2/州3/都5）· 爵位每 4 档 +1。'
      + '用途：① 名世→天授（1 枚）② 城建扩编 · 建造位 +1 ③ 校场扩编 · 出征容量 +1 万人马 '
      + '④ 招贤纳士 · 将领席位 +1 —— ②③④ 每城各至多 2 次。',
  };

  DATA.MARKET_SLIP = {
    scale: 200000,          /* 每日免折抛售额度（金当量） */
    floor: 0.10,            /* 汇率乘数下限（物多价贱 → 一折） */
    free: { item: 'tongshang_quan', quota: 500000, durMin: 30 },   /* 通商券 */
  };

  /* ============================================================
   * 市场售卖（v89.48 · 老板需求）
   * ------------------------------------------------------------
   * 老板原话：「市场可以售卖资源，换取黄金，比例按 1，2，3，4 比例呈现，粮食最便宜」。
   *   · ratio：**比例表**（老板给定）—— 粮 1 : 木 2 : 石 3 : 铁 4，粮食最便宜。
   *   · per：分母 —— 「每 per 单位」按上表折金（20 单位 = 1 金 → 粮 0.05 金/单位）。
   *     取 20 的依据（探针 tools/probe/probe_market_price.js 实测 + 推导）：
   *       **民房人口表与农田产量表是同一张**（等级 L → 人口 T / 农田 T 每小时），
   *       黄金只由税收派生 → 金/h = 人口上限 × 税率0.5 × 闸门0.3 = 0.15 × 人口上限。
   *       于是「产粮」与「产金」被同一张表锁死，**平价恒定 = 1 金 ≈ 6.7 粮**
   *       （即 0.149 金/粮，与等级无关）：
   *         每 10 单位 1 金 → 0.100 金/粮 = 平价的 0.67 倍
   *         每 20 单位 1 金 → 0.050 金/粮 = **平价的 0.34 倍**（本档，再叠市场系数 0.21~0.33 倍）
   *       取偏紧的一档，与 v73「黄金闸门」的"金贵"基调一致：
   *       卖资源换金**始终劣于**"把同等产能投在民房/税制上"，
   *       是**消化余粮的应急口**，不是替代税制的印钞机。
   *       玩家侧换算（时倍率 120，即 1 现实分钟 = 2 游戏时）：
   *       1 块 Lv7 农田 ≈ 2100 粮/h → 一现实小时 ≈ 25 万粮 ≈ 卖 8.8k 金（市场 Lv3）；
   *       同期 4 间 Lv7 民房的税产 ≈ 20 万金 —— 即"一块田的余粮"约补 +4%，不喧宾夺主。
   *   · 结账系数：统一乘 GAME.marketRate()（市场等级越高折损越小）——
   *       **四类同乘一个系数 → 比例恒为 1:2:3:4 不变**（老板要的"比例呈现"永远成立）。
   * 改档只改本表：想宽松 per=10（= 平价的 0.67 倍），想更严 per=30 / 40。
   * ============================================================ */
  DATA.MARKET_SELL = {
    res: ['grain', 'wood', 'stone', 'iron'],
    ratio: { grain: 1, wood: 2, stone: 3, iron: 4 },
    per: 20
  };

  /* ============================================================
   * 市场买入（v89.59 · 老板「金币兑换物资时，存在比例损耗，这样就不会完全
   *   依赖市场，市场只应急」）
   * ------------------------------------------------------------
   * 与「售卖」（资源 → 金）互为反向，但**买入更贵**：
   *   卖出：per 单位按比价折金 × rate          （1 金 ≈ (per/k) 单位）
   *   买入：1 金按比价换 (per/k) 单位 × rate × (1 − loss)
   * `loss` 就是老板要的「比例损耗」：金 → 物资天然吃亏，于是**城池间运输**
   * （只被距离折损、市场等级还能减损）才是主路，市场只作应急。
   * 比例仍呈现 1 : 2 : 3 : 4（粮最便宜），与售卖一致 —— 四类同乘，比例恒定。
   * ============================================================ */
  DATA.MARKET_BUY = {
    res: ['grain', 'wood', 'stone', 'iron'],
    ratio: { grain: 1, wood: 2, stone: 3, iron: 4 },
    per: 20,          /* 基准：20 粮 ≈ 1 金（与售卖同基准） */
    loss: 0.35        /* 买入比例损耗 35%：金 → 物资只值 65%（市场只应急） */
  };

  /* ============================================================
   * v89.100（老板假设「战利品以购买价 75% 出售」）：**道具寄售**
   * ------------------------------------------------------------
   * 把背包里有价道具（战利品：珠宝 / 材料 / 种子 / 图纸 / 宝箱…）按
   * **商城购买价的 75%** 回收为黄金。唯一出口 GAME.systems.consign*。
   *   · 价 = item.price × 100（与 doShopping 同口径）× rate（本配置）
   *   · price = 0 的道具（灵草 / 灵气精华）无购买价 → 不可寄售
   *   · 装备实例不在此列（走「拆解」回收打造材料，见 salvageEquip）
   * 调平衡只改本配置（UI / 探针 / 推演全从这里读，别处不许另算价）。
   * ============================================================ */
  DATA.ITEM_SELL = { rate: 0.75 };

  /* ============================================================
   * 募兵提速 · 花金买时间（v89.49 · 老板「募兵队列怎么不可加速了？」）
   * ------------------------------------------------------------
   * **病根**（排查结论，别再重复踩）：v28 的加速只有一条路 —— 商城「加速」类里的
   *   韩信三篇 / 韩信点兵术。背包里没有这两件时，队列里的「加速」按钮是
   *   `disabled`（灰的、点了没反应）→ 玩家看到的就是"不可加速"。
   *   而 100 铁骑兵要等 **20 现实分钟**，没有提速手段是真要命。
   * 现在补第二条路：**花黄金买时间**（三档），宝物那条照旧（仍是更划算的路）。
   *   · 计价锚点 = 该批次的**军资**（`DATA.TROOPS[t].cost × 数量`，编制价）：
   *       按档位线性折算，`立刻完成` = 军资 × 20%。
   *   · 为什么按军资而不按秒：军资天然随兵种×数量缩放（100 义兵 3.9 万资源 /
   *     100 铁骑 90 万），**不随兵种漂移**，玩家一句"花两成军资立刻完工"就记住了。
   *   · 计价按**实际能缩短的量**收（已走完的部分不再收费）——
   *     所以越接近完工越便宜，「立刻完成」是个动态价。
   *   · 与宝物对比（实测）：100 铁骑立刻完成 ≈ 18 万金（省 20 现实分钟）；
   *     同批用韩信三篇只花 2,500 金（省 30%）—— **宝物明显更便宜**，
   *     花金是"随时可用、不必囤货"的贵价路。两条并存，不再有"点了没反应"。
   * ============================================================ */
  DATA.TRAIN_RUSH = {
    costPct: 0.20,
    steps: [
      { pct: 0.25, label: '−25%' },
      { pct: 0.50, label: '−50%' },
      { pct: 1.00, label: '立刻完成' }
    ]
  };

  /* ============================================================
   * 种田秘境（v73 · 老板需求 3）
   * ------------------------------------------------------------
   * 老板原话：「官府可进入另外一个菜单，种田秘境（背景是个人种田空间，
   * 可种植装备打造、将领提升资质的植物，设计一个完整链条，
   * 将这个作为高级别材料的获取途径）」
   *
   * 完整链条（一环不缺）：
   *   种子（采集 / 征战所得，**不花黄金**）→ 灵田播种 → 游戏时间生长 → 收获
   *        ├─ 材料作物 → 3 阶主产（有机率出 4 阶）→ 铁匠铺打造高阶装备
   *        └─ 灵草作物 → 蕴灵草 / 洗髓芝 / 化龙参 / 天授果 → 将领资质逐档提升
   *
   * 数值全表化（加作物 = 加一行；调价 / 调时长只改本表）：
   *   · hours = **游戏小时**（吃时间倍率，与建造 / 研究同一把尺）
   *   · seedItem = 所需种子（v78：种子只能从将领活动获得 —— 采集归来 / 出征缴获，
   *               见 GAME.grantSeedDrop 与 DATA.SEED_DROP；**不花黄金**）
   *   · mat   = 3 阶主产材料 + 产出区间 qty；rare / rareP = 4 阶副产与几率
   *   · herb  = 灵草作物：收 1 株对应灵草（道具 id 与作物 id 同名）
   * ============================================================ */
  DATA.FARM = {
    plots: 6,
    crops: [
      { id: 'tieying',     name: '铁英树', icon: '🌳', hours: 6,  seedItem: 'seed_fan', mat: 'bintie',  rare: 'yuntie',     rareP: 0.15, qty: [2, 4], desc: '根须吸铁成英，可炼镔铁；偶结陨铁' },
      { id: 'tanxiangshu', name: '檀香树', icon: '🌲', hours: 6,  seedItem: 'seed_fan', mat: 'tanmu',   rare: 'jianmu',     rareP: 0.15, qty: [2, 4], desc: '香气沉郁、坚重近铁，可伐檀木' },
      { id: 'xipiteng',    name: '犀皮藤', icon: '🪴', hours: 6,  seedItem: 'seed_fan', mat: 'xige',    rare: 'jiaoge',     rareP: 0.15, qty: [2, 4], desc: '藤皮七层如犀甲，可制犀革' },
      { id: 'jiaojinteng', name: '蛟筋藤', icon: '🌿', hours: 6,  seedItem: 'seed_fan', mat: 'jiaojin', rare: 'longjin',    rareP: 0.15, qty: [2, 4], desc: '藤筋韧可曳石，绞之为索' },
      { id: 'yusuihua',    name: '玉髓花', icon: '🌸', hours: 6,  seedItem: 'seed_fan', mat: 'yangzhi', rare: 'kunshan',    rareP: 0.15, qty: [2, 4], desc: '花凝玉髓，温润如脂' },
      { id: 'yunjinsang',  name: '云锦桑', icon: '🍃', hours: 6,  seedItem: 'seed_fan', mat: 'shujin',  rare: 'yunjin',     rareP: 0.15, qty: [2, 4], desc: '桑叶吐丝成锦，日光流转' },
      { id: 'yunlingcao',  name: '蕴灵草', icon: '🌱', hours: 12, seedItem: 'seed_yunling',  herb: 'yunlingcao',  desc: '灵气温养，助 凡品 将领洗出 良材 之资' },
      { id: 'xisuizhi',    name: '洗髓芝', icon: '🍄', hours: 24, seedItem: 'seed_xisui',    herb: 'xisuizhi',    desc: '洗髓伐骨，助 良材 将领跃入 英杰 之列' },
      { id: 'hualongshen', name: '化龙参', icon: '🪷', hours: 48, seedItem: 'seed_hualong', herb: 'hualongshen', desc: '鱼跃龙门之参，助 英杰 将领跻身 名世' },
      { id: 'tianshouguo', name: '天授果', icon: '🍑', hours: 96, seedItem: 'seed_tianshou', herb: 'tianshouguo', desc: '百年一熟的天授之果，名世 亦可问鼎 天授' },
    ],
  };
  DATA.FARM_CROP_BY_ID = {};
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
  };

  /* v89.51（老板「物品的产生和消耗路径打通」）：灵气精华掉落表 —— **唯一出口**
     GAME.grantEssenceDrop。灵气精华是蕴养修炼装备的专属材料（消耗端一直通），
     但产出端原先只挂在已下架的野地「江湖游历」上 → 蕴养成了死水。
     现在改道到两条**常驻**渠道：采集归来（主）与出征缴获（次）。
       p = base + perLv × lv；qty 每次掷 [1,2]。
     调平衡只改这张表（与 SEED_DROP 同构：数据驱动，别处不许另起概率）。 */
  DATA.ESSENCE_DROP = {
    battleMult: 0.6,    /* 战事结算折扣（采集是主渠道） */
    base: 0.30,
    perLv: 0.02,
    qty: [1, 2],
  };

  /* ============================================================
   * 名城专有（v60 · 需求 5）
   * ------------------------------------------------------------
   * 老板原话：「设计一些名城专有的资源，优势，或者选项」。
   * 分三层给，**全部数据驱动**（加内容 = 加数据，不动业务代码）：
   *   ① 专有资源 —— 已有「州特产 + 岁贡」承载（见上），这里补的是
   *      **名城独有的库藏**：`GAME.npcCityRes` 按等级派生的那份库存里，
   *      档位越高越富（占领即得，见 npcResMul）；
   *   ② 优势（`DATA.CITY_PERK`）—— 按城档位给**本城**经营加成，
   *      与"州特产岁贡"互补：岁贡给材料，这里给经营能力；
   *   ③ 选项（`DATA.CITY_OPTS`）—— 名城面板上的专属操作。
   *
   * ⚠️ perk 的每一项都必须**真有消费点**（死属性检查法）：
   *   prodPct → GAME.prodBasePerHourOf；taxPct → GAME.cityProdPerSec
   *   buildSlot → GAME.buildSlotOf；storePct → GAME.storeCapOf(city)
   *   troopSlot → GAME.trainSlotOf；npcResMul → GAME.npcCityRes
   * ============================================================ */
  DATA.CITY_PERK = {
    capital: { name: '帝都', prodPct: 0.20, taxPct: 0.15, buildSlot: 1, storePct: 0.50, troopSlot: 1, npcResMul: 2.2,
      desc: '帝都气象：本城产量 +20%、税收 +15%、同时建造 +1 队、募兵队列 +1、仓储 +50%' },
    zhou:    { name: '州治', prodPct: 0.12, taxPct: 0.08, buildSlot: 1, storePct: 0.25, troopSlot: 0, npcResMul: 1.6,
      desc: '州治之重：本城产量 +12%、税收 +8%、同时建造 +1 队、仓储 +25%' },
    jun:     { name: '郡治', prodPct: 0.06, taxPct: 0.04, buildSlot: 0, storePct: 0.12, troopSlot: 0, npcResMul: 1.25,
      desc: '郡治之实：本城产量 +6%、税收 +4%、仓储 +12%' },
    county:  { name: '县城', prodPct: 0.03, taxPct: 0.02, buildSlot: 0, storePct: 0.06, troopSlot: 0, npcResMul: 1.0,
      desc: '县城之利：本城产量 +3%、税收 +2%、仓储 +6%' },
    self:    { name: '自建', prodPct: 0, taxPct: 0, buildSlot: 0, storePct: 0, troopSlot: 0, npcResMul: 0,
      desc: '自己择地而建的城，无地利可恃，一切靠经营。' },
    /* v61：野外城池（据点）也有一档 —— 老板要求"野地里的城池默认建筑全满"，
       所以它走同一套派生布局；但它**不是名城**（无档位加成，见 GAME.isFamousCity），
       npcResMul 记 1.0 是为了让派生公式不必依赖 `0 || 1` 这种隐晦兜底。 */
    fort:    { name: '野城', prodPct: 0, taxPct: 0, buildSlot: 0, storePct: 0, troopSlot: 0, npcResMul: 1.0,
      desc: '野外城池：无地利加成，全凭守军与工事自守。' },
  };
  /* v79（老板）：主公驻跸之城 —— 「每人可有 1 个主城，在官府界面中设置」。
     主城吃一层**驻跸加成**（下面是全部可加点）；标志走 ui.cityLabelHTML / 下拉框 / 君主列表。 */
  DATA.MAIN_CITY = {
    bonus: { prodPct: 0.15, taxPct: 0.10, storePct: 0.30, genCap: 1, wildCap: 1 },
    moveCost: { gold: 100000 },   // 已有主城时改设收成本（首设免费）
    /* v89.102（老板「主城随爵位逐步解锁官府及其他建筑等级上限，爵位每级 +1」）：
       **坡度**（每档爵位解锁几级上限）—— 主城专属，别城不享受。
       真值唯一来源在上方 `DATA.MAIN_CITY_BUILD_PER_RANK`（等级表要按它外推，
       必须早于表声明），这里只是同一个数的引用，不另写一遍。 */
    buildCapPerRank: DATA.MAIN_CITY_BUILD_PER_RANK,
    desc: '君主驻跸：本城产量 +15%、税收 +10%、仓储 +30%、将领席位 +1、附属野地上限 +1'
      + '；**爵位每级解锁建筑等级上限 +1**（主城专属）',
  };

  /* v79（老板）：「神器加成（养成，主要依靠游戏时长和特殊活动逐渐提升），
     神器界面在君主菜单中」——
     三件神器共用一个**供奉值**池（s.artifacts.pts）：时长自动积累（主要），
     特殊活动（攻占城池 / 爵位晋升）大额加速；等级 = 供奉值翻过的门槛数。
     每级加成走 per（perLv），消费统一走 GAME.artifactBonusNum。 */
  DATA.ARTIFACT = {
    maxLv: 10,
    pts: [60, 150, 300, 600, 1000, 1800, 3000, 5000, 8000, 12000],  // 升 Lv(i+1) 门槛
    perGameHour: 3,                              // 游戏时长：每游戏小时 +3 供奉（主要来源）
    capturePts: { fort: 20, county: 40, jun: 80, zhou: 200, capital: 500 },  // 攻占城池
    promotePts: 300,                             // 爵位晋升一次
  };
  DATA.ARTIFACTS = [
    { id: 'yuxi', name: '传国玉玺', icon: '👑', theme: '受命于天',
      per: { taxPct: 0.02, repPct: 0.05 },
      desc: '受命于天，既寿永昌。每级：税收 +2%、声望获得 +5%' },
    { id: 'shending', name: '九州神鼎', icon: '🏺', theme: '定鼎九州',
      per: { prodPct: 0.02, storePct: 0.03 },
      desc: '禹铸九鼎，以镇九州。每级：全境产量 +2%、仓储 +3%' },
    { id: 'hetu', name: '河图洛书', icon: '📜', theme: '天机演算',
      per: { genExpPct: 0.06, storePct: 0.01 },
      desc: '河出图，洛出书。每级：将领经验 +6%、仓储 +1%' },
  ];

  /* 取某城的档位加成（唯一出口：别处不要再按 type 分支） */
  DATA.CITY_PERK_KEYS = ['prodPct', 'taxPct', 'buildSlot', 'storePct', 'troopSlot'];

  /* ③ 名城专属选项（面板上的额外操作）。
   * 冷却走**游戏日**（与"每日产出"同一把尺子），cost 从**本城**库存扣。 */
  DATA.CITY_OPTS = [
    { id: 'levy', name: '征调民力', icon: '📜', minType: ['county', 'jun', 'zhou', 'capital'],
      cdDays: 1, cost: { gold: 0 },
      desc: '以一城民力征调物资：按本城等级获得粮木石铁各一笔（每日一次）。' },
    { id: 'fest', name: '犒赏三军', icon: '🍶', minType: ['jun', 'zhou', 'capital'],
      cdDays: 1, cost: { gold: 20000, grain: 50000 },
      desc: '犒军安民：民心 +8、本城守将忠诚 +5（每日一次）。' },
    { id: 'summon', name: '名城建制', icon: '🏛', minType: ['zhou', 'capital'],
      cdDays: 3, cost: { gold: 100000 },
      desc: '调集工匠扩建城防：本城城防（def）永久 +3（每三日一次）。' },
  ];

  /* 未占据名城的库存派生（v60 · 需求 6）
   * 老板：「为所有未被占据的城池，根据其等级设定一定资源量，比如9级城池，其建筑默认
   *   全满，均9级，在这种情况下的资源量」。所以基数是**建筑全满时的产出能力**，
   *   再按等级折算成"积攒了若干小时"的量。grow 是每级的复利倍数
   *   （9 级 ≈ base × 1.55^8 ≈ base × 33.7，与"建筑全满 × 等级翻番"同量级）。 */
  /* ============================================================
   * 名城守将的等级区间（v89.64 · 老板「将领默认资质为天授，等级根据城池
   *   级别设定范围，四维拉满（自由属性点也随机加上）」）
   * ------------------------------------------------------------
   * 区间按**城档位**给（不是按 city.level）—— 档位是稳定的，城等级会随占领易主，
   * 守将不该因为"城掉了一级"就换个人、掉一档。
   * 上界对齐天授的等级上限（DATA.GEN_RANKS.tian.lvCap = 240）：
   *   县 60~100 · 郡 100~140 · 州 140~190 · 都 190~240
   * 唯一出口是 GAME.npcCityGuard（别处不要再按 type 写一遍区间）。
   * ============================================================ */
  DATA.NPC_GUARD_LV = {
    county: [60, 100], jun: [100, 140], zhou: [140, 190], capital: [190, 240],
  };

  /* ============================================================
   * 门派系统（v89.74 · P0 骨架）
   * ------------------------------------------------------------
   * 老板拍板（2026-09-19）：「门派驻地 · 架空 · 5 阶（可升阶，难度极大）·
   *   有门派专属声望与君主声望**区分开** · 其余按建议」。规则档见 docs/门派系统规则.md。
   *
   * P0 的硬约束是**零平衡影响** —— 本阶段只做"归属 / 声望 / 品阶 / 任务"四件事：
   *   · 不动战斗、产量、招募、治疗任何公式 ⇒ 不会出现"数值写进去却没生效"的死承诺
   *     （一门被动加成与专属兵种是 **P1**，见规则档分期表）；
   *   · 门派声望 `s.sect.rep` 与君主声望 `s.rep` **分家**：后者升爵位，前者定门中品阶，
   *     两套数字不许互相折算（拍板原文："门派专属声望与君主声望区分开"）。
   * 数据侧唯一出口：GAME.sectOf / sectRankOf / sectState（见 domain.js）。
   * ============================================================ */
  /* 五阶门槛（v89.89 · 老板拍板 C3「加来源 + 重估到 2-3 个月」）——
     原 0/2000/12000/60000/300000：声望唯一来源是门派任务（480/日封顶），
     长老 = 625 天现实时间（100+ 轮实玩实测），长线玩家永远够不着。
     重估依据：任务（480+/日）+ 占城（SECT_CONQUER_REP 分档）双来源下——
       · 纯杂役：60000 / 480 ≈ 125 天（最慢路径）
       · 带占城（90 天内占 10~20 城）：约 65~90 天跨过长老线 ✅ 目标区间
     保留"逐阶递增、后段最难"的结构（×6 → ×4.2 → ×2.4，后段靠占城加速）。 */
  DATA.SECT_RANKS = [
    { id: 'r1', name: '门客',     rep: 0 },
    { id: 'r2', name: '外门弟子', rep: 1000 },
    { id: 'r3', name: '内门弟子', rep: 6000 },
    { id: 'r4', name: '真传弟子', rep: 25000 },
    { id: 'r5', name: '长老',     rep: 60000 },
  ];
  /* v89.89（老板拍板 · C3）：占城 → 门派声望（一次性，按城档）。
     门派系统规则 §六"声望来源"的"占城"一条落地（另一条"江湖游历"随 C1 保持剥离）。
     未入派者不给（走 GAME.sectRepGain 唯一出口，无门派自动拒）。 */
  DATA.SECT_CONQUER_REP = { county: 1500, jun: 4000, zhou: 12000, capital: 30000 };
  /* 六派：**架空**门派（少林武当等与三国时代不符，老板拍板"架空"）。
     派别差异体现在「风格」与门中称谓，P0 不给数值加成 —— 见上面的零平衡约束。 */
  /* v89.86（门派 P1 · 老板拍板实装）：六派**被动加成** ——
     每个 trait 的 key 都由 `GAME.sectBonus` 唯一发放，消费点全在既有链上
     （行军速度 / 攻击伤害 / 攻城伤害 / 伤兵回收 / 器械耗时 / 坐骑属性），
     **不新增战斗公式、不新增资源类型**（门派系统规则 §十二）。 */
  DATA.SECTS = [
    { id: 'xuanhe',   name: '玄鹤门', icon: '🕊️', style: '轻身',
      trait: { key: 'marchPct', val: 0.08, text: '行军速度 +8%' },
      desc: '以轻身与阵形见长，门人多习斥候之道，行路迅疾。' },
    { id: 'qingfeng', name: '青锋阁', icon: '🗡️', style: '锋锐',
      trait: { key: 'atkPct', val: 0.06, text: '部队攻击 +6%' },
      desc: '专攻锋锐一击，讲求出鞘必见血，门下多剑客。' },
    { id: 'baicao',   name: '百草堂', icon: '🌿', style: '医道',
      trait: { key: 'woundPct', val: 0.15, text: '战后伤兵回复 +15%' },
      desc: '精于金创与药石，门下常行医于军中，救人无数。' },
    { id: 'huxiao',   name: '虎啸营', icon: '🪓', style: '刚猛',
      trait: { key: 'siegePct', val: 0.08, text: '攻城伤害 +8%' },
      desc: '刚猛横练，以硬桥硬马立门，门风最重信义。' },
    { id: 'xuanji',   name: '玄机阁', icon: '🧭', style: '机变',
      trait: { key: 'craftCut', val: 0.15, text: '器械打造耗时 −15%' },
      desc: '工于机关与推演，善察人所不察，江湖谓之"活舆图"。' },
    { id: 'muyun',    name: '牧云庄', icon: '☁️', style: '耕牧',
      trait: { key: 'mountPct', val: 0.20, text: '坐骑装备属性 +20%' },
      desc: '半耕半牧，庄中粮秣丰足，门人习性近于乡野。' },
  ];
  DATA.SECT_BY_ID = {};
  DATA.SECTS.forEach(function (x) { DATA.SECT_BY_ID[x.id] = x; });
  /* 入派 / 立派 / 退派的门槛。
     立派要求建筑 Lv2（拍板沿用旧「1级入盟/2级建盟」的节奏），且要一笔可观的本钱；
     退派＝声望清零 + 3 日冷却（拍板"按建议"）。 */
  DATA.SECT_JOIN = { bldLv: 1 };
  DATA.SECT_FOUND = { bldLv: 2, cost: { gold: 500000, wood: 30000, stone: 30000, iron: 10000 } };
  DATA.SECT_LEAVE = { cooldownDay: 3 };
  /* 门派任务：**每日有总次数上限**（否则声望可以无限刷，五阶门槛就形同虚设）。
     奖励只给「门派声望」，不给资源 —— 资源都花在成本侧（唯一出口 GAME.payCost）。 */
  DATA.SECT_TASK_PER_DAY = 40;
  DATA.SECT_TASKS = [
    { id: 'chores', name: '门派杂役', rep: 12,  cost: {},
      desc: '洒扫执役、抄录门规。不费分文，只费工夫。' },
    { id: 'drill',  name: '演武较技', rep: 80,  cost: { gold: 30000 },
      desc: '与门中好手过招，须备一份彩头。' },
    { id: 'donate', name: '捐资修葺', rep: 200, cost: { gold: 120000 },
      desc: '出资修葺山门、抚恤门人，声望涨得最快。' },
  ];

  DATA.NPC_CITY_RES = {
    base: { grain: 9000, wood: 7000, stone: 6000, iron: 4500, gold: 3000 },
    grow: 1.55,
    /* v63（老板）：「其兵力可设定为野外城的10倍数，在被占领前其兵力不消耗粮草」。
       口径：名城守军**总数** = 同等级野外城池守军 × 此倍数（`GAME.map.fortGarrison`），
       兵种构成仍按名城自己的规矩（等级越高越有铁骑与攻城器械，见下 garrisonMix）。
       ⚠️ 未占据城池的守军是**派生值**（不入存档，见 `GAME.buildNpcCities`），
       它不在 `state.cities` 里 → 从来不在任何粮食结算口径里（v89.36 起军队整体不耗粮，
       这条从"NPC 特例"变成了通例）。 */
    /* v89.64（老板「守军数量相应增加10倍」）：名城满配（建筑按等级上限）之后，
       守军再 ×10 —— 于是名城守军 = 同等级野外城池守军 × **100**。
       ⚠️ 这是**难度总闸**：若实战打不动，只改这一个数即可回退（10 = 本轮之前的口径）。 */
    /* v89.79（老板「为何同级城守军差这么多」「谁规定了这么大守军数量范围吗」）
       ------------------------------------------------------------
       ⛔ 退役：`守军 = 据点守军(50×1.95^(城等级-1)) × 档位倍数` 这条乘法链。
       病根：城等级曾是 1~10 的分布，而据点守军是指数 —— 同级城因此差 7 倍以上
             （县城 Lv1 ≈ 2,244 ↔ Lv10 ≈ 986,568），老板判定为"数量范围离谱"。
       ✅ 现在：**守军按档位给基准值**，同级城只差 ±8% 的确定性波动。
       数值来源 = 老板 v89.74 亲定的目标值（都 300 万 / 州 200 万 / 郡 100 万 / 县 50 万）。
       ⚠️ 难度总闸就在这一张表：整体难打/好打只改这四个数。 */
    garrisonByTier: { capital: 3000000, zhou: 2000000, jun: 1000000, county: 500000 },
    /* 库藏（粮食为基准，其余资源按 base 的比例缩放）—— 同样按档位给，同类城不再天差地别。
       ============================================================
       v89.81（老板）：「资源应当按照其**满科技，满建筑，建筑专精等所有加成的上限**」
       ------------------------------------------------------------
       演进：80万（我拍的）→ 200万（守军×2）→ **满配仓容**（本条）。
       现在口径 = **该城满配仓容**："这城仓库能装多少，它就囤了多少"。推导：
         BASE_STORE(200万) × (仓库座数 4 × 该档建筑等级)
           × (1 + 储存技术满级 10 × 5% = 0.50)
           × (1 + 仓库满级专精 0.50)
           × (1 + 该档 storePct：县6% / 郡12% / 州25% / 都50%)
         ⇒ 县城 2.29亿 · 郡城 3.23亿 · 州城 4.50亿 · 都城 6.48亿
       ⚠️ 这**不是四个随手写的数**，而是上式的**结果**。改了 `DATA.BASE_STORE`、
          `CITY_PLAN.order` 的仓库座数、`DATA.TECH_MAX_LV`、`DATA.MASTERY` 的 cangku 项
          或 `CITY_PERK.storePct` 之后，这四个数必须跟着重算 ——
          smoke 有一条守卫会拿"满科技 + 满配影子城"实算比对，漂移即红。
       ⚠️ 粮 = 满配仓容；木/石/铁/金 仍按 `base` 的比例（城里的资源结构：粮最多、金最少）。
          要让四种资源都装满（各 3.23 亿），把 `base` 改等值即可。 */
    resByTier: { capital: 648000000, zhou: 450000000, jun: 322560000, county: 228960000 },
    /* 兵种构成权重（纯权重表；总数按档位基准归一化，所以权重和不必为 1）。
       v89.79：去掉了原来的 minLv 门槛 —— 名城既已是"档位满配城"，兵种自然齐全；
       留一张按等级解锁的表就是**死数据**（城等级恒为 12/16/20/24，任何 minLv ≤ 24 都恒过）。
       档位之间的差别体现在**数量**（50 万 → 300 万），不体现在"有没有这种兵"。 */
    garrisonMix: [
      { id: 'yibing', w: 0.15 },
      { id: 'changqiang', w: 0.25 },
      { id: 'daodun', w: 0.20 },
      { id: 'gongjian', w: 0.25 },
      { id: 'qingji', w: 0.15 },
      { id: 'tieji', w: 0.12 },
      { id: 'chongche', w: 0.05 },
      { id: 'toudan', w: 0.03 },
      { id: 'chuangnu', w: 0.06 },
    ],
  };
  /* 自建新城（玩家择地而建）的启动物资 —— 不给的话新城的兵立刻断粮 */
  DATA.NEW_CITY_RES = { grain: 6000, wood: 6000, stone: 6000, iron: 6000, gold: 6000, pop: 100 };
  /* v89.93（整改 E12）：**新城开发模板** —— 自建城落成即预置的城外资源地。
     改前新城只有官府+民房，12 块城外地全空（实测新城 2/3 闲置 100 年零产出）。
     模板口径：3 田（人口与募兵粮）+ 1 木 + 1 石 + 1 铁 —— 落地就能自己造血。 */
  DATA.NEW_CITY_EXT = ['farm', 'farm', 'farm', 'forest', 'quarry', 'mine'];

  /* ============================================================
   * 运输与派遣（v60 · 需求 4）
   * ------------------------------------------------------------
   * 「城池之间，资源需要运输，将领需要派遣」——两者都按**本城库存/本城将领**记账。
   * 资源运输：即时结算（不做车队动画），但按距离抽**损耗**，
   *   让"就近布局"有意义；损耗率同时受【市场】等级削减（有仓有市则少掉）。
   * 将领派遣：一人一城，派遣 = 改 `g.cityId`（守将需先解任）。
   * ============================================================ */
  DATA.TRANSPORT = {
    /* 每格距离的基础损耗（1 格 = 1 天路程），上限 30% */
    lossPerTile: 0.004,
    lossMax: 0.30,
    /* 市场每级减损 1.5%（城池经营对运输的回报） */
    marketCutPerLv: 0.015,
    marketCutMax: 0.45,
    /* 单次运输量上限 = 本城仓库上限 × 此比例（防止"一次掏空"） */
    maxShipPct: 0.8,
  };

  /* 玩家自建城（含首城）的州属判定：按坐标就近认领最近的州城/都城 */
  /* 实现见 GAME.stateOfCity() */

  /* ============================================================
   * 出征三方式（v13）：侦查 / 掠夺 / 占领
   * 定位「轻松上手」：守军整体下调，伤兵回收提高，掠夺即有厚利
   * ============================================================ */
  DATA.EXPEDITION = {
    modes: [
      { id: 'scout', name: '侦查', icon: '🔭', stamina: 6, energy: 5, battle: false, occupy: false,
        desc: '不接战。探明守军虚实，顺手收取少量物资，并有机会拾得宝物线索。' },
      { id: 'raid', name: '掠夺', icon: '🔥', stamina: 16, energy: 7, battle: true, occupy: false,
        desc: '出兵劫掠而不入城。资源与材料收获最丰，另有珠宝与军械缴获。' },
      /* v89.83（老板「如果出征目的是占领，攻打成功后自动驻军，直至召回。掠夺则直接撤军」）——
         占领 = 打下来就**留下来**：野地的幸存者就地成为驻军（守地不衰减），**直至召回**；
         掠夺 = 打完**直接撤军**（兵回城）。
         于是 v89.63 那个独立的「派遣」方式被并入本方式 —— 两者只差"兵回不回"，
         并列成两种方式只会让玩家每次都要先想"我该点哪个"。
         · 已属我方的野地**不接战**（到了直接入驻，避免"打自己地盘"的荒谬结算）；
         · 伤兵仍回城医治（要治，不能扔在野外）；
         · 驻军超上限的部分自动回城（见 GAME.wildGarrisonAdd 的 overflow）。
         名城（城市目标）**不驻守** —— 城有自己的驻防体系，攻下后军队班师（见 battle 的 station 判定）。 */
      { id: 'occupy', name: '占领', icon: '🚩', stamina: 22, energy: 9, battle: true, occupy: true, station: true,
        desc: '击溃守军并据而有之：野地归我，军队就地驻守（守地不衰减，直至召回）；据点拔除即**占据**（全城建筑转正、人口归附，从此是我的一座城）；名城易主，军仍班师。' },
      /* ============================================================
       * v89.87（老板需求 2）：**派兵统一走行军通道**
       * ------------------------------------------------------------
       * 三条"不带战斗"的调派路径并入本表（原先瞬间到达、绕过行军）：
       *   · transfer —— 跨城调兵（含新城调兵入口）
       *   · station  —— 野地增派驻守（到己方野地，不接战）
       *   · gather   —— 野地采集（抵达后开始采集）
       * 它们与出征共用 march.dispatch：有行军时间、军务可见、可召回。
       * 体力/精力成本保持 0（transfer/station）与采集原值（gather=6）——
       * 本批只并入**通道**，不给这些操作加价。
       * ⚠ station 的 battle:true 是为了让 prepare 继续做兵力/校场校验；
       *   它在 expedition 里由既有的 station 分支短路为"入驻不接战"。
       * ⚠ transfer/gather 的 battle:false —— expedition 顶部有**专属分支**
       *   在"侦查判定"之前处理它们（否则会被当成侦查结算）。
       * ============================================================ */
      { id: 'transfer', name: '调兵', icon: '🚚', stamina: 0, energy: 0, battle: false, occupy: false,
        panel: false,   /* v89.87：调派类**不列出征方式下拉**（各有自己的入口） */
        desc: '兵力调往本境他城：走行军通道，抵城入编（主将随军入驻新城）。' },
      { id: 'station', name: '驻守', icon: '🛡️', stamina: 0, energy: 0, battle: true, station: true,
        panel: false,
        desc: '向已属我方的野地增派驻军：走行军通道，抵达即驻（守地不衰减，直至召回）。' },
      { id: 'gather', name: '采集', icon: '⛏️', stamina: 6, energy: 0, battle: false, occupy: false,
        panel: false,
        desc: '开赴己方野地开采：走行军通道，抵达后开始采集（满 1 小时方有收成）。' },
    ],
    /* v55：旧的 `garrisonMul: 0.55`（守军整体下调）已删 ——
       它是旧公式 `20×2.4^lv×mul` 的系数，而那个公式整个被删了（与
       `DATA.WILD_DEFENSE` 逐级表是两个出口、且面板显示的数被它放大了 15 倍）。
       守军规模现在只有 `DATA.WILD_DEFENSE` 一个来源，要对齐原版就改那张表。 */
    /* 野地：**掠夺有资源，占领不给资源**（原版铁律 —— 掠夺得资源，占领得地盘。
       占领的价值在长期产量加成与采集权，而非一次性财货） */
    wildResMul: { scout: 0.15, raid: 1.2, occupy: 0 },
    wildMatMul: { scout: 0.35, raid: 1.6, occupy: 0.9 },   // 野地材料倍率（占领取地盘，不取财货）
    /* v60（需求 4/6）：**城池**的财货不再"凭档位凭空生成"，而是直接从该城
       `GAME.npcCityRes` 的派生库存里按比例取 —— 于是"侦查看到的库存"与
       "打完搬回来的战利品"必然对得上（同一份数据，一个出口）。
         · 掠夺：拿走 50%，城仍归守军（下次再掠，库存按派生值再生）；
         · 占领：**不取现财**（与"占领野地不取财货"同一铁律），
           但城池连同剩余库藏一起归你 —— 见 cityInherit。 */
    cityResMul: { raid: 0.5, occupy: 0 },
    cityInherit: 1.0,                               /* v89.81（老板「为什么库藏只有这么点」）：
        0.8 → **1.0**。原 0.8 与文案「攻占后库藏**尽归**我有」直接矛盾 ——
        玩家在侦查公文/城池界面看到的库存，与真正入库的数差两成，属于"实现偏离文案"。
        掠夺（0.5，且城仍归守军）已经承担了"只取部分"的角色，占领就该是全拿。 */
    cityMatMul: { raid: 1.35, occupy: 1.0 },
    jewelChance: { raid: 0.75, occupy: 0.5 },
    woundedRate: 0.45,                              // 伤兵回收率（原 0.30）
    scoutLoot: { minKinds: 1, maxKinds: 2 },        // 侦查顺手所得的种类数
    /* ---- 行军（v18）----
       出征不再瞬间抵达：1 格 = marchSecPerTile 游戏秒 ÷ 速度系数。
       注意 DATA.TROOPS 的 spd 在 100~1000 量级（义兵 200 / 刀盾 275 / 投石车 100 / 轻骑 1000），
       故用 marchBaseSpeed 归一 —— 取 300 使标准步卒系数 ≈ 1.0。
       · 10 格 ≈ 5 现实秒（120× 倍率）· 50 格 ≈ 25 秒
       · 带投石车会明显拖慢（最慢兵种决定全军速度） */
    marchSecPerTile: 60,
    marchBaseSpeed: 300,
    marchMinRealSec: 2,                             // 再近也走满 2 现实秒，否则队列一闪而过
  };

  /* ------------------------------------------------------------
   * 三档城池掉落（v13）
   * 野外城池 → 一阶料   县城/郡城 → 二阶料
   * 州城 → 三阶料       都城 → 四阶料
   * 攻城战利品：图纸与成品的掉落率（按城类型）
   * ------------------------------------------------------------ */
  DATA.CITY_MATERIAL = {
    fort:    { fatie: [3, 7], songmu: [3, 7], cuge: [3, 7], heshi: [2, 5], mabu: [3, 7], shoujin: [2, 5] },
    county:  { jingtie: [4, 9], nanmu: [4, 9], xiaoge: [4, 9], qingyu: [3, 7], xijuan: [4, 9], niujin: [3, 7] },
    jun:     { jingtie: [8, 16], nanmu: [8, 16], xiaoge: [8, 16], qingyu: [6, 12], xijuan: [8, 16], niujin: [6, 12] },
    zhou:    { bintie: [6, 13], tanmu: [6, 13], xige: [6, 13], yangzhi: [5, 10], shujin: [6, 13], jiaojin: [5, 10] },
    capital: { yuntie: [6, 14], jianmu: [6, 14], jiaoge: [6, 14], kunshan: [5, 12], yunjin: [6, 14], longjin: [5, 12] },
  };
  DATA.LOOT_EQUIP = {
    fort:    { blueprint: 0.04, piece: 0.10, q: [1, 1], matStack: 0.85 },
    county:  { blueprint: 0.10, piece: 0.22, q: [1, 2], matStack: 1.0 },
    jun:     { blueprint: 0.18, piece: 0.25, q: [1, 2], matStack: 1.0 },
    zhou:    { blueprint: 0.40, piece: 0.55, q: [2, 3], matStack: 1.2 },
    capital: { blueprint: 0.80, piece: 0.90, q: [3, 4], matStack: 1.5 },
  };

  /* ============================================================
   * 任务 —— ⛔ 本文件不再定义 `DATA.QUESTS`（v89.134 移除旧版 q1..q8）
   * ------------------------------------------------------------
   * 任务目录的**唯一来源是 questdata.js**（成长型 g01.. 带 metric/goal、
   * 随机型 RANDOM_QUESTS、类型表；加载顺序在本文件之后）。
   * 本处旧表（q1..q8 · type/target 结构）存在期间一直被 questdata.js
   * **静默覆盖** —— 是"改这里不生效"的陷阱，故删除。改任务请只改
   * js/questdata.js。 */

  /* ---------------- 头像 ---------------- */
  DATA.AVATARS = {
    male: ['🧔', '👨', '🧑‍🦱', '👨‍🦰', '🧙‍♂️', '🏹', '⚔️', '🐎'],
    female: ['👩', '👩‍🦰', '🧕', '👸', '💃', '🌸', '🗡️'],
  };

  /* ---------------- 初始状态 ---------------- */
  DATA.INITIAL_RES = { grain: 20000, wood: 20000, stone: 20000, iron: 20000, gold: 20000, pop: 200 };
  DATA.INITIAL_BUILDINGS = ['minfang', 'minfang', 'guanfu'];
  /* 首城外城初始模板（v89.134 接线：state.makeExtGrid 读本表；
     与 `NEW_CITY_EXT` 同构 —— 都是「类型数组」，顺序即地块序）。 */
  DATA.INITIAL_EXT = ['farm', 'farm', 'forest', 'quarry', 'mine']; // 2田1木1石1铁
  DATA.INITIAL_ITEMS = { shennongchu: 1, mojia_canjuan: 2, zhenzhu: 5 };
  DATA.INITIAL_EQUIP = ['yt_free1', 'yt_free2', 'yt_free3'];

  /* ============================================================
   * 趣味系统 · 叙事层（v6）
   * 羁绊 / 天时 / 史书纪事 / 奇遇秘境 / 称号
   * 文案取《三国志》纪传体，典故均有史实出处
   * ============================================================ */

  /* ---------------- ① 名将羁绊（纯正面加成 · 完全后台运行 · 界面不提示） ----------------
   * 组合是否达成由 systems 后台判定，加成静默并入各项数值，不在任何面板列出。
   * bonus 键：atk 攻击 / def 防御 / siege 攻城 / research 研究 / lead 带兵
   *           hearts 民心每小时 / cityDef 城防
   * ------------------------------------------------------------ */
  DATA.BONDS = [
    {
      id: 'taoyuan', name: '桃园结义', members: ['刘备', '关羽', '张飞'],
      bonus: { atk: 0.20, def: 0.20 }, effect: '全军攻击 +20%、防御 +20%',
      lore: '三人于涿郡桃园结义，誓以同死。食则同器，寝则同床。',
    },
    {
      id: 'wuhu', name: '五虎上将', members: ['关羽', '张飞', '赵云', '马超', '黄忠'],
      bonus: { lead: 0.50, atk: 0.15 }, effect: '带兵上限 +50%、攻击 +15%',
      lore: '先主定益州，拜关张马黄赵为五虎上将，咸为爪牙。',
    },
    {
      id: 'hujiang3', name: '虎将三人', members: ['关羽', '张飞', '赵云'],
      bonus: { lead: 0.20 }, effect: '带兵上限 +20%',
      lore: '关张赵三人并为爪牙，敌不敢犯。',
    },
    {
      id: 'jiangdong', name: '江东三世', members: ['孙坚', '孙策', '孙权'],
      bonus: { hearts: 10, lead: 0.15 }, effect: '民心每小时 +10、带兵上限 +15%',
      lore: '孙氏三世据江东，人民附之如水归下。',
    },
    {
      id: 'junshi', name: '谋主辅弼', members: ['诸葛亮', '徐庶'],
      bonus: { research: 1.00 }, effect: '研究速度 +100%',
      lore: '徐庶走马荐诸葛，曰：此人有经天纬地之才。',
    },
    {
      id: 'huchi', name: '虎痴恶来', members: ['典韦', '许褚'],
      bonus: { cityDef: 0.30, def: 0.15 }, effect: '城防 +30%、防御 +15%',
      lore: '典韦号古之恶来，许褚号虎痴，皆先登陷阵，为主爪牙。',
    },
    {
      id: 'caowei', name: '曹魏股肱', members: ['曹操', '司马懿', '贾诩'],
      bonus: { research: 0.40, atk: 0.10 }, effect: '研究速度 +40%、攻击 +10%',
      lore: '魏武用谋士如用己臂，故能横行天下。',
    },
    {
      id: 'baiyi', name: '白衣渡江', members: ['吕蒙', '陆逊'],
      bonus: { siege: 0.35 }, effect: '攻城伤害 +35%',
      lore: '吕蒙白衣摇橹，尽伏精兵于舟中，遂克荆州。',
    },
    {
      id: 'longzhong', name: '隆中一对', members: ['刘备', '诸葛亮'],
      bonus: { research: 0.50, lead: 0.10 }, effect: '研究速度 +50%、带兵上限 +10%',
      lore: '先主三顾草庐，亮为画三分之计。',
    },
    {
      id: 'jiangbiao', name: '江表虎臣', members: ['孙策', '周瑜'],
      bonus: { atk: 0.18, siege: 0.15 }, effect: '攻击 +18%、攻城 +15%',
      lore: '策与瑜同年，相友善，推分结义，共定江东。',
    },
    {
      id: 'hebei', name: '河北双雄', members: ['袁绍', '张辽'],
      bonus: { def: 0.15, cityDef: 0.15 }, effect: '防御 +15%、城防 +15%',
      lore: '绍据河北，辽为其爪牙，后归魏武，终为名将。',
    },
  ];

  /* ---------------- ② 天时：四季 + 天气 ---------------- */
  DATA.SEASONS = [
    { id: 'spring', name: '春', desc: '春耕之时，粮产略增', grain: 0.10 },
    { id: 'summer', name: '夏', desc: '夏日方长，粮产更盛', grain: 0.15 },
    { id: 'autumn', name: '秋', desc: '秋收之际，粮产最丰', grain: 0.25 },
    { id: 'winter', name: '冬', desc: '冬寒地冻，粮产锐减', grain: -0.35 },
  ];
  DATA.WEATHERS = {
    clear: { id: 'clear', name: '晴', icon: '☀', grain: 0.00, fire: 1, ambush: 1, move: 1.00, weight: 40, desc: '天朗气清，诸事如常' },
    rain: { id: 'rain', name: '雨', icon: '🌧', grain: -0.15, archerRange: -0.20, fire: 0, ambush: 1.2, move: 0.80, weight: 25, desc: '霖雨不止：粮产 −15%，弓兵射程 −20%，火攻失效，行军 −20%' },
    snow: { id: 'snow', name: '雪', icon: '❄', grain: -0.30, fire: 0, ambush: 1, move: 0.50, weight: 12, desc: '大雪封道：粮产 −30%，行军 −50%，火攻失效' },
    fog: { id: 'fog', name: '雾', icon: '🌫', scout: false, ambush: 2.0, move: 0.70, weight: 13, desc: '大雾弥天：斥候难察敌情，行军 −30%，然偷袭伤害 ×2' },
    wind: { id: 'wind', name: '大风', icon: '💨', fire: 3, move: 1.10, weight: 10, desc: '风急天高：火攻威力 ×3，行军 +10%' },
  };

  /* ---------------- ③ 史书纪事（记账式 · 非事件选项） ----------------
   * 机制：后台按里程碑 + 定期快照，自动把当前状态记成《三国志》式条目。
   * 不弹窗、不打断，只写入史册供回看。
   * 占位符：{era}年号 {yy}年序 {season}季 {lord}君主 {city}主城
   *         {cities}城数 {army}兵力 {heroes}名将数 {pop}人口
   *         {buildings}建筑数 {grain}粮食 {gold}黄金
   * cond 支持：govLevel 官府等级 / army 兵力 / heroes 名将数 / cities 城数
   *           buildings 建筑数 / pop 人口 / rep 声望 / always
   * ------------------------------------------------------------ */
  DATA.CHRONICLE_RULES = [
    { id: 'found', once: true, prio: 100, cond: { always: true },
      t: '{era}{yy}，{lord}起于草莽，筑城于{city}之野，始有居人。' },
    { id: 'gov2', once: true, prio: 40, cond: { govLevel: 2 },
      t: '{era}{yy}{season}，官府修至二级，政令始行于境内。' },
    { id: 'gov4', once: true, prio: 50, cond: { govLevel: 4 },
      t: '{era}{yy}{season}，城池日广，市肆渐兴，四方商旅稍稍而至。' },
    { id: 'gov6', once: true, prio: 60, cond: { govLevel: 6 },
      t: '{era}{yy}{season}，官府益修，仓廪充实，流民归者日众。' },
    { id: 'gov8', once: true, prio: 70, cond: { govLevel: 8 },
      t: '{era}{yy}{season}，城郭完固，甲兵足用，隐然为一方之镇。' },
    { id: 'gov10', once: true, prio: 85, cond: { govLevel: 10 },
      t: '{era}{yy}{season}，官府极盛，百工具举，境内大治。' },
    { id: 'b6', once: true, prio: 30, cond: { buildings: 6 },
      t: '{era}{yy}{season}，城内屋舍增至六所，民居渐稠。' },
    { id: 'b12', once: true, prio: 45, cond: { buildings: 12 },
      t: '{era}{yy}{season}，城内营造十有二所，市里相连。' },
    { id: 'b20', once: true, prio: 60, cond: { buildings: 20 },
      t: '{era}{yy}{season}，城中有屋舍二十所，俨然都会之象。' },
    { id: 'army1k', once: true, prio: 50, cond: { army: 1000 },
      t: '{era}{yy}{season}，募兵千余，军容粗备。' },
    { id: 'army10k', once: true, prio: 70, cond: { army: 10000 },
      t: '{era}{yy}{season}，众至万余，旌旗蔽野，鼓行而前。' },
    { id: 'army50k', once: true, prio: 90, cond: { army: 50000 },
      t: '{era}{yy}{season}，甲士五万，粮秣山积，远近莫敢当者。' },
    { id: 'hero3', once: true, prio: 65, cond: { heroes: 3 },
      t: '{era}{yy}{season}，贤者渐集，帐下得{heroes}人，皆一时之选。' },
    { id: 'hero8', once: true, prio: 75, cond: { heroes: 8 },
      t: '{era}{yy}{season}，文武辐辏，帐下{heroes}人，谋士如云，猛将如雨。' },
    { id: 'pop10k', once: true, prio: 40, cond: { pop: 10000 },
      t: '{era}{yy}{season}，户口逾万，鸡犬相闻。' },
    { id: 'pop50k', once: true, prio: 60, cond: { pop: 50000 },
      t: '{era}{yy}{season}，编户五万，田野尽辟。' },
    { id: 'rep1k', once: true, prio: 45, cond: { rep: 1000 },
      t: '{era}{yy}{season}，{lord}之名闻于诸侯，四方之士多有至者。' },
    { id: 'rep10k', once: true, prio: 70, cond: { rep: 10000 },
      t: '{era}{yy}{season}，声名播于四海，天下莫不闻{lord}之名。' },
    /* 定期快照：即使无里程碑，也逐年留一笔，使史册连贯 */
    { id: 'annual', repeat: true, prio: 5, cond: { always: true }, onlyNewYear: true,
      t: '{era}{yy}{season}，城{cities}座，甲兵{army}，将领{heroes}人，粟{grain}石，金{gold}斤。' },
  ];

  /* ---------------- ③b 年号纪元（赛季制 · 取汉末魏初真实年号） ----------------
   * 一个年号 = 一个"时代"，持续若干游戏年。进入新时代时立「时代之志」，
   * 达成给赏；未达成亦不罚，只作史书一笔。
   * 待补：各时代的专属增益（boon）与目标数值可按史实进一步细化。
   * ------------------------------------------------------------ */
  DATA.ERAS = [
    { id: 'jianan', name: '建安', years: 12, desc: '汉祚将倾，群雄并起。',
      goal: { type: 'buildings', n: 8, text: '营建八所屋舍' },
      boon: { prod: 0.10, text: '百废待兴：全资源产量 +10%' } },
    { id: 'yankang', name: '延康', years: 3, desc: '魏将代汉，天命有归。',
      goal: { type: 'heroes', n: 4, text: '帐下得四将' },
      boon: { rep_gain: 0.20, text: '人心思附：声望获取 +20%' } },
    { id: 'huangchu', name: '黄初', years: 8, desc: '魏室初立，制度维新。',
      goal: { type: 'army', n: 8000, text: '养兵八千' },
      boon: { train: 0.15, text: '制度维新：训练速度 +15%' } },
    { id: 'taihe', name: '太和', years: 8, desc: '四夷宾服，府库充溢。',
      goal: { type: 'govLevel', n: 6, text: '官府修至六级' },
      boon: { prod: 0.15, text: '府库充溢：全资源产量 +15%' } },
    { id: 'qinglong', name: '青龙', years: 6, desc: '宫室大兴，龙见井中。',
      goal: { type: 'cities', n: 2, text: '据城池二座' },
      boon: { siege: 0.20, text: '大兴土木：攻城伤害 +20%' } },
    { id: 'jingchu', name: '景初', years: 4, desc: '海内稍安，民乐其业。',
      goal: { type: 'pop', n: 30000, text: '编户三万' },
      boon: { hearts: 6, text: '民乐其业：民心每小时 +6' } },
    { id: 'zhengshi', name: '正始', years: 10, desc: '玄学大兴，士人慕清谈。',
      goal: { type: 'techTotal', n: 12, text: '研成科技十二级' },
      boon: { research: 0.25, text: '学风流被：研究速度 +25%' } },
    { id: 'jiaping', name: '嘉平', years: 6, desc: '权臣当国，主少国疑。',
      goal: { type: 'rep', n: 20000, text: '声望至二万' },
      boon: { gold: 0.20, text: '权倾朝野：黄金收入 +20%' } },
    { id: 'zhengyuan', name: '正元', years: 4, desc: '兵戈屡兴，战事不休。',
      goal: { type: 'army', n: 30000, text: '甲兵三万' },
      boon: { atk: 0.15, text: '兵戈屡兴：全军攻击 +15%' } },
    { id: 'ganlu', name: '甘露', years: 6, desc: '祥瑞屡降，天下向治。',
      goal: { type: 'hearts', n: 90, text: '民心上九十' },
      boon: { hearts: 8, text: '祥瑞降：民心每小时 +8' } },
    { id: 'jingyuan', name: '景元', years: 6, desc: '大将西征，蜀土震动。',
      goal: { type: 'cities', n: 5, text: '据城池五座' },
      boon: { siege: 0.30, text: '大将西征：攻城伤害 +30%' } },
    { id: 'xianxi', name: '咸熙', years: 4, desc: '晋将代魏，一统有期。',
      goal: { type: 'cities', n: 10, text: '据城池十座' },
      boon: { prod: 0.25, text: '一统有期：全资源产量 +25%' } },
  ];

  /* ---------------- ③c 时间历法（1 游戏年 = 8 现实分钟 @120×） ---------------- */
  DATA.CALENDAR = {
    secPerYear: 57600,          // 游戏秒/年（= 480 现实秒 @120×）
    seasonsPerYear: 4,
    chronicleEverySeason: true, // 每季检查一次里程碑
  };

  /* ---------------- ③d 资源→战力折算（评估家底与时代目标） ---------------- */
  DATA.POWER = {
    /* 单兵基础战力权重（按兵种属性归一） */
    troopWeight: { hp: 0.004, atk: 0.60, def: 0.40, spd: 0.02 },
    /* 资源折合"可动员战力"：各类资源按募兵成本折算成可养兵力 */
    /* 以义兵单位成本(粮240/木100/铁50 · v89.36 募兵耗粮 ×3)为基准，
       除以资源种类数做加权平均，使"可动员战力"贴近实际能养多少兵，避免高估 */
    resToTroop: { grain: 1 / 720, wood: 1 / 300, iron: 1 / 150, stone: 1 / 500, gold: 1 / 400 },
    /* 建筑与科技的战力系数 */
    buildingBonus: 0.01,        // 每座建筑 +1%
    techBonus: 0.02,            // 每级科技 +2%
  };

  /* ---------------- ④ 奇遇秘境（探索野地时低概率触发） ---------------- */
  /* ---------------- ④ 奇遇秘境（探索野地时低概率触发） ---------------- */
  DATA.ENCOUNTERS = [
    { id: 'ruin', tier: 'ruin', name: '古垒遗址', weight: 60,
      text: '斥候回报：荒野之中有古垒残垣，为前朝屯兵之所，地下或有余粮。',
      reward: { res: { grain: 5000, wood: 3000, stone: 3000 } } },
    { id: 'well', tier: 'ruin', name: '废井', weight: 50,
      text: '有废井一口，深不可测。投石其中，声闻良久乃止。',
      reward: { res: { iron: 2500, gold: 1500 } } },
    { id: 'shrine', tier: 'ruin', name: '荒祠', weight: 45,
      text: '道旁有荒祠，塑像剥落，不知其所祀。案上残香犹温。',
      reward: { hearts: 6, rep: 60 } },
    { id: 'tomb_mid', tier: 'tomb', name: '古冢', weight: 30,
      text: '掘得一古冢，砖石皆汉制，墓门刻云气纹。内无棺椁，唯见兵甲图书。',
      reward: { item: 'mojia_canjuan', count: 2, rep: 120 } },
    { id: 'tomb_jiang', tier: 'tomb', name: '将军墓', weight: 22,
      text: '土人言此地昔为战没将军之葬所。掘之，得断戟一柄，锈迹斑斓，犹可辨认铭文。',
      reward: { item: 'xianzhenzhangu', count: 1, rep: 200 } },
    { id: 'tomb_book', tier: 'tomb', name: '故府藏书', weight: 20,
      text: '有故府倾圮，梁木之下得竹简数束，虽朽蠹过半，尚可辨读。',
      reward: { tech: 2, rep: 150 } },
    { id: 'secret_horse', tier: 'secret', name: '龙种', weight: 6,
      text: '深山溪畔，有马独立，色如渥丹，见人不惊。土人云：此龙种也，百年一出。',
      reward: { item: 'jixingjunling', count: 3, rep: 400 } },
    { id: 'secret_hero', tier: 'secret', name: '隐者出山', weight: 5,
      text: '林中有草庐，庐中人自云避乱于此二十年。与之语，于兵法政理无所不通。闻我将兴，愿出而佐之。',
      reward: { hero: 2, rep: 500 } },
    { id: 'secret_weapon', tier: 'secret', name: '神兵', weight: 4,
      text: '山涧之底，青气冲霄。掘之三尺，得一剑，削铁如泥，铭曰「孟德」。',
      reward: { item: 'hufu', count: 1, rep: 800, tech: 1 } },
  ];

  /* ---------------- ⑤ 称号评级（按顺序匹配，取首个满足者） ---------------- */
  DATA.TITLES = [
    { id: 'united', name: '扫六合', rank: 'SS', desc: '海内一统，宇内澄清。', cond: { minCities: 109 } },
    { id: 'hegemon', name: '霸主', rank: 'S', desc: '威震诸侯，天下莫敢先动。', cond: { minCities: 30 } },
    { id: 'kindlord', name: '仁德之君', rank: 'A', desc: '民附之如归市，仁声播于四海。', cond: { minCities: 8, minHearts: 85 } },
    { id: 'warlord', name: '乱世枭雄', rank: 'A', desc: '以诈力取天下，虽民有怨，而功业赫然。', cond: { minCities: 8, maxHearts: 55 } },
    { id: 'settler', name: '守成之主', rank: 'B', desc: '据城自守，仓廪充实，境内无虞。', cond: { minCities: 3, minHearts: 60 } },
    { id: 'local', name: '据守一隅', rank: 'B', desc: '偏居一方，未遑远略。', cond: { minCities: 2 } },
    { id: 'idle', name: '碌碌无为', rank: 'C', desc: '终岁经营，不出百里，府库虽盈而志不在天下。', cond: { minCities: 0 } },
  ];

  /* ---------------- 默认设置 ---------------- */
  /* ⛔ v89.134 移除：`DATA.ZOOM_LEVELS`（旧档位 chips 80..160）——
     v89.104 起缩放是**连续滑块**，唯一出口 ui.ZOOM_MIN / ui.ZOOM_MAX（80/120）。
     autoResearch 与自动建造同列（zoom = 显示比例 %）。 */
  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100,
    /* v89.93（整改 E4）：反馈层开关（入档）—— 音效默认开、音量 0.5；关掉即全静音 */
    sfx: false,   /* v89.104（老板「设置里不要音效」）：默认关（开关已从设置页撤除） */ sfxVol: 0.5,
    /* v89.86（整改 P-18）：自动化预算闸门 —— 每次消费后至少留下花前存量的 pct%；0 = 不设限 */
    autoReservePct: 5, autoTechMaxLv: 0,
    /* v89.86（整改 P-17）：离线推进上限（游戏日；0 = 不限）—— 超出部分五折折算资源/供奉 */
    offlineCapDays: 7,
    /* v89.87（老板需求 4）：战斗观战 —— 出征战斗抵达后进入战场界面，
       每回合 battleSec 真实秒（60 预设，可提前点「完成」结算）；false = 全自动 */
    battleWatch: true, battleSec: 60 };

  /* ============================================================
   * 界面主题（v39 · 需求 1）
   * ------------------------------------------------------------
   * 老板原话：「背景颜色太深了，整体调浅一点，或者整几个颜色模式，
   * 以护眼、适宜长时间玩耍为主」。
   *
   * 四套主题的**唯一名册** —— 名字与说明只在这里写一遍，
   * 设置页、toast、测试都从这张表读，不再各写一份。
   *   ink   墨玉：中性深灰蓝（默认）—— 比 v38 的整体底色提亮一档
   *   silk  素绢：暖米黄浅色，**底色不取纯白**（纯白反光强、长看刺眼）
   *   bamboo 青竹：浅青灰绿，对比最低，偏冷
   *   night 夜阑：近黑，夜间 / 暗房
   * 色值本体在 index.html 的「主题」CSS 块里（一处定义，全站生效）。
   * ============================================================ */
  DATA.THEMES = [
    { id: 'ink',    name: '墨玉',  light: false,
      desc: '中性深灰蓝。比旧版底色提亮一档，金色点缀最亮，默认。' },
    { id: 'silk',   name: '素绢',  light: true,
      desc: '暖米黄浅色。底不用纯白、正文压到中深褐，长看不累 —— 长玩首选。' },
    { id: 'bamboo', name: '青竹',  light: true,
      desc: '浅青灰绿。对比最低、偏冷，白天光线足时最舒服。' },
    { id: 'night',  name: '夜阑',  light: false,
      desc: '近黑。夜里或关灯玩时用，屏幕不刺眼。' }
  ];
  DATA.DEFAULT_SETTINGS.theme = 'ink';

  /* ============================================================
   * 建筑系列（v39 · 需求 2/3）—— **全站唯一的族归属与族色来源**
   * ------------------------------------------------------------
   * 老板反馈史（四轮，教训都在这）：
   *   v39    「建筑主色调都是黄色，区分度偏低」→ 按系列调色；
   *   v89.104「绿的绿，紫的紫，不美观」      → 全族收进 8°~68° 暖带；
   *   v89.106「还是有些城内建筑颜色很奇怪，而且没有区分度」→ 整幅旋色 + 暖带；
   *   v89.107「城内建筑颜色还是很不对劲」    → **查出真病根：图本身是单色的**。
   *
   * 硬证据（`asset/diag_bldg_materials.py`）：16 张原图的**图内色散只有 7°、
   * 有效色档 1.3 个** —— 也就是"单色剪影"。一张只有一个色相的图，
   * 染成什么颜色都只是"染过色的单色块"，所以前三轮怎么调都不对。
   *
   * v89.107 定稿 = **材质自然 + 族旗编码**（两条腿）：
   *   ① 材质：按素材管线的图集流程**重绘** 16 张（同轮廓、同机位，
   *      只换材质与颜色：灰瓦/白墙/木构/石基/琉璃瓦/夯土/草顶…），
   *      图内色散从 7° 提到 8~57°（平均 20°+）—— 建筑不再是"色块"；
   *   ② 族旗：每座建筑挂一面**小面积、传统色**的旗（燕尾旗），
   *      族色编码靠它（`asset/flag_bldg_icons.py` 画，色值就是下面的 `flag`）。
   *      为什么不用大面积染色：小面积高饱和 = 自然可辨（红幌子挂灰墙上是常态）；
   *      大面积染 = 材质失真（前三轮的病根）。
   *
   * `flag` 是族旗颜色：h 色相(度) · s 饱和(0~1) · l 明度(%)。
   *   这七个色在**传统色带内**寻优，两两 CIEDE2000 最小 **24.8**（>18 一眼可辨）；
   *   生产者：`asset/flag_bldg_icons.py`（先重绘、再画旗）；校验者：smoke。
   *   ⚠️ 改 flag 必须重跑：`python .workbuddy/tools/asset/flag_bldg_icons.py`
   *      否则数据与素材不一致（smoke 有断言当场拦下）。
   * ============================================================ */
  DATA.SERIES = {
    gov:   { name: '官署', tone: '金瓦朱柱 · 金旗',     flag: { h: 42,  s: 0.60, l: 51 } },
    live:  { name: '民居', tone: '白墙灰瓦 · 素旗',     flag: { h: 48,  s: 0.27, l: 87 } },
    store: { name: '仓廪', tone: '夯土褐瓦 · 赭旗',     flag: { h: 34,  s: 0.45, l: 28 } },
    edu:   { name: '文教', tone: '青碧琉璃 · 青旗',     flag: { h: 162, s: 0.48, l: 33 } },
    mil:   { name: '军事', tone: '黛蓝石构 · 靛旗',     flag: { h: 215, s: 0.52, l: 35 } },
    biz:   { name: '工商', tone: '赭红棚架 · 朱旗',     flag: { h: 5,   s: 0.54, l: 50 } },
    road:  { name: '驿传', tone: '米白青瓦 · 青灰旗',   flag: { h: 199, s: 0.29, l: 56 } }
  };
  /* 族 → 建筑反查（城墙 v89.106 归位：data.js 一向写 mil，旧工具表误写 gov，
     结果城墙被染成金色。反查表只此一处，工具与门禁都从这里读。） */
  DATA.SERIES_OF = {};
  Object.keys(DATA.BUILDINGS).forEach(function (bid) {
    var s = DATA.BUILDINGS[bid].series;
    if (!s) return;
    (DATA.SERIES_OF[s] = DATA.SERIES_OF[s] || []).push(bid);
  });

  /* ============================================================
   * 公文类别（v89.107 · 老板：「公文有几种报告类型，按军务那样整几个独立切换界面」）
   * ------------------------------------------------------------
   * 本表 = **唯一来源**：
   *   · 公文页签的名称 / 图标 / 顺序（ui.docTabHTML 直接读它，加一行就多一个页签）；
   *   · 消息类别的合法值域（`GAME.log(msg, kind)` 的第二参数必须是这里的 id）。
   *
   * 类别在**发射点声明**，不做"按文本猜"——实测把 140 个发射点的文案跑了一遍：
   * 大量消息是拼出来的（`'' + head + '：' + bits`），文本判据只覆盖一半，
   * 猜不准的分类等于没有分类。所以：谁发消息谁声明；没声明的落 sys（系统消息）。
   * 旧档（本版之前写的记录没有 k）由 `GAME.msgKindOf` 兜底，只为老档看得见。
   * ============================================================ */
  /* v89.116（老板）：「公文里不要烽火这个板块，烽火相关流水已经存在于军务的烽火中」
     —— 类别表加 `doc:false`（**不进公文页签**，但仍是合法类别）：
     烽火消息照旧按 beacon 归档、照旧在「军务 · 烽火」的流水里列全 ——
     只是公文不再给它一个页签（同一批消息两处入口 = 两处读数）。 */
  DATA.MSG_KINDS = [
    { id: 'war',    name: '战报', icon: '⚔️', desc: '出征 / 攻城 / 行军 / 调防 / 缴获 —— 战报列表 + 军事流水' },
    { id: 'scout',  name: '侦查', icon: '🔭', desc: '侦查回报：守军 / 守将 / 库藏 / 布防（按侦察技巧分层解锁）' },
    { id: 'beacon', name: '烽火', icon: '🔥', doc: false,
      desc: '预警与来袭：犯境预警 / 击退或被破 / 防守计（**流水在军务 · 烽火**，不在公文）' },
    { id: 'task',   name: '任务', icon: '📜', desc: '任务完成 / 随机任务 / 时代之志与改元' },
    { id: 'sys',    name: '系统', icon: '📣', desc: '内政 / 经济 / 建设 / 江湖与其余提示' }
  ];
  /* 战报保留上限（v89.107：原来硬编码 60 写在 battle.js **两处**，
     且"收藏"的战报也会被一并挤掉 —— 收藏的意思就是"点名要留"）。
     现在：上限一处可调，挤掉时**跳过收藏**。 */
  DATA.REPORT_MAX = 60;
  DATA.MSG_KIND_BY = {};
  DATA.MSG_KINDS.forEach(function (k) { DATA.MSG_KIND_BY[k.id] = k; });

  /* ============================================================
   * v86（老板「按计划进行」· 第四轮 G1）：计谋 / 锦囊
   * ------------------------------------------------------------
   * 八计三门：
   *   · attack（出征携带）—— 妖言惑众 / 火烧粮草 / 挑拨离间 / 趁火打劫
   *   · march （出征携带）—— 千里奔袭 / 金蝉脱壳
   *   · defense（城池布防）—— 空城计 / 坚壁清野
   * 效果**全部作用于战斗/入侵结算的入参**（不改战斗引擎）：
   *   见 battle.js expedition 段 与 state.js invasion 段。
   * 消耗 = 精力（已有链）+ 锦囊（type:'talis'，商城可购）。
   * 唯一出口组：GAME.schemeOf / schemeKeyOf / schemePrepare / schemeUse /
   *   schemeMarksOf / schemeDefOf / schemeDefSet / schemeDefConsume（state.js）。
   * ⚠️ 每个 eff 的键都必须在 js/ 里有**字面读取点**（smoke §71 有断言守；
   *    写进表而无消费 = 死数据，是本项目的经典失效模式）。
   * ============================================================ */
  DATA.SCHEMES = [
    { id: 'yaoyan', name: '妖言惑众', icon: '🗣️', kind: 'attack', jinang: 2, energy: 12,
      eff: { guardPct: -0.15 },
      tip: '目标守军规模 −15%（流言四起，守卒逃散）' },
    { id: 'huoshao', name: '火烧粮草', icon: '🔥', kind: 'attack', jinang: 2, energy: 14,
      eff: { defCut: 0.30 },
      tip: '目标城防值 −30%（夜焚敌仓，守备懈怠）' },
    { id: 'tiaobo', name: '挑拨离间', icon: '🕸️', kind: 'attack', jinang: 3, energy: 18,
      eff: { loyaltyDrop: 25, faintAt: 50, joinAt: 25, joinChance: 0.5 },
      tip: '守将忠诚 −25（对同一城每日限一次）；忠诚 ≤50 时其加成减半，≤25 时战胜后 50% 归降' },
    { id: 'chenhuo', name: '趁火打劫', icon: '💰', kind: 'attack', jinang: 1, energy: 10,
      eff: { lootPct: 0.30 },
      tip: '本战掠夺资源 +30%（乘乱取利）' },
    { id: 'benxi', name: '千里奔袭', icon: '💨', kind: 'march', jinang: 2, energy: 15,
      eff: { marchPct: 0.30 },
      tip: '本次行军速度 +30%（轻装疾行）' },
    { id: 'jintui', name: '金蝉脱壳', icon: '🦗', kind: 'march', jinang: 1, energy: 8,
      eff: { woundedKeep: 0.35 },
      tip: '若战败，额外保全 35% 兵力（阵亡转伤兵）' },
    { id: 'kongcheng', name: '空城计', icon: '🎭', kind: 'defense', jinang: 2, energy: 10, durH: 6,
      eff: { invSkip: 1 },
      tip: '布防 6 小时：期间下一次来犯之敌不战而退' },
    { id: 'jianbi', name: '坚壁清野', icon: '🏜️', kind: 'defense', jinang: 2, energy: 12, durH: 8,
      eff: { invLossCut: 0.40 },
      tip: '布防 8 小时：期间遭来犯时的损失 −40%' },
  ];

  /* v87「野地专属场景」-> v88.1 整合：
     六地形场景（绿林探访/垂钓/寻宝/地宫/狩猎/牧马）已并入 DATA.LING_ACT
     （<terrain>_scene，kind: 'scene'）——统一走「江湖游历」入口与 s.jianghu
     每日锁；原 DATA.WILD_SCENES 表 / GAME.wildScene* / ui.wildSceneHTML 全部删除。 */

  /* ============================================================
   * v88（老板「修炼型装备系统」）：灵气装备 · 江湖游历
   * ------------------------------------------------------------
   * 双轨之一 —— 「修炼装备」侧（军装=煞气侧不动）：
   *   · 与军装**共用 DATA.EQUIP 表**（eqId -> DATA.EQUIP 是全站唯一寻址，
   *     共用即全部下游零改动），以 ling: true 标记归属；
   *     槽位与军装同 12 部位（界面与交互一致的根基），术语江湖化。
   *   · 六维约等于军装同级 x0.75（作战略逊，不撼动军装主战力）；
   *     lingv（灵力）只用于「江湖游历」判定 —— 不进六维、不入战斗公式。
   *   · 蕴养（强化）走 LING_TEMPER（灵气精华），与军装百炼（ENHANCE）独立。
   * 双轨切换：g.equipOn = 'sha' | 'ling'（缺省 sha，老档零迁移）；
   *   分流唯一出口 systems.equipBagOf -> genEquipBonus（下游全自动同步）。
   * ============================================================ */
  DATA.LING_SLOT_NAMES = {
    head: '道冠', neck: '璎珞', shoulder: '云肩', chest: '道袍', back: '灵帔',
    waist: '灵带', arm: '护腕', feet: '云履', ring: '灵戒', pendant: '玉佩',
    weapon: '灵剑', mount: '灵骑',
  };
  /* 六阶（对齐 6 品质色：灰白蓝紫橙红）—— 名称取自「器物何以成道」之序 */
  DATA.LING_Q_NAME = { 1: '灵胚', 2: '灵器', 3: '法器', 4: '宝器', 5: '灵宝', 6: '道器' };
  /* 单件灵力基准 / 单件体力（6 阶） */
  DATA.LING_LING = [10, 25, 60, 130, 280, 600];
  DATA.LING_STA = [40, 100, 200, 370, 620, 1020];
  /* 12 部位 x 6 阶散件（脚本生成）。主属性值 = 军装同级精神的 75% 量级，
     4 阶武器 420 对齐军装珍品 558 x 0.75 = 419。数值待实测定。 */
  DATA.LING_SLOTS = [
    { id: 'weapon',   names: ['朽木剑', '青锋剑', '流云剑', '赤霄剑', '太阿剑', '轩辕剑'],       stat: 'atk', v: [50, 120, 230, 420, 710, 1090] },
    { id: 'head',     names: ['布巾冠', '青玉冠', '紫金冠', '七星冠', '流云冠', '太清冠'],       stat: 'def', v: [45, 105, 210, 385, 650, 1000] },
    { id: 'chest',    names: ['粗布袍', '青衿袍', '紫霞袍', '八卦袍', '玄天袍', '无量袍'],       stat: 'def', v: [63, 145, 290, 525, 895, 1365] },
    { id: 'shoulder', names: ['素云肩', '青云肩', '紫云肩', '金丝云肩', '流云肩', '九霄肩'],     stat: 'def', v: [45, 105, 210, 385, 650, 1000] },
    { id: 'arm',      names: ['麻护腕', '皮护腕', '铁护腕', '银丝护腕', '玄铁护腕', '天蚕护腕'], stat: 'def', v: [42, 96, 192, 356, 600, 924] },
    { id: 'waist',    names: ['麻绳带', '青绦带', '紫绶带', '玉带', '蟠龙带', '捆仙带'],         stat: 'def', v: [42, 96, 192, 356, 600, 924] },
    { id: 'feet',     names: ['草履', '青布履', '云纹履', '踏云履', '凌波履', '御风履'],         stat: 'spd', v: [3, 7, 13, 23, 38, 62] },
    { id: 'neck',     names: ['石坠', '玉珠璎珞', '珊瑚璎珞', '琥珀璎珞', '明珠璎珞', '星辰璎珞'], stat: 'tong', v: [6, 14, 28, 50, 85, 130] },
    { id: 'ring',     names: ['铜戒', '银戒', '玉戒', '玄玉戒', '龙纹戒', '须弥戒'],             stat: 'tong', v: [6, 14, 28, 50, 85, 130] },
    { id: 'pendant',  names: ['木牌', '青玉佩', '白玉佩', '龙凤佩', '灵犀佩', '昆仑佩'],         stat: 'zm', v: [6, 14, 28, 50, 85, 130] },
    { id: 'back',     names: ['布帔', '青纱帔', '云锦帔', '紫霞帔', '流光彩帔', '天罗帔'],       stat: 'zm', v: [6, 14, 28, 50, 85, 130] },
    { id: 'mount',    names: ['小驴', '青骢马', '白马', '照夜玉狮子', '赤兔', '的卢'],           stat: 'spd', v: [5, 12, 22, 40, 66, 108] },
  ];
  (function () {
    DATA.LING_SLOTS.forEach(function (sl) {
      for (var q = 1; q <= 6; q++) {
        var id = 'lg_' + sl.id + '_' + q;
        if (DATA.EQUIP[id]) continue;
        var it = { id: id, name: (sl.names && sl.names[q - 1]) || ('灵器' + sl.id), slot: sl.id,
          q: q, ling: true, lingv: DATA.LING_LING[q - 1], sta: DATA.LING_STA[q - 1] };
        it[sl.stat] = sl.v[q - 1];
        DATA.EQUIP[id] = it;
      }
    });
  })();
  /* 蕴养（修炼侧的强化）：+10 上限 / 每级 +8% / 消耗灵气精华。
     第 n 级成本 = essBase + (n+1) x essPerLv（+1 级 20 ... +10 级 110，累计 650）。
     产出一日 100~200 精华（3-4 次游历）—— 一件 0 到 +10 约 4~6 天。 */
  DATA.LING_TEMPER = { max: 10, perLv: 0.08, essBase: 10, essPerLv: 10 };

  /* --------- 江湖游历活动（MVP 6 项；判定与产出全数据驱动） ---------
     kind: fight(灵力判定) / trial(多层) / gather(抽取) / cultivate(稳定) / visit(事件)
     spots: 可发生的地形（对齐设计 §3.4 地形 x 活动矩阵） */
  DATA.LING_ACT = {
    tao: { name: '讨伐', cat: '征伐', alias: '拔寨擒王', kind: 'fight', icon: '⚔️', energy: 15, stam: 6, power: 200, drop: 0.05,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [30, 50] }, lose: { wound: 8, ess: [5, 10] },
      desc: '清剿野地贼寇妖兽：胜则灵材丰厚，败亦有所得（负伤而归）。' },
    qie: { name: '切磋', cat: '论武', alias: '以武会友', kind: 'fight', icon: '🤝', energy: 10, stam: 4, power: 100, drop: 0.03,
      spots: ['hill', 'desert', 'caoyuan'],
      win: { ess: [15, 25] }, lose: { wound: 3, ess: [8, 12] },
      desc: '与江湖武人对练：无论胜负必有所悟（心得保底）。' },
    shi: { name: '试炼', cat: '试炼', alias: '石门三重', kind: 'trial', icon: '🗿', energy: 18, stam: 7, power: 320, drop: 0.15,
      spots: ['hill', 'forest', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [45, 75] }, lose: { wound: 10, ess: [10, 18] },
      desc: '古阵试炼共三层逐层加码：见好就收，或再进一层。' },
    cai: { name: '采集', cat: '采撷', alias: '采灵撷芳', kind: 'gather', icon: '🌿', energy: 8, stam: 3,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [20, 35] },
      desc: '采灵草、撷灵矿、拾灵菌：灵气精华入袋，偶有双收。' },
    xiu: { name: '修炼', cat: '修真', alias: '吐纳周天', kind: 'cultivate', icon: '🧘', energy: 12, stam: 5,
      spots: ['forest', 'lake'],
      win: { ess: [35, 55] },
      desc: '择灵气葱郁处打坐聚气：精华稳定入体，小概率「悟道时刻」。' },
    bai: { name: '拜访', cat: '访贤', alias: '柴扉清谈', kind: 'visit', icon: '🏡', energy: 8, stam: 2,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [10, 20] },
      desc: '拜访隐士奇人：一段小故事，一份小赠礼。' },
    /* ---- 地形专属（v87「野地专属场景」-> v88.1 整合：从 WILD_SCENES 原样并入） ----
       kind: 'scene' —— 每地形一条「招牌」，与通用活动同走江湖游历入口 / s.jianghu 每日锁；
       产出保持军装经济侧（金/粮/材料/珠宝/道具/豪杰），与活动的灵气精华产出并行不悖。 */
    hill_scene: { name: '绿林探访', cat: '绿林', alias: '山道会盟', kind: 'scene', icon: '⚔️', energy: 12, stam: 4,
      spots: ['hill'],
      desc: '入山访豪杰：或得好汉相赠，或得豪杰来投，或遇剪径强人负伤而归。',
      outcomes: [
        { w: 30, t: '山寨好汉赠金', gold: [800, 2400] },
        { w: 24, t: '搜得山寨存货', mats: [1, 2] },
        { w: 12, t: '豪杰相投（得在野将领）', hero: 1 },
        { w: 12, t: '得珠宝一颗', jewel: 1 },
        { w: 22, t: '遇剪径强人，负伤而归', wound: 6 },
      ] },
    lake_scene: { name: '临湖垂钓', cat: '垂纶', alias: '金鳞之约', kind: 'scene', icon: '🎣', energy: 6, stam: 2,
      spots: ['lake'],
      desc: '泽畔垂纶：灵鲤入篓充作军粮，偶得水中沉物。',
      outcomes: [
        { w: 44, t: '灵鲤入篓（充粮）', grain: [800, 2000] },
        { w: 22, t: '小鲤数尾', grain: [200, 600] },
        { w: 12, t: '网得沉物（锦囊）', item: 'jinang' },
        { w: 8, t: '得珠宝一颗', jewel: 1 },
        { w: 14, t: '空竿而归', none: 1 },
      ] },
    zhaoze_scene: { name: '沼泽寻宝', cat: '寻珍', alias: '瘴泽寻珍', kind: 'scene', icon: '🔍', energy: 14, stam: 5,
      spots: ['zhaoze'],
      desc: '探寻旧战场遗迹：宝物丰厚，瘴气伤身。',
      outcomes: [
        { w: 24, t: '掘得珍宝', jewel: { n: [1, 2] } },
        { w: 22, t: '拾获军资', mats: [1, 3] },
        { w: 18, t: '掘出旧钱', gold: [1500, 4000] },
        { w: 12, t: '得古朴木盒', item: 'chest_tong' },
        { w: 24, t: '瘴气侵体，负伤而归', wound: 8 },
      ] },
    desert_scene: { name: '地宫探险', cat: '探幽', alias: '古冢探幽', kind: 'scene', icon: '🏛️', energy: 20, stam: 8,
      spots: ['desert'],
      desc: '深入地下宫阙：三层遗藏一层比一层厚，险也一层比一层深。',
      outcomes: [
        { w: 30, t: '第一层便有所获', gold: [1500, 3500] },
        { w: 28, t: '第二层遗藏', mats: [2, 4] },
        { w: 16, t: '第三层秘宝（名将套图纸）', item: 'bp_mingjiang' },
        { w: 12, t: '探得珠宝', jewel: { n: [1, 3] } },
        { w: 14, t: '地宫塌方，负伤逃出', wound: 12 },
      ] },
    forest_scene: { name: '林中狩猎', cat: '行猎', alias: '林中逐鹿', kind: 'scene', icon: '🏹', energy: 8, stam: 3,
      spots: ['forest'],
      desc: '入林行猎：白鹿灵迹出没之地，皮毛灵材俱是军资，亦可得野味充粮。',
      outcomes: [
        { w: 42, t: '猎获灵兽皮毛', mats: [1, 2] },
        { w: 22, t: '猎得野味（充粮）', grain: [500, 1500] },
        { w: 14, t: '偶得失物（锦囊）', item: 'jinang' },
        { w: 22, t: '空手而归', none: 1 },
      ] },
    caoyuan_scene: { name: '草原牧马', cat: '牧驹', alias: '草原驯驹', kind: 'scene', icon: '🐎', energy: 10, stam: 4,
      spots: ['caoyuan'],
      desc: '逐水草而行：得马市之资或牧马辎具，偶遇灵驹相随。',
      outcomes: [
        { w: 34, t: '马市得资', gold: [800, 2000] },
        { w: 26, t: '得牧马辎具', mats: [1, 2] },
        { w: 12, t: '灵驹相随（得马鞭）', item: 'mabian' },
        { w: 28, t: '风尘仆仆', none: 1 },
      ] },
  };
  /* 拜访事件池：每地形 2 条（文案轻松诙谐，对齐功法文档 2.3 风格；种子化抽取） */
  DATA.LING_VISITS = {
    hill: [
      { t: '隐士对弈', text: '山顶一位老者正在自弈。你陪着下完一局，他抚须一笑：「棋逢对手，下回再来。」临别塞给你一包东西。' },
      { t: '守矿人的酒', text: '矿洞旁住着一位守矿人，非要请你喝一碗浊酒。酒很烈，话很暖——临走还给你装了一小袋矿上拾的碎料。' },
    ],
    forest: [
      { t: '药农的谢礼', text: '你帮一位迷路的药农把药篓背下了山。他执意把篓里品相最好的一株草药塞给了你。' },
      { t: '松鼠的宝藏', text: '一只松鼠把松果堆满了树洞，果堆里混着几块亮晶晶的碎料。你留下松果，取走了碎料——松鼠看上去还挺满意。' },
    ],
    lake: [
      { t: '渔隐的茶', text: '湖心亭里，一位渔隐不紧不慢地煮着茶：「等的就是一个能安静坐一会儿的人。」一壶茶喝完，神清气爽。' },
      { t: '漂来的木匣', text: '一只木匣顺水漂来。里面没有金银，只有几张透着灵气光泽的旧纸——像是谁有意托付的。' },
    ],
    zhaoze: [
      { t: '瘴医的点拨', text: '草庐里的瘴医看了你一眼，塞来一味药：「常往野地里跑，得学会护着自己。」' },
      { t: '蛙鸣礼', text: '你学了一声蛙叫。整片沼泽安静了一瞬，随后蛙声大起——像是某种别开生面的欢迎仪式。走时脚边多了个灵气萦绕的小囊。' },
    ],
    desert: [
      { t: '行商的水囊', text: '沙丘背风处，一位行商分了你半囊清水：「荒漠里遇见人，就是缘分。」临别还匀了些货给你。' },
      { t: '古燧台的信', text: '废弃烽燧里压着一封没寄出的家书。你把信收好打算带回城，却在信封夹层里摸到几枚灵光流转的沙晶。' },
    ],
    caoyuan: [
      { t: '牧人的奶豆腐', text: '篝火旁的大娘说你像她远行未归的儿子，硬塞给你一块奶豆腐和一小包草籽——「路上吃，管饱。」' },
      { t: '驯鹰人的口诀', text: '驯鹰人看你目光沉稳，教了你半句驯鹰口诀，又塞来一小袋东西：「剩下的，得用交情换。」' },
    ],
  };

  /* ============================================================
   * v89.4（老板：「不同野地有不同活动，不是所有野地都有活动，概率出现，
   *   活动难度跟奖励与野地等级有关」）：野地生态
   * ------------------------------------------------------------
   * · 逐地分布：某格出现哪些活动 = f(格子坐标) 的确定性伪随机 ——
   *   同格恒同貌（跨会话一致；不加日盐，避免每日重抽破坏可复现与测试）
   * · 不是所有野地都有事：先掷「荒僻率」，荒僻格不生江湖之事
   * · 有事格 1~3 事：不同野地得到不同组合（候选按种子洗牌裁剪）
   * · 等级联动（lv = 该格野地等级 0~10）：
   *     难度 ×(1 + lv×lvNeed)（战斗 / 试炼）· 负伤 ×(1 + lv×lvDmg)
   *     收益 ×(1 + lv×lvRew)（精华 / 金 / 粮 / 材料 —— 全走 mi() 出口）
   * ============================================================ */
  DATA.JH_SPREAD = {
    noneP: 0.30,    /* 荒僻率：30% 野地无江湖之事 */
    p2: 0.62,       /* 有事格：< p2 → 1 事 */
    p3: 0.87,       /*         < p3 → 2 事；≥ p3 → 3 事 */
    lvNeed: 0.35,   /* 难度系数（对齐旧常量 0.35） */
    lvDmg: 0.20,    /* 负伤系数 */
    lvRew: 0.30,    /* 收益系数 */
  };

  /* ============================================================
   * v89.5（老板：「按建议进行」—— v89.4 收尾建议的地标提示）：灵机之地
   * ------------------------------------------------------------
   * 活动已逐地概率化（v89.4），玩家需要"一眼看到哪有江湖事"。
   * 「灵机」= 事数 × 野地等级；达 minScore 者在地图上悬「灵机旗」（青旗）。
   * 阈值越高旗越稀（越挑"值得专程一访"），0 事（荒僻）恒不显。
   * ============================================================ */
  DATA.JH_MARK = {
    minScore: 16,   /* lv×事数 ≥ 16：3 事地 Lv6+ / 2 事地 Lv8+（1 事地不满阈） */
  };

  /* ============================================================
   * v89.6（老板：「没有达到我想要的探索性和趣味性。赛博许愿术，发动！」）：
   *   奇遇 · 见闻录 —— 野地探索层
   * ------------------------------------------------------------
   * · 隐藏奇遇点：每张地图按 seed 确定性撒「奇遇点位」，地图上**不显示**；
   *   距主城三带密度不同：近郊多逸闻、绝域多奇珍绝景（愈远愈奇）。
   * · 现形两条路：① 线索 —— 走完任一江湖活动有几率闻得「某处有异象」（地图现✦）；
   *   ② 就近探察 —— 打开野地弹窗时，方圆二格内的点位自动现形。
   * · 探奇：在点位野地 →「探奇」（君主亲往 · 耗精力/体力）→ 全屏奇遇剧本
   *   （首次选择即扣费并锁点位：无论成败，此缘即断）→ 结算 + 见闻录收录。
   * · 见闻录：24 条奇遇三档（逸闻 / 奇珍 / 绝景），收集向图鉴（地图底栏「见闻录」）。
   * ============================================================ */
  DATA.WONDER = {
    clueP: 0.18,          /* 走完一桩江湖事 → 闻得线索的几率 */
    bandNear: 25,         /* 近郊半径（距主城，格） */
    bandFar: 70,          /* 远野半径；更远为「绝域」 */
    nearP: 0.0016,        /* 三带点位密度（逐格确定性掷） */
    midP: 0.0006,
    farP: 0.00024,
    cost: { energy: 6, stam: 2 },   /* 探奇消耗 */
    rw: {                 /* 三档奖励（与江湖活动同款出口；mods.reward 可放大） */
      small: { ess: [4, 9], gold: [60, 150] },
      rare: { ess: [12, 22], gold: [180, 360], mats: [2, 3] },
      epic: { ess: [26, 44], gold: [320, 600], mats: [4, 6], jewel: 1 },
    },
    exits: {
      win: { ic: '✨', t: '奇缘圆满', s: '天机所授，收之无妨' },
      escape: { ic: '🍃', t: '怅然而归', s: '缘法未到，且待来日' },
    },
  };

  /* 奇遇三档：逸闻（小品）· 奇珍（二阶）· 绝景（险中求）—— 见闻录按此分组 */
  DATA.WONDERS = {
    /* ---------- 逸闻 ×12（一幕小景） ---------- */
    w_huai: {
      name: '古槐棋局', ic: '🌳', tier: 'small', scene: 'grove',
      txt: '村口古槐下的半局残棋，你落下一子，四野的风都静了。',
      stages: [
        { s: '古槐残局', t: '老槐树下摆着一盘下了半局的棋，黑白子落满苔痕，四野却不见人影。棋枰边压着半块干粮，像在等人来接。',
          o: [
            { l: '坐下接这半局棋', d: '棋到中盘，胜负未分', e: { reward: 1.25 } },
            { l: '吃罢干粮便走', d: '莫贪人家的棋局', e: { reward: 0.85 } },
          ] },
      ],
    },
    w_yusou: {
      name: '溪畔钓叟', ic: '🎣', tier: 'small', scene: 'lake',
      txt: '老翁分你半篓银鳞，只说一句：钓的是静，不是鱼。',
      stages: [
        { s: '溪畔钓叟', t: '溪畔一位老翁垂钓，篓里银鳞跃动。他头也不抬：「坐么？鱼分你一半。」',
          o: [
            { l: '谢过老翁，静坐半日', d: '陪钓也是缘分', e: { reward: 1.2 } },
            { l: '讨一尾便走', d: '不扰老翁清静', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_huangci: {
      name: '荒祠灯影', ic: '🏮', tier: 'small', scene: 'cottage',
      txt: '荒祠里那盏不灭的灯，供的是谁，没人说得清。',
      stages: [
        { s: '荒祠灯影', t: '断壁荒祠里竟亮着一盏油灯，神像面目已模糊，供桌上却摆着新鲜的野果。',
          o: [
            { l: '添一炷香再走', d: '敬神如神在', e: { reward: 1.25 } },
            { l: '取走供果充饥', d: '神不怪罪饿人', e: { reward: 0.85 } },
          ] },
      ],
    },
    w_qingquan: {
      name: '岩下清泉', ic: '💧', tier: 'small', scene: 'meadow',
      txt: '岩缝里的清泉漂着几瓣不知名的花，饮一口，喉间生凉。',
      stages: [
        { s: '岩下清泉', t: '岩壁下涌出一汪清泉，水面上竟漂着几瓣山花——上游分明无人。',
          o: [
            { l: '掬水而饮，静观其源', d: '水甘，心更静', e: { reward: 1.2 } },
            { l: '灌满水囊就走', d: '赶路要紧', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_duanbei: {
      name: '断碑残字', ic: '🪦', tier: 'small', scene: 'ruin',
      txt: '断碑上的半句兵诀，拓下来，够琢磨一阵子。',
      stages: [
        { s: '断碑残字', t: '沙土里半截断碑，碑文已残，却是半句行军要诀。风一吹，字缝里的沙簌簌而下。',
          o: [
            { l: '拓下残字，细加揣摩', d: '古人兵法，开卷有益', e: { reward: 1.2 } },
            { l: '记个大概就走', d: '沙掩的旧事，不必深究', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_yedu: {
      name: '野渡横舟', ic: '🛶', tier: 'small', scene: 'lake',
      txt: '无人渡口一艘空船，缆绳自己松了，又自己系上。',
      stages: [
        { s: '野渡横舟', t: '荒渡口泊着一艘乌篷船，船家不知去向，缆绳却在风里轻轻晃。舱里整整齐齐。',
          o: [
            { l: '登船看看船家留下的物什', d: '船在人在，人不在……', e: { reward: 1.2 } },
            { l: '岸边拱手，不去惊扰', d: '各人有各人的渡口', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_yaolou: {
      name: '药农遗篓', ic: '🧺', tier: 'small', scene: 'hunt',
      txt: '遗在草间的一篓草药，还有半册画满药画的册子。',
      stages: [
        { s: '药农遗篓', t: '林间草窝里搁着一只药篓，草药还带着露水，篓底压着半册手画的药方。四下无人应答。',
          o: [
            { l: '收好药册，分门别类', d: '留着，失主会回来寻', e: { reward: 1.2 } },
            { l: '取了草药先行', d: '山野之物，取之有道', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_hailuo: {
      name: '沙海回声', ic: '🐚', tier: 'small', scene: 'ruin',
      txt: '沙丘里的海螺，听见了千年前的海声。',
      stages: [
        { s: '沙海回声', t: '沙丘背风处躺着一枚海螺，螺口莹润。放在耳边，竟像真有涛声——此地千年前是海。',
          o: [
            { l: '细细收好这枚沧海遗物', d: '沧海桑田，一物证之', e: { reward: 1.2 } },
            { l: '放回原处，不必带走', d: '让涛声留在沙里', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_xianhe: {
      name: '仙鹤梳羽', ic: '🕊️', tier: 'small', scene: 'marsh',
      txt: '白鹤立在浅滩梳羽，见人不惊——它认得你身上没有杀气。',
      stages: [
        { s: '仙鹤梳羽', t: '沼泽浅滩上，一只白鹤单足而立，慢条斯理地梳着翎羽。你走近三步，它只抬了抬眼。',
          o: [
            { l: '远远坐下，陪它梳完', d: '仙禽有灵，不惊是缘', e: { reward: 1.25 } },
            { l: '摄衣速行，不扰清修', d: '各有各的清净', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_yuntie: {
      name: '陨铁坠地', ic: '☄️', tier: 'small', scene: 'meadow',
      txt: '天上坠下一块黑石，尚有余温，敲之铮然有金声。',
      stages: [
        { s: '陨铁坠地', t: '旷野上一道焦痕指向新砸出的土坑，坑底一块乌黑石铁，余温未散，敲之铮然。',
          o: [
            { l: '整块起出，仔细包好', d: '天铁难得，可锻可藏', e: { reward: 1.25 } },
            { l: '敲一小块留作念想', d: '不夺天工全物', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_diezzhen: {
      name: '蝶阵引途', ic: '🦋', tier: 'small', scene: 'steppe',
      txt: '蝶群引你走过一段弯路，弯路的尽头总有朵好花。',
      stages: [
        { s: '蝶阵引途', t: '草浪间一群彩蝶忽聚忽散，像在引路。你随它走了几十步，尽头处草色格外青翠。',
          o: [
            { l: '跟着蝶群走到尽头', d: '山野引路，必有因由', e: { reward: 1.2 } },
            { l: '笑一笑，转回原路', d: '不误正事', e: { reward: 0.9 } },
          ] },
      ],
    },
    w_shanseng: {
      name: '山僧化缘', ic: '🧘', tier: 'small', scene: 'road',
      txt: '游方僧讨一碗水，回赠你一路平安。',
      stages: [
        { s: '山僧化缘', t: '山道上一名游方僧合十讨水：「贫僧不化金银，只化一碗清水、半句闲话。」',
          o: [
            { l: '奉水，并陪他坐一会儿', d: '闲话里有消息', e: { reward: 1.2 } },
            { l: '指了水脉便行', d: '各有各的道', e: { reward: 0.9 } },
          ] },
      ],
    },

    /* ---------- 奇珍 ×8（两幕） ---------- */
    w_miwu: {
      name: '迷雾岔路', ic: '🌫️', tier: 'rare', scene: 'road',
      txt: '雾里那两条路，走得急了会绕回原处，走得慢了会遇见东西。',
      stages: [
        { s: '迷雾岔路', t: '山雾骤起，岔路分出两条：左道平坦却有车辙，右道荒芜似无人行。雾里隐约有铃铛声。',
          o: [
            { l: '循铃铛声走左道', d: '有铃必有人烟', e: { reward: 1.1 } },
            { l: '踏荒芜走右道', d: '无人处或有所藏', e: { reward: 1.25, wound: 1.2 } },
          ] },
        { s: '雾散之处', t: '行至雾薄处，前路豁然——一道石痕斑驳,路边似有旧年驿站的残迹。',
          o: [
            { l: '翻检驿站残物', d: '过客遗落，或有余财', e: { reward: 1.2 } },
            { l: '整衣上路，不逗留', d: '雾地不久留', e: { reward: 0.95 } },
          ] },
      ],
    },
    w_chenjian: {
      name: '幽潭沉剑', ic: '🗡️', tier: 'rare', scene: 'lake',
      txt: '潭底那口剑，拔的人多，拔得动的少。',
      stages: [
        { s: '幽潭沉剑', t: '潭水色深如墨，水底一痕冷光——是口插在石中的剑。潭边石上刻着八个字：有缘者拔，无缘者溺。',
          o: [
            { l: '撩衣下水，试拔此剑', d: '机缘在前，岂能错过', e: { reward: 1.2, wound: 1.25 } },
            { l: '敬而远之，只拜一拜', d: '不吃水底亏', e: { reward: 0.9 } },
          ] },
        { s: '剑气犹存', t: '剑身出水的那一刻，潭面炸开一圈细浪，剑气虽老，刃上寒芒未退。',
          o: [
            { l: '以剑气磨砺己身', d: '悟其锋锐', e: { reward: 1.35 } },
            { l: '裹剑归囊，不试其锋', d: '稳妥为上', e: { reward: 1.05 } },
          ] },
      ],
    },
    w_canjuan: {
      name: '石室残卷', ic: '📜', tier: 'rare', scene: 'ruin',
      txt: '石室中那半卷竹简，写的不是文章，是吐纳的法子。',
      stages: [
        { s: '石室残卷', t: '石窟深处留着一方案台，案上竹简已被虫蛀去一半，所幸大半是口诀，像一门粗浅的吐纳法。',
          o: [
            { l: '就地整理竹简，逐句誊抄', d: '慢工出细活', e: { reward: 1.3 } },
            { l: '粗略翻翻便收好', d: '先带回去再说', e: { reward: 1.0 } },
          ] },
        { s: '简中微言', t: '誊到末页，你发现几行小字批注，写着「此法可省三分力」——是前人的心得。',
          o: [
            { l: '按批注试演一遍', d: '一动手便觉通畅', e: { reward: 1.3 } },
            { l: '誊录存档，日后再习', d: '不急一时', e: { reward: 1.05 } },
          ] },
      ],
    },
    w_zhuguo: {
      name: '松间朱果', ic: '🍒', tier: 'rare', scene: 'hunt',
      txt: '崖边那株朱果，鸟兽不敢近——先想想为什么。',
      stages: [
        { s: '松间朱果', t: '古松崖边立着一株矮树，缀着几颗朱红如血的果子。树下一圈寸草不生，鸟兽踪迹全无。',
          o: [
            { l: '攀崖采果，快取快走', d: '灵果在望', e: { reward: 1.35, wound: 1.3 } },
            { l: '先投石问路，再定行止', d: '小心驶得万年船', e: { reward: 1.1 } },
          ] },
        { s: '果入囊中', t: '朱果入囊，指尖微染胭脂色，凑近闻有清苦香——灵药，也是一味险药。',
          o: [
            { l: '趁鲜活与军中同僚分食', d: '好物不独享', e: { reward: 1.25 } },
            { l: '封入玉匣，用时再取', d: '留作后手', e: { reward: 1.1 } },
          ] },
      ],
    },
    w_guanxing: {
      name: '孤峰观星', ic: '🌌', tier: 'rare', scene: 'meadow',
      txt: '峰顶一夜星图，抵得上千里奔波。',
      stages: [
        { s: '孤峰观星', t: '孤峰之上云海翻涌，入夜后星子大如鸡子，亮得能照见人影。老猎户说，此峰观星，十年一遇。',
          o: [
            { l: '夜宿峰顶，彻夜观星', d: '困也就困一夜', e: { reward: 1.25 } },
            { l: '看个把时辰便下山', d: '山中夜寒', e: { reward: 1.0 } },
          ] },
        { s: '星图入心', t: '斗转星移间，你忽然看懂了几分天象：哪颗主雨，哪颗主兵，书上从没写过。',
          o: [
            { l: '就着星光默记成图', d: '写下来才不会忘', e: { reward: 1.3 } },
            { l: '会心一笑，记个大概', d: '天机不可尽取', e: { reward: 1.05 } },
          ] },
      ],
    },
    w_lingchan: {
      name: '灵蟾吐月', ic: '🐸', tier: 'rare', scene: 'marsh',
      txt: '三足蟾对着月亮吐纳，胆子大的敢在旁边学着做。',
      stages: [
        { s: '灵蟾吐月', t: '月下沼泽，一只三足巨蟾踞在石上，对着月亮一鼓一收地吐纳。四周虫鸣全歇，静得诡异。',
          o: [
            { l: '隔水学着它的吐纳', d: '妖物的法子，未必不能学', e: { reward: 1.3 } },
            { l: '退后十步，静观其变', d: '先看清楚再说', e: { reward: 1.05 } },
          ] },
        { s: '蟾戏收场', t: '蟾腹鼓到极处，忽然一吐——月华般的一缕白气飘来又散，落地处草叶上凝了露珠般的东西。',
          o: [
            { l: '把草上的凝露收进小瓶', d: '灵蟾月华，可遇不可求', e: { reward: 1.35 } },
            { l: '拱手作别，不取分毫', d: '妖物之物，不沾为妙', e: { reward: 1.0 } },
          ] },
      ],
    },
    w_zhanchang: {
      name: '古战场拾戈', ic: '⚔️', tier: 'rare', scene: 'ruin',
      txt: '荒草里的断戈，还带着上一场仗的凉。',
      stages: [
        { s: '古战场拾戈', t: '草浪尽头是一处旧战场，断戈折戟半埋泥中。风过处，草叶都在朝一个方向倒，像还列着阵。',
          o: [
            { l: '在阵眼处细翻', d: '中军所在，遗物最多', e: { reward: 1.25 } },
            { l: '沿边角捡两件就走', d: '不去踏那阵势', e: { reward: 1.05 } },
          ] },
        { s: '戈上旧痕', t: '一柄断戈入手沉得很，刃口卷了七八处，伤痕里嵌着暗色——是柄久经战阵的好兵。',
          o: [
            { l: '回炉重锻，取其精铁', d: '好铁不嫌残', e: { reward: 1.3 } },
            { l: '原样留着，敬其旧主', d: '兵者凶器，敬而存之', e: { reward: 1.05 } },
          ] },
      ],
    },
    w_zhuqin: {
      name: '竹隐琴声', ic: '🎼', tier: 'rare', scene: 'grove',
      txt: '竹林里的琴声没有主人，听懂的人却说，弹的是你的心事。',
      stages: [
        { s: '竹隐琴声', t: '竹径深处传来琴声，清越但不疾，像在等人把话说完。循声而去，只见一张琴，不见弹琴人。',
          o: [
            { l: '在琴前坐下，听完全曲', d: '曲终自有交代', e: { reward: 1.25 } },
            { l: '循声搜遍竹林', d: '总得找到弹琴人', e: { reward: 1.1, wound: 1.1 } },
          ] },
        { s: '琴罢留音', t: '一曲终了，琴音犹在竹梢绕，琴案上不知何时多了一小包东西，纸包上写着「赠知音」。',
          o: [
            { l: '郑重收下这包赠礼', d: '知音之赠，不可负', e: { reward: 1.3 } },
            { l: '只取一半，留一半谢主人', d: '君子取之有度', e: { reward: 1.1 } },
          ] },
      ],
    },

    /* ---------- 绝景 ×4（两幕，险中求） ---------- */
    w_xianque: {
      name: '云中仙阙', ic: '🏯', tier: 'epic', scene: 'array',
      txt: '云雾散开的那一刻，你看见了不该看见的楼阙。',
      stages: [
        { s: '云中仙阙', t: '山巅云雾忽然裂开一线，云海里浮出一角楼阙，飞檐斗拱，非人间样式。云缝正一点点合拢。',
          o: [
            { l: '趁云缝未合，拾级而上', d: '机会只在一线天', e: { reward: 1.3 } },
            { l: '原地瞻仰，不动一步', d: '仙家之地，凡足莫入', e: { reward: 1.0 } },
          ] },
        { s: '阙下回首', t: '你踏上的石阶温润如玉，回首处云海已在脚下。阙门虚掩，门缝里透出的光，比日头还白。',
          o: [
            { l: '推门直入，探个究竟', d: '来都来了', e: { reward: 1.6, wound: 1.5 } },
            { l: '在门外深深一揖，转身下山', d: '看一眼已是造化', e: { reward: 1.15 } },
          ] },
      ],
    },
    w_longtui: {
      name: '渊底龙蜕', ic: '🐉', tier: 'epic', scene: 'marsh',
      txt: '潭底那层银鳞，是龙蜕下来的旧衣。',
      stages: [
        { s: '渊底龙蜕', t: '瘴泽最深处有一汪黑潭，潭底鳞光流动——是一整幅龙蜕，鳞大如掌，千年不腐。水寒得刺骨。',
          o: [
            { l: '潜下去，试着取鳞', d: '龙蜕至宝，值得一潜', e: { reward: 1.35, wound: 1.3 } },
            { l: '结绳系石，先测深浅', d: '谋定而后动', e: { reward: 1.1 } },
          ] },
        { s: '水底逆流', t: '越往深处水越寒，龙蜕忽然自行收紧、抽动——潭底暗流翻涌，像有什么老物翻了个身。',
          o: [
            { l: '拼死抓住最完整的一片鳞', d: '险中求宝', e: { reward: 1.6, wound: 1.5 } },
            { l: '果断上浮，命要紧', d: '宝物再好，不如性命', e: { reward: 1.05 } },
          ] },
      ],
    },
    w_fangshi: {
      name: '前朝方士冢', ic: '⚰️', tier: 'epic', scene: 'ruin',
      txt: '冢里那位方士，把答案埋得比问题还深。',
      stages: [
        { s: '前朝方士冢', t: '沙暴过后，沙丘下露出一角石椁。椁盖上刻满符文，缝隙里灌着朱砂——是前朝方士的手笔。',
          o: [
            { l: '按符文顺序开椁', d: '照着规矩来', e: { reward: 1.3 } },
            { l: '撬开了事，快进快出', d: '夜长梦多', e: { reward: 1.1, wound: 1.2 } },
          ] },
        { s: '椁中无尸', t: '椁中没有尸身，只有一只倒扣的铜函，函底刻着一行小字：丹成之日，吾已飞天。',
          o: [
            { l: '开函取丹，一探究竟', d: '方士留丹，必有其故', e: { reward: 1.6, wound: 1.5 } },
            { l: '将铜函原样封回', d: '先人遗物，敬而封之', e: { reward: 1.15 } },
          ] },
      ],
    },
    w_xinghe: {
      name: '星河倒悬', ic: '🌠', tier: 'epic', scene: 'steppe',
      txt: '那一夜，星河是朝着地面流下来的。',
      stages: [
        { s: '星河倒悬', t: '草原夜里无月，忽见北方天河斜垂，星子络绎坠向地平，将草场照得如同白昼——老牧民说，这叫星辰垂野。',
          o: [
            { l: '骑马追着星落的方向去', d: '星落之处，必有坠物', e: { reward: 1.3 } },
            { l: '就地静立，观其全貌', d: '有些景象，看着就好', e: { reward: 1.05 } },
          ] },
        { s: '星落之处', t: '星群尽处，草场上一圈焦土中央，静静躺着一枚拳头大的星石，表面纹路会缓缓流动。',
          o: [
            { l: '双手捧起星石', d: '天赐之物，不取可惜', e: { reward: 1.6, wound: 1.4 } },
            { l: '插杖为记，日后再来', d: '未明之物，慎重为上', e: { reward: 1.15 } },
          ] },
      ],
    },
  };

  /* ============================================================
   * v89 · 全屏江湖场景剧本（老板：「专属全屏交互 + 特定退出」）
   * ------------------------------------------------------------
   * 每条活动一段流程：2~3 幕「对话 / 事件」，每幕 1~3 个选择；
   * 选择只累计**修正系数 mods**（不改判定公式、不改种子 —— 可复现）：
   *   pow    我方差数倍率（fight / trial）
   *   reward 数值产出倍率（精华 / 金 / 粮 / 材料）
   *   wound  负伤倍率
   *   luck   小幸运（加法 0~0.2）：掉落率 / 双收 / 悟道 / 场景遗憾重抽
   * 终幕选择后结算（GAME.jianghuRoll(chk, mods)），按 grade 选专属退出屏：
   *   win / partial / lose / escape
   * ============================================================ */
  DATA.SCENE_FLOW = {
    /* ---------- 通用六活动 ---------- */
    tao: { art: '🏕️', scene: 'fort', escLabel: '🏃 鸣金收兵', backLabel: '收兵回城',
      stages: [
        { s: '军情来报', t: '斥候来报：此地盘踞着一伙贼寇，倚险扎寨，寨门大开，气焰正盛。',
          o: [
            { l: '堂堂正正，正面推进', d: '军容整肃，先声夺人', e: { pow: 1.08 } },
            { l: '分出偏师，迂回包抄', d: '出其不意，胜机在握', e: { pow: 1.05, reward: 1.1 } },
            { l: '趁着夜色，偷袭营寨', d: '险中求胜，成则大获', e: { pow: 1.18, wound: 1.4 } } ] },
        { s: '阵前对峙', t: '两军对圆。贼首横刀立马，扬声喝道：「来将通名！你我何怨何仇，何苦赶尽杀绝？」',
          o: [
            { l: '晓以利害，劝其归降', d: '不战而屈人之兵，善之善者也', e: { reward: 1.15, wound: 0.7 } },
            { l: '怒斥其罪，挥军直取', d: '多言无益，刀剑上见', e: { pow: 1.1 } },
            { l: '按兵不动，静观其变', d: '看他阵脚先乱', e: { wound: 0.6, reward: 0.9 } } ] },
        { s: '击鼓进兵', t: '风卷旌旗，鼓声渐急 —— 这一战，避无可避。', t2: '击鼓！',
          o: [
            { l: '鼓点如雷', d: '一鼓作气，毕其功于此役', e: { pow: 1.12 } },
            { l: '鼓点稍乱', d: '阵脚平推，稳扎稳打', e: { pow: 1.02 } },
            { l: '鼓声一顿', d: '三军迟疑了一瞬', e: { pow: 0.94, wound: 1.08 } } ] } ],
      exits: {
        win:    { ic: '🏆', t: '大捷 · 战果结算', s: '贼寇溃散，军资灵材尽入囊中' },
        lose:   { ic: '🛡️', t: '铩羽而归', s: '力战不敌，负伤而还 —— 来日再战' },
        escape: { ic: '🏃', t: '鸣金收兵', s: '审时度势，全身而退' } } },

    qie: { art: '🎋', scene: 'yard', escLabel: '🤝 拱手告辞', backLabel: '抱拳作别',
      stages: [
        { s: '剑客相邀', t: '演武场边，一位游方剑客掸了掸衣尘，含笑拱手：「久闻大名，讨教三招？」',
          o: [
            { l: '抱拳回礼：「请。」', d: '以静制动，先看一式', e: { pow: 1.06, wound: 0.7 } },
            { l: '开怀一笑：「放开了打！」', d: '倾力相搏，酣畅淋漓', e: { pow: 1.12, reward: 1.1 } },
            { l: '拱手：「点到为止。」', d: '稳中求胜，不失体面', e: { wound: 0.6 } } ] },
        { s: '以武会友', t: '数十招拆罢，剑光往来而不伤衣角，围观者叫好声一片。',
          o: [
            { l: '卖个破绽，诱敌深入', d: '胜在谋略', e: { pow: 1.15, wound: 1.2 } },
            { l: '步步紧逼，不给喘息', d: '一鼓作气拿下', e: { pow: 1.1 } },
            { l: '收剑抱拳，就此打住', d: '点到即止，交个朋友', e: { reward: 1.05, wound: 0.5 } } ] },
        { s: '胜负一招', t: '最后一合，四下屏息。', t2: '出手！',
          o: [
            { l: '一击即中', d: '胜负在此一招', e: { pow: 1.12 } },
            { l: '擦身而过', d: '险险拆过，各自心惊', e: { pow: 1.02 } },
            { l: '收势不住', d: '门户大开，只得认负', e: { pow: 0.94, wound: 1.08 } } ] } ],
      exits: {
        win:    { ic: '🤝', t: '切磋胜利 · 承让', s: '对手抱拳：「阁下武艺，佩服。」' },
        lose:   { ic: '🤝', t: '抱拳一礼 · 受教了', s: '虽败一招，获益匪浅（心得保底）' },
        escape: { ic: '🤝', t: '拱手告辞', s: '来日方长，改日再叙' } } },

    shi: { art: '🌀', scene: 'array', escLabel: '🚪 退阵下山', backLabel: '下山回城',
      stages: [
        { s: '阵门初探', t: '古阵入口，石门上的三重纹路隐隐流转。阵内灵压阵阵，似有考较之意。',
          o: [
            { l: '凝神定气，缓步而入', d: '稳扎稳打', e: { pow: 1.05, wound: 0.8 } },
            { l: '径直闯关，快进快出', d: '一鼓作气', e: { pow: 1.1, wound: 1.2 } } ] },
        { s: '灵压陡增', t: '前两层已然渡过。第三层灵压陡增 —— 守阵人的声音从阵外传来：「到此为止，也是好汉！」',
          o: [
            { l: '迎难而上，再进一层！', d: '险中求机缘', e: { pow: 1.15, wound: 1.15, reward: 1.15 } },
            { l: '心如止水，量力而行', d: '不求全功，但求无失', e: { wound: 0.6 } } ] },
        { s: '最后一重', t: '阵纹亮起最后一重光，灵压如山。', t2: '御灵！',
          o: [
            { l: '灵台澄澈，破！', d: '成与不成，试过才知', e: { pow: 1.12 } },
            { l: '勉强稳住', d: '灵压擦身而过', e: { pow: 1.02 } },
            { l: '气机微乱', d: '灵压反噬，闷哼一声', e: { pow: 0.94, wound: 1.08 } } ] } ],
      exits: {
        win:     { ic: '✨', t: '功成出关', s: '三层皆过，灵台一片澄澈' },
        partial: { ic: '🗿', t: '见好就收', s: '止步亦有所得，来日再闯' },
        lose:    { ic: '😵', t: '昏迷醒来', s: '灵压炸开，眼前一黑 —— 再睁眼已躺在城中榻上' },
        escape:  { ic: '🚪', t: '退阵下山', s: '阵中凶险，退一步海阔天空' } } },

    cai: { art: '🌸', scene: 'meadow', escLabel: '🚶 放下药篓', backLabel: '提着药篓回城',
      stages: [
        { s: '寻灵问草', t: '山野间灵气馥郁，草木灵光隐现。要先往哪一处去？',
          o: [
            { l: '崖边的灵草丛', d: '品相最好，路也最险', e: { reward: 1.15, wound: 1.2 } },
            { l: '溪畔的灵苗', d: '稳妥之处，细水长流', e: { reward: 1.0, wound: 0.7 } },
            { l: '林下的灵菌与矿苗', d: '广撒网，或有两头收', e: { luck: 0.08 } } ] },
        { s: '草间惊蛇', t: '采得顺手时，草丛忽起窸窣 —— 一条青鳞灵蛇盘在最近那株灵草上，信子轻吐，并不惧人。',
          o: [
            { l: '小心驱赶', d: '不伤生灵，稳稳拿下', e: { reward: 1.05 } },
            { l: '绕开再寻', d: '多走几步，不惹麻烦', e: { wound: 0.6, reward: 0.95 } },
            { l: '眼疾手快，连蛇带草', d: '快刀斩乱麻', e: { reward: 1.12, wound: 1.1 } } ] },
        { s: '满载收工', t: '药篓将满，日头渐斜。', t2: '下手！',
          o: [
            { l: '恰到火候', d: '把这一片采干净', e: { reward: 1.12 } },
            { l: '手慢半分', d: '采得七成，也不算亏', e: { reward: 1.02 } },
            { l: '连根带土', d: '用力过猛，伤了根苗', e: { reward: 0.94, wound: 1.06 } } ] } ],
      exits: {
        win:    { ic: '🌿', t: '完成采集 · 满载', s: '药篓沉沉，灵气盈盈' },
        escape: { ic: '🚶', t: '放下药篓', s: '今日到此为止' } } },

    xiu: { art: '☁️', scene: 'grove', escLabel: '🌙 提前收功', backLabel: '起身回城',
      stages: [
        { s: '择地入定', t: '择一处灵气葱郁之地，盘膝坐下。今日想修哪一路？',
          o: [
            { l: '吐纳聚气', d: '稳稳当当，精华缓入', e: { reward: 1.05 } },
            { l: '冥想观想', d: '心游太虚，或有顿悟', e: { luck: 0.06 } },
            { l: '逆运周天', d: '剑走偏锋，险中求进', e: { reward: 1.2, wound: 1.3 } } ] },
        { s: '心澜微动', t: '入定渐深。恍惚间心头掠过一丝杂念 —— 是心魔，还是机缘？',
          o: [
            { l: '守心不动，任其自散', d: '心境圆融', e: { wound: 0.6 } },
            { l: '顺其而入，探个究竟', d: '或窥天机', e: { reward: 1.12, luck: 0.05, wound: 1.2 } } ] },
        { s: '收束周天', t: '一炷香将尽，灵气如溪流汇入周身。', t2: '收功！',
          o: [
            { l: '收功圆满', d: '今日功课在此一举', e: { reward: 1.12 } },
            { l: '气息微乱', d: '缓了一缓，也算周全', e: { reward: 1.02 } },
            { l: '匆忙收束', d: '气机断了半截', e: { reward: 0.94, wound: 1.06 } } ] } ],
      exits: {
        win:     { ic: '🌀', t: '功法大进', s: '灵台清明，修为更上层楼' },
        partial: { ic: '🧘', t: '收功而归', s: '气息绵长，平稳精进' },
        escape:  { ic: '🌙', t: '提前收功', s: '心有旁骛，不如改日再修' } } },

    bai: { art: '🍵', scene: 'cottage', escLabel: '🚪 改日再来', backLabel: '谢过主人',
      stages: [
        { s: '叩门相访', t: '叩响柴扉，一位隐士开门相迎。你道明来意 ——',
          o: [
            { l: '虚心请教', d: '执礼甚恭', e: { reward: 1.1 } },
            { l: '与之道论', d: '话锋相交，主客尽欢', e: { reward: 1.05, luck: 0.05 } },
            { l: '闲谈风物', d: '不说正事，只叙家常', e: { reward: 1.02, wound: 0.8 } } ] },
        { s: '茶叙旧闻', t: '茶过三巡，谈兴渐浓，隐士说起一段前朝旧闻 ……',
          o: [
            { l: '听得入神，连声称妙', d: '好听众也是知音', e: { reward: 1.05 } },
            { l: '追问其中关窍', d: '打破砂锅问到底', e: { reward: 1.08, luck: 0.04 } } ] },
        { s: '尽兴而别', t: '日影西斜，该告辞了。', t2: '告辞！',
          o: [
            { l: '恰在兴尽处', d: '来时乘兴，去时尽兴', e: { reward: 1.12 } },
            { l: '多叙了两句', d: '宾主皆欢，只是天色渐晚', e: { reward: 1.02 } },
            { l: '告辞得仓促', d: '话赶着话，礼数差了一线', e: { reward: 0.94 } } ] } ],
      exits: {
        win:    { ic: '🚪', t: '尽兴而别', s: '一段小故事，一份小赠礼' },
        escape: { ic: '🚪', t: '改日再来', s: '长者今日不便，改日再登门' } } },

    /* ---------- 六地形招牌 ---------- */
    hill_scene: { art: '🚩', scene: 'road', escLabel: '🍃 悄然下山', backLabel: '告辞下山',
      stages: [
        { s: '山道拦截', t: '山道上忽起一声哨响，一队好汉拦在路中：「过路的朋友，亮个名号？」',
          o: [
            { l: '以礼相待，道明来意', d: '先交朋友，再谈其他', e: { reward: 1.08 } },
            { l: '以武会友，亮亮身手', d: '手底下见真章', e: { pow: 1.12, wound: 1.15 } },
            { l: '坦然报上军中名号', d: '坦坦荡荡，不藏不掖', e: { luck: 0.08 } } ] },
        { s: '寨中煮酒', t: '寨中堂上，大当家放下酒碗：「这年月，肯上山来看我们的，不多了。」',
          o: [
            { l: '与其煮酒论英雄', d: '酒逢知己千杯少', e: { reward: 1.1 } },
            { l: '问寨中可有难处', d: '仗义相助', e: { luck: 0.06 } } ] },
        { s: '送别下山', t: '临别时，山寨上下一直送出寨门。', t2: '抱拳！',
          o: [
            { l: '抱拳周正', d: '山高水长，后会有期', e: { reward: 1.12 } },
            { l: '寒暄几句', d: '送到路口，相谈未尽', e: { reward: 1.02 } },
            { l: '拱手太急', d: '转身太早，差了一线礼数', e: { reward: 0.94 } } ] } ],
      exits: {
        win:    { ic: '🤝', t: '与众好汉作别', s: '江湖路远，情义已结' },
        lose:   { ic: '🍃', t: '负伤下山', s: '遇了剪径强人，好在性命无碍' },
        escape: { ic: '🍃', t: '悄然下山', s: '不知深浅，先行回避' } } },

    lake_scene: { art: '🌊', scene: 'lake', escLabel: '🧺 收起鱼竿', backLabel: '收竿回城',
      stages: [
        { s: '择处下竿', t: '湖面澄澈如镜，远处一尾金鳞跃出水面，鳞光一闪而没 —— 不似凡鱼。今日想在哪处下竿？',
          o: [
            { l: '芦苇荡边', d: '灵物就爱躲在这种地方', e: { reward: 1.1 } },
            { l: '湖心石上', d: '水深藏灵物，也考验定力', e: { reward: 1.15, wound: 1.1 } },
            { l: '柳荫之下', d: '清净，适合打盹', e: { wound: 0.6, reward: 0.95 } } ] },
        { s: '灵鲤咬钩', t: '浮漂猛地一沉，水下金鳞翻涌 —— 好一尾灵鲤！', t2: '提竿！',
          o: [
            { l: '稳稳提竿', d: '不急不躁，跟它耗', e: { reward: 1.15 } },
            { l: '慢半拍', d: '鱼线松了半分，险险保住', e: { reward: 1.03 } },
            { l: '收竿早了', d: '竿弯了个空，水面哗啦一声', e: { reward: 0.92, wound: 1.06 } } ] },
        { s: '日头偏西', t: '日头偏西，水面泛起金光。',
          o: [ { l: '再守最后一竿', d: '守得到是惊喜，守不到是清净', e: {} } ] } ],
      exits: {
        win:     { ic: '🎣', t: '满载收竿', s: '灵鲤满篓，晚风正好' },
        partial: { ic: '🎣', t: '收竿而归', s: '三两尾小鲤，也算没白坐' },
        escape:  { ic: '🧺', t: '收起鱼竿', s: '今日心不静，灵物也不咬钩' } } },

    zhaoze_scene: { art: '🌫️', scene: 'marsh', escLabel: '🏃 退出沼泽', backLabel: '退回高地',
      stages: [
        { s: '遗痕初探', t: '旧战场的遗痕没入沼泽，锈戟斜插、水洼泛黑，水雾深处隐有青光游走。哪一处的底下，值得一探？',
          o: [
            { l: '锈戟斜插之处', d: '兵戈之下必有遗物', e: { reward: 1.08 } },
            { l: '水雾最深处', d: '越险的地方，越有东西', e: { reward: 1.15, wound: 1.2 } },
            { l: '先绕行看地势', d: '磨刀不误砍柴工', e: { wound: 0.7, luck: 0.05 } } ] },
        { s: '瘴气渐起', t: '雾气渐浓，鼻腔里泛起一丝腥甜 —— 是瘴气。',
          o: [
            { l: '以袖掩鼻，再探片刻', d: '富贵险中求', e: { reward: 1.12, wound: 1.25 } },
            { l: '见好就收，退回高地', d: '人比财要紧', e: { wound: 0.5, reward: 0.9 } } ] },
        { s: '泥下箱角', t: '脚下淤泥一松，一截漆木箱角露了出来 —— 漆纹之间，隐有灵光流转。', t2: '下铲！',
          o: [
            { l: '一铲到位', d: '挖到宝是运，挖得准是本事', e: { reward: 1.12 } },
            { l: '挖偏半尺', d: '多费两铲力气，也挖着了', e: { reward: 1.02 } },
            { l: '铲到硬石', d: '泥水溅了一身', e: { reward: 0.94, wound: 1.06 } } ] } ],
      exits: {
        win:    { ic: '💎', t: '寻得宝物', s: '泥水一身，宝物一袋' },
        lose:   { ic: '🌫️', t: '瘴气昏沉 · 醒来', s: '醒来时已在城中，头脑仍有些昏沉' },
        escape: { ic: '🏃', t: '退出沼泽', s: '瘴气太盛，先行退避' } } },

    desert_scene: { art: '🔥', scene: 'ruin', escLabel: '🏛️ 退出地宫', backLabel: '出宫回城',
      stages: [
        { s: '拾级而下', t: '地宫入口的壁画还留着前朝色泽 —— 画的正是方士祭炼之景；烛火照出向下的石阶。',
          o: [
            { l: '举火把，一级一级下', d: '步步为营', e: { wound: 0.7 } },
            { l: '快步直入地宫深处', d: '晚了怕有别人', e: { reward: 1.15, wound: 1.15 } } ] },
        { s: '石门将落', t: '机关声在头顶炸响 —— 石门正缓缓落下！',
          o: [
            { l: '一个翻滚钻过去', d: '险中求财', e: { reward: 1.15, wound: 1.2 } },
            { l: '退到安全处，另寻侧道', d: '留得青山在', e: { wound: 0.6, reward: 0.92 } } ] },
        { s: '石匣在前', t: '石室正中，一具石匣静静立着，纹样与壁画同源。', t2: '开匣！',
          o: [
            { l: '轻启石匣', d: '既来之，则开之，稳当拿住', e: { reward: 1.12 } },
            { l: '匣盖卡涩', d: '费了些功夫，总算打开', e: { reward: 1.02 } },
            { l: '用力过猛', d: '匣内机关轻响了一声', e: { reward: 0.94, wound: 1.08 } } ] } ],
      exits: {
        win:    { ic: '🏛️', t: '探得遗藏', s: '层层深入，终有所获' },
        lose:   { ic: '🏃', t: '夺路而逃', s: '地宫震动，你狼狈冲出 —— 好在人没事' },
        escape: { ic: '🏛️', t: '退出地宫', s: '阴风阵阵，不宜久留' } } },

    forest_scene: { art: '🌲', scene: 'hunt', escLabel: '🌲 就此收弓', backLabel: '收弓回程',
      stages: [
        { s: '循迹入林', t: '林间晨雾未散，湿泥上印着一串梅花状的蹄印，其间隐有灵光未散。',
          o: [
            { l: '顺着蹄印追', d: '稳扎稳打', e: { reward: 1.05 } },
            { l: '抄近路去下风口', d: '老猎人的走法', e: { reward: 1.1, luck: 0.05 } },
            { l: '先布几个套子', d: '不费力气，等收成', e: { wound: 0.6 } } ] },
        { s: '白鹿现踪', t: '灌木丛猛地一晃 —— 一头白鹿跃出：通体如雪，蹄尖点过处，草叶微光一闪。它驻步回望，似在掂量你。',
          o: [
            { l: '张弓搭箭', d: '看这一箭', e: { reward: 1.12 } },
            { l: '放它一条生路', d: '祥瑞之物，取之有度', e: { wound: 0.6, reward: 0.95 } } ] },
        { s: '收弓回程', t: '日头高起，该收弓了。', t2: '收弓！',
          o: [
            { l: '收弓利落', d: '林子里从不缺明天的猎物', e: { reward: 1.12 } },
            { l: '稳步而行', d: '一路无事，安然而归', e: { reward: 1.02 } },
            { l: '脚下打滑', d: '绊了一下，惊起一群飞鸟', e: { reward: 0.94, wound: 1.06 } } ] } ],
      exits: {
        win:     { ic: '🏹', t: '满载而归', s: '皮毛灵材，俱是军资' },
        partial: { ic: '🐾', t: '空手而返', s: '灵兽机警，今日认输' },
        escape:  { ic: '🌲', t: '收弓回程', s: '林深不知处，改日再来' } } },

    caoyuan_scene: { art: '🌤️', scene: 'steppe', escLabel: '🐎 勒马回城', backLabel: '策马归营',
      stages: [
        { s: '牧人指点', t: '草原上灵驹成群，如云涌动。牧人抬手一指：「最烈的那匹，还没被谁驯服过。」',
          o: [
            { l: '翻身上马，试试驯它', d: '马背上的功夫', e: { reward: 1.12, wound: 1.15 } },
            { l: '先去马市转转', d: '看看行情再说', e: { reward: 1.05 } },
            { l: '帮牧人干会儿活', d: '先混个脸熟', e: { luck: 0.08 } } ] },
        { s: '灵驹相人', t: '灵驹打了个响鼻，侧着蹄子打量你 —— 它也在相人。',
          o: [
            { l: '走上前去，轻抚马鬃', d: '以心换心', e: { reward: 1.1 } },
            { l: '取套马杆，干脆利落', d: '靠本事说话', e: { pow: 1.1, reward: 1.08, wound: 1.2 } } ] },
        { s: '夕阳归营', t: '夕阳把整片草原染成金色。', t2: '扬鞭！',
          o: [
            { l: '策马扬鞭', d: '夕阳正好，马蹄正轻', e: { reward: 1.12 } },
            { l: '信马由缰', d: '慢慢走，也不误归期', e: { reward: 1.02 } },
            { l: '马儿使性', d: '颠了一路，灰头土脸', e: { reward: 0.94, wound: 1.06 } } ] } ],
      exits: {
        win:     { ic: '🐎', t: '驯驹成功', s: '灵驹贴耳，愿随君行' },
        partial: { ic: '🌾', t: '风尘仆仆', s: '灵驹未驯，见识长了' },
        escape:  { ic: '🐎', t: '勒马回城', s: '风向不对，不与灵驹较劲' } } },
  };

  /* ============================================================
   * v89.50（老板「创造4套套装，100+种物品」）：新套装 · 新物品一批
   * ------------------------------------------------------------
   * **追加式**：不动上面任何旧表，只往四张表里补条目 ——
   *   DATA.EQUIP（4 套 × 12 槽 = 48 件）· DATA.SETS（4 套四档加成）·
   *   DATA.BLUEPRINTS（4 张图纸）· DATA.ITEMS（新物品）· DATA.NEIGONG（4 门绝学）
   * 数值口径（与旧套同一把尺）：
   *   · 套装件 = **同品质同槽位散件 ×1.12** + 每套"特色属性"（详见生成器）
   *   · 套装加成 = 3/5/7/11 四档**累计**（DATA.SET_TIERS 单一来源），每套有一档带体力
   *   · 物品价 = 既有同类物品的价位阶梯（`price` 单位 = 100 金，商城 ×100）
   * 生成器：`.workbuddy/tools/gen/gen_v8950_content.js`（改数值先改它，别手改此处）
   * ============================================================ */
  (function () {
    /* ---------- ① 新套装件（4 套 × 12 槽） ---------- */
    var NEW_EQUIP = {
      /* 游侠套（q2 良品）—— 速度+14　体力+25 … 统率+30　速度+12 */
      yx_h: { id: 'yx_h', name: '游侠头巾', set: 'youxia', slot: 'head', q: 2, sta: 250, def: 271, yw: 8 },
      yx_n: { id: 'yx_n', name: '游侠项坠', set: 'youxia', slot: 'neck', q: 2, sta: 250, tong: 25 },
      yx_s: { id: 'yx_s', name: '游侠肩披', set: 'youxia', slot: 'shoulder', q: 2, sta: 250, def: 271 },
      yx_c: { id: 'yx_c', name: '游侠短打', set: 'youxia', slot: 'chest', q: 2, sta: 250, def: 370 },
      yx_b: { id: 'yx_b', name: '游侠披风', set: 'youxia', slot: 'back', q: 2, sta: 250, zm: 25, yw: 6 },
      yx_w: { id: 'yx_w', name: '游侠束带', set: 'youxia', slot: 'waist', q: 2, sta: 250, def: 246 },
      yx_a: { id: 'yx_a', name: '游侠护臂', set: 'youxia', slot: 'arm', q: 2, sta: 250, def: 246, yw: 6 },
      yx_f: { id: 'yx_f', name: '游侠快靴', set: 'youxia', slot: 'feet', q: 2, sta: 250, spd: 38 },
      yx_r: { id: 'yx_r', name: '游侠指环', set: 'youxia', slot: 'ring', q: 2, sta: 250, tong: 25, spd: 4 },
      yx_p: { id: 'yx_p', name: '游侠玉佩', set: 'youxia', slot: 'pendant', q: 2, sta: 250, zm: 25, yw: 6 },
      yx_x: { id: 'yx_x', name: '游侠短剑', set: 'youxia', slot: 'weapon', q: 2, sta: 250, atk: 296, yw: 14 },
      yx_m: { id: 'yx_m', name: '游侠健马', set: 'youxia', slot: 'mount', q: 2, sta: 250, spd: 64 },
      /* 陷阵套（q3 珍品）—— 勇武+20　攻击+240 … 统率+50　攻击+430　速度+5 */
      xz_h: { id: 'xz_h', name: '陷阵铁盔', set: 'xianzhen', slot: 'head', q: 3, sta: 470, def: 572, yw: 12 },
      xz_n: { id: 'xz_n', name: '陷阵坠饰', set: 'xianzhen', slot: 'neck', q: 3, sta: 470, tong: 43 },
      xz_s: { id: 'xz_s', name: '陷阵肩铠', set: 'xianzhen', slot: 'shoulder', q: 3, sta: 470, def: 572 },
      xz_c: { id: 'xz_c', name: '陷阵重铠', set: 'xianzhen', slot: 'chest', q: 3, sta: 470, def: 874 },
      xz_b: { id: 'xz_b', name: '陷阵战袍', set: 'xianzhen', slot: 'back', q: 3, sta: 470, zm: 43 },
      xz_w: { id: 'xz_w', name: '陷阵铁带', set: 'xianzhen', slot: 'waist', q: 3, sta: 470, def: 520 },
      xz_a: { id: 'xz_a', name: '陷阵臂甲', set: 'xianzhen', slot: 'arm', q: 3, sta: 470, def: 520, yw: 10 },
      xz_f: { id: 'xz_f', name: '陷阵战靴', set: 'xianzhen', slot: 'feet', q: 3, sta: 470, spd: 55, yw: 8 },
      xz_r: { id: 'xz_r', name: '陷阵指环', set: 'xianzhen', slot: 'ring', q: 3, sta: 470, tong: 43 },
      xz_p: { id: 'xz_p', name: '陷阵玉佩', set: 'xianzhen', slot: 'pendant', q: 3, sta: 470, zm: 43 },
      xz_x: { id: 'xz_x', name: '陷阵长戟', set: 'xianzhen', slot: 'weapon', q: 3, sta: 470, atk: 745, yw: 18 },
      xz_m: { id: 'xz_m', name: '陷阵战马', set: 'xianzhen', slot: 'mount', q: 3, sta: 470, spd: 106 },
      /* 守御套（q3 珍品）—— 防御+280　体力+60 … 统率+60　体力+150 */
      sy_h: { id: 'sy_h', name: '守御兜鍪', set: 'shouyu', slot: 'head', q: 3, sta: 470, def: 672 },
      sy_n: { id: 'sy_n', name: '守御坠饰', set: 'shouyu', slot: 'neck', q: 3, sta: 470, tong: 43 },
      sy_s: { id: 'sy_s', name: '守御肩铠', set: 'shouyu', slot: 'shoulder', q: 3, sta: 470, def: 672 },
      sy_c: { id: 'sy_c', name: '守御重铠', set: 'shouyu', slot: 'chest', q: 3, sta: 470, def: 964 },
      sy_b: { id: 'sy_b', name: '守御披风', set: 'shouyu', slot: 'back', q: 3, sta: 470, zm: 43, def: 60 },
      sy_w: { id: 'sy_w', name: '守御腰甲', set: 'shouyu', slot: 'waist', q: 3, sta: 470, def: 620 },
      sy_a: { id: 'sy_a', name: '守御臂甲', set: 'shouyu', slot: 'arm', q: 3, sta: 470, def: 610 },
      sy_f: { id: 'sy_f', name: '守御战靴', set: 'shouyu', slot: 'feet', q: 3, sta: 470, spd: 49, def: 40 },
      sy_r: { id: 'sy_r', name: '守御指环', set: 'shouyu', slot: 'ring', q: 3, sta: 470, tong: 43 },
      sy_p: { id: 'sy_p', name: '守御玉佩', set: 'shouyu', slot: 'pendant', q: 3, sta: 470, zm: 43 },
      sy_x: { id: 'sy_x', name: '守御刀盾', set: 'shouyu', slot: 'weapon', q: 3, sta: 470, atk: 705, def: 120 },
      sy_m: { id: 'sy_m', name: '守御骏马', set: 'shouyu', slot: 'mount', q: 3, sta: 470, spd: 92 },
      /* 天策套（q4 神品）—— 内政+30　体力+30 … 内政+40　智谋+40　攻击+300 */
      tc_h: { id: 'tc_h', name: '天策冠', set: 'tiance', slot: 'head', q: 4, sta: 620, def: 986, nz: 12 },
      tc_n: { id: 'tc_n', name: '天策璎珞', set: 'tiance', slot: 'neck', q: 4, sta: 620, tong: 87 },
      tc_s: { id: 'tc_s', name: '天策云肩', set: 'tiance', slot: 'shoulder', q: 4, sta: 620, def: 986, nz: 10 },
      tc_c: { id: 'tc_c', name: '天策战袍', set: 'tiance', slot: 'chest', q: 4, sta: 620, def: 1344, nz: 16 },
      tc_b: { id: 'tc_b', name: '天策披风', set: 'tiance', slot: 'back', q: 4, sta: 620, zm: 87 },
      tc_w: { id: 'tc_w', name: '天策玉带', set: 'tiance', slot: 'waist', q: 4, sta: 620, def: 896, nz: 8 },
      tc_a: { id: 'tc_a', name: '天策护腕', set: 'tiance', slot: 'arm', q: 4, sta: 620, def: 896, nz: 8 },
      tc_f: { id: 'tc_f', name: '天策战靴', set: 'tiance', slot: 'feet', q: 4, sta: 620, spd: 99, nz: 6 },
      tc_r: { id: 'tc_r', name: '天策玉戒', set: 'tiance', slot: 'ring', q: 4, sta: 620, tong: 87 },
      tc_p: { id: 'tc_p', name: '天策玉佩', set: 'tiance', slot: 'pendant', q: 4, sta: 620, zm: 87 },
      tc_x: { id: 'tc_x', name: '天策宝剑', set: 'tiance', slot: 'weapon', q: 4, sta: 620, atk: 1135, zm: 10 },
      tc_m: { id: 'tc_m', name: '天策良驹', set: 'tiance', slot: 'mount', q: 4, sta: 620, spd: 182, tong: 8 },
    };
    for (var ek in NEW_EQUIP) DATA.EQUIP[ek] = NEW_EQUIP[ek];

    /* ---------- ② 四套加成（3/5/7/11 累计） ---------- */
    var NEW_SETS = {
      youxia: { name: '游侠套',
        bonus: { 3: '速度+14　体力+25', 5: '勇武+40', 7: '攻击+130', 11: '统率+30　速度+12' },
        eff: { 3: { spd: 14, sta: 25 }, 5: { yw: 40 }, 7: { atk: 130 }, 11: { tong: 30, spd: 12 } } },
      xianzhen: { name: '陷阵套',
        bonus: { 3: '勇武+20　攻击+240', 5: '勇武+60　体力+40', 7: '防御+340', 11: '统率+50　攻击+430　速度+5' },
        eff: { 3: { atk: 240, yw: 20 }, 5: { yw: 60, sta: 40 }, 7: { def: 340 }, 11: { tong: 50, atk: 430, spd: 5 } } },
      shouyu: { name: '守御套',
        bonus: { 3: '防御+280　体力+60', 5: '体力+90', 7: '防御+540', 11: '统率+60　体力+150' },
        eff: { 3: { def: 280, sta: 60 }, 5: { sta: 90 }, 7: { def: 540 }, 11: { tong: 60, sta: 150 } } },
      tiance: { name: '天策套',
        bonus: { 3: '内政+30　体力+30', 5: '智谋+30', 7: '统率+50', 11: '内政+40　智谋+40　攻击+300' },
        eff: { 3: { nz: 30, sta: 30 }, 5: { zm: 30 }, 7: { tong: 50 }, 11: { atk: 300, nz: 40, zm: 40 } } },
    };
    for (var sk in NEW_SETS) DATA.SETS[sk] = NEW_SETS[sk];

    /* ---------- ③ 四张新图纸（铁匠铺前置；forgeList 自动收录新套） ---------- */
    [      { id: 'bp_youxia', name: '游侠套图纸', type: 'blueprint', set: 'youxia', price: 70, forgeLv: 3, desc: '凭此可在铁匠铺打造「游侠套」（需铁匠铺 Lv3）' },
          { id: 'bp_xianzhen', name: '陷阵套图纸', type: 'blueprint', set: 'xianzhen', price: 130, forgeLv: 5, desc: '凭此可在铁匠铺打造「陷阵套」（需铁匠铺 Lv5）' },
          { id: 'bp_shouyu', name: '守御套图纸', type: 'blueprint', set: 'shouyu', price: 130, forgeLv: 5, desc: '凭此可在铁匠铺打造「守御套」（需铁匠铺 Lv5）' },
          { id: 'bp_tiance', name: '天策套图纸', type: 'blueprint', set: 'tiance', price: 360, forgeLv: 7, desc: '凭此可在铁匠铺打造「天策套」（需铁匠铺 Lv7）' }].forEach(function (bp) {
      DATA.BLUEPRINTS.push(bp);
      if (!DATA.ITEMS.some(function (x) { return x.id === bp.id; })) DATA.ITEMS.push(bp);
    });

    /* ---------- ④ 新物品 101 件（type 全都落在既有消费点上） ---------- */
    var NEW_ITEMS = [
    { id: 'xueshanhu', name: '血珊瑚', type: 'jewel', loyalty: 65, price: 60, desc: '赏赐忠诚 +65' },
    { id: 'longyan', name: '龙涎珠', type: 'jewel', loyalty: 70, price: 75, desc: '赏赐忠诚 +70' },
    { id: 'lantianyu', name: '蓝田玉', type: 'jewel', loyalty: 75, price: 90, desc: '赏赐忠诚 +75' },
    { id: 'fengyu', name: '凤羽', type: 'jewel', loyalty: 80, price: 110, desc: '赏赐忠诚 +80' },
    { id: 'heshibi', name: '和氏璧', type: 'jewel', loyalty: 90, price: 150, desc: '赏赐忠诚 +90' },
    { id: 'chuanguo', name: '传国玉玺', type: 'jewel', loyalty: 100, price: 240, desc: '赏赐忠诚 +100' },
    { id: 'huyi', name: '虎翼符', type: 'attr_buff', eff: { tong_mult: 0.75 }, dur: 24, price: 200, desc: '将领 24 小时内：统率+75%' },
    { id: 'xuande', name: '玄德符', type: 'attr_buff', eff: { nz_mult: 0.5 }, dur: 24, price: 130, desc: '将领 24 小时内：内政+50%' },
    { id: 'pojun', name: '破军符', type: 'attr_buff', eff: { yw_mult: 0.5 }, dur: 24, price: 130, desc: '将领 24 小时内：勇武+50%' },
    { id: 'wolong', name: '卧龙符', type: 'attr_buff', eff: { zm_mult: 0.5 }, dur: 24, price: 130, desc: '将领 24 小时内：智谋+50%' },
    { id: 'longxiang', name: '龙骧符', type: 'attr_buff', eff: { tong_mult: 1 }, dur: 24, price: 300, desc: '将领 24 小时内：统率+100%' },
    { id: 'anmin', name: '安民符', type: 'attr_buff', eff: { nz_mult: 0.75 }, dur: 24, price: 200, desc: '将领 24 小时内：内政+75%' },
    { id: 'tianlang', name: '天狼符', type: 'attr_buff', eff: { yw_mult: 0.75 }, dur: 24, price: 200, desc: '将领 24 小时内：勇武+75%' },
    { id: 'guigu', name: '鬼谷符', type: 'attr_buff', eff: { zm_mult: 0.75 }, dur: 24, price: 200, desc: '将领 24 小时内：智谋+75%' },
    { id: 'wangzuo', name: '王佐双符', type: 'attr_buff', eff: { tong_mult: 0.5, nz_mult: 0.5 }, dur: 24, price: 260, desc: '将领 24 小时内：统率+50%　内政+50%' },
    { id: 'hulang', name: '虎狼双符', type: 'attr_buff', eff: { yw_mult: 0.5, zm_mult: 0.5 }, dur: 24, price: 260, desc: '将领 24 小时内：勇武+50%　智谋+50%' },
    { id: 'sixiang', name: '四象符', type: 'attr_buff', eff: { tong_mult: 0.5, nz_mult: 0.5, yw_mult: 0.5, zm_mult: 0.5 }, dur: 24, price: 480, desc: '将领 24 小时内：统率+50%　内政+50%　勇武+50%　智谋+50%' },
    { id: 'jifeng', name: '疾风符', type: 'attr_buff', eff: { spd: 20 }, dur: 24, price: 90, desc: '将领 24 小时内：速度+20' },
    { id: 'zhuifeng', name: '追风符', type: 'attr_buff', eff: { spd: 50 }, dur: 24, price: 220, desc: '将领 24 小时内：速度+50' },
    { id: 'baye', name: '霸业符', type: 'attr_buff', eff: { tong_mult: 1, yw_mult: 1 }, dur: 24, price: 400, desc: '将领 24 小时内：统率+100%　勇武+100%' },
    { id: 'mingjing', name: '明镜符', type: 'attr_buff', eff: { zm_mult: 1 }, dur: 24, price: 280, desc: '将领 24 小时内：智谋+100%' },
    { id: 'zhisu', name: '治粟符', type: 'attr_buff', eff: { nz_mult: 1 }, dur: 24, price: 280, desc: '将领 24 小时内：内政+100%' },
    { id: 'shennongling', name: '神农灵锄', type: 'prod_buff', res: 'grain', eff: 0.5, dur: 24, price: 12, desc: '粮食产量+50%（24h）' },
    { id: 'houji', name: '后稷神犁', type: 'prod_buff', res: 'grain', eff: 1, dur: 24, price: 30, desc: '粮食产量+100%（24h）' },
    { id: 'lubanshen', name: '鲁班神斧', type: 'prod_buff', res: 'wood', eff: 0.5, dur: 24, price: 12, desc: '木材产量+50%（24h）' },
    { id: 'jumuling', name: '巨木令', type: 'prod_buff', res: 'wood', eff: 1, dur: 24, price: 30, desc: '木材产量+100%（24h）' },
    { id: 'kaishanshen', name: '开山神锤', type: 'prod_buff', res: 'stone', eff: 0.5, dur: 24, price: 12, desc: '石料产量+50%（24h）' },
    { id: 'yugongling', name: '愚公令', type: 'prod_buff', res: 'stone', eff: 1, dur: 24, price: 30, desc: '石料产量+100%（24h）' },
    { id: 'xuantieshen', name: '玄铁神炉', type: 'prod_buff', res: 'iron', eff: 0.5, dur: 24, price: 12, desc: '铁锭产量+50%（24h）' },
    { id: 'ganjianglu', name: '干将炉', type: 'prod_buff', res: 'iron', eff: 1, dur: 24, price: 30, desc: '铁锭产量+100%（24h）' },
    { id: 'yantieling', name: '盐铁令', type: 'prod_buff', res: 'gold', eff: 0.5, dur: 24, price: 20, desc: '黄金产量+50%（24h）' },
    { id: 'taozhufu', name: '陶朱符', type: 'prod_buff', res: 'gold', eff: 1, dur: 24, price: 50, desc: '黄金产量+100%（24h）' },
    { id: 'yingzao_fanglue', name: '营造方略', type: 'build_cost', eff: 0.3, dur: 72, price: 160, desc: '建造成本-30%（72h）' },
    { id: 'jiangzuo_dadian', name: '将作大匠令', type: 'build_cost', eff: 0.4, dur: 24, price: 110, desc: '建造成本-40%（24h）' },
    { id: 'zhuanshu_jiangzuo', name: '匠神尺', type: 'build_cost', eff: 0.5, dur: 24, price: 180, desc: '建造成本-50%（24h）' },
    { id: 'pozhengu', name: '破阵鼓', type: 'military_buff', eff: { atk: 0.15 }, dur: 24, price: 14, desc: '24 小时内：全军攻击+15%' },
    { id: 'xuezhanqi', name: '血战旗', type: 'military_buff', eff: { atk: 0.25 }, dur: 24, price: 26, desc: '24 小时内：全军攻击+25%' },
    { id: 'mieguogu', name: '灭国鼓', type: 'military_buff', eff: { atk: 0.35 }, dur: 24, price: 45, desc: '24 小时内：全军攻击+35%' },
    { id: 'tiebit_tu', name: '铁壁图', type: 'military_buff', eff: { def: 0.15 }, dur: 24, price: 14, desc: '24 小时内：全军防御+15%' },
    { id: 'jincheng_tu', name: '金城图', type: 'military_buff', eff: { def: 0.25 }, dur: 24, price: 26, desc: '24 小时内：全军防御+25%' },
    { id: 'taishan_tu', name: '太山图', type: 'military_buff', eff: { def: 0.35 }, dur: 24, price: 45, desc: '24 小时内：全军防御+35%' },
    { id: 'xuming_shu', name: '续命书', type: 'military_buff', eff: { wound: 0.45 }, dur: 24, price: 130, desc: '24 小时内：战损转伤+45%' },
    { id: 'yisheng_shu', name: '医圣书', type: 'military_buff', eff: { wound: 0.6 }, dur: 24, price: 200, desc: '24 小时内：战损转伤+60%' },
    { id: 'dajiang_qi', name: '大将旗', type: 'military_buff', eff: { cap: 0.4 }, dur: 24, price: 28, desc: '24 小时内：出征上限+40%' },
    { id: 'jiezhi_ling', name: '节制令', type: 'military_buff', eff: { cap: 0.6 }, dur: 24, price: 50, desc: '24 小时内：出征上限+60%' },
    { id: 'gongshou_fu', name: '攻守符', type: 'military_buff', eff: { atk: 0.15, def: 0.15 }, dur: 24, price: 34, desc: '24 小时内：全军攻击+15%　全军防御+15%' },
    { id: 'quanjun_ling', name: '全军令', type: 'military_buff', eff: { atk: 0.2, def: 0.2, cap: 0.2 }, dur: 24, price: 70, desc: '24 小时内：全军攻击+20%　全军防御+20%　出征上限+20%' },
    { id: 'wanquan_ce', name: '万全策', type: 'military_buff', eff: { atk: 0.2, def: 0.2, wound: 0.4 }, dur: 24, price: 200, desc: '24 小时内：全军攻击+20%　全军防御+20%　战损转伤+40%' },
    { id: 'tianshi_ling', name: '天时令', type: 'military_buff', eff: { atk: 0.3, def: 0.3, cap: 0.3, wound: 0.3 }, dur: 24, price: 300, desc: '24 小时内：全军攻击+30%　全军防御+30%　出征上限+30%　战损转伤+30%' },
    { id: 'mojing_can', name: '墨经残卷', type: 'boost', target: 'research', amount: 360, price: 12, desc: '研究缩短 6 小时' },
    { id: 'mojing_quan', name: '墨经全卷', type: 'boost', target: 'research', amount: 1440, price: 40, desc: '研究缩短 24 小时' },
    { id: 'tiangong', name: '天工开物', type: 'boost', target: 'research', pct: 0.5, price: 150, desc: '研究时间-50%' },
    { id: 'hetu', name: '河图洛书', type: 'boost', target: 'research', pct: 0.7, price: 220, desc: '研究时间-70%' },
    { id: 'yingzao_can', name: '营造残卷', type: 'boost', target: 'build', amount: 1440, price: 35, desc: '建造缩短 24 小时' },
    { id: 'yingguo_quan', name: '营国全典', type: 'boost', target: 'build', amount: 2880, price: 70, desc: '建造缩短 48 小时' },
    { id: 'kaogong_quan', name: '考工全书', type: 'boost', target: 'build', pct: 0.4, price: 130, desc: '建造时间-40%' },
    { id: 'jiangzuo_chi', name: '匠作尺', type: 'boost', target: 'build', pct: 0.6, price: 200, desc: '建造时间-60%' },
    { id: 'lianbing_jiyao', name: '练兵纪要', type: 'boost', target: 'train', pct: 0.2, price: 25, desc: '募兵时间-20%' },
    { id: 'dianbing_can', name: '点兵残卷', type: 'boost', target: 'train', pct: 0.4, price: 50, desc: '募兵时间-40%' },
    { id: 'hufu_junling', name: '虎符军令', type: 'boost', target: 'train', pct: 0.75, price: 95, desc: '募兵时间-75%' },
    { id: 'shiwan_jiabing', name: '十万甲兵', type: 'boost', target: 'train', pct: 0.9, price: 140, desc: '募兵时间-90%' },
    { id: 'jixing_ling', name: '疾行令', type: 'boost', target: 'march', amount: 30, price: 40, desc: '行军缩短 1 小时' },
    { id: 'yingzao_yaozhi', name: '营造要旨', type: 'boost', target: 'build', amount: 720, price: 55, desc: '建造缩短 12 小时' },
    { id: 'mojing_yaozhi', name: '墨经要旨', type: 'boost', target: 'research', amount: 720, price: 55, desc: '研究缩短 12 小时' },
    /* v89.95（A3）：**原来这张券没有任何"通道"** —— 使用后只弹一句"折损降低"，
       而那份 buff（tradeCut）全库没人读（典型死接线，老板点名）。
       现在它接的是真通道：**免折抛售**（在"物多价贱"的折价之上开一扇窗）。 */
    { id: 'tongshang_quan', name: '通商券', type: 'boost', target: 'trade', pct: 0.5, price: 30,
      desc: '通商凭信：30 分钟内可**免折抛售**资源，免折额度 50 万金当量（来源：商城）' },
    { id: 'taozhu_mishu', name: '陶朱秘术', type: 'boost', target: 'trade', pct: 0.95, price: 60, desc: '市场折损时间-95%（30 分钟）' },
    { id: 'pijiang_shouji', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '裨将手记', type: 'exp', amount: 500, price: 30, desc: '将领经验+500' },
    { id: 'xiaowei_zhaji', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '校尉札记', type: 'exp', amount: 5000, price: 200, desc: '将领经验+5000' },
    { id: 'jiangjun_zhanlu', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '将军战录', type: 'exp', amount: 50000, price: 1200, desc: '将领经验+50000' },
    { id: 'dudu_bingfa', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '大都督兵法', type: 'exp', amount: 200000, price: 3800, desc: '将领经验+200000' },
    { id: 'mingjiang_xinchuan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '名将心传', type: 'exp', amount: 500000, price: 8000, desc: '将领经验+500000' },
    { id: 'bingxian_yipian', name: '兵仙遗篇', type: 'exp', amount: 1000000, price: 14000, desc: '将领经验+1000000' },
    { id: 'taigong_bingshu', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '太公兵书', type: 'exp', amount: 5000000, price: 50000, desc: '将领经验+5000000' },
    { id: 'bingsheng', name: '千古兵圣', type: 'exp', amount: 20000000, price: 150000, desc: '将领经验+20000000' },
    { id: 'xingjun_san', name: '行军散', type: 'stamina', amount: 0.05, price: 3, desc: '恢复将领体力5%' },
    { id: 'jinchuang_san', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '金疮散', type: 'stamina', amount: 0.15, price: 8, desc: '恢复将领体力15%' },
    { id: 'shengji_gao', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '生肌膏', type: 'stamina', amount: 0.35, price: 18, desc: '恢复将领体力35%' },
    { id: 'huiqi_dan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '回气丹', type: 'stamina', amount: 0.5, price: 26, desc: '恢复将领体力50%' },
    { id: 'peiyuan_dan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '培元丹', type: 'stamina', amount: 0.75, price: 42, desc: '恢复将领体力75%' },
    { id: 'guben_dan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '固本丹', type: 'stamina', amount: 0.9, price: 60, desc: '恢复将领体力90%' },
    { id: 'daluo_dan', name: '大罗金丹', type: 'stamina', amount: 1, price: 85, desc: '恢复将领体力100%' },
    { id: 'shengxin_wan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '生息丸', type: 'stamina', amount: 0.2, price: 11, desc: '恢复将领体力20%' },
    { id: 'jingxin_dan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '静心丹', type: 'stamina', amount: 0.6, price: 34, desc: '恢复将领体力60%' },
    { id: 'huanhun_lu', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '还魂露', type: 'stamina', amount: 0.95, price: 70, desc: '恢复将领体力95%' },
    /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
       **精力族**（type 'energy'）—— 此前精力只有自然回复，一点道具都没有；
       而 battle/state/ui 里四处"精力不足…可服**清心丸**"的提示**引用了不存在的道具**
       （悬空引用，v89.121 'chest' 同族）。本批一次补齐 4 档（v89.104 每族 ≤4 档）：
       清心丸（20%，正是提示里点名的那个）→ 提神散 → 养神丹 → 凝神玉露（100%）。
       价格与体力族同锚（约 0.6~0.8 金/%）：小档便宜跑量，大档贵在"关键时刻一键满"。 */
    { id: 'qingxin_wan', name: '清心丸', type: 'energy', amount: 0.2, price: 12, desc: '恢复将领精力20%' },
    { id: 'tishen_san', name: '提神散', type: 'energy', amount: 0.4, price: 24, desc: '恢复将领精力40%' },
    { id: 'yangshen_dan', name: '养神丹', type: 'energy', amount: 0.7, price: 48, desc: '恢复将领精力70%' },
    { id: 'ningshen_yulu', name: '凝神玉露', type: 'energy', amount: 1.0, price: 80, desc: '恢复将领精力100%' },
    { id: 'yule_maju', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '玉勒马具', type: 'mount_buff', amount: 8, price: 130, desc: '将领速度+8（1h）' },
    { id: 'jinan', name: '金鞍', type: 'mount_buff', amount: 12, price: 200, desc: '将领速度+12（1h）' },
    { id: 'zhaoye_an', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '照夜玉鞍', type: 'mount_buff', amount: 20, price: 330, desc: '将领速度+20（1h）' },
    { id: 'taxue_an', name: '踏雪鞍', type: 'mount_buff', amount: 30, price: 500, desc: '将领速度+30（1h）' },
    { id: 'zhuifeng_an', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '追风鞍', type: 'mount_buff', amount: 45, price: 800, desc: '将领速度+45（1h）' },
    { id: 'tianma_pei', name: '天马辔', type: 'mount_buff', amount: 60, price: 1200, desc: '将领速度+60（1h）' },
    { id: 'chest_zitan', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '紫檀宝箱', type: 'chest', tier: 2, price: 90, desc: '开启随机获得丰厚资源 / 黄金 / 材料' },
    { id: 'chest_jiulong', name: '九龙宝箱', type: 'chest', tier: 3, price: 220, desc: '开启随机获得丰厚资源 / 黄金 / 材料（小概率图纸）' },
    { id: 'chest_tianlu', name: '天禄宝箱', type: 'chest', tier: 3, price: 300, desc: '开启随机获得丰厚资源 / 黄金 / 材料（小概率图纸）' },
    { id: 'corvee1', name: '小役令', type: 'corvee', dur: 24, add: 1, price: 50, desc: '24 小时内同时建造队列 +1' },
    { id: 'corvee2', name: '中役令', type: 'corvee', dur: 24, add: 2, price: 85, desc: '24 小时内同时建造队列 +2' },
    { id: 'corvee5', name: '大役令', type: 'corvee', dur: 24, add: 5, price: 200, desc: '24 小时内同时建造队列 +5' },
    { id: 'corvee3_48', name: '长役令', type: 'corvee', dur: 48, add: 3, price: 190, desc: '48 小时内同时建造队列 +3' },
    { id: 'book_wuzi', name: '《吴子》', type: 'neigong', teach: 'wuzi', price: 160, desc: '修习绝学「治兵」：智谋 +6/重（最高 10 重）' },
    { id: 'book_sima', name: '《司马法》', type: 'neigong', teach: 'sima', price: 160, desc: '修习绝学「严整」：统率 +6/重（最高 10 重）' },
    { id: 'book_sanlue', name: '《三略》', type: 'neigong', teach: 'sanlue', price: 160, desc: '修习绝学「奇正」：勇武 +6/重（最高 10 重）' },
    { id: 'book_weiliu', name: '《尉缭子》', type: 'neigong', teach: 'weiliu', price: 160, desc: '修习绝学「料敌」：内政 +6/重（最高 10 重）' }
    ];
    NEW_ITEMS.forEach(function (x) {
      if (!DATA.ITEMS.some(function (y) { return y.id === x.id; })) DATA.ITEMS.push(x);
    });

    /* ============================================================
     * 经验道具的**量级归一**（v89.73 · 老板报的 bug）
     * ------------------------------------------------------------
     * 老板原话：「商城的 +100W 经验道具，将领直接 240 级满级了，这不对吧」
     *
     * 病根不是某一个数写错，而是**曲线与道具各改各的**：
     *   v89.43（老板拍板）把经验曲线整体缩到 1/32 —— 满级 240 只要
     *   `DATA.EXP_CURVE.total = 100 万`，而这批道具的 `amount` 还是
     *   **缩小前**写死的绝对值：兵仙遗篇 +1,000,000 **正好等于整条曲线**，
     *   太公兵书是它的 5 倍、千古兵圣 20 倍 → 一颗道具一步登天。
     *
     * 修法（治本）：不再写死绝对值，改按**占曲线的百分比** + **配套价格**定义，
     *   由 EXP_CURVE.total 现算。以后再调曲线，道具会自动跟着走，不会再脱节。
     *
     * 阶梯口径（两条都刻意保住，否则"修好一个坏三个"）：
     *   ① 单价越大、**每金换到的经验越多**（大宗优惠）—— 250 → 500 经验/千金，单调递增；
     *   ② 最贵的千古兵圣也只抵曲线的 **1/5**，满级必须多份叠加，
     *      不再有任何单件道具能"一颗到 240"。
     * ⚠️ 价格（元宝）同比下调：曲线缩了 32 倍，价格不缩的话最小的练兵经验
     *    会只剩 3 点经验（等于把道具变成废品）—— 那不是修 bug，是砸系统。
     * 调平衡只改这张表（pct = 占曲线比例，price = 元宝价，金 = price × 100）。
     * ============================================================ */
    DATA.EXP_ITEM_SPEC = [
      { id: 'lianbing_jingyan', name: '练兵经验', pct: 0.0002, price: 8,     was: [100, 10] },
      { id: 'pijiang_shouji',   name: '裨将手记', pct: 0.0005, price: 19,    was: [500, 30] },
      { id: 'bingfa_xinde',     name: '兵法心得', pct: 0.0010, price: 36,    was: [1000, 60] },
      { id: 'xiaowei_zhaji',    name: '校尉札记', pct: 0.0030, price: 102,   was: [5000, 200] },
      { id: 'zhijun_zhidao',    name: '治军之道', pct: 0.0060, price: 192,   was: [10000, 300] },
      { id: 'jiangjun_zhanlu',  name: '将军战录', pct: 0.0150, price: 450,   was: [50000, 1200] },
      { id: 'dudu_bingfa',      name: '大都督兵法', pct: 0.0300, price: 840, was: [200000, 3800] },
      { id: 'mingjiang_xinchuan', name: '名将心传', pct: 0.0600, price: 1560, was: [500000, 8000] },
      { id: 'bingxian_yipian',  name: '兵仙遗篇', pct: 0.1000, price: 2400,  was: [1000000, 14000] },
      { id: 'taigong_bingshu',  name: '太公兵书', pct: 0.1500, price: 3300,  was: [5000000, 50000] },
      { id: 'bingsheng',        name: '千古兵圣', pct: 0.2000, price: 4000,  was: [20000000, 150000] },
    ];
    (function () {
      var total = (DATA.EXP_CURVE && DATA.EXP_CURVE.total) || 1000000;
      DATA.EXP_ITEM_SPEC.forEach(function (sp) {
        var it = null;
        DATA.ITEMS.forEach(function (x) { if (x.id === sp.id) it = x; });
        if (!it) return;                       /* 表里没有就跳过（不凭空造物品） */
        it.amount = Math.max(1, Math.round(total * sp.pct));
        it.price = sp.price;
        it.desc = '将领经验+' + it.amount;
      });
    })();

    /* ---------- ⑤ 四门绝学（每重 +6，强于既有四门的 +4） ---------- */
    var NEW_NG = [
      { id: 'wuzi',    name: '吴子',     trait: '治兵', attr: 'zm',  per: 6, maxLv: 10, desc: '内修文德，外治武备。智谋 +6/重。' },
      { id: 'sima',    name: '司马法',   trait: '严整', attr: 'tong', per: 6, maxLv: 10, desc: '以礼为固，以仁为胜。统率 +6/重。' },
      { id: 'sanlue',   name: '三略',     trait: '奇正', attr: 'yw',  per: 6, maxLv: 10, desc: '柔能制刚，弱能制强。勇武 +6/重。' },
      { id: 'weiliu',   name: '尉缭子',   trait: '料敌', attr: 'nz',  per: 6, maxLv: 10, desc: '料敌合变，出奇无穷。内政 +6/重。' }
    ];
    NEW_NG.forEach(function (x) {
      if (!DATA.NEIGONG.some(function (y) { return y.id === x.id; })) DATA.NEIGONG.push(x);
    });
  })();

  /* ============================================================
   * v89.121（全生命周期模拟抓出的 bug）：**ITEM_BY_ID 表过期**
   * ------------------------------------------------------------
   * 它在上面（v89.116 建表处）只覆盖"那一刻已定义"的物品，而本文件**后段**
   * 又 push 了 100+ 件新物品（通商券 / 灵草 / 新档位 / 四门绝学……）。
   * 后果：凡读 `DATA.ITEM_BY_ID[id]` 的地方（state.js 存档摘要），
   * 对新物品一律回退显示**原始 id**（`tongshang_quan` 而非「通商券」）。
   * 修法：在**全部扩充完成之后**重建一次 —— 建表处保留（早期读取不空），
   * 这里覆盖为全量。smoke §102③ 钉住"两表键数一致"防回退。
   * ============================================================ */
  DATA.ITEM_BY_ID = {};
  (DATA.ITEMS || []).forEach(function (it) { DATA.ITEM_BY_ID[it.id] = it; });

  window.GAME.DATA = DATA;
})();
