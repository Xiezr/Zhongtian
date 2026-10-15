# -*- coding: utf-8 -*-
"""v89.149 批 G1：升级 4 条被打穿的旧断言（都是口径升级，不是回归）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
BAK = 'E:/Deepseekdb/backup/v89149/smoke-test.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()


def rep(old, new, tag, cnt=1):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return
    n = s.count(old)
    assert n == cnt, '锚点数不对 [' + tag + '] count=' + str(n) + ' 期望=' + str(cnt)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① v56 经验断言：loseMul 出现在新声望表里，判据收窄到 battleExp 体内 ----------
rep("""  check('v56：只给胜方经验（battleExp 无胜负参数，EXP_RULE 无败方系数）', (function () {
    var b = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8'));
    return DATA.EXP_RULE.loseMul === undefined
      && DATA.EXP_RULE.winMul === 2
      && /GAME\\.battle\\.battleExp = function \\(defLossBy, gen\\) \\{/.test(b)
      /* 经验入口只有三个：攻占名城 / 出征胜利 / 侦察。多一个就说明有人给败方开了口 */
      && (b.match(/GAME\\.battle\\.gainExp\\(/g) || []).length === 3
      && !/loseMul/.test(b);
  })());""",
    """  check('v56：只给胜方经验（battleExp 无胜负参数，EXP_RULE 无败方系数）', (function () {
    var raw = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');
    var b = stripComment(raw);
    /* ⚠️ v89.149：声望规则表 `DATA.REP_RULE.loseMul`（战功声望的败仗折损）是**另一套规则**，
       不能拿它当"经验给败方开口"的证据 —— 判据收窄到 `battleExp` 函数体内。 */
    var segExp = stripComment(fnBody(raw, 'GAME.battle.battleExp = function'));
    return DATA.EXP_RULE.loseMul === undefined
      && DATA.EXP_RULE.winMul === 2
      && /GAME\\.battle\\.battleExp = function \\(defLossBy, gen\\) \\{/.test(b)
      /* 经验入口只有三个：攻占名城 / 出征胜利 / 侦察。多一个就说明有人给败方开了口 */
      && (b.match(/GAME\\.battle\\.gainExp\\(/g) || []).length === 3
      && segExp.length > 200 && !/loseMul/.test(segExp);
  })());""", 'v56 经验断言收窄')

# ---------- ② ⑧ 敌方默认：两侧同规 ----------
rep("""      return cq && cq.target === 'changqiang' && cq.stance === 'advance'
        && qj && qj.target === '';      /* 我方没有轻骑 → 保持"任意" */""",
    """      /* v89.149（老板 4）：默认目标改"**同兵种**"且**两侧同规** ——
         轻骑也默认打同名兵种（我方没有轻骑时，引擎选靶自然回落到"最近的敌队"，
         不再需要"对面没有就填空"的旧兜底）。 */
      return cq && cq.target === 'changqiang' && cq.stance === 'advance'
        && qj && qj.target === 'qingji';""", '⑧ 敌方默认')

# ---------- ③ 三键在读秒行：去掉 hint 列 ----------
rep("""      var iL = h.indexOf('bt-left'), iA = h.indexOf('bt-acts'), iH = h.indexOf('bt-hint');
      var okOrder = iL >= 0 && iA > iL && iH > iA;         /* 三列序：左→中→右 */""",
    """      /* v89.149（老板 6）：「不要这个备注：左侧设动作/目标」—— 右列退役，
         判据从"三列序"改"两列序 + 备注不得复活"。 */
      var iL = h.indexOf('bt-left'), iA = h.indexOf('bt-acts');
      var okOrder = iL >= 0 && iA > iL && h.indexOf('bt-hint') < 0;""", '③ 三键列序')

# ---------- ④ §128③ 布局定高：口径升级到 v89.149 ----------
rep("""    check('§128③ 战斗界面定高：wrap 不滚 · log=底部 1/2 · 示意图定高 330 · 表头无「（N 队）」', (function () {
      var okCss = /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; \\}/.test(h128)
        && /\\.bt-log \\{ flex: 0 0 50%; max-height: none; min-height: 0;/.test(h128)
        && /\\.bt-field \\{ position: relative; height: 330px;/.test(h128)
        && /\\.bt-side \\{[^}]*max-height: 330px; overflow-y: auto;/.test(h128);""",
    """    check('§128③/§149⑤ 战斗界面定高：wrap 不滚 · log=底部 1/2 · 战场条填满 board（拉到记录上方）· 表头无「（N 队）」', (function () {
      /* v89.149（老板 5）：「中间战场区域的下方拉到回合记录的上方（高度拉高）」——
         定高 330 改**填满 board 行**（grid-template-rows + align-items:stretch）；
         侧栏撤 330 上限、随行同高。 */
      var okCss = /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; \\}/.test(h128)
        && /\\.bt-log \\{ flex: 0 0 50%; max-height: none; min-height: 0;/.test(h128)
        && /\\.bt-board \\{[^}]*grid-template-rows: minmax\\(0, 1fr\\);/.test(h128)
        && /\\.bt-board \\{[^}]*align-items: stretch; \\}/.test(h128)
        && /\\.bt-field \\{ position: relative; margin: /.test(h128)
        && /\\.bt-side \\{[^}]*max-height: 100%; overflow-y: auto;/.test(h128);""", '§128③ 口径升级')

# 写后哨兵
assert 'var segExp = stripComment(fnBody(raw,' in s
assert "&& qj.target === 'qingji';" in s
assert 'h.indexOf(\'bt-hint\') < 0;' in s
assert 'grid-template-rows: minmax\\(0, 1fr\\);' in s
# ⚠️ 花括号盈亏要用"语法括号"口径（§45.7）：排除 \{ / \} 与字符类里的裸 }（[^}]）
import re as _re


def _delta(x):
    return (len(_re.findall(r'(?<![\\^])\{', x)) - len(_re.findall(r'(?<![\\^])\}', x)))


assert _delta(s) == _delta(bak), '花括号盈亏不一致（%d vs %d）' % (_delta(s), _delta(bak))
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke-test.js 落盘 · len=' + str(len(s)))
