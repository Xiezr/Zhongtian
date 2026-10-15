# v89.177 补丁 A：引擎层 —— ① 民心公式（HEARTS 表 + 出口组 + tick 改造）
#   ② 鼓舞民心/消减民怨措施（每日一次 · 耗金币）③ 君主突破综合考验（trials）
import io

ROOT = 'E:/Deepseekdb/'
def read(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(f, tag, old, new):
    s = read(f)
    # 幂等 guard：用 new 里独有特征串（不用第一行——通用行会撞车）
    marker = None
    for cand in ['DATA.HEARTS = {', 'GAME.heartsBaseOf = function', 'heartTrialOf75', 'doHeartsAction', 'trials: [']:
        if cand in new and cand in s:
            marker = cand
            break
    if marker:
        print('[skip] ' + tag + '（已在：' + marker + '）'); return
    c = s.count(old)
    assert c == 1, tag + ' 锚点命中 ' + str(c) + ' 次'
    s = s.replace(old, new)
    write(f, s)
    print('[ok] ' + tag)

D = 'js/data.js'
S = 'js/state.js'
M = 'js/domain.js'

# ============================================================
# A1 data.js：DATA.HEARTS 表
# ============================================================
rep(D, 'A1 DATA.HEARTS',
"""  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100,""",
"""  /* ============================================================
   * v89.177（老板「民心=100-税率*100」+「官府界面增加鼓舞民心，消减民怨的措施各 1 个」）
   * ------------------------------------------------------------
   * **民心公式（唯一口径）**：
   *     民心 = clamp( 100 − 税率×100 + 安抚 , 0, 100 )
   *     民怨 = 100 − 民心
   *   · 基准项 100 − 税率×100 由税率**直接派生**（调整税率即时反映）；
   *   · 安抚（`s.heartsComfort`）是"措施 / 祥瑞 / 事件"给的**累计偏移**，
   *     随时间（每游戏小时）向 0 回落 —— 停手后自然滑回基准线。
   * 经济含义：税收 ∝ 人口 × 民心 × 税率 = 人口 × tax×(1−tax) —— **拉弗曲线**，
   *   峰值在 50% 税率（系数 0.25）；高税换来的只是民怨与更低的税基。
   *   玩家可用金币「买安抚」把民心抬回基准之上（100 封顶）——
   *   这就是金币的新消耗点与「彰显其价值」的一环。
   * 措施（官府界面 · 各每日一次 · 从玩家金池扣）：
   *   · 鼓舞民心：安抚 +boost.add（轻）
   *   · 消减民怨：安抚 +soothe.add（重）—— 民怨 = 100 − 民心，抬民心即消民怨
   * ⚠️ 总闸表：改幅度/衰减/价格只改这里，别处不许再写一份。
   * ============================================================ */
  DATA.HEARTS = {
    comfortCap: 50,        /* 安抚上限（民心最多被抬到 100） */
    decayPerHour: 0.5,     /* 安抚回落速度（每游戏小时；停手约 4 日归零） */
    boost: { cost: 2000, add: 6 },     /* 鼓舞民心 */
    soothe: { cost: 6000, add: 15 },   /* 消减民怨 */
  };

  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100,""")

# ============================================================
# A2 data.js：LORD_BREAK.trials
# ============================================================
rep(D, 'A2 trials',
"""    /* 突破奖励：自由属性点（下标 = 突破后的次数） */
    freePts: [0, 40, 100, 240],""",
"""    /* 突破奖励：自由属性点（下标 = 突破后的次数） */
    freePts: [0, 40, 100, 240],
    /* ============================================================
     * v89.177（老板「君主的突破要求更高，并且要有君主的相关要求，比如政务处理
     *   （任务数量），城池，军队，资源，宝物等，综合考验」）
     * ------------------------------------------------------------
     * **综合考验**（下标 = 已突破次数 n；"第 n+1 次突破"读第 n 项）：
     *   除修为（needs）之外，还须过"政 / 城 / 军 / 资 / 宝"五关：
     *     quests   政务——已完成任务数（s.quests.done 计数）
     *     cities   城池——全境城池数
     *     army     军队——全境总兵力（Σ armyTotal）
     *     gold     资源——持金（唯一货币的府库之实）
     *     treasure 宝物——持有珠宝**种类数**（s.items 里的 jewel 型，全 18 种）
     * 数值口径：地图共 174 座系统城（1 都 12 州 96 郡 65 县）→ 2/4/7 座是
     *   "逐段扩张"的节奏；兵力 5k/2w/5w 与出征容量同量级；金 5w/20w/80w 对照
     *   "日入数万"的产出节奏；珠宝 2/4/7 种。
     * ============================================================ */
    trials: [
      { quests: 3, cities: 2, army: 5000, gold: 50000, treasure: 2 },
      { quests: 8, cities: 4, army: 20000, gold: 200000, treasure: 4 },
      { quests: 15, cities: 7, army: 50000, gold: 800000, treasure: 7 },
    ],""")

# ============================================================
# A3 state.js：民心出口组（放 goldAdd 之后）
# ============================================================
rep(S, 'A3 hearts 出口组',
"""  /* 给一份 res 对象挂上 gold 访问器（幂等：已是访问器则原样返回，**不重复并池**） */""",
"""  /* ============================================================
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

  /* 给一份 res 对象挂上 gold 访问器（幂等：已是访问器则原样返回，**不重复并池**） */""")

# ============================================================
# A4 state.js：tick 4 段改造（旧"税率>50% 衰减"退役）
# ============================================================
rep(S, 'A4 tick 民心',
"""    /* 4) 民心：税率>50% 时每小时 -10×(税-50)/50 */
    var tax = s.tax || 0;
    if (tax > 0.5) {
      var drop = 10 * (tax - 0.5) / 0.5 / 3600 * ts; // 每小时下降
      s.hearts = Math.max(0, s.hearts - drop);
    }

    /* 4b) 民心增益：名将羁绊 + 当世年号（后台静默生效） */
    if (GAME.story) {
      var hAdd = GAME.story.heartsPerHour();
      if (hAdd) s.hearts = U.clamp((s.hearts || 0) + hAdd / 3600 * ts, 0, 100);
    }""",
"""    /* 4) 民心（v89.177 公式口径）：民心 = clamp(100 − 税率×100 + 安抚, 0, 100)。
       改动三处：① 旧的"税率>50% 逐时衰减"整段退役（公式已含税率影响，且是即时的）；
                 ② 安抚（heartsComfort）每游戏小时向 0 回落（decayPerHour）；
                 ③ 羁绊/年号（story.heartsPerHour）改为**安抚供给**（叠加后一起钳制）。 */
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
    GAME.applyHearts();""")

# ============================================================
# A5 state.js：初始化 hearts 初值（100 → 50 = 默认税率基准；首 tick 起由 applyHearts 维护）
# ============================================================
rep(S, 'A5 初始 hearts',
"""      hearts: DATA.DEFAULT_SETTINGS.hearts,     // 民心""",
"""      /* v89.177：初值 = 100 − 默认税率 50%×100 = 50（公式口径；首 tick 起由 applyHearts 持续维护） */
      hearts: U.clamp(100 - (DATA.DEFAULT_SETTINGS.tax || 0) * 100, 0, 100),""")

# ============================================================
# A6 domain.js：解雇惩罚 / 犒赏三军 → 安抚通道
# ============================================================
rep(M, 'A6a 解雇惩罚',
"""    s.hearts = U.clamp((s.hearts || 100) - 2, 0, 100);
    GAME.statBump('dismissed', 1);""",
"""    GAME.heartsComfortAdd(-2);      /* v89.177：民心改动统一走安抚通道（-2 解雇之伤） */
    GAME.statBump('dismissed', 1);""")

rep(M, 'A6b 犒赏三军',
"""    } else if (optId === 'fest') {
      s.hearts = Math.min(100, (s.hearts || 0) + 8);""",
"""    } else if (optId === 'fest') {
      GAME.heartsComfortAdd(8);      /* v89.177：民心 +8 走安抚通道 */""")

# ============================================================
# A7 domain.js：措施 + 突破考验（插入在 genLevelCap 之前）
# ============================================================
rep(M, 'A7 措施与考验',
"""  GAME.genLevelCap = function (g) {""",
"""  /* ============================================================
   * v89.177（老板「官府界面增加鼓舞民心，消减民怨的措施各 1 个」）：
   * **两个安抚措施**（各每日一次 · 耗金币 · 走 heartsComfortAdd 唯一入口）。
   *   · 鼓舞民心：轻（DATA.HEARTS.boost）
   *   · 消减民怨：重（DATA.HEARTS.soothe）—— 民怨=100−民心，抬民心即消民怨
   * 冷却按**游戏日**（questDayIndex）；花费从玩家金池（唯一货币）。
   * ============================================================ */
  GAME.heartsActionOf = function (id) {
    var HF = DATA.HEARTS || {};
    var cfg = (id === 'soothe') ? HF.soothe : (id === 'boost' ? HF.boost : null);
    if (!cfg) return null;
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    var usedDay = ((s.heartsDays || {})[id]);
    return { id: id, name: (id === 'soothe') ? '消减民怨' : '鼓舞民心',
      cost: cfg.cost || 0, add: cfg.add || 0, day: day, ready: usedDay !== day };
  };
  GAME.doHeartsAction = function (id) {
    var cfg = GAME.heartsActionOf(id);
    if (!cfg) return { ok: false, msg: '未知措施' };
    if (!cfg.ready) return { ok: false, msg: cfg.name + '本日已行（每日一次，明日再来）' };
    if (GAME.goldOf() < cfg.cost) {
      return { ok: false, msg: '黄金不足（需 ' + U.fmt(cfg.cost) + '，现有 ' + U.fmt(GAME.goldOf()) + '）' };
    }
    GAME.goldAdd(-cfg.cost);
    GAME.heartsComfortAdd(cfg.add);
    var s = GAME.state;
    s.heartsDays = s.heartsDays || {};
    s.heartsDays[id] = cfg.day;
    GAME.log('🕊️ ' + cfg.name + '（-' + U.fmt(cfg.cost) + ' 金）：民心 '
      + Math.round(GAME.heartsOf()) + ' / 民怨 ' + Math.round(GAME.minyuanOf()));
    return { ok: true, msg: cfg.name + '：民心 ' + Math.round(GAME.heartsOf())
      + ' / 民怨 ' + Math.round(GAME.minyuanOf()) };
  };
  /* ============================================================
   * v89.177（老板「君主的突破要求更高……综合考验」）：**综合考验唯一出口** ——
   * 返回 { n, rows:[{key,label,cur,goal,ok}], ok }；null = 未配该项（视为无考验）。
   * 五关口径见 DATA.LORD_BREAK.trials 注释（政/城/军/资/宝）。
   * ============================================================ */
  GAME.lordTrialOf = function (g) {
    var B = DATA.LORD_BREAK, n = GAME.lordBreaksOf(g) + 1;   /* 第 n 次突破 */
    var tr = (B.trials || [])[n - 1];
    if (!tr) return null;
    var s = GAME.state;
    var doneQ = Object.keys((s.quests && s.quests.done) || {}).length;
    var cities = (s.cities || []).length;
    var army = 0;
    (s.cities || []).forEach(function (c) { army += (GAME.armyTotal ? GAME.armyTotal(c) : 0); });
    var gold = GAME.goldOf();
    var jewelIds = {};
    (DATA.ITEMS || []).forEach(function (it) { if (it.type === 'jewel') jewelIds[it.id] = true; });
    var jk = 0;
    Object.keys(s.items || {}).forEach(function (k2) {
      if (jewelIds[k2] && (s.items[k2] || 0) > 0) jk++;
    });
    var rows = [
      { key: 'quests', label: '政务（任务）', cur: doneQ, goal: tr.quests, ok: doneQ >= tr.quests },
      { key: 'cities', label: '城池', cur: cities, goal: tr.cities, ok: cities >= tr.cities },
      { key: 'army', label: '军队（兵力）', cur: army, goal: tr.army, ok: army >= tr.army },
      { key: 'gold', label: '资源（持金）', cur: gold, goal: tr.gold, ok: gold >= tr.gold },
      { key: 'treasure', label: '宝物（珠宝）', cur: jk, goal: tr.treasure, ok: jk >= tr.treasure },
    ];
    return { n: n, rows: rows, ok: rows.every(function (r2) { return r2.ok; }) };
  };
  GAME.genLevelCap = function (g) {""")

# ============================================================
# A8 domain.js：doLordBreak 加综合考验闸
# ============================================================
rep(M, 'A8 突破闸',
"""    var cur = g.cultiv || 0;
    if (cur < need) {
      return { ok: false, msg: '修为不足（需 ' + need + '，现 ' + cur + '），继续练功' };
    }
    g.cultiv = cur - need;""",
"""    var cur = g.cultiv || 0;
    if (cur < need) {
      return { ok: false, msg: '修为不足（需 ' + need + '，现 ' + cur + '），继续练功' };
    }
    /* v89.177（老板「君主的突破要求更高……综合考验」）：修为之外，还须过
       "政/城/军/资/宝"五关（DATA.LORD_BREAK.trials）——缺哪关提示哪关。 */
    var _trial = GAME.lordTrialOf(g);
    if (_trial && !_trial.ok) {
      var miss = _trial.rows.filter(function (r2) { return !r2.ok; })
        .map(function (r2) { return r2.label + '（' + U.fmt(r2.cur) + '/' + U.fmt(r2.goal) + '）'; });
      return { ok: false, msg: '综合考验未过：' + miss.join('、') + ' —— 详见君主面板' };
    }
    g.cultiv = cur - need;""")

print('DONE-A177')
