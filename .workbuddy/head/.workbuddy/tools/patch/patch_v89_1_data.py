# -*- coding: utf-8 -*-
"""v89.1 数据：SCENE_FLOW 每活动加幕景水印 art、每幕加幕题 s（插入式；原文案零改动）。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\data.js'
d = io.open(P, encoding='utf-8', newline='').read()

ARTS = [
    ('tao', '🏕️'), ('qie', '🎋'), ('shi', '🌀'), ('cai', '🌸'), ('xiu', '☁️'), ('bai', '🍵'),
    ('hill_scene', '🚩'), ('lake_scene', '🌊'), ('zhaoze_scene', '🌫️'), ('desert_scene', '🔥'),
    ('forest_scene', '🌲'), ('caoyuan_scene', '🌤️'),
]
TITLES = [
    # tao
    '军情来报', '阵前对峙', '击鼓进兵',
    # qie
    '剑客相邀', '以武会友', '胜负一招',
    # shi
    '阵门初探', '灵压陡增', '最后一重',
    # cai
    '寻灵问草', '草间惊蛇', '满载收工',
    # xiu
    '择地入定', '心澜微动', '收束周天',
    # bai
    '叩门相访', '茶叙旧闻', '尽兴而别',
    # hill_scene
    '山道拦截', '寨中煮酒', '送别下山',
    # lake_scene
    '择处下竿', '大物咬钩', '日头偏西',
    # zhaoze_scene
    '遗痕初探', '瘴气渐起', '泥下箱角',
    # desert_scene
    '拾级而下', '石门将落', '石匣在前',
    # forest_scene
    '循迹入林', '灌木惊兽', '收弓回程',
    # caoyuan_scene
    '牧人指点', '马儿相人', '夕阳归营',
]
assert len(TITLES) == 36, len(TITLES)

if '斥候来报' in d and "tao: { art:" in d:
    print('SKIP v89.1 数据已存在')
else:
    # ① 幕景水印（每活动一处，锚在 escLabel 前）
    for act, art in ARTS:
        old = '    %s: { escLabel:' % act
        new = "    %s: { art: '%s', escLabel:" % (act, art)
        c = d.count(old)
        assert c == 1, '%s 锚点命中 %d 处' % (act, c)
        d = d.replace(old, new, 1)
    print('  art × 12 ✓')
    # ② 幕题（按文件顺序 = 活动顺序 × 3 幕，逐幕插入）
    i0 = d.find('DATA.SCENE_FLOW = {')
    i1 = d.find('window.GAME.DATA = DATA;', i0)
    assert i0 > 0 and i1 > i0
    block = d[i0:i1]
    parts = block.split("{ t: '")
    assert len(parts) == 37, '幕数 != 36：%d' % (len(parts) - 1)
    out = parts[0]
    for k in range(1, 37):
        out += "{ s: '" + TITLES[k - 1] + "', t: '" + parts[k]
    d = d[:i0] + out + d[i1:]
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.1 数据已写入')

# —— 幂等复查 ——
d2 = io.open(P, encoding='utf-8', newline='').read()
b2 = d2[d2.find('DATA.SCENE_FLOW'):d2.find('window.GAME.DATA = DATA;')]
print('art 数:', b2.count("art: '"), '(期望 12)',
      '| 幕题数:', b2.count("{ s: '"), '(期望 36)',
      '| 残留裸幕:', b2.count("{ t: '"), '(期望 0)')
