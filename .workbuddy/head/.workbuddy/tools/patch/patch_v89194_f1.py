# -*- coding: utf-8 -*-
"""v89.194 批次F1：藏珍阁数据表（DATA.COLLECT 18 系列 · 71 件）+ 导航图标"""
import io

R = 'E:/Deepseekdb/'
DATA = R + 'js/data.js'
ICONS = R + 'js/icons.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败'
    print('[ok] ' + tag)

# ─────────────────────────────────────────────
# F1-1. data.js：DATA.COLLECT（18 系列 / 71 件）
# ─────────────────────────────────────────────
COLLECT_JS = u'''  /* ============================================================
   * v89.194（老板 S3）：**藏珍阁**（收藏体系）—— 数据表
   * ------------------------------------------------------------
   * 老板原话：「增加一个收藏菜单，与商场，背包并列，意图通过购买成系列的收藏品，
   *   消耗后期金币，藏品可以上各阵营名将，各美女，再设计十来二十个系列」。
   * 定位：**纯荣誉 sink**（消耗后期金币 · 不给战斗强度）—— 18 个系列 / 71 件藏品；
   *   集齐一系给**声望**（游戏既有荣誉货币：爵位门槛与任务都读它）。
   * 结构：series[].items[] = { id, name, sub, price }；price = **金**（唯一池直接价，
   *   不走商城 ×100 体系）；rep = 集齐该系列的声望奖励；allRep = 全 18 系集齐的额外奖励。
   * 状态：`s.collect = { 藏品id: 1 }`（随档）；完成度/统计全部由它派生（GAME.collectStatOf）。
   * 量级：全库合计 892 万金（≈ 3.5 日满编月俸）——"到后期有事可做、有钱可花"。
   * 加新系列：只改本表（界面 / 出口 / 统计全表驱动，零代码改动）。
   * ============================================================ */
  DATA.COLLECT = {
    allRep: 1000,
    series: [
      { id: 'wei5', name: '曹魏五子良将', icon: '⚔️', rep: 240,
        desc: '五子良将，曹魏之爪牙 —— 张辽威震逍遥津，乐进先登陷阵。',
        items: [
          { id: 'col_zhangliao', name: '张辽', sub: '威震逍遥津', price: 120000 },
          { id: 'col_yuejin',    name: '乐进', sub: '先登陷阵',   price: 120000 },
          { id: 'col_yujin',     name: '于禁', sub: '持军严整',   price: 120000 },
          { id: 'col_zhanghe',   name: '张郃', sub: '巧变无方',   price: 120000 },
          { id: 'col_xuhuang',   name: '徐晃', sub: '长驱解围',   price: 120000 }
        ] },
      { id: 'shu5', name: '蜀汉五虎上将', icon: '🐉', rep: 300,
        desc: '五虎上将，蜀汉之柱石 —— 关张赵马黄，名垂千古。',
        items: [
          { id: 'col_guanyu',     name: '关羽', sub: '威震华夏', price: 150000 },
          { id: 'col_zhangfei',   name: '张飞', sub: '据水断桥', price: 150000 },
          { id: 'col_zhaoyun',    name: '赵云', sub: '单骑救主', price: 150000 },
          { id: 'col_machao',     name: '马超', sub: '锦甲银枪', price: 150000 },
          { id: 'col_huangzhong', name: '黄忠', sub: '定军扬威', price: 150000 }
        ] },
      { id: 'wu4', name: '东吴四大都督', icon: '🔱', rep: 208,
        desc: '四都督相继执掌江东水陆 —— 赤壁、荆州、夷陵，三战定三分。',
        items: [
          { id: 'col_zhouyu', name: '周瑜', sub: '火烧赤壁', price: 130000 },
          { id: 'col_lusu',   name: '鲁肃', sub: '榻上雄谈', price: 130000 },
          { id: 'col_lvmeng', name: '吕蒙', sub: '白衣渡江', price: 130000 },
          { id: 'col_luxun',  name: '陆逊', sub: '夷陵焚营', price: 130000 }
        ] },
      { id: 'hebei', name: '河北劲旅', icon: '🛡️', rep: 128,
        desc: '袁绍帐下骁将 —— 颜良文丑勇冠三军，麴义界桥破白马。',
        items: [
          { id: 'col_yanliang', name: '颜良', sub: '勇冠三军', price: 80000 },
          { id: 'col_wenchou',  name: '文丑', sub: '河朔骁将', price: 80000 },
          { id: 'col_gaolan',   name: '高览', sub: '沉稳持重', price: 80000 },
          { id: 'col_quyi',     name: '麴义', sub: '界桥强弩', price: 80000 }
        ] },
      { id: 'liangzhou', name: '凉州铁骑', icon: '🐎', rep: 144,
        desc: '西凉铁骑，天下精锐 —— 马腾韩遂纵横关右，庞德抬棺死战。',
        items: [
          { id: 'col_mateng', name: '马腾', sub: '西凉雄主', price: 90000 },
          { id: 'col_hansui', name: '韩遂', sub: '纵横关右', price: 90000 },
          { id: 'col_pangde', name: '庞德', sub: '抬棺死战', price: 90000 },
          { id: 'col_madai',  name: '马岱', sub: '临阵斩将', price: 90000 }
        ] },
      { id: 'jingxiang', name: '荆襄宿将', icon: '🏹', rep: 128,
        desc: '荆襄之地，豪杰辈出 —— 魏延镇汉中，文聘守江夏。',
        items: [
          { id: 'col_weiyan', name: '魏延', sub: '镇守汉中', price: 80000 },
          { id: 'col_wenpin', name: '文聘', sub: '江夏铁壁', price: 80000 },
          { id: 'col_liyan',  name: '李严', sub: '托孤之臣', price: 80000 },
          { id: 'col_huojun', name: '霍峻', sub: '孤城拒敌', price: 80000 }
        ] },
      { id: 'huchen', name: '江东十二虎臣', icon: '🐅', rep: 200,
        desc: '江东虎臣，敢死之士 —— 程普黄盖三朝元老，甘宁百骑劫营。',
        items: [
          { id: 'col_chengpu',  name: '程普', sub: '江东元老', price: 100000 },
          { id: 'col_huanggai', name: '黄盖', sub: '苦肉诈降', price: 100000 },
          { id: 'col_handang',  name: '韩当', sub: '三朝宿将', price: 100000 },
          { id: 'col_zhoutai',  name: '周泰', sub: '浑身是胆', price: 100000 },
          { id: 'col_ganning',  name: '甘宁', sub: '锦帆百骑', price: 100000 }
        ] },
      { id: 'caozong', name: '曹魏宗室', icon: '🐺', rep: 176,
        desc: '曹氏夏侯，宗室肱骨 —— 夏侯惇拔矢啖睛，曹仁据守樊城。',
        items: [
          { id: 'col_xiahoudun',   name: '夏侯惇', sub: '拔矢啖睛', price: 110000 },
          { id: 'col_xiahouyuan',  name: '夏侯渊', sub: '虎步关右', price: 110000 },
          { id: 'col_caoren',      name: '曹仁', sub: '据守樊城', price: 110000 },
          { id: 'col_caohong',     name: '曹洪', sub: '献马救主', price: 110000 }
        ] },
      { id: 'shuxiang', name: '蜀汉四相', icon: '🎋', rep: 192,
        desc: '蜀汉四相，相继秉政 —— 鞠躬尽瘁，死而后已。',
        items: [
          { id: 'col_zhugeliang', name: '诸葛亮', sub: '鞠躬尽瘁', price: 120000 },
          { id: 'col_jiangwan',   name: '蒋琬', sub: '方整有威重', price: 120000 },
          { id: 'col_feiwei',     name: '费祎', sub: '宽济博爱', price: 120000 },
          { id: 'col_dongyun',    name: '董允', sub: '秉正下士', price: 120000 }
        ] },
      { id: 'qunxiong', name: '群雄逐鹿', icon: '🏰', rep: 180,
        desc: '汉末乱世，群雄并起 —— 人中吕布，四世三公。',
        items: [
          { id: 'col_lvbu',       name: '吕布', sub: '人中吕布', price: 90000 },
          { id: 'col_dongzhuo',   name: '董卓', sub: '挟天子', price: 90000 },
          { id: 'col_yuanshao',   name: '袁绍', sub: '四世三公', price: 90000 },
          { id: 'col_gongsunzan', name: '公孙瓒', sub: '白马义从', price: 90000 },
          { id: 'col_yuanshu',    name: '袁术', sub: '僭号仲家', price: 90000 }
        ] },
      { id: 'simei', name: '四大美人', icon: '🌸', rep: 288,
        desc: '沉鱼落雁，闭月羞花 —— 四大美人图，传世珍品。',
        items: [
          { id: 'col_xishi',      name: '西施', sub: '沉鱼之貌', price: 180000 },
          { id: 'col_wangzhaojun', name: '王昭君', sub: '落雁之容', price: 180000 },
          { id: 'col_diaochan',   name: '貂蝉', sub: '闭月之姿', price: 180000 },
          { id: 'col_yangyuhuan', name: '杨玉环', sub: '羞花之颜', price: 180000 }
        ] },
      { id: 'erqiao', name: '江东二乔', icon: '🎐', rep: 200,
        desc: '江东二乔，国色天香 —— 铜雀春深锁二乔。',
        items: [
          { id: 'col_daqiao',  name: '大乔', sub: '国色', price: 250000 },
          { id: 'col_xiaoqiao', name: '小乔', sub: '天香', price: 250000 }
        ] },
      { id: 'qinv', name: '三国奇女子', icon: '🪷', rep: 240,
        desc: '奇女子不让须眉 —— 文姬归汉，洛神凌波。',
        items: [
          { id: 'col_caiwenji',       name: '蔡文姬', sub: '胡笳十八拍', price: 150000 },
          { id: 'col_zhenmi',         name: '甄宓', sub: '洛神赋', price: 150000 },
          { id: 'col_huangyueying',   name: '黄月英', sub: '巧思绝伦', price: 150000 },
          { id: 'col_sunshangxiang',  name: '孙尚香', sub: '弓腰姬', price: 150000 }
        ] },
      { id: 'hanjiaren', name: '汉宫佳人', icon: '🏮', rep: 144,
        desc: '汉宫深院，佳人如画 —— 飞燕起舞，文君当垆。',
        items: [
          { id: 'col_zhaofeiyan', name: '赵飞燕', sub: '掌上舞', price: 120000 },
          { id: 'col_banjieyu',   name: '班婕妤', sub: '团扇诗', price: 120000 },
          { id: 'col_zhuowenjun', name: '卓文君', sub: '白头吟', price: 120000 }
        ] },
      { id: 'shenbing', name: '神兵谱', icon: '🗡️', rep: 160,
        desc: '名将佩刃，寒光凛冽 —— 青龙偃月，方天画戟。',
        items: [
          { id: 'col_qinglongdao',    name: '青龙偃月刀', sub: '关羽佩刃', price: 100000 },
          { id: 'col_zhangbashemao',  name: '丈八蛇矛', sub: '张飞佩刃', price: 100000 },
          { id: 'col_fangtianhuaji',  name: '方天画戟', sub: '吕布佩刃', price: 100000 },
          { id: 'col_gudingdao',      name: '古锭刀', sub: '孙坚佩刃', price: 100000 }
        ] },
      { id: 'mingju', name: '名驹谱', icon: '🐴', rep: 224,
        desc: '人中吕布，马中赤兔 —— 名驹图谱，一骑绝尘。',
        items: [
          { id: 'col_chitu',            name: '赤兔', sub: '日行千里', price: 140000 },
          { id: 'col_dilu',             name: '的卢', sub: '跃溪救主', price: 140000 },
          { id: 'col_jueying',          name: '绝影', sub: '宛城断后', price: 140000 },
          { id: 'col_zhuahuangfeidian', name: '爪黄飞电', sub: '许田猎猎', price: 140000 }
        ] },
      { id: 'zhongqi', name: '传国重器', icon: '🏺', rep: 320,
        desc: '国之重器，天命所归 —— 受命于天，既寿永昌。',
        items: [
          { id: 'col_chuanguoyuxi', name: '传国玉玺', sub: '受命于天', price: 200000 },
          { id: 'col_heshibi',      name: '和氏璧', sub: '完璧归赵', price: 200000 },
          { id: 'col_jiuding',      name: '九鼎', sub: '问鼎轻重', price: 200000 },
          { id: 'col_chixiaojian',  name: '赤霄剑', sub: '斩蛇起义', price: 200000 }
        ] },
      { id: 'huaxiang', name: '汉画像砖', icon: '🖼️', rep: 96,
        desc: '汉风砖拓，古朴苍茫 —— 车马宴饮，乐舞田猎。',
        items: [
          { id: 'col_chema_tu',  name: '车马出行图', sub: '汉风砖拓', price: 60000 },
          { id: 'col_yanyin_tu', name: '宴饮图', sub: '汉风砖拓', price: 60000 },
          { id: 'col_yuewu_tu',  name: '乐舞图', sub: '汉风砖拓', price: 60000 },
          { id: 'col_tianlie_tu', name: '田猎图', sub: '汉风砖拓', price: 60000 }
        ] }
    ],
  };

'''
F1_OLD = """  /* ============================================================
   * v89.186（老板 1）：**挂件体系（框架）** + 宝具（第一个挂件模块）"""
F1_NEW = COLLECT_JS + """  /* ============================================================
   * v89.186（老板 1）：**挂件体系（框架）** + 宝具（第一个挂件模块）"""
rep(DATA, 'F1-1 DATA.COLLECT', F1_OLD, F1_NEW, 'DATA.COLLECT = {')

# ─────────────────────────────────────────────
# F1-2. icons.js：navSet 加 collection 图标（画轴）
# ─────────────────────────────────────────────
F2_OLD = """    bag: '<path d="M6.2 8.2h11.6l1.3 11a1.5 1.5 0 0 1-1.5 1.6H6.4a1.5 1.5 0 0 1-1.5-1.6z"/>'
      + '<path d="M9.2 8.2V6.6a2.8 2.8 0 0 1 5.6 0v1.6"/><path d="M6.6 12.4h10.8"/>',"""
F2_NEW = """    bag: '<path d="M6.2 8.2h11.6l1.3 11a1.5 1.5 0 0 1-1.5 1.6H6.4a1.5 1.5 0 0 1-1.5-1.6z"/>'
      + '<path d="M9.2 8.2V6.6a2.8 2.8 0 0 1 5.6 0v1.6"/><path d="M6.6 12.4h10.8"/>',
    /* v89.194（老板 S3）：收藏 —— 画轴（藏品含名将画像/书画，卷轴最贴题） */
    collection: '<rect x="6.4" y="6.6" width="11.2" height="10.8" rx="1"/>'
      + '<path d="M3.6 4.6v14.8M20.4 4.6v14.8"/>'
      + '<path d="M3.6 6.6h2.8M3.6 17.4h2.8M17.6 6.6h2.8M17.6 17.4h2.8"/>',"""
rep(ICONS, 'F1-2 nav 收藏图标', F2_OLD, F2_NEW, 'collection: \'<rect x="6.4" y="6.6" width="11.2" height="10.8" rx="1"/>\'')

print('\n批次 F1 全部完成。')
