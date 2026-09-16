/* ============================================================
 * data.js  静态配置数据 —— 真实热血三国数值版（v2）
 * 数值来源：《热血三国数值系统检索报告》s20728.rxsg.ledu.com 实测+官方
 * 单位约定：产量/耗粮/俸禄 = 每小时；时间 = 游戏秒（受 TIME_SCALE 倍率影响）
 * 挂到 window.GAME.DATA
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
   * v54（老板）：**名城**的建筑等级上限更高
   *   县城 +2 · 郡城 +4 · 州城 +8 · 都城 +12
   * ------------------------------------------------------------
   * 自建城（self）不是名城，不加成（基准 12）。
   * 口径唯一：`GAME.buildCapOf(city, bid)` 是"一级建筑能盖到几级"的**唯一出口**
   * （升级守卫、自动建造、UI 的升级按钮都读它）。
   * ⚠️ 凡是**按等级取值的表**都必须能覆盖到 `MAX_LEVEL_ABS`，
   *   否则 24 级会取到 undefined → 产量/人口变成 NaN（这类表共五张，见下面各处注释）。
   * ============================================================ */
  DATA.CITY_BUILD_BONUS = { self: 0, county: 2, jun: 4, zhou: 8, capital: 12 };
  DATA.MAX_LEVEL_ABS = DATA.MAX_BLEVEL;
  (function () {
    for (var k in DATA.CITY_BUILD_BONUS) {
      var v = DATA.MAX_BLEVEL + DATA.CITY_BUILD_BONUS[k];
      if (v > DATA.MAX_LEVEL_ABS) DATA.MAX_LEVEL_ABS = v;
    }
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
        var r = prev[i] ? last[i] / prev[i] : 1.85;
        next.push(Math.max(1, Math.round(last[i] * r)));
      }
      out.push(next);
    }
    return out;
  }

  function costTable(arr) {
    /* [粮,木,石,铁,秒] 数组 -> 升到第 lv+1 级的费用。
       表长不足 MAX_LEVEL_ABS（= 基准 12 + 名城最高加成 12 = 24）时自动外推（见上）。
       v54：这里从 MAX_BLEVEL 改成 MAX_LEVEL_ABS —— 都城的官府/兵营要能盖到 24 级，
       表短了会走到 `if (!r) return null`，表现为"升级按钮忽然消失"。 */
    var rows = extRows(arr, DATA.MAX_LEVEL_ABS);
    return function (lv) {
      var r = rows[lv];
      if (!r) return null;
      var o = { grain: r[0], wood: r[1], stone: r[2], iron: r[3] };
      o.time = r[4];
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
      id: 'guanfu', series: 'gov', name: '官府', icon: '🏯', desc: '管理中心：每级 +1 附属野地上限、+3 城外空地。',
      buildCost: null, maxLevel: 12, prod: null, // 初始自带 Lv1
      levelCost: costTable(GUANFU),
      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」——
         原「城外空地」数值副本（12 + (lv-1)×3 的老口径）随显示撤除退役；
         真实机制唯一出口 = DATA.EXT_CAP_BY_LV + GAME.extCap。 */
    },
    minfang: {
      id: 'minfang', series: 'live', name: '民房', icon: '🏠', desc: '提供人口上限。',
      buildCost: { grain: 100, wood: 500, stone: 125, iron: 100 }, maxLevel: 12, prod: null,
      levelCost: costTable([[100,500,125,100,150],[210,1040,260,210,335],[425,2125,530,425,725],[870,4305,1080,865,1530],[1750,8615,2165,1740,3170],[3480,17010,4285,3455,6405],[6845,33175,8380,6775,12620],[13325,63860,16195,13140,24230],[25635,121335,30895,25175,45310],[48760,227500,58210,47655,82460]]),
      /* v28：11/12 级人口（沿用末段约 ×1.18、×1.2 的节奏）
         v54：再按同一节奏续到 24 —— 民房在都城能盖到 24，表短了人口上限就是 NaN。 */
      pop: growRatio([100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800],
        DATA.MAX_LEVEL_ABS),
    },
    shuyuan: {
      id: 'shuyuan', series: 'edu', name: '书院', icon: '📜', desc: '科技研究。等级决定可研究的科技上限（每城同时研究1项）。',
      buildCost: { grain: 120, wood: 2500, stone: 1500, iron: 200 }, maxLevel: 12, prod: null,
      levelCost: costTable([[120,2500,1500,200,960],[250,5190,3115,415,2130],[515,10635,6390,855,4625],[1045,21535,12960,1735,9805],[2100,43070,25970,3480,20295],[4175,85060,51420,6905,40995],[8215,165870,100575,13550,80760],[15990,319300,194315,26275,155065],[30765,606670,370750,50345,289970],[58515,1137510,698495,95305,527740]]),
    },
    junying: {
      id: 'junying', series: 'mil', name: '军营', icon: '⚔️', desc: '训练军队。等级决定可训练兵种。',
      buildCost: { grain: 800, wood: 1200, stone: 1500, iron: 1000 }, maxLevel: 12, prod: null,
      levelCost: costTable([[800,1200,1500,1000,600],[1660,2490,3115,2075,1330],[3420,5105,6390,4265,2890],[6950,10335,12960,8665,6130],[13985,20675,25970,17400,12685],[27835,40830,51420,34535,25625],[54780,79620,100575,67760,50475],[106600,153265,194315,131385,96915],[205100,291200,370750,251735,181230],[390100,546005,698495,476535,329840]]),
    },
    xiaochang: {
      id: 'xiaochang', series: 'mil', name: '校场', icon: '🏹', desc: '出征队列与人数上限：N级=N队、每队N×1万人口。',
      buildCost: { grain: 100, wood: 600, stone: 2000, iron: 150 }, maxLevel: 12, prod: null,
      levelCost: costTable([[100,600,2000,150,60],[210,1245,4150,310,135],[425,2550,8520,640,305],[870,5170,17280,1300,655],[1750,10335,34625,2610,1370],[3480,20415,68560,5180,2775],[6845,39810,134100,10165,5440],[13325,76630,259085,19710,10310],[25635,145600,494335,37760,18870],[48760,273000,931325,71480,33300]]),
    },
    shichang: {
      id: 'shichang', series: 'biz', name: '市场', icon: '🏪', desc: '交易。每级+1商队。',
      buildCost: { grain: 1000, wood: 1000, stone: 1000, iron: 1000 }, maxLevel: 12, prod: null,
      levelCost: costTable([[1000,1000,1000,1000,1500],[2080,2075,2075,2075,3330],[4270,4255,4260,4265,7225],[8690,8615,8640,8665,15320],[17485,17230,17315,17400,31710],[34795,34025,34280,34535,64055],[68475,66350,67050,67760,126190],[133250,127720,129540,131385,242285],[256375,242670,247165,251735,453075],[487625,455005,465660,476535,824595]]),
    },
    cangku: {
      id: 'cangku', series: 'store', name: '仓库', icon: '🏚️', desc: '保护资源不被掠夺。被占领攻破则保护失效。',
      buildCost: { grain: 100, wood: 1500, stone: 1000, iron: 500 }, maxLevel: 12, prod: null,
      levelCost: costTable([[100,1500,1000,500,1200],[210,3115,2075,1040,2665],[425,6380,4260,2135,5780],[870,12920,8640,4330,12255],[1750,25840,17315,8700,25370],[3480,51035,34280,17270,51245],[6845,99520,67050,33880,100955],[13325,191580,129540,65695,193830],[25635,364000,247165,125865,362460],[48760,682505,465660,238265,659680]]),
      /* v54：仓库保护上限同人口表一个节奏，续到 24 级 */
      cap: growRatio([10000, 30000, 60000, 100000, 150000, 210000, 280000, 360000, 450000, 550000, 660000, 780000],
        DATA.MAX_LEVEL_ABS),
    },
    chengqiang: {
      id: 'chengqiang', series: 'mil', name: '城墙', icon: '🧱', desc: '耐久=100×N万，守军防御+10N%，远程射程+3N%。',
      buildCost: { grain: 3000, wood: 2000, stone: 10000, iron: 2000 }, maxLevel: 12, prod: null,
      levelCost: costTable([[3000,2000,10000,2000,0],[5000,5000,20000,5000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0],[10000,10000,50000,10000,0]]),
    },
    yizhan: {
      id: 'yizhan', series: 'road', name: '驿站', icon: '🏇', desc: '己方/联盟城池间行军提速（1.5倍起步）。',
      buildCost: { grain: 1500, wood: 5000, stone: 4500, iron: 500 }, maxLevel: 12, prod: null,
      levelCost: costTable([[1500,5000,4500,500,3600],[3000,10000,9000,1000,7990],[6000,20000,18000,2000,17345],[12000,40000,36000,4000,36765],[24000,80000,72000,8000,76105],[48000,160000,144000,16000,153735],[96000,320000,288000,32000,302860],[192000,640000,576000,64000,581485],[384000,1280000,1152000,128000,1087380],[768000,2560000,2304000,256000,1979035]]),
      /* v54：驿站速度是等差（每级 +0.5），续到 24 级 */
      speed: growStep([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7], DATA.MAX_LEVEL_ABS, 0.5),
    },
    fenghuotai: {
      id: 'fenghuotai', series: 'mil', name: '烽火台', icon: '🔥', desc: '侦察：8级看兵力、9级看将领、10级看科技；10级+27×27范围内行军+50%。',
      buildCost: { grain: 150, wood: 1500, stone: 500, iron: 1500 }, maxLevel: 12, prod: null,
      levelCost: costTable([[150,1500,500,1500,1080],[300,3000,1000,3000,2400],[600,6000,2000,6000,5205],[1200,12000,4000,12000,11030],[2400,24000,8000,24000,22830],[4800,48000,16000,48000,46120],[9600,96000,32000,96000,90855],[19200,192000,64000,192000,174445],[38400,384000,128000,384000,326215],[76800,768000,256000,768000,593710]]),
    },
    majiu: {
      id: 'majiu', series: 'store', name: '马厩', icon: '🐎', desc: '养马与坐骑培育，骑兵与坐骑必备。',
      buildCost: { wood: 2000, stone: 800, iron: 1000, grain: 1200 }, maxLevel: 12, prod: null,
      levelCost: costTable([[2000,800,1000,1200,540],[4000,1600,2000,2400,1200],[8000,3200,4000,4800,2600],[16000,6400,8000,9600,5515],[32000,12800,16000,19200,11415],[64000,25600,32000,38400,23060],[128000,51200,64000,76800,45430],[256000,102400,128000,153600,87225],[512000,204800,256000,307200,163105],[1024000,409600,512000,614400,296855]]),
    },
    kezhan: {
      id: 'kezhan', series: 'live', name: '客栈', icon: '🍶', desc: '招募将领（每级+1停留将领），市井传闻查名将坐标。',
      buildCost: { grain: 300, wood: 2000, stone: 1000, iron: 400 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([300,2000,1000,400,480], [146285,910005,465660,190615,263870], 10)),
    },
    zhaoxianguan: {
      id: 'zhaoxianguan', series: 'edu', name: '招贤馆', icon: '🎎', desc: '将领居所（每级+1房间），无空房不可招新。',
      buildCost: { grain: 400, wood: 2500, stone: 1200, iron: 700 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([400,2500,1200,700,720], [195050,1137510,558795,333575,395805], 10)),
    },
    honglusi: {
      id: 'honglusi', series: 'gov', name: '鸿胪寺', icon: '🏛️', desc: '联盟：1级入盟/2级建盟。',
      buildCost: { grain: 250, wood: 2000, stone: 500, iron: 300 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([250,2000,500,300,1440], [121905,910005,232830,142960,791615], 10)),
    },
    tiejiangpu: {
      id: 'tiejiangpu', series: 'biz', name: '铁匠铺', icon: '⚒️', desc: '打造武器与装备强化。',
      buildCost: { grain: 350, wood: 1000, stone: 600, iron: 1200 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([350,1000,600,1200,360], [170670,455005,279395,571840,197905], 10)),
    },
    gongjiangzuofang: {
      id: 'gongjiangzuofang', series: 'biz', name: '工匠作坊', icon: '🛠️', desc: '制造攻守城器械。',
      buildCost: { grain: 450, wood: 1500, stone: 500, iron: 1500 }, maxLevel: 12, prod: null,
      levelCost: costTable(lerpCost([450,1500,500,1500,1080], [219430,682505,232830,714800,593710], 10)),
    },
  };

  /* v16：城墙不占格（环绕城池一圈，等级存 city.wallLv），故不在城内建造列表中 */
  DATA.BUILD_ORDER = ['minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'];

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
    yizhan:           { shichang: 2 },   // 驿传通商：先有市场（商队）才有驿路
    honglusi:         { kezhan: 3 },     // 鸿胪寺主迎来送往，客栈 Lv3 才撑得起场面
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
  DATA.CITY_PLAN = {
    /* [列, 行] —— **唯一来源**：改这里就是改全图所有系统城的棋盘尺寸。
       原先的 `sizeByLevel` 档位表已删（v65）：所有档位填同一个值就是死数据。 */
    size: [8, 6],
    /* 城等级的满级（系统城的库藏/守军派生都按它做上限） */
    maxLevel: 10,
    /* 落位优先级：军营成对排最前（要紧挨官府），其余 12 种各 1 座，余格民房 */
    /* v70（老板）：「城内所有建筑 1 个，但是军营 2 个，**仓库 4 个**，其他以民居填充」——
       仓库 1 → 4（分仓：营建与养兵都吃存量，仓容是经营主线），四座挨着排、成"仓廪区"。
       民房数随之 30 → 27（人口上限按民房座数派生，见 `GAME.planPopCapOf`，自动跟着走）。 */
    order: ['junying', 'junying', 'shuyuan', 'xiaochang', 'shichang',
      'cangku', 'cangku', 'cangku', 'cangku',
      'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'],
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

  /* ============================================================
   * 缺粮哗变（v65 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「缺粮 24h 后军队才会哗变，各兵种每 24h 逃离当前剩余数量的 20%」
   *
   * 改前是"粮一断就按缺口比例逃兵"（最多 15%/tick）—— 断粮立刻掉兵，
   * 玩家来不及救；而且逃多少取决于"缺口占需求的比例"，是个说不清的公式。
   * 改后是一条能背下来的规则：**先饿满 24 游戏小时**，之后每满 24 小时逃 20%。
   *   累计计时挂在该城（`city.starveHours`），粮一旦接上就**清零重计**。
   * ============================================================ */
  DATA.STARVE = {
    hours: 24,          // 缺粮多少游戏小时开始哗变
    mutinyPct: 0.2,     // 每次哗变各兵种逃离当前数量的比例
  };

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
   *   · 粮是养兵主线（见 AI工作备忘 §十五 阶梯复算：缺口卡在粮上）→ 农田恒占 1/3 上下；
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
   * 兵种（18种 · 报告8.1/8.2/8.3：hp/atk/def/射程/速度/负重/耗粮h/人口/训练秒）
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
  DATA.TROOPS = {
    minfu:   { id: 'minfu', cat: 'inf', name: '民夫', icon: '🪓', hp: 100,  atk: 5,   def: 10, range: 10,   spd: 180,  gather: 2, load: 200,  food: 2,   pop: 1, time: 40,   cost: { grain: 50, wood: 150, iron: 10 }, unlock: { junying: 1 }, desc: '基础民夫，战力孱弱，可运输' },
    yibing:  { id: 'yibing', cat: 'inf', name: '义兵', icon: '🗡️', hp: 200, atk: 50,  def: 50, range: 20,  spd: 200,  gather: 3, load: 20,   food: 3,   pop: 1, time: 20,   cost: { grain: 80, wood: 100, iron: 50 }, unlock: { junying: 1 }, desc: '聚集的义军，初具战力' },
    chihou:  { id: 'chihou', cat: 'inf', name: '斥候', icon: '🦅', hp: 100,  atk: 20,  def: 20, range: 20,  spd: 3000, gather: 1, load: 6,    food: 5,   pop: 1, nocombat: true, time: 90,   cost: { grain: 120, wood: 200, iron: 150 }, unlock: { junying: 2, shuyuan: 2 }, desc: '极限速度，侦察/截援必备' },
    changqiang: { id: 'changqiang', cat: 'inf', name: '长枪兵', icon: '🔱', hp: 300, atk: 150, def: 150, range: 50, spd: 300, gather: 4, load: 40, food: 6, pop: 1, time: 140, cost: { grain: 150, wood: 500, iron: 100 }, unlock: { junying: 2, shuyuan: 2 }, desc: '克制骑兵，阵型严整' },
    daodun:  { id: 'daodun', cat: 'inf', name: '刀盾兵', icon: '🛡️', hp: 400, atk: 130, def: 250, range: 30, spd: 275, gather: 4, load: 30, food: 7, pop: 1, time: 210, cost: { grain: 200, wood: 150, iron: 400 }, unlock: { junying: 3, shuyuan: 3 }, desc: '高防御，克远程，炮灰首选' },
    gongjian: { id: 'gongjian', cat: 'inf', name: '弓箭手', icon: '🏹', hp: 320, atk: 220, def: 50, range: 1200, spd: 250, gather: 5, load: 25, food: 9, pop: 2, time: 340, cost: { grain: 300, wood: 350, iron: 300 }, unlock: { junying: 4, shuyuan: 4 }, desc: '远程主力，射程1200' },
    qingji:  { id: 'qingji', cat: 'cav', name: '轻骑兵', icon: '🐎', hp: 620, atk: 340, def: 180, range: 80, spd: 1000, gather: 6, load: 100, food: 18, pop: 2, time: 480, cost: { grain: 1000, wood: 600, iron: 500 }, unlock: { junying: 5, majiu: 1 }, desc: '机动突袭，抓将主力（需马厩）' },
    tieji:   { id: 'tieji', cat: 'cav', name: '铁骑兵', icon: '🐴', hp: 1200, atk: 520, def: 350, range: 70, spd: 600, gather: 9, load: 80, food: 35, pop: 3, time: 1450, cost: { grain: 2000, wood: 500, iron: 2500 }, unlock: { junying: 7, shuyuan: 6, majiu: 3 }, desc: '重装铁骑，攻守兼备（需马厩3）' },
    zhouche: { id: 'zhouche', cat: 'cav', name: '辎重车', icon: '🛺', hp: 700, atk: 10, def: 60, range: 10, spd: 150, gather: 1, load: 5000, food: 10, pop: 4, time: 970, cost: { grain: 600, wood: 1500, iron: 350 }, unlock: { junying: 5 }, desc: '负重5000，专属运资' },
    chuangnu: { id: 'chuangnu', name: '床弩', icon: '🏹', hp: 900, atk: 500, def: 160, range: 1400, spd: 120, gather: 2, load: 35, food: 50, pop: 3, time: 2910, cost: { grain: 2500, wood: 3000, iron: 1800 }, craft: true, unlock: { junying: 8, shuyuan: 8, gongjiangzuofang: 3 }, desc: '强力远程，攻城利器（工匠作坊制造）' },
    chongche: { id: 'chongche', name: '冲车', icon: '🚩', hp: 6000, atk: 620, def: 600, range: 50, spd: 160, gather: 2, load: 45, food: 100, pop: 5, time: 4370, cost: { grain: 4000, wood: 6000, iron: 1500 }, craft: true, unlock: { junying: 9, shuyuan: 8, gongjiangzuofang: 5 }, desc: '血5000防600，城墙杀手（工匠作坊制造）' },
    toudan:  { id: 'toudan', name: '投石车', icon: '🪨', hp: 1100, atk: 950, def: 200, range: 1600, spd: 100, gather: 2, load: 75, food: 250, pop: 4, time: 5830, cost: { grain: 5000, wood: 5000, stone: 8000, iron: 1200 }, craft: true, unlock: { junying: 10, shuyuan: 10, gongjiangzuofang: 7 }, desc: '攻800射程1600，攻城巨炮（工匠作坊制造）' },
    /* 特殊兵种（需对应州城 + 科技） */
    qingzhoubing: { id: 'qingzhoubing', cat: 'inf', name: '青州兵', icon: '🥷', hp: 620, atk: 350, def: 200, range: 60, spd: 350, gather: 6, load: 50, food: 10, pop: 2, time: 115, cost: { grain: 800, wood: 600, iron: 400 }, unlock: { junying: 8, shuyuan: 6, city: 'qingzhou', tech: { xingjun: 5 } }, desc: '青州精兵' },
    tengjiabing: { id: 'tengjiabing', cat: 'inf', name: '藤甲兵', icon: '🛡️', hp: 600, atk: 340, def: 350, range: 60, spd: 300, gather: 5, load: 35, food: 10, pop: 2, time: 170, cost: { grain: 600, wood: 300, iron: 500 }, unlock: { junying: 8, shuyuan: 7, city: 'yizhou', tech: { fanghu: 8 } }, desc: '防350，刀枪不入（惧火）' },
    tuqibing: { id: 'tuqibing', cat: 'cav', name: '突骑兵', icon: '🏇', hp: 640, atk: 330, def: 150, range: 1000, spd: 450, gather: 7, load: 45, food: 15, pop: 2, time: 270, cost: { grain: 1200, wood: 500, iron: 800 }, unlock: { junying: 9, shuyuan: 7, majiu: 3, city: 'hebei', tech: { paoshe: 5, jiayu: 5 } }, desc: '骑射突袭，射程1000' },
    hubaoqi: { id: 'hubaoqi', cat: 'cav', name: '虎豹骑', icon: '🐯', hp: 800, atk: 510, def: 250, range: 70, spd: 850, gather: 10, load: 60, food: 50, pop: 3, time: 385, cost: { grain: 1500, wood: 800, iron: 1200 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'sili', tech: { tongshuai: 9, lianbing: 7 } }, desc: '曹魏精锐骑兵' },
    xiliangtieqi: { id: 'xiliangtieqi', cat: 'cav', name: '西凉铁骑', icon: '🐻', hp: 1400, atk: 700, def: 400, range: 80, spd: 750, gather: 10, load: 100, food: 50, pop: 4, time: 1160, cost: { grain: 1800, wood: 700, iron: 2000 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'liangzhou', tech: { jiayu: 7 } }, desc: '攻450防400，攻守兼备' },
    nanjiangxiangbing: { id: 'nanjiangxiangbing', cat: 'cav', name: '南疆象兵', icon: '🐘', hp: 3000, atk: 880, def: 400, range: 70, spd: 400, gather: 12, load: 60, food: 50, pop: 5, time: 3500, cost: { grain: 3000, wood: 1000, iron: 2500 }, unlock: { junying: 9, shuyuan: 8, city: 'yizhou', tech: { yiliao: 8, zhandou: 7 } }, desc: '血2500，战场重坦' },
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
    /* 枪克骑：长枪对骑兵 ×200%（原版写"骑兵（轻/铁）"；
       突骑/虎豹骑/西凉铁骑是我们自扩展的同族兵种，一并算骑兵——
       否则同族里只有轻/铁被克，另三种变成"无弱点的骑兵"，关系会断裂） */
    changqiang: { qingji: 2, tieji: 2, tuqibing: 2, hubaoqi: 2, xiliangtieqi: 2 },
    /* 床弩打器械 ×300%（原版点名：冲车 / 辎重 / 投石 / 床弩） */
    chuangnu: { chongche: 3, zhouche: 3, toudan: 3, chuangnu: 3 },
  };
  DATA.COUNTER_DEF = {
    /* 刀盾防远程 ×300%（"盾牌挡箭"这一常识的结构化） */
    daodun: { gongjian: 3, chuangnu: 3, toudan: 3 },
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
    name: '箭塔', hp: 2000, atk: 300, def: 360, range: 1250,
    wallOffset: 100,   // 墙位移：城防件射程的固定部分（原版式里的 "+100"）
    perDef: 0.5,       // 每 2 点城防值 = 1 座箭塔（映射系数，非原版）
    /* 量纲换算：把"攻城方的伤害点数"换成"打掉几座箭塔"。原版伤害量纲比本作大
       两个数量级（原版单次杀伤百万级，本作几百），直接除以 2000 生命会一回合拆光全城。
       它只影响"拆箭塔要几回合"，**不影响箭塔火力本身** —— 实测标定值，非原版数据。
       标定过程：投石 4000 打城防 200（100 座）——tough=200 时一回合拆 58 座（2 回合拆完）；
       改 1200 后约 8~10 座/回合（原版是"十几回合清完城防"的量级）。 */
    tough: 1200,
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
  DATA.EQUIP_QUALITY = ['灰', '白', '蓝', '紫', '橙', '红'];

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
    /* 经验/丹药 */
    { id: 'lianbing_jingyan', name: '练兵经验', type: 'exp', amount: 3000, price: 10, desc: '将领经验+3000' },
    { id: 'bingfa_xinde', name: '兵法心得', type: 'exp', amount: 30000, price: 60, desc: '将领经验+30000' },
    { id: 'zhijun_zhidao', name: '治军之道', type: 'exp', amount: 300000, price: 300, desc: '将领经验+300000' },
    { id: 'zhixuesan', name: '止血散', type: 'stamina', amount: 0.1, price: 5, desc: '恢复将领体力10%' },
    { id: 'jiuzhuangyao', name: '金疮药', type: 'stamina', amount: 0.3, price: 15, desc: '恢复将领体力30%' },
    { id: 'dahuandan', name: '大还丹', type: 'stamina', amount: 0.6, price: 30, desc: '恢复将领体力60%' },
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
    /* v78（老板需求 1）：**种子** —— 种田秘境专用，**不花金币**，
       只能从将领活动获得（采集归来 / 出征缴获；见 DATA.SEED_DROP 与 GAME.grantSeedDrop）。
       凡植种子对应 6 种材料作物；四种灵种一一对应四档灵草。 */
    { id: 'seed_fan',      name: '凡植种子', type: 'seed', price: 30,   desc: '寻常灵植之种：于种田秘境可种 6 种材料作物（来源：采集归来 / 出征缴获）' },
    { id: 'seed_yunling',  name: '蕴灵种子', type: 'seed', price: 150,  desc: '蕴灵草之种：种成可助 凡品 将领洗出 良材 之资（来源：采集归来 / 出征缴获）' },
    { id: 'seed_xisui',    name: '洗髓种子', type: 'seed', price: 450,  desc: '洗髓芝之种：种成可助 良材 将领跃入 英杰 之列（来源：中高级野地 / 名城缴获）' },
    { id: 'seed_hualong',  name: '化龙种子', type: 'seed', price: 1200, desc: '化龙参之种：种成可助 英杰 将领跻身 名世（来源：高级野地 / 名城缴获）' },
    { id: 'seed_tianshou', name: '天授种子', type: 'seed', price: 3600, desc: '天授果之种：种成可助 名世 将领问鼎 天授（来源：顶级野地 / 州城·帝都缴获）' },
    /* 坐骑 */
    { id: 'mabian', name: '马鞭', type: 'mount_buff', amount: 2, price: 20, desc: '将领速度+2（1h，需蓝坐骑）' },
    { id: 'hanxue_mabian', name: '汗血马鞭', type: 'mount_buff', amount: 5, price: 80, desc: '将领速度+5（1h，需紫坐骑）' },
    /* ============================================================
     * v77 新货（老板「丰富商场道具（符合时代背景和游戏背景），包括不限于……」）
     * ============================================================ */
    /* 宝箱：开启随机获得资源 / 黄金 / 珠宝 / 材料 / 图纸（见 S._openChest） */
    { id: 'chest_tong', name: '青铜宝箱', type: 'chest', tier: 1, price: 25, desc: '开启随机获得：资源 / 黄金 / 珠宝 / 一阶材料' },
    { id: 'chest_yin', name: '白银宝箱', type: 'chest', tier: 2, price: 70, desc: '开启随机获得：丰厚资源 / 黄金 / 二阶材料（小概率图纸）' },
    { id: 'chest_jin', name: '鎏金宝箱', type: 'chest', tier: 3, price: 180, desc: '开启随机获得：高阶材料 / 图纸 / 珠宝（小概率徭役令）' },
    /* 内功秘籍：修习后随重数提供属性特性（每将一门，见 DATA.NEIGONG） */
    { id: 'book_sunzi', name: '《孙子兵法》', type: 'neigong', teach: 'sunzi', price: 80, desc: '修习内功「庙算」：智谋随重数增长（最高 10 重）' },
    { id: 'book_liutao', name: '《太公六韬》', type: 'neigong', teach: 'liutao', price: 80, desc: '修习内功「将略」：统率随重数增长（最高 10 重）' },
    { id: 'book_wuqin', name: '《五禽戏》', type: 'neigong', teach: 'wuqin', price: 80, desc: '修习内功「养生」：内政随重数增长（最高 10 重）' },
    { id: 'book_yuenv', name: '《越女剑经》', type: 'neigong', teach: 'yuenv', price: 80, desc: '修习内功「剑心」：勇武随重数增长（最高 10 重）' },
    /* 徭役令：征发徭役，短时扩充营造队列（与官府专精/名城 perk 叠加） */
    { id: 'corvee', name: '徭役令', type: 'corvee', dur: 24, add: 3, price: 120, desc: '24 小时内同时建造队列 +3' },
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
    };
  });

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
     旧表 DATA.WILD_ADD（按等级查表）已废弃，保留空表以免旧引用报错。 */
  DATA.WILD_ADD = [];

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
  DATA.INVASION = {
    enabled: true,
    unlockCities: 2,          // 玩家达到几座城才开始有人来打（别一开局就挨打）
    baseDays: 4,              // 基础间隔（游戏日）
    minDays: 2,               // 间隔下限（城越多越紧）
    tightenPerCity: 0.12,     // 每多一座城，间隔缩短 12%
    warnHours: 12,            // 基础预警提前量（游戏小时）
    beaconBonusHours: 12,     // 每级烽火台额外提前（小时）
    warnBeaconMax: 3,         // 烽火台记级上限（超过按此算）
    ratioMin: 0.28,           // 来袭战力 ÷ 玩家全境战力 —— 下界
    ratioMax: 0.45,           // 上界（<0.5 保证"兵收拢就守得住"是可达的）
    defDivisor: 480,          // 城防换算守备力乘区的除数：城防 240 → +50%
    loseCity: false,          // ⛔ 体验红线：输了不丢城
    loss: { resPct: 0.15, troopPct: 0.10, wallDrop: 1, repDrop: 5 },
    sources: ['流寇', '郡国游兵', '坞堡私兵'],
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
    levelOptions: [1, 2, 3, 4, 5, 6],
    targetOptions: [['wild', '野地'], ['fort', '野外城池'], ['city', '名城']],
    searchRadius: 14,        // 以当前城池为中心搜索目标的半径（格）
    defaultFreqMin: 5,
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
   *   · 等级 1~8 每日变化（按现实日做盐），守军随之不同
   *   · 掉落：一阶材料 + 资源 + 珠宝，偶有军械
   * ------------------------------------------------------------ */
  DATA.FORT = {
    density: 1 / 12,
    levelMin: 1, levelMax: 8,
    safeRadius: 3,          // 出生点与名城周围不生成
    nameA: ['青石', '黑风', '白狼', '铁门', '落雁', '断魂', '野狐', '黄沙', '苍岩',
      '卧牛', '伏虎', '盘龙', '孤鹰', '寒水', '乱石', '望云', '赤松', '枯木'],
    nameB: ['营', '寨', '坞', '堡', '关', '屯'],
    garrisonBase: 50,
    garrisonGrowth: 1.95,
  };

  /* 生成 109 座名城（洛阳+12州城+96郡城） */
  DATA.NPC_CITIES = [];
  (function () {
    var id = 0;
    DATA.NPC_CITIES.push({ id: 'cap', name: '洛阳', x: 265, y: 215, type: 'capital', state: '司隶', level: 10, def: 110, rep: 400 });
    ZHOU.forEach(function (z) {
      id++;
      DATA.NPC_CITIES.push({ id: 'zhou_' + id, name: z.city, x: z.x, y: z.y, type: 'zhou', state: z.name, level: 9, def: 90, rep: 300, special: true });
      z.jun.forEach(function (j) {
        id++;
        DATA.NPC_CITIES.push({ id: 'jun_' + id, name: j[0], x: j[1], y: j[2], type: 'jun', state: z.name, level: 7, def: 60, rep: 120 });
      });
    });
    /* 司隶 5 郡（都城洛阳所在州，无州城） */
    [['弘农',225,225],['槐里',165,225],['高陵',185,205],['安邑',235,175],['怀县',295,195]].forEach(function (j) {
      id++;
      DATA.NPC_CITIES.push({ id: 'jun_' + id, name: j[0], x: j[1], y: j[2], type: 'jun', state: '司隶', level: 7, def: 60, rep: 120 });
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
            type: 'county', state: z.name, level: 5, def: 40, rep: 60 });
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
  DATA.GENERAL_NAMES = ['赵子龙', '关云长', '张翼德', '马孟起', '黄汉升', '太史慈', '夏侯惇', '徐晃', '甘宁', '张郃', '魏延', '庞德', '文丑', '颜良', '华雄', '李典', '乐进', '曹仁', '程普', '黄盖'];
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
  /* v82（老板）：「君主初始资质为最差，需要逐步升级」——
     开局给**凡品**（最低档，等级上限 60）：靠种田秘境的资质灵草逐档提升
     （凡→良→英→名→天，走 GAME.rankUpUse 唯一出口；灵草升档另有隐藏加成）。 */
  DATA.LORD_GEN = { rankId: 'fan', styleId: 'balance', level: 1 };
  DATA.LORD_TRAITS = [
    { id: 'undismissable', icon: '👑', name: '帐下不离',
      desc: '君主本人 —— 不可解雇，也不会因忠诚低下离去' },
  ];

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
       客栈 1 级时的占比因此变成：
         天授 0.026% / 名世 0.10% / 英杰 0.32% / 良材 34.9% / 凡品 64.6%
       与「名将直取 0.30 → 0.03」（domain.js makeCandidate）是一套组合拳：
       高资质将领从此以**种田秘境灵草养成**为主路（见 DATA.FARM）。
       ⚠️ 光改 `w` 是**无效的** —— `GAME.rankWeights` 里原有一道 `Math.max(0.5, …)`
       下限，会把 0.2 直接抬回 0.5（降幅只剩 2.5 倍）。v66 把下限改成**按自身基准的 5%**
       （见 state.js），既拦住负权重、又不吃掉这两轮下调。 */
    { id: 'ying', name: '英杰', color: '#4a9be0', star: 3, w: 0.25, wg: 0.09, base: [64, 84], grow: 3, price: 3.2, lvCap: 140, ascend: 3,
      desc: '一方之良将，千军易得一将难求。等级上限 140。' },
    { id: 'ming', name: '名世', color: '#b06fd8', star: 4, w: 0.075, wg: 0.17, base: [86, 106], grow: 5, price: 7.0, lvCap: 180, ascend: 5,
      desc: '当世罕有，可镇一方。等级上限 180。' },
    { id: 'tian', name: '天授', color: '#e0a83c', star: 5, w: 0.02, wg: 0.28, base: [108, 140], grow: 8, price: 16.0, lvCap: 240, ascend: 8,
      desc: '天授之资，百年一出。等级上限 240。' },
  ];

  /* ============================================================
   * 经验曲线（v29 · 需求 2）
   * ------------------------------------------------------------
   * 原版口径「等级²×100」在低段很贴切，但到高段会失控：
   *   Lv100 单级 100 万 · Lv240 单级 576 万 · **累计 4.6 亿**
   * 而全游戏最大的一份经验道具是「治军之道」30 万 —— 也就是说
   * 即便把 240 级的上限写出来，玩家一辈子也到不了，又变成"看着有、其实没生效"。
   * 所以从 Lv30 起改为**线性放缓**：每级需求 = Lv30 的需求 ×(1+等级×grow)，
   * Lv240 单级 20.3 万，累计约 3180 万（约 106 份治军之道），是长线可达的目标。
   * Lv ≤ 30 与旧公式**逐点一致**，老存档的经验进度不受影响。
   * ============================================================ */
  DATA.EXP_CURVE = { softFrom: 30, grow: 0.006 };

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
    staPerHour: 3,         // 每游戏小时恢复体力
    enePerHour: 2,         // 每游戏小时恢复精力
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
    desc: '君主驻跸：本城产量 +15%、税收 +10%、仓储 +30%、将领席位 +1、附属野地上限 +1',
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
  DATA.NPC_CITY_RES = {
    base: { grain: 9000, wood: 7000, stone: 6000, iron: 4500, gold: 3000 },
    grow: 1.55,
    /* v63（老板）：「其兵力可设定为野外城的10倍数，在被占领前其兵力不消耗粮草」。
       口径：名城守军**总数** = 同等级野外城池守军 × 此倍数（`GAME.map.fortGarrison`），
       兵种构成仍按名城自己的规矩（等级越高越有铁骑与攻城器械，见下 garrisonMix）。
       ⚠️ 未占据城池的守军是**派生值**（不入存档，见 `GAME.buildNpcCities`），
       它不在 `state.cities` 里 → 粮食结算（`GAME.foodPerSecOf`）永远扫不到它，
       所以"被占领前不消耗粮草"是**结构保证**的，不是靠不写代码。 */
    garrisonMul: 10,
    /* 兵种构成权重（按等级解锁）；总数按目标兵力归一化，所以权重和不必为 1 */
    garrisonMix: [
      { id: 'yibing', w: 0.15, minLv: 1 },
      { id: 'changqiang', w: 0.25, minLv: 1 },
      { id: 'daodun', w: 0.20, minLv: 1 },
      { id: 'gongjian', w: 0.25, minLv: 4 },
      { id: 'qingji', w: 0.15, minLv: 5 },
      { id: 'tieji', w: 0.12, minLv: 7 },
      { id: 'chongche', w: 0.05, minLv: 8 },
      { id: 'toudan', w: 0.03, minLv: 9 },
      { id: 'chuangnu', w: 0.06, minLv: 10 },
    ],
  };
  /* 自建新城（玩家择地而建）的启动物资 —— 不给的话新城的兵立刻断粮 */
  DATA.NEW_CITY_RES = { grain: 6000, wood: 6000, stone: 6000, iron: 6000, gold: 6000, pop: 100 };

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
      { id: 'occupy', name: '占领', icon: '🚩', stamina: 22, energy: 9, battle: true, occupy: true,
        desc: '击溃守军并据而有之。野地归我、城池易主，然财货清点较薄。' },
    ],
    /* v55：旧的 `garrisonMul: 0.55`（守军整体下调）已删 ——
       它是旧公式 `20×2.4^lv×mul` 的系数，而那个公式整个被删了（与
       `DATA.WILD_DEFENSE` 逐级表是两个出口、且面板显示的数被它放大了 15 倍）。
       守军规模现在只有 `DATA.WILD_DEFENSE` 一个来源，要对齐原版就改那张表。 */
    /* 野地：**掠夺有资源，占领不给资源**（原版铁律 —— 掠夺得资源，占领得地盘。
       占领的价值在长期产量加成与采集权，而非一次性财货） */
    wildResMul: { scout: 0.15, raid: 1.2, occupy: 0 },
    wildMatMul: { scout: 0.35, raid: 1.6, occupy: 0.9 },  // 野地材料倍率
    /* v60（需求 4/6）：**城池**的财货不再"凭档位凭空生成"，而是直接从该城
       `GAME.npcCityRes` 的派生库存里按比例取 —— 于是"侦查看到的库存"与
       "打完搬回来的战利品"必然对得上（同一份数据，一个出口）。
         · 掠夺：拿走 50%，城仍归守军（下次再掠，库存按派生值再生）；
         · 占领：**不取现财**（与"占领野地不取财货"同一铁律），
           但城池连同剩余库藏一起归你 —— 见 cityInherit。 */
    cityResMul: { raid: 0.5, occupy: 0 },
    cityInherit: 0.8,                               // 攻占后新城继承该城库存的比例
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
   * 任务（成长任务链 · 数值适配真实体系）
   * ============================================================ */
  DATA.QUESTS = [
    { id: 'q1', title: '建造民房', type: 'build', sub: 'minfang', desc: '民以食为天，安居方能乐业。建造 1 级民房，为子民提供住所。', guide: '在「城内」点击空地建造 1 级民房。', target: { build: 'minfang', count: 1 }, reward: { grain: 2000, wood: 2000, pop: 50 } },
    { id: 'q2', title: '升级民房', type: 'upgrade', sub: 'minfang', desc: '将民房升级到 2 级，提升人口容纳。', guide: '点击民房选择「升级」。', target: { upgrade: 'minfang', level: 2 }, reward: { grain: 3000, wood: 3000, gold: 1000 } },
    { id: 'q3', title: '开垦农田', type: 'build', sub: 'farm', desc: '民以食为天。在城外开垦农田，保障粮食供给。', guide: '在「城外」面板建造 1 级农田。', target: { build: 'farm', count: 1 }, reward: { grain: 5000, wood: 2000, gold: 500 } },
    { id: 'q4', title: '组建兵营', type: 'build', sub: 'junying', desc: '乱世之中武力立身。修建兵营，募集第一批军队。', guide: '在城内空地建造 1 级兵营。', target: { build: 'junying', count: 1 }, reward: { grain: 4000, wood: 3000, iron: 2000, gold: 1000 } },
    { id: 'q5', title: '募义兵', type: 'train', sub: 'yibing', desc: '训练 10 名义兵，以备不时之需。', guide: '「军队」面板训练义兵 10 人。', target: { train: 'yibing', count: 10 }, reward: { iron: 3000, gold: 1000 } },
    { id: 'q6', title: '研究科技', type: 'tech', sub: 'zhongzhi', desc: '在书院研究「种植技术」，粮食产量 +5%。', guide: '「科技」面板研究种植技术。', target: { tech: 'zhongzhi', level: 1 }, reward: { gold: 2000, wood: 3000 } },
    { id: 'q7', title: '建功立业', type: 'rank', sub: 'gongshi', desc: '声望达到 1000，晋升「公士」。', guide: '升级建筑/占领城池获得声望。', target: { rank: 1 }, reward: { gold: 5000, grain: 10000 } },
    { id: 'q8', title: '攻城略地', type: 'conquer', count: 1, desc: '亲率大军攻克第一座 NPC 城池，开疆拓土。', guide: '「地图」选中 NPC 城点击出征。', target: { conquer: 1 }, reward: { gold: 8000, rep: 100, wood: 5000 } },
  ];

  /* ---------------- 头像 ---------------- */
  DATA.AVATARS = {
    male: ['🧔', '👨', '🧑‍🦱', '👨‍🦰', '🧙‍♂️', '🏹', '⚔️', '🐎'],
    female: ['👩', '👩‍🦰', '🧕', '👸', '💃', '🌸', '🗡️'],
  };

  /* ---------------- 初始状态 ---------------- */
  DATA.INITIAL_RES = { grain: 20000, wood: 20000, stone: 20000, iron: 20000, gold: 20000, pop: 200 };
  DATA.INITIAL_BUILDINGS = ['minfang', 'minfang', 'guanfu'];
  DATA.INITIAL_EXT = { farm: 2, forest: 1, quarry: 1, mine: 1 }; // 城外初始：2田1木1石1铁
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
    { id: 'spring', name: '春', desc: '春耕之时，粮产略增', grain: 0.10, feed: 1.00 },
    { id: 'summer', name: '夏', desc: '夏日方长，粮产更盛', grain: 0.15, feed: 1.05 },
    { id: 'autumn', name: '秋', desc: '秋收之际，粮产最丰', grain: 0.25, feed: 1.00 },
    { id: 'winter', name: '冬', desc: '冬寒地冻，粮产锐减、军粮多耗', grain: -0.35, feed: 1.30 },
  ];
  DATA.WEATHERS = {
    clear: { id: 'clear', name: '晴', icon: '☀', grain: 0.00, fire: 1, ambush: 1, move: 1.00, weight: 40, desc: '天朗气清，诸事如常' },
    rain: { id: 'rain', name: '雨', icon: '🌧', grain: -0.15, archerRange: -0.20, fire: 0, ambush: 1.2, move: 0.80, weight: 25, desc: '霖雨不止：粮产 −15%，弓兵射程 −20%，火攻失效，行军 −20%' },
    snow: { id: 'snow', name: '雪', icon: '❄', grain: -0.30, feed: 0.30, fire: 0, ambush: 1, move: 0.50, weight: 12, desc: '大雪封道：粮产 −30%，军粮多耗 30%，行军 −50%，火攻失效' },
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
    /* 以义兵单位成本(粮80/木100/铁50)为基准，除以资源种类数做加权平均，
       使"可动员战力"贴近实际能养多少兵，避免高估 */
    resToTroop: { grain: 1 / 240, wood: 1 / 300, iron: 1 / 150, stone: 1 / 500, gold: 1 / 400 },
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
  /* v16：zoom 为城内/城外/地图的显示比例（%）；autoResearch 与自动建造同列 */
  DATA.ZOOM_LEVELS = [80, 100, 120, 140, 160];
  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100 };

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
   * 建筑系列（v39 · 需求 2/3）
   * ------------------------------------------------------------
   * 老板反馈「建筑主色调都是黄色，区分度偏低」，要求按系列调色、
   * 并从「高度 / 材料 / 色调 / 档次」拉开区分度。
   *
   * 这里只定**系列**（归属），色调在 index.html 的 CSS 里按
   * `ser-<id>` 着色 —— 换句话说：想改某个系列的色，改 CSS 一处即可，
   * 不必回头动数据。加新建筑时，在 BUILDINGS 条目里写上 series 就自动入色系。
   * ============================================================ */
  DATA.SERIES = {
    gov:   { name: '官署', tone: '暖金（不加偏色，靠台基与金瓦认）' },
    live:  { name: '民居', tone: '暖黄偏橙' },
    store: { name: '仓廪', tone: '土黄褐（木构夯土）' },
    edu:   { name: '文教', tone: '青（竹简青瓦）' },
    mil:   { name: '军事', tone: '铁灰蓝（低饱和偏暗）' },
    biz:   { name: '工商', tone: '赭红橙（炉火摊铺）' },
    road:  { name: '驿传', tone: '青灰' }
  };

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

  window.GAME.DATA = DATA;
})();
