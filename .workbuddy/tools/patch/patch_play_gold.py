# -*- coding: utf-8 -*-
"""v89.91：从 play_600x.js fork 出 play_gold_600x.js（黄金流对照驾驶舱）。
唯一差异 = 插入 GOLD 策略脑（gold_section.js）+ 若干策略参数调整。
其余行为与基线逐字一致（同一 SIM 时钟 / 同一地图 seed / 同一里程碑）。
"""
import io, sys

BASE = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_600x.js'
GOLD = r'E:\Deepseekdb\.workbuddy\tools\playtest\gold_section.js'
OUT  = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_gold_600x.js'

src = io.open(BASE, encoding='utf-8', newline='').read()
gold = io.open(GOLD, encoding='utf-8', newline='').read()

FIRST = '/* GOLD v1 */\n'
if src.startswith(FIRST):
    print('已经是 gold 版，跳过（幂等）')
    sys.exit(0)

def rep(old, new, tag, n=1):
    global src
    c = src.count(old)
    assert c == n, '锚点[%s] 命中 %d 次（预期 %d）' % (tag, c, n)
    src = src.replace(old, new, n)
    print('OK', tag)

# ── T1 头部 ──
rep(''' * play_600x.js — v89.90 「600× × 6h 全权限推演」驾驶舱''',
    ''' * play_gold_600x.js — v89.91 「黄金流对照推演」驾驶舱
 * （由 play_600x.js 基线 fork；唯一差异 = 新增 GOLD 策略脑：
 *   金换批招英杰 / 金买经验书喂将 / 用光自由点 / 金提速建造·科技·募兵 /
 *   全资源套现。其余段（建造/扩张/里程碑/战斗）与基线逐字一致。）''', 'T1a')
rep(' * 用法：node play_600x.js [ticks] [tag]',
    ' * 用法：node play_gold_600x.js [ticks] [tag]', 'T1b')

# ── T2 客栈自动招募门槛：良材 → 英杰（金换批策略的前提） ──
rep("st.settings.innAuto = { on: true, min: 'liang' };",
    "st.settings.innAuto = { on: true, min: 'ying' };", 'T2')

# ── T3 启动横幅 ──
rep("RUN('=== v89.90 600× 推演开始（HARNESS v2） ===');",
    "RUN('=== v89.91 黄金流对照推演开始（GOLD v1） ===');", 'T3')

# ── T4 插入 GOLD 策略脑（里程碑段之前） ──
rep('/* ---------- 6. 里程碑（可延后重试） ---------- */',
    gold + '\n/* ---------- 6. 里程碑（可延后重试） ---------- */', 'T4')

# ── T5 脑循环挂载 GOLD 模块 ──
rep('''    safeCall('b.autoMarch', manageAutoMarch);
    safeCall('b.milestones', execMilestones);''',
    '''    safeCall('b.autoMarch', manageAutoMarch);
    safeCall('b.goldSell', goldSell);
    safeCall('b.goldInn', goldInn);
    safeCall('b.goldBooks', goldBooks);
    safeCall('b.goldRush', goldRush);
    safeCall('b.goldTrainRush', goldTrainRush);
    safeCall('b.goldPoints', goldPoints);
    safeCall('b.goldGuards', goldGuards);
    safeCall('b.goldHerbs', goldHerbs);
    safeCall('b.goldNeigong', goldNeigong);
    safeCall('b.goldLord', goldLord);
    safeCall('b.milestones', execMilestones);''', 'T5')

# ── T6 快照加黄金流字段 ──
rep("    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');",
    '''    if (typeof GOLD !== 'undefined' && GOLD) {
      o.goldState = { rerolls: GOLD.rerolls, recruits: GOLD.recruits, books: GOLD.booksUsed,
        elites: eliteCount(), spend: GOLD.spends, sold: Math.round(GOLD.goldSold),
        sales: GOLD.salesCount, fp: Math.round(GOLD.freePts) };
      o.guards = st.cities.map(function (c) {
        var g = G.guardGeneralOf(c);
        return g ? { c: c.name, n: g.name, r: G.rankOf(g).name, lv: g.level, nz: guardNzOf(g) } : null;
      });
      o.genTop = (st.generals || []).slice().sort(function (a, b) { return (b.level || 1) - (a.level || 1); })
        .slice(0, 6).map(function (g) {
          var a = G.genAttrs(g) || {};
          return { n: g.name, r: G.rankOf(g).name, lv: g.level || 1,
            nz: Math.round(a.nz || 0), yw: Math.round(a.yw || 0), zm: Math.round(a.zm || 0),
            f: Math.round(g.freePts || 0) };
        });
      var ph = { grain: 0, wood: 0, stone: 0, iron: 0 };
      st.cities.forEach(function (c) { var ps = G.cityProdPerSec(c) || {}; for (var kk in ph) ph[kk] += (ps[kk] || 0); });
      o.prodH = { grain: Math.round(ph.grain * 3600), wood: Math.round(ph.wood * 3600) };
    }
    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');''', 'T6')

# ── T7 自动出征：等级上限更激进（强将+金提速下的军事收益） ──
rep('  var wantLv = y < 2 ? 2 : y < 5 ? 3 : y < 15 ? 4 : y < 40 ? 5 : 6;',
    '  var wantLv = y < 2 ? 2 : y < 5 ? 4 : y < 15 ? 6 : y < 40 ? 7 : 8;', 'T7')

# ── T8 民房配额 6 → 8（人口 = 兵源与税收的地基） ──
rep("{ bid: 'minfang', want: 6 }", "{ bid: 'minfang', want: 8 }", 'T8')

# ── T9 tryBuildNew：单城 → 全城（新城也要起骨架构 + 招贤馆席位） ──
rep('''function tryBuildNew() {
  var city = st.cities[0];
  var slots = G.buildSlots(city);
  for (var i = 0; i < BUILD_PRIO.length; i++) {
    var it = BUILD_PRIO[i];
    if (countBuild(city, it.bid) >= it.want) continue;
    if ((st.queues.build || []).length >= slots) return;
    var idx = emptyCell(city);
    if (idx < 0) return;
    setCity(city);
    var r = safeCall('build.' + it.bid, function () { return G.buildAt(city.id, idx, it.bid); });
    if (r && r.ok) { RUN('🏗 开建：' + it.bid + ' @格' + idx + '（队列 ' + st.queues.build.length + '/' + slots + '）'); continue; }
    if (r && !r.ok) {
      noteSoft('build.' + it.bid, r.msg);
      if (/同时只能|队列/.test(r.msg || '')) return;   /* 队列满 → 本轮停 */
      continue;                                        /* 前置/资源不符 → 试下一个（真人也是先建能建的） */
    }
  }
}''',
    '''function tryBuildNew() {
  st.cities.forEach(function (city) {
    var slots = G.buildSlots(city);
    for (var i = 0; i < BUILD_PRIO.length; i++) {
      var it = BUILD_PRIO[i];
      if (countBuild(city, it.bid) >= it.want) continue;
      if (G.buildQueueUsed(city.id) >= slots) return;
      var idx = emptyCell(city);
      if (idx < 0) return;
      setCity(city);
      var r = safeCall('build.' + city.name + '.' + it.bid, function () { return G.buildAt(city.id, idx, it.bid); });
      if (r && r.ok) { RUN('🏗 开建：' + city.name + ' ' + it.bid + ' @格' + idx); continue; }
      if (r && !r.ok) { noteSoft('build.' + city.name + '.' + it.bid, r.msg); continue; }
    }
  });
}''', 'T9')

# ── T10 进度行附黄金流状态 ──
rep('''      + ' · 将 ' + st.generals.length + ' · 日志 ' + (EVFLUSHED + EV.length) + ' · 错 ' + ERRN);
  }
  if (tNow % 2400 === 0) {''',
    '''      + ' · 将 ' + st.generals.length + ' · 日志 ' + (EVFLUSHED + EV.length) + ' · 错 ' + ERRN);
    RUN(goldLine());
  }
  if (tNow % 2400 === 0) {''', 'T10')

# ── T11 终局：黄金流汇总 + 将领盘面 + gold_final.json ──
rep('''RUN('=== 推演结束 ===');''',
    '''RUN(goldLine());
RUN('👥 将领前十：' + (st.generals || []).slice().sort(function (a, b) { return (b.level || 1) - (a.level || 1); }).slice(0, 10).map(function (g) {
  var a = G.genAttrs(g) || {};
  return g.name + '[' + G.rankOf(g).name + ']Lv' + g.level + '(nz' + Math.round(a.nz || 0) + '/yw' + Math.round(a.yw || 0) + ')';
}).join(' · '));
RUN('=== 推演结束 ===');''', 'T11a')
rep("try { fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(ERRLIST, null, 1)); } catch (e) {}",
    '''try { fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(ERRLIST, null, 1)); } catch (e) { noteErr('errors', e); }
try {
  fs.writeFileSync(path.join(OUT, 'gold_final.json'), JSON.stringify({
    gold: { spends: GOLD.spends, rerolls: GOLD.rerolls, recruits: GOLD.recruits, books: GOLD.booksUsed,
      sold: GOLD.goldSold, sales: GOLD.salesCount, freePts: GOLD.freePts, milestones: GOLD.milestones },
    guards: st.cities.map(function (c) { var g = G.guardGeneralOf(c); return g ? { c: c.name, g: g.name, r: G.rankOf(g).name, lv: g.level, nz: guardNzOf(g) } : null; }),
    gens: (st.generals || []).map(function (g) {
      var a = G.genAttrs(g) || {};
      return { n: g.name, r: G.rankOf(g).name, lv: g.level || 1, nz: Math.round(a.nz || 0), yw: Math.round(a.yw || 0),
        zm: Math.round(a.zm || 0), st: g.status || '', free: Math.round(g.freePts || 0), hero: !!g.hero };
    })
  }, null, 1));
} catch (e) { noteErr('gold.final', e); }''', 'T11b')

head = FIRST + '/* 生成自 play_600x.js（v89.91 黄金流 fork）；禁止手改基线副本。 */\n'
io.open(OUT, 'w', encoding='utf-8', newline='').write(head + src)
print('WROTE', OUT, len(head + src), 'bytes')
