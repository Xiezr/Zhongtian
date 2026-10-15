# -*- coding: utf-8 -*-
"""v89.159 复核取证器（只读）：把「未完成 / 从未实现」清单逐条在代码里核一遍。
输出：条目 · 结论（已落地 / 未落地 / 部分）· 证据（文件:行 + 片段）。"""
import io, os, re, sys

R = 'E:/Deepseekdb/'


def rd(p):
    try:
        return io.open(R + p, 'r', encoding='utf-8', newline='').read()
    except Exception:
        return ''


JS = {}
for f in ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'ui', 'main', 'story', 'icons']:
    JS[f] = rd('js/%s.js' % f)
ALL = '\n'.join(JS.values())
UI, DA, DO, ST, BA, MA = JS['ui'], JS['data'], JS['domain'], JS['state'], JS['battle'], JS['main']
SM = rd('smoke-test.js')
E2 = rd('e2e-test.js')
ARC = rd('需求档案.md')
DOCS = os.listdir(R + 'docs')
TOOLS = R + '.workbuddy/tools/'


def hits(text, pat, n=2):
    out = []
    for m in re.finditer(pat, text):
        ln = text.count('\n', 0, m.start()) + 1
        seg = text[max(0, m.start() - 40):m.start() + 90].replace('\n', ' / ')
        out.append('%d:%s' % (ln, seg.strip()))
        if len(out) >= n:
            break
    return out


def has(pat, text=ALL):
    return len(re.findall(pat, text)) > 0


ROWS = []


def row(group, no, item, pat, expect=None, text=ALL, note=''):
    hs = hits(text, pat)
    n = len(re.findall(pat, text))
    verdict = ('有引用（%d 处）' % n) if n else '零引用 → 未落地'
    if expect == 'done':
        verdict = '✅ 已落地' if n else '❌ 未落地'
    elif expect == 'notdone':
        verdict = '⛔ 仍未做' if not n else '⚠ 有 %d 处引用，需人工看' % n
    ROWS.append((group, no, item, verdict, (hs[0] if hs else note)))


# ---------- A 类：v89.128 第二批 ----------
# 9 军务菜单改名
m = re.search(r'MARCH_TABS\s*=\s*\[(.{0,200}?)\]', UI, re.S)
row('A', '9', '军务菜单改名（出征→出征战术 / 防守→防守战术 + 新增出征菜单）',
    r'出征战术', expect=None,
    note=(m.group(1).replace('\n', ' ') if m else 'MARCH_TABS 未找到'))
ROWStab = ROWS[-1]
ROWS[-1] = (ROWStab[0], ROWStab[1], ROWStab[2], ('✅ 已落地' if '出征战术' in UI else '❌ 未落地'), (m.group(1).replace('\n', ' ')[:110] if m else ''))

row('A', '10', '练兵场点击直入军务界面（旧弹窗退役）', r'ui\.openXiaochang\s*=\s*function', expect='notdone')
row('A', '11', '出征 = 一切军事行动的入口（统一）', r"_expMode === 'station'|mode === 'station'", expect='done')
row('A', '12', '缩略地图（字细 / 红点 / 波纹）', r'miniMeLabels|mini-pulse', expect='done')
row('A', '13', '出征战术：动作/目标下拉 + 两列 + 去在途队列', r'exp-act-pick|expActHTML|expActionHTML', expect=None)
row('A', '14', '防守战术：底部双小页（全境防御 / 防守战术）', r'全境防御', expect=None)
row('A', '15', '烽火页去备注行', r'来犯的触发与规则', expect='notdone')
row('A', '2', '数据表梳理（索引 + 引用关系 + 模块化）',
    r'数据表索引', expect='done')

# ---------- B 类：总纲 B3 ----------
row('B', 'E7', '章节骨架（50 任务 → 7 章叙事链）', r'DATA\.CHAPTERS', expect='notdone')
row('B', 'E13', '邻城驰援 + 预警三选（截击/坚壁/空城）', r'驰援', expect='notdone')
row('B', 'E15', '开局重排（教学战 / 首建 0 秒 / 军师条）', r'教学战|tutorial', expect='notdone')
row('B', 'E16', '将领差异线 · 被动武学', r'被动武学|DATA\.WUXUE', expect='notdone')
row('B', 'U2', '日月年文案（俸期口径）', r'俸期', expect='notdone')
row('B', 'U5', '资源溢出出口（自动粜卖）', r'粜', expect='notdone')
row('B', 'W4', '酒馆换批成本递增', r'innRefreshCost', expect=None)
row('B', 'W5', '经验书低段效率', r'经验书', expect=None)
row('B', 'W6', '装备线性价比', r'装备线性价比', expect='notdone')
row('B', 'W7', '入侵强度（末段必破 · 复核）', r'invasionStrength|breachChance|末段', expect=None)
row('B', 'W8', '门派日限节奏', r'SECT_DAILY|日限', expect=None)

# ---------- C 类：待拍板 12 项 ----------
row('C', '1', '自动出征按目标等级自动挑相称将领', r'autoMarchPickGen|recGenOf', expect=None)
m2 = re.search(r'WILD_GEN_CHANCE\s*=\s*(\{.{0,160}?\})', DA, re.S)
row('C', '2', '野地守将"概率→必有"', r'WILD_GEN_CHANCE', expect=None,
    note=(m2.group(1).replace('\n', ' ')[:100] if m2 else '表未见'))
row('C', '5', '大罗金丹下架（与九转还魂丹重复）', r'大罗金丹', expect=None)
row('C', '9', 'expBlockOf 接线', r'expBlockOf', expect=None)
row('C', '10', '来袭间隔可选档位', r'invasionEveryRealMin|invasionRealMin|invasionSlotOf', expect=None)

# ---------- 近轮遗留（v89.135 / v89.141 / v89.151~v89.158） ----------
row('D', '1', 'live 刷新续铺（其余面板）', r'opts\.live|live: function', expect=None, text=UI)
row('D', '2', '将领视图秒刷（带滚动保持）', r'_genScroll|genView.*live|openGenerals', expect=None)
row('D', '3', '「将领带队采集」与「驻军开采」合并', r'garrisonGather|wild-garrison-gather', expect=None)
row('D', '4', 'A 木供给 / B 围墙起步价 / C 缺口明细（v89.141 三问）', r'v89\.157|A木', expect=None, text=ARC)
row('D', '5', '夜明珠 / 爵位数量 / 独山玉名（v89.152 遗留）', r'夜明珠', expect=None, text=ARC)
row('D', '6', '侦察斜率体感（±2%/级 · ±8%/星）', r'perLv:\s*0\.02', expect='done')
row('D', '7', '公文新主题继续补打标', r'MSG_SUBS', expect=None)
row('D', '8', '采收藏 clamp（装不下丢弃）是否改提示', r'已满|丢弃', expect=None, text=DO)

print('分组 | # | 条目 | 结论 | 证据')
print('-' * 130)
for g, no, item, verdict, ev in ROWS:
    print('%s | %s | %s | %s | %s' % (g, no, item, verdict, ev[:100]))
