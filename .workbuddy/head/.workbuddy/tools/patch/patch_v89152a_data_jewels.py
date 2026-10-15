# -*- coding: utf-8 -*-
# v89.152a：data.js 珠宝体系重设（18 种新珠宝 / 地形表 / 门槛 / RANK / 迁移表 / 初始物品 / 删旧6行）
# 纪律：锚点唯一性预检 -> 段级幂等守卫 -> 原子写盘 -> 写后自检（括号配平 + 特征计数）
import io, re, sys

P = 'E:/Deepseekdb/js/data.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)


def seg(start_mark, end_mark, cnt=1):
    """按起止标记取一段（含起点、不含终点），返回 (text, s0, s1)；断言唯一"""
    c = s.count(start_mark)
    assert c >= 1, 'start not found: ' + start_mark[:60]
    s0 = s.index(start_mark)
    s1 = s.index(end_mark, s0 + len(start_mark))
    return s[s0:s1], s0, s1


NEW_JEWELS = u"""    /* 珠宝（赏赐忠诚 · 爵位晋升 · 建筑高阶升级）—— v89.152 重设（**唯一来源**）
       ------------------------------------------------------------
       老板（2026-09-27）：「珠宝重新设定，每种野地根据常理设计 3 种珠宝，共同构成
       爵位晋升，建筑升级等功能的所需珠宝，目前的珠宝体系更换掉（实际上就是换掉名字）」。
       设计口径（改珠宝体系 = 只改这里 + jewelTable / jewelMinLv / RANK 的引用）：
         · **6 种可采地形 x 3 档（常见 / 少见 / 稀有）= 18 种**，各归其位（见 DATA.GATHER.jewelTable）；
         · 本数组**按 price 升序**就是"珠宝阶梯"（`DATA.jewelLadder()` 直读，不另排）——
           爵位（DATA.RANK）· 建筑高阶升级（DATA.jewelCostAt）· 宝箱与缴获分档都读它；
           ⚠️ 宝箱/缴获按**数组顺序**切"最便宜的 N 档"，故本数组必须保持价格升序；
         · loyalty = 赏赐忠诚值（5 -> 100，随 price 递增）；price = 商城价（阶梯的锚）。
       ------------------------------------------------------------
       命名按"地形常理"，每档六个地形各一颗（轮转）：
         常见：蚌珠(湖) / 蜜蜡(草) / 煤玉(沼) / 青玉(森) / 紫晶(荒) / 绿松石(山)
         少见：红珊瑚(湖) / 玉髓(草) / 阴沉木(沼) / 翠玉(森) / 蛋白石(荒) / 碧玺(山)
         稀有：鲛人泪(湖) / 天珠(草) / 龙涎香(沼) / 沉香(森) / 夜明珠(荒) / 和田玉(山)
       旧 15 种（珍珠/珊瑚/琉璃/琥珀/玛瑙/水晶/翡翠/玉石/夜明珠/血珊瑚/龙涎珠/蓝田玉/
       凤羽/和氏璧/传国玉玺）整批退役 —— 老档库存按 DATA.JEWEL_MIG152 等值换算。 */
    { id: 'bengzhu', name: '蚌珠', type: 'jewel', loyalty: 5, price: 2, desc: '赏赐忠诚 +5（湖泊所产）' },
    { id: 'mila', name: '蜜蜡', type: 'jewel', loyalty: 10, price: 4, desc: '赏赐忠诚 +10（草原所产）' },
    { id: 'meiyu', name: '煤玉', type: 'jewel', loyalty: 15, price: 7, desc: '赏赐忠诚 +15（沼泽所产）' },
    { id: 'qingyu', name: '青玉', type: 'jewel', loyalty: 20, price: 10, desc: '赏赐忠诚 +20（森林所产）' },
    { id: 'zijin', name: '紫晶', type: 'jewel', loyalty: 24, price: 12, desc: '赏赐忠诚 +24（荒漠所产）' },
    { id: 'lvsongshi', name: '绿松石', type: 'jewel', loyalty: 28, price: 14, desc: '赏赐忠诚 +28（山地所产）' },
    { id: 'hongshanhu', name: '红珊瑚', type: 'jewel', loyalty: 32, price: 16, desc: '赏赐忠诚 +32（湖泊所产）' },
    { id: 'yusui', name: '玉髓', type: 'jewel', loyalty: 36, price: 19, desc: '赏赐忠诚 +36（草原所产）' },
    { id: 'yinchenmu', name: '阴沉木', type: 'jewel', loyalty: 42, price: 26, desc: '赏赐忠诚 +42（沼泽所产）' },
    { id: 'cuiyu', name: '翠玉', type: 'jewel', loyalty: 48, price: 36, desc: '赏赐忠诚 +48（森林所产）' },
    { id: 'danbaishi', name: '蛋白石', type: 'jewel', loyalty: 54, price: 48, desc: '赏赐忠诚 +54（荒漠所产）' },
    { id: 'bixi', name: '碧玺', type: 'jewel', loyalty: 60, price: 58, desc: '赏赐忠诚 +60（山地所产）' },
    { id: 'jiaorenlei', name: '鲛人泪', type: 'jewel', loyalty: 65, price: 60, desc: '赏赐忠诚 +65（湖泊所产）' },
    { id: 'tianzhu', name: '天珠', type: 'jewel', loyalty: 72, price: 75, desc: '赏赐忠诚 +72（草原所产）' },
    { id: 'longxianxiang', name: '龙涎香', type: 'jewel', loyalty: 78, price: 90, desc: '赏赐忠诚 +78（沼泽所产）' },
    { id: 'chenxiang', name: '沉香', type: 'jewel', loyalty: 85, price: 110, desc: '赏赐忠诚 +85（森林所产）' },
    { id: 'yemingzhu', name: '夜明珠', type: 'jewel', loyalty: 92, price: 150, desc: '赏赐忠诚 +92（荒漠所产 · 全地形偶得）' },
    { id: 'hetianyu', name: '和田玉', type: 'jewel', loyalty: 100, price: 240, desc: '赏赐忠诚 +100（山地所产）' },
    """

NEW_TABLE = u"""    jewelTable: {
      lake:    ['bengzhu', 'hongshanhu', 'jiaorenlei'],      /* 湖泊 · 水产之珍：蚌珠 / 红珊瑚 / 鲛人泪 */
      caoyuan: ['mila', 'yusui', 'tianzhu'],                 /* 草原 · 草原化石：蜜蜡 / 玉髓 / 天珠 */
      zhaoze:  ['meiyu', 'yinchenmu', 'longxianxiang'],      /* 沼泽 · 沼生沉淀：煤玉 / 阴沉木 / 龙涎香 */
      forest:  ['qingyu', 'cuiyu', 'chenxiang'],             /* 森林 · 林下山矿：青玉 / 翠玉 / 沉香 */
      desert:  ['zijin', 'danbaishi', 'yemingzhu'],          /* 荒漠 · 戈壁结晶：紫晶 / 蛋白石 / 夜明珠 */
      hill:    ['lvsongshi', 'bixi', 'hetianyu'],            /* 山地 · 山石之髓：绿松石 / 碧玺 / 和田玉 */
    },
    """

NEW_MINLV = u"""    jewelMinLv: {
      bengzhu: 1, mila: 1, meiyu: 1, qingyu: 1, zijin: 1, lvsongshi: 1,
      hongshanhu: 3, yusui: 3,
      yinchenmu: 4,
      cuiyu: 5, danbaishi: 5, bixi: 5,
      jiaorenlei: 6, tianzhu: 6,
      longxianxiang: 7, chenxiang: 7,
      yemingzhu: 8, hetianyu: 8,
    },
    """

NEW_RANK = u"""    { name: '公士', city: 2, rep: 1000, gold: 20000, jewel: { bengzhu: 10, mila: 5 }, salary: 1000 },
    { name: '上造', city: 3, rep: 2000, gold: 40000, jewel: { mila: 10, meiyu: 5 }, salary: 2000 },
    { name: '簪袅', city: 4, rep: 4000, gold: 60000, jewel: { meiyu: 10, qingyu: 5 }, salary: 5000 },
    { name: '不更', city: 5, rep: 8000, gold: 80000, jewel: { qingyu: 10, zijin: 5 }, salary: 10000 },
    { name: '大夫', city: 6, rep: 16000, gold: 100000, jewel: { zijin: 10, lvsongshi: 5 }, salary: 20000 },
    { name: '官大夫', city: 7, rep: 32000, gold: 200000, jewel: { lvsongshi: 10, hongshanhu: 5 }, salary: 20000 },
    { name: '公大夫', city: 8, rep: 64000, gold: 300000, jewel: { hongshanhu: 10, yusui: 5 }, salary: 20000 },
    { name: '公乘', city: 9, rep: 128000, gold: 400000, jewel: { yusui: 10, yinchenmu: 5 }, salary: 20000 },
    { name: '五大夫', city: 10, rep: 256000, gold: 500000, jewel: { yinchenmu: 10, cuiyu: 5 }, salary: 20000 },
    { name: '左庶长', city: 11, rep: 512000, gold: 600000, jewel: { cuiyu: 12, danbaishi: 6, bixi: 4 }, salary: 30000 },
    { name: '右庶长', city: 12, rep: 1024000, gold: 800000, jewel: { danbaishi: 12, bixi: 6, jiaorenlei: 4 }, salary: 30000 },
    { name: '左更', city: 13, rep: 2048000, gold: 1000000, jewel: { bixi: 12, jiaorenlei: 6, tianzhu: 4 }, salary: 50000 },
    { name: '中更', city: 14, rep: 4096000, gold: 2000000, jewel: { jiaorenlei: 12, tianzhu: 6, longxianxiang: 4 }, salary: 50000 },
    { name: '右更', city: 15, rep: 8192000, gold: 3000000, jewel: { tianzhu: 12, longxianxiang: 6, chenxiang: 4 }, salary: 50000 },
    { name: '少上造', city: 16, rep: 16384000, gold: 4000000, jewel: { longxianxiang: 12, chenxiang: 6, yemingzhu: 4 }, salary: 50000 },
    { name: '大上造', city: 17, rep: 32768000, gold: 5000000, jewel: { chenxiang: 12, yemingzhu: 6, hetianyu: 4 }, salary: 50000 },
    { name: '驷车庶长', city: 18, rep: 65536000, gold: 6000000, jewel: { bengzhu: 30, meiyu: 20, qingyu: 15, zijin: 10 }, salary: 75000 },
    { name: '大庶长', city: 19, rep: 131072000, gold: 7500000, jewel: { hongshanhu: 30, yusui: 20, yinchenmu: 15, cuiyu: 10 }, salary: 75000 },
    { name: '关内侯', city: 20, rep: 262144000, gold: 10000000, jewel: { danbaishi: 30, bixi: 20, jiaorenlei: 15, tianzhu: 10 }, salary: 100000 },
    { name: '位列诸侯', city: 21, rep: 524288000, gold: 20000000, jewel: { longxianxiang: 20, chenxiang: 16, yemingzhu: 12, hetianyu: 10, tianzhu: 20 }, salary: 100000 },
    { name: '裂土封王', city: 22, rep: 1048576000, gold: 50000000, jewel: { bengzhu: 60, cuiyu: 40, yemingzhu: 25, hetianyu: 20, longxianxiang: 15 }, salary: 200000 },
    """

NEW_MIG = u"""  /* ============================================================
   * v89.152：珠宝体系重设 —— **旧 15 种 -> 新 18 种**的等值换算表
   * ------------------------------------------------------------
   * 老板：「目前的珠宝体系更换掉（实际上就是换掉名字）」—— 换算按 **price 一一对应**
   * （旧珍珠 2 -> 新蚌珠 2 …… 旧传国玉玺 240 -> 新和田玉 240），玩家资产零损耗。
   * 老的库存键（s.items 里的旧 id）由 `GAME.migrateJewels152` 按本表搬运
   * （读档/首 tick 执行 · 幂等标记 s.jewelMig152）。
   * ⚠️ 表内"目标键"与新体系 id 同名不算冲突（旧夜明珠->蛋白石；新夜明珠是另一颗）——
   *   迁移算法"先把旧键全部摘下，再写入目标键"，摘与写分两步，天然安全。
   * ============================================================ */
  DATA.JEWEL_MIG152 = {
    zhenzhu: 'bengzhu', shanhu: 'mila', liuli: 'meiyu', hupo: 'qingyu',
    manao: 'lvsongshi', shuijing: 'yusui', feicui: 'yinchenmu', yushi: 'cuiyu',
    yemingzhu: 'danbaishi', xueshanhu: 'jiaorenlei', longyan: 'tianzhu',
    lantianyu: 'longxianxiang', fengyu: 'chenxiang', heshibi: 'yemingzhu',
    chuanguo: 'hetianyu',
  };
"""

changes = []

# ---------- 段 A：9 行 -> 18 行（含头注释） ----------
markA = u'    /* 珠宝（赏赐忠诚） */'
if u"id: 'bengzhu'" not in s:
    oldA, a0, a1 = seg(markA, u'/* v86（老板「按计划进行」· 第四轮 G1）：锦囊')
    s = s[:a0] + NEW_JEWELS + s[a1:]
    changes.append('A: jewels 9 -> 18')
else:
    changes.append('A: skip (already)')

# ---------- 段 B：jewelTable ----------
if u"lake:    ['bengzhu'" not in s:
    oldB, b0, b1 = seg(u'    jewelTable: {', u'    /* 最低野地等级门槛')
    s = s[:b0] + NEW_TABLE + s[b1:]
    changes.append('B: jewelTable')
else:
    changes.append('B: skip (already)')

# ---------- 段 C：jewelMinLv ----------
if u'bengzhu: 1, mila: 1' not in s:
    oldC, c0, c1 = seg(u'    jewelMinLv: {', u'    /* v89.140（老板 10）')
    s = s[:c0] + NEW_MINLV + s[c1:]
    changes.append('C: jewelMinLv')
else:
    changes.append('C: skip (already)')

# ---------- 段 D：RANK 21 行 ----------
if u"jewel: { bengzhu: 10" not in s:
    oldD, d0, d1 = seg(u"    { name: '公士', city: 2", u"    { name: '裂土封王', city: 22")
    # 终点标记取到行尾（含该行）
    d1 = s.index(u'\n', d1) + 1
    assert u"'裂土封王'" in s[d0:d1] and u"'公士'" in s[d0:d1]
    s = s[:d0] + NEW_RANK + s[d1:]
    changes.append('D: RANK 21 rows')
else:
    changes.append('D: skip (already)')

# ---------- 段 G：JEWEL_MIG152（插在 jewelCostAt 之后，DATA.BUILD_TIME 段之前） ----------
if u'DATA.JEWEL_MIG152 = {' not in s:
    gm = u'  /* ============================================================\n   * v89.128（老板 需求 3/4）'
    assert s.count(gm) == 1, 'G anchor count=' + str(s.count(gm))
    g0 = s.index(gm)
    s = s[:g0] + NEW_MIG + u'\n' + s[g0:]
    changes.append('G: JEWEL_MIG152')
else:
    changes.append('G: skip (already)')

# ---------- 段 H：JEWEL_COST 注释里的"珍珠→夜明珠" ----------
lold = u'（按 price 升序：珍珠→夜明珠）'
if lold in s:
    assert s.count(lold) == 1
    s = s.replace(lold, u'（按 price 升序：蚌珠→和田玉）')
    changes.append('H: JEWEL_COST comment')
else:
    changes.append('H: skip (already)')

# ---------- 段 E：INITIAL_ITEMS ----------
if u'zhenzhu: 5' in s:
    oldE = u"{ shennongchu: 1, mojia_canjuan: 2, zhenzhu: 5 }"
    assert s.count(oldE) == 1, 'E count=' + str(s.count(oldE))
    s = s.replace(oldE, u"{ shennongchu: 1, mojia_canjuan: 2, bengzhu: 5 }")
    changes.append('E: INITIAL_ITEMS')
else:
    changes.append('E: skip (already)')

# ---------- 段 F：删 4512 的 6 行旧高级珠宝 ----------
oldF = u"""    { id: 'xueshanhu', name: '血珊瑚', type: 'jewel', loyalty: 65, price: 60, desc: '赏赐忠诚 +65' },
    { id: 'longyan', name: '龙涎珠', type: 'jewel', loyalty: 70, price: 75, desc: '赏赐忠诚 +70' },
    { id: 'lantianyu', name: '蓝田玉', type: 'jewel', loyalty: 75, price: 90, desc: '赏赐忠诚 +75' },
    { id: 'fengyu', name: '凤羽', type: 'jewel', loyalty: 80, price: 110, desc: '赏赐忠诚 +80' },
    { id: 'heshibi', name: '和氏璧', type: 'jewel', loyalty: 90, price: 150, desc: '赏赐忠诚 +90' },
    { id: 'chuanguo', name: '传国玉玺', type: 'jewel', loyalty: 100, price: 240, desc: '赏赐忠诚 +100' },
"""
if oldF in s:
    assert s.count(oldF) == 1
    s = s.replace(oldF, u"    /* v89.152：原「高级珠宝 6 种」整批退役 —— 体系并回 ITEMS 开头的新 18 种（等值换算见 DATA.JEWEL_MIG152）。 */\n")
    changes.append('F: drop old 6')
else:
    changes.append('F: skip (already)')

# ---------- 写盘（原子） + 自检 ----------
def count_braces(t):
    # 排除转义 \{ 与字符类取反 [^}] 里的裸 }（§45.7 判据）
    ob = len(re.findall(r'(?<![\\^])\{', t))
    cb = len(re.findall(r'(?<![\\^])\}', t))
    return ob, cb

ob0, cb0 = count_braces(io.open(P, encoding='utf-8', newline='').read())
ob1, cb1 = count_braces(s)
assert ob0 - cb0 == ob1 - cb1, 'brace balance changed: %d -> %d' % (ob0 - cb0, ob1 - cb1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK len %d -> %d' % (orig_len, len(s)))
print('\n'.join(changes))
# 写后特征核对
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u"id: 'bengzhu'") == 1 and chk.count(u"id: 'hetianyu'") == 1
assert chk.count(u"type: 'jewel'") == 18, 'jewel count=' + str(chk.count(u"type: 'jewel'"))
assert u"id: 'zhenzhu'" not in chk and u"id: 'chuanguo'" not in chk, 'old jewel defs still present'
assert chk.count(u'JEWEL_MIG152') >= 2
print('SELF-CHECK PASS: 18 jewels, old defs gone')
