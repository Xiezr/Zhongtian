# -*- coding: utf-8 -*-
"""v69 修正：① 第 57 节 withState 跨节不可见 → 用本地 helper
             ② 分页断言锁定旧变量名 undone → 改为锁定 v69 的新口径（三处同源）

用法：python patch_quest_ready_fix.py     （幂等）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
SMOKE = J('smoke-test.js')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def save_lf(p, s, tag):
    if '\r' in s:
        print('!! %s：内容含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    back = io.open(p, 'rb').read()
    if b'\r' in back:
        print('!! %s：落盘核验失败（出现 CR）' % tag)
        return False
    return True


def cut(src, old, new, tag, optional=False):
    n = src.count(old)
    if n == 0:
        if optional:
            print('  · %s：锚点不存在（已改过？跳过）' % tag)
            return src
        print('!! %s：锚点 0 次命中，拒绝写盘' % tag)
        return None
    if n > 1:
        print('!! %s：锚点 %d 次命中（必须唯一），拒绝写盘' % tag % n)
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


# ---- ① 第 57 节：本地造档 helper（第 49 节的 withState 在它自己的 IIFE 内，跨节不可见）----
A_OLD = """    withState('任务置顶', function (st) {
      G.ensureDailyQuests(true);"""
A_NEW = """    /* 本地造档 helper —— 第 49 节的 withState 定义在**它自己的 IIFE 内**，跨节不可见
       （与 v68 的 govMax 同一类坑：段内 helper 不能跨段落作用域使用） */
    var withState57 = function (name, fn) {
      var keep = G.state;
      try {
        var st57 = G.newGame({ name: name });
        G.state = st57;
        if (G.map.generate) G.map.generate();
        return fn(st57);
      } finally { G.state = keep; }
    };
    withState57('任务置顶', function (st) {
      G.ensureDailyQuests(true);"""

# ---- ② 分页断言：旧形状 /undone\.slice\(gp\.from, gp\.to\)/ ----
B_OLD = ("  check('任务卡片按页切片（不再一次铺满 50 条）', /undone\\.slice\\(gp\\.from, gp\\.to\\)/.test(uiS));")
B_NEW = ("  /* v69：「可领取」浮到顶块后，成长区按**剩余项**分页 ——\n"
         "     分页口径必须三处同源（pageOf / slice / pagerHTML 都吃 growthWait），\n"
         "     否则页码数与实际行数会对不上。 */\n"
         "  check('任务卡片按页切片（不再一次铺满 50 条）',\n"
         "    /growthWait\\.slice\\(gp\\.from, gp\\.to\\)/.test(uiS)\n"
         "    && /ui\\.pageOf\\('growth', growthWait\\.length, 10\\)/.test(uiS)\n"
         "    && /ui\\.pagerHTML\\('growth', growthWait\\.length, 10\\)/.test(uiS));")


def main():
    sm = read(SMOKE)

    if 'withState57' in sm:
        print('· ① 已改过（幂等跳过）')
    else:
        new = cut(sm, A_OLD, A_NEW, '① 第 57 节本地 helper')
        if new is None:
            return 1
        sm = new

    if 'growthWait\\.slice' in sm:
        print('· ② 已改过（幂等跳过）')
    else:
        new = cut(sm, B_OLD, B_NEW, '② 分页断言改新口径')
        if new is None:
            return 1
        sm = new

    if not save_lf(SMOKE, sm, 'smoke-test.js'):
        return 1
    print('✓ 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
