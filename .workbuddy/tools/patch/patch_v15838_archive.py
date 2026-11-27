# -*- coding: utf-8 -*-
"""v158.38 需求档案补录：追加型、幂等、LF（Windows 下必须 newline=''）。"""
import io

NL = chr(10)
PATH = '需求档案.md'
TAG = '## v158.38 · 老板：「统一」'

with io.open(PATH, 'r', encoding='utf-8', newline='') as f:
    s = f.read()

if TAG in s:
    print('SKIP: v158.38 段已存在')
else:
    lines = [
        '',
        TAG,
        '',
        '### 需求（原文）',
        '',
        '> 统一',
        '',
        '背景：此前未探明格一点开就进出征调配面板（将领 / 目标 / 兵力），已探明格则先弹地块详情面板，两套入口并存。',
        '',
        '### 改法（统一到一级详情面板）',
        '',
        '- 所有地块统一行为链：点击 → 一级详情面板 → 点行动按钮 → 统一出征面板。',
        '- 未探明格新增独立出口 `ui.openFogModalCi(ci)`：坐标 + 说明 + 「派队探索」，不泄露地形 / 守军 / 产出；按钮复用 `exp-open` → `doOpenExp` → `openExpModal`。',
        '- 3D：`pickAt` 迷雾分支改走 `M.openCellPanel`；`_openCellPanel` 在 kind 分派前先截未探明格。2D 兜底同口径。',
        '- ⛔ 雾面板不塞进 `openLandModalCi`：那个出口还被造局 / 测试 / 面板内跳转程序化调用（塞进去会让 e2e 19 红）。',
        '',
        '### 断言处置',
        '',
        '- 新增 `§621①~⑤`：3D/2D 新分派、雾面板不泄密、行动仍走唯一出口、openCellPanel 先截雾格；旧直调 `openExpModal` 判为反向守卫零残留。',
        '',
        '### 实测',
        '',
        '- 新探针 `p_fog_panel.js`：6 通过 / 0 失败（真点未探明格 → 先弹一级面板 → 点派队探索才进出征面板；已探明野地按钮齐全）。',
        '- smoke 4653/0 · e2e 1096/0 · audit 六项 0 · 三包重建一致；`p_walk_scan` 10/0。',
        '',
        '### 诚实缺口',
        '',
        '- 2D 兜底路径仅结构断言，未写真点 2D 小地图雾格的探针；3D 已真点验证。',
        '- 未探明一级面板只给「派队探索」一种行动（刻意不泄露情报），不是漏做。',
        '',
    ]
    add = NL.join(lines)
    s2 = s + add
    assert s2.count(NL) >= s.count(NL) + 20, 'append failed'
    with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(s2)
    print('OK: 追加 v158.38 段，行数 %d → %d' % (s.count(NL), s2.count(NL)))
