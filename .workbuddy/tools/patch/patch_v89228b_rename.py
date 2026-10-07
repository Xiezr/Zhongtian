# -*- coding: utf-8 -*-
"""v89.228 批 B：黄金→旧币 / 人口→幸存者 全站换代（js + index + smoke + e2e）。
规则：
  · 掩码保护「读需求档案的原文校验串」（档案不动，守卫保持旧词）；
  · 同人口→同兵力（战报分析语境，防「同幸存者」读感事故）；
  · 万金→万旧币；金币→旧币；黄金→旧币；人口→幸存者；
  · 「数字+金」单价写法 → 数字+旧币（dry 模式先打印全部命中供人工核）；
  · data.js 加「原名」注（沿革，按设计保留旧词各 1 处）；
  · 版本号 v89.227 → v89.228（main.js）。
用法：DRY=1 python patch_v89228b_rename.py（预检，只打印不落盘）
      python patch_v89228b_rename.py（落盘）
"""
import io, os, re

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

FILES = ['js/data.js', 'js/ui.js', 'js/domain.js', 'js/state.js', 'js/battle.js',
         'js/systems.js', 'js/main.js', 'js/questdata.js', 'index.html',
         'smoke-test.js', 'e2e-test.js']

M1 = "被收编那一刻才加人口'"      # 档案守卫 1（需求档案原文 · smoke 内 indexOf 串，含收尾引号定界）
M2 = "黄金是玩家层级通用的'"        # 档案守卫 2（同上；注意 domain/state 的引述注释是「」收尾，不在此列、照常转换）
P1, P2 = '\x01R1\x01', '\x01R2\x01'

# 数字+金 的排除后缀（这些「金」不是货币）
GOLD_TAIL = '属铁矿库钱额价贵融条牌币银铜铝万亿'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(BASE + p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(BASE + p + '.tmp', BASE + p)


report = []
for f in FILES:
    s = rd(f)
    before = {w: s.count(w) for w in ['黄金', '人口', '金币', '万金']}
    # ---- 掩码（仅 smoke：读需求档案的守卫串保持旧词）----
    if f == 'smoke-test.js':
        assert s.count(M1) == 1, 'M1 掩码锚点 ×%d' % s.count(M1)
        assert s.count(M2) == 1, 'M2 掩码锚点 ×%d' % s.count(M2)
        s = s.replace(M1, "被收编那一刻才加" + P1 + "'")
        s = s.replace(M2, P2 + "是玩家层级通用的'")
    # ---- 预替换（定点） ----
    s = s.replace('同人口', '同兵力')
    # ---- 主替换（顺序：长词先行） ----
    s = s.replace('万金', '万旧币')
    s = s.replace('金币', '旧币')
    s = s.replace('黄金', '旧币')
    s = s.replace('人口', '幸存者')
    # ---- 数字+金 单价写法 ----
    pat = re.compile(r'([0-9])(\s*)金(?![' + GOLD_TAIL + '])')
    matches = [s[max(0, m.start() - 14):m.end() + 12].replace('\n', ' ') for m in pat.finditer(s)]
    n_gold = len(matches)
    s = pat.sub(r'\1\2旧币', s)
    if DRY and matches:
        print('  [%s] 数字金 命中 %d 处：' % (f, n_gold))
        for h in matches[:30]:
            print('     | %s' % h)
    # ---- 解掩码 ----
    s = s.replace(P1, '人口').replace(P2, '黄金')
    # ---- data.js 原名注 ----
    if f == 'js/data.js':
        old_line = "    { key: 'gold',  name: '旧币', icon: '💰', color: '#e6a400' },"
        new_line = "    { key: 'gold',  name: '旧币', icon: '💰', color: '#e6a400' },   /* v89.228 更名：原名「黄金」 */"
        assert s.count(old_line) == 1, 'gold 行锚点'
        s = s.replace(old_line, new_line)
        old_line2 = "    { key: 'pop',   name: '幸存者', icon: '👥', color: '#9fd6a0' },"
        new_line2 = "    { key: 'pop',   name: '幸存者', icon: '👥', color: '#9fd6a0' },   /* v89.228 更名：原名「人口」 */"
        assert s.count(old_line2) == 1, 'pop 行锚点'
        s = s.replace(old_line2, new_line2)
    # ---- 版本号 ----
    if f == 'js/main.js':
        assert s.count("GAME.VERSION = 'v89.227'") == 1, 'version 锚点'
        s = s.replace("GAME.VERSION = 'v89.227'", "GAME.VERSION = 'v89.228'")
    after = {w: s.count(w) for w in ['黄金', '人口', '金币', '万金']}
    report.append((f, before, after, n_gold))
    if not DRY:
        wr(f, s)

print('%-16s %-42s %-34s %s' % ('文件', '改前(黄金/人口/金币/万金)', '改后', '数字金'))
for f, b, a, n in report:
    print('%-16s %-42s %-34s %d' % (f, str(list(b.values())), str(list(a.values())), n))

# 期望（终态）：
#   smoke：黄金=1 人口=1（两处档案守卫，解掩码还原）
#   data：黄金=1 人口=1（原名注）
#   其余：0/0
if not DRY:
    import sys
    ok = True
    for f, b, a, n in report:
        if f == 'smoke-test.js':
            exp = {'黄金': 1, '人口': 1, '金币': 0, '万金': 0}
        elif f == 'js/data.js':
            exp = {'黄金': 1, '人口': 1, '金币': 0, '万金': 0}
        else:
            exp = {'黄金': 0, '人口': 0, '金币': 0, '万金': 0}
        if a != exp:
            ok = False
            print('⛔ %s 终态不符: %s（期望 %s）' % (f, a, exp))
    assert ok, '终态计数校验失败'
    print('自检通过：终态计数全部符合设计（smoke/data 各留档案守卫与原名注）')
print('B DONE%s' % ('（DRY）' if DRY else ''))
