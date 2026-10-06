# -*- coding: utf-8 -*-
"""v89.211 补丁 D：ui.js
   D1 openTroops 入场归一（陈旧/跨类 idx → 本城本类首座）
   D2 装备栏槽位悬停 → equipDescOf（按件）
   D3 换装窗「当前」→ equipDescOf
   D4 换装窗候选卡 → equipDescOf
   D5 背包装备卡 → equipDescOf
   D6 装备面板槽位行 攻/速 → 按件乘数
   D7 装备面板背包卡 → equipDescOf
   D8 GAME.equipDescOf 定义（按件描述唯一出口）
"""
import io
R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

# ---------------- D1: openTroops 入场归一 ----------------
s = rd('js/ui.js')
if '_b211' in s:
    print('[skip] D1 openTroops 归一已在册')
else:
    old = """    ui._trainBIdx = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    ui._trainFilter = (filter === 'siege') ? 'siege' : 'normal';
    ui.openPanel('troops', ui._trainFilter === 'siege' ? '🛠️ 工匠作坊 · 制造器械' : '⚔️ 兵营招募');"""
    new = """    ui._trainBIdx = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    ui._trainFilter = (filter === 'siege') ? 'siege' : 'normal';
    /* v89.211（老板 3）：入场工位**归一** —— 陈旧/跨类 idx（如上次点的是军营格）在这里
       回落本城本类首座，显示（trainBarracks）与提交（doTrain）此后读同一份。
       改前 siege 面板显示正常（有回落），提交却把旧 idx 原样交给 GAME.train →
       明明有作坊却报"本城尚无工匠作坊"（老板实测）。 */
    var _b211 = ui.trainBarracks();
    ui._trainBIdx = _b211 ? _b211.idx : null;
    ui.openPanel('troops', ui._trainFilter === 'siege' ? '🛠️ 工匠作坊 · 制造器械' : '⚔️ 兵营招募');"""
    s = sub1(s, old, new, 'D1')
    wr('js/ui.js', s)
    print('[ok] D1 openTroops 归一')

# ---------------- D2: 装备栏槽位悬停 ----------------
s = rd('js/ui.js')
if "'<div class=\"tip-l\">' + (it ? U.escape(GAME.equipDescOf(inst) || '')" in s:
    print('[skip] D2 槽位悬停已改')
else:
    old = """        '<div class="tip-l">' + (it ? U.escape(GAME.equipDesc(it) || '') : '该部位未着，点击选择') + '</div>' +"""
    new = """        /* v89.211：按件描述（强化/蕴养计入；equipDescOf 为唯一出口） */
        '<div class="tip-l">' + (it ? U.escape(GAME.equipDescOf(inst) || '') : '该部位未着，点击选择') + '</div>' +"""
    s = sub1(s, old, new, 'D2')
    wr('js/ui.js', s)
    print('[ok] D2 槽位悬停')

# ---------------- D3: 换装窗当前 ----------------
s = rd('js/ui.js')
if "GAME.equipDescOf(curInst)" in s:
    print('[skip] D3 换装窗当前已改')
else:
    old = """      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDesc(cur)) + '）' : '未着') + '</span></div>';"""
    new = """      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDescOf(curInst)) + '）' : '未着') + '</span></div>';"""
    s = sub1(s, old, new, 'D3')
    wr('js/ui.js', s)
    print('[ok] D3 换装窗当前')

# ---------------- D4: 换装窗候选 ----------------
s = rd('js/ui.js')
if "attr: GAME.equipDescOf(inst),\n          act: 'gen-equip-item'" in s:
    print('[skip] D4 候选卡已改')
else:
    old = """          attr: GAME.equipDesc(it),
          act: 'gen-equip-item', key: key, gen: genId,"""
    new = """          attr: GAME.equipDescOf(inst),
          act: 'gen-equip-item', key: key, gen: genId,"""
    s = sub1(s, old, new, 'D4')
    wr('js/ui.js', s)
    print('[ok] D4 候选卡')

# ---------------- D5: 背包装备卡（穿戴着视角） ----------------
s = rd('js/ui.js')
if "attr: GAME.equipDescOf(inst),\n          /* 穿戴件点击 = 开详情" in s:
    print('[skip] D5 背包卡已改')
else:
    old = """          attr: GAME.equipDesc(it),
          /* 穿戴件点击 = 开详情（卸下/强化/分解都在那里）；背包件保持"一键穿上"。"""
    new = """          attr: GAME.equipDescOf(inst),
          /* 穿戴件点击 = 开详情（卸下/强化/分解都在那里）；背包件保持"一键穿上"。"""
    s = sub1(s, old, new, 'D5')
    wr('js/ui.js', s)
    print('[ok] D5 背包卡')

# ---------------- D6: 装备面板槽位行 攻/速 ----------------
s = rd('js/ui.js')
if "Math.round(item.atk * (GAME.eqEnhMulOf" in s:
    print('[skip] D6 槽位行已改')
else:
    old = """        (item.slot === 'weapon' && item.atk ? ' 攻' + item.atk : '') + (item.spd ? ' 速' + item.spd : '') : '—') + '</span>' +"""
    new = """        (item.slot === 'weapon' && item.atk ? ' 攻' + Math.round(item.atk * (GAME.eqEnhMulOf ? GAME.eqEnhMulOf(inst) : 1)) : '')
          + (item.spd ? ' 速' + Math.round(item.spd * (GAME.eqEnhMulOf ? GAME.eqEnhMulOf(inst) : 1)) : '') : '—') + '</span>' +"""
    s = sub1(s, old, new, 'D6')
    wr('js/ui.js', s)
    print('[ok] D6 槽位行')

# ---------------- D7: 装备面板背包卡 ----------------
s = rd('js/ui.js')
if "'<div class=\"tstat\">' + GAME.equipDescOf(inst) + '</div></div>';" in s:
    print('[skip] D7 面板背包卡已改')
else:
    old = """        '<div class="tstat">' + GAME.equipDesc(item) + '</div></div>';"""
    new = """        '<div class="tstat">' + GAME.equipDescOf(inst) + '</div></div>';"""
    s = sub1(s, old, new, 'D7')
    wr('js/ui.js', s)
    print('[ok] D7 面板背包卡')

# ---------------- D8: equipDescOf 定义 ----------------
s = rd('js/ui.js')
if 'GAME.equipDescOf = function' in s:
    print('[skip] D8 equipDescOf 已在册')
else:
    old = """    if (item.lingv) parts.push('灵+' + item.lingv);   /* v88：灵力（游历战力） */
    return parts.join(' ') || '—';
  };"""
    new = """    if (item.lingv) parts.push('灵+' + item.lingv);   /* v88：灵力（游历战力） */
    return parts.join(' ') || '—';
  };
  /* v89.211（老板 1）：**按件**装备描述（唯一出口）—— 与 equipDesc 同格式，
     但把百炼/蕴养后的真实数值呈出来：六维/攻防/速/体读 eqEnhMulOf（与 genEquipBonus
     同源）、灵力读 eqLingMulOf（与 lingPowerOf 同源）。无强化时与 equipDesc 逐字一致。
     改前所有按件展示点都读原值 —— 老板"+10 了属性没动"的观感就出在这里
     （数值链本身是通的，断在展示一手；见 docs/v89211 探针实证）。 */
  GAME.equipDescOf = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    if (!it) return '—';
    var lv = GAME.eqEnhOf(x);
    if (!lv) return GAME.equipDesc(it);
    var mu = (GAME.eqEnhMulOf && GAME.eqEnhMulOf(x)) || 1;
    var ml = (GAME.eqLingMulOf && GAME.eqLingMulOf(x)) || 1;
    var parts = [];
    if (it.tong) parts.push('统+' + Math.round(it.tong * mu));
    if (it.nz) parts.push('政+' + Math.round(it.nz * mu));
    if (it.yw) parts.push('勇+' + Math.round(it.yw * mu));
    if (it.zm) parts.push('智+' + Math.round(it.zm * mu));
    if (it.atk) parts.push('攻+' + Math.round(it.atk * mu));
    if (it.def) parts.push('防+' + Math.round(it.def * mu));
    if (it.spd) parts.push('速+' + Math.round(it.spd * mu));
    if (it.sta) parts.push('体+' + Math.round(it.sta * mu));
    if (it.lingv) parts.push('灵+' + Math.round(it.lingv * ml));
    return parts.join(' ') || '—';
  };"""
    s = sub1(s, old, new, 'D8')
    wr('js/ui.js', s)
    print('[ok] D8 equipDescOf')

print('DONE')
