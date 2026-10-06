# -*- coding: utf-8 -*-
"""v89.196 批次F：旧断言适配新机制（5 条红单）
F1 灵淬两条按新口径重写（升档=重演+灵淬+奖励叠加，只增不减）
F2 §194④ 三条造局补"全解锁"（新增 unlockCol196 工具）"""
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

# ---------------- F1a：四维各 +2 重写 ----------------
F1A_OLD = """    check('实测：凡品用蕴灵草 → 良材，四维各 +2 且计数 ascend=1', (function () {
      var g = st78.generals[0];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong, y0 = g.yw, z0 = g.zm, n0 = g.nz;
      st78.items['yunlingcao'] = 1;
      var r = G.systems.useItem('yunlingcao', g.id);
      return r.ok && g.rank === 'liang'
        && g.tong === t0 + 2 && g.yw === y0 + 2 && g.zm === z0 + 2 && g.nz === n0 + 2 && g.ascend === 1;
    })());"""
F1A_NEW = """    check('实测（v89.196 规则变更）：凡品用蕴灵草 → 良材，四维至少 +2（灵淬）+ 数值奖励叠加 · ascend=1', (function () {
      var g = st78.generals[0];
      g.rank = 'fan'; g.ascend = 0;
      /* v89.196（老板 1）：升档 = **等级重演补齐**（GAME.rankUpUse）＋ 灵淬 ascend ＋
         数值奖励（DATA.RANKUP_AWARD）三者叠加 —— 旧判据"恰好 +2"升级为
         "只增不减且至少含灵淬与奖励"（重演可能再高）。 */
      var t0 = g.tong, y0 = g.yw, z0 = g.zm, n0 = g.nz;
      st78.items['yunlingcao'] = 1;
      var r = G.systems.useItem('yunlingcao', g.id);
      var aw = (DATA.RANKUP_AWARD || {}).liang || 0;
      return r.ok && g.rank === 'liang'
        && g.tong >= t0 + 2 + aw && g.yw >= y0 + 2 + aw && g.zm >= z0 + 2 + aw && g.nz >= n0 + 2 + aw
        && g.ascend === 1;
    })());"""
rep('smoke-test.js', 'F1a 灵淬+2 重写', F1A_OLD, F1A_NEW, '旧判据"恰好 +2"升级为')

# ---------------- F1b：全链 +18 重写 ----------------
F1B_OLD = """    check('实测：全链走完（凡→良→英→名→天）四维各 +18（2+3+5+8）、计数 4', (function () {
      var g = st78.generals[1];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong;
      /* v89.95（A1）：顶档（名→天）**需节钺**（黄金买不到）—— 这条链要备一枚 */
      st78.jieyue = (st78.jieyue || 0) + 1;
      [['yunlingcao', 'liang'], ['xisuizhi', 'ying'], ['hualongshen', 'ming'], ['tianshouguo', 'tian']].forEach(function (pair) {
        st78.items[pair[0]] = 1;
        G.systems.useItem(pair[0], g.id);
      });
      return g.rank === 'tian' && g.tong === t0 + 18 && g.ascend === 4 && G.jieyueOf() === 0;
    })());"""
F1B_NEW = """    check('实测（v89.196 规则变更）：全链走完（凡→良→英→名→天）四维只增不减（灵淬 18 + 重演 + 奖励 1500 全叠加）、计数 4', (function () {
      var g = st78.generals[1];
      g.rank = 'fan'; g.ascend = 0;
      var t0 = g.tong;
      /* v89.95（A1）：顶档（名→天）**需节钺**（黄金买不到）—— 这条链要备一枚 */
      st78.jieyue = (st78.jieyue || 0) + 1;
      [['yunlingcao', 'liang'], ['xisuizhi', 'ying'], ['hualongshen', 'ming'], ['tianshouguo', 'tian']].forEach(function (pair) {
        st78.items[pair[0]] = 1;
        G.systems.useItem(pair[0], g.id);
      });
      /* v89.196：旧"四维各 +18"（纯学淬）已升级 —— 重演补齐与累计奖励
         （100+200+400+800=1500）叠加 → 判据改为"到天授 + 只增不减 + 计数 4"。 */
      return g.rank === 'tian' && g.tong >= t0 + 18 && g.ascend === 4 && G.jieyueOf() === 0;
    })());"""
rep('smoke-test.js', 'F1b 全链+18 重写', F1B_OLD, F1B_NEW, '旧"四维各 +18"（纯学淬）已升级')

# ---------------- F2a：§194 段加工具 ----------------
F2A_OLD = """    var dS194 = rd194('domain.js'), uS194 = rd194('ui.js'), mS194 = rd194('main.js');
    var hS194 = fs194.readFileSync(p194.join(__dirname, 'index.html'), 'utf8');"""
F2A_NEW = """    var dS194 = rd194('domain.js'), uS194 = rd194('ui.js'), mS194 = rd194('main.js');
    var hS194 = fs194.readFileSync(p194.join(__dirname, 'index.html'), 'utf8');
    /* v89.196（老板 7）：藏珍阁改成就型 —— 旧"直购"用例的造局要先把
       全部条件类型拉满（解锁所有藏品），否则会被解锁闸正确拦下。 */
    var unlockCol196 = function (st) {
      st.stats = { wins: 999, conquer: 999, wilds: 999, gather: 999, scouts: 999, forts: 999,
        recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };
      st.rep = 99999; st.rank = 9;
      var lg = G.lordGeneralOf();
      if (lg) lg.level = 300;
      (st.cities[0].cells || []).forEach(function (cell) {
        if (cell.build && cell.build.id === 'guanfu') cell.build.lvl = 12;
      });
      st.items = st.items || {};
      (DATA.ITEMS || []).slice(0, 8).forEach(function (it) { st.items[it.id] = (st.items[it.id] || 0) + 1; });
    };"""
rep('smoke-test.js', 'F2a unlockCol196 工具', F2A_OLD, F2A_NEW, 'var unlockCol196 = function (st) {')

# ---------------- F2b/c/d：三条断言加造局 ----------------
F2B_OLD = """      var st = G.newGame({ name: 'v194col', cityName: '许都' });
      G.state = st;
      try {
        var it1 = DATA.COLLECT.series[0].items[0];"""
F2B_NEW = """      var st = G.newGame({ name: 'v194col', cityName: '许都' });
      G.state = st;
      try {
        unlockCol196(st);                                /* v89.196：先解锁（成就型） */
        var it1 = DATA.COLLECT.series[0].items[0];"""
rep('smoke-test.js', 'F2b 购买造局', F2B_OLD, F2B_NEW, "unlockCol196(st);                                /* v89.196：先解锁（成就型） */")

F2C_OLD = """      var st = G.newGame({ name: 'v194col2', cityName: '许都' });
      G.state = st;
      try {
        G.goldAdd(5e7);
        var sr = DATA.COLLECT.series[0];"""
F2C_NEW = """      var st = G.newGame({ name: 'v194col2', cityName: '许都' });
      G.state = st;
      try {
        unlockCol196(st);                                /* v89.196：先解锁（成就型） */
        G.goldAdd(5e7);
        var sr = DATA.COLLECT.series[0];"""
rep('smoke-test.js', 'F2c 集齐造局', F2C_OLD, F2C_NEW, "unlockCol196(st);                                /* v89.196：先解锁（成就型） */\n        G.goldAdd(5e7);")

F2D_OLD = """      var st = G.newGame({ name: 'v194col3', cityName: '许都' });
      G.state = st;
      try {
        var sr = DATA.COLLECT.series[1];"""
F2D_NEW = """      var st = G.newGame({ name: 'v194col3', cityName: '许都' });
      G.state = st;
      try {
        unlockCol196(st);                                /* v89.196：先解锁（成就型） */
        var sr = DATA.COLLECT.series[1];"""
rep('smoke-test.js', 'F2d 一键集齐造局', F2D_OLD, F2D_NEW, "unlockCol196(st);                                /* v89.196：先解锁（成就型） */\n        var sr = DATA.COLLECT.series[1];")

print('批次F 完成')
