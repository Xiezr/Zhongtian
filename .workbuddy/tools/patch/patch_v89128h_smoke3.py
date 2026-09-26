# -*- coding: utf-8 -*-
"""v89.128 补丁 H（smoke）：§104 口径升级（哨兵 0 → 曲线）+ 新增 §108（12 级循环/≤24h/区分度）
   ⚠ newline='' 保持 LF
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ── ① §104 标题注释更新 ──
rep("""   * §104（v89.125）建筑时间表口径 —— 哨兵 0 与"全表时间非负"守卫
   * ------------------------------------------------------------
   * 老板令：「列出各级建筑等级及建造时间表」——出表过程中抓到：
   * extRows 外推把**哨兵 0**（= 本表不指定、由消费点兜底）变成 1、2，
   * 城墙 Lv10 之后的标称时间变 1~2 游戏秒（假数据）。
   * （诚实说明：因"最短 5 现实秒"地板存在，玩家实际耗时无感；
   * 但表与调试读数全错，且地板一旦调整就会暴露。修：外推段 0 保持 0。）""",
    """   * §104 建筑时间表口径（v89.125 立 · v89.128 升级）
   * ------------------------------------------------------------
   * v89.125：extRows 外推曾把**哨兵 0**变成 1、2（城墙假数据）→ 外推段 0 保持 0。
   * v89.128（老板「每 12 级循环使用建造时长」「单次不超过 24h」）：时间列**不再有哨兵**
   * —— 一律走 `DATA.buildTimeSec` 曲线（见 §108）；本节的守卫改为"曲线值 >0 且 ≤24h"。""",
    '① §104 标题注释')

# ── ② §104① 重写 ──
rep("""    /* ① 城墙：levelCost(lv).time 恒为哨兵 0 —— 升级走**格子路径兜底** `lvl × 60`
       （v89.126 占格后与其它建筑同一路径；旧 `cost.time || 60` 随独立出口一并退役）。
       逐级扫到 45（含外推段），任何一级变正数都算回归。 */
    var bad104 = [];
    for (var lv104 = 1; lv104 <= 45; lv104++) {
      var cq104 = DATA.BUILDINGS.chengqiang.levelCost(lv104);
      if (!cq104 || cq104.time !== 0) bad104.push(lv104 + ':' + (cq104 ? cq104.time : 'null'));
    }
    check('§104① 城墙时间哨兵恒 0（外推不得把它变成数字）', bad104.length === 0,
      bad104.length ? '异常档：' + bad104.slice(0, 6).join(' ') : 'Lv1..45 全 0 ✓');""",
    """    /* ① 城墙：时间走**曲线**（v89.128 起哨兵 0 时代终结）——逐级扫到 45，
       每档必须 >0 且 ≤24h（老板硬上限）；退化回哨兵/超限都算回归。 */
    var bad104 = [];
    for (var lv104 = 1; lv104 <= 45; lv104++) {
      var cq104 = DATA.BUILDINGS.chengqiang.levelCost(lv104);
      if (!cq104 || !(cq104.time > 0) || cq104.time > 86400) bad104.push(lv104 + ':' + (cq104 ? cq104.time : 'null'));
    }
    check('§104① 城墙时间走曲线（Lv1..45 全 >0 且 ≤24h —— 哨兵 0 已退役）', bad104.length === 0,
      bad104.length ? '异常档：' + bad104.slice(0, 6).join(' ')
        : 'Lv1..45 全在 (0,24h] ✓（11→12 档 = ' + (DATA.buildTimeSec('chengqiang', 11) / 3600).toFixed(1) + 'h）');""",
    '② §104① 重写')

# ── ③ §104④ 重写（槽 + 曲线）──
rep("""    /* v89.126：城墙占格 —— 摆一格 Lv10 城墙，走**通用升级出口** upgradeAt */
    var idxW104 = -1;
    for (var iw104 = 0; iw104 < c104.cells.length; iw104++) {
      var xw104 = c104.cells[iw104];
      if (!xw104.build && !xw104.official && !xw104.pending) { idxW104 = iw104; break; }
    }
    if (idxW104 >= 0) c104.cells[idxW104].build = { id: 'chengqiang', lvl: 10 };
    var nq104 = (st104.queues.build || []).length;
    var rw104 = idxW104 >= 0 ? G.upgradeAt(c104.id, idxW104) : null;
    var q104 = (st104.queues.build || [])[nq104];
    /* 城墙时间列是哨兵 0 → 格子升级兜底 lvl×60（与其它建筑同一兜底） */
    var want104 = Math.max(10 * 60 * G.cityBuildMult(c104), G.buildMinTime());
    var ok104 = !!(rw104 && rw104.ok && q104 && Math.abs(q104.totalTime - want104) < 1e-6);
    G.state = keep104;
    check('§104④ 真调城墙 Lv10→11（通用 upgradeAt）：入队时间 = lvl×60×倍率（含 5 现实秒地板）', ok104,
      'ok=' + (rw104 && rw104.ok) + ' msg=' + ((rw104 && rw104.msg) || '')
      + ' totalTime=' + (q104 ? Math.round(q104.totalTime) : 'null') + ' 期望 ' + Math.round(want104));""",
    """    /* v89.128：城墙在**环城槽**（不占格）—— 摆 Lv10，走通用升级出口 upgradeAt('wall') */
    G.wallSlotOf(c104).build = { id: 'chengqiang', lvl: 10 };
    var nq104 = (st104.queues.build || []).length;
    var rw104 = G.upgradeAt(c104.id, 'wall');
    var q104 = (st104.queues.build || [])[nq104];
    /* 时间 = 曲线 × 城建倍率（含 5 现实秒地板）——不是 lvl×60、也不是 NaN */
    var want104 = Math.max(DATA.buildTimeSec('chengqiang', 10) * G.cityBuildMult(c104), G.buildMinTime());
    var ok104 = !!(rw104 && rw104.ok && q104 && Math.abs(q104.totalTime - want104) < 1e-6);
    G.state = keep104;
    check('§104④ 真调城墙 Lv10→11（环城槽 · 通用 upgradeAt）：入队 = 曲线 × 倍率', ok104,
      'totalTime=' + (q104 ? Math.round(q104.totalTime) : 'null') + ' 期望 ' + Math.round(want104));""",
    '③ §104④ 重写')

# ── ④ 追加 §108（插在 §105 之前）──
sect = """  /* ═══════════════════════════════════════════════════════════
   * §108（v89.128）建造时间曲线：12 级循环 + 单次 ≤24h + 建筑区分度
   * ------------------------------------------------------------
   * 老板令（需求 3/4）：「最长不要超过 48h；每 12 级循环使用建造时长
   *   （13-24 级分别使用 1-12 级的时长）」「单次建造用时不超过 24，且各建筑有区分度」
   * 口径（1 倍速基准）见 DATA.BUILD_TIME_H_MAX 注释块；唯一出口 DATA.buildTimeSec。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var ids108 = Object.keys(DATA.BUILDINGS).concat(['farm', 'forest', 'quarry', 'mine']);
    /* ① 全档 ∈ (0, 24h]（城内 16 + 城外 4 × 0..45 级全采样） */
    var bad108 = [];
    ids108.forEach(function (bid) {
      for (var lv108 = 0; lv108 <= 44; lv108++) {
        var t108 = DATA.buildTimeSec(bid, lv108);
        if (!(t108 > 0) || t108 > 86400) bad108.push(bid + '@' + lv108 + ':' + t108);
      }
    });
    check('§108① 建造时间全档 ∈ (0, 24h]（城内 16 + 城外 4 × 0..45 级）', bad108.length === 0,
      bad108.length ? '异常：' + bad108.slice(0, 6).join(' ') : ids108.length + ' 座 × 45 档 ✓');
    /* ② 12 级循环：t(lv) === t(lv % 12)（逐档恒等） */
    var bad208 = [];
    ids108.forEach(function (bid) {
      for (var lv208 = 0; lv208 <= 44; lv208++) {
        if (DATA.buildTimeSec(bid, lv208) !== DATA.buildTimeSec(bid, lv208 % 12)) bad208.push(bid + '@' + lv208);
      }
    });
    check('§108② 12 级循环：升到 13 级用 1 级的时长（逐档恒等）', bad208.length === 0,
      bad208.length ? '异常：' + bad208.slice(0, 6).join(' ') : '全档位恒等 ✓');
    /* ③ 区分度：最重（官府 18h）≥ 最轻（校场 5h）× 2.5；T_max 表键齐备 */
    var maxT108 = DATA.buildTimeSec('guanfu', 11), minT108 = DATA.buildTimeSec('xiaochang', 11);
    check('§108③ 建筑区分度（官府 vs 校场 ≥2.5 倍）+ T_max 表齐备',
      maxT108 >= minT108 * 2.5 && ids108.every(function (b) { return DATA.BUILD_TIME_H_MAX[b] > 0; }),
      '官府 ' + (maxT108 / 3600).toFixed(1) + 'h vs 校场 ' + (minT108 / 3600).toFixed(1) + 'h');
    /* ④ 端到端：真调官府 Lv11→12 —— 入队 = 曲线 18h × 倍率（旧值 38 天） */
    var keep108 = G.state;
    var st108 = G.newGame({ name: 'v128t', cityName: '许都' });
    G.state = st108;
    var c108 = st108.cities[0];
    st108.res.grain = 1e9; st108.res.wood = 1e9; st108.res.stone = 1e9; st108.res.iron = 1e9;
    var g108 = -1;
    c108.cells.forEach(function (cl, i) { if (cl.build && cl.build.id === 'guanfu') g108 = i; });
    if (g108 >= 0) c108.cells[g108].build.lvl = 11;
    st108.queues.build.length = 0;
    var r108 = g108 >= 0 ? G.upgradeAt(c108.id, g108) : null;
    var q108 = (st108.queues.build || [])[0];
    var want108 = Math.max(DATA.buildTimeSec('guanfu', 11) * G.cityBuildMult(c108), G.buildMinTime());
    check('§108④ 真调官府 Lv11→12：入队 = 曲线 18h × 倍率（旧值 38 天）',
      !!(r108 && r108.ok && q108 && Math.abs(q108.totalTime - want108) < 1e-6),
      'totalTime=' + (q108 ? (q108.totalTime / 3600).toFixed(1) : 'null') + 'h 期望 '
      + (want108 / 3600).toFixed(1) + 'h');
    G.state = keep108;
  })();

"""
anchor = """  /* ═══════════════════════════════════════════════════════════
   * §105（v89.126）人口增速：固定时间速率（每 fillHours 现实小时补满）"""
assert s.count(anchor) == 1, '§105 锚点 %d' % s.count(anchor)
s = s.replace(anchor, sect + anchor)
n += 1
print('  ✓ ④ 追加 §108')

assert s != orig and n == 4
# 结构守卫：只查花括号盈亏（圆括号会被中文注释/区间写法 `(0, 24h]` 污染，判据不稳）
assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), '花括号盈亏变化'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch H(smoke) OK · %d 处（LF 保持）' % n)
