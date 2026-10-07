/* ============================================================
 * questdata.js  任务目录（v12）
 *   ① DATA.QUESTS         成长型任务 · 一次性，做完即入「已完成」
 *   ② DATA.RANDOM_QUESTS  随机型任务 · 每天刷新 5 个，类型不重复
 * 进度统一由「指标（metric）」实时读取，不再为每种任务写专门的判断
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA = GAME.DATA || {};

  /* 指标说明（UI 展示用） */
  DATA.QUEST_METRIC_DESC = {
    bldCount: '城内某建筑数量', bldLevel: '某建筑等级', bldTotal: '城内建筑总座数',
    extCount: '城外某资源地块数量', extLevel: '城外资源地块等级', extTotal: '已开发地块数',
    techLevel: '某科技等级', techTotal: '科技总等级',
    troopCount: '某兵种数量', armyTotal: '总兵力',
    genCount: '英雄数', heroCount: '名将数', cityCount: '城池数',
    rank: '威望等级', rep: '声望', hearts: '民心', pop: '人口', popCap: '人口上限',
    res: '资源存量', gold: '黄金存量',
    itemOwn: '某宝物持有数', matTotal: '打造材料总数',
    equipCount: '已穿戴装备件数', invCount: '背包装备件数', forgeKinds: '已打造装备种类',
    wildCount: '已占野地数', conquerCount: '累计攻占城池', winCount: '累计战斗胜利',
    buildDone: '累计建成/升级次数', techDone: '累计完成研究', trainTotal: '累计训练兵力',
    forgeTotal: '累计打造次数', recruitCount: '累计招募英雄', tradeCount: '累计交易站交易',
    buildQueue: '在建队列数',
  };

  /* ============================================================
   * ① 成长型任务（35 条 · 一次性）
   * ============================================================ */
  DATA.QUESTS = [
    { id: 'g01', title: '立锥之地', desc: '乱世立身，先有安身之所。建造居所以聚流民。', guide: '「城池」内城点空地 → 建居所。',
      metric: 'bldCount', sub: 'minfang', goal: 3, reward: { grain: 2000, wood: 2000, gold: 500 } },
    { id: 'g02', title: '民居渐稠', desc: '民为邦本，本固邦宁。', guide: '继续建造居所至 6 座。',
      metric: 'bldCount', sub: 'minfang', goal: 6, reward: { pop: 300, gold: 1200 } },
    { id: 'g03', title: '广厦万间', desc: '居所满布，人烟阜盛。', guide: '居所累计 10 座。',
      metric: 'bldCount', sub: 'minfang', goal: 10, reward: { gold: 6000, rep: 80 } },

    { id: 'g04', title: '开垦荒亩', desc: '军未动，粮先行。', guide: '「城外」建集水场 2 块。',
      metric: 'extCount', sub: 'farm', goal: 2, reward: { grain: 5000, wood: 2000, gold: 500 } },
    { id: 'g05', title: '阡陌纵横', desc: '田连阡陌，仓廪可期。', guide: '集水场累计 6 块。',
      metric: 'extCount', sub: 'farm', goal: 6, reward: { grain: 20000, gold: 2000 } },
    { id: 'g06', title: '木石之资', desc: '营建需木石，先备其材。', guide: '复合材料场 1 块、碎石场 1 块。',
      metric: 'extTotal', goal: 4, reward: { wood: 4000, stone: 4000, gold: 800 } },
    { id: 'g07', title: '百工之始', desc: '工欲善其事，必先利其器。', guide: '城外四类资源地块各有 1 块。',
      metric: 'extTotal', goal: 6, reward: { iron: 5000, gold: 1500 } },
    { id: 'g08', title: '冶铁成钢', desc: '铁者，兵之骨也。', guide: '建废铁场 2 块。',
      metric: 'extCount', sub: 'mine', goal: 2, reward: { iron: 8000, gold: 2000 } },
    { id: 'g09', title: '土地丰饶', desc: '四野皆辟，物产丰盈。', guide: '城外已开发地块达 12 块。',
      metric: 'extTotal', goal: 12, reward: { gold: 8000, rep: 100 } },
    { id: 'g10', title: '精耕细作', desc: '八块集水场，十级之属。', guide: '集水场中有 1 块升至 Lv5。',
      metric: 'extLevel', sub: 'farm', goal: 5, reward: { grain: 40000, gold: 3000 } },

    { id: 'g11', title: '衙署初立', desc: '设官分职，方能号令一方。', guide: '升级政务厅至 Lv2。',
      metric: 'bldLevel', sub: 'guanfu', goal: 2, reward: { gold: 3000, wood: 5000 } },
    { id: 'g12', title: '一方之治', desc: '政务厅五级，政令可行。', guide: '政务厅升至 Lv5。',
      metric: 'bldLevel', sub: 'guanfu', goal: 5, reward: { gold: 30000, rep: 250 } },
    { id: 'g13', title: '雄踞一方', desc: '政务厅八级，隐然一方之雄。', guide: '政务厅升至 Lv8。',
      metric: 'bldLevel', sub: 'guanfu', goal: 8, reward: { gold: 120000, rep: 800 } },

    { id: 'g14', title: '研习所初立', desc: '文以载道，学以广才。', guide: '建造研习所。',
      metric: 'bldCount', sub: 'shuyuan', goal: 1, reward: { gold: 3000, wood: 3000 } },
    { id: 'g15', title: '格物致知', desc: '研习种植之术，仓廪自丰。', guide: '「科技」研究种植技术至 Lv3。',
      metric: 'techLevel', sub: 'zhongzhi', goal: 3, reward: { grain: 30000, gold: 5000 } },
    { id: 'g16', title: '百家之学', desc: '学不可以已。', guide: '科技总等级达到 10。',
      metric: 'techTotal', goal: 10, reward: { gold: 25000, rep: 200 } },
    { id: 'g17', title: '博览群书', desc: '格物穷理，无所不通。', guide: '科技总等级达到 30。',
      metric: 'techTotal', goal: 30, reward: { gold: 100000, rep: 600 } },

    { id: 'g18', title: '厉兵秣马', desc: '有兵方有国。', guide: '建造训练营。',
      metric: 'bldCount', sub: 'junying', goal: 1, reward: { iron: 5000, grain: 5000, gold: 1500 } },
    { id: 'g19', title: '甲兵初成', desc: '聚众成军，可御小寇。', guide: '训练兵力累计 300。',
      metric: 'trainTotal', goal: 300, reward: { iron: 8000, gold: 3000 } },
    { id: 'g20', title: '强弩之利', desc: '强弩利矢，可制敌于百步之外。', guide: '弩手 200 名。',
      metric: 'troopCount', sub: 'gongjian', goal: 200, reward: { iron: 20000, gold: 8000 } },
    { id: 'g21', title: '长矛成林', desc: '矛阵森严，拒马如林。', guide: '长矛手 200 名。',
      metric: 'troopCount', sub: 'changqiang', goal: 200, reward: { iron: 20000, gold: 8000 } },
    { id: 'g22', title: '铁流三千', desc: '装甲成列，所向披靡。', guide: '装甲战车 50 名。',
      /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/50 做不完） */
      metric: 'troopCount', sub: 'tieji', goal: 50, reward: { iron: 40000, gold: 20000 } },
    { id: 'g23', title: '攻城之器', desc: '非械不能克坚城。', guide: '破门车 20 乘。',
      metric: 'troopCount', sub: 'chongche', goal: 20, reward: { wood: 60000, gold: 30000 } },
    { id: 'g24', title: '练兵场点兵', desc: '练兵场者，出征之门。', guide: '练兵场升至 Lv3。',
      metric: 'bldLevel', sub: 'xiaochang', goal: 3, reward: { gold: 15000, rep: 120 } },
    { id: 'g25', title: '甲兵十万', desc: '带甲十万，纵横中原。', guide: '总兵力达 10000。',
      metric: 'armyTotal', goal: 10000, reward: { gold: 150000, rep: 900 } },

    { id: 'g26', title: '求贤若渴', desc: '千军易得，一将难求。', guide: '建酒馆与招募站，帐下英雄达 3 人。',
      metric: 'genCount', goal: 3, reward: { gold: 5000, rep: 100 } },
    { id: 'g27', title: '座上之宾', desc: '贤才云集，谋士盈门。', guide: '英雄达 6 人。',
      metric: 'genCount', goal: 6, reward: { gold: 25000, rep: 200 } },
    { id: 'g28', title: '名将来投', desc: '名将归心，胜得十城。', guide: '收纳 1 名史实名将（攻城必降）。',
      metric: 'heroCount', goal: 1, reward: { gold: 30000, rep: 400 } },
    { id: 'g29', title: '将星璀璨', desc: '三将齐列，气象已成。', guide: '帐下名将达 3 人。',
      metric: 'heroCount', goal: 3, reward: { gold: 120000, rep: 1000 } },

    { id: 'g30', title: '市易通商', desc: '货殖流通，财用不乏。', guide: '建交易站并完成 3 次交易。',
      metric: 'tradeCount', goal: 3, reward: { gold: 8000, grain: 20000 } },
    { id: 'g31', title: '积谷防饥', desc: '仓储者，民之命也。', guide: '货仓升至 Lv3。',
      metric: 'bldLevel', sub: 'cangku', goal: 3, reward: { gold: 12000, pop: 500 } },
    { id: 'g32', title: '金城汤池', desc: '围墙高厚，敌不能犯。', guide: '围墙升至 Lv5。',
      metric: 'bldLevel', sub: 'chengqiang', goal: 5, reward: { gold: 40000, rep: 400 } },

    { id: 'g33', title: '铁匠开炉', desc: '炉火照天地，红星乱紫烟。', guide: '建造锻造间并升至 Lv3。',
      metric: 'bldLevel', sub: 'tiejiangpu', goal: 3, reward: { iron: 30000, gold: 15000 } },
    { id: 'g34', title: '神兵初铸', desc: '良匠作兵，锋利无比。', guide: '打造装备累计 3 件。',
      metric: 'forgeTotal', goal: 3, reward: { iron: 40000, gold: 20000, jingtie: 5 } },
    { id: 'g35', title: '披挂上阵', desc: '甲胄在身，方称将军。', guide: '为英雄穿满 6 件装备。',
      metric: 'equipCount', goal: 6, reward: { gold: 25000, jingtie: 8 } },

    { id: 'g36', title: '受衔队长', desc: '以功受衔，位列队长。', guide: '声望达 1000 并晋升队长。',
      metric: 'rank', goal: 1, reward: { gold: 10000, rep: 100 } },
    { id: 'g37', title: '统事', desc: '衔至统事，辖区可观。', guide: '威望达「统事」。',
      metric: 'rank', goal: 10, reward: { gold: 200000, rep: 1500 } },
    { id: 'g38', title: '开疆拓土', desc: '取城一座，始有根基。', guide: '攻占 1 座 NPC 城池。',
      metric: 'conquerCount', goal: 1, reward: { gold: 20000, rep: 200 } },
    { id: 'g39', title: '攻城拔寨', desc: '连下数城，威震一方。', guide: '累计攻占 5 座城池。',
      metric: 'conquerCount', goal: 5, reward: { gold: 150000, rep: 1200 } },
    { id: 'g40', title: '逐鹿中原', desc: '十城在手，可与群雄争锋。', guide: '累计攻占 10 座城池。',
      metric: 'conquerCount', goal: 10, reward: { gold: 400000, rep: 3000 } },
    { id: 'g41', title: '列土封疆', desc: '二十城，霸业可期。', guide: '累计攻占 20 座城池。',
      metric: 'conquerCount', goal: 20, reward: { gold: 1000000, rep: 8000 } },

    { id: 'g42', title: '野望初展', desc: '据野地为资，取山泽之利。', guide: '占领 3 块野地。',
      metric: 'wildCount', goal: 3, reward: { grain: 20000, wood: 20000 } },
    { id: 'g43', title: '山泽之利', desc: '野地遍及四方。', guide: '占领 10 块野地。',
      metric: 'wildCount', goal: 10, reward: { gold: 60000, rep: 500 } },

    { id: 'g44', title: '民心归附', desc: '得民心者得天下。', guide: '民心达 90。',
      metric: 'hearts', goal: 90, reward: { gold: 30000, rep: 600 } },
    { id: 'g45', title: '人丁兴旺', desc: '户口滋盛，赋税自增。', guide: '人口达 5000。',
      metric: 'pop', goal: 5000, reward: { gold: 40000, grain: 60000 } },
    { id: 'g46', title: '富甲一方', desc: '金玉满堂，财用充足。', guide: '黄金存量达 500000。',
      metric: 'gold', goal: 500000, reward: { rep: 1500, grain: 200000 } },
    { id: 'g47', title: '家给人足', desc: '仓廪实而知礼节。', guide: '净水存量达 500000。',
      metric: 'res', sub: 'grain', goal: 500000, reward: { gold: 200000, rep: 1000 } },
    { id: 'g48', title: '武备充盈', desc: '铁积如山，兵甲充足。', guide: '废铁存量达 300000。',
      metric: 'res', sub: 'iron', goal: 300000, reward: { gold: 200000, rep: 1000 } },

    { id: 'g49', title: '百战之师', desc: '兵者，国之大事。', guide: '累计战斗胜利 10 次。',
      metric: 'winCount', goal: 10, reward: { gold: 50000, iron: 50000, rep: 500 } },
    { id: 'g50', title: '营建不辍', desc: '土木之功，日进无疆。', guide: '累计建成/升级 30 次。',
      metric: 'buildDone', goal: 30, reward: { gold: 40000, wood: 60000, rep: 300 } },
  ];

  /* ============================================================
   * ② 随机型任务（36 条 · 每天刷新 5 个）
   * abs: true  目标为绝对存量/状态
   * 否则       目标为「自接取以来」的增量（delta）
   * ============================================================ */
  DATA.RANDOM_QUESTS = [
    /* --- 军事 --- */
    { id: 'r01', title: '募兵令', type: 'military', desc: '征兵备战，以防不虞。', metric: 'trainTotal', goal: 150,
      reward: { grain: 8000, iron: 3000, gold: 1200 } },
    { id: 'r02', title: '弩手扩充', type: 'military', desc: '强弩之末，不可穿鲁缟；补足弩手，方能制敌。', metric: 'troopCount', sub: 'gongjian', goal: 120,
      reward: { iron: 12000, gold: 4000 } },
    { id: 'r03', title: '盾阵补充', type: 'military', desc: '盾卫当先，为全军之蔽。', metric: 'troopCount', sub: 'daodun', goal: 100,
      reward: { iron: 12000, gold: 4000 } },
    { id: 'r04', title: '长矛如林', type: 'military', desc: '矛阵严整，宜多备之。', metric: 'troopCount', sub: 'changqiang', goal: 100,
      reward: { iron: 12000, gold: 4000 } },
    { id: 'r05', title: '侦察兵远探', type: 'military', desc: '不知敌情而战，必败。', metric: 'troopCount', sub: 'chihou', goal: 40,
      reward: { gold: 6000, iron: 4000 } },
    { id: 'r06', title: '游骑断粮', type: 'military', desc: '游骑剽掠，断敌粮道。', metric: 'troopCount', sub: 'qingji', goal: 30,
      reward: { iron: 15000, gold: 6000 } },
    /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/20 做不完） */
    { id: 'r07', title: '铁流成军', type: 'military', desc: '装甲成列，正面破阵。', metric: 'troopCount', sub: 'tieji', goal: 20,
      reward: { iron: 30000, gold: 12000 } },
    { id: 'r08', title: '器械之备', type: 'military', desc: '攻城非器不可。', metric: 'troopCount', sub: 'chongche', goal: 8,
      reward: { wood: 30000, gold: 10000 } },
    /* v89.86 修 bug：sub 'toushiche' → 'toudan'（兵种实际 id；原值导致该任务永远 0/5 做不完） */
    { id: 'r09', title: '炮火破城', type: 'military', desc: '炮火之威，可碎城楼。', metric: 'troopCount', sub: 'toudan', goal: 5,
      reward: { wood: 40000, gold: 16000 } },
    { id: 'r10', title: '养兵之资', type: 'military', desc: '兵者，食为天。总兵力扩充。', metric: 'armyTotal', goal: 500,
      reward: { grain: 20000, gold: 4000 } },

    /* --- 征战 --- */
    { id: 'r11', title: '攻城略地', type: 'war', desc: '取城一座，以壮声威。', metric: 'conquerCount', goal: 1,
      reward: { gold: 30000, rep: 300, iron: 20000 } },
    { id: 'r12', title: '连下二城', type: 'war', desc: '兵贵神速，连战连捷。', metric: 'conquerCount', goal: 2,
      reward: { gold: 70000, rep: 700, iron: 50000 } },
    { id: 'r13', title: '巡弋四境', type: 'war', desc: '讨平野地，扩我疆土。', metric: 'wildCount', goal: 2,
      reward: { grain: 15000, wood: 15000 } },
    { id: 'r14', title: '扫荡群寇', type: 'war', desc: '荡平草寇，以安黎庶。', metric: 'winCount', goal: 3,
      reward: { gold: 15000, rep: 200 } },
    { id: 'r15', title: '威震四方', type: 'war', desc: '十战十胜，敌胆俱寒。', metric: 'winCount', goal: 8,
      reward: { gold: 50000, rep: 600 } },
    { id: 'r16', title: '开疆拓土', type: 'war', desc: '再取一城，以固根本。', metric: 'cityCount', goal: 1,
      reward: { gold: 40000, rep: 400 } },

    /* --- 营建 --- */
    { id: 'r17', title: '营建不辍', type: 'build', desc: '土木之功，日进无疆。', metric: 'buildDone', goal: 3,
      reward: { gold: 8000, wood: 10000 } },
    { id: 'r18', title: '广厦之谋', type: 'build', desc: '增建居所，以纳流民。', metric: 'bldCount', sub: 'minfang', goal: 2,
      reward: { pop: 400, gold: 5000 } },
    { id: 'r19', title: '垦荒拓田', type: 'build', desc: '田多则粮足。', metric: 'extCount', sub: 'farm', goal: 2,
      reward: { grain: 20000, gold: 4000 } },
    { id: 'r20', title: '开山取石', type: 'build', desc: '碎石为营建之本。', metric: 'extCount', sub: 'quarry', goal: 1,
      reward: { stone: 20000, gold: 4000 } },
    { id: 'r21', title: '伐木成材', type: 'build', desc: '林木为宫室之资。', metric: 'extCount', sub: 'forest', goal: 1,
      reward: { wood: 20000, gold: 4000 } },
    { id: 'r22', title: '凿矿冶铁', type: 'build', desc: '铁者，兵之本也。', metric: 'extCount', sub: 'mine', goal: 1,
      reward: { iron: 12000, gold: 5000 } },
    { id: 'r23', title: '更深筑城', type: 'build', desc: '一处建筑再进一步。', metric: 'buildDone', goal: 1,
      reward: { gold: 4000, rep: 80 } },

    /* --- 科研 --- */
    { id: 'r24', title: '兴学讲艺', type: 'tech', desc: '学而后能，研而后得。', metric: 'techDone', goal: 1,
      reward: { gold: 8000, rep: 100 } },
    { id: 'r25', title: '百家争鸣', type: 'tech', desc: '博采众长，以广所学。', metric: 'techTotal', goal: 2,
      reward: { gold: 20000, rep: 200 } },

    /* --- 治理 --- */
    { id: 'r26', title: '屯田积谷', type: 'govern', desc: '积谷防饥，以备凶年。', metric: 'res', sub: 'grain', abs: true, goal: 150000,
      reward: { gold: 12000, rep: 120 } },
    { id: 'r27', title: '聚财通商', type: 'govern', desc: '财用足则百事可为。', metric: 'gold', abs: true, goal: 150000,
      reward: { grain: 30000, rep: 120 } },
    { id: 'r28', title: '安民抚众', type: 'govern', desc: '民心者，国之根本。', metric: 'hearts', abs: true, goal: 85,
      reward: { gold: 15000, rep: 250 } },
    { id: 'r29', title: '市易往来', type: 'govern', desc: '通商惠工，货畅其流。', metric: 'tradeCount', goal: 2,
      reward: { gold: 10000, grain: 15000 } },
    { id: 'r30', title: '人丁滋盛', type: 'govern', desc: '户口繁息，赋税自增。', metric: 'pop', abs: true, goal: 2000,
      reward: { gold: 12000, grain: 20000 } },

    /* --- 招贤 --- */
    { id: 'r31', title: '招贤纳士', type: 'talent', desc: '广纳贤才，以充幕府。', metric: 'recruitCount', goal: 1,
      reward: { gold: 12000, rep: 150 } },
    { id: 'r32', title: '礼贤下士', type: 'talent', desc: '两贤继至，幕府生辉。', metric: 'recruitCount', goal: 2,
      reward: { gold: 30000, rep: 350 } },

    /* --- 打造 --- */
    { id: 'r33', title: '炉火不熄', type: 'forge', desc: '再铸一件，以备军需。', metric: 'forgeTotal', goal: 1,
      reward: { iron: 10000, gold: 5000 } },
    { id: 'r34', title: '甲胄齐备', type: 'forge', desc: '三件在身，可当矢石。', metric: 'equipCount', goal: 1,
      reward: { gold: 8000, rep: 120 } },
    { id: 'r35', title: '广集突变体', type: 'forge', desc: '打造之料，多多益善。', metric: 'matTotal', abs: true, goal: 60,
      reward: { gold: 12000, jingtie: 4 } },
    { id: 'r36', title: '铸兵练卒', type: 'forge', desc: '器利则兵强。', metric: 'forgeKinds', goal: 1,
      reward: { iron: 20000, gold: 8000 } },
  ];

  /* 任务分类名（随机任务按此「类型不一」抽取） */
  DATA.QUEST_TYPES = {
    military: '军事', war: '征战', build: '营建', tech: '科研',
    govern: '治理', talent: '招贤', forge: '打造',
  };
  /* ⛔ v89.134 移除：`DATA.QUEST_TYPE_ORDER` —— 与 `QUEST_TYPES` 的键顺序
     完全一致（冗余清单），全仓零引用（盘点器 v2 核验）。 */

  /* 随机任务刷新规则 */
  DATA.QUEST_DAILY = {
    perDay: 5,          // 每日刷新 5 项（类型互不相同）
    maxActive: 5,       // **同时在手的随机任务上限 = 5**（满则不再新增）
    keepDays: 7,        // 保留期（用于清理陈年未做项，非上限）
    typeDistinct: true, // 同批刷出的 5 个类型互不相同
  };
})();
