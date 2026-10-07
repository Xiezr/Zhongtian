# -*- coding: utf-8 -*-
"""v89.91 黄金流 vs 基线对照分析器
输入：.workbuddy/tmp/playtest600/{gold,farm2,main}/
输出：digest_gold.md（对照报告的全部数据表）
"""
import io, json, os, collections

BASE = r'E:\Deepseekdb\.workbuddy\tmp\playtest600'
OUT = os.path.join(BASE, 'digest_gold.md')

def load(tag):
    d = os.path.join(BASE, tag)
    o = { 'snaps': [], 'run': [], 'ev': [], 'battles': [], 'final': None, 'goldfin': None }
    p = os.path.join(d, 'snapshots.jsonl')
    if os.path.exists(p):
        for line in io.open(p, encoding='utf-8'):
            try: o['snaps'].append(json.loads(line))
            except: pass
    p = os.path.join(d, 'run.log')
    if os.path.exists(p):
        o['run'] = [l.rstrip('\n') for l in io.open(p, encoding='utf-8')]
    p = os.path.join(d, 'events.jsonl')
    if os.path.exists(p):
        for line in io.open(p, encoding='utf-8'):
            try: o['ev'].append(json.loads(line))
            except: pass
    p = os.path.join(d, 'battles.jsonl')
    if os.path.exists(p):
        for line in io.open(p, encoding='utf-8'):
            try: o['battles'].append(json.loads(line))
            except: pass
    p = os.path.join(d, 'final_state.json')
    if os.path.exists(p):
        try: o['final'] = json.load(io.open(p, encoding='utf-8'))
        except: pass
    p = os.path.join(d, 'gold_final.json')
    if os.path.exists(p):
        try: o['goldfin'] = json.load(io.open(p, encoding='utf-8'))
        except: pass
    return o

G = load('gold'); F = load('farm2'); M = load('main')

def fm(v):
    v = float(v or 0)
    if abs(v) >= 1e8: return '%.2f亿' % (v/1e8)
    if abs(v) >= 1e4: return '%.1f万' % (v/1e4)
    return str(int(v))

def snap_at(snaps, y):
    best = None
    for o in snaps:
        if best is None or abs(o['y']-y) < abs(best['y']-y): best = o
    return best

def find_first(ls, kw, neg=None):
    for l in ls:
        if kw in l and (not neg or neg not in l): return l
    return None

lines = []
A = lines.append

A('# v89.91 黄金流对照推演 · 数据摘要')
A('')
A('黄金流 = 金换批招英杰 + 金买经验书喂将 + 用光自由点 + 金提速 + 全资源套现。')
A('farm2 = 同一骨架/同 seed/同里程碑，仅移除黄金消费策略。')
A('main = v89.90 出厂基线（种田脑主推演）。')
A('')

# ── 1. 终局对比 ──
A('## 一、终局对比（第 225 游戏年）')
A('')
A('| 指标 | farm2（对照） | gold（黄金流） | main（出厂基线） | gold/farm2 |')
A('|---|---|---|---|---|')
def final_row(label, getter, fmt=fm):
    fv, gv, mv = getter(F), getter(G), getter(M)
    ratio = ('%.1f×' % (gv/fv)) if (fv and gv is not None and abs(fv) > 1e-9) else '-'
    A('| %s | %s | %s | %s | %s |' % (label, fmt(fv), fmt(gv), fmt(mv), ratio))
def slast(o, fn, d=None):
    return fn(o) if o['snaps'] else d
final_row('军队', lambda o: (o['final'] or {}).get('cities') and sum(sum((c.get('army') or {}).values()) for c in o['final']['cities']) or (o['snaps'][-1]['army'] if o['snaps'] else 0))
final_row('黄金（户部）', lambda o: (o['snaps'][-1]['res'].get('gold', 0) if o['snaps'] else 0))
final_row('将领数', lambda o: (o['final'] or {}).get('generals') and len(o['final']['generals']) or (o['snaps'][-1]['gens'] if o['snaps'] else 0))
final_row('最高将领等级', lambda o: max([(g.get('level') or 1) for g in (o['final'] or {}).get('generals', [])] or [0]))
final_row('英杰+ 将领数', lambda o: len([g for g in (o['final'] or {}).get('generals', []) if g.get('rank') in ('ying', 'ming', 'tian')]))
final_row('科技总数', lambda o: slast(o, lambda x: x['snaps'][-1].get('techSum', 0)))
final_row('城内建筑等级总和', lambda o: slast(o, lambda x: sum(x['snaps'][-1].get('bl', {}).values())))
final_row('城外资源地等级总和', lambda o: slast(o, lambda x: sum(x['snaps'][-1].get('ext', {}).values())))
final_row('人口上限', lambda o: slast(o, lambda x: x['snaps'][-1].get('popCap', 0)))
final_row('战报数', lambda o: slast(o, lambda x: x['snaps'][-1].get('reports', 0)))
final_row('累计募兵', lambda o: slast(o, lambda x: (x['snaps'][-1].get('stats2') or {}).get('trained', 0)))
final_row('累计建造完成', lambda o: slast(o, lambda x: (x['snaps'][-1].get('stats2') or {}).get('build', 0)))
A('')

# ── 2. 产量曲线 ──
A('## 二、产量曲线（粮 / 时）—— "指数"证据')
A('')
A('| 游戏年 | farm2 粮/时 | gold 粮/时 | 倍数 | farm2 军队 | gold 军队 | farm2 金 | gold 金 |')
A('|---|---|---|---|---|---|---|---|')
for y in [10, 25, 40, 60, 80, 100, 125, 150, 175, 200, 225]:
    fs = snap_at(F['snaps'], y); gs_ = snap_at(G['snaps'], y)
    if not fs or not gs_: continue
    fp = (fs.get('prodH') or {}).get('grain', 0); gp = (gs_.get('prodH') or {}).get('grain', 0)
    A('| %d | %s | %s | %s | %s | %s | %s | %s |' % (
        y, fm(fp), fm(gp), ('%.1f×' % (gp/fp)) if fp else '-',
        fm(fs['army']), fm(gs_['army']), fm(fs['res'].get('gold',0)), fm(gs_['res'].get('gold',0))))
A('')

# ── 3. 黄金流收支 ──
A('## 三、黄金流收支（gold 运行）')
A('')
if G['goldfin']:
    g0 = G['goldfin']['gold']
    sp = g0['spends']
    A('| 项目 | 数值 |')
    A('|---|---|')
    A('| 累计市场套现 | %s 金（%d 笔） |' % (fm(g0['sold']), g0['sales']))
    A('| 经验书支出 | %s 金（用掉 %d 本） |' % (fm(sp['books']), g0['books']))
    A('| 客栈换批 | %s 金（%d 次，录用 %d 人） |' % (fm(sp['inn']), g0['rerolls'], g0['recruits']))
    A('| 建造提速 | %s 金 |' % fm(sp['build']))
    A('| 科技提速 | %s 金 |' % fm(sp['tech']))
    A('| 募兵提速 | %s 金 |' % fm(sp['train']))
    A('| 内功书 | %s 金 |' % fm(sp['neigong']))
    A('| 自由点投放 | %d 点 |' % g0['freePts'])
    A('')
    A('里程碑：' + json.dumps(g0['milestones'], ensure_ascii=False))
    A('')

# ── 4. 里程碑时间表 ──
A('## 四、里程碑时间表（从 run.log 提取）')
A('')
mkmaps = [
    ('客栈录得英杰（gold）', G['run'], '🏆 客栈录得高资质'),
    ('首位 Lv60', G['run'], '🏆 首位 Lv60'),
    ('首位 Lv100', G['run'], '🏆 首位 Lv100'),
    ('首位 Lv140', G['run'], '🏆 首位 Lv140'),
    ('首位 Lv180', G['run'], '🏆 首位 Lv180'),
    ('首位 Lv240', G['run'], '🏆 首位 Lv240'),
    ('君主突破', G['run'], '🏆 君主突破'),
    ('首次占领野地（两者）', None, '🚩 首次占领'),
    ('筑第二城（两者）', None, '🏯 筑第二城'),
    ('筑第三城（两者）', None, '🏯 筑第三城'),
]
def ts_of(line):
    try:
        return '+%s' % line.split('| +')[1].split('min]')[0] + 'min'
    except: return '?'
for label, ls, kw in mkmaps:
    gline = find_first(ls if ls is not None else G['run'], kw)
    fline = find_first(F['run'], kw)
    A('- **%s**：gold %s（%s）｜ farm2 %s（%s）' % (
        label,
        ts_of(gline) if gline else '未发生', (gline or '')[-46:] if gline and 'Lv' not in (gline[-10:] or '') else (gline or '')[-40:],
        ts_of(fline) if fline else '未发生', (fline or '')[-40:]))
A('')

# ── 5. 将领终局（gold） ──
A('## 五、黄金流将领盘面（终局）')
A('')
if G['goldfin']:
    A('| 将领 | 资质 | 等级 | 内政 | 勇武 | 智谋 | 状态 |')
    A('|---|---|---|---|---|---|---|')
    for g in sorted(G['goldfin']['gens'], key=lambda x: -x['lv'])[:14]:
        A('| %s | %s | %d | %d | %d | %d | %s |' % (g['n'], g['r'], g['lv'], g['nz'], g['yw'], g['zm'], g['st']))
    A('')
    A('守将：' + json.dumps(G['goldfin']['guards'], ensure_ascii=False))
A('')

# ── 6. 建筑/科技/军队终局细节 ──
A('## 六、终局结构细节')
A('')
for tag, o in [('farm2', F), ('gold', G), ('main', M)]:
    if not o['snaps']: continue
    s = o['snaps'][-1]
    A('- **%s**：城%d · 军%d · 将%d · 英杰+%s · 科技%s · 建筑和%s · 报告%d · 已读故事/待阅 %d' % (
        tag, s['cities'], s['army'], s['gens'],
        len([1 for g in (o['final'] or {}).get('generals', []) if g.get('rank') in ('ying','ming','tian')]) if o['final'] else '?',
        s.get('techSum'), sum(s.get('bl', {}).values()), s.get('reports', 0), s.get('sgPending', 0)))
A('')

# ── 7. 战斗统计 ──
A('## 七、战斗（battles.jsonl）')
A('')
for tag, o in [('farm2', F), ('gold', G), ('main', M)]:
    b = o['battles']
    if not b: A('- %s：无' % tag); continue
    wins = len([x for x in b if x.get('winner') == 'atk'])
    modes = collections.Counter(x.get('mode') for x in b)
    A('- **%s**：%d 场 · 胜 %d（%.0f%%）· 模式 %s · 攻损合计 %s' % (
        tag, len(b), wins, 100.0*wins/max(1,len(b)), dict(modes), fm(sum(x.get('atkLoss',0) for x in b))))
A('')

# ── 8. 新发现：升档链 ──
A('## 八、升档链（灵草）与遗留')
A('')
assert True
if G['final']:
    items = G['final'].get('items') or {}
    A('- gold 背包草本余量：' + ', '.join('%s=%s' % (k, items.get(k, 0)) for k in ['yunlingcao','xisuizhi','hualongshen','tianshouguo']))
    ngc = len([g for g in G['final'].get('generals', []) if (g.get('ng') or {}).get('id')])
    A('- gold 修内功人数：%d' % ngc)
A('')

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(lines) + '\n')
print('WROTE', OUT)
print('\n'.join(lines[:60]))
