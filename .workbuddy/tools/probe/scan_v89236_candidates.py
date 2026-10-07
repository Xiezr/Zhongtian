# -*- coding: utf-8 -*-
"""v89.236：待删/待移文档的引用面精确统计。
对每个候选文件，在【活面】（js/smoke/e2e/audit/工具/docs 活文档/需求档案/README_INDEX）里数引用。
"""
import io, os, re

R = 'E:/Deepseekdb/'

# 候选：过时风格（汉代设计类）
HAN = ['门派系统规则.md', '江湖场景与玩法素材库.md', '灵气装备与江湖游历设计.md',
       '异人志·角色谱系.md', '逐步场景玩法设计.md', '玩法扩展规划.md']
# 候选：既往评测类
EVAL = ['600x推演-框架师测评报告.md', '600x推演-种田玩家评论.md', '游戏性审查报告.md',
        '试玩测评报告.md', '开发整改清单.md', 'v8991-黄金流对照推演.md', 'v8992-装备流与宝物流推演.md',
        'v8993-设计整改总纲.md', 'v8995-12h长跑测评.md', 'v8998-1x300h测评.md', 'v8998b-最优路径再测评.md',
        'v89100-纯经济与战利品变现.md', 'v89101-四维漏洞探索.md', 'v89105-全面测评与基调统一.md',
        'v89107-百城承压与30h试玩评测.md', 'v89141-96h试玩与留存建议.md',
        'v89206-代码梳理评估.md', 'v89206-体验梳理评估.md', 'v89206-玩法功能梳理评估.md',
        'v89208-代码梳理评估.md', 'v89208-体验梳理评估.md', 'v89208-全面评价体系.md',
        'v89208-实证评估-新发现.md', 'v89208-玩法功能梳理评估.md']
# 候选：过时版本快照类
ERA = ['交接文档.md', '需求规格.md', '经验总结.md', 'UI立骨稿·交付说明.md', 'ui-tokens-vnext.css',
       'AI图标生成清单.md']

# 活面文件列表
LIVE = []
for sub in ['js']:
    for f in os.listdir(R + sub):
        if f.endswith('.js'):
            LIVE.append(R + sub + '/' + f)
LIVE += [R + 'smoke-test.js', R + 'e2e-test.js', R + 'audit.js', R + '需求档案.md', R + 'DESIGN.md']
for root, dirs, files in os.walk(R + '.workbuddy/tools'):
    r = root.replace('\\', '/')
    if any(x in r for x in ('/backup', '/tmp', '/patch')):
        continue
    for f in files:
        if f.endswith(('.js', '.py', '.md')):
            LIVE.append(root + '/' + f)
# docs 活文档
for f in ['设计规范.md', 'AI工作备忘.md', '项目地图.md', '废土术语映射表.md', '数据表索引.md',
          '图标素材注册表.md', 'AI图标生成清单-废土版.md', 'AI肖像生成清单.md', '图标适配流程.md',
          'UI设计交接.md', '数值系统数据字典.md', '美术换皮方法论.md', '换皮操作手册-傻瓜版.md',
          '废土地形生成规格.md']:
    p = R + 'docs/' + f
    if os.path.exists(p):
        LIVE.append(p)

print('=== 待删候选的引用面（活面内，排除 docs 下其他交付文档与 _史料/_参考）===')
print()
for group, files in [('【过时风格 · 汉代设计】', HAN), ('【既往评测】', EVAL), ('【过时版本快照】', ERA)]:
    print('#' * 80)
    print(group)
    print('#' * 80)
    for name in files:
        hits = []
        for fp in LIVE:
            s = io.open(fp, encoding='utf-8', errors='replace').read()
            c = s.count(name)
            if c > 0:
                rel = fp.replace(R, '')
                # 排除"文件自己"
                if os.path.basename(fp) == name:
                    c -= 1
                if c > 0:
                    hits.append('%s×%d' % (rel, c))
        mark = '★' if hits else '○'
        print('%s %-44s %s' % (mark, name, ('  '.join(hits) if hits else '（活面零引用）')))
    print()

# 交付文档总量统计
v89 = [f for f in os.listdir(R + 'docs') if re.match(r'^v(89|898|899)', f) and f.endswith('.md')]
print('docs 顶层 v89* 交付文档总数:', len(v89))
