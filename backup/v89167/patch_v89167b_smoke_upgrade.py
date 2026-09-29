# -*- coding: utf-8 -*-
"""v89.167b：smoke 旧断言升级（自动升级"一次排满各城"新口径）。
   运行：python .workbuddy/tools/patch/patch_v89167b_smoke_upgrade.py"""
import io

R = 'E:/Deepseekdb/'


def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


def rep(tag, old, new, guard):
    s = rd('smoke-test.js')
    if guard in s:
        print('  [skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, '%s 锚点计数=%d' % (tag, c)
    wr('smoke-test.js', s.replace(old, new))
    print('  [ ok ] ' + tag)


# ═══ ① 「升级已进入建造队列」：=== 1 → ≥ 1（一次排满）═══
rep('① 建造队列 >=1',
    """  check('升级已进入建造队列', S21.queues.build.length === 1, S21.queues.build.length + ' 个队列');""",
    """  /* v89.167（老板 · 每城独立建造位）：一次调用**把各城空位排满**（不再一条一条来）——
     原断言 `=== 1` 是"一次一条"的旧口径。 */
  check('升级已进入建造队列（v89.167：一次调用即排入）',
    S21.queues.build.length >= 1, S21.queues.build.length + ' 个队列');""",
    guard='升级已进入建造队列（v89.167：一次调用即排入）')

# ═══ ② 「继续排队下一个」→ 核心口径断言：各城不超各自位 ═══
rep('② 各城不超各自位',
    """  /* 同级时城内优先 */
  var au2 = G.autoUpgrade();
  check('继续排队下一个', !!(au2 && au2.ok), au2 && au2.target ? au2.target.name : '—');
  var slots21 = G.buildSlots();
  check('队列上限生效（不无限排队）', S21.queues.build.length <= slots21,
    S21.queues.build.length + ' / 上限 ' + slots21);""",
    """  /* v89.167（老板）：核心口径 = **各城不超各自建造位**（改前 = 全境合计受"当前城位"压 ——
     全境一共只排 3 条）。一次调用后再来一次，逐城核对不越界。 */
  var au2 = G.autoUpgrade();
  var usedByCity21 = {};
  S21.queues.build.forEach(function (q) { usedByCity21[q.cityId] = (usedByCity21[q.cityId] || 0) + 1; });
  check('★ 各城不超各自建造位（v89.167 每城独立 · 不再全境合抢一个额度）',
    S21.cities.every(function (c) { return (usedByCity21[c.id] || 0) <= G.buildSlots(c); }),
    JSON.stringify(usedByCity21));
  var slots21 = G.buildSlots();
  check('本城队列不超上限', (usedByCity21[city21.id] || 0) <= slots21,
    (usedByCity21[city21.id] || 0) + ' / 上限 ' + slots21);""",
    guard='★ 各城不超各自建造位（v89.167 每城独立')

# ═══ ③ 「队列满时不再排队」：au3 允许 paused（非 null）—— 改成"不再排入" ═══
rep('③ 不再排入（非 ok）',
    """  check('队列满时不再排队', S21.queues.build.length === full21 && au3 === null,
    S21.autoState && S21.autoState.msg);""",
    """  /* v89.167：全境视角下"某城满、他城缺资源"时返回的是暂停态（非 null）——
     判据改为"**不再排入**"（非 ok），比"=== null"更贴语义。 */
  check('队列满时不再排队（不再排入 · 队列数不增）',
    S21.queues.build.length === full21 && !(au3 && au3.ok),
    S21.autoState && S21.autoState.msg);""",
    guard='队列满时不再排队（不再排入 · 队列数不增）')

# ═══ ④ 城墙跨城段：两次调用各得一城 → 一次调用两城齐上 ═══
rep('④ 城墙跨城一次两城',
    """      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      var r1 = G.autoUpgrade();
      var r2 = G.autoUpgrade();
      var ids = [r1, r2].filter(function (r) { return r && r.target; })
        .map(function (r) { return r.target.cityId; });
      return ids.length >= 1 && ids.indexOf(b.id) >= 0 && ids.indexOf(a.id) >= 0;
    });
  })(), '两城各得一次城墙升级候选');""",
    """      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      G.autoUpgrade();   /* v89.167：一次调用即把**两城**空位排满（不再"两次调用各得一城"） */
      var qids = (st.queues.build || []).map(function (q) { return q.cityId; });
      return qids.indexOf(a.id) >= 0 && qids.indexOf(b.id) >= 0;
    });
  })(), '一次调用两城齐上（v89.167）');""",
    guard="'一次调用两城齐上（v89.167）'")

print('\nsmoke 旧断言升级完成')
