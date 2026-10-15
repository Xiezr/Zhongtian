# -*- coding: utf-8 -*-
"""补丁 3/3：修 `DATA.RESOURCES` 的取值方式。

缺陷：`DATA.RESOURCES` 是**数组**（`[{key,name,icon,color}, …]`），
但第 2 期的日志代码写成了 `DATA.RESOURCES[rk].name`（rk 是 'grain' 这种**字符串**）
→ 取出 undefined → 再取 .name 就是 TypeError。
它只在"有资源损失"时才触发，而单城局面走不到那段，所以三件套全绿也没发现。

正确做法：按 `key` 在数组里找。加一个局部小函数，不引入新的全局出口。

行尾：state.js 是纯 LF，newline=''。
用法：python patch_invasion_resname.py
"""
import io, os, sys

P = r'E:\Deepseekdb\js\state.js'

OLD = ("        var bits = [];\n"
       "        for (var rk in detail.resLost) bits.push((DATA.RESOURCES[rk] && DATA.RESOURCES[rk].name || rk) + ' −' + U.fmt(detail.resLost[rk]));\n")

NEW = ("        var bits = [];\n"
       "        for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));\n")

# 顺带把 resName 加成正式出口（`DATA.RESOURCES` 是数组，不是字典 —— 别处也要按 key 找）
FUNC_ANCHOR = "  /* 可复现随机：同一个 seed 永远同一个数（否则断言没法稳定，破坏测试也没法翻转） */\n"
FUNC = ("  /* 资源中文名：`DATA.RESOURCES` 是**数组**不是字典，必须按 key 找 ——\n"
        "     直接写 `DATA.RESOURCES['grain']` 会拿到 undefined（曾经因此 TypeError）。 */\n"
        "  GAME.resName = function (key) {\n"
        "    var a = DATA.RESOURCES || [];\n"
        "    for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i].name;\n"
        "    return key;\n"
        "  };\n"
        "\n"
        "  /* 可复现随机：同一个 seed 永远同一个数（否则断言没法稳定，破坏测试也没法翻转） */\n")


def main():
    if not os.path.exists(P):
        print('✗ 找不到', P)
        return 2
    src = io.open(P, encoding='utf-8', newline='').read()
    changed = []

    if 'GAME.resName = function' in src:
        print('·  resName 已存在，跳过')
    else:
        n = src.count(FUNC_ANCHOR)
        if n != 1:
            print('✗ 函数锚点出现 %d 次（要求 1 次）—— 未写盘' % n)
            return 1
        src = src.replace(FUNC_ANCHOR, FUNC, 1)
        changed.append('新增 GAME.resName 出口')

    if 'GAME.resName(rk)' in src:
        print('·  调用点已修，跳过')
    else:
        n = src.count(OLD)
        if n != 1:
            print('✗ 调用点锚点出现 %d 次（要求 1 次）—— 未写盘' % n)
            return 1
        src = src.replace(OLD, NEW, 1)
        changed.append('日志改用 GAME.resName')

    if not changed:
        print('无改动')
        return 0

    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    back = io.open(P, encoding='utf-8', newline='').read()
    for c in changed:
        print('✅', c)
    print('落盘核验：%s  CRLF=%d' % ('一致' if back == src else '不一致', back.count('\r\n')))
    print('残留的旧写法 DATA.RESOURCES[ ：%d 处（应为 0）' % back.count('DATA.RESOURCES['))
    return 0 if back == src else 1


if __name__ == '__main__':
    sys.exit(main())
