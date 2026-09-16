# -*- coding: utf-8 -*-
"""v88 工具层（domain.js）：双轨装备寻址兼容 + 品质名 + 蕴养函数组。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\domain.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

def sub(old, new, tag, probe):
    global d, dirty
    if probe in d:
        print('SKIP ' + tag)
        return
    assert d.count(old) == 1, tag + ' 锚点命中 %d 次' % d.count(old)
    d = d.replace(old, new, 1)
    dirty = True
    print('OK ' + tag)

# ---- 1) eqPieces：收集 g.lingEquip ----
sub(
"""  GAME.eqPieces = function () {
    var s = GAME.state, out = [];
    ((s && s.inventory) || []).forEach(function (x) { if (x) out.push(x); });
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) if (g.equip[sl]) out.push(g.equip[sl]);
    });
    return out;
  };""",
"""  GAME.eqPieces = function () {
    var s = GAME.state, out = [];
    ((s && s.inventory) || []).forEach(function (x) { if (x) out.push(x); });
    ((s && s.generals) || []).forEach(function (g) {
      /* v88：两套装备袋都要收（军装 g.equip / 修炼 g.lingEquip） */
      ['equip', 'lingEquip'].forEach(function (bk) {
        for (var sl in (g[bk] || {})) if (g[bk][sl]) out.push(g[bk][sl]);
      });
    });
    return out;
  };""",
    '1/6 eqPieces', 'v88：两套装备袋都要收')

# ---- 2) eqFind：两个袋都查（件号分支 + id 分支） ----
sub(
"""      ((s && s.generals) || []).forEach(function (g) {
        for (var sl in (g.equip || {})) if (g.equip[sl] && g.equip[sl].u === u) found = found || g.equip[sl];
      });""",
"""      ((s && s.generals) || []).forEach(function (g) {
        ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两袋都查 */
          for (var sl in (g[bk] || {})) if (g[bk][sl] && g[bk][sl].u === u) found = found || g[bk][sl];
        });
      });""",
    '2/6 eqFind 件号分支', "['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两袋都查 */")

sub(
"""    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) if (GAME.eqId(g.equip[sl]) === ref) found = found || g.equip[sl];
    });
    return found;
  };""",
"""    ((s && s.generals) || []).forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两袋都查 */
        for (var sl in (g[bk] || {})) if (GAME.eqId(g[bk][sl]) === ref) found = found || g[bk][sl];
      });
    });
    return found;
  };""",
    '3/6 eqFind id 分支', "['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两袋都查 */\n        for (var sl in (g[bk] || {})) if (GAME.eqId(g[bk][sl]) === ref)")

# ---- 3) 解雇归还：两套装备都归还 ----
sub(
"""    var back = 0;
    for (var slot in (g.equip || {})) { s.inventory.push(g.equip[slot]); back++; }""",
"""    var back = 0;
    /* v88：两套装备都归还（军装 + 修炼） */
    ['equip', 'lingEquip'].forEach(function (bk) {
      for (var slot in (g[bk] || {})) { s.inventory.push(g[bk][slot]); back++; }
    });""",
    '4/6 解雇归还', '/* v88：两套装备都归还（军装 + 修炼） */')

# ---- 4) 统计 equipCount：含修炼装备 ----
sub(
"""      case 'equipCount':
        t = 0; (s.generals || []).forEach(function (g) { t += Object.keys(g.equip || {}).length; });
        return t;""",
"""      case 'equipCount':
        /* v88：军装 + 修炼两套都计入 */
        t = 0; (s.generals || []).forEach(function (g) { t += Object.keys(g.equip || {}).length + Object.keys(g.lingEquip || {}).length; });
        return t;""",
    '5/6 统计 equipCount', '/* v88：军装 + 修炼两套都计入 */')

# ---- 5) qNameOf（品质名：两套各用各的名表）+ 6) 蕴养函数组 ----
sub(
"""  GAME.eqName = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    return it ? it.name : '（装备）';
  };""",
"""  GAME.eqName = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    return it ? it.name : '（装备）';
  };
  /* v88：品质名（两套各用各的名表 —— 军装 凡/良/珍/神，修炼 灵胚…道器） */
  GAME.qNameOf = function (it) {
    if (!it) return '';
    return it.ling ? ((DATA.LING_Q_NAME || {})[it.q] || '')
                   : ((DATA.Q_NAME || {})[it.q] || '');
  };""",
    '6/6a qNameOf', 'GAME.qNameOf = function (it)')

sub(
"""  /* --------- 君主改名（v77 · 君主面板） --------- */""",
"""  /* ============================================================
   * v88 · 蕴养（修炼装备的强化 —— 与军装百炼平行的独立体系）
   * ------------------------------------------------------------
   * 材料 = 灵气精华（s.items.lingsui），与金币/铁/石完全独立；
   * 等级存 inst.enh（与军装共实例架构，同名各件互不影响），上限 +10、每级 +8%。
   * 效果并入 genEquipBonus（六维）与 GAME.lingPowerOf（灵力）——唯一出口。
   * 不失败、不降级、不碎裂（对齐「不惩罚」铁律）。
   * ============================================================ */
  GAME.lingTemperMax = function () { return (DATA.LING_TEMPER && DATA.LING_TEMPER.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份）：essBase + (lv+1) x essPerLv */
  GAME.lingTemperCost = function (x) {
    var lv = GAME.eqEnhOf(x);
    var C = DATA.LING_TEMPER || {};
    return Math.round((C.essBase || 10) + (lv + 1) * (C.essPerLv || 10));
  };
  GAME.lingTemper = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备' };
    var it = DATA.EQUIP[GAME.eqId(inst)];
    if (!it || !it.ling) return { ok: false, msg: '只有修炼装备可以蕴养' };
    var lv = GAME.eqEnhOf(inst);
    var label0 = GAME.eqLabel(inst);
    if (lv >= GAME.lingTemperMax()) return { ok: false, msg: '「' + label0 + '」已至 +' + GAME.lingTemperMax() + '（圆满）' };
    var cost = GAME.lingTemperCost(inst);
    s.items = s.items || {};
    var own = s.items.lingsui || 0;
    if (own < cost) return { ok: false, msg: '灵气精华不足（需 ' + cost + '，现有 ' + own + '）' };
    s.items.lingsui = own - cost;
    if (inst && typeof inst === 'object') inst.enh = lv + 1;   /* 按件 +1 */
    GAME.log('蕴养：' + label0 + ' → +' + (lv + 1) + '（耗灵气精华 ' + cost + '）');
    return { ok: true, msg: '「' + GAME.eqLabel(inst) + '」蕴养 +' + (lv + 1)
      + '（修炼属性 +' + Math.round((lv + 1) * ((DATA.LING_TEMPER || {}).perLv || 0.08) * 100) + '%）' };
  };
  /* 蕴养清单（背包 + 穿戴的灵气件；品质高、已蕴养者在前） */
  GAME.lingTemperList = function () {
    var out = GAME.eqPieces().filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return !!(it && it.ling);
    });
    out.sort(function (a, b) {
      return (DATA.EQUIP[GAME.eqId(b)].q - DATA.EQUIP[GAME.eqId(a)].q)
        || (GAME.eqEnhOf(b) - GAME.eqEnhOf(a));
    });
    return out;
  };

  /* --------- 君主改名（v77 · 君主面板） --------- */""",
    '6/6b 蕴养组', 'GAME.lingTemperCost = function (x)')

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
