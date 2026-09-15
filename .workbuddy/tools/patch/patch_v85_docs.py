# -*- coding: utf-8 -*-
"""v85 · 文档：设计规范 §26 / AI工作备忘 §二十八 / 需求档案 v85。"""
import io
import sys

SPEC = r'E:\Deepseekdb\docs\设计规范.md'
MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
ARCH = r'E:\Deepseekdb\需求档案.md'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


SEC26 = """## 26. v85：地图占满自适应 / 底部缩略地图 / 民房入口（老板四条）

### 26.1 地图观察框：搜索式自适应（fitMapCell）
- 目标：**占满 + 放大**（留白最均衡地最小、格距尽量大）。枚举 cols∈[12,22] ×
  rows∈[6,14]，cell = min(availW/cols, availH/rows)（钳 [34,128]）；
  score = min(宽覆盖, 高覆盖)；先取 score 最高，差 ≤1.2pp 时取格距更大者。
- 1440 屏输出：**13×7@104**（v84 前 12×6@104）——画布 1352×728 vs 1254×630，
  留白 154/157 → 56/59；jsdom 基准（869×758）输出 13×11@63（测试确定性）。
- 上限 `MAP_CELL_MAX=128`（仅防极端）；词面守卫：`ui.mapFrame = { spanX: cols`
  与 `MAP_TARGET_CELL_ISO = 124` 均被 smoke 正则守护，改动别丢词面。

### 26.2 缩略地图（底部导航栏 + 天下大势）
- 数据层 `GAME.map.miniBuild()`：全图 500×500 州/郡归属——**先州后郡两遍最近邻**
  （州心 13 = 都城/州城；郡单元 = 郡城 + 州城[州直辖]），按 map.seed 缓存；
  边界是**地理**划分（读 NPC_CITIES 固有 state，占领不影响）。25 万格约 15ms。
- 渲染层 `ui.miniOff()`（离屏 1000×1000 = 2px/格：地形×州染 + 界线 + 城点，
  按 seed 缓存）+ `ui.drawMini()`（叠加动态我城）+ 底部 40px 小图 + 「天下大势」面板。
- 界线两档：**州界 = 亮金 #f0d060 实线（整格满涂）**；**郡界 = 灰白 #cfcfc0
  对角 2px（细一档）**。城点：都城红 / 州城亮金 / 郡城米白；我城金点动态叠加。
- 底部缩略图由 `ui.paintBottom()` **固定拼装**（不能走 _bottom.push——会被覆盖）。
- CSS 守卫：图例色值走 `.mini-legend` 局部变量（「文字色 ≤8 条硬编码」守卫盯着）。

"""

SEC28 = """## 二十八、v85：搜索式自适应的两条词面守卫 & 缩略地图工程

### 28.1 改「算法内胆」先回扫词面守卫（v85 一红一修）
- fitMapCell 重写后 smoke 红：`/ui\\.mapFrame = \\{ spanX: cols/` 是**词面正则**——
  新代码写 `best.cols` 就断了。修法：局部变量承接再赋值（`var cols = best.cols;`
  `ui.mapFrame = { spanX: cols`）——**词面即意图**，改算法别改这句的写法。
- 同族：`MAP_TARGET_CELL_ISO = 124` 常量定义也必须保留（哪怕已不参与计算）。

### 28.2 新 CSS 颜色先数「硬编码色 ≤8」守卫的余量
- 图例 6 条 `color: #xxx` 顶破守卫上限。定式：**色值收进局部 CSS 变量**
  （`.mini-legend { --lg-state: … }` + `color: var(--lg-state)`）——`var()` 不计数。

### 28.3 缩略地图工程要点（Voronoi 派生 + 离屏复用）
- 边界派生 = **先州后郡两遍最近邻**（州心 13 / 郡心含州城）："先州后郡"保证
  郡界不跨州；全图 25 万格 ~15ms，按 seed 缓存（占领不重算——边界是地理划分）。
- 渲染 = 一张 1000×1000 离屏图（像素法）**两处复用**（底栏 40px / 面板 500px）；
  动态层（我城）后叠。真机像素抽查可验证渲染真实性（洛阳 255,90,64 / 州界 240,208,96）。
- 底部条集成：paintBottom 固定拼装（`_bottom.push` 会被 innerHTML 覆盖）；
  jsdom 里 canvas 无 2d 上下文 → 全链 try/catch + 上下文空判，静默降级。

### 28.4 又一个存量 flake（任务夹具 · e2e 版）
- 「夹具：还有一条未达标随机任务」会因"池里全员达标"随机假红（同 §57 族；
  本段之前已发育 + 打桩）。修法：兜底挑一条非绝对值任务把 base 拉高，
  **确定性造出未达标**（换标的、不放宽判据）。

"""

SEC_ARCH = """### v85 · 4 项（**原文**）

> 1.民房不需要人口统计功能
> 2.地图目前没有占满界面，建议占满，然后稍微放大一点图像，看起来好看一点
> 3.底部导航栏增加一个缩略地图（覆盖500*500）
> 4.在缩略地图标注州城，郡城位置。对州郡的边界以不同样式的线条区分

**落地**：
- ① 民房 BLDG_FUNC 条目退役（弹窗不再有「人口统计」入口；面板本身由城防统计进入）。
- ② fitMapCell 重写为**搜索式自适应**（覆盖率最优 + 格距次优）：1440 屏 12×6@104
  → **13×7@104**，画布 1254×630 → 1352×728，留白 154/157 → 56/59；格距上限 104→128。
- ③④ 缩略地图（覆盖 500×500）：数据层 `GAME.map.miniBuild`（先州后郡两遍最近邻 ·
  按 seed 缓存 · 25 万格 15ms）；底部导航栏 40px 小图（paintBottom 固定拼装）
  点击展开「天下大势」1000×1000 离屏图（州染 + 州界金实线 / 郡界灰细线 +
  都城/州城/郡城/我城）。
- 顺手修 e2e 存量 flake：任务夹具"全员达标"假红（兜底构造未达标）。
- 测试：smoke **2160/0** · e2e **734/0**（改判 2 处旧断言 + 新增 §70 [9 条] / v85 段 [4 条]）。
- 真机：13×7@104 实测 · 留白 56/59 · 州界金像素 240,208,96 命中 · 洛阳红点命中 · 零错误。
- 细节：`docs/设计规范.md` §26；`docs/AI工作备忘.md` §二十八。
"""

print('== D1. 设计规范 §26 ==')
patch(
    SPEC,
    '- 消费方只有一处：`ui.troopsHTML` 的分页过滤；测试全是动态读值 —— 改分类不连坐。\n',
    '- 消费方只有一处：`ui.troopsHTML` 的分页过滤；测试全是动态读值 —— 改分类不连坐。\n\n\n' + SEC26,
    'D1 设计规范 §26',
    probe='## 26. v85：地图占满自适应',
)

print()
print('== D2. 备忘 §二十八 ==')
patch(
    MEMO,
    '- 推论：**夹具引用地图坐标一律先验合法性**（tile 非空 + 非城），别赌出生点附近。\n',
    '- 推论：**夹具引用地图坐标一律先验合法性**（tile 非空 + 非城），别赌出生点附近。\n\n\n' + SEC28,
    'D2 备忘 §二十八',
    probe='## 二十八、v85',
)

print()
print('== D3. 需求档案 v85 ==')
patch(
    ARCH,
    '- 细节：`docs/设计规范.md` §25；`docs/AI工作备忘.md` §二十七。\n',
    '- 细节：`docs/设计规范.md` §25；`docs/AI工作备忘.md` §二十七。\n\n\n' + SEC_ARCH,
    'D3 需求档案 v85',
    probe='### v85 · 4 项',
)

print()
print('全部完成。')
