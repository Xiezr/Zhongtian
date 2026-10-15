# -*- coding: utf-8 -*-
"""发版脚本（v90.94 治理版）：一次同步三处版本标识里的「代码侧两处」。

用法：
  python .workbuddy/tools/patch/bump_version.py --bump
  python .workbuddy/tools/patch/bump_version.py --bump --version v90.94
  python .workbuddy/tools/patch/bump_version.py --build 9173 --check

管什么：
  ② index.html：剥掉全部 script 的旧 ?v= → 统一挂新号 → BUILD 标记同步（含 vendor/）
  ① js/main.js：GAME.VERSION 置为 --version 值（不给则不动）

为什么不靠人记：
  ?v= 只在**值变化**时才击穿浏览器缓存；值不变 = 浏览器继续吃旧文件。
  这正是老板连报三轮「还是不对」的根因（docs/AI工作备忘.md §99 / v89.77）。
  所以「改完 js 必须让 ?v= 递增」这件事只能靠机制，不能靠人记得按 Ctrl+F5。

v90.94 修掉旧脚本（.workbuddy/tmp/cachebust.js）的三处缺陷：
  ① 正则只匹配 js|story/ 前缀 → 漏掉 vendor/three.min.js（survive 靠 smoke 守卫抓，脚本自身不自洽）
  ② writeFileSync 写在自检**之前** → 不自洽时也已落盘、无回滚
  ③ 躺在 .workbuddy/tmp/ 临时目录 → 有被清理、机制蒸发的风险（已迁到 tools/patch/）
"""

import argparse
import io
import os
import re
import sys

MIN_TAGS = 12  # index.html 脚本数下限（防「正则有病 → 只改到一两个」的平凡解）


def find_root():
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        if os.path.exists(os.path.join(d, 'index.html')) and os.path.isdir(os.path.join(d, 'js')):
            return d
        nd = os.path.dirname(d)
        if nd == d:
            raise SystemExit('[X] 找不到仓库根（含 index.html 与 js/）')
        d = nd


ROOT = find_root()
P_HTML = os.path.join(ROOT, 'index.html')
P_MAIN = os.path.join(ROOT, 'js', 'main.js')

RE_TAG = re.compile(r'<script src="([^"]+\.js)(?:\?v=[0-9]+)?"></script>')
RE_SRC = re.compile(r'<script src="([^"]*)"></script>')
RE_BUILD = re.compile(r'<!-- BUILD ([0-9]+) -->')
RE_GVER = re.compile(r"GAME\.VERSION = '([^']*)';")


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write_atomic(p, s):
    tmp = p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def selfcheck(html, build):
    """所有断言都带下限，防平凡解（空文件 / 只改一个）。"""
    bad = []
    tags = RE_SRC.findall(html)
    if len(tags) < MIN_TAGS:
        bad.append('script 标签只有 %d 个（下限 %d）' % (len(tags), MIN_TAGS))
    miss = [t for t in tags if not t.endswith('?v=' + build)]
    if miss:
        bad.append('%d 个脚本未挂 ?v=%s：%s' % (len(miss), build, ', '.join(miss[:4])))
    marks = RE_BUILD.findall(html)
    if len(marks) != 1:
        bad.append('BUILD 标记出现 %d 次（应恰好 1 次）' % len(marks))
    elif marks[0] != build:
        bad.append('BUILD 标记 %s 与目标 %s 不一致' % (marks[0], build))
    return bad


def main():
    ap = argparse.ArgumentParser(description='同步版本标识（index.html ?v=/BUILD + main.js GAME.VERSION）')
    ap.add_argument('--bump', action='store_true', help='BUILD 号 +1')
    ap.add_argument('--build', default=None, help='指定 BUILD 号（数字）')
    ap.add_argument('--version', default=None, help='同步 GAME.VERSION，形如 v90.94')
    ap.add_argument('--check', action='store_true', help='干跑：只检不写')
    a = ap.parse_args()

    html = read(P_HTML)
    m0 = RE_BUILD.search(html)
    if not m0:
        raise SystemExit('[X] index.html 缺 <!-- BUILD n --> 标记')
    cur = m0.group(1)

    if a.build:
        new = str(a.build)
    elif a.bump:
        new = str(int(cur) + 1)
    else:
        new = cur
    if not re.match(r'^[0-9]{3,6}$', new):
        raise SystemExit('[X] BUILD 号不合法：%s' % new)

    ver = a.version
    if ver is not None and not re.match(r'^v[0-9]+\.[0-9]+$', ver):
        raise SystemExit('[X] 语义版本不合法（应形如 v90.94）：%s' % ver)

    new_html, n = RE_TAG.subn(lambda m: '<script src="%s?v=%s"></script>' % (m.group(1), new), html)
    new_html, nb = RE_BUILD.subn('<!-- BUILD %s -->' % new, new_html)
    if nb != 1:
        raise SystemExit('[X] BUILD 标记替换 %d 次（应 1 次）' % nb)

    new_main = None
    if ver:
        main_src = read(P_MAIN)
        new_main, nv = RE_GVER.subn("GAME.VERSION = '%s';" % ver, main_src)
        if nv != 1:
            raise SystemExit('[X] GAME.VERSION 替换 %d 次（应 1 次）' % nv)

    bad = selfcheck(new_html, new)
    if ver:
        mv = RE_GVER.search(new_main)
        if not mv or mv.group(1) != ver:
            bad.append('GAME.VERSION 落点异常')
    if bad:
        print('[X] 自检未过 —— 未写盘（文件保持原样）：')
        for b in bad:
            print('    - ' + b)
        return 2

    print('BUILD %s -> %s | 重挂 %d 个脚本 | 语义版本 %s' % (cur, new, n, ver or '（未动）'))
    print('  自检：脚本 %d 个 · 全部 ?v=%s · BUILD 标记一致' % (len(RE_SRC.findall(new_html)), new))

    if a.check:
        print('  --check 干跑，未写盘。')
        return 0

    write_atomic(P_HTML, new_html)
    print('  [OK] index.html 已落盘')
    if new_main is not None:
        write_atomic(P_MAIN, new_main)
        print('  [OK] js/main.js 的 GAME.VERSION 已落盘')
    print('')
    print('三处里的第 (3) 处 —— 档案行，脚本不代写（格式是人写的表格）：')
    print('  docs/项目地图.md | 需求档案.md | docs/需求台账-v9012-13.md')
    return 0


if __name__ == '__main__':
    sys.exit(main())
