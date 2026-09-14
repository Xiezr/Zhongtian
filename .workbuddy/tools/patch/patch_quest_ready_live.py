# -*- coding: utf-8 -*-
"""v69 补缺：让「达标即置顶」是**真·自动**。

现状：主循环（1s）只重绘 城池/城外（建造队列完成时）+ 侧栏徽标，
      **任务面板不在重绘名单里** —— 玩家正开着任务面板时，某任务达标不会浮上去，
      要切视图才刷新；而导航徽标（可领取数）是每秒实时刷的 → 两处口径不一致。

补法（照 v53 `_lastBuildCount` 的现成模式）：可领取数一变、正看任务面板就重绘。

同时追加：
  ③ smoke 第 57 节 +1 条源码守卫（主循环确实挂了这条钩子）
  ④ e2e +1 组「真·自动」验证（改达标后**不碰视图**，等主循环自己浮上去）

用法：python patch_quest_ready_live.py     （幂等）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
MAIN = J('js', 'main.js')
SMOKE = J('smoke-test.js')
E2E = J('e2e-test.js')


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


# ---- ① main.js 主循环挂钩 ----
LOOP_OLD = """          if (ui.view === 'city' || ui.view === 'ext') ui.renderView(ui.view);
        }
        ui.renderLog();"""

LOOP_NEW = """          if (ui.view === 'city' || ui.view === 'ext') ui.renderView(ui.view);
        }
        /* v69（老板「已完成的任务自动浮动到最上方」）：可领取数量一变，
           正开着任务面板就立即重绘 —— 让"达标即置顶"是真·自动，
           口径与导航徽标（syncBadges 每秒读同一汇总）保持一致。 */
        var qr = GAME.questSummary().ready;
        if (GAME._lastQuestReady !== qr) {
          GAME._lastQuestReady = qr;
          if (ui.view === 'tasks') ui.renderView('tasks');
        }
        ui.renderLog();"""

BOOT_OLD = "    GAME._lastBuildCount = 0;"
BOOT_NEW = "    GAME._lastBuildCount = 0;\n    GAME._lastQuestReady = 0;   /* v69：可领取数变化时重绘任务面板的基准值 */"

# ---- ② smoke 第 57 节 +1 守卫 ----
SM_OLD = """      check('帮助文案同步（置顶 + 直接领取入说明）',
        /已完成的任务自动置顶/.test(u57) && /同时在手上限/.test(u57));"""

SM_NEW = """      check('帮助文案同步（置顶 + 直接领取入说明）',
        /已完成的任务自动置顶/.test(u57) && /同时在手上限/.test(u57));

      check('主循环挂了「可领取数变化→重绘任务面板」的钩子（真·自动）',
        /GAME\\._lastQuestReady/.test(m57) && /ui\\.view === 'tasks'/.test(m57)
        && /GAME\\._lastQuestReady = 0;/.test(m57));"""

# ---- ③ e2e +1 组实时验证（插在 ⑥.5 之后）----
E2E_OLD = """  /* ⑦ 消息流（v16：已整合进公文，且写入存档） */"""

E2E_NEW = """  /* ⑥.6 「达标即置顶」是真·自动：改达标后**不碰视图**，等主循环自己浮上去 */
  {
    let rq58 = null;
    for (const e58 of G.state.quests.pool) {
      const d58 = G.randomQuestDef(e58.id);
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; break; }
    }
    check('夹具：还有一条未达标的随机任务（供实时置顶验证）', !!rq58);
    if (rq58) {
      G.ui.setView('tasks');
      await sleep(80);
      const had58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      await sleep(1500);                   /* 等主循环（1s 间隔）自己发现 */
      const now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);
    }
  }

  /* ⑦ 消息流（v16：已整合进公文，且写入存档） */"""


def main():
    fails = []

    # ① main.js
    m = read(MAIN)
    if '_lastQuestReady' in m:
        print('· main.js：已改过（幂等跳过）')
    else:
        m2 = cut(m, LOOP_OLD, LOOP_NEW, '① 主循环挂钩')
        if m2 is None:
            return 1
        m2b = cut(m2, BOOT_OLD, BOOT_NEW, '② boot 初始化基准值')
        if m2b is None:
            return 1
        if not save_lf(MAIN, m2b, 'main.js'):
            fails.append('main')

    # ② smoke
    s = read(SMOKE)
    if '真·自动' in s:
        print('· smoke：已改过（幂等跳过）')
    else:
        s2 = cut(s, SM_OLD, SM_NEW, '③ smoke +1 守卫')
        if s2 is None:
            return 1
        if not save_lf(SMOKE, s2, 'smoke'):
            fails.append('smoke')

    # ③ e2e
    e = read(E2E)
    if 'q56.6' in e or '⑥.6' in e:
        print('· e2e：已改过（幂等跳过）')
    else:
        e2 = cut(e, E2E_OLD, E2E_NEW, '④ e2e +1 组实时验证')
        if e2 is None:
            return 1
        if not save_lf(E2E, e2, 'e2e'):
            fails.append('e2e')

    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
