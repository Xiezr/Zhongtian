# -*- coding: utf-8 -*-
"""v89.236 执行：文档分类整合与清理（备份已完成 → .workbuddy/backup/v89236-docs/）
  P1 建 docs/_史料/交付/
  P2 移动 147 份逐轮交付记录
  P3 删除 36 份过时材料（汉代风格 6 + 既往评测 24 + 旧快照 6）
  P4 引用面修复：移动→路径改写；删除→就地标注（含移动档内引用）；特殊形态单独处理
  P4.5 残留验证：扫描未归位引用
用法：python patch_v89236_exec.py          # dry-run（只打印）
      python patch_v89236_exec.py --apply  # 落盘
"""
import io, os, re, sys, shutil

R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
DST = R + 'docs/_史料/交付/'
LOG = []


def say(*a):
    LOG.append(' '.join(str(x) for x in a))


# ---------- 清单 ----------
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
DEL_ERA = ['交接文档.md', '需求规格.md', '经验总结.md', 'UI立骨稿·交付说明.md', 'ui-tokens-vnext.css',
           'UI设计交接.md']
DEL = DEL_HAN + DEL_EVAL + DEL_ERA
KEEP_V89 = ['v89125-建筑建造时间表.md', 'v89194-道具价格表.md']

allv = sorted(f for f in os.listdir(R + 'docs') if re.match(r'^v89', f) and f.endswith('.md'))
MOVE = [f for f in allv if f not in DEL and f not in KEEP_V89]
if os.path.exists(R + 'docs/v67改动说明.md'):
    MOVE.append('v67改动说明.md')

assert len(DEL) == 36, len(DEL)
assert len(MOVE) == 147, len(MOVE)

PREFIX_MAP = {
    'v89179': 'v89179-克制全撤与纸面数据复核.md',
    'v89189': 'v89189-受阻弹窗掠夺金与人口占用.md',
    'v89198': 'v89198-战法全撤与管理弹窗统一行.md',
    'v89151': 'v89151-八项落地.md',
    'v89211': 'v89211-强化链修复与占城补齐与器械工位.md',
    'v89194': 'v89194-营造金藏珍阁与雷达圈.md',
    'v89220': 'v89220-基因实验室与建筑条件复核.md',
    'v89136': 'v89136-军务采集与战斗界面.md',
    'v89135': 'v89135-军务野地大轮.md',
    'v89137': 'v89137-建筑专精三档与派驻统一.md',
    'v89139': 'v89139-战场2列与距离口径.md',
    'v89104': 'v89104-界面整备.md',
    'v89121': 'v89121-全生命周期模拟.md',
    'v89131': 'v89131-将领面板与精力经济.md',
}
for k, v in PREFIX_MAP.items():
    assert v in MOVE, 'prefix target not in MOVE: ' + v

# 特殊形态（前缀式指向删除项 / 无 docs 前缀 / 别名 / 错字 / 省略号名）——按 basename 匹配
SPECIAL = [
    ('ui.js', 'docs/v89105', 'docs/v89105（v89.236 已清理）'),
    ('AI肖像生成清单.md', 'UI设计交接.md', 'UI设计交接.md（v89.236 已清理）'),
    ('废土术语映射表.md', 'docs/v89224-废土根脉改造（总）', 'docs/_史料/交付/v89224-废土根脉改造.md'),
    ('需求档案.md', 'docs/v89.129', 'docs/_史料/交付/v89129-城墙时间与野外目标带将.md'),
    ('v89211-强化链修复与占城补齐与器械工位.md', 'docs/v89211b-换世界观参考…md',
     'docs/_史料/交付/v89211b-换世界观参考-时代背景与故事方案.md'),
]

MARK = '（v89.236 已清理）'
# 删除项标注的目标范围：需求档案 / smoke / 三份活文档 / 项目地图 / 全部移动档
MARK_FILES = {'需求档案.md', 'smoke-test.js', '设计规范.md', 'AI工作备忘.md',
              'AI肖像生成清单.md', '项目地图.md'}

# ---------- 修复目标 ----------
FIX = [R + '需求档案.md', R + 'smoke-test.js', R + 'e2e-test.js', R + 'DESIGN.md']
for f in os.listdir(R + 'js'):
    if f.endswith('.js'):
        FIX.append(R + 'js/' + f)
for f in os.listdir(R + 'docs'):
    p = R + 'docs/' + f
    if f.endswith(('.md', '.css')) and os.path.isfile(p) and f not in DEL:
        FIX.append(p)
for sub in ['gen', 'audit', 'show', 'playtest', 'play', 'asset', 'git']:
    d = R + '.workbuddy/tools/' + sub
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(('.js', '.py')):
                FIX.append(d + '/' + f)

say('=' * 70)
say('P2 移动 %d 份 → docs/_史料/交付/' % len(MOVE))
say('P3 删除 %d 份' % len(DEL))
say('P4 修复目标 %d 个活面文件' % len(FIX))
say('=' * 70)

if APPLY:
    os.makedirs(DST, exist_ok=True)

# ---------- P2 / P3 ----------
moved_ok = del_ok = 0
for f in MOVE:
    src = R + 'docs/' + f
    if not os.path.exists(src):
        say('!! 移动源缺失:', f)
        continue
    if APPLY:
        shutil.move(src, DST + f)
    moved_ok += 1
for f in DEL:
    src = R + 'docs/' + f
    if not os.path.exists(src):
        say('!! 删除源缺失:', f)
        continue
    if APPLY:
        os.remove(src)
    del_ok += 1
say('P2 %s：%d 份' % ('已移动' if APPLY else '将移动', moved_ok))
say('P3 %s：%d 份' % ('已删除' if APPLY else '将删除', del_ok))

if APPLY:
    for f in MOVE:
        p = DST + f
        if f.endswith('.md') and os.path.exists(p):
            FIX.append(p)

# ---------- P4 引用修复 ----------
stat = {'exact': 0, 'prefix': 0, 'glob': 0, 'mark': 0, 'special': 0}
detail = []
stats_left = []
for fp in FIX:
    if not os.path.isfile(fp):
        continue
    rel = fp.replace(R, '')
    base = os.path.basename(fp)
    s0 = io.open(fp, encoding='utf-8', newline='').read()
    s = s0
    for name in MOVE:
        old = 'docs/' + name
        new = 'docs/_史料/交付/' + name
        if old in s:
            c = s.count(old)
            s = s.replace(old, new)
            stat['exact'] += c
            detail.append(('exact', rel, name, c))
    for pre, tgt in PREFIX_MAP.items():
        pat = re.compile(r'docs/' + pre + r'(?![0-9a-z.\-])')
        s, n = pat.subn('docs/_史料/交付/' + tgt, s)
        if n:
            stat['prefix'] += n
            detail.append(('prefix', rel, pre + '→' + tgt, n))
    # glob 引用：docs/v89xxx-* → docs/_史料/交付/v89xxx-*
    s, n = re.subn(r'docs/(v89[0-9ab]{3,4}[ab]?-\*)', r'docs/_史料/交付/\1', s)
    if n:
        stat['glob'] += n
        detail.append(('glob', rel, '*', n))
    for f2name, old, new in SPECIAL:
        if base == f2name and old in s:
            c = s.count(old)
            s = s.replace(old, new)
            stat['special'] += c
            detail.append(('special', rel, old, c))
    is_moved = ('docs/_史料/交付/' in fp) or ('docs/' + base in ['docs/' + m for m in MOVE])
    if base in MARK_FILES or is_moved:
        for name in DEL:
            old = 'docs/' + name
            pat = re.compile(re.escape(old) + r'(?!（v89\.236)')
            s, n = pat.subn(old + MARK, s)
            if n:
                stat['mark'] += n
                detail.append(('mark', rel, name, n))
            # 裸文件名形态（无 docs/ 前缀，如 `门派系统规则.md` §四）
            pat2 = re.compile(r'(?<![\w/])' + re.escape(name) + r'(?!（v89\.236)')
            s, n2 = pat2.subn(name + MARK, s)
            if n2:
                stat['mark'] += n2
                detail.append(('mark-bare', rel, name, n2))
    # ---- P4.5 残留验证（内存态，随 P4 一同进行）----
    for m in re.finditer(r"""docs/(v89[^\s`)）」』|，。\]]{0,50})""", s):
        tgt = m.group(1).rstrip("'\" ")
        win = s[m.start():m.end() + 25]
        ok = (tgt.startswith('_史料/交付/') or (tgt in KEEP_V89) or tgt.startswith('v89.')
              or ('v89.236' in win))
        if not ok:
            ln = s.count('\n', 0, m.start()) + 1
            stats_left.append('  残留 %s L%d: docs/%s' % (rel, ln, tgt))
    if s != s0:
        if APPLY:
            io.open(fp, 'w', encoding='utf-8', newline='').write(s)

say()
say('P4 统计：exact=%d prefix=%d glob=%d special=%d mark=%d' % (
    stat['exact'], stat['prefix'], stat['glob'], stat['special'], stat['mark']))
say()
say('=' * 70)
say('P4.5 残留验证（内存态：修复目标内不应再有未归位的 docs/v89 引用）')
say('=' * 70)
for row in stats_left:
    say(row)
say('残留合计: %d' % len(stats_left))
say()
say('（历史一次性脚本 tools/patch、probe、mem 及 _参考 不在本轮引用修复范围，属既有审计痕迹）')

out = '\n'.join(LOG)
io.open(R + '.workbuddy/tmp/p236_exec%s.txt' % ('' if APPLY else '_dry'), 'w', encoding='utf-8').write(out)
print(out)
print('APPLIED' if APPLY else 'DRY-RUN（未写盘）')
