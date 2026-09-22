# -*- coding: utf-8 -*-
"""v89.100-D：三处修复（首测暴露）
① econ 跳过军事里程碑（scout1 无兵营 → jy.idx 崩溃）
② scout1 通用防护（jy 为 null → wait，而不是崩）
③ consignBrain 的 keep 修正：整类保留晋爵珠宝（只保缺口 → 刚买齐就被按 75% 卖掉，
   每轮白亏 25% —— 首测实测"珍珠10+珊瑚5 买4000金 / 卖3000金"死循环）"""
import io, subprocess

BASE = 'E:/Deepseekdb/'
P = BASE + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
N = [0]

def rep(old, new, tag):
    global s
    if new in s:
        print('SKIP ' + tag)
        return
    assert old in s, 'MISS: ' + tag
    s = s.replace(old, new, 1)
    N[0] += 1
    print('OK   ' + tag)

# ---------- ① execMilestones：econ 跳过军事里程碑 ----------
rep("""function execMilestones() {
  for (var i = 0; i < MILE.length; i++) {
    var m = MILE[i];
    if (m.done) continue;
    if (tNow < m.at) continue;   /* v3：数组非严格按 at 排序，break 会挡住后面的里程碑 */""",
"""function execMilestones() {
  /* v89.100：econ 无军事 —— 跳过军事里程碑（首测：scout1 在无兵营时 jy.idx 崩溃）。
     npcIntel 是纯情报打印（只读地图），保留。 */
  var ECON_SKIP_MILE = { raid1: 1, occupy1: 1, fort1: 1, scout1: 1, city2: 1, fort2: 1, city3: 1, npcAtk: 1 };
  for (var i = 0; i < MILE.length; i++) {
    var m = MILE[i];
    if (m.done) continue;
    if (MODE === 'econ' && ECON_SKIP_MILE[m.id]) {
      m.done = true;
      RUN('⏭ 里程碑 ' + m.id + ' 跳过（econ：军事全停）');
      continue;
    }
    if (tNow < m.at) continue;   /* v3：数组非严格按 at 排序，break 会挡住后面的里程碑 */""",
'D1 econ 里程碑跳过')

# ---------- ② scout1 兵营防护（通用健壮性） ----------
rep("""      var jy = cellOf(st.cities[0], 'junying');
      setCity(st.cities[0]);
      var c0 = st.cities[0];""",
"""      var jy = cellOf(st.cities[0], 'junying');
      if (!jy) return 'wait';                              /* v89.100：无兵营 → 等（此前 jy.idx 直接崩） */
      setCity(st.cities[0]);
      var c0 = st.cities[0];""",
'D2 scout1 防护')

# ---------- ③ consignBrain keep：整类保留 ----------
rep("""  var keep = [];
  try {
    var nr = G.systems.nextRank();
    if (nr && nr.jewel) {
      for (var jid in nr.jewel) {
        if ((nr.jewel[jid] || 0) - (st.items[jid] || 0) > 0) keep.push(jid);
      }
    }
  } catch (e) {}""",
"""  var keep = [];
  try {
    var nr = G.systems.nextRank();
    if (nr && nr.jewel) {
      /* v89.100 fix：**整类保留**下一档晋爵所需珠宝。
         ⚠️ 只保"缺口"会出死循环：promoteBrain 把缺口买齐（缺口归 0）→ 下一轮
         consignBrain 就把它们按 75% 卖掉 → promoteBrain 再买回 → 每轮白亏 25%。
         首测实测：珍珠×10 + 珊瑚×5（买 4000 金）→ 卖 3000 金，反复 6 次。 */
      for (var jid in nr.jewel) keep.push(jid);
    }
  } catch (e) {}""",
'D3 consign keep 整类')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('--- total %d ---' % N[0])

r = subprocess.run(['node', '--check', P], capture_output=True)
print('check: ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:400]))
