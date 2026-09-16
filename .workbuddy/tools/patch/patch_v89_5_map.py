# -*- coding: utf-8 -*-
"""v89.5 地图补丁：drawJhPennant（江湖旗画笔）+ 野地信息层接线"""
import io

P = r'E:\Deepseekdb\js\map.js'
d = io.open(P, encoding='utf-8', newline='').read()

# ① 私有画笔：青旗（挂在等级角标右侧）—— 追加在 drawFortArt 之后
OLD1 = """    var ft = isoBox(ctx, gx2, gy2, baseW * 0.13, baseW * 0.09, WOOD, 'rgba(255,255,255,.20)');
    isoRoof(ctx, gx2, ft.ty, baseW * 0.16, baseW * 0.06, ROOF);
  }
"""

NEW1 = """    var ft = isoBox(ctx, gx2, gy2, baseW * 0.13, baseW * 0.09, WOOD, 'rgba(255,255,255,.20)');
    isoRoof(ctx, gx2, ft.ty, baseW * 0.16, baseW * 0.06, ROOF);
  }

  /* ============================================================
   * v89.5（老板：「按建议进行」）：灵机之地 · 灵机旗
   * ------------------------------------------------------------
   * 野地之事已逐地概率化（v89.4），需要"一眼看到哪有江湖事"的地标。
   * 判定「灵机」= 事数 × 等级（GAME.jianghuSpotInfo，唯一出口）——
   * 达阈者在**等级角标右侧**悬一面青旗：
   *   · 只借角标右侧那一小片空当 —— 菱形格内其余空间已被 名带 / 角标 占满
   *     （上顶点被角标顶到、下半部是名带），这是格内唯一不撞已有元素的落点；
   *   · 青碧色在现有调色盘（土黄 / 绿族 / 水蓝 / 金）中没有同族 —— 一眼可辨；
   *   · ⛔ 零三角函数、零仿射变换（v50 全文件守卫：只用直线原语）。
   * ============================================================ */
  function drawJhPennant(ctx, bx, by) {
    var poleX = bx + 13.5, top = by - 8;         /* by = 角标中心行 */
    ctx.strokeStyle = 'rgba(24,58,50,.92)';      /* 旗杆：深青（衬任何地形） */
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poleX, top);
    ctx.lineTo(poleX, by + 7);
    ctx.stroke();
    ctx.beginPath();                             /* 旗面：青碧三角，朝右迎风 */
    ctx.moveTo(poleX, top + 0.4);
    ctx.lineTo(poleX + 7.6, by - 3.6);
    ctx.lineTo(poleX, by + 0.4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(126,226,198,.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,46,40,.85)';      /* 描边：暗青，压住地形杂色 */
    ctx.lineWidth = 1;
    ctx.stroke();
  }
"""

assert d.count(OLD1) == 1, ('map 锚点①', d.count(OLD1))
d = d.replace(OLD1, NEW1, 1)

# ② 野地信息层：角标画完后接线悬旗
OLD2 = """        ctx.fillText(String(lv), bx, by + 0.5);
      }
    });
"""

NEW2 = """        ctx.fillText(String(lv), bx, by + 0.5);
        /* v89.5：灵机之地 —— 事数 × 等级 达阈者，角标侧悬青旗（江湖事地标） */
        var jhM5 = GAME.jianghuSpotInfo(d.gx, d.gy);
        if (jhM5 && jhM5.mark) drawJhPennant(ctx, bx, by);
      }
    });
"""

assert d.count(OLD2) == 1, ('map 锚点②', d.count(OLD2))
d = d.replace(OLD2, NEW2, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK map.js: drawJhPennant + 渲染接线 已写入')
