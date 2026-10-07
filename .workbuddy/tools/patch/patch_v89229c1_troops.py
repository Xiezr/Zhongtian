# -*- coding: utf-8 -*-
# v89.229 批 c1：data.js —— TROOPS 表重构（18→14 · 三组分页 · cat 退役 → grp · ride 显式化）
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'js/data.js'

def rd(): return io.open(BASE + P, encoding='utf-8', newline='').read()

s = rd()

# ---------- ① TROOPS 表整块替换 ----------
i = s.index('DATA.TROOPS = {')
j = s.index('\n  };', i) + len('\n  };')
old_block = s[i:j]
assert s.count(old_block) == 1, 'TROOPS 块不唯一'
assert 'minfu:' in old_block and 'nanjiangxiangbing:' in old_block

NEW_BLOCK = """DATA.TROOPS = {
    /* ============================================================
     * v89.229 **兵种重构**（老板：「不再按步兵骑兵区分，合并，按分页显示，缩减兵种数量，
     *   保留可增加框架」）—— 18 种 → **14 种**，按三组分页（grp 1/2/3）：
     *     组 1 后勤支援（4）：板车 / 伏击车 / 侦察单元 / 运输平台
     *     组 2 主力战斗（5）：步行机 / 盾卫 / 导弹车 / 武装直升机 / 主战机甲
     *     组 3 尖端武装（5）：狂猎 / 电磁盾卫 / 自行火炮 / 无人轰炸机 / 泰坦机甲
     * ------------------------------------------------------------
     * 结构变化：
     *   · `cat`（inf/cav）退役 → **`grp`**（1/2/3，分页依据；"步兵/骑兵"不再区分）；
     *   · 新增 `ride` 字段（原 cav 类的显式化）——"驾驭技巧"加成的适用面
     *     （battle.spdMultOf 改读它；旧的 `/qi$|tieji|qingji/` id 模式匹配退役）；
     *   · **框架可扩展**：新增兵种 = 表内加一行 + 选 grp（分页自动收纳）；
     *     位图（assets/icons/ui/ai_<id>.png）缺省回退 TR 表 SVG 剪影（icons.js）。
     * 数值 = **主原型继承**（不重标定平衡）；18→14 的合并去向（4 个吸收项）：
     *   民兵 + 旧军残部 + 长矛手 → 步行机（取长矛手数值）· 装甲战车 + 重甲战车 → 主战机甲
     *   （取重甲战车数值）· 破门车 + 迫击炮 → 自行火炮（取迫击炮数值）· 王牌战车 → 狂猎。
     * 解锁：buxingji 继承民兵的 junying:1 入门位（保开局可战）；其余按主原型全套。
     * 老档迁移：GAME.migrateTroops229（18 项映射表 · 读档幂等并入，见 state.js）。
     * ============================================================ */
    banche:    { id: 'banche', grp: 1, name: '板车', ab: '板', icon: '🛞', hp: 600, atk: 5, def: 10, range: 10, spd: 180, gather: 2, load: 500, pop: 1, time: 15, cost: { grain: 150, wood: 150, iron: 10 }, unlock: { junying: 1 }, desc: '拼装板车，转运物资；战力孱弱，可运输' },
    fujiche:   { id: 'fujiche', grp: 1, name: '伏击车', ab: '伏', icon: '🏍️', hp: 3720, atk: 340, def: 180, range: 80, spd: 1000, gather: 6, load: 250, pop: 2, ride: true, time: 70, cost: { grain: 3000, wood: 600, iron: 500 }, unlock: { junying: 5, majiu: 1, tech: { zhandou: 1, xingjun: 1, jiayu: 1 } }, desc: '机动伏击，捕俘主力（需车库 + 战斗/行军/驾驭技巧）' },
    zhencha:   { id: 'zhencha', grp: 1, name: '侦察单元', ab: '侦', icon: '🛸', hp: 600, atk: 20, def: 20, range: 20, spd: 3000, gather: 1, load: 30, pop: 1, nocombat: true, time: 20, cost: { grain: 360, wood: 200, iron: 150 }, unlock: { junying: 2, shuyuan: 2, tech: { zhencha: 1 } }, desc: '小巧飞行器，极限速度，侦察/截援必备（需侦察技巧）' },
    yunshu:    { id: 'yunshu', grp: 1, name: '运输平台', ab: '运', icon: '🚚', hp: 4200, atk: 10, def: 60, range: 10, spd: 150, gather: 1, load: 20000, pop: 4, mech: true, ride: true, time: 110, cost: { grain: 1800, wood: 1500, iron: 350 }, unlock: { junying: 5, tech: { fuzhong: 1 } }, desc: '专属运资，负重冠绝全军（需负重技巧）' },
    buxingji:  { id: 'buxingji', grp: 2, name: '步行机', ab: '步', icon: '🤖', hp: 1800, atk: 150, def: 150, range: 50, spd: 300, gather: 4, load: 60, pop: 1, time: 30, cost: { grain: 450, wood: 500, iron: 100 }, unlock: { junying: 1 }, desc: '双足步进机甲，攻守均衡，列阵之基' },
    dunwei:    { id: 'dunwei', grp: 2, name: '盾卫', ab: '盾', icon: '🛡️', hp: 2400, atk: 130, def: 250, range: 30, spd: 275, gather: 4, load: 50, pop: 1, time: 35, cost: { grain: 600, wood: 150, iron: 400 }, unlock: { junying: 3, shuyuan: 3, tech: { fanghu: 1 } }, desc: '高防御，炮灰首选（需防护技巧）' },
    daodanche: { id: 'daodanche', grp: 2, name: '导弹车', ab: '弹', icon: '🚀', hp: 1920, atk: 220, def: 50, range: 1200, spd: 250, gather: 5, load: 45, pop: 2, ride: true, time: 60, cost: { grain: 900, wood: 350, iron: 300 }, unlock: { junying: 4, shuyuan: 4, tech: { paoshe: 1 } }, desc: '远程主力，射程1200（需抛射技巧）' },
    wuzhi:     { id: 'wuzhi', grp: 2, name: '武装直升机', ab: '直', icon: '🚁', hp: 3840, atk: 330, def: 150, range: 1000, spd: 450, gather: 7, load: 120, pop: 2, ride: true, time: 65, cost: { grain: 3600, wood: 500, iron: 800 }, unlock: { junying: 9, shuyuan: 7, majiu: 3, city: 'hebei', tech: { paoshe: 5, jiayu: 5 } }, desc: '低空火力，射程1000（需抛射/驾驭技巧）' },
    zhuzhan:   { id: 'zhuzhan', grp: 2, name: '主战机甲', ab: '主', icon: '🦾', hp: 8400, atk: 700, def: 400, range: 80, spd: 750, gather: 10, load: 220, pop: 4, ride: true, time: 150, cost: { grain: 5400, wood: 700, iron: 2000 }, unlock: { junying: 7, shuyuan: 6, majiu: 3, tech: { jiayu: 2, fanghu: 2 } }, desc: '主战序列，攻700防400，攻守兼备（需车库3 + 驾驭/防护技巧）' },
    kuanglie:  { id: 'kuanglie', grp: 3, name: '狂猎', ab: '狂', icon: '⚔️', hp: 5400, atk: 510, def: 280, range: 70, spd: 850, gather: 10, load: 150, pop: 3, ride: true, time: 70, cost: { grain: 4500, wood: 800, iron: 1200 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'sili', tech: { tongshuai: 9, lianbing: 7 } }, desc: '旧军猎团，冲击力冠绝全军（需霜脊首府）' },
    dianci:    { id: 'dianci', grp: 3, name: '电磁盾卫', ab: '磁', icon: '🔋', hp: 3600, atk: 340, def: 350, range: 60, spd: 300, gather: 5, load: 55, pop: 2, time: 35, cost: { grain: 1800, wood: 300, iron: 500 }, unlock: { junying: 8, shuyuan: 7, city: 'yizhou', tech: { fanghu: 8 } }, desc: '电磁护盾，防350，刀枪不入（惧火 · 需雾谷首府）' },
    huopao:    { id: 'huopao', grp: 3, name: '自行火炮', ab: '炮', icon: '💥', hp: 6600, atk: 950, def: 200, range: 1600, spd: 100, gather: 2, load: 30, pop: 4, craft: true, mech: true, time: 5830, cost: { grain: 15000, wood: 5000, stone: 8000, iron: 1200 }, unlock: { junying: 10, shuyuan: 10, gongjiangzuofang: 7 }, desc: '攻950射程1600，攻城巨炮（机工坊制造）' },
    wuren:     { id: 'wuren', grp: 3, name: '无人轰炸机', ab: '轰', icon: '🛩️', hp: 5400, atk: 500, def: 160, range: 1400, spd: 120, gather: 2, load: 20, pop: 3, craft: true, mech: true, vsMech: 3, time: 2910, cost: { grain: 7500, wood: 3000, iron: 1800 }, unlock: { junying: 8, shuyuan: 8, gongjiangzuofang: 3 }, desc: '强力远程，拆械破车，攻城必带（机工坊制造）' },
    taitan:    { id: 'taitan', grp: 3, name: '泰坦机甲', ab: '泰', icon: '👾', hp: 15000, atk: 620, def: 300, range: 70, spd: 400, gather: 12, load: 800, pop: 5, ride: true, time: 300, cost: { grain: 9000, wood: 1000, iron: 2500 }, unlock: { junying: 9, shuyuan: 8, city: 'yizhou', tech: { yiliao: 8, zhandou: 7 } }, desc: '辐射变异的巨兽机甲，血厚守坚，凭蛮力硬拼（需雾谷首府）' },
  };"""

s = s.replace(old_block, NEW_BLOCK)

# ---------- ② 旧标定注释块加 v89.229 帽注（沿革保留 + 指路） ----------
old_note = """  /* ============================================================
   * v89.163（老板「缩减征兵时长，步兵1分钟以内，机车5分钟以内」）"""
new_note = """  /* ⚠️ v89.229 兵种重构：以下三段（v89.163/180/181）为**历史标定沿革** ——
     其中兵种名（重弩车/王牌战车/长枪手…）为当时称谓，现行 id/名映射见 DATA.STROOPS 注释。 */
  /* ============================================================
   * v89.163（老板「缩减征兵时长，步兵1分钟以内，机车5分钟以内」）"""
assert s.count(old_note) == 1, 'v89.163 注释锚点 %d' % s.count(old_note)
s = s.replace(old_note, new_note)

assert s != rd()
if DRY:
    print('[DRY] TROOPS 表整块替换 + 帽注命中')
else:
    tmp = BASE + P + '.tmp229c1'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    # 写后自检
    import re
    keys = re.findall(r'^    (\w+):\s*\{ id:', t[t.index('DATA.TROOPS = {'):t.index('\n  };', t.index('DATA.TROOPS = {'))], re.M)
    assert len(keys) == 14, '表行数=%d' % len(keys)
    for k in ['banche', 'fujiche', 'zhencha', 'yunshu', 'buxingji', 'dunwei', 'daodanche', 'wuzhi', 'zhuzhan', 'kuanglie', 'dianci', 'huopao', 'wuren', 'taitan']:
        assert ("    %s:" % k) in t, '缺 %s' % k
    for old in ['minfu:', 'yibing:', 'chihou:', 'changqiang:', 'daodun:', 'gongjian:', 'qingji:', 'tieji:', 'zhouche:', 'chuangnu:', 'chongche:', 'toudan:', 'qingzhoubing:', 'tengjiabing:', 'tuqibing:', 'hubaoqi:', 'xiliangtieqi:', 'nanjiangxiangbing:']:
        assert t.count('    ' + old) == 0, '旧键残留 %s' % old
    print('[OK] data.js TROOPS 14 行已落盘 + 自检通过')
print('C1 DONE%s' % ('（DRY）' if DRY else ''))
