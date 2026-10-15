# -*- coding: utf-8 -*-
"""v89.140 批一：data.js（夜明珠全地形）+ domain.js（挑选出口 + 状态锁扩充）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:30]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp140'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:50]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


# ══════ data.js ══════
patch('js/data.js', [
    ("""    jewelChance: 0.18,        /* 基础掉率（每队每轮收获掷一次） */""",
     """    /* v89.140（老板 10）：「夜明珠设置为在**所有野地**都有几率出现」——
       与地形表/等级门槛**无关**的一路：命中珠宝后再掷一次，按 jewelAnywhereP 改判为夜明珠
       （数量仍按野地等级算）。于是任意地形、任意等级的野地都有小概率出这颗"顶级珠"。 */
    jewelAnywhere: ['yemingzhu'],
    jewelAnywhereP: 0.05,     /* 命中珠宝后改判为夜明珠的概率（5%） */
    jewelChance: 0.18,        /* 基础掉率（每队每轮收获掷一次） */""",
     'jewelAnywhere'),
], ['jewelAnywhereP'])

# ══════ domain.js ══════
patch('js/domain.js', [
    # ① 挑选出口：加"全地形珠"分支
    ("""  GAME.gatherJewelPick = function (terrain, lv, rnd) {
    var G = DATA.GATHER;
    var jt = (G.jewelTable || {})[terrain] || [];
    if (!jt.length) return null;
    var avail = jt.filter(function (jid) {
      return (lv || 0) >= (((G.jewelMinLv || {})[jid]) || 1);
    });
    if (!avail.length) return null;
    var r = (rnd || Math.random)();
    var rp = G.jewelRareP || 0, mp = G.jewelMidP || 0;
    var idx = 0;
    if (avail.length >= 3) idx = (r < rp) ? 2 : ((r < rp + mp) ? 1 : 0);
    else if (avail.length === 2) idx = (r < rp) ? 1 : 0;
    return { id: avail[idx], n: 1 + Math.floor((lv || 0) * (G.jewelCountPerLv || 0)) };
  };""",
     """  GAME.gatherJewelPick = function (terrain, lv, rnd) {
    var G = DATA.GATHER;
    var rr = rnd || Math.random;
    var n0 = 1 + Math.floor((lv || 0) * (G.jewelCountPerLv || 0));
    /* v89.140（老板 10）：**全地形珠**（夜明珠）—— 与地形表/等级门槛无关的一路：
       命中珠宝后再掷一次，按 jewelAnywhereP 直接改判（"所有野地都有几率出现"）。
       放在最前：连"该地形本无珠宝"（如平地）也能沾到这一点点运气？——**不**：
       平地保持无珠宝（原版铁律），全地形珠只在**可采地形**内生效。 */
    var jt = (G.jewelTable || {})[terrain] || [];
    if (!jt.length) return null;
    var anyList = G.jewelAnywhere || [];
    if (anyList.length && rr() < (G.jewelAnywhereP || 0)) {
      return { id: anyList[Math.floor(rr() * anyList.length) % anyList.length], n: n0 };
    }
    var avail = jt.filter(function (jid) {
      return (lv || 0) >= (((G.jewelMinLv || {})[jid]) || 1);
    });
    if (!avail.length) return null;
    var r = rr();
    var rp = G.jewelRareP || 0, mp = G.jewelMidP || 0;
    var idx = 0;
    if (avail.length >= 3) idx = (r < rp) ? 2 : ((r < rp + mp) ? 1 : 0);
    else if (avail.length === 2) idx = (r < rp) ? 1 : 0;
    return { id: avail[idx], n: n0 };
  };""",
     'gatherJewelPick 全地形珠'),

    # ② 状态锁：补 garrison / battle
    ("""  GAME.marchBusyOf = function (g) {
    if (!g) return null;
    var st = g.status || 'idle';
    if (st === 'march') return '出征中';
    if (st === 'gather') return '采集中';
    return null;
  };""",
     """  GAME.marchBusyOf = function (g) {
    if (!g) return null;
    var st = g.status || 'idle';
    if (st === 'march') return '行军中';
    if (st === 'gather') return '采集中';
    /* v89.140（老板 9）：把**已出征**的全部形态补齐 —— 此前漏了两种：
       · `garrison`（驻守野地）：将领人在野地，若还能从城里再派一支，就"一个人在两处"；
       · `battle`（征战中）：主帅在战斗会话里，同上。
       补上后：出征面板的将领下拉会把它们**列出来但置灰 + 写明状态**
       （老板要的"看得见"，同时不产生"一名将领同时在两处"的数据错乱）。 */
    if (st === 'garrison') return '驻守野地';
    if (st === 'battle') return '征战中';
    return null;
  };""",
     'marchBusyOf 补状态'),
], ['驻守野地', 'jewelAnywhereP'])
print('✅ 完成：' + ' / '.join(ok))
