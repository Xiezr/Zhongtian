/* ============================================================
 * gen_v8950_content.js  v89.50 内容生成器（node 直接跑 · 只打印不写入）
 * ------------------------------------------------------------
 * 老板：「创造4套套装，100+种物品」
 * 本脚本按**既有数值口径**算出全部条目并打印成可直接粘进 data.js 的 JS 字面量：
 *   · 套装件 = 同品质同槽位散件 ×1.12（与名将/神武/倚天同一口径）+ 每套"特色属性"
 *   · 套装加成 = 3/5/7/11 四档累计（DATA.SET_TIERS），每套至少一档带体力
 *   · 物品 = 每条都落在**已存在的消费点**上（type/target/eff 契约见 systems.S.useItem）
 * 数值全部来自 DATA.CRAFT_SLOTS / Q_STA 与既有物品价目，不由手写。
 * 用法：node .workbuddy/tools/gen/gen_v8950_content.js
 * ============================================================ */
(function () {
  /* ---------- ① 散件基准（与 DATA.CRAFT_SLOTS 同源，这里只复刻数值） ---------- */
  var F = {
    2: { weapon: 264, head: 242, chest: 330, shoulder: 242, arm: 220, waist: 220, feet: 20, neck: 22, ring: 22, pendant: 22, back: 22, mount: 36 },
    3: { weapon: 558, head: 511, chest: 700, shoulder: 511, arm: 464, waist: 464, feet: 44, neck: 38, ring: 38, pendant: 38, back: 38, mount: 82 },
    4: { weapon: 960, head: 880, chest: 1200, shoulder: 880, arm: 800, waist: 800, feet: 78, neck: 56, ring: 56, pendant: 56, back: 56, mount: 146 },
  };
  var SLOT_STAT = { weapon: 'atk', head: 'def', chest: 'def', shoulder: 'def', arm: 'def', waist: 'def',
    feet: 'spd', neck: 'tong', ring: 'tong', pendant: 'zm', back: 'zm', mount: 'spd' };
  var SLOTS = ['head', 'neck', 'shoulder', 'chest', 'back', 'waist', 'arm', 'feet', 'ring', 'pendant', 'weapon', 'mount'];
  var SET_STA = { 2: 250, 3: 470, 4: 620 };
  var STAT_ORDER = ['tong', 'nz', 'yw', 'zm', 'def', 'atk', 'spd', 'sta'];
  var STAT_NAME = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', def: '防御', atk: '攻击', spd: '速度', sta: '体力' };

  /* ---------- ② 四套新套装 ---------- */
  var SETS = [
    {
      id: 'youxia', name: '游侠套', q: 2, iset: '游侠',
      names: { head: '游侠头巾', neck: '游侠项坠', shoulder: '游侠肩披', chest: '游侠短打', back: '游侠披风',
        waist: '游侠束带', arm: '游侠护臂', feet: '游侠快靴', ring: '游侠指环', pendant: '游侠玉佩',
        weapon: '游侠短剑', mount: '游侠健马' },
      extra: { weapon: { yw: 14 }, head: { yw: 8 }, arm: { yw: 6 }, pendant: { yw: 6 }, back: { yw: 6 },
        feet: { spd: 16 }, mount: { spd: 24 }, ring: { spd: 4 } },
      eff: { 3: { spd: 14, sta: 25 }, 5: { yw: 40 }, 7: { atk: 130 }, 11: { tong: 30, spd: 12 } },
    },
    {
      id: 'xianzhen', name: '陷阵套', q: 3, iset: '陷阵',
      names: { head: '陷阵铁盔', neck: '陷阵坠饰', shoulder: '陷阵肩铠', chest: '陷阵重铠', back: '陷阵战袍',
        waist: '陷阵铁带', arm: '陷阵臂甲', feet: '陷阵战靴', ring: '陷阵指环', pendant: '陷阵玉佩',
        weapon: '陷阵长戟', mount: '陷阵战马' },
      extra: { weapon: { atk: 120, yw: 18 }, head: { yw: 12 }, arm: { yw: 10 }, chest: { def: 90 },
        feet: { yw: 8, spd: 6 }, mount: { spd: 14 } },
      eff: { 3: { atk: 240, yw: 20 }, 5: { yw: 60, sta: 40 }, 7: { def: 340 }, 11: { tong: 50, atk: 430, spd: 5 } },
    },
    {
      id: 'shouyu', name: '守御套', q: 3, iset: '守御',
      names: { head: '守御兜鍪', neck: '守御坠饰', shoulder: '守御肩铠', chest: '守御重铠', back: '守御披风',
        waist: '守御腰甲', arm: '守御臂甲', feet: '守御战靴', ring: '守御指环', pendant: '守御玉佩',
        weapon: '守御刀盾', mount: '守御骏马' },
      extra: { chest: { def: 180 }, head: { def: 100 }, shoulder: { def: 100 }, waist: { def: 100 },
        arm: { def: 90 }, back: { def: 60 }, feet: { def: 40 }, weapon: { def: 120, atk: 80 } },
      eff: { 3: { def: 280, sta: 60 }, 5: { sta: 90 }, 7: { def: 540 }, 11: { tong: 60, sta: 150 } },
    },
    {
      id: 'tiance', name: '天策套', q: 4, iset: '天策',
      names: { head: '天策冠', neck: '天策璎珞', shoulder: '天策云肩', chest: '天策战袍', back: '天策披风',
        waist: '天策玉带', arm: '天策护腕', feet: '天策战靴', ring: '天策玉戒', pendant: '天策玉佩',
        weapon: '天策宝剑', mount: '天策良驹' },
      extra: { weapon: { atk: 60, zm: 10 }, head: { nz: 12 }, chest: { nz: 16 }, shoulder: { nz: 10 },
        arm: { nz: 8 }, waist: { nz: 8 }, feet: { nz: 6, spd: 12 }, neck: { tong: 24 }, ring: { tong: 24 },
        pendant: { zm: 24 }, back: { zm: 24 }, mount: { tong: 8, spd: 18 } },
      eff: { 3: { nz: 30, sta: 30 }, 5: { zm: 30 }, 7: { tong: 50 }, 11: { atk: 300, nz: 40, zm: 40 } },
    },
  ];
  var IDPFX = { youxia: 'yx', xianzhen: 'xz', shouyu: 'sy', tiance: 'tc' };
  var PREFIX = { head: 'h', neck: 'n', shoulder: 's', chest: 'c', back: 'b', waist: 'w', arm: 'a',
    feet: 'f', ring: 'r', pendant: 'p', weapon: 'x', mount: 'm' };

  function fmtStat(v) { return String(v); }
  function effText(eff) {
    return STAT_ORDER.filter(function (k) { return eff[k]; })
      .map(function (k) { return STAT_NAME[k] + '+' + eff[k]; }).join('　');
  }

  var out = [];
  out.push('  /* ============================================================');
  out.push('   * v89.50（老板「创造4套套装，100+种物品」）：新套装 · 新物品一批');
  out.push('   * ------------------------------------------------------------');
  out.push('   * **追加式**：不动上面任何旧表，只往四张表里补条目 ——');
  out.push('   *   DATA.EQUIP（4 套 × 12 槽 = 48 件）· DATA.SETS（4 套四档加成）·');
  out.push('   *   DATA.BLUEPRINTS（4 张图纸）· DATA.ITEMS（新物品）· DATA.NEIGONG（4 门绝学）');
  out.push('   * 数值口径（与旧套同一把尺）：');
  out.push('   *   · 套装件 = **同品质同槽位散件 ×1.12** + 每套"特色属性"（详见生成器）');
  out.push('   *   · 套装加成 = 3/5/7/11 四档**累计**（DATA.SET_TIERS 单一来源），每套有一档带体力');
  out.push('   *   · 物品价 = 既有同类物品的价位阶梯（`price` 单位 = 100 金，商城 ×100）');
  out.push('   * 生成器：`.workbuddy/tools/gen/gen_v8950_content.js`（改数值先改它，别手改此处）');
  out.push('   * ============================================================ */');
  out.push('  (function () {');
  out.push('    /* ---------- ① 新套装件（4 套 × 12 槽） ---------- */');
  out.push('    var NEW_EQUIP = {');
  SETS.forEach(function (s) {
    out.push('      /* ' + s.name + '（q' + s.q + ' ' + (s.q === 2 ? '良品' : s.q === 3 ? '珍品' : '神品') + '）—— ' +
      effText(s.eff[3]) + ' … ' + effText(s.eff[11]) + ' */');
    SLOTS.forEach(function (slot) {
      var st = SLOT_STAT[slot];
      var base = Math.round(F[s.q][slot] * 1.12);
      /* ⚠ 属性用**表**累加，不要用字符串数组 push ——
         特色属性若与主属性同名（如战靴的 spd），"覆盖最后一项"的写法会把它前面的
         另一条特色吃掉（第一版就产出了 `spd: 49, spd: 55` 这种非法重复键）。 */
      var stats = {};
      stats[st] = base;
      var ex = s.extra[slot] || {};
      Object.keys(ex).forEach(function (k) { stats[k] = (stats[k] || 0) + ex[k]; });
      var order = [st].concat(Object.keys(ex).filter(function (k) { return k !== st; }));
      var parts = ['id: \'' + IDPFX[s.id] + '_' + PREFIX[slot] + '\'', 'name: \'' + s.names[slot] + '\'',
        'set: \'' + s.id + '\'', 'slot: \'' + slot + '\'', 'q: ' + s.q, 'sta: ' + SET_STA[s.q]];
      order.forEach(function (k) { parts.push(k + ': ' + stats[k]); });
      out.push('      ' + IDPFX[s.id] + '_' + PREFIX[slot] + ': { ' + parts.join(', ') + ' },');
    });
  });
  out.push('    };');
  out.push('    for (var ek in NEW_EQUIP) DATA.EQUIP[ek] = NEW_EQUIP[ek];');
  out.push('');
  out.push('    /* ---------- ② 四套加成（3/5/7/11 累计） ---------- */');
  out.push('    var NEW_SETS = {');
  SETS.forEach(function (s) {
    var bonus = {}, eff = {};
    Object.keys(s.eff).forEach(function (t) { bonus[t] = '\'' + effText(s.eff[t]) + '\''; eff[t] = s.eff[t]; });
    out.push('      ' + s.id + ': { name: \'' + s.name + '\',');
    out.push('        bonus: { ' + Object.keys(bonus).map(function (t) { return t + ': ' + bonus[t]; }).join(', ') + ' },');
    out.push('        eff: { ' + Object.keys(eff).map(function (t) {
      return t + ': { ' + Object.keys(eff[t]).map(function (k) { return k + ': ' + eff[t][k]; }).join(', ') + ' }';
    }).join(', ') + ' } },');
  });
  out.push('    };');
  out.push('    for (var sk in NEW_SETS) DATA.SETS[sk] = NEW_SETS[sk];');
  out.push('');
  out.push('    /* ---------- ③ 四张新图纸（铁匠铺前置；forgeList 自动收录新套） ---------- */');
  var BP = [['youxia', '游侠套图纸', 3, 70, '游侠套'], ['xianzhen', '陷阵套图纸', 5, 130, '陷阵套'],
    ['shouyu', '守御套图纸', 5, 130, '守御套'], ['tiance', '天策套图纸', 7, 360, '天策套']];
  var BPTEXT = [];
  BP.forEach(function (b) {
    BPTEXT.push('      { id: \'bp_' + b[0] + '\', name: \'' + b[1] + '\', type: \'blueprint\', set: \'' + b[0] +
      '\', price: ' + b[3] + ', forgeLv: ' + b[2] + ', desc: \'凭此可在铁匠铺打造「' + b[4] + '」（需铁匠铺 Lv' + b[2] + '）\' }');
  });
  out.push('    [' + BPTEXT.join(',\n    ') + '].forEach(function (bp) {');
  out.push('      DATA.BLUEPRINTS.push(bp);');
  out.push('      if (!DATA.ITEMS.some(function (x) { return x.id === bp.id; })) DATA.ITEMS.push(bp);');
  out.push('    });');

  /* ---------- ③ 物品 ---------- */
  var ITEMS = [];
  function it(id, name, type, price, desc, extra) {
    var o = '    { id: \'' + id + '\', name: \'' + name + '\', type: \'' + type + '\', ';
    if (extra) o += extra + ', ';
    o += 'price: ' + price + ', desc: \'' + desc + '\' }';
    ITEMS.push(o);
  }
  /* 珠宝（忠诚，价随档升） */
  [['xueshanhu', '血珊瑚', 65, 60], ['longyan', '龙涎珠', 70, 75], ['lantianyu', '蓝田玉', 75, 90],
   ['fengyu', '凤羽', 80, 110], ['heshibi', '和氏璧', 90, 150], ['chuanguo', '传国玉玺', 100, 240]]
    .forEach(function (x) { it(x[0], x[1], 'jewel', x[3], '赏赐忠诚 +' + x[2], 'loyalty: ' + x[2]); });
  /* 符类（将领 buff，24h） */
  [['huyi', '虎翼符', { tong_mult: 0.75 }, 200], ['xuande', '玄德符', { nz_mult: 0.5 }, 130],
   ['pojun', '破军符', { yw_mult: 0.5 }, 130], ['wolong', '卧龙符', { zm_mult: 0.5 }, 130],
   ['longxiang', '龙骧符', { tong_mult: 1.0 }, 300], ['anmin', '安民符', { nz_mult: 0.75 }, 200],
   ['tianlang', '天狼符', { yw_mult: 0.75 }, 200], ['guigu', '鬼谷符', { zm_mult: 0.75 }, 200],
   ['wangzuo', '王佐双符', { tong_mult: 0.5, nz_mult: 0.5 }, 260],
   ['hulang', '虎狼双符', { yw_mult: 0.5, zm_mult: 0.5 }, 260],
   ['sixiang', '四象符', { tong_mult: 0.5, nz_mult: 0.5, yw_mult: 0.5, zm_mult: 0.5 }, 480],
   ['jifeng', '疾风符', { spd: 20 }, 90], ['zhuifeng', '追风符', { spd: 50 }, 220],
   ['baye', '霸业符', { tong_mult: 1.0, yw_mult: 1.0 }, 400],
   ['mingjing', '明镜符', { zm_mult: 1.0 }, 280], ['zhisu', '治粟符', { nz_mult: 1.0 }, 280]]
    .forEach(function (x) {
      var an = { tong_mult: '统率', nz_mult: '内政', yw_mult: '勇武', zm_mult: '智谋' };
      var keys = Object.keys(x[2]).map(function (k) { return k + ': ' + x[2][k]; }).join(', ');
      var txt = Object.keys(x[2]).map(function (k) {
        return k === 'spd' ? ('速度+' + x[2][k]) : (an[k] + '+' + Math.round(x[2][k] * 100) + '%');
      }).join('　');
      it(x[0], x[1], 'attr_buff', x[3], '将领 24 小时内：' + txt, 'eff: { ' + keys + ' }, dur: 24');
    });
  /* 生产（24h） */
  [['shennongling', '神农灵锄', 'grain', 0.5, 12], ['houji', '后稷神犁', 'grain', 1.0, 30],
   ['lubanshen', '鲁班神斧', 'wood', 0.5, 12], ['jumuling', '巨木令', 'wood', 1.0, 30],
   ['kaishanshen', '开山神锤', 'stone', 0.5, 12], ['yugongling', '愚公令', 'stone', 1.0, 30],
   ['xuantieshen', '玄铁神炉', 'iron', 0.5, 12], ['ganjianglu', '干将炉', 'iron', 1.0, 30],
   ['yantieling', '盐铁令', 'gold', 0.5, 20], ['taozhufu', '陶朱符', 'gold', 1.0, 50]]
    .forEach(function (x) {
      var RN = { grain: '粮食', wood: '木材', stone: '石料', iron: '铁锭', gold: '黄金' };
      it(x[0], x[1], 'prod_buff', x[4], RN[x[2]] + '产量+' + Math.round(x[3] * 100) + '%（24h）',
        'res: \'' + x[2] + '\', eff: ' + x[3] + ', dur: 24');
    });
  /* 建造成本 */
  [['yingzao_fanglue', '营造方略', 0.3, 72, 160], ['jiangzuo_dadian', '将作大匠令', 0.4, 24, 110],
   ['zhuanshu_jiangzuo', '匠神尺', 0.5, 24, 180]]
    .forEach(function (x) { it(x[0], x[1], 'build_cost', x[4], '建造成本-' + Math.round(x[2] * 100) + '%（' + x[3] + 'h）', 'eff: ' + x[2] + ', dur: ' + x[3]); });
  /* 军事 */
  [['pozhengu', '破阵鼓', { atk: 0.15 }, 14], ['xuezhanqi', '血战旗', { atk: 0.25 }, 26],
   ['mieguogu', '灭国鼓', { atk: 0.35 }, 45], ['tiebit_tu', '铁壁图', { def: 0.15 }, 14],
   ['jincheng_tu', '金城图', { def: 0.25 }, 26], ['taishan_tu', '太山图', { def: 0.35 }, 45],
   ['xuming_shu', '续命书', { wound: 0.45 }, 130], ['yisheng_shu', '医圣书', { wound: 0.6 }, 200],
   ['dajiang_qi', '大将旗', { cap: 0.4 }, 28], ['jiezhi_ling', '节制令', { cap: 0.6 }, 50],
   ['gongshou_fu', '攻守符', { atk: 0.15, def: 0.15 }, 34],
   ['quanjun_ling', '全军令', { atk: 0.2, def: 0.2, cap: 0.2 }, 70],
   ['wanquan_ce', '万全策', { atk: 0.2, def: 0.2, wound: 0.4 }, 200],
   ['tianshi_ling', '天时令', { atk: 0.3, def: 0.3, cap: 0.3, wound: 0.3 }, 300]]
    .forEach(function (x) {
      var mn = { atk: '全军攻击', def: '全军防御', wound: '战损转伤', cap: '出征上限' };
      var keys = Object.keys(x[2]).map(function (k) { return k + ': ' + x[2][k]; }).join(', ');
      var txt = Object.keys(x[2]).map(function (k) { return mn[k] + '+' + Math.round(x[2][k] * 100) + '%'; }).join('　');
      it(x[0], x[1], 'military_buff', x[3], '24 小时内：' + txt, 'eff: { ' + keys + ' }, dur: 24');
    });
  /* 加速（四类队列 + 交易） */
  [['mojing_can', '墨经残卷', 'research', 360, 12], ['mojing_quan', '墨经全卷', 'research', 1440, 40],
   ['tiangong', '天工开物', 'research', 0.5, 150], ['hetu', '河图洛书', 'research', 0.7, 220],
   ['yingzao_can', '营造残卷', 'build', 1440, 35], ['yingguo_quan', '营国全典', 'build', 2880, 70],
   ['kaogong_quan', '考工全书', 'build', 0.4, 130], ['jiangzuo_chi', '匠作尺', 'build', 0.6, 200],
   ['lianbing_jiyao', '练兵纪要', 'train', 0.2, 25], ['dianbing_can', '点兵残卷', 'train', 0.4, 50],
   ['hufu_junling', '虎符军令', 'train', 0.75, 95], ['shiwan_jiabing', '十万甲兵', 'train', 0.9, 140],
   ['jixing_ling', '疾行令', 'march', 30, 40],
   ['yingzao_yaozhi', '营造要旨', 'build', 720, 55], ['mojing_yaozhi', '墨经要旨', 'research', 720, 55],
   ['tongshang_quan', '通商券', 'trade', 0.5, 30], ['taozhu_mishu', '陶朱秘术', 'trade', 0.95, 60]]
    .forEach(function (x) {
      var isPct = x[3] < 1;
      var extra = 'target: \'' + x[2] + '\', ' + (isPct ? 'pct: ' + x[3] : 'amount: ' + x[3]);
      var desc = { research: '研究', build: '建造', train: '募兵', march: '行军', trade: '市场折损' }[x[2]] +
        (isPct ? '时间-' + Math.round(x[3] * 100) + '%' : '缩短 ' + Math.round(x[3] / 60) + ' 小时') +
        (x[2] === 'trade' ? '（30 分钟）' : '');
      it(x[0], x[1], 'boost', x[4], desc, extra);
    });
  /* 经验 */
  [['pijiang_shouji', '裨将手记', 500, 30], ['xiaowei_zhaji', '校尉札记', 5000, 200],
   ['jiangjun_zhanlu', '将军战录', 50000, 1200], ['dudu_bingfa', '大都督兵法', 200000, 3800],
   ['mingjiang_xinchuan', '名将心传', 500000, 8000], ['bingxian_yipian', '兵仙遗篇', 1000000, 14000],
   ['taigong_bingshu', '太公兵书', 5000000, 50000], ['bingsheng', '千古兵圣', 20000000, 150000]]
    .forEach(function (x) { it(x[0], x[1], 'exp', x[3], '将领经验+' + x[2], 'amount: ' + x[2]); });
  /* 体力 */
  [['xingjun_san', '行军散', 0.05, 3], ['jinchuang_san', '金疮散', 0.15, 8], ['shengji_gao', '生肌膏', 0.35, 18],
   ['huiqi_dan', '回气丹', 0.5, 26], ['peiyuan_dan', '培元丹', 0.75, 42], ['guben_dan', '固本丹', 0.9, 60],
   ['daluo_dan', '大罗金丹', 1.0, 85], ['shengxin_wan', '生息丸', 0.2, 11],
   ['jingxin_dan', '静心丹', 0.6, 34], ['huanhun_lu', '还魂露', 0.95, 70]]
    .forEach(function (x) { it(x[0], x[1], 'stamina', x[3], '恢复将领体力' + Math.round(x[2] * 100) + '%', 'amount: ' + x[2]); });
  /* 坐骑（速度 1h） */
  [['yule_maju', '玉勒马具', 8, 130], ['jinan', '金鞍', 12, 200], ['zhaoye_an', '照夜玉鞍', 20, 330],
   ['taxue_an', '踏雪鞍', 30, 500], ['zhuifeng_an', '追风鞍', 45, 800], ['tianma_pei', '天马辔', 60, 1200]]
    .forEach(function (x) { it(x[0], x[1], 'mount_buff', x[3], '将领速度+' + x[2] + '（1h）', 'amount: ' + x[2]); });
  /* 宝箱 */
  [['chest_zitan', '紫檀宝箱', 2, 90], ['chest_jiulong', '九龙宝箱', 3, 220], ['chest_tianlu', '天禄宝箱', 3, 300]]
    .forEach(function (x) { it(x[0], x[1], 'chest', x[3], '开启随机获得丰厚资源 / 黄金 / 材料' + (x[2] >= 3 ? '（小概率图纸）' : ''), 'tier: ' + x[2]); });
  /* 政令（徭役） */
  [['corvee1', '小役令', 1, 24, 50], ['corvee2', '中役令', 2, 24, 85], ['corvee5', '大役令', 5, 24, 200],
   ['corvee3_48', '长役令', 3, 48, 190]]
    .forEach(function (x) { it(x[0], x[1], 'corvee', x[4], x[3] + ' 小时内同时建造队列 +' + x[2], 'dur: ' + x[3] + ', add: ' + x[2]); });
  /* 内功秘籍 */
  [['book_wuzi', '《吴子》', 'wuzi', 'zm'], ['book_sima', '《司马法》', 'sima', 'tong'],
   ['book_sanlue', '《三略》', 'sanlue', 'yw'], ['book_weiliu', '《尉缭子》', 'weiliu', 'nz']]
    .forEach(function (x) {
      var NG = { wuzi: ['治兵', 6], sima: ['严整', 6], sanlue: ['奇正', 6], weiliu: ['料敌', 6] }[x[2]];
      var AT = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋' }[x[3]];
      it(x[0], x[1], 'neigong', 160, '修习绝学「' + NG[0] + '」：' + AT + ' +' + NG[1] + '/重（最高 10 重）', 'teach: \'' + x[2] + '\'');
    });
  out.push('');
  out.push('    /* ---------- ④ 新物品 ' + ITEMS.length + ' 件（type 全都落在既有消费点上） ---------- */');
  out.push('    var NEW_ITEMS = [');
  out.push(ITEMS.join(',\n'));
  out.push('    ];');
  out.push('    NEW_ITEMS.forEach(function (x) {');
  out.push('      if (!DATA.ITEMS.some(function (y) { return y.id === x.id; })) DATA.ITEMS.push(x);');
  out.push('    });');
  out.push('');
  out.push('    /* ---------- ⑤ 四门绝学（每重 +6，强于既有四门的 +4） ---------- */');
  out.push('    var NEW_NG = [');
  out.push('      { id: \'wuzi\',    name: \'吴子\',     trait: \'治兵\', attr: \'zm\',  per: 6, maxLv: 10, desc: \'内修文德，外治武备。智谋 +6/重。\' },');
  out.push('      { id: \'sima\',    name: \'司马法\',   trait: \'严整\', attr: \'tong\', per: 6, maxLv: 10, desc: \'以礼为固，以仁为胜。统率 +6/重。\' },');
  out.push('      { id: \'sanlue\',   name: \'三略\',     trait: \'奇正\', attr: \'yw\',  per: 6, maxLv: 10, desc: \'柔能制刚，弱能制强。勇武 +6/重。\' },');
  out.push('      { id: \'weiliu\',   name: \'尉缭子\',   trait: \'料敌\', attr: \'nz\',  per: 6, maxLv: 10, desc: \'料敌合变，出奇无穷。内政 +6/重。\' }');
  out.push('    ];');
  out.push('    NEW_NG.forEach(function (x) {');
  out.push('      if (!DATA.NEIGONG.some(function (y) { return y.id === x.id; })) DATA.NEIGONG.push(x);');
  out.push('    });');
  out.push('  })();');

  var text = out.join('\n');
  console.log(text);
  console.error('--- 统计 ---');
  console.error('套装件 ' + (SETS.length * SLOTS.length) + ' · 套装 ' + SETS.length + ' · 图纸 ' + BP.length +
    ' · 物品 ' + ITEMS.length + ' · 绝学 ' + 4);
})();
