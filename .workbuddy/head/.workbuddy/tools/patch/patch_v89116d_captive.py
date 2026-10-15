# -*- coding: utf-8 -*-
"""v89.116 补丁 D：俘虏营（按兵种） + 自动治疗触发记录（老板需求 3 / 7）

口径：
  · 俘虏从"直接收编为民"改为**按兵种入俘虏营**（`s.captives`）——
    军务处列出每个兵种各多少，玩家自己决定「收编为民」（加人口）或「释放」（不添人口）。
    按兵种的来源 = 敌军的**逐兵种损失表**（`defLossBy` 攻方视角 / `atkLossBy` 守方视角），
    与战报里的兵损表同一份数据，不再凭空折一个总数。
  · 伤兵营：军务处逐兵种列全（已有 woundedArmy，补齐"每兵种一行"的读法）。
  · 自动治疗：`heal` 返回逐兵种明细；`autoHeal` 追加**触发记录**（时间 + 兵种×数量）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ============================================================
# ① battle.js：俘虏按兵种入营（不再直接加人口）
# ============================================================
edit('js/battle.js',
     """  GAME.battle.captiveGain = function (city, result, target, enemyLoss) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['wild', 'fort', 'city', 'defense'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = (enemyLoss != null) ? enemyLoss : (result.defLoss || 0);
    if (!(defLoss > 0)) return { gain: 0 };
    var gain = Math.round(defLoss * (cfg.rate == null ? 0.08 : cfg.rate));
    if (gain < (cfg.min == null ? 15 : cfg.min)) return { gain: 0 };
    gain = Math.min(cfg.cap == null ? 500 : cfg.cap, gain);
    var Rc = GAME.res(city);
    Rc.pop = (Rc.pop || 0) + gain;
    return { gain: gain, city: city.name };
  };""",
     """  /* ============================================================
   * v89.116（老板「伤兵营放在军务处下，俘虏营也是。出现伤病或俘虏时，
   *   列出具体兵种及数量，不要一个总数量」）
   * ------------------------------------------------------------
   * 改前：俘获当场折算成一个**总数**，直接 `pop += gain` 完事 ——
   *   既没有"俘虏营"这个落点，也看不出抓到的是些什么兵。
   * 现在：按**敌军的逐兵种损失表**折算，逐兵种入 `s.captives`（俘虏营）：
   *   · 攻方视角：敌军 = 守方 → `result.defLossBy`
   *   · 守方视角（守城）：敌军 = 攻方 → `result.atkLossBy`
   *   总数仍按 `DATA.CAPTIVE.rate` 折、仍受 `min/cap` 约束（口径不变），
   *   逐兵种分配用"按权重取整 + 余数补最大项"（与 `assignArmy` 同手法，避免取整丢人）。
   * 收编 / 释放由玩家在军务处决定（`GAME.doConscriptCaptives` / `doReleaseCaptives`）。
   * ============================================================ */
  GAME.battle.captiveGain = function (city, result, target, enemyLoss, enemyLossBy) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['wild', 'fort', 'city', 'defense'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = (enemyLoss != null) ? enemyLoss : (result.defLoss || 0);
    if (!(defLoss > 0)) return { gain: 0 };
    var gain = Math.round(defLoss * (cfg.rate == null ? 0.08 : cfg.rate));
    if (gain < (cfg.min == null ? 15 : cfg.min)) return { gain: 0 };
    gain = Math.min(cfg.cap == null ? 500 : cfg.cap, gain);
    /* 逐兵种分配：没有明细（旧档 / 骰子引擎）→ 落一个 'unknown' 桶，
       界面显示"来历不明的一批"，不假装知道兵种。 */
    var by = enemyLossBy || {};
    var keys = [];
    var tot = 0;
    for (var k in by) { var v = Math.max(0, Math.floor(by[k] || 0)); if (v > 0) { keys.push(k); tot += v; } }
    var out = {};
    if (!keys.length) {
      out.unknown = gain;
    } else {
      var used = 0;
      keys.forEach(function (kk) {
        var n = Math.floor(gain * (Math.floor(by[kk]) / tot));
        if (n > 0) { out[kk] = n; used += n; }
      });
      var rest = gain - used;
      if (rest > 0) {                        /* 余数补给损失最大的一项（不丢人） */
        var top = keys[0];
        keys.forEach(function (kk) { if ((by[kk] || 0) > (by[top] || 0)) top = kk; });
        out[top] = (out[top] || 0) + rest;
      }
    }
    var s = GAME.state;
    s.captives = s.captives || {};
    for (var ck in out) s.captives[ck] = (s.captives[ck] || 0) + out[ck];
    return { gain: gain, byType: out, city: city.name };
  };

  /* ---- 俘虏营的两个出口（唯一出口：军务处按钮、探针、测试都走它们）---- */
  GAME.captivesTotalOf = function (camp) {
    var s = GAME.state, t = 0;
    for (var k in (s.captives || {})) t += Math.max(0, s.captives[k] || 0);
    return t;
  };
  /* 收编为民：全部并入住民（与旧口径同一笔账：人口 += 总俘虏数） */
  GAME.doConscriptCaptives = function (cityId) {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    if (!city) return { ok: false, msg: '没有可安置的城池' };
    var Rc = GAME.res(city);
    Rc.pop = (Rc.pop || 0) + n;
    s.captives = {};
    GAME.log.sys('🪶 ' + city.name + ' 收编俘虏 ' + U.fmt(n) + ' 众为民（人口 +' + U.fmt(n) + '）');
    return { ok: true, msg: '收编 ' + U.fmt(n) + ' 众为民', n: n, city: city.name };
  };
  /* 释放：不添人口，换一点声望（"仁义之师"的实惠，但明显小于收编的收益） */
  GAME.doReleaseCaptives = function () {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var rep = Math.max(1, Math.round(n / 50));
    s.rep = (s.rep || 0) + rep;
    s.captives = {};
    GAME.log.sys('🕊 释放俘虏 ' + U.fmt(n) + ' 众（声望 +' + rep + '）');
    return { ok: true, msg: '释放 ' + U.fmt(n) + ' 众（声望 +' + rep + '）', n: n, rep: rep };
  };""",
     'battle.js 俘虏按兵种入营')

# 出征侧：把逐兵种损失表传进去
edit('js/battle.js',
     """      /* v89.99：俘获迁民 —— 攻破据点/名城，溃卒收编为民（唯一出口 captiveGain） */
      var _capt99 = GAME.battle.captiveGain(city, result, t);""",
     """      /* v89.99：俘获迁民 —— 攻破据点/名城，溃卒入**俘虏营**（唯一出口 captiveGain）
         v89.116：把敌军（= 守方）的逐兵种损失表一起传进去 —— 俘虏营要按兵种列清单 */
      var _capt99 = GAME.battle.captiveGain(city, result, t, null, result.defLossBy);""",
     'battle.js 出征侧传明细')

edit('js/battle.js',
     """    if (result.captives && result.captives.gain > 0) {
      lootLines.push('俘虏：' + U.fmt(result.captives.gain) + ' 众（溃卒收编为民）');
    }""",
     """    if (result.captives && result.captives.gain > 0) {
      /* v89.116：按兵种列出来（老板：「不要一个总数量」） */
      var _cpl = [];
      for (var _ck in (result.captives.byType || {})) {
        if (!result.captives.byType[_ck]) continue;
        _cpl.push((DATA.TROOPS[_ck] ? DATA.TROOPS[_ck].name : (_ck === 'unknown' ? '来历不明' : _ck))
          + ' ×' + U.fmt(result.captives.byType[_ck]));
      }
      lootLines.push('俘虏：' + U.fmt(result.captives.gain) + ' 众入营'
        + (_cpl.length ? '（' + _cpl.join('、') + '）' : '')
        + '　·　军务处·俘虏营可收编为民');
    }""",
     'battle.js 战报俘虏明细')

# ============================================================
# ② battle.heal：返回逐兵种明细
# ============================================================
edit('js/battle.js',
     """    var comp = s.woundedArmy || {}, back = 0;
    for (var id in comp) {
      var c = comp[id] || 0;
      if (c <= 0 || !city) continue;
      city.army[id] = (city.army[id] || 0) + c;
      back += c;
    }
    s.wounded = 0;
    s.woundedArmy = {};
    if (back > 0) {
      GAME.log.war('治疗伤兵 ' + U.fmt(back) + ' 名，已归入 ' + city.name);
      return { ok: true, msg: '治疗伤兵 ' + U.fmt(back) + ' 名归队' };
    }""",
     """    var comp = s.woundedArmy || {}, back = 0, backBy = {};
    for (var id in comp) {
      var c = comp[id] || 0;
      if (c <= 0 || !city) continue;
      city.army[id] = (city.army[id] || 0) + c;
      back += c;
      backBy[id] = (backBy[id] || 0) + c;      /* v89.116：逐兵种明细（界面要列出来） */
    }
    s.wounded = 0;
    s.woundedArmy = {};
    if (back > 0) {
      GAME.log.war('治疗伤兵 ' + U.fmt(back) + ' 名，已归入 ' + city.name);
      return { ok: true, msg: '治疗伤兵 ' + U.fmt(back) + ' 名归队', back: back, backBy: backBy,
        gold: gold, city: city.name };
    }""",
     'battle.js heal 返回明细')

# ============================================================
# ③ domain.js：autoHeal 记触发记录
# ============================================================
edit('js/domain.js',
     """    var n = s.wounded || 0;
    if (n <= 0) {
      s.autoHealState = { msg: '无伤兵，待命', at: U.now() };
      return null;
    }
    /* 够不够金由 heal 自己判（同一出口，不在这里复算一份） */
    var r = GAME.battle.heal();
    s.autoHealState = {
      msg: r.ok ? (r.msg + ' · 自动') : ('暂停：' + r.msg + '（金恢复后自动继续）'),
      at: U.now(),
    };
    return r;""",
     """    var n = s.wounded || 0;
    if (n <= 0) {
      s.autoHealState = { msg: '无伤兵，待命', at: U.now() };
      return null;
    }
    /* 够不够金由 heal 自己判（同一出口，不在这里复算一份） */
    var r = GAME.battle.heal();
    s.autoHealState = {
      msg: r.ok ? (r.msg + ' · 自动') : ('暂停：' + r.msg + '（金恢复后自动继续）'),
      at: U.now(),
      /* v89.116（老板「自动治疗下放一个触发记录，如果进行了自动治疗，显示具体兵种及数量」）
         —— 明细直接读 heal 的返回值（逐兵种），界面按它列清单。 */
      detail: r.ok ? { back: r.back || 0, backBy: r.backBy || {}, gold: r.gold || 0,
        city: r.city || '' } : null,
    };
    if (r.ok) {
      s.autoHealLog = (s.autoHealLog || []);
      s.autoHealLog.unshift({ t: U.now(), n: r.back || 0, by: r.backBy || {}, gold: r.gold || 0,
        city: r.city || '' });
      while (s.autoHealLog.length > (DATA.AUTO_HEAL_LOG_MAX || 8)) s.autoHealLog.pop();
    }
    return r;""",
     'domain.js autoHeal 记录')

# ============================================================
# ④ data.js：日志上限入表
# ============================================================
edit('js/data.js',
     """  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };""",
     """  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };
  /* v89.116（老板「自动治疗下放一个触发记录」）：触发记录保留条数（超出丢最旧的）。
     界面在「自动化 · 治疗」页列出来，8 条约合"最近两三场仗"的量。 */
  DATA.AUTO_HEAL_LOG_MAX = 8;""",
     'data.js 记录上限')

edit('js/state.js',
     """        var _cap113 = GAME.battle.captiveGain(city, result, { kind: 'defense' }, result.atkLoss || 0);""",
     """        /* v89.116：把敌军（= 攻方）的逐兵种损失表一起传进去（俘虏营按兵种列清单） */
        var _cap113 = GAME.battle.captiveGain(city, result, { kind: 'defense' },
          result.atkLoss || 0, result.atkLossBy);""",
     'state.js 守城侧传明细')

edit('js/state.js',
     """    if (out.captives && out.captives.gain > 0) {
      lines.push('俘获 ' + U.numText(out.captives.gain, 0) + ' 众（溃卒收编为民）');
    }""",
     """    if (out.captives && out.captives.gain > 0) {
      /* v89.116：按兵种列出来（老板：「不要一个总数量」） */
      var _cp2 = [];
      for (var _ck2 in (out.captives.byType || {})) {
        if (!out.captives.byType[_ck2]) continue;
        _cp2.push((DATA.TROOPS[_ck2] ? DATA.TROOPS[_ck2].name : (_ck2 === 'unknown' ? '来历不明' : _ck2))
          + ' ×' + U.numText(out.captives.byType[_ck2], 0));
      }
      lines.push('俘获 ' + U.numText(out.captives.gain, 0) + ' 众入营'
        + (_cp2.length ? '（' + _cp2.join('、') + '）' : '')
        + '　·　军务处·俘虏营可收编为民');
    }""",
     'state.js 守城战报俘虏明细')

# ---------------- 执行 ----------------
def main():
    files = {}
    for path, old, new, tag in EDITS:
        p = R + path
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
        s = files[p]
        n = s.count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次（要求 1）→ 中止' % (tag, n))
            return 1
        files[p] = s.replace(old, new, 1)
        print('  ✓ %s' % tag)
    bak = R + '.workbuddy/backup/v89116/'
    for p, s in files.items():
        b = io.open(bak + os.path.basename(p), encoding='utf-8').read()
        d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
            return 1
        tmp = p + '.tmp116d'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 D 完成')
    return 0


sys.exit(main())
