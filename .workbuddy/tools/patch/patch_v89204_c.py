# -*- coding: utf-8 -*-
"""v89.204 批次 C：domain.js
  C1 siegeChipOf -> 固定 heartsLoss（20）
  C2 siegeTextOf 文案 -> 民心
  C3 CITY_SCOPED 的 marches/gathers 补 clean（失城路径强制改属）
  C4 新增 GAME.lostCityToNpc + GAME.cityFallen（失城处置唯一出口）
"""
import io

P = 'E:/Deepseekdb/js/domain.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

# ── C1 siegeChipOf ──
C1_OLD = """  /* 单波破防（%）：chipBase × 战力比，夹在 [chipMin, chipMax]。
     \u26d4 v89.198：战法（围困 ×1.5）全撤退役 —— 只剩基准口径（老板「清除战法这个玩法」）。 */
  GAME.siegeChipOf = function (ratio) {
    var cfg = DATA.SIEGE || {};
    var base = cfg.chipBase == null ? 45 : cfg.chipBase;
    var lo = cfg.chipMin == null ? 8 : cfg.chipMin;
    var hi = cfg.chipMax == null ? 55 : cfg.chipMax;
    var r = Number(ratio);
    if (!isFinite(r) || r <= 0) r = 0;
    var chip = Math.max(lo, Math.min(hi, Math.round(base * r)));
    return Math.max(1, Math.min(100, chip));
  };"""
C1_NEW = """  /* v89.204（老板 1）：单场**获胜**推进的民心（固定 heartsLoss=20）。
     旧「chipBase × 战力比 夹在 [chipMin, chipMax]」的动态口径随本轮退役 ——
     参数保留（签名兼容，不再读 ratio）；战败/撤退不调用本出口（见 battle.js 围攻段）。 */
  GAME.siegeChipOf = function () {
    var cfg = DATA.SIEGE || {};
    var v = cfg.heartsLoss == null ? 20 : cfg.heartsLoss;
    return Math.max(1, Math.min(100, Math.round(v)));
  };"""
rep('C1 siegeChipOf', C1_OLD, C1_NEW, 'GAME.siegeChipOf = function () {')

# ── C2 siegeTextOf ──
C2_OLD = """    return '守备 ' + Math.round(st.hold) + '%'
      + (st.waves ? '（已围攻 ' + st.waves + ' 波）' : '（未动干戈）')
      + ' · 每整日恢复 ' + (cfg.repairPerDay || 0) + '%';"""
C2_NEW = """    return '民心 ' + Math.round(st.hold) + '%'
      + (st.waves ? '（已围攻 ' + st.waves + ' 波）' : '（未动干戈）')
      + ' · 每整日恢复 ' + (cfg.repairPerDay || 0) + '%';"""
rep('C2 siegeTextOf', C2_OLD, C2_NEW, "'民心 ' + Math.round(st.hold) + '%'")

# ── C3 CITY_SCOPED marches/gathers clean ──
C3_OLD = """    /* 在途部队与在外采集**不许清**：清了兵就凭空消失，所以标 hard（有它就不让放弃） */
    { key: 'marches', path: 'cityId', label: '在途行军', hard: true },
    { key: 'gathers', path: 'cityId', label: '在外采集队', hard: true },"""
C3_NEW = """    /* 在途部队与在外采集**不许清**：清了兵就凭空消失，所以标 hard（有它就不让放弃）。
       v89.204：`clean` = **失城路径**（GAME.cityFallen）专用 —— 改属收容城（行程与兵都不丢）；
       玩家主动弃城仍先走 hard 拒绝（clean 不会被触发）。 */
    { key: 'marches', path: 'cityId', label: '在途行军', hard: true,
      clean: function (s, city, recv) {
        (s.marches || []).forEach(function (m) { if (m.cityId === city.id) m.cityId = recv.id; });
      } },
    { key: 'gathers', path: 'cityId', label: '在外采集队', hard: true,
      clean: function (s, city, recv) {
        (s.gathers || []).forEach(function (g) { if (g.cityId === city.id) g.cityId = recv.id; });
      } },"""
rep('C3 CITY_SCOPED', C3_OLD, C3_NEW, "v89.204：`clean` = **失城路径**")

# ── C4 cityFallen + lostCityToNpc ──
C4_ANCHOR = """    return { ok: true, receiver: recv, refs: left, before: before,
      msg: '已放弃 ' + city.name + '：' + U.fmt(before.army) + ' 驻军与 ' + before.gens
        + ' 名将领归 ' + recv.name };
  };
"""
C4_NEW = C4_ANCHOR + """
  /* v89.204（老板 1）：失城 → 地图上恢复/新增一座 NPC 城（敌占）。
     · 攻占来的城（有 origId）→ 从 DATA.NPC_CITIES 恢复原记录；
     · 自建城 → 新造一条县城档记录（敌方接管为据点级城池）。 */
  GAME.lostCityToNpc = function (city) {
    var s = GAME.state;
    if (!s || !s.map || !city) return null;
    s.map.cities = s.map.cities || [];
    var ex = null;
    s.map.cities.forEach(function (c) {
      if (!ex && (c.id === city.id || (c.x === city.x && c.y === city.y))) ex = c;
    });
    if (ex) return ex;
    var rec = null;
    if (city.origId) {
      (DATA.NPC_CITIES || []).forEach(function (c) { if (!rec && c.id === city.origId) rec = U.deep(c); });
    }
    if (!rec) {
      rec = { id: 'lost_' + city.id, name: city.name || '失地', x: city.x, y: city.y,
        type: 'county', state: city.state || '', level: (DATA.NPC_TIER_LV || {}).county || 12,
        def: 60, rep: 60 };
    }
    rec.owner = 'npc';
    rec.garrison = GAME.genGarrison(rec);
    rec.maxArmy = rec.garrison;
    s.map.cities.push(rec);
    return rec;
  };
  /* ============================================================
   * v89.204（老板 1）：**失城处置** —— 我方城池被敌方攻破（民心归零 + 城破）时，
   *   照 CITY_SCOPED 表批量清理（复用弃城框架：将领/队列随表清，hard 项改属收容城），
   *   城池变回地图上的 NPC 城（可再打回）。
   * ------------------------------------------------------------
   * 与 abandonCity（主动弃城）的差别：
   *   · 不拒绝：战败失城不是玩家选择 —— hard 引用（在途行军/在外采集）由表内 clean**改归属**；
   *   · 城内驻军随城失陷（战败损失，不返还）；
   *   · **主城保护**（双闸）：明设主城 s.mainCityId / 缺省首城 / 最后一座城 —— 均不可能失
   *     （老板原话：「除主城不可被占领外，别的城池将会被敌方占领」）。
   * 返回 { ok, receiver, msg }。
   * ============================================================ */
  GAME.cityFallen = function (city, srcName) {
    var s = GAME.state;
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    var inList = (s.cities || []).some(function (c) { return c.id === city.id; });
    if (!inList) return { ok: false, msg: '城池已不在治下' };
    if (GAME.isMainCity && GAME.isMainCity(city)) return { ok: false, msg: '主城不可被占领' };
    var head = (s.cities || [])[0];
    if (!s.mainCityId && head && head.id === city.id) return { ok: false, msg: '主城不可被占领' };
    if ((s.cities || []).length <= 1) return { ok: false, msg: '最后一座城不可被占领' };
    var others = (s.cities || []).filter(function (c) { return c.id !== city.id; });
    var recv = (GAME.mainCityOf && GAME.mainCityOf()) || others[0];
    if (!recv) return { ok: false, msg: '无收容城' };
    var before = {
      army: GAME.armyTotal(city),
      gens: (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length,
    };
    GAME.CITY_SCOPED.forEach(function (e) { if (e.clean) e.clean(s, city, recv); });
    var back = GAME.lostCityToNpc ? GAME.lostCityToNpc(city) : null;
    if (GAME.ui && GAME.ui._cityId === city.id) GAME.ui._cityId = recv.id;
    var src = srcName || '外敌';
    var msg = city.name + ' 民心尽失，为 ' + src + ' 所据';
    GAME.log.war('\U0001f3f4 ' + msg + '！驻军 ' + U.fmt(before.army) + ' 人尽没，'
      + before.gens + ' 名将领与残部退守 ' + recv.name
      + (back ? '　（城池易主，整军可复）' : ''));
    if (GAME.ui && GAME.ui.notify) GAME.ui.notify('warn', '\U0001f3f4 ' + msg + ' —— 可在出征界面讨还');
    if (GAME.ui && GAME.ui.moment) {
      GAME.ui.moment({ kind: 'card', icon: '\U0001f3f4', title: '失地 · ' + city.name,
        sub: '民心尽失，为 ' + src + ' 所据　·　残部退守 ' + recv.name });
    }
    return { ok: true, receiver: recv, back: back, before: before, msg: msg };
  };
"""
rep('C4 cityFallen', C4_ANCHOR, C4_NEW, 'GAME.cityFallen = function (city, srcName)')

print('patch C done')
