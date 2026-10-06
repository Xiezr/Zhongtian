# -*- coding: utf-8 -*-
# v89.212：测试升级（规则变更的连带断言按 §0.7 重写）+ §212 新段（smoke + e2e）
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

SM = 'E:/Deepseekdb/smoke-test.js'

# ---------------- G1: 5495 源码断言升级 ----------------
rep(SM, 'G1 storeCapOf 源码断言升级',
    """  check('storeCap 按本城仓库等级求和（v60 · v89.158 拆账在 storePartsOf）',
    /GAME\\.storeCapOf = function/.test(dS31)
    && /buildingLevelSum\\(city, 'cangku'\\)/.test(codeOf(dS31, 'GAME.storePartsOf = function'))
    /* v89.158：storeCapOf 只做"取总值"的转发（一个概念一个取值口 → 分账口也只有一个） */
    && /storePartsOf\\(city\\)\\.total/.test(codeOf(dS31, 'GAME.storeCapOf = function'))
    && /storeCapOf\\(GAME\\.currentCity\\(\\)\\)/.test(codeOf(dS31, 'GAME.storeCap = function')));""",
    """  check('storeCap 按本城仓库等级求和（v60 · v89.158 拆账在 storePartsOf · v89.212 按资源带 key）',
    /GAME\\.storeCapOf = function/.test(dS31)
    && /buildingLevelSum\\(city, 'cangku'\\)/.test(codeOf(dS31, 'GAME.storePartsOf = function'))
    /* v89.212（老板 1）：storeCapOf 带 key（按资源分账）—— 转发形态 = sp + 按 key 取 capByRes
       （规则变更：原"取总值 total"升级为"按资源取值，不带 key 才回落合计"）。 */
    && /var sp = GAME\\.storePartsOf\\(city\\)/.test(codeOf(dS31, 'GAME.storeCapOf = function'))
    && /sp\\.capByRes\\[key\\]/.test(codeOf(dS31, 'GAME.storeCapOf = function'))
    && /storeCapOf\\(GAME\\.currentCity\\(\\)\\)/.test(codeOf(dS31, 'GAME.storeCap = function')));""",
    "&& /sp\\.capByRes\\[key\\]/.test(codeOf(dS31, 'GAME.storeCapOf = function'))")

# ---------------- G2: 仓库段 tick 封顶断言改按资源 ----------------
rep(SM, 'G2 仓库段按资源口径',
    """  var overCap = G.storeCap() + 999999;
  S20.res.grain = overCap;
  G.tickOnce();
  /* v89.158（老板 1）：口径拆两条 —— ① 已有存量**不被削**（改前超上限的 999,999
     会在下一 tick 被静默削回 cap）；② 自然增长仍受上限约束（不越过、到顶停涨）。 */
  check('超上限存量不被削（v89.158：只封增长、不砍已有）', S20.res.grain === overCap,
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCap()));
  S20.res.grain = Math.max(0, G.storeCap() - 100);
  G.tickOnce();
  check('自然增长受储量上限约束（不越过上限）',
    S20.res.grain <= G.storeCap() && S20.res.grain >= G.storeCap() - 100,
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCap()));""",
    """  /* v89.212（老板 1）：两项均改**粮自己的**上限口径（城外堆场按资源分账）——
     全城"合计上限"不再是任何资源的封顶尺度（规则变更所致）。 */
  var overCap = G.storeCapOf(G.currentCity(), 'grain') + 999999;
  S20.res.grain = overCap;
  G.tickOnce();
  /* v89.158（老板 1）：口径拆两条 —— ① 已有存量**不被削**（改前超上限的 999,999
     会在下一 tick 被静默削回 cap）；② 自然增长仍受上限约束（不越过、到顶停涨）。 */
  check('超上限存量不被削（v89.158：只封增长、不砍已有）', S20.res.grain === overCap,
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCapOf(G.currentCity(), 'grain')));
  S20.res.grain = Math.max(0, G.storeCapOf(G.currentCity(), 'grain') - 100);
  G.tickOnce();
  check('自然增长受储量上限约束（不越过上限）',
    S20.res.grain <= G.storeCapOf(G.currentCity(), 'grain')
    && S20.res.grain >= G.storeCapOf(G.currentCity(), 'grain') - 100,
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCapOf(G.currentCity(), 'grain')));""",
    "G.storeCapOf(G.currentCity(), 'grain') + 999999")

# ---------------- G3: §156 行序（老板令重排） ----------------
rep(SM, 'G3 §156 行序升级',
    """    var idx = ['exp-a-tactic', 'exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-items']
      .map(function (k) { return exp.indexOf(k, q); });""",
    """    /* v89.212（老板 2）：行序按老板令重排 —— 目标 → 主将 → 出征方式 → 方案 → 战术 →
       计略 → 可用道具（计略块自「出征方式」前移至「出征战术」之后）。 */
    var idx = ['exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic', 'exp-a-items']
      .map(function (k) { return exp.indexOf(k, q); });""",
    "var idx = ['exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic', 'exp-a-items']")

rep(SM, 'G3b §156 标题升级',
    "  check('v89.156/v89.200：出征四块**逐行**（单列）+ 可用道具紧随其后（预估 v89.200 移左列下方 · 原 v89.66 2×2 退役）'",
    "  check('v89.156/v89.200/v89.212：出征四块**逐行**（单列 · 行序=目标→主将→出征方式→方案→战术→计略→可用道具）+ 可用道具紧随其后'",
    'v89.156/v89.200/v89.212：出征四块**逐行**')

# ---------------- G4: §122②/§148 hasAdd 升级 ----------------
rep(SM, 'G4 hasAdd 升级',
    """      var hasAdd = /var ext = GAME\\.extStoreCapOf\\(city\\);/.test(do122)
        && /total: base \\+ ext/.test(do122)
        && /GAME\\.extStoreCapOf = function \\(city\\)/.test(do122);""",
    """      var hasAdd = /var ext = GAME\\.extStoreCapOf\\(city\\);/.test(do122)
        && /total: base \\+ ext/.test(do122)
        /* v89.212（老板 1）：按资源分账 —— 签名带 key（city, key）+ byRes 底账在册 */
        && /GAME\\.extStoreCapOf = function \\(city, key\\)/.test(do122)
        && /GAME\\.extStoreCapByResOf = function \\(city\\)/.test(do122);""",
    "GAME\\.extStoreCapByResOf = function \\(city\\)/.test(do122)")

# ---------------- G5: §155⑤ 文案升级 ----------------
rep(SM, 'G5 §155⑤ 文案升级',
    """    check('§155⑤ 单块堆场出口（lv×BASE/DIV）· 面板「另加仓储上限」· 悬停「其中城外堆场」· tip 无 undefined', (function () {""",
    """    check('§155⑤ 单块堆场出口（lv×BASE/DIV）· 面板「另加<归属资源>上限」（v89.212 分账）· tip 无 undefined', (function () {""",
    '§155⑤ 单块堆场出口（lv×BASE/DIV）· 面板「另加<归属资源>上限」')

rep(SM, 'G5b §155⑤ 断言体升级',
    """      return one === expect && G.extStoreCapOneOf({ type: null, lv: 0 }) === 0
        && html.indexOf('另加仓储上限') >= 0 && html.indexOf(U.fmt(one)) >= 0
        && u155.indexOf('其中城外堆场 +') >= 0
        && u155.indexOf("'｜每级另加仓储上限 +'") >= 0
        && DATA.EXT_BUILDINGS.quarry.desc === '凿山取石，石料产地';""",
    """      return one === expect && G.extStoreCapOneOf({ type: null, lv: 0 }) === 0
        /* v89.212（老板 1）：面板标签按归属资源（石场 → 「另加石料上限」）；
           悬停分解行改「· 城外堆场（本类地块）：+」；选建悬停按类型动态映射资源名。 */
        && html.indexOf('另加石料上限') >= 0 && html.indexOf(U.fmt(one)) >= 0
        && u155.indexOf('· 城外堆场（本类地块）：+') >= 0
        && u155.indexOf("'｜每级另加' + (_rnB || '资源') + '上限 +'") >= 0
        && DATA.EXT_BUILDINGS.quarry.desc === '凿山取石，石料产地';""",
    "html.indexOf('另加石料上限') >= 0")

# ---------------- G6: §158① 容量悬停文案 ----------------
rep(SM, 'G6 §158① 悬停文案升级',
    """      return /基础储量：/.test(seg) && /· 城外堆场：\\+/.test(seg)
        && /'已满' : '已占 ' \\+ _pct/.test(seg)
        && seg.indexOf('var extCap') < 0;   /* 旧变量整条不再存在（负向：查变量声明形态） */""",
    """      return /基础储量：/.test(seg) && /· 城外堆场（本类地块）：\\+/.test(seg)   /* v89.212：按资源分账文案 */
        && /'已满' : '已占 ' \\+ _pct/.test(seg)
        && seg.indexOf('var extCap') < 0;   /* 旧变量整条不再存在（负向：查变量声明形态） */""",
    '· 城外堆场（本类地块）：\\+/')

# ---------------- G7: §158① 离线按资源 ----------------
rep(SM, 'G7 §158① 离线按资源',
    """      var st = G.state, c = st.cities[0];
      var cap = G.storeCapOf(c);
      var bk = st.res.stone || 0;
      var over = cap + 500000;""",
    """      var st = G.state, c = st.cities[0];
      var cap = G.storeCapOf(c, 'stone');   /* v89.212（老板 1）：按资源上限（堆场分账） */
      var bk = st.res.stone || 0;
      var over = cap + 500000;""",
    "storeCapOf(c, 'stone')")

print('--- G1-G7 完成 ---')
