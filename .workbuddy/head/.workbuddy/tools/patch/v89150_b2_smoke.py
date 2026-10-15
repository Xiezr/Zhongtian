# -*- coding: utf-8 -*-
# v89.150（老板 2）：smoke 收尾 —— tip-layer 距离放宽 + §120① 改缩放口径
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def patch(segs):
    global s
    for old, new, tag in segs:
        _cands = [l.strip() for l in new.split('\n') if l.strip()]
        _only = [c for c in _cands if c not in old]
        mark = max(_only or _cands, key=len)
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + '] mark=' + mark[:60])
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF 污染 [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag + '  (len=' + str(len(s)) + ')')


patch([
# ---------- ① tip-layer：注释把 z-index 推远 → 放宽上限 ----------
("""    /\\.tip-layer \\{[\\s\\S]{0,600}position: absolute/.test(hS38)
    && /\\.tip-layer \\{[\\s\\S]{0,200}z-index: 9000/.test(hS38));""",
 """    /\\.tip-layer \\{[\\s\\S]{0,600}position: absolute/.test(hS38)
    && /\\.tip-layer \\{[\\s\\S]{0,400}z-index: 9000/.test(hS38));""",
 '① tip-layer 上限'),

# ---------- ② §120① 令牌 ----------
("""    check('§120① 地图方向箭头已退役（老板「上下左右的箭头去掉」）+ 大屏铺满令牌', (function () {
      /* ⚠️ 不含「视野外的州城」（墓碑注释里有这五个字 —— §48.4 的老坑：负向断言查名字会命中墓碑） */
      return mp.indexOf("c4.x < px ? '◀' : '▶'") < 0
        && mp.indexOf("ctx.fillText(ch, px, py)") < 0
        && /function fitAppSize\\(\\)/.test(mc)
        && /setProperty\\('--app-w'/.test(mc)
        && /window\\.addEventListener\\('resize'/.test(mc);
    })());""",
 """    check('§120① 地图方向箭头已退役（老板「上下左右的箭头去掉」）+ 缩放令牌（v89.150）', (function () {
      /* ⚠️ 不含「视野外的州城」（墓碑注释里有这五个字 —— §48.4 的老坑：负向断言查名字会命中墓碑） */
      return mp.indexOf("c4.x < px ? '◀' : '▶'") < 0
        && mp.indexOf("ctx.fillText(ch, px, py)") < 0
        && /function fitAppSize\\(\\)/.test(mc)
        && /setProperty\\('--app-k'/.test(mc)
        && /window\\.addEventListener\\('resize'/.test(mc);
    })());""",
 '② §120① 令牌'),

# ---------- ③ §120① 实测口径 ----------
("""    check('§120① 实测：大屏（1920×1080）画布铺满视口（--app-w/h 随 innerWidth/Height）', (function () {
      /* 桩环境没有真视口 → 验"函数存在且取 max(1440, innerWidth)"的口径 */
      var fn = codeOf(mc, 'function fitAppSize()');
      return /Math\\.max\\(1440, window\\.innerWidth/.test(fn)
        && /Math\\.max\\(900, window\\.innerHeight/.test(fn);
    })());""",
 """    check('§120① 实测：画布等比缩放（v89.150 · k = min(w/1440, h/900) · 桩环境跳过）', (function () {
      /* 桩环境没有真视口 → 验"等比公式 + 没有容器就不动"的口径 */
      var fn = codeOf(mc, 'function fitAppSize()');
      return /Math\\.min\\(w \\/ 1440, h \\/ 900\\)/.test(fn)
        && /getElementById\\('app-scale'\\)/.test(fn);
    })());""",
 '③ §120① 实测'),
])

print('ALL OK · len=' + str(len(s)))
