# -*- coding: utf-8 -*-
"""v89.209 · v89.208 评估缺陷链修复（state.js 五段）
   A1 saveShapeChk 唯一出口（插在 slotMetaOf 之后）
   A2 importText 形状闸（插在既有 cities 检查之后）
   A3 adoptState 头：形状闸 + 原子包装（prev/挂上/try）
   A4 adoptState 尾：catch 回滚 + 重抛
   A5 syncSeq 非数组守卫
   A6 nextGenId 非数组守卫
幂等：每段用"落盘后独有的新特征"当 mark；锚点 count 断言。
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'js/state.js'


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


s = rd(P)
n0 = len(s)


def rep(tag, old, new, mark):
    global s
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, tag + ' 锚点 count=' + str(c)
    s = s.replace(old, new, 1)
    print('[ok] ' + tag)


# ---------------- A1: saveShapeChk 唯一出口 ----------------
A1_OLD = "  GAME.slotMetaOf = function (id) { return GAME.slotIndex()[id] || null; };\n"
A1_NEW = A1_OLD + '''  /* v89.209（v89.208 评估缺陷链 ①·③）：**存档形状抽检** —— 唯一出口。
     旧口径只验"cities 是非空数组"——评估探针 16 包实锤：`[{}]` / `[null]` /
     5000 个 `{}` / `generals:'oops'` / `map:null` 全部放行，接受后有 5 种静默坏。
     形状一坏，adoptState 半途抛错或 nextGenId 崩 —— 入口先拦，比事后兜底便宜。
     判据 = **数组类型 + 元素必填字段**（真实存档全实体必有 id/name；城池另有 x/y 坐标）；
     口径已对照 4,036 份真实长跑存档 + savePayload 往返产物 —— 合法档零误杀。 */
  GAME.saveShapeChk = function (st) {
    if (!st || typeof st !== 'object' || Array.isArray(st)) return { ok: false, msg: '存档状态不是有效对象' };
    if (!Array.isArray(st.cities) || !st.cities.length) return { ok: false, msg: '存档内容不完整（没有城池数据）' };
    if (!Array.isArray(st.generals)) return { ok: false, msg: '存档内容不完整（将领数据不是列表）' };
    if (!st.map || typeof st.map !== 'object') return { ok: false, msg: '存档内容不完整（缺少地图数据）' };
    var i, c, g;
    for (i = 0; i < st.cities.length; i++) {
      c = st.cities[i];
      if (!c || typeof c !== 'object' || Array.isArray(c)
        || typeof c.id !== 'string' || !c.id
        || typeof c.name !== 'string'
        || typeof c.x !== 'number' || typeof c.y !== 'number')
        return { ok: false, msg: '存档内容损坏（第 ' + (i + 1) + ' 座城池数据不完整）' };
    }
    for (i = 0; i < st.generals.length; i++) {
      g = st.generals[i];
      if (!g || typeof g !== 'object' || Array.isArray(g)
        || typeof g.id !== 'string' || !g.id
        || typeof g.name !== 'string')
        return { ok: false, msg: '存档内容损坏（第 ' + (i + 1) + ' 位将领数据不完整）' };
    }
    return { ok: true };
  };
'''
rep('A1 saveShapeChk', A1_OLD, A1_NEW, 'GAME.saveShapeChk = function')

# ---------------- A2: importText 形状闸 ----------------
A2_OLD = """    if (!pack.state || typeof pack.state !== 'object' || !pack.state.cities || !pack.state.cities.length)
      return { ok: false, msg: '存档内容不完整（没有城池数据）' };
"""
A2_NEW = A2_OLD + """    /* v89.209（v89.208 评估缺陷链 ①）：**结构抽检**（唯一出口 saveShapeChk）——
       旧口径只验"cities 是非空数组"：[{}] / [null] / 5000 个 {} / generals:'oops' 全放行。 */
    var _shape209 = GAME.saveShapeChk(pack.state);
    if (!_shape209.ok) return { ok: false, msg: _shape209.msg };
"""
rep('A2 importText 形状闸', A2_OLD, A2_NEW, 'var _shape209 = GAME.saveShapeChk(pack.state);')

# ---------------- A3: adoptState 头（形状闸 + 原子包装） ----------------
A3_OLD = "  GAME.adoptState = function (st) {      GAME.state = st;\n"
A3_NEW = '''  GAME.adoptState = function (st) {
    /* v89.209（v89.208 评估缺陷链 ①）：形状抽检（读路径同闸）—— importText 已拦一道，
       这里再拦一道：手改 localStorage / 旧版导入残留的坏档同样进不了迁移链；
       不合法即抛，且**不触碰 GAME.state**（loadGame/loadFrom 的 catch 返回 null）。 */
    var _ck209 = GAME.saveShapeChk(st);
    if (!_ck209.ok) throw new Error('存档形状损坏：' + _ck209.msg);
    /* v89.209（v89.208 评估缺陷链 ②）：**原子化** —— 迁移链内的助手（syncSeq /
       normalizeGuards / normalizeGenCities / migrate* 及 offlineCatchup）全部以全局
       `GAME.state` 为读点（见 syncSeq 首行），因此"把赋值挪到最后一步"行不通 ——
       挪了它们读到的就是**上一个档**。等价形态 = 先存 prev、挂上新档跑完整链、
       异常时回滚 prev 再抛出：失败后内存里**不留半迁移态**，游戏继续跑完好的旧档。 */
    var _prev209 = GAME.state;
    GAME.state = st;
    try {
'''
rep('A3 adoptState 头', A3_OLD, A3_NEW, 'var _ck209 = GAME.saveShapeChk(st);')

# ---------------- A4: adoptState 尾（catch 回滚 + 重抛） ----------------
A4_OLD = """      var elapsed = Math.max(0, (U.now() - (st.savedAt || U.now())) / 1000);
      if (elapsed > 5) {
        GAME.offlineCatchup(elapsed);
        GAME.state.savedAt = U.now();
      }
      return st;
  };
"""
A4_NEW = """      var elapsed = Math.max(0, (U.now() - (st.savedAt || U.now())) / 1000);
      if (elapsed > 5) {
        GAME.offlineCatchup(elapsed);
        GAME.state.savedAt = U.now();
      }
      return st;
    } catch (e209) {
      GAME.state = _prev209;   /* v89.209：回滚 —— 坏档失败不留半迁移态 */
      throw e209;
    }
  };
"""
rep('A4 adoptState 尾', A4_OLD, A4_NEW, 'GAME.state = _prev209;   /* v89.209')

# ---------------- A5: syncSeq 守卫 ----------------
A5_OLD = "    ((s && s.generals) || []).forEach(function (g) { scan(g.id); });\n"
A5_NEW = """    /* v89.209（v89.208 评估缺陷链 ③）：`|| []` 只兜 null/undefined，兜不住"非数组真值"
       （generals:'oops' → .forEach is not a function）——一律 Array.isArray 归位；
       元素防 null（scan 会取 g.id，null 元素同样炸）。 */
    (Array.isArray(s && s.generals) ? s.generals : []).forEach(function (g) { if (g) scan(g.id); });
"""
rep('A5 syncSeq 守卫', A5_OLD, A5_NEW, '(Array.isArray(s && s.generals) ? s.generals : []).forEach(function (g) { if (g) scan(g.id); });')

# ---------------- A6: nextGenId 守卫 ----------------
A6_OLD = "    ((s && s.generals) || []).forEach(function (g) { if (g && g.id) used[g.id] = true; });\n"
A6_NEW = """    /* v89.209（v89.208 评估缺陷链 ③）：同 syncSeq —— Array.isArray 归位（保发号器不崩）。 */
    (Array.isArray(s && s.generals) ? s.generals : []).forEach(function (g) { if (g && g.id) used[g.id] = true; });
"""
rep('A6 nextGenId 守卫', A6_OLD, A6_NEW, '(Array.isArray(s && s.generals) ? s.generals : []).forEach(function (g) { if (g && g.id) used[g.id] = true; });')

wr(P, s)
print('state.js 写入完成：%d -> %d 字符' % (n0, len(s)))

# ---- 写后自检：坏值模式 + 关键段落计数 ----
chk = rd(P)
assert 'GAME.saveShapeChk = function' in chk
assert chk.count('GAME.saveShapeChk = function') == 1
assert chk.count('var _shape209 = GAME.saveShapeChk(pack.state);') == 1
assert chk.count('var _ck209 = GAME.saveShapeChk(st);') == 1
assert chk.count('GAME.state = _prev209;') == 1
assert chk.count('throw e209;') == 1
assert chk.count('//s*') == 0 and chk.count('\\\\n') == 0
print('写后自检 OK')
