# -*- coding: utf-8 -*-
"""v69 修正（e2e）：领取按钮按 **rq57 自己的 id** 取，不取"第一个"。

根因：e2e 跑到任务段时已是发育过的档，**别的随机任务可能本来就达标**，
它们的「领取」按钮会排在 rq57 之前 —— "取第一个"会让断言随卡池随机波动
（实测两次运行结果不一致：一次 3 红、一次全绿）。
夹具同时改为「优先选未达标的」，保证 base 打桩确实改变了状态。

用法：python patch_quest_ready_e2efix.py     （幂等）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
E2E = os.path.join(ROOT, 'e2e-test.js')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


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


A_OLD = """    let rq57 = null, rdef57 = null;
    for (const e57 of G.state.quests.pool) {
      const d57 = G.randomQuestDef(e57.id);
      if (d57 && !d57.abs) { rq57 = e57; rdef57 = d57; break; }
    }"""

A_NEW = """    let rq57 = null, rdef57 = null;
    for (const e57 of G.state.quests.pool) {          /* 首选：非绝对值且尚未达标 */
      const d57 = G.randomQuestDef(e57.id);
      if (d57 && !d57.abs && !G.randQuestReady(e57)) { rq57 = e57; rdef57 = d57; break; }
    }
    for (const e57 of G.state.quests.pool) {          /* 兜底：任意非绝对值 */
      if (rq57) break;
      const d57 = G.randomQuestDef(e57.id);
      if (d57 && !d57.abs) { rq57 = e57; rdef57 = d57; }
    }"""

B_OLD = """      const btn57 = vc.querySelector('.q-sec-ready + .q-list [data-action="claim-rand-quest"]');
      check('★ 达标任务浮到顶块，右侧带「领取」按钮',
        !!btn57 && btn57.getAttribute('data-q') === rq57.id && btn57.textContent.indexOf('领取') >= 0);"""

B_NEW = """      /* 按 **rq57 自己的 id** 取按钮 —— 不取"第一个"：
         此处已是发育过的档，别的任务可能本来就达标，它们的按钮会排在它前面，
         "取第一个"会让断言随卡池随机波动（实测同一份代码两次运行一红一绿）。 */
      const btn57 = vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq57.id + '"]');
      const bib57 = btn57 ? btn57.closest('.q-list') : null;
      const inTop57 = !!(bib57 && bib57.previousElementSibling
        && bib57.previousElementSibling.classList.contains('q-sec-ready'));
      check('★ 达标任务浮到顶块，右侧带「领取」按钮',
        !!btn57 && inTop57 && btn57.textContent.indexOf('领取') >= 0);"""


def main():
    t = read(E2E)
    changed = False

    if '首选：非绝对值且尚未达标' in t:
        print('· 夹具已改过（幂等跳过）')
    else:
        new = cut(t, A_OLD, A_NEW, '夹具改为优先未达标')
        if new is None:
            return 1
        t = new
        changed = True

    if 'rq57 自己的 id' in t:
        print('· 按钮定位已改过（幂等跳过）')
    else:
        new = cut(t, B_OLD, B_NEW, '按钮定位改为按 id')
        if new is None:
            return 1
        t = new
        changed = True

    if changed:
        if '\r' in t:
            print('!! 内容含 CR，拒绝写盘')
            return 1
        io.open(E2E, 'w', encoding='utf-8', newline='').write(t)
        back = io.open(E2E, 'rb').read()
        if b'\r' in back:
            print('!! 落盘核验失败（出现 CR）')
            return 1
        print('✓ 已写盘')
    else:
        print('· 无需修改')
    return 0


if __name__ == '__main__':
    sys.exit(main())
