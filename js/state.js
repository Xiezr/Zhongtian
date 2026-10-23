/* ============================================================
 * state.js  运行时状态 / 存档 / 工具函数 / 时间轮（真实数值版 v3）
 * 挂到 window.GAME
 * ============================================================ */
import './core.js';
import './data.js';
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
    /* v89.127：1 千~1 万段原用英文 'k'（如 "1.5k"）—— 整个中文界面唯一的英文单位，
       改**逗号千分位**（1500 → "1,500"），与「万 / 亿」体系同气。 */
    return U.numText(n, 0);
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
     与 `U.fmt` 的分工：fmt 会 Math.floor 掉零头（≥1 万走"万"缩写、千级用千分位），
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
  /* v89.123（老板「资源产量以每小时产量呈现，过万以"万"显示」）：
     **每小时产量的格式化唯一出口** —— 消费端只给"每小时"的数，不各自打格式。
     档位：≥1亿 → X.XX亿 · ≥1万 → X.X万 · ≥10 → 整数 · 否则 1 位小数。
     （与 U.amtHTML 的分工：那是**存量**的档位（富余到亿也不奇怪）；
       产量用同一把尺子 —— <1 万的产量以整数呈现，"过万"才进万档。） */
  U.perHourText = function (perH) {
    var v = Number(perH) || 0;
    if (v <= 0) return '0';
    if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
    if (v >= 10) return String(Math.round(v));
    return v.toFixed(1);
  };
  /* 增速显示（v89.123：由「/秒」改为「**每小时**」）——
     ⚠️ 换算 = `每秒 × 3600 ÷ timeScale`（= **游戏时间**的每小时）：
       上游 `cityProdPerSec` 返回的是**现实每秒**（内部 `base/3600×ts`，tick 直接累加），
       直接 ×3600 会把 120× 的倍率乘进来，与建筑面板「产量 100/时」「野地表」差 120 倍。
       同一把尺子 = 野地表 contrib 的公式（`prod × 3600 / timeScale()`）。
     入参仍为**每秒**产量（上游唯一口径不变），本函数只负责换算 + 格式化。 */
  U.rateHTML = function (perSec) {
    var v = Number(perSec) || 0;
    if (v <= 0) return '<span class="num-rate zero">+0/时</span>';
    return '<span class="num-rate">+' + U.perHourText(v * 3600 / GAME.timeScale()) + '/时</span>';
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
  /* v89.174（老板 2）：「读秒完成后，状态还是在建造中」——根因之一 = **显示先行**：
     倒计时用 round，"还剩 0.4 秒"被显示成 "00:00"，但 tick 还没到 → 玩家看到
     "00:00 却仍在施工"最多一个 tick（非整除时长时必现，实测 5/60 帧）。
     改 **ceil**（向上取整 = "至少还需这么久"）：显示 0 只在真完成时出现
     （完成即 splice，不再有"00:00 但未完成"）。全站倒计时（建造/行军/成熟）同源受益。 */
  U.durExact = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
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
   * 城市归属（v60 · 需求 4）
   * ------------------------------------------------------------
   * 老板原话：「英雄，幸存者，资源等是归属于城市的数据，切换城市时，
   *   只统计、呈现当前的数据即可。城市之间，资源需要运输，英雄需要派遣。」
   *
   * 实现取「**访问器**」而不是"把 115 处 `s.res` 逐个改成 `city.res`"：
   *   state 上的 `res` 定义成 **getter**，永远指向**当前城市**的 res 对象。
   *   于是：
   *     ① 旧代码 `s.res.gold -= x` 一行不改，语义自动变成"扣当前城市的旧币"；
   *     ② 不可能"改一处忘一处"（本项目最经典的失效模式）——
   *        物理上只有一份数据，getter 就是唯一出口；
   *     ③ `enumerable:false` → 存档里**不会**出现全局 res 字段，
   *        每城自己那份 `city.res` 随正常序列化走（不需要额外的迁移字段）。
   * ⚠️ 凡是要"按指定城市取值"的地方（产出、耗粮、扣俸禄），一律 `GAME.res(city)`，
   *    不要再写 `GAME.currentCity().res` —— 那样就多出第二个出口了。
   * ============================================================ */
  /* v89.134：由 DATA.RES_ORDER 派生（资源集唯一数据源 = data.js）——
     含 pop（幸存者随城序列化，但不属于「可结算资源」）。 */
  GAME.RES_KEYS = DATA.RES_ORDER.concat(['pop']);
  GAME.emptyRes = function () {
    var o = {};
    GAME.RES_KEYS.forEach(function (k) { o[k] = 0; });
    return o;
  };
  /* 唯一取值口：不传参 = 当前城市 */
  GAME.res = function (city) {
    var c = city || GAME.currentCity();
    if (!c) return GAME._orphanRes || (GAME._orphanRes = GAME.emptyRes());
    if (!c.res) c.res = GAME.emptyRes();
    return c.res;
  };
  /* 全境幸存者 / 全境幸存者上限（v60 · 需求 4）。
     ⚠️ 幸存者归属城市之后，**任何"总幸存者"都必须走这两个函数** ——
     直接读 s.res.pop 只代表**当前城**，会算出"当前城幸存者 / 全境上限"这种
     口径错乱的数（这是本轮最容易踩的坑，所以收口成唯一出口）。 */
  GAME.totalPop = function () {
    var s = GAME.state;
    if (!s) return 0;
    return (s.cities || []).reduce(function (a, c) { return a + (GAME.res(c).pop || 0); }, 0);
  };
  GAME.totalPopCap = function () {
    var s = GAME.state;
    if (!s) return 0;
    /* v89.185（老板 6）：全境"幸存者上限"显示 = **实际值**（民心折算，与城栏同源） */
    return (s.cities || []).reduce(function (a, c) { return a + (GAME.effPopCapOf ? GAME.effPopCapOf(c) : GAME.maxPopOf(c)); }, 0);
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

  /* ============================================================
   * v89.161（老板 5）：「**只有旧币是玩家层级通用的**」——
   *   旧币从"每城一份"上收为**玩家层级唯一存储 `s.gold`**；
   *   各城 `res.gold` 变成**同一口池子的访问器**（读/写都落在这一个数上）。
   * ------------------------------------------------------------
   * 为什么用访问器、而不是逐处改调用点：全仓 ~100 处读写 `res.gold`
   *   （交易站买卖 / 月俸 / 缴获 / 治疗 / 提速 / 神器 / 威望…）。逐处改必漏，
   *   漏掉的那一处就是"某条路仍按城扣款"的静默错账（本项目最经典的失效模式）。
   *   物理上只有一份数据，getter 就是唯一出口。
   * 口径：
   *   · 旧币**不受仓容上限**（既有口径；storePartsOf 只算粮木石铁）；
   *   · 老档迁移：各城 res.gold **相加**迁入池子（总量不变，只是从此通用）；
   *   · 开局库存 / 攻占缴获自带的旧币：`registerCity` 时**并进池子**（不留在城里）。
   * ⚠️ 访问器必须 `enumerable: true` —— `for..in res` / `Object.keys(res)` 这类遍历
   *   （资源栏账目、扁平化存档、断言核对）仍要看见 gold，否则旧币会"凭空消失"。
   * ============================================================ */
  GAME.goldOf = function () {
    var s = GAME.state;
    return Math.max(0, Math.round((s && s.gold) || 0));
  };
  /* 旧币收支的唯一出口（n 可负；钳到 ≥0） */
  GAME.goldAdd = function (n) {
    var s = GAME.state;
    if (!s) return 0;
    /* v89.179b·P2-6：去掉每 tick 读-改写里的 Math.round（v89.131 同族铁律：
       每 tick 加小数的累积量一律直接写字段，不走带 round 的读改写出入口，否则零头被抹掉、
       低倍速/低税率下旧币一格不动、显示与实得两本账）。取整只在 goldOf（显示）做。 */
    s.gold = Math.max(0, (s.gold || 0) + (Number(n) || 0));
    return s.gold;
  };
  /* ============================================================
   * v89.177（老板「民心=100-税率*100」）：**民心出口组**（唯一口径）
   * ------------------------------------------------------------
   *   heartsBaseOf()     = clamp(100 − 税率×100, 0, 100)   —— 基准（税率的派生）
   *   heartsComfortOf()  = clamp(安抚, −100, comfortCap)    —— 累计偏移（措施/祥瑞）
   *   heartsOf()         = clamp(基准 + 安抚, 0, 100)       —— 现值
   *   minyuanOf()        = 100 − heartsOf()                 —— 民怨（同一枚硬币）
   *   applyHearts()      = 现值写回 `s.hearts`（**显示与旧读取面的缓存**）
   * 纪律：一切"改民心"的操作改**安抚**（heartsComfortAdd）后由 applyHearts 落值，
   *   不许直接改 s.hearts（会被下一次重算覆盖）；读民心一律读 heartsOf（缓存同值）。
   * ============================================================ */
  GAME.heartsBaseOf = function () {
    var s = GAME.state;
    var v = 100 - ((s && s.tax) || 0) * 100;
    return Math.max(0, Math.min(100, v));
  };
  GAME.heartsComfortOf = function () {
    var s = GAME.state;
    var cap = ((DATA.HEARTS || {}).comfortCap != null) ? DATA.HEARTS.comfortCap : 50;
    var v = (s && s.heartsComfort) || 0;
    return Math.max(-100, Math.min(cap, v));
  };
  GAME.heartsOf = function () {
    return Math.max(0, Math.min(100, GAME.heartsBaseOf() + GAME.heartsComfortOf()));
  };
  GAME.minyuanOf = function () { return 100 - GAME.heartsOf(); };
  GAME.applyHearts = function () {
    var s = GAME.state;
    if (!s) return 0;
    s.heartsComfort = GAME.heartsComfortOf();
    s.hearts = GAME.heartsOf();
    return s.hearts;
  };
  /* 安抚偏移写入口（措施 / 祥瑞 / 事件统一走这里；delta 可负） */
  GAME.heartsComfortAdd = function (d) {
    var s = GAME.state;
    if (!s) return 0;
    var cap = ((DATA.HEARTS || {}).comfortCap != null) ? DATA.HEARTS.comfortCap : 50;
    s.heartsComfort = Math.max(-100, Math.min(cap, (s.heartsComfort || 0) + (Number(d) || 0)));
    GAME.applyHearts();
    return s.heartsComfort;
  };

  /* ============================================================
   * v89.204（老板 1）：「占领以民心为基础…（如为我方，除主城不可被占领外，
   *   别的城市将会被敌方占领）」—— 玩家城的**战争创伤**（城级民心的减项 · 唯一出口组）
   * ------------------------------------------------------------
   *   heartsWarOf(city)    = 战争创伤现值（含**每现实日恢复** repairPerDay，读＝算，惰性）
   *   heartsWarAdd(city,d) = 战争创伤累加（敌方破城得手 +20；d 可负；clamp ≥ 0）
   *   cityHeartsOf(city)   = clamp(全境民心(heartsOf) − 战争创伤, 0, 100) —— **城级民心**
   *
   * 存储：`city.warHearts = { loss, day }`（随档走；day = 现实日号 —— 与
   *   siegeStateOf 的"每整日恢复"同一把尺、同一个 DATA.SIEGE.repairPerDay）。
   * ⚠️ 失城判定与一切"该城民心"的显示一律读 cityHeartsOf（城级）；
   *   heartsOf 只是它的**全境基准**（税率 + 安抚）——无战争创伤时两者相等。
   * ============================================================ */
  GAME.heartsWarOf = function (city) {
    if (!city) return 0;
    var rec = city.warHearts;
    if (!rec || !(rec.loss > 0)) return 0;
    var day = GAME.questDayIndex();
    var rep = ((DATA.SIEGE || {}).repairPerDay || 0) * Math.max(0, day - (rec.day == null ? day : rec.day));
    if (rep > 0) {
      rec.loss = Math.max(0, rec.loss - rep);
      rec.day = day;
      if (rec.loss <= 0) { delete city.warHearts; return 0; }
    }
    return rec.loss;
  };
  GAME.heartsWarAdd = function (city, d) {
    if (!city || !d) return 0;
    d = Number(d) || 0;
    if (!d) return 0;
    var cur = GAME.heartsWarOf(city);          /* 先结清惰性恢复（同一口径），再加 */
    if (d < 0 && !city.warHearts) return 0;
    if (!city.warHearts) city.warHearts = { loss: 0, day: GAME.questDayIndex() };
    var rec = city.warHearts;
    rec.loss = Math.max(0, cur + d);
    rec.day = GAME.questDayIndex();
    if (rec.loss <= 0) { delete city.warHearts; return 0; }
    return rec.loss;
  };
  GAME.cityHeartsOf = function (city) {
    var base = GAME.heartsOf();
    var w = GAME.heartsWarOf(city);
    return Math.max(0, Math.min(100, base - w));
  };

  /* 给一份 res 对象挂上 gold 访问器（幂等：已是访问器则原样返回，**不重复并池**） */
  GAME.goldBind = function (r) {
    if (!r) return r;
    var d = null;
    try { d = Object.getOwnPropertyDescriptor(r, 'gold'); } catch (e) { d = null; }
    if (d && d.get) return r;
    try {
      Object.defineProperty(r, 'gold', {
        get: function () { return GAME.goldOf(); },
        set: function (v) {
          var s = GAME.state;
          /* v89.179b·P2-6：写端也不取整（与 goldAdd 同源），保留小数累积；显示由 goldOf 取整。 */
          if (s) s.gold = Math.max(0, Number(v) || 0);
        },
        enumerable: true, configurable: true,
      });
    } catch (e) { return r; }
    return r;
  };
  /* 把访问器挂到**所有城**的 res 上（newGame / 读档 / 新城入库后各调一次）。
     opts.keepCityGold = true：把各城**尚未入池**的普通字段值并进池子
     （只用于"新城自带旧币"这一路；读档走 st.gold 权威值，绝不并池 —— 否则 ×城数）。 */
  GAME.attachGold = function (st, opts) {
    st = st || GAME.state;
    if (!st) return st;
    var keep = !!(opts && opts.keepCityGold);
    var sum = 0;
    (st.cities || []).forEach(function (c) {
      if (!c.res) c.res = GAME.emptyRes();
      var d = null;
      try { d = Object.getOwnPropertyDescriptor(c.res, 'gold'); } catch (e) { d = null; }
      if (!(d && d.get)) {
        sum += (d && d.value) || 0;      /* 还是普通字段（新城/老档）→ 记下待并池 */
        GAME.goldBind(c.res);
      }
    });
    if (keep && sum) st.gold = Math.max(0, ((st.gold || 0) + sum));
    return st;
  };
  /* 老档 → 旧币池迁移（**幂等** · 唯一出口）：`st.gold` 缺失时把各城 res.gold **相加**迁入；
     已存在（新档）则以它为权威 —— 各城那份只是冗余副本，**不累加**（否则 ×城数）。 */
  GAME.migrateGoldPool = function (st) {
    st = st || GAME.state;
    if (!st) return st;
    if (st.gold == null) {
      var sum = 0;
      (st.cities || []).forEach(function (c) { sum += (c.res && c.res.gold) || 0; });
      st.gold = Math.max(0, Math.round(sum));
    }
    return GAME.attachGold(st);
  };
  /* 城市入库的**唯一出口**（push + 旧币池接线）——
     新城 / 攻占城 / 据点转正都必须经它；否则那座城的旧币会变成"私房钱"
     （与"旧币全境通用"相悖，且玩家在别的城花不到它）。 */
  GAME.registerCity = function (city) {
    var s = GAME.state;
    if (!s || !city) return city;
    /* v90.59（老板「新城3/新城4 叠在一个地块上」）：**同一地块不重复入库** ——
       已有一座**别**城占着 (x,y) → 拒收并留痕（防"两城同格"这种脏档）。 */
    var dup = (s.cities || []).filter(function (c) { return c.id !== city.id && c.x === city.x && c.y === city.y; })[0];
    if (dup) {
      GAME.log && GAME.log('⚠ 城市落位冲突：' + city.name + ' 与 ' + dup.name + ' 同在 (' + city.x + ',' + city.y + ')，已拒收', 'sys', 'admin');
      return null;
    }
    s.cities.push(city);
    GAME.attachGold(s, { keepCityGold: true });   /* 自带旧币（缴获 / 预置）并进池子 */
    return city;
  };

  /* ---------------- 新建玩家城（城内 8×6=48 格，政务厅居中4格，余44格可建）---------------
     v40（需求 2）：老板要「8*6，6 行 8 列」并「尽量填充界面」——
     格子数据由 col/row 驱动（isoMetrics 早就是参数化的），
     所以这里改两个数、政务厅落位跟着移到新坐标系即可。 */
  /* 政务厅 2×2 的落位（唯一出口 · v68 老板）：
     城内棋盘**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
     makeCity / cityPlanOf（系统城）/ 旧档迁移三处都走它，别处不许再写死格号。 */
  GAME.govCellsOf = function (col, row) {
    var gc = Math.floor((col - 2) / 2), gr = Math.floor((row - 2) / 2);
    return [gr * col + gc, gr * col + gc + 1, (gr + 1) * col + gc, (gr + 1) * col + gc + 1];
  };

  GAME.makeCity = function (opts) {
    opts = opts || {};
    /* v90.100（球系）：**格索引 ci = 唯一身份**（可传 opts.ci，或旧式 opts.x/opts.y）；
       lon/lat 由 ci 现算；x/y 仅为渲染缓存（由 ci 派生，映射已互逆）。 */
    var _SP = GAME.sphere;
    var _ci = (opts.ci != null && opts.ci >= 0) ? opts.ci
      : ((_SP && _SP.ciOfXY && opts.x != null && opts.y != null) ? _SP.ciOfXY(opts.x, opts.y) : -1);
    var _cell = (_SP && _SP.cells && _ci >= 0) ? _SP.cells[_ci] : null;
    var _lon = _cell ? _cell.lon : (opts.lon != null ? opts.lon : 0);
    var _lat = _cell ? _cell.lat : (opts.lat != null ? opts.lat : 0);
    var _xy = (_SP && _SP.xyOfLonLat) ? _SP.xyOfLonLat(_lon, _lat)
      : { x: (opts.x != null ? opts.x : DATA.START_POS.x), y: (opts.y != null ? opts.y : DATA.START_POS.y) };
    var city = {
      id: opts.id || 'p1',
      /* v60：每城一份资源与幸存者。 */
      res: (function () {
        var r = GAME.emptyRes(), src = opts.res || DATA.NEW_CITY_RES || {};
        GAME.RES_KEYS.forEach(function (k) { r[k] = src[k] || 0; });
        return r;
      })(),
      name: opts.name || '新城市',
      /* v91.74：**星球归属** —— 归一化世界里，城/野地/据点/队列都带星球号（ci 只在球内唯一）。 */
      pid: (opts.pid != null) ? opts.pid : ((GAME.state && GAME.state.activePlanet) || 1),
      ci: _ci, lon: _lon, lat: _lat,   /* 球系唯一身份 + 显示经纬 */
      x: _xy.x, y: _xy.y,              /* 渲染缓存（由 ci 派生；不再作身份/主键） */
      level: 1,
      def: 0,
      col: 8, row: 6,          /* v40：6 行 8 列 */
      cells: [],
      /* v89.191（老板 3-④）：**各城一份科技** —— 研究在城里做、效果只在本城
         （读点唯一入口 systems.techLevel(id, city)；上限 techCapOf：主城 20 / 别城 10）。 */
      techs: {},
      army: {},
      ruler: true,
      /* 'self' = 自建城/首城（无岁贡，靠外城地块与税收）；
         capital/zhou/jun/county = 攻占的系统名城（有辖区特产岁贡，见 DATA.CITY_YIELD） */
      type: opts.type || 'self',
      state: opts.state || null,                     // 所属区（决定特产）
      extGrid: GAME.makeExtGrid(opts.initialExt),   // 外城地块按城市独立（v14）
    };
    var total = city.col * city.row;
    /* v91.19（老板 1）：**固定栏位（预留模式）** —— 居所槽预建居所、各功能建筑槽**留空**，
       玩家按科技解锁后在固定位置建；与系统名城同一套布局（切城不再乱）。 */
    GAME.applyFixedLayout(city.cells, 1, city.col, city.row, true);
    city.wall = { build: null, pending: null };
    return city;
  };

  /* 外城地块：12 块（政务厅 Lv1 时）。
     `initial` 三态：true = 首城模板（2田1木1石1铁）· 'new' = 自建城开发模板 ·
     其余（false/undefined）= 全空（攻占的名城按自己的 extGrid 走，见 battle.js）。
     v89.93（整改 E12）：改前只有首城有模板，自建城是"裸城"——
     实测新城 2/3 在 600× 下闲置 100 年零产出（城外等级和 = 0）。 */
  GAME.makeExtGrid = function (initial) {
    var grid = [];
    for (var i = 0; i < 12; i++) grid.push({ id: 'e' + (i + 1), type: null, lv: 0 });
    /* v89.134：首城模板读 DATA.INITIAL_EXT（与 NEW_CITY_EXT 同构）；
       改前是就地字面量 —— 实机行为不变，改动点收敛到数据表。 */
    var tpl = (initial === 'new') ? (DATA.NEW_CITY_EXT || null)
      : (initial ? (DATA.INITIAL_EXT || null) : null);
    (tpl || []).forEach(function (t, idx) {
      if (idx < grid.length && t) { grid[idx].type = t; grid[idx].lv = 1; }
    });
    return grid;
  };

  /* ---------------- 新建游戏 ---------------- */
  GAME.newGame = function (rulerOpts) {
    /* v89.89：`mapSeed` 可注入（与 `portraitSeed` 同一先例：供测试注入确定值）——
       未注入时仍走时间戳随机（正常游戏每局不同图，行为零变化）。
       背景：`U.now() % 100000` 是毫秒时间戳，测试每次 run 的地图布局/出生点都不同，
       "在地图上找格子"类断言随布局偶发假红（实测 v89.87 采集断言 ~1/3 复现率）。 */
    var mapSeed = (rulerOpts && rulerOpts.mapSeed != null)
      ? ((Math.round(Number(rulerOpts.mapSeed)) % 100000) || 1)
      : (U.now() % 100000);
    /* v90.70：先建球面内核（随 seed）—— 城/名城的球面六边格索引（ci）与地形判据都要它。
       幂等（同 seed 不重算）。
       ⚠️ v91.61 记录（未在本轮改）：此处 `seed3()` 读 `GAME.state.map.seed`，而 state
       尚未换成新局 → 全新会话首局会用 seed 1 建球面（种子错配）。属**既有缺陷**，
       修复需连同"出生点校验依赖球面"的时序一起调整，留待单独一轮处理。 */
    if (GAME.sphere && GAME.sphere.ensure) GAME.sphere.ensure();
    /* v70（老板需求 5）：出生坐标按**所选区**落位（首府近旁的平原空地），
       烬环以灰烬城为锚；落不到才回退旧口径的固定点。出生城写明所属区 ——
       展示、岁贡、辖区特产都读同一份归属。 */
    var startPos = GAME.pickStartPos(rulerOpts.region, mapSeed);
    var city = GAME.makeCity({
      id: 'p1',
      name: rulerOpts.cityName || '新城市',
      x: startPos.x, y: startPos.y,
      state: startPos.state,
      initialExt: true,          // 首城预置 2 田 1 木 1 石 1 铁
      res: U.deep(DATA.INITIAL_RES),   // v60：开局库存进首城（不再是全境共享的 s.res）
    });
    var gen = GAME.makeGeneral(DATA.INITIAL_GENERAL, 1, 'idle', city.id, true);
    /* v70：君主头像 seed **只摇一次**，ruler 与君主英雄共用 ——
       各摇一次就是两张脸（顶栏一个、英雄页一个），正是"头像不一致"的根因。 */
    var lordSeed = rulerOpts.portraitSeed != null
      ? rulerOpts.portraitSeed
      : Math.floor(Math.random() * 4294967296);
    GAME.state = {
      version: SAVE_VERSION,
      /* v89.190（v89.189 遗留「幸存者口径老档宽限」）：幸存者安置标记 ——
         新局建档即带（fresh），老档（无此字段）首载时由 adoptState 一次性安置。 */
      popGrace190: { at: U.now(), fresh: true },
      ruler: {
        name: rulerOpts.name || '无名君主',
        avatar: rulerOpts.avatar || '🧔',
        gender: rulerOpts.gender || 'male',
        /* v70：记**解析后的区**（'random' 也记成抽到的那一区）——
           创建界面的选择因此可复盘，出生城的归属与它一致 */
        region: startPos.state || rulerOpts.region || 'random',
        /* v45（需求 2）：主角头像改为**从 20 张头像池里随机取一张**。
           不给固定值的话每局君主长同一张脸（池子是按名字 hash 取的），
           所以开局就摇一个种子存进存档 —— 之后每局固定、不再刷新就换脸。
           `rulerOpts.portraitSeed` 供测试注入确定值。 */
        portraitSeed: lordSeed,
      },
      /* v60：**state 上不再有 res 字段** —— 它由 attachRes 挂成访问器，
         指向当前城市的库存（`city.res`）。这里写字面量反而会盖掉 getter。 */
      cities: [city],
      /* v70（老板）：君主本人也是一位英雄 —— 排在末尾，不动既有索引口径
         （`generals[0]` 仍是开局英雄，测试与旧档迁移都按原样） */
      generals: [gen, GAME.makeLordGeneral(rulerOpts, lordSeed, city.id)],
      queues: { build: [], train: [], tech: [] },
      marches: [],
      /* v89.87（老板需求 4）：待指挥战斗（观战挂起）—— 纯数据、随存档往返；
         运行时会话挂在内存 GAME._bsess（read 档时由 restoreBattles 重放重建） */
      battles: [],
      /* v70：出生点随"所选区"走 —— 地图生成时的"出生圈强制平原"与据点安全半径
         都读 `map.startPos`（见 map.js），旧档缺字段则回退 DATA.START_POS。 */
      map: { seed: mapSeed, cities: GAME.buildNpcCities(mapSeed), wilds: null,
        startPos: { x: startPos.x, y: startPos.y } },
      /* v90.73（老板 9）：**多星球副本** —— 每颗星球一份 {seed, params}；activePlanet 指向当前。
         默认星球 = 本局的 mapSeed + SP.PLANET 默认参数。
         v90.97（老板）：**球系 ID 从 1 起递增**（老家 = 1，后续 2/3/4…）—— 为持续新增的
         星球/城市预留可管理的编号结构；0 保留为「未初始化」哨兵，供老档迁移判据使用。 */
      planets: [{ id: 1, name: '老家', seed: mapSeed,
        params: (GAME.sphere && GAME.sphere.PLANET) ? { seaFrac: GAME.sphere.PLANET.seaFrac, ridge: GAME.sphere.PLANET.ridge, detail: GAME.sphere.PLANET.detail, temp: GAME.sphere.PLANET.temp } : { seaFrac: 0.45, ridge: 1.5, detail: 0.7, temp: 1.0 } }],
      activePlanet: 1,
      planetWorldMig74: 1,       /* v91.74：新局即全局世界（分片已退役） */
      /* v90.97（双球面）：**地图在看/渲染的星球**（id）—— 与 activePlanet（当前城所在星球）解耦。
         默认与 activePlanet 相同（进某城时同步）。地图切星球只动它，不动 activePlanet/当前城。 */
      mapPlanetId: 1,
      rep: 0,
      rank: 0,
      mainCityId: null,          // v79：主城（政务厅里设；驻跸加成 + 【主城】标识）
      artifacts: { pts: 0 },     // v79：神器供奉值（时长自动 + 活动加速）
      /* v89.177：初值 = 100 − 默认税率 50%×100 = 50（公式口径；首 tick 起由 applyHearts 持续维护） */
      hearts: U.clamp(100 - (DATA.DEFAULT_SETTINGS.tax || 0) * 100, 0, 100),
      tax: DATA.DEFAULT_SETTINGS.tax,           // 税率 0~1
      workRate: { grain: 100, wood: 100, stone: 100, iron: 100 }, // 开工率（原版机制）
      settings: U.deep(DATA.DEFAULT_SETTINGS),
      /* v89.191：科技不再是全境一份（state 顶层无 techs）—— 各城 city.techs，见 makeCity。 */
      items: U.deep(DATA.INITIAL_ITEMS),        // 宝物背包 {itemId: count}
      /* v79（老板第 4 条）：装备**单件化** —— 背包存实例 { u, id, enh }：
         u = 件号（同名以 甲/乙/丙 区分）· id = 装备谱 · enh = 该件熔铸等级 */
      inventory: (DATA.INITIAL_EQUIP || []).map(function (id, i) { return { u: i + 1, id: id, enh: 0 }; }),
      nextEqU: (DATA.INITIAL_EQUIP || []).length,
      forged: [],                               // 已打造过的装备（图鉴用）
      salaryAt: 0,                              // v77：英雄月俸上次结算锚点（游戏秒）
      overflowAt: 0,                            // v89.160：逾溢折损上次结算锚点（游戏秒）
      wilds: [],                                // 已占领野地
      fortsRazed: {},                           // 今日已攻取的野外城市 { 'x,y': dayIndex }
      /* v89.103（老板「拔除据点可以占据该据点」）：**永久**占据记录
         { 'x,y': { day, cityId } } —— 据点打下即转为己方城市，此格从此不再生成据点。 */
      fortsTaken: {},
      /* v63（老板）：「野外城每天只能被掠夺一次」—— 与 fortsRazed 同一套记法
         （键 = 'x,y'，值 = 游戏日索引），过一天自动失效，不需清理任务。 */
      fortRaids: {},                            // 今日已掠夺的野外城市 { 'x,y': dayIndex }
      yieldDay: null,                           // 上次辖区岁贡结算的现实日（null = 尚未结算过）
      gathers: [],                              // 野地采集队（v15）：{ id,x,y,type,level,genId,army,troops,cityId,elapsed }
      /* 叙事层（story.js）：世界历法（年 / 季 / 天气）
         ⛔ v89.218：chronicle / chronicleDone / eraHistory 三字段随史册退役
         （老档残留不再读取，随下次存档自然消失）。
         ⛔ v90.93：world 里的 eraIndex / eraStartYear / eraGoalDone /
         eraGoalClaimed 四字段随年号纪元退役（同理：老档残留不再读取）。 */
      world: null,                              // 由 GAME.story.init() 填充
      /* v90.92：任务系统整条退役 —— s.quests 字段移除 */
      /* 累计统计（任务指标来源，跨存档保留） */
      /* v93.1：名声建档即带 —— 新档一定是"无名"，不是"没有这个字段"。
         老档没有时由 GAME.renown.raw() 兜底补 {0,0}（不写迁移代码）。 */
      renown: { mercy: 0, cruelty: 0 },
      stats: { buildDone: 0, techDone: 0, trained: 0, forgedCount: 0, recruited: 0,
               trades: 0, wins: 0, conquer: 0, itemsUsed: 0 },
      reports: [],
      repUnread: 0,                             // v41（需求 4）：未读新战报数 → 公文菜单图标闪黄
      repUnread: 0,                             // v41（需求 4）：未读新战报数 → 公文菜单图标闪黄
      log: [],                                  // 存档内最近 40 条（紧凑）
      msgLog: [],                               // v16：完整消息流（保留 10 游戏天 / 至少 300 条）
      createdAt: U.now(),
      savedAt: U.now(),
      /* v92：探明度（迷雾）。null = 尚未建包 —— 由 GAME.fog.ensure() 按当前星球
         seed 惰性建（RLE 打包，开局约 60 字节）。
         换星球不继承：探索度是这颗球自己的经历。 */
      fog: null,
      /* v92：阵亡名录（只记事）。每次战斗一条，滚动上限 240 条；
         累计人数另在 stats.deadTotal（不因 UI 上限缩水）。*/
      memorial: [],
    };
    GAME.attachRes(GAME.state);   // v60：挂上「当前城市库存」访问器（必须在 story.init 之前）
    /* v91.74：世界数据全局一份（不再按星球分片）—— 新局直接标记已完成归一。 */

    /* v89.161（老板 5）：旧币上收玩家池 —— 开局库存里的旧币（INITIAL_RES.gold）并进 s.gold */
    GAME.attachGold(GAME.state, { keepCityGold: true });
    if (GAME.story) GAME.story.init();
    GAME.syncSeq();            // 发号起点对齐（防新将撞号）
    /* v92：开局只看得见自家门口 —— 全图 40962 格其余一律未探明。
       （此前开局全亮：每座城、每块野地等级一眼看尽 → 远征只剩算路线。）
       ⚠️ 先 reset：同一 seed 开第二局时，内存里还留着上一局的探明度包，
       ensure 的快速路径认 (格数,种子) 会直接沿用 —— 那就不是"新的一局"了。 */
    if (GAME.fog) { GAME.fog.reset(); GAME.fog.revealOwned(); }
    /* v105（前传）：**只有显式 prologue:true 才进** —— 324 处测试直接调 newGame，
       默认开会把它们全落进"城不产东西"的阶段，几百条断言集体假红。
       玩家走创建角色界面（ui.doCreate）时传 true。 */
    if (rulerOpts && rulerOpts.prologue && GAME.prologue) GAME.prologue.begin(GAME.state);
    return GAME.state;
  };

  /* ============================================================
   * v90.73（老板 9）：**多星球副本**
   * ------------------------------------------------------------
   * 每颗星球 = 一份 {id, name, seed, params}，与主世界**同构**（独立地形/城/野地）。
   * 不同星球**不再同屏**展示 —— 切到某星球才载入它。星球之间默认间距 STAR_DIST（六边格数）
   * 作为**出征距离参考**（跨星球出征的里程基准）。
   * 单副本模型：同一时刻 activePlanet 标出当前星球；其 seed/params 灌入 GAME.sphere。
   * ============================================================ */
  GAME.STAR_DIST = 10000;      /* 星球间默认距离（六边形拓扑格数）—— 出征距离参考 */
  GAME.planetsOf = function () { var s = GAME.state; if (!s) return []; s.planets = s.planets || []; return s.planets; };
  /* v91.86 · 星球环境规则（"一步一景"的机制底座）
     ────────────────────────────────────────────────
     · 老家（id=1）没有规则 → 既有战斗/数值基线一字不动；
     · 新星球在 addPlanet 时按 DATA.PLANET_ENV_ORDER 轮换；
     · 老档缺 env 字段 → 回落 none，行为与旧版一致。 */
  GAME.planetEnvOf = function (pid) {
    var ENV = (DATA && DATA.PLANET_ENV) || {};
    if (pid == null) pid = GAME.curPid();
    var p = null;
    GAME.planetsOf().forEach(function (x) { if (x && x.id === pid) p = x; });
    var id = (p && p.env) || 'none';
    return ENV[id] || ENV.none || { id: 'none', name: '常规', desc: '', spd: 1, range: 1, drain: 0 };
  };
  /* v91.86 · 星球难度阶梯（第 1 星球 = ×1）
     ×1.30 基础 + 每 3 星球追加 ×1.15 —— 比纯 ×1.5 可读，也不至于第 10 球撞墙。 */
  GAME.planetScaleOf = function (pid) {
    var C = (DATA && DATA.PLANET_SCALE) || { base: 1.3, step: 0.15, every: 3 };
    var n = Math.max(1, pid | 0);
    var s = Math.pow(C.base, n - 1);
    s *= Math.pow(1 + C.step, Math.floor((n - 1) / C.every));
    return s;
  };
  GAME.activePlanetOf = function () {
    var s = GAME.state; if (!s) return null; var ps = GAME.planetsOf();
    /* v90.89：`activePlanet` 是**星球 id**（非数组下标）—— 按 id 严格查找。
       改前用 `ps[s.activePlanet]` 当**下标**取：id 与下标错位时会取到**另一颗**星球
       （"在星球2 却显示星球3 / 单击无效"的根因）。id 不存在则回退首个。 */
    var aid = s.activePlanet || 0, byId = null;
    ps.forEach(function (x) { if (x.id === aid) byId = x; });
    return byId || ps[0] || null;
  };
  /* v90.97（双球面）：**地图在看/渲染的星球**（id 非下标）—— 与 activePlanet 解耦。
     SSOT：map3d 标记、地图星球的据点/城/野地读取都走它（或 mapSliceOf）。 */
  GAME.mapPlanetOf = function () {
    var s = GAME.state; if (!s) return null; var ps = GAME.planetsOf();
    var mid = (s.mapPlanetId != null) ? s.mapPlanetId : s.activePlanet;
    var byId = null; ps.forEach(function (x) { if (x.id === mid) byId = x; });
    return byId || GAME.activePlanetOf() || ps[0] || null;
  };
  /* v90.97：**任一星球的分片读取**（pid 缺省 = 当前星球）—— 跨星球行政视图（星球→城市树）用。
     当前星球取活态 s（queries 与 s.queues 是同一对象，天然实时）；他星读 mapSlices 快照，
     若该星未存片则用现有世界兜底（近似，但至少不判空）。 */
  /* 某星球**过滤视图**（只读快照引用；v91.74 起世界数据全局一份，按 pid 过滤）。 */
  GAME.sliceOf = function (pid) {
    var s = GAME.state; if (!s) return null;
    var mid = (pid != null) ? pid : (s.activePlanet || 1);
    var by = function (arr) { return (arr || []).filter(function (e) { return GAME.pidOf(e) === mid; }); };
    var fkPrefix = 'p' + mid + '|';
    var pickDict = function (o) {
      var out = {};
      Object.keys(o || {}).forEach(function (k) {
        if (String(k).indexOf(fkPrefix) === 0) out[String(k).slice(fkPrefix.length)] = o[k];
        else if (GAME.fortKeyCi(k) >= 0 && mid === (s.activePlanet || 1)) out[k] = o[k];   /* 老裸键 = 当前星 */
      });
      return out;
    };
    var q = s.queues || {};
    return {
      cities: by(s.cities), wilds: by(s.wilds),
      forts: pickDict(GAME.fortsOf ? GAME.fortsOf() : (s.forts || {})),
      fortsRazed: pickDict(s.fortsRazed), fortsTaken: pickDict(s.fortsTaken), fortRaids: pickDict(s.fortRaids),
      queues: { build: by(q.build), train: by(q.train), tech: by(q.tech) },
      marches: by(s.marches), gathers: by(s.gathers),
      startPos: (mid === (s.activePlanet || 1) && s.map) ? s.map.startPos : null,
    };
  };
  /* v90.97：**地图星球的分片**（cities/wilds/forts/queues…）—— map3d 标记/据点读取用。
     缺省取 mapPlanet；地图星球 = 当前星球时与 sliceOf 同源（实时）。 */
  GAME.mapSliceOf = function (pid) {
    return GAME.sliceOf(pid != null ? pid : (GAME.mapPlanetOf() ? GAME.mapPlanetOf().id : null));
  };
  /* v90.97（双球面）：地图切星球 —— **只动地图球面**（mapPlanetId + mapSphere），
     不碰 GAME.sphere / activePlanet / 当前城，故城市界面保持。 */
  GAME.setMapPlanet = function (id) {
    var s = GAME.state; if (!s) return { ok: false, msg: '无存档' };
    var ps = GAME.planetsOf(), p = null;
    ps.forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return { ok: false, msg: '星球不存在' };
    s.mapPlanetId = p.id;
    if (GAME.mapSphere && GAME.mapSphere.setPlanet) GAME.mapSphere.setPlanet(p.seed, p.params);
    if (GAME.map) { GAME.map._fortCand = null; GAME.map._fortLv = null; GAME.map._fortBlocks = null; GAME.map._fortRing = null; GAME.map._cntyF = null; }
    if (GAME.map3d && GAME.map3d.rebuild) GAME.map3d.rebuild();
    return { ok: true, planet: p };
  };
  /* 载入某星球 —— 把其 seed/params 灌入内核并重建；activePlanet 记档。 */
  GAME.loadPlanet = function (id) {
    var s = GAME.state; if (!s) return { ok: false, msg: '无存档' };
    var ps = GAME.planetsOf();
    var p = null; ps.forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return { ok: false, msg: '星球不存在' };
    s.activePlanet = p.id;
    if (GAME.sphere && GAME.sphere.setPlanet) GAME.sphere.setPlanet(p.seed, p.params);
    return { ok: true, planet: p };
  };
  /* v91.14（老板）：「星球可以命名」—— 唯一出口：改 s.planets[].name。
     全仓星球名读点都取 p.name（toast/地图 dock/前哨命名/星球列表）→ 改名一处即全同步（SSOT）。 */
  GAME.renamePlanet = function (id, name) {
    var s = GAME.state; if (!s) return { ok: false, msg: '无存档' };
    var p = null; GAME.planetsOf().forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return { ok: false, msg: '星球不存在' };
    name = String(name == null ? '' : name).trim();
    if (!name) return { ok: false, msg: '名称不能为空' };
    if (name.length > 10) name = name.slice(0, 10);
    var old = p.name;
    p.name = name;
    GAME.log && GAME.log('🪐 星球改名：「' + (old || ('#' + id)) + '」→「' + name + '」', 'sys', 'admin');
    return { ok: true, msg: '已改名「' + name + '」', planet: p };
  };
  /* 生成新星球（附到副本池）：返回 {id}。seed 缺省现摇（在边界注入以求确定）。
     v90.97：球系 ID 从 1 起递增（老家=1）；命名 = 老家 / 星球 N（N=球系 ID）。 */
  GAME.addPlanet = function (opts) {
    var s = GAME.state; if (!s) return null;
    opts = opts || {};
    var ps = GAME.planetsOf();
    var id = (ps.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) || 0) + 1;
    /* v91.86：新星球带一条环境规则（老家不带）—— 玩家一进球就知道"这里不一样" */
    var _eo = (DATA && DATA.PLANET_ENV_ORDER) || [];
    var _env = (id === 1 || !_eo.length) ? 'none' : _eo[(id - 2) % _eo.length];
    var p = { id: id, name: opts.name || (id === 1 ? '老家' : ('星球 ' + id)), seed: (opts.seed != null ? (opts.seed | 0) : ((U.now() % 900000) || 1)),
      env: _env,
      params: opts.params || (GAME.sphere && GAME.sphere.PLANET ? { seaFrac: GAME.sphere.PLANET.seaFrac, ridge: GAME.sphere.PLANET.ridge, detail: GAME.sphere.PLANET.detail, temp: GAME.sphere.PLANET.temp } : { seaFrac: 0.45, ridge: 1.5, detail: 0.7, temp: 1.0 }) };
    ps.push(p);
    return p;
  };
  /* 星球生成器「生成」动作（UI 读框 → 建副本 → 出体检报告 + 自动奇观 → 可选进入）。 */
  GAME._planetDoCreate = function (enter) {
    var ui = GAME.ui;
    var params = ui && ui._planetParamsFrom ? ui._planetParamsFrom() : {};
    var seed = ui && ui._planetSeedFrom ? ui._planetSeedFrom() : ((U.now() % 900000) || 1);
    var p = GAME.addPlanet({ seed: seed, params: params });
    if (!p) { if (ui) ui.toast('生成失败'); return; }
    /* v90.81：生成后**即时**算体检报告 + 自动奇观（临时把内核切到新球算完再还原）*/
    var report = null, artifact = null;
    if (GAME.sphere && GAME.sphere.setPlanet) {
      GAME.sphere.setPlanet(p.seed, p.params);
      report = GAME.sphere.report(); artifact = GAME.sphere.artifactOf();
    }
    p.report = report; p.artifact = artifact;
    if (p.params) p.params.artifact = artifact;
    if (enter) {
      /* v90.85：走读条屏（确认切换成功）—— 先关菜单，让读条屏盖在地图上可见 */
      if (ui && ui.switchPlanet) {
        ui._planetForm = null; ui._planetTab = 'list';
        ui.closeModal();
        GAME.refreshAll(); if (ui.view !== 'map') ui.setView('map');
        ui.switchPlanet(p.id, function () {
          GAME.refreshAll(); ui.renderMapCanvas();
          ui.toast('🪐 ' + p.name + ' 生成并进入 · 宜居 ' + (report ? report.habit : '?') + '/100 · 奇观「' + artifact + '」');
        });
      } else {
        GAME.enterPlanet(p.id);
      }
    } else {
      /* 不进则还原当前球（否则"看着切走了"）*/
      GAME.enterPlanet(GAME.state.activePlanet);
      if (ui) { ui._planetForm = null; ui._planetTab = 'list'; ui.openPlanetGen(); ui.toast('🪐 已生成 ' + p.name + '（宜居 ' + (report ? report.habit : '?') + '）—— 副本列表「进入」'); }
    }
  };
  /* ============================================================
   * v90.84（老板 2）：**星球分片** —— 每颗星球独有的世界状态。
   * ------------------------------------------------------------
   * 全局共享（跨星球）：英雄 / 资源 / 科技 / 背包 / 任务 / 统计（即"帝国"）。
   * 分片（随星球）：城 / 野地 / 据点（占/掠/毁）/ 采集队 / 行军 / 队列。
   * 换星球 = 存当前片 + 载目标片（目标片空 = 毛胚）。消费点读的永远是"当前星球"的
   * s.cities/s.wilds/...（它们就是当前片），故各消费点无需改动。
   * ============================================================ */
  GAME.SLICE_KEYS = ['cities', 'wilds', 'forts', 'fortsRazed', 'fortsTaken', 'fortRaids', 'gathers', 'marches',
    'battles', 'queues', 'sieges', 'mainCityId', 'startPos', 'yieldDay'];
  /* ============================================================
   * v91.74（老板）：「星球不做切片，归一管理，只是地图显示切片」——
   * ------------------------------------------------------------
   * 世界数据（城/野地/据点/队列/行军/采集/战斗）**全局一份**，每条记录带 `pid`；
   * `ci` 只在球内唯一，所以所有按格查表的入口都必须带星球上下文。
   * 本段是这批改造的**唯一基础设施**：
   *   · `curPid()`      —— 当前经营星球（activePlanet）；
   *   · `pidOf(e)`      —— 实体所属星球（缺省 = 当前星球，老档容错）；
   *   · `sphereOf(pid)` —— 该星球的球面内核（本次/地图球面复用，其余按 seed 懒建并缓存）；
   *   · `FK(ci,pid)`    —— **据点类字典键**（forts / fortsRazed / fortsTaken / fortRaids / sieges）：
   *                        `p<pid>|c<ci>`；老档 `c<ci>` 一律视为**母星 1**。
   * ============================================================ */
  GAME.curPid = function () {
    var s = GAME.state; return (s && s.activePlanet) || 1;
  };
  GAME.pidOf = function (e) {
    if (!e) return GAME.curPid();
    return (e.pid != null) ? e.pid : GAME.curPid();
  };
  GAME._planetById = function (pid) {
    var out = null; GAME.planetsOf().forEach(function (p) { if (p && p.id === pid) out = p; });
    return out;
  };
  GAME._extraSpheres = GAME._extraSpheres || {};
  GAME.sphereOf = function (pid) {
    pid = pid || GAME.curPid();
    if (pid === GAME.curPid() && GAME.sphere) return GAME.sphere;
    if (GAME.mapSphere && GAME.mapPlanetOf && GAME.mapPlanetOf() && GAME.mapPlanetOf().id === pid
      && GAME.mapSphere && GAME.mapSphere.cells) return GAME.mapSphere;
    var sp = GAME._extraSpheres[pid];
    if (sp) return sp;
    var p = GAME._planetById(pid);
    if (!p || !GAME.createSphere) return GAME.sphere;
    sp = GAME.createSphere();
    sp.setPlanet(p.seed, p.params);
    sp.ensure();
    GAME._extraSpheres[pid] = sp;
    return sp;
  };
  GAME.fortKey = function (ci, pid) {
    pid = (pid == null) ? GAME.curPid() : pid;
    return 'p' + pid + '|c' + ci;
  };
  /* 兼容老键：`c<ci>` = 母星 1 的据点。 */
  GAME.fortKeyCi = function (k) {
    var m = /c(\d+)$/.exec(String(k || ''));
    return m ? Number(m[1]) : -1;
  };
  /* 键前缀：`c<ci>` → `p<pid>|c<ci>`（指定星球）。 */
  /* 据点类字典的**兼容读**：新键 `p<pid>|c<ci>`；旧裸键 `c<ci>` 视为当前星球（老档/夹具）。 */
  GAME._fkGet = function (o, ci, pid) {
    if (!o) return undefined;
    pid = (pid == null) ? GAME.curPid() : pid;
    var k = GAME.fortKey(ci, pid), v = o[k];
    if (v === undefined && pid === GAME.curPid()) v = o['c' + ci];
    return v;
  };
  /* 柯里化前缀：`GAME.fk(pid)(k)` —— 把该星球所有 `'c'+ci` 键一次性映射成 `'p<pid>|c'+ci`。
     用法：`var K = GAME.fk(pid); forts[K('c'+ci)]`（替换点只改一处，键格式不散落）。 */
  GAME.fk = function (pid) {
    pid = (pid == null) ? GAME.curPid() : pid;
    return function (k) {
      k = String(k == null ? '' : k);
      if (/^p\d+\|/.test(k)) return k;
      return 'p' + pid + '|' + k;
    };
  };
  /* 老档据点类字典（forts / fortsRazed / fortsTaken / fortRaids）：`c<ci>` → `p1|c<ci>`
     （老档的据点全在母星 1 —— 当时的分片只给玩家城/野地分家，据点表本就在顶层）。 */
  GAME._fortKeyMigrate = function (obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var out = {}, changed = false;
    Object.keys(obj).forEach(function (k) {
      if (/^p\d+\|/.test(k)) { out[k] = obj[k]; return; }
      if (GAME.fortKeyCi(k) < 0) { out[k] = obj[k]; return; }   /* 非格键（如 'c:城id'）原样 */
      changed = true;
      out[GAME.fortKey(GAME.fortKeyCi(k), 1)] = obj[k];
    });
    return changed ? out : obj;
  };
  /* ============================================================
   * v91.74（老板）：「星球不做切片，归一管理」—— **老档一次性合并**。
   * ------------------------------------------------------------
   * 旧结构：s.cities / s.wilds / ... 只是当前星球；mapSlices[pid] 是其余星球（深拷贝）。
   * 新结构：世界数组全局一份、每条带 pid。迁移：
   *   ① 当前星球（activePlanet）用**活态**字段（它们最新）；
   *   ② 其余分片整片并入并打 `pid`；
   *   ③ 据点类字典键 `c<ci>` → `p<pid>|c<ci>`（自动覆盖当前星球的旧键）；
   *   ④ 删 s.mapSlices，标记 `planetWorldMig74`（幂等）。
   * 迁移后 `sliceOf/mapSliceOf` 变成**过滤视图**（不再读写分片）。
   * ============================================================ */
  GAME.migratePlanetWorld74 = function (st) {
    if (!st || st.planetWorldMig74) return false;
    var act = st.activePlanet || 1;
    st.cities = st.cities || []; st.wilds = st.wilds || [];
    st.gathers = st.gathers || []; st.marches = st.marches || []; st.battles = st.battles || [];
    st.queues = st.queues || { build: [], train: [], tech: [] };
    ['build', 'train', 'tech'].forEach(function (k) { st.queues[k] = st.queues[k] || []; });
    st.sieges = st.sieges || {};
    var tagArr = function (arr, pid) {
      (arr || []).forEach(function (e) { if (e && e.pid == null) e.pid = pid; });
    };
    tagArr(st.cities, act); tagArr(st.wilds, act); tagArr(st.gathers, act);
    tagArr(st.marches, act); tagArr(st.battles, act);
    ['build', 'train', 'tech'].forEach(function (k) { tagArr(st.queues[k], act); });
    /* 据点类字典：当前星球的旧键先迁 */
    ['forts', 'fortsRazed', 'fortsTaken', 'fortRaids'].forEach(function (k) {
      if (st[k]) st[k] = GAME._fortKeyMigrate(st[k]);
    });
    /* 其余星球分片并入 */
    var S = st.mapSlices || {};
    Object.keys(S).forEach(function (k) {
      var pid = Number(k);
      if (!S[k] || pid === act) return;
      var sl = S[k];
      (sl.cities || []).forEach(function (c) { if (c) { if (c.pid == null) c.pid = pid; st.cities.push(c); } });
      (sl.wilds || []).forEach(function (w) { if (w) { if (w.pid == null) w.pid = pid; st.wilds.push(w); } });
      (sl.gathers || []).forEach(function (g) { if (g) { if (g.pid == null) g.pid = pid; st.gathers.push(g); } });
      (sl.marches || []).forEach(function (m) { if (m) { if (m.pid == null) m.pid = pid; st.marches.push(m); } });
      (sl.battles || []).forEach(function (b) { if (b) { if (b.pid == null) b.pid = pid; st.battles.push(b); } });
      ['build', 'train', 'tech'].forEach(function (qk) {
        ((sl.queues || {})[qk] || []).forEach(function (q) { if (q) { if (q.pid == null) q.pid = pid; st.queues[qk].push(q); } });
      });
      ['forts', 'fortsRazed', 'fortsTaken', 'fortRaids'].forEach(function (fk) {
        var src = sl[fk]; if (!src || typeof src !== 'object') return;
        st[fk] = st[fk] || {};
        Object.keys(src).forEach(function (kk) { st[fk][GAME.fk(pid)(kk)] = src[kk]; });
      });
      Object.keys(sl.sieges || {}).forEach(function (sk) { st.sieges[GAME.fk(pid)(sk)] = sl.sieges[sk]; });
      /* 奇观探索挂在星球对象上（p.wonderExp），不在此迁 */
    });
    delete st.mapSlices;
    st.planetWorldMig74 = 1;
    return true;
  };

  GAME._savePlanetSlice = function (pid) {
    /* v91.74：分片已退役（世界数据全局一份）—— 保留空实现供旧调用点。 */
    return;
    var s = GAME.state; if (!s) return;
    if (!s.mapSlices) s.mapSlices = {};
    var sl = {};
    GAME.SLICE_KEYS.forEach(function (k) {
      if (k === 'startPos') sl.startPos = U.deep(s.map && s.map.startPos ? s.map.startPos : null);
      else sl[k] = U.deep(s[k]);                          /* v90.87：深拷贝 —— 杜绝片间**共享同一对象**（"城共用"根因）*/
    });
    s.mapSlices[pid] = sl;
  };
  GAME._loadPlanetSlice = function (pid) {
    /* v91.74：分片已退役 —— 保留空实现供旧调用点。 */
    return;
    var s = GAME.state; if (!s) return;
    s.mapSlices = s.mapSlices || {};
    var sl = s.mapSlices[pid];
    if (!sl) {                                             /* 目标星球无分片 = 毛胚：全清（帝国不动）*/
      sl = GAME._blankSlice();
      s.mapSlices[pid] = sl;
    }
    GAME.SLICE_KEYS.forEach(function (k) {
      if (k === 'startPos') return;                        /* 单列处理（在 map 里）*/
      s[k] = U.deep(sl[k]);                                /* v90.87：深拷贝（独立对象，改一片不串另一片）*/
    });
    if (s.map) s.map.startPos = sl.startPos ? U.deep(sl.startPos) : null;
  };
  /* ============================================================
   * v90.97（老板）**球系 ID 从 1 起递增** —— 老档（0 基：老家=0，后续 1/2/3…）整体 +1。
   * 只动「星球号」：planets[].id、mapSlices 键、activePlanet、mapPlanetId。
   * ⚠️ 不改前哨城 id『fp<pid>』—— 它是不透明标识（全仓无人解码其数字部分），
   *    且各城 id 在同档内天然唯一，留着不产生冲突（改它要连带 ~10 处引用，风险大于收益）。
   * 幂等：`_pidRemap1` 标志，只跑一次（无论是否真改）。
   * ============================================================ */
  GAME._planetsRemap = function (st) {
    if (st._pidRemap1) return false;
    st._pidRemap1 = 1;
    st.planets = st.planets || [];
    var has0 = false;
    st.planets.forEach(function (p) { if (p && p.id === 0) has0 = true; });
    if (!has0) return false;                              /* 已是 1 基（新档/已迁）→ 不动 */
    st.planets.forEach(function (p) { if (p && p.id != null) p.id = (p.id | 0) + 1; });
    var S = st.mapSlices || {}, NS = {};
    Object.keys(S).forEach(function (k) { NS[(+k) + 1] = S[k]; });
    st.mapSlices = NS;
    if (st.activePlanet != null) st.activePlanet = (st.activePlanet | 0) + 1;
    if (st.mapPlanetId != null) st.mapPlanetId = (st.mapPlanetId | 0) + 1;
    return true;
  };
  /* v90.97（双球面）：`mapPlanetId` 补字段/校验（缺省 = activePlanet，目标不存在则回落）。 */
  GAME._mapPlanetMigrate = function (st) {
    var ids = {}; (st.planets || []).forEach(function (p) { if (p) ids[p.id] = 1; });
    if (st.mapPlanetId == null || !ids[st.mapPlanetId]) {
      st.mapPlanetId = (st.activePlanet != null && ids[st.activePlanet]) ? st.activePlanet
        : (st.planets && st.planets[0] ? st.planets[0].id : 1);
    }
  };
  /* v90.86/87：星球分片**读档迁移/修复**（幂等）。
     · 首迁（老档无分片）：现有世界状态 = **老家（1 号星球）**。
     · 修复 A：老家(1) 空/无城，但别的星球分片里有城 → 那些城本是老家的，**搬回 1 号**。
     · 修复 B：某非 1 分片与老家**城完全相同**（共用/别名，早期迁移 + 导航所致）→ 清掉非 1 的那份。
     （v90.97：老家号由 0 改为 1，配合「球系 ID 从 1 递增」；`_planetsRemap` 已先跑，老档 0 基也归到 1。） */
  GAME._planetsMigrate84 = function (st) {
    st.mapSlices = st.mapSlices || {};
    st.planets = st.planets || [];
    /* v90.91b：**确保老家（id 1）存在** —— 老档（v90.73 前）无 planets 字段时，
       planetsOf() 空 → addPlanet 从 1 开始编号 → **老家凭空消失**（"初始星球不见了"）。
       此处补一个 id 1 的老家（种子 = 存档地图种子）。 */
    var hasHome = false;
    st.planets.forEach(function (p) { if (p && p.id === 1) hasHome = true; });
    if (!hasHome) {
      st.planets.unshift({ id: 1, name: '老家', seed: (st.map && st.map.seed) || 1,
        params: (GAME.sphere && GAME.sphere.PLANET_DEFAULT) ? U.deep(GAME.sphere.PLANET_DEFAULT) : { seaFrac: 0.45, ridge: 1.5, detail: 0.7, temp: 1.0 } });
    }
    var S = st.mapSlices, keys = Object.keys(S);
    function nCit(k) { return ((S[k] && S[k].cities) || []).length; }
    function keyOf(k) { return ((S[k] && S[k].cities) || []).map(function (c) { return c.id; }).sort().join(','); }
    if (keys.length === 0) { st.activePlanet = 1; GAME._savePlanetSlice(1); return true; }
    var withCities = keys.filter(function (k) { return nCit(k) > 0; });
    /* 修复 A：老家只有 0 座（空）或 1 座且是**落地前哨**（id 以 fp 开头），
       而别的星球城更多 → 那些城本是老家的，搬回 1 号。（精确判据：避免误搬真布局）*/
    var home1 = S['1'] || { cities: [] };
    var isFootholdOnly = home1.cities.length === 1 && /^fp/.test(String(home1.cities[0].id));
    if ((nCit('1') === 0 || isFootholdOnly) && withCities.length > 0) {
      var best = withCities.slice().sort(function (a, b) { return nCit(b) - nCit(a); })[0];
      if (best && best !== '1' && nCit(best) > nCit('1')) {
        S['1'] = U.deep(S[best]); delete S[best];
        st.activePlanet = 1; GAME._loadPlanetSlice(1); return true;
      }
    }
    /* 修复 B：非 1 分片与老家城完全相同 → 是同一批城的副本，清掉 */
    var k0 = keyOf('1'), fixed = false;
    keys.forEach(function (k) {
      if (k === '1' || nCit(k) === 0) return;
      if (k0 && (nCit('1') > 0) && keyOf(k) === k0) { S[k] = GAME._blankSlice(); fixed = true; }
    });
    return fixed;
  };
  /* 空分片（毛胚）*/
  GAME._blankSlice = function () {
    return { cities: [], wilds: [], forts: {}, fortsRazed: {}, fortsTaken: {}, fortRaids: {}, gathers: [],
      marches: [], battles: [], queues: { build: [], train: [], tech: [] }, sieges: {}, mainCityId: null, yieldDay: null, startPos: null };
  };
  /* v90.78：**进入某星球** —— 存旧片/载新片 + 载入种子/规格 + 清派生缓存 + 重投影平面网格。
     skipSlice（v90.89）：读档迁移时用——s 的 cities/slices 刚由迁移链建好，
     **只载目标星球的球面内核 + 重投影网格，不换分片**（否则用 s.mapSlices 覆盖掉刚迁移好的活态）。 */
  GAME.enterPlanet = function (id, skipSlice) {
    var s0 = GAME.state;
    /* v91.74：出生点/开始圈**按星球**保存（归一后 startPos 只有一个字段，切星球要换）。 */
    try {
      var _prevPl = GAME._planetById(s0 && s0.activePlanet || 1);
      if (_prevPl && s0 && s0.map) _prevPl.worldStart = U.deep(s0.map.startPos || null);
    } catch (e0) {}
    var r = GAME.loadPlanet(id);                          /* 载种子/规格 + setPlanet 重建内核 */
    if (!r.ok) return r;
    var s = GAME.state;
    /* v90.97（双球面）：进某城 = 强信号「玩家关心的星球」—— 地图视角随之对齐（默认两球一致，
       回地图时看到的就是这座城市所在的星球）。地图再单独切星球只动 mapPlanetId，不回冲这里。 */
    s.mapPlanetId = id;
    if (GAME.mapSphere && GAME.mapSphere.setPlanet) GAME.mapSphere.setPlanet(r.planet.seed, r.planet.params);
    /* v91.74：世界数据全局一份 —— 切星球**不再换分片**，只是换球面 + 重建地图投影。 */
    if (r.planet && r.planet.worldStart && s.map) s.map.startPos = U.deep(r.planet.worldStart);
    /* v91.86："一步一景"的可感知层 —— 进入星球时报出环境规则与难度档 */
    try {
      var _pe = GAME.planetEnvOf(id);
      if (_pe && _pe.id !== "none" && GAME.log) {
        GAME.log("🪐 " + (r.planet && r.planet.name || ("星球 " + id)) + " · 环境「" + _pe.name + "」：" + _pe.desc, "sys", "planet");
      }
      if (GAME.log && id > 1 && GAME.planetScaleOf) {
        GAME.log("⚠ 本星球守军强度 ×" + GAME.planetScaleOf(id).toFixed(2) + "（星球难度阶梯）", "sys", "planet");
      }
    } catch (eEnv) {}
    s.map.grid = null; s.map.cities = null;               /* 清投影网格 → 重投影 + 重建 NPC 城 */
    GAME.map._fortCand = null; GAME.map._fortLv = null; GAME.map._fortBlocks = null; GAME.map._fortRing = null;
    GAME.map._cntyF = null;   /* 区域场（最近聚落 BFS）随星球失效 */
    GAME.map.generate();
    if (skipSlice) {                                      /* 读档：球面换了即可 */
      if (GAME.ui) { var _c0 = s.cities[0]; GAME.ui._cityId = _c0 ? _c0.id : null; }
      return r;
    }
    if (GAME.attachRes) GAME.attachRes(s);                /* 资源访问器指向当前城 */
    /* v90.84：进入的是**毛胚**星球（该星球还没有城）→ 给一个落地前哨城（否则 currentCity 为 null，无法操作）。
       该星球的 NPC 城/野地/据点/奇观由 seed 自动派生（已在 map.generate + 内核里）。 */
    var _hasHere = (s.cities || []).some(function (c) { return GAME.pidOf(c) === id; });
    if (!_hasHere) GAME.seedFoothold(id, r.planet);
    /* UI 选城指针重指到本星球首城（否则仍指旧星球某城 id → 界面异常）*/
    if (GAME.ui) {
      var _first = (s.cities || []).filter(function (c) { return GAME.pidOf(c) === id; })[0];
      GAME.ui._cityId = _first ? _first.id : null;
    }
    return r;
  };
  /* 毛胚星球落地前哨：在球面找一块平原立城 + 周边几块野地 */
  GAME.seedFoothold = function (pid, planet) {
    var s = GAME.state, SP = GAME.sphere;
    var x = DATA.START_POS.x, y = DATA.START_POS.y;
    if (SP && SP.cells) {
      var found = -1;
      for (var i = 0; i < SP.cells.length; i++) { var c = SP.cells[i]; if (c && c.type === 'plain') { found = i; break; } }
      if (found < 0) for (var j = 0; j < SP.cells.length; j++) { if (SP.cells[j]) { found = j; break; } }
      if (found >= 0) { x = SP.cells[found].x; y = SP.cells[found].y; }
    }
    var city = GAME.makeCity({
      id: 'fp' + pid, name: (planet && planet.name ? planet.name : '星球') + '·前哨', x: x, y: y, type: 'self',
      initialExt: 'new', res: DATA.NEW_CITY_RES || DATA.INITIAL_RES, pid: pid,
    });
    s.cities = s.cities || [];
    s.cities.push(city);
    if (!s.mainCityId || !GAME.cityById(s.mainCityId)) s.mainCityId = city.id;
    if (s.map) s.map.startPos = { x: x, y: y };
    if (planet) planet.worldStart = { x: x, y: y };       /* v91.74：随星球保存开始圈 */
    GAME.log('🪐 登陆「' + (planet && planet.name) + '」—— 落地前哨「' + city.name + '」已建立，四周待拓。', 'sys', 'admin');
  };

  /* ---------------- 读档 ---------------- */

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

  /* 初始英雄（资质随机；四维按资质区间 roll 后叠加倾向系数） */
  /* ------------------------------------------------------------
   * 英雄 id 自增序号（v14.1 修复撞号）
   * 症状：读档后新招募的英雄与存档内旧将 **id 相同**（页面刚加载 _genSeq 为 0，
   *       第一个新将必得 g1，而存档里已有 g1），于是
   *       `s.generals.forEach(x => if(x.id===genId) g=x)` 会取到**最后一个**同号者，
   *       表现为「点第一个英雄，操作到的却是后面那一个」。
   * 对策：① 读档/新游戏后按存档内最大号续号；② 发号时暴力避让已用 id。
   * ------------------------------------------------------------ */
  GAME.syncSeq = function () {
    var s = GAME.state, max = 0;
    function scan(id) {
      var m = /^g(\d+)$/.exec(id || '') || /^cd(\d+)$/.exec(id || '');
      if (m) max = Math.max(max, Number(m[1]));
    }
    /* v89.209（v89.208 评估缺陷链 ③）：`|| []` 只兜 null/undefined，兜不住"非数组真值"
       （generals:'oops' → .forEach is not a function）——一律 Array.isArray 归位；
       元素防 null（scan 会取 g.id，null 元素同样炸）。 */
    (Array.isArray(s && s.generals) ? s.generals : []).forEach(function (g) { if (g) scan(g.id); });
    /* v89.108：候选池改为**按城独立**（s.inn.byCity[cityId].candidates）——
       两种结构都要扫：新结构逐城，老档（全局池）也要认。 */
    var _pool108 = (s && s.inn && s.inn.byCity) || {};
    Object.keys(_pool108).forEach(function (cid) {
      (((_pool108[cid] || {}).candidates) || []).forEach(function (c) { scan(c.id); });
    });
    ((s && s.inn && Array.isArray(s.inn.candidates) && s.inn.candidates) || [])
      .forEach(function (c) { scan(c.id); });
    GAME._genSeq = Math.max(GAME._genSeq || 0, max);
    GAME._cndSeq = Math.max(GAME._cndSeq || 0, max);
    return max;
  };
  /* 取下一个不与现有英雄冲突的 id */
  GAME.nextGenId = function () {
    var s = GAME.state, used = {};
    /* v89.209（v89.208 评估缺陷链 ③）：同 syncSeq —— Array.isArray 归位（保发号器不崩）。 */
    (Array.isArray(s && s.generals) ? s.generals : []).forEach(function (g) { if (g && g.id) used[g.id] = true; });
    var id, guard = 0;
    do { id = 'g' + (GAME._genSeq = (GAME._genSeq || 0) + 1); } while (used[id] && ++guard < 10000);
    return id;
  };

  GAME.makeGeneral = function (name, level, status, cityId, isStarter, rankId, styleId, rand) {
    var b = DATA.GEN_BASE;
    var rk = DATA.GEN_RANK_BY_ID[rankId] || DATA.GEN_RANK_BY_ID.liang;
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === styleId) st = x; });
    if (!st) st = DATA.GEN_STYLES[0];
    /* v89.129：`rand` 可作第 8 参传入**确定性流**（据点守将等"派生型 NPC"用 ——
       同一目标每次读到同一个人，侦查看到的 == 打起来遇到的）；
       不传则保持原行为（时间戳 + 随机）。 */
    rand = rand || U.rng((U.now() + (GAME._genSeq || 0) * 977 + Math.floor(Math.random() * 1e7)) >>> 0);
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
   * 君主英雄（v70 · 老板）—— 唯一出口
   * ------------------------------------------------------------
   * 老板原话：「增加一个角色英雄（即玩家角色本身，具有英雄的所有功能，
   *   但是不可解雇，留可扩张框架，后续将设计普通英雄不具备的功能）」
   *
   * 口径：
   *   · 君主**就是一名英雄**（进 `state.generals`，装备 / 出征 / 守将 / 派遣 /
   *     经验……全部功能照用），靠 `isLord` 一位区分；
   *   · 不可解雇（`GAME.dismissGeneral` 守卫）+ 不会因忠诚离去（两处离职判定守卫）；
   *   · 头像 seed 与顶栏君主头像**同源**（`ruler.portraitSeed`）——
   *     各摇一次就是两张脸，正是"创建界面头像与英雄不一致"那一类问题的根因；
   *   · 君主**专属功能**的扩张点是 `DATA.LORD_TRAITS`（档案里渲染成「君主特权」）。
   * ============================================================ */
  GAME.isLordGeneral = function (g) { return !!(g && g.isLord); };
  /* v89（老板：「只有君主将有改造功能，以及相应装备」）——
     基因强化资格**唯一闸门**：辐能装备 / 调校 / 荒野行动全链只认君主一人
     （对应战技文档 0.1「主角单修」）。全站判断一律走这里，日后要放开只改这一处。 */
  GAME.canCultivate = function (g) { return GAME.isLordGeneral(g); };
  /* 当前君主英雄（无则 null —— 所有调用点都必须能接受 null） */
  GAME.lordGeneralOf = function () {
    var s = GAME.state, hit = null;
    ((s && s.generals) || []).forEach(function (g) { if (!hit && GAME.isLordGeneral(g)) hit = g; });
    return hit;
  };
  /* 君主专属能力清单（框架出口）：普通英雄返回空数组 —— 界面据此整块不渲染 */
  GAME.lordTraitsOf = function (g) {
    return GAME.isLordGeneral(g) ? (DATA.LORD_TRAITS || []) : [];
  };
  /* ============================================================
   * 出生坐标（v70 · 老板需求 5）—— 唯一出口
   * ------------------------------------------------------------
   * 老板：「城市归属应归属到首府所辖范围内，目前几个选项不太 OK」
   * 口径：选了某个区 → 出生城落在**该区首府近旁**的确定性环带（半径 3~8 格），
   *   并要求 `GAME.stateOfCity(落点)` 就是该区 —— "所辖范围"与就近认领是**同一判据**，
   *   不另画一套边界（画了就是第二个出口）。
   *   烬环无首府 → 锚点取旧都灰烬城（与 stateOfCity 的口径一致）。
   * 约束：不压任何系统城（±2 缓冲）、不越界；由 (区名, 种子) 确定性生成 —— 同种子同落点。
   * ============================================================ */
  GAME.pickStartPos = function (stateName, seed) {
    var states = DATA.START_STATES || [];
    var rand = U.rng((Math.round(seed) || 1) >>> 0);
    var name = String(stateName == null ? '' : stateName);
    if (name !== 'random' && states.indexOf(name) < 0) name = 'random';
    if (name === 'random') name = states[Math.floor(rand() * states.length)] || '烬环';
    var anchor = null;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (anchor) return;
      if (c.type === 'zhou' && c.state === name) anchor = c;
      if (!anchor && name === '烬环' && c.type === 'capital') anchor = c;
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
    /* v89.65（老板「君主练功然后突破」）：突破次数随身携带。
       老档读不到即视为 0（读出口一律 `g.breaks || 0`），**不需要迁移脚本**。
       ⛔ v90.94：修为字段（原修为积累）随练功-突破解耦退役 —— 不再写出（老档有值亦无害）。 */
    g.breaks = 0;
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

  /* 生成历史英雄（野地抓将/占领名城必降） */
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
    /* v22：史实英雄挂上专属 AI 头像的 key（文件缺失时自动回退立绘） */
    if (GAME.portraits) GAME.portraits.assign(g);
    return g;
  };

  /* 史实英雄的资质：按四维总和判定 */
  GAME.heroRank = function (sum) {
    var line = DATA.HERO_RANK_LINE || [];
    for (var i = 0; i < line.length; i++) if (sum >= line[i].min) return DATA.GEN_RANK_BY_ID[line[i].id];
    return DATA.GEN_RANKS[0];
  };

  /* 取英雄资质定义（旧档无 rank 字段则按四维自动补判并写回） */
  GAME.rankOf = function (g) {
    if (!g) return DATA.GEN_RANKS[0];
    if (g.rank && DATA.GEN_RANK_BY_ID[g.rank]) {
      /* v74：自由属性点的懒初始化必须**两条路径都走到** ——
         makeGeneral 一造出来就写好 rank，走的是这条提前返回；
         漏了这里，所有"旧档/已生成"的英雄永远拿不到补发。 */
      var rkE = DATA.GEN_RANK_BY_ID[g.rank];
      if (g.freePts == null) {
        g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rkE.grow || 1);
      }
      /* v89.195（老板 3）：攻防"取整抹平"的历史欠账**按已过等级补发**（与 freePts 同法、
         同位置、两条路径都走）——只补不削；atkAcc 置 0 兼作"已处理"标记（幂等：新将
         Lv1 的补发值 = base 10，不动）。排除守将（g.npcGuard / g.wild：不升级、攻防由
         guardFillOf 按折损档定值 —— 此处若补会把折损顶穿）。 */
      if (g.atkAcc == null && !g.npcGuard && !g.wild) {
        g.atkAcc = 0;
        var _gb195r = DATA.GEN_BASE || { attack: 10, defense: 10 };
        var _std195r = Math.round((_gb195r.attack || 10) + Math.max(0, ((g.level || 1) - 1)) * 0.4 * (rkE.grow || 1));
        if ((g.attack || 0) < _std195r) g.attack = _std195r;
        if ((g.defense || 0) < _std195r) g.defense = _std195r;
      }
      return rkE;
    }
    var sum = (g.tong || 0) + (g.yw || 0) + (g.zm || 0) + (g.nz || 0);
    var rk = g.hero ? GAME.heroRank(sum) : (function () {
      /* 征召大厅旧档：按四维均值反推最接近的资质 */
      var avg = sum / 4, best = DATA.GEN_RANKS[0];
      DATA.GEN_RANKS.forEach(function (r) {
        if (avg >= (r.base[0] + r.base[1]) / 2 - 4) best = r;
      });
      return best;
    })();
    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    /* v74（老板需求 5）：自由属性点字段的懒初始化（一次性）——
       旧档英雄**按已过等级补发**：每级 = 该资质成长值（与 applyLevelGrowth 同口径）。
       标记方式就是字段本身（null = 还没初始化过；之后每升一级 += 成长值）。 */
    if (g.freePts == null) {
      g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rk.grow || 1);
    }
    /* v89.195（老板 3）：攻防欠账补发（与上方 freePts 同法；理由与排除面见提前返回路径注释）。 */
    if (g.atkAcc == null && !g.npcGuard && !g.wild) {
      g.atkAcc = 0;
      var _gb195q = DATA.GEN_BASE || { attack: 10, defense: 10 };
      var _std195q = Math.round((_gb195q.attack || 10) + Math.max(0, ((g.level || 1) - 1)) * 0.4 * (rk.grow || 1));
      if ((g.attack || 0) < _std195q) g.attack = _std195q;
      if ((g.defense || 0) < _std195q) g.defense = _std195q;
    }
    return rk;
  };

  /* 资质血清（v73 · 基因实验室产物；v89.224 更名）：把英雄的资质**升一档**。
     血清与档位**一一对应**（凡人→突变体 激活血清 / 突变体→进化体 蜕变血清 /
     进化体→觉醒体 觉醒血清 / 觉醒体→天启体 天启血清，见 DATA.ITEMS 的 rank_up 型）。只改 rank 字段 ——
     等级上限与每级成长都走 rankOf，改完自动生效（不需要动等级）。 */
  GAME.rankUpUse = function (g, item) {
    var cur = GAME.rankOf(g);
    if (cur.id === item.to) return { ok: false, msg: g.name + ' 已是「' + cur.name + '」，无需此物' };
    if (cur.id !== item.from) {
      var fr = DATA.GEN_RANK_BY_ID[item.from] || {};
      return {
        ok: false,
        msg: '「' + item.name + '」只可用于「' + (fr.name || '?') + '」英雄（' + g.name + ' 现为「' + cur.name + '」）',
      };
    }
    /* v89.95（A1）：**顶档（天启体）须节钺** —— 节钺只能打（首占名城）或威望赏赐，
       旧币买不到。于是"全链 54 万旧币打通资质"这条闭环被掐断：
       有钱也得到战场上去挣那枚符（老板第 1 问的"发展限制器"）。 */
    if (item.to === ((DATA.JIEYUE || {}).tianshouTo || 'tian')) {   /* ⚠️ 档位 id 是 'tian'（不是 'tianshou'）——
        写错的那版门槛**空转**（实测被第 98 节断言抓出），所以这里从配置读，不许再写死 */
      var _hfC = (DATA.JIEYUE || {}).tianshouCost || 1;
      var _sp = GAME.jieyueSpend ? GAME.jieyueSpend(_hfC, '问鼎天启体 · ' + g.name) : { ok: false, msg: '节钺系统不可用' };
      if (!_sp.ok) return _sp;
    }
    g.rank = item.to;
    var nr = DATA.GEN_RANK_BY_ID[item.to] || {};
    /* v89.196（老板 1-1）：「按相应高资质补全**等级相关的六维**和自由属性点」——
       把 v89.179c 的"补地板"（只到 base[0]）升级为**按等级重演**：
       升档后四维应达到"若从一开始就是新资质、练到当前等级"的水平：
         target[d] = 新档基础(base[0]) × 风格系数 + (等级−1) × 新成长 × 系数 × (4/Σm)
       （与升级链 applyLevelGrowth 同一成长式；只补不削。
         老板本轮的定义：基础属性 = "基于资质、0 级也存在"（= base[0]）；
         每级固定增长 = grow；风格偏科由风格系数保留。） */
    var baseFloor = (nr.base && nr.base[0]) || 0;
    var _lv196 = Math.max(1, g.level || 1);
    var _st196 = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) _st196 = x; });
    var _m196 = (_st196 && _st196.mul) || { tong: 1, nz: 1, yw: 1, zm: 1 };
    var _msum196 = (_m196.tong + _m196.nz + _m196.yw + _m196.zm) || 4;
    var _f196 = 4 / _msum196;
    var _up196 = _lv196 - 1;
    var filled = 0;
    if (baseFloor > 0) {
      var _ks = ['tong', 'yw', 'zm', 'nz'];
      for (var _ki = 0; _ki < _ks.length; _ki++) {
        var _d196 = _ks[_ki];
        var _t196 = Math.round(baseFloor * (_m196[_d196] || 1)
          + _up196 * (nr.grow || 1) * (_m196[_d196] || 1) * _f196);
        if ((g[_d196] || 0) < _t196) { g[_d196] = _t196; filled++; }
      }
    }
    /* v78（老板需求 2 · 隐藏设定）：「英雄低资质通过活性血清等提升资质时，能比直接招募
       获得额外提升」—— 血清调试过的根基更实：每次升档，四维各 +新档 ascend。
       数值见 DATA.GEN_RANKS[].ascend（突变体2 / 进化体3 / 觉醒体5 / 天启体8，全链 +18/维）。
       v89.179c（老板 3 ③）：这项"额外属性奖励"由隐藏改为**晋升时显式告知** ——
       老板要它承担"鼓励玩家耗时养成"的作用，看不见的奖励起不到激励。
       计数落 g.ascend（随存档走，供统计与将来展示）。 */
    var asc78 = nr.ascend || 0;
    if (asc78 > 0) {
      g.tong = (g.tong || 0) + asc78;
      g.yw = (g.yw || 0) + asc78;
      g.zm = (g.zm || 0) + asc78;
      g.nz = (g.nz || 0) + asc78;
      g.ascend = (g.ascend || 0) + 1;
    }
    /* v89.179c（老板 3 ②）：**补全自由属性点** —— 晋升一次性发放 lump，
       数值见 DATA.RANKUP_FREE_PTS（老板拍板"更慷慨"：良25 / 英60 / 名140 / 天280）。
       自由点必须靠玩家逐点分配才吃得满 → 自然驱动"耗时升级"这条养成线。
       freePts 的懒初始化由上方 GAME.rankOf(g) 保证（与升级补发同口径）。 */
    var freeLump = (DATA.RANKUP_FREE_PTS || {})[item.to] || 0;
    if (freeLump > 0) g.freePts = (g.freePts || 0) + freeLump;
    /* v89.196（老板 1-1 后半）：**自由属性点的等级差补** —— "按相应高资质补全
       **等级相关**的……自由属性点"：历史每级按旧资质的成长值发放（applyLevelGrowth /
       rankOf 懒补），升档后按新资质补差额：
         Δ = (等级−1) × (新成长 − 旧成长)（只补正差；升档只升，负差不存在）。 */
    var _pt196 = Math.max(0, (Math.max(1, g.level || 1) - 1) * ((nr.grow || 1) - (cur.grow || 1)));
    if (_pt196 > 0) g.freePts = (g.freePts || 0) + _pt196;
    /* v89.196（老板 1-2）：「作为提升资质的奖励，额外再给予一定的属性数值奖励」——
       数值见 DATA.RANKUP_AWARD（按目标档：良 100 / 英 200 / 名 400 / 天 800）。
       发放：四维各 +N + 体力上限 +N（staAdd）；速度不参与（表注有理由）。 */
    var _aw196 = ((DATA.RANKUP_AWARD || {})[item.to]) || 0;
    if (_aw196 > 0) {
      g.tong = (g.tong || 0) + _aw196;
      g.yw = (g.yw || 0) + _aw196;
      g.zm = (g.zm || 0) + _aw196;
      g.nz = (g.nz || 0) + _aw196;
      g.staAdd = (g.staAdd || 0) + _aw196;
    }
    /* v89.195（老板 3）：「为英雄资质补全属性」——**攻防也补**。
       攻防成长受资质影响（每级 0.4×成长值，见 applyLevelGrowth），但升档从不动它 ——
       "凡人练上来的将"升到高资质后，攻防仍停在旧档的累积水平（实测 Lv60 凡人
       升到觉醒体：攻防 10，而直接招募的觉醒体 ~208+）——与四维"不低于地板"的
       补全精神不一致。口径：**补足到"全程按新资质成长"的标准线**，只补不削：
       标准线 = GEN_BASE.attack + (等级−1) × 0.4 × 新成长值。 */
    var _lv195 = Math.max(1, g.level || 1);
    var _gb195 = DATA.GEN_BASE || { attack: 10, defense: 10 };
    var _std195 = Math.round((_gb195.attack || 10) + (_lv195 - 1) * 0.4 * (nr.grow || 1));
    var _dAtk195 = Math.max(0, _std195 - (g.attack || 0));
    var _dDef195 = Math.max(0, _std195 - (g.defense || 0));
    if (_dAtk195 > 0) g.attack = _std195;
    if (_dDef195 > 0) g.defense = _std195;
    /* 晋升所见即所得：固定属性 / 淬炼奖励 / 自由点 / 攻防 四项逐一列出 */
    var extra = [];
    if (filled > 0) extra.push('四维补足至「' + (nr.name || item.to) + '」Lv' + _lv196 + ' 标准');
    if (asc78 > 0) extra.push('四维 +' + asc78 + '（血清调试）');
    if (_pt196 > 0) extra.push('自由属性点 +' + _pt196 + '（等级差补）');
    if (freeLump > 0) extra.push('自由属性点 +' + freeLump);
    if (_aw196 > 0) extra.push('资质奖励：四维各 +' + _aw196 + ' · 体力上限 +' + _aw196);
    if (_dAtk195 > 0 || _dDef195 > 0) {
      extra.push('攻防补足至「' + (nr.name || item.to) + '」Lv' + _lv195 + ' 标准（攻 +' + _dAtk195 + ' · 防 +' + _dDef195 + '）');
    }
    return {
      ok: true,
      msg: '🧬 ' + g.name + ' 资质提升：' + cur.name + ' → ' + (nr.name || item.to) + '（' + item.name + '）'
        /* ⚠️ 用全角分隔符、不用 <br>：本 msg 会经 ui.notify → U.escape 后塞进 innerHTML，
           HTML 标签会被转义成字面量（v89.179c 实测口径：提示一律走纯文本）。 */
        + (extra.length ? '　' + extra.join('　·　') : ''),
    };
  };

  /* 资质随征召大厅等级的出现权重（高级征召大厅更容易出高资质） */
  GAME.rankWeights = function (innLv) {
    var lv = Math.max(1, innLv || 1);
    var out = [];
    DATA.GEN_RANKS.forEach(function (r) {
      /* v66：下限从**写死的 0.5** 改成**按自身基准的 5%**。
         原因：老板要求天启体出现率降 10 倍（w 2 → 0.2），而 0.5 这道下限会把 0.2
         直接抬回 0.5 —— 表里改了、界面上没变，属于"改了等于没改"的静默失效。
         下限本身仍要保留：凡人 wg 为负（-0.06），征召大厅 18 级以上会算成负权重。
         现在：凡人最低 2.5、天启体最低 0.01，两边都不再被误伤。 */
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
  /* v89.73（老板：「征召大厅不能再直接招募觉醒体、天启体级别英雄，只能通过资质提升达到」）
     ------------------------------------------------------------
     征召大厅候选的**资质上限** —— 唯一出口。
       · 凡人 / 突变体 / 进化体 可以出；觉醒体 / 天启体**只能靠血清升档**（GAME.rankUpUse）。
     为什么用"截断"而不是"把权重改成 0"：`rankWeights` 还服务着别的入口
     （基因实验室、史实英雄等），动表会把它们一起封死；截断只作用于征召大厅这条链。
     两条候选链都要过这里：普通掷档（pickRank）与史实英雄直取（heroRank）——
     漏掉后者的后果是"关羽照样带着天启体从征召大厅走出来"，等于没改。 */
  GAME.INN_RANK_CAP = 'ying';
  GAME.innCapRank = function (rk) {
    if (!rk) return rk;
    var capId = GAME.INN_RANK_CAP;
    if (GAME.rankIndex(rk.id) <= GAME.rankIndex(capId)) return rk;
    return DATA.GEN_RANK_BY_ID[capId] || rk;
  };
  GAME.pickStyle = function (rank) {
    if (!rank || rank.id === 'fan') return DATA.GEN_STYLES[0];
    var list = DATA.GEN_STYLES, total = 0;
    list.forEach(function (x) { total += x.w; });
    var roll = Math.random() * total;
    for (var i = 0; i < list.length; i++) { roll -= list[i].w; if (roll <= 0) return list[i]; }
    return list[0];
  };

  /* 英雄成长：资质决定每级增加的点数（差异化核心） */
  GAME.applyLevelGrowth = function (g) {
    var rk = GAME.rankOf(g);
    var step = rk.grow || 1;
    /* v74（老板需求 5）：「不同类型（均衡 / 猛将等）英雄，升级自动加点不同。
       根据资质，每级除了其成长之外，还有等于成长值的自由属性点」。
       · 自动加点 = step × 类型权重 —— 权重**复用 DATA.GEN_STYLES 的 mul**
         （造人时那套特性表，不再另造一份；归一化到总和 4，
          均衡 1/1/1/1 与旧行为逐点一致，老档只受影响于新涨的等级）；
       · 自由属性点 = step —— 玩家在六维表逐点分配（唯一出口 GAME.addFreePoint）。 */
    /* ============================================================
     * v91.55（老板）：「同专长的将领升级到最后属性基本一模一样，缺少多样性。
     *   建议：**指挥、体力**维持每级 +8；其余 3 维共 **24 点随机分配**，参考专长
     *   （猛将 → 武力 50% / 谋略 30% / 治理 20%，其他专长同理）」。
     * ------------------------------------------------------------
     * · 指挥（tong）仍 = step（= 资质成长，天启体 8 / 凡人 1）；体力（sta）仍走
     *   `staBaseMax` 的**资质成长曲线**（不另加 = "体力 +8" 的既有口径）。
     * · **武力 / 谋略 / 治理**：每级总量 = step × 4（天启体 32、凡人 4 = 与"3 维 ×8"
     *   的总量一致），**按专长概率随机分配**（同专长不同次也不同 → 多样性）。
     *   概率 = 该专长 `mul` 在这 3 维上的归一化占比（猛将 1.45/0.68/0.60 → 权 0.53/0.25/0.22，
     *   接近老板举例的 50/30/20；无写死表、随数据类型同源）。
     * ============================================================ */
    var st74 = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st74 = x; });
    var m74 = (st74 && st74.mul) || { tong: 1, nz: 1, yw: 1, zm: 1 };
    g.tong += step;                                   /* 指挥：每级 = 成长（维持） */
    /* 3 维随机分配：总量 = step×4，按专长概率逐点掷——多样性与专长兼得。 */
    var _pool = step * 4;
    var _wy = m74.yw || 1, _wz = m74.zm || 1, _wn = m74.nz || 1, _wsum = _wy + _wz + _wn || 3;
    var _add = { yw: 0, zm: 0, nz: 0 };
    for (var _p = 0; _p < _pool; _p++) {
      var _r = Math.random() * _wsum;
      if (_r < _wy) _add.yw++; else if (_r < _wy + _wz) _add.zm++; else _add.nz++;
    }
    g.yw += _add.yw; g.zm += _add.zm; g.nz += _add.nz;
    /* freePts 与界面读数取整（3 维已按整数点分配；tong 为浮点，f74 时代那套 4/sum 已退役） */
    g.freePts = (g.freePts == null ? 0 : g.freePts) + step;
    /* v89.95（B2）：速度**不再随级 +1**，改为每 SPD_CAP.perLevels 级 +1（见 genAttrs 的和式）。
       这里只累一个"已满几档"的计数（spdGrow）—— 派生式成长让老档免迁移。 */
    var _spc = (DATA.SPD_CAP || {}).perLevels || 5;
    g.spdLvAcc = (g.spdLvAcc || 0) + 1;
    if (g.spdLvAcc >= _spc) {
      g.spdLvAcc -= _spc;
      g.spdGrow = (g.spdGrow || 0) + 1;
    }
    /* v89.195（老板 3）：「为英雄资质补全属性」——攻防成长**取整抹平**修复：
       旧写法 `Math.round(g.attack + step*0.4)` 每级都把小数回吞 —— 凡人（0.4/级）
       永远 +0（实测 Lv100 攻防仍 10）、突变体 0.8 与进化体 1.2 被双双抹成 +1/级
       （"资质决定成长"在攻防这条链上名存实亡）。
       改为**小数累积器**：每级入账 step×0.4，整点入账、余数留池（实测长期均值
       = 0.4×成长值：凡 0.4 / 良 0.8 / 英 1.2 / 名 2.0 / 天 3.2）。
       atkAcc/defAcc 随档序列化；老档缺省 0（不追溯历史，只影响未来升级 ——
       升档补齐由 GAME.rankUpUse 负责）。 */
    g.atkAcc = (g.atkAcc || 0) + step * 0.4;
    var atkTake = Math.floor(g.atkAcc);
    if (atkTake > 0) { g.attack += atkTake; g.atkAcc -= atkTake; }
    g.defAcc = (g.defAcc || 0) + step * 0.4;
    var defTake = Math.floor(g.defAcc);
    if (defTake > 0) { g.defense += defTake; g.defAcc -= defTake; }
    /* v29（需求 11）：**不再写 g.hp**。
       等级血量原本走 `g.hp += step*12`，再被 battle.hpMultOf 当"装备生命"折算成
       全军生命加成 —— 一路算下来，真正决定生命的是等级，装备只是搭便车。
       现在生命**只由「体力」承担**（GAME.staMax = 等级/资质/治理 + 装备与套装体力），
       v66 起装备体力也并进这条链，battle 里不再有并行的第二条加成。
       注意：旧存档里已经涨上去的 g.hp 保留不清零，等于一份历史加成，
       不会再涨，也不会凭空消失。 */
    return step;
  };


  /* 自由属性点分配（v74 · 老板需求 5 · **唯一出口**）：
     ⚠️ v91.27（老板）：「自由属性点**不能加**速度/体力 —— 这两个的加号按钮**只能用道具临时**改变属性」。
     故本出口只收**四维**（指挥/治理/武力/谋略）；速度/体力 → 拒绝（改走临时道具）。
     只能加、不能减。 */
  GAME.addFreePoint = function (g, stat, qty) {
    if (!g || ['tong', 'nz', 'yw', 'zm'].indexOf(stat) < 0) {
      return { ok: false, msg: (stat === 'spd' || stat === 'sta')
        ? '速度 / 体力不能用自由属性点加 —— 只能用道具临时提升'
        : '该属性不支持加点' };
    }
    var have = Math.floor(g.freePts || 0);
    if (have < 1) {
      return { ok: false, msg: '自由属性点不足（升级获得：每级 = 资质成长值）' };
    }
    var n = Math.floor(Number(qty) || 0);
    if (n < 1) n = 1;
    if (n > have) n = have;
    g.freePts -= n;
    var nm = { tong: '指挥', nz: '治理', yw: '武力', zm: '谋略', spd: '速度', sta: '体力' }[stat];
    g[stat] = (g[stat] || 0) + n;
    GAME.log('🎯 ' + g.name + ' ' + nm + ' +' + n + '（自由点 -' + n + '，余 ' + g.freePts + '）');
    return { ok: true, msg: g.name + ' ' + nm + ' +' + n + '（余 ' + g.freePts + ' 点）' };
  };

  /* 生成 NPC 城。v90.97：加 sphere 形参（默认逻辑球面）—— 地图星球的 NPC 城须按其球面算 ci。 */
  GAME.buildNpcCities = function (seed, sphere) {
    var SP = sphere || GAME.sphere;
    return U.deep(DATA.NPC_CITIES).map(function (c) {
      c.owner = 'npc';
      c.garrison = GAME.genGarrison(c);
      c.maxArmy = c.garrison;
      /* v90.70：附上球面六边格索引（标记直接落格，免 (x,y)→dir 往返）*/
      c.ci = (SP && SP.ciOfXY) ? SP.ciOfXY(c.x, c.y) : -1;
      return c;
    });
  };

  /* ============================================================
   * 城等级 —— 唯一出口 `GAME.cityLvOf`（v89.79 · 老板拍板）
   * ------------------------------------------------------------
   * 老板原话：「为什么有个城等级是 Lv7，城等级不是跟随政务厅等级吗？」
   * 定稿：**城等级 = 政务厅等级 = 建筑等级**，一号到底。
   *   · 名城（聚落/重镇/首府/旧都）→ 档位等级：12 / 16 / 20 / 24
   *     （= MAX_BLEVEL 12 + 档位加成 0/4/8/12，与 `buildCapOf` 同一把尺子；
   *       名城是"满配城"，政务厅自建起即满配，所以城等级就是政务厅等级）
   *   · 自建城（self）  → **政务厅等级**（跟随政务厅 —— 正是老板那句话的字面口径）
   *   · 野外据点（fort）→ 自身等级（1~10，随现实日变化；它本来就不是名城）
   *
   * ⚠️ 界面 / 派生 / 筛选**一律读这里**，不许再直接读 `city.level`：
   *    名城的 level 字段与档位值保持同步（生成时写入），但老档里可能是
   *    v89.72~v89.78 那套 1~10 的旧分布值 —— 读字段就会读出两种城等级。
   * ============================================================ */
  GAME.cityLvOf = function (city) {
    if (!city) return 1;
    var T = DATA.NPC_TIER_LV || {};
    if (city.type && T[city.type] != null) return T[city.type];        /* 名城：档位等级 */
    if (city.type === 'self') {                                        /* 自建城：跟随政务厅 */
      return Math.max(1, GAME.buildingLevel(city, 'guanfu') || city.level || 1);
    }
    return Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(city.level) || 1));
  };

  /* 名城守军的**档位基准**（v89.79）—— 唯一出口。
     ⛔ 退役：`守军 = 据点守军(50×1.95^(城等级-1)) × 档位倍数` 这条乘法链 ——
     城等级曾是 1~10 的分布，而据点守军是**指数**，同级城因此差 7 倍以上。
     ✅ 现在：按档位直接给基准值（老板 v89.74 亲定的目标值）。 */
  GAME.npcGarrisonBaseOf = function (c) {
    var by = (DATA.NPC_CITY_RES && DATA.NPC_CITY_RES.garrisonByTier) || {};
    var ty = c && c.type;
    if (ty && by[ty] != null) return by[ty];
    return 0;                       /* 非名城：不走这条（野外据点用自己的 fortGarrison） */
  };
  /* v91.10（老板 8）：名城守军**兵种构成随周围地形** —— 采样该城周围 ~30 格地块地形分布，
     按 DATA.NPC_CITY_RES.garrisonTerrain 的每地形偏好对兵种权重取**几何平均倍率**
     （同基构成 → 地形放大）。地形走球面地块（星球原生、与老家同框架）；无地形信息（老档/无球面）
     则返回中性全 1（不破坏既有生成，幂等）。 */
  GAME.garrisonTerrainMul = function (c) {
    var mul = {};
    var T = (DATA.NPC_CITY_RES && DATA.NPC_CITY_RES.garrisonTerrain) || null;
    if (!c || !T || !GAME.sphere || !GAME.sphere.terrainAt || !GAME.sphere.hopsWithin || !GAME.sphere.ciOfXY) return mul;
    var ci0 = GAME.sphere.ciOfXY(c.x, c.y);
    if (ci0 == null || ci0 < 0) return mul;
    var cells = GAME.sphere.cells || [];
    var ring = GAME.sphere.hopsWithin(ci0, 3) || [];   /* 3 环 ≈ 30 格 */
    /* 地形**占比**加权偏好：mul[tid] = Σ_terrain frac_t × pref_t[tid]（线性，强度足）。
       比"几何平均"更能体现"山地占八成 → 重甲显著多"。 */
    var frac = {}, nTot = 0;
    ring.forEach(function (ci) { var cell = cells[ci]; if (cell && cell.type) { frac[cell.type] = (frac[cell.type] || 0) + 1; nTot++; } });
    if (!nTot) return mul;
    Object.keys(frac).forEach(function (ty) {
      var prefs = T[ty]; if (!prefs) return;
      var f = frac[ty] / nTot;
      Object.keys(prefs).forEach(function (tid) { (mul[tid] = mul[tid] || 0); mul[tid] += f * prefs[tid]; });
    });
    return mul;
  };
  GAME.genGarrison = function (c) {
    var base = GAME.npcGarrisonBaseOf(c);
    if (!base) return {};
    var mix = (DATA.NPC_CITY_RES && DATA.NPC_CITY_RES.garrisonMix) || [];
    /* 同类城只差 **±8%**（确定性哈希，同一座城每次生成完全一致）——
       老板要的"同级城守军不能差这么多"。波动只作用于**总数**，
       兵种按权重同比例分，所以同档城的兵种构成完全一致。 */
    var rng = U.rng(GAME.npcHash(c.id, 0x2b17));
    var want = Math.round(base * (0.92 + rng() * 0.16));
    /* v91.10：地形偏好倍率（同星球/老家同框架）；缺则全 1。 */
    var tmul = GAME.garrisonTerrainMul(c);
    var use = mix.filter(function (m) { return DATA.TROOPS[m.id]; });
    var wSum = use.reduce(function (a, m) { return a + m.w * (tmul[m.id] || 1); }, 0) || 1;
    var g = {}, placed = 0;
    use.forEach(function (m, i) {
      /* 最后一种吃余额，保证"分完之后总数**恰好**等于 want" ——
         逐个 round 会漂几个兵，那种误差在"守军总数"这种口径上是说不清的。 */
      var w = m.w * (tmul[m.id] || 1);
      var cnt = (i === use.length - 1) ? (want - placed) : Math.round(want * w / wSum);
      if (cnt > 0) { g[m.id] = cnt; placed += cnt; }
    });
    return g;
  };

  /* ============================================================
   * 名城档位优势（v60 · 需求 5）
   * ------------------------------------------------------------
   * 「名城专有的资源、优势，或者选项」里的**优势**这一层：
   * 按城档位（旧都/首府/重镇/聚落/自建）给本城经营加成。
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
   * v79 加成四层（威望 / 主城 / 神器 + 名城档位）—— **唯一汇总出口**
   * ------------------------------------------------------------
   * 老板三条：「威望加成」「主城加成」「神器加成」。
   * 它们的落点是同一批经营量（产量/税收/仓储/席位/野地上限…），
   * 所以**合并到一个函数**里相加 —— 消费点永远只调 cityBonusNum，
   * 别处再拼第二个汇总就是本项目的经典失效模式（改了不生效）。
   * ============================================================ */
  /* ① 威望加成：22 级曲线在 DATA.RANK_BONUS（与 DATA.RANK 同序） */
  GAME.rankBonusOf = function (i) {
    return (DATA.RANK_BONUS || [])[i == null ? ((GAME.state && GAME.state.rank) || 0) : i] || {};
  };
  GAME.rankBonusNum = function (key) {
    var s = GAME.state;
    return (GAME.rankBonusOf((s && s.rank) || 0)[key]) || 0;
  };

  /* ② 主城：每人 1 个（s.mainCityId；新档为空，政务厅里设） */
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
  /* ============================================================
   * v89.191（老板 3-④）：**科技按城** 的三个出口。
   * ------------------------------------------------------------
   * · `techCapOf(city)` —— 等级上限的**唯一出口**：主城 20、别城 10
   *   （canResearch / 科技面板 / 断言同读；战储仓"满配"口径仍用 DATA.TECH_MAX_LV，互不影响）。
   * · `techsOf(city)` —— 某城科技表的惰性出口（老档 / 造局城可能没有 techs 字段）。
   * · `techSet(id, lv, city)` —— 写等级的小工具（测试 / 迁移 / 调试共用；
   *   正常玩法只经 research 递增，不从别处写）。
   * ============================================================ */
  GAME.techCapOf = function (city) {
    var base = DATA.TECH_MAX_LV || 10;
    if (GAME.isMainCity(city)) {
      return Math.max(base, DATA.TECH_MAX_LV_MAIN || 20);
    }
    return base;
  };
  /* v91.72（老板）：主城独有科技上限 —— 与主城同 20 级（别城根本不能研究）。 */
  GAME.techCapOfMain = function () {
    return Math.max(DATA.TECH_MAX_LV || 10, DATA.TECH_MAX_LV_MAIN || 20);
  };
  GAME.techsOf = function (city) {
    var ct = city || GAME.currentCity();
    if (!ct) return {};
    ct.techs = ct.techs || {};
    return ct.techs;
  };
  GAME.techSet = function (id, lv, city) {
    var t = GAME.techsOf(city);
    t[id] = Math.max(0, Math.floor(Number(lv) || 0));
    return t[id];
  };
  /* v89.191（老板 3-④）迁移：**全境一份 → 各城一份**（老档宽限：逐城各得一份，不追溯削弱）。
     幂等：只在顶层 st.techs 存在时执行，随后 delete（不留第二个出口）；
     在办的研究队列条目补 cityId（无主 → 主城 → 首城）。 */
  GAME.migrateTechs191 = function (st) {
    if (!st) return;
    (st.cities || []).forEach(function (c) {
      c.techs = c.techs || {};
      if (st.techs) {
        for (var k in st.techs) {
          c.techs[k] = Math.max(c.techs[k] || 0, st.techs[k] || 0);
        }
      }
    });
    if (st.techs) delete st.techs;
    ((st.queues || {}).tech || []).forEach(function (q) {
      if (!q.cityId) {
        var mc = null;
        (st.cities || []).forEach(function (c) { if (c.id === st.mainCityId) mc = c; });
        q.cityId = (mc || (st.cities || [])[0] || {}).id || null;
      }
    });
  };
  /* ============================================================
   * v89.102（老板）：**主城随威望解锁建筑等级上限**
   * ------------------------------------------------------------
   * 老板原话：「主城（每个玩家只能设定一座主城）可随威望逐步解锁政务厅及其他建筑
   *   等级上限，威望每级解锁建筑等级上限 1 级」。
   * 口径：
   *   · **只有主城**享受（`s.mainCityId` 那一座）—— 别城不享受，
   *     这就是"定都"的实质回报（与驻跸加成同一个池子）；
   *   · 解锁量 = 威望序号 × `DATA.MAIN_CITY.buildCapPerRank`（每档 +1）；
   *   · 它同时抬两样东西（见 `buildCapOf`）：① 建筑自身等级上限；
   *     ② **政务厅总闸**（城内建筑 ≤ 政务厅等级）—— 否则"解锁了上限却仍被政务厅卡住"。
   * ⚠️ 唯一出口：升级守卫 / 建造前置提示 / UI / 测试一律读这里，不许各处自拼
   *   （否则又会出现"面板说能升、点下去被拦"）。
   * ⚠️ 上限夹在 `DATA.RANK_BUILD_LIFT_MAX` 内：等级表按这个上限一次性外推，
   *   越界会取到 undefined（费用表短了 → 升级按钮消失）。
   * ============================================================ */

  /* ============================================================
   * v89.229 兵种重构（18→14）：**老档兵种 id 迁移**
   * ------------------------------------------------------------
   * 映射表（唯一来源）：旧 id → 新 id。合并项（多个旧 id 落同一位）**数量相加**；
   * 队列/战术/战报等"引用型"字段**改指新 id**（同值不并）。幂等：st.troopMig229。
   * 覆盖容器：城市驻军 / 训练队列 / 行军 / 挂起战斗（atkArmy+sim.scArmy）/
   *   采集队 / 野地驻守 / 战术设置表 / 战报四表。
   * 容器缺项即跳过（防御式——结构随版本演进）。
   * ============================================================ */
  GAME.TROOP_MAP_229 = {
    minfu: 'banche', qingji: 'fujiche', chihou: 'zhencha', zhouche: 'yunshu',
    yibing: 'buxingji', changqiang: 'buxingji', qingzhoubing: 'kuanglie',
    daodun: 'dunwei', gongjian: 'daodanche', tuqibing: 'wuzhi',
    tieji: 'zhuzhan', xiliangtieqi: 'zhuzhan', hubaoqi: 'kuanglie',
    tengjiabing: 'dianci', toudan: 'huopao', chongche: 'huopao',
    chuangnu: 'wuren', nanjiangxiangbing: 'taitan'
  };
  GAME.migrateTroops229 = function (st) {
    if (!st || st.troopMig229) return;
    var MAP = GAME.TROOP_MAP_229;
    var fixArmy = function (o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var nk = MAP[k];
        if (nk && nk !== k) {
          o[nk] = (o[nk] || 0) + (o[k] || 0);
          delete o[k];
        }
      });
    };
    var fixRef = function (box, key) {
      if (box && MAP[box[key]]) box[key] = MAP[box[key]];
    };
    (st.cities || []).forEach(function (c) { if (c) fixArmy(c.army); });
    ((st.queues && st.queues.train) || []).forEach(function (q) { if (q) fixRef(q, 'troopId'); });
    (st.marches || []).forEach(function (m) { if (m) { fixArmy(m.army); fixRef(m, 'troopId'); } });
    (st.battles || []).forEach(function (b) {
      if (!b) return;
      fixArmy(b.atkArmy);
      fixArmy(b.army);
      if (b.sim) { fixArmy(b.sim.scArmy); fixArmy(b.sim.defArmy); }
    });
    (st.gathers || []).forEach(function (g) { if (g) fixArmy(g.army); });
    (st.wilds || []).forEach(function (w) {
      if (w && w.garrison && w.garrison.troops) fixArmy(w.garrison.troops);
    });
    /* v90.92：任务储备（st.quests.stash）随任务系统退役（无此容器）。 */
    (function () {
      var t = st.tactics;
      if (!t || typeof t !== 'object') return;
      var fixT = function (tb) {
        if (!tb || typeof tb !== 'object') return;
        Object.keys(tb).forEach(function (k) {
          var nk = MAP[k];
          if (nk && nk !== k) { tb[nk] = tb[k]; delete tb[k]; }
        });
      };
      if (t.atk || t.def) { fixT(t.atk); fixT(t.def); }
      else fixT(t);
    })();
    (st.reports || []).forEach(function (r) {
      if (!r) return;
      ['atkStart', 'atkLoss', 'defStart', 'defLoss'].forEach(function (kk) { fixArmy(r[kk]); });
      if (r.result) {
        ['atkStartBy', 'atkLossBy', 'defStartBy', 'defLossBy'].forEach(function (kk) { fixArmy(r.result[kk]); });
      }
    });
    st.troopMig229 = 1;
  };

  /* v90.60（老板）：老档"**多城同格**"修复 —— 同一 (x,y) 上的多座城，保留第一座，
     其余**就近移到最近的空闲格**并改写坐标（内部逻辑/存档仍是平面格，坐标数值即改）。
     判据：目标格未被任何城/名城占（地形不判 —— 城址落地后该格由 s.cities 标记为城）。 */
  GAME.migrateCityCells = function (st) {
    if (!st || !st.cities || st.cities.length < 2) return 0;
    var W = (GAME.DATA && GAME.DATA.MAP_W) || 500, H = (GAME.DATA && GAME.DATA.MAP_H) || 500;
    var at = {};
    st.cities.forEach(function (c) { if (c && c.x != null) at[c.x + ',' + c.y] = c; });
    var npcAt = {};
    ((GAME.DATA && GAME.DATA.NPC_CITIES) || []).forEach(function (n) { npcAt[n.x + ',' + n.y] = 1; });
    var moved = 0;
    st.cities.forEach(function (c) {
      if (!c || c.x == null) return;
      if (at[c.x + ',' + c.y] === c) return;                 /* 该格第一座城 → 保留原位 */
      for (var r = 1; r <= 60; r++) {
        var found = false;
        for (var dy = -r; dy <= r && !found; dy++) {
          for (var dx = -r; dx <= r && !found; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;   /* 只走第 r 圈 */
            var nx = c.x + dx, ny = c.y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            var k2 = nx + ',' + ny;
            if (at[k2] || npcAt[k2]) continue;
            c.x = nx; c.y = ny; at[k2] = c; moved++; found = true;
          }
        }
        if (found) break;
      }
    });
    return moved;
  };

  /* v90.70（老板「统一坐标系」）：老档**补写 ci**（球面六边格索引）——
     城市/野地/前哨/采集/行军都按 (x,y) 现算一次 ci 并写回，之后全项目统一读 ci。
     幂等（st.sphereMig70 标记）。deps 未就绪（无内核）时跳过。 */
  GAME.migrateSphereCi70 = function (st) {
    if (!st || st.sphereMig70) return 0;
    if (!GAME.sphere || !GAME.sphere.ciOfXY || !GAME.sphere.cells) return 0;
    var n = 0;
    function tag(o) { if (o && o.x != null && o.y != null) { var ci = GAME.sphere.ciOfXY(o.x, o.y); if (ci >= 0 && o.ci !== ci) { o.ci = ci; n++; } } }
    (st.cities || []).forEach(tag);
    (st.wilds || []).forEach(tag);
    (st.gathers || []).forEach(tag);
    (st.marches || []).forEach(tag);
    /* s.forts 是 { 'x,y': {x,y,...} } 字典 */
    var fs = st.forts || {};
    for (var k in fs) tag(fs[k]);
    (GAME.DATA && GAME.DATA.NPC_CITIES || []).forEach(tag);
    st.sphereMig70 = 1;
    return n;
  };

  /* ============================================================
   * v90.100（球系身份）：老档把**身份/键**从平面 (x,y) 迁到 ci。
   * ------------------------------------------------------------
   * 前置：migrateSphereCi70 已为实体补 `.ci`。本迁移做「身份层」的换血：
   *   · 据点字典键：`'x,y'` → `'c'+ci`（forts / fortsRazed / fortsTaken / fortRaids）；
   *   · 围攻键：`'f:x,y'` → `'f:c'+ci`（`'c:城id'` 不变）；
   *   · 行军：`tx/ty` → `tci`；
   *   · 城市：补 lon/lat（由 ci 现算；x/y 保留为派生缓存）。
   * 同时**递归每个 `st.mapSlices[pid]`**（非当前星球的分片也要迁）。
   * 幂等（`st.sphereIdMig` 标记）；无内核时跳过（保持旧档可读）。
   * ⚠️ 迁移是「换算键」不是「重算位置」：ci 一律取自实体已存的 `.ci`（缺则按 x,y 现算一次），
   *    **绝不按 x,y 覆盖已有 ci**，否则会与既有世界错位。
   * ============================================================ */
  GAME._sphereIdMig = function (st) {
    if (!st || st.sphereIdMig) return 0;
    var SP = GAME.sphere;
    if (!SP || !SP.ciOfXY || !SP.cells) return 0;      /* 无内核：以后再迁 */
    var n = 0;
    /* 由实体取 ci（优先已存 .ci；缺则按 x,y 现算一次，回填） */
    function ciOf(o) {
      if (!o) return -1;
      if (o.ci != null && o.ci >= 0) return o.ci;
      if (o.x != null && o.y != null) { var c = SP.ciOfXY(o.x, o.y); if (c >= 0) { o.ci = c; return c; } }
      return -1;
    }
    function cityCi(o) {
      var ci = ciOf(o);
      if (ci >= 0) { var c = SP.cells[ci]; if (c) { o.lon = c.lon; o.lat = c.lat; } }
      return ci;
    }
    /* 'A,B' → 'c'+ci；已是 'c…' / 非坐标键 → 原样 */
    function remapKey(k) {
      if (typeof k !== 'string') return k;
      if (k.charAt(0) === 'c') return k;                 /* 新键/城键：已成 ci 口径 */
      var m = /^(\d+),(\d+)$/.exec(k);
      if (!m) return k;
      var ci = SP.ciOfXY(+m[1], +m[2]);
      return ci >= 0 ? ('c' + ci) : k;
    }
    /* 遍历一套「世界」（顶层 or 某 slice） */
    function migWorld(w) {
      if (!w) return;
      (w.cities || []).forEach(cityCi);
      (w.wilds || []).forEach(ciOf);
      (w.gathers || []).forEach(ciOf);
      (w.marches || []).forEach(function (mr) {
        if (mr.tci != null) return;
        var ci = -1;
        if (mr.tx != null && mr.ty != null) ci = SP.ciOfXY(mr.tx, mr.ty);
        else if (mr.target) ci = ciOf(mr.target);
        if (ci >= 0) { mr.tci = ci; delete mr.tx; delete mr.ty; }
      });
      ['forts', 'fortsRazed', 'fortsTaken', 'fortRaids'].forEach(function (dict) {
        var o = w[dict]; if (!o || typeof o !== 'object') return;
        var out = {};
        for (var k in o) { var nk = remapKey(k); out[nk] = o[k]; if (dict === 'forts' && o[k] && nk.charAt(0) === 'c') ciOf(o[k]); }
        w[dict] = out;
      });
      var sg = w.sieges;
      if (sg && typeof sg === 'object') {
        var so = {};
        for (var sk in sg) { so[sk.replace(/^f:(\d+),(\d+)$/, function (_, a, b) { var ci = SP.ciOfXY(+a, +b); return ci >= 0 ? ('f:c' + ci) : ('f:' + a + ',' + b); })] = sg[sk]; }
        w.sieges = so;
      }
    }
    migWorld(st);                                        /* 顶层（当前星球） */
    var slices = st.mapSlices || {};
    for (var pid in slices) migWorld(slices[pid]);       /* 每个星球分片 */
    st.sphereIdMig = 1;
    return n;
  };

  GAME.rankBuildCapOf = function (city) {
    var s = GAME.state;
    if (!s || !GAME.isMainCity(city)) return 0;
    var slope = (DATA.MAIN_CITY || {}).buildCapPerRank || 0;
    var lift = Math.round(((s.rank || 0)) * slope);
    return Math.max(0, Math.min(DATA.RANK_BUILD_LIFT_MAX || 0, lift));
  };
  /* ============================================================
   * v89.108（老板）：**领地上限随威望解封** —— 唯一出口
   * ------------------------------------------------------------
   * 老板原话（v89.108）：「限制城市数量，参考威望和主城等级设置，
   *   可建造控制的城市数量随威望解封」。
   * ⛔ v89.203（老板 4）口径变更：「各级威望能管理的城市数 —— 幸存者 9 座，随威望每升
   *   一级增加一座」。上限 = **本档值**（RANK[i].city，9..30）；
   *   晋升城市门槛 = **打满本档上限**（同名同值 —— 打满的那一刻正是该求晋升的时候，
   *   门槛与上限天然合一，不另立第二张表）。
   *   （v89.108 取"下一档"是为避开"本档值=幸存者1座"的死锁；本档值上调至 9 起后
   *    门槛同步改为"打满本档"，死锁不复存在 —— 两处一起读 DATA.RANK，仍是一张表。）
   * 三条得城路径全部过此闸（自建 / 占城 / 据点转正）：
   *   · 界面：`ui.expModeLockOf`（出征方式置灰）与 `canBuildCityAt` 读同一判据；
   *   · 执行：`battle.prepare`（发起与抵达都拦）+ onConquer / claimFort 兜底。
   * 老档保护：**只拦新增、不削已有** —— 既往城市保留；已超编者禁止再扩张。
   * ============================================================ */
  GAME.cityCapOf = function () {
    var s = GAME.state;
    if (!s) return 0;
    var i = Math.max(0, Math.min(s.rank | 0, DATA.RANK.length - 1));
    return DATA.RANK[i].city;   /* v89.203：本档管理数（幸存者 9 → 每档 +1 → 封顶 30） */
  };
  /* v91.22（老板 3）：**帝国口径**聚合 —— 跨星球统计（政策/上限/晋升都该按帝国而非当前星球）。
     `s.cities` 只是当前星活态；他星读分片。 */
  GAME.empireCityCount = function () {
    var s = GAME.state; if (!s) return 0;
    return (s.cities || []).length;                 /* v91.74：世界数据全局一份 */
  };
  GAME.planetsOwnedCount = function () {
    var s = GAME.state; if (!s) return 0;
    var seen = {};
    (s.cities || []).forEach(function (c) { seen[GAME.pidOf(c)] = 1; });
    return Object.keys(seen).length;
  };
  /* 领地上限检查：{ ok, cap, n, msg }。ok=false 时 msg 已备好（界面与执行共用）。 */
  GAME.cityCapChk = function () {
    var s = GAME.state;
    if (!s) return { ok: true, cap: 0, n: 0, msg: '' };
    var cap = GAME.cityCapOf(), n = (GAME.empireCityCount ? GAME.empireCityCount() : (s.cities || []).length);
    if (n < cap) return { ok: true, cap: cap, n: n, msg: '' };
    var i = Math.max(0, Math.min(s.rank | 0, DATA.RANK.length - 1));
    var cur = DATA.RANK[i], nx = DATA.RANK[i + 1];
    var msg;
    if (n > cap) {
      /* 老档（本上限上线前已超编）：既往不咎，只是不再扩张 */
      msg = '领地已超编（' + n + '/' + cap + ' 座）—— 既往城市保留，新的扩张须待威望提升';
    } else if (nx) {
      /* v89.203：晋升后的新上限 = 下一档的本档值（nx.city） */
      msg = '领地上限 ' + cap + ' 座（' + cur.name + '）—— 晋升「' + nx.name +
        '」可扩至 ' + nx.city + ' 座';
    } else {
      msg = '领地上限 ' + cap + ' 座（' + cur.name + ' · 已至封顶）';
    }
    return { ok: false, cap: cap, n: n, msg: msg };
  };
  /* 设为主城（首设免费；已有主城时改设收 DATA.MAIN_CITY.moveCost） */
  GAME.setMainCity = function (cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城市不存在' };
    if (GAME.isMainCity(city)) return { ok: false, msg: '「' + city.name + '」已是主城' };
    var cost = GAME.mainCityOf() ? (DATA.MAIN_CITY.moveCost || {}) : null;
    if (cost && cost.gold) {
      if ((s.res.gold || 0) < cost.gold) {
        return { ok: false, msg: '迁都需 ' + U.fmt(cost.gold) + ' 旧币（从府库扣）' };
      }
      GAME.goldAdd(-cost.gold);   /* v91.67 */
    }
    s.mainCityId = city.id;
    GAME.log('🏯 定「' + city.name + '」为主城（' + (DATA.MAIN_CITY.desc || '') + '）', 'sys', 'admin');
    return { ok: true, msg: '「' + city.name + '」定为主城' + (cost && cost.gold ? '（迁都花费 ' + U.fmt(cost.gold) + ' 旧币）' : '') };
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
    /* v89.7（老板「供奉+1这个公文不要显示」）两处：
       ① 只有"有缘由"的入账（攻占城市 / 威望晋升）才写公文 ——
          时长自然累积一律静默（升阶那条报喜保留）。
       ② 小数寄存在 st.frac 里攒整 —— 低倍率下每秒只有 0.x 点，
          旧写法 Math.round 把它整段吃掉（120× 实测永远 +0）；
          修后各倍率口径一致：3 点 / 游戏小时。 */
    n = n || 0;
    if (n <= 0) return 0;
    var st = GAME.artStore();
    var lv0 = GAME.artLevelOf();
    var add = Math.floor(n);
    st.frac = (st.frac || 0) + (n - add);
    if (st.frac >= 1) { var f = Math.floor(st.frac); add += f; st.frac -= f; }
    if (add <= 0) return 0;                     /* 还没攒够 1 点：静默 */
    st.pts += add;
    var lv1 = GAME.artLevelOf();
    if (why) GAME.log('🏺 供奉 +' + U.fmt(add) + '（' + why + '）　当前 ' + U.fmt(st.pts), 'sys', 'admin');
    if (lv1 > lv0) {
      (DATA.ARTIFACTS || []).forEach(function (a) {
        GAME.log('🏺 「' + a.name + '」升至 Lv' + lv1 + ' —— ' + ui77ArtEff(a, lv1));
      });
    }
    return add;
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
      parts.push(({ prodPct: '产量', taxPct: '税收', storePct: '仓储', genExpPct: '英雄经验', repPct: '声望获得' }[k] || k)
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

  /* 威望加成文案（威望表 / 君主面板共用） */
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
  /* 汇总：名城档位 + 威望 + 主城 + 神器（四层相加，唯一出口） */
  GAME.cityBonusNum = function (city, key) {
    return GAME.perkNum(city, key) + GAME.rankBonusNum(key)
      + GAME.mainCityBonusNum(city, key) + GAME.artifactBonusNum(key)
      /* v91.60（老板）：奇观建造——已建构件的全局 buff 并入本汇总（唯一出口）。 */
      + (GAME.buildBonusNum ? GAME.buildBonusNum(key) : 0);
  };
  /* 是不是"名城"（有档位加成的系统城）。v61：野外城市不算 —— 它有 CITY_PERK 档位
     （为了走同一套派生公式），但没有档位加成，不该在界面上被叫"名城"。 */
  GAME.isFamousCity = function (city) {
    city = city || GAME.currentCity();
    return !!(city && city.type && city.type !== 'self' && city.type !== 'fort'
      && DATA.CITY_PERK[city.type]);
  };

  /* ============================================================
   * 未占据名城的派生数据（v60 · 需求 6）
   * ------------------------------------------------------------
   * 老板：「为所有未被占据的城市，根据其等级设定一定资源量，比如9级城市，
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
   * 满配城市的城内布局（v61 · 老板）—— **唯一出口**
   * ------------------------------------------------------------
   * 老板：「野地里的城市，应默认其建筑全都建满了，城内所有建筑各1个，
   *   兵营2个，其他建居所，位置也相对固定一下。城市的地块数量根据等级，数量你来定」
   *
   * 规则见 `DATA.CITY_PLAN` 的注释。要点：
   *   · 政务厅 2×2 **居中**，落位走与 `GAME.makeCity` 相同的唯一出口 `GAME.govCellsOf`；
   *   · 军营成对（第一优先占位，紧挨政务厅），其余建筑各 1 座，剩下的全是居所；
   *   · 非政务厅格按"到政务厅中心的曼哈顿距离"升序取用 → 核心贴着政务厅、居所在最外圈，
   *     跨等级跨城市都同一条规则（这就是老板要的"位置相对固定"）。
   * ⚠️ 布局**只与等级有关**，与城市身份无关 → 同等级的任意两座城，逐格完全一致。
   *
   * v63（老板）：「为名城也补满建筑，**根据其等级上限**」——
   * 于是布局多了一个参数 `buildLv`：**建筑等级**。
   *   野外城市 → 建筑等级 = 城等级（它没有档位加成，`cityBuildBonus` = 0）；
   *   名城     → 建筑等级 = 城等级 + 档位加成（聚落+2 / 重镇+4 / 首府+8 / 旧都+12），
   *             即 v54 定下的「名城建筑等级上限」——"补满"就是把每座建筑盖到它的上限。
   * v89.126 → v89.128：围墙在**NPC 计划**里仍占一格（`CITY_PLAN.order` 收录，
   *   等级 = `buildLv`）—— 这只是影子数据的形状；**攻占转正时提取到环城槽**
   *   （`city.wall`），玩家侧永不占格（老板：「以环城一圈的结构作为一个建筑」）。
   * ============================================================ */
  /* v91.19（老板 1）：**固定建筑栏位** —— 所有城共用 DATA.CITY_PLAN.fixed 的 48 格布局。
     `reserve`（自建城）：居所槽预建居所、**功能建筑槽留空（预留）**，玩家按科技解锁后建；
     非 reserve（系统名城/攻占）：按布局**全部预建成**（等级 = buildLv）。政务厅 4 格官方位覆盖。 */
  GAME.fixedBidAt = function (idx) { var F = (DATA.CITY_PLAN || {}).fixed || []; return F[idx] || 'minfang'; };
  GAME.applyFixedLayout = function (cells, buildLv, col, row, reserve) {
    var total = col * row;
    for (var i = 0; i < total; i++) {
      var bid = GAME.fixedBidAt(i);
      if (reserve && bid !== 'minfang') cells[i] = { build: null, pending: null };
      else cells[i] = { build: { id: bid, lvl: buildLv }, pending: null };
    }
    GAME.govCellsOf(col, row).forEach(function (g) {
      cells[g] = { build: { id: 'guanfu', lvl: buildLv }, pending: null, official: true };
    });
    return cells;
  };
  GAME.cityPlanOf = function (level, buildLv) {
    var P = DATA.CITY_PLAN;
    var lv = Math.max(1, Math.min(P.maxLevel, Math.round(level) || 1));
    var bl = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(buildLv) || lv));
    /* v65：格数不按等级分档（一律 8×6）；v91.19：**固定栏位**（与自建城/攻占同一套，非预留=预建成）。 */
    var size = P.size;
    var col = size[0], row = size[1], total = col * row;
    var cells = [];
    GAME.applyFixedLayout(cells, bl, col, row, false);
    return { col: col, row: row, level: lv, buildLv: bl, cells: cells, total: total };
  };
  /* 系统城的**建筑等级**（唯一出口，与玩家侧 `buildCapOf` 同一个换算口径）。
     口径演变（**以最后一条为准**）：
       v63   → 城等级 + 档位加成（9 级首府 = Lv17）
       v65   → 基数固定为"满级城等级 10"（聚落12/重镇14/首府18/旧都22）
       v89.64→ 基数改 MAX_BLEVEL(12)（聚落14/重镇16/首府20/旧都24）
       v89.75→ 一度改成"随城等级"（郡 Lv7 → 建筑 13）—— **老板否掉了**
       v89.76→ **档位一律满配**：聚落 12 · 重镇 16 · 首府 20 · 旧都 24
     ⚠️ 非名城（野外城市）不是"名城"，按**自己的等级**补：据点是随等级长起来的，
        给它们也上满级会凭空变出一座座满配城。 */
  /* v89.76（老板）：「我要重镇一律 16 级建筑及其对应幸存者资源满额。
     聚落也是一律 12 级（按 12，16，20，24 级），类推」
     ------------------------------------------------------------------
     即：**名城是"满配城"，一切按档位固定，不看 `city.level`** ——
       v89.79 再进一步：守军与库藏**也**改为按档位给基准（`garrisonByTier` / `resByTier`），
         不再乘 `city.level` 的指数 —— 于是"城等级"不再有任何派生副作用，
         它就是**政务厅等级 / 建筑等级的别名**，一号到底（唯一出口 `GAME.cityLvOf`）。
     为什么 v89.75 那版"随城等级"是错的（已回退）：
       它让 Lv7 的重镇只到建筑 Lv13 —— 但老板要的是"重镇就是 16 级城"，
       低等级的重镇只是**守军少、库藏薄**，不是"城本身没建好"。
     ⚠️ 与 `buildCapOf` 仍是同一把尺子（同一个 `cityBuildBonus`）：
       聚落 +0 → 12 · 重镇 +4 → 16 · 首府 +8 → 20 · 旧都 +12 → 24。 */
  GAME.npcBuildLvOf = function (city) {
    if (!city) return 1;
    var isTier = (city.type === 'county' || city.type === 'jun'
      || city.type === 'zhou' || city.type === 'capital');
    var base = isTier
      ? DATA.MAX_BLEVEL                                    /* 名城：档位一律满配 */
      : Math.max(1, Math.min(DATA.CITY_PLAN.maxLevel, Math.round(city.level) || 1));
    return Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, base + GAME.cityBuildBonus(city)));
  };
  /* ============================================================
   * ⛔ 已退役：`GAME.npcLevelOf`（v89.70 引入 · v89.74 删除）
   * ------------------------------------------------------------
   * v89.70 曾把"对外显示的城等级"改成**档位满配**（旧都24/首府20/重镇16/聚落14），
   * 本意是回答老板那句「首府不是 20 级满级吗，为什么显示 Lv9」。
   * 但 v89.72 给普通城发了 1~10 的**等级分布**之后，两把尺子当场打架：
   *   地图角标写 Lv14、守军却按 `city.level`（=9）算 —— 数字对不上，
   *   看起来就是"等级没按分布表生效"（老板 v89.74 原话）。
   *
   * 定论：**城等级与建筑等级是两把尺子，不许再合成一个数显示**。
   *   · 城等级  → `city.level`（派生基数：库藏 / 守军 / 地块上限 / 自动出征筛选）
   *   · 建筑等级 → `GAME.npcBuildLvOf`（档位满配）
   * 显示规则：地图角标 / 出征目标 / 点击界面标题 = **城等级**；
   *           "建筑满配"在城市点击界面**单独一行**写清是"该档上限"。
   * ⚠️ 不要再恢复这个别名 —— 它就是上面那个"错觉"的来源。
   * ============================================================ */
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
       正是本项目最经典的"两个出口"（改一处忘一处）。居所数只认 `minfang`。 */
    return { plan: plan, items: ord, minfang: civil, total: plan.total };
  };

  /* ============================================================
   * 城外满配的**铺法**（v70 · 老板）—— 唯一出口
   * ------------------------------------------------------------
   * 入参是"政务厅能管多少块地"（即 `EXT_CAP_BY_LV` 那一档），返回**逐块的地块类型**：
   * 按 净化厂 → 水培温室 → 发电站 → 电弧熔炉 轮转铺满（同数量表 `DATA.EXT_PLAN_BY_LV`）。
   * 轮转铺法的好处：任何等级下四类地都均匀分布在区块里，不会"前 20 块全是田"。
   * 数量表本身只给**数量**，本函数负责把它变成**确定性的铺法** ——
   * 两者都是纯函数，同等级永远同一结果（"位置排布有序且固定"）。
   * ============================================================ */
  GAME.extPlanOf = function (lv) {
    /* ⚠️ 入参是**政务厅等级**（1 起），不是块数 —— 两者会撞车（12 级 ↔ 12 块），
       所以只认一个口径；返回数组的**长度**就是这级的块数（= EXT_CAP_BY_LV 那一档）。 */
    var n = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(lv) || 1));
    var counts = (DATA.EXT_PLAN_BY_LV || [])[n - 1] || [0, 0, 0, 0];
    return buildList(counts);
  };
  /* 把 [净化厂,温室,电站,熔炉] 的**数量**摊成**逐块类型**（轮转） */
  function buildList(counts) {
    var order = DATA.EXT_BUILD_ORDER || ['farm', 'forest', 'quarry', 'mine'];
    var out = [], i, k;
    var max = counts.reduce(function (a, b) { return Math.max(a, b); }, 0);
    for (i = 0; i < max; i++) {
      for (k = 0; k < order.length; k++) if (i < (counts[k] || 0)) out.push(order[k]);
    }
    return out;
  }

  /* 「建筑全满、均 N 级」的影子城 —— 只用于算派生量（幸存者上限 / 产量），不参与玩法。
     v61：格子改由 `GAME.cityPlanOf` 统一生成（老板的布局规则），
     外城仍按政务厅等级拿满地块。
     v63（老板）：「为名城也补满建筑，根据其等级上限」→ 建筑等级走
     `GAME.npcBuildLvOf`（城等级 + 档位加成），不再是"与城同级"。 */
  GAME.npcCityShadow = function (city) {
    if (!city) return null;
    /* v89.79：城等级走唯一出口（名城=档位等级；自建城=政务厅等级）。
       城外地块数由它派生（extPlanOf），所以"满配城"的地块也随档位拉满
       （EXT_PLAN_BY_LV 已自动补齐到 MAX_LEVEL_ABS，档位等级不会越界取空表）。 */
    var lv = GAME.cityLvOf(city);
    var bl = GAME.npcBuildLvOf(city);
    var key = 'sh@' + city.id + '@' + lv + '@' + bl;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var plan = GAME.cityPlanOf(lv, bl);
    var cells = plan.cells.map(function (c) {
      return { build: c.build ? { id: c.build.id, lvl: c.build.lvl } : null,
        pending: null, official: !!c.official };
    });
    /* 块数按**城等级**（= 该城的政务厅等级，政务厅随城长），
       但每块地的**等级**按建筑等级上限（v65 老板「城内外建筑也达到等级上限」）——
       两者不是一回事：块数是"政务厅能管多少地"，等级是"这地开发到什么水平"。
       v70：**种类与数量**改由数量表产出（唯一出口 `GAME.extPlanOf`，入参=等级）——
       返回数组的长度就是这级的块数（与 `EXT_CAP_BY_LV` 那一档相等，一块不空）；
       改前是 ['farm','farm','forest','quarry','mine'] 循环，数量比与政务厅等级无关。 */
    var kinds = GAME.extPlanOf(lv);
    var ext = [];
    kinds.forEach(function (t, k) { ext.push({ id: 'e' + (k + 1), type: t, lv: bl }); });
    var sh = {
      id: city.id, name: city.name, x: city.x, y: city.y,
      level: lv, buildLv: bl, type: city.type, state: city.state,
      col: plan.col, row: plan.row, cells: cells, extGrid: ext, def: city.def || 0,
      /* v91.19（固定栏位）：围墙不再占格 → 影子城的围墙等级走**独立字段** wallLv（= 建筑等级），
         供占城转正时给环城槽补墙、以及各处"围墙同此"判据读它。 */
      wallLv: bl,
      army: {}, ruler: false, shadow: true,
    };
    GAME._npcCache[key] = sh;
    return sh;
  };

  /* 满配城的**幸存者上限** = 居所座数 × 该级居所幸存者。
     为什么不用 `GAME.maxPopOf`：那个函数吃玩家侧的全境加成（居所满级专精 +20%），
     拿来算"系统城本该有多少人"会被玩家自己的进度污染 —— 侦查面板的数字
     不该因为我在别处盖了座 Lv12 居所就变。这里按纯布局算，可断言、不漂移。
     ⚠️ 居所幸存者按**建筑等级**（`plan.buildLv`）取，不是城等级 ——
     首府 Lv9 的建筑 Lv20，居所就按 Lv20 的幸存者算（v89.75 起重镇/聚落还随城等级折减）。 */
  GAME.planPopCapOf = function (level, buildLv) {
    var plan = GAME.cityPlanOf(level, buildLv);
    var per = (DATA.BUILDINGS.minfang.pop || [])[plan.buildLv - 1] || 0;
    var n = 0;
    plan.cells.forEach(function (c) { if (c.build && c.build.id === 'minfang') n++; });
    return n * per;
  };

  /* ============================================================
   * 野外城市（v61 · 老板：「野地里的城市，应默认其建筑全都建满了」）
   * ------------------------------------------------------------
   * 野外城市（`GAME.map.fortAt`）原本**只有守军和名字**，没有城内结构。
   * 现在给它同一套满配布局（走 `GAME.cityPlanOf`，与未占据名城同一个出口）：
   *   · 城内所有建筑各 1 座、军营 2 座、余为居所（老板给定）；
   *   · 围墙读环城槽 city.wall（据点无围墙 → 等级 0，与玩家城/名城同口径）；
   *   · 幸存者上限按居所算；城防按围墙等级算。
   * `fortCityOf` 把 fort 包装成 city-like，让派生函数复用同一份口径 ——
   * 不这么做就会出现"名城一套、野城另一套"的两个出口。
   * ============================================================ */
  /* 野外城市的城防（唯一出口；原来写死在 battle.resolveTarget 里）。
     口径：底数 10 + 围墙等级 × 4 —— 围墙等级即城等级（满配城的围墙自然拉满）。 */
  GAME.fortDefOf = function (fort) {
    return 10 + ((fort && fort.level) || 1) * 4;
  };
  /* 野外城市的城内布局（含守军/幸存者/城防，供面板与出征预览）。
     ⚠️ 野外城市**不是名城**（`cityBuildBonus` → 0），所以它的建筑等级 = 城等级 ——
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
      /* v91.19（固定栏位）：围墙不占格 → 据点满配围墙等级 = 建筑等级（与名城同口径）。 */
      wallLv: summary.plan.buildLv, total: summary.plan.total,
      items: summary.items, minfang: summary.minfang,
      popCap: GAME.planPopCapOf(lv),
      def: GAME.fortDefOf(fort),
      garrison: (GAME.map && GAME.map.fortGarrison) ? GAME.map.fortGarrison(lv) : null,
    };
    GAME._npcCache[key] = out;
    return out;
  };

  /* 未占据城市的库存（v89.79：**按档位**派生，同类城不再天差地别）。
     口径：以**净水**为锚（DATA.NPC_CITY_RES.resByTier），其余资源按 base 的比例缩放，
     再乘 ±8% 的确定性波动。幸存者取"建筑全满时的居所上限"（老板说的那个口径）。
     ⛔ 退役的旧口径：`base × 1.55^(城等级-1) × npcResMul` —— 指数 + 1~10 分布
     让同类城库藏差几十倍（老板 v89.79：「谁规定了这么大守军数量范围吗」）。
     ⚠️ 档位系数 npcResMul（旧都2.2/首府1.6/重镇1.25/聚落1.0）**不再参与** ——
        它已经被 resByTier 这张显式的档位梯级吸收了（两处都乘就是双重放大）。 */
  GAME.npcCityRes = function (city) {
    if (!city) return GAME.emptyRes();
    var lv = GAME.cityLvOf(city);
    var bl = GAME.npcBuildLvOf(city);
    var key = 'res@' + city.id + '@' + lv + '@' + bl;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var R = DATA.NPC_CITY_RES;
    var rng = U.rng(GAME.npcHash(city.id, 0x51ed));
    var out = GAME.emptyRes();
    var byTier = R.resByTier || {};
    var grainBase = (city.type && byTier[city.type] != null) ? byTier[city.type] : 0;
    if (grainBase) {
      var k = grainBase / R.base.grain;             /* 以净水为锚的缩放比 */
      var fluct = 0.92 + rng() * 0.16;
      Object.keys(R.base).forEach(function (kk) {
        out[kk] = Math.round(R.base[kk] * k * fluct);
      });
    } else {
      /* 非名城兜底（防御性：正常数据里名城都命中上表）—— 仍按等级复利，避免返回全 0 */
      var grown = Math.pow(R.grow, lv - 1);
      var mul = GAME.perkNum(city, 'npcResMul') || 1;
      Object.keys(R.base).forEach(function (kk) {
        out[kk] = Math.round(R.base[kk] * grown * mul * (0.85 + rng() * 0.3));
      });
    }
    var sh = GAME.npcCityShadow(city);
    /* v61：幸存者改走 `planPopCapOf`（纯按布局算，不吃玩家侧加成）；
       顺带保证"居所座数 × 居所等级"这条口径只存在一处。
       v63：建筑等级按名城上限（lv + 档位），居所幸存者跟着涨 —— 见 `npcBuildLvOf`。 */
    out.pop = GAME.planPopCapOf(lv, bl);
    GAME._npcCache[key] = out;
    return out;
  };

  /* 未占据城市的守将（六维 / 名字 / 等级全部由城 id 确定性派生）。
     资质随城档位走（旧都→觉醒体、首府→进化体、重镇→突变体、聚落→凡人），
     六维 = 资质中值 + 等级×成长，再按风格系数各自抖动。 */
  GAME.npcCityGuard = function (city) {
    if (!city) return null;
    /* v89.79：lv 只作缓存 key 与 rng 盐（守将等级区间按**档位**取 DATA.NPC_GUARD_LV、
       四维由公式算），但仍走唯一出口 —— 免得这里成为"第二个读城等级的地方"。 */
    var lv = GAME.cityLvOf(city);
    var key = 'gen@' + city.id + '@' + lv;
    if (GAME._npcCache[key]) return GAME._npcCache[key];
    var rng = U.rng(GAME.npcHash(city.id, 0x7f4a) + lv);
    /* v89.64（老板「英雄默认资质为天启体，等级根据城市级别设定范围，
       四维拉满（自由属性点也随机加上）」）：
         · 资质一律**天启体**（不再按城等级在 凡/良/英/名 之间降档）；
         · 等级取**城档位**区间（DATA.NPC_GUARD_LV，聚落 60~100 起，旧都 190~240 顶）；
         · 四维先取该资质的**属性上限**（base[1]），再把自由点（(等级−1)×成长）
           **随机**摊到四维上 —— 于是"拉满 + 随机加点"两者都在；
         · freePts 归零：上面已经加完，别再发一份（否则界面会显示出"未分配点数"）。
       仍然**不存档**（按城 id 确定性派生，同一个人每次读到都一样）。 */
    var rk = DATA.GEN_RANK_BY_ID.tian || DATA.GEN_RANKS[DATA.GEN_RANKS.length - 1];
    var lvRange = (DATA.NPC_GUARD_LV && DATA.NPC_GUARD_LV[city.type]) || [60, 100];
    var gLv = Math.round(lvRange[0] + rng() * (lvRange[1] - lvRange[0]));
    /* v89.73（老板：「守将四维与天启体资质不一致」）—— 抽一门**特性**（原先硬编码 balance） */
    var styles = DATA.GEN_STYLES || [{ id: 'balance', name: '均衡', w: 1, mul: { tong: 1, nz: 1, yw: 1, zm: 1 } }];
    var stTotal = 0;
    styles.forEach(function (x) { stTotal += (x.w || 0); });
    var rollS = rng() * (stTotal || 1), st = styles[0];
    for (var si = 0; si < styles.length; si++) {
      rollS -= (styles[si].w || 0);
      if (rollS <= 0) { st = styles[si]; break; }
    }
    var sn = DATA.NPC_GUARD_SURNAME, gv = DATA.NPC_GUARD_GIVEN, tt = DATA.NPC_GUARD_TITLE;
    var g = {
      id: '__npc_' + city.id,
      name: sn[Math.floor(rng() * sn.length)] + gv[Math.floor(rng() * gv.length)],
      title: tt[Math.floor(rng() * tt.length)],
      level: gLv,
      rank: rk.id, style: st.id,
      hero: false, npcGuard: true, loyalty: 100,
    };
    /* v89.185（老板 2）：四维/体力统一走 **GAME.guardFillOf**（守将成型唯一出口）——
       与野地 / 据点守将同一把尺（此前本函数手写同款公式、另两处却走 makeGeneral 的
       "纯 base 区间"口径 → 双口径；guardFillOf 与本公式逐点等价：
       base[1]×特性权重 + (等级−1)×成长×特性权重×(5/Σ权重) —— v89.73 的推导见其头注）。
       ⚠️ 不传 fold：名城守将维持既有满量口径（v89.73 起）；折损只服务野外（DATA.GUARD_FOLD）。 */
    GAME.guardFillOf(g);
    if (GAME.guardBal) GAME.guardBal.applyGear(g, 'city', 10);   /* v91.88：名城守将按顶档配装备 */
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

  /* 从「未占据城市」身上取走的财货（v60 · 需求 4/6）。
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
    /* v89.134：读 DATA.RES_ORDER */
    DATA.RES_ORDER.forEach(function (k) {
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
    /* ⛔ v90.93：年号纪元退役 —— 存档索引不再记 era / yearName（只留普通年序 year）。 */
    var seasons = ['春', '夏', '秋', '冬'];
    var we = (DATA.WEATHERS || {})[w.weather || 'clear'] || { name: '晴', icon: '☀' };
    return {
      version: st.version || SAVE_VERSION,
      name: (st.ruler && st.ruler.name) || '无名君主',
      avatar: (st.ruler && st.ruler.avatar) || '🧔',
      cities: (st.cities || []).length,
      army: army,
      rep: Math.floor(st.rep || 0),
      rank: st.rank || 0,
      year: w.year || 1,
      season: seasons[(w.season || 0) % 4],
      weather: we.icon + we.name,
      gameElapsed: Math.round(w.elapsed || 0),
      savedAt: st.savedAt || U.now(),
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
   *   ① 精确段：前 OFFLINE_EXACT_MAX 秒逐秒 tick（队列/民心/幸存者的逐秒逻辑正确）
   *   ② 聚合段：超出部分一次性结算资源与队列，并整段推进历法
   * ⛔ v89.218：史书纪事退役（纪事抑制与归来记账调用一并撤除）。
   * ------------------------------------------------------------ */
  var OFFLINE_EXACT_MAX = 3600;   // 逐秒补算上限（现实秒）

  /* v89.86（整改 P-17）：离线推进上限 —— 单位=游戏日；0=不限（默认 7 日）。
     老板实测：离线 10.16 小时 = 游戏内约 80 年（120×）—— 历法/月俸/神器连跳，
     "离线一夜、人间百年"，长线经营的年代感被冲淡。 */
  GAME.offlineCapDays = function () {
    /* v89.104（老板）："离线推进上限解除，设置里不要这个" ——
     **一律不限**（0 = 不限）：设置项与对应 UI 均已撤除，超限五折折算的分支
     因此永不触发（`simulateOfflineOverflow` 保留：将来要恢复上限，改这一行即可）。 */
    return 0;
  };
  /* 超限时间段的**五折折算**（v89.86 · P-17）——
     资源 = 产量 × 现实秒 × 0.5（受仓容约束，旧币不设上限，与既有口径一致）；
     供奉值 = 游戏时 × 速率 × 0.5（走 artGain 唯一入口）。
     不推进历法/月俸/入侵/队列 —— 这正是"上限"的本体。 */
  GAME.simulateOfflineOverflow = function (secReal) {
    var s = GAME.state, ts = GAME.timeScale();
    if (!s || secReal <= 0) return;
    var rate = 0.5;
    s.cities.forEach(function (ct) {
      var prod = GAME.cityProdPerSec(ct);
      /* v89.212（老板 1）：城外堆场按资源分账 —— 上限逐资源取（每城算一次，循环内查表） */
      var caps = GAME.storePartsOf(ct).capByRes || {};
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        var cap = (k === 'gold') ? 0 : (caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k));
        /* v89.158：只封增长、不削存量（同在线口径） */
        /* v91.67：产出入账走资源归属出口（封顶复用 addResCapped 的"只封增长"口径） */
        if (k === 'gold' || !(cap > 0)) GAME.city.add(ct, k, prod[k] * secReal * rate);
        else if ((R[k] || 0) < cap) GAME.city.add(ct, k, prod[k] * secReal * rate, true);
      }
    });
    if (GAME.artGain && DATA.ARTIFACT && DATA.ARTIFACT.perGameHour) {
      GAME.artGain(ts * secReal / 3600 * DATA.ARTIFACT.perGameHour * rate, '');
    }
  };
  GAME.offlineCatchup = function (secReal, opts) {
    var s = GAME.state;
    if (!s) return 0;
    secReal = Math.max(0, secReal);
    if (secReal <= 5) return 0;
    /* v89.193（老板 3）：**静默模式** —— 主循环"时间跳变补偿"（电脑睡眠 /
       标签节流）复用本函数的全部推进逻辑（队列/资源/历法/行军），但
       **不设 _offlineSec** —— 那是"读档归来"的语义（v89.207 起归来报告在
       两种模式下都归集、按 via 分流标题；见下方「归集归来报告」）。
       silent 只静默"记录类"；真结算一律保留（settleDailyYield / march.rushAll）。 */
    var _silent193 = !!(opts && opts.silent);
    /* v89.89（A2）：归来报告 —— 补算**前后快照**（纯读取），归集为分类数据，
       供「归来报告」弹窗消费。只加"拿数"，不碰任何结算逻辑。 */
    var _oRepSnap = function () {
      var res = {};
      GAME.RES_KEYS.forEach(function (k) { res[k] = 0; });
      (s.cities || []).forEach(function (ct) {
        GAME.RES_KEYS.forEach(function (k) { res[k] += (ct.res && ct.res[k]) || 0; });
      });
      /* v89.161：旧币是**玩家层级唯一池**（各城那份是同一口池子的访问器）——
         上面按城累加会把旧币算成 ×城数，这里改读池子。 */
      res.gold = GAME.goldOf();
      return {
        res: res,
        build: (s.queues.build || []).length,
        tech: (s.queues.tech || []).length,
        train: (s.queues.train || []).length,
        rep: (s.reports || []).length,
        wounded: s.wounded || 0,
      };
    };
    var _snapA = _oRepSnap();
    /* v89.86（整改 P-17）：先按「离线推进上限」分流 —— 上限内的照常全保真补算；
       超限段只做五折折算（资源/供奉），其余系统不再推进。0 日=不限。 */
    var ts0 = GAME.timeScale();
    var capGameSec = GAME.offlineCapDays() * 86400;
    var applied = secReal, overflow = 0;
    GAME._offlineOverflow = 0;
    if (capGameSec > 0 && secReal * ts0 > capGameSec) {
      applied = capGameSec / ts0;
      overflow = secReal - applied;
      GAME._offlineOverflow = overflow;
    }
    var exact = Math.min(applied, OFFLINE_EXACT_MAX);
    var bulk = applied - exact;
    if (exact >= 1) GAME.simulateSeconds(Math.floor(exact));
    if (bulk >= 1) GAME.simulateBulk(bulk);
    if (overflow >= 1) GAME.simulateOfflineOverflow(overflow);
    if (!_silent193) GAME._offlineSec = secReal;   // 供 UI 提示离线补算量（v89.193：在线补算不设）
    /* 辖区岁贡：离线可能跨现实日，须补结（内部按天数差一次结清，上限 30 日） */
    if (GAME.settleDailyYield) GAME.settleDailyYield();
    /* 行军队列：离线期间出发的大军早已抵达 → 一次结清。
       注意必须在 simulateBulk 之后（补算期间城市兵力/资源已按整段变化）。
       若把行军留在队列里"继续走"，玩家回归后会看到一支早就该到的军队。 */
    var _marchMsg = '';
    if (GAME.march && GAME.march.rushAll) {
      var mr = GAME.march.rushAll();
      if (mr.ok) { GAME.log('（离线期间）' + mr.msg); _marchMsg = mr.msg; }
    }
    /* v89.200（老板 2）：「睡眠、离线期间自动打」——挂起战斗在离开期间**自动打完**。
       门槛 = DATA.LOOP_GAP.battleAutoSec（与 toastSec 同档：离开超 5 分钟视为离线托管）——
       短离开（切标签/卡顿）不触发，玩家回来照旧亲临指挥。
       战斗是真结算（战报/沙盘/落账齐全）——"记录类静默"不适用于它：日志照写军情流水，
       与上段行军的"（离线期间）"日志同规。silent（在线跳变补算）同样执行。 */
    var _autoBN200 = 0;
    var _autoBGate200 = (DATA.LOOP_GAP || {}).battleAutoSec;
    if (_autoBGate200 == null) _autoBGate200 = 300;
    if (secReal >= _autoBGate200 && GAME.battle && GAME.battle.autoFinishBattles) {
      var _ab200 = GAME.battle.autoFinishBattles();
      _autoBN200 = _ab200.n || 0;
      if (_autoBN200 > 0) {
        GAME.log.war('（离线期间）' + _autoBN200 + ' 场战斗已自动打完 —— 战报与全程回看见「公文」');
      }
    }
    /* v89.89（A2）：归集归来报告（快照差 → 分类数据；纯读取）
       v89.193：静默模式（在线时间跳变补偿）曾跳过（"归来报告"是读档语义）；
       v89.207（老板 2）：**静默也归集**（via 标记来源）—— 睡眠/息屏大缺口由主循环侧
       按 DATA.LOOP_GAP.reportSec 弹「离线纪要」（同一份数据，标题按 via 分流）。 */
    var _snapB = _oRepSnap();
    var _delta = {};
    GAME.RES_KEYS.forEach(function (k) {
      _delta[k] = Math.round((_snapB.res[k] || 0) - (_snapA.res[k] || 0));
    });
    var _newRep = (s.reports || []).slice(0, Math.max(0, _snapB.rep - _snapA.rep));
    GAME._offlineReport = {
      secReal: secReal,
      applied: Math.round(applied),
      overflow: Math.round(overflow),
      capDays: GAME.offlineCapDays(),
      res: _delta,
      done: {
        build: Math.max(0, _snapA.build - _snapB.build),
        tech: Math.max(0, _snapA.tech - _snapB.tech),
        train: Math.max(0, _snapA.train - _snapB.train),
      },
      reports: _newRep.slice(0, 6).map(function (r) { return r.title || ''; }),
      reportsN: _newRep.length,
      wounded: Math.round((_snapB.wounded || 0) - (_snapA.wounded || 0)),
      marchMsg: _marchMsg,
      autoBattles: _autoBN200,   /* v89.200（老板 2）：离线期间自动打完的挂起战斗数 */
      via: _silent193 ? 'online' : 'reload',   /* v89.207：来源（离线纪要 / 归来报告） */
    };
    return secReal;
  };

  /* ============================================================
   * v89.193（老板 3）：**主循环时间跳变补偿 —— 唯一出口**。
   * ------------------------------------------------------------
   * main.js 主循环每次 tick 比对真实钟算出缺口（gapSec）后调本函数：
   *   · 缺口 ≤ DATA.LOOP_GAP.gapSec → { mode:'skip' }（调用方照常 tickOnce）；
   *   · 缺口 > 阈值 → 走 GAME.offlineCatchup(gapSec, {silent:true}) 补算。
   * 为什么复用 offlineCatchup：队列/资源/历法/行军的推进口径必须只有一份
   * （"在线一份、离线一份"各写一遍的教训见 GAME.advanceTrainQueues 头注）。
   * 测试可直调：把 GAME._loopLastAt 拨旧再走主循环，或直接调本函数。
   * ============================================================ */
  /* 时间跳变补算的**唯一实现**（v89.199 从 loopGapCatchup 原地提取）——
     供两条通道共用：GAME.loopPulse（自取真实钟）与 GAME.loopGapCatchup（显式 gap）。 */
  function _gapCatchupOf(gapSec) {
    var gate = (DATA.LOOP_GAP || {}).gapSec;
    if (gate == null) gate = 5;
    if (!GAME.state || !(gapSec > gate)) return { mode: 'skip', secReal: 0 };
    try {
      GAME.offlineCatchup(gapSec, { silent: true });
    } catch (e) {
      /* v89.199（老板）：补算异常**不再让整拍 tick 崩掉** —— 留痕 + 把锚点回退到
         60 秒前（下拍自动重试这一小段；避免"异常一次吃掉 8 小时"的整段丢失，
         也避免锚点不动时每秒重复扛全量）。 */
      if (window.console && window.console.warn) {
        window.console.warn('[时间跳变] 补算失败（将重试）：' + (e && e.message));
      }
      GAME._loopLastAt = GAME.utils.now() - 60000;
      return { mode: 'error', secReal: gapSec, err: (e && e.message) + '' };
    }
    return { mode: 'catchup', secReal: gapSec };
  }
  /* v89.193 的出口改**薄包装**（与 loopPulse 同源 —— 老测试/工具零改动）：
     传显式 gapSec = 手动指定缺口的补算；主循环已改调 loopPulse（见 main.js）。 */
  GAME.loopGapCatchup = function (gapSec) { return _gapCatchupOf(gapSec); };
  /* ============================================================
   * v89.199（老板）：**主循环脉冲 —— 时间推进的唯一出口**。
   * ------------------------------------------------------------
   * 老板实测：「离线补偿在电脑息屏时不生效，真离线了反而可以」。两条通道此前
   * 可能覆盖不到"睡眠唤醒 / 切回标签"的时机：
   *   ① setInterval 在系统睡眠 / 标签冻结期间停摆，恢复后要等下一拍才发现缺口；
   *   ② 页面"长开不刷新"时跑的是旧会话代码（file:// 不刷新不换新 JS）——
   *      这条用户侧靠"强制刷新 + 设置页版本行"自查（GAME.VERSION）。
   * 处置：把 gap 检测抽成唯一出口 loopPulse（记账 + 决策 + 补算），新增两条触发通道：
   *   · setInterval 每秒（原路径 · main.js 主循环）
   *   · visibilitychange / window focus（醒来 / 切回标签 → **立即**检查）
   * checkVisible=false（非游戏界面）只记账不补算（"无游戏时段"不计缺口 —— v89.193 口径）。
   * 幂等：谁先消费 gap，后到者见 ~0 即 skip —— 通道叠加不重复推进。
   * ============================================================ */
  GAME.loopPulse = function (checkVisible) {
    var now = GAME.utils.now();
    var gap = (now - (GAME._loopLastAt || now)) / 1000;
    /* v90.22（老板：「开着界面 + 息屏几天，回来募兵没进度」）：
       旧实现「不可见 → 只记账不补算」会**把息屏/AI 挂起期间的整段真实时间丢掉**
       （`_loopLastAt = now` 无条件前移，缺口被逐拍吞掉 —— 换机位/息屏唤醒后
       队列看似停在原位）。改为：**只要已有对局（GAME.state 存在），无论可见与否
       都按真实钟补算**（这是挂机游戏，时间本就该走）；只有"未开局"（创角/无 state）
       才只记账不补算，避免把"无游戏时段"算进缺口。 */
    if (!GAME.state) { GAME._loopLastAt = now; return { mode: 'none', gap: gap }; }
    GAME._loopLastAt = now;
    var r = _gapCatchupOf(gap);
    r.gap = gap;
    return r;
  };

  /* 聚合补算：不做逐秒循环，一次算完，避免长时间离线卡死 */
  GAME.simulateBulk = function (secReal) {
    var s = GAME.state, ts = GAME.timeScale();

    /* 定期来袭：离线也要照打（**与在线同一个 invasionTick**）——
       长时间离线会一次跨过多个周期，函数内部用 while 逐个结算。 */
    GAME.invasionTick(ts / 3600 * secReal);
    /* 资源：**逐城**结算（v60 · 需求 4，与在线 tickOnce 同一口径）。
       v89.36（老板「维持军队无需耗净水」）：军队维持耗粮已废除 ——
       离线补算不再扣军粮、不再推缺粮计时（缺粮哗变系统一并退役）。 */
    s.cities.forEach(function (ct) {
      var prod = GAME.cityProdPerSec(ct);
      /* v89.212（老板 1）：城外堆场按资源分账 —— 上限逐资源取（每城算一次，循环内查表） */
      var caps = GAME.storePartsOf(ct).capByRes || {};
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        var cap = (k === 'gold') ? 0 : (caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k));
        /* v89.158：只封增长、不削存量（与在线 tickOnce 同一口径） */
        /* v91.67：产出入账走城市资源归属出口 */
        if (k === 'gold' || !(cap > 0)) GAME.city.add(ct, k, prod[k] * secReal);
        else if ((R[k] || 0) < cap) GAME.city.add(ct, k, prod[k] * secReal, true);
      }
      /* v89.36：军粮维持耗粮已废除（不再扣粮、不再缺粮计时）。 */
    });
    /* 英雄体力/精力回满、忠诚（v14.1 同样不随时间衰减，与在线口径一致） */
    (function () {
      var gc = DATA.GEN_COST, lo = DATA.LOYALTY, hours = ts / 3600 * secReal;
      var rateRec131 = GAME.recoverRatePerRealSec();   /* v89.179c：唯一出口（与在线同一份口径） */
      s.generals.forEach(function (g) {
        /* v29（需求 11）：体力上限不再是写死的 100，而是 GAME.staMax(g)
           v66：`g.stamina` 存的是**等级那一份的余量**（装备体力常备不失），
           所以这里按 staBaseMax 封顶，别把余量灌进装备那份里去。
           v89.131（老板「体力精力应随现实时间百分比回复，按现实时间24h可恢复满值」）：
           口径改**现实时间百分比** —— 速率 = 池子上限 ÷(recoverHours×3600) /现实秒，
           离线用 secReal（真实秒）直接乘。体力按"可用池"（staBaseMax，
           装备那份是常备额度不参与消耗）→ 显示值从下限到上限恰 24h；
           精力按 energyMaxOf（六维公式）→ 从 0 到满恰 24h。
           ⚠️ 直接写 g.stamina/g.energy（**不走 staNow/setStaNow**）：
           那两个出口带 Math.round，读-改-写会把每 tick 的零头抹掉（永远涨不上去）。 */
        var mx = GAME.staBaseMax(g);
        g.stamina = Math.min(mx, (g.stamina == null ? mx : g.stamina) + mx * rateRec131 * secReal);
        var enMx131 = GAME.energyMaxOf(g);
        g.energy = Math.min(enMx131,
          (g.energy == null ? enMx131 : g.energy) + enMx131 * rateRec131 * secReal);
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
    /* v91.74：背景星球的建筑队列同样推进（世界数据全局一份，不再按分片停表）。 */
    /* v24（需求 8）：募兵队列按军营分组推进（与在线主循环共用同一实现） */
    GAME.advanceTrainQueues(secReal * ts);
    /* v73：实验室研发项目按同一段离线时长推进（挂机回来也该完成了） */
    if (GAME.tickFarm) GAME.tickFarm(secReal * ts);
    if (GAME.artTick) GAME.artTick(secReal * ts);   // v79：神器供奉（离线补算同口径）
    s.queues.tech.forEach(advance);
    var i;
    for (i = s.queues.build.length - 1; i >= 0; i--) {
      if (s.queues.build[i].elapsed >= s.queues.build[i].totalTime) {
        var qb = GAME.city.queueRemove('build', i);   /* v91.68 */
        GAME.applyBuildDone(qb);
      }
    }
    for (i = s.queues.tech.length - 1; i >= 0; i--) {
      if (s.queues.tech[i].elapsed >= s.queues.tech[i].totalTime) {
        var qc = GAME.city.queueRemove('tech', i);   /* v91.68 */
        GAME.applyTechDone(qc);
      }
    }
    /* 历法：整段一次性推进（内部只触发一次换季/换年检查，不会涌出大量史书） */
    if (GAME.story) GAME.story.tick(secReal * ts);
    /* v89.160：逾溢折损 —— 与在线**同一个**结算函数（历法已推进 → 锚点能对上） */
    if (GAME.settleOverflowRot) GAME.settleOverflowRot();
    /* v89.186（老板 3 · #6）：商旅税所 —— 离线同样补结（锚点幂等，多调无害） */
    if (GAME.fortTaxSettle) GAME.fortTaxSettle();
    /* v89.179b·P2-7：离线俸禄改走唯一出口 settleGenSalary（原内联 g.level*20 错 10~20 倍且重复扣）。
       本段已通过上面的 story.tick 推进 world.elapsed（与在线每 tick 同刻度），此处结清
       → 与 exact 段（simulateSeconds→tickOnce→settleGenSalary）共用同一锚点，不重复不漏扣。 */
    if (GAME.settleGenSalary) GAME.settleGenSalary();
  };

  /* ---------------- 存档 / 读档（v3，旧档作废） ---------------- */
  GAME.saveGame = function () {
    if (!GAME.state) return false;
    GAME.state.savedAt = U.now();
    /* v92：探明度打包入档（40962 格 × 2bit → base64 约 13.6KB）。
       必须在 stringify 之前写回 state —— savePayload 直接序列化整个 state。 */
    if (GAME.fog) GAME.state.fog = GAME.fog.pack();
    /* v91.74：世界数据全局一份 —— 存档无需再同步星球分片。 */
    try {
      /* 【派生数据一律不入档】同类历史问题已发生两次：
         · map.grid    —— 500×500=25 万格地形（JSON 约 9MB），曾撑爆 localStorage 的 5MB 配额，
                          导致整个存档写入静默失败。地形由 map.seed 确定性生成。
         · map.cities  —— 174 座 NPC 城的整份快照（约 54KB，占存档 96%），而守军在游戏中
                          **从不被修改**（纯派生）。它不只是浪费空间：读档时用的是存档里的旧副本，
                          所以**改了城市数值对老档完全不生效**。
         两者一律不入档，读档时由同一 seed 重建；玩家可变部分另存于
         state.cities（已占城市，含 origId）/ state.wilds / state.fortsRazed。 */
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
  GAME.adoptState = function (st) {
    /* v89.209（v89.208 评估缺陷链 ①）：形状抽检（读路径同闸）—— importText 已拦一道，
       这里再拦一道：手改 localStorage / 旧版导入残留的坏档同样进不了迁移链；
       不合法即抛，且**不触碰 GAME.state**（loadGame/loadFrom 的 catch 返回 null）。 */
    var _ck209 = GAME.saveShapeChk(st);
    if (!_ck209.ok) throw new Error('存档形状损坏：' + _ck209.msg);
    /* v89.209（v89.208 评估缺陷链 ②）：**原子化** —— 迁移链内的助手（syncSeq /
       normalizeGuards / normalizeGenCities / migrate* 及 offlineCatchup）全部以全局
       `GAME.state` 为读点（见 syncSeq 首行），因此"把赋值挪到最后一步"行不通 ——
       挪了它们读到的就是**上一个档**。等价形态 = 先存 prev、挂上新档跑完整链、
       异常时回滚 prev 再抛出：失败后内存里**不留半迁移态**，游戏继续跑完好的旧档。 */
    var _prev209 = GAME.state;
    GAME.state = st;
    try {
      /* ============================================================
       * v60 迁移：全境共享库存 → **各城独立库存**
       * ------------------------------------------------------------
       * 旧档在 state 顶层有一个 `res`（粮木石铁旧币 + 幸存者，全境共用）。
       * 迁移口径：**整份并入首城**（玩家实际在用的那座），其余城市按
       * `GAME.npcCityRes` 给一笔与其等级相称的库存 —— 不给的话，
       * 攻占来的城读档后会变成"0 粮 0 旧币"的废城，只能靠运输养活。
       * 之后再 attachRes：从这一刻起 `s.res` 就是"当前城的库存"。
       * ============================================================ */
      /* v89.224：种子体系退役 —— 老档背包里的 5 种种子道具清出（已无处可用）；
         掉落 / 播种 / 货架三条链整条删除，见 docs/废土术语映射表.md。 */
      if (st.items) {
        ['seed_fan', 'seed_yunling', 'seed_xisui', 'seed_hualong', 'seed_tianshou'].forEach(function (k) { delete st.items[k]; });
      }
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
      /* v89.161（老板 5）：**旧币上收玩家层级** —— 老档把各城 res.gold 相加迁入 s.gold；
         新档以 st.gold 为权威（各城那份只是冗余副本，**不再累加**，否则 ×城数）。 */
      GAME.migrateGoldPool(st);
      GAME.attachRes(st);
      /* v89.191（老板 3-④）：科技由"全境一份"迁为"各城一份"（老档平移 + 队列补城）。 */
      GAME.migrateTechs191(st);
      /* v89.229 兵种重构（18→14）：旧兵种 id 并入新 id（数量相加/队列改指/战术表改键）。
         幂等（st.troopMig229 标记）；新档不经本链（只走 newGame）——天然无迁移残留。 */
      GAME.migrateTroops229(st);
      /* 存档不含地形与 NPC 城，一律用 seed 重建（确定性，与存档前一致）。
         这里**无条件**清掉可能存在的旧副本 —— 老存档里带着 v16 之前的 NPC 城快照，
         不清就会继续用旧数值（这正是「改了城市数值对老档不生效」的根因）。
         已占城市由 map.generate 依据 s.cities[].origId 剔除。 */
      st.map.cities = null;
      /* 存档不含地形，用 seed 重建（确定性，与存档前完全一致） */
      if (GAME.map && GAME.map.generate) GAME.map.generate();
      /* v90.60（老板）：老档"多城同格"修复 —— 就近挪到空闲格并改写坐标（地形已重建，可判平原） */
      if (GAME.migrateCityCells && GAME.migrateCityCells(st) > 0) {
        (st.cities || []).forEach(function (c) { var t = GAME.map.tile(c.x, c.y); if (t) t.terrain = 'city'; });
      }
      /* v90.70：老档补写 ci（球面六边格索引）—— 城/野地/前哨/采集/行军统一读 ci（幂等） */
      if (GAME.migrateSphereCi70) GAME.migrateSphereCi70(st);
      /* v90.97（老板）：**球系 ID 从 1 起递增** —— 老档整体 +1（须在 _planetsMigrate84 之前，
         否则老家号还是 0，迁移判据落空）。幂等。 */
      if (GAME._planetsRemap) GAME._planetsRemap(st);
      /* v90.84（老板 2）：**星球分片迁移** —— 老档无 mapSlices → 现有世界归**老家（1 号）**；
         v90.86：修复旧迁移误把世界存到非 1 号的档（唯一分片搬回 1 号）。 */
      if (GAME._planetsMigrate84) GAME._planetsMigrate84(st);
      /* v90.97（双球面）：`mapPlanetId` 补字段/校验（缺省 = activePlanet）。 */
      if (GAME._mapPlanetMigrate) GAME._mapPlanetMigrate(st);
      /* 叙事层补字段（旧档可能缺 world/chronicle） */
      if (GAME.story) GAME.story.init();
      /* 英雄资质补字段（v11 前的存档没有 rank/style，按四维反推并写回） */
      (st.generals || []).forEach(function (g) {
        if (GAME.rankOf) GAME.rankOf(g);
        if (g.stamina == null) g.stamina = GAME.staBaseMax(g);
        /* v66：老存档里的 g.stamina 可能大于 staBaseMax（那时它含套装体力），
           夹回余量口径即可 —— 装备那一份由 staNow 现算，不会丢。 */
        else g.stamina = Math.min(g.stamina, GAME.staBaseMax(g));
        /* v89.131：老档缺 energy → 给**新口径的满值**（六维公式算出，非写死 100） */
        if (g.energy == null) g.energy = GAME.energyMaxOf ? GAME.energyMaxOf(g) : 100;
        if (g.loyalty == null) g.loyalty = 70;
        /* v22（需求 2）：旧档英雄补肖像 seed / 英雄头像 key（按名字确定性推导） */
        if (GAME.portraits) GAME.portraits.ensure(g);
        /* v26（需求 2）：速度升为五维之前，普通英雄的出身脚力是 0（当时没人在意）；
           一次性补齐到 GEN_BASE.speed，否则老档英雄的速度会比新招的低一截。
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
      /* v91.03：城主归一化（一城一任）—— 与守将同款；原遗漏 → 幽灵城主堆在同城 */
      if (GAME.normalizeMayors) GAME.normalizeMayors();
      /* v64：把没有归属城的英雄挂到首城 —— 席位按城算，不许有"无主之将" */
      if (GAME.normalizeGenCities) GAME.normalizeGenCities();
      /* 读档后把发号序号对齐到存档内最大号，否则新招募的将会与旧将撞 id
         （表现为「点第一个英雄，操作到的却是别人」） */
      GAME.syncSeq();
      /* v89.136（老板报「驻军丢失」）：老档采集队迁移 —— 把 v89.135 之前"从驻军抽兵"
         的旧式记录转为"兵在驻军·原地开工"新形态（详见 GAME.migrateLegacyGathers 注释）。 */
      if (GAME.migrateLegacyGathers) GAME.migrateLegacyGathers();
      /* v89.152：珠宝体系重设 —— 老档旧珠宝等值换算（幂等 · 详见 GAME.migrateJewels152） */
      if (GAME.migrateJewels152) GAME.migrateJewels152();
      /* v89.193：老档前哨归属迁移 —— 无 cityId 的旧前哨→最近的己方城（详见 GAME.migrateForts193） */
      if (GAME.migrateForts193) GAME.migrateForts193();
      /* v90.11：老档装备槽 12→19 就近映射（肩→左上臂 / 臂→左前臂 / 足→左脚掌…） */
      if (GAME.migrateEquipSlots11) GAME.migrateEquipSlots11();
      /* v89.186：伤兵商品语义反转（替换 → 加法）——旧档 buff 里的 wound 是"绝对值"
         （0.30~0.60），若按新"加值"解释会得到 0.75+0.6 = 超强（顶到 cap）。
         处置：直接作废该键（幂等）。代价极小 —— buff 最长 24h；且旧值本就"低于基础=负收益"。 */
      if (st.buffs && st.buffs.military && st.buffs.military.wound > 0.2) delete st.buffs.military.wound;
      if (!st.forged) st.forged = [];   // 制造厂已打造记录（用于图鉴）
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
      /* v90.92：任务系统退役 —— quests.pool/poolDay/log 老档补字段已无意义 */
      st.items = st.items || {};
      if (st.wilds === undefined) st.wilds = [];
      if (st.yieldDay === undefined) st.yieldDay = null;   // v14 岁贡：旧档首次只登记日期，不补发
      /* v89.188:税所口径迁移 —— 游戏秒锚点 fortTaxAt（旧）退役 → 现实日锚点 fortTaxDay
         （删旧锚 = 首期只登记，与岁贡同过渡；新锚 null 时首次调用自动登记） */
      if (st.fortTaxAt !== undefined) delete st.fortTaxAt;
      if (st.fortTaxDay === undefined) st.fortTaxDay = null;
      /* v15 补字段：野地采集队 + 已占野地的等级日期（旧档野地无 levelDay，首次只登记） */
      if (!st.gathers) st.gathers = [];
      if (!st.msgLog) st.msgLog = [];
      if (st.repUnread == null) st.repUnread = 0;        // v41：旧档补字段（v82 顺手去重复行）
      /* v82：征收退役 —— v24 的 lastLevy 迁移块随功能一并撤除（旧档残留字段无害）。 */
      /* v24（需求 8）：募兵队列补 barracks 归属（旧档队列没有 bIdx）
         v29（需求 13）：同时补齐 `kind` —— 旧档里的器械队列还在军营名下，
         迁移到**机工坊**（找不到作坊就留在原格位，等玩家建好作坊再正常推进）。 */
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
      /* ---- v16 / v40 / v89.126 / v89.128 迁移**整合重写**（围墙归一）----
         ① 政务厅 4 格：6×6 时代的"右侧中部" → 标准位（govCellsOf）
         ② 城内 6×6 → 8×6（48 格；队列 gridIndex 同步重映射）
         ③ 围墙**一律归一进环城槽** `city.wall`（v89.128 定稿：不占城内地块、地位与
            城内建筑同）：v89.126 档的"格子里围墙"与更老档的 `wallLv` 在此合流，
            旧痕（格子占用 / wallLv 字段）全删 —— 不留第二个等级出口。
            在建 / 升级中的围墙队列项，槽位从格号改成 'wall'。 */
      (st.cities || []).forEach(function (c) {
        if (!c || !c.cells) return;
        if (!c.wall) c.wall = { build: null, pending: null };
        /* ① 政务厅位置（仅 6×6 老档） */
        if (c.cells.length === 36) {
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
        }
        /* ② 6×6 → 8×6（48 格） */
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
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId !== c.id || typeof q.gridIndex !== 'number' || q.gridIndex >= 36) return;
            q.gridIndex = Math.floor(q.gridIndex / 6) * 8 + (q.gridIndex % 6);
          });
        }
        /* ③ 围墙归一（格子 / wallLv → 环城槽） */
        var wlv128 = (c.wallLv != null) ? (c.wallLv || 0) : 0;
        c.cells.forEach(function (x, i) {
          if (!x.build || x.build.id !== 'chengqiang') return;
          if ((x.build.lvl || 0) > wlv128) wlv128 = x.build.lvl;
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId === c.id && q.gridIndex === i && q.buildId === 'chengqiang') q.gridIndex = 'wall';
          });
          /* v89.211（老板 2）：释放格**补建居所**（同等级）—— 原样留空会让"满配城"
             缺一块（老板实测"第五行第六格未建造"即此格）；同口径见 battle.js onConquer。 */
          x.build = { id: 'minfang', lvl: x.build.lvl || 1 };
          x.pending = null;
        });
        delete c.wallLv;
        if (wlv128 > 0 && !c.wall.build) {
          /* 不静默（v89.127 精神）：改版提示写进消息流 —— 玩家翻得到"围墙去哪了" */
          c.wall.build = { id: 'chengqiang', lvl: wlv128 };
          var _m128 = '🏯 围墙调整：『' + c.name + '』围墙改为环城结构（不再占城内地块 · Lv' + wlv128 + '）';
          st.log = st.log || [];
          st.log.unshift({ t: U.now(), msg: _m128 });
          if (st.log.length > 40) st.log.pop();
          st.msgLog = st.msgLog || [];
          st.msgLog.push({ t: U.now(), gt: (st.world && st.world.elapsed) || 0, msg: _m128, k: 'sys' });
        }
      });
      /* ---- v68 迁移：政务厅从"右侧中部"移到"棋盘正中"（老板 2026-09-14）----
         对调式：中央 4 格上的占用者与旧政务厅位**一一对调** —— 玩家建筑不丢。
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
          remap[ni] = oi;                       /* 中央格 → 旧政务厅位 */
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
      /* ---- v70 迁移：老档补一位「君主英雄」（老板 2026-09-14）----
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
      /* v90.16：老装备 id → 新套装件 id（套装重设后老档旧装备不丢） */
      if (GAME.migrateEquipIds16) GAME.migrateEquipIds16(st);
      /* v89：基因线君主专属 —— 旧档里非君主身上的辐能装备归还背包、归位机甲 */
      if (GAME.migrateLordLing) GAME.migrateLordLing(st);
      /* v89.211（老板 2）：占城"围墙格释放成空格"的存量补齐（紧签名 · 一次性） */
      if (GAME.migrateWallCell211) GAME.migrateWallCell211(st);
      /* v90.100（球系身份）：据点字典键 'x,y'→'c'+ci、行军 tx/ty→tci、sieges 键、
         城补 lon/lat —— 顶层 + **递归各星球分片**（须在分片迁移之后，分片已定型）。
         前置：migrateSphereCi70 已补 .ci。幂等。 */
      if (GAME._sphereIdMig) GAME._sphereIdMig(st);
      /* v91.74（老板）：「星球不做切片，归一管理」—— 分片世界一次性合并成全局数组
         （每条打 pid；据点类字典键加 `p<pid>|` 前缀）。幂等；此后 sliceOf 只是过滤视图。 */
      if (GAME.migratePlanetWorld74) GAME.migratePlanetWorld74(st);
      /* v89.43：经验曲线整体缩到 1/32 —— 老档经验池按新曲线截断，避免读档连升 */
      if (GAME.migrateExpScale) GAME.migrateExpScale(st);
      /* v77 补字段：月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */
      if (st.salaryAt == null) st.salaryAt = (st.world && st.world.elapsed) || 0;
      /* v89.160 补字段：逾溢折损锚点（同款：老档从"当前时刻"起算，首期 1 游戏日后到） */
      if (st.overflowAt == null) st.overflowAt = (st.world && st.world.elapsed) || 0;
      /* v89.190（v89.189 遗留「幸存者口径老档宽限」）：劳作占用换代（建筑按等级占幸存者）——
         老档首次载入时**一次性安置幸存者**：可征幸存者被打穿（pop 低于劳作占用）的城，
         把幸存者补到「劳作 + max(500, 上限 20%)」（不超过上限），不因规则换代被锁死。
         幂等：标记 popGrace190（新局建档即带 fresh 标记 → 永不触发；老档只补一次）。
         实测（probe：30h 试玩档）——旧档三城可征幸存者全为 0（pop 485 / 劳作 1083），
         安置后各城可征恢复到上限的 ~20%。 */
      if (!st.popGrace190) {
        var _granted190 = [];
        (st.cities || []).forEach(function (c) {
          var _lab190 = GAME.popLaborOf(c);
          var _cap190 = GAME.effPopCapOf ? GAME.effPopCapOf(c) : GAME.maxPopOf(c);
          var _pop190 = (c.res && c.res.pop) || 0;
          var _tgt190 = Math.min(_cap190, _lab190 + Math.max(500, Math.round(_cap190 * 0.2)));
          if (_pop190 < _tgt190) {
            c.res.pop = _tgt190;
            _granted190.push(c.name + ' +' + U.fmt(Math.round(_tgt190 - _pop190)));
          }
        });
        st.popGrace190 = { at: U.now(), granted: _granted190 };
        if (_granted190.length) {
          GAME.log('🏠 幸存者口径更新（劳作占用）：已为老档一次性安置幸存者 —— ' + _granted190.join('、'), 'sys');
        }
      }
      /* 离线补算：按 savedAt 与当前时间推算，精确段+聚合段（详见 offlineCatchup） */
      var elapsed = Math.max(0, (U.now() - (st.savedAt || U.now())) / 1000);
      if (elapsed > 5) {
        GAME.offlineCatchup(elapsed);
        GAME.state.savedAt = U.now();
      }
      /* v90.89（根因修复）：**载入当前星球球面**。`SP._seedOverride` 不入档 → 读档后内核默认
         用 map.seed（老家）。若 activePlanet 不是老家，球面与 activePlanet 不符。此处只把球面
         切到 activePlanet + 重投影网格（不动分片/资源访问器 —— 那些已由本迁移链建好）。 */
      var _ap89 = GAME.activePlanetOf && GAME.activePlanetOf();
      if (_ap89 && GAME.sphere && GAME.sphere.setPlanet) {
        GAME.sphere.setPlanet(_ap89.seed, _ap89.params);
        st.map.grid = null;
        if (GAME.map.generate) GAME.map.generate();
      }
      /* v90.97（双球面）：读档也把**地图球面**切到 mapPlanetId（与逻辑球面解耦，可能不同星球）。 */
      var _mp97 = GAME.mapPlanetOf && GAME.mapPlanetOf();
      if (_mp97 && GAME.mapSphere && GAME.mapSphere.setPlanet) {
        GAME.mapSphere.setPlanet(_mp97.seed, _mp97.params);
        if (GAME.map3d && GAME.map3d.rebuild) GAME.map3d.rebuild();
      }
      /* v92：探明度。球面已切好（上面的 setPlanet）才有格数，故放在这里。
         · 老档（无 fog 数据）→ backfill：把走过的城/野地/据点补成已知，
           **不清零** —— 加迷雾不该抹掉玩家几十小时的成果。
         · 新档 → 只刷一次城/前哨视野（城池易主、新建城都要靠这一步）。 */
      if (GAME.fog) {
        var _hadFog = !!(st.fog && st.fog.data);
        GAME.fog.reset();     /* 丢掉内存里**当前局**的包 —— 读档是换一局，不是续那一局 */
        GAME.fog.ensure();
        if (!_hadFog) GAME.fog.backfill();
        else GAME.fog.revealOwned();
      }
      return st;
    } catch (e209) {
      GAME.state = _prev209;   /* v89.209：回滚 —— 坏档失败不留半迁移态 */
      throw e209;
    }
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
        name: m.name || '无名君主',
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
  /* v89.209（v89.208 评估缺陷链 ①·③）：**存档形状抽检** —— 唯一出口。
     旧口径只验"cities 是非空数组"——评估探针 16 包实锤：`[{}]` / `[null]` /
     5000 个 `{}` / `generals:'oops'` / `map:null` 全部放行，接受后有 5 种静默坏。
     形状一坏，adoptState 半途抛错或 nextGenId 崩 —— 入口先拦，比事后兜底便宜。
     判据 = **数组类型 + 元素必填字段**（真实存档全实体必有 id/name；城市另有 x/y 坐标）；
     口径已对照 4,036 份真实长跑存档 + savePayload 往返产物 —— 合法档零误杀。 */
  GAME.saveShapeChk = function (st) {
    if (!st || typeof st !== 'object' || Array.isArray(st)) return { ok: false, msg: '存档状态不是有效对象' };
    if (!Array.isArray(st.cities) || !st.cities.length) return { ok: false, msg: '存档内容不完整（没有城市数据）' };
    if (!Array.isArray(st.generals)) return { ok: false, msg: '存档内容不完整（英雄数据不是列表）' };
    if (!st.map || typeof st.map !== 'object') return { ok: false, msg: '存档内容不完整（缺少地图数据）' };
    var i, c, g;
    for (i = 0; i < st.cities.length; i++) {
      c = st.cities[i];
      if (!c || typeof c !== 'object' || Array.isArray(c)
        || typeof c.id !== 'string' || !c.id
        || typeof c.name !== 'string'
        || typeof c.x !== 'number' || typeof c.y !== 'number')
        return { ok: false, msg: '存档内容损坏（第 ' + (i + 1) + ' 座城市数据不完整）' };
    }
    for (i = 0; i < st.generals.length; i++) {
      g = st.generals[i];
      if (!g || typeof g !== 'object' || Array.isArray(g)
        || typeof g.id !== 'string' || !g.id
        || typeof g.name !== 'string')
        return { ok: false, msg: '存档内容损坏（第 ' + (i + 1) + ' 位英雄数据不完整）' };
    }
    return { ok: true };
  };
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
      return { ok: false, msg: '存档内容不完整（没有城市数据）' };
    /* v89.209（v89.208 评估缺陷链 ①）：**结构抽检**（唯一出口 saveShapeChk）——
       旧口径只验"cities 是非空数组"：[{}] / [null] / 5000 个 {} / generals:'oops' 全放行。 */
    var _shape209 = GAME.saveShapeChk(pack.state);
    if (!_shape209.ok) return { ok: false, msg: _shape209.msg };
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

    /* v89.83：自动练功（君主修行）—— 与自动出征同一处挂钩，节流在域层里 */
    /* v91.57：自动练功随君主修行退役（本条调用删除）。 */
    /* v89.115（老板「自动菜单增加一个自动治疗伤兵」）：伤兵满旧币即治（节流在域层里） */
    if (GAME.autoHeal) GAME.autoHeal();
    /* v89.190（老板 2）：自动征兵（逐城判别补单 · 节流在域层里 · 开关关闭时零开销） */
    if (GAME.autoTrainTick) GAME.autoTrainTick();
    /* v89.202（老板 3）：收藏条件峰值扫掠（10 游戏秒节流 · 达到过即永久解锁） */
    if (GAME.collectPeakSweep) GAME.collectPeakSweep();
    /* v92：探索里程碑 —— 探明度跨过 DATA.FOG.tiers 的新档 → 城的视野半径永久 +1。
       stats 有缓存（只在探明度变化时重算），没跨档时这里是一次数值比较。 */
    if (GAME.fog && GAME.fog.checkMilestones) GAME.fog.checkMilestones();
    /* v92.4：幸存者营地发现（节流 5 秒 · 只扫候选一两百格，不遍历全图） */
    if (GAME.camp && GAME.camp.sweep) GAME.camp.sweep();
    /* v92.7：旧世界遗迹发现（同一套节流扫描） */
    if (GAME.ruin && GAME.ruin.sweep) GAME.ruin.sweep();
    /* v92.10（A3）：远方的记忆会淡（每 decayHours 现实小时一次 · 城/前哨不受影响） */
    if (GAME.fog && GAME.fog.decay) GAME.fog.decay();
    /* v93.2：村社月推进 —— **世界会自己流失人**（寒潮/军阀/名声都在削它）。
       玩家什么都不做，这个数会变小；这就是"重建"值得做的理由。 */
    if (GAME.village && GAME.village.tick) GAME.village.tick();
    /* v93.5：城会自己长（棚户 / 出走开垦）也会自己朽（荒废）——
       按月推演：按秒会让它变成"数值在跳"，按月才会让玩家某天抬头发现
       "城墙外怎么多了一片棚子"。 */
    if (GAME.growth && GAME.growth.tick) GAME.growth.tick();
    /* 棚户自己种的那点粮（按游戏秒结算，不是按月）——很少，但它让
       "城外的棚子"不是纯负资产，否则玩家只会觉得那是个 bug。 */
    if (GAME.growth && GAME.growth.settleYield) GAME.growth.settleYield(ts);
    /* v92.5：四个军阀按月推进（按月而非按日：游戏日只有 1.3 现实秒，按日会抽搐） */
    if (GAME.faction && GAME.faction.tick) GAME.faction.tick();
    /* ============================================================
     * v94.1：六层世界（最小可运行 · 老板「所有构思都先跑起来」）
     * ------------------------------------------------------------
     * 这五个 tick 都**只作用在新系统上**（村社 / 棚户 / 新垦 / 残页），
     * 不动粮产总表与城防 —— 为的是一轮之内把六个缺口都跑起来，
     * 而不是做完一个就把门禁撞红一次。
     *
     * ⚠️ 外面包一层"月份变了才进"的门：tickOnce 是**每秒**跑的，
     *    而这五个都是月度语义。不包的话，每秒要付 4 次函数调用 +
     *    4 次同样的月份除法 —— smoke §v89.107 的 100 城 < 6ms 会直接顶穿。
     * ============================================================ */
    /* 新模块的月度 tick 统一走这个包装（出错只吞掉它自己那一段） */
    function _safeTick(name) {
      var mod = GAME[name];
      if (!mod || !mod.tick) return;
      try { mod.tick(); } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[monthly tick] ' + name, e);
      }
    }
    var _wm = Math.floor(((s.world && s.world.elapsed) || 0)
      / (((DATA.CALENDAR || {}).secPerYear || 57600) / 12));
    if (s._wqMonth !== _wm) {
      s._wqMonth = _wm;
      if (GAME.rival && GAME.rival.tick) GAME.rival.tick();      /* 竞争者：抢村社、抢遗迹 */
      if (GAME.taint && GAME.taint.tick) GAME.taint.tick();      /* 污染：建筑越多账越重 */
      if (GAME.climate && GAME.climate.tick) GAME.climate.tick(); /* 温度：严寒冻死城外的人 */
      if (GAME.surge && GAME.surge.tick) GAME.surge.tick();      /* 辐射云：外围慢慢不能住人 */
      /* v95：可玩性那一批的月度结算 */
      /* ⚠️ 逐个 try/catch：这是"框架期"，任何一个新模块抛错都不许拖停主循环
         （tickOnce 一停，建造/训练队列全不走 —— smoke §193② 就是这么抓到的）。 */
      _safeTick('veteran');     /* v98.4：伤兵每月自愈（UI 早就这么写了） */
      _safeTick('unrest');
      _safeTick('wonderwar');
      _safeTick('expose');
      /* v100：**惰性 / 世界形态 / 兵源已迁入注册表**（js/registry.js）——
         加模块不再回来改这个列表，见各模块末尾 `GAME.reg.add({ tick })`。 */
      if (GAME.reg && GAME.reg.tickAll) GAME.reg.tickAll();
    }
    /* v89.136：老档采集队迁移兜底（幂等 · 正常已被 loadGame 处理） */
    if (GAME.migrateLegacyGathers) GAME.migrateLegacyGathers();
    /* v89.152：老档珠宝换算兜底（幂等 · 同款双保险） */
    if (GAME.migrateJewels152) GAME.migrateJewels152();
    /* v89.193：老档前哨归属迁移兜底（幂等 · 正常已被 loadGame 处理） */
    if (GAME.migrateForts193) GAME.migrateForts193();
    /* v89.128（需求 5）：自动采集/收获（逐 60 游戏秒检查，节流在域层里） */
    if (GAME.autoGatherTick) GAME.autoGatherTick();
    /* 定期来袭（第 2 期）—— 唯一出口 GAME.invasionTick，离线补算走同一个函数 */
    GAME.invasionTick(GAME.timeScale() / 3600);

    /* v89.64（老板「征召大厅出现相应要求的英雄时触发招募」）：
       征召大厅候选的 5 分钟换批与「自动招募」此前**只在打开征召大厅时才发生** ——
       玩家不点征召大厅就永远不会换批，也就永远不会触发自动招募。
       这里在主循环里挂一次（**廉价**：innRefresh 命中缓存即立刻返回，
       只有真正过期/首次才会换批），于是后台也能换批并自动招人。 */
    if (GAME.innRefresh && GAME.innAutoRun) { GAME.innRefresh(); }

    /* 1) 资源产出：**逐城结算**（v60 · 需求 4）——
       每座城把自己的产量加进自己的库存、按自己的仓容封顶。
       改前是"全境产量加进一份共享库存"，于是切城时资源栏一个数字都不动。 */
    var _mpGlobal = GAME.mastery ? GAME.mastery('prodPct', null) : 0;   /* v89.107：循环外一次 */
    s.cities.forEach(function (ct) {
      var p = GAME.cityProdPerSec(ct, { mpGlobal: _mpGlobal });
      /* v89.212（老板 1）：城外堆场按资源分账 —— 上限逐资源取（每城算一次，循环内查表） */
      var caps = GAME.storePartsOf(ct).capByRes || {};
      var R = GAME.res(ct);
      for (var rk2 in p) {
        if (rk2 === 'pop') continue;
        var cap = (rk2 === 'gold') ? 0 : (caps[rk2] != null ? caps[rk2] : GAME.storeCapOf(ct, rk2));
        /* v89.158（老板 1）：**只封"自然增长"，不削已有存量** ——
           改前是 `R += p; if (R > cap) R = cap`：奖励类入账（宝箱/纪事/市易）把资源
           顶到上限之上后，**下一 tick 被静默削回 cap**（实测 500 万 → 366.7 万，丢 133 万）。
           战储仓面板的文案本来就是"超出部分将停止增长"——现在代码与文案一致。
           旧币是货币，不受储量上限约束（同前口径）。 */
        /* v91.67：产出入账走城市资源归属出口（只封增长） */
        if (rk2 === 'gold' || !(cap > 0)) GAME.city.add(ct, rk2, p[rk2]);
        else if ((R[rk2] || 0) < cap) GAME.city.add(ct, rk2, p[rk2], true);
        /* 已达 / 超上限：不增不减（存量保留） */
      }
    });

    /* v89.179b·P0-1：威望俸禄入账（此前只进 productionPerSec 显示值，tickOnce 与离线都没收这笔账
       → 红利永不入账）。与 productionPerSec 同一口径（v73 旧币收紧 GOLD_GATE.salary），
       一次性并入全境旧币池（威望属府库层面收入，不按城各算）。 */
    var _rankSal = (DATA.RANK[s.rank || 0].salary || 0);
    if (_rankSal) {
      var _sgm = 1, _sItem = GAME.prodBuffMult();
      if (_sItem.gold) _sgm = 1 + _sItem.gold;
      if (GAME.story) _sgm *= GAME.story.prodMult('gold');
      s.gold += _rankSal * _sgm / 3600 * GAME.timeScale() * (DATA.GOLD_GATE.salary || 1);
    }

    /* 2) 军队耗粮 —— v89.36（老板「维持军队无需耗净水」）已废除：
       军队维持不再消耗净水（净水改为**募兵时一次性消耗**，见 DATA.TROOPS.cost.grain ×3）；
       缺粮钳制 / 缺粮计时 / 哗变（原 v65 规则）随之整体退役。 */

    /* 3) 英雄月俸（v77 · 老板「经过 7 个游戏日结算 1 次」）——
       不再逐秒扣款：每 7 游戏日一次结清（GAME.settleGenSalary，
       定价见 DATA.GEN_SALARY / GAME.genSalaryOf）。欠俸时置 unpaidAny
       （供 s._unpaid 标记；不损忠诚 —— v14.1 拍板）。 */
    var gc = DATA.GEN_COST, lo = DATA.LOYALTY;
    var unpaidAny = false;
    var _salSettle = GAME.settleGenSalary();
    if (_salSettle && _salSettle.short > 0) unpaidAny = true;

    /* 3b) 英雄体力/精力恢复
       忠诚（v14.1 按用户要求）：**只在出征战败时下降**，不再随时间/民心/欠俸衰减。
       保留「忠诚极低有概率离去」的判定 —— 连败才会把人逼走。 */
    var gameHours = ts / 3600;                      // 本 tick 折合的游戏小时
    /* v89.131（老板「体力精力应随现实时间百分比回复，24h 回满」）：
       回复与倍速解耦 —— 每小时回"上限的 1/24"，1 现实秒 = 上限/86400。
       实现是**直接写字段**（不走 staNow/setStaNow —— 它们带 round，读改写会抹零头）。 */
    var rateRec131 = GAME.recoverRatePerRealSec();   /* v89.179c：唯一出口（观察项① 结项） */
    var deserters = [];
    s.generals.forEach(function (g) {
      var staMx = GAME.staBaseMax(g);   /* v66：余量口径（装备体力常备不失） */
      g.stamina = Math.min(staMx, (g.stamina == null ? staMx : g.stamina) + staMx * rateRec131 * dtReal);
      var enMx131 = GAME.energyMaxOf(g);
      g.energy = Math.min(enMx131, (g.energy == null ? enMx131 : g.energy) + enMx131 * rateRec131 * dtReal);
      /* 忠诚极低：有概率离去（英雄更难留，但概率仍很低）
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
        GAME.log('💨 ' + g.name + ' 忠诚尽失，弃我而去。', 'sys', 'staff');
      });
    }
    s._unpaid = unpaidAny;

    /* 4) 民心（v89.177 公式口径）：民心 = clamp(100 − 税率×100 + 安抚, 0, 100)。
       改动三处：① 旧的"税率>50% 逐时衰减"整段退役（公式已含税率影响，且是即时的）；
                 ② 安抚（heartsComfort）每游戏小时向 0 回落（decayPerHour）；
                  ③ 羁绊（story.heartsPerHour）改为**安抚供给**（叠加后一起钳制）。 */
    if (GAME.story) {
      var hAdd = GAME.story.heartsPerHour();
      if (hAdd) s.heartsComfort = (s.heartsComfort || 0) + hAdd / 3600 * ts;
    }
    var _hf = DATA.HEARTS || {};
    var _dec = ((_hf.decayPerHour == null) ? 0.5 : _hf.decayPerHour) / 3600 * ts;
    if (s.heartsComfort) {
      var _cm = s.heartsComfort;
      s.heartsComfort = _cm > 0 ? Math.max(0, _cm - _dec) : Math.min(0, _cm + _dec);
    }
    GAME.applyHearts();

    /* 5) 幸存者增长：**逐城**向本城居所上限爬升（v60 · 需求 4：幸存者归属城市） */
    s.cities.forEach(function (city) {
      /* v89.185（老板 6）：「实际幸存者上限=幸存者上限*民心/100」——
         爬升目标改走 effPopCapOf（民心折算）；**只封增长、不削存量**：
         民心下滑时有效上限降低、幸存者停在原地（与资源"超上限只封增长"同规）。 */
      var maxPop = GAME.effPopCapOf(city);
      var growth = GAME.popGrowthOf(city);   /* v89.89（E3）：唯一出口（与募兵面板同源）；
                                                v89.126 起单位 = 人 / **现实小时**（补满 ≈ 2 小时） */
      var R = GAME.res(city);
      R.pop = R.pop || 0;
      /* v89.126：增量随口径改 —— 每现实小时 ÷ 3600 × **现实秒**（不再是 × 游戏秒 ts） */
      if (R.pop < maxPop) R.pop = Math.min(maxPop, R.pop + growth / 3600 * dtReal);
      city.maxPop = maxPop;
    });

    /* 6) 建造队列 */
    for (var i = s.queues.build.length - 1; i >= 0; i--) {
      var q = s.queues.build[i];
      q.elapsed += dtReal * ts;
      if (q.elapsed >= q.totalTime) {
        GAME.city.queueRemove('build', i);   /* v91.68 */
        GAME.applyBuildDone(q);
        /* v89.174：完成**脏标记** —— 主循环重绘不能只比队列条数：
           完成 1 条 + 自动升级同 tick 补 1 条时 length 不变（"读秒完了还是建造中"的另一成因）。 */
        GAME._buildDirty = true;
      }
    }
    /* 7) 训练队列（v24 · 需求 8：按军营分组，只有最早一条在走） */
    GAME.advanceTrainQueues(dtReal * ts);
    /* 8) 科技队列 */
    for (var k2 = s.queues.tech.length - 1; k2 >= 0; k2--) {
      var tq = s.queues.tech[k2];
      tq.elapsed += dtReal * ts;
      if (tq.elapsed >= tq.totalTime) {
        GAME.city.queueRemove('tech', k2);   /* v91.68 */
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
    /* v91.36（老板）：自动探索 —— 同上，只在**在线主循环**驱动。 */
    if (GAME.autoExplore) GAME.autoExplore();
    /* v91.59（老板）：自动采购 —— 同上，仅在线 tick（补货到目标量 · 受每日购买上限钳制）。 */
    if (GAME.autoBuy) GAME.autoBuy();
    /* v91.72（老板）：自动基因研究 —— 各城有空舱时自动立项、成熟自动收获。 */
    if (GAME.autoFarm) GAME.autoFarm();

    /* 9c) ⛔ v90.92 退役：随机任务每日刷新（ensureDailyQuests）随任务系统一并移除。 */

    /* 9d) 辖区岁贡：按现实日结算占城的持续收益（辖区特产材料 / 旧币 / 声望） */
    if (GAME.settleDailyYield) GAME.settleDailyYield();

    /* 9e) 野地：等级衰减（v89.185 起每现实日 -2 级 · 有驻军 -1 级）+ 采集计时推进 */
    if (GAME.decayWilds) GAME.decayWilds();
    if (GAME.tickGathers) GAME.tickGathers(ts);
    /* v73：基因实验室生长 —— 与建造队列同口径（dtReal × ts） */
    if (GAME.tickFarm) GAME.tickFarm(dtReal * ts);
    if (GAME.artTick) GAME.artTick(dtReal * ts);   // v79：神器供奉（在线主循环）

    /* 9f) 行军队列推进（抵达即结算 —— 见 battle.js GAME.march） */
    if (GAME.march && GAME.march.tick) GAME.march.tick();
    if (GAME.wonderTick) GAME.wonderTick();   /* v91.30：奇观探索推进（现实时间锚点 · 离线补算） */

    /* 10) 历法天时推进（story.js；年号纪元随 v90.93 退役，史册记账随 v89.218 退役） */
    if (GAME.story) GAME.story.tick(ts);

    /* 11) 逾溢折损（v89.160 · 老板 1）——**放在历法推进之后**：锚点读的是刚推进过的
       `world.elapsed`（游戏秒），与产出同一时间刻度；离线补算走 simulateBulk 的同名调用。 */
    if (GAME.settleOverflowRot) GAME.settleOverflowRot();
    /* 11b) v89.186（老板 3 · #6）：商旅税所 —— 我方前哨每游戏日结商税（同"游戏秒锚点"约定） */
    if (GAME.fortTaxSettle) GAME.fortTaxSettle();

    /* v90.92：任务系统退役 —— 原 checkProgressQuests（进度任务检查）已删。 */
  };

  /* 每秒产量（含加成链：科技/宝物/英雄/野地） */
  /* --------- 产量：基础 / 因子 / 分解（v20）---------
     需求 11 要求「悬停产量能看到基础产量与各类加成/扣除」。
     为避免「计算一处、展示另一处」的两份逻辑漂移，
     把因子抽取成单一来源 prodFactors()，计算与 UI 共用。 */

  /* 产量基数（每小时）：城外资源建筑 + 城战技能建筑
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
  /* v89.107：`mpGlobal` = **已算好的全境满级专精**（可选）。
     调用方在循环外算一次传进来 —— 见 cityProdPerSec / productionPerSec。
     不传则退回自己算（单次调用无妨；但**别放进逐城循环**：那是 O(城×格)/次）。 */
  GAME.prodFactors = function (r, city, mpGlobal) {
    var s = GAME.state, list = [];
    /* v92.18（B4 生存压力）：寒潮 —— **只削粮产**，不碰其他资源、不碰存量。
       玩家的应对手段就是平时多存粮，所以它必须能被提前看到（行政页有提示）。 */
    if (r === 'grain' && GAME.coldMulOf) {
      var _cm18 = GAME.coldMulOf();
      if (Math.abs(_cm18 - 1) > 1e-9) list.push({ name: '寒潮', d: _cm18 - 1 });
    }
    /* v93.3：**种子库**（拓荒队拿回来的）—— 粮产永久 +6%/次（最多 3 次）。
       这是全世界唯一买不到的东西，所以它必须真的出现在产量表里，
       否则"用命换"就只是战报上的一句话。 */
    if (r === 'grain' && GAME.convoy && GAME.convoy.seedMul) {
      var _sm93 = GAME.convoy.seedMul();
      if (Math.abs(_sm93 - 1) > 1e-9) list.push({ name: '旧种原种', d: _sm93 - 1 });
    }
    /* v92.22（B3 补完：民怨）—— 民心跌破 30，**全资源产出 −40%**。
       为什么用"阈值 + 固定惩罚"而不是"每天掷骰会不会民变"：
       掷骰是赌博（文档反复强调不要），阈值是可预判的 ——
       玩家看到民心 32 就知道"再跌下去要出事"，可以调税率救回来。
       死亡螺旋有下限：最多 −40%，且民心本来就由税率/战败驱动，不是单向的。 */
    if (city && GAME.cityHeartsOf) {
      var _hh = GAME.cityHeartsOf(city);
      if (_hh < 30) list.push({ name: '民怨（民心 ' + Math.round(_hh) + '）', d: -0.4 });
    }
    /* v89.191：产量科技按**本城**算（各城科技独立生效）—— 逐城循环里传 city，别回落当前城。 */
    var techMult = GAME.techMult(city);
    if (techMult[r]) list.push({ name: '科技', d: techMult[r] });
    var itemMult = GAME.prodBuffMult();
    if (itemMult[r]) list.push({ name: '宝物', d: itemMult[r] });
    var wildMult = GAME.wildMult(city);   /* v91.74：只吃本星球的野地加成 */
    /* v89.104（老板）：资源产出处的"附属野地"改成"野地"（省位置） */
    if (wildMult[r]) list.push({ name: '野地', d: wildMult[r] });
    if (GAME.story) {
      var sm = GAME.story.prodMult(r);
      if (sm && Math.abs(sm - 1) > 1e-9) list.push({ name: '天时（季/天候）', d: sm - 1 });
    }
    /* v101（B5）：**年景** —— 原来只影响新系统，主界面感觉不到"今年是什么年"。
       现在粮/铁这些老系统真的会变（丰年 +8% 粮、兴年 +10% 铁、战年 −5% 粮）。 */
    if (GAME.yearModsOf) {
      var _ym = GAME.yearModsOf();
      var _yd = _ym.prod && _ym.prod[r];
      if (_yd) list.push({ name: '年景（' + _ym.name + '）', d: _yd });
    }
    /* v98：**世界形态**（终局二选一）。
       接进去 → 全资源 +35%、税收 +20%；关灯 → 全资源 −10%。
       走 `prodFactors` 而不是另造乘数：这样 `prodBreakdown` 的拆账
       自动同口径（smoke 有一条断言钉着"各项之和 = 总值"）。 */
    if (GAME.ending && GAME.ending.prodAdd) {
      var _ea98 = GAME.ending.prodAdd(r);
      if (_ea98 && Math.abs(_ea98) > 1e-9) {
        list.push({ name: '世界形态（' + ((GAME.ending.optionOf() || {}).name || '') + '）', d: _ea98 });
      }
    }
    /* v63（老板）：「守将属性只对当前城市起加成作用」——
       这里改成**读本城守将**（唯一出口 `GAME.guardBonus(city)`）。
       改前是 `guardBonusTotal()`（全境所有守将之和），于是 B 城的守将
       也在给 A 城加产量；而 `cityProdPerSec(city)` 明明按城算基数，
       却是"本城的基数 × 全境的加成" —— 两个口径拼在一起，切城时数字还动。 */
    /* v89.113（老板需求 3）：产量走**城主**治理（守将的 nz 加成已随分职迁出） */
    var mbProd = GAME.mayorBonus ? GAME.mayorBonus(city) : { prod: 0 };
    if (mbProd.prod) list.push({ name: '城主治理', d: mbProd.prod });
    var wr = (s.workRate && s.workRate[r] != null) ? s.workRate[r] : 100;
    if (wr !== 100) list.push({ name: '开工率 ' + wr + '%', d: wr / 100 - 1 });
    /* v28（需求 1）：载具研究所/基因实验室/制造厂满级专精 —— 全城产量 +6%（逐座叠加）
       （建筑 id 仍是 honglusi，v89.74 只改了显示名） */
    if (GAME.mastery) {
      var mp = (mpGlobal != null) ? mpGlobal : GAME.mastery('prodPct', null);
      if (mp > 0) list.push({ name: '满级专精', d: mp });
    }
    return list;
  };

  /* 单城每秒产量（v29 · 需求 8）：与 productionPerSec 同一套因子，只换基数
     v60（需求 5）：再乘**名城档位优势**的 prodPct / taxPct ——
     这是"名城专有优势"的落地点（DATA.CITY_PERK），别处不要再按 type 加成。 */
  /* opt.mpGlobal：调用方已算好的**全境满级专精**（逐城循环里必须传 —— 否则每城
     都要做一次 O(城×格) 的全境扫描，100 城时 tickOnce 会涨到 10ms）。 */
  GAME.cityProdPerSec = function (city, opt) {
    var s = GAME.state, ts = GAME.timeScale();
    var out = { grain: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    if (!city) return out;
    /* v105（前传）：还没有城 —— 开局那点库存是**辎重**，不是城产。
       一处闸门断全部产出来源（拆账、结算、界面读的都是这个函数）。 */
    if (GAME.prologue && GAME.prologue.on()) return out;
    var mpG = (opt && opt.mpGlobal != null) ? opt.mpGlobal : null;
    /* v79：「本城产量」加成 = 名城档位 + 威望 + 主城 + 神器（唯一汇总口）
       v89.157（老板 4）：「资源产量的各种加成，应分别对**基础产量**加成，叠加的话有点夸张了」——
       旧口径是**连乘**（(1+a)(1+b)…），高配下叠乘放大幅度失真；现在改为**加法叠加**：
         总倍率 = 1 + Σ各加成（科技/宝物/野地/天时/城主治理/开工率/专精） + 本城加成。
       分解口径（prodBreakdown）与之一字不差 —— 各项之和 = 总值，不许两把尺。 */
    var perkProd = GAME.cityBonusNum(city, 'prodPct');
    var base = GAME.prodBasePerHourOf(city);
    for (var r2 in base) {
      var mAdd = perkProd;
      GAME.prodFactors(r2, city, mpG).forEach(function (f) { mAdd += (f.d || 0); });
      out[r2] = base[r2] * Math.max(0, 1 + mAdd) / 3600 * ts;
    }
    var popCap = GAME.maxPopOf(city);
    /* v73（老板「限制旧币的获取」）：税收按 DATA.GOLD_GATE.tax 收紧
       v89.162（老板「内政对税收也应有加成」）：城主治理 → 税收加成；
       v89.188（老板 3）：「减少一点，封顶 200%」—— 走独立率（MAYOR_CURVE.taxRate 0.006）
       且封顶（taxCap 2.0，产量/建造不受影响），与"税制加成"（名城/威望/主城/神器）
       **同层相加**（v89.157 的加法口径，不连乘）。 */
    var mbTax162 = GAME.mayorBonus(city).tax || 0;
    /* v89.204（老板 1）：税收按**城级民心**（含战争创伤 —— 民心受创的城，税收同步走低） */
    /* v91.72（老板）：+ 主城独有科技「税关直隶」（S.taxBonus，仅主城计入；与 taxPct 同层相加）。 */
    var _taxTech194 = (GAME.systems && GAME.systems.taxBonus) ? GAME.systems.taxBonus(city) : 0;
    var taxGold = popCap * (GAME.cityHeartsOf ? GAME.cityHeartsOf(city) : (s.hearts || 100)) / 100
      * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct') + mbTax162 + _taxTech194)
      * (DATA.GOLD_GATE.tax || 1);
    /* v89.157：旧币同口径（加法叠加）—— 宝物 / 天时各自作用于基础税收后相加 */
    var gm = 1 + (GAME.prodBuffMult().gold || 0);
    if (GAME.story) gm += (GAME.story.prodMult('gold') - 1);
    out.gold += taxGold * Math.max(0, gm) / 3600 * ts;
    return out;
  };

  /* 全境合计（每秒）：**各城实际增产之和** + 威望的俸禄收入（记在首城）。
     v60 起它不再是"另一套算法"，而是 Σ cityProdPerSec —— 否则
     侧栏"本城产量"与"全境合计"会用两把尺子（本项目最经典的失效模式）。
     俸禄只加到首城，是因为威望属于"府库"层面的收入，不该每城各算一遍。 */
  GAME.productionPerSec = function () {
    var s = GAME.state;
    var out = { grain: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
    if (!s) return out;
    /* v89.107：全境满级专精在循环外算一次（原来每个城×每个资源各算一遍 = O(城²×格)） */
    var mpG = GAME.mastery ? GAME.mastery('prodPct', null) : 0;
    ((s.cities) || []).forEach(function (c) {
      var p = GAME.cityProdPerSec(c, { mpGlobal: mpG });
      for (var k in out) out[k] += (p[k] || 0);
    });
    var salary = (DATA.RANK[s.rank || 0].salary || 0);
    if (salary) {
      var gm = 1, itemM2 = GAME.prodBuffMult();
      if (itemM2.gold) gm = 1 + itemM2.gold;
      if (GAME.story) gm *= GAME.story.prodMult('gold');
      /* v73（老板「限制旧币的获取」）：俸禄同口径收紧（DATA.GOLD_GATE.salary） */
      out.gold += salary * gm / 3600 * GAME.timeScale() * (DATA.GOLD_GATE.salary || 1);
    }
    return out;
  };

  /* 产量分解（/秒）：**加法分解**（v89.157 起每项 = 基础 × 本项增量），
     各项相加**正好等于**总产量。需求 11：悬停产量显示「基础 + 各类加成/扣除」。 */
  GAME.prodBreakdown = function (r, city) {
    var ts = GAME.timeScale();
    var rows = [];
    if (r === 'gold') {
      var s = GAME.state;
      /* v89.162（老板「内政对税收也应有加成」· 顺修）：税收分解与结算**逐项对齐** ——
         修"带税制加成（威望/名城/主城/神器）时分解之和 < 结算值"的分叉
         （这些加成此前只在 cityProdPerSec 里乘、分解里没有列 = 显示与结算两本账）。
         逐城求和（名城档位/主城因城而异 · 城主治理按城），与 cityProdPerSec 逐城相乘的结构同源。 */
      var _cts162 = city ? [city] : (s.cities || []);
      var _popC162 = 0, _taxBase162 = 0, _taxCity162 = 0, _taxMayor162 = 0;
      _cts162.forEach(function (ct) {
        var pop1 = GAME.maxPopOf(ct);
        _popC162 += pop1;
        /* v89.204：与 cityProdPerSec 同源 —— 逐城各按城级民心（战争创伤计入） */
        var b1 = pop1 * (GAME.cityHeartsOf ? GAME.cityHeartsOf(ct) : (s.hearts || 100)) / 100
          * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);
        _taxBase162 += b1;
        _taxCity162 += b1 * GAME.cityBonusNum(ct, 'taxPct');
        _taxMayor162 += b1 * (GAME.mayorBonus(ct).tax || 0);
      });
      /* v89.204：民心逐城各按城级值（战争创伤计入），汇总行不再显示单值 */
      rows.push({ name: '税收（幸存者' + U.numText(_popC162, 0) + '×民心×税率' + Math.round((s.tax || 0) * 100) + '%）', val: _taxBase162 / 3600 * ts });
      if (_taxCity162) rows.push({ name: '税制加成（名城/威望/主城/神器）', val: _taxCity162 / 3600 * ts });
      if (_taxMayor162) rows.push({ name: '城主治理', val: _taxMayor162 / 3600 * ts });
      var salary = (DATA.RANK[s.rank || 0].salary || 0) * (DATA.GOLD_GATE.salary || 1);
      /* 俸禄乘子（宝物×天时）走 productionPerSec 的原口径（连乘），直接给最终值一行 */
      var gmS162 = 1;
      var itemM = GAME.prodBuffMult();
      if (itemM.gold) gmS162 *= (1 + itemM.gold);
      var smg = 1;
      if (GAME.story) { smg = GAME.story.prodMult('gold'); gmS162 *= smg; }
      /* v89.179b·P1-5：俸禄是府库层面收入（productionPerSec 注释明言"俸禄只加到首城"），
         本城视图不应列出、更不应计入本城合计（否则每座城都显示同一笔全额俸禄，差 500 倍）。
         仅全境视图（!city）列出；本城视图留白即正确。 */
      if (salary && !city) rows.push({ name: '威望俸禄' + (Math.abs(gmS162 - 1) > 1e-9 ? '（含宝物/天时）' : ''), val: salary * gmS162 / 3600 * ts });
      /* 宝物/天时对**税收部分**：结算为加法（v89.157），逐项展开 —— 各项之和 = 总值 */
      var _taxAll162 = _taxBase162 + _taxCity162 + _taxMayor162;
      if (itemM.gold) rows.push({ name: '宝物加成 +' + Math.round(itemM.gold * 100) + '%', val: _taxAll162 * itemM.gold / 3600 * ts });
      if (GAME.story && Math.abs(smg - 1) > 1e-9) rows.push({ name: '天时（季/天候）' + (smg >= 1 ? '+' : '') + Math.round((smg - 1) * 100) + '%', val: _taxAll162 * (smg - 1) / 3600 * ts });
      return rows;
    }
    var base = ((city ? GAME.prodBasePerHourOf(city)[r] : GAME.prodBasePerHour()[r]) || 0) / 3600 * ts;
    rows.push({ name: '基础产量（城外建筑 + 城战技能建筑）', val: base });
    /* v89.157（老板 4）：加成**各自作用于基础产量再相加**（旧为连乘瀑布）——
       每项贡献 = 基础 × 本项增量；各项之和 = 总值（与 cityProdPerSec 同一把尺）。 */
    GAME.prodFactors(r, city).forEach(function (f) {
      rows.push({ name: f.name + ' ' + (f.d >= 0 ? '+' : '') + Math.round(f.d * 1000) / 10 + '%', val: base * f.d });
    });
    /* v89.179b·P1-4：补「本城加成」行（名城/威望/主城/神器）。
       cityProdPerSec 把 perkProd(cityBonusNum prodPct) 加进 mAdd，但分解漏列
       → 各项之和 < 结算值（威望 ≥1 必现，非名城也中招）。补上后各项之和 = 总值。 */
    var _perkP = GAME.cityBonusNum(city, 'prodPct');
    if (_perkP) rows.push({ name: '本城加成（名城/威望/主城/神器）', val: base * _perkP });
    return rows;
  };

  /* 科技产量加成（type 为资源键的）—— v89.191：按**那座城**的科技读（不传 = 当前城） */
  GAME.techMult = function (city) {
    var m = {};
    var isMain = GAME.isMainCity(city || GAME.currentCity());
    (DATA.TECH_ALL || DATA.TECH).forEach(function (t) {
      if (t.mainOnly && !isMain) return;          /* v91.72：主城独有科技只对主城生效 */
      var lv = GAME.systems.techLevel(t.id, city);
      if (lv > 0 && ['grain', 'wood', 'stone', 'iron'].indexOf(t.type) >= 0) {
        m[t.type] = (m[t.type] || 0) + lv * t.per;
      }
    });
    return m;
  };
  /* 宝物生产加成（v89.93 整改 W1：**到期真消费**）
     ------------------------------------------------------------
     改前只把 `s.buffs.prod[res]` 累加读出，而 `prodUntil` 写下后**全库无人读**
     （死字段）→ 描述里的"24h"形同虚设，生产符实际永久生效。
     现在：过期即剔除（顺带回写清理，避免脏数据被界面读到）；
     旧档没有 prodUntil 记录的资源一律按"仍生效"处理（向后兼容，不静默砍老档的 buff）。 */
  GAME.prodBuffMult = function () {
    var s = GAME.state, m = {}, now = U.now();
    var prod = (s.buffs || {}).prod, until = (s.buffs || {}).prodUntil || {};
    if (!prod) return m;
    Object.keys(prod).forEach(function (res) {
      var exp = until[res];
      if (exp != null && exp <= now) { delete prod[res]; delete until[res]; return; }
      m[res] = prod[res];
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

  /* v89.36（老板「维持军队无需耗净水」）：军队维持耗粮整体退役 ——
     `foodPerSecOf` / `foodPerSec` / `mutinyOf` / `starveStep` / `isStarving`
     与 v65 缺粮哗变规则一并移除（军队不再吃粮，断粮没有触发条件）。
     粮改为**募兵时一次性消耗**（DATA.TROOPS.cost.grain ×3）。 */


  /* ============================================================
   * 定期来袭（第 2 期 · 防守）—— 全部唯一出口
   * ------------------------------------------------------------
   *   invasionTick()            时间轮推进（**在线 tickOnce 与离线 simulateBulk 共用**）
   *   invasionDueAt(city)       本城下一次被袭时刻（**现实毫秒**；供界面读）
   *   invasionSlotOf(ms)        场次序号（现实时段分桶，每 realMin 分钟一桶）
   *   invasionDueOfSlot(n)      第 n 场的到来时刻（现实毫秒）
   *   invasionTargetOfSlot(n)   第 n 场的目标城（按场轮转）
   *   invasionSrcOf(city, n)    本场来袭的势力（唯一出口：预警与结算**同一个**）
   *   invasionIntelTextOf(...)  警讯敌情（按瞭望塔情报等级给详略）
   *   armyPowerOf(city)         本城兵力战力（单兵战力复用 story.troopPower，不另造出口）
   *   defensePowerOf(city)      本城守备力 —— **城防在这里被真正消费**
   *   invasionPowerOf(city, n)  本次来袭规模
   *   invasionResolve(city, src, n)  结算（第 3 参 = 场次序号）
   * v89.115（老板「为啥每分钟都被打一次」）：节奏口径 = **现实时间**（真实世界时钟）。
   *   状态 `s.inv = { lastSlot, warnedSlot }` —— 跨时间且会被修改，**必须入存档**。
   *   演进：v89.111 的 {lastDay, warnedDay}（游戏日）→ v89.115 的 slot 版；
   *   更早的 `city.inv`（每城各排各的）已在 v89.111 退役。
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
     ⚠️ 这一行就是"让围墙/箭塔真正生效"的接口：`GAME.cityDefense` 已含
     围墙等级 ×20、箭塔 homeDef、守将谋略、羁绊守御、满级专精 +25%。 */
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
    var base = total * (lo + r0 * (hi - lo));
    /* v92.24：**势力越大，远征越凶**。以前强度只跟玩家战力挂钩 ——
       你打不打它、它长多大，都不影响下一场有多重。现在会。 */
    if (GAME.faction && GAME.faction.attackerIdOf) {
      var _fid24 = GAME.faction.attackerIdOf(city);
      if (_fid24) {
        var _arr24 = GAME.faction.arr ? GAME.faction.arr() : [];
        for (var _i24 = 0; _i24 < _arr24.length; _i24++) {
          if (_arr24[_i24].id === _fid24) { base *= (1 + _arr24[_i24].r * 0.04); break; }
        }
      }
    }
    return Math.max(1, Math.round(base));
  };

  /* ============================================================
   * v89.109（老板「为警报防御战提供战报回放，等同出征战报」）：
   *   来袭从"一次比值结算"改成**真打一场** —— 走战斗引擎、与出征同规格。
   *   本函数把「来袭战力」（`invasionPowerOf`，与玩家全境战力同口径）拆成一支军队：
   *   按 `DATA.INVASION.mix` 权重分兵种，并用 `story.troopPower` 折算人头，
   *   使这支军队的战力 ≈ 目标战力（"看起来多少兵，就是多少兵"）。
   * ============================================================ */
  GAME.invasionArmyOf = function (city, cycle) {
    var I = DATA.INVASION || {};
    var power = GAME.invasionPowerOf(city, cycle);
    var mix = I.mix || { buxingji: 0.52, dunwei: 0.18, daodanche: 0.18, fujiche: 0.12 };   /* v89.229：18→14 映射（步行机 0.30+步行机 0.22 → 步行机 0.52） */
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var wsum = 0, perMan = 0;
    for (var k in mix) {
      wsum += mix[k] || 0;
      var _v = tp ? tp(k) : 1;
      perMan += (mix[k] || 0) * (typeof _v === 'number' && _v > 0 ? _v : 1);
    }
    perMan = (perMan / (wsum || 1)) || 1;
    var total = Math.max(1, Math.round(power / perMan));
    /* ⚠️ 分配必须**保底非空**：total=1 时五个 round(0.3/0.22/…) 全是 0 ——
       军队成了空对象 → 引擎跑出"0 回合、双方 0 人、判定守方胜"（本轮白查一次的坑）。
       口径：按权重取整，**余数补到最后一项**（总量恒等于 total）。 */
    var out = {}, left = total, lastK = null;
    for (var k2 in mix) { lastK = k2; }
    for (var k3 in mix) {
      var n3;
      if (k3 === lastK) n3 = left;
      else { n3 = Math.round(total * (mix[k3] || 0) / (wsum || 1)); if (n3 > left) n3 = left; }
      if (n3 > 0) { out[k3] = n3; left -= n3; }
    }
    if (left > 0 && lastK) out[lastK] = (out[lastK] || 0) + left;
    return { army: out, power: power, total: total };
  };

  /* ============================================================
   * v89.111（老板）：「自动攻城固定每日9点即可，提前4h提醒一次，
   *   无需频繁报告来袭预警」+「其他势力攻打，警报警讯显示其军队来袭剩余时间」
   * v89.115（老板「为啥每分钟都被打一次」）：节奏口径二改 ——
   *   v89.111 的"游戏日"在 600× 下等于每 2.4 现实分钟一场（老板挂机一小时挨 25 场）。
   *   现改为**现实时间**：每 `realMin` 分钟一场、目标城按场轮转、提前 `warnMin` 分钟预警一次。
   *   两代的共同点（保留）：
   *     · 目标城**轮转**：`cities[场次 % 城数]` —— 确定、可预判、人人有份；
   *     · 预警只报一次：进窗即报、同场不补报。
   * 更早的"每城各排各的 + 城越多间隔越短"整套口径已在 v89.111 退役
   * （invasionIntervalSec 已删）。
   * ============================================================ */
  /* ============================================================
   * v89.115（老板「为啥每分钟都被打一次」）：来犯周期 —— **现实时间时段**
   * ------------------------------------------------------------
   * 病根：旧口径"每日 9 时（游戏时）"在 600× 时速下 = 每 2.4 现实分钟一场
   * （老板日志：23:34 打主城、23:36 打新城2、23:37 破门 —— 三分钟三场）。
   * 老板在 v89.113 定过原则：**特定游戏活动采用真实世界时间**（自动攻城同办）。
   * 现在以现实毫秒分桶（每 realMin 分钟一桶），桶号 = 场次序号：
   *   invasionSlotOf(realMs)   → 场次序号（预警 / 结算 / 界面全读它）
   *   invasionDueOfSlot(n)     → 第 n 场的到来时刻（现实毫秒时间戳）
   *   invasionTargetOfSlot(n)  → 第 n 场的来犯目标城（轮转）
   * 退役：invasionDayOf / invasionDueOfDay / invasionTargetOfDay（游戏日口径）。
   * ============================================================ */
  /* 现实时间唯一出口（毫秒）—— 测试/探针可覆写 `GAME._realNowOf` 拨钟 */
  GAME.realNow = function () { return GAME._realNowOf ? GAME._realNowOf() : U.now(); };
  /* v89.118（老板需求 3）：「是否接受外敌来犯」的**唯一出口**。
     默认接受；`settings.invasion === false` 即"拒战"（自动化 · 外敌来犯 的开关写它）。
     —— 语义收口在此：invasionDueAt / invasionTick / 界面开关全读这一个函数，
     不再散落 `settings.invasion === false` 的比较式（两处已改读本出口）。 */
  GAME.invasionAcceptOn = function () {
    var s = GAME.state || {};
    return !(s.settings && s.settings.invasion === false);
  };
  GAME.invasionSlotOf = function (realMs) {
    var I = DATA.INVASION || {};
    var P = (I.realMin == null ? 30 : I.realMin) * 60 * 1000;
    return Math.floor((realMs == null ? GAME.realNow() : realMs) / P);
  };
  /* 第 n 场的到来时刻（现实毫秒；n 可为当前或历史场次序号） */
  GAME.invasionDueOfSlot = function (n) {
    var I = DATA.INVASION || {};
    var P = (I.realMin == null ? 30 : I.realMin) * 60 * 1000;
    return Math.floor(n) * P;
  };
  /* 第 n 场的来犯目标城（按场轮转；城列表为空 → null） */
  GAME.invasionTargetOfSlot = function (n) {
    var s = GAME.state;
    var list = (s && s.cities) || [];
    if (!list.length) return null;
    var n2 = list.length;
    var i = ((Math.floor(n) % n2) + n2) % n2;
    return list[i];
  };
  /* 本城**下一次**被袭时刻（现实毫秒时间戳）—— 界面 / 瞭望塔闪烁 / 断言都读这里 */
  GAME.invasionDueAt = function (city) {
    var I = DATA.INVASION || {};
    if (!city) return 0;
    var s = GAME.state;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || !GAME.invasionAcceptOn()) return 0;
    var list = s.cities || [];
    if (list.length < need) return 0;
    var idx = list.indexOf(city);
    if (idx < 0) return 0;
    var slot = GAME.invasionSlotOf(GAME.realNow());
    var n = list.length;
    var t = ((slot % n) + n) % n;
    /* 轮不到本城 → 排到轮到的那一场；本轮就是本城（= 刚打过 / 正在打）→ 下一轮 */
    var d = (t !== idx) ? (slot + (((idx - t) % n) + n) % n) : (slot + n);
    return GAME.invasionDueOfSlot(d);
  };
  /* 本场来袭的势力 —— **唯一出口**：预警报的和结算打的必须是同一个（"报谁就是谁来"）。
     参数 = 本场的**场次序号**（invasionSlotOf 的返回值）—— 预警与结算传同一个号。 */
  GAME.invasionSrcOf = function (city, slotIdx) {
    var I = DATA.INVASION || {};
    /* v92.24：**如果是某家势力的领地压到你这座城，那就是它来打你** ——
       名字要对得上（预警报谁，就是谁来），这条与"报谁打谁"的旧铁律同源。 */
    if (GAME.faction && GAME.faction.attackerOf) {
      var _fa24 = GAME.faction.attackerOf(city);
      if (_fa24) return _fa24;
    }
    var arr = I.sources || ['敌军'];
    return arr[Math.floor(GAME.invasionRoll('src|' + (city && city.id) + '|' + slotIdx) * arr.length)];
  };
  /* 瞭望塔情报等级（0 ~ intelBeaconMax）：不再改"提前量"，改管敌情详略 */
  GAME.invasionIntelLvOf = function (city) {
    var I = DATA.INVASION || {};
    return Math.min(I.intelBeaconMax == null ? 3 : I.intelBeaconMax,
      (city && GAME.buildingLevel(city, 'fenghuotai')) || 0);
  };
  /* 警讯里的敌情一段（唯一出口：警报页与警报警讯共用）——
     Lv0：只报势力；Lv1：+战力；Lv2+：+兵种明细（按数量取前 3 项）。
     参数 = 场次序号（invasionSlotOf 的返回值）。 */
  GAME.invasionIntelTextOf = function (city, slotIdx) {
    var lv = GAME.invasionIntelLvOf(city);
    var txt = '「' + GAME.invasionSrcOf(city, slotIdx) + '」';
    /* v89.204（老板 1）：本城**民心警示**（独立于瞭望塔情报等级 —— 民心是自家账） */
    if (GAME.cityHeartsOf) {
      var _h204 = GAME.cityHeartsOf(city);
      if (_h204 <= 0) txt += '💔 民心已尽·城破即失';
      else if (_h204 <= 20) txt += '💔 民心仅 ' + Math.round(_h204) + '%·再败即尽';
      else if (_h204 <= 40) txt += '💔 民心仅 ' + Math.round(_h204) + '%';
    }
    if (lv < 1) return txt;
    var ia = GAME.invasionArmyOf ? GAME.invasionArmyOf(city, slotIdx) : null;
    if (!ia) return txt;
    if (ia.power) txt += ' · 约 ' + U.fmt(ia.power) + ' 战力';
    if (lv >= 2 && ia.army) {
      var arr = [];
      for (var k in ia.army) { if (ia.army[k]) arr.push([k, ia.army[k]]); }
      arr.sort(function (a, b) { return b[1] - a[1]; });
      var bits = arr.slice(0, 3).map(function (x) {
        return (DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : x[0]) + ' ×' + U.fmt(x[1]);
      });
      if (arr.length > 3) bits.push('等');
      if (bits.length) txt += '（' + bits.join('、') + '）';
    }
    return txt;
  };

  /* 结算：按 攻/守 比值算战损。返回明细供日志与断言读。 */
  /* 结算一场来犯（v89.115：第 3 参 = **场次序号** —— 兵力/势力/战力都按它确定性生成；
     预警与结算必须传同一个号，缺省取"当前场次"）。 */
  /* v89.191（老板 3-④）：守城结算全程把科技读点钉在**被攻的那座城** ——
     set-if-unset（重放/挂起已有的快照上下文优先），try/finally 还原。 */
  GAME.invasionResolve = function (city, srcName, slotIdx) {
    var _Sys191 = GAME.systems;
    var _bak191 = _Sys191 ? _Sys191._techCtx : null;
    var _set191 = false;
    if (_Sys191 && _Sys191._techCtx == null) { _Sys191._techCtx = GAME.techsOf(city); _set191 = true; }
    try {
      return GAME._invasionResolveRun(city, srcName, slotIdx);
    } finally {
      if (_set191) _Sys191._techCtx = _bak191;
    }
  };
  GAME._invasionResolveRun = function (city, srcName, slotIdx) {
    var I = DATA.INVASION || {};
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;     /* 游戏秒：计谋生效期等仍走游戏时间 */
    var cycle = (slotIdx == null) ? GAME.invasionSlotOf(GAME.realNow()) : Math.floor(slotIdx);
    var atk = GAME.invasionPowerOf(city, cycle);
    var def = GAME.defensePowerOf(city);
    /* ratio ∈ (0,1)：越接近 0 说明守方越强。
       （保留为"表观战力比"—— severity 与消息展示仍用它；胜负判定改为**真打**。） */
    var ratio = atk / (atk + def || 1);

    /* ---- v89.109：真打一场（与出征同一引擎）----
       守方 = 我方驻军 + 守将 + 城防工事；**读玩家的防守战术**（ctx.playerDef），
       含「出城迎战」——野战军挡在城外时，敌人连墙都拆不到（见 tactic.actSide）。 */
    var ia = GAME.invasionArmyOf(city, cycle);
    /* v89.116（老板「守城的战斗报告仍然是假的」· 病根之一）：
       这里原来写 `GAME.guardOf(city)` —— **该函数不存在**（真名 `guardGeneralOf`），
       三元判断永远落 null：守将不进战斗、战报永远写「（无守将）」。
       守将加成（tactic 的 cover=1 全覆盖）因此从未在守城战里生效过。 */
    var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
    var wallLv = GAME.buildingLevel ? (GAME.buildingLevel(city, 'chengqiang') || 0) : 0;   /* v89.128：环城槽经 buildingLevel 统一读 */
    var towers = GAME.towerCountOf ? (GAME.towerCountOf(city) || 0) : 0;
    var defVal = GAME.cityDefense ? (GAME.cityDefense(city) || 0) : 0;
    var defArmy0 = U.deep(city.army || {});        /* 战前快照（战报与配方用） */
    /* v89.116：结算入参**先落成一个对象** —— 沙盘配方要用**与结算完全同一批输入**
       （另写一份必漂移；`sandboxRecipeOf` 内部会深拷贝，不会与本次结算互相污染）。 */
    var simOpts = {
      kind: 'city', sieging: true, defName: city.name,
      wallLv: wallLv, towers: towers, playerDef: true,
      /* v109（C2 坚守）：**兵力明显不如人**的时候，守方的目标不是消灭对手，
         是"撑到天亮"。ratio（攻方表观战力占比）> holdAt 才切换 ——
         守得住的城照旧打歼灭战，只有守不住的仗才变成"守城"。
         这一档是**系统替你选的**（没有 UI 之前先这样），战报会写明。 */
      obj: (function () {
        try {
          var GO = (GAME.DATA && GAME.DATA.GOALS) || {};
          var holdAt = GO.holdAt == null ? 0.62 : GO.holdAt;
          if (!(ratio > holdAt)) return null;
          return { kind: 'hold', rounds: GO.holdRounds || 6 };
        } catch (e) { return null; }
      })(),
      /* v96：守城时**我方守军**也吃兵员等级（这座城训到几级就是几级） */
      defLv: (GAME.trooplv && GAME.trooplv.mapOf) ? GAME.trooplv.mapOf(city) : null,
    };
    var result = null;
    /* v89.118：与出征同办 —— **开打那一刻的加成快照**（科技/天时/羁绊/战鼓）。
       守城的战报沙盘也要靠它才能与史实同源（30h 试玩实测：守城一路同样 verify=false）。 */
    var _boost118 = GAME.battle.boostSnapshot ? GAME.battle.boostSnapshot(city) : null;
    try {
      var _runSim118 = function () {
        return GAME.tactic.simulate(ia.army, null, city.army, defVal, guard, simOpts);
      };
      result = (GAME.battle.withBoost ? GAME.battle.withBoost(_boost118, _runSim118) : _runSim118());
    } catch (e) {
      result = null;
      if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 战斗异常：', e);
    }
    var held = result ? result.winner === 'def' : (ratio <= 0.5);   /* 引擎异常 → 旧口径兜底 */
    var gate = result ? GAME.battle.lootGateOf(result, { kind: 'city' }) : { ok: true, msg: '' };
    /* v89.109（老板「只有打破围墙并杀死出城迎战的军队，才能进行资源掠夺」）：
       敌得手（winner='atk'）**且过城防闸**才掠得到 —— 与"我方掠夺 NPC"同一把闸。 */
    var lootOk = result ? (result.winner === 'atk' && gate.ok) : !held;

    var severity = held
      ? ratio * 0.35                                  // 守住：也折损，但不是零代价
      : Math.max(0, (ratio - 0.5) * 2);               // 被破：ratio 刚过 0.5 时从 0 起
    /* v86：坚壁清野 —— 生效期内损失 −40%（severity 是唯一的损失总闸） */
    var _jb = GAME.schemeDefOf(city, 'jianbi', now);
    if (_jb) severity *= (1 - _jb.eff.invLossCut);
    var L = I.loss || {};
    var out = { atk: atk, def: def, ratio: ratio, held: held, severity: severity,
      resLost: {}, troopsLost: 0, wallDrop: 0, lootOk: lootOk, src: srcName || '',
      battle: result ? {
        rounds: result.rounds, atkRemain: result.atkRemain, defRemain: result.defRemain,
        atkLoss: result.atkLoss, defLoss: result.defLoss,
        towerStart: result.towerStart, towerLeft: result.towerLeft,
        sortieStart: result.defSortieStart || 0, sortieLeft: result.defSortieLeft || 0,
      } : null };

    /* ---- 兵损：按战斗引擎的逐兵种损失扣（与出征同口径）；引擎异常 → 旧比例口径兜底 ---- */
    /* v86 坚壁清野：**一切损失** −40% —— v89.109 起兵损改走引擎明细（不再经 severity），
       折扣必须在这里同样折进去，否则"坚壁清野"会突然只保资源、不保人。 */
    var jbMul = _jb ? (1 - _jb.eff.invLossCut) : 1;
    /* v89.113（老板「守城为什么没有伤兵」）：守城战与出征**同源伤兵回收** ——
       阵亡者按 woundedRate 折算为伤兵入营（可花旧币治疗归队）。
       改前这里直接 `-= nl` 就完了，伤兵营永远空着 —— 老板实际看到的就是"守城没有伤兵"。
       v89.186：率走**唯一出口** GAME.woundedRateOf —— 守城也吃商品/科技
       （改前只读 base，玩家买的伤兵书在守城不生效）。 */
    var wRate = GAME.woundedRateOf ? GAME.woundedRateOf(null) : 0.75;
    if (result) {
      var lossBy = result.defLossBy || {};
      for (var tk in lossBy) {
        var nl = Math.floor(Math.min(lossBy[tk] || 0, city.army[tk] || 0) * jbMul);
        if (nl > 0) {
          GAME.city.armySub(city, { [tk]: nl }); out.troopsLost += nl;
          var wnd = Math.floor(nl * wRate);
          if (wnd > 0) {
            s.woundedArmy = s.woundedArmy || {};
            s.woundedArmy[tk] = (s.woundedArmy[tk] || 0) + wnd;
            s.wounded = (s.wounded || 0) + wnd;
            out.wounded = (out.wounded || 0) + wnd;
          }
        }
      }
    } else {
      var tpct = severity * (L.troopPct || 0.10);
      for (var t2 in city.army) {
        var lose2 = Math.floor((city.army[t2] || 0) * tpct);
        if (lose2 > 0) { GAME.city.armySub(city, { [t2]: lose2 }); out.troopsLost += lose2; }
      }
    }

    /* ---- 掠夺资源：**只有敌得手且破防**才扣（v89.109 老板令） ---- */
    if (!held && lootOk) {
      var R = GAME.res(city);
      for (var k3 in { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1 }) {
        var pct = severity * (L.resPct || 0.15);
        var lost = Math.floor((R[k3] || 0) * pct);
        if (lost > 0) { GAME.city.sub(city, k3, lost); out.resLost[k3] = lost; }   /* v91.67 */
      }
    }
    /* ---- 围墙掉级：破防得手才掉（与"墙被打穿"语义对齐） ---- */
    if (!held && lootOk && (L.wallDrop || 0) > 0) {
      var wl = GAME.buildingLevel(city, 'chengqiang') || 0;
      if (wl > 0) {
        /* v89.128：围墙在环城槽（不占格）—— 掉级写回槽（唯一写口 wallSlotOf） */
        var _ws128 = GAME.wallSlotOf(city);
        var _nl128 = Math.max(0, wl - (L.wallDrop || 1));
        _ws128.build = _nl128 <= 0 ? null : { id: 'chengqiang', lvl: _nl128 };
        out.wallDrop = L.wallDrop || 1;
      }
    }
    /* v89.113（老板「战斗胜利为什么没有俘虏」）：守城得手同样俘获溃卒 ——
       敌军损失（result.atkLoss）按同一张俘虏表收编为民（kind 'defense'）。 */
    if (held && result && GAME.battle && GAME.battle.captiveGain) {
      try {
        /* v89.116：把敌军（= 攻方）的逐兵种损失表一起传进去（俘虏营按兵种列清单） */
        var _cap113 = GAME.battle.captiveGain(city, result, { kind: 'defense' },
          result.atkLoss || 0, result.atkLossBy);
        if (_cap113 && _cap113.gain > 0) {
          out.captives = _cap113;
          GAME.log.war('🪶 俘获溃卒：' + city.name + ' +' + U.fmt(_cap113.gain) + ' 人（入俘虏营 · 可收编入军）');
        }
      } catch (e3) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 俘虏异常：', e3);
      }
    }
    /* v89.149（老板 1）：**守城视角**落一笔战功声望（我方 = 守方）——
       敌军 = 攻方 → 歼灭军力读 `atkLossBy`（视角由 `battleRepView` 显式转换，
       不靠猜字段 —— 与 v89.116「captiveGain 靠 target 猜视角必错」同一条教训）。
       口径与出征同源（GAME.battle.grantBattleRep 唯一出口，表在 DATA.REP_RULE）。 */
    if (result && GAME.battle && GAME.battle.grantBattleRep) {
      try {
        GAME.battle.grantBattleRep(result, 'def', held, '守城');
      } catch (e4) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 声望异常：', e4);
      }
    }
    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }

    /* ---- v89.204（老板 1）：**败方失去 20 点民心**（我方战败 → 本城战争创伤 +20）----
       民心归零 + 敌军得手（城破）→ 城市被敌方占领（主城 / 缺省首城 / 最后一座城由
       GAME.cityFallen 双闸保护 —— 老板原话：「除主城不可被占领外」）。
       开关：DATA.INVASION.loseCity（v89.204 起 true）。 */
    if (!held && GAME.heartsWarAdd && (DATA.INVASION || {}).loseCity !== false) {
      var _loss204 = ((DATA.SIEGE || {}).heartsLoss != null) ? DATA.SIEGE.heartsLoss : 20;
      GAME.heartsWarAdd(city, _loss204);
      out.heartsLoss = _loss204;
      out.cityHearts = GAME.cityHeartsOf ? GAME.cityHeartsOf(city)
        : (GAME.heartsOf ? GAME.heartsOf() : 100);
      if (out.cityHearts <= 0 && lootOk && GAME.cityFallen) {
        var _fall204 = GAME.cityFallen(city, srcName);
        if (_fall204 && _fall204.ok) out.cityFallen = _fall204;
      }
    }

    /* ---- v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘」）----
       防御战**照给沙盘配方**：视角 atk=来犯敌军 / def=我方守军（含出城迎战部队），
       围墙与箭塔一并入画。此前一律 `sandbox:null`（注释理由是"视角固定攻方，会把双方画反"）
       —— 正确解法是**给视角**，不是不给沙盘。 */
    if (result) {
      try {
        out._sandbox = GAME.battle.sandboxRecipeOf(result, ia.army, null, defArmy0, defVal, guard,
          simOpts, {
            place: { kind: 'city', name: city.name },
            ourSide: 'def',
            wall: { lv: wallLv, towers: towers },
            boost: _boost118,          /* v89.118：加成快照随配方走（重跑装回） */
          });
      } catch (e4) {
        out._sandbox = null;
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 沙盘配方异常：', e4);
      }
    }
    /* ---- 战报（v89.109：与出征同规格 —— 公文·战报页可见、可逐回合回放） ---- */
    if (result) {
      try {
        GAME.invasionReport(city, srcName, result, out, ia, defArmy0, guard);
      } catch (e2) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 战报异常：', e2);
      }
    }
    return out;
  };

  /* 防御战战报（v89.109）—— 与出征战报**同结构**：进公文、可回放/看兵损表。
     独立成函数：让 invasionResolve 主体保持可读，且战报异常不拖垮结算。
     ⚠️ 不给 `sandbox`（沙盘推演的视角固定"攻方 = 我方"）—— 防御战我方在守方，
        给了会把双方画反；`replay`（分回合关键帧）与 `scene`（战场条带）是视角中性的，照给。 */
  GAME.invasionReport = function (city, srcName, r, out, ia, defArmy0, guard) {
    var s = GAME.state;
    var src = srcName || '流寇';
    var held = out.held;
    var defMen0 = 0, scoutN = 0;
    for (var dk in defArmy0) {
      defMen0 += (defArmy0[dk] || 0);
      /* v89.113（老板「军队数量对不上」）：把"未列阵"的侦察单元单独点出来 ——
         战斗表只统计参战部队（侦察单元 nocombat 不列阵不挨打），而界面上驻军是含侦察单元的，
         两个数不说明白就是"对不上"。 */
      if (DATA.TROOPS[dk] && DATA.TROOPS[dk].nocombat) scoutN += (defArmy0[dk] || 0);
    }
    var defFight = Math.max(0, defMen0 - scoutN);
    var lines = [];
    /* v89.113：首行口径一次说全 ——
       来犯：兵力 + **战力**（与预警同一出口 ia.power）；
       守军：**参战**人数（与战斗表同口径）+ 未列阵侦察单元 + 统带守将 + **本城守备力**（界面同源）。 */
    lines.push('来犯 ' + U.numText(ia.total || 0, 0) + ' 众（约 ' + U.numText(ia.power || 0, 0)
      + ' 战力 · ' + U.escape(src) + '）　守军 ' + U.numText(defFight, 0) + ' 众'
      + (scoutN > 0 ? '（另 ' + U.numText(scoutN, 0) + ' 侦察单元未列阵）' : '')
      + ((r.defSortieStart || 0) > 0 ? '（其中出城迎战 ' + U.numText(r.defSortieStart, 0) + ' 众）' : '')
      + (guard ? '（' + U.escape(guard.name) + ' 统带）' : '（无守将）')
      + '　守备力 ' + U.numText(out.def || 0, 0));
    lines.push('鏖战 ' + r.rounds + ' 回合：歼敌 ' + U.numText(r.atkLoss, 0)
      + ' · 我军阵亡 ' + U.numText(r.defLoss, 0));
    if (r.towerStart > 0) {
      lines.push('城防工事：拆毁 ' + (r.towerStart - r.towerLeft) + ' / ' + r.towerStart
        + ' 座（余 ' + r.towerLeft + '）');
    }
    if ((r.defSortieStart || 0) > 0) {
      lines.push('出城迎战：' + U.numText(r.defSortieStart, 0) + ' 众，战后余 '
        + U.numText(r.defSortieLeft || 0, 0));
    }
    if (held) {
      lines.push('【守土】敌军铩羽而归，库藏未失。');
    } else if (out.lootOk) {
      var a = [];
      for (var k in out.resLost) a.push(GAME.resName(k) + ' −' + U.fmt(out.resLost[k]));
      lines.push('【遭劫】' + (a.join('、') || '（库藏已空，无物可掠）'));
    } else {
      lines.push('【未破防】敌军破门却未能搬空库藏 —— 围墙 / 野战军仍在，劫掠不成。');
    }
    /* v89.204（老板 1）：民心行 —— 战败失 20 民心；民心尽时城陷 */
    if (out.cityFallen && out.cityFallen.ok) {
      lines.push('【城陷】' + city.name + ' 民心尽失，为 ' + U.escape(src) + ' 所据！残部退守 '
        + U.escape((out.cityFallen.receiver && out.cityFallen.receiver.name) || '余城')
        + '（城市易主，整军可复）');
    } else if (out.heartsLoss) {
      lines.push('【民心】民心 −' + out.heartsLoss + '（余 ' + Math.round(out.cityHearts)
        + '）—— 民心尽时，此城将为敌方所据（得胜可夺其民心 · 每胜 20）');
    }
    if (out.wallDrop) lines.push('围墙 −' + out.wallDrop + ' 级');
    /* v89.113：伤兵入营 + 俘获溃卒（与出征战报同款口径） */
    if (out.wounded > 0) lines.push('我军伤兵 ' + U.numText(out.wounded, 0) + ' 入营（可花旧币治疗归队）');
    if (out.captives && out.captives.gain > 0) {
      /* v89.116：按兵种列出来（老板：「不要一个总数量」） */
      var _cp2 = [];
      for (var _ck2 in (out.captives.byType || {})) {
        if (!out.captives.byType[_ck2]) continue;
        _cp2.push((DATA.TROOPS[_ck2] ? DATA.TROOPS[_ck2].name : (_ck2 === 'unknown' ? '来历不明' : _ck2))
          + ' ×' + U.numText(out.captives.byType[_ck2], 0));
      }
      lines.push('俘获 ' + U.numText(out.captives.gain, 0) + ' 众入营'
        + (_cp2.length ? '（' + _cp2.join('、') + '）' : '')
        + '　·　军务处·俘虏营可收编入军（费旧币 = 兵种造价的 50%）');
    }
    var rep = {
      t: U.now(), type: 'defense',
      title: ((out.cityFallen && out.cityFallen.ok) ? '🏴 城陷'
        : (held ? '🛡 守土' : (out.lootOk ? '💥 城破' : '⚠ 城破未掠')))
        + ' · ' + src + '来袭 · ' + city.name,
      body: '<b>' + (held ? '守土成功' : '城门失守') + '</b>　·　' + U.escape(city.name)
        + '<br>' + lines.join('<br>'),
      win: held,
      loss: {
        atkStart: r.atkStartBy || {}, atkLoss: r.atkLossBy || {},
        defStart: r.defStartBy || {}, defLoss: r.defLossBy || {},
      },
      scene: GAME.battle.compactScene(r),
      replay: GAME.battle.replayFramesOf(r),
      /* v89.116：防御战**给沙盘**（`out._sandbox` 由 invasionResolve 建好）——
         视角 `ourSide:'def'`：敌军在左、我军守城在右，围墙画在我方一侧。 */
      sandbox: out._sandbox || null,
      underdog: GAME.battle.underdogOf ? GAME.battle.underdogOf(r, 'def') : null,
      siege: null,
      defense: { src: src, lootOk: out.lootOk,
        sortieStart: r.defSortieStart || 0, sortieLeft: r.defSortieLeft || 0 },
    };
    s.reports.unshift(rep);
    while (s.reports.length > (DATA.REPORT_MAX || 60)) {
      var drop = -1;
      for (var ri = s.reports.length - 1; ri >= 0; ri--) { if (!s.reports[ri].fav) { drop = ri; break; } }
      if (drop < 0) break;
      s.reports.splice(drop, 1);
    }
    s.repUnread = (s.repUnread || 0) + 1;
    return rep;
  };

  /* ============================================================
   * v89.107（老板）：「有警报时，建筑瞭望塔颜色明暗闪烁」
   * ------------------------------------------------------------
   * 预警窗 = 唯一出口。三处都读它，不许各算一份：
   *   · invasionTick 的报信分支（「🔥 警报：…」消息）
   *   · 军务 · 警报页（预警/布防/流水）
   *   · 城内棋盘上瞭望塔的闪烁（ui.buildCellHTML 挂 .alarm）
   * v89.111（老板「提前4h提醒一次」）：窗口改**固定提前量**，
   *   瞭望塔不再改变"提前量" —— 它改管**情报等级**（bc 字段即情报级，供文案用）。
   * v89.115：提前量口径改**现实时间**（warnMin 分钟），left 单位为现实秒。
   * ============================================================ */
  GAME.invasionWarnSec = function (city) {
    var I = DATA.INVASION || {};
    /* v89.115：提前量改**现实时间**（分钟 → 秒） */
    return { bc: GAME.invasionIntelLvOf(city),
      warnSec: (I.warnMin == null ? 5 : I.warnMin) * 60 };
  };
  /* 有警报 → 返回 { due, left(现实秒), mins, beaconLv }；不在窗口内 → null */
  GAME.invasionAlertOf = function (city) {
    var due = GAME.invasionDueAt(city);
    if (!due) return null;
    var w = GAME.invasionWarnSec(city);
    var leftSec = Math.round((due - GAME.realNow()) / 1000);   /* v89.115：现实时间口径 */
    if (leftSec > w.warnSec || leftSec <= 0) return null;
    return { due: due, left: leftSec, mins: Math.max(1, Math.round(leftSec / 60)),
      beaconLv: w.bc, warnSec: w.warnSec };
  };

  /* 时间轮推进 —— **在线 tickOnce 与离线 simulateBulk 共用这一处**。
     v89.115（老板「为啥每分钟都被打一次」）：结算粒度 = **现实时段**（每 realMin 分钟一场）；
     离线按场补算，但**最多补 catchUpMax 场**（离开太久不该回来挨十几刀）。
     gameHours：保留参数（旧调用点仍传）—— 本函数的节奏已不看游戏时间。 */
  GAME.invasionTick = function (gameHours) {
    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (!GAME.invasionAcceptOn()) return 0;
    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if ((s.cities || []).length < need) return 0;
    var nowGame = (s.world && s.world.elapsed) || 0;      /* 游戏秒：计谋生效期仍读它 */
    var nowR = GAME.realNow();
    var slot = GAME.invasionSlotOf(nowR);
    /* 首次（含旧档迁移）：从**本场**起算 —— 不在进城瞬间就挨一场。
       旧档的 {lastDay, warnedDay} 是游戏日序号，与现实时段序号不同源，直接重建。 */
    if (!s.inv || s.inv.lastSlot == null) s.inv = { lastSlot: slot, warnedSlot: -1 };
    var fired = 0, skipped = 0, guard = 0;
    var cap = I.catchUpMax == null ? 3 : I.catchUpMax;
    /* 补算：跨过的每一场各结算一场；超过上限的场次"敌军见无隙可乘自行散去" */
    while (s.inv.lastSlot < slot && guard++ < 400) {
      var d = s.inv.lastSlot + 1;
      s.inv.lastSlot = d;
      if (fired >= cap) { skipped++; continue; }
      var city = GAME.invasionTargetOfSlot(d);
      if (!city) break;
      /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；当场照常推进）。
         显式读 eff.invSkip：效果键必须有字面读取点（防死数据，smoke §71 守）。 */
      var _kc = GAME.schemeDefOf(city, 'kongcheng', nowGame);
      if (_kc && _kc.eff.invSkip) {
        GAME.schemeDefConsume(city, 'kongcheng', nowGame);
        GAME.log.beacon('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
        continue;
      }
      var src = GAME.invasionSrcOf(city, d);       /* 与预警同一个出口："报谁就是谁来" */
      var detail = GAME.invasionResolve(city, src, d);
      fired++;
      /* v92.24：**战果回写势力** —— 这才是"世界在反击"的闭环：
         你顶住了，它的版图缩（它记住你）；它破了你的城，版图涨（它尝到甜头）。
         以前这一场无论谁赢，世界都毫无变化，下一场还是照刷。 */
      try {
        var _fa24b = (GAME.faction && GAME.faction.attackerIdOf) ? GAME.faction.attackerIdOf(city) : null;
        if (_fa24b) {
          var _fr24 = GAME.faction.onInvasionResult(_fa24b, detail.held);
          if (_fr24) GAME.log.beacon((detail.held ? '📉 ' : '📈 ') + _fr24.msg);
        }
      } catch (e24) { /* 回写失败绝不能拖垮结算 */ }
      var head = detail.held
        ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
        : (detail.lootOk
          ? '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : '⚠️ ' + city.name + ' 城门失守但**未被掠**（' + src + ' 未能破防）');
      var bits = [];
      for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));
      if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
      if (detail.wallDrop) bits.push('围墙 −' + detail.wallDrop + ' 级');
      if (detail.repDrop) bits.push('声望 −' + detail.repDrop);
      if (detail.battle) bits.push('战报已入公文（' + detail.battle.rounds + ' 回合）');
      GAME.log.beacon(head + (bits.length ? '：' + bits.join('、') : ''));
    }
    if (skipped > 0) {
      GAME.log.beacon('🌿 离城期间另有 ' + skipped + ' 场来犯：敌军见城中有备、无隙可乘，自行散去');
    }
    /* ---- 预警：下一场的提前 warnMin **现实分钟**内只报一次 ----
       （老板：「无需频繁报告来袭预警」—— 到点前至多这一条；离线跨场不补报历史） */
    var nextSlot = s.inv.lastSlot + 1;
    var nextDue = GAME.invasionDueOfSlot(nextSlot);
    var left = Math.round((nextDue - nowR) / 1000);        /* 现实秒 */
    var warnSec = (I.warnMin == null ? 5 : I.warnMin) * 60;
    if (left > 0 && left <= warnSec && s.inv.warnedSlot !== nextSlot) {
      var tgt = GAME.invasionTargetOfSlot(nextSlot);
      if (tgt) {
        s.inv.warnedSlot = nextSlot;
        GAME.log.beacon('🔥 警报：' + GAME.invasionIntelTextOf(tgt, nextSlot) +
          '将于 ' + U.dur(left) + '后（现实时间）犯『' + tgt.name + '』');
        if (GAME.sfx) GAME.sfx('alarm');     /* v89.93（E4）：警报警讯音 */
      }
    }
    return fired;
  };

  /* 建造完成 */
  GAME.applyBuildDone = function (q) {
    var s = GAME.state;
    if (GAME.sfx) GAME.sfx('build');      /* v89.93（E4）：落成有声音（反馈层） */
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
      GAME.log('城外' + (DATA.EXT_BUILDINGS[q.buildId] ? DATA.EXT_BUILDINGS[q.buildId].name : '建筑') + (q.type === 'ext_build' ? '建造完成' : '升级至 Lv' + q.targetLevel), 'sys', 'build');
      return;
    }
    /* v89.126 / v89.128：围墙走通用路径（type 'build'/'upgrade'，槽位 'wall'）——
       环城槽与 cells 共用同一套 cellOf 访问器；两个旧时代的分支
       （wallLv 直写 / 找格）都已退役，见老档迁移（adoptState）。 */
    var city = GAME.cityById(q.cityId);
    if (!city) return;
    var idx = q.gridIndex;
    var cell = GAME.cellOf(city, idx);   /* v89.128：'wall' 槽同样生效 */
    if (!cell) return;
    if (q.type === 'build') {
      if (cell.build) return;           // 该格已有建筑，丢弃过期队列项
      /* v89.220（老板 3）：hiLv = 本座历史最高（科技闸存量宽限的基准，新建即第 1 级） */
      cell.build = { id: q.buildId, lvl: 1, hiLv: 1 };
      cell.pending = null;
    } else if (q.type === 'upgrade') {
      if (!cell.build) return;          // 建筑已在施工期间被拆毁
      cell.build.lvl = q.targetLevel;
      /* v89.220（老板 3）：历史最高随升级往上记（只增不减 —— 拆了也能升回） */
      cell.build.hiLv = Math.max(cell.build.hiLv || 0, q.targetLevel);
      cell.pending = null;              // v16：升级完成必须清施工标记
      /* 政务厅 4 格同步升级 */
      if (cell.build.id === 'guanfu') {
        city.cells.forEach(function (c) {
          if (c.build && c.build.id === 'guanfu') {
            c.build.lvl = q.targetLevel;
            c.build.hiLv = Math.max(c.build.hiLv || 0, q.targetLevel);
          }
        });
      }
    }
    GAME.statBump('buildDone', 1);
    GAME.log('建筑完成：' + (DATA.BUILDINGS[q.buildId] ? DATA.BUILDINGS[q.buildId].name : q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''), 'sys', 'build');
  };

  /* 训练完成 */
  /* v99：战事标记 —— 兵源模块读它判断"周围在打仗"（流民概率 ×1.7） */
  GAME.markWarMonth = function () {
    var s = GAME.state;
    if (!s) return;
    var C = DATA.CALENDAR || {};
    var spm = (C.secPerYear || 57600) / 12;
    s.lastWarMonth = Math.floor(((s.world && s.world.elapsed) || 0) / spm);
  };

  GAME.applyTrainDone = function (t) {
    var city = GAME.cityById(t.cityId);
    if (!city) return;
    GAME.city.armyAdd(city, { [t.troopId]: t.count });
    GAME.statBump('trained', t.count);
    GAME.log('训练完成：' + (DATA.TROOPS[t.troopId] ? DATA.TROOPS[t.troopId].name : t.troopId) + ' ×' + t.count, 'sys', 'admin');
  };

  /* 科技完成 */
  GAME.applyTechDone = function (tq) {
    var s = GAME.state;
    if (GAME.sfx) GAME.sfx('levelup');    /* v89.93（E4） */
    /* v89.191（老板 3-④）：等级写回**发起城**（老档无 cityId 的条目 → 主城 → 首城）。
       找不到任何城（异常数据）→ 只发日志，不抛错。 */
    var _ct191 = (tq.cityId && GAME.cityById(tq.cityId)) || GAME.mainCityOf() || (s.cities || [])[0] || null;
    var _tt191 = _ct191 ? GAME.techsOf(_ct191) : null;
    if (_tt191) _tt191[tq.techId] = (_tt191[tq.techId] || 0) + 1;
    GAME.statBump('techDone', 1);
    var name = tq.techId;
    (DATA.TECH_ALL || DATA.TECH || []).forEach(function (t) { if (t.id === tq.techId) name = t.name; });
    GAME.log('科技完成：' + name + (_ct191 ? '（' + _ct191.name + ' Lv' + ((_tt191 && _tt191[tq.techId]) || 0) + '）' : ''),
      'sys', 'admin');
  };

  GAME.cityById = function (id) {
    var s = GAME.state;
    if (!s) return null;
    for (var i = 0; i < s.cities.length; i++) if (s.cities[i].id === id) return s.cities[i];
    return null;
  };
  /* ============================================================
   * v91.41：**跨星球**按 id 找城（自动探索要对**所有**星球逐城派队）。
   * `GAME.cityById` 只查**当前星球分片**（s.cities）—— 异星球的城 id 查不到。
   * 这里再扫各星球分片（含背景 slice 与 mapSlices[id].cities），返回**该城实际所属**的对象。
   * 注意背景片的城是 `U.deep` 拷贝 → 改它（扣兵/改城）后须 `_savePlanetSlice(pid)` 落回，
   * 否则下次 `_loadPlanetSlice` 覆盖丢失（见 autoExplore）。
   * ============================================================ */
  GAME.cityByIdAnywhere = function (id) {
    return GAME.cityById(id);                       /* v91.74：世界数据全局一份，无需扫分片 */
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
  GAME.log = function (msg, kind, sub) {
    var s = GAME.state;
    if (!s) return;
    s.log.unshift({ t: U.now(), msg: msg });
    if (s.log.length > 40) s.log.pop();
    var gt = (s.world && s.world.elapsed) || 0;
    /* v89.107：消息**类别在发射点声明**（第二参数），落库为 k。
       未声明 / 写错 → 落 sys（系统消息）：分类值域见 DATA.MSG_KINDS（唯一来源）。 */
    var k = (kind && DATA.MSG_KIND_BY && DATA.MSG_KIND_BY[kind]) ? kind : 'sys';
    var rec = { t: U.now(), gt: gt, msg: msg, k: k };
    /* v89.153（老板 2）：第三参数 = **主题**（天时/建造/采集收获……）——
       系统页小标签按它筛（读取走唯一出口 GAME.msgSubOf）；非法值不落库（宁缺勿错）。 */
    if (sub && DATA.MSG_SUB_BY && DATA.MSG_SUB_BY[sub]) rec.sub = sub;
    GAME.sessionLog.push(rec);
    s.msgLog = s.msgLog || [];
    /* v129（逐屏核查抓到）：同一条消息在**很短时间内重复**时合并成一条 + 计数。
       病根：`fog.decay()` 在离线补算里被逐段调用，一次补算能写 24 条一模一样的
       「远方的记忆淡了：182 格…」，公文第一页全是同一句，别的消息全被顶走。
       只合并**连续 + 同文案 + 同类别 + 同主题**的重复，不跨消息合并。 */
    var _prev = s.msgLog.length ? s.msgLog[s.msgLog.length - 1] : null;
    var _win = ((DATA.CALENDAR && DATA.CALENDAR.secPerYear) || 57600) / 360;   /* 1 游戏天 */
    if (_prev && _prev.msg === rec.msg && _prev.k === rec.k
        && (_prev.sub || '') === (rec.sub || '')
        && Math.abs((rec.gt || 0) - (_prev.gt || 0)) <= _win) {
      _prev.n = (_prev.n | 0) + 1;
      _prev.gt = rec.gt; _prev.t = rec.t;
      GAME.pruneMsgLog();
      if (GAME.onLog) GAME.onLog(msg);
      return;
    }
    s.msgLog.push(rec);
    GAME.pruneMsgLog();
    /* v89.116：`GAME.onLog` 是**试玩工具挂的钩子**（
       .workbuddy/tools/playtest/play_600x.js 等：`G.onLog = msg => EV.push(...)`，
       用来在跑测里收集全量日志）—— 本仓**故意不定义**它，不是死代码。
       静态审计 audit.js ⑥ 把它列在白名单里（原因同此）。 */
    if (GAME.onLog) GAME.onLog(msg);
  };
  /* 分类命名空间：`GAME.log.beacon('🔥 警报：…')` —— 与 GAME.log(msg,'beacon') 等价，
     只是不必动调用点的括号（多行拼接的消息用括号形式要动语句边界，容易改坏）。 */
  ['war', 'scout', 'beacon', 'task', 'sys'].forEach(function (k) {
    GAME.log[k] = function (msg) { return GAME.log(msg, k); };
  });
  /* v89.153：**主题**命名空间 —— `GAME.log.gather(msg, 'sys')` 等价于第三参数传 'gather'
     （kind 缺省落 sys；军事类主题可显式传 'war'）。 */
  ['era', 'weather', 'build', 'gather'].forEach(function (sub) {
    GAME.log[sub] = function (msg, kind) { return GAME.log(msg, kind || 'sys', sub); };
  });
  /* 类别读取的**唯一出口**：新记录读声明值；旧档（v89.107 之前无 k）按旧界面那套
     粗分兜底 —— 只为老档看得见，新消息一律走声明。 */
  GAME.msgKindOf = function (rec) {
    if (!rec) return 'sys';
    if (rec.k && DATA.MSG_KIND_BY && DATA.MSG_KIND_BY[rec.k]) return rec.k;
    var m = rec.msg || '';
    return /战|攻|败|损/.test(m) ? 'war' : (/任务|改元/.test(m) ? 'task' : 'sys');
  };
  /* ============================================================
   * v89.153：消息**主题**与**系统页池**（两个唯一出口）
   * ------------------------------------------------------------
   *   · `GAME.msgSubOf(rec)` —— 一条消息在系统页里属于哪个小标签：
   *       有 sub 按 sub（天时 / 建造 / 采集收获……）；
   *       否则按 kind：war → 军情 · task → 任务 · sys → 系统。
   *     标签 id **就是返回值**（era/weather/build/gather/war/task/sys）——
   *     界面 chips、筛选、颜色三处全读它，不另立映射表。
   *   · `GAME.msgFeedOf()` —— 系统页的消息池：军情 + 任务 + 系统**三源合一**、
   *     按时间倒序（scout / beacon 不入：前者有自己的页签，后者在军务 · 警报）。
   * ============================================================ */
  GAME.msgSubOf = function (rec) {
    if (!rec) return 'sys';
    if (rec.sub && DATA.MSG_SUB_BY && DATA.MSG_SUB_BY[rec.sub]) return rec.sub;
    return GAME.msgKindOf(rec);
  };
  GAME.msgFeedOf = function () {
    var out = [], list = GAME.msgLog();
    for (var i = 0; i < list.length; i++) {
      var k = GAME.msgKindOf(list[i]);
      if (k === 'war' || k === 'task' || k === 'sys') out.push(list[i]);
    }
    return out.reverse();                     /* 新消息在前 */
  };
  /* 公文页取用：按类别过滤（页签、计数、正文三处同源，别再各筛一遍） */
  GAME.msgsOf = function (kind) {
    var out = [];
    var list = GAME.msgLog();
    for (var i = 0; i < list.length; i++) {
      if (GAME.msgKindOf(list[i]) === kind) out.push(list[i]);
    }
    return out.reverse();                     /* 新消息在前 */
  };

  /* ============================================================
   * v89.120（老板「战报有异常跳转」）：报告身份 = **rid**（自增号），
   *   不再是"数组下标"。
   * ------------------------------------------------------------
   * 病根：界面把"渲染那一刻的数组索引"写进行上（data-i）与闭包里
   *   （modalPage 的 rlog 回调 `viewReportText(i)`），而 `state.reports`
   *   是**会被 unshift 位移**的可变数组（新战报永远插在最前）、
   *   列表页又不随主循环重绘 —— 旧索引于是指向位移后的另一份报告
   *   （实测：点掠报正文的「下页」/列表行，弹出的却是侦察报告）。
   * 修法：每份报告一个**稳定身份 rid**，行与闭包都带 rid，
   *   `repByRid` 是唯一的"按身份取报告"出口 —— 数组怎么变都不再错位。
   * 老档兼容：首次访问惰性赋号（rid 随存档走 —— savePayload 整档序列化）。
   * 被裁掉的报告 rid 不复用（自增号只增不减）。
   * ============================================================ */
  GAME.repRidOf = function (r) {
    if (!r || typeof r !== 'object') return 0;
    if (!r.rid) {
      var s = GAME.state || (GAME.state = {});
      s.repSeq = (s.repSeq || 0) + 1;
      r.rid = s.repSeq;
    }
    return r.rid;
  };
  GAME.repByRid = function (rid) {
    rid = Number(rid) || 0;
    if (!rid) return null;
    var list = (GAME.state && GAME.state.reports) || [];
    for (var i = 0; i < list.length; i++) {
      if (GAME.repRidOf(list[i]) === rid) return list[i];
    }
    return null;
  };

  /* ============================================================
   * v86（老板「按计划进行」· 第四轮 G1）：计谋 / 封存匣 —— 唯一出口组
   * ------------------------------------------------------------
   * 状态存储：`s.schemes = { [key]: { [sid]: { n, day, until } } }`
   *   · n     = 累计施计次数（挑拨离间：忠诚 = 100 − loyaltyDrop × n）
   *   · day   = 最近一次施计的游戏日（挑拨离间"对同一城每日限一次"）
   *   · until = 防御计到期时刻（游戏秒）
   * 运行中会被修改 → **入存档**（随 s 序列化）。
   * Key 规则（schemeKeyOf）：NPC 城 'npc:<id>'、据点 'fort:<id>'、
   *   野地 'w:x,y'；防御计布在自己城上，独立前缀 'my:<cityId>'。
   * 费用：精力扣在施计英雄 gen.energy（与出征同一条链）；
   *   封存匣走 s.items.jinang（游商道具）。
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
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服提神剂' };
    }
    var have = (s.items && s.items.jinang) || 0;
    if (have < sc.jinang) {
      return { ok: false, msg: '封存匣不足（' + have + '/' + sc.jinang + '），可在游商购买' };
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
    GAME.items.sub('jinang', sc.jinang);   /* v91.63：走归属出口 */
    var key = GAME.schemeKeyOf(t);
    s.schemes = s.schemes || {};
    var rec = s.schemes[key] = s.schemes[key] || {};
    var r = rec[sid] = rec[sid] || { n: 0 };
    r.n++;
    r.day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    GAME.log.war('🎴 ' + gen.name + ' 施展「' + sc.name + '」：' + sc.tip
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
    GAME.items.sub('jinang', sc.jinang);   /* v91.63：走归属出口 */
    var key = 'my:' + city.id;
    s.schemes = s.schemes || {};
    var rec = s.schemes[key] = s.schemes[key] || {};
    rec[sid] = rec[sid] || { n: 0 };
    rec[sid].n++;
    rec[sid].until = now + sc.durH * 3600;
    GAME.log.beacon('🎴 布防「' + sc.name + '」于 ' + city.name + '：' + sc.tip
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
     wildSceneOf / wildSceneCheck / wildSceneDo 三函数已并入下方「荒野行动」出口组
     （GAME.jianghuCheck / GAME.jianghuDo 的 kind:'scene' 分支）——
     数据、锁（s.jianghu）、扣费、种子化、UI 入口全部统一走荒野行动。 */

  /* ============================================================
   * v88（老板「改造培养系统」）：辐能双轨 + 荒野行动 —— 唯一出口组
   * ------------------------------------------------------------
   * ① 双轨切换：g.equipOn = 'sha'（机甲）| 'ling'（基因）。
   *    分流唯一出口 systems.equipBagOf -> genEquipBonus；六维/体力/战斗/
   *    界面显示全部消费该出口 —— 切换后全链自动同步（零特判）。
   * ② 机能（lingPowerOf）：基因强化件汇总（Σ lingv x 调校系数）。
   *    **独立于六维与战斗公式** —— 只用于荒野行动判定（与当前生效套无关）。
   * ③ 荒野行动：与 v87 地形场景并存（场景=趣味奇遇一次；荒野=基因活动菜单，
   *    每处**每活动**每日一次，锁 s.jianghu = { 'x,y|act': day }）。
   *    消耗精力+体力；判定看机能；风险=负伤（不损兵）；产出=辐能核心+低概率装备；
   *    结果种子化（invasionRoll，同一天同一地同一活动稳定可复现）。
   * ============================================================ */
  GAME.lingPowerOf = function (g) {
    if (!g) return 0;
    var bag = g.lingEquip || {}, t = 0;
    for (var slot in bag) {
      var inst = bag[slot];
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!it || !it.lingv) continue;
      /* v89.211：调校乘数收敛到 GAME.eqLingMulOf（唯一出口；装备描述 equipDescOf 同源） */
      t += it.lingv * (GAME.eqLingMulOf ? GAME.eqLingMulOf(inst) : 1);
    }
    return Math.round(t);
  };

  /* 双轨切换：want 省略 = 来回切；显式给 'sha'/'ling' 则定向 */
  GAME.toggleEquipSet = function (genId, want) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '英雄不存在' };
    /* v89：改造线君主专属 —— 非君主一切切换请求拒绝，并归位机甲（老档兜底） */
    if (!GAME.canCultivate(g)) {
      if (g.equipOn === 'ling') g.equipOn = 'sha';
      return { ok: false, msg: '基因强化乃君主专属 —— 只有君主可切换基因强化' };
    }
    var cur = g.equipOn || 'sha';
    var next = (want === 'sha' || want === 'ling') ? want : (cur === 'sha' ? 'ling' : 'sha');
    if (next === cur) return { ok: false, msg: '当前已是' + (next === 'ling' ? '基因强化' : '机甲部件') };
    g.equipOn = next;
    var n = Object.keys(((next === 'ling') ? g.lingEquip : g.equip) || {}).length;
    GAME.log(g.name + ' 换装：' + (next === 'ling' ? '🧬 基因强化' : '⚙ 机甲部件') + '（' + n + ' / 12 件）', 'sys', 'staff');
    return { ok: true, msg: '已切换为' + (next === 'ling' ? '🧬 基因强化' : '⚙ 机甲部件'), set: next };
  };

  /* v89.45（老板：「将野地的荒野行动板块剥离，不体现在游戏中，但资产保留」）：
     野地荒野行动**组件挂载开关**。false = 野地呈现层全剥离（面板区块 / 点选状态行 / 地图青旗）；
     底层资产与逻辑（DATA.LING_ACT 活动表 · DATA.JH_SPREAD / JH_MARK · GAME.jianghu* 判定/扣费/结算 ·
     ui.jianghuHTML / drawJhPennant 函数体 · 逸闻故事资产）全部保留。
     **后续重新挂载**：把这里改成 true 即可，无需改动其它代码（四处 guard 自动恢复呈现）。 */
  GAME.jianghuWildMounted = false;
  /* --------- 荒野行动 --------- */
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
  GAME.jianghuActsAt = function (ci) {
    var cell = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[ci] : null;
    if (!cell) return [];
    /* v91.25：城格（我方城/NPC 名城）无荒野事 —— 与 map.terrainAt（=city）同口径。 */
    if (GAME.map && ((GAME.map.ownCityAt && GAME.map.ownCityAt(ci)) || (GAME.map.npcAt && GAME.map.npcAt(ci)))) return [];
    var cands = GAME.jianghuCands(cell.type);
    if (!cands.length) return [];
    var sp = DATA.JH_SPREAD || {};
    var r = function (salt) { return GAME.invasionRoll('jhsp|c' + ci + '|' + salt); };
    var roll0 = r('any');
    if (roll0 < (sp.noneP != null ? sp.noneP : 0.3)) return [];
    var want = roll0 < (sp.p2 != null ? sp.p2 : 0.62) ? 1
      : (roll0 < (sp.p3 != null ? sp.p3 : 0.87) ? 2 : 3);
    var list = cands.slice().sort(function (a2, b2) { return r('o:' + a2.id) - r('o:' + b2.id); });
    return list.slice(0, Math.min(want, list.length));
  };
  /* v89.5：灵机之地 —— 有事的野地中「值得专程一访」者（大地图悬青旗）。
     灵机 = 事数 × 野地等级，≥ DATA.JH_MARK.minScore 者为地标（mark）。
     返回 null = 此地无荒野事（荒僻 / 非野地地形）。地图渲染与点选信息共用此出口。 */
  GAME.jianghuSpotInfo = function (ci) {
    var acts = GAME.jianghuActsAt(ci);
    if (!acts.length) return null;
    var lv = GAME.map.wildLevelNow(ci);
    var score = lv * acts.length;
    var th = (DATA.JH_MARK && DATA.JH_MARK.minScore != null) ? DATA.JH_MARK.minScore : 10;
    return { n: acts.length, lv: lv, score: score, mark: score >= th };
  };

  /* ⛔ v90.80（老板「去除奇遇系统」）：v89.6「奇遇 · 见闻录」引擎整条退役 ——
   wonderState / wonderSites / wonderSiteOf / wonderSurvey / wonderClueRoll / wonderClueText /
   _jhClueAttach / wonderCheck / wonderSpend / wonderRoll 共 12 出口全清（数据层 DATA.WONDER/WONDERS 同步清；
   UI / 地图悬星 / main 动作 / 测试见各自墓碑与 smoke §80 退役记录）。 */

  GAME.jianghuDone = function (s, ci, actId, day) {
    return ((s.jianghu || {})['c' + ci + '|' + actId]) === day;
  };
  GAME.jianghuCheck = function (ci, genId, actId) {
    var s = GAME.state;
    var cell = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[ci] : null;
    if (!cell) return { ok: false, msg: '目标格越界' };
    var a = (DATA.LING_ACT || {})[actId];
    if (!a) return { ok: false, msg: '无此荒野活动' };
    if (!a.spots || a.spots.indexOf(cell.type) < 0) {
      return { ok: false, msg: ((DATA.TERRAIN[cell.type] || {}).name || '此地') + '做不了「' + a.name + '」' };
    }
    /* v89.4：逐地分布闸门 —— 此处野地今日并没有这桩事（随缘而现） */
    var avail4 = false;
    GAME.jianghuActsAt(ci).forEach(function (k) { if (k.id === actId) avail4 = true; });
    if (!avail4) return { ok: false, msg: '此处野地无「' + a.name + '」—— 荒野之事随缘而现，换一处看看' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的英雄' };
    /* v89：荒野行动君主专属（主角单修）—— 与装备/调校同一道闸门 */
    if (!GAME.canCultivate(gen)) return { ok: false, msg: '荒野行动乃君主亲历之事 —— 只有君主可前往' };
    if ((gen.energy || 0) < a.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + a.energy + '），可服提神剂' };
    }
    if (GAME.staNow(gen) < a.stam) {
      return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + a.stam + '），休整后再来' };
    }
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    if (GAME.jianghuDone(s, ci, actId, day)) {
      return { ok: false, msg: '「' + a.name + '」此地今日已做过，明日再来' };
    }
    return { ok: true, act: a, gen: gen, day: day, lv: GAME.map.wildLevelNow(ci), ci: ci, actId: actId };
  };
  /* v89：内核拆三段 —— Check（jianghuCheck）/ Spend（扣费+落锁）/ Roll（抽结果）。
     全屏剧本流程（GAME.scene*，见下）与 one-shot 入口（jianghuDo）共用同一份内核，
     保证「改了判定只改一处」。 */
  GAME.jianghuDo = function (ci, genId, actId) {
    var chk = GAME.jianghuCheck(ci, genId, actId);
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
    s.jianghu['c' + chk.ci + '|' + chk.actId] = chk.day;
    return { ok: true };
  };
  GAME.jianghuRoll = function (chk, mods) {
    var s = GAME.state;
    var a = chk.act, gen = chk.gen, day = chk.day, lv = chk.lv;
    var _jc = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[chk.ci] : null;
    var tile = { terrain: (_jc && _jc.type) || 'plain' };
    var seedBase = 'jh|c' + chk.ci + '|' + chk.actId + '|' + day;
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
    /* 机能（读基因强化件；与当前生效套无关） */
    var ling = GAME.lingPowerOf(gen);
    var texts = [];
    var bad = false;
    var ess = function (lo, hi, salt, tag) {
      var n = mi(rnd(salt || 'ess', lo, hi));
      GAME.items.add('lingsui', n);   /* v91.63 */
      texts.push('辐能核心 +' + n + (tag ? '（' + tag + '）' : ''));
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
      /* 机能判定：我方战力 =（机能 + 等级 x2）x 种子波动；难度随野地等级 +35%/级 */
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
        GAME.items.add('lingsui', tot);   /* v91.63 */
        texts.push('辐能核心 +' + tot + '（过 ' + layer + ' 层）');
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
      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false, grade: 'win' };
    } else if (a.kind === 'scene') {
      /* 地形专属（v87 -> v88.1 整合）：产出原样（旧币/净水/材料/珠宝/道具/豪杰）。
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
        GAME.items.add(id, n);   /* v91.63 */
        var it0 = (DATA.ITEMS || []).filter(function (x2) { return x2.id === id; })[0];
        texts.push((it0 ? it0.name : id) + '×' + n);
      };
      if (out2.gold && home2) {
        var gn2 = mi(rnd('gold', out2.gold[0], out2.gold[1]));
        GAME.res(home2).gold = (GAME.res(home2).gold || 0) + gn2;
        texts.push('旧币 +' + gn2);
      }
      if (out2.grain && home2) {
        var gr2 = mi(rnd('grain', out2.grain[0], out2.grain[1]));
        GAME.res(home2).grain = (GAME.res(home2).grain || 0) + gr2;
        texts.push('净水 +' + gr2);
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
            GAME.items.add(bk3, bag2[bk3]);
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
          GAME.gen.add(gg3);   /* v91.65 */
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
      return { ok: true, name: out2.t, text: texts.join('、'), bad: bad,
        grade: (out2.wound ? 'lose' : (out2.none ? 'partial' : 'win')) };
    }
    var body = texts.join('、');
    if (!body) { body = '此行无所获'; bad = true; }
    /* v89：结局分级（全屏剧本据此选专属退出结算屏） */
    var grade = bad ? 'lose' : 'win';
    if (a.kind === 'trial') grade = bad ? 'lose' : ((title === '三层皆过') ? 'win' : 'partial');
    if (a.kind === 'cultivate') grade = bad ? 'lose' : ((title === '悟道时刻') ? 'win' : 'partial');
    GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + title + '（' + body + '）');
    return { ok: true, name: a.name + ' · ' + title, text: body, bad: bad, grade: grade };
  };

  /* ⛔ v90.93 退役：**全屏剧本**（荒野场景流程）整条 ——
     老板「去掉纪事剧本」中的「全屏剧本」。
     现行口径：荒野活动按钮 → **一次性结算**（one-shot，ui.doJianghu）。
     内核（jianghuCheck / jianghuSpend / jianghuRoll）原样保留 ——
     一次性结算本就是它原本就有的「无剧本兜底」出口。 */
  /* ============================================================
   * ⛔ v89.218（老板）：「故事全部去除，不再保留史册，故事集」——
   * 故事库引擎（GAME.SG：清单 / 待阅 / 掷骰 / 动作触发 / 结算）整条退役；
   * 内容层 story/（84 卷）已删，阅读器与「史册 / 故事集」两视图在 ui.js 同步移除。
   * 老档残留：s.sgPending / s.sgArchived / s.stories 不再被读取（无消费者，
   * 随下次存档自然消失）—— 不做迁移。
   * ============================================================ */
})();
