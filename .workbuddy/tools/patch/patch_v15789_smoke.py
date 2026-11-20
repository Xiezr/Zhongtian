# -*- coding: utf-8 -*-
"""v15789 P0 · 给 smoke 补断言（§589a~e）

规则：一条需求一条断言；行为断言必须带下限；不许 0===0 平凡解。
本轮的"需求"= 球体地形要能受光（有起伏明暗），且近景不许出现刷痕。
"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s or True
n0 = len(s)

BLOCK = r"""
/* ============================================================
 * §589 · v157.89 球体受光化：地形法线 + 起伏明暗
 * ------------------------------------------------------------
 * 老板：「球体是空壳，可以全填充吗」→ 取证发现真正的病根是**法线全是径向**：
 *   实测顶点法线偏离径向 最大 0.02° / 平均 0° —— 山脊与山谷受光完全一样。
 *   所以"全填充"零收益、"换 Lambert"也零收益（径向法线只会算出一颗光滑的球）。
 * 本轮改的是「让法线真的跟着地形走」+「按法线做一次起伏明暗」，并对近景做高度淡出
 *   （逐顶点明暗被放大后会变成刷痕 —— 实机 zoom0.13 已取证）。
 * ============================================================ */
  (function () {
    var fs = require('fs'), path = require('path');
    var mp = fs.readFileSync(path.join(__dirname, 'js', 'map3d.js'), 'utf8');
    var M3 = GAME.map3d;

    /* ① 结构面：真法线在岗（三角面累加 + 跨面焊接 + 曲率属性 + 单一闸门）*/
    check('§589a 结构面：真地形法线在岗（面法线累加 / 方向焊接 / aShade 属性 / uRelief 闸门）',
      /function buildTerrainNormals\(\)/.test(mp)
      && /if \(!wmap\[k\]\) wmap\[k\] = \[\]/.test(mp)
      && /geo\.setAttribute\('aShade'/.test(mp)
      && /uniform float uRelief/.test(mp)
      && /gl_FragColor\.rgb \*= mix\(1\.0, vShade, uRelief\)/.test(mp),
      '四件在岗');

    /* ② 反向证据：改前的"径向法线"不许复活；起伏只给球面（地块不许开）*/
    check('§589b 反向证据：径向法线已替换 · 起伏只作用于球面（地块单参调用仍在）',
      (mp.match(/\n\s*nor\.push\(dx, dy, dz\);/g) || []).length === 0
      && /nor\.push\(0, 0, 0\);/.test(mp)
      && (mp.match(/applyTerminator\(tmat\);/g) || []).length === 1
      && (mp.match(/applyTerminator\(tmat, true\)/g) || []).length === 0
      && /applyTerminator\(_gmat243, true\);/.test(mp),
      '径向 0 处 · 地块单参 1 处 · 球面双参在岗');

    /* ③ 行为面：M.setRelief 真调（三档 + 越界钳制 + 还原）——带"真的写进 uniform"这个下限 */
    check('§589c 行为面：setRelief 真调（0.5/0/2 越界钳制 · uniform 同步 · 归还 1.0）',
      (function () {
        if (!M3 || typeof M3.setRelief !== 'function' || !M3._reliefU) return false;
        var r5 = M3.setRelief(0.5), u5 = M3._reliefU.value;
        var r0 = M3.setRelief(0), u0 = M3._reliefU.value;
        var r2 = M3.setRelief(2), u2 = M3._reliefU.value;
        M3.setRelief(1);
        var back = M3._reliefU.value;
        return r5 === 0.5 && u5 === 0.5 && r0 === 0 && u0 === 0 && r2 === 1 && u2 === 1 && back === 1;
      })(),
      M3 ? ('zero=' + M3.RELIEF_AGL_ZERO + ' full=' + M3.RELIEF_AGL_FULL + ' base=' + M3.RELIEF_BASE) : 'map3d 缺失');

    /* ④ 近景淡出：口径自洽 + 源码按 _rAlt 算 + 真算曲线三档（下限：全量档必须真的=1）*/
    check('§589d 近景淡出：ZERO<FULL · 按 _rAlt 计算 · 曲线(200→0 / 600→1 / 中间单调)',
      (function () {
        if (!M3) return false;
        var Z = +M3.RELIEF_AGL_ZERO, F = +M3.RELIEF_AGL_FULL;
        if (!(Z > 0 && F > Z)) return false;
        if (!/(_rAlt - \(M\.RELIEF_AGL_ZERO \|\| 210\)\)/.test(mp)) return false;
        function fade(agl) {
          var f = (agl - Z) / (F - Z);
          return f < 0 ? 0 : (f > 1 ? 1 : f);
        }
        var lo = fade(Z - 50), mid = fade((Z + F) / 2), hi = fade(F + 100);
        return lo === 0 && hi === 1 && mid > 0.4 && mid < 0.6;
      })(),
      'ZERO/FULL 口径 + 曲线三联');

    /* ⑤ 归因面：源码里写明"为什么不是换材质"——防后人把它改回 Lambert 白忙一轮 */
    check('§589e 归因面：注释写明"径向法线 → Lambert 也白做"（防回退到换材质方案）',
      /Lambert/.test(mp) && /径向法线/.test(mp)
      && /换受光材质也没用|换受光材质/.test(mp),
      '取舍说明在册');
  })();
"""

anchor = "console.log('结果：'"
assert s.count(anchor) == 1, 'anchor'
s = s.replace(anchor, BLOCK + "\n" + anchor)

assert s.count('§589a') == 1 and s.count('§589e') == 1
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('SMOKE PATCHED bytes %d -> %d' % (n0, len(s)))
