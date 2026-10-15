# -*- coding: utf-8 -*-
"""生成 `.workbuddy/tools/README_INDEX.md` —— 按**目录**分组（v67 起目录就是分组）。

v67 起 tools 分成 8 个子目录，本脚本：
  ① 递归扫描（含根目录的零散文件）；
  ② 每个文件**自动摘首行注释**作为一行用途（省得靠文件名猜）；
  ③ 未归类的单列一节并显式报数（新增脚本忘了归档会被看见）。
工具结构变了就重跑本脚本，索引不会过期。
"""
import io, os, re

T = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .workbuddy/tools
OUT = os.path.join(T, 'README_INDEX.md')

DESC = {
    'patch': ('变更日志（补丁脚本）',
              '**事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。'
              '"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。'),
    'break': ('破坏测试',
              '逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、'
              '注入后连"是否中断"一起看、收尾 md5 比对还原。'),
    'probe': ('探针（几何 / 界面 / 存档）',
              'jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。'
              '`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，'
              '`probe67_save3.js` 量存档体积与配额。'),
    'gen': ('生成器与索引',
            '素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`'
            '（勿手改产物）；`gen_tools_index.py` 生成本索引。'),
    'asset': ('素材处理',
              '抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。'),
    'audit': ('审计与核对',
              '结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；'
              '`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；'
              '`trash_paths.py` = 逐项+回查的删除模板。'),
    'mem': ('记忆维护',
            'MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。'
            '`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。'),
    'show': ('展示与校准', '给老板看的对照图 / 曲线校准 / 素材巡视。'),
    'git': ('Git 同步与门禁',
            '**收尾同步的唯一入口**。`sync.py` 默认干跑、`--apply` 才落盘（干跑先行是本项目铁律）；'
            '`gate.py` 是三件套门禁的**唯一出口**（pre-commit 钩子与 sync 都调它）；'
            '`install_hooks.py` 把 `hooks/` 里的钩子装进 `.git/hooks/`。'),
    'git/hooks': ('Git 钩子本体',
                  '存这里是为了**进版本库** —— `.git/hooks/` 不被 git 跟踪，换台机器克隆后必须跑 '
                  '`install_hooks.py` 重装。⚠️ **行尾必须 LF**，CRLF 会让 `#!/bin/sh` 失效。'),
}


def first_comment(p):
    """摘首行注释或文档字符串当用途；没有就留空（不许编）。"""
    try:
        c = io.open(p, encoding='utf-8', errors='ignore').read(1500)
    except Exception:
        return ''
    for line in c.split('\n'):
        s = line.strip()
        if s.startswith('#!') or s.startswith('# -*-') or s.startswith('# coding'):
            continue
        m = re.match(r'^(?:/\*+|//+|#)\s*(.+)$', s)
        if m:
            t = re.sub(r'[\s*/]+$', '', m.group(1)).strip()
            t = re.sub(r'^[-=]{3,}\s*', '', t)
            if len(t) >= 4:
                return t[:88] + ('…' if len(t) > 88 else '')
        # 文档字符串（.py 常见写法）：取首行正文，避免这类文件在索引里没有描述
        if s.startswith('"""') or s.startswith("'''"):
            t = s[3:]
            if t.endswith('"""') or t.endswith("'''"):
                t = t[:-3]
            t = t.strip()
            if len(t) >= 4:
                return t[:88] + ('…' if len(t) > 88 else '')
        if s and not s.startswith(('/*', '//', '#', '*', '"', "'", 'import', 'from', 'const', 'var', '$')):
            break
    return ''


groups = {}
for r, ds, fs in os.walk(T):
    # 归一化为正斜杠：否则 Windows 上子目录会变成 "git\hooks"，
    # 既与 DESC 的键对不上（显示成「未归类」），索引里也会混着两种分隔符
    rel = os.path.relpath(r, T).replace(os.sep, '/')
    for f in sorted(fs):
        if f == 'README_INDEX.md':
            continue
        groups.setdefault('' if rel == '.' else rel, []).append(f)

L = []
A = L.append
A('# `.workbuddy/tools/` 索引')
A('')
A('> 开发期工具，**不进游戏运行期**。目录就是分组；本文件由 `gen/gen_tools_index.py` 自动生成。')
A('> 归属判据与总地图见 `docs/项目地图.md`。**新增脚本请放进对应目录**（放在根目录会被列进"未归类"）。')
A('')
A('| 目录 | 个数 | 干什么 |')
A('|---|---|---|')
tot = 0
for g in sorted(groups):
    n = len(groups[g])
    tot += n
    name, desc = DESC.get(g, ('（未归类）', '**待归类**：确认用途后放进上面的某个目录。'))
    A('| `%s/` | %d | %s |' % (g or '.', n, desc))
A('| **合计** | **%d** | |' % tot)
A('')
for g in sorted(groups):
    name, desc = DESC.get(g, ('未归类', '待归类：请确认用途后归档。'))
    A('## %s（%s）' % ((g + '/') if g else '根目录', name))
    A('')
    A(desc)
    A('')
    for f in groups[g]:
        p = os.path.join(T, g, f) if g else os.path.join(T, f)
        note = first_comment(p)
        A('- `%s`（%.0fKB）%s' % (f, os.path.getsize(p) / 1024, ('　— ' + note) if note else ''))
    A('')
A('---')
A('')
A("**跑测试**：`node audit.js` · `node smoke-test.js` · "
  "`NODE_PATH='…\\node\\workspace\\node_modules' node e2e-test.js`")
A('')
A('**跑工具**（路径含子目录）：`node .workbuddy/tools/gen/gen_bitmaps.js`（.js 用 node、.py 用 python）。')

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L) + '\n')
print('✓ 索引已生成：%d 个文件 / %d 组' % (tot, len([g for g in groups if g])))
print('   未归类：%s' % (groups.get('', []) or '无 ✅'))
