#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""story/tools/gen_manifest.py —— 生成/更新 500 篇生产台账（manifest.json）

用法：
    python story/tools/gen_manifest.py          # 重建台账 + 同步已写卷（幂等）

产物：
    story/manifest.json —— 生产台账：每篇的 id / 锚点 / 生产序号 / 标题 / 状态 / 字数 / 结局数 / 所在卷

口径（重要）：
    · **计划**由分配表推导（见 ALLOC）：锚点 × 篇数，合计 500，按 seq 排序 = 生产顺序；
    · **落盘**以 vol-*.js 为准（唯一事实源）：台账只记录、不臆造；
    · `file` = 该篇实际写在哪个卷文件里（未写 = null）；卷文件按 25 篇滚动填充；
    · 可随时停、随时续：下一批该写哪些 = 台账里 status 为 pending 的前 N 条。
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'manifest.json')
VOL_SIZE = 25          # 每卷目标篇数

BUILDINGS = [
    ('guanfu', '官府'), ('minfang', '民房'), ('shuyuan', '书院'), ('junying', '军营'),
    ('xiaochang', '校场'), ('shichang', '市场'), ('cangku', '仓库'), ('chengqiang', '城墙'),
    ('yizhan', '驿站'), ('fenghuotai', '烽火台'), ('majiu', '马厩'), ('kezhan', '客栈'),
    ('zhaoxianguan', '招贤馆'), ('honglusi', '鸿胪寺'), ('tiejiangpu', '铁匠铺'),
    ('gongjiangzuofang', '工匠作坊'),
]
EXTS = [('farm', '农田'), ('forest', '伐木场'), ('quarry', '采石场'), ('mine', '铁矿场')]
WILDS = [('caoyuan', '草原'), ('zhaoze', '沼泽'), ('lake', '湖泊'),
         ('forest', '森林'), ('desert', '荒漠'), ('hill', '山地')]
CITY_TIERS = [('capital', '都城', 20), ('zhou', '州城', 30), ('jun', '郡城', 40), ('county', '县城', 50)]

ALLOC = (
    [('bld', 'building', bid, 10) for bid, _ in BUILDINGS]      # 160
    + [('ext', 'ext', eid, 10) for eid, _ in EXTS]              # 40
    + [('wild', 'wild', wid, 20) for wid, _ in WILDS]           # 120
    + [('city', 'city', cid, n) for cid, _, n in CITY_TIERS]    # 140
    + [('misc', 'misc', 'any', 40)]                             # 40
)
TOTAL = sum(n for _, _, _, n in ALLOC)     # 500


def skeleton():
    plan, seq = [], 0
    for prefix, kind, aid, count in ALLOC:
        for i in range(1, count + 1):
            seq += 1
            sid = '%s-%s-%02d' % (prefix, aid, i) if aid != 'any' else 'misc-%02d' % i
            plan.append({
                'id': sid,
                'anchor': {'kind': kind, 'id': aid},
                'seq': seq,
                'title': None,
                'status': 'pending',
                'chars': 0,
                'endings': 0,
                'file': None,
            })
    return plan


def sync_from_vols(plan):
    """把已写卷的信息回填（唯一事实源是 vol-*.js）"""
    index = {p['id']: p for p in plan}
    extra = []
    vols = sorted(f for f in os.listdir(ROOT) if re.match(r'^vol-\d+\.js$', f))
    for v in vols:
        src = io.open(os.path.join(ROOT, v), encoding='utf-8').read()
        i, j = src.rindex('concat('), src.rindex(']);')
        for st in json.loads(src[i + len('concat('):j + 1]):
            p = index.get(st['id'])
            if p is None:
                extra.append(st['id'])
                continue
            chars = len(re.sub(r'\s+', '', ''.join(
                [n.get('t', '') for n in st.get('nodes', [])] +
                [e.get('t', '') for e in st.get('endings', [])])))
            p['title'] = st.get('title')
            p['chars'] = chars
            p['endings'] = len(st.get('endings', []))
            p['file'] = v
            p['status'] = 'done'
    return vols, extra


def main():
    plan = skeleton()
    if len(plan) != TOTAL:
        print('✗ 分配表算出来 %d 篇，应为 %d 篇' % (len(plan), TOTAL))
        return 1
    vols, extra = sync_from_vols(plan)
    done = sum(1 for p in plan if p['status'] == 'done')

    per_vol = {}
    for p in plan:
        if p['file']:
            per_vol.setdefault(p['file'], [0, 0])
            per_vol[p['file']][0] += 1
            per_vol[p['file']][1] += p['chars']

    out = {
        '_note': '500 篇文字游戏故事生产台账 · 由 story/tools/gen_manifest.py 生成，勿手改',
        'total': TOTAL,
        'done': done,
        'pending': TOTAL - done,
        'volSize': VOL_SIZE,
        'volFiles': len(vols),
        'alloc': [{'group': g, 'kind': k, 'anchor': a, 'count': n} for g, k, a, n in ALLOC],
        'vols': [{'file': v, 'count': per_vol.get(v, [0, 0])[0], 'chars': per_vol.get(v, [0, 0])[1]}
                 for v in vols],
        'plan': plan,
    }
    io.open(OUT, 'w', encoding='utf-8', newline='').write(
        json.dumps(out, ensure_ascii=False, indent=1))

    print('✅ manifest.json：计划 %d 篇 · 已写 %d 篇 · 待写 %d 篇 · 卷文件 %d 个'
          % (TOTAL, done, TOTAL - done, len(vols)))
    for v in vols:
        c, ch = per_vol.get(v, [0, 0])
        print('   %-12s %2d 篇 / %d 字' % (v, c, ch))
    if extra:
        print('⚠ 故事文件里有台账之外的 id：%s' % extra)
    nxt = [p['id'] for p in plan if p['status'] == 'pending'][:5]
    print('   下一批建议起手：%s' % '、'.join(nxt))
    return 0


if __name__ == '__main__':
    sys.exit(main())
