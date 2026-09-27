# -*- coding: utf-8 -*-
"""v89.137 补丁 R：需求 1 积压 —— ① 采集可见性（资源区下拉 + 大地图） ② 细分"跟随通用"标记"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

def rep_file(p, old, new, tag):
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    assert '\r\n' not in s, '行尾混入 CRLF'
    tmp = p + '.tmp137'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    ok.append(tag)
    print('  ✓ ' + tag)

# ══════════ 1. index.html：细分标记样式 ══════════
rep_file(os.path.join(ROOT, 'index.html'),
"""  .tac-line .tl-sel { flex: 1 1 0; }""",
"""  .tac-line .tl-sel { flex: 1 1 0; }
  /* v89.137（老板 1② 清单②）：细分战术页「跟随通用 / 细分」小标 ——
     细分表里没有该兵种记录 = 跟随通用；有 = 本页单独设置（覆盖通用）。 */
  .tl-sub-tag { flex: none; font-size: var(--fs-cap); padding: 0 5px; border-radius: var(--r-xs);
    background: rgba(var(--gold-soft-rgb), .14); color: var(--text-dim); white-space: nowrap; }
  .tl-sub-tag.own { background: rgba(var(--gold-soft-rgb), .40); color: var(--gold-light); }""",
'index.html 细分标记样式')

# ══════════ 2. ui.js：战术细分标记 ══════════
rep_file(os.path.join(ROOT, 'js', 'ui.js'),
"""    var tr = DATA.TROOPS[id];
    var set = (isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side))[id] || {};
    var curS = set.s || (isDef ? 'hold' : 'advance');""",
"""    var tr = DATA.TROOPS[id];
    var set = (isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side))[id] || {};
    /* v89.137（清单②）：细分页显示"这条是细分里设的，还是跟随通用"——
       ownSub137 = 细分表（raid/occupy）里有该兵种的记录（写入端 data-tside 即落该表）。 */
    var ownSub137 = isSub
      ? !!(GAME.state && GAME.state.tactics && GAME.state.tactics[side] && GAME.state.tactics[side][id])
      : false;
    var curS = set.s || (isDef ? 'hold' : 'advance');""",
'ui.js 细分标记')

rep_file(os.path.join(ROOT, 'js', 'ui.js'),
"""        '" data-f="sortie"' + (sortieOn ? ' checked' : '') + '>出城</label>' : '') +
      '</div>';
  };""",
"""        '" data-f="sortie"' + (sortieOn ? ' checked' : '') + '>出城</label>' : '') +
      /* v89.137：细分页的小标（"跟随通用" / "细分"）—— 一眼分清哪几行是本页设的 */
      (isSub
        ? '<span class="tl-sub-tag' + (ownSub137 ? ' own' : '') + '" title="' +
          U.escape(ownSub137
            ? '本页单独设置 —— 覆盖通用出征战术（战斗按本页执行）'
            : '未单独设置 —— 跟随通用的出征战术（改这里的下拉即在本页单独设置）') +
          '">' + (ownSub137 ? '细分' : '跟随通用') + '</span>'
        : '') +
      '</div>';
  };""",
'ui.js 细分标记渲染')

# ══════════ 3. ui.js：资源区野地下拉（采集可见性） ══════════
rep_file(os.path.join(ROOT, 'js', 'ui.js'),
"""    var wilds = (s && s.wilds) || [];
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level; }).join('|');
    if (sig === ui._wildSig) return;
    ui._wildSig = sig;
    if (ui._wildSel >= wilds.length) ui._wildSel = 0;
    var sel = ui._wildSel || 0;
    var opts = wilds.map(function (w, i) {
      var t = DATA.TERRAIN[w.type];
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
        (t ? t.name : w.type) + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）</option>';
    }).join('') || '<option value="">暂无野地</option>';""",
"""    var wilds = (s && s.wilds) || [];
    /* v89.137（清单①）：采集"在采"状态在此可见 —— 选项带 ⛏ 标记；
       签名把"是否在采"也算进去（否则采集开/停时下拉不刷新）。 */
    var _gatherFlag137 = function (w) { return (GAME.gatherAt && GAME.gatherAt(w.x, w.y)) ? 'g' : ''; };
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level + _gatherFlag137(w); }).join('|');
    if (sig === ui._wildSig) return;
    ui._wildSig = sig;
    if (ui._wildSel >= wilds.length) ui._wildSel = 0;
    var sel = ui._wildSel || 0;
    var opts = wilds.map(function (w, i) {
      var t = DATA.TERRAIN[w.type];
      var _inGather137 = !!_gatherFlag137(w);
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + ' title="' +
        ((t ? t.name : w.type) + ' Lv' + w.level + (w.garrison ? '　驻军 ' + U.fmt(GAME.wildGarrisonTotal(w.garrison)) : '') +
          (_inGather137 ? '　⛏ 采集中' : '')) + '">' +
        (t ? t.name : w.type) + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）' +
        (_inGather137 ? ' ⛏' : '') + '</option>';
    }).join('') || '<option value="">暂无野地</option>';""",
'资源区下拉标记')

# ══════════ 4. map.js：大地图已占野地"采集中"标记 ══════════
rep_file(os.path.join(ROOT, 'js', 'map.js'),
"""    /* ---- ④ 已占野地：金色菱形框（描在**顶面**上，不框到侧壁） ---- */
    (s.wilds || []).forEach(function (w) {
      at(w.x, w.y, function (gx, gy, c, el) {
        ctx.strokeStyle = '#ffe9b0';
        ctx.lineWidth = 2.5;
        diaPath(gx, gy, el, 0);
        ctx.stroke();
        /* v41（需求 5）：等级已统一到格内角标，这里不再重复一份 "Lv n" */
      });
    });""",
"""    /* ---- ④ 已占野地：金色菱形框（描在**顶面**上，不框到侧壁） ---- */
    (s.wilds || []).forEach(function (w) {
      at(w.x, w.y, function (gx, gy, c, el) {
        ctx.strokeStyle = '#ffe9b0';
        ctx.lineWidth = 2.5;
        diaPath(gx, gy, el, 0);
        ctx.stroke();
        /* v41（需求 5）：等级已统一到格内角标，这里不再重复一份 "Lv n" */
        /* ============================================================
         * v89.137（老板 1①）：**采集"在采"状态在大地图可见** ——
         * 有采集队的地块在菱形顶面北缘画一枚**绿色圆点**（白描边，外圈微光），
         * 不点进野地就能一眼看出哪几块在开采。
         * 画在框之后 = 永远压在最上层（同名教训：§46.1 图层序）。
         * ============================================================ */
        if (GAME.gatherAt && GAME.gatherAt(w.x, w.y)) {
          var _bx = diaBox(gx, gy, el, 0);
          var _px = c.x, _py = c.y - _bx.h * 0.46;
          dot(ctx, _px, _py, 5.2, 'rgba(58,208,122,.30)');
          dot(ctx, _px, _py, 3.4, '#3ad07a');
          ctx.strokeStyle = 'rgba(255,255,255,.85)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(_px, _py, 3.4, 0, Math.PI * 2); ctx.stroke();
        }
      });
    });""",
'map.js 采集标记')

print('✅ 补丁R 完成 · 段: ' + ' / '.join(ok))
