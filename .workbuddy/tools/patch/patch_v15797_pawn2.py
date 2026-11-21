# -*- coding: utf-8 -*-
"""在 v157.92 基础上重挂「传送 + 小人」（不掺水球改动）"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
assert 'WATER_SPHERE' not in s, 'should be v157.92 base'

# 1) 玩家小人：放大 + 光环
a = """    var stc = (GAME.state && GAME.state._standCi);
    if (stc != null && stc >= 0) who.push({ ci: stc, color: 0xcfd6df, scale: sc * 0.95, key: 'stand' });"""
assert s.count(a) == 1, 'a1'
b = """    var stc = (GAME.state && GAME.state._standCi);
    /* v157.96：玩家小人（传送目标）**放大 + 青色光环**。
       老板说从没看见过 —— 根因是"只有当前城那一格有小人"，城在球背面就永远看不到；
       而且俯视时站着的人只剩一个点，必须给光环才锁得住"我在这格"。 */
    if (stc != null && stc >= 0) who.push({ ci: stc, color: 0xffd76a, scale: sc * 3.2, key: 'stand', beacon: true });"""
s = s.replace(a, b)

c = """    who.forEach(function (w) {
      var g = makeFigure(w.color, w.scale, w.actor);
      if (!placeFigure(g, w.ci)) return;
      figCache[w.key] = { g: g, ci: w.ci };
      figRoot.add(g);
    });"""
assert s.count(c) == 1, 'a2'
d = """    who.forEach(function (w) {
      var g = makeFigure(w.color, w.scale, w.actor);
      if (!placeFigure(g, w.ci)) return;
      if (w.beacon) {
        try {
          /* 青色光环：俯视锁格、斜视见人（金色会与小人同色、把人藏起来） */
          var ring = new THREE.Mesh(
            new THREE.RingGeometry(0.78, 1.05, 32),
            new THREE.MeshBasicMaterial({ color: 0x2fe0ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.35;
          ring.renderOrder = 3;
          g.add(ring);
          g.userData.beacon = { ring: ring };
        } catch (eB) { }
      }
      figCache[w.key] = { g: g, ci: w.ci };
      figRoot.add(g);
    });"""
s = s.replace(c, d)

# 2) 传送接口
e = """  /* ============================================================
   * v153b（老板：「可以在星球地表上逐格移动」）——"""
assert s.count(e) == 1, 'a3'
f = """  /* ============================================================
   * v157.96：**传送到某格**（地块面板的「⤓ 传送」按钮调它）
   * ------------------------------------------------------------
   * 只动 `state._standCi` 一个字段；渲染侧靠 `_standVer` 变化重建（换格只挪不重建）。
   * ============================================================ */
  M.teleportTo = function (ci) {
    ci = ci | 0;
    if (!(_tileCells && _tileCells[ci])) return false;
    if (!GAME.state) return false;
    GAME.state._standCi = ci;
    M._standVer = '';
    return true;
  };
  M.playerCi = function () {
    return (GAME.state && GAME.state._standCi != null) ? GAME.state._standCi : -1;
  };

  /* ============================================================
   * v153b（老板：「可以在星球地表上逐格移动」）——"""
s = s.replace(e, f)

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('pawn re-applied on v157.92 water')
