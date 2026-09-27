# -*- coding: utf-8 -*-
"""v89.134 补丁 1 —— data.js 数据表修正：
  ① 头部加【分区导航】（16 区 · 便于修改）
  ② DATA.RES_ORDER 加"唯一来源"注释（接线准备）
  ③ 删 EQUIP_QUALITY（残渣 · 品质名已由 Q_NAME 提供）
  ④ 删 GENERAL_NAMES（残渣 · 名字走 HEROES / WILD_LORD_* 三表）
  ⑤ 删旧 QUESTS（q1..q8 死数据 · 被 questdata.js 覆盖 → "改这里不生效"陷阱）
  ⑥ INITIAL_EXT 改数组形态（与 NEW_CITY_EXT 同构，供 makeExtGrid 接线）
  ⑦ 删 ZOOM_LEVELS（残渣 · v89.104 起缩放是连续滑块）
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点数 = ' + str(n)
    return s.replace(old, new)

d = rd('js/data.js')
orig_len = len(d)

# ---------- ① 头部【分区导航】 ----------
old_head = """ * 挂到 window.GAME.DATA
 * ============================================================ */
(function () {
  window.GAME = window.GAME || {};
  var DATA = {};
"""
new_head = """ * 挂到 window.GAME.DATA
 * ============================================================ */
/* ============================================================
 * 【分区导航】（v89.134 · 需求「梳理各种数据表，代码块和引用关系」）
 * ------------------------------------------------------------
 * 本文件是**全部静态数值的唯一来源**，分段归入 16 区。
 * 改数值：先在本区找目标 → 进对应分段（行号见 docs/数据表索引.md，
 * 由 .workbuddy/tools/gen/gen_tables_index.js 自动生成，改表后重跑）。
 *
 *   ① 资源与常量     RESOURCES / RES_ORDER / 仓储基准 / 黄金闸门
 *   ② 建筑           BUILDINGS / 建造时间 / 前置 / 城内布局 / 城外建筑与地块
 *   ③ 军事           TROOPS / 相克 / 阵位 / 城防 / TECH
 *   ④ 装备与宝物     EQUIP / SETS / ITEMS / 打造 / 强化 / 材料 / 经验道具
 *   ⑤ 爵位           RANK / RANK_BONUS
 *   ⑥ 地图与野地     TERRAIN / GATHER / MAP 常量 / 野地守军 / 州特产
 *   ⑦ 入侵与战斗     INVASION / DUEL / AUTO_MARCH / SIEGE / OPS / 战法 / 回放
 *   ⑧ 人口           POP_CFG / POP_LABOR / DISBAND / CAPTIVE
 *   ⑨ 将领           HEROES / BEAUTIES / 君主 / 资质 / 经验 / 体力 / 精力 / 内功 / 俸禄 / 校场
 *   ⑩ 市场与流转     市场买卖 / 寄售 / 募兵提速 / 种田秘境
 *   ⑪ 名城与门派     CITY_PERK / 守将区间 / 门派
 *   ⑫ 运输与出征     NEW_CITY_EXT / 运输派遣 / 出征三方式 / 行军
 *   ⑬ 任务           ⛔ 本文件不再定义 —— 唯一来源是 questdata.js
 *   ⑭ 趣味系统       BONDS / SEASONS / 史书 / 秘境 / 称号 / 计谋 / 灵气
 *   ⑮ 界面           THEME / 建筑系列 / 公文
 *   ⑯ v89 新系统     江湖场景 / 套装扩展 / 表重建（ITEM_BY_ID 等）
 * ============================================================ */
(function () {
  window.GAME = window.GAME || {};
  var DATA = {};
"""
d = rep1(d, old_head, new_head, '① 头部导航')

# ---------- ② RES_ORDER 注释 ----------
old = "  DATA.RES_ORDER = ['grain', 'wood', 'stone', 'iron', 'gold'];\n"
new = ("""  /* 资源（不含人口）的**结算遍历顺序** —— 唯一数据源（v89.134 接线）。
     战利品结算 / 掠夺 / 运输 / 批量 UI 等 7 处遍历一律读本表，
     不要再就地写 ['grain','wood',...] 字面量（改资源集只改这里）。
     `GAME.RES_KEYS`（含 pop · state.js）与 `GAME.TRANSPORT_KEYS`（domain.js）
     均由本表派生。 */
  DATA.RES_ORDER = ['grain', 'wood', 'stone', 'iron', 'gold'];
""")
d = rep1(d, old, new, '② RES_ORDER')

# ---------- ③ 删 EQUIP_QUALITY ----------
old = "  DATA.EQUIP_QUALITY = ['灰', '白', '蓝', '紫', '橙', '红'];\n"
new = ("""  /* ⛔ v89.134 移除：`DATA.EQUIP_QUALITY`（旧 6 档色名）——
     装备品质名的唯一来源是 `DATA.Q_NAME`（4 档 凡/良/珍/神）；
     本表长期零引用（v89.134 盘点器抓出）。 */
""")
d = rep1(d, old, new, '③ EQUIP_QUALITY')

# ---------- ④ 删 GENERAL_NAMES ----------
old = "  DATA.GENERAL_NAMES = ['赵子龙', '关云长', '张翼德', '马孟起', '黄汉升', '太史慈', '夏侯惇', '徐晃', '甘宁', '张郃', '魏延', '庞德', '文丑', '颜良', '华雄', '李典', '乐进', '曹仁', '程普', '黄盖'];\n"
new = ("""  /* ⛔ v89.134 移除：`DATA.GENERAL_NAMES`（旧随机名池）——
     名将走 `DATA.HEROES`；野地守将名字走 `WILD_LORD_SURNAME / WILD_LORD_GIVEN /
     WILD_LORD_TITLE` 三表（domain.js 生成守将时读）。本表长期零引用。 */
""")
d = rep1(d, old, new, '④ GENERAL_NAMES')

# ---------- ⑤ 删旧 QUESTS ----------
old = """  /* ============================================================
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
"""
new = """  /* ============================================================
   * 任务 —— ⛔ 本文件不再定义 `DATA.QUESTS`（v89.134 移除旧版 q1..q8）
   * ------------------------------------------------------------
   * 任务目录的**唯一来源是 questdata.js**（成长型 g01.. 带 metric/goal、
   * 随机型 RANDOM_QUESTS、类型表；加载顺序在本文件之后）。
   * 本处旧表（q1..q8 · type/target 结构）存在期间一直被 questdata.js
   * **静默覆盖** —— 是"改这里不生效"的陷阱，故删除。改任务请只改
   * js/questdata.js。 */
"""
d = rep1(d, old, new, '⑤ 旧 QUESTS')

# ---------- ⑥ INITIAL_EXT 改数组形态 ----------
old = "  DATA.INITIAL_EXT = { farm: 2, forest: 1, quarry: 1, mine: 1 }; // 城外初始：2田1木1石1铁\n"
new = ("  /* 首城外城初始模板（v89.134 接线：state.makeExtGrid 读本表；\n"
       "     与 `NEW_CITY_EXT` 同构 —— 都是「类型数组」，顺序即地块序）。 */\n"
       "  DATA.INITIAL_EXT = ['farm', 'farm', 'forest', 'quarry', 'mine']; // 2田1木1石1铁\n")
d = rep1(d, old, new, '⑥ INITIAL_EXT')

# ---------- ⑦ 删 ZOOM_LEVELS ----------
old = """  /* ---------------- 默认设置 ---------------- */
  /* v16：zoom 为城内/城外/地图的显示比例（%）；autoResearch 与自动建造同列 */
  DATA.ZOOM_LEVELS = [80, 100, 120, 140, 160];
  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100,
"""
new = """  /* ---------------- 默认设置 ---------------- */
  /* ⛔ v89.134 移除：`DATA.ZOOM_LEVELS`（旧档位 chips 80..160）——
     v89.104 起缩放是**连续滑块**，唯一出口 ui.ZOOM_MIN / ui.ZOOM_MAX（80/120）。
     autoResearch 与自动建造同列（zoom = 显示比例 %）。 */
  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100,
"""
d = rep1(d, old, new, '⑦ ZOOM_LEVELS')

# ---------- 写后自检 ----------
assert 'DATA.EQUIP_QUALITY =' not in d, 'EQUIP_QUALITY 未删'
assert 'DATA.GENERAL_NAMES =' not in d, 'GENERAL_NAMES 未删'
assert 'DATA.ZOOM_LEVELS =' not in d, 'ZOOM_LEVELS 未删'
assert "id: 'q1'" not in d and 'q1..q8' in d, '旧 QUESTS 处理异常'
assert "DATA.INITIAL_EXT = ['farm', 'farm', 'forest', 'quarry', 'mine']" in d, 'INITIAL_EXT 形态'
assert '【分区导航】' in d, '导航未插入'
assert len(d) > orig_len - 5000, '文件缩水异常'

wr('js/data.js', d)
print('OK · data.js', len(d), '（原', orig_len, '）')
