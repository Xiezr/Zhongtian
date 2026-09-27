# -*- coding: utf-8 -*-
"""v89.140 批七：smoke 追加 §121（本轮 10 条需求的守护断言）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

BLOCK = r"""
  /* ============================================================
   * 121. v89.140（战场两行制 / 距离比例式 / 军务兵种表 / 校场关菜单 / 铁匠铺双按钮 /
   *      商城固定 / 宝物 7 列 / 自动出征逐兵种 / 附属野地两列 / 夜明珠全地形）
   * ============================================================ */
  console.log('\n===== 121. v89.140（战场两行制 · 珠宝全地形 · 商城/背包固定规格） =====');
  (function () {
    var _f = require('fs'), _p = require('path');
    var u = _f.readFileSync(_p.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m = _f.readFileSync(_p.join(__dirname, 'js', 'main.js'), 'utf8');
    var d = _f.readFileSync(_p.join(__dirname, 'js', 'domain.js'), 'utf8');
    var t = _f.readFileSync(_p.join(__dirname, 'js', 'tactic.js'), 'utf8');
    var h = _f.readFileSync(_p.join(__dirname, 'index.html'), 'utf8');
    var uc = stripComment(u), mc = stripComment(m), dc = stripComment(d), tc = stripComment(t);

    /* ---- ① 夜明珠：所有野地都有几率（老板 10） ---------- */
    check('§121① 夜明珠全地形：jewelAnywhere 规则 + 挑选出口最前分支（平地仍无珠宝）', (function () {
      var G2 = DATA.GATHER;
      var P = G.gatherJewelPick;
      var rHit = function () { return 0.01; };    /* < jewelAnywhereP(0.05) → 命中全地形珠 */
      var rMiss = function () { return 0.9; };
      /* ① 规则表在册 */
      var rule = (G2.jewelAnywhere || []).indexOf('yemingzhu') >= 0 && G2.jewelAnywhereP > 0;
      /* ② 任意**可采**地形、任意等级（连 Lv1 都行）→ 可能出夜明珠 */
      var terrains = Object.keys(G2.jewelTable);
      var anyHit = terrains.every(function (ter) { return P(ter, 1, rHit).id === 'yemingzhu'; });
      /* ③ 平地（无 jewelTable 条目）仍不出 —— 原版"平地不可采集"铁律 */
      var plainNull = P('plain', 12, rHit) === null;
      /* ④ 未命中全地形珠时，走原地形表（山地 Lv8 → 稀有档 yemingzhu；Lv1 → 常见档） */
      var norm = P('hill', 8, rMiss).id === 'yemingzhu' && P('lake', 1, rMiss).id === 'zhenzhu';
      return rule && anyHit && plainNull && norm;
    })());

    /* ---- ② 战场：两行制 + 只列在场 + 距离比例式 ---------- */
    check('§121② 战场侧栏两行制 CSS（bt-l1/bt-l2）+ 无图标 + 列宽 1.1/3.8/1.1', (function () {
      return /\.bt-l1, \.bt-l2 \{ display: flex; align-items: center; gap: 4px; min-width: 0; \}/.test(h)
        && /\.bt-board \{ display: grid; grid-template-columns: 1\.1fr 3\.8fr 1\.1fr;/.test(h)
        && /\.bt-card \{ display: flex; flex-direction: column; gap: 1px; padding: 2px var\(--sp-1\);/.test(h);
    })());
    check('§121② 回合记录降高（250 理想 / 130 保底，为上方战场腾空间）', (function () {
      return /\.bt-log \{ flex: 1 1 250px; max-height: none; min-height: 130px;/.test(h);
    })());
    check('§121② 距离 = 最远射程 × FIELD_RANGE_K（比例式 · 老板「乘以某个系数」）', (function () {
      var T = G.tactic;
      return T.FIELD_RANGE_K === 1.25
        && /Math\.max\(T\.FIELD_MIN, Math\.round\(maxR \* T\.FIELD_RANGE_K\), spdFloor\)/.test(tc);
    })());

    /* ---- ③ 军务：三段 + 兵种表头 + 固定列宽 + 校场关菜单 ---------- */
    check('§121③ 军务总览：兵种表头（固定列宽 .mc-tbl · U.fmt 万缩略）+ 无驻守野地/采集队/统计行', (function () {
      return /troopCols/.test(uc) && /<th class="num">' \+ U\.escape\(DATA\.TROOPS\[tid\]\.name\)/.test(uc)
        && /\.mc-tbl \{ table-layout: fixed; \}/.test(h)
        && /\.mc-tbl th, \.mc-tbl td \{ width: 62px;/.test(h);
    })());
    check('§121③ 校场 → 军务：先关建筑菜单再切视图（老板「建筑菜单未关闭」）', (function () {
      return /case 'open-xiaochang': ui\.closeAllModals\(\); ui\.setView\('marches'\)/.test(mc);
    })());

    /* ---- ④ 铁匠铺：建筑菜单双按钮 + 分页到底 + 卡片固定 ---------- */
    check('§121④ 铁匠铺建筑菜单 = 打造 + 百炼强化（数组条目）· 打造面板底部不再有百炼', (function () {
      var s2 = uc.slice(uc.indexOf('ui.openForge = function'), uc.indexOf('ui.openForgeSetInfo = function'));
      return /tiejiangpu: \[\{ label: "⚒️ 打造", act: "open-forge" \}/.test(uc)
        && /label: "⚒️ 百炼强化", act: "open-enhance"/.test(uc)
        && s2.indexOf('data-action="open-enhance"') < 0
        && /foot: '<div class="m-foot">' \+ \(rows\.length \? pg\.pager : ''\)/.test(s2);
    })());
    check('§121④ 铁匠铺/商城卡片固定尺寸（grid-auto-rows 215 / 116）', (function () {
      return /\.forge-rows \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); gap: var\(--sp-4\);
    grid-auto-rows: 215px; align-content: start; \}/.test(h)
        && /\.shop-rows \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); gap: var\(--sp-3\);
    grid-auto-rows: 116px; align-content: start; \}/.test(h);
    })());

    /* ---- ⑤ 商城 / 背包宝物：简介悬停 + 7 列格子 ---------- */
    check('§121⑤ 商城简介悬停（hoverDesc → title）· 宝物走统一 bagCell · 7 列', (function () {
      return /hoverDesc: true,/.test(uc)
        && /\(\(o\.hoverDesc && o\.desc\)/.test(uc)
        && /rows\.push\(ui\.bagCell\(cell\)\)/.test(uc)
        && /\.bag-grid \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/.test(h);
    })());

    /* ---- ⑥ 自动出征：3 列 + 逐兵种取兵 + 无单次兵力/播报 ---------- */
    check('§121⑥ 自动出征：编成 3 列（驻军数量 / 自动出征数量）· 单次兵力与上次结果退役', (function () {
      var i = uc.indexOf('var troopBlock = '), seg = uc.slice(i, i + 1800);
      return /<th>兵种<\/th><th class="num">驻军数量<\/th><th class="ctr">自动出征数量<\/th>/.test(seg)
        && /id="am-a-' \+ id \+ '"/.test(seg)
        && seg.indexOf('exp-a-troops') >= 0 === true
        && uc.indexOf('exp-sec-t">单次兵力') < 0
        && uc.indexOf('上次结果') < 0
        && /bind\('am-troops'/.test(uc) === false;
    })());
    check('§121⑥ 域侧：autoMarchPickArmy 支持 cfgArmy（逐兵种）· Want 按配置求和 · doSetAutoMarch army: 键', (function () {
      return /GAME\.autoMarchPickArmy = function \(city, want, cfgArmy\)/.test(dc)
        && /if \(cfgArmy\) \{/.test(dc)
        && /var A = cfg && cfg\.army, sum = 0;/.test(dc)
        && /cfg\.army\[k\.slice\(5\)\] = Math\.max\(0, Math\.floor\(Number\(v\) \|\| 0\)\);/.test(dc);
    })());
    check('§121⑥ 实测：逐兵种取兵 —— 配置只带长枪 → 只出长枪（顺位口径不动）', (function () {
      var keep = GAME.state;
      var ok = false;
      try {
        G.newGame({ name: '自动出征取兵', cityName: '许都' });
        var c0 = G.currentCity();
        c0.army = { yibing: 1000, changqiang: 800, gongjian: 600 };
        var byCfg = G.autoMarchPickArmy(c0, 9999, { changqiang: 500 });
        var byOrder = G.autoMarchPickArmy(c0, 300, null);
        ok = byCfg.total === 500 && byCfg.army.changqiang === 500
          && (byCfg.army.yibing || 0) === 0 && (byCfg.army.gongjian || 0) === 0
          && byOrder.total === 300;          /* 老口径：顺位取兵仍可用 */
      } catch (e) { ok = false; }
      finally { GAME.state = keep; }
      return ok;
    })());

    /* ---- ⑦ 附属野地：将领 + 驻军两列 ---------- */
    check('§121⑦ 附属野地：操作列左边加「将领」「驻军」两列（唯一来源 wildGarrisonAt/Total）', (function () {
      var i = uc.indexOf('ui.openWilds = function');
      var seg = uc.slice(i, i + 9000);
      return /_garW = GAME\.wildGarrisonAt\(w\.x, w\.y\)/.test(seg)
        && /_garN = GAME\.wildGarrisonTotal\(_garW\)/.test(seg)
        && /_genW \? U\.escape\(_genW\.name\)/.test(seg)
        && /U\.fmt\(_garN\)/.test(seg);
    })());

    /* ---- ⑧ 已出征将领：状态锁补齐（garrison / battle） ---------- */
    check('§121⑧ 状态锁补齐：驻守野地 / 征战中 → marchBusyOf 置灰并标注（老板 9）', (function () {
      var g1 = { status: 'garrison' }, g2 = { status: 'battle' };
      var g3 = { status: 'idle' };
      return G.marchBusyOf(g1) === '驻守野地' && G.marchBusyOf(g2) === '征战中'
        && G.marchBusyOf(g3) === null
        && G.canMarch(g1) === false && G.canMarch(g3) === true;
    })());

    /* ---- ⑨ 需求档案在册 ---------- */
    check('§121⑨ 需求档案在册（v89.140 · 老板原文关键句逐字）', (function () {
      var md = _f.readFileSync(_p.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.140') >= 0
        && md.indexOf('夜明珠设置为在所有野地都有几率出现') >= 0
        && md.indexOf('默认兵种全部列出呈2列') >= 0
        && md.indexOf('每个装备占据的区块大小') >= 0
        && md.indexOf('建立统一的物品框和规格样式') >= 0;
    })());
  })();

"""

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1
s = s.replace(anchor, BLOCK + anchor)
assert '\r\n' not in s
tmp = p + '.tmp140'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
print('✅ smoke-test.js：%d → %d 字节（§121 已追加）' % (n0, len(io.open(p, 'r', encoding='utf-8', newline='').read())))
