#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""analyze_strat.py — v89.92 四模式对照分析（gold / buff / equip / all）

从 snapshots.jsonl 提取逐年曲线与终局对照，输出 digest_strat.md。
"""
import io, json, os

R = 'E:/Deepseekdb/.workbuddy/tmp/playtest600/'
MODES = ['gold', 'buff', 'equip', 'all']
LABEL = {'gold': 'gold(旧币流)', 'buff': 'buff(宝物流)', 'equip': 'equip(装备流)', 'all': 'all(宝物流+装备流)'}

def load(mode):
    rows = []
    p = R + 'v8992_' + mode + '/snapshots.jsonl'
    if not os.path.exists(p): return rows
    for line in io.open(p, encoding='utf-8'):
        line = line.strip()
        if line:
            try: rows.append(json.loads(line))
            except Exception: pass
    return rows

data = {m: load(m) for m in MODES}
finals = {}
for m in MODES:
    p = R + 'v8992_' + m + '/strat_final.json'
    if os.path.exists(p):
        finals[m] = json.loads(io.open(p, encoding='utf-8').read())

def pick(rows, year):
    """取靠近某年的快照（y 最接近）"""
    best = None
    for r in rows:
        if best is None or abs(r.get('y', 0) - year) < abs(best.get('y', 0) - year):
            best = r
    return best

def fmt(v):
    v = float(v or 0)
    if abs(v) >= 1e8: return '%.2f亿' % (v / 1e8)
    if abs(v) >= 1e4: return '%.1f万' % (v / 1e4)
    return '%d' % round(v)

out = []
W = out.append
W('# v89.92 四模式对照推演 · 数据摘要')
W('')
W('> gold = v89.91 旧币流（对照基线）· buff = 旧币流 + 生产宝物叠 buff + 符类')
W('> equip = 旧币流 + 陨锋套打造/强化/穿戴 · all = 旧币流 + 两线全开。')
W('> 同一骨架、同 mapSeed=20260921、各 21600 tick（225 游戏年）、零游戏代码改动。')
W('')

# ---- 一、终局对照
W('## 一、终局对照（第 225 游戏年）')
W('')
hdr = '| 指标 | ' + ' | '.join(LABEL[m] for m in MODES) + ' |'
W(hdr)
W('|' + '---|' * (len(MODES) + 1))
def row(name, fn):
    W('| ' + name + ' | ' + ' | '.join(str(fn(m)) for m in MODES) + ' |')

def prod_of(m, res='grain'):
    r = pick(data[m], 225)
    if not r: return '—'
    ph = (r.get('guards') and r) or {}
    v = (r.get('prodH') or {}).get(res)
    return fmt(v) if v else '—'
row('粮产量（/时）', lambda m: prod_of(m, 'grain'))
row('木产量（/时）', lambda m: prod_of(m, 'wood'))
def gold_of(m):
    r = pick(data[m], 225); return fmt(r['res']['gold']) if r else '—'
row('旧币（户部余额）', gold_of)
def army_of(m):
    r = pick(data[m], 225); return fmt(r.get('army')) if r else '—'
row('军队', army_of)
def cities_of(m):
    r = pick(data[m], 225); return r.get('cities') if r else '—'
row('城池数', cities_of)
def gens_of(m):
    r = pick(data[m], 225); return r.get('gens') if r else '—'
row('英雄数', gens_of)
def tech_of(m):
    r = pick(data[m], 225); return r.get('techSum') if r else '—'
row('科技总级', tech_of)
def build_of(m):
    r = pick(data[m], 225)
    return sum((r.get('bl') or {}).values()) if r else '—'
row('城内建筑等级和', build_of)
def trade_of(m):
    r = pick(data[m], 225)
    return fmt(((r.get('goldState') or {}).get('sold'))) if r else '—'
row('累计套现旧币', trade_of)
def gnz(m):
    r = pick(data[m], 225)
    return ((r.get('buff') or {}).get('gnz') or (r.get('equip') or {}).get('gnz') or 0) if r else 0
row('主城守将 nz', lambda m: gnz(m) or '—')
def bmult(m):
    r = pick(data[m], 225)
    v = (r.get('buff') or {}).get('grainMult')
    return ('×%.0f' % v) if v else '—'
row('粮产因子（buff 侧）', bmult)
def espend(m):
    f = finals.get(m) or {}
    e = f.get('equip') or {}
    s = e.get('spend') or {}
    return fmt(sum(s.values())) if s else '—'
row('装备流花费', espend)
def ecraft(m):
    f = finals.get(m) or {}
    e = f.get('equip') or {}
    return '%d/12 穿 %d/12' % (len(e.get('crafted') or []), e.get('worn') or 0) if e else '—'
row('装备打造/穿戴', ecraft)
W('')

# ---- 二、产量曲线
W('## 二、粮产量曲线（/时，现实小时@600×）')
W('')
W('| 游戏年 | ' + ' | '.join(LABEL[m] for m in MODES) + ' |')
W('|' + '---|' * (len(MODES) + 1))
for y in [10, 25, 40, 60, 100, 150, 200, 225]:
    cells = []
    for m in MODES:
        r = pick(data[m], y)
        v = (r.get('prodH') or {}).get('grain') if r else None
        cells.append(fmt(v) if v else '—')
    W('| %d | %s |' % (y, ' | '.join(cells)))
W('')

# ---- 三、旧币曲线
W('## 三、旧币余额曲线（户部）')
W('')
W('| 游戏年 | ' + ' | '.join(LABEL[m] for m in MODES) + ' |')
W('|' + '---|' * (len(MODES) + 1))
for y in [10, 25, 40, 60, 100, 150, 200, 225]:
    cells = []
    for m in MODES:
        r = pick(data[m], y)
        cells.append(fmt(r['res']['gold']) if r else '—')
    W('| %d | %s |' % (y, ' | '.join(cells)))
W('')

# ---- 四、净水因子 & 装备进度曲线（buff/equip 侧）
W('## 四、粮产因子与装备进度（各线内部）')
W('')
W('| 游戏年 | buff:粮因子 | buff:犁数 | equip:炉Lv | equip:造/12 | equip:穿/12 | equip:强化和 |')
W('|---|' + '---|' * 6)
for y in [5, 10, 25, 40, 60, 100, 150, 200, 225]:
    rb = pick(data['buff'], y); re_ = pick(data['equip'], y)
    bm = (rb.get('buff') or {}) if rb else {}
    em = (re_.get('equip') or {}) if re_ else {}
    W('| %d | %s | %s | %s | %s | %s | %s |' % (
        y,
        ('×%.1f' % bm['grainMult']) if bm.get('grainMult') else '—',
        (bm.get('units') or {}).get('houji', '—'),
        em.get('forge', '—'), em.get('crafted', '—'), em.get('worn', '—'), em.get('enhSum', '—')))
W('')

# ---- 五、点火时序
W('## 五、点火时序（tick / 游戏年）')
W('')
for m in MODES:
    f = finals.get(m) or {}
    e = f.get('equip') or {}
    b = f.get('buff') or {}
    bits = []
    if b.get('tFirst') is not None:
        bits.append('宝物线点火 t=%s（y%.2f）' % (b['tFirst'], b['tFirst'] / 96.0))
        sp = (b.get('spend') or {}).get('prod', 0)
        bits.append('累计投入 %s 旧币' % fmt(sp))
        u = b.get('units') or {}
        bits.append('犁 %s（其余 %s）' % (u.get('houji', 0), sum(v for k, v in u.items() if k != 'houji')))
    if e:
        if e.get('tCraft1') is not None: bits.append('首件打造 t=%s（y%.2f）' % (e['tCraft1'], e['tCraft1'] / 96.0))
        if e.get('tCraft12') is not None: bits.append('12 件齐 t=%s（y%.2f）' % (e['tCraft12'], e['tCraft12'] / 96.0))
        if e.get('tEnh120') is not None: bits.append('全 +10 t=%s（y%.2f）' % (e['tEnh120'], e['tEnh120'] / 96.0))
        if e.get('tWorn12') is not None: bits.append('全上身 t=%s（y%.2f）' % (e['tWorn12'], e['tWorn12'] / 96.0))
    W('- **%s**：%s' % (LABEL[m], ' · '.join(bits) if bits else '（无装备/宝物动作）'))
W('')

# ---- 六、守将盘面
W('## 六、各跑主城守将（终局）')
W('')
W('| 模式 | 城市 | 守将 | 资质 | Lv | nz |')
W('|---|---|---|---|---|---|')
for m in MODES:
    f = finals.get(m) or {}
    for g in (f.get('guards') or []):
        if g: W('| %s | %s | %s | %s | %s | %s |' % (LABEL[m], g['c'], g['g'], g['r'], g['lv'], g['nz']))
W('')
W('（数据源：`.workbuddy/tmp/playtest600/v8992_*/snapshots.jsonl` · `strat_final.json`）')

txt = '\n'.join(out)
io.open(R + 'digest_strat.md', 'w', encoding='utf-8').write(txt)
print(txt)
