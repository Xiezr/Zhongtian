/* ============================================================
 * state.js  运行时状态 / 存档 / 工具函数 / 时间轮（真实数值版 v3）
 * 挂到 window.GAME
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;
  var SAVE_KEY = 'sanguo_save_v3';
  var SAVE_VERSION = 3;

  /* ---------------- 工具函数 ---------------- */
  var U = GAME.utils = {};
  U.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return '' + n;
  };
  /* 精确数字（千分位，不缩写）—— 用于资源存量等需要"肉眼看到在增长"的地方。
     U.fmt 会把 20000 缩写成 "2.0万"、并向下取整，导致每秒 +0.67 的变化完全不可见。
     返回值中整数部分为千分位，小数部分包在 .num-frac 里（暗色小字）。 */
  U.numHTML = function (n, dec) {
    dec = (dec == null) ? 2 : dec;
    var v = Number(n) || 0;
    var neg = v < 0;
    v = Math.abs(v);
    var ip = Math.floor(v);
    var frac = dec > 0 ? (v - ip).toFixed(dec) : '';
    var intStr = String(ip).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + intStr + (frac ? '<span class="num-frac">' + frac.slice(1) + '</span>' : '');
  };
  /* 纯文本版（无 HTML），用于 title / 日志 */
  U.numText = function (n, dec) {
    dec = (dec == null) ? 2 : dec;
    var v = Number(n) || 0;
    return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  /* 存量的"短写"（v65 · 老板）：位数一多就换单位，好让侧栏各行数字宽度齐整。
     老板原话：「左侧资源数量超过 1000 以万显示，超过 100000000 以亿显示，
       现在有点占位置，规划一下显示得齐整一点」。
     · < 1 万  → 千分位精确值（1,234；不动它，四位数以内不占地方）
     · ≥ 1 万  → X.X 万
     · ≥ 1 亿  → X.XX 亿
     与 `U.fmt` 的分工：fmt 用 "k" 这种非中文单位、且 Math.floor 掉零头，
     适合日志与概览；这里供**存量**用，取整规则是"够用就好"。
     单位另包一个 <i> 便于用小字排（视觉上数字部分宽度才稳定）。 */
  U.amtHTML = function (n) {
    var v = Number(n) || 0;
    var neg = v < 0;
    v = Math.abs(v);
    var num, unit;
    if (v >= 1e8) { num = (v / 1e8).toFixed(2); unit = '亿'; }
    else if (v >= 1e4) { num = (v / 1e4).toFixed(1); unit = '万'; }
    else { num = String(Math.floor(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); unit = ''; }
    return (neg ? '-' : '') + num + (unit ? '<i class="amt-u">' + unit + '</i>' : '');
  };
  /* 纯文本版（用于 title 悬停与日志） */
  U.amtText = function (n) {
    return U.amtHTML(n).replace(/<[^>]*>/g, '');
  };
  /* 增速显示：每秒产量（与画面刷新节奏一致，最能体现"在涨"） */
  U.rateHTML = function (perSec) {
    var v = Number(perSec) || 0;
    if (v <= 0) return '<span class="num-rate zero">+0/秒</span>';
    var txt = v >= 100 ? v.toFixed(0) : (v >= 10 ? v.toFixed(1) : v.toFixed(2));
    return '<span class="num-rate">+' + txt + '/秒</span>';
  };
  U.randInt = function (rand, lo, hi) { return Math.floor(rand() * (hi - lo + 1)) + lo; };
  U.escape = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  /* 秒 -> 可读时长 */
  U.dur = function (sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + '秒';
    if (sec < 3600) return Math.floor(sec / 60) + '分' + (sec % 60 ? sec % 60 + '秒' : '');
    if (sec < 86400) return Math.floor(sec / 3600) + '时' + (Math.floor(sec % 3600 / 60) ? Math.floor(sec % 3600 / 60) + '分' : '');
    return Math.floor(sec / 86400) + '天' + (Math.floor(sec % 86400 / 3600) ? Math.floor(sec % 86400 / 3600) + '时' : '');
  };
  /* 秒 -> 精确倒计时（每秒必变）：H:MM:SS 或 MM:SS */
  U.durExact = function (sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (h > 0) return h + ':' + U.pad(m) + ':' + U.pad(s);
    return U.pad(m) + ':' + U.pad(s);
  };

  /* ---------------- 通用工具（v17 重建） ----------------
     这一段的 5 个工具曾被一次「按定义头删函数」的清理误删：定位函数体时用
     `\n  };` 找结尾，撞上了后一个函数的收尾，把中间整段一起吃掉了。
     教训：删函数不能靠"找下一个 `};`" —— 要按缩进/括号配对，或直接给出完整原文。
     其中 U.rng 尤其关键：地图地形、野地等级、野外据点、NPC 守军全部由它派生，
     **算法一经确定就不可更改**，否则所有存档的世界布局会变。 */

  /* 深拷贝（纯 JSON 结构；战斗模拟与存档迁移用） */
  U.deep = function (o) { return (o == null) ? o : JSON.parse(JSON.stringify(o)); };

  /* 限幅 */
  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  /* 确定性随机：同一 seed 必然得到同一序列（mulberry32） */
  U.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* 当前时间戳（毫秒） */
  U.now = function () { return Date.now(); };

  /* 两位补零 */
  U.pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------------- 时间倍率 ----------------
     1 现实秒 = N 游戏秒（默认 120）。设置面板可选 1/10/30/120/300/600。
     所有「游戏秒 ↔ 现实秒」的换算都必须走这里，不要在别处硬编码 120。 */
  GAME.timeScale = function () {
    var s = GAME.state;
    if (s && s.settings && s.settings.timeScale) return s.settings.timeScale;
    return (DATA.DEFAULT_SETTINGS && DATA.DEFAULT_SETTINGS.timeScale) || 120;
  };

  /* 每小时产量 -> 每秒实际增量（含时间倍率） */

  /* ============================================================
   * 城池归属（v60 · 需求 4）
   * ------------------------------------------------------------
   * 老板原话：「将领，人口，资源等是归属于城池的数据，切换城池时，
   *   只统计、呈现当前的数据即可。城池之间，资源需要运输，将领需要派遣。」
   *
   * 实现取「**访问器**」而不是"把 115 处 `s.res` 逐个改成 `city.res`"：
   *   state 上的 `res` 定义成 **getter**，永远指向**当前城池**的 res 对象。
   *   于是：
   *     ① 旧代码 `s.res.gold -= x` 一行不改，语义自动变成"扣当前城池的金"；
   *     ② 不可能"改一处忘一处"（本项目最经典的失效模式）——
   *        物理上只有一份数据，getter 就是唯一出口；
   *     ③ `enumerable:false` → 存档里**不会**出现全局 res 字段，
   *        每城自己那份 `city.res` 随正常序列化走（不需要额外的迁移字段）。
   * ⚠️ 凡是要"按指定城池取值"的地方（产出、耗粮、扣俸禄），一律 `GAME.res(city)`，
   *    不要再写 `GAME.currentCity().res` —— 那样就多出第二个出口了。
   * ============================================================ */
  GAME.RES_KEYS = ['grain', 'wood', 'stone', 'iron', 'gold', 'pop'];
  GAME.emptyRes = function () {
    var o = {};
    GAME.RES_KEYS.forEach(function (k) { o[k] = 0; });
    return o;
  };
  /* 唯一取值口：不传参 = 当前城池 */
  GAME.res = function (city) {
    var c = city || GAME.currentCity();
    if (!c) return GAME._orphanRes || (GAME._orphanRes = GAME.emptyRes());
    if (!c.res) c.res = GAME.emptyRes();
    return c.res;
  };
  /* 全境人口 / 全境人口上限（v60 · 需求 4）。
     ⚠️ 人口归属城池之后，**任何"总人口"都必须走这两个函数** ——
     直接读 s.res.pop 只代表**当前城**，会算出"当前城人口 / 全境上限"这种
     口径错乱的数（这是本轮最容易踩的坑，所以收口成唯一出口）。 */
  GAME.totalPop = function () {
    var s = GAME.state;
    if (!s) return 0;
    return (s.cities || []).reduce(function (a, c) { return a + (GAME.res(c).pop || 0); }, 0);
  };
  GAME.totalPopCap = function () {
    var s = GAME.state;
    if (!s) return 0;
    return (s.cities || []).reduce(function (a, c) { return a + GAME.maxPopOf(c); }, 0);
  };

  /* 把访问器挂到 state 上。**新建游戏与读档后都必须调用一次** ——
     存档是 JSON，反序列化出来的对象没有这个 getter。 */
  GAME.attachRes = function (st) {
    if (!st) return st;
    try {
      Object.defineProperty(st, 'res', {
        get: function () { return GAME.res(); },
        /* 旧档迁移会整体赋值（见 loadGame）；旧代码里没有 `s.res = {...}` 的写法，
           设成"写进当前城"是为了让极端情况不至于静默丢失。 */
        set: function (v) {
          var c = GAME.currentCity();
          if (c && v) c.res = v;
        },
        enumerable: false,
        configurable: true,
      });
    } catch (e) { console.warn('attachRes 失败：', e); }
    return st;
  };

  /* ---------------- 新建玩家城（城内 8×6=48 格，官府居中4格，余44格可建）---------------
     v40（需求 2）：老板要「8*6，6 行 8 列」并「尽量填充界面」——
     格子数据由 col/row 驱动（isoMetrics 早就是参数化的），
     所以这里改两个数、官府落位跟着移到新坐标系即可。 */
  /* 官府 2×2 的落位（唯一出口 · v68 老板）：
     城内棋盘**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
     makeCity / cityPlanOf（系统城）/ 旧档迁移三处都走它，别处不许再写死格号。 */
  GAME.govCellsOf = function (col, row) {
    var gc = Math.floor((col - 2) / 2), gr = Math.floor((row - 2) / 2);
    return [gr * col + gc, gr * col + gc + 1, (gr + 1) * col + gc, (gr + 1) * col + gc + 1];
  };

  GAME.makeCity = function (opts) {
    opts = opts || {};
    var city = {
      id: opts.id || 'p1',
      /* v60：每城一份资源与人口。
         初始库存走 `opts.res`：攻占的城传 `GAME.npcCityRes(city)`（继承该城库存），
         自建城传 `DATA.NEW_CITY_RES`（一小笔启动物资）——
         不传就给 DATA.NEW_CITY_RES，否则新城会因为"0 粮 0 木"连一块田都开不出来。 */
      res: (function () {
        var r = GAME.emptyRes(), src = opts.res || DATA.NEW_CITY_RES || {};
        GAME.RES_KEYS.forEach(function (k) { r[k] = src[k] || 0; });
        return r;
      })(),
      name: opts.name || '新城池',
      x: opts.x != null ? opts.x : DATA.START_POS.x,
      y: opts.y != null ? opts.y : DATA.START_POS.y,
      level: 1,
      def: 0,
      col: 8, row: 6,          /* v40：6 行 8 列 */
      cells: [],
      army: {},
      ruler: true,
      /* 'self' = 自建城/首城（无岁贡，靠外城地块与税收）；
         capital/zhou/jun/county = 攻占的系统名城（有州特产岁贡，见 DATA.CITY_YIELD） */
      type: opts.type || 'self',
      state: opts.state || null,                     // 所属州（决定特产）
      extGrid: GAME.makeExtGrid(opts.initialExt),   // 外城地块按城池独立（v14）
    };
    var total = city.col * city.row;
    for (var i = 0; i < total; i++) city.cells.push({ build: null, pending: null });
    /* 官府占 4 格：v68（老板）移回**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
       落位公式的唯一出口是 GAME.govCellsOf（makeCity / cityPlanOf / 旧档迁移共用）。
       城墙另存 city.wallLv（不占格，见 GAME.buildingLevel 特判）。 */
    var gfIdx = GAME.govCellsOf(city.col, city.row);
    gfIdx.forEach(function (g) { city.cells[g].build = { id: 'guanfu', lvl: 1 }; city.cells[g].official = true; });
    /* 初始民房2座（其余格子玩家自建） */
    DATA.INITIAL_BUILDINGS.forEach(function (bid, idx) {
      var slots = [0, 7, 1, 6, 40]; // 初始民房放四角（v40：按 8 列重排）
      if (bid === 'minfang' && idx < 2) {
        var si = slots[idx];
        if (!city.cells[si].build) city.cells[si].build = { id: bid, lvl: 1 };
      }
    });
    return city;
  };

  /* 外城地块：12 块（官府 Lv1 时）。initial=true 时预置首批资源建筑（仅首城） */
  GAME.makeExtGrid = function (initial) {
    var grid = [];
    for (var i = 0; i < 12; i++) grid.push({ id: 'e' + (i + 1), type: null, lv: 0 });
    if (initial) {
      var init = ['farm', 'farm', 'forest', 'quarry', 'mine'];
      init.forEach(function (t, idx) { grid[idx].type = t; grid[idx].lv = 1; });
    }
    return grid;
  };

  /* ---------------- 新建游戏 ---------------- */
  GAME.newGame = function (rulerOpts) {
    var mapSeed = U.now() % 100000;
    /* v70（老板需求 5）：出生坐标按**所选州**落位（州治近旁的平原空地），
       司隶以洛阳为锚；落不到才回退旧口径的固定点。出生城写明所属州 ——
       展示、岁贡、州特产都读同一份归属。 */
    var startPos = GAME.pickStartPos(rulerOpts.region, mapSeed);
    var city = GAME.makeCity({
      id: 'p1',
      name: rulerOpts.cityName || '新城池',
      x: startPos.x, y: startPos.y,
      state: startPos.state,
      initialExt: true,          // 首城预置 2 田 1 木 1 石 1 铁
      res: U.deep(DATA.INITIAL_RES),   // v60：开局库存进首城（不再是全境共享的 s.res）
    });
    var gen = GAME.makeGeneral(DATA.INITIAL_GENERAL, 1, 'idle', city.id, true);
    /* v70：君主头像 seed **只摇一次**，ruler 与君主将领共用 ——
       各摇一次就是两张脸（顶栏一个、将领页一个），正是"头像不一致"的根因。 */
    var lordSeed = rulerOpts.portraitSeed != null
      ? rulerOpts.portraitSeed
      : Math.floor(Math.random() * 4294967296);
    GAME.state = {
      version: SAVE_VERSION,
      ruler: {
        name: rulerOpts.name || '无名君主',
        avatar: rulerOpts.avatar || '🧔',
        gender: rulerOpts.gender || 'male',
        /* v70：记**解析后**的州（'random' 也记成抽到的那一州）——
           创建界面的选择因此可复盘，出生城的归属与它一致 */
        region: startPos.state || rulerOpts.region || 'random',
        /* v45（需求 2）：主角头像改为**从 20 张头像池里随机取一张**。
           不给固定值的话每局君主长同一张脸（池子是按名字 hash 取的），
           所以开局就摇一个种子存进存档 —— 之后每局固定、不再刷新就换脸。
           `rulerOpts.portraitSeed` 供测试注入确定值。 */
        portraitSeed: lordSeed,
      },
      /* v60：**state 上不再有 res 字段** —— 它由 attachRes 挂成访问器，
         指向当前城池的库存（`city.res`）。这里写字面量反而会盖掉 getter。 */
      cities: [city],
      /* v70（老板）：君主本人也是一位将领 —— 排在末尾，不动既有索引口径
         （`generals[0]` 仍是开局名将，测试与旧档迁移都按原样） */
      generals: [gen, GAME.makeLordGeneral(rulerOpts, lordSeed, city.id)],
      queues: { build: [], train: [], tech: [] },
      marches: [],
      /* v70：出生点随"所选州"走 —— 地图生成时的"出生圈强制平原"与据点安全半径
         都读 `map.startPos`（见 map.js），旧档缺字段则回退 DATA.START_POS。 */
      map: { seed: mapSeed, cities: GAME.buildNpcCities(mapSeed), wilds: null,
        startPos: { x: startPos.x, y: startPos.y } },
      rep: 0,
      rank: 0,
      mainCityId: null,          // v79：主城（官府里设；驻跸加成 + 【主城】标识）
      artifacts: { pts: 0 },     // v79：神器供奉值（时长自动 + 活动加速）
      hearts: DATA.DEFAULT_SETTINGS.hearts,     // 民心
      tax: DATA.DEFAULT_SETTINGS.tax,           // 税率 0~1
      workRate: { grain: 100, wood: 100, stone: 100, iron: 100 }, // 开工率（原版机制）
      settings: U.deep(DATA.DEFAULT_SETTINGS),
      techs: {},
      items: U.deep(DATA.INITIAL_ITEMS),        // 宝物背包 {itemId: count}
      /* v79（老板第 4 条）：装备**单件化** —— 背包存实例 { u, id, enh }：
         u = 件号（同名以 甲/乙/丙 区分）· id = 装备谱 · enh = 该件百炼等级 */
      inventory: (DATA.INITIAL_EQUIP || []).map(function (id, i) { return { u: i + 1, id: id, enh: 0 }; }),
      nextEqU: (DATA.INITIAL_EQUIP || []).length,
      forged: [],                               // 已打造过的装备（图鉴用）
      salaryAt: 0,                              // v77：将领月俸上次结算锚点（游戏秒）
      wilds: [],                                // 已占领野地
      fortsRazed: {},                           // 今日已攻取的野外城池 { 'x,y': dayIndex }
      /* v63（老板）：「野外城每天只能被掠夺一次」—— 与 fortsRazed 同一套记法
         （键 = 'x,y'，值 = 游戏日索引），过一天自动失效，不需清理任务。 */
      fortRaids: {},                            // 今日已掠夺的野外城池 { 'x,y': dayIndex }
      yieldDay: null,                           // 上次州郡岁贡结算的现实日（null = 尚未结算过）
      gathers: [],                              // 野地采集队（v15）：{ id,x,y,type,level,genId,army,troops,cityId,elapsed }
      /* 叙事层（story.js）：世界历法 / 史书纪事 / 年号纪元 */
      world: null,                              // 由 GAME.story.init() 填充
      chronicle: [],                            // 史册条目
      chronicleDone: {},                        // 已记录过的里程碑 id
      eraHistory: [],                           // 已完成的时代之志
      quests: { done: {}, stash: {}, pool: [], poolDay: null, log: [] },
      /* 累计统计（任务指标来源，跨存档保留） */
      stats: { buildDone: 0, techDone: 0, trained: 0, forgedCount: 0, recruited: 0,
               trades: 0, wins: 0, conquer: 0, itemsUsed: 0 },
      reports: [],
      repUnread: 0,                             // v41（需求 4）：未读新战报数 → 公文菜单图标闪黄
      repUnread: 0,                             // v41（需求 4）：未读新战报数 → 公文菜单图标闪黄
      log: [],                                  // 存档内最近 40 条（紧凑）
      msgLog: [],                               // v16：完整消息流（保留 10 游戏天 / 至少 300 条）
      createdAt: U.now(),
      savedAt: U.now(),
    };
    GAME.attachRes(GAME.state);   // v60：挂上「当前城池库存」访问器（必须在 story.init 之前）
    if (GAME.story) GAME.story.init();
    GAME.syncSeq();            // 发号起点对齐（防新将撞号）
    return GAME.state;
  };

  /* 累计统计（供任务指标读取） */
  GAME.statBump = function (key, n) {
    var s = GAME.state;
    if (!s) return;
    s.stats = s.stats || {};
    s.stats[key] = (s.stats[key] || 0) + (n || 1);
  };
  GAME.stat = function (key) {
    var s = GAME.state;
    return (s && s.stats && s.stats[key]) || 0;
  };

  /* 初始将领（资质随机；四维按资质区间 roll 后叠加倾向系数） */
  /* ------------------------------------------------------------
   * 将领 id 自增序号（v14.1 修复撞号）
   * 症状：读档后新招募的将领与存档内旧将 **id 相同**（页面刚加载 _genSeq 为 0，
   *       第一个新将必得 g1，而存档里已有 g1），于是
   *       `s.generals.forEach(x => if(x.id===genId) g=x)` 会取到**最后一个**同号者，
   *       表现为「点第一个将领，操作到的却是后面那一个」。
   * 对策：① 读档/新游戏后按存档内最大号续号；② 发号时暴力避让已用 id。
   * ------------------------------------------------------------ */
  GAME.syncSeq = function () {
    var s = GAME.state, max = 0;
    function scan(id) {
      var m = /^g(\d+)$/.exec(id || '') || /^cd(\d+)$/.exec(id || '');
      if (m) max = Math.max(max, Number(m[1]));
    }
    ((s && s.generals) || []).forEach(function (g) { scan(g.id); });
    ((s && s.inn && s.inn.candidates) || []).forEach(function (c) { scan(c.id); });
    GAME._genSeq = Math.max(GAME._genSeq || 0, max);
    GAME._cndSeq = Math.max(GAME._cndSeq || 0, max);
    return max;
  };
  /* 取下一个不与现有将领冲突的 id */
  GAME.nextGenId = function () {
    var s = GAME.state, used = {};
    ((s && s.generals) || []).forEach(function (g) { if (g && g.id) used[g.id] = true; });
    var id, guard = 0;
    do { id = 'g' + (GAME._genSeq = (GAME._genSeq || 0) + 1); } while (used[id] && ++guard < 10000);
    return id;
  };

  GAME.makeGeneral = function (name, level, status, cityId, isStarter, rankId, styleId) {
    var b = DATA.GEN_BASE;
    var rk = DATA.GEN_RANK_BY_ID[rankId] || DATA.GEN_RANK_BY_ID.liang;
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === styleId) st = x; });
    if (!st) st = DATA.GEN_STYLES[0];
    var rand = U.rng((U.now() + (GAME._genSeq || 0) * 977 + Math.floor(Math.random() * 1e7)) >>> 0);
    function roll() { return U.randInt(rand, rk.base[0], rk.base[1]); }
    var g = {
      id: GAME.nextGenId(),
      name: name, level: level || 1, exp: 0,
      avatar: '🧔',
      tong: Math.round(roll() * st.mul.tong),
      nz: Math.round(roll() * st.mul.nz),
      yw: Math.round(roll() * st.mul.yw),
      zm: Math.round(roll() * st.mul.zm),
      attack: b.attack, defense: b.defense, speed: b.speed, hp: b.hp,
      stamina: b.stamina, energy: b.energy,
      loyalty: isStarter ? 100 : b.loyalty, salary: 0,
      status: status || 'idle',
      cityId: cityId || null,
      equip: {},
      perm: { tong: 0, nz: 0, yw: 0, zm: 0 },
      rank: rk.id, style: st.id,
    };
    /* v22（需求 2）：招募即定下肖像 seed —— 存档只存这个整数，不存图片 */
    if (GAME.portraits) GAME.portraits.assign(g);
    return g;
  };

  /* ============================================================
   * 君主将领（v70 · 老板）—— 唯一出口
   * ------------------------------------------------------------
   * 老板原话：「增加一个角色将领（即玩家角色本身，具有将领的所有功能，
   *   但是不可解雇，留可扩张框架，后续将设计普通将领不具备的功能）」
   *
   * 口径：
   *   · 君主**就是一名将领**（进 `state.generals`，装备 / 出征 / 守将 / 派遣 /
   *     经验……全部功能照用），靠 `isLord` 一位区分；
   *   · 不可解雇（`GAME.dismissGeneral` 守卫）+ 不会因忠诚离去（两处离职判定守卫）；
   *   · 头像 seed 与顶栏君主头像**同源**（`ruler.portraitSeed`）——
   *     各摇一次就是两张脸，正是"创建界面头像与将领不一致"那一类问题的根因；
   *   · 君主**专属功能**的扩张点是 `DATA.LORD_TRAITS`（档案里渲染成「君主特权」）。
   * ============================================================ */
  GAME.isLordGeneral = function (g) { return !!(g && g.isLord); };
  /* v89（老板：「只有君主将有修炼功能，以及相应装备」）——
     修炼资格**唯一闸门**：灵气装备 / 蕴养 / 江湖游历全链只认君主一人
     （对应功法文档 0.1「主角单修」）。全站判断一律走这里，日后要放开只改这一处。 */
  GAME.canCultivate = function (g) { return GAME.isLordGeneral(g); };
  /* 当前君主将领（无则 null —— 所有调用点都必须能接受 null） */
  GAME.lordGeneralOf = function () {
    var s = GAME.state, hit = null;
    ((s && s.generals) || []).forEach(function (g) { if (!hit && GAME.isLordGeneral(g)) hit = g; });
    return hit;
  };
  /* 君主专属能力清单（框架出口）：普通将领返回空数组 —— 界面据此整块不渲染 */
  GAME.lordTraitsOf = function (g) {
    return GAME.isLordGeneral(g) ? (DATA.LORD_TRAITS || []) : [];
  };
  /* ============================================================
   * 出生坐标（v70 · 老板需求 5）—— 唯一出口
   * ------------------------------------------------------------
   * 老板：「城池归属应归属到州城所辖范围内，目前几个选项不太 OK」
   * 口径：选了某个州 → 出生城落在**该州州治近旁**的确定性环带（半径 3~8 格），
   *   并要求 `GAME.stateOfCity(落点)` 就是该州 —— "所辖范围"与就近认领是**同一判据**，
   *   不另画一套边界（画了就是第二个出口）。
   *   司隶无州城 → 锚点取都城洛阳（与 stateOfCity 的口径一致）。
   * 约束：不压任何系统城（±2 缓冲）、不越界；由 (州名, 种子) 确定性生成 —— 同种子同落点。
   * ============================================================ */
  GAME.pickStartPos = function (stateName, seed) {
    var states = DATA.START_STATES || [];
    var rand = U.rng((Math.round(seed) || 1) >>> 0);
    var name = String(stateName == null ? '' : stateName);
    if (name !== 'random' && states.indexOf(name) < 0) name = 'random';
    if (name === 'random') name = states[Math.floor(rand() * states.length)] || '司隶';
    var anchor = null;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (anchor) return;
      if (c.type === 'zhou' && c.state === name) anchor = c;
      if (!anchor && name === '司隶' && c.type === 'capital') anchor = c;
    });
    if (!anchor) anchor = { x: DATA.START_POS.x, y: DATA.START_POS.y };
    var free = function (x, y) {
      if (x < 3 || y < 3 || x > DATA.MAP_W - 4 || y > DATA.MAP_H - 4) return false;
      var hit = false;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (Math.abs(c.x - x) <= 2 && Math.abs(c.y - y) <= 2) hit = true;
      });
      if (hit) return false;
      return GAME.stateOfCity({ x: x, y: y }) === name;
    };
    for (var i = 0; i < 240; i++) {
      var ang = rand() * Math.PI * 2, rad = 3 + rand() * 5;
      var x = Math.round(anchor.x + Math.cos(ang) * rad);
      var y = Math.round(anchor.y + Math.sin(ang) * rad);
      if (free(x, y)) return { x: x, y: y, state: name };
    }
    /* 兜底：环带扫不到就自锚点向外做确定性扫描（保证**必有**可用点） */
    for (var r = 3; r <= 26; r++) {
      for (var dx = -r; dx <= r; dx++) {
        for (var dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var bx = anchor.x + dx, by = anchor.y + dy;
          if (free(bx, by)) return { x: bx, y: by, state: name };
        }
      }
    }
    return { x: DATA.START_POS.x, y: DATA.START_POS.y, state: name };
  };

  GAME.makeLordGeneral = function (rulerOpts, seed, cityId) {
    var L = DATA.LORD_GEN || {};
    var r = rulerOpts || {};
    var g = GAME.makeGeneral(r.name || '君主', L.level || 1, 'idle',
      cityId || null, true, L.rankId, L.styleId);
    g.id = 'lord';                     /* 稳定 id：'lord' 不匹配 /^(g|cd)\d+$/，不与 nextGenId 撞车 */
    g.isLord = true;
    g.name = r.name || g.name;
    g.gender = r.gender || 'male';
    g.portraitSeed = (seed != null) ? seed : GAME.portraits.seedOf(g);
    g.loyalty = 100;                   /* 永不离去（离职判定另有两处守卫） */
    g.salary = 0;                      /* 君主不领俸禄 */
    /* 六维取资质区间的**中值**（不掷骰、不吃 Math.random）：
       君主是玩家本人 —— 随机会让"老档迁移"读一次变一次，也无从比较两局；
       中值 = 该资质的标准水平，可复算、可断言。 */
    var rk = (DATA.GEN_RANK_BY_ID && DATA.GEN_RANK_BY_ID[L.rankId]) || DATA.GEN_RANK_BY_ID.liang;
    var style = DATA.GEN_STYLES[0];
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === L.styleId) style = x; });
    var mid = Math.round((rk.base[0] + rk.base[1]) / 2);
    g.tong = Math.round(mid * style.mul.tong);
    g.nz = Math.round(mid * style.mul.nz);
    g.yw = Math.round(mid * style.mul.yw);
    g.zm = Math.round(mid * style.mul.zm);
    return g;
  };

  /* 生成历史名将（野地抓将/占领名城必降） */
  GAME.makeHero = function (h, level) {
    var sum = (h.tong || 0) + (h.yw || 0) + (h.zm || 0) + (h.nz || 0);
    var rk = GAME.heroRank(sum);
    level = level || Math.max(20, Math.min(100, Math.round(sum / 4 * 1.1)));
    var g = {
      id: GAME.nextGenId(),
      name: h.name, level: level, exp: 0,
      avatar: '🧔',
      tong: h.tong, nz: h.nz, yw: h.yw, zm: h.zm,
      attack: Math.round(h.yw / 3), defense: Math.round(h.zm / 3), speed: 20, hp: 500 + h.tong * 5,
      stamina: 100, energy: 100,
      loyalty: 10,
      status: 'idle', cityId: null,
      equip: {},
      perm: { tong: 0, nz: 0, yw: 0, zm: 0 },
      rank: rk.id, style: 'balance',
      hero: true,
    };
    /* v22：史实名将挂上专属 AI 头像的 key（文件缺失时自动回退立绘） */
    if (GAME.portraits) GAME.portraits.assign(g);
    return g;
  };

  /* 史实名将的资质：按四维总和判定 */
  GAME.heroRank = function (sum) {
    var line = DATA.HERO_RANK_LINE || [];
    for (var i = 0; i < line.length; i++) if (sum >= line[i].min) return DATA.GEN_RANK_BY_ID[line[i].id];
    return DATA.GEN_RANKS[0];
  };

  /* 取将领资质定义（旧档无 rank 字段则按四维自动补判并写回） */
  GAME.rankOf = function (g) {
    if (!g) return DATA.GEN_RANKS[0];
    if (g.rank && DATA.GEN_RANK_BY_ID[g.rank]) {
      /* v74：自由属性点的懒初始化必须**两条路径都走到** ——
         makeGeneral 一造出来就写好 rank，走的是这条提前返回；
         漏了这里，所有"旧档/已生成"的将领永远拿不到补发。 */
      var rkE = DATA.GEN_RANK_BY_ID[g.rank];
      if (g.freePts == null) {
        g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rkE.grow || 1);
      }
      return rkE;
    }
    var sum = (g.tong || 0) + (g.yw || 0) + (g.zm || 0) + (g.nz || 0);
    var rk = g.hero ? GAME.heroRank(sum) : (function () {
      /* 客栈旧档：按四维均值反推最接近的资质 */
      var avg = sum / 4, best = DATA.GEN_RANKS[0];
      DATA.GEN_RANKS.forEach(function (r) {
        if (avg >= (r.base[0] + r.base[1]) / 2 - 4) best = r;
      });
      return best;
    })();
    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    /* v74（老板需求 5）：自由属性点字段的懒初始化（一次性）——
       旧档将领**按已过等级补发**：每级 = 该资质成长值（与 applyLevelGrowth 同口径）。
       标记方式就是字段本身（null = 还没初始化过；之后每升一级 += 成长值）。 */
    if (g.freePts == null) {
      g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rk.grow || 1);
    }
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
    };
  };

  /* 资质随客栈等级的出现权重（高级客栈更容易出高资质） */
  GAME.rankWeights = function (innLv) {
    var lv = Math.max(1, innLv || 1);
    var out = [];
    DATA.GEN_RANKS.forEach(function (r) {
      /* v66：下限从**写死的 0.5** 改成**按自身基准的 5%**。
         原因：老板要求天授出现率降 10 倍（w 2 → 0.2），而 0.5 这道下限会把 0.2
         直接抬回 0.5 —— 表里改了、界面上没变，属于"改了等于没改"的静默失效。
         下限本身仍要保留：凡品 wg 为负（-0.06），客栈 18 级以上会算成负权重。
         现在：凡品最低 2.5、天授最低 0.01，两边都不再被误伤。 */
      out.push({ rank: r, w: Math.max(r.w * 0.05, r.w * (1 + (r.wg || 0) * (lv - 1))) });
    });
    return out;
  };
  GAME.pickRank = function (innLv) {
    var ws = GAME.rankWeights(innLv), total = 0;
    ws.forEach(function (x) { total += x.w; });
    var roll = Math.random() * total;
    for (var i = 0; i < ws.length; i++) { roll -= ws[i].w; if (roll <= 0) return ws[i].rank; }
    return ws[0].rank;
  };
  GAME.pickStyle = function (rank) {
    if (!rank || rank.id === 'fan') return DATA.GEN_STYLES[0];
    var list = DATA.GEN_STYLES, total = 0;
    list.forEach(function (x) { total += x.w; });
    var roll = Math.random() * total;
    for (var i = 0; i < list.length; i++) { roll -= list[i].w; if (roll <= 0) return list[i]; }
    return list[0];
  };

  /* 将领成长：资质决定每级增加的点数（差异化核心） */
  GAME.applyLevelGrowth = function (g) {
    var rk = GAME.rankOf(g);
    var step = rk.grow || 1;
    /* v74（老板需求 5）：「不同类型（均衡 / 猛将等）将领，升级自动加点不同。
       根据资质，每级除了其成长之外，还有等于成长值的自由属性点」。
       · 自动加点 = step × 类型权重 —— 权重**复用 DATA.GEN_STYLES 的 mul**
         （造人时那套特性表，不再另造一份；归一化到总和 4，
          均衡 1/1/1/1 与旧行为逐点一致，老档只受影响于新涨的等级）；
       · 自由属性点 = step —— 玩家在六维表逐点分配（唯一出口 GAME.addFreePoint）。 */
    var st74 = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st74 = x; });
    var m74 = (st74 && st74.mul) || { tong: 1, nz: 1, yw: 1, zm: 1 };
    var sum74 = (m74.tong + m74.nz + m74.yw + m74.zm) || 4;
    var f74 = 4 / sum74;
    g.tong += step * m74.tong * f74;
    g.yw += step * m74.yw * f74;
    g.zm += step * m74.zm * f74;
    g.nz += step * m74.nz * f74;
    g.freePts = (g.freePts == null ? 0 : g.freePts) + step;
    g.attack = Math.round(g.attack + step * 0.4);
    g.defense = Math.round(g.defense + step * 0.4);
    /* v29（需求 11）：**不再写 g.hp**。
       等级血量原本走 `g.hp += step*12`，再被 battle.hpMultOf 当"装备生命"折算成
       全军生命加成 —— 一路算下来，真正决定生命的是等级，装备只是搭便车。
       现在生命**只由「体力」承担**（GAME.staMax = 等级/资质/内政 + 装备与套装体力），
       v66 起装备体力也并进这条链，battle 里不再有并行的第二条加成。
       注意：旧存档里已经涨上去的 g.hp 保留不清零，等于一份历史加成，
       不会再涨，也不会凭空消失。 */
    return step;
  };


  /* 自由属性点分配（v74 · 老板需求 5 · **唯一出口**）：
     六维都能加（统率/内政/勇武/智谋/速度/体力），**只能加、不能减**。
     四项主属性走 g[stat]+=1；速度 / 体力另有独立加法位（spdAdd / staAdd），
     由 genAttrs 与 staBaseMax 各自吃进去 —— 属性本身保持"基础值"不被污染。 */
  GAME.addFreePoint = function (g, stat) {
    if (!g || ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'].indexOf(stat) < 0) {
      return { ok: false, msg: '该属性不支持加点' };
    }
    if ((g.freePts || 0) < 1) {
      return { ok: false, msg: '自由属性点不足（升级获得：每级 = 资质成长值）' };
    }
    g.freePts -= 1;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + 1;
    else if (stat === 'sta') g.staAdd = (g.staAdd || 0) + 1;
    else g[stat] = (g[stat] || 0) + 1;
    GAME.log('🎯 ' + g.name + ' ' + nm + ' +1（自由点 -1，余 ' + g.freePts + '）');
    return { ok: true, msg: g.name + ' ' + nm + ' +1（余 ' + g.freePts + ' 点）' };
  };

  /* 生成 NPC 城 */
  GAME.buildNpcCities = function (seed) {
    return U.deep(DATA.NPC_CITIES).map(function (c) {
      c.owner = 'npc';
      c.garrison = GAME.genGarrison(c);
      c.maxArmy = c.garrison;
      return c;
    });
  };

  /* 按名城等级生成守军：**总数 = 同等级野外城池守军 × DATA.NPC_CITY_RES.garrisonMul(10)**
     （v63 · 老板：「其兵力可设定为野外城的10倍数」），兵种构成按等级解锁
     （见 DATA.NPC_CITY_RES.garrisonMix —— 等级越高越有铁骑与攻城器械）。
     改前是 `200 × 2.2^(lv-1)` 的独立公式：与野外城池那套（50 × 1.95^(lv-1)）互不相干，
     9 级城只有 4.4 万，比同等级野外城池（10.6 万）还**少** —— 名城的"重"没有体现。
     唯一出口：总数走 `GAME.map.fortGarrison`，改野外城守军表时名城跟着动。 */
  GAME.genGarrison = function (c) {
    var lv = c.level || 5;
    var mix = (DATA.NPC_CITY_RES && DATA.NPC_CITY_RES.garrisonMix) || [];
    var mul = (DATA.NPC_CITY_RES && DATA.NPC_CITY_RES.garrisonMul) || 1;
    /* 目标总数 = 同等级野外城池守军 × 倍数 */
    var fg = (GAME.map && GAME.map.fortGarrison) ? GAME.map.fortGarrison(lv) : {};
    var want = 0;
    for (var fk in fg) want += fg[fk] || 0;
    want = Math.round(want * mul);
    var use = mix.filter(function (m) { return lv >= m.minLv && DATA.TROOPS[m.id]; });
    var wSum = use.reduce(function (a, m) { return a + m.w; }, 0) || 1;
    var g = {}, placed = 0;
    use.forEach(function (m, i) {
      /* 最后一种吃余额，保证"分完之后总数**恰好**等于 want" ——
         逐个 round 会漂几个兵，那种误差在"10 倍"这种口径上是说不清的。 */
      var n = (i === use.length - 1) ? (want - placed) : Math.round(want * m.w / wSum);
      if (n > 0) { g[m.id] = n; placed += n; }
    });
    return g;
  };

  /* ============================================================
   * 名城档位优势（v60 · 需求 5）
   * ------------------------------------------------------------
   * 「名城专有的资源、优势，或者选项」里的**优势**这一层：
   * 按城档位（都城/州治/郡治/县城/自建）给本城经营加成。
   * 唯一出口 `GAME.perkOf` —— 别处不要再按 city.type 写分支
   * （写了就是第二个出口，改一处忘一处）。
   * ============================================================ */
  GAME.perkOf = function (city) {
    var type = (city && city.type) || 'self';
    return DATA.CITY_PERK[type] || DATA.CITY_PERK.self;
  };
  GAME.perkNum = function (city, key) {
    var p = GAME.perkOf(city);
    return (p && p[key]) || 0;
  };

  /* ============================================================
   * v79 加成四层（爵位 / 主城 / 神器 + 名城档位）—— **唯一汇总出口**
   * ------------------------------------------------------------
   * 老板三条：「爵位加成」「主城加成」「神器加成」。
   * 它们的落点是同一批经营量（产量/税收/仓储/席位/野地上限…），
   * 所以**合并到一个函数**里相加 —— 消费点永远只调 cityBonusNum，
   * 别处再拼第二个汇总就是本项目的经典失效模式（改了不生效）。
   * ============================================================ */
  /* ① 爵位加成：22 级曲线在 DATA.RANK_BONUS（与 DATA.RANK 同序） */
  GAME.rankBonusOf = function (i) {
    return (DATA.RANK_BONUS || [])[i == null ? ((GAME.state && GAME.state.rank) || 0) : i] || {};
  };
  GAME.rankBonusNum = function (key) {
    var s = GAME.state;
    return (GAME.rankBonusOf((s && s.rank) || 0)[key]) || 0;
  };

  /* ② 主城：每人 1 个（s.mainCityId；新档为空，官府里设） */
  GAME.mainCityOf = function () {
    var s = GAME.state;
    if (!s || !s.mainCityId) return null;
    return GAME.cityById(s.mainCityId);
  };
  GAME.isMainCity = function (city) {
    var s = GAME.state;
    return !!(s && city && s.mainCityId && city.id === s.mainCityId);
  };
  GAME.mainCityBonusNum = function (city, key) {
    if (!GAME.isMainCity(city)) return 0;
    return (DATA.MAIN_CITY.bonus || {})[key] || 0;
  };
  /* 设为主城（首设免费；已有主城时改设收 DATA.MAIN_CITY.moveCost） */
  GAME.setMainCity = function (cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (GAME.isMainCity(city)) return { ok: false, msg: '「' + city.name + '」已是主城' };
    var cost = GAME.mainCityOf() ? (DATA.MAIN_CITY.moveCost || {}) : null;
    if (cost && cost.gold) {
      if ((s.res.gold || 0) < cost.gold) {
        return { ok: false, msg: '迁都需 ' + U.fmt(cost.gold) + ' 金（从府库扣）' };
      }
      s.res.gold -= cost.gold;
    }
    s.mainCityId = city.id;
    GAME.log('🏯 定「' + city.name + '」为主城（' + (DATA.MAIN_CITY.desc || '') + '）');
    return { ok: true, msg: '「' + city.name + '」定为主城' + (cost && cost.gold ? '（迁都花费 ' + U.fmt(cost.gold) + ' 金）' : '') };
  };

  /* ③ 神器：共用一个供奉值池（时长为主 + 活动加速），等级 = 翻过的门槛数 */
  GAME.artStore = function () {
    var s = GAME.state;
    if (!s) return { pts: 0 };
    if (!s.artifacts) s.artifacts = { pts: 0 };
    return s.artifacts;
  };
  GAME.artPts = function () { return GAME.artStore().pts || 0; };
  GAME.artLevelOf = function (artId) {
    var pts = GAME.artPts(), T = (DATA.ARTIFACT && DATA.ARTIFACT.pts) || [], lv = 0;
    for (var i = 0; i < T.length; i++) { if (pts >= T[i]) lv = i + 1; }
    return Math.min(lv, (DATA.ARTIFACT && DATA.ARTIFACT.maxLv) || 10);
  };
  GAME.artGain = function (n, why) {
    n = Math.round(n || 0);
    if (n <= 0) return 0;
    var st = GAME.artStore();
    var lv0 = GAME.artLevelOf();
    st.pts += n;
    var lv1 = GAME.artLevelOf();
    GAME.log('🏺 供奉 +' + U.fmt(n) + (why ? '（' + why + '）' : '') + '　当前 ' + U.fmt(st.pts));
    if (lv1 > lv0) {
      (DATA.ARTIFACTS || []).forEach(function (a) {
        GAME.log('🏺 「' + a.name + '」升至 Lv' + lv1 + ' —— ' + ui77ArtEff(a, lv1));
      });
    }
    return n;
  };
  /* 神器加成（唯一消费口）：Σ 每件神器 等级 × per[key] */
  GAME.artifactBonusNum = function (key) {
    var out = 0;
    (DATA.ARTIFACTS || []).forEach(function (a) {
      var lv = GAME.artLevelOf(a.id);
      if (!a.per || !a.per[key]) return;
      out += a.per[key] * lv;
    });
    return out;
  };
  /* 神器效果文案（日志与界面共用） */
  function ui77ArtEff(a, lv) {
    var parts = [];
    for (var k in (a.per || {})) {
      parts.push(({ prodPct: '产量', taxPct: '税收', storePct: '仓储', genExpPct: '将领经验', repPct: '声望获得' }[k] || k)
        + ' +' + Math.round(a.per[k] * lv * 100) + '%');
    }
    return parts.join(' · ') || '—';
  }
  GAME.artEffText = ui77ArtEff;
  /* 时长积累（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.artTick = function (secGame) {
    if (!secGame || secGame <= 0) return;
    var rate = (DATA.ARTIFACT && DATA.ARTIFACT.perGameHour) || 0;
    if (!rate) return;
    GAME.artGain(secGame / 3600 * rate, '');
  };

  /* 爵位加成文案（爵位表 / 君主面板共用） */
  GAME.rankBonusText = function (i) {
    var b = GAME.rankBonusOf(i);
    var parts = [];
    if (b.prodPct) parts.push('产+' + Math.round(b.prodPct * 100) + '%');
    if (b.taxPct) parts.push('税+' + Math.round(b.taxPct * 100) + '%');
    if (b.storePct) parts.push('储+' + Math.round(b.storePct * 100) + '%');
    if (b.buildSlot) parts.push('造+' + b.buildSlot);
    if (b.wildCap) parts.push('野+' + b.wildCap);
    if (b.genCap) parts.push('席+' + b.genCap);
    return parts.join(' ') || '—';
  };
  /* 汇总：名城档位 + 爵位 + 主城 + 神器（四层相加，唯一出口） */
  GAME.cityBonusNum = function (city, key) {
    return GAME.perkNum(city, key) + GAME.rankBonusNum(key)
      + GAME.mainCityBonusNum(city, key) + GAME.artifactBonusNum(key);
  };
  /* 是不是"名城"（有档位加成的系统城）。v61：野外城池不算 —— 它有 CITY_PERK 档位
     （为了走同一套派生公式），但没有档位加成，不该在界面上被叫"名城"。 */
  GAME.isFamousCity = function (city) {
    city = city || GAME.currentCity();
    return !!(city && city.type && city.type !== 'self' && city.type !== 'fort'
      && DATA.CITY_PERK[city.type]);
  };

  /* ============================================================
   * 未占据名城的派生数据（v60 · 需求 6）
   * ------------------------------------------------------------
   * 老板：「为所有未被占据的城池，根据其等级设定一定资源量，比如9级城池，
   *   其建筑默认全满，均9级，在这种情况下的资源量。均有守将，为守将六维进行
   *   随机设定（避免存储，在接触时生成即可，如名称，等级，属性等）」
   *
   * 三样（库存 / 建筑 / 守将）**全部派生、不入存档**，由 `(城 id, 等级)` 确定性生成：
   *   · 用 U.rng(hash) 而不是 Math.random → "这次看到什么，下次还是什么"，
   *     否则玩家侦查一次、出征一次会看到两套不同的守军；
   *   · 城一旦被占领，派生值就地**转正**（库存进 city.res、建筑进 city.cells），
   *     此后不再走这里 —— 所以"接触时生成"不会造成数值漂移；
   *   · 内存缓存挂在 `GAME._npcCache`（不在 state 上，故不随存档走）。
   * ============================================================ */
  GAME.npcHash = function (id, salt) {
    var h = (2166136261 ^ (salt || 0)) >>> 0;
    var str = String(id == null ? '' : id);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };
  GAME._npcCache = {};

  /* ============================================================
   * 满配城池的城内布局（v61 · 老板）—— **唯一出口**
   * ------------------------------------------------------------
   * 老板：「野地里的城池，应默认其建筑全都建满了，城内所有建筑各1个，
   *   兵营2个，其他建民房，位置也相对固定一下。城池的地块数量根据等级，数量你来定」
   *
   * 规则见 `DATA.CITY_PLAN` 的注释。要点：
   *   · 官府 2×2 **居中**，落位走与 `GAME.makeCity` 相同的唯一出口 `GAME.govCellsOf`；
   *   · 军营成对（第一优先占位，紧挨官府），其余建筑各 1 座，剩下的全是民房；
   *   · 非官府格按"到官府中心的曼哈顿距离"升序取用 → 核心贴着官府、民房在最外圈，
   *     跨等级跨城池都同一条规则（这就是老板要的"位置相对固定"）。
   * ⚠️ 布局**只与等级有关**，与城池身份无关 → 同等级的任意两座城，逐格完全一致。
   *
   * v63（老板）：「为名城也补满建筑，**根据其等级上限**」——
   * 于是布局多了一个参数 `buildLv`：**建筑等级**。
   *   野外城池 → 建筑等级 = 城等级（它没有档位加成，`cityBuildBonus` = 0）；
   *   名城     → 建筑等级 = 城等级 + 档位加成（县城+2 / 郡城+4 / 州城+8 / 都城+12），
   *             即 v54 定下的「名城建筑等级上限」——"补满"就是把每座建筑盖到它的上限。
   * 城墙不占格，但同样算"建筑"，所以 `wallLv` 也取 `buildLv`。
   * ============================================================ */
  GAME.cityPlanOf = function (level, buildLv) {
    var P = DATA.CITY_PLAN;
    var lv = Math.max(1, Math.min(P.maxLevel, Math.round(level) || 1));
    /* 建筑等级：不传就是"与城同级"（野外城池、自建城口径） */
    var bl = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(buildLv) || lv));
    /* v65（老板）：格数**不再按等级分档** —— 所有系统城一律 8×6。
       `P.size` 是唯一来源，改棋盘尺寸只需动那一个数组。 */
    var size = P.size;
    var col = size[0], row = size[1], total = col * row;
    var cells = [];
    for (var k = 0; k < total; k++) cells.push({ build: null, pending: null });

    /* ① 官府 2×2：**棋盘正中**（v68 老板）—— 走与 makeCity 同一出口 */
    var gf = GAME.govCellsOf(col, row);
    var gc = Math.floor((col - 2) / 2), gr = Math.floor((row - 2) / 2);
    gf.forEach(function (g) {
      cells[g] = { build: { id: 'guanfu', lvl: bl }, pending: null, official: true };
    });

    /* ② 军营 2 座：**紧贴官府左邻一列的两格**（成对、挨着官府，军事区自成一格）。
       col 都是偶数、官府宽 2，所以左邻格必定合法；仍留一个越界兜底。 */
    var bar = [];
    var bc = gc - 1;
    if (bc >= 0) { bar = [gr * col + bc, (gr + 1) * col + bc]; }
    bar = bar.filter(function (i) { return i >= 0 && i < total && !cells[i].build; });

    /* ③ 其余格按"到**城池中心**的曼哈顿距离"升序取用（同距按格号）。
       基准取城池中心（不取官府中心）—— "中心"跨棋盘尺寸是稳定参照；
       v68 官府居中后两者结果接近，仍以城池中心为准。 */
    var cx = (col - 1) / 2, cy = (row - 1) / 2;
    var rest = [];
    for (var i = 0; i < total; i++) {
      if (cells[i].build) continue;
      if (bar.indexOf(i) >= 0) continue;
      rest.push(i);
    }
    rest.sort(function (a, b) {
      var da = Math.abs((a % col) - cx) + Math.abs(Math.floor(a / col) - cy);
      var db = Math.abs((b % col) - cx) + Math.abs(Math.floor(b / col) - cy);
      return (da - db) || (a - b);
    });

    /* ④ 军营占满 2 座之后，剩下的按 DATA.CITY_PLAN.order 依次落位（每种 1 座），
       再有余格一律民房。 */
    bar.forEach(function (idx) {
      cells[idx] = { build: { id: 'junying', lvl: bl }, pending: null };
    });
    /* 其余 12 种按固定序落位（每种 1 座），军营已在上面手工落好 2 座 */
    var restOrder = P.order.filter(function (b) { return b !== 'junying'; });
    rest.forEach(function (idx, n) {
      var bid = n < restOrder.length ? restOrder[n] : P.filler;
      cells[idx] = { build: { id: bid, lvl: bl }, pending: null };
    });
    return { col: col, row: row, level: lv, buildLv: bl, cells: cells, wallLv: bl, total: total };
  };
  /* 系统城（名城/野外城）的**建筑等级** —— 唯一出口。
     名城按 v54 的"名城建筑等级上限"补满（城等级 + 档位加成，封顶 MAX_LEVEL_ABS）；
     野外城池/自建城无档位加成 → 与城同级。
     与 `GAME.buildCapOf` 同源（同一个 `cityBuildBonus`），所以"补满"补到的正是玩家
     自己经营时能够到的那个上限 —— 不是两套数。 */
  /* 系统城的**建筑等级**（唯一出口，与玩家侧 `buildCapOf` 同一个换算口径）。
     v65（老板）：「名城默认满级（如县城 12，郡城 14，州城 18 等）」——
     基数是**满级城等级 10**，不是该城自己的等级：
       县城 10+2=12 · 郡城 10+4=14 · 州城 10+8=18 · 都城 10+12=22。
     改前（v63）是 `城等级 + 档位加成`，于是 9 级州城只补到 Lv17、
     5 级县城只补到 Lv7 —— 名城看着像"半个空壳"，与"默认满级"的语感不符。
     ⚠️ 非名城（野外城池）不是"名城"，仍按**自己的等级**补 —— 据点是随等级长起来的，
        给它们也上满级会凭空变出一座座满配城。 */
  GAME.npcBuildLvOf = function (city) {
    if (!city) return 1;
    var lvlCap = DATA.CITY_PLAN.maxLevel;                  // 满级城等级 = 10
    var base = GAME.isFamousCity(city)
      ? lvlCap
      : Math.max(1, Math.min(lvlCap, city.level || 1));
    return Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, base + GAME.cityBuildBonus(city)));
  };
  /* 布局摘要（供界面显示"这座城都建了什么"）——
     唯一出口，别处不要再自己数一遍（数法不一致就是新的两个出口）。 */
  GAME.planSummaryOf = function (level, buildLv) {
    var plan = GAME.cityPlanOf(level, buildLv);
    var byId = {};
    plan.cells.forEach(function (c) {
      if (c.build) byId[c.build.id] = (byId[c.build.id] || 0) + 1;
    });
    var ord = [], civil = 0;
    Object.keys(byId).forEach(function (b) {
      if (b === 'minfang') { civil = byId[b]; return; }
      var meta = DATA.BUILDINGS[b];
      ord.push({ id: b, name: meta ? meta.name : b, icon: meta ? meta.icon : '', n: byId[b] });
    });
    /* 显示顺序固定（按 DATA.BUILD_ORDER），不随对象键序抖动 */
    ord.sort(function (a, b) {
      return DATA.BUILD_ORDER.indexOf(a.id) - DATA.BUILD_ORDER.indexOf(b.id);
    });
    /* ⚠️ 不要再算一个"slots"出来 —— 它与 `minfang` 是同一个数的两种算法，
       正是本项目最经典的"两个出口"（改一处忘一处）。民房数只认 `minfang`。 */
    return { plan: plan, items: ord, minfang: civil, total: plan.total };
  };

  /* ============================================================
   * 城外满配的**铺法**（v70 · 老板）—— 唯一出口
   * ------------------------------------------------------------
   * 入参是"官府能管多少块地"（即 `EXT_CAP_BY_LV` 那一档），返回**逐块的地块类型**：
   * 按 农田 → 伐木场 → 采石场 → 铁矿场 轮转铺满（同数量表 `DATA.EXT_PLAN_BY_LV`）。
   * 轮转铺法的好处：任何等级下四类地都均匀分布在区块里，不会"前 20 块全是田"。
   * 数量表本身只给**数量**，本函数负责把它变成**确定性的铺法** ——
   * 两者都是纯函数，同等级永远同一结果（"位置排布有序且固定"）。
   * ============================================================ */
  GAME.extPlanOf = function (lv) {
    /* ⚠️ 入参是**官府等级**（1 起），不是块数 —— 两者会撞车（12 级 ↔ 12 块），
       所以只认一个口径；返回数组的**长度**就是这级的块数（= EXT_CAP_BY_LV 那一档）。 */
    var n = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(lv) || 1));
    var counts = (DATA.EXT_PLAN_BY_LV || [])[n - 1] || [0, 0, 0, 0];
    return buildList(counts);
  };
  /* 把 [农田,伐木,采石,铁矿] 的**数量**摊成**逐块类型**（轮转） */
  function buildList(counts) {
    var order = DATA.EXT_BUILD_ORDER || ['farm', 'forest', 'quarry', 'mine'];
    var out = [], i, k;
    var max = counts.reduce(function (a, b) { return Math.max(a, b); }, 0);
    for (i = 0; i < max; i++) {
      for (k = 0; k < order.length; k++) if (i < (counts[k] || 0)) out.push(order[k]);
    }
    return out;
  }

  /* 「建筑全满、均 N 级」的影子城 —— 只用于算派生量（人口上限 / 产量），不参与玩法。
     v61：格子改由 `GAME.cityPlanOf` 统一生成（老板的布局规则），
     外城仍按官府等级拿满地块。
     v63（老板）：「为名城也补满建筑，根据其等级上限」→ 建筑等级走
     `GAME.npcBuildLvOf`（城等级 + 档位加成），不再是"与城同级"。 */
  GAME.npcCityShadow = function (city) {
    if (!city) return null;
    var lv = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, city.level || 1));
    var bl = GAME.npcBuildLvOf(city);
    var key = 'sh@' + city.id + '@' + lv + '@' + bl;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var plan = GAME.cityPlanOf(lv, bl);
    var cells = plan.cells.map(function (c) {
      return { build: c.build ? { id: c.build.id, lvl: c.build.lvl } : null,
        pending: null, official: !!c.official };
    });
    /* 块数按**城等级**（= 该城的官府等级，官府随城长），
       但每块地的**等级**按建筑等级上限（v65 老板「城内外建筑也达到等级上限」）——
       两者不是一回事：块数是"官府能管多少地"，等级是"这地开发到什么水平"。
       v70：**种类与数量**改由数量表产出（唯一出口 `GAME.extPlanOf`，入参=等级）——
       返回数组的长度就是这级的块数（与 `EXT_CAP_BY_LV` 那一档相等，一块不空）；
       改前是 ['farm','farm','forest','quarry','mine'] 循环，数量比与官府等级无关。 */
    var kinds = GAME.extPlanOf(lv);
    var ext = [];
    kinds.forEach(function (t, k) { ext.push({ id: 'e' + (k + 1), type: t, lv: bl }); });
    var sh = {
      id: city.id, name: city.name, x: city.x, y: city.y,
      level: lv, buildLv: bl, type: city.type, state: city.state,
      col: plan.col, row: plan.row, cells: cells, extGrid: ext, wallLv: plan.wallLv, def: city.def || 0,
      army: {}, ruler: false, shadow: true,
    };
    GAME._npcCache[key] = sh;
    return sh;
  };

  /* 满配城的**人口上限** = 民房座数 × 该级民房人口。
     为什么不用 `GAME.maxPopOf`：那个函数吃玩家侧的全境加成（民房满级专精 +20%），
     拿来算"系统城本该有多少人"会被玩家自己的进度污染 —— 侦查面板的数字
     不该因为我在别处盖了座 Lv12 民房就变。这里按纯布局算，可断言、不漂移。
     ⚠️ 民房人口按**建筑等级**（`plan.buildLv`）取，不是城等级 ——
     州城 Lv9 的建筑上限是 Lv17，民房就是 Lv17 的人口。 */
  GAME.planPopCapOf = function (level, buildLv) {
    var plan = GAME.cityPlanOf(level, buildLv);
    var per = (DATA.BUILDINGS.minfang.pop || [])[plan.buildLv - 1] || 0;
    var n = 0;
    plan.cells.forEach(function (c) { if (c.build && c.build.id === 'minfang') n++; });
    return n * per;
  };

  /* ============================================================
   * 野外城池（v61 · 老板：「野地里的城池，应默认其建筑全都建满了」）
   * ------------------------------------------------------------
   * 野外城池（`GAME.map.fortAt`）原本**只有守军和名字**，没有城内结构。
   * 现在给它同一套满配布局（走 `GAME.cityPlanOf`，与未占据名城同一个出口）：
   *   · 城内所有建筑各 1 座、军营 2 座、余为民房（老板给定）；
   *   · 城墙不占格（`wallLv` = 城等级，与玩家城/名城同口径）；
   *   · 人口上限按民房算；城防按城墙等级算。
   * `fortCityOf` 把 fort 包装成 city-like，让派生函数复用同一份口径 ——
   * 不这么做就会出现"名城一套、野城另一套"的两个出口。
   * ============================================================ */
  /* 野外城池的城防（唯一出口；原来写死在 battle.resolveTarget 里）。
     口径：底数 10 + 城墙等级 × 4 —— 城墙等级即城等级（满配城的城墙自然拉满）。 */
  GAME.fortDefOf = function (fort) {
    return 10 + ((fort && fort.level) || 1) * 4;
  };
  /* 野外城池的城内布局（含守军/人口/城防，供面板与出征预览）。
     ⚠️ 野外城池**不是名城**（`cityBuildBonus` → 0），所以它的建筑等级 = 城等级 ——
     老板说的"根据其等级上限"只适用于名城；野城没有档位，上限就是它自己那一级。 */
  GAME.fortPlanOf = function (fort) {
    if (!fort) return null;
    var lv = Math.max(1, Math.min(DATA.CITY_PLAN.maxLevel, fort.level || 1));
    var key = 'fortplan@' + lv;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var summary = GAME.planSummaryOf(lv);
    var out = {
      col: summary.plan.col, row: summary.plan.row, level: lv,
      buildLv: summary.plan.buildLv,
      wallLv: summary.plan.wallLv, total: summary.plan.total,
      items: summary.items, minfang: summary.minfang,
      popCap: GAME.planPopCapOf(lv),
      def: GAME.fortDefOf(fort),
      garrison: (GAME.map && GAME.map.fortGarrison) ? GAME.map.fortGarrison(lv) : null,
    };
    GAME._npcCache[key] = out;
    return out;
  };

  /* 未占据城池的库存（按等级派生）。
     基数是 DATA.NPC_CITY_RES.base，按 1.55^(lv-1) 复利 —— 9 级城约 base×33.7，
     再乘档位系数 npcResMul（都城 ×2.2 / 州治 ×1.6 / 郡治 ×1.25 / 县城 ×1.0）。
     人口取"建筑全满时的民房上限"（正是老板说的那个口径）。 */
  GAME.npcCityRes = function (city) {
    if (!city) return GAME.emptyRes();
    var lv = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, city.level || 1));
    var bl = GAME.npcBuildLvOf(city);
    var key = 'res@' + city.id + '@' + lv + '@' + bl;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var R = DATA.NPC_CITY_RES;
    var grown = Math.pow(R.grow, lv - 1);
    var mul = GAME.perkNum(city, 'npcResMul') || 1;
    var rng = U.rng(GAME.npcHash(city.id, 0x51ed) + lv);
    var out = GAME.emptyRes();
    Object.keys(R.base).forEach(function (k) {
      out[k] = Math.round(R.base[k] * grown * mul * (0.85 + rng() * 0.3));
    });
    var sh = GAME.npcCityShadow(city);
    /* v61：人口改走 `planPopCapOf`（纯按布局算，不吃玩家侧加成）；
       顺带保证"民房座数 × 民房等级"这条口径只存在一处。
       v63：建筑等级按名城上限（lv + 档位），民房人口跟着涨 —— 见 `npcBuildLvOf`。 */
    out.pop = GAME.planPopCapOf(lv, bl);
    GAME._npcCache[key] = out;
    return out;
  };

  /* 未占据城池的守将（六维 / 名字 / 等级全部由城 id 确定性派生）。
     资质随城档位走（都城→名世、州城→英杰、郡城→良材、县城→凡品），
     六维 = 资质中值 + 等级×成长，再按风格系数各自抖动。 */
  GAME.npcCityGuard = function (city) {
    if (!city) return null;
    var lv = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, city.level || 1));
    var key = 'gen@' + city.id + '@' + lv;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var rng = U.rng(GAME.npcHash(city.id, 0x7f4a) + lv);
    var rankId = lv >= 10 ? 'ming' : lv >= 9 ? 'ying' : lv >= 7 ? 'liang' : 'fan';
    var rk = DATA.GEN_RANK_BY_ID[rankId] || DATA.GEN_RANKS[0];
    var gLv = Math.round(lv * 8 + 6 + rng() * 12);
    var mid = (rk.base[0] + rk.base[1]) / 2 + gLv * rk.grow;
    var jitter = function () { return 0.82 + rng() * 0.36; };
    var sn = DATA.NPC_GUARD_SURNAME, gv = DATA.NPC_GUARD_GIVEN, tt = DATA.NPC_GUARD_TITLE;
    var g = {
      id: '__npc_' + city.id,
      name: sn[Math.floor(rng() * sn.length)] + gv[Math.floor(rng() * gv.length)],
      title: tt[Math.floor(rng() * tt.length)],
      level: gLv,
      tong: Math.round(mid * jitter()), yw: Math.round(mid * jitter()),
      zm: Math.round(mid * jitter()), nz: Math.round(mid * jitter()),
      rank: rk.id, style: 'balance',
      hero: false, npcGuard: true, loyalty: 100,
    };
    GAME._npcCache[key] = g;
    return g;
  };

  /* 打包（面板/出征用）：一次拿齐"这城有什么、守军多少、守将是谁" */
  GAME.npcCityInfo = function (city) {
    if (!city) return null;
    return {
      res: GAME.npcCityRes(city),
      guard: GAME.npcCityGuard(city),
      shadow: GAME.npcCityShadow(city),
      perk: GAME.perkOf(city),
      garrison: city.garrison || null,
    };
  };

  /* 从「未占据城池」身上取走的财货（v60 · 需求 4/6）。
     直接按该城的**派生库存** × 比例取（掠夺 0.5 / 占领 0）——
     与 npcCityRes 是同一份数据，所以"侦查面板看到的库存"与"搬回来的战利品"
     必然一致（改前 genLoot 是另一套"按档位凭空生成"的公式，两个出口）。 */
  GAME.npcLoot = function (city, modeId, extMul) {
    if (!city) return {};
    var pct = (DATA.EXPEDITION.cityResMul || {})[modeId];
    if (pct == null) pct = 0;
    pct *= (extMul == null ? 1 : extMul);
    var base = GAME.npcCityRes(city);
    var out = {};
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {
      var v = Math.round((base[k] || 0) * pct);
      if (v > 0) out[k] = v;
    });
    return out;
  };

  /* ---------------- 轻量存档索引（首页秒读，不解析主档） ----------------   * 主档 38KB+，首页若每次解析会卡顿；因此单独维护一份 ~300B 的索引。
   * 索引里同时记录「离线补算」所需的关键字段：world.elapsed（游戏秒累计）
   * 与 savedAt（现实时间戳）。
   * ------------------------------------------------------------ */
  var META_KEY = 'sanguo_meta_v3';

  /* 从任意 state 对象生成索引（纯函数，不改动 GAME.state） */
  GAME.metaOf = function (st) {
    if (!st) return null;
    var army = 0;
    (st.cities || []).forEach(function (c) {
      for (var id in (c.army || {})) army += c.army[id];
    });
    var w = st.world || {};
    var eras = DATA.ERAS || [];
    var era = eras[Math.min(w.eraIndex || 0, Math.max(0, eras.length - 1))] || { name: '' };
    var seasons = ['春', '夏', '秋', '冬'];
    var cn = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    var yy = (w.year || 1) - (w.eraStartYear || 1) + 1;
    var yearName = yy <= 1 ? '元' : (yy <= 10 ? cn[yy] : (yy < 20 ? '十' + cn[yy - 10] : String(yy)));
    var we = (DATA.WEATHERS || {})[w.weather || 'clear'] || { name: '晴', icon: '☀' };
    var chron = st.chronicle || [];
    var last = chron[chron.length - 1];
    return {
      version: st.version || SAVE_VERSION,
      name: (st.ruler && st.ruler.name) || '无名君主',
      avatar: (st.ruler && st.ruler.avatar) || '🧔',
      cities: (st.cities || []).length,
      army: army,
      rep: Math.floor(st.rep || 0),
      rank: st.rank || 0,
      era: era.name,
      year: w.year || 1,
      yearName: yearName,
      season: seasons[(w.season || 0) % 4],
      weather: we.icon + we.name,
      gameElapsed: Math.round(w.elapsed || 0),
      savedAt: st.savedAt || U.now(),
      lastText: last ? last.text : '',
      chronicleCount: chron.length,
    };
  };

  GAME.saveMeta = function (meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta || GAME.metaOf(GAME.state)));
    } catch (e) { /* 索引失败不影响主档 */ }
  };

  /* 读取索引：优先读索引，缺失则从主档推算并补写（兼容旧档） */
  GAME.readMeta = function () {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (raw) {
        var m = JSON.parse(raw);
        if (m && m.version === SAVE_VERSION) return m;
      }
    } catch (e) { }
    var main;
    try { main = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!main) return null;
    try {
      var st = JSON.parse(main);
      if (!st || st.version !== SAVE_VERSION) return null;
      var m2 = GAME.metaOf(st);       // 纯函数，不污染 GAME.state
      GAME.saveMeta(m2);
      return m2;
    } catch (e) { return null; }
  };

  /* 格式化存档时间 */
  GAME.metaTimeText = function (ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  /* ---------------- 离线补算（与记账联动） ----------------
   * 关键事实源：world.elapsed（游戏秒累计）与 savedAt（现实时间戳）。
   * 离线时长 = (now - savedAt) × 时间倍率，折算为游戏秒推进历法与各队列。
   *
   * 分两段处理，兼顾正确与性能：
   *   ① 精确段：前 OFFLINE_EXACT_MAX 秒逐秒 tick（队列/民心/人口的逐秒逻辑正确）
   *   ② 聚合段：超出部分一次性结算资源与队列，并整段推进历法
   * 记账抑制：补算期间不逐年逐季记账；结束后由 story.recordOffline 统一记一条。
   * ------------------------------------------------------------ */
  var OFFLINE_EXACT_MAX = 3600;   // 逐秒补算上限（现实秒）

  GAME.offlineCatchup = function (secReal) {
    var s = GAME.state;
    if (!s) return 0;
    secReal = Math.max(0, secReal);
    if (secReal <= 5) return 0;
    var exact = Math.min(secReal, OFFLINE_EXACT_MAX);
    var bulk = secReal - exact;
    GAME._offline = true;
    if (exact >= 1) GAME.simulateSeconds(Math.floor(exact));
    if (bulk >= 1) GAME.simulateBulk(bulk);
    GAME._offline = false;
    GAME._offlineSec = secReal;   // 供 UI 提示离线补算量
    /* 州郡岁贡：离线可能跨现实日，须补结（内部按天数差一次结清，上限 30 日） */
    if (GAME.settleDailyYield) GAME.settleDailyYield();
    /* 行军队列：离线期间出发的大军早已抵达 → 一次结清。
       注意必须在 simulateBulk 之后（补算期间城池兵力/资源已按整段变化）。
       若把行军留在队列里"继续走"，玩家回归后会看到一支早就该到的军队。 */
    if (GAME.march && GAME.march.rushAll) {
      var mr = GAME.march.rushAll();
      if (mr.ok) GAME.log('（离线期间）' + mr.msg);
    }
    if (GAME.story && GAME.story.recordOffline) GAME.story.recordOffline(secReal);
    return secReal;
  };

  /* 聚合补算：不做逐秒循环，一次算完，避免长时间离线卡死 */
  GAME.simulateBulk = function (secReal) {
    var s = GAME.state, ts = GAME.timeScale();

    /* 定期来袭：离线也要照打（**与在线同一个 invasionTick**）——
       长时间离线会一次跨过多个周期，函数内部用 while 逐个结算。 */
    GAME.invasionTick(ts / 3600 * secReal);
    /* 资源与耗粮：**逐城**结算（v60 · 需求 4，与在线 tickOnce 同一口径） */
    var offlineFeedTotal = 0, offLostTotal = 0;
    s.cities.forEach(function (ct) {
      var prod = GAME.cityProdPerSec(ct);
      var cap = GAME.storeCapOf(ct);
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        R[k] = (R[k] || 0) + prod[k] * secReal;
        /* 黄金不受仓库上限约束（同在线口径） */
        if (k !== 'gold' && cap > 0 && R[k] > cap) R[k] = cap;
      }
      var feedC = GAME.foodPerSecOf(ct);
      offlineFeedTotal += feedC;
      R.grain = (R.grain || 0) - feedC * secReal;
      /* 离线口径必须与在线一致：粮尽同样钳制到 0，并走**同一个** starveStep
         （v65：长时间离线会按"每 24 游戏小时一次"连续哗变，starveStep 内部循环处理）。 */
      if (R.grain < 0 && feedC > 0) {
        var stepOff = GAME.starveStep(ct, true, ts / 3600 * secReal);
        if (stepOff.lost > 0) offLostTotal += stepOff.lost;
      } else {
        GAME.starveStep(ct, false, 0);
      }
      if (R.grain < 0) R.grain = 0;
      /* 俸禄：从该将所在城扣（同在线口径） */
      var sal = 0;
      (s.generals || []).forEach(function (g) { if (g.cityId === ct.id) sal += g.level * 20; });
      if (sal) {
        R.gold = (R.gold || 0) - sal / 3600 * ts * secReal;
        if (R.gold < 0) R.gold = 0;
      }
    });
    if (offLostTotal > 0) GAME._offlineStarved = offLostTotal;
    /* 将领体力/精力回满、忠诚（v14.1 同样不随时间衰减，与在线口径一致） */
    (function () {
      var gc = DATA.GEN_COST, lo = DATA.LOYALTY, hours = ts / 3600 * secReal;
      s.generals.forEach(function (g) {
        /* v29（需求 11）：体力上限不再是写死的 100，而是 GAME.staMax(g)
           v66：`g.stamina` 存的是**等级那一份的余量**（装备体力常备不失），
           所以这里按 staBaseMax 封顶，别把余量灌进装备那份里去。 */
        var mx = GAME.staBaseMax(g);
        g.stamina = Math.min(mx, (g.stamina == null ? mx : g.stamina) + gc.staPerHour * hours);
        g.energy = Math.min(100, (g.energy == null ? 100 : g.energy) + gc.enePerHour * hours);
      });
      /* v70：君主不参与"忠诚离去"（老板「不可解雇」的另一半 —— 自己也不会走） */
      s.generals = s.generals.filter(function (g) {
        if (GAME.isLordGeneral(g)) return true;
        return !(g.loyalty < lo.desertAt && Math.random() < lo.desertChancePerHour * hours);
      });
    })();
    /* 队列：整段推进后统一判定完成 */
    var advance = function (q) { q.elapsed += secReal * ts; };
    s.queues.build.forEach(advance);
    /* v24（需求 8）：募兵队列按军营分组推进（与在线主循环共用同一实现） */
    GAME.advanceTrainQueues(secReal * ts);
    /* v73：秘境作物按同一段离线时长推进（挂机回来地里的东西也该熟了） */
    if (GAME.tickFarm) GAME.tickFarm(secReal * ts);
    if (GAME.artTick) GAME.artTick(secReal * ts);   // v79：神器供奉（离线补算同口径）
    s.queues.tech.forEach(advance);
    var i;
    for (i = s.queues.build.length - 1; i >= 0; i--) {
      if (s.queues.build[i].elapsed >= s.queues.build[i].totalTime) {
        var qb = s.queues.build.splice(i, 1)[0];
        GAME.applyBuildDone(qb);
      }
    }
    for (i = s.queues.tech.length - 1; i >= 0; i--) {
      if (s.queues.tech[i].elapsed >= s.queues.tech[i].totalTime) {
        var qc = s.queues.tech.splice(i, 1)[0];
        GAME.applyTechDone(qc);
      }
    }
    /* 历法：整段一次性推进（内部只触发一次换季/换年检查，不会涌出大量史书） */
    if (GAME.story) GAME.story.tick(secReal * ts);
  };

  /* ---------------- 存档 / 读档（v3，旧档作废） ---------------- */
  GAME.saveGame = function () {
    if (!GAME.state) return false;
    GAME.state.savedAt = U.now();
    try {
      /* 【派生数据一律不入档】同类历史问题已发生两次：
         · map.grid    —— 500×500=25 万格地形（JSON 约 9MB），曾撑爆 localStorage 的 5MB 配额，
                          导致整个存档写入静默失败。地形由 map.seed 确定性生成。
         · map.cities  —— 174 座 NPC 城的整份快照（约 54KB，占存档 96%），而守军在游戏中
                          **从不被修改**（纯派生）。它不只是浪费空间：读档时用的是存档里的旧副本，
                          所以**改了城池数值对老档完全不生效**。
         两者一律不入档，读档时由同一 seed 重建；玩家可变部分另存于
         state.cities（已占城池，含 origId）/ state.wilds / state.fortsRazed。 */
      /* v67：序列化走唯一出口 `savePayload`（导出/存槽位也用它，不许各写一份） */
      var json = GAME.savePayload();
      localStorage.setItem(SAVE_KEY, json);
      GAME.saveMeta(GAME.metaOf(GAME.state));   // 同步维护轻量索引
      GAME._setSlotIndex('main', GAME.state, json.length);
      return true;
    } catch (e) {
      if (window.console && window.console.warn) window.console.warn('存档失败：' + (e && e.message));
      return false;
    }
  };
  GAME.loadGame = function () {
    var raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try {
      var st = JSON.parse(raw);
      if (!st || st.version !== SAVE_VERSION) { GAME.clearSave(); return null; } // 旧版存档作废
      return GAME.adoptState(st);
    } catch (e) { return null; }
  };

  /* ============================================================
   * 读档后的**统一后处理**（v67 从 loadGame 里提取出来）
   * ------------------------------------------------------------
   * 原先这一大段内联在 loadGame 里；槽位读档若再抄一份，
   * 就会出现"迁移逻辑两份、只改一处"的经典失效（本项目已发生多次）。
   * 现在 loadGame（主档）与 loadFrom（任意槽位）都走它。
   * ============================================================ */
  GAME.adoptState = function (st) {      GAME.state = st;
      /* ============================================================
       * v60 迁移：全境共享库存 → **各城独立库存**
       * ------------------------------------------------------------
       * 旧档在 state 顶层有一个 `res`（粮木石铁金 + 人口，全境共用）。
       * 迁移口径：**整份并入首城**（玩家实际在用的那座），其余城池按
       * `GAME.npcCityRes` 给一笔与其等级相称的库存 —— 不给的话，
       * 攻占来的城读档后会变成"0 粮 0 金"的废城，只能靠运输养活。
       * 之后再 attachRes：从这一刻起 `s.res` 就是"当前城的库存"。
       * ============================================================ */
      var legacyRes = st.res || null;
      (st.cities || []).forEach(function (c, i) {
        if (!c.res) c.res = GAME.emptyRes();
        GAME.RES_KEYS.forEach(function (k) { if (c.res[k] == null) c.res[k] = 0; });
        if (i > 0 && !c.res.grain && !c.res.gold) {
          var seedRes = GAME.npcCityRes ? GAME.npcCityRes(c) : null;
          if (seedRes) GAME.RES_KEYS.forEach(function (k) { c.res[k] = seedRes[k] || 0; });
        }
      });
      if (legacyRes) {
        var c0 = (st.cities || [])[0];
        if (c0) GAME.RES_KEYS.forEach(function (k) { c0.res[k] = legacyRes[k] || 0; });
      }
      delete st.res;
      GAME.attachRes(st);
      /* 存档不含地形与 NPC 城，一律用 seed 重建（确定性，与存档前一致）。
         这里**无条件**清掉可能存在的旧副本 —— 老存档里带着 v16 之前的 NPC 城快照，
         不清就会继续用旧数值（这正是「改了城池数值对老档不生效」的根因）。
         已占城池由 map.generate 依据 s.cities[].origId 剔除。 */
      st.map.cities = null;
      /* 存档不含地形，用 seed 重建（确定性，与存档前完全一致） */
      if (!st.map.grid && GAME.map && GAME.map.generate) GAME.map.generate();
      /* 叙事层补字段（旧档可能缺 world/chronicle） */
      if (GAME.story) GAME.story.init();
      /* 将领资质补字段（v11 前的存档没有 rank/style，按四维反推并写回） */
      (st.generals || []).forEach(function (g) {
        if (GAME.rankOf) GAME.rankOf(g);
        if (g.stamina == null) g.stamina = GAME.staBaseMax(g);
        /* v66：老存档里的 g.stamina 可能大于 staBaseMax（那时它含套装体力），
           夹回余量口径即可 —— 装备那一份由 staNow 现算，不会丢。 */
        else g.stamina = Math.min(g.stamina, GAME.staBaseMax(g));
        if (g.energy == null) g.energy = 100;
        if (g.loyalty == null) g.loyalty = 70;
        /* v22（需求 2）：旧档将领补肖像 seed / 名将头像 key（按名字确定性推导） */
        if (GAME.portraits) GAME.portraits.ensure(g);
        /* v26（需求 2）：速度升为五维之前，普通将领的出身脚力是 0（当时没人在意）；
           一次性补齐到 GEN_BASE.speed，否则老档将领的速度会比新招的低一截。
           等级成长是派生的，不需要在这里补。 */
        if (!st.genSpdFixed && !g.hero && !g.speed) g.speed = DATA.GEN_BASE.speed;
      });
      st.genSpdFixed = 1;   // 上面那次脚力补齐只做一次，避免覆盖玩家后续的改动
      /* v59：出征战术归一化 —— 老档没有这个字段；非法兵种/非法动作一并清掉。
         不清的话，战斗里 unit.adv = STANCE_ROW[非法动作] = undefined → 位置成 NaN，
         而 NaN 在比较里全为 false，整场战斗会**静默**退化成"谁都不动"。 */
      var tRaw = (st.tactics && typeof st.tactics === 'object') ? st.tactics : {};
      var tClean = {};
      Object.keys(tRaw).forEach(function (id) {
        if (!(GAME.DATA.TROOPS[id])) return;
        var m = tRaw[id] || {}, okS = null;
        (GAME.DATA.STANCES || []).forEach(function (x) { if (m.s === x.id) okS = x.id; });
        if (okS) tClean[id] = { s: okS, t: typeof m.t === 'string' ? m.t : '' };
      });
      st.tactics = tClean;
      /* v53：**一城一守将**归一化 —— 改前的存档可能在同一座城挂了多个守将
         （只有第一个生效，后任的静默失效）。这里把重复的清掉，
         否则老板的现有存档读进来仍然是"新守将不生效"。 */
      GAME.normalizeGuards();
      /* v64：把没有归属城的将领挂到首城 —— 席位按城算，不许有"无主之将" */
      if (GAME.normalizeGenCities) GAME.normalizeGenCities();
      /* 读档后把发号序号对齐到存档内最大号，否则新招募的将会与旧将撞 id
         （表现为「点第一个将领，操作到的却是别人」） */
      GAME.syncSeq();
      if (!st.forged) st.forged = [];   // 铁匠铺已打造记录（用于图鉴）
      /* ---- v14 迁移：外城地块从 state.extGrid（全局单份）搬到各城 city.extGrid ---- */
      var legacyExt = st.extGrid || null;
      (st.cities || []).forEach(function (c, i) {
        if (!c.extGrid) c.extGrid = (i === 0 && legacyExt) ? legacyExt : GAME.makeExtGrid(i === 0);
        var eCap = GAME.extCap(c);
        while (c.extGrid.length < eCap) c.extGrid.push({ id: 'e' + (c.extGrid.length + 1), type: null, lv: 0 });
      });
      delete st.extGrid;
      /* v12 补字段：累计统计、随机任务池、材料背包 */
      if (!st.stats) st.stats = { buildDone: 0, techDone: 0, trained: 0, forgedCount: 0, recruited: 0, trades: 0, wins: 0, conquer: 0, itemsUsed: 0 };
      if (!st.quests.pool) st.quests.pool = [];
      if (st.quests.poolDay == null) st.quests.poolDay = null;
      if (!st.quests.log) st.quests.log = [];
      st.items = st.items || {};
      if (st.wilds === undefined) st.wilds = [];
      if (st.yieldDay === undefined) st.yieldDay = null;   // v14 岁贡：旧档首次只登记日期，不补发
      /* v15 补字段：野地采集队 + 已占野地的等级日期（旧档野地无 levelDay，首次只登记） */
      if (!st.gathers) st.gathers = [];
      if (!st.msgLog) st.msgLog = [];
      if (st.repUnread == null) st.repUnread = 0;        // v41：旧档补字段（v82 顺手去重复行）
      /* v82：征收退役 —— v24 的 lastLevy 迁移块随功能一并撤除（旧档残留字段无害）。 */
      /* v24（需求 8）：募兵队列补 barracks 归属（旧档队列没有 bIdx）
         v29（需求 13）：同时补齐 `kind` —— 旧档里的器械队列还在军营名下，
         迁移到**工匠作坊**（找不到作坊就留在原格位，等玩家建好作坊再正常推进）。 */
      (st.queues && st.queues.train || []).forEach(function (q) {
        var t = DATA.TROOPS[q.troopId];
        if (!q.kind) q.kind = (t && t.craft) ? 'craft' : 'train';
        var isCraft = q.kind === 'craft';
        if (isCraft) {
          var cw = GAME.cityById(q.cityId);
          var wi = GAME.firstWorkshopIdx ? GAME.firstWorkshopIdx(cw) : -1;
          if (wi >= 0) q.bIdx = wi;
        }
        if (q.bIdx != null) return;
        var c = GAME.cityById(q.cityId);
        q.bIdx = GAME.firstBarracksIdx ? GAME.firstBarracksIdx(c) : -1;
      });
      (st.wilds || []).forEach(function (w) { if (w.levelDay === undefined) w.levelDay = null; });
      /* ---- v16 迁移 ----
         ① 官府 4 格从「正中央」移到「右侧」（col 4-5 × row 2-3）
         ② 城墙从「占格建筑」改为 city.wallLv（不占格，环绕城池一圈） */
      (st.cities || []).forEach(function (c) {
        if (!c.cells || c.cells.length !== 36) return;
        /* ① 官府位置迁移 */
        var want = [4 + 6 * 2, 5 + 6 * 2, 4 + 6 * 3, 5 + 6 * 3];
        var has = [];
        c.cells.forEach(function (x, i) { if (x.official) has.push(i); });
        var same = has.length === want.length && has.every(function (i) { return want.indexOf(i) >= 0; });
        if (!same) {
          var gLv = 1;
          has.forEach(function (i) {
            if (c.cells[i].build && c.cells[i].build.id === 'guanfu') gLv = c.cells[i].build.lvl;
          });
          has.forEach(function (i) { c.cells[i].official = false; c.cells[i].build = null; c.cells[i].pending = null; });
          want.forEach(function (i) {
            c.cells[i].official = true;
            c.cells[i].build = { id: 'guanfu', lvl: gLv };
            c.cells[i].pending = null;
          });
        }
        /* ② 城墙搬出格子 */
        var wLv = 0;
        c.cells.forEach(function (x) {
          if (x.build && x.build.id === 'chengqiang') wLv = Math.max(wLv, x.build.lvl);
          /* ---- v40 迁移：城内 6×6 → 8×6（48 格）----
           老板要"6 行 8 列"。已建建筑按**原行列**搬过去（列 0-5 原位、新列 6-7 留空），
           官府 4 格从 col4-5×row2-3 移到 col6-7×row2-3（仍在右侧中部）。
           ⚠ 队列里的 gridIndex 必须一起重映射 —— 否则在建/升级中的那几项
             会指向错误的格子（"改一处、忘一处"的典型位置）。 */
        if (c.cells.length === 36 && (c.col || 6) === 6 && (c.row || 6) === 6) {
          var old36 = c.cells.slice(), gLv2 = 1;
          old36.forEach(function (x) { if (x.official && x.build) gLv2 = x.build.lvl; });
          var n48 = [];
          for (var i48 = 0; i48 < 48; i48++) n48.push({ build: null, pending: null });
          for (var r48 = 0; r48 < 6; r48++) {
            for (var c48 = 0; c48 < 6; c48++) {
              var fr = old36[r48 * 6 + c48], to = n48[r48 * 8 + c48];
              if (!fr || fr.official) continue;
              to.build = fr.build; to.pending = fr.pending;
            }
          }
          GAME.govCellsOf(8, 6).forEach(function (gi) {
            n48[gi].official = true;
            n48[gi].build = { id: 'guanfu', lvl: gLv2 };
          });
          c.cells = n48; c.col = 8; c.row = 6;
          /* 建造/升级队列里的格子索引跟着换坐标系 */
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId !== c.id || q.gridIndex == null || q.gridIndex >= 36) return;
            q.gridIndex = Math.floor(q.gridIndex / 6) * 8 + (q.gridIndex % 6);
          });
        }
      });
        if (c.wallLv == null) c.wallLv = wLv;
        c.cells.forEach(function (x) {
          if (x.build && x.build.id === 'chengqiang') { x.build = null; x.pending = null; }
        });
      });
      /* ---- v68 迁移：官府从"右侧中部"移到"棋盘正中"（老板 2026-09-14）----
         对调式：中央 4 格上的占用者与旧官府位**一一对调** —— 玩家建筑不丢。
         队列里引用这些格号的项（在建 gridIndex / 军营 bIdx）一起重映射，
         漏了就是"在建项指向错格"（v40 迁移踩过的同一个坑）。 */
      (st.cities || []).forEach(function (c) {
        if (!c.cells || c.cells.length !== 48) return;
        var oldPos = [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3];
        var newPos = GAME.govCellsOf(c.col || 8, c.row || 6);
        var has = [];
        c.cells.forEach(function (x, i) { if (x.official) has.push(i); });
        var atOld = has.length === 4 && has.every(function (i) { return oldPos.indexOf(i) >= 0; });
        if (!atOld) return;
        var gLv = 1;
        has.forEach(function (i) {
          if (c.cells[i].build && c.cells[i].build.id === 'guanfu') gLv = c.cells[i].build.lvl;
        });
        var remap = {};
        oldPos.forEach(function (oi, n) {
          var ni = newPos[n];
          remap[ni] = oi;                       /* 中央格 → 旧官府位 */
          var dis = c.cells[ni];                /* 中央格上的占用者（空/建筑/在建皆可） */
          c.cells[oi].official = false;
          c.cells[oi].build = dis.build || null;
          c.cells[oi].pending = dis.pending || null;
        });
        newPos.forEach(function (ni) {
          c.cells[ni].official = true;
          c.cells[ni].build = { id: 'guanfu', lvl: gLv };
          c.cells[ni].pending = null;
        });
        ((st.queues && st.queues.build) || []).forEach(function (q) {
          if (q.cityId !== c.id || q.gridIndex == null) return;
          if (remap[q.gridIndex] != null) q.gridIndex = remap[q.gridIndex];
        });
        ((st.queues && st.queues.train) || []).forEach(function (q) {
          if (q.cityId !== c.id || q.bIdx == null) return;
          if (remap[q.bIdx] != null) q.bIdx = remap[q.bIdx];
        });
      });
      /* ---- v70 迁移：老档补一位「君主将领」（老板 2026-09-14）----
         老档的名单里没有玩家本人 —— 补一位（头像 seed 与 ruler 同源、归属首城）。
         新档（newGame 已建）命中 hasLord 时整段跳过，不会重复添人。 */
      (function () {
        var hasLord = false;
        ((st.generals) || []).forEach(function (g) { if (g && g.isLord) hasLord = true; });
        if (hasLord) return;
        var seed = (st.ruler && st.ruler.portraitSeed != null) ? st.ruler.portraitSeed : undefined;
        var home = (st.cities && st.cities[0]) ? st.cities[0].id : null;
        st.generals = st.generals || [];
        st.generals.push(GAME.makeLordGeneral(st.ruler || {}, seed, home));
      })();
      /* 存档迁移：旧默认倍率 30× → 120×（真实数值下 30× 读秒过慢） */
      if (st.settings && st.settings.timeScale === 30) {
        st.settings.timeScale = 120;
        GAME._scaleMigrated = true;
      }
      /* 补字段（旧档可能缺） */
      if (!st.workRate) st.workRate = { grain: 100, wood: 100, stone: 100, iron: 100 };
      /* v79：装备单件化迁移（旧 id 串 → 实例；旧"按种"强化并入首件） */
      if (GAME.migrateEquipModel) GAME.migrateEquipModel(st);
      /* v89：修炼线君主专属 —— 旧档里非君主身上的灵气装备归还背包、归位军装 */
      if (GAME.migrateLordLing) GAME.migrateLordLing(st);
      /* v77 补字段：月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */
      if (st.salaryAt == null) st.salaryAt = (st.world && st.world.elapsed) || 0;
      /* 离线补算：按 savedAt 与当前时间推算，精确段+聚合段（详见 offlineCatchup） */
      var elapsed = Math.max(0, (U.now() - (st.savedAt || U.now())) / 1000);
      if (elapsed > 5) {
        GAME.offlineCatchup(elapsed);
        GAME.state.savedAt = U.now();
      }
      return st;
  };
  GAME.hasSave = function () {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  };

  /* ============================================================
   * v67 · 存档槽位体系（老板：「补一个存档，对网页游戏什么存档设计合适」）
   * ------------------------------------------------------------
   * 实测依据（`.workbuddy/tools/probe/probe67_save3.js`）：
   *   · 开局档 **3.8KB**；中期档（20 城 / 120 将 / 公文堆满）**115.6KB**
   *   · 单次写入 **0.8ms**（20 次采样中位）· localStorage 实测配额 **5.00MB**
   *     → 5MB ÷ 115.6KB ≈ **43 份**中期档
   *   · 唯一会长期增长的字段 msgLog 已有 `MSG_MAX = 800` 封顶（≈51KB）
   * ⇒ **不上 IndexedDB**。它异步 + 事务 + 容量大，但这里量级差两个数量级；
   *   而 localStorage 的**同步**语义正合用：关页/切后台要能立刻落盘。
   *
   * 槽位布局（**唯一来源**，改这张表就够）：
   *   main  主档     —— 首页「继续上次的游戏」与服务端式"当前档"读它
   *   s1~s3 手动槽   —— 玩家自己存/读
   *   a1~a3 自动备份 —— 每次自动存档前把旧主档往后推（a3←a2←a1←main）
   *     ⭐ 轮换的意义：**坏档不会当场覆盖掉唯一的好档** ——
   *       单档式最惨的失败模式就是"存进去发现已经坏了，上一份也被覆盖了"。
   * 索引：`sanguo_slots_v3` **一个键**存全部槽位摘要 → 打开面板只读一次，不解析主档。
   * ============================================================ */
  var SLOT_INDEX_KEY = 'sanguo_slots_v3';
  GAME.SAVE_FMT = 'sanguo-save';
  GAME.SLOTS = [
    { id: 'main', name: '主档', kind: 'main', key: SAVE_KEY },
    { id: 's1', name: '存档 1', kind: 'manual', key: SAVE_KEY + '_s1' },
    { id: 's2', name: '存档 2', kind: 'manual', key: SAVE_KEY + '_s2' },
    { id: 's3', name: '存档 3', kind: 'manual', key: SAVE_KEY + '_s3' },
    { id: 'a1', name: '自动备份 1', kind: 'auto', key: SAVE_KEY + '_a1' },
    { id: 'a2', name: '自动备份 2', kind: 'auto', key: SAVE_KEY + '_a2' },
    { id: 'a3', name: '自动备份 3', kind: 'auto', key: SAVE_KEY + '_a3' }
  ];
  GAME.slotOf = function (id) {
    for (var i = 0; i < GAME.SLOTS.length; i++) if (GAME.SLOTS[i].id === id) return GAME.SLOTS[i];
    return null;
  };
  /* 存档序列化的**唯一出口**。原先只在 saveGame 里内联一份；
     导出/存槽位若各写一份，就会出现"改了瘦身规则、只改到一处"的老毛病。 */
  GAME.savePayload = function () {
    if (!GAME.state) return null;
    var keepCities = GAME.state.map.cities;
    GAME.state.map.cities = null;              // 派生数据不入档（见 saveGame 注释）
    try {
      return JSON.stringify(GAME.state, function (k, v) {
        if (k === 'grid' && Array.isArray(v) && v.length > 100) return undefined;
        return v;
      });
    } finally {
      GAME.state.map.cities = keepCities;      // 快照不能破坏内存状态
    }
  };
  /* FNV-1a 32 位。只为"文本在传输/粘贴中没被改坏"，不是防篡改。 */
  GAME.checksum = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  };
  GAME.slotIndex = function () {
    try {
      var raw = localStorage.getItem(SLOT_INDEX_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { return {}; }
  };
  GAME._setSlotIndex = function (id, st, size) {
    try {
      var idx = GAME.slotIndex();
      var m = GAME.metaOf(st) || {};
      var s = GAME.slotOf(id) || {};
      idx[id] = {
        id: id, slot: s.name || id, kind: s.kind || 'manual',
        name: m.name || '无名君主', era: m.era || '', yearName: m.yearName || '',
        cities: m.cities || 0, army: m.army || 0,
        gens: (st.generals || []).length,
        year: (st.world && st.world.year) || 1,
        size: size || 0, savedAt: U.now(), version: SAVE_VERSION
      };
      localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(idx));
    } catch (e) { /* 索引失败不影响主档 */ }
  };
  GAME._clearSlotIndex = function (id) {
    try {
      var idx = GAME.slotIndex();
      delete idx[id];
      localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(idx));
    } catch (e) {}
  };
  /* 面板要用的一份清单：槽位定义 + 摘要（**一次读索引**，不解主档） */
  GAME.slotList = function () {
    var idx = GAME.slotIndex();
    return GAME.SLOTS.map(function (s) {
      return { id: s.id, name: s.name, kind: s.kind, meta: idx[s.id] || null };
    });
  };
  GAME.slotEmpty = function () {
    var ids = ['s1', 's2', 's3'];
    for (var i = 0; i < ids.length; i++) {
      var s = GAME.slotOf(ids[i]);
      var has = false;
      try { has = !!localStorage.getItem(s.key); } catch (e) {}
      if (!has) return ids[i];
    }
    return null;
  };
  /* 写入某个槽位。返回 {ok,msg}，调用方直接 toast。 */
  GAME.saveTo = function (id) {
    var slot = GAME.slotOf(id || 'main');
    if (!slot) return { ok: false, msg: '槽位不存在：' + id };
    if (!GAME.state) return { ok: false, msg: '没有进行中的游戏' };
    GAME.state.savedAt = U.now();
    try {
      var json = GAME.savePayload();
      localStorage.setItem(slot.key, json);
      GAME._setSlotIndex(slot.id, GAME.state, json.length);
      if (slot.id === 'main') GAME.saveMeta(GAME.metaOf(GAME.state));
      return { ok: true, msg: '已存入「' + slot.name + '」', size: json.length };
    } catch (e) {
      if (window.console && window.console.warn) window.console.warn('存档失败：' + (e && e.message));
      return { ok: false, msg: '存档失败：' + ((e && e.message) || '未知原因') };
    }
  };
  /* 自动备份轮换：a3 ← a2 ← a1 ← main（整体后移一位） */
  GAME.rotateAuto = function () {
    try {
      var idx = GAME.slotIndex();
      var raw = localStorage.getItem(GAME.slotOf('main').key);
      if (!raw) return false;
      /* 从最旧的一端开始搬，避免覆盖 */
      for (var i = 3; i >= 1; i--) {
        var from = GAME.slotOf(i === 1 ? 'main' : ('a' + (i - 1)));
        var to = GAME.slotOf('a' + i);
        var src = (i === 1) ? raw : localStorage.getItem(from.key);
        if (src) {
          localStorage.setItem(to.key, src);
          if (idx[from.id]) { idx[to.id] = idx[from.id]; idx[to.id].id = to.id; idx[to.id].slot = to.name; }
          else if (i === 1 && idx.main) { idx[to.id] = idx.main; idx[to.id].id = to.id; idx[to.id].slot = to.name; }
        } else {
          delete idx[to.id];
        }
      }
      localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(idx));
      return true;
    } catch (e) { return false; }
  };
  /* 自动存档 = 先轮换备份，再写主档。所有自动路径都走它（单一出口）。 */
  GAME.autoSave = function () {
    GAME.rotateAuto();
    return GAME.saveTo('main');
  };
  GAME.loadFrom = function (id) {
    var slot = GAME.slotOf(id || 'main');
    if (!slot) return null;
    var raw = null;
    try { raw = localStorage.getItem(slot.key); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var st = JSON.parse(raw);
      if (!st || st.version !== SAVE_VERSION) return null;
      return GAME.adoptState(st);      // 与 loadGame 同一套后处理
    } catch (e) { return null; }
  };
  GAME.dropSlot = function (id) {
    var slot = GAME.slotOf(id);
    if (!slot || slot.kind === 'main') return { ok: false, msg: '主档不可删除' };
    try { localStorage.removeItem(slot.key); } catch (e) {}
    GAME._clearSlotIndex(id);
    return { ok: true, msg: '已清空「' + slot.name + '」' };
  };
  GAME.MSG_MAX = GAME.MSG_MAX || 800;
  /* 导出：一个带自描述头部 + 校验和的 JSON 文本，玩家可存成文件或直接粘贴 */
  GAME.exportText = function (slotId) {
    var slot = GAME.slotOf(slotId || 'main');
    if (!slot) return { ok: false, msg: '槽位不存在' };
    var raw = null;
    try { raw = localStorage.getItem(slot.key); } catch (e) {}
    if (!raw) return { ok: false, msg: '「' + slot.name + '」是空的，没有可导出的内容' };
    var st;
    try { st = JSON.parse(raw); } catch (e) { return { ok: false, msg: '该槽位内容已损坏，无法导出' }; }
    var meta = GAME.slotMetaOf ? GAME.slotMetaOf(slot.id) : (GAME.slotIndex()[slot.id] || null);
    var pack = {
      _fmt: GAME.SAVE_FMT, _ver: SAVE_VERSION, _exportedAt: U.now(),
      _slot: slot.name, _ruler: (st.ruler && st.ruler.name) || '无名君主',
      _summary: (meta ? (meta.cities + ' 城 · ' + meta.gens + ' 将') : ''),
      _check: GAME.checksum(JSON.stringify(st)), state: st
    };
    return { ok: true, text: JSON.stringify(pack), name: (st.ruler && st.ruler.name) || '无名君主' };
  };
  GAME.slotMetaOf = function (id) { return GAME.slotIndex()[id] || null; };
  /* 导入：校验顺序 = 能不能解析 → 是不是本游戏的存档 → 版本对不对 → 内容完整 → 校验和。
     任一不过**明确报哪一步**，不接受"导入失败"这种没信息量的提示。
     目标槽位默认取"第一个空的手动槽"，全满则拒绝（不覆盖玩家已有档）。 */
  GAME.importText = function (text, slotId) {
    if (!text || !String(text).trim()) return { ok: false, msg: '请先选择文件或粘贴存档文本' };
    var pack;
    try { pack = JSON.parse(String(text).trim()); }
    catch (e) { return { ok: false, msg: '不是有效的存档文本（JSON 解析失败）' }; }
    if (!pack || typeof pack !== 'object' || pack._fmt !== GAME.SAVE_FMT)
      return { ok: false, msg: '这不是本游戏的存档（缺少 ' + GAME.SAVE_FMT + ' 标记）' };
    if (pack._ver !== SAVE_VERSION)
      return { ok: false, msg: '存档版本不符（存档 v' + pack._ver + '，当前 v' + SAVE_VERSION + '），无法导入' };
    if (!pack.state || typeof pack.state !== 'object' || !pack.state.cities || !pack.state.cities.length)
      return { ok: false, msg: '存档内容不完整（没有城池数据）' };
    if (pack._check && GAME.checksum(JSON.stringify(pack.state)) !== pack._check)
      return { ok: false, msg: '存档校验失败：内容被改动过或复制时掉字了' };
    var id = slotId;
    if (!id) {
      id = GAME.slotEmpty();
      if (!id) return { ok: false, msg: '三个存档位都满了，请先清空一个再导入' };
    }
    var slot = GAME.slotOf(id);
    if (!slot) return { ok: false, msg: '槽位不存在' };
    var raw = JSON.stringify(pack.state);
    try { localStorage.setItem(slot.key, raw); }
    catch (e) { return { ok: false, msg: '写入失败（存储空间不足？）：' + ((e && e.message) || '') }; }
    GAME._setSlotIndex(slot.id, pack.state, raw.length);
    return { ok: true, msg: '已导入到「' + slot.name + '」（' +
      ((pack.state.cities || []).length) + ' 城 · ' + ((pack.state.generals || []).length) + ' 将）', slot: slot.id };
  };

  GAME.clearSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    try { localStorage.removeItem(META_KEY); } catch (e) {}
  };

  /* ---------------- 时间轮：每秒结算 ---------------- */
  GAME.simulateSeconds = function (sec) {
    var s = GAME.state;
    if (!s) return;
    for (var k = 0; k < sec; k++) GAME.tickOnce();
  };

  GAME.tickOnce = function () {
    var s = GAME.state;
    if (!s) return;
    var ts = GAME.timeScale();
    var dtReal = 1; // 现实秒

    /* 定期来袭（第 2 期）—— 唯一出口 GAME.invasionTick，离线补算走同一个函数 */
    GAME.invasionTick(GAME.timeScale() / 3600);

    /* 1) 资源产出：**逐城结算**（v60 · 需求 4）——
       每座城把自己的产量加进自己的库存、按自己的仓容封顶。
       改前是"全境产量加进一份共享库存"，于是切城时资源栏一个数字都不动。 */
    s.cities.forEach(function (ct) {
      var p = GAME.cityProdPerSec(ct);
      var cap = GAME.storeCapOf(ct);
      var R = GAME.res(ct);
      for (var rk2 in p) {
        if (rk2 === 'pop') continue;
        R[rk2] = (R[rk2] || 0) + p[rk2];
        /* 仓库只管粮木石铁四类实物，**黄金是货币，不受储量上限约束**
           （此前黄金一并被 cap 卡住，表现为「黄金涨到 N 万就不再增长」） */
        if (rk2 !== 'gold' && cap > 0 && R[rk2] > cap) R[rk2] = cap;
      }
    });

    /* 2) 军队耗粮（真实：每兵每小时耗粮，出征×2）—— **逐城**扣本城的粮。
       粮尽时有后果：钳制到 0 并按缺口比例逃兵。
       此前只做减法、不设下限，粮能被扣成**无限负数**（实测 20 万铁骑 5 秒后 -151 万），
       而离线补算却有 `if(<0)=0` —— 在线/离线两套口径不一致，刷新页面还会把负粮抹平。 */
    s.cities.forEach(function (ct) {
      var R = GAME.res(ct);
      var feedC = GAME.foodPerSecOf(ct);
      R.grain = (R.grain || 0) - feedC;
      var starving = R.grain < 0;
      if (starving) R.grain = 0;
      ct.starving = starving;
      /* v65（老板）：饿满 24 游戏小时才哗变，之后每满 24 小时各兵种逃 20%。
         计时与触发都在 `GAME.starveStep`（离线补算走同一个函数，不许各写一套）。 */
      var step = GAME.starveStep(ct, starving, ts / 3600);
      var dayIdx = GAME.questDayIndex ? GAME.questDayIndex() : 0;
      if (step.lost > 0) {
        if (GAME._starveLogDay !== dayIdx + '|' + ct.id) {
          GAME._starveLogDay = dayIdx + '|' + ct.id;
          GAME.log('⚠️ ' + ct.name + '缺粮已满 ' + DATA.STARVE.hours + ' 时，'
            + U.fmt(step.lost) + ' 士卒哗变逃散 —— 速运粮草入城');
        }
      } else if (starving && !ct._starveWarn) {
        /* 刚断粮：给出"还有多久才哗变"，玩家才知道自己有多少时间可救 */
        ct._starveWarn = true;
        GAME.log('🕯 ' + ct.name + '粮尽 —— 守军尚可撑 '
          + Math.max(0, DATA.STARVE.hours - Math.floor(step.hours)) + ' 游戏小时，逾时将哗变逃散');
      }
      if (!starving) ct._starveWarn = false;
    });
    s.starving = s.cities.some(function (ct) { return ct.starving; });

    /* 3) 将领月俸（v77 · 老板「经过 7 个游戏日结算 1 次」）——
       不再逐秒扣款：每 7 游戏日一次结清（GAME.settleGenSalary，
       定价见 DATA.GEN_SALARY / GAME.genSalaryOf）。欠俸时置 unpaidAny
       （供 s._unpaid 标记；不损忠诚 —— v14.1 拍板）。 */
    var gc = DATA.GEN_COST, lo = DATA.LOYALTY;
    var unpaidAny = false;
    var _salSettle = GAME.settleGenSalary();
    if (_salSettle && _salSettle.short > 0) unpaidAny = true;

    /* 3b) 将领体力/精力恢复
       忠诚（v14.1 按用户要求）：**只在出征战败时下降**，不再随时间/民心/欠俸衰减。
       保留「忠诚极低有概率离去」的判定 —— 连败才会把人逼走。 */
    var gameHours = ts / 3600;                      // 本 tick 折合的游戏小时
    var deserters = [];
    s.generals.forEach(function (g) {
      var staMx = GAME.staBaseMax(g);   /* v66：余量口径（装备体力常备不失） */
      g.stamina = Math.min(staMx, (g.stamina == null ? staMx : g.stamina) + gc.staPerHour * gameHours);
      g.energy = Math.min(100, (g.energy == null ? 100 : g.energy) + gc.enePerHour * gameHours);
      /* 忠诚极低：有概率离去（名将更难留，但概率仍很低）
         v70：君主除外 —— 「不可解雇」的另一半是"自己不会走" */
      if (!GAME.isLordGeneral(g) && (g.loyalty == null ? 70 : g.loyalty) < lo.desertAt) {
        var chance = lo.desertChancePerHour * gameHours * (g.hero ? 1.6 : 1);
        if (Math.random() < chance) { g._desert = true; deserters.push(g); }
      }
    });
    if (deserters.length) {
      s.generals = s.generals.filter(function (g) { return !g._desert; });
      deserters.forEach(function (g) {
        delete g._desert;
        GAME.log('💨 ' + g.name + ' 忠诚尽失，弃我而去。');
        if (GAME.story && GAME.story.chronicleAdd) GAME.story.chronicleAdd(g.name + '背我而去，投奔他处。', 'note');
      });
    }
    s._unpaid = unpaidAny;

    /* 4) 民心：税率>50% 时每小时 -10×(税-50)/50 */
    var tax = s.tax || 0;
    if (tax > 0.5) {
      var drop = 10 * (tax - 0.5) / 0.5 / 3600 * ts; // 每小时下降
      s.hearts = Math.max(0, s.hearts - drop);
    }

    /* 4b) 民心增益：名将羁绊 + 当世年号（后台静默生效） */
    if (GAME.story) {
      var hAdd = GAME.story.heartsPerHour();
      if (hAdd) s.hearts = U.clamp((s.hearts || 0) + hAdd / 3600 * ts, 0, 100);
    }

    /* 5) 人口增长：**逐城**向本城民房上限爬升（v60 · 需求 4：人口归属城池） */
    s.cities.forEach(function (city) {
      var maxPop = GAME.maxPopOf(city);
      var growth = Math.max(1, maxPop * 0.0005); // 每小时0.05%量级
      var R = GAME.res(city);
      R.pop = R.pop || 0;
      if (R.pop < maxPop) R.pop = Math.min(maxPop, R.pop + growth / 3600 * ts);
      city.maxPop = maxPop;
    });

    /* 6) 建造队列 */
    for (var i = s.queues.build.length - 1; i >= 0; i--) {
      var q = s.queues.build[i];
      q.elapsed += dtReal * ts;
      if (q.elapsed >= q.totalTime) {
        s.queues.build.splice(i, 1);
        GAME.applyBuildDone(q);
      }
    }
    /* 7) 训练队列（v24 · 需求 8：按军营分组，只有最早一条在走） */
    GAME.advanceTrainQueues(dtReal * ts);
    /* 8) 科技队列 */
    for (var k2 = s.queues.tech.length - 1; k2 >= 0; k2--) {
      var tq = s.queues.tech[k2];
      tq.elapsed += dtReal * ts;
      if (tq.elapsed >= tq.totalTime) {
        s.queues.tech.splice(k2, 1);
        GAME.applyTechDone(tq);
      }
    }

    /* 9) 限时宝物到期清理 */
    if (s.buffs) {
      for (var bk in s.buffs) {
        if (s.buffs[bk] && s.buffs[bk].until && U.now() > s.buffs[bk].until) delete s.buffs[bk];
      }
    }

    /* 9b) 自动升级：按等级从低到高排队（受队列上限约束，资源不足自动暂停） */
    if (GAME.autoUpgrade) GAME.autoUpgrade();
    if (GAME.autoResearch) GAME.autoResearch();
    /* v29（需求 5）：自动出征 —— 只在**在线主循环**里驱动。
       离线补算不跑自动出征：它是"按现实分钟节流"的在线行为，
       离线一次补几百分钟会在瞬间把攒下的兵全打光，与"自动刷经验"的
       设计意图不符（那不是让玩家睡一觉回来发现兵没了）。 */
    if (GAME.autoMarch) GAME.autoMarch();

    /* 9c) 随机任务：每现实日刷新 5 个（未完成可累积，上限 5 天） */
    if (GAME.ensureDailyQuests) GAME.ensureDailyQuests();

    /* 9d) 州郡岁贡：按现实日结算占城的持续收益（州特产材料 / 黄金 / 声望） */
    if (GAME.settleDailyYield) GAME.settleDailyYield();

    /* 9e) 野地：等级衰减（被占每现实日 -1 级）+ 采集计时推进 */
    if (GAME.decayWilds) GAME.decayWilds();
    if (GAME.tickGathers) GAME.tickGathers(ts);
    /* v73：种田秘境生长 —— 与建造队列同口径（dtReal × ts） */
    if (GAME.tickFarm) GAME.tickFarm(dtReal * ts);
    if (GAME.artTick) GAME.artTick(dtReal * ts);   // v79：神器供奉（在线主循环）

    /* 9f) 行军队列推进（抵达即结算 —— 见 battle.js GAME.march） */
    if (GAME.march && GAME.march.tick) GAME.march.tick();

    /* 10) 历法天时推进 + 史册记账 + 年号纪元（story.js） */
    if (GAME.story) GAME.story.tick(ts);

    GAME.checkProgressQuests();
  };

  /* 每秒产量（含加成链：科技/宝物/将领/野地） */
  /* --------- 产量：基础 / 因子 / 分解（v20）---------
     需求 11 要求「悬停产量能看到基础产量与各类加成/扣除」。
     为避免「计算一处、展示另一处」的两份逻辑漂移，
     把因子抽取成单一来源 prodFactors()，计算与 UI 共用。 */

  /* 产量基数（每小时）：城外资源建筑 + 城内功能建筑
     ------------------------------------------------------------
     v29（需求 8）：拆出**单城**版本 —— 侧栏「资源」要在切城时跟着变。
     加成因子（科技/宝物/野地/守将/天时）本来就是全境共享的，
     所以只需要把"基数"按城拆开，两边口径就不会漂移。 */
  GAME.prodBasePerHourOf = function (city) {
    var base = { grain: 0, wood: 0, stone: 0, iron: 0 };
    if (!city) return base;
    (city.extGrid || []).forEach(function (e) {
      if (!e || !e.type) return;
      var eb = DATA.EXT_BUILDINGS[e.type];
      if (!eb) return;
      base[eb.res] += eb.prod[e.lv - 1] * 1;
    });
    (city.cells || []).forEach(function (cell) {
      if (!cell.build) return;
      var b = DATA.BUILDINGS[cell.build.id];
      if (!b || !b.prod) return;
      b.prod.forEach(function (p) { base[p.res] = (base[p.res] || 0) + p.amount * cell.build.lvl; });
    });
    return base;
  };
  GAME.prodBasePerHour = function () {
    var s = GAME.state;
    var base = { grain: 0, wood: 0, stone: 0, iron: 0 };
    (s.cities || []).forEach(function (ct) {
      var b = GAME.prodBasePerHourOf(ct);
      for (var r in b) base[r] += b[r];
    });
    return base;
  };

  /* 影响某资源产量的全部因子：[{ name, d }]，d 为乘数增量（0.21 = +21%） */
  GAME.prodFactors = function (r, city) {
    var s = GAME.state, list = [];
    var techMult = GAME.techMult();
    if (techMult[r]) list.push({ name: '科技', d: techMult[r] });
    var itemMult = GAME.prodBuffMult();
    if (itemMult[r]) list.push({ name: '宝物', d: itemMult[r] });
    var wildMult = GAME.wildMult();
    if (wildMult[r]) list.push({ name: '附属野地', d: wildMult[r] });
    if (GAME.story) {
      var sm = GAME.story.prodMult(r);
      if (sm && Math.abs(sm - 1) > 1e-9) list.push({ name: '天时（季/天候/年号）', d: sm - 1 });
    }
    /* v63（老板）：「守将属性只对当前城池起加成作用」——
       这里改成**读本城守将**（唯一出口 `GAME.guardBonus(city)`）。
       改前是 `guardBonusTotal()`（全境所有守将之和），于是 B 城的守将
       也在给 A 城加产量；而 `cityProdPerSec(city)` 明明按城算基数，
       却是"本城的基数 × 全境的加成" —— 两个口径拼在一起，切城时数字还动。 */
    var gbProd = GAME.guardBonus ? GAME.guardBonus(city) : { prod: 0 };
    if (gbProd.prod) list.push({ name: '守将内政', d: gbProd.prod });
    var wr = (s.workRate && s.workRate[r] != null) ? s.workRate[r] : 100;
    if (wr !== 100) list.push({ name: '开工率 ' + wr + '%', d: wr / 100 - 1 });
    /* v28（需求 1）：马厩/鸿胪寺/铁匠铺满级专精 —— 全城产量 +6%（逐座叠加） */
    if (GAME.mastery) {
      var mp = GAME.mastery('prodPct', null);
      if (mp > 0) list.push({ name: '满级专精', d: mp });
    }
    return list;
  };

  /* 单城每秒产量（v29 · 需求 8）：与 productionPerSec 同一套因子，只换基数
     v60（需求 5）：再乘**名城档位优势**的 prodPct / taxPct ——
     这是"名城专有优势"的落地点（DATA.CITY_PERK），别处不要再按 type 加成。 */
  GAME.cityProdPerSec = function (city) {
    var s = GAME.state, ts = GAME.timeScale();
    var out = { grain: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    if (!city) return out;
    /* v79：「本城产量」加成 = 名城档位 + 爵位 + 主城 + 神器（唯一汇总口） */
    var perkProd = 1 + GAME.cityBonusNum(city, 'prodPct');
    var base = GAME.prodBasePerHourOf(city);
    for (var r2 in base) {
      var m = 1;
      GAME.prodFactors(r2, city).forEach(function (f) { m *= (1 + f.d); });
      out[r2] = base[r2] * m * perkProd / 3600 * ts;
    }
    var popCap = GAME.maxPopOf(city);
    /* v73（老板「限制黄金的获取」）：税收按 DATA.GOLD_GATE.tax 收紧 */
    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct'))
      * (DATA.GOLD_GATE.tax || 1);
    var gm = 1;
    var itemM2 = GAME.prodBuffMult();
    if (itemM2.gold) gm = 1 + itemM2.gold;
    if (GAME.story) gm *= GAME.story.prodMult('gold');
    out.gold += taxGold * gm / 3600 * ts;
    return out;
  };

  /* 全境合计（每秒）：**各城实际增产之和** + 爵位的俸禄收入（记在首城）。
     v60 起它不再是"另一套算法"，而是 Σ cityProdPerSec —— 否则
     侧栏"本城产量"与"全境合计"会用两把尺子（本项目最经典的失效模式）。
     俸禄只加到首城，是因为爵位属于"府库"层面的收入，不该每城各算一遍。 */
  GAME.productionPerSec = function () {
    var s = GAME.state;
    var out = { grain: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    if (!s) return out;
    ((s.cities) || []).forEach(function (c) {
      var p = GAME.cityProdPerSec(c);
      for (var k in out) out[k] += (p[k] || 0);
    });
    var salary = (DATA.RANK[s.rank || 0].salary || 0);
    if (salary) {
      var gm = 1, itemM2 = GAME.prodBuffMult();
      if (itemM2.gold) gm = 1 + itemM2.gold;
      if (GAME.story) gm *= GAME.story.prodMult('gold');
      /* v73（老板「限制黄金的获取」）：俸禄同口径收紧（DATA.GOLD_GATE.salary） */
      out.gold += salary * gm / 3600 * GAME.timeScale() * (DATA.GOLD_GATE.salary || 1);
    }
    return out;
  };

  /* 产量分解（/秒）：瀑布式求和，各项相加**正好等于**总产量。
     需求 11：悬停产量显示「基础 + 各类加成/扣除」。 */
  GAME.prodBreakdown = function (r, city) {
    var ts = GAME.timeScale();
    var rows = [];
    if (r === 'gold') {
      var s = GAME.state;
      var popCap = city ? GAME.maxPopOf(city)
        : s.cities.reduce(function (a, c) { return a + GAME.maxPopOf(c); }, 0);
      /* v73：黄金闸门与 cityProdPerSec / productionPerSec 同口径 ——
         否则"分解各项之和 = 总产量"对不上（显示与结算是两本账，本项目的老病）。 */
      var tax = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);
      var salary = (DATA.RANK[s.rank || 0].salary || 0) * (DATA.GOLD_GATE.salary || 1);
      rows.push({ name: '税收（人口' + U.numText(popCap, 0) + '×民心' + Math.round(s.hearts || 100) + '%×税率' + Math.round((s.tax || 0) * 100) + '%）', val: tax / 3600 * ts });
      if (salary) rows.push({ name: '爵位俸禄', val: salary / 3600 * ts });
      var itemM = GAME.prodBuffMult();
      var baseG = tax + salary;
      if (itemM.gold) rows.push({ name: '宝物加成 +' + Math.round(itemM.gold * 100) + '%', val: baseG * itemM.gold / 3600 * ts });
      if (GAME.story) {
        var smg = GAME.story.prodMult('gold');
        if (Math.abs(smg - 1) > 1e-9) rows.push({ name: '天时（季/天候/年号）' + (smg >= 1 ? '+' : '') + Math.round((smg - 1) * 100) + '%', val: baseG * (1 + (itemM.gold || 0)) * (smg - 1) / 3600 * ts });
      }
      return rows;
    }
    var base = ((city ? GAME.prodBasePerHourOf(city)[r] : GAME.prodBasePerHour()[r]) || 0) / 3600 * ts;
    rows.push({ name: '基础产量（城外建筑 + 城内功能建筑）', val: base });
    /* 瀑布分解：每项贡献 = 之前累积乘数 × 本项增量 × 基数 */
    var acc = base;
    GAME.prodFactors(r, city).forEach(function (f) {
      var contrib = acc * f.d;
      rows.push({ name: f.name + ' ' + (f.d >= 0 ? '+' : '') + Math.round(f.d * 1000) / 10 + '%', val: contrib });
      acc += contrib;
    });
    return rows;
  };

  /* 科技产量加成（type 为资源键的） */
  GAME.techMult = function () {
    var s = GAME.state, m = {};
    (DATA.TECH || []).forEach(function (t) {
      var lv = s.techs[t.id] || 0;
      if (lv > 0 && ['grain', 'wood', 'stone', 'iron'].indexOf(t.type) >= 0) {
        m[t.type] = (m[t.type] || 0) + lv * t.per;
      }
    });
    return m;
  };
  /* 宝物生产加成 */
  GAME.prodBuffMult = function () {
    var s = GAME.state, m = {};
    (s.buffs || {}).prod && Object.keys(s.buffs.prod).forEach(function (res) {
      m[res] = (m[res] || 0) + s.buffs.prod[res];
    });
    return m;
  };
  /* 野地加成（v15 改**线性**）：每级 += add[res]，与等级严格成正比。
     旧实现是「满级值 − 缺口×衰减」，把 10 级湖泊算成 +35%，原版应为 +80%。 */
  GAME.wildMult = function () {
    var s = GAME.state, m = {};
    (s.wilds || []).forEach(function (w) {
      var add = GAME.wildAddOf ? GAME.wildAddOf(w.type, w.level) : null;
      if (!add) return;
      for (var r in add) m[r] = (m[r] || 0) + add[r];
    });
    return m;
  };

  /* 军队每秒耗粮 */
  /* 军队耗粮（/秒）。
     v60（需求 4）：拆出**单城**版本 —— 粮草归属城池，各城军队吃自己城的粮。
     不传 city = 全境合计（供界面显示与存档索引）。 */
  GAME.foodPerSecOf = function (city) {
    var s = GAME.state, ts = GAME.timeScale();
    if (!s) return 0;
    var feed = 0;
    var list = city ? [city] : s.cities;
    (list || []).forEach(function (ct) {
      for (var id in (ct.army || {})) {
        var t = DATA.TROOPS[id];
        if (t) feed += ct.army[id] * t.food;
      }
    });
    if (GAME.story) feed *= GAME.story.feedMult();
    return feed / 3600 * ts;
  };
  GAME.foodPerSec = function () { return GAME.foodPerSecOf(null); };

  /* --------- 缺粮哗变（v65 · 老板） ---------
   * 老板原话：「缺粮 24h 后军队才会哗变，各兵种每 24h 逃离当前剩余数量的 20%」
   *
   * 改前（`applyStarvation`）：粮一断就按**缺口占需求的比例**逃兵（单次封顶 15%/tick）——
   *   规则说不清（逃多少取决于缺口比例），而且断粮当场掉兵，玩家根本来不及救。
   *   它还只吃该城的兵（v60 的口径，这条保留到新实现里）。
   * 改后两条：
   *   ① `mutinyOf(city)` —— 一次哗变：**各兵种逃当前数量的 20%**；
   *   ② `starveStep(city, starving, gameHours)` —— 缺粮计时与"每满 24 小时来一次"的推进，
   *      **在线 tickOnce 与离线 simulateBulk 共用它**（两套口径漂移是这个项目的老毛病）。
   * 粮一接上就**清零重计**：否则"断断续续缺粮"会攒够 24 小时突然哗变，玩家看不懂。
   * ------------------------------------------------------------ */
  GAME.mutinyOf = function (city) {
    var s2 = GAME.state;
    var pct = (DATA.STARVE && DATA.STARVE.mutinyPct) || 0.2;
    var lost = 0, kinds = 0;
    ((city ? [city] : ((s2 && s2.cities) || []))).forEach(function (c) {
      for (var id in (c.army || {})) {
        var n = c.army[id];
        if (!(n > 0)) continue;
        /* 各兵种**分别**逃 20%（向下取整：不到 5 人的小队不会归零消失） */
        var d = Math.floor(n * pct);
        if (d <= 0) continue;
        c.army[id] = n - d;
        lost += d; kinds++;
        if (c.army[id] <= 0) delete c.army[id];
      }
    });
    return { lost: lost, kinds: kinds };
  };
  /* 推进一个时间步的缺粮计时；返回本步的哗变结果。
     `starving` = 本步结算后该城是否仍无粮；gameHours = 本步折合的游戏小时。 */
  GAME.starveStep = function (city, starving, gameHours) {
    var need = (DATA.STARVE && DATA.STARVE.hours) || 24;
    if (!starving) {
      if (city.starveHours) city.starveHours = 0;      // 粮接上 → 清零重计
      city.isFamine = false;
      return { lost: 0, kinds: 0, cycles: 0, hours: 0 };
    }
    city.starveHours = (city.starveHours || 0) + (gameHours || 0);
    var lost = 0, kinds = 0, cycles = 0;
    while (city.starveHours >= need) {
      city.starveHours -= need;                        // 扣一个周期，余数留给下一次
      var mu = GAME.mutinyOf(city);
      lost += mu.lost; kinds = mu.kinds; cycles++;
    }
    city.isFamine = city.starveHours > 0;
    return { lost: lost, kinds: kinds, cycles: cycles, hours: city.starveHours };
  };

  /* 当前是否处于断粮状态（供出征拦截与界面提示共用）。v60：按城判定 ——
     出征拦截用的是"出发城"，所以这里默认看当前城。 */
  GAME.isStarving = function (city) {
    var s = GAME.state;
    if (!s) return false;
    var c = city || GAME.currentCity();
    var prod = c && GAME.cityProdPerSec ? (GAME.cityProdPerSec(c).grain || 0) : 0;
    var R = GAME.res(c);
    return (R.grain || 0) <= 0 && GAME.foodPerSecOf(c) > prod;
  };

  /* ============================================================
   * 定期来袭（第 2 期 · 防守）—— 全部唯一出口
   * ------------------------------------------------------------
   *   invasionTick(gameHours)   时间轮推进（**在线 tickOnce 与离线 simulateBulk 共用**）
   *   invasionDueAt(city)       下次来袭时间（游戏秒；供界面读）
   *   armyPowerOf(city)         本城兵力战力（单兵战力复用 story.troopPower，不另造出口）
   *   defensePowerOf(city)      本城守备力 —— **城防在这里被真正消费**
   *   invasionPowerOf(city)     本次来袭规模
   *   invasionResolve(city)     结算
   * 状态存在 `city.inv = { nextAt, warned }` —— 跨时间且会被修改，**必须入存档**。
   * ============================================================ */

  /* 资源中文名走 `GAME.resName`（domain.js 里已有，**唯一出口**）。
     ⚠️ 这里不要再写一份 —— 同一个名字的定义只允许一处，
        重复会被 audit 拦下（pre-commit 门禁会直接拒绝提交）。 */

  /* 可复现随机：同一个 seed 永远同一个数（否则断言没法稳定，破坏测试也没法翻转） */
  GAME.invasionRoll = function (seed) {
    var h = 2166136261 >>> 0;
    var str = String(seed);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 100000) / 100000;
  };

  /* 本城兵力战力 —— 单兵战力复用 story.troopPower（**不另造第二个出口**） */
  GAME.armyPowerOf = function (city) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var total = 0;
    var army = (city && city.army) || {};
    for (var k in army) total += (tp ? tp(k) : 1) * (army[k] || 0);
    return Math.round(total);
  };

  /* 本城守备力 = 兵力战力 ×（1 + 城防/defDivisor）
     ⚠️ 这一行就是"让城墙/箭塔真正生效"的接口：`GAME.cityDefense` 已含
     城墙等级 ×20、箭塔 homeDef、守将智谋、羁绊守御、满级专精 +25%。 */
  GAME.defensePowerOf = function (city) {
    if (!city) return 0;
    var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
    var wallPct = (GAME.cityDefense(city) || 0) / div;
    return Math.round(GAME.armyPowerOf(city) * (1 + wallPct));
  };

  /* 来袭规模 = 玩家全境战力 × ratio（按城与周期取可复现的 ratio） */
  GAME.invasionPowerOf = function (city, cycle) {
    var s = GAME.state, I = DATA.INVASION || {};
    var total = 0;
    (s.cities || []).forEach(function (c) { total += GAME.armyPowerOf(c); });
    var r0 = GAME.invasionRoll('inv|' + (city && city.id) + '|' + (cycle == null ? 0 : cycle));
    var lo = (I.ratioMin == null ? 0.28 : I.ratioMin), hi = (I.ratioMax == null ? 0.45 : I.ratioMax);
    return Math.max(1, Math.round(total * (lo + r0 * (hi - lo))));
  };

  /* 下次来袭时间（游戏秒）。首次进入解锁条件时排期，之后按间隔滚动。 */
  GAME.invasionDueAt = function (city) {
    var I = DATA.INVASION || {};
    if (!city) return 0;
    var s = GAME.state;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || s.settings.invasion === false) return 0;
    if ((s.cities || []).length < need) return 0;
    if (!city.inv) return 0;
    return city.inv.nextAt || 0;
  };

  /* 间隔（游戏秒）：城越多越紧，但不低于 minDays */
  GAME.invasionIntervalSec = function () {
    var I = DATA.INVASION || {};
    var s = GAME.state;
    var n = (s.cities || []).length;
    var days = (I.baseDays || 4) - Math.max(0, n - 1) * (I.tightenPerCity || 0);
    days = Math.max(I.minDays || 2, days);
    return Math.round(days * 86400);
  };

  /* 结算：按 攻/守 比值算战损。返回明细供日志与断言读。 */
  GAME.invasionResolve = function (city) {
    var I = DATA.INVASION || {};
    var now = (GAME.state.world && GAME.state.world.elapsed) || 0;
    var cycle = Math.floor(now / 86400);
    var atk = GAME.invasionPowerOf(city, cycle);
    var def = GAME.defensePowerOf(city);
    /* ratio ∈ (0,1)：越接近 0 说明守方越强 */
    var ratio = atk / (atk + def || 1);
    var held = ratio <= 0.5;
    /* ⚠️ severity 的分支必须**与 out 同源**：先前把 severity 先写进 out、
       再在下面按 held 重算，导致返回明细永远是被破口径（守住时恒 0），
       而实际扣损用的是重算值 —— 返回值和真实行为对不上。
       （这个缺陷是 smoke 第 53 节那条 ★ 断言抓出来的，不是看出来的。） */
    var severity = held
      ? ratio * 0.35                                  // 守住：也折损，但不是零代价（否则"堆兵"成无脑解）
      : Math.max(0, (ratio - 0.5) * 2);               // 被破：ratio 刚过 0.5 时从 0 起
    /* v86：坚壁清野 —— 生效期内损失 −40%（severity 是唯一的损失总闸） */
    var _jb = GAME.schemeDefOf(city, 'jianbi', now);
    if (_jb) severity *= (1 - _jb.eff.invLossCut);
    var L = I.loss || {};
    var out = { atk: atk, def: def, ratio: ratio, held: held, severity: severity,
      resLost: {}, troopsLost: 0, wallDrop: 0 };

    var R = GAME.res(city);
    for (var k in { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1 }) {
      var pct = severity * (L.resPct || 0.15);
      var lost = Math.floor((R[k] || 0) * pct);
      if (lost > 0) { R[k] -= lost; out.resLost[k] = lost; }
    }
    /* 损兵：按各兵种等比减少，向下取整（不出现负数） */
    var tpct = severity * (L.troopPct || 0.10);
    for (var t in (city.army || {})) {
      var lose = Math.floor((city.army[t] || 0) * tpct);
      if (lose > 0) { city.army[t] -= lose; out.troopsLost += lose; }
    }
    /* 城墙掉级：只有被破（severity 高）才掉，且不丢城 */
    if (!held && severity > 0.5 && (L.wallDrop || 0) > 0) {
      var wl = GAME.buildingLevel(city, 'chengqiang') || 0;
      if (wl > 0) {
        city.wallLv = wl - (L.wallDrop || 1);
        out.wallDrop = L.wallDrop || 1;
      }
    }
    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }
    return out;
  };

  /* 时间轮推进 —— **在线 tickOnce 与离线 simulateBulk 共用这一处**。
     gameHours：本次推进经过的游戏小时数（离线补算会传一大段）。 */
  GAME.invasionTick = function (gameHours) {
    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (s.settings && s.settings.invasion === false) return 0;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if ((s.cities || []).length < need) return 0;
    var now = (s.world && s.world.elapsed) || 0;
    var fired = 0;

    s.cities.forEach(function (city) {
      if (!city.inv) city.inv = { nextAt: now + GAME.invasionIntervalSec(), warned: false };
      /* 离线可能一次跨过多个周期 —— 用 while 逐个结算，不许只判一次 */
      var guard = 0;
      while (city.inv.nextAt <= now && guard++ < 50) {
        /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；周期照常推进）。
           显式读 eff.invSkip：效果键必须有字面读取点（防死数据，smoke §71 守）。 */
        var _kc = GAME.schemeDefOf(city, 'kongcheng', now);
        if (_kc && _kc.eff.invSkip) {
          GAME.schemeDefConsume(city, 'kongcheng', now);
          GAME.log('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
          city.inv.nextAt += GAME.invasionIntervalSec();
          city.inv.warned = false;
          continue;
        }
        var detail = GAME.invasionResolve(city);
        fired++;
        var src = (I.sources || ['敌军'])[Math.floor(GAME.invasionRoll('src|' + city.id + '|' + city.inv.nextAt) * (I.sources || ['敌军']).length)];
        var head = detail.held
          ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）';
        var bits = [];
        for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));
        if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
        if (detail.wallDrop) bits.push('城墙 −' + detail.wallDrop + ' 级');
        if (detail.repDrop) bits.push('声望 −' + detail.repDrop);
        GAME.log(head + (bits.length ? '：' + bits.join('、') : ''));
        city.inv.nextAt += GAME.invasionIntervalSec();
        city.inv.warned = false;
      }
      /* 预警：到点前 warnHours（有烽火台再加）先报一次 */
      var bc = Math.min(I.warnBeaconMax || 3, GAME.buildingLevel(city, 'fenghuotai') || 0);
      var warnSec = ((I.warnHours || 12) + bc * (I.beaconBonusHours || 12)) * 3600;
      if (!city.inv.warned && city.inv.nextAt - now <= warnSec && city.inv.nextAt > now) {
        city.inv.warned = true;
        var hrs = Math.max(1, Math.round((city.inv.nextAt - now) / 3600));
        GAME.log('🔥 烽火：' + city.name + ' 约 ' + hrs + ' 游戏时后将有兵马犯境'
          + (bc > 0 ? '（烽火台 Lv' + bc + ' 提前预警）' : '（无烽火台，预警较迟）'));
      }
    });
    return fired;
  };

  /* 建造完成 */
  GAME.applyBuildDone = function (q) {
    var s = GAME.state;
    if (q.type === 'ext_build' || q.type === 'ext_upgrade') {
      var qc = GAME.cityById(q.cityId) || (s.cities && s.cities[0]);
      var e = qc ? GAME.extGridOf(qc)[q.extIdx] : null;
      /* 地块可能已被拆毁或改作他用：施工标记不符则丢弃该队列项
         （此前的写法会在 cell/e 为 null 时抛错，拆毁功能使其成为必现路径） */
      if (!e) return;
      if (!e.pending || e.pending !== q.buildId) return;
      if (q.type === 'ext_build') { e.type = q.buildId; e.lv = 1; }
      else e.lv = q.targetLevel;
      e.pending = null;   // 关键：清掉建设中标记
      GAME.log('城外' + (DATA.EXT_BUILDINGS[q.buildId] ? DATA.EXT_BUILDINGS[q.buildId].name : '建筑') + (q.type === 'ext_build' ? '建造完成' : '升级至 Lv' + q.targetLevel));
      return;
    }
    /* v16：城墙（不占格，环绕城池） */
    if (q.type === 'wall') {
      var wc = GAME.cityById(q.cityId);
      if (wc) {
        var wasLv = wc.wallLv || 0;
        wc.wallLv = q.targetLevel;
        GAME.statBump('buildDone', 1);
        GAME.log('城墙' + (wasLv === 0 ? '建成' : '升级至 Lv' + q.targetLevel)
          + '（耐久 ' + (q.targetLevel * 100) + '万 · 守军防御 +' + (q.targetLevel * 10) + '%）');
      }
      return;
    }
    var city = GAME.cityById(q.cityId);
    if (!city) return;
    var idx = q.gridIndex;
    var cell = city.cells[idx];
    if (!cell) return;
    if (q.type === 'build') {
      if (cell.build) return;           // 该格已有建筑，丢弃过期队列项
      cell.build = { id: q.buildId, lvl: 1 };
      cell.pending = null;
    } else if (q.type === 'upgrade') {
      if (!cell.build) return;          // 建筑已在施工期间被拆毁
      cell.build.lvl = q.targetLevel;
      cell.pending = null;              // v16：升级完成必须清施工标记
      /* 官府 4 格同步升级 */
      if (cell.build.id === 'guanfu') {
        city.cells.forEach(function (c) { if (c.build && c.build.id === 'guanfu') c.build.lvl = q.targetLevel; });
      }
    }
    GAME.statBump('buildDone', 1);
    GAME.log('建筑完成：' + (DATA.BUILDINGS[q.buildId] ? DATA.BUILDINGS[q.buildId].name : q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''));
  };

  /* 训练完成 */
  GAME.applyTrainDone = function (t) {
    var city = GAME.cityById(t.cityId);
    if (!city) return;
    city.army[t.troopId] = (city.army[t.troopId] || 0) + t.count;
    GAME.advanceQuestTrain(t.troopId, t.count);
    GAME.statBump('trained', t.count);
    GAME.log('训练完成：' + (DATA.TROOPS[t.troopId] ? DATA.TROOPS[t.troopId].name : t.troopId) + ' ×' + t.count);
  };

  /* 科技完成 */
  GAME.applyTechDone = function (tq) {
    var s = GAME.state;
    s.techs[tq.techId] = (s.techs[tq.techId] || 0) + 1;
    GAME.statBump('techDone', 1);
    var name = tq.techId;
    (DATA.TECH || []).forEach(function (t) { if (t.id === tq.techId) name = t.name; });
    GAME.log('科技完成：' + name);
  };

  GAME.cityById = function (id) {
    var s = GAME.state;
    if (!s) return null;
    for (var i = 0; i < s.cities.length; i++) if (s.cities[i].id === id) return s.cities[i];
    return null;
  };

  /* ============================================================
   * 消息日志（v16）
   *  · GAME.sessionLog —— 内存镜像（关页面即清空）
   *  · state.msgLog    —— **写入存档**，跨会话保留，阅读历史提示
   *  · 保留策略：最近 **10 个游戏天**内的全部提示，且至少 300 条、至多 800 条
   *    （1 游戏天仅 1.33 现实秒，纯按天数会瞬间清空，故设条数下限兜底）
   * ============================================================ */
  GAME.sessionLog = [];
  GAME.MSG_MIN = 300;
  GAME.MSG_MAX = 800;
  GAME.msgDays = function () { return 10; };
  GAME.msgLog = function () {
    var s = GAME.state;
    if (!s) return [];
    s.msgLog = s.msgLog || [];
    return s.msgLog;
  };
  GAME.pruneMsgLog = function () {
    var s = GAME.state;
    if (!s) return;
    var now = (s.world && s.world.elapsed) || 0;
    var win = ((DATA.CALENDAR && DATA.CALENDAR.secPerYear) || 57600) / 360 * GAME.msgDays();
    function keep(list) {
      var out = [];
      for (var i = list.length - 1; i >= 0; i--) {
        var l = list[i];
        if (out.length < GAME.MSG_MIN || (now - (l.gt || 0)) <= win) out.push(l);
      }
      out.reverse();
      if (out.length > GAME.MSG_MAX) out = out.slice(-GAME.MSG_MAX);
      return out;
    }
    s.msgLog = keep(s.msgLog || []);
    GAME.sessionLog = keep(GAME.sessionLog);
  };
  GAME.log = function (msg) {
    var s = GAME.state;
    if (!s) return;
    s.log.unshift({ t: U.now(), msg: msg });
    if (s.log.length > 40) s.log.pop();
    var gt = (s.world && s.world.elapsed) || 0;
    var rec = { t: U.now(), gt: gt, msg: msg };
    GAME.sessionLog.push(rec);
    s.msgLog = s.msgLog || [];
    s.msgLog.push(rec);
    GAME.pruneMsgLog();
    if (GAME.onLog) GAME.onLog(msg);
  };

  /* ============================================================
   * v86（老板「按计划进行」· 第四轮 G1）：计谋 / 锦囊 —— 唯一出口组
   * ------------------------------------------------------------
   * 状态存储：`s.schemes = { [key]: { [sid]: { n, day, until } } }`
   *   · n     = 累计施计次数（挑拨离间：忠诚 = 100 − loyaltyDrop × n）
   *   · day   = 最近一次施计的游戏日（挑拨离间"对同一城每日限一次"）
   *   · until = 防御计到期时刻（游戏秒）
   * 运行中会被修改 → **入存档**（随 s 序列化）。
   * Key 规则（schemeKeyOf）：NPC 城 'npc:<id>'、据点 'fort:<id>'、
   *   野地 'w:x,y'；防御计布在自己城上，独立前缀 'my:<cityId>'。
   * 费用：精力扣在施计将领 gen.energy（与出征同一条链）；
   *   锦囊走 s.items.jinang（商城道具）。
   * ============================================================ */
  GAME.schemeOf = function (sid) {
    var list = DATA.SCHEMES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === sid) return list[i];
    return null;
  };

  GAME.schemeKeyOf = function (t) {
    if (!t) return '';
    if (t.npc && t.npc.id) return 'npc:' + t.npc.id;
    if (t.fort && t.fort.id) return 'fort:' + t.fort.id;
    return (t.kind === 'wild' ? 'w:' : 'c:') + (t.x | 0) + ',' + (t.y | 0);
  };

  GAME.schemeMarksOf = function (key, sid) {
    var s = GAME.state || {};
    var rec = (s.schemes || {})[key];
    var r = rec && rec[sid];
    return r ? (r.n || 0) : 0;
  };

  /* 校验（UI 选择时与出发时共用同一把尺）——只查"能不能施" */
  GAME.schemePrepare = function (sid, t, gen) {
    var s = GAME.state;
    var sc = GAME.schemeOf(sid);
    if (!sc) return { ok: false, msg: '未知计谋' };
    if (!gen) return { ok: false, msg: '需要主将施计' };
    if (sid === 'tiaobo' && t.kind === 'wild') {
      return { ok: false, msg: '野地无守将，挑拨离间无处施展' };
    }
    if ((gen.energy || 0) < sc.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服清心丸' };
    }
    var have = (s.items && s.items.jinang) || 0;
    if (have < sc.jinang) {
      return { ok: false, msg: '锦囊不足（' + have + '/' + sc.jinang + '），可在商城购买' };
    }
    if (sid === 'tiaobo') {
      var key = GAME.schemeKeyOf(t);
      var rec = (s.schemes || {})[key];
      var dayNow = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
      if (rec && rec[sid] && rec[sid].day === dayNow) {
        return { ok: false, msg: '今日已对该目标用过挑拨离间（每日限一次）' };
      }
    }
    return { ok: true, scheme: sc };
  };

  /* 施计：扣费 + 记标记（调用前请先走 schemePrepare） */
  GAME.schemeUse = function (sid, t, gen) {
    var s = GAME.state;
    var sc = GAME.schemeOf(sid);
    if (!sc || !gen) return null;
    gen.energy = Math.max(0, (gen.energy || 0) - sc.energy);
    s.items = s.items || {};
    s.items.jinang = (s.items.jinang || 0) - sc.jinang;
    if (s.items.jinang <= 0) delete s.items.jinang;
    var key = GAME.schemeKeyOf(t);
    s.schemes = s.schemes || {};
    var rec = s.schemes[key] = s.schemes[key] || {};
    var r = rec[sid] = rec[sid] || { n: 0 };
    r.n++;
    r.day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    GAME.log('🎴 ' + gen.name + ' 施展「' + sc.name + '」：' + sc.tip
      + '（精 −' + sc.energy + ' · 囊 −' + sc.jinang + '）');
    return r;
  };

  /* —— 防御计（布在自己城上，持续 durH 小时）—— */
  GAME.schemeDefOf = function (city, sid, now) {
    var s = GAME.state;
    if (!city) return null;
    now = now == null ? ((s.world && s.world.elapsed) || 0) : now;
    var rec = ((s.schemes || {})['my:' + city.id] || {})[sid];
    if (!rec || !rec.until || rec.until <= now) return null;
    var sc = GAME.schemeOf(sid);
    return sc ? { eff: sc.eff, until: rec.until, left: rec.until - now } : null;
  };

  GAME.schemeDefSet = function (city, sid, gen) {
    var s = GAME.state;
    var sc = GAME.schemeOf(sid);
    if (!sc || !city) return null;
    var now = (s.world && s.world.elapsed) || 0;
    if (gen) gen.energy = Math.max(0, (gen.energy || 0) - sc.energy);
    s.items = s.items || {};
    s.items.jinang = (s.items.jinang || 0) - sc.jinang;
    if (s.items.jinang <= 0) delete s.items.jinang;
    var key = 'my:' + city.id;
    s.schemes = s.schemes || {};
    var rec = s.schemes[key] = s.schemes[key] || {};
    rec[sid] = rec[sid] || { n: 0 };
    rec[sid].n++;
    rec[sid].until = now + sc.durH * 3600;
    GAME.log('🎴 布防「' + sc.name + '」于 ' + city.name + '：' + sc.tip
      + '（精 −' + sc.energy + ' · 囊 −' + sc.jinang + '）');
    return rec[sid];
  };

  /* 一次性消耗（空城计奏效时清除状态并返回 true） */
  GAME.schemeDefConsume = function (city, sid, now) {
    var act = GAME.schemeDefOf(city, sid, now);
    if (!act) return false;
    var s = GAME.state;
    var key = 'my:' + city.id;
    if (s.schemes && s.schemes[key] && s.schemes[key][sid]) {
      delete s.schemes[key][sid];
    }
    return true;
  };

  /* v87「野地专属场景」-> v88.1 整合：
     wildSceneOf / wildSceneCheck / wildSceneDo 三函数已并入下方「江湖游历」出口组
     （GAME.jianghuCheck / GAME.jianghuDo 的 kind:'scene' 分支）——
     数据、锁（s.jianghu）、扣费、种子化、UI 入口全部统一走江湖游历。 */

  /* ============================================================
   * v88（老板「修炼培养系统」）：灵气双轨 + 江湖游历 —— 唯一出口组
   * ------------------------------------------------------------
   * ① 双轨切换：g.equipOn = 'sha'（军装）| 'ling'（修炼）。
   *    分流唯一出口 systems.equipBagOf -> genEquipBonus；六维/体力/战斗/
   *    界面显示全部消费该出口 —— 切换后全链自动同步（零特判）。
   * ② 灵力（lingPowerOf）：修炼装备汇总（Σ lingv x 蕴养系数）。
   *    **独立于六维与战斗公式** —— 只用于江湖游历判定（与当前生效套无关）。
   * ③ 江湖游历：与 v87 地形场景并存（场景=趣味奇遇一次；江湖=修炼活动菜单，
   *    每处**每活动**每日一次，锁 s.jianghu = { 'x,y|act': day }）。
   *    消耗精力+体力；判定看灵力；风险=负伤（不损兵）；产出=灵气精华+低概率装备；
   *    结果种子化（invasionRoll，同一天同一地同一活动稳定可复现）。
   * ============================================================ */
  GAME.lingPowerOf = function (g) {
    if (!g) return 0;
    var bag = g.lingEquip || {}, t = 0;
    var perLv = (DATA.LING_TEMPER && DATA.LING_TEMPER.perLv) || 0.08;
    for (var slot in bag) {
      var inst = bag[slot];
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!it || !it.lingv) continue;
      t += it.lingv * (1 + (GAME.eqEnhOf ? GAME.eqEnhOf(inst) : 0) * perLv);
    }
    return Math.round(t);
  };

  /* 双轨切换：want 省略 = 来回切；显式给 'sha'/'ling' 则定向 */
  GAME.toggleEquipSet = function (genId, want) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    /* v89：修炼线君主专属 —— 非君主一切切换请求拒绝，并归位军装（老档兜底） */
    if (!GAME.canCultivate(g)) {
      if (g.equipOn === 'ling') g.equipOn = 'sha';
      return { ok: false, msg: '修炼乃君主专属 —— 只有君主可切换修炼装备' };
    }
    var cur = g.equipOn || 'sha';
    var next = (want === 'sha' || want === 'ling') ? want : (cur === 'sha' ? 'ling' : 'sha');
    if (next === cur) return { ok: false, msg: '当前已是' + (next === 'ling' ? '修炼' : '军中') + '装备' };
    g.equipOn = next;
    var n = Object.keys(((next === 'ling') ? g.lingEquip : g.equip) || {}).length;
    GAME.log(g.name + ' 换装：' + (next === 'ling' ? '☯ 修炼装备' : '⚔ 军中装备') + '（' + n + ' / 12 件）');
    return { ok: true, msg: '已切换为' + (next === 'ling' ? '☯ 修炼装备' : '⚔ 军中装备'), set: next };
  };

  /* --------- 江湖游历 --------- */
  /* v89.4：候选（某地形上"理论上"可能发生的全部活动）—— 分布与测试共用 */
  GAME.jianghuCands = function (terrain) {
    var out = [];
    Object.keys(DATA.LING_ACT || {}).forEach(function (id) {
      var a = DATA.LING_ACT[id];
      if (a.spots && a.spots.indexOf(terrain) >= 0) out.push({ id: id, def: a });
    });
    return out;
  };
  /* v89.4：逐地分布 —— 某格的活动组合 = 格子坐标的确定性函数（同格恒同貌）。
     ① 荒僻率：不是所有野地都有活动；② 有事格 1~3 事（按候选洗牌裁剪）。 */
  GAME.jianghuActsAt = function (x, y) {
    var tile = GAME.map.tile(x, y);
    if (!tile) return [];
    var cands = GAME.jianghuCands(tile.terrain);
    if (!cands.length) return [];
    var sp = DATA.JH_SPREAD || {};
    var r = function (salt) { return GAME.invasionRoll('jhsp|' + x + ',' + y + '|' + salt); };
    var roll0 = r('any');
    if (roll0 < (sp.noneP != null ? sp.noneP : 0.3)) return [];
    var want = roll0 < (sp.p2 != null ? sp.p2 : 0.62) ? 1
      : (roll0 < (sp.p3 != null ? sp.p3 : 0.87) ? 2 : 3);
    var list = cands.slice().sort(function (a2, b2) { return r('o:' + a2.id) - r('o:' + b2.id); });
    return list.slice(0, Math.min(want, list.length));
  };
  /* v89.5：灵机之地 —— 有事的野地中「值得专程一访」者（大地图悬青旗）。
     灵机 = 事数 × 野地等级，≥ DATA.JH_MARK.minScore 者为地标（mark）。
     返回 null = 此地无江湖事（荒僻 / 非野地地形）。地图渲染与点选信息共用此出口。 */
  GAME.jianghuSpotInfo = function (x, y) {
    var acts = GAME.jianghuActsAt(x, y);
    if (!acts.length) return null;
    var lv = GAME.map.wildLevelNow(x, y);
    var score = lv * acts.length;
    var th = (DATA.JH_MARK && DATA.JH_MARK.minScore != null) ? DATA.JH_MARK.minScore : 10;
    return { n: acts.length, lv: lv, score: score, mark: score >= th };
  };

  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：奇遇 · 见闻录
   * ------------------------------------------------------------
   * 三件套：
   *   ① wonderSites —— 隐藏点位（map.seed 的确定性函数，一次生成缓存）：
   *      三带密度：近郊多逸闻、绝域多奇珍绝景；不与据点/城池重叠。
   *   ② 现形：线索（活动结算时按 day 盐确定性掷）与「就近探察」（开野地弹窗方圆二格）。
   *   ③ 探奇三段 Check/Spend/Roll（与江湖活动同一形状）：首次选择扣费并锁点位，
   *      结算入见闻录；点位一旦动身即断（无论成败）。
   * ============================================================ */
  GAME.wonderState = function () {
    var s = GAME.state;
    if (!s) return null;
    if (!s.wonders) s.wonders = {};
    s.wonders.r = s.wonders.r || {};     /* revealed：已现形（地图悬✦） */
    s.wonders.d = s.wonders.d || {};     /* done：已探（无论成败，缘止于此） */
    s.wonders.j = s.wonders.j || {};     /* journal：见闻录收录（按奇遇 id） */
    return s.wonders;
  };
  GAME.wonderTierName = function (t) {
    return ({ small: '逸闻', rare: '奇珍', epic: '绝景' })[t] || '奇遇';
  };
  GAME.wonderBandName = function (b) {
    return ({ near: '近郊', mid: '远野', far: '绝域' })[b] || '';
  };
  /* 点位生成：地图 seed 的确定性函数（缓存于 map，随 seed 重算） */
  GAME.wonderSites = function () {
    var s = GAME.state;
    if (!s || !s.map || !s.map.grid) return [];
    if (GAME.map._wonderSites && GAME.map._wonderSeed === s.map.seed) return GAME.map._wonderSites;
    var W = DATA.MAP_W, H = DATA.MAP_H, seed = (s.map.seed || 1) | 0;
    var wc = DATA.WONDER || {};
    var near = wc.bandNear || 25, far = wc.bandFar || 70;
    var pNear = wc.nearP || 0.0016, pMid = wc.midP || 0.0006, pFar = wc.farP || 0.00024;
    var sp0 = s.map.startPos || DATA.START_POS || { x: 250, y: 200 };
    var WILD = { caoyuan: 1, zhaoze: 1, lake: 1, forest: 1, desert: 1, hill: 1 };
    /* 三档候选 id 表（各取一次，供逐点指定） */
    var byTier = { small: [], rare: [], epic: [] };
    Object.keys(DATA.WONDERS || {}).forEach(function (id) {
      var t = (DATA.WONDERS[id] || {}).tier;
      if (byTier[t]) byTier[t].push(id);
    });
    /* 类型轮转表 = [逸闻×12 洗牌 ｜ 奇珍×8 ｜ 绝景×4]（前 24 位 = 全部类型，保底覆盖）
       + 「余篇」模式 [奇珍, 绝景, 奇珍, 逸闻] 循环（远离主城的多余点位以奇珍/绝景为主，
       保住「愈远愈奇」的手感）。
       ⚠️ v1 曾按「档内轮转」：当某档点位数 < 档内类型数（逸闻 12 类、实测点位数常 <12）
       必然漏类 —— seed 相关抖动，门禁实测 2/3 红。现改为**全池轮转 + 带序分配**：
       点位按带排序后逐位取表，点位总数 ≥ 24（实测 36~68）即保证全覆盖。 */
    var shuffle0 = function (arr) {
      var a2 = arr.slice();
      var rnd0 = U.rng((seed * 2654435761 ^ 0x77aa2b1) >>> 0);
      for (var k2 = a2.length - 1; k2 > 0; k2--) {
        var j2 = Math.floor(rnd0() * (k2 + 1));
        var tmp2 = a2[k2]; a2[k2] = a2[j2]; a2[j2] = tmp2;
      }
      return a2;
    };
    var sSmall = shuffle0(byTier.small), sRare = shuffle0(byTier.rare), sEpic = shuffle0(byTier.epic);
    var typesCycle = sSmall.concat(sRare).concat(sEpic);
    if (sSmall.length && sRare.length && sEpic.length) {
      for (var q0 = 0; q0 < 40; q0++) {
        typesCycle.push(sRare[q0 % sRare.length], sEpic[q0 % sEpic.length],
          sRare[(q0 + 3) % sRare.length], sSmall[q0 % sSmall.length]);
      }
    }
    var list = [], byKey = {};
    for (var y = 0; y < H; y++) {
      var row = s.map.grid[y];
      if (!row) continue;
      for (var x = 0; x < W; x++) {
        var tl = row[x];
        if (!tl || !WILD[tl.terrain]) continue;
        var dx = x - sp0.x, dy = y - sp0.y;
        var d2 = dx * dx + dy * dy;
        var band = d2 <= near * near ? 'near' : (d2 <= far * far ? 'mid' : 'far');
        var p = band === 'near' ? pNear : (band === 'mid' ? pMid : pFar);
        var h1 = U.rng((x * 73856093 ^ y * 19349663 ^ seed * 2654435761 ^ 0x5a17) >>> 0)();
        if (h1 >= p) continue;
        /* 据点上的点位要排除（据点每日重算，点位必须是"地里长出来"的稳定物）；
           密度筛过之后才查据点 —— 逐格查据点会把 174 城 × 25 万格算爆 */
        if (GAME.map.hasFort(x, y)) continue;
        var it = { x: x, y: y, wid: '', tier: 'small', band: band };
        list.push(it);
        byKey[x + ',' + y] = it;
      }
    }
    /* 带序分配：近郊在前、绝域在后 → 逐位取类型轮转表（tier 跟随类型：奖励/收录/带味一致） */
    var rank0 = { near: 0, mid: 1, far: 2 };
    var order = list.slice().sort(function (a, b) {
      return (rank0[a.band] - rank0[b.band]) || (a.y - b.y) || (a.x - b.x);
    });
    for (var oi = 0; oi < order.length; oi++) {
      var wid0 = typesCycle[oi % typesCycle.length];
      order[oi].wid = wid0;
      order[oi].tier = (DATA.WONDERS[wid0] || {}).tier || 'small';
    }
    GAME.map._wonderSites = list;
    GAME.map._wonderMap = byKey;
    GAME.map._wonderSeed = s.map.seed;
    return list;
  };
  /* 点位查询（未现形/已探状态合并返回；非点位 → null） */
  GAME.wonderSiteOf = function (x, y) {
    GAME.wonderSites();
    var it = (GAME.map._wonderMap || {})[x + ',' + y];
    if (!it) return null;
    var ws = GAME.wonderState();
    return { x: it.x, y: it.y, wid: it.wid, tier: it.tier, band: it.band,
      revealed: !!ws.r[x + ',' + y], done: !!ws.d[x + ',' + y] };
  };
  /* 就近探察：打开野地弹窗时，方圆二格（切比雪夫）内的未现形点位自动现形 —— 返回新现形数 */
  GAME.wonderSurvey = function (x, y) {
    var ws = GAME.wonderState();
    if (!ws) return 0;
    GAME.wonderSites();
    var m = GAME.map._wonderMap || {};
    var n = 0;
    for (var j = -2; j <= 2; j++) {
      for (var i = -2; i <= 2; i++) {
        var it = m[(x + i) + ',' + (y + j)];
        if (!it) continue;
        var k = it.x + ',' + it.y;
        if (ws.r[k] || ws.d[k]) continue;
        ws.r[k] = 1;
        n++;
      }
    }
    if (n) GAME.log('📜 探得异迹 ' + n + ' 处 —— 记于见闻，可于图中寻「✦」往探');
    return n;
  };
  /* 线索：走完一桩江湖事后有几率闻得尚未现形的点位（确定性 roll；无剩余点位则无） */
  GAME.wonderClueRoll = function (x, y, actId, day) {
    var ws = GAME.wonderState();
    var wc = DATA.WONDER || {};
    if (!ws) return null;
    var p = wc.clueP != null ? wc.clueP : 0.18;
    if (p <= 0) return null;
    if (GAME.invasionRoll('wclue|' + x + ',' + y + '|' + actId + '|' + day) >= p) return null;
    var list = GAME.wonderSites();
    var cand = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i].x + ',' + list[i].y;
      if (!ws.r[k] && !ws.d[k]) cand.push(list[i]);
    }
    if (!cand.length) return null;
    var h = GAME.invasionRoll('wcpick|' + x + ',' + y + '|' + actId + '|' + day);
    var pick = cand[Math.floor(h * cand.length) % cand.length];
    ws.r[pick.x + ',' + pick.y] = 1;
    return { x: pick.x, y: pick.y, band: pick.band, tier: pick.tier };
  };
  /* 线索文案：方向（八向、零三角函数）+ 远近（里数）+ 地带 */
  GAME.wonderClueText = function (site) {
    var home = GAME.currentCity() || (GAME.map.playerCity ? GAME.map.playerCity() : null) || { x: 250, y: 200 };
    var dx = site.x - home.x, dy = site.y - home.y;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    var ns = (dy < -adx * 0.5) ? '北' : ((dy > adx * 0.5) ? '南' : '');
    var ew = (dx > ady * 0.5) ? '东' : ((dx < -ady * 0.5) ? '西' : '');
    var dir = (ew + ns) || '近处';
    var dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 3);
    return '闻得城' + dir + '约 ' + dist + ' 里 ' + GAME.wonderBandName(site.band) +
      ' 之地（' + site.x + ',' + site.y + '），似有异象 —— 或可一探';
  };
  /* 线索挂到结算结果（三处 return 共用出口；线索是边角料，出错不拖累活动结算） */
  GAME._jhClueAttach = function (res, chk) {
    try {
      var site = GAME.wonderClueRoll(chk.x, chk.y, chk.actId, chk.day);
      if (site) {
        res.clue = '📜 ' + GAME.wonderClueText(site);
        GAME.log('📜 闻得异迹（' + site.x + ',' + site.y + '）—— 疑有奇物');
      }
    } catch (e) { /* 线索失败不影响活动结算 */ }
    return res;
  };
  /* --------- 探奇三段：Check / Spend / Roll（与江湖活动同一形状） --------- */
  GAME.wonderCheck = function (x, y, genId) {
    var s = GAME.state;
    var tile = GAME.map.tile(x, y);
    if (!tile) return { ok: false, msg: '坐标越界' };
    var site = GAME.wonderSiteOf(x, y);
    if (!site) return { ok: false, msg: '此地无奇可探' };
    if (site.done) return { ok: false, msg: '此地奇遇已探 —— 缘止于此' };
    if (!site.revealed) return { ok: false, msg: '此地尚无音信 —— 江湖之行或可闻得异迹' };
    var w = (DATA.WONDERS || {})[site.wid];
    if (!w) return { ok: false, msg: '奇物未载于册' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if (!GAME.canCultivate(gen)) return { ok: false, msg: '寻奇探幽乃君主亲历之事 —— 只有君主可前往' };
    var cost = (DATA.WONDER && DATA.WONDER.cost) || { energy: 6, stam: 2 };
    if ((gen.energy || 0) < cost.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + cost.energy + '），可服清心丸' };
    }
    if (GAME.staNow(gen) < cost.stam) {
      return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + cost.stam + '），休整后再来' };
    }
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var act = { id: 'wonder', name: w.name, icon: w.ic, kind: 'wonder', cat: '奇遇', alias: GAME.wonderTierName(site.tier),
      energy: cost.energy, stam: cost.stam, desc: w.txt || '', drop: 0 };
    return { ok: true, act: act, gen: gen, day: day, lv: GAME.map.wildLevelNow(x, y),
      x: x, y: y, actId: 'wonder', site: site, wid: site.wid };
  };
  GAME.wonderSpend = function (chk) {
    var a = chk.act, gen = chk.gen;
    gen.energy = Math.max(0, (gen.energy || 0) - a.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - a.stam);
    var ws = GAME.wonderState();
    ws.d[chk.x + ',' + chk.y] = 1;      /* 一旦动身，此缘即断（无论成败） */
    return { ok: true };
  };
  GAME.wonderRoll = function (chk, mods) {
    var s = GAME.state;
    var x = chk.x, y = chk.y;
    var tile = GAME.map.tile(x, y) || {};
    var w = (DATA.WONDERS || {})[chk.wid] || {};
    var tier = (chk.site && chk.site.tier) || 'small';
    var mo = mods || {};
    var mRw = mo.reward || 1;
    var mWo = mo.wound || 1;
    var seedBase = 'wd|' + x + ',' + y + '|' + chk.wid + '|' + chk.day;
    var roll = function (salt) { return GAME.invasionRoll(seedBase + '|' + salt); };
    var rnd = function (salt, lo, hi) {
      lo = Math.round(lo); hi = Math.round(hi);
      return lo + Math.floor(roll(salt) * (hi - lo + 1));
    };
    var mi = function (n) { return Math.max(1, Math.round(n * mRw)); };
    var rwAll = (DATA.WONDER && DATA.WONDER.rw) || {};
    var rw = rwAll[tier] || rwAll.small || {};
    var ws = GAME.wonderState();
    ws.j[chk.wid] = 1;                  /* 见闻录收录（按奇遇 id，重复不再计数） */
    var texts = [];
    var bad = false;
    s.items = s.items || {};
    if (rw.ess) {
      var ne = mi(rnd('ess', rw.ess[0], rw.ess[1]));
      s.items.lingsui = (s.items.lingsui || 0) + ne;
      texts.push('灵气精华 +' + ne);
    }
    var home = GAME.currentCity();
    if (rw.gold && home) {
      var ng = mi(rnd('gold', rw.gold[0], rw.gold[1]));
      GAME.res(home).gold = (GAME.res(home).gold || 0) + ng;
      texts.push('黄金 +' + ng);
    }
    if (rw.mats) {
      var tbl = DATA.WILD_MATERIAL[tile.terrain] || {};
      var keys = Object.keys(tbl);
      if (keys.length) {
        var nm = mi(rnd('matn', rw.mats[0], rw.mats[1]));
        var bag = {};
        for (var i = 0; i < nm; i++) {
          var mk = keys[Math.floor(roll('mk' + i) * keys.length) % keys.length];
          bag[mk] = (bag[mk] || 0) + 1 + Math.floor(roll('mq' + i) * 2);
        }
        for (var bk in bag) {
          s.items[bk] = (s.items[bk] || 0) + bag[bk];
          var mm = DATA.MATERIAL_BY_ID[bk];
          texts.push((mm ? mm.name : bk) + '×' + bag[bk]);
        }
      }
    }
    if (rw.jewel) {
      var jewels = (DATA.ITEMS || []).filter(function (x2) { return x2.type === 'jewel'; });
      for (var ji = 0; ji < rw.jewel; ji++) {
        var jl = jewels[Math.floor(roll('jl' + ji) * Math.min(4, jewels.length)) % Math.min(4, jewels.length)];
        if (jl) {
          s.items[jl.id] = (s.items[jl.id] || 0) + 1;
          texts.push(jl.name + '×1');
        }
      }
    }
    /* 贪进之险：选项带 wound 修正者，另折些体力（贪字头上一把刀） */
    if (mWo > 1) {
      var hurt = Math.round(6 * (mWo - 1));
      if (hurt > 0) {
        GAME.setStaNow(chk.gen, Math.max(0, GAME.staNow(chk.gen) - hurt));
        texts.push(chk.gen.name + ' 受了些伤，体力 −' + hurt);
        bad = true;
      }
    }
    texts.push('见闻录收录 · ' + GAME.wonderTierName(tier) + '「' + (w.name || '奇遇') + '」');
    GAME.log('✨ 奇遇 · ' + (w.name || '') + '（' + GAME.wonderTierName(tier) + '）：' + texts.join('、'));
    return { ok: true, name: '奇遇 · ' + (w.name || ''), text: texts.join('、'),
      bad: false, grade: 'win', wonder: true };
  };
  GAME.jianghuDone = function (s, x, y, actId, day) {
    return ((s.jianghu || {})[x + ',' + y + '|' + actId]) === day;
  };
  GAME.jianghuCheck = function (x, y, genId, actId) {
    var s = GAME.state;
    var tile = GAME.map.tile(x, y);
    if (!tile) return { ok: false, msg: '坐标越界' };
    var a = (DATA.LING_ACT || {})[actId];
    if (!a) return { ok: false, msg: '无此江湖活动' };
    if (!a.spots || a.spots.indexOf(tile.terrain) < 0) {
      return { ok: false, msg: ((DATA.TERRAIN[tile.terrain] || {}).name || '此地') + '做不了「' + a.name + '」' };
    }
    /* v89.4：逐地分布闸门 —— 此处野地今日并没有这桩事（随缘而现） */
    var avail4 = false;
    GAME.jianghuActsAt(x, y).forEach(function (k) { if (k.id === actId) avail4 = true; });
    if (!avail4) return { ok: false, msg: '此处野地无「' + a.name + '」—— 江湖之事随缘而现，换一处看看' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    /* v89：江湖游历君主专属（主角单修）—— 与装备/蕴养同一道闸门 */
    if (!GAME.canCultivate(gen)) return { ok: false, msg: '江湖游历乃君主亲历之事 —— 只有君主可前往' };
    if ((gen.energy || 0) < a.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + a.energy + '），可服清心丸' };
    }
    if (GAME.staNow(gen) < a.stam) {
      return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + a.stam + '），休整后再来' };
    }
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    if (GAME.jianghuDone(s, x, y, actId, day)) {
      return { ok: false, msg: '「' + a.name + '」此地今日已做过，明日再来' };
    }
    return { ok: true, act: a, gen: gen, day: day, lv: GAME.map.wildLevelNow(x, y), x: x, y: y, actId: actId };
  };
  /* v89：内核拆三段 —— Check（jianghuCheck）/ Spend（扣费+落锁）/ Roll（抽结果）。
     全屏剧本流程（GAME.scene*，见下）与 one-shot 入口（jianghuDo）共用同一份内核，
     保证「改了判定只改一处」。 */
  GAME.jianghuDo = function (x, y, genId, actId) {
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    GAME.jianghuSpend(chk);
    return GAME.jianghuRoll(chk);
  };
  GAME.jianghuSpend = function (chk) {
    var s = GAME.state;
    var a = chk.act, gen = chk.gen;
    gen.energy = Math.max(0, (gen.energy || 0) - a.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - a.stam);
    s.jianghu = s.jianghu || {};
    s.jianghu[chk.x + ',' + chk.y + '|' + chk.actId] = chk.day;
    return { ok: true };
  };
  GAME.jianghuRoll = function (chk, mods) {
    var s = GAME.state;
    var a = chk.act, gen = chk.gen, day = chk.day, lv = chk.lv;
    var x = chk.x, y = chk.y;
    var tile = GAME.map.tile(x, y);
    var seedBase = 'jh|' + x + ',' + y + '|' + chk.actId + '|' + day;
    var roll = function (salt) { return GAME.invasionRoll(seedBase + '|' + salt); };
    var rnd = function (salt, lo, hi) {
      lo = Math.round(lo); hi = Math.round(hi);
      return lo + Math.floor(roll(salt) * (hi - lo + 1));
    };
    /* v89：剧本修正系数 · v89.4：野地等级联动 —— 难度 / 负伤 / 收益随 lv 增长
       （系数全走 DATA.JH_SPREAD；种子与「同选择同结果」不变式不受影响。
         lv=0 时与 v88 逐位一致） */
    var sp4 = DATA.JH_SPREAD || {};
    var lvN = 1 + lv * (sp4.lvNeed || 0);
    var lvR = 1 + lv * (sp4.lvRew || 0);
    var lvW = 1 + lv * (sp4.lvDmg || 0);
    var mo = mods || {};
    var mPow = mo.pow || 1, mRw = mo.reward || 1, mWound = mo.wound || 1, mLuck = mo.luck || 0;
    var mi = function (n) { return Math.max(1, Math.round(n * mRw * lvR)); };
    var mw = function (n) { return Math.max(1, Math.round(n * mWound * lvW)); };
    /* 灵力（读修炼装备；与当前生效套无关） */
    var ling = GAME.lingPowerOf(gen);
    var texts = [];
    var bad = false;
    s.items = s.items || {};
    var ess = function (lo, hi, salt, tag) {
      var n = mi(rnd(salt || 'ess', lo, hi));
      s.items.lingsui = (s.items.lingsui || 0) + n;
      texts.push('灵气精华 +' + n + (tag ? '（' + tag + '）' : ''));
      return n;
    };
    /* 低概率装备掉落（阶随野地等级 0-10 -> 1-6 阶） */
    var tryDrop = function (salt) {
      if (roll(salt + '|hit') >= Math.min(0.95, a.drop * (1 + mLuck))) return;
      var q = Math.max(1, Math.min(6, 1 + Math.floor(lv / 2)));
      var slots = DATA.LING_SLOTS || [];
      if (!slots.length) return;
      var sl = slots[Math.floor(roll(salt + '|sl') * slots.length) % slots.length];
      var id = 'lg_' + sl.id + '_' + q;
      var it = DATA.EQUIP[id];
      if (!it) return;
      GAME.addEquip(id, 0);
      texts.push('拾得「' + it.name + '」（' + (DATA.LING_Q_NAME[q] || '') + '）');
    };
    var title = a.name;
    if (a.kind === 'fight') {
      /* 灵力判定：我方战力 =（灵力 + 等级 x2）x 种子波动；难度随野地等级 +35%/级 */
      var pow = (ling + (gen.level || 1) * 2) * (0.9 + roll('pow') * 0.2) * mPow;
      var need = a.power * lvN;
      if (pow >= need) {
        ess(a.win.ess[0], a.win.ess[1]);
        tryDrop('drop');
        title = '旗开得胜';
      } else {
        ess(a.lose.ess[0], a.lose.ess[1], 'essL', '聊胜于无');
        if (a.lose.wound) {
          var wdA = mw(a.lose.wound);
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - wdA));
          texts.push(gen.name + ' 负伤，体力 −' + wdA);
        }
        bad = true;
        title = '力战不敌';
      }
    } else if (a.kind === 'trial') {
      /* 三层试炼：逐层加码；失败止步（已过层奖励保留）——「见好就收」无损 */
      var layer = 0;
      for (var i = 1; i <= 3; i++) {
        var p2 = (ling + (gen.level || 1) * 2) * (0.9 + roll('t' + i) * 0.2) * mPow;
        var nd = a.power * lvN * (1 + (i - 1) * 0.45);
        if (p2 < nd) break;
        layer = i;
      }
      if (layer > 0) {
        var tot = 0;
        for (var j = 1; j <= layer; j++) tot += mi(rnd('te' + j, a.win.ess[0] / 3, a.win.ess[1] / 3));
        s.items.lingsui = (s.items.lingsui || 0) + tot;
        texts.push('灵气精华 +' + tot + '（过 ' + layer + ' 层）');
        if (layer >= 3) tryDrop('drop');
        title = (layer >= 3) ? '三层皆过' : ('止步第 ' + (layer + 1) + ' 层');
        bad = false;
      } else {
        ess(a.lose.ess[0], a.lose.ess[1], 'essL', '聊胜于无');
        if (a.lose.wound) {
          var wdB = mw(a.lose.wound);
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - wdB));
          texts.push(gen.name + ' 负伤，体力 −' + wdB);
        }
        bad = true;
        title = '第一层便受阻';
      }
    } else if (a.kind === 'gather') {
      ess(a.win.ess[0], a.win.ess[1]);
      if (roll('dbl') < 0.25 + mLuck) ess(a.win.ess[0], a.win.ess[1], 'ess2', '意外双收');
      title = '满载而归';
    } else if (a.kind === 'cultivate') {
      ess(a.win.ess[0], a.win.ess[1]);
      if (roll('wu') < 0.08 + mLuck) {
        ess(a.win.ess[0], a.win.ess[1], 'ess2', '悟道时刻');
        title = '悟道时刻';
      } else {
        title = '静修一日';
      }
    } else if (a.kind === 'visit') {
      var pool = (DATA.LING_VISITS || {})[tile.terrain] || [];
      var ev = pool.length ? pool[Math.floor(Math.min(0.999, roll('ev') + mLuck) * pool.length) % pool.length] : null;
      ess(a.win.ess[0], a.win.ess[1]);
      var body0 = texts.join('、');
      var name0 = ev ? ev.t : '拜访';
      GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + name0 + '（' + body0 + '）');
      return GAME._jhClueAttach({ ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false, grade: 'win' }, chk);
    } else if (a.kind === 'scene') {
      /* 地形专属（v87 -> v88.1 整合）：产出原样（金/粮/材料/珠宝/道具/豪杰）。
         扣费与锁已在上文统一完成 —— 这里只做「种子化抽结果 + 发奖」。 */
      var outs2 = a.outcomes || [];
      var tot2 = 0;
      for (var oi2 = 0; oi2 < outs2.length; oi2++) tot2 += outs2[oi2].w;
      /* v89：抽签（luck 修正：抽到「遗憾」结果时有一次重抽机会） */
      var pickScene = function (salt) {
        var rr2 = roll(salt) * tot2;
        var acc2 = 0, oo2 = outs2[outs2.length - 1];
        for (var oj2 = 0; oj2 < outs2.length; oj2++) {
          acc2 += outs2[oj2].w;
          if (rr2 < acc2) { oo2 = outs2[oj2]; break; }
        }
        return oo2;
      };
      var out2 = pickScene('scene_roll');
      if ((out2.wound || out2.none) && mLuck > 0 && roll('lr') < mLuck) out2 = pickScene('scene_roll2');
      var home2 = GAME.currentCity();
      var gift = function (id, n) {
        s.items[id] = (s.items[id] || 0) + n;
        var it0 = (DATA.ITEMS || []).filter(function (x2) { return x2.id === id; })[0];
        texts.push((it0 ? it0.name : id) + '×' + n);
      };
      if (out2.gold && home2) {
        var gn2 = mi(rnd('gold', out2.gold[0], out2.gold[1]));
        GAME.res(home2).gold = (GAME.res(home2).gold || 0) + gn2;
        texts.push('黄金 +' + gn2);
      }
      if (out2.grain && home2) {
        var gr2 = mi(rnd('grain', out2.grain[0], out2.grain[1]));
        GAME.res(home2).grain = (GAME.res(home2).grain || 0) + gr2;
        texts.push('粮食 +' + gr2);
      }
      if (out2.mats) {
        var tbl2 = DATA.WILD_MATERIAL[tile.terrain] || {};
        var keys2 = Object.keys(tbl2);
        if (keys2.length) {
          var n2 = mi(rnd('matn', out2.mats[0], out2.mats[1]));
          var bag2 = {};                        /* 同 id 合并，避免"兽筋×2、兽筋×2" */
          for (var mi2 = 0; mi2 < n2; mi2++) {
            var mk2 = keys2[Math.floor(roll('mk' + mi2) * keys2.length) % keys2.length];
            var mn2 = 1 + Math.floor(roll('mn' + mi2) * 2);
            bag2[mk2] = (bag2[mk2] || 0) + mn2;
          }
          for (var bk3 in bag2) {
            s.items[bk3] = (s.items[bk3] || 0) + bag2[bk3];
            var mm2 = DATA.MATERIAL_BY_ID[bk3];
            texts.push((mm2 ? mm2.name : bk3) + '×' + bag2[bk3]);
          }
        }
      }
      if (out2.jewel) {
        var jewels2 = (DATA.ITEMS || []).filter(function (x2) { return x2.type === 'jewel'; });
        var jn2 = (out2.jewel === 1) ? 1 : rnd('jn', out2.jewel.n[0], out2.jewel.n[1]);
        for (var ji2 = 0; ji2 < jn2; ji2++) {
          var jl2 = jewels2[Math.floor(roll('jl' + ji2) * Math.min(4, jewels2.length)) % Math.min(4, jewels2.length)];
          if (jl2) gift(jl2.id, 1);
        }
      }
      if (out2.item) gift(out2.item, 1);
      if (out2.hero) {
        var sn2 = DATA.NPC_GUARD_SURNAME || ['王'], gv2 = DATA.NPC_GUARD_GIVEN || ['虎'];
        var hname2 = null;
        for (var hi2 = 0; hi2 < 6 && !hname2; hi2++) {
          var cand2 = sn2[Math.floor(roll('hn' + hi2) * sn2.length) % sn2.length] +
            gv2[Math.floor(roll('hg' + hi2) * gv2.length) % gv2.length];
          var dup2 = (s.generals || []).some(function (gg2) { return gg2.name === cand2; });
          if (!dup2) hname2 = cand2;
        }
        if (hname2) {
          var base22 = 58 + Math.floor(roll('ht') * 20);
          var hh2 = { name: hname2, tong: base22, nz: base22, yw: base22, zm: base22 };
          var gg3 = GAME.makeHero(hh2, 30);
          gg3.loyalty = 60;
          if (home2) gg3.cityId = home2.id;
          s.generals.push(gg3);
          texts.push('「' + hname2 + '」慕名来投，愿效犬马之劳');
        } else {
          gift('zhenzhu', 1);       /* 重名兜底：换成一枚珍珠 */
          texts.push('（豪杰名讳与麾下相重，留下贺礼一份）');
        }
      }
      if (out2.wound) {
        var wdS = mw(out2.wound);
        GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - wdS));
        texts.push(gen.name + ' 负伤，体力 −' + wdS);
        bad = true;
      }
      if (!texts.length) { texts.push('此行无所获'); bad = true; }
      var line2 = a.icon + ' ' + a.name + '：' + out2.t + '（' + texts.join('、') + '）';
      GAME.log('🏕️ ' + ((DATA.TERRAIN[tile.terrain] || {}).name || '') + ' · ' + line2);
      return GAME._jhClueAttach({ ok: true, name: out2.t, text: texts.join('、'), bad: bad,
        grade: (out2.wound ? 'lose' : (out2.none ? 'partial' : 'win')) }, chk);
    }
    var body = texts.join('、');
    if (!body) { body = '此行无所获'; bad = true; }
    /* v89：结局分级（全屏剧本据此选专属退出结算屏） */
    var grade = bad ? 'lose' : 'win';
    if (a.kind === 'trial') grade = bad ? 'lose' : ((title === '三层皆过') ? 'win' : 'partial');
    if (a.kind === 'cultivate') grade = bad ? 'lose' : ((title === '悟道时刻') ? 'win' : 'partial');
    GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + title + '（' + body + '）');
    return GAME._jhClueAttach({ ok: true, name: a.name + ' · ' + title, text: body, bad: bad, grade: grade }, chk);
  };

  /* --------- v89 · 全屏江湖场景流程（老板：「专属全屏界面 + 特定退出」） --------- */
  GAME.sceneFx = null;
  /* 进入流程：只校验不扣费（「未动身离去免费」的根基）；无剧本 → fx:null 由调用方兜底 */
  /* v89.6：剧本开场内核抽成共用出口 —— 江湖活动与奇遇共用同一套场景机 */
  GAME.sceneBegin = function (chk, fly, extra) {
    GAME.sceneFx = {
      chk: chk, fly: fly, actId: chk.actId,
      stage: 0, picks: [],
      mods: { pow: 1, reward: 1, wound: 1, luck: 0 },
      spent: false, phase: 'stage', result: null, grade: null
    };
    if (extra) { for (var k6 in extra) GAME.sceneFx[k6] = extra[k6]; }
    return { ok: true, fx: GAME.sceneFx };
  };
  GAME.sceneStart = function (x, y, genId, actId) {
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    var fly = (DATA.SCENE_FLOW || {})[actId];
    if (!fly) return { ok: true, fx: null };
    return GAME.sceneBegin(chk, fly, null);
  };
  /* 探奇开场：奇遇剧本（kind:'wonder' —— 扣费/结算在 scenePick 里分流） */
  GAME.wonderStart = function (x, y, genId) {
    var chk = GAME.wonderCheck(x, y, genId);
    if (!chk.ok) return chk;
    var w = (DATA.WONDERS || {})[chk.wid] || {};
    var wc = DATA.WONDER || {};
    var fly = {
      art: w.ic || '✨', scene: w.scene || 'meadow',
      escLabel: '🍃 就此离去', backLabel: '收拢此行',
      exits: wc.exits || {},
      stages: w.stages || []
    };
    return GAME.sceneBegin(chk, fly, { kind: 'wonder', wid: chk.wid, tier: chk.site.tier });
  };
  /* 选一幕（首次选择才真正扣费+落锁）；末幕选择即结算 */
  GAME.scenePick = function (idx) {
    var fx = GAME.sceneFx;
    if (!fx || fx.phase !== 'stage') return { ok: false, msg: '流程已结束' };
    var st = fx.fly.stages[fx.stage];
    var op = (st && st.o) ? st.o[idx] : null;
    if (!op) return { ok: false, msg: '无此选项' };
    if (!fx.spent) { (fx.kind === 'wonder') ? GAME.wonderSpend(fx.chk) : GAME.jianghuSpend(fx.chk); fx.spent = true; }
    fx.picks.push({ l: op.l, d: op.d || '' });
    var e = op.e || {};
    if (e.pow) fx.mods.pow *= e.pow;
    if (e.reward) fx.mods.reward *= e.reward;
    if (e.wound) fx.mods.wound *= e.wound;
    if (e.luck) fx.mods.luck += e.luck;
    fx.stage += 1;
    var resolved = fx.stage >= fx.fly.stages.length;
    if (resolved) {
      fx.result = (fx.kind === 'wonder') ? GAME.wonderRoll(fx.chk, fx.mods) : GAME.jianghuRoll(fx.chk, fx.mods);
      fx.grade = fx.result.grade || (fx.result.bad ? 'lose' : 'win');
      fx.phase = 'result';
    }
    return { ok: true, resolved: resolved, fx: fx };
  };
  /* 中途退出：未动身 → 零消耗（锁都未落）；已动身 → 所耗不返、今日计入 */
  GAME.sceneEscape = function () {
    var fx = GAME.sceneFx;
    if (!fx || fx.phase !== 'stage') return { ok: false, msg: '流程已结束' };
    fx.phase = 'result';
    fx.grade = 'escape';
    fx.result = { ok: true, name: fx.fly.escLabel || '就此离去', text: '', bad: true, escaped: true, grade: 'escape' };
    return { ok: true, fx: fx };
  };
})();
