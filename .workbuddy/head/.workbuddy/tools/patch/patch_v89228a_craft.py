# -*- coding: utf-8 -*-
"""v89.228 批 A：装备名录长尾换代（craft 8 处 + 神兵连带 2 处 + e2e 断言同步）。
旧→新：宝刀→钢锭战刀 · 神兵→陨铁战刃 · 明光铠→钢锭铠 · 吞肩甲→钢锭肩铠 ·
        护心臂→钢锭臂甲 · 蟠龙带→硬甲皮带 · 踏云靴→变异皮靴 · 龙驹→战马
连带：任务 g34「神兵初铸」→「利刃初铸」· 奇遇 secret_weapon「神兵」→「遗落战刃」（含文案去仙侠）
用法：DRY=1 python patch_v89228a_craft.py（预检）/ python patch_v89228a_craft.py（落盘）
"""
import io, os

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(BASE + p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(BASE + p + '.tmp', BASE + p)


def apply(path, edits):
    s = rd(path)
    for old, new, tag in edits:
        c = s.count(old)
        assert c == 1, '%s: count=%d %r' % (tag, c, old[:70])
        s = s.replace(old, new)
        print('[%s] %s' % ('DRY' if DRY else 'ok', tag))
    if not DRY:
        wr(path, s)
    return s


# ---------- data.js ----------
apply('js/data.js', [
    ("['铁刀', '钢刀', '宝刀', '神兵']", "['铁刀', '钢刀', '钢锭战刀', '陨铁战刃']", 'data·weapon 四档'),
    ("'明光铠'", "'钢锭铠'", 'data·chest q3'),
    ("'吞肩甲'", "'钢锭肩铠'", 'data·shoulder q3'),
    ("'护心臂'", "'钢锭臂甲'", 'data·arm q3'),
    ("'蟠龙带'", "'硬甲皮带'", 'data·waist q3'),
    ("'踏云靴'", "'变异皮靴'", 'data·feet q4'),
    ("'龙驹'", "'战马'", 'data·mount q4'),
    ("name: '神兵', weight: 4,", "name: '遗落战刃', weight: 4,", 'data·secret_weapon 名'),
    ("text: '山涧之底，青气冲霄。掘之三尺，得一刃，削铁如泥，铭文犹存。',",
     "text: '山涧之底，塌方土层下露出一角金属。掘开三尺，得一柄战前遗刃——锈迹斑斑，刃口却仍锋利。',",
     'data·secret_weapon 文案'),
    ("  /* 四档命名（与所用材料品阶呼应；主系列见 FORGE.matBySlot） */",
     "  /* 四档命名（与所用材料品阶呼应；主系列见 FORGE.matBySlot）——\n"
     "     v89.228 名录换代（旧「宝刀/神兵/明光铠/吞肩甲/护心臂/蟠龙带/踏云靴/龙驹」，见映射表） */",
     'data·名录注释'),
])

# ---------- questdata.js ----------
apply('js/questdata.js', [
    ("title: '神兵初铸'", "title: '利刃初铸'", 'quest·g34 标题'),
])

# ---------- e2e-test.js ----------
apply('e2e-test.js', [
    ("slot.textContent.indexOf('神兵') >= 0;", "slot.textContent.indexOf('陨铁战刃') >= 0;", 'e2e·槽名断言'),
])

# ---------- 写后自检 ----------
if not DRY:
    d = rd('js/data.js')
    q = rd('js/questdata.js')
    e = rd('e2e-test.js')
    # 旧 8 词仅许存在于「名录换代」沿革注释里（该注释按设计保留旧名）——先剥注释再检
    import re as _re
    dm = _re.sub(r'/\*[\s\S]*?\*/', '', d)
    for bad in ['宝刀', '神兵', '明光铠', '吞肩甲', '护心臂', '蟠龙带', '踏云靴', '龙驹']:
        assert bad not in dm, 'data.js 剥注释后旧词残留: %s' % bad
        assert d.count(bad) == 1, 'data.js 旧词应在注释里恰好 1 处: %s ×%d' % (bad, d.count(bad))
    assert '神兵' not in q and '神兵' not in e, 'quest/e2e 神兵残留'
    for good in ['钢锭战刀', '陨铁战刃', '钢锭铠', '钢锭肩铠', '钢锭臂甲', '硬甲皮带', '变异皮靴', '战马', '遗落战刃', '利刃初铸']:
        assert good in (d + q), '新词缺失: %s' % good
    print('自检通过：8 项换代 + 2 处连带 + e2e 同步（旧词仅存沿用注释 ×8）')
print('A DONE%s' % ('（DRY）' if DRY else ''))
