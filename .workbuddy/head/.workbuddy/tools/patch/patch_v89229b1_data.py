# -*- coding: utf-8 -*-
# v89.229 批 b1：data.js —— 资源四类重定义（生物质/净水/电能/废钢 + 四产地建筑）
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'js/data.js'

def rd(): return io.open(BASE + P, encoding='utf-8', newline='').read()
def rep(s, old, new, tag):
    c = s.count(old)
    assert c == 1, '[%s] count=%d' % (tag, c)
    return s.replace(old, new)

s = rd(); s0 = s

# ========== ① RESOURCES 表 ==========
s = rep(s,
"""DATA.RESOURCES = [
    { key: 'grain', name: '净水', icon: '🌾', color: '#d9b25a' },
    { key: 'wood',  name: '木料', icon: '🪵', color: '#a9744b' },
    { key: 'stone', name: '碎石', icon: '⛰️', color: '#9b9b9b' },
    { key: 'iron',  name: '废铁', icon: '🔩', color: '#a5b5c9' },""",
"""DATA.RESOURCES = [
    /* v89.229（老板「结合废土背景和兵种，资源类型可以分为生物质（水培温室），净水（净化厂），
       电能（发电站），废钢（电弧熔炉）」）：**显示名换代** —— key 与机制零变化、老档零迁移。
         grain 保持「净水」（id 不动）；wood 木料→生物质 · stone 碎石→电能 · iron 废铁→废钢。
       产地建筑同步换代（EXT_BUILDINGS）：集水场→净化厂 / 木料场→水培温室 /
       碎石场→发电站 / 废铁场→电弧熔炉；图标与色随之更新（color 零消费，仅数据自洽）。 */
    { key: 'grain', name: '净水', icon: '💧', color: '#5b9bd9' },
    { key: 'wood',  name: '生物质', icon: '🌿', color: '#7fb35a' },
    { key: 'stone', name: '电能', icon: '⚡', color: '#d9c355' },
    { key: 'iron',  name: '废钢', icon: '🔩', color: '#a5b5c9' },""",
'rres')

# ========== ② EXT_BUILDINGS 四条 ==========
s = rep(s,
"    farm:   { id: 'farm', name: '集水场', icon: '🌾', desc: '辟田垦殖，净水产地', res: 'grain', prod: PROD_H, cost: FARM_COST,",
"    farm:   { id: 'farm', name: '净化厂', icon: '💧', desc: '滤污洁水，净水产地', res: 'grain', prod: PROD_H, cost: FARM_COST,",
'ext-farm')
s = rep(s,
"    forest: { id: 'forest', name: '木料场', icon: '🪓', desc: '伐木取材，木料产地', res: 'wood', prod: PROD_H,",
"    forest: { id: 'forest', name: '水培温室', icon: '🌱', desc: '无土栽培，生物质产地', res: 'wood', prod: PROD_H,",
'ext-forest')
s = rep(s,
"    quarry: { id: 'quarry', name: '碎石场', icon: '⛰️', desc: '凿山取石，碎石产地', res: 'stone', prod: PROD_H,",
"    quarry: { id: 'quarry', name: '发电站', icon: '⚡', desc: '依山蓄能，电能产地', res: 'stone', prod: PROD_H,",
'ext-quarry')
s = rep(s,
"    mine:   { id: 'mine', name: '废铁场', icon: '⛏️', desc: '开矿冶炼，铁料产地', res: 'iron', prod: PROD_H,",
"    mine:   { id: 'mine', name: '电弧熔炉', icon: '🔥', desc: '电弧重熔，废钢产地', res: 'iron', prod: PROD_H,",
'ext-mine')

# ========== ③ 科技四条 ==========
s = rep(s,
"    { id: 'zhongzhi', name: '种植技术', lv: 1, type: 'grain', per: 0.05, desc: '净水产量 +5%/级' },",
"    { id: 'zhongzhi', name: '净化技术', lv: 1, type: 'grain', per: 0.05, desc: '净水产量 +5%/级' },",
'tech1')
s = rep(s,
"    { id: 'kanfa', name: '砍伐技术', lv: 1, type: 'wood', per: 0.05, desc: '木料产量 +5%/级' },",
"    { id: 'kanfa', name: '栽培技术', lv: 1, type: 'wood', per: 0.05, desc: '生物质产量 +5%/级' },",
'tech2')
s = rep(s,
"    { id: 'wajue', name: '挖掘技术', lv: 2, type: 'stone', per: 0.05, desc: '碎石产量 +5%/级' },",
"    { id: 'wajue', name: '蓄能技术', lv: 2, type: 'stone', per: 0.05, desc: '电能产量 +5%/级' },",
'tech3')
s = rep(s,
"    { id: 'yelian', name: '冶炼技术', lv: 2, type: 'iron', per: 0.05, desc: '废铁产量 +5%/级' },",
"    { id: 'yelian', name: '熔炼技术', lv: 2, type: 'iron', per: 0.05, desc: '废钢产量 +5%/级' },",
'tech4')

# ========== ④ 道具（+25% 档） ==========
s = rep(s,
"    { id: 'lubanfu', name: '电锯组', type: 'prod_buff', res: 'wood', eff: 0.25, dur: 24, price: 5, desc: '木料产量+25%（24h）' },",
"    { id: 'lubanfu', name: '生长灯组', type: 'prod_buff', res: 'wood', eff: 0.25, dur: 24, price: 5, desc: '生物质产量+25%（24h）' },",
'prop-w1')
s = rep(s,
"    { id: 'kaishanchui', name: '破碎机', type: 'prod_buff', res: 'stone', eff: 0.25, dur: 24, price: 5, desc: '碎石产量+25%（24h）' },",
"    { id: 'kaishanchui', name: '变流机组', type: 'prod_buff', res: 'stone', eff: 0.25, dur: 24, price: 5, desc: '电能产量+25%（24h）' },",
'prop-s1')
s = rep(s,
"    { id: 'xuantielu', name: '冶炼炉', type: 'prod_buff', res: 'iron', eff: 0.25, dur: 24, price: 5, desc: '废铁产量+25%（24h）' },",
"    { id: 'xuantielu', name: '冶炼炉', type: 'prod_buff', res: 'iron', eff: 0.25, dur: 24, price: 5, desc: '废钢产量+25%（24h）' },",
'prop-i1')

# ========== ⑤ 道具（+50% / +100% 档） ==========
s = rep(s,
"    { id: 'lubanshen', name: '电锯组·改', type: 'prod_buff', res: 'wood', eff: 0.5, dur: 24, price: 12, desc: '木料产量+50%（24h）' },",
"    { id: 'lubanshen', name: '生长灯组·改', type: 'prod_buff', res: 'wood', eff: 0.5, dur: 24, price: 12, desc: '生物质产量+50%（24h）' },",
'prop-w2')
s = rep(s,
"    { id: 'jumuling', name: '全自动伐木站', type: 'prod_buff', res: 'wood', eff: 1, dur: 24, price: 30, desc: '木料产量+100%（24h）' },",
"    { id: 'jumuling', name: '全自动培养舱', type: 'prod_buff', res: 'wood', eff: 1, dur: 24, price: 30, desc: '生物质产量+100%（24h）' },",
'prop-w3')
s = rep(s,
"    { id: 'kaishanshen', name: '破碎机·改', type: 'prod_buff', res: 'stone', eff: 0.5, dur: 24, price: 12, desc: '碎石产量+50%（24h）' },",
"    { id: 'kaishanshen', name: '变流机组·改', type: 'prod_buff', res: 'stone', eff: 0.5, dur: 24, price: 12, desc: '电能产量+50%（24h）' },",
'prop-s2')
s = rep(s,
"    { id: 'yugongling', name: '采矿钻机', type: 'prod_buff', res: 'stone', eff: 1, dur: 24, price: 30, desc: '碎石产量+100%（24h）' },",
"    { id: 'yugongling', name: '地热钻机组', type: 'prod_buff', res: 'stone', eff: 1, dur: 24, price: 30, desc: '电能产量+100%（24h）' },",
'prop-s3')
s = rep(s,
"    { id: 'xuantieshen', name: '冶炼炉·改', type: 'prod_buff', res: 'iron', eff: 0.5, dur: 24, price: 12, desc: '废铁产量+50%（24h）' },",
"    { id: 'xuantieshen', name: '冶炼炉·改', type: 'prod_buff', res: 'iron', eff: 0.5, dur: 24, price: 12, desc: '废钢产量+50%（24h）' },",
'prop-i2')
s = rep(s,
"    { id: 'ganjianglu', name: '高炉组', type: 'prod_buff', res: 'iron', eff: 1, dur: 24, price: 30, desc: '废铁产量+100%（24h）' },",
"    { id: 'ganjianglu', name: '高炉组', type: 'prod_buff', res: 'iron', eff: 1, dur: 24, price: 30, desc: '废钢产量+100%（24h）' },",
'prop-i3')

# ========== ⑥ 计略「火烧粮草」→「焚其辎重」 ==========
s = rep(s,
"   *   · attack（出征携带）—— 妖言惑众 / 火烧粮草 / 挑拨离间 / 趁火打劫 / 围师必阙",
"   *   · attack（出征携带）—— 妖言惑众 / 焚其辎重 / 挑拨离间 / 趁火打劫 / 围师必阙\n"
"   *     （v89.229：原名「火烧粮草」——「粮草」已不存在于资源体系，随资源换代更名）",
'scheme-note')
s = rep(s,
"""    { id: 'huoshao', name: '火烧粮草', icon: '🔥', kind: 'attack', jinang: 2, energy: 14,
      eff: { defCut: 0.30 },
      tip: '目标城防值 −30%（夜焚敌仓，守备懈怠）' },""",
"""    { id: 'huoshao', name: '焚其辎重', icon: '🔥', kind: 'attack', jinang: 2, energy: 14,
      eff: { defCut: 0.30 },
      tip: '目标城防值 −30%（夜焚敌辎，守备懈怠）' },""",
'scheme-name')

# ========== ⑦ 杂项 ==========
s = rep(s,
"     hint: '城内库藏：粮草 / 木料 / 碎石 / 废铁 / 旧币 / 幸存者' },",
"     hint: '城内库藏：净水 / 生物质 / 电能 / 废钢 / 旧币 / 幸存者' },",
'hint-res')
s = rep(s,
"    { id: 'chest_tong', name: '补给箱·废铁', type: 'chest', tier: 1, price: 25,",
"    { id: 'chest_tong', name: '补给箱·废钢', type: 'chest', tier: 1, price: 25,",
'chest')
s = rep(s,
"     表不存在 → 摘要里永远显示原始 id（`chest_tong` 而不是「补给箱·废铁」）。",
"     表不存在 → 摘要里永远显示原始 id（`chest_tong` 而不是「补给箱·废钢」）。",
'chest-note')
s = rep(s,
"     而玩家的军队规模到后期是几万级（政务厅 Lv10 满集水场能养 5 万+），",
"     而玩家的军队规模到后期是几万级（政务厅 Lv10 满净化厂能养 5 万+），",
'pop-note')
s = rep(s,
"    '灰野': { mat: 'jingtie', tier: 2, lore: '北原旧工业带，废铁遍野，精铁尚堪用。' },",
"    '灰野': { mat: 'jingtie', tier: 2, lore: '北原旧工业带，废钢遍野，精铁尚堪用。' },",
'lore')
s = rep(s,
"    { id: 'weapon',   names: ['废铁爪', '刀爪', '制式骨刃', '军规骨刃', '动力骨刃', '遗世利爪'],       stat: 'atk', v: [50, 120, 230, 420, 710, 1090] },",
"    { id: 'weapon',   names: ['废钢爪', '刀爪', '制式骨刃', '军规骨刃', '动力骨刃', '遗世利爪'],       stat: 'atk', v: [50, 120, 230, 420, 710, 1090] },",
'ling')

# ========== ⑧ 注释批 ==========
s = rep(s,
"   *     碎石占 66%（现实围墙 = 砖石夯土工程，碎石是绝对主材）；资源/小时比",
"   *     电能占 66%（能量护墙工程，电能是绝对主材）；资源/小时比",
'note1')
s = rep(s,
"           · 石 66% / 木 14% / 粮 12% / 铁 8% —— 砖石夯土工程，碎石绝对主导；",
"           · 电能 66% / 生物质 14% / 净水 12% / 废钢 8% —— 能量护墙工程，电能绝对主导；",
'note2')
s = rep(s,
"   *     应该是地块多的存的多吧」）**：集水场只堆粮 / 林场只堆木 / 石场只堆石 / 矿场只堆铁 ——",
"   *     应该是地块多的存的多吧」）**：净化厂只堆水 / 温室只堆生物质 / 电站只堆电能 / 熔炉只堆废钢 ——",
'note3')
s = rep(s,
"   * 改后：`EXT_PLAN_BY_LV[lv-1] = [集水场, 木料场, 碎石场, 废铁场]`，",
"   * 改后：`EXT_PLAN_BY_LV[lv-1] = [净化厂, 水培温室, 发电站, 电弧熔炉]`，",
'note4')
s = rep(s,
"   *   · 粮是养兵主线（v89.36 起\"养\"由维持耗粮改为**募兵一次性耗粮**，粮依然吃重）→ 集水场恒占 1/3 上下；",
"   *   · 净水是养兵主线（v89.36 起\"养\"由维持耗粮改为**募兵一次性耗粮**，净水依然吃重）→ 净化厂恒占 1/3 上下；",
'note5')
s = rep(s,
"   *   · 早期营建吃木石、装备吃铁 → 采石/铁矿从 2 长到 9，中后期追上集水场的增速；",
"   *   · 早期营建吃生物质与电能、装备吃废钢 → 电站/熔炉从 2 长到 9，中后期追上净化厂的增速；",
'note6')
s = rep(s,
"   *   · ratio：**比例表**（老板给定）—— 粮 1 : 木 2 : 石 3 : 铁 4，净水最便宜。",
"   *   · ratio：**比例表**（老板给定）—— 净水 1 : 生物质 2 : 电能 3 : 废钢 4，净水最便宜。",
'note7')
s = rep(s,
"   *       **居所幸存者表与集水场产量表是同一张**（等级 L → 幸存者 T / 集水场 T 每小时），",
"   *       **居所幸存者表与净化厂产量表是同一张**（等级 L → 幸存者 T / 净化厂 T 每小时），",
'note8')
s = rep(s,
"   *       1 块 Lv7 集水场 ≈ 2100 粮/h → 一现实小时 ≈ 25 万粮 ≈ 卖 8.8k 金（交易站 Lv3）；",
"   *       1 块 Lv7 净化厂 ≈ 2100 净水/h → 一现实小时 ≈ 25 万净水 ≈ 卖 8.8k 金（交易站 Lv3）；",
'note9')
s = rep(s,
"   *       同期 4 间 Lv7 居所的税产 ≈ 20 万旧币 —— 即\"一块田的余粮\"约补 +4%，不喧宾夺主。",
"   *       同期 4 间 Lv7 居所的税产 ≈ 20 万旧币 —— 即\"一块地的余量\"约补 +4%，不喧宾夺主。",
'note10')

assert s != s0
if DRY:
    print('[DRY] data.js 全部命中（%d 处）' % 30)
else:
    tmp = BASE + P + '.tmp229b'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    assert t.count("name: '生物质'") == 1 and t.count("name: '电能'") == 1 and t.count("name: '废钢'") == 1
    assert t.count("name: '净化厂'") == 1 and t.count("name: '水培温室'") == 1
    assert t.count("name: '发电站'") == 1 and t.count("name: '电弧熔炉'") == 1
    assert '火烧粮草' not in t and '焚其辎重' in t
    # 旧资源名残留核（只允许历史沿革注释里出现"原名字样"）
    for bad in ['木料场', '碎石场', '废铁场', '集水场']:
        cnt = t.count(bad)
        assert cnt == 0, '旧建筑名残留 %s ×%d' % (bad, cnt)
    print('[OK] data.js 30 处已落盘 + 自检通过')
print('B1 DONE%s' % ('（DRY）' if DRY else ''))
