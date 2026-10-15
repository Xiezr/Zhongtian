# -*- coding: utf-8 -*-
"""v89.4 引擎 —— js/state.js：
① jianghuCands（候选）+ jianghuActsAt(x,y) 逐地确定性分布
② jianghuCheck 加"此事不在本格"闸门
③ jianghuRoll 等级联动（难度 / 负伤 / 收益）
"""
import io

P = r'E:\Deepseekdb\js\state.js'
d = io.open(P, encoding='utf-8', newline='').read()
applied = 0

def rep(old, new, tag):
    global d, applied
    if new in d:
        print('SKIP', tag, '（已落）')
        return
    c = d.count(old)
    if c != 1:
        raise SystemExit('!! %s 锚点异常（出现 %d 次）' % (tag, c))
    d = d.replace(old, new, 1)
    applied += 1
    print('OK', tag)

# ① 候选 + 逐地分布
rep(
r"""  GAME.jianghuActsAt = function (terrain) {
    var out = [];
    Object.keys(DATA.LING_ACT || {}).forEach(function (id) {
      var a = DATA.LING_ACT[id];
      if (a.spots && a.spots.indexOf(terrain) >= 0) out.push({ id: id, def: a });
    });
    return out;
  };""",
r"""  /* v89.4：候选（某地形上"理论上"可能发生的全部活动）—— 分布与测试共用 */
  GAME.jianghuCands = function (terrain) {
    var out = [];
    Object.keys(DATA.LING_ACT || {}).forEach(function (id) {
      var a = DATA.LING_ACT[id];
      if (a.spots && a.spots.indexOf(terrain) >= 0) out.push({ id: id, def: a });
    });
    return out;
  };
  /* v89.4：逐地分布 —— 某格的活动组合 = 格子坐标的确定性函数（同格恒同貌）。
     ① 荒僻率：不是所有野地都有活动；② 有事格 1~3 事（按候选洗牌裁剪）。 */
  GAME.jianghuActsAt = function (x, y) {
    var tile = GAME.map.tile(x, y);
    if (!tile) return [];
    var cands = GAME.jianghuCands(tile.terrain);
    if (!cands.length) return [];
    var sp = DATA.JH_SPREAD || {};
    var r = function (salt) { return GAME.invasionRoll('jhsp|' + x + ',' + y + '|' + salt); };
    var roll0 = r('any');
    if (roll0 < (sp.noneP != null ? sp.noneP : 0.3)) return [];
    var want = roll0 < (sp.p2 != null ? sp.p2 : 0.62) ? 1
      : (roll0 < (sp.p3 != null ? sp.p3 : 0.87) ? 2 : 3);
    var list = cands.slice().sort(function (a2, b2) { return r('o:' + a2.id) - r('o:' + b2.id); });
    return list.slice(0, Math.min(want, list.length));
  };""",
'① 分布引擎')

# ② 闸门（地形门之后）
rep(
r"""    if (!a.spots || a.spots.indexOf(tile.terrain) < 0) {
      return { ok: false, msg: ((DATA.TERRAIN[tile.terrain] || {}).name || '此地') + '做不了「' + a.name + '」' };
    }""",
r"""    if (!a.spots || a.spots.indexOf(tile.terrain) < 0) {
      return { ok: false, msg: ((DATA.TERRAIN[tile.terrain] || {}).name || '此地') + '做不了「' + a.name + '」' };
    }
    /* v89.4：逐地分布闸门 —— 此处野地今日并没有这桩事（随缘而现） */
    var avail4 = false;
    GAME.jianghuActsAt(x, y).forEach(function (k) { if (k.id === actId) avail4 = true; });
    if (!avail4) return { ok: false, msg: '此处野地无「' + a.name + '」—— 江湖之事随缘而现，换一处看看' };""",
'② 判定闸门')

# ③ 等级联动（系数）
rep(
r"""    /* v89：剧本修正系数（缺省时与 v88 结果逐位一致 —— 可复现不变式） */
    var mo = mods || {};
    var mPow = mo.pow || 1, mRw = mo.reward || 1, mWound = mo.wound || 1, mLuck = mo.luck || 0;
    var mi = function (n) { return Math.max(1, Math.round(n * mRw)); };
    var mw = function (n) { return Math.max(1, Math.round(n * mWound)); };""",
r"""    /* v89：剧本修正系数 · v89.4：野地等级联动 —— 难度 / 负伤 / 收益随 lv 增长
       （系数全走 DATA.JH_SPREAD；种子与「同选择同结果」不变式不受影响。
         lv=0 时与 v88 逐位一致） */
    var sp4 = DATA.JH_SPREAD || {};
    var lvN = 1 + lv * (sp4.lvNeed || 0);
    var lvR = 1 + lv * (sp4.lvRew || 0);
    var lvW = 1 + lv * (sp4.lvDmg || 0);
    var mo = mods || {};
    var mPow = mo.pow || 1, mRw = mo.reward || 1, mWound = mo.wound || 1, mLuck = mo.luck || 0;
    var mi = function (n) { return Math.max(1, Math.round(n * mRw * lvR)); };
    var mw = function (n) { return Math.max(1, Math.round(n * mWound * lvW)); };""",
'③ 等级联动系数')

# ④ 战斗难度
rep(
"      var need = a.power * (1 + lv * 0.35);",
"      var need = a.power * lvN;",
'④ 战斗难度')

# ⑤ 试炼难度
rep(
"        var nd = a.power * (1 + lv * 0.35) * (1 + (i - 1) * 0.45);",
"        var nd = a.power * lvN * (1 + (i - 1) * 0.45);",
'⑤ 试炼难度')

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('state.js 完成：应用 %d 处' % applied)
