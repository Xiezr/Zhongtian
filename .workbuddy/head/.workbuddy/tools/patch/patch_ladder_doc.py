# -*- coding: utf-8 -*-
"""补丁：更正「数值断层」这条过期结论。

背景：`docs/_史料/全面梳理报告.md` 判过一条「数量级断层」，但那是 **v28 之前**的数字
（官府上限还是 Lv10、外城地块 9 级是 39、农田 Lv10 是 5500）。此后 v24/v28 三轮把上限
抬过：官府 10→12、外城 48、农田 Lv12 7800。**那条结论没人复算过**，一直被当成事实引用。

本补丁做两件事：
  ① `docs/AI工作备忘.md` 追加「十五、数值阶梯（复算）」—— 放完整数据（该文件无字数上限）
  ② `MEMORY.md` 把过期那一行换成**等长或更短**的指针行
     ⚠️ MEMORY.md 有 **9600 字符硬上限**（超出会在会话注入时被截断，尾部规则等于不存在）。
        实测当前 9596，余量只有 4 —— 所以替换必须不增长，脚本里带断言。

行尾：两个文件都是纯 LF，读写一律 newline=''。
用法：python patch_ladder_doc.py
"""
import io, os, sys

MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory\MEMORY.md'
CAP = 9600

ANCHOR = ('- 四套主题：正文对比度 ≥ 7:1、次要文字 ≥ 4.5:1、层级亮度单调递进\n'
          '  （跑 `.workbuddy/tools/audit/audit_colors.js`）。深色主题不用纯黑，层级靠亮度递进不靠阴影。\n')

SECTION = '''
---

## 十五、数值阶梯（复算 · 推翻旧「断层」结论）

> 复算脚本：`.workbuddy/tools/audit/ladder_audit.js`（退出码 0 = 阶梯走得通）
> ⚠️ 这一节替换掉 `docs/_史料/全面梳理报告.md` §4.9 的结论 —— **那条是 v28 之前的数字**。

### 15.1 旧结论为什么过期

| 项 | 旧报告（v28 前） | 实测（现在） |
|---|---|---|
| 官府上限 | Lv10 | **Lv12** |
| 城外地块（满级） | 39 | **48** |
| 农田产量 | 5500/h（Lv10） | **7800/h（Lv12）** |
| 单城粮产（满农田） | 159,500/h | **374,400/h** |

v24 把外城地块 9 级 39→40，v28 把建筑上限 10→12 —— 上限抬过三轮，
**这条结论没人复算**。单城粮产实际涨了 2.35 倍。

### 15.2 实测阶梯

单城（官府满级，混编农田：四种资源各占 1/4）可养**义兵 31,200**。

| 名城档 | 数量 | 守军 | 需几座满级城 |
|---|---|---|---|
| Lv5 | 65 座 | 7,960 | **0.3** |
| Lv7 | 96 座 | 30,240 | **1.0** |
| Lv9 | 12 座 | 114,990 | 3.7 |
| Lv10 洛阳 | 1 座 | 224,220 | 7.2 |

相邻档跨度恒为 **3.8×**（守军按 `1.95^lv` 指数走，档位相隔 2 级 → 1.95² = 3.80）。

### 15.3 判定：卡点是「时间」，不是「无解」

- **野外城池：单城可平推** —— 最高档 Lv10 守军 22,422 < 单城可出 31,200 义兵。
- **名城：靠「平原筑城」扩城跨过 3.8×** —— `GAME.buildCityAt` **没有城池数量上限**，
  每座新城自带自己的官府与野地槽位。打洛阳需 7.2 座满级城 ≪ 地图平原数（约 5 万块）。
- 所以每跨一档要多攒 3.8 倍城数，这是**时间成本，不是墙**。

### 15.4 本轮的判据教训（值得记）

第一版 `ladder_audit.js` 把「相邻档所需城数之比 > 2.6×」判为"跨度过大"并返回 1 ——
**那是假警**：阈值 2.6 是拍的，且**没建模「平原筑城」**（城数不受名城数量限制）。
**教训：数值判据里出现"玩家能不能做到"时，必须先把玩家可用的手段数清**
（这里就是"扩城有没有上限"），否则会拿一个不存在的墙报警。
'''

EDITS = []


def main():
    # ── ① 备忘追加（幂等）──
    memo = io.open(MEMO, encoding='utf-8', newline='').read()
    if '## 十五、数值阶梯（复算' in memo:
        print('·  备忘 §十五 已存在，跳过')
    else:
        if memo.count(ANCHOR) != 1:
            print(f'✗ 备忘锚点出现 {memo.count(ANCHOR)} 次（要求 1 次）—— 未写盘')
            return 1
        memo = memo.replace(ANCHOR, ANCHOR + SECTION, 1)
        io.open(MEMO, 'w', encoding='utf-8', newline='').write(memo)
        back = io.open(MEMO, encoding='utf-8', newline='').read()
        print(f'✅ 备忘 §十五 已追加（{len(back)} 字符，落盘核验{"一致" if back == memo else "不一致"}）')

    # ── ② MEMORY 替换（必须不增长）──
    mem = io.open(MEM, encoding='utf-8', newline='').read()
    old = '- 数值断层：官府 Lv10 满农田仅养义兵约 5.3 万，攻洛阳需约 20 万混编（单城路线封死）。'
    new = '- 数值阶梯：旧「断层」结论已过期，实测可通（详见备忘 §十五）。ladder_audit.js'

    if new in mem:
        print('·  MEMORY 已替换过，跳过')
    else:
        n = mem.count(old)
        if n != 1:
            print(f'✗ MEMORY 锚点出现 {n} 次（要求 1 次）—— 未写盘')
            return 1
        after = mem.replace(old, new, 1)
        delta = len(after) - len(mem)
        print(f'MEMORY 字符数：{len(mem)} → {len(after)}（{delta:+d}）')
        if len(after) > CAP:
            print(f'✗ 超出 {CAP} 上限 —— 未写盘（MEMORY 超限会被会话注入截断，尾部规则等于不存在）')
            return 1
        if delta > 0:
            print('✗ 本替换不该增长（旧行 51 字符）—— 未写盘，请先收紧措辞')
            return 1
        io.open(MEM, 'w', encoding='utf-8', newline='').write(after)
        back = io.open(MEM, encoding='utf-8', newline='').read()
        print(f'✅ MEMORY 已替换（{len(back)}/{CAP} 字符，落盘核验{"一致" if back == after else "不一致"}）')

    # ── 收尾核验 ──
    m = io.open(MEM, encoding='utf-8', newline='').read()
    print(f'\n终检：MEMORY {len(m)}/{CAP} 字符（余量 {CAP-len(m)}）'
          + ('  ✅ 未超限' if len(m) <= CAP else '  ❌ 超限'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
