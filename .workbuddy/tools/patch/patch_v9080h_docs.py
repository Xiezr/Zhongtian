# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 H：需求档案.md（总览行 + 明细段）+ 台账（回合节）
用法：python .workbuddy/tools/patch/patch_v9080h_docs.py [--apply]
"""
import io, sys

P1 = '需求档案.md'
P2 = 'docs/需求台账-v9012-13.md'

NEW_ROW = ('| v90.80 | 2026-10-13 | 1 | **奇遇系统退役（v89.6「奇遇 · 见闻录」整系统清除）**：'
           '探索层三件套全清 —— 隐藏点位（wonderSites）/ 双通道现形（线索+就近探察）/ 探奇三段'
           '（Check/Spend/Roll）/ 24 条三档见闻录（面板+图鉴）/ 奇缘星✦悬标 / 底栏「见闻录」入口；'
           '六层落地（引擎 12 出口 · 数据 2 表 · UI 8 处 · 地图悬星 · main 3 动作 · CSS 4 族）+ '
           '断点 3 处（线索挂接 ×3 · scenePick 分流 ×2 · 场景机开场）；smoke §80 十一条 → 零残留守卫七条 · '
           'e2e 19c 十四条退役；「奇遇遗迹」（ENCOUNTERS）与场景机为异系统未动；'
           'BUILD 9158→9159（老板原文：「去除奇遇系统」——逐字；承接「奇迹点是什么」问答） | '
           '已完成（详见 docs/_史料/交付/v9080-奇遇系统退役.md） |')

NEW_SEC = """## v90.80 奇遇系统退役（2026-10-13 · 承接「奇迹点是什么」问答）

> 声明：v89.241 ~ v90.79 各轮由并行批记录于 `docs/需求台账-v9012-13.md`；本档案自 v90.80 起继续随轮补录。

**老板原文（逐字）**：

> 去除奇遇系统

**名称边界**：「奇迹点」= v89.6「奇遇 · 见闻录」在球面批台账里的俗称。项目内另有异系统
**「奇遇遗迹」**（`DATA.ENCOUNTERS` · 巡野/占领的掉落判定 · 「奇遇古冢」图纸来源）——
本次仅退役前者，「奇遇遗迹」与场景机**均未动**。

**改动（六层 · 12 文件）**：

| # | 层 | 落点 | 处置 |
|---|---|---|---|
| ① | 引擎 | `js/state.js` 12 出口整块 + `enterPlanet` 缓存行 | 删除 + 墓碑；线索挂接 3 处改直接返回 |
| ② | 数据 | `js/data.js` `DATA.WONDER` + `DATA.WONDERS`（24 条三档） | 整块删除（13,225 字符） |
| ③ | 场景机 | `GAME.wonderStart` + `scenePick` 两处分流 | 删除（场景机本体保留） |
| ④ | UI | `js/ui.js` 8 处（探奇入口 / doWonder / SXF_KIND / 横幅 / 见闻录面板 2,781 字符 / 线索行 / 底栏入口 / 就近探察 / 音频死键） | 逐段删除 + 墓碑 |
| ⑤ | 地图/动作 | `js/map.js` 悬星 + `js/main.js` 三 case（do-wonder / open-journal / journal-go） | 删除 + 墓碑 |
| ⑥ | 样式 | `index.html` `--wonder` 令牌 ×3 · `.wnr-*` / `.sxf-clue` / `.jnl-*`（2,534 字符） | 整块删除；BUILD 9158→9159 |

**测试与工具口径**：smoke §80 十一条（奇遇册/点位/探察/线索/探奇三段/见闻录/悬星/接线）→
**零残留守卫七条**（含运行期 undefined + 可执行形态双验 + 保留面在岗）· e2e 19c 十四条退役 ·
`audit_v89105_modals`/`audit_v89112_pressure` 去「见闻/日志」用例 · `systemmatrix` ×2 去「奇观」行。

**验证**：audit 全 0 · smoke [待填] · e2e [待填] · gate --full [待填]。"""

NEW_TZ = """## v90.80（老板：去除奇遇系统）

老板原话：「去除奇遇系统」（承接「奇迹点是什么」问答 —— 奇迹点 = v89.6 奇遇 · 见闻录 在球面批台账里的俗称）。
- **整系统退役（六层 · 12 文件）**：引擎 12 出口（state.js · 含线索挂接 3 调用点）· 数据 2 表
  （DATA.WONDER / DATA.WONDERS 24 条）· UI 8 处（探奇入口 / ui.doWonder / SXF_KIND 项 / 奇缘紫横幅 /
  见闻录面板 / 线索行 / 底栏入口 / 就近探察 + 音频死键）· 地图悬星（map.js drawWonderStar + 调用）·
  main 三动作（do-wonder / open-journal / journal-go）· CSS 四族（--wonder / .wnr-* / .sxf-clue / .jnl-*）。
- **保留面（未动）**：场景机（荒野活动共用 sceneBegin/scenePick）·「奇遇遗迹」（ENCOUNTERS · 巡野拾获 ·
  另一系统）· 灵机旗（drawJhPennant）· 材料产地跳转（mat-go）。
- **测试/工具口径**：smoke §80 十一条 → 零残留守卫七条；e2e 19c 十四条退役；
  modals/pressure 审计去「见闻/日志」用例；systemmatrix ×2 去「奇观」行与 /^wonder/ 路由。
- 备份：`.workbuddy/backup/v9080/`（8 主文件 + 4 工具 + 档案，.before）；补丁 a~h 幂等可复跑。
- 验收：audit 全 0 · smoke [待填] · e2e [待填]。BUILD 9158→9159。"""


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def main():
    apply = '--apply' in sys.argv
    logs = []

    # ---- 需求档案 ----
    s = rd(P1)
    if 'v90.80' in s:
        logs.append('[skip] 档案已含 v90.80')
    else:
        lines = s.split('\n')
        idx = None
        for i, l in enumerate(lines):
            if l.startswith('| v89.240 |'):
                idx = i
                break
        assert idx is not None, '档案锚点缺失'
        lines.insert(idx + 1, NEW_ROW)
        s = '\n'.join(lines)
        s = s.rstrip('\n') + '\n\n' + NEW_SEC.strip('\n') + '\n'
        assert s.count('| v90.80 |') == 1 and '去除奇遇系统' in s
        logs.append('[ok] 档案：总览行 + 明细段')
        if apply:
            wr(P1, s)
            s2 = rd(P1)
            assert s2.count('| v90.80 |') == 1

    # ---- 台账 ----
    t = rd(P2)
    if 'v90.80（老板：去除奇遇系统）' in t:
        logs.append('[skip] 台账已含 v90.80')
    else:
        t = t.rstrip('\n') + '\n\n' + NEW_TZ.strip('\n') + '\n'
        assert t.count('## v90.80') == 1
        logs.append('[ok] 台账：回合节')
        if apply:
            wr(P2, t)

    print('\n'.join(logs))
    if not apply:
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
    else:
        print('APPLIED.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
