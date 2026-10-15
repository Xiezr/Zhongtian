# -*- coding: utf-8 -*-
"""v89.194 批次E：己方前哨雷达辐射圈（map.js）"""
import io

R = 'E:/Deepseekdb/'
MAP = R + 'js/map.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败'
    print('[ok] ' + tag)

E_OLD = """    /* ---- ④ 已占野地：金色菱形框（描在**顶面**上，不框到侧壁） ---- */"""
E_NEW = """    /* ---- ④a 己方前哨：雷达辐射圈（v89.194 老板） ----
       老板原话：「己方前哨在地图上渲染一个圆形雷达扫描圈，提示其辐射范围，
       以前哨为中心，根据等级设计半径，颜色浅，边缘相对清晰（但也不要遮盖原地图地块）」。
       几何：逻辑半径 R 格（GAME.fortRadiusOf 唯一出口，逐哨 6~14）× 等距投影 ——
       屏幕半轴 = √2·R·HW（横）/ √2·R·HH（纵）（推导：u=gx−gy、v=gx+gy 把
       dx²+dy²≤R² 映成 (sx/HW)²+(sy/HH)² ≤ 2R²）。
       判定同源：GAME.fortAuraAt 自 v89.194 起同为欧氏 —— **圈画多大、覆盖就多大**。
       图层：画在地块之上、一切标记物（野地框 / 据点 / 城池 / 名带）之下 ——
       只提示范围，不遮任何图标；填充 alpha 0.055 = 地块纹理透得出来（老板："不要遮盖原地图地块"）。
       相位：主循环每秒重绘 → 描边透明度按 500ms 相位交替，读起来是"扫描"的呼吸。 */
    (function () {
      if (!ctx || !ctx.ellipse) return;              /* 能力判据（桩环境无 canvas 2d） */
      var fs194 = (GAME.fortsOf ? GAME.fortsOf() : null) || {};
      var ringA194 = (Math.floor(Date.now() / 500) % 2) ? 0.62 : 0.42;   /* 描边"扫描"相位 */
      for (var k194 in fs194) {
        var f194 = fs194[k194];
        if (!f194 || !f194.cityId) continue;         /* 只画**己方前哨**（老板口径） */
        if (f194.x < gx0 - 16 || f194.x > gx1 + 16 || f194.y < gy0 - 16 || f194.y > gy1 + 16) continue;
        var R194 = GAME.fortRadiusOf(f194) || 0;
        if (!(R194 > 0)) continue;
        var c194 = gxy(f194.x, f194.y);
        var rx194 = R194 * HW * 1.4142, ry194 = R194 * HH * 1.4142;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(c194.x, c194.y, rx194, ry194, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(140,220,170,.055)';    /* 极淡填充：不遮盖地块 */
        ctx.fill();
        ctx.beginPath();                             /* 内圈：雷达刻度感（更淡） */
        ctx.ellipse(c194.x, c194.y, rx194 * 0.5, ry194 * 0.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(150,230,175,.14)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();                             /* 主圈：边缘相对清晰 */
        ctx.ellipse(c194.x, c194.y, rx194, ry194, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168,235,188,' + ringA194 + ')';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    })();

    /* ---- ④ 已占野地：金色菱形框（描在**顶面**上，不框到侧壁） ---- */"""
rep(MAP, 'E 前哨雷达圈', E_OLD, E_NEW, '---- ④a 己方前哨：雷达辐射圈（v89.194 老板） ----')

print('\n批次 E 完成。')
