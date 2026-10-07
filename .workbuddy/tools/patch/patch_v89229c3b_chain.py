# -*- coding: utf-8 -*-
# v89.229 批 c3：state/battle/main/questdata/icons/data/ui —— 兵种引用全链换代 + 老档迁移
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    tmp = BASE + p + '.tmp229c3'
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

# ================= 1) state.js =================
rep1('js/state.js', [
    ("var mix = I.mix || { yibing: 0.30, changqiang: 0.22, daodun: 0.18, gongjian: 0.18, qingji: 0.12 };",
     "var mix = I.mix || { buxingji: 0.52, dunwei: 0.18, daodanche: 0.18, fujiche: 0.12 };   /* v89.229：18→14 映射（民兵 0.30+长矛手 0.22 → 步行机 0.52） */", 'imix'),
    ("      GAME.migrateTechs191(st);",
     """      GAME.migrateTechs191(st);
      /* v89.229 兵种重构（18→14）：旧兵种 id 并入新 id（数量相加/队列改指/战术表改键）。
         幂等（st.troopMig229 标记）；新档不经本链（只走 newGame）——天然无迁移残留。 */
      GAME.migrateTroops229(st);""", 'adopt-call'),
])

s = rd('js/state.js')
if 'GAME.migrateTroops229 = function' not in s:
    i = s.find('GAME.migrateTechs191 = function')
    assert i > 0, 'migrateTechs191 未找到'
    j = s.find('\n  GAME.', i + 30)
    assert j > i
    FUNC = """

  /* ============================================================
   * v89.229 兵种重构（18→14）：**老档兵种 id 迁移**
   * ------------------------------------------------------------
   * 映射表（唯一来源）：旧 id → 新 id。合并项（多个旧 id 落同一位）**数量相加**；
   * 队列/战术/战报等"引用型"字段**改指新 id**（同值不并）。幂等：st.troopMig229。
   * 覆盖容器：城池驻军 / 训练队列 / 行军 / 挂起战斗（atkArmy+sim.scArmy）/
   *   采集队 / 野地驻守 / 任务储备（quests.stash）/ 战术设置表 / 战报四表。
   * 容器缺项即跳过（防御式——结构随版本演进）。
   * ============================================================ */
  GAME.TROOP_MAP_229 = {
    minfu: 'banche', qingji: 'fujiche', chihou: 'zhencha', zhouche: 'yunshu',
    yibing: 'buxingji', changqiang: 'buxingji', qingzhoubing: 'kuanglie',
    daodun: 'dunwei', gongjian: 'daodanche', tuqibing: 'wuzhi',
    tieji: 'zhuzhan', xiliangtieqi: 'zhuzhan', hubaoqi: 'kuanglie',
    tengjiabing: 'dianci', toudan: 'huopao', chongche: 'huopao',
    chuangnu: 'wuren', nanjiangxiangbing: 'taitan'
  };
  GAME.migrateTroops229 = function (st) {
    if (!st || st.troopMig229) return;
    var MAP = GAME.TROOP_MAP_229;
    var fixArmy = function (o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var nk = MAP[k];
        if (nk && nk !== k) {
          o[nk] = (o[nk] || 0) + (o[k] || 0);
          delete o[k];
        }
      });
    };
    var fixRef = function (box, key) {
      if (box && MAP[box[key]]) box[key] = MAP[box[key]];
    };
    (st.cities || []).forEach(function (c) { if (c) fixArmy(c.army); });
    ((st.queues && st.queues.train) || []).forEach(function (q) { if (q) fixRef(q, 'troopId'); });
    (st.marches || []).forEach(function (m) { if (m) { fixArmy(m.army); fixRef(m, 'troopId'); } });
    (st.battles || []).forEach(function (b) {
      if (!b) return;
      fixArmy(b.atkArmy);
      fixArmy(b.army);
      if (b.sim) { fixArmy(b.sim.scArmy); fixArmy(b.sim.defArmy); }
    });
    (st.gathers || []).forEach(function (g) { if (g) fixArmy(g.army); });
    (st.wilds || []).forEach(function (w) {
      if (w && w.garrison && w.garrison.troops) fixArmy(w.garrison.troops);
    });
    if (st.quests && st.quests.stash) fixArmy(st.quests.stash);
    (function () {
      var t = st.tactics;
      if (!t || typeof t !== 'object') return;
      var fixT = function (tb) {
        if (!tb || typeof tb !== 'object') return;
        Object.keys(tb).forEach(function (k) {
          var nk = MAP[k];
          if (nk && nk !== k) { tb[nk] = tb[k]; delete tb[k]; }
        });
      };
      if (t.atk || t.def) { fixT(t.atk); fixT(t.def); }
      else fixT(t);
    })();
    (st.reports || []).forEach(function (r) {
      if (!r) return;
      ['atkStart', 'atkLoss', 'defStart', 'defLoss'].forEach(function (kk) { fixArmy(r[kk]); });
      if (r.result) {
        ['atkStartBy', 'atkLossBy', 'defStartBy', 'defLossBy'].forEach(function (kk) { fixArmy(r.result[kk]); });
      }
    });
    st.troopMig229 = 1;
  };
"""
    s = s[:j] + FUNC + s[j:]
    if not DRY:
        wr('js/state.js', s)
        print('[OK] state.js migrateTroops229 已插入')
    else:
        print('[DRY] state.js migrateTroops229 待插入')
else:
    print('[skip] migrateTroops229 已存在')

# ================= 2) battle.js =================
rep1('js/battle.js', [
    ("""    if (/qi$|tieqi|qingji/.test(t.id) || t.name.indexOf('骑') >= 0) {
      return m * (1 + TB('ride'));                                // 机车
    }""",
     """    if (t.ride) {
      /* v89.229：id 模式匹配（/qi$|tieqi|qingji/）退役 —— 兵种重构后 id 无此规律，
         改读 TROOPS 的显式字段 `ride`（原 cav 类的显式化）。 */
      return m * (1 + TB('ride'));                                // 机车
    }""", 'ride'),
    ("var UNK = cfg.unknownAs || 'minfu';",
     "var UNK = cfg.unknownAs || 'banche';   /* v89.229：搬运工 → 板车 */", 'unk'),
    ("*     —— 真机实测：战后取配方拿到的是 `{qingji:0, gongjian:0, …}`，",
     "*     —— 真机实测：战后取配方拿到的是 `{fujiche:0, daodanche:0, …}`，", 'note'),
])

# ================= 3) main.js =================
rep1('js/main.js', [
    ("""        ui.toast('请选择押运兵力 —— 辎重靠人挑（搬运工载重 ' + DATA.TROOPS.minfu.load
          + ' / 运输车 ' + DATA.TROOPS.zhouche.load + '）');""",
     """        ui.toast('请选择押运兵力 —— 辎重靠车运（板车载重 ' + DATA.TROOPS.banche.load
          + ' / 运输平台 ' + DATA.TROOPS.yunshu.load + '）');""", 'm1'),
])

# ================= 4) ui.js =================
s = rd('js/ui.js')
_old1 = "+ U.fmt(_capW) + '</b>（搬运工 ' + DATA.TROOPS.minfu.load + ' / 运输车 ' + DATA.TROOPS.zhouche.load"
assert s.count(_old1) == 1, ('u1', s.count(_old1))
s = s.replace(_old1, "+ U.fmt(_capW) + '</b>（板车 ' + DATA.TROOPS.banche.load + ' / 运输平台 ' + DATA.TROOPS.yunshu.load")
_old2 = "ui._trainSel = 'yibing';"
assert s.count(_old2) == 2, ('u2', s.count(_old2))
s = s.replace(_old2, "ui._trainSel = 'buxingji';")
if not DRY:
    wr('js/ui.js', s)
    print('[OK] js/ui.js 3 处（含子串双击）')
else:
    print('[DRY] js/ui.js 3 处命中')

# ================= 5) questdata.js =================
rep1('js/questdata.js', [
    ("metric: 'troopCount', sub: 'gongjian', goal: 200, reward: { iron: 20000, gold: 8000 } },",
     "metric: 'troopCount', sub: 'daodanche', goal: 200, reward: { iron: 20000, gold: 8000 } },", 'g20'),
    ("metric: 'troopCount', sub: 'changqiang', goal: 200, reward: { iron: 20000, gold: 8000 } },",
     "metric: 'troopCount', sub: 'buxingji', goal: 200, reward: { iron: 20000, gold: 8000 } },", 'g21'),
    ("metric: 'troopCount', sub: 'tieji', goal: 50, reward: { iron: 40000, gold: 20000 } },",
     "metric: 'troopCount', sub: 'zhuzhan', goal: 50, reward: { iron: 40000, gold: 20000 } },", 'g22'),
    ("metric: 'troopCount', sub: 'chongche', goal: 20, reward: { wood: 60000, gold: 30000 } },",
     "metric: 'troopCount', sub: 'huopao', goal: 20, reward: { wood: 60000, gold: 30000 } },", 'g23'),
    ("{ id: 'r02', title: '弩手扩充', type: 'military', desc: '强弩之末，不可穿鲁缟；补足弩手，方能制敌。', metric: 'troopCount', sub: 'gongjian', goal: 120,",
     "{ id: 'r02', title: '导弹列阵', type: 'military', desc: '远火制敌，先发为强；补足导弹车，方能制敌。', metric: 'troopCount', sub: 'daodanche', goal: 120,", 'r02'),
    ("{ id: 'r03', title: '盾阵补充', type: 'military', desc: '盾卫当先，为全军之蔽。', metric: 'troopCount', sub: 'daodun', goal: 100,",
     "{ id: 'r03', title: '盾阵补充', type: 'military', desc: '盾卫当先，为全军之蔽。', metric: 'troopCount', sub: 'dunwei', goal: 100,", 'r03'),
    ("{ id: 'r04', title: '长矛如林', type: 'military', desc: '矛阵严整，宜多备之。', metric: 'troopCount', sub: 'changqiang', goal: 100,",
     "{ id: 'r04', title: '步甲如林', type: 'military', desc: '步甲严整，宜多备之。', metric: 'troopCount', sub: 'buxingji', goal: 100,", 'r04'),
    ("{ id: 'r05', title: '侦察兵远探', type: 'military', desc: '不知敌情而战，必败。', metric: 'troopCount', sub: 'chihou', goal: 40,",
     "{ id: 'r05', title: '侦察远探', type: 'military', desc: '不知敌情而战，必败。', metric: 'troopCount', sub: 'zhencha', goal: 40,", 'r05'),
    ("{ id: 'r06', title: '游骑断粮', type: 'military', desc: '游骑剽掠，断敌粮道。', metric: 'troopCount', sub: 'qingji', goal: 30,",
     "{ id: 'r06', title: '伏击断粮', type: 'military', desc: '伏击剽掠，断敌补给。', metric: 'troopCount', sub: 'fujiche', goal: 30,", 'r06'),
    ("{ id: 'r07', title: '铁流成军', type: 'military', desc: '装甲成列，正面破阵。', metric: 'troopCount', sub: 'tieji', goal: 20,",
     "{ id: 'r07', title: '机甲成军', type: 'military', desc: '机甲成列，正面破阵。', metric: 'troopCount', sub: 'zhuzhan', goal: 20,", 'r07'),
    ("{ id: 'r08', title: '器械之备', type: 'military', desc: '攻城非器不可。', metric: 'troopCount', sub: 'chongche', goal: 8,",
     "{ id: 'r08', title: '器械之备', type: 'military', desc: '攻城非器不可。', metric: 'troopCount', sub: 'wuren', goal: 8,", 'r08'),
    ("{ id: 'r09', title: '炮火破城', type: 'military', desc: '炮火之威，可碎城楼。', metric: 'troopCount', sub: 'toudan', goal: 5,",
     "{ id: 'r09', title: '炮火破城', type: 'military', desc: '炮火之威，可碎城楼。', metric: 'troopCount', sub: 'huopao', goal: 5,", 'r09'),
    ("{ id: 'g20', title: '强弩之利', desc: '强弩利矢，可制敌于百步之外。', guide: '弩手 200 名。',",
     "{ id: 'g20', title: '导弹之利', desc: '导弹齐射，可制敌于百步之外。', guide: '导弹车 200 名。',", 'n1'),
    ("{ id: 'g21', title: '长矛成林', desc: '矛阵森严，拒马如林。', guide: '长矛手 200 名。',",
     "{ id: 'g21', title: '机甲成林', desc: '步甲森严，列阵如林。', guide: '步行机 200 名。',", 'n2'),
    ("{ id: 'g22', title: '铁流三千', desc: '装甲成列，所向披靡。', guide: '装甲战车 50 名。',",
     "{ id: 'g22', title: '铁流三千', desc: '机甲成列，所向披靡。', guide: '主战机甲 50 名。',", 'n3'),
    ("{ id: 'g23', title: '攻城之器', desc: '非械不能克坚城。', guide: '破门车 20 乘。',",
     "{ id: 'g23', title: '攻城之器', desc: '非械不能克坚城。', guide: '自行火炮 20 乘。',", 'n4'),
])

# ================= 6) icons.js TR 表 =================
s = rd('js/icons.js')
i = s.find('var TR = {')
assert i > 0
j = s.index('\n  };', i) + len('\n  };')
old_tr = s[i:j]
assert 'minfu:' in old_tr and 'nanjiangxiangbing:' in old_tr
NEW_TR = """var TR = {
    /* v89.229 兵种重构：18→14 —— 按原型继承剪影（tone/cls/w），14 个新 id 全覆盖；
       位图（assets/icons/ui/ai_<id>.png）缺省回退本表（forTroop 老绘制路径）。
       新增兵种只在本表登记即可（与 TROOPS 表同构扩展）。 */
    banche:    { tone: ['#a89070', '#c4a985', '#8a7154'], cls: 'cart', w: 'cart' },
    fujiche:   { tone: ['#8a7358', '#a88e6c', '#665340'], w: 'sword', cls: 'mount', mount: true },
    zhencha:   { tone: ['#7f9a86', '#9fb8a4', '#5f7a68'], cls: 'bow', w: 'bow', light: true },
    yunshu:    { tone: ['#96876c', '#b2a184', '#70624c'], cls: 'cart', w: 'cart' },
    buxingji:  { tone: ['#8f7a5e', '#ac9673', '#6d5c48'], cls: 'foot', w: 'spear' },
    dunwei:    { tone: ['#8a7f6a', '#a89c84', '#6a6050'], cls: 'foot', w: 'shield' },
    daodanche: { tone: ['#8e9463', '#a8ae7c', '#6c714c'], cls: 'bow', w: 'bow' },
    wuzhi:     { tone: ['#7a8a6a', '#98a886', '#586648'], w: 'bow', cls: 'mount', mount: true },
    zhuzhan:   { tone: ['#8a5f45', '#a87c5e', '#654232'], w: 'sword', cls: 'mount', mount: true },
    kuanglie:  { tone: ['#8f6a3c', '#ab864f', '#6a4c29'], w: 'spear', cls: 'mount', mount: true },
    dianci:    { tone: ['#6e8f5c', '#8cab77', '#4f6a41'], cls: 'foot', w: 'shield' },
    huopao:    { tone: ['#75664b', '#8f7d5c', '#544a36'], cls: 'cart', w: 'cart' },
    wuren:     { tone: ['#7d7154', '#9a8d6c', '#5c5240'], cls: 'bow', w: 'bow' },
    taitan:    { tone: ['#6f7a8a', '#8d98a8', '#525b68'], w: 'axe', beast: true },
  };"""
s = s.replace(old_tr, NEW_TR)
if not DRY:
    wr('js/icons.js', s)
    print('[OK] icons.js TR 表 14 键')
else:
    print('[DRY] icons.js TR 表命中')

# ================= 7) data.js unknownAs =================
rep1('js/data.js', [
    ("· `unknownAs: 'minfu'` = 无明细俘虏（旧档 / 骰子引擎）视为**搬运工**入军",
     "· `unknownAs: 'banche'` = 无明细俘虏（旧档 / 骰子引擎）视为**板车**入军（v89.229 换代）", 'capt-note'),
    ("conscriptPct: 0.5, unknownAs: 'minfu' };",
     "conscriptPct: 0.5, unknownAs: 'banche' };", 'capt-def'),
])

print('C3 DONE%s' % ('（DRY）' if DRY else ''))
