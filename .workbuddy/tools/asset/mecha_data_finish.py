# -*- coding: utf-8 -*-
"""data.js 收尾：19 槽锻造蓝本 + 锻造材料映射 + 基因槽列表解耦。"""
import re

SRC = r"E:/Deepseekdb/js/data.js"
t = open(SRC, encoding="utf-8").read()

# ---- 1. DATA.CRAFT_SLOTS → 19 ----
new_craft = """  DATA.CRAFT_SLOTS = [
    { id: 'weapon',    primary: 'iron',    names: ['铁刀', '钢刀', '钢锭战刀', '陨铁战刃'],       stat: 'atk', v: [78, 264, 558, 960] },
    { id: 'head',      primary: 'iron',    names: ['皮盔', '铁盔', '钢锭盔', '陨铁盔'],   stat: 'def', v: [72, 242, 511, 880] },
    { id: 'chest',     primary: 'iron',    names: ['皮甲', '铁甲', '钢锭铠', '陨铁铠'],   stat: 'def', v: [98, 330, 700, 1200] },
    { id: 'waist',     primary: 'leather', names: ['皮带', '熟皮带', '硬甲皮带', '变异皮带'], stat: 'def', v: [66, 220, 464, 800] },
    { id: 'arm_up_l',  primary: 'iron',    names: ['皮肩', '铁肩铠', '钢锭肩铠', '陨铁肩'], stat: 'def', v: [72, 242, 511, 880] },
    { id: 'arm_up_r',  primary: 'iron',    names: ['皮肩', '铁肩铠', '钢锭肩铠', '陨铁肩'], stat: 'def', v: [72, 242, 511, 880] },
    { id: 'arm_low_l', primary: 'iron',    names: ['皮臂', '铁臂甲', '钢锭臂甲', '陨铁臂'], stat: 'def', v: [66, 220, 464, 800] },
    { id: 'arm_low_r', primary: 'iron',    names: ['皮臂', '铁臂甲', '钢锭臂甲', '陨铁臂'], stat: 'def', v: [66, 220, 464, 800] },
    { id: 'thigh_l',   primary: 'iron',    names: ['皮腿', '铁腿铠', '钢锭腿铠', '陨铁腿'], stat: 'def', v: [70, 236, 498, 858] },
    { id: 'thigh_r',   primary: 'iron',    names: ['皮腿', '铁腿铠', '钢锭腿铠', '陨铁腿'], stat: 'def', v: [70, 236, 498, 858] },
    { id: 'shin_l',    primary: 'iron',    names: ['皮胫', '铁胫甲', '钢锭胫甲', '陨铁胫'], stat: 'def', v: [64, 214, 452, 780] },
    { id: 'shin_r',    primary: 'iron',    names: ['皮胫', '铁胫甲', '钢锭胫甲', '陨铁胫'], stat: 'def', v: [64, 214, 452, 780] },
    { id: 'foot_l',    primary: 'leather', names: ['草鞋', '皮靴', '硬甲皮靴', '变异皮靴'],   stat: 'spd', v: [5, 20, 44, 78] },
    { id: 'foot_r',    primary: 'leather', names: ['草鞋', '皮靴', '硬甲皮靴', '变异皮靴'],   stat: 'spd', v: [5, 20, 44, 78] },
    { id: 'neck',      primary: 'jade',    names: ['碎晶坠', '晶坯坠', '纯晶坠', '源晶坠'], stat: 'tong', v: [10, 22, 38, 56] },
    { id: 'ring',      primary: 'jade',    names: ['碎晶戒', '晶坯戒', '纯晶戒', '源晶戒'], stat: 'tong', v: [10, 22, 38, 56] },
    { id: 'pendant',   primary: 'jade',    names: ['木佩', '晶坯佩', '纯晶佩', '源晶佩'],  stat: 'zm', v: [10, 22, 38, 56] },
    { id: 'back',      primary: 'silk',    names: ['帆布披风', '细布披风', '高强披风', '光学披风'], stat: 'zm', v: [10, 22, 38, 56] },
    { id: 'mount',     primary: 'leather', names: ['驽马', '良马', '骏马', '战马'],       stat: 'spd', v: [9, 36, 82, 146] },
  ];"""
t = re.sub(r"  DATA\.CRAFT_SLOTS = \[.*?\n  \];", new_craft, t, count=1, flags=re.S)

# ---- 2. DATA.FORGE.matBySlot → 19 ----
new_mat = """  DATA.FORGE.matBySlot = {
    weapon:    ['iron', 'wood', 'sinew'],
    head:      ['iron', 'leather'],
    chest:     ['iron', 'leather'],
    waist:     ['leather', 'iron'],
    arm_up_l:  ['iron', 'leather'],
    arm_up_r:  ['iron', 'leather'],
    arm_low_l: ['iron', 'leather'],
    arm_low_r: ['iron', 'leather'],
    thigh_l:   ['iron', 'leather'],
    thigh_r:   ['iron', 'leather'],
    shin_l:    ['iron', 'leather'],
    shin_r:    ['iron', 'leather'],
    foot_l:    ['leather', 'sinew'],
    foot_r:    ['leather', 'sinew'],
    neck:      ['jade', 'iron'],
    ring:      ['jade', 'iron'],
    pendant:   ['jade', 'silk'],
    back:      ['silk', 'leather'],
    mount:     ['leather', 'sinew', 'silk'],
  };"""
t = re.sub(r"  DATA\.FORGE\.matBySlot = \{.*?\n  \};", new_mat, t, count=1, flags=re.S)

# ---- 3. 基因槽列表解耦：机甲 19 / 基因 12，加 DATA.LING_SLOTS_ID ----
anchor = "  DATA.LING_SLOTS = ["
decouple = """  /* v90.11：机甲槽位扩到 19（身体 13 + 外挂 6），基因强化仍为 12 槽 ——
     两者分道：槽列表用 DATA.EQUIP_SLOTS（机甲）/ DATA.LING_SLOTS_ID（基因）。 */
  DATA.LING_SLOTS_ID = ['weapon', 'head', 'chest', 'shoulder', 'arm', 'waist',
    'feet', 'neck', 'ring', 'pendant', 'back', 'mount'];

"""
t = t.replace(anchor, decouple + anchor, 1)

open(SRC, "w", encoding="utf-8").write(t)
print("done: CRAFT_SLOTS 19 / matBySlot 19 / LING_SLOTS_ID added")
