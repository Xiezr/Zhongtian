"""v91.61 地基第 1 期 —— bundle 构建器（确定性 · 离线可用 · 不依赖 esbuild）。

做法：按 js/main.js 的 import 顺序，把各源文件**剥掉 import 行**后顺序拼接，
产出经典 IIFE 脚本单包 `js/bundle.js`（仍是 window.GAME 全局，行为不变）。
同时写 `js/bundle.hash` = 全部 js 源码（含 core）的 sha256 前 16 位 —— smoke 用它抓"改了源码忘重新构建"。

用法（仓库根）：
    python .workbuddy/tools/patch/build_bundle.py          # 构建 + 写哈希
    python .workbuddy/tools/patch/build_bundle.py --check   # 只校验产物是否陈旧（不写，标红）
"""
import os
import re
import sys
import hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
JS = os.path.join(ROOT, 'js')
BUNDLE = os.path.join(JS, 'bundle.js')
HASHF = os.path.join(JS, 'bundle.hash')

# 与 js/main.js 的 import 列表逐条一致（= 旧 index.html 的 <script> 顺序）。
ORDER = ['core', 'data', 'state', 'systems', 'items', 'generals', 'domain', 'map', 'sphere', 'gltf',
         'map3d', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits',
         'story', 'ui', 'main']

# 允许行尾注释（如 `import './x.js';   /* 说明 */`），否则注释会残留进 bundle。
RE_IMPORT = re.compile(r'^\s*import\s+[\'"].*?[\'"]\s*;?[ \t]*(?:/\*.*?\*/[ \t]*)?$', re.M)


def sources():
    return {m: open(os.path.join(JS, m + '.js'), encoding='utf-8').read() for m in ORDER}


def source_hash(srcs):
    h = hashlib.sha256()
    for m in ORDER:
        h.update(m.encode('utf-8'))
        h.update(b'\0')
        h.update(srcs[m].encode('utf-8'))
    return str(h.hexdigest())[:16]


def build():
    srcs = sources()
    chunks = []
    for m in ORDER:
        body = RE_IMPORT.sub('', srcs[m])
        chunks.append('/* ---- %s.js ---- */\n%s' % (m, body.rstrip() + '\n'))
    out = ('/*! Deepseekdb bundle — 由 .workbuddy/tools/patch/build_bundle.py 生成，请勿手改。\n'
           ' *  源文件：js/*.js（IIFE · window.GAME）· 顺序见 js/main.js 的 import 列表。 */\n'
           + '\n'.join(chunks))
    with open(BUNDLE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    h = source_hash(srcs)
    with open(HASHF, 'w', encoding='utf-8', newline='\n') as f:
        f.write(h + '\n')
    return h, len(out)


def check():
    if not os.path.exists(BUNDLE) or not os.path.exists(HASHF):
        return False, '缺 js/bundle.js 或 js/bundle.hash（未构建）'
    srcs = sources()
    want = source_hash(srcs)
    got = open(HASHF, encoding='utf-8').read().strip()
    if want != got:
        return False, '产物陈旧：源码哈希 %s ≠ bundle.hash %s（改了源码未重新构建）' % (want, got)
    return True, 'bundle 与源码一致（%s）' % want


if __name__ == '__main__':
    if '--check' in sys.argv:
        ok, msg = check()
        print(('✅ ' if ok else '❌ ') + msg)
        raise SystemExit(0 if ok else 1)
    h, n = build()
    print('✅ 构建完成：js/bundle.js（%d 字节）· hash %s' % (n, h))
