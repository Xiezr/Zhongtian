# -*- coding: utf-8 -*-
"""v89.117 补丁 H4 —— 六条断言/样式适配（§97 首跑 + 两条旧口径 + 标尺）

1. 「军务总览五段就位」：⑤ 段本轮由「伤兵」扩为「两营（伤兵 · 俘虏）」→ 判据升级
2. 「行军视图含伤兵营」：总览页改走 `ui.campCard('wounded',{compact:true})`（两营并列）→ 判据升级
3. CSS 标尺锁：`.mt-n` 用了 3px 字面值 → 改 `var(--sp-0)`
4. §97 ① 俘虏规则：上限文案走 `U.numText`（3,000 带千分位）→ 判据按同一出口比
5. §97 ② 可出征者：新局只有 2 位将（含君主）→ 用例自带前置（不够就造）
6. §97 ⑦ 阵亡变暗：源码判据的收尾符号写死 → 放宽
"""
import io, os, sys

R = 'E:/Deepseekdb/'


def load(p):
    return io.open(R + p, encoding='utf-8').read()


def save(p, s):
    tmp = R + p + '.tmp117h4'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)


# ---------------------------------------------------------------- smoke：三条适配
s = load('smoke-test.js')
FIX = [
    # ① 五段 → ⑤ 两营
    ("""  check('军务总览五段就位（城内 / 驻守野地 / 采集队 / 行军 / 伤兵）',
    /① 城内/.test(uS31) && /② 驻守野地/.test(uS31) && /③ 采集队/.test(uS31)
    && /④ 行军/.test(uS31) && /⑤ 伤兵/.test(uS31));""",
     """  /* v89.117（老板「还是没有俘虏营…要让玩家看得到」）：⑤ 段由「伤兵」扩为
     「两营（伤兵 · 俘虏）」—— 军务的**默认页签**上就要看得见两营。 */
  check('军务总览五段就位（城内 / 驻守野地 / 采集队 / 行军 / **两营**）',
    /① 城内/.test(uS31) && /② 驻守野地/.test(uS31) && /③ 采集队/.test(uS31)
    && /④ 行军/.test(uS31) && /⑤ 两营/.test(uS31)
    && /campCard\\('wounded', \\{ compact: true \\}\\)/.test(uS31)
    && /campCard\\('captive', \\{ compact: true \\}\\)/.test(uS31));"""),
    # ② 行军视图含伤兵营（改走两营紧凑卡）
    ("""  check('行军视图含伤兵营', /woundedBlock\\('view'\\)/.test(uS34));""",
     """  /* v89.117：军务总览的 ⑤ 段改走**两营紧凑卡**（伤兵 + 俘虏并列），
     不再是单独的 woundedBlock('view') —— 唯一落点仍在军务处 full 卡。 */
  check('行军视图（军务总览）含两营紧凑卡',
    /campCard\\('wounded', \\{ compact: true \\}\\)/.test(uS34)
    && /campCard\\('captive', \\{ compact: true \\}\\)/.test(uS34));"""),
    # ④ 俘虏规则：上限走 U.numText（3,000）
    ("""      return h.indexOf(rate + '%') >= 0
        && h.indexOf(String(D97.CAPTIVE.cap)) >= 0
        && h.indexOf('收编为民') >= 0 && h.indexOf('释放') >= 0
        && /野地|据点|名城|守城得手/.test(h);""",
     """      /* ⚠️ 数字一律走**同一出口**（U.numText：3000 → "3,000"）——
         首版拿 String(3000) 去 indexOf，被判据自己判错（白查一轮）。 */
      return h.indexOf(rate + '%') >= 0
        && h.indexOf(U.numText(D97.CAPTIVE.cap, 0)) >= 0
        && h.indexOf('收编为民') >= 0 && h.indexOf('释放') >= 0
        && /野地|据点|名城|守城得手/.test(h);"""),
    # ⑤ 可出征者：自带前置（新局只有 2 位将）
    ("""        var gs = st.generals.slice(0, 3);
        if (gs.length < 3) return false;
        gs[0].status = 'mayor'; gs[1].status = 'guard'; gs[2].status = 'idle';""",
     """        /* 新局只有 2 位将（君主 + 一位）—— 用例自带前置：不够就造一位 */
        while (st.generals.length < 3) {
          st.generals.push(G.makeGeneral('v117备将' + st.generals.length, 10, 'idle',
            G.currentCity() ? G.currentCity().id : null, false));
        }
        var gs = st.generals.slice(0, 3);
        gs[0].status = 'mayor'; gs[1].status = 'guard'; gs[2].status = 'idle';"""),
    # ⑥ 阵亡变暗：源码判据放宽收尾符号
    ("""        && /#bt-field \\[data-bside="' \\+ pair\\[0\\] \\+ '"\\]\\[data-troop="' \\+ u\\.id \\+ '"\\];/.test(u97)""",
     """        && /#bt-field \\[data-bside="' \\+ pair\\[0\\] \\+ '"\\]\\[data-troop="' \\+ u\\.id \\+ '"\\]/.test(u97)"""),
]
for i, (a, b) in enumerate(FIX):
    n = s.count(a)
    if n != 1:
        print('!! 段 %d 匹配 %d 次' % (i + 1, n)); sys.exit(1)
    s = s.replace(a, b, 1)
    print('  ✓ smoke 适配 %d' % (i + 1))
b0 = load('.workbuddy/backup/v89117/smoke-test.js')
print('  花括号净变化 %+d' % ((s.count('{') - s.count('}')) - (b0.count('{') - b0.count('}'))))
save('smoke-test.js', s)

# ---------------------------------------------------------------- CSS 标尺
h = load('index.html')
OLD = """  .march-tabs .mt-n { display: inline-block; min-width: 14px; height: 14px; line-height: 14px;
    margin-left: 3px; padding: 0 3px; border-radius: var(--r-lg); background: rgba(var(--foe-rgb), .9);"""
NEW = """  /* ⚠️ 尺寸一律走标尺（3px 是标尺外字面值 —— 标尺锁会拦） */
  .march-tabs .mt-n { display: inline-block; min-width: 14px; height: 14px; line-height: 14px;
    margin-left: var(--sp-0); padding: 0 var(--sp-0); border-radius: var(--r-lg); background: rgba(var(--foe-rgb), .9);"""
if h.count(OLD) != 1:
    print('!! CSS 锚点 %d' % h.count(OLD)); sys.exit(1)
h = h.replace(OLD, NEW, 1)
print('  ✓ CSS .mt-n 归标尺')
save('index.html', h)
print('补丁 H4 完成')
