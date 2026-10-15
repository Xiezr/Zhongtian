# -*- coding: utf-8 -*-
"""补丁 6（收尾）：三份文档同步 —— 登记新出口 + 标注第 2 期落地 + 更正第 1 期误判。

① `docs/AI工作备忘.md` §十一 单一出口清单 —— **新增出口必须登记**（项目铁律）
② `docs/玩法扩展规划.md` §四 防守 —— 标为已落地
③ 同文件优先级表 —— 第 1 期（空承诺接线）实测**已基本完成**，不是待办；
   第 2 期（防守）已落地。两处都要改，否则下次又会照旧表去做无用功。

行尾：两份都是纯 LF，newline=''。
用法：python patch_invasion_docs.py
"""
import io, os, sys

MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
PLAN = r'E:\Deepseekdb\docs\玩法扩展规划.md'

EDITS_MEMO = [
    (
        '§十一 登记第 2 期新增出口',
        '| **v67 新增** | `cityRefsOf(cityId)`（**城池伴随数据登记表**）· `abandonCity(cityId)`（放弃城池单出口） |\n',
        '| **v67 新增** | `cityRefsOf(cityId)`（**城池伴随数据登记表**）· `abandonCity(cityId)`（放弃城池单出口） |\n'
        '| **第 2 期新增（定期来袭）** | `invasionTick(gameHours)`（时间轮推进，**在线 tickOff 与离线 simulateBulk 共用**）· '
        '`invasionDueAt(city)` · `invasionIntervalSec()` · `armyPowerOf(city)`（单兵战力复用 `story.troopPower`）· '
        '`defensePowerOf(city)`（**城防的唯一战斗消费点**）· `invasionPowerOf(city,cycle)` · '
        '`invasionResolve(city)` · `invasionRoll(seed)`（可复现随机） |\n',
    ),
]

EDITS_PLAN = [
    (
        '§四 防守 标为已落地',
        '## 五、§四 防守：定期被攻打（新增 · ⚠️ 同时修一个真缺陷）\n',
        '## 五、§四 防守：定期被攻打（✅ **已于 2026-09-14 落地**）\n'
        '\n'
        '> **落地实况**：`DATA.INVASION` 表 + 7 个唯一出口（`invasionTick` / `invasionDueAt` / '
        '`invasionIntervalSec` / `armyPowerOf` / `defensePowerOf` / `invasionPowerOf` / `invasionResolve` / '
        '`invasionRoll`）。\n'
        '> 在线 `tickOnce` 与离线 `simulateBulk` **共用同一个 `invasionTick`**。\n'
        '> 界面：城池属性栏加一条 `.note-warn`（**复用断粮警示的样式，未新增 CSS**），\n'
        '> 显示"还有多久 / 守备力 / 有无烽火台提前预警"。\n'
        '> 护栏：smoke 第 53 节 **18 条**；破坏测试 `tools/break/break_invasion.py` **3/3 变红**、md5 逐字节还原。\n'
        '> ⚠️ 落地过程中被断言抓出的两个真缺陷：① `DATA.RESOURCES` 是**数组**不是字典，'
        '写成 `[key].name` 会 TypeError；② `severity` 先写进返回值再重算，导致**返回明细与真实扣损口径不一致**。\n',
    ),
    (
        '优先级表：第 1 期实测已完成',
        '| **第 1 期** | **§六 空承诺接线** | 只差消费点，成本最低，玩家立刻感到"游戏变实了" |\n'
        '| **第 2 期** | **§五 防守（被攻打）** | ①**顺带修好空转的城墙/箭塔**；②它让 §六 里"烽火台"有真实用途；③直接改变玩法节奏 |\n',
        '| ~~第 1 期~~ | ~~§六 空承诺接线~~ | ✅ **实测后判定已基本完成，无需做**（见下方更正） |\n'
        '| **第 2 期** | **§五 防守（被攻打）** | ✅ **已落地**（2026-09-14）。①修好了空转的城墙/箭塔；②烽火台有了真实用途；③改变玩法节奏 |\n',
    ),
    (
        '§五 空承诺清单 加更正说明',
        '## 六、§五 空承诺清单：最便宜的玩法收益\n',
        '## 六、§五 空承诺清单：最便宜的玩法收益\n'
        '\n'
        '> ⚠️ **2026-09-14 更正规正：本清单已基本作废。**\n'
        '> `docs/_史料/全面梳理报告.md` 是**时点快照**（v28 之前），其中的 ⏳ 待办大多已在 v14~v17 落地。\n'
        '> 实测（逐条查**逻辑模块**里的真实调用点，不看 ui/data 里的提及）：\n'
        '> 科技 **24 项全部有消费点**（20 项有字面调用点 + 4 项走 `techMult` 泛型路径）；\n'
        '> 驿站 ✅ 已接 · 烽火台 ✅ 已接 · 天气 fire/ambush/archerRange/move ✅ 全部被读 ·\n'
        '> 国策 boon/siege/rep_gain/train ✅ 被读 · 羁绊 siege ✅ 被读 · 道具急行军令/交易加速 ✅ 被读。\n'
        '> **仅剩**：联盟楼（需联盟系统，报告自己也这么说）、`goldCap` 零引用（属**文案没同步**，非机制缺陷）。\n'
        '> **教训：`_史料/` 里的结论是快照，不是待办清单 —— 动手前必须复算。**\n',
    ),
]


def patch(path, edits, label):
    if not os.path.exists(path):
        print('✗ 找不到', path)
        return False
    src = io.open(path, encoding='utf-8', newline='').read()
    ok = True
    for desc, old, new in edits:
        if new in src:
            print('  ·  %s（已最新，跳过）' % desc)
            continue
        n = src.count(old)
        if n != 1:
            print('  ❌ %s —— 锚点出现 %d 次（要求 1 次）' % (desc, n))
            ok = False
            continue
        src = src.replace(old, new, 1)
        print('  ✅ %s' % desc)
    if not ok:
        print('  ✗ %s 有锚点未命中，**未写盘**' % label)
        return False
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    back = io.open(path, encoding='utf-8', newline='').read()
    print('  %s 已写盘 %d 字符  核验%s  CRLF=%d' %
          (label, len(back), '一致' if back == src else '不一致', back.count('\r\n')))
    return back == src


def main():
    good = True
    print('── docs/AI工作备忘.md ──')
    good &= patch(MEMO, EDITS_MEMO, '备忘')
    print('\n── docs/玩法扩展规划.md ──')
    good &= patch(PLAN, EDITS_PLAN, '规划')
    return 0 if good else 1


if __name__ == '__main__':
    sys.exit(main())
