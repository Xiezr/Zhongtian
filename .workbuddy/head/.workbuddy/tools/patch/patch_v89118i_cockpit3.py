# -*- coding: utf-8 -*-
"""
patch_v89118i_cockpit3.py — 驾驶舱第三轮加固（终跑用）

实测（v89118_30h_v2）暴露三处"驾驶舱覆盖不足"（非游戏 bug，但遮挡了内容覆盖）：
  ① 建第三城失败且**无原因记录**：findPlainSpot 只扫 3~20 格 —— 扩到 48 格并记失败原因；
  ② 名城攻坚（里程碑 npcAtk）在 at=7200 只判一次，当时兵力 2188 → 直接放弃
     —— 改独立驱动：每 2400 tick 试一次，兵力 ≥ 20000 且有闲将就打最近名城
     （覆盖 斗将 / 名城守将 / 双路沙盘）；
  ③ inv_final 补 expandMsg / npcAtk 结果。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
GEN = R + '.workbuddy/tools/patch/patch_v89118d_playtest.py'
s = io.open(GEN, encoding='utf-8').read()


def edit(old, new, tag):
    global s
    n = s.count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次 → 中止' % (tag, n))
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ---------- 1. 扩张驱动：外扩搜索 + 失败原因 ----------
edit("""  /* ④ 扩张（v89.118 补驱动）：有爵位空间就找平原建新城 —— 覆盖多城路径 */
  if (tNow - (INV.lastExpandAt || -1e9) >= 480) {
    INV.lastExpandAt = tNow;
    var capE = G.cityCapOf ? G.cityCapOf() : 0;
    if ((st.cities || []).length < capE) {
      var spotE = findPlainSpot();
      if (spotE) {
        var reE = null;
        try { reE = G.buildCityAt(spotE.x, spotE.y); } catch (e4) { noteErr('expand', e4); }
        if (reE && reE.ok) RUN('🏙 建新城：' + (reE.msg || '') + '（城 ' + st.cities.length + '/' + capE + '）');
      }
    }
  }""",
"""  /* ④ 扩张（v89.118 补驱动）：有爵位空间就找平原建新城 —— 覆盖多城路径。
        搜索半径外扩到 48 格（默认 3~20 在 30h 实测没找到空平原 → 卡 2 城）。 */
  if (tNow - (INV.lastExpandAt || -1e9) >= 480) {
    INV.lastExpandAt = tNow;
    var capE = G.cityCapOf ? G.cityCapOf() : 0;
    if ((st.cities || []).length < capE) {
      var spotE = null;
      var c0E = st.cities[0];
      for (var rrE = 3; rrE <= 48 && !spotE; rrE++) {
        for (var dyE = -rrE; dyE <= rrE && !spotE; dyE++) for (var dxE = -rrE; dxE <= rrE && !spotE; dxE++) {
          if (Math.max(Math.abs(dxE), Math.abs(dyE)) !== rrE) continue;
          var xE = c0E.x + dxE, yE = c0E.y + dyE;
          if (xE < 3 || yE < 3 || xE >= DATA.MAP_W - 3 || yE >= DATA.MAP_H - 3) continue;
          var tlE = G.map.tile(xE, yE);
          if (!tlE || tlE.terrain !== 'plain') continue;
          if (G.map.wildAt(xE, yE) || G.map.npcAt(xE, yE) || G.map.ownCityAt(xE, yE) || G.map.fortAt(xE, yE)) continue;
          spotE = { x: xE, y: yE };
        }
      }
      if (spotE) {
        var reE = null;
        try { reE = G.buildCityAt(spotE.x, spotE.y); } catch (e4) { noteErr('expand', e4); }
        if (reE && reE.ok) RUN('🏙 建新城：' + (reE.msg || '') + '（城 ' + st.cities.length + '/' + capE + '）');
        else if (reE && !INV.expandMsg) INV.expandMsg = String(reE.msg || '(无 msg)');
      } else if (!INV.expandMsg) {
        INV.expandMsg = '半径 48 格内无空闲平原（cap=' + capE + '，城=' + st.cities.length + '）';
      }
    }
  }
  /* ④b 名城攻坚（v89.118 补驱动）：兵力够且有闲将 → 打最近名城。
        覆盖：斗将（双方有将才触发）/ 名城守将 / 出征沙盘与守城沙盘两路。 */
  if (!INV.npcAtkDone && tNow - (INV.lastNpcAtkAt || -1e9) >= 2400) {
    INV.lastNpcAtkAt = tNow;
    if (totalArmy() >= 20000) {
      var c0N = st.cities[0], npcN = null;
      for (var rrN = 5; rrN <= 30 && !npcN; rrN++) {
        for (var dyN = -rrN; dyN <= rrN && !npcN; dyN++) for (var dxN = -rrN; dxN <= rrN && !npcN; dxN++) {
          if (Math.max(Math.abs(dxN), Math.abs(dyN)) !== rrN) continue;
          var fN = G.map.npcAt(c0N.x + dxN, c0N.y + dyN);
          if (fN) npcN = fN;
        }
      }
      if (npcN) {
        var genN = idleGen(true);
        if (genN) {
          setCity(c0N);
          var tkN = takeArmy(c0N, Math.floor(totalArmy() * 0.6));
          var rN = safeCall('npcAtk118', function () {
            return G.march.dispatch({ kind: 'city', id: npcN.id, npc: npcN }, 'raid', tkN.army, genN.id);
          });
          if (rN && rN.ok) {
            INV.npcAtkDone = 1;
            RUN('⚔️ v89.118 名城攻坚「' + npcN.name + '」：' + rN.msg + '（兵力 ' + fmtNum(tkN.total) + '）');
          } else if (rN && !rN.ok && !INV.npcAtkMsg) {
            INV.npcAtkMsg = String(rN.msg || '');
          }
        }
      } else if (!INV.npcAtkMsg) {
        INV.npcAtkMsg = '30 格内无名城';
      }
    } else if (!INV.npcAtkMsg) {
      INV.npcAtkMsg = '兵力未达 20000（当前 ' + fmtNum(totalArmy()) + '）';
    }
  }""",
'I1 扩张+名城驱动')

# ---------- 2. inv_final 补字段 ----------
edit("""    promotes: INV.promotes || 0,
    promoteMsg: INV.promoteMsg || '',""",
"""    promotes: INV.promotes || 0,
    promoteMsg: INV.promoteMsg || '',
    expandMsg: INV.expandMsg || '',
    npcAtkMsg: INV.npcAtkMsg || '',""",
'I2 inv_final 补字段')

tmp = GEN + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, GEN)
print('生成器已加固（两处）→ 重新生成 play_v89118.js')
