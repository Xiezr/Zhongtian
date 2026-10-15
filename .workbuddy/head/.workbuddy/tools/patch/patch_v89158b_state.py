# -*- coding: utf-8 -*-
# v89.158 补丁 B：state.js —— 三处"削顶"改"只封自然增长、不削已有存量"
# （老板 1 的深层口径：容量显示与实际行为必须一致；实测超上限 133 万被静默削掉）
import io

P = 'E:/Deepseekdb/js/state.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

# ---------- 段 1：tickOnce（在线 · 逐秒） ----------
OLD1 = u"""      for (var rk2 in p) {
        if (rk2 === 'pop') continue;
        R[rk2] = (R[rk2] || 0) + p[rk2];
        /* 仓库只管粮木石铁四类实物，**黄金是货币，不受储量上限约束**
           （此前黄金一并被 cap 卡住，表现为「黄金涨到 N 万就不再增长」） */
        if (rk2 !== 'gold' && cap > 0 && R[rk2] > cap) R[rk2] = cap;
      }"""
NEW1 = u"""      for (var rk2 in p) {
        if (rk2 === 'pop') continue;
        /* v89.158（老板 1）：**只封"自然增长"，不削已有存量** ——
           改前是 `R += p; if (R > cap) R = cap`：奖励类入账（宝箱/纪事/市易）把资源
           顶到上限之上后，**下一 tick 被静默削回 cap**（实测 500 万 → 366.7 万，丢 133 万）。
           仓库面板的文案本来就是"超出部分将停止增长"——现在代码与文案一致。
           黄金是货币，不受储量上限约束（同前口径）。 */
        if (rk2 === 'gold' || !(cap > 0)) {
          R[rk2] = (R[rk2] || 0) + p[rk2];
        } else if ((R[rk2] || 0) < cap) {
          R[rk2] = Math.min(cap, (R[rk2] || 0) + p[rk2]);
        }
        /* 已达 / 超上限：不增不减（存量保留） */
      }"""
c = s.count(OLD1)
assert c == 1, 'B1 anchor count=' + str(c)
s = s.replace(OLD1, NEW1)
done.append('1 OK')

# ---------- 段 2：simulateBulk（离线补算 · 逐城） ----------
OLD2 = u"""      for (var k in prod) {
        if (k === 'pop') continue;
        R[k] = (R[k] || 0) + prod[k] * secReal;
        /* 黄金不受仓库上限约束（同在线口径） */
        if (k !== 'gold' && cap > 0 && R[k] > cap) R[k] = cap;
      }"""
NEW2 = u"""      for (var k in prod) {
        if (k === 'pop') continue;
        /* v89.158：只封增长、不削存量（与在线 tickOnce 同一口径） */
        if (k === 'gold' || !(cap > 0)) {
          R[k] = (R[k] || 0) + prod[k] * secReal;
        } else if ((R[k] || 0) < cap) {
          R[k] = Math.min(cap, (R[k] || 0) + prod[k] * secReal);
        }
      }"""
c2 = s.count(OLD2)
assert c2 == 1, 'B2 anchor count=' + str(c2)
s = s.replace(OLD2, NEW2)
done.append('2 OK')

# ---------- 段 3：simulateOfflineOverflow（离线溢出五折 · 逐城） ----------
OLD3 = u"""      for (var k in prod) {
        if (k === 'pop') continue;
        R[k] = (R[k] || 0) + prod[k] * secReal * rate;
        if (k !== 'gold' && cap > 0 && R[k] > cap) R[k] = cap;
      }"""
NEW3 = u"""      for (var k in prod) {
        if (k === 'pop') continue;
        /* v89.158：只封增长、不削存量（同在线口径） */
        if (k === 'gold' || !(cap > 0)) {
          R[k] = (R[k] || 0) + prod[k] * secReal * rate;
        } else if ((R[k] || 0) < cap) {
          R[k] = Math.min(cap, (R[k] || 0) + prod[k] * secReal * rate);
        }
      }"""
c3 = s.count(OLD3)
assert c3 == 1, 'B3 anchor count=' + str(c3)
s = s.replace(OLD3, NEW3)
done.append('3 OK')

io.open(P, 'w', encoding='utf-8', newline='').write(s)

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'只封') >= 3, 'guards count'
assert chk.count(u'if (rk2 !== \'gold\' && cap > 0 && R[rk2] > cap) R[rk2] = cap;') == 0, 'old1 remains'
assert chk.count(u'if (k !== \'gold\' && cap > 0 && R[k] > cap) R[k] = cap;') == 0, 'old2/3 remain'
print('patch B done:', done, 'len', orig, '->', len(chk))
