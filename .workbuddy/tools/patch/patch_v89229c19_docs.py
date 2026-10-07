# -*- coding: utf-8 -*-
"""v89.229c19：活文档同步（兵种 18→14 · 位图改名 · 术语映射表补录）"""
import io, os, re, sys

ROOT = r'E:\Deepseekdb'
# 长词优先
MAP = [
    ('重弩车', '无人轰炸机'), ('破门车', '自行火炮'), ('迫击炮', '自行火炮'),
    ('变异巨兽', '泰坦机甲'), ('防暴甲兵', '电磁盾卫'), ('突击摩托', '武装直升机'),
    ('王牌战车', '狂猎'), ('装甲战车', '主战机甲'), ('重甲战车', '主战机甲'),
    ('摩托游骑', '伏击车'), ('旧军残部', '狂猎'), ('搬运工', '板车'),
    ('侦察兵', '侦察单元'), ('运输车', '运输平台'), ('长矛手', '步行机'),
    ('民兵', '步行机'), ('弩手', '导弹车'), ('象兵', '泰坦机甲'),
]
DOCS = ['docs/设计规范.md', 'docs/UI设计交接.md', 'docs/AI工作备忘.md',
        'docs/AI图标生成清单-废土版.md', 'docs/AI图标生成清单.md',
        'docs/玩法扩展规划.md', 'docs/门派系统规则.md']
KEEP = ['为当时称谓', '原名', '原「', '旧名', '见映射', '旧文档', '当时称谓', '沿革', '映射源']

LOG = []
for rel in DOCS:
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    if not os.path.exists(p):
        LOG.append('!! 缺文件 ' + rel); continue
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    lines = s.split('\n')
    hits = []
    for i, line in enumerate(lines):
        if any(k in line for k in KEEP):
            continue
        nl = line
        for a, b in MAP:
            if a in nl:
                nl = nl.replace(a, b)
        if nl != line:
            hits.append((i + 1, line.strip()[:110], nl.strip()[:110]))
            lines[i] = nl
    if hits:
        io.open(p, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
        LOG.append('##### %s (%d 行)' % (rel, len(hits)))
        for ln, a, b in hits[:14]:
            LOG.append('  L%-5d %s' % (ln, a))
            LOG.append('     →   %s' % b)
        LOG.append('  …' if len(hits) > 14 else '')

# 位图文件名（注册表 + 生成清单）
PNGMAP = [('ai_changqiang.png', 'ai_buxingji.png'), ('ai_chihou.png', 'ai_zhencha.png'),
          ('ai_chongche.png', 'ai_huopao.png'), ('ai_chuangnu.png', 'ai_wuren.png'),
          ('ai_daodun.png', 'ai_dunwei.png'), ('ai_gongjian.png', 'ai_daodanche.png'),
          ('ai_hubaoqi.png', 'ai_kuanglie.png'), ('ai_minfu.png', 'ai_banche.png'),
          ('ai_nanjiangxiangbing.png', 'ai_taitan.png'), ('ai_qingji.png', 'ai_fujiche.png'),
          ('ai_qingzhoubing.png', 'ai_kuanglie.png'), ('ai_tengjiabing.png', 'ai_dianci.png'),
          ('ai_tieji.png', 'ai_zhuzhan.png'), ('ai_toudan.png', 'ai_huopao.png'),
          ('ai_tuqibing.png', 'ai_wuzhi.png'), ('ai_xiliangtieqi.png', 'ai_zhuzhan.png'),
          ('ai_yibing.png', 'ai_buxingji.png'), ('ai_zhouche.png', 'ai_yunshu.png')]
for rel in ['docs/图标素材注册表.md']:
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n = 0
    for a, b in PNGMAP:
        n += s.count(a)
        s = s.replace(a, b)
    s = s.replace('| 兵种 | `ai_` | 18 |', '| 兵种 | `ai_` | 14 |')
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    LOG.append('##### %s：位图名换代 %d 处 · 数量 18→14' % (rel, n))

# 术语映射表补录（唯一映射源）
p = os.path.join(ROOT, 'docs', '废土术语映射表.md')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
MARK = '## 兵种 18→14（v89.229 兵种重构）'
if MARK in s:
    LOG.append('[skip] 术语映射表 · 兵种段')
else:
    sec = u'''

---

## 兵种 18→14（v89.229 兵种重构）

> 老板（v89.229 需求 2）：「兵种重构，不再按步兵骑兵区分，合并，按分页显示，缩减兵种数量，保留可增加框架」。
> 唯一映射源 = `GAME.TROOP_MAP_229`（js/state.js）· 老档迁移 `GAME.migrateTroops229`（幂等标记 `st.troopMig229`）。
> **id 换代、数值承原型**（合并项取数值原型的那一套：混编不叠加、不重算平衡）。

| # | 新显示名（新 id） | 承原型 | 合并自（旧 id / 旧名） | 位图 | 组 |
|---|---|---|---|---|---|
| 1 | 板车（`banche`） | 搬运工 | minfu 搬运工 | `ai_banche.png` ← `ai_minfu.png` | 1 后勤支援 |
| 2 | 伏击车（`fujiche`） | 摩托游骑 | qingji 摩托游骑 | `ai_fujiche.png` ← `ai_qingji.png` | 1 |
| 3 | 侦察单元（`zhencha`） | 侦察兵 | chihou 侦察兵 | `ai_zhencha.png` ← `ai_chihou.png` | 1 |
| 4 | 运输平台（`yunshu`） | 运输车 | zhouche 运输车 | `ai_yunshu.png` ← `ai_zhouche.png` | 1 |
| 5 | 步行机（`buxingji`） | 长矛手 | yibing 民兵 · changqiang 长矛手 · qingzhoubing 旧军残部 | `ai_buxingji.png` ← `ai_changqiang.png` | 2 主力战斗 |
| 6 | 盾卫（`dunwei`） | 刀盾 | daodun 刀盾 | `ai_dunwei.png` ← `ai_daodun.png` | 2 |
| 7 | 导弹车（`daodanche`） | 弩手 | gongjian 弩手 | `ai_daodanche.png` ← `ai_gongjian.png` | 2 |
| 8 | 武装直升机（`wuzhi`） | 突击摩托 | tuqibing 突击摩托 | `ai_wuzhi.png` ← `ai_tuqibing.png` | 2 |
| 9 | 主战机甲（`zhuzhan`） | 重甲战车 | tieji 装甲战车 · xiliangtieqi 重甲战车 | `ai_zhuzhan.png` ← `ai_xiliangtieqi.png` | 2 |
| 10 | 狂猎（`kuanglie`） | 王牌战车 | hubaoqi 王牌战车 · qingzhoubing 旧军残部 | `ai_kuanglie.png` ← `ai_hubaoqi.png` | 3 尖端武装 |
| 11 | 电磁盾卫（`dianci`） | 防暴甲兵 | tengjiabing 防暴甲兵 | `ai_dianci.png` ← `ai_tengjiabing.png` | 3 |
| 12 | 自行火炮（`huopao`） | 迫击炮 | toudan 迫击炮 · chongche 破门车 | `ai_huopao.png` ← `ai_toudan.png` | 3 |
| 13 | 无人轰炸机（`wuren`） | 重弩车 | chuangnu 重弩车 | `ai_wuren.png` ← `ai_chuangnu.png` | 3 |
| 14 | 泰坦机甲（`taitan`） | 变异巨兽 | nanjiangxiangbing 变异巨兽 | `ai_taitan.png` ← `ai_nanjiangxiangbing.png` | 3 |

**结构换代**：`cat`（inf/cav）退役 → `grp`（1/2/3 分页依据）+ `ride`（原 cav 显式化，供 `spdMultOf` 读）；
分页键 `inf`/`cav` 退役 → `g1`/`g2`/`g3`（面板共四页：`que` 队列 / `g1` / `g2` / `g3`）。
**未继承的 4 张旧位图**（已备份到 `.workbuddy/backup/v89229c9/troop_png/`）：
`ai_yibing.png` · `ai_chongche.png` · `ai_tieji.png` · `ai_qingzhoubing.png`。
'''
    with io.open(p, 'a', encoding='utf-8', newline='') as f:
        f.write(sec)
    LOG.append('##### 术语映射表：补录「兵种 18→14」段')

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c19_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
