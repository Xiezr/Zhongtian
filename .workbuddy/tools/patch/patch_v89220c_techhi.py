# -*- coding: utf-8 -*-
"""v89.220 补丁 C：分城/占领城建筑的"科技闸存量宽限"三件套（老板 3）。

病根（实测）：
  · 占领城（建筑 12~24 级满配、本城科技 0）→ 科技闸把 cap 压到 2~3 级；
  · **拆 1 级就永久回不去**（升回被拦："需先研究「练兵技巧」至 Lv4"）；
  · 对已到顶的建筑报"需研究科技"是空头支票（研究完也升不了）。

修法（三件套）：
  ① `hiLv`（本座历史最高等级，cell.build.hiLv）—— 升级完成/新建/占城生成时记，
     拆除降级前固化（老档读时兜底 `hiLv || lvl`）；
  ② `buildCapOf(city, bid, piece)` 加可选第 3 参：科技闸上限不低于 hiLv（不传 = 旧行为）；
  ③ `buildPrereqOf(city, bid, nextLv, piece)` 加可选第 4 参：恢复到曾达等级免科技闸 +
     "到不了不报"（next 超出 buildCapCoreOf 时不报科技闸，交给"已达最高等级"）。
新增唯一出口 `buildCapCoreOf`（不含科技闸的核心上限）。
"""
import io
R = 'E:/Deepseekdb/'

def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

bad = []

def rep(f, old, new, tag, cnt=1):
    p = R + f
    s = rd(p)
    if old not in s and new in s:
        print('  [skip] %s' % tag); return
    c = s.count(old)
    if c != cnt:
        bad.append('%s x%d | %s' % (tag, c, old[:46].replace('\n', '⏎'))); return
    wr(p, s.replace(old, new))
    print('  [ok] %s' % tag)

# ══ ① domain.js：buildCapOf 拆出 buildCapCoreOf + 科技闸宽限 ══
p = R + 'js/domain.js'
s = rd(p)
i0 = s.index("  GAME.buildCapOf = function (city, bid) {")
i1 = s.index("  /* 建造前置的唯一出口（v68 · 逐步探索）：")
old_seg = s[i0:i1]
assert 'return cap;' in old_seg and 'buildTechOf' in old_seg, 'buildCapOf 段边界异常'
new_seg = """  /* v89.220（老板 3）：**不含科技闸**的核心上限（其余各闸取 min）—— 独立成唯一出口：
     · buildCapOf 在它之上叠科技闸（带存量宽限）；
     · buildPrereqOf 的"到不了不报"守卫也读它（科技闸只对"真能到达的目标"上报）。 */
  GAME.buildCapCoreOf = function (city, bid) {
    var b = bid ? (DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid] || null) : null;
    var base = (b && b.maxLevel) || DATA.MAX_BLEVEL;
    /* v89.102（老板「主城随威望逐步解锁政务厅及其他建筑等级上限」）：
       主城多一项 —— 威望解锁的等级上限（`rankBuildCapOf`，唯一出口）。
       非主城恒为 0，所以"别城照旧被政务厅总闸卡住"这条行为一字未变。 */
    var lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(city) : 0;
    var cap = base + GAME.cityBuildBonus(city) + lift;
    /* v68 · 逐步探索：城内建筑（含围墙）等级**不得超过政务厅等级**。
       - 政务厅自身、城外建筑、以及"没有政务厅的城"（异常数据/测试构造）不受此闸；
       - 与 DATA.BUILD_PREREQ 分工：这里管**等级上限**，那里管**建造前置**。
       v89.102：威望解锁（lift）抬的是**所有建筑的上限**（政务厅也在其中）。
       ⛔ v89.159（老板 2「关于政务厅的等级，有一条应该是其他建造等级不能超过政务厅等级吧」
         → 拍板「严格 ≤ 政务厅」）：本闸**严格 = 政务厅等级**，不再 `+ lift`。
         改前口径（其他建筑 = 政务厅 + lift）会让主城建筑**超前政务厅 N 级**，
         与这条规则相悖；威望解锁的作用改为"先抬政务厅上限、由政务厅带动
         （政务厅可升到 base + 档位 + lift，其他建筑随政务厅同步上去）"。 */
    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      if (govLv > 0) cap = Math.min(cap, govLv);
    }
    /* v89.191（老板 3-①②）：**配对建筑**等级差 ≤ 2（与政务厅总闸同类）。
       提示文案由 buildPrereqOf 给 —— 两处同读 GAME.pairGapOf。 */
    var _pg191 = GAME.pairGapOf(city, bid);
    if (_pg191) cap = Math.min(cap, _pg191.cap);
    return cap;
  };
  GAME.buildCapOf = function (city, bid, piece) {
    var cap = GAME.buildCapCoreOf(city, bid);
    /* v89.191（老板 3-③）：建筑↔科技 —— 研究等级决定建筑上限（cap 由 need 公式反推）。
       ⛔ v89.220（老板 3）：**存量宽限**（`piece` = 本座建筑对象，可选）——
       科技闸上限不低于"本座曾达等级"（`piece.hiLv`，缺省回退现等级）：
       占领城 / 老档的满配建筑（12~24 级、本城科技 0）不会因科技从零被压到 2~3 级，
       也不会"拆 1 级就永久回不去"（恢复到曾达等级免闸，见 buildPrereqOf 同款守卫）。
       ⚠ 不传 piece = 旧行为（cap = 科技闸原值）—— 旧调用点与测试零破坏。 */
    var _bt191 = GAME.buildTechOf(city, bid);
    if (_bt191) {
      var _hi220 = piece ? Math.max(piece.hiLv || 0, piece.lvl || 0) : 0;
      cap = Math.min(cap, Math.max(_bt191.cap, _hi220));
    }
    return cap;
  };

"""
wr(p, s[:i0] + new_seg + s[i1:])
print('  [ok] buildCapOf 拆分 + 宽限')

# ══ ② domain.js：buildPrereqOf 第 4 参 + 两条守卫 ══
rep('js/domain.js',
    "  GAME.buildPrereqOf = function (city, bid, nextLv) {",
    "  GAME.buildPrereqOf = function (city, bid, nextLv, piece) {",
    'buildPrereqOf 签名')

rep('js/domain.js',
    """    var _btp191 = GAME.buildTechOf(city, bid);
    if (_btp191) {
      var _nxt191 = nextLv || (GAME.buildingLevel(city, bid) + 1);
      var _need191 = Math.floor(_nxt191 / _btp191.div);
      if (_btp191.lv < _need191) {
        list.push({ bid: bid, name: _btp191.name, need: _need191, cur: _btp191.lv, techGate: true,
          why: '需先研究「' + _btp191.name + '」至 Lv' + _need191 + '（本城现 Lv' + _btp191.lv
            + '）—— 建筑升级与研习所科技互为条件' });
      }
    }
""",
    """    var _btp191 = GAME.buildTechOf(city, bid);
    if (_btp191) {
      var _nxt191 = nextLv || (GAME.buildingLevel(city, bid) + 1);
      /* ⛔ v89.220（老板 3）两条守卫（`piece` = 本座建筑对象，可选；不传 = 旧行为）——
         ① **存量宽限**：恢复到"本座曾达等级"（piece.hiLv）不视为新建筑 → 免科技闸
            （占领城 / 老档拆 1 级后可升回原级；**继续突破**仍需研究，突破线在 hiLv 之上）；
         ② **到不了不报**：next 超出（不含科技闸的）核心上限时不报此闸 ——
            交给"已达最高等级"（研究完也升不了的目标，不再给"需先研究 XX"的空头支票）。 */
      var _hi220 = piece ? Math.max(piece.hiLv || 0, piece.lvl || 0) : 0;
      if (_nxt191 > _hi220 && _nxt191 <= GAME.buildCapCoreOf(city, bid)) {
        var _need191 = Math.floor(_nxt191 / _btp191.div);
        if (_btp191.lv < _need191) {
          list.push({ bid: bid, name: _btp191.name, need: _need191, cur: _btp191.lv, techGate: true,
            why: '需先研究「' + _btp191.name + '」至 Lv' + _need191 + '（本城现 Lv' + _btp191.lv
              + '）—— 建筑升级与研习所科技互为条件' });
        }
      }
    }
""",
    'buildPrereqOf 科技闸守卫')

# ══ ③ domain.js：upgradeAt 传本座 ══
rep('js/domain.js',
    """    var pre = GAME.buildPrereqOf(city, cell.build.id, cell.build.lvl + 1);
    if (!pre.ok) return pre;
    if (cell.build.lvl >= GAME.buildCapOf(city, cell.build.id)) return { ok: false, msg: '已达最高等级' };""",
    """    /* v89.220（老板 3）：传入**本座**（piece）—— 科技闸存量宽限（拆后可升回原级）与
       "到不了不报"两条守卫读它；界面（ui.js 升级按钮/成本行）同传，保证同尺。 */
    var pre = GAME.buildPrereqOf(city, cell.build.id, cell.build.lvl + 1, cell.build);
    if (!pre.ok) return pre;
    if (cell.build.lvl >= GAME.buildCapOf(city, cell.build.id, cell.build)) return { ok: false, msg: '已达最高等级' };""",
    'upgradeAt 传参')

# ══ ④ domain.js：自动升级两处传参 ══
rep('js/domain.js',
    "        if (!b || cell.build.lvl >= GAME.buildCapOf(ct, b.id)) return;",
    "        if (!b || cell.build.lvl >= GAME.buildCapOf(ct, b.id, cell.build)) return;   /* v89.220：本座宽限 */",
    '自动升级-城内')
rep('js/domain.js',
    "      if (_w128 && _w128.build && !_w128.pending && _w128.build.lvl < GAME.buildCapOf(ct, 'chengqiang')) {",
    "      if (_w128 && _w128.build && !_w128.pending && _w128.build.lvl < GAME.buildCapOf(ct, 'chengqiang', _w128.build)) {",
    '自动升级-围墙')

# ══ ⑤ domain.js：demolishAt 降级前固化 hiLv ══
rep('js/domain.js',
    """    if (lv > 1) {
      cell.build.lvl = lv - 1;
      GAME.statBump('demolished', 1);""",
    """    if (lv > 1) {
      /* v89.220（老板 3）：降级前先固化**历史最高**（老档无 hiLv 的兜底 —— 记下原级，
         拆后仍可升回；科技闸只挡"突破历史"，不挡"恢复"。 */
      cell.build.hiLv = Math.max(cell.build.hiLv || 0, lv);
      cell.build.lvl = lv - 1;
      GAME.statBump('demolished', 1);""",
    'demolishAt 固化 hiLv')

# ══ ⑥ state.js：升级完成/新建写 hiLv ══
rep('js/state.js',
    """    if (q.type === 'build') {
      if (cell.build) return;           // 该格已有建筑，丢弃过期队列项
      cell.build = { id: q.buildId, lvl: 1 };
      cell.pending = null;
    } else if (q.type === 'upgrade') {
      if (!cell.build) return;          // 建筑已在施工期间被拆毁
      cell.build.lvl = q.targetLevel;
      cell.pending = null;              // v16：升级完成必须清施工标记
      /* 政务厅 4 格同步升级 */
      if (cell.build.id === 'guanfu') {
        city.cells.forEach(function (c) { if (c.build && c.build.id === 'guanfu') c.build.lvl = q.targetLevel; });
      }
    }""",
    """    if (q.type === 'build') {
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
    }""",
    'state.js 升级/新建写 hiLv')

# ══ ⑦ battle.js：onConquer 生成 cells 带 hiLv ══
rep('js/battle.js',
    """    newCity.cells = sh.cells.map(function (c) {
      return { build: c.build ? { id: c.build.id, lvl: c.build.lvl } : null,
        pending: null, official: !!c.official };
    });""",
    """    newCity.cells = sh.cells.map(function (c) {
      /* v89.220（老板 3）：占城建筑带 `hiLv` = 满配等级 —— 科技闸存量宽限的基准
         （打下来的城，科技从 0 而建筑已 12~24 级：拆了能升回、突破才需研究）。 */
      return { build: c.build ? { id: c.build.id, lvl: c.build.lvl, hiLv: c.build.lvl } : null,
        pending: null, official: !!c.official };
    });""",
    'onConquer hiLv')

# ══ ⑧ ui.js：四处传本座 ══
rep('js/ui.js',
    "    var isMax = cell.build.lvl >= GAME.buildCapOf(city, cell.build.id);",
    "    var isMax = cell.build.lvl >= GAME.buildCapOf(city, cell.build.id, cell.build);   /* v89.220：本座宽限 */",
    'ui isoCell isMax')
rep('js/ui.js',
    "      var preUp = GAME.buildPrereqOf(c, cell.build.id, cell.build.lvl + 1);",
    "      var preUp = GAME.buildPrereqOf(c, cell.build.id, cell.build.lvl + 1, cell.build);   /* v89.220：同传本座 */",
    'ui 升级按钮 preUp')
rep('js/ui.js',
    "      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id) ? b.levelCost(cell.build.lvl) : null;",
    "      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id, cell.build) ? b.levelCost(cell.build.lvl) : null;",
    'ui 升级成本行')
rep('js/ui.js',
    "        var _cap = GAME.buildCapOf(c, b.id);",
    "        var _cap = GAME.buildCapOf(c, b.id, cell.build);   /* v89.220：本座宽限（与升级口径同尺） */",
    'ui 上限行')

# ══ ⑨ smoke：三条源码断言随形态更新（§159③ 段界 / §159② 计数） ══
rep('smoke-test.js',
    "        var nPanel = (uS159.match(/GAME\\.buildPrereqOf\\(c, cell\\.build\\.id, cell\\.build\\.lvl \\+ 1\\)/g) || []).length;\n"
    "        var nCore = (dS159.match(/GAME\\.buildPrereqOf\\(city, cell\\.build\\.id, cell\\.build\\.lvl \\+ 1\\)/g) || []).length;",
    "        /* v89.220：两处均加**第 4 参本座**（科技闸存量宽限）—— 计数正则随形态更新 */\n"
    "        var nPanel = (uS159.match(/GAME\\.buildPrereqOf\\(c, cell\\.build\\.id, cell\\.build\\.lvl \\+ 1, cell\\.build\\)/g) || []).length;\n"
    "        var nCore = (dS159.match(/GAME\\.buildPrereqOf\\(city, cell\\.build\\.id, cell\\.build\\.lvl \\+ 1, cell\\.build\\)/g) || []).length;",
    'smoke §159② 计数')

rep('smoke-test.js',
    "      var i0 = dS159.indexOf('GAME.buildCapOf = function');",
    "      var i0 = dS159.indexOf('GAME.buildCapCoreOf = function');   /* v89.220：核心段起点（buildCapOf 已叠科技闸） */",
    'smoke §159③ 段界')

if bad:
    print('❌ 失配：')
    for b in bad: print('   ' + b)
else:
    print('✅ 补丁 C 全部落盘')
