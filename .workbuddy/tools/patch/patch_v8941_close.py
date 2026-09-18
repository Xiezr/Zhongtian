# -*- coding: utf-8 -*-
"""v89.41 会话收尾补丁：
① 需求档案.md —— 首日 4 轮补录（v89.6.1~6.4）+ 自动铺量期缺号段汇总（v89.11~13 / v89.15~27）
   + 本轮条目 v89.41 + 总览表 2 行；
② docs/项目地图.md —— 登记 需求规格 / 经验总结 + 计数 13→15 + 需求档案行更新；
③ 工作记忆 2026-09-19.md —— 第七轮。
所有写入均做「命中==1」断言与落盘回查；行尾按目标文件探测转换。
"""
import io, sys

ROOT = r'E:\Deepseekdb'
ARCH = ROOT + r'\需求档案.md'
MAP = ROOT + r'\docs\项目地图.md'
MEM = r'C:\Users\18811\WorkBuddy\2026-09-17-02-19-29\.workbuddy\memory\2026-09-19.md'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def eol_of(s):
    c = s.count('\r\n'); l = s.count('\n') - c
    return '\r\n' if c > 0 and c >= l else '\n'


def conv(t, eol):
    return t.replace('\n', eol) if eol != '\n' else t


def insert_before_line(path, key, block, tag):
    src = read(path); eol = eol_of(src)
    n = src.count(key)
    if n != 1:
        print('FAIL [%s] 锚点命中 %d 次' % (tag, n)); sys.exit(1)
    i = src.find(key)
    ls = src.rfind('\n', 0, i) + 1
    b = conv(block, eol)
    out = src[:ls] + b + src[ls:]
    write(path, out)
    back = read(path)
    assert key in back and block.split('\n')[0] in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


def insert_after_line(path, key, block, tag):
    src = read(path); eol = eol_of(src)
    n = src.count(key)
    if n != 1:
        print('FAIL [%s] 锚点命中 %d 次' % (tag, n)); sys.exit(1)
    i = src.find(key)
    j = src.find('\n', i)
    if j < 0:
        j = len(src) - 1
    b = conv(block, eol)
    out = src[:j + 1] + b + src[j + 1:]
    write(path, out)
    back = read(path)
    assert key in back and block.split('\n')[0] in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


def append(path, block, tag):
    src = read(path); eol = eol_of(src)
    b = conv(block, eol)
    out = src.rstrip('\r\n \t') + eol + eol + b
    if not out.endswith(eol):
        out += eol
    write(path, out)
    back = read(path)
    assert block.strip().split('\n')[0] in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


# ---------- ① 需求档案：补录块 A（首日 4 轮） ----------
BLOCK_A = r'''### v89.6.1 · 项目审查与 UI 改善提案（2026-09-17 · 补录 2026-09-19）

> **原文**（本会话第一轮）：
> 审查位于 E:\Deepseekdb 的项目，重点评估其游戏性与趣味性。分析现有核心玩法、互动反馈与内容循环中的薄弱环节，提出具体可行的丰富与改善方案，如机制拓展、节奏优化或情感激励等。请输出：1) 当前游戏性/趣味性短板分析；2) 针对性改进建议及预期体验提升；3) 按优先级排列的实施概要。对相应UI同步改善

**落地**（评审交付 · 未改动运行期一行代码）
- `docs/游戏性审查报告.md`：三维度短板 20 条（全部附代码行号证据）+ P0/P1/P2 建议 + 批次实施概要；
- UI 改善提案画布（Ardot 可编辑 · 5 块：里程碑演出 / 战报回放 / 今日军情 / 反馈分层 / 逐步场景），全按项目现用令牌绘制；
- 关键诊断：玩法投资失衡（v87→v89.6 全投野地/江湖支线）· 江湖游历君主专属闸门（`state.js:3227`）·
  反馈层基本为空（全仓 0 音效）· 时间口径三把尺（月俸「7 游戏日」= 10.5 游戏年）· 开局无首胜无引导 ·
  §八 庄园描述已过期（应并入种田秘境而非新建）。

### v89.6.2 · 分开归档 + 逐步场景玩法设计（2026-09-17 · 补录 2026-09-19）

> **原文**：
> 分开归档。检索全网，建立逐步场景玩法，增加玩家自主性，别固定3步走

**落地**
- 归档：审查报告 → `docs/游戏性审查报告.md`（顶层活文档）；UI 提案 → `docs/_参考/UI改善提案/`（README + 6 张图）；
  `docs/项目地图.md` 三处索引登记。
- `docs/逐步场景玩法设计.md`：检索全网四条脉络（Storylet / 质量驱动叙事 · push-your-luck · 动词系统 · 风险双结局）；
  设计「三张表 + 七个出口」——`SCENE_VERBS` 六动词（察/谈/取/隐/息/秘）/ `SCENE_NODES` 故事块池 /
  `SCENE_ENGINE` 深度 2~7；自主性四抓手（推进收手 / 动词走向 / 品质门 / 深度账本）；
  红线「只赌倍率不赌本金」；`sceneFlowOf` 兼容层（老 12 剧本零迁移）。
- 配套交互稿：画布第 ⑤ 区（深度标尺 + 动词行 + 继续/收手 + 深度账本）。
- **状态**：设计已交付；引擎（v90 候选）未实施——待排期。

### v89.6.3 · 文字游戏故事库开工（2026-09-17 · 补录 2026-09-19）

> **原文**：
> 开工
> 增加一个文字游戏，依附于城内外建筑，野地和其他城池。设计500个故事，要求每段故事至少1千字，包含3种以上结局分支。开始设计文本

**落地**（新目录 `story/` · 不碰运行期代码）
- `story/README.md` 规范 · `story/manifest.json` 500 篇台账（pending 队首 = 断点续传接口）·
  `story/vol-01.js` 样板批 5 篇（均 1648 字 · 3 幕 3 结局）· `check.py`（9 条判据）· `gen_manifest.py`（幂等）；
- 锚点分配表：建筑 16×10=160 + 城外 4×10=40 + 野地 6×20=120 + 城池 140（都20/州30/郡40/县50）+ 世事 40 = 500；
- 规模口径已当面说明：500 篇 × ≥1000 字 ≈ 55 万字 → 批次生产 + 可停可续。

### v89.6.4 · 可玩样张接入运行期（2026-09-17 · 补录 2026-09-19）

> **原文**：
> 按照建议进行

**落地**（6 个文件 · 全部走 .py 补丁 + 落盘核验）
- `js/state.js`：`GAME.SG` 引擎（list/one/progress/anchor/begin/nodeOf/endingOf/choose/close/settle 十出口）；
- `js/ui.js`：`ui.SG_BLOCK` 入口块 + 全屏阅读器（`#story-fx`）+ 入口三处（建筑弹窗 / 野地两分支 / 城池面板）；
- `js/main.js` 四动作（story-list / story-open / story-pick / story-exit）· `index.html` 载卷 01 + `.sgr-*` 样式 ·
  smoke §81 六条 · e2e §81 九条（真实 DOM 全链路）；
- 口径：奖赏唯一出口 `STORY.applyReward` · 运行态不入档、进度 `s.stories` 入档 · 无故事锚点不给空壳。

**验证**：audit 全 0 · smoke **2247/0** · e2e **802/0**。

'''
insert_before_line(ARCH, '### v89.7 · 头像可更换', BLOCK_A, '档案补录 A：首日 4 轮（v89.6.1~6.4）')

# ---------- ② 需求档案：汇总块 B（v89.11~13） ----------
BLOCK_B = r'''### v89.11 ~ v89.13 · 自动续批起步期（vol-06~08 · 18 篇）（2026-09-17~18 · 汇总补录 2026-09-19）

> 自动续批（WorkBuddy 定时任务）上线后的前三批产出，无新增用户需求；逐批篇目与数字见
> `story/README.md` §九 与 `docs/AI工作备忘.md` §43 批次日志（含说明：本段起台账改由自动任务维护）。
> 累计 47 篇（29 → 47）。

'''
insert_before_line(ARCH, '### v89.14 · 故事库提速', BLOCK_B, '档案补录 B：v89.11~13 汇总')

# ---------- ③ 需求档案：汇总块 C（v89.15~27） ----------
BLOCK_C = r'''### v89.15 ~ v89.27 · 自动续批铺量期（v89.14 后 · vol-19~34 · 96 篇）（2026-09-18 · 汇总补录 2026-09-19）

> 自动续批持续产出期（含四代理并行提速批次），无新增用户需求。含一次**并发抢写事故**（多路各自算
> 「max 卷号 + 1」抢写同一 vol-31、互覆丢稿；已恢复并处置，教训见 `story/README.md` 待办 12）。
> 逐批篇目见 `story/README.md` §九 / `docs/AI工作备忘.md` §43。v89.27 收口时累计 **203 篇**。

'''
insert_before_line(ARCH, '### v89.28 · 题材线三线落地', BLOCK_C, '档案补录 C：v89.15~27 汇总')

# ---------- ④ 需求档案：本轮条目 v89.41（追加末尾） ----------
BLOCK_D = r'''### v89.41 · 会话收尾：需求规格成文 + 经验总结 + end session（2026-09-19 · 老板「规定需求，总结经验，end session」）

**落地**
- `docs/需求规格.md`：本会话（09-17~09-19）全部需求的**正式化归并**——四线编号（A 评审设计 / B 故事库 /
  C 系统迭代 / D 工程交付）× 20 条，引文一律取自本档案原文；含「需求之外真 bug 清单 8 项」与「遗留与待拍板 6 项」。
- `docs/经验总结.md`：会话工程复盘——可复用工作流四条（补丁七步 / 故事库产线 / 并行子代理纪律 / 会话收尾）
  + 技术教训 15 则（四类 · 逐条「现象→根因→对策」）+ 设计方法论 5 条 + 数字基线。
- **本次同时补录**：本会话首日 4 轮（v89.6.1~6.4）与自动铺量期缺号段（v89.11~13 / v89.15~27）——
  台账口径自此连续；`docs/项目地图.md` 登记两份新档。
- 门禁复跑（收尾时点）：smoke **2305/0** · e2e **946/0** · audit 全 0。

**状态**：✅ 已交付（会话收尾 · 全库 500/500 · git `6068c91` 已推达远端）
'''
append(ARCH, BLOCK_D, '档案追加：v89.41 本轮条目')

# ---------- ⑤ 需求档案：总览表 2 行 ----------
ROWS = r'''| v89.6.1–6.4 | 2026-09-17 | 4 | 项目审查 / 归档+逐步场景 / 故事库立项 / 可玩样张（**补录**） | 已完成 |
| v89.41 | 2026-09-19 | 1 | 会话收尾：需求规格 + 经验总结（end session） | 已完成 |
'''
insert_after_line(ARCH, '| v73 | 2026-09-15 | 5 |', ROWS, '总览表 +2 行（含补录）')

# ---------- ⑥ 项目地图：登记两档 + 计数 + 需求档案行 ----------
MAP_ROWS = r'''│   ├── 需求规格.md            ← 会话需求正式化归并（09-17~19 · 四线 20 条 · 引文取自需求档案）
│   ├── 经验总结.md            ← 会话经验总结（工作流四条 / 技术教训 15 则 / 设计方法论 5 条）
'''
insert_after_line(MAP, '交接文档.md', MAP_ROWS, '项目地图：登记两档')

src = read(MAP)
old = '顶层 13 份'; new = '顶层 15 份'
n = src.count(old)
if n != 1:
    print('FAIL [计数行] 命中 %d 次' % n); sys.exit(1)
src = src.replace(old, new, 1)
write(MAP, src)
assert new in read(MAP)
print('OK  项目地图：计数 13→15')

src = read(MAP)
old = '（v1→v67）'; new = '（v1→v89.41 · 含补录）'
n = src.count(old)
if n != 1:
    print('FAIL [需求档案行] 命中 %d 次' % n); sys.exit(1)
src = src.replace(old, new, 1)
write(MAP, src)
assert new in read(MAP)
print('OK  项目地图：需求档案行更新')

# ---------- ⑦ 工作记忆：第七轮 ----------
MEM_BLOCK = r'''## 第七轮 · 会话收尾（规定需求 + 经验总结 + end session）

- 老板「规定需求，总结经验，end session」——交付 `docs/需求规格.md`（四线 20 条 + 真 bug 8 项 + 遗留 6 项）
  与 `docs/经验总结.md`（工作流四条 / 教训 15 则 / 方法论 5 条 / 基线）。
- **补录需求档案缺口**（收尾时发现）：首日 4 轮（v89.6.1~6.4：审查 / 归档+场景 / 开工 / 样张）+ 自动铺量期
  缺号段（v89.11~13 · vol-06~08 · 18 篇；v89.15~27 · vol-19~34 · 96 篇）——台账口径自此连续；
  另加 v89.41 本轮条目 + 总览表 2 行。
- 项目地图：登记两档 + 计数 13→15 + 需求档案行更新（v1→v89.41 · 含补录）。
- 门禁复跑（收尾）：smoke **2305/0** · e2e **946/0** · audit 全 0；git 本批文档提交后由自动推送钩子承接。
- 会话全线收口：故事库 500/500 · 版本迭代 v89.7~v89.41 · 交付文档 6 份（审查报告 / 场景设计 / 交接 /
  需求规格 / 经验总结 + 角色谱系）。
'''
append(MEM, MEM_BLOCK, '工作记忆：第七轮')

print()
print('ALL OK —— 收尾补丁全部落盘')
