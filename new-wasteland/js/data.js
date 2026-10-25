/* ============================================================
 * data.js — 世界的静态内容层
 * ------------------------------------------------------------
 * 这一层只有数据，没有逻辑。想改世界，只改这里。
 *
 * 两类东西叠在同一张格子上：
 *   terrain —— 地形（航拍图）：荒原 / 草甸 / 林地 / 丘陵 / 水泊 / 沙地 / 沼泽
 *   site    —— 地点（建筑立绘）：物资站 / 种子库 / 聚落 / 重镇 / 旧都 / 据点
 * 地形决定「走起来多难」，地点决定「来这一趟值不值」。
 *
 * 所有图片来自原有素材（../assets/icons/ui），经 tools/build-assets.py 转成小图。
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = {};

  /* ---------- 世界尺寸 ---------- */
  DATA.MAP_W = 15;
  DATA.MAP_H = 15;
  DATA.CITY = { x: 7, y: 7 };

  /* ---------- 地形与地点 ----------
   * danger : 有多危险
   * supply : 走进去要花几格补给（沼泽 2 —— 这是地形唯一真正影响决策的地方）
   * yield  : 走过能捡到什么
   * halt   : 是否停下来让玩家决定
   */
  DATA.TILES = {

    plain: {
      id: 'plain', layer: 'terrain', name: '荒原', img: 'assets/terrain/plain.jpg',
      danger: 1, weight: 26, halt: false, supply: 1,
      yield: { scrap: 8 },
      line: '风把沙吹成一条条线。',
      desc: '什么都没有。这正是它可怕的地方——你走了三个小时，没有看见一件人造的东西。'
    },
    grass: {
      id: 'grass', layer: 'terrain', name: '草甸', img: 'assets/terrain/caoyuan.jpg',
      danger: 1, weight: 18, halt: false, supply: 1,
      yield: { food: 12 },
      line: '草长得比人高。',
      desc: '草有半人高，走过去会留下一条痕迹。痕迹会被后面的人看见。'
    },
    forest: {
      id: 'forest', layer: 'terrain', name: '林地', img: 'assets/terrain/forest.jpg',
      danger: 2, weight: 16, halt: false, supply: 1,
      yield: { food: 8, scrap: 6 },
      line: '树太密，无线电穿不出去。',
      desc: '树太密，无线电穿不出去。所以这里出事，城里永远不会知道。'
    },
    hill: {
      id: 'hill', layer: 'terrain', name: '丘陵', img: 'assets/terrain/hill.jpg',
      danger: 2, weight: 14, halt: false, supply: 1,
      yield: { iron: 14 },
      line: '翻过第三个坡，就没信号了。',
      desc: '坡一个接一个。翻过第三个，就看不见城了。'
    },
    lake: {
      id: 'lake', layer: 'terrain', name: '水泊', img: 'assets/terrain/lake.jpg',
      danger: 1, weight: 10, halt: false, supply: 1,
      yield: { food: 18, water: 6 },
      line: '水是绿的。绿得很安静。',
      desc: '水是绿的，但没死。有东西在里面活，而且活得很好。'
    },
    desert: {
      id: 'desert', layer: 'terrain', name: '沙地', img: 'assets/terrain/desert.jpg',
      danger: 3, weight: 9, halt: true, supply: 1,
      yield: { iron: 18, scrap: 14 },
      line: '沙把脚印埋了。也把人埋了。',
      desc: '穿过这片沙地能省两天路。但沙会埋掉脚印，也会埋掉人。'
    },
    swamp: {
      id: 'swamp', layer: 'terrain', name: '沼泽', img: 'assets/terrain/zhaoze.jpg',
      danger: 2, weight: 8, halt: false, supply: 2,
      yield: { food: 6 },
      line: '泥没到腰。他们还在走。',
      desc: '泥没到腰。走一格要花两格的力气——绕路慢，直穿更慢。'
    },

    /* ---------- 地点（叠在地形上）---------- */
    warehouse: {
      id: 'warehouse', layer: 'site', name: '物资站', img: 'assets/icon/yizhan.png',
      danger: 2, weight: 16, halt: true,
      yield: { iron: 22, scrap: 18 },
      line: '门是从里面锁的。',
      desc: '货架是满的。门是从里面锁的。锁孔里有东西。'
    },
    seed: {
      id: 'seed', layer: 'site', name: '种子库', img: 'assets/icon/cangku.png',
      danger: 2, weight: 4, halt: true, tint: 'seed',
      yield: { seed: 1 },
      line: '门是冷的。里面比外面还冷。',
      desc: '零下十八度，维持了十二年。谁在供电？'
    },
    town: {
      id: 'town', layer: 'site', name: '聚落', img: 'assets/icon/city_jun.png',
      danger: 3, weight: 7, halt: true,
      yield: { pop: 14, food: 18 },
      line: '城门上挂着牌子：不接收外人。',
      desc: '有围墙，有哨。牌子是新挂的：不接收外人。'
    },
    bigcity: {
      id: 'bigcity', layer: 'site', name: '重镇', img: 'assets/icon/city_zhou.png',
      danger: 4, weight: 4, halt: true,
      yield: { pop: 24, iron: 45 },
      line: '他们在城墙上也看见了我们。',
      desc: '城墙上有人。他们也看见你了。'
    },
    capital: {
      id: 'capital', layer: 'site', name: '旧都', img: 'assets/icon/city_capital.png',
      danger: 6, weight: 1, halt: true,
      yield: { seed: 2, tech: 1, iron: 60 },
      line: '全城的灯都亮着。没有人。',
      desc: '全城的灯都亮着。十二年了。没有一个人。'
    },
    fort: {
      id: 'fort', layer: 'site', name: '据点', img: 'assets/icon/fort.png',
      danger: 4, weight: 0, halt: true,
      yield: {},
      line: '旗子是新的。',
      desc: '有人在上面走动。人数比你多。'
    },
    home: {
      id: 'home', layer: 'site', name: '灰岗', img: 'assets/icon/city_county.png',
      danger: 0, weight: 0, halt: false,
      yield: {},
      line: '灯还亮着。',
      desc: '灯还亮着，因为还有人在加油。'
    }
  };

  /* 生成时按层取用 */
  DATA.TERRAIN_IDS = ['plain', 'grass', 'forest', 'hill', 'lake', 'desert', 'swamp'];
  DATA.SITE_IDS = ['warehouse', 'seed', 'town', 'bigcity', 'capital'];

  /* ---------- 势力 ---------- */
  DATA.FACTIONS = [
    { id: 'rust', name: '铁锈会', color: '#a8542e', blurb: '从北边的工厂区下来。他们信一件事：能修的就能用，不能修的就烧。' },
    { id: 'ash', name: '灰烬教团', color: '#7a5a8c', blurb: '从南边的火场来。他们不抢东西，他们收人。' },
    { id: 'caravan', name: '商队联盟', color: '#5a7a6a', blurb: '从东边的公路来。什么都卖，包括你的消息。' }
  ];

  /* ---------- 地名池 ---------- */
  DATA.PLACES = {
    plain: ['盐碱滩', '白骨坡', '长风道', '三号公路', '无名荒', '灰沙地'],
    grass: ['高草甸', '牧道', '南草场', '风草坡'],
    forest: ['黑林子', '密林', '断林', '老树沟'],
    hill: ['三道坡', '石梁', '鹰嘴岭', '黄土峁'],
    lake: ['绿水泊', '静水', '旧码头', '沉船湾'],
    desert: ['大沙窝', '热风口', '黄沙梁', '无影地'],
    swamp: ['烂泥塘', '陷脚地', '苇子荡', '黑水沼'],
    warehouse: ['六十六号库', '东仓', '铁路仓', '旧冷库'],
    seed: ['冷库', '零下十八', '白门', '种子站'],
    town: ['围墙镇', '哨镇', '铁门镇', '西关'],
    bigcity: ['南城', '旧市府', '大墙', '十里铺'],
    capital: ['旧都', '中央塔', '不夜城'],
    fort: ['据点'],
    home: ['灰岗'],
    default: ['无名地']
  };

  /* ---------- 名字池 ---------- */
  DATA.SURNAMES = ['陈', '李', '王', '张', '刘', '赵', '周', '吴', '郑', '孙',
    '马', '何', '罗', '高', '林', '梁', '宋', '唐', '许', '韩'];
  DATA.GIVEN = ['烬', '野', '岩', '河', '川', '山', '铁', '石', '秋', '冬',
    '夏', '春', '生', '远', '平', '安', '宁', '归', '来', '光',
    '明', '暗', '霜', '雪', '风', '雷', '灯', '渡', '守', '望'];

  DATA.TEAM_NAMES = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八',
    '第九', '第十', '第十一', '第十二'];

  /* ---------- 最后记录 ----------
   * 不是「死亡换来了什么」，是一个人最后说了什么。
   * 这里不做任何计价，只记事。
   */
  DATA.LAST_WORDS = {
    plain: [
      '他们只是没回来。',
      '没有信号。没有尸体。没有痕迹。',
      '最后一句：方向错了。',
      '电台里只剩下风。'
    ],
    grass: [
      '草有半人高。他们走进去，草就合上了。',
      '最后一句：这里有脚印，很多，往同一个方向。',
      '他们是沿着草倒下的方向找回来的。只找回来一个。'
    ],
    forest: [
      '树太密，无线电穿不出去。',
      '最后一句：树上有人刻过字。刻的是日期。',
      '他们没迷路。他们是找到了什么，然后不走了。'
    ],
    hill: [
      '翻过第三个坡，就没信号了。',
      '最后传回的坐标在山脊上。人不在。',
      '最后一句：从这儿能看见城。太远了。'
    ],
    lake: [
      '他们找到了水。水里有东西。',
      '最后传来的是水声。这里很安静。',
      '岸上留着一双鞋，摆得很整齐。'
    ],
    desert: [
      '沙把脚印埋了。也把人埋了。',
      '最后一句：前面还有沙。',
      '他们没走错路。他们只是没走完。'
    ],
    swamp: [
      '泥没到腰。他们还在走。',
      '最后一句：别踩草，草下面是空的。',
      '绳子拉上来的时候，只有半截。'
    ],
    warehouse: [
      '货架是满的。门是从里面锁的。',
      '最后一句：这里面有人在住。',
      '他们搬空了一半。另一半不用搬了。'
    ],
    seed: [
      '门是冷的。他们进去了。',
      '最后一句：里面还有活的。不是种子。',
      '温度记录显示零下十八度，持续了十二年。他们想知道是谁在供电。'
    ],
    town: [
      '城门口的牌子写着：不接收外人。',
      '最后一句：他们开了门。',
      '他们进去了三个人。回来的是另外三个。'
    ],
    bigcity: [
      '他们在城墙上也看见了我们。',
      '最后一句：墙比想的厚。',
      '箭塔上的灯亮了一整夜。第二天灭了。'
    ],
    capital: [
      '全城的灯都亮着。没有人。',
      '最后一句：这里什么都没坏。',
      '他们走进了中央塔。塔的门是从外面锁的。'
    ],
    fort: [
      '旗子是新的。他们没看见旗子。',
      '对方没开枪。他们是被围了三天。',
      '最后一句：他们认识我们。'
    ],
    default: [
      '电台里只剩下风。',
      '他们关了电台。按规程，这意味着……',
      '最后传回的坐标，比他们该在的位置深了四十米。'
    ]
  };

  /* ---------- 事件卡文案 ---------- */
  DATA.EVENTS = {
    desert: {
      title: '沙地边缘',
      body: '穿过去能省两天路。沙子会把脚印埋掉，也会把人埋掉。',
      hint: '队伍会掉人，但路会变短。'
    },
    swamp: {
      title: '沼泽',
      body: '泥没到腰。每走一步要花两倍的力气。',
      hint: '穿过去很慢。绕过去也不快。'
    },
    warehouse: {
      title: '物资站',
      body: '卷帘门锈死了，但锁是从里面锁的。货架看起来还满。',
      hint: '里面可能有铁，也可能有住客。'
    },
    seed: {
      title: '种子库',
      body: '门是冷的，比外面还冷。零下十八度，维持了十二年。',
      hint: '里面如果有活的种子，明年城里就有粮。'
    },
    town: {
      title: '聚落',
      body: '有围墙，有哨。门上挂着牌子：不接收外人。',
      hint: '可以谈，可以抢。名声会传开。'
    },
    bigcity: {
      title: '重镇',
      body: '城墙比想的高。城墙上有人，他们也看见你了。',
      hint: '硬攻会很惨。但他们有粮。'
    },
    capital: {
      title: '旧都',
      body: '全城的灯都亮着。十二年了。没有一个人。',
      hint: '这里什么都有。也什么都还在等。'
    },
    fort: {
      title: '据点外围',
      body: '旗子是新的。上面有人在走动，人数比你多。',
      hint: '硬闯大概率回不来。但你能看清他们的编成。'
    }
  };

  /* ---------- 纪事（剧情阶梯）----------
   * 每年冬天结算之后出一页。不是旁白，是这一年的账：
   * {teams} 队数 · {dead} 死了几个 · {firstDead} 最先没回来的
   * {firstPlace} 他倒下的地方 · {pop} 城里还剩几个 · {lit} 点亮几格
   * {places} 这一年走过的地方
   * 详细世界设定见 docs/世界设定-灰岗纪事.md
   */
  DATA.STORY = [
    {
      y: 1, title: '八个人',
      lines: [
        '这一年，你派出去 {teams} 支队伍。',
        '{deadLine}',
        '{firstLine}',
        '地图上亮起了 {lit} 格。冬天来的时候，城里还有 {pop} 个人。'
      ]
    },
    {
      y: 2, title: '旗子',
      lines: [
        '北边出现了旗子。',
        '他们叫铁锈会，说自己会修东西。他们来了三个人，站在城外，没进来。',
        '他们要水厂的图纸。你还没有给。',
        '{deadLine}',
        '{firstLine}'
      ]
    },
    {
      y: 3, title: '泵',
      lines: [
        '三号泵站响得不对了。',
        '老周听了半天，说轴承烧了，要 D-7 冷却液。',
        'D-7 只有重镇才有。',
        '{deadLine}',
        '{firstLine}'
      ]
    },
    {
      y: 4, title: '四十七格',
      lines: [
        '去旧都要走四十七格。',
        '{deadLine}',
        '到过的地名叫：{places}。',
        '城里现在有 {pop} 个人。他们都在等你说，值不值得再走一趟。'
      ]
    },
    {
      y: 5, title: '门',
      lines: [
        '旧都的灯亮了十二年。',
        '不是城在烧，是路灯。一排一排，亮到看不见的地方。',
        '中央塔的门是从外面锁的。三道锁，铁链绕了七圈。',
        '老周说：有人不想让里面的东西出来。'
      ]
    },
    {
      y: 6, title: '灯',
      lines: [
        '塔里有一张桌子，一沓纸，一个没有水的搪瓷杯。',
        '最后一页写着：灯是我关不掉的。',
        '你可以关。',
        '——这一年，城里还有 {pop} 个人。'
      ],
      choices: [
        { id: 'dark', label: '关灯', note: '旧世界彻底灭掉，灰岗是自己的' },
        { id: 'plug', label: '接进去', note: '水厂自动修好，冬天不再难熬' },
        { id: 'partial', label: '只接温控', note: '不接配送，也不接生育（要先看懂那沓纸）', need: 'tech' }
      ]
    }
  ];

  /* ---------- 三种结局 ---------- */
  DATA.ENDING = {
    dark: {
      title: '关灯',
      lines: [
        '你拉下了最后一个闸。',
        '旧都的路灯一盏一盏灭下去，灭到看不见的地方。种子库开始升温。',
        '回来的路上，没有人说话。',
        '灰岗的灯还亮着。因为还有人在加油。'
      ],
      mod: { food: -1, iron: 0, note: '旧都没有了，产量略降，但冬天全靠自己' }
    },
    plug: {
      title: '接进去',
      lines: [
        '你把灰岗的管线接进了旧都的系统。',
        '第二天早上，水厂的响声变了。第三天，粮食按计划配送到门口。',
        '城里的人开始不用做事。',
        '你在塔里那沓纸的最后一页，看到了另一行字——',
        '「它会照顾你。它会照顾到你什么都不用做。」'
      ],
      mod: { food: 8, iron: 3, note: '产量大涨，但每年冬天城里会少一些人' }
    },
    partial: {
      title: '只接温控',
      lines: [
        '你把温控接进来，把配送和生育的线剪了。',
        '冬天不再那么难熬。但没有饭送到门口。',
        '老周说，这样对。',
        '「机器管冷热，人管吃饭。分工清楚。」'
      ],
      mod: { food: 2, iron: 1, note: '冬天减半，产量小涨，其他照旧' }
    }
  };

  /* ---------- 兵种（数值取自原有兵种表，职能轴是这一版新加的）----------
   * 四个轴，各自解决不同问题；带谁就放弃谁 —— 这才是编成。
   *   fire  火力：打得快 → 挨打少
   *   armor 装甲：每次伤亡少
   *   scout 侦察：降低危险（提前发现埋伏）
   *   haul  运输：提高补给上限（走得更远）
   *
   * fire/armor 由旧表推导，不手填：
   *   fire  = atk × (0.8 + range/3000) / 30
   *   armor = hp × (1 + def/500) / 800
   * 想调平衡就改这两个公式，别改下面每个单位。
   */
  DATA.UNIT_BASE = {
    buxingji:     { name: '步行机',     hp: 1800,  atk: 150, def: 150, range: 50,   pop: 1 },
    dunwei:       { name: '盾卫',       hp: 2400,  atk: 130, def: 250, range: 30,   pop: 1 },
    dianci:       { name: '电磁盾卫',   hp: 3600,  atk: 340, def: 350, range: 60,   pop: 2 },
    kuanglie:     { name: '狂猎',       hp: 5400,  atk: 510, def: 280, range: 70,   pop: 3 },
    zhuzhan:      { name: '主战机甲',   hp: 8400,  atk: 700, def: 400, range: 80,   pop: 4 },
    taitan:       { name: '泰坦机甲',   hp: 15000, atk: 620, def: 300, range: 70,   pop: 5 },
    fujiche:      { name: '伏击车',     hp: 3720,  atk: 340, def: 180, range: 80,   pop: 2 },
    daodanche:    { name: '自走火炮',   hp: 1920,  atk: 220, def: 50,  range: 1200, pop: 2 },
    wuzhi:        { name: '武装直升机', hp: 3840,  atk: 330, def: 150, range: 1000, pop: 2 },
    paojiban:     { name: '迫击炮班',   hp: 2600,  atk: 440, def: 60,  range: 450,  pop: 2 },
    zhongjiqiang: { name: '重装机枪',   hp: 3400,  atk: 480, def: 180, range: 600,  pop: 3 },
    guidaopao:    { name: '轨道炮车',   hp: 2800,  atk: 850, def: 120, range: 700,  pop: 3 },
    huopao:       { name: '东风快递',   hp: 6600,  atk: 950, def: 200, range: 1600, pop: 4 },
    wuren:        { name: '无人轰炸机', hp: 5400,  atk: 500, def: 160, range: 1400, pop: 3 },
    yunshu:       { name: '运输平台',   hp: 4200,  atk: 10,  def: 60,  range: 10,   pop: 4 },
    banche:       { name: '板车',       hp: 600,   atk: 5,   def: 10,  range: 10,   pop: 1 }
  };

  /* 侦察 / 运输 是指派职能，不是推导出来的 */
  DATA.UNIT_SCOUT = { fujiche: 2, kuanglie: 1, wuzhi: 1 };
  DATA.UNIT_HAUL = { yunshu: 4, banche: 1 };

  DATA.UNITS = {};
  (function () {
    Object.keys(DATA.UNIT_BASE).forEach(function (id) {
      var b = DATA.UNIT_BASE[id];
      var rf = 0.8 + (b.range || 0) / 3000;
      DATA.UNITS[id] = {
        id: id,
        name: b.name,
        pop: b.pop,
        range: b.range,
        fire: Math.round(b.atk * rf / 30 * 10) / 10,
        armor: Math.round(b.hp * (1 + b.def / 500) / 800 * 10) / 10,
        scout: DATA.UNIT_SCOUT[id] || 0,
        haul: DATA.UNIT_HAUL[id] || 0,
        img: 'assets/icon/' + id + '.png',
        blurb: ''
      };
    });
  })();

  /* 遮蔽地形：远程打不准，近战反而占便宜。
     这一条是「编成」真正的分水岭 —— 不看目的地配兵，就一定会翻车。 */
  DATA.COVERED = ['forest', 'swamp', 'town', 'bigcity', 'capital', 'warehouse'];
  DATA.COVER_FAR = 0.45;    /* 远程（range ≥ 900）在遮蔽地形 */
  DATA.COVER_MELEE = 1.15;  /* 近战（range ≤ 100）在遮蔽地形 */
  DATA.OPEN_FAR = 1.0;
  DATA.OPEN_MELEE = 0.85;

  /* ---------- 斗将 ----------
   * 五回合，双方各出一招，看不到对方这回合出什么，但看得到他前三回合的习惯。
   * 这不是比大小 —— 是猜。将领强只保证「猜错也不至于输光」。
   *
   *   突刺 破 格挡（捅穿架势）
   *   格挡 防 蓄力（等他攒好再顶）
   *   蓄力 破 佯攻（佯攻骗不动真力）
   *   佯攻 骗 突刺（让对手扑空）
   */
  DATA.DUEL = {
    hp: 100,
    rounds: 5,
    moves: [
      { id: 'thrust', name: '突刺', icon: '↗', hint: '破格挡' },
      { id: 'guard', name: '格挡', icon: '⌗', hint: '防蓄力' },
      { id: 'charge', name: '蓄力', icon: '◍', hint: '破佯攻' },
      { id: 'feint', name: '佯攻', icon: '↝', hint: '骗突刺' }
    ],
    /* damage[我方][对方] = 我方这一招对对方造成的伤害 */
    damage: {
      thrust: { thrust: 20, guard: 8, charge: 35, feint: 12 },
      guard:  { thrust: 8, guard: 5, charge: 15, feint: 8 },
      charge: { thrust: 10, guard: 10, charge: 10, feint: 32 },
      feint:  { thrust: 22, guard: 15, charge: 20, feint: 6 }
    },
    /* 不同对手的习惯偏向（守将类型） */
    style: {
      fort:    { thrust: 0.4, guard: 0.3, charge: 0.2, feint: 0.1, name: '守将' },
      bigcity: { thrust: 0.25, guard: 0.4, charge: 0.25, feint: 0.1, name: '城将' },
      capital: { thrust: 0.2, guard: 0.2, charge: 0.3, feint: 0.3, name: '塔将' }
    },
    winFire: 1.15,     /* 赢了：这一仗火力 +15% */
    winDanger: -1,
    loseDanger: 1,
    refuseDanger: 1
  };

  /* ---------- 势力来使 ----------
   * 三家不是三种兵，是三种对旧世界的态度。他们来找你，各自要一样东西。
   * 你要么给，要么不给。给了会改变地图，不给也会。
   */
  DATA.ENVOYS = [
    {
      id: 'rust_draw',
      year: 2,
      faction: 'rust',
      title: '铁锈会的人来了',
      body: '三个人，站在城外，没进来。领头的手里拿着一张纸，说他能修好三号泵站。\n条件是把水厂的图纸给他。',
      choices: [
        { id: 'give', label: '给图纸', note: '铁 +60 · 铁锈会五年不再往这边扩张' },
        { id: 'refuse', label: '不给', note: '铁锈会加快向灰岗扩张' }
      ]
    },
    {
      id: 'ash_burn',
      year: 3,
      faction: 'ash',
      title: '灰烬教团的人来了',
      body: '一个老太太，带着六个年轻人，走了十一天。\n她不化缘，只提一个要求：把泵站的自动控制柜砸了。\n\n她说：那东西会照顾你，照顾到你什么都不用做。',
      choices: [
        { id: 'burn', label: '砸了', note: '人口 +8 · 粮 +60 · 失去全部图纸' },
        { id: 'keep', label: '不砸', note: '他们走了，不再来' }
      ]
    },
    {
      id: 'caravan_toll',
      year: 2,
      faction: 'caravan',
      title: '商队来过路费',
      body: '一支车队在城外停下。他们不抢，只要过路费。\n\n交了，他们告诉你三个地方有什么。',
      choices: [
        { id: 'pay', label: '交（粮 60）', note: '点亮三格随机地图' },
        { id: 'no', label: '不交', note: '他们绕道，以后不来了' }
      ]
    }
  ];

  /* ---------- 配置（数值可以随便调，结构不要动）---------- */
  DATA.CONFIG = {
    capacity: 12,         /* 基础编制（按 pop 计）；每年 +2。留 4 格余地，能立刻换 1 个主战 */
    swapIron: 40,         /* 加/换一个单位要多少铁 */
    defaultArmy: { buxingji: 8 },   /* 新队默认编成：八个步行机，八个人 */
    teamSupply: 6,        /* 基础补给；运输平台每个 +4 */

    recruitFood: 60,
    recruitIron: 30,
    resupplyFood: 20,
    resupplyAmount: 3,

    baseFood: 8,
    baseIron: 4,
    baseScrap: 3,
    basePop: 2,
    popCap: 240,

    eventWindow: 6,
    factionExpandP: 0.35,
    factionTribute: 5,

    winterEvery: 120,
    winterSeedNeed: 2,
    winterPopBonus: 30,
    winterPopLoss: 0.5,

    vetBonus: 0.6,
    vetChance: 0.45
  };

  global.DATA = DATA;
})(window);
