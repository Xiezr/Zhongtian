#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""story/tools/check.py —— 故事库校验（唯一判据出口）· v2 结构

用法：
    python story/tools/check.py            # 校验全部卷
    python story/tools/check.py vol-01     # 只校验某一卷

v2 判据（老板 2026-09-17「适当增长篇幅，5-7段选择」—— 任一不过 = 退出码 1）：
  1  数据体是合法 JSON（可从 concat( ... ) 中解析）
  2  篇 id 全局唯一
  3  anchor.kind / anchor.id 在白名单内
  4  段数（层数）5~7：从首幕逐层推进，**全路径同层** ——
     幕的选项只能指向「下一层」的幕；结局只能由最深层的幕指向
  5  每幕 >= 2 个选项；选项 to 指向存在的幕/结局；选项文案 l 与后果提示 d 非空
  6  全部幕从首幕可达；全部结局可达（无孤儿、无死结）
  7  字数（幕文 + 结局文）>= 2400；每幕 >= 240；每结局 >= 180
  8  结局数 >= 3；grade 至少覆盖 win 与 lose；同一幕的选项不得指向同一结局
  9  壁画：每幕 / 每结局必须有 bg 键，且在白名单内
     （白名单与 js/ui.js 的 ui.SG_MURAL 键名须一致；漏改由 smoke §81 兜底）
  10 文本不含字面反斜杠字符（防「双转义」——显示层不露出转义字样）
  11 中文正文不含英文残留（幕文 / 幕题 / 选项 / 结局中不得出现 3 个及以上连续 ASCII 字母）
  12 reward 白名单（键仅 grain/wood/stone/iron/gold/pop/rep/item/count；
     item 仅 "jingtie" / "lingsui" + 四部内功秘籍（v89.28 题材线「功法」：
     book_sunzi / book_liutao / book_wuqin / book_yuenv），且必须带正整数 count）
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ANCHORS = {
    'building': ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku',
                 'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan',
                 'honglusi', 'tiejiangpu', 'gongjiangzuofang'],
    'ext': ['farm', 'forest', 'quarry', 'mine'],
    'wild': ['caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'],
    'city': ['capital', 'zhou', 'jun', 'county', 'self'],
    'misc': ['any'],
}

# v89.8 壁画白名单（13 键；与 js/ui.js ui.SG_MURAL 一致）
MURALS = ['yat', 'ku', 'zhai', 'yuan', 'jiu', 'xiang', 'hu', 'hud', 'shan', 'ying', 'men', 'fu', 'xiao']

MIN_TOTAL = 2400
MIN_NODE = 240
MIN_END = 180
RANK_MIN, RANK_MAX = 5, 7


def load_vol(path):
    src = io.open(path, encoding='utf-8').read()
    # 末次匹配：文件头注释里也出现过 concat( 的示例，取真正的数据体
    i = src.rindex('concat(')
    j = src.rindex(']);')
    payload = src[i + len('concat('):j + 1]
    return json.loads(payload)


def count_chars(s):
    """中文字数：去空白后计数（标点计入，与"每段至少1千字"的通俗口径一致）"""
    return len(re.sub(r'\s+', '', s or ''))


def layers_of(nodes):
    """逐层推进的层号（BFS 最短路深度，首幕 = 1）；返回 {id: depth}"""
    if not nodes:
        return {}
    idx = {n.get('id'): n for n in nodes}
    depth = {nodes[0].get('id'): 1}
    queue = [nodes[0].get('id')]
    while queue:
        cur = queue.pop(0)
        for op in (idx.get(cur) or {}).get('o') or []:
            t = op.get('to')
            if t in idx and t not in depth:
                depth[t] = depth[cur] + 1
                queue.append(t)
    return depth


def check_story(st, errs):
    sid = st.get('id', '(无 id)')
    a = st.get('anchor') or {}
    nodes = st.get('nodes') or []
    ends = st.get('endings') or []
    e = lambda m: errs.append('%s: %s' % (sid, m))

    # 3 anchor
    if a.get('kind') not in ANCHORS:
        e('anchor.kind 非法：%r' % a.get('kind'))
    elif a.get('id') not in ANCHORS[a['kind']]:
        e('anchor.id 非法：%r' % a.get('id'))

    # 8 结局数
    if len(ends) < 3:
        e('结局数 %d < 3' % len(ends))

    nid = [n.get('id') for n in nodes]
    eid = [x.get('id') for x in ends]
    if len(set(nid)) != len(nid):
        e('幕 id 重复')
    if len(set(eid)) != len(eid):
        e('结局 id 重复')
    allids = set(nid) | set(eid)

    # 4 层数（段数）+ 全路径同层
    depth = layers_of(nodes)
    ranks = max(depth.values()) if depth else 0
    if ranks < RANK_MIN or ranks > RANK_MAX:
        e('段数 %d 不在 %d~%d' % (ranks, RANK_MIN, RANK_MAX))
    for n in nodes:
        cur = depth.get(n.get('id'))
        if cur is None:
            continue                                  # 可达性由判据 6 报
        seen_endings = set()
        for op in n.get('o') or []:
            t = op.get('to')
            if t in set(eid):
                if cur != ranks:
                    e('幕 %s（第 %s 层）指向结局 —— 结局只能由第 %d 层指向' % (n.get('id'), cur, ranks))
                if t in seen_endings:
                    e('幕 %s 的两个选项指向同一结局 %s' % (n.get('id'), t))
                seen_endings.add(t)
            elif t in set(nid):
                td = depth.get(t)
                if td != (cur or 0) + 1:
                    e('幕 %s（第 %s 层）指向 %s（第 %s 层）—— 只能指向下一层' % (n.get('id'), cur, t, td))

    # 5 选项与指向 + 9 壁画
    for n in nodes:
        ops = n.get('o') or []
        if len(ops) < 2:
            e('幕 %s 选项 %d < 2' % (n.get('id'), len(ops)))
        if (n.get('bg') or '') not in MURALS:
            e('幕 %s 壁画 bg 非法/缺失：%r' % (n.get('id'), n.get('bg')))
        for op in ops:
            if not (op.get('l') or '').strip():
                e('幕 %s 有选项缺文案 l' % n.get('id'))
            if not (op.get('d') or '').strip():
                e('幕 %s 有选项缺后果提示 d' % n.get('id'))
            if op.get('to') not in allids:
                e('幕 %s 的选项指向不存在：%r' % (n.get('id'), op.get('to')))
    for x in ends:
        if (x.get('bg') or '') not in MURALS:
            e('结局 %s 壁画 bg 非法/缺失：%r' % (x.get('id'), x.get('bg')))

    # 6 可达性（从首幕广搜）
    if nodes:
        seen, stack = set(), [nodes[0]['id']]
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            node = next((x for x in nodes if x.get('id') == cur), None)
            for op in (node or {}).get('o') or []:
                stack.append(op.get('to'))
        got_nodes = seen & set(nid)
        got_ends = seen & set(eid)
        if len(got_nodes) != len(nid):
            e('有孤儿幕（不可达）：%s' % sorted(set(nid) - got_nodes))
        if len(got_ends) != len(eid):
            e('有不可达结局：%s' % sorted(set(eid) - got_ends))

    # 7 字数
    total = 0
    for n in nodes:
        c = count_chars(n.get('t'))
        total += c
        if c < MIN_NODE:
            e('幕 %s 仅 %d 字（< %d）' % (n.get('id'), c, MIN_NODE))
    for x in ends:
        c = count_chars(x.get('t'))
        total += c
        if c < MIN_END:
            e('结局 %s 仅 %d 字（< %d）' % (x.get('id'), c, MIN_END))
    if total < MIN_TOTAL:
        e('全篇仅 %d 字（< %d）' % (total, MIN_TOTAL))
    st['_chars'] = total

    # 10 文本不含字面反斜杠字符（防双转义 \\n —— 显示层会露出重影）
    for n in nodes:
        if chr(92) in (n.get('t') or '') or chr(92) in (n.get('s') or ''):
            e('幕 %s 文本含字面反斜杠（疑似双转义）' % n.get('id'))
        for op in n.get('o') or []:
            if chr(92) in (op.get('l') or '') or chr(92) in (op.get('d') or ''):
                e('幕 %s 选项含字面反斜杠（疑似双转义）' % n.get('id'))
    for x in ends:
        if chr(92) in (x.get('t') or ''):
            e('结局 %s 文本含字面反斜杠（疑似双转义）' % x.get('id'))

    # 11 中文正文不含英文残留（3+ 连续 ASCII 字母；键名 / 锚点 id 不在扫描范围）
    _en = re.compile(r'[A-Za-z]{3,}')
    for n in nodes:
        for fld in ('t', 's'):
            m = _en.search(n.get(fld) or '')
            if m:
                e('幕 %s 的 %s 含英文残留「%s」' % (n.get('id'), fld, m.group()))
        for op in n.get('o') or []:
            for fld in ('l', 'd'):
                m = _en.search(op.get(fld) or '')
                if m:
                    e('幕 %s 选项 %s 含英文残留「%s」' % (n.get('id'), fld, m.group()))
    for x in ends:
        m = _en.search(x.get('t') or '')
        if m:
            e('结局 %s 含英文残留「%s」' % (x.get('id'), m.group()))

    # 12 reward 白名单（键 / item 值 / count 正整数）
    _rwk = set(['grain', 'wood', 'stone', 'iron', 'gold', 'pop', 'rep', 'item', 'count'])
    _rwi = set(['jingtie', 'lingsui', 'book_sunzi', 'book_liutao', 'book_wuqin', 'book_yuenv'])  # v89.28 +4 内功秘籍
    for x in ends:
        rw = x.get('reward') or {}
        badk = set(rw.keys()) - _rwk
        if badk:
            e('结局 %s reward 含非法键：%s' % (x.get('id'), sorted(badk)))
        if 'item' in rw:
            if rw.get('item') not in _rwi:
                e('结局 %s reward.item 非法：%r' % (x.get('id'), rw.get('item')))
            c = rw.get('count')
            if not isinstance(c, int) or c <= 0:
                e('结局 %s reward.item 缺正整数 count' % x.get('id'))

    # 8 grade 覆盖
    grades = set(x.get('grade') for x in ends)
    if 'win' not in grades or 'lose' not in grades:
        e('结局 grade 未覆盖 win+lose：%s' % sorted(grades))

    return total, ranks


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    vols = sorted(f for f in os.listdir(ROOT) if re.match(r'^vol-\d+\.js$', f))
    if only:
        vols = [v for v in vols if v.startswith(only)]
    if not vols:
        print('未找到卷文件'); return 1

    errs, ids, rows = [], {}, []
    for v in vols:
        p = os.path.join(ROOT, v)
        try:
            data = load_vol(p)
        except Exception as ex:
            errs.append('%s: 解析失败 %s' % (v, ex))
            continue
        for st in data:
            sid = st.get('id')
            if sid in ids:
                errs.append('%s: id 重复（已出现在 %s）' % (sid, ids[sid]))
            ids[sid] = v
            c, rk = check_story(st, errs)
            rows.append((sid, (st.get('anchor') or {}).get('kind'), rk,
                         len(st.get('nodes') or []), len(st.get('endings') or []), c, v))

    print('=' * 82)
    print('故事库校验（v2 结构）· 卷数 %d · 篇数 %d' % (len(vols), len(rows)))
    print('=' * 82)
    print('%-18s %-9s %4s %4s %4s %6s  %s' % ('id', 'anchor', '段', '幕', '结局', '字数', '卷'))
    for r in rows:
        print('%-18s %-9s %4d %4d %4d %6d  %s' % r)
    if rows:
        avg = sum(r[5] for r in rows) // len(rows)
        print('-' * 82)
        print('合计 %d 字 · 单篇均 %d 字 · 最短 %d 字 · 最长 %d 字'
              % (sum(r[5] for r in rows), avg, min(r[5] for r in rows), max(r[5] for r in rows)))
    print('-' * 82)
    if errs:
        print('❌ 未通过 %d 项：' % len(errs))
        for x in errs:
            print('   - ' + x)
        return 1
    print('✅ 全部通过（%d 篇）' % len(rows))
    return 0


if __name__ == '__main__':
    sys.exit(main())
