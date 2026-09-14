# -*- coding: utf-8 -*-
"""v67 清理收尾：
① 修正 资产清理记录（上一版把"搬运成功"写成了"已不存在"—— 脚本被重复执行所致）；
② 真正把文档/记忆里的 `.workbuddy/tmp/xxx` 路径转接到 `.workbuddy/tools/xxx`；
③ 合并 v57~v65 改动说明 → docs/历轮改动说明.md（保留内容，去 9 个文件）；
④ 把两份文档里"遗留脚本待清理"的条目改成"已清理（v67）"。
"""
import io, os, re, glob

ROOT = r'E:\Deepseekdb'
TOOLS = os.path.join(ROOT, '.workbuddy', 'tools')
tools = sorted(os.listdir(TOOLS))
LOG = []

# ---------- ① 重写清理记录 ----------
old_log = os.path.join(ROOT, 'docs', '资产清理记录_v67.md')
LOG.append('# v67 资产清理记录')
LOG.append('')
LOG.append('> 判据：**先查引用，再决定去留**；被文档/记忆点名的工具只搬不删。')
LOG.append('')
LOG.append('## 一、搬入 `.workbuddy/tools/`（%d 个）' % len(tools))
LOG.append('')
LOG.append('可复用的探针 / 破坏测试 / 生成器 / 调色脚本，全部保留（原名不变）：')
LOG.append('')
LOG.append('　' + '、'.join('`%s`' % t for t in tools))
LOG.append('')
LOG.append('## 二、删除 `.workbuddy/tmp/` 的过往过程产物')
LOG.append('')
LOG.append('　**872 个文件 / 151.9MB**：过往轮次的对比截图（214 张 PNG，128MB）、')
LOG.append('　一次性补丁与探针脚本、旧备份（`MEMORY.*.bak.md` / `SKILL.e2e.bak.md`）、')
LOG.append('　素材切分中间件（`mapart/` `terra2/` 等）。')
LOG.append('')
LOG.append('　保留：本轮截图 `v67-1-sidebar-1440x900.png` → `.workbuddy/shots/`。')
LOG.append('')
LOG.append('## 三、删除根目录遗留脚本（已被三件套取代）')
LOG.append('')
LOG.append('　`check-refs.js`(4KB) · `test-core.js`(5KB) · `test-ui.js`(6KB) · `garden.html`(18KB)')
LOG.append('　——`docs/全面梳理报告.md` 与 `需求档案.md` 里本就登记为"待清理"，本次照办；')
LOG.append('　两处文字已改为"已清理（v67）"。')
LOG.append('')
LOG.append('## 四、删除误建的项目根副本 `2026-08-29-22-25-02/`')
LOG.append('')
LOG.append('　5 个文件 / 306KB，内容与 `docs/` 下的数值报告重复（含一份 2026-08-31 的记忆副本）。')
LOG.append('')
LOG.append('## 五、删除 `assets/portraits/_ai_backup/`')
LOG.append('')
LOG.append('　29 个文件 / 1.4MB：`hero_*.webp` 的旧备份，与正式文件同名同源。')
LOG.append('')
LOG.append('## 六、合并旧版本说明')
LOG.append('')
LOG.append('　`docs/v57~v65 改动说明.md`（9 份）→ 合并为 `docs/历轮改动说明.md`，内容一字未丢。')
LOG.append('　保留 `docs/v66/v67` 两份（最近两轮，记忆里还在引用）。')
LOG.append('')
LOG.append('## 七、**留给老板拍板的**（不删，因为不可逆 / 可能还要用）')
LOG.append('')
LOG.append('| 目录 | 大小 | 是什么 |')
LOG.append('|---|---|---|')
LOG.append('| `assets/icons/raw/` | 38.2MB | AI 生成的 2×2 图集原图（图标切分的原料） |')
LOG.append('| `assets/portraits/_raw/` | 41.3MB | 28 位名将的 AI 原图（`hero_*.webp` 的来源） |')
LOG.append('| `assets/portraits/pd_src/` | 2.9MB | 公版画像（貂蝉/小乔等，已备未启用） |')
LOG.append('| `assets/icons/ui/` 里 12 张未接线图标 | 15.9MB | `ai_terrain_*`(7) `ai_city_*`(4) `ai_fort`；'
            '运行时不取（地图地形目前走矢量回退），要么接上、要么删 |')
LOG.append('')
LOG.append('　合计约 **98MB**。删了就只剩成品，重新生成要再花一次 AI 出图成本，所以等你点头。')
LOG.append('')
LOG.append('## 八、运行期用到的素材（这些不能动）')
LOG.append('')
LOG.append('　`assets/icons/ui/*.png`（经 `js/bitmaps.js` 注册表取图，93 张在用）·')
LOG.append('　`assets/portraits/pool/{m,f}01-20.webp`（通用头像池）·')
LOG.append('　`assets/portraits/hero_*.webp`（28 位名将回退层）')
LOG.append('')
io.open(old_log, 'w', encoding='utf-8', newline='').write('\n'.join(LOG) + '\n')
print('① 清理记录已重写')

# ---------- ② 路径转接 ----------
n_files = 0
TARGETS = []
for pat in ['docs/*.md', 'docs/*.html', '*.md']:
    TARGETS += glob.glob(os.path.join(ROOT, pat))
for s in [r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory',
          r'C:\Users\18811\.workbuddy\skills']:
    TARGETS += glob.glob(os.path.join(s, '**', '*.md'), recursive=True)
hits = 0
for fp in TARGETS:
    if '资产清理记录_v67' in fp or '历轮改动说明' in fp: continue
    try: t = io.open(fp, encoding='utf-8', newline='').read()
    except Exception: continue
    o = t
    for name in tools:
        t = t.replace('.workbuddy/tmp/' + name, '.workbuddy/tools/' + name)
        t = t.replace('.workbuddy\\\\tmp\\\\' + name, '.workbuddy/tools/' + name)
        t = t.replace('tmp/' + name, 'tools/' + name) if ('tmp/' + name) in t and 'tmp/' + name not in ('.workbuddy/tmp/' + name) else t
    if t != o:
        io.open(fp, 'w', encoding='utf-8', newline='').write(t)
        hits += 1
        n_files += 1
        print('   转接：', os.path.relpath(fp, ROOT) if fp.startswith(ROOT) else fp)
print('② 路径转接：%d 份文件' % n_files)

# ---------- ③ 合并 v57~v65 ----------
OLD = ['v57战斗设定改动说明.md', 'v58改动说明.md', 'v59改动说明.md', 'v60改动说明.md',
       'v61改动说明.md', 'v62改动说明.md', 'v63改动说明.md', 'v64改动说明.md', 'v65改动说明.md']
parts = ['# 历轮改动说明（v57 ~ v65）', '',
         '> v57~v65 九轮改动说明的合并件 —— 内容一字未改，只是把九份文件收成一份。',
         '> v63~v65 的要点另有提炼，见 `AI工作备忘.md`；v66/v67 仍各自单独成文。', '']
found = []
for name in OLD:
    fp = os.path.join(ROOT, 'docs', name)
    if not os.path.exists(fp):
        print('   （缺）', name); continue
    found.append(name)
    body = io.open(fp, encoding='utf-8', newline='').read()
    parts += ['', '---', '', '## ' + name.replace('.md', ''), '', body.strip(), '']
if found:
    io.open(os.path.join(ROOT, 'docs', '历轮改动说明.md'), 'w', encoding='utf-8', newline='').write(
        '\n'.join(parts).rstrip() + '\n')
    for name in found:
        os.remove(os.path.join(ROOT, 'docs', name))
print('③ 合并 %d 份 → docs/历轮改动说明.md' % len(found))

# ---------- ④ 两处"待清理"改成已清理 ----------
edits = [
    ('需求档案.md',
     '| 6 | 项目根目录遗留 `check-refs.js` / `test-core.js` / `test-ui.js` / `garden.html` 未清理 | 未做 |',
     '| 6 | 项目根目录遗留 `check-refs.js` / `test-core.js` / `test-ui.js` / `garden.html` | **已清理（v67）** |'),
    ('docs/全面梳理报告.md',
     '| `check-refs.js` | 4.5 KB | 功能已被 smoke-test 静态门禁覆盖 → 归档或删除 |',
     '| `check-refs.js` | 4.5 KB | 功能已被 smoke-test 静态门禁覆盖 → **已删除（v67）** |'),
    ('docs/全面梳理报告.md',
     '| `test-core.js`、`test-ui.js` | 11.7 KB | 已被 smoke/e2e 取代 → 删除 |',
     '| `test-core.js`、`test-ui.js` | 11.7 KB | 已被 smoke/e2e 取代 → **已删除（v67）** |'),
    ('docs/全面梳理报告.md',
     '| `garden.html` | 18.2 KB | 与项目无关的 demo → 移出或删除 |',
     '| `garden.html` | 18.2 KB | 与项目无关的 demo → **已删除（v67）** |'),
    ('docs/系统全景.html',
     "<code>check-refs.js</code> / <code>test-core.js</code> / <code>test-ui.js</code>（已被三件套取代）、<code>garden.html</code>（无关 demo）",
     "<code>check-refs.js</code>/<code>test-core.js</code>/<code>test-ui.js</code>/<code>garden.html</code>（**已在 v67 清理**）"),
]
n4 = 0
for rel, old, new in edits:
    fp = os.path.join(ROOT, rel)
    t = io.open(fp, encoding='utf-8', newline='').read()
    if old in t:
        io.open(fp, 'w', encoding='utf-8', newline='').write(t.replace(old, new))
        n4 += 1
    else:
        print('   （锚点不在）', rel, old[:40])
print('④ 文档里的待清理条目已改为已清理：%d 处' % n4)
