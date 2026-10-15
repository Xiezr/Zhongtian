# -*- coding: utf-8 -*-
"""v89.99-H 脑校准（幂等）：① 收割队随军力伸缩（否则门槛永远够不着）② 放人全城扫描"""
import io, sys
R = 'E:/Deepseekdb/'
P = R + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
N = [0]
def rep(old, new, tag):
    global s
    if new in s:
        print('SKIP ' + tag); return
    if old not in s:
        print('MISS ' + tag); sys.exit(1)
    s = s.replace(old, new, 1); N[0] += 1
    print('OK   ' + tag)

# ① 收割队伸缩（首测暴露：margin = troops+600 永远够不着 → amc 全程 0 翻转）
rep("""  var mg = pickSiegeGen();
  var pick = pickAmcGen(mg);
  var margin = (amc.troops || 0) + 600;
  var wantAmc = !!pick && totalArmy() >= margin;""",
"""  var mg = pickSiegeGen();
  var pick = pickAmcGen(mg);
  /* v89.99：收割队规模**随军力伸缩**（首测暴露：固定 troops 让门槛永远够不着 →
     自动出征全程 0 翻转）。规则：不超过年度档位、不超过军力 25%、至少 600 才出门；
     门槛 = 收割队 + 600 留守。 */
  var raidN = Math.min((amc.troops || 0), Math.max(600, Math.floor(totalArmy() * 0.25)));
  if (raidN > 0 && amc.troops !== raidN) amc.troops = raidN;
  var margin = raidN + 600;
  var wantAmc = !!pick && totalArmy() >= 1200 && totalArmy() >= margin;""",
'① 收割队伸缩')

rep("""    RUN((wantAmc ? '🟢' : '⚪') + ' 自动出征 ' + (wantAmc ? '开' : '关') + '（' + er + '：'
      + (wantAmc ? '军力余 ' + fmtNum(totalArmy() - margin) + '，放它收割' : '军力/将不足，收回保战事') + '）');""",
"""    RUN((wantAmc ? '🟢' : '⚪') + ' 自动出征 ' + (wantAmc ? '开' : '关') + '（' + er + '：'
      + (wantAmc ? '收割队 ' + fmtNum(raidN) + '，军力余 ' + fmtNum(totalArmy() - margin) : '军力/将不足，收回保战事') + '）');""",
'①b 日志带队额')

# ② 放人：全城扫描，找义兵最多的一座城
rep("""function releaseBank(needPop, why) {
  var c = st.cities[0];
  if (!c) return 0;
  var bank = (c.army || {}).yibing || 0;
  if (bank <= 0) return 0;""",
"""function releaseBank(needPop, why) {
  /* v89.99：**全城扫描** —— 义兵可能在任意一座城（首测里只扫主城，漏掉分城的存货） */
  var c = null, bank = 0;
  st.cities.forEach(function (cc) {
    var b = ((cc.army || {}).yibing) || 0;
    if (b > bank) { bank = b; c = cc; }
  });
  if (!c || bank <= 0) return 0;""",
'② 放人全城扫描')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('--- H 校准完成：%d 处 ---' % N[0])
