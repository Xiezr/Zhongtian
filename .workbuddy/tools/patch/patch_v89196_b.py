# -*- coding: utf-8 -*-
"""v89.196 批次B：放手后可重新占据（老板 2）
B1 domain.js abandonFort：清 fortsTaken（该格回归野外据点）+ 头注改口径
B2 smoke-test.js §195② 断言按新口径重写（fortsTaken 清空 + 可重占）"""
import io

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

# ---------------- B1 domain.js：abandonFort 清 fortsTaken ----------------
B1_OLD = """   *   · 格子地形恢复为占据前的原值（rec.terrain0；老档无此字段 → 兜底 'plain'）；
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
    var t = GAME.map.tile(x, y);"""
B1_NEW = """   *   · 格子地形恢复为占据前的原值（rec.terrain0；老档无此字段 → 兜底 'plain'）；
   *   · **s.fortsTaken 一并清空（v89.196 老板 2 拍板："放手后可重新占据"）**——
   *     v89.195 原口径"保留拔除登记防刷"被推翻：该格回归**野外据点**，
   *     次日起（当日由 fortsRazed 挡）即可再打、再占 —— 天然节奏 = 每格每日至多一次；
   *     重占照常给战利品与声望（老板要的就是"完整再来"，不额外加护栏）。
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
    /* v89.196（老板 2）：「放手后可重新占据」—— 清拔除登记，该格回归野外据点。
       （当日不再出现由 fortsRazed 保证；次日等级表重排后即可再打。） */
    if (s.fortsTaken) delete s.fortsTaken[key];
    var t = GAME.map.tile(x, y);"""
rep('js/domain.js', 'B1 清 fortsTaken', B1_OLD, B1_NEW, 'if (s.fortsTaken) delete s.fortsTaken[key];')

# ---------------- B2 smoke §195② 断言按新口径重写 ----------------
B2_OLD = """        var ra = G.abandonFort(tx, ty);
        return r1.ok && ra.ok
          && G.fortOwnAt(tx, ty) === null                       /* 记录删除 */
          && G.map.tile(tx, ty).terrain === (t0 || 'plain')     /* 地形恢复 */
          && !!(st.fortsTaken || {})[tx + ',' + ty]             /* fortsTaken 保留（不再生据点） */
          && G.fortAuraAt(tx + 2, ty) === null                  /* 护持终止 */
          && G.fortsOfCity(c0).length === nBefore - 1           /* 名额释放 */
          && auraBefore === true
          && G.abandonFort(tx, ty).ok === false;                /* 重复放手被拒 */
      } finally { G.state = bk; }
    })());
    check('§195② 老档兜底：无 terrain0 的前哨放手 → 恢复 plain', (function () {"""
B2_NEW = """        var ra = G.abandonFort(tx, ty);
        /* v89.196（老板 2）规则变更：「放手后可重新占据」——原判据"fortsTaken 保留"
           改为"fortsTaken 清空 + 可重占"。三件套（记录删 / 地形恢复 / 名额释放）不变。 */
        var okAb = r1.ok && ra.ok
          && G.fortOwnAt(tx, ty) === null                       /* 记录删除 */
          && G.map.tile(tx, ty).terrain === (t0 || 'plain')     /* 地形恢复 */
          && !((st.fortsTaken || {})[tx + ',' + ty])            /* v89.196：拔除登记已清（可重占） */
          && G.fortAuraAt(tx + 2, ty) === null                  /* 护持终止 */
          && G.fortsOfCity(c0).length === nBefore - 1           /* 名额释放 */
          && auraBefore === true
          && G.abandonFort(tx, ty).ok === false;                /* 重复放手被拒 */
        /* v89.196 行为：同一格**再次占据**成功（名额闭环另一半） */
        var rc96 = G.claimFort({ kind: 'fort', fort: { x: tx, y: ty, level: 8, name: '重占哨', kind: 'fort' } }, null, c0, {});
        var okRe = rc96.ok === true && !!G.fortOwnAt(tx, ty)
          && G.fortsOfCity(c0).length === nBefore;
        return okAb && okRe;
      } finally { G.state = bk; }
    })());
    check('§195② 老档兜底：无 terrain0 的前哨放手 → 恢复 plain', (function () {"""
rep('smoke-test.js', 'B2 §195② 断言重写', B2_OLD, B2_NEW, 'v89.196（老板 2）规则变更：「放手后可重新占据」')

print('批次B 完成')
