# -*- coding: utf-8 -*-
"""v88 数据层：灵气装备（双轨修炼侧）+ 蕴养表 + 江湖活动 + 灵气精华。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\data.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

# ============ 1) ITEMS 加「灵气精华」 ============
if "id: 'lingsui'" in d:
    print('SKIP 1/2 精华已存在')
else:
    ANCHOR1 = "    { id: 'jinang', name: '锦囊', type: 'talis', price: 15, desc: '施展计谋所需。妙计千条，藏于囊中。' },"
    ADD1 = ("    { id: 'jinang', name: '锦囊', type: 'talis', price: 15, desc: '施展计谋所需。妙计千条，藏于囊中。' },\n"
            "    /* v88（灵气装备）：灵气精华 —— 蕴养修炼装备的专属材料（price 0 = 商城不售；源出野地游历） */\n"
            "    { id: 'lingsui', name: '灵气精华', type: 'essence', price: 0, desc: '天地游离灵气凝成之物。蕴养修炼装备所需，于野地游历中获得。' },")
    assert d.count(ANCHOR1) == 1, 'ITEMS 锚点 %d 次' % d.count(ANCHOR1)
    d = d.replace(ANCHOR1, ADD1, 1)
    dirty = True
    print('OK 1/2 ITEMS 精华已加')

# ============ 2) 主数据块（WILD_SCENES 之后、window.GAME.DATA 之前） ============
if 'DATA.LING_ACT' in d:
    print('SKIP 2/2 灵气数据块已存在')
else:
    ANCHOR2 = """        { w: 28, t: '风尘仆仆', none: 1 },
      ] },
  };

  window.GAME.DATA = DATA;"""

    BLOCK = """        { w: 28, t: '风尘仆仆', none: 1 },
      ] },
  };

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
    tao: { name: '讨伐', kind: 'fight', icon: '⚔️', energy: 15, stam: 6, power: 200, drop: 0.05,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [30, 50] }, lose: { wound: 8, ess: [5, 10] },
      desc: '清剿野地贼寇妖兽：胜则灵材丰厚，败亦有所得（负伤而归）。' },
    qie: { name: '切磋', kind: 'fight', icon: '🤝', energy: 10, stam: 4, power: 100, drop: 0.03,
      spots: ['hill', 'desert', 'caoyuan'],
      win: { ess: [15, 25] }, lose: { wound: 3, ess: [8, 12] },
      desc: '与江湖武人对练：无论胜负必有所悟（心得保底）。' },
    shi: { name: '试炼', kind: 'trial', icon: '🗿', energy: 18, stam: 7, power: 320, drop: 0.15,
      spots: ['hill', 'forest', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [45, 75] }, lose: { wound: 10, ess: [10, 18] },
      desc: '古阵试炼共三层逐层加码：见好就收，或再进一层。' },
    cai: { name: '采集', kind: 'gather', icon: '🌿', energy: 8, stam: 3,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [20, 35] },
      desc: '采灵草撷灵矿：灵气精华入袋，偶有双收。' },
    xiu: { name: '修炼', kind: 'cultivate', icon: '🧘', energy: 12, stam: 5,
      spots: ['forest', 'lake'],
      win: { ess: [35, 55] },
      desc: '择灵气葱郁处打坐聚气：精华稳定入体，小概率「悟道时刻」。' },
    bai: { name: '拜访', kind: 'visit', icon: '🏡', energy: 8, stam: 2,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [10, 20] },
      desc: '拜访隐士奇人：一段小故事，一份小赠礼。' },
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

  window.GAME.DATA = DATA;"""

    assert d.count(ANCHOR2) == 1, '尾部锚点 %d 次' % d.count(ANCHOR2)
    d = d.replace(ANCHOR2, BLOCK, 1)
    dirty = True
    print('OK 2/2 灵气数据块已加')

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')

# 验证
d2 = io.open(P, encoding='utf-8', newline='').read()
print()
print('LING_ACT 出现 %d 次（期望 1）| lingsui %d 次（期望 1）' % (d2.count('DATA.LING_ACT'), d2.count("id: 'lingsui'")))
