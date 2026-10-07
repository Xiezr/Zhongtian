# -*- coding: utf-8 -*-
"""v89.236：执行清单生成（dry-run 枚举）——待移 142 / 待删 35 / 全部引用点。
只读，不写任何文件。"""
import io, os, re

R = 'E:/Deepseekdb/'

DEL_HAN = ['门派系统规则.md', '江湖场景与玩法素材库.md', '灵气装备与江湖游历设计.md',
           '异人志·角色谱系.md', '逐步场景玩法设计.md', '玩法扩展规划.md']
DEL_EVAL = ['600x推演-框架师测评报告.md', '600x推演-种田玩家评论.md', '游戏性审查报告.md',
            '试玩测评报告.md', '开发整改清单.md', 'v8991-黄金流对照推演.md', 'v8992-装备流与宝物流推演.md',
            'v8993-设计整改总纲.md', 'v8995-12h长跑测评.md', 'v8998-1x300h测评.md', 'v8998b-最优路径再测评.md',
            'v89100-纯经济与战利品变现.md', 'v89101-四维漏洞探索.md', 'v89105-全面测评与基调统一.md',
            'v89107-百城承压与30h试玩评测.md', 'v89141-96h试玩与留存建议.md',
            'v89206-代码梳理评估.md', 'v89206-体验梳理评估.md', 'v89206-玩法功能梳理评估.md',
            'v89208-代码梳理评估.md', 'v89208-体验梳理评估.md', 'v89208-全面评价体系.md',
            'v89208-实证评估-新发现.md', 'v89208-玩法功能梳理评估.md']
DEL_ERA = ['交接文档.md', '需求规格.md', '经验总结.md', 'UI立骨稿·交付说明.md', 'ui-tokens-vnext.css']

DEL = DEL_HAN + DEL_EVAL + DEL_ERA
KEEP_V89 = ['v89125-建筑建造时间表.md', 'v89194-道具价格表.md']   # 生成型数据表：留顶层并刷新

# ---------- 1. 核对删除清单存在性 ----------
print('=' * 80)
print('① 删除清单核对（35 项）')
print('=' * 80)
missing = []
for f in DEL:
    p = R + 'docs/' + f
    if os.path.exists(p):
        print('  ✓ %-44s %dKB' % (f, os.path.getsize(p) // 1024))
    else:
        print('  ✗ 不存在：', f)
        missing.append(f)
print('  缺失:', len(missing))

# ---------- 2. 生成移动清单 ----------
allv = sorted(f for f in os.listdir(R + 'docs') if re.match(r'^v89', f) and f.endswith('.md'))
MOVE = [f for f in allv if f not in DEL and f not in KEEP_V89]
MOVE += ['v67改动说明.md'] if os.path.exists(R + 'docs/v67改动说明.md') else []
print()
print('=' * 80)
print('② 移动清单：%d 份（docs/ 顶层 v89* 共 %d · 删 %d · 留表 %d）' % (len(MOVE), len(allv), len([f for f in allv if f in DEL]), len(KEEP_V89)))
print('=' * 80)
print('  前 12:', MOVE[:6], '...', MOVE[-6:])
# 抽查 6 个疑似非记录
for f in ['v89211b-换世界观参考-时代背景与故事方案.md', 'v89209b-键盘流与状态条规划.md',
          'v89184-方案A与配置清单.md', 'v89102-沙盘回放与测评遗留落地.md',
          'v89118-四条需求与30h试玩评测.md', 'v89185-七条落地与两设计评估.md',
          'v89187-品质合成评估与据点情报.md', 'v89192-回本城观战补史与价值体系.md']:
    print('  [移动]', f, '∈' if f in MOVE else '∉ MISSING')

# ---------- 3. 引用点枚举 ----------
TARGETS = [R + '需求档案.md', R + 'DESIGN.md', R + 'smoke-test.js', R + 'e2e-test.js', R + 'audit.js']
for f in os.listdir(R + 'js'):
    if f.endswith('.js'):
        TARGETS.append(R + 'js/' + f)
# docs 活文档（顶层 md + css，排除 _史料/_参考/出图prompt）
for f in os.listdir(R + 'docs'):
    p = R + 'docs/' + f
    if f.endswith(('.md', '.css')) and os.path.isfile(p):
        TARGETS.append(p)
# 工具面
for root, dirs, files in os.walk(R + '.workbuddy/tools'):
    r = root.replace('\\', '/')
    if any(x in r for x in ('/backup', '/tmp', '/patch/')):
        continue
    for f in files:
        if f.endswith(('.js', '.py', '.md')):
            TARGETS.append(root + '/' + f)

print()
print('=' * 80)
print('③ 引用点枚举（活面 %d 文件）' % len(TARGETS))
print('=' * 80)
tot_move_ref = tot_del_ref = 0
ref_report = []
for fp in TARGETS:
    if not os.path.isfile(fp):
        continue
    s = io.open(fp, encoding='utf-8', errors='replace').read()
    rel = fp.replace(R, '')
    for name in MOVE:
        if name in s:
            c = s.count(name)
            ref_report.append((rel, name, c, 'MOVE'))
            tot_move_ref += c
    for name in DEL:
        if name in s:
            c = s.count(name)
            ref_report.append((rel, name, c, 'DEL'))
            tot_del_ref += c

# 聚合输出
from collections import defaultdict
byname = defaultdict(list)
for rel, name, c, kind in ref_report:
    byname[name].append((rel, c, kind))
print()
print('--- 被引用的【移动】文件（%d 个文件 · %d 处引用）---' % (len([k for k in byname if byname[k][0][2] == 'MOVE']), tot_move_ref))
for name in sorted(byname, key=lambda x: -(sum(c for _, c, k in byname[x]))):
    rows = byname[name]
    if rows[0][2] != 'MOVE':
        continue
    tot = sum(c for _, c, k in rows)
    print('  %-46s %2d 处 = %s' % (name[:44], tot, ' + '.join('%s×%d' % (r, c) for r, c, k in rows[:6])))
print()
print('--- 被引用的【删除】文件（%d 个 · %d 处引用）---' % (len([k for k in byname if byname[k][0][2] == 'DEL']), tot_del_ref))
for name in sorted(byname, key=lambda x: -(sum(c for _, c, k in byname[x]))):
    rows = byname[name]
    if rows[0][2] != 'DEL':
        continue
    tot = sum(c for _, c, k in rows)
    print('  %-46s %2d 处 = %s' % (name[:44], tot, ' + '.join('%s×%d' % (r, c) for r, c, k in rows[:8])))

# 前缀式引用（docs/v89xxx 无 .md）
print()
print('--- 前缀式引用扫描（docs/v89 不带 .md）---')
for fp in TARGETS:
    if not os.path.isfile(fp):
        continue
    s = io.open(fp, encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'docs/v89[0-9ab]{3,4}(?![0-9a-z.\-])', s):
        ln_ = s.count('\n', 0, m.start()) + 1
        line = s.split('\n')[ln_ - 1].strip()
        print('  %s L%-6d %s | %s' % (fp.replace(R, ''), ln_, m.group(0), line[:100]))
