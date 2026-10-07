# -*- coding: utf-8 -*-
"""v89.224b2b：注释残留清理 + seedLv→dropLv 变量修复（b2 遗留）。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b2b'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)
def rep(f, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    assert c == cnt, '[%s] 锚点计数 %d != %d :: %r' % (f, c, cnt, old[:80])
    wr(f, s.replace(old, new))
    LOG.append('%s ×%d :: %s' % (f, cnt, old[:44].replace('\n', '⏎')))

# battle.js：boost 掉落仍读 seedLv —— 已改名 dropLv，必须同步（否则运行时 ReferenceError）
rep('js/battle.js', 'var boostLoot = GAME.grantBoostDrop(seedLv,', 'var boostLoot = GAME.grantBoostDrop(dropLv,')
rep('js/battle.js', '与种子/精华同构，只掷 BOOST_DROP 表。 */', '与精华掉落同构，只掷 BOOST_DROP 表。 */')

# domain.js
rep('js/domain.js', "          && it.type !== 'seed'   /* v78：种子走 grantSeedDrop 专属口，不进宝物随机池 */\n", "")
rep('js/domain.js', '     与 grantSeedDrop 同构（表在 DATA.ESSENCE_DROP，调平衡只改数据）。',
    '     与 BOOST_DROP 同构（表在 DATA.ESSENCE_DROP，调平衡只改数据）。')
rep('js/domain.js', '     **唯一出口**（与 grantSeedDrop / grantEssenceDrop 同构，表在 DATA.BOOST_DROP）。',
    '     **唯一出口**（与 grantEssenceDrop 同构，表在 DATA.BOOST_DROP）。')
rep('js/domain.js', '   /* v89.73：酒馆封顶英杰（名世/天授只走药草升档） */', '   /* v89.73：酒馆封顶进化体（觉醒体/天启体只走血清升档） */')

# data.js
rep('js/data.js', '（种子/征调令除外，它们另有渠道）', '（征调令除外，它另有渠道）')
rep('js/data.js', '与 SEED_DROP / ESSENCE_DROP 同构（GAME.grantBoostDrop 唯一出口，调平衡只改这张表）。',
    '与 ESSENCE_DROP 同构（GAME.grantBoostDrop 唯一出口，调平衡只改这张表）。')
rep('js/data.js', '     调平衡只改这张表（与 SEED_DROP 同构：数据驱动，别处不许另起概率）。 */',
    '     调平衡只改这张表（与 BOOST_DROP 同构：数据驱动，别处不许另起概率）。 */')

# ui.js
rep('js/ui.js', '「有价但不在任何页签」的类型（营造/种子/药草）', '「有价但不在任何页签」的类型（营造等）')
rep('js/ui.js', '不想卖（种子/药草，price 仅供背包「估值」）', '不想卖（血清等，price 仅供背包「估值」）')
rep('js/ui.js', '名世 / 天授不直接招募，只能靠<b>药草升档</b>。', '觉醒体 / 天启体不直接招募，只能靠<b>血清升档</b>。')
rep('js/ui.js', '药草 / 辐能核心无购买价，不参与寄售。', '血清 / 辐能核心无购买价，不参与寄售。')
rep('js/ui.js',
    '**资质晋升**一行 —— 下一档 / 所需药草 / 持有数 / 一步到位。\n       改前资质链在界面上没有任何入口（酒馆只写"名世/天授只能靠药草升档"，\n       却不说药草从哪来；实测连推演侧都不知道种子已在游商开售）。 */',
    '**资质晋升**一行 —— 下一档 / 所需血清 / 持有数 / 一步到位。\n       改前资质链在界面上没有任何入口（酒馆只写"觉醒体/天启体只能靠血清升档"，\n       却不说血清从哪来）。 */')

# systems.js
rep('js/systems.js', '      /* v73（基因实验室）：资质药草 —— 校验与升档走唯一出口 GAME.rankUpUse */',
    '      /* v73（基因实验室）：资质血清 —— 校验与升档走唯一出口 GAME.rankUpUse */')

# e2e 注释
rep('e2e-test.js', '  /* v82（老板）/v89.135：征收退役 + 政务厅功能直显（改名/主城/遗迹） */',
    '  /* v82（老板）/v89.135：征收退役 + 政务厅功能直显（改名/主城；v89.224 起实验室撤出本段） */')

# 核验：battle.js seedLv 应归零
if not DRY:
    s = rd('js/battle.js')
    assert s.count('seedLv') == 0, 'battle.js 仍有 seedLv %d 处' % s.count('seedLv')
    print('[核验] battle.js seedLv → 0 ✓')

print('[b2b] %d 处' % len(LOG))
for l in LOG: print('  ' + l)
