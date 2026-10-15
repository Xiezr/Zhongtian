# -*- coding: utf-8 -*-
"""patch_v89129c_recgen.py —— v89.129 需求 2：相称尺子 + 出征面板建议行。
1. domain.js：GAME.guardRankIdxOf（资质档位映射唯一出口）+ GAME.recGenOf（相称建议）
2. wildDefenseAt / fortGuardOf 改读共用映射（公式等价）
3. ui.js：出征面板主将区加"相称建议"行
"""
import io

n = 0


def patch(P, pairs, tag):
    global n
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = s
    for o, nn, t in pairs:
        assert s.count(o) == 1, tag + '/' + t + ' 锚点 %d 个' % s.count(o)
        s = s.replace(o, nn)
        n += 1
        print('  ✓ ' + tag + '/' + t)
    assert s != orig
    assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), tag + ' 花括号盈亏被改变'
    assert '\r\n' not in s, tag + ' CRLF 混入'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)


# ---------- ① domain.js：两个新出口 ----------
patch('E:/Deepseekdb/js/domain.js', [
    ("""  GAME.expGeneralsOf = function () {
    return ((GAME.state && GAME.state.generals) || []).filter(function (g) { return GAME.canMarch(g); });
  };""",
     """  GAME.expGeneralsOf = function () {
    return ((GAME.state && GAME.state.generals) || []).filter(function (g) { return GAME.canMarch(g); });
  };

  /* ============================================================
   * v89.129（老板：「任何野外目标（野地，城池，名城等）均应有将领带领，
   *   根据等级配备相称资质和等级的将领」）
   * ------------------------------------------------------------
   * 野外目标守将的**资质档位映射**（唯一出口）—— 三处共用：
   *   · GAME.wildDefenseAt（野地守将）：档位 1 + ⌊lv/3⌋
   *   · GAME.fortGuardOf（据点守将）：档位 2 + ⌊lv/3⌋（据点=城，比同级野地高一档）
   *   · GAME.recGenOf（出征面板"相称建议"）：同一张映射 —— 打谁，宜与谁同档。
   * 以后调守将资质强度只改这里（界面建议自动跟）。
   * ============================================================ */
  GAME.guardRankIdxOf = function (kind, lv) {
    var base = (kind === 'fort') ? 2 : 1;
    var v = Math.max(0, lv | 0);
    return Math.min(DATA.GEN_RANKS.length - 1, base + Math.floor(v / 3));
  };

  /* ============================================================
   * v89.129：**"相称"尺子**（唯一出口）—— 出征某目标"宜派"什么资质/等级的将领。
   * ------------------------------------------------------------
   * 纯按**公开信息**（目标类型 + 等级）给建议，不含守将实情
   * （守将强弱请去侦查 —— v89.64「不然还要侦察何用」；**软提示、非门槛**）。
   * 规则 = 与守将生成同尺（打谁，宜与谁同档）：
   *   · 野地：资质 = guardRankIdxOf('wild', lv)（与 wildDefenseAt 同源）、
   *     等级 ≥ max(3, lv*2)（= 野地守将等级公式的下限）；
   *   · 据点：资质 = guardRankIdxOf('fort', lv)（与 fortGuardOf 同源）、
   *     等级 ≥ max(10, lv*4 + 20)（= 据点守将等级下限）；
   *   · 城池/名城：资质天授、等级 ≥ NPC_GUARD_LV[type] 下限
   *     （与 npcCityGuard 同档 —— v89.64「将领默认资质为天授，等级根据城池级别设定范围」）。
   * 返回 { rankId, rankName, lv, text }；调兵（owncity）无建议 → null。
   * 等级建议与守将公式"下限同尺"由 smoke §112② 逐档交叉核对（防两处漂移）。
   * ============================================================ */
  GAME.recGenOf = function (t) {
    if (!t || !t.ok) return null;
    var rankIdx = null, lvMin = 0;
    if (t.kind === 'wild') {
      rankIdx = GAME.guardRankIdxOf('wild', t.lv || 0);
      lvMin = Math.max(3, (t.lv || 0) * 2);
    } else if (t.kind === 'fort') {
      rankIdx = GAME.guardRankIdxOf('fort', t.lv || 1);
      lvMin = Math.max(10, (t.lv || 1) * 4 + 20);
    } else if (t.kind === 'city') {
      rankIdx = DATA.GEN_RANKS.length - 1;           /* 天授（同 npcCityGuard） */
      var rg = (DATA.NPC_GUARD_LV && DATA.NPC_GUARD_LV[t.cityType]) || [60, 100];
      lvMin = rg[0];
    } else {
      return null;                                    /* owncity 等：无建议 */
    }
    var rk = DATA.GEN_RANKS[rankIdx];
    return { rankId: rk.id, rankName: rk.name, lv: lvMin, text: rk.name + ' Lv' + lvMin + '+' };
  };""",
     'guardRankIdxOf + recGenOf'),

    # 野地守将改读共用映射（公式等价）
    ("""      var rk = DATA.GEN_RANKS[Math.min(DATA.GEN_RANKS.length - 1, 1 + Math.floor(lv / 3))];""",
     """      var rk = DATA.GEN_RANKS[GAME.guardRankIdxOf('wild', lv)];   /* v89.129：唯一出口 */""",
     'wildDefenseAt 映射')],
    'domain.js')

# ---------- ② map.js：fortGuardOf 改读共用映射 ----------
patch('E:/Deepseekdb/js/map.js', [
    ("""    var rankIdx = Math.min(DATA.GEN_RANKS.length - 1, 2 + Math.floor(lv / 3));
    var rk = DATA.GEN_RANKS[rankIdx];""",
     """    var rk = DATA.GEN_RANKS[GAME.guardRankIdxOf('fort', lv)];   /* v89.129：唯一出口 */""",
     'fortGuardOf 映射')],
    'map.js')

# ---------- ③ ui.js：出征面板"相称建议"行 ----------
patch('E:/Deepseekdb/js/ui.js', [
    ("""    }).join('');
    html += '</select></div>';
    /* v89.112：「可用道具」**移入右列**（原在主将段内）——
       物品多时体力丹 pills 会换行（199 物品环境下 +42px，撑高左列顶穿正文区）。
       右列余量充足；语义上也更顺：它和"派遣兵力"同属"带什么走"。 */
    html += '</div>';""",
     """    }).join('');
    html += '</select></div>';
    /* v89.129（老板「根据等级配备相称资质和等级的将领」）：**相称建议**行 ——
       纯按目标等级给"宜派"的档位（守将实情请侦查；软提示、非门槛）。
       目标切换时整窗重绘（目标下拉 change → openExpModal），本行随 t 重建。 */
    var rec129 = GAME.recGenOf(t);
    if (rec129) {
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin:4px 0 0;">'
        + '相称建议：宜 <b>' + U.escape(rec129.text) + '</b> 带队</div>';
    }
    /* v89.112：「可用道具」**移入右列**（原在主将段内）——
       物品多时体力丹 pills 会换行（199 物品环境下 +42px，撑高左列顶穿正文区）。
       右列余量充足；语义上也更顺：它和"派遣兵力"同属"带什么走"。 */
    html += '</div>';""",
     '相称建议行')],
    'ui.js')

print('patchC OK · %d 处（LF 保持）' % n)
