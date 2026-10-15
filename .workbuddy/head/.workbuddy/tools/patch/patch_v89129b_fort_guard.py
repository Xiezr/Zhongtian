# -*- coding: utf-8 -*-
"""patch_v89129b_fort_guard.py —— v89.129 需求 2：据点守将（唯一缺口）。
1. makeGeneral 加第 8 可选参 rand（确定性流，向后兼容）
2. map.js 新增 GAME.fortGuardOf（按等级"相称"生成、确定性、必有）
3. battle.js resolveTarget 的 fort 分支带 guard
"""
import io

n = 0


def patch(P, pairs, tag):
    global n
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = s
    for o, nn, t in pairs:
        assert s.count(o) == 1, tag + '/' + t + ' 锚点 %d 个' % s.count(o)
        s = s.replace(o, nn)
        n += 1
        print('  ✓ ' + tag + '/' + t)
    assert s != orig
    assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), tag + ' 花括号盈亏被改变'
    assert '\r\n' not in s, tag + ' CRLF 混入'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)


# ---------- ① state.js：makeGeneral 第 8 参 ----------
patch('E:/Deepseekdb/js/state.js', [
    ("""  GAME.makeGeneral = function (name, level, status, cityId, isStarter, rankId, styleId) {
    var b = DATA.GEN_BASE;
    var rk = DATA.GEN_RANK_BY_ID[rankId] || DATA.GEN_RANK_BY_ID.liang;
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === styleId) st = x; });
    if (!st) st = DATA.GEN_STYLES[0];
    var rand = U.rng((U.now() + (GAME._genSeq || 0) * 977 + Math.floor(Math.random() * 1e7)) >>> 0);""",
     """  GAME.makeGeneral = function (name, level, status, cityId, isStarter, rankId, styleId, rand) {
    var b = DATA.GEN_BASE;
    var rk = DATA.GEN_RANK_BY_ID[rankId] || DATA.GEN_RANK_BY_ID.liang;
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === styleId) st = x; });
    if (!st) st = DATA.GEN_STYLES[0];
    /* v89.129：`rand` 可作第 8 参传入**确定性流**（据点守将等"派生型 NPC"用 ——
       同一目标每次读到同一个人，侦查看到的 == 打起来遇到的）；
       不传则保持原行为（时间戳 + 随机）。 */
    rand = rand || U.rng((U.now() + (GAME._genSeq || 0) * 977 + Math.floor(Math.random() * 1e7)) >>> 0);""",
     'makeGeneral 第8参')],
    'state.js')

# ---------- ② map.js：fortGuardOf ----------
patch('E:/Deepseekdb/js/map.js', [
    ("""      qingji: lv >= 4 ? Math.round(base * 0.1) : 0,
    };
  };
  GAME.map.razeFort = function (x, y) {""",
     """      qingji: lv >= 4 ? Math.round(base * 0.1) : 0,
    };
  };
  /* ============================================================
   * v89.129（老板：「任何野外目标（野地，城池，名城等）均应有将领带领，
   *   根据等级配备相称资质和等级的将领」）——**据点守将**（唯一出口）：
   * ------------------------------------------------------------
   * 缺口修复：此前据点只有守军没有守将 ——
   *   ① 战斗侧 `scGen = t.guard || null` 恒 null（守方不吃将领加成、不参加斗将）；
   *   ② 侦查面板"守将"行恒显示「无（守军无将，即无加成）」——与其他野外目标不一致。
   * 口径（"相称" = 按据点等级配置）：
   *   · 资质：`GEN_RANKS[min(4, 2 + ⌊lv/3⌋)]` —— lv1-2 英杰 / 3-5 名世 / 6-10 天授；
   *     （比同为 Lv1-10 的野地高一档：据点是"城"，守军约 10 倍于同级野地）
   *   · 等级：`max(10, lv*4 + 20) + rand(0..5)` —— lv1 → 24~29、lv10 → 60~65
   *     （Lv10 据点 ≈ 弱县城守将 60~100 的下端，与"野地里的城"定位相称）；
   *   · **必有**（非概率：野地贼寇可无大当家，据点是有建制的守备军）；
   *   · **确定性**：名字 / 资质 / 等级 / 特性 / 四维全部按 (x, y, level) + map seed
   *     经 `_fortHash` 派生 —— 同一天"侦查看到的"与"打起来遇到的"必然是同一人；
   *   · 每日随据点等级刷新（level 变则人变）；不存档、不占 generals 列表
   *     （与 npcCityGuard / wildDefenseAt 同族 —— 接触时派生）。
   * ============================================================ */
  GAME.fortGuardOf = function (fort) {
    if (!fort) return null;
    var lv = Math.max(1, Math.min(10, fort.level | 0));
    /* 确定性 rng 流：同一 (x,y,level) 每次产出同一个人（含四维） */
    var rand = U.rng(Math.floor(GAME.map._fortHash(fort.x, fort.y, 23) * 4294967295) >>> 0);
    var rankIdx = Math.min(DATA.GEN_RANKS.length - 1, 2 + Math.floor(lv / 3));
    var rk = DATA.GEN_RANKS[rankIdx];
    var gLv = Math.max(10, lv * 4 + 20) + Math.floor(rand() * 6);
    /* 名字走守备军官系池（太守/都尉一系；与野地贼寇、客栈招募都不重名） */
    var sn = DATA.NPC_GUARD_SURNAME, gv = DATA.NPC_GUARD_GIVEN, tt = DATA.NPC_GUARD_TITLE;
    var name = sn[Math.floor(rand() * sn.length)] + gv[Math.floor(rand() * gv.length)];
    /* 特性：抽一门（与 npcCityGuard 同款权重抽签 —— 猛将/智将有偏科，战报有戏） */
    var styles = DATA.GEN_STYLES || [{ id: 'balance', name: '均衡', w: 1, mul: { tong: 1, nz: 1, yw: 1, zm: 1 } }];
    var stTotal = 0;
    styles.forEach(function (x) { stTotal += (x.w || 0); });
    var rollS = rand() * (stTotal || 1), st = styles[0];
    for (var si = 0; si < styles.length; si++) {
      rollS -= (styles[si].w || 0);
      if (rollS <= 0) { st = styles[si]; break; }
    }
    var g = GAME.makeGeneral(name, gLv, 'guard', null, false, rk.id, st.id, rand);
    g.npcGuard = true;                        /* 系统派生标记（与 npcCityGuard 同） */
    g.title = tt[Math.floor(rand() * tt.length)];
    return g;
  };
  GAME.map.razeFort = function (x, y) {""",
     'fortGuardOf')],
    'map.js')

# ---------- ③ battle.js：resolveTarget 的 fort 分支 ----------
patch('E:/Deepseekdb/js/battle.js', [
    ("""      var fg = GAME.map.fortGarrison(f.level);
      /* v61（老板）：「野地里的城池，应默认其建筑全都建满了」——
         布局由 GAME.fortPlanOf 派生（所有建筑各 1 座 · 军营 2 座 · 余为民房 · 位置固定），
         城防走唯一出口 GAME.fortDefOf（原来写死在这行里）。 */
      return { ok: true, kind: 'fort', x: f.x, y: f.y, lv: f.level, name: f.name + '（野外城池 Lv' + f.level + '）',
        fort: f, garrison: fg, def: GAME.fortDefOf(f), plan: GAME.fortPlanOf(f),
        cityType: 'fort', dropType: 'fort' };""",
     """      var fg = GAME.map.fortGarrison(f.level);
      /* v61（老板）：「野地里的城池，应默认其建筑全都建满了」——
         布局由 GAME.fortPlanOf 派生（所有建筑各 1 座 · 军营 2 座 · 余为民房 · 位置固定），
         城防走唯一出口 GAME.fortDefOf（原来写死在这行里）。
         v89.129：**守将**同样走唯一出口 GAME.fortGuardOf ——
         补上"据点无守将"的缺口（战斗吃将领加成 / 侦查名册可见 / 可触发斗将）。 */
      return { ok: true, kind: 'fort', x: f.x, y: f.y, lv: f.level, name: f.name + '（野外城池 Lv' + f.level + '）',
        fort: f, garrison: fg, def: GAME.fortDefOf(f), plan: GAME.fortPlanOf(f),
        guard: GAME.fortGuardOf(f),
        cityType: 'fort', dropType: 'fort' };""",
     'resolveTarget fort.guard')],
    'battle.js')

print('patchB OK · %d 处（LF 保持）' % n)
