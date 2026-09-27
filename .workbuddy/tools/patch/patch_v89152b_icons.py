# -*- coding: utf-8 -*-
# v89.152b：icons.js GEM_PAL —— 9 组 -> 18 组（新珠宝配色，按宝石本色）
import io, re

P = 'E:/Deepseekdb/js/icons.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

OLD = u"""  var GEM_PAL = {
    zhenzhu: ['#f2ece0', '#c8c0b0'], shanhu: ['#f08a6a', '#b8452f'],
    liuli: ['#a8d8e8', '#5a90b0'], hupo: ['#f0bc60', '#b8801c'],
    manao: ['#e07060', '#a03030'], shuijing: ['#e8f4fa', '#9fc0d4'],
    feicui: ['#7fd4a0', '#3c8a5c'], yushi: ['#f4f0e4', '#c8bca0'],
    yemingzhu: ['#fff4c0', '#d0a63f'],
  };"""

NEW = u"""  /* v89.152：珠宝体系重设（18 种，配色按宝石本色）——
     唯一消费点 = 下方 ITEM_ART.jewel（`GEM_PAL[id] || 默认`），新增珠宝必须在此上色。 */
  var GEM_PAL = {
    bengzhu: ['#f2ece0', '#b8a888'],        /* 蚌珠：乳白 */
    mila: ['#f0c268', '#a86c14'],           /* 蜜蜡：蜜黄 */
    meiyu: ['#5a5650', '#221f1c'],          /* 煤玉：漆黑 */
    qingyu: ['#8fc4a8', '#3c7858'],         /* 青玉：青绿 */
    zijin: ['#c8a0e8', '#7048a8'],          /* 紫晶：紫 */
    lvsongshi: ['#6fd0c0', '#1f8878'],      /* 绿松石：蓝绿 */
    hongshanhu: ['#f08a6a', '#b8452f'],     /* 红珊瑚：橘红 */
    yusui: ['#e8dcc0', '#b09c70'],          /* 玉髓：米黄 */
    yinchenmu: ['#8a6a48', '#463020'],      /* 阴沉木：深褐 */
    cuiyu: ['#5fd490', '#207a4c'],          /* 翠玉：翠绿 */
    danbaishi: ['#e8e0f4', '#a890c8'],      /* 蛋白石：幻彩白紫 */
    bixi: ['#f0a0c8', '#b83078'],           /* 碧玺：粉红 */
    jiaorenlei: ['#d8f0f8', '#78b8d0'],     /* 鲛人泪：珠光淡蓝 */
    tianzhu: ['#5a5048', '#181410'],        /* 天珠：黑褐 */
    longxianxiang: ['#d8d0b8', '#8a7c58'],  /* 龙涎香：灰白 */
    chenxiang: ['#6a4a38', '#2f1c12'],      /* 沉香：深棕 */
    yemingzhu: ['#fff4c0', '#d0a63f'],      /* 夜明珠：荧光黄 */
    hetianyu: ['#f4f0e4', '#c8bca0'],       /* 和田玉：羊脂白 */
  };"""

assert s.count(OLD) == 1, 'GEM_PAL anchor count=' + str(s.count(OLD))
if u'bengzhu:' not in s:
    s = s.replace(OLD, NEW)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('OK len %d -> %d' % (orig, len(s)))
else:
    print('skip (already)')

chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'bengzhu:') == 1 and chk.count(u'hetianyu:') == 1
assert u'zhenzhu:' not in chk, 'old pal key remains'
print('SELF-CHECK PASS: 18 pal entries')
