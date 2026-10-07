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
    rank: '威望等级', rep: '声望', hearts: '民心', pop: '幸存者', popCap: '幸存者上限',
    res: '资源存量', gold: '旧币存量',
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
    { id: 'g01', title: '残垣立命', desc: '余烬之上先有遮顶，幸存者才会聚拢来。', guide: '「城池」内城点空地 → 建居所。',
      metric: 'bldCount', sub: 'minfang', goal: 3, reward: { grain: 2000, wood: 2000, gold: 500 } },
    { id: 'g02', title: '人烟渐聚', desc: '屋顶多了，炊烟也就多了。', guide: '继续建造居所至 6 座。',
      metric: 'bldCount', sub: 'minfang', goal: 6, reward: { pop: 300, gold: 1200 } },
    { id: 'g03', title: '营地成镇', desc: '十座居所连成一片 —— 废墟上终于有了小镇的轮廓。', guide: '居所累计 10 座。',
      metric: 'bldCount', sub: 'minfang', goal: 10, reward: { gold: 6000, rep: 80 } },

    { id: 'g04', title: '活水之始', desc: '人饿得三天，渴不得一天。净化厂先立起来。', guide: '「城外」建净化厂 2 块。',
      metric: 'extCount', sub: 'farm', goal: 2, reward: { grain: 5000, wood: 2000, gold: 500 } },
    { id: 'g05', title: '水脉成网', desc: '六座净化厂，把污水滤成活水。', guide: '净化厂累计 6 块。',
      metric: 'extCount', sub: 'farm', goal: 6, reward: { grain: 20000, gold: 2000 } },
    { id: 'g06', title: '拓荒备料', desc: '一株苗、一度电 —— 重建的第一批本钱。', guide: '水培温室 1 块、发电站 1 块。',
      metric: 'extTotal', goal: 4, reward: { wood: 4000, stone: 4000, gold: 800 } },
    { id: 'g07', title: '四源齐备', desc: '净水、生物质、电能、废钢 —— 四条命脉各接一根。', guide: '城外四类资源地块各有 1 块。',
      metric: 'extTotal', goal: 6, reward: { iron: 5000, gold: 1500 } },
    { id: 'g08', title: '熔炉点起', desc: '炉子烧起来，废钢才有变成刀枪的那天。', guide: '建电弧熔炉 2 块。',
      metric: 'extCount', sub: 'mine', goal: 2, reward: { iron: 8000, gold: 2000 } },
    { id: 'g09', title: '荒野扎根', desc: '十二块地翻开土 —— 这座城在荒野里扎下根了。', guide: '城外已开发地块达 12 块。',
      metric: 'extTotal', goal: 12, reward: { gold: 8000, rep: 100 } },
    { id: 'g10', title: '深挖精滤', desc: '同一口井，滤得更深一层。', guide: '净化厂中有 1 块升至 Lv5。',
      metric: 'extLevel', sub: 'farm', goal: 5, reward: { grain: 40000, gold: 3000 } },

    { id: 'g11', title: '中枢初建', desc: '没有中枢，命令传不出三条街。', guide: '升级政务厅至 Lv2。',
      metric: 'bldLevel', sub: 'guanfu', goal: 2, reward: { gold: 3000, wood: 5000 } },
    { id: 'g12', title: '政令通达', desc: '政务厅五级，文书与命令才铺得满全城。', guide: '政务厅升至 Lv5。',
      metric: 'bldLevel', sub: 'guanfu', goal: 5, reward: { gold: 30000, rep: 250 } },
    { id: 'g13', title: '荒野雄城', desc: '政务厅八级 —— 这片废土上，说话有分量了。', guide: '政务厅升至 Lv8。',
      metric: 'bldLevel', sub: 'guanfu', goal: 8, reward: { gold: 120000, rep: 800 } },

    { id: 'g14', title: '拾回旧知', desc: '旧世的知识没死透，把它们从废墟里捡回来。', guide: '建造研习所。',
      metric: 'bldCount', sub: 'shuyuan', goal: 1, reward: { gold: 3000, wood: 3000 } },
    { id: 'g15', title: '清源有道', desc: '水更清的秘诀，藏在旧世的图纸里。', guide: '「科技」研究净化技术至 Lv3。',
      metric: 'techLevel', sub: 'zhongzhi', goal: 3, reward: { grain: 30000, gold: 5000 } },
    { id: 'g16', title: '百艺重研', desc: '十项技术在册 —— 旧世手艺一件件回炉。', guide: '科技总等级达到 10。',
      metric: 'techTotal', goal: 10, reward: { gold: 25000, rep: 200 } },
    { id: 'g17', title: '重建之基', desc: '三十项技术在册 —— 这座城不再只是苟活。', guide: '科技总等级达到 30。',
      metric: 'techTotal', goal: 30, reward: { gold: 100000, rep: 600 } },

    { id: 'g18', title: '执刃之始', desc: '没有兵的城，只是别人眼里的一块肉。', guide: '建造训练营。',
      metric: 'bldCount', sub: 'junying', goal: 1, reward: { iron: 5000, grain: 5000, gold: 1500 } },
    { id: 'g19', title: '队列初成', desc: '三百人列队 —— 荒野散兵得掂量掂量了。', guide: '训练兵力累计 300。',
      metric: 'trainTotal', goal: 300, reward: { iron: 8000, gold: 3000 } },
    { id: 'g20', title: '远火列阵', desc: '敌人还没看见你的旗，先看见火光。', guide: '导弹车 200 名。',
      metric: 'troopCount', sub: 'daodanche', goal: 200, reward: { iron: 20000, gold: 8000 } },
    { id: 'g21', title: '钢足如林', desc: '两百台步行机同频踏步，地面在震。', guide: '步行机 200 名。',
      metric: 'troopCount', sub: 'buxingji', goal: 200, reward: { iron: 20000, gold: 8000 } },
    { id: 'g22', title: '重甲凿阵', desc: '五十台主战机甲成列 —— 正面撕开任何防线。', guide: '主战机甲 50 名。',
      /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/50 做不完）；
         v89.229 兵种重构：'tieji' 并入 'zhuzhan'（主战机甲）—— sub 已随换代 */
      metric: 'troopCount', sub: 'zhuzhan', goal: 50, reward: { iron: 40000, gold: 20000 } },
    { id: 'g23', title: '破墙之术', desc: '再厚的墙，也扛不住炮。', guide: '自行火炮 20 乘。',
      metric: 'troopCount', sub: 'huopao', goal: 20, reward: { wood: 60000, gold: 30000 } },
    { id: 'g24', title: '点兵之门', desc: '练兵场 Lv3 起，出征的队伍才拉得开。', guide: '练兵场升至 Lv3。',
      metric: 'bldLevel', sub: 'xiaochang', goal: 3, reward: { gold: 15000, rep: 120 } },
    { id: 'g25', title: '万人之军', desc: '一万兵力在册 —— 荒野上横着走的本钱。', guide: '总兵力达 10000。',
      metric: 'armyTotal', goal: 10000, reward: { gold: 150000, rep: 900 } },

    { id: 'g26', title: '幕府初开', desc: '三个能扛事的人进了你的帐。', guide: '建酒馆与招募站，帐下英雄达 3 人。',
      metric: 'genCount', goal: 3, reward: { gold: 5000, rep: 100 } },
    { id: 'g27', title: '帐下六人', desc: '六个得力干将 —— 每条战线都有人盯了。', guide: '英雄达 6 人。',
      metric: 'genCount', goal: 6, reward: { gold: 25000, rep: 200 } },
    { id: 'g28', title: '将星入帐', desc: '一位真名号的人物归了你的旗。', guide: '收纳 1 名史实名将（攻城必降）。',
      metric: 'heroCount', goal: 1, reward: { gold: 30000, rep: 400 } },
    { id: 'g29', title: '三将成势', desc: '三杆将旗插在帐前 —— 你的名字开始有人忌惮。', guide: '帐下名将达 3 人。',
      metric: 'heroCount', goal: 3, reward: { gold: 120000, rep: 1000 } },

    { id: 'g30', title: '集市开张', desc: '废土上的生意，比刀剑更持久。', guide: '建交易站并完成 3 次交易。',
      metric: 'tradeCount', goal: 3, reward: { gold: 8000, grain: 20000 } },
    { id: 'g31', title: '家有余量', desc: '挨过荒季的底气，是堆出来的。', guide: '货仓升至 Lv3。',
      metric: 'bldLevel', sub: 'cangku', goal: 3, reward: { gold: 12000, pop: 500 } },
    { id: 'g32', title: '铁壁初成', desc: '夜里睡觉，不必再留一只耳朵听风。', guide: '围墙升至 Lv5。',
      metric: 'bldLevel', sub: 'chengqiang', goal: 5, reward: { gold: 40000, rep: 400 } },

    { id: 'g33', title: '锻炉不熄', desc: '装备不会自己从废墟里长出来。', guide: '建造锻造间并升至 Lv3。',
      metric: 'bldLevel', sub: 'tiejiangpu', goal: 3, reward: { iron: 30000, gold: 15000 } },
    { id: 'g34', title: '初炉出品', desc: '三件装备出炉 —— 手里拿的是自己造的。', guide: '打造装备累计 3 件。',
      metric: 'forgeTotal', goal: 3, reward: { iron: 40000, gold: 20000, jingtie: 5 } },
    { id: 'g35', title: '全副披挂', desc: '六个部位齐全 —— 上阵之前，先生存。', guide: '为英雄穿满 6 件装备。',
      metric: 'equipCount', goal: 6, reward: { gold: 25000, jingtie: 8 } },

    { id: 'g36', title: '衔级初授', desc: '声望过千，第一个衔级到手。', guide: '声望达 1000 并晋升队长。',
      metric: 'rank', goal: 1, reward: { gold: 10000, rep: 100 } },
    { id: 'g37', title: '统事在身', desc: '爬到「统事」这一级 —— 辖区分量，和从前不是一个世界。', guide: '威望达「统事」。',
      metric: 'rank', goal: 10, reward: { gold: 200000, rep: 1500 } },
    { id: 'g38', title: '第一座城', desc: '版图上第一次有"别人"了。', guide: '攻占 1 座 NPC 城池。',
      metric: 'conquerCount', goal: 1, reward: { gold: 20000, rep: 200 } },
    { id: 'g39', title: '五城连旗', desc: '五座城在旗下一字排开 —— 荒原始有主人。', guide: '累计攻占 5 座城池。',
      metric: 'conquerCount', goal: 5, reward: { gold: 150000, rep: 1200 } },
    { id: 'g40', title: '十城之主', desc: '废土势力榜，你的名字该进前三了。', guide: '累计攻占 10 座城池。',
      metric: 'conquerCount', goal: 10, reward: { gold: 400000, rep: 3000 } },
    { id: 'g41', title: '半壁版图', desc: '二十座城 —— 从拾荒者到荒地主人。', guide: '累计攻占 20 座城池。',
      metric: 'conquerCount', goal: 20, reward: { gold: 1000000, rep: 8000 } },

    { id: 'g42', title: '取材荒野', desc: '城市的胃，开始伸向荒野。', guide: '占领 3 块野地。',
      metric: 'wildCount', goal: 3, reward: { grain: 20000, wood: 20000 } },
    { id: 'g43', title: '脉络四通', desc: '十块野地连成脉络 —— 四类资源源源往城里走。', guide: '占领 10 块野地。',
      metric: 'wildCount', goal: 10, reward: { gold: 60000, rep: 500 } },

    { id: 'g44', title: '人心向附', desc: '民心九成 —— 他们不是怕你，是信你。', guide: '民心达 90。',
      metric: 'hearts', goal: 90, reward: { gold: 30000, rep: 600 } },
    { id: 'g45', title: '人烟五千', desc: '五千幸存者在册 —— 人气就是税，就是兵。', guide: '幸存者达 5000。',
      metric: 'pop', goal: 5000, reward: { gold: 40000, grain: 60000 } },
    { id: 'g46', title: '旧币充盈', desc: '五十万旧币入账 —— 废土硬通货攒出底气。', guide: '旧币存量达 500000。',
      metric: 'gold', goal: 500000, reward: { rep: 1500, grain: 200000 } },
    { id: 'g47', title: '储水如仓', desc: '荒年来了，也够全城喝上一阵。', guide: '净水存量达 500000。',
      metric: 'res', sub: 'grain', goal: 500000, reward: { gold: 200000, rep: 1000 } },
    { id: 'g48', title: '钢积如山', desc: '三十万废钢入库 —— 钢铁就是话语权。', guide: '废钢存量达 300000。',
      metric: 'res', sub: 'iron', goal: 300000, reward: { gold: 200000, rep: 1000 } },

    { id: 'g49', title: '十战之师', desc: '十场胜利 —— 你的队伍，输了也不会散。', guide: '累计战斗胜利 10 次。',
      metric: 'winCount', goal: 10, reward: { gold: 50000, iron: 50000, rep: 500 } },
    { id: 'g50', title: '日夜营建', desc: '这座城是长出来的，不是画出来的。', guide: '累计建成/升级 30 次。',
      metric: 'buildDone', goal: 30, reward: { gold: 40000, wood: 60000, rep: 300 } },
  ];

  /* ============================================================
   * ② 随机型任务（36 条 · 每天刷新 5 个）
   * abs: true  目标为绝对存量/状态
   * 否则       目标为「自接取以来」的增量（delta）
   * ============================================================ */
  DATA.RANDOM_QUESTS = [
    /* --- 军事 --- */
    { id: 'r01', title: '补员令', type: 'military', desc: '各营清点人数，缺多少补多少。', metric: 'trainTotal', goal: 150,
      reward: { grain: 8000, iron: 3000, gold: 1200 } },
    { id: 'r02', title: '导弹列阵', type: 'military', desc: '远火先发制人；补足导弹车，先手定胜负。', metric: 'troopCount', sub: 'daodanche', goal: 120,
      reward: { iron: 12000, gold: 4000 } },
    { id: 'r03', title: '盾阵补充', type: 'military', desc: '盾卫顶在最前，替全军挡第一波火力 —— 补到 100。', metric: 'troopCount', sub: 'dunwei', goal: 100,
      reward: { iron: 12000, gold: 4000 } },
    { id: 'r04', title: '步甲如林', type: 'military', desc: '步行机是阵线的骨头 —— 再备 100 台。', metric: 'troopCount', sub: 'buxingji', goal: 100,
      reward: { iron: 12000, gold: 4000 } },
    { id: 'r05', title: '侦察远探', type: 'military', desc: '不知敌情就开打，等于蒙眼走路 —— 侦察单元补到 40。', metric: 'troopCount', sub: 'zhencha', goal: 40,
      reward: { gold: 6000, iron: 4000 } },
    { id: 'r06', title: '伏击断水', type: 'military', desc: '快进快出，专掐敌方的补给线 —— 伏击车补到 30。', metric: 'troopCount', sub: 'fujiche', goal: 30,
      reward: { iron: 15000, gold: 6000 } },
    /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/20 做不完）；
       v89.229 兵种重构：'tieji' 并入 'zhuzhan'（主战机甲）—— sub 已随换代 */
    { id: 'r07', title: '机甲成军', type: 'military', desc: '主战机甲成列，正面凿阵 —— 补到 20 台。', metric: 'troopCount', sub: 'zhuzhan', goal: 20,
      reward: { iron: 30000, gold: 12000 } },
    { id: 'r08', title: '器械之备', type: 'military', desc: '攻城不能只靠腿 —— 无人轰炸机备到 8 架。', metric: 'troopCount', sub: 'wuren', goal: 8,
      reward: { wood: 30000, gold: 10000 } },
    /* v89.86 修 bug：sub 'toushiche' → 'toudan'（兵种实际 id；原值导致该任务永远 0/5 做不完）；
       v89.229 兵种重构：'toudan' 并入 'huopao'（自行火炮）—— sub 已随换代 */
    { id: 'r09', title: '炮火破城', type: 'military', desc: '炮火之威，可碎城楼 —— 自行火炮补到 5 门。', metric: 'troopCount', sub: 'huopao', goal: 5,
      reward: { wood: 40000, gold: 16000 } },
    { id: 'r10', title: '扩军备战', type: 'military', desc: '先把人马养起来 —— 总兵力扩到 500。', metric: 'armyTotal', goal: 500,
      reward: { grain: 20000, gold: 4000 } },

    /* --- 征战 --- */
    { id: 'r11', title: '首城之战', type: 'war', desc: '拿下一座城，让周围看看你的成色。', metric: 'conquerCount', goal: 1,
      reward: { gold: 30000, rep: 300, iron: 20000 } },
    { id: 'r12', title: '连下二城', type: 'war', desc: '趁热打铁，再下二城。', metric: 'conquerCount', goal: 2,
      reward: { gold: 70000, rep: 700, iron: 50000 } },
    { id: 'r13', title: '巡弋荒野', type: 'war', desc: '扫平周边野地，把疆界推出去。', metric: 'wildCount', goal: 2,
      reward: { grain: 15000, wood: 15000 } },
    { id: 'r14', title: '肃清散兵', type: 'war', desc: '清掉劫道的散兵游勇 —— 商路就是命路。', metric: 'winCount', goal: 3,
      reward: { gold: 15000, rep: 200 } },
    { id: 'r15', title: '威震四方', type: 'war', desc: '八场胜利打下来，旗号就是通行证。', metric: 'winCount', goal: 8,
      reward: { gold: 50000, rep: 600 } },
    { id: 'r16', title: '再下一城', type: 'war', desc: '再钉一桩，把根基钉牢。', metric: 'cityCount', goal: 1,
      reward: { gold: 40000, rep: 400 } },

    /* --- 营建 --- */
    { id: 'r17', title: '工程不停', type: 'build', desc: '工程不能停 —— 建成三次，城才有样子。', metric: 'buildDone', goal: 3,
      reward: { gold: 8000, wood: 10000 } },
    { id: 'r18', title: '多盖两间', type: 'build', desc: '增建居所 —— 新来的幸存者要有地方睡。', metric: 'bldCount', sub: 'minfang', goal: 2,
      reward: { pop: 400, gold: 5000 } },
    { id: 'r19', title: '再扩水脉', type: 'build', desc: '再起两座净化厂 —— 水是收成，也是底气。', metric: 'extCount', sub: 'farm', goal: 2,
      reward: { grain: 20000, gold: 4000 } },
    { id: 'r20', title: '电站新立', type: 'build', desc: '电力是机械的命 —— 发电站再起一座。', metric: 'extCount', sub: 'quarry', goal: 1,
      reward: { stone: 20000, gold: 4000 } },
    { id: 'r21', title: '温室起苗', type: 'build', desc: '温室里长出来的，是重建的本钱。', metric: 'extCount', sub: 'forest', goal: 1,
      reward: { wood: 20000, gold: 4000 } },
    { id: 'r22', title: '熔炉再起', type: 'build', desc: '电弧熔炉起一座，废钢就有了去处。', metric: 'extCount', sub: 'mine', goal: 1,
      reward: { iron: 12000, gold: 5000 } },
    { id: 'r23', title: '再升一级', type: 'build', desc: '给任意建筑升一级 —— 一寸一寸把城养大。', metric: 'buildDone', goal: 1,
      reward: { gold: 4000, rep: 80 } },

    /* --- 科研 --- */
    { id: 'r24', title: '旧图新研', type: 'tech', desc: '完成一项研究 —— 旧世图纸，啃一页是一页。', metric: 'techDone', goal: 1,
      reward: { gold: 8000, rep: 100 } },
    { id: 'r25', title: '学识渐长', type: 'tech', desc: '科技等级推到 2 —— 知识不怕多。', metric: 'techTotal', goal: 2,
      reward: { gold: 20000, rep: 200 } },

    /* --- 治理 --- */
    { id: 'r26', title: '水仓满囤', type: 'govern', desc: '净水储备上 15 万 —— 荒年的缓冲垫。', metric: 'res', sub: 'grain', abs: true, goal: 150000,
      reward: { gold: 12000, rep: 120 } },
    { id: 'r27', title: '攒币蓄力', type: 'govern', desc: '旧币持有过 15 万 —— 有钱才有腾挪余地。', metric: 'gold', abs: true, goal: 150000,
      reward: { grain: 30000, rep: 120 } },
    { id: 'r28', title: '安抚人心', type: 'govern', desc: '民心稳到 85 —— 人稳，城才稳。', metric: 'hearts', abs: true, goal: 85,
      reward: { gold: 15000, rep: 250 } },
    { id: 'r29', title: '市场走货', type: 'govern', desc: '在市场做两笔买卖 —— 让货动起来。', metric: 'tradeCount', goal: 2,
      reward: { gold: 10000, grain: 15000 } },
    { id: 'r30', title: '人丁渐盛', type: 'govern', desc: '幸存者上 2000 —— 人来了，一切才有得谈。', metric: 'pop', abs: true, goal: 2000,
      reward: { gold: 12000, grain: 20000 } },

    /* --- 招贤 --- */
    { id: 'r31', title: '招募新人', type: 'talent', desc: '招到一个新面孔 —— 每个能人都是资产。', metric: 'recruitCount', goal: 1,
      reward: { gold: 12000, rep: 150 } },
    { id: 'r32', title: '双贤在帐', type: 'talent', desc: '帐下再添一人 —— 队伍厚了，路就好走。', metric: 'recruitCount', goal: 2,
      reward: { gold: 30000, rep: 350 } },

    /* --- 打造 --- */
    { id: 'r33', title: '炉火不熄', type: 'forge', desc: '再出一件装备 —— 军需不缺货，前线才不缺命。', metric: 'forgeTotal', goal: 1,
      reward: { iron: 10000, gold: 5000 } },
    { id: 'r34', title: '甲胄齐备', type: 'forge', desc: '给英雄配齐装备 —— 至少三件在身。', metric: 'equipCount', goal: 1,
      reward: { gold: 8000, rep: 120 } },
    { id: 'r35', title: '积料备战', type: 'forge', desc: '打造之料，多多益善 —— 库存上 60。', metric: 'matTotal', abs: true, goal: 60,
      reward: { gold: 12000, jingtie: 4 } },
    { id: 'r36', title: '新械入库', type: 'forge', desc: '装备种类解锁一件 —— 多一种家伙，多一种打法。', metric: 'forgeKinds', goal: 1,
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
