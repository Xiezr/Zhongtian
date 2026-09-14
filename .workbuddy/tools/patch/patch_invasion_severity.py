# -*- coding: utf-8 -*-
"""补丁 5：修 severity 的返回口径。

缺陷（由 smoke 第 53 节那条 ★ 断言抓出来的，不是我看出来的）：
`invasionResolve` 先把 severity 写进返回对象 `out`，**之后**才做
"守住也要折损" 的重算 → `out.severity` 永远是「被破口径」的值（守住时恒为 0），
而真正扣资源/扣兵用的是重算后的正确值。
**后果：返回明细与真实行为口径不一致** —— 面板/日志若读它就会报"零损失"。

修法：把 held / severity 的分支**合并到一处**再构造 out，让返回值与消费值同源。

行尾：state.js 是纯 LF，newline=''。
用法：python patch_invasion_severity.py
"""
import io, os, sys

P = r'E:\Deepseekdb\js\state.js'

OLD = """    var ratio = atk / (atk + def || 1);
    var held = ratio <= 0.5;
    var severity = Math.max(0, (ratio - 0.5) * 2);     // 0..1，只有 ratio>0.5（被破）才有
    var L = I.loss || {};
    var out = { atk: atk, def: def, ratio: ratio, held: held, severity: severity,
      resLost: {}, troopsLost: 0, wallDrop: 0 };

    var R = GAME.res(city);
    if (held) {
      /* 守住了：也折损一点（但不是零代价，否则"堆兵"变成无脑解） */
      severity = ratio * 0.35;
    }
"""

NEW = """    var ratio = atk / (atk + def || 1);
    var held = ratio <= 0.5;
    /* ⚠️ severity 的分支必须**与 out 同源**：先前把 severity 先写进 out、
       再在下面按 held 重算，导致返回明细永远是被破口径（守住时恒 0），
       而实际扣损用的是重算值 —— 返回值和真实行为对不上。
       （这个缺陷是 smoke 第 53 节那条 ★ 断言抓出来的，不是看出来的。） */
    var severity = held
      ? ratio * 0.35                                  // 守住：也折损，但不是零代价（否则"堆兵"成无脑解）
      : Math.max(0, (ratio - 0.5) * 2);               // 被破：ratio 刚过 0.5 时从 0 起
    var L = I.loss || {};
    var out = { atk: atk, def: def, ratio: ratio, held: held, severity: severity,
      resLost: {}, troopsLost: 0, wallDrop: 0 };

    var R = GAME.res(city);
"""


def main():
    if not os.path.exists(P):
        print('✗ 找不到', P)
        return 2
    src = io.open(P, encoding='utf-8', newline='').read()

    if 'severity 的分支必须**与 out 同源**' in src:
        print('·  已修过，跳过')
    else:
        n = src.count(OLD)
        if n != 1:
            print('✗ 锚点出现 %d 次（要求 1 次）—— 未写盘' % n)
            return 1
        after = src.replace(OLD, NEW, 1)
        io.open(P, 'w', encoding='utf-8', newline='').write(after)
        back = io.open(P, encoding='utf-8', newline='').read()
        print('✅ 已修 severity 口径 %d → %d 字符' % (len(src), len(after)))
        print('   落盘核验：%s  CRLF=%d' % ('一致' if back == after else '不一致', back.count('\r\n')))
        if back != after:
            return 1

    fin = io.open(P, encoding='utf-8', newline='').read()
    tail = fin.split('GAME.invasionResolve = function')[1][:1400]
    print('\n终检（invasionResolve 内）：')
    print('  写入 out 之后还改 severity？%s' % ('❌ 还有' if 'out = {' in tail and tail.split('out = {')[1].split('var R = GAME.res')[0].count('severity =') > 0 else '✅ 没有了'))
    print('  held 分支与 out 同源：%s' % ('✅' if 'var severity = held' in tail else '❌'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
