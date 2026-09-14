# -*- coding: utf-8 -*-
"""v70 适配：让既有测试跟上「君主也是将领」这一新事实（不改测试意图，只改口径）。

  A. smoke「全库将领 id 唯一」：3 人 → 4 人（初始名将 + 君主 + 两名测试将）
  B. smoke「v45 将领行」：grow-name → rankBadge 的窗口 260 → 420
     （v70 在名字后多挂了一个「君主」标，窗口被挤爆）
  C. smoke「名单与席位同源」：A 城 1 人 → 2 人（初始名将 + 君主）
  D. e2e「解雇二次确认」：原来挑**最后一位** —— v70 起最后一位是君主（不可解雇），
     必须挑"非君主"的那位（测试意图是"解雇能成功"，不是"能解雇君主"）。

用法：python patch_v70_adapt.py     （幂等）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
SMOKE = os.path.join(ROOT, 'smoke-test.js')
E2E = os.path.join(ROOT, 'e2e-test.js')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def cut(src, old, new, tag, optional=False):
    n = src.count(old)
    if n == 0:
        if optional:
            print('  · %s：已改过（跳过）' % tag)
            return src
        print('!! %s：锚点 0 次命中，拒绝写盘' % tag)
        return None
    if n > 1:
        print('!! %s：锚点 %d 次（必须唯一），拒绝写盘' % (tag, n))
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


def save_lf(p, s, tag):
    if '\r' in s:
        print('!! %s：含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    return b'\r' not in io.open(p, 'rb').read()


A_OLD = """    var seen = {}, dup = false;
    st.generals.forEach(function (g) { if (seen[g.id]) dup = true; seen[g.id] = true; });
    return !dup && st.generals.length === 3;"""
A_NEW = """    var seen = {}, dup = false;
    st.generals.forEach(function (g) { if (seen[g.id]) dup = true; seen[g.id] = true; });
    /* v70：开局名单 = 初始名将 + **君主将领**（老板：玩家角色本人也是将领），
       再加本用例推入的两位 → 4 人 */
    return !dup && st.generals.length === 4;"""

B_OLD = "    && /class=\"grow-name\"[\\s\\S]{0,260}rankBadge/.test(uiS)"
B_NEW = ("    /* v70：名字后多了「君主」标，窗口 260 → 420（本断言要的是「名字行紧跟资质」，不是定长） */\n"
         "    && /class=\"grow-name\"[\\s\\S]{0,420}rankBadge/.test(uiS)")

C_OLD = """      return listA.length === inA.length && inA.length === 1
        && G.generalsIn(b).length === 1 && G.generalsIn(b)[0].name === 'B城将';"""
C_NEW = """      /* v70：A 城 = 初始名将 + 君主（君主归属首城）→ 2 人；关键不变量是
         "名单判据与 generalsIn 同一批"（前一个等号），人数只是它的具体值 */
      return listA.length === inA.length && inA.length === 2
        && G.generalsIn(b).length === 1 && G.generalsIn(b)[0].name === 'B城将';"""

D_OLD = """  /* ---- ⑥ 解雇二次确认 ---- */
  /* 确保有 2 名将领（帐下至少留一位，故解雇需 ≥2） */
  if (s.generals.length < 2) {
    s.generals.push(G.makeGeneral('待解雇', 5, 'idle', s.cities[0].id, false));
  }
  const before22 = s.generals.length;
  G.ui.openDismissConfirm(s.generals[s.generals.length - 1].id);"""

D_NEW = """  /* ---- ⑥ 解雇二次确认 ---- */
  /* 确保有可解雇的将领。v70（老板）起名单里恒有一位**君主将领**且不可解雇 ——
     所以这里挑"非君主"的那位（本用例要验的是"解雇能成功"，不是"能解雇君主"）。 */
  let dismissable22 = s.generals.filter((g) => !g.isLord);
  if (!dismissable22.length) {
    s.generals.push(G.makeGeneral('待解雇', 5, 'idle', s.cities[0].id, false));
    dismissable22 = s.generals.filter((g) => !g.isLord);
  }
  const victim22 = dismissable22[dismissable22.length - 1];
  const before22 = s.generals.length;
  G.ui.openDismissConfirm(victim22.id);"""

EDITS = [
    (SMOKE, A_OLD, A_NEW, 'A. smoke id 唯一 3→4'),
    (SMOKE, B_OLD, B_NEW, 'B. smoke 将领行窗口 260→420'),
    (SMOKE, C_OLD, C_NEW, 'C. smoke 同源 1→2'),
    (E2E, D_OLD, D_NEW, 'D. e2e 解雇挑非君主'),
]


def main():
    files = {}
    fails = []
    if 'v70：开局名单' in read(SMOKE) and 'dismissable22' in read(E2E):
        print('· 全部已改过（幂等跳过）')
        return 0
    for path, old, new, tag in EDITS:
        if path not in files:
            files[path] = read(path)
        res = cut(files[path], old, new, tag, optional=True)
        if res is None:
            fails.append(tag)
            continue
        files[path] = res
    for path, s in files.items():
        if not save_lf(path, s, os.path.basename(path)):
            fails.append(os.path.basename(path))
    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 全部完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
