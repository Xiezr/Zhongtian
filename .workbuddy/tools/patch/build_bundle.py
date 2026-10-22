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
BUNDLE = os.path.join(JS, 'bundle.js')       # v104：旧单包（构建时会删掉）
HASHF = os.path.join(JS, 'bundle.hash')

# 与 js/main.js 的 import 列表逐条一致（= 旧 index.html 的 <script> 顺序）。
ORDER = ['core', 'registry', 'data', 'state', 'systems', 'items', 'generals', 'cities', 'ship', 'domain', 'map', 'sphere', 'risk', 'years', 'fog', 'memorial', 'renown', 'village', 'convoy', 'growth', 'camp', 'ruin', 'faction', 'rival', 'land', 'taint', 'climate', 'surge', 'relic', 'goals', 'veteran', 'setskill', 'deck', 'bond', 'tower', 'wonderwar', 'delve', 'unrest', 'expose', 'trooplv', 'idle', 'ending', 'muster', 'founding', 'gltf',
         'map3d', 'battle', 'strategy', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits',
         'story', 'ui', 'main']

# ============================================================
# v104 · 分包（老板 2026-10-23：「拆」）
# ------------------------------------------------------------
# 单包 4245KB / 上限 4301KB —— 只剩 56KB，再加一个模块就撞线。
# 按"什么时候被用到"切成三包，**都仍随首屏顺序加载**（经典 script 保证顺序，
# window.GAME 全局共享），行为零变化：
#
#   bundle-core  引擎与数据（开局就要：data/state/domain/所有玩法模块）
#   bundle-war   战斗、战术、图标与素材表（`gltf/battle/strategy/tactic/icons/...`）
#   bundle-ui    天时数值层、界面、3D 地图、启动入口（必须最后 —— main.js 是入口）
#
# 为什么不懒加载：全项目 200+ 探针按"顺序拼接"求值，动态 import 会改掉求值时机。
# 分包只解决"单文件撞线"，不解决"总量"——总量是另一件事，别混为一谈。
# ============================================================
WAR = ['gltf', 'battle', 'strategy', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits']
UI = ['story', 'ui', 'map3d', 'main']


def groups():
    core = [m for m in ORDER if m not in WAR and m not in UI]
    war = [m for m in ORDER if m in WAR]
    ui = [m for m in ORDER if m in UI]
    return [('bundle-core', core), ('bundle-war', war), ('bundle-ui', ui)]

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
    gs = groups()
    outs = []
    for gi, (name, mods) in enumerate(gs):
        chunks = []
        for m in mods:
            body = RE_IMPORT.sub('', srcs[m])
            chunks.append('/* ---- %s.js ---- */\n%s' % (m, body.rstrip() + '\n'))
        head = ('/*! Deepseekdb %s — 第 %d/%d 包（%d 个模块）\n'
                ' *  由 .workbuddy/tools/patch/build_bundle.py 生成，请勿手改。\n'
                ' *  ⚠️ 三包必须按 core → war → ui 顺序加载（window.GAME 全局共享）。 */\n'
                % (name, gi + 1, len(gs), len(mods)))
        out = head + '\n'.join(chunks)
        path = os.path.join(JS, name + '.js')
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(out)
        outs.append((name, len(out), len(mods)))
    # v104：旧单包必须删掉 —— 留着就是第二份产物，迟早有人改错那一份
    if os.path.exists(BUNDLE):
        os.remove(BUNDLE)
    h = source_hash(srcs)
    with open(HASHF, 'w', encoding='utf-8', newline='\n') as f:
        f.write(h + '\n')
    return h, outs


def check():
    missing = [n for n, _ in groups() if not os.path.exists(os.path.join(JS, n + '.js'))]
    if missing or not os.path.exists(HASHF):
        return False, '缺 %s 或 js/bundle.hash（未构建）' % (', '.join(missing) or '产物')
    srcs = sources()
    want = source_hash(srcs)
    got = open(HASHF, encoding='utf-8').read().strip()
    if want != got:
        return False, '产物陈旧：源码哈希 %s ≠ bundle.hash %s（改了源码未重新构建）' % (want, got)
    return True, '三包与源码一致（%s）' % want


if __name__ == '__main__':
    if '--check' in sys.argv:
        ok, msg = check()
        print(('✅ ' if ok else '❌ ') + msg)
        raise SystemExit(0 if ok else 1)
    h, outs = build()
    for name, n, k in outs:
        print('  · js/%s.js  %8d 字节  %2d 模块' % (name, n, k))
    print('✅ 构建完成：三包合计 %d 字节 · hash %s' % (sum(o[1] for o in outs), h))
