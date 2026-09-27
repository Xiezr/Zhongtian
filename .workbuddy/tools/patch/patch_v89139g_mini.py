# -*- coding: utf-8 -*-
"""v89.139 批五：ui.js 缩略图「我城」档 + 默认只标当前城（老板 6）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① miniView：加 'mine' 档 ──
rep("""    if (v.level === 'zhou') {
      v.list = all.filter(function (c) { return c.type === 'zhou' || c.type === 'capital'; });
      v.hint = '全图 · 都城与州城 ' + v.list.length + ' 座';
    } else if (v.level === 'jun' || v.level === 'county') {""",
"""    if (v.level === 'mine') {
      /* v89.139（老板 6）：「在上方筛选处增加『我城』，选中之后在地图上显示我方所有城池的红点」
         —— 取景窗框住全部我方城池（点位很少，pad 给大些，免得贴边）。 */
      v.list = (GAME.state.cities || []).slice();
      v.win = ui.miniWindowOf(v.list, 16);
      v.hint = '我方城池 ' + v.list.length + ' 座（默认档只标当前城）';
    } else if (v.level === 'zhou') {
      v.list = all.filter(function (c) { return c.type === 'zhou' || c.type === 'capital'; });
      v.hint = '全图 · 都城与州城 ' + v.list.length + ' 座';
    } else if (v.level === 'jun' || v.level === 'county') {""",
    'miniView mine 档')

# ── ② drawMini：默认只画当前城 ──
rep("""    (s.cities || []).forEach(function (c) {
      var p = _win(c.x, c.y);
      if (!p) return;                       /* 窗外的我城不画 */
      if (c.id === ui._cityId) ctx.globalAlpha = _blink;
      ui.miniMeDot(ctx, p[0], p[1], size, !!(opts && opts.meBig));
      ctx.globalAlpha = 1;
    });
    if (opts && opts.labels) ui.miniMeLabels(ctx, size, v, _win);   /* 我城名称（红点旁） */""",
"""    /* v89.139（老板 6）：「地图缩略图中，我城的红点默认只显示当前玩家所在城池的点。
       在上方筛选处增加『我城』，选中之后…显示我方所有城池的红点」——
       默认档（level=''）只画 `ui._cityId` 那一个；切到「我城」档才画全部。 */
    var _allMine139 = (v.level === 'mine');
    (s.cities || []).forEach(function (c) {
      if (!_allMine139 && c.id !== ui._cityId) return;   /* 默认档：只标当前城 */
      var p = _win(c.x, c.y);
      if (!p) return;                       /* 窗外的我城不画 */
      if (c.id === ui._cityId) ctx.globalAlpha = _blink;
      ui.miniMeDot(ctx, p[0], p[1], size, !!(opts && opts.meBig));
      ctx.globalAlpha = 1;
    });
    if (opts && opts.labels) ui.miniMeLabels(ctx, size, v, _win);   /* 我城名称（红点旁） */""",
    'drawMini 默认只当前城')

# ── ③ miniMeLabels：同上 ──
rep("""  ui.miniMeLabels = function (ctx, size, v, win) {
    var s = GAME.state, K = ui.MINI_LABEL;
    var list = (s.cities || []).slice().sort(function (a, b) {
      return ((a.id === ui._cityId) ? 1 : 0) - ((b.id === ui._cityId) ? 1 : 0);   /* 当前城最后画 */
    });""",
"""  ui.miniMeLabels = function (ctx, size, v, win) {
    var s = GAME.state, K = ui.MINI_LABEL;
    /* v89.139（老板 6）：默认档只标当前城名；「我城」档标全部（与红点同一判据）。 */
    var _allMine = (v && v.level === 'mine');
    var list = (s.cities || []).filter(function (c) {
      return _allMine || c.id === ui._cityId;
    }).sort(function (a, b) {
      return ((a.id === ui._cityId) ? 1 : 0) - ((b.id === ui._cityId) ? 1 : 0);   /* 当前城最后画 */
    });""",
    'miniMeLabels 过滤')

# ── ④ 筛选下拉加「我城」 ──
rep("""    var LV = [['', '全部'], ['zhou', '州城'], ['jun', '郡城'], ['county', '县城']];""",
"""    /* v89.139（老板 6）：加「我城」档（画全部我方城池红点 + 取景窗框住它们） */
    var LV = [['', '全部'], ['mine', '我城'], ['zhou', '州城'], ['jun', '郡城'], ['county', '县城']];""",
    'LV 加我城')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert "_allMine139" in chk and "['mine', '我城']" in chk, '落盘校验失败'
print('✅ ui.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
