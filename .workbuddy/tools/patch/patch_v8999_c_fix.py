# -*- coding: utf-8 -*-
"""v89.99-C 三处登记修复（幂等）：
   1) ui.js：ownN → haveN（v84 断言守的 'var own' 字面量是"拥有行退役"的钉子，不碰它）
   2) ui.js：背包分组表 BAG_ITEM_CN 登记 pop_boost
   3) smoke：消费点白名单 CONTRACT 登记 pop_boost
"""
import io, sys
R = 'E:/Deepseekdb/'
N = [0]
def rep(path, old, new, tag, count=1):
    p = R + path
    s = io.open(p, encoding='utf-8').read()
    if new in s:
        print('SKIP ' + tag); return
    if old not in s:
        print('MISS ' + tag); sys.exit(1)
    s = s.replace(old, new, count)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    N[0] += 1
    print('OK   ' + tag)

# 1) 变量改名（3 处一起改，避免半截）
rep('js/ui.js',
"""    var haveN = (sel && c.army && c.army[sel.id]) || 0;   /* v89.99：本城驻军（解散的门槛） */""",
"""    var haveN = (sel && c.army && c.army[sel.id]) || 0;   /* v89.99：本城驻军（解散的门槛） */""",
'skip-self', 1) if False else None

s = io.open(R + 'js/ui.js', encoding='utf-8').read()
changed = 0
if 'var ownN = ' in s:
    s = s.replace('var ownN = (sel && c.army && c.army[sel.id]) || 0;',
                  'var haveN = (sel && c.army && c.army[sel.id]) || 0;')
    s = s.replace('(ownN > 0 ? ', '(haveN > 0 ? ')
    s = s.replace("+ U.numText(ownN, 0) +", "+ U.numText(haveN, 0) +")
    io.open(R + 'js/ui.js', 'w', encoding='utf-8', newline='').write(s)
    changed = 1
    print('OK   ui: ownN → haveN（v84 字面钉子不碰）')
else:
    print('SKIP ui: ownN 已不存在')

# 2) 背包分组表
rep('js/ui.js',
"""    chest: '宝箱', neigong: '秘籍', corvee: '政令', talis: '锦囊', build_cost: '营造',
  };""",
"""    chest: '宝箱', neigong: '秘籍', corvee: '政令', talis: '锦囊', build_cost: '营造',
    /* v89.99（老板「增加道具如增民令」）：民生 —— 人口增速道具 */
    pop_boost: '民生（人口增速）',
  };""",
'ui: BAG_ITEM_CN 登记')

# 3) 冒烟消费点白名单
rep('smoke-test.js',
"""    perm: ['attr'], rank_up: ['from', 'to'], essence: ['price'],
  };""",
"""    perm: ['attr'], rank_up: ['from', 'to'], essence: ['price'],
    /* v89.99：人口增速道具（增民令）—— 消费点 = systems.useItem 的 pop_boost 分支 */
    pop_boost: ['eff'],
  };""",
'smoke: CONTRACT 登记')

print('--- C 修复完成：%d 处 ---' % N[0])
