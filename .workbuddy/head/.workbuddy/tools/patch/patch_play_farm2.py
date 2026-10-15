# -*- coding: utf-8 -*-
"""生成 play_farm2_600x.js：与 play_gold_600x.js 逐字同骨架，
唯一差异 = 移除 GOLD 策略脑（含调用/快照字段/终局汇总），
客栈门槛还原为基线口径（'liang'）。
用途：黄金流 vs 对照基线的受控 A/B（同 seed、同里程碑、同节奏参数）。
"""
import io, re, sys

SRC = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_gold_600x.js'
OUT = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_farm2_600x.js'

s = io.open(SRC, encoding='utf-8', newline='').read()

if s.startswith('/* FARM2'):
    print('已是 farm2 版，跳过'); sys.exit(0)

def cut(a, b, tag):
    """删除 [a, b) 之间的内容（按唯一子串定位）"""
    global s
    i = s.find(a)
    assert i >= 0, '找不到起点[%s]' % tag
    j = s.find(b, i)
    assert j > i, '找不到终点[%s]' % tag
    s = s[:i] + s[j:]
    print('CUT', tag, j - i, 'chars')

def rep(old, new, tag, n=1):
    global s
    c = s.count(old)
    assert c == n, '锚点[%s] 命中 %d 次（预期 %d）' % (tag, c, n)
    s = s.replace(old, new, n)
    print('OK', tag)

# ① 头部改名
rep(''' * play_gold_600x.js — v89.91 「黄金流对照推演」驾驶舱''',
    ''' * play_farm2_600x.js — v89.91 「基线对照推演（无黄金脑）」驾驶舱
 * （由 play_gold_600x.js 剥离 GOLD 策略脑生成；与黄金流逐字同骨架，
 *   用于受控 A/B：同 seed / 同里程碑 / 同节奏参数，仅少"金消费"一侧。）''', 'H1')
rep(' * 用法：node play_gold_600x.js [ticks] [tag]',
    ' * 用法：node play_farm2_600x.js [ticks] [tag]', 'H2')
rep("RUN('=== v89.91 黄金流对照推演开始（GOLD v1） ===');",
    "RUN('=== v89.91 基线对照推演开始（FARM2 · 无黄金脑） ===');", 'H3')
rep("/* GOLD v1 */\n", "/* FARM2 */\n", 'H0')

# ② 客栈门槛还原（无金换批时，'ying' 会导致几乎不招人）
rep("st.settings.innAuto = { on: true, min: 'ying' };",
    "st.settings.innAuto = { on: true, min: 'liang' };", 'H4')

# ③ 剥离 GOLD 策略脑整段（从 banner 起，到里程碑段前）
i = s.find('v89.91 GOLD 策略脑')
assert i > 0, '找不到 GOLD 段'
i = s.rfind('/* ============================================================', 0, i)
j = s.find('/* ---------- 6. 里程碑（可延后重试） ---------- */', i)
assert i > 0 and j > i, ('段定位失败', i, j)
s = s[:i] + s[j:]
print('CUT GOLD 段', j - i, 'chars')

# ④ 调用块还原
rep('''    safeCall('b.autoMarch', manageAutoMarch);
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
    safeCall('b.milestones', execMilestones);''',
    '''    safeCall('b.autoMarch', manageAutoMarch);
    safeCall('b.milestones', execMilestones);''', 'C1')

# ⑤ 快照黄金字段剥离
i = s.find("    if (typeof GOLD !== 'undefined' && GOLD) {")
assert i > 0, '快照块定位失败'
j = s.find("    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');", i)
assert j > i, '快照块尾定位失败'
s = s[:i] + s[j:]
print('CUT 快照块', j - i, 'chars')

# ⑥ goldLine 调用剥离（进度行 + 终局）
rep('''      + ' · 将 ' + st.generals.length + ' · 日志 ' + (EVFLUSHED + EV.length) + ' · 错 ' + ERRN);
    RUN(goldLine());
  }
  if (tNow % 2400 === 0) {''',
    '''      + ' · 将 ' + st.generals.length + ' · 日志 ' + (EVFLUSHED + EV.length) + ' · 错 ' + ERRN);
  }
  if (tNow % 2400 === 0) {''', 'C2')
rep('''RUN(goldLine());
RUN('👥 将领前十：''', 'RUN(\'👥 将领前十：', 'C3')

# ⑦ gold_final.json 写入剥离
i = s.find("try {\n  fs.writeFileSync(path.join(OUT, 'gold_final.json')")
assert i > 0, 'gold_final 块定位失败'
j = s.find("} catch (e) { noteErr('gold.final', e); }", i)
assert j > i, 'gold_final 块尾定位失败'
j = s.find('\n', j) + 1
s = s[:i] + s[j:]
print('CUT gold_final 块', j - i, 'chars')

# ⑧ 补产量/将领快照（farm2 也记录 prodH —— 受控对照需要产量曲线）
rep("    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');",
    '''    var phF = { grain: 0, wood: 0, stone: 0, iron: 0 };
    st.cities.forEach(function (c) { var ps = G.cityProdPerSec(c) || {}; for (var kk in phF) phF[kk] += (ps[kk] || 0); });
    o.prodH = { grain: Math.round(phF.grain * 3600), wood: Math.round(phF.wood * 3600) };
    o.genTop = (st.generals || []).slice().sort(function (a, b) { return (b.level || 1) - (a.level || 1); }).slice(0, 6).map(function (g) {
      var a = G.genAttrs(g) || {};
      return { n: g.name, r: G.rankOf(g).name, lv: g.level || 1, nz: Math.round(a.nz || 0), yw: Math.round(a.yw || 0), zm: Math.round(a.zm || 0) };
    });
    o.guards = st.cities.map(function (c) {
      var g = G.guardGeneralOf(c);
      return g ? { c: c.name, n: g.name, r: G.rankOf(g).name, lv: g.level, nz: Math.round((G.genAttrs(g) || {}).nz || 0) } : null;
    });
    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');''', 'F-prodH')

assert 'GOLD = {' not in s and 'goldSell' not in s and 'goldLine' not in s, '仍有 GOLD 代码残留'

io.open(OUT, 'w', encoding='utf-8', newline='').write(s)
print('WROTE', OUT, len(s), 'bytes')
