# -*- coding: utf-8 -*-
# v89.158 补丁 E：smoke-test.js —— 7 处口径升级（削顶→不削 / storePartsOf / 新文案）
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

def rep(tag, old, new, guard=None):
    global s
    if guard and guard in s:
        done.append(tag + ' skip')
        return
    c = s.count(old)
    assert c == 1, tag + ' anchor count=' + str(c)
    s = s.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    done.append(tag + ' OK')

# ---------- U1：产量削顶 → 拆两条 ----------
rep('U1 削顶拆两条',
u"""  check('产量结算受储量上限约束', S20.res.grain <= G.storeCap(),
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCap()));""",
u"""  /* v89.158（老板 1）：口径拆两条 —— ① 已有存量**不被削**（改前超上限的 999,999
     会在下一 tick 被静默削回 cap）；② 自然增长仍受上限约束（不越过、到顶停涨）。 */
  check('超上限存量不被削（v89.158：只封增长、不砍已有）', S20.res.grain === overCap,
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCap()));
  S20.res.grain = Math.max(0, G.storeCap() - 100);
  G.tickOnce();
  check('自然增长受储量上限约束（不越过上限）',
    S20.res.grain <= G.storeCap() && S20.res.grain >= G.storeCap() - 100,
    U.fmt(S20.res.grain) + ' / ' + U.fmt(G.storeCap()));""",
guard=u'超上限存量不被削（v89.158')

# ---------- U2：黄金判据换形态 ----------
rep('U2 黄金形态',
u"""  check('#10 黄金不受仓库上限（三条结算路径均排除 gold）',
    (stS16.match(/rk2? !== 'gold'|k !== 'gold'/g) || []).length >= 2);""",
u"""  /* v89.158：口径从"排除 gold"改成"gold 分支放行"（只封增长不削存量）——
     三条结算路径（在线 tick / 离线 bulk / 离线溢出五折）都要有 gold 分支。 */
  check('#10 黄金不受仓库上限（三条结算路径均按 gold 分支放行 · v89.158 新形态）',
    (stS16.match(/=== 'gold'/g) || []).length >= 3);""",
guard=u'v89.158 新形态')

# ---------- U3：storeCap 求和来源升级 ----------
rep('U3 求和来源',
u"""  check('storeCap 按本城仓库等级求和（v60：资源归属城池，仓容跟着走）',
    /GAME\\.storeCapOf = function/.test(dS31)
    && /buildingLevelSum\\(city, 'cangku'\\)/.test(codeOf(dS31, 'GAME.storeCapOf = function'))
    /* storeCap 不再自己算一遍，只做"当前城"的转发 —— 一个概念一个取值口 */
    && /storeCapOf\\(GAME\\.currentCity\\(\\)\\)/.test(codeOf(dS31, 'GAME.storeCap = function')));""",
u"""  check('storeCap 按本城仓库等级求和（v60 · v89.158 拆账在 storePartsOf）',
    /GAME\\.storeCapOf = function/.test(dS31)
    && /buildingLevelSum\\(city, 'cangku'\\)/.test(codeOf(dS31, 'GAME.storePartsOf = function'))
    /* v89.158：storeCapOf 只做"取总值"的转发（一个概念一个取值口 → 分账口也只有一个） */
    && /storePartsOf\\(city\\)\\.total/.test(codeOf(dS31, 'GAME.storeCapOf = function'))
    && /storeCapOf\\(GAME\\.currentCity\\(\\)\\)/.test(codeOf(dS31, 'GAME.storeCap = function')));""",
guard=u'v89.158 拆账在 storePartsOf')

# ---------- U4：结构断言（仓储上限按城） ----------
rep('U4 结构按城',
u"""      && /cityBonusNum\\(city, 'storePct'\\)/.test(codeOf(dS, 'GAME.storeCapOf = function'));""",
u"""      /* v89.158：仓储加成随算式搬进 storePartsOf（拆账唯一出口） */
      && /cityBonusNum\\(city, 'storePct'\\)/.test(codeOf(dS, 'GAME.storePartsOf = function'));""",
guard=u"storePartsOf = function'));")

# ---------- U5：perk 消费点（带后续行，先于 U4 语义、但与 U4 不冲突） ----------
rep('U5 perk 消费点',
u"""      && /cityBonusNum\\(city, 'storePct'\\)/.test(codeOf(dS, 'GAME.storeCapOf = function'))
      && /cityBonusNum\\(city, 'buildSlot'\\)/.test(codeOf(dS, 'GAME.buildSlots = function'))""",
u"""      && /cityBonusNum\\(city, 'storePct'\\)/.test(codeOf(dS, 'GAME.storePartsOf = function'))
      && /cityBonusNum\\(city, 'buildSlot'\\)/.test(codeOf(dS, 'GAME.buildSlots = function'))""",
guard=u"codeOf(dS, 'GAME.storePartsOf = function'))\n      && /cityBonusNum\\(city, 'buildSlot'\\)")

# ---------- U6：§122② 纯加法形态 ----------
rep('U6 纯加法',
u"""      var hasAdd = /\\+ GAME\\.extStoreCapOf\\(city\\);/.test(do122)
        && /GAME\\.extStoreCapOf = function \\(city\\)/.test(do122);""",
u"""      /* v89.158：算式搬进 storePartsOf —— ext 仍为**纯加法**项（total = base + ext）；
         判据查"分账"源码形态，实测 cap === base + n 兜底（下方 return 里）。 */
      var hasAdd = /var ext = GAME\\.extStoreCapOf\\(city\\);/.test(do122)
        && /total: base \\+ ext/.test(do122)
        && /GAME\\.extStoreCapOf = function \\(city\\)/.test(do122);""",
guard=u'var ext = GAME\\.extStoreCapOf\\(city\\);')

# ---------- U7：仓库面板文案（假绿修正） ----------
rep('U7 面板文案',
u"""  check('仓库面板区分「本仓」与「全境」储量',
    /本仓储量/.test(uS31) && /全境储量上限/.test(uS31) && /多仓叠加/.test(uS31));""",
u"""  /* v89.158（老板 1）：文案升级 —— "本仓储量"改**本座**口径、"全境"改"本城"（v60 起按城），
     并加"分账"（悬停/仓库面板同读 GAME.storePartsOf）。 */
  check('仓库面板区分「本座」与「本城」储量（v89.158 口径）',
    /本座储量/.test(uS31) && /本城储量上限/.test(uS31) && /多仓叠加/.test(uS31));""",
guard=u'本座储量/.test(uS31)')

io.open(P, 'w', encoding='utf-8', newline='').write(s)

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'超上限存量不被削（v89.158') == 1
assert chk.count(u'v89.158 新形态') == 1
assert chk.count(u'v89.158 拆账在 storePartsOf') == 1
print('patch E done:', done, 'len', orig, '->', len(chk))
