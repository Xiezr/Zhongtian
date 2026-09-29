# -*- coding: utf-8 -*-
"""v89.170 smoke 补丁：4 处旧断言随曲线口径升级（+ 注释同步）
   §39①  Lv1=41/Lv4=48（写死）→ 上抬量级判据
   §39①  练兵经验注释 "每个 +100（v89.43），Lv1 只需 40" → 面额现读
   §曲线  折角/固定值 → 幂律形状（单调·凸性·低于线性·锚点）
   §迁移  g.exp === 490 → 从出口现读
   写法照 §7.4：读 → 改 → 写（newline=''）· 每处幂等守卫。"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, old, new, guard):
    P = 'smoke-test.js'
    s = rd(P)
    if guard in s and old not in s:
        print('  [skip] ' + tag)
        return
    assert s.count(old) == 1, '[%s] 锚点计数=%d' % (tag, s.count(old))
    s = s.replace(old, new)
    wr(P, s)
    s2 = rd(P)
    assert guard in s2, '[%s] 写后缺新特征' % tag
    print('  [ ok ] ' + tag)

# ── ① §39：唯一出口 + 上抬量级 ──
rep('① §39 唯一出口 + 上抬量级',
    """  check('升级所需经验只有一处口径（GAME.expNeedOf）',
    /GAME\\.expNeedOf = function/.test(dS39)
    /* v89.43 新曲线：Lv1=41（base 40 + quad 0.5×1²，按 Math.round 进位）· Lv4=48 */
    && GAME.expNeedOf({ level: 1 }) === 41 && GAME.expNeedOf({ level: 4 }) === 48,
    'Lv1=' + GAME.expNeedOf({ level: 1 }) + ' Lv4=' + GAME.expNeedOf({ level: 4 }));""",
    """  check('升级所需经验只有一处口径（GAME.expNeedOf）',
    /GAME\\.expNeedOf = function/.test(dS39)
    /* v89.170 新曲线：单段幂律 need = 100万 × (lv/240)^1.25 —— Lv1 上抬到 ~1 千、
       Lv4 近 6 千（旧口径 41/48 已退役，见 §170 的完整形状断言）。
       此处只锚"唯一出口 + 前期已上抬 + 单调"（不写死具体值）。 */
    && GAME.expNeedOf({ level: 1 }) >= 1000
    && GAME.expNeedOf({ level: 4 }) > GAME.expNeedOf({ level: 1 }),
    'Lv1=' + GAME.expNeedOf({ level: 1 }) + ' Lv4=' + GAME.expNeedOf({ level: 4 }));""",
    'GAME.expNeedOf({ level: 1 }) >= 1000')

# ── ② §39：练兵经验注释与判据仍成立（面额现读） ──
rep('② §39 练兵经验注释',
    """    st.items.lianbing_jingyan = 3;           // 每个 +100（v89.43），Lv1 只需 40""",
    """    /* v89.170：面额 = pct × total（现 ~2.1 万/个），1 个足够升 Lv1（~1 千）→ till 停。
       数量给 3 个是为了验"用不完不白扣"（used=1、剩 2）。 */
    st.items.lianbing_jingyan = 3;""",
    '1 个足够升 Lv1（~1 千）')

# ── ③ 曲线结构断言（v89.82 口径 → v89.170 幂律口径） ──
rep('③ 曲线结构断言重写',
    """/* v89.82（老板澄清）：「**239 升 240 需要 100 万经验**，而不是 1 级升到 240 需要 100 万」
   —— 锚点在曲线**顶端**；中后期由线性改**指数**（线性 + 锚点在 240 会让 Lv31 从 490
   突跳到 5250，10 倍断层）。旧口径（累计 100 万）整条曲线被压到 1/32，240 级单级只要 8982。 */
check('经验曲线 v89.82：need(240) = 100 万（锚点在顶端）· 逐级单调 · 无断层', (function () {
  var C = DATA.EXP_CURVE;
  var cum = 0, prev = 0, mono = true, jump = 0;
  for (var i = 1; i <= 240; i++) {
    var v = G.expNeedOf({ level: i });
    if (v < prev) mono = false;
    if (prev > 0 && v / prev > jump) jump = v / prev;      /* 最大相邻涨幅 */
    prev = v; cum += v;
  }
  /* ⚠️ 断层判据只看**分段点**（Lv30→Lv31）—— 低等级段带 Math.round 的锯齿
     （如 48→53 = +10.4%），拿"全局最大涨幅"当判据会在低段假红。 */
  var _seam = G.expNeedOf({ level: 31 }) / G.expNeedOf({ level: 30 });
  var _cv = {
    n240: G.expNeedOf({ level: 240 }), top: C.needTop, mono: mono, seam: _seam,
    n1: G.expNeedOf({ level: 1 }), n30: G.expNeedOf({ level: 30 }), diff: Math.abs(cum - C.total),
  };
  var _cok = _cv.n240 === 1000000 && C.needTop === 1000000 && mono
    && _seam < 1.1                                         /* 二次段→指数段平滑衔接 */
    && _cv.n1 === 41 && _cv.n30 === 490
    /* total 必须等于 Σ need（经验道具按 pct×total 取额，两处不许各算各的） */
    && _cv.diff < Math.max(2, C.total * 0.001);
  if (!_cok) {
    console.log('    (曲线诊断: n240=' + _cv.n240 + ' needTop=' + _cv.top + ' mono=' + _cv.mono
      + ' 衔接=' + _cv.seam.toFixed(4) + ' n1=' + _cv.n1 + ' n30=' + _cv.n30
      + ' cumDiff=' + _cv.diff + ' total=' + C.total + ')');
  }
  return _cok;
})(), (function () {
  var c = 0;
  for (var i = 1; i <= 240; i++) c += G.expNeedOf({ level: i });
  return 'Lv240 单级 ' + G.expNeedOf({ level: 240 }).toLocaleString()
    + ' · Lv100 单级 ' + G.expNeedOf({ level: 100 }).toLocaleString()
    + ' · 累计 ' + Math.round(c / 1e4) + '万';
})());""",
    """/* v89.82（老板澄清）：「**239 升 240 需要 100 万经验**」—— 锚点钉在曲线**顶端**（不动）。
   v89.170（老板：「前期所需经验太低…曲线应该上抬一点，比直接线性低」）：
   形状改**单段幂律** need = 100万 × (lv/240)^1.25 —— 全程平滑（v89.168 曲线图体检
   暴露的 Lv30→31 折角随之消失）、前期上抬、且**全程低于"起点→锚点"的直线**。 */
check('经验曲线 v89.170：need(240) = 100 万（锚点不动）· 幂律形状 · 低于线性 · 无折角', (function () {
  var C = DATA.EXP_CURVE;
  var cum = 0, prev = 0, mono = true, conv = true, prevR = 1e9;
  for (var i = 1; i <= 240; i++) {
    var v = G.expNeedOf({ level: i });
    if (v < prev) mono = false;
    if (i > 1) { var _rr = v / prev; if (_rr > prevR + 1e-12) conv = false; prevR = _rr; }
    prev = v; cum += v;
  }
  /* 全程低于线性（起点 → 锚点的直线）—— 老板要的形状（幂律 = 凸，天然在弦下方） */
  var _n1 = G.expNeedOf({ level: 1 }), _nT = G.expNeedOf({ level: 240 });
  var _under = true;
  for (var j = 2; j <= 239; j++) {
    if (G.expNeedOf({ level: j }) >= _n1 + (_nT - _n1) * (j - 1) / 239) _under = false;
  }
  var _cv = {
    n240: _nT, top: C.needTop, alpha: C.alpha, mono: mono, conv: conv, under: _under,
    n1: _n1, n30: G.expNeedOf({ level: 30 }), diff: Math.abs(cum - C.total),
  };
  var _cok = _cv.n240 === 1000000 && C.needTop === 1000000 && C.alpha === 1.25
    && mono                            /* 逐级单调 */
    && conv                            /* 相邻涨幅比值递减 = 凸性/无折角 */
    && _under                          /* 全程低于线性 */
    && _cv.n1 >= 1000                  /* 前期已上抬（旧口径 41） */
    /* total 必须等于 Σ need（经验道具按 pct×total 取额，两处不许各算各的） */
    && _cv.diff < Math.max(2, C.total * 0.001);
  if (!_cok) {
    console.log('    (曲线诊断: n240=' + _cv.n240 + ' needTop=' + _cv.top + ' alpha=' + _cv.alpha
      + ' mono=' + _cv.mono + ' conv=' + _cv.conv + ' under=' + _cv.under
      + ' n1=' + _cv.n1 + ' n30=' + _cv.n30 + ' cumDiff=' + _cv.diff + ' total=' + C.total + ')');
  }
  return _cok;
})(), (function () {
  var c = 0;
  for (var i = 1; i <= 240; i++) c += G.expNeedOf({ level: i });
  return 'Lv240 单级 ' + G.expNeedOf({ level: 240 }).toLocaleString()
    + ' · Lv100 单级 ' + G.expNeedOf({ level: 100 }).toLocaleString()
    + ' · 累计 ' + Math.round(c / 1e4) + '万';
})());""",
    '经验曲线 v89.170：need(240) = 100 万（锚点不动）')

# ── ④ 迁移断言去写死 ──
rep('④ 迁移断言去写死',
    """  return n === 1 && g.exp === G.expNeedOf({ level: 30 }) && g.exp === 490;""",
    """  /* v89.170：不再写死 490（曲线已抬升），只锚"截断到本级所需" */""",
    '不再写死 490')
# 上面替换会丢返回值 —— 需要把整条表达式改对：
s = rd('smoke-test.js')
old2 = """  /* v89.170：不再写死 490（曲线已抬升），只锚"截断到本级所需" */
})());"""
new2 = """  /* v89.170：不再写死 490（曲线已抬升），只锚"截断到本级所需" */
  return n === 1 && g.exp === G.expNeedOf({ level: 30 });
})());"""
if new2 in s:
    print('  [skip] ④b 迁移断言返回值已在')
else:
    assert s.count(old2) == 1, 'count=%d' % s.count(old2)
    wr('smoke-test.js', s.replace(old2, new2))
    print('  [ ok ] ④b 迁移断言返回值补齐')

print('\n补丁 B 完成。')
