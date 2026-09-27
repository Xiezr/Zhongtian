# -*- coding: utf-8 -*-
"""v89.139 批六：main.js（采集不重开 + 大屏铺满）+ map.js（去掉视野外方向箭头）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for old, new, tag in pairs:
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' 行尾混入 CRLF'
    assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp139'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))
    return chk


# ══════ main.js ══════
chkMain = patch('js/main.js', [
    # ① 采集点击不重开面板
    ("""        var _gr = GAME.startGather(_gx, _gy, U.deep(_gg.troops), {});   /* v89.136：新签名 */
        ui.toast(_gr.msg);
        if (_gr.ok) { GAME.refreshAll(); ui.openLandModal(_gx, _gy); }
        break;""",
     """        var _gr = GAME.startGather(_gx, _gy, U.deep(_gg.troops), {});   /* v89.136：新签名 */
        ui.toast(_gr.msg);
        /* v89.139（老板 2）：「点击采集不要出现页面、界面跳转，直接后台开始计时即可」——
           不再重开面板（地块面板带 live 逐秒刷新，会自然切到"采集中"形态）；
           刷新总览即可（军务/资源区的采集标记跟着更新）。 */
        if (_gr.ok) GAME.refreshAll();
        break;""",
     'main 采集不重开'),
    # ② 大屏铺满（--app-w/--app-h 按视口改写）
    ("""  function boot() {
    bindEvents();""",
     """  /* v89.139（老板 0 · 上轮清单①）：「地图铺满」—— 大屏（> 1440×900）时界面**铺满视口**，
     小屏仍保 1440×900 基准（内部一格不重排，超出部分滚动）。
     实现 = 按视口改写 CSS 令牌 --app-w / --app-h（画布尺寸的唯一来源，见 index.html v74 注释）；
     地图/棋盘等全部读 `ui.viewBoxSize()`（读 #view-container 实测尺寸）→ 天然跟随。
     桩环境（jsdom / 无 style.setProperty）静默跳过 → 测试仍按 1440×900 基准。 */
  function fitAppSize() {
    try {
      var w = Math.max(1440, window.innerWidth || 1440);
      var h = Math.max(900, window.innerHeight || 900);
      var el = document.documentElement;
      if (!el || !el.style || !el.style.setProperty) return;
      el.style.setProperty('--app-w', w + 'px');
      el.style.setProperty('--app-h', h + 'px');
    } catch (e) { /* 桩环境：保持 CSS 默认 */ }
  }
  GAME.fitAppSize = fitAppSize;

  function boot() {
    fitAppSize();
    try {
      window.addEventListener('resize', function () {
        fitAppSize();
        /* 尺寸变了要重排地图（fitMapCell 读容器实测尺寸）——延后一拍，等布局落定 */
        setTimeout(function () { try { ui.renderMapCanvas(); } catch (e) { } }, 120);
      });
    } catch (e) { }
    bindEvents();""",
     'main 大屏铺满'),
])

# ══════ map.js ══════
chkMap = patch('js/map.js', [
    ("""    /* ---- ⑧ 视野外的州城/都城：边缘方向提示 ----
       菱形视野不是矩形，判定改为"投影到屏幕后是否落在画布内"。 */
    (s.map.cities || []).forEach(function (cy4) {
      if (cy4.type !== 'capital' && cy4.type !== 'zhou') return;
      var c4 = gxy(cy4.x, cy4.y);
      var M = 8;
      if (c4.x >= -M && c4.x <= cvW + M && c4.y >= -M && c4.y <= cvH + M) return;
      var px = Math.max(14, Math.min(cvW - 14, c4.x));
      var py = Math.max(16, Math.min(cvH - 16, c4.y));
      var ch = Math.abs(c4.x - px) > Math.abs(c4.y - py)
        ? (c4.x < px ? '◀' : '▶') : (c4.y < py ? '▲' : '▼');
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'rgba(232,206,136,.92)';
      ctx.fillText(ch, px, py);
    });""",
     """    /* ⛔ v89.139（老板 1）：「目前地图中有几个上下左右的箭头，去掉」——
       原「⑧ 视野外的州城/都城：边缘方向提示」（把视野外的名城投影到画布边缘、画 ◀▶▲▼）
       **整段退役**。它的信息（城在哪个方向）由缩略图/小地图承载，主图不再挂箭头。
       如需恢复：见 backup/v89139/map.js。 */""",
     'map 箭头退役'),
])

assert 'fitAppSize' in chkMain and 'GAME.fitAppSize = function' in chkMain
assert '◀' not in chkMap or "c4.x < px" not in chkMap, 'map 箭头未净'
print('✅ 全部完成：' + ' / '.join(ok))
