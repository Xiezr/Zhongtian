# -*- coding: utf-8 -*-
"""v88.1 整合（data.js）：六地形场景并入 LING_ACT（kind scene）+ 删除 WILD_SCENES 表。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\data.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

# ============ 1) LING_ACT 追加 6 个 scene 条目（数据自 WILD_SCENES 原样搬运） ============
if "hill_scene" in d:
    print('SKIP 1/2 scene 条目已存在')
else:
    ANCHOR = """    bai: { name: '拜访', kind: 'visit', icon: '🏡', energy: 8, stam: 2,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [10, 20] },
      desc: '拜访隐士奇人：一段小故事，一份小赠礼。' },
  };"""
    NEW = """    bai: { name: '拜访', kind: 'visit', icon: '🏡', energy: 8, stam: 2,
      spots: ['hill', 'forest', 'lake', 'zhaoze', 'desert', 'caoyuan'],
      win: { ess: [10, 20] },
      desc: '拜访隐士奇人：一段小故事，一份小赠礼。' },
    /* ---- 地形专属（v87「野地专属场景」-> v88.1 整合：从 WILD_SCENES 原样并入） ----
       kind: 'scene' —— 每地形一条「招牌」，与通用活动同走江湖游历入口 / s.jianghu 每日锁；
       产出保持军装经济侧（金/粮/材料/珠宝/道具/豪杰），与活动的灵气精华产出并行不悖。 */
    hill_scene: { name: '绿林探访', kind: 'scene', icon: '⚔️', energy: 12, stam: 4,
      spots: ['hill'],
      desc: '入山访豪杰：或得好汉相赠，或得豪杰来投，或遇剪径强人负伤而归。',
      outcomes: [
        { w: 30, t: '山寨好汉赠金', gold: [800, 2400] },
        { w: 24, t: '搜得山寨存货', mats: [1, 2] },
        { w: 12, t: '豪杰相投（得在野将领）', hero: 1 },
        { w: 12, t: '得珠宝一颗', jewel: 1 },
        { w: 22, t: '遇剪径强人，负伤而归', wound: 6 },
      ] },
    lake_scene: { name: '垂钓', kind: 'scene', icon: '🎣', energy: 6, stam: 2,
      spots: ['lake'],
      desc: '临湖垂钓：鱼获充作军粮，偶得水中沉物。',
      outcomes: [
        { w: 44, t: '鱼获颇丰（充粮）', grain: [800, 2000] },
        { w: 22, t: '小鱼数尾', grain: [200, 600] },
        { w: 12, t: '网得沉物（锦囊）', item: 'jinang' },
        { w: 8, t: '得珠宝一颗', jewel: 1 },
        { w: 14, t: '空竿而归', none: 1 },
      ] },
    zhaoze_scene: { name: '沼泽寻宝', kind: 'scene', icon: '🔍', energy: 14, stam: 5,
      spots: ['zhaoze'],
      desc: '探寻旧战场遗迹：宝物丰厚，瘴气伤身。',
      outcomes: [
        { w: 24, t: '掘得珍宝', jewel: { n: [1, 2] } },
        { w: 22, t: '拾获军资', mats: [1, 3] },
        { w: 18, t: '掘出旧钱', gold: [1500, 4000] },
        { w: 12, t: '得古朴木盒', item: 'chest' },
        { w: 24, t: '瘴气侵体，负伤而归', wound: 8 },
      ] },
    desert_scene: { name: '地宫探险', kind: 'scene', icon: '🏛️', energy: 20, stam: 8,
      spots: ['desert'],
      desc: '深入地下宫阙：三层遗藏一层比一层厚，险也一层比一层深。',
      outcomes: [
        { w: 30, t: '第一层便有所获', gold: [1500, 3500] },
        { w: 28, t: '第二层遗藏', mats: [2, 4] },
        { w: 16, t: '第三层秘宝（名将套图纸）', item: 'bp_mingjiang' },
        { w: 12, t: '探得珠宝', jewel: { n: [1, 3] } },
        { w: 14, t: '地宫塌方，负伤逃出', wound: 12 },
      ] },
    forest_scene: { name: '林中狩猎', kind: 'scene', icon: '🏹', energy: 8, stam: 3,
      spots: ['forest'],
      desc: '入林行猎：兽皮药材俱是军资，亦可得野味充粮。',
      outcomes: [
        { w: 42, t: '猎获皮毛药材', mats: [1, 2] },
        { w: 22, t: '猎得野味（充粮）', grain: [500, 1500] },
        { w: 14, t: '偶得失物（锦囊）', item: 'jinang' },
        { w: 22, t: '空手而归', none: 1 },
      ] },
    caoyuan_scene: { name: '草原牧马', kind: 'scene', icon: '🐎', energy: 10, stam: 4,
      spots: ['caoyuan'],
      desc: '逐水草而行：得马市之资或牧马辎具，偶遇良马相随。',
      outcomes: [
        { w: 34, t: '马市得资', gold: [800, 2000] },
        { w: 26, t: '得牧马辎具', mats: [1, 2] },
        { w: 12, t: '良马相随（得马鞭）', item: 'mabian' },
        { w: 28, t: '风尘仆仆', none: 1 },
      ] },
  };"""
    assert d.count(ANCHOR) == 1, 'LING_ACT 尾锚点 %d 次' % d.count(ANCHOR)
    d = d.replace(ANCHOR, NEW, 1)
    dirty = True
    print('OK 1/2 六场景并入 LING_ACT')

# ============ 2) 删除 WILD_SCENES 表（整块 → 说明注释） ============
if 'DATA.WILD_SCENES = {' not in d:
    print('SKIP 2/2 WILD_SCENES 已删除')
else:
    i = d.find("  /* ============================================================\n   * v87（老板「为各类野地设计专属弹窗场景」）：野地专属场景")
    j = d.find("  };\n\n  /* ============================================================\n   * v88（老板「修炼型装备系统」）：灵气装备 · 江湖游历")
    assert i > 0 and j > i, 'WILD_SCENES 块定位失败 i=%d j=%d' % (i, j)
    j_end = j + len("  };\n")
    REPL = ("  /* v87「野地专属场景」-> v88.1 整合：\n"
            "     六地形场景（绿林探访/垂钓/寻宝/地宫/狩猎/牧马）已并入 DATA.LING_ACT\n"
            "     （<terrain>_scene，kind: 'scene'）——统一走「江湖游历」入口与 s.jianghu\n"
            "     每日锁；原 DATA.WILD_SCENES 表 / GAME.wildScene* / ui.wildSceneHTML 全部删除。 */\n")
    d = d[:i] + REPL + d[j_end:]
    dirty = True
    print('OK 2/2 WILD_SCENES 表已删（留说明注释）')

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')

# 验证
d2 = io.open(P, encoding='utf-8', newline='').read()
import re
n_scene = len(re.findall(r"kind: 'scene',", d2))
print('scene 条目数:', n_scene, '(期望 6) | WILD_SCENES 表残留:', 'DATA.WILD_SCENES = {' in d2)
