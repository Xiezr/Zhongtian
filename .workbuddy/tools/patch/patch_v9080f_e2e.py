# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 F：e2e-test.js（19c 段退役 + OVER_CASES 去项）
用法：python .workbuddy/tools/patch/patch_v9080f_e2e.py [--apply]
"""
import io, sys

P = 'e2e-test.js'
MARK = '原 19c 段（v89.6 奇遇 · 见闻录'


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def main():
    apply = '--apply' in sys.argv
    s = rd(P)
    if MARK in s:
        print('[skip] 已落盘')
        return 0
    logs = []

    # F1: 19c 整段（14 条断言）→ 墓碑 + 保留 19b 的收尾还原
    i0 = s.index('/* v89.6：奇遇 · 见闻录（隐藏点位 → 就近探察 → 探奇 → 图鉴） */')
    i = s.rindex('\n', 0, i0) + 1
    j0 = s.index(r"console.log('\n--- 20. 资质分级")
    j = s.rindex('\n', 0, j0) + 1
    seg = s[i:j]
    assert seg.count('check(') == 14, 'F1 checks=%d' % seg.count('check(')
    assert 'wonderSites' in seg and 'sxf-hero' in seg and '见闻录' in seg and '19c' in seg
    new = ('  /* ⛔ v90.80（老板「去除奇遇系统」）：原 19c 段（v89.6 奇遇 · 见闻录 —— 底栏入口 / 点位 /\n'
           '     现形 / 探奇 / 见闻录 共 14 条断言）整段退役，替换为 smoke §80 的零残留守卫。 */\n'
           '  G.jianghuWildMounted = jhWasA;   /* v89.86：还原剥离状态（原 19c 收尾；19b 起显式挂载了该层） */\n\n')
    s = s[:i] + new + s[j:]
    logs.append('[ok] F1 19c 段（%d 字符）' % len(seg))

    # F2: OVER_CASES 去「见闻/日志」
    oldF2 = "    ['见闻/日志', function () { G.ui.openJournal(1); }],\n"
    c = s.count(oldF2)
    assert c == 1, 'F2 count=%d' % c
    s = s.replace(oldF2, "    /* v90.80：「见闻/日志」随奇遇系统退役（openJournal 已删） */\n")
    logs.append('[ok] F2 OVER_CASES 去项')

    # F3: 「7 档抽样」→「6 档抽样」
    oldF3 = '   * ① 弹窗不溢出闸门（7 档抽样'
    c = s.count(oldF3)
    assert c == 1, 'F3 count=%d' % c
    s = s.replace(oldF3, '   * ① 弹窗不溢出闸门（6 档抽样')
    logs.append('[ok] F3 档数 7→6')

    for f in ['wonderSites', 'wonderState', 'wonderCheck', 'wonderSiteOf', 'ui.openJournal', 'do-wonder', 'journal-go', 'WONDERS']:
        assert f not in s, 'leftover ' + f

    if not apply:
        print('\n'.join(logs))
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
        return 0
    wr(P, s)
    print('\n'.join(logs))
    print('APPLIED. lines=%d' % (rd(P).count('\n') + 1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
