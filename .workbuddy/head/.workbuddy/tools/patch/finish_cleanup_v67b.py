# -*- coding: utf-8 -*-
"""v67 清理收尾（第二次执行 —— 上一轮在「合并旧文档」处被中断）。

只做四件事，全部带锚点断言（找不到就报错退出，不静默）：
  ① 路径转接：文档/技能里的 `.workbuddy/tmp/<可复用工具>` → `.workbuddy/tools/<同名>`
  ② 悬空引用订正：被点名但已随过程产物清理的脚本（read_ref_*.py / shot30*.js / v66 截图）
  ③ 四份文档里「遗留脚本待清理」→「已清理（v67）」
  ④ 删除已合并的 9 份 v57~v65 改动说明（内容已逐行核对在 `docs/历轮改动说明.md` 中）

安全：④ 之前对 9 份原件做 **逐行包含性复核**，不通过则不删。
"""
import io, os, re, glob

ROOT = r'E:\Deepseekdb'
TOOLS = set(os.listdir(os.path.join(ROOT, '.workbuddy', 'tools')))
SKILL = r'C:\Users\18811\.workbuddy\skills'
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
REPORT = []
FAIL = []


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def patch(rel, old, new, must=1):
    """按锚点替换，锚点数不符即报错（本机 shell 输出不可靠，一律 python 内断言）"""
    p = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
    t = rd(p)
    n = t.count(old)
    if n != must:
        FAIL.append('%s ← 锚点 %d 次（应为 %d）：%s' % (rel, n, must, old[:56]))
        return False
    wr(p, t.replace(old, new))
    return True


# ---------- ① 路径转接 ----------
TARGETS = []
for pat in ['docs/*.md', 'docs/*.html', '*.md']:
    TARGETS += glob.glob(os.path.join(ROOT, pat))
TARGETS += glob.glob(os.path.join(SKILL, '**', '*.md'), recursive=True)
TARGETS = [t for t in TARGETS if '资产清理记录_v67' not in t and '历轮改动说明' not in t]
n1, files1 = 0, []
for fp in TARGETS:
    t = rd(fp)
    o = t
    for name in sorted(TOOLS):
        t = t.replace('.workbuddy/tmp/' + name, '.workbuddy/tools/' + name)
        t = t.replace('.workbuddy\\tmp\\' + name, '.workbuddy/tools/' + name)
    # 通配写法：grep ... .workbuddy/tmp/*.py
    t = t.replace('.workbuddy/tmp/*.py', '.workbuddy/tools/*.py')
    t = t.replace('.workbuddy/tmp/ 里的历次', '.workbuddy/tools/ 里的历次')
    t = t.replace('tmp 里的历次补丁', 'tools 里的历次补丁')
    if t != o:
        wr(fp, t)
        n1 += t.count('.workbuddy/tools/') - o.count('.workbuddy/tools/')
        files1.append(os.path.basename(fp))
REPORT.append('① 路径转接：%d 处 / %d 份文件 → %s' % (n1, len(files1), '、'.join(files1)))

# ---------- ② 悬空引用订正 ----------
ok2 = []
ok2.append(patch('docs/AI工作备忘.md',
    '只能靠量化特征反推。做过的五组指标（都写在 .workbuddy/tmp/read_ref_*.py）：',
    '只能靠量化特征反推。做过的五组指标（脚本 `read_ref_*.py` 已随过程产物在 v67 清理，'
    '方法本身记在这里，需要时照这段重写）：'))
ok2.append(patch('docs/v66改动说明.md',
    '| 截图 | `.workbuddy/tmp/v66-1-generals / 2-expcap / 3-expok / 4-inn / 5-equip`（1600×950） |',
    '| 截图 | `.workbuddy/tmp/v66-1-generals / 2-expcap / 3-expok / 4-inn / 5-equip`（1600×950）'
    '　⚠️ v67 清理过程产物时已删除；可用 `.workbuddy/tools/probe66_ui.js` 重新生成 |'))
ok2.append(patch('C:/Users/18811/WorkBuddy/2026-08-29-22-25-02/.workbuddy/memory/2026-09-13.md',
    '截图脚本在 .workbuddy/tmp/shot30*.js。',
    '截图脚本在 `.workbuddy/tmp/shot30*.js`（该临时脚本已随 v67 清理过程产物删除；'
    '可复用的探针现在统一放 `.workbuddy/tools/`）。'))
ok2.append(patch('C:/Users/18811/WorkBuddy/2026-08-29-22-25-02/.workbuddy/memory/2026-09-13.md',
    '**已停止时的可回退点**（都在 `.workbuddy/tmp/` 与 `assets/icons/ui/` 下）：',
    '**已停止时的可回退点**（它们在 v67 前位于 `.workbuddy/tmp/`，现统一搬到 `.workbuddy/tools/`）：'))
ok2.append(patch(r'C:\Users\18811\.workbuddy\skills\vanilla-js-bulk-refactor\SKILL.md',
    '探针**放在 `.workbuddy/tmp/`，不提交**。它的价值是"一次性的证据"，',
    '探针**放在 `.workbuddy/tmp/`，不提交**，用完即清。它的价值是"一次性的证据"，'))
REPORT.append('② 悬空引用订正：%d/5 处' % sum(1 for x in ok2 if x))

# ---------- ③ 遗留脚本条目改「已清理」 ----------
ok3 = []
ok3.append(patch('需求档案.md',
    '| 6 | 项目根目录遗留 `check-refs.js` / `test-core.js` / `test-ui.js` / `garden.html` 未清理 | 未做 |',
    '| 6 | 项目根目录遗留 `check-refs.js` / `test-core.js` / `test-ui.js` / `garden.html` | **已清理（v67）** |'))
ok3.append(patch('docs/全面梳理报告.md',
    '| 1 | `check-refs.js` | 4.5 KB | 功能已被 smoke-test 静态门禁覆盖 → 归档或删除 |',
    '| 1 | `check-refs.js` | 4.5 KB | 功能已被 smoke-test 静态门禁覆盖 → **已删除（v67）** |'))
ok3.append(patch('docs/全面梳理报告.md',
    '| 2 | `test-core.js`、`test-ui.js` | 11.7 KB | 已被 smoke/e2e 取代 → 删除 |',
    '| 2 | `test-core.js`、`test-ui.js` | 11.7 KB | 已被 smoke/e2e 取代 → **已删除（v67）** |'))
ok3.append(patch('docs/全面梳理报告.md',
    '| 3 | `garden.html` | 18.2 KB | 与项目无关的 demo → 移出或删除 |',
    '| 3 | `garden.html` | 18.2 KB | 与项目无关的 demo → **已删除（v67）** |'))
_REPORT.append('③ 文档条目订正：%d/4 处' % sum(1 for x in ok3 if x))

# 系统全景.html 那条原名是否还在（先探测再改，避免猜锚点）
p = os.path.join(ROOT, 'docs', '系统全景.html')
t = rd(p)
m = re.search(r"<code>check-refs\.js</code>[^\n]*?garden\.html</code>[^\n]*", t)
if m:
    old = m.group(0)
    new = ('<code>check-refs.js</code>/<code>test-core.js</code>/<code>test-ui.js</code>/'
           '<code>garden.html</code>（**已在 v67 清理**）、嵌套目录 <code>2026-08-29')
    new = new if old.rstrip().endswith('2026-08-29') else new.rstrip('、嵌套目录 <code>2026-08-29')
    wr(p, t.replace(old, new, 1))
    REPORT.append('③ 系统全景.html：1 处（按正则定位，非猜锚点）')
else:
    FAIL.append('系统全景.html 未匹配到遗留脚本条目')

# ---------- ④ 删除已合并的 9 份 ----------
merged_p = os.path.join(ROOT, 'docs', '历轮改动说明.md')
merged = rd(merged_p)
mset = set(x.strip() for x in merged.split('\n'))
OLD = ['v57战斗设定改动说明.md', 'v58改动说明.md', 'v59改动说明.md', 'v60改动说明.md',
       'v61改动说明.md', 'v62改动说明.md', 'v63改动说明.md', 'v64改动说明.md', 'v65改动说明.md']
safe, detail = True, []
for name in OLD:
    fp = os.path.join(ROOT, 'docs', name)
    if not os.path.exists(fp):
        detail.append('%s(已不在)' % name)
        continue
    body = rd(fp).strip()
    lines = [l for l in body.split('\n') if l.strip()]
    miss = [l for l in lines if l.strip() not in mset]
    if miss:
        safe = False
        detail.append('%s ❌缺%d行' % (name, len(miss)))
    else:
        detail.append('%s ✓%d行' % (name, len(lines)))
if safe:
    for name in OLD:
        fp = os.path.join(ROOT, 'docs', name)
        if os.path.exists(fp):
            os.remove(fp)
    REPORT.append('④ 删除已合并的 9 份原件（逐行复核通过）：%s' % '、'.join(detail))
else:
    FAIL.append('④ 复核未通过，**未删除**：%s' % '、'.join(detail))

print('\n'.join(REPORT))
print()
if FAIL:
    print('⚠️ 未完成项：')
    for f in FAIL:
        print('   ', f)
    raise SystemExit(1)
print('收尾全部完成')
