# -*- coding: utf-8 -*-
"""patch_play_600x_v6.py — 幂等终修（正式跑前的最后补丁）。

① 采集取兵顺序补上骑兵/刀盾（此前 c0 只剩青骑 → takeArmy 取 0 → 静默不出队）
② 新城增援：transfer 调兵（统一行军通道）—— 新城墙 0 被流寇当提款机
③ 种子购买阈值 300k → 120k（市场售粮已把金养起来，灵田别荒）
"""
import io

P = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_600x.js'
s = io.open(P, encoding='utf-8', newline='').read()

def rep_if(old, new, tag, marker):
    global s
    if marker in s:
        print('SKIP %s (already)' % tag)
        return
    c = s.count(old)
    assert c == 1, '%s: old count=%d (期望 1)' % (tag, c)
    s = s.replace(old, new, 1)
    print('OK   %s' % tag)

# ① 采集取兵顺序
rep_if(
"""  var tkG = takeArmy(c0, 300, ['minfu', 'yibing', 'changqiang']);
  if (tkG.total < 50) return;
  var army = tkG.army;""",
"""  var tkG = takeArmy(c0, 300, ['minfu', 'yibing', 'changqiang', 'daodun', 'gongjian', 'qingji']);
  if (tkG.total < 50) { noteSoft('gather.noarmy', '城内取不出采集兵（清点各兵种）'); return; }
  var army = tkG.army;""",
'V6-1-gather', "gather.noarmy")

# ② 新城增援（transfer 调兵）
rep_if(
"""/* 5.5d 市场售粮换金（设计内的黄金入口：粮→金，平价恒定 ≈ 1 金 / 6.7 粮） */""",
"""/* 5.5c2 新城增援：以旧城之兵，补新城之虚（transfer 统一行军通道） */
var REINF_LAST = -1e9;
function tryReinforce() {
  if (st.cities.length < 2) return;
  if (tNow - REINF_LAST < 480) return;
  var main = st.cities[0];
  for (var i = 1; i < st.cities.length; i++) {
    var c = st.cities[i];
    if (armyAll(c.army) >= 400) continue;
    if (armyAll(main.army) < 900) return;
    var gen = idleGen(true); if (!gen) return;
    setCity(main);
    var tk = takeArmy(main, 500);
    if (tk.total < 300) return;
    var r = safeCall('reinforce', function () { return G.march.dispatch({ kind: 'owncity', id: c.id }, 'transfer', tk.army, gen.id); });
    REINF_LAST = tNow;
    if (r && r.ok) noteSoft('reinforce.ok', '调兵 ' + tk.total + ' → ' + c.name);
    if (r && !r.ok) noteSoft('reinforce', r.msg);
    return;
  }
}

/* 5.5d 市场售粮换金（设计内的黄金入口：粮→金，平价恒定 ≈ 1 金 / 6.7 粮） */""",
'V6-2-reinforce', 'tryReinforce')

rep_if(
"""    safeCall('b.withdraw', tryWithdraw);""",
"""    safeCall('b.withdraw', tryWithdraw);
    safeCall('b.reinforce', tryReinforce);""",
'V6-3-call', "safeCall('b.reinforce'")

# ③ 种子阈值
rep_if(
"""  if ((st.items.seed_fan || 0) < 2 && (st.res.gold || 0) > 300000 && G.farmOf().plots.some(function (p) { return !p; })) {""",
"""  if ((st.items.seed_fan || 0) < 2 && (st.res.gold || 0) > 120000 && G.farmOf().plots.some(function (p) { return !p; })) {""",
'V6-4-seed', '(st.res.gold || 0) > 120000')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ALL DONE · bytes =', len(s.encode('utf-8')))
