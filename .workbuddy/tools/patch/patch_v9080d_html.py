# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 D：index.html（CSS 四族 + BUILD 9147→9158）
用法：python .workbuddy/tools/patch/patch_v9080d_html.py [--apply]
"""
import io, re, sys

P = 'index.html'
MARK = 'v90.80（老板「去除奇遇系统」）：奇遇 · 见闻录样式整族退役'


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def hstrip(x):
    x = re.sub(r'<!--[\s\S]*?-->', '', x)
    x = re.sub(r'/\*[\s\S]*?\*/', '', x)
    return x


def main():
    apply = '--apply' in sys.argv
    s = rd(P)
    if MARK in s:
        print('[skip] 已落盘')
        return 0
    logs = []

    # D1: --wonder / --wonder-rgb 令牌行（3 条主题定义）
    lines = s.split('\n')
    kept = [l for l in lines if not l.strip().startswith('--wonder:')]
    removed = len(lines) - len(kept)
    assert removed == 3, 'D1 removed=%d' % removed
    s = '\n'.join(kept)
    logs.append('[ok] D1 令牌行 ×3')

    # D2: .wnr-* / .sxf-clue / .jnl-* 样式块
    key = ' * v89.6（老板：「探索性和趣味性」）：奇遇 · 见闻录'
    assert s.count(key) == 1, 'D2 key count=%d' % s.count(key)
    i0 = s.index(key)
    i = s.rindex('/* =====', 0, i0)
    j0 = s.index('/* ⛔ v89.218（老板「故事全部去除」）：#story-fx 阅读器样式')
    j = s.rindex('\n', 0, j0) + 1
    seg = s[i:j]
    assert '.wnr-line' in seg and '.jnl-txt' in seg and 'sxf-clue' in seg and '故事全部去除' not in seg
    assert seg.count('\n') < 60, 'D2 seg too big'
    new = '/* ⛔ ' + MARK + ' —— .wnr-* / .sxf-clue / .jnl-* 与 --wonder 令牌一并清除。 */\n'
    s = s[:i] + new + s[j:]
    logs.append('[ok] D2 样式块（%d 字符）' % len(seg))

    # D3: BUILD 9158 → 9159（并行批 v90.79 已占 9158，本批取 9159）
    c = s.count('9158')
    assert c == 19, 'D3 count=%d' % c
    s = s.replace('9158', '9159')
    assert s.count('9158') == 0 and s.count('9159') == 19
    logs.append('[ok] D3 BUILD 9158→9159')

    hs = hstrip(s)
    assert hs.count('--wonder') == 0 and '.wnr-' not in hs and '.jnl-' not in hs and 'sxf-clue' not in hs

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
