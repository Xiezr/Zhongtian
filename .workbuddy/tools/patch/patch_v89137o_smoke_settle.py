# -*- coding: utf-8 -*-
"""v89.137 补丁 O：smoke-test.js —— 派驻面板退役断言 + §110③ 新语义 + BT_LOG_MAX 跟随"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ 1. 1861：派驻面板接线 → 退役断言 ══════════
rep(
"""check('v89.83：派驻面板接线（表格化 + 加减/全带/装满/清空 + 实时合计 + 上限余量）', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var m = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  return /ui\\.openWildGarrison = function/.test(u) && /ui\\.updateWgTotal = function/.test(u)
    && /ui\\.wgFill = function/.test(u) && /ui\\.wgClear = function/.test(u) && /ui\\.wgRoom = function/.test(u)
    && /data-action="wg-step"/.test(u) && /data-action="wg-max"/.test(u)
    && /data-action="wg-fill"/.test(u) && /data-action="wg-clear"/.test(u)
    && /id="wg-total"/.test(u)
    && /case 'wg-step': ui\\.wgStep\\(el\\)/.test(m) && /case 'wg-fill': ui\\.wgFill\\(\\)/.test(m);
})());""",
"""check('v89.83→v89.137：派驻面板退役 · 派驻入口统一到出征界面（防复活 · 剥注释后查）', (function () {
  /* 老板 7：「派驻弹出出征界面（即侦察/掠夺/占领界面）…所有军队操作均以出征界面进行」——
     旧派驻面板（表格 + 选将 + wg-* 助手）整条退役；新链路 = wild-garrison-open → openExpModal
     → 方式「驻守·增援」→ dispatch → prepare（上限预检 + 无将硬闸）→ 抵达 station 分支。 */
  var u = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
  var m = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8'));
  var d = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'domain.js'), 'utf8'));
  return !/ui\\.openWildGarrison = function/.test(u) && !/ui\\.wgFill = function/.test(u)
    && !/ui\\.updateWgTotal = function/.test(u) && !/data-action="wg-step"/.test(u)
    && !/GAME\\.doWildGarrison = function/.test(d) && !/GAME\\.doWildGarrisonDo = function/.test(m)
    && /case 'wild-garrison-open':/.test(m) && /ui\\.openExpModal\\(\\{ kind: 'wild'/.test(m)
    && /if \\(isOwnWild137\\) return m\\.id === 'station';/.test(u)
    && /stGen137/.test(u) && /_cap137b/.test(d);
})());""",
'1861 退役断言')

# ══════════ 2. 2921：Lv0 文案 + 新预检同口径 ══════════
rep(
"""    check('v89.86（P-11）：Lv0 野地文案动态（无驻军位）+ 派驻面板同口径',
      ui8.indexOf('Lv0 无驻军位') >= 0 && ui8.indexOf('该等级无驻军位') >= 0);""",
"""    /* v89.137：派驻面板退役 —— "该等级无驻军位"的旧文案随之退场；
       同口径改由**驻守预检**承担（battle.prepare：驻军上限 0 时拦截并写明来由）。 */
    check('v89.86（P-11）：Lv0 野地文案动态（无驻军位）+ 驻守预检同口径（v89.137 改走 dispatch）',
      ui8.indexOf('Lv0 无驻军位') >= 0
      && /驻军上限/.test(dS8) && /级野地 ×/.test(dS8));""",
'2921 改口径')

# ══════════ 3. 3380：BT_LOG_MAX 40 → 64（16 行视高配套） ══════════
rep(
"""        && /ui\\.BT_LOG_MAX = 40;/.test(u)""",
"""        && /ui\\.BT_LOG_MAX = 64;/.test(u)      /* v89.137：40 → 64（.bt-log 16 行视高配套） */""",
'BT_LOG_MAX 断言')

# ══════════ 4. §110③ 驻军规则：按 v89.137 新语义重写 ══════════
rep(
"""    /* ③ 驻军规则：首队带将 / 增援无将（直补真扣兵）/ 有将驻军拒带将 / **补将通道**（v89.135） */
    var w110 = G.map.wildAt(3, 3);
    /* 先停掉在采队，避免 ④ 的每地一队检查干扰本段 */
    var _g3 = G.gatherAt(3, 3); if (_g3) G.abandonGather(_g3.id);
    w110.garrison = null;
    var g110g = st110.generals[0];
    var g110g2 = st110.generals[1] || st110.generals[0];
    var r3a = G.doWildGarrison(3, 3, { minfu: 100 }, c110.id, null);
    w110.garrison = { troops: { minfu: 500 }, cityId: c110.id };
    var armyBefore110 = c110.army.minfu || 0;
    var r3b = G.doWildGarrison(3, 3, { minfu: 100 }, c110.id, null);
    /* 补将：无将驻军 + 带将 → 允许（走行军，出发即扣兵；抵达时补 genId） */
    var r3d = G.doWildGarrison(3, 3, { minfu: 100 }, c110.id, g110g.id);
    /* 有将驻军 + 带将 → 拒（v89.128 规则） */
    w110.garrison.genId = g110g2.id;
    var r3c = G.doWildGarrison(3, 3, { minfu: 100 }, c110.id, g110g.id);
    w110.garrison.genId = null;
    var garNow110 = G.wildGarrisonTotal(w110.garrison);
    check('§110③ 驻军规则：首队无将拒 / 增援无将直补（真扣城兵）/ 无将驻军可带将补驻（走行军）/ 有将驻军拒带将',
      !(r3a && r3a.ok) && !!(r3b && r3b.ok) && garNow110 === 600
      && (c110.army.minfu || 0) === armyBefore110 - 200 && !(r3c && r3c.ok)
      && !!(r3d && r3d.ok),
      'garrison ' + garNow110 + ' · army ' + (c110.army.minfu || 0)
      + ' · 首队msg=' + ((r3a && r3a.msg) || '') + ' · 补将msg=' + ((r3d && r3d.msg) || ''));""",
"""    /* ============================================================
     * ③ 驻军规则（v89.137 定稿 · 统一走进 `march.dispatch` 的 station 方式）：
     *   ① 首队无将 → 拒（prepare："请选择出征将领"）；
     *   ② 增援（无将）→ **走行军**（出发即扣城兵；抵达并入驻军）——
     *      旧"直补即时到位"随 doWildGarrison 退役，统一成一条通道；
     *   ③ 补将通道（无将驻军 + 带将）→ 走行军，抵达补 genId（v89.135 规则保留）；
     *   ④ 已有驻将 + 带将 → **接受但不带将**（硬闸忽略 genId，界面已提示"不带将"）——
     *      判据在 prepare（gen → null），且 wildGarrisonAdd 的 genId 本就只在空位写入。
     * ============================================================ */
    var w110 = G.map.wildAt(3, 3);
    /* 先停掉在采队，避免 ④ 的每地一队检查干扰本段 */
    var _g3 = G.gatherAt(3, 3); if (_g3) G.abandonGather(_g3.id);
    w110.garrison = null;
    var g110g = st110.generals[0]; g110g.status = 'idle'; g110g.cityId = c110.id;
    var g110g2 = st110.generals[1] || st110.generals[0]; g110g2.status = 'idle'; g110g2.cityId = c110.id;
    var r3a = G.march.dispatch({ kind: 'wild', x: 3, y: 3 }, 'station', { minfu: 100 }, '');
    w110.garrison = { troops: { minfu: 500 }, cityId: c110.id };
    var armyBefore110 = c110.army.minfu || 0;
    var r3b = G.march.dispatch({ kind: 'wild', x: 3, y: 3 }, 'station', { minfu: 100 }, '');
    /* 补将：无将驻军 + 带将 → 允许（走行军，出发即扣兵；抵达时补 genId） */
    var r3d = G.march.dispatch({ kind: 'wild', x: 3, y: 3 }, 'station', { minfu: 100 }, g110g.id);
    /* 有将驻军 + 带将 → 接受但不带将（硬闸：prepare 把 gen 置空） */
    w110.garrison.genId = g110g2.id;
    var r3c = G.march.dispatch({ kind: 'wild', x: 3, y: 3 }, 'station', { minfu: 100 }, g110g.id);
    /* 推进 3 条行军抵达 → 并兵落账；驻将必须**仍是 g110g2**（未被后来的将顶掉） */
    (G.state.marches || []).forEach(function (mm) { mm.elapsed = mm.totalTime; });
    G.march.tick();
    var garNow110 = G.wildGarrisonTotal(w110.garrison);
    var genKeep110 = w110.garrison.genId;
    w110.garrison.genId = null;
    check('§110③ 驻军规则（v89.137 统一 dispatch）：首队无将拒 / 增援走行军 / 补将走行军 / 有将驻军接受但不带将',
      !(r3a && r3a.ok) && !!(r3b && r3b.ok) && !!(r3d && r3d.ok) && !!(r3c && r3c.ok)
      && garNow110 === 800 && (c110.army.minfu || 0) === armyBefore110 - 300
      && genKeep110 === g110g2.id,
      'garrison ' + garNow110 + ' · army ' + (c110.army.minfu || 0)
      + ' · 驻将=' + genKeep110 + '（应 ' + g110g2.id + '）'
      + ' · 首队msg=' + ((r3a && r3a.msg) || ''));""",
'§110③ 新语义')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert len(ok) == 4, '段数 %d' % len(ok)
print('✅ smoke-test.js 补丁O 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
