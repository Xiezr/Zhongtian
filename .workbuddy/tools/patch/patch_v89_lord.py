# -*- coding: utf-8 -*-
"""v89 君主专属收口：修炼线（装备/蕴养/游历）唯一闸门 GAME.canCultivate + 老档迁移。探针幂等。"""
import io

FILES = {}

def edit(path, old, new, tag, probe):
    d = FILES.get(path)
    if d is None:
        d = io.open(path, encoding='utf-8', newline='').read()
    if probe in d:
        FILES[path] = d
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, tag + ' 锚点命中 %d 次' % c
    FILES[path] = d.replace(old, new, 1)
    print('OK ' + tag)

ST = r'E:\Deepseekdb\js\state.js'
SY = r'E:\Deepseekdb\js\systems.js'
DO = r'E:\Deepseekdb\js\domain.js'
UI = r'E:\Deepseekdb\js\ui.js'

# ============ state.js ============
edit(ST, r"""  GAME.isLordGeneral = function (g) { return !!(g && g.isLord); };""",
r"""  GAME.isLordGeneral = function (g) { return !!(g && g.isLord); };
  /* v89（老板：「只有君主将有修炼功能，以及相应装备」）——
     修炼资格**唯一闸门**：灵气装备 / 蕴养 / 江湖游历全链只认君主一人
     （对应功法文档 0.1「主角单修」）。全站判断一律走这里，日后要放开只改这一处。 */
  GAME.canCultivate = function (g) { return GAME.isLordGeneral(g); };""",
    'S1 canCultivate 闸门', 'GAME.canCultivate = function (g)')

edit(ST, r"""  GAME.toggleEquipSet = function (genId, want) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var cur = g.equipOn || 'sha';""",
r"""  GAME.toggleEquipSet = function (genId, want) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    /* v89：修炼线君主专属 —— 非君主一切切换请求拒绝，并归位军装（老档兜底） */
    if (!GAME.canCultivate(g)) {
      if (g.equipOn === 'ling') g.equipOn = 'sha';
      return { ok: false, msg: '修炼乃君主专属 —— 只有君主可切换修炼装备' };
    }
    var cur = g.equipOn || 'sha';""",
    'S2 toggleEquipSet 闸门', '修炼乃君主专属 —— 只有君主可切换修炼装备')

edit(ST, r"""    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if ((gen.energy || 0) < a.energy) {""",
r"""    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    /* v89：江湖游历君主专属（主角单修）—— 与装备/蕴养同一道闸门 */
    if (!GAME.canCultivate(gen)) return { ok: false, msg: '江湖游历乃君主亲历之事 —— 只有君主可前往' };
    if ((gen.energy || 0) < a.energy) {""",
    'S3 jianghuCheck 闸门', '江湖游历乃君主亲历之事')

edit(ST, r"""    return { ok: true, act: a, gen: gen, day: day, lv: GAME.map.wildLevelNow(x, y) };""",
r"""    return { ok: true, act: a, gen: gen, day: day, lv: GAME.map.wildLevelNow(x, y), x: x, y: y, actId: actId };""",
    'S4 chk 补 x/y/actId', 'lv: GAME.map.wildLevelNow(x, y), x: x, y: y, actId: actId };')

edit(ST, r"""      /* v79：装备单件化迁移（旧 id 串 → 实例；旧"按种"强化并入首件） */
      if (GAME.migrateEquipModel) GAME.migrateEquipModel(st);""",
r"""      /* v79：装备单件化迁移（旧 id 串 → 实例；旧"按种"强化并入首件） */
      if (GAME.migrateEquipModel) GAME.migrateEquipModel(st);
      /* v89：修炼线君主专属 —— 旧档里非君主身上的灵气装备归还背包、归位军装 */
      if (GAME.migrateLordLing) GAME.migrateLordLing(st);""",
    'S5 loadFrom 迁移挂钩', 'if (GAME.migrateLordLing) GAME.migrateLordLing(st);')

# ============ systems.js ============
edit(SY, r"""  S.equipBagOf = function (g) {
    if (!g) return {};
    return ((g.equipOn === 'ling') ? g.lingEquip : g.equip) || {};
  };""",
r"""  S.equipBagOf = function (g) {
    if (!g) return {};
    /* v89：非君主恒军装（修炼线君主专属 —— 闸门唯一，见 GAME.canCultivate） */
    return ((g.equipOn === 'ling' && GAME.canCultivate(g)) ? g.lingEquip : g.equip) || {};
  };""",
    'Y1 equipBagOf 闸门', '非君主恒军装')

edit(SY, r"""    var bag = S.equipBagOf(g);
    var isLing = (g.equipOn === 'ling');
    /* 驯马技巧：坐骑装备属性 +5%/级（仅军装侧 —— 修炼装备独立体系不吃它） */""",
r"""    var bag = S.equipBagOf(g);
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    /* 驯马技巧：坐骑装备属性 +5%/级（仅军装侧 —— 修炼装备独立体系不吃它） */""",
    'Y2 genEquipBonus 联动', "(g.equipOn === 'ling') && GAME.canCultivate(g);\n    /* 驯马技巧")

edit(SY, r"""    /* v88：只作用于**当前生效套**（军装模式挑军装，修炼模式挑修炼） */
    var isLing = (g.equipOn === 'ling');""",
r"""    /* v88：只作用于**当前生效套**（军装模式挑军装，修炼模式挑修炼）；
       v89：非君主恒军装 */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);""",
    'Y3 autoEquipBest 联动', 'v89：非君主恒军装 */')

edit(SY, r"""    var chk = S.canEquip(g, ref);
    if (!chk.ok) return chk;
    var item = chk.item, inst = chk.inst;
    /* v88：按装备归属选袋 —— 修炼装备入 g.lingEquip，军装入 g.equip（各自 12 槽） */""",
r"""    var chk = S.canEquip(g, ref);
    if (!chk.ok) return chk;
    var item = chk.item, inst = chk.inst;
    /* v89：修炼装备君主专属（各处 UI 已藏入口，这里是最后一道闸） */
    if (item.ling && !GAME.canCultivate(g)) return { ok: false, msg: '修炼装备乃君主专属，' + g.name + ' 无法穿戴' };
    /* v88：按装备归属选袋 —— 修炼装备入 g.lingEquip，军装入 g.equip（各自 12 槽） */""",
    'Y4 equipItem 闸门', '修炼装备乃君主专属，')

# ============ domain.js ============
edit(DO, r"""    delete s.forgeEnh;
    s._eqModel2 = 1;
    return s;
  };""",
r"""    delete s.forgeEnh;
    s._eqModel2 = 1;
    return s;
  };

  /* v89（老板「只有君主将有修炼功能，以及相应装备」）：
     老档收口迁移 —— 非君主身上的灵气装备归还背包、归位军装；君主不受影响。
     一次性（s._lingLord1 标记），在 loadFrom 里与装备单件化迁移同点调用。 */
  GAME.migrateLordLing = function (s) {
    if (!s || s._lingLord1) return s;
    s.inventory = s.inventory || [];
    (s.generals || []).forEach(function (g) {
      if (!g || GAME.isLordGeneral(g)) return;
      var bag = g.lingEquip;
      if (bag) {
        for (var sl in bag) { if (bag[sl]) s.inventory.push(bag[sl]); }
        delete g.lingEquip;
      }
      if (g.equipOn === 'ling') g.equipOn = 'sha';
    });
    s._lingLord1 = 1;
    return s;
  };""",
    'D1 migrateLordLing', 'GAME.migrateLordLing = function (s)')

edit(DO, r"""  GAME.lingTemper = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备' };""",
r"""  GAME.lingTemper = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备' };
    /* v89：蕴养君主专属（修炼线）；防御性：该件若在非君主身上先拒绝 */
    if (!GAME.lordGeneralOf()) return { ok: false, msg: '君主不在，无从蕴养' };
    var wornOther = false;
    (s.generals || []).forEach(function (g2) {
      if (!g2 || GAME.isLordGeneral(g2) || !g2.lingEquip) return;
      for (var sl2 in g2.lingEquip) { if (g2.lingEquip[sl2] === inst) wornOther = true; }
    });
    if (wornOther) return { ok: false, msg: '该件在他人身上 —— 先卸下再蕴养' };""",
    'D2 lingTemper 闸门', '蕴养君主专属（修炼线）')

# ============ ui.js ============
edit(UI, r"""        '<div class="tip-a">Lv' + g.level + '　装备 ' + Object.keys(((g.equipOn === 'ling') ? g.lingEquip : g.equip) || {}).length + '/12' +""",
r"""        '<div class="tip-a">Lv' + g.level + '　装备 ' + Object.keys(GAME.systems.equipBagOf(g)).length + '/12' +""",
    'U1 列表 tip 计数', 'Object.keys(GAME.systems.equipBagOf(g)).length')

edit(UI, r"""    /* v88：当前生效套（'sha' 军中 / 'ling' 修炼）—— 本面板所有装备读取按它分流 */
    var isLing = (g.equipOn === 'ling');
    var eqCnt = Object.keys(((isLing ? g.lingEquip : g.equip) || {})).length;""",
r"""    /* v88：当前生效套（'sha' 军中 / 'ling' 修炼）—— 本面板所有装备读取按它分流；
       v89：非君主恒军装（修炼线君主专属） */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var isCult = GAME.canCultivate(g);
    var eqCnt = Object.keys(((isLing ? g.lingEquip : g.equip) || {})).length;""",
    'U2 genPane 分流闸门', 'var isCult = GAME.canCultivate(g);')

edit(UI, r"""    html += '<div class="gp-sec" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '装备栏（' + eqCnt + ' / 12）' +
      ui.help('军中装备用于攻城野战；修炼装备用于野地游历（灵力判定）。\n两套独立养成、整套切换生效 —— 点右侧按钮切换当前生效套。') +
      '<span style="margin-left:auto;display:inline-flex;gap:4px;">' +
        '<button class="btn sm' + (isLing ? '' : ' gold') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="sha">⚔ 军中</button>' +
        '<button class="btn sm' + (isLing ? ' gold' : '') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="ling">☯ 修炼</button>' +
      '</span>' +
      '</div>' +""",
r"""    /* v89：双轨 tab 只给君主（修炼线君主专属）；普通将领整块切换行不渲染 */
    html += '<div class="gp-sec" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '装备栏（' + eqCnt + ' / 12）' +
      ui.help(isCult
        ? '军中装备用于攻城野战；修炼装备用于野地游历（灵力判定）。\n两套独立养成、整套切换生效 —— 点右侧按钮切换当前生效套。'
        : '军中装备用于攻城野战。\n修炼一途乃君主专属，钦定不假他人。') +
      (isCult ? '<span style="margin-left:auto;display:inline-flex;gap:4px;">' +
        '<button class="btn sm' + (isLing ? '' : ' gold') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="sha">⚔ 军中</button>' +
        '<button class="btn sm' + (isLing ? ' gold' : '') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="ling">☯ 修炼</button>' +
      '</span>' : '') +
      '</div>' +""",
    'U3 双轨 tab 只给君主', '修炼一途乃君主专属，钦定不假他人。')

edit(UI, r"""    var isLing = (g.equipOn === 'ling');
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var inst = bag[slot];""",
r"""    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var inst = bag[slot];""",
    'U4 dollSlot 闸门', "&& GAME.canCultivate(g);\n    var bag = (isLing ? g.lingEquip : g.equip) || {};\n    var inst = bag[slot];")

edit(UI, r"""    if (g.equipOn === 'ling') return ui.dollLingPanel(g);""",
r"""    if (g.equipOn === 'ling' && GAME.canCultivate(g)) return ui.dollLingPanel(g);""",
    'U5 dollSetPanel 闸门', 'if (g.equipOn === \'ling\' && GAME.canCultivate(g)) return ui.dollLingPanel(g);')

edit(UI, r"""    var isLing = (g.equipOn === 'ling');
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var curInst = bag[slot];""",
r"""    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var curInst = bag[slot];""",
    'U6 openEqSlot 闸门', "&& GAME.canCultivate(g);\n    var bag = (isLing ? g.lingEquip : g.equip) || {};\n    var curInst = bag[slot];")

edit(UI, r"""    var gIsLing = (g.equipOn === 'ling');""",
r"""    var gIsLing = (g.equipOn === 'ling') && GAME.canCultivate(g);""",
    'U7 总览页闸门', "var gIsLing = (g.equipOn === 'ling') && GAME.canCultivate(g);")

edit(UI, r"""    var home = GAME.currentCity();
    var own = (s.generals || []).filter(function (g) { return g.cityId === home.id; });""",
r"""    var home = GAME.currentCity();
    /* v89：修炼线君主专属 —— 江湖游历只由君主亲往（主角单修） */
    var own = (s.generals || []).filter(function (g) { return g.cityId === home.id && GAME.isLordGeneral(g); });""",
    'U8 游历选将收口君主', '&& GAME.isLordGeneral(g); });')

edit(UI, r"""      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">每事每日一次 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">本地特色与江湖诸事都在这里：讨伐切磋、采药静修、拜访奇人——精华用于蕴养修炼装备。</div>';""",
r"""      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">君主亲往 · 每事每日一次 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">江湖诸事皆由君主亲历：讨伐切磋、采药静修、拜访奇人——点开即入全屏剧情，精华用于蕴养修炼装备。</div>';""",
    'U9 游历区块文案', '君主亲往 · 每事每日一次')

edit(UI, r"""      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">本城无将领可供差遣。</div>';""",
r"""      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">君主不在此城 —— 江湖之事，需君主亲至。</div>';""",
    'U10 无君主提示', '君主不在此城 —— 江湖之事，需君主亲至。')

edit(UI, r"""      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;">' +
        '<label style="color:var(--text-dim);">带队将领</label>' +
        '<input type="hidden" id="jh-gen" value="' + ui._jhGen + '">' +""",
r"""      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;">' +
        '<label style="color:var(--text-dim);">君主亲往</label>' +
        '<input type="hidden" id="jh-gen" value="' + ui._jhGen + '">' +""",
    'U11 选将行文案', "'<label style=\"color:var(--text-dim);\">君主亲往</label>' +")

edit(UI, r"""  ui.openLingTemper = function () {
    var list = GAME.lingTemperList();""",
r"""  ui.openLingTemper = function () {
    /* v89：蕴养君主专属 —— 无君主直接拒开 */
    if (!GAME.lordGeneralOf()) { ui.toast('君主不在，无从蕴养'); return; }
    var list = GAME.lingTemperList();""",
    'U12 蕴养面板闸门', '君主不在，无从蕴养')

# ---- 落盘 ----
for path, d in FILES.items():
    io.open(path, 'w', encoding='utf-8', newline='').write(d)
print()
print('落盘文件数:', len(FILES))
print('全部完成。')
