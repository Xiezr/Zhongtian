# -*- coding: utf-8 -*-
"""patch_v89235e_archive.py —— 需求档案补录 v89.235（总览行 + 明细段）

用法：python patch_v89235e_archive.py [--apply]
"""
import io, sys
R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
P = R + '需求档案.md'
s = io.open(P, encoding='utf-8', newline='').read()
n0 = len(s)
LOG = []

# ---- Z1 总览行 ----
if '| v89.235 |' in s:
    LOG.append('[skip] 总览行已存在')
else:
    mark = '| v89.234 | 2026-10-07 |'
    i = s.find(mark)
    assert i >= 0, 'v89.234 总览行未找到'
    j = s.find('\n', i) + 1
    new_row = ('| v89.235 | 2026-10-07 | 3 | **政务厅角标修正 · 城外资源建筑 ≤ 政务厅 · 过时素材清理**：'
               '① 政务厅格等级角标并入名称行（v89.229 双段合一漏了政务厅专属渲染块：badge 独立在 label 外 +'
               ' `.tile-badge` 已改 position:static → 角标掉出格顶）② 城外资源建筑等级 ≤ 政务厅等级'
               '（改前域侧天然可超：`upgradeExt` 未传 bid、`buildCapCoreOf` 只认 DATA.BUILDINGS；'
               '现三处同尺：cap 两表并查 + 前置检查 + 界面同读；拒绝时报「需政务厅 LvN」）'
               '③ assets/icons 过时素材清理（raw/1~4.png 老图集源 + atlas_D_src.jpeg 废弃中间格式 · '
               '零引用 · 先备份）· bitmaps.js 生成器注释"汉代风"→"废土风"；'
               '版本 v89.234 → v89.235（老板原文：「1.政务厅等级位置不对 / 2.城外资源建筑等级也不能超过政务厅等级 / '
               '3.E:\\\\Deepseekdb\\\\assets\\\\icons里边已经过时的，不是废土版本的UI清理掉」——逐字） | '
               '已完成（详见 docs/v89235-政务厅角标与素材清理.md） |\n')
    s = s[:j] + new_row + s[j:]
    LOG.append('[ok] 总览行已插')

# ---- Z2 明细段 ----
DETAIL = '''

## v89.235 政务厅角标 · 城外资源建筑 ≤ 政务厅 · 过时素材清理

**老板三条**（逐字）：

> 1.政务厅等级位置不对
> 2.城外资源建筑等级也不能超过政务厅等级
> 3.E:\\Deepseekdb\\assets\\icons里边已经过时的，不是废土版本的UI清理掉

**交付三件**：

| # | 内容 | 状态 |
|---|---|---|
| 1 | **政务厅格等级角标并入名称行** —— v89.229「名称+等级都放格顶、两段合一」时，政务厅是**唯一不走 isoCell 的专属渲染块**（`ui.govPalaceHTML`），漏改：badge 独立成 `<span>` 且 `.tile-badge` 已改 `position:static` → 角标掉出格顶名称行。现与普通格子同构（badge 并入 `.tile-label` 行内） | 已落地 |
| 2 | **城外资源建筑等级 ≤ 政务厅等级** —— 改前域侧天然可超：`upgradeExt` 未传 bid（`buildCapOf(city)` 无 bid 不触发官府闸）、`buildCapCoreOf` 的官府闸只认 `DATA.BUILDINGS`。现三处同尺：① `buildCapCoreOf` 两表并查（含 EXT_BUILDINGS）② `buildPrereqOf` 官府闸两表并查 ③ `upgradeExt` 加前置检查 + `buildCapOf` 传 bid；界面（城外面板升级键/成本/提示）同读同尺，被闸卡住时报「需政务厅 LvN」（"已达最高等级"会误导） | 已落地 |
| 3 | **assets/icons 过时素材清理** —— `raw/1~4.png`（Sep 13 老图集源 · 全仓零引用）+ `raw/atlas_D_src.jpeg`（废弃中间格式 · wasteland_batches 只引用 .png 版）删除；**先备份**到 `.workbuddy/backup/v89235s-icons/`（5 文件）。保留面：atlas_A~D_src.png（现行废土批在用）· `兵种/`（并行贴图批活跃工作集）· `ui/_gold_backup/`（配色管线底座）· `ui/ai_*.png` 99 张（登记 99=99 全对齐）。顺修 `bitmaps.js` 生成器注释（"汉代风"→"废土风（余烬纪元）" + 清单路径 + 生成器自身路径） | 已落地 |

**由需求引出的真 bug（2 处）**：

1. **政务厅角标是"第二宿主漏网"的又一实例**（§79/§80 同族：同一数据的第二渲染宿主）—— v89.229 只改了 isoCell 通用路径；两处渲染的 badge 结构不一致（普通格在 label 内、政务厅在 label 外）。
2. **`upgradeExt` 的 cap 读数先天失真**：`buildCapOf(city)` 无 bid → 城外上限恒为"档位+加成"（12），与政务厅/科技/配对各闸全脱钩——改前实测"政务厅 Lv2 时净化厂可升 Lv3"。

**规则变更连带（smoke 5 红 → 按 §0.7 重写）**：

| 旧断言 | 新口径 |
|---|---|
| 升级净化厂地块（新局直接升） | 造局先抬政务厅到 Lv2（本用例验状态机，闸门本体由 §235③ 专测） |
| giveRes21 / au4 清资源（只给当前城） | **全境口径**（自动升级 v89.167 起全境遍历；"确定可升项"可能落在别的城） |
| 施工中宫殿进度条（busy 到 pbar 距离 ≤600） | 结构判据（对无关注释免疫 —— 本轮加注释即假红） |

**验证**：smoke **3628/0**（含 §235 六条）· 探针改前/改后对照（拒 → 抬政务厅 → 通过 · cap=政务厅等级）· e2e · gate --full。

**诚实缺口**：① `兵种/` 目录（13 张源图）属并行贴图批活跃工作集，未触碰（等贴图批收尾后由该批处理）；② git D 状态的 9 张根目录旧素材（AI生成*/jimeng-*）是并行会话先前所删（物理已不在，待其提交）。
'''
if '## v89.235 政务厅角标' in s:
    LOG.append('[skip] 明细段已存在')
else:
    s = s.rstrip() + DETAIL
    LOG.append('[ok] 明细段已追加')

if APPLY:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('== APPLIED == （%d → %d 字符）' % (n0, len(s)))
else:
    print('== DRY-RUN == （%d → %d 字符）' % (n0, len(s)))
for x in LOG:
    print(' ', x)
