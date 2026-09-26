# -*- coding: utf-8 -*-
"""
v89.127 补丁 A：两处"零取舍"质量修（研判后直接做，不等拍板）
  ① state.js 迁移段：城墙入城**不再静默**（无空地时会覆盖原建筑，写进公文/消息流）
  ② state.js U.fmt：1 千~1 万段的英文 'k' 退役 → 逗号千分位（1,500）
手法：读 → 改内存 → 自检 → 原子写（项目规矩：永不边读边写）
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'js/state.js'
s = io.open(P, encoding='utf-8').read()
orig = s

# ---------- ① U.fmt：k 退役 ----------
old1 = """  U.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return '' + n;
  };"""
new1 = """  U.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    /* v89.127：1 千~1 万段原用英文 'k'（如 "1.5k"）—— 整个中文界面唯一的英文单位，
       改**逗号千分位**（1500 → "1,500"），与「万 / 亿」体系同气。 */
    return U.numText(n, 0);
  };"""
assert s.count(old1) == 1, '① 锚点 %d 个' % s.count(old1)
s = s.replace(old1, new1)

# ---------- ①b U.amtHTML 注释里的旧说法 ----------
old1b = """     与 `U.fmt` 的分工：fmt 用 \"k\" 这种非中文单位、且 Math.floor 掉零头，
     适合日志与概览；这里供**存量**用，取整规则是\"够用就好\"。"""
new1b = """     与 `U.fmt` 的分工：fmt 会 Math.floor 掉零头（≥1 万走\"万\"缩写、千级用千分位），
     适合日志与概览；这里供**存量**用，取整规则是\"够用就好\"。"""
if s.count(old1b) == 1:
    s = s.replace(old1b, new1b)
else:
    print('（提示）amtHTML 注释锚点 %d 个，跳过' % s.count(old1b))

# ---------- ② 迁移提示 ----------
old2 = """          var put126 = free126 >= 0 ? free126 : low126;
          if (put126 >= 0) {
            c.cells[put126].build = { id: 'chengqiang', lvl: wlv126 };
            c.cells[put126].pending = null;
          }"""
new2 = """          var put126 = free126 >= 0 ? free126 : low126;
          if (put126 >= 0) {
            /* v89.127：入城迁移**不再静默** —— 无空地时会覆盖一座原建筑（有损迁移），
               把账写进公文 / 消息流，玩家翻得到\"哪一格被征用了、原是什么\"。 */
            var old126 = '';
            if (free126 < 0 && c.cells[put126].build) {
              var ob126 = DATA.BUILDINGS[c.cells[put126].build.id];
              old126 = '（原为 ' + (ob126 ? ob126.name : c.cells[put126].build.id)
                + ' Lv' + (c.cells[put126].build.lvl || 1) + '）';
            }
            c.cells[put126].build = { id: 'chengqiang', lvl: wlv126 };
            c.cells[put126].pending = null;
            var _m126 = free126 >= 0
              ? '🏯 城墙入城：『' + c.name + '』城墙已纳入城内建筑（占一格，与其他建筑统一管理 · Lv' + wlv126 + '）'
              : '🏯 城墙入城：『' + c.name + '』城内已无空地，城墙征用了一格' + old126 + ' —— 城内部署请留意';
            st.log = st.log || [];
            st.log.unshift({ t: U.now(), msg: _m126 });
            if (st.log.length > 40) st.log.pop();
            st.msgLog = st.msgLog || [];
            st.msgLog.push({ t: U.now(), gt: (st.world && st.world.elapsed) || 0, msg: _m126, k: 'sys' });
          }"""
assert s.count(old2) == 1, '② 锚点 %d 个' % s.count(old2)
s = s.replace(old2, new2)

# ---------- 写前自检 ----------
assert s != orig, '没有任何改动'
assert 'U.numText(n, 0)' in s and '_m126' in s


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


# "替换段差值"判据：新段与旧段的括号盈亏必须一致（全文件字符计数会被
# 字符串/正则/注释里的花括号污染 —— 1150/1152 是原文件本来就有的，别误伤）
assert bal(new1) == bal(old1), '① 段括号差 %s vs %s' % (bal(new1), bal(old1))
assert bal(new2) == bal(old2), '② 段括号差 %s vs %s' % (bal(new2), bal(old2))
assert bal(s) == bal(orig), '整体括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))

io.open(P, 'w', encoding='utf-8').write(s)
print('patch A OK · 改动 %d 处' % 2)
