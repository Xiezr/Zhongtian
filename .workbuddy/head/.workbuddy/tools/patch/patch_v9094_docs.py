# -*- coding: utf-8 -*-
"""v90.94：活文档同步 —— 发版脚本已从 .workbuddy/tmp/ 迁至 tools/patch/，文档必须跟上。
   AI工作备忘.md：① §100 发布例程行加指针 ② §102 操作指引改路径 ③ 文末新增 §111
   设计规范.md：  §92.3 命令块与例程更新
"""
import io
import os
import shutil

ROOT = r'E:\Deepseekdb'
BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.94-lordbreak')

F1 = os.path.join(ROOT, 'docs', 'AI工作备忘.md')
F2 = os.path.join(ROOT, 'docs', '设计规范.md')


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    tmp = p + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def backup(p):
    b = os.path.join(BK, os.path.basename(p) + '.preDoc')
    if not os.path.exists(b):
        shutil.copy2(p, b)


# ---------------- AI工作备忘.md ----------------
s1 = rd(F1)
n1 = len(s1)

A_OLD = "**发布例程 = 改 js → `node cachebust.js` → smoke + e2e。**\n"
A_NEW = ("**发布例程 = 改 js → `node cachebust.js` → smoke + e2e。**\n"
         "> **v90.94 更新**：脚本已迁至 `.workbuddy/tools/patch/bump_version.py`"
         "（旧 `tmp/cachebust.js` 已废）—— 见 §111。\n")
assert s1.count(A_OLD) == 1, 'A 锚点 %d' % s1.count(A_OLD)
s1 = s1.replace(A_OLD, A_NEW, 1)

B_OLD = "1. **先看是不是缓存**：本地双击 `index.html` 的玩法，改 JS 必须走 `?v=` 缓存击穿（v89.77 已加，一键递增脚本在 `.workbuddy/tmp/cachebust.js`）。"
B_NEW = "1. **先看是不是缓存**：本地双击 `index.html` 的玩法，改 JS 必须走 `?v=` 缓存击穿（v89.77 已加；一键脚本 **v90.94 起在 `.workbuddy/tools/patch/bump_version.py`**）。"
assert s1.count(B_OLD) == 1, 'B 锚点 %d' % s1.count(B_OLD)
s1 = s1.replace(B_OLD, B_NEW, 1)

SEC111 = """

### 111. v90.94 版本三连治理：把「发版」收成一条命令 + 四道守卫（10-13）

**背景**：老板问「三处版本标识是哪三处，为何不同时改就不生效」→ 要求「形成一个更加稳健的解决方案」。

**三处版本标识**（现状盘点）：

| # | 位置 | 性质 | 不同步的后果 |
|---|---|---|---|
| ① | `js/main.js` → `GAME.VERSION` | 自证标识（设置页「运行版本」显示） | 误判 |
| ② | `index.html` → `<!-- BUILD n -->` + 全部 `<script ?v=n>` | **缓存击穿号** | **功能真的不生效** ← 唯一卡死项 |
| ③ | 档案行（项目地图 / 需求档案 / 台账） | 档案 | 溯源失真 |

**为什么只有 ② 卡「生效」**：浏览器按**完整 URL** 缓存 —— `js/ui.js?v=9172` 与 `js/ui.js?v=9173`
是两个不同资源。改了 js 但 `?v=` 没变 → **命中本地缓存，连请求都不发** → 页面跑旧代码
（§99 老板连报三轮「还是不对」的根因）。本项目是本地双击 `index.html` 直开，无 HTTP 头可配 `no-cache`，
只能在 URL 层用 `?v=` 击穿。

**本轮抓到的旧脚本真缺陷**（原 `.workbuddy/tmp/cachebust.js`）：

1. 正则前缀约束 `(?:js|story)/` **漏掉 `vendor/three.min.js`** → 跑完**混版**
   （实测：旧正则 `?v=` 种类 `['9172','9173']`；新正则 `['9173']`）。
2. `writeFileSync` 写在**自检之前** → 不自洽时已落盘、**无回滚**。
3. 躺在 `.workbuddy/tmp/`（临时目录）→ 有被清理、**机制蒸发**之虞。

**处置**：重写并迁至 **`.workbuddy/tools/patch/bump_version.py`** —— 正则泛化（任意 `*.js` · 幂等）·
**先自检后落盘**（脚本数下限 `MIN_TAGS` / 全部同号 / BUILD 标记恰 1 次）· **代管 `GAME.VERSION`** ·
原子落盘（tmp + `os.replace`）· `--check` 干跑。

**四道守卫**（写进 smoke）：

| 守卫 | 内容 |
|---|---|
| §v89.77（已有） | 全部 `<script src>` 带**同一** `?v=` 且与 `<!-- BUILD n -->` 一致 |
| §199④（改口径） | `GAME.VERSION` 在册 + **格式合法** `v\\d+\\.\\d+` + 设置页显示 + 强刷指引 |
| §199⑤（新增） | **发版脚本在岗**（存在 + 自定位仓库根 + 自检未过不落盘 + 无前缀约束 + 代管版本 + 断言带下限） |
| §199⑥（新增） | **版本三处自洽**：`GAME.VERSION` 的值必须已出现在 `需求档案.md` 里 |

**连带**：一组「版本与档案在册」守卫（12 条 check / 14 处正则）里的 `v89\\.\\d+`
按 **§139.5 / §229c⑧ 先例**放宽为 `v\\d+\\.\\d+` —— 这正是需求档案 §v90.87b 段自述的**四步走第 3 步**。

**教训**：

- **「人容易忘」的步骤必须收进机制**（§99 已立）—— 本轮把它从「**有**脚本」推进到「脚本**有守卫、不会蒸发**」。
- **改机制前先跑对照实验**：用同一个两步流程、只换「前缀约束」这一个变量，才敢断言旧脚本漏 vendor。
- **先检后写**：凡「改了可能写坏」的脚本，一律先算后写、自检不过不落盘（同本项目改文件三件套）。
"""

s1 = s1.rstrip('\n') + '\n' + SEC111
assert '### 111. v90.94 版本三连治理' in s1
backup(F1)
wr(F1, s1)
print('[OK] AI工作备忘.md %d -> %d 字符' % (n1, len(s1)))

# ---------------- 设计规范.md ----------------
s2 = rd(F2)
n2 = len(s2)

C_OLD = "。故把 `.workbuddy/tmp/cachebust.js` 改成**自动 +1**："
C_NEW = "。故做成**一条命令**（**v90.94 起脚本迁至 `.workbuddy/tools/patch/bump_version.py`**，旧 `tmp/cachebust.js` 已废）："
assert s2.count(C_OLD) == 1, 'C 锚点 %d' % s2.count(C_OLD)
s2 = s2.replace(C_OLD, C_NEW, 1)

D_OLD = "node .workbuddy/tmp/cachebust.js        # 自动 +1（也可 node cachebust.js 9000 指定）"
D_NEW = ("python .workbuddy/tools/patch/bump_version.py --bump                    # BUILD +1\n"
         "python .workbuddy/tools/patch/bump_version.py --bump --version v90.94   # 同时同步 GAME.VERSION\n"
         "python .workbuddy/tools/patch/bump_version.py --check                   # 干跑（只检不写）")
assert s2.count(D_OLD) == 1, 'D 锚点 %d' % s2.count(D_OLD)
s2 = s2.replace(D_OLD, D_NEW, 1)

E_OLD = "**发布例程 = 改 js → `node cachebust.js` → smoke + e2e。**"
E_NEW = "**发布例程 = 改 js → `python .workbuddy/tools/patch/bump_version.py --bump` → smoke + e2e。**"
assert s2.count(E_OLD) == 1, 'E 锚点 %d' % s2.count(E_OLD)
s2 = s2.replace(E_OLD, E_NEW, 1)

assert 'tmp/cachebust.js' not in s2.replace(C_NEW, '').replace('旧 `tmp/cachebust.js` 已废', ''), '自检：设计规范仍残留旧路径'
backup(F2)
wr(F2, s2)
print('[OK] 设计规范.md %d -> %d 字符' % (n2, len(s2)))
