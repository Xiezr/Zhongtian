# -*- coding: utf-8 -*-
# v89.136 批5-a：domain.js —— 出征战术细分（掠夺/占领）+ 校场练兵域函数退役
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)
def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点 = ' + str(n)
    return s.replace(old, new)

d = rd('js/domain.js')

# ============================================================
# ① tacticsOf：补 raid/occupy 细分表
# ============================================================
old1 = """    T.atk = T.atk || {};
    T.def = T.def || {};
    return side === 'def' ? T.def : T.atk;
  };"""
new1 = """    T.atk = T.atk || {};
    T.def = T.def || {};
    /* v89.136（老板 4）：「出征战术细分掠夺，占领，分别允许进行相应的默认战术设置」——
       新增两张**出征细分表**（空表 = 沿用通用 atk；'raid'/'occupy' 是写入/展示键）。
       战斗读取走 `GAME.tacticsFor`（细分覆盖通用 · 逐兵种回退）。 */
    T.raid = T.raid || {};
    T.occupy = T.occupy || {};
    if (side === 'raid' || side === 'occupy') return T[side];
    return side === 'def' ? T.def : T.atk;
  };
  /* v89.136（老板 4）：出征战斗的**唯一读口** —— 细分覆盖通用（逐兵种回退）。
     · modeId = 'raid' / 'occupy'（其余一律按占领：scout 不开战，不入此路）；
     · 返回**新对象**（只读视图 —— 写入走 tacticsOf(side)/setTactic，勿写回本对象）。 */
  GAME.tacticsFor = function (modeId) {
    var base = GAME.tacticsOf('atk');
    var sub = GAME.tacticsOf(modeId === 'raid' ? 'raid' : 'occupy');
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(sub).forEach(function (k) { out[k] = sub[k]; });
    return out;
  };"""
d = rep1(d, old1, new1, '① tacticsOf')

# ============================================================
# ② tacticOf 的 atk 分支：改读合并视图（ctx.modeId）
# ============================================================
old2 = """    var m = GAME.tacticsOf('atk')[troopId];"""
new2 = """    /* v89.136（老板 4）：出征读"细分覆盖通用"（ctx.modeId = raid/occupy；缺省按占领） */
    var m = GAME.tacticsFor((ctx && ctx.modeId) || 'occupy')[troopId];"""
d = rep1(d, old2, new2, '② tacticOf')

# ============================================================
# ③ setTactic：值域扩展
# ============================================================
old3 = """    if (a === 'atk' || a === 'def') { side = a; troopId = b; patch = c; }"""
new3 = """    if (a === 'atk' || a === 'def' || a === 'raid' || a === 'occupy') { side = a; troopId = b; patch = c; }"""
d = rep1(d, old3, new3, '③ setTactic')

# ============================================================
# ④ tacticSummary：细分支持
# ============================================================
old4 = """  GAME.tacticSummary = function (side) {
    side = side === 'def' ? 'def' : 'atk';
    var m = GAME.tacticsOf(side);
    var ids = Object.keys(m);
    if (!ids.length) return side === 'def' ? '未设（默认：迎击 / 攻城固守）' : '全体前进（默认）';"""
new4 = """  GAME.tacticSummary = function (side) {
    var isSub = (side === 'raid' || side === 'occupy');
    if (!isSub) side = side === 'def' ? 'def' : 'atk';
    var m = isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side);
    var ids = Object.keys(m);
    if (!ids.length) return side === 'def' ? '未设（默认：迎击 / 攻城固守）'
      : (isSub ? '未设（沿用通用 · 默认全线前进）' : '全体前进（默认）');"""
d = rep1(d, old4, new4, '④ tacticSummary')

# ============================================================
# ⑤ clearTactics：细分支持
# ============================================================
old5 = """  GAME.clearTactics = function (side) {
    side = side === 'def' ? 'def' : 'atk';
    var T = GAME.tacticsOf(side);
    /* 原地清空（别换对象 —— 别处可能持有引用） */
    Object.keys(T).forEach(function (k) { delete T[k]; });
    return { ok: true,
      msg: side === 'def'
        ? '已恢复默认防守战术（全体迎击 / 攻城固守）'
        : '已恢复默认战术（全军前进）' };
  };"""
new5 = """  GAME.clearTactics = function (side) {
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var T = GAME.tacticsOf(side);
    /* 原地清空（别换对象 —— 别处可能持有引用） */
    Object.keys(T).forEach(function (k) { delete T[k]; });
    return { ok: true,
      msg: side === 'def' ? '已恢复默认防守战术（全体迎击 / 攻城固守）'
        : side === 'raid' ? '已恢复默认掠夺战术（沿用通用 / 默认全线前进）'
        : side === 'occupy' ? '已恢复默认占领战术（沿用通用 / 默认全线前进）'
        : '已恢复默认战术（全军前进）' };
  };"""
d = rep1(d, old5, new5, '⑤ clearTactics')

# ============================================================
# ⑥ xc 簇退役：注释块 + 函数组（到「训练进度（城）」前）
# ============================================================
s0 = d.find('  /* ============================================================\n   * 校场 · 练兵（v89.80）—— 唯一出口组')
assert s0 > 0, 'xc 注释块未找到'
s1 = d.find('  /* 训练进度（城） */')
assert s1 > s0, 'xc 结束标记未找到'
grave = """  /* ⛔ v89.136 移除：**校场练兵**全组 —— 老板第 4 条「不要练兵 · 校场这个菜单和演武和阅兵，
     相应功能去除」。退役清单：
       · 域：`GAME.xcCfg / xcDay / xcSparCostOf / xcSparDoneToday / xcReviewDoneToday /
         xcSpar / xcReview`（本段整组）；
       · 界面：`ui.trainBlockHTML`（练兵块 · 墓碑见 ui.js）；
       · 动作：`case 'xc-spar' / 'xc-review' / 'xc-gen-pick'`（墓碑见 main.js）；
       · 数据：`DATA.XIAOCHANG`（墓碑见 data.js）。
     历史存档里的 `s.xcDay`（每日次数）不再被读 —— 无害残留，不做迁移（无消费点）。 */
"""
d = d[:s0] + grave + d[s1:]

# ---------- 写后自检 ----------
for sent in ['GAME.tacticsFor = function', "T.raid = T.raid || {};", '⛔ v89.136 移除：**校场练兵**全组',
             "GAME.tacticsFor((ctx && ctx.modeId) || 'occupy')[troopId]"]:
    assert d.count(sent) >= 1, '丢失哨兵: ' + sent
for gone in ['GAME.xcCfg = function', 'GAME.xcSpar = function', 'GAME.xcReview = function',
             'GAME.xcDay = function']:
    assert gone not in d, 'xc 残留: ' + gone

import re, io as _io
_before = _io.open(ROOT + 'js/domain.js', 'r', encoding='utf-8', newline='').read()
def _bd(x):
    return (len(re.findall(r'(?<![\^\\])\{', x)) - len(re.findall(r'(?<![\^\\])\}', x)))
print('braces diff before/after =', _bd(_before), _bd(d))
assert _bd(_before) == _bd(d), '花括号净差变了'

wr('js/domain.js', d)
print('OK · domain.js', len(d))
