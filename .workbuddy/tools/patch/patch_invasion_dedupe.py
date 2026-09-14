# -*- coding: utf-8 -*-
"""补丁 7：删掉重复的 `GAME.resName`，并补防回退断言。

背景（门禁抓到的，不是我看出来的）：
我为了修 `DATA.RESOURCES` 是数组这个坑，在 state.js 里新写了一个 `GAME.resName` ——
**但 domain.js 里早就有一个功能完全相同的**（`domain.js:3369`）。
于是 audit 报「重复定义 1」，**pre-commit 门禁直接把提交拦下了**。
讽刺的是我本意正是"避免第二出口"，结果自己违反了「一个概念只允许一个取值口」。

本补丁：
  ① 删掉 state.js 里我加的那一份（保留 domain.js 的原版）
  ② 在 smoke 第 53 节补一条**防回退断言**：`GAME.resName` 全项目必须只有一处定义
     （否则同样的事还会再发生一次）

⚠️ state.js 早于 domain.js 加载，但 `invasionTick` 是**运行时**才调 `GAME.resName`，
   届时 domain.js 已加载完毕，所以删掉 state.js 那份不影响运行。

行尾：两个文件都是纯 LF，newline=''。
用法：python patch_invasion_dedupe.py
"""
import io, os, sys

STATE = r'E:\Deepseekdb\js\state.js'
SMOKE = r'E:\Deepseekdb\smoke-test.js'

DUP = """  /* 资源中文名：`DATA.RESOURCES` 是**数组**不是字典，必须按 key 找 ——
     直接写 `DATA.RESOURCES['grain']` 会拿到 undefined（曾经因此 TypeError）。 */
  GAME.resName = function (key) {
    var a = DATA.RESOURCES || [];
    for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i].name;
    return key;
  };

"""

NOTE = """  /* 资源中文名走 `GAME.resName`（domain.js 里已有，**唯一出口**）。
     ⚠️ 这里不要再写一份 —— 同一个名字的定义只允许一处，
        重复会被 audit 拦下（pre-commit 门禁会直接拒绝提交）。 */

"""

TEST_ANCHOR = "    check('GAME.resName 按 key 取中文名（DATA.RESOURCES 是数组不是字典）',\n"

TEST_ADD = ("    check('GAME.resName 全项目只有一处定义（防第二出口回退）', (function () {\n"
            "      var m = stSrc.match(/GAME\\.resName\\s*=\\s*function/g) || [];\n"
            "      return m.length === 1;\n"
            "    })());\n"
            "    check('GAME.resName 按 key 取中文名（DATA.RESOURCES 是数组不是字典）',\n")


def do(path, edits, label):
    src = io.open(path, encoding='utf-8', newline='').read()
    ok = True
    for desc, old, new in edits:
        if new in src:
            print('  ·  %s（已最新）' % desc)
            continue
        n = src.count(old)
        if n != 1:
            print('  ❌ %s —— 锚点 %d 次（要求 1 次）' % (desc, n))
            ok = False
            continue
        src = src.replace(old, new, 1)
        print('  ✅ %s' % desc)
    if not ok:
        print('  ✗ %s 未写盘' % label)
        return False
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    back = io.open(path, encoding='utf-8', newline='').read()
    print('  %s 已写盘  核验%s  CRLF=%d' % (label, '一致' if back == src else '不一致', back.count('\r\n')))
    return back == src


def main():
    good = True
    print('── js/state.js ──')
    good &= do(STATE, [('删掉重复的 GAME.resName', DUP, NOTE)], 'state.js')
    print('\n── smoke-test.js ──')
    good &= do(SMOKE, [('补防回退断言', TEST_ANCHOR, TEST_ADD)], 'smoke')

    print('\n终检：')
    s = io.open(STATE, encoding='utf-8', newline='').read()
    d = io.open(r'E:\Deepseekdb\js\domain.js', encoding='utf-8', newline='').read()
    print('  state.js 里的 resName 定义数：%d（应为 0）' % len(__import__('re').findall(r'GAME\.resName\s*=\s*function', s)))
    print('  domain.js 里的 resName 定义数：%d（应为 1）' % len(__import__('re').findall(r'GAME\.resName\s*=\s*function', d)))
    return 0 if good else 1


if __name__ == '__main__':
    sys.exit(main())
