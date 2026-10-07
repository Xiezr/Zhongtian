# -*- coding: utf-8 -*-
"""analyze_600.py — 600× 全量推演数据分析器。
输入：.workbuddy/tmp/playtest600/main/（snapshots/battles/events/checkpoints/final_state）
输出：digest.md（报告素材全集）+ 控制台摘要。
"""
import io, json, os, re, collections

D = r'E:\Deepseekdb\.workbuddy\tmp\playtest600\main'
OUT = os.path.join(D, 'digest.md')
L = []
def w(s=''):
    L.append(str(s))

def load_jsonl(name):
    rows = []
    p = os.path.join(D, name)
    if not os.path.exists(p): return rows
    for line in io.open(p, encoding='utf-8'):
        line = line.strip()
        if not line: continue
        try: rows.append(json.loads(line))
        except: pass
    return rows

snaps = load_jsonl('snapshots.jsonl')
battles = load_jsonl('battles.jsonl')
events = load_jsonl('events.jsonl')

def fmt(v, d=0):
    v = float(v or 0)
    if abs(v) >= 1e8: return ('%.2f亿' % (v / 1e8))
    if abs(v) >= 1e4: return ('%.1f万' % (v / 1e4))
    return ('%.0f' % v)

# ============ 1. 里程碑年表（快照采样） ============
w('# 600× 全量推演 · 素材摘要\n')
w('## 1. 里程碑年表（游戏年 | 现实分钟 | 关键指标）')
w('| 年 | 现实min | 粮 | 木 | 石 | 铁 | 金 | 人口/上限 | 兵力 | 驻军 | 城 | 科技 | 门派rep | 爵/声望 | 任务完成 | 待阅 | 史册 | 战报 | 存档KB |')
w('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
MV = [1, 5, 10, 25, 50, 75, 100, 125, 150, 175, 200, 225]
byyear = {}
for s in snaps:
    y = int(round(s.get('y', 0)))
    if y not in byyear: byyear[y] = s
for y in MV:
    s = byyear.get(y)
    if not s: continue
    r = s.get('res', {})
    w('| %d | %.0f | %s | %s | %s | %s | %s | %s/%s | %s | %s | %d | %s | %s | %s | %s | %s | %s | %s | %s |' % (
        y, s.get('rm', 0),
        fmt(r.get('grain')), fmt(r.get('wood')), fmt(r.get('stone')), fmt(r.get('iron')), fmt(r.get('gold')),
        fmt(s.get('pop')), fmt(s.get('popCap')),
        fmt(s.get('army')), fmt(s.get('garrison')),
        s.get('cities', 0), fmt(s.get('techSum')),
        fmt(s.get('sectRep')), fmt(s.get('rep')),
        s.get('qDone', 0), s.get('sgPending', 0), s.get('chronicle', 0), s.get('reports', 0),
        round((s.get('saveBytes') or 0) / 1024)))

# ============ 2. 饱和分析 ============
w('\n## 2. 饱和点分析（何时无事可做）')
stw = {}
for s in snaps:
    y = int(s.get('y', 0)); stw[y] = s
def first_where(pred, label):
    for y in sorted(stw):
        if pred(stw[y]):
            w('- **%s**：首次出现于第 %d 游戏年（约现实第 %.0f 分钟，@600×）' % (label, y, y * 96 / 60))
            return
    w('- %s：全程未出现' % label)
first_where(lambda s: (s.get('sgPending') or 0) >= 30, '故事待阅积压到上限 30（旧条目开始被丢弃）')
first_where(lambda s: (s.get('techSum') or 0) >= 140, '科技总量 ≥140 级')
first_where(lambda s: (s.get('sectRep') or 0) >= 480, '门派声望达到当日上限 480')
first_where(lambda s: (s.get('army') or 0) >= 8000, '兵力达到 8000')
first_where(lambda s: (s.get('cities') or 0) >= 3, '第 3 城建成')
first_where(lambda s: (s.get('reports') or 0) >= 30, '战报 ≥30 份')
# 科技/建筑封顶时刻
for y in sorted(stw):
    s = stw[y]
    bl = s.get('bl', {})
    gov = bl.get('guanfu', 0)
    if gov >= 12:
        w('- **官府达到 Lv12（城市满级）**：第 %d 游戏年' % y)
        break
# 兵力/金 走势（稀疏采样）
w('\n## 3. 曲线（兵力 / 金 / 人口 / 木——四大关键指标）')
w('| 年 | 兵力 | 城外驻军 | 金 | 人口 | 木 | 石 |')
w('|---|---|---|---|---|---|---|')
for y in range(5, 226, 20):
    s = byyear.get(y)
    if not s: continue
    r = s.get('res', {})
    w('| %d | %s | %s | %s | %s | %s | %s |' % (y, fmt(s.get('army')), fmt(s.get('garrison')), fmt(r.get('gold')), fmt(s.get('pop')), fmt(r.get('wood')), fmt(r.get('stone'))))

# ============ 4. 战斗统计 ============
w('\n## 4. 战斗统计（battles.jsonl）')
w('总战斗：%d 场' % len(battles))
by = collections.Counter(); win = collections.Counter(); lossA = 0; lossD = 0
byphase = collections.Counter(); winphase = collections.Counter()
tm = {}
for b in battles:
    by[b.get('mode')] += 1
    if b.get('winner') == 'atk': win[b.get('mode')] += 1
    lossA += b.get('atkLoss') or 0; lossD += b.get('defLoss') or 0
    y = b.get('y', 0)
    ph = '前期(≤10年)' if y <= 10 else ('中期(10-60)' if y <= 60 else '后期(>60)')
    byphase[ph] += 1
    if b.get('winner') == 'atk': winphase[ph] += 1
    tm[b.get('target', '')] = tm.get(b.get('target', ''), 0) + 1
for m, n in by.most_common():
    w('- %s：%d 场，胜 %d（%.0f%%）' % (m, n, win[m], 100.0 * win[m] / n))
w('- 累计：我军损兵 **%s**，歼敌 **%s**' % (fmt(lossA), fmt(lossD)))
w('- 分阶段：' + ' · '.join('%s %d 场/胜 %d' % (k, byphase[k], winphase[k]) for k in byphase))
top = sorted(tm.items(), key=lambda x: -x[1])[:6]
w('- 目标集中度 Top6：' + '、'.join('%s×%d' % (k or '?', v) for k, v in top))

# ============ 5. 入侵损失合计 ============
w('\n## 5. 入侵（外敌来袭）')
inv_hit = [e for e in events if '攻破城门' in e.get('msg', '')]
inv_hold = [e for e in events if '击退' in e.get('msg', '')]
w('- 被攻破 **%d 次** · 击退 **%d 次**（共 %d 次来袭）' % (len(inv_hit), len(inv_hold), len(inv_hit) + len(inv_hold)))
pat = re.compile(r'粮食 −([\d.万亿]+)、木材 −([\d.万亿]+)、石料 −([\d.万亿]+)、铁锭 −([\d.万亿]+)、黄金 −([\d.万亿k]+)')
def num(sx):
    m = re.match(r'([\d.]+)([万亿k]?)', sx or '')
    if not m: return 0
    v = float(m.group(1)); u = m.group(2)
    return v * (1e4 if u == '万' else 1e8 if u == '亿' else 1e3 if u == 'k' else 1)
tot = [0, 0, 0, 0, 0]
for e in inv_hit:
    m = pat.search(e.get('msg', ''))
    if m:
        for i in range(5): tot[i] += num(m.group(i + 1))
w('- 被破累计损失：粮 %s · 木 %s · 石 %s · 铁 %s · 金 %s' % tuple(fmt(x) for x in tot))
byc = collections.Counter()
for e in inv_hit + inv_hold:
    m = re.search(r'(?:🛡|⚔) (\S+?)(?: 被| 击退)', e.get('msg', ''))
    if m: byc[m.group(1)] += 1
w('- 分城：' + '、'.join('%s %d 次' % (k, v) for k, v in byc.most_common()))
# 来犯战力样例
samples = [e['msg'] for e in inv_hit[-3:]]
w('- 末段样例：')
for sx in samples: w('  - ' + sx)

# ============ 6. 经济流 ============
w('\n## 6. 经济流（事件解析）')
sells = [e for e in events if '市易：售出' in e.get('msg', '')]
sg = 0; sgrain = 0
for e in sells:
    m = re.search(r'售出 ([\d.]+)([万亿]?) 得金 ([\d.]+)([万亿]?)', e.get('msg', ''))
    if m:
        sg += num(m.group(3) + m.group(4)); sgrain += num(m.group(1) + m.group(2))
w('- 市场售粮：%d 笔，累计售出 %s 粮、换金 %s（均价 ≈ %.1f 粮/金）' % (len(sells), fmt(sgrain), fmt(sg), (sgrain / sg if sg else 0)))
sal = [e for e in events if '月俸' in e.get('msg', '')]
sp = 0; short = 0
for e in sal:
    m = re.search(r'金 −([\d.]+)([万亿k]?)', e.get('msg', ''))
    if m: sp += num(m.group(1) + (m.group(2) or ''))
    m2 = re.search(r'欠俸 ([\d.]+)([万亿k]?)', e.get('msg', ''))
    if m2: short += num(m2.group(1) + (m2.group(2) or ''))
w('- 月俸：%d 期，累计支付 %s 金，欠俸 %s 金' % (len(sal), fmt(sp), fmt(short)))
seeds = len([e for e in events if '凡植种子' in e.get('msg', '') and '购买' in e.get('msg', '')])
w('- 种子购买事件行：%d' % seeds)
buildup = len([e for e in events if '建筑完成' in e.get('msg', '') or '升级至 Lv' in e.get('msg', '')])
w('- 建造/升级完成日志：%d 条' % buildup)

# ============ 7. 内容触达 ============
w('\n## 7. 内容触达')
w('- 故事：待阅轨迹（快照）—— %s' % '、'.join('y%d:%d' % (y, stw[y].get('sgPending') or 0) for y in [1, 25, 50, 100, 150, 200, 225] if y in stw))
w('- 史册条目：%s' % '、'.join('y%d:%d' % (y, stw[y].get('chronicle') or 0) for y in [1, 25, 50, 100, 150, 200, 225] if y in stw))
w('- 任务完成（成长）：%s' % (stw.get(225, {}).get('qDone', '?')))
w('- 战报：%s' % (stw.get(225, {}).get('reports', '?')))
w('- 道具种类：%s' % (stw.get(225, {}).get('items', '?')))
w('- 招募将领累计：%s（stats2.recruited）' % (stw.get(225, {}).get('stats2', {}).get('recruited', '?')))
w('- 训练总数：%s（stats2.trained）' % (stw.get(225, {}).get('stats2', {}).get('trained', '?')))

# ============ 8. 终态细节 ============
w('\n## 8. 终态细节（y225 检查点）')
ck = None
p = os.path.join(D, 'checkpoints', 'y225.json')
if os.path.exists(p):
    ck = json.load(io.open(p, encoding='utf-8'))
if ck:
    w('### 8.1 各城建筑（Lv 明细）')
    for c in ck['cities']:
        cells = collections.Counter()
        for cell in c['cells']:
            b = cell.get('build')
            if b: cells[b['id']] = max(cells[b['id']], b.get('lvl', 0))
        ext = collections.Counter()
        for e in c.get('extGrid', []):
            if e.get('type'): ext[e['type']] += (e.get('lv') or 0)
        w('- **%s** (%s,%s) Lv%s · 墙Lv%s · 驻军%s · 城内：%s' % (
            c['name'], c['x'], c['y'], c.get('level'), c.get('wallLv'), fmt(sum((c.get('army') or {}).values())),
            ' '.join('%s%d' % (k, v) for k, v in sorted(cells.items()))))
        w('  - 城外（等级和）：%s' % ' '.join('%s%d' % (k, v) for k, v in sorted(ext.items())))
    w('### 8.2 科技')
    techs = ck.get('techs', {})
    w('- 已研究 %d 项，总等级 %d · 分布：%s' % (len(techs), sum(techs.values()), ' '.join('%s%d' % (k, v) for k, v in sorted(techs.items(), key=lambda x: -x[1])[:20])))
    w('### 8.3 将领（%d 名）' % len(ck.get('generals', [])))
    for g in ck.get('generals', []):
        w('- %s Lv%d %s · 属性 统%d 武%d 智%d' % (g.get('name'), g.get('level'), g.get('rank'), g.get('tong', 0), g.get('yw', 0), g.get('zm', 0)))
    w('### 8.4 野地 / 王国内务')
    w('- 野地：%s' % json.dumps(ck.get('wilds', []), ensure_ascii=False)[:600])
    w('- 门派：%s · 爵位 rank=%s · 声望 %s · 民心 %s' % (json.dumps(ck.get('sect'), ensure_ascii=False), ck.get('rank'), ck.get('rep'), ck.get('hearts')))
    w('- 神器供奉 pts=%s' % (ck.get('artifacts', {}).get('pts')))
    w('- 年号/纪元 eraIndex=%s（eraHistory %d 条）' % ((ck.get('world') or {}).get('eraIndex'), len(ck.get('eraHistory') or [])))
    eras = ck.get('eraHistory') or []
    if eras: w('- 纪元变更末 5 条：%s' % json.dumps(eras[-5:], ensure_ascii=False)[:500])
    w('- 待阅故事 sgPending=%d 条；stories=%s' % (len(ck.get('sgPending') or []), json.dumps(ck.get('stories'), ensure_ascii=False)[:300]))
    ch = ck.get('chronicle') or []
    w('- 史册末 3 条：%s' % json.dumps(ch[-3:], ensure_ascii=False)[:400])

# ============ 9. 首次时间表 ============
w('\n## 9. 首次时间表（游戏年 / 现实分钟 @600×）')
def first_event(kw, label, neg=None):
    for e in events:
        m = e.get('msg', '')
        if kw in m and (not neg or neg not in m):
            w('- %s：y%.1f（现实 %d 分钟）— %s' % (label, e.get('gt', 0) / 57600, e.get('t', 0) / 60, m[:80]))
            return
    w('- %s：未出现' % label)
first_event('开始训练', '首次募兵')
first_event('大军已发', '首次出征')
first_event('战报', '首份战报', )
first_event('市易：售出', '首次售粮')
first_event('采集收获', '首次采集收获')
first_event('秘境收获', '首次秘境收获')
first_event('占领野地', '首次占领野地')
first_event('筑城成功', '首次筑城')
first_event('月俸', '首期月俸')
first_event('本营募兵队列已满', '首次募兵队列满')

io.open(OUT, 'w', encoding='utf-8').write('\n'.join(L))
print('digest written:', OUT, 'lines =', len(L))
