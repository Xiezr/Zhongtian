# -*- coding: utf-8 -*-
"""v89.6 地图补丁：drawWonderStar（奇缘星）+ 渲染接线"""
import io

P = r'E:\Deepseekdb\js\map.js'
d = io.open(P, encoding='utf-8', newline='').read()

# ① 画笔：四芒星（写在 drawJhPennant 之后）
OLD1 = """    ctx.strokeStyle = 'rgba(18,46,40,.85)';      /* 描边：暗青，压住地形杂色 */
    ctx.lineWidth = 1;
    ctx.stroke();
  }
"""
NEW1 = """    ctx.strokeStyle = 'rgba(18,46,40,.85)';      /* 描边：暗青，压住地形杂色 */
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：奇缘星
   * ------------------------------------------------------------
   * 已现形、未探的奇遇点位，在角标**左侧**缀一颗四芒星（青莲紫）。
   * 与青旗（右侧 · 青碧 · 质量标记）左右分居、互不打架：
   *   ✦ 是"未知的邀约"，旗是"已知的价值"。
   * ⛔ 零三角函数：八角顶点全部写死；零仿射（v50 全文件守卫）。
   * ============================================================ */
  function drawWonderStar(ctx, bx, by) {
    var sx = bx - 16.5, sy = by - 3.5;           /* 星心：角标左外一小步 */
    /* 双多边形（深底星做大一号当描边 + 宽体主星）——
       v1 用 1px stroke 描边：细星轮廓的描边几乎把实心吃光，真机实测纯色只剩 2px；
       宽体主星（尖宽 4.8px）才是"一眼可见"的关键。零三角函数：顶点全部写死。 */
    polyFill(ctx, [[sx, sy - 7.0], [sx + 2.2, sy - 2.2], [sx + 7.0, sy], [sx + 2.2, sy + 2.2],
      [sx, sy + 7.0], [sx - 2.2, sy + 2.2], [sx - 7.0, sy], [sx - 2.2, sy - 2.2]], 'rgba(44,28,66,.85)');
    polyFill(ctx, [[sx, sy - 5.6], [sx + 2.4, sy - 2.4], [sx + 5.6, sy], [sx + 2.4, sy + 2.4],
      [sx, sy + 5.6], [sx - 2.4, sy + 2.4], [sx - 5.6, sy], [sx - 2.4, sy - 2.4]], 'rgba(206,166,255,.96)');
  }
"""
assert d.count(OLD1) == 1, ('map 锚点①', d.count(OLD1))
d = d.replace(OLD1, NEW1, 1)

# ② 渲染接线（野地信息层：角标画完后）
OLD2 = """        ctx.fillText(String(lv), bx, by + 0.5);
        /* v89.5：灵机之地 —— 事数 × 等级 达阈者，角标侧悬青旗（江湖事地标） */
        var jhM5 = GAME.jianghuSpotInfo(d.gx, d.gy);
        if (jhM5 && jhM5.mark) drawJhPennant(ctx, bx, by);
      }
    });
"""
NEW2 = """        ctx.fillText(String(lv), bx, by + 0.5);
        /* v89.5：灵机之地 —— 事数 × 等级 达阈者，角标侧悬青旗（江湖事地标） */
        var jhM5 = GAME.jianghuSpotInfo(d.gx, d.gy);
        if (jhM5 && jhM5.mark) drawJhPennant(ctx, bx, by);
        /* v89.6：奇遇点位（已现形未探）—— 角标左侧缀一颗「奇缘星」 */
        var wd6 = GAME.wonderSiteOf ? GAME.wonderSiteOf(d.gx, d.gy) : null;
        if (wd6 && wd6.revealed && !wd6.done) drawWonderStar(ctx, bx, by);
      }
    });
"""
assert d.count(OLD2) == 1, ('map 锚点②', d.count(OLD2))
d = d.replace(OLD2, NEW2, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK map.js: drawWonderStar + 渲染接线 已写入')
