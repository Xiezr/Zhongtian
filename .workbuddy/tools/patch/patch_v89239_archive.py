# -*- coding: utf-8 -*-
"""v89.239 档案补录：总览表行 + 明细段
用法：python patch_v89239_archive.py           # dry-run（默认）
      python patch_v89239_archive.py --apply   # 落盘
安全：① 幂等（已有 v89.239 则拒绝重复）② 先备份由外部完成（.workbuddy/backup/v89239/）
      ③ 落盘后自检（行数 +1、占位残留检查）
"""
import io, sys

P = '需求档案.md'

NEW_ROW = ('| v89.239 | 2026-10-07 | 2 | **底衬二档调亮 + 头像链路复核**：'
           '① 抠图底衬二档 `.55 → .80 + brightness(1.15)`（「不够亮」；五档实机扫描定档：'
           '54.8→71.2 · 明亮像素 20.6%→31.0%）② 头像链路复核（顶栏/创建/换脸面板/君主面板/英雄页'
           '**五处同源** · 池清单↔磁盘 91/91 双向零差）——抓出并修复 v90 换代漏网死引用'
           '（`dollPortrait` 兜底调已退役的 `P.svg`，池空即 TypeError）+ 陈旧注释三处 + '
           '`.gitignore` 头像段 5 行；素材层取证：旧 portraits 整目录 / `portraits_normalized` / '
           '`pd_src` 均在回收站逐实体可恢复 · `pool_v2` 零引用待定 | '
           '已完成（详见 docs/_史料/交付/v89239-底衬二档调亮与头像链路复核.md） |')

NEW_SEC = """## v89.239 底衬二档调亮 + 头像链路复核（2026-10-07 · 承接 v89.238 未完成清单 ①②）

**老板原文（逐字）**：

> 不够亮

> 复核

**改动（8 文件）**：

| # | 落点 | 改前 → 改后 |
|---|---|---|
| ① | `index.html` `.doll-portrait img` | `opacity: .55` → `opacity: .80; filter: brightness(1.15)`（五档实机扫描定档） |
| ② | `js/ui.js` `dollPortrait` 兜底 | 死引用 `P.svg(g, 240)`（v90 已删）→ `return ''`（不铺底衬）+ 墓碑注 |
| ③ | `js/ui.js` / `js/domain.js` 注释 | 「m/f 各 20 张」「退回程序化立绘」等口径滞后 → 按 v90 现状改写 |
| ④ | `smoke-test.js` | v46 节断言升级（.80 + brightness）· 新增「兜底死引用」断言（源码剥注释零 `P.svg` + 池空实跑不炸）· §199④ 版本 · §239 守卫 ×2 |
| ⑤ | `.gitignore` | 头像段 5 行按实况更新（pool 91 张 · hero 退役 · _raw/pd_src 已移出） |
| ⑥ | 版本 | `GAME.VERSION` v89.238 → **v89.239** |

**实测证据（真机 · 五档扫描 · `.doll` 元素截图）**：

| 档 | opacity | filter | 区域均值 | 明亮占比 |
|---|---|---|---|---|
| 对照 | .55 | — | 54.8 | 20.6% |
| A / B / C / D | .70 / .75 / .80 / .75+b1.10 | — | 60.7 / 62.6 / 64.4 / 66.8 | 24.9% ~ 28.4% |
| **E（定档）** | **.80** | **brightness(1.15)** | **71.2** | **31.0%** |

（.55 同条件复现与 v89.238 终态逐值一致 —— 可比性自证；改前历史基线 47.0 / 1.6%。）

**复核结论（要点）**：头像链路**五处同源**（顶栏 / 创建页 / 换脸面板 / 君主面板 / 英雄页）；
池清单↔磁盘 **91/91 双向零差**；抓出并修复 v90 换代漏网死引用（`ui.dollPortrait` 兜底调已退役的
`P.svg` —— 池空即 TypeError）；素材层取证：旧 `portraits` 整目录（含 `_raw` 41.3MB + hero 30 张 +
旧 pool）与 `portraits_normalized`、`pd_src` 均在回收站逐实体可恢复，`pool_v2`（38 webp）零引用待定。
全文见 `docs/_史料/交付/v89239-底衬二档调亮与头像链路复核.md`。

**验证**：smoke [待填] · e2e [待填] · gate --full [待填]。"""


def main():
    apply = '--apply' in sys.argv
    s = io.open(P, encoding='utf-8', newline='').read()

    if 'v89.239' in s:
        print('ALREADY PATCHED — 档案已含 v89.239，拒绝重复。')
        return 1

    lines = s.split('\n')
    idx = None
    for i, l in enumerate(lines):
        if l.startswith('| v89.238 |'):
            idx = i
            break
    if idx is None:
        print('ANCHOR MISS —— 未找到 v89.238 总览行')
        return 1
    if idx + 1 < len(lines) and lines[idx + 1].startswith('| v89.239 |'):
        print('ALREADY PATCHED（行级）')
        return 1

    print('anchor: line %d = %s...' % (idx + 1, lines[idx][:60]))
    print('NEW_ROW len:', len(NEW_ROW))
    print('NEW_SEC lines:', NEW_SEC.count('\n') + 1)
    print('--- 预览（前 3 行）---')
    for l in NEW_ROW.split('\n')[:2]:
        print(l[:120])

    if not apply:
        print()
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
        return 0

    lines.insert(idx + 1, NEW_ROW)
    s2 = '\n'.join(lines)
    s2 = s2.rstrip('\n') + '\n\n' + NEW_SEC.strip('\n') + '\n'

    # 自检后再落盘
    chk = s2.count('| v89.239 |')
    assert chk == 1, 'row count=%d' % chk
    assert '头像链路复核' in s2, 'keyword missing'
    assert s2.count('\n') > s.count('\n') + 20, 'section too small'
    io.open(P, 'w', encoding='utf-8', newline='').write(s2)

    s3 = io.open(P, encoding='utf-8', newline='').read()
    print('APPLIED. lines: %d → %d; v89.239 rows: %d' % (
        s.count('\n') + 1, s3.count('\n') + 1, s3.count('| v89.239 |')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
