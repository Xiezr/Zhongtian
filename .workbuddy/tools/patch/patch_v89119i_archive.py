# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119i_archive.py — 需求档案补 v89.119 + smoke 档案断言
# ================================================================
import io, os, sys

R = 'E:/Deepseekdb/'
P = R + '需求档案.md'
P2 = R + 'smoke-test.js'

s = io.open(P, encoding='utf-8').read()

# ---------- ① 总览表加一行 ----------
OLD_ROW = "| v89.118 | 2026-09-24 | 4 | 俘虏营文字化与总人口收编 / 象兵撤克制 / 外敌来犯自动化 / 600×30h 试玩评测 | 已完成 |"
NEW_ROW = OLD_ROW + "\n| v89.119 | 2026-09-24 | 1 | 反击记录配对（反击并入引发它的出手机 · 「对方X反击」）+ 顺带修：恒真断言 6 处 / 战报正文页去重与加高 | 已完成 |"
if s.count(OLD_ROW) != 1:
    print('!! 总览行锚点 %d' % s.count(OLD_ROW)); sys.exit(1)
s = s.replace(OLD_ROW, NEW_ROW, 1)

# ---------- ② 明细段（插在 "遗留与待用户确认" 之前） ----------
ANCHOR = "\n---\n\n## 遗留与待用户确认（v89.117 更新）"
if s.count(ANCHOR) != 1:
    print('!! 明细插入锚点 %d' % s.count(ANCHOR)); sys.exit(1)

DETAIL = """
---

## v89.119（2026-09-24 · 1 条）

### 需求原文

> 「反击应该在敌方出手后，而不是己方移动后直接反击，回合记录稍微调整。我方移动，出手，对方反击（如有）；对方移动，出手，我方相应反击（如有）。反击和对方出手记录在同一行」

### 交付

- **反击记录配对**：反击并入「引发它的那次出手」（同一行 / 同段、紧跟其后）——
  三处同口径：实时战斗回合记录（`ui.btRoundLines`）· 战报纪要（`tactic.js` 的回合纪要）·
  回放帧（`battle.replayFramesOf` 的 `evLine`）。
  配对键 = **对面阵营 + 出手者 id**（`a|id` / `d|id`）—— 同名兵种互射不串台（弓手对弓手有实测）；
  找不到宿主的孤立 counter 兜底独立成格，**不静默丢事件**。
- **文案**：用老板原词「（**对方**X反击 歼 N）」—— 反击者必然是被打的那支，无需读者反推阵营。
- **引擎时序未动**：`打我 → 被打者立即还手` 本就是设计（v57 口径），
  本轮改的是**记录的组织**（把反击从"反击者自己的行"挪到"引发它的那次出手"之后）。

### 由需求引出的真 bug

1. **6 处「把函数当布尔传」的恒真断言**（§98 上轮遗留 2 处 + 本轮 4 处）——
   `check(name, cond, extra)` 里 `if (cond)` **不调用函数**，传 `function () { return X; }` 进去
   则函数对象恒 truthy → **断言恒过**；已全部改 IIFE / 求值写法。
   制度性防护：`audit.js` 加**第 ⑦ 节「恒真断言」**扫描（`check` 第二参是函数引用即报，`--strict` 计退出码），
   并做了"造坏 → 报警 1 处 → 还原 → 0 处（md5 一致）"的自检实验。
2. **战报正文页既有溢出**（1000 高视口 / 13 回合 / 7 兵种载荷实测 **219px**）——
   ① 去重：简报里 battle.js 写出的「【兵种损耗】…」文本段与下方结构化表（`rp-tbl`）重复 →
      渲染时剥文本版（唯一出口 `ui.stripBodyDup`，`report.body` 本体不动）；
   ② 回合纪要分页 5 → 3 行/页；
   ③ 该页专属加高 `modal-tall`（`min(920px, calc(100vh - 40px))`，**不动 xxl 本体 1200×850**）；
   顺带清掉 `index.html` 里 **两处一字不差的 `.modal-xxl` 重复定义**。结果：**溢出 0（h=920）**。

### 产物

- `docs/v89119-反击记录与回合时序.md`（含改前/改后探针对照 + 实机判据 + 诚实缺口）
- 探针：`probe_v89119_counter.js`（成因取证）· `probe_v89119_arena2.js`（选靶：打得久 + 有反击）
- 实机图：`shots/v89119-{battle-round-log,report-counter}.png` · 截图 `show/shot_v89119.js`
  · 体检 `asset/check_v89119_shots.js`
- 断言：smoke §100（11 条）· audit 第 ⑦ 节"""
s = s.replace(ANCHOR, DETAIL + ANCHOR, 1)

# ---------- ③ 遗留节加 v89.119 更新 ----------
TAIL_ANCHOR = "  ④ 第二次晋爵卡\"**需要 3 座城池**\"与扩张卡\"未占野地\"叠加 → 30h 里只到公士档；\n     是否需要在爵位面板给出\"下一步该做什么\"的引导链（晋爵条件逐项打勾）？"
if s.count(TAIL_ANCHOR) != 1:
    print('!! 遗留节锚点 %d' % s.count(TAIL_ANCHOR)); sys.exit(1)
s = s.replace(TAIL_ANCHOR, TAIL_ANCHOR + """

### v89.119 更新

- **新增观察（本轮产物）**：
  ① 「对方X反击」文案目前靠"**反击者必是被打的那支**"来消歧（同名兵种互射时读者要推一步）——
     是否要显式阵营前缀（如"敌·长枪兵反击"）？
  ② 战报正文页的「分回合回放」小节（条带 62 + 播放控件 26 + 关键帧 15 ≈ 120px）
     与顶部「🎬 打开沙盘回放」入口**功能重叠**（v89.94 的回放 vs v89.102 的沙盘）——
     是否合并（合并可再省 ~120px，该页高度可回落到 xxl 本体 850）。""", 1)

# 落盘（档案）
tmp = P + '.tmp119i'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('  ✓ 需求档案补 v89.119（%d 行）' % len(s.split('\n')))

# ---------- ④ smoke §100 加"档案在册"断言 ----------
t = io.open(P2, encoding='utf-8').read()
ANCH2 = """        && /反击/.test(lines[0].txt) && /歼 3/.test(lines[0].txt);
    })());
  })();"""
NEW2 = """        && /反击/.test(lines[0].txt) && /歼 3/.test(lines[0].txt);
    })());

    /* ⓪ 需求档案：本轮在册（§26 的规矩 —— 忘了记档案会当场红） */
    check('⓪ 需求档案补录到 v89.119（本轮需求原文在册）', (function () {
      var p = _p99.join(__dirname, '需求档案.md');
      if (!_fs99.existsSync(p)) return false;
      var d = _fs99.readFileSync(p, 'utf8');
      return d.indexOf('v89.119') >= 0
        && d.indexOf('反击和对方出手记录在同一行') >= 0
        && d.indexOf('对方反击') >= 0;
    })());
  })();"""
if t.count(ANCH2) != 1:
    print('!! smoke 锚点 %d' % t.count(ANCH2)); sys.exit(1)
t = t.replace(ANCH2, NEW2, 1)
tmp2 = P2 + '.tmp119i'
io.open(tmp2, 'w', encoding='utf-8', newline='\n').write(t)
os.replace(tmp2, P2)
print('  ✓ smoke §100 加「档案在册」断言')
