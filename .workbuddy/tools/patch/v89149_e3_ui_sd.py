# -*- coding: utf-8 -*-
"""v89.149 批 E3：把"间距"整套文案统一为「最近距离」（沙盘面板 + 回放帧 + 事件行）
沙盘目标选项同步（去"目标："前缀 + 同兵种默认 + 只读行走唯一出口）"""
import io

PU = 'E:/Deepseekdb/js/ui.js'
PT = 'E:/Deepseekdb/js/tactic.js'
BU = 'E:/Deepseekdb/backup/v89149/ui.js.before'
BT = 'E:/Deepseekdb/backup/v89149/tactic.js.before'
u = io.open(PU, encoding='utf-8', newline='').read()
ub = io.open(BU, encoding='utf-8', newline='').read()
t = io.open(PT, encoding='utf-8', newline='').read()
tb = io.open(BT, encoding='utf-8', newline='').read()


def rep(s, old, new, tag, cnt=1):
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return s
    n = s.count(old)
    assert n == cnt, '锚点数不对 [' + tag + '] count=' + str(n) + ' 期望=' + str(cnt)
    s = s.replace(old, new)
    print('OK ' + tag + ' ×' + str(cnt))
    return s


# ---------- ① 沙盘目标选项（同兵种默认 + 去前缀） ----------
u = rep(u, """      var opts = '<option value="">目标：任意</option>';
      foe.forEach(function (d) {
        opts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>' +
          '目标：' + U.escape(d.name) + '</option>';
      });
      if (st.towers > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '') +
          '>目标：城防箭塔</option>';
      }""", """      /* v89.149（老板 4）：与战场同一口径 —— 同兵种（默认）/ 任意 / 兵种名 / 城防箭塔，
         不写"目标："前缀；默认值照样由**引擎**给（unitsOf），这里只回显。 */
      var opts = '<option value="' + u.id + '"' + (u.target === u.id ? ' selected' : '') + '>同兵种</option>'
        + '<option value=""' + (!u.target ? ' selected' : '') + '>任意</option>';
      foe.forEach(function (d) {
        if (d.id === u.id) return;
        opts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>'
          + U.escape(d.name) + '</option>';
      });
      if (st.towers > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '') +
          '>城防箭塔</option>';
      }""", 'sd 目标选项')

# ---------- ② 沙盘只读行走唯一出口 ----------
u = rep(u, """          : '<span class="sd-sel ro">' + (u.target === DATA.TARGET_WALL ? '目标：城防箭塔'
            : (u.target ? ('目标：' + U.escape(((foe.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
              : '目标：任意')) + '</span>') +""",
      """          : '<span class="sd-sel ro">' + ui.btTargetLabelOf(u, foe) + '</span>') +""",
      'sd 只读行目标')

# ---------- ③ 沙盘顶栏读数：最近距离 / 全局 ----------
u = rep(u, """        '<span>间距 <b id="sd-gap">' + U.numText(Math.round(fr.gap), 0) + '</b></span>' +""",
      """        /* v89.149（老板 7）：与战场顶栏同一口径「最近距离 / 全局」 */
        '<span>最近距离 <b id="sd-gap">' + U.numText(Math.round(fr.gap), 0) + '</b> / 全局 <b>'
          + U.numText(Math.round(sb.field || 0), 0) + '</b></span>' +""",
      'sd 顶栏读数')

# ---------- ④ "间距" → "最近距离"（回放帧 / 事件行 / 图例，两文件） ----------
u = rep(u, """'<span class="bt-g">间距 ' + U.numText(f.gap, 0) + '</span></div>' +""",
      """'<span class="bt-g">最近距离 ' + U.numText(f.gap, 0) + '</span></div>' +""",
      '回放帧 .bt-g', cnt=1)
u = rep(u, """'<span class="bt-g">间距 ' + U.numText(row.gap, 0) + '</span></div>'""",
      """'<span class="bt-g">最近距离 ' + U.numText(row.gap, 0) + '</span></div>'""",
      '回合表 .bt-g', cnt=1)
u = rep(u, """    if (e.kind === 'move') line = '🚶 ' + ui.btSideName(e.side) + ' ' + e.name + ' 前进 ' + U.numText(e.step, 0) + '（间距 ' + U.numText(e.gap, 0) + '）';""",
      """    if (e.kind === 'move') line = '🚶 ' + ui.btSideName(e.side) + ' ' + e.name + ' 前进 ' + U.numText(e.step, 0) + '（最近距离 ' + U.numText(e.gap, 0) + '）';""",
      'btEvent 移动行')
u = rep(u, """    if (k === 'm') return '🚶 第' + f[0] + '回合 ' + side + ' ' + nm + ' 前进 ' + U.numText(v1, 0) + '（间距 ' + U.numText(v2, 0) + '）';
    if (k === 'r') return '↩️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' 后退 ' + U.numText(v1, 0) + '（间距 ' + U.numText(v2, 0) + '）';""",
      """    if (k === 'm') return '🚶 第' + f[0] + '回合 ' + side + ' ' + nm + ' 前进 ' + U.numText(v1, 0) + '（最近距离 ' + U.numText(v2, 0) + '）';
    if (k === 'r') return '↩️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' 后退 ' + U.numText(v1, 0) + '（最近距离 ' + U.numText(v2, 0) + '）';""",
      '回放帧动作行')
u = rep(u, """\u3000·\u3000▓ 部队\u3000· 间距\u3000▕▏ 两军间距'""",
      """\u3000·\u3000▓ 部队\u3000· 最近距离\u3000▕▏ 两军间距'""",
      '旧战报图例')

t = rep(t, """'<span class="bt-g">间距 ' + U.numText(rr.gap, 0) + '</span></div>'""",
        """'<span class="bt-g">最近距离 ' + U.numText(rr.gap, 0) + '</span></div>'""",
        'tactic 回合纪要 .bt-g')
t = rep(t, """        : '两军推进（间距 ' + U.numText(Math.max(0, rr.gap), 0) + '）'));""",
        """        : '两军推进（最近距离 ' + U.numText(Math.max(0, rr.gap), 0) + '）'));""",
        'tactic 推进文案')

# 写后哨兵
# ⚠️ 不全局禁「间距」—— 引擎注释里大量使用（"间距 = 纵深 − 两方最前"）；
# 只要求**渲染文案**里没有裸的 `'间距 ` 字面量，其余逐条打印复核。
_left = [m.start() for m in __import__('re').finditer("间距", u)]
_rend = [k for k in _left if u[k - 1:k] in ("'", '"', '>', '\u3000', ' ')]
print('剩余「间距」共 ' + str(len(_left)) + ' 处；其中疑似渲染文案 ' + str(len(_rend)) + ' 处：')
for k in _rend[:12]:
    print('  ' + repr(u[max(0, k - 70):k + 20]))
assert (u.count('{') - u.count('}')) == (ub.count('{') - ub.count('}')), 'ui 花括号盈亏不一致'
assert (t.count('{') - t.count('}')) == (tb.count('{') - tb.count('}')), 'tactic 花括号盈亏不一致'
assert '\r\n' not in u and '\r\n' not in t
io.open(PU, 'w', encoding='utf-8', newline='').write(u)
io.open(PT, 'w', encoding='utf-8', newline='').write(t)
print('ui.js + tactic.js 落盘')
