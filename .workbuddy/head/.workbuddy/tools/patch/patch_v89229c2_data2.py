# -*- coding: utf-8 -*-
# v89.229 批 c2：data.js 余项 —— troopOrder / WILD_DEFENSE / garrisonMix / SMART_PLAN.targets
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

# ========== ① AUTO_MARCH.troopOrder ==========
s = rep(s,
"""    /* 编队优先级：先上精锐，器械与侦察兵/辎重一律不编入 */
    troopOrder: ['tieji', 'hubaoqi', 'xiliangtieqi', 'tuqibing', 'qingji',
      'nanjiangxiangbing', 'qingzhoubing', 'tengjiabing', 'daodun',
      'changqiang', 'gongjian', 'yibing', 'minfu'],""",
"""   /* 编队优先级：先上精锐，器械与侦察兵/辎重一律不编入
      （v89.229 兵种重构：18 项映射去重为 10 项 —— 重甲/装甲战车→主战机甲
        旧军残部/王牌战车→狂猎 · 长矛手/民兵→步行机；顺序沿原优先级） */
   troopOrder: ['zhuzhan', 'kuanglie', 'wuzhi', 'fujiche', 'taitan',
     'dianci', 'dunwei', 'buxingji', 'daodanche', 'banche'],""",
'troopOrder')

# ========== ② WILD_DEFENSE 11 级 ==========
s = rep(s,
"""  DATA.WILD_DEFENSE = [
    /* Lv0 */ [{ id: 'yibing', min: 9, max: 30 }],
    /* Lv1 */ [{ id: 'yibing', min: 25, max: 60 }, { id: 'changqiang', min: 1, max: 16 }],
    /* Lv2 */ [{ id: 'yibing', min: 65, max: 160 }, { id: 'changqiang', min: 16, max: 60 }],
    /* Lv3 */ [{ id: 'yibing', min: 70, max: 170 }, { id: 'changqiang', min: 30, max: 85 }, { id: 'gongjian', min: 10, max: 40 }],
    /* Lv4 */ [{ id: 'changqiang', min: 140, max: 360 }, { id: 'daodun', min: 70, max: 200 }, { id: 'gongjian', min: 55, max: 170 }],
    /* Lv5 */ [{ id: 'changqiang', min: 260, max: 660 }, { id: 'daodun', min: 140, max: 400 }, { id: 'gongjian', min: 95, max: 310 }, { id: 'qingji', min: 30, max: 110 }],
    /* Lv6 */ [{ id: 'changqiang', min: 520, max: 1250 }, { id: 'daodun', min: 300, max: 770 }, { id: 'gongjian', min: 190, max: 580 }, { id: 'qingji', min: 80, max: 300 }],
    /* Lv7 */ [{ id: 'changqiang', min: 980, max: 2350 }, { id: 'daodun', min: 590, max: 1450 }, { id: 'gongjian', min: 390, max: 1100 }, { id: 'qingji', min: 200, max: 620 }, { id: 'tengjiabing', min: 65, max: 290 }],
    /* Lv8 */ [{ id: 'changqiang', min: 1900, max: 4550 }, { id: 'daodun', min: 1150, max: 2750 }, { id: 'gongjian', min: 790, max: 2050 }, { id: 'qingji', min: 450, max: 1250 }, { id: 'tengjiabing', min: 250, max: 870 }],
    /* Lv9 */ [{ id: 'changqiang', min: 4650, max: 11000 }, { id: 'daodun', min: 2900, max: 6700 }, { id: 'gongjian', min: 2050, max: 5200 }, { id: 'qingji', min: 1250, max: 3150 }, { id: 'tieji', min: 410, max: 1650 }, { id: 'chuangnu', min: 210, max: 820 }],
    /* Lv10 */ [{ id: 'changqiang', min: 8750, max: 21100 }, { id: 'daodun', min: 5450, max: 13200 }, { id: 'gongjian', min: 4050, max: 9650 }, { id: 'qingji', min: 2450, max: 6150 }, { id: 'tieji', min: 1050, max: 4050 }, { id: 'chuangnu', min: 610, max: 2300 }, { id: 'toudan', min: 260, max: 1050 }],
  ];""",
"""  DATA.WILD_DEFENSE = [
    /* v89.229 兵种重构：18→14 按映射重写 —— 民兵+长矛手合并为步行机（min/max 逐级相加，
       中值合计不变 = 原标定保持）；弩手→导弹车 · 盾卫→盾卫 · 摩托游骑→伏击车 ·
       防暴甲兵→电磁盾卫 · 装甲战车→主战机甲 · 重弩车→无人轰炸机 · 迫击炮→自行火炮。 */
    /* Lv0 */ [{ id: 'buxingji', min: 9, max: 30 }],
    /* Lv1 */ [{ id: 'buxingji', min: 26, max: 76 }],
    /* Lv2 */ [{ id: 'buxingji', min: 81, max: 220 }],
    /* Lv3 */ [{ id: 'buxingji', min: 100, max: 255 }, { id: 'daodanche', min: 10, max: 40 }],
    /* Lv4 */ [{ id: 'buxingji', min: 140, max: 360 }, { id: 'dunwei', min: 70, max: 200 }, { id: 'daodanche', min: 55, max: 170 }],
    /* Lv5 */ [{ id: 'buxingji', min: 260, max: 660 }, { id: 'dunwei', min: 140, max: 400 }, { id: 'daodanche', min: 95, max: 310 }, { id: 'fujiche', min: 30, max: 110 }],
    /* Lv6 */ [{ id: 'buxingji', min: 520, max: 1250 }, { id: 'dunwei', min: 300, max: 770 }, { id: 'daodanche', min: 190, max: 580 }, { id: 'fujiche', min: 80, max: 300 }],
    /* Lv7 */ [{ id: 'buxingji', min: 980, max: 2350 }, { id: 'dunwei', min: 590, max: 1450 }, { id: 'daodanche', min: 390, max: 1100 }, { id: 'fujiche', min: 200, max: 620 }, { id: 'dianci', min: 65, max: 290 }],
    /* Lv8 */ [{ id: 'buxingji', min: 1900, max: 4550 }, { id: 'dunwei', min: 1150, max: 2750 }, { id: 'daodanche', min: 790, max: 2050 }, { id: 'fujiche', min: 450, max: 1250 }, { id: 'dianci', min: 250, max: 870 }],
    /* Lv9 */ [{ id: 'buxingji', min: 4650, max: 11000 }, { id: 'dunwei', min: 2900, max: 6700 }, { id: 'daodanche', min: 2050, max: 5200 }, { id: 'fujiche', min: 1250, max: 3150 }, { id: 'zhuzhan', min: 410, max: 1650 }, { id: 'wuren', min: 210, max: 820 }],
    /* Lv10 */ [{ id: 'buxingji', min: 8750, max: 21100 }, { id: 'dunwei', min: 5450, max: 13200 }, { id: 'daodanche', min: 4050, max: 9650 }, { id: 'fujiche', min: 2450, max: 6150 }, { id: 'zhuzhan', min: 1050, max: 4050 }, { id: 'wuren', min: 610, max: 2300 }, { id: 'huopao', min: 260, max: 1050 }],
  ];""",
'wilddef')

# 注释：递进名更新
s = rep(s,
"     本次**只重标定总数，不动兵种构成比例与区间形状**（比例本身是合理的：\n     民兵→长矛手→盾卫→弩手→摩托游骑→防暴甲兵/装甲战车/重弩车/迫击炮的递进与原版一致）。",
"     本次**只重标定总数，不动兵种构成比例与区间形状**（比例本身是合理的：\n     步行机→盾卫→导弹车→伏击车→电磁盾卫/主战机甲/无人轰炸机/自行火炮的递进与原版一致；\n     v89.229 兵种重构后按新名映射，中值合计逐级不变）。",
'wilddef-note')

# ========== ③ 名城 garrisonMix ==========
s = rep(s,
"""    garrisonMix: [
      { id: 'yibing', w: 0.15 },
      { id: 'changqiang', w: 0.25 },
      { id: 'daodun', w: 0.20 },
      { id: 'gongjian', w: 0.25 },
      { id: 'qingji', w: 0.15 },
      { id: 'tieji', w: 0.12 },
      { id: 'chongche', w: 0.05 },
      { id: 'toudan', w: 0.03 },
      { id: 'chuangnu', w: 0.06 },
    ],""",
"""   garrisonMix: [
     /* v89.229 兵种重构：18→14 —— 同兵种权重相加（戍军构成总量与比例保持）：
        民兵 0.15 + 长矛手 0.25 → 步行机 0.40 · 破门车 0.05 + 迫击炮 0.03 → 自行火炮 0.08 */
     { id: 'buxingji', w: 0.40 },
     { id: 'dunwei', w: 0.20 },
     { id: 'daodanche', w: 0.25 },
     { id: 'fujiche', w: 0.15 },
     { id: 'zhuzhan', w: 0.12 },
     { id: 'huopao', w: 0.08 },
     { id: 'wuren', w: 0.06 },
   ],""",
'mix')

# ========== ④ SMART_PLAN.targets ==========
s = rep(s,
"""    targets: {
      changqiang: 'qingji',        /* 长矛手 → 摩托游骑（v89.164 静态标定） */
      daodun: 'gongjian',          /* 盾卫 → 弩手（弩手防最低 · v89.164 静态标定） */
      tengjiabing: 'changqiang',   /* 防暴甲兵 → 长矛手（防高扛枪阵） */
      gongjian: 'gongjian',        /* 弩手 → 弩手（对射 · 两边都防 50，先手定胜负） */
      toudan: 'gongjian',          /* 迫击炮 → 弩手（高攻打最软目标） */
      chuangnu: 'chuangnu',        /* 重弩车 → 器械（对器械族） */
      qingji: 'gongjian', tieji: 'gongjian', tuqibing: 'gongjian',
      hubaoqi: 'gongjian', xiliangtieqi: 'gongjian', nanjiangxiangbing: 'gongjian',
      /* 机车族 → 弩手（冲散后排火力 · v89.164 静态标定） */
    },""",
"""    targets: {
      /* v89.229 兵种重构：按 18→14 映射重写（v89.164 静态标定的语义原样保留） */
      buxingji: 'fujiche',         /* 步行机 → 伏击车（v89.164 静态标定） */
      dunwei: 'daodanche',         /* 盾卫 → 导弹车（导弹车防最低 · v89.164 静态标定） */
      dianci: 'buxingji',          /* 电磁盾卫 → 步行机（防高扛线） */
      daodanche: 'daodanche',      /* 导弹车 → 导弹车（对射 · 两边都防 50，先手定胜负） */
      huopao: 'daodanche',         /* 自行火炮 → 导弹车（高攻打最软目标） */
      wuren: 'wuren',              /* 无人轰炸机 → 器械（对器械族） */
      fujiche: 'daodanche', zhuzhan: 'daodanche', wuzhi: 'daodanche',
      kuanglie: 'daodanche', taitan: 'daodanche',
      /* 机车族 → 导弹车（冲散后排火力 · v89.164 静态标定） */
    },""",
'targets')

assert s != s0
if DRY:
    print('[DRY] data.js 5 段命中')
else:
    tmp = BASE + P + '.tmp229c2'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    for k in ["'buxingji', min: 26", "id: 'taitan', min", "'buxingji', w: 0.40", "buxingji: 'fujiche'", "'dianci', min: 65"]:
        assert k in t, '缺 ' + k
    print('[OK] data.js 5 段已落盘 + 自检通过')
print('C2 DONE%s' % ('（DRY）' if DRY else ''))
