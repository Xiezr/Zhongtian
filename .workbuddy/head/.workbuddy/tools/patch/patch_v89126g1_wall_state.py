# -*- coding: utf-8 -*-
"""v89.126 补丁 G1：城墙并入建筑体系（data / state / battle）
—— 城墙占格：BUILD_ORDER + CITY_PLAN.order 收录；cityPlanOf/npcCityShadow 的
   wallLv 字段退役（等级在 cells 里）；applyBuildDone 的 wall 分支退役；
   老档迁移（wallLv → 格子）；battle 两处 wallLv 继承退役。
安全：读→改→原子写→node --check；每处锚点 count==1。
"""
import io, os, subprocess

R = r'E:/Deepseekdb'

def patch(rel, pairs):
    P = os.path.join(R, rel)
    s = io.open(P, encoding='utf-8').read()
    for i, (old, new) in enumerate(pairs):
        c = s.count(old)
        assert c == 1, '[%s] 锚点 %d 计数 %d（应为 1）\n---\n%s\n---' % (rel, i, c, old[:220])
        s = s.replace(old, new)
    tmp = P + '.tmp_v89126'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, P)
    r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
    assert r.returncode == 0, '[%s] node --check 失败：%s' % (rel, r.stderr[:400])
    print('✓ %s（%d 处）' % (rel, len(pairs)))

# ═══════════ data.js ═══════════
patch('js/data.js', [
    ("""  /* v16：城墙不占格（环绕城池一圈，等级存 city.wallLv），故不在城内建造列表中 */
  DATA.BUILD_ORDER = ['minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'];""",
     """  /* v89.126（老板）：「将城墙与其他建筑并列管理，只是一个有特殊功能的建筑」——
     城墙**占一格**、进建造列表；建造 / 升级 / 取消 / 提速全走通用出口
     （buildAt / upgradeAt / cancelRefundOf / queueValueOf），不再有独立面板与队列类型。
     历史上（v16~v89.125）城墙"不占格"（等级存 `city.wallLv`）——
     老档由 loadGame 迁移进格子；视觉上"环城一圈"保留（isoWallSVG，点它=打开城墙格面板）。 */
  DATA.BUILD_ORDER = ['minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai', 'chengqiang'];"""),
    ("""       民房数随之 30 → 27（人口上限按民房座数派生，见 `GAME.planPopCapOf`，自动跟着走）。 */
    order: ['junying', 'junying', 'shuyuan', 'xiaochang', 'shichang',
      'cangku', 'cangku', 'cangku', 'cangku',
      'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'],""",
     """       民房数随之 30 → 27（人口上限按民房座数派生，见 `GAME.planPopCapOf`，自动跟着走）。
       v89.126：城墙占格 → order 收录 chengqiang，民房 27 → 26（人口上限同步派生）。 */
    order: ['junying', 'junying', 'shuyuan', 'xiaochang', 'shichang',
      'cangku', 'cangku', 'cangku', 'cangku',
      'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai', 'chengqiang'],"""),
])

# ═══════════ state.js ═══════════
patch('js/state.js', [
    # 1) cityPlanOf 注释
    ("   * 城墙不占格，但同样算\"建筑\"，所以 `wallLv` 也取 `buildLv`。",
     "   * v89.126：城墙**占格**（老板「与其它建筑并列管理」）—— 由 `CITY_PLAN.order`\n"
     "   *   收录，等级 = `buildLv`（与其它建筑同一把尺子）；`plan.wallLv` 字段退役。"),
    # 2) cityPlanOf 返回值
    ("    return { col: col, row: row, level: lv, buildLv: bl, cells: cells, wallLv: bl, total: total };",
     "    return { col: col, row: row, level: lv, buildLv: bl, cells: cells, total: total };"),
    # 3) npcCityShadow 返回值
    ("      col: plan.col, row: plan.row, cells: cells, extGrid: ext, wallLv: plan.wallLv, def: city.def || 0,",
     "      col: plan.col, row: plan.row, cells: cells, extGrid: ext, def: city.def || 0,"),
    # 4) planSummaryOf：wallLv 改为从 cells 读（与格子同源）
    ("      col: summary.plan.col, row: summary.plan.row, level: lv,\n"
     "      buildLv: summary.plan.buildLv,\n"
     "      wallLv: summary.plan.wallLv, total: summary.plan.total,",
     "      col: summary.plan.col, row: summary.plan.row, level: lv,\n"
     "      buildLv: summary.plan.buildLv,\n"
     "      /* v89.126：城墙占格后，等级从 cells 读（与 GAME.buildingLevel 同源） */\n"
     "      wallLv: (function () {\n"
     "        var w = 0;\n"
     "        (summary.plan.cells || []).forEach(function (x) {\n"
     "          if (x.build && x.build.id === 'chengqiang') w = Math.max(w, x.build.lvl || 0);\n"
     "        });\n"
     "        return w;\n"
     "      })(), total: summary.plan.total,"),
    # 5) applyBuildDone：wall 分支退役
    ("""    /* v16：城墙（不占格，环绕城池） */
    if (q.type === 'wall') {
      var wc = GAME.cityById(q.cityId);
      if (wc) {
        var wasLv = wc.wallLv || 0;
        wc.wallLv = q.targetLevel;
        GAME.statBump('buildDone', 1);
        GAME.log('城墙' + (wasLv === 0 ? '建成' : '升级至 Lv' + q.targetLevel)
          + '（耐久 ' + (q.targetLevel * 100) + '万 · 守军防御 +' + (q.targetLevel * 10) + '%）');
        if (GAME.onActionDone) GAME.onActionDone('build-done', { id: 'wall', type: 'wall' });
      }
      return;
    }
""",
     """    /* v89.126：城墙并入通用路径（type 'build'/'upgrade' 的 cells 流程）——
       原 `type:'wall'` 分支（直接写 city.wallLv）退役，见老档迁移（loadGame）。 */
"""),
    # 6) 迁移：v16 迁移 ② 处注释升级 + 追加 v89.126 反向迁移
    ("""        /* ② 城墙搬出格子 */
        var wLv = 0;
        c.cells.forEach(function (x) {
          if (x.build && x.build.id === 'chengqiang') wLv = Math.max(wLv, x.build.lvl);
""",
     """        /* ② 城墙搬出格子（v16 历史迁移；v89.126 起由下方"搬回格子"接管，净效果=留在格子） */
        var wLv = 0;
        c.cells.forEach(function (x) {
          if (x.build && x.build.id === 'chengqiang') wLv = Math.max(wLv, x.build.lvl);
"""),
])

# 追加 v89.126 迁移（独立于 v16 段：对所有 48 格档生效）——
# 定位「(st.wilds || []).forEach(function (w) { if (w.levelDay === undefined) w.levelDay = null; });」
# 之后的 v16 迁移注释块之前插入？更稳：插入到 v16 迁移段之前（同样的 forEach 里难插）。
# 选锚点：v16 迁移注释行，插在其前。
P = os.path.join(R, 'js/state.js')
s = io.open(P, encoding='utf-8').read()
anchor = "      /* ---- v16 迁移 ----\n"
assert s.count(anchor) == 1, 'v16 迁移锚点 %d' % s.count(anchor)
mig = """      /* ---- v89.126 迁移：城墙从 city.wallLv **搬回格子**（与其它建筑并列） ----
         选第一个空格；没有空格就覆盖"等级最低的非官府格"（民房可再建，城墙不可丢）。
         迁移后 `wallLv` 一律删除 —— 不留第二个等级出口。 */
      (st.cities || []).forEach(function (c) {
        if (!c || !c.cells || c.wallLv == null) return;
        var wlv126 = c.wallLv || 0;
        var hasW126 = false;
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'chengqiang') hasW126 = true; });
        if (wlv126 > 0 && !hasW126) {
          var free126 = -1, low126 = -1, lowLv126 = Infinity;
          c.cells.forEach(function (x, i) {
            if (free126 < 0 && !x.build && !x.pending && !x.official) free126 = i;
            if (x.official || !x.build) return;
            var vl = x.build.lvl || 1;
            if (vl < lowLv126) { lowLv126 = vl; low126 = i; }
          });
          var put126 = free126 >= 0 ? free126 : low126;
          if (put126 >= 0) {
            c.cells[put126].build = { id: 'chengqiang', lvl: wlv126 };
            c.cells[put126].pending = null;
          }
        }
        delete c.wallLv;
      });
"""
s = s.replace(anchor, mig + anchor)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'state.js 迁移段 node --check 失败：' + r.stderr[:400]
print('✓ js/state.js 迁移段（v89.126 wallLv → 格子）')

# ═══════════ battle.js ═══════════
patch('js/battle.js', [
    ("    newCity.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });\n"
     "    newCity.wallLv = sh.wallLv;",
     "    newCity.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });\n"
     "    /* v89.126：城墙等级随 `sh.cells` 一起继承（占格后不再有独立 wallLv 字段） */"),
    ("      city.extGrid = shadow.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });\n"
     "      city.wallLv = shadow.wallLv;",
     "      city.extGrid = shadow.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });\n"
     "      /* v89.126：城墙等级随 `shadow.cells` 一起继承 */"),
])

print('补丁 G1 完成。')
