# -*- coding: utf-8 -*-
"""v89.229c9b：补齐 c9 三段（锚点缩进写错为 4 空格，实际 6 空格）"""
import io, os, re, sys

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'smoke-test.js')


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []


def rep(tag, old, new, mark):
    s = rd(P)
    if mark in s:
        LOG.append('[skip] ' + tag); return True
    c = s.count(old)
    if c != 1:
        LOG.append('[FAIL] ' + tag + ' count=' + str(c)); return False
    wr(P, s.replace(old, new)); LOG.append('[ok]   ' + tag); return True


IND = '      '   # 6 空格 = check( 体内的缩进

rep('g5 §163 表序即分组序',
    "    check('§163 排序保持 + 卡面显示（步行机「10秒」/ 导弹车「1分」/ 泰坦机甲「5分」）', (function () {\n"
    "      var inf = ['buxingji', 'banche', 'zhencha', 'kuanglie', 'buxingji', 'dianci', 'dunwei', 'daodanche'];\n"
    "      for (var i = 1; i < inf.length; i++) if (DATA.TROOPS[inf[i]].time < DATA.TROOPS[inf[i - 1]].time) return false;\n"
    "      var cav = ['wuzhi', 'kuanglie', 'fujiche', 'yunshu', 'zhuzhan', 'zhuzhan', 'taitan'];\n"
    "      for (var j = 1; j < cav.length; j++) if (DATA.TROOPS[cav[j]].time < DATA.TROOPS[cav[j - 1]].time) return false;\n"
    "      return U.dur(DATA.TROOPS.buxingji.time) === '10秒' && U.dur(DATA.TROOPS.daodanche.time) === '1分'\n"
    "        && U.dur(DATA.TROOPS.taitan.time) === '5分';\n"
    "    })());",
    "    check('§163 表序即分组序（grp 连续块 · 无交错）+ 卡面显示（步行机「30秒」/ 导弹车「1分」/ 泰坦机甲「5分」）', (function () {\n"
    "      /* v89.229（兵种重构）**规则变更**：旧的\"同类内按时长升序\"排序断言随分页重构退役 ——\n"
    "         新表序 = 老板给定的三组分页序（后勤支援 4 / 主力战斗 5 / 尖端武装 5），\n"
    "         组块**连续**才是新口径的不变量（面板按表序渲染 · 组页互斥）。 */\n"
    "      var ids = Object.keys(DATA.TROOPS), cnt = {}, seq = [];\n"
    "      var last = null;\n"
    "      for (var i = 0; i < ids.length; i++) {\n"
    "        var g = DATA.TROOPS[ids[i]].grp;\n"
    "        if (g !== last) {\n"
    "          if (seq.indexOf(g) >= 0) return false;        /* 同组再出现 = 交错 */\n"
    "          seq.push(g); last = g;\n"
    "        }\n"
    "        cnt[g] = (cnt[g] || 0) + 1;\n"
    "      }\n"
    "      for (var k = 0; k < seq.length; k++) if (seq[k] !== k + 1) return false;\n"
    "      return seq.length === 3 && cnt[1] === 4 && cnt[2] === 5 && cnt[3] === 5\n"
    "        && U.dur(DATA.TROOPS.buxingji.time) === '30秒' && U.dur(DATA.TROOPS.daodanche.time) === '1分'\n"
    "        && U.dur(DATA.TROOPS.taitan.time) === '5分';\n"
    "    })());",
    '§163 表序即分组序（grp 连续块')

rep('g6 §164② 五条对齐关系换代',
    "    check('§164② ★ 狂猎=步行机 · 盾卫=电磁盾卫 · 伏击车=狂猎 · 主战机甲=主战机甲 · 武装直升机>导弹车', (function () {\n"
    "      var T = DATA.TROOPS;\n"
    "      return T.kuanglie.time === T.buxingji.time\n"
    "        && T.dunwei.time === T.dianci.time\n"
    "        && T.fujiche.time === T.kuanglie.time\n"
    "        && T.zhuzhan.time === T.zhuzhan.time\n"
    "        && T.wuzhi.time > T.daodanche.time;\n"
    "    })(), '旧军/步行机 ' + DATA.TROOPS.kuanglie.time + ' · 盾卫/电磁盾卫 ' + DATA.TROOPS.dunwei.time\n"
    "      + ' · 武装直升机 ' + DATA.TROOPS.wuzhi.time + '>导弹车 ' + DATA.TROOPS.daodanche.time\n"
    "      + ' · 伏击车/狂猎 ' + DATA.TROOPS.fujiche.time + ' · 主战机甲/主战机甲 ' + DATA.TROOPS.zhuzhan.time)",
    "    check('§164②/§229 ★ 征兵时长承原型：狂猎=伏击车 · 盾卫=电磁盾卫 · 武装直升机>导弹车 · 主战机甲>步行机 · 泰坦机甲最慢', (function () {\n"
    "      /* v89.229（兵种重构）**规则变更**：五条对齐关系的锚点随 18→14 换代 ——\n"
    "         合并后仍成立的是\"原型对\"：狂猎=王牌战车 70 = 伏击车=摩托游骑 70 ·\n"
    "         盾卫 35 = 电磁盾卫=防暴甲兵 35 · 武装直升机=突击摩托 65 > 导弹车=弩手 60 ·\n"
    "         主战机甲=重甲战车 150 > 步行机=长矛手 30 · 泰坦机甲=变异巨兽 300 = 全表最慢。 */\n"
    "      var T = DATA.TROOPS;\n"
    "      return T.kuanglie.time === T.fujiche.time\n"
    "        && T.dunwei.time === T.dianci.time\n"
    "        && T.wuzhi.time > T.daodanche.time\n"
    "        && T.zhuzhan.time > T.buxingji.time\n"
    "        && T.taitan.time > T.zhuzhan.time\n"
    "        && Object.keys(T).every(function (id) { return T[id].time <= T.taitan.time; });\n"
    "    })(), '狂猎/伏击车 ' + DATA.TROOPS.kuanglie.time + ' · 盾卫/电磁盾卫 ' + DATA.TROOPS.dunwei.time\n"
    "      + ' · 武装直升机 ' + DATA.TROOPS.wuzhi.time + '>导弹车 ' + DATA.TROOPS.daodanche.time\n"
    "      + ' · 主战机甲 ' + DATA.TROOPS.zhuzhan.time + '>步行机 ' + DATA.TROOPS.buxingji.time\n"
    "      + ' · 泰坦机甲 ' + DATA.TROOPS.taitan.time + '（全表最慢）')",
    '§164②/§229 ★ 征兵时长承原型')

rep('g8 §180① 三器械 mech',
    "    check('§180① 拆械表：无人轰炸机 vsMech=3 · 四器械 mech 标签 · 非器械零污染', (function () {\n"
    "      var T = DATA.TROOPS;\n"
    "      var mechIds = Object.keys(T).filter(function (k) { return T[k].mech; }).sort();\n"
    "      return T.wuren.vsMech === 3\n"
    "        && mechIds.join(',') === 'huopao,wuren,huopao,yunshu'\n"
    "        && !T.buxingji.mech && !T.fujiche.mech && !T.daodanche.mech;\n"
    "    })());",
    "    check('§180① 拆械表：无人轰炸机 vsMech=3 · 三器械 mech 标签（四原型合并）· 非器械零污染', (function () {\n"
    "      /* v89.229（兵种重构）：mech 集合随 18→14 换代 —— 破门车+迫击炮 合并为自行火炮\n"
    "         → 器械从四项变三 id（huopao / wuren / yunshu），集合语义不变。 */\n"
    "      var T = DATA.TROOPS;\n"
    "      var mechIds = Object.keys(T).filter(function (k) { return T[k].mech; }).sort();\n"
    "      return T.wuren.vsMech === 3\n"
    "        && mechIds.join(',') === 'huopao,wuren,yunshu'\n"
    "        && !T.buxingji.mech && !T.fujiche.mech && !T.daodanche.mech;\n"
    "    })());",
    '三器械 mech 标签（四原型合并）')

# ---------------------------------------------------------------- 自检（与备份基线比）
def braces(p):
    s = rd(p)
    return len(re.findall(r'(?<![\\^])\{', s)) - len(re.findall(r'(?<![\\^])\}', s))


b0 = braces(os.path.join(ROOT, '.workbuddy', 'backup', 'v89229c9', 'smoke-test.js'))
b1 = braces(P)
LOG.append('花括号差值 当前=' + str(b1) + ' 基线=' + str(b0) + '（应相等：裸计数含字符串/正则里的括号）')
s = rd(P)
for pat in ['//s*', '\\\\u{', 'undefinedundefined']:
    if pat in s:
        LOG.append('!!! 坏值模式 ' + pat)
if b1 != b0:
    LOG.append('!!! 括号差值变化 —— 需人工核查')

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c9b_report.txt'), 'w', encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
