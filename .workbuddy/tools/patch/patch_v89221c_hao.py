# -*- coding: utf-8 -*-
"""v89.221c · 绰号更换：WILD_LORD_TITLE → 末日废土称呼

老板令：「2.绰号更换，改成末日废土相关的称呼」。
占野者（野地/据点的"贼寇"）的绰号池由「渠帅/贼首/山君/寨主/渠魁/豪帅」
换成废土劫掠者系：劫首 / 头狼 / 巢主 / 荒枭 / 掠魁 / 悍匪。
连带：场景文案里的"贼寇/贼首"（玩家可见）一并顺化为"劫掠者/劫首"。"""
import io, sys

R = 'E:/Deepseekdb/'
def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

bad = []
def rep(path, old, new, expect=1, tag=''):
    s = rd(R + path)
    c = s.count(old)
    if c != expect:
        bad.append('%s [%s] count=%d expect=%s | %s' % (path, tag, c, expect, old[:44]))
        return
    wr(R + path, s.replace(old, new))
    print('  [ok] %s %s' % (path.split('/')[-1], (tag or old[:22])))

# ═══ 绰号池（唯一映射源） ═══
rep('js/data.js',
    "DATA.WILD_LORD_TITLE = ['渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅'];",
    "DATA.WILD_LORD_TITLE = ['劫首', '头狼', '巢主', '荒枭', '掠魁', '悍匪'];", 1, '绰号池')
rep('js/data.js',
    '/* 占野者为贼寇 / 山民，名字自成一系，不与酒馆招募的将领重名 */',
    '/* 占野者 = 废土劫掠者（v89.221 老板：绰号改末日废土称呼），\n     名字自成一系，不与酒馆招募的将领重名 */', 1, '池注释')
rep('js/data.js',
    '名字另起一池 —— 与「贼寇」（WILD_LORD_*）和「酒馆招募」都不重名',
    '名字另起一池 —— 与「劫掠者」（WILD_LORD_*）和「酒馆招募」都不重名', 1, '守将池注释')

# ═══ 场景文案（玩家可见） ═══
rep('js/data.js',
    "t: '侦察兵来报：此地盘踞着一伙贼寇，倚险扎寨，寨门大开，气焰正盛。',",
    "t: '侦察兵来报：此地盘踞着一伙劫掠者，倚险扎寨，寨门大开，气焰正盛。',", 1, '场景1')
rep('js/data.js',
    "t: '两军对圆。贼首横刀立马，扬声喝道：",
    "t: '两军对圆。劫首横刀立马，扬声喝道：", 1, '场景2')
rep('js/data.js',
    "s: '贼寇溃散，军资物资尽入囊中'",
    "s: '劫掠者溃散，军资物资尽入囊中'", 1, '场景3')

# ═══ map.js 注释 ═══
rep('js/map.js',
    '**必有**（非概率：野地贼寇可无大当家，据点是有建制的守备军）；',
    '**必有**（非概率：野地劫掠者可无大当家，据点是有建制的守备军）；', 1, '必有注')
rep('js/map.js',
    '/* 名字走守备军官系池（太守/都尉一系；与野地贼寇、酒馆招募都不重名） */',
    '/* 名字走守备军官系池（城守/武卫一系；与野地劫掠者、酒馆招募都不重名） */', 1, '军官池注')

if bad:
    print('\n❌ 失配 %d：' % len(bad))
    for b in bad: print('   ' + b)
    sys.exit(1)
print('\n✅ v89.221c 全部落盘')
