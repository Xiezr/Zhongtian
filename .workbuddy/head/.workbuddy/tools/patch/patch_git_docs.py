# -*- coding: utf-8 -*-
"""补丁：把「版本库 + 自动同步」写进 docs/项目地图.md，并订正被我改旧的数字。

为什么要用脚本而不是直接编辑：项目铁律 ——「同一条消息里对同一文件的多次 Edit 会互相覆盖」。
本补丁对同一文件有多处改动，故一律脚本化并留档（本文件本身即变更日志的一部分）。

每条替换都带**锚点断言**（锚点必须恰好出现 1 次）与**幂等判据**（已改过就跳过）。
行尾：本文件是纯 LF，读写一律 newline='' 保住原样。
用法：python patch_git_docs.py
"""
import io, os, sys

P = r'E:\Deepseekdb\docs\项目地图.md'

# (说明, 锚点原文, 替换后)  —— 锚点必须唯一
EDITS = [
    (
        '目录树：根目录补上版本库三件',
        '├── 需求档案.md               老板的原始需求台账（v1→v67）\n├── docs\\                    活文档\n',
        '├── 需求档案.md               老板的原始需求台账（v1→v67）\n'
        '├── .gitattributes           全仓 `-text`：git 不做行尾转换（本仓有 md5 落盘校验）\n'
        '├── .gitignore               只跟踪运行期；约 82MB 原料不进版本库\n'
        '├── .git\\                    版本库（GitHub: Xiezr/Zhongtian · 分支 main · 标签 v67）\n'
        '├── docs\\                    活文档\n',
    ),
    (
        '目录树：tools 由 8 组改 10 组，并订正 break/mem 的个数漂移',
        '    ├── tools\\               开发期工具（**8 个子目录 = 8 个用途**）\n'
        '    │   ├── README_INDEX.md    ← 工具索引（67 个，自动生成）\n'
        '    │   ├── patch\\ 变更日志（12）· break\\ 破坏测试（9）· probe\\ 探针（17）\n'
        '    │   ├── gen\\ 生成器（4）    · asset\\ 素材处理（8）· audit\\ 审计核对（10）\n'
        '    │   └── mem\\ 记忆维护（3）  · show\\ 展示校准（4）\n',
        '    ├── tools\\               开发期工具（**10 个子目录 = 10 个用途**）\n'
        '    │   ├── README_INDEX.md    ← 工具索引（81 个，自动生成）\n'
        '    │   ├── patch\\ 变更日志（12）· break\\ 破坏测试（11）· probe\\ 探针（17）\n'
        '    │   ├── gen\\ 生成器（4）    · asset\\ 素材处理（8）· audit\\ 审计核对（10）\n'
        '    │   ├── mem\\ 记忆维护（10） · show\\ 展示校准（4）\n'
        '    │   └── git\\ 同步与门禁（3）· git\\hooks\\ 钩子本体（2）\n',
    ),
    (
        '产物表：新增「版本库」一行',
        '| **测试** | 三个文件在根目录 | 660KB / 199KB / 15KB | 三件套缺一不可 |\n',
        '| **测试** | 三个文件在根目录 | 660KB / 199KB / 15KB | 三件套缺一不可 |\n'
        '| **版本库** | `.git\\` → GitHub `Xiezr/Zhongtian` | 289 文件 / 42.5MB | 三件套门禁（`tools/git/gate.py`）；'
        '克隆回来逐字节一致（实测 289/289） |\n',
    ),
    (
        '产物表：工具行的组数与个数',
        '| **工具** | `.workbuddy/tools/`（8 组） | 67 个 / ~430KB |',
        '| **工具** | `.workbuddy/tools/`（10 组） | 81 个 / ~496KB |',
    ),
    (
        '整改表：tools 行补成 10 组',
        '| **tools** | 67 个平铺、无索引 | 8 个子目录（**目录即分组**）',
        '| **tools** | 67 个平铺、无索引 | 10 个子目录（**目录即分组**）',
    ),
    (
        '一页速查：补收尾同步命令（插在「生成器」与「动手前先问三句」之间，同在代码块内）',
        '  python .workbuddy/tools/gen/gen_tools_index.py   # 重生成工具索引\n'
        '\n'
        '动手前先问三句：\n',
        '  python .workbuddy/tools/gen/gen_tools_index.py   # 重生成工具索引\n'
        '\n'
        '同步到 GitHub（**收尾唯一入口**，默认干跑；门禁不过就不提交）：\n'
        '  python .workbuddy/tools/git/sync.py                      # 干跑：先看将提交什么\n'
        '  python .workbuddy/tools/git/sync.py --apply              # 真做：门禁 → 提交 → 推送\n'
        '  python .workbuddy/tools/git/sync.py --apply --tag v68    # 顺带打版本标签\n'
        '  python .workbuddy/tools/git/sync.py --push-only          # 不提交，只推已有提交\n'
        '\n'
        '两个钩子（安装：python .workbuddy/tools/git/install_hooks.py）：\n'
        '  pre-commit   提交前跑门禁（改 js/ 或 index.html 才跑全量三件套，约 47 秒；否则只跑 audit）\n'
        '               跳过一次：SKIP_GATE=1 git commit …   强制全量：GATE_FULL=1 git commit …\n'
        '  post-commit  提交后自动推送（后台、绝不阻断 commit；日志 .workbuddy/tmp/autopush.log）\n'
        '               关闭：GIT_NO_AUTOPUSH=1\n'
        '\n'
        '动手前先问三句：\n',
    ),
]


def main():
    if not os.path.exists(P):
        print('✗ 找不到', P)
        return 2
    src = io.open(P, encoding='utf-8', newline='').read()
    orig = src

    applied, skipped, failed = [], [], []
    for desc, old, new in EDITS:
        if new in src:
            skipped.append(desc)
            continue
        n = src.count(old)
        if n != 1:
            failed.append((desc, f'锚点出现 {n} 次（要求恰好 1 次）'))
            continue
        src = src.replace(old, new, 1)
        applied.append(desc)

    print(f'补丁目标：{P}')
    print(f'原文件 {len(orig)} 字符\n')

    for d in applied:
        print(f'  ✅ {d}')
    for d in skipped:
        print(f'  ·  {d}（已是最新，跳过）')
    for d, why in failed:
        print(f'  ❌ {d} —— {why}')

    if failed:
        print('\n✗ 有锚点未命中，**未写盘**（避免半截状态）。')
        return 1

    if not applied:
        print('\n无改动，未写盘。')
        return 0

    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    print(f'\n已写盘：{len(orig)} → {len(src)} 字符（{len(src)-len(orig):+d}）')

    # 落盘核验：重读比对，别信写入返回值
    back = io.open(P, encoding='utf-8', newline='').read()
    ok = (back == src)
    print(f'落盘核验：{"✅ 重读内容一致" if ok else "❌ 重读不一致"}')
    crlf = back.count('\r\n')
    print(f'行尾：CRLF {crlf} 个 / LF {back.count(chr(10))-crlf} 个（原为纯 LF）')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
