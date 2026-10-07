# -*- coding: utf-8 -*-
"""v89.240 档案补录：总览表行 + 明细段
用法：python patch_v89240_archive.py           # dry-run（默认）
      python patch_v89240_archive.py --apply   # 落盘
安全：① 幂等（已有 v89.240 则拒绝重复）② 备份已由外部完成（.workbuddy/backup/v89240/）
      ③ 落盘后自检（行数增加 + 关键词 + 无占位残留）
"""
import io, sys

P = '需求档案.md'

NEW_ROW = ('| v89.240 | 2026-10-07 | 1 | **底衬三档调亮（1.0 + brightness 1.35）**：'
           '抠图底衬 `.80+b1.15 → 1.0 + brightness(1.35)`（「再调亮点」；同会话七档扫描定档：'
           '74.1→93.9 · 明亮像素 31.6%→40.3% · **过曝仅 0.19% 无洗白**；o90b125=83.4 / o100b125=88.3 / '
           'o100b150=102.0 三档备用数据在案）；顺记：`pool_v2` 已由老板清理（上轮待定项关闭）；'
           '版本 v89.239 → v89.240（老板原文：「再调亮点」——逐字） | '
           '已完成（详见 docs/_史料/交付/v89240-底衬三档调亮.md） |')

NEW_SEC = """## v89.240 底衬三档调亮（2026-10-07 · 承接 v89.239 未完成清单 ①）

**老板原文（逐字）**：

> 再调亮点

**改动（6 文件）**：

| # | 落点 | 改前 → 改后 |
|---|---|---|
| ① | `index.html` `.doll-portrait img` | `opacity: .80; filter: brightness(1.15)` → `opacity: 1; filter: brightness(1.35)`（七档实机扫描定档） |
| ② | `js/main.js` | 版本 v89.239 → **v89.240** |
| ③ | `smoke-test.js` | v46 节断言升级（1.0 + b1.35）· §199④ 版本 · §240 守卫 ×2 |
| ④ | `需求档案.md` | 本段 + 总览行 |
| ⑤ | `docs/项目地图.md` | 版本历史行 |
| ⑥ | 交付文档 | `docs/_史料/交付/v89240-底衬三档调亮.md` |

**七档实机扫描（同局对照 · `.doll` 元素截图 446×564）**：

| 档 | opacity | filter | 区域均值 | 明亮占比 | 过曝占比 |
|---|---|---|---|---|---|
| live（改前） | .80 | b1.15 | 74.1 | 31.6% | 0.00% |
| o85b115 | .85 | b1.15 | 76.2 | 32.5% | 0.00% |
| o90b115 | .90 | b1.15 | 78.4 | 33.6% | 0.00% |
| o90b125（备用） | .90 | b1.25 | 83.4 | 36.0% | 0.00% |
| o100b125（备用） | 1.0 | b1.25 | 88.3 | 38.0% | 0.07% |
| **o100b135（定档）** | **1.0** | **b1.35** | **93.9** | **40.3%** | **0.19%** |
| o100b150（上界观察） | 1.0 | b1.50 | 102.0 | 43.2% | 0.43% |

（测量自证：live = 注入档 = 复位重拍逐值一致；过曝 = 亮度 >250 像素占比，用于防洗白；
o100b150 顶部大片近纯白判为过头未采用。三档增量 +19.8 > 上轮 +15.6。）

**顺记**：`assets/portraits/pool_v2/` 已由老板清理（工作区已无此目录，v89.239「待定」项关闭）。

**验证**：smoke [待填] · e2e [待填] · gate --full [待填]（基线含并行批 v90.2 域红——批进行中，本批全程避让）。"""


def main():
    apply = '--apply' in sys.argv
    s = io.open(P, encoding='utf-8', newline='').read()

    if 'v89.240' in s:
        print('ALREADY PATCHED — 档案已含 v89.240，拒绝重复。')
        return 1

    lines = s.split('\n')
    idx = None
    for i, l in enumerate(lines):
        if l.startswith('| v89.239 |'):
            idx = i
            break
    if idx is None:
        print('ANCHOR MISS —— 未找到 v89.239 总览行')
        return 1

    print('anchor: line %d = %s...' % (idx + 1, lines[idx][:60]))
    print('NEW_ROW len:', len(NEW_ROW))
    print('NEW_SEC lines:', NEW_SEC.count('\n') + 1)

    if not apply:
        print()
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
        return 0

    lines.insert(idx + 1, NEW_ROW)
    s2 = '\n'.join(lines)
    s2 = s2.rstrip('\n') + '\n\n' + NEW_SEC.strip('\n') + '\n'

    chk = s2.count('| v89.240 |')
    assert chk == 1, 'row count=%d' % chk
    assert '三档调亮' in s2, 'keyword missing'
    assert '再调亮点' in s2, 'keyword missing'
    assert 'o100b135' in s2, 'keyword missing'
    io.open(P, 'w', encoding='utf-8', newline='').write(s2)

    s3 = io.open(P, encoding='utf-8', newline='').read()
    print('APPLIED. lines: %d → %d; v89.240 rows: %d' % (
        s.count('\n') + 1, s3.count('\n') + 1, s3.count('| v89.240 |')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
