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

# ============================================================
# v156.28：模块顺序 / 分包**不再写在这个脚本里** —— 从 js/modules.json 的 layout 读。
# ------------------------------------------------------------
# 以前"这个项目有哪些模块"在仓库里有 8 份副本（构建 / audit / smoke ×2 /
#   审计子脚本 ×6），加一个模块要改 8 处，漏一处就假红或假绿
#   （ui.js 拆分那次，smoke 一度掉到 3754 通过 / 658 失败）。
# 现在：**layout 是唯一手改处**，改 js/modules.json 的 layout.order 即可，
#   索引生成器与构建器共用同一份，不会再各自漂移。
# 加模块 = 新建 js/x.js + 在 layout.order 里插一行（其余自动跟上）。
# ============================================================
LAYOUTF = os.path.join(JS, 'modules.json')
# ui 分包的"两端固定成员"：story/ui 是 UI 层开头，duel3d..main 是结尾（main 是入口，必须最后）
_UI_EDGE = ('story', 'ui', 'duel3d', 'map3d', 'scene3d', 'main')


def _load_layout():
    import json
    if not os.path.exists(LAYOUTF):
        sys.exit('\u2717 js/modules.json \u4e0d\u5b58\u5728\u3002\u5148\u8dd1\uff1a'
                 'node .workbuddy/tools/map/gen_index.js')
    with open(LAYOUTF, encoding='utf-8') as f:
        d = json.load(f)
    lay = d.get('layout') or {}
    order = lay.get('order') or d.get('order') or []
    war = lay.get('war') or []
    ui_split = lay.get('uiSplit') or []
    if not order:
        sys.exit('\u2717 js/modules.json \u91cc\u6ca1\u6709 layout.order')
    ui = [n for n in order if n in _UI_EDGE or n in ui_split]
    return order, war, ui_split, ui


ORDER, WAR, UI_SPLIT, UI = _load_layout()

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


def groups():
    core = [m for m in ORDER if m not in WAR and m not in UI]
    war = [m for m in ORDER if m in WAR]
    ui = [m for m in ORDER if m in UI]
    return [('bundle-core', core), ('bundle-war', war), ('bundle-ui', ui)]

# 允许行尾注释（如 `import './x.js';   /* 说明 */`），否则注释会残留进 bundle。
RE_IMPORT = re.compile(r'^\s*import\s+[\'"].*?[\'"]\s*;?[ \t]*(?:/\*.*?\*/[ \t]*)?$', re.M)


def _norm(src):
    """v143.4：换行归一（CRLF/CR → LF）后再进 hash。

    为什么必须归一再 hash：本机 python 读文本默认 universal newlines
    （CRLF→LF），而 node 的 fs.readFileSync(p,'utf8') **原样保留 CRLF**。
    谁用文本模式重存过一次 js 文件（编辑器存盘 / python 脚本改写），
    文件就变 CRLF —— python 算出的 hash 不变、node 算出的变，
    smoke 的 v91.61 陈旧守卫当场假红，而两边"内容一模一样"，
    这种红能查一整天（2026-10-25 变异测试实测踩到）。
    归一之后：hash 只认内容，不认行尾风格。"""
    return src.replace('\r\n', '\n').replace('\r', '\n')


def sources():
    return {m: _norm(open(os.path.join(JS, m + '.js'), encoding='utf-8').read()) for m in ORDER}


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
        # v150.1：**产物指纹** —— 只记源码 hash 挡不住"bundle 漏提交/被回退"：
        #   源码一旦提交，hash 照样对得上，而页面跑的却是旧包
        #   （v150 就这样漏掉了 js/bundle-war.js：7 个新函数没进产物，守卫却报"一致"）。
        for _bn, _bz, _bk in outs:
            with open(os.path.join(JS, _bn + '.js'), 'rb') as _bf:
                f.write('bundle:%s:%s\n' % (_bn, hashlib.sha256(_bf.read()).hexdigest()[:16]))
    return h, outs


def check():
    missing = [n for n, _ in groups() if not os.path.exists(os.path.join(JS, n + '.js'))]
    if missing or not os.path.exists(HASHF):
        return False, '缺 %s 或 js/bundle.hash（未构建）' % (', '.join(missing) or '产物')
    srcs = sources()
    want = source_hash(srcs)
    _lines = [x.strip() for x in open(HASHF, encoding='utf-8').read().splitlines() if x.strip()]
    got = _lines[0] if _lines else ''
    if want != got:
        return False, '产物陈旧：源码哈希 %s ≠ bundle.hash %s（改了源码未重新构建）' % (want, got)
    # v150.1：产物指纹 —— 磁盘上的包必须与构建时算出的那几包一致
    _fp = {}
    for _ln in _lines[1:]:
        _pt = _ln.split(':')
        if len(_pt) == 3 and _pt[0] == 'bundle':
            _fp[_pt[1]] = _pt[2]
    for _gp in groups():
        _name, _mods = _gp[0], _gp[1]
        _path = os.path.join(JS, _name + '.js')
        if not os.path.exists(_path):
            continue
        _real = hashlib.sha256(open(_path, 'rb').read()).hexdigest()[:16]
        if _fp.get(_name) and _fp[_name] != _real:
            return False, ('产物被改过/回退：js/%s.js 指纹 %s ≠ 构建时 %s'
                           '（多半是漏提交或有人手改产物）' % (_name, _real, _fp[_name]))
    return True, '三包与源码一致（%s）' % want


if __name__ == '__main__':
    if '--check' in sys.argv:
        ok, msg = check()
        print(('✅ ' if ok else '❌ ') + msg)
        raise SystemExit(0 if ok else 1)
    h, outs = build()

    # ============================================================
    # v156.27：额外产出 \`js/ui-all.js\` —— **只给审计/测试读的"全量视图"**
    # ------------------------------------------------------------
    # ui.js 已按功能域拆成 19 个文件。审计脚本与大量断言原来的做法是
    #   "读 js/ui.js 找特征串"，拆分后只会读到 30 行骨架。
    # 这里把 19 个文件按拆分前顺序拼成一份，供它们读 —— 内容与拆分前等价。
    # ⛔ 它**不进任何 bundle**（ORDER 里没有它），只是给静态分析用的镜像。
    # ============================================================
    _ui_names = ['ui'] + UI_SPLIT
    _parts = []
    for _n in _ui_names:
        _p = os.path.join(JS, _n + '.js')
        if os.path.exists(_p):
            _parts.append(open(_p, encoding='utf-8').read())
    _mirror = os.path.join(JS, 'ui-all.js')
    with open(_mirror, 'w', encoding='utf-8', newline='\n') as _f:
        _f.write('/* 构建产物（build_bundle.py 生成）：19 个 ui-*.js 的拼接镜像，'
                 '仅供审计/测试读源码使用。不要手改，也不要 require 它。 */\n')
        _f.write('\n'.join(_parts))

    for name, n, k in outs:
        print('  · js/%s.js  %8d 字节  %2d 模块' % (name, n, k))
    print('  · js/ui-all.js  %8d 字节  %2d 个 ui 文件（审计镜像，不进 bundle）'
          % (os.path.getsize(_mirror), len(_parts)))
    print('✅ 构建完成：三包合计 %d 字节 · hash %s' % (sum(o[1] for o in outs), h))
