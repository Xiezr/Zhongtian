#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""大地图 LOD 改动一键回滚（干跑先行 · 本项目铁律）。

本次改动（v90.50 · 大地图，仅**全域总览层**）：
  · js/ui.js   —— 缩略图/天下大势整图底开关 GAME.ui.useBigmap（默认 false）
  · assets/icons/ui/bigmap_world.png —— 烘焙的 500×500 全域整图（新增素材）
  · .workbuddy/tools/show/{bake_bigmap,shot_bigmap_lod}.js
  （主地图 LOD、世界地图面板均已按老板决定撤回。）

两种回滚：
  A. 运行期（最轻）：开关默认就是 false —— 什么都不用做，观感即原始。
     控制台亦可显式关：GAME.map.useBigmap=false; GAME.ui.useBigmap=false;
  B. 代码级：本脚本把 js/map.js + js/ui.js 还原到 git HEAD（本次改动未提交），
     并删除新增素材与脚本。

用法：
  python .workbuddy/tools/show/bigmap_rollback.py           # 干跑：只报告
  python .workbuddy/tools/show/bigmap_rollback.py --apply   # 执行回滚
"""
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
FILES = ['js/ui.js']
NEW = [
    'assets/icons/ui/bigmap_world.png',
    '.workbuddy/tools/show/bake_bigmap.js',
    '.workbuddy/tools/show/shot_bigmap_lod.js',
]


def run(args):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True)


def main():
    apply = '--apply' in sys.argv
    print('=== 大地图 LOD 回滚（%s）===' % ('执行' if apply else '干跑'))
    print('⚠️ 代码级回滚 = git checkout HEAD，会把这两个文件里**其它未提交改动一并还原**。')
    print('   推荐用运行期回滚（开关本就是默认关，零影响）；仅在确定不要其它未提交改动时才 --apply。')

    d = run(['git', 'diff', '--stat', '--'] + FILES)
    print('--- 将被还原的改动 ---')
    print(d.stdout.strip() or '(无 git 改动)')

    print('--- 将删除的新增文件 ---')
    for f in NEW:
        p = os.path.join(ROOT, f)
        print('  %s %s' % ('存在' if os.path.exists(p) else '缺失', f))

    if not apply:
        print('\n[干跑] 未做任何改动。加 --apply 执行。')
        return

    if d.stdout.strip():
        r = run(['git', 'checkout', 'HEAD', '--'] + FILES)
        if r.returncode != 0:
            print('git checkout 失败：' + r.stderr)
            return
        print('已还原：' + ' '.join(FILES))

    for f in NEW:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            os.remove(p)
            print('已删除：' + f)

    print('\n[完成] 代码级回滚完成。运行期如需保底，再显式关两个开关即可。')


if __name__ == '__main__':
    main()
