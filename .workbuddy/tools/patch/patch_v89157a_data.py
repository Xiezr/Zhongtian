# -*- coding: utf-8 -*-
# v89.157 补丁 A：data.js —— 侦察基础 50%（余下按资质/等级差匹配）+ 消息主题扩容（人事/内政/市易 + 图标）
import io
P = 'E:/Deepseekdb/js/data.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

# ---------- ① SCOUT_RULE：base 0.85→0.50，斜率加宽（"剩下进行概率匹配"） ----------
OLD1 = u"""   * 成功率 P = base + perLv×(我方等级 − 守将等级) + perStar×(我方资质星 − 守将资质星)，
   * clamp 到 [lo, hi]；**目标无守将 → 必成**（没有"对方将领"，不掷骰）。
   * 参数标定（探针实测打表见 docs/v89156）：
   *   · 势均力敌（同资质同等级）≈ 85% —— 侦察是常用动作，失败率过高会变"反复重试"的负担；
   *   · 弱将探强敌明显吃亏：差 10 级 2 星 → 60%；差 20 级 3 星 → 40%（下限）；
   *   · 强将探弱敌近必成：+10 级 +2 星 → 97%（上限）。
   * 调平衡只改这张表（scoutChanceOf 是唯一消费点）。 */
  DATA.SCOUT_RULE = { base: 0.85, perLv: 0.015, perStar: 0.05, lo: 0.40, hi: 0.97 };"""
NEW1 = u"""   * v89.157（老板 2）：「基础 50% 成功率，剩下进行概率匹配」——
   *   基础 50%（势均力敌）；余下的概率全部由**双方资质与等级差**匹配：
   *   每 1 级差 ±2%，每 1 星差 ±8%；clamp [10%, 95%]（下限保底、上限留一线）。
   *   · 同资质同等级 = 50%；低 5 级 1 星 ≈ 32%；高 10 级 2 星 ≈ 86%；
   *   · 差距拉满（-20 级 -3 星 / +20 级 +3 星）落 10% / 95% 两端。
   *   · **目标无守将 → 必成**（没有"对方将领"，不掷骰）。
   * 调平衡只改这张表（scoutChanceOf 是唯一消费点）。 */
  DATA.SCOUT_RULE = { base: 0.50, perLv: 0.02, perStar: 0.08, lo: 0.10, hi: 0.95 };"""
if u'base: 0.50, perLv: 0.02' in s:
    done.append('1 skip')
else:
    assert s.count(OLD1) == 1, 'A1 count=' + str(s.count(OLD1))
    s = s.replace(OLD1, NEW1)
    done.append('1 OK')

# ---------- ② MSG_SUBS：补 icon + 三个新主题（人事 / 内政 / 市易） ----------
OLD2 = u"""  DATA.MSG_SUBS = [
    { id: 'era',     name: '改元',     color: '#edd08a', desc: '时代之志与改元' },
    { id: 'weather', name: '天时',     color: '#8fd0e8', desc: '季节与天气变化' },
    { id: 'build',   name: '建造',     color: '#c9a06a', desc: '建筑落成与升级' },
    { id: 'gather',  name: '采集收获', color: '#7bc96f', desc: '采集开始 / 收获 / 自动采集' }
  ];"""
NEW2 = u"""  DATA.MSG_SUBS = [
    { id: 'era',     name: '改元',     color: '#edd08a', icon: '🗓', desc: '时代之志与改元' },
    { id: 'weather', name: '天时',     color: '#8fd0e8', icon: '🌤', desc: '季节与天气变化' },
    { id: 'build',   name: '建造',     color: '#c9a06a', icon: '🏗', desc: '建筑落成与升级' },
    { id: 'gather',  name: '采集收获', color: '#7bc96f', icon: '🌾', desc: '采集开始 / 收获 / 自动采集' },
    /* v89.157（老板 1）：「合理分类，分标签呈现」—— 原「系统」是个大杂烩（招募 / 政务 / 市易
       全挤在灰字里）。补三个主题，让常见播报各有归属（未打标的仍落「系统」）。 */
    { id: 'staff',   name: '人事',     color: '#c69adc', icon: '🎖', desc: '招募 / 装备 / 晋升 / 练功' },
    { id: 'admin',   name: '内政',     color: '#9fb0e6', icon: '🏛', desc: '城建 · 科技 · 练兵 · 政务' },
    { id: 'trade',   name: '市易',     color: '#6fc9c9', icon: '💰', desc: '市场买卖与寄售' }
  ];"""
if u"id: 'staff'" in s:
    done.append('2 skip')
else:
    assert s.count(OLD2) == 1, 'A2 count=' + str(s.count(OLD2))
    s = s.replace(OLD2, NEW2)
    done.append('2 OK')

# ---------- ③ 页签（kind）图标：系统页里 war→军情 / task / sys 的徽章图标 ----------
OLD3 = u"""  DATA.MSG_TAG_NAME = { war: '军情' };
  DATA.MSG_TAG_COLOR = { war: '#e0a83c', task: '#6fb7e0', sys: '#a8a7af' };"""
NEW3 = u"""  DATA.MSG_TAG_NAME = { war: '军情' };
  DATA.MSG_TAG_COLOR = { war: '#e0a83c', task: '#6fb7e0', sys: '#a8a7af' };
  DATA.MSG_TAG_ICON = { war: '⚔', task: '📜', sys: '📌' };   /* v89.157：行徽章/标签图标 */"""
if u'DATA.MSG_TAG_ICON' in s:
    done.append('3 skip')
else:
    assert s.count(OLD3) == 1, 'A3 count=' + str(s.count(OLD3))
    s = s.replace(OLD3, NEW3)
    done.append('3 OK')

# ---------- 写盘 + 自检 ----------
io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert u'base: 0.50, perLv: 0.02, perStar: 0.08, lo: 0.10, hi: 0.95' in chk
assert chk.count(u"id: 'staff'") == 1 and chk.count(u"id: 'admin'") == 1 and chk.count(u"id: 'trade'") == 1
assert chk.count(u"icon: '") >= 10
assert u'DATA.MSG_TAG_ICON' in chk
assert chk.count(u'{') == s.count(u'{') and chk.count(u'}') == s.count(u'}')
print('patch A done:', done, 'len', orig, '->', len(s))
