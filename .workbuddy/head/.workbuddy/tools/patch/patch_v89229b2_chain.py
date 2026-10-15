# -*- coding: utf-8 -*-
# v89.229 批 b2：questdata / ui / state / battle / domain / index.html —— 资源换代文案全链
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    tmp = BASE + p + '.tmp229b2'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)
def rep1(p, pairs):
    s = rd(p); s0 = s
    for old, new, tag in pairs:
        c = s.count(old)
        assert c == 1, '[%s|%s] count=%d' % (p, tag, c)
        s = s.replace(old, new)
    assert s != s0
    if not DRY:
        wr(p, s)
        print('[OK] %s %d 处' % (p, len(pairs)))
    else:
        print('[DRY] %s %d 处命中' % (p, len(pairs)))

# ========== ① questdata.js ==========
rep1('js/questdata.js', [
    ("{ id: 'g04', title: '开垦荒亩', desc: '军未动，粮先行。', guide: '「城外」建集水场 2 块。',",
     "{ id: 'g04', title: '洁水之始', desc: '兵未动，水先行。', guide: '「城外」建净化厂 2 块。',", 'g04'),
    ("{ id: 'g05', title: '阡陌纵横', desc: '田连阡陌，仓廪可期。', guide: '集水场累计 6 块。',",
     "{ id: 'g05', title: '涓流成渠', desc: '细流汇渠，积少成多。', guide: '净化厂累计 6 块。',", 'g05'),
    ("{ id: 'g06', title: '木石之资', desc: '营建需木石，先备其材。', guide: '复合材料场 1 块、碎石场 1 块。',",
     "{ id: 'g06', title: '资材之始', desc: '营建需资材，先备其源。', guide: '水培温室 1 块、发电站 1 块。',", 'g06'),
    ("{ id: 'g08', title: '冶铁成钢', desc: '铁者，兵之骨也。', guide: '建废铁场 2 块。',",
     "{ id: 'g08', title: '熔旧成钢', desc: '钢者，兵之骨也。', guide: '建电弧熔炉 2 块。',", 'g08'),
    ("{ id: 'g10', title: '精耕细作', desc: '八块集水场，十级之属。', guide: '集水场中有 1 块升至 Lv5。',",
     "{ id: 'g10', title: '精益求精', desc: '八座净化厂，十级之属。', guide: '净化厂中有 1 块升至 Lv5。',", 'g10'),
    ("{ id: 'g48', title: '武备充盈', desc: '铁积如山，兵甲充足。', guide: '废铁存量达 300000。',",
     "{ id: 'g48', title: '武备充盈', desc: '钢积如山，兵甲充足。', guide: '废钢存量达 300000。',", 'g48'),
    ("{ id: 'r19', title: '垦荒拓田', type: 'build', desc: '田多则粮足。', metric: 'extCount', sub: 'farm', goal: 2,",
     "{ id: 'r19', title: '洁水固本', type: 'build', desc: '厂多则水足。', metric: 'extCount', sub: 'farm', goal: 2,", 'r19'),
    ("{ id: 'r20', title: '开山取石', type: 'build', desc: '碎石为营建之本。', metric: 'extCount', sub: 'quarry', goal: 1,",
     "{ id: 'r20', title: '开山蓄能', type: 'build', desc: '电能，机械之本。', metric: 'extCount', sub: 'quarry', goal: 1,", 'r20'),
    ("{ id: 'r21', title: '伐木成材', type: 'build', desc: '林木为宫室之资。', metric: 'extCount', sub: 'forest', goal: 1,",
     "{ id: 'r21', title: '育种成材', type: 'build', desc: '温室育材，生资之本。', metric: 'extCount', sub: 'forest', goal: 1,", 'r21'),
    ("{ id: 'r22', title: '凿矿冶铁', type: 'build', desc: '铁者，兵之本也。', metric: 'extCount', sub: 'mine', goal: 1,",
     "{ id: 'r22', title: '电弧重铸', type: 'build', desc: '钢者，兵之本也。', metric: 'extCount', sub: 'mine', goal: 1,", 'r22'),
])

# ========== ② ui.js ==========
rep1('js/ui.js', [
    ("  ui.RES_NAME = { grain: '粮', wood: '木', stone: '石', iron: '铁', gold: '金' };",
     "  ui.RES_NAME = { grain: '水', wood: '生', stone: '电', iron: '钢', gold: '金' };   /* v89.229：随资源换代（净水/生物质/电能/废钢） */", 'resname'),
    ("  ui.RES_ICON = { grain: '🌾', wood: '🪵', stone: '⛰️', iron: '🔩', gold: '💰' };",
     "  ui.RES_ICON = { grain: '💧', wood: '🌿', stone: '⚡', iron: '🔩', gold: '💰' };   /* v89.229：随资源换代 */", 'resicon'),
    ("         （净水 = 货仓 + 集水场堆场 / 木料 = 货仓 + 林场堆场……「地块多的存的多」）。 */",
     "         （净水 = 货仓 + 净化厂堆场 / 生物质 = 货仓 + 温室堆场……「地块多的存的多」）。 */", 'note1'),
    ("                + '（集水场堆粮 / 林场堆木 / 石场堆石 / 矿场堆铁 · 不吃仓储加成）')",
     "                + '（净化厂堆水 / 温室堆生物质 / 电站堆电能 / 熔炉堆废钢 · 不吃仓储加成）')", 'note2'),
    ("      /* v89.212（老板 1）：堆场按资源分账 —— 悬停写明\"本类资源\"（集水场→净水上限 / 林场→木料上限…） */",
     "      /* v89.212（老板 1）：堆场按资源分账 —— 悬停写明\"本类资源\"（净化厂→净水上限 / 温室→生物质上限…） */", 'note3'),
])

# ========== ③ state.js ==========
rep1('js/state.js', [
    ("   * 按 集水场 → 木料场 → 碎石场 → 废铁场 轮转铺满（同数量表 `DATA.EXT_PLAN_BY_LV`）。",
     "   * 按 净化厂 → 水培温室 → 发电站 → 电弧熔炉 轮转铺满（同数量表 `DATA.EXT_PLAN_BY_LV`）。", 'note1'),
    ("  /* 把 [集水场,伐木,采石,铁矿] 的**数量**摊成**逐块类型**（轮转） */",
     "  /* 把 [净化厂,温室,电站,熔炉] 的**数量**摊成**逐块类型**（轮转） */", 'note2'),
])

# ========== ④ battle.js ==========
rep1('js/battle.js', [
    ("       妖言惑众→守军副本 −15%；火烧粮草→城防值 −30%；挑拨离间→守将加成减半。",
     "       妖言惑众→守军副本 −15%；焚其辎重→城防值 −30%；挑拨离间→守将加成减半。", 'note1'),
    ("          scNote = '火烧粮草 · 城防失灵 ' + Math.round(Math.min(0.9, _sc.eff.defCut) * 100) + '%';",
     "          scNote = '焚其辎重 · 城防失灵 ' + Math.round(Math.min(0.9, _sc.eff.defCut) * 100) + '%';", 'scnote'),
])

# ========== ⑤ domain.js ==========
rep1('js/domain.js', [
    ("   *   不收费：碎石已在城中，只是重新规划地皮。",
     "   *   不收费：材料已在城中，只是重新规划地皮。", 'note1'),
    ("     **按资源分账** —— 集水场只堆粮 / 林场只堆木 / 石场只堆石 / 矿场只堆铁；",
     "     **按资源分账** —— 净化厂只堆水 / 温室只堆生物质 / 电站只堆电能 / 熔炉只堆废钢；", 'note2'),
])

# ========== ⑥ index.html ==========
rep1('index.html', [
    ("    --isz-em-lg: 2.2em;     /* em 族（随容器字号缩放）：集水场/器物大图标 */",
     "    --isz-em-lg: 2.2em;     /* em 族（随容器字号缩放）：净化厂/器物大图标 */", 'note1'),
    ("       「集水场偏黄 / 伐木偏青绿 / 采石偏灰 / 铁矿偏棕黑」。 */",
     "       「净化厂偏黄 / 温室偏青绿 / 电站偏灰 / 熔炉偏棕黑」。 */", 'note2'),
    ("    --res-farm: #c2b45e;          /* 集水场 · 麦黄 */",
     "    --res-farm: #c2b45e;          /* 净化厂 · 麦黄（v89.229 改名） */", 'note3'),
    ("    --res-forest: #6b8a5c;        /* 林地 · 青绿 */",
     "    --res-forest: #6b8a5c;        /* 水培温室 · 青绿 */", 'note4'),
    ("    --res-quarry: #a8a495;        /* 采石 · 石灰 */",
     "    --res-quarry: #a8a495;        /* 发电站 · 石灰 */", 'note5'),
    ("    --res-mine: #8a7052;          /* 矿场 · 棕黑 */",
     "    --res-mine: #8a7052;          /* 电弧熔炉 · 棕黑 */", 'note6'),
    ("     比价列加粗放大 —— 一眼看出净水最便宜、铁最贵。 */",
     "     比价列加粗放大 —— 一眼看出净水最便宜、废钢最贵。 */", 'note7'),
])

print('B2 DONE%s' % ('（DRY）' if DRY else ''))
