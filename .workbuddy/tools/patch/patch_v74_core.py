# -*- coding: utf-8 -*-
"""v74 核心层补丁：①取消人口加成 / ⑤按类型成长 + 自由属性点

【① 取消将领对人口上限的加成】
  · domain.js GAME.maxPopOf：守将统率 → 人口上限 的加成整段撤除
  · data.js DATA.POP_PER_TONG 随之下线（两处引用全部消失，避免零引用字段）

【⑤ 类型化成长 + 自由属性点】
  · state.js GAME.applyLevelGrowth：自动加点改**类型化**（权重复用 DATA.GEN_STYLES.mul，
    归一化到总和 4 —— 均衡 1/1/1/1 与旧行为逐点一致）；每级另发**自由属性点**（= 成长值）
  · state.js GAME.rankOf：freePts 字段懒初始化（旧档将领按已过等级一次性补发）
  · state.js GAME.addFreePoint：自由点分配的**唯一出口**（六维都能加、只增不减）
  · state.js GAME.genAttrs：速度与体力上限吃下 g.spdAdd / g.staAdd（自由点投放处）
  · domain.js GAME.staBaseMax：体力上限 + g.staAdd
"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    total = t.count('\n')
    crlf = t.count('\r\n') > (total - t.count('\r\n'))

    def to_dom(s):
        return s.replace('\n', '\r\n') if crlf else s.replace('\r\n', '\n')

    def to_alt(s):
        return s.replace('\r\n', '\n') if crlf else s.replace('\n', '\r\n')

    pairs = [(to_dom(old), to_dom(new))]
    if to_alt(old) != to_dom(old):
        pairs.append((to_alt(old), to_alt(new)))
    for o2, n2 in pairs:
        if n2 in t:
            print('  · %s：已改过（跳过）' % tag)
            return
    hit = [(o, n) for o, n in pairs if t.count(o) == 1]
    if not hit:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(pairs[0][0])))
        sys.exit(1)
    o2, n2 = hit[0]
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(o2, n2, 1))
    print('  ✓ %s' % tag)


DATA = os.path.join(ROOT, 'js', 'data.js')
DOM = os.path.join(ROOT, 'js', 'domain.js')
ST = os.path.join(ROOT, 'js', 'state.js')
BAT = os.path.join(ROOT, 'js', 'battle.js')

print('========== ① 人口加成下线 ==========')
patch(
    DOM,
    """    /* 守将统率的人口贡献（报告 9.2：统率 1 点 = 影响 100 军队 + 1000 人口）
     * 此前只落地了「带兵 100」，人口这一半一直没实现 —— 守将因此缺少经营价值 */
    if (!ignoreGuard && GAME.guardGeneralOf) {
      var g = GAME.guardGeneralOf(city);
      if (g) cap += Math.round(GAME.genAttrs(g).tong * (DATA.POP_PER_TONG || 1000));
    }
    return cap;""",
    """    /* v74（老板需求 1）：「取消将领对人口上限的加成」——
       守将统率的人口贡献整段撤除（DATA.POP_PER_TONG 一并下线）。
       人口上限从此**只**由民房（+ 满级专精）决定：一个来源，一眼可查。
       （`ignoreGuard` 参数保留：历史调用点传 true 表示"不含守将加成"，
        现在本来就没有该加成 —— 不删参数是为了不动那些调用点。） */
    return cap;""",
    'C1 maxPopOf 去守将人口加成',
)
patch(
    DATA,
    """  /* 统率 1 点贡献的人口上限（报告 9.2）*/
  DATA.POP_PER_TONG = 1000;
""",
    """  /* v74（老板需求 1）：「取消将领对人口上限的加成」—— POP_PER_TONG 随之下线
     （原"报告 9.2：统率 1 点 = 影响 100 军队 + 1000 人口"的人口那一半已撤除）。 */
""",
    'C2 POP_PER_TONG 下线',
)

print()
print('========== ⑤ 类型化成长 + 自由属性点 ==========')
patch(
    ST,
    """    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    return rk;
  };""",
    """    g.rank = rk.id;
    if (!g.style) g.style = 'balance';
    /* v74（老板需求 5）：自由属性点字段的懒初始化（一次性）——
       旧档将领**按已过等级补发**：每级 = 该资质成长值（与 applyLevelGrowth 同口径）。
       标记方式就是字段本身（null = 还没初始化过；之后每升一级 += 成长值）。 */
    if (g.freePts == null) {
      g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rk.grow || 1);
    }
    return rk;
  };""",
    'C3 rankOf 自由点懒初始化',
)

patch(
    ST,
    """  GAME.applyLevelGrowth = function (g) {
    var rk = GAME.rankOf(g);
    var step = rk.grow || 1;
    g.tong += step; g.yw += step; g.zm += step; g.nz += step;
    g.attack = Math.round(g.attack + step * 0.4);
    g.defense = Math.round(g.defense + step * 0.4);""",
    """  GAME.applyLevelGrowth = function (g) {
    var rk = GAME.rankOf(g);
    var step = rk.grow || 1;
    /* v74（老板需求 5）：「不同类型（均衡 / 猛将等）将领，升级自动加点不同。
       根据资质，每级除了其成长之外，还有等于成长值的自由属性点」。
       · 自动加点 = step × 类型权重 —— 权重**复用 DATA.GEN_STYLES 的 mul**
         （造人时那套特性表，不再另造一份；归一化到总和 4，
          均衡 1/1/1/1 与旧行为逐点一致，老档只受影响于新涨的等级）；
       · 自由属性点 = step —— 玩家在六维表逐点分配（唯一出口 GAME.addFreePoint）。 */
    var st74 = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st74 = x; });
    var m74 = (st74 && st74.mul) || { tong: 1, nz: 1, yw: 1, zm: 1 };
    var sum74 = (m74.tong + m74.nz + m74.yw + m74.zm) || 4;
    var f74 = 4 / sum74;
    g.tong += step * m74.tong * f74;
    g.yw += step * m74.yw * f74;
    g.zm += step * m74.zm * f74;
    g.nz += step * m74.nz * f74;
    g.freePts = (g.freePts == null ? 0 : g.freePts) + step;
    g.attack = Math.round(g.attack + step * 0.4);
    g.defense = Math.round(g.defense + step * 0.4);""",
    'C4 applyLevelGrowth 类型化 + 自由点',
)

patch(
    ST,
    """  /* 生成 NPC 城 */
  GAME.buildNpcCities = function (seed) {""",
    """  /* 自由属性点分配（v74 · 老板需求 5 · **唯一出口**）：
     六维都能加（统率/内政/勇武/智谋/速度/体力），**只能加、不能减**。
     四项主属性走 g[stat]+=1；速度 / 体力另有独立加法位（spdAdd / staAdd），
     由 genAttrs 与 staBaseMax 各自吃进去 —— 属性本身保持"基础值"不被污染。 */
  GAME.addFreePoint = function (g, stat) {
    if (!g || ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'].indexOf(stat) < 0) {
      return { ok: false, msg: '该属性不支持加点' };
    }
    if ((g.freePts || 0) < 1) {
      return { ok: false, msg: '自由属性点不足（升级获得：每级 = 资质成长值）' };
    }
    g.freePts -= 1;
    var nm = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' }[stat];
    if (stat === 'spd') g.spdAdd = (g.spdAdd || 0) + 1;
    else if (stat === 'sta') g.staAdd = (g.staAdd || 0) + 1;
    else g[stat] = (g[stat] || 0) + 1;
    GAME.log('🎯 ' + g.name + ' ' + nm + ' +1（自由点 -1，余 ' + g.freePts + '）');
    return { ok: true, msg: g.name + ' ' + nm + ' +1（余 ' + g.freePts + ' 点）' };
  };

  /* 生成 NPC 城 */
  GAME.buildNpcCities = function (seed) {""",
    'C5 GAME.addFreePoint',
)

patch(
    DOM,
    """      /* 速度 = 出身脚力 + 等级成长 + 装备/套装/坐骑（全部相加，不做乘算）。
         等级成长直接**派生**而不写进 g.speed：这样老存档不用迁移也能立刻对上，
         也不会出现"升级时加一次、求和时又加一次"的双重计数。 */
      spd: Math.round((g.speed || 0) + Math.max(0, (g.level || 1) - 1) + b.spd),""",
    """      /* 速度 = 出身脚力 + 等级成长 + 装备/套装/坐骑 + 自由点（全部相加，不做乘算）。
         等级成长直接**派生**而不写进 g.speed：这样老存档不用迁移也能立刻对上，
         也不会出现"升级时加一次、求和时又加一次"的双重计数。
         v74：自由点投放的 spdAdd 也走这条和（与装备同层，但来源清楚）。 */
      spd: Math.round((g.speed || 0) + Math.max(0, (g.level || 1) - 1) + b.spd + (g.spdAdd || 0)),""",
    'C6 genAttrs 速度吃 spdAdd',
)

patch(
    DOM,
    """  GAME.staBaseMax = function (g) {
    var S = DATA.STAMINA;
    if (!g) return S.base;
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    var grow = (rk && rk.grow) || 1;
    var nz = g.nz || 0;
    return S.base + Math.max(0, (g.level || 1) - 1) * grow * S.perLevel * (1 + nz / S.nzDiv);
  };""",
    """  GAME.staBaseMax = function (g) {
    var S = DATA.STAMINA;
    if (!g) return S.base;
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    var grow = (rk && rk.grow) || 1;
    var nz = g.nz || 0;
    /* v74：自由点投放的 staAdd 计入上限（与等级/资质/内政同层） */
    return S.base + Math.max(0, (g.level || 1) - 1) * grow * S.perLevel * (1 + nz / S.nzDiv)
      + (g.staAdd || 0);
  };""",
    'C7 体力上限吃 staAdd',
)

patch(
    BAT,
    """      GAME.log('⭐ 将领 ' + gen.name + ' 升至 Lv' + gen.level + '（四维 +' + step + '）');""",
    """      GAME.log('⭐ 将领 ' + gen.name + ' 升至 Lv' + gen.level +
        '（自动加点 +' + step + ' · 自由点 +' + step + '）');""",
    'C8 升级日志口径更新',
)

print()
print('========== 核心层补丁完成 ==========')
