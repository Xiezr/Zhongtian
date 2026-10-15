# -*- coding: utf-8 -*-
"""v89.194 批次F2：藏珍阁出口组（domain.js）"""
import io

R = 'E:/Deepseekdb/'
DOM = R + 'js/domain.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败'
    print('[ok] ' + tag)

F_OLD = """  /* 距下次岁贡结算的剩余现实毫秒 */"""
F_NEW = """  /* ============================================================
   * v89.194（老板 S3）：**藏珍阁**（收藏）—— 出口组
   * ------------------------------------------------------------
   * 数据：DATA.COLLECT.series[].items[]；状态 `s.collect = { 藏品id: 1 }`（随档）。
   *   · collectItemOf(id)        藏品定义（回填 seriesId / seriesName / icon）
   *   · collectHaveOf(id)        是否已入藏
   *   · collectSeriesDoneOf(sid) { have, total, done, rep, name }
   *   · collectStatOf()          全库 { have, total, seriesDone, seriesTotal }
   *   · collectBuy(itemId)       购买**唯一出口**（金池扣款 · 幂等 · 集齐奖声望 · 日志）
   *   · collectBuySeries(sid)    整系列一键集齐（预检总价 → 逐件走 collectBuy，同一出口）
   * 金价 = 数据表 price（**直接金价**，不走商城 ×100 体系）；金走唯一池（全境通用）。
   * 集齐奖励 = series[].rep（声望：爵位门槛与任务都读它）；全 18 系集齐另给 allRep
   * （幂等标记 s.collectAllBonus —— 与各系列奖励分账，不重复发放）。
   * ============================================================ */
  GAME.collectItemOf = function (id) {
    var C = DATA.COLLECT || {};
    var out = null;
    (C.series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) {
        if (it.id === id) out = { id: it.id, name: it.name, sub: it.sub || '', price: it.price || 0,
          seriesId: sr.id, seriesName: sr.name, icon: sr.icon || '🏺' };
      });
    });
    return out;
  };
  GAME.collectHaveOf = function (id) {
    var s = GAME.state;
    return !!(s && s.collect && s.collect[id]);
  };
  GAME.collectSeriesDoneOf = function (sid) {
    var C = DATA.COLLECT || {};
    var sr = null;
    (C.series || []).forEach(function (x) { if (x.id === sid) sr = x; });
    if (!sr) return { have: 0, total: 0, done: false, rep: 0, name: '' };
    var have = 0, total = (sr.items || []).length;
    (sr.items || []).forEach(function (it) { if (GAME.collectHaveOf(it.id)) have++; });
    return { have: have, total: total, done: total > 0 && have >= total, rep: sr.rep || 0, name: sr.name };
  };
  GAME.collectStatOf = function () {
    var C = DATA.COLLECT || {};
    var have = 0, total = 0, sd = 0;
    (C.series || []).forEach(function (sr) {
      var d = GAME.collectSeriesDoneOf(sr.id);
      have += d.have; total += d.total; if (d.done) sd++;
    });
    return { have: have, total: total, seriesDone: sd, seriesTotal: (C.series || []).length };
  };
  GAME.collectBuy = function (itemId) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '无游戏状态' };
    var it = GAME.collectItemOf(itemId);
    if (!it) return { ok: false, msg: '无此藏品' };
    s.collect = s.collect || {};
    if (s.collect[itemId]) return { ok: false, msg: '「' + it.name + '」已入藏' };
    if (GAME.goldOf() < it.price) {
      return { ok: false, msg: '金不足（需 ' + U.fmt(it.price) + '，现有 ' + U.fmt(GAME.goldOf()) + '）' };
    }
    GAME.goldAdd(-it.price);
    s.collect[itemId] = 1;
    GAME.log('🏺 藏珍阁：「' + it.name + '」入藏（金 −' + U.fmt(it.price) + '）', 'sys', 'trade');
    var d = GAME.collectSeriesDoneOf(it.seriesId);
    var gotRep = 0;
    if (d.done) {
      gotRep = d.rep;
      s.rep = (s.rep || 0) + gotRep;
      GAME.log('🏆 收藏系列「' + d.name + '」集齐！声望 +' + gotRep, 'sys', 'trade');
      if (GAME.story && GAME.story.chronicleAdd) {
        GAME.story.chronicleAdd('藏珍阁成系列「' + d.name + '」，士林传为佳话。', 'note');
      }
    }
    /* 全系列集齐的额外荣耀（幂等：s.collectAllBonus） */
    var allRep194 = 0;
    var stat = GAME.collectStatOf();
    if (stat.seriesTotal > 0 && stat.seriesDone >= stat.seriesTotal && !s.collectAllBonus) {
      s.collectAllBonus = 1;
      allRep194 = (DATA.COLLECT || {}).allRep || 0;
      if (allRep194) s.rep = (s.rep || 0) + allRep194;
      GAME.log('👑 藏珍阁全帙集齐（' + stat.seriesTotal + ' 系列 ' + stat.total + ' 件）！声望 +'
        + allRep194, 'sys', 'staff');
    }
    return { ok: true, item: it, seriesDone: d.done, rep: gotRep, allRep: allRep194 };
  };
  /* 整系列一键集齐：预检总价（不足即拒，不做半套）→ 逐件走同一出口 collectBuy */
  GAME.collectBuySeries = function (sid) {
    var C = DATA.COLLECT || {};
    var sr = null;
    (C.series || []).forEach(function (x) { if (x.id === sid) sr = x; });
    if (!sr) return { ok: false, msg: '无此系列' };
    var missing = (sr.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); });
    if (!missing.length) return { ok: false, msg: '「' + sr.name + '」已集齐' };
    var sum = 0;
    missing.forEach(function (it) { sum += it.price || 0; });
    if (GAME.goldOf() < sum) {
      return { ok: false, msg: '金不足：集齐「' + sr.name + '」尚需 ' + U.fmt(sum)
        + ' 金（现有 ' + U.fmt(GAME.goldOf()) + '）' };
    }
    var n = 0;
    missing.forEach(function (it) { var r = GAME.collectBuy(it.id); if (r.ok) n++; });
    return { ok: true, bought: n, cost: sum };
  };

  /* 距下次岁贡结算的剩余现实毫秒 */"""
rep(DOM, 'F2 收藏出口组', F_OLD, F_NEW, 'GAME.collectBuySeries = function (sid) {')

print('\n批次 F2 完成。')
