# -*- coding: utf-8 -*-
"""v89.195 批次A：前哨可放手（老板 1）
A1 domain.js  GAME.abandonFort 唯一出口
A2 battle.js  claimFort 记录 terrain0
A3 ui.js      前哨面板危险区「放手」按钮
A4 ui.js      总览行内「放手」按钮
A5 ui.js      ui.openFortAbandonAsk 确认窗
A6 main.js    两个 case（ask / arm）
每段独立写盘 + 幂等守卫（新特征计数）。"""
import io, sys

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- A1 domain.js ----------------
A1_OLD = "    return best;\n  };\n  /* #6 商旅税所："
A1_NEW = "    return best;\n  };\n" + """  /* ============================================================
   * v89.195（老板 1）：「前哨可放手」—— 释放名额的唯一出口。
   * ------------------------------------------------------------
   * 场景：每城上限 5 处（v89.193）；打下一座新据点而本城已满时，旧版只能
   *   "从他城出征"或干瞪眼（claimFort 满员文案早已预告"可先放手一处"）。
   * 口径：
   *   · 删除 s.forts 记录 —— 护持 / 商税 / 名额**全部随记录走**
   *     （各消费点读同一出口 fortOwnAt / fortAuraAt / fortsOfCity，无需逐处清）；
   *   · 格子地形恢复为占据前的原值（rec.terrain0；老档无此字段 → 兜底 'plain'）；
   *   · **s.fortsTaken 保留**：该处据点已被拔除（v89.103 口径），不会重生 ——
   *     放手只还地、不复生据点（防"打→占→放→再打"刷战利品/声望）。
   *   · 无返还（前哨没有驻军与库存；护持是"持续效果"，停即停）。
   * ============================================================ */
  GAME.abandonFort = function (x, y) {
    var s = GAME.state;
    if (!s || x == null || y == null) return { ok: false, msg: '参数不足' };
    var key = x + ',' + y;
    var rec = GAME.fortsOf()[key];
    if (!rec) return { ok: false, msg: '此处没有我方前哨' };
    var nm = rec.name || ('(' + x + ',' + y + ')');
    var lv = rec.lv || 1;
    var own = GAME.cityById(rec.cityId);
    delete s.forts[key];
    var t = GAME.map.tile(x, y);
    if (t && t.terrain === 'city') t.terrain = rec.terrain0 || 'plain';   /* 恢复占据前的地形 */
    var nAfter = own ? GAME.fortsOfCity(own).length : 0;
    var maxN = ((DATA.FORT_AURA || {}).maxPerCity) || 5;
    GAME.log.war('🚩 我们放弃了「' + nm + '」前哨（Lv' + lv + '）—— 护持与商税随之中止'
      + (own ? '；「' + own.name + '」名额 ' + nAfter + '/' + maxN : ''));
    return { ok: true, name: nm, lv: lv,
      msg: '已放弃「' + nm + '」前哨（Lv' + lv + '）—— 护持终止'
        + (own ? '，名额已释放（' + nAfter + '/' + maxN + '）' : '') };
  };
""" + "  /* #6 商旅税所："
rep('js/domain.js', 'A1 domain.abandonFort', A1_OLD, A1_NEW, 'GAME.abandonFort = function (x, y) {')

# ---------------- A2 battle.js ----------------
A2_OLD = """    var tile = GAME.map.tile(f.x, f.y);
    if (tile) tile.terrain = 'city';                        /* 据点仍占该格（视觉可见） */"""
A2_NEW = """    var tile = GAME.map.tile(f.x, f.y);
    /* v89.195（老板 1）：「前哨可放手」—— 记录**占据前的地形**（terrain0），
       放手时恢复（GAME.abandonFort 唯一出口）。`rec.terrain0 ||` 保证只记最早那一次。 */
    if (tile) { rec.terrain0 = rec.terrain0 || tile.terrain; tile.terrain = 'city'; }   /* 据点仍占该格（视觉可见） */"""
rep('js/battle.js', 'A2 battle.terrain0', A2_OLD, A2_NEW, 'rec.terrain0 = rec.terrain0 || tile.terrain')

# ---------------- A3 ui.js 面板按钮 ----------------
A3_OLD = """      '<div class="modal-foot" style="display:flex;gap:8px;justify-content:center;">' +
        '<button class="btn gold" data-action="open-outposts">🚩 前哨总览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',"""
A3_NEW = """      /* v89.195（老板 1）：「前哨可放手」—— 危险操作独立区（v89.68 口径：
         不与高频正向动作并排紧邻）；确认窗内红键一击执行（v89.156）。 */
      '<div class="op-zone danger op-zone-eq"><div class="op-zone-t">危险操作</div><div class="op-row">' +
        '<button class="btn red" data-action="fort-abandon-ask" data-x="' + f.x + '" data-y="' + f.y + '">🗑️ 放手该前哨</button>' +
        '<span class="op-hint">护持与商税中止；名额释放；不可撤销（该处据点已拔除，不会再出现）</span>' +
      '</div></div>' +
      '<div class="modal-foot" style="display:flex;gap:8px;justify-content:center;">' +
        '<button class="btn gold" data-action="open-outposts">🚩 前哨总览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',"""
rep('js/ui.js', 'A3 ui.panel-button', A3_OLD, A3_NEW, '🗑️ 放手该前哨')

# ---------------- A4 ui.js 总览行内按钮 ----------------
A4_OLD = """        '<td class="ctr"><button class="btn sm" data-action="fort-goto" data-x="' + f.x + '" data-y="' + f.y + '">定位</button></td></tr>';"""
A4_NEW = """        '<td class="ctr"><button class="btn sm" data-action="fort-goto" data-x="' + f.x + '" data-y="' + f.y + '">定位</button> ' +
          '<button class="btn sm" data-action="fort-abandon-ask" data-x="' + f.x + '" data-y="' + f.y + '">放手</button></td></tr>';"""
rep('js/ui.js', 'A4 ui.list-button', A4_OLD, A4_NEW, "'\">放手</button></td></tr>';")

# ---------------- A5 ui.js openFortAbandonAsk ----------------
A5_OLD = """      { size: 'xxl', live: function () { ui.openOutposts(); } }
    );
  };"""
A5_NEW = """      { size: 'xxl', live: function () { ui.openOutposts(); } }
    );
  };
  /* ============================================================
   * v89.195（老板 1）：**放手确认窗**（前哨面板 / 总览两处入口共用）
   * ------------------------------------------------------------
   * 口径（v89.156 老板 2）：「弹窗出来的放弃按钮点击直接执行即可，
   *   本身已经是 2 次确认了」——打开本窗 = 第一次确认，窗内红键一击执行。
   * 写清三件事：失去什么 / 名额怎么变 / 能否撤销（不可撤销四个字必须在）。
   * ============================================================ */
  ui.openFortAbandonAsk = function (x, y) {
    var f = GAME.fortOwnAt ? GAME.fortOwnAt(x, y) : null;
    if (!f) { ui.toast('此处没有我方前哨'); return; }
    var fx = GAME.fortEffectOf(f);
    var own = GAME.cityById(f.cityId);
    var n = own ? GAME.fortsOfCity(own).length : 0;
    var maxN = ((DATA.FORT_AURA || {}).maxPerCity) || 5;
    ui.openShell({
      title: '🗑️ 放弃前哨 · ' + U.escape(f.name || '?'),
      sub: 'Lv' + (f.lv || 1) + '　(' + f.x + ',' + f.y + ')'
        + (own ? '　归属 ' + U.escape(own.name) : ''),
      size: 'sm',
      body:
        '<div class="note">放弃后这处前哨的<b>全部护持立即中止</b>，且<b>不可撤销</b>：' +
          '该处据点已被拔除（v89.103 口径），不会再出现在地图上。</div>' +
        '<div class="attr"><span class="k">失去护持</span><span class="v">辐射 ' + fx.radius +
          ' 格：采集 ×' + fx.gatherMul + ' · 宝物 +' + Math.round(fx.treasureAdd * 100) +
          '% · 驻军上限 ×' + fx.garrisonCapMul + ' · ' +
          (fx.intelFull ? '情报确凿' : '情报半明') + ' · 商税 ' + fx.tax + ' 金/日</span></div>' +
        '<div class="attr"><span class="k">名额变化</span><span class="v good">' +
          (own ? U.escape(own.name) + '：' + n + '/' + maxN + ' → ' + (n - 1) + '/' + maxN + '（可再设哨）' : '已释放') +
          '</span></div>' +
        '<div class="attr"><span class="k">格子处置</span><span class="v">恢复为普通地形（可正常使用）</span></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="fort-abandon-arm" data-x="' + f.x + '" data-y="' + f.y + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };"""
rep('js/ui.js', 'A5 ui.openFortAbandonAsk', A5_OLD, A5_NEW, 'ui.openFortAbandonAsk = function (x, y) {')

# ---------------- A6 main.js ----------------
A6_OLD = "      case 'open-outposts': ui.openOutposts(); break;"
A6_NEW = """      case 'open-outposts': ui.openOutposts(); break;
      /* v89.195（老板 1）：前哨放手 —— 确认窗 → 红键一击执行（v89.156 口径：
         "弹窗出来的放弃按钮点击直接执行即可，本身已经是 2 次确认了"）。 */
      case 'fort-abandon-ask': ui.openFortAbandonAsk(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'fort-abandon-arm': {
        var fabR195 = GAME.abandonFort(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast((fabR195.ok ? '🗑️ ' : '⚠️ ') + fabR195.msg);
        /* 放手成功后：关净全部弹层（确认窗 → 前哨面板/总览），回地图看新状态 */
        if (fabR195.ok) { ui.closeAllModals(); GAME.refreshAll(); ui.renderMapCanvas(); }
        break;
      }"""
rep('js/main.js', 'A6 main.cases', A6_OLD, A6_NEW, "case 'fort-abandon-arm': {")

print('批次A 完成')
