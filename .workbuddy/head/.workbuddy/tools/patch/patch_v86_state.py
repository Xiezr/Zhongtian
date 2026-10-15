# -*- coding: utf-8 -*-
"""v86 · 核心层（I）：state.js —— 计谋出口组 + invasion 接线（空城计/坚壁清野）。"""
import io
import sys

S = r'E:\Deepseekdb\js\state.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== C1. 计谋出口组（文件尾） ==')
patch(
    S,
    """    if (GAME.onLog) GAME.onLog(msg);
  };
})();""",
    """    if (GAME.onLog) GAME.onLog(msg);
  };

  /* ============================================================
   * v86（老板「按计划进行」· 第四轮 G1）：计谋 / 锦囊 —— 唯一出口组
   * ------------------------------------------------------------
   * 状态存储：`s.schemes = { [key]: { [sid]: { n, day, until } } }`
   *   · n     = 累计施计次数（挑拨离间：忠诚 = 100 − loyaltyDrop × n）
   *   · day   = 最近一次施计的游戏日（挑拨离间"对同一城每日限一次"）
   *   · until = 防御计到期时刻（游戏秒）
   * 运行中会被修改 → **入存档**（随 s 序列化）。
   * Key 规则（schemeKeyOf）：NPC 城 'npc:<id>'、据点 'fort:<id>'、
   *   野地 'w:x,y'；防御计布在自己城上，独立前缀 'my:<cityId>'。
   * 费用：精力扣在施计将领 gen.energy（与出征同一条链）；
   *   锦囊走 s.items.jinang（商城道具）。
   * ============================================================ */
  GAME.schemeOf = function (sid) {
    var list = DATA.SCHEMES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === sid) return list[i];
    return null;
  };

  GAME.schemeKeyOf = function (t) {
    if (!t) return '';
    if (t.npc && t.npc.id) return 'npc:' + t.npc.id;
    if (t.fort && t.fort.id) return 'fort:' + t.fort.id;
    return (t.kind === 'wild' ? 'w:' : 'c:') + (t.x | 0) + ',' + (t.y | 0);
  };

  GAME.schemeMarksOf = function (key, sid) {
    var s = GAME.state || {};
    var rec = (s.schemes || {})[key];
    var r = rec && rec[sid];
    return r ? (r.n || 0) : 0;
  };

  /* 校验（UI 选择时与出发时共用同一把尺）——只查"能不能施" */
  GAME.schemePrepare = function (sid, t, gen) {
    var s = GAME.state;
    var sc = GAME.schemeOf(sid);
    if (!sc) return { ok: false, msg: '未知计谋' };
    if (!gen) return { ok: false, msg: '需要主将施计' };
    if (sid === 'tiaobo' && t.kind === 'wild') {
      return { ok: false, msg: '野地无守将，挑拨离间无处施展' };
    }
    if ((gen.energy || 0) < sc.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服清心丸' };
    }
    var have = (s.items && s.items.jinang) || 0;
    if (have < sc.jinang) {
      return { ok: false, msg: '锦囊不足（' + have + '/' + sc.jinang + '），可在商城购买' };
    }
    if (sid === 'tiaobo') {
      var key = GAME.schemeKeyOf(t);
      var rec = (s.schemes || {})[key];
      var dayNow = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
      if (rec && rec[sid] && rec[sid].day === dayNow) {
        return { ok: false, msg: '今日已对该目标用过挑拨离间（每日限一次）' };
      }
    }
    return { ok: true, scheme: sc };
  };

  /* 施计：扣费 + 记标记（调用前请先走 schemePrepare） */
  GAME.schemeUse = function (sid, t, gen) {
    var s = GAME.state;
    var sc = GAME.schemeOf(sid);
    if (!sc || !gen) return null;
    gen.energy = Math.max(0, (gen.energy || 0) - sc.energy);
    s.items = s.items || {};
    s.items.jinang = (s.items.jinang || 0) - sc.jinang;
    if (s.items.jinang <= 0) delete s.items.jinang;
    var key = GAME.schemeKeyOf(t);
    s.schemes = s.schemes || {};
    var rec = s.schemes[key] = s.schemes[key] || {};
    var r = rec[sid] = rec[sid] || { n: 0 };
    r.n++;
    r.day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    GAME.log('🎴 ' + gen.name + ' 施展「' + sc.name + '」：' + sc.tip
      + '（精 −' + sc.energy + ' · 囊 −' + sc.jinang + '）');
    return r;
  };

  /* —— 防御计（布在自己城上，持续 durH 小时）—— */
  GAME.schemeDefOf = function (city, sid, now) {
    var s = GAME.state;
    if (!city) return null;
    now = now == null ? ((s.world && s.world.elapsed) || 0) : now;
    var rec = ((s.schemes || {})['my:' + city.id] || {})[sid];
    if (!rec || !rec.until || rec.until <= now) return null;
    var sc = GAME.schemeOf(sid);
    return sc ? { eff: sc.eff, until: rec.until, left: rec.until - now } : null;
  };

  GAME.schemeDefSet = function (city, sid, gen) {
    var s = GAME.state;
    var sc = GAME.schemeOf(sid);
    if (!sc || !city) return null;
    var now = (s.world && s.world.elapsed) || 0;
    if (gen) gen.energy = Math.max(0, (gen.energy || 0) - sc.energy);
    s.items = s.items || {};
    s.items.jinang = (s.items.jinang || 0) - sc.jinang;
    if (s.items.jinang <= 0) delete s.items.jinang;
    var key = 'my:' + city.id;
    s.schemes = s.schemes || {};
    var rec = s.schemes[key] = s.schemes[key] || {};
    rec[sid] = rec[sid] || { n: 0 };
    rec[sid].n++;
    rec[sid].until = now + sc.durH * 3600;
    GAME.log('🎴 布防「' + sc.name + '」于 ' + city.name + '：' + sc.tip
      + '（精 −' + sc.energy + ' · 囊 −' + sc.jinang + '）');
    return rec[sid];
  };

  /* 一次性消耗（空城计奏效时清除状态并返回 true） */
  GAME.schemeDefConsume = function (city, sid, now) {
    var act = GAME.schemeDefOf(city, sid, now);
    if (!act) return false;
    var s = GAME.state;
    var key = 'my:' + city.id;
    if (s.schemes && s.schemes[key] && s.schemes[key][sid]) {
      delete s.schemes[key][sid];
    }
    return true;
  };
})();""",
    'C1 scheme 出口组',
    probe='GAME.schemeDefConsume = function',
)

print()
print('== C2. invasionTick 空城计接线 ==')
patch(
    S,
    """      /* 离线可能一次跨过多个周期 —— 用 while 逐个结算，不许只判一次 */
      var guard = 0;
      while (city.inv.nextAt <= now && guard++ < 50) {
        var detail = GAME.invasionResolve(city);
        fired++;""",
    """      /* 离线可能一次跨过多个周期 —— 用 while 逐个结算，不许只判一次 */
      var guard = 0;
      while (city.inv.nextAt <= now && guard++ < 50) {
        /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；周期照常推进） */
        if (GAME.schemeDefConsume(city, 'kongcheng', now)) {
          GAME.log('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
          city.inv.nextAt += GAME.invasionIntervalSec();
          city.inv.warned = false;
          continue;
        }
        var detail = GAME.invasionResolve(city);
        fired++;""",
    'C2 空城计',
    probe='空城计奏效：敌军疑有伏兵',
)

print()
print('== C3. invasionResolve 坚壁清野接线 ==')
patch(
    S,
    """    var severity = held
      ? ratio * 0.35                                  // 守住：也折损，但不是零代价（否则"堆兵"成无脑解）
      : Math.max(0, (ratio - 0.5) * 2);               // 被破：ratio 刚过 0.5 时从 0 起""",
    """    var severity = held
      ? ratio * 0.35                                  // 守住：也折损，但不是零代价（否则"堆兵"成无脑解）
      : Math.max(0, (ratio - 0.5) * 2);               // 被破：ratio 刚过 0.5 时从 0 起
    /* v86：坚壁清野 —— 生效期内损失 −40%（severity 是唯一的损失总闸） */
    var _jb = GAME.schemeDefOf(city, 'jianbi', now);
    if (_jb) severity *= (1 - _jb.eff.invLossCut);""",
    'C3 坚壁清野',
    probe='坚壁清野 —— 生效期内损失',
)

print('== C4. 空城计读取 eff.invSkip（防死键） ==')
patch(
    S,
    """        /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；周期照常推进） */
        if (GAME.schemeDefConsume(city, 'kongcheng', now)) {
          GAME.log('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
          city.inv.nextAt += GAME.invasionIntervalSec();
          city.inv.warned = false;
          continue;
        }""",
    """        /* v86：空城计 —— 生效期内本次来犯不战而退（一次性消耗；周期照常推进）。
           显式读 eff.invSkip：效果键必须有字面读取点（防死数据，smoke §71 守）。 */
        var _kc = GAME.schemeDefOf(city, 'kongcheng', now);
        if (_kc && _kc.eff.invSkip) {
          GAME.schemeDefConsume(city, 'kongcheng', now);
          GAME.log('🎭 ' + city.name + ' 空城计奏效：敌军疑有伏兵，不战而退（计已用去）');
          city.inv.nextAt += GAME.invasionIntervalSec();
          city.inv.warned = false;
          continue;
        }""",
    'C4 invSkip',
    probe='_kc.eff.invSkip',
)

print()
print('全部完成。')
