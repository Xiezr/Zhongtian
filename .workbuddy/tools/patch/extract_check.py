# -*- coding: utf-8 -*-
"""按 check 名字片段抽取 smoke-test.js 里整块 check(...) 源码（括号配平）。
用法：python extract_check.py <片段1> <片段2> ...  → 打印每块（含起止行号）
"""
import io, re, sys

P = r'E:\Deepseekdb\smoke-test.js'
src = io.open(P, encoding='utf-8').read()
lines = src.split('\n')


def find_block(frag):
    """返回 (start_line, end_line, text)  —— 1-based 行号。"""
    i = src.find(frag)
    if i < 0:
        return None
    # 回溯到所在行的 'check(' 或 'var cN = (function'
    ls = src.rfind('\n', 0, i) + 1
    # 向前找最近的 'check(' 出现位置
    j = src.rfind('check(', 0, i)
    if j < 0 or j < src.rfind('\n\n\n', 0, i):
        pass
    # 从 j 开始括号配平（跳过字符串/注释/正则——用简单状态机）
    k = src.index('(', j)
    depth = 0
    n = len(src)
    state = None  # None | "'" | '"' | '`' | '//' | '/*'
    esc = False
    p = k
    while p < n:
        ch = src[p]
        nx = src[p + 1] if p + 1 < n else ''
        if state is None:
            if ch == "'" or ch == '"' or ch == '`':
                state = ch
            elif ch == '/' and nx == '/':
                state = '//'; p += 1
            elif ch == '/' and nx == '*':
                state = '/*'; p += 1
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    break
        elif state in ("'", '"', '`'):
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == state:
                state = None
        elif state == '//':
            if ch == '\n':
                state = None
        elif state == '/*':
            if ch == '*' and nx == '/':
                state = None; p += 1
        p += 1
    end = p
    sl = src.count('\n', 0, j) + 1
    el = src.count('\n', 0, end) + 1
    return sl, el, src[j:end + 1]


def main():
    frags = sys.argv[1:]
    for f in frags:
        r = find_block(f)
        if not r:
            print('===== NOT FOUND: %s =====' % f)
            continue
        sl, el, txt = r
        print('===== %s @L%d-%d (len=%d) =====' % (f, sl, el, len(txt)))
        print(txt)
        print()


main()
