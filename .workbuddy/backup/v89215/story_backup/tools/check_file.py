#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""story/tools/check_file.py —— 单文件校验（并行开工用；与 check.py 同一套判据，零逻辑复制）

用法：
    python story/tools/check_file.py story/vol-35.part.js

说明：
    · 复用 check.py 的 load_vol / check_story —— 判据唯一出口不变（12 条全跑）；
    · 额外做「跨全库 id 唯一」检查（防止与已入位卷撞 id）；
    · 供子代理在**未入位**的 `.part` 文件上自测：全库 check / gen_manifest 的
      文件名口径是 `^vol-\\d+\\.js$`，`vol-NN.part.js` 不在其中 —— 因此并行生产
      不会干扰正在运行的自动批次，反之亦然。入位（改名）由主会话统一执行。
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check as C  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print(u'用法：python story/tools/check_file.py <卷文件路径>')
        return 1
    target = sys.argv[1]
    if not os.path.exists(target):
        print(u'找不到文件：%s' % target)
        return 1

    errs, rows = [], []
    try:
        data = C.load_vol(target)
    except Exception as ex:
        print(u'❌ 解析失败：%s' % ex)
        return 1
    for st in data:
        c, rk = C.check_story(st, errs)
        rows.append((st.get('id'), (st.get('anchor') or {}).get('kind'), rk,
                     len(st.get('nodes') or []), len(st.get('endings') or []), c))

    # 跨全库 id 唯一（与其他已入位卷对撞检查；目标文件自身不计入）
    mine = set(r[0] for r in rows)
    seen = {}
    target_real = os.path.realpath(target)
    for f in sorted(os.listdir(C.ROOT)):
        if not re.match(r'^vol-\d+\.js$', f):
            continue
        if os.path.realpath(os.path.join(C.ROOT, f)) == target_real:
            continue
        try:
            for st in C.load_vol(os.path.join(C.ROOT, f)):
                seen.setdefault(st.get('id'), f)
        except Exception:
            continue
    for sid in sorted(mine):
        if sid in seen:
            errs.append(u'%s: id 与 %s 中已有篇目重复' % (sid, seen[sid]))

    print('=' * 70)
    print(u'单文件校验 · %s · 篇数 %d' % (target, len(rows)))
    print('=' * 70)
    print(u'%-18s %-9s %4s %4s %4s %6s' % (u'id', u'anchor', u'段', u'幕', u'结局', u'字数'))
    for r in rows:
        print('%-18s %-9s %4d %4d %4d %6d' % r)
    if rows:
        print(u'合计 %d 字 · 单篇均 %d 字'
              % (sum(r[5] for r in rows), sum(r[5] for r in rows) // len(rows)))
    if errs:
        print(u'❌ 未通过 %d 项：' % len(errs))
        for x in errs:
            print(u'   - ' + x)
        return 1
    print(u'✅ 全部通过（%d 篇）' % len(rows))
    return 0


if __name__ == '__main__':
    sys.exit(main())
