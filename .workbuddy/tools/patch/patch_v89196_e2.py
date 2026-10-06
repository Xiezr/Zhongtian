# -*- coding: utf-8 -*-
"""v89.196 批次E2：成就型收藏 —— 条件出口组 + 两段式闸（老板 7）
E2a domain.js 新增 COLLECT_COND_TYPES / collectCondValOf / collectCondOf / collectCondMetOf
E2b domain.js collectBuy 加解锁闸（未解锁不能激活）
E2c domain.js collectBuySeries 加"全解锁"预检"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- E2a 条件出口组（插在 collectItemOf 定义之前） ----------------
E2A_OLD = """  GAME.collectItemOf = function (id) {"""
E2A_NEW = """  /* ============================================================
   * v89.196（老板 7）：藏珍阁改**成就型** —— 「完成特定任务后可获得，
   *   但必须再花金币激活」。
   * ------------------------------------------------------------
   * 两段式：① **解锁**（条件达成，实时判定、不存档）
   *         ② **激活**（花金币 = 原 price → 入藏，仍是 s.collect 一份状态）。
   * 条件池：COLLECT_COND_TYPES（类型 → 显示名/单位）；取值唯一出口
   *   `collectCondValOf(type)`；件级展开唯一出口 `collectCondOf(itemId)`
   *   （系列级模板 cond { type, base, step }，件 n = base + step×件序；
   *     件级 `items[i].cond` 可覆盖模板）。
   * 全部取值来自**单调累计**（stats 计数 / 幂等计数）或明确可读的当前值 ——
   *   仅 rank/rep/lordLv/bldg 为现值（花掉会回落；条件文案写明当前进度）。
   * ============================================================ */
  GAME.COLLECT_COND_TYPES = {
    win: { name: '战斗胜场', unit: '场' },
    conquer: { name: '攻占告捷', unit: '次' },
    wild: { name: '占领野地', unit: '次' },
    gather: { name: '采集完成', unit: '次' },
    scout: { name: '侦察归来', unit: '次' },
    fort: { name: '设立前哨', unit: '处' },
    rank: { name: '爵位等级', unit: '级' },
    lordLv: { name: '君主等级', unit: '级' },
    bldg: { name: '官府等级', unit: '级' },
    rep: { name: '声望', unit: '' },
    itemKind: { name: '藏品种类', unit: '种' },
    recruited: { name: '招募将领', unit: '名' },
    trades: { name: '市易成交', unit: '次' },
    forged: { name: '打造装备', unit: '件' },
    trained: { name: '练兵总数', unit: '名' },
    buildDone: { name: '建成建筑', unit: '座' },
  };
  GAME.collectCondValOf = function (type) {
    var s = GAME.state;
    if (!s) return 0;
    switch (type) {
      case 'win': return GAME.stat('wins');
      case 'conquer': return GAME.stat('conquer');
      case 'wild': return GAME.stat('wilds');
      case 'gather': return GAME.stat('gathers');
      case 'scout': return GAME.stat('scouts');
      case 'fort': return GAME.stat('forts');
      case 'rank': return (s.rank || 0);
      case 'lordLv': var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null; return lg ? (lg.level || 1) : 0;
      case 'bldg': return GAME.questMetric ? GAME.questMetric('bldLevel', 'guanfu') : 0;
      case 'rep': return (s.rep || 0);
      case 'itemKind': return Object.keys(s.items || {}).length;
      case 'recruited': return GAME.stat('recruited');
      case 'trades': return GAME.stat('trades');
      case 'forged': return GAME.stat('forgedCount');
      case 'trained': return GAME.stat('trained');
      case 'buildDone': return GAME.stat('buildDone');
    }
    return 0;
  };
  GAME.collectCondOf = function (itemId) {
    var it = GAME.collectItemOf(itemId);
    if (!it) return null;
    var sr = null;
    ((DATA.COLLECT || {}).series || []).forEach(function (x) { if (x.id === it.seriesId) sr = x; });
    var cond = (it.cond || (sr && sr.cond)) || null;
    if (!cond || !cond.type) return null;
    var n = cond.n;
    if (n == null && sr) {
      var idx = -1;
      (sr.items || []).forEach(function (x, i) { if (x.id === itemId) idx = i; });
      n = (cond.base || 1) + Math.max(0, idx) * (cond.step || 0);
    }
    var meta = GAME.COLLECT_COND_TYPES[cond.type] || { name: cond.type, unit: '' };
    var cur = GAME.collectCondValOf(cond.type);
    return {
      type: cond.type, n: n, cur: cur, met: cur >= n,
      name: meta.name, unit: meta.unit,
      text: meta.name + ' ≥ ' + GAME.utils.fmt(n) + (meta.unit ? ' ' + meta.unit : ''),
    };
  };
  GAME.collectCondMetOf = function (itemId) {
    var cd = GAME.collectCondOf(itemId);
    return !cd || cd.met;                 /* 无条件的藏品（老档/扩展）一律视为已解锁 */
  };
  GAME.collectItemOf = function (id) {"""
rep('js/domain.js', 'E2a 条件出口组', E2A_OLD, E2A_NEW, 'GAME.collectCondMetOf = function (itemId) {')

# ---------------- E2b collectBuy 加闸 ----------------
E2B_OLD = """    s.collect = s.collect || {};
    if (s.collect[itemId]) return { ok: false, msg: '「' + it.name + '」已入藏' };
    if (GAME.goldOf() < it.price) {"""
E2B_NEW = """    s.collect = s.collect || {};
    if (s.collect[itemId]) return { ok: false, msg: '「' + it.name + '」已入藏' };
    /* v89.196（老板 7）：成就型 —— 未达成解锁条件不能激活（金币与条件双闸）。 */
    var _cd196 = GAME.collectCondOf(itemId);
    if (_cd196 && !_cd196.met) {
      return { ok: false, msg: '「' + it.name + '」尚未解锁：' + _cd196.text
        + '（当前 ' + U.fmt(_cd196.cur) + '）—— 达成条件后再花金激活' };
    }
    if (GAME.goldOf() < it.price) {"""
rep('js/domain.js', 'E2b collectBuy 闸', E2B_OLD, E2B_NEW, '_cd196 = GAME.collectCondOf(itemId);\n    if (_cd196 && !_cd196.met) {')

# ---------------- E2c collectBuySeries 全解锁预检 ----------------
E2C_OLD = """    var missing = (sr.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); });
    if (!missing.length) return { ok: false, msg: '「' + sr.name + '」已集齐' };
    var sum = 0;
    missing.forEach(function (it) { sum += it.price || 0; });
    if (GAME.goldOf() < sum) {"""
E2C_NEW = """    var missing = (sr.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); });
    if (!missing.length) return { ok: false, msg: '「' + sr.name + '」已集齐' };
    /* v89.196（老板 7）：一键集齐 = 逐件走 collectBuy（含解锁闸）——
       预检时把"未解锁"的件先列出来（不做半套）。 */
    var _locked196 = missing.filter(function (it) {
      var cd = GAME.collectCondOf(it.id);
      return cd && !cd.met;
    });
    if (_locked196.length) {
      var _c0 = GAME.collectCondOf(_locked196[0].id);
      return { ok: false, msg: '还有 ' + _locked196.length + ' 件未解锁（如「' + _locked196[0].name
        + '」：' + _c0.text + '，当前 ' + U.fmt(_c0.cur) + '）' };
    }
    var sum = 0;
    missing.forEach(function (it) { sum += it.price || 0; });
    if (GAME.goldOf() < sum) {"""
rep('js/domain.js', 'E2c 集齐闸', E2C_OLD, E2C_NEW, '_locked196 = missing.filter(function (it) {')

print('批次E2 完成')
