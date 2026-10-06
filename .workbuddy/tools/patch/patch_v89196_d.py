# -*- coding: utf-8 -*-
"""v89.196 批次D：雷达圈改地块边界折线（静态）（老板 6）
D1 map.js  新增 GAME.map.fortRingOf(R)（轮廓唯一出口·按 R 缓存）
D2 map.js  ④a 段整体替换（椭圆弧+相位 → 轮廓折线·静态）
D3 smoke §194⑦ 断言按新口径重写（规则变更三件套）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

# ---------------- D1 + D2 map.js ----------------
s = rd('js/map.js')
if 'GAME.map.fortRingOf = function' in s:
    print('[skip] D1/D2 map.js')
else:
    # D1：在 fortRazedToday 之前插函数
    anchor1 = "  GAME.map.fortRazedToday = function (x, y) {"
    assert s.count(anchor1) == 1, 'D1 anchor=' + str(s.count(anchor1))
    D1 = """  /* ============================================================
   * v89.196（老板 6）：前哨辐射范围 = **覆盖格的地块边界折线**（唯一出口）。
   * ------------------------------------------------------------
   * 老板原话：「不要（旋转扫描线），有点晃眼，静态圈就行，已涉及到最远的地块
   *   格子边界为边界（因此外周不是圆弧，而是地块的边界折线）」。
   * 口径：边界 = 覆盖格集合（dx²+dy² ≤ R²，与 GAME.fortAuraAt 判定**同源**）
   *   的**外轮廓** —— 每格的 4 条边中"邻格不在集合内"的那几条；
   *   等距投影下每条格边都是菱形斜线 → 外周呈锯齿折线（不再是圆弧）。
   * 缓存：段集合只与前哨**半径**有关（相对前哨中心的格坐标）→ 按 R 缓存，
   *   渲染时平移 + 投影（gxy 是线性映射，半整数角标可直代）。
   * 返回 { segs:[[x1,y1,x2,y2]…]（相对格坐标，含 ±0.5 角标）,
   *        ring:[[x,y]…]（外轮廓环，供填充）}。
   * ============================================================ */
  GAME.map.fortRingOf = function (R) {
    R = Math.max(1, Math.round(R || 0));
    var cache = GAME.map._fortRing = GAME.map._fortRing || {};
    if (cache[R]) return cache[R];
    var inside = {}, list = [];
    for (var dy = -R; dy <= R; dy++) {
      for (var dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy <= R * R) { inside[dx + ',' + dy] = 1; list.push([dx, dy]); }
      }
    }
    var segs = [];
    list.forEach(function (p) {
      var dx = p[0], dy = p[1];
      /* 四邻检查 → 外露边（端点用半整数角坐标：格 (dx,dy) 的角 = (dx±0.5, dy±0.5)） */
      if (!inside[dx + ',' + (dy - 1)]) segs.push([dx - 0.5, dy - 0.5, dx + 0.5, dy - 0.5]);
      if (!inside[dx + ',' + (dy + 1)]) segs.push([dx - 0.5, dy + 0.5, dx + 0.5, dy + 0.5]);
      if (!inside[(dx - 1) + ',' + dy]) segs.push([dx - 0.5, dy - 0.5, dx - 0.5, dy + 0.5]);
      if (!inside[(dx + 1) + ',' + dy]) segs.push([dx + 0.5, dy - 0.5, dx + 0.5, dy + 0.5]);
    });
    /* 环连接（填充用）：每个端点恰好接两条段 → 沿链走一圈 */
    var ends = {}, k2 = function (x, y) { return x + '|' + y; };
    segs.forEach(function (sg, i) {
      var a = k2(sg[0], sg[1]), b = k2(sg[2], sg[3]);
      (ends[a] = ends[a] || []).push(i);
      (ends[b] = ends[b] || []).push(i);
    });
    var ring = [], used = {}, cur = 0, guard = 0;
    while (segs[cur] && guard++ < segs.length + 8) {
      used[cur] = 1;
      ring.push([segs[cur][0], segs[cur][1]]);
      var b3 = k2(segs[cur][2], segs[cur][3]);
      var nxt = -1;
      (ends[b3] || []).forEach(function (i2) { if (nxt < 0 && !used[i2]) nxt = i2; });
      if (nxt < 0) break;
      cur = nxt;
    }
    var out = { segs: segs, ring: ring };
    cache[R] = out;
    return out;
  };
"""
    s = s.replace(anchor1, D1 + anchor1)

    # D2：④a 段整体替换（起止标记切片，防手抄错）
    i0 = s.index("    /* ---- ④a 己方前哨：雷达辐射圈（v89.194 老板） ----")
    i1 = s.index("    /* ---- ④ 已占野地：金色菱形框", i0)
    old = s[i0:i1]
    NEW = """    /* ---- ④a 己方前哨：辐射范围（v89.194 圆 → v89.196 地块边界折线 · 静态） ----
       老板原话（v89.196 6）：「不要（旋转扫描线），有点晃眼，静态圈就行，已涉及到
       最远的地块格子边界为边界（因此外周不是圆弧，而是地块的边界折线）」。
       几何：覆盖格集合（欧氏判定，与 GAME.fortAuraAt 同源）的**外轮廓** ——
       GAME.map.fortRingOf(R) 唯一出口（段按 R 缓存）；等距投影下每条格边都是
       菱形斜线 → 外周为锯齿折线。静态：无相位/无动画；填充极淡（不遮地块）。 */
    (function () {
      if (!ctx) return;                              /* 能力判据（桩环境无 canvas 2d） */
      var fs196 = (GAME.fortsOf ? GAME.fortsOf() : null) || {};
      for (var k196 in fs196) {
        var f196 = fs196[k196];
        if (!f196 || !f196.cityId) continue;         /* 只画**己方前哨**（老板口径） */
        if (f196.x < gx0 - 16 || f196.x > gx1 + 16 || f196.y < gy0 - 16 || f196.y > gy1 + 16) continue;
        var R196 = GAME.fortRadiusOf(f196) || 0;
        if (!(R196 > 0)) continue;
        var ring196 = GAME.map.fortRingOf(R196);
        ctx.save();
        /* ① 填充：轮廓环（极淡，地块纹理透得出来） */
        if (ring196.ring && ring196.ring.length >= 3) {
          ctx.beginPath();
          ring196.ring.forEach(function (pt, i2) {
            var sc = gxy(f196.x + pt[0], f196.y + pt[1]);
            if (i2) ctx.lineTo(sc.x, sc.y); else ctx.moveTo(sc.x, sc.y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(140,220,170,.055)';
          ctx.fill();
        }
        /* ② 描边：全部边界段（静态 · 边缘相对清晰） */
        ctx.beginPath();
        ring196.segs.forEach(function (sg) {
          var a2 = gxy(f196.x + sg[0], f196.y + sg[1]);
          var b2 = gxy(f196.x + sg[2], f196.y + sg[3]);
          ctx.moveTo(a2.x, a2.y);
          ctx.lineTo(b2.x, b2.y);
        });
        ctx.strokeStyle = 'rgba(168,235,188,.55)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    })();

"""
    s = s[:i0] + NEW + s[i1:]
    wr('js/map.js', s)
    print('[ok] D1/D2 map.js（fortRingOf + ④a 段替换）')

# ---------------- D3 smoke §194⑦ 重写 ----------------
s = rd('smoke-test.js')
if 'v89.196 规则变更：椭圆弧 → 地块边界折线' in s:
    print('[skip] D3 §194⑦ 重写')
else:
    D3_OLD = """    check('§194⑦ 渲染结构：己方过滤 / 椭圆几何 √2 / 淡填充 / 图层在野地框之前（源码级）', (function () {
      var m = raw194('map.js');
      return /if \\(!f194 \\|\\| !f194\\.cityId\\) continue;/.test(m)
        && /R194 \\* HW \\* 1\\.4142/.test(m) && /R194 \\* HH \\* 1\\.4142/.test(m)
        && /rgba\\(140,220,170,\\.055\\)/.test(m)
        && m.indexOf('④a 己方前哨：雷达辐射圈') >= 0
        && m.indexOf('④a 己方前哨：雷达辐射圈') < m.indexOf('④ 已占野地：金色菱形框')
        && /if \\(!ctx \\|\\| !ctx\\.ellipse\\) return;/.test(m);
    })());"""
    D3_NEW = """    check('§194⑦ 渲染结构（v89.196 规则变更：椭圆弧 → 地块边界折线 · 静态）：己方过滤 / fortRingOf 唯一出口 / 淡填充 / 图层序', (function () {
      var m = raw194('map.js');
      /* v89.196（老板 6）：「外周不是圆弧，而是地块的边界折线」+「静态圈就行」——
         旧椭圆几何（R194×HW×√2）与相位动画整条退役；本断言按新口径重写。 */
      return /if \\(!f196 \\|\\| !f196\\.cityId\\) continue;/.test(m)
        && /GAME\\.map\\.fortRingOf = function \\(R\\)/.test(m)
        && /fortRingOf\\(R196\\)/.test(m)
        && /rgba\\(140,220,170,\\.055\\)/.test(m)
        && m.indexOf('④a 己方前哨：辐射范围') >= 0
        && m.indexOf('④a 己方前哨：辐射范围') < m.indexOf('④ 已占野地：金色菱形框')
        && !/1\\.4142/.test(m)                       /* 旧椭圆几何清零 */
        && !/ringA194|Date\\.now\\(\\) \\/ 500/.test(m)  /* 相位动画清零（静态） */
        && /if \\(!ctx\\) return;/.test(m);
    })());"""
    c = s.count(D3_OLD)
    assert c == 1, 'D3 count=' + str(c)
    s = s.replace(D3_OLD, D3_NEW)
    wr('smoke-test.js', s)
    print('[ok] D3 §194⑦ 重写')

print('批次D 完成')
